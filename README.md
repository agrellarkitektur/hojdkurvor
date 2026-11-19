# Höjdkurvor

Gör Lantmäteriets öppna geodata till underlag för Archicad, Revit och AutoCAD,
direkt i webbläsaren: höjdkurvor och höjdpunkter (DXF), markmodell (XYZ och CSV),
punktmoln ur Laserdata skog (LAS och XYZ), ortofoto (JPEG med världsfil),
befintliga byggnader, fastighetsgränser, marktäcke, stompunkter och vägar
(DXF, bilvägar och gångvägar för sig, med utkast till vägytorna), befintliga byggnader som 3D-modell (IFC), soldiagram och skuggstudie (PDF), terrängsektioner och en platsanalys i
PDF med lutning, skyfall och skydd och risker (lutning och skyfall också som JPEG med
världsfil och PDF i vektor), och en samlad DXF med alla DXF-underlag. Skissade volymer kan prövas på
platsen, också ritas direkt i 3D-vyn, och platsen kan skickas vidare till ritprogrammet
[cad-apa](https://cad-apa.danaid.cloud/) ([källkod](https://github.com/agrellarkitektur/cad-apa)). Det man matar in sparas som ett
projekt i webbläsaren och kan sparas som projektfil (`.hojdkurvor`, se `docs/PROJEKTFIL.md`).

Live: <https://hojdkurvor.danaid.cloud/>. Den gamla adressen
agrellarkitektur.se/terrang/ är avstängd sedan 0.13.1, se `docs/FLYTT.md`.
Utvecklad av [Agrell Arkitektur](https://agrellarkitektur.se).
Licens: AGPL-3.0 eller senare från 0.13.2, se avsnittet [Licens](#licens) och `LICENSE`.
Tredjepartskod och data: `THIRD-PARTY.md`.

Allt räknas i besökarens webbläsare. Inloggningen till Lantmäteriet går direkt
från webbläsaren till dl1.lantmateriet.se och passerar aldrig servern.
Inget byggsteg: filerna laddas upp som de är.

## Publicera

Appen publiceras av GitHub. Vid varje push till `main` kontrollerar
`.github/workflows/publicera-vps.yml` koden, kör enhetstesterna, stoppar om
`config.js` innehåller en nyckel eller inloggning och lägger sedan appen på
VPS:en med rsync över SSH (`/srv/apps/www/hojdkurvor`, sajten
<https://hojdkurvor.danaid.cloud/>). Efter uppladdningen hämtas varje fil från
webbplatsen och jämförs med repot. Ändringar som bara rör dokumentationen eller
testerna hoppas över. Nyckeln ligger som secret `APPS_SSH_KEY`, serverns
nycklar i `.github/known_hosts`. Servern (Caddy med PHP-FPM) är beskriven i
repot agrellarkitektur/apps (`drift/apps.caddy`). `config.js` följer med, så en
ändring av den på servern skrivs över.

**Taggar och releaser** sköts av `.github/workflows/release.yml`: när en push
till `main` ändrar `js/version.js` och taggen för versionen inte finns, skapas
taggen (`v0.13.1`) och en release med versionens avsnitt ur `CHANGELOG.md` och
filen `hojdkurvor-vX.Y.Z.zip`, med en mapp `hojdkurvor` som innehåller samma
filer som publiceras. En release som skapas för hand får också zip-filen.

**Länken till källkoden**: båda arbetsflödena skriver in commiten i
`js/kalla.js` (raden `commit: ''`) i det som publiceras och packas, så att
*Källkoden* på sidorna går till koden för just den versionen. I repot står
raden tom, och länkarna går då till repot.
Saknas en release för en äldre version skapar `releaser-i-efterhand.yml`
(körs för hand, med till exempel `0.12.0=78b0480`) tagg, release och zip-fil.

FTP-publiceringen till webbhotellet togs bort i 0.13.1. Arbetsflödet
`stang-webbhotellet.yml` (körs för hand) tar bort appen från
agrellarkitektur.se/terrang/.

Utan GitHub: ladda upp hela mappen (utom `test/`, `docs/`, `.github/` och
textfilerna, som inte behövs men inte heller skadar) till en webbserver, till
exempel som `public_html/hojdkurvor/` på ett webbhotell med Apache (`.htaccess`
sätter då cache och teckenkodning). WordPress påverkas inte, eftersom riktiga
mappar går före WordPress omskrivningar. Ingen databas behövs. PHP behövs bara för reservvägarna
`stac.php` och `geodata.php` och för formuläret Skicka synpunkter
(`synpunkter.php`), se nedan.

Lantmäteriets servrar (dl1.lantmateriet.se och api.lantmateriet.se) tillåter
anrop från webbläsaren oavsett webbplats: de svarar med det ursprung som
skickas. Appen kan alltså ligga på vilken adress som helst utan att något
behöver godkännas (kontrollerat 17 november 2026, se `docs/FLYTT.md`).

## Sidor

- `index.html` – kartan (blad 01). Panelen har fyra steg: 01 Plats, 02 Underlag,
  03 Analys och 04 Skiss. På mobil visas i stället ett enklare flöde: markera
  med en ram, kopiera, skicka länken till datorn eller beställ.
- `instruktioner.html` – konto, produkter, arbetsgång, platsanalys, cad-apa,
  ritprogram, mobil (blad 02)
- `om.html` – om tjänsten, ansvar, licensen och källkoden, stöd utvecklingen, källor och ändringar (blad 03)
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
- `cadApaUrl` – adress till cad-apa. Standard `https://cad-apa.danaid.cloud/`.
  Skissen tillbaka tas bara emot från samma ursprung.
- `inloggning` – endast för intranät: förifylld inloggning till Lantmäteriet
  för alla som öppnar sidan. Använd organisationens systemkonto.

Tomma värden betyder att funktionen är avstängd. Nycklar i `config.js` syns för
alla som öppnar sidan, så checka aldrig in riktiga nycklar eller inloggningar.

## Synpunkter (synpunkter.php)

BETA-knappen i menyraden öppnar formuläret *Skicka synpunkter* (`js/synpunkter.js`),
som skickar till `synpunkter.php`. Skriptet mejlar synpunkten vidare med
PHP:s `mail()`. Vart det skickas står inte i koden, utan i
`feedback-config.php` på servern:

```php
<?php return ['to' => 'kontakt@agrellarkitektur.se', 'from' => 'noreply@agrellarkitektur.se'];
```

Skriptet letar först i mappen ovanför appen och sedan i appens egen mapp. På
VPS:en ligger filen i `/srv/apps/www/hojdkurvor/`; publiceringen skickar aldrig
`*-config.php` och tar aldrig bort den. Breven går ut genom msmtp och Loopias
SMTP med inloggning, så att de inte stoppas av SPF/DMARC när de vidarebefordras
till Gmail (se `docs/FLYTT.md`, steg 5).

`from` ska vara en adress på domänen och sätts också som kuvertavsändare. Öppna
<https://hojdkurvor.danaid.cloud/synpunkter.php> i webbläsaren för att se om
konfigurationen hittas. Formuläret visar serverns felmeddelande om det inte går
att skicka, och erbjuder då ett vanligt mejl.

Skydd mot skräp: ett dolt fält för robotar, minst tre sekunder från att
formuläret öppnas, högst fem synpunkter i timmen per avsändare och högst 30 i
timmen från alla tillsammans (`MAX_PER_AVSANDARE` och `MAX_ALLA` i filen).
Formuläret tas bara emot som JSON från en sida på samma värdnamn som skriptet
(`Origin`, annars `Referer`, och `Sec-Fetch-Site`), så att en annan webbplats
inte kan få sina besökare att skicka det. Ligger appen bakom en proxy som
byter värdnamn måste proxyn skicka med det ursprungliga `Host`.

## stac.php och geodata.php

Laserdatans rutor heter efter skanningsområde, så appen frågar Lantmäteriets
öppna katalog (api.lantmateriet.se/stac-hojd) vilka filer som finns. Om
webbläsaren inte får göra det direkt går frågan via `stac.php`, som bara
vidarebefordrar GET-frågor till katalogsökvägarna `/stac-hojd`, `/stac-vektor`
och `/stac-bild`.

`geodata.php` gör samma sak för platsanalysens kapitel Skydd: bara adresser som
börjar som i filens `$VITLISTA` släpps igenom (Naturvårdsverkets WFS och WMS,
Riksantikvarieämbetets WMS för lämningar och MCF:s WMS för
översvämningskarteringar). Appen frågar alltid direkt först. Omdirigeringar
följs bara till https på en av vitlistans servrar, högst två gånger.

Inga inloggningsuppgifter passerar någon av filerna.

## Kod

Vanlig JavaScript utan byggsteg. Varje fil lägger ett globalt objekt på `window`.

- `js/tema.js` – temaval och temamenyn (laddas först i `<head>`)
- `js/kalla.js` (`Kalla`) – länken till källkoden vid den commit som körs (AGPL §13), på alla sidor
- `js/version.js` – versionsnummer och datum (`window.HOJDKURVOR`). Skript och
  stilmallar laddas med `?v=<version>`; `node test/version.test.js --skriv`
  skriver in den i HTML-sidorna, `app.js` och `vy3d.js`
- `.htaccess` – `Cache-Control: no-cache` och UTF-8 på en Apache-server (VPS:en kör Caddy och har samma inställningar i `drift/apps.caddy` i agrellarkitektur/apps)
- `js/karna.js` (`Terrang`) – höjddata, omprojicering, höjdkurvor, DXF, XYZ och
  CSV, lokal vridning och nordpilar
- `js/laser.js` – laserdata: katalogsök, läsning av COPC, LAS och XYZ
- `js/ortofoto.js` – ortofoto: katalogsök, val av bild, läsning av COG med
  Range från lämplig översiktsnivå och omritning till zonen
- `js/kommunfil.js` – kommunfiler från Lantmäteriets nedladdning (marktäcke,
  byggnader, fastighetsindelning): hämtning, lagring i webbläsaren, GeoPackage
  och klippning
- `js/marktacke.js` – marktäcke: klasser, färger och DXF
- `js/byggnad.js` – befintliga byggnader: höjd och takform ur laserdatan, DXF, CSV och volymer; tar bort träd vid husen
- `js/ifc.js` (`Ifc`) – befintliga byggnader som IFC4 (extruderade volymer, egenskaper, stabila GlobalId)
- `js/fastighet.js` – fastighetsgränser, gränspunkter och beteckningar, DXF
- `js/stompunkt.js` – Stompunkt Direkt: sökning inom utsnittet, DXF och CSV
- `js/vagar.js` – vägar från OpenStreetMap via Overpass: bilvägar och gångvägar, klassning, utkast till vägytor (bredd ur OSM, schablon eller mätt i ortofotot) och DXF
- `js/objektval.js` (`Objektval`) – egna val för enskilda träd och hus: dölja, rätta trädens art, höjd och krona, skära bort dolda ur ytmodellen
- `js/topowebb.js` – läser Topografisk webbkarta ur Lantmäteriets GeoPackage
  (172 GB) med HTTP Range, några få sidor åt gången
- `js/analys.js` (`Analys`) – ytmodell ur laserdata, träd, skuggor, sektioner, horisont
- `js/platsanalys.js` (`Platsanalys`) – höjdpunkter, lutning, skyfall
  (sänkfyllning och flödesackumulering), lagren som bild, skissade volymer och tak
- `js/geodata.js` (`Geodata`) – skyddad natur, lämningar, översvämning och
  vatten från andra myndigheter och OpenStreetMap
- `js/platsanalysblad.js` – platsanalysens A3-häfte (PDF)
- `js/utbyte.js` (`Utbyte`) – utbytet med cad-apa, se `docs/UTBYTE-CAD-APA.md`
- `js/projekt.js` (`Projekt`) – projektet: formatet för projektfilen (`.hojdkurvor`, zip med
  `projekt.json`), läsning och migrering, okända fält som bevaras, omräkning av volymer och
  trädval mellan zon och SWEREF 99 TM, och lagringen i IndexedDB; se `docs/PROJEKTFIL.md`
- `js/vy3d.js` (`Vy3D`) – 3D-förhandsvisning med three.js, laddas först när den
  öppnas; lager som kan slås av och på, panorering, valbar kurvfärg, skuggor
  efter datum och tid, konturer, hus-, kontur-, gräns- och skissfärg, takformer
  ur laserdatan, ögonhöjd och bilder
- `js/trad3d.js` (`Trad3D`) – trädmodellerna i 3D (gran, tall, lövträd och björk; enkla och detaljerade i flera varianter), också till cad-apa; laddas med sidan
- `js/volym3d.js` (`Volym3D`) – volymerna att modellera i 3D: primitiver, takytor, snäpp, kontakter, länkar och konturer; laddas med sidan (takytorna används också i skissens DXF)
- `js/bild3d.js` (`Bild3D`) – kantlinjer, djupkarta och storlek för bilderna ur 3D-vyn
- `js/utskrift.js` – skalenlig utskrift (PDF) och skuggstudiens översiktsblad
- `js/sol.js` – solberäkningar och soldiagram som PDF, med eller utan horisont
- `js/dxf.js` – DXF-skrivare och sammanslagning till en samlad DXF
- `js/bestall.js` – beställningsformuläret
- `js/synpunkter.js` – BETA-knappen och formuläret Skicka synpunkter, på alla sidor
- `js/app.js` – karta, panel, lager, ritning, mobilflöde, projektlänk, projektet, felrapport
- `data/kommuner.json` – förenklade kommungränser med kommunkod och föreslagen
  SWEREF 99-zon (fältet `epsg`; Kiruna saknar värde eftersom kommunen använder
  flera zoner)
- `vendor/` – tredjepartsbibliotek och typsnitt, se `THIRD-PARTY.md`
- `test/` – tester, testserver och testdata, se `test/README.md`

## Externa tjänster

- Höjddata och laserdata: dl1.lantmateriet.se, katalog api.lantmateriet.se
- Ortofoto: COG på dl1.lantmateriet.se/bild/data/orto/…, katalog
  api.lantmateriet.se/stac-bild (`/v1/search?bbox=…` över alla år). Appen väljer
  senaste flygåret med färgbild (`rgbi` eller `rgb`) i SWEREF 99 TM som täcker
  utsnittet och läser bara utsnittet, som laserdatan
- Kommunfiler (GeoPackage i zip, en per kommun, katalog api.lantmateriet.se/stac-vektor):
  - Marktäcke: dl1.lantmateriet.se/mark/marktacke/marktacke_knKKKK.zip
  - Byggnader: dl1.lantmateriet.se/byggnadsverk/byggnad_knKKKK.zip (skiktet `byggnad`)
  - Fastighetsindelning: dl1.lantmateriet.se/fastighet/fastighetsindelning_knKKKK.zip
    (skikten `registerenhetsomradesyta`, `registerenhetsomradesgrans`, `granspunkt`)
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
skog, Ortofoto Nedladdning, Byggnad Nedladdning, vektor, Fastighetsindelning Nedladdning, vektor,
Marktäcke Nedladdning, vektor, Stompunkt Direkt och Topografisk
webbkarta Nedladdning, raster. Platsanalysens kapitel Skydd kräver ingen inloggning.

## Kommande

- Ortofoto som bakgrund för hela kartan kräver Ortofoto Visning, en annan produkt.
- Hydrografi, Topografi 10 som vektor och NVDB.
- Modelleringen i 3D (0.10.x): urtag (en volym skär bort en del av en annan) och egna takfotslinjer.
- Platsanalysen: klimat (snölast, vind, växtzon) och buller från vägar. Visas
  som KOMMER i panelen tills datakällorna är kontrollerade.
- Avvaktar: schakt och fyll, solkarta, OBJ/GeoTIFF, IFC för terrängen och skissen, exempelprojekt.
- Planerat (se `docs/SYNPUNKTER.md`): sol på fasaderna (0.14.0), förslag och sparade vyer i
  projektet, eget bildunderlag som överlagring (projektfilens bilagor), skissvolymer ur
  inskannat underlag, en html-visare i nedladdningsmappen och DXF med inlänkade filer (xref)
  och ortofoto.

## Data som sparas i webbläsaren

- IndexedDB (databasen `terrangunderlag`, version 2): marktäcke, byggnader och fastighetsindelning, en fil per kommun och produkt
  (objektlagringen `filer`). Appen frågar Lantmäteriet om
  filen ändrats innan den används igen. Projekten (objektlagringen `projekt`, 0.13.0): utsnitt, val och
  inmatning, sparade en halv sekund efter varje ändring. Under 02 Underlag, "Sparat i
  webbläsaren", kan man ta bort enstaka filer och projekt eller tömma filerna.
- localStorage: tema, bakgrund, dolda lager, utskriftens inställningar, 3D-vyns färger, konturer, takformer och trädnivå, egna takformer per hus (`terrang-takval`), dolda och rättade träd (`terrang-tradval`) och dolda hus (`terrang-husval`),
  formulärets val, senaste utsnittet (för sidan Beställ), mobil- eller helvy och,
  om användaren väljer det, inloggningen.
- sessionStorage: aktivt steg, vilket projekt fliken har öppet (`terrang-projekt-aktivt`),
  dolda lager (följer också med i projektet), skuggor och soltid i 3D-vyn, bara så länge fliken är öppen.
  Sektionslinjer, horisontens punkt, skissens volymer och projekt-id låg här före 0.13.0 och
  flyttas in i ett projekt första gången sidan öppnas.

## Licenser för datan

Höjddata, laserdata, ortofoto, byggnader, fastighetsindelning, marktäcke och
Topografisk webbkarta: © Lantmäteriet, CC BY 4.0. Stompunkter: Lantmäteriet, öppna data (CC0). Skyddad natur:
Naturvårdsverket, CC0. Lämningar: Riksantikvarieämbetet. Översvämningskarteringar:
Myndigheten för civilt försvar. Vägar och vatten: © OpenStreetMap-bidragsgivare,
ODbL. Källan anges i varje nedladdad info-fil, i utskriften och i
platsanalysbladet. Laserdata och ortofoton kan enligt Lantmäteriets villkor innehålla
personuppgifter. Den som hämtar datan ansvarar för att hantera den enligt GDPR.

## Licens

**Licens**
Höjdkurvor är fri programvara under GNU Affero General Public License v3.0
eller senare (AGPL-3.0-or-later, se `LICENSE`). Du får använda, studera,
ändra och dela programmet fritt, även i kommersiellt arbete. Kör du en
ändrad version som tjänst måste du erbjuda användarna din källkod. Låt
länken *Källkoden* på sidorna (`js/kalla.js`) finnas kvar och peka på din
kod. AGPL gäller från version 0.13.2; tidigare versioner är GPL-3.0 eller
senare (`LICENSES/GPL-3.0.txt`).

**Kommersiell licens**
Vill du bygga in Höjdkurvor i en produkt eller tjänst utan AGPL:s villkor
finns kommersiella licenser. Kontakta kontakt@agrellarkitektur.se.

**Namn och varumärke**
Namnen Höjdkurvor och höjdkurvor.se och logotypen får inte användas för
ändrade versioner utan skriftligt tillstånd.

**Bidrag**
Bidrag välkomnas och kräver att du godkänner vårt CLA, se
`CONTRIBUTING.md`.

**Data**
Lantmäteriets och de andra källornas data är inte kod och omfattas inte av
AGPL; den har egna villkor, se `THIRD-PARTY.md` och avsnittet ovan.

**Stöd utvecklingen**
Privatpersoner kan ge ett frivilligt bidrag, och företag kan teckna
supporteravtal mot faktura. Se Om-sidan och kontakt@agrellarkitektur.se.

## Ändra en kommuns zon

Öppna `data/kommuner.json`, sök på kommunnamnet och ändra `"epsg"`.
Zonerna: 3007 = 12 00, 3008 = 13 30, 3012 = 14 15, 3009 = 15 00, 3013 = 15 45,
3010 = 16 30, 3014 = 17 15, 3011 = 18 00, 3015 = 18 45, 3016 = 20 15,
3017 = 21 45, 3018 = 23 15, 3006 = SWEREF 99 TM.
