// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Byggnadskroppar (0.14.0): skissens volymer med det som en situationsplan behöver. Ren geometri utan
 * DOM, så att den kan testas i Node. Planvyn (js/planvy.js) ritar och ändrar kropparna, 3D-vyn
 * (js/vy3d.js) gör det som förut.
 *
 * En kropp är en volym ({ id, namn, fotavtryck, golv, takfot, takform, taklutning, nockriktning, primitiv },
 * se js/volym3d.js) med fyra fält till:
 *   status        'ny' | 'befintlig' | 'tillbyggnad' | 'rivs' (saknas = 'ny')
 *   huvudbyggnad  true ritar krysset över kroppen, som på en situationsplan
 *   kalla         Lantmäteriets objektidentitet när kroppen är tagen ur en befintlig byggnad; huset
 *                 ersätts då av kroppen i 3D-vyn och analyserna
 *   entre         { sida, t }: entrépilen på fotavtryckets sida (index) och läget längs den (0–1)
 * golv är färdigt golv (FG) i RH 2000. Taksprång ritas inte: situationsplanen visar fasadlivet.
 *
 * Här finns också inmatningsraden (tolka), måtten till tomtgräns (gransmatt), måtten mellan kroppar
 * som ligger an mot varandra (relativaMatt), sidorna som får yttermått (yttermattSidor) och FG-texten.
 *
 * Kräver Volym3D (js/volym3d.js).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./volym3d.js'));
  else root.Kropp = factory(root.Volym3D);
}(typeof self !== 'undefined' ? self : this, function (V3) {
  'use strict';
  const RAD = Math.PI / 180;
  const STATUS = { ny: 'Ny', tillbyggnad: 'Tillbyggnad', befintlig: 'Befintlig', rivs: 'Rivs' };

  // ------------------------------------------------------------------
  // Vektorer och polygoner
  // ------------------------------------------------------------------
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]], mul = (a, s) => [a[0] * s, a[1] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1], len = a => Math.hypot(a[0], a[1]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
  const avrunda = (v, n = 3) => Math.round(v * 10 ** n) / 10 ** n;
  /** Arean med tecken (moturs positiv), räknad relativt första hörnet. */
  function area(p) {
    if (!p.length) return 0;
    const [ox, oy] = p[0];
    let a = 0;
    for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += (p[i][0] - ox) * (q[1] - oy) - (q[0] - ox) * (p[i][1] - oy); }
    return a / 2;
  }
  const moturs = p => (area(p) < 0 ? p.slice().reverse() : p.slice());
  /** Tar bort upprepade hörn (också en upprepad slutpunkt) och hörn mitt på en rak sida. */
  function rensa(pts, tol = 0.001) {
    let p = pts.filter((q, i) => { const r = pts[(i + 1) % pts.length]; return pts.length < 2 || len(sub(q, r)) > tol; });
    for (let andrat = true; andrat && p.length > 3;) {
      andrat = false;
      for (let i = 0; i < p.length && p.length > 3; i++) {
        const a = p[(i - 1 + p.length) % p.length], b = p[i], c = p[(i + 1) % p.length];
        const e = sub(c, a), l = len(e);
        if (l > 0 && Math.abs((b[0] - a[0]) * e[1] - (b[1] - a[1]) * e[0]) / l < tol && dot(sub(b, a), e) > 0 && dot(sub(c, b), e) > 0) { p.splice(i, 1); andrat = true; break; }
      }
    }
    return p;
  }
  /** Fotavtryckets sidor: { i, a, b, u (riktning), n (utåt för en moturs polygon), l }. */
  function sidor(fot) {
    const p = moturs(fot), ut = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], l = len(sub(b, a));
      if (l < 1e-9) continue;
      const u = mul(sub(b, a), 1 / l);
      ut.push({ i, a, b, u, n: [u[1], -u[0]], l });
    }
    return ut;
  }
  /** Om fotavtrycket är en rektangel (fyra räta hörn). */
  function arRektangel(p, tol = 0.01) {
    if (!p || p.length !== 4) return false;
    for (let i = 0; i < 4; i++) {
      const a = norm(sub(p[(i + 1) % 4], p[i])), b = norm(sub(p[(i + 2) % 4], p[(i + 1) % 4]));
      if (Math.abs(dot(a, b)) > tol) return false;
    }
    return true;
  }
  /** Fotpunkten på linjen genom a–b och läget t längs sträckan (0 i a, 1 i b). */
  function fot(c, a, b) {
    const e = sub(b, a), l2 = dot(e, e);
    const t = l2 ? dot(sub(c, a), e) / l2 : 0;
    return { t, f: add(a, mul(e, t)) };
  }
  const vinkel = u => ((Math.atan2(u[1], u[0]) / RAD) % 360 + 360) % 360;

  // ------------------------------------------------------------------
  // Kroppen
  // ------------------------------------------------------------------
  const status = v => (STATUS[v && v.status] ? v.status : 'ny');
  /** Fyller i fälten som en volym från cad-apa, DXF eller en äldre version saknar. Ändrar v. */
  function normalisera(v) {
    v.status = status(v);
    v.huvudbyggnad = !!v.huvudbyggnad;
    if (Array.isArray(v.fotavtryck) && area(v.fotavtryck) < 0) v.fotavtryck = v.fotavtryck.slice().reverse();
    if (v.kalla == null || v.kalla === '') v.kalla = null; else v.kalla = String(v.kalla);
    const e = v.entre;
    v.entre = e && Number.isInteger(e.sida) && e.sida >= 0 && e.sida < (v.fotavtryck || []).length && e.t >= 0 && e.t <= 1 ? { sida: e.sida, t: e.t } : null;
    return v;
  }
  /** Volymerna som analyserna räknar med: allt utom det som ska rivas. */
  const forAnalys = volymer => (volymer || []).filter(v => status(v) !== 'rivs');
  /** Lantmäteriets id för husen som ersatts av en kropp. */
  const ersatta = volymer => new Set((volymer || []).filter(v => v.kalla != null && v.kalla !== '').map(v => String(v.kalla)));

  /** Entrépilens läge och riktning ut från fasaden: { p, n } eller null. */
  function entrePunkt(v) {
    const e = v.entre, f = v.fotavtryck;
    if (!e || !f || e.sida >= f.length) return null;
    const a = f[e.sida], b = f[(e.sida + 1) % f.length], u = norm(sub(b, a));
    const n = area(f) >= 0 ? [u[1], -u[0]] : [-u[1], u[0]];
    return { p: add(a, mul(sub(b, a), e.t)), n };
  }
  /** Lägger entrén på den sida i det nya fotavtrycket som ligger närmast den gamla punkten. */
  function flyttaEntre(v, gammal) {
    if (!gammal) { v.entre = null; return v; }
    const f = v.fotavtryck;
    let bast = null;
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length], r = fot(gammal.p, a, b), t = Math.max(0, Math.min(1, r.t));
      const q = add(a, mul(sub(b, a), t)), d = len(sub(q, gammal.p));
      if (!bast || d < bast.d - 1e-6) bast = { d, sida: i, t: avrunda(t, 4) };
    }
    v.entre = bast ? { sida: bast.sida, t: bast.t } : null;
    return v;
  }
  /**
   * Gör ändringen fn(v). Flyttas eller vrids kroppen har sidorna samma ordning och entrén följer med.
   * Med sok = true kan hörnen ha fått ny ordning (formen är densamma); entrén läggs då på sidan
   * närmast där den var.
   */
  function andra(v, fn, sok = false) {
    const e = sok ? entrePunkt(v) : null;
    fn(v);
    if (e) flyttaEntre(v, e);
    else if (v.entre && v.entre.sida >= v.fotavtryck.length) v.entre = null;
    return v;
  }

  /**
   * Ny rektangulär kropp: hörnet a, axlarna ax/ay (enhetsvektorer) och sidorna lx, ly längs dem
   * (med tecken). mall = { id, namn, golv, takfot, takform, taklutning }.
   */
  function nyRektangel(a, ax, ay, lx, ly, mall) {
    const c = add(a, add(mul(ax, lx / 2), mul(ay, ly / 2)));
    const tak = mall.takform || 'sadel', typ = tak === 'platt' ? 'block' : 'prisma';
    const v = V3.ny({ typ, b: Math.abs(lx), d: Math.abs(ly), hojd: mall.takfot || 3, takform: tak, taklutning: tak === 'platt' ? 0 : (mall.taklutning != null ? mall.taklutning : 27), vrid: vinkel(ax) },
      avrunda(c[0]), avrunda(c[1]), mall.golv, mall.id, mall.namn);
    v.primitiv.golvAuto = false;
    return normalisera(Object.assign(v, { status: 'ny', huvudbyggnad: false, kalla: null, entre: null }));
  }
  /** Ny kropp med fritt fotavtryck (zonens koordinater). */
  function nyPolygon(pts, mall) {
    const v = { id: mall.id, namn: mall.namn, fotavtryck: moturs(rensa(pts)).map(p => [avrunda(p[0]), avrunda(p[1])]), golv: mall.golv,
      takfot: mall.takfot || 3, takform: 'platt', taklutning: 0, nockriktning: null, status: 'ny', huvudbyggnad: false, kalla: null, entre: null };
    V3.franVolym(v);
    v.primitiv.golvAuto = false;
    return v;
  }
  /** Kropp ur en befintlig byggnad från Lantmäteriet. Höjd och golv är skattade och kan ändras. */
  function franHus(b, mall) {
    const v = nyPolygon(b.fotavtryck, Object.assign({ takfot: b.hojd != null ? avrunda(b.hojd, 1) : 3 }, mall));
    v.golv = b.mark != null && isFinite(b.mark) ? avrunda(b.mark, 2) : mall.golv;
    v.status = 'befintlig';
    v.kalla = b.id != null ? String(b.id) : null;
    v.huvudbyggnad = !!b.huvudbyggnad;
    return v;
  }
  /** Nytt fotavtryck (hörnlistan, ett draget hörn): kroppen blir en polygon. */
  function satFotavtryck(v, pts) {
    const e = entrePunkt(v), lankar = v.primitiv ? (v.primitiv.lankar || []).slice() : [];
    const nock = v.nockriktning;
    v.fotavtryck = moturs(rensa(pts)).map(p => [avrunda(p[0]), avrunda(p[1])]);
    v.primitiv = null;
    V3.franVolym(v);
    v.primitiv.lankar = lankar;
    v.primitiv.nock0 = nock == null ? null : nock;
    V3.uppdatera(v);
    flyttaEntre(v, e);
    return v;
  }
  /**
   * Nya hörn för kroppen. Är den ett rätblock eller prisma och hörnen fortfarande en rektangel i samma
   * riktning ändras bara bredd, djup och mitt (så att 3D-vyn kan fortsätta ändra måtten); annars blir
   * kroppen en polygon.
   */
  function satHorn(v, pts) {
    const p = v.primitiv;
    if (p && (p.typ === 'block' || p.typ === 'prisma') && pts.length === 4 && arRektangel(pts)) {
      const r = (p.vrid || 0) * RAD, u = [Math.cos(r), Math.sin(r)], w = [-u[1], u[0]];
      const s0 = sub(pts[1], pts[0]), s1 = sub(pts[2], pts[1]);
      const parallell = Math.abs(dot(norm(s0), u)) > 0.9999 || Math.abs(dot(norm(s0), w)) > 0.9999;
      if (parallell) {
        const c = mul(pts.reduce((s, q) => add(s, q), [0, 0]), 1 / 4);
        const bu = Math.max(Math.abs(dot(s0, u)), Math.abs(dot(s1, u))), dw = Math.max(Math.abs(dot(s0, w)), Math.abs(dot(s1, w)));
        p.x = avrunda(c[0]); p.y = avrunda(c[1]); p.b = avrunda(bu, 4); p.d = avrunda(dw, 4);
        return andra(v, V3.uppdatera, true);
      }
    }
    return satFotavtryck(v, pts);
  }
  /** Byter takform. Ett rätblock blir ett prisma när taket får fall, och tvärtom. */
  function satTakform(v, form) {
    V3.franVolym(v);
    const p = v.primitiv;
    if (p.typ === 'block' && form !== 'platt') p.typ = 'prisma';
    else if (p.typ === 'prisma' && form === 'platt') p.typ = 'block';
    if (p.typ === 'cylinder' && form !== 'platt') return v;
    v.takform = form;
    if (form === 'platt') v.taklutning = 0;
    else if (!(v.taklutning > 0)) v.taklutning = form === 'pulpet' ? 10 : 27;
    if (p.typ === 'polygon' && form !== 'platt' && p.nock0 == null) p.nock0 = avrunda(V3.langsida(v.fotavtryck) - (p.vrid || 0), 4);
    return andra(v, V3.uppdatera, true);
  }
  /**
   * Val för nockens riktning (sadel, valm) eller högsidan (pulpet): en rad per riktning, längsta sidan först.
   * Ger [{ vinkel, text, vald }].
   */
  function nockVal(v) {
    const s = sidor(v.fotavtryck).sort((a, b) => b.l - a.l), ut = [], pulpet = v.takform === 'pulpet';
    const nu = v.nockriktning != null ? v.nockriktning : V3.langsida(v.fotavtryck);
    const lika = (a, b, mod) => { const d = ((a - b) % mod + mod) % mod; return Math.min(d, mod - d) < 0.5; };
    for (const sd of s) {
      const vk = avrunda(vinkel(sd.u), 2);
      if (ut.some(o => lika(o.vinkel, vk, pulpet ? 360 : 180))) continue;
      const nr = `${sd.i + 1}–${(sd.i + 1) % v.fotavtryck.length + 1}`;
      ut.push({ vinkel: vk, text: pulpet ? `Högt vid sida ${nr}` : `Längs sida ${nr}`, vald: false });
    }
    const vald = ut.find(o => lika(o.vinkel, nu, pulpet ? 360 : 180));
    if (vald) vald.vald = true;
    return ut;
  }
  /** Sätter nockens riktning (grader). Ett prisma vrids om så att bredden går längs nocken. */
  function satNock(v, grader) {
    V3.franVolym(v);
    const p = v.primitiv;
    return andra(v, () => {
      if (p.typ === 'prisma') {
        const d = (((grader - (p.vrid || 0)) % 180) + 180) % 180;
        if (Math.min(d, 180 - d) > 45) { const b = p.b; p.b = p.d; p.d = b; }
        p.vrid = avrunda(((grader % 360) + 360) % 360, 4);
      } else p.nock0 = avrunda(grader - (p.vrid || 0), 4);
      V3.uppdatera(v);
    }, true);
  }
  /** Flyttar kroppen (dx, dy). Länkade kroppar (kedjan i 3D-vyn) följer med. */
  function flytta(volymer, id, dx, dy) {
    const grupp = V3.komponent(volymer, id);
    volymer.filter(v => grupp.has(v.id)).forEach(v => andra(v, () => V3.flytta(v, dx, dy)));
  }
  /** Vrider kroppen (och länkade) grader moturs kring punkten c. */
  function vrid(volymer, id, grader, c) {
    const grupp = V3.komponent(volymer, id);
    volymer.filter(v => grupp.has(v.id)).forEach(v => andra(v, () => V3.vrid(v, grader, c[0], c[1])));
  }

  // ------------------------------------------------------------------
  // Inmatningsraden
  // ------------------------------------------------------------------
  /** Tal med decimalkomma eller punkt, och minustecken. */
  const tal = s => { const t = String(s).trim().replace(/\s+/g, '').replace('−', '-').replace(',', '.'); return /^[-+]?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : NaN; };
  /** Ett talpar: "a;b", "a b" eller (bara med @) "a,b". */
  function par(s, kommaDelar) {
    s = s.trim();
    let d = null;
    if (s.includes(';')) d = s.split(';');
    else if (/\S\s+\S/.test(s)) d = s.split(/\s+/);
    else if (kommaDelar && (s.match(/,/g) || []).length === 1) d = s.split(',');
    if (!d || d.length !== 2) return null;
    const a = tal(d[0]), b = tal(d[1]);
    return isFinite(a) && isFinite(b) ? [a, b] : null;
  }
  /**
   * Tolkar en rad i inmatningsraden. ctx = { bas (förra punkten eller null), axel (ritriktningen i
   * grader), mot (enhetsvektor mot markören, för en ensam längd) }. Vinklar och relativa mått räknas i
   * ritriktningens axlar.
   *   12,6 × 9 | 12,6x9 | 12,6*9        → { typ: 'matt', b, d } (rektangel)
   *   @3;4 | @3,4                       → { typ: 'punkt', p } relativt bas
   *   6<90                              → längd och vinkel från ritriktningen
   *   6                                 → längd mot markören
   *   153410;6432110 | 153410 6432110   → absoluta koordinater (E;N) när båda är stora
   * Ger null om raden inte går att tolka.
   */
  function tolka(text, ctx = {}) {
    const s = String(text || '').trim();
    if (!s) return null;
    const a = (ctx.axel || 0) * RAD, ax = [Math.cos(a), Math.sin(a)], ay = [-Math.sin(a), Math.cos(a)];
    const iAxlar = (x, y) => add(mul(ax, x), mul(ay, y));
    const m = s.toLowerCase().split(/\s*[x×*]\s*/);
    if (m.length === 2) {
      const b = tal(m[0]), d = tal(m[1]);
      return b > 0 && d > 0 ? { typ: 'matt', b, d } : null;
    }
    if (s.startsWith('@')) {
      const p = par(s.slice(1), true);
      if (!p) return null;
      return { typ: 'punkt', p: add(ctx.bas || [0, 0], iAxlar(p[0], p[1])), relativ: true };
    }
    if (s.includes('<')) {
      const [l, v] = s.split('<').map(tal);
      if (!isFinite(l) || !isFinite(v) || !ctx.bas) return null;
      const r = (ctx.axel + v) * RAD;
      return { typ: 'punkt', p: add(ctx.bas, mul([Math.cos(r), Math.sin(r)], l)) };
    }
    const p = par(s, false);
    if (p) {
      if (Math.abs(p[0]) > 1e4 && Math.abs(p[1]) > 1e4) return { typ: 'punkt', p, absolut: true };
      if (ctx.bas) return { typ: 'punkt', p: add(ctx.bas, iAxlar(p[0], p[1])), relativ: true };
      return null;
    }
    const l = tal(s);
    if (isFinite(l) && ctx.bas) return { typ: 'punkt', p: add(ctx.bas, mul(ctx.mot || ax, l)) };
    return null;
  }

  // ------------------------------------------------------------------
  // Mått
  // ------------------------------------------------------------------
  /** Gränslinjerna (polylinjer) som sträckor { a, b, u, g (gränsens index) } inom avst meter från punkten c. */
  function strackor(granser, c, avst = 80) {
    const ut = [];
    (granser || []).forEach((g, gi) => {
      const pts = g.pts || g;
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1], l = len(sub(b, a));
        if (l < 0.05) continue;
        const r = fot(c, a, b), t = Math.max(0, Math.min(1, r.t)), q = add(a, mul(sub(b, a), t));
        if (len(sub(q, c)) > avst) continue;
        ut.push({ a, b, u: mul(sub(b, a), 1 / l), g: gi, l });
      }
    });
    return ut;
  }
  /**
   * Bästa gräns utanför sidan sd: en gränssträcka som är ungefär parallell med sidan (inom 35°),
   * ligger utanför den och som sidans hörn kan mätas vinkelrätt mot (fotpunkten inom sträckan,
   * med lite marginal). Ger { s (sträckan), d (medelavståndet) } eller null.
   */
  function gransFor(sd, str) {
    let bast = null;
    const cosMax = Math.cos(35 * RAD);
    for (const s of str) {
      if (Math.abs(dot(s.u, sd.u)) < cosMax) continue;
      const fa = fot(sd.a, s.a, s.b), fb = fot(sd.b, s.a, s.b), fm = fot(mul(add(sd.a, sd.b), 0.5), s.a, s.b);
      const marg = 1.5 / s.l;
      if ([fa, fb, fm].every(r => r.t < -marg || r.t > 1 + marg)) continue;
      const da = dot(sub(fa.f, sd.a), sd.n), db = dot(sub(fb.f, sd.b), sd.n);
      if (da <= 0.05 || db <= 0.05) continue;
      const d = (da + db) / 2;
      if (!bast || d < bast.d) bast = { s, d };
    }
    return bast;
  }
  /** Ett mått från hörnet c vinkelrätt mot sträckan s. */
  function mattMot(c, s) { const r = fot(c, s.a, s.b); return { fran: c, till: r.f, d: len(sub(r.f, c)) }; }
  /**
   * Mått till tomtgräns för ett fotavtryck, mot två gränser: långsidan får två mått (från båda hörnen
   * mot gränsen utanför den) och kortsidan ett (från hörnet som den delar med långsidan, mot en annan
   * gräns). Två av måtten går alltså till samma hörn, som SKR:s exempel. Alla mått är vinkelräta mot
   * gränsen. Paret av sidor väljs så att måtten blir så korta som möjligt.
   * Finns ingen gräns som är parallell med sidorna blir det de tre kortaste vinkelräta måtten.
   * Ger [{ fran, till, d, sida }].
   */
  function gransmatt(fotavtryck, granser) {
    const sd = sidor(fotavtryck);
    if (sd.length < 3 || !granser || !granser.length) return [];
    const p = moturs(fotavtryck), c = mul(p.reduce((s, q) => add(s, q), [0, 0]), 1 / p.length);
    const str = strackor(granser, c);
    if (!str.length) return [];
    const bast = sd.map(s => gransFor(s, str));
    let val = null;
    for (let i = 0; i < sd.length; i++) {
      for (const j of [(i + 1) % sd.length, (i - 1 + sd.length) % sd.length]) {
        const L = sd[i], S = sd[j], bl = bast[i], bs = bast[j];
        if (!bl || !bs || L.l < S.l - 1e-6) continue;
        if (bl.s === bs.s || Math.abs(dot(bl.s.u, bs.s.u)) > Math.cos(20 * RAD)) continue;   // två olika gränser
        const poang = bl.d + bs.d - Math.min(L.l, 40) * 0.01;
        if (!val || poang < val.poang - 1e-9) val = { poang, i, j };
      }
    }
    if (val) {
      const L = sd[val.i], S = sd[val.j], gemensam = val.j === (val.i + 1) % sd.length ? L.b : L.a;
      const sl = bast[val.i].s, ss = bast[val.j].s;
      return [Object.assign(mattMot(L.a, sl), { sida: L.i }), Object.assign(mattMot(L.b, sl), { sida: L.i }), Object.assign(mattMot(gemensam, ss), { sida: S.i })];
    }
    // reserv: de tre kortaste vinkelräta måtten från hörnen
    const alla = [];
    p.forEach((h, i) => str.forEach(s => { const r = fot(h, s.a, s.b); if (r.t >= -0.001 && r.t <= 1.001) { const d = len(sub(r.f, h)); if (d > 0.05) alla.push({ fran: h, till: r.f, d, sida: i, s }); } }));
    alla.sort((a, b) => a.d - b.d);
    const ut = [];
    for (const m of alla) { if (ut.length >= 3) break; if (!ut.some(u => u.s === m.s && u.fran === m.fran)) ut.push(m); }
    return ut.map(m => ({ fran: m.fran, till: m.till, d: m.d, sida: m.sida }));
  }
  /**
   * Mått mellan kroppar som ligger an mot varandra (t.ex. en tillbyggnad mot huvudbyggnaden): längs
   * fogen, från den ena kroppens hörn till den andras, där de inte slutar i samma linje.
   * Ger [{ kropp (id), mot (id), fran, till, d, n (riktning bort från fogen, mot kroppens sida),
   *        ande (kroppens hörn), fast (den andra kroppens hörn) }]. Kroppen flyttas längs ande − fast för att
   *        ändra måttet.
   */
  function relativaMatt(volymer, tol = 0.03) {
    const ut = [];
    const lista = (volymer || []).filter(v => v.fotavtryck && v.fotavtryck.length >= 3);
    for (const A of lista) for (const B of lista) {
      if (A === B) continue;
      const sa = sidor(A.fotavtryck), sb = sidor(B.fotavtryck);
      for (const x of sa) for (const y of sb) {
        if (dot(x.u, y.u) > -0.9995) continue;                       // motriktade (fogen)
        if (Math.abs(dot(sub(x.a, y.a), y.n)) > tol || Math.abs(dot(sub(x.b, y.a), y.n)) > tol) continue;
        // läget längs B:s sida
        const ta = dot(sub(x.a, y.a), y.u), tb = dot(sub(x.b, y.a), y.u), lo = Math.min(ta, tb), hi = Math.max(ta, tb);
        if (Math.min(hi, y.l) - Math.max(lo, 0) < 0.1) continue;     // ingen gemensam fog
        // bara den mindre kroppen måttsätts mot den större (annars blir det dubbelt)
        if (Math.abs(area(A.fotavtryck)) > Math.abs(area(B.fotavtryck)) || (Math.abs(area(A.fotavtryck)) === Math.abs(area(B.fotavtryck)) && A.id > B.id)) continue;
        const P = t => add(y.a, mul(y.u, t)), n = mul(y.n, 1);   // B:s utsida = A:s sida
        if (Math.abs(lo) > 0.005) ut.push({ kropp: A.id, mot: B.id, fran: P(Math.min(0, lo)), till: P(Math.max(0, lo)), d: Math.abs(lo), n, ande: P(lo), fast: P(0) });
        if (Math.abs(hi - y.l) > 0.005) ut.push({ kropp: A.id, mot: B.id, fran: P(Math.min(hi, y.l)), till: P(Math.max(hi, y.l)), d: Math.abs(hi - y.l), n, ande: P(hi), fast: P(y.l) });
      }
    }
    return ut;
  }
  /** Sidor (index i det moturs ordnade fotavtrycket) som ligger an mot en annan kropp. */
  function fogsidor(v, volymer, tol = 0.03) {
    const ut = new Set();
    const sa = sidor(v.fotavtryck);
    for (const B of volymer || []) {
      if (B === v || !B.fotavtryck) continue;
      for (const x of sa) for (const y of sidor(B.fotavtryck)) {
        if (dot(x.u, y.u) > -0.9995) continue;
        if (Math.abs(dot(sub(x.a, y.a), y.n)) > tol || Math.abs(dot(sub(x.b, y.a), y.n)) > tol) continue;
        const ta = dot(sub(x.a, y.a), y.u), tb = dot(sub(x.b, y.a), y.u);
        if (Math.min(Math.max(ta, tb), y.l) - Math.max(Math.min(ta, tb), 0) >= 0.1) ut.add(x.i);
      }
    }
    return ut;
  }
  /**
   * Sidorna som får yttermått (index i det moturs ordnade fotavtrycket). En rektangel får en lång och en
   * kort sida, helst de som inte har mått till tomtgräns och inte ligger an mot en annan kropp; andra
   * former får alla sidor utom fogarna.
   */
  function yttermattSidor(v, volymer, gm) {
    const sd = sidor(v.fotavtryck), fog = fogsidor(v, volymer || []);
    if (!arRektangel(moturs(v.fotavtryck))) return sd.filter(s => !fog.has(s.i)).map(s => s.i);
    const upptagen = new Set((gm || []).map(m => m.sida));
    const ut = [];
    for (const par of [[0, 2], [1, 3]]) {
      const kand = par.map(i => sd[i]).filter(Boolean);
      kand.sort((a, b) => (fog.has(a.i) - fog.has(b.i)) || (upptagen.has(a.i) - upptagen.has(b.i)) || (b.n[1] - a.n[1]) || (a.n[0] - b.n[0]));
      if (kand.length && !fog.has(kand[0].i)) ut.push(kand[0].i);
    }
    return ut;
  }

  // ------------------------------------------------------------------
  // Texter och summor
  // ------------------------------------------------------------------
  /** Höjd i RH 2000 med decimalkomma, utan nolla på slutet: 32,8 eller 32,85. */
  const hojdText = h => (Math.round(h * 100) / 100).toFixed(2).replace(/0$/, '').replace(/\.0?$/, '').replace('.', ',').replace('-', '−');
  /** FG-texten: "FG +32,8", "FG lika bef" (en tillbyggnad med samma golv som den befintliga den sitter mot) eller "FG ?". */
  function fgText(v, volymer) {
    if (!(v.golv === v.golv) || v.golv == null) return 'FG ?';
    if (status(v) === 'tillbyggnad') {
      const fog = anliggande(v, volymer);
      if (fog.some(B => status(B) === 'befintlig' && B.golv != null && Math.abs(B.golv - v.golv) < 0.005)) return 'FG lika bef';
    }
    return `FG ${v.golv < 0 ? '' : '+'}${hojdText(v.golv)}`;
  }
  /** Kropparna som v ligger an mot. */
  function anliggande(v, volymer) {
    return (volymer || []).filter(B => B !== v && B.fotavtryck && fogsidor(v, [B]).size);
  }
  /** Byggnadsarea: { tillkommande (ny och tillbyggnad), befintlig (som står kvar), rivs, totalt (efter åtgärden) } i m². */
  function bya(volymer) {
    const s = { tillkommande: 0, befintlig: 0, rivs: 0 };
    for (const v of volymer || []) {
      const a = Math.abs(area(v.fotavtryck || []));
      const st = status(v);
      if (st === 'befintlig') s.befintlig += a; else if (st === 'rivs') s.rivs += a; else s.tillkommande += a;
    }
    s.totalt = s.tillkommande + s.befintlig;
    return s;
  }

  return {
    STATUS, status, normalisera, forAnalys, ersatta, area, moturs, rensa, sidor, arRektangel, vinkel,
    entrePunkt, flyttaEntre, andra, nyRektangel, nyPolygon, franHus, satFotavtryck, satHorn, satTakform, nockVal, satNock, flytta, vrid,
    tal, tolka, strackor, gransmatt, relativaMatt, fogsidor, anliggande, yttermattSidor, hojdText, fgText, bya,
  };
}));
