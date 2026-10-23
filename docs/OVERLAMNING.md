# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 23 oktober 2026, mitt i 0.6.0.

## Läget

- **0.5.0 är släppt** och ligger på <https://agrellarkitektur.se/terrang/>.
- **0.6.0 byggs på grenen `v0.6.0`** (inte `main`). Pushen till `main`
  publicerar direkt på webbhotellet, så grenen slås ihop först när versionen är
  klar och testad. Det som är gjort står i `CHANGELOG.md` under 0.6.0.
- Gjort på grenen:
  1. FTP-publicering: `.github/workflows/publicera.yml`, vid varje push till
     `main` (Carl August valde det), `config.js` följer med (han har inte
     ändrat den på servern). Har inte körts än: första körningen sker när
     grenen slås ihop. Kontrollera med `gh run list` och att sidan fungerar.
  2. Synpunkterna från egen användning: lat/long i decimalgrader (panelen
     och info-filen), Förhandsvisa i 3D som knapp, fylld knapp bara för nästa
     steg. Han har inte sett det på iPhone än.
  3. `js/kommunfil.js`: gemensam hämtning, lagring och GeoPackage-läsning för
     marktäcke, byggnader och fastighetsindelning. `marktacke.js` använder den.
  4. Byggnader (`js/byggnad.js`) och fastighetsgränser (`js/fastighet.js`),
     med enhetstester (`test/byggnad.test.js`, `test/fastighet.test.js`) och
     låtsasfiler (`test/data/make_vektor.py`).
- Alla tester är gröna (enhetstesterna, gränssnittstestet i alla tre teman,
  mobiltestet). PDF:erna är renderade och granskade.

## Lantmäteriets leveranser (kontrollerat 23 oktober)

- Alla tre produkterna har licensen **CC BY 4.0** enligt STAC-katalogen,
  avgift 0 kr, särskilda användarvillkor vid beställningen (GDPR,
  fastighetsregisterlagen). Varje användare behöver egen beställning.
- **Byggnader och fastighetsindelning**: en zip med en GeoPackage per kommun,
  `dl1.lantmateriet.se/byggnadsverk/byggnad_knKKKK.zip` och
  `dl1.lantmateriet.se/fastighet/fastighetsindelning_knKKKK.zip` (samma mönster
  som marktäcket, katalog `/stac-vektor/v1/collections/{byggnader|fastighetsindelning}`).
  Vimmerby (0884): byggnader 3,4 MB, fastighetsindelning 12 MB.
- Byggnadsskiktet heter `byggnad` (MultiPolygon, kolumn `geometri`), fälten
  som i den gamla produktbeskrivningen. `andamal1` har formen
  `Bostad;Småhus friliggande`. 83 % av fotavtrycken är inmätta vid
  **takkanten**. Ingen höjd i datan.
- Fastighetsindelningen (2025-versionen) har **andra skikt än den gamla
  produktbeskrivningen**: `registerenhetsomradesyta` (trakt, block, enhet,
  omradesnummer, etikett som `3:269` eller `3:1>2`), `registerenhetsomradesgrans`
  (objekttyp: fastighetsgräns, traktgräns, kvarterstraktgräns, kommungräns …,
  `lagesosakerhetplan` i m, `matmetodplan` som text), `granspunkt`, `traktyta`,
  `registerenhetsomradespunkt`/`-linje` (samfälligheter). Inget textskikt;
  beteckningen placeras inne i ytan (`Fastighet.ankare`).
- Riktiga filer för Vimmerby fanns i sessionen men är inte incheckade. Be
  Carl August om dem igen om de behövs (länkarna ovan, med hans inloggning).
- **Ortofoto**: 735 samlingar i `/stac-bild/v1`, en per område och år
  (`orto-i2-2025` …), alla CC BY 4.0. Sök över alla med
  `/stac-bild/v1/search?bbox=lon,lat,lon,lat&limit=50`. Ett svarsexempel för
  Vimmerby ligger i `test/data/stac-bild-sok-vimmerby.json`. Varje item har
  `assets.data` = COG på dl1 (`…/bild/data/orto/se0_16m_sweref/2025_I2/o63900_5500_25_mr25.tif`),
  `properties.spektraltyp` (`rgbi` 4 band, `rgb`, `cir`, `pan`), `upplosning`
  (0,16 / 0,25 / 0,5 m), `proj:code` (EPSG:3006, historiska EPSG:3021),
  `proj:bbox`, `datetime`, och `assets.thumbnail` (jpg). En ruta 2,5 × 2,5 km
  i 0,16 m är 15 625 px och ~740 MB, så den måste läsas med Range (som
  laserdatan och Topografisk webbkarta). Okontrollerat: om dl1 svarar på Range
  med CORS för bildfilerna och om Basic-inloggningen räcker; laserdatan på
  samma server fungerar så.

## Nästa session: resten av 0.6.0

1. **Ortofoto** (`js/ortofoto.js`), som föreslaget och godkänt:
   - Sök i stac-bild, välj senaste `rgbi`/`rgb` i EPSG:3006 som täcker
     utsnittet (flera rutor kan behövas; mosaik). Läs bara utsnittet med
     geotiff.js (`vendor/geotiff.js`, `readRasters` med window och lämplig
     översiktsnivå), band 1–3 för RGB.
   - Georefererad bild i zip-filen: JPEG eller PNG + världsfil, lokal och
     SWEREF (jämför `Analys.varldsfil` och höjd över mark). Lagom upplösning,
     t.ex. 0,25 m upp till ett tak på pixlar.
   - Bild över utsnittet på kartan och i utskriften i skala (Lantmäteriets bild
     får skrivas ut). Inte som bakgrund för hela kartan: det kräver Ortofoto
     Visning, en annan produkt.
   - Gärna som textur på terrängen i 3D-vyn.
   - Låtsasdata: en liten COG i testservern (`/bild/…`, servern serverar efter
     filnamn) och ett STAC-svar för `/stac-bild/v1/search`. Testservern svarar
     i dag på `/stac-hojd/` med laserrutorna; lägg till `/stac-bild/`.
2. Lägg till Ortofoto i produkttabellen i `instruktioner.html`, README
   (Externa tjänster, filer) och Källor på `om.html`.
3. Ändringar på `om.html` (saknas för 0.6.0), höj `js/version.js` till 0.6.0,
   flytta CHANGELOG-rubriken från "under arbete" till datum.
4. Be Carl August testa på iPhone och Windows (knapparna, lat/long, nya
   tillval) innan grenen slås ihop.
5. Slå ihop `v0.6.0` med `main` och pusha. Det publicerar via FTP första
   gången (allt laddas upp). Kontrollera körningen och sidan.

## Idéer som inte är beslutade

- Fastighetsgränserna i platspaketet till cad-apa (nu bara byggnaderna).
- Byggnader utan laserdata: höjd saknas helt; ett schablonvärde per typ vore
  möjligt men osäkert. I skyfallet räknas de som 3 m höga hinder.
- Byggnader i skuggstudien utan laserdata (med laserdata finns de redan med
  via ytmodellen).

## Kvar sedan tidigare

- **cad-apa har inte byggt sin sida av utbytet än.** Ändra inget i cad-apa
  härifrån. Det nya fältet `byggnader` är beskrivet i `docs/UTBYTE-CAD-APA.md`.
- Platsanalysen: klimat (snölast, vind, växtzon) och buller från vägar står
  som KOMMER.
- Avvaktar enligt Carl August: schakt och fyll, solkarta, OBJ/GeoTIFF, IFC,
  exempelprojekt.
- Licensvillkoren för Riksantikvarieämbetets och MCF:s data och
  kommungränserna (`data/kommuner.json`) är inte kontrollerade.
- Myndigheternas tjänster i kapitlet Skydd är bara testade mot låtsassvar.
- Domänflytten till höjdkurvor.se kräver att Lantmäteriet godkänner den nya
  adressen för CORS först (README).

## Testmiljön

GDAL saknas från början. `apt-get install gdal-bin python3-gdal` och
`python3.12 -m pip install --break-system-packages "numpy<2" "scipy<1.15" copclib`
behövs för `make_dtm.py`, `make_landskap.py` och `make_vektor.py`; `pip install
--break-system-packages pyproj playwright` för testservern och
gränssnittstesterna.
