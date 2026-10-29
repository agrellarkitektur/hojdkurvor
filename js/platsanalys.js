/*
 * Platsanalys ur höjddatan: höjdpunkter, lutning, skyfall (lågpunkter och flödesvägar)
 * och skissade volymer (från cad-apa eller DXF) som påverkar skuggor och vatten.
 *
 * Rutnät (g) har samma form som Terrang.rutnat: { W, H, s, x0, y1, z } med noder på
 * utsnittets kanter, rad 0 i norr. Koordinater i zonens system (meter).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Platsanalys = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const RAD = Math.PI / 180;
  const T = () => (typeof Terrang !== 'undefined' ? Terrang : globalThis.Terrang);
  const A = () => (typeof Analys !== 'undefined' ? Analys : globalThis.Analys);
  const D = () => (typeof Dxf !== 'undefined' ? Dxf : globalThis.Dxf);

  // ------------------------------------------------------------------
  // Höjdpunkter
  // ------------------------------------------------------------------
  /** Markhöjd i ett rutnät med jämna koordinater (multiplar av steg) inom utsnittet. */
  function hojdpunkter(g, r, steg = 10) {
    const ut = [];
    const x0 = Math.ceil(r.xmin / steg) * steg, y0 = Math.ceil(r.ymin / steg) * steg;
    for (let y = y0; y <= r.ymax + 1e-6; y += steg) {
      for (let x = x0; x <= r.xmax + 1e-6; x += steg) {
        const z = A().nod(g, g.z, x, y);
        if (z === z) ut.push({ x, y, z });
      }
    }
    return ut;
  }
  const hojdText = (z, dz = 0) => {
    const v = z - dz;
    return (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2).replace('.', ',');
  };
  function dxfHojdpunkter(pts, r, dx, dy, dz) {
    const o = [];
    for (const p of pts) {
      o.push({ typ: 'punkt', lager: 'HOJDPUNKT', x: p.x, y: p.y, z: p.z });
      o.push({ typ: 'pl', lager: 'HOJDPUNKT', pts: [[p.x - 0.25, p.y], [p.x + 0.25, p.y]], z: p.z });
      o.push({ typ: 'pl', lager: 'HOJDPUNKT', pts: [[p.x, p.y - 0.25], [p.x, p.y + 0.25]], z: p.z });
      o.push({ typ: 'text', lager: 'HOJDPUNKT_TEXT', x: p.x + 0.4, y: p.y + 0.3, z: p.z, h: 0.8, text: hojdText(p.z, dz) });
    }
    o.push(ram(r));
    return D().skriv({ HOJDPUNKT: 1, HOJDPUNKT_TEXT: 1, UTSNITT: 3 }, o, { dx, dy, dz, ext: r });
  }
  const ram = r => ({ typ: 'pl', lager: 'UTSNITT', sluten: true, pts: [[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax]] });

  // ------------------------------------------------------------------
  // Lutning
  // ------------------------------------------------------------------
  /** Klasser efter tillgänglighet: 1:50 (2 %), 1:20 (5 %), 1:12 (8,3 %). */
  const LUTNING = [
    { max: 1 / 50, namn: 'Flackare än 1:50', kort: 'under 1:50', lager: 'LUTNING_UNDER_1_50', rgb: [185, 215, 160], aci: 3 },
    { max: 1 / 20, namn: '1:50–1:20', kort: '1:50–1:20', lager: 'LUTNING_1_50_1_20', rgb: [241, 215, 122], aci: 2 },
    { max: 1 / 12, namn: '1:20–1:12', kort: '1:20–1:12', lager: 'LUTNING_1_20_1_12', rgb: [237, 162, 90], aci: 30 },
    { max: Infinity, namn: 'Brantare än 1:12', kort: 'brantare än 1:12', lager: 'LUTNING_OVER_1_12', rgb: [200, 85, 61], aci: 1 },
  ];
  /**
   * Lutning i varje nod (centraldifferens över radie meter, så att enstaka ojämnheter
   * i markmodellen inte slår igenom). Returnerar klass 0–3 per nod och andelar inom r.
   */
  function lutning(g, r = null, radie = 1) {
    const { W, H, s, z } = g;
    const k = Math.max(1, Math.round(radie / s));
    const klass = new Uint8Array(W * H).fill(255), varde = new Float32Array(W * H).fill(NaN);
    const antal = [0, 0, 0, 0];
    let summa = 0;
    for (let j = 0; j < H; j++) {
      const ja = Math.max(0, j - k), jb = Math.min(H - 1, j + k);
      for (let i = 0; i < W; i++) {
        const ia = Math.max(0, i - k), ib = Math.min(W - 1, i + k);
        const zx = (z[j * W + ib] - z[j * W + ia]) / ((ib - ia) * s);
        const zy = (z[ja * W + i] - z[jb * W + i]) / ((jb - ja) * s);
        const l = Math.hypot(zx, zy);
        if (!(l === l)) continue;
        varde[j * W + i] = l;
        let c = 0;
        while (l > LUTNING[c].max) c++;
        klass[j * W + i] = c;
        const x = g.x0 + i * s, y = g.y1 - j * s;
        if (!r || (x >= r.xmin && x <= r.xmax && y >= r.ymin && y <= r.ymax)) { antal[c]++; summa++; }
      }
    }
    return { W, H, s, x0: g.x0, y1: g.y1, klass, varde, andel: antal.map(a => (summa ? a / summa : 0)) };
  }
  /** Färgad bild av lutningsklasserna (en pixel per nod). */
  function lutningCanvas(lt, alfa = 190) {
    const c = document.createElement('canvas'); c.width = lt.W; c.height = lt.H;
    const cx = c.getContext('2d'), img = cx.createImageData(lt.W, lt.H);
    for (let q = 0; q < lt.W * lt.H; q++) {
      const k = lt.klass[q];
      if (k === 255) continue;
      img.data.set([...LUTNING[k].rgb, alfa], q * 4);
    }
    cx.putImageData(img, 0, 0);
    return c;
  }
  /** Slutna konturer per klass (klass 1–3; resten är flackt). */
  function lutningKonturer(lt) {
    const ut = [];
    for (let c = 1; c < LUTNING.length; c++) {
      const m = new Uint8Array(lt.W * lt.H);
      for (let q = 0; q < m.length; q++) m[q] = lt.klass[q] === c ? 1 : 0;
      A().maskKonturer(lt, m, 0.4).forEach(l => ut.push({ klass: c, pts: l.pts }));
    }
    return ut;
  }
  function dxfLutning(konturer, r, dx, dy) {
    const lager = { UTSNITT: 3 };
    LUTNING.slice(1).forEach(k => { lager[k.lager] = k.aci; });
    const o = konturer.map(k => ({ typ: 'pl', lager: LUTNING[k.klass].lager, sluten: true, pts: k.pts }));
    o.push(ram(r));
    return D().skriv(lager, o, { dx, dy, ext: r });
  }

  // ------------------------------------------------------------------
  // Skyfall: lågpunkter (instängda områden) och flödesvägar
  // ------------------------------------------------------------------
  /** Binär min-hög för index sorterade på värde. */
  function Hog(n) {
    const idx = new Int32Array(n), val = new Float64Array(n);
    let len = 0;
    return {
      get size() { return len; },
      push(i, v) {
        let k = len++;
        while (k > 0) {
          const p = (k - 1) >> 1;
          if (val[p] <= v) break;
          idx[k] = idx[p]; val[k] = val[p]; k = p;
        }
        idx[k] = i; val[k] = v;
      },
      pop() {
        const top = idx[0], v = idx[--len], vv = val[len];
        let k = 0;
        for (;;) {
          let c = 2 * k + 1;
          if (c >= len) break;
          if (c + 1 < len && val[c + 1] < val[c]) c++;
          if (val[c] >= vv) break;
          idx[k] = idx[c]; val[k] = val[c]; k = c;
        }
        idx[k] = v; val[k] = vv;
        return top;
      },
    };
  }
  const GRANNAR = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  /**
   * Fyller sänkor med priority-flood (Barnes m.fl. 2014). Med eps > 0 får fyllda ytor
   * en svag lutning mot utloppet så att varje nod får en flödesriktning.
   * Returnerar fylld yta och ordningen noderna togs ut i (stigande höjd).
   */
  function fyll(z, W, H, eps) {
    const n = W * H, f = new Float32Array(n), stang = new Uint8Array(n), ordning = new Int32Array(n);
    const hog = Hog(n);
    let no = 0;
    for (let q = 0; q < n; q++) {
      const i = q % W, j = (q / W) | 0;
      if (!(z[q] === z[q])) { stang[q] = 1; f[q] = NaN; continue; }
      if (i === 0 || j === 0 || i === W - 1 || j === H - 1) { stang[q] = 1; f[q] = z[q]; hog.push(q, z[q]); }
    }
    while (hog.size) {
      const q = hog.pop();
      ordning[no++] = q;
      const i = q % W, j = (q / W) | 0;
      for (const [di, dj] of GRANNAR) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        const p = jj * W + ii;
        if (stang[p]) continue;
        stang[p] = 1;
        if (!(z[p] === z[p])) { f[p] = NaN; continue; }
        f[p] = Math.max(z[p], f[q] + eps);
        hog.push(p, f[p]);
      }
    }
    return { f, ordning: ordning.subarray(0, no) };
  }
  /**
   * Skyfallsanalys på ett rutnät. r = utsnittet (bara lågpunkter med sin djupaste
   * punkt inom r rapporteras). Volymer i spärr (byggnader) kan läggas in i z först.
   */
  function skyfall(g, r, { minDjup = 0.05, minYta = 4, troskel = null } = {}) {
    const { W, H, s } = g, n = W * H, z = g.z;
    const platt = fyll(z, W, H, 0);
    const djup = new Float32Array(n);
    for (let q = 0; q < n; q++) { const d = platt.f[q] - z[q]; djup[q] = d > 0 ? d : 0; }
    // lågpunkter: sammanhängande områden med vattendjup
    const etikett = new Int32Array(n).fill(-1), lagpunkter = [];
    const ko = new Int32Array(n);
    for (let q0 = 0; q0 < n; q0++) {
      if (etikett[q0] !== -1 || djup[q0] < minDjup) continue;
      const id = lagpunkter.length;
      let a = 0, b = 0, maxD = 0, maxQ = q0, vol = 0, celler = 0;
      ko[b++] = q0; etikett[q0] = id;
      while (a < b) {
        const q = ko[a++];
        celler++; vol += djup[q] * s * s;
        if (djup[q] > maxD) { maxD = djup[q]; maxQ = q; }
        const i = q % W, j = (q / W) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
          const p = jj * W + ii;
          if (etikett[p] === -1 && djup[p] >= minDjup) { etikett[p] = id; ko[b++] = p; }
        }
      }
      const x = g.x0 + (maxQ % W) * s, y = g.y1 - ((maxQ / W) | 0) * s;
      lagpunkter.push({ id, yta: celler * s * s, maxDjup: maxD, volym: vol, x, y, niva: platt.f[maxQ] });
    }
    const behall = lagpunkter.filter(l => l.yta >= minYta && (!r || (l.x >= r.xmin && l.x <= r.xmax && l.y >= r.ymin && l.y <= r.ymax)));
    const behallId = new Set(behall.map(l => l.id));
    const mask = new Uint8Array(n);
    for (let q = 0; q < n; q++) if (etikett[q] >= 0 && behallId.has(etikett[q])) mask[q] = 1;
    behall.forEach(l => { l.konturer = []; });
    const konturer = A().maskKonturer(g, mask, 0.3);
    // konturen hör till den lågpunkt vars djupaste punkt ligger inuti den
    konturer.forEach(k => {
      const l = behall.find(lp => inuti(k.pts, lp.x, lp.y)) || behall[0];
      if (l) l.konturer.push(k.pts);
    });
    // flödesvägar: D8 på den lutande fyllda ytan, ackumulerad yta
    const lut = fyll(z, W, H, 1e-4);
    const ner = new Int32Array(n).fill(-1);
    for (let q = 0; q < n; q++) {
      const fq = lut.f[q];
      if (!(fq === fq)) continue;
      const i = q % W, j = (q / W) | 0;
      let bast = 0, bq = -1;
      for (const [di, dj] of GRANNAR) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        const p = jj * W + ii, fp = lut.f[p];
        if (!(fp === fp)) continue;
        const fall = (fq - fp) / ((di && dj) ? Math.SQRT2 : 1);
        if (fall > bast) { bast = fall; bq = p; }
      }
      ner[q] = bq;
    }
    const ack = new Float32Array(n).fill(s * s);
    for (let k = lut.ordning.length - 1; k >= 0; k--) {
      const q = lut.ordning[k];
      if (ner[q] >= 0) ack[ner[q]] += ack[q];
    }
    const T0 = troskel || Math.max(400, n * s * s * 0.004);
    const upp = new Uint8Array(n);
    for (let q = 0; q < n; q++) if (ack[q] >= T0 && ner[q] >= 0) upp[ner[q]] = 1;
    const sedd = new Uint8Array(n), floden = [];
    for (let q0 = 0; q0 < n; q0++) {
      if (ack[q0] < T0 || upp[q0]) continue;           // börja i källor
      const pts = [];
      let q = q0, maxAck = 0;
      while (q >= 0) {
        pts.push([g.x0 + (q % W) * s, g.y1 - ((q / W) | 0) * s]);
        maxAck = Math.max(maxAck, ack[q]);
        if (sedd[q]) break;
        sedd[q] = 1;
        q = ner[q];
      }
      if (pts.length >= 3) floden.push({ pts: T().forenkla(pts, s * 0.4), ack: maxAck });
    }
    return { W, H, s, x0: g.x0, y1: g.y1, djup, lagpunkter: behall, floden, troskel: T0 };
  }
  function inuti(poly, x, y) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function dxfSkyfall(sk, r, dx, dy) {
    const o = [];
    sk.lagpunkter.forEach((l, i) => {
      l.konturer.forEach(k => o.push({ typ: 'pl', lager: 'SKYFALL_LAGPUNKT', sluten: true, pts: k }));
      o.push({ typ: 'text', lager: 'SKYFALL_TEXT', x: l.x, y: l.y, h: 1, text: `L${i + 1} ${l.maxDjup.toFixed(2).replace('.', ',')} m` });
    });
    sk.floden.forEach(f => o.push({ typ: 'pl', lager: 'SKYFALL_FLODESVAG', pts: f.pts }));
    o.push(ram(r));
    return D().skriv({ SKYFALL_LAGPUNKT: 5, SKYFALL_FLODESVAG: 4, SKYFALL_TEXT: 5, UTSNITT: 3 }, o, { dx, dy, ext: r });
  }

  // ------------------------------------------------------------------
  // Skissade volymer
  // ------------------------------------------------------------------
  /**
   * Volym: { namn, fotavtryck: [[x,y],...] (zon), golv (RH 2000), takfot (m över golv),
   *          takform: 'platt'|'pulpet'|'sadel'|'valm', taklutning (grader), nockriktning (grader från x-axeln) }
   * Höjd på taket i en punkt inom fotavtrycket, i RH 2000.
   */
  function takhojd(v, x, y) {
    const bas = v.golv + v.takfot;
    if (!v.takform || v.takform === 'platt' || !(v.taklutning > 0)) return bas;
    const t = Math.tan(v.taklutning * RAD);
    const vinkel = (v.nockriktning != null ? v.nockriktning : langsida(v.fotavtryck)) * RAD;
    const ux = Math.cos(vinkel), uy = Math.sin(vinkel);              // längs nocken
    const tvar = p => -(p[0]) * uy + p[1] * ux, langs = p => p[0] * ux + p[1] * uy;
    const tv = v.fotavtryck.map(tvar), lg = v.fotavtryck.map(langs);
    const tmin = Math.min(...tv), tmax = Math.max(...tv), lmin = Math.min(...lg), lmax = Math.max(...lg);
    const d = tvar([x, y]), l = langs([x, y]);
    if (v.takform === 'pulpet') return bas + (tmax - d) * t;
    const mitt = (tmin + tmax) / 2, halv = (tmax - tmin) / 2;
    let h = (halv - Math.abs(d - mitt)) * t;
    if (v.takform === 'valm') h = Math.min(h, (Math.min(l - lmin, lmax - l)) * t);
    return bas + Math.max(0, h);
  }
  /** Riktningen på fotavtryckets längsta sida, i grader. */
  function langsida(p) {
    let best = 0, ang = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l > best) { best = l; ang = Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD; }
    }
    return ang;
  }
  const nockhojd = v => {
    let m = v.golv + v.takfot;
    const xs = v.fotavtryck.map(p => p[0]), ys = v.fotavtryck.map(p => p[1]);
    const r = { xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys) };
    for (let x = r.xmin; x <= r.xmax; x += 0.5) for (let y = r.ymin; y <= r.ymax; y += 0.5) if (inuti(v.fotavtryck, x, y)) m = Math.max(m, takhojd(v, x, y));
    return m;
  };
  /**
   * Bränner in volymerna i ett nodrutnät: z = max(z, tak) inom fotavtrycket.
   * Med spärr = true används takfotshöjden (för vatten räcker att huset står där).
   */
  function branInVolymer(g, z, volymer, { spar = false } = {}) {
    const ut = Float32Array.from(z);
    for (const v of volymer) {
      const xs = v.fotavtryck.map(p => p[0]), ys = v.fotavtryck.map(p => p[1]);
      const i0 = Math.max(0, Math.floor((Math.min(...xs) - g.x0) / g.s)), i1 = Math.min(g.W - 1, Math.ceil((Math.max(...xs) - g.x0) / g.s));
      const j0 = Math.max(0, Math.floor((g.y1 - Math.max(...ys)) / g.s)), j1 = Math.min(g.H - 1, Math.ceil((g.y1 - Math.min(...ys)) / g.s));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = g.x0 + i * g.s, y = g.y1 - j * g.s;
        if (!inuti(v.fotavtryck, x, y)) continue;
        const h = spar ? v.golv + v.takfot : takhojd(v, x, y);
        const q = j * g.W + i;
        if (!(ut[q] >= h)) ut[q] = h;
      }
    }
    return ut;
  }
  function dxfVolymer(volymer, r, dx, dy, dz) {
    const o = [];
    volymer.forEach(v => {
      o.push({ typ: 'pl', lager: 'SKISS_FOTAVTRYCK', sluten: true, pts: v.fotavtryck, z: v.golv });
      o.push({ typ: 'pl', lager: 'SKISS_TAKFOT', sluten: true, pts: v.fotavtryck, z: v.golv + v.takfot });
      const c = tyngdpunkt(v.fotavtryck);
      o.push({ typ: 'text', lager: 'SKISS_TEXT', x: c[0], y: c[1], z: v.golv, h: 1, text: `${v.namn || 'Volym'} FG ${hojdText(v.golv, dz)}` });
    });
    o.push(ram(r));
    return D().skriv({ SKISS_FOTAVTRYCK: 6, SKISS_TAKFOT: 6, SKISS_TEXT: 6, UTSNITT: 3 }, o, { dx, dy, dz, ext: r });
  }
  function tyngdpunkt(p) {
    // relativt första hörnet: zonens stora koordinater ger annars avrundningsfel på metern (0.10.0)
    const [ox, oy] = p[0];
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < p.length; i++) {
      const x0 = p[i][0] - ox, y0 = p[i][1] - oy, x1 = p[(i + 1) % p.length][0] - ox, y1 = p[(i + 1) % p.length][1] - oy, k = x0 * y1 - x1 * y0;
      a += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k;
    }
    if (Math.abs(a) < 1e-9) return [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
    return [ox + cx / (3 * a), oy + cy / (3 * a)];
  }
  const area = p => Math.abs(p.reduce((s, q, i) => { const b = p[(i + 1) % p.length], o = p[0]; return s + (q[0] - o[0]) * (b[1] - o[1]) - (b[0] - o[0]) * (q[1] - o[1]); }, 0) / 2);

  /** Slutna polylinjer ur en DXF (LWPOLYLINE och POLYLINE) som fotavtryck. */
  function lasDxfFotavtryck(text) {
    const rader = text.split(/\r?\n/).map(x => x.trim());
    const ut = [];
    let ent = null, vtx = null;
    const klar = () => { if (ent && ent.sluten && ent.pts.length >= 3) ut.push(ent); ent = null; vtx = null; };
    for (let i = 0; i + 1 < rader.length; i += 2) {
      const k = rader[i], v = rader[i + 1];
      if (k === '0') {
        if (ent && ent.typ === 'LWPOLYLINE') klar();
        if (v === 'LWPOLYLINE' || v === 'POLYLINE') { klar(); ent = { typ: v, pts: [], sluten: false, lager: '' }; }
        else if (v === 'VERTEX' && ent && ent.typ === 'POLYLINE') vtx = [NaN, NaN];
        else if (v === 'SEQEND' && ent && ent.typ === 'POLYLINE') klar();
        else if (ent && ent.typ === 'POLYLINE' && v !== 'VERTEX') { /* annat inuti polylinjen ignoreras */ }
        continue;
      }
      if (!ent) continue;
      if (vtx) {
        if (k === '10') vtx[0] = Number(v);
        else if (k === '20') { vtx[1] = Number(v); ent.pts.push(vtx); vtx = [NaN, NaN]; }
        continue;
      }
      if (k === '8') ent.lager = v;
      else if (k === '70') ent.sluten = (Number(v) & 1) === 1;
      else if (k === '10' && ent.typ === 'LWPOLYLINE') ent.pts.push([Number(v), NaN]);
      else if (k === '20' && ent.typ === 'LWPOLYLINE' && ent.pts.length) ent.pts[ent.pts.length - 1][1] = Number(v);
    }
    klar();
    return ut.map(e => {
      let pts = e.pts.filter(q => isFinite(q[0]) && isFinite(q[1]));
      if (pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts = pts.slice(0, -1);
      return { lager: e.lager, pts };
    }).filter(e => e.pts.length >= 3 && area(e.pts) >= 4);
  }

  // ------------------------------------------------------------------
  // Strandskydd: avstånd till vatten (indikation)
  // ------------------------------------------------------------------
  function avstandSegmentRuta(a, b, r) {
    const inne = p => p[0] >= r.xmin && p[0] <= r.xmax && p[1] >= r.ymin && p[1] <= r.ymax;
    if (inne(a) || inne(b)) return 0;
    const kanter = [[[r.xmin, r.ymin], [r.xmax, r.ymin]], [[r.xmax, r.ymin], [r.xmax, r.ymax]], [[r.xmax, r.ymax], [r.xmin, r.ymax]], [[r.xmin, r.ymax], [r.xmin, r.ymin]]];
    let m = Infinity;
    for (const [c, d] of kanter) {
      if (korsar(a, b, c, d)) return 0;
      m = Math.min(m, punktSegment(a, c, d), punktSegment(b, c, d), punktSegment(c, a, b), punktSegment(d, a, b));
    }
    return m;
  }
  function punktSegment(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  function korsar(a, b, c, d) {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
  }
  /** vatten: [{ typ, namn, pts, yta }] i zonen. Returnerar närmaste avstånd och objekt. */
  function narmasteVatten(r, vatten) {
    let bast = { avstand: Infinity, objekt: null };
    for (const v of vatten) {
      const p = v.pts;
      for (let i = 0; i + 1 < p.length; i++) {
        const d = avstandSegmentRuta(p[i], p[i + 1], r);
        if (d < bast.avstand) bast = { avstand: d, objekt: v };
      }
      if (v.yta && p.length > 2) {
        const c = [(r.xmin + r.xmax) / 2, (r.ymin + r.ymax) / 2];
        if (inuti(p, c[0], c[1])) bast = { avstand: 0, objekt: v };
      }
    }
    return bast;
  }

  return {
    hojdpunkter, dxfHojdpunkter, hojdText,
    LUTNING, lutning, lutningCanvas, lutningKonturer, dxfLutning,
    fyll, skyfall, dxfSkyfall, inuti,
    takhojd, nockhojd, branInVolymer, dxfVolymer, tyngdpunkt, area, langsida, lasDxfFotavtryck,
    narmasteVatten,
  };
}));
