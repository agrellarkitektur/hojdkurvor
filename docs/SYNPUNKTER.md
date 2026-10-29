# Synpunkter

Carl Augusts synpunkter från egen användning. Nya punkter läggs i **Inkorgen**
precis som de lämnas, med datum, utan bearbetning. När nästa version planeras
sorteras de till rätt version nedan, och en punkt som är klar stryks eller
flyttas till CHANGELOG.md.

## Inkorg

## Att testa

- iPhone: dra med två fingrar i 3D-vyn (0.8.0/0.8.1). Windows godkänt 2026-10-27.
- 0.9.0 på Windows: skuggor (datum, tid, snabbval, Spela dagen), Konturer, Husfärg och Skissfärg, Detaljerade träd, Ögonhöjd (W A S D, skift, pekarlås, Esc), Spara bild och Bild för AI (prova bilderna i Visoid).
- 0.9.1 på Windows: Konturfärg och Gränsfärg, Takformer på riktiga hus (ser taken rimliga ut?), Träd: Realistiska (utseende och om vyn blir seg), att ett klick i Ögonhöjd inte gömmer muspekaren.
- 0.9.1 på iPhone: Realistiska träd (fart), Takformer.
- 0.9.0 på iPhone: knappen Val, skuggor och tidsreglaget, ögonhöjd med spaken, att vyn inte blir för seg med skuggor och detaljerade träd (annars Trädskuggor av), Spara bild.

## 0.10.0 – rita volymer i Höjdkurvor

- (2026-10-26) Preliminärt kommer vi inte att behöva ta emot modell från cad-apa, de sköter analyserna själva. Så därför kanske vi skulle titta på att ha en enkel skissmodellsbyggare i Höjdkurvor. Där man kan rita former i 2D och extrudera upp typ, på enklaste sätt och se hur det påverkar siten.
- (2026-10-27) Bästa hade varit om man kunde sänka linjer individuellt runt takfoten för att skapa sin egen takform. Men platta volymer funkar kanske tills vidare om det är krångligt.
- (2026-10-29) Enkla volymer som skapas med numeriska mått som i CAD och snäpps mot varandra för att bygga mer komplexa geometrier.
- (2026-10-29) När två volymer har snäppts ska man kunna klicka på en kedjeikon så att de sitter ihop och flyttas samtidigt.
- (2026-10-29) Volymer ska kunna läggas i varandra för att skapa mer specifika geometrier. Union i 0.10.0, bortskärning (urtag) i 0.10.x.

## Senare / avvaktar

- (2026-10-27) Befintliga byggnader i fler format än IFC ("nått annat format också?"). IFC kom i 0.8.0; OBJ eller glTF vore nästa om något program behöver det.
