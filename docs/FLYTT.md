# Flytt till hojdkurvor.danaid.cloud

Beslut 15 november 2026: Höjdkurvor flyttar från
`https://agrellarkitektur.se/terrang/` till VPS:en på danaid.cloud. Appen heter
bara **Höjdkurvor**; den tidigare tänkta domänen höjdkurvor.se används inte.

Beslut 17 november 2026: adressen blir en egen underdomän,
`https://hojdkurvor.danaid.cloud/` (inte en mapp under apps.danaid.cloud), som
reglerna i repot agrellarkitektur/apps (`APPS.md`) säger. Varje underdomän får
egen lagring i webbläsaren, så apparna kan inte läsa varandras data. cad-apa
flyttar senare på samma sätt till `https://cad-apa.danaid.cloud/`.

Förberett i 0.12.0: namnet är bytt i appen, PDF:erna, filerna och
dokumentationen, och release-zippen har mappen `hojdkurvor`. Själva flytten är
inte gjord. Appen publiceras fortfarande till webbhotellet tills stegen nedan är
klara.

Driften på VPS:en (Caddy, PHP-FPM, msmtp, publicering med rsync) beskrivs i
README i agrellarkitektur/apps under *Så fungerar driften* och *Flytta en app
hit*.

## Innan flytten

1. **Lantmäteriet (CORS). Klart, inget att göra.** Det finns ingen lista över
   godkända webbplatser. dl1.lantmateriet.se och api.lantmateriet.se svarar med
   det ursprung webbläsaren skickar. Kontrollerat 17 november 2026 med
   `OPTIONS` och `Origin: https://apps.danaid.cloud` mot en fil i Markhöjdmodell
   (dl1, GET med `Authorization` och `Range`) och mot Stompunkt Direkt (api,
   POST med `Authorization` och `Content-Type`). Båda svarade med
   `access-control-allow-origin` lika med det skickade ursprunget. Samma prov
   kan köras igen i PowerShell (skriv `curl.exe`, inte `curl`):

   ```
   curl.exe -s -D - -o NUL -X OPTIONS "https://dl1.lantmateriet.se/hojd/data/grid/mhm/64_5/m642_53.tif" -H "Origin: https://hojdkurvor.danaid.cloud" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: authorization,range"
   ```

2. **cad-apa godtar det nya ursprunget. Väntar till cad-apa flyttar.** cad-apa
   tar bara emot platspaket från ursprungen i `HOJDKURVOR_ORIGINS` och skickar
   skissen tillbaka till `HOJDKURVOR_URL` (`src/ui/app/site.ts` i cad-apa).
   Lägg till `https://hojdkurvor.danaid.cloud` och byt adressen till
   `https://hojdkurvor.danaid.cloud/`. Det görs i cad-apa-sessionen. Tills dess
   fungerar inte Fortsätt rita i cad-apa från den nya adressen; det är godkänt.
3. **cad-apas adress i Höjdkurvor. Väntar till cad-apa flyttar.** `config.js`
   har `cadApaUrl: '../cad-apa/'`, som bara fungerar så länge båda ligger på
   agrellarkitektur.se. Med underdomäner blir det
   `cadApaUrl: 'https://cad-apa.danaid.cloud/'` (och standardvärdet i
   `js/app.js` likaså).
4. **Servern.** VPS:en kör Caddy med PHP-FPM, så `stac.php`, `geodata.php` och
   `synpunkter.php` fungerar. `.htaccess` läses inte av Caddy; dess
   inställningar (`Cache-Control: no-cache` för html, js, css och json, och
   UTF-8 som teckenkodning) står i stället i appens sajt i `drift/apps.caddy` i
   repot agrellarkitektur/apps. Det som återstår för Carl August:
   - en DNS-post `hojdkurvor` hos one.com som pekar på VPS:en (samma som `apps`),
     eller en gång för alla jokerposten `*`;
   - `sudo apps-drift nyckel hojdkurvor www/hojdkurvor` på servern, och
     utskriften som secret `APPS_SSH_KEY` i det här repot (steg 6).
5. **Synpunkter. Bestämt 17 november: e-post till kontakt@agrellarkitektur.se,
   skickad genom Loopia.** Domänen och e-posten ligger hos Loopia;
   kontakt@ är ett riktigt konto där och vidarebefordrar allt till Gmail.
   Brev direkt från VPS:en med en agrellarkitektur.se-avsändare skulle se
   förfalskade ut (VPS:en får inte skicka för domänen) och fastna i Gmail,
   särskilt efter vidarebefordran. På webbhotellet fungerade `noreply@` utan
   konto, eftersom Loopias egna servrar skickade. Därför loggar msmtp på
   VPS:en in på Loopias utgående server (`mailcluster.loopia.se`, port 465)
   som kontakt@, och brevet går vidare därifrån som ett vanligt brev från
   domänen. `synpunkter.php` är oförändrad: From och kuvertavsändaren (`-f`)
   är `from` i `feedback-config.php`, och den som skrev synpunkten står i
   Reply-To. msmtp på servern gäller alla appar där (t.ex. Tyck till i Sisyfos).

   Avsändare: i första hand `noreply@agrellarkitektur.se` med kontakt@:s
   inloggning (inget eget konto). Godtar inte Loopia en annan avsändare än
   kontot används `kontakt@` som avsändare; då ska kontakt@ inte längre vara
   *Skicka som* i Gmail, annars läggs breven i Skickat i stället för Inkorgen
   (Carl August har sagt att det går bra att ta bort).

   Det Carl August gör (en gång), på VPS:en:

   a. `/etc/msmtprc`:

      ```
      sudo nano /etc/msmtprc
      ```

      ```
      defaults
      auth on
      tls on
      tls_trust_file /etc/ssl/certs/ca-certificates.crt
      syslog LOG_MAIL

      account loopia
      host mailcluster.loopia.se
      port 465
      tls_starttls off
      from noreply@agrellarkitektur.se
      user kontakt@agrellarkitektur.se
      password LÖSENORDET

      account default : loopia
      ```

      Lösenordet är kontakt@:s. PHP körs som `www-data`, som måste kunna läsa
      filen men ingen annan:

      ```
      sudo chown root:www-data /etc/msmtprc
      ```

      ```
      sudo chmod 640 /etc/msmtprc
      ```

   b. Mottagaren och avsändaren, i appens mapp (publiceringen hoppar över
      `*-config.php`):

      ```
      printf "<?php\nreturn ['to' => 'kontakt@agrellarkitektur.se', 'from' => 'noreply@agrellarkitektur.se'];\n" | sudo tee /srv/apps/www/hojdkurvor/feedback-config.php
      ```

   c. Prova från servern, som PHP gör:

      ```
      printf "Subject: Prov från hojdkurvor\nFrom: noreply@agrellarkitektur.se\n\nProv." | sudo -u www-data msmtp -f noreply@agrellarkitektur.se kontakt@agrellarkitektur.se
      ```

      - Inget fel: brevet ska komma till Gmails inkorg. Öppna det, *Visa
        original*: SPF eller DKIM ska stå som PASS. Hamnar det i Skräppost:
        markera *Inte skräppost* och gör ett filter på avsändaren med *Skicka
        aldrig till skräppost*.
      - Fel om avsändaren (t.ex. *Sender address rejected* eller *not owned
        by user*): byt `noreply@` mot `kontakt@` på raden `from` i
        `/etc/msmtprc` och i `feedback-config.php` (kör b igen med kontakt@),
        ta bort kontakt@ som *Skicka som* i Gmail, och prova igen.
      - Andra fel: `sudo journalctl -t msmtp -n 20`.

   d. Öppna <https://hojdkurvor.danaid.cloud/synpunkter.php>: ska svara
      `"ok":true`. Skicka sedan en synpunkt med formuläret i appen.

   Annan väg som övervägts: att appen skickar synpunkterna till
   `synpunkter.php` på webbhotellet, som redan fungerar. Valdes bort, eftersom
   filen då måste ligga kvar där och de andra apparna på VPS:en inte får e-post.
6. **Publiceringen. Klar 17 november.** `.github/workflows/publicera-vps.yml`
   lägger appen på VPS:en med rsync över SSH (mallen `drift/publicera-app.yml` i
   agrellarkitektur/apps) vid varje push till `main`, med samma kontroller och
   samma urval som `publicera.yml`. Secret `APPS_SSH_KEY` är nyckeln från
   `sudo apps-drift nyckel hojdkurvor www/hojdkurvor`; `.github/known_hosts` är
   kopierad från `drift/known_hosts` i apps. Efter uppladdningen hämtas varje
   fil från `https://hojdkurvor.danaid.cloud/` och jämförs. Tills flytten är
   klar publiceras appen till båda ställena; `publicera.yml` (FTP) tas bort
   när den gamla adressen bara är en omdirigering.

## Själva flytten

1. Publicera till den nya adressen (sker vid varje push; för hand under Actions
   → Publicera på VPS:en).
2. Prova där: inloggning, Skapa med ortofoto, byggnader och fastigheter, Skicka
   synpunkter. Fortsätt rita i cad-apa och skissen tillbaka provas när cad-apa
   har flyttat (steg 2 och 3).
3. Lägg en omdirigering på den gamla adressen, så att sparade länkar och
   projektlänkar (`#p=…`) fungerar. Webbläsaren skickar inte med det som står
   efter `#` till servern, så omdirigeringen görs med en liten sida som för
   vidare hela adressen. Byt `public_html/terrang/` mot bara en `index.html`:

   ```html
   <!doctype html>
   <meta charset="utf-8">
   <title>Höjdkurvor har flyttat</title>
   <script>location.replace('https://hojdkurvor.danaid.cloud/' + location.pathname.replace(/^.*\/terrang\/?/, '') + location.search + location.hash);</script>
   <p>Höjdkurvor har flyttat till <a href="https://hojdkurvor.danaid.cloud/">hojdkurvor.danaid.cloud</a>.</p>
   ```

4. Uppdatera adressen i `README.md`, `CLAUDE.md`, `docs/UTBYTE-CAD-APA.md`,
   `docs/OVERLAMNING.md` och `CLAUDE.md` (steg 6 under Leverera), ta bort
   `publicera.yml`, och ändra `url` i katalogposten `apps/hojdkurvor/app.json` i agrellarkitektur/apps.

## Det som inte följer med

Webbläsarens lagring hör till ursprunget. På den nya adressen börjar varje
användare om med: tema och inställningar, rättade tak, träd och dolda hus
(`terrang-takval`, `-tradval`, `-husval`), det senaste utsnittet och de sparade
kommunfilerna i IndexedDB. Projektfilen (planerad i 0.13.0) gör det möjligt att
ta med sig sitt arbete; flyttar appen före den bör användarna få veta det på
Om-sidan.
