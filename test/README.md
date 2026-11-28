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

```
node test/ortofoto.test.js
```

```
node test/koordinater.test.js
```

```
node test/utbyte.test.js
```

```
node test/ifc.test.js
```

```
node test/version.test.js
```

```
node test/kalla.test.js
```

`kalla.test.js` kontrollerar licensen: länken till källkoden (`js/kalla.js`) på
alla sidor, Stöd utvecklingen på Om-sidan, att `LICENSE` är AGPL-3.0 och att
alla egna källfiler har licenshuvudet.

```
node test/vy3d.test.js
```

```
node test/volym3d.test.js
```

```
node test/kropp.test.js
```

```
node test/kroppgeo.test.js
```

`kroppgeo.test.js` (0.16.5) prövar kropparna i den nya modellen (`js/kroppgeo.js`, förarbete till
Skissa i 3D): volym och area för alla basformer och takformer, sluten mesh med utåtvända normaler,
taket i punkter, riktningarna i det lokala systemet, mur och sockel mot marken, att dagens prisma ger
samma tak ur meshen som ur takfallens plan, projektfilen och utbytet med cad-apa.

```
node test/fasadsol.test.js
```

```
node test/situationsplan.test.js
```

```
node test/vagar.test.js
```

```
node test/objektval.test.js
```

```
node test/dxf.test.js
```

```
node test/horisont.test.js
```

```
node test/projekt.test.js
```

```
node test/sol.test.js
```

```
node test/geodata.test.js
```

```
node test/laser.test.js
```

```
node test/resultat.test.js
```

`resultat.test.js` (0.13.6) prövar omvandlingen av det sparade resultatet (`js/resultat.js`) till
något IndexedDB kan spara och tillbaka: typade arrayer, delade objekt, husens tak (inte
uppräkningsbart), Map, Set och fel följer med, funktioner tas bort och canvas blir Blob och
tillbaka (med en låtsad canvas). Själva lagringen prövas i `resultat_test.py`.

```
node test/hamtminne.test.js
```

`hamtminne.test.js` (0.14.3) prövar hämtminnet (`js/hamtminne.js`): samma anrop hämtas en
gång, Range och POST-kropp hålls isär, felsvar och `blob:` sparas inte, ett annat område tömmer
minnet och `fetch` återställs.

`sol.test.js` (0.13.3) prövar solens läge mot referensvärden (NREL:s SPA) för fyra orter,
dagjämningar och solstånd 2026, svensk tid kring sommartidens gränser, upp- och nedgång, och
skuggornas längd från en mur där svaret går att räkna för hand, också med vridet rutnät.

`geodata.test.js` (0.13.4) prövar frågan till Naturvårdsverket mot en låtsastjänst som svarar
som den riktiga gjorde 19 november 2026 (bara `outputFormat=GEOJSON`, rutan med nordvärdet
först, tjänstens fältnamn), och de nya försöken när en tjänst svarar 429, 502, 503 eller 504.
`laser.test.js` (0.13.4) prövar att laserdatan läses del för del utan tak (`Laser.lasRutvis`
mot ett låtsat COPC-bibliotek), och att ytmodellen, trädträffarna, horisontens modell och
sektionerna blir desamma del för del som i ett svep.

Versionstestet kontrollerar att `?v=` i HTML-sidorna, `FILVERSION` i `app.js`
och `Vy3D.version` är samma som i `version.js`. Med `--skriv` rättar det dem.
Gränssnittstestet sätter `window.TERRANG_TEST = {}`; appen lägger då 3D-vyn i
`TERRANG_TEST.vy3d`, så att testet kan läsa kamerans läge.

3D-testet prövar trädmodellerna (storlek, ytornas riktning, artgissningen och
varianterna) och
beräkningarna för bilderna: djupet, djupkartan, kantlinjerna och storleken.

Vägtestet (0.11.0) prövar bil- och gångvägar, bredden ur OSM:s taggar och
schablonen, mätningen av bredden och läget i ett låtsat ortofoto (grå väg på
grönt) och vägytorna: en korsning blir en yta och en rondell får ett hål.
DXF-testet (0.12.0) prövar den samlade DXF:en: lager en gång, alla objekt, utbredningen
och att höjdkurvornas egen skrivare går att slå ihop med de andra. Med `DXF_UT=mapp`
sparas filen, så att den kan läsas med ezdxf.
Projekttestet (0.13.0) prövar projektfilen (`docs/PROJEKTFIL.md`): ett nytt projekt,
läsning, migrering och en fil från en nyare version, att okända fält bevaras men borttagna
rättelser inte kommer tillbaka, att tider och historik inte räknas som innehåll, volymer
(läge, vridning, nockriktning, golv på marken) och trädval mellan SWEREF 99 12 00 och TM,
inmatning utanför utsnittet, och zip-filen: spara → öppna → spara ger samma `projekt.json`,
bilagorna följer med och ren JSON går också att öppna.
Horisonttestet (0.12.1) prövar att den grova höjdmodellen för horisonten hoppar över
rutor som inte går att läsa (nätverksfel, 404, 401) och bara ger upp när ingen ruta går
att läsa. Testservern svarar 404 *utan* CORS-huvuden för höjdrutor som saknas, som vi
tror att Lantmäteriet gör; gränssnittstestet kontrollerar att horisonten ändå kommer med.
Objektvalstestet (0.11.0) prövar att dölja och rätta träd och hus, att ett träd
känns igen på nytt inom 0,6 m och att dolda träd och hus skärs bort ur
ytmodellen.

Kropptestet (0.14.0) prövar byggnadskropparna (`js/kropp.js`): inmatningsraden (mått, `@dx;dy`,
längd och vinkel, ensam längd, `E;N`, decimalkomma), måtten till tomtgräns (tre mått mot två gränser,
två från långsidan och ett från kortsidan till samma hörn, också vridet), måtten mellan en tillbyggnad
och huset (ägarens exempel med 0,3 m), yttermåttens sidor, FG-texten (*FG lika bef*), status i
analyserna och BYA, takform och nock (prisma och rätblock byter typ, nocken tvärs), att entrén följer
med när kroppen ändras, kroppen ur ett befintligt hus och länkade kroppar.

```
python3 test/las_test.py test/ut ritning
```

```
python3 test/rattelser_test.py test/ut ritning
```

```
python3 test/skapalogg_test.py test/ut ritning
```

`rattelser_test.py` (0.16.3) prövar rättelserna efter granskningen 26 november: panelen är inert
och ramen saknar handtag under Skapa, och ett ändrat hörn låser inte upp Skapa (C1, C2); Tab når inte
sidan bakom en öppen planvy (D6); två klick på Visa i 3D ger en vy (C17); en skiss från cad-apa
stänger planvyn (C7, med `TERRANG_CADAPA` på samma ursprung); och efter omladdning och ett Skapa med
fel lösenord finns det förra underlaget kvar, också efter nästa omladdning (C8).

`skapalogg_test.py` (0.16.5) prövar klockan och loggen under Skapa: klockan tickar och visar steget
(DU), vägarna från en Overpass som aldrig svarar (`TERRANG_OVERPASS_TID`) blir en varning efter
tidsgränsen medan resten blir klart, *Kopiera status och logg* ger status, sammanfattning och logg utan
lösenordet (DW), och knappen säger *Uppdatera* andra gången (DV).

`las_test.py` (0.14.3) skapar underlag tre gånger för samma område: andra gången hämtas nästan
inget från testservern, knappen säger *igen* och sammanfattningen har raden Hämtat. Ramen går att
dra efter flera Skapa (AT). *Lås området* stänger av Rita, hörnen och zonen, tar bort handtagen
och krysset, ramen går inte att dra och låset finns kvar efter omladdning. Lassot i 3D-vyn
släcks när vyn rörs (AU).

`planvy_test.py` (0.14.0, gränssnitt) skapar underlaget med byggnader och fastighetsgränser för
testtomten och prövar planvyn: befintligt hus med kryss, en tillbyggnad med snäpp och `4x5,6`,
status och *FG lika bef*, måtten (yttermått, mellan kropparna, tre till tomtgräns), ändra ett
gränsmått, dra med snäpp mot husets hörn, dra i ett grepp, ångra, polygon ur inmatningsraden,
entrépilen, Rivs, listan under 04 Skiss, 3D-vyn utan den som rivs, *Plan* i 3D-vyn, att allt finns
kvar efter omladdning och att huset ersätts av kroppen när underlaget skapas igen. Skärmbilder
`planvy_1_<tema>.png`, `planvy_2_<tema>.png`, `planvy_3d_<tema>.png`.

```
python3 test/fasadsol_test.py test/ut ritning
```

`fasadsol_test.py` (0.15.0, gränssnitt) skapar underlaget, ritar två byggnader i plan (30 m hög
och 9 m hög norr om den), väljer bara *Sol på fasaderna* med perioden April och skapar igen:
sammanfattningen, att den låga byggnadens södervägg skuggas av den höga, PDF:en och CSV-filen i
zip-filen (sidorna som `fasadsol_sida-N.png`), 3D-vyns färger (summa och timtopp, skärmbilder
`fasadsol_3d_*_<tema>.png`), att färgerna försvinner när skissen ändras, fältet `fasadsol` i
platsen till cad-apa och att perioden finns kvar efter omladdning.

```
python3 test/situationsplan_test.py test/ut ritning
```

`situationsplan_test.py` (0.16.0, gränssnitt) skapar underlaget, ritar två nya kroppar i vinkel i
planvyn och prövar att de är en byggnad med ett yttre skal (sex hörn, ett mått per yttersida,
BYA med överlappet en gång), att kropparna syns var för sig när en markeras, att ett yttermått
ändrar kroppen, att ett mått döljs och kommer tillbaka och att ett dras ut, ramen och
ritningshuvudets fält, PDF:en i en ny flik (`situationsplan.pdf`) och DXF:en
(`situationsplan.dxf`) med lagren, 3D-vyn, och att fälten, formatet och måtten ligger kvar efter
omladdning. Skärmbilder `situationsplan_1_skal_<tema>.png`, `_2_markerad`, `_3_ram`, `_4_3d`.

Enhetstestet för situationsplanen (`node test/situationsplan.test.js`, 0.16.0) prövar enheterna
(skalet, och kropparna var för sig när en är markerad), måtten på skalet och vilka som går att
ändra, dolda och flyttade mått, etiketterna (FG per kropp när golven skiljer), skrafferingen,
ramen, DXF:ens lager och texter och PDF:en i A3 och A4. Union, skal och BYA prövas i
`test/kropp.test.js`. Från 0.16.1 också underlaget, gränserna ovanpå, *Mått* av, koordinatlistan,
ledaren och skrafferingen runt texterna; markeringen i plan med indrag och takanslutningen prövas i
`test/kropp.test.js`, egna träd i `test/objektval.test.js`, reservservern och klippt geometri i
`test/geodata.test.js` och fasadsolbladets översikt i `test/fasadsol.test.js`.

```
python3 test/planverktyg_test.py test/ut ritning
```

`planverktyg_test.py` (0.16.1, gränssnitt) skapar underlaget med byggnader, fastighetsgränser,
ortofoto och träd och prövar i planvyn: ortofotot och höjdkurvorna under ritningen, *Redovisas i
plan* (kryss och nock), knappen *Mått*, numrerade hörn med koordinatlista, en ledare, *Vrid mot*,
ett eget träd som läggs till och tas bort, *Fastighet* ur kartan, *Anslut taket*, situationsplanen
som PDF (`planverktyg.pdf`, med koordinatlistan, ledaren och höjdkurvorna) och att ledaren och valen
ligger kvar efter omladdning. Skärmbild `planverktyg_1_<tema>.png`.

```
python3 test/smartmeny_test.py test/ut ritning
```

`smartmeny_test.py` (0.16.6, gränssnitt) prövar att knapparna till cad-apa är dolda, och i planvyn:
måtten i rader (en tillbyggnad mot ett befintligt hus), smartmenyn på en byggnad, ett hörn och en sida,
*Flytta* (hörnet hamnar exakt på målet, och `@4;0`), *Rotera* (referens och mål som linjer), *Lås form*
och *Lås placering*, en text som dras ut ur byggnaden och vart ledaren pekar, ett hörnnummer som dras,
ett eget gränsmått, ett hus som döljs och visas med *Se dolda*, trädets krona ur smartmenyn,
situationsplanen som PDF (`smartmeny.pdf`) och att låsen och texterna ligger kvar efter omladdning.
Skärmbilder `smartmeny_1_<tema>.png` (med smartmenyn) och `smartmeny_2_<tema>.png`.

Enhetstestet för sol på fasaderna (`node test/fasadsol.test.js`, 0.15.0) prövar klar himmel mot
överslaget 2 april i Hudiksvall, väderstreck och himlens andel, fasadpunkterna (area, gavlar,
under marken, fogen mellan två byggnader), skuggning från en annan byggnad, från den egna
(inbuktad) och från ytmodellen, att det som står på byggnaden inte räknas, och kontrollen mot
underlaget från Hudiksvall.

Volymtestet (0.10.0) prövar volymerna att modellera: fotavtrycken för rätblock,
cylinder och prisma, att takets höjd är densamma som `Platsanalys.takhojd`, de
exakta takytorna, snäpp yta mot yta, mot en gräns och hörn mot kant, kontakter
(sida mot sida, ovanpå, in i varandra), länkar och grupper, underlaget och
konturerna när volymer möts eller går in i varandra.

Höjdpunkter, lutning, skyfall, volymer och tak, DXF-läsning och strandskydd
på syntetiska rutnät, och byggnader och fastighetsindelning ur låtsasfilerna.
Ortofototestet prövar urvalet på ett riktigt svar från Lantmäteriets
bildkatalog (Vimmerby) och läsningen och omritningen till zon 15 00 på
låtsasortofotona: kontrollinjerna ska hamna rätt, skarven mellan två rutor och
JPEG med YCbCr ska bli rätt.
Koordinattestet prövar hur dialogen Klistra in koordinater föreslår
koordinatsystem mot de riktiga kommungränserna. Utbytestestet bygger
platspaketet till cad-apa med kurvor och fastighetsgränser ur låtsasfilen.
IFC-testet bygger IFC-filen för befintliga byggnader (med en gård och ett
hus utan höjd) och kontrollerar referenser, GlobalId, koordinater, vridning och
ringarnas riktning, och rensningen av träd vid byggnader. Med `IFC_UT=mapp`
sparas filerna, så att de kan kontrolleras med IfcOpenShell
(`python3.12 -m pip install --break-system-packages ifcopenshell pytest`, sedan
`ifcopenshell.validate.validate(f, logger, express_rules=True)`). `ui_test.py`
kontrollerar också att IFC-filerna kommer med i zip:en, att 3D-vyn flyttas vid
högerdrag och att dubbelklick återställer den, och 3D-vyns konturer, färger,
konturfärg och gränsfärg, takformer, detaljerade träd, egen takform (klick på
huset, valmat 40°, pulpettak tvärs, Ur laserdatan), modelleringen (ny volym med
klick, snäpp och avstånd, ångra, kedjan, dra med musen i toppvyn så att gruppen
följer med, vrida med skift i steg om 15°, ovanpå, ändra bredd, Delete och
Ctrl+Z, att listan under 04 Skiss följer med och påminnelsen när vyn stängs), skuggor
med snabbval och uppspelning, Spara bild (2 × skärmen), Bild för AI (fyra
bilder i zip:en) och ögonhöjd (W går framåt, ett klick låser inte musen, Esc
går tillbaka utan att stänga vyn). Byggnadstestet prövar också takformen på ett
sadeltak med en skorsten (nock, takfot och att taket går ut till kanterna), och
egen takform: valm, sadeltak 45° med nocken ur laserdatan, nock tvärs, pulpettak
åt båda hållen, platt med egen nockhöjd och sadeltak på ett vinkelhus.
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

Kräver numpy, scipy, GDAL (osgeo) och copclib (`pip install copclib`). Saknas GDAL går
höjdrutorna och ortofotona att skriva med rasterio i stället (drivrutinen `COG`, samma
inställningar); det gjordes vid granskningen 19 november 2026. `make_dtm.py` skapar
höjdmodellens två rutor (`m642_53.tif`, `m642_54.tif`) och `make_landskap.py`
en COPC-fil med träd och ett hus (`y21c007-64275_5375_25.copc.laz`) och facit
(`facit.json`) på samma markyta.
`marktacke_kn0513.zip` (fem ytor), `byggnad_kn0513.zip` (huset i laserdatan,
ett garage och en lada) och `fastighetsindelning_kn0513.zip` (tre fastigheter,
gränser med olika lägesosäkerhet) ligger redan i `test/data/`. De två senare
skapas med `python3.12 test/data/make_vektor.py test/data` och har samma skikt
och fält som Lantmäteriets filer i 2025-versionen.

Låtsasortofotona (`o64275_*.tif`, COG med 0,5 m pixlar: två rutor från 2025
med fyra band och en från 2019 som JPEG) skapas av höjdmodellen med:

```
python3.12 test/data/make_orto.py test/data
```

De har röda och blå linjer var tionde meter i SWEREF 99 TM, så att läget går
att kontrollera, och två grå vägbanor längs testserverns OSM-vägar (Bygatan
7,5 m bred, 1 m norr om OSM-linjen, och Skolvägen 5 m), så att mätningen av
vägarnas bredd prövas.

Topografisk webbkarta (`topowebb-3006.gpkg`) finns inte med. Utan den svarar
testservern 404 när testet väljer Lantmäteriets karta, och utskriften görs utan
bakgrund. Resten av testet påverkas inte.

## Testserver

```
python3 test/server.py test/data .
```

Lyssnar på `http://127.0.0.1:8765` och serverar appen därifrån. Kräver pyproj.
Den låtsas vara:

- Lantmäteriets nedladdning (Basic auth, Range, HEAD, CORS), STAC-katalogerna
  för laserdata (`/stac-hojd/`) och ortofoto (`/stac-bild/`) och Stompunkt Direkt
- Overpass (vägar, och sjön Lillsjön när frågan gäller vatten). Varannan fråga av varje slag
  får 502, så att appens nya försök prövas
- Naturvårdsverkets WFS (`/nv/wfs`, ett naturreservat) och Natura 2000 (`/n2k/wfs`, ett område
  400 m söder om testtomten). Som de riktiga tjänsterna: annat än `outputFormat=GEOJSON` ger ett
  XML-fel, och en ruta med östvärdet först ger ett tomt svar
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

```
python3 test/projekt_test.py test/ut ritning
```

`projekt_test.py` (0.13.0) prövar projektet i webbläsaren: autospar, att allt finns kvar
efter omladdning, Spara projektfil, Nytt projekt, Senaste projekt, Öppna projektfil och
dra-och-släpp, frågan när filen och webbläsaren är oense (kopia, filens version,
webbläsarens), en fil från en nyare version, inmatning utanför utsnittet, Ta bort under
Sparat i webbläsaren, en annan flik som ändrar samma projekt och flytten från sessionStorage.
Andra argumentet är temat.

```
python3 test/fastighetsnamn_test.py test/ut ritning
```

`fastighetsnamn_test.py` (0.13.1) prövar *Hämta från kartan* vid Projekt eller
fastighet: besked utan inloggning, hämtning ur låtsasfilen för Kinda, och läsning
ur webbläsarens lagring utan inloggning. Kartan nås genom testkroken
`TERRANG_TEST.karta`.

```
python3 test/resultat_test.py test/ut ritning
```

`resultat_test.py` (0.13.6) skapar underlag med alla tillval, går till Om-sidan (öppnar Stöd
utvecklingen och tar skärmbilder av rutan och avsnittet) och tillbaka: lagren, sammanfattningen,
ortofotots canvas, husens tak och 3D-vyn ska komma tillbaka utan nytt Skapa, och zip-filen ska
ha samma filer. Efter omladdning likaså. Ett ändrat område tar bort det sparade.

`ui_test.py` går igenom hela flödet på en dator: BETA-knappen och formuläret
Skicka synpunkter (anropet till `synpunkter.php` fångas upp i testet), rita och
ändra utsnittet, dialogen Klistra in koordinater, alla fyra stegen, DXF-skiss, inloggning, Skapa med alla tillval och
platsanalysen, zip-filens innehåll, utskrift i skala, 3D-vyn med lagerknapparna, projektlänken och
utbytet med en låtsas-cad-apa (`test/cad-apa-mock.html`). Andra argumentet är
temat: `ritning`, `lugn` eller `mork`. Skärmbilder och zip-filens innehåll
hamnar i utkatalogen. Ett helt varv tar några minuter.

`mobil_test.py` testar mobilflödet (390 × 844, pekskärm) i alla tre teman.

Testerna pekar om appens adresser med globala variabler som sätts före sidan
laddas (`TERRANG_DL_ROT`, `TERRANG_STAC_BAS`, `TERRANG_API_BAS`,
`TERRANG_OVERPASS`, `TERRANG_GEODATA`, `TERRANG_CADAPA`, `TERRANG_SYNPUNKTER`) och använder
`window.__punkt` för att räkna om koordinater till skärmpunkter. De påverkar
inte appen när de inte är satta.

WebKit (Safari) finns inte i testmiljön. Testa på riktig iPhone efter större
ändringar i gränssnittet.
