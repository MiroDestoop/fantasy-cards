import { describe, expect, it } from 'vitest';
import { AI_LEVELS, chooseAction, type AiLevel } from './ai';
import { applyAction, createGame } from './engine';
import { MAX_ZONE_CARDS, ZONE_HP } from './rules';
import type { GameState } from './types';

/** Een vaste toevalsreeks, zodat de tests altijd hetzelfde uitkomen. */
function rng(seed: number): () => number {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

/** Laat twee computers tegen elkaar spelen tot er een winnaar is (of tot het maximum aantal acties). */
function playOut(s: GameState, levels: [AiLevel, AiLevel], seed = 1, maxActions = 5000): GameState {
  const rnd = rng(seed);
  for (let i = 0; i < maxActions && s.winner === null; i++) {
    const r = applyAction(s, chooseAction(s, levels[s.active], rnd));
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return s;
}

describe('computertegenstander', () => {
  it('kiest altijd een geldige actie en speelt een spel uit tot er een winnaar is', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      expect(playOut(createGame(['A', 'B'], seed), ['normaal', 'normaal']).winner).not.toBeNull();
    }
  });

  it('speelt eerst haar hele hand voordat ze haar beurt eindigt', () => {
    const s = createGame(['A', 'B'], 9, { plainZones: true });
    expect(chooseAction(s).type).toBe('play');
  });

  it.each(AI_LEVELS.map((l) => l.id))('niveau %s speelt een spel uit met enkel geldige acties', (level) => {
    expect(playOut(createGame(['A', 'B'], 11, { plainZones: true }), [level, 'normaal'], 3).winner).not.toBeNull();
  }, 120000);

  it('Moeilijk wint duidelijk vaker van Normaal', () => {
    let wins = 0;
    const games = 30;
    for (let g = 0; g < games; g++) {
      // Wissel de zitplaatsen af, zodat beginnen geen voordeel geeft.
      const hard = (g % 2) as 0 | 1;
      const levels: [AiLevel, AiLevel] = hard === 0 ? ['moeilijk', 'normaal'] : ['normaal', 'moeilijk'];
      if (playOut(createGame(['A', 'B'], 1000 + g), levels, g).winner === hard) wins++;
    }
    expect(wins / games).toBeGreaterThanOrEqual(0.6);
  }, 120000);

  it('Moeilijk trekt een kaart terug om met een volle zone toch te winnen', () => {
    const s = createGame(['A', 'B'], 42, { plainZones: true });
    const me = s.players[0];
    me.hand = [{ uid: 'trol', defId: 'trol' }];
    me.gold = 5;
    for (const zi of [0, 1]) {
      for (let i = 0; i < MAX_ZONE_CARDS; i++) s.zones[zi].cards.push({ player: 0, card: { uid: `z${zi}-${i}`, defId: 'zilver' }, turn: 1 });
    }
    s.zones[0].damage[0] = ZONE_HP - 2;
    s.zones[2].owner = 0;
    // Afleggen geeft maar 2 goud; terugtrekken en dan Trollenmoker (Aanval 2) in de Wachttoren wint het spel.
    expect(chooseAction(s, 'moeilijk').type).toBe('recall');
  });

  it('kijkt niet in verborgen kaarten: de volgorde van de stapels verandert haar keuze niet', () => {
    const s = createGame(['A', 'B'], 21, { plainZones: true });
    s.players[0].hand = [{ uid: 'u', defId: 'uil' }, { uid: 'v', defId: 'vuurbal' }, { uid: 'k', defId: 'koper' }];
    const mixed = structuredClone(s);
    mixed.players[0].deck.reverse();
    mixed.players[1].deck.reverse();
    mixed.shop.pile.reverse();
    expect(chooseAction(mixed, 'extreem', rng(5))).toEqual(chooseAction(s, 'extreem', rng(5)));
  }, 60000);
});
