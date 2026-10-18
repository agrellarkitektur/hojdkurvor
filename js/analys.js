/*
 * Analyser av höjddata och laserdata:
 *   ytmodell  – höjd över mark (träd och byggnader) och ytmodell på 1 m-rutnät
 *   hittaTrad – enskilda träd med höjd och kronbredd
 *   skuggor   – skuggade ytor vid valda tider
 *   sektion   – terrängsektion med vegetation och byggnader
 *   horisont  – horisontprofil från terräng, träd och byggnader
 *
 * Rutnät i zonen är nodbaserade som Terrang.rutnat: {W, H, s, x0, y1, z} med
 * nod (i, j) i (x0 + i·s, y1 − j·s).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Analys = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const RAD = Math.PI / 180;
  const OBJEKT = k => k === 1 || k === 17 || (k >= 3 && k <= 6);   // ej mark, vatten eller brus

  // ------------------------------------------------------------------
  // Hjälpfunktioner för rutnät
  // ------------------------------------------------------------------
  /** Bilinjär interpolation i nodrutnät. NaN utanför. */
  function nod(g, z, x, y) {
    const fx = (x - g.x0) / g.s, fy = (g.y1 - y) / g.s;
    const i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= g.W - 1 || j >= g.H - 1) {
      const ii = Math.round(fx), jj = Math.round(fy);
      if (ii < 0 || jj < 0 || ii >= g.W || jj >= g.H) return NaN;
      return z[jj * g.W + ii];
    }
    const tx = fx - i, ty = fy - j, W = g.W;
    const a = z[j * W + i], b = z[j * W + i + 1], c = z[(j + 1) * W + i], d = z[(j + 1) * W + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  /** Max- eller minfilter med kvadratiskt fönster (radie r celler), separabelt. */
  function filter(src, W, H, r, max) {
    const tmp = new Float32Array(W * H), ut = new Float32Array(W * H);
    const f = max ? Math.max : Math.min, start = max ? -Infinity : Infinity;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      let v = start;
      for (let k = Math.max(0, i - r); k <= Math.min(W - 1, i + r); k++) v = f(v, src[j * W + k]);
      tmp[j * W + i] = v;
    }
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      let v = start;
      for (let k = Math.max(0, j - r); k <= Math.min(H - 1, j + r); k++) v = f(v, tmp[k * W + i]);
      ut[j * W + i] = v;
    }
    return ut;
  }

  // ------------------------------------------------------------------
  // Ytmodell
  // ------------------------------------------------------------------
  /**
   * dtm: nodrutnät i zonen (Terrang.rutnat). p: laserpunkter i zonen {antal, x, y, z, k}.
   * utesluts(x, y) → true för punkter som inte ska räknas (t.ex. tomten vid horisontberäkning).
   * Returnerar {W, H, s, x0, y1, dtm, ndsm, dsm}. Höjd över mark är stängd (5×5) så att
   * glesa trädkronor blir sammanhängande.
   */
  function ytmodell(dtm, p, { utesluts = null, stangning = 2 } = {}) {
    const { W, H, s, x0, y1 } = dtm;
    const ra = new Float32Array(W * H);
    for (let n = 0; n < p.antal; n++) {
      if (!OBJEKT(p.k[n])) continue;
      const x = p.x[n], y = p.y[n];
      if (utesluts && utesluts(x, y)) continue;
      const i = Math.round((x - x0) / s), j = Math.round((y1 - y) / s);
      if (i < 0 || j < 0 || i >= W || j >= H) continue;
      const c = j * W + i, g = dtm.z[c];
      if (!(g === g)) continue;
      const v = p.z[n] - g;
      if (v > ra[c]) ra[c] = v;
    }
    const ndsm = stangning ? filter(filter(ra, W, H, stangning, true), W, H, stangning, false) : ra;
    const dsm = new Float32Array(W * H);
    for (let c = 0; c < W * H; c++) dsm[c] = dtm.z[c] + ndsm[c];
    return { W, H, s, x0, y1, dtm: dtm.z, ndsm, dsm, ra };
  }

  // ------------------------------------------------------------------
  // Träd
  // ------------------------------------------------------------------
  /** Index över laserpunkter per cell, för snabba grannsökningar. */
  function punktIndex(p, g) {
    const { W, H, s, x0, y1 } = g;
    const antal = new Uint32Array(W * H + 1);
    const cell = new Int32Array(p.antal);
    for (let n = 0; n < p.antal; n++) {
      const i = Math.round((p.x[n] - x0) / s), j = Math.round((y1 - p.y[n]) / s);
      cell[n] = (i < 0 || j < 0 || i >= W || j >= H) ? -1 : j * W + i;
      if (cell[n] >= 0) antal[cell[n] + 1]++;
    }
    for (let c = 1; c <= W * H; c++) antal[c] += antal[c - 1];
    const ordning = new Uint32Array(antal[W * H]), fyllt = antal.slice(0, W * H);
    for (let n = 0; n < p.antal; n++) if (cell[n] >= 0) ordning[fyllt[cell[n]]++] = n;
    return { start: antal, ordning };
  }

  /**
   * Hittar enskilda träd i höjd över mark. Toppar utan markträffar under kronan
   * räknas som tak och tas bort (laserpulser går igenom trädkronor men inte tak).
   */
  function hittaTrad(y, p, { minHojd = 3, maxKrona = 16, stangning = 1, fa = 0.5, fb = 0.05, markRadie = 0.5, markKvot = 0.05 } = {}) {
    const { W, H, s } = y;
    // höjd över mark med lätt stängning (1 cell), sedan utjämnad (1-2-1)
    const bas = stangning ? filter(filter(y.ra, W, H, stangning, true), W, H, stangning, false) : y.ra;
    const chm = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      let sum = 0, vikt = 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
        const ii = i + a, jj = j + b;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        const w = (a ? 1 : 2) * (b ? 1 : 2);
        sum += bas[jj * W + ii] * w; vikt += w;
      }
      chm[j * W + i] = sum / vikt;
    }
    const idx = punktIndex(p, y);
    const kandidater = [];
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const c = j * W + i, h = chm[c];
      if (h < minHojd) continue;
      const r = Math.max(1, Math.round((fa + fb * h) / s));
      let topp = true;
      for (let b = -r; b <= r && topp; b++) for (let a = -r; a <= r; a++) {
        if (!a && !b) continue;
        const ii = i + a, jj = j + b;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        const v = chm[jj * W + ii];
        if (v > h || (v === h && jj * W + ii < c)) { topp = false; break; }
      }
      if (topp) kandidater.push({ i, j, h });
    }
    const riktningar = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    const trad = [];
    for (const k of kandidater) {
      // kronradie: medelavstånd till där höjden fallit till hälften, i 8 riktningar
      let summa = 0;
      for (const [dx, dy] of riktningar) {
        const steg = Math.hypot(dx, dy) * s;
        let d = 0, ii = k.i, jj = k.j, forra = k.h;
        while (d < maxKrona / 2) {
          ii += dx; jj += dy;
          if (ii < 0 || jj < 0 || ii >= W || jj >= H) break;
          const v = chm[jj * W + ii];
          if (v < 0.5 * k.h || v > forra + 0.3) break;
          forra = v; d += steg;
        }
        summa += d + steg / 2;
      }
      const r = Math.max(0.5, summa / 8);
      // markträffar under kronan
      const rr = Math.max(1, markRadie * r), rc = Math.ceil(rr / s);
      const xc = y.x0 + k.i * s, yc = y.y1 - k.j * s;
      let tot = 0, markt = 0;
      for (let b = -rc; b <= rc; b++) for (let a = -rc; a <= rc; a++) {
        const ii = k.i + a, jj = k.j + b;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        const c = jj * W + ii;
        for (let q = idx.start[c]; q < idx.start[c + 1]; q++) {
          const n = idx.ordning[q];
          if (Math.hypot(p.x[n] - xc, p.y[n] - yc) > rr) continue;
          if (p.k[n] === 2) markt++; else if (OBJEKT(p.k[n])) tot++;
        }
      }
      if (tot + markt >= 5 && markt < Math.max(1, markKvot * (tot + markt))) continue;   // tak
      // höjd: högsta råvärde nära toppen
      let hojd = 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
        const ii = k.i + a, jj = k.j + b;
        if (ii >= 0 && jj >= 0 && ii < W && jj < H) hojd = Math.max(hojd, y.ra[jj * W + ii]);
      }
      trad.push({ x: xc, y: yc, zMark: y.dtm[k.j * W + k.i], hojd: hojd || k.h, krona: 2 * r });
    }
    // slå ihop toppar som ligger för nära varandra
    trad.sort((a, b) => b.hojd - a.hojd);
    const behall = [];
    for (const t of trad) {
      if (behall.some(o => Math.hypot(o.x - t.x, o.y - t.y) < Math.max(1.5, 0.3 * o.krona))) continue;
      behall.push(t);
    }
    // kronan kan inte vara bredare än avståndet till närmaste granne
    for (const t of behall) {
      let nn = Infinity;
      for (const o of behall) if (o !== t) nn = Math.min(nn, Math.hypot(o.x - t.x, o.y - t.y));
      if (nn < Infinity) t.krona = Math.max(1, Math.min(t.krona, nn * 1.1));
    }
    return behall;
  }

  // ------------------------------------------------------------------
  // Skuggor
  // ------------------------------------------------------------------
  /**
   * y: ytmodell som täcker utsnittet med marginal. r: utsnittet. tider: [{az, h}] med
   * sant azimut. konv: rutnätets nord i förhållande till geografisk nord (grader, öster +).
   * Returnerar {W, H, s, x0, y1 (cellcentrum), masker: [Uint8Array]}.
   */
  function skuggor(y, r, tider, { s = 1, steg = 0.5, maxAvst = 300, konv = 0, mottagare = 0.3 } = {}) {
    const W = Math.round((r.xmax - r.xmin) / s), H = Math.round((r.ymax - r.ymin) / s);
    const x0 = r.xmin + s / 2, y1 = r.ymax - s / 2;
    let zmax = -Infinity;
    for (const v of y.dsm) if (v > zmax) zmax = v;
    const masker = tider.map(t => {
      const m = new Uint8Array(W * H);
      if (t.h <= 0) { m.fill(1); return m; }
      const g = (t.az - konv) * RAD, dx = Math.sin(g), dy = Math.cos(g), tn = Math.tan(t.h * RAD);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const x = x0 + i * s, yy = y1 - j * s;
        const z0 = nod(y, y.dtm, x, yy) + mottagare;
        if (!(z0 === z0)) continue;
        const dmax = Math.min(maxAvst, (zmax - z0) / tn);
        for (let d = steg; d <= dmax; d += steg) {
          const zs = nod(y, y.dsm, x + dx * d, yy + dy * d);
          if (!(zs === zs)) break;
          if (zs > z0 + d * tn) { m[j * W + i] = 1; break; }
        }
      }
      return m;
    });
    return { W, H, s, x0, y1, masker };
  }

  /** Konturer (slutna polylinjer) runt skuggade celler. */
  function maskKonturer(sk, m, tol = 0.2) {
    const W = sk.W + 2, H = sk.H + 2, z = new Float32Array(W * H);
    for (let j = 0; j < sk.H; j++) for (let i = 0; i < sk.W; i++) z[(j + 1) * W + i + 1] = m[j * sk.W + i];
    const g = { W, H, s: sk.s, x0: sk.x0 - sk.s, y1: sk.y1 + sk.s, z };
    return Terrang.kurvorForNiva(g, 0.5)
      .map(l => ({ sluten: true, pts: Terrang.forenkla(l.sluten ? l.pts.slice(0, -1) : l.pts, tol) }))
      .filter(l => l.pts.length >= 3);
  }

  // ------------------------------------------------------------------
  // Sektioner
  // ------------------------------------------------------------------
  /**
   * Sektion från a till b (zonkoordinater). dtm: nodrutnät. p: laserpunkter i zonen.
   * Returnerar {langd, mark: [[d, z]], punkter: [[d, z, k]], yta: [[d, z]]}.
   */
  function sektion(a, b, dtm, p, { band = 2, steg = 0.5 } = {}) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
    const mark = [];
    for (let d = 0; d <= L + 1e-6; d += steg) {
      const z = nod(dtm, dtm.z, a[0] + ux * d, a[1] + uy * d);
      if (z === z) mark.push([d, z]);
    }
    const punkter = [];
    if (p) for (let n = 0; n < p.antal; n++) {
      const dx = p.x[n] - a[0], dy = p.y[n] - a[1];
      const t = dx * ux + dy * uy, off = -dx * uy + dy * ux;
      if (t < 0 || t > L || Math.abs(off) > band) continue;
      if (p.k[n] === 7 || p.k[n] === 18) continue;
      punkter.push([t, p.z[n], p.k[n]]);
    }
    // övre kontur: högsta objektpunkt per meter, annars marken
    const nb = Math.ceil(L), hogst = new Float32Array(nb + 1).fill(NaN);
    for (const [t, z, k] of punkter) {
      if (!OBJEKT(k)) continue;
      const i = Math.round(t);
      if (!(hogst[i] >= z)) hogst[i] = z;
    }
    const yta = [];
    for (let i = 0; i <= nb; i++) {
      const d = Math.min(i, L), zm = nod(dtm, dtm.z, a[0] + ux * d, a[1] + uy * d);
      if (!(zm === zm)) continue;
      const z = hogst[i] > zm + 0.5 ? hogst[i] : zm;
      yta.push([d, z]);
    }
    return { langd: L, mark, punkter, yta };
  }

  // ------------------------------------------------------------------
  // Horisont
  // ------------------------------------------------------------------
  /** Interpolation i pixelrutnät {E0, N1, s, w, h, data} (pixelcentrum). */
  function pix(m, E, N) {
    const s = m.s || 1;
    const fx = (E - m.E0) / s - 0.5, fy = (m.N1 - N) / s - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= m.w - 1 || j >= m.h - 1) return NaN;
    const tx = fx - i, ty = fy - j, d = m.data, w = m.w;
    return (d[j * w + i] * (1 - tx) + d[j * w + i + 1] * tx) * (1 - ty) + (d[(j + 1) * w + i] * (1 - tx) + d[(j + 1) * w + i + 1] * tx) * ty;
  }

  /**
   * Ytmodell i SWEREF 99 TM (pixelrutnät) av höjdmosaiken plus laserpunkterna.
   * utesluts(E, N) → true för punkter som inte ska räknas.
   */
  function ytmodellTM(m, p, { utesluts = null, stangning = 2 } = {}) {
    const { E0, N1, w, h } = m;
    const ra = new Float32Array(w * h);
    for (let n = 0; n < p.antal; n++) {
      if (!OBJEKT(p.k[n])) continue;
      const E = p.x[n], N = p.y[n];
      if (utesluts && utesluts(E, N)) continue;
      const i = Math.floor(E - E0), j = Math.floor(N1 - N);
      if (i < 0 || j < 0 || i >= w || j >= h) continue;
      const c = j * w + i, g = m.data[c];
      if (!(g === g)) continue;
      const v = p.z[n] - g;
      if (v > ra[c]) ra[c] = v;
    }
    const st = stangning ? filter(filter(ra, w, h, stangning, true), w, h, stangning, false) : ra;
    const data = new Float32Array(w * h);
    for (let c = 0; c < w * h; c++) data[c] = m.data[c] + st[c];
    return { E0, N1, w, h, s: 1, data };
  }

  /**
   * Horisontprofil sedd från (E, N) i SWEREF 99 TM på höjden z0 (RH 2000).
   * nara: ytmodell 1 m (med träd och byggnader), fjarr: grov höjdmodell.
   * konvTM: TM-rutnätets nord i förhållande till geografisk nord (grader, öster +).
   * Returnerar Float32Array med 720 höjdvinklar (grader) för sant azimut 0, 0,5 … 359,5.
   */
  function horisont(E, N, z0, nara, fjarr, konvTM, { naraRadie = 400, maxAvst = 5000 } = {}) {
    const ut = new Float32Array(720), R = 6371000, k = 0.13;
    for (let a = 0; a < 720; a++) {
      const g = (a * 0.5 - konvTM) * RAD, dx = Math.sin(g), dy = Math.cos(g);
      let bast = -90, d = 2;
      while (d <= maxAvst) {
        const z = d <= naraRadie && nara ? pix(nara, E + dx * d, N + dy * d) : (fjarr ? pix(fjarr, E + dx * d, N + dy * d) : NaN);
        if (z === z) {
          const v = Math.atan2(z - z0 - d * d / (2 * R) * (1 - k), d) / RAD;
          if (v > bast) bast = v;
        }
        d += d < 300 ? 1 : d < 1000 ? 3 : d < 3000 ? 8 : 15;
      }
      ut[a] = bast;
    }
    return ut;
  }

  /**
   * Tar bort det träd eller den byggnad som punkten (E, N) står i eller under, så att
   * horisonten inte räknas inifrån ett tak eller en krona. Fyller från punkten genom
   * sammanhängande celler med mer än `grans` m över mark, högst `radie` m bort,
   * och sätter dem till markhöjd. Ändrar yta.data. Returnerar antal borttagna m².
   */
  function rensaVidPunkt(yta, dtm, E, N, { radie = 20, grans = 1.5, sok = 1.5 } = {}) {
    const { E0, N1, w, h } = yta;
    const i0 = Math.floor(E - E0), j0 = Math.floor(N1 - N);
    const over = c => yta.data[c] - dtm.data[c] > grans;
    const ko = [];
    const sett = new Uint8Array(w * h);
    const s = Math.ceil(sok);
    for (let dj = -s; dj <= s; dj++) for (let di = -s; di <= s; di++) {
      const i = i0 + di, j = j0 + dj;
      if (i < 0 || j < 0 || i >= w || j >= h || Math.hypot(di, dj) > sok) continue;
      const c = j * w + i;
      if (over(c)) { sett[c] = 1; ko.push(c); }
    }
    let antal = 0;
    while (ko.length) {
      const c = ko.pop(), i = c % w, j = (c - i) / w;
      yta.data[c] = dtm.data[c]; antal++;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= w || jj >= h || Math.hypot(ii - i0, jj - j0) > radie) continue;
        const cc = jj * w + ii;
        if (!sett[cc] && over(cc)) { sett[cc] = 1; ko.push(cc); }
      }
    }
    return antal;
  }

  /** Horisontens höjdvinkel vid sant azimut az (interpolerad). */
  function horisontVid(hor, az) {
    const f = ((az % 360) + 360) % 360 / 0.5, i = Math.floor(f) % 720, t = f - Math.floor(f);
    return hor[i] * (1 - t) + hor[(i + 1) % 720] * t;
  }

  // ------------------------------------------------------------------
  // Export
  // ------------------------------------------------------------------
  const kom = (v, d) => v.toFixed(d).replace('.', ',');
  const ram = r => ({ typ: 'pl', lager: 'UTSNITT', pts: [[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax]], sluten: true });

  /** Träd: krona som cirkel på trädtoppens höjd, stam som punkt på marken, höjd som text. */
  function dxfTrad(trad, r, dx, dy, dz) {
    const objekt = [];
    for (const t of trad) {
      objekt.push({ typ: 'cirkel', lager: 'TRAD_KRONA', x: t.x, y: t.y, z: t.zMark + t.hojd, r: t.krona / 2 });
      objekt.push({ typ: 'punkt', lager: 'TRAD_STAM', x: t.x, y: t.y, z: t.zMark });
      objekt.push({ typ: 'text', lager: 'TRAD_TEXT', x: t.x + 0.3, y: t.y + 0.3, h: 0.7, text: `${Math.round(t.hojd)} m` });
    }
    objekt.push(ram(r));
    return Dxf.skriv({ TRAD_KRONA: 3, TRAD_STAM: 3, TRAD_TEXT: 7, UTSNITT: 3 }, objekt, { dx, dy, dz, ext: r });
  }
  function csvTrad(trad, dx, dy, dz) {
    const rader = ['id;x;y;x_lokal;y_lokal;markhojd;tradhojd_m;topphojd;kronbredd_m'];
    const lok = Terrang.tillLokal(dx, dy);
    trad.forEach((t, i) => { const [lx, ly] = lok(t.x, t.y); rader.push([i + 1, t.x.toFixed(2), t.y.toFixed(2), lx.toFixed(2), ly.toFixed(2),
      (t.zMark - dz).toFixed(2), t.hojd.toFixed(1), (t.zMark + t.hojd - dz).toFixed(2), t.krona.toFixed(1)].join(';')); });
    return rader.join('\r\n') + '\r\n';
  }

  /** Skuggor: ett lager per tid, t.ex. SKUGGA_0320_1200. */
  function dxfSkuggor(lista, r, dx, dy) {
    const lager = { UTSNITT: 3 }, objekt = [], farger = [8, 9, 252, 253, 251, 250];
    lista.forEach((s, i) => {
      lager[s.lager] = farger[i % farger.length];
      s.konturer.forEach(l => objekt.push({ typ: 'pl', lager: s.lager, pts: l.pts, sluten: true }));
    });
    objekt.push(ram(r));
    return Dxf.skriv(lager, objekt, { dx, dy, ext: r });
  }

  /**
   * Sektioner i en DXF, staplade under varandra. x = avstånd längs linjen, y = höjd (RH 2000 − dz).
   * Lager: SEKTION_MARK, SEKTION_YTA (övre kontur av träd och byggnader), SEKTION_PUNKTER, SEKTION_TEXT, SEKTION_REF.
   */
  function dxfSektioner(sektioner, dz) {
    const objekt = [];
    let yOff = 0;
    for (const s of sektioner) {
      const zs = s.mark.map(p => p[1]).concat(s.yta.map(p => p[1]));
      const zmin = Math.min(...zs), zmax = Math.max(...zs);
      const ref = Math.floor((zmin - 2) / 5) * 5;            // referenslinje på jämn höjd under marken
      const ty = v => v - dz + yOff;
      objekt.push({ typ: 'pl', lager: 'SEKTION_MARK', pts: s.mark.map(p => [p[0], ty(p[1])]) });
      objekt.push({ typ: 'pl', lager: 'SEKTION_YTA', pts: s.yta.map(p => [p[0], ty(p[1])]) });
      for (const [d, z, k] of s.punkter) if (k !== 2 && k !== 9) objekt.push({ typ: 'punkt', lager: 'SEKTION_PUNKTER', x: d, y: ty(z) });
      objekt.push({ typ: 'pl', lager: 'SEKTION_REF', pts: [[0, ty(ref)], [s.langd, ty(ref)]] });
      objekt.push({ typ: 'text', lager: 'SEKTION_TEXT', x: 0, y: ty(ref) - 3, h: 2, text: `${s.namn}–${s.namn}   längd ${kom(s.langd, 1)} m` });
      objekt.push({ typ: 'text', lager: 'SEKTION_TEXT', x: -14, y: ty(ref) + 0.3, h: 1, text: `+${kom(ref, 1)}` });
      for (let d = 0; d <= s.langd + 1e-6; d += 10) {
        objekt.push({ typ: 'pl', lager: 'SEKTION_REF', pts: [[d, ty(ref)], [d, ty(ref) - 0.6]] });
        objekt.push({ typ: 'text', lager: 'SEKTION_TEXT', x: d - 0.6, y: ty(ref) - 1.8, h: 0.8, text: String(d) });
      }
      for (const [d, nm] of [[0, s.namn], [s.langd, s.namn + '´']]) {
        const zm = (s.mark.find(p => Math.abs(p[0] - d) < 0.3) || s.mark[d ? s.mark.length - 1 : 0])[1];
        objekt.push({ typ: 'text', lager: 'SEKTION_TEXT', x: d + 0.5, y: ty(zm) + 1, h: 1, text: `+${kom(zm, 2)}` });
      }
      yOff -= (zmax - ref) + 25;
    }
    return Dxf.skriv({ SEKTION_MARK: 30, SEKTION_YTA: 3, SEKTION_PUNKTER: 8, SEKTION_TEXT: 7, SEKTION_REF: 9 }, objekt, {});
  }

  /** Sektionslinjerna i plan. */
  function dxfSektionslinjer(sektioner, r, dx, dy) {
    const objekt = [];
    for (const s of sektioner) {
      // s.a, s.b är linjens ändar på kartan; blickriktningen är vänster om A→B, eller höger om s.vand
      const l = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) || 1;
      const dxr = (s.b[0] - s.a[0]) / l, dyr = (s.b[1] - s.a[1]) / l;
      const nx = s.vand ? dyr : -dyr, ny = s.vand ? -dxr : dxr, P = Math.min(4, l / 6), h = P * 0.35;
      objekt.push({ typ: 'pl', lager: 'SEKTIONSLINJE', pts: [s.a, s.b] });
      for (const [ex, ey, ut] of [[s.a[0], s.a[1], -1], [s.b[0], s.b[1], 1]]) {
        const tx = ex + nx * P, ty = ey + ny * P;
        objekt.push({ typ: 'pl', lager: 'SEKTIONSLINJE', pts: [[ex, ey], [tx, ty]] });
        objekt.push({ typ: 'pl', lager: 'SEKTIONSLINJE', pts: [[tx - nx * h + dxr * h * 0.7, ty - ny * h + dyr * h * 0.7], [tx, ty], [tx - nx * h - dxr * h * 0.7, ty - ny * h - dyr * h * 0.7]] });
        objekt.push({ typ: 'text', lager: 'SEKTIONSLINJE_TEXT', x: ex + dxr * ut * 1.5 - 0.6, y: ey + dyr * ut * 1.5 - 0.9, h: 2, text: s.namn });
      }
    }
    objekt.push(ram(r));
    return Dxf.skriv({ SEKTIONSLINJE: 6, SEKTIONSLINJE_TEXT: 6, UTSNITT: 3 }, objekt, { dx, dy, ext: r });
  }

  /** Världsfil för en bild (x0, y1 = mitten av övre vänstra pixeln). dx, dy ≠ 0 ger lokala koordinater med eventuell vridning. */
  function varldsfil(x0, y1, s, dx = 0, dy = 0) {
    const t = Terrang.tillLokal(dx, dy), [C, F] = t(x0, y1);
    const v = (dx || dy) ? Terrang.lokal.vrid * Math.PI / 180 : 0, c = Math.cos(v), sn = Math.sin(v);
    return [s * c, -s * sn, -s * sn, -s * c, C, F].map(q => q.toFixed(6)).join('\r\n') + '\r\n';
  }

  return { nod, ytmodell, hittaTrad, skuggor, maskKonturer, sektion, ytmodellTM, rensaVidPunkt, horisont, horisontVid, punktIndex,
    dxfTrad, csvTrad, dxfSkuggor, dxfSektioner, dxfSektionslinjer, varldsfil };
}));
