# Munt of Zwaard

Een fantasy-deckbuilder voor twee spelers aan hetzelfde scherm (hotseat), online tegen elkaar, of tegen de computer, op desktop, in 2D met bovenaanzicht van een speltafel.
TypeScript + Vite, zonder framework. De code (namen, commentaar, commits) is **Nederlands**. Het spel zelf kan in het **Nederlands of Engels** (knop op het startscherm en in het zijpaneel, zie `src/game/i18n.ts`).

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

- **Match:** best-of-3 (`GAMES_TO_WIN_MATCH` = 2 gewonnen spellen). Spel 1: toeval beslist wie begint; spel 2: de andere speler; spel 3: wie spel 2 verloor. Zo begint elke speler minstens één keer. De engine krijgt de beginspeler via `createGame(names, seed, { starter })`; de stand van de match (`match`, `nextStarter`) zit in `main.ts`.
- **Winnen:** verover 2 van de 3 zones. Een zone is van jou als je er als eerste haar levens vol schade doet (gewoon 12, `ZONE_HP`; per zone in `zone.hp`); daarna is ze gesloten.
- **Zones** (`src/game/zones.ts`): elk spel krijgt 3 willekeurige namen uit `ZONE_NAMES` (Wachttoren, Elfenwoud, Kristalgrot, Drakennest, Spookmoeras, Zonnetempel), elk met een ander willekeurig effect uit `ZONE_EFFECTS` (via de seed, dus gelijk bij online spelers): **Vesting** (+2 levens: 14), **Bouwval** (−2 levens: 10), **Slagveld** (16 levens, vast via `hp`, en +1 schade per aanval: Aanval, Storm en speciale schade, in `dealDamage`), **Dichte mist** (8 levens en −1 schade per aanval, minimum 0), **Goudader** (+1 goud aan het begin van je beurt als je er in de open zone meer schade hebt dan je tegenstander, in `startTurn`), **Schatkamer** (+1 goud per kaart die je er speelt), **Tolpoort** (een kaart er spelen kost 1 goud, `playCost`, gecontroleerd in `whyCantPlay`), **Zware tocht** (Vertraag 1 op jezelf per kaart), **Bibliotheek** (trek 1 kaart per kaart). **Heilige bron** (aan het begin van je beurt verdwijnt 1 schade van je tegenstander, `healEachTurn`), **Handelspost** (sta je voor, dan kost elke winkelkaart 1 goud minder, minimum 1; altijd via `shopPrice` in `engine.ts`), **Smalle pas** (maar 3 kaarten per speler; gebruik altijd `zoneCapacity` in plaats van `MAX_ZONE_CARDS`). De laatste vier staan als `onPlay` / `playCost` in `ZONE_EFFECTS` en werken in `playCard`, na de effecten van de kaart (tol wordt vooraf betaald). Een nieuw effect: voeg het toe aan `ZoneEffectId` en `ZONE_EFFECTS`, geef het een kleur `.zfx-<id>` in `style.css` en verhoog `PROTOCOL` in `online.ts`. Tests gebruiken `createGame(..., { plainZones: true })` voor zones zonder effect.
- **Stapel:** je begint met 10 startkaarten: 5× Koperen Munt (alleen Goud 1), 3× Rekruut (Goud 1 / Aanval 1 + Terugroep 1), 2× Zilveren Munt (Goud 2 / Verban 1).
- **Beurt:** trek 5 kaarten (min Vertraag). Alleen de allereerste beurt van het spel (de beginspeler) trekt er 3 (`FIRST_HAND_SIZE`). Is je stapel leeg, dan wordt je aflegstapel geschud. Afgelegde kaarten liggen tot het einde van je beurt apart (`played`) en gaan pas bij Einde beurt, samen met je resterende hand, naar je aflegstapel. Zo kan Trek een kaart nooit twee keer in dezelfde beurt terugbrengen (vroeger gaf een kleine stapel met Trek een oneindige lus). Handlimiet 8: wat je daarboven trekt, gaat meteen naar je aflegstapel.
- **Elke kaart heeft twee helften.** Sleep ze naar je **aflegstapel** voor het bovenste effect (`top`), of naar een **zone** voor het onderste effect (`bottom`). Een kaart zonder `bottom` kan je alleen afleggen. De knop "Alles afleggen" speelt je hele hand af voor het bovenste effect.
- **Zones:** een kaart in een zone blijft daar liggen, maximaal 4 per speler per zone (vaste vakjes op het scherm; 3 in een Smalle pas), ook nadat de zone veroverd is. Terugroep haalt ze terug, Vernietig verbant ze uit het spel. Uitzonderingen: de Huurling vertrekt aan het einde van je beurt, de Fenix keert terug in je hand.
- **Terugtrekken:** tijdens je beurt kan je een eigen kaart uit een open zone terug naar je aflegstapel sturen voor goud (knop ↩ bij hover). Het kost eerst 3 goud (`RECALL_PRICE`) en elke keer dat je het doet, wordt het voor jou 1 goud duurder, voor de rest van het spel (`recalls` in `PlayerState`, actie `recall`).
- **Winkel:** een gedeelde markt van 5 kaarten. Je koopt met goud; goud blijft bewaard over beurten heen. Een gekochte kaart gaat naar je aflegstapel en de vrije plek wordt aangevuld.
- **Zone-effect veranderen:** keyword **Herschep** (alleen in een zone): deze zone krijgt een nieuw effect, willekeurig (seed) uit de effecten die nu in geen zone spelen (`newZoneEffect` / `setZoneEffect` in `engine.ts`). Altijd maar één zone tegelijk. Kaarten: Landmeter (5), Portaalmagiër (6), Weermaker (7). De levens volgen het nieuwe effect, maar blijven minstens 1 boven de hoogste schade: een nieuw effect verovert nooit zelf een zone. De schade blijft staan. De AI telt een veranderd zone-effect als iets dat onthuld wordt (`reveals`).
- **Echo** (keyword, Windloper, Schaduwdanser, Tijdmagiër): de volgende kaart die je deze beurt in een zone speelt, werkt gewoon en keert daarna meteen terug naar je aflegstapel (`echo` in `PlayerState`, in `playCard`; een Huurling naar de winkel, een Fenix naar je hand). De kaart met echo zelf telt niet mee. Vervalt bij Einde beurt. Ze heeft wel een vrije plek nodig, net als Terugroep.
- **Vernietig-kaarten:** Offervuur, Terugtocht, Zuiveraar, Brandstichter, Leegtescheur, en Dodenbezweerder (`zielenoogst`: Vernietig + 2 schade per verbannen kaart, via `destroy()` in de special-context).
- **Goedkope kaarten:** Schildknaap (2, Mens: Schild 3, met een andere Mens hier nog Schild 2), Pestdrager (3, Ondode: Aanval 2 + Schenk 2).
- **Dure kaarten (7–12 goud):** Generaal (7), Oorlogsmammoet (7), Aartsmagiër (8), Titaan (9), Ravenkoningin (9, `leegveld`: 2 schade per lege plek van de tegenstander in deze zone), Leegtescheur (10), Meteoor (11), Drakenkoning (12). Elk maar 1 of 2 keer in de voorraad.
- **Handlimiet-waarschuwing:** trekt een kaart die je speelt (Trek op die helft, plus het trekken van het zone-effect) boven de handlimiet, dan vraagt de UI eerst "Ben je zeker?" (`drawOverflow` in `engine.ts`, `pendingPlay` in `main.ts`). Alleen bij slepen door de mens; de AI vraagt niets.
- **Rassen** (`RACES`, `RACE_OF` in `cards.ts`): elke winkelkaart heeft een van 5 rassen, als icoon rechtsboven in de illustratie: 🧑 Mensen (goud, terugroepen, winkel), 🧝 Elfen (trekken, echo, herstel), ⛏️ Dwergen (schild, goud), 🪓 Orks (veel schade, vernietig), 💀 Ondoden (vertragen, vernietigen, Schenk, duistere specials). Elk ras heeft 9 à 10 kaartsoorten, goedkoop tot duur. Startkaarten hebben geen ras; een winkelkaart zonder ras geeft een fout bij het laden. **Elk spel doet één ras niet mee** (`outRace` in `GameState`, via de seed in `createGame`; tests kunnen `allRaces: true` meegeven): zijn kaarten gaan niet in de winkelvoorraad. Het zijpaneel toont welk ras ontbreekt.
- **Rasvoorwaarden:** een effect kan `need: ras` hebben (`als('elf', fx('trek', 1))` in `cards.ts`): het werkt alleen als er in die zone al een kaart van dat ras **van jou** ligt (de kaart zelf telt niet; `needMet` / `raceHere` in `engine.ts`). Op de kaart staat het rasicoon voor het keyword, met een gestippelde rand; de tooltip legt de voorwaarde uit. Afgelegd werkt een voorwaarde nooit. Alle voorwaarden van een kaart worden gecontroleerd vóór haar effecten, zodat Terugroep/Vernietig/Schenk op dezelfde kaart de bonus niet wegneemt.
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
| Verban(x) | kies deze beurt x winkelkaarten (rode knop ✖ op de kaart): ze gaan onderaan de voorraad en worden vervangen. `banish` in `PlayerState`, actie `banish`; vervalt bij Einde beurt. De computer gebruikt het (nog) niet |
| Vervloek(x) | schud x Vloeken op een willekeurige plek in de stapel van de tegenstander (uid `vloek-n` via `curses` in `GameState`). Kaarten: Orkse Sjamaan (3), Moerasheks (3), Voodoopop (4), Vervloekte Schat (4), Duistere Elf (5), Lich (8) |
| Verdwijn | afgelegd verdwijnt de kaart zelf uit het spel (alleen op de **Vloek**: geen winkelkaart, geen ras; afleggen kost Betaal(1), in een zone is ze gratis maar neemt ze een plek in en doet niets (special `bezet`), verder niets; ze verbrandt op de aflegstapel, nieuwe Vloeken vliegen paars gloeiend naar de stapel van de tegenstander, kind `curse` in `playEffects`). De computer telt een Vloek als −2 in haar eigen stapel en +2 in die van de tegenstander (`CURSE_WORTH` in `ai.ts`), en als −1 in een eigen zone (`CURSE_IN_ZONE`) |
| Betaal(x) | deze helft spelen kost x goud, vooraf betaald (`payCost` in `engine.ts`, gecontroleerd in `whyCantPlay`, samen met de tol van een zone). Zonder goud kan je de helft niet spelen. Staat op de Vloek: een Vloek die je niet kunt betalen, blijft in je hand. Alles afleggen speelt kaarten met Betaal als laatste, zodat het goud van de rest ze kan betalen. De computer stopt met spelen als ze geen enkele kaart meer kan spelen (`decide` in `ai.ts`) |
| Echo | de volgende kaart die je deze beurt in een zone speelt, keert na haar effect meteen terug naar je aflegstapel |
| Herschep | deze zone krijgt een nieuw willekeurig effect (dat in geen andere zone speelt) |
| Schenk(x) | je x oudste andere kaarten in deze zone gaan naar de aflegstapel van je tegenstander (een Fenix keert terug in je eigen hand) |

Een kaart in een zone wordt **eerst gelegd**, daarna werken haar effecten. Terugroep en Vernietig slaan de kaart zelf over. Een kaart met die keywords heeft dus ook een vrije plek nodig: je kunt ze niet als vijfde kaart spelen.

## Code

| Bestand | Rol |
|---|---|
| `src/game/i18n.ts` | Taal (`nl`/`en`): `tr(nl, en)`, `setLang`, `cardsWord`. Elke tekst die de speler ziet, schrijf je als `tr('Nederlands', 'English')` |
| `src/game/rules.ts` | Constanten: handgrootte, levens per zone, zones om te winnen, max kaarten per zone, handlimiet, zones |
| `src/game/types.ts` | Alle types: `GameState`, `Action`, `CardDef` (`top`/`bottom`), `Effect` (keyword of `speciaal`), `Keyword` |
| `src/game/cards.ts` | `KEYWORDS` (label + uitleg), alle kaarten (`CARD_LIST`), `STARTER_DECK`, `SHOP_SUPPLY` |
| `src/game/specials.ts` | Speciale effecten zonder keyword (`SPECIALS`): een korte tekst en een `run`-functie |
| `src/game/zones.ts` | Zonenamen (`ZONE_NAMES`, Engels via `zoneName`), zone-effecten (`ZONE_EFFECTS`), `makeZone`, `zoneEffect`, `zoneCapacity`, `leadsZone` |
| `src/game/engine.ts` | Spelregels: `createGame`, `applyAction`, `whyCantPlay`, `whyCantBuy`, `whyCantRecall` |
| `src/game/engine.test.ts` | Tests voor de regels |
| `src/game/ai.ts` | Computertegenstander in vier niveaus: `chooseAction(state, level, rnd)` geeft één actie voor de speler aan zet |
| `src/game/ai.test.ts` | Tests voor de computertegenstander (duren ~20 s door de sterke niveaus) |
| `src/main.ts` | Weergave, klikken, slepen, tooltips, animaties, geluid-triggers |
| `src/style.css` | Alle stijlen |
| `src/online.ts` | Online spelen via PeerJS (WebRTC): kamer maken (`hostRoom`), meedoen (`joinRoom`), berichten (`Msg`), hartslag |
| `src/sound.ts` | Geluidseffecten via Web Audio (geen bestanden), aan/uit bewaard in localStorage |
| `src/zoneArt.ts` | Inline-SVG illustraties per zone (op zonenaam); een nieuwe naam in `ZONE_NAMES` heeft hier ook een tekening nodig |

**Engine**
- `applyAction(state, action)` is puur: ze werkt op een `structuredClone` en geeft `{ok, state}` of `{ok:false, error}` terug, met een foutmelding in de gekozen taal die de UI als toast toont.
- Toeval gebeurt via een seed in de state (mulberry32), zodat spellen reproduceerbaar zijn. Tests gebruiken vaste seeds.

**Talen**
- Elke zichtbare tekst staat als `tr('Nederlands', 'English')` in de code. Kaartnamen (`NAMES_EN` in `cards.ts`), keyword-labels, specials-teksten, zone-effecten en computerniveaus zijn getters, dus `def.name`, `KEYWORDS[kw].label`, `fx.label` en `getSpecial(id).text` geven altijd de gekozen taal. Zonenamen staan in de toestand in het Nederlands (ook de sleutel voor `ZONE_ART`); toon ze met `zoneName(z)`.
- De taal wordt onthouden in localStorage (`fantasy-cards-taal`); zonder keuze volgt ze de browser. Het logboek wordt geschreven in de taal van het moment; online schrijft elke speler zijn eigen logboek, dus de taal mag per speler verschillen.
- Een nieuwe kaart: geef ze ook een Engelse naam in `NAMES_EN`.

**UI**
- Elke wijziging tekent de hele tafel opnieuw via `innerHTML`.
- Interactie via data-attributen: `data-click`, `data-drag` (handkaart), `data-drop` (`discard` / `zone:i`), `data-kw` (keyword-tooltip), `data-special` (tooltip van een speciaal effect), `data-recall` (tooltip van de terugtrekknop), `data-pile` (stapel-tooltip).
- De tafel heeft een vaste ontwerpgrootte van 1600×900 en wordt geschaald naar het venster (`--scale`).
- **Hover zonder glitch:** de buitenste "slot" ligt stil en vangt de muis op; alleen de `.card` erin beweegt en heeft `pointer-events: none`. Keywords zetten `pointer-events` terug aan voor hun tooltip. Gebruik hetzelfde patroon voor nieuwe hover-effecten.
- **Animaties:** `captureEffects` legt de DOM-posities vast vóór het opnieuw tekenen. `playEffects` laat daarna kopieën vliegen of verbranden. `findImpacts` + `playImpacts` geven een inslag (screenshake, schokgolf, vonken, gloed) wanneer een kaart van 6 goud of meer (`SLAM_PRICE`) in een zone gelegd wordt, en een grotere wanneer een zone veroverd wordt. Het schudden valt weg bij `prefers-reduced-motion`. Verder: nieuw getrokken kaarten vliegen van de stapel naar de hand (`playDraws`, via `seenHandCards` en `oppDrawnFrom`); schade vliegt als vuurbal (`.bolt`) naar de balk en pas bij de inslag groeit de balk (`playHits`, `hits`/`hitAt` in `Impacts`); bij Einde beurt en Alles afleggen vliegt de hand naar de aflegstapel (`discard`); een gekochte kaart vliegt naar de aflegstapel (`bought`) en de vrije winkelplek wordt aangevuld (`shopRefill`, klasse `refill`). Een aankoop van de computer of online tegenstander toont `showcaseBuy` eerst groot in het midden met naam en prijs (`BUY_HOLD_MS`).
- **Telefoon en tablet:** slepen werkt met pointer events, dus ook met een vinger (de kaart hangt dan boven je vingertop). Lang indrukken (`LONG_PRESS_MS`) op een kaart in hand, winkel of zone toont ze groot met de uitleg van haar keywords (`showPreview`). Rechtop gehouden verschijnt `#rotate` ("draai je toestel"). Bij Start vraagt `goFullscreen` op een aanraakscherm volledig scherm en liggende stand (lukt niet op iPhone; daar helpt "Zet op beginscherm"). `touch-action: none` op body voorkomt scrollen en zoomen.
- **Schild:** een balk met schild krijgt een stalen, blauw gloeiende rand en een groot wapenschild met het getal ernaast (`.zshield`); het springt op als het groeit en flitst met "🛡️ −x" als het schade tegenhoudt.
- **Geluiden:** `playSounds` kiest de geluiden door de toestand voor en na een actie te vergelijken.
- **Hotseat:** na "Einde beurt" verschijnt een wisselscherm (`handoff`) dat de hand verbergt. De speler die aan zet is, zit altijd onderaan.
- **Tegen de computer:** keuze op het startscherm (`vsComputer`), met een niveau (`computerLevel`, onthouden in localStorage). De mens is speler 0 en zit altijd onderaan, er is geen wisselscherm. `scheduleComputer` laat de computer zet per zet spelen via `dispatch`, met een pauze ertussen. Elke kaart die de computer speelt of aflegt, toont `showcase` eerst groot in het midden van het scherm (met de gebruikte helft in het licht), startkaarten maar heel kort (`STARTER_HOLD_MS`; de gebruiker stelde zelf `SHOWCASE_HOLD_MS` = 400 en de starttijden 80/120 ms in); pas als ze op haar plek aankomt, wordt de zet uitgevoerd.
- **Testspel:** knop "🧪 Testspel" op het startscherm (`testGame`): een gewoon spel tegen de computer (met niveaukeuze), maar in je beurt opent de knop 🧪 Test in het zijpaneel een venster met alle kaarten (`renderTestPicker`); een klik legt een kopie (uid `test-n`) in je hand, buiten de engine om, zonder handlimiet, met een regel in het logboek. Alleen lokaal, nooit online.
- **Online:** de host (maakt de kamer, 4-tekencode, ook als link `?kamer=CODE`) is speler 0, de gast speler 1; jij zit altijd onderaan. De gratis PeerJS-server dient alleen om elkaar te vinden; daarna loopt alles rechtstreeks tussen de browsers. Beide kanten draaien dezelfde engine (lockstep): de host kiest seed en beginspeler per spel en stuurt `start`, daarna gaan alleen acties over en weer, met een `check` (`stateCheck`) om verschillen te melden. Acties van de tegenstander worden één voor één afgespeeld (`remoteQueue`), kaarten eerst via `showcase`. Elke 2 s een `ping`; 10 s stilte geldt als verbroken. Verhoog `PROTOCOL` in `online.ts` als berichten of spelregels veranderen. Beperking: de hele toestand staat bij beide spelers, dus wie de ontwikkelaarstools opent, kan de hand van de ander zien. Achter strenge netwerken (sommige bedrijfs- of mobiele netwerken) kan verbinden mislukken, want er is geen TURN-server.
- **Computerniveaus** (`PROFILES` in `ai.ts`); elk niveau bouwt verder op het vorige:
  - **Normaal:** speelt haar hand kaart per kaart: voor elke kaart probeert ze elke bestemming op een kopie uit en kiest ze de beste toestand volgens `evaluate`. Daarna koopt ze de duurste betaalbare kaart (vanaf 3 goud; ligt er niets van 3 goud of meer, dan ook goedkoper, via `priceFloor`, anders liep een winkel vol goedkope kaarten vast). Is de winkel leeg, dan telt goud niet meer in `evaluate`.
  - **Moeilijk:** zoekt de beste volgorde voor haar hele hand met een beam search (6 beste tussenstanden), trekt kaarten terug als dat helpt, koopt slim (`smartBuy`: naar de situatie, en soms sparen) en verdedigt meer (`threatWeight`).
  - **Extreem:** speelt de 4 beste beurten uit de beam search 2 rondes verder na (4 keer), met de tegenstander als Normaal, en kiest de beurt waarna ze er gemiddeld het best voor staat.
  - **Legendarisch:** speelt zoals Extreem, met een openlijke bonus van 1 goud per beurt (`bonusGold` in `AI_LEVELS`, doorgegeven via `createGame(names, seed, { bonusGold })`; de engine geeft het aan het begin van de beurt en zet het in het logboek). Meer denkwerk (meer kandidaten, meer simulaties, een sterker model van de tegenstander) leverde boven Extreem niets meetbaars meer op: de grens ligt bij `evaluate`.
  - Gemeten: Moeilijk wint ~67% van Normaal, Extreem ~61% van Moeilijk, Legendarisch ~60% van Extreem. Denktijd per beurt: Moeilijk ~30 ms, Extreem en Legendarisch ~0,4 s.
  - **Niet valsspelen:** de beam search plant niet verder na een zet die iets onthult (kaarten trekken, een nieuwe winkelkaart). Bij het naspelen worden verborgen kaarten (haar stapelvolgorde, hand en stapel van de tegenstander, winkelvoorraad) eerst gesorteerd en dan willekeurig verdeeld (`determinize`). Alle kandidaten krijgen dezelfde trekkingen, zodat geluk de vergelijking niet verstoort.
  - **Plan per beurt:** de beam search berekent de beurt één keer; de volgende zetten komen uit `plans` (per niveau, op `stateKey`). Omdat de engine voorspelbaar is, klopt het plan tot er iets onthuld wordt; dan plant ze opnieuw.

**Een kaart, speciaal effect of keyword toevoegen**
- **Kaart:** voeg ze toe aan `CARD_LIST` en aan `SHOP_SUPPLY` (of aan `STARTER_DECK`), met een Engelse naam in `NAMES_EN`. Startkaarten tonen "Afleggen"/"In een zone" boven hun helften; andere kaarten niet (daar is de plaats nodig voor de effecten, dus maak keywords niet groter). Een kaart van 6 goud of meer slaat met screenshake neer. Verhoog `PROTOCOL` in `online.ts` als je regels of kaarten verandert.
- **Speciaal effect** (hoort bij één of enkele kaarten, geen keyword waard): voeg een entry toe aan `SPECIALS` in `specials.ts` met een korte `text` (die staat op de kaart) en een `run({ me, opp, meId, oppId, zone, zoneIdx, state, damage, draw, log, destroy })`. Zet het op een kaart met `special('naam')`, naast gewone keywords. `zone` is `null` bij afleggen. `damage` en `draw` volgen dezelfde regels als Aanval en Trek. Een onbekende naam geeft meteen een fout bij het laden. Voorbeelden: Alchemist (`dubbelgoud`), Wrekende Geest (`wraak`) en Goblin (`diefstal`: 2 goud, afgelegd Goud(1), in een zone steelt ze al het goud van de tegenstander). Sommige specials doen zelf niets en dienen als kenmerk waar de engine naar kijkt met `hasSpecial`: `huur` (Huurling: aan het einde van je beurt gaat ze uit de zone onderaan de winkelvoorraad, in `endTurn`) en `wedergeboorte` (Fenix: vernietigd, teruggeroepen of teruggetrokken keert ze terug in je hand, via `rebirth`). De UI laat zulke kaarten naar de winkel of de hand vliegen (`to-shop` / `to-hand` in `captureEffects`).
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
- **Hulpscripts:** lange `node -e "..."` met template literals of `${}` lopen vast op het escapen in de shell. Schrijf ze met de Write-tool naar een `.mjs` in de scratchpad en draai dan `node bestand.mjs`, of gebruik de Edit-tool.
- **In de browser testen** (Claude in Chrome): de gebruiker koos "Browser 1". Online spelen test je met twee tabbladen (kamer maken in het ene, `?kamer=CODE` in het andere) en DOM-acties via JavaScript. Schermafbeeldingen lopen soms vast als het venster niet zichtbaar is; controleer dan met JavaScript (bv. of tekst buiten zijn vak loopt). Sluit je tabbladen achteraf.
- De computer sterker maken? Meet het met duels tussen niveaus (vaste seeds, zitplaatsen afwisselen, minstens 40 spellen; minder is ruis). Lange metingen draai je op de achtergrond.

## Ideeën en mogelijke volgende stappen

- **Tafelversie met echte kaarten:** advies over wat te vereenvoudigen staat in `ideeen/reallife-versie.md` (Echo, Herschep en terugtrekken weg; eenvoudigere zones; tellers en fiches op tafel). Nog niet gebouwd; de gebruiker werkt eerst verder aan het digitale spel.
- `ideeen/characterTypesImages.jpg`: een plaat met 12 personagetypes (paladin, archer, mage, druid, bard, necromancer, shaman, warrior, elementalist, thief, barbarian, priest). Dat is mogelijk inspiratie voor klassen of helden. Nog niet besproken of gebouwd.
- Eerder geopperd, nog niet gebouwd: balans van kaartprijzen en waarden, echte illustraties voor kaarten, een aparte indeling met grotere kaarten voor telefoons, opnieuw verbinden na een verbroken online spel.
- **Aandachtspunten voor de balans:** de Goblin (2 goud, steelt al het goud) kan te sterk zijn omdat goud bewaard blijft; mogelijke rem: duurder of max. 3 stelen. De Fenix met Terugroep/Vernietig (bv. Offervuur) kan elke beurt opnieuw gespeeld worden; mogelijke rem: één keer per beurt terugkeren.
- **Voorgestelde maar niet gekozen zone-effecten:** Arena (eerste kaart per beurt +2 schade), Smidse (Schild 1 per kaart), Vervloekte grond (wie verovert, verliest de kaarten die er liggen), Hinderlaag (eerste kaart van de tegenstander per beurt doet geen schade), Uitkijkpost (voorstaan: zie de bovenste kaart van de stapel van de tegenstander), Portaal (schade mag in een andere open zone vallen). Gebouwd uit dezelfde lijst: Heilige bron, Handelspost, Smalle pas.
- **Voorgestelde maar niet gekozen kaarten:** Spiegelmagiër (kopieer het onderste effect van de laatste kaart van de tegenstander hier), Verrader (neem de zwakste kaart van de tegenstander in deze zone over), Gokker (afleggen: 4 goud of niets), Spion (bekijk de hand van de tegenstander, leg 1 kaart onderaan diens stapel), Tovenaarsleerling (in een zone: elke andere kaart die je daar speelt +1 schade), Koning (elke kaart van jou in deze zone doet nog Aanval 1), Valstrik (de volgende kaart van de tegenstander hier werkt niet). Gebouwd uit dezelfde lijst: Huurling, Belegeringsram, Fenix.
- Een sterkere computer zonder bonus kan alleen nog via een betere `evaluate` in `ai.ts`, bijvoorbeeld door de gewichten af te stellen met veel zelfspel. Dat is veel rekenwerk met een onzeker resultaat.
- De computer ontwikkelt zich nog niet mee met nieuwe speciale effecten; ze ziet alleen het resultaat via haar simulaties.
