import './style.css';
import { getCard, KEYWORDS } from './game/cards';
import {
  applyAction, createGame, other, whyCantBuy, whyCantPlay, zoneCardCount, zonesOwnedBy,
} from './game/engine';
import { HAND_SIZE, MAX_ZONE_CARDS, ZONE_HP, ZONES_TO_WIN } from './game/rules';
import type { Action, CardDef, CardInstance, Effect, GameState, Keyword, PlayerId, PlayTarget } from './game/types';

const HERO_ICONS = ['🧙‍♂️', '🧝‍♀️'] as const;
const STAGE_W = 1600;
const STAGE_H = 900;
const CARD_W = 150;
const CARD_H = 210;

const stage = document.querySelector<HTMLDivElement>('#stage')!;
const app = document.querySelector<HTMLDivElement>('#app')!;
const toastEl = document.querySelector<HTMLDivElement>('#toast')!;
const tipEl = document.querySelector<HTMLDivElement>('#tip')!;

let names: [string, string] = ['Speler 1', 'Speler 2'];
let game: GameState | null = null;
/** Op een gedeeld scherm: de speler die het scherm moet krijgen voor diens hand zichtbaar wordt. */
let handoff: PlayerId | null = null;
/** Voor animaties: wat stond er bij de vorige weergave op tafel? */
let prevRendered: GameState | null = null;
const seenZoneCards = new Set<string>();
let scale = 1;

// ---------- Weergave ----------

function render(): void {
  hideTip();
  app.innerHTML = game ? renderGame(game) : renderStart();
}

function renderStart(): string {
  return `
  <div class="start">
    <h1>Rijk der Kaarten</h1>
    <p class="subtitle">Een fantasy-kaartduel voor twee spelers aan één tafel</p>
    <div class="names">
      <label>Speler 1 <input id="name0" maxlength="16" value="${esc(names[0])}"></label>
      <label>Speler 2 <input id="name1" maxlength="16" value="${esc(names[1])}"></label>
    </div>
    <button class="btn" data-click="start">Aan tafel!</button>
    <div class="rules">
      <h2>Zo speel je</h2>
      <ul>
        <li>Verover <b>${ZONES_TO_WIN} van de 3 zones</b> om te winnen. Een zone is van jou als je er als eerste ${ZONE_HP} schade doet.</li>
        <li>Elke beurt trek je ${HAND_SIZE} kaarten. Elke kaart heeft twee helften:
          sleep ze naar je <b>aflegstapel</b> voor het bovenste effect, of naar een <b>zone</b> voor het onderste.</li>
        <li>Kaarten in een zone blijven liggen, maximaal ${MAX_ZONE_CARDS} per speler per zone. Met <b>Vernietig</b> haal je ze terug.</li>
        <li>Met goud koop je sterkere kaarten in de winkel. Is je stapel leeg, dan wordt je aflegstapel geschud.</li>
        <li>Hover over een keyword zoals <b>Aanval(2)</b> om te zien wat het doet.</li>
      </ul>
    </div>
  </div>`;
}

function renderGame(g: GameState): string {
  const bottom = g.active;
  const top = other(bottom);
  const prev = prevRendered;
  prevRendered = g;
  const hidden = handoff !== null;

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
      ${renderInfo(g, bottom)}
      <div class="hand mine">${hidden ? renderBacks(g.players[bottom].hand.length) : renderHand(g, bottom)}</div>
      ${renderPiles(g, bottom, true)}
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
    <div class="portrait">${HERO_ICONS[pid]}</div>
    <div>
      <div class="player-name">${esc(p.name)}</div>
      <div class="badges">
        <span class="gold" title="Goud om kaarten te kopen in de winkel">🪙 ${p.gold}</span>
        <span class="flags" title="Veroverde zones">🚩 ${zonesOwnedBy(g, pid)}/${ZONES_TO_WIN}</span>
        ${p.slow ? `<span class="slow" title="Trekt volgende beurt ${p.slow} kaart(en) minder">⏳ −${p.slow}</span>` : ''}
      </div>
    </div>
  </div>`;
}

function renderPiles(g: GameState, pid: PlayerId, mine: boolean): string {
  const p = g.players[pid];
  const topDiscard = p.discard.at(-1);
  const stackDepth = Math.min(3, Math.ceil(p.deck.length / 4));
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
      <div class="pile-label">Aflegstapel</div>
    </div>
  </div>`;
}

function renderHand(g: GameState, pid: PlayerId): string {
  const hand = g.players[pid].hand;
  const n = hand.length;
  const overlap = n <= 5 ? -16 : Math.max(-80, -16 - (n - 5) * 14);
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
    .map((e) => `<span class="kw kw-${e.kw}" data-kw="${e.kw}" data-n="${e.amount}">${keywordText(e.kw, e.amount)}</span>`)
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
  const top = other(bottom);
  const row = (pid: PlayerId) => {
    const cards = z.cards
      .filter((c) => c.player === pid)
      .map((c) => {
        const isNew = !seenZoneCards.has(`${c.card.uid}@${c.turn}`);
        return `<div class="zslot"><div class="card ${isNew ? (pid === bottom ? 'enter-up' : 'enter-down') : ''}">${renderFace(getCard(c.card.defId))}</div></div>`;
      })
      .join('');
    const n = zoneCardCount(g, i, pid);
    const count = z.owner === null
      ? `<span class="zcount p${pid} ${n >= MAX_ZONE_CARDS ? 'full' : ''}" title="${esc(g.players[pid].name)} heeft ${n} van max. ${MAX_ZONE_CARDS} kaarten in deze zone">${n}/${MAX_ZONE_CARDS}</span>`
      : '';
    return `${cards}${count}`;
  };
  const bar = (pid: PlayerId) => {
    const dmg = z.damage[pid];
    const before = prev && prev !== g ? prev.zones[i].damage[pid] : dmg;
    const d = dmg - before;
    return `
    <div class="bar p${pid}" title="${esc(g.players[pid].name)}: ${dmg} van ${ZONE_HP} schade">
      <div class="fill ${d ? 'grow' : ''}" style="width:${(dmg / ZONE_HP) * 100}%;--from:${(before / ZONE_HP) * 100}%"></div>
      <span class="bar-text">${esc(g.players[pid].name)} · ${dmg}/${ZONE_HP}</span>
      ${z.shield[pid] ? `<span class="zshield" title="Schild: blokkeert de volgende ${z.shield[pid]} schade van de tegenstander">🛡️ ${z.shield[pid]}</span>` : ''}
      ${d ? `<div class="float ${d > 0 ? 'dmg' : 'heal'}">${d > 0 ? '+' : ''}${d}</div>` : ''}
    </div>`;
  };
  return `
  <div class="zone-area ${z.owner !== null ? 'closed' : ''}" data-drop="zone:${i}">
    <div class="zcards">${row(top)}</div>
    <div class="zone-mid">
      ${bar(top)}
      <div class="zone-name">${z.icon} ${esc(z.name)}</div>
      ${bar(bottom)}
    </div>
    <div class="zcards">${row(bottom)}</div>
    ${z.owner !== null ? `<div class="zone-banner p${z.owner}">🚩 Veroverd door<br><b>${esc(g.players[z.owner].name)}</b></div>` : ''}
  </div>`;
}

function renderShop(g: GameState): string {
  const canShop = handoff === null;
  const slots = g.shop.market
    .map((card) => {
      const def = getCard(card.defId);
      const affordable = canShop && !whyCantBuy(g, card.uid);
      return `<div class="shop-slot ${affordable ? 'affordable' : ''}" data-click="buy:${card.uid}">
        <div class="card">${renderFace(def)}</div>
        <div class="price" title="Prijs in goud">${def.price}</div>
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
  const locked = handoff !== null || g.winner !== null;
  return `
  <div class="side-panel">
    <div class="turn-info">Beurt ${g.turn}<br><b>${esc(p.name)}</b> is aan zet</div>
    <button class="end-turn" data-click="end-turn" ${locked ? 'disabled' : ''}>Einde<br>beurt</button>
    <div class="hint">Sleep een kaart naar je <b>aflegstapel</b> (bovenste effect) of naar een <b>zone</b> (onderste effect).
      Hover over een stapel om te zien wat erin zit.</div>
    <div class="log">${g.log.slice(-16).reverse().map((l) => `<div>${esc(l)}</div>`).join('')}</div>
  </div>`;
}

function renderHandoff(g: GameState, to: PlayerId): string {
  return `
  <div class="overlay">
    <div class="panel">
      <div class="big-icon">${HERO_ICONS[to]}</div>
      <h2>${esc(g.players[to].name)}, jij bent aan zet</h2>
      <p>De andere speler kijkt even weg 🙈</p>
      <button class="btn" data-click="continue">Toon mijn hand</button>
    </div>
  </div>`;
}

function renderWinner(g: GameState): string {
  const w = g.winner as PlayerId;
  const zones = g.zones.filter((z) => z.owner === w).map((z) => `${z.icon} ${esc(z.name)}`).join(' en ');
  return `
  <div class="overlay">
    <div class="panel">
      <div class="big-icon">🏆</div>
      <h2>${esc(g.players[w].name)} wint!</h2>
      <p>Veroverde ${zones}.</p>
      <button class="btn" data-click="restart">Nieuw spel</button>
    </div>
  </div>`;
}

// ---------- Klikken ----------

app.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-click]');
  const [kind, arg] = (el?.dataset.click ?? '').split(':');
  switch (kind) {
    case 'start':
      startGame();
      break;
    case 'restart':
      game = null;
      prevRendered = null;
      render();
      break;
    case 'continue':
      handoff = null;
      render();
      break;
    case 'end-turn':
      dispatch({ type: 'endTurn' });
      break;
    case 'buy':
      if (handoff === null) dispatch({ type: 'buy', marketUid: arg });
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
  if (e.button !== 0 || !game || handoff !== null || game.winner !== null) return;
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
  drag.ghost.style.transform =
    `translate(${e.clientX - (CARD_W * scale) / 2}px, ${e.clientY - (CARD_H * scale) / 2}px) scale(${scale}) rotate(-4deg)`;
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

// ---------- Tooltips: uitleg bij keywords en inhoud van stapels ----------

app.addEventListener('mouseover', (e) => {
  if (drag?.ghost) return hideTip();
  const target = e.target as HTMLElement;
  const kw = target.closest<HTMLElement>('[data-kw]');
  const pile = target.closest<HTMLElement>('[data-pile]');
  if (kw) {
    const key = kw.dataset.kw as Keyword;
    const n = Number(kw.dataset.n);
    tipEl.innerHTML = `<b>${keywordText(key, n)}</b><br>${KEYWORDS[key].explain(n)}`;
  } else if (pile && game) {
    const [kind, pid] = pile.dataset.pile!.split(':');
    tipEl.innerHTML = pileTip(game.players[Number(pid)].name, kind as 'deck' | 'discard', kind === 'deck'
      ? game.players[Number(pid)].deck
      : game.players[Number(pid)].discard);
  } else {
    return hideTip();
  }
  tipEl.classList.add('show');
});

function pileTip(owner: string, kind: 'deck' | 'discard', cards: CardInstance[]): string {
  const title = `${kind === 'deck' ? 'Stapel' : 'Aflegstapel'} van ${esc(owner)} (${cards.length})`;
  if (!cards.length) return `<b>${title}</b><br><i>Leeg</i>`;
  const counts = new Map<string, number>();
  for (const c of cards) counts.set(c.defId, (counts.get(c.defId) ?? 0) + 1);
  const rows = [...counts]
    .map(([id, n]) => ({ def: getCard(id), n }))
    .sort((a, b) => b.n - a.n || a.def.name.localeCompare(b.def.name))
    .map(({ def, n }) => `<div class="tip-row"><span>${def.icon} ${esc(def.name)}</span><span>×${n}</span></div>`)
    .join('');
  // De volgorde van de trekstapel blijft geheim; enkel wat erin zit, is te zien.
  const note = kind === 'deck' ? '<div class="tip-note">Volgorde blijft geheim</div>' : '';
  return `<b>${title}</b>${rows}${note}`;
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

function startGame(): void {
  names = [0, 1].map((i) => {
    const v = document.querySelector<HTMLInputElement>(`#name${i}`)?.value.trim();
    return v || `Speler ${i + 1}`;
  }) as [string, string];
  game = createGame(names);
  prevRendered = null;
  seenZoneCards.clear();
  handoff = 0;
  render();
}

function dispatch(action: Action): void {
  if (!game) return;
  const r = applyAction(game, action);
  if (!r.ok) {
    showToast(r.error);
    render();
    return;
  }
  game = r.state;
  if (action.type === 'endTurn' && game.winner === null) handoff = game.active;
  render();
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
