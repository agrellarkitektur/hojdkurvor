// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Vägar från OpenStreetMap (ODbL) via Overpass API, som mittlinjer i utsnittet.
 *
 * Sedan 0.11.0 delas de i bilvägar och gångvägar (`slag`: 'bil' eller 'gang'), och appen kan
 * göra ett utkast till vägytorna: bredden ur OSM-taggarna (width, lanes) eller en schablon per
 * vägtyp, för bilvägarna mätt i ortofotot om det finns. Ytorna slås ihop i ett rutnät (så att
 * korsningarna blir en sammanhängande yta) och ritas som slutna polylinjer. Ingen AI: mätningen
 * går ut från mittlinjen åt båda håll och stannar där färgen slutar likna vägbanan.
 *
 * Sedan 0.14.3 (AJ, AV) har varje sträcka mellan två korsningar en och samma bredd (medianen av
 * mätningen, avrundad till halv meter), korta sträckor får bredden från resten av samma gata,
 * och hörnen i korsningarna rundas av med en radie (bilvägar 6 m), som en stängning av ytan
 * nära korsningarna.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Vagar = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const T = () => (typeof Terrang !== 'undefined' ? Terrang : globalThis.Terrang);
  const URL_STD = 'https://overpass-api.de/api/interpreter';
  const URL_RESERV = 'https://overpass.kumi.systems/api/interpreter';

  // lager, DXF-färg (ACI), linjebredd i utskriften (mm), streckning och slag (bil eller gång)
  const KLASSER = {
    VAG_HUVUDVAG: { aci: 1, mm: 0.55, slag: 'bil', namn: 'Huvudvägar (motorväg till tertiär väg)' },
    VAG_LOKALGATA: { aci: 7, mm: 0.4, slag: 'bil', namn: 'Lokalgator, bostadsgator och tillfarter' },
    VAG_OVRIG: { aci: 8, mm: 0.3, slag: 'bil', namn: 'Övriga vägar (skogsbilväg, traktorväg m.fl.)' },
    VAG_GANG_CYKEL: { aci: 3, mm: 0.22, streck: true, slag: 'gang', namn: 'Gång- och cykelvägar, stigar och trappor' },
  };
  // vägytorna (0.11.0)
  const YTLAGER = {
    // namnen säger att ytorna är beräknade (0.12.0): ur ortofotot, OSM:s bredd eller en schablon
    VAG_YTA_BIL_BERAKNAD: { aci: 8, namn: 'Bilvägarnas ytor, beräknade ur ortofotot (utkast)' },
    VAG_YTA_GANG_BERAKNAD: { aci: 3, namn: 'Gång- och cykelvägarnas ytor, beräknade (utkast)' },
  };
  const SLAGNAMN = { bil: 'Bilvägar', gang: 'Gång- och cykelvägar' };

  function klass(h) {
    if (/^(motorway|trunk|primary|secondary|tertiary)(_link)?$/.test(h)) return 'VAG_HUVUDVAG';
    if (/^(residential|unclassified|living_street|service|road)$/.test(h)) return 'VAG_LOKALGATA';
    if (/^(footway|cycleway|path|pedestrian|steps|bridleway|corridor|sidewalk|crossing)$/.test(h)) return 'VAG_GANG_CYKEL';
    if (/^(proposed|construction|abandoned|disused|razed|platform|raceway|bus_stop|elevator)$/.test(h)) return null;
    return 'VAG_OVRIG';
  }
  const slag = lager => (KLASSER[lager] ? KLASSER[lager].slag : 'bil');

  /*
   * Bredd i meter för hela vägen (båda riktningarna) när OSM inte anger den. Ungefärliga mått för
   * svenska vägar (vägbana utan diken); motorväg och motortrafikled är en körbana per riktning i OSM.
   */
  const SCHABLON = {
    motorway: 11, trunk: 9, primary: 8, secondary: 7, tertiary: 6.5,
    motorway_link: 5.5, trunk_link: 5.5, primary_link: 5, secondary_link: 5, tertiary_link: 5,
    residential: 5.5, unclassified: 5, living_street: 4.5, road: 5, service: 3.5, track: 3,
    footway: 2, cycleway: 2.5, path: 1.2, pedestrian: 5, steps: 1.8, bridleway: 2, corridor: 2, sidewalk: 2, crossing: 2.5,
  };
  const KORFALT = 3.25;
  /** OSM:s width ("5", "5.5 m", "5,5") i meter, eller null. */
  function tolkaBredd(v) {
    if (v == null) return null;
    const m = /^\s*([0-9]+(?:[.,][0-9]+)?)\s*(m)?\s*$/.exec(String(v));
    if (!m) return null;
    const b = parseFloat(m[1].replace(',', '.'));
    return b > 0.3 && b < 60 ? b : null;
  }
  /** Bredden för en linje: { bredd, kalla } där kalla är 'osm' (width), 'korfalt' (lanes) eller 'schablon'. */
  function schablon(l) {
    const b = tolkaBredd(l.bredd);
    if (b) return { bredd: b, kalla: 'osm' };
    const k = parseInt(l.korfalt, 10);
    if (k > 0 && k < 12 && slag(l.lager) === 'bil') return { bredd: Math.round((k * KORFALT + 0.5) * 10) / 10, kalla: 'korfalt' };
    let s = SCHABLON[l.typ];
    if (s == null) s = slag(l.lager) === 'gang' ? 1.5 : 4;
    if (l.typ === 'service' && /^(driveway|parking_aisle)$/.test(l.service || '')) s = 3;
    if (l.enkelriktad && /^(primary|secondary|tertiary|residential|unclassified)$/.test(l.typ)) s = Math.max(3.5, s * 0.6);
    return { bredd: s, kalla: 'schablon' };
  }

  /** Klipper en polylinje mot en rektangel (Liang–Barsky per segment). Returnerar delar. */
  function klipp(pts, r) {
    const delar = [];
    let aktuell = null;
    for (let i = 1; i < pts.length; i++) {
      let [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const dx = x1 - x0, dy = y1 - y0;
      let t0 = 0, t1 = 1, ok = true;
      for (const [p, q] of [[-dx, x0 - r.xmin], [dx, r.xmax - x0], [-dy, y0 - r.ymin], [dy, r.ymax - y0]]) {
        if (p === 0) { if (q < 0) { ok = false; break; } }
        else {
          const t = q / p;
          if (p < 0) { if (t > t1) { ok = false; break; } if (t > t0) t0 = t; }
          else { if (t < t0) { ok = false; break; } if (t < t1) t1 = t; }
        }
      }
      if (!ok) { aktuell = null; continue; }
      const a = [x0 + t0 * dx, y0 + t0 * dy], b = [x0 + t1 * dx, y0 + t1 * dy];
      if (!aktuell || t0 > 0) { aktuell = [a]; delar.push(aktuell); }
      aktuell.push(b);
      if (t1 < 1) aktuell = null;
    }
    return delar.filter(d => d.length > 1);
  }

  /** Gör om Overpass-svaret till linjer i zonen, klippta mot r (utan marginal: ytorna behöver vägarna lite utanför). */
  function tolka(d, tillZon, r, marg = 0) {
    const rm = { xmin: r.xmin - marg, ymin: r.ymin - marg, xmax: r.xmax + marg, ymax: r.ymax + marg };
    const linjer = [];
    for (const el of d.elements || []) {
      if (el.type !== 'way' || !el.geometry || !el.tags) continue;
      const tg = el.tags;
      const lager = klass(tg.highway || '');
      if (!lager) continue;
      if (tg.area === 'yes' && tg.highway !== 'pedestrian') continue;
      const pts = el.geometry.map(g => tillZon([g.lon, g.lat]));
      const extra = {};
      if (tg.width != null) extra.bredd = tg.width;
      if (tg.lanes != null) extra.korfalt = tg.lanes;
      if (tg.oneway === 'yes' || tg.oneway === '1') extra.enkelriktad = true;
      if (tg.surface) extra.ytskikt = tg.surface;
      if (tg.service) extra.service = tg.service;
      for (const del of klipp(pts, rm)) linjer.push(Object.assign({ lager, slag: slag(lager), typ: tg.highway, namn: tg.name || '', pts: del }, extra));
    }
    return linjer;
  }

  /**
   * Hämtar vägar inom utsnittet (i zonen). Returnerar { linjer: [{lager, slag, typ, namn, pts, bredd?, …}], antal }.
   * `linjer` är klippta mot utsnittet; `alla` går `marg` meter utanför (för ytorna).
   */
  async function hamta({ utsnitt: r, epsg, marg = 20 }) {
    const tillLL = T().omvandlare(epsg, 4326).forward, tillZon = T().omvandlare(4326, epsg).forward;
    const hörn = [[r.xmin - marg, r.ymin - marg], [r.xmax + marg, r.ymin - marg], [r.xmax + marg, r.ymax + marg], [r.xmin - marg, r.ymax + marg]].map(tillLL);
    const s = Math.min(...hörn.map(p => p[1])), n = Math.max(...hörn.map(p => p[1]));
    const w = Math.min(...hörn.map(p => p[0])), e = Math.max(...hörn.map(p => p[0]));
    const fraga = `[out:json][timeout:25];way["highway"](${s.toFixed(6)},${w.toFixed(6)},${n.toFixed(6)},${e.toFixed(6)});out geom tags;`;
    // Overpass svarar ofta 429, 502 eller 504 när den är överbelastad: två nya försök med paus (0.13.4),
    // och sedan samma sak mot reservservern (0.16.1, som i Geodata)
    const pauser = (typeof self !== 'undefined' && self.TERRANG_PAUSER) || [2000, 5000];
    const servrar = (typeof self !== 'undefined' && self.TERRANG_OVERPASS) ? [self.TERRANG_OVERPASS] : [URL_STD, URL_RESERV];
    const TILLF = [429, 502, 503, 504];
    // Varje försök har en tidsgräns (0.16.5, DU): utan den kunde Skapa vänta hur länge som helst på vägarna.
    const tid = (typeof self !== 'undefined' && self.TERRANG_OVERPASS_TID) || 40000;
    let svar = null, natfel = false, tidsgrans = false, text = null;
    for (const url of servrar) {
      svar = null; natfel = false; tidsgrans = false;
      for (let i = 0; ; i++) {
        const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), tid);
        try {
          svar = await fetch(url, { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(fraga) });
          text = svar.ok ? await svar.text() : null;
        } catch (err) {
          if (ctrl.signal.aborted) tidsgrans = true; else natfel = true;
          svar = null;
        } finally { clearTimeout(t); }
        if (!svar) break;   // ingen ny fråga mot en server som inte svarar: reservservern i stället
        if (!TILLF.includes(svar.status) || i >= pauser.length) break;
        await new Promise(klar => setTimeout(klar, pauser[i]));
      }
      if (svar && !TILLF.includes(svar.status)) break;
    }
    if (!svar && tidsgrans) throw new Error(`OpenStreetMap (Overpass) svarade inte inom ${Math.round(tid / 1000)} s${servrar.length > 1 ? ', inte heller reservservern' : ''}. Uppdatera om en stund; det som redan är hämtat hämtas inte igen.`);
    if (!svar) throw new Error('kunde inte nå OpenStreetMap (Overpass).');
    if (TILLF.includes(svar.status)) throw new Error(`OpenStreetMap är överbelastat just nu (svarade ${svar.status} vid ${pauser.length + 1} försök${servrar.length > 1 ? ', också på reservservern' : ''}). Försök igen om en stund.`);
    if (!svar.ok) throw new Error(`OpenStreetMap svarade ${svar.status}.`);
    const d = JSON.parse(text);
    const linjer = tolka(d, tillZon, r, 0), alla = tolka(d, tillZon, r, Math.min(marg, 15));
    return { linjer, alla, antal: linjer.length };
  }

  // ------------------------------------------------------------------
  // Bredden mätt i ortofotot (0.11.0)
  // ------------------------------------------------------------------
  /** Punkter längs linjen var `steg` meter, med normal (åt vänster) i varje punkt. */
  function stationer(pts, steg) {
    const ut = [];
    let rest = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], L = Math.hypot(x1 - x0, y1 - y0);
      if (!L) continue;
      const ux = (x1 - x0) / L, uy = (y1 - y0) / L;
      let t = rest;
      for (; t <= L + 1e-9; t += steg) ut.push({ x: x0 + ux * t, y: y0 + uy * t, nx: -uy, ny: ux });
      rest = t - L;
    }
    const sista = pts[pts.length - 1];
    if (ut.length && Math.hypot(ut[ut.length - 1].x - sista[0], ut[ut.length - 1].y - sista[1]) > steg * 0.3) {
      const f = ut[ut.length - 1];
      ut.push({ x: sista[0], y: sista[1], nx: f.nx, ny: f.ny });
    }
    // normalen i en punkt: medel av grannarnas riktningar, så att svängar inte ger hack
    for (let k = 0; k < ut.length; k++) {
      const a = ut[Math.max(0, k - 1)], b = ut[Math.min(ut.length - 1, k + 1)], L = Math.hypot(b.x - a.x, b.y - a.y);
      if (L > 1e-6) { ut[k].nx = -(b.y - a.y) / L; ut[k].ny = (b.x - a.x) / L; }
    }
    return ut;
  }
  /** Pixelns färg (r, g, b) i punkten, eller null utanför bilden eller där bilden är tom (vit). */
  function pixel(bild, x, y) {
    const i = Math.round((x - bild.x0) / bild.s), j = Math.round((bild.y1 - y) / bild.s);
    if (i < 0 || j < 0 || i >= bild.W || j >= bild.H) return null;
    const k = (j * bild.W + i) * 4, d = bild.rgba;
    if (d[k + 3] === 0 || (d[k] === 255 && d[k + 1] === 255 && d[k + 2] === 255)) return null;
    return [d[k], d[k + 1], d[k + 2]];
  }
  const median = a => { if (!a.length) return NaN; const b = a.slice().sort((p, q) => p - q), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  /** Grönska (krona eller gräs): grönt klart över rött och blått. */
  const gront = c => c[1] > c[0] + 8 && c[1] > c[2] + 4;
  /**
   * Mäter vägbanans kanter längs en linje i ortofotot. def = väntad bredd i meter.
   * Returnerar { st: stationer med v (vänster) och h (höger) halvbredd eller null, andel } där andel
   * är andelen stationer där båda kanterna hittades.
   */
  function matLinje(pts, bild, def, { steg = 2, tol = 42 } = {}) {
    const st = stationer(pts, steg);
    const dr = Math.max(0.1, bild.s * 0.75);
    const max = def * 0.9 + 1.5, slut = Math.max(2, Math.round(0.45 / dr));
    // vägbanans färg mitt på vägen, lokalt (skuggor och beläggning skiftar längs vägen)
    const mitt = st.map(p => {
      const c = [];
      for (let o = -0.3 * def; o <= 0.3 * def + 1e-9; o += dr) { const q = pixel(bild, p.x + p.nx * o, p.y + p.ny * o); if (q && !gront(q)) c.push(q); }
      return c;
    });
    const ref = st.map((p, k) => {
      const c = [];
      for (let m = Math.max(0, k - 3); m <= Math.min(st.length - 1, k + 3); m++) c.push(...mitt[m]);
      if (c.length < 3) return null;
      const f = [0, 1, 2].map(n => median(c.map(q => q[n])));
      // vägbanan är grå eller gråbrun (asfalt, grus); en starkt färgad mitt är något annat (tak, markering, bil)
      return Math.max(...f) - Math.min(...f) <= 70 ? f : null;
    });
    let bada = 0;
    st.forEach((p, k) => {
      p.v = p.h = null;
      const f = ref[k];
      if (!f) return;
      const lik = q => q && !gront(q) && Math.hypot(q[0] - f[0], q[1] - f[1], q[2] - f[2]) < tol;
      for (const [sida, tecken] of [['v', 1], ['h', -1]]) {
        let miss = 0, sistaLik = 0;
        for (let o = dr; o <= max; o += dr) {
          if (lik(pixel(bild, p.x + tecken * p.nx * o, p.y + tecken * p.ny * o))) { miss = 0; sistaLik = o; }
          else if (++miss >= slut) { p[sida] = sistaLik + dr / 2; break; }
        }
      }
      if (p.v != null && p.h != null) bada++;
    });
    return { st, andel: st.length ? bada / st.length : 0 };
  }
  /** Glidande medelvärde över ±n (efter medianen, så att trappstegen försvinner). */
  function glid(v, n) {
    return v.map((_, k) => {
      let s = 0, c = 0;
      for (let q = Math.max(0, k - n); q <= Math.min(v.length - 1, k + n); q++) if (v[q] === v[q]) { s += v[q]; c++; }
      return c ? s / c : v[k];
    });
  }
  /** Rullande median över fönstret ±n, bara över värden som finns; luckor fylls av grannarna. */
  function rullande(v, n) {
    const ut = v.map((_, k) => median(v.slice(Math.max(0, k - n), k + n + 1).filter(x => x != null && x === x)));
    // fyll luckor (NaN) med närmaste värde
    let sen = NaN;
    for (let k = 0; k < ut.length; k++) { if (ut[k] === ut[k]) sen = ut[k]; else ut[k] = sen; }
    sen = NaN;
    for (let k = ut.length - 1; k >= 0; k--) { if (ut[k] === ut[k]) sen = ut[k]; else ut[k] = sen; }
    return ut;
  }
  /**
   * Bredd och sidförskjutning per station för en linje: ur OSM:s width rakt av, annars mätt i
   * ortofotot (bilvägar) och annars schablonen. Returnerar { pts, bredd (per punkt), median, kalla }.
   * pts är mittlinjen förskjuten dit vägbanan ligger i bilden.
   */
  function profil(l, bild, opt = {}) {
    const sch = schablon(l);
    const steg = opt.steg || 2;
    const rak = () => ({ pts: l.pts.map(p => [p[0], p[1]]), bredd: l.pts.map(() => sch.bredd), median: sch.bredd, kalla: sch.kalla, langd: langd(l.pts) });
    if (sch.kalla === 'osm' || !bild || slag(l.lager) !== 'bil') return rak();
    const m = matLinje(l.pts, bild, sch.bredd, { steg, tol: opt.tol });
    if (m.st.length < 3 || m.andel < 0.35) return rak();
    const lo = Math.max(2.5, sch.bredd * 0.6), hi = sch.bredd * 1.6 + 1;
    // En bredd för hela sträckan (0.14.3, AJ): vägar har jämn bredd mellan korsningarna.
    // Medianen tål träd, bilar och infarter som stör enskilda mätningar.
    const bada = m.st.filter(p => p.v != null && p.h != null);
    const b = Math.min(hi, Math.max(lo, median(bada.map(p => p.v + p.h))));
    const bredd = Math.round(b * 2) / 2;
    // sidförskjutningen likaså en för hela sträckan, högst 1,5 m
    const lim = Math.min(1.5, bredd * 0.25), c = Math.max(-lim, Math.min(lim, median(bada.map(p => (p.v - p.h) / 2)) || 0));
    const pts = m.st.map(p => [p.x + p.nx * c, p.y + p.ny * c]);
    return { pts, bredd: pts.map(() => bredd), median: bredd, kalla: 'ortofoto', langd: langd(l.pts), andel: m.andel };
  }
  const langd = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
  const nodNyckel = p => Math.round(p[0] * 100) + ',' + Math.round(p[1] * 100);
  /**
   * Delar linjerna i sträckor mellan korsningar (0.14.3): en linje bryts där den delar en punkt
   * med en annan linje av samma slag (i OSM delar korsande vägar en nod). Returnerar
   * { stracker, noder } där noder är korsningarnas punkter per slag: { bil: [[x, y] …], gang: […] }.
   */
  function stracker(linjer) {
    const antal = new Map();
    linjer.forEach((l, li) => {
      const sl = slag(l.lager), sett = new Set();
      l.pts.forEach(p => {
        const k = sl + ':' + nodNyckel(p);
        if (sett.has(k)) return;
        sett.add(k);
        antal.set(k, (antal.get(k) || 0) + 1);
      });
    });
    const ut = [], noder = { bil: [], gang: [] }, nodSett = new Set();
    for (const l of linjer) {
      const sl = slag(l.lager);
      let del = [l.pts[0]];
      for (let i = 1; i < l.pts.length; i++) {
        del.push(l.pts[i]);
        const k = sl + ':' + nodNyckel(l.pts[i]);
        if (i < l.pts.length - 1 && antal.get(k) > 1) { ut.push(Object.assign({}, l, { pts: del })); del = [l.pts[i]]; }
      }
      if (del.length > 1) ut.push(Object.assign({}, l, { pts: del }));
      for (const p of [l.pts[0], ...l.pts.slice(1)]) {
        const k = sl + ':' + nodNyckel(p);
        if (antal.get(k) > 1 && !nodSett.has(k)) { nodSett.add(k); noder[sl].push([p[0], p[1]]); }
      }
    }
    return { stracker: ut, noder };
  }

  // ------------------------------------------------------------------
  // Vägytorna: alla linjer med sin bredd i ett rutnät, ihopslagna (0.11.0)
  // ------------------------------------------------------------------
  /** Ringar → polygoner med hål: { ringar: [yttre, hål …], yta }. En ring inne i ett udda antal andra är ett hål. */
  function polygoner(ringar) {
    const area = p => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return a / 2; };
    const inne = (q, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { if ((p[i][1] > q[1]) !== (p[j][1] > q[1]) && q[0] < (p[j][0] - p[i][0]) * (q[1] - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; } return c; };
    const r = ringar.map(p => ({ p, a: Math.abs(area(p)) })).filter(x => x.a > 0.5);
    const djup = r.map(x => r.filter(y => y !== x && y.a > x.a && inne(x.p[0], y.p)).length);
    const ut = [];
    r.forEach((x, i) => { if (djup[i] % 2 === 0) ut.push({ ringar: [x.p], yta: x.a, djup: djup[i] }); });
    r.forEach((x, i) => {
      if (djup[i] % 2 === 0) return;
      // hålet hör till den minsta yttre ring som omsluter det
      const agare = ut.filter(o => o.djup === djup[i] - 1 && o.yta > x.a && inne(x.p[0], o.ringar[0])).sort((a, b) => a.yta - b.yta)[0];
      if (agare) { agare.ringar.push(x.p); agare.yta -= x.a; }
    });
    return ut.map(o => ({ ringar: o.ringar, yta: Math.round(o.yta * 10) / 10 }));
  }
  /**
   * Vägytorna inom utsnittet r för linjer med profiler (ur `profil`). Returnerar
   * { bil: [polygoner], gang: [polygoner] } i zonens koordinater.
   */
  function ytor(profiler, r, { cell = 0, maxCeller = 3e6, tol = 0.08, radie = RADIE, noder = null } = {}) {
    const Wm = r.xmax - r.xmin, Hm = r.ymax - r.ymin;
    const s = cell || Math.max(0.2, Math.sqrt(Wm * Hm / maxCeller));
    const Wr = Math.ceil(Wm / s) + 1, Hr = Math.ceil(Hm / s) + 1;
    // rutnätet går en bit utanför utsnittet, så att avrundningen inte äter av vägarna vid kanten
    const Rmax = Math.max(0, ...Object.values(radie || {}));
    const P = Rmax ? Math.ceil((Rmax + 2) / s) : 0;
    const W = Wr + 2 * P, H = Hr + 2 * P, x0 = r.xmin - P * s, y1 = r.ymax + P * s;
    const ut = {};
    for (const sl of ['bil', 'gang']) {
      const lista = profiler.filter(p => p.slag === sl);
      if (!lista.length) { ut[sl] = []; continue; }
      const z = new Float32Array(W * H).fill(-1e3);
      let maxB = 0;
      for (const p of lista) {
        for (let k = 1; k < p.pts.length; k++) {
          const [ax, ay] = p.pts[k - 1], [bx, by] = p.pts[k];
          const wa = p.bredd[k - 1] / 2, wb = p.bredd[k] / 2, wm = Math.max(wa, wb) + s + (radie && radie[sl] || 0) + 1;
          maxB = Math.max(maxB, wa, wb);
          const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
          const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - wm - x0) / s)), i1 = Math.min(W - 1, Math.ceil((Math.max(ax, bx) + wm - x0) / s));
          const j0 = Math.max(0, Math.floor((y1 - Math.max(ay, by) - wm) / s)), j1 = Math.min(H - 1, Math.ceil((y1 - Math.min(ay, by) + wm) / s));
          for (let j = j0; j <= j1; j++) {
            const y = y1 - j * s;
            for (let i = i0; i <= i1; i++) {
              const x = x0 + i * s;
              const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0;
              const v = wa + t * (wb - wa) - Math.hypot(x - ax - t * dx, y - ay - t * dy);
              const c = j * W + i;
              if (v > z[c]) z[c] = v;
            }
          }
        }
      }
      const R = radie && radie[sl] || 0, nod = noder && noder[sl] || [];
      if (R > 0 && nod.length) avrunda(z, W, H, s, x0, y1, R, nod, R + maxB + 3);
      // utsnittet ur det större rutnätet; kanten är utanför vägen så att ringarna sluts
      const g = { W: Wr, H: Hr, s, x0: r.xmin, y1: r.ymax, z: new Float32Array(Wr * Hr) };
      for (let j = 0; j < Hr; j++) for (let i = 0; i < Wr; i++) {
        const v = z[(j + P) * W + i + P];
        g.z[j * Wr + i] = i === 0 || j === 0 || i === Wr - 1 || j === Hr - 1 ? Math.min(v, -1) : v;
      }
      const ringar = T().kurvorForNiva(g, 0).filter(l => l.sluten).map(l => T().forenkla(l.pts.slice(0, -1), tol)).filter(p => p.length >= 3);
      ut[sl] = polygoner(ringar);
    }
    return ut;
  }
  /** Radien i korsningarnas hörn, meter (0.14.3, AJ). Ungefär det som är vanligt på lokalgator. */
  const RADIE = { bil: 6, gang: 1 };
  /** Sträckor kortare än så här (m) får bredden från resten av gatan. */
  const KORT = 30;
  /** Exakt euklidiskt avstånd i en dimension (Felzenszwalb & Huttenlocher), f = kvadrerat avstånd. */
  function edt1(f, n, d, v, zz) {
    let k = 0; v[0] = 0; zz[0] = -Infinity; zz[1] = Infinity;
    for (let q = 1; q < n; q++) {
      let t = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (t <= zz[k]) { k--; t = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; zz[k] = t; zz[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (zz[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  }
  /**
   * Rundar av de inåtgående hörnen nära korsningarna (0.14.3): en morfologisk stängning med
   * radien R. z är vägens fält (positivt inne på vägen, −avståndet till vägkanten utanför).
   * Det som ligger närmare vägen än R vidgas ut och dras sedan in R igen; det som inte ryms
   * fylls, så hörnen får radien R. Bara inom `zon` meter från en korsning, så att vägar som går
   * tätt bredvid varandra inte växer ihop längs hela sträckan.
   */
  function avrunda(z, W, H, s, x0, y1, R, noder, zon) {
    const N = W * H, f = new Float64Array(N);
    for (let c = 0; c < N; c++) f[c] = z[c] < -R ? 0 : 1e20;   // 0 = utanför den vidgade vägen
    const n = Math.max(W, H), tmp = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), zz = new Float64Array(n + 1);
    for (let i = 0; i < W; i++) {
      for (let j = 0; j < H; j++) tmp[j] = f[j * W + i];
      edt1(tmp, H, d, v, zz);
      for (let j = 0; j < H; j++) f[j * W + i] = d[j];
    }
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) tmp[i] = f[j * W + i];
      edt1(tmp, W, d, v, zz);
      for (let i = 0; i < W; i++) f[j * W + i] = d[i];
    }
    // bara nära korsningarna, med en mjuk övergång ut mot zonens kant
    const z2 = zon * zon;
    for (const [nx, ny] of noder) {
      const i0 = Math.max(0, Math.floor((nx - zon - x0) / s)), i1 = Math.min(W - 1, Math.ceil((nx + zon - x0) / s));
      const j0 = Math.max(0, Math.floor((y1 - ny - zon) / s)), j1 = Math.min(H - 1, Math.ceil((y1 - ny + zon) / s));
      for (let j = j0; j <= j1; j++) {
        const dy = y1 - j * s - ny;
        for (let i = i0; i <= i1; i++) {
          const dx = x0 + i * s - nx, a2 = dx * dx + dy * dy;
          if (a2 > z2) continue;
          const c = j * W + i, stang = Math.sqrt(f[c]) * s - R - s;   // − s: rutnätet gör avståndet upp till en ruta för långt, och max() tar alltid det större
          // längst ut i zonen räknas fyllningen ned, så att den inte slutar tvärt
          const vikt = Math.min(1, (zon - Math.sqrt(a2)) / 3);
          const val = stang - (1 - vikt) * (R + 1);
          if (val > z[c]) z[c] = val;
        }
      }
    }
  }

  /**
   * Utkastet för en hämtning: profiler för alla linjer (också lite utanför utsnittet) och ytorna.
   * bild = { rgba, W, H, x0, y1, s } (x0/y1 = mitten av övre vänstra pixeln) eller null.
   * Returnerar { bil, gang, profiler: [{ namn, typ, slag, median, kalla }], matta, schabloner }.
   */
  function utkast(res, r, bild, opt = {}) {
    const { stracker: delar, noder } = stracker(res.alla || res.linjer);
    const profiler = delar.map(l => Object.assign({ slag: slag(l.lager), namn: l.namn, typ: l.typ }, profil(l, bild, opt)));
    // Korta sträckor (under KORT m) mäts osäkert: de får bredden från resten av samma gata
    // (samma namn och typ), viktad med längden, om den är mätt (0.14.3, AJ).
    const gator = new Map();
    profiler.forEach(p => {
      if (p.kalla !== 'ortofoto' || !p.namn || p.langd < KORT) return;
      const k = p.typ + '|' + p.namn;
      if (!gator.has(k)) gator.set(k, []);
      gator.get(k).push(p);
    });
    profiler.forEach((p, i) => {
      if (p.slag !== 'bil' || p.kalla === 'osm' || p.kalla === 'korfalt' || p.langd >= KORT || !p.namn) return;
      const g = gator.get(p.typ + '|' + p.namn);
      if (!g || !g.length) return;
      const L = g.reduce((a, q) => a + q.langd, 0), b = Math.round(g.reduce((a, q) => a + q.median * q.langd, 0) / L * 2) / 2;
      const l = delar[i];
      profiler[i] = Object.assign(p, { pts: l.pts.map(q => [q[0], q[1]]), bredd: l.pts.map(() => b), median: b, kalla: 'gatan' });
    });
    const y = ytor(profiler, r, Object.assign({ noder }, opt));
    const inom = profiler.filter(p => p.pts.some(q => q[0] >= r.xmin && q[0] <= r.xmax && q[1] >= r.ymin && q[1] <= r.ymax));
    return {
      bil: y.bil, gang: y.gang, profiler: inom.map(p => ({ namn: p.namn, typ: p.typ, slag: p.slag, median: p.median, kalla: p.kalla })),
      matta: inom.filter(p => p.kalla === 'ortofoto' || p.kalla === 'gatan').length, medBild: !!bild,
    };
  }

  function dxf(res, r, dx, dy, { slag: bara } = {}) {
    const lager = { UTSNITT: 3 }, objekt = [];
    for (const l of res.linjer) {
      if (bara && slag(l.lager) !== bara) continue;
      lager[l.lager] = KLASSER[l.lager].aci; objekt.push({ typ: 'pl', lager: l.lager, pts: l.pts });
    }
    if (res.ytor) for (const [sl, ln] of [['bil', 'VAG_YTA_BIL_BERAKNAD'], ['gang', 'VAG_YTA_GANG_BERAKNAD']]) {
      if (bara && sl !== bara) continue;
      for (const p of res.ytor[sl] || []) for (const ring of p.ringar) { lager[ln] = YTLAGER[ln].aci; objekt.push({ typ: 'pl', lager: ln, pts: ring, sluten: true }); }
    }
    objekt.push({ typ: 'pl', lager: 'UTSNITT', pts: [[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax]], sluten: true });
    return Dxf.skriv(lager, objekt, { dx, dy, ext: r });
  }

  return { hamta, tolka, dxf, klipp, klass, slag, schablon, tolkaBredd, stationer, matLinje, profil, stracker, ytor, RADIE, KORT, polygoner, utkast, KLASSER, YTLAGER, SLAGNAMN, SCHABLON, URL_STD };
}));
