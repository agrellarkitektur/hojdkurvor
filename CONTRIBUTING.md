# Bidra till Höjdkurvor

Tack för att du vill bidra. Läs först `README.md` (vad som finns, filer,
tjänster och inställningar, och vad som väntar under Kommande) och
`docs/UTBYTE-CAD-APA.md` om ändringen rör utbytet med ritprogrammet cad-apa.

## Avtal om bidrag (CLA)

Alla bidrag kräver att du godkänner vårt **CLA**, `CLA.md`. Du behåller
upphovsrätten till ditt bidrag, men ger Agrell Arkitektur rätt att
licensiera det också under andra villkor än AGPL. Det är vad som gör det
möjligt att sälja kommersiella undantag och att hålla ihop projektet;
bidraget finns alltid kvar under AGPL-3.0 för alla andra.

När du öppnar en pull request ber CLA Assistant dig godkänna avtalet med en
länk. Det görs en gång. En DCO (*Signed-off-by*) räcker inte, eftersom den
inte ger rätt att licensiera om.

## Så går det till

1. Öppna gärna ett ärende (issue) först och beskriv vad du vill ändra.
2. Gör en gren, och kör enhetstesterna innan du skickar en pull request:

   ```
   for f in test/*.test.js; do node "$f"; done
   ```

   Ändrar du i panelen eller på sidorna: kör också gränssnittstesterna, se
   `test/README.md`.
3. Nya källfiler börjar med licenshuvudet:

   ```js
   // SPDX-License-Identifier: AGPL-3.0-or-later
   // Copyright (C) 2026 Agrell Arkitektur
   ```

4. Lägger du till ett bibliotek, ett typsnitt, data eller någon annan
   tillgång: kontrollera att licensen är förenlig med AGPL-3.0 (MIT, BSD,
   ISC, Apache-2.0, LGPL, GPL-3.0, AGPL-3.0, MPL-2.0, SIL OFL fungerar;
   GPL-2.0-*only*, proprietära och "non-commercial"-licenser fungerar inte),
   skriv in den i `THIRD-PARTY.md` och lägg licenstexten i `vendor/licenses/`.
5. Texten i appen är på svenska, klar och enkel.

## Namn och varumärke

Namnen Höjdkurvor och höjdkurvor.se och logotypen får inte användas för
ändrade versioner utan skriftligt tillstånd.

## Frågor

kontakt@agrellarkitektur.se
