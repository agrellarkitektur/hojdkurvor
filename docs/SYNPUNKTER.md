# Synpunkter

Synpunkter från egen användning, och det som ska testas. Varje punkt har ett
löpnummer (AA, AB … AÖ, BA, BB …) som följer med när den flyttas, så att den
går att hänvisa till. Nya punkter får nästa lediga nummer och läggs i
**Inkorgen** precis som de lämnas. När nästa version planeras sorteras de till
den version där de ska byggas. En punkt som är klar stryks och nämns i
CHANGELOG.md; numret används inte igen.

Senast använda nummer: **BL**.

## Inkorg

- **BJ** Platsdatan försvinner när man går till Instruktioner, Om eller Beställ och tillbaka; man måste skapa om. Den ska inte kännas ömtålig. *Planerat till 0.13.6: spara resultatet i webbläsaren (IndexedDB) och läsa in det när kartan öppnas.*
- **BK** Räkna om skissen utan att hämta allt igen: skuggor, sol, volymer och platsanalysbladet med data som redan är hämtad. *Före eller efter 0.14.0.*
- **BL** Stöd-knappen blir ett hjärta när gränssnittet går över till ikoner.

## Att testa

Grupperat efter den version där testbehovet uppstod.

### 0.13.5

Synpunkter från egen användning 19 november (BG–BL): strandskyddet, zip-filen, STÖD och att
underlaget försvinner vid byte av sida. BJ och BK väntar till 0.13.6 respektive senare.

- **BG** Strandskydd på en riktig plats nära en sjö: kommer strandskyddet med, utan *signal is aborted without reason*? Syns lagret *Strandskydd (indikation)* med en heldragen linje 100 m och en streckad 300 m från vattnet, och stämmer de ungefär med kartan? Prova med och utan Marktäcke ikryssat. Står det rätt sjö i texten? Prova också nära en liten damm eller bäck: säger texten att den saknar strandskydd enligt reglerna från 2025?
- **BH** Zip-filen: blir Skapa klar fortare? Välj *Ladda ner*: packas filen (statusraden visar procent) och sparas den? Andra gången ska den sparas direkt. **På iPhone**: kommer nedladdningen fram, eller stoppar Chrome den eftersom den startar först efter packningen?
- **BI** STÖD i menyraden på alla fyra sidor: öppnas rutan, går den att stänga med krysset, Stäng, Esc och klick utanför, och ser den bra ut på iPhone?
### 0.13.4

Rättelser efter testet 19 november (BD, BE och BF nedan). Tjänsterna är kontrollerade mot
Naturvårdsverket härifrån, men appen är inte körd mot dem i en webbläsare.

- **BB** Skydd i platsanalysen, om igen: gör en platsanalys med Skydd ikryssat. Vid testet 19 november kom fornlämningar och översvämning, men Skyddad natur *svarade med ett fel i stället för data* (också 17 november) och Strandskydd 502. Kommer skyddad natur nu, på en plats där du vet att det finns ett naturreservat eller Natura 2000-område, och på en där det inte finns något? Blir det en varning om Skyddad natur ändå: skriv av hela texten, den säger nu vad tjänsten svarade.
- **BD** Strandskydd och Vägar när OpenStreetMap är överbelastat: appen försöker nu tre gånger med några sekunders paus. Kommer strandskyddet med? Om inte säger varningen *(3 försök)*.
- **BE** Hämta från kartan efter Skapa: skapa ett underlag, välj *Hämta från kartan* och klicka på fastigheten. Ligger kartans lager, 3D-vyn och *Ladda ner* kvar, och säger texten under fältet att zip-filen har det gamla namnet? Skriv ut en karta i skala: har den det nya namnet?
- **BF** Hus och träd i större utsnitt: skapa ett utsnitt på 1–2 km sida med Träd, Byggnader med höjd och Skuggstudie, på samma ställe där hus och träd försvann. Finns de med nu, i 3D-vyn och i filerna? Hur lång tid tar det, och orkar webbläsaren? Med Punktmoln ikryssat ska du över 6 miljoner punkter få en varning om att LAS- och XYZ-filerna inte skapades, men träd och hus ska finnas ändå.

### 0.13.3

- **BB** Se 0.13.4: fornlämningar och översvämning kom med vid testet 19 november, skyddad natur och strandskydd inte.

### 0.13.1

- **AÄ** cad-apa på nya adressen: på <https://hojdkurvor.danaid.cloud/>, välj *Rita i cad-apa*. Öppnas <https://cad-apa.danaid.cloud/> med platsen? Skicka tillbaka en skiss från cad-apa: dyker volymerna upp i 04 Skiss? Prova också *Fortsätt rita i cad-apa* under resultatet.
- **AÖ** Hämta från kartan (AX): välj *Hämta från kartan* vid Projekt eller fastighet och klicka på en fastighet, (1) efter Skapa med Fastigheter ikryssat, (2) på ett annat ställe i samma kommun, (3) i en kommun där fastighetsindelningen inte är hämtad. Blir beteckningen rätt, och är beskeden begripliga?

### 0.13.0

- **AZ** Projekt: rita ett område, lägg till en volym och en sektion, ladda om sidan. Finns allt kvar? *Spara projektfil*, *Nytt projekt*, och öppna det första igen under *Senaste projekt*. Öppna projektfilen på den andra datorn (eller dra den till kartan) och välj Skapa: blir underlaget detsamma? Ändra något och öppna filen igen: är frågan om vilken version som gäller begriplig? Ligger `.hojdkurvor` i zip:ens rot?
- **AÅ** Skissen i DXF:en (rättelse efter AG): modellera några volymer i 3D-vyn (också prisma med tak), stäng vyn och välj Skapa. Öppna `skiss/_volymer_lokal.dxf` och `_samlad_lokal.dxf` i Archicad: syns volymerna med väggar och tak (lagret `SKISS_VOLYM`), på rätt höjd? Vilken fil var det som saknade skissen vid testet?

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

Klart vid testet 19 november (strukna, se CHANGELOG.md under 0.13.4): BA (synpunktsformuläret
efter de nya spärrarna) och BC (låset under Skapa) godkända.

Klart vid testet 18 november (strukna, se CHANGELOG.md under 0.13.0): AD, AG (utom
DXF:en, se AÅ) och AI godkända. AA, AE och AH är inte längre aktuella: på telefon finns
bara det enklare flödet (markera, skicka till datorn, beställ), inte 3D-vyn.

## Inarbetat ur inkorgen

Det som lämnades i inkorgen och byggdes direkt, så som det lämnades. Testas under *Att testa*.

### 19 november 2026 → 0.13.4

- **BD** Skyddad natur "svarade med ett fel i stället för data" (också 17 november) och Strandskydd 502. Stämmer frågan till Naturvårdsverket fortfarande? Strandskydd: försök igen vid 502. *Frågan stämde inte: tjänsten vill ha `outputFormat=GEOJSON` och rutan med nordvärdet först. Rättat, och nya försök vid 429, 502, 503 och 504.*
- **BE** Hämta från kartan kräver nytt Skapa för ett redan skapat underlag. Onödigt. *Det var namnbytet som kastade underlaget. Nu ligger det kvar.*
- **BF** Vid utsnitt på 1–2 km sida försvinner ibland hus och träd. Misstanke: taket på 6 miljoner laserpunkter. Läs och räkna ruta för ruta. *Misstanken stämmer med koden: över taket föll all laserdata bort. Laserdatan räknas nu in del för del, utan tak.*

## Önskemål

Grupperat efter den version där de är planerade.

### 0.10.x – modellera vidare

- **AB** Bästa hade varit om man kunde sänka linjer individuellt runt takfoten för att skapa sin egen takform. (Egna takfotslinjer.)
- **AF** Volymer ska kunna läggas i varandra för att skapa mer specifika geometrier. Union kom i 0.10.0; bortskärning (urtag) återstår.

### Projektfilen, etapp 3–6 (`plan-projektfil.md` i claude.ai-projektet)

Etapp 1 och 2 (webbläsarlagring och projektfil) kom i 0.13.0, se `docs/PROJEKTFIL.md`.
AO (punkt och radie sparas i projektet) är klar och struken. Kvar, i planens ordning:

1. **Förslag och sparade vyer** (etapp 3): volymerna i Basfall, Förslag A, B …, ett aktivt
   i taget; analyserna räknas för det aktiva. 3D-kamera, soltid och lager under ett namn.
   Samma förslags-id som i cad-apa. Helst före eller med solanalysen (0.14.0), som jämför
   basfall mot pagoda.
2. **Bilagor** (etapp 4): AM nedan, och anteckningar från platsbesök med foton (GPS).
3. **Egna punkter** (etapp 5): berg- och jorddjupspunkter enligt geologiplanen, i
   `inmatning.punkter`.
4. **Senare** (etapp 6): jämförelse när underlaget skapas igen (*1 ny byggnad sedan förra
   gången*), underlag i filen för visning utan nät (AP, villkoren först), inmätta punkter
   från nybyggnadskarta. Projektuppgifter (fastighet, uppdragsnummer, anteckning) finns i
   formatet men har inga fält i panelen än; de ska till utskriftens rubrikfält och
   platsanalysbladet.

- **AM** Möjlighet att lägga in eget bildunderlag som överlagring. Hör till projektfilens etapp 4 (bilagor): bilden i `bilagor/`, inpassad med två eller tre passpunkter.

### Version inte bestämd

- **AN** Generera skissvolymer efter eget inskannat underlag. Bygger på överlagringen (AM): rita fotavtryck ovanpå bilden (halvautomatiskt, med snäpp mot linjer i bilden) snarare än att tolka planen helt automatiskt.
- **AP** En html-fil i nedladdningsmappen som visar allt underlag som på webben, 2D och 3D, utan att kunna ändra utsnittet. Läser projektfilens `projekt.json` och filerna i zip:en. Kräver att visaren fungerar från en lokal fil (`file://`), där webbläsaren stoppar `fetch` – underlaget måste därför bäddas in eller läsas med en filväljare. Villkoren för Lantmäteriets data i en fil som sprids ska kontrolleras först.
- **AQ** Samlings-DXF med *inlänkade* filer (xref) och ortofotot som bild: 0.12.0 gör en samlad DXF med allt kopierat in. Länkar och bilder kräver DXF 2000 (handtag, OBJECTS, IMAGEDEF) och måste provas i Archicad först.

### Avvaktar

- **AC** Befintliga byggnader i fler format än IFC. IFC kom i 0.8.0; OBJ eller glTF vore nästa om något program behöver det.
