// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Enkel DXF R12-skrivare: polylinjer, punkter och text på namngivna lager.
 * Texter med tecken utanför ASCII skrivs som \U+XXXX, som AutoCAD och Archicad läser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dxf = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Lagernamn med bara A–Z, 0–9 och _ (å/ä → A, ö → O). */
  function lagernamn(s) {
    return String(s).toUpperCase()
      .replace(/[ÅÄ]/g, 'A').replace(/Ö/g, 'O').replace(/É/g, 'E').replace(/Ü/g, 'U')
      .replace(/[^A-Z0-9_-]+/g, '_').replace(/[-_]*_[-_]*/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'LAGER';
  }
  /**
   * DXF R12 tillåter högst 31 tecken i lagernamn. Längre namn kortas; krockar
   * får ett löpnummer på slutet. Samma lista namn ger alltid samma resultat.
   */
  const MAX_NAMN = 31;
  function kortaNamn(namnLista) {
    const ut = {}, upptagna = new Set(namnLista.filter(n => n.length <= MAX_NAMN));
    for (const n of namnLista) {
      if (n.length <= MAX_NAMN) { ut[n] = n; continue; }
      let k = n.slice(0, MAX_NAMN).replace(/_+$/, '');
      for (let i = 2; upptagna.has(k); i++) k = n.slice(0, MAX_NAMN - 1 - String(i).length).replace(/_+$/, '') + '_' + i;
      upptagna.add(k); ut[n] = k;
    }
    return ut;
  }
  const textKod = s => String(s).replace(/[^\x20-\x7e]/g, c => '\\U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));

  /**
   * lager: { NAMN: farg (ACI 1–255) }
   * objekt: [{ typ: 'pl', lager, pts: [[x,y],...], sluten, z }
   *          { typ: 'punkt', lager, x, y, z }
   *          { typ: 'cirkel', lager, x, y, z, r }
   *          { typ: 'text', lager, x, y, z, h, text }
   *          { typ: 'yta', lager, pts: [[x,y,z] × 3 eller 4] } (3DFACE)]
   * dx, dy, dz dras av från koordinaterna.
   */
  function skriv(lager, objekt, { dx = 0, dy = 0, dz = 0, ext = null } = {}) {
    const TR = (typeof Terrang !== 'undefined' ? Terrang : globalThis.Terrang);
    const t = TR && TR.tillLokal ? TR.tillLokal(dx, dy) : ((x, y) => [x - dx, y - dy]);
    const X = (x, y) => t(x, y)[0], Y = (x, y) => t(x, y)[1];
    if (ext && TR && TR.lokalRuta) ext = Object.assign({}, TR.lokalRuta(ext, t), { lokal: true });
    const o = [];
    const g = (k, v) => { o.push(String(k), String(v)); };
    const f = v => (Math.round(v * 1000) / 1000).toFixed(3);
    g(0, 'SECTION'); g(2, 'HEADER');
    g(9, '$ACADVER'); g(1, 'AC1009');
    g(9, '$DWGCODEPAGE'); g(3, 'ANSI_1252');
    g(9, '$INSUNITS'); g(70, 6);
    if (ext) {
      const ex = ext.lokal ? ext : { xmin: ext.xmin - dx, ymin: ext.ymin - dy, xmax: ext.xmax - dx, ymax: ext.ymax - dy };
      g(9, '$EXTMIN'); g(10, f(ex.xmin)); g(20, f(ex.ymin)); g(30, 0);
      g(9, '$EXTMAX'); g(10, f(ex.xmax)); g(20, f(ex.ymax)); g(30, 0);
    }
    g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES');
    g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 1);
    g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, 0);
    g(0, 'ENDTAB');
    const namn = Object.keys(lager);
    const kort = kortaNamn(namn);
    g(0, 'TABLE'); g(2, 'LAYER'); g(70, namn.length);
    for (const n of namn) { g(0, 'LAYER'); g(2, kort[n]); g(70, 0); g(62, lager[n] || 7); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB');
    g(0, 'TABLE'); g(2, 'STYLE'); g(70, 1);
    g(0, 'STYLE'); g(2, 'STANDARD'); g(70, 0); g(40, 0); g(41, 1); g(50, 0); g(71, 0); g(42, 2.5); g(3, 'txt'); g(4, '');
    g(0, 'ENDTAB');
    g(0, 'ENDSEC');
    const L = n => kort[n] || n;
    g(0, 'SECTION'); g(2, 'ENTITIES');
    for (const e of objekt) {
      if (e.typ === 'pl') {
        const z = (e.z || 0) - (e.z ? dz : 0);
        g(0, 'POLYLINE'); g(8, L(e.lager)); g(66, 1); g(10, 0); g(20, 0); g(30, f(z)); g(70, e.sluten ? 1 : 0);
        for (const [x, y] of e.pts) { g(0, 'VERTEX'); g(8, L(e.lager)); g(10, f(X(x, y))); g(20, f(Y(x, y))); g(30, f(z)); }
        g(0, 'SEQEND'); g(8, L(e.lager));
      } else if (e.typ === 'cirkel') {
        g(0, 'CIRCLE'); g(8, L(e.lager)); g(10, f(X(e.x, e.y))); g(20, f(Y(e.x, e.y))); g(30, f((e.z || 0) - (e.z != null ? dz : 0))); g(40, f(e.r));
      } else if (e.typ === 'punkt') {
        g(0, 'POINT'); g(8, L(e.lager)); g(10, f(X(e.x, e.y))); g(20, f(Y(e.x, e.y))); g(30, f((e.z || 0) - (e.z != null ? dz : 0)));
      } else if (e.typ === 'yta') {
        // 3DFACE (0.13.0): tre eller fyra hörn [x, y, z]; med tre upprepas det sista
        const p = e.pts.length === 3 ? e.pts.concat([e.pts[2]]) : e.pts;
        g(0, '3DFACE'); g(8, L(e.lager));
        p.forEach(([x, y, z], i) => { g(10 + i, f(X(x, y))); g(20 + i, f(Y(x, y))); g(30 + i, f(z - dz)); });
      } else if (e.typ === 'text') {
        g(0, 'TEXT'); g(8, L(e.lager)); g(10, f(X(e.x, e.y))); g(20, f(Y(e.x, e.y))); g(30, f((e.z || 0) - (e.z != null ? dz : 0)));
        g(40, e.h || 1); g(1, textKod(e.text));
      }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return o.join('\r\n') + '\r\n';
  }

  /**
   * Slår ihop flera DXF R12-texter från skriv() till en: alla lager och alla objekt.
   * Lager med samma namn blir ett (färgen från den första filen). Utbredningen blir
   * den sammanlagda.
   */
  function sammanfoga(texter) {
    const lager = new Map(), delar = [];
    let ext = null;
    for (const t of texter) {
      const r = t.split(/\r?\n/);
      const par = [];
      for (let i = 0; i + 1 < r.length; i += 2) par.push([r[i].trim(), r[i + 1]]);
      let sektion = null, i = 0;
      const exHamta = (namn) => {
        const k = par.findIndex(p => p[0] === '9' && p[1] === namn);
        return k < 0 ? null : [Number(par[k + 1][1]), Number(par[k + 2][1])];
      };
      const a = exHamta('$EXTMIN'), b = exHamta('$EXTMAX');
      if (a && b) ext = ext ? { xmin: Math.min(ext.xmin, a[0]), ymin: Math.min(ext.ymin, a[1]), xmax: Math.max(ext.xmax, b[0]), ymax: Math.max(ext.ymax, b[1]) } : { xmin: a[0], ymin: a[1], xmax: b[0], ymax: b[1] };
      for (; i < par.length; i++) {
        const [k, v] = par[i];
        if (k === '2' && i > 0 && par[i - 1][1] === 'SECTION') { sektion = v; continue; }
        if (sektion === 'TABLES' && k === '0' && v === 'LAYER') {
          let namn = null, farg = 7;
          for (let j = i + 1; j < par.length && par[j][0] !== '0'; j++) {
            if (par[j][0] === '2') namn = par[j][1];
            if (par[j][0] === '62') farg = Number(par[j][1]);
          }
          if (namn && !lager.has(namn)) lager.set(namn, farg);
        }
        if (sektion === 'ENTITIES' && k === '2' && v === 'ENTITIES') continue;
        if (sektion === 'ENTITIES') {
          if (k === '0' && v === 'ENDSEC') { sektion = null; continue; }
          delar.push(par[i][0], par[i][1]);
        }
      }
    }
    const o = [];
    const g = (k, v) => { o.push(String(k), String(v)); };
    const f = v => (Math.round(v * 1000) / 1000).toFixed(3);
    g(0, 'SECTION'); g(2, 'HEADER');
    g(9, '$ACADVER'); g(1, 'AC1009');
    g(9, '$DWGCODEPAGE'); g(3, 'ANSI_1252');
    g(9, '$INSUNITS'); g(70, 6);
    if (ext) {
      g(9, '$EXTMIN'); g(10, f(ext.xmin)); g(20, f(ext.ymin)); g(30, 0);
      g(9, '$EXTMAX'); g(10, f(ext.xmax)); g(20, f(ext.ymax)); g(30, 0);
    }
    g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES');
    g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 1);
    g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, 0);
    g(0, 'ENDTAB');
    g(0, 'TABLE'); g(2, 'LAYER'); g(70, lager.size);
    for (const [n, c] of lager) { g(0, 'LAYER'); g(2, n); g(70, 0); g(62, c); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB');
    g(0, 'TABLE'); g(2, 'STYLE'); g(70, 1);
    g(0, 'STYLE'); g(2, 'STANDARD'); g(70, 0); g(40, 0); g(41, 1); g(50, 0); g(71, 0); g(42, 2.5); g(3, 'txt'); g(4, '');
    g(0, 'ENDTAB');
    g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    return o.join('\r\n') + '\r\n' + (delar.length ? delar.join('\r\n') + '\r\n' : '') + '0\r\nENDSEC\r\n0\r\nEOF\r\n';
  }

  return { skriv, sammanfoga, lagernamn, kortaNamn, MAX_NAMN };
}));
