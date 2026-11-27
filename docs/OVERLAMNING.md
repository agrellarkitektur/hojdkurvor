# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 28 november 2026, 0.16.5.

## Läget

- **0.16.5** 28 november (grenen `v0.16.5`): **inkorgen utan att röra testet av 0.16.4** (ägaren hann inte
  testa; beslut samma kväll) och **datamodellen för 0.17.0** under ytan. DX (strandskydd ute i sjön), DU
  (vägarna hängde sig utan tidsgräns; klockan under Skapa), DV (knappen säger Uppdatera) och DW (Kopiera
  status och logg); testas som EO–ER. Etapp 2 och 3 i granskningens etappordning: `js/kroppgeo.js`,
  `Volym3D.nyStil/nyForm/harledd/behallForm`, `Projekt.rensaPrimitiv`, projektfilen version 2. **Ägarens
  beslut 28 november**: ta inte hänsyn till det som redan är ritat (polygonerna), gör det som är bäst på
  lång sikt. Se *0.16.5* nedan och *Datamodellen* i `docs/SKISSA-I-3D.md`. Körda: alla 25 enhetstester
  (nya `kroppgeo.test.js`; utökade `platsanalys`, `vagar`, `projekt`), nya `skapalogg_test.py` i alla tre
  teman, `ui_test.py`, `projekt_test.py`, `planvy_test.py` och `rattelser_test.py` i temat ritning.
  **Inte provat**: riktiga Overpass-svar för en stor sjö (DX är prövat med påhittade strandbitar),
  iPhone, kopieringen på iPhone (`navigator.clipboard` med reserv via en textruta).

- **0.16.4** 27 november (grenen `v0.16.4`): **rättelser efter ägarens test 27 november** av 0.16.1 (DD–DJ),
  0.16.2 (DT) och de öppna punkterna från 0.14.4 (BÄ, BÖ, CA, CB). DD och CA godkända och strukna; resten
  ändrat och testas som EE–EN. Synpunkterna står ordagrant under *Inarbetat ur inkorgen* i
  `docs/SYNPUNKTER.md`. Se avsnittet *Rättelserna efter testet 27 november (0.16.4)* nedan. DK–DQ (0.16.1)
  fick inget besked och står kvar. Körda: alla 24 enhetstester (nya prov i `kropp`, `situationsplan`,
  `geodata`), `mobil_test.py` (utökat: hamburgaren, ihopfälld formatväljare, låst format, mobilvyn
  tillbaka, kartans läge) i alla tre teman, `planvy_test.py` i alla tre teman och de andra
  gränssnittstesterna i temat ritning (`ui_test.py` utökat för Se dolda). PDF:en är renderad och
  DXF:en läst med ezdxf. **Inte provat**: iPhone (hamburgaren, nypning nära ett hörn), AutoCAD,
  riktiga skydd vid Vättern, att hovringsinfon (BÖ) verkligen var canvasen (inte återskapat).

- **0.16.3** 26 november (grenen `v0.16.3`): **rättelser efter granskningen av 0.16.2** (fyra sessioner
  26 november; sammanställningen `granskning-0.16.2.md`, delrapporterna A–D och session A:s patch i
  claude.ai-projektet). Byggd i förslagets ordning: B3 först (spegelvänd horisont i sol på fasaderna,
  `Fasadsol.horisonter`), sedan patchen med `git am` (A1–A4, formuläret för A8), utsnittsgränserna 4 km²
  och 10 km och takformen, `inert` under Skapa och vyerna (D6, C1, C2, C17), C7 och C8, ritningen (B2,
  B1, P6, hörn över en sida), exporten (B5, B6, B4), småsakerna (C3, C9, C16, D9, A6) och texterna
  (D1, D2, D3). **Ägarens beslut 26 november**: inget resultat av sol på fasaderna har lämnats ut, så
  inget räknas om; byggnadsarean räknar Lantmäteriets hus på fastigheten som befintliga
  (`Kropp.byaMedHus`, fastigheten är den huvudbyggnaden står på); utsnitt i fil och länk högst 4 km²
  och 10 km, samma som appen hämtar. **P6** är löst genom att ett hus med innergård inte blir någon
  kropp; gårdar som kroppar kommer med 0.17.0. **Inte gjort ur listan**: C4, C5, C6, A5, D7, D8,
  norrpilen och C14 (kan vänta enligt granskningen), Content-Security-Policyn i `drift/apps.caddy`
  (apps-repot, Report-Only först). Körda: alla 24 enhetstester (nya prov i `fasadsol`, `kropp`,
  `projekt`, `byggnad`, `platsanalys`, `geodata`), nya `rattelser_test.py` i alla tre teman, och de
  andra gränssnittstesterna i temat ritning. **Inte provat**: iPhone, riktiga Overpass-svar för
  sjöar i flera vägar, Content-Security-Policyn mot Skapa och 3D-vyn.

- **0.16.2** 25 november (grenen `v0.16.2`, publicerad samma dag): **BS**, utsnittets format på mobilen. Formatväljaren
  `#mobil-format` (1:1, 3:2, 2:3, 2:1, Fritt) under ramen; `placeraRam()` i `app.js` sätter ramens
  läge och storlek i bildpunkter mitt mellan sökrutan och bladet (`ramYta()`), och hörnen dras
  symmetriskt kring mitten (pekarhändelser på `.hörn`, som gör formatet fritt). Valet sparas i
  `terrang-mobil-format`. Testpunkt DT. Dessutom: prototyp 7 av Skissa i 3D i
  `docs/prototyper/skissa-i-3d.html` och planen för 0.17.0 i `docs/SKISSA-I-3D.md` (förd hit från
  claude.ai-projektet), och inkorgen sorterad efter versionsplanen 24 november. **Ägarens test av
  0.16.1 (DD–DQ) fanns inte när versionen byggdes**; rättelserna efter det blir 0.16.3. Körda: alla
  24 enhetstester och `mobil_test.py` (utökat med formatet) i alla tre teman. **Inte provat**:
  iPhone (hörnen med fingret, Safari/Chrome på iOS), `ui_test.py` (inget i datorflödet är ändrat).

- **0.16.1** 23 november (grenen `v0.16.1`): svar på ägarens test samma dag av situationsplanen
  (0.16.0), sol på fasaderna (0.15.0) och BG. Se avsnittet *Planvyn och situationsplanen (0.16.1)*
  nedan. Testpunkter DD–DQ; synpunkterna står ordagrant under *Inarbetat ur inkorgen* i
  `docs/SYNPUNKTER.md`. CÖ–DC och CG–CK fick inget besked och står kvar. Körda: alla 24
  enhetstester (utökade: `kropp`, `situationsplan`, `objektval`, `geodata`, `fasadsol`), nya
  `planverktyg_test.py`, `planvy_test.py`, `situationsplan_test.py`, `fasadsol_test.py`,
  `projekt_test.py` och `ui_test.py` (ritning). Testdatan byggdes med GDAL (python3.12) enligt
  *Testmiljön*. **Inte provat**: riktiga Overpass och reservservern (testmiljön når dem inte),
  riktiga tomter med många träd (testdatans utsnitt har inga träd), stora utsnitt med ortofoto i
  planvyn (bilden ritas en gång, men den är en data-URL på några MB), DXF:en i Archicad, iPhone.

- **0.16.0** 22 november (grenen `v0.16.0`): **situationsplanen**, etapp 3 i
  `plan-skiss-situationsplan.md` (claude.ai-projektet), och ägarens synpunkt samma dag: kroppar i
  vinkel ska redovisas som en union, ett yttre skal, och visas var för sig först när de markeras.
  Se avsnittet *Situationsplanen (0.16.0)* nedan. Testpunkter CÖ–DC. Byggd utan skrivrätt (grenen
  lämnades först som git-bundle); pushad till `main` och publicerad 23 november. Körda: alla 24
  enhetstester (nytt: `situationsplan.test.js`; union, skal och BYA i `kropp.test.js`), nya
  `situationsplan_test.py` och `planvy_test.py` i alla tre teman. Testdatan byggdes med GDAL
  (python3.12) enligt *Testmiljön*. **Inte provat**: riktiga tomter med sneda gränser, utskrift i
  100 % på papper, DXF:en i Archicad, iPhone.

- **0.15.0** 22 november (grenen `v0.15.0`): **sol på fasaderna** efter `overlamning-solanalys.md`
  (claude.ai-projektet; versionsnumret och adressen där är rättade), på byggnadskropparna från 0.14.0
  i stället för skissvolymerna. Se avsnittet *Sol på fasaderna* nedan. Utredningen om
  användarskapad omgivning (`utredning-anvandarskapad-omgivning.md`) är införd i
  `docs/SYNPUNKTER.md` som önskemål: etapp 1 som 0.17.0 (CL–CV), etapp 2–4 utan version (CZ–CÄ).
  Testpunkter CG–CK; väntar: pagoda, STRÅNG, reflexer (CW–CY). Körda: alla 23 enhetstester (nytt:
  `fasadsol.test.js`), nya `fasadsol_test.py` i alla tre teman, och `ui_test.py`, `projekt_test.py`,
  `resultat_test.py`, `planvy_test.py`, `mobil_test.py`, `las_test.py`, `fastighetsnamn_test.py`
  (ritning). Testdatan byggdes med GDAL (python3.12) enligt *Testmiljön*. **Inte provat**: riktiga
  tomter med många byggnader (tiden: cirka 1,5 s per 3 500 punkter utan omgivning, mer med
  ytmodellen), iPhone, och jämförelsen med Hudiksvall på den riktiga platsen (CH).

- **0.14.4** 21 november (grenen `v0.14.4`): svar på ägarens test 20 november (AÄ–BM). AÖ, BD, BF,
  BH, BI, BJ, BM godkända och strukna; ändrat och testas som BÄ, BÖ, CA, CB; nytt i inkorgen CC–CF
  (CF: licensfrågan om dynamisk inläsning utan inloggning, med bedömning).
  1. **Skyddad natur** (BB, fortfarande 503 efter 3 försök): `Geodata.skyddadNatur(bTM, tillZon,
     llRuta, llTillZon)` hämtar `skyddadNaturOsm` (Overpass: `leisure=nature_reserve`,
     `boundary=protected_area|national_park`; protected_area bara med `protect_class` 1–7 eller
     `protection_title`) när någon av Naturvårdsverkets tjänster faller bort. Relationernas ytterringar
     fogas med `fogaRingar`. Områdena har `kalla: 'osm'`; `ut.reserv` = { antal, fel } ger varningen,
     `senaste.naturReserv` märkningen i info-filen. Ett fel via proxyn slutar på *via servern*.
     `geodata.php` skickar en webbläsarlik User-Agent. **Orsaken till 503 är inte hittad**: tjänsten
     nås inte härifrån (testmiljöns proxy spärrar geodata.naturvardsverket.se, och WebFetch fick fel
     vid GetCapabilities 21 november). Ägarens varning i BÖ säger om det är direkt eller via servern.
  2. **Sektioner utan kryssruta**: `effektivaVal().sektion` = det finns ritade sektioner. Kryssrutan
     `tillval=sektion` är borttagen ur `index.html`; äldre projekt med värdet i `tillval` läses utan fel.
  3. **Trädvalet** (`vy3d.js` `markeraTrad`: en ring vid marken; `valjObjekt(sx, sy, shift)` skickar
     `{ shift: true }` till `lyssnaTrad`; `app.js` `vaxlaUrval`, `visaUrval`). Lassots slinga töms vid
     `pointerup`. Shift vid lassots start lägger till.
  4. **Utskriften** (BE): `visaUtskriftsram` ritar kartfältet (`Utskrift.kartfalt`) i `ramPane` med
     nedtoning utanför, så länge `#lp-utskrift` är öppen; `fitBounds` när utsnittet inte får plats.
     `oppnaPdfFlik` öppnar fliken vid klicket (annars stoppas den), `visaPdfIFlik` lägger PDF:en i en
     iframe med *Spara PDF* (`a[download]`). Stoppas fliken: `valjFil`/`skrivFil` som förut.
  5. `docs/UTBYTE-CAD-APA.md`: *Analyserna och vad skissen behöver* (AÄ), med önskemål till skissens
     version 2. Inget i formatet är ändrat.
  Körda: alla 22 enhetstester (utökat `geodata.test.js`), `ui_test.py`, `las_test.py`,
  `projekt_test.py`, `resultat_test.py`, `mobil_test.py`, `planvy_test.py`,
  `fastighetsnamn_test.py` (temat ritning). Testdatan byggdes med rasterio och en ersättare för
  `osgeo` utanför repot. **Inte provat**: riktiga Naturvårdsverket och Overpass, iPhone, Safari.

- **0.14.3** 20 november (grenen `v0.14.3`): svar på ägarens test av de äldre punkterna AJ–AÅ.
  AK, AL, AS, AZ, AÅ godkända och strukna; resten ändrat och testas som BW–BZ. Frågan om att
  skicka med datan (BÅ) ligger i inkorgen med en bedömning.
  1. **Lås området** (`satLas`, `state.last`, `plats.last` i projektet, `#las-omrade`). Låst:
     inget `ramGrepp`, inga handtag, inget kryss; `#rita`, `#punkt-radie`, `#radie`, hörnen,
     `#koord-klistra` och `#zon` avstängda. `rensaUtsnitt` låser upp.
  2. **Hämtminnet** (`js/hamtminne.js`): `Hamtminne.borja({ r, epsg })` före stegen i Skapa
     lägger sig framför `window.fetch` (också geotiff:s Range-läsningar), `sluta()` i `finally`.
     Nyckel: metod, adress, Range och POST-kropp. Bara 200/206, inte `blob:`/`data:`, högst
     900 MB. Ett annat område tömmer det; `rensaUtsnitt` också. Steget `noteraHamtminne` skriver
     raden Hämtat i sammanfattningen. Knappen (`sammanfatta`) säger *igen* när minnet gäller
     området och *Uppdatera analyserna* under 04 Skiss. HEAD-frågan i `kommunfil.js` och felsvar
     går fortfarande ut. **Inte gjort**: AY:s uppdelning i Hämta (02) och Skapa analys (03) som
     egna körningar; Skapa kör fortfarande alla steg, bara utan att hämta igen.
  3. **AT**: `L.canvas` skapades per Skapa för laserpunkter och höjdpunkter och lade sig över
     standardcanvasen där ramens grepp ritades (`preferCanvas`). Nu `laserRitare` och
     `hojdpunktRitare` en gång, och ramen i `ramPane` (z 450) med en egen SVG-ritare;
     `.leaflet-ramPane-pane > svg { pointer-events: none }` så att bara greppet tar musen.
  4. **AU**: lassots slinga släcks vid nästa `pointerdown`/`wheel` i `#vy3d-yta`.
  5. **Vägytorna** (`vagar.js`): `stracker` delar linjerna där de delar en punkt med en annan
     linje av samma slag; `profil` ger en bredd per sträcka (median, 0,5 m) och en
     sidförskjutning; `utkast` ger sträckor under `KORT` (30 m) gatans längdviktade bredd
     (`kalla: 'gatan'`); `ytor` rundar hörnen med `avrunda` (stängning med radien `RADIE`
     6/1 m via exakt avståndsfält, bara inom R + bredd + 3 m från korsningarna, rutnätet utvidgat
     med R + 2 m så att vägarna når kanten). Kartans ytor har `--vag-yta`/`--vag-yta-gang`.
     **Inte gjort**: radierna mätta i ortofotot.
  6. **Bilderna**: `bild.jgw` (SWEREF) + `bild_lokal.jgw`, ingen `_sweref.jgw`.
     `SA_ANVANDER_DU_BILDERNA.txt` (steget `skrivBildguide`) och
     `ortofoto/ORTOFOTO_SOM_TEXTUR.txt` (`texturGuide`), med utsnittets mått, lokala hörn och
     vridning (`bildMatt`). Archicad och vanliga AutoCAD läser inte världsfiler; guiden säger det.
  Körda: alla 22 enhetstester (nytt: `hamtminne.test.js`, utökat `vagar.test.js`),
  `ui_test.py`, nya `las_test.py`, `projekt_test.py`, `resultat_test.py`, `mobil_test.py`,
  `fastighetsnamn_test.py`, `planvy_test.py` (se CHANGELOG). Testdatan byggdes med rasterio och
  en ersättare för `osgeo` utanför repot. **Inte provat**: riktiga vägar mot riktigt ortofoto,
  Archicad, iPhone.

- **0.14.2** 20 november (grenen `v0.14.2`, sammanslagen och publicerad): **nytt Swish-kort**
  `bilder/swish-kort.png` (nytt filnamn så att ingen cachad bild av den gamla koden visas;
  `swish-qr.png` är borttagen). Hela kortet ur ägarens PDF från Swish, 450 × 681 px med
  genomskinliga hörn, 256 färger, 15 kB; visas 150 px brett (120 px under 480 px) utan egen
  bakgrund, eftersom kortet har vit ruta runt koden. Avkodat (OpenCV, `QRCodeDetectorAruco`) till
  `https://app.swish.nu/1/p/sw/?sw=1237180615&msg=Stort%20tack%20f%C3%B6r%20att%20du%20st%C3%B6ttar%20H%C3%B6jdkurvor.se!%20%3C3&src=qr`,
  som är `SWISH_URL` i `stod.js`. **Mottagaren är Agrell Arkitektur AB** (det Swish visar vid
  signeringen; ägarens uttryckliga önskan, därför med AB fast texten syns). `kalla.test.js`
  kontrollerar mottagaren. **cad-apa är klart**: `HOJDKURVOR_ORIGINS` har hojdkurvor.se (och
  www, xn--hjdkurvor-07a.se); hojdkurvor.danaid.cloud och agrellarkitektur.se står kvar där
  och kan tas bort i cad-apa senare. Platser i sparade cad-apa-projekt länkar till
  hojdkurvor.danaid.cloud, så **Caddys omdirigering av den adressen ska stå kvar**. Höjdkurvor
  bygger sina länkar på `location.origin` och behövde ingen ändring för det. Körda: alla 21
  enhetstester; Stöd-avsnittet i alla tre teman på dator och mobilbredd. **Inte körda**:
  gränssnittstesterna (`resultat_test.py` har nya filnamnet).

- **0.14.1** 20 november (grenen `v0.14.1`): **ny adress <https://hojdkurvor.se/>** och loggan
  **höjdkurvor.se** igen. Ägaren registrerade hojdkurvor.se och höjdkurvor.se hos one.com 20
  november; apps-sessionen lade sajten på hojdkurvor.se i `drift/apps.caddy` och omdirigerar
  höjdkurvor.se, www-adresserna och hojdkurvor.danaid.cloud dit. Här: adressen i README,
  `CLAUDE.md`, `docs/FLYTT.md` (ruta överst), `docs/UTBYTE-CAD-APA.md`, `.htaccess` och
  arbetsflödena. **`SIDA` i `publicera-vps.yml` är `https://hojdkurvor.se/`**: kontrollen efter
  uppladdningen följer inte omdirigeringar, så den måste gå mot den riktiga adressen. `HOST`
  (SSH) är fortfarande apps.danaid.cloud. Länkarna som appen skapar bygger på `location.origin`
  och behövde ingen ändring. `synpunkter.php` jämför Origin med Host och fungerar på vilken
  adress som helst. Loggan: `.ordbild` med `.punkt` på alla fyra sidor, `Utskrift.ordbild` i
  PDF:erna (ritningen, skuggstudien, platsanalysbladet). Appen heter Höjdkurvor i löpande text,
  i `<title>`, i PDF:ernas `creator` och i `aria-label`. cad-apa godtar den nya adressen sedan 20 november (se 0.14.2). **Att testa**: BT–BV i `docs/SYNPUNKTER.md`.

- **0.14.0** 19 november (grenen `v0.14.0`, sammanslagen och publicerad): byggnadskroppar och planvyn, etapp 1–2 i
  `plan-skiss-situationsplan.md` (claude.ai-projektet), med ägarens ändringar samma dag:
  taksprång och tak ritas inte i plan (bara nytt/befintligt och FG), krysset betyder
  huvudbyggnad (inte takform), mått mellan kroppar i samma byggnad (ägarens skiss: tillbyggnaden
  0,3 m in från husets fasad), och måtten till tomtgräns mot bara två gränser: långsidan två mått,
  kortsidan ett. Se avsnittet *Byggnadskroppar och planvyn* nedan. Körda: alla 21 enhetstester
  (nytt: `kropp.test.js`), `ui_test.py` (ritning), `projekt_test.py`, `mobil_test.py`,
  `fastighetsnamn_test.py`, `resultat_test.py` och nya `planvy_test.py` i alla tre teman.
  Testdatan byggdes med rasterio och en liten ersättare för `osgeo` (utanför repot), som förut.
  **Inte provat**: iPhone, riktiga tomter med sneda och många gränssträckor, och stora utsnitt
  (planvyn ritar om hela SVG:n vid varje musrörelse). **Nästa**: ägarens test (BN–BR i
  `docs/SYNPUNKTER.md`; BS i inkorgen: utsnittets format på mobilen), sedan 0.15.0 = solanalysen (`overlamning-solanalys.md`) och 0.16.0 =
  situationsplanen (etapp 3).

- **0.13.6** 19 november (grenen `v0.13.6`, sammanslagen och publicerad):
  1. **BJ, resultatet sparat i webbläsaren** (`js/resultat.js`, blocket *Resultatet sparat i
     webbläsaren* i `app.js`), se avsnittet nedan. Databasen `terrangunderlag` är version 3 i
     både `projekt.js` och `kommunfil.js` (objektlagringen `resultat`).
  2. **BM, Stöd-rutan**: rubrikerna Privatpersoner och Företag ovanför, kontakten en gång längst
     ner, Swish-QR:n `bilder/swish-qr.png` (ur ägarens PDF från Swish: bara koden med loggan,
     480 px, 256 färger, 9 kB; avkodad till
     `https://app.swish.nu/1/p/sw/?sw=1237180615&msg=Stort%20tack%20f%C3%B6r%20ditt%20st%C3%B6d!&src=qr`,
     som också är länken på bilden, `SWISH_URL` i `stod.js`). Vit ruta med marginal runt koden i
     alla teman. Dialogen är 600 px (bredden låg tidigare under synpunktsformulärets 520 px).
     Under 480 px flyter texten in under koden.
  Kartlagren som ritades direkt i Skapa-stegen är utbrutna till `visaKurvor`, `visaLaserKarta`,
  `visaKartbild`, `visaFastigheter`, `visaMarktacke` och `visaStompunkter`, så att de kan ritas
  ur det sparade. Körda: alla 20 enhetstester (nytt: `resultat.test.js`), `ui_test.py` (ritning),
  `projekt_test.py`, `mobil_test.py`, `fastighetsnamn_test.py` och nya `resultat_test.py`;
  Stöd-rutan i alla tre teman på dator och mobilbredd. **Inte provat**: iPhone (Safari/WebKit
  saknas i testmiljön) och riktigt stora områden, där det sparade kan bli hundratals MB.

- **0.13.5** 19 november (grenen `v0.13.5`, sammanslagen och publicerad), efter ägarens
  synpunkter samma dag (BG–BL i `docs/SYNPUNKTER.md`):
  1. **Strandskyddet** (`Platsanalys.strandKlass`, `strandskydd`, `strandZoner`,
     `dxfStrandskydd`; steget `skapaStrandskydd` efter `skapaMarktacke`). Reglerna från 1 juli
     2025: insjöar under 1 ha (bara när ringen är sluten), bäckar (OSM `waterway=stream`, antas
     ≤ 2 m) och anlagt vatten (OSM `water=basin|wastewater`, marktäckets *Anlagt vatten*) räknas
     inte; närmaste sådant vatten inom 100 m står i texten (`ovrigt`). Linjerna 100 och 300 m
     ur ett avståndsfält (exakt EDT, Felzenszwalb) över utsnittet + 300 m, rutan 2 m eller
     grövre så att det blir högst cirka 1 miljon noder, sedan `kurvorForNiva`. Kartlagret
     `strandskydd` (färgen `--strand` i alla tre teman), DXF i `strandskydd/` och i den
     samlade. Platsanalysbladets karta ritar inte linjerna (idé).
     Marktäcket läses med `vattenMarginal: 300` när Skydd är valt och ger `m.vatten` (hela
     ytor, yttre ringen). Bara kommunerna i utsnittet läses. OSM-frågan startar i `skapaSkydd`
     (`kor.vattenOsm`) och väntas in i `skapaStrandskydd`. Marktäckets ytor saknar namn; namnet
     lånas från OSM om samma slags vatten ligger inom 15 m lika långt bort.
  2. **Tidsgränsen**: `Geodata.hamta` gör ett avbrott efter `tid` till ett fel med
     `tidsgrans: true` (*svarade inte inom N s*), och `medOmforsok` försöker igen som vid 502.
     Overpass får 40 s (`[timeout:35]`). Ingen andra Overpass-server (kräver ägarens besked).
  3. **Zip-filen** packas vid *Ladda ner* (`forberedZip` i Skapa, `packaZipNu` vid klicket,
     sparas i `state.zipBlob` till nästa Skapa). Spardialogen öppnas före packningen eftersom
     den kräver klicket. **Inte provat på iPhone**: nedladdningen startar efter packningen (BH).
  4. **STÖD** (`js/stod.js`): knapp i menyraden på alla fyra sidor, dialog med samma klasser
     som synpunktsformuläret. Texten finns bara i `js/stod.js` och fylls i Om-sidans
     `[data-stod-innehall]`. `kalla.test.js` kontrollerar Swish-rutan där.
  Körda: alla 19 enhetstester, `ui_test.py` i alla tre teman, `mobil_test.py`,
  `projekt_test.py`, `fastighetsnamn_test.py`; Stöd-dialogen i alla tre teman på dator och
  mobilbredd. **Nästa**: 0.13.6 = spara resultatet i webbläsaren (BJ).

- **0.13.4** 19 november, sammanslagen med `main` och publicerad samma dag tillsammans med
  grenen `skapa-uppdelning` (grenarna kom som en git-bundle från en session utan skrivrätt;
  enhetstesterna kördes igen före sammanslagningen). Rättelser efter ägarens test 19 november (BA och BC godkända, BB delvis; BD, BE
  och BF i `docs/SYNPUNKTER.md`):
  1. **Skyddad natur** (BD): frågan stämde inte med Naturvårdsverkets tjänster. De vill ha
     `outputFormat=GEOJSON` (inte `application/json`, som ger ett XML-fel med status 200) och
     rutan med nordvärdet först (`bbox=ymin,xmin,ymax,xmax,EPSG:3006`; med östvärdet först blir
     svaret tomt utan fel). Svarets koordinater är [E, N]. Natura 2000 har fälten
     `OMRADESNAMN`, `OMRADESKOD`, `OMRADESTYP` (SPA, SCI). **Kontrollerat mot de riktiga
     tjänsterna** 19 november med webbhämtning (GetCapabilities och GetFeature för båda), men
     appen är inte körd mot dem i en webbläsare: CORS är inte prövat. Se `Geodata.wfsUrl`.
  2. **Nya försök** (BD): `Geodata.medOmforsok` och samma sak i `Vagar.hamta`: 429, 502, 503
     och 504 ger två nya försök efter 2 och 5 s (testkrok `TERRANG_PAUSER`). Ingen andra
     Overpass-server är inlagd; det vore nästa steg om 502 fortsätter (kräver ägarens besked,
     det är en ny tjänst att lita på).
  3. **Namnbyte utan nytt Skapa** (BE): `input` på `#projekt` anropade `nollstallResultat`.
     Nu `namnBytt()`: `state.senaste.projekt` får det nya namnet (utskrifterna läser det),
     `projektSkapat` minns det som zip-filen har, och hjälptexten under fältet säger det.
  4. **Laserdatan ruta för ruta** (BF): se avsnittet nedan. Ägarens misstanke stämmer med
     koden (över 6 miljoner punkter kastades all laserdata, med en varning på statusraden),
     men det är **inte återskapat på riktig data**: testlandskapet har bara 0,8 miljoner
     punkter. BF under *Att testa* är det riktiga provet.
  Körda: alla 19 enhetstester, `ui_test.py` i temat ritning (inte lugn och mork: inget i
  temana är ändrat), `mobil_test.py`, `projekt_test.py`, `fastighetsnamn_test.py`. Zip-filen
  ur gränssnittstestet är jämförd fil för fil med 0.13.3: alla DXF-, CSV-, LAS-, XYZ- och
  bildfiler är identiska, också träden.

- **Grenen `skapa-uppdelning`** (från `v0.13.4`, sammanslagen i 0.13.4, ingen egen version
  och inget i CHANGELOG: inget syns för användaren): granskningens punkt 7. Skapa-flödet i
  `app.js` var en funktion på 860 rader och är nu 23 funktioner (den längsta 107 rader), se *Skapa-flödet i
  steg* nedan. Uppdelningen är gjord mekaniskt med ett skript som läste koden (variablerna
  som delas mellan stegen flyttades till körningens objekt), inte för hand. Körda: alla 19
  enhetstester, `ui_test.py` (ritning), `projekt_test.py`, `mobil_test.py`. Zip-filen ur
  gränssnittstestet är jämförd med `v0.13.4`: samma 55 filer, och alla utom dem med klockslag
  eller slumpat id i sig (info-filen, PDF:erna, IFC, projektfilen) är identiska byte för byte;
  PDF:erna har samma storlek och skiljer på ett sextiotal byte (datum och id). Felvägarna är
  prövade i webbläsaren: saknad inloggning, fel lösenord (felet visas, knappen och
  projektlåset släpps, vridningen nollställs) och egen vridning. **Inte prövat**: avbrottet
  när analysområdet blir över 6 km² (går bara att nå med långa sektioner eller en avlägsen
  horisontpunkt); den vägen är läst.

- **0.13.3** 19 november: granskningens rättelser (grenen `granskning-2026-11-19`) och
  `qr-ruta` (platshållaren för Swish-QR:n, copyrightraden `Agrell Arkitektur AB`) är
  sammanslagna och släppta. Rättat på granskningsgrenen: sektionens namn skrevs som HTML i
  kartans tips (en projektlänk eller projektfil kunde köra skript på sidan), sektioner ur en
  projektlänk ritades inte förrän sidan laddades om, `Projekt.las` tål fält av fel sort,
  trädvalen ger inte längre tvillingar (`Projekt.slaIhopTradval`), `geodata.php` och
  `stac.php` sparar bara lyckade svar, arbetsflödena har bara de rättigheter de behöver.
  Dessutom punkt 1–3 under *Väntar på besked* i rapporten (`granskning-0.13.2.md` i
  claude.ai-projektet), efter ägarens besked:
  1. `synpunkter.php`: tak på 30 i timmen för alla tillsammans (`MAX_ALLA`, räknarna under
     ett gemensamt lås i temp-mappen) och `franEgenSida()`: `Sec-Fetch-Site` ska vara
     `same-origin` om det finns, och `Origin` (annars `Referer`) ska ha samma värdnamn som
     `Host`. Anropet ska vara `application/json`. Provat mot en lokal PHP-server med
     låtsasbrevlåda, **inte på VPS:en**: Caddy måste lämna `Host` orört (det gör
     `php_fastcgi` som standard). Se BA i `docs/SYNPUNKTER.md`.
  2. `geodata.php`: PHP följer inte omdirigeringar själv; varje steg hämtas för sig och
     målet ska vara https på en av vitlistans servrar (`omdirigering()`), högst två steg.
     Värdnamnet prövas, inte hela vitlistans början på adressen, så att en tjänst som
     hänvisar till en annan sökväg på samma server inte slutar fungera. Provat med en kopia
     mot låtsastjänster på localhost, inte mot de riktiga tjänsterna. Se BB.
  3. `lasProjektbyte(på)` i `app.js` sätter `state.skapar` och låser Nytt projekt, Öppna
     projektfil, Läs in igen, Importera skiss och de andra projekten i listan från att
     Skapa startar till `finally`. `bytetLast()` stoppar `nyttProjekt`, `oppnaProjektfil`,
     `oppnaFranDb`, `laddaSkiss` (också från cad-apa) och Ta bort av det öppna projektet,
     med ett besked på projektets statusrad (`visaProjektbesked`, står kvar sex sekunder).
     Prov i `projekt_test.py`. Se BC.
  Testdatan byggdes utan GDAL med en liten ersättare för `osgeo` ovanpå rasterio (utanför
  repot); enhetstesterna, gränssnittstestet i alla tre teman, projekttestet,
  fastighetsnamnstestet och mobiltestet är körda. **Kvar ur rapporten**: punkt 4–11 under
  *Väntar på besked* (ägaren har inte sagt något om dem), och listorna till apps- och
  cad-apa-projekten, som ska tas i de sessionerna. **Nästa version** är 0.14.0, sol på
  fasaderna; dela gärna upp Skapa-flödet först (punkt 7).

- **0.13.2** 19 november: licensbytet till AGPL-3.0-or-later och avsnittet
  Stöd utvecklingen på Om-sidan, efter `docs/LICENS.md` (samma beslut som i
  cad-apa 0.12.5.4). Länken *Källkoden* (`js/kalla.js`) får commiten inskriven
  av `publicera-vps.yml` och `release.yml`. `THIRD_PARTY.md` heter nu
  `THIRD-PARTY.md`. Inget nytt i kartan. Kvar för ägaren: CLA Assistant,
  juristen och Swish (se `docs/LICENS.md`). Gränssnittstesterna med testdata
  kördes inte (testmiljön saknade GDAL och copclib för testdatan); sidorna är
  provade i Chromium utan fel och skärmbilderna av Om-sidan är kontrollerade.
  Efteråt (samma dag, bara dokument): CLA.md märkt som utkast, med Agrell
  Arkitektur AB genom sin firmatecknare som avtalspart. **Nästa version** ska
  ta med grenen `qr-ruta`: en platshållare för Swish-QR:n i Stöd utvecklingen
  på `om.html`, och copyrightraden `Agrell Arkitektur AB` i alla källfiler
  (bolagsformen, se `docs/LICENS.md`). Den är inte publicerad. Slå ihop den
  med versionsgrenen och skriv båda i CHANGELOG.

- **0.13.1** 19 november: flytten är klar. `cadApaUrl` är
  `https://cad-apa.danaid.cloud/` (cad-apa godtar redan
  hojdkurvor.danaid.cloud i `site.ts`). FTP-publiceringen är borttagen; appen
  publiceras bara på VPS:en. Den gamla adressen stängs av helt, utan
  omdirigering och utan varning (ägarens beslut: ingen publik än), med Actions
  → *Stäng av webbhotellet*. Taggar och releaser skapas av `release.yml` vid
  varje push som ändrar `js/version.js`. AX: *Hämta från kartan* vid Projekt
  eller fastighet. Inte testad av ägaren (AÄ, AÖ).

- **0.13.0** 18 november: projektfilen, etapp 1 och 2 i `plan-projektfil.md`
  (claude.ai-projektet). Projekt i IndexedDB med autospar, Senaste projekt,
  Nytt projekt, projektfil `.hojdkurvor` (zip med `projekt.json` och
  `bilagor/`), dra-och-släpp, projektfilen i nedladdningszippen, frågan när fil
  och webbläsare är oense, flera flikar, flytt från sessionStorage. Formatet i
  `docs/PROJEKTFIL.md`. Dessutom AG: skissens DXF har väggar och tak (3DFACE).
  Testresultaten 18 november (AA, AD, AE, AG, AH, AI) är införda i
  `docs/SYNPUNKTER.md`; 3D på telefon är inte längre aktuellt. Enhetstester
  gröna, gränssnittstestet och `projekt_test.py` godkända i alla tre teman,
  mobiltestet godkänt. Inte testad av ägaren (AZ, AÅ).

- **0.12.2** 17 november: skuggstudien i platsanalysen på ett A3-blad med ram
  och ritningshuvud, husens fotavtryck och skissade volymer som linjer i
  skuggrutorna (båda skugg-PDF:erna). `docs/SYNPUNKTER.md` har fått löpnummer
  (AA, AB …) och är grupperad efter version. Ägarens namn är borttaget ur
  dokumentationen; skriv det inte i repot (se CLAUDE.md). Synpunkterna går med
  e-post från VPS:en (FLYTT.md steg 5, klart). 0.12.1 är provad: soldiagrammet
  med horisont fungerar.
- **0.12.1** 17 november: inkorgen 17 november utom fastighetsnamnet (står kvar
  i inkorgen). Soldiagrammet med horisont, platsanalysen i zip:ens rot,
  solbladet på A3 med ram, ingen DXF för skuggor, lutning och skyfall. Se
  avsnittet nedan. Enhetstester gröna, gränssnittstestet godkänt i alla tre
  teman, mobiltestet godkänt. Publiceras på båda adresserna.
- **0.12.0** 15 november, publicerad samma dag på agrellarkitektur.se/terrang/:
  inkorgen 1–15 november. Byggt: lutning och skyfall
  som JPEG + jgw och vektor-PDF, samlad DXF i roten, vägytorna märkta som
  beräknade och mer utjämnade, Punkt och radie, dra i ramen, lasso i 3D-vyn.
  Sorterat till planerna (se `docs/SYNPUNKTER.md`): eget bildunderlag
  (projektfilens bilagor), skissvolymer ur inskannat underlag, html-visaren och
  DXF med xref/ortofoto. Appen heter bara **Höjdkurvor**; flytten till
  `hojdkurvor.danaid.cloud` är förberedd i `docs/FLYTT.md` men inte gjord.
  Enhetstester gröna, gränssnittstestet godkänt i alla tre teman, mobiltestet
  godkänt.
- **Versionsplanen flyttades ett steg** (15 november): 0.12.0 blev inkorgen,
  projektfilen blir **0.13.0** och sol på fasaderna **0.14.0**. Planerna i
  claude.ai-projektet (`plan-projektfil.md`, `overlamning-solanalys.md`) är
  uppdaterade. Rättelser efter testet blir 0.12.x.
- **0.11.0** 30 oktober (gren `v0.11.0`): fyra synpunkter i
  inkorgen 30 oktober, alla inarbetade (inkorgen är tom):
  1. bilvägar och gångvägar var för sig (filer, kartlager, 3D-lager, utskrift,
     `slag` i platspaketet),
  2. utkast till vägytor med bredden mätt i ortofotot, utan AI,
  3. dölja och rätta enskilda träd och dölja hus i 3D-vyn,
  4. ortofotot till cad-apa i full upplösning och träden med art, modell och
     de detaljerade modellerna (`tradmodeller`).
  Se avsnitten nedan. Enhetstester gröna; gränssnittstestet godkänt i alla tre
  teman och mobiltestet. Inte testad av ägaren; listan står under *Att
  testa* i `docs/SYNPUNKTER.md`.
- **0.10.1** 30 oktober: ortofotot i platspaketet. Nedskalningen till 4 096 px
  togs bort i 0.11.0.
- **0.10.0** 29 oktober: modellera volymer i 3D-vyn, egen takform per
  befintligt hus och stiliserade träd. Inte testad av ägaren än.
- **0.9.0–0.9.2** (29 oktober): skuggor, konturer, färger, ögonhöjd, bilder,
  takformer ur laserdatan. 0.9.2 är provad på Windows: taken ser
  generellt bra ut.
- **0.8.1** godkänd på Windows 27 oktober. iPhone (två fingrar i 3D) är
  fortfarande inte testad.

## Ägarens svar 28 november (natt), inte byggda

Svar på frågorna efter 0.16.5 (punkt 1–3; 4–10 väntar på svar):
1. **Norrpilen**: sann nord på situationsplanen ("kanske lika bra med true north"). Pilen vrids med
   meridiankonvergensen i planens mitt, i PDF och DXF och i planvyn.
2. **Ägarens namn**: står Agrell Arkitektur på Om-sidan behöver namnet inte stå där. Ta bort det ur
   `om.html` och `docs/LICENS.md`.
3. **Beställ-sidan**: håll inne med de underlag och analyser som kräver prövning hos Lantmäteriet
   (ortofoto, byggnader, fastighetsindelning). Ingen ändring.

Kvar att fråga (4–10): skyfall på kropparna och nybyggnadskartan i versionsplanen; biblioteket direkt
efter 0.17.0 eller efter 0.20.0; skärmtakets höjd i lutande terräng; källrad för användarmodeller i
utskrifter; iPhone i 3D-vyn (ett finger snurrar i Visa, skissa bara på datorn); strandskyddet när
utsnittets mitt ligger i vattnet; sorteringen av inkorgen (DR, DS, DY, DZ/EA/ED, EB, EC).

## 0.16.5

- **Strandskyddet (DX)**: `Platsanalys.strandZoner` samlar vatten med `yta && sluten === false` (klippta
  strandbitar ur `Geodata.vatten`; en sjö som är en enda väg räknas nu också som `yta`) och anropar
  `fyllKlipptVatten`: bitarna förlängs ut över rutnätet och ritas som väggar, ytorna mellan dem märks med
  4-grannar, grannar över en vägg (väggrutor med exakt två ytor runt sig) får olika färg, och ytan med
  utsnittets mitt är land. Det andra blir vatten (avstånd 0). Går färgningen inte ihop görs inget. Fungerar
  också för en sjö som går in och ut genom rutan flera gånger och för en udde mellan två sjöar (prov i
  `platsanalys.test.js`). Ligger utsnittets mitt i vattnet blir det fel; det är inte hanterat.
- **Vägarna (DU)**: `Vagar.hamta` har en tidsgräns per fråga (`TERRANG_OVERPASS_TID`, 40 s) och provar
  reservservern efter en tidsgräns, utan nya försök mot samma server. Felet blir en varning i
  `skapaVagar` som förut. Andra Overpass-frågor (`Geodata.overpass`) hade redan tidsgräns.
- **Klockan och loggen (DU, DW)**: blocket *Klockan och loggen under Skapa* i `app.js`. `startaKlocka` i
  lyssnaren på `#skapa`, `klockSteg(namn)` före varje steg (namnen ur `STEG_NAMN`, som nu har alla steg),
  `stoppaKlocka` i `finally`. `visaStatus` skriver till loggen under Skapa; ett stegs namn skrivs först när
  något händer i det (`vantande`), och *klart på* bara när steget tog minst 1 s eller skrev något.
  `#status-klocka` uppdateras varje sekund och säger *väntar sedan N s* efter 15 s. `#kopiera-logg`
  (`loggText`): version, webbläsare, området (mitt och storlek, ingen inloggning), status,
  sammanfattningen, loggen och `felLogg`. Variablerna är `var`, eftersom `visaStatus` anropas tidigt.
- **Uppdatera (DV)**: `sammanfatta` sätter knapptexten och `#skapa-hjalp` när hämtminnet gäller området.
- **Kropparna**: se *Datamodellen (byggd i 0.16.5)* i `docs/SKISSA-I-3D.md`. Kortversion: `Kroppgeo`
  (ren, UMD) har prototypens funktioner och `tillProto(v)` som vänder `v` till prototypens `lz`;
  `harledd` ger `{ ringar, mesh: { pos, index, del }, golv, topp, sockel }` med normalerna utåt (stråle
  per triangel, `orientera`). `Volym3D.uppdatera` går till `uppdateraNy` för nya kroppar (utom block med
  raka gavlar, som behåller dagens rektangel så att hörnens ordning är densamma). `nyForm(v)` = det går
  inte att säga med dagens fält; då är `plan` null, `takytor` null (3D-vyn ritar taket i rutnät ur
  `hojdVid`) och `hojdVid`, `inutiVolym`, `topp` går till meshen (cache i en WeakMap). `Kropp.satHorn`,
  `satFotavtryck` låter `nyForm` vara, `satTakform`, `satNock` låter `nyStil` vara. `Projekt.las`
  rensar primitiven och räknar fotavtrycket för en ny kropp som saknar det. `laddaSkiss` använder
  `Volym3D.behallForm`. `index.html` laddar `kroppgeo.js` före `volym3d.js`.
- **Nästa för 0.17.0**: etapp 4, analyserna på `harledd` (skuggor och skyfall via `hojdVid` och ringarna
  med hål, sol på fasaderna via meshens väggar, BYA och skal ur ringarna, DXF, IFC och platspaketet ur
  meshen). Jämför mot dagens resultat för de fyra gamla takformerna; de ska bli lika (provet för prisma
  i `kroppgeo.test.js` visar att taket redan är det).

## Rättelserna efter testet 27 november (0.16.4)

- **DF, DXF:en 0 kB**: `Situationsplan.dxf` räknade utbredningen med `Math.min(...pts)` över alla punkter;
  med höjdkurvorna (hundratusentals) sprängdes stacken. Felet kom efter `valjFil`, som redan hade skapat
  filen. Nu en slinga, och `skapaSituationsplan` bygger DXF:en före spardialogen och visar felet på
  statusraden. Sök efter fler `Math.min(...` på stora listor om liknande dyker upp (`kropp.js`,
  `planvy.js` har bara små listor).
- **Ramen (DF)**: `S.ramCentrum` i planvyn (zonen), till appen med `opt.ramCentrumAndrad`, i projektet som
  `projekt.ramCentrum` (SWEREF 99 TM; `Projekt.las` kontrollerar punkten). Planvyn drar i
  `.pv-ramgrepp` (osynlig bred kant). `Situationsplan.rutor(opt)` kör `rama()` (det som pdf() ritar runt
  planen, utbrutet) med ett låtsasdokument (Proxy) som skattar textbredder och samlar fyllda
  rektanglar; planvyn räknar om dem i `allt()` (`raknaRamRutor`, med ett tunt underlag för
  teckenförklaringen), inte vid varje musrörelse, och ritar dem som `.pv-ramdold`.
- **Etiketterna (DI)**: `Situationsplan.etikettText(e, volymer, mm, marken, enh)` ger texterna (namn fett 2,6
  mm, FG och area 2,0 mm, radavstånd 3,0 mm), rutorna och ledarna; både `ritning()` och planvyn använder
  den. Får texterna inte plats provas åtta riktningar ut från byggnaden, bort från de andra enheterna;
  ledaren är `ledarGeometri`. Planvyn ritar texter, mått, entrépilen, tecknen och koordinatnumren i
  ritningens mått (`MM()` = skalan/1000, `pxmm(h)`), halon i em.
- **Vridna texter i PDF (DI)**: jsPDF flyttar texten för `align` och `baseline` i sidans riktning, inte
  textens, så en vriden text hamnade bredvid sin punkt. `skrift` i situationsplan.js och `text`/`halo`
  i utskrift.js (`ankare`) räknar punkten själva och sätter texten vänsterställd på baslinjen.
- **Måtten (DG, DH)**: gränsmåttets anteckning kan ha `mot: [gräns, sträcka]` (index i `granser`); måttet
  dras då till den sträckan om hörnet når den vinkelrätt. Planvyn: `mattDrag.kan` gäller också
  gränsmått, `dragMatt` föreslår närmaste gränssträcka (`kanter()` har `gi`, `si`). Vinkelrätsymbolen är
  en linje med tre punkter i lagret MATT. En befintlig enhet får yttermått bara på `fogsidor` mot
  tillbyggnader, med `bas` = tillbyggnadens djup, så att måttlinjen hamnar utanför den.
- **Dockning (DH)**: `Kropp.dockning(v, fotavtryck, { maxAvst, maxVinkel })` ger vridning och flytt;
  planvyn (`dockaTillbyggnad`) dockar efter flytt och vid status Tillbyggnad mot befintliga kroppar och
  Lantmäteriets hus inom 0,6 m eller 24 px.
- **Tecknen (DG)**: `Kropp.planmarke` gör andra former än fyrhörningar i den omskrivna rektangeln längs
  nocken eller längsta sidan, klippt mot fotavtrycket (`Kropp.klippLinje`). `Kropp.rivsKryss(ringar,
  indrag)`: 45° mot rutnätet genom tyngdpunkten, lagret RIVSKRYSS (DXF: SITPLAN_RIVS). Nya byggnader
  skrafferas som tillbyggnader och fylls vitt; teckenförklaringen slår ihop raderna.
- **Koordinatlistan (DJ)**: `numreradeHorn(enh, volymer)` ger `grupp` = `Kropp.beskrivning(kroppar,
  volymer)` och namnet; nya, tillbyggnader och befintliga. PDF:en sätter en rubrikrad per grupp.
- **Mobilen (DT)**: `.meny-knapp` i alla fyra sidhuvuden, `kopplaMeny` i `tema.js`, `.toppmeny.meny-oppen`
  fäller ut `#huvudmeny`. `#mobil-format-knapp` fäller ut `#mobil-format` (`mobilFormat.oppen`). Låst format:
  `mobilFormat.andel` (0,25–1 av största ramen); hörnen ändrar bara storleken. Två fingrar (`touchstart`
  med fler än en beröring) avbryter ett hörndrag och återställer ramen. Kartans läge i
  `terrang-mobil-vy`, läses efter `startaProjekt` när inget område finns. `#mobilvy-flyt` och
  `[data-mobilvy]` i menyn visas i hela verktyget på mobilen.
- **Skydd (DE)**: `Geodata.klippRingar` (Sutherland–Hodgman ring för ring) i `skapaSkydd`, utsnittet + 50
  m; `o.klippt` står i infon. Naturvårdsverkets WFS lämnar hela geometrin, så hämtningen är lika stor.
- **Hovringen (BÖ)**: `kurvRitare` och `laserRitare` ligger i panen `ickeMusPane` (z 390,
  `pointer-events: none`); `hojdpunktRitare` är borta (höjdpunkterna har info och ritas med kartans
  canvas). Ägarens iakttagelse att F5 inte hjälpte men ett nytt fönster gjorde det är inte förklarad.
- **Se dolda (CB)**: `Vy3D` har `seDolda(pa)` och `husDolt(id)`. Dolda träd ritas som spöken
  (`spokTrad`, `doldMat`) och går att välja; dolda hus läggs tillbaka i husLager med `doldMat`
  (`userData.doldVisning` håller materialet). Appen: `#vy3d-dolda` växlar läget, trädpanelen och
  husets panel säger *Visa* för ett dolt, lassot har `#lasso-visa`. Läget slås av när inget är dolt.
- **Skriv ut i skala (BÄ)**: `prFlytt` = { nyckel (utsnittet), c } i appen, `prCentrum()` klampar mitten
  till utsnittet; `Utskrift.kartfalt(…, centrum)` och `Utskrift.plan({ centrum })`. Ramen dras med en
  osynlig bred kant i `ramPane`, musen följs på `document`. Kryssen är svarta 4 mm, streck 2,5 mm vid
  ramen på alla fyra sidor, östvärdena lodrätt vid överkanten och nordvärdena vågrätt vid vänsterkanten,
  centrerade på linjerna med halo.

## Planvyn och situationsplanen (0.16.1)

- **Underlaget i planvyn** (`opt.underlag` = { ortofoto: { url, x0, y1, s, W, H }, kurvor, trad,
  vagar, skydd }): `byggUnderlag()` ritar `g.pv-under` en gång, i zonens koordinater minus
  utsnittets hörn (`O`), och `satUnderTransform()` sätter en `matrix(z 0 0 −z …)` vid varje
  `rita()`. Linjerna har `vector-effect="non-scaling-stroke"`. Det dynamiska ligger i `g.pv-dyn`
  (förut `svg.innerHTML`). Valen ligger i `S.visa` (orto, kurvor, trad, vagar, skydd, matt,
  koordlista …) och sparas av appen i localStorage `terrang-planvy-visa`.
- **Situationsplanen** (`Situationsplan.ritning`): `data.underlag` och `visa` ger lagren KURVA (med
  KURVTEXT på hela meter, en per kurva längre än 40 mm), VAG (ytor om de finns, annars linjer), STRAND,
  NATUR, LAMNING och TRAD (`R.cirklar`). PDF:en ritar lagren i `UNDER` före byggnaderna.
  Gränserna kommer efter byggnaderna. `visa.matt === false` hoppar över måtten. Markeringen i plan
  (`Kropp.planmarke`, indrag 1,5 mm på papperet, 8 px i planvyn) och skrafferingen klipps runt
  texternas rutor (`utanforRutor`); planvyn lägger `pv-textbak` bakom texterna i stället.
  `numreradeHorn` ger koordinatlistan (`R.koordlista`, KOORDNR), som PDF:en ritar ovanför
  teckenförklaringen (`koordinatlista`, spalter om 56 mm, högst 12 rader per spalt) och DXF:en som
  text till höger om planen. `ledarGeometri` ger ledarens linje med hylla, pil och textpunkt; DXF-texter
  kan vara vänster- eller högerställda (`just`). Teckenförklaringen får två spalter över nio rader.
- **Verktygen** (`planvy.js`): `vridmot` (två klick; `S.vm` = sidan och punkten; vridningen är den
  minsta som gör sidorna parallella), `ledare` (två klick och `.planvy-textin`, som öppnas efter
  mousedown med `setTimeout`, annars tar mousedown fokus), `trad` (`opt.tradAndrat` →
  `tradIPlan` i `app.js`: `Objektval.nyttTrad`/`sattTrad` i `terrang-tradval`, sedan
  `objektAndrat`), `fast` (`opt.fastighetVid`: det senaste underlaget, annars `fastigheterVid`).
  Ledarna är med i ångra (`ogonblick` = { v, l }) och går till appen med `opt.ledareAndrad`, som
  sparar dem i `state.ledareTM` (SWEREF 99 TM) och projektet (`inmatning.ledare`).
- **Kroppen**: `slag` (`Kropp.SLAG`, `slag`, `satSlag`; `normalisera` håller `huvudbyggnad` i
  takt) och `takutdrag` = [bak, fram]. `Volym3D.utdragen(v)` flyttar gavlarnas hörn längs nocken
  (`nockAxel`); `Kropp.for3d` = forAnalys + utdragen och används i skuggorna, skyfallet,
  horisonten och sol på fasaderna (inte i platsanalysbladets plan). 3D-vyn drar ut i `byggVolym` och
  i konturernas `synligaKanter`. `Kropp.anslutTak` provar 0,05 m i taget till 40 m tills spetsen,
  takfoten och mitt på takfallen strax innanför gaveln är inne i en annan kropp (+ 0,05 m), bara vid
  gavlar som ligger an. Skärmtak: tunn platta och stolpar i `byggVolym`; inga fasadpunkter, men
  skuggar som en kropp.
- **Egna träd**: trädval med `ny: true` som inte rättar ett laserträd läggs sist i
  `Objektval.tillampaTrad`. I 3D-vyn ligger de efter laserträden i `trad3d`; `sparaTrad` och
  lassot tar trädet självt när index saknas i `tradAlla`.
- **Sol på fasaderna** (`fasadsolblad.js`): översikten kräver `opt.punkter` och `opt.volymer`
  (appen skickar `punkter` och `volA`). `axonometri(ruta, mot)` ritar väggar (panel + punkternas
  rutor + nummer) och takytor (utan gavlar, ton efter ljus från nordväst) som enheter sorterade
  bakifrån. Över åtta fasader blir vyerna lägre och korten två rader; fler än 16 går till nya sidor.
  `senaste.fasadsol` har `punkter.f` och `fasadNr`, och 3D-vyn sätter nummer (sprites) på väggarna.
- **BG**: `Geodata.overpass(q)` (huvudservern, sedan `overpassReserv`), `osmDelar` för `out geom(ruta)`.
- **Inte gjort**: flytta gränsmått och texter, symboler, ortofotot på PDF:en, ändra trädens storlek
  i planvyn (görs i 3D-vyn), takanslutning för valmade tak mot valm (fungerar men inte provat),
  pulpettak.

## Situationsplanen (0.16.0)

- **Union och skal** (`js/kropp.js`): `union(polys, tol = 2 mm)` delar varje sida där den möter en
  annan polygons sidor (också hörn som ligger på sidan), tar bort delar inuti en annan polygon och
  fogar (motriktade sidor som sammanfaller), behåller en av två lika riktade sidor som sammanfaller
  och fogar resten till ringar (moturs yttre, medurs hål; vid ett hörn med flera vägar den som
  svänger mest åt höger). `horIhop(A, B)`: sidor som korsar varandra, ett hörn, en sidmitt eller
  mitten inuti den andra, eller en fog. `skal(volymer)`: union–find över kroppar med **samma
  status** som hör ihop; ett hörn gemensamt räcker inte. `bya` räknar unionens area
  (tillkommande = alla utom rivs minus befintliga).
- **Enheterna** (`js/situationsplan.js`, `Situationsplan.enheter(volymer, { oppen })`): ett skal per
  byggnad, eller kropparna var för sig i skalet där `oppen` (den markerade kroppen) ingår. Planvyn
  ritar enheterna som `path` med `fill-rule="evenodd"`; de öppna har klassen `pv-oppen`
  (halvgenomskinlig fyllning, de omarkerade streckade). Kartans lager ritar `Kropp.skal`.
- **Måtten** (`Situationsplan.matt`) räknas med `Kropp.gransmatt`, `yttermattSidor` och
  `relativaMatt` på enheternas yttre ring (låtsaskroppar `{ id, fotavtryck, e }`), så att fogarna
  inom en byggnad försvinner av sig själva. Varje mått har `nyckel`, `agare` (enhetens första kropp
  i bokstavsordning), `off` och `dold` ur ägarens fält `matt[<enhet>|<nyckel>]`, och `andra`:
  `{ flytta, kroppar }` (gränsmått och mått mellan byggnader: kropparna och deras länkade flyttas)
  eller `{ kropp, i, l }` (yttermått: kroppens sida, bara om skalets sida slutar i kroppssidans
  slut, `sidaIKropp`) eller null. Planvyn: klick på en måttext öppnar rutan med *Dölj*; drag
  (yttermått och mått mellan byggnader) sätter `off` i meter. `satAnnot`, `visaDolda`.
- **Ritningen** (`Situationsplan.ritning(data, { skala })`): linjer, ytor, texter och pilar i zonens
  koordinater med papperets mm för bredder och texthöjder; `pdf` och `dxf` ritar den. Etiketter
  (`etiketter`): namn och FG längs längsta sidan; skilda golv i samma byggnad ger FG per kropp i den
  del som inte täcks av de andra (`friDel`, 16 × 16 prov). Namnet bara om det ryms, FG och RIVS
  alltid (med vit kant om de inte ryms). Skrafferingen 45° med 1,2 mm på papperet.
- **PDF** (`pdf`): A3/A4, liggande/stående, 1:400/1:500. Fältet är papperet minus 20 mm till
  vänster och 10 mm runt om; byggnadernas mitt (`mitt`) hamnar lite ovanför fältets mitt (`ram`).
  Ritningshuvudet nere till höger, teckenförklaringen ovanför (bara det som finns), upplysningen
  och skalstocken nere till vänster, norrpil (rutnätets nord) uppe till höger. Typsnitten som i de
  andra PDF:erna (`Utskrift.nyttDokument`, `ordbild`, `marke`).
- **DXF** (`dxf`): R12 i zonen, lager `SITPLAN_*`. `Dxf.skriv` har fått `vinkel` (grupp 50) och
  `centrerad` (72 = 4 med 11/21/31) för texter.
- **app.js**: `skapaSituationsplan(typ, d, und)` (PDF i ny flik som *Skriv ut i skala*, DXF med
  `valjFil`/`skrivFil`); planvyn får `ram` (localStorage `terrang-situationsplan`), `uppgifter`
  och `satUppgifter` (projektets `fastighet`, `uppdrag`, `ritadAv`, `ritningsnummer`; fastigheten
  föreslås ur `#projekt`) och husen utan de ersatta. `laddaSkiss` behåller `matt` som de andra
  fälten som inte följer med cad-apa.
- **Inte gjort**: flytta gränsmått (bara dölja), flytta texter, välja ramens läge själv (den följer
  byggnadernas mitt), symboler (infart, parkering, sopkärl, VA, LOD), nybyggnadskartan som låst
  underlag (etapp 5), skattade tak för befintliga hus, förslagen.

## Sol på fasaderna (0.15.0)

- **Beräkningen** (`js/fasadsol.js`, `Fasadsol`, ren, UMD med `Volym3D` och `Sol`; testas i
  `test/fasadsol.test.js`, tänkt att kunna tas rakt av till cad-apa):
  1. `punkter(volymer, { steg: 1, mark, konv })`: per sida i fotavtrycket (moturs, normalen utåt)
     kolumner på cirka 1 m och rader upp till väggens topp (takfoten, gavlarna upp till taket via
     `Volym3D.hojdVid` strax innanför väggen). Punkter under marken och punkter inne i en annan
     kropp (0,1 m utanför väggen, `Volym3D.inutiVolym`) räknas inte; fogen mellan två kroppar blir
     alltså ingen fasad. Varje punkt har sin area (`w × h`). Fasaderna har sant azimut och
     väderstreck (N 315–45°, Ö, S, V).
  2. `hinderraster(volymer)`: kropparna som höjdraster med 0,5 m rutor och vilken kropp som är
     högst i rutan. `rensaUnderKroppar(yta, volymer)`: ytmodellen med marken i stället för det som
     står på kropparna (plus 1 m), så att gamla tak och buskar inte skuggar kroppen.
  3. `horisonter(pts, { yta, vol }, { azSteg: 2, maxAvst: 150, start: 0,75 })`: horisonten framför
     varje punkt (90 vinklar i halvplanet framför fasaden), i tre steg på samma gång: `egen` (bara
     kroppens egna rutor, för inbuktade fotavtryck), `vol` (alla kroppar) och `alla` (kropparna och
     ytmodellen, bilinjärt). Steget börjar 0,75 m ut, så att väggens egna rutor (0,5 m) aldrig
     träffas. Ger också `sedd`, himlens andel (0,5 fri), ur `alla`.
  4. `berakna(pts, fasader, { lat, lon, konv, ar, period, tid, fjarr })`: varje dag i perioden och
     varje timme (svensk tid, mitt i timmen, `Sol.lokalTillMs`) med solen över horisonten:
     `klarHimmel` (ESRA, Linke 3) och `motFasad` (direkt, Hay–Davies, mark albedo 0,2). Summa och
     lokal topp per punkt räknas bara under tiden (kl. 8–17 = timmarna 8–16), samtidig topp per
     fasad och per grupp (kropp och väderstreck) likaså. `matris` (dagar × 24, areaviktat W/m²)
     har alla timmar, för timme × dag-diagrammet. Värsta dygnet = dagen med den samtidiga toppen.
     Skuggningen: direkt sol med bara `egen` mot `vol` mot `alla` (och den fjärran horisonten).
  5. `tillPaket(res, { horisont })`: platspaketets `fasadsol`. `skala(res)`: summans skala följer
     periodens längd (700 för 185 dagar) och växer om någon punkt får mer.
- **Kontroll mot Hudiksvall**: ett fristående block 60 × 20 × 22 m, kl. 8–17, 21/3–21/9 ger
  samtidiga toppar 816 / 850 / 780 W/m² (Ö / S / V) mot underlagets 806 / 831 / 850. Väster blir
  lägre; med timmarna 8–17 som ögonblick (inte mitt i timmen) blir det 821 / 858 / 810, så
  underlaget har troligen räknat till kl. 17:00 och blocket står inte exakt i nord–syd. Summorna
  blir högre än i underlaget (söder 957 mot 634), eftersom himlen är klar varje dag.
- **app.js**: valet `tillval=fasadsol` (`effektivaVal().fasadsol` bara när det finns kroppar,
  `Kropp.forAnalys`), `#fasadsol-period` och `#fasadsol-tid` i `val.analys` och i localStorage
  (`terrang-analys`). Med fasadsol behövs ytmodellen (`behoverYta`) och marginalen 150 m
  (`MARG_SKUGGA`). `skapaAnalyser` sparar `kor.ytaFasad` (ytmodellen efter dolda/ersatta hus,
  före inbränningen av kropparna). Steget `skapaFasadsol` (efter `skapaSol`) räknar i delar om 150
  punkter med `await`, läser terrängen inom 5 km (`T.lasHojderGrov`, 8 m) och räknar
  `Analys.horisont(…, { minAvst: 150 })` från kropparnas mitt på fasadernas medelhöjd, och
  skriver `fasadsol/<namn>_sol_pa_fasader.pdf` (`js/fasadsolblad.js`) och `_fasader.csv`.
  `senaste.fasadsol` = { period, tid, ar, skala, punkter (x och y Float64, resten Float32),
  grupper, paket }; `inaktuell: true` när skissen ändras i planvyn eller 3D-vyn.
- **3D-vyn**: lagret `fasadsol` (en ruta per punkt 5 cm utanför väggen, `MeshBasicMaterial` med
  hörnfärger i sRGB), `vy3d.fasadsol('summa' | 'topp' | '')`, null utan data. Skissen är ljusgrå
  medan fasaderna är färgade (`skissfarg()` ger fortfarande den egna färgen). `meddelaSkiss('andrad')`
  tar bort datan. I app.js `satFasadsol3d`, valet `#vy3d-fasadsol` och skalan `#vy3d-fasadskala`
  (sessionStorage `terrang-3d-fasadsol`, förval summa).
- **Inte gjort**: pagoda (utkragning per våning), STRÅNG, reflexer mellan byggnaderna, tak (bara
  fasader), sol på fasaderna i platsanalysbladet (egen PDF). cad-apa läser inte `fasadsol` än.

## Byggnadskroppar och planvyn (0.14.0)

- **Modellen** (`js/kropp.js`): en kropp är en volym (`js/volym3d.js`) med `status`
  (`ny` | `tillbyggnad` | `befintlig` | `rivs`), `huvudbyggnad`, `kalla` (Lantmäteriets id) och
  `entre` (`{ sida, t }`). Inget nytt namn i projektfilen: kropparna ligger kvar i
  `inmatning.volymer` (planen sa `kroppar` med migrering; det hade krävt ändringar i utbytet med
  cad-apa och i alla analyser för samma sak). `Projekt.VERSION` och utbytets `version` är
  oförändrade. `golv` är FG. Taket som förut (`takform`, `taklutning`, `nockriktning` i grader);
  taksprång finns inte. Nya rektanglar är prisma (med tak) eller rätblock (platt), så att 3D-vyns
  fält för bredd och djup fortsätter fungera; `Kropp.satHorn` behåller typen om hörnen är en
  rektangel i samma riktning, annars blir kroppen en polygon. `Kropp.satNock` vrider om prismat
  (byter bredd och djup) när nocken läggs tvärs; entrén läggs då om på närmaste sida
  (`andra(v, fn, true)`).
- **Måtten**: `gransmatt` väljer två grannsidor (den längre får två mått, den kortare ett från det
  gemensamma hörnet) och för varje sida den närmaste gränssträckan som är ungefär parallell (inom
  35°) och ligger utanför; de två gränserna måste vara olika (inte parallella). Reserv: de tre
  kortaste vinkelräta måtten. `relativaMatt`: motriktade sidor som ligger an (3 cm), måtten längs
  fogen från den större kroppens hörn till den mindres (`ande`/`fast` för att flytta).
  `yttermattSidor`: en lång och en kort sida för rektanglar (inte fogen, helst inte där
  gränsmåtten är, annars norr och väster), alla utom fogarna för andra former. Bara ny och
  tillbyggnad får gränsmått; alla utom rivs får yttermått.
- **Planvyn** (`js/planvy.js`, `#planvy` i `index.html`, CSS *Planvyn* i `app.css` med egna
  variabler `--pv-*` per tema): bygger sitt eget innehåll i `Planvy.oppna(rot, opt)`, ritar hela
  SVG:n som en sträng vid varje ändring och arbetar på en kopia av kropparna; `opt.andrad(volymer)`
  efter varje steg. Ångra/gör om med ögonblicksbilder (JSON). Dra flyttar från läget vid starten
  (annars växer millimeteravrundningen i `Volym3D.flytta`). Länkade kroppar (kedjan i 3D) flyttas
  och vrids tillsammans. Testkrok: `TERRANG_TEST.planvy` (`volymer()`, `_test.w2s`).
- **app.js**, blocket *Planvyn*: `oppnaPlanvy` (gränser och hus ur `state.senaste` om systemet är
  detsamma; husen utan dolda men med ersatta, så att ett borttaget ersättande hus kommer tillbaka),
  `skissFranPlan` (som `skissFran3d`: skissen, `senaste.volymer`, `objektAndrat`, sparat resultat,
  inget nytt Skapa), `markhojdVid` (golvet för nya kroppar ur `senaste.rutnat`). *Plan* i 3D-vyn
  (`#vy3d-plan`) och *3D* i planvyn byter.
- **Analyserna**: `Kropp.forAnalys` (utan rivs) i skuggornas DSM, skuggbladet, skyfallet,
  horisonten och platsanalysbladet. Hus som ersatts av en kropp (`Kropp.ersatta`, id i `kalla`)
  tas bort ur `senaste.byggnader` i `skapaByggnader` och `objektAndrat`
  (`senaste.byggnaderErsatta`) och skärs bort ur ytmodellen som dolda hus; kroppen bränns in i
  stället. Info-filen säger hur många. 3D-vyn får kropparna utan rivs och husen utan de ersatta;
  `skissFran3d` lägger tillbaka kropparna som 3D-vyn inte fick (`utanfor3d`).
- **Kartan**: skissens lager visar status (tjocklek, streckning, fyllning).
- **cad-apa**: utbytet är oförändrat, så status, huvudbyggnad, källa och entré följer inte med. När
  skissen kommer tillbaka behålls de för kroppar med samma id (`laddaSkiss`). Ska cad-apa förstå
  dem: ändra `docs/UTBYTE-CAD-APA.md`, båda sidor och `test/cad-apa-mock.html` (ägarens klartecken
  i cad-apa-projektet).
- **Inte gjort** (etapp 3 och senare): situationsplanen som PDF/DXF med ritningshuvud,
  teckenförklaring och skala; flytta och slå av enskilda mått; skattad höjd och tak för befintliga
  hus ur takrättelserna; förslagen (kroppen får `forslag` som förut).

## Resultatet i webbläsaren (0.13.6, BJ)

- **Vad**: `state.senaste` (utan `yta`, ytmodellen, som inte används efter Skapa, och utan
  `ortofoto.canvas`, som görs om ur `ortofoto.bild`) och zip-filens filer (`state.zipFiler`).
  `senaste.visning` = `{ rader, tid, zipNamn, antalFiler, kartlager }`: sammanfattningens rader
  och vilka kartlager som fanns (`Object.keys(resultat)`) när Skapa var klar.
  `senaste.kartbilder` (bilderna på kartan: höjd över mark och ortofotot, data-URL och läge) och
  `senaste.laserKarta` (de högst 25 000 laserpunkterna på kartan) är nya för att kunna rita om.
- **Lagringen** (`Resultat`): nycklarna `meta:<id>`, `data:<id>`, `zip:<id>` i objektlagringen
  `resultat`. `tillLagring` gör om allt till något IndexedDB kan spara: funktioner och
  Leaflet-lager bort, canvas → Blob (PNG, JPEG över 2 Mpx), Map/Set/fel märkta, egenskaper som
  inte är uppräkningsbara (husens `tak`) märkta i `__hkdolda`. `franLagring` gör tillbaka, och
  delade objekt (husen i `byggnader` och `byggnaderAlla`, träden) blir delade igen. Högst
  `MAX_PROJEKT` = 3 projekt och `TAK` = 600 MB (ungefärlig storlek: byte i arrayer och Blob,
  tecken i strängar); äldre projekt tas bort först, sedan sparas utan zip-filen, och är själva
  resultatet över taket sparas ingenting. Blir lagringen full (QuotaExceeded) görs ett försök utan
  zip-filen. Testlandskapet med alla tillval: 2 MB resultat och 12 MB zip.
- **app.js**: `sparaResultat(true)` sist i `visaKlart`. `planeraResultatSpara()` (1,5 s, utan
  zip-filen, `Resultat.sparaData`) efter `objektAndrat`, ändrad skiss i 3D-vyn och namnbyte.
  `nollstallResultat()` tar bort det sparade (`glomResultat`) om ett resultat visades, utom med
  `{ behall: true }` (i `oppnaProjekt`). Allt mot lagringen går i en kö (`resultatKo`), så att
  borttagningen vid Skapa hinner före sparandet efteråt. `oppnaPost` (vid start och från
  Senaste projekt) anropar `lasInResultat(id)`: läser, kontrollerar att projektet, utsnittet och
  systemet är desamma och att inget Skapa har börjat, gör om ortofotots canvas, och
  `visaInlastResultat` fyller sammanfattningen, ritar lagren (`ritaSparadeLager`, i samma ordning
  som Skapa), visar 3D-knappen och utskriften och säger *Underlaget från … är inläst från
  webbläsaren*. Zip-filen läses först när man väljer *Ladda ner* (`state.zipSparad`,
  `packaZipNu`). Raden *Sparat* i sammanfattningen (`visaSparat`) säger om det gick.
- **Sparat i webbläsaren**: varje projekt visar storleken på sitt senaste underlag; *Ta bort*
  tar bort det också. *Ta bort alla sparade filer* rör bara kommunfilerna.
- **Inte gjort**: inget besked om lagringen blir full utom raden *Sparat*; underlaget följer inte
  med i projektfilen (avsiktligt: projektfilen ska vara liten och utan Lantmäteriets data).

## Skapa-flödet i steg (sedan 0.13.4)

Blocket *Skapa underlag* i `app.js`. Lyssnaren på `#skapa` gör bara detta:

1. `lasSkapaVal(kor)`: läser och kontrollerar valen. Ger inget (och ett besked på statusraden)
   om något saknas. Inget är låst än.
2. Låser knappen och projektbytet, gör panelen `inert` och ramen fast (0.16.3), och tar bort
   resultatet från kartan. Det sparade resultatet tas bort först när terrängen är klar.
3. `planeraSkapa(kor)`: områdena (`kor.rm` i zonen, `kor.tmBox` i TM, med marginaler för
   skuggor 150 m, skyfall 60 m, hus 30 m, sektioner och horisontens 400 m) och förloppets
   vikter (`kor.delFramsteg`). Ger `false` om analysområdet blir över 6 km².
4. `T.lokal.vrid = kor.vrid`, och sedan stegen i `SKAPA_STEG` i tur och ordning:
   `skapaTerrang`, `skapaLaser`, `skapaByggnader`, `stallVolymerPaMarken`, `skapaAnalyser`
   (träd, höjd över mark, skuggor), `skapaMarklager` (höjdpunkter, lutning, skyfall),
   `skapaSkissfiler`, `skapaSkydd`, `skapaSektioner`, `skapaFastigheter`, `skapaMarktacke`, `skapaStrandskydd` (0.13.5),
   `skapaOrtofoto`, `skapaStompunkter`, `skapaVagar`, `skapaSol`, `skapaFasadsol` (0.15.0),
   `skapaLagerPdf`, `skapaBlad`, `skrivBildguide`, `skapaProjektfilen`, `skapaSamladDxf`,
   `forberedZip` (0.13.5, förut `packaZip`), `noteraHamtminne`, `visaKlart`: 25 steg. Ett fel i
   ett steg utom `SKAPA_AVBRYTER` (terrängen, laserdatan, visningen) blir en varning med namnet ur
   `STEG_NAMN` (0.16.3).
5. `catch` (inloggningsfel och andra fel på statusraden, lagren som hann ritas tas bort) och
   `finally` (knappen, vridningen, projektlåset). Kom terrängen aldrig fram läses det förra
   resultatet in igen (0.16.3).

- **`kor`** är körningens objekt. Varje steg läser det det behöver överst
  (`const { val, r, epsg, filer, … } = kor;`) och lägger det det tar fram i `kor`
  (`const mos = …; kor.mos = mos;`). Det som skrivs om efter att det skapats läses alltid som
  `kor.x`: `vrid`, `vridText`, `rm`, `tmBox`, `dtmZ`, `harLaser`, `laserYta`, `laserTM`,
  `laserSek`, `laserDatum`. Övrigt som delas: valen (`val`, `format`, `np`, `volymer`,
  `skuggTider`, `skuggDatum`, `ogon`, `sektioner`), platsen (`r`, `epsg`, `mitt`, `mittTM`,
  `horLL`, `tt`, `franLL`), `namn`, `projekt`, `auth`, `behoverYta`/`behoverLaser`/`behoverDtm`,
  `mos` (höjddatan), `res` (terrängen), `X0`/`Y0`/`Z0`, `filer` (zip-filens innehåll),
  `infoNamn`, `extraInfo` (info-filens rader), `sammanExtra` (sammanfattningens rader),
  `varningar` och `senaste` (blir `state.senaste` i `visaKlart`).
- **Ett nytt steg** (till exempel sol på fasaderna): skriv `async function skapaX(kor)` bredvid
  de andra, läs det den behöver ur `kor`, fånga egna fel och lägg dem i `kor.varningar` så att
  resten fortsätter, och ställ den på rätt plats i `SKAPA_STEG`. Ska den ha en egen del av
  mätaren: lägg den i `plan` och `vikt` i `planeraSkapa`.
- **Ordningen spelar roll**: laserdatan räknas in i markmodellen från `skapaTerrang`,
  byggnaderna behövs för träden och skuggorna, volymerna ska stå på marken före analyserna,
  ortofotot läses före vägarna (bredden mäts i det), och bladet, projektfilen, den samlade
  DXF:en och zip-filen kommer sist.
- **Vridningen är fortfarande en inställning i `Terrang`** (`T.lokal.vrid`, läses av
  `Terrang.tillLokal` och `Analys.varldsfil`), satt under körningen och nollställd i
  `finally`. Granskningen pekade på det. Att göra den till ett argument rör ett tiotal
  anrop i flera moduler (DXF, LAS, IFC, världsfiler) och är inte gjort.
- **Inte gjort**: knappen Avbryt (granskningens punkt 8). Den blir enkel nu: en flagga i
  `kor` som slingan över `SKAPA_STEG` läser mellan stegen.
- Kommentarerna `// --- …` överst i stegen är kvar från den gamla funktionen.

## Laserdatan ruta för ruta (0.13.4)

- `Laser.lasRutvis(rutor, tmBox, auth, { klassFilter, framsteg, mottag })` läser varje ruta nod
  för nod och lämnar punkterna i TM till `mottag(del, ruta)`, en del per COPC-nod, som typade
  arrayer. Inget sparas, inget tak. Ger `{ antal, rutor: [{ id, antal }] }` (står i info-filen).
  `Laser.lasPunkter` finns kvar (allt i minnet, tak 6 miljoner) men används inte av appen.
- `Laser.samlare(max)` (lägg delar, `full` om taket sprängs) och `Laser.urval(p, behall)`.
- `Analys.ytsamlare(dtm, { utesluts, traffar })` → `lagg(p)`, `klar()` ger samma ytmodell som
  `Analys.ytmodell`. Med `traffar: true` följer `y.traffar` med: `Analys.traffrutnat`, antal
  mark- och objektträffar per halv ruta (två `Uint8Array`, 8 byte per m²).
  `Analys.hittaTrad(y)` läser träffarna där (eller bygger dem ur punkterna om de skickas med);
  den gamla listan över alla punkter (`punktIndex`) är borta. Provet träd/tak räknar träffar
  vars halvruta har mitten inom radien, i stället för varje punkt: på testlandskapet blir
  träden exakt desamma.
- `Analys.ytsamlareTM` för horisonten (TM), `Analys.vidSektion(sektioner, 2)` för att bara
  spara punkterna inom 2 m från en sektionslinje.
- Skapa (`skapaLaser`):
  markmodellen `dtmZ` görs före laserdatan. Per del: `tmSamlare` (TM), sedan
  `Laser.tillZon(del, epsg, rm)` → `ytsamlare`, `sekSamlare`, `filSamlare` (bara utsnittet, tak
  `MAX_PUNKTFIL` = 6 miljoner; över det ingen LAS/XYZ, med varning). `harLaser`, `laserYta`,
  `laserTM`, `laserSek` ersätter `pTM` och `pz`.
- Skalprov i Node: 20 miljoner punkter över 2,3 × 2,3 km tog 6,5 s och 365 MB för ytmodellen
  och träffarna, och 2 s för trädsökningen. Nedladdningen och uppackningen (laz-perf) är inte
  mätt; det är den som tar tid i webbläsaren.
- Gränserna är kvar: utsnittet får vara högst 4 km² (`MAX_AREA`, alltså 2 × 2 km), och
  analysområdet (utsnittet med marginaler, sektioner och horisontpunkt) högst 6 km²
  (`yta > 6e6`). Det ägaren såg vid 1–2 km sida låg alltså inom det tillåtna.

## 0.13.0 (`js/projekt.js`, blocket *Projektet* i `app.js`)

- `Projekt` är ren data utom `db*`: `nytt`, `las` (kontroll, `MIGRERA`, fyller
  i det som saknas), `bevara(gammal, ny)` (okända fält; `EGNA` = rättelserna,
  källorna och historiken bevaras inte), `innehall` (stabil JSON av projekt,
  plats, val, inmatning), `logga`, `somKopia`, `flyttaVolym(v, f)` (fotavtryck,
  primitivens x/y och vrid, nockriktning; vinkeln i mitten; avrundat till mm och
  1e-6°), `flyttaTradval`, `utanfor`, `packa`/`lasFil` (JSZip), `dbSpara`,
  `dbLas`, `dbTaBort`, `dbAlla`. Databasen `terrangunderlag` är version 2 både
  här och i `kommunfil.js` (samma uppgradering, båda stänger vid
  `versionchange`).
- `app.js`: `state.proj = { d, iDb, senastInnehall, filInnehall, sparadFil,
  bilagor, kandaHus, annanFlik }`. `byggProjekt()` = `lasPlats` + `lasVal` +
  `lasInmatning` (volymerna och sektionerna får id) + `bevara`.
  `oppnaProjekt(d, o)` ställer in panelen (`tillampaVal` skickar `change` på
  kryssrutor som ändras), räknar om till zonen och för in rättelserna bland de
  globala. `planeraSpara()` anropas från `lager.spara`/`lager.ta`, alla
  `change` i dokumentet, `visaUtsnitt`, `rensaUtsnitt`, volymer och sektioner;
  `sparaProjektNu` sparar bara om innehållet ändrats och inte för ett tomt
  projekt. Inget sparas förrän `startaProjekt` har kört (`state.projektKlar`).
- Rättelserna: hus och tak med id i `kandaHus` (husen i senaste Skapa, och de
  som redan fanns i projektet), träd inom utsnittet + 20 m. Trädens nycklar i
  localStorage är fortfarande i zonen; byter man zon känns de inte igen (som
  förut).
- Volymer, sektioner, horisontpunkt och projekt-id ligger inte längre i
  sessionStorage. `terrang-3d-dolda` gör det fortfarande, men följer med i
  `val.dolda3d`.
- `volym3d.js` laddas nu med sidan (för takytorna i DXF:en);
  `Platsanalys.dxfVolymer` skriver `SKISS_VOLYM` med 3DFACE (`Dxf.skriv` typ
  `yta`). Volymer med `golv: null` står på marken (förut 0).
- **AG oklart**: vid testet saknades skissen i "DXF:en", men skiss-DXF:en och
  den samlade hade lagren `SKISS_*` redan i 0.12.2 (då som linjer). Troligen
  var det volymerna som saknades som volymer, eller så avsågs
  skuggstudiens DXF som togs bort i 0.12.1. AÅ frågar vilken fil det gällde.

## 0.12.2

- `Utskrift.skuggblad(opt)`: med `opt.dok` och `opt.ruta = { x, y, w, h }`
  ritas rutnätet i rutan på den öppna sidan, utan sidbyte, rubrik och ordbild;
  nordpilen hamnar i rutans övre högra hörn och noterna längst ner i rutan.
  `Platsanalysblad.skuggsida` gör sidan med `sida()` och lämnar rutan ovanför
  ritningshuvudet; noterna hamnar till vänster om huvudet.
- `opt.byggnader` och `opt.volymer` (fotavtryck) ritas som linjer efter
  skuggor och kurvor, och varje ruta klipps mot utsnittet. `app.js` lägger dem
  i `skuggOpt` (`senaste.byggnader` är utan dolda hus).
- Provat genom att rendera båda PDF:erna med påhittade hus och skuggor i Node.

## 0.12.1

- **Horisonten**: `T.lasHojderGrov` läser varje ruta i ett eget `try`; en ruta
  som inte går att läsa (även 401) hamnar i `fel`, en som svarar 404 i
  `saknas`. Bara om ingen ruta går att läsa kastas det sista felet. `app.js`
  har ett eget `try` runt horisonten: misslyckas den görs soldiagrammet utan
  horisont och varningen säger det. Rutorna i `fel` står i varningen, i
  info-filen och i noten på soldiagrammet (`luckor`).
- **Orsaken är inte klarlagd.** Ett prov mot en ruta som inte finns gav
  `access-control-allow-origin` både utan och med inloggning (17 november), så
  404 utan CORS-huvuden var det inte. Testservern efterliknar ändå det fallet
  för saknade `.tif`. Med 0.12.1 blir soldiagrammet av med horisont; det
  räcker.
  Samma sak kan fälla `lasHojder` (själva utsnittet) vid kusten eller
  riksgränsen; den är inte ändrad, eftersom ett nätverksfel där inte ska
  tolkas som hav.
- **Solbladet**: `Platsanalysblad.solsida` ritar ram och ritningshuvud med
  `sida()` och sedan `Sol.soldiagramPdf` med `ruta = { x, y, k }` (A4-diagrammet
  skalat till k ≈ 1,10 mellan rubriken och ritningshuvudet). Skuggstudien fick
  samma ram i 0.12.2.
- **Leveransen**: `<namn>_platsanalys.pdf` i roten. Inga `_skuggor_*.dxf`,
  `_lutning_*.dxf` eller `_skyfall_*.dxf`; funktionerna finns kvar i modulerna.
- **`Geodata.hamta`**: ett XML-fel med status 200 ger *svarade med ett fel i
  stället för data: <ExceptionText>* och prövas inte via `geodata.php` (det
  hjälper inte). Varningarna 17 november (Skyddad natur med `<Exception`,
  Strandskydd och Vägar 502) kom från tjänsterna själva: Strandskydd och
  Vägar frågar Overpass direkt, och Naturvårdsverket svarade med ett
  XML-fel. (0.13.4: XML-felet berodde på appens fråga, inte på tjänsten, se
  överst.) `geodata.php` på VPS:en är ändå inte kontrollerad härifrån
  (testmiljön når inte servern).

## 0.12.0

- **Lagren som bild och PDF**: `Platsanalys.bildRutnat(r, s, maxPx)` (x0/y1 =
  mitten av övre vänstra pixeln, som världsfilen), `lutningBild(lt, r, 0,25)`
  (alla fyra klasser, vit bakgrund) och `skyfallBild(sk, r, 0,25)`. `lagerBild`
  i Skapa-flödet skriver `.jpg`, `_sweref.jgw` och `_lokal.jgw`. PDF:erna görs
  före platsanalysbladet (då finns hus och gränser) med `Utskrift.plan`, A3
  eller A1 om skalan blir grövre än 1:2 000. `lager.lutning = { konturer }`
  ritar vektorytor (klass 0 som grund under utsnittet); den gamla rasterformen
  `{ url, … }` finns kvar för kartutskriften. Skyfallet klipps mot utsnittet.
- **Samlad DXF**: `Dxf.sammanfoga(texter)` läser R12-filerna (både `Dxf.skriv`
  och `Terrang.dxf`), tar varje lager en gång (färgen från första filen) och
  alla objekt, och den sammanlagda utbredningen. Alla `…/_lokal.dxf` resp.
  `_sweref.dxf` i undermapparna, om de är minst två. Kontrollerat med ezdxf
  (0 fel). Kurvorna gör filen stor (cirka 1 MB för testtomten).
- **Vägar**: lagren `VAG_YTA_BIL_BERAKNAD`/`VAG_YTA_GANG_BERAKNAD`. I
  `profil` är medianfönstret `n = round(min(16, 7 · max(1, bredd/6)))` följt av
  `glid` (medel ±n/2). Ytorna på kartan är streckade och har ett verktygstips
  (de är nu `interactive`).
- **Utsnittet**: `ramGrepp` (osynlig polygon, bredd 16, Leaflet-canvas) →
  `startaRamDrag`/`ramFlytt`/`ramSlut` med musen (`mousedown` på lagret,
  `mousemove` på kartan, `mouseup` på dokumentet). Pekskärm är inte provad:
  canvas-lagret får kanske inte `mousedown` från ett finger. Punkt och radie:
  `satPunktlage`, `kvadratKring(x, y)` (mitten avrundas till 10 m),
  `state.mitt` följer med när ramen dras och nollställs av handtagen, ny
  ritning och koordinatfälten.
- **Lasso**: `vy3d.tradPaSkarm()` (klientkoordinater mitt i kronan för träd
  som syns och inte är dolda) och `markeraTrad([...])`. SVG över `#vy3d-yta`
  som släpper pekaren när slingan är ritad. `#vy3d-lassopanel`, Esc stänger.
- **Namnet**: höjdkurvor.se är ersatt överallt utom i CHANGELOG.md, som är
  orörd (historik). PDF:ernas ordbild är bara `Höjdkurvor`.
- **Flytten**: se `docs/FLYTT.md`. cad-apa har `HOJDKURVOR_ORIGINS` och
  `HOJDKURVOR_URL` i `src/ui/app/site.ts`; de måste ändras i cad-apa-sessionen.

## Vägar (0.11.0, `js/vagar.js`)

- `hamta` ger `linjer` (klippta mot utsnittet) och `alla` (15 m utanför, för
  ytorna). Varje linje har `lager`, `slag` (`bil`/`gang`, ur `KLASSER`), `typ`
  och taggarna `bredd` (width), `korfalt` (lanes), `enkelriktad`, `ytskikt`,
  `service`.
- `schablon(l)`: width → lanes × 3,25 + 0,5 → `SCHABLON[typ]` (enkelriktade
  60 %, driveway/parking_aisle 3 m).
- `matLinje`: stationer var 2 m (`stationer`, normal ur grannarna), färgen
  mitt på vägen (±0,3 × schablonen, inte grönt) som median i ett fönster ±3
  stationer, och bara om den är grå/gråbrun (största minus minsta kanal ≤ 70).
  Ut åt båda håll i steg om ¾ pixel tills två–tre pixlar i rad inte liknar
  (rgb-avstånd ≥ 42 eller grönt), högst 0,9 × schablonen + 1,5 m.
- `profil`: under 35 % stationer med båda kanterna → schablonen. Annars
  rullande median (±7) av bredd och sidförskjutning, bredden inom
  0,6–1,6 × schablonen (+1 m), förskjutningen högst 1,5 m eller en fjärdedel av
  bredden. OSM:s width går före bilden; gångvägar mäts aldrig.
- `ytor`: ett avståndsfält per slag (värde = halva bredden − avståndet till
  segmentet, max över segmenten, kanten −1 så att ringarna sluts mot
  utsnittet), `Terrang.kurvorForNiva` på nivå 0, `forenkla` 8 cm, `polygoner`
  (hål = inne i ett udda antal ringar). Rutan 0,2 m, grövre så att det blir
  högst 3 miljoner rutor.
- `app.js`: `val.vagytor` (underval, förvalt). Ortofotot läses före vägarna
  (`ortofotoPixlar`: getImageData ur `senaste.ortofoto.canvas`). Filerna
  `vagar/<namn>_vagar_*.dxf` och `_gangvagar_*.dxf` (bara om det finns sådana
  vägar). Kartan: `visaVagar` (lagren `vagar` och `gangvagar`), utskriften:
  `vagarTillUtskrift` (bara synliga lager), 3D: `vagar3d` (mittlinjer +
  ytornas kanter, draperade) och lagret `gangvagar` i vyn.
- Testdata: `make_orto.py` målar Bygatan (7,5 m, 1 m norr om OSM-linjen) och
  Skolvägen (5 m) grå. Gränssnittstestet: 2 vägar mätta, 2 schablon.
- **Inte provat på riktiga ortofoton.** Träd över vägen, skuggor, parkeringar
  och vägmarkeringar är de troliga felkällorna. Om det blir för brusigt:
  höj tröskeln för andel träffar eller fönstret i den rullande medianen.

## Enskilda träd och hus (0.11.0, `js/objektval.js`)

- localStorage `terrang-tradval` = `{ "x,y" (dm): { dolt, hojd, krona, art } }`,
  `terrang-husval` = `{ objektidentitet: { dolt } }`. `tillampaTrad` känner
  igen ett träd på exakt nyckel eller närmast inom 0,6 m (topparna ligger
  minst 1,5 m isär); `medDolda` ger alla med `dolt: true` (för 3D-vyn, så att
  index stämmer med `senaste.tradAlla`). Ändrade träd är kopior med `andrat`
  och `ra` (laserns höjd och krona). `Trad3D.art/typ` respekterar `t.art`
  (`gran`, `tall`, `lov`, `bjork`).
- Skapa: `senaste.tradAlla` (efter `tradVidByggnader`) och `senaste.trad`
  (med valen), `senaste.byggnaderAlla` och `senaste.byggnader` (utan dolda),
  `senaste.byggnaderDolda`. `skarBort` sätter dsm = dtm inom dolda kronor och
  fotavtryck (+0,5 m) innan skuggorna och volymerna.
- 3D-vyn: träden väljs med en lodrät cylinder per träd (`traffTrad`, 0,45 ×
  kronan), närmast av träd och hus vinner (`valjObjekt`). `bytTrad(i, t)`,
  `markeraTrad(i)` (gula ringar), `doljHus(id, dolt)` (objekten tas ur
  lagret), `lyssnaTrad`, testkrok `klickaTrad(i)`. Trädens InstancedMesh skapas
  nu i `placeraTrad` och växer vid behov (`tradMeshFor`), så att en ändrad art
  får plats.
- `app.js`: panelen `#vy3d-trad`, `#hus-dolj` i takpanelen, `#vy3d-dolda`
  (Visa dolda (n)). `objektAndrat` uppdaterar `state.senaste` och kartan
  direkt; när vyn stängs ber statusraden om Skapa igen. Testkrok
  `TERRANG_TEST.senaste()`.

## Till cad-apa (0.11.0)

- `ortofotoTillCadApa` skickar `senaste.ortofoto` som det är (full upplösning).
- `Utbyte.platspaket` lägger `art`, `modell`, `vrid` (grader moturs), `ljus` och
  `andrat` på varje träd och `tradmodeller` (`Utbyte.tradmodeller`: x öst, y
  norr, z upp, Float32 base64, cirka 330 kB för alla sju) när `Trad3D` finns.
  `trad3d.js` laddas därför i `index.html`. `vagar[].slag` och `vagytor`.
  Beskrivet i `docs/UTBYTE-CAD-APA.md`.
- **cad-apa läser inte de nya fälten än** (träden ritas som förut;
  trädmodeller står i cad-apas plan för 0.12.1). Ändra inget i cad-apa
  härifrån; nämn det för ägaren så att cad-apa-sessionen kan ta det.

## Modellera i 3D-vyn (0.10.0)

Beslutat 29 oktober (ägaren valde Claudes förslag): primitiver med exakta
mått, modelleras i 3D-vyn med en ortografisk toppvy, bara på dator. Analyserna
får volymerna som förut: fotavtryck + golv + takfot + takform.

- **`js/volym3d.js` (`Volym3D`)**, ren geometri, testad i `test/volym3d.test.js`.
  `v.primitiv = { typ: 'block'|'cylinder'|'prisma'|'polygon', x, y, vrid (grader
  moturs från öster), b, d | diam | pts, nock0, lankar, golvAuto, pa }`.
  `uppdatera(v)` räknar fotavtrycket (cylinder 32 hörn) och nockriktningen
  (prisma: = vrid, nocken längs bredden). `franVolym(v)` gör en polygon av en
  volym från cad-apa/DXF (golvAuto om golvet ligger på marken). `plan(v)` ger
  takfallen som plan med samma höjder som `Platsanalys.takhojd` (lägsta
  planet), `takytor(v)` exakta takfall och gavlar för konvexa fotavtryck
  (annars ritar vyn taket i rutnätet som förut). `snapp(fot, mal, tol)`: yta mot
  yta med hörnen i linje, sedan hörn mot hörn, sist hörn mot kant; `mal.prio`
  (volymer 0, hus 1, gränser 2). `kontakter` (sida mot sida, ovanpå, in i
  varandra) ger punkterna för kedjorna. `komponent`/`vaxlaLank`: grupper är
  sammanhängande länkar. `underlag`: volymen vars fotavtryck har mitten under.
  `synligaKanter` + `skarningar`: konturerna som union – varje kant delas i
  bitar om 0,5 m, och 16 provpunkter runt biten avgör om den ligger inuti, på
  en plan yta (8 av 16 inne) eller är en verklig kant; skärningslinjer där
  väggar korsar varandra och där tak/golv möter en vägg läggs till.
- **`js/vy3d.js`**: skissen ritas om med `ritaSkiss()` (väggar, sockel ner till
  lägsta marken, tak; konturerna som union utom medan man drar). Modelleringen
  ligger i blocket *Modellera* före `storleksandring`: pekarkrokar
  (`skissNed/Flytt/Upp/Klick`) körs före snurra/flytta. Flytta = dra i ett
  vågrätt plan på greppunktens höjd, hela gruppen följer, snäpp med tio pixlar
  i meter (Alt stänger av), golvet följer underlaget (`golvFor`, `foljUnderlag`,
  `ovanpa` hindrar att två volymer står på varandra). Kedjor och vridhandtaget
  är HTML-knappar i `.vy3d-overlagg` som projiceras i `uppdateraOverlagg`
  (anropas från `placera`). Historik: JSON av hela listan, högst 80 steg.
  Toppvy: `orto` (OrthographicCamera, upp = −z), `aktivKam()` används överallt
  där kameran behövs. API: `modellera`, `toppvy`, `nyVolym(mall, punkt?)`,
  `vald(id)`, `andraVald`, `taBortVald`, `kopieraVald`, `avstand(m)`, `angra`,
  `gorOm`, `avbryt(urModell)`, `lyssnaSkiss`, testkrokar `dra`, `vrida`,
  `lanka`, `kedjor`, `skarmpunkt`, `tittaPa`.
- **`app.js`**: panelen `#vy3d-modell` (Ny volym, Ångra, Gör om, fält för den
  valda), `skissFran3d` skriver tillbaka till `state.volymer` och
  `state.senaste.volymer`, sparar och ritar listan under 04 Skiss. När vyn
  stängs med en ändrad skiss: statusraden ber om Skapa igen (zip och PDF har
  den gamla skissen tills dess). Esc: avbryter placering, tar bort valet, går
  ur modelleringen, och först sedan stänger vyn.
- Kvar till **0.10.x**: bortskärning (urtag, kräver CSG och att analyserna
  får formen) och egna takfotslinjer. Takkonturer där två lutande tak möter
  varandra (vinkelrännor) ritas inte; tak mot vägg och vägg mot vägg gör det.

## Egen takform (0.10.0)

`Byggnad.takmodell(b, eget)`: `eget = { form: 'sadeltak'|'valmat'|'pulpettak'|'platt',
lutning, tvars, vand, nock }`. Det som inte anges passas till laserdatan. `tvars`
byter rektangelns axlar. Med egen vinkel tas nocken ur 90:e percentilen av
cellerna närmast nocken (en passning med fel vinkel drar annars nocken), och
takfoten får gå ner till 1 m över marken. Pulpettak: d = B ± v, D = 2B, ett
enda takfall. Inbuktade hus får den valda formen över rektangeln, ritad i
rutnätet. I 3D-vyn: klick på ett hus utanför modelleringen → `lyssnaHus` →
panelen `#vy3d-tak`; `bytTak(id, t)` byter taket och slår på Takformer. Valen
sparas i localStorage `terrang-takval` med objektidentiteten som nyckel.

## Träd (0.10.0)

Stiliserad low-poly: `Trad3D.typ(t)` väljer variant ur läget (gran, gran2,
tall, tall2, lov, lov2, bjork; ungefär var tredje lövträd björk), `modell(typ,
niva)`; de enkla är per art. En InstancedMesh per typ (detaljerade) och per art
(enkla). Högst 4 000 detaljerade på datorn, 600 inom 250 m på mobilen.
Realistiska träd (lövkort) är borttagna, och med dem LOV-varianterna av
materialen i *Bild för AI*. Ytor: 200–700 per detaljerat träd.

## Takformer i 0.9.2

`Byggnad.takmodell(b)` förbehandlar laserdatan som i 0.9.1 (egna punkter,
median mot skorstenar, riktningsfilter) men använder den bara för att passa en
form. Konvexa hus (yta / höljets yta ≥ 0,85): minsta omskrivna rektangeln kring
höljet (`rektangel`), lokala axlar u (lång) och v. Sadeltak: d = B − |v|;
valmat: d = min(B − |v|, L − |u|); höjd = takfot + tan(vinkel) · d. För varje
form och vinkel 5–60° är nocken medianen av hz + tan · (D − d), felet medel av de
85 % minsta avvikelserna. Sadeltak får 5 cm försprång, platt väljs om det är
högst 1 dm sämre eller vinkeln < 10°. Under 8 celler: sadeltak 35°. Takfot =
nock − tan · B, minst mark + 2 (annars flackare, under 5° platt). Takfallen
klipps ur höljet med halvplan (`klipp`), gavlar och kanter blir lodräta remsor
från takfoten. Inbuktade hus: bara valmat (d = avstånd till fotavtryckets
kanter) eller platt, valmat ritas i ett rutnät på 0,5 m; platt får ingen egen yta.
Ger `{ form, lutning, takfot, nock, pos, index }`. Inte provat på riktig
laserdata; vinkelhus med sadeltak i båda flyglarna blir valmade.

## 3D-vyn i 0.9.1

- **Färger**: `konturfarg(hex)` (konturerna och fotavtrycken utan höjd) och
  `gransfarg(hex)` (fastighetsgränserna); localStorage `terrang-3d-konturfarg`
  och `terrang-3d-gransfarg`.
- **Takformer**: `Byggnad.hojder` sparar `b.tak` (inte uppräkningsbar, följer
  inte med i JSON) med ytmodellen (`z`) och cellens egna laserpunkter (`punkt`,
  ur `y.ra`) i en ruta runt huset. `Byggnad.takmodell(b)` ger `{ takfot, nock,
  pos, index }` i zonen: tomma celler fylls med grannarnas punkter inom
  fotavtrycket (stängningen i `ytmodell` lyfter annars tomma celler nära
  nocken), avvikelser > 1,5 m från medianen 3 × 3 byts (skorstenar),
  riktningsfilter i två varv (fem celler längs den av fyra riktningar som
  varierar minst), takfot = 30:e percentilen av kantcellerna, nock = största
  värdet. Hörn utanför fotavtrycket flyttas till kanten på takfotens höjd.
  `app.js` (`takmodeller3d`) ger dem samma id som `somVolymer`; vyn bygger en
  grupp per hus (väggar till takfoten + tak med `takMat`, flatShading) och
  `takformer(på)` byter mot lådan. localStorage `terrang-3d-takformer`. Provat på
  testhusets sadeltak (nock 9,85 av 10 m) och ett syntetiskt valmat tak; inte
  på riktig laserdata. Finns inte efter att ett projekt öppnats utan laserdata.
- **Ögonhöjd**: `requestPointerLock` togs bort. Pekarlåset hanteras fortfarande
  om det ändå släpps, men vyn ber inte om det.
- **Realistiska träd** med lövkort fanns i 0.9.1–0.9.2, borttagna i 0.10.0.
- Testkrok: `TERRANG_TEST.byggnader` (husen med `tak`) bredvid `vy3d`.

## 3D-vyn i 0.9.0

Svaren som styrde (29 oktober): reglage för tid och datum, snabbval och
uppspelning; terrängen, husen och träden kastar skugga (trädskuggor kan stängas
av); en färg för alla befintliga hus och en egen för skissen; svarta konturer.

- **Skuggor**: `vy3d.skuggor(på)` och `vy3d.soltid(ms)`. Solen ur
  `Sol.solensLage(ms, lat, lon)`, azimuten minus meridiankonvergensen
  (`utsnittsMitt().konvergens`, som i `Analys.skuggor`). En DirectionalLight
  med ortografisk skuggkamera över utsnittet ± 0,75 × storleken, skuggkarta
  4096 (2048 på mobilen), PCF-mjuk. `shadowMap.autoUpdate = false`: skuggorna
  räknas om (`skuggaOm`) när solen, lagren, överdriften eller träden ändras.
  Terrängen och skissen är DoubleSide med `shadowSide = FrontSide`. Under
  horisonten: inget solljus. Datum, tid och uppspelning sköts i `app.js`
  (`soltid3d`, `uppdateraSol3d`, *Spela dagen* = upp till ned på 20 s).
  Riktningarna kontrollerade: lunch i mars ger skuggor mot norr, kväll i juni
  mot öster.
- **Konturer**: `EdgesGeometry` (20°, taken 30°) som barn till varje hus och
  skissvolym, av från början, valet i localStorage `terrang-3d-konturer`.
- **Färger**: `byggnadsfarg(hex)` och `skissfarg(hex)`; skissen har nu ett
  material för väggar och tak. localStorage `terrang-3d-husfarg` och
  `terrang-3d-skissfarg` (förval `#b9b3aa` och temats `annot`).
- **Träd** (`js/trad3d.js`): `Trad3D.art(t)` gissar gran (höjd/krona ≥ 2,4),
  tall (≥ 12 m och ≥ 1,6) eller löv; `modell(art, nivå)` ger trianglar 1 × 1 m
  med en normal per yta och färg per hörn; `variation(t)` vrider och ljusar efter
  läget. En `InstancedMesh` per art och nivå; `placeraTrad` delar upp efter
  avståndet till kameran (detaljerade: högst 6 000 närmast på datorn, 600 inom
  250 m på mobilen) och körs igen när kameran flyttat sig en bit.
  localStorage `terrang-3d-trad`.
- **Ögonhöjd**: `vy3d.ogonhojd()` växlar `lage` mellan `oversikt`, `valj` och
  `ogon`. Klick på marken (`traffMark`: går längs strålen i rutnätet och
  halverar), kameran 1,6 m över `markScen`, fov 60. Gå 4 m/s, springa 14 m/s,
  inom utsnittet. Pekarlås vid klick; när låset släpps (Esc) går den tillbaka.
  Spaken (`.vy3d-spak`) visas på pekskärmar. Esc i `app.js` går tillbaka i
  stället för att stänga när `lage() !== 'oversikt'`. Ingen krock med husen.
- **Bilder** (`vy3d.bilder({ skala, ai })`, `js/bild3d.js`): egen
  `WebGLRenderTarget` (MSAA 4, sRGB), `readRenderTargetPixels`, vänds och blir
  PNG. För AI: lera (alla ytor `leraMat`, linjerna dolda, vit bakgrund), djup och
  normaler med ShaderMaterial som `overrideMaterial` (utan MSAA, himlen
  genomskinlig), djupet kodat i 24 bitar. `Bild3D.djupbild` skalar 1/avstånd
  mellan 1:a och 99:e percentilen; `Bild3D.kanter` sätter linje vid djuphopp
  > 4 % och vikning > 35°. Zip:en byggs i `app.js` med en `_las_mig.txt`.
  Inte provat i Visoid.
- **Mobilen**: knappen *Val* (bara under 700 px) fäller ut lager, färger,
  bilder och knapparna i solraden; datum och tid syns ändå när skuggorna är på.
- Testas i `test/vy3d.test.js` och i 3D-delen av `ui_test.py`. Swiftshader i
  testmiljön ger låg bildfrekvens, så gånghastigheten i testet blir lägre än
  på riktigt (dt tak 0,25 s).

## IFC (`js/ifc.js`)

- En IfcBuildingElementProxy per byggnad med höjd, direkt i IfcSite (ingen
  IfcBuilding). IfcExtrudedAreaSolid från markhöjden (`b.mark − dz`) med
  djupet `b.hojd`; gårdar blir IfcArbitraryProfileDefWithVoids. Yttre ring
  moturs, hål medurs. Ett gemensamt grått IfcSurfaceStyle.
- Egenskaper i `Hojdkurvor_Byggnad`: objektidentitet, typ, ändamål, husnummer,
  namn, huvudbyggnad, markhöjd (RH 2000), höjd, tak, källa.
- GlobalId räknas ur `projektId` + lokal/sweref + objektidentitet (cyrb128),
  så att en ny export ger samma id. IfcSite.RefElevation = Z0 i den lokala filen.
- Ingen IfcMapConversion än; den lokala filen följer `Terrang.tillLokal` som
  DXF-filerna. Hus utan höjd hoppas över (räknas i info-filen).
- Kontrollerat med IfcOpenShell 0.8 (`validate` med EXPRESS-regler: 0 fel,
  geometrin skapas). Inte provat i Archicad.

## 3D-vyn, grunden (0.7.0–0.8.1)

`Vy3D.visa` får kurvor, fastighetsgränsernas linjer, vägarnas linjer och
fotavtryck för byggnader utan höjd. Linjerna draperas på marken med bilinjär
höjd ur rutnätet (punkter minst var 0,5 m). `vy3d.lager()` och
`vy3d.visaLager(namn, på)` styr lagren; knapparna byggs i `ritaLager3d` i
`app.js` och dolda lager sparas i sessionStorage (`terrang-3d-dolda`).
Sedan 0.8.0: `panorera(dx, dy)` flyttar målpunkten längs marken (högerdra,
mittenknapp, skift/ctrl-dra, två fingrar), hålls inom utsnittet ± en bredd och
följer markhöjden; dubbelklick och `aterstall()` går tillbaka. `kurvfarg(hex)`
byter kurvfärg; valet sparas i localStorage (`terrang-3d-kurvfarg`), förval svart.

## Koordinatdialogen

`Terrang.tolkaZon(x, y, hittaKommun)` prövar utsnittets mitt i alla 13
system. Ett system "passar" om punkten hamnar i en kommun som normalt använder
det (`data/kommuner.json`). Alla lokala zoner har samma falska östvärde, så
fel zon flyttar platsen 0,75–1,5 grader i öst–väst, och det händer att den då
hamnar i en annan kommun som också passar (Vimmerbys koordinater i 15 00
passar t.ex. en kommun längre västerut). Dialogen väljer i första hand den
kommun som redan är vald, sedan den zon som redan är vald, och säger alltid
vilka andra system som passar. Text med EPSG eller SWEREF-namn går före.

## Ortofoto (`js/ortofoto.js`)

- Söker i `/stac-bild/v1/search?bbox=…` (alla år, sidvis), väljer färgbilder
  (`rgbi`, `rgb`) i EPSG:3006, grupperade per flygår, typ och upplösning:
  helt täckande först, sedan senaste året, sedan finast upplösning. `cir`,
  `pan` och EPSG:3021 väljs aldrig.
- Upplösning: källans (0,16 m) om bilden ryms inom 16 Mpx och 8192 px per sida
  (iPhones canvasgräns), annars 0,25 / 0,5 / 1 m …
- Läser bara utsnittet ur COG:en med Range, från den grövsta översiktsnivån som
  är minst lika fin som målet, och ritar om bilinjärt till zonen (exakt
  omvandling var 32:a pixel, linjärt längs raderna). (0, 0, 0) är tomt.
  YCbCr-JPEG läses med `readRGB`. 16 Mpx tar cirka 1,3 s i Node.
- Zip: `ortofoto/…_ortofoto.jpg` med `_lokal.jgw` och `_sweref.jgw` (byt namn
  på en, som för höjd över mark). Kartan: eget pane (z-index 350) under de
  andra lagren, nedskalad till högst 2048 px. Utskriften: inom utsnittet, under
  marktäcket (som då blir halvgenomskinligt). 3D: textur, knappen Ortofoto slår
  av och på.
- **Okontrollerat mot riktiga filer**: att dl1 svarar på Range med CORS för
  `/bild/` (laserdatan på samma server fungerar), vilken komprimering och vilka
  översiktsnivåer Lantmäteriets COG:er har, och att band 1–3 är R, G, B (enligt
  produktbeskrivningen för RGBI). Felmeddelandena säger vad som stoppade.
- Testdata: `test/data/make_orto.py` (COG:er med kontrollinjer var tionde
  meter), `/stac-bild/` i testservern, `test/ortofoto.test.js`.

## Nästa session

Flytten är klar (se `docs/FLYTT.md`). Kvar utanför repot: `url` i
`apps/hojdkurvor/app.json` i agrellarkitektur/apps, och att ta bort
FTP-secrets och `stang-webbhotellet.yml` när avstängningen är gjord.

Versionsplanen (24 november, kan ändras av ägaren; omgivningen är en del av Skissa i 3D, beslut 24
november):

| Version | Innehåll |
|---|---|
| 0.15.0 | Sol på fasaderna (byggd 22 november; testas som CG–CK) |
| 0.15.x | Rättelser efter ägarens test av 0.14.x och 0.15.0 |
| 0.16.0 | Situationsplanen: yttre skal, annotering, ritningshuvud, teckenförklaring, PDF och DXF (byggd 22 november; testas som CÖ–DC) |
| 0.16.1 | Svar på testet 23 november (byggd 23 november; testas som DD–DQ) |
| 0.16.2 | BS, utsnittets format på mobilen (byggd 25 november; testas som DT) |
| 0.16.3 | Rättelser efter granskningen av 0.16.2 (byggd 26 november) |
| 0.16.4 | Rättelser efter ägarens test av 0.16.1 (DD–DJ), 0.16.2 (DT) och 0.14.4 (BÄ, BÖ, CA, CB) (byggd 27 november; testas som EE–EN) |
| 0.16.5 | Inkorgen DU, DV, DW, DX och datamodellen för 0.17.0 under ytan (byggd 28 november; testas som EO–ER) |
| 0.17.0 | Skissa i 3D med användarskapad omgivning etapp 1 (CL–CV), formpaletten med ikoner, CE; se `docs/SKISSA-I-3D.md` |
| 0.18.0 | Arbetsgången (CD, CC, BK) och ikonbaserat gränssnitt (BL) |
| 0.19.0 | Bedömning med regelbok för befintliga analyser |
| 0.20.0 | Förslag och sparade vyer (projektfilen etapp 3); förslagen jämförs också på bedömningen |
| 0.21.0 | Nya analyser, omgång 1: dagsljus på fasaderna, lutning/tillgänglighet, klimat, utsikt |
| 0.22.0 → | Geologi (etapp 0–4), bilagor (AM, AN) och resten; nya analyser omgång 2 |
| ej bestämd | Omgivningen etapp 3–4 (CÅ–CÄ, biblioteket; fråga ägaren om det ska komma direkt efter 0.17.0), pagoda, STRÅNG och reflexer i sol på fasaderna (CW–CY) |

1. För in ägarens testresultat (EE–EN för 0.16.4, EO–ER för 0.16.5, DK–DQ för 0.16.1, CÖ–DC för 0.16.0, CG–CK för 0.15.0 och de
   öppna punkterna under *Att testa* för 0.14.x). Rättelser blir 0.16.6. Kontrollen mot Hudiksvall *med
   omgivning* (CH) går att göra nu när B3 är rättad.
2. Projektuppgifterna för ritningshuvudet fylls i i planvyn (0.16.0); `anteckning` har fortfarande
   inget fält.
3. Tillägg till AX att fråga om: är fältet tomt och Fastigheter ikryssat vid
   Skapa, föreslå den fastighet som har störst del av utsnittet
   (`fi.fastigheter[0]`).
4. 0.17.0 (Skissa i 3D): prototypen är färdig (beslut 25 november) och datamodellen och geometrin finns
   sedan 0.16.5. Börja i `docs/SKISSA-I-3D.md`, *Datamodellen (byggd i 0.16.5)*: nästa är etapp 4
   (analyserna på `harledd`), som också kan släppas som 0.16.x utan att något syns.

### Fastighetsnamn ur kartan (AX, byggt i 0.13.1)

Blocket *Fastighetsnamn ur kartan* i `app.js` (efter Punkt och radie).
`fastigheterVid` tar i tur och ordning `state.senaste.fastigheter` (om punkten
ligger i det senaste utsnittet och samma zon), kommunens fil i IndexedDB med
`baraSparad: true` (ingen HEAD-fråga, ingen inloggning; felet har
`inteSparad`) och sist Lantmäteriet med samma storleksfråga som Skapa.
Rutan kring punkten är 4 × 4 m. `Fastighet.vid(f, x, y)` ger ytorna som
innehåller punkten, största först. Status och fel visas i hjälptexten under
fältet (`#projekt-hjalp`). Topografiska webbkartans etiketter är en bild och
går inte att läsa.

## Lantmäteriets leveranser (kontrollerat 23 oktober)

- Ortofoto, byggnader och fastighetsindelning har licensen **CC BY 4.0**,
  avgift 0 kr, särskilda användarvillkor vid beställningen (GDPR,
  fastighetsregisterlagen). Varje användare behöver egen beställning.
- **Byggnader och fastighetsindelning**: en zip med en GeoPackage per kommun,
  `dl1.lantmateriet.se/byggnadsverk/byggnad_knKKKK.zip` och
  `dl1.lantmateriet.se/fastighet/fastighetsindelning_knKKKK.zip`. Byggnadsskiktet
  `byggnad`; 83 % av fotavtrycken inmätta vid takkanten, ingen höjd i datan.
  Fastighetsindelningen (2025) har skikten `registerenhetsomradesyta`,
  `registerenhetsomradesgrans`, `granspunkt`, `traktyta` m.fl., inget textskikt.
- **Ortofoto**: 735 samlingar i `/stac-bild/v1`, en per område och år. Svar för
  Vimmerby i `test/data/stac-bild-sok-vimmerby.json`. Rutor 2,5 × 2,5 km
  (0,16 och 0,25 m) eller 5 × 5 km (0,5 m).
- Riktiga filer för Vimmerby finns inte i repot. Be ägaren om dem om de
  behövs.

## Idéer som inte är beslutade

- Ortofotot i platsanalysbladets kartor. (Till cad-apa: klart i 0.10.1, full upplösning i 0.11.0; 2D-underlag är cad-apas sak.)
- Rätta vägytorna för hand (dra i kanterna) eller rätta bredden per väg.
- Dölja och rätta hus utan laserhöjd (fotavtrycken) och ge dem en höjd.
- Val av flygår eller upplösning för ortofotot (nu senaste och automatiskt).
- Byggnader utan laserdata: höjd saknas (i 3D syns de som fotavtryck, i IFC
  saknas de); schablon per typ vore möjligt men osäkert.
- IfcMapConversion i IFC-filen, så att den lokala filen också bär sin placering
  i SWEREF.
- Byggnader i skuggstudien utan laserdata.

## Kvar sedan tidigare

- **cad-apa läser platspaketet** (`src/core/siteImport.ts`: terräng, träd,
  vägar, stompunkter, byggnader och fastighetsgränser), kontrollerat 27 oktober.
  Ändra inget i cad-apa härifrån. Fälten är beskrivna i `docs/UTBYTE-CAD-APA.md`.
- Platsanalysen: klimat (snölast, vind, växtzon) och buller står som KOMMER.
- Avvaktar enligt ägaren: schakt och fyll, solkarta, OBJ/GeoTIFF, IFC för
  terrängen och skissen, exempelprojekt.
- Licensvillkoren för Riksantikvarieämbetets och MCF:s data och
  kommungränserna (`data/kommuner.json`) är inte kontrollerade.
- Myndigheternas tjänster i kapitlet Skydd är bara testade mot låtsassvar.
- Flytten till hojdkurvor.danaid.cloud är klar (0.13.1); från 0.14.1 är adressen hojdkurvor.se. Lantmäteriet behöver
  inte godkänna adressen (kontrollerat 17 november). Se `docs/FLYTT.md`.

## Testmiljön

Utan GDAL går testdatan att bygga med en liten ersättare för `osgeo` ovanpå rasterio
(`pip install rasterio`, en mapp `osgeo/` med `gdal.py` och `osr.py` på `PYTHONPATH`, som bara
har det skripten använder: `GetDriverByName('MEM').Create`, `Open`, `Translate` till COG). Så
gjordes 19 november; ersättaren ligger inte i repot. Ett helt varv av `ui_test.py` tar
12–15 minuter med swiftshader. Testservern svarar sedan 0.13.4 som Naturvårdsverkets tjänster
och ger 502 på varannan Overpass-fråga, så två 502 i konsolfelen är väntade.

GDAL saknas från början. Kör `apt-get update` först, annars hittas inte
paketen: `apt-get install gdal-bin python3-gdal poppler-utils`, och
`python3.12 -m pip install --break-system-packages "numpy<2" "scipy<1.15" copclib`
för `make_dtm.py`, `make_landskap.py`, `make_vektor.py` och `make_orto.py`
(kör `make_dtm.py` först). Testservern och gränssnittstesterna körs med
`python3` (som kan vara en annan version än 3.12):
`python3 -m pip install --break-system-packages pyproj playwright pillow` och
`python3 -m playwright install --with-deps chromium`. Kvarvarande 404 i
gränssnittstestet (`m643_*.tif` för horisonten och `topowebb-3006.gpkg`) är
kända luckor i testdatan. För att kontrollera IFC: `python3.12 -m pip install
--break-system-packages ifcopenshell pytest` och `IFC_UT=mapp node test/ifc.test.js`
(se `test/README.md`).
