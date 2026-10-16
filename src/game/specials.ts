import { tr } from './i18n';
import type { GameState, PlayerId, PlayerState, Zone } from './types';
import { zoneCapacity } from './zones';

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
  /** Het nummer van die zone, of null. */
  zoneIdx: number | null;
  /** Doe schade in deze zone, met schild en verovering zoals bij Aanval. Bij afleggen doet dit niets. */
  damage: (amount: number) => void;
  /** Trek kaarten, met schudden en handlimiet zoals bij Trek. */
  draw: (count: number) => void;
  /** Zet een regel in het logboek opzij. */
  log: (message: string) => void;
  /** Vernietig zoals het keyword: verban je andere kaarten in deze zone. Geeft het aantal kaarten dat de zone verliet. */
  destroy: () => number;
}

export interface SpecialDef {
  /** De tekst op de kaart (een getter, in de gekozen taal). Hou ze kort: er is maar plaats voor een regel of drie. */
  readonly text: string;
  run: (ctx: SpecialContext) => void;
}

// Speciale effecten: een effect dat alleen bij één of enkele kaarten hoort en geen eigen keyword waard is.
// Gebruik ze op een kaart met special('naam') in cards.ts.
export const SPECIALS: Record<string, SpecialDef> = {
  dubbelgoud: {
    get text() { return tr('Verdubbel je goud (max. +6).', 'Double your gold (max. +6).'); },
    run: ({ me }) => {
      me.gold += Math.min(me.gold, 10);
    },
  },
  diefstal: {
    get text() { return tr('Steel al het goud van je tegenstander.', "Steal all your opponent's gold."); },
    run: ({ me, opp, log }) => {
      const stolen = opp.gold;
      me.gold += stolen;
      opp.gold = 0;
      log(stolen
        ? tr(`👺 ${me.name} steelt ${stolen} goud van ${opp.name}!`, `👺 ${me.name} steals ${stolen} gold from ${opp.name}!`)
        : tr(`👺 ${opp.name} heeft geen goud om te stelen.`, `👺 ${opp.name} has no gold to steal.`));
    },
  },
  ram: {
    get text() { return tr('+5 schade als je tegenstander hier een Schild heeft.', '+5 damage if your opponent has a Shield here.'); },
    run: ({ zone, oppId, damage }) => {
      if (zone && zone.shield[oppId] > 0) damage(5);
    },
  },
  // De twee volgende doen niets op het moment zelf: de engine kijkt ernaar (zie hasSpecial in engine.ts).
  huur: {
    get text() { return tr('Gaat aan het einde van je beurt terug naar de winkel.', 'Returns to the shop at the end of your turn.'); },
    run: () => {},
  },
  wedergeboorte: {
    get text() { return tr('Vernietigd of teruggeroepen? Dan keert ze terug in je hand.', 'Destroyed or recalled? She returns to your hand.'); },
    run: () => {},
  },
  zielenoogst: {
    get text() { return tr('Vernietig. 2 schade per verbannen kaart.', 'Destroy. 2 damage per banished card.'); },
    run: ({ destroy, damage }) => {
      damage(destroy() * 2);
    },
  },
  leegveld: {
    get text() { return tr('2 schade per lege plek van je tegenstander hier.', "2 damage per empty opponent's slot here."); },
    run: ({ zone, oppId, damage }) => {
      if (zone) damage(2 * Math.max(0, zoneCapacity(zone) - zone.cards.filter((c) => c.player === oppId).length));
    },
  },
  wraak: {
    get text() { return tr('1 schade per kaart van je tegenstander hier.', "1 damage per opponent's card here."); },
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
