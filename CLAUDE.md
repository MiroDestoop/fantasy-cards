# Munt of Zwaard

Een fantasy-deckbuilder voor twee spelers aan hetzelfde scherm (hotseat) of tegen de computer, op desktop, in 2D met bovenaanzicht van een speltafel.
TypeScript + Vite, zonder framework. Alle tekst in het spel én in de code (namen, commentaar, commits) is **Nederlands**.

## Starten

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # vitest, tests voor de spelregels
npm run build    # tsc + vite build naar dist/
```

Elke push naar `main` publiceert het spel automatisch op GitHub Pages (`.github/workflows/deploy.yml`).
Repository: https://github.com/MiroDestoop/fantasy-cards. `vite.config.ts` gebruikt `base: "./"` voor de Pages-submap.

## Spelregels (huidige stand)

- **Winnen:** verover 2 van de 3 zones (Wachttoren, Elfenwoud, Kristalgrot). Een zone is van jou als je er als eerste 10 schade doet; daarna is ze gesloten.
- **Stapel:** je begint met 10 startkaarten: 5× Koperen Munt (alleen Goud 1), 3× Rekruut (Goud 1 / Aanval 1 + Terugroep 1), 2× Zilveren Munt (Goud 2 / Aanval 1).
- **Beurt:** trek 5 kaarten (min Vertraag). Is je stapel leeg, dan wordt je aflegstapel geschud. Afgelegde kaarten liggen tot het einde van je beurt apart (`played`) en gaan pas bij Einde beurt, samen met je resterende hand, naar je aflegstapel. Zo kan Trek een kaart nooit twee keer in dezelfde beurt terugbrengen (vroeger gaf een kleine stapel met Trek een oneindige lus). Handlimiet 8: wat je daarboven trekt, gaat meteen naar je aflegstapel.
- **Elke kaart heeft twee helften.** Sleep ze naar je **aflegstapel** voor het bovenste effect (`top`), of naar een **zone** voor het onderste effect (`bottom`). Een kaart zonder `bottom` kan je alleen afleggen. De knop "Alles afleggen" speelt je hele hand af voor het bovenste effect.
- **Zones:** een kaart in een zone blijft daar liggen, maximaal 4 per speler per zone, ook nadat de zone veroverd is. Terugroep haalt ze terug, Vernietig verbant ze uit het spel.
- **Winkel:** een gedeelde markt van 5 kaarten. Je koopt met goud; goud blijft bewaard over beurten heen. Een gekochte kaart gaat naar je aflegstapel en de vrije plek wordt aangevuld.
- **Er is geen mana.** Dat systeem is bewust verwijderd.

**Keywords** (uitleg staat in `KEYWORDS` in `src/game/cards.ts` en verschijnt als tooltip bij hover):

| Keyword | Effect |
|---|---|
| Goud(x) | x goud erbij |
| Aanval(x) | x schade in deze zone |
| Storm(x) | x schade in elke open zone |
| Herstel(x) | haal x schade van de tegenstander in deze zone weg |
| Schild(x) | blokkeer de volgende x schade van de tegenstander in deze zone |
| Trek(x) | trek x kaarten |
| Vertraag(x) | de tegenstander trekt volgende beurt x kaarten minder |
| Terugroep(x) | je x oudste kaarten in deze zone gaan naar je aflegstapel |
| Vernietig | verban al je kaarten in deze zone uit het spel |
| Ververs | vervang de hele winkel; de oude kaarten gaan onderaan de voorraad |

Terugroep en Vernietig gebeuren **voordat** de kaart zelf in de zone gelegd wordt (`BEFORE_PLACING` in `engine.ts`). Daardoor mogen kaarten met die keywords ook in een volle zone gespeeld worden.

## Code

| Bestand | Rol |
|---|---|
| `src/game/rules.ts` | Constanten: handgrootte, levens per zone, zones om te winnen, max kaarten per zone, handlimiet, zones |
| `src/game/types.ts` | Alle types: `GameState`, `Action`, `CardDef` (`top`/`bottom`), `Effect`, `Keyword` |
| `src/game/cards.ts` | `KEYWORDS` (label + uitleg), alle kaarten (`CARD_LIST`), `STARTER_DECK`, `SHOP_SUPPLY` |
| `src/game/engine.ts` | Spelregels: `createGame`, `applyAction`, `whyCantPlay`, `whyCantBuy` |
| `src/game/engine.test.ts` | Tests voor de regels |
| `src/game/ai.ts` | Computertegenstander: `chooseAction(state)` geeft één actie voor de speler aan zet |
| `src/game/ai.test.ts` | Tests voor de computertegenstander |
| `src/main.ts` | Weergave, klikken, slepen, tooltips, animaties, geluid-triggers |
| `src/style.css` | Alle stijlen |
| `src/sound.ts` | Geluidseffecten via Web Audio (geen bestanden), aan/uit bewaard in localStorage |
| `src/zoneArt.ts` | Inline-SVG illustraties per zone (op zonenaam) |

**Engine**
- `applyAction(state, action)` is puur: ze werkt op een `structuredClone` en geeft `{ok, state}` of `{ok:false, error}` terug, met een Nederlandse foutmelding die de UI als toast toont.
- Toeval gebeurt via een seed in de state (mulberry32), zodat spellen reproduceerbaar zijn. Tests gebruiken vaste seeds.

**UI**
- Elke wijziging tekent de hele tafel opnieuw via `innerHTML`.
- Interactie via data-attributen: `data-click`, `data-drag` (handkaart), `data-drop` (`discard` / `zone:i`), `data-kw` (keyword-tooltip), `data-pile` (stapel-tooltip).
- De tafel heeft een vaste ontwerpgrootte van 1600×900 en wordt geschaald naar het venster (`--scale`).
- **Hover zonder glitch:** de buitenste "slot" ligt stil en vangt de muis op; alleen de `.card` erin beweegt en heeft `pointer-events: none`. Keywords zetten `pointer-events` terug aan voor hun tooltip. Gebruik hetzelfde patroon voor nieuwe hover-effecten.
- **Animaties:** `captureEffects` legt de DOM-posities vast vóór het opnieuw tekenen. `playEffects` laat daarna kopieën vliegen of verbranden.
- **Geluiden:** `playSounds` kiest de geluiden door de toestand voor en na een actie te vergelijken.
- **Hotseat:** na "Einde beurt" verschijnt een wisselscherm (`handoff`) dat de hand verbergt. De speler die aan zet is, zit altijd onderaan.
- **Tegen de computer:** keuze op het startscherm (`vsComputer`). De mens is speler 0 en zit altijd onderaan, er is geen wisselscherm. `scheduleComputer` laat de computer zet per zet spelen via `dispatch`, met een pauze ertussen. De computer speelt eerst haar hele hand: voor elke kaart probeert ze elke bestemming op een kopie uit en kiest ze de beste toestand volgens `evaluate`. Daarna koopt ze de duurste betaalbare kaart (vanaf 3 goud) en eindigt ze haar beurt.

**Een kaart of keyword toevoegen**
- **Kaart:** voeg ze toe aan `CARD_LIST` en aan `SHOP_SUPPLY` (of aan `STARTER_DECK`).
- **Keyword:** pas vier plekken aan:
  - de `Keyword`-union in `types.ts`
  - een entry in `KEYWORDS` in `cards.ts` (met `noAmount: true` als het geen getal heeft)
  - een `case` in `applyEffect` in `engine.ts`
  - een kleur `.kw-<naam> { --edge: … }` in `style.css`

  Schrijf er ook een test bij.

## Werkafspraken

- Antwoord in het Nederlands.
- Laten de wensen een keuze open, maak die dan zelf en **vermeld ze expliciet** als "keuzes die ik zelf maakte", zodat de gebruiker kan bijsturen.
- Controleer na elke wijziging met `npx tsc`, `npx vitest run` en `npx vite build`.
- Zeg eerlijk dat je visuals en geluid niet zelf kunt zien of horen: de gebruiker test in de browser.
- **Commit en push alleen na akkoord.** Stel na een wijziging een Nederlandse commitboodschap voor en vraag of je mag committen en pushen. "push" of "ok" van de gebruiker is dat akkoord.

## Ideeën en mogelijke volgende stappen

- `ideeen/characterTypesImages.jpg`: een plaat met 12 personagetypes (paladin, archer, mage, druid, bard, necromancer, shaman, warrior, elementalist, thief, barbarian, priest). Dat is mogelijk inspiratie voor klassen of helden. Nog niet besproken of gebouwd.
- Eerder geopperd, nog niet gebouwd: moeilijkheidsgraden voor de computer, online multiplayer (de engine is al los van de UI), balans van kaartprijzen en waarden, echte illustraties voor kaarten.
