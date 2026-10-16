/** Kaarten die je aan het begin van elke beurt trekt. */
export const HAND_SIZE = 5;
/** De beginspeler trekt in de allereerste beurt minder kaarten, als tegengewicht voor het voordeel van beginnen. */
export const FIRST_HAND_SIZE = 3;
/** Schade die je in een zone moet doen om ze te veroveren. */
export const ZONE_HP = 10;
/** Aantal veroverde zones om te winnen. */
export const ZONES_TO_WIN = 2;
/** Zoveel kaarten mag elke speler in één zone hebben liggen. */
export const MAX_ZONE_CARDS = 4;
export const MARKET_SIZE = 5;
/** Handlimiet: wat je daarboven trekt, gaat meteen naar je aflegstapel. */
export const MAX_HAND = 8;

export const ZONE_SETUP = [
  { name: 'Wachttoren', icon: '🏰' },
  { name: 'Elfenwoud', icon: '🌲' },
  { name: 'Kristalgrot', icon: '💎' },
];
/** Een kaart uit een zone terugtrekken kost eerst zoveel goud; elke keer dat je het doet, wordt het 1 duurder. */
export const RECALL_PRICE = 3;
