# Munt of Zwaard op tafel: advies voor een vereenvoudigde versie

## Context (gesprek van 28 oktober 2026)
De gebruiker wil het digitale spel (`C:\workspace\fantasy-cards`) met echte kaarten spelen. Gevraagd was **eerst alleen advies**. De gebruiker werkt eerst nog verder aan het digitale spel; pas daarna komt de tafelversie. Kaarten die intussen bijkomen, moeten nog door deze bril bekeken worden. Wat de gebruiker koos: Echo, de oplopende terugtrekprijs en Herschep gaan eruit, de zones worden eenvoudiger. Op tafel mogen dobbelstenen of tellers, fiches of munten, en papier en pen.

Het leidende principe: **alles wat de computer onzichtbaar bijhoudt, moet zichtbaar op tafel liggen of verdwijnen.**

## 1. Materiaal op tafel
- **Schade:** elke zone heeft 2 tellers, één per speler. Gebruik een d20 of een draaischijf, of turf op het scoreblad. Een zone is van jou zodra jouw teller het aantal levens van de zone haalt.
- **Schild:** blauwe fiches op jouw kant van de zone. Elke schade van de tegenstander daar kost eerst 1 fiche.
- **Goud:** munten. Je houdt ze over van beurt tot beurt, net zoals nu.
- **Vertraag:** een rood fiche op de stapel van de tegenstander. Die trekt bij zijn volgende beurt 1 kaart minder per fiche en legt de fiches daarna terug.
- **Verban (winkel):** gewoon met de hand. Je schuift de gekozen kaart onder de voorraad en legt een nieuwe open.
- **Scoreblad:** houdt de best-of-3 bij en wie elk spel begint.

## 2. Wat eruit gaat
| Weg | Kaarten die erbij verdwijnen of anders worden |
|---|---|
| Echo | Windloper, Schaduwdanser, Tijdmagiër: schrappen, of Echo vervangen door Trek 1 |
| Herschep | Landmeter, Portaalmagiër, Weermaker: schrappen |
| Terugtrekken voor goud (de ↩-knop) | helemaal weg. Een vaste prijs van 3 kan ook, maar is één regel extra |
| Handlimiet-waarschuwing, de volgorde bij "Alles afleggen" | vallen vanzelf weg |

## 3. Eenvoudigere zones
- Zonder zone-effecten krijgt elke zone **12 levens**. Dat is de eenvoudigste versie, goed voor de eerste spellen.
- Wie zone-effecten wil, maakt zonekaarten met alleen effecten die je **ziet en niet moet onthouden**. Er liggen 3 zonekaarten open uit een stapel van 6:
  - **Vesting**: 14 levens
  - **Bouwval**: 10 levens
  - **Schatkamer**: +1 goud per kaart die je er legt
  - **Bibliotheek**: trek 1 kaart per kaart die je er legt
  - **Tolpoort**: een kaart hier leggen kost 1 goud
  - **Smalle pas**: maximaal 3 kaarten per speler
- **Effecten die eruit gaan**, met de reden:
  - Slagveld en Dichte mist: de ±1 bij elke aanval vergeet je snel.
  - Goudader, Heilige bron en Handelspost: daarvoor moet je elke beurt vergelijken of iets onthouden.
  - Zware tocht: hangt af van Vertraag-fiches.
- Zonenamen (Wachttoren, Elfenwoud enzovoort) blijven gewoon sfeer op de kaart.

## 4. Wat blijft, en hoe het op tafel werkt
- **Twee helften per kaart.** Een kaart die je aflegt voor de bovenste helft, leg je op een **speelstapel** voor je. Pas bij Einde beurt gaat die stapel samen met je hand naar je aflegstapel. Dat is dezelfde regel als nu (`played`) en ze voorkomt de oneindige Trek-lus.
- **Zones:** jouw kaarten liggen in een **rij van links naar rechts**. Links ligt de oudste kaart, wat Terugroep en Schenk ("oudste kaarten") eenvoudig maakt. Maximaal 4 kaarten per speler, 3 in een Smalle pas.
- **Eerst leggen, dan het effect.** Je kaart neemt dus eerst een plek in, ook bij Terugroep en Vernietig.
- **Winkel:** 5 open kaarten van een geschudde voorraad. Een gekochte kaart gaat naar je aflegstapel.
- **Vloek:** maak 10 Vloekkaarten. Vervloek(x): je steekt x Vloeken ergens in de stapel van de tegenstander. Die schudt niet opnieuw.
- **Rassen en rasvoorwaarden:** die blijven. Een rasicoon op de kaart is op tafel goed te zien.
- **Het ras dat niet meedoet:** schud 5 raskaartjes en trek er één. Dat ras haal je uit de voorraad. Je kunt deze regel ook schrappen en altijd met alle rassen spelen.
- **Huurling:** gaat bij Einde beurt onderaan de voorraad. **Fenix:** keert terug in je hand. Beide blijven, want je ziet ze op tafel.
- **Begin:** de beginspeler trekt in de eerste beurt 3 kaarten, daarna trekt iedereen 5. De handlimiet blijft 8.

## 5. Hoeveel kaarten je drukt
- Nu liggen er ongeveer 110 winkelkaarten. Op tafel volstaan **1 à 2 exemplaren per soort**, zo'n 60 à 70 kaarten.
- Per speler 10 startkaarten: 5 Koperen Munt, 3 Rekruut en 2 Zilveren Munt. Twee spelers samen hebben er dus 20.
- Daarbij komen 10 Vloeken en eventueel 6 zonekaarten.
- In totaal zijn dat ongeveer 100 kaarten, ruim 11 A4-vellen met 9 kaarten per vel.

## 6. Nog na te kijken als je verder gaat
- De 9 speciale effecten in `src/game/specials.ts`: bij elk effect controleren of je het in één zin kunt uitvoeren, zonder te tellen wat de computer verborgen bijhoudt.
- De Goblin, die al je goud steelt, is op tafel nog sterker omdat munten zich opstapelen. Stelen met een maximum van 3 is een mogelijke rem.
- Vertraag en Verban mogen blijven dankzij de fiches. Wil je nog eenvoudiger spelen, dan zijn zij de volgende kandidaten om te schrappen.

## Keuzes die ik zelf maakte
- Welke 6 zone-effecten blijven.
- Terugtrekken helemaal weg, in plaats van een vaste prijs.
- 10 Vloeken, en 1 à 2 exemplaren per kaartsoort.
- De rij van links naar rechts om "oudste" zichtbaar te maken.

## Mogelijke volgende stap (pas na akkoord)
- Een regelboekje schrijven.
- Een printbaar HTML-blad maken met de kaarten, automatisch gemaakt uit `src/game/cards.ts` (`CARD_LIST`, `KEYWORDS`) en zonder de geschrapte kaarten.

## Controle
Speel een proefspel met papieren kaartjes en noteer elk moment waarop je iets moest onthouden of opzoeken. Zulke regels kunnen dan nog eruit.
