# Synpunkter

Carl Augusts synpunkter från egen användning. Nya punkter läggs i **Inkorgen**
precis som de lämnas, med datum, utan bearbetning. När nästa version planeras
sorteras de till rätt version nedan, och en punkt som är klar stryks eller
flyttas till CHANGELOG.md.

## Inkorg

(Tom. Punkterna från 1, 13 och 15 november är inarbetade i 0.12.0 eller sorterade nedan.)

## Att testa

- iPhone: dra med två fingrar i 3D-vyn (0.8.0/0.8.1). Windows godkänt 2026-10-27.
- 0.9.0 på Windows: skuggor (datum, tid, snabbval, Spela dagen), Konturer, Husfärg och Skissfärg, Ögonhöjd (W A S D, skift, Esc), Spara bild och Bild för AI (prova bilderna i Visoid).
- 0.9.0–0.9.2 på iPhone: knappen Val, skuggor och tidsreglaget, ögonhöjd med spaken, Takformer, att vyn inte blir för seg med skuggor och detaljerade träd (annars Trädskuggor av), Spara bild.
- 0.10.0 på Windows: de nya träden (Detaljerade) – ser de bättre ut, och blir vyn seg? Klicka på ett feltolkat hus och rätta taket (form, lutning, nock tvärs, nockhöjd); sparas valet till nästa gång? Modellera: Ny volym (rätblock, cylinder, prisma), flytta, vrida med ⟳ och skift, snäpp mot volym, hus och fastighetsgräns, avstånd efter snäpp, ovanpå, kedjan, volymer in i varandra, Toppvy, Ångra, Delete. Stäng vyn, välj Skapa igen och se att skuggstudien och DXF:en har med volymerna.
- 0.10.1: kryssa i Ortofoto, Skapa, skicka till cad-apa och se att ortofotot ligger på marken i cad-apas 3D-vy, på rätt ställe (jämför med vägar och hus).
- 0.10.0 på iPhone: de nya träden (fart), att knappen Modellera inte syns och att skissen ändå visas.
- 0.11.0 vägar: kryssa i Vägar, Utkast till vägytor och Ortofoto på en plats med riktiga gator. Ligger ytorna rätt mot ortofotot (lagren Vägar och Gång- och cykelvägar på kartan), och hur ofta säger info-filen att bredden är mätt i bilden? Öppna `_vagar_lokal.dxf` och `_gangvagar_lokal.dxf` i Archicad.
- 0.11.0 träd och hus: klicka på ett träd i 3D-vyn, byt art och höjd, dölj ett träd och ett hus, Visa dolda. Välj Skapa igen: är de dolda borta ur DXF:en och skuggstudien?
- 0.11.0 till cad-apa: ortofotot i full upplösning (blir cad-apa seg?). Träden har nu art och modell i paketet, men cad-apa ritar dem inte förrän cad-apa läser `tradmodeller` (planerat i cad-apa 0.12.1).
- 0.12.0 lutning och skyfall: kryssa i Lutning och Skyfall, Skapa. Lägg in `_lutning.jpg` och `_skyfall.jpg` i Archicad med världsfilen (byt namn på `_lokal.jgw`) och se att de hamnar rätt mot `_lutning_lokal.dxf`. Öppna `_lutning.pdf` och `_skyfall.pdf`: är skalan och teckenförklaringen begripliga?
- 0.12.0 samlad DXF: öppna `_samlad_lokal.dxf` i Archicad. Kommer alla lager med, och blir filen för tung med kurvorna?
- 0.12.0 punkt och radie: välj Punkt och radie, klicka på kartan, byt radie. Dra i ramen (inte i handtagen) och se att området flyttas i steg om 10 m. På iPhone: går det att dra i ramen med fingret?
- 0.12.0 lasso: i 3D-vyn, välj Lasso, ringa in några träd, Dölj. Visa dolda tar tillbaka dem.
- 0.12.0 vägytor: är de streckade ytorna på kartan och de nya lagernamnen tydliga nog, och är utjämningen lagom på breda vägar?

## 0.10.x – modellera vidare

- (2026-10-27) Bästa hade varit om man kunde sänka linjer individuellt runt takfoten för att skapa sin egen takform. (Egna takfotslinjer.)
- (2026-10-29) Volymer ska kunna läggas i varandra för att skapa mer specifika geometrier. Union kom i 0.10.0; bortskärning (urtag) återstår.

## 0.13.0 – projektfil (plan-projektfil.md i claude.ai-projektet)

- (2026-11-01) Möjlighet att lägga in eget bildunderlag som överlagring. Hör till projektfilens etapp 4 (bilagor): bilden i `bilagor/`, inpassad med två eller tre passpunkter.
- (2026-11-13) Sätta ut en punkt och välja radie: klart i 0.12.0. Projektfilen ska spara `mitt` och `radie` (fälten finns i planen).

## Efter projektfilen

- (2026-11-01) Generera skissvolymer efter eget inskannat underlag. Bygger på överlagringen: rita fotavtryck ovanpå bilden (halvautomatiskt, med snäpp mot linjer i bilden) snarare än att tolka planen helt automatiskt.
- (2026-11-13) En html-fil i nedladdningsmappen som visar allt underlag som på webben, 2D och 3D, utan att kunna ändra utsnittet. Läser projektfilens `projekt.json` och filerna i zip:en. Kräver att visaren fungerar från en lokal fil (`file://`), där webbläsaren stoppar `fetch` – underlaget måste därför bäddas in eller läsas med en filväljare. Villkoren för Lantmäteriets data i en fil som sprids ska kontrolleras först.
- (2026-11-13) Samlings-DXF med *inlänkade* filer (xref) och ortofotot som bild: 0.12.0 gör en samlad DXF med allt kopierat in. Länkar och bilder kräver DXF 2000 (handtag, OBJECTS, IMAGEDEF) och måste provas i Archicad först.

## Senare / avvaktar

- (2026-10-27) Befintliga byggnader i fler format än IFC ("nått annat format också?"). IFC kom i 0.8.0; OBJ eller glTF vore nästa om något program behöver det.
