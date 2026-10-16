import { cardsWord, tr } from './i18n';
import { MAX_HAND, MAX_ZONE_CARDS, ZONE_HP } from './rules';
import { getSpecial } from './specials';
import type { CardDef, Effect, Keyword } from './types';

// label is een getter: zo geeft KEYWORDS[kw].label altijd de gekozen taal.
export const KEYWORDS: Record<Keyword, { readonly label: string; noAmount?: boolean; explain: (n: number) => string }> = {
  goud: {
    get label() { return tr('Goud', 'Gold'); },
    explain: (n) => tr(
      `Krijg ${n} goud. Daarmee koop je kaarten in de winkel. Goud blijft bewaard tot je het uitgeeft.`,
      `Gain ${n} gold. You buy cards in the shop with it. Gold is kept until you spend it.`,
    ),
  },
  aanval: {
    get label() { return tr('Aanval', 'Attack'); },
    explain: (n) => tr(
      `Doe ${n} schade in de zone waar je deze kaart speelt. Wie als eerste de levens van een zone vol schade doet (meestal ${ZONE_HP}), verovert ze.`,
      `Deal ${n} damage in the zone where you play this card. Whoever first fills a zone's health with damage (usually ${ZONE_HP}) conquers it.`,
    ),
  },
  storm: {
    get label() { return tr('Storm', 'Storm'); },
    explain: (n) => tr(`Doe ${n} schade in elke zone die nog niet veroverd is.`, `Deal ${n} damage in every zone that has not been conquered yet.`),
  },
  herstel: {
    get label() { return tr('Herstel', 'Heal'); },
    explain: (n) => tr(`Verwijder ${n} schade die je tegenstander in deze zone gedaan heeft.`, `Remove ${n} damage your opponent has dealt in this zone.`),
  },
  schild: {
    get label() { return tr('Schild', 'Shield'); },
    explain: (n) => tr(`Blokkeer de volgende ${n} schade die je tegenstander in deze zone doet.`, `Block the next ${n} damage your opponent deals in this zone.`),
  },
  trek: {
    get label() { return tr('Trek', 'Draw'); },
    explain: (n) => tr(
      `Trek ${cardsWord(n)}. Is je stapel leeg, dan wordt je aflegstapel geschud; kaarten die je deze beurt gespeeld hebt, zitten daar nog niet in. Je hand heeft een limiet van ${MAX_HAND}: wat je daarboven trekt, gaat naar je aflegstapel.`,
      `Draw ${cardsWord(n)}. If your deck is empty, your discard pile is shuffled; cards you played this turn are not in it yet. Your hand limit is ${MAX_HAND}: anything you draw above it goes to your discard pile.`,
    ),
  },
  vertraag: {
    get label() { return tr('Vertraag', 'Slow'); },
    explain: (n) => tr(`Je tegenstander trekt volgende beurt ${cardsWord(n)} minder.`, `Your opponent draws ${cardsWord(n)} fewer next turn.`),
  },
  vernietig: {
    get label() { return tr('Vernietig', 'Destroy'); },
    noAmount: true,
    explain: () => tr(
      `Verban al je andere kaarten in deze zone uit het spel; deze kaart blijft liggen. Zo maak je plaats (max. ${MAX_ZONE_CARDS} per zone) en raak je zwakke kaarten voorgoed kwijt. Je hebt wel een vrije plek nodig om ze te spelen.`,
      `Banish all your other cards in this zone from the game; this card stays. This makes room (max. ${MAX_ZONE_CARDS} per zone) and gets rid of weak cards for good. You do need a free slot to play it.`,
    ),
  },
  terugroep: {
    get label() { return tr('Terugroep', 'Recall'); },
    explain: (n) => tr(
      `Haal ${n === 1 ? 'je oudste andere kaart' : `je ${n} oudste andere kaarten`} in deze zone terug naar je aflegstapel; deze kaart blijft liggen. Je hebt wel een vrije plek nodig om ze te spelen.`,
      `Return ${n === 1 ? 'your oldest other card' : `your ${n} oldest other cards`} in this zone to your discard pile; this card stays. You do need a free slot to play it.`,
    ),
  },
  ververs: {
    get label() { return tr('Ververs', 'Refresh'); },
    noAmount: true,
    explain: () => tr(
      'Vervang alle kaarten in de winkel door nieuwe. De oude gaan onderaan de voorraad.',
      'Replace all cards in the shop with new ones. The old ones go to the bottom of the supply.',
    ),
  },
};

const fx = (kw: Keyword, amount: number): Effect => ({ kw, amount });
/** Een speciaal effect uit specials.ts. Een tikfout in de naam geeft meteen een foutmelding. */
const special = (id: string): Effect => (getSpecial(id), { kw: 'speciaal', id });

// Kaarten: pas namen, prijzen en keywords hier gerust aan.
// `top` krijg je door de kaart naar je aflegstapel te slepen, `bottom` door ze in een zone te spelen.
const CARD_LIST: CardDef[] = [
  // Startkaarten
  { id: 'koper', name: 'Koperen Munt', icon: '🪙', color: '#b87333', top: [fx('goud', 1)], bottom: [] },
  { id: 'zilver', name: 'Zilveren Munt', icon: '💰', color: '#9e9e9e', top: [fx('goud', 2)], bottom: [fx('aanval', 1)] },
  { id: 'rekruut', name: 'Rekruut', icon: '🗡️', color: '#6b8e23', top: [fx('goud', 1)], bottom: [fx('aanval', 1), fx('terugroep', 1)] },

  // Winkelkaarten
  { id: 'vuurbal', name: 'Vuurbal', price: 4, icon: '🔥', color: '#e65100', top: [fx('storm', 1)], bottom: [fx('aanval', 4)] },
  { id: 'trol', name: 'Trollenmoker', price: 5, icon: '👹', color: '#6d4c41', top: [fx('goud', 2)], bottom: [fx('aanval', 5)] },
  { id: 'draak', name: 'Drakenadem', price: 8, icon: '🐉', color: '#b23a48', top: [fx('storm', 3)], bottom: [fx('aanval', 8)] },
  { id: 'storm', name: 'Bliksemstorm', price: 6, icon: '⚡', color: '#3949ab', top: [fx('storm', 2)], bottom: [fx('aanval', 3), fx('trek', 1)] },
  { id: 'vampier', name: 'Vampierbeet', price: 5, icon: '🧛', color: '#6a1b2a', top: [fx('goud', 2)], bottom: [fx('aanval', 3), fx('herstel', 2)] },
  { id: 'uil', name: 'Wijze Uil', price: 3, icon: '🦉', color: '#795548', top: [fx('trek', 2)], bottom: [fx('aanval', 1), fx('trek', 1)] },
  { id: 'inzicht', name: 'Arcaan Inzicht', price: 5, icon: '📜', color: '#8e24aa', top: [fx('trek', 3)], bottom: [fx('aanval', 2), fx('trek', 1)] },
  { id: 'heks', name: 'IJsheks', price: 5, icon: '❄️', color: '#0277bd', top: [fx('vertraag', 1)], bottom: [fx('aanval', 2), fx('vertraag', 1)] },
  { id: 'zandloper', name: 'Zandloper', price: 6, icon: '⏳', color: '#a1887f', top: [fx('vertraag', 2)], bottom: [fx('aanval', 3)] },
  { id: 'golem', name: 'Steengolem', price: 4, icon: '🗿', color: '#757575', top: [fx('goud', 1)], bottom: [fx('schild', 5)] },
  { id: 'bron', name: 'Helende Bron', price: 3, icon: '💧', color: '#00897b', top: [fx('goud', 1)], bottom: [fx('herstel', 4)] },
  { id: 'schat', name: 'Drakenschat', price: 5, icon: '👑', color: '#c9a227', top: [fx('goud', 4)], bottom: [fx('aanval', 2)] },
  { id: 'offervuur', name: 'Offervuur', price: 4, icon: '🕯️', color: '#d84315', top: [fx('goud', 1)], bottom: [fx('vernietig', 0), fx('aanval', 3)] },
  { id: 'terugtocht', name: 'Terugtocht', price: 3, icon: '🏳️', color: '#607d8b', top: [fx('trek', 1), fx('goud', 1)], bottom: [fx('vernietig', 0), fx('schild', 2)] },
  { id: 'koerier', name: 'Koerier', price: 3, icon: '🐎', color: '#8d6e63', top: [fx('trek', 1), fx('goud', 1)], bottom: [fx('aanval', 2), fx('terugroep', 1)] },
  { id: 'hoornblazer', name: 'Hoornblazer', price: 5, icon: '📯', color: '#bf8f00', top: [fx('goud', 2)], bottom: [fx('aanval', 3), fx('terugroep', 2)] },
  { id: 'marskramer', name: 'Marskramer', price: 2, icon: '🛒', color: '#ad1457', top: [fx('goud', 1), fx('ververs', 0)], bottom: [fx('aanval', 1)] },
  { id: 'bard', name: 'Zwervende Bard', price: 3, icon: '🪕', color: '#7b1fa2', top: [fx('ververs', 0), fx('trek', 1)], bottom: [fx('aanval', 1), fx('terugroep', 2)] },
  { id: 'valkenier', name: 'Valkenier', price: 4, icon: '🦅', color: '#8d6e63', top: [fx('ververs', 0), fx('goud', 1)], bottom: [fx('aanval', 2), fx('terugroep', 2)] },
  { id: 'getijde', name: 'Getijdenmagiër', price: 5, icon: '🌊', color: '#00695c', top: [fx('ververs', 0), fx('goud', 2)], bottom: [fx('terugroep', 3), fx('schild', 3)] },
  { id: 'bol', name: 'Kristallen Bol', price: 4, icon: '🔮', color: '#5e35b1', top: [fx('goud', 2)], bottom: [fx('ververs', 0), fx('aanval', 2)] },
  { id: 'generaal', name: 'Generaal', price: 7, icon: '🎖️', color: '#4e342e', top: [fx('goud', 3)], bottom: [fx('aanval', 4), fx('terugroep', 3)] },

  // Kaarten met een speciaal effect (zie specials.ts)
  { id: 'alchemist', name: 'Alchemist', price: 5, icon: '⚗️', color: '#6a1b9a', top: [special('dubbelgoud')], bottom: [fx('aanval', 2)] },
  { id: 'huurling', name: 'Huurling', price: 4, icon: '🗡️', color: '#5d4037', top: [fx('goud', 1)], bottom: [fx('aanval', 4), special('huur')] },
  { id: 'ram', name: 'Belegeringsram', price: 4, icon: '🐏', color: '#6d4c41', top: [fx('goud', 1)], bottom: [special('ram'), fx('aanval', 2)] },
  { id: 'fenix', name: 'Fenix', price: 6, icon: '🐦‍🔥', color: '#e64a19', top: [fx('goud', 2)], bottom: [fx('aanval', 3), special('wedergeboorte')] },
  { id: 'goblin', name: 'Goblin', price: 2, icon: '👺', color: '#558b2f', top: [fx('goud', 1)], bottom: [special('diefstal')] },
  { id: 'geest', name: 'Wrekende Geest', price: 4, icon: '👻', color: '#455a64', top: [fx('trek', 1), fx('goud', 1)], bottom: [special('wraak')] },
];

/** Engelse kaartnamen. Een kaart zonder vertaling hier houdt haar Nederlandse naam. */
const NAMES_EN: Record<string, string> = {
  koper: 'Copper Coin', zilver: 'Silver Coin', rekruut: 'Recruit',
  vuurbal: 'Fireball', trol: 'Troll Smasher', draak: "Dragon's Breath", storm: 'Lightning Storm',
  vampier: 'Vampire Bite', uil: 'Wise Owl', inzicht: 'Arcane Insight', heks: 'Ice Witch', zandloper: 'Hourglass',
  golem: 'Stone Golem', bron: 'Healing Spring', schat: 'Dragon Hoard', offervuur: 'Sacrificial Fire',
  terugtocht: 'Retreat', koerier: 'Courier', hoornblazer: 'Horn Blower', marskramer: 'Peddler',
  bard: 'Wandering Bard', valkenier: 'Falconer', getijde: 'Tide Mage', bol: 'Crystal Ball', generaal: 'General',
  alchemist: 'Alchemist', huurling: 'Mercenary', ram: 'Battering Ram', fenix: 'Phoenix', goblin: 'Goblin',
  geest: 'Vengeful Spirit',
};

// De naam wordt een getter: def.name geeft altijd de naam in de gekozen taal.
for (const def of CARD_LIST) {
  const nl = def.name;
  Object.defineProperty(def, 'name', { get: () => tr(nl, NAMES_EN[def.id] ?? nl), enumerable: true });
}

export const CARDS: Record<string, CardDef> = Object.fromEntries(CARD_LIST.map((c) => [c.id, c]));

export function getCard(id: string): CardDef {
  const def = CARDS[id];
  if (!def) throw new Error(`Onbekende kaart: ${id}`);
  return def;
}

const expand = (counts: [string, number][]) => counts.flatMap(([id, n]) => Array<string>(n).fill(id));

/** Beginstapel van 10 kaarten; beide spelers krijgen dezelfde. */
export const STARTER_DECK = expand([['koper', 5], ['rekruut', 3], ['zilver', 2]]);

/** De gedeelde voorraad van de winkel. */
export const SHOP_SUPPLY = expand([
  ['vuurbal', 3], ['trol', 3], ['draak', 2], ['storm', 3], ['vampier', 3], ['uil', 3],
  ['inzicht', 3], ['heks', 3], ['zandloper', 2], ['golem', 3], ['bron', 3], ['schat', 3],
  ['offervuur', 3], ['terugtocht', 3], ['koerier', 3], ['hoornblazer', 3], ['marskramer', 3],
  ['bard', 3], ['valkenier', 3], ['getijde', 2], ['bol', 2], ['generaal', 2],
  ['alchemist', 2], ['geest', 3], ['goblin', 3], ['huurling', 3], ['ram', 3], ['fenix', 2],
]);
