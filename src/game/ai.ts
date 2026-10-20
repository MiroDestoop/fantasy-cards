import { tr } from './i18n';
import { getCard } from './cards';
import { applyAction, other, recallPrice, whyCantBuy, whyCantPlay, zoneCardCount } from './engine';
import { ZONE_HP } from './rules';
import { zoneCapacity, zoneEffect } from './zones';
import type { Action, CardDef, CardInstance, GameState, PlayerId, PlayTarget } from './types';

/**
 * De computertegenstander, in vier niveaus. Elk niveau bouwt verder op het vorige:
 * - Normaal: speelt haar hand kaart per kaart (telkens de beste zet volgens `evaluate`),
 *   koopt dan de duurste betaalbare kaart en eindigt haar beurt.
 * - Moeilijk: zoekt de beste volgorde voor haar hele hand (beam search), koopt slim,
 *   trekt kaarten terug als dat helpt en verdedigt beter.
 * - Extreem: speelt daarnaast de beurten erna een paar keer na en kiest de beurt
 *   waarna ze er gemiddeld het best voor staat.
 * - Legendarisch: speelt zoals Extreem, met een openlijke bonus van 1 goud per beurt (`bonusGold`).
 * Geen enkel niveau speelt vals: verborgen kaarten (handen, de volgorde van stapels en de
 * winkelvoorraad) gebruikt ze nooit.
 */
export type AiLevel = 'normaal' | 'moeilijk' | 'extreem' | 'legendarisch';

// label is een getter, in de gekozen taal.
export const AI_LEVELS: { id: AiLevel; readonly label: string; icon: string; bonusGold: number }[] = [
  { id: 'normaal', get label() { return tr('Normaal', 'Normal'); }, icon: '😐', bonusGold: 0 },
  { id: 'moeilijk', get label() { return tr('Moeilijk', 'Hard'); }, icon: '😠', bonusGold: 0 },
  { id: 'extreem', get label() { return tr('Extreem', 'Extreme'); }, icon: '😈', bonusGold: 0 },
  // Slimmer denken levert boven Extreem niets meetbaars meer op; Legendarisch krijgt daarom een openlijke bonus.
  { id: 'legendarisch', get label() { return tr('Legendarisch', 'Legendary'); }, icon: '💀', bonusGold: 1 },
];

interface Profile {
  /** 'duurste': de duurste betaalbare kaart. 'slim': naar de situatie, en soms sparen. */
  buy: 'duurste' | 'slim';
  /** Trekt ze kaarten terug als haar zones vol zitten? */
  recall: boolean;
  /** Hoe zwaar de schade van de tegenstander weegt; hoger betekent meer verdedigen. */
  threatWeight: number;
  /** 0: kaart per kaart beslissen. Anders: zoveel beste tussenstanden houdt de beam search bij. */
  beam: number;
  /** 0: niet vooruitkijken. Anders: zo vaak speelt ze de beurten na de hare na, per kandidaat. */
  rollouts: number;
  /** Zoveel van de beste beurten uit de beam search speelt ze na. */
  candidates: number;
  /** Zoveel rondes (haar beurt + die van de tegenstander) speelt ze na. */
  horizon: number;
  /** Zo speelt de tegenstander bij het naspelen. */
  opponentModel: AiLevel;
}

const PROFILES: Record<AiLevel, Profile> = {
  normaal: { buy: 'duurste', recall: false, threatWeight: 1, beam: 0, rollouts: 0, candidates: 0, horizon: 0, opponentModel: 'normaal' },
  moeilijk: { buy: 'slim', recall: true, threatWeight: 1.5, beam: 6, rollouts: 0, candidates: 0, horizon: 0, opponentModel: 'normaal' },
  extreem: { buy: 'slim', recall: true, threatWeight: 1.5, beam: 6, rollouts: 4, candidates: 4, horizon: 2, opponentModel: 'normaal' },
  legendarisch: { buy: 'slim', recall: true, threatWeight: 1.5, beam: 6, rollouts: 4, candidates: 4, horizon: 2, opponentModel: 'normaal' },
};

/**
 * Kiest één actie voor de speler die aan zet is. `rnd` is alleen nodig voor Legendarisch,
 * dat verborgen kaarten willekeurig verdeelt bij het naspelen; tests geven een vaste mee.
 */
export function chooseAction(state: GameState, level: AiLevel = 'normaal', rnd: () => number = Math.random): Action {
  return decide(state, PROFILES[level], level, rnd);
}

/** Bij het naspelen speelt ze haar eigen beurt snel verder: kaart per kaart, maar wel slim kopen. */
const ROLLOUT_SELF: Profile = { ...PROFILES.normaal, buy: 'slim', recall: true, threatWeight: 1.5 };

function decide(state: GameState, profile: Profile, level: AiLevel, rnd: () => number): Action {
  const pid = state.active;
  const hand = state.players[pid].hand;
  // Een Vloek die ze niet kan betalen, blijft in haar hand: dan is ze klaar met spelen.
  if (playActions(state, pid).some((a) => a.type === 'play' && !whyCantPlay(state, a.handUid, a.target))) {
    if (profile.beam) return plannedAction(state, level, profile, rnd);
    if (profile.recall) {
      const recall = unblockingRecall(state, pid);
      if (recall) return recall;
    }
    return bestPlay(state, pid, hand, profile);
  }
  const buy = profile.buy === 'slim' ? smartBuy(state) : bestBuy(state);
  if (buy) return { type: 'buy', marketUid: buy.uid };
  return { type: 'endTurn' };
}

// ---------- Normaal: kaart per kaart ----------

function playActions(state: GameState, pid: PlayerId): Action[] {
  const targets: PlayTarget[] = [{ kind: 'discard' }, ...state.zones.map((_, zone) => ({ kind: 'zone' as const, zone }))];
  const actions: Action[] = [];
  const tried = new Set<string>();
  for (const card of state.players[pid].hand) {
    // Twee dezelfde kaarten geven dezelfde uitkomst; één keer proberen volstaat.
    if (tried.has(card.defId)) continue;
    tried.add(card.defId);
    for (const target of targets) actions.push({ type: 'play', handUid: card.uid, target });
  }
  return actions;
}

function bestPlay(state: GameState, pid: PlayerId, hand: CardInstance[], profile: Profile): Action {
  let best: Action = { type: 'play', handUid: hand[0].uid, target: { kind: 'discard' } };
  let bestScore = -Infinity;
  for (const action of playActions(state, pid)) {
    const r = applyAction(state, action);
    if (!r.ok) continue;
    const score = evaluate(r.state, pid, profile);
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best;
}

/**
 * Liggen er in de winkel alleen kaarten onder deze prijs, dan mogen ook die gekocht worden.
 * Anders raakt de winkel vol goedkope kaarten die niemand koopt, en ververst ze nooit meer.
 */
function priceFloor(state: GameState, floor: number): number {
  return state.shop.market.some((c) => (getCard(c.defId).price ?? 0) >= floor) ? floor : 0;
}

/** Koopt de duurste betaalbare kaart; goedkope kaarten (onder 3 goud) laat ze liggen, tenzij er niets anders ligt. */
function bestBuy(state: GameState): CardInstance | null {
  let best: CardInstance | null = null;
  let bestRating = 0;
  const floor = priceFloor(state, 3);
  for (const card of state.shop.market) {
    if (whyCantBuy(state, card.uid)) continue;
    const def = getCard(card.defId);
    const price = def.price ?? 0;
    if (price < floor) continue;
    // Bij gelijke prijs liever een kaart die schade doet.
    const rating = price + (def.bottom.some((e) => e.kw === 'aanval') ? 0.5 : 0);
    if (rating > bestRating) {
      bestRating = rating;
      best = card;
    }
  }
  return best;
}

// ---------- Moeilijk: slim kopen en terugtrekken ----------

/** Kiest de kaart die nu het meest helpt, of spaart als een duidelijk betere kaart bijna betaalbaar is. */
function smartBuy(state: GameState): CardInstance | null {
  const pid = state.active;
  const gold = state.players[pid].gold;
  // Laat in het spel helpen goedkope kaarten niet meer: ze komen te laat in je hand.
  const minPrice = priceFloor(state, state.turn >= 20 ? 5 : 3);
  const rated = state.shop.market
    .map((card) => ({ card, def: getCard(card.defId) }))
    .filter(({ def }) => (def.price ?? 0) >= minPrice)
    .map((x) => ({ ...x, rating: buyRating(state, pid, x.def) }));
  const affordable = rated.filter(({ card }) => !whyCantBuy(state, card.uid));
  if (!affordable.length) return null;
  const best = affordable.reduce((a, b) => (b.rating > a.rating ? b : a));
  const dream = rated.reduce((a, b) => (b.rating > a.rating ? b : a));
  // Goud blijft bewaard: sparen loont als de betere kaart volgende beurt waarschijnlijk betaalbaar is.
  if (dream.rating >= best.rating + 2 && (dream.def.price ?? 0) <= gold + 3) return null;
  return best.card;
}

function buyRating(state: GameState, pid: PlayerId, def: CardDef): number {
  const open = state.zones.map((z, i) => ({ z, i })).filter(({ z }) => z.owner === null);
  const has = (kws: string[]) => def.bottom.some((e) => kws.includes(e.kw));
  const attack = def.bottom.reduce((t, e) => t + (e.kw === 'aanval' ? e.amount : 0), 0);
  let rating = def.price ?? 0;
  if (attack) rating += 0.5;
  // Bijna een zone veroverd: schade is nu extra veel waard.
  if (open.some(({ z }) => z.damage[pid] >= z.hp * 0.6)) rating += 0.3 * attack;
  // Zones raken vol: Terugroep en Vernietig maken plaats.
  if (has(['terugroep', 'vernietig', 'schenk']) && open.some(({ i }) => zoneCardCount(state, i, pid) >= zoneCapacity(state.zones[i]) - 1)) {
    rating += 1.5;
  }
  // De tegenstander wint bijna een zone: Herstel en Schild houden haar tegen.
  if (has(['herstel', 'schild']) && open.some(({ z }) => z.damage[other(pid)] >= z.hp * 0.6)) rating += 1;
  return rating;
}

/**
 * Zitten al haar open zones vol terwijl ze nog een kaart voor een zone in haar hand heeft,
 * dan trekt ze haar zwakste kaart terug uit de zone waar ze het verst staat.
 */
function unblockingRecall(state: GameState, pid: PlayerId): Action | null {
  const me = state.players[pid];
  if (!me.hand.some((c) => getCard(c.defId).bottom.length)) return null;
  const open = state.zones.map((z, i) => ({ z, i })).filter(({ z }) => z.owner === null);
  if (!open.length || open.some(({ z, i }) => zoneCardCount(state, i, pid) < zoneCapacity(z))) return null;
  if (me.gold < recallPrice(state, pid)) return null;
  const { z, i } = open.reduce((a, b) => (b.z.damage[pid] > a.z.damage[pid] ? b : a));
  const mine = z.cards.filter((c) => c.player === pid);
  const weakest = mine.reduce((a, b) => (cardWorth(b.card) < cardWorth(a.card) ? b : a));
  return { type: 'recall', zone: i, cardUid: weakest.card.uid };
}

function recallActions(state: GameState, pid: PlayerId): Action[] {
  if (state.players[pid].gold < recallPrice(state, pid)) return [];
  const actions: Action[] = [];
  state.zones.forEach((z, i) => {
    // Alleen in volle zones: anders is terugtrekken weggegooid goud.
    if (z.owner !== null || zoneCardCount(state, i, pid) < zoneCapacity(z)) return;
    const tried = new Set<string>();
    for (const c of z.cards) {
      if (c.player !== pid || tried.has(c.card.defId)) continue;
      tried.add(c.card.defId);
      actions.push({ type: 'recall', zone: i, cardUid: c.card.uid });
    }
  });
  return actions;
}

// ---------- Extreem en Legendarisch: de hele beurt plannen ----------

interface Node {
  state: GameState;
  /** De acties tot hier, telkens met de toestand waarin ze gekozen werden. */
  path: { key: string; action: Action }[];
  score: number;
  /** Onthult deze zet iets nieuws (getrokken kaarten, een nieuwe winkelkaart)? Dan plant ze niet verder. */
  revealed: boolean;
}

/**
 * Het plan van de huidige beurt: per toestand de volgende actie. Omdat de engine voorspelbaar is,
 * komt de echte toestand na elke zet precies overeen met het plan, tot er iets nieuws onthuld wordt.
 */
const plans = new Map<AiLevel, Map<string, Action>>();

function plannedAction(state: GameState, level: AiLevel, profile: Profile, rnd: () => number): Action {
  const key = stateKey(state);
  const planned = plans.get(level)?.get(key);
  if (planned) return planned;
  const best = searchTurn(state, profile, rnd);
  plans.set(level, new Map(best.path.map((p) => [p.key, p.action])));
  return best.path[0].action;
}

/** Beam search over volgordes van de hand, tot de hand leeg is of een zet iets nieuws onthult. */
function searchTurn(state: GameState, profile: Profile, rnd: () => number): Node {
  const pid = state.active;
  let frontier: Node[] = [{ state, path: [], score: evaluate(state, pid, profile), revealed: false }];
  const finished: Node[] = [];
  while (frontier.length) {
    const next = new Map<string, Node>();
    for (const node of frontier) {
      const children = expand(node, pid, profile);
      if (!children.length) finished.push(node);
      for (const child of children) {
        // Dezelfde stand via een andere volgorde: alleen de beste houden.
        if (child.revealed) finished.push(child);
        else {
          const k = stateKey(child.state);
          if ((next.get(k)?.score ?? -Infinity) < child.score) next.set(k, child);
        }
      }
    }
    frontier = [...next.values()].sort((a, b) => b.score - a.score).slice(0, profile.beam);
  }
  const candidates = finished.filter((n) => n.path.length).sort((a, b) => b.score - a.score);
  if (!profile.rollouts) return candidates[0];
  // Speel de beste kandidaten verder na, met de beurt van de tegenstander erbij.
  // Elke kandidaat krijgt dezelfde trekkingen, zodat geluk de vergelijking niet verstoort.
  const seeds = Array.from({ length: profile.rollouts }, () => Math.floor(rnd() * 2 ** 31));
  let best = candidates[0];
  let bestScore = -Infinity;
  for (const node of candidates.slice(0, profile.candidates)) {
    let total = 0;
    for (const seed of seeds) total += rollout(node.state, pid, profile, seededRandom(seed));
    if (total / profile.rollouts > bestScore) {
      bestScore = total / profile.rollouts;
      best = node;
    }
  }
  return best;
}

function expand(node: Node, pid: PlayerId, profile: Profile): Node[] {
  const s = node.state;
  if (!s.players[pid].hand.length || s.winner !== null) return [];
  const actions = playActions(s, pid);
  if (profile.recall) actions.push(...recallActions(s, pid));
  const key = stateKey(s);
  const children: Node[] = [];
  for (const action of actions) {
    const r = applyAction(s, action);
    if (!r.ok) continue;
    children.push({
      state: r.state,
      path: [...node.path, { key, action }],
      score: evaluate(r.state, pid, profile),
      revealed: reveals(s, r.state, pid),
    });
  }
  return children;
}

/** Heeft de zet kaarten getrokken, de winkel of een zone-effect veranderd? Wat daarna komt, weet een speler nog niet. */
function reveals(before: GameState, after: GameState, pid: PlayerId): boolean {
  if (after.players[pid].deck.length !== before.players[pid].deck.length) return true;
  if (after.zones.some((z, i) => z.effect !== before.zones[i].effect)) return true;
  const market = (g: GameState) => g.shop.market.map((c) => c.uid).join();
  return market(before) !== market(after);
}

/**
 * Speelt de rest van haar beurt en de volgende beurt van de tegenstander na, met de verborgen kaarten
 * willekeurig verdeeld. Geeft terug hoe goed ze er daarna voor staat.
 */
function rollout(state: GameState, pid: PlayerId, profile: Profile, rnd: () => number): number {
  let s = determinize(state, pid, rnd);
  // Zoveel rondes ver: telkens haar eigen beurt en dan die van de tegenstander.
  for (let i = 0; i < 400 && s.winner === null && s.turn < state.turn + 2 * profile.horizon; i++) {
    // Zij speelt snel verder (ROLLOUT_SELF); de tegenstander volgens `opponentModel`.
    const r = applyAction(s, s.active === pid ? decide(s, ROLLOUT_SELF, 'normaal', rnd) : chooseAction(s, profile.opponentModel, rnd));
    if (!r.ok) break;
    s = r.state;
  }
  return evaluate(s, pid, profile);
}

/**
 * Een kopie waarin alles wat de computer niet kan weten, willekeurig verdeeld is: de volgorde van
 * haar eigen stapel, de hand en stapel van de tegenstander en de winkelvoorraad.
 * Eerst sorteren, zodat het resultaat niet afhangt van de echte (geheime) volgorde.
 */
function determinize(state: GameState, pid: PlayerId, rnd: () => number): GameState {
  const s = structuredClone(state);
  const me = s.players[pid];
  const opp = s.players[other(pid)];
  shuffled(me.deck, rnd);
  const pool = shuffled([...opp.hand, ...opp.deck], rnd);
  opp.hand = pool.slice(0, opp.hand.length);
  opp.deck = pool.slice(opp.hand.length);
  shuffled(s.shop.pile, rnd);
  s.seed = Math.floor(rnd() * 2 ** 31);
  return s;
}

/** Mulberry32, zoals in de engine: dezelfde seed geeft dezelfde reeks. */
function seededRandom(seed: number): () => number {
  return () => {
    let t = (seed = (seed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(cards: CardInstance[], rnd: () => number): CardInstance[] {
  cards.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/** Een sleutel voor een stand. Het logboek telt niet mee: dat hangt af van de volgorde, niet van de stand. */
function stateKey(state: GameState): string {
  return JSON.stringify({ ...state, log: null });
}

// ---------- Beoordeling ----------

/** Hoe goed is deze toestand voor `pid`? Hoger is beter. */
function evaluate(s: GameState, pid: PlayerId, profile: Profile): number {
  const opp = other(pid);
  if (s.winner === pid) return 1e6;
  if (s.winner === opp) return -1e6;
  const me = s.players[pid];
  const threat = profile.threatWeight;
  let score = 0;

  for (const z of s.zones) {
    if (z.owner === pid) score += 60;
    else if (z.owner === opp) score -= 60;
    else {
      // Schade telt zwaarder naarmate de zone bijna veroverd is.
      // Omgerekend naar een zone met gewone levens, zodat 6 van 8 even zwaar weegt als 7,5 van 10.
      const mine = (z.damage[pid] * ZONE_HP) / z.hp;
      const theirs = (z.damage[opp] * ZONE_HP) / z.hp;
      // Een goudader levert elke beurt goud op voor wie er voorstaat.
      const gold = zoneEffect(z)?.goldIfLeading ?? 0;
      if (gold) score += Math.sign(mine - theirs) * gold * 1.2;
      score += 1.3 * mine + (mine * mine) / ZONE_HP;
      score -= threat * (1.3 * theirs + (theirs * theirs) / ZONE_HP);
      score += z.shield[pid] * (theirs > 0 ? 0.8 * threat : 0.4);
      score -= z.shield[opp] * 0.6;
    }
    // Een kaart in een zone doet niet meer mee in je stapel en neemt een van de 4 plaatsen in.
    // Een Vloek is daar uit je stapel, maar houdt een plaats bezet.
    for (const c of z.cards) if (c.player === pid) score += c.card.defId === 'vloek' ? CURSE_IN_ZONE : -(0.4 + cardWorth(c.card));
  }

  // Goud is veel waard tot je er een sterke kaart mee kunt kopen, daarna minder.
  // Is de winkel leeg, dan is goud niets meer waard: anders blijft ze afleggen voor goud in plaats van aan te vallen.
  if (s.shop.market.length) score += 1.1 * Math.min(me.gold, 8) + 0.3 * Math.max(0, me.gold - 8);
  // Extra kaarten in je hand (door Trek) speel je deze beurt nog.
  score += 1.2 * me.hand.length;
  score += 1.5 * s.players[opp].slow;
  // Kaarten in je stapel komen terug; verbannen kaarten niet. Startkaarten zijn weinig waard.
  for (const c of [...me.deck, ...me.discard, ...me.played, ...me.hand]) score += cardWorth(c);
  // Een Vloek in de stapel van de tegenstander is goed voor jou.
  const them = s.players[opp];
  for (const c of [...them.deck, ...them.discard, ...them.played, ...them.hand]) if (c.defId === 'vloek') score -= CURSE_WORTH;
  return score;
}

/** Een Vloek in je stapel kost je een plek in je hand. */
const CURSE_WORTH = -2;
const CURSE_IN_ZONE = -1;

function cardWorth(c: CardInstance): number {
  if (c.defId === 'vloek') return CURSE_WORTH;
  const price = getCard(c.defId).price;
  return price ? price * 0.35 : 0.1;
}
