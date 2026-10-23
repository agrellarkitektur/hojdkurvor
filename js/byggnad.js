/*
 * Byggnad Nedladdning, vektor – befintliga byggnader ur kommunens GeoPackage:
 * fotavtryck med typ, ändamål och husnummer, höjd ur laserdatan och DXF.
 *
 * Kräver Kommunfil, Terrang och Dxf.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Byggnad = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const K = () => (typeof Kommunfil !== 'undefined' ? Kommunfil : globalThis.Kommunfil);
  const D = () => (typeof Dxf !== 'undefined' ? Dxf : globalThis.Dxf);

  const FALT = ['objektidentitet', 'objekttyp', 'andamal1', 'andamal2', 'andamal3', 'andamal4', 'andamal5',
    'husnummer', 'huvudbyggnad', 'byggnadsnamn1', 'byggnadsnamn2', 'byggnadsnamn3', 'insamlingslage'];
  /** Ytskiktet med byggnader (inte byggnadspunkt, byggnadsanläggningslinje eller -punkt). */
  const arByggnadsyta = t => /byggnad/i.test(t) && !/punkt|linje|anlaggning|anläggning/i.test(t);

  // DXF-färg (ACI) och kartfärg per objekttyp
  const TYPER = {
    bostad: { aci: 1, lager: 'BOSTAD' }, industri: { aci: 30, lager: 'INDUSTRI' }, samhallsfunktion: { aci: 5, lager: 'SAMHALLSFUNKTION' },
    verksamhet: { aci: 4, lager: 'VERKSAMHET' }, ekonomibyggnad: { aci: 42, lager: 'EKONOMIBYGGNAD' },
    komplementbyggnad: { aci: 8, lager: 'KOMPLEMENTBYGGNAD' },
  };
  const nyckel = t => String(t || '').toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z]/g, '');
  const typInfo = t => TYPER[nyckel(t)] || { aci: 7, lager: 'OVRIG' };

  /**
   * Ändamålet är "huvudgrupp;ändamål", t.ex. "Bostad;Småhus friliggande" → "Småhus friliggande".
   * Tomt eller "Ospecificerad" efter semikolonet ger huvudgruppen ("Komplementbyggnad;" → "Komplementbyggnad").
   */
  function andamalText(a) {
    if (a == null || a === '') return null;
    const [grupp, ...rest] = String(a).split(';').map(x => x.trim());
    const det = rest.join(';').trim();
    return det && !/^ospecificerad$/i.test(det) ? det : (grupp || null);
  }

  function area(p) {
    let a = 0;
    for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
    return Math.abs(a / 2);
  }
  function tyngdpunkt(p) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < p.length; i++) {
      const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length], k = x0 * y1 - x1 * y0;
      a += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k;
    }
    if (Math.abs(a) < 1e-9) return [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
    return [cx / (3 * a), cy / (3 * a)];
  }
  function inuti(poly, x, y) {
    let inne = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inne = !inne;
    }
    return inne;
  }
  const utanUpprepning = ring => {
    const r = ring.slice();
    if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
    return r;
  };

  /** Gör om GeoPackage-objekt till byggnader som berör utsnittet r. */
  function franObjekt(objekt, r) {
    const ut = [], sedda = new Set();
    for (const o of objekt) {
      if (o.typ !== 'yta' || !arByggnadsyta(o.tabell)) continue;
      const ring = utanUpprepning(o.ringar[0] || []);
      if (ring.length < 3) continue;
      if (!K().klippRing(ring, r, true).length) continue;
      const a = o.attr || {};
      const id = a.objektidentitet != null ? String(a.objektidentitet) : null;
      if (id && sedda.has(id)) continue;          // samma byggnad i två kommunfiler
      if (id) sedda.add(id);
      const andamal = [1, 2, 3, 4, 5].map(i => andamalText(a['andamal' + i])).filter(Boolean);
      ut.push({
        id, typ: a.objekttyp ? String(a.objekttyp) : 'Övrig byggnad', andamal,
        husnummer: a.husnummer != null && a.husnummer !== '' ? String(a.husnummer) : null,
        namn: [a.byggnadsnamn1, a.byggnadsnamn2, a.byggnadsnamn3].filter(n => n != null && n !== '').map(String).join(', ') || null,
        huvud: /^(ja|j|1|true)$/i.test(String(a.huvudbyggnad || '')),
        hal: o.ringar.slice(1).map(utanUpprepning).filter(h => h.length >= 3),
        fotavtryck: ring, yta: area(ring), hojd: null, mark: null,
      });
    }
    return ut;
  }

  /**
   * Hämtar byggnaderna som berör utsnittet.
   * opt: { kommuner, utsnitt, epsg, auth, logg, framsteg, bekrafta }
   */
  async function hamta(opt) {
    const res = await K().lasUtsnitt(Object.assign({ produkt: 'byggnad', tabell: arByggnadsyta, falt: FALT, marginal: 2 }, opt));
    const byggnader = franObjekt(res.objekt, opt.utsnitt);
    if (!byggnader.length && !res.tabeller.some(t => arByggnadsyta(t.namn)))
      throw new Error(`hittade inget byggnadsskikt i filen (skikt: ${res.tabeller.map(t => t.namn).join(', ') || 'inga'}).`);
    return byggnader;
  }

  /**
   * Höjd ur laserdatan: y är ytmodellen { W, H, s, x0, y1, dtm, ndsm }.
   * mark = medianen av markhöjden inom fotavtrycket, hojd = 90:e percentilen av
   * höjden över mark (taket utan skorstenar). Byggnader med färre än fyra
   * celler eller lägre än 1,5 m får ingen höjd.
   */
  function hojder(byggnader, y) {
    for (const b of byggnader) {
      b.hojd = null; b.mark = null;
      const xs = b.fotavtryck.map(p => p[0]), ys = b.fotavtryck.map(p => p[1]);
      const i0 = Math.max(0, Math.floor((Math.min(...xs) - y.x0) / y.s)), i1 = Math.min(y.W - 1, Math.ceil((Math.max(...xs) - y.x0) / y.s));
      const j0 = Math.max(0, Math.floor((y.y1 - Math.max(...ys)) / y.s)), j1 = Math.min(y.H - 1, Math.ceil((y.y1 - Math.min(...ys)) / y.s));
      const h = [], m = [];
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = y.x0 + i * y.s, yy = y.y1 - j * y.s;
        if (!inuti(b.fotavtryck, x, yy) || b.hal.some(hl => inuti(hl, x, yy))) continue;
        const q = j * y.W + i;
        if (y.ndsm[q] === y.ndsm[q]) h.push(y.ndsm[q]);
        if (y.dtm[q] === y.dtm[q]) m.push(y.dtm[q]);
      }
      if (m.length) { m.sort((a, c) => a - c); b.mark = Math.round(m[m.length >> 1] * 100) / 100; }
      if (h.length >= 4) {
        h.sort((a, c) => a - c);
        const v = h[Math.min(h.length - 1, Math.floor(h.length * 0.9))];
        if (v >= 1.5) b.hojd = Math.round(v * 10) / 10;
      }
    }
    return byggnader;
  }

  /** Byggnaderna som volymer (platta tak) för skyfall och 3D. utanHojd = höjd när laser saknas. */
  function somVolymer(byggnader, { utanHojd = null } = {}) {
    return byggnader.filter(b => b.mark != null && (b.hojd != null || utanHojd != null)).map((b, i) => ({
      id: 'befintlig-' + (b.id || i), namn: beteckning(b), fotavtryck: b.fotavtryck,
      golv: b.mark, takfot: b.hojd != null ? b.hojd : utanHojd, takform: 'platt', befintlig: true,
    }));
  }

  function beteckning(b) {
    const delar = [b.namn, b.andamal[0] || b.typ].filter(Boolean);
    return (b.husnummer ? `Hus ${b.husnummer} ` : '') + delar.join(', ');
  }

  /** Lagernamn per objekttyp, t.ex. BYGGNAD_BOSTAD. */
  function lagerFor(b) { return 'BYGGNAD_' + typInfo(b.typ).lager; }

  /**
   * DXF: fotavtrycket som sluten polylinje på marken (Z = markhöjd om den är känd),
   * taket på höjden när den är känd, och text med husnummer, ändamål och höjd.
   */
  function dxf(byggnader, r, dx, dy, dz) {
    const lager = { BYGGNAD_TAK: 8, BYGGNAD_TEXT: 7, UTSNITT: 3 }, o = [];
    const hojdText = v => String(Math.round((v - dz) * 100) / 100).replace('.', ',');
    for (const b of byggnader) {
      const l = lagerFor(b); lager[l] = typInfo(b.typ).aci;
      const z = b.mark != null ? b.mark : 0;
      o.push({ typ: 'pl', lager: l, sluten: true, pts: b.fotavtryck, z: b.mark != null ? z : undefined });
      b.hal.forEach(hl => o.push({ typ: 'pl', lager: l, sluten: true, pts: hl, z: b.mark != null ? z : undefined }));
      if (b.hojd != null && b.mark != null) o.push({ typ: 'pl', lager: 'BYGGNAD_TAK', sluten: true, pts: b.fotavtryck, z: b.mark + b.hojd });
      const c = tyngdpunkt(b.fotavtryck);
      const text = [b.husnummer ? `Hus ${b.husnummer}` : null, b.andamal[0] || b.typ, b.hojd != null ? `h ${String(b.hojd).replace('.', ',')} m` : null,
        b.mark != null ? `mark ${hojdText(b.mark)}` : null].filter(Boolean).join(' · ');
      const hT = Math.max(0.6, Math.min(2, Math.sqrt(b.yta) / 8));
      o.push({ typ: 'text', lager: 'BYGGNAD_TEXT', x: c[0], y: c[1], z: b.mark != null ? z : undefined, h: hT, text });
    }
    o.push({ typ: 'pl', lager: 'UTSNITT', sluten: true, pts: [[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax]] });
    return D().skriv(lager, o, { dx, dy, dz, ext: r });
  }

  /** CSV med en rad per byggnad (semikolon, decimalkomma som i övriga CSV-listor med text). */
  function csv(byggnader, dx, dy, dz) {
    const f = (v, d = 2) => v == null ? '' : String(Math.round(v * 10 ** d) / 10 ** d).replace('.', ',');
    const rad = ['id;objekttyp;andamal;husnummer;namn;huvudbyggnad;yta_m2;x;y;x_lokal;y_lokal;markhojd;hojd_m'];
    for (const b of byggnader) {
      const c = tyngdpunkt(b.fotavtryck);
      rad.push([b.id || '', b.typ, b.andamal.join(', '), b.husnummer || '', b.namn || '', b.huvud ? 'ja' : 'nej', f(b.yta, 1),
        f(c[0]), f(c[1]), f(c[0] - dx), f(c[1] - dy), b.mark != null ? f(b.mark - dz) : '', f(b.hojd, 1)]
        .map(v => /[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(';'));
    }
    return '﻿' + rad.join('\r\n') + '\r\n';
  }

  /** Antal per objekttyp, för info-filen. */
  function perTyp(byggnader) {
    const ut = {};
    byggnader.forEach(b => { ut[b.typ] = (ut[b.typ] || 0) + 1; });
    return ut;
  }

  return { hamta, franObjekt, hojder, somVolymer, dxf, csv, perTyp, lagerFor, typInfo, beteckning, andamalText, tyngdpunkt, inuti, FALT, arByggnadsyta };
}));
