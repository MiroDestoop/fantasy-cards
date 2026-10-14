import { ZONE_HP } from './rules';
import type { CardDef, Effect, Keyword } from './types';

const kaarten = (n: number) => (n === 1 ? '1 kaart' : `${n} kaarten`);

export const KEYWORDS: Record<Keyword, { label: string; explain: (n: number) => string }> = {
  goud: {
    label: 'Goud',
    explain: (n) => `Krijg ${n} goud. Daarmee koop je kaarten in de winkel. Goud blijft bewaard tot je het uitgeeft.`,
  },
  aanval: {
    label: 'Aanval',
    explain: (n) => `Doe ${n} schade in de zone waar je deze kaart speelt. Wie als eerste ${ZONE_HP} schade doet in een zone, verovert ze.`,
  },
  storm: {
    label: 'Storm',
    explain: (n) => `Doe ${n} schade in elke zone die nog niet veroverd is.`,
  },
  herstel: {
    label: 'Herstel',
    explain: (n) => `Verwijder ${n} schade die je tegenstander in deze zone gedaan heeft.`,
  },
  schild: {
    label: 'Schild',
    explain: (n) => `Blokkeer de volgende ${n} schade die je tegenstander in deze zone doet.`,
  },
  trek: {
    label: 'Trek',
    explain: (n) => `Trek ${kaarten(n)}. Is je stapel leeg, dan wordt je aflegstapel geschud tot een nieuwe stapel.`,
  },
  vertraag: {
    label: 'Vertraag',
    explain: (n) => `Je tegenstander trekt volgende beurt ${kaarten(n)} minder.`,
  },
};

const fx = (kw: Keyword, amount: number): Effect => ({ kw, amount });

// Kaarten: pas namen, prijzen en keywords hier gerust aan.
// `top` krijg je door de kaart naar je aflegstapel te slepen, `bottom` door ze in een zone te spelen.
const CARD_LIST: CardDef[] = [
  // Startkaarten
  { id: 'koper', name: 'Koperen Munt', icon: '🪙', color: '#b87333', top: [fx('goud', 1)], bottom: [fx('aanval', 1)] },
  { id: 'zilver', name: 'Zilveren Munt', icon: '💰', color: '#9e9e9e', top: [fx('goud', 2)], bottom: [fx('aanval', 1)] },
  { id: 'rekruut', name: 'Rekruut', icon: '🗡️', color: '#6b8e23', top: [fx('goud', 1)], bottom: [fx('aanval', 2)] },

  // Winkelkaarten
  { id: 'vuurbal', name: 'Vuurbal', price: 4, icon: '🔥', color: '#e65100', top: [fx('storm', 1)], bottom: [fx('aanval', 4)] },
  { id: 'trol', name: 'Trollenmoker', price: 5, icon: '👹', color: '#6d4c41', top: [fx('goud', 2)], bottom: [fx('aanval', 5)] },
  { id: 'draak', name: 'Drakenadem', price: 8, icon: '🐉', color: '#b23a48', top: [fx('storm', 3)], bottom: [fx('aanval', 8)] },
  { id: 'storm', name: 'Bliksemstorm', price: 6, icon: '⚡', color: '#3949ab', top: [fx('storm', 2)], bottom: [fx('aanval', 3), fx('trek', 1)] },
  { id: 'vampier', name: 'Vampierbeet', price: 5, icon: '🧛', color: '#6a1b2a', top: [fx('goud', 2)], bottom: [fx('aanval', 3), fx('herstel', 2)] },
  { id: 'uil', name: 'Wijze Uil', price: 3, icon: '🦉', color: '#795548', top: [fx('trek', 2)], bottom: [fx('aanval', 1), fx('trek', 1)] },
  { id: 'inzicht', name: 'Arcaan Inzicht', price: 4, icon: '📜', color: '#8e24aa', top: [fx('trek', 3)], bottom: [fx('aanval', 2), fx('trek', 1)] },
  { id: 'heks', name: 'IJsheks', price: 5, icon: '❄️', color: '#0277bd', top: [fx('vertraag', 1)], bottom: [fx('aanval', 2), fx('vertraag', 1)] },
  { id: 'zandloper', name: 'Zandloper', price: 6, icon: '⏳', color: '#a1887f', top: [fx('vertraag', 2)], bottom: [fx('aanval', 3)] },
  { id: 'golem', name: 'Steengolem', price: 4, icon: '🗿', color: '#757575', top: [fx('goud', 1)], bottom: [fx('schild', 5)] },
  { id: 'bron', name: 'Helende Bron', price: 3, icon: '💧', color: '#00897b', top: [fx('goud', 1)], bottom: [fx('herstel', 4)] },
  { id: 'schat', name: 'Drakenschat', price: 5, icon: '👑', color: '#c9a227', top: [fx('goud', 4)], bottom: [fx('aanval', 2)] },
];

export const CARDS: Record<string, CardDef> = Object.fromEntries(CARD_LIST.map((c) => [c.id, c]));

export function getCard(id: string): CardDef {
  const def = CARDS[id];
  if (!def) throw new Error(`Onbekende kaart: ${id}`);
  return def;
}

const expand = (counts: [string, number][]) => counts.flatMap(([id, n]) => Array<string>(n).fill(id));

/** Beginstapel van 10 kaarten; beide spelers krijgen dezelfde. */
export const STARTER_DECK = expand([['koper', 6], ['zilver', 2], ['rekruut', 2]]);

/** De gedeelde voorraad van de winkel. */
export const SHOP_SUPPLY = expand([
  ['vuurbal', 3], ['trol', 3], ['draak', 2], ['storm', 3], ['vampier', 3], ['uil', 3],
  ['inzicht', 3], ['heks', 3], ['zandloper', 2], ['golem', 3], ['bron', 3], ['schat', 3],
]);
