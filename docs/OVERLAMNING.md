# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 23 oktober 2026, 0.6.0 publicerad.

## Läget

- **0.6.0 är publicerad** 23 oktober: `v0.6.0` sammanslagen med `main`, och
  publicerad med FTP (Publicera på webbhotellet). Första körningen hamnade i
  fel mapp eftersom `FTP_DIR` saknade `public_html`; rätt värde är
  `/agrellarkitektur.se/public_html/terrang/`. Den felplacerade mappen kan
  ligga kvar på servern. Sidan:
  <https://agrellarkitektur.se/terrang/>. Ingen GitHub-release är gjord för
  0.6.0; det behövs inte längre för publiceringen.
- Innehåll i 0.6.0: ortofoto, befintliga byggnader, fastighetsgränser,
  lat/long, tydligare knappar, gemensam kommunfilshämtning (`js/kommunfil.js`)
  och FTP-publicering vid push till `main`.
- **Väntar på Carl August**: hans test på iPhone och Windows mot riktiga data
  (knapparna, lat/long, byggnader, fastighetsgränser, ortofotot). Det mesta
  av det nya kan bara provas på den publicerade sidan (Lantmäteriets CORS).

## Ortofoto (`js/ortofoto.js`)

- Söker i `/stac-bild/v1/search?bbox=…` (alla år, sidvis), väljer färgbilder
  (`rgbi`, `rgb`) i EPSG:3006, grupperade per flygår, typ och upplösning:
  helt täckande först, sedan senaste året, sedan finast upplösning. `cir`,
  `pan` och EPSG:3021 väljs aldrig.
- Upplösning: källans (0,16 m) om bilden ryms inom 16 Mpx och 8192 px per sida
  (iPhones canvasgräns), annars 0,25 / 0,5 / 1 m …
- Läser bara utsnittet ur COG:en med Range, från den grövsta översiktsnivån som
  är minst lika fin som målet, och ritar om bilinjärt till zonen (exakt
  omvandling var 32:a pixel, linjärt längs raderna). (0, 0, 0) är tomt.
  YCbCr-JPEG läses med `readRGB`. 16 Mpx tar cirka 1,3 s i Node.
- Zip: `ortofoto/…_ortofoto.jpg` med `_lokal.jgw` och `_sweref.jgw` (byt namn
  på en, som för höjd över mark). Kartan: eget pane (z-index 350) under de
  andra lagren, nedskalad till högst 2048 px. Utskriften: inom utsnittet, under
  marktäcket (som då blir halvgenomskinligt). 3D: textur, knappen Ortofoto slår
  av och på.
- **Okontrollerat mot riktiga filer**: att dl1 svarar på Range med CORS för
  `/bild/` (laserdatan på samma server fungerar), vilken komprimering och vilka
  översiktsnivåer Lantmäteriets COG:er har, och att band 1–3 är R, G, B (enligt
  produktbeskrivningen för RGBI). Felmeddelandena säger vad som stoppade.
- Testdata: `test/data/make_orto.py` (COG:er med kontrollinjer var tionde
  meter), `/stac-bild/` i testservern, `test/ortofoto.test.js`.

## Nästa session

1. Kontrollera att sidan visar 0.6.0 (Om-sidan eller `js/version.js`). Visar
   den fortfarande 0.5.0 kan webbläsaren ha cachat; annars titta i loggen för
   körningen med `gh run view`.
2. Ta emot hans testresultat och rätta i 0.6.1, på en egen gren som slås ihop
   med `main` när den är klar.
3. Sortera Inkorgen i `docs/SYNPUNKTER.md` efter version innan nästa version
   planeras.
4. Arbetsflödena varnar för Node 20 (`actions/checkout@v4`, `setup-node@v4`,
   FTP-Deploy-Action). Fungerar än; byt till nyare versioner när de finns.

## Lantmäteriets leveranser (kontrollerat 23 oktober)

- Ortofoto, byggnader och fastighetsindelning har licensen **CC BY 4.0**,
  avgift 0 kr, särskilda användarvillkor vid beställningen (GDPR,
  fastighetsregisterlagen). Varje användare behöver egen beställning.
- **Byggnader och fastighetsindelning**: en zip med en GeoPackage per kommun,
  `dl1.lantmateriet.se/byggnadsverk/byggnad_knKKKK.zip` och
  `dl1.lantmateriet.se/fastighet/fastighetsindelning_knKKKK.zip`. Byggnadsskiktet
  `byggnad`; 83 % av fotavtrycken inmätta vid takkanten, ingen höjd i datan.
  Fastighetsindelningen (2025) har skikten `registerenhetsomradesyta`,
  `registerenhetsomradesgrans`, `granspunkt`, `traktyta` m.fl., inget textskikt.
- **Ortofoto**: 735 samlingar i `/stac-bild/v1`, en per område och år. Svar för
  Vimmerby i `test/data/stac-bild-sok-vimmerby.json`. Rutor 2,5 × 2,5 km
  (0,16 och 0,25 m) eller 5 × 5 km (0,5 m).
- Riktiga filer för Vimmerby finns inte i repot. Be Carl August om dem om de
  behövs.

## Idéer som inte är beslutade

- Ortofotot i platsanalysbladets kartor och som underlag i cad-apa.
- Val av flygår eller upplösning för ortofotot (nu senaste och automatiskt).
- Fastighetsgränserna i platspaketet till cad-apa (nu bara byggnaderna).
- Byggnader utan laserdata: höjd saknas; schablon per typ vore möjligt men osäkert.
- Byggnader i skuggstudien utan laserdata.

## Kvar sedan tidigare

- **cad-apa har inte byggt sin sida av utbytet än.** Ändra inget i cad-apa
  härifrån. Fältet `byggnader` är beskrivet i `docs/UTBYTE-CAD-APA.md`.
- Platsanalysen: klimat (snölast, vind, växtzon) och buller står som KOMMER.
- Avvaktar enligt Carl August: schakt och fyll, solkarta, OBJ/GeoTIFF, IFC,
  exempelprojekt.
- Licensvillkoren för Riksantikvarieämbetets och MCF:s data och
  kommungränserna (`data/kommuner.json`) är inte kontrollerade.
- Myndigheternas tjänster i kapitlet Skydd är bara testade mot låtsassvar.
- Domänflytten till höjdkurvor.se kräver att Lantmäteriet godkänner den nya
  adressen för CORS först (README).

## Testmiljön

GDAL saknas från början. `apt-get install gdal-bin python3-gdal poppler-utils`
och `python3.12 -m pip install --break-system-packages "numpy<2" "scipy<1.15" copclib`
behövs för `make_dtm.py`, `make_landskap.py`, `make_vektor.py` och
`make_orto.py` (kör `make_dtm.py` först); `pip install --break-system-packages
pyproj playwright pillow` och `python3 -m playwright install --with-deps
chromium` för testservern och gränssnittstesterna.
