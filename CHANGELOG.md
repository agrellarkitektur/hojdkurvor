# Ändringar

Versionsnumret står i `js/version.js` och visas i felrapporten och i
platsanalysbladet. En kortare version av listan finns under Ändringar på `om.html`.

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
