import type { GameState, PlayerId, PlayerState, Zone } from './types';

/** Alles wat een speciaal effect mag gebruiken. Wat je hier aanpast, werkt op een kopie van het spel. */
export interface SpecialContext {
  state: GameState;
  /** De speler die de kaart speelt. */
  me: PlayerState;
  meId: PlayerId;
  opp: PlayerState;
  oppId: PlayerId;
  /** De zone waarin de kaart gespeeld werd, of null als ze afgelegd werd. */
  zone: Zone | null;
  /** Doe schade in deze zone, met schild en verovering zoals bij Aanval. Bij afleggen doet dit niets. */
  damage: (amount: number) => void;
  /** Trek kaarten, met schudden en handlimiet zoals bij Trek. */
  draw: (count: number) => void;
  /** Zet een regel in het logboek opzij. */
  log: (message: string) => void;
}

export interface SpecialDef {
  /** De tekst op de kaart. Hou ze kort: er is maar plaats voor een regel of drie. */
  text: string;
  run: (ctx: SpecialContext) => void;
}

// Speciale effecten: een effect dat alleen bij één of enkele kaarten hoort en geen eigen keyword waard is.
// Gebruik ze op een kaart met special('naam') in cards.ts.
export const SPECIALS: Record<string, SpecialDef> = {
  dubbelgoud: {
    text: 'Verdubbel je goud (max. +6).',
    run: ({ me }) => {
      me.gold += Math.min(me.gold, 6);
    },
  },
  diefstal: {
    text: 'Steel al het goud van je tegenstander.',
    run: ({ me, opp, log }) => {
      const stolen = opp.gold;
      me.gold += stolen;
      opp.gold = 0;
      log(stolen ? `👺 ${me.name} steelt ${stolen} goud van ${opp.name}!` : `👺 ${opp.name} heeft geen goud om te stelen.`);
    },
  },
  wraak: {
    text: '1 schade per kaart van je tegenstander hier.',
    run: ({ zone, oppId, damage }) => {
      if (zone) damage(zone.cards.filter((c) => c.player === oppId).length);
    },
  },
};

export function getSpecial(id: string): SpecialDef {
  const def = SPECIALS[id];
  if (!def) throw new Error(`Onbekend speciaal effect: ${id}`);
  return def;
}
