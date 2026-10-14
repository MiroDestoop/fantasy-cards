import { describe, expect, it } from 'vitest';
import { getCard } from './cards';
import { applyAction, createGame } from './engine';
import { HAND_SIZE, MARKET_SIZE, MAX_HAND, MAX_ZONE_CARDS, ZONE_HP } from './rules';
import type { Action, GameState, PlayerId, PlayTarget } from './types';

let counter = 0;
function give(s: GameState, player: PlayerId, defId: string): string {
  const uid = `test-${++counter}`;
  s.players[player].hand.push({ uid, defId });
  return uid;
}

function act(s: GameState, action: Action): GameState {
  const r = applyAction(s, action);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

const DISCARD: PlayTarget = { kind: 'discard' };
const zone = (i: number): PlayTarget => ({ kind: 'zone', zone: i });

function play(s: GameState, defId: string, target: PlayTarget): GameState {
  return act(s, { type: 'play', handUid: give(s, s.active, defId), target });
}

describe('spelopzet', () => {
  it('geeft elke speler 10 kaarten; de eerste speler trekt er meteen 5', () => {
    const s = createGame(['Ana', 'Bo'], 1);
    expect(s.players[0].hand).toHaveLength(HAND_SIZE);
    expect(s.players[0].deck).toHaveLength(10 - HAND_SIZE);
    expect(s.players[1].deck).toHaveLength(10);
    expect(s.zones).toHaveLength(3);
    expect(s.shop.market).toHaveLength(MARKET_SIZE);
  });

  it('is reproduceerbaar met dezelfde seed', () => {
    expect(createGame(['A', 'B'], 7)).toEqual(createGame(['A', 'B'], 7));
  });
});

describe('kaarten spelen', () => {
  it('afleggen geeft het bovenste effect', () => {
    let s = createGame(['Ana', 'Bo'], 42);
    s = play(s, 'zilver', DISCARD);
    expect(s.players[0].gold).toBe(2);
    expect(s.players[0].discard.at(-1)?.defId).toBe('zilver');
    expect(s.zones.every((z) => z.damage[0] === 0)).toBe(true);
  });

  it('in een zone spelen geeft het onderste effect en legt de kaart daar', () => {
    let s = createGame(['Ana', 'Bo'], 42);
    s = play(s, 'rekruut', zone(1));
    expect(s.players[0].gold).toBe(0);
    expect(s.zones[1].damage).toEqual([1, 0]);
    expect(s.zones[1].cards.map((c) => c.card.defId)).toEqual(['rekruut']);
  });

  it('zonekaarten blijven liggen, ook over beurten heen', () => {
    let s = createGame(['Ana', 'Bo'], 42);
    s = play(s, 'rekruut', zone(0));
    for (let i = 0; i < 4; i++) s = act(s, { type: 'endTurn' });
    expect(s.zones[0].cards).toHaveLength(1);
  });

  it(`je mag maximaal ${MAX_ZONE_CARDS} kaarten per zone leggen`, () => {
    let s = createGame(['Ana', 'Bo'], 42);
    for (let i = 0; i < MAX_ZONE_CARDS; i++) s = play(s, 'zilver', zone(0));
    const r = applyAction(s, { type: 'play', handUid: give(s, 0, 'zilver'), target: zone(0) });
    expect(r.ok).toBe(false);
    // In een andere zone kan het nog wel.
    expect(applyAction(s, { type: 'play', handUid: give(s, 0, 'zilver'), target: zone(1) }).ok).toBe(true);
  });

  it('Vernietig verbant je eigen kaarten in de zone uit het spel', () => {
    let s = createGame(['Ana', 'Bo'], 42);
    for (let i = 0; i < MAX_ZONE_CARDS; i++) s = play(s, 'zilver', zone(0));
    s.zones[0].cards.push({ player: 1, card: { uid: 'bo-1', defId: 'rekruut' }, turn: 0 });
    const discardBefore = s.players[0].discard.length;
    s = play(s, 'offervuur', zone(0));
    expect(s.zones[0].cards.map((c) => c.card.defId).sort()).toEqual(['offervuur', 'rekruut']);
    expect(s.players[0].discard).toHaveLength(discardBefore);
    expect(s.zones[0].damage[0]).toBe(MAX_ZONE_CARDS + 3);
  });

  it('Terugroep haalt je oudste kaart in de zone terug naar je aflegstapel', () => {
    let s = createGame(['Ana', 'Bo'], 42);
    s = play(s, 'zilver', zone(0));
    const oldest = s.zones[0].cards[0].card.uid;
    s = play(s, 'schat', zone(0));
    s = play(s, 'rekruut', zone(0));
    expect(s.zones[0].cards.map((c) => c.card.defId)).toEqual(['schat', 'rekruut']);
    expect(s.players[0].discard.at(-1)?.uid).toBe(oldest);
  });

  it('Terugroep mag ook in een volle zone', () => {
    let s = createGame(['Ana', 'Bo'], 42);
    for (let i = 0; i < MAX_ZONE_CARDS; i++) s = play(s, 'zilver', zone(0));
    s = play(s, 'rekruut', zone(0));
    expect(s.zones[0].cards.filter((c) => c.player === 0)).toHaveLength(MAX_ZONE_CARDS);
  });

  it('Ververs vervangt de hele winkel', () => {
    let s = createGame(['Ana', 'Bo'], 42);
    const before = s.shop.market.map((c) => c.uid);
    const pileBefore = s.shop.pile.length;
    s = play(s, 'marskramer', DISCARD);
    expect(s.shop.market).toHaveLength(MARKET_SIZE);
    expect(s.shop.market.some((c) => before.includes(c.uid))).toBe(false);
    expect(s.shop.pile).toHaveLength(pileBefore);
    expect(s.shop.pile.slice(0, MARKET_SIZE).map((c) => c.uid)).toEqual(before);
  });

  it('kaarten zonder onderste effect kan je alleen afleggen', () => {
    const s = createGame(['Ana', 'Bo'], 42);
    expect(applyAction(s, { type: 'play', handUid: give(s, 0, 'koper'), target: zone(0) }).ok).toBe(false);
    expect(applyAction(s, { type: 'play', handUid: give(s, 0, 'koper'), target: DISCARD }).ok).toBe(true);
  });

  it('Storm raakt elke open zone', () => {
    let s = createGame(['Ana', 'Bo'], 42);
    s.zones[2].owner = 1;
    s = play(s, 'draak', DISCARD);
    expect(s.zones.map((z) => z.damage[0])).toEqual([3, 3, 0]);
  });

  it('Schild blokkeert schade van de tegenstander in die zone', () => {
    let s = createGame(['Ana', 'Bo'], 42);
    s = play(s, 'golem', zone(0));
    s = act(s, { type: 'endTurn' });
    s = play(s, 'vuurbal', zone(0));
    expect(s.zones[0].damage[1]).toBe(0);
    expect(s.zones[0].shield[0]).toBe(1);
  });

  it('Herstel haalt schade van de tegenstander weg', () => {
    let s = createGame(['Ana', 'Bo'], 42);
    s.zones[0].damage = [0, 6];
    s = play(s, 'bron', zone(0));
    expect(s.zones[0].damage[1]).toBe(2);
  });

  it('Vertraag laat de tegenstander minder trekken', () => {
    let s = createGame(['Ana', 'Bo'], 42);
    s = play(s, 'zandloper', DISCARD);
    s = act(s, { type: 'endTurn' });
    expect(s.players[1].hand).toHaveLength(HAND_SIZE - 2);
    expect(s.players[1].slow).toBe(0);
  });

  it('een veroverde zone is gesloten', () => {
    const s = createGame(['Ana', 'Bo'], 42);
    s.zones[0].owner = 1;
    const r = applyAction(s, { type: 'play', handUid: give(s, 0, 'rekruut'), target: zone(0) });
    expect(r.ok).toBe(false);
  });
});

describe('beurten en stapel', () => {
  it('legt je hand af aan het einde van je beurt en trekt er 5 nieuwe', () => {
    let s = createGame(['Ana', 'Bo'], 3);
    s = act(s, { type: 'endTurn' });
    expect(s.players[0].hand).toHaveLength(0);
    expect(s.players[0].discard).toHaveLength(HAND_SIZE);
    expect(s.players[1].hand).toHaveLength(HAND_SIZE);
  });

  it('schudt de aflegstapel als de stapel leeg is', () => {
    let s = createGame(['Ana', 'Bo'], 3);
    for (let i = 0; i < 4; i++) s = act(s, { type: 'endTurn' });
    // Ana zit nu aan haar derde beurt: 10 kaarten zijn al eens getrokken, dus er is geschud.
    const ana = s.players[0];
    expect(ana.hand).toHaveLength(HAND_SIZE);
    expect(ana.hand.length + ana.deck.length + ana.discard.length).toBe(10);
  });
});

describe('handlimiet', () => {
  it(`legt kaarten boven de limiet van ${MAX_HAND} meteen af`, () => {
    let s = createGame(['Ana', 'Bo'], 42);
    s.players[0].deck.push(...Array.from({ length: 6 }, (_, i) => ({ uid: `extra-${i}`, defId: 'koper' })));
    const discardBefore = s.players[0].discard.length;
    // Eerste Arcaan Inzicht: hand 5 → 8. Tweede: hand blijft 8, alle 3 getrokken kaarten passen niet meer.
    s = play(s, 'inzicht', DISCARD);
    expect(s.players[0].hand).toHaveLength(MAX_HAND);
    s = play(s, 'inzicht', DISCARD);
    expect(s.players[0].hand).toHaveLength(MAX_HAND);
    // 2 afgelegde Inzicht-kaarten + 3 getrokken kaarten die niet meer pasten.
    expect(s.players[0].discard).toHaveLength(discardBefore + 5);
  });
});

describe('winkel', () => {
  it('kost goud, legt de kaart op je aflegstapel en vult de markt op dezelfde plek aan', () => {
    let s = createGame(['Ana', 'Bo'], 42);
    s.players[0].gold = 20;
    const target = s.shop.market[2];
    const price = getCard(target.defId).price!;
    s = act(s, { type: 'buy', marketUid: target.uid });
    expect(s.players[0].gold).toBe(20 - price);
    expect(s.players[0].discard.at(-1)?.uid).toBe(target.uid);
    expect(s.shop.market).toHaveLength(MARKET_SIZE);
    expect(s.shop.market[2].uid).not.toBe(target.uid);
  });

  it('weigert te kopen zonder genoeg goud', () => {
    const s = createGame(['Ana', 'Bo'], 42);
    expect(applyAction(s, { type: 'buy', marketUid: s.shop.market[0].uid }).ok).toBe(false);
  });
});

describe('winnen', () => {
  it(`${ZONE_HP} schade verovert een zone, 2 zones winnen het spel`, () => {
    let s = createGame(['Ana', 'Bo'], 42);
    s.zones[0].damage = [ZONE_HP - 1, 0];
    s.zones[0].cards.push({ player: 1, card: { uid: 'bo-1', defId: 'rekruut' }, turn: 0 });
    s = play(s, 'zilver', zone(0));
    expect(s.zones[0].owner).toBe(0);
    expect(s.winner).toBeNull();
    // Bij een verovering blijven de kaarten in die zone liggen.
    expect(s.zones[0].cards.map((c) => c.card.defId).sort()).toEqual(['rekruut', 'zilver']);
    s.zones[1].damage = [ZONE_HP - 2, 5];
    s = play(s, 'vuurbal', zone(1));
    expect(s.winner).toBe(0);
  });
});
