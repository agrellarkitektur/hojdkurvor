/*
 * Laserdata Nedladdning, skog (COPC) – sök rutor i Lantmäteriets STAC, läs bara
 * utsnittets punkter och skriv LAS och XYZ.
 *
 * Kräver CopcLib (copc.js + laz-perf, se vendor/copc-bundle.js), proj4 och Terrang.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Laser = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const T = () => (typeof Terrang !== 'undefined' ? Terrang : globalThis.Terrang);
  const C = () => (typeof CopcLib !== 'undefined' ? CopcLib : globalThis.CopcLib);
  const KONF = () => (typeof self !== 'undefined' && self.TERRANG_KONFIG) || {};

  const STAC_BAS = () => (typeof self !== 'undefined' && self.TERRANG_STAC_BAS) || 'https://api.lantmateriet.se';
  const SAMLING = 'dsm-skoglig-copc';

  // Lantmäteriets klasser i Laserdata skog
  const KLASSER = {
    1: { namn: 'Ej klassad (vegetation, byggnader m.m.)', rgb: [70, 140, 60] },
    2: { namn: 'Mark', rgb: [150, 120, 85] },
    7: { namn: 'Lågpunkt (brus)', rgb: [200, 0, 200], brus: true },
    9: { namn: 'Vatten', rgb: [60, 110, 200] },
    17: { namn: 'Bro', rgb: [130, 130, 130] },
    18: { namn: 'Högpunkt (brus)', rgb: [200, 0, 200], brus: true },
  };
  const klassInfo = k => KLASSER[k] || { namn: `Klass ${k}`, rgb: [180, 180, 180] };

  // ------------------------------------------------------------------
  // STAC (öppen katalog). Om webbläsaren stoppar anropet används stac.php.
  // ------------------------------------------------------------------
  async function hamtaJson(sokvag) {
    const direkt = STAC_BAS() + sokvag;
    try {
      const r = await fetch(direkt);
      if (r.ok) return await r.json();
      throw new Error(`STAC svarade ${r.status}`);
    } catch (e) {
      const proxy = KONF().stacProxy;
      if (!proxy) throw new Error('Kunde inte nå Lantmäteriets katalog (STAC). Lägg stac.php på webbhotellet och ange stacProxy i config.js.');
      const r = await fetch(proxy + '?p=' + encodeURIComponent(sokvag));
      if (!r.ok) throw new Error(`Katalogen svarade ${r.status} via stac.php.`);
      return r.json();
    }
  }

  /** Alla laserrutor som berör tmBox (SWEREF 99 TM). */
  async function sokRutor(tmBox) {
    const p = T().omvandlare(3006, 4326).forward;
    const hörn = [[tmBox.xmin, tmBox.ymin], [tmBox.xmax, tmBox.ymin], [tmBox.xmax, tmBox.ymax], [tmBox.xmin, tmBox.ymax]].map(p);
    const bbox = [Math.min(...hörn.map(h => h[0])), Math.min(...hörn.map(h => h[1])),
                  Math.max(...hörn.map(h => h[0])), Math.max(...hörn.map(h => h[1]))].map(v => v.toFixed(6)).join(',');
    let sokvag = `/stac-hojd/v1/collections/${SAMLING}/items?bbox=${bbox}&limit=100`;
    const ut = [];
    for (let sida = 0; sida < 10 && sokvag; sida++) {
      const j = await hamtaJson(sokvag);
      for (const f of j.features || []) {
        const pr = f.properties || {}, a = (f.assets || {}).data;
        if (!a || !pr['proj:bbox']) continue;
        ut.push({ id: f.id, datum: pr.datetime || pr.start_datetime, omrade: pr.skanningsomrade || '',
          bbox: pr['proj:bbox'], href: a.href, tathet: pr.punkttathet });
      }
      const nasta = (j.links || []).find(l => l.rel === 'next');
      sokvag = nasta ? nasta.href.replace(/^https?:\/\/[^/]+/, '') : null;
    }
    return ut;
  }

  const snitt = (a, b) => Math.max(0, Math.min(a[2], b.xmax) - Math.max(a[0], b.xmin)) *
                          Math.max(0, Math.min(a[3], b.ymax) - Math.max(a[1], b.ymin));

  /**
   * Väljer rutor: senaste skanningen som täcker området, och inom den de minsta
   * rutorna (samma data finns i både 2,5 km- och 10 km-rutor).
   */
  function valjRutor(rutor, tmBox) {
    const yta = (tmBox.xmax - tmBox.xmin) * (tmBox.ymax - tmBox.ymin);
    const berorda = rutor.filter(r => snitt(r.bbox, tmBox) > 0);
    if (!berorda.length) return { valda: [], tackning: 0 };
    const grupper = {};
    berorda.forEach(r => { (grupper[r.omrade + '|' + r.datum] = grupper[r.omrade + '|' + r.datum] || []).push(r); });
    const kandidater = Object.values(grupper).map(g => {
      const storlekar = [...new Set(g.map(r => Math.round(r.bbox[2] - r.bbox[0])))].sort((a, b) => a - b);
      let bast = null;
      for (const s of storlekar) {
        const valda = g.filter(r => Math.round(r.bbox[2] - r.bbox[0]) === s);
        const tackning = Math.min(1, valda.reduce((a, r) => a + snitt(r.bbox, tmBox), 0) / yta);
        if (!bast || tackning > bast.tackning + 1e-6) bast = { valda, tackning };
        if (tackning > 0.999) break;
      }
      return Object.assign(bast, { datum: g[0].datum });
    });
    kandidater.sort((a, b) => (b.tackning > 0.999) - (a.tackning > 0.999) || String(b.datum).localeCompare(String(a.datum)) || b.tackning - a.tackning);
    return kandidater[0];
  }

  // ------------------------------------------------------------------
  // COPC
  // ------------------------------------------------------------------
  let lazPerfLova = null;
  function lazPerf() {
    if (!lazPerfLova) {
      lazPerfLova = C().createLazPerf({ locateFile: f => (KONF().vendorBas || 'vendor/') + f });
    }
    return lazPerfLova;
  }

  function hamtare(url, auth) {
    return async (b, e) => {
      let r;
      try {
        r = await fetch(url, { headers: { Authorization: auth, Range: `bytes=${b}-${e - 1}` } });
      } catch (err) { throw new Error('Kunde inte nå Lantmäteriets server för laserdata.'); }
      if (r.status === 401 || r.status === 403)
        throw new (T().InloggningsFel)('Lantmäteriet nekade åtkomst till laserdatan. Kontrollera att Laserdata Nedladdning, skog är beställd för kontot.');
      if (r.status !== 206 && r.status !== 200) throw new Error(`Lantmäteriet svarade ${r.status} för laserdatan.`);
      const buf = new Uint8Array(await r.arrayBuffer());
      return r.status === 200 && buf.length > e - b ? buf.slice(b, e) : buf;
    };
  }

  /**
   * Läser punkter inom tmBox (SWEREF 99 TM, med marginal). Returnerar typade arrayer
   * i TM-koordinater. klassFilter(k) → true för klasser som ska med.
   */
  async function lasPunkter(rutor, tmBox, auth, { logg = () => {}, framsteg = () => {}, klassFilter = () => true, maxPunkter = 6e6 } = {}) {
    const Lib = C();
    const lp = await lazPerf();
    const kol = { x: [], y: [], z: [], k: [], i: [], ret: [], nret: [], t: [] };
    let antal = 0;
    for (let ri = 0; ri < rutor.length; ri++) {
      const r = rutor[ri];
      const url = T().dlUrl(r.href);
      const get = hamtare(url, auth);
      logg(`Läser laserruta ${r.id} …`);
      const copc = await Lib.Copc.create(get);
      const kub = copc.info.cube;
      const sida = kub[3] - kub[0];
      const korsar = key => {
        const [d, x, y] = key.split('-').map(Number);
        const s = sida / 2 ** d, x0 = kub[0] + x * s, y0 = kub[1] + y * s;
        return x0 <= tmBox.xmax && x0 + s >= tmBox.xmin && y0 <= tmBox.ymax && y0 + s >= tmBox.ymin;
      };
      // hierarkin, bara sidor som korsar området
      const noder = {};
      const koer = [copc.info.rootHierarchyPage];
      while (koer.length) {
        const sid = koer.shift();
        const h = await Lib.Copc.loadHierarchyPage(get, sid);
        Object.entries(h.nodes).forEach(([k, n]) => { if (n.pointCount > 0 && korsar(k)) noder[k] = n; });
        Object.entries(h.pages).forEach(([k, p]) => { if (korsar(k)) koer.push(p); });
      }
      const lista = Object.entries(noder);
      for (let ni = 0; ni < lista.length; ni++) {
        const [, node] = lista[ni];
        const vy = await Lib.Copc.loadPointDataView(get, copc, node, { lazPerf: lp });
        const g = n => { try { return vy.getter(n); } catch (e) { return () => 0; } };
        const X = g('X'), Y = g('Y'), Z = g('Z'), K = g('Classification'), I = g('Intensity'),
          RN = g('ReturnNumber'), NR = g('NumberOfReturns'), GT = g('GpsTime');
        for (let p = 0; p < vy.pointCount; p++) {
          const x = X(p), y = Y(p);
          if (x < tmBox.xmin || x > tmBox.xmax || y < tmBox.ymin || y > tmBox.ymax) continue;
          const k = K(p);
          if (!klassFilter(k)) continue;
          kol.x.push(x); kol.y.push(y); kol.z.push(Z(p)); kol.k.push(k); kol.i.push(I(p));
          kol.ret.push(RN(p)); kol.nret.push(NR(p)); kol.t.push(GT(p));
          if (++antal > maxPunkter) throw new Error(`Utsnittet innehåller fler än ${(maxPunkter / 1e6).toFixed(0)} miljoner laserpunkter. Välj ett mindre område.`);
        }
        framsteg((ri + (ni + 1) / lista.length) / rutor.length);
      }
    }
    return {
      antal, x: Float64Array.from(kol.x), y: Float64Array.from(kol.y), z: Float64Array.from(kol.z),
      k: Uint8Array.from(kol.k), i: Uint16Array.from(kol.i), ret: Uint8Array.from(kol.ret),
      nret: Uint8Array.from(kol.nret), t: Float64Array.from(kol.t),
    };
  }

  /** Projicerar om till vald zon och klipper till utsnittet. Muterar inte indata. */
  function tillZon(p, epsg, r) {
    const f = epsg === 3006 ? null : T().omvandlare(3006, epsg).forward;
    const behall = [];
    const X = new Float64Array(p.antal), Y = new Float64Array(p.antal);
    for (let i = 0; i < p.antal; i++) {
      let x = p.x[i], y = p.y[i];
      if (f) [x, y] = f([x, y]);
      X[i] = x; Y[i] = y;
      if (x >= r.xmin && x <= r.xmax && y >= r.ymin && y <= r.ymax) behall.push(i);
    }
    const idx = Uint32Array.from(behall), n = idx.length;
    const pick = (src, Typ) => { const a = new Typ(n); for (let j = 0; j < n; j++) a[j] = src[idx[j]]; return a; };
    return { antal: n, x: pick(X, Float64Array), y: pick(Y, Float64Array), z: pick(p.z, Float64Array),
      k: pick(p.k, Uint8Array), i: pick(p.i, Uint16Array), ret: pick(p.ret, Uint8Array),
      nret: pick(p.nret, Uint8Array), t: pick(p.t, Float64Array) };
  }

  // ------------------------------------------------------------------
  // Filer
  // ------------------------------------------------------------------
  /** LAS 1.2, punktformat 1 (med GPS-tid). epsg > 0 ger GeoTIFF-nyckel för plansystemet. */
  function las(p, dx, dy, dz, epsg) {
    const n = p.antal, t = Terrang.tillLokal(dx, dy);
    const lx = new Float64Array(n), ly = new Float64Array(n);
    for (let i = 0; i < n; i++) { const q = t(p.x[i], p.y[i]); lx[i] = q[0]; ly[i] = q[1]; }
    let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = lx[i], y = ly[i], z = p.z[i] - dz;
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
      if (z < minz) minz = z; if (z > maxz) maxz = z;
    }
    if (!n) { minx = miny = minz = maxx = maxy = maxz = 0; }
    const sk = 0.01;
    const ox = Math.floor(minx), oy = Math.floor(miny), oz = Math.floor(minz);
    const vlrLangd = epsg ? 54 + 8 * 4 * 2 : 0;           // header 54 + nycklar (4 st × 8 byte)
    const hdr = 227, offs = hdr + vlrLangd, rec = 28;
    const buf = new ArrayBuffer(offs + n * rec), dv = new DataView(buf), u8 = new Uint8Array(buf);
    const str = (o, s, len) => { for (let i = 0; i < len; i++) u8[o + i] = i < s.length ? s.charCodeAt(i) : 0; };
    str(0, 'LASF', 4);
    dv.setUint8(24, 1); dv.setUint8(25, 2);                 // version 1.2
    str(26, 'Terrangunderlag', 32); str(58, 'Terrangunderlag', 32);
    const nu = new Date(), dag = Math.floor((nu - new Date(Date.UTC(nu.getUTCFullYear(), 0, 1))) / 864e5) + 1;
    dv.setUint16(90, dag, true); dv.setUint16(92, nu.getUTCFullYear(), true);
    dv.setUint16(94, hdr, true); dv.setUint32(96, offs, true);
    dv.setUint32(100, epsg ? 1 : 0, true);
    dv.setUint8(104, 1); dv.setUint16(105, rec, true); dv.setUint32(107, n, true);
    const perRetur = [0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) { const r = Math.min(5, Math.max(1, p.ret[i] || 1)); perRetur[r - 1]++; }
    perRetur.forEach((c, i) => dv.setUint32(111 + 4 * i, c, true));
    [sk, sk, sk].forEach((v, i) => dv.setFloat64(131 + 8 * i, v, true));
    [ox, oy, oz].forEach((v, i) => dv.setFloat64(155 + 8 * i, v, true));
    [maxx, minx, maxy, miny, maxz, minz].forEach((v, i) => dv.setFloat64(179 + 8 * i, v, true));
    if (epsg) {
      let o = hdr;
      dv.setUint16(o, 0, true); str(o + 2, 'LASF_Projection', 16); dv.setUint16(o + 18, 34735, true);
      dv.setUint16(o + 20, 32, true); str(o + 22, 'GeoKeyDirectoryTag', 32);
      o += 54;
      [[1, 1, 0, 3], [1024, 0, 1, 1], [1025, 0, 1, 1], [3072, 0, 1, epsg]].forEach(k => {
        k.forEach(v => { dv.setUint16(o, v, true); o += 2; });
      });
    }
    let o = offs;
    for (let i = 0; i < n; i++, o += rec) {
      dv.setInt32(o, Math.round((lx[i] - ox) / sk), true);
      dv.setInt32(o + 4, Math.round((ly[i] - oy) / sk), true);
      dv.setInt32(o + 8, Math.round((p.z[i] - dz - oz) / sk), true);
      dv.setUint16(o + 12, p.i[i], true);
      const rn = Math.min(7, p.ret[i] || 1), nr = Math.min(7, p.nret[i] || 1);
      dv.setUint8(o + 14, rn | (nr << 3));
      dv.setUint8(o + 15, Math.min(31, p.k[i]));
      dv.setFloat64(o + 20, p.t[i], true);
    }
    return buf;
  }

  /** XYZ med färg per klass: "x y z r g b" (Archicad läser punktmoln i det här formatet). */
  function xyzRgb(p, dx, dy, dz) {
    const rad = new Array(p.antal), t = Terrang.tillLokal(dx, dy);
    for (let i = 0; i < p.antal; i++) {
      const c = klassInfo(p.k[i]).rgb;
      const [x, y] = t(p.x[i], p.y[i]);
      rad[i] = `${x.toFixed(2)} ${y.toFixed(2)} ${(p.z[i] - dz).toFixed(2)} ${c[0]} ${c[1]} ${c[2]}`;
    }
    return rad.join('\r\n') + '\r\n';
  }

  function sammanfattning(p) {
    const per = {};
    for (let i = 0; i < p.antal; i++) per[p.k[i]] = (per[p.k[i]] || 0) + 1;
    return per;
  }

  return { KLASSER, klassInfo, sokRutor, valjRutor, lasPunkter, tillZon, las, xyzRgb, sammanfattning };
}));
