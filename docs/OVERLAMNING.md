# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 23 oktober 2026, efter 0.5.0.

## Läget

- **0.5.0 är släppt** (release `v0.5.0` på GitHub, 18 oktober). Arbetsflödet
  `.github/workflows/release.yml` byggde `hojdkurvor-v0.5.0.zip` och lade den på
  releasen. Sidan ligger på <https://agrellarkitektur.se/terrang/>.
- Vad 0.5.0 innehåller: `CHANGELOG.md`. Hur koden hänger ihop: `README.md` och
  `CLAUDE.md`. Testerna: `test/README.md`.
- Utvecklingen var pausad efter 0.5.0 medan Carl August använde appen. Nu ska
  nästa version tas fram: **0.6.0** (nya funktioner).
- **cad-apa har inte byggt sin sida av utbytet än** (cad-apa var på 0.8.13 den
  23 oktober utan något om höjdkurvor). Höjdkurvors sida är klar och testad mot
  `test/cad-apa-mock.html`. Ändra inget i cad-apa härifrån.

## Nytt sedan 0.5.0

### Behörighet hos Lantmäteriet

Carl August har fått tillgång till tre nya produkter på Geotorget. De ska
arbetas in i 0.6.0:

- **Ortofoto Nedladdning**
- **Byggnad Nedladdning, vektor**
- **Fastighetsindelning Nedladdning, vektor**

Det vi har pratat om tidigare är att få in befintliga byggnader och
fastighetsgränser i underlaget, och att dataseten då inte längre ska stå som
"kommer" (instruktionerna, README under Kommande). Förslaget nedan bygger på det
och på hur appen fungerar i dag. Stäm av omfattningen med honom innan bygget,
och säg om det riskerar att behöva mer än en session.

**Byggnader** (Byggnad Nedladdning, vektor)
- Fotavtryck som DXF (lokal och SWEREF), med ändamål och husnummer som text,
  som kartlager under Underlag och i utskriften i skala.
- Höjd ur laserdatan när den finns (höjd över mark inom fotavtrycket), så att
  byggnaderna kan användas i skuggstudien, horisonten, skyfallet (som spärr,
  jämför `Platsanalys.branInVolymer`) och 3D-vyn. Utan laserdata: bara
  fotavtrycket.
- Med i platspaketet till cad-apa som befintliga byggnader. Det är ett nytt fält
  i `hojdkurvor-plats`; nya fält bryter inte version 1, men skriv in det i
  `docs/UTBYTE-CAD-APA.md`.
- I platsanalysbladets kartor.

**Fastighetsgränser** (Fastighetsindelning Nedladdning, vektor)
- Gränser och fastighetsbeteckningar som DXF, kartlager och i utskriften.
- I platsanalysbladets sammanställning: vilka fastigheter utsnittet berör.
- En tydlig text om att gränserna i registret inte är inmätta och kan avvika;
  hänvisa till förrättningskartor och lantmäteriförrättning.

**Ortofoto** (Ortofoto Nedladdning)
- Bakgrund på kartan och i utskriften i skala (Lantmäteriets bild får skrivas
  ut, till skillnad från OpenStreetMap).
- Georefererad bild i zip-filen (bild + world file, lokal och SWEREF) att lägga
  som underlägg i Archicad, Revit och AutoCAD.
- Gärna som textur på terrängen i 3D-vyn.

Att ta reda på först (inget av det är kontrollerat): hur produkterna levereras
(troligen filer per kommun eller ruta via Lantmäteriets STAC-katalog,
`/stac-vektor` och `/stac-bild`, som `stac.php` redan släpper igenom),
filformat, koordinatsystem, attributnamn och villkor. Läs Lantmäteriets
produktbeskrivningar och dokumentation på lantmateriet.se och Geotorget. Bygg
som för marktäcket: inloggningen går direkt från webbläsaren, stora filer
sparas i IndexedDB. Lägg låtsasdata i testservern (`test/server.py`) och testa
som vanligt.

Uppdatera produkttabellen i `instruktioner.html`, ta bort raden om att
byggnader och fastighetsgränser kommer senare, och uppdatera README (Externa
tjänster, Kommande) och Källor på `om.html`. Hydrografi, Topografi 10 och NVDB
står kvar som kommande.

### Publicering direkt till webbhotellet

Det finns nu secrets i repot för FTP: `FTP_SERVER`, `FTP_USERNAME`,
`FTP_PASSWORD` och `FTP_DIR`. **Kommande versioner ska publiceras direkt på
webbhotellet**, inte via zip som han laddar upp själv.

- Gör som i cad-apa: `.github/workflows/publicera.yml` där
  (<https://github.com/agrellarkitektur/cad-apa>) laddar upp med
  `SamKirkland/FTP-Deploy-Action@v4.3.5`, FTPS med `security: loose`, vid
  push till `main` (dokumentation hoppas över med `paths-ignore`), och kan köras
  för hand. Den normaliserar `FTP_DIR` till `/…/` och laddar bara upp det som
  ändrats.
- För höjdkurvor: kör samma kontroller som `release.yml` (syntax, enhetstest,
  inga nycklar i `config.js`) och ladda upp samma urval som zip-filen, alltså
  `git archive` utan `test`, `docs`, `.github`, `CLAUDE.md` och `.gitignore`.
- Fråga Carl August om `config.js` ska följa med. Har han ändrat den på
  servern ska den uteslutas (`exclude`), annars skrivs den över.
- Fråga också om publiceringen ska ske vid varje push till `main` (som
  cad-apa) eller bara vid release. Föreslå samma som cad-apa.
- Den första körningen laddar upp allt. Kontrollera efteråt med
  `gh run list` och att sidan fungerar på <https://agrellarkitektur.se/terrang/>.
- Uppdatera *Leverera en ny version* i `CLAUDE.md` och *Publicera* i README.
  `release.yml` och zip-filen kan finnas kvar.

### Synpunkter från egen användning

Carl August samlar synpunkter i en egen chatt på claude.ai ("Höjdkurvor
project feedback"). Fråga honom om det har kommit fler. Hittills:

1. Latitud och longitud i decimalgrader med punkt (t.ex. `57.66291, 15.85612`)
   i info-filen, och gärna synligt nära kartan med en kopieringsknapp, så att
   platsen kan anges i Archicad utan Google Maps.
2. **Förhandsvisa i 3D** som en riktig knapp mellan Skapa och
   Ladda ner / Fortsätt rita i cad-apa (i dag en textlänk längst ned).
3. Ladda ner och Fortsätt rita i cad-apa ska vara lika höga och synas bättre.
   Förslaget var att bara knappen som är nästa steg är fylld orange (först
   Skapa, sedan Ladda ner) och att de andra får orange ram.

## Kvar sedan tidigare

- Platsanalysen: klimat (snölast, vind, växtzon) och buller från vägar står
  som KOMMER. Boverkets tjänst för klimatlaster hittades inte; buller är inte
  utrett.
- Avvaktar enligt Carl August: schakt och fyll, solkarta, OBJ/GeoTIFF, IFC,
  exempelprojekt.
- Licensvillkoren för Riksantikvarieämbetets och MCF:s data och
  kommungränserna (`data/kommuner.json`, ingen licensfil hos källan) är inte
  kontrollerade.
- Myndigheternas tjänster i kapitlet Skydd är bara testade mot låtsassvar. Om
  något inte fungerar på riktigt: titta först på CORS och `geodata.php`.
- Domänflytten till höjdkurvor.se kräver att Lantmäteriet godkänner den nya
  adressen för CORS först (README).
