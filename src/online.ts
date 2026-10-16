// Online spelen: twee browsers verbinden rechtstreeks met elkaar (WebRTC via PeerJS).
// De gratis PeerJS-server helpt alleen om elkaar te vinden met een kamercode; het spel zelf loopt van browser naar browser.
// Beide kanten draaien dezelfde engine: omdat die voorspelbaar is (seed in de state), sturen we alleen de acties door.

import Peer, { type DataConnection } from 'peerjs';
import type { Action, PlayerId } from './game/types';

/** Verhoog dit als berichten of spelregels veranderen, zodat oude en nieuwe versies niet met elkaar spelen. */
export const PROTOCOL = 2;
const PREFIX = 'munt-of-zwaard-';
/** Zonder letters die op elkaar lijken (0/O, 1/I/L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PING_MS = 2000;
/** Zo lang zonder enig bericht en de verbinding geldt als verbroken. */
const TIMEOUT_MS = 10000;

export type Msg =
  | { t: 'hello'; name: string; protocol: number }
  /** De host start een spel; de gast neemt de stand van de match over. */
  | { t: 'start'; protocol: number; seed: number; starter: PlayerId; gameNo: number; wins: [number, number]; names: [string, string] }
  /** check: korte samenvatting van de toestand na de actie, om verschillen meteen te zien. */
  | { t: 'action'; action: Action; check: string }
  /** De gast vraagt het volgende spel; de host start het. */
  | { t: 'next' }
  /** Hartslag: zo merken we snel dat de tegenstander weg is (WebRTC zelf merkt dat traag of niet). */
  | { t: 'ping' };

export interface Link {
  send(m: Msg): void;
  close(): void;
}

export interface LinkEvents {
  onMessage(m: Msg): void;
  onClose(): void;
}

export function makeCode(): string {
  return Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
}

function wrap(peer: Peer, conn: DataConnection, ev: LinkEvents): Link {
  let closed = false;
  let lastHeard = Date.now();
  const timer = window.setInterval(() => {
    if (Date.now() - lastHeard > TIMEOUT_MS) return close();
    conn.send({ t: 'ping' } satisfies Msg);
  }, PING_MS);
  // Wie de pagina sluit, laat het de ander meteen weten.
  const onUnload = () => conn.close();
  window.addEventListener('pagehide', onUnload);
  const stop = () => {
    closed = true;
    clearInterval(timer);
    window.removeEventListener('pagehide', onUnload);
  };
  const close = () => {
    if (closed) return;
    stop();
    ev.onClose();
  };
  conn.on('data', (d) => {
    lastHeard = Date.now();
    if ((d as Msg).t !== 'ping') ev.onMessage(d as Msg);
  });
  conn.on('close', close);
  conn.on('error', close);
  peer.on('disconnected', () => {
    // De verbinding met de zoekserver valt weg; het spel zelf kan gewoon doorlopen.
    if (!closed) peer.reconnect();
  });
  return {
    send: (m) => conn.send(m),
    close: () => {
      stop();
      peer.destroy();
    },
  };
}

/** Maakt een kamer en wacht op een gast. Geeft een functie terug om het wachten te stoppen. */
export function hostRoom(
  code: string,
  ev: LinkEvents & { onReady(): void; onGuest(link: Link): void; onError(msg: string, retry: boolean): void },
): () => void {
  const peer = new Peer(PREFIX + code);
  let taken = false;
  peer.on('open', () => ev.onReady());
  peer.on('connection', (conn) => {
    if (taken) return conn.close();
    taken = true;
    conn.on('open', () => ev.onGuest(wrap(peer, conn, ev)));
  });
  peer.on('error', (err) => {
    if (taken) return;
    if (err.type === 'unavailable-id') ev.onError('Die kamercode is al in gebruik.', true);
    else ev.onError('Geen verbinding met de server om een kamer te maken.', false);
  });
  return () => peer.destroy();
}

/** Verbindt met de kamer van een host. */
export function joinRoom(code: string, ev: LinkEvents & { onJoined(link: Link): void; onError(msg: string): void }): () => void {
  const peer = new Peer();
  let joined = false;
  peer.on('open', () => {
    const conn = peer.connect(PREFIX + code.toUpperCase(), { reliable: true });
    conn.on('open', () => {
      joined = true;
      ev.onJoined(wrap(peer, conn, ev));
    });
  });
  peer.on('error', (err) => {
    if (joined) return;
    ev.onError(err.type === 'peer-unavailable' ? `Geen kamer gevonden met code ${code.toUpperCase()}.` : 'Verbinden lukt niet.');
    peer.destroy();
  });
  return () => peer.destroy();
}
