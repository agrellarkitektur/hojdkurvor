// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Sol på fasaderna (0.15.0). Ren beräkning utan DOM och utan three.js, så att den kan testas i Node
 * och tas rakt av till cad-apa.
 *
 * Gången:
 *   1. punkter(volymer)        – fasadpunkter i ett rutnät på cirka 1 m på byggnadskropparnas väggar
 *                                (gavlarna upp till taket). Punkter inuti en annan kropp eller under
 *                                marken tas bort.
 *   2. hinderraster(volymer)   – kropparna som höjdraster (0,5 m) med vilken kropp som är högst i rutan.
 *   3. horisonter(punkter, …)  – horisonten framför varje punkt, i tre steg: bara den egna kroppen,
 *                                alla kroppar, och kropparna med omgivningen (ytmodellen: terräng, hus
 *                                och träd ur laserdatan). Ger också himlens andel (diffus strålning).
 *   4. berakna(punkter, …)     – timme för timme och dag för dag med klar himmel: summa (kWh/m²) och
 *                                lokal topp (W/m²) per punkt, samtidig topp (areaviktat fasadmedel) per
 *                                fasad och per kropp och väderstreck, timme × dag och värsta dygnet.
 *
 * Strålningen: direkt mot fasadens vinkel, diffus efter Hay–Davies (en del kring solen, resten från
 * den del av himlen fasaden ser) och reflex från marken (albedo 0,2). Klar himmel efter ESRA
 * (Rigollier m.fl. 2000) med Linkes grumlighetsfaktor 3. Fasaderna är lodräta.
 *
 * Koordinater: zonens system i meter, höjder i RH 2000. konv är rutnätets nord i förhållande till
 * geografisk nord (grader, öster +), som i Analys.skuggor: sant azimut = rutnätsazimut + konv.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./volym3d.js'), require('./sol.js'));
  else root.Fasadsol = factory(root.Volym3D, root.Sol);
}(typeof self !== 'undefined' ? self : this, function (V3, Sol) {
  'use strict';
  const RAD = Math.PI / 180;
  const I0 = 1367;
  const ALBEDO = 0.2, LINKE = 3;
  const STRECK = ['N', 'Ö', 'S', 'V'];
  const STRECK_NAMN = { N: 'norr', Ö: 'öster', S: 'söder', V: 'väster' };
  /** Perioderna (månad, dag). */
  const PERIODER = {
    sommar: { namn: '21 mars–21 september', fran: [3, 21], till: [9, 21] },
    april: { namn: 'april', fran: [4, 1], till: [4, 30] },
    september: { namn: 'september', fran: [9, 1], till: [9, 30] },
  };
  const TIDER = {
    kontor: { namn: 'kl. 8–17', timmar: [8, 9, 10, 11, 12, 13, 14, 15, 16] },
    dygn: { namn: 'hela dygnet', timmar: Array.from({ length: 24 }, (_, i) => i) },
  };
  /** Skalorna i 3D-vyn och på bladen, som i underlaget (summan för 21 mars–21 september). */
  const SKALA = { summa: [0, 700], topp: [0, 900] };
  /**
   * Skalorna för ett resultat. Summans skala följer periodens längd (700 kWh/m² för 185 dagar) och
   * växer till nästa jämna hundratal (femtiotal under 200) om någon punkt får mer: klar himmel varje
   * dag ger högre summor än verkligt väder, som underlagets skala är gjord för.
   */
  function skala(res) {
    const dagar = res.dagar ? res.dagar.length : 185;
    let topp = Math.max(50, Math.round(SKALA.summa[1] * dagar / 185 / 50) * 50);
    const sm = res.punkt && res.punkt.summa;
    if (sm && sm.length) {
      let m = 0;
      for (const v of sm) if (v > m) m = v;
      const st = m < 200 ? 50 : 100;
      topp = Math.max(topp, Math.ceil(m / st) * st);
    }
    return { summa: [0, topp], topp: SKALA.topp.slice() };
  }

  const vinkel = a => ((a % 360) + 540) % 360 - 180;   // (−180, 180]
  /** Väderstreck för ett sant azimut (grader). */
  function vaderstreck(az) {
    const a = ((az % 360) + 360) % 360;
    return a >= 315 || a < 45 ? 'N' : a < 135 ? 'Ö' : a < 225 ? 'S' : 'V';
  }

  // ------------------------------------------------------------------
  // Klar himmel (ESRA)
  // ------------------------------------------------------------------
  /** Dagens nummer i året (1–366) för ett datum. */
  const dagNr = (ar, man, dag) => Math.round((Date.UTC(ar, man - 1, dag) - Date.UTC(ar, 0, 0)) / 86400000);
  /**
   * Strålning vid klar himmel. h: solhöjd (grader, skenbar), dag: dagens nummer.
   * Ger { dni (direkt mot solen), dhi (diffus mot horisontalplan), e0 (utanför atmosfären) } i W/m².
   */
  function klarHimmel(h, dag, { linke = LINKE } = {}) {
    if (!(h > 0)) return { dni: 0, dhi: 0, e0: 0 };
    const eps = 1 + 0.03344 * Math.cos(2 * Math.PI * (dag - 2.8) / 365.25), e0 = I0 * eps;
    const sh = Math.sin(h * RAD);
    // luftmassa (Kasten och Young 1989) och Rayleighs optiska tjocklek (ESRA)
    const m = 1 / (sh + 0.50572 * Math.pow(h + 6.07995, -1.6364));
    const dR = m <= 20 ? 1 / (6.6296 + 1.7513 * m - 0.1202 * m * m + 0.0065 * m ** 3 - 0.00013 * m ** 4) : 1 / (10.4 + 0.718 * m);
    const dni = e0 * Math.exp(-0.8662 * linke * m * dR);
    const trd = -1.5843e-2 + 3.0543e-2 * linke + 3.797e-4 * linke * linke;
    let a0 = 2.6463e-1 - 6.1581e-2 * linke + 3.1408e-3 * linke * linke;
    if (a0 * trd < 2e-3) a0 = 2e-3 / trd;
    const a1 = 2.0402 + 1.8945e-2 * linke - 1.1161e-2 * linke * linke;
    const a2 = -1.3025 + 3.9231e-2 * linke + 8.5079e-3 * linke * linke;
    const dhi = Math.max(0, e0 * trd * (a0 + a1 * sh + a2 * sh * sh));
    return { dni, dhi, e0 };
  }

  /**
   * Strålningen mot en lodrät fasad (W/m²). sol: { h, phi (solens vinkel från fasadens normal, grader),
   * dni, dhi, e0 }. sedd: himlens andel som fasaden ser (0,5 utan hinder). belyst: om solen når punkten.
   * Ger { direkt, diffus, mark, summa }.
   */
  function motFasad(sol, sedd, belyst, albedo = ALBEDO) {
    const sh = Math.sin(sol.h * RAD), cosT = Math.cos(sol.h * RAD) * Math.cos(sol.phi * RAD);
    const direkt = belyst && cosT > 0 ? sol.dni * cosT : 0;
    const ai = sol.e0 > 0 ? sol.dni / sol.e0 : 0;   // andelen kring solen (Hay–Davies)
    const rb = cosT > 0 && belyst ? cosT / Math.max(0.05, sh) : 0;
    const diffus = sol.dhi * ((1 - ai) * sedd + ai * rb);
    const mark = albedo * (sol.dni * sh + sol.dhi) * 0.5;
    return { direkt, diffus, mark, summa: direkt + diffus + mark };
  }

  // ------------------------------------------------------------------
  // Fasadpunkter
  // ------------------------------------------------------------------
  const yta = p => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += (p[i][0] - p[0][0]) * (q[1] - p[0][1]) - (q[0] - p[0][0]) * (p[i][1] - p[0][1]); } return a / 2; };
  const moturs = p => (yta(p) < 0 ? p.slice().reverse() : p);

  /**
   * Fasadpunkterna. volymer: byggnadskropparna som ska analyseras (fotavtryck, golv, takfot, takform …).
   * mark(x, y) → markhöjd eller NaN. Ger { punkter, fasader }:
   *   fasad: { volym (index), id (kroppens id), namn, sida, a, b ([x, y]), langd, nx, ny, azRut, az (sant),
   *            streck, area }
   *   punkt: { x, y, z, nx, ny, azRut (normalens rutnätsazimut), f (fasad), v (volym), w, h, a (m²) }
   * Kroppar som rör vid varandra delar inte fasad: punkter inuti en annan kropp tas bort.
   */
  function punkter(volymer, { steg = 1, mark = null, konv = 0, hinder = volymer } = {}) {
    const pkt = [], fasader = [];
    volymer.forEach((v, vi) => {
      if (!v.fotavtryck || v.fotavtryck.length < 3 || !(v.golv === v.golv)) return;
      const fot = moturs(v.fotavtryck), pl = V3.plan(v), bas = v.golv + v.takfot;
      for (let s = 0; s < fot.length; s++) {
        const A = fot[s], B = fot[(s + 1) % fot.length];
        const ex = B[0] - A[0], ey = B[1] - A[1], L = Math.hypot(ex, ey);
        if (L < 0.2) continue;
        const nx = ey / L, ny = -ex / L;                    // utåt för ett fotavtryck moturs
        const azRut = ((Math.atan2(nx, ny) / RAD) + 360) % 360, az = ((azRut + konv) % 360 + 360) % 360;
        const f = { volym: vi, id: v.id, namn: v.namn || `Kropp ${vi + 1}`, sida: s, a: A, b: B, langd: L, nx, ny, azRut, az, streck: vaderstreck(az), area: 0 };
        const fi = fasader.length;
        const nk = Math.max(1, Math.round(L / steg)), w = L / nk;
        for (let k = 0; k < nk; k++) {
          const t = (k + 0.5) / nk, x = A[0] + ex * t, y = A[1] + ey * t;
          // väggen går till takfoten, gavlarna upp till taket (taket strax innanför väggen)
          const topp = pl ? Math.max(bas, V3.hojdVid(v, x - nx * 0.01, y - ny * 0.01, pl)) : bas;
          const hojd = topp - v.golv;
          if (!(hojd > 0.05)) continue;
          const nr = Math.max(1, Math.round(hojd / steg)), h = hojd / nr;
          const zMark = mark ? mark(x + nx * 0.3, y + ny * 0.3) : NaN;
          for (let r = 0; r < nr; r++) {
            const z = v.golv + (r + 0.5) * h;
            if (zMark === zMark && z < zMark) continue;       // under marken
            const ux = x + nx * 0.1, uy = y + ny * 0.1;
            if (hinder.some(o => o !== v && o.fotavtryck && V3.inutiVolym(o, ux, uy, z))) continue;   // inne i en annan kropp
            pkt.push({ x, y, z, nx, ny, azRut, f: fi, v: vi, w, h, a: w * h });
            f.area += w * h;
          }
        }
        if (f.area > 0) fasader.push(f);
      }
    });
    return { punkter: pkt, fasader };
  }

  // ------------------------------------------------------------------
  // Hinder: kropparna som raster
  // ------------------------------------------------------------------
  /**
   * Kropparna som höjdraster med rutan s (cellernas mitt i x0 + (i + ½)·s, y1 − (j + ½)·s): h är den
   * högsta takhöjden i rutan (NaN utan kropp), id index i volymer för den kroppen.
   */
  function hinderraster(volymer, { s = 0.5 } = {}) {
    const alla = volymer.filter(v => v.fotavtryck && v.fotavtryck.length >= 3);
    if (!alla.length) return null;
    let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
    for (const v of alla) for (const [x, y] of v.fotavtryck) { xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
    const x0 = Math.floor(xmin / s) * s - s, y1 = Math.ceil(ymax / s) * s + s;
    const W = Math.ceil((xmax - x0) / s) + 2, H = Math.ceil((y1 - ymin) / s) + 2;
    const h = new Float32Array(W * H).fill(NaN), id = new Int16Array(W * H).fill(-1);
    let zmax = -Infinity;
    volymer.forEach((v, vi) => {
      if (!v.fotavtryck || v.fotavtryck.length < 3) return;
      const pl = V3.plan(v), xs = v.fotavtryck.map(p => p[0]), ys = v.fotavtryck.map(p => p[1]);
      const i0 = Math.max(0, Math.floor((Math.min(...xs) - x0) / s)), i1 = Math.min(W - 1, Math.floor((Math.max(...xs) - x0) / s));
      const j0 = Math.max(0, Math.floor((y1 - Math.max(...ys)) / s)), j1 = Math.min(H - 1, Math.floor((y1 - Math.min(...ys)) / s));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = x0 + (i + 0.5) * s, y = y1 - (j + 0.5) * s;
        if (!V3.inuti(v.fotavtryck, x, y)) continue;
        const z = V3.hojdVid(v, x, y, pl), c = j * W + i;
        if (!(h[c] >= z)) { h[c] = z; id[c] = vi; }
        if (z > zmax) zmax = z;
      }
    });
    return { x0, y1, s, W, H, h, id, zmax };
  }

  /** Bilinjär interpolation i ytmodellens nodrutnät (som Analys.nod). NaN utanför. */
  function nod(g, z, x, y) {
    const fx = (x - g.x0) / g.s, fy = (g.y1 - y) / g.s;
    const i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= g.W - 1 || j >= g.H - 1) return NaN;
    const tx = fx - i, ty = fy - j, W = g.W;
    const a = z[j * W + i], b = z[j * W + i + 1], c = z[(j + 1) * W + i], d = z[(j + 1) * W + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  /**
   * Ytmodellens höjd utan det som står på kropparna: inom fotavtrycket (plus marginalen) blir det
   * marken. Kroppen ersätter det som står där (gamla tak, buskar), så att den inte skuggar sig själv.
   * yta: { W, H, s, x0, y1, dtm, dsm }. Ger en ny Float32Array.
   */
  function rensaUnderKroppar(yta, volymer, marg = 1) {
    const ut = Float32Array.from(yta.dsm);
    for (const v of volymer) {
      if (!v.fotavtryck || v.fotavtryck.length < 3) continue;
      const xs = v.fotavtryck.map(p => p[0]), ys = v.fotavtryck.map(p => p[1]);
      const i0 = Math.max(0, Math.floor((Math.min(...xs) - marg - yta.x0) / yta.s)), i1 = Math.min(yta.W - 1, Math.ceil((Math.max(...xs) + marg - yta.x0) / yta.s));
      const j0 = Math.max(0, Math.floor((yta.y1 - Math.max(...ys) - marg) / yta.s)), j1 = Math.min(yta.H - 1, Math.ceil((yta.y1 - Math.min(...ys) + marg) / yta.s));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = yta.x0 + i * yta.s, y = yta.y1 - j * yta.s;
        if (V3.inuti(v.fotavtryck, x, y) || narmasteKant(v.fotavtryck, x, y) <= marg) ut[j * yta.W + i] = yta.dtm[j * yta.W + i];
      }
    }
    return ut;
  }
  function narmasteKant(p, x, y) {
    let d = Infinity;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey;
      const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / l2)) : 0;
      d = Math.min(d, Math.hypot(x - a[0] - ex * t, y - a[1] - ey * t));
    }
    return d;
  }

  // ------------------------------------------------------------------
  // Horisonten framför varje punkt
  // ------------------------------------------------------------------
  /**
   * Horisonten framför punkterna pts[fran … till). miljo: { yta: { W, H, s, x0, y1, dsm } eller null,
   * vol: hinderraster eller null }. För varje punkt läggs till hor = { egen, vol, alla } (Float32Array
   * med höjdvinkeln i grader för vinklarna −90 + (b + ½)·azSteg från normalen) och sedd (himlens andel,
   * 0,5 utan hinder).
   * Den egna kroppen räknas från start meter ut från väggen (rastret har 0,5 m rutor, så väggen själv
   * syns inte). maxAvst: hur långt ytmodellen och kropparna söks.
   */
  function horisonter(pts, miljo, { azSteg = 2, maxAvst = 150, start = 0.75, fran = 0, till = pts.length } = {}) {
    const nb = Math.round(180 / azSteg), y = miljo.yta, R = miljo.vol;
    let zmax = R ? R.zmax : -Infinity;
    if (y) { if (y.zmax == null) { let m = -Infinity; for (const v of y.dsm) if (v > m) m = v; y.zmax = m; } zmax = Math.max(zmax, y.zmax); }
    const cosB = new Float32Array(nb), sinB = new Float32Array(nb);
    for (let b = 0; b < nb; b++) { const f = (-90 + (b + 0.5) * azSteg) * RAD; cosB[b] = Math.cos(f); sinB[b] = Math.sin(f); }
    for (let k = fran; k < till; k++) {
      const p = pts[k], egen = new Float32Array(nb), vol = new Float32Array(nb), alla = new Float32Array(nb);
      // normalen och tangenten: positiv vinkel är medurs från normalen, som solens azimut (phi i analys).
      // Före 0.16.3 hade tangenten fel tecken, så horisonten blev spegelvänd (B3 i granskningen 26 nov).
      const tx = p.ny, ty = -p.nx;
      for (let b = 0; b < nb; b++) {
        const dx = p.nx * cosB[b] + tx * sinB[b], dy = p.ny * cosB[b] + ty * sinB[b];
        let tE = -Infinity, tV = -Infinity, tA = -Infinity;   // tan av höjdvinkeln
        let d = start;
        while (d <= maxAvst) {
          if ((zmax - p.z) / d < tA && tA > -Infinity) break;   // inget högre längre bort
          const x = p.x + dx * d, yy = p.y + dy * d;
          if (R) {
            const i = Math.floor((x - R.x0) / R.s), j = Math.floor((R.y1 - yy) / R.s);
            if (i >= 0 && j >= 0 && i < R.W && j < R.H) {
              const c = j * R.W + i, hv = R.h[c];
              if (hv === hv) {
                const t = (hv - p.z) / d;
                if (t > tV) tV = t;
                if (R.id[c] === p.v && t > tE) tE = t;
                if (t > tA) tA = t;
              }
            }
          }
          if (y) {
            const zs = nod(y, y.dsm, x, yy);
            if (zs === zs) { const t = (zs - p.z) / d; if (t > tA) tA = t; }
          }
          d += d < 20 ? 0.5 : d < 60 ? 1 : 2;
        }
        egen[b] = tE > -Infinity ? Math.atan(tE) / RAD : -90;
        vol[b] = tV > -Infinity ? Math.atan(tV) / RAD : -90;
        alla[b] = tA > -Infinity ? Math.atan(tA) / RAD : -90;
      }
      p.hor = { egen, vol, alla, azSteg };
      p.sedd = seddHimmel(alla, azSteg);
    }
    return pts;
  }

  /** Himlens andel som en lodrät yta ser, med horisonten e (grader) framför sig. 0,5 utan hinder. */
  function seddHimmel(e, azSteg) {
    // summan normeras mot fri himmel, så att en fasad utan hinder får exakt 0,5
    let F = 0, F0 = 0;
    for (let b = 0; b < e.length; b++) {
      const c = Math.cos((-90 + (b + 0.5) * azSteg) * RAD), h = Math.max(0, e[b]) * RAD;
      F += c * (Math.PI / 4 - h / 2 - Math.sin(2 * h) / 4); F0 += c * Math.PI / 4;
    }
    return 0.5 * F / F0;
  }

  /** Horisontens höjdvinkel vid vinkeln phi (grader från normalen), interpolerad. */
  function horVid(e, azSteg, phi) {
    const f = (phi + 90) / azSteg - 0.5, nb = e.length;
    if (f <= 0) return e[0];
    if (f >= nb - 1) return e[nb - 1];
    const i = Math.floor(f), t = f - i;
    return e[i] * (1 - t) + e[i + 1] * t;
  }
  /** Fjärran horisont (Float32Array med 720 värden, sant azimut 0, 0,5 …) vid sant azimut az. */
  function fjarrVid(hor, az) {
    if (!hor) return -90;
    const f = ((az % 360) + 360) % 360 / 0.5, i = Math.floor(f) % 720, t = f - Math.floor(f);
    return hor[i] * (1 - t) + hor[(i + 1) % 720] * t;
  }

  // ------------------------------------------------------------------
  // Dagarna och timmarna
  // ------------------------------------------------------------------
  /** Dagarna i perioden: [{ man, dag, nr }]. */
  function dagar(ar, period) {
    const p = typeof period === 'string' ? PERIODER[period] : period;
    const ut = [];
    for (let t = Date.UTC(ar, p.fran[0] - 1, p.fran[1]); t <= Date.UTC(ar, p.till[0] - 1, p.till[1]); t += 86400000) {
      const d = new Date(t);
      ut.push({ man: d.getUTCMonth() + 1, dag: d.getUTCDate(), nr: dagNr(ar, d.getUTCMonth() + 1, d.getUTCDate()) });
    }
    return ut;
  }

  // ------------------------------------------------------------------
  // Beräkningen
  // ------------------------------------------------------------------
  /**
   * Instrålningen dag för dag och timme för timme (svensk tid, mitt i timmen). pts med hor och sedd
   * (horisonter), fasader ur punkter. o: { lat, lon, konv, ar, period ('sommar' | 'april' | 'september'
   * eller { fran, till }), tid ('kontor' | 'dygn'), fjarr (fjärran horisont, 720 värden, eller null),
   * linke, albedo, volymer (för namnen) }.
   * Ger {
   *   dagar, timmar (timmarna som räknas), period, tid,
   *   punkt: { summa (kWh/m²), topp (W/m²) } som Float32Array i punkternas ordning,
   *   fasader: [{ …fasaden, summa, lokal, samtidig, nar: { dag, tim } }],
   *   grupper: [{ volym, namn, streck, area, summa, lokal, samtidig, nar, varstaDag, dygn (24 värden,
   *              W/m² värsta dygnet), matris (Float32Array dagar × 24, areaviktat W/m²),
   *              direkt: { egen, vol, alla } (kWh/m²), skuggning: { volymer, omgivning } (andel 0–1) }],
   * }
   */
  function berakna(pts, fasader, o) {
    const period = typeof o.period === 'string' ? o.period : 'sommar', tid = o.tid === 'dygn' ? 'dygn' : 'kontor';
    const dl = dagar(o.ar, o.period && typeof o.period === 'object' ? o.period : PERIODER[period]);
    const tim = TIDER[tid].timmar, iTid = new Uint8Array(24);
    tim.forEach(h => { iTid[h] = 1; });
    const konv = o.konv || 0, albedo = o.albedo == null ? ALBEDO : o.albedo, linke = o.linke || LINKE;
    const n = pts.length, nf = fasader.length;
    // grupper: kropp och väderstreck
    const gNyckel = new Map(), grupper = [];
    const fGrupp = fasader.map(f => {
      const k = f.volym + ':' + f.streck;
      if (!gNyckel.has(k)) { gNyckel.set(k, grupper.length); grupper.push({ volym: f.volym, id: f.id, namn: f.namn, streck: f.streck, area: 0 }); }
      const gi = gNyckel.get(k);
      grupper[gi].area += f.area;
      return gi;
    });
    const ng = grupper.length;
    const summa = new Float32Array(n), topp = new Float32Array(n);
    const dirE = new Float64Array(nf), dirV = new Float64Array(nf), dirA = new Float64Array(nf);
    const fSum = new Float64Array(nf), fTopp = new Float64Array(nf).fill(0), fNar = new Int32Array(nf).fill(-1);
    const gTopp = new Float64Array(ng), gNar = new Int32Array(ng).fill(-1);
    const matris = grupper.map(() => new Float32Array(dl.length * 24));
    const fMom = new Float64Array(nf), gMom = new Float64Array(ng);
    const fArea = fasader.map(f => f.area), gArea = grupper.map(g => g.area);
    dl.forEach((d, di) => {
      for (let hh = 0; hh < 24; hh++) {
        const ms = Sol.lokalTillMs(o.ar, d.man, d.dag, hh, 30);
        const pos = Sol.solensLage(ms, o.lat, o.lon);
        if (!(pos.h > 0)) continue;
        const kh = klarHimmel(pos.h, d.nr, { linke });
        const fj = fjarrVid(o.fjarr, pos.az), azRut = pos.az - konv;
        const raknas = iTid[hh];
        fMom.fill(0); gMom.fill(0);
        for (let k = 0; k < n; k++) {
          const p = pts[k], phi = vinkel(azRut - p.azRut);
          let belystA = false, belystV = false, belystE = false;
          if (Math.abs(phi) < 90) {
            const as = p.hor.azSteg;
            belystE = pos.h > horVid(p.hor.egen, as, phi);
            belystV = belystE && pos.h > horVid(p.hor.vol, as, phi);
            belystA = belystV && pos.h > horVid(p.hor.alla, as, phi) && pos.h > fj;
          }
          const s = { h: pos.h, phi, dni: kh.dni, dhi: kh.dhi, e0: kh.e0 };
          const I = motFasad(s, p.sedd, belystA, albedo);
          fMom[p.f] += I.summa * p.a;
          if (raknas) {
            summa[k] += I.summa / 1000;
            if (I.summa > topp[k]) topp[k] = I.summa;
            const cosT = Math.cos(pos.h * RAD) * Math.cos(phi * RAD);
            if (cosT > 0) {
              const dir = kh.dni * cosT * p.a / 1000;
              if (belystE) dirE[p.f] += dir;
              if (belystV) dirV[p.f] += dir;
              if (belystA) dirA[p.f] += dir;
            }
          }
        }
        for (let f = 0; f < nf; f++) gMom[fGrupp[f]] += fMom[f];
        const t = di * 24 + hh;
        for (let g = 0; g < ng; g++) {
          const m = gMom[g] / gArea[g];
          matris[g][t] = m;
          if (raknas && m > gTopp[g]) { gTopp[g] = m; gNar[g] = t; }
        }
        if (raknas) for (let f = 0; f < nf; f++) {
          const m = fMom[f] / fArea[f];
          fSum[f] += m / 1000;
          if (m > fTopp[f]) { fTopp[f] = m; fNar[f] = t; }
        }
      }
    });
    const nar = t => (t < 0 ? null : { dag: dl[Math.floor(t / 24)], tim: t % 24 });
    // lokal topp per fasad och grupp: den högsta punkten
    const fLokal = new Float64Array(nf), gLokal = new Float64Array(ng);
    for (let k = 0; k < n; k++) {
      const f = pts[k].f;
      if (topp[k] > fLokal[f]) fLokal[f] = topp[k];
      if (topp[k] > gLokal[fGrupp[f]]) gLokal[fGrupp[f]] = topp[k];
    }
    const fasadUt = fasader.map((f, i) => Object.assign({}, f, { summa: fSum[i], lokal: fLokal[i], samtidig: fTopp[i], nar: nar(fNar[i]) }));
    const gruppUt = grupper.map((g, gi) => {
      let sum = 0, e = 0, v = 0, a = 0;
      fasader.forEach((f, i) => { if (fGrupp[i] === gi) { sum += fSum[i] * fArea[i]; e += dirE[i]; v += dirV[i]; a += dirA[i]; } });
      const vd = gNar[gi] < 0 ? -1 : Math.floor(gNar[gi] / 24);
      return Object.assign(g, {
        summa: sum / g.area, lokal: gLokal[gi], samtidig: gTopp[gi], nar: nar(gNar[gi]), varstaDag: vd,
        dygn: vd < 0 ? new Float32Array(24) : matris[gi].slice(vd * 24, vd * 24 + 24), matris: matris[gi],
        direkt: { egen: e / g.area, vol: v / g.area, alla: a / g.area },
        skuggning: { volymer: e > 0 ? 1 - v / e : 0, omgivning: v > 0 ? 1 - a / v : 0 },
      });
    });
    gruppUt.sort((p, q) => p.volym - q.volym || STRECK.indexOf(p.streck) - STRECK.indexOf(q.streck));
    return { dagar: dl, timmar: tim, period, tid, ar: o.ar, punkt: { summa, topp }, fasader: fasadUt, grupper: gruppUt };
  }

  /**
   * Allt i ett: fasadpunkter, horisonter och beräkning. o som i punkter, horisonter och berakna, plus
   * yta (ytmodellen eller null) och steg (rutnätet, m). För testerna och för cad-apa; appen kör stegen
   * för sig så att den kan visa förloppet.
   */
  function analys(volymer, o) {
    const { punkter: pts, fasader } = punkter(volymer, o);
    horisonter(pts, { yta: o.yta || null, vol: hinderraster(volymer) }, o);
    return Object.assign({ punkter: pts }, berakna(pts, fasader, o));
  }

  /**
   * Det som går till cad-apa (platspaketets fasadsol): per fasad lokal och samtidig topp i W/m² och
   * summan i kWh/m², och inställningarna.
   */
  function tillPaket(res, { horisont = null } = {}) {
    const r1 = v => Math.round(v), r2 = v => Math.round(v * 1000) / 1000;
    return {
      modell: 'klar himmel (ESRA, Linke 3), Hay–Davies, albedo 0,2',
      ar: res.ar, period: PERIODER[res.period].namn, tid: TIDER[res.tid].namn,
      fasader: res.fasader.map(f => ({
        volym: f.id, sida: f.sida, a: [r2(f.a[0]), r2(f.a[1])], b: [r2(f.b[0]), r2(f.b[1])], azimut: Math.round(f.az * 10) / 10, streck: f.streck,
        area: Math.round(f.area * 10) / 10, summa: r1(f.summa), lokalTopp: r1(f.lokal), samtidigTopp: r1(f.samtidig),
      })),
      horisont: horisont ? Array.from(horisont, v => Math.round(v * 10) / 10) : null,
    };
  }

  /** Färg (r, g, b 0–255) för värdet t mellan 0 och 1: blått – grönt – gult – rött, som i underlaget. */
  const RAMP = [[45, 50, 145], [40, 120, 200], [60, 175, 160], [140, 200, 80], [245, 210, 60], [240, 130, 40], [200, 40, 40]];
  function farg(t) {
    const x = Math.max(0, Math.min(1, t)) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(x)), u = x - i;
    return RAMP[i].map((c, k) => Math.round(c + (RAMP[i + 1][k] - c) * u));
  }

  return {
    PERIODER, TIDER, SKALA, skala, STRECK, STRECK_NAMN, ALBEDO, LINKE,
    vaderstreck, klarHimmel, motFasad, punkter, hinderraster, rensaUnderKroppar, horisonter, seddHimmel,
    horVid, dagar, berakna, analys, tillPaket, farg,
  };
}));
