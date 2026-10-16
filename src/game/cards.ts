import { cardsWord, tr } from './i18n';
import { MAX_HAND, MAX_ZONE_CARDS, ZONE_HP } from './rules';
import { getSpecial } from './specials';
import type { CardDef, Effect, Keyword, Race } from './types';

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
  herschep: {
    get label() { return tr('Herschep', 'Reshape'); },
    noAmount: true,
    explain: () => tr(
      'Deze zone krijgt een nieuw, willekeurig effect: een effect dat nu in geen enkele zone speelt. De schade blijft staan en de levens volgen het nieuwe effect, maar zo verovert niemand een zone.',
      'This zone gets a new, random effect: one that is not active in any zone right now. Damage stays and health follows the new effect, but nobody conquers a zone this way.',
    ),
  },
  echo: {
    get label() { return tr('Echo', 'Echo'); },
    noAmount: true,
    explain: () => tr(
      'De volgende kaart die je deze beurt in een zone speelt, werkt gewoon en keert daarna meteen terug naar je aflegstapel. Ze heeft wel een vrije plek nodig. Vervalt aan het einde van je beurt.',
      'The next card you play in a zone this turn works normally and then returns to your discard pile right away. It does need a free slot. Expires at the end of your turn.',
    ),
  },
  schenk: {
    get label() { return tr('Schenk', 'Gift'); },
    explain: (n) => tr(
      `Je ${n === 1 ? 'oudste andere kaart' : `${n} oudste andere kaarten`} in deze zone ${n === 1 ? 'gaat' : 'gaan'} naar de aflegstapel van je tegenstander: vanaf nu ${n === 1 ? 'is ze' : 'zijn ze'} van hem.`,
      `Your ${n === 1 ? 'oldest other card' : `${n} oldest other cards`} in this zone ${n === 1 ? 'goes' : 'go'} to your opponent's discard pile: from now on ${n === 1 ? 'it belongs' : 'they belong'} to them.`,
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

/** De rassen: elk spel doet er één niet mee. */
export const RACES: Record<Race, { icon: string; readonly label: string; readonly plural: string }> = {
  mens: { icon: '🧑', get label() { return tr('Mens', 'Human'); }, get plural() { return tr('Mensen', 'Humans'); } },
  elf: { icon: '🧝', get label() { return tr('Elf', 'Elf'); }, get plural() { return tr('Elfen', 'Elves'); } },
  dwerg: { icon: '⛏️', get label() { return tr('Dwerg', 'Dwarf'); }, get plural() { return tr('Dwergen', 'Dwarves'); } },
  ork: { icon: '🪓', get label() { return tr('Ork', 'Orc'); }, get plural() { return tr('Orks', 'Orcs'); } },
  ondood: { icon: '💀', get label() { return tr('Ondode', 'Undead'); }, get plural() { return tr('Ondoden', 'Undead'); } },
};
export const RACE_IDS = Object.keys(RACES) as Race[];

const fx = (kw: Keyword, amount: number): Effect => ({ kw, amount });
/** Een effect dat alleen werkt als er al een kaart van dat ras van jou in de zone ligt. */
const als = (race: Race, e: Effect): Effect => ({ ...e, need: race });
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
  { id: 'vuurbal', name: 'Vuurbal', price: 4, icon: '🔥', color: '#e65100', top: [fx('storm', 1)], bottom: [fx('aanval', 4), als('ork', fx('storm', 1))] },
  { id: 'trol', name: 'Trollenmoker', price: 5, icon: '👹', color: '#6d4c41', top: [fx('trek', 2)], bottom: [fx('aanval', 4), als('ork', fx('aanval', 2))] },
  { id: 'draak', name: 'Drakenadem', price: 8, icon: '🐉', color: '#b23a48', top: [fx('storm', 3)], bottom: [fx('aanval', 7), als('ork', fx('aanval', 3))] },
  { id: 'storm', name: 'Bliksemstorm', price: 6, icon: '⚡', color: '#3949ab', top: [fx('storm', 2), fx('trek', 2)], bottom: [fx('aanval', 3), fx('trek', 2)] },
  { id: 'vampier', name: 'Vampierbeet', price: 5, icon: '🧛', color: '#6a1b2a', top: [fx('trek', 2)], bottom: [fx('aanval', 2), fx('herstel', 2), als('ondood', fx('herstel', 2))] },
  { id: 'uil', name: 'Wijze Uil', price: 3, icon: '🦉', color: '#795548', top: [fx('trek', 2)], bottom: [fx('aanval', 1), fx('trek', 1), als('elf', fx('trek', 1))] },
  { id: 'inzicht', name: 'Arcaan Inzicht', price: 5, icon: '📜', color: '#8e24aa', top: [fx('trek', 2)], bottom: [fx('aanval', 2), fx('trek', 2)] },
  { id: 'heks', name: 'IJsheks', price: 4, icon: '❄️', color: '#0277bd', top: [fx('vertraag', 1)], bottom: [fx('aanval', 2), fx('vertraag', 1), als('ondood', fx('vertraag', 1))] },
  { id: 'zandloper', name: 'Zandloper', price: 6, icon: '⏳', color: '#a1887f', top: [fx('vertraag', 2)], bottom: [fx('vertraag', 3)] },
  { id: 'golem', name: 'Steengolem', price: 4, icon: '🗿', color: '#757575', top: [fx('goud', 2)], bottom: [fx('schild', 5), als('dwerg', fx('schild', 2))] },
  { id: 'bron', name: 'Helende Bron', price: 3, icon: '💧', color: '#00897b', top: [fx('goud', 1)], bottom: [fx('herstel', 3)] },
  { id: 'schat', name: 'Drakenschat', price: 5, icon: '👑', color: '#c9a227', top: [fx('goud', 5)], bottom: [fx('aanval', 2), als('dwerg', fx('goud', 3))] },
  { id: 'offervuur', name: 'Offervuur', price: 4, icon: '🕯️', color: '#d84315', top: [fx('trek', 1)], bottom: [fx('vernietig', 0), fx('aanval', 3)] },
  { id: 'terugtocht', name: 'Terugtocht', price: 3, icon: '🏳️', color: '#607d8b', top: [fx('trek', 1), fx('goud', 1)], bottom: [fx('vernietig', 0), fx('schild', 2)] },
  { id: 'koerier', name: 'Koerier', price: 3, icon: '🐎', color: '#8d6e63', top: [fx('trek', 1), fx('goud', 1)], bottom: [fx('aanval', 2), fx('terugroep', 1)] },
  { id: 'hoornblazer', name: 'Hoornblazer', price: 5, icon: '📯', color: '#bf8f00', top: [fx('goud', 3)], bottom: [fx('aanval', 2), fx('terugroep', 2), als('mens', fx('goud', 2))] },
  { id: 'marskramer', name: 'Marskramer', price: 2, icon: '🛒', color: '#ad1457', top: [fx('goud', 2), fx('ververs', 0)], bottom: [fx('aanval', 2),fx('trek', 1)] },
  { id: 'bard', name: 'Zwervende Bard', price: 3, icon: '🪕', color: '#7b1fa2', top: [fx('ververs', 0), fx('trek', 1)], bottom: [fx('terugroep', 2), als('mens', fx('trek', 2))] },
  { id: 'valkenier', name: 'Valkenier', price: 4, icon: '🦅', color: '#8d6e63', top: [fx('ververs', 0), fx('goud', 2)], bottom: [fx('aanval', 1), fx('terugroep', 2)] },
  { id: 'getijde', name: 'Getijdenmagiër', price: 5, icon: '🌊', color: '#00695c', top: [fx('ververs', 0), fx('goud', 3)], bottom: [fx('terugroep', 3), fx('schild', 3)] },
  { id: 'bol', name: 'Kristallen Bol', price: 4, icon: '🔮', color: '#5e35b1', top: [fx('goud', 2)], bottom: [fx('ververs', 0), fx('goud', 4)] },
  { id: 'generaal', name: 'Generaal', price: 7, icon: '🎖️', color: '#4e342e', top: [fx('goud', 3)], bottom: [fx('aanval', 3), fx('terugroep', 3), als('mens', fx('aanval', 2))] },

  { id: 'schildknaap', name: 'Schildknaap', price: 2, icon: '🛡️', color: '#78909c', top: [fx('goud', 1)], bottom: [fx('schild', 3), als('mens', fx('schild', 2))] },
  { id: 'pestdrager', name: 'Pestdrager', price: 3, icon: '🐀', color: '#5f6b3a', top: [fx('goud', 1), fx('vertraag', 1)], bottom: [fx('aanval', 2), fx('schenk', 2)] },

  // Kaarten met een speciaal effect (zie specials.ts)
  { id: 'alchemist', name: 'Alchemist', price: 5, icon: '⚗️', color: '#6a1b9a', top: [special('dubbelgoud')], bottom: [fx('aanval', 2)] },
  { id: 'huurling', name: 'Huurling', price: 4, icon: '🗡️', color: '#5d4037', top: [fx('goud', 1)], bottom: [fx('aanval', 4), special('huur')] },
  { id: 'ram', name: 'Belegeringsram', price: 4, icon: '🐏', color: '#6d4c41', top: [fx('goud', 2)], bottom: [special('ram'), fx('aanval', 2)] },
  { id: 'fenix', name: 'Fenix', price: 6, icon: '🐦‍🔥', color: '#e64a19', top: [fx('goud', 2)], bottom: [fx('aanval', 3), special('wedergeboorte')] },
  { id: 'goblin', name: 'Goblin', price: 2, icon: '👺', color: '#558b2f', top: [fx('goud', 1)], bottom: [special('diefstal')] },
  { id: 'geest', name: 'Wrekende Geest', price: 4, icon: '👻', color: '#455a64', top: [fx('trek', 1), fx('goud', 2)], bottom: [special('wraak'), fx('schild', 2)] },

  // Kaarten die het effect van een zone veranderen
  { id: 'landmeter', name: 'Landmeter', price: 4, icon: '🧭', color: '#5d7b3a', top: [fx('goud', 2)], bottom: [fx('herschep', 0), fx('aanval', 2)] },
  { id: 'portaal', name: 'Portaalmagiër', price: 6, icon: '🌀', color: '#4527a0', top: [fx('trek', 1), fx('goud', 2)], bottom: [fx('herschep', 0), fx('aanval', 3)] },
  { id: 'weermaker', name: 'Weermaker', price: 7, icon: '🌦️', color: '#0288d1', top: [fx('goud', 3)], bottom: [fx('herschep', 0), fx('aanval', 3), fx('schild', 2)] },

  // Meer Vernietig
  { id: 'zuiveraar', name: 'Zuiveraar', price: 5, icon: '✨', color: '#9e8c3a', top: [fx('goud', 3)], bottom: [fx('vernietig', 0), fx('herstel', 3)] },
  { id: 'brandstichter', name: 'Brandstichter', price: 4, icon: '🧨', color: '#bf360c', top: [fx('storm', 1)], bottom: [fx('vernietig', 0), fx('aanval', 2), fx('vertraag', 1)] },
  { id: 'dodenbezweerder', name: 'Dodenbezweerder', price: 5, icon: '💀', color: '#37474f', top: [fx('trek', 1), fx('goud', 1)], bottom: [special('zielenoogst'), als('ondood', fx('trek', 1))] },

  // Je volgende kaart in een zone keert meteen terug
  { id: 'windloper', name: 'Windloper', price: 3, icon: '🌬️', color: '#4f8a8b', top: [fx('goud', 1), fx('echo', 0)], bottom: [fx('aanval', 2)] },
  { id: 'schaduwdanser', name: 'Schaduwdanser', price: 4, icon: '🥷', color: '#3e2a4f', top: [fx('goud', 3)], bottom: [fx('aanval', 2), fx('echo', 0)] },
  { id: 'tijdmagier', name: 'Tijdmagiër', price: 5, icon: '🕰️', color: '#6d5a2b', top: [fx('trek', 1), fx('echo', 0)], bottom: [fx('aanval', 3), fx('echo', 0), als('elf', fx('aanval', 2))] },

  // Heel dure kaarten
  { id: 'mammoet', name: 'Oorlogsmammoet', price: 7, icon: '🦣', color: '#6d4c41', top: [fx('goud', 4), fx('trek', 2)], bottom: [fx('aanval', 4), fx('schild', 4)] },
  { id: 'aartsmagier', name: 'Aartsmagiër', price: 8, icon: '🧙', color: '#311b92', top: [fx('trek', 4), fx('goud', 2)], bottom: [fx('storm', 3), fx('trek', 2)] },
  { id: 'titaan', name: 'Titaan', price: 9, icon: '⛰️', color: '#546e7a', top: [fx('goud', 5), fx('storm', 2)], bottom: [fx('aanval', 6), fx('schild', 4), als('dwerg', fx('aanval', 3))] },
  { id: 'leegte', name: 'Leegtescheur', price: 10, icon: '🕳️', color: '#1a1030', top: [fx('storm', 2), fx('vertraag', 3)], bottom: [fx('vernietig', 0), fx('aanval', 7), fx('vertraag', 2)] },
  { id: 'meteoor', name: 'Meteoor', price: 11, icon: '☄️', color: '#d84315', top: [fx('storm', 5), fx('goud', 2)], bottom: [fx('storm', 7)] },
  { id: 'ravenkoningin', name: 'Ravenkoningin', price: 8, icon: '🐦‍⬛', color: '#263238', top: [fx('goud', 3), fx('trek', 1)], bottom: [special('leegveld')] },
  { id: 'drakenkoning', name: 'Drakenkoning', price: 12, icon: '🐲', color: '#7f0000', top: [fx('storm', 4), fx('goud', 3)], bottom: [fx('aanval', 10), fx('schild', 6)] },
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
  landmeter: 'Surveyor', portaal: 'Portal Mage', weermaker: 'Weather Maker',
  zuiveraar: 'Purifier', brandstichter: 'Arsonist', dodenbezweerder: 'Necromancer',
  windloper: 'Windrunner', schaduwdanser: 'Shadow Dancer', tijdmagier: 'Chronomancer',
  mammoet: 'War Mammoth', aartsmagier: 'Archmage', titaan: 'Titan', leegte: 'Void Rift', meteoor: 'Meteor',
  ravenkoningin: 'Raven Queen', drakenkoning: 'Dragon King',
  schildknaap: 'Squire', pestdrager: 'Plague Bearer',
};

/**
 * Het ras van elke winkelkaart. Elk ras heeft van alles wat: goedkope en dure kaarten, goud, trekken, aanval en verdediging.
 * Mensen: goud, terugroepen en de winkel. Elfen: trekken, echo en herstel. Dwergen: schild en goud.
 * Orks: veel schade en vernietig. Ondoden: vertragen, vernietigen en duistere specials.
 */
const RACE_OF: Record<string, Race> = {
  marskramer: 'mens', schildknaap: 'mens', koerier: 'mens', valkenier: 'mens', ram: 'mens',
  landmeter: 'mens', hoornblazer: 'mens', generaal: 'mens', aartsmagier: 'mens',
  uil: 'elf', bron: 'elf', windloper: 'elf', bard: 'elf', schaduwdanser: 'elf',
  inzicht: 'elf', tijdmagier: 'elf', weermaker: 'elf', meteoor: 'elf',
  terugtocht: 'dwerg', golem: 'dwerg', bol: 'dwerg', schat: 'dwerg', alchemist: 'dwerg',
  zuiveraar: 'dwerg', portaal: 'dwerg', mammoet: 'dwerg', titaan: 'dwerg',
  goblin: 'ork', vuurbal: 'ork', huurling: 'ork', offervuur: 'ork', brandstichter: 'ork',
  trol: 'ork', storm: 'ork', draak: 'ork', drakenkoning: 'ork',
  pestdrager: 'ondood', heks: 'ondood', geest: 'ondood', vampier: 'ondood', dodenbezweerder: 'ondood',
  getijde: 'ondood', zandloper: 'ondood', fenix: 'ondood', ravenkoningin: 'ondood', leegte: 'ondood',
};

// De naam wordt een getter: def.name geeft altijd de naam in de gekozen taal.
for (const def of CARD_LIST) {
  const nl = def.name;
  Object.defineProperty(def, 'name', { get: () => tr(nl, NAMES_EN[def.id] ?? nl), enumerable: true });
  def.race = RACE_OF[def.id];
  // Elke winkelkaart heeft een ras; een vergeten kaart geeft meteen een fout bij het laden.
  if (def.price !== undefined && !def.race) throw new Error(`Kaart zonder ras: ${def.id}`);
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
  ['schildknaap', 3], ['pestdrager', 3], ['bard', 3], ['valkenier', 3], ['getijde', 2], ['bol', 2], ['generaal', 2],
  ['alchemist', 2], ['geest', 3], ['goblin', 3], ['huurling', 3], ['ram', 3], ['fenix', 2],
  ['landmeter', 3], ['portaal', 2], ['weermaker', 2],
  ['zuiveraar', 3], ['brandstichter', 2], ['dodenbezweerder', 2],
  ['windloper', 3], ['schaduwdanser', 2], ['tijdmagier', 2],
  ['mammoet', 2], ['aartsmagier', 1], ['titaan', 1], ['ravenkoningin', 1], ['leegte', 1], ['meteoor', 1], ['drakenkoning', 1],
]);
