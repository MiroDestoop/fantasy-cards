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
- **Beurt:** trek 5 kaarten (min Vertraag). Alleen de allereerste beurt van het spel (de beginspeler) trekt er 3 (`FIRST_HAND_SIZE`). Is je stapel leeg, dan wordt je aflegstapel geschud. Afgelegde kaarten liggen tot het einde van je beurt apart (`played`) en gaan pas bij Einde beurt, samen met je resterende hand, naar je aflegstapel. Zo kan Trek een kaart nooit twee keer in dezelfde beurt terugbrengen (vroeger gaf een kleine stapel met Trek een oneindige lus). Handlimiet 8: wat je daarboven trekt, gaat meteen naar je aflegstapel.
- **Elke kaart heeft twee helften.** Sleep ze naar je **aflegstapel** voor het bovenste effect (`top`), of naar een **zone** voor het onderste effect (`bottom`). Een kaart zonder `bottom` kan je alleen afleggen. De knop "Alles afleggen" speelt je hele hand af voor het bovenste effect.
- **Zones:** een kaart in een zone blijft daar liggen, maximaal 4 per speler per zone (4 vaste vakjes op het scherm), ook nadat de zone veroverd is. Terugroep haalt ze terug, Vernietig verbant ze uit het spel.
- **Terugtrekken:** tijdens je beurt kan je een eigen kaart uit een open zone terug naar je aflegstapel sturen voor goud (knop ↩ bij hover). Het kost eerst 3 goud (`RECALL_PRICE`) en elke keer dat je het doet, wordt het voor jou 1 goud duurder, voor de rest van het spel (`recalls` in `PlayerState`, actie `recall`).
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

Een kaart in een zone wordt **eerst gelegd**, daarna werken haar effecten. Terugroep en Vernietig slaan de kaart zelf over. Een kaart met die keywords heeft dus ook een vrije plek nodig: je kunt ze niet als vijfde kaart spelen.

## Code

| Bestand | Rol |
|---|---|
| `src/game/rules.ts` | Constanten: handgrootte, levens per zone, zones om te winnen, max kaarten per zone, handlimiet, zones |
| `src/game/types.ts` | Alle types: `GameState`, `Action`, `CardDef` (`top`/`bottom`), `Effect` (keyword of `speciaal`), `Keyword` |
| `src/game/cards.ts` | `KEYWORDS` (label + uitleg), alle kaarten (`CARD_LIST`), `STARTER_DECK`, `SHOP_SUPPLY` |
| `src/game/specials.ts` | Speciale effecten zonder keyword (`SPECIALS`): een korte tekst en een `run`-functie |
| `src/game/engine.ts` | Spelregels: `createGame`, `applyAction`, `whyCantPlay`, `whyCantBuy`, `whyCantRecall` |
| `src/game/engine.test.ts` | Tests voor de regels |
| `src/game/ai.ts` | Computertegenstander in vier niveaus: `chooseAction(state, level, rnd)` geeft één actie voor de speler aan zet |
| `src/game/ai.test.ts` | Tests voor de computertegenstander (duren ~20 s door de sterke niveaus) |
| `src/main.ts` | Weergave, klikken, slepen, tooltips, animaties, geluid-triggers |
| `src/style.css` | Alle stijlen |
| `src/sound.ts` | Geluidseffecten via Web Audio (geen bestanden), aan/uit bewaard in localStorage |
| `src/zoneArt.ts` | Inline-SVG illustraties per zone (op zonenaam) |

**Engine**
- `applyAction(state, action)` is puur: ze werkt op een `structuredClone` en geeft `{ok, state}` of `{ok:false, error}` terug, met een Nederlandse foutmelding die de UI als toast toont.
- Toeval gebeurt via een seed in de state (mulberry32), zodat spellen reproduceerbaar zijn. Tests gebruiken vaste seeds.

**UI**
- Elke wijziging tekent de hele tafel opnieuw via `innerHTML`.
- Interactie via data-attributen: `data-click`, `data-drag` (handkaart), `data-drop` (`discard` / `zone:i`), `data-kw` (keyword-tooltip), `data-special` (tooltip van een speciaal effect), `data-recall` (tooltip van de terugtrekknop), `data-pile` (stapel-tooltip).
- De tafel heeft een vaste ontwerpgrootte van 1600×900 en wordt geschaald naar het venster (`--scale`).
- **Hover zonder glitch:** de buitenste "slot" ligt stil en vangt de muis op; alleen de `.card` erin beweegt en heeft `pointer-events: none`. Keywords zetten `pointer-events` terug aan voor hun tooltip. Gebruik hetzelfde patroon voor nieuwe hover-effecten.
- **Animaties:** `captureEffects` legt de DOM-posities vast vóór het opnieuw tekenen. `playEffects` laat daarna kopieën vliegen of verbranden. `findImpacts` + `playImpacts` geven een inslag (screenshake, schokgolf, vonken, gloed) wanneer een kaart van 6 goud of meer (`SLAM_PRICE`) in een zone gelegd wordt, en een grotere wanneer een zone veroverd wordt. Het schudden valt weg bij `prefers-reduced-motion`.
- **Geluiden:** `playSounds` kiest de geluiden door de toestand voor en na een actie te vergelijken.
- **Hotseat:** na "Einde beurt" verschijnt een wisselscherm (`handoff`) dat de hand verbergt. De speler die aan zet is, zit altijd onderaan.
- **Tegen de computer:** keuze op het startscherm (`vsComputer`), met een niveau (`computerLevel`, onthouden in localStorage). De mens is speler 0 en zit altijd onderaan, er is geen wisselscherm. `scheduleComputer` laat de computer zet per zet spelen via `dispatch`, met een pauze ertussen. Elke kaart die de computer speelt of aflegt, toont `showcase` eerst groot in het midden van het scherm (met de gebruikte helft in het licht); pas als ze op haar plek aankomt, wordt de zet uitgevoerd.
- **Computerniveaus** (`PROFILES` in `ai.ts`); elk niveau bouwt verder op het vorige:
  - **Normaal:** speelt haar hand kaart per kaart: voor elke kaart probeert ze elke bestemming op een kopie uit en kiest ze de beste toestand volgens `evaluate`. Daarna koopt ze de duurste betaalbare kaart (vanaf 3 goud).
  - **Moeilijk:** zoekt de beste volgorde voor haar hele hand met een beam search (6 beste tussenstanden), trekt kaarten terug als dat helpt, koopt slim (`smartBuy`: naar de situatie, en soms sparen) en verdedigt meer (`threatWeight`).
  - **Extreem:** speelt de 4 beste beurten uit de beam search 2 rondes verder na (4 keer), met de tegenstander als Normaal, en kiest de beurt waarna ze er gemiddeld het best voor staat.
  - **Legendarisch:** speelt zoals Extreem, met een openlijke bonus van 1 goud per beurt (`bonusGold` in `AI_LEVELS`, doorgegeven via `createGame(names, seed, { bonusGold })`; de engine geeft het aan het begin van de beurt en zet het in het logboek). Meer denkwerk (meer kandidaten, meer simulaties, een sterker model van de tegenstander) leverde boven Extreem niets meetbaars meer op: de grens ligt bij `evaluate`.
  - Gemeten: Moeilijk wint ~67% van Normaal, Extreem ~61% van Moeilijk, Legendarisch ~60% van Extreem. Denktijd per beurt: Moeilijk ~30 ms, Extreem en Legendarisch ~0,4 s.
  - **Niet valsspelen:** de beam search plant niet verder na een zet die iets onthult (kaarten trekken, een nieuwe winkelkaart). Bij het naspelen worden verborgen kaarten (haar stapelvolgorde, hand en stapel van de tegenstander, winkelvoorraad) eerst gesorteerd en dan willekeurig verdeeld (`determinize`). Alle kandidaten krijgen dezelfde trekkingen, zodat geluk de vergelijking niet verstoort.
  - **Plan per beurt:** de beam search berekent de beurt één keer; de volgende zetten komen uit `plans` (per niveau, op `stateKey`). Omdat de engine voorspelbaar is, klopt het plan tot er iets onthuld wordt; dan plant ze opnieuw.

**Een kaart, speciaal effect of keyword toevoegen**
- **Kaart:** voeg ze toe aan `CARD_LIST` en aan `SHOP_SUPPLY` (of aan `STARTER_DECK`).
- **Speciaal effect** (hoort bij één of enkele kaarten, geen keyword waard): voeg een entry toe aan `SPECIALS` in `specials.ts` met een korte `text` (die staat op de kaart) en een `run({ me, opp, meId, oppId, zone, state, damage, draw, log })`. Zet het op een kaart met `special('naam')`, naast gewone keywords. `zone` is `null` bij afleggen. `damage` en `draw` volgen dezelfde regels als Aanval en Trek. Een onbekende naam geeft meteen een fout bij het laden. Voorbeelden: Alchemist (`dubbelgoud`) en Wrekende Geest (`wraak`).
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
- **Commit en push automatisch** na elke afgewerkte wijziging (als tsc, tests en build slagen), met een Nederlandse commitboodschap. Vermeld de boodschap in je antwoord.
- Open het spel na een wijziging in de browser voor de gebruiker (dev-server op poort 5173, start ze als ze niet draait).
- Op deze machine is er **geen Python**: schrijf hulpscripts in Node (`node script.mjs`).
- **Stop nooit alle Node-processen** (`taskkill /IM node.exe`): dat stopt ook de dev-server van de gebruiker. Stop alleen je eigen achtergrondtaak.
- De computer sterker maken? Meet het met duels tussen niveaus (vaste seeds, zitplaatsen afwisselen, minstens 40 spellen; minder is ruis). Lange metingen draai je op de achtergrond.

## Ideeën en mogelijke volgende stappen

- `ideeen/characterTypesImages.jpg`: een plaat met 12 personagetypes (paladin, archer, mage, druid, bard, necromancer, shaman, warrior, elementalist, thief, barbarian, priest). Dat is mogelijk inspiratie voor klassen of helden. Nog niet besproken of gebouwd.
- Eerder geopperd, nog niet gebouwd: online multiplayer (de engine is al los van de UI), balans van kaartprijzen en waarden, echte illustraties voor kaarten.
- Een sterkere computer zonder bonus kan alleen nog via een betere `evaluate` in `ai.ts`, bijvoorbeeld door de gewichten af te stellen met veel zelfspel. Dat is veel rekenwerk met een onzeker resultaat.
- De computer ontwikkelt zich nog niet mee met nieuwe speciale effecten; ze ziet alleen het resultaat via haar simulaties.
