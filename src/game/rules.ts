/** Kaarten die je aan het begin van elke beurt trekt. */
export const HAND_SIZE = 5;
/** De beginspeler trekt in de allereerste beurt minder kaarten, als tegengewicht voor het voordeel van beginnen. */
export const FIRST_HAND_SIZE = 3;
/** Gewone levens van een zone: zoveel schade moet je er doen om ze te veroveren (zone-effecten kunnen dat veranderen). */
export const ZONE_HP = 12;
/** Aantal veroverde zones om te winnen. */
export const ZONES_TO_WIN = 2;
/** Zoveel kaarten mag elke speler in één zone hebben liggen. */
export const MAX_ZONE_CARDS = 4;
export const MARKET_SIZE = 5;
/** Handlimiet: wat je daarboven trekt, gaat meteen naar je aflegstapel. */
export const MAX_HAND = 8;

/** Aantal zones op tafel; namen en effecten worden elk spel willekeurig gekozen (zie zones.ts). */
export const ZONE_COUNT = 3;
/** Een kaart uit een zone terugtrekken kost eerst zoveel goud; elke keer dat je het doet, wordt het 1 duurder. */
export const RECALL_PRICE = 3;
/** Een match is best-of-3: wie eerst 2 spellen wint, wint de match. */
export const GAMES_TO_WIN_MATCH = 2;
