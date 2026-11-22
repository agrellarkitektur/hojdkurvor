# Ändringar

Versionsnumret står i `js/version.js` och visas i felrapporten och i
platsanalysbladet. En kortare version av listan finns under Ändringar på `om.html`.

## 0.16.0 – 2026-11-22

Situationsplanen, etapp 3 i `plan-skiss-situationsplan.md` (claude.ai-projektet), och ägarens
synpunkt på den förra planen: byggnader som sattes ihop av två kroppar i vinkel visade båda
kropparna, med överlappet synligt.

- **Yttre skal**: kroppar med samma status som går in i varandra eller ligger an redovisas som en
  byggnad, med unionen av fotavtrycken som kontur (`Kropp.union`, `Kropp.skal`), i planvyn, på
  kartan, i PDF:en och i DXF:en. Först när en av kropparna markeras i planvyn ritas de var för
  sig (halvgenomskinligt, de andra streckade), så att de går att ändra. Kroppar med olika status
  (en tillbyggnad mot det befintliga huset) hålls isär, så att fogen syns. En innergård blir ett
  hål.
- **Måtten på skalet** (`js/situationsplan.js`, `Situationsplan.matt`): mått till tomtgräns och
  yttermått räknas på byggnadens yttre kontur, inte på varje kropp; mått mellan byggnader som
  ligger an som förut. Ett gränsmått flyttar hela byggnaden. Ett yttermått som hör till en kropps
  sida ändrar den kroppen; en sida som skapas av två kroppar ber om att byggnaden markeras.
- **Annotering**: klicka på ett mått för att ändra det eller **dölja** det (*Dölj*); *Visa dolda
  mått* tar tillbaka dem. **Dra** ett yttermått eller ett mått mellan byggnader för att flytta
  måttlinjen. Det sparas på kroppen i fältet `matt` (se `docs/PROJEKTFIL.md`), också i projektet.
- **BYA** räknar överlapp en gång: arean av unionen; det tillkommande är det som läggs till utöver
  det befintliga.
- **Situationsplanen som PDF** (vektor, A3 eller A4, liggande eller stående, 1:400 eller 1:500)
  under *Situationsplan* i planvyns panel: fastighetsgränser och Lantmäteriets hus, byggnaderna
  efter status (ny fylld, tillbyggnad skrafferad, befintlig tunn, rivs streckad), kryss för
  huvudbyggnad, entrépil, namn och FG, mått, valfria hörnkoordinater, norrpil, skalstock,
  teckenförklaring (bara det som finns på planen), upplysningstext om gränserna och källan, och
  ritningshuvud med fastighet, kommun, åtgärd, skala, datum, ritad av, ritningsnummer,
  koordinatsystem och BYA. PDF:en öppnas i en ny flik som de andra.
- **Situationsplanen som DXF** i arbetszonen, ett lager per innehåll (`SITPLAN_NY`,
  `SITPLAN_TILLBYGGNAD`, `SITPLAN_SKRAFFERING`, `SITPLAN_BEFINTLIG`, `SITPLAN_RIVS`,
  `SITPLAN_FASTIGHETSGRANS`, `SITPLAN_BYGGNAD_LM`, `SITPLAN_MATT`, `SITPLAN_MATTEXT`,
  `SITPLAN_TEXT`, `SITPLAN_HUVUDBYGGNAD`, `SITPLAN_ENTRE`, `SITPLAN_KOORDINATER`,
  `SITPLAN_FASTIGHETSBETECKNING`), med texthöjder efter skalan. `Dxf.skriv` har fått vinkel och
  centrerade texter.
- **Ritningens ram** i planvyn visar vad som kommer med på papperet; den slås på när formatet eller
  skalan ändras. Formatet och skalan sparas i webbläsaren.
- **Projektuppgifterna** till ritningshuvudet (fastighet, åtgärd, ritad av, ritningsnummer) fylls i
  under *Situationsplan* och sparas i projektet (`projekt.fastighet`, `uppdrag`, nya `ritadAv`
  och `ritningsnummer`). Fastigheten föreslås ur fältet *Projekt eller fastighet*.
- Skilda golv i samma byggnad: FG skrivs per kropp, i den del som inte täcks av de andra.
- Nya tester: `test/situationsplan.test.js`, `test/situationsplan_test.py`; union, skal och BYA i
  `test/kropp.test.js`.

## 0.15.0 – 2026-11-22

Sol på fasaderna, efter planen i `overlamning-solanalys.md` (claude.ai-projektet), på
byggnadskropparna från 0.14.0 i stället för skissvolymerna.

- **Sol på fasaderna** under 03 Analys (kapitlet SOL, *Anpassa sol*): instrålningen mot
  fasaderna på alla byggnader under 04 Skiss utom de som rivs, timme för timme med klar
  himmel. Period 21 mars–21 september (förval), april eller september; tid kl. 8–17
  (förval) eller hela dygnet. Valen sparas i projektet (`val.analys.fasadsolPeriod`,
  `fasadsolTid`).
- **Beräkningen** (`js/fasadsol.js`, ren och testad i Node): fasadpunkter i ett rutnät på
  cirka 1 m, gavlarna upp till taket; punkter under marken eller inne i en annan byggnad
  räknas inte. Horisonten framför varje punkt i tre steg: den egna byggnaden, alla
  byggnader och omgivningen (terräng, hus och träd ur laserdatan inom 150 m, terrängen
  inom 5 km bortom det). Klar himmel efter ESRA (Linkes grumlighetsfaktor 3), diffus
  strålning efter Hay–Davies med den del av himlen fasaden ser, reflex från marken med
  albedo 0,2.
- **Resultat**: summa (kWh/m²), lokal topp (högsta timmedel i en punkt, för rummen) och
  samtidig topp (högsta areaviktade timmedel för fasaden, för kylningen), per fasad och
  per byggnad och väderstreck, och hur mycket mindre direkt sol de andra byggnaderna och
  omgivningen ger. `fasadsol/…_sol_pa_fasader.pdf` (A3: staplar och tabell, timme × dag,
  värsta dygnet) och `fasadsol/…_fasader.csv` i zip-filen, ett avsnitt i info-filen.
- **3D-vyn**: *Sol på fasader* färgar fasaderna efter summa eller timtopp, med skala
  (0–900 W/m², 0–700 kWh/m² för hela säsongen och mer om värdena är högre). Skissen blir
  grå så länge, och färgerna försvinner när skissen ändras.
- **Platsen till cad-apa** har fältet `fasadsol`: topparna och summan per fasad och den
  fjärran horisonten (`docs/UTBYTE-CAD-APA.md`). cad-apa läser det inte än.
- Kontroll mot underlaget från Hudiksvall: ett block på 60 × 20 × 22 m ger samtidiga
  toppar på 816 (öster), 850 (söder) och 780 (väster) W/m², mot 806, 831 och 850 i
  underlaget (`test/fasadsol.test.js`).
- `Analys.horisont` har fått `minAvst`. Nya testkrokar `TERRANG_TEST.satVolymHojd`,
  `platspaket` och `byggProjekt`; nytt gränssnittstest `test/fasadsol_test.py`.

## 0.14.4 – 2026-11-21

Rättelser och förbättringar efter ägarens test 20 november (AÄ–BM i
`docs/SYNPUNKTER.md`).

- **Skyddad natur** (BB): svarar inte Naturvårdsverket hämtas naturreservat,
  nationalparker och andra skyddade områden ur OpenStreetMap i stället
  (`Geodata.skyddadNaturOsm`). Varningen säger det, och områdena är märkta
  *(OpenStreetMap)* på kartan, i info-filen och på platsanalysbladet.
  Vattenskyddsområden och liknande räknas inte. Felet säger om frågan gick via
  servern (`geodata.php`), och servern presenterar sig som en webbläsare mot
  myndigheterna.
- **Terrängsektioner utan kryssruta**: ritade sektioner kommer alltid med, och
  utan sektioner skapas allt annat. Kryssrutan och beskedet *Rita minst en
  sektionslinje* är borta.
- **Trädvalet i 3D-vyn**: lassots slinga släcks när musknappen släpps. De
  markerade träden får en ring vid marken i stället för en cylinder. Shift-klick
  på ett träd lägger till det i urvalet, och på ett markerat träd tar bort det.
  Shift med lassot lägger till det inringade.
- **Skriv ut i skala** (BE): en streckad ram på kartan visar vad som får plats
  på pappret; kartan utanför tonas ned. PDF:en öppnas i en ny flik med knappen
  *Spara PDF*. Stoppar webbläsaren fliken sparas filen som förut.
- `docs/UTBYTE-CAD-APA.md` listar analyserna och vad skissen från cad-apa
  behöver för det som är planerat (AÄ).

## 0.14.3 – 2026-11-20

Rättelser och förbättringar efter ägarens test av de äldre punkterna (AJ–AÅ i
`docs/SYNPUNKTER.md`).

- **Lås området** (AY) under 01 Plats: ramen går inte att dra, handtagen och
  krysset försvinner och Rita, hörnen och koordinatsystemet är avstängda tills
  man låser upp. Låset sparas i projektet (`plats.last`).
- **Underlaget hämtas inte igen** (AY) för samma område: det som hämtats under
  Skapa sparas i minnet (`js/hamtminne.js`, högst 900 MB, bara i fliken) och
  används vid nästa Skapa. Knappen säger *Skapa … igen* och under 04 Skiss
  *Uppdatera analyserna*; sammanfattningen säger hur mycket som fanns. Byts
  området töms minnet. Uppdelningen av Skapa i Hämta och Skapa analys är inte
  gjord.
- **Dra i ramen** fungerar efter flera Skapa (AT). Laserpunkterna och
  höjdpunkterna fick en ny canvas vid varje Skapa, som lade sig över ramens
  grepp. Nu återanvänds de, och ramen ligger i en egen ruta över resultaten.
- **Lassot** i 3D-vyn släcks när vyn rörs (AU); träden förblir markerade.
- **Vägytorna** (AJ, AV): vägarna delas i sträckor mellan korsningarna och
  varje sträcka får en bredd (medianen av mätningen i ortofotot, avrundad till
  0,5 m). Sträckor under 30 m får bredden från resten av gatan. Hörnen i
  korsningarna rundas med 6 m radie (gångvägar 1 m), bara nära korsningarna.
  Ytorna är blå (gångvägar gröna) på kartan i stället för grå.
- **Bilderna** (AR, AW): världsfilen med bildens namn (`_ortofoto.jgw`) är i
  SWEREF och läses av sig själv; `_lokal.jgw` finns kvar, `_sweref.jgw` är
  borttagen. Nytt: `SA_ANVANDER_DU_BILDERNA.txt` i roten (världsfiler steg för
  steg, insättningspunkt och skala för AutoCAD och Archicad) och
  `ortofoto/ORTOFOTO_SOM_TEXTUR.txt` (ortofotot som textur på terrängen i
  Archicad, med utsnittets mått).
- Projektbyte under Skapa säger till på statusraden också (AZ).

## 0.14.2 – 2026-11-20

Nytt Swish-kort i Stöd utvecklingen. Inget nytt i kartan.

- **Swish-kortet** (`bilder/swish-kort.png`, tidigare `swish-qr.png`) är bytt mot ägarens nya kort från
  Swish: QR-koden, numret 123-718 06 15, höjdkurvor.se och Swish-loggan. Koden
  och länken på bilden har meddelandet *Stort tack för att du stöttar
  Höjdkurvor.se! <3*. Kortet har egen vit ruta runt koden och visas utan extra
  bakgrund, 150 px brett (120 px på smal skärm).
- **Mottagaren är Agrell Arkitektur AB**, det namn Swish visar när man signerar.
- cad-apa godtar nu https://hojdkurvor.se (`HOJDKURVOR_ORIGINS`), så Rita i
  cad-apa fungerar från den nya adressen. Projektlänkar till
  hojdkurvor.danaid.cloud fungerar så länge Caddy omdirigerar den adressen.

## 0.14.1 – 2026-11-20

Ny adress och loggan. Inget nytt i kartan.

- **Ny adress: <https://hojdkurvor.se/>.** höjdkurvor.se, www-adresserna och den
  tidigare adressen hojdkurvor.danaid.cloud leder dit (Caddy i
  agrellarkitektur/apps). Appen ligger kvar på samma server. Länkar som appen
  skapar (projektlänken, länken med inloggning, länken till datorn) får den nya
  adressen av sig själva. Det som är sparat i webbläsaren på den tidigare
  adressen följer inte med; spara projektet som projektfil och öppna den på den
  nya.
- **Loggan skriver höjdkurvor.se** igen, med punkten i accentfärgen, i
  menyraden på alla fyra sidor och i PDF:erna (ritningen, skuggstudien och
  platsanalysbladet; `Utskrift.ordbild`). Appen heter fortfarande Höjdkurvor i
  löpande text.
- Publiceringen kontrollerar filerna mot den nya adressen (`SIDA` i
  `publicera-vps.yml`), och releasen länkar dit. README, `CLAUDE.md`,
  `docs/FLYTT.md` och `docs/UTBYTE-CAD-APA.md` har den nya adressen.
- **Kvar i cad-apa**: ursprunget `https://hojdkurvor.se` i `HOJDKURVOR_ORIGINS`
  och adressen i `HOJDKURVOR_URL`. Tills det är gjort tar cad-apa inte emot
  platsen från den nya adressen.

## 0.14.0 – 2026-11-19

Byggnadskroppar och planvyn, etapp 1–2 i planen för skiss och situationsplan.

- **Rita i plan** under 04 Skiss: tomten uppifrån med fastighetsgränserna och de
  befintliga husen. Rektangel med klick eller mått (`12,6x9`), polygon med klick
  eller inmatningsraden (`6`, `6<90`, `@3;4`, `E;N`), ritriktning efter en gräns,
  fasad eller ett hus, snäpp mot hörn, mittpunkter och linjer (också vinkelrätt),
  Ortho, flytta med ett hörn som fäster, dra i hörnen, vrida, kopiera, ångra och
  gör om. Hörnlistan visar och tar emot koordinater och sidlängder.
- **Byggnadskroppen**: varje byggnad i skissen har status (ny, tillbyggnad,
  befintlig, rivs), kan vara huvudbyggnad (kryss i plan), färdigt golv (FG) i
  RH 2000, takfot, tak med lutning och nockens riktning, och en entrépil.
  Samma byggnader går att ändra i 3D-vyn, och *Plan* i 3D-vyn byter tillbaka.
  Taksprång ritas inte i plan, som på en situationsplan.
- **Befintligt hus från Lantmäteriet** med ett klick. Höjd och golv är skattade.
  Huset ersätts av byggnaden i 3D-vyn, skuggorna och filerna.
- **Mått**: tre mått vinkelrätt mot två tomtgränser (två från långsidan, ett
  från kortsidan, två till samma hörn), yttermått på en lång och en kort sida,
  och mått mellan en tillbyggnad och huset den sitter mot. Klicka på ett mått
  och skriv ett nytt för att flytta byggnaden eller ändra sidan. *FG lika bef*
  när en tillbyggnad har samma golv som det befintliga. BYA per byggnad och
  totalt.
- Byggnader med status *Rivs* räknas inte i skuggor, horisont och skyfall och
  visas inte i 3D-vyn. Kartan visar status med linjetjocklek och streckning.

## 0.13.6 – 2026-11-19

- **Underlaget finns kvar när du byter sida.** Efter *Skapa* sparas resultatet
  och zip-filens innehåll i webbläsaren, för projektet. Går du till
  Instruktioner, Om eller Beställ och tillbaka, eller laddar om sidan, läses det
  in igen: lagren på kartan, sammanfattningen, 3D-vyn, utskriften och *Ladda
  ner*. Statusraden säger när underlaget skapades, och sammanfattningen säger
  om det är sparat. Det senaste resultatet sparas för de tre senaste
  projekten, högst cirka 600 MB; blir zip-filen för stor sparas resultatet utan
  den. Ändrar du något som gör underlaget inaktuellt (området, nollpunkten,
  sektionerna, skissen, skuggtiderna …) tas det sparade bort. Under *Sparat i
  webbläsaren* står hur stort det är, och *Ta bort* på projektet tar bort
  det också.
- **Stöd utvecklingen** har Swish: QR-koden (med Swish-loggan) och numret
  123-718 06 15. På mobilen öppnar ett tryck på koden Swish. Rubrikerna
  Privatpersoner och Företag står ovanför texten, så att rutan blir bredare
  och lägre, och kontaktadressen står en gång, längst ner. Den långa
  e-postadressen går inte längre utanför rutan.

## 0.13.5 – 2026-11-19

Synpunkter från egen användning 19 november.

- **Strandskyddet efter reglerna från 1 juli 2025**: insjöar under 1 ha,
  bäckar (räknas som högst 2 m breda) och anlagt vatten räknas inte. Ligger
  ett sådant vatten närmare än det som har strandskydd nämns det i texten.
  Linjerna 100 m (heldragen) och 300 m (streckad) från vattnet visas som
  lagret *Strandskydd (indikation)* på kartan och följer med som DXF i
  mappen `strandskydd/` (lagren `STRANDSKYDD_100`, `STRANDSKYDD_300` och
  `STRANDSKYDD_VATTEN`, också i den samlade DXF:en).
- **Strandskyddet med marktäckets vatten**: är Marktäcke ikryssat läses
  sjöar, hav och vattendragsytor ur Lantmäteriets marktäcke 300 m runt
  utsnittet. Svarar inte OpenStreetMap räcker det, men då saknas bäckar och
  namn. Vatten i grannkommunen kommer bara med från OpenStreetMap.
- **Strandskydd: kunde inte hämtas (signal is aborted without reason)**:
  appen avbröt själv frågan till OpenStreetMap efter 25 sekunder, och ett
  sådant avbrott gav inga nya försök. Nu får OpenStreetMap 40 sekunder, ett
  avbrott försöks igen som ett 502, och felet säger *svarade inte inom 40 s*.
  Frågan går medan resten av underlaget skapas.
- **Zip-filen packas när du laddar ner**, inte i varje Skapa. Skapa blir
  klar fortare, och den packade filen sparas tills du skapar igen.
- **STÖD i menyraden** på alla sidor öppnar avsnittet Stöd utvecklingen i en
  ruta. Texten finns på ett ställe (`js/stod.js`) och visas också på Om-sidan.

## 0.13.4 – 2026-11-19

Rättelser efter testet av 0.13.3 (BD, BE och BF i `docs/SYNPUNKTER.md`).

- **Skyddad natur kom aldrig med**: frågan till Naturvårdsverket stämde inte
  med tjänsten. Den vill ha `outputFormat=GEOJSON` (appen bad om
  `application/json` och fick ett XML-fel, *svarade med ett fel i stället för
  data*) och utsnittets ruta med nordvärdet först; med östvärdet först är
  svaret tomt utan fel. Natura 2000-områdenas namn, kod och direktiv läses ur
  tjänstens egna fält (`OMRADESNAMN`, `OMRADESKOD`, `OMRADESTYP`). Ett skydd
  vars beslut inte gäller än får det utskrivet, till exempel *Naturreservat
  (överklagat)*. Svarar bara den ena av de två tjänsterna står det i
  varningen, och platsanalysen säger då inte *inget skyddat område*.
  Felmeddelandet från en tjänst skrivs ut också när det står i CDATA.
- **Nya försök när en tjänst är överbelastad**: svarar Naturvårdsverket,
  Riksantikvarieämbetet, MCF eller OpenStreetMap (strandskyddets vatten och
  vägarna) 429, 502, 503 eller 504 försöker appen två gånger till, efter 2
  och 5 sekunder. Går det ändå inte säger varningen hur många försök som
  gjordes.
- **Ett nytt projektnamn kastar inte underlaget**: förut nollställdes kartans
  lager, 3D-vyn och zip-filen så fort namnet ändrades, också av *Hämta från
  kartan*, så att underlaget måste skapas igen. Nu ligger allt kvar.
  Utskrifterna och platsen till cad-apa får det nya namnet direkt; zip-filen
  och filerna i den har det gamla tills du väljer Skapa igen, och det står
  under fältet.
- **Hus och träd försvann i större utsnitt**: laserdatan lästes in i sin
  helhet, med ett tak på 6 miljoner punkter. Över taket (ofta redan vid
  1–2 km sida) föll all laserdata bort, och med den träden, husens höjder,
  höjd över mark och skuggorna från dem. Nu läses punkterna ruta för ruta och
  räknas direkt in i ytmodellen, trädsökningen, horisonten och sektionerna
  utan att sparas (`Laser.lasRutvis`, `Analys.ytsamlare`), så antalet har
  inget tak och minnet följer ytan. Trädsökningen skiljer träd från tak med
  träffar per halv meter i stället för med varje punkt; resultatet på
  testlandskapet är oförändrat. Bara punktmolnsfilerna (LAS, XYZ) behöver
  punkterna själva: över 6 miljoner punkter i utsnittet skapas de inte, med
  en varning, men allt annat räknas. Info-filen säger hur många punkter som
  lästes ur varje laserruta. Gränsen på 6 km² för analysområdet är kvar.
- Godkänt vid testet 19 november: synpunktsformuläret efter de nya spärrarna
  (BA) och låset under Skapa (BC).

## 0.13.3 – 2026-11-19

Rättelser efter granskningen av 0.13.2. Ett säkerhetsfel är rättat: har du
sparat inloggningen till Lantmäteriet i webbläsaren och öppnat en projektlänk
eller projektfil från någon du inte litar på, byt lösenordet.

- **Skript ur en projektlänk eller projektfil**: sektionens namn skrevs som
  HTML i kartans tips, så att en preparerad länk eller fil kunde köra skript
  på sidan och läsa en sparad inloggning. Namnet skrivs nu som text. Samma
  sak för namn ur stompunkter, marktäcke, skyddad natur och listan över
  sparade filer.
- **Projektlänkar**: sektionerna ritas direkt, inte först efter omladdning.
  En länk med text i stället för tal i utsnittet eller horisontpunkten
  avvisas i stället för att ge sidfel.
- **Träd som visades igen kunde förbli dolda** efter att ett projekt öppnats
  i en annan zon än SWEREF 99 TM: trädvalen fick tvillingar en decimeter
  bredvid. De slås nu ihop (`Projekt.slaIhopTradval`).
- **Trasiga projektfiler** stoppar inte appen. Fält av fel sort ersätts med
  standardvärden, och volymer utan fotavtryck och sektioner utan punkter tas
  bort.
- **Inget projektbyte medan underlaget skapas**: Nytt projekt, Öppna
  projektfil, Senaste projekt och Importera skiss är låsta tills Skapa är
  klar. En projektfil som släpps på kartan eller en skiss från cad-apa under
  tiden tas inte emot, med ett besked. Förut kunde källorna och husen hamna
  i fel projekt.
- **Synpunktsformuläret** (`synpunkter.php`): högst 30 synpunkter i timmen
  från alla tillsammans (utöver fem per avsändare), och formuläret tas bara
  emot som JSON från appens egna sidor.
- **`geodata.php`** följer bara omdirigeringar till https på en av
  vitlistans servrar, högst två gånger. `geodata.php` och `stac.php` låter
  webbläsaren spara bara lyckade svar, så att ett tillfälligt fel hos en
  myndighet inte ligger kvar i en timme.
- 3D-vyn lämnar inte kvar en lyssnare varje gång den stängs.
- **Stöd utvecklingen**: en platshållare för Swish-QR:n på Om-sidan.
  Copyrightraden i alla källfiler är `Agrell Arkitektur AB`.
- Arbetsflödena `publicera-vps.yml` och `stang-webbhotellet.yml` har bara de
  rättigheter de behöver.
- Nytt test `test/sol.test.js` (solens läge mot NREL:s SPA, svensk tid,
  skuggans längd). `projekt.test.js` prövar trasiga filer och trädvalen,
  `projekt_test.py` låset under Skapa.

## 0.13.2 – 2026-11-19

Ny licens: **AGPL-3.0 eller senare gäller från och med den här versionen.**
Versionerna till och med 0.13.1 är GPL-3.0 eller senare och förblir det.
Beslutet och genomförandet står i `docs/LICENS.md` (samma beslut som i
cad-apa 0.12.5.4).

- **Licensen**: `LICENSE` är den officiella AGPL-3.0-texten från gnu.org. Den
  gamla GPL-texten ligger i `LICENSES/GPL-3.0.txt`. Alla egna källfiler har
  licenshuvudet `SPDX-License-Identifier: AGPL-3.0-or-later` och en
  copyrightrad för Agrell Arkitektur. Licensavsnitt i README med kommersiell
  licens, namnen Höjdkurvor och höjdkurvor.se och bidrag.
- **Länken till källkoden** (AGPL §13): *Källkoden* i panelens fot på kartan,
  i sidfoten på de andra sidorna och på Om-sidan. Publiceringen och releasen
  skriver in commiten i `js/kalla.js`, så att länken går till koden för just
  den version som körs.
- **Stöd utvecklingen** på Om-sidan: frivilligt bidrag för privatpersoner
  (Swish är på väg, till dess kontakt), supporteravtal mot faktura och
  kommersiella licenser för företag. Inga funktioner läggs bakom betalning.
- **THIRD-PARTY.md** (förut `THIRD_PARTY.md`) är genomgången: alla bibliotek
  och typsnitt har licenser som går ihop med AGPL. Lantmäteriets och de andra
  källornas data är inte kod och har egna villkor.
- **Bidrag**: `CONTRIBUTING.md` och `CLA.md`, som i cad-apa.
- Nytt test `test/kalla.test.js`: länkarna, Om-sidan, licensen och
  licenshuvudet i alla egna filer.

## 0.13.1 – 2026-11-19

Flytten är klar, och fastighetsnamnet kan hämtas ur kartan (AX).

- **cad-apa på nya adressen**: `cadApaUrl` i `config.js` (och reservvärdet i
  `js/app.js`) är `https://cad-apa.danaid.cloud/`. *Rita i cad-apa* och
  skissen tillbaka fungerar mellan hojdkurvor.danaid.cloud och
  cad-apa.danaid.cloud. Länkar till appen på Om-sidan och i instruktionerna.
- **Den gamla adressen stängs av**: FTP-publiceringen (`publicera.yml` och
  `.github/scripts/kontrollera-webbplatsen.sh`) är borttagen. Det nya
  arbetsflödet `stang-webbhotellet.yml` (körs för hand) tar bort appen från
  agrellarkitektur.se/terrang/, utan omdirigering.
- **Taggar och releaser av sig själv**: `release.yml` skapar tagg och release
  med zip-filen och versionens avsnitt ur CHANGELOG.md när en push till `main`
  ändrar `js/version.js`.
- **Hämta från kartan** (AX) vid *Projekt eller fastighet* i 01 Plats: nästa
  klick på kartan fyller i fastighetsbeteckningen under punkten. Källa i tur och
  ordning: det senast skapade underlaget, kommunens fastighetsindelning i
  webbläsaren (utan att fråga Lantmäteriet) och sist Lantmäteriet, vilket kräver
  inloggning och beställd Fastighetsindelning. `Fastighet.vid`,
  `Kommunfil.hamtaKommun({ baraSparad })`.
- Dokumentationen (README, CLAUDE.md, `docs/UTBYTE-CAD-APA.md`,
  `docs/FLYTT.md`) har de nya adresserna. Synpunkterna går med e-post från
  VPS:en; README beskrev fortfarande webbhotellet.

## 0.13.0 – 2026-11-18

Projektfilen, etapp 1 och 2 i planen (`plan-projektfil.md` i claude.ai-projektet),
och test av 0.8.0–0.10.1. Formatet beskrivs i `docs/PROJEKTFIL.md`.

- **Projekt i webbläsaren** (`js/projekt.js`, blocket *Projektet* i `app.js`):
  utsnittet, valen, skissens volymer, sektionerna, horisontens punkt, Punkt och
  radie och rättelserna av tak, träd och hus sparas en halv sekund efter varje
  ändring i IndexedDB (databasen `terrangunderlag`, version 2, objektlagringen
  `projekt`). Volymer, sektioner, horisontens punkt och projekt-id låg förut i
  sessionStorage och försvann när fliken stängdes. Efter omladdning öppnas samma
  projekt igen.
- **Senaste projekt och Nytt projekt** under Projekt i steg 01, med en liten bild
  av utsnittet och volymerna. Under Sparat i webbläsaren (02) listas projekten med
  storlek och kan tas bort ett och ett.
- **Projektfilen** `<namn>.hojdkurvor`: en zip med `projekt.json` och
  `bilagor/`. *Spara projektfil* och *Öppna projektfil* i steg 01, eller dra
  filen till kartan. En prick på knappen när något är ändrat sedan filen sparades.
  Projektfilen ligger också i nedladdningszippens rot. Är filen och webbläsaren
  oense om samma projekt får man välja filens version, webbläsarens eller att
  öppna filen som kopia. En fil från en nyare version ger ett tydligt besked.
  Okända fält bevaras när filen sparas igen.
- **Koordinaterna**: geometrin i projektet är i SWEREF 99 TM, utsnittet och
  nollpunkten i arbetszonen. Volymerna räknas om med primitivens mitt, vridning
  och nockriktning (`Projekt.flyttaVolym`). Förut följde bara fotavtrycket med
  när zonen byttes, så att en volym som modellerats i 3D hamnade fel när
  fotavtrycket räknades om ur primitiven.
- **Inmatning utanför utsnittet** flaggas: *1 volym och 1 sektion ligger utanför
  utsnittet. De finns kvar i projektet.*
- **Flera flikar**: ändras samma projekt i en annan flik visar fliken *Läs in
  igen* och sparar inget förrän man har valt (`BroadcastChannel`).
- **Flytt från 0.12**: det som låg i sessionStorage, och första gången det
  senaste utsnittet, blir ett projekt.
- **cad-apa**: `projekt.id` i platspaketet är projektets id. En skiss med ett
  annat projekt-id öppnar det projektet eller ett nytt med samma id.
- **Skissen i DXF:en som volymer (AG)**: `skiss/_volymer_*.dxf` har nu väggar och
  tak som 3DFACE på lagret `SKISS_VOLYM` (takfall och gavlar ur
  `Volym3D.takytor`, platta tak trianglade), utöver fotavtryck och takfot som
  polylinjer. `Dxf.skriv` har fått `typ: 'yta'`. Volymer utan golvnivå (`null`
  efter att ha sparats) fick förut golvet 0 i analyserna; nu står de på marken.
  `volym3d.js` laddas med sidan.
- **Test 0.8.0–0.10.1**: skuggor, konturer, färger, ögonhöjd och bilder (AD),
  träd, rättade tak och modelleringen (AG) och ortofotot i cad-apa (AI) godkända.
  3D-vyn på telefon (AA, AE, AH) är inte längre aktuell: mobilen har bara det
  enklare flödet (markera, skicka till datorn, beställ).
- **Tester**: `test/projekt.test.js` (format, migrering, okända fält, spara →
  öppna → spara, omräkningarna, zip) och `test/projekt_test.py` (hela flödet i
  webbläsaren). `ui_test.py` kontrollerar projektfilen i zip:en och volymerna i
  skissens DXF.

## 0.12.2 – 2026-11-17

Synpunkter 17 november: skuggstudien i platsanalysen.

- **Skuggstudien på ett A3-blad med ram**: i platsanalysen ritas skuggstudien
  på ett blad med samma ram och ritningshuvud som de andra
  (`Platsanalysblad.skuggsida`). `Utskrift.skuggblad` har fått
  `opt.ruta = { x, y, w, h }`, som ritar rutnätet i en ruta på den sida som
  redan är öppen, utan egen rubrik och ordbild. Den fristående
  `skuggor/_skuggstudie.pdf` är som förut.
- **Husens fotavtryck i skuggrutorna**: `opt.byggnader` (svart linje) och
  `opt.volymer` (skissade volymer, orange linje) ritas ovanpå skuggorna, i
  båda PDF:erna. Bara konturen, så att skugga på taken fortfarande syns. Varje
  ruta klipps nu mot utsnittet. Noten förklarar linjerna.
- **Dokumentationen**: `docs/SYNPUNKTER.md` har löpnummer (AA, AB …) och är
  grupperad efter version; synpunkterna skickas nu med e-post från VPS:en
  (`docs/FLYTT.md` steg 5).

## 0.12.1 – 2026-11-17

Inkorgen 17 november: felet med soldiagrammet och horisonten, och tre ändringar
i leveransen.

- **Soldiagram med horisont**: `T.lasHojderGrov` läser Markhöjdmodellen 5 km
  runt platsen, också rutor som utsnittet inte rör. En ruta som inte gick att
  läsa fällde hela soldiagrammet med *Kunde inte nå Lantmäteriets server*. Nu
  hoppas varje sådan ruta över (NaN, id i `fel` resp. `saknas`), och bara om
  ingen ruta går att läsa kastas felet. Rutorna som saknas står i varningen,
  info-filen och noten på soldiagrammet. Misslyckas horisonten ändå skapas
  soldiagrammet utan horisont, med en varning. Trolig orsak: en ruta som inte
  finns svarar 404 utan CORS-huvuden, och webbläsaren ser då ett nätverksfel
  (ett prov utan inloggning gav 401 *med* CORS-huvuden, så det
  oinloggade svaret är det inte). Testservern svarar nu så för saknade
  `.tif`, och `test/horisont.test.js` prövar läsningen.
- **Platsanalysen i roten**: `<namn>_platsanalys.pdf` ligger i zip:ens rot
  bredvid info-filen och den samlade DXF:en.
- **Soldiagrammet på ett A3-blad**: i platsanalysen ritas soldiagrammet på ett
  blad med samma ram och ritningshuvud som de andra (`Platsanalysblad.solsida`).
  `Sol.soldiagramPdf` har fått `opt.ruta = { x, y, k }` som placerar och skalar
  A4-diagrammet på en befintlig sida. Filerna i `soldiagram/` är oförändrade.
- **Ingen DXF för skuggor, lutning och skyfall**: de förvirrade när de
  öppnades. Skuggstudien är PDF, lutning och skyfall PDF och JPEG med
  världsfil. De ingår därför inte heller i den samlade DXF:en. Funktionerna
  (`Analys.dxfSkuggor`, `Platsanalys.dxfLutning`, `dxfSkyfall`) finns kvar.
- **Karttjänster som svarar med fel**: en WFS/WMS som svarar 200 med ett
  XML-fel (ServiceException) ger nu *svarade med ett fel i stället för data*
  i stället för ett JSON-fel.
- **Synpunkter på hojdkurvor.danaid.cloud**: hur e-posten sätts upp (msmtp via
  Loopias SMTP) står i `docs/FLYTT.md`, steg 5.

## 0.12.0 – 2026-11-15

Synpunkter från 1, 13 och 15 november, och förberedelser för flytten
till apps.danaid.cloud. Appen heter nu bara Höjdkurvor.

- **Lutning och skyfall som egna filer**: förutom DXF får båda lagren en JPEG
  med världsfiler (`_lutning.jpg`, `_skyfall.jpg` med `_lokal.jgw` och
  `_sweref.jgw`, som ortofotot) och en PDF i vektor (`_lutning.pdf`,
  `_skyfall.pdf`) i mappen `platsanalys`. Bilderna har 0,25 m per pixel och
  vit bakgrund (högst 8 192 px per sida). PDF:en är en A3 (A1 om skalan annars
  blir grövre än 1:2 000) i största standardskala som får plats, med
  befintliga hus och fastighetsgränser för orientering. Lutningen ritas som
  ytor per klass (`Utskrift.plan` med `lager.lutning.konturer`), också klassen
  flackare än 1:50. Skyfallets flödesvägar klipps nu mot utsnittet i
  utskriften. `Platsanalys.lutningBild`, `skyfallBild`, `bildRutnat`.
- **Samlad DXF**: `<namn>_samlad_lokal.dxf` och `_samlad_sweref.dxf` i zip:ens
  rot, bredvid info-filen, med alla DXF-underlag och deras lager kopierade in i
  en fil (`Dxf.sammanfoga`, `test/dxf.test.js`). Ortofotot och bilderna ingår
  inte; de läggs in med sina världsfiler. Inlänkade referenser (xref) och
  bilder i DXF:en kräver DXF 2000 och är inte gjorda.
- **Vägytorna är beräknade**: lagren heter `VAG_YTA_BIL_BERAKNAD` och
  `VAG_YTA_GANG_BERAKNAD`, ytorna är streckade på kartan och har en
  verktygstips, och teckenförklaringen säger *beräknad ur ortofoto*. Bredden
  och sidförskjutningen jämnas ut mer: medianfönstret växer med vägens bredd
  (±7 stationer upp till ±16 för breda vägar) och följs av ett glidande
  medelvärde, så att trappstegen försvinner.
- **Punkt och radie**: i steg 01 Plats ger *Punkt och radie* och ett klick på
  kartan en kvadrat med punkten i mitten och sidan två gånger radien (förval
  50 m, kanterna på jämna 10 m). Byts radien ritas kvadraten om kring samma
  punkt.
- **Flytta området genom att dra i ramen**: en osynlig bred linje längs ramen
  (`ramGrepp`) går att gripa; området flyttas i steg om 10 m och storleken
  står kvar.
- **Lasso i 3D-vyn**: knappen *Lasso* ringar in flera träd, som markeras, och
  *Dölj n träd* döljer dem på en gång (samma val som *Dölj trädet*).
  `vy3d.tradPaSkarm()`, `vy3d.markeraTrad([…])`.
- **Namnet**: appen heter Höjdkurvor överallt (sidorna, PDF:erna, IFC, info-
  filen, platspaketets `kalla`, synpunkterna). Domänen höjdkurvor.se används
  inte. Release-zippen har mappen `hojdkurvor`.
- **Flytten förberedd**: `docs/FLYTT.md` beskriver vad som krävs för
  `https://apps.danaid.cloud/hojdkurvor/` (Lantmäteriets godkännande för CORS,
  cad-apas ursprung, `cadApaUrl`, PHP och e-post, publiceringens secrets och
  `SIDA_URL`, omdirigering av gamla länkar). Appen publiceras fortfarande till
  agrellarkitektur.se/terrang/.

## 0.11.0 – 2026-10-30

Synpunkter från 30 oktober: vägar och gångvägar var för sig, ett
utkast till vägytorna, dölja och rätta enskilda träd och hus, och mer till
cad-apa.

- **Bilvägar och gångvägar var för sig**: vägarna från OpenStreetMap delas i
  bilvägar (huvudvägar, lokalgator, övriga) och gång- och cykelvägar (`slag`
  `bil`/`gang`). De hamnar i varsin DXF (`_vagar_…` och `_gangvagar_…`), i
  varsitt lager på kartan, i utskriften (egen teckenförklaring) och i 3D-vyn,
  och varje väg i platspaketet har `slag`. Trottoarer och övergångsställen
  (`sidewalk`, `crossing`) räknas som gångvägar.
- **Utkast till vägytor** (underval till Vägar, förvalt): vägytorna som slutna
  polylinjer (lagren `VAG_YTA_BIL` och `VAG_YTA_GANG`), ihopslagna i
  korsningarna och med hål i rondeller. Bredden tas ur OSM:s `width`, annars ur
  `lanes` (3,25 m per körfält), annars en schablon per vägtyp. Med Ortofoto
  ikryssat mäts bilvägarna i bilden, utan AI: var 2:a meter går appen ut från
  mittlinjen åt båda håll så länge färgen liknar vägbanans (en grå eller
  gråbrun färg tagen mitt på vägen, lokalt längs vägen), bredden och
  sidförskjutningen jämnas med en rullande median och hålls inom 0,6–1,6
  gånger schablonen; mindre än 35 % träffar ger schablonen. Ytorna slås ihop i
  ett rutnät (ett avståndsfält, 0,2 m rutor eller grövre vid stora utsnitt) och
  ritas med höjdkurvornas marching squares. Info-filen säger hur många vägar som
  fick bredden på vilket sätt. Ytorna följer med på kartan, i utskriften, i
  3D-vyn och till cad-apa (`vagytor`). `js/vagar.js`, `test/vagar.test.js`.
- **Dölja och rätta träd och hus**: klicka på ett träd i 3D-vyn för att välja
  art (gran, tall, lövträd, björk), höjd och kronbredd, eller dölja det. Takpanelen
  har *Dölj huset*. *Visa dolda (n)* visar dem igen. Valen sparas i webbläsaren
  (`terrang-tradval`, `terrang-husval`); träd känns igen på läget (inom 0,6 m),
  hus på objektidentiteten. Kartan och platsen till cad-apa följer med direkt;
  filerna, skuggstudien och info-filen när man skapar igen. Dolda träd och hus
  skärs bort ur ytmodellen innan skuggorna räknas. `js/objektval.js`,
  `test/objektval.test.js`.
- **Ortofotot till cad-apa i full upplösning**: samma bild som i zip-filen
  (högst 8 192 pixlar per sida), inte längre nedskalad till 4 096.
- **Träden till cad-apa med modellerna**: varje träd har `art`, `modell`
  (variant), `vrid` och `ljus`, och paketet har `tradmodeller` med de
  detaljerade low-poly-modellerna som används (1 m höga, trianglar och färg per
  hörn, cirka 50 kB per modell), så att cad-apa kan rita samma träd som 3D-vyn.
  Ändrade träd har `andrat: true`. `js/trad3d.js` laddas nu med sidan.
- Testdata: låtsasortofotot har två grå vägbanor längs testserverns OSM-vägar.

## 0.10.1 – 2026-10-30

Ortofotot följer med till cad-apa.

- **Ortofotot i platspaketet**: när Ortofoto är ikryssat skickas bilden med
  till cad-apa (fältet `ortofoto`: `bild` som data-URL, `x0`/`y1` mitten av
  övre vänstra pixeln, `s`, `W`, `H`, `ar`), också i platsfilen. cad-apa
  (från 0.10.31) lägger det på marken i 3D. Bilden skalas ned till högst
  4 096 pixlar på längsta sidan, som cad-apa gör med egna ortofoton; zip-filen
  har full upplösning. Licensraden nämner ortofotot. Appen säger till om
  ortofotot inte kom med. Tidigare fick det läggas in för hand ur zip-filen.

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

Rättelser och tillägg efter det första provet av 3D-vyn.

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
