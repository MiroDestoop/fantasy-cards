// Talen: Nederlands (standaard) en Engels.
// Tekst staat in de code als tr('Nederlands', 'English'), zodat beide versies naast elkaar blijven.
// Het logboek wordt geschreven in de taal van het moment: online schrijft elke speler zijn eigen logboek, dus
// iedereen leest het in zijn eigen taal.

export type Lang = 'nl' | 'en';

let lang: Lang = 'nl';

export function getLang(): Lang {
  return lang;
}

export function setLang(l: Lang): void {
  lang = l;
}

export function tr(nl: string, en: string): string {
  return lang === 'en' ? en : nl;
}

/** "1 kaart" / "2 kaarten" in de gekozen taal. */
export function cardsWord(n: number): string {
  return lang === 'en' ? `${n} card${n === 1 ? '' : 's'}` : `${n} kaart${n === 1 ? '' : 'en'}`;
}
