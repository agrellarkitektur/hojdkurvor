# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 26 oktober 2026, 0.7.0 publicerad.

## Läget

- **0.7.0 är klar** 26 oktober: byggd på grenen `v0.7.0`, sammanslagen med
  `main` och publicerad med FTP. Innehåll: BETA-knapp med version och
  formuläret Skicka synpunkter (`js/synpunkter.js`, `synpunkter.php`),
  dialogen Klistra in koordinater med kommun och koordinatsystem, lager i
  3D-vyn (höjdkurvor, fastighetsgränser, vägar, fotavtryck för hus utan höjd),
  fastighetsgränser i platspaketet till cad-apa, och en rättelse: kurvornas
  höjd kom med som `null` till cad-apa sedan 0.5.0.
- **Synpunkterna kräver `feedback-config.php` på servern.** Skriptet letar i
  mappen ovanför appen (`public_html`) och sedan i `terrang/`. Ligger cad-apas
  fil redan i `public_html` fungerar det direkt. Kontroll: öppna
  <https://agrellarkitektur.se/terrang/synpunkter.php> i webbläsaren; det ska
  svara `"ok":true`. Inte provat mot webbhotellet.
- **Väntar på Carl August**: test på iPhone och Windows mot riktiga data av
  både 0.6.0 (byggnader, fastighetsgränser, ortofoto, lat/long) och 0.7.0
  (synpunktsformuläret skickar och når Gmail, koordinatdialogen, 3D-lagren).
  Koordinatdialogen läser urklippet direkt; på iPhone kan Chrome fråga om lov
  eller inte tillåta det, och då klistrar man in i rutan.

## Koordinatdialogen

`Terrang.tolkaZon(x, y, hittaKommun)` prövar utsnittets mitt i alla 13
system. Ett system "passar" om punkten hamnar i en kommun som normalt använder
det (`data/kommuner.json`). Alla lokala zoner har samma falska östvärde, så
fel zon flyttar platsen 0,75–1,5 grader i öst–väst, och det händer att den då
hamnar i en annan kommun som också passar (Vimmerbys koordinater i 15 00
passar t.ex. en kommun längre västerut). Dialogen väljer i första hand den
kommun som redan är vald, sedan den zon som redan är vald, och säger alltid
vilka andra system som passar. Text med EPSG eller SWEREF-namn går före.

## 3D-vyn

`Vy3D.visa` får kurvor, fastighetsgränsernas linjer, vägarnas linjer och
fotavtryck för byggnader utan höjd. Linjerna draperas på marken med bilinjär
höjd ur rutnätet (punkter minst var 0,5 m). `vy3d.lager()` och
`vy3d.visaLager(namn, på)` styr lagren; knapparna byggs i `ritaLager3d` i
`app.js` och dolda lager sparas i sessionStorage (`terrang-3d-dolda`).

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

1. Kontrollera att sidan visar 0.7.0 (BETA-knappen) och att
   `synpunkter.php` svarar `"ok":true`. Fråga Carl August om ett prov på
   formuläret kom fram till Gmail.
2. Ta emot hans testresultat och rätta i 0.7.1, på en egen gren som slås ihop
   med `main` när den är klar.
3. Sortera Inkorgen i `docs/SYNPUNKTER.md` efter version innan nästa version
   planeras, och stäm av sorteringen med honom.
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
- Byggnader utan laserdata: höjd saknas (i 3D syns de som fotavtryck);
  schablon per typ vore möjligt men osäkert.
- En enkel skissmodellsbyggare i höjdkurvor (rita i 2D och extrudera), om
  cad-apa inte behöver skicka tillbaka modeller. Står under Senare i
  synpunktsfilen.
- Byggnader i skuggstudien utan laserdata.

## Kvar sedan tidigare

- **cad-apa har inte byggt sin sida av utbytet än.** Ändra inget i cad-apa
  härifrån. Fälten `byggnader` och `fastigheter` är beskrivna i
  `docs/UTBYTE-CAD-APA.md`.
- Platsanalysen: klimat (snölast, vind, växtzon) och buller står som KOMMER.
- Avvaktar enligt Carl August: schakt och fyll, solkarta, OBJ/GeoTIFF, IFC,
  exempelprojekt.
- Licensvillkoren för Riksantikvarieämbetets och MCF:s data och
  kommungränserna (`data/kommuner.json`) är inte kontrollerade.
- Myndigheternas tjänster i kapitlet Skydd är bara testade mot låtsassvar.
- Domänflytten till höjdkurvor.se kräver att Lantmäteriet godkänner den nya
  adressen för CORS först (README).

## Testmiljön

GDAL saknas från början. Kör `apt-get update` först, annars hittas inte
paketen: `apt-get install gdal-bin python3-gdal poppler-utils`, och
`python3.12 -m pip install --break-system-packages "numpy<2" "scipy<1.15" copclib`
för `make_dtm.py`, `make_landskap.py`, `make_vektor.py` och `make_orto.py`
(kör `make_dtm.py` först). Testservern och gränssnittstesterna körs med
`python3` (som kan vara en annan version än 3.12):
`python3 -m pip install --break-system-packages pyproj playwright pillow` och
`python3 -m playwright install --with-deps chromium`. Kvarvarande 404 i
gränssnittstestet (`m643_*.tif` för horisonten och `topowebb-3006.gpkg`) är
kända luckor i testdatan.
