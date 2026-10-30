// Maakt printbare kaarten voor de tafelversie: een PDF per taal in ideeen/print/.
// Starten met: npm run kaarten  (gebruikt Microsoft Edge om de HTML naar PDF om te zetten)
// Elke kaart staat er zo vaak in als je ze nodig hebt; 9 kaarten per A4 (63 × 88 mm, pokerformaat).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CARDS, KEYWORDS, RACE_IDS, RACES, SHOP_SUPPLY, STARTER_DECK, TAFEL_IN_PLAATS, cardHalf, getCard } from '../src/game/cards';
import { setLang, tr, type Lang } from '../src/game/i18n';
import { getSpecial } from '../src/game/specials';
import type { CardDef, Effect, Keyword } from '../src/game/types';
import { TAFEL_ZONE_EFFECTS, ZONE_EFFECTS, ZONE_NAMES, makeZone, zoneName } from '../src/game/zones';

const SPELERS = 2;
/** Zoveel Vloeken liggen klaar (zie ideeen/reallife-versie.md). */
const VLOEKEN = 10;
const UIT = resolve('ideeen/print');
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Hoeveel exemplaren van elke kaart je drukt, in de volgorde van de PDF. */
function aantallen(): [CardDef, number][] {
  const tel = (lijst: string[]) => lijst.reduce((m, id) => m.set(id, (m.get(id) ?? 0) + 1), new Map<string, number>());
  const start = [...tel(STARTER_DECK)].map(([id, n]): [CardDef, number] => [getCard(id), n * SPELERS]);
  const winkel = [...tel(SHOP_SUPPLY)]
    .map(([id, n]): [CardDef, number] => [getCard(id), n])
    .sort(([a], [b]) => RACE_IDS.indexOf(a.race!) - RACE_IDS.indexOf(b.race!) || a.price! - b.price!);
  return [...start, [getCard('vloek'), VLOEKEN], ...winkel];
}

function kwHtml(effects: Effect[]): string {
  return effects
    .map((e) => {
      const pre = e.need ? RACES[e.need].icon : '';
      const cls = e.need ? ' cond' : '';
      if (e.kw === 'speciaal') return `<span class="kw kw-speciaal${cls}">${pre}${esc(getSpecial(e.id).text)}</span>`;
      const kw = KEYWORDS[e.kw];
      return `<span class="kw kw-${e.kw}${cls}">${pre}${kw.noAmount ? kw.label : `${kw.label} ${e.amount}`}</span>`;
    })
    .join(' ');
}

function kaart(def: CardDef): string {
  const labels = def.price === undefined;
  const helft = (cls: string, label: string, fx: Effect[]) => `
    <div class="sect ${cls}">${labels ? `<div class="sect-label">${label}</div>` : ''}<div class="kws">${kwHtml(cardHalf(fx, true))}</div></div>`;
  return `<div class="card">
    <div class="art" style="--art:${def.color}">${def.icon}
      ${def.price !== undefined ? `<span class="price">${def.price}</span>` : ''}
      ${def.race ? `<span class="race">${RACES[def.race].icon}</span>` : ''}
    </div>
    <div class="card-name">${esc(def.name)}</div>
    ${helft('sect-top', `⤓ ${tr('Afleggen', 'Discard')}`, def.top)}
    ${def.bottom.length
      ? helft('sect-bottom', `⚔ ${tr('In een zone', 'In a zone')}`, def.bottom)
      : `<div class="sect sect-none"><div class="sect-label">${tr('Alleen afleggen', 'Discard only')}</div></div>`}
  </div>`;
}

/** De zonekaarten van de tafelversie: elke kaart een zonenaam (sfeer) en een effect. */
function zoneKaarten(): string[] {
  return TAFEL_ZONE_EFFECTS.map((id, i) => {
    const eff = ZONE_EFFECTS[id];
    const naam = ZONE_NAMES[i % ZONE_NAMES.length];
    const zone = makeZone(naam, id);
    return `<div class="card zone">
      <div class="art" style="--art:#4a6b3a">${naam.icon}</div>
      <div class="card-name">${esc(zoneName(naam))}</div>
      <div class="sect sect-zone"><div class="zone-eff">${eff.icon} ${esc(eff.label)}</div><div class="zone-text">${esc(eff.text)}</div></div>
      <div class="zone-hp">❤️ ${zone.hp} ${tr('levens', 'health')}</div>
    </div>`;
  });
}

function overzicht(lijst: [CardDef, number][]): string {
  const rij = ([d, n]: [CardDef, number]) =>
    `<tr><td>${d.icon} ${esc(d.name)}</td><td>${d.race ? `${RACES[d.race].icon} ${RACES[d.race].label}` : tr('start', 'starter')}</td><td>${d.price ?? '–'}</td><td><b>${n}</b></td></tr>`;
  const totaal = lijst.reduce((s, [, n]) => s + n, 0) + TAFEL_ZONE_EFFECTS.length;
  const helft = Math.ceil(lijst.length / 2);
  const tabel = (deel: [CardDef, number][]) => `<table><tr><th>${tr('Kaart', 'Card')}</th><th>${tr('Ras', 'Race')}</th><th>${tr('Prijs', 'Price')}</th><th>${tr('Aantal', 'Count')}</th></tr>${deel.map(rij).join('')}</table>`;
  return `<section class="page text">
    <h1>Munt of Zwaard – ${tr('kaarten voor de tafelversie', 'cards for the tabletop edition')}</h1>
    <p>${tr(
      `${totaal} kaarten: de beginstapels van ${SPELERS} spelers, ${VLOEKEN} Vloeken, de winkelvoorraad en ${TAFEL_ZONE_EFFECTS.length} zonekaarten. Elke kaart staat zo vaak in deze PDF als je ze nodig hebt. Druk op 100% (niet "passend maken"), dan zijn de kaarten 63 × 88 mm.`,
      `${totaal} cards: the starting decks of ${SPELERS} players, ${VLOEKEN} Curses, the shop supply and ${TAFEL_ZONE_EFFECTS.length} zone cards. Every card appears in this PDF as many times as you need it. Print at 100% (not "fit to page") and the cards are 63 × 88 mm.`,
    )}</p>
    <p>${tr(
      'Tafelregels op de kaarten: Echo is Trek 1, Herschep is Aanval 1, Schenk(x) is Terugroep(x).',
      'Tabletop rules on the cards: Echo is Draw 1, Reshape is Attack 1, Gift(x) is Recall(x).',
    )}</p>
    <div class="cols">${tabel(lijst.slice(0, helft))}${tabel(lijst.slice(helft))}</div>
  </section>`;
}

function keywordBlad(): string {
  const weg = new Set(Object.keys(TAFEL_IN_PLAATS));
  const rijen = (Object.keys(KEYWORDS) as Keyword[])
    .filter((k) => !weg.has(k))
    .map((k) => `<tr><td><span class="kw kw-${k}">${KEYWORDS[k].label}${KEYWORDS[k].noAmount ? '' : ' x'}</span></td><td>${esc(KEYWORDS[k].explain(NaN).replace(/NaN/g, 'x'))}</td></tr>`)
    .join('');
  return `<section class="page text">
    <h1>${tr('Keywords', 'Keywords')}</h1>
    <table class="kwtab">${rijen}</table>
    <p>${tr(
      'Een effect met een rasicoon ervoor (gestippelde rand) werkt alleen als er al een kaart van dat ras van jou in de zone ligt.',
      'An effect with a race icon in front (dashed border) only works if one of your cards of that race is already in the zone.',
    )}</p>
  </section>`;
}

function html(lang: Lang): string {
  setLang(lang);
  const lijst = aantallen();
  const kaarten = [...lijst.flatMap(([d, n]) => Array<string>(n).fill(kaart(d))), ...zoneKaarten()];
  const vellen: string[] = [];
  for (let i = 0; i < kaarten.length; i += 9) vellen.push(`<section class="page sheet">${kaarten.slice(i, i + 9).join('')}</section>`);
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>Munt of Zwaard</title><style>${CSS}</style></head>
    <body>${overzicht(lijst)}${keywordBlad()}${vellen.join('')}</body></html>`;
}

const CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: Georgia, 'Segoe UI', serif, 'Segoe UI Emoji'; color: #2b1d10; }
.page { width: 210mm; height: 297mm; page-break-after: always; overflow: hidden; }
.text { padding: 14mm; font-size: 10pt; }
.text h1 { font-size: 16pt; margin: 0 0 4mm; }
.cols { display: flex; gap: 6mm; align-items: flex-start; }
table { border-collapse: collapse; width: 100%; font-size: 8.5pt; }
th, td { text-align: left; padding: 0.6mm 1.5mm; border-bottom: 0.2mm solid #ccc; }
.kwtab td { vertical-align: top; padding: 1.5mm; }
.kwtab td:first-child { white-space: nowrap; }
.sheet { display: grid; grid-template-columns: repeat(3, 63mm); grid-auto-rows: 88mm; justify-content: center; align-content: center; }
.card { width: 63mm; height: 88mm; outline: 0.2mm dashed #aaa; padding: 3mm; display: flex; flex-direction: column; gap: 1.5mm;
  background: linear-gradient(180deg, #f3e3bf, #d9c08e); border: 2mm solid #6b4a24; border-radius: 4mm; }
.art { position: relative; height: 24mm; flex-shrink: 0; border-radius: 3mm; display: grid; place-items: center; font-size: 15mm;
  border: 0.6mm solid rgba(0,0,0,.35);
  background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--art) 60%, white), var(--art) 55%, color-mix(in srgb, var(--art) 45%, black)); }
.race { position: absolute; top: 1mm; right: 1mm; width: 8mm; height: 8mm; display: grid; place-items: center; font-size: 5mm;
  border-radius: 50%; background: rgba(20,12,4,.55); }
.price { position: absolute; top: 1mm; left: 1mm; width: 8mm; height: 8mm; display: grid; place-items: center; font: bold 4.5mm Georgia, serif;
  border-radius: 50%; color: #3a2a00; background: radial-gradient(circle at 35% 35%, #ffe680, #c9a227 70%, #8a6a00); border: 0.4mm solid #6b4a00; }
.card-name { font-size: 11pt; font-weight: bold; text-align: center; line-height: 1.1; }
.sect { flex: 1; border-radius: 2mm; padding: 1mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1mm; }
.sect-top { background: rgba(166,124,0,.16); border: 0.3mm solid rgba(166,124,0,.5); }
.sect-bottom { background: rgba(142,42,42,.13); border: 0.3mm solid rgba(142,42,42,.5); }
.sect-none { background: rgba(0,0,0,.06); border: 0.3mm dashed rgba(43,29,16,.3); }
.sect-none .sect-label { font-style: italic; opacity: .5; }
.sect-label { font-size: 6.5pt; text-transform: uppercase; letter-spacing: .1em; opacity: .7; }
.kws { display: flex; flex-wrap: wrap; justify-content: center; gap: 1mm; }
.kw { padding: 0.3mm 2mm; border-radius: 1.5mm; border-bottom: 0.6mm solid rgba(0,0,0,.35); background: var(--edge); color: #fff;
  font: bold 9.5pt 'Segoe UI', sans-serif, 'Segoe UI Emoji'; }
.kw.cond { outline: 0.4mm dashed rgba(255,255,255,.85); outline-offset: -0.7mm; }
.kw-goud { --edge: #a67c00; } .kw-aanval { --edge: #8e2a2a; } .kw-storm { --edge: #c62828; } .kw-herstel { --edge: #2e7d4f; }
.kw-schild { --edge: #546e8a; } .kw-trek { --edge: #6a3d8f; } .kw-vertraag { --edge: #0277bd; } .kw-vernietig { --edge: #37474f; }
.kw-terugroep { --edge: #5d4037; } .kw-ververs { --edge: #ad1457; } .kw-verban { --edge: #c62828; } .kw-vervloek { --edge: #7b1fa2; }
.kw-verdwijn { --edge: #5c4a6e; } .kw-betaal { --edge: #b8860b; } .kw-herschep { --edge: #2e7d32; } .kw-echo { --edge: #4f8a8b; } .kw-schenk { --edge: #6a4c93; }
.kw-speciaal { --edge: #4a2c6e; padding: 0.6mm 1.5mm; font-size: 8pt; font-weight: normal; font-style: italic; line-height: 1.15; text-align: center; }
.zone { background: linear-gradient(180deg, #e3ecd0, #b9c99a); border-color: #3e5a2e; }
.sect-zone { background: rgba(62,90,46,.12); border: 0.3mm solid rgba(62,90,46,.5); text-align: center; padding: 2mm; }
.zone-eff { font-weight: bold; font-size: 11pt; }
.zone-text { font-size: 8.5pt; line-height: 1.25; }
.zone-hp { text-align: center; font-weight: bold; font-size: 10pt; }
`;

if (!EDGE) throw new Error('Geen Edge of Chrome gevonden om de PDF te maken.');
mkdirSync(UIT, { recursive: true });
for (const lang of ['nl', 'en'] as Lang[]) {
  const bron = resolve(UIT, `kaarten-${lang}.html`);
  const pdf = resolve(UIT, `kaarten-${lang}.pdf`);
  writeFileSync(bron, html(lang));
  execFileSync(EDGE, ['--headless', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, pathToFileURL(bron).href], { stdio: 'ignore' });
  console.log(`${pdf} (${Object.keys(CARDS).length} kaartsoorten)`);
}
