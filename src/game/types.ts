export type PlayerId = 0 | 1;

export type Keyword =
  | 'goud' | 'aanval' | 'storm' | 'herstel' | 'schild' | 'trek' | 'vertraag' | 'vernietig' | 'terugroep' | 'ververs';

/** Eén keyword met zijn waarde, zoals Aanval(2). */
export interface Effect {
  kw: Keyword;
  amount: number;
}

export interface CardDef {
  id: string;
  name: string;
  /** Goudprijs in de winkel; alleen voor kaarten die je kunt kopen. */
  price?: number;
  icon: string;
  /** Achtergrondkleur van de kaartillustratie. */
  color: string;
  /** Effect als je de kaart naar je aflegstapel sleept. */
  top: Effect[];
  /** Effect als je de kaart in een zone speelt. Leeg: de kaart kan je alleen afleggen. */
  bottom: Effect[];
}

/** Een fysieke kaart. Dezelfde kaartsoort kan meerdere keren voorkomen. */
export interface CardInstance {
  uid: string;
  defId: string;
}

export interface PlayerState {
  name: string;
  deck: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  /** Goud blijft bewaard over beurten heen. */
  gold: number;
  /** Zoveel kaarten minder trekken bij de volgende beurt (door Vertraag). */
  slow: number;
}

/** Een kaart in een zone. Ze blijft liggen tot Terugroep of Vernietig, ook nadat de zone veroverd is. */
export interface ZoneCard {
  player: PlayerId;
  card: CardInstance;
  /** De beurt waarin de kaart gelegd werd. */
  turn: number;
}

export interface Zone {
  name: string;
  icon: string;
  /** Schade die elke speler al in deze zone gedaan heeft. */
  damage: [number, number];
  /** Schild van elke speler: blokkeert schade van de tegenstander in deze zone. */
  shield: [number, number];
  owner: PlayerId | null;
  cards: ZoneCard[];
}

export interface Shop {
  /** De gedeelde voorraad waaruit de markt wordt aangevuld. */
  pile: CardInstance[];
  /** De kaarten die nu te koop liggen. */
  market: CardInstance[];
}

export interface GameState {
  players: [PlayerState, PlayerState];
  zones: Zone[];
  active: PlayerId;
  /** Totaal aantal gestarte beurten (beide spelers samen). */
  turn: number;
  winner: PlayerId | null;
  shop: Shop;
  log: string[];
  /** Toestand van de toevalsgenerator, zodat een spel volledig reproduceerbaar is. */
  seed: number;
}

export type PlayTarget = { kind: 'discard' } | { kind: 'zone'; zone: number };

export type Action =
  | { type: 'play'; handUid: string; target: PlayTarget }
  | { type: 'buy'; marketUid: string }
  | { type: 'endTurn' };

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: string };
