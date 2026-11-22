# Utbyte mellan Höjdkurvor och cad-apa

Version 1 av utbytet. Höjdkurvor-sidan är byggd (`js/utbyte.js`, `js/app.js`).
cad-apa-sidan ska byggas i cad-apa-projektet efter den här beskrivningen.
En enkel låtsas-cad-apa som följer beskrivningen finns i `test/cad-apa-mock.html`
och används av `test/ui_test.py`.

## Flödet

1. Användaren väljer plats och skapar underlaget i höjdkurvor.
2. **Fortsätt rita i cad-apa**: höjdkurvor öppnar cad-apa i en ny flik och skickar
   ett *platspaket* (terrängen, kurvorna, träd, vägar, stompunkter, nollpunkt och
   vridning). Om underlaget inte är skapat än skickas platsen utan terräng.
3. Användaren skissar huset i cad-apa.
4. **Pröva i höjdkurvor** (namnet bestäms i cad-apa): cad-apa skickar en *skiss*
   med volymerna tillbaka. Höjdkurvor visar dem i steg 04 Skiss och räknar med
   dem i skuggstudien, horisonten, skyfallet och platsanalysbladet nästa gång
   användaren väljer Skapa. Terrängen hämtas inte på nytt om utsnittet är samma.

Allt går mellan flikarna i webbläsaren med `postMessage`. Ingen server är inblandad.
Som reserv kan båda sidor spara och öppna filer.

## Adresser

- höjdkurvor: `https://hojdkurvor.se/` (sedan 20 november 2026, 0.14.1). Den tidigare
  adressen `https://hojdkurvor.danaid.cloud/` (17–20 november) omdirigeras dit.
  cad-apa godtar ursprunget `https://hojdkurvor.se` och skickar skissen tillbaka dit
  (gjort i cad-apa 20 november). Den tidigare adressen och agrellarkitektur.se står kvar i
  `HOJDKURVOR_ORIGINS` tills vidare och kan tas bort i en senare version där.
- cad-apa: `https://cad-apa.danaid.cloud/` (sedan 19 november 2026)

De gamla adresserna på agrellarkitektur.se (`/terrang/` och `/cad-apa/`) gäller
inte längre. Höjdkurvor läser cad-apas adress ur `config.js` (`cadApaUrl`, standard
`https://cad-apa.danaid.cloud/`). Apparna ligger på olika underdomäner, så
adressen måste vara fullständig; en relativ adress som `../cad-apa/` fungerar inte.
cad-apa behöver motsvarande inställning för höjdkurvors adress. Båda sidor ska
kontrollera `event.origin` mot den andras ursprung och skicka med det som
`targetOrigin`. Meddelanden från andra ursprung ignoreras.

## Handskakning

### höjdkurvor → cad-apa (platsen)

```
höjdkurvor: window.open(cadApaUrl + '#hojdkurvor-import', 'cad-apa')
cad-apa:    window.opener.postMessage({ typ: 'cad-apa:redo', version: 1 }, hojdkurvorOrigin)
höjdkurvor: cadApa.postMessage({ typ: 'hojdkurvor:plats', data: <platspaket> }, cadApaOrigin)
cad-apa:    window.opener.postMessage({ typ: 'cad-apa:mottaget', ok: true }, hojdkurvorOrigin)
            eller { typ: 'cad-apa:mottaget', ok: false, fel: 'kort förklaring' }
```

- cad-apa skickar `cad-apa:redo` när den har startat och ser `#hojdkurvor-import`
  i adressen och har en `window.opener`. Ta bort `#hojdkurvor-import` ur adressen
  efteråt (`history.replaceState`), så att en omladdning inte väntar på nytt.
- Höjdkurvor väntar högst 30 sekunder på `cad-apa:redo`. Efter att paketet är
  skickat väntar den 8 sekunder på kvittot och räknar det sedan som skickat.
- Fönstret heter `cad-apa`, så ett nytt klick återanvänder samma flik.
- cad-apa bör fråga innan ett öppet projekt ersätts, och annars lägga platsen
  i ett nytt projekt. `projekt.id` kan användas för att känna igen samma plats.

### cad-apa → höjdkurvor (skissen)

Två fall:

**a) cad-apa öppnades från höjdkurvor** (`window.opener` finns och har höjdkurvors
ursprung): skicka direkt.

```
cad-apa:    window.opener.postMessage({ typ: 'cad-apa:skiss', data: <skiss> }, hojdkurvorOrigin)
höjdkurvor: event.source.postMessage({ typ: 'hojdkurvor:mottaget', ok: true }, cadApaOrigin)
            eller { typ: 'hojdkurvor:mottaget', ok: false, fel: '...' }
```

**b) Höjdkurvor är inte öppen**: öppna den och vänta på att den är redo.

```
cad-apa:    const f = window.open(hojdkurvorUrl + '#cad-apa-import', 'hojdkurvor')
höjdkurvor: window.opener.postMessage({ typ: 'hojdkurvor:redo', version: 1 }, cadApaOrigin)
cad-apa:    f.postMessage({ typ: 'cad-apa:skiss', data: <skiss> }, hojdkurvorOrigin)
höjdkurvor: svarar 'hojdkurvor:mottaget' som ovan
```

I fall b) bör skissen ha med `plats` (se nedan), så att höjdkurvor kan ställa in
samma utsnitt och koordinatsystem. Användaren behöver logga in hos Lantmäteriet
och välja Skapa för att få terrängen och analyserna.

`window.open` måste anropas direkt i klickhändelsen, annars stoppar webbläsaren
fliken. Om den stoppas: visa ett meddelande och erbjud filvägen.

### Filvägen (reserv)

- Höjdkurvor sparar platspaketet som `<namn>.hkplats.json` (länken *Spara platsfil
  för cad-apa* under resultatet). cad-apa ska kunna öppna den filen.
- cad-apa sparar skissen som `<namn>.skiss.json`. Höjdkurvor öppnar den under
  04 Skiss, *Importera fil*. Där går det också att läsa fotavtryck ur en DXF
  (slutna polylinjer).

## Platspaket (höjdkurvor → cad-apa)

```jsonc
{
  "format": "hojdkurvor-plats",
  "version": 1,
  "skapad": "2026-10-18T09:12:00.000Z",
  "kalla": "Höjdkurvor 0.5.0",
  "projekt": { "id": "uuid", "namn": "Staren 2", "kommun": "Kinda" },
  "koordinatsystem": {
    "plan": { "epsg": 3009, "namn": "SWEREF 99 15 00" },
    "hojd": "RH 2000",
    "enhet": "m"
  },
  "utsnitt": { "xmin": 189620, "ymin": 6430170, "xmax": 189940, "ymax": 6430370 },
  "nollpunkt": { "x": 189620, "y": 6430170, "z": 0 },
  "vridning": 0,          // grader, se Koordinater
  "sannNord": 1.234,      // meridiankonvergens i utsnittets mitt, grader
  "terrang": {
    "rutnat": {           // markmodellen, saknas om underlaget inte är skapat
      "x0": 189620, "y1": 6430370, "s": 1, "W": 321, "H": 201,
      "z": "<base64>"     // Float32, little-endian, W*H värden, rad för rad från norr
    },
    "kurvor": [
      { "z": 114.5, "lager": "HOJDKURVA_050", "sluten": false, "pts": [[x, y], ...] }
    ]
  },
  "trad": [ { "x": 0, "y": 0, "mark": 115.84, "hojd": 14.5, "krona": 4.6,
              "art": "gran", "modell": "gran2", "vrid": 212.4, "ljus": 0.97 } ],   // art … ljus från 0.11.0
  "tradmodeller": {       // de detaljerade trädmodellerna, från 0.11.0
    "gran2": { "antal": 732, "pos": "<base64>", "farg": "<base64>" }
  },
  "vagar": [ { "typ": "secondary", "lager": "VAG_HUVUDVAG", "slag": "bil", "namn": "Bygatan", "pts": [[x, y], ...] } ],
  "vagytor": {            // utkast till vägytorna, från 0.11.0
    "bil": [ { "ringar": [[[x, y], ...], [[x, y], ...]], "yta": 1840.5 } ],
    "gang": [ ... ]
  },
  "stompunkter": [ { "namn": "Staren", "x": 0, "y": 0, "z": 114.218 } ],
  "volymer": [ /* samma form som i skissen, zonens koordinater */ ],
  "byggnader": [          // befintliga byggnader (Byggnad Nedladdning, vektor), från 0.6.0
    { "id": "uuid", "typ": "Bostad", "andamal": ["Småhus friliggande"], "husnummer": "1", "namn": null,
      "fotavtryck": [[x, y], ...], "mark": 115.2, "hojd": 7.8 }
  ],
  "fastigheter": {        // fastighetsgränser (Fastighetsindelning Nedladdning, vektor), från 0.7.0
    "granser": [ { "typ": "fastighetsgräns", "osakerhet": 4.5, "pts": [[x, y], ...] } ],
    "punkter": [ { "x": 0, "y": 0, "typ": "gränspunkt", "markering": "rör", "osakerhet": null } ],
    "ytor": [ { "beteckning": "Staren 1:2", "etikett": "1:2", "kommun": "Kinda", "typ": "fastighetsområde",
                "ringar": [[[x, y], ...], [[x, y], ...]], "ankare": [x, y], "yta": 6400 } ],
    "varning": "Gränserna i fastighetsregistrets karta är inte rättsligt bindande …"
  },
  "ortofoto": {           // ortofotot (Ortofoto Nedladdning), från 0.10.1
    "bild": "data:image/jpeg;base64,…", "x0": 189620.25, "y1": 6430369.75, "s": 0.5, "W": 640, "H": 400, "ar": 2023
  },
  "fasadsol": {           // sol på fasaderna, från 0.15.0
    "modell": "klar himmel (ESRA, Linke 3), Hay–Davies, albedo 0,2",
    "ar": 2026, "period": "21 mars–21 september", "tid": "kl. 8–17",
    "fasader": [ { "volym": "uuid", "sida": 0, "a": [x, y], "b": [x, y], "azimut": 180.6, "streck": "S",
                   "area": 891.2, "summa": 957, "lokalTopp": 850, "samtidigTopp": 850 } ],
    "horisont": [ 1.2, 1.3, … ]   // 720 höjdvinklar, sant azimut 0, 0,5 … 359,5, eller null
  },
  "lankar": { "projekt": "https://hojdkurvor.se/#p=…" },
  "licens": "Höjddata och laserdata © Lantmäteriet (CC BY 4.0). Vägar © OpenStreetMap-bidragsgivare (ODbL)."
}
```

- Alla koordinater i paketet är **zonens koordinater** (SWEREF 99-zonen i
  `koordinatsystem.plan`) i meter, höjder i RH 2000. cad-apa räknar själv om till
  sitt projekts lokala system med `nollpunkt` och `vridning`.
- `rutnat`: nod (i, j) ligger i `x = x0 + i*s`, `y = y1 - j*s`, höjden är
  `z[j*W + i]`. NaN betyder att höjd saknas. Höjdkurvor glesar ut rutnätet till
  högst 1,2 miljoner noder, så `s` kan vara större än 1 m vid stora utsnitt.
- Fält som saknas betyder att användaren inte valde det tillvalet.
- `licens` ska följa med i det cad-apa sparar eller skriver ut.
- `byggnader` (från höjdkurvor 0.6.0, fältet är nytt men version 1 gäller
  fortfarande): befintliga byggnader som berör utsnittet, hela fotavtrycket
  (sluten polygon utan upprepad första punkt). `mark` är markhöjden i RH 2000
  (median inom fotavtrycket), `hojd` höjden över mark i meter ur laserdatan
  (90:e percentilen, platt tak). Båda kan vara `null`. Fotavtrycken är oftast
  inmätta vid takkanten. Program som inte känner till fältet kan hoppa över det.
- `fastigheter` (från höjdkurvor 0.7.0, version 1 gäller fortfarande): allt är
  klippt till utsnittet. `granser` är öppna linjer per gränstyp (`typ` som i
  registret, t.ex. `fastighetsgräns`, `traktgräns`). `osakerhet` är
  lägesosäkerheten i plan i meter enligt registret, eller `null`; höjdkurvor
  streckar gränser med mer än 1 m. `punkter` är gränspunkter. `ytor` är
  fastighetsområdena inom utsnittet: `ringar[0]` är den yttre ringen och
  resten hål (slutna, utan upprepad första punkt), `etikett` den korta
  beteckningen att skriva i ytan, `ankare` en punkt inne i ytan att sätta den
  på (kan vara `null`) och `yta` arean inom utsnittet i m². En fastighet med
  flera områden har en post per område. `varning` ska visas för användaren:
  gränserna är inte inmätta och kan avvika flera meter.
- `ortofoto` (från höjdkurvor 0.10.1, version 1 gäller fortfarande): bilden
  som data-URL (JPEG, delar utan bild är vita), parallell med zonens axlar.
  `x0`/`y1` är **mitten av övre vänstra pixeln**, som i en världsfil; `s` är
  pixelstorleken i meter, `W` × `H` storleken i pixlar och `ar` flygåret.
  Sedan höjdkurvor 0.11.0 är bilden i full upplösning, samma som i zip-filen
  (högst 8 192 pixlar per sida, 0,16 m för mindre utsnitt); 0.10.1 skalade ned
  till 4 096. Bilden kan alltså vara större än vad grafikkortet klarar som en
  textur; skala ned vid behov. cad-apa läser fältet från 0.10.31
  (`PaketOrtofoto` i `src/core/siteOrtho.ts`).
- `trad` (fälten `art`, `modell`, `vrid`, `ljus` och `andrat` från höjdkurvor
  0.11.0, version 1 gäller fortfarande): `art` är `gran`, `tall`, `lov` eller
  `bjork`, gissad ur formen (höjd mot kronbredd) eller vald av användaren.
  `modell` är nyckeln i `tradmodeller` (`gran`, `gran2`, `tall`, `tall2`,
  `lov`, `lov2`, `bjork`). `vrid` är vridningen i grader moturs sett uppifrån,
  `ljus` en faktor för färgen (0,85–1,15). `andrat: true` betyder att
  användaren har rättat höjd, krona eller art; dolda träd är inte med.
- `tradmodeller` (från 0.11.0): de detaljerade low-poly-modellerna som
  träden använder, samma som i höjdkurvors 3D-vy. En modell är 1 m hög och
  1 m bred med stammens fot i origo; x österut, y norrut, z uppåt (i zonens
  riktningar). `pos` och `farg` är Float32 (little-endian, base64), tre värden
  per hörn, `antal` hörn; tre hörn i rad är en triangel (moturs sedd utifrån),
  ingen index. `farg` är linjär rgb 0–1 per hörn. Ett träd ritas med modellen
  skalad `krona` × `krona` × `hojd`, vriden `vrid` grader moturs kring z, med
  foten i (`x`, `y`, `mark`), och färgen gånger `ljus`. Ytorna är plana
  (en normal per triangel).
- `vagar` (fältet `slag` från 0.11.0): `bil` (lagren `VAG_HUVUDVAG`,
  `VAG_LOKALGATA`, `VAG_OVRIG`) eller `gang` (`VAG_GANG_CYKEL`: gång- och
  cykelvägar, stigar, trappor, trottoarer). Ett program som bara vill ha
  bilvägarna kan välja dem på `slag`.
- `vagytor` (från 0.11.0, när användaren har valt *Utkast till vägytor*):
  vägytorna per slag, ihopslagna i korsningarna och klippta mot utsnittet.
  `ringar[0]` är den yttre ringen och resten hål (slutna, utan upprepad första
  punkt); `yta` i m². Bredden är ur OSM, en schablon eller mätt i ortofotot.
  Ett utkast, inte en inmätning.

## Skiss (cad-apa → höjdkurvor)

```jsonc
{
  "format": "cad-apa-skiss",
  "version": 1,
  "kalla": "cad-apa 0.x",
  "koordinater": "lokal",           // "lokal" eller "zon"
  "plats": { /* utsnitt, koordinatsystem, nollpunkt, vridning, projekt ur platspaketet */ },
  "volymer": [
    {
      "id": "v1",
      "namn": "Hus A",
      "fotavtryck": [[100, 60], [118, 60], [118, 71], [100, 71]],
      "golv": null,                  // RH 2000 (zon) eller relativt nollpunktens z (lokal). null = på marken
      "takfot": 6.2,                 // m över golvet
      "takform": "sadel",            // "platt" | "pulpet" | "sadel" | "valm"
      "taklutning": 27,              // grader, 0–75
      "nockriktning": 0              // grader moturs från x-axeln, null = längsta sidan
    }
  ]
}
```

- `plats` är platspaketets huvud (minst `koordinatsystem`, `utsnitt`, `nollpunkt`,
  `vridning`, gärna `projekt`). Utan `terrang`, den behövs inte tillbaka.
- `koordinater: "lokal"`: punkterna är i meter i cad-apas lokala system, med
  origo i `plats.nollpunkt` och vridningen `plats.vridning` enligt formlerna under
  Koordinater. `golv` räknas då relativt `plats.nollpunkt.z`.
- `koordinater: "zon"`: punkterna är i zonens koordinater och `golv` i RH 2000.
- Fotavtrycket är en sluten polygon utan upprepad första punkt, minst tre punkter.
  Riktningen spelar ingen roll. Hål stöds inte i version 1.
- `golv: null` eller saknas: höjdkurvor sätter golvet till markhöjden i
  fotavtryckets tyngdpunkt.
- Pulpettak: högsta sidan ligger till höger om nockriktningen och taket lutar ned
  åt vänster. Sadel och valm har nocken längs nockriktningen, mitt i huset. Nockhöjden räknas ur takfot, lutning och husbredd.
- Fler takformer, våningar och öppningar kan läggas till i en senare version.
  Höjdkurvor visar ett felmeddelande om skissens `version` är högre än den klarar.

- `fasadsol` (från höjdkurvor 0.15.0, version 1 gäller fortfarande; finns när
  användaren valde *Sol på fasaderna* och skissen inte har ändrats sedan Skapa):
  instrålningen mot volymernas fasader med klar himmel. En post per fasad:
  `volym` är volymens `id`, `sida` hörnets index i fotavtrycket (moturs, sidan går
  från `a` till `b`), `azimut` fasadnormalens sanna azimut i grader, `streck`
  väderstrecket (`N`, `Ö`, `S`, `V`), `area` väggens area i m² (punkter under marken
  och inne i andra volymer räknas inte). `summa` är kWh/m² under perioden och tiden,
  `lokalTopp` det högsta timmedlet i någon punkt på fasaden (W/m², för rummen) och
  `samtidigTopp` det högsta areaviktade timmedlet för hela fasaden (W/m², för
  kylningen). Med `lokalTopp` i stället för fasta 800 W/m² blir solvärmelasten per
  rum `glasarea × g_syst × lokalTopp / golvarea`. `horisont` är terrängens horisont
  bortom 150 m sedd från volymernas mitt (samma form som horisonten i
  soldiagrammet). Beräkningen finns i `js/fasadsol.js` och kan tas till cad-apa.

## Analyserna och vad skissen behöver

Svar på AÄ (21 november 2026): vilka analyser Höjdkurvor gör och vad cad-apa därför
bör skicka tillbaka. Version 1 av skissen räcker för allt som finns i dag. Det som
behövs för det planerade står under *Önskat i version 2* och är inte bestämt; ändras
formatet ska båda sidor och `test/cad-apa-mock.html` följa med.

### Analyser i dag (0.15.0) och vad de läser ur skissen

| Analys | Läser ur skissen |
|---|---|
| Skuggstudie (valda datum och klockslag, PDF och karta) | fotavtryck, golv, takfot, takform, taklutning, nockriktning |
| Soldiagram med horisont | volymerna höjer horisonten från ögonpunkten |
| Sol på fasaderna (0.15.0) | fotavtryck, golv, takfot, takform, taklutning, nockriktning: fasaderna och gavlarna, och skuggorna mellan volymerna |
| Skyfall (lågpunkter, rinnvägar, volym i svackorna) | fotavtryck och tak: volymerna bränns in i markmodellen som hinder |
| Lutning | inget (bara marken) |
| Terrängsektioner | inget i dag: mark, träd och befintliga hus ur laserdatan. Skissen i sektionen vore ett tillägg |
| Skydd och risker: lämningar, skyddad natur, översvämning, strandskydd | inget: gäller utsnittet, inte husen |
| Platsanalysbladet (PDF) | samma som analyserna ovan |
| 3D-vyn och planvyn (byggnadskroppar) | allt i version 1; planvyn använder också fälten nedan när kroppen är ritad i Höjdkurvor |

### Önskat i version 2 (för det planerade)

| Planerat | Behöver från cad-apa |
|---|---|
| Situationsplanen (0.16.0) | per volym `status` (`ny`, `tillbyggnad`, `befintlig`, `rivs`), `huvudbyggnad`, `entre` ({ sida, t }), vilken byggnad volymen hör till (för mått mellan kroppar), och `kalla` när volymen ersätter ett befintligt hus (Lantmäteriets objektidentitet). Samma fält som `js/kropp.js` |
| Sol på fasaderna, senare | fasaderna ur fotavtryck och höjder räcker för klar himmel (byggt i 0.15.0). Senare: våningar med utkragning per våning, och fönster per fasad om instrålningen ska räknas per fönster |
| Förslag (projektfilens etapp 3) | `forslag` med samma id som i projektfilen, och förslagets namn (Basfall, Förslag A …) |
| Geologi och bergschakt | per volym schaktbotten (eller grundläggningsnivå) så att sprängning kan räknas per bergart; egna bergpunkter (x, y, berg-z) åt båda håll |
| Skyfall och lutning med ny mark | planerad markyta (höjdsättning) som rutnät eller brytlinjer; först när markplaneringen kommer |
| Urtag och egna takfotslinjer (AF, AB) | hål i fotavtrycket och egna takytor, om cad-apa ska äga den formen |

## Koordinater

Vridningen `v` är i grader, samma värde som fältet Vrid i höjdkurvor. Ritningen
vrids `v` grader medurs runt nollpunkten när den går från zonens system till det
lokala (den lokala x-axeln pekar alltså i zonens riktning (cos v, sin v)).
För en punkt (a, b) relativt nollpunkten (X0, Y0) i zonens koordinater:

```
zon → lokal:  x' =  a·cos v + b·sin v
              y' = -a·sin v + b·cos v
lokal → zon:  x  = X0 + x'·cos v − y'·sin v
              y  = Y0 + x'·sin v + y'·cos v
riktningar:   θ_zon = θ_lokal + v
```

Samma vridning används för de lokala DXF-filerna i nedladdningen, så en ritning i
cad-apa och höjdkurvors lokala DXF hamnar på samma ställe.

## Versioner

Både `format` och `version` ska kontrolleras. Nya fält som den andra sidan inte
känner till ska ignoreras. En ändring som bryter läsningen höjer `version`, och
den nya sidan ska fortsätta kunna läsa version 1.
