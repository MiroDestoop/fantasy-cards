import { describe, expect, it } from 'vitest';
import { getCard, SHOP_SUPPLY } from './cards';
import { getSpecial } from './specials';
import { applyAction, createGame, recallPrice, shopPrice } from './engine';
import { FIRST_HAND_SIZE, HAND_SIZE, MARKET_SIZE, MAX_HAND, MAX_ZONE_CARDS, RECALL_PRICE, ZONE_HP } from './rules';
import type { Action, GameState, PlayerId, PlayTarget } from './types';
import { makeZone, type ZoneEffectId } from './zones';

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
  it('geeft elke speler 10 kaarten; de eerste speler trekt er meteen 3', () => {
    const s = createGame(['Ana', 'Bo'], 1, { plainZones: true });
    expect(s.players[0].hand).toHaveLength(FIRST_HAND_SIZE);
    expect(s.players[0].deck).toHaveLength(10 - FIRST_HAND_SIZE);
    expect(s.players[1].deck).toHaveLength(10);
    expect(s.zones).toHaveLength(3);
    expect(s.shop.market).toHaveLength(MARKET_SIZE);
  });

  it('laat de gekozen speler beginnen, met een kortere eerste hand', () => {
    const s = createGame(['Ana', 'Bo'], 1, { starter: 1, plainZones: true });
    expect(s.active).toBe(1);
    expect(s.players[1].hand).toHaveLength(FIRST_HAND_SIZE);
    expect(s.players[0].hand).toHaveLength(0);
    const next = act(s, { type: 'endTurn' });
    expect(next.players[0].hand).toHaveLength(HAND_SIZE);
  });

  it('is reproduceerbaar met dezelfde seed', () => {
    expect(createGame(['A', 'B'], 7, { plainZones: true })).toEqual(createGame(['A', 'B'], 7, { plainZones: true }));
  });
});

describe('kaarten spelen', () => {
  it('afleggen geeft het bovenste effect', () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    s = play(s, 'zilver', DISCARD);
    expect(s.players[0].gold).toBe(2);
    expect(s.players[0].played.at(-1)?.defId).toBe('zilver');
    expect(s.zones.every((z) => z.damage[0] === 0)).toBe(true);
  });

  it('in een zone spelen geeft het onderste effect en legt de kaart daar', () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    s = play(s, 'rekruut', zone(1));
    expect(s.players[0].gold).toBe(0);
    expect(s.zones[1].damage).toEqual([1, 0]);
    expect(s.zones[1].cards.map((c) => c.card.defId)).toEqual(['rekruut']);
  });

  it('zonekaarten blijven liggen, ook over beurten heen', () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    s = play(s, 'rekruut', zone(0));
    for (let i = 0; i < 4; i++) s = act(s, { type: 'endTurn' });
    expect(s.zones[0].cards).toHaveLength(1);
  });

  it(`je mag maximaal ${MAX_ZONE_CARDS} kaarten per zone leggen`, () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    for (let i = 0; i < MAX_ZONE_CARDS; i++) s = play(s, 'zilver', zone(0));
    const r = applyAction(s, { type: 'play', handUid: give(s, 0, 'zilver'), target: zone(0) });
    expect(r.ok).toBe(false);
    // In een andere zone kan het nog wel.
    expect(applyAction(s, { type: 'play', handUid: give(s, 0, 'zilver'), target: zone(1) }).ok).toBe(true);
  });

  it('Vernietig verbant je andere kaarten in de zone uit het spel', () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    for (let i = 0; i < MAX_ZONE_CARDS - 1; i++) s = play(s, 'zilver', zone(0));
    s.zones[0].cards.push({ player: 1, card: { uid: 'bo-1', defId: 'rekruut' }, turn: 0 });
    const discardBefore = s.players[0].discard.length;
    s = play(s, 'offervuur', zone(0));
    expect(s.zones[0].cards.map((c) => c.card.defId).sort()).toEqual(['offervuur', 'rekruut']);
    expect(s.players[0].discard).toHaveLength(discardBefore);
    expect(s.zones[0].damage[0]).toBe(MAX_ZONE_CARDS - 1 + 3);
  });

  it('Terugroep haalt je oudste kaart in de zone terug naar je aflegstapel', () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    s = play(s, 'zilver', zone(0));
    const oldest = s.zones[0].cards[0].card.uid;
    s = play(s, 'schat', zone(0));
    s = play(s, 'rekruut', zone(0));
    expect(s.zones[0].cards.map((c) => c.card.defId)).toEqual(['schat', 'rekruut']);
    expect(s.players[0].discard.at(-1)?.uid).toBe(oldest);
  });

  it('Terugroep laat de gespeelde kaart zelf liggen, ook in een lege zone', () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    s = play(s, 'rekruut', zone(0));
    expect(s.zones[0].cards.map((c) => c.card.defId)).toEqual(['rekruut']);
  });

  it('Terugroep en Vernietig mag je niet als vijfde kaart in een volle zone spelen', () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    for (let i = 0; i < MAX_ZONE_CARDS; i++) s = play(s, 'zilver', zone(0));
    for (const defId of ['rekruut', 'offervuur']) {
      const r = applyAction(s, { type: 'play', handUid: give(s, 0, defId), target: zone(0) });
      expect(r.ok).toBe(false);
    }
  });
});

describe('terugtrekken', () => {
  const fullZone = () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    for (let i = 0; i < MAX_ZONE_CARDS; i++) s = play(s, 'zilver', zone(0));
    return s;
  };

  it(`kost eerst ${RECALL_PRICE} goud en legt de gekozen kaart op je aflegstapel`, () => {
    let s = fullZone();
    s.players[0].gold = 10;
    const pick = s.zones[0].cards[2].card.uid;
    s = act(s, { type: 'recall', zone: 0, cardUid: pick });
    expect(s.players[0].gold).toBe(10 - RECALL_PRICE);
    expect(s.zones[0].cards.some((c) => c.card.uid === pick)).toBe(false);
    expect(s.players[0].discard.at(-1)?.uid).toBe(pick);
  });

  it('wordt elke keer 1 goud duurder, ook in latere beurten', () => {
    let s = fullZone();
    s.players[0].gold = 20;
    s = act(s, { type: 'recall', zone: 0, cardUid: s.zones[0].cards[0].card.uid });
    s = act(s, { type: 'recall', zone: 0, cardUid: s.zones[0].cards[0].card.uid });
    expect(s.players[0].gold).toBe(20 - RECALL_PRICE - (RECALL_PRICE + 1));
    s = act(s, { type: 'endTurn' });
    s = act(s, { type: 'endTurn' });
    expect(recallPrice(s, 0)).toBe(RECALL_PRICE + 2);
    expect(recallPrice(s, 1)).toBe(RECALL_PRICE);
  });

  it('weigert zonder genoeg goud, met kaarten van de tegenstander en in een veroverde zone', () => {
    const s = fullZone();
    const mine = s.zones[0].cards[0].card.uid;
    s.players[0].gold = RECALL_PRICE - 1;
    expect(applyAction(s, { type: 'recall', zone: 0, cardUid: mine }).ok).toBe(false);
    s.players[0].gold = 10;
    s.zones[0].cards.push({ player: 1, card: { uid: 'bo-1', defId: 'rekruut' }, turn: 0 });
    expect(applyAction(s, { type: 'recall', zone: 0, cardUid: 'bo-1' }).ok).toBe(false);
    s.zones[0].owner = 1;
    expect(applyAction(s, { type: 'recall', zone: 0, cardUid: mine }).ok).toBe(false);
  });

  it('Ververs vervangt de hele winkel', () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    const before = s.shop.market.map((c) => c.uid);
    const pileBefore = s.shop.pile.length;
    s = play(s, 'marskramer', DISCARD);
    expect(s.shop.market).toHaveLength(MARKET_SIZE);
    expect(s.shop.market.some((c) => before.includes(c.uid))).toBe(false);
    expect(s.shop.pile).toHaveLength(pileBefore);
    expect(s.shop.pile.slice(0, MARKET_SIZE).map((c) => c.uid)).toEqual(before);
  });

  it('kaarten zonder onderste effect kan je alleen afleggen', () => {
    const s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    expect(applyAction(s, { type: 'play', handUid: give(s, 0, 'koper'), target: zone(0) }).ok).toBe(false);
    expect(applyAction(s, { type: 'play', handUid: give(s, 0, 'koper'), target: DISCARD }).ok).toBe(true);
  });

  it('Storm raakt elke open zone', () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    s.zones[2].owner = 1;
    s = play(s, 'draak', DISCARD);
    expect(s.zones.map((z) => z.damage[0])).toEqual([3, 3, 0]);
  });

  it('Schild blokkeert schade van de tegenstander in die zone', () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    s = play(s, 'golem', zone(0));
    s = act(s, { type: 'endTurn' });
    s = play(s, 'vuurbal', zone(0));
    expect(s.zones[0].damage[1]).toBe(0);
    expect(s.zones[0].shield[0]).toBe(1);
  });

  it('Herstel haalt schade van de tegenstander weg', () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    s.zones[0].damage = [0, 6];
    s = play(s, 'bron', zone(0));
    expect(s.zones[0].damage[1]).toBe(2);
  });

  it('Vertraag laat de tegenstander minder trekken', () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    s = play(s, 'zandloper', DISCARD);
    s = act(s, { type: 'endTurn' });
    expect(s.players[1].hand).toHaveLength(HAND_SIZE - 2);
    expect(s.players[1].slow).toBe(0);
  });

  it('een veroverde zone is gesloten', () => {
    const s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    s.zones[0].owner = 1;
    const r = applyAction(s, { type: 'play', handUid: give(s, 0, 'rekruut'), target: zone(0) });
    expect(r.ok).toBe(false);
  });
});

describe('beurten en stapel', () => {
  it('legt je hand af aan het einde van je beurt en trekt er 5 nieuwe', () => {
    let s = createGame(['Ana', 'Bo'], 3, { plainZones: true });
    s = act(s, { type: 'endTurn' });
    expect(s.players[0].hand).toHaveLength(0);
    expect(s.players[0].discard).toHaveLength(FIRST_HAND_SIZE);
    // Alleen de allereerste beurt is korter: de tweede speler trekt er gewoon 5.
    expect(s.players[1].hand).toHaveLength(HAND_SIZE);
  });

  it('schudt de aflegstapel als de stapel leeg is', () => {
    let s = createGame(['Ana', 'Bo'], 3, { plainZones: true });
    for (let i = 0; i < 4; i++) s = act(s, { type: 'endTurn' });
    // Ana zit nu aan haar derde beurt: 10 kaarten zijn al eens getrokken, dus er is geschud.
    const ana = s.players[0];
    expect(ana.hand).toHaveLength(HAND_SIZE);
    expect(ana.hand.length + ana.deck.length + ana.discard.length).toBe(10);
  });

  it('gespeelde kaarten gaan pas bij Einde beurt naar je aflegstapel', () => {
    let s = createGame(['Ana', 'Bo'], 3, { plainZones: true });
    s = play(s, 'zilver', DISCARD);
    expect(s.players[0].played).toHaveLength(1);
    const discardBefore = s.players[0].discard.length;
    s = act(s, { type: 'endTurn' });
    expect(s.players[0].played).toHaveLength(0);
    expect(s.players[0].discard).toHaveLength(discardBefore + 1 + FIRST_HAND_SIZE);
  });

  it('een kleine stapel met Trek geeft geen oneindige lus meer', () => {
    // Alleen Drakenschat en Arcaan Inzicht: vroeger trok Inzicht ze allebei opnieuw, eindeloos.
    let s = createGame(['Ana', 'Bo'], 3, { plainZones: true });
    const ana = s.players[0];
    ana.deck = [];
    ana.discard = [];
    ana.hand = [{ uid: 'schat', defId: 'schat' }, { uid: 'inzicht', defId: 'inzicht' }];
    s = act(s, { type: 'play', handUid: 'schat', target: DISCARD });
    s = act(s, { type: 'play', handUid: 'inzicht', target: DISCARD });
    expect(s.players[0].hand).toHaveLength(0);
    expect(s.players[0].gold).toBe(4);
    // Volgende beurt zijn ze er gewoon weer.
    s = act(s, { type: 'endTurn' });
    s = act(s, { type: 'endTurn' });
    expect(s.players[0].hand.map((c) => c.uid).sort()).toEqual(['inzicht', 'schat']);
  });
});

describe('alles afleggen', () => {
  it('speelt elke kaart in je hand af voor het bovenste effect', () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    s.players[0].hand = [
      { uid: 'a', defId: 'koper' },
      { uid: 'b', defId: 'zilver' },
      { uid: 'c', defId: 'rekruut' },
    ];
    s = act(s, { type: 'discardAll' });
    expect(s.players[0].gold).toBe(4);
    expect(s.players[0].hand).toHaveLength(0);
    expect(s.players[0].played.map((c) => c.uid)).toEqual(['a', 'b', 'c']);
    expect(s.zones.every((z) => z.cards.length === 0)).toBe(true);
  });

  it('laat kaarten die onderweg getrokken worden in je hand', () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    s.players[0].hand = [{ uid: 'a', defId: 'inzicht' }];
    s = act(s, { type: 'discardAll' });
    expect(s.players[0].hand).toHaveLength(3);
  });

  it('weigert met een lege hand', () => {
    const s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    s.players[0].hand = [];
    expect(applyAction(s, { type: 'discardAll' }).ok).toBe(false);
  });
});

describe('handlimiet', () => {
  it(`legt kaarten boven de limiet van ${MAX_HAND} meteen af`, () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    s.players[0].hand.push(...Array.from({ length: HAND_SIZE - FIRST_HAND_SIZE }, (_, i) => ({ uid: `vul-${i}`, defId: 'koper' })));
    s.players[0].deck.push(...Array.from({ length: 6 }, (_, i) => ({ uid: `extra-${i}`, defId: 'koper' })));
    const discardBefore = s.players[0].discard.length;
    // Eerste Arcaan Inzicht: hand 5 → 8. Tweede: hand blijft 8, alle 3 getrokken kaarten passen niet meer.
    s = play(s, 'inzicht', DISCARD);
    expect(s.players[0].hand).toHaveLength(MAX_HAND);
    s = play(s, 'inzicht', DISCARD);
    expect(s.players[0].hand).toHaveLength(MAX_HAND);
    // De 3 getrokken kaarten die niet meer pasten; de 2 Inzicht-kaarten liggen bij de gespeelde kaarten.
    expect(s.players[0].discard).toHaveLength(discardBefore + 3);
    expect(s.players[0].played).toHaveLength(2);
  });
});

describe('winkel', () => {
  it('kost goud, legt de kaart op je aflegstapel en vult de markt op dezelfde plek aan', () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
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
    const s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    expect(applyAction(s, { type: 'buy', marketUid: s.shop.market[0].uid }).ok).toBe(false);
  });
});

describe('winnen', () => {
  it(`${ZONE_HP} schade verovert een zone, 2 zones winnen het spel`, () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
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

describe('speciale effecten', () => {
  it('Alchemist verdubbelt je goud, met een maximum van +6', () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    s.players[0].gold = 3;
    s = play(s, 'alchemist', DISCARD);
    expect(s.players[0].gold).toBe(6);
    s.players[0].gold = 8;
    s = play(s, 'alchemist', DISCARD);
    expect(s.players[0].gold).toBe(14);
  });

  it('Wrekende Geest doet 1 schade per kaart van de tegenstander in de zone', () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    for (let i = 0; i < 3; i++) s.zones[1].cards.push({ player: 1, card: { uid: `bo-${i}`, defId: 'zilver' }, turn: 0 });
    s = play(s, 'geest', zone(1));
    expect(s.zones[1].damage[0]).toBe(3);
  });

  it('elke kaart met een speciaal effect verwijst naar een bestaand effect', () => {
    for (const id of [...new Set(SHOP_SUPPLY)]) {
      for (const e of [...getCard(id).top, ...getCard(id).bottom]) {
        if (e.kw === 'speciaal') expect(() => getSpecial(e.id)).not.toThrow();
      }
    }
  });
});

describe('bonusgoud', () => {
  it('geeft een speler met bonus elke beurt extra goud, de andere niet', () => {
    let s = createGame(['Ana', 'Computer'], 42, { bonusGold: [0, 1] });
    expect(s.players[0].gold).toBe(0);
    s = act(s, { type: 'endTurn' });
    expect(s.players[1].gold).toBe(1);
    s = act(s, { type: 'endTurn' });
    s = act(s, { type: 'endTurn' });
    expect(s.players[1].gold).toBe(2);
    expect(s.players[0].gold).toBe(0);
  });
});

describe('zones', () => {
  it('krijgen elk spel willekeurige namen, elk met een ander effect', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const s = createGame(['Ana', 'Bo'], seed);
      expect(s.zones).toHaveLength(3);
      expect(new Set(s.zones.map((z) => z.effect)).size).toBe(3);
      for (const z of s.zones) seen.add(z.effect!);
      expect(new Set(s.zones.map((z) => z.name)).size).toBe(3);
      for (const z of s.zones) seen.add(z.name);
    }
    expect(seen.size).toBeGreaterThan(10);
    expect(createGame(['Ana', 'Bo'], 5).zones).toEqual(createGame(['Ana', 'Bo'], 5).zones);
  });

  const withEffect = (effect: ZoneEffectId) => {
    const s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    s.zones[0] = { ...makeZone({ name: 'Testzone', icon: '🧪' }, effect), cards: [] };
    return s;
  };

  it('Vesting en Bouwval veranderen de levens van een zone', () => {
    expect(withEffect('vesting').zones[0].hp).toBe(ZONE_HP + 2);
    let s = withEffect('bouwval');
    expect(s.zones[0].hp).toBe(ZONE_HP - 2);
    s.zones[0].damage = [ZONE_HP - 3, 0];
    s = play(s, 'zilver', zone(0));
    expect(s.zones[0].owner).toBe(0);
  });

  it('Slagveld heeft 16 levens en Dichte mist 8', () => {
    expect(withEffect('slagveld').zones[0].hp).toBe(16);
    expect(withEffect('mist').zones[0].hp).toBe(8);
  });

  it('Slagveld geeft elke aanval 1 schade meer, ook Storm', () => {
    let s = play(withEffect('slagveld'), 'zilver', zone(0));
    expect(s.zones[0].damage[0]).toBe(2);
    s = play(s, 'vuurbal', DISCARD);
    expect(s.zones[0].damage[0]).toBe(4);
    expect(s.zones[1].damage[0]).toBe(1);
  });

  it('Dichte mist geeft elke aanval 1 schade minder', () => {
    let s = play(withEffect('mist'), 'trol', zone(0));
    expect(s.zones[0].damage[0]).toBe(4);
    s = play(s, 'zilver', zone(0));
    expect(s.zones[0].damage[0]).toBe(4);
  });

  it('Schatkamer geeft 1 goud per kaart die je er speelt', () => {
    const s = play(withEffect('schatkamer'), 'rekruut', zone(0));
    expect(s.players[0].gold).toBe(1);
  });

  it('Tolpoort kost 1 goud per kaart, en zonder goud kan het niet', () => {
    const s = withEffect('tolpoort');
    s.players[0].gold = 0;
    expect(applyAction(s, { type: 'play', handUid: give(s, 0, 'zilver'), target: zone(0) }).ok).toBe(false);
    s.players[0].gold = 2;
    const after = play(s, 'zilver', zone(0));
    expect(after.players[0].gold).toBe(1);
    expect(after.zones[0].damage[0]).toBe(1);
  });

  it('Bibliotheek laat je 1 kaart trekken', () => {
    const s = withEffect('bibliotheek');
    const hand = s.players[0].hand.length;
    // play() geeft eerst een Zilveren Munt in je hand; die gaat naar de zone en er komt 1 kaart bij.
    const after = play(s, 'zilver', zone(0));
    expect(after.players[0].hand).toHaveLength(hand + 1);
    expect(after.players[0].deck).toHaveLength(s.players[0].deck.length - 1);
  });

  it('Zware tocht geeft Vertraag 1 op jezelf', () => {
    let s = play(withEffect('zwaretocht'), 'zilver', zone(0));
    s = play(s, 'zilver', zone(0));
    expect(s.players[0].slow).toBe(2);
    s = act(s, { type: 'endTurn' });
    s = act(s, { type: 'endTurn' });
    expect(s.players[0].hand).toHaveLength(HAND_SIZE - 2);
  });

  it('Heilige bron wist aan het begin van je beurt 1 schade van je tegenstander uit', () => {
    let s = withEffect('bron');
    s.zones[0].damage = [4, 3];
    s = act(s, { type: 'endTurn' });
    // Bo is aan zet: Ana's schade zakt.
    expect(s.zones[0].damage).toEqual([3, 3]);
    s = act(s, { type: 'endTurn' });
    expect(s.zones[0].damage).toEqual([3, 2]);
  });

  it('Handelspost geeft 1 goud korting in de winkel als je er voorstaat', () => {
    let s = withEffect('handelspost');
    const card = s.shop.market[0];
    const price = getCard(card.defId).price!;
    expect(shopPrice(s, 0, card.defId)).toBe(price);
    s.zones[0].damage = [2, 1];
    expect(shopPrice(s, 0, card.defId)).toBe(Math.max(1, price - 1));
    expect(shopPrice(s, 1, card.defId)).toBe(price);
    s.players[0].gold = price - 1;
    s = act(s, { type: 'buy', marketUid: card.uid });
    expect(s.players[0].gold).toBe(price - 1 - Math.max(1, price - 1));
  });

  it('Smalle pas heeft maar 3 plaatsen per speler', () => {
    let s = withEffect('smallepas');
    for (let i = 0; i < 3; i++) s = play(s, 'zilver', zone(0));
    const r = applyAction(s, { type: 'play', handUid: give(s, 0, 'zilver'), target: zone(0) });
    expect(r.ok).toBe(false);
  });

  it('Goudader geeft 1 goud aan het begin van je beurt als je er voorstaat', () => {
    let s = withEffect('goudader');
    s.zones[0].damage = [3, 1];
    s.zones[1].damage = [0, 5];
    const gold = s.players[0].gold;
    s = act(s, { type: 'endTurn' });
    expect(s.players[1].gold).toBe(0);
    s = act(s, { type: 'endTurn' });
    expect(s.players[0].gold).toBe(gold + 1);
  });
});

describe('Goblin', () => {
  it('steelt in een zone al het goud van de tegenstander', () => {
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    s.players[0].gold = 1;
    s.players[1].gold = 7;
    s = play(s, 'goblin', zone(0));
    expect(s.players[0].gold).toBe(8);
    expect(s.players[1].gold).toBe(0);
    expect(s.zones[0].cards.some((c) => c.card.defId === 'goblin')).toBe(true);
  });

  it('is goedkoop en geeft afgelegd 1 goud', () => {
    expect(getCard('goblin').price).toBeLessThanOrEqual(2);
    let s = createGame(['Ana', 'Bo'], 42, { plainZones: true });
    s.players[1].gold = 5;
    s = play(s, 'goblin', DISCARD);
    expect(s.players[0].gold).toBe(1);
    expect(s.players[1].gold).toBe(5);
  });
});

describe('Huurling, Belegeringsram en Fenix', () => {
  const fresh = () => createGame(['Ana', 'Bo'], 42, { plainZones: true });

  it('Huurling doet 4 schade en gaat aan het einde van je beurt terug naar de winkelvoorraad', () => {
    let s = play(fresh(), 'huurling', zone(0));
    expect(s.zones[0].damage[0]).toBe(4);
    const uid = s.zones[0].cards.find((c) => c.card.defId === 'huurling')!.card.uid;
    s = act(s, { type: 'endTurn' });
    expect(s.zones[0].cards.some((c) => c.card.uid === uid)).toBe(false);
    expect(s.shop.pile[0].uid).toBe(uid);
    const ana = s.players[0];
    expect([...ana.deck, ...ana.discard, ...ana.hand].some((c) => c.uid === uid)).toBe(false);
  });

  it('Huurling vertrekt pas aan het einde van de beurt van wie ze speelde', () => {
    let s = play(fresh(), 'huurling', zone(0));
    s = act(s, { type: 'endTurn' });
    s = play(s, 'huurling', zone(1));
    expect(s.zones[1].cards).toHaveLength(1);
  });

  it('Belegeringsram doet 2 schade, en 3 meer als de tegenstander hier een Schild heeft', () => {
    let s = play(fresh(), 'ram', zone(0));
    expect(s.zones[0].damage[0]).toBe(2);
    s = fresh();
    s.zones[0].shield[1] = 2;
    s = play(s, 'ram', zone(0));
    // 3 + 2 = 5 schade, waarvan het schild er 2 tegenhoudt.
    expect(s.zones[0].damage[0]).toBe(3);
    expect(s.zones[0].shield[1]).toBe(0);
  });

  it('Fenix keert terug in je hand als ze teruggeroepen wordt', () => {
    let s = play(fresh(), 'fenix', zone(0));
    expect(s.zones[0].damage[0]).toBe(3);
    const uid = s.zones[0].cards[0].card.uid;
    s = play(s, 'rekruut', zone(0));
    expect(s.players[0].hand.some((c) => c.uid === uid)).toBe(true);
    expect(s.players[0].discard.some((c) => c.uid === uid)).toBe(false);
  });

  it('Fenix keert terug in je hand als ze vernietigd wordt, ook bij terugtrekken', () => {
    let s = play(fresh(), 'fenix', zone(0));
    const uid = s.zones[0].cards[0].card.uid;
    s = play(s, 'offervuur', zone(0));
    expect(s.players[0].hand.some((c) => c.uid === uid)).toBe(true);
    s = play(s, 'fenix', zone(1));
    s.players[0].gold = 10;
    const uid2 = s.zones[1].cards[0].card.uid;
    s = act(s, { type: 'recall', zone: 1, cardUid: uid2 });
    expect(s.players[0].hand.some((c) => c.uid === uid2)).toBe(true);
  });
});
