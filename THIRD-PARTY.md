# Det som kommer från andra

Höjdkurvor är fri programvara under GNU AGPL-3.0 eller senare (se `LICENSE`).
Till och med version 0.13.1 var den GPL-3.0 eller senare
(`LICENSES/GPL-3.0.txt`). Här står allt i appen och repot som andra har gjort,
med licens. Alla licenserna för kod och typsnitt är förenliga med AGPL-3.0.
Licenstexterna ligger i `vendor/licenses/`.

Ett kommersiellt undantag från Agrell Arkitektur AB gäller bara Agrell
Arkitektur AB:s egen kod, aldrig det som står här.

Gås igenom när ett beroende eller en tillgång läggs till eller tas bort
(senast 0.13.2, 19 november 2026).

## Bibliotek som följer med appen (`vendor/`)

| Fil | Bibliotek | Version | Används till | Licens | Licenstext |
|---|---|---|---|---|---|
| `leaflet/` | [Leaflet](https://leafletjs.com) | 1.9.4 | Kartan | BSD-2-Clause | `leaflet.txt` |
| `proj4.js` | [proj4js](https://github.com/proj4js/proj4js) | 2.22 | Koordinatsystem | MIT | `proj4js.txt` |
| `geotiff.js` | [geotiff.js](https://github.com/geotiffjs/geotiff.js) | 2.1.3 | Höjddata och ortofoton (GeoTIFF/COG) | MIT; innehåller LERC från Esri, Apache-2.0 | `geotiff.txt`, `apache-2.0.txt` |
| `jszip.min.js` | [JSZip](https://stuk.github.io/jszip/) med pako | 3.10 | Zip-filer och projektfilen | MIT (vald av två, MIT eller GPL-3.0); pako MIT och Zlib | `jszip.txt`, `pako.txt` |
| `jspdf.umd.min.js` | [jsPDF](https://github.com/parallax/jsPDF) | 4.2.1 | PDF:erna | MIT; se nedan | `jspdf.txt` |
| `sql-wasm.js`, `sql-wasm.wasm` | [sql.js](https://github.com/sql-js/sql.js) med SQLite | 1.15 | Marktäcket (GeoPackage) | MIT; SQLite är allmän egendom | `sqljs.txt` |
| `copc-bundle.js` | [copc.js](https://github.com/connormanning/copc.js) | 0.0.8 | Laserdata (COPC) | MIT | `copc.txt` |
| `laz-perf.wasm` | [laz-perf](https://github.com/hobuinc/laz-perf) | 0.0.7 | Laserdata (LAZ) | Apache-2.0 | `apache-2.0.txt` |
| `three/three.module.min.js` | [three.js](https://threejs.org) | 0.170.0 | 3D-vyn | MIT | `three.txt` |

Filerna är oförändrade utgåvor från npm, utom `copc-bundle.js` som är copc.js
med sina beroenden (bland annat laz-perf) sammanslagen till en fil.

**jsPDF** innehåller några mindre delar från andra med egna, tillåtande
villkor: färgtolken av Stoyan Stefanov ("Use it if you like it"), MD5 av
Joseph Myers (ingen särskild licens, fri att använda), delar av FPDF
(tillåtande licens) och pako (MIT och Zlib). De följer med jsPDF:s egen
licenstext.

## Typsnitt (`vendor/fonts/`)

| Typsnitt | Används till | Licens | Licenstext |
|---|---|---|---|
| [Familjen Grotesk](https://github.com/Familjen-Sthlm/Familjen-Grotesk) | Gränssnittet och PDF:erna | SIL Open Font License 1.1 | `familjen-grotesk-ofl.txt` |
| [IBM Plex Mono](https://github.com/IBM/plex) | Gränssnittet och PDF:erna | SIL Open Font License 1.1 | `ibm-plex-mono-ofl.txt` |

Typsnitten bäddas in i PDF:erna. OFL tillåter det, och PDF:erna blir inte
OFL eller AGPL för det.

## Data i repot

- `data/kommuner.json`: förenklade kommungränser från
  [okfse/sweden-geojson](https://github.com/okfse/sweden-geojson) (Open
  Knowledge Sweden, ursprungligen Valmyndighetens data). Projektet anger "Feel
  free to reuse" men har ingen licensfil. Det är data, inte kod, och omfattas
  inte av AGPL eller av ett kommersiellt undantag. Fältet `epsg` (föreslagen
  SWEREF 99-zon) är sammanställt ur Lantmäteriets uppgifter om vilka zoner
  kommunerna använder.
- `test/data/`: syntetisk testdata skapad för testerna, utom
  `stac-bild-sok-vimmerby.json` (ett svar från Lantmäteriets bildkatalog,
  metadata) och `wkt5845.txt` (koordinatsystemets beskrivning ur
  EPSG-registret). Följer inte med appen.

## Lantmäteriets data och annan data som hämtas när appen används

Datan är inte kod och ingår inte i källkoden. Den hämtas av besökarens
webbläsare direkt från källan, med egna villkor som gäller oberoende av
Höjdkurvors licens. AGPL gäller inte datan, och ett kommersiellt undantag
från Agrell Arkitektur AB omfattar den inte.

**Lantmäteriet** står för det mesta. Höjddata, laserdata, ortofoton, byggnader,
fastighetsindelning och marktäcke hämtas med användarens eget konto hos
Lantmäteriet (Geotorget), och användningen följer Lantmäteriets villkor för
respektive tjänst och den licens som anges där. Laserdata och ortofoton kan
enligt villkoren innehålla personuppgifter; den som hämtar datan ansvarar för
att hantera den enligt GDPR. Källan anges i varje nedladdad info-fil, i
utskriften och i platsanalysbladet.

| Källa | Licens |
|---|---|
| Lantmäteriet: Markhöjdmodell, Laserdata skog, Ortofoto, Byggnad, Fastighetsindelning, Marktäcke, Topografisk webbkarta | CC BY 4.0, enligt Lantmäteriets villkor |
| Lantmäteriet: Stompunkter | CC0 |
| Naturvårdsverket: Naturvårdsregistret, Natura 2000 | CC0 |
| Riksantikvarieämbetet: Kulturmiljöregistret (lämningar) | Se Riksantikvarieämbetets villkor |
| Myndigheten för civilt försvar: översvämningskarteringar | Se myndighetens villkor |
| OpenStreetMap (vägar, vatten, bakgrundskarta, adressök) | ODbL |
| OpenTopoMap (bakgrundskarta) | CC BY-SA |
