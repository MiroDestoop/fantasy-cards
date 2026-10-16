import { getCard, SHOP_SUPPLY, STARTER_DECK } from './cards';
import { getSpecial } from './specials';
import {
  FIRST_HAND_SIZE, HAND_SIZE, MARKET_SIZE, MAX_HAND, MAX_ZONE_CARDS, RECALL_PRICE, ZONE_COUNT, ZONES_TO_WIN,
} from './rules';
import { makeZone, ZONE_EFFECTS, ZONE_NAMES, zoneEffect, type ZoneEffectId } from './zones';
import type {
  Action, ActionResult, CardInstance, Effect, GameState, PlayerId, PlayerState, PlayTarget,
} from './types';

const MAX_LOG = 60;

export function other(p: PlayerId): PlayerId {
  return p === 0 ? 1 : 0;
}

export interface GameOptions {
  /** Extra goud per beurt voor elke speler, bv. [0, 1] voor een computer met een bonus. */
  bonusGold?: [number, number];
  /** Wie de eerste beurt speelt (standaard speler 0). In een best-of-3 begint elke speler minstens één keer. */
  starter?: PlayerId;
  /** Zones zonder effect en in vaste volgorde (voor tests). */
  plainZones?: boolean;
}

export function createGame(
  names: [string, string],
  seed = Math.floor(Math.random() * 2 ** 31),
  options: GameOptions = {},
): GameState {
  const makePlayer = (name: string, pid: PlayerId): PlayerState => ({
    name,
    deck: STARTER_DECK.map((defId, i) => ({ uid: `p${pid}-${i}`, defId })),
    hand: [],
    discard: [],
    played: [],
    gold: 0,
    recalls: 0,
    bonusGold: options.bonusGold?.[pid] ?? 0,
    slow: 0,
  });
  const s: GameState = {
    players: [makePlayer(names[0], 0), makePlayer(names[1], 1)],
    zones: [],
    active: options.starter ?? 0,
    turn: 0,
    winner: null,
    shop: { pile: SHOP_SUPPLY.map((defId, i) => ({ uid: `s-${i}`, defId })), market: [] },
    log: [],
    seed,
  };
  for (const p of s.players) shuffle(s, p.deck);
  shuffle(s, s.shop.pile);
  refreshShop(s);
  if (options.plainZones) {
    s.zones = ZONE_NAMES.slice(0, ZONE_COUNT).map((n) => makeZone(n, null));
  } else {
    // Elk spel: willekeurige namen, elk met een ander willekeurig effect.
    const names = shuffled(s, ZONE_NAMES).slice(0, ZONE_COUNT);
    const effects = shuffled(s, Object.keys(ZONE_EFFECTS) as ZoneEffectId[]);
    s.zones = names.map((n, i) => makeZone(n, effects[i]));
    for (const z of s.zones) log(s, `${z.icon} ${z.name}: ${ZONE_EFFECTS[z.effect!].icon} ${ZONE_EFFECTS[z.effect!].label}. ${ZONE_EFFECTS[z.effect!].text}`);
  }
  startTurn(s);
  return s;
}

/** Voert een actie uit op een kopie van de toestand. De originele toestand blijft ongewijzigd. */
export function applyAction(state: GameState, action: Action): ActionResult {
  if (state.winner !== null) return { ok: false, error: 'Het spel is voorbij.' };
  const s = structuredClone(state);
  let error: string | null = null;
  switch (action.type) {
    case 'play':
      error = playCard(s, action.handUid, action.target);
      break;
    case 'discardAll':
      error = discardAll(s);
      break;
    case 'buy':
      error = buyCard(s, action.marketUid);
      break;
    case 'recall':
      error = recallCard(s, action.zone, action.cardUid);
      break;
    case 'endTurn':
      endTurn(s);
      break;
  }
  if (error) return { ok: false, error };
  checkWinner(s);
  return { ok: true, state: s };
}

export function whyCantPlay(state: GameState, handUid: string, target: PlayTarget): string | null {
  const card = state.players[state.active].hand.find((c) => c.uid === handUid);
  if (!card) return 'Die kaart zit niet in je hand.';
  if (target.kind === 'zone') {
    const def = getCard(card.defId);
    const zone = state.zones[target.zone];
    if (!zone) return 'Die zone bestaat niet.';
    if (def.bottom.length === 0) return `${def.name} kan je alleen afleggen.`;
    if (zone.owner !== null) return `${zone.name} is al veroverd.`;
    const cost = zoneEffect(zone)?.playCost ?? 0;
    if (cost > state.players[state.active].gold) return `${zoneEffect(zone)!.label}: een kaart in ${zone.name} spelen kost ${cost} goud.`;
    // Ook een kaart met Terugroep of Vernietig moet eerst gelegd kunnen worden; pas daarna werkt haar effect.
    if (zoneCardCount(state, target.zone, state.active) >= MAX_ZONE_CARDS) {
      return `Je hebt al ${MAX_ZONE_CARDS} kaarten in ${zone.name}. Trek er eerst een terug om plaats te maken.`;
    }
  }
  return null;
}

/** Wat het nu kost om een kaart uit een zone terug te trekken. */
export function recallPrice(state: GameState, pid: PlayerId): number {
  return RECALL_PRICE + state.players[pid].recalls;
}

export function whyCantRecall(state: GameState, zoneIdx: number, cardUid: string): string | null {
  const zone = state.zones[zoneIdx];
  if (!zone) return 'Die zone bestaat niet.';
  if (!zone.cards.some((c) => c.card.uid === cardUid && c.player === state.active)) {
    return 'Je kunt alleen je eigen kaarten terugtrekken.';
  }
  if (zone.owner !== null) return `${zone.name} is veroverd: de kaarten daar blijven liggen.`;
  const price = recallPrice(state, state.active);
  if (price > state.players[state.active].gold) return `Niet genoeg goud om terug te trekken (${price} nodig).`;
  return null;
}

export function zoneCardCount(state: GameState, zoneIdx: number, pid: PlayerId): number {
  return state.zones[zoneIdx].cards.filter((c) => c.player === pid).length;
}

export function whyCantBuy(state: GameState, marketUid: string): string | null {
  const card = state.shop.market.find((c) => c.uid === marketUid);
  if (!card) return 'Die kaart ligt niet in de winkel.';
  const price = getCard(card.defId).price ?? 0;
  if (price > state.players[state.active].gold) return `Niet genoeg goud (${price} nodig).`;
  return null;
}

export function zonesOwnedBy(state: GameState, pid: PlayerId): number {
  return state.zones.filter((z) => z.owner === pid).length;
}

// ---------- Interne regels ----------

function playCard(s: GameState, handUid: string, target: PlayTarget): string | null {
  const blocked = whyCantPlay(s, handUid, target);
  if (blocked) return blocked;
  const pid = s.active;
  const p = s.players[pid];
  const [card] = p.hand.splice(p.hand.findIndex((c) => c.uid === handUid), 1);
  const def = getCard(card.defId);

  if (target.kind === 'discard') {
    log(s, `${p.name} legt ${def.name} af.`);
    p.played.push(card);
    for (const e of def.top) applyEffect(s, pid, e, null);
  } else {
    const zone = s.zones[target.zone];
    log(s, `${p.name} speelt ${def.name} in ${zone.name}.`);
    const fx = zoneEffect(zone);
    if (fx?.playCost) {
      p.gold -= fx.playCost;
      log(s, `${fx.icon} ${p.name} betaalt ${fx.playCost} goud tol.`);
    }
    // Eerst wordt de kaart gelegd, dan pas werken haar effecten. Terugroep en Vernietig slaan de kaart zelf over.
    zone.cards.push({ player: pid, card, turn: s.turn });
    for (const e of def.bottom) applyEffect(s, pid, e, target.zone, card.uid);
    // Daarna het effect van de zone zelf.
    const onPlay = fx?.onPlay;
    if (onPlay?.gold) {
      p.gold += onPlay.gold;
      log(s, `${fx!.icon} ${p.name} krijgt ${onPlay.gold} goud in ${zone.name}.`);
    }
    if (onPlay?.draw) {
      for (let i = 0; i < onPlay.draw; i++) drawCard(s, p);
      log(s, `${fx!.icon} ${p.name} trekt ${onPlay.draw} kaart in ${zone.name}.`);
    }
    if (onPlay?.selfSlow) {
      p.slow += onPlay.selfSlow;
      log(s, `${fx!.icon} ${p.name} trekt volgende beurt ${onPlay.selfSlow} kaart minder.`);
    }
  }
  return null;
}

function discardAll(s: GameState): string | null {
  // Alleen de kaarten die er nu zitten: wat Trek onderweg bijbrengt, blijft in je hand.
  const uids = s.players[s.active].hand.map((c) => c.uid);
  if (!uids.length) return 'Je hebt geen kaarten in je hand.';
  for (const uid of uids) {
    if (s.players[s.active].hand.some((c) => c.uid === uid)) playCard(s, uid, { kind: 'discard' });
  }
  return null;
}

/** Haalt de `count` oudste kaarten van een speler uit een zone (alles bij Infinity). */
function takeZoneCards(s: GameState, zoneIdx: number, pid: PlayerId, count: number, skipUid?: string): CardInstance[] {
  const zone = s.zones[zoneIdx];
  // Kaarten worden achteraan toegevoegd, dus de oudste staan vooraan.
  const taken = zone.cards.filter((c) => c.player === pid && c.card.uid !== skipUid).slice(0, count);
  zone.cards = zone.cards.filter((c) => !taken.includes(c));
  return taken.map((c) => c.card);
}

function refreshShop(s: GameState): void {
  const { shop } = s;
  // De oude kaarten gaan onderaan de voorraad; er wordt van bovenaan (het einde) getrokken.
  shop.pile.unshift(...shop.market);
  shop.market = [];
  while (shop.market.length < MARKET_SIZE && shop.pile.length) shop.market.push(shop.pile.pop()!);
}

/**
 * `zoneIdx` is de zone waarin de kaart gespeeld werd, of null bij afleggen.
 * `selfUid` is de gespeelde kaart zelf, die Terugroep en Vernietig laten liggen.
 */
function applyEffect(s: GameState, pid: PlayerId, e: Effect, zoneIdx: number | null, selfUid?: string): void {
  const p = s.players[pid];
  const opp = other(pid);
  if (e.kw === 'speciaal') {
    getSpecial(e.id).run({
      state: s,
      me: p,
      meId: pid,
      opp: s.players[opp],
      oppId: opp,
      zone: zoneIdx === null ? null : s.zones[zoneIdx],
      damage: (amount) => {
        if (zoneIdx !== null && amount > 0) dealDamage(s, zoneIdx, pid, amount);
      },
      draw: (count) => {
        for (let i = 0; i < count; i++) drawCard(s, p);
      },
      log: (message) => log(s, message),
    });
    return;
  }
  switch (e.kw) {
    case 'goud':
      p.gold += e.amount;
      break;
    case 'trek':
      for (let i = 0; i < e.amount; i++) drawCard(s, p);
      break;
    case 'vertraag':
      s.players[opp].slow += e.amount;
      log(s, `${s.players[opp].name} trekt volgende beurt ${e.amount} kaart(en) minder.`);
      break;
    case 'storm':
      s.zones.forEach((_, i) => dealDamage(s, i, pid, e.amount));
      break;
    case 'aanval':
      if (zoneIdx !== null) dealDamage(s, zoneIdx, pid, e.amount);
      break;
    case 'herstel':
      if (zoneIdx !== null) {
        const zone = s.zones[zoneIdx];
        zone.damage[opp] = Math.max(0, zone.damage[opp] - e.amount);
      }
      break;
    case 'schild':
      if (zoneIdx !== null) s.zones[zoneIdx].shield[pid] += e.amount;
      break;
    case 'vernietig':
      if (zoneIdx !== null) {
        const n = takeZoneCards(s, zoneIdx, pid, Infinity, selfUid).length;
        if (n) log(s, `${p.name} verbant ${n} kaart(en) uit ${s.zones[zoneIdx].name} uit het spel.`);
      }
      break;
    case 'terugroep':
      if (zoneIdx !== null) {
        const back = takeZoneCards(s, zoneIdx, pid, e.amount, selfUid);
        p.discard.push(...back);
        if (back.length) log(s, `${p.name} roept ${back.map((c) => getCard(c.defId).name).join(', ')} terug.`);
      }
      break;
    case 'ververs':
      refreshShop(s);
      log(s, 'De winkel krijgt een volledig nieuw aanbod.');
      break;
  }
}

function dealDamage(s: GameState, zoneIdx: number, pid: PlayerId, amount: number): void {
  const zone = s.zones[zoneIdx];
  if (zone.owner !== null) return;
  const bonus = zoneEffect(zone)?.damageBonus ?? 0;
  if (bonus) {
    amount = Math.max(0, amount + bonus);
    log(s, `${zoneEffect(zone)!.label} in ${zone.name}: ${bonus > 0 ? '+' : ''}${bonus} schade.`);
    if (amount === 0) return;
  }
  const opp = other(pid);
  const blocked = Math.min(zone.shield[opp], amount);
  zone.shield[opp] -= blocked;
  if (blocked) log(s, `Het schild van ${s.players[opp].name} in ${zone.name} blokkeert ${blocked} schade.`);
  zone.damage[pid] = Math.min(zone.hp, zone.damage[pid] + amount - blocked);
  if (zone.damage[pid] >= zone.hp) {
    zone.owner = pid;
    // De zone sluit; de kaarten die er liggen, blijven er voorgoed liggen.
    log(s, `🚩 ${s.players[pid].name} verovert ${zone.name}!`);
  }
}

function buyCard(s: GameState, marketUid: string): string | null {
  const blocked = whyCantBuy(s, marketUid);
  if (blocked) return blocked;
  const p = s.players[s.active];
  const idx = s.shop.market.findIndex((c) => c.uid === marketUid);
  const card = s.shop.market[idx];
  const def = getCard(card.defId);
  p.gold -= def.price ?? 0;
  p.discard.push(card);
  // Vul aan op dezelfde plek, zodat de rest van de markt niet verschuift.
  const refill = s.shop.pile.pop();
  if (refill) s.shop.market.splice(idx, 1, refill);
  else s.shop.market.splice(idx, 1);
  log(s, `${p.name} koopt ${def.name} voor ${def.price} goud.`);
  return null;
}

function recallCard(s: GameState, zoneIdx: number, cardUid: string): string | null {
  const blocked = whyCantRecall(s, zoneIdx, cardUid);
  if (blocked) return blocked;
  const p = s.players[s.active];
  const zone = s.zones[zoneIdx];
  const price = recallPrice(s, s.active);
  const zc = zone.cards.find((c) => c.card.uid === cardUid)!;
  zone.cards = zone.cards.filter((c) => c !== zc);
  p.discard.push(zc.card);
  p.gold -= price;
  p.recalls++;
  log(s, `${p.name} trekt ${getCard(zc.card.defId).name} terug uit ${zone.name} voor ${price} goud.`);
  return null;
}

function endTurn(s: GameState): void {
  const p = s.players[s.active];
  p.discard.push(...p.played, ...p.hand);
  p.played = [];
  p.hand = [];
  s.active = other(s.active);
  startTurn(s);
}

function startTurn(s: GameState): void {
  s.turn++;
  const pid = s.active;
  const p = s.players[pid];
  log(s, `— ${p.name} is aan de beurt —`);
  if (p.bonusGold) {
    p.gold += p.bonusGold;
    log(s, `${p.name} krijgt ${p.bonusGold} bonusgoud.`);
  }
  for (const z of s.zones) {
    const gold = zoneEffect(z)?.goldIfLeading ?? 0;
    if (gold && z.owner === null && z.damage[pid] > z.damage[other(pid)]) {
      p.gold += gold;
      log(s, `💰 ${p.name} staat voor in ${z.name} en krijgt ${gold} goud.`);
    }
  }
  const count = Math.max(0, (s.turn === 1 ? FIRST_HAND_SIZE : HAND_SIZE) - p.slow);
  p.slow = 0;
  for (let i = 0; i < count; i++) drawCard(s, p);
}

function drawCard(s: GameState, p: PlayerState): void {
  if (p.deck.length === 0) {
    if (p.discard.length === 0) return;
    p.deck = p.discard;
    p.discard = [];
    shuffle(s, p.deck);
    log(s, `${p.name} schudt de aflegstapel tot een nieuwe stapel.`);
  }
  const card = p.deck.pop()!;
  if (p.hand.length >= MAX_HAND) {
    p.discard.push(card);
    log(s, `${p.name} heeft al ${MAX_HAND} kaarten: ${getCard(card.defId).name} gaat naar de aflegstapel.`);
    return;
  }
  p.hand.push(card);
}

function checkWinner(s: GameState): void {
  for (const pid of [0, 1] as const) {
    if (zonesOwnedBy(s, pid) >= ZONES_TO_WIN) s.winner = pid;
  }
}

function log(s: GameState, msg: string): void {
  s.log.push(msg);
  if (s.log.length > MAX_LOG) s.log.shift();
}

/** Mulberry32: een kleine, voorspelbare toevalsgenerator. */
function random(s: GameState): number {
  let t = (s.seed = (s.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Een geschudde kopie (met de toevalsgenerator van het spel, dus reproduceerbaar). */
function shuffled<T>(s: GameState, a: readonly T[]): T[] {
  const copy = [...a];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function shuffle(s: GameState, a: CardInstance[]): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}
