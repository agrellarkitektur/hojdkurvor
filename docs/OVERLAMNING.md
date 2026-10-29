# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 29 oktober 2026, 0.8.2 publicerad, 0.9.0 och 0.10.0 planerade, skissfunktionen bestämd.

## Läget

- **0.8.1 är klar** 27 oktober (gren `v0.8.1`, sammanslagen med `main`). Det är
  en rättelse: Carl August testade 0.8.0 och fick ingen IFC, ingen panorering och
  ingen Kurvfärg. Orsaken var att servern hade kvar `vy3d.js` (och troligen
  `app.js`) från 0.7.0, medan `index.html` och `version.js` var nya. Han öppnade
  `js/vy3d.js` på webbplatsen och den saknade "0.8". Varför FTP-Deploy-Action
  hoppade över filerna är inte utrett (listan på servern kan ha varit fel).
- **Rättat i 0.8.1**: ny lista `.ftp-deploy-sync-state-2.json`, så att allt
  laddas upp en gång; steget Kontrollera webbplatsen i `publicera.yml`
  (`.github/scripts/kontrollera-webbplatsen.sh`) hämtar varje fil från
  webbplatsen, laddar upp avvikande med curl och misslyckas om de ändå inte
  stämmer; `?v=<version>` på alla skript och stilmallar
  (`node test/version.test.js --skriv`); `.htaccess` med no-cache och UTF-8
  (tas bort automatiskt om sidan svarar 500); varning överst på sidan när
  `app.js` eller `vy3d.js` har en annan version än `version.js`; knappen
  *Flytta* i 3D (`vy3d.dragLage`); statusraden säger till när ingen IFC skapas.
- **Synpunktsformuläret** fungerar: `synpunkter.php` svarar och provet kom
  fram till Gmail (Carl August, 27 oktober).
- **0.8.1 godkänd på Windows** (Carl August, 27 oktober): IFC importeras i
  Archicad och hamnar rätt i lokal nolla (SWEREF-filen inte provad), Flytta och
  skift-dra i 3D fungerar, Kurvfärg fungerar. iPhone inte testad än.
- **0.8.2 är klar** 27 oktober (gren `v0.8.2`, sammanslagen med `main`). Bara
  publiceringen: `actions/checkout@v7`, `setup-node@v7`, `upload-artifact@v7`
  och `FTP-Deploy-Action@v4.4.0`, alla med Node 24 (varningen om Node 20 i
  0.8.1). Steget Kontrollera koden installerar PHP om det saknas, eftersom
  `ubuntu-latest` blir Ubuntu 26 från hösten 2026. Appen är oförändrad utöver
  versionsnumret. iPhone (två fingrar i 3D) är fortfarande inte testad.
- **Planen** (stämd av 27 oktober, se `docs/SYNPUNKTER.md`):
  - 0.8.2: klar (se nedan).
  - 0.9.0: 3D-vyn som studieverktyg. Skuggor med dag och tid, konturer på
    byggnaderna, färg på befintliga byggnader, low-poly eller realistiska träd
    (low-poly som standard, för iPhone). Öppna frågor nedan.
  - 0.10.0: rita volymer i Höjdkurvor i steg 04 Skiss. Steget finns redan
    (volymer från cad-apa eller DXF räknas med i skuggor, horisont och skyfall
    och syns i 3D); det som saknas är att rita dem. Carl August vill helst
    kunna sänka takfotens linjer var för sig och få en egen takform, men
    platta volymer duger att börja med om det är krångligt.

## Skissfunktionen och 3D-vyn (bestämt 29 oktober)

Carl August valde Claudes förslag på alla punkter.

**Grundidé:** volymerna byggs av primitiver med exakta mått, men analyserna
(skuggor, horisont, skyfall, DXF, `branInVolymer`) får dem som i dag:
fotavtryck + golv + takfot + takform. Primitiven och gruppen sparas som extra
fält på volymen, så att gamla volymer från cad-apa och DXF fungerar som förut.

**0.9.0 – 3D-vyn** (utöver skuggor, konturer och färg ovan):
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

## Svar för 0.9.0 (29 oktober)

1. Skuggor: reglage för tid och datum, snabbval för vårdagjämning, midsommar
   och vintersolstånd, och uppspelning över dagen.
2. Terrängen, byggnaderna och träden kastar skugga (trädskuggor får stängas
   av på iPhone om det blir för tungt).
3. En valbar färg för alla befintliga byggnader, skissvolymerna i en egen färg.
4. Konturerna är svarta.

0.9.0 är klar att byggas.

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

## 3D-vyn

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

1. Se efter att steget Kontrollera webbplatsen fortsätter gå igenom och att
   varningen om Node 20 är borta (0.8.2 var första körningen med
   FTP-Deploy-Action 4.4.0).
2. Be Carl August testa två fingrar i 3D på iPhone när han hinner.
3. 0.9.0 på en egen gren; frågorna är besvarade (se Svar för 0.9.0).
   Skuggorna tar solens läge ur `js/sol.js`, så att 3D-vyn och skuggstudien i
   PDF:en räknar likadant. Träden är i dag klot och cylindrar
   (`InstancedMesh` i `vy3d.js`).

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
- En enkel skissmodellsbyggare i höjdkurvor (rita i 2D och extrudera), om
  cad-apa inte behöver skicka tillbaka modeller. Står under Senare i
  synpunktsfilen.
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
