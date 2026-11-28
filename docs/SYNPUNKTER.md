# Synpunkter

Synpunkter från egen användning, och det som ska testas. Varje punkt har ett
löpnummer (AA, AB … AÖ, BA, BB …) som följer med när den flyttas, så att den
går att hänvisa till. Nya punkter får nästa lediga nummer och läggs i
**Inkorgen** precis som de lämnas. När nästa version planeras sorteras de till
den version där de ska byggas. En punkt som är klar stryks och nämns i
CHANGELOG.md; numret används inte igen.

Senast använda nummer: **EÅ**.

## Inkorg

- **BÅ** Skicka med datan: kan zip-filen och projektfilen räcka för att någon annan ska kunna öppna platsen och snurra i 3D, utan egen inloggning hos Lantmäteriet? *Bedömning: går, eftersom Lantmäteriets öppna data får spridas med källangivelse (CC BY 4.0). Det sparade resultatet (0.13.6) är redan det som behövs; det skulle läggas i projektfilen som bilaga (etapp 4) eller läsas ur zip-filen. Hänger ihop med AP. Inte gjort. Väntar på svar från Lantmäteriet (frågorna skickade 27 november).*
- **CF** Konkurrent: hojdkartan.se (C. Frid AB) läser in allt underlag dynamiskt utan att man anger inloggning till Lantmäteriet. Går det med licensvillkoren? *Bedömning: Markhöjdmodellen är en värdefull datamängd under CC BY 4.0 utan personuppgifter och får spridas fritt med källangivelse, också från egen server. Byggnad, Fastighetsindelning och Ortofoto räknar Lantmäteriet som personuppgifter, med egna villkor (prövning, lagring inom EU/EES) som måste läsas innan de visas fritt. Rätten till datan är inte rätt att låta andra använda ditt konto mot tjänsten: det kräver att data hämtas och lagras på egen server, eller besked från Lantmäteriet. Att vem som helst kan hämta datan är redan fallet: den är öppen. Fråga Lantmäteriet (geodatasupport@lm.se) innan något byggs. Hänger ihop med BÅ. Frågorna skickade 27 november: om höjddatan får hämtas med vårt systemkonto och lämnas vidare utan inloggning (och sparas tillfälligt på servern), medan användarens konto hämtar resten; vad som krävs för att visa fastighetsgränser, Byggnad och Ortofoto fritt; och om det går att rita egna modeller efter ögonmått ovanpå fotavtryck och ortofoto. Väntar på svar.*
- **DR** Koordinatkryss med jämna intervaller, utritade i zip-filen och på situationsplanen.
- **DS** Baskarteutdrag: många kommuner erbjuder gratis baskarteutdrag som PDF. Det vore fint om man kunde ladda upp en sådan PDF i sitt projekt, klicka i hur till exempel en kantstenslinje, ett staket eller en stödmur ser ut (tjocklek och färg), och få det som ett DXF-lager med rätt skala och placering.
- **DY** Fler soldiagram för andra plushöjder än marknivå, så att man kan se hur det blir på en takterrass till exempel. Då kan man lägga till flera extra rader som skapar fler soldiagram i mappen, men bara marknivå syns i platsanalysen.
- **DZ** Byta ut träd från ringar till andra symboler i exporterna direkt i Höjdkurvor-appen.
- **EA** Exportera träd som block i DXF i stället för cirklar, så att man kan byta ut dem mot egna block.
- **EB** Importera volymmodeller i IFC i skissläget, för att kunna anpassa analyserna efter redan befintliga modeller.
- **EC** Uppdatera sektionsfunktionen så att den faktiskt ritar ut byggnader och träd i och framför snittet. Möjlighet att välja sektionens siktdjup grafiskt i planen?
- **ED** Möjlighet att importera träd i Revit och ArchiCAD. Dels som plansymboler (cirkel eller trädsymbol som i DXF-symbolen), men också som 3D-objekt där varje objekt har en ankarpunkt i centrum vid mark och möjlighet att automatiskt byta ut 3D-objekten mot Enscape-proxies (eller andra proxies). Behövs importplugin för respektive program då?

## Måste testas före nästa version

Det som kan ge fel underlag eller filer, och det som nästa version (0.17.0, Skissa i 3D) bygger vidare på:
planvyns verktyg, smartmenyn, låsen och situationsplanen. Det mesta annat är bekvämlighet och kan vänta
tills tjänsten har använts mer; det står under *Bra att testa vid tillfälle*. En punkt kan flyttas mellan
rubrikerna när det visar sig att den behövs (eller inte).

### 0.16.6

Svar på de äldre testpunkterna 28 november (BG, BN–BR, BT–BV, AÄ). Synpunkterna står ordagrant under *Inarbetat ur inkorgen*.

- **ES** Strandskyddet (efter BG, ersätter ER): gör en platsanalys med Skydd vid en sjö, med Marktäcke urkryssat, gärna där en å rinner ut eller där sjön har en vik eller en ö. Syns strandlinjen (heldragen, mörkare blå) tillsammans med 100- och 300-metersgränserna, på kartan och i planvyn? Ligger gränserna bara på land, inte ute i sjön? Prova också Vättern eller en annan stor sjö. Går det fortare än 70 s när OpenStreetMap är segt (reservservern frågas nu efter 12 s)? Står det en varning om ett vatten där sidan inte gick att avgöra?
- **ET** Flytta och Rotera (efter BN): markera en byggnad och välj *Flytta* (M). Klicka ett hörn som baspunkt och ett hörn på en annan byggnad eller en gränspunkt som mål: hamnar hörnet exakt där? Prova att skriva `5` och `@3;4` i raden. Välj *Rotera* (O): rotationspunkt i ett hörn, referenslinje på en sida och mållinje på en tomtgräns. Blir sidan parallell med gränsen? Prova med punkter i stället för linjer, och att skriva en vinkel. Ångra.
- **EU** Smartmenyn (efter BN): klicka (utan att dra) på ett hörn, en sida, mitt i en byggnad, ett träd, ett grått hus och en tomtgräns. Kommer menyn upp bredvid klicket med rätt verktyg (Flytta härifrån, Rotera kring hörnet, Mått till tomtgräns härifrån, Yttermått på sidan, Entré här, Kopiera, låsen …)? Stör den när du bara vill markera eller dra? Saknas något verktyg?
- **EV** Låsen (efter BN): välj *Lås form* på en byggnad och dra i ett hörn: flyttas hela byggnaden med samma storlek? Välj *Lås placering*: går det inte att flytta, vrida, ändra hörn eller ta bort den, i planvyn och i 3D-vyn? Ligger låsen kvar efter omladdning och i projektfilen?
- **EW** Texterna (efter BN och BQ): dra texten för en liten tillbyggnad till en bättre plats, utanför byggnaden. Följer ledaren med, pekande på mitten? Klicka på texten och välj *Välj vart ledaren pekar*, klicka på en punkt. Dra i pilen. Markera en byggnad och dra dess text inne i den. Stämmer allt på PDF:en och i DXF:en, och tar *Tillbaka till sin plats* tillbaka texten?
- **EX** Egna mått (efter BO): klicka på ett hörn och välj *Mått till tomtgräns härifrån*, och på en sida och välj *Yttermått på sidan*. Kommer måtten där du vill ha dem? Dölj ett automatiskt mått och ta bort ett eget (klicka på siffran).
- **EY** Måtten i rader (efter BQ): rita en tillbyggnad mot ett befintligt hus som i bilden 28 november. Står måtten mellan byggnaderna och tillbyggnadens yttermått på en rad utanför tillbyggnaden, och husets hela längd på raden utanför den? Hamnar tillbyggnadens text utanför måtten? Välj *Numrerade hörn och koordinatlista* och dra ett nummer som ligger i vägen: står det kvar där, med en tunn linje till hörnet, också på PDF:en?
- **EZ** Träd och hus i planvyn (efter BP): klicka på ett träd och ändra höjd och krona, dölj ett, och klicka på ett grått hus och välj *Dölj huset*. Välj *Se dolda*: syns de utgråade, och går de att visa igen? Stämmer det med 3D-vyn och skuggorna efter Skapa?

### Äldre

- **EO** Klockan under Skapa (efter DU, 0.16.5): syns tiden och steget under mätaren medan underlaget skapas, och står det *väntar sedan … s* när ett steg tar lång tid? Hänger vägarna igen: blir resten klart efter cirka 40–80 s med en varning om vägarna, och kommer vägarna med när du väljer *Uppdatera underlag* lite senare?
- **EG** Situationsplanen som DXF (efter DF, 0.16.4): skapa DXF med Höjdkurvor ikryssat och öppna den i AutoCAD. Kryssa i *Ritningens ram*: syns ritningshuvudet, teckenförklaringen och upplysningen som grå rutor i ramen, och går ramen att flytta genom att dra i kanten? Ligger den kvar efter omladdning, och tar *Ramen kring byggnaderna* tillbaka den? Är nya byggnader skrafferade på PDF:en och i planvyn?
- **DB** Situationsplanen som PDF (0.16.0): fyll i åtgärd, ritad av och ritningsnummer under *Situationsplan*, välj A3 1:400 och A4 1:500. Visar ramen rätt utsnitt? Är PDF:en användbar som situationsplan till bygglov: linjer, texter, FG, entré, kryss, mått, teckenförklaring, upplysningstexten och ritningshuvudet? Saknas något jämfört med SKR:s checklista? Skriv ut i 100 % och mät skalstocken.
- **CÖ** Yttre skal (0.16.0): rita två kroppar i vinkel (till exempel 12 × 8 och 4 × 14 som går in i varandra) med samma status. Syns de som en byggnad, utan linjen mellan dem och utan överlappet, i planvyn, på kartan och i 3D-vyn? Klicka i byggnaden: syns kropparna var för sig och går de att ändra? Avmarkera: blir det en byggnad igen? Prova också en tillbyggnad mot ett befintligt hus (ska ritas för sig, med fogen). Stämmer BYA?
- **CG** Sol på fasaderna, grundflödet (0.15.0): rita en eller flera byggnader under 04 Skiss (eller *Befintlig* ur ett hus), kryssa i *Skapa platsanalysblad* med kapitlet SOL och *Sol på fasaderna*, och skapa. Står *Sol på fasaderna* i sammanfattningen, och finns `fasadsol/…_sol_pa_fasader.pdf` och `…_fasader.csv` i zip-filen? Är bladen begripliga (staplar och tabell, timme × dag, värsta dygnet)? Stämmer väderstrecken med kartan?

## Bra att testa vid tillfälle

Bekvämlighet, utseende, mobilen och sådant som inte ger fel underlag. Grupperat efter den version där
testbehovet uppstod.

### 0.16.6

- **EÅ** cad-apa (efter BV och AÄ): finns det några knappar kvar som skickar dig till cad-apa (*Rita i cad-apa*, *Fortsätt rita i cad-apa*, *Spara platsfil för cad-apa*)? De ska vara dolda tills cad-apa är i beta. En skiss sparad från cad-apa går fortfarande att importera.

### 0.16.5

- **EP** Uppdatera (efter DV): skapa ett underlag och välj sedan samma knapp igen utan att ändra området. Säger den *Uppdatera underlag*, med raden om att det går fortare under, och är det tydligt nog?
- **EQ** Kopiera status och logg (efter DW): välj länken under statusraden efter Skapa och klistra in här i chatten. Får du med status, sammanfattning och loggen med tider, och inget lösenord?

### 0.16.4

Svar på testet 27 november (DD–DJ, DT, BÄ, BÖ, CA, CB). Synpunkterna står ordagrant under *Inarbetat ur inkorgen*.

- **EE** Mobilen (efter DT): på iPhone, öppna menyn med hamburgaren uppe till höger och stäng den. Är formatväljaren ihopfälld, och visar knappen valt format? Välj 3:2 och dra i ett hörn: blir ramen större och mindre men behåller 3:2? Nyp för att zooma med ett finger nära ett hörn: står formatet kvar? Ladda om utan att markera: kommer kartan tillbaka dit du var? Välj *Hela verktyget*: finns *Mobilvyn* på kartan och i menyn, och tar den dig tillbaka?
- **EF** Skydd vid en stor sjö (efter DE): gör en platsanalys med Skydd vid Vättern. Går det fortare nu när de skyddade områdena klipps till utsnittet (50 m utanför), och syns det i infon att området är klippt?
- **EH** Måtten och tecknen (efter DG): syns vinkelrätsymbolen där gränsmåtten möter gränsen? Dra ett gränsmått till en annan gräns: följer måttet med, och ligger det kvar efter omladdning? Rita en polygon och välj huvudbyggnad, komplementbyggnad och skärmtak: får den sitt tecken? Sätt en vriden byggnad till Rivs: är krysset 45° mot norr?
- **EI** Befintlig och tillbyggnad (efter DH): ta in ett befintligt hus och rita en tillbyggnad strax bredvid det, vriden lite. Dockar den mot fasaden när du släpper den, eller när du sätter status Tillbyggnad? Har det befintliga huset bara yttermåttet på sidan mot tillbyggnaden, och inga gränsmått?
- **EJ** Texterna (efter DI): ligger måtten tätt intill sina linjer på PDF:en? Har texterna i planvyn samma storlek mot byggnaderna som på PDF:en när du zoomar? Rita en liten tillbyggnad: står texten utanför med en ledare? Är *BYGGNAD 1* i fetstil och FG och arean mindre?
- **EK** Koordinatlistan (efter DJ): är den grupperad per byggnad med *Ny huvudbyggnad*, *Tillbyggnad huvudbyggnad*, *Befintlig huvudbyggnad* osv., i panelen, på PDF:en och i DXF:en? Blir beskrivningen rätt för en tillbyggnad till en komplementbyggnad?
- **EL** Se dolda i 3D-vyn (efter CB): dölj några träd och ett hus, välj *Se dolda*. Syns de utgråade? Klicka på ett dolt träd och ett dolt hus och välj *Visa*. Ringa in flera dolda med lassot och välj *Visa dolda*. Stängs *Se dolda* av när inget dolt är kvar?
- **EM** Info när du håller över kartan (efter BÖ): använd kartan länge med Höjdkurvor, Laserpunkter och Skydd. Kommer infon fortfarande upp över skydd, strandskydd och byggnader? Står det i infon om ett skyddat område kommer från Naturvårdsverket eller OpenStreetMap, och var strandskyddets vatten kommer ifrån?
- **EN** Skriv ut i skala (efter BÄ): dra i den streckade ramen. Flyttas utskriftsytan inom utsnittet, och kommer det med på PDF:en (också Lantmäteriets karta)? Står koordinatsiffrorna längs linjerna och centrerade på dem, med streck längs ramen, och är kryssen svarta och tydliga?

### 0.16.1

Svar på testet 23 november (BG och synpunkterna på situationsplanen och sol på fasaderna). DD–DJ besvarade 27 november (se 0.16.4).

- **DK** *Redovisas i plan*: huvudbyggnad (kryss), komplementbyggnad (nock mellan gavlarna) och skärmtak (diagonal), alla med indrag från hörnen. Är indraget lagom (1,5 mm på papperet), och hamnar nocken åt rätt håll? Ser skärmtaket rimligt ut i 3D (tak på stolpar)?
- **DL** *Vrid mot* (A): vrid en byggnad så att en sida följer en tomtgräns och en fasad på ett annat hus. Vrids den kring rätt punkt?
- **DM** *Ledare* (T): lägg in en ledare med fritext, flytta texten och pilen, ändra texten och ta bort en. Ligger den kvar efter omladdning och i projektfilen? Hur ser den ut på PDF:en?
- **DN** *Träd* (G): lägg till ett träd, dölj ett ur laserdatan och visa det igen, ta bort det egna. Följer det med i 3D-vyn (och går det att ändra där), på kartan och efter Skapa i skuggorna?
- **DO** *Fastighet* (F): klicka på en fastighet. Fylls beteckningen i under *Situationsplan*?
- **DP** Takanslutning: rita ett hus med sadeltak och en lägre flygel i vinkel mot det (som i bilden 23 november), markera flygeln och välj *Anslut taket*. Möts taken i 3D-vyn utan gavel mot huset, och är planen oförändrad? Prova att skriva utdraget för hand.
- **DQ** Sol på fasaderna: är översikten (3D från två håll, nyckelplan, ett kort per fasad) begriplig och tillräckligt *smart*? Stämmer numren mellan sidorna och med 3D-vyn? Saknas något, till exempel timtoppen i 3D eller jämförelse mellan förslag?

### 0.16.0

- **DA** Måtten på en sammansatt byggnad: hamnar yttermåtten runt hela byggnaden och gränsmåtten på rätt hörn? Ändra ett yttermått och ett gränsmått. Dölj ett mått (klicka, *Dölj*) och ta tillbaka det (*Visa dolda mått*). Dra ett yttermått längre ut. Ligger det kvar efter omladdning?
- **DC** Situationsplanen som DXF i Archicad (eller AutoCAD): hamnar den rätt i arbetszonen, och är lagren och texthöjderna användbara?

### 0.15.0

- **CH** Kontroll mot Hudiksvall: rita ungefär de två kontorsblocken från underlaget på rätt plats, med omgivningen, och skapa med 21/3–21/9 och kl. 8–17. Hamnar det stora blockets samtidiga toppar nära underlagets 806 (öster), 831 (söder) och 850 (väster) W/m²? Summorna blir högre än i underlaget, eftersom himlen är klar varje dag. Stämmer skuggningen mellan blocken ungefär (det mindre blockets södersida)?
- **CI** Period och tid: välj April, September och Hela dygnet. Ändras bladen och 3D-färgerna, och ligger valen kvar efter omladdning och i projektfilen?
- **CJ** 3D-vyn: *Sol på fasader* bland valen (Summa och Timtopp, med skala). Är färgerna lätta att läsa mot den grå skissen, i alla tre teman? Ändra en byggnad i 3D-vyn eller planvyn: försvinner färgerna tills du skapar igen?

### 0.14.3

Rättelser efter testet 20 november av AJ–AÅ.

- **BW** Vägytor (efter AJ och AV): kryssa i Vägar, Utkast till vägytor och Ortofoto på en plats med riktiga gator. Har varje gata samma bredd mellan korsningarna, och är hörnen i korsningarna rundade? Syns de blå ytorna mot ortofotot? Vad säger info-filen om hur många sträckor som är mätta? Öppna `_vagar_lokal.dxf` i AutoCAD.
- **BX** Bilderna (efter AR och AW): läs `SA_ANVANDER_DU_BILDERNA.txt` i zip:ens rot och `ortofoto/ORTOFOTO_SOM_TEXTUR.txt`. Är de begripliga, och stämmer måtten och arbetsflödet i Archicad? Prova också med egen nollpunkt eller vridning, där texturen behöver justeras. Räcker två världsfiler per bild (`.jgw` i SWEREF och `_lokal.jgw`)?
- **BY** Ramen (efter AT): skapa några utsnitt efter varandra i samma fönster, med Punktmoln ikryssat. Går det fortfarande att dra i ramen? (Lassot ändrades igen i 0.14.4, se CB.)
- **BZ** Lås och hämta inte igen (AY): välj *Lås området*. Försvinner handtagen och krysset, och flyttas området inte när du drar i kartan? Skapa, skissa en byggnad under 04 Skiss och välj *Uppdatera analyserna*: går det fort, och säger sammanfattningen att allt fanns? Ladda om sidan: är området fortfarande låst (underlaget i minnet är borta efter omladdning, så nästa Skapa hämtar igen)? Lås upp med samma knapp. Räcker det här, eller ska Skapa delas i Hämta underlag och Skapa analys på var sin flik som i AY?

Klart vid testet 28 november (strukna, se CHANGELOG.md under 0.16.6): BT (nya adressen) och BU (loggan)
godkända. BR struken tills vidare (ägaren återkommer med önskemål). BV, AÄ och CK strukna tills cad-apa är i
beta; knapparna till cad-apa är dolda så länge. BG ledde till ändringar (ES, som ersätter ER). BN, BO, BP och
BQ godkända med nya önskemål, byggda och testas som ET–EZ; CE (markera och dölja träd och hus i planvyn) är
gjord med EZ.

Klart vid testet 27 november (strukna, se CHANGELOG.md under 0.16.4): DD (strandskydd ur OpenStreetMap) och
CA (terrängsektioner utan kryssruta) godkända. DT, DE–DJ, BÄ, BÖ och CB ledde till ändringar, testas som EE–EN.

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

### 28 november 2026 → 0.16.6 (svar på de äldre testpunkterna)

- **BG** Med marktäcke urkryssat fick man vänta på strandskyddet i 70 sekunder eller något för en sjö. Men nu står det att strandskyddet kommer från OpenStreetMap i kartan. Strandskydd syns fortfarande inne i en sjö. Vore bra om man såg OSMs strandlinje också tillsammans med strandskyddet. *Strandlinjen som avstånden räknas från visas på kartan, i planvyn och på situationsplanen. Varje vatten färgas för sig, så att två vatten som möts (en vik, en å) inte längre gör att vattnet räknas som land; öar i en sjö är land. Reservservern för OpenStreetMap frågas efter 12 s i stället för efter tre försök med 40 s tidsgräns. Testas som ES.*
- **BN** ok! Lägg till flytta-verktyg så att man kan klicka på en hörnpunkt (exempelvis) och flytta den punkten till en annan punkt. Lägg till rotera-verktyg där man också kan välja rotationspunkt, referenslinje och mållinje. Man ska kunna dra i texter inne/utanför byggnader och själv välja placering på dem med automatisk ledare. Man ska kunna välja vart ledaren pekar på om man inte vill att det är i mitten. Man ska kunna välja vilka hörn som en byggnad måttsäts till fastighetsgränd från (nu kan man bara dölja). Enkelklick på en punkt eller linje kan ta upp en smartpalett som i cad-apa (kolla gärna deras repo https://github.com/agrellarkitektur/cad-apa) med kontextbaserade verktyg (just flytta/rotera/måttsätt till fastighetsgräns osv). Man ska kunna låsa både form och placering på en byggnad, vid låst form så blir standardbeteendet att man flyttar den med samma storlek om man drar i en hörnpunkt. Med låst placering så går den inte ens flytta. *Flytta (M) och Rotera (O), smartmenyn vid ett klick, texter och ledare att dra, Mått till tomtgräns härifrån, Lås form och Lås placering. Testas som ET, EU, EV, EW och EX.*
- **BO** Ok! Men som BN, man måste kunna välja mer individuellt när det automatiska inte blir helt perfekt. *Egna gränsmått från valda hörn och egna yttermått på valda sidor, ur smartmenyn (EX).*
- **BP** Man ska markera träd och byggnader i "rita i plan" och ändra dem på samma sätt som i 3D-fönstret (dölja, ändra form/storlek, ersätta när den funktionen finns med sen). Det ska vara en 2D-representation av skissläget i 3D som vi har utrett separat med samma funktioner. *Träd (höjd, krona, dölj) och hus (dölj, ta in som befintlig) i smartmenyn, och Se dolda. Ersätt kommer med 0.17.0 (EZ).*
- **BQ** Se bifogad bild. Det funkar bra men mått sättningarna krockar rätt mycket. Man kan egentligen samla alla på en rad utanför byggnaden så blir det mer plats på ritningen vid byggnaden. Som du ser vill man kunna flytta "littera"-texter fritt om de råkar hamna i vägen. *Måtten på samma sida samlas i en kedja utanför byggnaden, och det som spänner över dem på raden utanför; texter utanför byggnaden håller sig borta från måtten; hörnens nummer går att dra (EY).*
- **BR** Återkommer med önskemål vid behov, stryk punkten så länge. *Struken.*
- **BT**, **BU** Ok. *Strukna.*
- **BV**, **AÄ** Stryk de här punkterna så länge så tar vi integration mot cad-apa när cad-apa är lite mer moget. Vi kan ta bort "fortsätt rita i cad-apa"-knappen ur gränssnittet så länge så att vi inte skickar folk vidare till en tjänst som inte ens är i beta. *Strukna, och CK med dem. Alla knappar som skickar till cad-apa är dolda (`visaCadApa` i `config.js`); importen av en sparad skiss finns kvar (EÅ).*
- Dela upp testsynpunkterna i två kategorier under varsin huvudrubrik: det som måste testas inför nästa version och det som är bra att testa vid tillfälle. Många av felen är quality of life och kan vänta. *Gjort: Måste testas före nästa version och Bra att testa vid tillfälle.*

### 28 november 2026 → 0.16.5 (inkorgen, utan att röra testet av 0.16.4)

- **DX** Strandskydd (till BG): nu får jag strandskydd även med marktäcke urkryssat, men det dyker upp på båda sidor om strandlinjen, även inne i sjön. Det blir olyckligt. *En stor sjö kommer från OpenStreetMap som strandbitar utan ytan, så avståndet räknades åt båda hållen. Nu räknas sidan med utsnittet som land, och vattnet får avståndet noll (ER).*
- **DU** Statusen under *Skapa*: en klocka som tickar eller liknande, så man ser att något händer. Väntar den på ett underlag för länge (till exempel OSM-vägarna, som hängde sig nyss) går den vidare och gör klart resten, och man kan försöka skapa det saknade igen. *Vägarnas fråga till Overpass hade ingen tidsgräns och kunde hänga hur länge som helst; nu 40 s per server, sedan reservservern, och därefter en varning medan resten blir klart. Under mätaren tickar en klocka med steget som pågår och hur länge det har väntat. Det saknade skapas med Uppdatera, utan att det andra hämtas igen (EO).*
- **DV** Knappen för att uppdatera: förtydliga att man bara uppdaterar befintligt utsnitt när man klickar igen. Tooltipen säger att redan hämtat underlag inte hämtas om, men andra gången går det mycket fortare, och det syns inte i knappen. *Knappen säger Uppdatera underlag andra gången för samma utsnitt, med en rad under om att det som redan är hämtat används igen (EP).*
- **DW** Kopiera sammanfattning och logg som text: en knapp som kopierar statusen och loggen, så att man kan klistra in den här som felsökning. *Kopiera status och logg under statusraden efter Skapa: status, sammanfattning, steg med tider och fel i sidan, utan inloggningen (EQ).*

### 27 november 2026 → 0.16.4 (testet av 0.16.1, 0.16.2 och de öppna punkterna från 0.14.4)

- **DT** ok! Formatet är kvar vid omladdning men inte platsen, man skickas ut till hela sverigekartan. Det kanske är som det ska. Gränssnittet i mobilen är dock väl trångt. Vi behöver fälla ihop huvudmenyn till en hamburgare uppe till höger. Man borde kunna minimera "formatväljaren". De valda formaten bör vara låsta om man inte väljer fritt så att man inte råkar ändra det vid zoomning. Trycker man hela kartan så försvinner hela vänsterpanelen och man kan inte komma tillbaka till den mobilanpassade panelen i början. *Hamburgare, ihopfälld formatväljare, låst format när hörnet dras och vid nypning, kartans läge sparat, knappen Mobilvyn på kartan och i menyn (EE).*
- **DD** ok. *Struken.*
- **DE** Funkar ok utom att skydd begränsas inte till utsnittet så vid vättern hämtade det ett jättestort område och då blev det segt. Hade den klippts efter utsnittet hade det nog varit ok. *Skyddade områden klipps till utsnittet med 50 m marginal (EF). Naturvårdsverkets tjänst lämnar ändå hela geometrin, så själva hämtningen blir inte mindre.*
- **DF** Ok, förutom att DXF exporteras som en fil med 0 kB filstorlek och så står det "invalid or incomplete DXF input -- drawing discarded" i autocad. Det vore också bra om man kunde flytta ritningsramen (eller vyn egentligen) i skissläget, inte alltid man vill göra en situationsplan av det som ligger i mitten av utsnittet. Visa även vad som döljs av namnrutan på ritningen i förhandsvisningen av ritningsramen. Även nya byggnader (inte bara tillbyggnader) ska vara skrafferade. *DXF:en rättad (stacken sprängdes av höjdkurvorna), ramen flyttbar och det som täcks visas grått, nya byggnader skrafferade (EG).*
- **DG** ok! Visa även vinkelrättsymboler där måtten ansluter till tomtgränser. Se bifogat. Man ska kunna dra i en måttsättning för att byta mot vilken tomtgräns den ansluter. Polygonformade byggnader får inget kryss/snedstreck eller liknande beroende på byggnadstyp. "Rivs"-byggnader ska få ett stort kryss över sig som är "linjerat mot norr" dvs, påverkas inte av själva byggnadens vridning. *Gjort så (EH).*
- **DH** En befintlig byggnad ska inte ha mått till tomtgräns eller yttermått (om det inte är på den sidan som en tillbyggnad ska byggas). En tillbyggnad ska "docka" mot en befintlig byggnads fasad. *Gjort så (EI).*
- **DI** Måtten hamnar lite väl långt från sina linjer i PDF:en. (Se bifogad jämförelse) Texterna inom byggnaden ser inte heller lika bra ut i pdf som på skiss-planen, de har liksom en annan storlek och radavstånd. Det är nog bättre om texter i skissplanen visas med "model units" så som de kommer plottas och inte lika stora oavsett zoomnivå. Som du ser försvinner också texten från en liten tillbyggnad. Då borde texten placeras utanför byggnaden med ett streck in mot mot fotavtrycket. Det är "Byggnad X" som borde vara i fetstil och FG samt area (ska läggas till i avtrycket) som ska visas med smalare/mindre text. *Vridna texter i PDF:en placeras nu rätt, planvyn ritar i ritningens storlek, texter utanför med ledare, namnet fett och FG och area mindre (EJ).*
- **DJ** Ser hyfsat ok ut. Kanske gruppera dem efter byggnad med beskrivning "Befintlig huvudbyggnad", "Tillbyggnad huvudbyggnad", "Ny komplementbyggnad" osv? *Gjort så, med befintliga byggnader i listan (EK).*
- **CB** "Visa dolda" kanska ska heta "se dolda" och så visas dolda träd och byggnader men utgråade och så får m an markera dem igen och välja "visa" för markeringen så att man inte unhidear allt med en knapp. *Gjort så (EL).*
- **CA** ok. *Struken.*
- **BÖ** förut kunde jag hålla över ett objekt för att få info om den "strandskydd, 100 meter, indikativ" osv. Men nu när jag använt fönstret rätt mycket så kommer det inte upp längre. F5 hjälper inte heller. Starta om fönstret hjälpte. Det står inget om OSM i skyddsmarkeringarna, bara "natura 2000" osv. *Trolig orsak: kurvornas och laserpunkternas canvas låg överst och tog musen. De ligger nu i ett lager som inte tar musen. Källan står i infon (EM). Inte återskapat i testmiljön.*
- **BÄ** ok! Men man bör kunna flytta utskriftsytan inom ens utsnitt. Vrid koordinatsifforna i pdf:en, centrera dem längs linjerna, markera linjerna med små streck längs ramen och gör kryssen lite tydligare (svart) *Gjort så (EN).*

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

- Ersätt ett hus också i planvyn (BP, 28 november): samma verktyg som i 3D-vyn. Markera och dölja träd och hus i planvyn (CE) kom i 0.16.6.

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
- **CÅ** Användarskapad omgivning, etapp 3: biblioteket går att läsa (litet API på VPS:en, SQLite), ägaren lägger in de första landmärkena och valet i appen visar biblioteksmodeller. *Matchningen (beslut 27 november):* biblioteket sparar inget ur Lantmäteriets Byggnad, inte heller objektidentiteten. Modellen får en kontrollsumma av fotavtrycket på huset som pekades ut med *Ersätt* (hörnen i SWEREF 99 TM, avrundade, i fast ordning). Stämmer summan ersätts huset; annars matchning på överlapp (minst halva modellens och halva husets fotavtryck, flera hus under en modell går), och utan träff visas modellen ändå och markeras för översyn. Se `utredning-anvandarskapad-omgivning.md` i claude.ai-projektet.
- **CÄ** Användarskapad omgivning, etapp 4: öppet inskick utan konto (formulär, villkor under CC BY 4.0 med upplåtelse till Agrell Arkitektur AB, hantera-länk, rapportering och granskningsvy). Först efter juristgranskning av villkoren.

- **AN** Generera skissvolymer efter eget inskannat underlag. Bygger på överlagringen (AM): rita fotavtryck ovanpå bilden (halvautomatiskt, med snäpp mot linjer i bilden) snarare än att tolka planen helt automatiskt.
- **AP** En html-fil i nedladdningsmappen som visar allt underlag som på webben, 2D och 3D, utan att kunna ändra utsnittet. Läser projektfilens `projekt.json` och filerna i zip:en. Kräver att visaren fungerar från en lokal fil (`file://`), där webbläsaren stoppar `fetch` – underlaget måste därför bäddas in eller läsas med en filväljare. Villkoren för Lantmäteriets data i en fil som sprids ska kontrolleras först.
- **AQ** Samlings-DXF med *inlänkade* filer (xref) och ortofotot som bild: 0.12.0 gör en samlad DXF med allt kopierat in. Länkar och bilder kräver DXF 2000 (handtag, OBJECTS, IMAGEDEF) och måste provas i Archicad först.

### Avvaktar

- **CK** (0.15.0) Platsen till cad-apa har fältet `fasadsol`; prova att *Rita i cad-apa* fungerar som förut. Avvaktar tills cad-apa är i beta och knapparna visas igen (28 november).

- **AC** Befintliga byggnader i fler format än IFC. IFC kom i 0.8.0; OBJ eller glTF vore nästa om något program behöver det.
