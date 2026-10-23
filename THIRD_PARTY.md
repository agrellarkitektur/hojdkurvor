# Tredjepartskod, typsnitt och data

Höjdkurvors egen kod är licensierad under GPL-3.0 eller senare (`LICENSE`).
Filerna nedan kommer från andra och har sina egna licenser, som alla går att
kombinera med GPL-3.0. Licenstexterna ligger i `vendor/licenses/`.

## Programbibliotek (`vendor/`)

| Fil | Bibliotek | Version | Licens | Licenstext |
|---|---|---|---|---|
| `leaflet/` | [Leaflet](https://leafletjs.com) | 1.9.4 | BSD-2-Clause | `leaflet.txt` |
| `proj4.js` | [proj4js](https://github.com/proj4js/proj4js) | 2.22 | MIT | `proj4js.txt` |
| `geotiff.js` | [geotiff.js](https://github.com/geotiffjs/geotiff.js) | 2.1.3 | MIT; innehåller LERC från Esri, Apache-2.0 | `geotiff.txt`, `apache-2.0.txt` |
| `jszip.min.js` | [JSZip](https://stuk.github.io/jszip/) med pako | 3.10 | MIT (vald av två, MIT eller GPL-3.0); pako MIT och Zlib | `jszip.txt`, `pako.txt` |
| `jspdf.umd.min.js` | [jsPDF](https://github.com/parallax/jsPDF) | 4.2.1 | MIT | `jspdf.txt` |
| `sql-wasm.js`, `sql-wasm.wasm` | [sql.js](https://github.com/sql-js/sql.js) med SQLite | 1.15 | MIT; SQLite är public domain | `sqljs.txt` |
| `copc-bundle.js` | [copc.js](https://github.com/connormanning/copc.js) | 0.0.8 | MIT | `copc.txt` |
| `laz-perf.wasm` | [laz-perf](https://github.com/hobuinc/laz-perf) | 0.0.7 | Apache-2.0 | `apache-2.0.txt` |
| `three/three.module.min.js` | [three.js](https://threejs.org) | 0.170.0 | MIT | `three.txt` |

Filerna är oförändrade utgåvor från npm, utom `copc-bundle.js` som är copc.js
med sina beroenden (bland annat laz-perf) sammanslagen till en fil.

## Typsnitt (`vendor/fonts/`)

| Typsnitt | Licens | Licenstext |
|---|---|---|
| [Familjen Grotesk](https://github.com/Familjen-Sthlm/Familjen-Grotesk) | SIL Open Font License 1.1 | `familjen-grotesk-ofl.txt` |
| [IBM Plex Mono](https://github.com/IBM/plex) | SIL Open Font License 1.1 | `ibm-plex-mono-ofl.txt` |

## Data

- `data/kommuner.json`: förenklade kommungränser från
  [okfse/sweden-geojson](https://github.com/okfse/sweden-geojson) (Open Knowledge
  Sweden, ursprungligen Valmyndighetens data). Projektet anger "Feel free to
  reuse" men har ingen licensfil. Fältet `epsg` (föreslagen SWEREF 99-zon) är
  sammanställt ur Lantmäteriets uppgifter om vilka zoner kommunerna använder.
- Testdatan i `test/data/` är syntetisk och skapad för testerna.

## Data som hämtas när appen används

Hämtas av besökarens webbläsare och ingår inte i källkoden:

| Källa | Licens |
|---|---|
| Lantmäteriet: Markhöjdmodell, Laserdata skog, Ortofoto, Byggnad, Fastighetsindelning, Marktäcke, Topografisk webbkarta | CC BY 4.0 |
| Lantmäteriet: Stompunkter | CC0 |
| Naturvårdsverket: Naturvårdsregistret, Natura 2000 | CC0 |
| Riksantikvarieämbetet: Kulturmiljöregistret (lämningar) | Se Riksantikvarieämbetets villkor |
| Myndigheten för civilt försvar: översvämningskarteringar | Se myndighetens villkor |
| OpenStreetMap (vägar, vatten, bakgrundskarta, adressök) | ODbL |
| OpenTopoMap (bakgrundskarta) | CC BY-SA |
