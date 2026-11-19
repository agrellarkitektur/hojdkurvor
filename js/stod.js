// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Knappen STÖD i menyraden och avsnittet Stöd utvecklingen (0.13.5), på alla sidor.
 *
 * Texten finns bara här: den visas i en dialog när man väljer STÖD, och fylls i
 * avsnittet på Om-sidan (elementet med data-stod-innehall). Byt platshållaren mot
 * QR-koden när Swish Företag finns:
 *   <img class="swish-qr" src="swish-qr.svg" alt="QR-kod för Swish" width="120" height="120">
 */
(function () {
  'use strict';
  const POST = 'kontakt@agrellarkitektur.se';
  const TEXT = `<p>Höjdkurvor är fritt att använda, också i betalda uppdrag, och ska förbli det. Inga funktioner läggs bakom betalning. Sparar tjänsten tid åt dig eller ditt kontor får du gärna hjälpa till att hålla utvecklingen igång.</p>
    <dl class="par bred stod-lista">
      <dt>Privatpersoner</dt><dd class="stod-privat">
        <div class="swish-qr platshallare" role="img" aria-label="Här kommer QR-koden för Swish">Swish-QR<br>kommer</div>
        <p>Ett frivilligt bidrag, stort eller litet, utan något krav i gengäld. Swish är på väg. Till dess får du gärna höra av dig till <a href="mailto:${POST}">${POST}</a> om du vill stödja Höjdkurvor.</p>
      </dd>
      <dt>Företag</dt><dd>Använder ert kontor Höjdkurvor kan ni teckna ett supporteravtal mot faktura, till exempel med er logotyp bland supportrarna och förtur för synpunkter och felrapporter. Vill ni bygga in Höjdkurvor i en egen produkt eller tjänst finns kommersiella licenser. Kontakt: <a href="mailto:${POST}">${POST}</a></dd>
    </dl>`;
  let dialog = null;

  function bygg() {
    dialog = document.createElement('dialog');
    dialog.className = 'synpunkter stod';
    dialog.setAttribute('aria-labelledby', 'stod-rubrik');
    dialog.innerHTML = `<form method="dialog">
      <div class="sp-huvud"><h2 id="stod-rubrik">Stöd utvecklingen</h2><button type="button" class="sp-stang" data-avbryt aria-label="Stäng">×</button></div>
      <div class="stod-text">${TEXT}</div>
      <div class="knapprad sp-knappar"><button type="button" class="knapp liten" data-avbryt>Stäng</button></div>
    </form>`;
    document.body.append(dialog);
    dialog.addEventListener('click', e => { if (e.target === dialog || e.target.closest('[data-avbryt]')) stang(); });
  }
  function oppna() {
    if (!dialog) bygg();
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
    dialog.querySelector('.sp-stang').focus();
  }
  function stang() {
    if (!dialog) return;
    if (dialog.close) dialog.close(); else dialog.removeAttribute('open');
  }

  function start() {
    document.querySelectorAll('[data-stod-innehall]').forEach(el => { el.innerHTML = TEXT; });
    document.querySelectorAll('[data-stod]').forEach(el => el.addEventListener('click', oppna));
  }
  window.HojdkurvorStod = { oppna, stang, TEXT };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}());
