// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Hämtminnet (0.14.3, AY): det som hämtats från Lantmäteriet och de andra tjänsterna under
 * Skapa sparas i minnet, så att nästa Skapa för samma område inte hämtar allt igen. Det gäller
 * höjddata, laserdata, ortofoto, byggnader, vägar, skydd och allt annat som går via fetch,
 * också geotiff-bibliotekets bitvisa läsningar (Range).
 *
 * Minnet hör till ett område (nyckeln: utsnittet och zonen). Byts området töms det. Det finns
 * bara i fliken och försvinner när sidan laddas om. Högst TAK byte; därutöver hämtas det som
 * vanligt utan att sparas.
 *
 *   Hamtminne.borja(omrade)  töm om området är ett annat, och lägg minnet framför fetch
 *   Hamtminne.sluta()        ta bort det från fetch (minnet ligger kvar)
 *   Hamtminne.tom()          töm
 *   Hamtminne.stat()         { traffar, hamtade, byte, poster } för den senaste körningen
 */
(function (rot) {
  const TAK = 900 * 1024 * 1024;
  let omradet = null, poster = new Map(), byte = 0, original = null, forut = null, traffar = 0, hamtade = 0;

  function headerVarde(h, namn) {
    if (!h) return '';
    if (typeof h.get === 'function') return h.get(namn) || '';
    for (const k of Object.keys(h)) if (k.toLowerCase() === namn) return String(h[k]);
    return '';
  }
  /** Nyckeln för ett anrop, eller null om det inte ska sparas. */
  function nyckel(input, opt) {
    const url = typeof input === 'string' ? input : (input && typeof input.href === 'string' ? input.href : null);
    if (!url || !/^https?:|^\/|^[a-z0-9_.-]+\.php/i.test(url)) return null;
    opt = opt || {};
    const metod = (opt.method || 'GET').toUpperCase();
    if (metod !== 'GET' && metod !== 'POST') return null;
    let kropp = '';
    if (opt.body != null) {
      if (typeof opt.body === 'string') kropp = opt.body;
      else if (typeof URLSearchParams !== 'undefined' && opt.body instanceof URLSearchParams) kropp = opt.body.toString();
      else return null;
    }
    return [metod, url, headerVarde(opt.headers, 'range'), kropp].join('\u0001');
  }
  function svar(p) {
    return new Response(p.data.slice(0), { status: p.status, statusText: p.statusText, headers: p.headers });
  }
  async function hamta(input, opt) {
    const k = nyckel(input, opt);
    if (!k) return original(input, opt);
    const p = poster.get(k);
    if (p) { traffar++; return svar(p); }
    const r = await original(input, opt);
    hamtade++;
    if (!(r.status === 200 || r.status === 206)) return r;
    const kopia = r.clone();
    try {
      const data = await kopia.arrayBuffer();
      if (byte + data.byteLength <= TAK) {
        const headers = [];
        r.headers.forEach((v, n) => headers.push([n, v]));
        poster.set(k, { data, status: r.status, statusText: r.statusText, headers });
        byte += data.byteLength;
      }
    } catch (e) { /* sparas inte; svaret går ändå fram */ }
    return r;
  }

  const Hamtminne = {
    TAK,
    nyckel,
    borja(omrade) {
      const o = JSON.stringify(omrade);
      if (o !== omradet) { Hamtminne.tom(); omradet = o; }
      traffar = 0; hamtade = 0;
      if (!original && typeof rot.fetch === 'function') {
        forut = rot.fetch;
        original = rot.fetch.bind(rot);
        rot.fetch = hamta;
      }
    },
    sluta() {
      if (original) { rot.fetch = forut; original = null; forut = null; }
    },
    tom() { poster = new Map(); byte = 0; omradet = null; },
    /** Samma område som minnet hör till? */
    galler(omrade) { return omradet !== null && JSON.stringify(omrade) === omradet && poster.size > 0; },
    stat() { return { traffar, hamtade, byte, poster: poster.size }; },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Hamtminne;
  else rot.Hamtminne = Hamtminne;
})(typeof window !== 'undefined' ? window : globalThis);
