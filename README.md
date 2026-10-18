# höjdkurvor.se

Gör Lantmäteriets öppna geodata till underlag för Archicad, Revit och AutoCAD,
direkt i webbläsaren: höjdkurvor och höjdpunkter (DXF), markmodell (XYZ och CSV),
punktmoln ur Laserdata skog (LAS och XYZ), marktäcke, stompunkter och vägar
(DXF), soldiagram och skuggstudie (PDF), terrängsektioner och en platsanalys i
PDF med lutning, skyfall och skydd och risker. Skissade volymer kan prövas på
platsen, och platsen kan skickas vidare till ritprogrammet
[cad-apa](https://github.com/agrellarkitektur/cad-apa).

Live: <https://agrellarkitektur.se/terrang/> (blir höjdkurvor.se).
Utvecklad av Carl August Agrell, [Agrell Arkitektur](https://agrellarkitektur.se).
Licens: GPL-3.0 eller senare, se `LICENSE`. Tredjepartskod och data: `THIRD_PARTY.md`.

Allt räknas i besökarens webbläsare. Inloggningen till Lantmäteriet går direkt
från webbläsaren till dl1.lantmateriet.se och passerar aldrig webbhotellet.
Inget byggsteg: filerna laddas upp som de är.

## Publicera

Ladda upp hela mappen (utom `test/`, `docs/` och de här textfilerna, som inte
behövs men inte heller skadar) till webbhotellet, till exempel som
`public_html/terrang/`. Sidan nås då på `https://agrellarkitektur.se/terrang/`.
WordPress påverkas inte, eftersom riktiga mappar går före WordPress
omskrivningar. Ingen databas behövs. PHP behövs bara för reservvägarna
`stac.php` och `geodata.php`, se nedan.

Lantmäteriets server släpper bara igenom anrop från godkända webbplatser.
`https://agrellarkitektur.se` är godkänd. Om sidan nås från en annan adress,
till exempel med `www.` eller från en ny domän som höjdkurvor.se, stoppas
hämtningen tills Lantmäteriet har godkänt även den adressen. Ansök om det
innan sidan flyttas. Internationaliserade domäner skickas som punycode
(`xn--hjdkurvor-07a.se`), så ange både den formen och `hojdkurvor.se` i
ansökan.

## Sidor

- `index.html` – kartan (blad 01). Panelen har fyra steg: 01 Plats, 02 Underlag,
  03 Analys och 04 Skiss. På mobil visas i stället ett enklare flöde: markera
  med en ram, kopiera, skicka länken till datorn eller beställ.
- `instruktioner.html` – konto, produkter, arbetsgång, platsanalys, cad-apa,
  ritprogram, mobil (blad 02)
- `om.html` – om tjänsten, ansvar, källor, licenser och ändringar (blad 03)
- `bestall.html` – beställ underlaget av Agrell Arkitektur mot betalning (blad 04).
  Formuläret skickar ingenting själv: det öppnar ett ifyllt e-postmeddelande i
  besökarens e-postprogram, eller kopierar beställningen.

Menyraden, ritningshuvudet och sidfoten är likadana på alla sidor. Ändras de
behöver alla fyra filerna uppdateras.

Temat (Blueprint, Ljust eller Mörkt) väljs i menyraden och gäller alla sidor.
Valet sparas i webbläsaren. Första gången följer det datorns mörka läge.
Internt heter temana `ritning`, `lugn` och `mork`.

## Inställningar i config.js

- `esriNyckel` – API-nyckel från ArcGIS Location Platform. Ger bakgrunden
  "Flygfoto (Esri)". Esris villkor och avgifter gäller för nyckeln.
- `stacProxy` – reserv om webbläsaren inte får fråga Lantmäteriets öppna
  katalog direkt. Standard `stac.php`. Tomt värde stänger av reserven.
- `geodataProxy` – reserv om webbläsaren inte får fråga Naturvårdsverket,
  Riksantikvarieämbetet eller Myndigheten för civilt försvar direkt. Standard
  `geodata.php`.
- `cadApaUrl` – adress till cad-apa. Standard `../cad-apa/`.
- `inloggning` – endast för intranät: förifylld inloggning till Lantmäteriet
  för alla som öppnar sidan. Använd organisationens systemkonto.

Tomma värden betyder att funktionen är avstängd. Nycklar i `config.js` syns för
alla som öppnar sidan, så checka aldrig in riktiga nycklar eller inloggningar.

## stac.php och geodata.php

Laserdatans rutor heter efter skanningsområde, så appen frågar Lantmäteriets
öppna katalog (api.lantmateriet.se/stac-hojd) vilka filer som finns. Om
webbläsaren inte får göra det direkt går frågan via `stac.php`, som bara
vidarebefordrar GET-frågor till katalogsökvägarna `/stac-hojd`, `/stac-vektor`
och `/stac-bild`.

`geodata.php` gör samma sak för platsanalysens kapitel Skydd: bara adresser som
börjar som i filens `$VITLISTA` släpps igenom (Naturvårdsverkets WFS och WMS,
Riksantikvarieämbetets WMS för lämningar och MCF:s WMS för
översvämningskarteringar). Appen frågar alltid direkt först.

Inga inloggningsuppgifter passerar någon av filerna.

## Kod

Vanlig JavaScript utan byggsteg. Varje fil lägger ett globalt objekt på `window`.

- `js/tema.js` – temaval och temamenyn (laddas först i `<head>`)
- `js/version.js` – versionsnummer och datum (`window.HOJDKURVOR`)
- `js/karna.js` (`Terrang`) – höjddata, omprojicering, höjdkurvor, DXF, XYZ och
  CSV, lokal vridning och nordpilar
- `js/laser.js` – laserdata: katalogsök, läsning av COPC, LAS och XYZ
- `js/marktacke.js` – marktäcke: hämtning, lagring i webbläsaren, GeoPackage, DXF
- `js/stompunkt.js` – Stompunkt Direkt: sökning inom utsnittet, DXF och CSV
- `js/vagar.js` – vägar från OpenStreetMap via Overpass, klassning och DXF
- `js/topowebb.js` – läser Topografisk webbkarta ur Lantmäteriets GeoPackage
  (172 GB) med HTTP Range, några få sidor åt gången
- `js/analys.js` (`Analys`) – ytmodell ur laserdata, träd, skuggor, sektioner, horisont
- `js/platsanalys.js` (`Platsanalys`) – höjdpunkter, lutning, skyfall
  (sänkfyllning och flödesackumulering), skissade volymer och tak
- `js/geodata.js` (`Geodata`) – skyddad natur, lämningar, översvämning och
  vatten från andra myndigheter och OpenStreetMap
- `js/platsanalysblad.js` – platsanalysens A3-häfte (PDF)
- `js/utbyte.js` (`Utbyte`) – utbytet med cad-apa, se `docs/UTBYTE-CAD-APA.md`
- `js/vy3d.js` (`Vy3D`) – 3D-förhandsvisning med three.js, laddas först när den öppnas
- `js/utskrift.js` – skalenlig utskrift (PDF) och skuggstudiens översiktsblad
- `js/sol.js` – solberäkningar och soldiagram som PDF, med eller utan horisont
- `js/dxf.js` – DXF-skrivare
- `js/bestall.js` – beställningsformuläret
- `js/app.js` – karta, panel, lager, ritning, mobilflöde, projektlänk, felrapport
- `data/kommuner.json` – förenklade kommungränser med kommunkod och föreslagen
  SWEREF 99-zon (fältet `epsg`; Kiruna saknar värde eftersom kommunen använder
  flera zoner)
- `vendor/` – tredjepartsbibliotek och typsnitt, se `THIRD_PARTY.md`
- `test/` – tester, testserver och testdata, se `test/README.md`

## Externa tjänster

- Höjddata och laserdata: dl1.lantmateriet.se, katalog api.lantmateriet.se
- Marktäcke: dl1.lantmateriet.se/mark/marktacke, en fil per kommun
- Stompunkter: api.lantmateriet.se/distribution/produkter/stompunkt-direkt/v1.1
- Topografisk webbkarta: dl1.lantmateriet.se/karta/topowebb/data/topowebb-3006.gpkg
  (läses i bitar med Range; kräver inloggning och beställd produkt)
- Skyddad natur: geodata.naturvardsverket.se (Naturvårdsregistret och Natura 2000, WFS)
- Lämningar: pub.raa.se/visning/lamningar_v1/wms (GetFeatureInfo)
- Översvämning: gis-tjanster.mcf.se, Oversvamningskarteringar (WMS)
- Vägar och vatten: overpass-api.de (OpenStreetMap)
- Bakgrundskartor: tile.openstreetmap.org, tile.opentopomap.org, samt Esri om
  nyckel finns i config.js
- Adressök: nominatim.openstreetmap.org

OpenStreetMaps och OpenTopoMaps kartbilder får visas på kartan men inte laddas
ner i mängd, så de kommer inte med i utskriften. Utskriftens bakgrund är alltid
Lantmäteriets karta.

Varje användare behöver ett Geotorget-konto med de produkter beställda som
används: Markhöjdmodell Nedladdning, och för tillvalen Laserdata Nedladdning,
skog, Marktäcke Nedladdning, vektor, Stompunkt Direkt och Topografisk
webbkarta Nedladdning, raster. Platsanalysens kapitel Skydd kräver ingen inloggning.

## Kommande

- Kräver särskild prövning hos Lantmäteriet: byggnader i 3D, fastighetsindelning,
  hydrografi, Topografi 10 som vektor och NVDB.
- Platsanalysen: klimat (snölast, vind, växtzon) och buller från vägar. Visas
  som KOMMER i panelen tills datakällorna är kontrollerade.
- Avvaktar: schakt och fyll, solkarta, OBJ/GeoTIFF, IFC, exempelprojekt.

## Data som sparas i webbläsaren

- IndexedDB: marktäcket, en fil per kommun. Appen frågar Lantmäteriet om
  filen ändrats innan den används igen. Under 02 Underlag, "Sparat i
  webbläsaren", kan man ta bort enstaka filer eller tömma allt.
- localStorage: tema, bakgrund, dolda lager, utskriftens inställningar,
  formulärets val, senaste utsnittet (för sidan Beställ), mobil- eller helvy och,
  om användaren väljer det, inloggningen.
- sessionStorage: aktivt steg, sektionslinjer, horisontens betraktelsepunkt,
  skissens volymer och projekt-id, bara så länge fliken är öppen.

## Licenser för datan

Höjddata, laserdata, marktäcke och Topografisk webbkarta: © Lantmäteriet,
CC BY 4.0. Stompunkter: Lantmäteriet, öppna data (CC0). Skyddad natur:
Naturvårdsverket, CC0. Lämningar: Riksantikvarieämbetet. Översvämningskarteringar:
Myndigheten för civilt försvar. Vägar och vatten: © OpenStreetMap-bidragsgivare,
ODbL. Källan anges i varje nedladdad info-fil, i utskriften och i
platsanalysbladet. Laserdata kan enligt Lantmäteriets villkor innehålla
personuppgifter. Den som hämtar datan ansvarar för att hantera den enligt GDPR.

## Ändra en kommuns zon

Öppna `data/kommuner.json`, sök på kommunnamnet och ändra `"epsg"`.
Zonerna: 3007 = 12 00, 3008 = 13 30, 3012 = 14 15, 3009 = 15 00, 3013 = 15 45,
3010 = 16 30, 3014 = 17 15, 3011 = 18 00, 3015 = 18 45, 3016 = 20 15,
3017 = 21 45, 3018 = 23 15, 3006 = SWEREF 99 TM.
