# Projektfilen

Från 0.13.0. Ett projekt är det man har matat in och valt för en plats: utsnittet,
valen, skissens volymer, sektionerna, horisontens punkt och rättelserna av hus och
träd. Det sparas i webbläsaren medan man arbetar och kan sparas som en fil som
går att flytta till en annan dator, ge till en kollega eller öppna efter att appen
har flyttat till en ny adress. Koden finns i `js/projekt.js` (formatet,
omräkningarna, zip-filen och lagringen) och i blocket *Projektet* i `js/app.js`
(panelen). Testas i `test/projekt.test.js` och `test/projekt_test.py`.

## Tre lager

1. **Inmatning**: det användaren har gjort och som inte kan hämtas igen.
   Sparas alltid, både i webbläsaren och i filen.
2. **Val**: utsnitt, tillval, format, intervall, nollpunkt, vridning,
   analysernas och utskriftens inställningar. Sparas alltid.
3. **Hämtat underlag**: Lantmäteriets och andras data och allt som räknas fram ur
   dem. Sparas *inte*. Det hämtas igen när man väljer Skapa. Filen anger vilka
   produkter som användes och när (`underlag`).

Inmatningen hör till projektet, inte till en generering. Ändras utsnittet ligger
den kvar; det som hamnar helt utanför flaggas under *Projekt* i 01 Plats
(*1 volym och 1 sektion ligger utanför utsnittet. De finns kvar i projektet.*).

## Filen

`<projektnamn>.hojdkurvor` är en zip med:

- `projekt.json` – projektet, se nedan (UTF-8, indraget med ett blanksteg).
- `bilagor/` – filer som hör till projektet (eget bildunderlag, foton). Tom i
  0.13.0, men det som finns där följer med när filen sparas igen.

En ren `projekt.json` (eller en annan `.json` med samma innehåll) går också att
öppna, för felsökning och tester.

Inloggningen till Lantmäteriet finns aldrig i filen, och inget hämtat underlag:
ortofoto, byggnader och fastighetsindelning får inte bäddas in i en fil som kan
spridas förrän villkoren är kontrollerade. Rättelserna innehåller bara
Lantmäteriets objektidentitet (hus) eller läget (träd) och användarens egna värden.

## projekt.json

```jsonc
{
  "format": "hojdkurvor-projekt",
  "version": 1,                         // formatets version, se Versioner
  "app": "0.13.0",                      // appen som sparade
  "skapad": "2026-11-18T08:00:00.000Z",
  "sparad": "2026-11-18T09:12:00.000Z", // när filen sparades (null i webbläsaren)

  "projekt": { "id": "uuid", "namn": "Staren 2", "kommun": "Kinda",
               "fastighet": "", "uppdrag": "", "anteckning": "" },

  "plats": {
    "crs": "EPSG:3006",                 // geometrin i inmatning och horisontpunkt
    "zon": 3009,                        // arbetszonen (EPSG)
    "zonManuell": false,                // zonen vald för hand, inte kommunens förslag
    "utsnitt": { "xmin": 0, "ymin": 0, "xmax": 0, "ymax": 0 },   // i zonen
    "mitt": null,                       // Punkt och radie: [x, y] i zonen, eller null
    "radie": 50,
    "nollpunkt": { "typ": "auto" },     // eller { "typ": "egen", "x", "y", "z" } i zonen och RH 2000
    "vridning": { "typ": "ingen", "grader": 0 },   // ingen | sann | egen (grader medurs)
    "horisontpunkt": null,              // [x, y] i SWEREF 99 TM, eller null = utsnittets mitt
    "last": false                       // området är låst (0.14.3); saknas = false
  },

  "val": {
    "tillval": ["laser", "byggnader"], "kapitel": ["sol"], "format": ["dxf", "xyz"],
    "intervall": "0.5", "mesh": "2", "hojdpunktSteg": "10", "utjamning": 1, "ritprogram": "archicad",
    "analys": { "skuggdatum": [], "skuggtider": "9, 12, 15", "ogonhojd": "1,6", "horisontTom": false },
    "utskrift": { "pr-format": "a3", "…": "…" },
    "dolda3d": []                       // lager som är dolda i 3D-vyn
  },

  "inmatning": {
    "forslag": [ { "id": "uuid", "namn": "Basfall", "aktivt": true } ],
    "volymer": [ { "id": "uuid", "forslag": "uuid", "namn": "Hus A", "fotavtryck": [[x, y], …],
                   "golv": 112.5, "takfot": 6, "takform": "sadel", "taklutning": 27,
                   "nockriktning": null, "primitiv": { … },
                   "status": "ny", "huvudbyggnad": false, "kalla": null, "entre": { "sida": 0, "t": 0.5 } } ],
    "sektioner": [ { "id": "uuid", "namn": "A", "a": [x, y], "b": [x, y], "vand": false } ],
    "rattelser": { "tak": { "objektidentitet": { … } }, "trad": { "x,y": { … } }, "hus": { "objektidentitet": { … } } },
    "punkter": [], "overlagringar": [], "anteckningar": [], "vyer": []
  },

  "underlag": {
    "senastSkapat": "2026-11-18T08:30:00.000Z",
    "kallor": [ { "produkt": "Markhöjdmodell Nedladdning", "hamtad": "2026-11-18" } ]
  },

  "historik": [ { "tid": "…", "handelse": "Utsnittet ändrat" } ]
}
```

### Koordinater

- **SWEREF 99 TM** (`crs`) för all geometri i `inmatning` och för `horisontpunkt`.
  Appen räknar om till arbetszonen när projektet öppnas (`Projekt.flyttaVolym`,
  `Projekt.flyttaTradval`). En volym flyttas med fotavtryck, primitivens mitt,
  vridning (`primitiv.vrid`) och nockriktning; vinkeln mellan systemen räknas i
  volymens mitt. Det rättar också ett fel från 0.10.0: vid byte av zon följde
  bara fotavtrycket med, inte primitiven.
- **Arbetszonen** (`zon`) för `utsnitt`, `mitt` och `nollpunkt`. De är
  definierade i zonen (utsnittet är en rektangel med kanter på jämna 10 m där),
  så en omräkning skulle förstöra dem.
- Koordinater i filen avrundas till millimeter, vinklar till miljondels grad, så
  att en fil som öppnas och sparas igen blir likadan.
- Höjder i **RH 2000**. `golv: null` betyder att volymen står på marken (NaN i
  appen).
- Trädens rättelser har läget i dm som nyckel (`"539812.4,6427705.1"`), som i
  `terrang-tradval` men i SWEREF 99 TM. Ett träd känns igen inom 0,6 m.

### Fält i detalj

- `volymer[]`: samma fält som skissen (se `js/volym3d.js` och
  `docs/UTBYTE-CAD-APA.md`), plus `forslag`. Volymer från cad-apa behåller sitt
  `id`. Från 0.14.0 är de byggnadskroppar (`js/kropp.js`) med fyra fält till,
  som alla kan saknas (äldre filer läses som förut, så `version` är oförändrad):
  `status` (`ny` | `tillbyggnad` | `befintlig` | `rivs`, saknas = `ny`),
  `huvudbyggnad` (kryss i plan), `kalla` (Lantmäteriets objektidentitet när
  kroppen är tagen ur ett befintligt hus; huset ersätts då av kroppen) och
  `entre` (`{ sida, t }`: sidan i fotavtrycket och läget längs den, 0–1).
  `golv` är färdigt golv (FG). Fälten följer inte med till cad-apa (utbytet är
  oförändrat), men behålls för kroppar med samma `id` när skissen kommer tillbaka.
- `sektioner[]`: `a` → `b` är linjen, `vand` vänder blickriktningen.
- `rattelser`: egna takformer (`terrang-takval`), dolda och rättade träd
  (`terrang-tradval`) och dolda hus (`terrang-husval`) som rör projektet: hus som
  fanns i utsnittet senast underlaget skapades, och träd inom utsnittet + 20 m.
  När projektet öppnas förs de in bland webbläsarens egna rättelser, som gäller
  alla projekt.
- `forslag`, `punkter`, `overlagringar`, `anteckningar`, `vyer`: förberedda för
  förslag, egna berg- och jorddjupspunkter, eget bildunderlag, anteckningar och
  sparade 3D-vyer. 0.13.0 skriver bara Basfall och tomma listor, men bevarar det
  en nyare version har skrivit.
- `historik`: högst 200 händelser. Samma händelse inom tio minuter skriver bara
  om tiden.

## Regler

- **Fasta id** (uuid) på projektet, förslagen, volymerna och sektionerna.
  `projekt.id` är också platspaketets `projekt.id` till cad-apa. En skiss från
  cad-apa med ett annat projekt-id öppnar det projektet, eller ett nytt med det id:t.
- **Okända fält bevaras** (`Projekt.bevara`): fält som appen inte känner till
  ligger kvar när filen sparas igen, också i poster i listor (samma `id`). Undantag:
  rättelserna, källorna och historiken, som appen äger helt, så att det som tagits
  bort inte kommer tillbaka.
- **Innehållet** (`Projekt.innehall`) är `projekt`, `plats`, `val` och
  `inmatning` med sorterade nycklar. Tider, appversion, underlag och historik
  räknas inte. Det avgör om något är ändrat sedan filen sparades och om en fil
  och webbläsaren är oense.

## Versioner

`version` är formatets version. Ändras formatet så att en äldre app inte kan läsa
det: höj `Projekt.VERSION` och lägg till `Projekt.MIGRERA[n]`, som gör en fil i
version n till n + 1. `Projekt.las` kör dem i tur och ordning. En fil från en nyare
version ger *Filen är sparad i en nyare version av Höjdkurvor – ladda om sidan.*
Nya fält som en äldre app kan strunta i kräver ingen ny version.

## I webbläsaren

- IndexedDB-databasen `terrangunderlag`, version 2 (version 1 hade bara
  kommunfilerna), objektlagringen `projekt` med `projekt.id` som nyckel. En post:
  `{ id, namn, kommun, andrad, sparadFil, filInnehall, forhand, antal, storlek,
  data, bilagor }`, där `data` är projektet i samma form som `projekt.json`,
  `forhand` en liten SVG till listan och `filInnehall` innehållet när filen
  sparades eller öppnades senast.
- **Autospar** en halv sekund efter den senaste ändringen, och när fliken döljs.
  Ett tomt projekt (inget utsnitt och ingen inmatning) sparas inte.
- sessionStorage `terrang-projekt-aktivt` håller reda på vilket projekt fliken har
  öppet, så att det öppnas igen efter omladdning. En ny flik börjar med ett nytt,
  tomt projekt; de sparade finns under *Senaste projekt*.
- `navigator.storage.persist()` begärs första gången ett projekt sparas.
- **Flera flikar**: `BroadcastChannel('hojdkurvor-projekt')`. Ändras samma projekt
  i en annan flik visar den här fliken *Läs in igen* och *Behåll den här
  fliken*, och sparar inget förrän man har valt.
- **Flytt från 0.12**: volymer, sektioner, horisontens punkt och projekt-id i
  sessionStorage, och första gången också det senaste utsnittet
  (`terrang-utsnitt` i localStorage), blir ett projekt. Nycklarna i
  sessionStorage tas bort; `terrang-utsnitt` ligger kvar för sidan Beställ.
  localStorage `terrang-projekt-flyttat` hindrar att utsnittet flyttas igen.

## Öppna och spara

- *Spara projektfil* (01 Plats) sparar `<namn>.hojdkurvor`. En prick på knappen
  betyder att projektet är ändrat sedan filen sparades.
- *Öppna projektfil*, eller dra filen till kartan. Finns samma projekt redan i
  webbläsaren med annat innehåll frågar appen: *Öppna filens version*, *Behåll
  webbläsarens* eller *Öppna filen som kopia* (nytt id, namnet med *(kopia)*).
- Projektfilen läggs alltid i nedladdningszippens rot, så att mappen räcker för
  att öppna projektet och skapa underlaget igen.
- En projektfil som väljs under 04 Skiss (Importera fil) öppnas som projekt.

## Inte med (än)

Förslag och sparade vyer (etapp 3), bilagor med överlagringar och anteckningar
(etapp 4), egna punkter (geologin) och jämförelse när underlaget skapas igen. Se
planen `plan-projektfil.md` i claude.ai-projektet och `docs/SYNPUNKTER.md`.
Projekten sparas aldrig på servern.
