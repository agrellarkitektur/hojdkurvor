# Skissa i 3D (0.17.0)

Planen för skissverktyget i 3D-fönstret, som också är verktyget för användarskapad omgivning (CL–CV i
`docs/SYNPUNKTER.md`). Fördes in 25 november 2026 från claude.ai-projektet
(`overlamning-skissa-i-3d.md`, `plan-versioner-2026-11-24.md`, `synpunkter-skissa-prototyp-6.md`).
Utredningen bakom (omgivning, bibliotek, villkor, API) är `utredning-anvandarskapad-omgivning.md` där.

**Prototypen** ligger i `docs/prototyper/skissa-i-3d.html` (prototyp 7, en fil, three.js r128 och
polygon-clipping 0.15.7 från CDN). Den är referensen för beteendet och har algoritmerna. Den körs
fristående och följer inte med appen (`docs/` är undantaget i publiceringen). Ägaren har testat
version 1–6; version 7 är bara kontrollerad i kod. **Beslut 25 november: prototypen är färdig**,
fortsatta synpunkter tas i appen.

## Beslut

- 24 november: *Modellera omgivning* blir inget eget verktyg. Det är skissfunktionen i 3D-fönstret.
  Skillnaderna: om kroppen hör till projektet eller omgivningen, och att en omgivningsbyggnad kan
  delas med Höjdkurvor. Laserdatan är snäppkälla och startvärde för *Ersätt*.
- 24 november: valm och halvvalm är inga takformer utan inställningar per ände.
- 22 november: inget snäpp mot Lantmäteriets fotavtryck; de syns bara som tonad referens.
- Standardhusen är förval i nya projekt.
- CU:s kopia av modellens geometri, *Ny version finns* och markeringen av hus med alternativ väntar
  till biblioteket (etapp 3).

## Det som byggs i 0.17.0

Allt som prototypen visar, i 3D-fönstret, med lägena **Visa** (titta, ta bilder; inget går att
ändra) och **Skissa** (ändra; blå ram runt vyn, svagt blått rutnät på marken).

- **Styrning:** vänster redigerar bara. Mitthjulet panorerar, Shift + mitthjulet snurrar, och Shift
  läses vid varje rörelse så att läget byter mitt i draget. OrbitControls klarar inte det, så
  mitthjulet hanteras av egen kod som i prototypen. Höger gör ingenting. Kameran går ner till
  ögonhöjd (1,6 m över terrängen); därefter lutar blicken uppåt.
- **Basformer:** block, cylinder, N-hörn (3–32), sfär (diameter och synlig höjd), mur (polylinje)
  och polygon (tjocklek och höjd över mark). Innergård är en inställning på block, cylinder och
  N-hörn.
- **Takformer:** platt, pulpet, sadel, brutet (mansard), pyramid och valv för block; platt, kon och
  kupol för cylinder; platt och pulpet för polygon.
- **Ändarna på block:** gavelns lutning (lodrät, som takfallen eller egen), var lutningen börjar
  (halvvalm) och gering i plan. Geringen fäster vid 180°/n, som ger regelbundna 3–8-hörningar. Alla
  vinklar med två decimaler.
- **Innergården:** ett husdjup för alla längor. Varje hörn har två möjliga gavelspetsar: ingen ger
  gering, en låter den längan gå igenom, två ger korsade tak. I vyn klickar man på trianglar för att
  växla.
- **Handtag:** push-pull på sidor och ovansida (bara handtagen är redigerbara, inte ytorna), grepp i
  hörnen som flyttar kroppen och fäster mot andra hörn, nockände, var lutningen börjar, gering,
  husdjup, punkterna i mur och polygon, och höjd över mark. Klick utan drag gör att handtaget följer
  pekaren. Värden skrivs med siffror och Enter, och måttet står kvar tills nästa klick.
- **Verktyg:** Ersätt (startar ur laserdatan och känner igen innergård), Vrid i tre klick (punkt,
  referens, mål; 45°-steg, Shift 15°), Stapla, Kopia, Spegla (ändar och punkter speglas), Förena
  (J; Ctrl+G och Ctrl+J är webbläsarens), Lås, Mät (M), Ångra/Gör om, Ctrl+C/X/V/D/A, Delete, Esc.
- **Snäpp:** växlarna Kroppar (K) och Laser (L), Alt för inget snäpp. Mur och polygon fäster
  parallellt eller vinkelrätt mot andra kanter (inom 1,7°) före 45°-steget.
- **Roll:** projekt eller omgivning. Knappen *Dela med andra i Höjdkurvor* finns men är avstängd.
- **Panelen:** BYA och BTA. Våningar uppskattas ur vägghöjden (3 m per våning) om inget värde är
  satt. BTA räknas våning för våning som unionen av kropparna med minst k våningar.
- **CE:** dölja hus även i planvyn.

### Det som appen måste lösa och prototypen hoppar över

- **Terrängen.** I prototypen är `markH(x, z)` 0. I appen följer murens punkter och botten
  terrängen, och överkanten följer marken eller går rakt. Sockeln går till lägsta marken under huset
  + 0,5 m. Öppen fråga: polygonens höjd över mark från lägsta marken under den eller per punkt.
- **Riktig laserdata** som snäppkälla och för Ersätt (prototypen har en påhittad ytmodell på
  1 m-rutor). Pröva om kanterna blir för brusiga.
- **Yttre skal.** Förenade kroppar ritas som överlappande volymer. Exporten och analyserna behöver en
  riktig sammanslagning utan skarvlinjer och dubbla väggar. BYA räknas redan med polygonunion.
- **Analyser och export** (skugga, sol på fasader, horisont, skyfall, DXF, mesh, skissfilen till
  cad-apa). Enklast: alla kroppar ger en triangelmesh från samma geometrifunktioner som 3D-vyn, och
  fotavtrycken ger polygoner (`fotPolys`).
- **Situationsplanen:** muren som dubbellinje, polygonen som kontur, skärmtak streckat.

## Datamodellen (byggd i 0.16.5)

Etapp 2 och 3 i granskningens etappordning (`granskning-0.16.2-C.md`) är gjorda i 0.16.5, utan att
något syns i appen. **Ägarens beslut 28 november**: ta inte hänsyn till det som redan är ritat, gör det
som är bäst för appen på lång sikt. Det gav:

- **Parametrarna ligger i `primitiv`**, i kroppens lokala system kring mitten (`u`, `v`; `v` norrut vid
  vridning 0). Då följer lokala punkter, ändar och gård med oförändrade när projektet räknas om mellan
  zoner, och bara mitten och vridningen räknas om, som i dag. Fälten står i `docs/PROJEKTFIL.md`,
  *Kropparna i Skissa i 3D*. Prototypens lokala `lz` (söderut) vänds i en funktion,
  `Kroppgeo.tillProto`, så att resten av prototypens kod kan flyttas som den är (risk R10).
- **`polygon` står kvar som egen basform** med dagens takformer (platt, pulpet, sadel, valm ur
  `plan()`). Den behövs för fria fotavtryck: hus från Lantmäteriet, DXF och cad-apa. `prisma` läses
  som ett block med sadel, valm eller pulpet (pulpettaket vrids ett halvt varv, eftersom prototypen har
  högsidan på norrsidan). När 0.17.0 skriver nya kroppar kan prisman skrivas om till block i en migrering.
- **`golv` är alltid RH 2000.** Ytan (skärmtak) har sin höjd över mark inräknad i golvet.
- **Härledd geometri**: `Kroppgeo.harledd(v, { markH })` ger fotavtrycket som ringar med hål och en
  sluten triangelmesh med utåtvända normaler, i zonen. `Volym3D.harledd` gör samma sak för alla
  volymer, också dagens polygoner. `Kroppgeo.hojdVid` ger taket i en punkt ur meshen.
- **Dagens fält skrivs fortfarande**: `Volym3D.uppdatera` sätter `fotavtryck`, `takform`, `taklutning` och
  `nockriktning` ur parametrarna, så att analyserna, situationsplanen och cad-apa läser kroppen som förut.
  Det som inte går att säga med dem (`Volym3D.nyForm`: halvvalm, mansard, valv, gård, mur, sfär …) ger
  `plan() = null`, och `hojdVid`, `inutiVolym` och `topp` räknas ur meshen.
- **Planvyn låter nya kroppar vara** (`Kropp.satHorn`, `satFotavtryck`, `satTakform`, `satNock`) tills
  den lär sig dem (etapp 7).
- **Tillbaka från cad-apa**: en kropp som inte är ändrad där behåller sina parametrar
  (`Volym3D.behallForm`). Förut blev en cylinder en polygon med 32 hörn efter en tur dit och tillbaka.
- **Projektfilen är version 2**, så att 0.16.4 och äldre inte plattar till nya kroppar.
- **Unionen**: prototypen använde polygon-clipping. Appen har en egen union (`Kropp.union`) och bygger
  vidare på den; inget nytt bibliotek.

Prövat i `test/kroppgeo.test.js`: volym och area mot räknade värden för alla basformer och takformer,
sluten mesh och utåtvända normaler, taket i punkter (halvvalm, valm), riktningarna (gering, gårdens
hörn, ytans lutning, murens punkter), marken (mur och sockel), att dagens prisma ger samma tak ur meshen
som ur takfallens plan, projektfilen (fält, kontroll av tal, omräkning mellan zoner) och utbytet med
cad-apa.

**Kvar till 0.17.0** (etapp 4–8): analyserna (skuggor, sol på fasaderna, horisont, skyfall, BYA, DXF, IFC,
platspaketet) ska läsa `harledd` i stället för fotavtrycket som en ring, så att gård, mur och sfär räknas
rätt; 3D-vyn ska rita meshen; verktygen; planvyn och situationsplanen; riktig laserdata. Kända
förenklingar i meshen: en gård med gavlar i hörnen har tak som överlappar i hörnet; en fri polygon med
fall och ett inbuktat fotavtryck får taket som lyfta trianglar utan gavlar (som rutnätet i 3D-vyn i dag).

## Algoritmerna i prototypen (flytta, skriv inte om)

- **Tak med ändar** (`profil`, `takKedjor`, `blixtlas`, `takGeo`): tvärsnittet dras ut längs
  kroppen; varje ände klipps av geringen (`xe(s, z) = s·(B + tan g · z)`) och av lutningen (indrag per
  höjd). Nivån där lutningen börjar läggs in som extra punkter i tvärsnittet, och ändytan byggs i band
  nerifrån och upp, så att halvvalm och brutna ändar blir plana.
- **Innergård** (`vingar`): längor med samma husdjup, gerade hörn 45° i rektangel och 180°/n i
  n-hörn; flaggorna per hörn avgör om en länga går igenom med gavel.
- **Mur** (`murKant`, `murGeo`) med gerade skarvar; **polygon med pulpettak** (`ytaPulpet`).
- **Area** (`fotPolys`, `area`, `bta`): fotavtryck i världskoordinater, union med polygon-clipping.
- **Snäpp** (`pekPunkt`, `kroppStopp`, `laserKant`, `hojdKandidater`, `parallellKant`).
- **Förena** (`slaIhop`): valmar raka gavlar (gering 0) som står inne i en annan del.

Geometrifunktionerna är provade i Node med three.js, inte mot riktig data.

## Därefter: biblioteket med rättade volymer

Beslutat i utredningen: inga konton, bidrag publiceras direkt, CC BY 4.0 plus upplåtelse till
Agrell Arkitektur AB, hantera-länk, rapportering, ett litet API på VPS:en med SQLite, och inget öppet
inskick förrän en jurist har granskat villkoren. Förslag till ordning (stäm av med ägaren först):

1. 0.17.0: omgivningskroppar sparas med `roll: omgivning` och ersätter huset i analyser och export.
2. Biblioteket läsbart (etapp 3, CÅ): `GET /bibliotek?bbox=…`, `GET /bibliotek/{id}`, valet per
   byggnad, kopian av geometrin i projektfilen med *Ny version finns*. Ägaren lägger in de första
   landmärkena bakom inloggning.
3. Öppet inskick (etapp 4, CÄ) efter juristgranskningen.

Öppna frågor: ska etapp 3 komma direkt efter 0.17.0 (versionsplanen har projektfilen etapp 3 som
0.20.0)? Gränser för rimlighetskontrollerna? Biblioteket som öppen data? Polygonens höjd i lutande
terräng? Svar från Lantmäteriet om att rita ovanpå deras underlag (frågan skickad 27 november)? Objektidentiteten används inte i biblioteket: matchningen sker på en kontrollsumma av fotavtrycket och i andra hand på överlapp (beslut 27 november, CÅ).

## Synpunkter på prototyperna, 24–25 november

Ägarens synpunkter i sak, med vad som gjordes (*kursivt*).

**Prototyp 1 (→ 2).** Vänsterklick för att snurra drar runt saker; som i cad-apa: mitthjulet
panorerar, Shift + mitthjulet snurrar. Redigeringen hade fördröjning. Hörn för storlek är vanskligt:
push-pull på sidorna, hörnen flyttar. Vrid som eget verktyg i tre klick. Generella basformer med
takform som tillval, inte specifika objekt (en spira är ett block med pyramidtak). Taklutning i
grader. *Allt inarbetat; dämpningen borttagen och bara ändrade kroppar byggs om under drag.*

**Prototyp 2 (→ 3).** Push-pull snäppte bara mot laser; välja snäpp mot laser eller volymer;
push-pull ska bara starta på handtaget; golvnivå och sockel ner i marken; vyn ska snurra med Shift +
mitthjulet (också i appens 3D-vy); vanliga tangentkommandon; skriva in längd vid push-pull med
motsatt sida som referens; omgivning är samma verktyg som skissen. *Allt inarbetat; växlarna Kroppar
och Laser, Alt utan snäpp, `golv` och `sockel` (null = automatisk) i datamodellen.*

**Prototyp 3 (→ 4).** Skriva grader efter vridning; måttet ska stå kvar; 45°-snäpp vid vridning;
nockänden ska kunna dras in; lägena Visa och Skissa; låsa volymer; slå ihop block (innergårdar utan
gavelspetsar); n-hörningar; *Tält* heter Pyramid; samma underlag som 3D-vyn (ortofoto) med en
diskret påminnelse om skissläget; Shift ska kunna bytas mitt i mitthjulsdraget. *Allt inarbetat.*

**Prototyp 4 (→ 5).** Gering per ände (45° i hörn); lutande gavel, valmat pulpet- och mansardtak,
brutet tak saknades: valm och halvvalm som inställning per ände; innergård som inställning med ett
husdjup och val av gavelspetsar i hörnen; Ctrl+J hellre än Ctrl+G. *Inarbetat; takformerna Platt,
Pulpet, Sadel, Brutet, Pyramid, Valv.*

**Prototyp 5 (→ 6).** Ctrl+G och Ctrl+J är webbläsarens (*Förena på J*); Förena valmade gerade ändar
(*bara raka gavlar valmas*); två decimaler och geringen fäster vid 3–8-hörningar; area för enskilda
och sammanslagna; sfär; mur/plank som polylinje med toppen efter marken eller rak; polygon med
tjocklek och höjd över mark (skärmtak); titta uppåt (*ögonhöjd 1,6 m*); välja gavelspets per hörn på
innergården med trianglar; innergården i panelen, inte bland basformerna. Öppet: stympad kon eller
pyramid.

**Prototyp 6 (→ 7, godkänt 25 november).** Claudes fyra förslag: våningar och BTA; mätverktyget;
parallellt och vinkelrätt snäpp när man ritar mur och polygon; pulpettak på polygonen (Vänd lutningen
90°). Sadeltak och valm på fria polygoner tas inte nu.
