import { describe, expect, it } from 'vitest';
import { chooseAction } from './ai';
import { applyAction, createGame } from './engine';
import type { GameState } from './types';

/** Laat de computer tegen zichzelf spelen tot er een winnaar is (of tot het maximum aantal acties). */
function playOut(s: GameState, maxActions = 5000): GameState {
  for (let i = 0; i < maxActions && s.winner === null; i++) {
    const r = applyAction(s, chooseAction(s));
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return s;
}

describe('computertegenstander', () => {
  it('kiest altijd een geldige actie en speelt een spel uit tot er een winnaar is', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const end = playOut(createGame(['A', 'B'], seed));
      expect(end.winner).not.toBeNull();
    }
  });

  it('speelt eerst haar hele hand voordat ze haar beurt eindigt', () => {
    const s = createGame(['A', 'B'], 9);
    expect(chooseAction(s).type).toBe('play');
  });
});
