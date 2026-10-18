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
   *          { typ: 'text', lager, x, y, z, h, text }]
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
      } else if (e.typ === 'text') {
        g(0, 'TEXT'); g(8, L(e.lager)); g(10, f(X(e.x, e.y))); g(20, f(Y(e.x, e.y))); g(30, f((e.z || 0) - (e.z != null ? dz : 0)));
        g(40, e.h || 1); g(1, textKod(e.text));
      }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return o.join('\r\n') + '\r\n';
  }

  return { skriv, lagernamn, kortaNamn, MAX_NAMN };
}));
