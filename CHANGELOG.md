# Ändringar

Versionsnumret står i `js/version.js` och visas i felrapporten och i
platsanalysbladet. En kortare version av listan finns under Ändringar på `om.html`.

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
