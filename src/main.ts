import './style.css';
import { AI_LEVELS, chooseAction, type AiLevel } from './game/ai';
import { cardHalf, CARDS, getCard, KEYWORDS, RACES, STARTER_DECK } from './game/cards';
import { getSpecial } from './game/specials';
import {
  applyAction, createGame, drawOverflow, other, recallPrice, shopPrice, whyCantBuy, whyCantPlay, zonesOwnedBy,
} from './game/engine';
import { FIRST_HAND_SIZE, GAMES_TO_WIN_MATCH, HAND_SIZE, MAX_HAND, MAX_ZONE_CARDS, RECALL_PRICE, ZONE_HP, ZONES_TO_WIN } from './game/rules';
import type { Action, CardDef, CardInstance, Effect, GameState, Keyword, PlayerId, PlayTarget, Race } from './game/types';
import { hostRoom, joinRoom, makeCode, PROTOCOL, type Link, type Msg } from './online';
import { isMuted, sfx, toggleMute } from './sound';
import { cardsWord, getLang, setLang, tr, type Lang } from './game/i18n';
import { zoneCapacity, ZONE_EFFECTS, zoneEffect, zoneName } from './game/zones';
import { ZONE_ART } from './zoneArt';

const HERO_ICONS = ['🧙‍♂️', '🧝‍♀️'] as const;
const COMPUTER_ICON = '🤖';
/** In een spel tegen de computer is de mens speler 0 en de computer speler 1. */
const COMPUTER: PlayerId = 1;
/** Wachttijd van de computer vóór haar eerste zet en tussen haar zetten, zodat je kunt volgen wat ze doet. */
const COMPUTER_THINK_MS = 1000;
const COMPUTER_STEP_MS = 750;
const LEVEL_KEY = 'fantasy-cards-niveau';
const TAFEL_KEY = 'fantasy-cards-tafel';
const LANG_KEY = 'fantasy-cards-taal';
const STAGE_W = 1600;
const STAGE_H = 900;
const CARD_W = 150;
const CARD_H = 210;
/** Breedte van de handzone tussen spelerinfo en stapels (zie .hand.mine in style.css). */
const HAND_WIDTH = 640;

const stage = document.querySelector<HTMLDivElement>('#stage')!;
const app = document.querySelector<HTMLDivElement>('#app')!;
const toastEl = document.querySelector<HTMLDivElement>('#toast')!;
const tipEl = document.querySelector<HTMLDivElement>('#tip')!;

setLang(loadLang());
let names: [string, string] = [defaultName(0), defaultName(1)];
/** Speel je tegen de computer in plaats van tegen een tweede speler aan dezelfde tafel? */
let vsComputer = false;
/** Testspel: een gewoon spel tegen de computer, maar met de knop 🧪 neem je eender welke kaart in je hand. */
let testGame = false;
/** Het venster met alle kaarten staat open. */
let testPicker = false;
let testCount = 0;
/** Het niveau van de computer; onthouden voor de volgende keer. */
let computerLevel: AiLevel = loadLevel();
/** Tafelversie: de eenvoudigere regels om later met echte kaarten te spelen; onthouden voor de volgende keer. */
let tafelversie = loadTafel();
let game: GameState | null = null;
/** Verhoogt bij elk nieuw spel, zodat een geplande zet van de computer uit een oud spel niets meer doet. */
let gameId = 0;
/** Op een gedeeld scherm: de speler die het scherm moet krijgen voor diens hand zichtbaar wordt. */
let handoff: PlayerId | null = null;
/** Een zet die meer zou trekken dan de handlimiet: eerst vragen of je zeker bent. */
let pendingPlay: { action: Extract<Action, { type: 'play' }>; lost: number } | null = null;
/** Voor animaties: wat stond er bij de vorige weergave op tafel? */
let prevRendered: GameState | null = null;
const seenZoneCards = new Set<string>();
/** Handkaarten die al getekend waren: nieuwe kaarten vliegen van de stapel naar je hand. */
let seenHandCards = new Set<string>();
/** Hoeveel kaarten de tegenstander bovenaan vorige keer in de hand had (om nieuwe ruggen te laten aanvliegen). */
let lastOppHand: { pid: PlayerId; n: number } | null = null;
let scale = 1;

/** Een match is best-of-3. Spel 1: toeval beslist wie begint; spel 2: de andere speler; spel 3: wie spel 2 verloor. */
interface Match {
  wins: [number, number];
  /** Het spel dat nu loopt (of net gedaan is); 0 voor het eerste spel. */
  gameNo: number;
  firstStarter: PlayerId | null;
  lastWinner: PlayerId | null;
}
let match: Match = newMatch();

/** Online: het startscherm toont de tab "Online" en, na verbinden, de verbinding met de tegenstander. */
let onlineTab = false;
interface Net {
  /** De host is speler 0, de gast speler 1. */
  me: PlayerId;
  code: string;
  status: 'opening' | 'waiting' | 'joining' | 'playing';
  link: Link | null;
  stop: () => void;
  /** De gast vroeg het volgende spel en wacht op de host. */
  waitingNext: boolean;
}
let net: Net | null = null;
/** Namen in het online spel: [host, gast]. */
let netNames: [string, string] = ['Host', 'Gast'];
/** Online kiest de host of het spel in de tafelversie gaat. */
let netTafel = false;
let netError = '';
/** Een kamercode uit de link (?kamer=ABCD) wordt alvast ingevuld. */
let codeFromLink = new URLSearchParams(location.search).get('kamer')?.toUpperCase() ?? '';
if (codeFromLink) onlineTab = true;

// ---------- Weergave ----------

function render(): void {
  hideTip();
  app.innerHTML = game ? renderGame(game) : renderStart();
  if (game) playDraws(game);
}

function renderStart(): string {
  return `
  <div class="start">
    ${renderLangButton()}
    <h1>${tr('Munt of Zwaard', 'Coin or Sword')}</h1>
    <p class="subtitle">${tr('Een fantasy-kaartduel aan één tafel, online, of tegen de computer', 'A fantasy card duel at one table, online, or against the computer')}</p>
    <div class="mode">
      <button class="${!vsComputer && !onlineTab ? 'on' : ''}" data-click="mode:pvp">👥 ${tr('Twee spelers', 'Two players')}</button>
      <button class="${onlineTab ? 'on' : ''}" data-click="mode:online">🌐 Online</button>
      <button class="${vsComputer && !testGame ? 'on' : ''}" data-click="mode:ai">${COMPUTER_ICON} ${tr('Tegen de computer', 'Against the computer')}</button>
      <button class="${testGame ? 'on' : ''}" data-click="mode:test" title="${tr(
        'Een gewoon spel tegen de computer, maar met een knop om eender welke kaart in je hand te nemen',
        'A normal game against the computer, but with a button to take any card into your hand',
      )}">🧪 ${tr('Testspel', 'Test game')}</button>
    </div>
    <div class="mode variant">
      <button class="${tafelversie ? '' : 'on'}" data-click="tafel:0">🃏 ${tr('Gewone versie', 'Normal version')}</button>
      <button class="${tafelversie ? 'on' : ''}" data-click="tafel:1" title="${tr(
        'De eenvoudigere regels om met echte kaarten te spelen',
        'The simpler rules for playing with real cards',
      )}">🎲 ${tr('Tafelversie', 'Table version')}</button>
    </div>
    ${tafelversie
      ? `<p class="level-note">🎲 ${tr(
        'Echo wordt Trek 1, Herschep wordt Aanval 1, Schenk wordt Terugroep. Geen terugtrekken (↩), eenvoudige zones en alle rassen.',
        'Echo becomes Draw 1, Reshape becomes Attack 1, Give becomes Recall. No withdrawing (↩), simple zones and all races.',
      )}${onlineTab ? ` ${tr('Online kiest wie de kamer maakt.', 'Online, whoever creates the room decides.')}` : ''}</p>`
      : ''}
    ${onlineTab ? renderOnlineStart() : `${vsComputer
      ? `<div class="mode levels">${AI_LEVELS.map((l) =>
          `<button class="${l.id === computerLevel ? 'on' : ''}" data-click="level:${l.id}">${l.icon} ${l.label}</button>`).join('')}</div>
        ${levelInfo().bonusGold
          ? `<p class="level-note">${levelInfo().icon} ${tr(
            `${levelInfo().label} speelt zoals Extreem, maar krijgt elke beurt ${levelInfo().bonusGold} extra goud.`,
            `${levelInfo().label} plays like Extreme, but gets ${levelInfo().bonusGold} extra gold every turn.`,
          )}</p>`
          : ''}`
      : ''}
    <div class="names">
      <label>${vsComputer ? tr('Jouw naam', 'Your name') : tr('Speler 1', 'Player 1')} <input id="name0" maxlength="16" value="${esc(names[0])}"></label>
      ${vsComputer
        ? `<label>${tr('Tegenstander', 'Opponent')} <div class="computer-name">${levelInfo().icon} ${esc(computerName())}</div></label>`
        : `<label>${tr('Speler 2', 'Player 2')} <input id="name1" maxlength="16" value="${esc(names[1])}"></label>`}
    </div>
    <button class="btn" data-click="start">${tr('Aan tafel!', 'To the table!')}</button>`}
    <div class="rules">
      <h2>${tr('Zo speel je', 'How to play')}</h2>
      <ul>${tr(
        `<li>Verover <b>${ZONES_TO_WIN} van de 3 zones</b> om te winnen. Een zone is van jou als je er als eerste haar levens vol schade doet (meestal ${ZONE_HP}).</li>
        <li>Elk spel krijg je andere zones, elk met een <b>speciaal effect</b>: meer of minder levens, meer of minder schade, goud of een extra kaart, korting in de winkel, minder plaats, of juist tol betalen. Hover over het effect onder de zonenaam voor de uitleg.</li>
        <li>Je speelt een <b>best-of-3</b>: wie eerst ${GAMES_TO_WIN_MATCH} spellen wint, wint de match. Elke speler begint minstens één spel.</li>
        <li>Elke beurt trek je ${HAND_SIZE} kaarten (de beginspeler in de allereerste beurt maar ${FIRST_HAND_SIZE}). Elke kaart heeft twee helften:
          sleep ze naar je <b>aflegstapel</b> voor het bovenste effect, of naar een <b>zone</b> voor het onderste.</li>
        <li>Kaarten in een zone blijven liggen, maximaal ${MAX_ZONE_CARDS} per speler per zone.
          Met <b>Terugroep</b> haal je ze terug naar je aflegstapel, met <b>Vernietig</b> verban je ze uit het spel.
          Of klik op <b>↩</b> bij een eigen kaart om ze terug te trekken voor ${RECALL_PRICE} goud; elke keer wordt dat 1 goud duurder.</li>
        <li>Met goud koop je sterkere kaarten in de winkel. Is je stapel leeg, dan wordt je aflegstapel geschud.</li>
        <li>Hover over een keyword zoals <b>Aanval(2)</b> om te zien wat het doet.</li>`,
        `<li>Conquer <b>${ZONES_TO_WIN} of the 3 zones</b> to win. A zone is yours when you are the first to fill its health with damage (usually ${ZONE_HP}).</li>
        <li>Every game has different zones, each with a <b>special effect</b>: more or less health, more or less damage, gold or an extra card, a shop discount, less room, or paying a toll. Hover over the effect below the zone name for details.</li>
        <li>You play a <b>best of 3</b>: whoever wins ${GAMES_TO_WIN_MATCH} games first wins the match. Each player starts at least one game.</li>
        <li>Every turn you draw ${HAND_SIZE} cards (the starting player only ${FIRST_HAND_SIZE} on the very first turn). Every card has two halves:
          drag it to your <b>discard pile</b> for the top effect, or into a <b>zone</b> for the bottom effect.</li>
        <li>Cards in a zone stay there, at most ${MAX_ZONE_CARDS} per player per zone.
          <b>Recall</b> returns them to your discard pile, <b>Destroy</b> banishes them from the game.
          Or click <b>↩</b> on one of your cards to withdraw it for ${RECALL_PRICE} gold; each time that costs 1 gold more.</li>
        <li>With gold you buy stronger cards in the shop. When your deck is empty, your discard pile is shuffled.</li>
        <li>Hover over a keyword such as <b>Attack(2)</b> to see what it does.</li>`,
      )}
      </ul>
    </div>
  </div>`;
}

/** De taalknop: toont de andere taal, zodat je ziet waarnaar je wisselt. */
function renderLangButton(extra = ''): string {
  return `<button class="lang-toggle ${extra}" data-click="lang" title="${tr('Switch to English', 'Schakel naar Nederlands')}">
    ${getLang() === 'nl' ? '🇬🇧 English' : '🇳🇱 Nederlands'}
  </button>`;
}

function renderOnlineStart(): string {
  const error = netError ? `<p class="net-error">${esc(netError)}</p>` : '';
  if (!net) {
    return `
    <div class="names"><label>${tr('Jouw naam', 'Your name')} <input id="name0" maxlength="16" value="${esc(names[0])}"></label></div>
    ${error}
    <div class="online-choice">
      <div class="online-box">
        <b>${tr('Een kamer maken', 'Create a room')}</b>
        <p>${tr('Je krijgt een code die je aan je tegenstander geeft.', 'You get a code to give to your opponent.')}</p>
        <button class="btn" data-click="host">🏠 ${tr('Maak een kamer', 'Create a room')}</button>
      </div>
      <div class="online-box">
        <b>${tr('Meedoen', 'Join')}</b>
        <p>${tr('Typ de code die je kreeg.', 'Type the code you received.')}</p>
        <input id="code" class="code-input" maxlength="4" placeholder="ABCD" value="${esc(codeFromLink)}" autocomplete="off">
        <button class="btn" data-click="join">🚪 ${tr('Doe mee', 'Join')}</button>
      </div>
    </div>`;
  }
  const link = `${location.origin}${location.pathname}?kamer=${net.code}`;
  const body =
    net.status === 'opening' ? `<p>${tr('Kamer maken…', 'Creating room…')}</p>`
    : net.status === 'waiting'
      ? `<p>${tr('Geef deze code aan je tegenstander:', 'Give this code to your opponent:')}</p>
        <div class="room-code">${net.code}</div>
        <p class="room-link">${tr('of stuur de link', 'or send the link')} <b>${esc(link)}</b></p>
        <p class="waiting">${tr('Wachten op een tegenstander…', 'Waiting for an opponent…')}</p>`
      : `<p class="waiting">${tr('Verbinden met kamer', 'Connecting to room')} <b>${esc(net.code)}</b>…</p>`;
  return `<div class="online-box wide">${body}<button class="btn small" data-click="cancel-online">${tr('Annuleren', 'Cancel')}</button></div>`;
}

/** Onderaan zit de speler die aan zet is; tegen de computer of online zit jij altijd onderaan. */
function bottomSeat(g: GameState): PlayerId {
  if (net) return net.me;
  return vsComputer ? other(COMPUTER) : g.active;
}

/** Speelt de online tegenstander nu? */
function remoteTurn(g: GameState): boolean {
  return !!net && g.active !== net.me;
}

function computerTurn(g: GameState): boolean {
  return vsComputer && g.active === COMPUTER;
}

/** Mag de mens nu kaarten spelen, kopen of de beurt beëindigen? */
function humanCanAct(): boolean {
  return !!game && handoff === null && game.winner === null && !computerTurn(game) && !remoteTurn(game);
}

function heroIcon(pid: PlayerId): string {
  return vsComputer && pid === COMPUTER ? levelInfo().icon : HERO_ICONS[pid];
}

function renderGame(g: GameState): string {
  const bottom = bottomSeat(g);
  const top = other(bottom);
  const prev = prevRendered;
  prevRendered = g;
  const hidden = handoff !== null;
  const myTurn = humanCanAct();

  const html = `
  <div class="table">
    ${renderShop(g)}
    <div class="seat top">
      ${renderInfo(g, top)}
      <div class="hand opp">${renderBacks(g.players[top].hand.length, oppDrawnFrom(top, g.players[top].hand.length))}</div>
      ${renderPiles(g, top, false)}
    </div>
    <div class="zones">${g.zones.map((_, i) => renderZone(g, i, bottom, prev)).join('')}</div>
    <div class="seat bottom">
      ${myTurn ? renderDiscardAllButton(g) : ''}
      ${renderInfo(g, bottom)}
      <div class="hand mine">${hidden ? renderBacks(g.players[bottom].hand.length) : renderHand(g, bottom)}</div>
      ${renderPiles(g, bottom, myTurn)}
    </div>
    ${renderSidePanel(g)}
  </div>
  ${handoff !== null && g.winner === null ? renderHandoff(g, handoff) : ''}
  ${pendingPlay && g.winner === null ? renderConfirmDraw(pendingPlay.lost) : ''}
  ${testPicker && humanCanAct() ? renderTestPicker() : ''}
  ${g.winner !== null ? renderWinner(g) : ''}`;

  for (const z of g.zones) for (const c of z.cards) seenZoneCards.add(`${c.card.uid}@${c.turn}`);
  if (!hidden) seenHandCards = new Set(g.players[bottom].hand.map((c) => c.uid));
  return html;
}

function renderInfo(g: GameState, pid: PlayerId): string {
  const p = g.players[pid];
  return `
  <div class="info p${pid} ${pid === g.active ? 'active' : ''}">
    <div class="portrait">${heroIcon(pid)}</div>
    <div>
      <div class="player-name">${esc(p.name)}</div>
      <div class="badges">
        <span class="gold" title="${tr('Goud om kaarten te kopen in de winkel', 'Gold to buy cards in the shop')}">🪙 ${p.gold}</span>
        <span class="flags" title="${tr('Veroverde zones', 'Conquered zones')}">🚩 ${zonesOwnedBy(g, pid)}/${ZONES_TO_WIN}</span>
        ${p.bonusGold ? `<span class="bonus" title="${tr(`Bonus: krijgt elke beurt ${p.bonusGold} extra goud`, `Bonus: gets ${p.bonusGold} extra gold every turn`)}">+${p.bonusGold} 🪙/${tr('beurt', 'turn')}</span>` : ''}
        ${p.echo ? `<span class="echo" title="${tr(
          `Je volgende ${p.echo > 1 ? `${p.echo} kaarten` : 'kaart'} in een zone keert na het effect meteen terug naar je aflegstapel`,
          `Your next ${p.echo > 1 ? `${p.echo} cards` : 'card'} in a zone returns to your discard pile right after its effect`,
        )}">🌬️ ${p.echo}</span>` : ''}
        ${p.slow ? `<span class="slow" title="${tr(`Trekt volgende beurt ${cardsWord(p.slow)} minder`, `Draws ${cardsWord(p.slow)} fewer next turn`)}">⏳ −${p.slow}</span>` : ''}
      </div>
    </div>
  </div>`;
}

function renderDiscardAllButton(g: GameState): string {
  const hand = g.players[g.active].hand;
  if (!hand.length || g.winner !== null) return '';
  // Betaal (de Vloek) gaat van het goud af.
  const gold = hand.reduce(
    (t, c) => t + getCard(c.defId).top.reduce((s, e) => s + (e.kw === 'goud' ? e.amount : e.kw === 'betaal' ? -e.amount : 0), 0),
    0,
  );
  return `<button class="discard-all" data-click="discard-all"
    title="${tr(
      `Speel alle ${hand.length} kaarten in je hand af op je aflegstapel en krijg hun bovenste effect`,
      `Discard all ${hand.length} cards in your hand and get their top effect`,
    )}">
    ⤓ ${tr('Alles afleggen', 'Discard all')}${gold ? ` <span>${gold > 0 ? '+' : '−'}${Math.abs(gold)} 🪙</span>` : ''}
  </button>`;
}

function renderPiles(g: GameState, pid: PlayerId, mine: boolean): string {
  const p = g.players[pid];
  // Wat je deze beurt speelde, ligt bovenop de aflegstapel maar telt pas mee na Einde beurt.
  const topDiscard = p.played.at(-1) ?? p.discard.at(-1);
  const stackDepth = Math.min(3, Math.ceil(p.deck.length / 4));
  const played = p.played.length
    ? `<div class="pile-played" title="${tr(
      `${p.played.length} deze beurt gespeeld: ze gaan bij Einde beurt naar de aflegstapel`,
      `${p.played.length} played this turn: they go to the discard pile at End turn`,
    )}">+${p.played.length}</div>`
    : '';
  return `
  <div class="piles">
    <div class="pile deck" data-pile="deck:${pid}">
      ${p.deck.length ? `<div class="stack">${'<div class="back"></div>'.repeat(stackDepth)}</div>` : '<div class="empty-slot"></div>'}
      <div class="pile-count">${p.deck.length}</div>
      <div class="pile-label">${tr('Stapel', 'Deck')}</div>
    </div>
    <div class="pile discard" ${mine ? 'data-drop="discard"' : ''} data-pile="discard:${pid}">
      ${topDiscard ? renderMini(getCard(topDiscard.defId)) : '<div class="empty-slot"></div>'}
      <div class="pile-count">${p.discard.length}</div>
      ${played}
      <div class="pile-label">${tr('Aflegstapel', 'Discard')}</div>
    </div>
  </div>`;
}

function renderHand(g: GameState, pid: PlayerId): string {
  const hand = g.players[pid].hand;
  const n = hand.length;
  // De kaarten schuiven verder over elkaar naarmate de hand groeit, zodat ze altijd tussen de stapels passen.
  const step = n > 1 ? Math.min(CARD_W - 16, (HAND_WIDTH - CARD_W) / (n - 1)) : 0;
  const overlap = step - CARD_W;
  return hand
    .map((card, i) => {
      const off = i - (n - 1) / 2;
      // De slot blijft stil liggen en vangt de muis op; alleen de kaart erin beweegt bij hover.
      const drawn = !seenHandCards.has(card.uid);
      return `<div class="slot ${drawn ? 'drawn' : ''}" data-drag="${card.uid}"
        style="--rot:${off * 3.5}deg;--drop:${off * off * 2.2}px;--overlap:${overlap}px">
        <div class="card">${renderFace(getCard(card.defId))}</div>
      </div>`;
    })
    .join('');
}

function keywordText(kw: Keyword, n: number): string {
  return KEYWORDS[kw].noAmount ? KEYWORDS[kw].label : `${KEYWORDS[kw].label}(${n})`;
}

function renderKeywords(effects: Effect[]): string {
  return effects
    .map((e) => {
      // Een rasvoorwaarde staat als icoon voor het effect.
      const need = e.need ? ` data-need="${e.need}"` : '';
      const cls = e.need ? ' cond' : '';
      const pre = e.need ? `${RACES[e.need].icon}` : '';
      return e.kw === 'speciaal'
        ? `<span class="kw kw-speciaal${cls}" data-special="${e.id}"${need}>${pre}${esc(getSpecial(e.id).text)}</span>`
        : `<span class="kw kw-${e.kw}${cls}" data-kw="${e.kw}" data-n="${e.amount}"${need}>${pre}${keywordText(e.kw, e.amount)}</span>`;
    })
    .join(' ');
}

/** De uitleg van een rasvoorwaarde, onder de uitleg van het effect. */
function needText(race: string | undefined): string {
  if (!race) return '';
  const r = RACES[race as Race];
  return `<div class="tip-note">${r.icon} ${tr(
    `Alleen als er al een ${r.label} van jou in deze zone ligt.`,
    `Only if one of your ${r.plural} is already in this zone.`,
  )}</div>`;
}

function raceTip(race: Race): string {
  const r = RACES[race];
  const out = game?.outRace === race;
  return `<b>${r.icon} ${r.label}</b><br>${tr(`Deze kaart is een ${r.label}.`, `This card is a ${r.label}.`)}
    ${out ? `<div class="tip-note">🚫 ${tr(`De ${r.plural} doen dit spel niet mee.`, `The ${r.plural} sit out this game.`)}</div>` : ''}`;
}

function renderFace(def: CardDef): string {
  const tafel = !!game?.tafel;
  // Alleen de startkaarten tonen "Afleggen" en "In een zone": zo leer je het spel. Op de andere kaarten
  // is die plaats nodig voor de effecten; de kleur van elke helft toont welke welke is.
  const labels = STARTER_DECK.includes(def.id) || def.id === 'vloek';
  return `
    <div class="art" style="--art:${def.color}">${def.icon}${def.race ? `<span class="race" data-race="${def.race}">${RACES[def.race].icon}</span>` : ''}</div>
    <div class="card-name">${esc(def.name)}</div>
    <div class="sect sect-top ${labels ? '' : 'no-label'}">
      ${labels ? `<div class="sect-label">⤓ ${tr('Afleggen', 'Discard')}</div>` : ''}
      <div class="kws">${renderKeywords(cardHalf(def.top, tafel))}</div>
    </div>
    ${def.bottom.length
      ? `<div class="sect sect-bottom ${labels ? '' : 'no-label'}">
          ${labels ? `<div class="sect-label">⚔ ${tr('In een zone', 'In a zone')}</div>` : ''}
          <div class="kws">${renderKeywords(cardHalf(def.bottom, tafel))}</div>
        </div>`
      : `<div class="sect sect-none"><div class="sect-label">${tr('Alleen afleggen', 'Discard only')}</div></div>`}`;
}

function renderMini(def: CardDef): string {
  return `<div class="mini" style="--art:${def.color}" title="${esc(def.name)}">${def.icon}</div>`;
}

/** drawnFrom: vanaf deze kaart zijn de ruggen nieuw getrokken en vliegen ze van de stapel aan. */
function renderBacks(n: number, drawnFrom = n): string {
  let html = '';
  for (let i = 0; i < n; i++) html += `<div class="back ${i >= drawnFrom ? 'drawn' : ''}"></div>`;
  return `<div class="backs">${html}</div>`;
}

function oppDrawnFrom(pid: PlayerId, n: number): number {
  const last = lastOppHand;
  lastOppHand = { pid, n };
  return last && last.pid === pid && n > last.n ? last.n : n;
}

/** Nieuw getrokken kaarten vliegen één voor één van de stapel naar hun plaats in de hand en draaien open. */
function playDraws(g: GameState): void {
  const bottom = bottomSeat(g);
  const seats: [string, PlayerId, number][] = [['.hand.mine .slot.drawn', bottom, 1], ['.hand.opp .back.drawn', other(bottom), -1]];
  for (const [sel, pid, dir] of seats) {
    const deck = app.querySelector(`[data-pile="deck:${pid}"]`)?.getBoundingClientRect();
    if (!deck) continue;
    app.querySelectorAll<HTMLElement>(sel).forEach((el, i) => {
      const r = el.getBoundingClientRect();
      // De tegenstander zit ondersteboven (rotate 180deg): daar keert de verschuiving om.
      const dx = ((deck.left + deck.width / 2 - (r.left + r.width / 2)) / scale) * dir;
      const dy = ((deck.top + deck.height / 2 - (r.top + r.height / 2)) / scale) * dir;
      el.animate(
        [
          { translate: `${dx}px ${dy}px`, scale: '0.45', rotate: 'y 90deg', opacity: 0.3 },
          { translate: `${dx * 0.35}px ${dy * 0.35 - 60}px`, scale: '0.9', rotate: 'y 0deg', opacity: 1, offset: 0.55 },
          { translate: '0 0', scale: '1', rotate: 'y 0deg', opacity: 1 },
        ],
        { duration: 480, delay: i * 90, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'backwards' },
      );
    });
  }
}

function renderZone(g: GameState, i: number, bottom: PlayerId, prev: GameState | null): string {
  const z = g.zones[i];
  const fx = zoneEffect(z);
  const top = other(bottom);
  // Je eigen kaarten in een open zone kan je tijdens je beurt terugtrekken voor goud.
  const canRecall = z.owner === null && humanCanAct() && !g.tafel;
  const price = recallPrice(g, bottom);
  const row = (pid: PlayerId) => {
    const mine = z.cards.filter((c) => c.player === pid);
    const cards = mine
      .map((c) => {
        const isNew = !seenZoneCards.has(`${c.card.uid}@${c.turn}`);
        const recall = canRecall && pid === bottom
          ? `<button class="recall ${price <= g.players[bottom].gold ? '' : 'too-expensive'}" data-click="recall:${i}:${c.card.uid}"
              data-recall="${c.card.uid}">↩ ${price} 🪙</button>`
          : '';
        return `<div class="zslot" data-zcard="${c.card.uid}"><div class="card ${isNew ? (pid === bottom ? 'enter-up' : 'enter-down') : ''}">${renderFace(getCard(c.card.defId))}</div>${recall}</div>`;
      })
      .join('');
    // Vaste vakjes tonen in één oogopslag hoeveel plaats er nog is.
    const free = Math.max(0, zoneCapacity(z) - mine.length);
    const empty = `<div class="zslot empty p${pid}"></div>`.repeat(free);
    const full = z.owner === null && free === 0;
    return `<div class="zrow ${full ? 'full' : ''}" title="${esc(g.players[pid].name)}: ${tr(
      `${mine.length} van ${zoneCapacity(z)} plaatsen bezet`,
      `${mine.length} of ${zoneCapacity(z)} slots taken`,
    )}">${cards}${empty}</div>`;
  };
  const bar = (pid: PlayerId) => {
    const dmg = z.damage[pid];
    const before = prev && prev !== g ? prev.zones[i].damage[pid] : dmg;
    const d = dmg - before;
    return `
    <div class="bar p${pid} ${z.shield[pid] ? 'shielded' : ''}" title="${esc(g.players[pid].name)}: ${tr(`${dmg} van ${z.hp} schade`, `${dmg} of ${z.hp} damage`)}">
      <div class="fill ${d ? 'grow' : ''}" style="width:${(dmg / z.hp) * 100}%;--from:${(before / z.hp) * 100}%"></div>
      <span class="bar-text">${esc(g.players[pid].name)} · ${dmg}/${z.hp}</span>
      ${(() => {
        // Het schild staat als groot wapenschild naast de balk; het springt op als het groeit en flitst als het schade tegenhoudt.
        const sh = z.shield[pid];
        const was = prev && prev !== g ? prev.zones[i].shield[pid] : sh;
        const blocked = Math.max(0, was - sh);
        const flash = blocked ? `<div class="float block">🛡️ −${blocked}</div>` : '';
        if (!sh) return flash;
        return `<span class="zshield ${sh > was ? 'up' : blocked ? 'hit' : ''}" title="${tr(
          `Schild van ${esc(g.players[pid].name)}: de volgende ${sh} schade van de tegenstander in deze zone wordt tegengehouden`,
          `${esc(g.players[pid].name)}'s shield: the next ${sh} damage from the opponent in this zone is blocked`,
        )}"><b>${sh}</b></span>${flash}`;
      })()}
      ${d ? `<div class="float ${d > 0 ? 'dmg' : 'heal'}">${d > 0 ? '+' : ''}${d}</div>` : ''}
    </div>`;
  };
  return `
  <div class="zone-area ${z.owner !== null ? 'closed' : ''}" data-drop="zone:${i}">
    <div class="zone-art">${ZONE_ART[z.name] ?? ''}</div>
    <div class="zcards">${row(top)}</div>
    <div class="zone-mid">
      ${bar(top)}
      <div class="zone-name">${z.icon} ${esc(zoneName(z))}</div>
      ${fx ? `<div class="zone-fx zfx-${fx.id} ${prev && prev !== g && prev.zones[i].effect !== z.effect ? 'fx-new' : ''}" data-zfx="${fx.id}">${fx.icon} ${esc(fx.label)}</div>` : ''}
      ${bar(bottom)}
    </div>
    <div class="zcards">${row(bottom)}</div>
    ${z.owner !== null
      ? `<div class="zone-banner p${z.owner}">
          <div class="zone-banner-name">${z.icon} ${esc(zoneName(z))}</div>
          <div>🚩 ${tr('Veroverd door', 'Conquered by')}</div>
          <b>${esc(g.players[z.owner].name)}</b>
        </div>`
      : ''}
  </div>`;
}

function renderShop(g: GameState): string {
  const canShop = humanCanAct();
  // Met een Verban van deze beurt krijgt elke winkelkaart een knop om ze weg te sturen.
  const banish = canShop ? g.players[g.active].banish : 0;
  const slots = g.shop.market
    .map((card, i) => {
      const def = getCard(card.defId);
      const affordable = canShop && !whyCantBuy(g, card.uid);
      return `<div class="shop-slot ${affordable ? 'affordable' : ''} ${banish ? 'banishable' : ''} ${shopDeal ? 'deal-in' : shopRefill.has(card.uid) ? 'refill' : ''}" style="--i:${i}" data-click="buy:${card.uid}">
        <div class="card">${renderFace(def)}</div>
        ${banish ? `<button class="banish-btn" data-click="banish:${card.uid}" title="${tr(
          `Verban ${def.name}: ze gaat onderaan de voorraad en wordt vervangen`,
          `Banish ${def.name}: it goes to the bottom of the supply and is replaced`,
        )}">✖</button>` : ''}
        ${(() => {
          // Een Handelspost waar de speler aan zet voorstaat, maakt de kaart goedkoper.
          const price = shopPrice(g, g.active, card.defId);
          return price < (def.price ?? 0)
            ? `<div class="price discount" title="${tr(
              `Prijs in goud: ${price} in plaats van ${def.price} (Handelspost)`,
              `Price in gold: ${price} instead of ${def.price} (Trading Post)`,
            )}">${price}</div>`
            : `<div class="price" title="${tr('Prijs in goud', 'Price in gold')}">${def.price}</div>`;
        })()}
      </div>`;
    })
    .join('');
  return `
  <div class="shop">
    <div class="shop-title">🏪 ${tr('Winkel', 'Shop')}</div>
    ${banish ? `<div class="banish-hint">✖ ${tr(
      `Kies ${banish === 1 ? 'een kaart' : `${banish} kaarten`} om te verbannen`,
      `Pick ${banish === 1 ? 'a card' : `${banish} cards`} to banish`,
    )}</div>` : ''}
    <div class="market">${slots || `<div class="sold-out">${tr('Uitverkocht!', 'Sold out!')}</div>`}</div>
    <div class="shop-stock">${tr(`${g.shop.pile.length} in voorraad`, `${g.shop.pile.length} in stock`)}</div>
  </div>`;
}

function renderSidePanel(g: GameState): string {
  const p = g.players[g.active];
  const locked = !humanCanAct();
  const thinking = (computerTurn(g) || remoteTurn(g)) && g.winner === null;
  return `
  <div class="side-panel">
    <div class="match-score" title="${tr(
      `Best-of-3: wie eerst ${GAMES_TO_WIN_MATCH} spellen wint, wint de match`,
      `Best of 3: whoever wins ${GAMES_TO_WIN_MATCH} games first wins the match`,
    )}">
      ${tr(`Spel ${match.gameNo} van 3`, `Game ${match.gameNo} of 3`)}<br>${renderScore(g)}
    </div>
    <div class="turn-info ${thinking ? 'thinking' : ''}">${tr('Beurt', 'Turn')} ${g.turn}<br>${thinking
      ? computerTurn(g)
        ? `${levelInfo().icon} ${tr(`<b>${esc(p.name)}</b> denkt na…`, `<b>${esc(p.name)}</b> is thinking…`)}`
        : `🌐 ${tr(`<b>${esc(p.name)}</b> is aan zet…`, `<b>${esc(p.name)}</b> is playing…`)}`
      : tr(`<b>${esc(p.name)}</b> is aan zet`, `<b>${esc(p.name)}</b> to play`)}</div>
    <button class="end-turn" data-click="end-turn" ${locked ? 'disabled' : ''}>${tr('Einde<br>beurt', 'End<br>turn')}</button>
    ${testGame ? `<button class="test-open" data-click="test-open" ${locked ? 'disabled' : ''}
      title="${tr('Neem eender welke kaart in je hand', 'Take any card into your hand')}">🧪 Test</button>` : ''}
    <div class="hint">${tr(
      `Sleep een kaart naar je <b>aflegstapel</b> (bovenste effect) of naar een <b>zone</b> (onderste effect).
      Hover over een stapel om te zien wat erin zit.${g.tafel ? '' : ' Hover over je kaart in een zone om ze terug te trekken (↩).'}`,
      `Drag a card to your <b>discard pile</b> (top effect) or into a <b>zone</b> (bottom effect).
      Hover over a pile to see what is in it.${g.tafel ? '' : ' Hover over your card in a zone to withdraw it (↩).'}`,
    )}</div>
    ${g.tafel ? `<div class="out-race">🎲 ${tr('Tafelversie', 'Table version')}</div>` : ''}
    ${g.outRace ? `<div class="out-race" data-race="${g.outRace}">🚫 ${RACES[g.outRace].icon} ${tr(`Zonder ${RACES[g.outRace].plural}`, `No ${RACES[g.outRace].plural}`)}</div>` : ''}
    <div class="log">${g.log.slice(-16).reverse().map((l) => `<div>${esc(l)}</div>`).join('')}</div>
    <div class="side-buttons">
      <button class="sound-toggle" data-click="sound">${isMuted() ? `🔇 ${tr('Geluid uit', 'Sound off')}` : `🔊 ${tr('Geluid aan', 'Sound on')}`}</button>
      ${renderLangButton('small')}
    </div>
  </div>`;
}

function renderHandoff(g: GameState, to: PlayerId): string {
  return `
  <div class="overlay">
    <div class="panel">
      <div class="big-icon">${heroIcon(to)}</div>
      <h2>${tr(`${esc(g.players[to].name)}, jij bent aan zet`, `${esc(g.players[to].name)}, it's your turn`)}</h2>
      <p>${tr('De andere speler kijkt even weg 🙈', 'The other player looks away for a moment 🙈')}</p>
      <button class="btn" data-click="continue">${tr('Toon mijn hand', 'Show my hand')}</button>
    </div>
  </div>`;
}

function renderConfirmDraw(lost: number): string {
  return `
  <div class="overlay">
    <div class="panel">
      <div class="big-icon">✋</div>
      <h2>${tr('Ben je zeker?', 'Are you sure?')}</h2>
      <p>${tr(
        `Je handlimiet is ${MAX_HAND}. Met deze kaart trek je ${cardsWord(lost)} te veel: ${lost > 1 ? 'die gaan' : 'die gaat'} meteen naar je aflegstapel.`,
        `Your hand limit is ${MAX_HAND}. With this card you draw ${cardsWord(lost)} too many: ${lost > 1 ? 'they go' : 'it goes'} straight to your discard pile.`,
      )}</p>
      <div class="buttons">
        <button class="btn" data-click="confirm-play">${tr('Toch spelen', 'Play anyway')}</button>
        <button class="btn secondary-plain" data-click="cancel-play">${tr('Annuleren', 'Cancel')}</button>
      </div>
    </div>
  </div>`;
}

/** Testspel: alle kaarten op een rij; een klik legt een kopie in je hand. */
function renderTestPicker(): string {
  return `
  <div class="overlay test-overlay">
    <div class="panel test-panel">
      <h2>🧪 ${tr('Neem een kaart', 'Take a card')}</h2>
      <p>${tr('Klik op een kaart om ze in je hand te nemen. Je kunt er meerdere nemen.', 'Click a card to take it into your hand. You can take several.')}</p>
      <div class="test-grid">${Object.values(CARDS).sort((a, b) => (a.price ?? 0) - (b.price ?? 0)).map((def) => `
        <div class="test-card" data-click="test-card:${def.id}">
          <div class="card">${renderFace(def)}</div>
          <div class="test-price">${def.price ? `${def.price} 🪙` : def.id === 'vloek' ? tr('vloek', 'curse') : tr('start', 'starter')}</div>
        </div>`).join('')}
      </div>
      <button class="btn" data-click="test-close">${tr('Klaar', 'Done')}</button>
    </div>
  </div>`;
}

function renderWinner(g: GameState): string {
  const w = g.winner as PlayerId;
  const zones = g.zones.filter((z) => z.owner === w).map((z) => `${z.icon} ${esc(zoneName(z))}`).join(tr(' en ', ' and '));
  const over = matchWinner() !== null;
  const starter = over ? null : nextStarter();
  const label = over
    ? `🔁 ${tr('Nieuwe match', 'New match')}`
    : `▶ ${tr(`Volgende spel · ${esc(g.players[starter!].name)} begint`, `Next game · ${esc(g.players[starter!].name)} starts`)}`;
  const next = net?.waitingNext
    ? `<p class="waiting">${tr('Wachten op', 'Waiting for')} ${esc(g.players[other(net.me)].name)}…</p>`
    : `<button class="btn" data-click="next-game">${label}</button>`;
  const name = esc(g.players[w].name);
  return `
  <div class="overlay">
    <div class="panel">
      <div class="big-icon">${vsComputer && w === COMPUTER ? levelInfo().icon : over ? '🏆' : '🚩'}</div>
      <h2>${over ? tr(`${name} wint de match!`, `${name} wins the match!`) : tr(`${name} wint spel ${match.gameNo}!`, `${name} wins game ${match.gameNo}!`)}</h2>
      <p>${tr('Veroverde', 'Conquered')} ${zones}.</p>
      <p class="match-line">${over ? tr('Eindstand', 'Final score') : tr('Stand', 'Score')}: ${renderScore(g)}</p>
      ${next}
      <button class="btn small secondary" data-click="restart">${net ? tr('Verlaten', 'Leave') : tr('Terug naar het begin', 'Back to the start')}</button>
    </div>
  </div>`;
}

function renderScore(g: GameState): string {
  return `<b class="p0">${esc(g.players[0].name)}</b> ${match.wins[0]} – ${match.wins[1]} <b class="p1">${esc(g.players[1].name)}</b>`;
}

// ---------- Klikken ----------

app.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-click]');
  const [kind, arg, arg2] = (el?.dataset.click ?? '').split(':');
  switch (kind) {
    case 'start':
      goFullscreen();
      startMatch();
      break;
    case 'mode':
      readNames();
      if (net) leaveOnline('');
      vsComputer = arg === 'ai' || arg === 'test';
      testGame = arg === 'test';
      onlineTab = arg === 'online';
      netError = '';
      render();
      break;
    case 'tafel':
      readNames();
      tafelversie = arg === '1';
      saveTafel();
      render();
      break;
    case 'level':
      readNames();
      computerLevel = arg as AiLevel;
      saveLevel();
      render();
      break;
    case 'restart':
      if (net) {
        leaveOnline('');
        break;
      }
      gameId++;
      game = null;
      prevRendered = null;
      render();
      break;
    case 'next-game':
      nextGame();
      break;
    case 'host':
      goFullscreen();
      startHosting();
      break;
    case 'join':
      goFullscreen();
      startJoining();
      break;
    case 'cancel-online':
      leaveOnline('');
      break;
    case 'continue':
      handoff = null;
      render();
      if (game) sfx.deal(game.players[game.active].hand.length);
      break;
    case 'lang':
      toggleLang();
      break;
    case 'sound':
      toggleMute();
      render();
      sfx.coin();
      break;
    case 'confirm-play': {
      const pending = pendingPlay;
      pendingPlay = null;
      if (pending && humanCanAct()) dispatch(pending.action);
      else render();
      break;
    }
    case 'test-open':
      if (testGame && humanCanAct()) {
        testPicker = true;
        render();
      }
      break;
    case 'test-close':
      testPicker = false;
      render();
      break;
    case 'test-card':
      if (testGame && game && humanCanAct()) {
        // Buiten de engine om: alleen in een testspel, nooit online.
        const g = structuredClone(game);
        const p = g.players[g.active];
        p.hand.push({ uid: `test-${++testCount}`, defId: arg });
        g.log.push(tr(`🧪 ${p.name} neemt ${getCard(arg).name} in de hand (test).`, `🧪 ${p.name} takes ${getCard(arg).name} into hand (test).`));
        game = g;
        render();
        sfx.coin();
      }
      break;
    case 'cancel-play':
      pendingPlay = null;
      render();
      break;
    case 'end-turn':
      if (humanCanAct()) dispatch({ type: 'endTurn' });
      break;
    case 'discard-all':
      if (humanCanAct()) dispatch({ type: 'discardAll' });
      break;
    case 'buy':
      if (humanCanAct()) dispatch({ type: 'buy', marketUid: arg });
      break;
    case 'recall':
      if (humanCanAct()) dispatch({ type: 'recall', zone: Number(arg), cardUid: arg2 });
      break;
    case 'banish':
      if (humanCanAct()) dispatch({ type: 'banish', marketUid: arg });
      break;
  }
});

// ---------- Slepen ----------

interface Drag {
  uid: string;
  slot: HTMLElement;
  startX: number;
  startY: number;
  ghost: HTMLElement | null;
  hover: HTMLElement | null;
}
let drag: Drag | null = null;

app.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !humanCanAct()) return;
  const slot = (e.target as HTMLElement).closest<HTMLElement>('[data-drag]');
  if (!slot) return;
  e.preventDefault();
  drag = { uid: slot.dataset.drag!, slot, startX: e.clientX, startY: e.clientY, ghost: null, hover: null };
});

window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.ghost) {
    // Pas beginnen met slepen na een kleine beweging, zodat een gewone klik niets doet.
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
    const ghost = drag.slot.querySelector('.card')!.cloneNode(true) as HTMLElement;
    ghost.classList.add('ghost');
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    drag.slot.classList.add('dragging');
    document.body.classList.add('is-dragging');
    hideTip();
    // Zones waar deze kaart niet heen kan (veroverd, vol, of alleen afleggen) lichten niet op.
    for (const el of app.querySelectorAll<HTMLElement>('.zone-area')) {
      el.classList.toggle('no-drop', !!game && !!whyCantPlay(game, drag.uid, parseDrop(el)!));
    }
  }
  // Met een vinger hangt de kaart boven je vingertop, anders zie je ze niet.
  const lift = e.pointerType === 'touch' ? CARD_H * scale * 1.1 : (CARD_H * scale) / 2;
  drag.ghost.style.transform =
    `translate(${e.clientX - (CARD_W * scale) / 2}px, ${e.clientY - lift}px) scale(${scale}) rotate(-4deg)`;
  const over = dropTargetAt(e.clientX, e.clientY);
  if (over !== drag.hover) {
    drag.hover?.classList.remove('drop-hover');
    over?.classList.add('drop-hover');
    drag.hover = over;
  }
});

window.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const d = drag;
  endDrag();
  if (!d.ghost) return;
  const target = parseDrop(dropTargetAt(e.clientX, e.clientY));
  if (!target || !game) return;
  const action = { type: 'play', handUid: d.uid, target } as const;
  // Zou je boven de handlimiet trekken? Dan eerst vragen (alleen als de zet zelf mag).
  const lost = whyCantPlay(game, d.uid, target) ? 0 : drawOverflow(game, d.uid, target);
  if (lost) {
    pendingPlay = { action, lost };
    render();
  } else dispatch(action);
});
window.addEventListener('pointercancel', endDrag);

function endDrag(): void {
  if (!drag) return;
  drag.ghost?.remove();
  drag.hover?.classList.remove('drop-hover');
  drag.slot.classList.remove('dragging');
  document.body.classList.remove('is-dragging');
  for (const el of app.querySelectorAll('.no-drop')) el.classList.remove('no-drop');
  drag = null;
}

function dropTargetAt(x: number, y: number): HTMLElement | null {
  return document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]') ?? null;
}

function parseDrop(el: HTMLElement | null): PlayTarget | null {
  const value = el?.dataset.drop;
  if (value === 'discard') return { kind: 'discard' };
  if (value?.startsWith('zone:')) return { kind: 'zone', zone: Number(value.slice(5)) };
  return null;
}

// ---------- Aanraakscherm ----------

/** Lang indrukken toont een kaart groot, met de uitleg van haar keywords. */
const LONG_PRESS_MS = 450;
let press: { timer: number; x: number; y: number } | null = null;
let previewEl: HTMLElement | null = null;
/** Na een groot getoonde kaart mag het loslaten geen klik worden (bv. een aankoop in de winkel). */
let swallowClick = false;

app.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
  const host = (e.target as HTMLElement).closest<HTMLElement>('.slot, .shop-slot, .zslot');
  const card = host?.querySelector<HTMLElement>(':scope > .card');
  if (!card) return;
  const timer = window.setTimeout(() => {
    press = null;
    endDrag();
    showPreview(card);
  }, LONG_PRESS_MS);
  press = { timer, x: e.clientX, y: e.clientY };
});
window.addEventListener('pointermove', (e) => {
  if (press && (drag?.ghost || Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10)) cancelPress();
});
function releasePress(): void {
  cancelPress();
  if (!previewEl) return;
  previewEl.remove();
  previewEl = null;
  swallowClick = true;
  window.setTimeout(() => (swallowClick = false), 400);
}
window.addEventListener('pointerup', releasePress);
window.addEventListener('pointercancel', releasePress);
app.addEventListener(
  'click',
  (e) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.stopPropagation();
    e.preventDefault();
  },
  true,
);
// Geen menu of tekstselectie bij lang indrukken.
app.addEventListener('contextmenu', (e) => e.preventDefault());

function cancelPress(): void {
  if (press) clearTimeout(press.timer);
  press = null;
}

function showPreview(card: HTMLElement): void {
  hideTip();
  const big = card.cloneNode(true) as HTMLElement;
  big.className = 'card preview-card';
  const size = Math.min((window.innerHeight * 0.8) / CARD_H, (window.innerWidth * 0.42) / CARD_W);
  big.style.setProperty('--s', String(size));
  const lines = [...card.querySelectorAll<HTMLElement>('[data-kw], [data-special]')].map((el) => {
    if (el.dataset.special) return `<div><b>✨ Speciaal</b><br>${esc(getSpecial(el.dataset.special).text)}${needText(el.dataset.need)}</div>`;
    const key = el.dataset.kw as Keyword;
    const n = Number(el.dataset.n);
    return `<div><b>${keywordText(key, n)}</b><br>${KEYWORDS[key].explain(n)}${needText(el.dataset.need)}</div>`;
  });
  previewEl = document.createElement('div');
  previewEl.className = 'preview';
  previewEl.innerHTML = `<div class="preview-holder" style="width:${CARD_W * size}px;height:${CARD_H * size}px"></div>
    <div class="preview-text">${[...new Set(lines)].join('')}</div>`;
  previewEl.querySelector('.preview-holder')!.appendChild(big);
  document.body.appendChild(previewEl);
}

/** Op een telefoon of tablet: volledig scherm en liggend, waar de browser dat toelaat. */
function goFullscreen(): void {
  const el = document.documentElement;
  if (!matchMedia('(pointer: coarse)').matches || document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen()
    .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
    .catch(() => {});
}

// ---------- Tooltips: uitleg bij keywords en inhoud van stapels ----------

app.addEventListener('mouseover', (e) => {
  if (drag?.ghost) return hideTip();
  const target = e.target as HTMLElement;
  const kw = target.closest<HTMLElement>('[data-kw]');
  const pile = target.closest<HTMLElement>('[data-pile]');
  const recall = target.closest<HTMLElement>('[data-recall]');
  const special = target.closest<HTMLElement>('[data-special]');
  const zfx = target.closest<HTMLElement>('[data-zfx]');
  const race = target.closest<HTMLElement>('[data-race]');
  if (race) {
    tipEl.innerHTML = raceTip(race.dataset.race as Race);
  } else if (zfx) {
    const fx = ZONE_EFFECTS[zfx.dataset.zfx as keyof typeof ZONE_EFFECTS];
    tipEl.innerHTML = `<b>${fx.icon} ${esc(fx.label)}</b><br>${esc(fx.text)}`;
  } else if (recall && game) {
    tipEl.innerHTML = recallTip(game, recall.dataset.recall!);
  } else if (special) {
    tipEl.innerHTML = `<b>✨ ${tr('Speciaal effect', 'Special effect')}</b><br>${esc(getSpecial(special.dataset.special!).text)}${needText(special.dataset.need)}
      <div class="tip-note">${tr('Dit effect heeft geen keyword: het hoort alleen bij deze kaart.', 'This effect has no keyword: it belongs to this card only.')}</div>`;
  } else if (kw) {
    const key = kw.dataset.kw as Keyword;
    const n = Number(kw.dataset.n);
    tipEl.innerHTML = `<b>${keywordText(key, n)}</b><br>${KEYWORDS[key].explain(n)}${needText(kw.dataset.need)}`;
  } else if (pile && game) {
    const [kind, pid] = pile.dataset.pile!.split(':');
    const p = game.players[Number(pid)];
    tipEl.innerHTML = kind === 'deck' ? pileTip(p.name, 'deck', p.deck) : pileTip(p.name, 'discard', p.discard, p.played);
  } else {
    return hideTip();
  }
  tipEl.classList.add('show');
});

function recallTip(g: GameState, uid: string): string {
  const zone = g.zones.find((z) => z.cards.some((c) => c.card.uid === uid));
  const card = zone?.cards.find((c) => c.card.uid === uid);
  const price = recallPrice(g, g.active);
  const gold = g.players[g.active].gold;
  const name = esc(card ? getCard(card.card.defId).name : tr('deze kaart', 'this card'));
  const where = esc(zone ? zoneName(zone) : tr('deze zone', 'this zone'));
  const short = gold < price ? `<div class="tip-note tip-warn">${tr(`Je hebt maar ${gold} goud.`, `You only have ${gold} gold.`)}</div>` : '';
  return tr(
    `<b>↩ Terugtrekken · ${price} goud</b><br>
    Stuur ${name} uit ${where} terug naar je aflegstapel. Zo maak je een plek vrij.
    <div class="tip-note">Elke keer dat je terugtrekt, wordt het 1 goud duurder. Daarna kost het ${price + 1} goud.</div>`,
    `<b>↩ Withdraw · ${price} gold</b><br>
    Send ${name} from ${where} back to your discard pile. This frees up a slot.
    <div class="tip-note">Each time you withdraw, it costs 1 gold more. Next time it costs ${price + 1} gold.</div>`,
  ) + short;
}

function pileTip(owner: string, kind: 'deck' | 'discard', cards: CardInstance[], played: CardInstance[] = []): string {
  const title = kind === 'deck'
    ? tr(`Stapel van ${esc(owner)} (${cards.length})`, `${esc(owner)}'s deck (${cards.length})`)
    : tr(`Aflegstapel van ${esc(owner)} (${cards.length})`, `${esc(owner)}'s discard pile (${cards.length})`);
  const rows = cards.length ? tipRows(cards) : `<br><i>${tr('Leeg', 'Empty')}</i>`;
  // De volgorde van de trekstapel blijft geheim; enkel wat erin zit, is te zien.
  const note = kind === 'deck' ? `<div class="tip-note">${tr('Volgorde blijft geheim', 'The order stays secret')}</div>` : '';
  const playedPart = played.length
    ? `<div class="tip-section"><b>${tr('Deze beurt gespeeld', 'Played this turn')} (${played.length})</b>${tipRows(played)}
        <div class="tip-note">${tr('Gaan bij Einde beurt naar de aflegstapel', 'Go to the discard pile at End turn')}</div></div>`
    : '';
  return `<b>${title}</b>${rows}${note}${playedPart}`;
}

function tipRows(cards: CardInstance[]): string {
  const counts = new Map<string, number>();
  for (const c of cards) counts.set(c.defId, (counts.get(c.defId) ?? 0) + 1);
  return [...counts]
    .map(([id, n]) => ({ def: getCard(id), n }))
    .sort((a, b) => b.n - a.n || a.def.name.localeCompare(b.def.name))
    .map(({ def, n }) => `<div class="tip-row"><span>${def.icon} ${esc(def.name)}</span><span>×${n}</span></div>`)
    .join('');
}
app.addEventListener('mouseleave', hideTip);
window.addEventListener('mousemove', (e) => {
  if (!tipEl.classList.contains('show')) return;
  const x = Math.min(e.clientX + 16, window.innerWidth - tipEl.offsetWidth - 8);
  const y = e.clientY - tipEl.offsetHeight - 14;
  tipEl.style.transform = `translate(${x}px, ${y < 8 ? e.clientY + 20 : y}px)`;
});

function hideTip(): void {
  tipEl.classList.remove('show');
}

// ---------- Spelverloop ----------

/** Onthoudt de ingevulde namen, ook als het startscherm opnieuw getekend wordt. */
function readNames(): void {
  names = [0, 1].map((i) => {
    const input = document.querySelector<HTMLInputElement>(`#name${i}`);
    return input ? input.value.trim() || defaultName(i as PlayerId) : names[i];
  }) as [string, string];
}

function defaultName(i: PlayerId): string {
  return tr(`Speler ${i + 1}`, `Player ${i + 1}`);
}

function loadLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'nl' || saved === 'en') return saved;
  } catch {
    // Lezen lukt niet: dan de taal van de browser.
  }
  return navigator.language?.toLowerCase().startsWith('nl') ? 'nl' : 'en';
}

/** Wisselt van taal. Standaardnamen ("Speler 1") gaan mee; een zelfgekozen naam blijft. */
function toggleLang(): void {
  readNames();
  const old = [defaultName(0), defaultName(1)];
  setLang(getLang() === 'nl' ? 'en' : 'nl');
  names = names.map((n, i) => (n === old[i] ? defaultName(i as PlayerId) : n)) as [string, string];
  try {
    localStorage.setItem(LANG_KEY, getLang());
  } catch {
    // Opslaan lukt niet: de keuze geldt dan alleen voor deze sessie.
  }
  applyLangToPage();
  render();
}

function applyLangToPage(): void {
  document.documentElement.lang = getLang();
  document.title = tr('Munt of Zwaard', 'Coin or Sword');
  const rotate = document.querySelector('#rotate');
  if (rotate) {
    rotate.innerHTML = `<div class="rotate-icon">📱</div>${tr('Draai je toestel een kwartslag', 'Turn your device sideways')}<br>
      <small>${tr('Munt of Zwaard speel je liggend', 'Coin or Sword is played in landscape')}</small>`;
  }
}

function levelInfo(): (typeof AI_LEVELS)[number] {
  return AI_LEVELS.find((l) => l.id === computerLevel)!;
}

function computerName(): string {
  return `${tr('Computer', 'Computer')} (${levelInfo().label})`;
}

function loadLevel(): AiLevel {
  try {
    const saved = localStorage.getItem(LEVEL_KEY);
    if (AI_LEVELS.some((l) => l.id === saved)) return saved as AiLevel;
  } catch {
    // Lezen lukt niet (bv. privévenster): dan het standaardniveau.
  }
  return 'normaal';
}

function loadTafel(): boolean {
  try {
    return localStorage.getItem(TAFEL_KEY) === '1';
  } catch {
    return false;
  }
}

function saveTafel(): void {
  try {
    localStorage.setItem(TAFEL_KEY, tafelversie ? '1' : '0');
  } catch {
    // Opslaan lukt niet: de keuze geldt dan alleen voor deze sessie.
  }
}

function saveLevel(): void {
  try {
    localStorage.setItem(LEVEL_KEY, computerLevel);
  } catch {
    // Opslaan lukt niet: de keuze geldt dan alleen voor deze sessie.
  }
}

function newMatch(): Match {
  return { wins: [0, 0], gameNo: 0, firstStarter: null, lastWinner: null };
}

function matchWinner(): PlayerId | null {
  const w = match.wins.findIndex((n) => n >= GAMES_TO_WIN_MATCH);
  return w < 0 ? null : (w as PlayerId);
}

/** Wie begint het volgende spel van de match? */
function nextStarter(): PlayerId {
  if (match.gameNo === 0 || match.firstStarter === null) return Math.random() < 0.5 ? 0 : 1;
  if (match.gameNo === 1) return other(match.firstStarter);
  return other(match.lastWinner ?? match.firstStarter);
}

function startMatch(): void {
  readNames();
  match = newMatch();
  beginGame(undefined, nextStarter(), 1);
}

/** Na een gewonnen spel: het volgende spel, of een nieuwe match als die gedaan is. */
function nextGame(): void {
  if (net) {
    if (net.me === 0) hostStartGame();
    else if (net.link) {
      net.waitingNext = true;
      net.link.send({ t: 'next' });
      render();
    }
    return;
  }
  if (matchWinner() !== null) match = newMatch();
  beginGame(undefined, nextStarter(), match.gameNo + 1);
}

function beginGame(seed: number | undefined, starter: PlayerId, gameNo: number): void {
  match.gameNo = gameNo;
  if (gameNo === 1) match.firstStarter = starter;
  const gameNames: [string, string] = net ? netNames : vsComputer ? [names[0], computerName()] : names;
  game = createGame(gameNames, seed, { starter, bonusGold: vsComputer ? [0, levelInfo().bonusGold] : undefined, tafel: net ? netTafel : tafelversie });
  gameId++;
  prevRendered = null;
  seenZoneCards.clear();
  seenHandCards = new Set();
  lastOppHand = null;
  remoteQueue = [];
  remoteBusy = false;
  if (net) net.waitingNext = false;
  // Tegen de computer of online hoeft niemand weg te kijken.
  handoff = vsComputer || net ? null : starter;
  render();
  showToast(tr(`Spel ${gameNo}: ${game.players[starter].name} begint`, `Game ${gameNo}: ${game.players[starter].name} starts`));
  if (computerTurn(game)) scheduleComputer(COMPUTER_THINK_MS);
  else if (handoff === null && !remoteTurn(game)) sfx.deal(game.players[game.active].hand.length);
}

// ---------- Online ----------

/** Acties van de tegenstander worden één voor één afgespeeld, elk met zijn animatie. */
let remoteQueue: Extract<Msg, { t: 'action' }>[] = [];
let remoteBusy = false;

/** Een korte samenvatting van de toestand: verschilt die bij de twee spelers, dan lopen ze niet meer gelijk. */
function stateCheck(g: GameState): string {
  return [g.turn, g.seed, g.log.length, ...g.players.map((p) => `${p.gold}/${p.hand.length}/${p.deck.length}`)].join(':');
}

const netEvents = {
  onMessage: (m: Msg) => onNetMessage(m),
  onClose: () => leaveOnline(tr('De verbinding met je tegenstander is verbroken.', 'The connection to your opponent was lost.')),
};

function startHosting(code = makeCode()): void {
  readNames();
  netError = '';
  const n: Net = { me: 0, code, status: 'opening', link: null, stop: () => {}, waitingNext: false };
  net = n;
  n.stop = hostRoom(code, {
    ...netEvents,
    onReady: () => {
      if (net !== n) return;
      n.status = 'waiting';
      render();
    },
    onGuest: (link) => {
      if (net !== n) return link.close();
      n.link = link;
    },
    onError: (msg, retry) => {
      if (net !== n) return;
      n.stop();
      net = null;
      if (retry) startHosting();
      else leaveOnline(msg);
    },
  });
  render();
}

function startJoining(): void {
  readNames();
  const code = (document.querySelector<HTMLInputElement>('#code')?.value ?? '').trim().toUpperCase();
  codeFromLink = code;
  if (code.length !== 4) {
    netError = tr('Een kamercode heeft 4 tekens.', 'A room code has 4 characters.');
    render();
    return;
  }
  netError = '';
  const n: Net = { me: 1, code, status: 'joining', link: null, stop: () => {}, waitingNext: false };
  net = n;
  n.stop = joinRoom(code, {
    ...netEvents,
    onJoined: (link) => {
      if (net !== n) return link.close();
      n.link = link;
      link.send({ t: 'hello', name: names[0], protocol: PROTOCOL });
    },
    onError: (msg) => {
      if (net === n) leaveOnline(msg);
    },
  });
  render();
}

/** Stopt het online spel en gaat terug naar het startscherm, eventueel met een melding. */
function leaveOnline(msg: string): void {
  if (!net) return;
  const n = net;
  net = null;
  n.link?.close();
  n.stop();
  netError = msg;
  onlineTab = true;
  gameId++;
  game = null;
  prevRendered = null;
  remoteQueue = [];
  render();
}

function onNetMessage(m: Msg): void {
  if (!net?.link) return;
  switch (m.t) {
    case 'hello':
      if (net.me !== 0 || net.status === 'playing') return;
      if (m.protocol !== PROTOCOL) return leaveOnline(tr('Jullie spelen met een andere versie van het spel. Ververs allebei de pagina.', 'You are playing different versions of the game. Both of you, please refresh the page.'));
      netNames = [names[0], m.name];
      net.status = 'playing';
      match = newMatch();
      hostStartGame();
      break;
    case 'start':
      if (net.me !== 1) return;
      if (m.protocol !== PROTOCOL) return leaveOnline(tr('Jullie spelen met een andere versie van het spel. Ververs allebei de pagina.', 'You are playing different versions of the game. Both of you, please refresh the page.'));
      net.status = 'playing';
      netNames = m.names;
      if (m.gameNo === 1) match = newMatch();
      match.wins = [...m.wins];
      netTafel = m.tafel;
      beginGame(m.seed, m.starter, m.gameNo);
      break;
    case 'action':
      remoteQueue.push(m);
      pumpRemote();
      break;
    case 'next':
      if (net.me === 0 && game?.winner !== null) hostStartGame();
      break;
    case 'ping':
      break;
  }
}

/** De host beslist over het toeval van elk spel (seed en beginspeler) en stuurt dat door. */
function hostStartGame(): void {
  if (!net?.link) return;
  if (matchWinner() !== null || match.gameNo === 0) match = newMatch();
  const starter = nextStarter();
  const seed = Math.floor(Math.random() * 2 ** 31);
  const gameNo = match.gameNo + 1;
  netTafel = tafelversie;
  net.link.send({ t: 'start', protocol: PROTOCOL, seed, starter, gameNo, wins: match.wins, names: netNames, tafel: netTafel });
  beginGame(seed, starter, gameNo);
}

function pumpRemote(): void {
  if (remoteBusy || !game) return;
  const m = remoteQueue.shift();
  if (!m) return;
  const id = gameId;
  remoteBusy = true;
  const run = () => {
    if (id !== gameId) return;
    remoteBusy = false;
    dispatch(m.action, true);
    if (game && stateCheck(game) !== m.check) showToast(tr('Let op: jullie spel loopt niet meer gelijk. Start best een nieuw spel.', 'Warning: your games are out of sync. Better start a new game.'));
    pumpRemote();
  };
  // Net als bij de computer: een kaart van de tegenstander wordt eerst in het midden getoond.
  if (m.action.type === 'play') showcase(game, m.action, run);
  else if (m.action.type === 'buy') showcaseBuy(game, m.action, run);
  else run();
}

/** remote: de actie komt van de online tegenstander en moet niet teruggestuurd worden. */
function dispatch(action: Action, remote = false): void {
  if (!game) return;
  testPicker = false;
  pendingPlay = null;
  const r = applyAction(game, action);
  if (!r.ok) {
    showToast(r.error);
    sfx.error();
    render();
    return;
  }
  const before = game;
  game = r.state;
  if (net?.link && !remote) net.link.send({ t: 'action', action, check: stateCheck(game) });
  if (before.winner === null && game.winner !== null) {
    match.wins[game.winner]++;
    match.lastWinner = game.winner;
  }
  // Wat er gaat verdwijnen, moet vastgelegd worden voordat de tafel opnieuw getekend wordt.
  const flights = captureEffects(action, before, game);
  if (action.type === 'endTurn' && game.winner === null && !vsComputer && !net) handoff = game.active;
  render();
  shopDeal = false;
  shopRefill.clear();
  playEffects(flights);
  const impacts = findImpacts(action, before, game);
  playImpacts(impacts);
  playSounds(action, before, game, flights, impacts);
  if ((vsComputer || net) && action.type === 'endTurn' && game.winner === null) {
    if (computerTurn(game)) scheduleComputer(COMPUTER_THINK_MS);
    else if (humanCanAct()) sfx.deal(game.players[game.active].hand.length, 0.3);
  }
}

/** De computer speelt haar beurt zet per zet, met een pauze ertussen zodat de animaties te volgen zijn. */
function scheduleComputer(delay: number): void {
  const id = gameId;
  window.setTimeout(() => {
    if (id !== gameId || !game || !computerTurn(game) || game.winner !== null) return;
    const action = chooseAction(game, computerLevel);
    const next = () => {
      if (id !== gameId || !game) return;
      dispatch(action);
      if (action.type !== 'endTurn' && game && computerTurn(game) && game.winner === null) scheduleComputer(COMPUTER_STEP_MS);
    };
    if (action.type === 'play') showcase(game, action, next);
    else if (action.type === 'buy') showcaseBuy(game, action, next);
    else next();
  }, delay);
}

/** Zo lang blijft een kaart van de computer in het midden van het scherm liggen. */
const SHOWCASE_HOLD_MS = 400;
/** Startkaarten (Koperen Munt, Rekruut, Zilveren Munt) ken je al: die flitsen maar heel kort voorbij. */
const STARTER_HOLD_MS = 80;
const STARTER_APPEAR_MS = 120;

/**
 * Toont een kaart die de computer speelt eerst groot in het midden van het scherm,
 * met de helft die ze gebruikt in het licht, en laat ze dan naar haar plek vliegen.
 * Pas als de kaart aankomt, wordt de zet echt uitgevoerd (done).
 */
function showcase(g: GameState, action: Extract<Action, { type: 'play' }>, done: () => void): void {
  const pid = g.active;
  const card = g.players[pid].hand.find((c) => c.uid === action.handUid);
  if (!card) return done();
  const def = getCard(card.defId);
  const target = action.target;
  const toZone = target.kind === 'zone';
  const slam = toZone && (def.price ?? 0) >= SLAM_PRICE;
  const starter = STARTER_DECK.includes(def.id);
  const appear = starter ? STARTER_APPEAR_MS : 380;

  const dim = document.createElement('div');
  dim.className = 'showcase-dim';
  const label = document.createElement('div');
  label.className = 'showcase-label';
  label.innerHTML = toZone
    ? `${esc(g.players[pid].name)} ${tr('speelt in', 'plays in')} <b>${g.zones[target.zone].icon} ${esc(zoneName(g.zones[target.zone]))}</b>`
    : `${esc(g.players[pid].name)} ${tr('legt af', 'discards')}`;
  const el = document.createElement('div');
  el.className = `card fx-card showcase ${toZone ? 'use-bottom' : 'use-top'}`;
  el.innerHTML = renderFace(def);
  document.body.append(dim, el, label);

  // Van de hand van de computer naar het midden, groot.
  const big = 1.8 * scale;
  const cx = window.innerWidth / 2 - (CARD_W * big) / 2;
  const cy = window.innerHeight / 2 - (CARD_H * big) / 2;
  const hand = app.querySelector('.hand.opp')?.getBoundingClientRect();
  const from = hand
    ? `translate(${hand.left + hand.width / 2 - (CARD_W * scale) / 2}px, ${hand.top}px) scale(${scale * 0.8}) rotate(8deg)`
    : `translate(${cx}px, ${cy - 200}px) scale(${big})`;
  const center = `translate(${cx}px, ${cy}px) scale(${big})`;
  label.style.top = `${cy + CARD_H * big + 14 * scale}px`;
  label.style.fontSize = `${20 * scale}px`;
  const fadeIn = starter ? 150 : 250;
  dim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fadeIn, fill: 'both' });
  label.animate([{ opacity: 0, transform: 'translate(-50%, 10px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: fadeIn, delay: starter ? 0 : 200, fill: 'both' });
  el.animate([{ transform: from, opacity: 0.6 }, { transform: center, opacity: 1 }], {
    duration: appear, easing: 'cubic-bezier(.2,1.1,.4,1)', fill: 'both',
  });

  window.setTimeout(() => {
    const fade = { duration: fadeIn, fill: 'both' } as const;
    dim.animate([{ opacity: 1 }, { opacity: 0 }], fade).onfinish = () => dim.remove();
    label.animate([{ opacity: 1 }, { opacity: 0 }], fade).onfinish = () => label.remove();

    let end: string;
    if (slam) {
      // Een dure kaart verdwijnt omhoog; daarna slaat ze neer met de gewone inslag.
      end = `translate(${cx}px, ${cy - 120}px) scale(${big * 1.15})`;
    } else {
      const spot = toZone
        ? app.querySelectorAll('.zone-area')[target.zone]?.querySelector(`.zslot.empty.p${pid}`)
        : app.querySelector(`[data-pile="discard:${pid}"]`);
      const r = spot?.getBoundingClientRect();
      end = r ? `translate(${r.left}px, ${r.top}px) scale(${r.width / CARD_W})` : center;
    }
    const fly = el.animate(
      [
        { transform: center, opacity: 1 },
        { transform: end, opacity: slam || !toZone ? 0 : 1 },
      ],
      { duration: slam ? 220 : starter ? 300 : 420, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'both' },
    );
    fly.onfinish = () => {
      // De kaart ligt al op haar plek: geen tweede intrede-animatie in de zone.
      if (toZone && !slam) seenZoneCards.add(`${card.uid}@${g.turn}`);
      done();
      el.remove();
    };
  }, appear + (starter ? STARTER_HOLD_MS : SHOWCASE_HOLD_MS));
}

/** Zo lang blijft een kaart die de tegenstander koopt in het midden liggen: dat wil je zien. */
const BUY_HOLD_MS = 900;
/** De tegenstander kocht net via showcaseBuy: die kaart vloog al naar de aflegstapel. */
let buyShown = false;

/**
 * Toont een kaart die de tegenstander koopt: ze komt uit de winkel naar het midden, groot, met de prijs,
 * en vliegt dan naar de aflegstapel van de koper. Pas dan wordt de aankoop uitgevoerd (done).
 */
function showcaseBuy(g: GameState, action: Extract<Action, { type: 'buy' }>, done: () => void): void {
  const pid = g.active;
  const card = g.shop.market.find((c) => c.uid === action.marketUid);
  const slot = app.querySelector<HTMLElement>(`[data-click="buy:${action.marketUid}"] .card`);
  if (!card || !slot || whyCantBuy(g, card.uid)) return done();
  const def = getCard(card.defId);
  const price = shopPrice(g, pid, card.defId);

  const dim = document.createElement('div');
  dim.className = 'showcase-dim';
  const label = document.createElement('div');
  label.className = 'showcase-label';
  label.innerHTML = `${esc(g.players[pid].name)} ${tr('koopt', 'buys')} <b>${esc(def.name)}</b> ${tr('voor', 'for')} <b>${price} 🪙</b>`;
  const el = document.createElement('div');
  el.className = 'card fx-card showcase bought';
  el.innerHTML = renderFace(def);
  slot.style.visibility = 'hidden';
  document.body.append(dim, el, label);

  const r = slot.getBoundingClientRect();
  const big = 1.8 * scale;
  const cx = window.innerWidth / 2 - (CARD_W * big) / 2;
  const cy = window.innerHeight / 2 - (CARD_H * big) / 2;
  const from = `translate(${r.left}px, ${r.top}px) scale(${r.width / CARD_W})`;
  const center = `translate(${cx}px, ${cy}px) scale(${big})`;
  label.style.top = `${cy + CARD_H * big + 14 * scale}px`;
  label.style.fontSize = `${20 * scale}px`;
  dim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: 'both' });
  label.animate([{ opacity: 0, transform: 'translate(-50%, 10px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 250, delay: 200, fill: 'both' });
  el.animate(
    [
      { transform: from, opacity: 1 },
      { transform: `translate(${(r.left + cx) / 2}px, ${Math.min(r.top, cy) - 40 * scale}px) scale(${big * 0.7}) rotate(-6deg)`, offset: 0.5 },
      { transform: center, opacity: 1 },
    ],
    { duration: 450, easing: 'cubic-bezier(.2,1,.4,1)', fill: 'both' },
  );
  sfx.buy();

  window.setTimeout(() => {
    const fade = { duration: 250, fill: 'both' } as const;
    dim.animate([{ opacity: 1 }, { opacity: 0 }], fade).onfinish = () => dim.remove();
    label.animate([{ opacity: 1 }, { opacity: 0 }], fade).onfinish = () => label.remove();
    const pile = app.querySelector(`[data-pile="discard:${pid}"]`)?.getBoundingClientRect();
    const end = pile ? `translate(${pile.left}px, ${pile.top}px) scale(${pile.width / CARD_W}) rotate(0deg)` : center;
    el.animate([{ transform: center }, { transform: end, opacity: 0.9 }], {
      duration: 420, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'both',
    }).onfinish = () => {
      buyShown = true;
      done();
      buyShown = false;
      el.remove();
    };
  }, 450 + BUY_HOLD_MS);
}

/** Kiest de geluiden bij een actie door de toestand voor en na te vergelijken. */
function playSounds(action: Action, before: GameState, after: GameState, flights: Flight[], impacts: Impacts): void {
  const me = before.active;
  const opp = other(me);
  const sum = (g: GameState, f: (z: GameState['zones'][number]) => number) => g.zones.reduce((t, z) => t + f(z), 0);

  if (action.type === 'endTurn') sfx.endTurn();
  if (action.type === 'buy' && !buyShown) sfx.buy();
  const played = action.type === 'play' ? 1 : action.type === 'discardAll' ? before.players[me].hand.length : 0;
  if (played) {
    if (impacts.slam) sfx.slam(impacts.slam.power, SLAM_IMPACT_MS / 1000);
    else if (action.type === 'play' && action.target.kind === 'zone') sfx.place();
    else for (let i = 0; i < played; i++) sfx.flick(i * 0.07);
    // De volgende geluiden starten na het laatste kaartgeluid.
    const t = (played - 1) * 0.07;
    if (after.players[me].gold > before.players[me].gold) sfx.coin(t + 0.08);
    if (sum(after, (z) => z.damage[me]) > sum(before, (z) => z.damage[me])) sfx.hit(Math.max(t + 0.1, impacts.hitAt / 1000));
    if (sum(after, (z) => z.damage[opp]) < sum(before, (z) => z.damage[opp])) sfx.heal(t + 0.15);
    if (sum(after, (z) => z.shield[me]) > sum(before, (z) => z.shield[me])) sfx.shield(t + 0.15);
    const drawn = after.players[me].hand.length - (before.players[me].hand.length - played);
    if (drawn > 0) sfx.deal(drawn, t + 0.2);
  }

  // Zelfde timing als de animaties in playEffects.
  for (const f of flights) {
    if (f.kind === 'return' || f.kind === 'to-shop') sfx.whoosh(f.index * 0.11);
    if (f.kind === 'to-hand') sfx.rebirth(f.index * 0.11);
    if (f.kind === 'banish') sfx.burn(f.index * 0.09);
    if (f.kind === 'curse') sfx.whoosh(0.4 + f.index * 0.18);
  }
  if (flights.some((f) => f.kind === 'shop-out')) sfx.shuffle(0.05);

  const t = impacts.conquerAt / 1000;
  impacts.conquests.forEach((_, n) => sfx.boom(t + n * 0.35));
  if (after.winner !== null) sfx.victory(t + 0.3);
  else if (impacts.conquests.length) sfx.conquer(t + 0.15);
}

// ---------- Inslagen: dure kaarten in een zone en veroverde zones ----------

/** Vanaf deze prijs slaat een kaart met een klap neer in een zone. */
const SLAM_PRICE = 6;
/** Tijd tot de dure kaart de tafel raakt. */
const SLAM_IMPACT_MS = 300;

interface Impacts {
  /** Een dure kaart die in een zone gelegd werd; power loopt van 0 (prijs 6) tot 1 (prijs 8 of meer). */
  slam: { uid: string; zone: number; power: number } | null;
  /** Zones die door deze actie veroverd werden. */
  conquests: { zone: number; owner: PlayerId }[];
  /** Wanneer de verovering losbarst (ms), na een eventuele inslag. */
  conquerAt: number;
  /** Schade en herstel per zone: een aanval vliegt als vuurbal naar de balk. */
  hits: { zone: number; pid: PlayerId; amount: number }[];
  /** Waar de aanval vandaan komt: de gespeelde kaart in de zone, anders het portret van de speler. */
  source: string | null;
  /** Wanneer de eerste aanval de balk raakt (ms). */
  hitAt: number;
}

/** Zo lang vliegt een aanval naar de balk. */
const HIT_FLIGHT_MS = 380;

function findImpacts(action: Action, before: GameState, after: GameState): Impacts {
  let slam: Impacts['slam'] = null;
  if (action.type === 'play' && action.target.kind === 'zone') {
    const card = before.players[before.active].hand.find((c) => c.uid === action.handUid);
    const price = card ? getCard(card.defId).price ?? 0 : 0;
    if (price >= SLAM_PRICE) slam = { uid: action.handUid, zone: action.target.zone, power: Math.min(1, (price - SLAM_PRICE) / 2) };
  }
  const conquests = after.zones.flatMap((z, i) => (z.owner !== null && before.zones[i].owner === null ? [{ zone: i, owner: z.owner }] : []));
  const hits: Impacts['hits'] = [];
  after.zones.forEach((z, i) => {
    for (const pid of [0, 1] as PlayerId[]) {
      const amount = z.damage[pid] - before.zones[i].damage[pid];
      if (amount) hits.push({ zone: i, pid, amount });
    }
  });
  const source = action.type === 'play' && action.target.kind === 'zone' ? action.handUid : null;
  // De aanval vertrekt als de kaart ligt (na de inslag van een dure kaart).
  const launch = slam ? SLAM_IMPACT_MS + 80 : source ? 220 : 120;
  const hitAt = launch + HIT_FLIGHT_MS;
  const conquerAt = Math.max(slam ? SLAM_IMPACT_MS + 250 : 300, hits.some((h) => h.amount > 0) ? hitAt + 200 : 0);
  return { slam, conquests, conquerAt, hits, source, hitAt };
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function playImpacts(impacts: Impacts): void {
  const zoneEls = app.querySelectorAll<HTMLElement>('.zone-area');

  if (impacts.slam) {
    const { uid, zone, power } = impacts.slam;
    const card = app.querySelector<HTMLElement>(`[data-zcard="${uid}"] .card`);
    if (card) {
      // De kaart hangt groot boven de tafel, aarzelt even en slaat dan neer.
      card.classList.remove('enter-up', 'enter-down');
      card.classList.add('slamming');
      const big = 1.9 + power * 0.6;
      card.animate(
        [
          { transform: `translateY(-70px) scale(${big}) rotate(-6deg)`, opacity: 0, filter: 'brightness(2)' },
          { transform: `translateY(-90px) scale(${big + 0.1}) rotate(-4deg)`, opacity: 1, filter: 'brightness(1.4)', offset: 0.55 },
          { transform: 'translateY(0) scale(0.92) rotate(0deg)', opacity: 1, filter: 'brightness(1.8)', offset: 0.85, easing: 'ease-out' },
          { transform: 'translateY(0) scale(1)', opacity: 1, filter: 'none' },
        ],
        { duration: SLAM_IMPACT_MS / 0.85, easing: 'cubic-bezier(.6,0,.9,.4)' },
      ).onfinish = () => card.classList.remove('slamming');
      const r = card.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      window.setTimeout(() => {
        shake(8 + power * 10, 350 + power * 200);
        shockwave(x, y, '#ffd27a', 1 + power);
        burst(x, y, ['#fff3c4', '#ffcc66', '#ff9800'], 18 + Math.round(power * 16), 110 + power * 80, 0);
        flashZone(zoneEls[zone], 'rgba(255, 220, 140, 0.55)');
      }, SLAM_IMPACT_MS);
    }
  }

  playHits(impacts);

  impacts.conquests.forEach(({ zone, owner }, n) => {
    const el = zoneEls[zone];
    if (!el) return;
    const at = impacts.conquerAt + n * 350;
    const color = owner === 0 ? '#4fc3f7' : '#ff8a65';
    // De strook "Veroverd door" valt van groot naar zijn plek.
    el.querySelector<HTMLElement>('.zone-banner')?.animate(
      [
        { transform: 'translateY(-50%) scale(2.4)', opacity: 0 },
        { transform: 'translateY(-50%) scale(0.94)', opacity: 1, offset: 0.7 },
        { transform: 'translateY(-50%) scale(1)', opacity: 1 },
      ],
      { duration: 420, delay: at - 260, easing: 'cubic-bezier(.5,0,.8,.5)', fill: 'backwards' },
    );
    window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      shake(16, 650);
      shockwave(x, y, color, 3.2);
      shockwave(x, y, '#ffd27a', 2.2, 120);
      burst(x, y, [color, '#ffd27a', '#ffffff'], 46, 260, 0);
      flashZone(el, color);
    }, at);
  });
}

/**
 * Schade vliegt als een vuurbal van de kaart naar het einde van de balk, en pas bij de inslag groeit
 * de balk en verschijnt het getal. Herstel (minder schade) laat groene vonkjes uit de balk opstijgen.
 */
function playHits(impacts: Impacts): void {
  const zoneEls = app.querySelectorAll<HTMLElement>('.zone-area');
  const launchAt = impacts.hitAt - HIT_FLIGHT_MS;
  let n = 0;
  for (const { zone, pid, amount } of impacts.hits) {
    const bar = zoneEls[zone]?.querySelector<HTMLElement>(`.bar.p${pid}`);
    const fill = bar?.querySelector<HTMLElement>('.fill');
    if (!bar || !fill) continue;
    const float = bar.querySelector<HTMLElement>('.float');
    const r = bar.getBoundingClientRect();
    const g = game!;
    const pct = Math.min(1, g.zones[zone].damage[pid] / g.zones[zone].hp);
    const x = r.left + r.width * pct;
    const y = r.top + r.height / 2;

    if (amount < 0) {
      burst(x, y, ['#b9f6ca', '#69f0ae', '#ffffff'], 10, 50, launchAt);
      continue;
    }
    const at = impacts.hitAt + n * 90;
    // De balk en het getal wachten op de inslag.
    fill.style.animationDelay = `${at}ms`;
    if (float) float.style.animationDelay = `${at}ms`;

    const src = (impacts.source && app.querySelector(`[data-zcard="${impacts.source}"] .card`))
      || app.querySelector(`.info.p${pid} .portrait`);
    const sr = src?.getBoundingClientRect();
    if (sr && !reducedMotion.matches) {
      const sx = sr.left + sr.width / 2;
      const sy = sr.top + sr.height / 2;
      const color = pid === 0 ? '#4fc3f7' : '#ff8a65';
      const bolt = document.createElement('div');
      bolt.className = 'bolt';
      bolt.style.setProperty('--c', color);
      bolt.style.setProperty('--size', `${(14 + Math.min(amount, 6) * 3) * scale}px`);
      document.body.appendChild(bolt);
      // Een boog omhoog, zodat de vuurbal niet recht door de kaarten schiet.
      const mx = (sx + x) / 2;
      const my = Math.min(sy, y) - 70 * scale;
      bolt.animate(
        [
          { transform: `translate(${sx}px, ${sy}px) scale(0.3)`, opacity: 0 },
          { transform: `translate(${mx}px, ${my}px) scale(1.1)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${x}px, ${y}px) scale(0.9)`, opacity: 1 },
        ],
        { duration: HIT_FLIGHT_MS, delay: at - HIT_FLIGHT_MS, easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'both' },
      ).onfinish = () => bolt.remove();
    }
    window.setTimeout(() => {
      burst(x, y, ['#fff3c4', '#ffeb3b', '#ff7043'], 8 + Math.min(amount, 6) * 3, 40 + amount * 10, 0);
      bar.animate(
        [
          { transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(4px)' },
          { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' },
        ],
        { duration: 260 },
      );
      fill.animate([{ filter: 'brightness(2.2)' }, { filter: 'none' }], { duration: 400, easing: 'ease-out' });
    }, at);
    n++;
  }
}

/** Schudt de hele tafel, uitdovend. Niet als de speler minder beweging vraagt. */
function shake(px: number, ms: number): void {
  if (reducedMotion.matches) return;
  const steps = Math.round(ms / 40);
  const frames: Keyframe[] = [];
  for (let i = 0; i < steps; i++) {
    const f = px * (1 - i / steps);
    frames.push({ transform: `translate(${(Math.random() * 2 - 1) * f}px, ${(Math.random() * 2 - 1) * f}px) rotate(${(Math.random() * 2 - 1) * f * 0.06}deg)` });
  }
  frames.push({ transform: 'none' });
  app.animate(frames, { duration: ms, easing: 'linear' });
}

/** Een ring die vanuit het inslagpunt uitdijt. */
function shockwave(x: number, y: number, color: string, size: number, delay = 0): void {
  const ring = document.createElement('div');
  ring.className = 'shockwave';
  ring.style.setProperty('--c', color);
  document.body.appendChild(ring);
  ring.animate(
    [
      { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(0.1)`, opacity: 1, borderWidth: '14px' },
      { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${size * scale * 2})`, opacity: 0, borderWidth: '2px' },
    ],
    { duration: 600, delay, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'both' },
  ).onfinish = () => ring.remove();
}

/** Vonken die in alle richtingen wegspatten. */
function burst(x: number, y: number, colors: string[], count: number, reach: number, delay: number): void {
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('div');
    spark.className = 'spark';
    spark.style.setProperty('--c', colors[i % colors.length]);
    document.body.appendChild(spark);
    const angle = Math.random() * Math.PI * 2;
    const dist = reach * scale * (0.4 + Math.random() * 0.6);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    spark.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(1.4)`, opacity: 1 },
        { transform: `translate(${x + dx}px, ${y + dy + 30}px) scale(0.2)`, opacity: 0 },
      ],
      { duration: 500 + Math.random() * 400, delay, easing: 'cubic-bezier(.1,.8,.3,1)', fill: 'both' },
    ).onfinish = () => spark.remove();
  }
}

/** Een felle gloed over de hele zone. */
function flashZone(el: HTMLElement | undefined, color: string): void {
  if (!el) return;
  const flash = document.createElement('div');
  flash.className = 'zone-flash';
  flash.style.setProperty('--c', color);
  el.appendChild(flash);
  flash.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 700, easing: 'ease-out' }).onfinish = () => flash.remove();
}

// ---------- Animaties voor Terugroep, Vernietig en Ververs ----------

interface Flight {
  clone: HTMLElement;
  from: DOMRect;
  kind: 'return' | 'to-hand' | 'to-shop' | 'banish' | 'shop-out' | 'bought' | 'discard' | 'curse';
  pid: PlayerId;
  index: number;
  /** Breedte van het element zonder schaal (een kaartrug is smaller dan een kaart). */
  w: number;
}
/** Laat de nieuwe winkelkaarten bij de volgende weergave één voor één binnenkomen. */
let shopDeal = false;
/** Winkelkaarten die na een aankoop een vrije plek aanvullen: ze komen uit de voorraad aangevlogen. */
const shopRefill = new Set<string>();

function captureEffects(action: Action, before: GameState, after: GameState): Flight[] {
  const flights: Flight[] = [];
  const grab = (el: HTMLElement, kind: Flight['kind'], pid: PlayerId) =>
    flights.push({ clone: el.cloneNode(true) as HTMLElement, from: el.getBoundingClientRect(), kind, pid, index: flights.length, w: el.offsetWidth });

  before.zones.forEach((zone, zi) => {
    for (const zc of zone.cards) {
      if (after.zones[zi].cards.some((c) => c.card.uid === zc.card.uid)) continue;
      const el = app.querySelector<HTMLElement>(`[data-zcard="${zc.card.uid}"] .card`);
      if (!el) continue;
      // Teruggeroepen kaarten liggen nu op de aflegstapel, een Fenix in de hand, een Huurling in de winkel;
      // vernietigde kaarten zijn nergens meer.
      const owner = after.players[zc.player];
      const has = (cards: CardInstance[]) => cards.some((c) => c.uid === zc.card.uid);
      const kind = has(owner.discard) ? 'return' : has(owner.hand) ? 'to-hand' : has(after.shop.pile) ? 'to-shop' : 'banish';
      grab(el, kind, zc.player);
    }
  });

  // Een kaart die meteen terugkeert (echo) lag nooit zichtbaar in de zone: ze vliegt vanuit haar vrije plek weg.
  if (action.type === 'play' && action.target.kind === 'zone') {
    const pid = before.active;
    const uid = action.handUid;
    const card = before.players[pid].hand.find((c) => c.uid === uid);
    const spot = app.querySelectorAll('.zone-area')[action.target.zone]?.querySelector<HTMLElement>(`.zslot.empty.p${pid}`);
    if (card && spot && !after.zones[action.target.zone].cards.some((c) => c.card.uid === uid)) {
      const owner = after.players[pid];
      const has = (cards: CardInstance[]) => cards.some((c) => c.uid === uid);
      const kind = has(owner.discard) ? 'return' : has(owner.hand) ? 'to-hand' : 'to-shop';
      const clone = document.createElement('div');
      clone.className = 'card';
      clone.innerHTML = renderFace(getCard(card.defId));
      flights.push({ clone, from: spot.getBoundingClientRect(), kind, pid, index: flights.length, w: CARD_W });
    }
  }

  // Een kaart met Verdwijn (de Vloek) verbrandt op de aflegstapel.
  if (action.type === 'play' && action.target.kind === 'discard') {
    const pid = before.active;
    const card = before.players[pid].hand.find((c) => c.uid === action.handUid);
    const pile = app.querySelector(`[data-pile="discard:${pid}"]`);
    if (card && pile && getCard(card.defId).top.some((e) => e.kw === 'verdwijn')) {
      const clone = document.createElement('div');
      clone.className = 'card';
      clone.innerHTML = renderFace(getCard(card.defId));
      flights.push({ clone, from: pile.getBoundingClientRect(), kind: 'banish', pid, index: flights.length, w: CARD_W });
    }
  }

  // Nieuwe Vloeken vliegen van de gespeelde kaart naar de stapel van de tegenstander.
  if (action.type === 'play') {
    const pid = before.active;
    const opp = other(pid);
    const curses = after.players[opp].deck.filter((c) => c.defId === 'vloek' && !before.players[opp].deck.some((d) => d.uid === c.uid));
    const source = action.target.kind === 'zone'
      ? app.querySelectorAll('.zone-area')[action.target.zone]
      : app.querySelector(`[data-pile="discard:${pid}"]`);
    if (curses.length && source) {
      const r = source.getBoundingClientRect();
      const w = CARD_W * scale * 0.6;
      const h = CARD_H * scale * 0.6;
      curses.forEach((c, i) => {
        const clone = document.createElement('div');
        clone.className = 'card';
        clone.innerHTML = renderFace(getCard(c.defId));
        const from = new DOMRect(r.left + r.width / 2 - w / 2, r.top + r.height / 2 - h / 2, w, h);
        flights.push({ clone, from, kind: 'curse', pid: opp, index: i, w: CARD_W });
      });
    }
  }

  // Een aankoop vervangt één kaart; Ververs vervangt ze allemaal.
  const oldMarket = before.shop.market.map((c) => c.uid);
  if (oldMarket.length && !after.shop.market.some((c) => oldMarket.includes(c.uid))) {
    shopDeal = true;
    const start = flights.length;
    app.querySelectorAll<HTMLElement>('.shop-slot .card').forEach((el) => grab(el, 'shop-out', after.active));
    flights.slice(start).forEach((f, i) => (f.index = i));
  } else {
    for (const c of after.shop.market) if (!oldMarket.includes(c.uid)) shopRefill.add(c.uid);
  }

  // Een verbannen winkelkaart zakt weg in de voorraad.
  if (action.type === 'banish') {
    const el = app.querySelector<HTMLElement>(`[data-click="buy:${action.marketUid}"] .card`);
    if (el) grab(el, 'shop-out', before.active);
  }

  // Een gekochte kaart vliegt uit de winkel naar de aflegstapel (bij de tegenstander deed showcaseBuy dat al).
  if (action.type === 'buy' && !buyShown) {
    const el = app.querySelector<HTMLElement>(`[data-click="buy:${action.marketUid}"] .card`);
    if (el) grab(el, 'bought', before.active);
  }

  // Wat je bij Einde beurt of met Alles afleggen uit je hand gooit, vliegt naar je aflegstapel.
  if (action.type === 'endTurn' || action.type === 'discardAll') {
    const pid = before.active;
    const left = before.players[pid].hand.filter((c) => !after.players[pid].hand.some((h) => h.uid === c.uid));
    const start = flights.length;
    if (pid === bottomSeat(before) && handoff === null) {
      for (const c of left) {
        const el = app.querySelector<HTMLElement>(`[data-drag="${c.uid}"] .card`);
        if (el) grab(el, 'discard', pid);
      }
    } else if (left.length) {
      for (const el of [...app.querySelectorAll<HTMLElement>('.hand.opp .back')].slice(-left.length)) grab(el, 'discard', pid);
    }
    flights.slice(start).forEach((f, i) => (f.index = i));
  }
  return flights;
}

function playEffects(flights: Flight[]): void {
  for (const f of flights) {
    const c = f.clone;
    c.classList.remove('enter-up', 'enter-down');
    c.classList.add('fx-card');
    document.body.appendChild(c);
    const s0 = f.from.width / (f.w || CARD_W);
    const start = `translate(${f.from.left}px, ${f.from.top}px) scale(${s0})`;
    let anim: Animation;

    if (f.kind === 'discard') {
      // Snel en laag over de tafel naar de aflegstapel.
      const r = app.querySelector(`[data-pile="discard:${f.pid}"]`)!.getBoundingClientRect();
      const s1 = r.width / (f.w || CARD_W);
      anim = c.animate(
        [
          { transform: start, opacity: 1 },
          { transform: `translate(${r.left}px, ${r.top}px) scale(${s1}) rotate(${8 - f.index * 4}deg)`, opacity: 0.85 },
        ],
        { duration: 380, delay: f.index * 60, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'both' },
      );
    } else if (f.kind === 'return' || f.kind === 'to-hand' || f.kind === 'to-shop' || f.kind === 'bought') {
      const target =
        f.kind === 'return' || f.kind === 'bought' ? app.querySelector(`[data-pile="discard:${f.pid}"]`)
        : f.kind === 'to-shop' ? app.querySelector('.shop-title')
        : app.querySelector(game && f.pid === bottomSeat(game) ? '.hand.mine' : '.hand.opp');
      const r = target!.getBoundingClientRect();
      // Naar de aflegstapel: zo groot als de stapel; naar hand of winkel: een kleine kaart in het midden.
      const toPile = f.kind === 'return' || f.kind === 'bought';
      const s1 = toPile ? r.width / CARD_W : scale * 0.6;
      const pile = toPile
        ? r
        : { left: r.left + r.width / 2 - (CARD_W * s1) / 2, top: r.top + r.height / 2 - (CARD_H * s1) / 2 };
      const midX = (f.from.left + pile.left) / 2;
      const midY = Math.min(f.from.top, pile.top) - 90 * scale;
      anim = c.animate(
        [
          { transform: start },
          { transform: `translate(${midX}px, ${midY}px) scale(${((s0 + s1) / 2) * 1.2}) rotate(-14deg)`, offset: 0.45 },
          { transform: `translate(${pile.left}px, ${pile.top}px) scale(${s1}) rotate(0deg)` },
        ],
        { duration: 700, delay: f.index * 110, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'both' },
      );
    } else if (f.kind === 'curse') {
      // De Vloek verschijnt paars gloeiend, zweeft even en duikt dan in de stapel van de tegenstander.
      const target = app.querySelector(`[data-pile="deck:${f.pid}"]`);
      if (!target) {
        c.remove();
        continue;
      }
      const r = target.getBoundingClientRect();
      const s1 = r.width / CARD_W;
      const glow = 'drop-shadow(0 0 14px #ce93d8) brightness(1.3)';
      anim = c.animate(
        [
          { transform: `${start} scale(0.3) rotate(-20deg)`, filter: glow, opacity: 0 },
          { transform: `${start} translateY(-30px) scale(1.15)`, filter: glow, opacity: 1, offset: 0.3 },
          { transform: `${start} translateY(-30px) scale(1.15) rotate(6deg)`, filter: glow, opacity: 1, offset: 0.5 },
          { transform: `translate(${r.left}px, ${r.top}px) scale(${s1}) rotate(180deg)`, filter: 'none', opacity: 0.9 },
        ],
        { duration: 1100, delay: 250 + f.index * 180, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'both' },
      );
    } else if (f.kind === 'banish') {
      anim = c.animate(
        [
          { transform: start, filter: 'none', opacity: 1 },
          { transform: `${start} translateY(-8px)`, filter: 'brightness(1.7) sepia(1) saturate(5) hue-rotate(-25deg)', opacity: 1, offset: 0.35 },
          { transform: `${start} translateY(-40px) scale(1.12)`, filter: 'brightness(0.2) sepia(1) blur(3px)', opacity: 0 },
        ],
        { duration: 900, delay: f.index * 90, easing: 'ease-in', fill: 'both' },
      );
      spawnEmbers(f.from, f.index * 90);
    } else {
      anim = c.animate(
        [
          { transform: start, opacity: 1 },
          { transform: `${start} translate(-220px, 30px) rotate(-30deg)`, opacity: 0 },
        ],
        { duration: 450, delay: f.index * 60, easing: 'ease-in', fill: 'both' },
      );
    }
    anim.onfinish = () => c.remove();
  }
}

/** Vonken die opstijgen uit een vernietigde kaart. */
function spawnEmbers(r: DOMRect, delay: number): void {
  for (let i = 0; i < 14; i++) {
    const ember = document.createElement('div');
    ember.className = 'ember';
    document.body.appendChild(ember);
    const x = r.left + Math.random() * r.width;
    const y = r.top + r.height * (0.3 + Math.random() * 0.7);
    ember
      .animate(
        [
          { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 },
          { transform: `translate(${x + (Math.random() - 0.5) * 70}px, ${y - 60 - Math.random() * 90}px) scale(0.2)`, opacity: 0 },
        ],
        { duration: 700 + Math.random() * 500, delay: delay + 200 + Math.random() * 250, easing: 'ease-out', fill: 'both' },
      )
      .onfinish = () => ember.remove();
  }
}

// ---------- Hulpjes ----------

let toastTimer = 0;
function showToast(msg: string): void {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2000);
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** De tafel heeft een vaste ontwerpgrootte en wordt geschaald naar het venster. */
function fit(): void {
  scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  stage.style.setProperty('--scale', String(scale));
}

window.addEventListener('resize', fit);
applyLangToPage();
fit();
render();
