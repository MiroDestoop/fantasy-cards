import './style.css';
import { AI_LEVELS, chooseAction, type AiLevel } from './game/ai';
import { getCard, KEYWORDS, STARTER_DECK } from './game/cards';
import { getSpecial } from './game/specials';
import {
  applyAction, createGame, other, recallPrice, shopPrice, whyCantBuy, whyCantPlay, zonesOwnedBy,
} from './game/engine';
import { FIRST_HAND_SIZE, GAMES_TO_WIN_MATCH, HAND_SIZE, MAX_ZONE_CARDS, RECALL_PRICE, ZONE_HP, ZONES_TO_WIN } from './game/rules';
import type { Action, CardDef, CardInstance, Effect, GameState, Keyword, PlayerId, PlayTarget } from './game/types';
import { hostRoom, joinRoom, makeCode, PROTOCOL, type Link, type Msg } from './online';
import { isMuted, sfx, toggleMute } from './sound';
import { zoneCapacity, ZONE_EFFECTS, zoneEffect } from './game/zones';
import { ZONE_ART } from './zoneArt';

const HERO_ICONS = ['🧙‍♂️', '🧝‍♀️'] as const;
const COMPUTER_ICON = '🤖';
/** In een spel tegen de computer is de mens speler 0 en de computer speler 1. */
const COMPUTER: PlayerId = 1;
/** Wachttijd van de computer vóór haar eerste zet en tussen haar zetten, zodat je kunt volgen wat ze doet. */
const COMPUTER_THINK_MS = 1000;
const COMPUTER_STEP_MS = 750;
const LEVEL_KEY = 'fantasy-cards-niveau';
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

let names: [string, string] = ['Speler 1', 'Speler 2'];
/** Speel je tegen de computer in plaats van tegen een tweede speler aan dezelfde tafel? */
let vsComputer = false;
/** Het niveau van de computer; onthouden voor de volgende keer. */
let computerLevel: AiLevel = loadLevel();
let game: GameState | null = null;
/** Verhoogt bij elk nieuw spel, zodat een geplande zet van de computer uit een oud spel niets meer doet. */
let gameId = 0;
/** Op een gedeeld scherm: de speler die het scherm moet krijgen voor diens hand zichtbaar wordt. */
let handoff: PlayerId | null = null;
/** Voor animaties: wat stond er bij de vorige weergave op tafel? */
let prevRendered: GameState | null = null;
const seenZoneCards = new Set<string>();
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
let netError = '';
/** Een kamercode uit de link (?kamer=ABCD) wordt alvast ingevuld. */
let codeFromLink = new URLSearchParams(location.search).get('kamer')?.toUpperCase() ?? '';
if (codeFromLink) onlineTab = true;

// ---------- Weergave ----------

function render(): void {
  hideTip();
  app.innerHTML = game ? renderGame(game) : renderStart();
}

function renderStart(): string {
  return `
  <div class="start">
    <h1>Munt of Zwaard</h1>
    <p class="subtitle">Een fantasy-kaartduel aan één tafel, online, of tegen de computer</p>
    <div class="mode">
      <button class="${!vsComputer && !onlineTab ? 'on' : ''}" data-click="mode:pvp">👥 Twee spelers</button>
      <button class="${onlineTab ? 'on' : ''}" data-click="mode:online">🌐 Online</button>
      <button class="${vsComputer ? 'on' : ''}" data-click="mode:ai">${COMPUTER_ICON} Tegen de computer</button>
    </div>
    ${onlineTab ? renderOnlineStart() : `${vsComputer
      ? `<div class="mode levels">${AI_LEVELS.map((l) =>
          `<button class="${l.id === computerLevel ? 'on' : ''}" data-click="level:${l.id}">${l.icon} ${l.label}</button>`).join('')}</div>
        ${levelInfo().bonusGold
          ? `<p class="level-note">${levelInfo().icon} ${levelInfo().label} speelt zoals Extreem, maar krijgt elke beurt ${levelInfo().bonusGold} extra goud.</p>`
          : ''}`
      : ''}
    <div class="names">
      <label>${vsComputer ? 'Jouw naam' : 'Speler 1'} <input id="name0" maxlength="16" value="${esc(names[0])}"></label>
      ${vsComputer
        ? `<label>Tegenstander <div class="computer-name">${levelInfo().icon} ${esc(computerName())}</div></label>`
        : `<label>Speler 2 <input id="name1" maxlength="16" value="${esc(names[1])}"></label>`}
    </div>
    <button class="btn" data-click="start">Aan tafel!</button>`}
    <div class="rules">
      <h2>Zo speel je</h2>
      <ul>
        <li>Verover <b>${ZONES_TO_WIN} van de 3 zones</b> om te winnen. Een zone is van jou als je er als eerste haar levens vol schade doet (meestal ${ZONE_HP}).</li>
        <li>Elk spel krijg je andere zones, elk met een <b>speciaal effect</b>: meer of minder levens, meer of minder schade, goud of een extra kaart, korting in de winkel, minder plaats, of juist tol betalen. Hover over het effect onder de zonenaam voor de uitleg.</li>
        <li>Je speelt een <b>best-of-3</b>: wie eerst ${GAMES_TO_WIN_MATCH} spellen wint, wint de match. Elke speler begint minstens één spel.</li>
        <li>Elke beurt trek je ${HAND_SIZE} kaarten (de beginspeler in de allereerste beurt maar ${FIRST_HAND_SIZE}). Elke kaart heeft twee helften:
          sleep ze naar je <b>aflegstapel</b> voor het bovenste effect, of naar een <b>zone</b> voor het onderste.</li>
        <li>Kaarten in een zone blijven liggen, maximaal ${MAX_ZONE_CARDS} per speler per zone.
          Met <b>Terugroep</b> haal je ze terug naar je aflegstapel, met <b>Vernietig</b> verban je ze uit het spel.
          Of klik op <b>↩</b> bij een eigen kaart om ze terug te trekken voor ${RECALL_PRICE} goud; elke keer wordt dat 1 goud duurder.</li>
        <li>Met goud koop je sterkere kaarten in de winkel. Is je stapel leeg, dan wordt je aflegstapel geschud.</li>
        <li>Hover over een keyword zoals <b>Aanval(2)</b> om te zien wat het doet.</li>
      </ul>
    </div>
  </div>`;
}

function renderOnlineStart(): string {
  const error = netError ? `<p class="net-error">${esc(netError)}</p>` : '';
  if (!net) {
    return `
    <div class="names"><label>Jouw naam <input id="name0" maxlength="16" value="${esc(names[0])}"></label></div>
    ${error}
    <div class="online-choice">
      <div class="online-box">
        <b>Een kamer maken</b>
        <p>Je krijgt een code die je aan je tegenstander geeft.</p>
        <button class="btn" data-click="host">🏠 Maak een kamer</button>
      </div>
      <div class="online-box">
        <b>Meedoen</b>
        <p>Typ de code die je kreeg.</p>
        <input id="code" class="code-input" maxlength="4" placeholder="ABCD" value="${esc(codeFromLink)}" autocomplete="off">
        <button class="btn" data-click="join">🚪 Doe mee</button>
      </div>
    </div>`;
  }
  const link = `${location.origin}${location.pathname}?kamer=${net.code}`;
  const body =
    net.status === 'opening' ? '<p>Kamer maken…</p>'
    : net.status === 'waiting'
      ? `<p>Geef deze code aan je tegenstander:</p>
        <div class="room-code">${net.code}</div>
        <p class="room-link">of stuur de link <b>${esc(link)}</b></p>
        <p class="waiting">Wachten op een tegenstander…</p>`
      : `<p class="waiting">Verbinden met kamer <b>${esc(net.code)}</b>…</p>`;
  return `<div class="online-box wide">${body}<button class="btn small" data-click="cancel-online">Annuleren</button></div>`;
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
      <div class="hand opp">${renderBacks(g.players[top].hand.length)}</div>
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
  ${g.winner !== null ? renderWinner(g) : ''}`;

  for (const z of g.zones) for (const c of z.cards) seenZoneCards.add(`${c.card.uid}@${c.turn}`);
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
        <span class="gold" title="Goud om kaarten te kopen in de winkel">🪙 ${p.gold}</span>
        <span class="flags" title="Veroverde zones">🚩 ${zonesOwnedBy(g, pid)}/${ZONES_TO_WIN}</span>
        ${p.bonusGold ? `<span class="bonus" title="Bonus: krijgt elke beurt ${p.bonusGold} extra goud">+${p.bonusGold} 🪙/beurt</span>` : ''}
        ${p.slow ? `<span class="slow" title="Trekt volgende beurt ${p.slow} kaart(en) minder">⏳ −${p.slow}</span>` : ''}
      </div>
    </div>
  </div>`;
}

function renderDiscardAllButton(g: GameState): string {
  const hand = g.players[g.active].hand;
  if (!hand.length || g.winner !== null) return '';
  const gold = hand.reduce(
    (t, c) => t + getCard(c.defId).top.reduce((s, e) => s + (e.kw === 'goud' ? e.amount : 0), 0),
    0,
  );
  return `<button class="discard-all" data-click="discard-all"
    title="Speel alle ${hand.length} kaarten in je hand af op je aflegstapel en krijg hun bovenste effect">
    ⤓ Alles afleggen${gold ? ` <span>+${gold} 🪙</span>` : ''}
  </button>`;
}

function renderPiles(g: GameState, pid: PlayerId, mine: boolean): string {
  const p = g.players[pid];
  // Wat je deze beurt speelde, ligt bovenop de aflegstapel maar telt pas mee na Einde beurt.
  const topDiscard = p.played.at(-1) ?? p.discard.at(-1);
  const stackDepth = Math.min(3, Math.ceil(p.deck.length / 4));
  const played = p.played.length
    ? `<div class="pile-played" title="${p.played.length} deze beurt gespeeld: ze gaan bij Einde beurt naar de aflegstapel">+${p.played.length}</div>`
    : '';
  return `
  <div class="piles">
    <div class="pile deck" data-pile="deck:${pid}">
      ${p.deck.length ? `<div class="stack">${'<div class="back"></div>'.repeat(stackDepth)}</div>` : '<div class="empty-slot"></div>'}
      <div class="pile-count">${p.deck.length}</div>
      <div class="pile-label">Stapel</div>
    </div>
    <div class="pile discard" ${mine ? 'data-drop="discard"' : ''} data-pile="discard:${pid}">
      ${topDiscard ? renderMini(getCard(topDiscard.defId)) : '<div class="empty-slot"></div>'}
      <div class="pile-count">${p.discard.length}</div>
      ${played}
      <div class="pile-label">Aflegstapel</div>
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
      return `<div class="slot" data-drag="${card.uid}"
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
    .map((e) =>
      e.kw === 'speciaal'
        ? `<span class="kw kw-speciaal" data-special="${e.id}">${esc(getSpecial(e.id).text)}</span>`
        : `<span class="kw kw-${e.kw}" data-kw="${e.kw}" data-n="${e.amount}">${keywordText(e.kw, e.amount)}</span>`)
    .join(' ');
}

function renderFace(def: CardDef): string {
  return `
    <div class="art" style="--art:${def.color}">${def.icon}</div>
    <div class="card-name">${esc(def.name)}</div>
    <div class="sect sect-top">
      <div class="sect-label">⤓ Afleggen</div>
      <div class="kws">${renderKeywords(def.top)}</div>
    </div>
    ${def.bottom.length
      ? `<div class="sect sect-bottom">
          <div class="sect-label">⚔ In een zone</div>
          <div class="kws">${renderKeywords(def.bottom)}</div>
        </div>`
      : '<div class="sect sect-none"><div class="sect-label">Alleen afleggen</div></div>'}`;
}

function renderMini(def: CardDef): string {
  return `<div class="mini" style="--art:${def.color}" title="${esc(def.name)}">${def.icon}</div>`;
}

function renderBacks(n: number): string {
  return `<div class="backs">${'<div class="back"></div>'.repeat(n)}</div>`;
}

function renderZone(g: GameState, i: number, bottom: PlayerId, prev: GameState | null): string {
  const z = g.zones[i];
  const fx = zoneEffect(z);
  const top = other(bottom);
  // Je eigen kaarten in een open zone kan je tijdens je beurt terugtrekken voor goud.
  const canRecall = z.owner === null && humanCanAct();
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
    return `<div class="zrow ${full ? 'full' : ''}" title="${esc(g.players[pid].name)}: ${mine.length} van ${zoneCapacity(z)} plaatsen bezet">${cards}${empty}</div>`;
  };
  const bar = (pid: PlayerId) => {
    const dmg = z.damage[pid];
    const before = prev && prev !== g ? prev.zones[i].damage[pid] : dmg;
    const d = dmg - before;
    return `
    <div class="bar p${pid}" title="${esc(g.players[pid].name)}: ${dmg} van ${z.hp} schade">
      <div class="fill ${d ? 'grow' : ''}" style="width:${(dmg / z.hp) * 100}%;--from:${(before / z.hp) * 100}%"></div>
      <span class="bar-text">${esc(g.players[pid].name)} · ${dmg}/${z.hp}</span>
      ${z.shield[pid] ? `<span class="zshield" title="Schild: blokkeert de volgende ${z.shield[pid]} schade van de tegenstander">🛡️ ${z.shield[pid]}</span>` : ''}
      ${d ? `<div class="float ${d > 0 ? 'dmg' : 'heal'}">${d > 0 ? '+' : ''}${d}</div>` : ''}
    </div>`;
  };
  return `
  <div class="zone-area ${z.owner !== null ? 'closed' : ''}" data-drop="zone:${i}">
    <div class="zone-art">${ZONE_ART[z.name] ?? ''}</div>
    <div class="zcards">${row(top)}</div>
    <div class="zone-mid">
      ${bar(top)}
      <div class="zone-name">${z.icon} ${esc(z.name)}</div>
      ${fx ? `<div class="zone-fx zfx-${fx.id}" data-zfx="${fx.id}">${fx.icon} ${esc(fx.label)}</div>` : ''}
      ${bar(bottom)}
    </div>
    <div class="zcards">${row(bottom)}</div>
    ${z.owner !== null
      ? `<div class="zone-banner p${z.owner}">
          <div class="zone-banner-name">${z.icon} ${esc(z.name)}</div>
          <div>🚩 Veroverd door</div>
          <b>${esc(g.players[z.owner].name)}</b>
        </div>`
      : ''}
  </div>`;
}

function renderShop(g: GameState): string {
  const canShop = humanCanAct();
  const slots = g.shop.market
    .map((card, i) => {
      const def = getCard(card.defId);
      const affordable = canShop && !whyCantBuy(g, card.uid);
      return `<div class="shop-slot ${affordable ? 'affordable' : ''} ${shopDeal ? 'deal-in' : ''}" style="--i:${i}" data-click="buy:${card.uid}">
        <div class="card">${renderFace(def)}</div>
        ${(() => {
          // Een Handelspost waar de speler aan zet voorstaat, maakt de kaart goedkoper.
          const price = shopPrice(g, g.active, card.defId);
          return price < (def.price ?? 0)
            ? `<div class="price discount" title="Prijs in goud: ${price} in plaats van ${def.price} (Handelspost)">${price}</div>`
            : `<div class="price" title="Prijs in goud">${def.price}</div>`;
        })()}
      </div>`;
    })
    .join('');
  return `
  <div class="shop">
    <div class="shop-title">🏪 Winkel</div>
    <div class="market">${slots || '<div class="sold-out">Uitverkocht!</div>'}</div>
    <div class="shop-stock">${g.shop.pile.length} in voorraad</div>
  </div>`;
}

function renderSidePanel(g: GameState): string {
  const p = g.players[g.active];
  const locked = !humanCanAct();
  const thinking = (computerTurn(g) || remoteTurn(g)) && g.winner === null;
  return `
  <div class="side-panel">
    <div class="match-score" title="Best-of-3: wie eerst ${GAMES_TO_WIN_MATCH} spellen wint, wint de match">
      Spel ${match.gameNo} van 3<br>${renderScore(g)}
    </div>
    <div class="turn-info ${thinking ? 'thinking' : ''}">Beurt ${g.turn}<br>${thinking
      ? computerTurn(g) ? `${levelInfo().icon} <b>${esc(p.name)}</b> denkt na…` : `🌐 <b>${esc(p.name)}</b> is aan zet…`
      : `<b>${esc(p.name)}</b> is aan zet`}</div>
    <button class="end-turn" data-click="end-turn" ${locked ? 'disabled' : ''}>Einde<br>beurt</button>
    <div class="hint">Sleep een kaart naar je <b>aflegstapel</b> (bovenste effect) of naar een <b>zone</b> (onderste effect).
      Hover over een stapel om te zien wat erin zit. Hover over je kaart in een zone om ze terug te trekken (↩).</div>
    <div class="log">${g.log.slice(-16).reverse().map((l) => `<div>${esc(l)}</div>`).join('')}</div>
    <button class="sound-toggle" data-click="sound">${isMuted() ? '🔇 Geluid uit' : '🔊 Geluid aan'}</button>
  </div>`;
}

function renderHandoff(g: GameState, to: PlayerId): string {
  return `
  <div class="overlay">
    <div class="panel">
      <div class="big-icon">${heroIcon(to)}</div>
      <h2>${esc(g.players[to].name)}, jij bent aan zet</h2>
      <p>De andere speler kijkt even weg 🙈</p>
      <button class="btn" data-click="continue">Toon mijn hand</button>
    </div>
  </div>`;
}

function renderWinner(g: GameState): string {
  const w = g.winner as PlayerId;
  const zones = g.zones.filter((z) => z.owner === w).map((z) => `${z.icon} ${esc(z.name)}`).join(' en ');
  const over = matchWinner() !== null;
  const starter = over ? null : nextStarter();
  const label = over ? '🔁 Nieuwe match' : `▶ Volgende spel · ${esc(g.players[starter!].name)} begint`;
  const next = net?.waitingNext
    ? `<p class="waiting">Wachten op ${esc(g.players[other(net.me)].name)}…</p>`
    : `<button class="btn" data-click="next-game">${label}</button>`;
  return `
  <div class="overlay">
    <div class="panel">
      <div class="big-icon">${vsComputer && w === COMPUTER ? levelInfo().icon : over ? '🏆' : '🚩'}</div>
      <h2>${esc(g.players[w].name)} wint ${over ? 'de match' : `spel ${match.gameNo}`}!</h2>
      <p>Veroverde ${zones}.</p>
      <p class="match-line">${over ? 'Eindstand' : 'Stand'}: ${renderScore(g)}</p>
      ${next}
      <button class="btn small secondary" data-click="restart">${net ? 'Verlaten' : 'Terug naar het begin'}</button>
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
      vsComputer = arg === 'ai';
      onlineTab = arg === 'online';
      netError = '';
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
    case 'sound':
      toggleMute();
      render();
      sfx.coin();
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
  if (target) dispatch({ type: 'play', handUid: d.uid, target });
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
    if (el.dataset.special) return `<div><b>✨ Speciaal</b><br>${esc(getSpecial(el.dataset.special).text)}</div>`;
    const key = el.dataset.kw as Keyword;
    const n = Number(el.dataset.n);
    return `<div><b>${keywordText(key, n)}</b><br>${KEYWORDS[key].explain(n)}</div>`;
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
  if (zfx) {
    const fx = ZONE_EFFECTS[zfx.dataset.zfx as keyof typeof ZONE_EFFECTS];
    tipEl.innerHTML = `<b>${fx.icon} ${esc(fx.label)}</b><br>${esc(fx.text)}`;
  } else if (recall && game) {
    tipEl.innerHTML = recallTip(game, recall.dataset.recall!);
  } else if (special) {
    tipEl.innerHTML = `<b>✨ Speciaal effect</b><br>${esc(getSpecial(special.dataset.special!).text)}
      <div class="tip-note">Dit effect heeft geen keyword: het hoort alleen bij deze kaart.</div>`;
  } else if (kw) {
    const key = kw.dataset.kw as Keyword;
    const n = Number(kw.dataset.n);
    tipEl.innerHTML = `<b>${keywordText(key, n)}</b><br>${KEYWORDS[key].explain(n)}`;
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
  const name = card ? getCard(card.card.defId).name : 'deze kaart';
  const short = gold < price ? `<div class="tip-note tip-warn">Je hebt maar ${gold} goud.</div>` : '';
  return `<b>↩ Terugtrekken · ${price} goud</b><br>
    Stuur ${esc(name)} uit ${esc(zone?.name ?? 'deze zone')} terug naar je aflegstapel. Zo maak je een plek vrij.
    <div class="tip-note">Elke keer dat je terugtrekt, wordt het 1 goud duurder. Daarna kost het ${price + 1} goud.</div>${short}`;
}

function pileTip(owner: string, kind: 'deck' | 'discard', cards: CardInstance[], played: CardInstance[] = []): string {
  const title = `${kind === 'deck' ? 'Stapel' : 'Aflegstapel'} van ${esc(owner)} (${cards.length})`;
  const rows = cards.length ? tipRows(cards) : '<br><i>Leeg</i>';
  // De volgorde van de trekstapel blijft geheim; enkel wat erin zit, is te zien.
  const note = kind === 'deck' ? '<div class="tip-note">Volgorde blijft geheim</div>' : '';
  const playedPart = played.length
    ? `<div class="tip-section"><b>Deze beurt gespeeld (${played.length})</b>${tipRows(played)}
        <div class="tip-note">Gaan bij Einde beurt naar de aflegstapel</div></div>`
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
    return input ? input.value.trim() || `Speler ${i + 1}` : names[i];
  }) as [string, string];
}

function levelInfo(): (typeof AI_LEVELS)[number] {
  return AI_LEVELS.find((l) => l.id === computerLevel)!;
}

function computerName(): string {
  return `Computer (${levelInfo().label})`;
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
  game = createGame(gameNames, seed, { starter, bonusGold: vsComputer ? [0, levelInfo().bonusGold] : undefined });
  gameId++;
  prevRendered = null;
  seenZoneCards.clear();
  remoteQueue = [];
  remoteBusy = false;
  if (net) net.waitingNext = false;
  // Tegen de computer of online hoeft niemand weg te kijken.
  handoff = vsComputer || net ? null : starter;
  render();
  showToast(`Spel ${gameNo}: ${game.players[starter].name} begint`);
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
  onClose: () => leaveOnline('De verbinding met je tegenstander is verbroken.'),
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
    netError = 'Een kamercode heeft 4 tekens.';
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
      if (m.protocol !== PROTOCOL) return leaveOnline('Jullie spelen met een andere versie van het spel. Ververs allebei de pagina.');
      netNames = [names[0], m.name];
      net.status = 'playing';
      match = newMatch();
      hostStartGame();
      break;
    case 'start':
      if (net.me !== 1) return;
      if (m.protocol !== PROTOCOL) return leaveOnline('Jullie spelen met een andere versie van het spel. Ververs allebei de pagina.');
      net.status = 'playing';
      netNames = m.names;
      if (m.gameNo === 1) match = newMatch();
      match.wins = [...m.wins];
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
  net.link.send({ t: 'start', protocol: PROTOCOL, seed, starter, gameNo, wins: match.wins, names: netNames });
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
    if (game && stateCheck(game) !== m.check) showToast('Let op: jullie spel loopt niet meer gelijk. Start best een nieuw spel.');
    pumpRemote();
  };
  // Net als bij de computer: een kaart van de tegenstander wordt eerst in het midden getoond.
  if (m.action.type === 'play') showcase(game, m.action, run);
  else run();
}

/** remote: de actie komt van de online tegenstander en moet niet teruggestuurd worden. */
function dispatch(action: Action, remote = false): void {
  if (!game) return;
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
  const flights = captureEffects(before, game);
  if (action.type === 'endTurn' && game.winner === null && !vsComputer && !net) handoff = game.active;
  render();
  shopDeal = false;
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
    ? `${esc(g.players[pid].name)} speelt in <b>${g.zones[target.zone].icon} ${esc(g.zones[target.zone].name)}</b>`
    : `${esc(g.players[pid].name)} legt af`;
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

/** Kiest de geluiden bij een actie door de toestand voor en na te vergelijken. */
function playSounds(action: Action, before: GameState, after: GameState, flights: Flight[], impacts: Impacts): void {
  const me = before.active;
  const opp = other(me);
  const sum = (g: GameState, f: (z: GameState['zones'][number]) => number) => g.zones.reduce((t, z) => t + f(z), 0);

  if (action.type === 'endTurn') sfx.endTurn();
  if (action.type === 'buy') sfx.buy();
  const played = action.type === 'play' ? 1 : action.type === 'discardAll' ? before.players[me].hand.length : 0;
  if (played) {
    if (impacts.slam) sfx.slam(impacts.slam.power, SLAM_IMPACT_MS / 1000);
    else if (action.type === 'play' && action.target.kind === 'zone') sfx.place();
    else for (let i = 0; i < played; i++) sfx.flick(i * 0.07);
    // De volgende geluiden starten na het laatste kaartgeluid.
    const t = (played - 1) * 0.07;
    if (after.players[me].gold > before.players[me].gold) sfx.coin(t + 0.08);
    if (sum(after, (z) => z.damage[me]) > sum(before, (z) => z.damage[me])) sfx.hit(t + 0.1);
    if (sum(after, (z) => z.damage[opp]) < sum(before, (z) => z.damage[opp])) sfx.heal(t + 0.15);
    if (sum(after, (z) => z.shield[me]) > sum(before, (z) => z.shield[me])) sfx.shield(t + 0.15);
    const drawn = after.players[me].hand.length - (before.players[me].hand.length - played);
    if (drawn > 0) sfx.deal(drawn, t + 0.2);
  }

  // Zelfde timing als de animaties in playEffects.
  for (const f of flights) {
    if (f.kind === 'return') sfx.whoosh(f.index * 0.11);
    if (f.kind === 'banish') sfx.burn(f.index * 0.09);
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
}

function findImpacts(action: Action, before: GameState, after: GameState): Impacts {
  let slam: Impacts['slam'] = null;
  if (action.type === 'play' && action.target.kind === 'zone') {
    const card = before.players[before.active].hand.find((c) => c.uid === action.handUid);
    const price = card ? getCard(card.defId).price ?? 0 : 0;
    if (price >= SLAM_PRICE) slam = { uid: action.handUid, zone: action.target.zone, power: Math.min(1, (price - SLAM_PRICE) / 2) };
  }
  const conquests = after.zones.flatMap((z, i) => (z.owner !== null && before.zones[i].owner === null ? [{ zone: i, owner: z.owner }] : []));
  return { slam, conquests, conquerAt: slam ? SLAM_IMPACT_MS + 250 : 300 };
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
  kind: 'return' | 'banish' | 'shop-out';
  pid: PlayerId;
  index: number;
}
/** Laat de nieuwe winkelkaarten bij de volgende weergave één voor één binnenkomen. */
let shopDeal = false;

function captureEffects(before: GameState, after: GameState): Flight[] {
  const flights: Flight[] = [];
  const grab = (el: HTMLElement, kind: Flight['kind'], pid: PlayerId) =>
    flights.push({ clone: el.cloneNode(true) as HTMLElement, from: el.getBoundingClientRect(), kind, pid, index: flights.length });

  before.zones.forEach((zone, zi) => {
    for (const zc of zone.cards) {
      if (after.zones[zi].cards.some((c) => c.card.uid === zc.card.uid)) continue;
      const el = app.querySelector<HTMLElement>(`[data-zcard="${zc.card.uid}"] .card`);
      if (!el) continue;
      // Teruggeroepen kaarten liggen nu op de aflegstapel; vernietigde zijn nergens meer.
      const returned = after.players[zc.player].discard.some((c) => c.uid === zc.card.uid);
      grab(el, returned ? 'return' : 'banish', zc.player);
    }
  });

  // Een aankoop vervangt één kaart; Ververs vervangt ze allemaal.
  const oldMarket = before.shop.market.map((c) => c.uid);
  if (oldMarket.length && !after.shop.market.some((c) => oldMarket.includes(c.uid))) {
    shopDeal = true;
    const start = flights.length;
    app.querySelectorAll<HTMLElement>('.shop-slot .card').forEach((el) => grab(el, 'shop-out', after.active));
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
    const s0 = f.from.width / CARD_W;
    const start = `translate(${f.from.left}px, ${f.from.top}px) scale(${s0})`;
    let anim: Animation;

    if (f.kind === 'return') {
      const pile = app.querySelector(`[data-pile="discard:${f.pid}"]`)!.getBoundingClientRect();
      const s1 = pile.width / CARD_W;
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
fit();
render();
