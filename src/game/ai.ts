import { getCard } from './cards';
import { applyAction, other, whyCantBuy } from './engine';
import { ZONE_HP } from './rules';
import type { Action, CardInstance, GameState, PlayerId, PlayTarget } from './types';

/**
 * De computertegenstander. Ze kiest telkens één actie voor de speler die aan zet is:
 * eerst speelt ze haar hele hand, dan koopt ze kaarten en daarna eindigt ze haar beurt.
 * Voor elke kaart probeert ze elke bestemming uit op een kopie van het spel en kiest ze
 * de toestand die ze het best vindt (`evaluate`).
 */
export function chooseAction(state: GameState): Action {
  const pid = state.active;
  const hand = state.players[pid].hand;
  if (hand.length) return bestPlay(state, pid, hand);
  const buy = bestBuy(state);
  if (buy) return { type: 'buy', marketUid: buy.uid };
  return { type: 'endTurn' };
}

function bestPlay(state: GameState, pid: PlayerId, hand: CardInstance[]): Action {
  const targets: PlayTarget[] = [{ kind: 'discard' }, ...state.zones.map((_, zone) => ({ kind: 'zone' as const, zone }))];
  let best: Action = { type: 'play', handUid: hand[0].uid, target: { kind: 'discard' } };
  let bestScore = -Infinity;
  const tried = new Set<string>();
  for (const card of hand) {
    // Twee dezelfde kaarten geven dezelfde uitkomst; één keer proberen volstaat.
    if (tried.has(card.defId)) continue;
    tried.add(card.defId);
    for (const target of targets) {
      const action: Action = { type: 'play', handUid: card.uid, target };
      const r = applyAction(state, action);
      if (!r.ok) continue;
      const score = evaluate(r.state, pid);
      if (score > bestScore) {
        bestScore = score;
        best = action;
      }
    }
  }
  return best;
}

/** Koopt de duurste betaalbare kaart; goedkope kaarten (onder 3 goud) laat ze liggen. */
function bestBuy(state: GameState): CardInstance | null {
  let best: CardInstance | null = null;
  let bestRating = 0;
  for (const card of state.shop.market) {
    if (whyCantBuy(state, card.uid)) continue;
    const def = getCard(card.defId);
    const price = def.price ?? 0;
    if (price < 3) continue;
    // Bij gelijke prijs liever een kaart die schade doet.
    const rating = price + (def.bottom.some((e) => e.kw === 'aanval') ? 0.5 : 0);
    if (rating > bestRating) {
      bestRating = rating;
      best = card;
    }
  }
  return best;
}

/** Hoe goed is deze toestand voor `pid`? Hoger is beter. */
function evaluate(s: GameState, pid: PlayerId): number {
  const opp = other(pid);
  if (s.winner === pid) return 1e6;
  if (s.winner === opp) return -1e6;
  const me = s.players[pid];
  let score = 0;

  for (const z of s.zones) {
    if (z.owner === pid) score += 60;
    else if (z.owner === opp) score -= 60;
    else {
      // Schade telt zwaarder naarmate de zone bijna veroverd is.
      const mine = z.damage[pid];
      const theirs = z.damage[opp];
      score += 1.3 * mine + (mine * mine) / ZONE_HP;
      score -= 1.3 * theirs + (theirs * theirs) / ZONE_HP;
      score += z.shield[pid] * (theirs > 0 ? 0.8 : 0.4);
      score -= z.shield[opp] * 0.6;
    }
    // Een kaart in een zone doet niet meer mee in je stapel en neemt een van de 4 plaatsen in.
    for (const c of z.cards) if (c.player === pid) score -= 0.4 + cardWorth(c.card);
  }

  // Goud is veel waard tot je er een sterke kaart mee kunt kopen, daarna minder.
  score += 1.1 * Math.min(me.gold, 8) + 0.3 * Math.max(0, me.gold - 8);
  // Extra kaarten in je hand (door Trek) speel je deze beurt nog.
  score += 1.2 * me.hand.length;
  score += 1.5 * s.players[opp].slow;
  // Kaarten in je stapel komen terug; verbannen kaarten niet. Startkaarten zijn weinig waard.
  for (const c of [...me.deck, ...me.discard, ...me.played, ...me.hand]) score += cardWorth(c);
  return score;
}

function cardWorth(c: CardInstance): number {
  const price = getCard(c.defId).price;
  return price ? price * 0.35 : 0.1;
}
