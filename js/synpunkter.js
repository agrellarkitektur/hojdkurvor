/*
 * BETA-knappen i menyraden och formuläret Skicka synpunkter (0.7.0), på alla sidor.
 *
 * Formuläret skickas till synpunkter.php i samma mapp, som mejlar det vidare.
 * Inga personuppgifter krävs; e-post fylls i bara om man vill ha svar. Ett dolt
 * fält och en tidsspärr håller robotar borta. Går skriptet inte att nå (testmiljön,
 * eller en server utan PHP) öppnas ett mejl med texten i stället. Svarar skriptet
 * med ett fel visas felet, så att det går att rätta på servern. Samma upplägg som
 * i cad-apa.
 */
(function () {
  'use strict';
  const POST = 'kontakt@agrellarkitektur.se';
  const ADRESS = window.TERRANG_SYNPUNKTER || 'synpunkter.php';   // testkrok
  const version = () => (window.HOJDKURVOR ? window.HOJDKURVOR.version : '?');
  const sida = () => (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
  let dialog = null, oppnad = 0;

  function bygg() {
    dialog = document.createElement('dialog');
    dialog.className = 'synpunkter';
    dialog.setAttribute('aria-labelledby', 'sp-rubrik');
    dialog.innerHTML = `<form method="dialog" novalidate>
      <div class="sp-huvud"><h2 id="sp-rubrik">Skicka synpunkter</h2><button type="button" class="sp-stang" data-avbryt aria-label="Stäng">×</button></div>
      <p class="hjalp">Höjdkurvor är en betaversion. Berätta vad som fungerar, vad som saknas och vad som blir fel. Allt läses.</p>
      <label for="sp-text">Synpunkt</label>
      <textarea id="sp-text" name="message" rows="7" maxlength="5000" required placeholder="Till exempel vad du försökte göra och vad som hände"></textarea>
      <label for="sp-epost">E-post, om du vill ha svar</label>
      <input id="sp-epost" name="email" type="email" autocomplete="email" spellcheck="false" placeholder="namn@exempel.se">
      <label class="sp-falla" aria-hidden="true">Lämna tomt<input name="website" tabindex="-1" autocomplete="off"></label>
      <p class="hjalp">Med skickas versionen, vilken sida du är på och skärmens storlek, inget annat. Ingen e-post betyder att synpunkten är anonym.</p>
      <p class="sp-status hjalp" role="status" aria-live="polite"></p>
      <div class="knapprad sp-knappar"><button type="button" class="knapp liten" data-avbryt>Avbryt</button><button type="submit" class="knapp liten sp-skicka">Skicka</button></div>
    </form>`;
    document.body.append(dialog);
    dialog.addEventListener('click', e => {
      if (e.target === dialog || e.target.closest('[data-avbryt]')) stang();
    });
    dialog.querySelector('form').addEventListener('submit', e => { e.preventDefault(); skicka(e.target); });
  }

  function oppna() {
    if (!dialog) bygg();
    const f = dialog.querySelector('form');
    f.reset();
    f.querySelector('.sp-status').textContent = '';
    f.querySelector('.sp-skicka').disabled = false;
    oppnad = Date.now();
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
    f.querySelector('textarea').focus();
  }
  function stang() {
    if (!dialog) return;
    if (dialog.close) dialog.close(); else dialog.removeAttribute('open');
  }

  async function skicka(f) {
    const text = f.message.value.trim(), epost = f.email.value.trim();
    const status = f.querySelector('.sp-status'), knapp = f.querySelector('.sp-skicka');
    if (!text) { status.textContent = 'Skriv något först.'; f.message.focus(); return; }
    if (epost && !f.email.checkValidity()) { status.textContent = 'E-postadressen ser inte rätt ut.'; f.email.focus(); return; }
    const kropp = {
      message: text, email: epost, website: f.website.value, elapsed: Date.now() - oppnad,
      version: 'höjdkurvor.se ' + version(), sida: sida(), screen: `${window.innerWidth}×${window.innerHeight}`,
    };
    knapp.disabled = true;
    status.textContent = 'Skickar …';
    let svar = null, data = null;
    try {
      svar = await fetch(ADRESS, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(kropp) });
      data = await svar.json().catch(() => null);
    } catch (e) { svar = null; }
    if (svar && svar.ok && data && data.ok) {
      status.textContent = 'Tack! Synpunkten är skickad.';
      setTimeout(stang, 1600);
      return;
    }
    knapp.disabled = false;
    const mejl = () => {
      const amne = encodeURIComponent(`Synpunkt på ${kropp.version}`);
      const brod = encodeURIComponent(`${text}\n\n— ${kropp.version}, sidan ${kropp.sida}, skärm ${kropp.screen}`);
      location.href = `mailto:${POST}?subject=${amne}&body=${brod}`;
    };
    const medMejl = forklaring => {
      status.textContent = forklaring + ' ';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'lank-knapp'; b.textContent = 'Skicka med e-post i stället';
      b.addEventListener('click', mejl);
      status.append(b);
    };
    if (svar && data && data.error) { medMejl(`${data.error} (svar ${svar.status})`); return; }
    if (svar && svar.status !== 404 && svar.status !== 405 && svar.status !== 501) {
      medMejl(`Servern svarade med fel ${svar.status} och kunde inte ta emot synpunkten.`);
      return;
    }
    // Inget skript att skicka till: öppna ett mejl med texten.
    status.textContent = 'Formuläret kan inte skickas härifrån, så ett mejl med texten öppnas i stället.';
    mejl();
  }

  function start() {
    document.querySelectorAll('.hk-version').forEach(el => { el.textContent = version(); });
    document.querySelectorAll('[data-synpunkter]').forEach(el => el.addEventListener('click', oppna));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.Synpunkter = { oppna, stang };
}());
