# Ändringar

Versionsnumret står i `js/version.js` och visas i felrapporten och i
platsanalysbladet. En kortare version av listan finns under Ändringar på `om.html`.

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
