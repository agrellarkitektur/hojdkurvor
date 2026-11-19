// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Knappen STÖD i menyraden och avsnittet Stöd utvecklingen (0.13.5), på alla sidor.
 *
 * Texten finns bara här: den visas i en dialog när man väljer STÖD, och fylls i
 * avsnittet på Om-sidan (elementet med data-stod-innehall). Swish-QR:n (0.13.6) är
 * bilder/swish-qr.png, ur Swish egen QR-fil (ramen borttagen, loggan kvar). Koden pekar
 * på SWISH_URL; på mobilen öppnar ett tryck på bilden samma länk.
 */
(function () {
  'use strict';
  const POST = 'kontakt@agrellarkitektur.se';
  const NUMMER = '123-718 06 15';
  const SWISH_URL = 'https://app.swish.nu/1/p/sw/?sw=1237180615&msg=Stort%20tack%20f%C3%B6r%20ditt%20st%C3%B6d!&src=qr';
  const TEXT = `<p>Höjdkurvor är fritt att använda, också i betalda uppdrag, och ska förbli det. Inga funktioner läggs bakom betalning. Sparar tjänsten tid åt dig eller ditt kontor får du gärna hjälpa till att hålla utvecklingen igång.</p>
    <div class="stod-del">
      <h3>Privatpersoner</h3>
      <div class="stod-privat">
        <a class="swish-qr" href="${SWISH_URL}" title="Öppna Swish"><img src="bilder/swish-qr.png" alt="QR-kod för Swish till ${NUMMER}" width="132" height="132"></a>
        <p>Ett frivilligt bidrag, stort eller litet, utan något krav i gengäld. Skanna koden med Swish eller swisha till <strong class="swish-nr">${NUMMER}</strong>. Mottagaren heter Danaid Open Source. På mobilen kan du trycka på koden.</p>
      </div>
    </div>
    <div class="stod-del">
      <h3>Företag</h3>
      <p>Använder ert kontor Höjdkurvor kan ni teckna ett supporteravtal mot faktura, till exempel med er logotyp bland supportrarna och förtur för synpunkter och felrapporter. Vill ni bygga in Höjdkurvor i en egen produkt eller tjänst finns kommersiella licenser.</p>
    </div>
    <p class="stod-kontakt">Kontakt: <a href="mailto:${POST}">${POST}</a></p>`;
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
  window.HojdkurvorStod = { oppna, stang, TEXT, SWISH_URL };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}());
