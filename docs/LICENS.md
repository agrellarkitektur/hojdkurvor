# Licensbeslut: AGPL-3.0 + kommersiella undantag (Höjdkurvor)

*19 november 2026. Kopierat från `docs/LICENS.md` i cad-apa (genomfört där i 0.12.5.4), med Höjdkurvors rad i tabellen under "Projektspecifikt". Genomfört i Höjdkurvor 0.13.2.*

## Beslutet i korthet

1. **Licens: GNU AGPL-3.0-or-later** (ersätter GPL-3.0).
2. **Kommersiella undantag** säljs av Agrell Arkitektur AB till den som vill bygga in koden i något stängt.
3. **Bidrag från andra kräver ett CLA**, så att möjligheten att sälja undantag finns kvar.
4. **Namnen skyddas separat**. Licensen täcker koden, inte namnet.
5. **Finansiering** sker via frivilliga bidrag från privatpersoner och supporteravtal med företag. Inga funktioner läggs bakom betalning.

## Varför inte GPL-3.0

GPL-3.0 kräver bara att källkoden delas när programmet *distribueras*. En webbapp som körs på någon annans server distribueras aldrig till användaren. Någon kan alltså ta koden, ändra lite, stänga in den och sälja den som betaltjänst utan att dela en rad. AGPL-3.0 är GPL-3.0 plus ett tillägg (§13): den som låter användare köra en ändrad version över nätet måste erbjuda dem hela källkoden.

## Vad målet är

- Personer och företag ska kunna **använda** programmen fritt, även i betalda uppdrag. Att spara pengar på dem är hela poängen.
- Ingen ska kunna **ta koden, stänga in den och sälja den**.
- Det ska vara **enkelt och riskfritt att gå över** från de stora kommersiella programmen.

## Vad det betyder för olika grupper

| Vem | Vad som gäller |
|---|---|
| Arkitektkontor och privatpersoner som använder programmet | Inga skyldigheter alls. Fri användning, även kommersiellt. |
| Den som kör en **oförändrad** version på egen server | Fritt. Länken till källkoden ska finnas kvar. |
| Den som kör en **ändrad** version som tjänst | Måste erbjuda användarna sin ändrade källkod under AGPL. |
| Den som vill bygga in koden i en **stängd** produkt eller tjänst | Måste köpa ett kommersiellt undantag av Agrell Arkitektur AB. |

**Säljargument för riskfri övergång:** koden kan aldrig låsas in. Om Agrell Arkitektur slutar utveckla programmet kan vem som helst fortsätta köra det och vidareutveckla det, och användarnas ritningar och data blir aldrig gisslan.

## Kommersiella undantag ("selling exceptions")

- Bara upphovsrättsinnehavaren kan bevilja undantag. Den som själv har fått koden under AGPL kan inte göra det.
- FSF, organisationen bakom GPL, beskriver och godtar upplägget i Richard Stallmans text *Selling Exceptions to the GNU GPL*. Kända exempel är MySQL och Qt.
- Formellt heter det att *sälja undantag* och inte dubbellicens, eftersom koden bara släpps under en licens (AGPL). I vardagligt tal säger man ändå ofta "dual licensing".
- Avtalet skrivs först när någon hör av sig, gärna med hjälp av en jurist.
- Stora företag som Google förbjuder AGPL-kod helt internt. De kommer alltså inte att använda koden gratis. Målgruppen för undantag är främst mellanstora företag som vill bygga in programmet i egna produkter.

**Om uppköp:** AGPL hindrar inte ett uppköp. Den som köper projektet köper upphovsrätten och kan då själv välja licens för framtida versioner. Det förutsätter att Agrell Arkitektur AB äger hela koden, vilket är ytterligare ett skäl till CLA. Redan släppta versioner förblir AGPL för alla som har dem.

## Bidrag och CLA

- Den som bidrar med kod behåller upphovsrätten till sitt bidrag. Utan avtal kan Agrell Arkitektur AB inte sälja undantag för den delen.
- Därför ska alla externa bidrag ske under ett **CLA (Contributor License Agreement)**. I det ger bidragsgivaren Agrell Arkitektur AB rätt att licensiera bidraget även under andra villkor än AGPL.
- På GitHub kan det skötas automatiskt med till exempel CLA Assistant: bidragsgivaren godkänner en gång via en länk i pull requesten.
- En DCO ("Signed-off-by") räcker *inte*, eftersom den inte ger rätt att licensiera om.

## Beroenden och tredjepartstillgångar

Kontrollera att alla tredjepartsbibliotek och tillgångar har licenser som är förenliga med AGPL-3.0:
- **Fungerar:** MIT, BSD, ISC, Apache-2.0, LGPL, GPL-3.0, AGPL-3.0, MPL-2.0, SIL Open Font License.
- **Fungerar inte:** GPL-2.0-*only*, proprietära licenser, "non-commercial"-licenser.
- Kommersiella undantag gäller bara Agrell Arkitektur AB:s egen kod. Ett undantag kan inte omfatta någon annans GPL-kod.
- Lista alla tredjepartstillgångar med licens i en fil, till exempel `THIRD-PARTY.md`, och behåll deras licenstexter i repot.

### Typsnitten (Höjdkurvor)

Familjen Grotesk och IBM Plex Mono, båda SIL OFL. Ingen risk; de bäddas in i PDF:erna utan att PDF:erna blir OFL.

## Bolagsform och namn (gäller alla projekten)

*19 november 2026, ägarens beslut. Gäller Höjdkurvor, cad-apa och Sisyfos; den som licensierar om Sisyfos eller går igenom cad-apa ska följa det här.*

- Projekten ägs av **Agrell Arkitektur AB**. Det är bolaget som har upphovsrätten, säljer kommersiella undantag, tecknar supporteravtal och är part i CLA:t.
- **Formella texter** skriver **Agrell Arkitektur AB**: copyrightraden i licenshuvudet (`Copyright (C) 2026 Agrell Arkitektur AB`), `CLA.md`, avtal, `THIRD-PARTY.md` och licensbeslutets juridiska delar.
- **Synliga texter** skriver **Agrell Arkitektur**, utan AB: appens sidor, Om-sidan, sidfoten, menyer och marknadsföring.
- I CLA:t är avtalsparten *Agrell Arkitektur AB, Sweden, represented by its authorised signatory (firmatecknare)*. Ägarens namn behövs inte.
- Status: Höjdkurvor har AB i CLA.md, THIRD-PARTY.md och här sedan 19 november; copyrightraderna i källfilerna har AB från versionen efter 0.13.2. cad-apa (0.12.5.4) har kvar `Carl August Agrell / Agrell Arkitektur` och en CLA-part som enskild näringsidkare, och behöver samma ändring i en cad-apa-session.

## Varumärke

Licensen skyddar inte namnen. Lägg in en rad i README om att projektets namn och logotyp inte får användas för ändrade versioner utan tillstånd. Registrering av varumärket kan bli aktuellt om projektet växer.

## Finansiering: stöd och supporteravtal

Två flöden, eftersom privatpersoner och företag har olika behov:

| | Privatpersoner | Företag |
|---|---|---|
| Form | Frivilligt bidrag, inget i utbyte | Supporteravtal, till exempel ett årsbelopp |
| Betalning | Swish-QR på Om-sidan (Swish Företag), GitHub Sponsors för utlandet | Faktura |
| Moms | Troligen ingen (gåva utan motprestation) | 25 % (företaget drar av den) |
| Motprestation | Ingen, bara ett tack | Logga på supportersidan, eventuellt prioriterad felrapportering |
| Kvitto | Inget krav, kvitto erbjuds på begäran | Fakturan |

- **Inkomstskatt:** alla bidrag är skattepliktig intäkt i näringsverksamheten, även om de kallas gåvor.
- **Moms:** ett helt frivilligt bidrag utan motprestation är troligen inte omsättning och därmed momsfritt. Får givaren något tillbaka blir det en försäljning med moms.
- **Företag** kan i praktiken inte swisha, och en gåva är inte avdragsgill för dem. Därför gäller faktura och supporteravtal.
- **Kassaregister:** Swish räknas som kortbetalning, men rena gåvor är ingen försäljning och betalning via webben omfattas normalt inte. Gränsen är dessutom fyra prisbasbelopp per år.
- **Bokföring:** Swish-notisen räcker inte som underlag. Spara bankens Swish-rapport.
- **Trappan för företag:** stöd → support → kommersiellt undantag. Allt går till kontakt@agrellarkitektur.se.
- **Ton:** säg "Stöd utvecklingen", inte "donation". Inga funktioner bakom betalning och inget tjat.
- **Att stämma av** med revisor eller Skatteupplysningen innan start: att Swish-bidragen kan bokföras som momsfria gåvor, och om de ska hållas isär från arkitektverksamheten med eget Swish-nummer.

## Genomförande: checklista per repo

Ifylld för Höjdkurvor.

- [x] Ersätt `LICENSE` med den officiella AGPL-3.0-texten (https://www.gnu.org/licenses/agpl-3.0.txt), oförändrad.
- [x] Sätt licensfältet i `package.json` (eller motsvarande) till `"AGPL-3.0-or-later"`. *(Höjdkurvor har ingen `package.json`; licensen står i `LICENSE`, README och licenshuvudet.)*
- [x] Byt licenshuvuden i källfilerna till `// SPDX-License-Identifier: AGPL-3.0-or-later` plus copyrightrad.
- [x] Lägg till en **länk till källkoden i själva appen**, till exempel i sidfot eller "Om"-ruta. Det är kärnan i AGPL §13, och den ska följa med i ändrade versioner.
- [x] Lägg in licensavsnittet i README (mall nedan).
- [ ] Skapa `CONTRIBUTING.md` med CLA-krav och koppla CLA Assistant om repot ligger på GitHub. *(CONTRIBUTING.md och CLA.md finns; kopplingen och juristens granskning återstår, som i cad-apa.)*
- [x] Gå igenom beroendenas och tillgångarnas licenser och skriv `THIRD-PARTY.md`.
- [x] Lägg till sektionen **Stöd utvecklingen** på Om-sidan. *(Claude skrev texten direkt, som ägaren bett om i det här projektet. Swish står som planerat, med kontakt till dess.)*
- [x] Notera i ändringsloggen från vilken version AGPL gäller. Tidigare versioner är fortfarande GPL-3.0.

### Så gjordes det i Höjdkurvor (0.13.2, 19 november 2026)

- **LICENSE:** gnu.org:s `agpl-3.0.txt`, 661 rader och 34 523 byte (samma fil som i cad-apa, sha256 `8486a10c…07ef`). Den gamla GPL-texten ligger i `LICENSES/GPL-3.0.txt`, eftersom versionerna till och med 0.13.1 är GPL.
- **Licenshuvudet** i alla egna källfiler (`js/`, `config.js`, `app.css`, php, html, testerna och arbetsflödena), två rader: `SPDX-License-Identifier: AGPL-3.0-or-later` och `Copyright (C) 2026 Agrell Arkitektur AB` (utan AB till och med 0.13.2, se Bolagsform nedan). Ägarens namn står inte i repot (se CLAUDE.md). `vendor/` har kvar sina egna huvuden. `test/kalla.test.js` kontrollerar huvudet.
- **Källkodslänken** (`js/kalla.js`): appen har inget byggsteg, så publiceringen (`publicera-vps.yml`) och releasen (`release.yml`) skriver in commiten på raden `commit: ''` i det som laddas upp och packas. Länken *Källkoden* står i panelens fot på kartan, i sidfoten på de andra sidorna och på Om-sidan (källkoden, licensen och `THIRD-PARTY.md` vid samma commit). I repot går länkarna till repot.
- **THIRD-PARTY.md** (förut `THIRD_PARTY.md`) med bibliotek, typsnitt, data i repot och data som hämtas. Alla beroenden var förenliga: Leaflet (BSD-2-Clause), proj4js, geotiff.js, JSZip, jsPDF, sql.js, copc.js och three.js (MIT), LERC och laz-perf (Apache-2.0), pako (MIT och Zlib), SQLite (allmän egendom), typsnitten OFL. Lantmäteriets och de andra källornas data är inte kod och har egna villkor. `data/kommuner.json` saknar licensfil hos källan ("Feel free to reuse").
- **CONTRIBUTING.md** och **CLA.md** efter cad-apa, med Höjdkurvor och de skyddade namnen Höjdkurvor och höjdkurvor.se. CLA:t är märkt som utkast (som i cad-apa), och avtalsparten är Agrell Arkitektur AB genom sin firmatecknare.
- **Stöd utvecklingen** på `om.html` (avsnittet `#stod`): privatpersoner med frivilligt bidrag och Swish som planerat, företag med supporteravtal mot faktura och kommersiella licenser, kontakt@agrellarkitektur.se.
- **Taggar och releaser:** `release.yml` fanns redan sedan 0.13.1 och taggar och släpper varje ny version i `js/version.js` vid push till main. Texten tas ur versionens avsnitt i `CHANGELOG.md`, som i Höjdkurvor motsvarar README:s versionsavsnitt i cad-apa.

### Kvar för ägaren (Höjdkurvor)

1. **Koppla CLA Assistant** för repot agrellarkitektur/hojdkurvor, med `CLA.md` i en gist, som i cad-apa.
2. **Juristen:** CLA.md (samma text som i cad-apa) och avtalet om kommersiellt undantag.
3. ~~**Swish**~~ klart i 0.13.6: QR-koden (`bilder/swish-qr.png`, mottagare Danaid Open Source, 123-718 06 15) i Stöd utvecklingen, och texten om att Swish är på väg är borta.

## Mall: licensavsnitt i README

> **Licens**
> [Projektnamn] är fri programvara under GNU Affero General Public License v3.0 eller senare (AGPL-3.0-or-later). Du får använda, studera, ändra och dela programmet fritt, även i kommersiellt arbete. Kör du en ändrad version som tjänst måste du erbjuda användarna din källkod.
>
> **Kommersiell licens**
> Vill du bygga in [projektnamn] i en produkt eller tjänst utan AGPL:s villkor finns kommersiella licenser. Kontakta kontakt@agrellarkitektur.se.
>
> **Namn och varumärke**
> Namnet [projektnamn] och dess logotyp får inte användas för ändrade versioner utan skriftligt tillstånd.
>
> **Bidrag**
> Bidrag välkomnas och kräver att du godkänner vårt CLA, se CONTRIBUTING.md.

## Projektspecifikt

| Projekt | Projektnamn i mallen | Skyddade namn | Tredjepartstillgångar att kolla | Repo / anm. |
|---|---|---|---|---|
| cad-apa | cad-apa | cad-apa, Bacchus | osifont (GPL-3.0 + typsnittsundantag), Archivo, IBM Plex Mono, Arimo och Josefin Sans (OFL) | agrellarkitektur/cad-apa; genomfört i 0.12.5.4 utom CLA Assistant och Swish-QR:n |
| Sisyfos | Sisyfos | Sisyfos | | |
| Höjdkurvor | Höjdkurvor | Höjdkurvor, höjdkurvor.se | Lantmäteriets data (egna villkor, ej kod) | agrellarkitektur/hojdkurvor; genomfört i 0.13.2 utom CLA Assistant och Swish |

*Sisyfos och Höjdkurvor: kopiera hela dokumentet, byt "cad-apa" i rubrik och inledning, ta bort avsnittet om cad-apas typsnitt och fyll i er rad i tabellen.*

## Källor

- Richard Stallman / FSF: *Selling Exceptions to the GNU GPL*: https://www.gnu.org/philosophy/selling-exceptions.html
- GNU AGPL-3.0, licenstext: https://www.gnu.org/licenses/agpl-3.0.html
- GNU GPL FAQ om typsnittsundantaget: https://www.gnu.org/licenses/gpl-faq.html#FontException
- Googles AGPL-policy: https://opensource.google/documentation/reference/using/agpl-policy
- Heather Meeker: *AGPL in the Light of Day*: https://heathermeeker.com/2023/10/13/agpl-in-the-light-of-day/
- Skatteverket om kassaregister och Swish: https://www.skatteverket.se/foretag/drivaforetag/kassaregister

*Underlaget är inte juridisk rådgivning eller skatterådgivning. Låt en jurist granska det kommersiella avtalet och CLA-texten, och en revisor bokföringen av bidragen, innan de används.*
