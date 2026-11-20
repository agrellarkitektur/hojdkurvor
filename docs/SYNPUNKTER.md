# Synpunkter

Synpunkter från egen användning, och det som ska testas. Varje punkt har ett
löpnummer (AA, AB … AÖ, BA, BB …) som följer med när den flyttas, så att den
går att hänvisa till. Nya punkter får nästa lediga nummer och läggs i
**Inkorgen** precis som de lämnas. När nästa version planeras sorteras de till
den version där de ska byggas. En punkt som är klar stryks och nämns i
CHANGELOG.md; numret används inte igen.

Senast använda nummer: **BÅ**.

## Inkorg

- **BK** Räkna om skissen utan att hämta allt igen: skuggor, sol, volymer och platsanalysbladet med data som redan är hämtad. *Före eller efter 0.14.0. 0.14.3: med hämtminnet hämtas inget igen för samma område (AY); själva beräkningarna görs fortfarande om.*
- **BL** Stöd-knappen blir ett hjärta när gränssnittet går över till ikoner.
- **BÅ** Skicka med datan: kan zip-filen och projektfilen räcka för att någon annan ska kunna öppna platsen och snurra i 3D, utan egen inloggning hos Lantmäteriet? *Bedömning: går, eftersom Lantmäteriets öppna data får spridas med källangivelse (CC BY 4.0). Det sparade resultatet (0.13.6) är redan det som behövs; det skulle läggas i projektfilen som bilaga (etapp 4) eller läsas ur zip-filen. Hänger ihop med AP. Inte gjort.*
- **BS** Mobilen: välj utsnittets format (förhållandet mellan sidorna) själv, inte bara storleken; nu är proportionerna fasta. Mobilen behöver bara det grundläggande: markera ett område och skicka det till datorn eller beställa underlaget. Annat mobilstöd behöver vi inte lägga tid på.

## Att testa

Grupperat efter den version där testbehovet uppstod.

### 0.14.3

Rättelser efter testet 20 november av AJ–AÅ.

- **BW** Vägytor (efter AJ och AV): kryssa i Vägar, Utkast till vägytor och Ortofoto på en plats med riktiga gator. Har varje gata samma bredd mellan korsningarna, och är hörnen i korsningarna rundade? Syns de blå ytorna mot ortofotot? Vad säger info-filen om hur många sträckor som är mätta? Öppna `_vagar_lokal.dxf` i AutoCAD.
- **BX** Bilderna (efter AR och AW): läs `SA_ANVANDER_DU_BILDERNA.txt` i zip:ens rot och `ortofoto/ORTOFOTO_SOM_TEXTUR.txt`. Är de begripliga, och stämmer måtten och arbetsflödet i Archicad? Prova också med egen nollpunkt eller vridning, där texturen behöver justeras. Räcker två världsfiler per bild (`.jgw` i SWEREF och `_lokal.jgw`)?
- **BY** Ramen (efter AT) och lassot (efter AU): skapa några utsnitt efter varandra i samma fönster, med Punktmoln ikryssat. Går det fortfarande att dra i ramen? Ringa in träd med lassot i 3D-vyn och flytta vyn: släcks slingan, och är träden fortfarande markerade?
- **BZ** Lås och hämta inte igen (AY): välj *Lås området*. Försvinner handtagen och krysset, och flyttas området inte när du drar i kartan? Skapa, skissa en byggnad under 04 Skiss och välj *Uppdatera analyserna*: går det fort, och säger sammanfattningen att allt fanns? Ladda om sidan: är området fortfarande låst (underlaget i minnet är borta efter omladdning, så nästa Skapa hämtar igen)? Lås upp med samma knapp. Räcker det här, eller ska Skapa delas i Hämta underlag och Skapa analys på var sin flik som i AY?

### 0.14.1

- **BT** Nya adressen: öppna <https://hojdkurvor.se/>, <https://höjdkurvor.se/>, <https://www.hojdkurvor.se/> och <https://hojdkurvor.danaid.cloud/>. Hamnar alla på hojdkurvor.se med giltigt lås? Öppna en äldre projektlänk (`…danaid.cloud/#p=…`): kommer området och valen fram på den nya adressen? Skicka en synpunkt från appen.
- **BU** Loggan höjdkurvor.se: ryms den i menyraden på datorn och på iPhone, i alla tre teman? Skapa en ritning, en skuggstudie och ett platsanalysblad och titta på loggan i ritningshuvudet.
- **BV** cad-apa (när cad-apa har fått den nya adressen): *Rita i cad-apa* från hojdkurvor.se, skicka tillbaka en skiss, och *Fortsätt rita i cad-apa*.

### 0.14.0

- **BN** *Rita i plan* på en riktig tomt (Windows, Chrome), skapad med Fastighetsgränser och Befintliga byggnader: blir ritriktningen rätt från början? Rita en rektangel med klick och med `12,6x9`, en polygon med klick och med inmatningsraden (`6`, `6<90`, `@3;4`). Fäster snäppet där du väntar dig, och är det lätt att se vad det fäster mot? Ortho (F8) och Snäpp (F3)? Flytta med ett hörn mot en gräns eller ett hus, dra i hörnen, vrid, kopiera, ångra.
- **BO** Måtten jämfört med en egen situationsplan: tre mått mot två gränser (två från långsidan, ett från kortsidan), yttermåtten och måttet mellan tillbyggnad och hus (som i skissen med 0,3). Väljer appen rätt gränser och sidor, och hamnar texterna läsbart? Ändra ett gränsmått och ett yttermått genom att klicka på siffran. *FG lika bef*.
- **BP** Ta in ett befintligt hus (Befintlig), gör det till huvudbyggnad, lägg till en tillbyggnad och ett förråd som ska rivas. Byt till 3D (knappen *3D*) och tillbaka (*Plan*): samma byggnader, utan det som rivs? Välj *Skapa* igen: är huset borta ur Byggnader och skuggorna, och är det rivna borta ur skuggorna?
- **BQ** **På iPhone**: öppnas planvyn och går den att läsa (panelen under ritningen)? Ritandet är tänkt för datorn.
- **BR** Saknas något för att kunna använda planen som grund för en situationsplan (etapp 3, 0.16.0): text, linjer, symboler, skala?

### 0.13.6

- **BJ** Skapa underlag, gå till Instruktioner, Om eller Beställ och tillbaka till kartan: kommer lagren, sammanfattningen och *Ladda ner* tillbaka utan nytt Skapa, och säger statusraden när underlaget skapades? Fungerar *Förhandsvisa i 3D*, utskriften och *Fortsätt rita i cad-apa* med det inlästa? Ladda om sidan: likadant. Ändra området eller nollpunkten: försvinner underlaget, och kommer det inte tillbaka efter omladdning? Prova också med ett stort område (1–2 km sida, mycket laserdata): vad säger raden *Sparat* i sammanfattningen, och hur lång tid tar det att komma tillbaka till kartan? **På iPhone**: finns underlaget kvar efter byte av sida?
- **BM** Stöd-rutan på dator och iPhone, i alla tre teman: får e-postadressen plats, och ser rutan bra ut med rubrikerna ovanför? Gå att skanna QR-koden från datorskärmen med Swish i telefonen (mottagaren ska vara Danaid Open Source)? **På iPhone**: öppnar ett tryck på koden Swish med rätt nummer och meddelandet *Stort tack för ditt stöd!*?

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

Klart vid testet 20 november (strukna, se CHANGELOG.md under 0.14.3): AK, AL, AS, AZ och AÅ
godkända. AJ, AR, AT, AU, AV, AW och AY ledde till ändringar, testas som BW–BZ. AZ: projektfilen
lästes inte när ett nytt utsnitt höll på att skapas; det går inte under Skapa, och beskedet syns
nu också på statusraden.

Klart vid testet 19 november (strukna, se CHANGELOG.md under 0.13.4): BA (synpunktsformuläret
efter de nya spärrarna) och BC (låset under Skapa) godkända.

Klart vid testet 18 november (strukna, se CHANGELOG.md under 0.13.0): AD, AG (utom
DXF:en, se AÅ) och AI godkända. AA, AE och AH är inte längre aktuella: på telefon finns
bara det enklare flödet (markera, skicka till datorn, beställ), inte 3D-vyn.

## Inarbetat ur inkorgen

Det som lämnades i inkorgen och byggdes direkt, så som det lämnades. Testas under *Att testa*.

### 20 november 2026 → 0.14.3 (svar på de äldre testpunkterna)

- **AJ/AV** Vägarnas mitt ligger rätt men bredden är vild. Jämn bredd mellan korsningar, raka vägar och mjuka radier; ortofotot som stöd för radierna i korsningarna. Låg kontrast mot ortofotot på kartan. Lagernamnen är bra. *En bredd per sträcka, korta sträckor som resten av gatan, 6 m radie i korsningarna (schablon, inte mätt i ortofotot), blå ytor.*
- **AR/AW** Hur används en jgw? Guide i roten. Ortofotot som textur på topon i Archicad: nytt material, ortofoto-jpg som textur, storlek som utsnittet, översida på meshen. Behövs alla jgw:er? *Två guider i zip:en, `_sweref.jgw` borttagen (den med bildens namn är SWEREF).*
- **AT** Dra i ramen slutade fungera efter några utsnitt i samma fönster. *Rättat.*
- **AU** Lassoytan stannar kvar och följer med när vyn flyttas. *Släcks när vyn rörs.*
- **AY** Lås markeringen och hämta inte om samma data; flerstegsraket med flikarna och en *Uppdatera analyser*-knapp. *Lås och hämtminne gjort; knappen byter text efter flik. Flikarna har inte fått egna knappar för Hämta och Skapa analys.*

### 19 november 2026 → 0.13.6

- **BJ** Platsdatan försvinner när man går till Instruktioner, Om eller Beställ och tillbaka; man måste skapa om. Den ska inte kännas ömtålig. *Resultatet och zip-filen sparas i webbläsaren efter Skapa och läses in när projektet öppnas igen.*
- **BM** Stöd-rutan: den långa e-postadressen går utanför rutan, och adressen står två gånger. Gemensamma kontaktuppgifter efter innehållet, Privatpersoner och Företag som rubriker ovanför text och bild (mer bredd, mindre luft). Swish-numret finns nu: QR-koden utan ramen, kvadratisk i rutan, med Swish-loggan i färg i mitten. *Gjort så. På mobilen är koden också en länk som öppnar Swish.*

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
