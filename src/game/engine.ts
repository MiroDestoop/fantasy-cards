import { cardHalf, getCard, RACE_IDS, RACES, SHOP_SUPPLY, STARTER_DECK } from './cards';
import { getSpecial } from './specials';
import {
  FIRST_HAND_SIZE, HAND_SIZE, MARKET_SIZE, MAX_HAND, RECALL_PRICE, ZONE_COUNT, ZONE_HP, ZONES_TO_WIN,
} from './rules';
import { cardsWord, tr } from './i18n';
import { leadsZone, makeZone, TAFEL_ZONE_EFFECTS, zoneCapacity, ZONE_EFFECTS, ZONE_NAMES, zoneEffect, zoneName, type ZoneEffectId } from './zones';
import type {
  Action, ActionResult, CardInstance, Effect, GameState, PlayerId, PlayerState, PlayTarget, Race, Zone,
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
  /** Alle rassen doen mee (voor tests). */
  allRaces?: boolean;
  /** Tafelversie: zonder Echo, Herschep en Schenk, met eenvoudige zones en zonder terugtrekken. */
  tafel?: boolean;
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
    echo: 0,
    banish: 0,
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
    outRace: null,
    curses: 0,
    tafel: !!options.tafel,
  };
  // Elk spel doet één ras niet mee: zijn kaarten verdwijnen uit de voorraad. In de tafelversie doen ze allemaal mee.
  if (!options.allRaces && !options.tafel) {
    const out = RACE_IDS[Math.floor(random(s) * RACE_IDS.length)];
    s.outRace = out;
    s.shop.pile = s.shop.pile.filter((c) => getCard(c.defId).race !== out);
    log(s, tr(`🚫 ${RACES[out].icon} De ${RACES[out].plural} doen dit spel niet mee.`, `🚫 ${RACES[out].icon} The ${RACES[out].plural} sit out this game.`));
  }
  for (const p of s.players) shuffle(s, p.deck);
  shuffle(s, s.shop.pile);
  refreshShop(s);
  if (options.plainZones) {
    s.zones = ZONE_NAMES.slice(0, ZONE_COUNT).map((n) => makeZone(n, null));
  } else {
    // Elk spel: willekeurige namen, elk met een ander willekeurig effect.
    const names = shuffled(s, ZONE_NAMES).slice(0, ZONE_COUNT);
    const effects = shuffled(s, s.tafel ? TAFEL_ZONE_EFFECTS : Object.keys(ZONE_EFFECTS) as ZoneEffectId[]);
    s.zones = names.map((n, i) => makeZone(n, effects[i]));
    for (const z of s.zones) log(s, `${z.icon} ${zoneName(z)}: ${ZONE_EFFECTS[z.effect!].icon} ${ZONE_EFFECTS[z.effect!].label}. ${ZONE_EFFECTS[z.effect!].text}`);
  }
  startTurn(s);
  return s;
}

/** Voert een actie uit op een kopie van de toestand. De originele toestand blijft ongewijzigd. */
export function applyAction(state: GameState, action: Action): ActionResult {
  if (state.winner !== null) return { ok: false, error: tr('Het spel is voorbij.', 'The game is over.') };
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
    case 'banish':
      error = banishCard(s, action.marketUid);
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
  if (!card) return tr('Die kaart zit niet in je hand.', 'That card is not in your hand.');
  const gold = state.players[state.active].gold;
  if (target.kind === 'discard') {
    const def = getCard(card.defId);
    const cost = payCost(def.top);
    if (cost > gold) return tr(`${def.name} afleggen kost ${cost} goud.`, `Discarding ${def.name} costs ${cost} gold.`);
  } else {
    const def = getCard(card.defId);
    const zone = state.zones[target.zone];
    if (!zone) return tr('Die zone bestaat niet.', 'That zone does not exist.');
    if (def.bottom.length === 0) return tr(`${def.name} kan je alleen afleggen.`, `${def.name} can only be discarded.`);
    if (zone.owner !== null) return tr(`${zoneName(zone)} is al veroverd.`, `${zoneName(zone)} has already been conquered.`);
    const toll = zoneEffect(zone)?.playCost ?? 0;
    const cost = payCost(def.bottom);
    if (toll + cost > gold && cost) return tr(`${def.name} in ${zoneName(zone)} spelen kost ${toll + cost} goud.`, `Playing ${def.name} in ${zoneName(zone)} costs ${toll + cost} gold.`);
    if (toll > gold) return tr(`${zoneEffect(zone)!.label}: een kaart in ${zoneName(zone)} spelen kost ${toll} goud.`, `${zoneEffect(zone)!.label}: playing a card in ${zoneName(zone)} costs ${toll} gold.`);
    // Ook een kaart met Terugroep of Vernietig moet eerst gelegd kunnen worden; pas daarna werkt haar effect.
    const max = zoneCapacity(zone);
    if (zoneCardCount(state, target.zone, state.active) >= max) {
      return tr(
        `Je hebt al ${max} kaarten in ${zoneName(zone)}. Trek er eerst een terug om plaats te maken.`,
        `You already have ${max} cards in ${zoneName(zone)}. Withdraw one first to make room.`,
      );
    }
  }
  return null;
}

/** Wat het keyword Betaal op deze helft kost. */
export function payCost(half: Effect[]): number {
  return half.reduce((t, e) => t + (e.kw === 'betaal' ? e.amount : 0), 0);
}

/**
 * Zoveel kaarten zou deze zet trekken boven de handlimiet: die gaan meteen naar de aflegstapel.
 * Telt Trek op de gespeelde helft en het trekken van het zone-effect, maar nooit meer dan er te trekken valt.
 */
export function drawOverflow(state: GameState, handUid: string, target: PlayTarget): number {
  const p = state.players[state.active];
  const card = p.hand.find((c) => c.uid === handUid);
  if (!card) return 0;
  const def = getCard(card.defId);
  const half = target.kind === 'discard' ? def.top : def.bottom;
  const zoneIdx = target.kind === 'zone' ? target.zone : null;
  let draws = half.reduce((t, e) => t + (e.kw === 'trek' && needMet(state, state.active, zoneIdx, e) ? e.amount : 0), 0);
  if (target.kind === 'zone') draws += zoneEffect(state.zones[target.zone])?.onPlay?.draw ?? 0;
  draws = Math.min(draws, p.deck.length + p.discard.length);
  return Math.max(0, p.hand.length - 1 + draws - MAX_HAND);
}

/** Ligt er in deze zone al een kaart van dit ras van deze speler (de gespeelde kaart zelf niet meegeteld)? */
export function raceHere(state: GameState, pid: PlayerId, zoneIdx: number, race: Race, skipUid?: string): boolean {
  return state.zones[zoneIdx].cards.some((c) => c.player === pid && c.card.uid !== skipUid && getCard(c.card.defId).race === race);
}

/** Werkt dit effect hier? Een effect met een rasvoorwaarde werkt alleen in een zone waar dat ras al van jou ligt. */
export function needMet(state: GameState, pid: PlayerId, zoneIdx: number | null, e: Effect, skipUid?: string): boolean {
  return !e.need || (zoneIdx !== null && raceHere(state, pid, zoneIdx, e.need, skipUid));
}

/** Wat het nu kost om een kaart uit een zone terug te trekken. */
export function recallPrice(state: GameState, pid: PlayerId): number {
  return RECALL_PRICE + state.players[pid].recalls;
}

export function whyCantRecall(state: GameState, zoneIdx: number, cardUid: string): string | null {
  if (state.tafel) return tr('In de tafelversie kan je niet terugtrekken.', 'You cannot withdraw in the table version.');
  const zone = state.zones[zoneIdx];
  if (!zone) return tr('Die zone bestaat niet.', 'That zone does not exist.');
  if (!zone.cards.some((c) => c.card.uid === cardUid && c.player === state.active)) {
    return tr('Je kunt alleen je eigen kaarten terugtrekken.', 'You can only withdraw your own cards.');
  }
  if (zone.owner !== null) return tr(`${zoneName(zone)} is veroverd: de kaarten daar blijven liggen.`, `${zoneName(zone)} has been conquered: the cards there stay.`);
  const price = recallPrice(state, state.active);
  if (price > state.players[state.active].gold) return tr(`Niet genoeg goud om terug te trekken (${price} nodig).`, `Not enough gold to withdraw (${price} needed).`);
  return null;
}

export function zoneCardCount(state: GameState, zoneIdx: number, pid: PlayerId): number {
  return state.zones[zoneIdx].cards.filter((c) => c.player === pid).length;
}

export function whyCantBuy(state: GameState, marketUid: string): string | null {
  const card = state.shop.market.find((c) => c.uid === marketUid);
  if (!card) return tr('Die kaart ligt niet in de winkel.', 'That card is not in the shop.');
  const price = shopPrice(state, state.active, card.defId);
  if (price > state.players[state.active].gold) return tr(`Niet genoeg goud (${price} nodig).`, `Not enough gold (${price} needed).`);
  return null;
}

/** Wat een winkelkaart nu kost voor deze speler (een Handelspost waar je voorstaat, maakt ze goedkoper). */
export function shopPrice(state: GameState, pid: PlayerId, defId: string): number {
  const base = getCard(defId).price ?? 0;
  const discount = state.zones.reduce((t, z) => t + (leadsZone(z, pid) ? zoneEffect(z)?.shopDiscountIfLeading ?? 0 : 0), 0);
  return discount ? Math.max(1, base - discount) : base;
}

export function whyCantBanish(state: GameState, marketUid: string): string | null {
  if (state.players[state.active].banish <= 0) return tr('Je kunt nu geen winkelkaart verbannen.', 'You cannot banish a shop card right now.');
  if (!state.shop.market.some((c) => c.uid === marketUid)) return tr('Die kaart ligt niet in de winkel.', 'That card is not in the shop.');
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
  const top = cardHalf(def.top, s.tafel);
  const bottom = cardHalf(def.bottom, s.tafel);
  // Betaal wordt vooraf betaald, net als de tol van een zone.
  const cost = payCost(target.kind === 'discard' ? top : bottom);

  if (target.kind === 'discard') {
    log(s, tr(`${p.name} legt ${def.name} af.`, `${p.name} discards ${def.name}.`));
    if (cost) payFor(s, p.name, cost);
    p.played.push(card);
    for (const e of top) if (needMet(s, pid, null, e)) applyEffect(s, pid, e, null, card.uid);
  } else {
    const zone = s.zones[target.zone];
    log(s, tr(`${p.name} speelt ${def.name} in ${zoneName(zone)}.`, `${p.name} plays ${def.name} in ${zoneName(zone)}.`));
    const fx = zoneEffect(zone);
    if (fx?.playCost) {
      p.gold -= fx.playCost;
      log(s, tr(`${fx.icon} ${p.name} betaalt ${fx.playCost} goud tol.`, `${fx.icon} ${p.name} pays ${fx.playCost} gold toll.`));
    }
    if (cost) payFor(s, p.name, cost);
    // Een eerdere kaart met 'echo' laat deze kaart na haar effecten meteen terugkeren (haar eigen echo telt pas voor de volgende).
    const echo = p.echo > 0;
    if (echo) p.echo--;
    // Eerst wordt de kaart gelegd, dan pas werken haar effecten. Terugroep en Vernietig slaan de kaart zelf over.
    zone.cards.push({ player: pid, card, turn: s.turn });
    // Rasvoorwaarden worden gecontroleerd vóór de effecten: een Terugroep of Vernietig op dezelfde kaart neemt de bonus niet weg.
    const met = bottom.map((e) => needMet(s, pid, target.zone, e, card.uid));
    bottom.forEach((e, i) => { if (met[i]) applyEffect(s, pid, e, target.zone, card.uid); });
    // Daarna het effect van de zone zelf.
    const onPlay = fx?.onPlay;
    if (onPlay?.gold) {
      p.gold += onPlay.gold;
      log(s, tr(`${fx!.icon} ${p.name} krijgt ${onPlay.gold} goud in ${zoneName(zone)}.`, `${fx!.icon} ${p.name} gains ${onPlay.gold} gold in ${zoneName(zone)}.`));
    }
    if (onPlay?.draw) {
      for (let i = 0; i < onPlay.draw; i++) drawCard(s, p);
      log(s, tr(`${fx!.icon} ${p.name} trekt ${cardsWord(onPlay.draw)} in ${zoneName(zone)}.`, `${fx!.icon} ${p.name} draws ${cardsWord(onPlay.draw)} in ${zoneName(zone)}.`));
    }
    if (onPlay?.selfSlow) {
      p.slow += onPlay.selfSlow;
      log(s, tr(`${fx!.icon} ${p.name} trekt volgende beurt ${cardsWord(onPlay.selfSlow)} minder.`, `${fx!.icon} ${p.name} draws ${cardsWord(onPlay.selfSlow)} fewer next turn.`));
    }
    const still = zone.cards.find((c) => c.card.uid === card.uid);
    if (echo && still) {
      zone.cards = zone.cards.filter((c) => c !== still);
      // Een Huurling gaat terug naar de winkel, een Knekelfenix naar je hand, al de rest naar je aflegstapel.
      if (hasSpecial(card.defId, 'huur')) s.shop.pile.unshift(card);
      else if (!rebirth(s, p, card)) p.discard.push(card);
      log(s, tr(`🌬️ ${def.name} keert meteen terug uit ${zoneName(zone)}.`, `🌬️ ${def.name} returns from ${zoneName(zone)} right away.`));
    }
  }
  return null;
}

function payFor(s: GameState, name: string, cost: number): void {
  s.players[s.active].gold -= cost;
  log(s, tr(`🪙 ${name} betaalt ${cost} goud.`, `🪙 ${name} pays ${cost} gold.`));
}

function discardAll(s: GameState): string | null {
  // Alleen de kaarten die er nu zitten: wat Trek onderweg bijbrengt, blijft in je hand.
  // Kaarten die goud kosten (Betaal) komen als laatste, zodat het goud van de rest ze kan betalen.
  // Wat je dan nog niet kunt betalen, blijft in je hand.
  const hand = s.players[s.active].hand;
  const uids = [...hand.filter((c) => !payCost(getCard(c.defId).top)), ...hand.filter((c) => payCost(getCard(c.defId).top))].map((c) => c.uid);
  if (!uids.length) return tr('Je hebt geen kaarten in je hand.', 'You have no cards in your hand.');
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
      zoneIdx,
      destroy: () => (zoneIdx === null ? 0 : destroyZoneCards(s, pid, zoneIdx, selfUid)),
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
      log(s, tr(`${s.players[opp].name} trekt volgende beurt ${cardsWord(e.amount)} minder.`, `${s.players[opp].name} draws ${cardsWord(e.amount)} fewer next turn.`));
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
      if (zoneIdx !== null) destroyZoneCards(s, pid, zoneIdx, selfUid);
      break;
    case 'terugroep':
      if (zoneIdx !== null) {
        const back = takeZoneCards(s, zoneIdx, pid, e.amount, selfUid);
        for (const c of back) if (!rebirth(s, p, c)) p.discard.push(c);
        if (back.length) log(s, tr(`${p.name} roept ${back.map((c) => getCard(c.defId).name).join(', ')} terug.`, `${p.name} recalls ${back.map((c) => getCard(c.defId).name).join(', ')}.`));
      }
      break;
    case 'schenk':
      if (zoneIdx !== null) {
        const gift = takeZoneCards(s, zoneIdx, pid, e.amount, selfUid);
        // Een Knekelfenix laat zich niet weggeven: ze keert terug in je eigen hand.
        for (const c of gift) if (!rebirth(s, p, c)) s.players[opp].discard.push(c);
        if (gift.length) log(s, tr(`🎁 ${p.name} schenkt ${gift.map((c) => getCard(c.defId).name).join(', ')} aan ${s.players[opp].name}.`, `🎁 ${p.name} gives ${gift.map((c) => getCard(c.defId).name).join(', ')} to ${s.players[opp].name}.`));
      }
      break;
    case 'herschep':
      if (zoneIdx !== null) newZoneEffect(s, zoneIdx);
      break;
    case 'echo':
      p.echo++;
      log(s, tr(`🌬️ De volgende kaart die ${p.name} in een zone speelt, keert meteen terug.`, `🌬️ The next card ${p.name} plays in a zone returns right away.`));
      break;
    case 'verban':
      p.banish += e.amount;
      log(s, tr(`✖ ${p.name} mag ${e.amount === 1 ? 'een winkelkaart' : `${e.amount} winkelkaarten`} verbannen.`, `✖ ${p.name} may banish ${e.amount === 1 ? 'a shop card' : `${e.amount} shop cards`}.`));
      break;
    case 'vervloek': {
      // Elke Vloek komt op een willekeurige plek in de stapel van de tegenstander.
      const deck = s.players[opp].deck;
      for (let i = 0; i < e.amount; i++) {
        deck.splice(Math.floor(random(s) * (deck.length + 1)), 0, { uid: `vloek-${s.curses++}`, defId: 'vloek' });
      }
      log(s, tr(`🕸️ ${p.name} schudt ${e.amount === 1 ? 'een Vloek' : `${e.amount} Vloeken`} in de stapel van ${s.players[opp].name}.`, `🕸️ ${p.name} shuffles ${e.amount === 1 ? 'a Curse' : `${e.amount} Curses`} into ${s.players[opp].name}'s deck.`));
      break;
    }
    case 'verdwijn':
      // Afgelegd: de kaart zelf gaat niet naar de aflegstapel maar uit het spel.
      p.played = p.played.filter((c) => c.uid !== selfUid);
      log(s, tr('🕸️ De kaart verdwijnt uit het spel.', '🕸️ The card leaves the game.'));
      break;
    case 'betaal':
      // Al betaald in playCard, vóór de andere effecten.
      break;
    case 'ververs':
      refreshShop(s);
      log(s, tr('De winkel krijgt een volledig nieuw aanbod.', 'The shop gets a completely new offer.'));
      break;
  }
}

/** Vernietig: verbant je andere kaarten in deze zone. Geeft het aantal kaarten dat de zone verliet (ook een herrezen Knekelfenix). */
function destroyZoneCards(s: GameState, pid: PlayerId, zoneIdx: number, selfUid?: string): number {
  const p = s.players[pid];
  const taken = takeZoneCards(s, zoneIdx, pid, Infinity, selfUid);
  // Een Knekelfenix verbrandt niet: ze keert terug in je hand.
  const banished = taken.filter((c) => !rebirth(s, p, c));
  if (banished.length) log(s, tr(
    `${p.name} verbant ${cardsWord(banished.length)} uit ${zoneName(s.zones[zoneIdx])} uit het spel.`,
    `${p.name} banishes ${cardsWord(banished.length)} in ${zoneName(s.zones[zoneIdx])} from the game.`,
  ));
  return taken.length;
}

/** Geeft een open zone een nieuw willekeurig effect, dat nu in geen enkele zone speelt. */
function newZoneEffect(s: GameState, zoneIdx: number): void {
  const zone = s.zones[zoneIdx];
  if (zone.owner !== null) return;
  const used = s.zones.map((z) => z.effect);
  const options = (Object.keys(ZONE_EFFECTS) as ZoneEffectId[]).filter((id) => !used.includes(id));
  if (!options.length) return;
  setZoneEffect(s, zone, options[Math.floor(random(s) * options.length)]);
}

/**
 * Zet het effect van een zone, met de levens die erbij horen. De schade blijft staan, maar een nieuw
 * effect verovert nooit zelf een zone: de levens blijven minstens 1 boven de hoogste schade.
 */
function setZoneEffect(s: GameState, zone: Zone, id: ZoneEffectId): void {
  const def = ZONE_EFFECTS[id];
  zone.effect = id;
  zone.hp = Math.max(def.hp ?? ZONE_HP + (def.hpBonus ?? 0), Math.max(...zone.damage) + 1);
  log(s, tr(
    `${zone.icon} ${zoneName(zone)} wordt ${def.icon} ${def.label}: ${def.text}`,
    `${zone.icon} ${zoneName(zone)} becomes ${def.icon} ${def.label}: ${def.text}`,
  ));
}

function dealDamage(s: GameState, zoneIdx: number, pid: PlayerId, amount: number): void {
  const zone = s.zones[zoneIdx];
  if (zone.owner !== null) return;
  const bonus = zoneEffect(zone)?.damageBonus ?? 0;
  if (bonus) {
    amount = Math.max(0, amount + bonus);
    log(s, tr(`${zoneEffect(zone)!.label} in ${zoneName(zone)}: ${bonus > 0 ? '+' : ''}${bonus} schade.`, `${zoneEffect(zone)!.label} in ${zoneName(zone)}: ${bonus > 0 ? '+' : ''}${bonus} damage.`));
    if (amount === 0) return;
  }
  const opp = other(pid);
  const blocked = Math.min(zone.shield[opp], amount);
  zone.shield[opp] -= blocked;
  if (blocked) log(s, tr(`Het schild van ${s.players[opp].name} in ${zoneName(zone)} blokkeert ${blocked} schade.`, `${s.players[opp].name}'s shield in ${zoneName(zone)} blocks ${blocked} damage.`));
  zone.damage[pid] = Math.min(zone.hp, zone.damage[pid] + amount - blocked);
  if (zone.damage[pid] >= zone.hp) {
    zone.owner = pid;
    // De zone sluit; de kaarten die er liggen, blijven er voorgoed liggen.
    log(s, tr(`🚩 ${s.players[pid].name} verovert ${zoneName(zone)}!`, `🚩 ${s.players[pid].name} conquers ${zoneName(zone)}!`));
  }
}

function buyCard(s: GameState, marketUid: string): string | null {
  const blocked = whyCantBuy(s, marketUid);
  if (blocked) return blocked;
  const p = s.players[s.active];
  const idx = s.shop.market.findIndex((c) => c.uid === marketUid);
  const card = s.shop.market[idx];
  const def = getCard(card.defId);
  const price = shopPrice(s, s.active, card.defId);
  p.gold -= price;
  p.discard.push(card);
  // Vul aan op dezelfde plek, zodat de rest van de markt niet verschuift.
  const refill = s.shop.pile.pop();
  if (refill) s.shop.market.splice(idx, 1, refill);
  else s.shop.market.splice(idx, 1);
  log(s, tr(`${p.name} koopt ${def.name} voor ${price} goud.`, `${p.name} buys ${def.name} for ${price} gold.`));
  return null;
}

function banishCard(s: GameState, marketUid: string): string | null {
  const blocked = whyCantBanish(s, marketUid);
  if (blocked) return blocked;
  const p = s.players[s.active];
  const idx = s.shop.market.findIndex((c) => c.uid === marketUid);
  const card = s.shop.market[idx];
  p.banish--;
  // Eerst de vervanger van bovenaan, dan gaat de verbannen kaart onderaan: zo komt ze niet meteen terug.
  const refill = s.shop.pile.pop();
  s.shop.pile.unshift(card);
  if (refill) s.shop.market.splice(idx, 1, refill);
  else s.shop.market.splice(idx, 1);
  log(s, tr(`✖ ${p.name} verbant ${getCard(card.defId).name} uit de winkel.`, `✖ ${p.name} banishes ${getCard(card.defId).name} from the shop.`));
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
  if (!rebirth(s, p, zc.card)) p.discard.push(zc.card);
  p.gold -= price;
  p.recalls++;
  log(s, tr(
    `${p.name} trekt ${getCard(zc.card.defId).name} terug uit ${zoneName(zone)} voor ${price} goud.`,
    `${p.name} withdraws ${getCard(zc.card.defId).name} from ${zoneName(zone)} for ${price} gold.`,
  ));
  return null;
}

/** Heeft deze kaart dit speciale effect op haar onderste helft? */
function hasSpecial(defId: string, id: string): boolean {
  return getCard(defId).bottom.some((e) => e.kw === 'speciaal' && e.id === id);
}

/** Een Knekelfenix die een zone verlaat, keert terug in je hand (als er plaats is). Geeft true als dat gebeurde. */
function rebirth(s: GameState, p: PlayerState, card: CardInstance): boolean {
  if (!hasSpecial(card.defId, 'wedergeboorte')) return false;
  if (p.hand.length >= MAX_HAND) {
    p.discard.push(card);
    log(s, tr(`🔥 ${getCard(card.defId).name} herrijst, maar je hand is vol: ze gaat naar je aflegstapel.`, `🔥 ${getCard(card.defId).name} rises again, but the hand is full: she goes to the discard pile.`));
  } else {
    p.hand.push(card);
    log(s, tr(`🔥 ${getCard(card.defId).name} herrijst uit haar as en keert terug in de hand van ${p.name}.`, `🔥 ${getCard(card.defId).name} rises from her ashes and returns to ${p.name}'s hand.`));
  }
  return true;
}

function endTurn(s: GameState): void {
  const p = s.players[s.active];
  // Huurlingen vertrekken aan het einde van je beurt, ook uit een veroverde zone: ze gaan onderaan de winkelvoorraad.
  for (const z of s.zones) {
    const hired = z.cards.filter((c) => c.player === s.active && hasSpecial(c.card.defId, 'huur'));
    if (!hired.length) continue;
    z.cards = z.cards.filter((c) => !hired.includes(c));
    s.shop.pile.unshift(...hired.map((c) => c.card));
    log(s, tr(
      `🗡️ ${hired.length > 1 ? `${hired.length} huurlingen vertrekken` : 'De huurling vertrekt'} uit ${zoneName(z)} en gaat terug naar de winkel.`,
      `🗡️ ${hired.length > 1 ? `${hired.length} mercenaries leave` : 'The mercenary leaves'} ${zoneName(z)} and returns to the shop.`,
    ));
  }
  p.discard.push(...p.played, ...p.hand);
  p.played = [];
  p.echo = 0;
  p.banish = 0;
  p.hand = [];
  s.active = other(s.active);
  startTurn(s);
}

function startTurn(s: GameState): void {
  s.turn++;
  const pid = s.active;
  const p = s.players[pid];
  log(s, tr(`— ${p.name} is aan de beurt —`, `— ${p.name}'s turn —`));
  if (p.bonusGold) {
    p.gold += p.bonusGold;
    log(s, tr(`${p.name} krijgt ${p.bonusGold} bonusgoud.`, `${p.name} gets ${p.bonusGold} bonus gold.`));
  }
  for (const z of s.zones) {
    const heal = zoneEffect(z)?.healEachTurn ?? 0;
    const opp = other(pid);
    if (heal && z.owner === null && z.damage[opp] > 0) {
      const healed = Math.min(heal, z.damage[opp]);
      z.damage[opp] -= healed;
      log(s, tr(`🕊️ De Heilige bron in ${zoneName(z)} wist ${healed} schade van ${s.players[opp].name} uit.`, `🕊️ The Holy Spring in ${zoneName(z)} washes away ${healed} of ${s.players[opp].name}'s damage.`));
    }
    const gold = zoneEffect(z)?.goldIfLeading ?? 0;
    if (gold && leadsZone(z, pid)) {
      p.gold += gold;
      log(s, tr(`💰 ${p.name} staat voor in ${zoneName(z)} en krijgt ${gold} goud.`, `💰 ${p.name} leads in ${zoneName(z)} and gains ${gold} gold.`));
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
    log(s, tr(`${p.name} schudt de aflegstapel tot een nieuwe stapel.`, `${p.name} shuffles the discard pile into a new deck.`));
  }
  const card = p.deck.pop()!;
  if (p.hand.length >= MAX_HAND) {
    p.discard.push(card);
    log(s, tr(`${p.name} heeft al ${MAX_HAND} kaarten: ${getCard(card.defId).name} gaat naar de aflegstapel.`, `${p.name} already has ${MAX_HAND} cards: ${getCard(card.defId).name} goes to the discard pile.`));
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
