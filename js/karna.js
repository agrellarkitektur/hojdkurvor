/*
 * Terräng till Archicad – beräkningskärna
 *
 * Läser Lantmäteriets markhöjdmodell (COG, SWEREF 99 TM + RH 2000) direkt
 * från dl1.lantmateriet.se, bara det fönster som behövs, och skapar
 * höjdkurvor (DXF) och mesh-punkter (XYZ) i vald SWEREF 99-zon.
 *
 * Kräver globala GeoTIFF (geotiff.js) och proj4. Fungerar i webbläsare och Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Terrang = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const G = () => (typeof GeoTIFF !== 'undefined' ? GeoTIFF : globalThis.GeoTIFF);
  const P = () => (typeof proj4 !== 'undefined' ? proj4 : globalThis.proj4);

  // ------------------------------------------------------------------
  // Koordinatsystem
  // ------------------------------------------------------------------
  const ZONER = [
    { epsg: 3006, namn: 'SWEREF 99 TM', lon0: 15, k: 0.9996, fe: 500000 },
    { epsg: 3007, namn: 'SWEREF 99 12 00', lon0: 12 },
    { epsg: 3008, namn: 'SWEREF 99 13 30', lon0: 13.5 },
    { epsg: 3012, namn: 'SWEREF 99 14 15', lon0: 14.25 },
    { epsg: 3009, namn: 'SWEREF 99 15 00', lon0: 15 },
    { epsg: 3013, namn: 'SWEREF 99 15 45', lon0: 15.75 },
    { epsg: 3010, namn: 'SWEREF 99 16 30', lon0: 16.5 },
    { epsg: 3014, namn: 'SWEREF 99 17 15', lon0: 17.25 },
    { epsg: 3011, namn: 'SWEREF 99 18 00', lon0: 18 },
    { epsg: 3015, namn: 'SWEREF 99 18 45', lon0: 18.75 },
    { epsg: 3016, namn: 'SWEREF 99 20 15', lon0: 20.25 },
    { epsg: 3017, namn: 'SWEREF 99 21 45', lon0: 21.75 },
    { epsg: 3018, namn: 'SWEREF 99 23 15', lon0: 23.25 },
  ];
  ZONER.forEach(z => { if (z.k === undefined) { z.k = 1; z.fe = 150000; } });

  function zon(epsg) {
    const z = ZONER.find(z => z.epsg === Number(epsg));
    if (!z) throw new Error('Okänt koordinatsystem: EPSG:' + epsg);
    return z;
  }

  function registreraZoner() {
    const p = P();
    ZONER.forEach(z => p.defs('EPSG:' + z.epsg,
      `+proj=tmerc +lat_0=0 +lon_0=${z.lon0} +k=${z.k} +x_0=${z.fe} +y_0=0 ` +
      '+ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'));
  }

  /** Lokala zonen vars medelmeridian ligger närmast (reserv när kommunen är okänd). */
  function narmasteZon(lon, bland) {
    const kand = ZONER.filter(z => z.epsg !== 3006 && (!bland || bland.includes(z.epsg)));
    return kand.reduce((a, b) => Math.abs(b.lon0 - lon) < Math.abs(a.lon0 - lon) ? b : a).epsg;
  }

  function omvandlare(fran, till) {
    return P()('EPSG:' + fran, 'EPSG:' + till);
  }

  /**
   * Var en punkt (x öst, y nord) hamnar om den tolkas i varje SWEREF 99-system.
   * hittaKommun(lon, lat) ger kommunens egenskaper { namn, kod, epsg } eller null.
   * Returnerar en rad per system: { epsg, lat, lon, kommun, passar }, där passar
   * betyder att punkten hamnar i en kommun som normalt använder just det systemet.
   * De lokala zonerna har samma falska östvärde, så fel zon flyttar platsen i öst–väst.
   */
  function tolkaZon(x, y, hittaKommun) {
    return ZONER.map(z => {
      const [lon, lat] = omvandlare(z.epsg, 4326).forward([x, y]);
      const kommun = isFinite(lon) && isFinite(lat) && hittaKommun ? hittaKommun(lon, lat) : null;
      return { epsg: z.epsg, lat, lon, kommun, passar: !!(kommun && kommun.epsg === z.epsg) };
    });
  }

  /** Latitud och longitud (WGS 84) som text med punkt och fem decimaler, t.ex. "57.66291, 15.85612". */
  function latLonText(epsg, x, y) {
    const [lon, lat] = omvandlare(epsg, 4326).forward([x, y]);
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }

  // ------------------------------------------------------------------
  // Utsnitt
  // ------------------------------------------------------------------
  /** Avrundar varje kant till närmaste jämna steg (minst ett steg stort). */
  function avrunda(r, steg) {
    steg = steg > 0 ? steg : 1;
    const a = v => Math.round(v / steg) * steg;
    let xmin = a(r.xmin), ymin = a(r.ymin), xmax = a(r.xmax), ymax = a(r.ymax);
    if (xmax <= xmin) xmax = xmin + steg;
    if (ymax <= ymin) ymax = ymin + steg;
    return { xmin, ymin, xmax, ymax };
  }

  /** Utsnittets kant som punktlista (förtätad), för ritning och omvandling. */
  function kantlinje(r, n = 8) {
    const pts = [];
    const sidor = [[r.xmin, r.ymin, r.xmax, r.ymin], [r.xmax, r.ymin, r.xmax, r.ymax],
                   [r.xmax, r.ymax, r.xmin, r.ymax], [r.xmin, r.ymax, r.xmin, r.ymin]];
    for (const [x0, y0, x1, y1] of sidor)
      for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);
    return pts;
  }

  // ------------------------------------------------------------------
  // Höjdrutor från Lantmäteriet (10 × 10 km i SWEREF 99 TM)
  // ------------------------------------------------------------------
  const DL_ROT = 'https://dl1.lantmateriet.se';
  /** Lantmäteriets nedladdningsadress; i test kan roten bytas via self.TERRANG_DL_ROT. */
  function dlUrl(url) {
    const rot = typeof self !== 'undefined' && self.TERRANG_DL_ROT;
    return rot ? url.replace(DL_ROT, rot) : url;
  }
  const DL_BAS = DL_ROT + '/hojd/data/grid/mhm';

  function rutor(tmBox) {
    const ut = [];
    for (let n = Math.floor(tmBox.ymin / 1e4); n <= Math.floor((tmBox.ymax - 1e-6) / 1e4); n++)
      for (let e = Math.floor(tmBox.xmin / 1e4); e <= Math.floor((tmBox.xmax - 1e-6) / 1e4); e++) {
        const id = `${n}_${e}`;
        ut.push({ id, url: `${DL_BAS}/${Math.floor(n / 10)}_${Math.floor(e / 10)}/m${id}.tif` });
      }
    return ut;
  }

  /** Basic-auth-huvud, korrekt även med å, ä, ö i lösenordet. */
  function basicAuth(anv, losen) {
    const bytes = new TextEncoder().encode(`${anv}:${losen}`);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return 'Basic ' + btoa(bin);
  }

  class InloggningsFel extends Error {}

  /** Kontrollerar inloggningen mot en ruta med en liten Range-förfrågan. */
  async function provaInloggning(url, auth) {
    let res;
    try {
      res = await fetch(url, { headers: { Authorization: auth, Range: 'bytes=0-15' } });
    } catch (e) {
      throw new Error('Kunde inte nå Lantmäteriets server. Kontrollera nätverket.');
    }
    if (res.status === 401 || res.status === 403)
      throw new InloggningsFel('Lantmäteriet godkände inte inloggningen. Kontrollera användarnamn ' +
        'och lösenord, och att Markhöjdmodell Nedladdning är beställd på Geotorget.');
    if (res.status === 404) return false;
    if (!res.ok && res.status !== 206) throw new Error(`Lantmäteriet svarade ${res.status}.`);
    return true;
  }

  /**
   * Läser höjder ur rutorna inom tmBox (SWEREF 99 TM) till ett sammanfogat rutnät
   * med 1 m pixlar. Saknad data blir NaN.
   */
  async function lasHojder(tmBox, auth, opts = {}) {
    const logg = opts.logg || (() => {});
    const urlFor = opts.urlFor || (r => dlUrl(r.url));
    const E0 = Math.floor(tmBox.xmin), N1 = Math.ceil(tmBox.ymax);
    const w = Math.ceil(tmBox.xmax) - E0, h = N1 - Math.floor(tmBox.ymin);
    const data = new Float32Array(w * h).fill(NaN);
    const lista = rutor(tmBox);
    const lasta = [];

    for (const r of lista) {
      const url = urlFor(r);
      const finns = await provaInloggning(url, auth);
      if (!finns) { logg(`Ruta ${r.id} finns inte (troligen hav) – hoppas över.`); continue; }
      const tiff = await G().fromUrl(url, { headers: { Authorization: auth }, allowFullFile: false });
      const img = await tiff.getImage(0);
      const [ox, oy] = img.getOrigin();
      const [rx, ry] = img.getResolution();
      if (Math.abs(rx - 1) > 1e-6 || Math.abs(ry + 1) > 1e-6)
        throw new Error(`Ruta ${r.id} har oväntad upplösning (${rx} m).`);
      const W = img.getWidth(), H = img.getHeight();
      const c0 = Math.max(0, Math.floor(E0 - ox)), c1 = Math.min(W, Math.ceil(E0 + w - ox));
      const r0 = Math.max(0, Math.floor(oy - N1)), r1 = Math.min(H, Math.ceil(oy - (N1 - h)));
      if (c1 <= c0 || r1 <= r0) continue;
      logg(`Läser ruta ${r.id} …`);
      const nd = img.getGDALNoData();
      const [band] = await img.readRasters({ window: [c0, r0, c1, r1], samples: [0] });
      const bw = c1 - c0;
      for (let j = r0; j < r1; j++) {
        const gy = Math.round(N1 - (oy - j)), dst = gy * w;
        for (let i = c0; i < c1; i++) {
          const v = band[(j - r0) * bw + (i - c0)];
          if (v === nd || v < -1000 || !isFinite(v)) continue;
          data[dst + Math.round(ox + i - E0)] = v;
        }
      }
      lasta.push(r.id);
    }
    return { E0, N1, w, h, data, rutor: lasta };
  }

  /**
   * Grov höjdmodell (t.ex. 8 m) över ett stort område i SWEREF 99 TM, via filernas
   * översiktsnivåer. Används för horisonten. Rutor som saknas lämnas som NaN.
   * Returnerar {E0, N1, s, w, h, data} med pixel (i, j) centrerad i E0+(i+0.5)s, N1−(j+0.5)s.
   */
  async function lasHojderGrov(tmBox, s, auth, opts = {}) {
    const urlFor = opts.urlFor || (r => dlUrl(r.url));
    const E0 = Math.floor(tmBox.xmin / s) * s, N1 = Math.ceil(tmBox.ymax / s) * s;
    const w = Math.ceil((tmBox.xmax - E0) / s), h = Math.ceil((N1 - tmBox.ymin) / s);
    const data = new Float32Array(w * h).fill(NaN);
    for (const r of rutor(tmBox)) {
      const url = urlFor(r);
      if (!(await provaInloggning(url, auth))) continue;
      const tiff = await G().fromUrl(url, { headers: { Authorization: auth }, allowFullFile: false });
      const img = await tiff.getImage(0);
      const [bx0, by0, bx1, by1] = img.getBoundingBox();
      const ix0 = Math.max(0, Math.ceil((bx0 - E0) / s)), ix1 = Math.min(w, Math.floor((bx1 - E0) / s));
      const iy0 = Math.max(0, Math.ceil((N1 - by1) / s)), iy1 = Math.min(h, Math.floor((N1 - by0) / s));
      if (ix1 <= ix0 || iy1 <= iy0) continue;
      const nd = img.getGDALNoData();
      const ras = await tiff.readRasters({
        bbox: [E0 + ix0 * s, N1 - iy1 * s, E0 + ix1 * s, N1 - iy0 * s],
        width: ix1 - ix0, height: iy1 - iy0, samples: [0], resampleMethod: 'bilinear',
      });
      const band = ras[0], bw = ix1 - ix0;
      for (let j = iy0; j < iy1; j++) for (let i = ix0; i < ix1; i++) {
        const v = band[(j - iy0) * bw + (i - ix0)];
        if (v === nd || v < -1000 || !isFinite(v)) continue;
        data[j * w + i] = v;
      }
    }
    return { E0, N1, s, w, h, data };
  }

  /** Bilinjär interpolation mellan pixelcentrum; NaN om någon granne saknas. */
  function sampla(m, E, N) {
    const fx = E - m.E0 - 0.5, fy = m.N1 - N - 0.5;
    let i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= m.w - 1 || j >= m.h - 1) {
      // Vid mosaikens kant: närmaste pixel
      i = Math.min(m.w - 1, Math.max(0, Math.round(fx)));
      j = Math.min(m.h - 1, Math.max(0, Math.round(fy)));
      return m.data[j * m.w + i];
    }
    const tx = fx - i, ty = fy - j, d = m.data, w = m.w;
    const a = d[j * w + i], b = d[j * w + i + 1], c = d[(j + 1) * w + i], e = d[(j + 1) * w + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty;
  }

  /**
   * Rutnät med noder på utsnittets kanter: x = xmin, xmin+s … xmax (rad 0 = norr).
   * Koordinatomvandlingen räknas exakt på ett glesare nät och interpoleras
   * däremellan (fel under en millimeter, men mycket snabbare).
   */
  function rutnat(m, r, s, epsg) {
    const nx = Math.round((r.xmax - r.xmin) / s), ny = Math.round((r.ymax - r.ymin) / s);
    const W = nx + 1, H = ny + 1;
    const z = new Float32Array(W * H);
    const tillTM = epsg === 3006 ? (p => p) : omvandlare(epsg, 3006).forward;
    const L = Math.max(1, Math.round(25 / s));            // grov nod var ~25 m
    const gw = Math.ceil(nx / L) + 1, gh = Math.ceil(ny / L) + 1;
    const gE = new Float64Array(gw * gh), gN = new Float64Array(gw * gh);
    for (let b = 0; b < gh; b++) for (let a = 0; a < gw; a++) {
      const i = Math.min(a * L, nx), j = Math.min(b * L, ny);
      const [E, N] = tillTM([r.xmin + i * s, r.ymax - j * s]);
      gE[b * gw + a] = E; gN[b * gw + a] = N;
    }
    for (let j = 0; j < H; j++) {
      const b = Math.min(Math.floor(j / L), gh - 2), jb0 = b * L, jb1 = Math.min((b + 1) * L, ny);
      const ty = gh > 1 && jb1 > jb0 ? (j - jb0) / (jb1 - jb0) : 0;
      for (let i = 0; i < W; i++) {
        const a = Math.min(Math.floor(i / L), gw - 2), ia0 = a * L, ia1 = Math.min((a + 1) * L, nx);
        const tx = gw > 1 && ia1 > ia0 ? (i - ia0) / (ia1 - ia0) : 0;
        const k00 = b * gw + a, k10 = k00 + (gw > 1 ? 1 : 0), k01 = k00 + (gh > 1 ? gw : 0), k11 = k01 + (k10 - k00);
        const E = (gE[k00] * (1 - tx) + gE[k10] * tx) * (1 - ty) + (gE[k01] * (1 - tx) + gE[k11] * tx) * ty;
        const N = (gN[k00] * (1 - tx) + gN[k10] * tx) * (1 - ty) + (gN[k01] * (1 - tx) + gN[k11] * tx) * ty;
        z[j * W + i] = sampla(m, E, N);
      }
    }
    return { W, H, s, x0: r.xmin, y1: r.ymax, z };
  }

  /** NaN-säker utjämning: två varv lådfilter med given radie (celler). */
  function utjamna(g, radie) {
    if (!radie) return g;
    const { W, H } = g;
    let src = g.z;
    const pass = (inp, horis) => {
      const out = new Float32Array(W * H);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        let sum = 0, n = 0;
        for (let k = -radie; k <= radie; k++) {
          const ii = horis ? i + k : i, jj = horis ? j : j + k;
          if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
          const v = inp[jj * W + ii];
          if (v === v) { sum += v; n++; }
        }
        out[j * W + i] = isNaN(inp[j * W + i]) || !n ? NaN : sum / n;
      }
      return out;
    };
    for (let v = 0; v < 2; v++) src = pass(pass(src, true), false);
    return Object.assign({}, g, { z: src });
  }

  // ------------------------------------------------------------------
  // Höjdkurvor (marching squares)
  // ------------------------------------------------------------------
  function arMultipel(v, m) { const k = v / m; return Math.abs(k - Math.round(k)) < 1e-7; }

  function kurvlager(h) {
    if (arMultipel(h, 10)) return 'HOJDKURVA_10M';
    if (arMultipel(h, 5)) return 'HOJDKURVA_5M';
    if (arMultipel(h, 1)) return 'HOJDKURVA_1M';
    if (arMultipel(h, 0.5)) return 'HOJDKURVA_0_5M';
    return 'HOJDKURVA_0_25M';
  }

  function kurvorForNiva(g, L) {
    const { W, H, z, s, x0, y1 } = g;
    // Kanter: horisontell (i,j)-(i+1,j) får id j*(W-1)+i, vertikal (i,j)-(i,j+1) får offset + j*W+i
    const voff = (W - 1) * H;
    const punkt = new Map();
    const seg = [];
    const pH = (i, j) => {
      const id = j * (W - 1) + i;
      if (!punkt.has(id)) {
        const a = z[j * W + i], b = z[j * W + i + 1], t = (L - a) / (b - a);
        punkt.set(id, [x0 + (i + t) * s, y1 - j * s]);
      }
      return id;
    };
    const pV = (i, j) => {
      const id = voff + j * W + i;
      if (!punkt.has(id)) {
        const a = z[j * W + i], b = z[(j + 1) * W + i], t = (L - a) / (b - a);
        punkt.set(id, [x0 + i * s, y1 - (j + t) * s]);
      }
      return id;
    };
    for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) {
      const tl = z[j * W + i], tr = z[j * W + i + 1], bl = z[(j + 1) * W + i], br = z[(j + 1) * W + i + 1];
      if (!(tl === tl && tr === tr && bl === bl && br === br)) continue;
      const c = (tl >= L ? 8 : 0) | (tr >= L ? 4 : 0) | (br >= L ? 2 : 0) | (bl >= L ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const T = () => pH(i, j), B = () => pH(i, j + 1), Lf = () => pV(i, j), R = () => pV(i + 1, j);
      switch (c) {
        case 1: case 14: seg.push([Lf(), B()]); break;
        case 2: case 13: seg.push([B(), R()]); break;
        case 3: case 12: seg.push([Lf(), R()]); break;
        case 4: case 11: seg.push([T(), R()]); break;
        case 6: case 9: seg.push([T(), B()]); break;
        case 7: case 8: seg.push([Lf(), T()]); break;
        case 5: case 10: {
          const mitt = (tl + tr + bl + br) / 4 >= L;
          // 5 = tr+bl höga, 10 = tl+br höga
          if ((c === 5) === mitt) { seg.push([Lf(), T()]); seg.push([B(), R()]); }
          else { seg.push([T(), R()]); seg.push([Lf(), B()]); }
          break;
        }
      }
    }
    // Foga ihop segment till linjer
    const vid = new Map();
    seg.forEach((sg, k) => sg.forEach(p => { (vid.get(p) || vid.set(p, []).get(p)).push(k); }));
    const anv = new Uint8Array(seg.length);
    const linjer = [];
    const folj = (start, fran) => {
      const kedja = [];
      let p = fran, k = start;
      while (true) {
        anv[k] = 1;
        const [a, b] = seg[k];
        const nasta = a === p ? b : a;
        kedja.push(nasta);
        const ff = (vid.get(nasta) || []).find(q => !anv[q]);
        if (ff === undefined) break;
        p = nasta; k = ff;
      }
      return kedja;
    };
    // Öppna linjer börjar i ändpunkter (endast ett segment), sedan slutna
    const ordning = [...vid.entries()].filter(([, ks]) => ks.length === 1).map(([p, ks]) => [p, ks[0]]);
    for (const [p, k] of ordning) if (!anv[k]) linjer.push({ pts: [p, ...folj(k, p)], sluten: false });
    for (let k = 0; k < seg.length; k++) if (!anv[k]) {
      const pts = [seg[k][0], ...folj(k, seg[k][0])];
      linjer.push({ pts, sluten: pts[0] === pts[pts.length - 1] });
    }
    return linjer.map(l => ({ sluten: l.sluten, pts: l.pts.map(id => punkt.get(id)) }));
  }

  function forenkla(pts, tol) {
    if (pts.length < 3 || !tol) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      const [x1, y1] = pts[a], [x2, y2] = pts[b];
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
      let maxd = 0, idx = -1;
      for (let i = a + 1; i < b; i++) {
        const [x, y] = pts[i];
        const d = len ? Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / len : Math.hypot(x - x1, y - y1);
        if (d > maxd) { maxd = d; idx = i; }
      }
      if (maxd > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }

  function skapaKurvor(g, intervall, tol) {
    let lo = Infinity, hi = -Infinity;
    for (const v of g.z) if (v === v) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (lo === Infinity) return { kurvor: [], lo: NaN, hi: NaN };
    const kurvor = [];
    for (let k = Math.ceil(lo / intervall); k * intervall <= hi; k++) {
      const L = Math.round(k * intervall * 1000) / 1000;
      for (const l of kurvorForNiva(g, L)) {
        let pts = l.pts;
        if (l.sluten) pts = pts.slice(0, -1);
        pts = forenkla(pts, tol);
        if (pts.length >= 2) kurvor.push({ h: L, lager: kurvlager(L), sluten: l.sluten, pts });
      }
    }
    return { kurvor, lo, hi };
  }

  // ------------------------------------------------------------------
  // Filer
  // ------------------------------------------------------------------
  const LAGERFARG = {
    HOJDKURVA_0_25M: 9, HOJDKURVA_0_5M: 8, HOJDKURVA_1M: 7,
    HOJDKURVA_5M: 5, HOJDKURVA_10M: 1, UTSNITT: 3,
  };

  // ------------------------------------------------------------------
  // Lokala koordinater: förskjutning till nollpunkten och valfri vridning
  // ------------------------------------------------------------------
  /** Vridning i grader medurs för filer med lokal nollpunkt. Sätts av appen före export. */
  const lokal = { vrid: 0 };
  /** (x, y) i zonen → lokala (x', y'). dx = dy = 0 betyder SWEREF-fil: ingen förskjutning och ingen vridning. */
  function tillLokal(dx, dy) {
    if (!dx && !dy) return (x, y) => [x, y];
    const v = lokal.vrid * Math.PI / 180, c = Math.cos(v), s = Math.sin(v);
    if (!v) return (x, y) => [x - dx, y - dy];
    return (x, y) => { const a = x - dx, b = y - dy; return [a * c + b * s, -a * s + b * c]; };
  }
  /** Omslutande ruta för en rektangel efter omvandling. */
  function lokalRuta(r, t) {
    const k = [[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax]].map(([x, y]) => t(x, y));
    return { xmin: Math.min(...k.map(p => p[0])), ymin: Math.min(...k.map(p => p[1])), xmax: Math.max(...k.map(p => p[0])), ymax: Math.max(...k.map(p => p[1])) };
  }
  /** Nordpilar (zonkoordinater) till vänster om utsnittet: rutnätsnord och sann nord. konv = rutnätsnord öster om sann nord (°). */
  function nordpilar(r, konv) {
    const L = Math.max(10, Math.min(30, Math.round((r.ymax - r.ymin) * 0.12))), bx = r.xmin - L * 0.6, by = r.ymin;
    const pil = (vx, vy) => {
      const tx = bx + vx * L, ty = by + vy * L, h = L * 0.18, a = 25 * Math.PI / 180;
      const ux = -vx, uy = -vy;
      const v1 = [tx + h * (ux * Math.cos(a) - uy * Math.sin(a)), ty + h * (ux * Math.sin(a) + uy * Math.cos(a))];
      const v2 = [tx + h * (ux * Math.cos(-a) - uy * Math.sin(-a)), ty + h * (ux * Math.sin(-a) + uy * Math.cos(-a))];
      return { linjer: [[[bx, by], [tx, ty]], [v1, [tx, ty], v2]], topp: [tx, ty] };
    };
    const g = konv * Math.PI / 180;
    return { rutnat: pil(0, 1), sann: pil(-Math.sin(g), Math.cos(g)), L };
  }

  /** DXF R12 med 2D-polylinjer på rätt höjd (elevation), ett lager per kurvnivå. konv ger nordpilar. */
  function dxf(kurvor, r, dx, dy, dz = 0, konv = null) {
    const t = tillLokal(dx, dy), ext = lokalRuta(r, t);
    const o = [];
    const g = (k, v) => { o.push(String(k), String(v)); };
    const f = v => v.toFixed(3);
    const lagerNamn = [...new Set(kurvor.map(k => k.lager))];
    lagerNamn.sort((a, b) => Object.keys(LAGERFARG).indexOf(a) - Object.keys(LAGERFARG).indexOf(b));
    lagerNamn.push('UTSNITT');
    if (konv != null) lagerNamn.push('NORR_RUTNAT', 'NORR_SANN');

    g(0, 'SECTION'); g(2, 'HEADER');
    g(9, '$ACADVER'); g(1, 'AC1009');
    g(9, '$INSUNITS'); g(70, 6);
    g(9, '$EXTMIN'); g(10, f(ext.xmin)); g(20, f(ext.ymin)); g(30, 0);
    g(9, '$EXTMAX'); g(10, f(ext.xmax)); g(20, f(ext.ymax)); g(30, 0);
    g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES');
    g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 1);
    g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, 0);
    g(0, 'ENDTAB');
    g(0, 'TABLE'); g(2, 'LAYER'); g(70, lagerNamn.length);
    for (const n of lagerNamn) { g(0, 'LAYER'); g(2, n); g(70, 0); g(62, LAGERFARG[n] || (n === 'NORR_SANN' ? 30 : 7)); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB');
    g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const pl = (lager, pts, z, sluten) => {
      g(0, 'POLYLINE'); g(8, lager); g(66, 1); g(10, 0); g(20, 0); g(30, f(z)); g(70, sluten ? 1 : 0);
      for (const [x0, y0] of pts) { const [x, y] = t(x0, y0); g(0, 'VERTEX'); g(8, lager); g(10, f(x)); g(20, f(y)); g(30, f(z)); }
      g(0, 'SEQEND'); g(8, lager);
    };
    const text = (lager, x0, y0, h, s) => { const [x, y] = t(x0, y0); g(0, 'TEXT'); g(8, lager); g(10, f(x)); g(20, f(y)); g(30, 0); g(40, f(h)); g(1, s); };
    for (const k of kurvor) pl(k.lager, k.pts, k.h - dz, k.sluten);
    pl('UTSNITT', [[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax]], 0, true);
    if (konv != null) {
      const np = nordpilar(r, konv);
      np.rutnat.linjer.forEach(l => pl('NORR_RUTNAT', l, 0, false));
      np.sann.linjer.forEach(l => pl('NORR_SANN', l, 0, false));
      text('NORR_RUTNAT', np.rutnat.topp[0] + np.L * 0.06, np.rutnat.topp[1] + np.L * 0.06, np.L * 0.09, 'N RUTNAT');
      text('NORR_SANN', np.sann.topp[0] - np.L * 0.45, np.sann.topp[1] + np.L * 0.06, np.L * 0.09, 'SANN N');
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return o.join('\r\n') + '\r\n';
  }

  /** Punktfil. sep = ' ' ger XYZ (Archicad), ',' ger CSV (Revit). Ingen rubrikrad. */
  function xyz(g, dx, dy, dz = 0, sep = ' ') {
    const rad = [], t = tillLokal(dx, dy);
    for (let j = 0; j < g.H; j++) for (let i = 0; i < g.W; i++) {
      const v = g.z[j * g.W + i];
      if (v === v) { const [x, y] = t(g.x0 + i * g.s, g.y1 - j * g.s); rad.push([x.toFixed(3), y.toFixed(3), (v - dz).toFixed(3)].join(sep)); }
    }
    return { text: rad.join('\r\n') + '\r\n', antal: rad.length };
  }

  // ------------------------------------------------------------------
  // Hela kedjan
  // ------------------------------------------------------------------
  /**
   * opt: { utsnitt:{xmin,ymin,xmax,ymax} (avrundat, i zonen), epsg, auth, namn,
   *        intervall, meshavstand, utjamning, tolerans, kommun, logg, framsteg, urlFor,
   *        nollpunkt: {x, y, z} (valfri, annars sydvästra hörnet och Z = 0),
   *        format: {dxf, xyz, csv} (vilka filer som skapas, standard alla) }
   */
  async function skapaUnderlag(opt) {
    registreraZoner();
    const logg = opt.logg || (() => {}), steg = opt.framsteg || (() => {});
    const r = opt.utsnitt, epsg = Number(opt.epsg), z = zon(epsg);
    const namn = (opt.namn || 'terrang').replace(/[^\wåäöÅÄÖ.-]+/g, '_');
    const intervall = opt.intervall || 0.5, mesh = opt.meshavstand || 2;

    // Område i SWEREF 99 TM, med marginal för interpolation och utjämning
    const tillTM = epsg === 3006 ? (p => p) : omvandlare(epsg, 3006).forward;
    const tm = kantlinje(r).map(tillTM);
    const marg = 3 + (opt.utjamning || 0) * 4;
    const tmBox = {
      xmin: Math.min(...tm.map(p => p[0])) - marg, xmax: Math.max(...tm.map(p => p[0])) + marg,
      ymin: Math.min(...tm.map(p => p[1])) - marg, ymax: Math.max(...tm.map(p => p[1])) + marg,
    };
    steg(5, 'Hämtar höjddata från Lantmäteriet');
    const m = opt.mosaik || await lasHojder(tmBox, opt.auth, { logg, urlFor: opt.urlFor });
    if (!m.rutor.length) throw new Error('Det finns ingen höjddata för det här området.');

    steg(45, 'Räknar fram höjdkurvor');
    const g1 = rutnat(m, r, 1, epsg);
    let giltiga = 0;
    for (const v of g1.z) if (v === v) giltiga++;
    if (!giltiga) throw new Error('Utsnittet innehåller ingen höjddata.');
    const tackning = giltiga / g1.z.length;
    if (tackning < 0.999) logg(`OBS: höjddata saknas för ${(100 * (1 - tackning)).toFixed(1)} % av utsnittet (t.ex. vatten eller kant mot havet).`);
    const { kurvor, lo, hi } = skapaKurvor(utjamna(g1, opt.utjamning || 0), intervall, opt.tolerans ?? 0.05);

    steg(75, 'Skapar mesh-punkter');
    const gm = mesh === 1 ? g1 : rutnat(m, r, mesh, epsg);

    steg(85, 'Skriver filer');
    const np = opt.nollpunkt || {};
    const egen = isFinite(np.x) && isFinite(np.y);
    const X0 = egen ? Number(np.x) : r.xmin, Y0 = egen ? Number(np.y) : r.ymin;
    const Z0 = isFinite(np.z) ? Number(np.z) : 0;
    const fmt = Object.assign({ dxf: true, xyz: true, csv: true }, opt.format);
    const filer = {};
    if (fmt.dxf) {
      filer[`${namn}_kurvor_lokal.dxf`] = dxf(kurvor, r, X0, Y0, Z0, opt.konvergens);
      filer[`${namn}_kurvor_sweref.dxf`] = dxf(kurvor, r, 0, 0, 0, opt.konvergens);
    }
    const punktLok = xyz(gm, X0, Y0, Z0);
    if (fmt.xyz) {
      filer[`${namn}_mesh_lokal.xyz`] = punktLok.text;
      filer[`${namn}_mesh_sweref.xyz`] = xyz(gm, 0, 0).text;
    }
    if (fmt.csv) {
      filer[`${namn}_punkter_lokal.csv`] = xyz(gm, X0, Y0, Z0, ',').text;
      filer[`${namn}_punkter_sweref.csv`] = xyz(gm, 0, 0, 0, ',').text;
    }
    const fz = v => v.toFixed(3).replace(/\.?0+$/, '');
    const antalPer = {};
    kurvor.forEach(k => { antalPer[k.lager] = (antalPer[k.lager] || 0) + 1; });
    const nu = new Date();
    const pad = v => String(v).padStart(2, '0');
    filer[`${namn}_info.txt`] = [
      `Terrängunderlag – ${namn}`,
      opt.projekt ? `Projekt eller fastighet: ${opt.projekt}` : null,
      `Skapat ${nu.getFullYear()}-${pad(nu.getMonth() + 1)}-${pad(nu.getDate())} ${pad(nu.getHours())}:${pad(nu.getMinutes())}`,
      '',
      `Koordinatsystem i plan: ${z.namn} (EPSG:${epsg})` + (opt.kommun ? ` – föreslaget för ${opt.kommun}` : ''),
      'Höjdsystem: RH 2000',
      '',
      'PLATSEN I DECIMALGRADER (WGS 84, latitud, longitud)',
      `  Utsnittets mitt: ${latLonText(epsg, (r.xmin + r.xmax) / 2, (r.ymin + r.ymax) / 2)}`,
      `  Nollpunkten:     ${latLonText(epsg, X0, Y0)}`,
      '  Ange mitten som projektets plats i Archicad eller Revit, så blir solen rätt.',
      '',
      `LOKAL NOLLPUNKT (0,0,0 i filerna med _lokal i namnet) – ${egen ? 'egen' : 'utsnittets sydvästra hörn'}`,
      `  X0 (öst)  = ${X0.toFixed(3)}`,
      `  Y0 (norr) = ${Y0.toFixed(3)}`,
      Z0 ? `  Z0 (höjd) = ${Z0.toFixed(3)}  (lokal höjd = RH 2000 − ${fz(Z0)})` : '  Z0 = 0: höjderna är oförändrade i RH 2000.',
      '  Ange gärna punkten som Survey Point i Archicad eller Revit.',
      '  Filerna med _sweref i namnet ligger i verkliga koordinater och RH 2000.',
      ...(lokal.vrid ? [`  De lokala filerna är vridna ${String(Math.round(lokal.vrid * 1000) / 1000).replace('.', ',')}° medurs runt nollpunkten` +
        (opt.vridText ? ` (${opt.vridText}).` : '.'), '  Vrid tillbaka lika mycket moturs för att återgå till koordinatsystemets riktning.'] : []),
      ...(opt.konvergens != null ? ['', 'NORR',
        `  Rutnätets nord pekar ${String(Math.abs(opt.konvergens).toFixed(2)).replace('.', ',')}° ${opt.konvergens >= 0 ? 'öster' : 'väster'} om sann nord här.`,
        `  Sann nord ligger alltså ${String(Math.abs(opt.konvergens).toFixed(2)).replace('.', ',')}° ${opt.konvergens >= 0 ? 'väster' : 'öster'} om ritningens Y-axel (i filer som inte är vridna).`,
        '  I höjdkurvornas DXF visar lagret NORR_RUTNAT rutnätets nord och NORR_SANN sann nord, till vänster om utsnittet.',
        '  Använd NORR_SANN som referens när sann nord ställs in i Revit eller Archicad.'] : []),
      '',
      `Utsnitt: x ${r.xmin}–${r.xmax}, y ${r.ymin}–${r.ymax}`,
      `Storlek: ${r.xmax - r.xmin} × ${r.ymax - r.ymin} m`,
      `Markhöjder: ${lo.toFixed(2)}–${hi.toFixed(2)} m`,
      '',
      `Höjdkurvor var ${String(intervall).replace('.', ',')} m. DXF-lager:`,
      ...Object.keys(LAGERFARG).filter(l => antalPer[l]).map(l => `  ${l}: ${antalPer[l]} linjer`),
      '  UTSNITT: ram runt utsnittet (Z = 0)',
      `  Utjämning: ${['ingen', 'lätt', 'kraftig'][opt.utjamning || 0]}`,
      `Punkter: ${punktLok.antal} st var ${mesh} m. Kolumner X Y Z, ingen rubrikrad.`,
      '  .xyz: mellanslag mellan kolumnerna (Archicad)',
      '  .csv: komma mellan kolumnerna, punkt som decimaltecken (Revit)',
      '',
      'Källa: Lantmäteriet, Markhöjdmodell Nedladdning (grid 1 m), licens CC BY 4.0',
      `Rutor: ${m.rutor.join(', ')}`,
      '',
    ].filter(l => l !== null).join('\r\n');
    steg(100, 'Klart');
    return { filer, kurvor, lo, hi, X0, Y0, Z0, egen, antalPunkter: punktLok.antal, rutor: m.rutor, tackning };
  }

  return {
    ZONER, zon, registreraZoner, narmasteZon, omvandlare, tolkaZon, latLonText, avrunda, kantlinje, rutor,
    dlUrl, basicAuth, InloggningsFel, provaInloggning, lasHojderGrov, sampla, kurvorForNiva, forenkla, lasHojder, rutnat, utjamna, skapaKurvor,
    kurvlager, dxf, xyz, skapaUnderlag, lokal, tillLokal, lokalRuta, nordpilar,
  };
}));
