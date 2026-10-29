# Ändringar

Versionsnumret står i `js/version.js` och visas i felrapporten och i
platsanalysbladet. En kortare version av listan finns under Ändringar på `om.html`.

## 0.10.0 – 2026-10-29

Volymer i 3D-vyn, egen takform på befintliga hus och nya träd.

- **Modellera**: knappen *Modellera* i 3D-vyn (bara på dator) ritar volymer på
  platsen. *Ny volym* skapar ett rätblock (B × D × H), en cylinder (Ø × H)
  eller ett prisma med sadel-, pulpet- eller valmat tak (nocken längs bredden),
  med mått i meter, och den placeras med ett klick. En volym väljs med ett
  klick och flyttas genom att dra; handtaget ⟳ vrider den (skift: steg om 15°).
  Måtten, höjden, taket, vridningen och golvet ändras i panelen. Volymer
  snäpper yta mot yta (hörnen i linje när de är nära), hörn mot hörn och hörn
  mot kant, mot andra volymer, befintliga hus och fastighetsgränser; Alt stänger
  av snäppet. Efter ett snäpp mot en yta kan avståndet skrivas in. En volym vars
  mitt står på en annan får golvet på den undres takfot, annars marken mitt
  under (kan ändras till ett eget golv). Där två volymer möts visas en kedja:
  ett klick sätter ihop dem så att de flyttas och vrids tillsammans, ett klick
  till löser upp. Volymer som går in i varandra visas som en: konturerna inuti
  och mitt på plana ytor tas bort och linjerna där de möts läggs till
  (analyserna räknade redan överlapp som en union). Ångra och Gör om (Ctrl+Z,
  Ctrl+Y), Kopiera och Ta bort (Delete). Volymer från cad-apa och DXF kan också
  flyttas och vridas. Skissen går tillbaka till steg 04 och följer med nästa
  gång man väljer Skapa; när 3D-vyn stängs påminner appen om det. Ny modul
  `js/volym3d.js` (`Volym3D`): primitiver, exakta takytor (samma höjder som
  `Platsanalys.takhojd`), snäpp, kontakter, länkar och konturerna. Volymerna
  får fältet `primitiv`; fotavtryck, golv, takfot och takform är som förut, så
  analyserna, DXF och cad-apa läser dem som vanligt.
- **Toppvy**: ortografisk vy rakt uppifrån med norr uppåt, för att lägga ut
  volymerna exakt. Dra flyttar, scrolla zoomar.
- **Egen takform**: klicka på ett befintligt hus i 3D-vyn för att rätta ett
  feltolkat tak: takform (sadeltak, valmat, pulpettak, platt), lutning, nock
  längs eller tvärs huset, pulpettakets höga sida och nockhöjd. Det som lämnas
  tomt tas ur laserdatan. Valet sparas per hus i webbläsaren
  (`terrang-takval`, nyckel objektidentiteten). `Byggnad.takmodell(b, eget)`.
- **Träd**: de detaljerade träden är ritade om i stiliserad low-poly: lätt
  böjda stammar som smalnar av, kronor av många facetterade klumpar i dämpade
  gröna toner och sju varianter (två granar, två tallar, två lövträd och björk)
  som väljs ur trädets läge. De realistiska träden med lövkort är borttagna;
  ett sparat val Realistiska blir Detaljerade.
- **Rättelse**: 3D-vyns bild följer nu ytans storlek också när raderna med
  knappar bryts om (canvasen kunde bli högre än ytan, så att klick och bilder
  hamnade fel).
- **Rättelse**: tyngdpunkt och yta räknas relativt första hörnet
  (`Platsanalys.tyngdpunkt`, `Platsanalys.area`, `Byggnad.tyngdpunkt`). Med
  zonens stora koordinater blev tyngdpunkten för små fotavtryck fel på upp till
  flera meter, vilket bland annat påverkade golvet för en DXF-volym utan
  golvnivå och var texterna hamnade.

## 0.9.2 – 2026-10-29

- **Takformer förenklade**: taken följde laserpunkterna och blev bulliga. Nu får
  varje hus en enkel form, sadeltak (nocken längs husets långa axel), valmat
  eller platt tak, lagd över den minsta rektangeln kring huset. Formen,
  takvinkeln (5–60°) och nockhöjden passas till laserdatan; sadeltak går före
  valm och platt före lutande när skillnaden är liten. Med för lite laserdata
  blir det sadeltak i 35°. Takfoten följer av nocken, vinkeln och bredden (minst
  2 m över marken). Gavlarna är lodräta. Vinkelhus och andra inbuktade hus får
  valmat tak som följer fotavtrycket. `Byggnad.takmodell` ger nu också `form` och
  `lutning`.

## 0.9.1 – 2026-10-29

Rättelser och tillägg efter Carl Augusts första prov av 3D-vyn.

- **Konturfärg och Gränsfärg**: färgväljare för husens konturer (och
  fotavtrycken för hus utan höjd) och för fastighetsgränserna, som Kurvfärg.
  Valen sparas i webbläsaren (`terrang-3d-konturfarg`, `terrang-3d-gransfarg`).
- **Takformer**: valfri högre detaljnivå för befintliga hus. Väggarna går till
  takfoten och taket byggs ur ytmodellen inom fotavtrycket, så att sadeltak,
  valm och flera huskroppar syns ungefärligt. `Byggnad.hojder` sparar takets
  höjder per hus (inte uppräkningsbart, följer inte med i platspaketet) och
  `Byggnad.takmodell` gör taket: helst cellens egna laserpunkter, avvikande
  värden byts mot grannarnas median (skorstenar) och ytan jämnas ut längs den
  riktning där den varierar minst, så att nock och takfot står kvar. Taket
  skuggas per yta. Bara i 3D-vyn; DXF, IFC och analyserna är som förut.
- **Ögonhöjd**: ett klick låser inte längre musen. Pekaren syns hela tiden och
  man tittar runt genom att dra. Esc eller *Tillbaka* går upp igen som förut.
- **Realistiska träd**: valet *Träd* har nu Enkla, Detaljerade och
  Realistiska. De realistiska har stam och grenar som geometri och lövverk av
  små kort med en genomskinlig bild av blad eller barr (ritas i webbläsaren, ingen
  bildfil), så att man ser igenom kronan och skuggan blir prickig. Kronan
  ljussätts som en helhet. Högst 3 000 närmast kameran på datorn, 400 inom 200 m
  på mobilen, enkla längre bort. Lermodellen och djupkartan i *Bild för AI* tar
  med hålen i lövverket.

## 0.9.0 – 2026-10-29

3D-vyn som studieverktyg.

- **Skuggor**: knappen *Skuggor* tänder solen efter datum och tid, med reglage,
  snabbval för vårdagjämning, midsommar och vintersolstånd och *Spela dagen*
  (från soluppgång till solnedgång på 20 sekunder). Solens läge räknas med
  `Sol.solensLage` som soldiagrammet och skuggstudien, och azimuten vrids med
  meridiankonvergensen som i `Analys.skuggor`. Terrängen, byggnaderna, skissen
  och träden kastar skugga; *Trädskuggor* stänger av trädens om det blir tungt.
  Skuggkartan räknas bara om när solen, lagren eller träden ändras.
- **Konturer**: svarta kanter på befintliga byggnader och skissen.
- **Färger**: *Husfärg* för alla befintliga byggnader och *Skissfärg* för
  skissens volymer (väggar och tak). Valen sparas i webbläsaren.
- **Träd**: gran, tall och lövträd i stället för klot och cylinder, skalade
  efter laserns höjd och kronbredd och lite vridna och olika ljusa. Arten
  gissas ur formen (höjd mot kronbredd). *Detaljerade träd* visar mer
  detaljerade modeller närmast kameran (högst 6 000 på datorn, 600 inom 250 m på
  mobilen) och enkla längre bort. Low-poly är förval. Ny `js/trad3d.js`.
- **Ögonhöjd**: klicka på marken och stå där 1,6 m över marken. På datorn går
  man med W A S D eller pilarna (skift springer), drar eller klickar för att
  titta med musen (pekarlås). På mobilen går man med en spak och drar för att
  titta. Esc eller *Tillbaka* går upp igen, utan att stänga vyn.
- **Spara bild**: PNG i 2, 3 eller 4 gånger skärmens storlek, utan knappar.
  **Bild för AI**: en zip med samma vy som färgbild, vit lermodell, kantlinjer
  och djupkarta (nära ljust), för till exempel Visoid. Bilderna ritas i en egen
  buffert, högst 8 192 px per sida och 40 Mpx (16 Mpx på mobilen). Ny
  `js/bild3d.js`.
- På smala skärmar ligger valen i 3D-vyn bakom knappen *Val*; datum och tid
  syns när skuggorna är på.
- Nytt test `test/vy3d.test.js`; `ui_test.py` provar alla de nya funktionerna.

## 0.8.2 – 2026-10-27

- Publiceringen: `actions/checkout@v7`, `actions/setup-node@v7`,
  `actions/upload-artifact@v7` och `SamKirkland/FTP-Deploy-Action@v4.4.0`, som
  alla körs med Node 24. GitHub varnade för att Node 20 tas bort.
- Kontrollen av PHP-filerna installerar PHP om det saknas, inför att
  `ubuntu-latest` blir Ubuntu 26.
- Inga ändringar i appen utöver versionsnumret.

## 0.8.1 – 2026-10-27

- Rättelse: 0.8.0 kom inte upp helt på webbhotellet. `index.html` och
  `version.js` var nya, men `app.js` och `vy3d.js` var kvar från 0.7.0, så IFC,
  panorering och *Kurvfärg* saknades. Uppladdningen gör nu om allt en gång
  (ny lista `.ftp-deploy-sync-state-2.json`), och efter varje uppladdning
  hämtar `publicera.yml` alla filer från webbplatsen och jämför dem med repot.
  Filer som saknas eller är gamla laddas upp igen, och körningen misslyckas om
  de ändå inte stämmer (`.github/scripts/kontrollera-webbplatsen.sh`).
- Skript och stilmallar laddas med `?v=<version>`, även de som laddas senare
  (`vy3d.js`, jsPDF m.fl.), så att webbläsaren hämtar nya filer vid en ny
  version. `node test/version.test.js --skriv` skriver in versionen; testet
  stoppar publiceringen om något inte stämmer.
- Ny `.htaccess`: sidor, skript och stilmallar skickas med
  `Cache-Control: no-cache` och som UTF-8.
- Varning överst på sidan, med knappen *Ladda om*, när `app.js` eller
  `vy3d.js` inte har samma version som `version.js`.
- 3D-vyn: knappen *Flytta* gör vanlig dragning (ett finger eller vänster
  musknapp) till flyttning. Högerdra och skift-dra gör det motsatta.
- Statusraden säger till när ingen IFC-fil skapades, och varför.

## 0.8.0 – 2026-10-27

- Befintliga byggnader som 3D-modell i IFC (IFC4): `byggnader/…_byggnader_lokal.ifc`
  och `…_byggnader_sweref.ifc`. Varje byggnad med höjd ur laserdatan blir en
  volym från markhöjden till takhöjden, med platt tak och gårdar som hål, som
  ett eget objekt (IfcBuildingElementProxy) i IfcSite. Husnummer, ändamål,
  objekttyp, markhöjd och höjd står i egenskaperna `Hojdkurvor_Byggnad`. Den
  lokala filen har samma nollpunkt, vridning och Z0 som de lokala DXF-filerna.
  Samma hus får samma GlobalId vid en ny export. Ny modul `js/ifc.js`, test
  `test/ifc.test.js` (kontrollerad med IfcOpenShell utan valideringsfel).
- 3D-vyn: högerdra, skift-dra eller dra med två fingrar för att flytta vyn,
  inte bara snurra runt mitten. Dubbelklick eller *Återställ vy* går tillbaka
  till början. Man kan också zooma närmare än förut.
- 3D-vyn: höjdkurvorna är svarta, och färgen kan väljas med *Kurvfärg*. Valet
  sparas i webbläsaren.
- Träd vars topp ligger på ett byggnadsfotavtryck eller högst 1 m utanför tas
  bort, eftersom det oftast är takkanten som laserdatan har tagit för ett träd.
  Gäller när befintliga byggnader är ikryssade. Antalet står i info-filen.
  `Byggnad.tradVidByggnader`.
- När platsen skickas till cad-apa utan fastighetsgränser eller byggnader säger
  statusraden att de inte kom med och att de behöver kryssas i.

## 0.7.0 – 2026-10-26

- BETA-rutan i menyraden är en knapp, *Beta 0.7.0 – Skicka synpunkter*, på
  alla sidor. Den öppnar ett formulär som skickar synpunkten med e-post via
  `synpunkter.php`, anonymt om man inte fyller i sin adress. Samma upplägg som
  i cad-apa: mottagaren står i `feedback-config.php` på servern (samma fil som
  cad-apa använder), kuvertavsändaren sätts till avsändaradressen så att
  vidarebefordran till Gmail inte stoppas av SPF/DMARC, och skydd mot spam med
  dolt fält, tidsspärr och högst fem i timmen. Går skriptet inte att nå öppnas
  ett mejl i stället. *Skicka synpunkter* finns också bredvid *Rapportera ett fel*.
- *Klistra in koordinater* öppnar en dialog: klistra in hörnen, välj kommun och
  koordinatsystem. Dialogen föreslår det system där området hamnar i en kommun
  som normalt använder det, säger vilken kommun det blir i det valda systemet
  och om koordinaterna passar fler system. Även inklistring direkt i
  hörnfälten går via dialogen.
- 3D-vyn visar också höjdkurvor, fastighetsgränser och vägar (draperade på
  marken) och byggnader utan laserhöjd som fotavtryck. Varje lager har en
  knapp; valen gäller så länge fliken är öppen.
- Fastighetsgränserna följer med i platspaketet till cad-apa (nytt fält
  `fastigheter`: gränser, gränspunkter och fastighetsområden, version 1 gäller
  fortfarande), se `docs/UTBYTE-CAD-APA.md`.
- Rättat: höjdkurvornas höjd kom med som `null` i platspaketet till cad-apa
  sedan 0.5.0 (kurvorna har höjden i `h`, paketet läste `z`).
- Länk till cad-apa på Om-sidan. Systerprojekten cad-apa och Sisyfos som
  referens i `CLAUDE.md`.
- Nya enhetstest: `test/koordinater.test.js` och `test/utbyte.test.js`.

## 0.6.0 – 2026-10-23

- Ortofoto ur Ortofoto Nedladdning: färgbild över utsnittet från den senaste
  flygningen, som JPEG med världsfiler (lokal och SWEREF). Bara utsnittet läses
  ur Lantmäteriets molnoptimerade GeoTIFF-filer, från lämplig översiktsnivå, och
  bilden ritas om till vald SWEREF 99-zon. Källans upplösning (0,16 m) för
  utsnitt upp till cirka 16 Mpx, annars 0,25, 0,5 m och så vidare. Syns på
  kartan (under de andra lagren), i utskriften i skala inom utsnittet och som
  textur på terrängen i 3D-vyn, med en knapp för att slå av och på det.
- Befintliga byggnader ur Byggnad Nedladdning, vektor: fotavtryck med typ,
  ändamål och husnummer som DXF (ett lager per typ) och CSV, med höjd över mark
  ur laserdatan. Byggnaderna syns på kartan, i utskriften i skala, i
  platsanalysbladets kartor och i 3D-vyn, räknas som hinder i skyfallet och
  följer med i platspaketet till cad-apa (nytt fält `byggnader`).
- Fastighetsgränser ur Fastighetsindelning Nedladdning, vektor: gränser,
  gränspunkter och beteckningar som DXF, med osäkra gränser på eget lager.
  Syns på kartan, i utskriften och i platsanalysbladet, som också listar vilka
  fastigheter utsnittet berör. Tydlig text om att gränserna inte är rättsligt
  bindande.
- Latitud och longitud i decimalgrader för utsnittets mitt i panelen (med
  kopieringsknapp) och i info-filen, för att ange platsen i Archicad och Revit.
- Förhandsvisa i 3D är en riktig knapp. Bara knappen för nästa steg är fylld;
  Ladda ner och Fortsätt rita i cad-apa är lika höga.
- Marktäcke, byggnader och fastighetsindelning hämtas på samma sätt
  (`js/kommunfil.js`) och sparas i webbläsaren per kommun och produkt.
- Appen publiceras på webbhotellet med FTP vid varje push till `main`.

## 0.5.0 – 2026-10-18

Första versionen i det publika repot. Versionerna numreras från och med nu 0.x
så länge tjänsten är i beta (0.5.0 hette en kort stund 5.0, och 4.x heter nu 0.4.x).
Sista siffran höjs för rättelser, den mittersta för nya funktioner.

- Panelen i fyra steg: 01 Plats, 02 Underlag, 03 Analys och 04 Skiss, med
  sammanfattning av valen nederst. Ritprogrammet (Archicad, Revit, AutoCAD,
  annat) ställer in formaten.
- Platsanalysblad: ett A3-häfte i PDF med sammanställning, soldiagram,
  skuggstudie, terräng och vatten, skydd och risker samt källor. Kapitlen väljs
  var för sig. Klimat och buller är markerade KOMMER.
- Lutning i fyra klasser (1:50, 1:20, 1:12) som kartlager, PDF och DXF.
- Skyfall: lågpunkter med yta, djup och volym, och flödesvägar, som kartlager,
  PDF och DXF.
- Skydd och risker: lämningar (Riksantikvarieämbetet), skyddad natur
  (Naturvårdsverket), översvämningskarteringar (MCF) och avstånd till vatten som
  indikation på strandskydd. Reservväg via `geodata.php`.
- Höjdpunkter med höjdtext i rutnät 5, 10 eller 20 m (DXF).
- Skiss: volymer med golv, takfot och takform (platt, pulpet, sadel, valm) från
  cad-apa eller DXF. Räknas med i skuggstudien, horisonten och skyfallet.
- Utbyte med cad-apa: Fortsätt rita i cad-apa och ta emot skissen tillbaka
  (`docs/UTBYTE-CAD-APA.md`), samt platsfil som reserv.
- 3D-förhandsvisning av terräng, träd och volymer (three.js).
- Projektlänk med område och val, utan inloggning.
- Mobilflöde: markera med ram, skicka länken till datorn, kopiera eller beställ.
- Felrapport som förifyllt mejl med version, webbläsare och senaste fel.
- Skuggstudien fungerar utan laserdata (bara terrängen och skissen skuggar).
- Källkoden publicerad under GPL-3.0 eller senare.

## 0.4.2

- Temamenyn fungerar på iPhone (Safari och Chrome).

## 0.4.1

- Temameny i menyraden: Blueprint, Ljust och Mörkt.
- Bladet Beställ, med kopiera och klistra in av områdets hörn.
- Ritningshuvud och klickbar kontakt på informationssidorna.

## 0.4.0

- Analyser ur Laserdata skog: träd, höjd över mark, skuggstudie, terrängsektioner
  och horisont i soldiagrammet.
- Utskrift i skala A4–A1 med Lantmäteriets Topografiska webbkarta.
- Marktäcke, stompunkter och vägar från OpenStreetMap.
