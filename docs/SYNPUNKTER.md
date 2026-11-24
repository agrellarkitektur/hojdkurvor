# Synpunkter

Synpunkter från egen användning, och det som ska testas. Varje punkt har ett
löpnummer (AA, AB … AÖ, BA, BB …) som följer med när den flyttas, så att den
går att hänvisa till. Nya punkter får nästa lediga nummer och läggs i
**Inkorgen** precis som de lämnas. När nästa version planeras sorteras de till
den version där de ska byggas. En punkt som är klar stryks och nämns i
CHANGELOG.md; numret används inte igen.

Senast använda nummer: **DT**.

## Inkorg

- **BÅ** Skicka med datan: kan zip-filen och projektfilen räcka för att någon annan ska kunna öppna platsen och snurra i 3D, utan egen inloggning hos Lantmäteriet? *Bedömning: går, eftersom Lantmäteriets öppna data får spridas med källangivelse (CC BY 4.0). Det sparade resultatet (0.13.6) är redan det som behövs; det skulle läggas i projektfilen som bilaga (etapp 4) eller läsas ur zip-filen. Hänger ihop med AP. Inte gjort.*
- **CF** Konkurrent: hojdkartan.se (C. Frid AB) läser in allt underlag dynamiskt utan att man anger inloggning till Lantmäteriet. Går det med licensvillkoren? *Bedömning: Markhöjdmodellen är en värdefull datamängd under CC BY 4.0 utan personuppgifter och får spridas fritt med källangivelse, också från egen server. Byggnad, Fastighetsindelning och Ortofoto räknar Lantmäteriet som personuppgifter, med egna villkor (prövning, lagring inom EU/EES) som måste läsas innan de visas fritt. Rätten till datan är inte rätt att låta andra använda ditt konto mot tjänsten: det kräver att data hämtas och lagras på egen server, eller besked från Lantmäteriet. Att vem som helst kan hämta datan är redan fallet: den är öppen. Fråga Lantmäteriet (geodatasupport@lm.se) innan något byggs. Hänger ihop med BÅ.*
- **DR** Koordinatkryss med jämna intervaller, utritade i zip-filen och på situationsplanen.
- **DS** Baskarteutdrag: många kommuner erbjuder gratis baskarteutdrag som PDF. Det vore fint om man kunde ladda upp en sådan PDF i sitt projekt, klicka i hur till exempel en kantstenslinje, ett staket eller en stödmur ser ut (tjocklek och färg), och få det som ett DXF-lager med rätt skala och placering.

## Att testa

Grupperat efter den version där testbehovet uppstod.

### 0.16.2

- **DT** Utsnittets format på mobilen (efter BS): på iPhone, välj 1:1, 3:2, 2:3 och 2:1 under ramen. Byter ramen form och står den mitt mellan sökrutan och bladet? Dra i ett hörn: blir formatet *Fritt* och ändras ramen lika mycket åt båda håll? Går hörnet lätt att ta tag i utan att kartan flyttas? Markera: har utsnittet samma proportioner som ramen? Ladda om: är formatet kvar?

### 0.16.1

Svar på testet 23 november (BG och synpunkterna på situationsplanen och sol på fasaderna).

- **DD** Strandskydd (efter BG): gör en platsanalys med Skydd nära en sjö, utan Marktäcke. Kommer strandskyddet med från OpenStreetMap nu? Svarar huvudservern fortfarande inte går frågan till en reservserver (overpass.kumi.systems); vad säger varningen i så fall? Prova en plats vid en stor sjö (Vättern, Mälaren): räcker 40 s nu när svaret är klippt till rutan?
- **DE** Underlaget i planvyn: skapa med Ortofoto, Träd och Skydd och öppna *Rita i plan*. Syns ortofotot, höjdkurvorna, träden och skydden under ritningen, och går de att slå av och på under *Visa*? Går det fortfarande lätt att panorera och zooma, också i ett stort utsnitt?
- **DF** Underlaget på situationsplanen: kryssa i Höjdkurvor, Träd, Vägar och Skydd under *Visa* och skapa PDF och DXF. Kommer de med under byggnaderna, med siffror på hela meter-kurvorna och rätt rader i teckenförklaringen? Är lagren i DXF:en användbara?
- **DG** Fastighetsgränserna ritas ovanpå byggnaderna, i planvyn och på ritningen. Syns de där en byggnad går ända fram till gränsen?
- **DH** *Mått* i verktygsraden: försvinner alla mått, också på PDF:en och i DXF:en, och kommer de tillbaka?
- **DI** Texterna på en tillbyggnad (och över kryss och nock): går de att läsa, i planvyn och på PDF:en?
- **DJ** *Numrerade hörn och koordinatlista* under *Visa*: numren vid hörnen, listan i panelen, på PDF:en (ovanför teckenförklaringen) och i DXF:en (till höger om planen). Är ordningen (nya byggnader först, medurs från nordväst) rätt för en bygglovshandling?
- **DK** *Redovisas i plan*: huvudbyggnad (kryss), komplementbyggnad (nock mellan gavlarna) och skärmtak (diagonal), alla med indrag från hörnen. Är indraget lagom (1,5 mm på papperet), och hamnar nocken åt rätt håll? Ser skärmtaket rimligt ut i 3D (tak på stolpar)?
- **DL** *Vrid mot* (A): vrid en byggnad så att en sida följer en tomtgräns och en fasad på ett annat hus. Vrids den kring rätt punkt?
- **DM** *Ledare* (T): lägg in en ledare med fritext, flytta texten och pilen, ändra texten och ta bort en. Ligger den kvar efter omladdning och i projektfilen? Hur ser den ut på PDF:en?
- **DN** *Träd* (G): lägg till ett träd, dölj ett ur laserdatan och visa det igen, ta bort det egna. Följer det med i 3D-vyn (och går det att ändra där), på kartan och efter Skapa i skuggorna?
- **DO** *Fastighet* (F): klicka på en fastighet. Fylls beteckningen i under *Situationsplan*?
- **DP** Takanslutning: rita ett hus med sadeltak och en lägre flygel i vinkel mot det (som i bilden 23 november), markera flygeln och välj *Anslut taket*. Möts taken i 3D-vyn utan gavel mot huset, och är planen oförändrad? Prova att skriva utdraget för hand.
- **DQ** Sol på fasaderna: är översikten (3D från två håll, nyckelplan, ett kort per fasad) begriplig och tillräckligt *smart*? Stämmer numren mellan sidorna och med 3D-vyn? Saknas något, till exempel timtoppen i 3D eller jämförelse mellan förslag?

### 0.16.0

Situationsplanen (etapp 3 i `plan-skiss-situationsplan.md`) och byggnader av flera kroppar som ett yttre skal.

- **CÖ** Yttre skal: rita två kroppar i vinkel (till exempel 12 × 8 och 4 × 14 som går in i varandra) med samma status. Syns de som en byggnad, utan linjen mellan dem och utan överlappet, i planvyn, på kartan och i 3D-vyn? Klicka i byggnaden: syns kropparna var för sig och går de att ändra? Avmarkera: blir det en byggnad igen? Prova också en tillbyggnad mot ett befintligt hus (ska ritas för sig, med fogen). Stämmer BYA?
- **DA** Måtten på en sammansatt byggnad: hamnar yttermåtten runt hela byggnaden och gränsmåtten på rätt hörn? Ändra ett yttermått och ett gränsmått. Dölj ett mått (klicka, *Dölj*) och ta tillbaka det (*Visa dolda mått*). Dra ett yttermått längre ut. Ligger det kvar efter omladdning?
- **DB** Situationsplanen som PDF: fyll i åtgärd, ritad av och ritningsnummer under *Situationsplan*, välj A3 1:400 och A4 1:500. Visar ramen rätt utsnitt? Är PDF:en användbar som situationsplan till bygglov: linjer, texter, FG, entré, kryss, mått, teckenförklaring, upplysningstexten och ritningshuvudet? Saknas något jämfört med SKR:s checklista? Skriv ut i 100 % och mät skalstocken.
- **DC** Situationsplanen som DXF i Archicad (eller AutoCAD): hamnar den rätt i arbetszonen, och är lagren och texthöjderna användbara?

### 0.15.0

Sol på fasaderna, efter `overlamning-solanalys.md` i claude.ai-projektet, på byggnadskropparna från 0.14.0.

- **CG** Grundflödet: rita en eller flera byggnader under 04 Skiss (eller *Befintlig* ur ett hus), kryssa i *Skapa platsanalysblad* med kapitlet SOL och *Sol på fasaderna*, och skapa. Står *Sol på fasaderna* i sammanfattningen, och finns `fasadsol/…_sol_pa_fasader.pdf` och `…_fasader.csv` i zip-filen? Är bladen begripliga (staplar och tabell, timme × dag, värsta dygnet)? Stämmer väderstrecken med kartan?
- **CH** Kontroll mot Hudiksvall: rita ungefär de två kontorsblocken från underlaget på rätt plats, med omgivningen, och skapa med 21/3–21/9 och kl. 8–17. Hamnar det stora blockets samtidiga toppar nära underlagets 806 (öster), 831 (söder) och 850 (väster) W/m²? Summorna blir högre än i underlaget, eftersom himlen är klar varje dag. Stämmer skuggningen mellan blocken ungefär (det mindre blockets södersida)?
- **CI** Period och tid: välj April, September och Hela dygnet. Ändras bladen och 3D-färgerna, och ligger valen kvar efter omladdning och i projektfilen?
- **CJ** 3D-vyn: *Sol på fasader* bland valen (Summa och Timtopp, med skala). Är färgerna lätta att läsa mot den grå skissen, i alla tre teman? Ändra en byggnad i 3D-vyn eller planvyn: försvinner färgerna tills du skapar igen?
- **CK** Platsen till cad-apa har fältet `fasadsol` (topparna per fasad och horisonten). cad-apa läser det inte än; prova bara att *Rita i cad-apa* fungerar som förut.

### 0.14.4

Rättelser efter testet 20 november av AÄ–BM.

- **BÄ** Skriv ut i skala (efter BE): öppna *Skriv ut i skala*. Syns en streckad ram på kartan, och är kartan nedtonad utanför? Byt format och skala: följer ramen med, och zoomar kartan ut när utsnittet inte får plats? Välj *Skapa PDF*: öppnas PDF:en i en ny flik, och sparar *Spara PDF* den med rätt namn? Stäng rutan: försvinner ramen?
- **BÖ** Skyddad natur (efter BB): gör en platsanalys med Skydd vid naturreservatet du vet om. Svarar Naturvårdsverket fortfarande inte: kommer reservatet nu från OpenStreetMap, märkt *(OpenStreetMap)*, och vad säger varningen (skriv av den; den säger om frågan gick via servern)? Svarar Naturvårdsverket: kommer reservatet utan märkning?
- **CA** Terrängsektioner: rita en sektion och skapa, utan någon kryssruta. Kommer sektionen med? Ta bort den och skapa igen: går det utan besked, och kommer allt annat?
- **CB** Trädvalet i 3D-vyn: välj *Lasso* och dra en slinga. Släcks slingan när du släpper musknappen, och har träden en ring vid marken (ingen cylinder)? Shift-klicka på ett omarkerat träd och på ett markerat: läggs det till och tas det bort? Shift-klicka på ett träd utan att lassot är på: öppnas urvalet? Dölj, och *Visa dolda*.

### 0.14.3

Rättelser efter testet 20 november av AJ–AÅ.

- **BW** Vägytor (efter AJ och AV): kryssa i Vägar, Utkast till vägytor och Ortofoto på en plats med riktiga gator. Har varje gata samma bredd mellan korsningarna, och är hörnen i korsningarna rundade? Syns de blå ytorna mot ortofotot? Vad säger info-filen om hur många sträckor som är mätta? Öppna `_vagar_lokal.dxf` i AutoCAD.
- **BX** Bilderna (efter AR och AW): läs `SA_ANVANDER_DU_BILDERNA.txt` i zip:ens rot och `ortofoto/ORTOFOTO_SOM_TEXTUR.txt`. Är de begripliga, och stämmer måtten och arbetsflödet i Archicad? Prova också med egen nollpunkt eller vridning, där texturen behöver justeras. Räcker två världsfiler per bild (`.jgw` i SWEREF och `_lokal.jgw`)?
- **BY** Ramen (efter AT): skapa några utsnitt efter varandra i samma fönster, med Punktmoln ikryssat. Går det fortfarande att dra i ramen? (Lassot ändrades igen i 0.14.4, se CB.)
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

### 0.13.5

- **BG** (23 november: med Marktäcke fungerar det; OpenStreetMap svarade 502 efter tre försök. Ändrat, testas som DD.) Strandskydd på en riktig plats nära en sjö (vid havet godkänt 20 november): kommer strandskyddet med, utan *signal is aborted without reason*? Syns lagret *Strandskydd (indikation)* med en heldragen linje 100 m och en streckad 300 m från vattnet, och stämmer de ungefär med kartan? Prova med och utan Marktäcke ikryssat. Står det rätt sjö i texten? Prova också nära en liten damm eller bäck: säger texten att den saknar strandskydd enligt reglerna från 2025?

### 0.13.1

- **AÄ** (20 november: skissen kan inte skickas tillbaka från cad-apa än; det arbetas på där. Analyserna och vad skissen behöver står i `docs/UTBYTE-CAD-APA.md`.) cad-apa på nya adressen: på <https://hojdkurvor.danaid.cloud/>, välj *Rita i cad-apa*. Öppnas <https://cad-apa.danaid.cloud/> med platsen? Skicka tillbaka en skiss från cad-apa: dyker volymerna upp i 04 Skiss? Prova också *Fortsätt rita i cad-apa* under resultatet.

Klart vid testet 20 november, andra omgången (strukna, se CHANGELOG.md under 0.14.4): AÖ, BD, BF,
BH (på datorn; mobilen behöver bara det enkla flödet), BI, BJ och BM godkända. BE godkänd, med
önskemål om förhandsvy och PDF i ny flik (gjort, testas som BÄ). BB: skyddad natur svarade fortfarande
503, testas som BÖ. BJ:s fråga om att behålla underlaget när utsnittet ändras ligger i inkorgen (CC).

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

### 25 november 2026 → 0.16.2

- **BS** Mobilen: välj utsnittets format (förhållandet mellan sidorna) själv, inte bara storleken; nu är proportionerna fasta. Mobilen behöver bara det grundläggande: markera ett område och skicka det till datorn eller beställa underlaget. Annat mobilstöd behöver vi inte lägga tid på. *Formatväljaren under ramen (1:1, 3:2, 2:3, 2:1, Fritt) och hörn att dra i (DT).*

### 24–25 november 2026 → 0.17.0 (prototypen Skissa i 3D)

Synpunkterna på prototyp 1–6 och besluten står i `docs/SKISSA-I-3D.md`, med prototypen i
`docs/prototyper/skissa-i-3d.html`. De byggs i 0.17.0 och testas då.

### 23 november 2026 → 0.16.1 (testet av situationsplanen och sol på fasaderna)

Situationsplanen:

- Rotera redan ritad byggnad med befintligt streck som referenslinje. *Verktyget Vrid mot (DL).*
- Kunna inaktivera måttsättningar. *Knappen Mått (DH).*
- Tillbyggnadsskrafferingen gör att det inte går att läsa texten ovanpå den. *Bakgrund bakom texten, skrafferingen klipps runt den (DI).*
- Möjlighet att flytta ut koordinater till en koordinatlista istället med nummer vid respektive hushörn. *DJ.*
- När man ritar vill man se samma vy som utanför ritläget med ortofoto, höjdkurvor, fastighetsgränser etc. *DE.*
- På den färdiga ritningen vill man se höjdkurvor, träd (möjlighet att dölja och lägga till enskilda – gäller även 3D), vägar, skydd (man ska kunna ställa in vad som ska synas). *DF och DN.*
- En byggnad ska inte skymma fastighetsgränser. *DG.*
- Man ska kunna lägga till ledare med fritext. *DM.*
- Huvudbyggnadkrysset ska inte gå hela vägen ut till hörnen utan ha ett visst indrag. Komplementbyggnader kan ha ett rakt streck i mitten mellan gavelspetsarna (som en nock) men med ett visst indrag. Ny byggvolym: skärmtak som redovisas med ett diagonalt streck (med indrag). *DK.*
- Klicka i kartan för att hämta fastighetsnummer. *Verktyget Fastighet i planvyn (DO); i 01 Plats finns Hämta från kartan sedan 0.13.1.*
- Man ska kunna rita takanslutningar (bild 23 november) utan att byggnaderna överlappar varandra. Förslagsvis att man först ritar avtrycket på mark (det som är utanför huset) men att man sen kan dra ut själva gavelspetsarna på en volym utan att det syns i plan. *Takanslutning med Anslut taket (DP).*

Sol på fasaderna:

- Försök göra att det ser lite mer "smart" ut med numrerade fasader, en 3D-översikt av byggnaden med projicerade diagram på etc. Bara tabeller och diagram ser lite tråkigt ut. Försök göra det mer visuellt och integrerat och fylligt. *Översiktssida och numrerade fasader (DQ).*

### 22 november 2026 → 0.16.0 (situationsplanen)

- En kommentar på den förra situationsplanen: satte man ihop två volymer i vinkel eller liknande för att skapa en sammansatt volym syntes de två volymerna överlappa varandra. Volymerna ska redovisas som en automatisk union, ett yttre skal. Först när man markerar dem ska det synas att man kan modifiera volymerna var för sig. *Byggt så: kroppar med samma status som går in i varandra eller ligger an är en byggnad i planvyn, på kartan, i PDF:en och DXF:en, med måtten runt skalet och BYA för unionen; den markerade byggnaden visar sina kroppar. 3D-vyn ritade redan konturerna som en union (0.10.0). Testas som CÖ–DA.*

### 22 november 2026 → 0.15.0 (planen i `overlamning-solanalys.md`)

- Sol på fasaderna på byggnadskropparna: klar himmel, fasadpunkter på cirka 1 m, skuggning från de andra kropparna, terräng, hus och träd, fjärran horisont. Period 21 mars–21 september (förval), april eller september; kontorstid kl. 8–17 (förval) eller hela dygnet. 3D-vyn färgad efter summa eller timtopp, PDF-blad med staplar, timme × dag, värsta dygnet och skuggningens uppdelning, lokal och samtidig topp hållna isär, topparna i platsen till cad-apa. *Byggt så; testas som CG–CK. Pagoda, STRÅNG och reflexer väntar (CW–CY).*

### 21 november 2026 → 0.14.4 (övriga synpunkter vid testet 20 november, utan nummer)

- Kravet *Rita minst en sektionslinje på kartan eller bocka ur Terrängsektioner* är jobbigt. Har man ritat en sektion exporteras den, annars inte, men allt annat exporteras. *Kryssrutan är borta.*
- Lassots streckade slinga ska slockna när musknappen släpps och växla till att visa de markerade träden. Markerade träd som en cirkel i marknivå, inte en cylinder (man tror lätt att det är för många träd). Shift-klick lägger till träd, och på ett markerat träd tar bort det. *Gjort så.*
- BE: *Skriv ut i skala* ska visa en förhandsvy av utsnittet om inte hela får plats i ritningsramen, och PDF:en ska öppnas i ett nytt fönster i stället för att måste laddas ner. *Ram på kartan och PDF i ny flik.*

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

### 0.17.0 – Skissa i 3D, med användarskapad omgivning etapp 1 (`docs/SKISSA-I-3D.md`)

Versionsplanen 24 november: omgivningen är en del av skissverktyget i 3D-fönstret (beslut 24
november), med formpaletten med ikoner från början, och CE. Hela planen, datamodellen och
algoritmerna står i `docs/SKISSA-I-3D.md`.

- **CE** Markera och dölja träd och byggnader även i planvyn, inte bara i 3D-vyn.

Från utredningen 22 november 2026. Det viktigaste är att det känns intuitivt och inte omständligt att
modellera omgivningen och egna byggnader; det väger tyngre än funktionsbredd. Ingen server krävs i den
här etappen. Lantmäteriets fotavtryck används inte för att modellera omgivningen (beslut 22 november):
de syns bara som tonad referens, utan snäpp eller mätning, och kan döljas.

- **CL** Prototypa interaktionen först (som planvyns artifact) och testa på Stadshuset och ett vanligt flerbostadshus innan datamodellen låses.
- **CM** *Ersätt* på ett hus: klicka på huset, välj *Ersätt*. En enkel kropp läggs på platsen med höjden ur laserdatan, och huset tonas ned som referens. Målet: ett hus på någon minut, utan manual.
- **CN** Dra direkt i 3D: handtag för höjd, sidor och hörn, med måttet synligt medan man drar. Siffror kan skrivas in (samma inmatningsrad som i planvyn) men behövs inte.
- **CO** Stapla genom att klicka på en yta: ny kropp på ovansidan av en annan (torn, indragna våningar).
- **CP** Få, tydliga former i en palett med bilder i stället för en lång lista med parametrar.
- **CQ** Snäpp mot egna kroppar, ortogonalt och mot laserdatans ytmodell (takkanter och höjder), inte mot Lantmäteriets fotavtryck. Prova om ytmodellens kanter är för brusiga.
- **CR** Ångra och gör om överallt, kopiera och spegla (flyglar, tvillinghus). Samma verktyg för omgivningen och för egna byggnader.
- **CS** Markeringen `omgivning: true` på kroppen: räknas i analyserna och visas i 3D, men måttsätts inte, räknas inte i BYA och ritas i situationsplanen som befintligt hus (tunn linje).
- **CT** Val per projekt (*Omgivning: Standard / Användarskapade där de finns*) och per byggnad (*Standard (laserdata)*, bibliotekets modeller, *Egen ritad*); valet för byggnaden överstyr projektets. Diskret markering i 3D av hus som har alternativ.
- **CU** Valet sparas i projektfilen (`omgivning: { lage, val }`) med en kopia av den valda modellens geometri, så att projektet öppnas likadant även om modellen ändras; *Ny version finns* när det finns en nyare.
- **CV** Analyserna (skugga, sol på fasader, horisont, skyfall) och exporterna (DXF, mesh, skissfilen till cad-apa) följer valet.

Öppna frågor ur utredningen: standardhusen eller användarskapade som förval i nya projekt (förslag:
standardhusen), hur användarskapade modeller anges i utskrifter (förslag: en källrad med modellnamn,
bidragsgivare och licens).

### 0.18.0 – arbetsgången och ikoner

- **CD** Mer linjär arbetsgång med flikarna. 01 Plats: bara låsa platsen, inget Skapa där. 02 Underlag: välj underlag; skapar man bara underlaget får man höjdkurvorna och terrängsektionerna. 03 Analys: fyll i analyserna, de skapas, och först då kommer en samlad zip med allt. 04 Skiss: skissa vidare där, eller ta det till cad-apa. *Hänger ihop med AY och BZ (Lås området och hämtminnet finns; Skapa är fortfarande en knapp för allt).*
- **CC** (efter BJ) När utsnittet ändras försvinner underlaget. Förväntat, men kan det lösas på annat sätt? Det som redan är skapat fortsätter att synas, och *Skapa igen* fyller i tomrummen (skapar underlag för hela platsen igen). *Hämtminnet (0.14.3) töms i dag när området byts; det skulle behöva behålla rutorna som fortfarande täcker platsen.*
- **BK** Räkna om skissen utan att hämta allt igen: skuggor, sol, volymer och platsanalysbladet med data som redan är hämtad. *Före eller efter 0.14.0. 0.14.3: med hämtminnet hämtas inget igen för samma område (AY); själva beräkningarna görs fortfarande om.*
- **BL** Stöd-knappen blir ett hjärta när gränssnittet går över till ikoner.

### 0.19.0 och senare (versionsplanen 24 november)

- 0.19.0: bedömning med en regelbok för befintliga analyser (nivå, kort bedömning, åtgärder och
  källa per utfall; märks *indikation*). En AI-sammanfattning kan läggas ovanpå senare.
- 0.20.0: förslag och sparade vyer (projektfilen, etapp 3), med jämförelse också på bedömningen.
- 0.21.0: nya analyser, första omgången: dagsljus på fasaderna, lutning och tillgänglighet, klimat
  (snölast, referensvind, växtzon), utsikt.
- 0.22.0 →: geologi (etapp 0–4), bilagor (AM, AN) och resten; nya analyser omgång två (vind på
  platsen, översvämning och havsnivå m.m.). Datakällorna är inte kontrollerade.

### Sol på fasaderna, senare

Det som väntar enligt `overlamning-solanalys.md`.

- **CW** Utkragning per våning (pagoda): enkel version i Höjdkurvor, detaljerad i cad-apa. Ska planeras mer först.
- **CX** SMHI STRÅNG (timvärden för global, direkt och diffus strålning, 2,5 km rutnät) för summorna i kWh med verkligt väder. CORS och format är inte kontrollerade.
- **CY** Reflexer mellan byggnaderna (i dag bara reflex från marken).

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

- **CZ** Användarskapad omgivning, etapp 2: fler byggformer (staplade kroppar, cylinder och månghörningar, kupol och klot, kon, pyramid och torn). Ska finnas innan biblioteket öppnas.
- **CÅ** Användarskapad omgivning, etapp 3: biblioteket går att läsa (litet API på VPS:en, SQLite), ägaren lägger in de första landmärkena och valet i appen visar biblioteksmodeller.
- **CÄ** Användarskapad omgivning, etapp 4: öppet inskick utan konto (formulär, villkor under CC BY 4.0 med upplåtelse till Agrell Arkitektur AB, hantera-länk, rapportering och granskningsvy). Först efter juristgranskning av villkoren.

- **AN** Generera skissvolymer efter eget inskannat underlag. Bygger på överlagringen (AM): rita fotavtryck ovanpå bilden (halvautomatiskt, med snäpp mot linjer i bilden) snarare än att tolka planen helt automatiskt.
- **AP** En html-fil i nedladdningsmappen som visar allt underlag som på webben, 2D och 3D, utan att kunna ändra utsnittet. Läser projektfilens `projekt.json` och filerna i zip:en. Kräver att visaren fungerar från en lokal fil (`file://`), där webbläsaren stoppar `fetch` – underlaget måste därför bäddas in eller läsas med en filväljare. Villkoren för Lantmäteriets data i en fil som sprids ska kontrolleras först.
- **AQ** Samlings-DXF med *inlänkade* filer (xref) och ortofotot som bild: 0.12.0 gör en samlad DXF med allt kopierat in. Länkar och bilder kräver DXF 2000 (handtag, OBJECTS, IMAGEDEF) och måste provas i Archicad först.

### Avvaktar

- **AC** Befintliga byggnader i fler format än IFC. IFC kom i 0.8.0; OBJ eller glTF vore nästa om något program behöver det.
