// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur
/*
 * Länken till källkoden (0.13.2, AGPL-3.0 §13): den som använder appen över
 * nätet ska erbjudas källkoden till just den version som körs.
 *
 * I repot är `commit` tom och länkarna går till repot. När appen publiceras
 * (publicera-vps.yml, release.yml) skrivs commiten in här, så att länken går
 * till koden vid den commiten. Låt raden med den tomma commiten stå kvar som
 * den är; arbetsflödena letar efter den. Den som kör en ändrad version byter
 * `repo` till sitt eget.
 *
 * Länkar med `data-kalla` får adressen till källkoden, länkar med
 * `data-kalla-fil="LICENSE"` adressen till filen vid samma commit.
 */
(function () {
  'use strict';
  const KALLA = {
    repo: 'https://github.com/agrellarkitektur/hojdkurvor',
    commit: '',
  };

  const giltig = c => typeof c === 'string' && /^[0-9a-f]{7,40}$/.test(c);

  function url(commit = KALLA.commit) {
    return giltig(commit) ? `${KALLA.repo}/tree/${commit}` : KALLA.repo;
  }

  function filUrl(fil, commit = KALLA.commit) {
    return `${KALLA.repo}/blob/${giltig(commit) ? commit : 'main'}/${fil}`;
  }

  function satLankar(rot) {
    rot.querySelectorAll('a[data-kalla]').forEach(a => { a.href = url(); });
    rot.querySelectorAll('a[data-kalla-fil]').forEach(a => { a.href = filUrl(a.dataset.kallaFil); });
  }

  const api = { KALLA, url, filUrl, satLankar };
  if (typeof window !== 'undefined') window.Kalla = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => satLankar(document));
    else satLankar(document);
  }
  if (typeof module !== 'undefined') module.exports = api;
})();
