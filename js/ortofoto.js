/*
 * Ortofoto Nedladdning – sök bilder i Lantmäteriets STAC (stac-bild), välj den
 * senaste färgbilden som täcker utsnittet och läs bara utsnittet ur
 * molnoptimerade GeoTIFF-filer (COG) med Range, från lämplig översiktsnivå.
 * Bilden ritas om till vald SWEREF 99-zon med pixlarna parallella med zonens axlar.
 *
 * Kräver globala GeoTIFF (geotiff.js), proj4 och Terrang. Fungerar i webbläsare och Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Ortofoto = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const T = () => (typeof Terrang !== 'undefined' ? Terrang : globalThis.Terrang);
  const G = () => (typeof GeoTIFF !== 'undefined' ? GeoTIFF : globalThis.GeoTIFF);
  const KONF = () => (typeof self !== 'undefined' && self.TERRANG_KONFIG) || {};
  const STAC_BAS = () => (typeof self !== 'undefined' && self.TERRANG_STAC_BAS) || 'https://api.lantmateriet.se';

  /** Spektraltyper som ger en vanlig färgbild (band 1–3 = röd, grön, blå). */
  const FARG = ['rgbi', 'rgb'];
  /** Största bilden som skapas. iPhone klarar inte större canvas än 16,7 Mpx. */
  const MAX_PX = 16e6, MAX_SIDA = 8192;
  const STEG = [0.25, 0.5, 1, 2, 4, 8];

  // ------------------------------------------------------------------
  // STAC (öppen katalog). Om webbläsaren stoppar anropet används stac.php.
  // ------------------------------------------------------------------
  async function hamtaJson(sokvag) {
    try {
      const r = await fetch(STAC_BAS() + sokvag);
      if (r.ok) return await r.json();
      throw new Error(`STAC svarade ${r.status}`);
    } catch (e) {
      const proxy = KONF().stacProxy;
      if (!proxy) throw new Error('Kunde inte nå Lantmäteriets bildkatalog (STAC). Lägg stac.php på webbhotellet och ange stacProxy i config.js.');
      const r = await fetch(proxy + '?p=' + encodeURIComponent(sokvag));
      if (!r.ok) throw new Error(`Bildkatalogen svarade ${r.status} via stac.php.`);
      return r.json();
    }
  }

  /** Ett STAC-item som enkel post. */
  function tolkaItem(f) {
    const p = f.properties || {}, a = (f.assets || {}).data || {};
    const kod = String(p['proj:code'] || a['proj:code'] || (p['proj:epsg'] ? 'EPSG:' + p['proj:epsg'] : ''));
    const datum = p.datetime || p.start_datetime || '';
    return {
      id: f.id, samling: f.collection || '', datum, ar: Number(p.flygar) || Number(String(datum).slice(0, 4)) || 0,
      spektral: String(p.spektraltyp || '').toLowerCase(), upplosning: Number(p.upplosning) || null,
      epsg: Number((kod.match(/(\d+)$/) || [])[1]) || null,
      bbox: p['proj:bbox'] || a['proj:bbox'] || null, href: a.href || null,
    };
  }
  function tolka(fc) { return ((fc && fc.features) || []).map(tolkaItem); }

  /** Alla bilder (alla år och typer) som berör tmBox (SWEREF 99 TM). */
  async function sok(tmBox) {
    const p = T().omvandlare(3006, 4326).forward;
    const h = [[tmBox.xmin, tmBox.ymin], [tmBox.xmax, tmBox.ymin], [tmBox.xmax, tmBox.ymax], [tmBox.xmin, tmBox.ymax]].map(p);
    const bbox = [Math.min(...h.map(q => q[0])), Math.min(...h.map(q => q[1])), Math.max(...h.map(q => q[0])), Math.max(...h.map(q => q[1]))]
      .map(v => v.toFixed(6)).join(',');
    let sokvag = `/stac-bild/v1/search?bbox=${bbox}&limit=100`;
    const ut = [], sedda = new Set();
    for (let sida = 0; sida < 8 && sokvag; sida++) {
      const j = await hamtaJson(sokvag);
      for (const it of tolka(j)) if (!sedda.has(it.id)) { sedda.add(it.id); ut.push(it); }
      const nasta = (j.links || []).find(l => l.rel === 'next' && (!l.method || l.method === 'GET'));
      sokvag = nasta ? nasta.href.replace(/^https?:\/\/[^/]+/, '') : null;
    }
    return ut;
  }

  const snitt = (b, r) => Math.max(0, Math.min(b[2], r.xmax) - Math.max(b[0], r.xmin)) *
                          Math.max(0, Math.min(b[3], r.ymax) - Math.max(b[1], r.ymin));

  /**
   * Väljer bilder: färgbilder i SWEREF 99 TM, grupperade per flygår, typ och upplösning.
   * Helt täckande grupper först, sedan senaste året, sedan finast upplösning.
   * Returnerar { valda, tackning, ar, datum, spektral, upplosning } eller null.
   */
  function valj(items, tmBox) {
    const yta = (tmBox.xmax - tmBox.xmin) * (tmBox.ymax - tmBox.ymin);
    const grupper = {};
    for (const it of items) {
      if (!it.href || !it.bbox || it.epsg !== 3006 || !FARG.includes(it.spektral)) continue;
      if (!(snitt(it.bbox, tmBox) > 0)) continue;
      const k = `${it.ar}|${it.spektral}|${it.upplosning}`;
      (grupper[k] = grupper[k] || []).push(it);
    }
    const kand = Object.values(grupper).map(g => {
      const tackning = Math.min(1, g.reduce((a, it) => a + snitt(it.bbox, tmBox), 0) / yta);
      const datum = g.map(it => String(it.datum).slice(0, 10)).sort().pop();
      return { valda: g, tackning, ar: g[0].ar, datum, spektral: g[0].spektral, upplosning: g[0].upplosning };
    });
    kand.sort((a, b) => (b.tackning > 0.999) - (a.tackning > 0.999) || b.ar - a.ar || (a.upplosning || 9) - (b.upplosning || 9) ||
      (a.spektral === 'rgbi' ? -1 : 1) - (b.spektral === 'rgbi' ? -1 : 1) || b.tackning - a.tackning);
    return kand[0] || null;
  }

  /** Bildens pixelstorlek: källans upplösning om bilden ryms, annars nästa jämna steg. */
  function upplosning(r, kallaS, maxPx = MAX_PX, maxSida = MAX_SIDA) {
    const b = r.xmax - r.xmin, h = r.ymax - r.ymin;
    const steg = [kallaS || 0.25, ...STEG].filter(s => s >= (kallaS || 0.25) - 1e-9);
    for (const s of steg) {
      const W = Math.ceil(b / s - 1e-6), H = Math.ceil(h / s - 1e-6);
      if (W * H <= maxPx && Math.max(W, H) <= maxSida) return s;
    }
    return steg[steg.length - 1];
  }

  /** Målbildens rutnät över utsnittet r: (x0, y1) = övre vänstra hörnet (pixelkant). */
  function rutnat(r, s) {
    return { x0: r.xmin, y1: r.ymax, s, W: Math.ceil((r.xmax - r.xmin) / s - 1e-6), H: Math.ceil((r.ymax - r.ymin) / s - 1e-6) };
  }

  // ------------------------------------------------------------------
  // Läsning
  // ------------------------------------------------------------------
  class InloggningsFel extends Error {}

  /** Kontrollerar åtkomsten till en bildfil med en liten Range-förfrågan. */
  async function prova(url, auth) {
    let r;
    try { r = await fetch(url, { headers: { Authorization: auth, Range: 'bytes=0-15' } }); } catch (e) {
      throw new Error('Kunde inte nå Lantmäteriets server för ortofoto (nätverket, eller servern tillåter inte anropet från webbläsaren).');
    }
    if (r.status === 401 || r.status === 403)
      throw new (T().InloggningsFel || InloggningsFel)('Lantmäteriet nekade åtkomst till ortofotot. Kontrollera att Ortofoto Nedladdning är beställd för kontot.');
    if (r.status === 404) return false;
    if (r.status !== 206 && r.status !== 200) throw new Error(`Lantmäteriet svarade ${r.status} för ortofotot.`);
    return true;
  }

  /** Omvandlare zon → TM för ett rutnät, räknad exakt var 32:a pixel och interpolerad däremellan. */
  function tillTMNat(mal, epsg) {
    const f = epsg === 3006 ? (p => p) : T().omvandlare(epsg, 3006).forward;
    const K = 32, nx = Math.ceil(mal.W / K) + 1, ny = Math.ceil(mal.H / K) + 1;
    const E = new Float64Array(nx * ny), N = new Float64Array(nx * ny);
    for (let b = 0; b < ny; b++) for (let a = 0; a < nx; a++) {
      const [e, n] = f([mal.x0 + a * K * mal.s, mal.y1 - b * K * mal.s]);
      E[b * nx + a] = e; N[b * nx + a] = n;
    }
    /** Pixelposition (i, j) i målbilden (i = 0 vänster kant) → [E, N]. */
    return (i, j) => {
      const fa = Math.min(nx - 1.000001, Math.max(0, i / K)), fb = Math.min(ny - 1.000001, Math.max(0, j / K));
      const a = Math.floor(fa), b = Math.floor(fb), ta = fa - a, tb = fb - b, q = b * nx + a;
      const l = (A) => (A[q] * (1 - ta) + A[q + 1] * ta) * (1 - tb) + (A[q + nx] * (1 - ta) + A[q + nx + 1] * ta) * tb;
      return [l(E), l(N)];
    };
  }

  /** Målbildens yta i TM, med marginal. */
  function tmRuta(mal, tillTM, marg) {
    const h = [[0, 0], [mal.W, 0], [0, mal.H], [mal.W, mal.H], [mal.W / 2, 0], [mal.W / 2, mal.H], [0, mal.H / 2], [mal.W, mal.H / 2]].map(([i, j]) => tillTM(i, j));
    return { xmin: Math.min(...h.map(p => p[0])) - marg, ymin: Math.min(...h.map(p => p[1])) - marg,
             xmax: Math.max(...h.map(p => p[0])) + marg, ymax: Math.max(...h.map(p => p[1])) + marg };
  }

  /**
   * Läser en bildfils del inom tm (TM) från översiktsnivån som passar pixelstorleken s.
   * Returnerar { E0, N1, rx, ry, w, h, rgb (3 byte per pixel) } eller null.
   */
  async function lasRuta(tiff, tm, s) {
    const img0 = await tiff.getImage(0);
    const [ox, oy] = img0.getOrigin(), [rx0, ry0] = img0.getResolution();
    const W0 = img0.getWidth(), H0 = img0.getHeight(), sy0 = Math.abs(ry0);
    const kant = { xmin: ox, xmax: ox + W0 * rx0, ymin: oy - H0 * sy0, ymax: oy };
    const ix0 = Math.max(tm.xmin, kant.xmin), ix1 = Math.min(tm.xmax, kant.xmax);
    const iy0 = Math.max(tm.ymin, kant.ymin), iy1 = Math.min(tm.ymax, kant.ymax);
    if (ix1 <= ix0 || iy1 <= iy0) return null;
    // översiktsnivå: den grövsta som fortfarande är minst lika fin som s
    const n = await tiff.getImageCount();
    let img = img0, fx = 1, fy = 1;
    for (let k = 1; k < n; k++) {
      const im = await tiff.getImage(k);
      const st = im.fileDirectory.NewSubfileType;
      if (st && (st & 4)) continue;                            // mask
      const gx = W0 / im.getWidth(), gy = H0 / im.getHeight();
      if (rx0 * gx <= s * 1.001 && gx > fx) { img = im; fx = gx; fy = gy; }
    }
    const rx = rx0 * fx, ry = sy0 * fy, Wn = img.getWidth(), Hn = img.getHeight();
    const c0 = Math.max(0, Math.floor((ix0 - ox) / rx)), c1 = Math.min(Wn, Math.ceil((ix1 - ox) / rx));
    const r0 = Math.max(0, Math.floor((oy - iy1) / ry)), r1 = Math.min(Hn, Math.ceil((oy - iy0) / ry));
    if (c1 <= c0 || r1 <= r0) return null;
    // läs med högst ungefär 1,4 pixlar per målpixel, så att minnet räcker även när nivån är mycket finare
    const rs = Math.max(rx, s / 1.4);
    const w = Math.max(1, Math.min(c1 - c0, Math.round((c1 - c0) * rx / rs))), h = Math.max(1, Math.min(r1 - r0, Math.round((r1 - r0) * ry / rs)));
    const fonster = [c0, r0, c1, r1];
    const fd = img.fileDirectory, spp = img.getSamplesPerPixel();
    const foto = fd.PhotometricInterpretation;
    let data;
    if (foto === 6 || foto === 3 || foto === 5) {
      data = await img.readRGB({ window: fonster, width: w, height: h, interleave: true, resampleMethod: 'bilinear' });
    } else {
      data = await img.readRasters({ window: fonster, width: w, height: h, samples: spp >= 3 ? [0, 1, 2] : [0, 0, 0], interleave: true, resampleMethod: 'bilinear' });
    }
    const bit = img.getBitsPerSample ? img.getBitsPerSample() : 8;
    let rgb = data;
    if (bit > 8 || !(data instanceof Uint8Array || data instanceof Uint8ClampedArray)) {
      const skift = bit > 8 ? bit - 8 : 0;
      rgb = new Uint8Array(data.length);
      for (let q = 0; q < data.length; q++) rgb[q] = Math.max(0, Math.min(255, data[q] >> skift));
    }
    return { E0: ox + c0 * rx, N1: oy - r0 * ry, rx: (c1 - c0) * rx / w, ry: (r1 - r0) * ry / h, w, h, rgb, jpeg: fd.Compression === 7 };
  }

  /**
   * Läser bilderna i valda och ritar om dem till målrutnätet mal = { x0, y1, s, W, H } i zonen epsg.
   * opt.oppna(href) → GeoTIFF (för tester); annars hämtas filen med Range och Basic-inloggning.
   * Returnerar { rgba (Uint8ClampedArray W×H×4), W, H, tackt (andel pixlar med bild), rutor }.
   */
  async function las(valda, mal, epsg, auth, opt = {}) {
    const framsteg = opt.framsteg || (() => {});
    const tillTM = tillTMNat(mal, epsg);
    const tm = tmRuta(mal, tillTM, 2 * mal.s);
    const delar = [], rutor = [];
    let k = 0;
    for (const it of valda) {
      k++;
      if (!(snitt(it.bbox, tm) > 0)) continue;
      let tiff;
      if (opt.oppna) tiff = await opt.oppna(it.href);
      else {
        const url = T().dlUrl(it.href);
        if (!(await prova(url, auth))) continue;
        tiff = await G().fromUrl(url, { headers: { Authorization: auth }, allowFullFile: false });
      }
      const d = await lasRuta(tiff, tm, mal.s);
      if (d) { delar.push(d); rutor.push(it.id); }
      framsteg(0.8 * k / valda.length);
    }
    const ut = omrita(delar, mal, tillTM);
    framsteg(1);
    return Object.assign(ut, { rutor });
  }

  /** Bilinjär omritning av de lästa delarna till målrutnätet. (0, 0, 0) räknas som tomt. */
  function omrita(delar, mal, tillTM) {
    const { W, H } = mal, rgba = new Uint8ClampedArray(W * H * 4);
    let med = 0, d = null;
    const inne = (x, E, N) => E >= x.E0 && E < x.E0 + x.w * x.rx && N <= x.N1 && N > x.N1 - x.h * x.ry;
    for (let j = 0; j < H; j++) {
      // radens början och slut i TM; däremellan linjärt (felet är långt under en millimeter på en rad)
      const [Ea, Na] = tillTM(0.5, j + 0.5), [Eb, Nb] = tillTM(W - 0.5, j + 0.5);
      const dE = W > 1 ? (Eb - Ea) / (W - 1) : 0, dN = W > 1 ? (Nb - Na) / (W - 1) : 0;
      for (let i = 0; i < W; i++) {
        const E = Ea + dE * i, N = Na + dN * i;
        if (!d || !inne(d, E, N)) { d = null; for (const x of delar) if (inne(x, E, N)) { d = x; break; } if (!d) continue; }
        const rgb = d.rgb, w = d.w, g = d.jpeg ? 2 : 0;
        const fx = (E - d.E0) / d.rx - 0.5, fy = (d.N1 - N) / d.ry - 0.5;
        const a = Math.floor(fx), b = Math.floor(fy), ut = (j * W + i) * 4;
        let r = 0, gr = 0, bl = 0, vikt = 0;
        if (a >= 0 && b >= 0 && a < w - 1 && b < d.h - 1) {
          const tx = fx - a, ty = fy - b;
          let q = (b * w + a) * 3, v = (1 - tx) * (1 - ty);
          if (v > 0 && (rgb[q] > g || rgb[q + 1] > g || rgb[q + 2] > g)) { r += rgb[q] * v; gr += rgb[q + 1] * v; bl += rgb[q + 2] * v; vikt += v; }
          q += 3; v = tx * (1 - ty);
          if (v > 0 && (rgb[q] > g || rgb[q + 1] > g || rgb[q + 2] > g)) { r += rgb[q] * v; gr += rgb[q + 1] * v; bl += rgb[q + 2] * v; vikt += v; }
          q += w * 3; v = tx * ty;
          if (v > 0 && (rgb[q] > g || rgb[q + 1] > g || rgb[q + 2] > g)) { r += rgb[q] * v; gr += rgb[q + 1] * v; bl += rgb[q + 2] * v; vikt += v; }
          q -= 3; v = (1 - tx) * ty;
          if (v > 0 && (rgb[q] > g || rgb[q + 1] > g || rgb[q + 2] > g)) { r += rgb[q] * v; gr += rgb[q + 1] * v; bl += rgb[q + 2] * v; vikt += v; }
        }
        if (vikt < 0.5) {     // vid kanten eller mot tomma pixlar: närmaste pixel
          const q = (Math.min(d.h - 1, Math.max(0, Math.round(fy))) * w + Math.min(w - 1, Math.max(0, Math.round(fx)))) * 3;
          if (!(rgb[q] > g || rgb[q + 1] > g || rgb[q + 2] > g)) continue;
          r = rgb[q]; gr = rgb[q + 1]; bl = rgb[q + 2]; vikt = 1;
        }
        rgba[ut] = r / vikt; rgba[ut + 1] = gr / vikt; rgba[ut + 2] = bl / vikt; rgba[ut + 3] = 255;
        med++;
      }
    }
    return { rgba, W, H, tackt: W * H ? med / (W * H) : 0 };
  }

  /** Text om källan till info-filen och utskrifter. */
  function kallText(v) {
    const typ = v.spektral === 'rgbi' ? 'färg (RGBI, tre av fyra band)' : 'färg (RGB)';
    return `Ortofoto Nedladdning, ${typ}, flygår ${v.ar}${v.datum ? ` (fotograferat ${v.datum})` : ''}, ${String(v.upplosning).replace('.', ',')} m upplösning.`;
  }

  return { sok, tolka, valj, upplosning, rutnat, las, lasRuta, omrita, tillTMNat, kallText, FARG, MAX_PX, InloggningsFel };
}));
