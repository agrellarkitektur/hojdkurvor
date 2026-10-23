# Utbyte mellan höjdkurvor.se och cad-apa

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

- höjdkurvor: `https://agrellarkitektur.se/terrang/` (senare `https://höjdkurvor.se/`)
- cad-apa: `https://agrellarkitektur.se/cad-apa/`

Höjdkurvor läser cad-apas adress ur `config.js` (`cadApaUrl`, standard `../cad-apa/`).
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
  "kalla": "höjdkurvor.se 0.5.0",
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
  "trad": [ { "x": 0, "y": 0, "mark": 115.84, "hojd": 14.5, "krona": 4.6 } ],
  "vagar": [ { "typ": "secondary", "lager": "VAG_HUVUDVAG", "namn": "Bygatan", "pts": [[x, y], ...] } ],
  "stompunkter": [ { "namn": "Staren", "x": 0, "y": 0, "z": 114.218 } ],
  "volymer": [ /* samma form som i skissen, zonens koordinater */ ],
  "byggnader": [          // befintliga byggnader (Byggnad Nedladdning, vektor), från 0.6.0
    { "id": "uuid", "typ": "Bostad", "andamal": ["Småhus friliggande"], "husnummer": "1", "namn": null,
      "fotavtryck": [[x, y], ...], "mark": 115.2, "hojd": 7.8 }
  ],
  "lankar": { "projekt": "https://…/terrang/#p=…" },
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
