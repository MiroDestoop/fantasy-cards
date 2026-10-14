import { getCard, SHOP_SUPPLY, STARTER_DECK } from './cards';
import { HAND_SIZE, MARKET_SIZE, MAX_HAND, ZONE_HP, ZONE_SETUP, ZONES_TO_WIN } from './rules';
import type {
  Action, ActionResult, CardInstance, Effect, GameState, PlayerId, PlayerState, PlayTarget,
} from './types';

const MAX_LOG = 60;

export function other(p: PlayerId): PlayerId {
  return p === 0 ? 1 : 0;
}

export function createGame(names: [string, string], seed = Math.floor(Math.random() * 2 ** 31)): GameState {
  const makePlayer = (name: string, pid: PlayerId): PlayerState => ({
    name,
    deck: STARTER_DECK.map((defId, i) => ({ uid: `p${pid}-${i}`, defId })),
    hand: [],
    discard: [],
    gold: 0,
    slow: 0,
  });
  const s: GameState = {
    players: [makePlayer(names[0], 0), makePlayer(names[1], 1)],
    zones: ZONE_SETUP.map((z) => ({ ...z, damage: [0, 0], shield: [0, 0], owner: null, cards: [] })),
    active: 0,
    turn: 0,
    winner: null,
    shop: { pile: SHOP_SUPPLY.map((defId, i) => ({ uid: `s-${i}`, defId })), market: [] },
    log: [],
    seed,
  };
  for (const p of s.players) shuffle(s, p.deck);
  shuffle(s, s.shop.pile);
  while (s.shop.market.length < MARKET_SIZE && s.shop.pile.length) s.shop.market.push(s.shop.pile.pop()!);
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
    case 'buy':
      error = buyCard(s, action.marketUid);
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
  if (!state.players[state.active].hand.some((c) => c.uid === handUid)) return 'Die kaart zit niet in je hand.';
  if (target.kind === 'zone') {
    const zone = state.zones[target.zone];
    if (!zone) return 'Die zone bestaat niet.';
    if (zone.owner !== null) return `${zone.name} is al veroverd.`;
  }
  return null;
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
    p.discard.push(card);
    for (const e of def.top) applyEffect(s, pid, e, null);
  } else {
    const zone = s.zones[target.zone];
    log(s, `${p.name} speelt ${def.name} in ${zone.name}.`);
    zone.cards.push({ player: pid, card, turn: s.turn });
    for (const e of def.bottom) applyEffect(s, pid, e, target.zone);
  }
  return null;
}

/** `zoneIdx` is de zone waarin de kaart gespeeld werd, of null bij afleggen. */
function applyEffect(s: GameState, pid: PlayerId, e: Effect, zoneIdx: number | null): void {
  const p = s.players[pid];
  const opp = other(pid);
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
  }
}

function dealDamage(s: GameState, zoneIdx: number, pid: PlayerId, amount: number): void {
  const zone = s.zones[zoneIdx];
  if (zone.owner !== null) return;
  const opp = other(pid);
  const blocked = Math.min(zone.shield[opp], amount);
  zone.shield[opp] -= blocked;
  if (blocked) log(s, `Het schild van ${s.players[opp].name} in ${zone.name} blokkeert ${blocked} schade.`);
  zone.damage[pid] = Math.min(ZONE_HP, zone.damage[pid] + amount - blocked);
  if (zone.damage[pid] >= ZONE_HP) {
    zone.owner = pid;
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

function endTurn(s: GameState): void {
  const p = s.players[s.active];
  p.discard.push(...p.hand);
  p.hand = [];
  s.active = other(s.active);
  startTurn(s);
}

function startTurn(s: GameState): void {
  s.turn++;
  const pid = s.active;
  const p = s.players[pid];
  log(s, `— ${p.name} is aan de beurt —`);
  // Kaarten die je vorige beurt in zones legde, gaan nu naar je aflegstapel.
  for (const zone of s.zones) {
    p.discard.push(...zone.cards.filter((c) => c.player === pid).map((c) => c.card));
    zone.cards = zone.cards.filter((c) => c.player !== pid);
  }
  const count = Math.max(0, HAND_SIZE - p.slow);
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

function shuffle(s: GameState, a: CardInstance[]): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}
