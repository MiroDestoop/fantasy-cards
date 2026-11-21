import { CARDS } from './cards';
import { getSpecial } from './specials';
import type { CardDef, Effect, Keyword, Race } from './types';

// Vaste kaarten alleen voor de tests: zo hangen de tests van de spelregels niet af van de echte kaarten,
// die vaak veranderen. Het zijn de kaarten van vóór de vier rassen, met hun oude ids.
const fx = (kw: Keyword, amount: number): Effect => ({ kw, amount });
const als = (race: Race, e: Effect): Effect => ({ ...e, need: race });
const special = (id: string): Effect => (getSpecial(id), { kw: 'speciaal', id });

const TEST_CARDS: CardDef[] = [
  { id: 'vuurbal', name: 'Vuurgooier', price: 4, icon: '🔥', race: 'kultist', color: '#555', top: [fx('storm', 1)], bottom: [fx('aanval', 4), als('kultist', fx('storm', 1))] },
  { id: 'trol', name: 'Trollenmoker', price: 5, icon: '👹', race: 'kultist', color: '#555', top: [fx('trek', 2)], bottom: [fx('aanval', 2), als('kultist', fx('aanval', 5))] },
  { id: 'draak', name: 'Drakenrijder', price: 8, icon: '🐉', race: 'kultist', color: '#555', top: [fx('storm', 3)], bottom: [fx('aanval', 7), als('kultist', fx('aanval', 3))] },
  { id: 'uil', name: 'Uilenhoeder', price: 3, icon: '🦉', race: 'sluip', color: '#555', top: [fx('trek', 1), fx('goud', 1)], bottom: [fx('aanval', 1), fx('trek', 1), als('sluip', fx('verban', 1))] },
  { id: 'inzicht', name: 'Sterrenlezer', price: 5, icon: '🔭', race: 'sluip', color: '#555', top: [fx('trek', 2)], bottom: [fx('aanval', 2), fx('trek', 2)] },
  { id: 'zandloper', name: 'Mummie', price: 6, icon: '🧟', race: 'kultist', color: '#555', top: [fx('vertraag', 2)], bottom: [fx('aanval', 2), als('sluip',fx('vertraag', 3))] },
  { id: 'golem', name: 'Runengolem', price: 4, icon: '🗿', race: 'heks', color: '#555', top: [fx('goud', 2)], bottom: [fx('schild', 4), als('heks', fx('schild', 3))] },
  { id: 'bron', name: 'Woudgenezeres', price: 3, icon: '🌿', race: 'sluip', color: '#555', top: [fx('trek', 1)], bottom: [fx('herstel', 4)] },
  { id: 'schat', name: 'Dwergenschat', price: 5, icon: '👑', race: 'heks', color: '#555', top: [fx('goud', 4)], bottom: [fx('aanval', 2), als('heks', fx('goud', 5))] },
  { id: 'offervuur', name: 'Bloedpriester', price: 4, icon: '🩸', race: 'kultist', color: '#555', top: [fx('trek', 1)], bottom: [fx('vernietig', 0), fx('aanval', 3)] },
  { id: 'marskramer', name: 'Marskramer', price: 2, icon: '🛒', race: 'goblin', color: '#555', top: [fx('goud', 2), fx('ververs', 0)], bottom: [fx('aanval', 2), als('goblin', fx('trek', 2))] },
  { id: 'generaal', name: 'Generaal', price: 7, icon: '🎖️', race: 'goblin', color: '#555', top: [fx('goud', 3),fx('trek', 1)], bottom: [fx('terugroep', 3), als('goblin', fx('aanval', 6))] },
  { id: 'schildknaap', name: 'Schildknaap', price: 2, icon: '🛡️', race: 'goblin', color: '#555', top: [fx('goud', 1)], bottom: [fx('schild', 3), als('goblin', fx('schild', 2))] },
  { id: 'pestdrager', name: 'Pestdrager', price: 3, icon: '🐀', race: 'kultist', color: '#555', top: [fx('verban', 1),fx('trek', 1)], bottom: [fx('aanval', 2), fx('schenk', 1)] },
  { id: 'alchemist', name: 'Alchemist', price: 6, icon: '⚗️', race: 'heks', color: '#555', top: [special('dubbelgoud')], bottom: [fx('aanval', 3)] },
  { id: 'huurling', name: 'Huurling', price: 4, icon: '⚔️', race: 'kultist', color: '#555', top: [fx('goud', 1)], bottom: [fx('aanval', 4), special('huur')] },
  { id: 'poortbeuker', name: 'Poortbeuker', price: 2, icon: '🪵', race: 'goblin', color: '#555', top: [fx('goud', 2)], bottom: [special('ram'),] },
  { id: 'ram', name: 'Belegeringsram', price: 4, icon: '🐏', race: 'goblin', color: '#555', top: [fx('goud', 2),fx('verban', 1)], bottom: [special('ram'), fx('aanval', 2)] },
  { id: 'fenix', name: 'Knekelfenix', price: 6, icon: '🐦‍🔥', race: 'kultist', color: '#555', top: [fx('goud', 2)], bottom: [fx('aanval', 3), special('wedergeboorte')] },
  { id: 'goblin', name: 'Goblin', price: 2, icon: '👺', race: 'kultist', color: '#555', top: [fx('goud', 1)], bottom: [special('diefstal')] },
  { id: 'landmeter', name: 'Landmeter', price: 4, icon: '🧭', race: 'goblin', color: '#555', top: [fx('goud', 2),fx('trek', 1)], bottom: [fx('herschep', 0), fx('aanval', 2)] },
  { id: 'portaal', name: 'Aardvormer', price: 6, icon: '🌋', race: 'heks', color: '#555', top: [fx('trek', 2), fx('verban', 1)], bottom: [fx('herschep', 0), fx('aanval', 3)] },
  { id: 'weermaker', name: 'Weermaker', price: 7, icon: '🌦️', race: 'sluip', color: '#555', top: [fx('goud', 5), fx('verban', 1)], bottom: [fx('herschep', 0), fx('aanval', 3), fx('schild', 4)] },
  { id: 'dodenbezweerder', name: 'Dodenbezweerder', price: 5, icon: '⚰️', race: 'kultist', color: '#555', top: [fx('trek', 1), fx('goud', 2)], bottom: [special('zielenoogst'), als('kultist', fx('trek', 1))] },
  { id: 'windloper', name: 'Windloper', price: 3, icon: '🌬️', race: 'sluip', color: '#555', top: [fx('goud', 1), fx('echo', 0)], bottom: [fx('aanval', 2)] },
  { id: 'schaduwdanser', name: 'Schaduwdanser', price: 4, icon: '🥷', race: 'sluip', color: '#555', top: [fx('vervloek', 1), fx('goud', 2)], bottom: [fx('aanval', 2), fx('echo', 0), fx('terugroep', 1)] },
  { id: 'tijdmagier', name: 'Tijdmagiër', price: 5, icon: '🕰️', race: 'sluip', color: '#555', top: [fx('trek', 1), fx('echo', 0)], bottom: [fx('echo', 0), als('sluip', fx('aanval', 6))] },
  { id: 'lich', name: 'Lich', price: 8, icon: '🦴', race: 'kultist', color: '#555', top: [fx('storm', 2), fx('vervloek', 2)], bottom: [fx('aanval', 5), fx('vervloek', 2)] },
  { id: 'mammoet', name: 'Oorlogsmammoet', price: 7, icon: '🦣', race: 'heks', color: '#555', top: [fx('goud', 4), fx('trek', 2)], bottom: [fx('aanval', 3), fx('schild', 5)] },
  { id: 'aartsmagier', name: 'Aartsmagiër', price: 8, icon: '🧙', race: 'goblin', color: '#555', top: [fx('trek', 4)], bottom: [fx('storm', 3), fx('trek', 2)] },
  { id: 'titaan', name: 'Bergkoning', price: 9, icon: '🏔️', race: 'heks', color: '#555', top: [fx('trek', 2), fx('storm', 2)], bottom: [fx('terugroep', 2), fx('schild', 5), als('heks', fx('aanval', 10))] },
  { id: 'leegte', name: 'Zielenvreter', price: 9, icon: '🕳️', race: 'kultist', color: '#555', top: [fx('storm', 2), fx('vertraag', 3)], bottom: [fx('vernietig', 0),fx('vertraag', 3)] },
  { id: 'meteoor', name: 'Sterrenroeper', price: 11, icon: '☄️', race: 'sluip', color: '#555', top: [fx('storm', 5), fx('vervloek', 1)], bottom: [fx('storm', 7)] },
  { id: 'drakenkoning', name: 'Drakenkoning', price: 12, icon: '🐲', race: 'kultist', color: '#555', top: [fx('storm', 4), fx('trek', 1)], bottom: [fx('aanval', 10), fx('schild', 6)] },
];

for (const def of TEST_CARDS) CARDS[def.id] = def;
