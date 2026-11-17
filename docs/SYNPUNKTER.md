# Synpunkter

Synpunkter från egen användning, och det som ska testas. Varje punkt har ett
löpnummer (AA, AB … AÖ, BA, BB …) som följer med när den flyttas, så att den
går att hänvisa till. Nya punkter får nästa lediga nummer och läggs i
**Inkorgen** precis som de lämnas. När nästa version planeras sorteras de till
den version där de ska byggas. En punkt som är klar stryks och nämns i
CHANGELOG.md; numret används inte igen.

Senast använda nummer: **AY**.

## Inkorg

- **AX** Vid projektnamnet på blad 1: ett val *klicka i kartan för att hämta fastighetsnamn*.

## Att testa

Grupperat efter den version där testbehovet uppstod.

### 0.12.2

- **AY** Skuggstudien i platsanalysen: kryssa i Soldiagram och Skuggstudie med Byggnader, Skapa. Har skuggbladet i `_platsanalys.pdf` samma ram och ritningshuvud som de andra bladen? Syns husens fotavtryck (svart) och skissade volymer (orange) i rutorna, och går det att se vilka hus skuggorna kommer från? Samma konturer finns i `skuggor/_skuggstudie.pdf`.

### 0.12.1

- **AW** Leveransen: ligger `_platsanalys.pdf` i zip:ens rot, har solbladet samma ram och ritningshuvud som de andra bladen, och är DXF:erna för skuggor, lutning och skyfall borta?

### 0.12.0

- **AR** Lutning och skyfall: kryssa i Lutning och Skyfall, Skapa. Lägg in `_lutning.jpg` och `_skyfall.jpg` i Archicad med världsfilen (byt namn på `_lokal.jgw`) och se att de hamnar rätt mot `_lutning_lokal.dxf`. Öppna `_lutning.pdf` och `_skyfall.pdf`: är skalan och teckenförklaringen begripliga?
- **AS** Samlad DXF: öppna `_samlad_lokal.dxf` i Archicad. Kommer alla lager med, och blir filen för tung med kurvorna?
- **AT** Punkt och radie: välj Punkt och radie, klicka på kartan, byt radie. Dra i ramen (inte i handtagen) och se att området flyttas i steg om 10 m. På iPhone: går det att dra i ramen med fingret?
- **AU** Lasso: i 3D-vyn, välj Lasso, ringa in några träd, Dölj. Visa dolda tar tillbaka dem.
- **AV** Vägytor: är de streckade ytorna på kartan och de nya lagernamnen tydliga nog, och är utjämningen lagom på breda vägar?

### 0.11.0

- **AJ** Vägar: kryssa i Vägar, Utkast till vägytor och Ortofoto på en plats med riktiga gator. Ligger ytorna rätt mot ortofotot (lagren Vägar och Gång- och cykelvägar på kartan), och hur ofta säger info-filen att bredden är mätt i bilden? Öppna `_vagar_lokal.dxf` och `_gangvagar_lokal.dxf` i Archicad.
- **AK** Träd och hus: klicka på ett träd i 3D-vyn, byt art och höjd, dölj ett träd och ett hus, Visa dolda. Välj Skapa igen: är de dolda borta ur DXF:en och skuggstudien?
- **AL** Till cad-apa: ortofotot i full upplösning (blir cad-apa seg?). Träden har nu art och modell i paketet, men cad-apa ritar dem inte förrän cad-apa läser `tradmodeller` (planerat i cad-apa 0.12.1).

### 0.10.1

- **AI** Kryssa i Ortofoto, Skapa, skicka till cad-apa och se att ortofotot ligger på marken i cad-apas 3D-vy, på rätt ställe (jämför med vägar och hus).

### 0.10.0

- **AG** På Windows: de nya träden (Detaljerade) – ser de bättre ut, och blir vyn seg? Klicka på ett feltolkat hus och rätta taket (form, lutning, nock tvärs, nockhöjd); sparas valet till nästa gång? Modellera: Ny volym (rätblock, cylinder, prisma), flytta, vrida med ⟳ och skift, snäpp mot volym, hus och fastighetsgräns, avstånd efter snäpp, ovanpå, kedjan, volymer in i varandra, Toppvy, Ångra, Delete. Stäng vyn, välj Skapa igen och se att skuggstudien och DXF:en har med volymerna.
- **AH** På iPhone: de nya träden (fart), att knappen Modellera inte syns och att skissen ändå visas.

### 0.9.0–0.9.2

- **AD** På Windows: skuggor (datum, tid, snabbval, Spela dagen), Konturer, Husfärg och Skissfärg, Ögonhöjd (W A S D, skift, Esc), Spara bild och Bild för AI (prova bilderna i Visoid).
- **AE** På iPhone: knappen Val, skuggor och tidsreglaget, ögonhöjd med spaken, Takformer, att vyn inte blir för seg med skuggor och detaljerade träd (annars Trädskuggor av), Spara bild.

### 0.8.0–0.8.1

- **AA** iPhone: dra med två fingrar i 3D-vyn. Windows är godkänt.

## Önskemål

Grupperat efter den version där de är planerade.

### 0.10.x – modellera vidare

- **AB** Bästa hade varit om man kunde sänka linjer individuellt runt takfoten för att skapa sin egen takform. (Egna takfotslinjer.)
- **AF** Volymer ska kunna läggas i varandra för att skapa mer specifika geometrier. Union kom i 0.10.0; bortskärning (urtag) återstår.

### 0.13.0 – projektfil (`plan-projektfil.md` i claude.ai-projektet)

- **AM** Möjlighet att lägga in eget bildunderlag som överlagring. Hör till projektfilens etapp 4 (bilagor): bilden i `bilagor/`, inpassad med två eller tre passpunkter.
- **AO** Sätta ut en punkt och välja radie: klart i 0.12.0. Projektfilen ska spara `mitt` och `radie` (fälten finns i planen).

### Efter 0.13.0, version inte bestämd

- **AN** Generera skissvolymer efter eget inskannat underlag. Bygger på överlagringen (AM): rita fotavtryck ovanpå bilden (halvautomatiskt, med snäpp mot linjer i bilden) snarare än att tolka planen helt automatiskt.
- **AP** En html-fil i nedladdningsmappen som visar allt underlag som på webben, 2D och 3D, utan att kunna ändra utsnittet. Läser projektfilens `projekt.json` och filerna i zip:en. Kräver att visaren fungerar från en lokal fil (`file://`), där webbläsaren stoppar `fetch` – underlaget måste därför bäddas in eller läsas med en filväljare. Villkoren för Lantmäteriets data i en fil som sprids ska kontrolleras först.
- **AQ** Samlings-DXF med *inlänkade* filer (xref) och ortofotot som bild: 0.12.0 gör en samlad DXF med allt kopierat in. Länkar och bilder kräver DXF 2000 (handtag, OBJECTS, IMAGEDEF) och måste provas i Archicad först.

### Avvaktar

- **AC** Befintliga byggnader i fler format än IFC. IFC kom i 0.8.0; OBJ eller glTF vore nästa om något program behöver det.
