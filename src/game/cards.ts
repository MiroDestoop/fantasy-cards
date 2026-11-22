import { cardsWord, tr } from './i18n';
import { MAX_HAND, MAX_ZONE_CARDS, ZONE_HP } from './rules';
import { getSpecial } from './specials';
import type { CardDef, Daad, Effect, Keyword, Race } from './types';

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
  verban: {
    get label() { return tr('Verban', 'Banish'); },
    explain: (n) => tr(
      `Kies deze beurt ${n === 1 ? 'een kaart' : `${n} kaarten`} in de winkel (knop ✖ op de kaart): ${n === 1 ? 'ze gaat' : 'ze gaan'} onderaan de voorraad en ${n === 1 ? 'wordt' : 'worden'} vervangen door een nieuwe. Vervalt aan het einde van je beurt.`,
      `This turn, pick ${n === 1 ? 'a card' : `${n} cards`} in the shop (✖ button on the card): ${n === 1 ? 'it goes' : 'they go'} to the bottom of the supply and ${n === 1 ? 'is' : 'are'} replaced by a new one. Expires at the end of your turn.`,
    ),
  },
  vervloek: {
    get label() { return tr('Vervloek', 'Curse'); },
    explain: (n) => tr(
      `Schud ${n === 1 ? 'een Vloek' : `${n} Vloeken`} in de stapel van je tegenstander. Een Vloek neemt een plaats in zijn hand in en doet niets; afleggen kost 1 goud en dan verdwijnt ze uit het spel. In een zone neemt ze gratis een plek in.`,
      `Shuffle ${n === 1 ? 'a Curse' : `${n} Curses`} into your opponent's deck. A Curse takes up a spot in their hand and does nothing; discarding it costs 1 gold, and then it leaves the game. In a zone it takes up a spot for free.`,
    ),
  },
  verdwijn: {
    get label() { return tr('Verdwijn', 'Vanish'); },
    noAmount: true,
    explain: () => tr(
      'Deze kaart verdwijnt uit het spel: ze komt niet meer terug in je stapel.',
      'This card leaves the game: it does not come back to your deck.',
    ),
  },
  betaal: {
    get label() { return tr('Betaal', 'Pay'); },
    explain: (n) => tr(
      `Deze helft spelen kost ${n} goud. Heb je dat niet, dan kan je ze niet spelen.`,
      `Playing this half costs ${n} gold. If you don't have it, you cannot play it.`,
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
  offer: {
    get label() { return tr('Offer', 'Sacrifice'); },
    explain: (n) => tr(
      `Kies ${n === 1 ? 'een kaart' : `${n} kaarten`} uit je hand of uit de kaarten die je deze beurt speelde (ook munten): ${n === 1 ? 'ze verdwijnt' : 'ze verdwijnen'} voorgoed uit het spel. Zo wordt je stapel kleiner en sterker. Je mag ook overslaan. Vervalt aan het einde van je beurt.`,
      `Pick ${n === 1 ? 'a card' : `${n} cards`} from your hand or from the cards you played this turn (coins too): ${n === 1 ? 'it leaves' : 'they leave'} the game for good. This makes your deck smaller and stronger. You may also skip. Expires at the end of your turn.`,
    ),
  },
};

/**
 * De vier rassen, elk met een eigen speelstijl. `color` kleurt de achtergrond van hun kaarten.
 * Kultisten: offeren en vernietigen. Goblins: veel goud en grote kaarten.
 * Sluipmoordenaars: veel trekken en terugroepen. Heksen: herstel, vloeken en vertragen.
 */
export const RACES: Record<Race, { icon: string; color: string; readonly label: string; readonly plural: string; readonly style: string }> = {
  kultist: {
    icon: '🕯️', color: '#8b1a2b',
    get label() { return tr('Kultist', 'Cultist'); }, get plural() { return tr('Kultisten', 'Cultists'); },
    get style() { return tr('offeren en vernietigen', 'sacrificing and destroying'); },
  },
  goblin: {
    icon: '👺', color: '#4f7d1f',
    get label() { return tr('Goblin', 'Goblin'); }, get plural() { return tr('Goblins', 'Goblins'); },
    get style() { return tr('veel goud en grote kaarten', 'lots of gold and big cards'); },
  },
  sluip: {
    icon: '🥷', color: '#3a2f7a',
    get label() { return tr('Sluipmoordenaar', 'Assassin'); }, get plural() { return tr('Sluipmoordenaars', 'Assassins'); },
    get style() { return tr('veel trekken en terugroepen', 'lots of drawing and recalling'); },
  },
  heks: {
    icon: '🧙‍♀️', color: '#1f6b5e',
    get label() { return tr('Heks', 'Witch'); }, get plural() { return tr('Heksen', 'Witches'); },
    get style() { return tr('herstel, vloeken en vertragen', 'healing, curses and slowing'); },
  },
};
export const RACE_IDS = Object.keys(RACES) as Race[];

/** Wat je eerder in deze beurt gedaan kunt hebben (voorwaarde `eerder`): icoon en uitleg voor op de kaart. */
export const DEEDS: Record<Daad, { icon: string; readonly text: string }> = {
  offer: { icon: '🔪', get text() { return tr('Alleen als je deze beurt al een kaart offerde.', 'Only if you already sacrificed a card this turn.'); } },
  vernietig: { icon: '🔥', get text() { return tr('Alleen als je deze beurt al kaarten vernietigde.', 'Only if you already destroyed cards this turn.'); } },
  herstel: { icon: '💚', get text() { return tr('Alleen als je deze beurt al hersteld hebt.', 'Only if you already healed this turn.'); } },
  vervloek: { icon: '🕸️', get text() { return tr('Alleen als je deze beurt al iemand vervloekte.', 'Only if you already cursed this turn.'); } },
  terugroep: { icon: '↩️', get text() { return tr('Alleen als je deze beurt al een kaart terugriep.', 'Only if you already recalled a card this turn.'); } },
  trek: { icon: '🃏', get text() { return tr('Alleen als je deze beurt al een kaart trok met een effect.', 'Only if you already drew a card with an effect this turn.'); } },
  groot: { icon: '💎', get text() { return tr('Alleen als je deze beurt al een kaart van 6 goud of meer speelde.', 'Only if you already played a card costing 6 gold or more this turn.'); } },
};

const fx = (kw: Keyword, amount: number): Effect => ({ kw, amount });
/** Een effect dat alleen werkt als er al een kaart van dat ras van jou in de zone ligt. */
const als = (race: Race, e: Effect): Effect => ({ ...e, need: race });
/** Een speciaal effect uit specials.ts. Een tikfout in de naam geeft meteen een foutmelding. */
const special = (id: string): Effect => (getSpecial(id), { kw: 'speciaal', id });
/** Een effect dat alleen werkt als je dit eerder in deze beurt al gedaan hebt. */
const na = (daad: Daad, e: Effect): Effect => ({ ...e, eerder: daad });

// Kaarten: pas namen, prijzen en keywords hier gerust aan.
// `top` krijg je door de kaart naar je aflegstapel te slepen, `bottom` door ze in een zone te spelen.
const CARD_LIST: CardDef[] = [
  // Startkaarten
  { id: 'koper', name: 'Koperen Munt', icon: '🪙', color: '#b87333', top: [fx('goud', 1)], bottom: [] },
  { id: 'zilver', name: 'Zilveren Munt', icon: '💰', color: '#9e9e9e', top: [fx('goud', 2)], bottom: [fx('verban', 1)] },
  // De Vloek komt niet in de winkel: het keyword Vervloek schudt ze in de stapel van de tegenstander.
  { id: 'vloek', name: 'Vloek', icon: '🕸️', color: '#2e1a2e', top: [fx('betaal', 1), fx('verdwijn', 0)], bottom: [special('bezet')] },
  { id: 'rekruut', name: 'Rekruut', icon: '🗡️', color: '#6b8e23', top: [fx('goud', 1)], bottom: [fx('aanval', 1), fx('terugroep', 1)] },

  // Winkelkaarten, per ras van goedkoop naar duur. Goedkope kaarten zonder Trek hebben iets speciaals
  // (een special, Offer bij het kopen of een huurling); dure kaarten hebben kleinere getallen maar meer rasbonussen.

  // 🕯️ Kultisten: offeren en vernietigen
  { id: 'ingewijde', name: 'Ingewijde', price: 2, icon: '🧎', color: '#7a2333', onBuy: [fx('offer', 1)], top: [fx('goud', 1)], bottom: [fx('aanval', 2)] },
  { id: 'asverzamelaar', name: 'Asverzamelaar', price: 3, icon: '⚱️', color: '#5a2a2a', top: [fx('trek', 1)], bottom: [special('asoogst')] },
  { id: 'bloedzuster', name: 'Bloedzuster', price: 3, icon: '🩸', color: '#9b1c2e', onBuy: [fx('offer', 1)], top: [fx('goud', 1)], bottom: [fx('aanval', 2), na('offer', fx('aanval', 3))] },
  { id: 'vuurprediker', name: 'Vuurprediker', price: 4, icon: '🔥', color: '#b33a1f', onBuy: [fx('offer', 1)], top: [fx('storm', 1)], bottom: [fx('aanval', 3), fx('schenk', 1)] },
  { id: 'zielenoogster', name: 'Zielenoogster', price: 5, icon: '💀', color: '#3b1f2b', top: [fx('trek', 1), fx('goud', 1)], bottom: [special('zielenoogst')] },
  { id: 'offerpriester', name: 'Offerpriester', price: 5, icon: '📿', color: '#6e1423', top: [fx('offer', 1), fx('trek', 1)], bottom: [fx('aanval', 2), na('vernietig', fx('aanval', 4))] },
  { id: 'bloedfenix', name: 'Bloedfenix', price: 6, icon: '🐦‍🔥', color: '#c2410c', top: [fx('goud', 2)], bottom: [fx('aanval', 3), special('wedergeboorte')] },
  { id: 'sekteleider', name: 'Sekteleider', price: 7, icon: '👁️', color: '#4a0f1c', top: [fx('offer', 2), fx('goud', 2)], bottom: [fx('aanval', 2), special('offerkracht')] },
  { id: 'demonenroeper', name: 'Demonenroeper', price: 8, icon: '😈', color: '#5b0e2d', top: [fx('storm', 1), fx('offer', 1)], bottom: [fx('vernietig', 0), fx('aanval', 3), als('kultist', fx('aanval', 3))] },
  { id: 'ontwaaktegod', name: 'Ontwaakte God', price: 10, icon: '🌑', color: '#2a0a14', top: [fx('storm', 2), fx('offer', 1)], bottom: [fx('aanval', 4), special('offerkracht'), als('kultist', fx('storm', 1))] },

  // 👺 Goblins: veel goud en grote kaarten
  { id: 'zakkenroller', name: 'Zakkenroller', price: 2, icon: '🤏', color: '#557a2b', top: [fx('goud', 1), fx('ververs', 0)], bottom: [special('diefstal'), fx('aanval', 1)] },
  { id: 'deurtrapper', name: 'Deurtrapper', price: 2, icon: '🚪', color: '#6b7a2b', top: [fx('goud', 2)], bottom: [special('ram'), fx('aanval', 1)] },
  { id: 'huurgoblin', name: 'Huurgoblin', price: 3, icon: '⚔️', color: '#4f6b1f', top: [fx('goud', 1)], bottom: [fx('aanval', 4), special('huur')] },
  { id: 'schatgraver', name: 'Schatgraver', price: 3, icon: '⛏️', color: '#7a6a1f', top: [fx('trek', 1), fx('goud', 1)], bottom: [fx('goud', 3)] },
  { id: 'goudhamer', name: 'Goudhamer', price: 4, icon: '🔨', color: '#a68a1f', top: [fx('goud', 2)], bottom: [fx('aanval', 1), special('goudslag')] },
  { id: 'goblinbende', name: 'Goblinbende', price: 5, icon: '👥', color: '#3f6b2b', top: [fx('goud', 2), fx('trek', 1)], bottom: [fx('aanval', 3), als('goblin', fx('aanval', 3))] },
  { id: 'opperbaas', name: 'Opperbaas', price: 6, icon: '🪖', color: '#5a4a1a', top: [fx('goud', 3)], bottom: [fx('aanval', 4), na('groot', fx('aanval', 3))] },
  { id: 'goudalchemist', name: 'Goudalchemist', price: 7, icon: '⚗️', color: '#8a7a10', top: [special('dubbelgoud')], bottom: [fx('aanval', 3), als('goblin', fx('goud', 3))] },
  { id: 'goblinkanon', name: 'Goblinkanon', price: 8, icon: '💣', color: '#3a4a1a', top: [fx('storm', 2), fx('verban', 1)], bottom: [fx('aanval', 5), als('goblin', fx('storm', 2))] },
  { id: 'schatdraak', name: 'Schatdraak', price: 10, icon: '🐉', color: '#6b5a0f', top: [fx('goud', 3), fx('storm', 1)], bottom: [fx('aanval', 4), special('goudslag'), als('goblin', fx('schild', 4))] },

  // 🥷 Sluipmoordenaars: veel trekken en terugroepen
  { id: 'sluiper', name: 'Sluiper', price: 2, icon: '👤', color: '#3a3560', top: [fx('trek', 1)], bottom: [fx('aanval', 1), fx('terugroep', 1)] },
  { id: 'dolkwerper', name: 'Dolkwerper', price: 3, icon: '🎯', color: '#463a7a', top: [fx('trek', 1), fx('echo', 0)], bottom: [fx('aanval', 2), fx('terugroep', 1)] },
  { id: 'schaduwloper', name: 'Schaduwloper', price: 3, icon: '🌘', color: '#2e2a5c', top: [fx('trek', 1), fx('goud', 1)], bottom: [fx('aanval', 1), fx('trek', 1), fx('terugroep', 1)] },
  { id: 'gifmenger', name: 'Gifmenger', price: 4, icon: '🧪', color: '#4a2d6b', top: [fx('trek', 2)], bottom: [fx('aanval', 2), fx('vertraag', 1)] },
  { id: 'nachtmes', name: 'Nachtmes', price: 4, icon: '🌙', color: '#262252', top: [fx('trek', 1)], bottom: [fx('aanval', 2), na('terugroep', fx('aanval', 3))] },
  { id: 'spion', name: 'Spion', price: 5, icon: '🕵️', color: '#3d3a5c', top: [fx('trek', 2), fx('goud', 1)], bottom: [fx('trek', 2), fx('terugroep', 2)] },
  { id: 'schimmenmeester', name: 'Schimmenmeester', price: 5, icon: '👻', color: '#4b3f7a', top: [fx('trek', 1), fx('echo', 0)], bottom: [fx('echo', 0), als('sluip', fx('aanval', 4))] },
  { id: 'meestermoordenaar', name: 'Meestermoordenaar', price: 7, icon: '🗡️', color: '#1f1a40', top: [fx('trek', 2)], bottom: [fx('aanval', 3), fx('terugroep', 1), na('trek', fx('aanval', 3))] },
  { id: 'schaduwkoningin', name: 'Schaduwkoningin', price: 9, icon: '🦇', color: '#2a1f4a', top: [fx('trek', 3)], bottom: [fx('terugroep', 2), special('schaduwslag'), als('sluip', fx('trek', 2))] },
  { id: 'grootmeester', name: 'Grootmeester', price: 10, icon: '🌀', color: '#15112e', top: [fx('trek', 2), fx('storm', 1)], bottom: [fx('echo', 0), fx('aanval', 3), special('handkracht')] },

  // 🧙‍♀️ Heksen: herstel, vloeken en vertragen
  { id: 'kruidenvrouw', name: 'Kruidenvrouw', price: 2, icon: '🌿', color: '#2e6b4f', top: [fx('trek', 1)], bottom: [fx('herstel', 3)] },
  { id: 'vloekfluisteraar', name: 'Vloekfluisteraar', price: 3, icon: '🪬', color: '#4a2d5c', top: [fx('trek', 1), fx('vervloek', 1)], bottom: [fx('aanval', 2), fx('vertraag', 1)] },
  { id: 'moerasheks', name: 'Moerasheks', price: 3, icon: '🐸', color: '#4e5d2a', top: [fx('goud', 1),fx('verban', 1)], bottom: [fx('aanval', 1), special('vloekschade')] },
  { id: 'vorstheks', name: 'Vorstheks', price: 4, icon: '❄️', color: '#2a6b8a', top: [fx('vertraag', 1), fx('trek', 1)], bottom: [fx('aanval', 3), als('heks', fx('vertraag', 2))] },
  { id: 'genezeres', name: 'Genezeres', price: 4, icon: '💚', color: '#2e7d5a', top: [fx('trek', 1)], bottom: [fx('herstel', 3), fx('schild', 2)] },
  { id: 'wilgenheks', name: 'Wilgenheks', price: 5, icon: '🌳', color: '#3a6b3a', top: [fx('goud', 2)], bottom: [fx('herstel', 2), na('herstel', fx('aanval', 4))] },
  { id: 'voodoopriesteres', name: 'Voodoopriesteres', price: 5, icon: '🪆', color: '#6a1b4d', top: [fx('trek', 1), fx('vervloek', 1)], bottom: [fx('vervloek', 1), na('vervloek', fx('aanval', 4))] },
  { id: 'weerheks', name: 'Weerheks', price: 6, icon: '🌦️', color: '#1f5a6b', top: [fx('trek', 2)], bottom: [fx('herschep', 0), fx('herstel', 2), fx('vertraag', 1)] },
  { id: 'mistmoeder', name: 'Moeder van de Mist', price: 8, icon: '🌫️', color: '#2a4a5a', top: [fx('vertraag', 2), fx('trek', 1)], bottom: [fx('herstel', 3), fx('vertraag', 1), als('heks', fx('vervloek', 2))] },
  { id: 'heksenkoningin', name: 'Heksenkoningin', price: 10, icon: '👑', color: '#1a3a3a', top: [fx('vervloek', 2), fx('vertraag', 1)], bottom: [fx('herstel', 3), special('vloekschade'), als('heks', fx('vertraag', 2))] },
];

/** Engelse kaartnamen. Een kaart zonder vertaling hier houdt haar Nederlandse naam. */
const NAMES_EN: Record<string, string> = {
  koper: 'Copper Coin', zilver: 'Silver Coin', rekruut: 'Recruit', vloek: 'Curse',
  ingewijde: 'Initiate', asverzamelaar: 'Ash Gatherer', bloedzuster: 'Blood Sister', vuurprediker: 'Flame Preacher',
  zielenoogster: 'Soul Reaper', offerpriester: 'Sacrifice Priest', bloedfenix: 'Blood Phoenix', sekteleider: 'Cult Leader',
  demonenroeper: 'Demon Caller', ontwaaktegod: 'Awakened God',
  zakkenroller: 'Pickpocket', deurtrapper: 'Door Kicker', huurgoblin: 'Goblin for Hire', schatgraver: 'Treasure Digger',
  goudhamer: 'Gold Hammer', goblinbende: 'Goblin Gang', opperbaas: 'Warboss', goudalchemist: 'Gold Alchemist',
  goblinkanon: 'Goblin Cannon', schatdraak: 'Hoard Dragon',
  sluiper: 'Lurker', dolkwerper: 'Knife Thrower', schaduwloper: 'Shadow Walker', gifmenger: 'Poisoner',
  nachtmes: 'Night Blade', spion: 'Spy', schimmenmeester: 'Shade Master', meestermoordenaar: 'Master Assassin',
  schaduwkoningin: 'Shadow Queen', grootmeester: 'Grandmaster',
  kruidenvrouw: 'Herbalist', vloekfluisteraar: 'Hex Whisperer', moerasheks: 'Bog Witch', vorstheks: 'Frost Witch',
  genezeres: 'Healer', wilgenheks: 'Willow Witch', voodoopriesteres: 'Voodoo Priestess', weerheks: 'Storm Witch',
  mistmoeder: 'Mother of Mist', heksenkoningin: 'Witch Queen',
};

/** Het ras van elke winkelkaart. */
const RACE_OF: Record<string, Race> = Object.fromEntries(([
  ['kultist', ['ingewijde', 'asverzamelaar', 'bloedzuster', 'vuurprediker', 'zielenoogster', 'offerpriester', 'bloedfenix', 'sekteleider', 'demonenroeper', 'ontwaaktegod']],
  ['goblin', ['zakkenroller', 'deurtrapper', 'huurgoblin', 'schatgraver', 'goudhamer', 'goblinbende', 'opperbaas', 'goudalchemist', 'goblinkanon', 'schatdraak']],
  ['sluip', ['sluiper', 'dolkwerper', 'schaduwloper', 'gifmenger', 'nachtmes', 'spion', 'schimmenmeester', 'meestermoordenaar', 'schaduwkoningin', 'grootmeester']],
  ['heks', ['kruidenvrouw', 'vloekfluisteraar', 'moerasheks', 'vorstheks', 'genezeres', 'wilgenheks', 'voodoopriesteres', 'weerheks', 'mistmoeder', 'heksenkoningin']],
] as [Race, string[]][]).flatMap(([race, ids]) => ids.map((id) => [id, race])));

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

/**
 * De tafelversie (om later met echte kaarten te spelen) vervangt deze keywords op elke kaart:
 * Echo wordt Trek 1, Herschep wordt Aanval 1, Schenk(x) wordt Terugroep(x).
 */
export const TAFEL_IN_PLAATS: Partial<Record<Keyword, Keyword>> = { echo: 'trek', herschep: 'aanval', schenk: 'terugroep' };

/**
 * Een helft van een kaart zoals ze in dit spel werkt: in de tafelversie met de vervangingen uit TAFEL_IN_PLAATS.
 * Staat hetzelfde keyword (zonder rasvoorwaarde) al op de helft, dan telt de vervanging erbij op: Aanval 2 + Aanval 1 = Aanval 3.
 */
export function cardHalf(half: Effect[], tafel: boolean): Effect[] {
  if (!tafel || !half.some((e) => TAFEL_IN_PLAATS[e.kw as Keyword])) return half;
  const out: Effect[] = [];
  for (const e of half) {
    const kw = TAFEL_IN_PLAATS[e.kw as Keyword];
    const n = e.kw === 'schenk' && 'amount' in e ? e.amount : 1;
    const next: Effect = kw ? { kw, amount: n, ...(e.need ? { need: e.need } : {}) } : e;
    // Samenvoegen met een gelijk keyword zonder voorwaarde, vóór of na deze plek.
    const same = (x: Effect) => x.kw === next.kw && x.kw !== 'speciaal' && !x.need && !next.need;
    const i = out.findIndex(same);
    if (i >= 0 && 'amount' in next) out[i] = { ...out[i], amount: (out[i] as { amount: number }).amount + next.amount } as Effect;
    else out.push(next);
  }
  return out;
}

const expand = (counts: [string, number][]) => counts.flatMap(([id, n]) => Array<string>(n).fill(id));

/** Beginstapel van 10 kaarten; beide spelers krijgen dezelfde. */
export const STARTER_DECK = expand([['koper', 5], ['rekruut', 3], ['zilver', 2]]);

/** De gedeelde voorraad van de winkel: goedkope kaarten 3 keer, dure 1 of 2 keer. */
export const SHOP_SUPPLY = expand([
  ['ingewijde', 3], ['asverzamelaar', 3], ['bloedzuster', 3], ['vuurprediker', 3], ['zielenoogster', 2], ['offerpriester', 2],
  ['bloedfenix', 2], ['sekteleider', 2], ['demonenroeper', 1], ['ontwaaktegod', 1],
  ['zakkenroller', 3], ['deurtrapper', 3], ['huurgoblin', 3], ['schatgraver', 3], ['goudhamer', 3], ['goblinbende', 2],
  ['opperbaas', 2], ['goudalchemist', 2], ['goblinkanon', 1], ['schatdraak', 1],
  ['sluiper', 3], ['dolkwerper', 3], ['schaduwloper', 3], ['gifmenger', 3], ['nachtmes', 3], ['spion', 2],
  ['schimmenmeester', 2], ['meestermoordenaar', 2], ['schaduwkoningin', 1], ['grootmeester', 1],
  ['kruidenvrouw', 3], ['vloekfluisteraar', 3], ['moerasheks', 3], ['vorstheks', 3], ['genezeres', 3], ['wilgenheks', 2],
  ['voodoopriesteres', 2], ['weerheks', 2], ['mistmoeder', 1], ['heksenkoningin', 1],
]);
