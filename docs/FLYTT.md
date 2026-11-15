# Flytt till apps.danaid.cloud/hojdkurvor

Beslut 15 november 2026: Höjdkurvor flyttar från
`https://agrellarkitektur.se/terrang/` till
`https://apps.danaid.cloud/hojdkurvor/`. Appen heter bara **Höjdkurvor**; den
tidigare tänkta domänen höjdkurvor.se används inte.

Förberett i 0.12.0: namnet är bytt i appen, PDF:erna, filerna och
dokumentationen, och release-zippen har mappen `hojdkurvor`. Själva flytten är
inte gjord. Appen publiceras fortfarande till webbhotellet tills stegen nedan är
klara.

## Innan flytten

1. **Lantmäteriet (CORS).** dl1.lantmateriet.se släpper bara igenom anrop från
   godkända ursprung. Ansök om att `https://apps.danaid.cloud` godkänns, för
   alla produkter appen använder: Markhöjdmodell och Laserdata skog (STAC och
   filer), Ortofoto, Byggnad och Fastighetsindelning Nedladdning. Utan det
   stoppas hämtningen. Behåll `https://agrellarkitektur.se` som godkänt under
   övergången.
2. **cad-apa.** cad-apa tar bara emot platspaket från ursprungen i
   `HOJDKURVOR_ORIGINS` och skickar skissen tillbaka till `HOJDKURVOR_URL`
   (`src/ui/app/site.ts` i cad-apa). Lägg till `https://apps.danaid.cloud` och
   byt adressen till `https://apps.danaid.cloud/hojdkurvor/`. Det görs i
   cad-apa-sessionen, inte härifrån.
3. **cad-apas adress i Höjdkurvor.** `config.js` har `cadApaUrl: '../cad-apa/'`.
   Det fungerar bara om cad-apa också ligger på apps.danaid.cloud
   (`/cad-apa/`). Ligger cad-apa kvar på agrellarkitektur.se: sätt
   `cadApaUrl: 'https://agrellarkitektur.se/cad-apa/'`.
4. **Servern.** PHP behövs för `stac.php`, `geodata.php` och
   `synpunkter.php` (med `mail()` eller en annan väg att skicka e-post).
   `.htaccess` förutsätter Apache med mod_headers och mod_mime; på nginx görs
   motsvarande inställningar i serverkonfigurationen (`Cache-Control:
   no-cache` för html, js, css och json, och UTF-8 som teckenkodning).
5. **Synpunkter.** `feedback-config.php` ska ligga i mappen ovanför appen eller
   i appens mapp. `from` måste vara en adress som servern får skicka från
   (SPF/DMARC för domänen), annars fastnar breven. Kontrollera genom att öppna
   `…/hojdkurvor/synpunkter.php` i webbläsaren.
6. **Publiceringen.** `.github/workflows/publicera.yml` läser allt ur
   inställningar i repot:
   - secrets `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` och `FTP_DIR` (den nya
     mappen på servern),
   - variabeln `SIDA_URL` = `https://apps.danaid.cloud/hojdkurvor/`, som
     kontrollen efter uppladdningen jämför mot.
   Arbetsflödet laddar upp med FTPS. Har servern bara SFTP måste steget bytas
   (till exempel mot rsync över SSH med en nyckel som secret).

## Själva flytten

1. Publicera till den nya adressen (ändra secrets och `SIDA_URL`, kör
   arbetsflödet för hand).
2. Prova där: inloggning, Skapa med ortofoto, byggnader och fastigheter,
   Fortsätt rita i cad-apa och skissen tillbaka, Skicka synpunkter.
3. Lägg en omdirigering på den gamla adressen, så att sparade länkar och
   projektlänkar (`#p=…`) fungerar. Webbläsaren skickar inte med det som står
   efter `#` till servern, så omdirigeringen görs med en liten sida som för
   vidare hela adressen. Byt `public_html/terrang/` mot bara en `index.html`:

   ```html
   <!doctype html>
   <meta charset="utf-8">
   <title>Höjdkurvor har flyttat</title>
   <script>location.replace('https://apps.danaid.cloud/hojdkurvor/' + location.pathname.replace(/^.*\/terrang\/?/, '') + location.search + location.hash);</script>
   <p>Höjdkurvor har flyttat till <a href="https://apps.danaid.cloud/hojdkurvor/">apps.danaid.cloud/hojdkurvor</a>.</p>
   ```

4. Uppdatera adressen i `README.md`, `CLAUDE.md`, `docs/UTBYTE-CAD-APA.md`,
   `docs/OVERLAMNING.md` och standardvärdet för `SIDA_URL` i `publicera.yml`.

## Det som inte följer med

Webbläsarens lagring hör till ursprunget. På den nya adressen börjar varje
användare om med: tema och inställningar, rättade tak, träd och dolda hus
(`terrang-takval`, `-tradval`, `-husval`), det senaste utsnittet och de sparade
kommunfilerna i IndexedDB. Projektfilen (planerad i 0.13.0) gör det möjligt att
ta med sig sitt arbete; flyttar appen före den bör användarna få veta det på
Om-sidan.
