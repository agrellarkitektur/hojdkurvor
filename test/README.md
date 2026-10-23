# Tester

Allt körs lokalt mot en testserver som låtsas vara Lantmäteriet och de andra
tjänsterna. Inga riktiga konton eller nycklar behövs. Inloggningen i testerna,
`test` / `hemligt-åäö`, finns bara i testservern.

## Enhetstest (Node)

```
node test/platsanalys.test.js
```

```
node test/byggnad.test.js
```

```
node test/fastighet.test.js
```

Höjdpunkter, lutning, skyfall, volymer och tak, DXF-läsning och strandskydd
på syntetiska rutnät, och byggnader och fastighetsindelning ur låtsasfilerna.
Tar några sekunder. Med `BYGGNAD_GPKG=…/byggnad_knKKKK.gpkg` och
`FASTIGHET_GPKG=…/fastighetsindelning_knKKKK.gpkg` körs samma kontroller
också på riktiga filer från Lantmäteriet (för Vimmerby centrum, kommun 0884).

## Testdata

Testservern behöver ett syntetiskt landskap kring testtomten i Kinda
(SWEREF 99 TM 539 000–541 000, 6 427 000–6 429 000). Det är för stort för
repot och skapas med:

```
python3.12 test/data/make_dtm.py test/data
```

```
python3.12 test/data/make_landskap.py test/data test/data/wkt5845.txt
```

Kräver numpy, scipy, GDAL (osgeo) och copclib. `make_dtm.py` skapar
höjdmodellens två rutor (`m642_53.tif`, `m642_54.tif`) och `make_landskap.py`
en COPC-fil med träd och ett hus (`y21c007-64275_5375_25.copc.laz`) och facit
(`facit.json`) på samma markyta.
`marktacke_kn0513.zip` (fem ytor), `byggnad_kn0513.zip` (huset i laserdatan,
ett garage och en lada) och `fastighetsindelning_kn0513.zip` (tre fastigheter,
gränser med olika lägesosäkerhet) ligger redan i `test/data/`. De två senare
skapas med `python3.12 test/data/make_vektor.py test/data` och har samma skikt
och fält som Lantmäteriets filer i 2025-versionen.

Topografisk webbkarta (`topowebb-3006.gpkg`) finns inte med. Utan den svarar
testservern 404 när testet väljer Lantmäteriets karta, och utskriften görs utan
bakgrund. Resten av testet påverkas inte.

## Testserver

```
python3 test/server.py test/data .
```

Lyssnar på `http://127.0.0.1:8765` och serverar appen därifrån. Kräver pyproj.
Den låtsas vara:

- Lantmäteriets nedladdning (Basic auth, Range, HEAD, CORS), STAC-katalogen
  och Stompunkt Direkt
- Overpass (vägar, och sjön Lillsjön när frågan gäller vatten)
- Naturvårdsverkets WFS (`/nv/wfs`, ett naturreservat), Natura 2000 (`/n2k/wfs`, tomt)
- Riksantikvarieämbetets WMS (`/raa/wms`, två lämningar)
- MCF:s översvämnings-WMS (`/mcf/wms`, vänstra tredjedelen för 100-årsflödet)

## Gränssnittstest (Playwright, Chromium)

Med testservern igång:

```
python3 test/ui_test.py test/ut ritning
```

```
python3 test/mobil_test.py test/ut
```

`ui_test.py` går igenom hela flödet på en dator: rita och ändra utsnittet,
alla fyra stegen, DXF-skiss, inloggning, Skapa med alla tillval och
platsanalysen, zip-filens innehåll, utskrift i skala, 3D-vyn, projektlänken och
utbytet med en låtsas-cad-apa (`test/cad-apa-mock.html`). Andra argumentet är
temat: `ritning`, `lugn` eller `mork`. Skärmbilder och zip-filens innehåll
hamnar i utkatalogen. Ett helt varv tar några minuter.

`mobil_test.py` testar mobilflödet (390 × 844, pekskärm) i alla tre teman.

Testerna pekar om appens adresser med globala variabler som sätts före sidan
laddas (`TERRANG_DL_ROT`, `TERRANG_STAC_BAS`, `TERRANG_API_BAS`,
`TERRANG_OVERPASS`, `TERRANG_GEODATA`, `TERRANG_CADAPA`) och använder
`window.__punkt` för att räkna om koordinater till skärmpunkter. De påverkar
inte appen när de inte är satta.

WebKit (Safari) finns inte i testmiljön. Testa på riktig iPhone efter större
ändringar i gränssnittet.
