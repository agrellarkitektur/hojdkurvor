# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 29 oktober 2026, 0.9.1 publicerad (rättelser i 3D-vyn), 0.10.0 nästa.

## Läget

- **0.9.1 är klar** 29 oktober (gren `v0.9.1`, sammanslagen med `main`), efter
  Carl Augusts första prov av 0.9.0: Konturfärg och Gränsfärg, Takformer ur
  laserdatan, ögonhöjd utan pekarlås och realistiska träd. Se *3D-vyn i 0.9.1*.
  Inte testad av honom än.
- **0.9.0** (29 oktober): skuggor, konturer, hus- och skissfärg, trädmodeller,
  ögonhöjd och bilder i 3D-vyn. Se *3D-vyn i 0.9.0* nedan.
- **0.8.2** (27 oktober) bytte bara publiceringen till Node 24. **0.8.1** godkänd
  på Windows 27 oktober (IFC i Archicad i lokal nolla, Flytta, skift-dra,
  Kurvfärg). iPhone (två fingrar i 3D) är fortfarande inte testad.
- **Synpunktsformuläret** fungerar (provet kom fram till Gmail 27 oktober).
- **Planen**: 0.10.0 är att rita volymer i 3D-vyn, se nästa avsnitt. Allt är
  bestämt; vänta ändå på Carl Augusts test av 0.9.0 innan bygget börjar, så att
  rättelser kan komma först som 0.9.1.

## Skissfunktionen och 3D-vyn (bestämt 29 oktober)

Carl August valde Claudes förslag på alla punkter.

**Grundidé:** volymerna byggs av primitiver med exakta mått, men analyserna
(skuggor, horisont, skyfall, DXF, `branInVolymer`) får dem som i dag:
fotavtryck + golv + takfot + takform. Primitiven och gruppen sparas som extra
fält på volymen, så att gamla volymer från cad-apa och DXF fungerar som förut.

**0.9.0 – 3D-vyn** (byggd, se *3D-vyn i 0.9.0*):
- Träd: 3–4 modeller (gran, tall, löv) skalade efter laserhöjd och kronbredd,
  enklare på avstånd (iPhone). Ersätter klot och cylinder (`InstancedMesh`).
- Ögonhöjd: knapp, klick på marken, kameran 1,6 m över marken. Dator: WASD
  följer terrängen, musen tittar (pekarlås), skift springer, Esc tillbaka.
  Mobil: pekskärmsspak att gå med och dra för att titta.
- Spara bild: PNG i 2–4 × skärmen utan knappar. Bild för AI: zip med samma vy
  som färgbild, vit lermodell, kantlinjer och djupkarta. Vad Visoid helst vill
  ha ska provas med riktiga bilder.

**0.10.0 – volymer i 3D-vyn:**
- Modelleringen sker i 3D-vyn, med en ortografisk toppvy för exakt plan.
  Bara på dator; mobilen visar.
- Primitiver: rätblock (B × D × H), cylinder (Ø × H), prisma med
  sadel/pulpet/valm. Skapas i en ruta med mått, placeras med klick.
- Markera, flytta, rotera (15°-steg med skift), ändra mått numeriskt.
- Snäpp: yta mot yta, hörn och kant, ovanpå en annan volym (golv = den
  undres takfot), mot befintliga hus och fastighetsgränser. Avstånd kan skrivas
  in efter snäppet.
- Kedjeikon vid fogen när två volymer snäppt: klick gör en grupp som flyttas
  och roteras ihop, klick igen löser upp.
- I varandra: överlapp slås ihop (union) i 0.10.0.

**0.10.x:** bortskärning (en volym gör urtag i en annan, kräver CSG och att
analyserna får den nya formen) och egna takfotslinjer.

## 3D-vyn i 0.9.1

- **Färger**: `konturfarg(hex)` (konturerna och fotavtrycken utan höjd) och
  `gransfarg(hex)` (fastighetsgränserna); localStorage `terrang-3d-konturfarg`
  och `terrang-3d-gransfarg`.
- **Takformer**: `Byggnad.hojder` sparar `b.tak` (inte uppräkningsbar, följer
  inte med i JSON) med ytmodellen (`z`) och cellens egna laserpunkter (`punkt`,
  ur `y.ra`) i en ruta runt huset. `Byggnad.takmodell(b)` ger `{ takfot, nock,
  pos, index }` i zonen: tomma celler fylls med grannarnas punkter inom
  fotavtrycket (stängningen i `ytmodell` lyfter annars tomma celler nära
  nocken), avvikelser > 1,5 m från medianen 3 × 3 byts (skorstenar),
  riktningsfilter i två varv (fem celler längs den av fyra riktningar som
  varierar minst), takfot = 30:e percentilen av kantcellerna, nock = största
  värdet. Hörn utanför fotavtrycket flyttas till kanten på takfotens höjd.
  `app.js` (`takmodeller3d`) ger dem samma id som `somVolymer`; vyn bygger en
  grupp per hus (väggar till takfoten + tak med `takMat`, flatShading) och
  `takformer(på)` byter mot lådan. localStorage `terrang-3d-takformer`. Provat på
  testhusets sadeltak (nock 9,85 av 10 m) och ett syntetiskt valmat tak; inte
  på riktig laserdata. Finns inte efter att ett projekt öppnats utan laserdata.
- **Ögonhöjd**: `requestPointerLock` togs bort. Pekarlåset hanteras fortfarande
  om det ändå släpps, men vyn ber inte om det.
- **Realistiska träd** (`Trad3D.realistisk(art)`, `Trad3D.ritaLovbild`):
  `{ stam, lov }`; lövkort med uv i en bild 3 × 1 (gran, tall, löv) som ritas på
  en canvas när nivån väljs (`byggRealistiska`). `lovMat` är DoubleSide med
  `alphaTest` och `alphaToCoverage`, och `sammaNormal` vänder tillbaka normalen
  på baksidan (patch av `normal_fragment_begin`, three r170). Skuggor med
  `customDepthMaterial` med samma bild. `tradniva` tar 'realistisk'; nivåerna är
  listor av InstancedMesh. *Bild för AI* byter material per yta (`medMaterial`)
  i stället för `overrideMaterial`, så att lövkorten har hål i lera, djup och
  normaler. Högst 3 000 nära på datorn, 400 inom 200 m på mobilen.
- Testkrok: `TERRANG_TEST.byggnader` (husen med `tak`) bredvid `vy3d`.

## 3D-vyn i 0.9.0

Svaren som styrde (29 oktober): reglage för tid och datum, snabbval och
uppspelning; terrängen, husen och träden kastar skugga (trädskuggor kan stängas
av); en färg för alla befintliga hus och en egen för skissen; svarta konturer.

- **Skuggor**: `vy3d.skuggor(på)` och `vy3d.soltid(ms)`. Solen ur
  `Sol.solensLage(ms, lat, lon)`, azimuten minus meridiankonvergensen
  (`utsnittsMitt().konvergens`, som i `Analys.skuggor`). En DirectionalLight
  med ortografisk skuggkamera över utsnittet ± 0,75 × storleken, skuggkarta
  4096 (2048 på mobilen), PCF-mjuk. `shadowMap.autoUpdate = false`: skuggorna
  räknas om (`skuggaOm`) när solen, lagren, överdriften eller träden ändras.
  Terrängen och skissen är DoubleSide med `shadowSide = FrontSide`. Under
  horisonten: inget solljus. Datum, tid och uppspelning sköts i `app.js`
  (`soltid3d`, `uppdateraSol3d`, *Spela dagen* = upp till ned på 20 s).
  Riktningarna kontrollerade: lunch i mars ger skuggor mot norr, kväll i juni
  mot öster.
- **Konturer**: `EdgesGeometry` (20°, taken 30°) som barn till varje hus och
  skissvolym, av från början, valet i localStorage `terrang-3d-konturer`.
- **Färger**: `byggnadsfarg(hex)` och `skissfarg(hex)`; skissen har nu ett
  material för väggar och tak. localStorage `terrang-3d-husfarg` och
  `terrang-3d-skissfarg` (förval `#b9b3aa` och temats `annot`).
- **Träd** (`js/trad3d.js`): `Trad3D.art(t)` gissar gran (höjd/krona ≥ 2,4),
  tall (≥ 12 m och ≥ 1,6) eller löv; `modell(art, nivå)` ger trianglar 1 × 1 m
  med en normal per yta och färg per hörn; `variation(t)` vrider och ljusar efter
  läget. En `InstancedMesh` per art och nivå; `placeraTrad` delar upp efter
  avståndet till kameran (detaljerade: högst 6 000 närmast på datorn, 600 inom
  250 m på mobilen) och körs igen när kameran flyttat sig en bit.
  localStorage `terrang-3d-trad`.
- **Ögonhöjd**: `vy3d.ogonhojd()` växlar `lage` mellan `oversikt`, `valj` och
  `ogon`. Klick på marken (`traffMark`: går längs strålen i rutnätet och
  halverar), kameran 1,6 m över `markScen`, fov 60. Gå 4 m/s, springa 14 m/s,
  inom utsnittet. Pekarlås vid klick; när låset släpps (Esc) går den tillbaka.
  Spaken (`.vy3d-spak`) visas på pekskärmar. Esc i `app.js` går tillbaka i
  stället för att stänga när `lage() !== 'oversikt'`. Ingen krock med husen.
- **Bilder** (`vy3d.bilder({ skala, ai })`, `js/bild3d.js`): egen
  `WebGLRenderTarget` (MSAA 4, sRGB), `readRenderTargetPixels`, vänds och blir
  PNG. För AI: lera (alla ytor `leraMat`, linjerna dolda, vit bakgrund), djup och
  normaler med ShaderMaterial som `overrideMaterial` (utan MSAA, himlen
  genomskinlig), djupet kodat i 24 bitar. `Bild3D.djupbild` skalar 1/avstånd
  mellan 1:a och 99:e percentilen; `Bild3D.kanter` sätter linje vid djuphopp
  > 4 % och vikning > 35°. Zip:en byggs i `app.js` med en `_las_mig.txt`.
  Inte provat i Visoid.
- **Mobilen**: knappen *Val* (bara under 700 px) fäller ut lager, färger,
  bilder och knapparna i solraden; datum och tid syns ändå när skuggorna är på.
- Testas i `test/vy3d.test.js` och i 3D-delen av `ui_test.py`. Swiftshader i
  testmiljön ger låg bildfrekvens, så gånghastigheten i testet blir lägre än
  på riktigt (dt tak 0,25 s).

## IFC (`js/ifc.js`)

- En IfcBuildingElementProxy per byggnad med höjd, direkt i IfcSite (ingen
  IfcBuilding). IfcExtrudedAreaSolid från markhöjden (`b.mark − dz`) med
  djupet `b.hojd`; gårdar blir IfcArbitraryProfileDefWithVoids. Yttre ring
  moturs, hål medurs. Ett gemensamt grått IfcSurfaceStyle.
- Egenskaper i `Hojdkurvor_Byggnad`: objektidentitet, typ, ändamål, husnummer,
  namn, huvudbyggnad, markhöjd (RH 2000), höjd, tak, källa.
- GlobalId räknas ur `projektId` + lokal/sweref + objektidentitet (cyrb128),
  så att en ny export ger samma id. IfcSite.RefElevation = Z0 i den lokala filen.
- Ingen IfcMapConversion än; den lokala filen följer `Terrang.tillLokal` som
  DXF-filerna. Hus utan höjd hoppas över (räknas i info-filen).
- Kontrollerat med IfcOpenShell 0.8 (`validate` med EXPRESS-regler: 0 fel,
  geometrin skapas). Inte provat i Archicad.

## 3D-vyn, grunden (0.7.0–0.8.1)

`Vy3D.visa` får kurvor, fastighetsgränsernas linjer, vägarnas linjer och
fotavtryck för byggnader utan höjd. Linjerna draperas på marken med bilinjär
höjd ur rutnätet (punkter minst var 0,5 m). `vy3d.lager()` och
`vy3d.visaLager(namn, på)` styr lagren; knapparna byggs i `ritaLager3d` i
`app.js` och dolda lager sparas i sessionStorage (`terrang-3d-dolda`).
Sedan 0.8.0: `panorera(dx, dy)` flyttar målpunkten längs marken (högerdra,
mittenknapp, skift/ctrl-dra, två fingrar), hålls inom utsnittet ± en bredd och
följer markhöjden; dubbelklick och `aterstall()` går tillbaka. `kurvfarg(hex)`
byter kurvfärg; valet sparas i localStorage (`terrang-3d-kurvfarg`), förval svart.

## Koordinatdialogen

`Terrang.tolkaZon(x, y, hittaKommun)` prövar utsnittets mitt i alla 13
system. Ett system "passar" om punkten hamnar i en kommun som normalt använder
det (`data/kommuner.json`). Alla lokala zoner har samma falska östvärde, så
fel zon flyttar platsen 0,75–1,5 grader i öst–väst, och det händer att den då
hamnar i en annan kommun som också passar (Vimmerbys koordinater i 15 00
passar t.ex. en kommun längre västerut). Dialogen väljer i första hand den
kommun som redan är vald, sedan den zon som redan är vald, och säger alltid
vilka andra system som passar. Text med EPSG eller SWEREF-namn går före.

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

1. Kontrollera att publiceringen av 0.9.1 gick igenom (steget Kontrollera
   webbplatsen).
2. Be Carl August om test av 0.9.1 (listan under Att testa i
   `docs/SYNPUNKTER.md`): takformerna på riktiga hus, de realistiska trädens
   tyngd på dator och iPhone, och iPhone med två fingrar. Fel blir 0.9.2.
3. Därefter 0.10.0, volymer i 3D-vyn, på en egen gren (se *Skissfunktionen och
   3D-vyn* ovan). Toppvyn kan byggas med en `OrthographicCamera` bredvid
   perspektivkameran; `traffMark` finns redan för klick på marken.

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
- Byggnader utan laserdata: höjd saknas (i 3D syns de som fotavtryck, i IFC
  saknas de); schablon per typ vore möjligt men osäkert.
- IfcMapConversion i IFC-filen, så att den lokala filen också bär sin placering
  i SWEREF.
- Byggnader i skuggstudien utan laserdata.

## Kvar sedan tidigare

- **cad-apa läser platspaketet** (`src/core/siteImport.ts`: terräng, träd,
  vägar, stompunkter, byggnader och fastighetsgränser), kontrollerat 27 oktober.
  Ändra inget i cad-apa härifrån. Fälten är beskrivna i `docs/UTBYTE-CAD-APA.md`.
- Platsanalysen: klimat (snölast, vind, växtzon) och buller står som KOMMER.
- Avvaktar enligt Carl August: schakt och fyll, solkarta, OBJ/GeoTIFF, IFC för
  terrängen och skissen, exempelprojekt.
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
kända luckor i testdatan. För att kontrollera IFC: `python3.12 -m pip install
--break-system-packages ifcopenshell pytest` och `IFC_UT=mapp node test/ifc.test.js`
(se `test/README.md`).
