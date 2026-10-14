// Geluidseffecten, gemaakt met de Web Audio API: er zijn geen geluidsbestanden nodig.
// Elke functie neemt een optionele vertraging in seconden, zodat geluiden op animaties aansluiten.

const STORAGE_KEY = 'fantasy-cards-muted';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = loadMuted();

function loadMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // Opslaan lukt niet (bv. privévenster): de keuze geldt dan alleen voor deze sessie.
  }
  return muted;
}

/** De audiocontext mag pas starten na een klik van de speler, dus die maken we pas bij het eerste geluid. */
function audio(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function envelope(ac: AudioContext, t: number, dur: number, vol: number): GainNode {
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(master!);
  return g;
}

function tone(delay: number, freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; slideTo?: number } = {}) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t + dur);
  osc.connect(envelope(ac, t, dur, opts.vol ?? 0.3));
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(
  delay: number,
  dur: number,
  opts: { filter?: BiquadFilterType; freq?: number; freqTo?: number; q?: number; vol?: number } = {},
) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ac.createBiquadFilter();
  filter.type = opts.filter ?? 'lowpass';
  filter.frequency.setValueAtTime(opts.freq ?? 1000, t);
  if (opts.freqTo) filter.frequency.exponentialRampToValueAtTime(opts.freqTo, t + dur);
  filter.Q.value = opts.q ?? 1;
  src.connect(filter);
  filter.connect(envelope(ac, t, dur, opts.vol ?? 0.3));
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

export const sfx = {
  /** Kaart op tafel leggen in een zone. */
  place(d = 0) {
    noise(d, 0.09, { filter: 'lowpass', freq: 900, vol: 0.5 });
    tone(d, 130, 0.12, { type: 'triangle', vol: 0.3, slideTo: 60 });
  },
  /** Kaart op de aflegstapel gooien. */
  flick(d = 0) {
    noise(d, 0.07, { filter: 'bandpass', freq: 3200, freqTo: 1200, q: 1.5, vol: 0.35 });
  },
  /** Kaarten trekken of uitdelen. */
  deal(n: number, d = 0) {
    for (let i = 0; i < n; i++) noise(d + i * 0.08, 0.06, { filter: 'bandpass', freq: 2600, freqTo: 1400, q: 2, vol: 0.25 });
  },
  coin(d = 0) {
    tone(d, 1320, 0.12, { vol: 0.15 });
    tone(d + 0.07, 1760, 0.25, { vol: 0.15 });
  },
  buy(d = 0) {
    sfx.coin(d);
    sfx.coin(d + 0.12);
    tone(d + 0.25, 880, 0.35, { type: 'triangle', vol: 0.12 });
    tone(d + 0.25, 1320, 0.35, { type: 'triangle', vol: 0.08 });
  },
  /** Schade in een zone. */
  hit(d = 0) {
    noise(d, 0.22, { filter: 'lowpass', freq: 500, vol: 0.6 });
    tone(d, 90, 0.3, { vol: 0.5, slideTo: 40 });
  },
  heal(d = 0) {
    [660, 880, 1100].forEach((f, i) => tone(d + i * 0.08, f, 0.3, { vol: 0.12 }));
  },
  shield(d = 0) {
    tone(d, 900, 0.5, { type: 'triangle', vol: 0.14 });
    tone(d, 1353, 0.4, { type: 'sine', vol: 0.08 });
    tone(d + 0.02, 2210, 0.25, { type: 'sine', vol: 0.04 });
  },
  /** Terugroep: een kaart die wegsuist. */
  whoosh(d = 0) {
    noise(d, 0.45, { filter: 'bandpass', freq: 350, freqTo: 2800, q: 1.2, vol: 0.35 });
  },
  /** Vernietig: knetterend vuur. */
  burn(d = 0) {
    noise(d, 0.9, { filter: 'lowpass', freq: 1400, freqTo: 300, vol: 0.35 });
    tone(d, 70, 0.8, { type: 'sawtooth', vol: 0.06, slideTo: 40 });
    for (let i = 0; i < 12; i++) noise(d + 0.1 + Math.random() * 0.8, 0.02, { filter: 'highpass', freq: 3000, vol: 0.4 });
  },
  /** Ververs: de winkel wordt geschud. */
  shuffle(d = 0) {
    for (let i = 0; i < 9; i++) noise(d + i * 0.045, 0.05, { filter: 'bandpass', freq: 2200 + (i % 3) * 600, q: 1.5, vol: 0.22 });
  },
  conquer(d = 0) {
    [523, 659, 784].forEach((f, i) => tone(d + i * 0.13, f, 0.2, { type: 'triangle', vol: 0.2 }));
    tone(d + 0.39, 1046, 0.7, { type: 'triangle', vol: 0.22 });
    tone(d + 0.39, 523, 0.7, { type: 'sine', vol: 0.12 });
  },
  victory(d = 0) {
    const notes = [523, 523, 523, 659, 784, 659, 784, 1046];
    const times = [0, 0.15, 0.3, 0.45, 0.75, 0.95, 1.1, 1.3];
    notes.forEach((f, i) => tone(d + times[i], f, i === notes.length - 1 ? 1.2 : 0.22, { type: 'triangle', vol: 0.22 }));
    tone(d + 1.3, 262, 1.2, { type: 'sine', vol: 0.15 });
  },
  /** Einde beurt: een zachte gong. */
  endTurn(d = 0) {
    tone(d, 196, 1.2, { vol: 0.25 });
    tone(d, 294, 1.0, { vol: 0.1 });
    tone(d, 523, 0.6, { type: 'triangle', vol: 0.04 });
  },
  error(d = 0) {
    tone(d, 150, 0.15, { type: 'square', vol: 0.06 });
    tone(d + 0.1, 110, 0.2, { type: 'square', vol: 0.06 });
  },
};
