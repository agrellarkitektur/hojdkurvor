# Höjdkurvor

Webbapp som gör Lantmäteriets öppna geodata till ritunderlag och platsanalyser,
helt i webbläsaren. Vanlig JavaScript utan byggsteg. AGPL-3.0 eller senare
(från 0.13.2; beslutet och vad som gjordes står i `docs/LICENS.md`).
Läs `README.md` (vad som finns, filer, tjänster, inställningar) innan du ändrar
något, och `docs/UTBYTE-CAD-APA.md` innan du rör utbytet med cad-apa.
**Börja varje session med `docs/OVERLAMNING.md`**: läget, vad som ska göras
härnäst och vad som väntar. Skriv om den när sessionen slutar.

## Arbetssätt

- Appen drivs av arkitektkontoret Agrell Arkitektur; *ägaren* nedan är den som
  driver den. Kontakt i appen:
  kontakt@agrellarkitektur.se.
- Bolagsformen: skriv **Agrell Arkitektur AB** i formella texter
  (copyrightrader, CLA, avtal, `THIRD-PARTY.md`, licensbeslutet) och
  **Agrell Arkitektur** utan AB i det som syns (sidorna, sidfoten, Om-sidan).
  Se Bolagsform i `docs/LICENS.md`.
- Svara på svenska. Skriv svenska texter i appen klart och enkelt, utan
  utfyllnad. I det här projektet får du skriva färdiga texter direkt.
- Ge kommandon ett och ett, i var sin kodruta.
- Ägaren testar på iPhone 13 Pro med Chrome och Windows 11 med Chrome. Mobilen
  används mest för att läsa och markera områden; ritandet sker på datorn.
- Föreslå gärna förbättringar, men vänta med större bygget tills ägaren har sagt
  vilka som ska göras. Saker ägaren sagt att vi avvaktar med står under Kommande i
  `README.md`.
- Skriv inte ägarens namn i repot (dokumentation, kod, commits). Skriv
  *ägaren* eller formulera om, t.ex. *Synpunkter från egen användning*.

## Koden

- Varje fil i `js/` lägger ett globalt objekt på `window` (eller exporterar med
  `module.exports` när den körs i Node, för testerna). Ordningen styrs av
  `<script>`-taggarna i `index.html`.
- `js/app.js` är limmet: karta, panel, lager, ritning och Skapa-flödet. Beräkningar
  hör hemma i de andra modulerna (`karna.js`, `analys.js`, `platsanalys.js` …).
  Skapa-flödet är uppdelat i steg (`SKAPA_STEG`) som delar körningens objekt `kor`; ett
  nytt underlag blir ett nytt steg, se *Skapa-flödet i steg* i `docs/OVERLAMNING.md`.
- Koordinater: SWEREF 99-zonen i meter, höjder i RH 2000. Rutnät är
  `{ W, H, s, x0, y1, z }` där rad 0 är norr och `x0`/`y1` är noder på utsnittets
  kanter. Lokala filer räknas relativt nollpunkten och vridningen, se
  `docs/UTBYTE-CAD-APA.md`.
- Teman: `html[data-tema]` = `ritning` (Blueprint), `lugn` (Ljust), `mork` (Mörkt).
  Färger som variabler per tema i `app.css`. Ändra alla tre.
- Menyraden, ritningshuvudet och sidfoten finns i alla fyra HTML-sidor. BETA-knappen
  och formuläret Skicka synpunkter (`js/synpunkter.js`) laddas på alla fyra.
- Nya egna filer börjar med licenshuvudet (`SPDX-License-Identifier:
  AGPL-3.0-or-later` och `Copyright (C) 2026 Agrell Arkitektur AB`, se
  `CONTRIBUTING.md`); `test/kalla.test.js` kontrollerar det. Nya bibliotek,
  typsnitt och data skrivs in i `THIRD-PARTY.md` med licens.
- Länken *Källkoden* (`js/kalla.js`, AGPL §13) ska finnas på alla fyra sidor.
  Arbetsflödena skriver in commiten på raden `commit: ''`; ändra inte den.
- Inga hemligheter i repot. `config.js` ska ha `esriNyckel: ''` och
  `inloggning: null`. Testinloggningen `test` / `hemligt-åäö` finns bara i
  testservern.
- Tester pekar om adresserna med `window.TERRANG_*` (se `test/README.md`). Låt
  krokarna vara kvar, de gör inget när de inte är satta.
- Projektet (inmatning och val) sparas i IndexedDB och som projektfil, se
  `docs/PROJEKTFIL.md`. Nya saker som användaren matar in ska in i projektet
  (`byggProjekt`/`oppnaProjekt` i `app.js`), inte i sessionStorage. Ändras
  formatet så att äldre filer inte kan läsas: höj `Projekt.VERSION` och skriv en
  migrering.
- PDF:er byggs med jsPDF och typsnitten i `vendor/fonts/` via
  `Utskrift.nyttDokument`. Platsanalysbladet lägger till soldiagram och
  skuggstudie i samma dokument med `opt.dok`.

## Tester

Se `test/README.md`. Kortversion:

```
node test/platsanalys.test.js
```

```
node test/byggnad.test.js
```

```
node test/fastighet.test.js
```

```
node test/ortofoto.test.js
```

```
node test/koordinater.test.js
```

```
node test/utbyte.test.js
```

```
node test/ifc.test.js
```

```
node test/version.test.js
```

```
node test/kalla.test.js
```

```
node test/vy3d.test.js
```

```
node test/volym3d.test.js
```

```
node test/kropp.test.js
```

```
node test/kroppgeo.test.js
```

```
node test/fasadsol.test.js
```

```
node test/situationsplan.test.js
```

```
node test/dxf.test.js
```

```
node test/horisont.test.js
```

```
node test/projekt.test.js
```

```
node test/vagar.test.js
```

```
node test/objektval.test.js
```

```
node test/sol.test.js
```

```
node test/hamtminne.test.js
```

```
node test/geodata.test.js
```

```
node test/laser.test.js
```

```
node test/resultat.test.js
```

```
python3 test/server.py test/data .
```

```
python3 test/ui_test.py test/ut ritning
```

```
python3 test/mobil_test.py test/ut
```

```
python3 test/projekt_test.py test/ut ritning
```

```
python3 test/fastighetsnamn_test.py test/ut ritning
```

```
python3 test/resultat_test.py test/ut ritning
```

```
python3 test/planvy_test.py test/ut ritning
```

```
python3 test/fasadsol_test.py test/ut ritning
```

```
python3 test/situationsplan_test.py test/ut ritning
```

```
python3 test/planverktyg_test.py test/ut ritning
```

```
python3 test/las_test.py test/ut ritning
```

```
python3 test/rattelser_test.py test/ut ritning
```

```
python3 test/skapalogg_test.py test/ut ritning
```

Kör enhetstestet efter ändringar i beräkningarna och gränssnittstesterna efter
ändringar i panelen. Titta på skärmbilderna i alla tre teman, och rendera
PDF:erna (`pdftoppm`) och titta på dem. WebKit saknas i testmiljön, så be
ägaren kontrollera större gränssnittsändringar på iPhone.

Webbplatsens externa tjänster går inte att nå från testmiljön. Kontrollera
nya datakällor med webbsökning och dokumentation, och bygg dem så att appen
fungerar även när tjänsten är nere eller saknar CORS (fråga direkt först,
sedan via `geodata.php`).

## Leverera en ny version

1. Höj `version` och `datum` i `js/version.js`. Numreringen är 0.x så länge appen
   är i beta: sista siffran för rättelser (0.5.1), mittersta för nya funktioner
   (0.6.0). 1.0.0 när BETA tas bort. Kör sedan `node test/version.test.js --skriv`,
   som skriver in versionen i `?v=` på alla sidor, i `app.js` och i `vy3d.js`.
2. Skriv i `CHANGELOG.md` och i Ändringar på `om.html`.
3. Uppdatera `instruktioner.html` och `README.md` om något syns för användaren
   eller om filer, tjänster eller inställningar har ändrats.
4. Kör testerna.
5. Commit och push till `main`. Lista vilka filer som är nya eller ändrade.
6. Pushen till `main` publicerar appen på VPS:en
   (`.github/workflows/publicera-vps.yml`, rsync till
   <https://hojdkurvor.se/>). Kontrollera körningen med
   `gh api repos/agrellarkitektur/hojdkurvor/actions/runs` och att sidan
   fungerar. Steget som kontrollerar webbplatsen jämför varje fil på servern
   med repot. Arbeta därför på en egen gren tills versionen är klar. Ändras
   vilka filer appen behöver, se till att urvalet (`git archive … ':!test' …`)
   stämmer i både `publicera-vps.yml` och `release.yml`.
7. Taggen och releasen skapas av sig själv (`release.yml`) när pushen ändrar
   `js/version.js`: tagg `vX.Y.Z`, versionens avsnitt ur `CHANGELOG.md` som
   text och zip-filen. Kontrollera att releasen kom. Skapa inte taggen för hand
   före pushen, då hoppar arbetsflödet över releasen.

Appen heter Höjdkurvor i löpande text. Loggan (menyraden och PDF:erna) skriver
höjdkurvor.se med punkten i accentfärgen (från 0.14.1; `.ordbild` i sidorna,
`Utskrift.ordbild` i PDF:erna). Adressen är <https://hojdkurvor.se/> (från
0.14.1). höjdkurvor.se, www-adresserna och den tidigare adressen
hojdkurvor.danaid.cloud omdirigeras dit av Caddy (`drift/apps.caddy` i
agrellarkitektur/apps). Appen ligger kvar på samma VPS; publiceringen går med
SSH till apps.danaid.cloud. cad-apa ligger på <https://cad-apa.danaid.cloud/>
(`cadApaUrl` i `config.js`). Den gamla adressen agrellarkitektur.se/terrang/
är avstängd sedan 0.13.1. Se `docs/FLYTT.md`.

## Systerprojekt att använda som referens

Agrell Arkitekturs andra appar ligger öppet på GitHub och kan läsas (klona med
`git clone --depth 1`) för att se hur saker redan är lösta, till exempel
synpunktsformuläret, menyraden och publiceringen. Ändra inget i dem härifrån.

- cad-apa, ritprogrammet: <https://github.com/agrellarkitektur/cad-apa>
- Sisyfos, tidrapport och projektdagbok: <https://github.com/agrellarkitektur/sisyfos>

## cad-apa

Ritprogrammet cad-apa är ett eget projekt:
<https://github.com/agrellarkitektur/cad-apa>, med egen CLAUDE.md och egna
regler (bland annat: inga ändringar utan klartecken, bakåtkompatibla filformat).
Gör inte ändringar där från det här projektet. Utbytet mellan programmen är
beskrivet i `docs/UTBYTE-CAD-APA.md`; ändras det ska båda sidor och
`test/cad-apa-mock.html` följa med, och formatets `version` höjas om gamla filer
inte längre går att läsa.
