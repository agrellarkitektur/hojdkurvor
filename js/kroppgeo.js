// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Geometrin för kropparna i Skissa i 3D (förarbete till 0.17.0, från 0.16.5). Ren JavaScript utan
 * three.js, så att den kan testas i Node och användas av 3D-vyn, analyserna och exporten.
 *
 * Algoritmerna är flyttade ur prototypen (docs/prototyper/skissa-i-3d.html, prototyp 7), inte omskrivna:
 * profil, takKedjor, blixtlas, takGeo, vingar, murKant, murGeo, ytaPulpet och fotPolys. De räknar i
 * prototypens lokala system (lx åt kroppens längd, y uppåt, lz åt kroppens framsida, söderut vid
 * vridning 0). Allt som lagras i volymen räknas i appens lokala system (u = lx, v = −lz, norrut vid
 * vridning 0) och görs om i tillProto. Se *Kropparna* i docs/PROJEKTFIL.md.
 *
 * harledd(v, { markH }) ger
 *   { ringar: [[ytter, ...hål], …]   fotavtrycket i zonen (ytterringar moturs, hål medurs)
 *     mesh: { pos: [E, N, Z, …], index: [...], del: [...] }   trianglar i zonen och RH 2000,
 *           del per triangel: 'vagg' | 'tak' | 'botten' | 'sockel'; normalerna pekar utåt
 *     topp, golv }
 * och hojdVid(h, x, y) taket (högsta ytan) i en punkt, för analyserna.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Kroppgeo = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const RAD = Math.PI / 180;
  /** Basformerna. polygon = fritt fotavtryck med dagens takformer (platt, pulpet, sadel, valm). */
  const TYPER = ['block', 'cylinder', 'polygon', 'yta', 'mur', 'sfar'];
  /** Takformerna per basform (prototypens takFor). */
  const TAK = {
    block: ['platt', 'pulpet', 'sadel', 'mansard', 'pyramid', 'valv'],
    blockGard: ['platt', 'sadel', 'mansard'],
    cylinder: ['platt', 'kon', 'kupol'],
    polygon: ['platt', 'pulpet', 'sadel', 'valm'],
    yta: ['platt', 'pulpet'],
    mur: ['platt'], sfar: ['platt'],
  };
  const FORMER = ['gavel', 'tak', 'egen'];
  /** Rund cylinder: lika många sidor och samma vinklar som fotavtrycket i Volym3D (32, förskjutet en halv sida). */
  const RUND = 32;

  // ------------------------------------------------------------------
  // Från volymen till prototypens kropp
  // ------------------------------------------------------------------
  const tal = (x, def) => (typeof x === 'number' && isFinite(x) ? x : def);
  const klamp = (x, a, b) => Math.min(b, Math.max(a, x));
  /**
   * Prototypens kropp b ur volymen v: { typ, x, z (bara för ordningens skull 0), r, b, d, n, h, th, tak,
   * ml, mb, ea, eb, gard, pts, t, topp, tr }. Lokala punkter och vinklar vänds från v norrut till lz söderut.
   */
  function tillProto(v) {
    const p = v.primitiv || {};
    if (p.typ === 'prisma') return franPrisma(v);
    const typ = TYPER.includes(p.typ) ? p.typ : 'polygon';
    const b = { typ, b: Math.max(0.1, tal(p.b, tal(p.diam, 10))), d: Math.max(0.1, tal(p.d, 8)), n: Math.round(tal(p.n, 0)), h: Math.max(0, tal(v.takfot, 3)),
      th: Math.max(0, tal(p.th, 0)), tak: p.tak || 'platt' };
    if (b.n && (b.n < 3 || b.n > 32)) b.n = 0;
    if (p.mansard) { b.ml = klamp(tal(p.mansard.nedreLutning, 70), 5, 89); b.mb = Math.max(0, tal(p.mansard.nedreBredd, 1)); }
    const ande = e => (e ? { typ: FORMER.includes(e.form) ? e.form : 'gavel', lut: klamp(tal(e.lutning, 60), 5, 89.9), k: klamp(tal(e.start, 0), 0, 1), g: -klamp(tal(e.gering, 0), -60, 60) } : null);
    if (Array.isArray(p.gavlar)) { b.ea = ande(p.gavlar[0]); b.eb = ande(p.gavlar[1]); }
    if (p.gard && (typ === 'block' || typ === 'cylinder')) {
      const gavlar = {};
      for (const [k, f] of Object.entries(p.gard.gavlar || {})) {
        const [su, sv] = k.split(',').map(Number);
        if (Math.abs(su) === 1 && Math.abs(sv) === 1 && f) gavlar[`${su},${-sv}`] = { x: !!f.x, z: !!f.z };
      }
      b.gard = { hd: Math.max(1, tal(p.gard.husdjup, 10)), gavlar };
    }
    if (Array.isArray(p.pts)) b.pts = p.pts.filter(q => Array.isArray(q) && isFinite(q[0]) && isFinite(q[1])).map(q => [q[0], -q[1]]);
    if (typ === 'mur') { b.t = Math.max(0.02, tal(p.tjocklek, 0.2)); b.topp = p.topp === 'rak' ? 'rak' : 'mark'; }
    if (typ === 'yta') b.tr = -tal(p.lutningsriktning, 0) * RAD;
    if (!(TAK[b.gard ? 'blockGard' : typ] || ['platt']).includes(b.tak)) b.tak = 'platt';
    return b;
  }

  /**
   * Dagens prisma (0.10.0–0.16.x) i den nya modellen: ett block med sadel, valm (båda ändarna som
   * takfallen) eller pulpet. Takhöjden räknas ur lutningen. Prismats pulpettak är högt på den lokala
   * södersidan och prototypens på norrsidan, så det vrids ett halvt varv (fotavtrycket är detsamma).
   */
  function franPrisma(v) {
    const p = v.primitiv, f = ['sadel', 'valm', 'pulpet'].includes(v.takform) ? v.takform : 'sadel';
    const d = Math.max(0.1, tal(p.d, 8)), lut = klamp(tal(v.taklutning, 0), 0, 89);
    const b = { typ: 'block', b: Math.max(0.1, tal(p.b, 10)), d, n: 0, h: Math.max(0, tal(v.takfot, 3)), tak: f === 'valm' ? 'sadel' : f,
      th: (f === 'pulpet' ? d : d / 2) * Math.tan(lut * RAD) };
    if (f === 'valm') { b.ea = { typ: 'tak', lut: 60, k: 0, g: 0 }; b.eb = { typ: 'tak', lut: 60, k: 0, g: 0 }; }
    if (f === 'pulpet') b.vridTill = 180;
    return b;
  }

  // ------------------------------------------------------------------
  // Takformer och ändar (prototypens kod, i lokala lx, y, lz)
  // ------------------------------------------------------------------
  // Varje ände (ea = lokala −x, eb = +x): typ gavel | tak (samma lutning som takfallen = valm) | egen (lutning lut°),
  // k = var lutningen börjar, andel av takhöjden (0 = från takfoten, däremellan halvvalm), g = gering i plan, grader.
  const ANDE0 = Object.freeze({ typ: 'gavel', lut: 60, k: 0, g: 0 });
  const Er = (b, s) => (s < 0 ? b.ea : b.eb) || ANDE0;
  const maxHd = b => (b.typ === 'cylinder' ? b.b / 2 * Math.cos(Math.PI / (b.n || 32)) : Math.min(b.b, b.d) / 2) - 0.5;
  const hdv = b => Math.max(1, Math.min(b.gard.hd, maxHd(b)));
  const djup = b => (b.gard ? hdv(b) : b.d);
  const tanG = (b, s) => (b.gard || b.typ !== 'block' ? 0 : Math.tan(Er(b, s).g * RAD));
  const xe = (b, s, z) => s * (b.b / 2 + tanG(b, s) * z); // ändens läge längs x vid tvärläget z
  function mans(b) { // brutet tak: nedre delens bredd mb och höjd mh
    const D = djup(b) / 2, ml = b.ml != null ? b.ml : 70, mb = Math.min(b.mb != null ? b.mb : 0.2 * D, 0.8 * D);
    return { ml, mb, mh: Math.min(mb * Math.tan(ml * RAD), 0.85 * b.th) };
  }
  const ytaRiktning = b => [Math.cos(b.tr || 0), Math.sin(b.tr || 0)];
  function ytaSpann(b) {
    const [ux, uz] = ytaRiktning(b), pr = b.pts.map(([x, z]) => x * ux + z * uz), mi = Math.min(...pr), ma = Math.max(...pr);
    return { pr, mi, L: Math.max(0.01, ma - mi) };
  }
  function lop(b) { // horisontell längd som lutningen räknas över
    if (b.typ === 'yta') return b.tak === 'pulpet' ? ytaSpann(b).L : null;
    const dd = djup(b);
    return { pulpet: dd, sadel: dd / 2, valv: dd / 2, pyramid: Math.min(b.b, b.d) / 2, kon: b.b / 2 }[b.tak] || null;
  }
  /** Takfallens lutning i grader (null för platt tak och kupol). */
  function lutning(b) {
    if (b.tak === 'mansard') { const m = mans(b), D = djup(b) / 2; return Math.atan((b.th - m.mh) / (D - m.mb)) / RAD; }
    return lop(b) ? Math.atan(b.th / lop(b)) / RAD : null;
  }
  /** Takhöjden som ger lutningen g grader (prototypens satLutning). */
  function takhojdFor(b, g) {
    g = klamp(g, 1, 80);
    if (b.tak === 'mansard') { const m = mans(Object.assign({}, b, { th: 999 })), D = djup(b) / 2; return Math.round((m.mh + (D - m.mb) * Math.tan(g * RAD)) * 100) / 100; }
    return lop(b) ? Math.round(lop(b) * Math.tan(g * RAD) * 100) / 100 : b.th;
  }
  function profil(b) { // takets tvärsnitt [z, y] från främre takfoten (+z) till bakre
    const D = djup(b) / 2, t = b.th;
    if (b.tak === 'sadel') return [[D, 0], [0, t], [-D, 0]];
    if (b.tak === 'pulpet') return [[D, 0], [-D, t], [-D, 0]];
    if (b.tak === 'mansard') { const m = mans(b); return [[D, 0], [D - m.mb, m.mh], [0, t], [-(D - m.mb), m.mh], [-D, 0]]; }
    if (b.tak === 'valv') { const p = []; for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; p.push([D * Math.cos(a), i === 0 || i === 24 ? 0 : t * Math.sin(a)]); } return p; }
    return null;
  }
  function runAt(b, y) { // horisontellt avstånd från takfoten där takfallet når höjden y
    const D = djup(b) / 2, t = b.th;
    if (b.tak === 'pulpet') return 2 * D * y / t;
    if (b.tak === 'mansard') { const m = mans(b); return y <= m.mh ? m.mb * y / m.mh : m.mb + (D - m.mb) * (y - m.mh) / (t - m.mh); }
    if (b.tak === 'valv') return D - D * Math.cos(Math.asin(Math.min(1, y / t)));
    return D * y / t;
  }
  function inset(b, s, y) { // hur långt in från gaveln takytan ligger på höjden y
    const e = Er(b, s), y0 = e.k * b.th;
    if (e.typ === 'gavel' || y <= y0 + 1e-9) return 0;
    return e.typ === 'tak' ? runAt(b, y) - runAt(b, y0) : (y - y0) / Math.tan(Math.max(5, Math.min(89.9, e.lut)) * RAD);
  }
  function takKedjor(b) { // takets två ändkedjor A (−x) och B (+x) längs tvärsnittet
    const P0 = profil(b); if (!P0) return null;
    const niv = [...new Set([-1, 1].map(s => Er(b, s)).filter(e => e.typ !== 'gavel' && e.k > 0).map(e => e.k * b.th))];
    const P = [P0[0]];
    for (let i = 1; i < P0.length; i++) {
      const [za, ya] = P0[i - 1], [zb, yb] = P0[i];
      for (const y of niv.sort((p, q) => (yb > ya ? p - q : q - p))) if ((y - ya) * (y - yb) < -1e-9) { const f = (y - ya) / (yb - ya); P.push([za + f * (zb - za), y]); }
      P.push(P0[i]);
    }
    const A = [], Bk = [];
    for (const [z, y] of P) {
      const xa = xe(b, -1, z), xb = xe(b, 1, z), L = Math.max(0, xb - xa);
      let ia = inset(b, -1, y), ib = inset(b, 1, y);
      if (ia + ib > L) { const f = L / (ia + ib); ia *= f; ib *= f; }
      A.push([xa + ia, y, z]); Bk.push([xb - ib, y, z]);
    }
    let top = 0; P.forEach((p, i) => { if (p[1] > P[top][1] + 1e-9) top = i; });
    return { A, Bk, top };
  }
  function blixtlas(k, ytor) { // ändytan i band nerifrån och upp, så att halvvalm och brutna ändar blir rätt plan
    let i = 0, j = k.length - 1;
    while (j - i > 1) {
      const ni = i + 1, nj = j - 1;
      if (ni === nj || k[ni][1] <= k[nj][1]) { ytor.push([k[i], k[j], k[ni]]); i = ni; } else { ytor.push([k[i], k[j], k[nj]]); j = nj; }
    }
  }
  /** Ett varv av punkter [x, z] med n hörn och radien R, som prototypens cirkel (sin, cos). */
  const cirkel = (R, n) => Array.from({ length: n }, (_, i) => [Math.sin(2 * Math.PI * i / n) * R, Math.cos(2 * Math.PI * i / n) * R]);
  /** Den runda cylinderns varv: samma hörn som Volym3D:s fotavtryck (u = r·cos a, v = r·sin a, lz = −v). */
  const rundVarv = R => Array.from({ length: RUND }, (_, i) => { const a = (i + 0.5) / RUND * 2 * Math.PI; return [R * Math.cos(a), -R * Math.sin(a)]; });
  const cylVarv = b => (b.n ? cirkel(b.b / 2, b.n) : rundVarv(b.b / 2));
  /** Takets ytor (lokalt, y från takfoten) som listor av punkter [x, y, z]. */
  function takYtor(b) {
    const B = b.b / 2, D = b.d / 2, t = b.th;
    if (b.tak === 'platt' || !(t > 0)) return null;
    if (b.tak === 'kon') { const P = cylVarv(b), ytor = []; P.forEach((p, i) => { const q = P[(i + 1) % P.length]; ytor.push([[p[0], 0, p[1]], [q[0], 0, q[1]], [0, t, 0]]); }); return ytor; }
    if (b.tak === 'kupol') {
      // halvsfär skalad till takhöjden: ringar från takfoten upp mot toppen
      const P = cylVarv(b), R = b.b / 2, ringar = 12, ytor = [];
      const pt = (p, k) => { const a = Math.PI / 2 * k / ringar, f = Math.cos(a); return [p[0] * f, t * Math.sin(a), p[1] * f]; };
      for (let k = 0; k < ringar; k++) P.forEach((p, i) => {
        const q = P[(i + 1) % P.length];
        if (k === ringar - 1) ytor.push([pt(p, k), pt(q, k), [0, t, 0]]);
        else ytor.push([pt(p, k), pt(q, k), pt(q, k + 1), pt(p, k + 1)]);
      });
      void R;
      return ytor;
    }
    if (b.tak === 'pyramid') { const T = [0, t, 0]; return [[[-B, 0, D], [B, 0, D], T], [[B, 0, D], [B, 0, -D], T], [[B, 0, -D], [-B, 0, -D], T], [[-B, 0, -D], [-B, 0, D], T]]; }
    const K = takKedjor(b); if (!K) return null;
    const ytor = [];
    for (let i = 0; i < K.A.length - 1; i++) ytor.push([K.A[i], K.Bk[i], K.Bk[i + 1], K.A[i + 1]]);
    blixtlas(K.A, ytor); blixtlas(K.Bk, ytor);
    return ytor;
  }

  // ------------------------------------------------------------------
  // Fotavtryck, gård, mur och polygon
  // ------------------------------------------------------------------
  function ytterPts(b) {
    if (b.typ === 'cylinder') return cylVarv(b);
    const D = b.d / 2; return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, c]) => [xe(b, a, c * D), c * D]);
  }
  function gardHal(b) {
    const hd = hdv(b);
    if (b.typ === 'cylinder') {
      const n = b.n || RUND, R = b.b / 2 - hd / Math.cos(Math.PI / n);
      return b.n ? cirkel(R, n) : rundVarv(R);
    }
    const X = b.b / 2 - hd, Z = b.d / 2 - hd; return [[-X, -Z], [X, -Z], [X, Z], [-X, Z]];
  }
  const gardFlagga = (b, sx, sz) => ((b.gard.gavlar || {})[sx + ',' + sz]) || { x: false, z: false };
  // Innergården byggs av längor med samma husdjup. Gerade hörn: alla längor geras (45° i fyrkant, 180°/n i ett n-hörn),
  // så att takfallen möts i grat utåt och vinkelränna inåt. Med gavlar: långsidorna går hela vägen med gavlar i ändarna.
  function vingar(b) {
    const hd = hdv(b), ut = [], ger = g => Object.assign({}, ANDE0, { g });
    const v = (len, ea, eb) => ({ typ: 'block', b: len, d: hd, h: b.h, th: b.th, tak: b.tak, ml: b.ml, mb: b.mb, ea, eb });
    if (b.typ === 'cylinder') {
      const n = b.n || RUND, ac = b.b / 2 * Math.cos(Math.PI / n) - hd / 2;
      for (let i = 0; i < n; i++) { const f = 2 * Math.PI * (i + 0.5) / n; ut.push({ lx: Math.sin(f) * ac, lz: Math.cos(f) * ac, r: f, w: v(2 * ac * Math.tan(Math.PI / n), ger(180 / n), ger(180 / n)) }); }
      return ut;
    }
    // Rektangel: varje hörn har två möjliga gavelspetsar, x (längan i x-led går igenom) och z. Ingen = gerat hörn.
    const B = b.b / 2, D = b.d / 2, cl = hd / 2;
    const xEnd = (sx, sz) => { const f = gardFlagga(b, sx, sz); return f.x ? { p: sx * B, g: 0 } : { p: sx * (B - cl), g: f.z ? 0 : 45 }; };
    const zEnd = (sx, sz) => { const f = gardFlagga(b, sx, sz); return f.z ? { p: sz * D, g: 0 } : { p: sz * (D - cl), g: f.x ? 0 : 45 }; };
    for (const sz of [1, -1]) {
      const a = xEnd(-1, sz), c = xEnd(1, sz);
      ut.push({ lx: (a.p + c.p) / 2, lz: sz * (D - cl), r: sz > 0 ? 0 : Math.PI, w: sz > 0 ? v(c.p - a.p, ger(a.g), ger(c.g)) : v(c.p - a.p, ger(c.g), ger(a.g)) });
    }
    for (const sx of [1, -1]) {
      const f = zEnd(sx, 1), k = zEnd(sx, -1);
      ut.push({ lx: sx * (B - cl), lz: (f.p + k.p) / 2, r: sx * Math.PI / 2, w: sx > 0 ? v(f.p - k.p, ger(f.g), ger(k.g)) : v(f.p - k.p, ger(k.g), ger(f.g)) });
    }
    return ut;
  }
  // Murens två sidor, med gerade skarvar i brytpunkterna
  function murKant(b) {
    const P = b.pts, n = P.length, t = b.t / 2, L = [], R = [];
    const nrm = (a, c) => { const dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; };
    for (let i = 0; i < n; i++) {
      let v;
      if (i === 0) v = nrm(P[0], P[1]); else if (i === n - 1) v = nrm(P[n - 2], P[n - 1]);
      else {
        const a = nrm(P[i - 1], P[i]), c = nrm(P[i], P[i + 1]); let mx = a[0] + c[0], mz = a[1] + c[1]; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
        const k = 1 / Math.max(0.25, mx * a[0] + mz * a[1]); v = [mx * k, mz * k];
      }
      L.push([P[i][0] + v[0] * t, P[i][1] + v[1] * t]); R.push([P[i][0] - v[0] * t, P[i][1] - v[1] * t]);
    }
    return { L, R };
  }
  const fpR = b => { const R = b.b / 2, h = Math.min(b.h, b.b); return h >= R ? R : Math.sqrt(Math.max(0, R * R - (R - h) * (R - h))); }; // sfärens fotavtryck
  /** Fotavtrycket lokalt: [[ytter, ...hål], …] i [lx, lz] (prototypens fotPolys före l2w). */
  function fotLokalt(b) {
    if (b.typ === 'mur') { if (!b.pts || b.pts.length < 2) return []; const { L, R } = murKant(b); return [[[...L, ...R.reverse()]]]; }
    if (b.typ === 'yta' || b.typ === 'polygon') return b.pts && b.pts.length >= 3 ? [[b.pts]] : [];
    if (b.typ === 'sfar') return [[cirkel(fpR(b), 64)]];
    if (b.typ === 'cylinder' && !b.gard) return [[cylVarv(b)]];
    return [[ytterPts(b), ...(b.gard ? [gardHal(b)] : [])]];
  }

  // ------------------------------------------------------------------
  // Ytor till trianglar
  // ------------------------------------------------------------------
  // relativt första hörnet: zonens stora koordinater ger annars stora avrundningsfel
  const arean = P => { if (!P.length) return 0; const [ox, oy] = P[0]; let a = 0; for (let i = 0; i < P.length; i++) { const q = P[(i + 1) % P.length]; a += (P[i][0] - ox) * (q[1] - oy) - (q[0] - ox) * (P[i][1] - oy); } return a / 2; };
  /** Örontriangulering av en enkel polygon [[x, y], …]. Ger index i polygonen. */
  function triangulera(P) {
    const n = P.length;
    if (n < 3) return [];
    const ix = [...Array(n).keys()];
    if (arean(P) < 0) ix.reverse();
    const ut = [];
    const kors = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const inne = (p, a, b, c) => kors(a, b, p) >= -1e-12 && kors(b, c, p) >= -1e-12 && kors(c, a, p) >= -1e-12;
    let varv = 0;
    while (ix.length > 3 && varv < n * n) {
      let tog = false;
      for (let i = 0; i < ix.length; i++) {
        const a = P[ix[(i + ix.length - 1) % ix.length]], b = P[ix[i]], c = P[ix[(i + 1) % ix.length]];
        if (kors(a, b, c) <= 1e-12) continue;
        let ok = true;
        for (let j = 0; j < ix.length && ok; j++) {
          const q = ix[j];
          if (q === ix[i] || q === ix[(i + ix.length - 1) % ix.length] || q === ix[(i + 1) % ix.length]) continue;
          if (inne(P[q], a, b, c)) ok = false;
        }
        if (!ok) continue;
        ut.push([ix[(i + ix.length - 1) % ix.length], ix[i], ix[(i + 1) % ix.length]]);
        ix.splice(i, 1); tog = true; break;
      }
      if (!tog) break;   // självkorsande: resten som solfjäder
      varv++;
    }
    for (let i = 1; i + 1 < ix.length; i++) ut.push([ix[0], ix[i], ix[i + 1]]);
    return ut;
  }
  /** Bygger trianglar: ytor är listor av punkter [x, y, z] (plana, konvexa eller som solfjäder). */
  function nyttNat() {
    const pos = [], index = [], del = [];
    const punkt = q => { pos.push(q[0], q[1], q[2]); return pos.length / 3 - 1; };
    const tri = (a, b, c, d) => {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      if (Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) < 1e-9) return;
      index.push(punkt(a), punkt(b), punkt(c)); del.push(d);
    };
    return {
      pos, index, del,
      yta(y, d) { for (let i = 1; i < y.length - 1; i++) tri(y[0], y[i], y[i + 1], d); },
      /** Plan yta på höjden h (lokalt y) med polygonen P [[x, z]] och hål (index-lika varv, som gården). */
      lock(P, hal, h, d) {
        if (hal && hal.length === P.length) { P.forEach((p, i) => { const j = (i + 1) % P.length; this.yta([[p[0], h, p[1]], [P[j][0], h, P[j][1]], [hal[j][0], h, hal[j][1]], [hal[i][0], h, hal[i][1]]], d); }); return; }
        for (const [a, b, c] of triangulera(P)) tri([P[a][0], h, P[a][1]], [P[b][0], h, P[b][1]], [P[c][0], h, P[c][1]], d);
      },
      /** Lodräta väggar runt polygonen från y0 till y1 (tal eller funktion av punkten). */
      vaggar(P, y0, y1, d) {
        const f = g => (typeof g === 'function' ? g : () => g);
        const a0 = f(y0), a1 = f(y1);
        P.forEach((p, i) => { const q = P[(i + 1) % P.length]; this.yta([[p[0], a0(p), p[1]], [q[0], a0(q), q[1]], [q[0], a1(q), q[1]], [p[0], a1(p), p[1]]], d); });
      },
    };
  }

  // ------------------------------------------------------------------
  // Kroppens mesh, lokalt
  // ------------------------------------------------------------------
  /** Prisma: fotavtryck P (med hål) från y0 till y1, med lock nertill och upptill (lockUpp: false = taket stänger). */
  function prisma(nat, P, hal, y0, y1, d, { lockNer = true, lockUpp = true } = {}) {
    nat.vaggar(P, y0, y1, d);
    if (hal) nat.vaggar(hal, y0, y1, d);
    if (lockNer) nat.lock(P, hal, y0, d === 'sockel' ? 'sockel' : 'botten');
    if (lockUpp) nat.lock(P, hal, y1, d);
  }
  /** Lägger till en annan kropps ytor flyttade och vridna (prototypens rotateY(r) och translate). */
  function vridYtor(ytor, r, lx, lz, dy = 0) {
    const c = Math.cos(r), s = Math.sin(r);
    return ytor.map(y => y.map(([x, h, z]) => [lx + x * c + z * s, h + dy, lz - x * s + z * c]));
  }
  /**
   * Kroppens ytor lokalt (lx, y från golvet, lz), med del. mH(lx, lz) = marken i punkten minus golvet
   * (för mur och sockel), eller null utan terräng. sockel = djupet under golvet (0 = ingen).
   */
  function lokalaYtor(b, { mH = null, sockel = 0 } = {}) {
    const nat = nyttNat();
    if (b.typ === 'mur') {
      if (!b.pts || b.pts.length < 2) return nat;
      const m = mH || (() => 0);
      const { L, R } = murKant(b), P = b.pts, snitt = [];
      for (let i = 0; i < P.length - 1; i++) {
        const len = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]), n = b.topp === 'rak' ? 1 : Math.max(1, Math.ceil(len));
        const ta = m(...P[i]) + b.h, tb = m(...P[i + 1]) + b.h;
        for (let j = i ? 1 : 0; j <= n; j++) {
          const f = j / n, ip = (A, C) => [A[0] + f * (C[0] - A[0]), A[1] + f * (C[1] - A[1])];
          const l = ip(L[i], L[i + 1]), r = ip(R[i], R[i + 1]), top = q => (b.topp === 'rak' ? ta + f * (tb - ta) : m(...q) + b.h);
          snitt.push({ l: [l[0], m(...l), l[1]], lt: [l[0], top(l), l[1]], r: [r[0], m(...r), r[1]], rt: [r[0], top(r), r[1]] });
        }
      }
      for (let k = 0; k < snitt.length - 1; k++) {
        const a = snitt[k], c = snitt[k + 1];
        nat.yta([a.lt, a.rt, c.rt, c.lt], 'vagg'); nat.yta([a.l, c.l, c.lt, a.lt], 'vagg'); nat.yta([a.r, a.rt, c.rt, c.r], 'vagg'); nat.yta([a.l, a.r, c.r, c.l], 'botten');
      }
      const f0 = snitt[0], f1 = snitt[snitt.length - 1];
      nat.yta([f0.l, f0.lt, f0.rt, f0.r], 'vagg'); nat.yta([f1.l, f1.r, f1.rt, f1.lt], 'vagg');
      return nat;
    }
    if (b.typ === 'yta') {
      if (!b.pts || b.pts.length < 3) return nat;
      const P = b.pts;
      if (b.tak === 'pulpet' && b.th > 0) {
        const { pr, mi, L } = ytaSpann(b), top = P.map((p, i) => b.h + b.th * (pr[i] - mi) / L);
        P.forEach((p, i) => { const j = (i + 1) % P.length, q = P[j]; nat.yta([[p[0], 0, p[1]], [q[0], 0, q[1]], [q[0], top[j], q[1]], [p[0], top[i], p[1]]], 'vagg'); });
        for (const [a, c, d] of triangulera(P)) {
          nat.yta([[P[a][0], 0, P[a][1]], [P[c][0], 0, P[c][1]], [P[d][0], 0, P[d][1]]], 'botten');
          nat.yta([[P[a][0], top[a], P[a][1]], [P[c][0], top[c], P[c][1]], [P[d][0], top[d], P[d][1]]], 'tak');
        }
      } else prisma(nat, P, null, 0, b.h, 'vagg');
      return nat;
    }
    if (b.typ === 'sfar') {
      // klotet: R = b/2, synlig höjd h (högst b), botten där klotet möter golvet
      const R = b.b / 2, h = Math.min(b.h, b.b), th = Math.acos(klamp((R - h) / R, -1, 1)), N = 48, M = 24;
      const pt = (i, j) => { const phi = th * j / M, a = 2 * Math.PI * i / N; return [R * Math.sin(phi) * Math.sin(a), h - R + R * Math.cos(phi), R * Math.sin(phi) * Math.cos(a)]; };
      for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) nat.yta([pt(i, j), pt(i, j + 1), pt(i + 1, j + 1), pt(i + 1, j)], 'vagg');
      if (h < b.b - 0.01) nat.lock(cirkel(fpR(b), N).map((p, i) => pt(i, M)).map(q => [q[0], q[2]]), null, 0, 'botten');
      return nat;
    }
    if (b.typ === 'polygon') return nat;   // fritt fotavtryck: taket räknas i Volym3D (plan, takytor)
    // block och cylinder, med eller utan gård
    const ytter = ytterPts(b), hal = b.gard ? gardHal(b) : null;
    const tak = b.gard ? (b.tak !== 'platt' ? vingar(b).flatMap(v => { const t = takYtor(v.w); return t ? vridYtor(t, v.r, v.lx, v.lz, b.h) : []; }) : null)
      : (() => { const t = takYtor(b); return t ? t.map(y => y.map(([x, h, z]) => [x, h + b.h, z])) : null; })();
    // taket stänger kroppen upptill och sockeln nertill, så att meshen blir sluten utan ytor inuti
    const harSockel = sockel > 0.01;
    prisma(nat, ytter, hal, 0, b.h, 'vagg', { lockUpp: !tak, lockNer: !harSockel });
    if (tak) for (const y of tak) nat.yta(y, 'tak');
    if (harSockel) prisma(nat, ytter, hal, -sockel, 0, 'sockel', { lockUpp: false });
    return nat;
  }

  // ------------------------------------------------------------------
  // Utåtvända normaler: en stråle från varje triangel räknar korsningar (udda = inåt)
  // ------------------------------------------------------------------
  function stråleTräffar(pos, index, o, d, utom) {
    let n = 0;
    for (let t = 0; t < index.length; t += 3) {
      if (t === utom) continue;
      const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
      const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
      const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
      if (Math.abs(det) < 1e-12) continue;
      const s = [o[0] - pos[a], o[1] - pos[a + 1], o[2] - pos[a + 2]], u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) / det;
      if (u < 0 || u > 1) continue;
      const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], w = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
      if (w < 0 || u + w > 1) continue;
      if ((e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det > 1e-7) n++;
    }
    return n;
  }
  function orientera(pos, index) {
    // en sned riktning, så att strålen inte går längs kanter och ytor
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
      const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
      let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const l = Math.hypot(...n); if (l < 1e-12) continue; n = n.map(x => x / l);
      const m = [(pos[a] + pos[b] + pos[c]) / 3, (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3, (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3];
      let d = [n[0] + 0.0123, n[1] + 0.0371, n[2] + 0.0217]; const dl = Math.hypot(...d); d = d.map(x => x / dl);
      const o = [m[0] + n[0] * 1e-6, m[1] + n[1] * 1e-6, m[2] + n[2] * 1e-6];
      if (stråleTräffar(pos, index, o, d, t) % 2 === 1) { const x = index[t + 1]; index[t + 1] = index[t + 2]; index[t + 2] = x; }
    }
  }

  // ------------------------------------------------------------------
  // Härledd geometri i zonen
  // ------------------------------------------------------------------
  /**
   * Fotavtryck och mesh i zonen för volymen v (med primitiv). opt.markH(x, y) = marken (RH 2000) i en
   * punkt i zonen, för mur, sockel och muren som följer marken. Utan markH är marken lika med golvet.
   */
  function harledd(v, opt = {}) {
    const p = v.primitiv || {}, b = tillProto(v);
    const x0 = tal(p.x, 0), y0 = tal(p.y, 0), r = (tal(p.vrid, 0) + (b.vridTill || 0)) * RAD, c = Math.cos(r), s = Math.sin(r);
    const golv = tal(v.golv, 0);
    const tillZon = (lx, lz) => [x0 + lx * c + lz * s, y0 + lx * s - lz * c];
    const ringar = fotLokalt(b).map(pol => pol.map((ring, k) => {
      const z = ring.map(([lx, lz]) => tillZon(lx, lz));
      return (arean(z) > 0) === (k === 0) ? z : z.reverse();
    }));
    const markH = typeof opt.markH === 'function' ? opt.markH : null;
    const mH = markH ? (lx, lz) => { const q = tillZon(lx, lz), h = markH(q[0], q[1]); return (isFinite(h) ? h : golv) - golv; } : null;
    let sockel = 0;
    if (typeof v.sockel === 'number' && isFinite(v.sockel)) sockel = Math.max(0, v.sockel);
    else if (markH && !p.pa && (b.typ === 'block' || b.typ === 'cylinder' || b.typ === 'polygon')) {
      // automatisk: till lägsta marken under kroppen, och en halv meter ner i den
      let m = Infinity;
      for (const pol of ringar) for (const q of pol[0]) { const h = markH(q[0], q[1]); if (isFinite(h)) m = Math.min(m, h); }
      if (isFinite(m)) sockel = Math.max(0, golv - (m - 0.5));
    }
    const nat = lokalaYtor(b, { mH, sockel });
    const pos = new Array(nat.pos.length);
    for (let i = 0; i < nat.pos.length; i += 3) {
      const [E, N] = tillZon(nat.pos[i], nat.pos[i + 2]);
      pos[i] = E; pos[i + 1] = N; pos[i + 2] = golv + nat.pos[i + 1];
    }
    const index = nat.index.slice();
    orientera(pos, index);
    let topp = golv + b.h;
    for (let i = 2; i < pos.length; i += 3) topp = Math.max(topp, pos[i]);
    return { typ: b.typ, ringar, mesh: { pos, index, del: nat.del.slice() }, golv, topp, sockel };
  }
  /** Taket (högsta ytan) i (x, y), ur meshen. null utanför kroppen. */
  function hojdVid(h, x, y) {
    const { pos, index } = h.mesh;
    let best = null;
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
      const ax = pos[a], ay = pos[a + 1], bx = pos[b], by = pos[b + 1], cx = pos[c], cy = pos[c + 1];
      if (x < Math.min(ax, bx, cx) - 1e-9 || x > Math.max(ax, bx, cx) + 1e-9 || y < Math.min(ay, by, cy) - 1e-9 || y > Math.max(ay, by, cy) + 1e-9) continue;
      const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(d) < 1e-12) continue;   // lodrät
      const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d, l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d, l3 = 1 - l1 - l2;
      if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
      const z = l1 * pos[a + 2] + l2 * pos[b + 2] + l3 * pos[c + 2];
      if (best == null || z > best) best = z;
    }
    return best;
  }
  /** Volymen (m³) som meshen innesluter, med divergenssatsen (kräver en sluten mesh med utåtvända normaler). */
  function volym(h) {
    const { pos, index } = h.mesh;
    const [ox, oy, oz] = [pos[0] || 0, pos[1] || 0, pos[2] || 0];
    let V = 0;
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
      const A = [pos[a] - ox, pos[a + 1] - oy, pos[a + 2] - oz], B = [pos[b] - ox, pos[b + 1] - oy, pos[b + 2] - oz], C = [pos[c] - ox, pos[c + 1] - oy, pos[c + 2] - oz];
      V += A[0] * (B[1] * C[2] - B[2] * C[1]) - A[1] * (B[0] * C[2] - B[2] * C[0]) + A[2] * (B[0] * C[1] - B[1] * C[0]);
    }
    return V / 6;
  }
  /** Fotavtryckets area (m²), hål avdragna. */
  const area = h => h.ringar.reduce((s, pol) => s + Math.abs(arean(pol[0])) - pol.slice(1).reduce((t, x) => t + Math.abs(arean(x)), 0), 0);

  return { TYPER, TAK, FORMER, RUND, tillProto, lutning, takhojdFor, harledd, hojdVid, volym, area, triangulera };
}));
