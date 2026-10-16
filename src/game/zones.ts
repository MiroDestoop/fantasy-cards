// Zones: elk spel krijgt 3 willekeurige namen uit ZONE_NAMES, elk met een ander willekeurig effect uit ZONE_EFFECTS.

import { tr } from './i18n';
import { MAX_ZONE_CARDS, ZONE_HP } from './rules';
import type { Zone } from './types';

export const ZONE_NAMES = [
  { name: 'Wachttoren', icon: '🏰' },
  { name: 'Elfenwoud', icon: '🌲' },
  { name: 'Kristalgrot', icon: '💎' },
  { name: 'Drakennest', icon: '🌋' },
  { name: 'Spookmoeras', icon: '🦇' },
  { name: 'Zonnetempel', icon: '☀️' },
];

const ZONE_NAMES_EN: Record<string, string> = {
  Wachttoren: 'Watchtower', Elfenwoud: 'Elven Wood', Kristalgrot: 'Crystal Cave',
  Drakennest: "Dragon's Nest", Spookmoeras: 'Haunted Swamp', Zonnetempel: 'Sun Temple',
};

/** De naam van een zone in de gekozen taal. In de toestand staat altijd de Nederlandse naam (ook voor de illustratie). */
export function zoneName(z: { name: string }): string {
  return tr(z.name, ZONE_NAMES_EN[z.name] ?? z.name);
}

export type ZoneEffectId =
  | 'vesting' | 'bouwval' | 'slagveld' | 'mist' | 'goudader'
  | 'schatkamer' | 'tolpoort' | 'zwaretocht' | 'bibliotheek'
  | 'bron' | 'handelspost' | 'smallepas';

export interface ZoneEffectDef {
  id: ZoneEffectId;
  icon: string;
  /** Naam en uitleg zijn getters, in de gekozen taal. */
  readonly label: string;
  /** Korte uitleg, voor op het scherm en in het logboek. */
  readonly text: string;
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
  /** Aan het begin van je beurt verdwijnt zoveel schade van je tegenstander in deze open zone. */
  healEachTurn?: number;
  /** Sta je in deze open zone voor, dan kost elke winkelkaart zoveel goud minder (minimum 1). */
  shopDiscountIfLeading?: number;
  /** Zoveel kaarten per speler passen hier, in plaats van MAX_ZONE_CARDS. */
  maxCards?: number;
}

export const ZONE_EFFECTS: Record<ZoneEffectId, ZoneEffectDef> = {
  vesting: { id: 'vesting', icon: '🧱', hpBonus: 2, get label() { return tr('Vesting', 'Fortress'); }, get text() { return tr(`Sterke muren: deze zone heeft ${ZONE_HP + 2} levens in plaats van ${ZONE_HP}.`, `Strong walls: this zone has ${ZONE_HP + 2} health instead of ${ZONE_HP}.`); } },
  bouwval: { id: 'bouwval', icon: '🏚️', hpBonus: -2, get label() { return tr('Bouwval', 'Ruin'); }, get text() { return tr(`Half ingestort: deze zone heeft maar ${ZONE_HP - 2} levens in plaats van ${ZONE_HP}.`, `Half collapsed: this zone has only ${ZONE_HP - 2} health instead of ${ZONE_HP}.`); } },
  slagveld: { id: 'slagveld', icon: '⚔️', hp: 16, damageBonus: 1, get label() { return tr('Slagveld', 'Battlefield'); }, get text() { return tr('Een groot slagveld met 16 levens, maar elke aanval hier doet 1 schade meer (Aanval, Storm en speciale schade).', 'A large battlefield with 16 health, but every attack here deals 1 extra damage (Attack, Storm and special damage).'); } },
  mist: { id: 'mist', icon: '🌫️', hp: 8, damageBonus: -1, get label() { return tr('Dichte mist', 'Thick Fog'); }, get text() { return tr('Een kleine zone met maar 8 levens, maar elke aanval hier doet 1 schade minder (Aanval, Storm en speciale schade).', 'A small zone with only 8 health, but every attack here deals 1 less damage (Attack, Storm and special damage).'); } },
  schatkamer: { id: 'schatkamer', icon: '🪙', onPlay: { gold: 1 }, get label() { return tr('Schatkamer', 'Treasury'); }, get text() { return tr('Speel je hier een kaart, dan krijg je 1 goud.', 'Play a card here and you gain 1 gold.'); } },
  tolpoort: { id: 'tolpoort', icon: '🚧', playCost: 1, get label() { return tr('Tolpoort', 'Toll Gate'); }, get text() { return tr('Een kaart hier spelen kost 1 goud. Zonder goud kom je er niet in.', 'Playing a card here costs 1 gold. Without gold you cannot get in.'); } },
  zwaretocht: { id: 'zwaretocht', icon: '🥾', onPlay: { selfSlow: 1 }, get label() { return tr('Zware tocht', 'Hard March'); }, get text() { return tr('Speel je hier een kaart, dan trek je volgende beurt 1 kaart minder (Vertraag 1 op jezelf).', 'Play a card here and you draw 1 card fewer next turn (Slow 1 on yourself).'); } },
  bibliotheek: { id: 'bibliotheek', icon: '📚', onPlay: { draw: 1 }, get label() { return tr('Bibliotheek', 'Library'); }, get text() { return tr('Speel je hier een kaart, dan trek je 1 kaart.', 'Play a card here and you draw 1 card.'); } },
  bron: { id: 'bron', icon: '🕊️', healEachTurn: 1, get label() { return tr('Heilige bron', 'Holy Spring'); }, get text() { return tr('Aan het begin van je beurt verdwijnt hier 1 schade van je tegenstander.', 'At the start of your turn, 1 of your opponent\'s damage here disappears.'); } },
  handelspost: { id: 'handelspost', icon: '⚖️', shopDiscountIfLeading: 1, get label() { return tr('Handelspost', 'Trading Post'); }, get text() { return tr('Sta je hier voor (meer schade dan je tegenstander), dan kost elke kaart in de winkel 1 goud minder (minimum 1).', 'If you lead here (more damage than your opponent), every card in the shop costs 1 gold less (minimum 1).'); } },
  smallepas: { id: 'smallepas', icon: '🏔️', maxCards: 3, get label() { return tr('Smalle pas', 'Narrow Pass'); }, get text() { return tr(`Hier passen maar 3 kaarten per speler in plaats van ${MAX_ZONE_CARDS}.`, `Only 3 cards per player fit here instead of ${MAX_ZONE_CARDS}.`); } },
  goudader: { id: 'goudader', icon: '💰', goldIfLeading: 1, get label() { return tr('Goudader', 'Gold Vein'); }, get text() { return tr('Sta je hier voor (meer schade dan je tegenstander) aan het begin van je beurt, dan krijg je 1 goud.', 'If you lead here (more damage than your opponent) at the start of your turn, you gain 1 gold.'); } },
};

export function zoneEffect(z: Zone): ZoneEffectDef | null {
  return z.effect ? ZONE_EFFECTS[z.effect] : null;
}

/** Hoeveel kaarten elke speler in deze zone kwijt kan. */
export function zoneCapacity(z: Zone): number {
  return zoneEffect(z)?.maxCards ?? MAX_ZONE_CARDS;
}

/** Leidt deze speler in deze open zone (meer schade dan de tegenstander)? */
export function leadsZone(z: Zone, pid: 0 | 1): boolean {
  return z.owner === null && z.damage[pid] > z.damage[pid === 0 ? 1 : 0];
}

/** Maakt een zone met een naam en een effect (of zonder effect, voor tests). */
export function makeZone(name: { name: string; icon: string }, effect: ZoneEffectId | null): Zone {
  const def = effect ? ZONE_EFFECTS[effect] : null;
  const hp = def?.hp ?? ZONE_HP + (def?.hpBonus ?? 0);
  return { ...name, effect, hp, damage: [0, 0], shield: [0, 0], owner: null, cards: [] };
}
