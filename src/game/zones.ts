// Zones: elk spel krijgt 3 willekeurige namen uit ZONE_NAMES, elk met een ander willekeurig effect uit ZONE_EFFECTS.

import { ZONE_HP } from './rules';
import type { Zone } from './types';

export const ZONE_NAMES = [
  { name: 'Wachttoren', icon: '🏰' },
  { name: 'Elfenwoud', icon: '🌲' },
  { name: 'Kristalgrot', icon: '💎' },
  { name: 'Drakennest', icon: '🌋' },
  { name: 'Spookmoeras', icon: '🦇' },
  { name: 'Zonnetempel', icon: '☀️' },
];

export type ZoneEffectId =
  | 'vesting' | 'bouwval' | 'slagveld' | 'mist' | 'goudader'
  | 'schatkamer' | 'tolpoort' | 'zwaretocht' | 'bibliotheek';

export interface ZoneEffectDef {
  id: ZoneEffectId;
  icon: string;
  label: string;
  /** Korte uitleg, voor op het scherm en in het logboek. */
  text: string;
  /** Levens van de zone tegenover de gewone ZONE_HP. */
  hpBonus?: number;
  /** Vaste levens voor deze zone, in plaats van ZONE_HP. */
  hp?: number;
  /** Extra (of minder) schade bij elke aanval in deze zone: Aanval, Storm en speciale schade. */
  damageBonus?: number;
  /** Goud aan het begin van je beurt als je in deze open zone meer schade hebt gedaan dan je tegenstander. */
  goldIfLeading?: number;
  /** Elke keer dat je hier een kaart speelt (nadat haar effecten gewerkt hebben): */
  onPlay?: {
    /** zoveel goud erbij */
    gold?: number;
    /** zoveel kaarten trekken */
    draw?: number;
    /** zoveel kaarten minder trekken in je volgende beurt (Vertraag op jezelf) */
    selfSlow?: number;
  };
  /** Zoveel goud betaal je om hier een kaart te spelen; zonder dat goud kan het niet. */
  playCost?: number;
}

export const ZONE_EFFECTS: Record<ZoneEffectId, ZoneEffectDef> = {
  vesting: { id: 'vesting', icon: '🧱', label: 'Vesting', hpBonus: 2, text: `Sterke muren: deze zone heeft ${ZONE_HP + 2} levens in plaats van ${ZONE_HP}.` },
  bouwval: { id: 'bouwval', icon: '🏚️', label: 'Bouwval', hpBonus: -2, text: `Half ingestort: deze zone heeft maar ${ZONE_HP - 2} levens in plaats van ${ZONE_HP}.` },
  slagveld: { id: 'slagveld', icon: '⚔️', label: 'Slagveld', hp: 16, damageBonus: 1, text: 'Een groot slagveld met 16 levens, maar elke aanval hier doet 1 schade meer (Aanval, Storm en speciale schade).' },
  mist: { id: 'mist', icon: '🌫️', label: 'Dichte mist', hp: 8, damageBonus: -1, text: 'Een kleine zone met maar 8 levens, maar elke aanval hier doet 1 schade minder (Aanval, Storm en speciale schade).' },
  schatkamer: { id: 'schatkamer', icon: '🪙', label: 'Schatkamer', onPlay: { gold: 1 }, text: 'Speel je hier een kaart, dan krijg je 1 goud.' },
  tolpoort: { id: 'tolpoort', icon: '🚧', label: 'Tolpoort', playCost: 1, text: 'Een kaart hier spelen kost 1 goud. Zonder goud kom je er niet in.' },
  zwaretocht: { id: 'zwaretocht', icon: '🥾', label: 'Zware tocht', onPlay: { selfSlow: 1 }, text: 'Speel je hier een kaart, dan trek je volgende beurt 1 kaart minder (Vertraag 1 op jezelf).' },
  bibliotheek: { id: 'bibliotheek', icon: '📚', label: 'Bibliotheek', onPlay: { draw: 1 }, text: 'Speel je hier een kaart, dan trek je 1 kaart.' },
  goudader: { id: 'goudader', icon: '💰', label: 'Goudader', goldIfLeading: 1, text: 'Sta je hier voor (meer schade dan je tegenstander) aan het begin van je beurt, dan krijg je 1 goud.' },
};

export function zoneEffect(z: Zone): ZoneEffectDef | null {
  return z.effect ? ZONE_EFFECTS[z.effect] : null;
}

/** Maakt een zone met een naam en een effect (of zonder effect, voor tests). */
export function makeZone(name: { name: string; icon: string }, effect: ZoneEffectId | null): Zone {
  const def = effect ? ZONE_EFFECTS[effect] : null;
  const hp = def?.hp ?? ZONE_HP + (def?.hpBonus ?? 0);
  return { ...name, effect, hp, damage: [0, 0], shield: [0, 0], owner: null, cards: [] };
}
