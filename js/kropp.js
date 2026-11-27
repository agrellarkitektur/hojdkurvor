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
    // takanslutningen (0.16.1): [bak, fram] i meter, bara när något är utdraget
    const d = v.takutdrag;
    if (Array.isArray(d) && d.length === 2 && d.every(x => typeof x === 'number' && x >= 0 && x <= 100) && (d[0] > 0 || d[1] > 0)) v.takutdrag = d.map(x => avrunda(x, 3));
    else delete v.takutdrag;
    if (!SLAG[v.slag]) delete v.slag;
    if (v.slag === 'huvud') v.huvudbyggnad = true;
    else if (v.slag) v.huvudbyggnad = false;
    return v;
  }
  /**
   * Hur kroppen redovisas i plan (0.16.1): 'huvud' (kryss), 'komplement' (nocklinje), 'skarmtak' (en diagonal)
   * eller '' (inget). huvudbyggnad följer med för äldre filer och cad-apa.
   */
  const SLAG = { huvud: 'Huvudbyggnad (kryss)', komplement: 'Komplementbyggnad (nock)', skarmtak: 'Skärmtak (diagonal)' };
  const slag = v => (v && SLAG[v.slag] ? v.slag : v && v.huvudbyggnad ? 'huvud' : '');
  function satSlag(v, s) {
    if (SLAG[s]) v.slag = s; else delete v.slag;
    v.huvudbyggnad = s === 'huvud';
    return v;
  }
  /**
   * Markeringen i plan (0.16.1), med indrag från hörnen: kryss för huvudbyggnad, en linje mellan gavlarnas
   * mitt för komplementbyggnad (längs nocken, eller längsta sidan) och en diagonal för skärmtak. Bara för
   * fyrhörningar. indrag i meter. Ger [[a, b], …].
   */
  function planmarke(v, indrag = 0.5) {
    const s = slag(v), f = moturs(v.fotavtryck || []);
    if (!s || f.length < 3) return [];
    const kort = (a, b) => {
      const d = sub(b, a), l = len(d);
      if (l < 3 * indrag) return [a, b];
      const e = mul(d, indrag / l);
      return [add(a, e), sub(b, e)];
    };
    const ri = v.nockriktning != null && v.takform && v.takform !== 'platt' ? v.nockriktning * RAD : null;
    const sd = sidor(f);
    const langs = ri != null ? [Math.cos(ri), Math.sin(ri)] : sd.slice().sort((a, b) => b.l - a.l)[0].u;
    // andra former än fyrhörningar (0.16.4, DG): linjerna i den omskrivna rektangeln längs nocken eller
    // längsta sidan, klippta mot fotavtrycket
    if (f.length !== 4) {
      const n = [-langs[1], langs[0]], lu = f.map(q => dot(q, langs)), ln = f.map(q => dot(q, n));
      const u0 = Math.min(...lu), u1 = Math.max(...lu), n0 = Math.min(...ln), n1 = Math.max(...ln);
      const P = (a, b) => add(mul(langs, a), mul(n, b));
      const linjer = s === 'huvud' ? [[P(u0, n0), P(u1, n1)], [P(u0, n1), P(u1, n0)]]
        : s === 'skarmtak' ? [[P(u0, n0), P(u1, n1)]]
        : [[P(u0, (n0 + n1) / 2), P(u1, (n0 + n1) / 2)]];
      return linjer.flatMap(([a, b]) => klippLinje(a, norm(sub(b, a)), [f]))
        .filter(([a, b]) => len(sub(b, a)) > 2 * indrag).map(([a, b]) => kort(a, b));
    }
    if (s === 'huvud') return [kort(f[0], f[2]), kort(f[1], f[3])];
    if (s === 'skarmtak') { const l0 = len(sub(f[2], f[0])), l1 = len(sub(f[3], f[1])); return [l0 >= l1 ? kort(f[0], f[2]) : kort(f[1], f[3])]; }
    // komplement: gavlarnas mitt, längs nocken om taket har fall, annars längs längsta sidan
    const gavlar = sd.slice().sort((a, b) => Math.abs(dot(a.u, langs)) - Math.abs(dot(b.u, langs))).slice(0, 2);
    const m = gavlar.map(x => mul(add(x.a, x.b), 0.5));
    return [kort(m[0], m[1])];
  }
  /** Delarna av linjen genom p i riktningen u som ligger inuti ringarna (jämn–udda). */
  function klippLinje(p, u, ringar) {
    const ts = [];
    for (const r of ringar) for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length], s = sub(b, a), q = u[0] * s[1] - u[1] * s[0];
      if (Math.abs(q) < 1e-12) continue;
      const w = sub(a, p), t = (w[0] * s[1] - w[1] * s[0]) / q, v = (w[0] * u[1] - w[1] * u[0]) / q;
      if (v >= 0 && v < 1) ts.push(t);
    }
    ts.sort((a, b) => a - b);
    const ut = [];
    for (let i = 0; i + 1 < ts.length; i += 2) if (ts[i + 1] - ts[i] > 1e-6) ut.push([add(p, mul(u, ts[i])), add(p, mul(u, ts[i + 1]))]);
    return ut;
  }
  /**
   * Krysset över en byggnad som rivs (0.16.4, DG): två linjer genom mitten, 45° mot norr oavsett hur
   * byggnaden är vriden, klippta mot ringarna och med indrag (meter) från kanten. Ger [[a, b], …].
   */
  function rivsKryss(ringar, indrag = 0.5) {
    const yt = (ringar || []).filter(r => r && r.length >= 3);
    if (!yt.length) return [];
    // mitten: ytans tyngdpunkt (den yttre ringen)
    const r0 = yt[0], A = area(r0);
    let cx = 0, cy = 0;
    for (let i = 0; i < r0.length; i++) { const a = r0[i], b = r0[(i + 1) % r0.length], k = a[0] * b[1] - b[0] * a[1]; cx += (a[0] + b[0]) * k; cy += (a[1] + b[1]) * k; }
    const c = Math.abs(A) > 1e-9 ? [cx / (6 * A), cy / (6 * A)] : r0[0];
    const ut = [];
    for (const u of [norm([1, 1]), norm([1, -1])]) for (const [a, b] of klippLinje(c, u, yt)) {
      const l = len(sub(b, a));
      if (l <= 2 * indrag) continue;
      const e = mul(u, indrag);
      ut.push([add(a, e), sub(b, e)]);
    }
    return ut;
  }
  /**
   * Dockar en tillbyggnad mot en befintlig fasad (0.16.4, DH): den sida i kroppen v som ligger närmast och
   * nästan motriktad (inom maxVinkel grader) mot en sida i mal (fotavtryck) vrids parallell och flyttas ut i
   * fasadlivet. maxAvst i meter. Ger { vrid (grader), c (vridpunkten), d: [dx, dy] } eller null. Ändrar inget.
   */
  function dockning(v, mal, { maxAvst = 1.5, maxVinkel = 12 } = {}) {
    const sa = sidor(v.fotavtryck);
    let bast = null;
    for (const f of mal || []) {
      if (!f || f.length < 3) continue;
      for (const y of sidor(f)) for (const x of sa) {
        const cs = -dot(x.u, y.u);
        if (cs < Math.cos(maxVinkel * RAD)) continue;
        const m = mul(add(x.a, x.b), 0.5), d = dot(sub(m, y.a), y.n);
        if (Math.abs(d) > maxAvst) continue;
        // sidorna ska överlappa längs fasaden
        const ta = dot(sub(x.a, y.a), y.u), tb = dot(sub(x.b, y.a), y.u);
        if (Math.min(Math.max(ta, tb), y.l) - Math.max(Math.min(ta, tb), 0) < 0.2) continue;
        if (!bast || Math.abs(d) < Math.abs(bast.dd)) bast = { x, y, m, dd: d };
      }
    }
    if (!bast) return null;
    const { x, y, m } = bast;
    // vinkeln som gör x motriktad y
    let vr = (Math.atan2(-y.u[1], -y.u[0]) - Math.atan2(x.u[1], x.u[0])) / RAD;
    while (vr > 180) vr -= 360;
    while (vr <= -180) vr += 360;
    // efter vridningen ligger m kvar; flytta m till fasadlivet
    const dist = dot(sub(m, y.a), y.n);
    return { vrid: Math.abs(vr) < 1e-7 ? 0 : vr, c: m, d: mul(y.n, -dist) };
  }
  /** Volymerna som 3D-vyn och analyserna räknar med: allt utom det som rivs, med taken utdragna (0.16.1). */
  const for3d = volymer => forAnalys(volymer).map(v => V3.utdragen(v));
  /**
   * Gavlarna där taket kan dras ut: [{ ande: 0 (bak) | 1 (fram), sida (index), text }] för kroppar med takfall.
   */
  function gavlar(v) {
    if (!V3.harTakfall(v)) return [];
    const ax = V3.nockAxel(v), f = v.fotavtryck, ut = [];
    for (const [ande, l] of [[0, ax.lmin], [1, ax.lmax]]) {
      let bast = -1, bl = 0;
      for (let i = 0; i < f.length; i++) {
        const j = (i + 1) % f.length;
        if (Math.abs(ax.lg[i] - l) < 0.01 && Math.abs(ax.lg[j] - l) < 0.01) { const sl = len(sub(f[j], f[i])); if (sl > bl) { bl = sl; bast = i; } }
      }
      ut.push({ ande, sida: bast, text: bast >= 0 ? `Gavel vid sida ${bast + 1}–${(bast + 1) % f.length + 1}` : ande ? 'Gavel fram' : 'Gavel bak' });
    }
    return ut;
  }
  /**
   * Drar ut taket vid de gavlar som ligger an mot en annan kropp, precis så långt att gavelns spets och
   * takfotens hörn hamnar inne i den andra kroppen (0.16.1). Ändrar v. Ger [bak, fram] (0 där inget behövs
   * eller går) och om något ändrades.
   */
  function anslutTak(v, volymer, { max = 40, steg = 0.05 } = {}) {
    if (!V3.harTakfall(v)) { delete v.takutdrag; return { utdrag: [0, 0], andrat: false }; }
    const andra = forAnalys(volymer).filter(o => o.id !== v.id && o.fotavtryck && o.fotavtryck.length >= 3);
    const ax = V3.nockAxel(v), u = ax.u, bas = v.golv + v.takfot, w = [-u[1], u[0]];
    const tm = (ax.tmin + ax.tmax) / 2, pl = V3.plan(v);
    const iAnnan = (x, y, z) => andra.some(o => V3.inutiVolym(o, x, y, z, 0.005));
    const utdrag = [0, 0];
    for (const ande of [0, 1]) {
      const l = ande ? ax.lmax : ax.lmin, s = ande ? 1 : -1;
      // punkterna på gaveln: spetsen (nockens ände), takfotens hörn och mitt på takfallen, strax innanför
      const t0 = ax.tmin + 0.03, t1 = ax.tmax - 0.03;
      const pa = (t, lp) => [u[0] * lp + w[0] * t, u[1] * lp + w[1] * t];
      const prov = [t0, (t0 + tm) / 2, tm, (tm + t1) / 2, t1].map(t => {
        const q = pa(t, l - s * 0.03);
        return { t, z: V3.hojdVid(v, q[0], q[1], pl) - 0.03 };
      }).map(o => ({ t: o.t, z: Math.max(bas + 0.02, o.z) }));
      // ligger gaveln an mot en annan kropp? (punkten strax utanför gavelns mitt i takfotens höjd)
      const ut0 = pa(tm, l + s * 0.1);
      if (!iAnnan(ut0[0], ut0[1], bas - 0.2)) continue;
      for (let d = 0; d <= max + 1e-9; d += steg) {
        if (prov.every(o => { const q = pa(o.t, l + s * d); return iAnnan(q[0], q[1], o.z); })) { utdrag[ande] = avrunda(d + 0.05, 2); break; }
      }
    }
    const fore = JSON.stringify(v.takutdrag || [0, 0]);
    if (utdrag[0] > 0 || utdrag[1] > 0) v.takutdrag = utdrag; else delete v.takutdrag;
    return { utdrag, andrat: fore !== JSON.stringify(v.takutdrag || [0, 0]) };
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
    // En kropp är en ring utan hål. Ett hus med innergård skulle få gården fylld (BYA, skal, skuggor och sol på
    // fasaderna), så det blir ingen kropp av det (0.16.3, P6 i granskningen 26 nov).
    if ((b.hal || []).some(h => Array.isArray(h) && h.length >= 3)) return null;
    const v = nyPolygon(b.fotavtryck, Object.assign({ takfot: b.hojd != null ? avrunda(b.hojd, 1) : 3 }, mall));
    v.golv = b.mark != null && isFinite(b.mark) ? avrunda(b.mark, 2) : mall.golv;
    v.status = 'befintlig';
    v.kalla = b.id != null ? String(b.id) : null;
    v.huvudbyggnad = !!b.huvudbyggnad;
    return v;
  }
  /** Nytt fotavtryck (hörnlistan, ett draget hörn): kroppen blir en polygon. */
  function satFotavtryck(v, pts) {
    if (V3.nyForm(v)) return v;
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
    // kroppar i den nya modellen (gård, mur, sfär, nya takformer …) ändras i 3D-vyn från 0.17.0; planvyn låter dem vara
    if (V3.nyForm(v)) return false;
    // ett hörn som dras över en annan sida ger ett fotavtryck som korsar sig självt: fel area och fel vända
    // fasader. Då ändras ingenting (0.16.3, granskningen 26 nov).
    if (korsarSig(pts)) return false;
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
    if (V3.nyStil(v.primitiv)) return v;   // taket på en ny kropp ändras i 3D-vyn (0.17.0)
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
    if (V3.nyStil(v.primitiv)) return v;
    V3.franVolym(v);
    delete v.takutdrag;   // utdraget gäller nockens riktning (0.16.1)
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
   * Ett mått från hörnet c ut från sidan sd mot gränsen: mot sträckan s om hörnets fotpunkt ligger på den,
   * annars mot en annan nästan parallell sträcka där fotpunkten hamnar (gränsen har en brytpunkt). Finns
   * ingen sådan blir det inget mått. Förut drogs måttet mot sträckans förlängning och kunde sluta utanför
   * gränsen (0.16.3, B2 i granskningen 26 nov).
   */
  function mattFran(c, sd, s, str) {
    const cosMax = Math.cos(35 * RAD), pa = t => { const e = 0.02 / t.l, r = fot(c, t.a, t.b); return r.t >= -e && r.t <= 1 + e ? r : null; };
    if (pa(s)) return mattMot(c, s);
    let bast = null;
    for (const t of str) {
      if (t === s || Math.abs(dot(t.u, sd.u)) < cosMax) continue;
      const r = pa(t);
      if (!r || dot(sub(r.f, c), sd.n) <= 0.05) continue;
      const d = len(sub(r.f, c));
      if (!bast || d < bast.d) bast = { fran: c, till: r.f, d };
    }
    return bast;
  }
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
      return [[L.a, L, sl], [L.b, L, sl], [gemensam, S, ss]].map(([c, sd, st]) => { const m = mattFran(c, sd, st, str); return m && Object.assign(m, { sida: sd.i }); })
        .filter(Boolean);
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
  /**
   * Vad en byggnad är, för koordinatlistan (0.16.4, DJ): "Ny huvudbyggnad", "Tillbyggnad huvudbyggnad",
   * "Befintlig komplementbyggnad" … kroppar = byggnadens kroppar. En tillbyggnad utan eget tecken tar slaget
   * från byggnaden den sitter mot.
   */
  function beskrivning(kroppar, volymer) {
    const ORD = { huvud: 'huvudbyggnad', komplement: 'komplementbyggnad', skarmtak: 'skärmtak' };
    const st = status(kroppar[0]);
    const slagAv = lista => { for (const k of ['huvud', 'komplement', 'skarmtak']) if (lista.some(v => slag(v) === k)) return k; return ''; };
    let s = slagAv(kroppar);
    if (!s && st === 'tillbyggnad') s = slagAv(kroppar.flatMap(k => anliggande(k, volymer)).filter(v => status(v) !== 'tillbyggnad'));
    const ord = ORD[s] || 'byggnad';
    if (st === 'tillbyggnad') return `Tillbyggnad ${ord}`;
    if (st === 'rivs') return `${ord[0].toUpperCase() + ord.slice(1)} som rivs`;
    return `${STATUS[st]} ${ord}`;
  }
  /** Kropparna som v ligger an mot. */
  function anliggande(v, volymer) {
    return (volymer || []).filter(B => B !== v && B.fotavtryck && fogsidor(v, [B]).size);
  }
  /**
   * Byggnadsarea: { tillkommande (ny och tillbyggnad), befintlig (som står kvar), rivs, totalt (efter åtgärden) } i m².
   * Kroppar som går in i varandra räknas en gång (0.16.0): arean är unionens, och det tillkommande är det
   * som läggs till utöver det befintliga.
   */
  function bya(volymer) {
    const ytor = f => (volymer || []).filter(v => v.fotavtryck && v.fotavtryck.length >= 3 && f(status(v))).map(v => v.fotavtryck);
    const a = p => unionArea(p);
    const befintlig = a(ytor(st => st === 'befintlig')), totalt = a(ytor(st => st !== 'rivs'));
    return { tillkommande: Math.max(0, totalt - befintlig), befintlig, rivs: a(ytor(st => st === 'rivs')), totalt };
  }
  /**
   * BYA med Lantmäteriets hus på fastigheten som befintliga (0.16.3, ägarens beslut 26 nov 2026): situationsplanen
   * skrev förut "befintlig 0,0 m²" när husen inte var gjorda till kroppar. hus: Lantmäteriets hus som inte
   * ersätts av en kropp ({ fotavtryck, hal }); ytor: fastigheterna ({ beteckning, etikett, ringar }). Fastigheten
   * är den som huvudbyggnaden (annars första kroppen som inte rivs) står på, annars den med beteckningen
   * fastighet. Ett hus som en kropp är ritad över räknas inte, och gårdarna dras av. Ger bya() och
   * { lmhus (antal hus som räknas), tomt (fastigheten eller null) }.
   */
  function byaMedHus(volymer, hus, ytor, fastighet) {
    const vol = (volymer || []).filter(v => v.fotavtryck && v.fotavtryck.length >= 3);
    const mitt = p => mul(p.reduce((s, q) => add(s, q), [0, 0]), 1 / p.length);
    const iRingar = (ringar, x, y) => ringar.reduce((c, r) => (r && r.length >= 3 && inuti(r, x, y) ? !c : c), false);
    const kand = (ytor || []).filter(y => Array.isArray(y.ringar) && y.ringar.length);
    const ref = vol.find(v => v.huvudbyggnad && status(v) !== 'rivs') || vol.find(v => status(v) !== 'rivs');
    let tomt = null;
    if (ref) { const c = mitt(moturs(ref.fotavtryck)); tomt = kand.filter(y => iRingar(y.ringar, c[0], c[1])).sort((a, b) => (b.yta || 0) - (a.yta || 0))[0] || null; }
    if (!tomt && fastighet) { const f = String(fastighet).trim().toLowerCase(); tomt = kand.find(y => [y.beteckning, y.etikett].some(t => t && String(t).trim().toLowerCase() === f)) || null; }
    // Ett hus som en kropp (som inte rivs) är ritad över står inte kvar; det räknas inte.
    const byggs = vol.filter(v => status(v) !== 'rivs').map(v => v.fotavtryck);
    const overRitat = h => { const a = Math.abs(area(h.fotavtryck)); return byggs.some(f => a + Math.abs(area(f)) - unionArea([h.fotavtryck, f]) > 0.5); };
    const pa = tomt ? (hus || []).filter(h => h.fotavtryck && h.fotavtryck.length >= 3 && (c => iRingar(tomt.ringar, c[0], c[1]))(mitt(h.fotavtryck)) && !overRitat(h)) : [];
    const b = bya(vol.concat(pa.map(h => ({ fotavtryck: h.fotavtryck, status: 'befintlig' }))));
    const gard = pa.reduce((s, h) => s + (h.hal || []).reduce((t, r) => t + (r && r.length >= 3 ? Math.abs(area(r)) : 0), 0), 0);
    b.befintlig = Math.max(0, b.befintlig - gard); b.totalt = Math.max(0, b.totalt - gard);
    b.lmhus = pa.length; b.tomt = tomt;
    return b;
  }

  // ------------------------------------------------------------------
  // Union och yttre skal (0.16.0)
  // ------------------------------------------------------------------
  /** Om punkten (x, y) ligger inuti polygonen (jämn–udda). */
  function inuti(poly, x, y) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  /** Avståndet från punkten c till sträckan a–b. */
  function avstand(c, a, b) { const r = fot(c, a, b), t = Math.max(0, Math.min(1, r.t)); return len(sub(c, add(a, mul(sub(b, a), t)))); }
  /** Skärningen mellan sträckorna a–b och c–d som läget längs a–b (0–1), eller null. Parallella ger null. */
  /** Om fotavtrycket korsar sig självt: två sidor som inte är grannar möts. */
  function korsarSig(pts) {
    const p = rensa(pts), n = p.length;
    if (n < 4) return false;
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;   // grannar genom slutet
      if (skarning(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n]) != null) return true;
    }
    return false;
  }
  function skarning(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c), q = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(q) < 1e-12) return null;
    const w = sub(c, a), t = (w[0] * s[1] - w[1] * s[0]) / q, u = (w[0] * r[1] - w[1] * r[0]) / q;
    return t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 ? t : null;
  }
  /**
   * Unionen av polygoner (fotavtryck i vilken riktning som helst). Varje sida delas där den möter en annan
   * polygons sidor; delarna som ligger inuti en annan polygon tas bort, liksom fogar där två polygoner
   * ligger an mot varandra (motriktade sidor), och av sidor som sammanfaller behålls en. Delarna fogas
   * till ringar: moturs för yttre konturer, medurs för hål (en innergård). tol i meter.
   */
  function union(polys, tol = 0.002) {
    const P = (polys || []).map(p => moturs(rensa(p, tol / 2))).filter(p => p.length >= 3 && Math.abs(area(p)) > 1e-6);
    if (P.length <= 1) return P.map(p => p.map(q => q.slice()));
    const kant = P.map(p => p.map((a, i) => [a, p[(i + 1) % p.length]]));
    const lada = P.map(p => { const xs = p.map(q => q[0]), ys = p.map(q => q[1]); return [Math.min(...xs) - tol, Math.min(...ys) - tol, Math.max(...xs) + tol, Math.max(...ys) + tol]; });
    const nara = (i, j) => !(lada[i][2] < lada[j][0] || lada[j][2] < lada[i][0] || lada[i][3] < lada[j][1] || lada[j][3] < lada[i][1]);
    const delar = [];
    for (let i = 0; i < P.length; i++) {
      for (const [a, b] of kant[i]) {
        const l = len(sub(b, a));
        if (l < tol) continue;
        const ts = [0, 1];
        for (let j = 0; j < P.length; j++) {
          if (j === i || !nara(i, j)) continue;
          for (const [c, d] of kant[j]) {
            const t = skarning(a, b, c, d);
            if (t != null) ts.push(t);
            // hörn i den andra polygonen som ligger på sidan (T-korsningar och sidor som delvis sammanfaller)
            for (const q of [c, d]) { const r = fot(q, a, b); if (r.t > 0 && r.t < 1 && len(sub(r.f, q)) < tol) ts.push(r.t); }
          }
        }
        ts.sort((x, y) => x - y);
        for (let k = 0; k + 1 < ts.length; k++) {
          if ((ts[k + 1] - ts[k]) * l < tol) continue;
          const p0 = add(a, mul(sub(b, a), ts[k])), p1 = add(a, mul(sub(b, a), ts[k + 1])), m = mul(add(p0, p1), 0.5), u = norm(sub(b, a));
          let behall = true;
          for (let j = 0; j < P.length && behall; j++) {
            if (j === i || !nara(i, j)) continue;
            // fog bara om mitten ligger längs den andra sidan, inte bara nära dess ände (0.16.3, B1: en bit på 2–4 mm
            // intill en fog togs annars för fog, och ringen gick inte ihop)
            const langs = (c, d) => { const r = fot(m, c, d); return r.t >= 0 && r.t <= 1 && len(sub(r.f, m)) < tol; };
            const pa = kant[j].find(([c, d]) => langs(c, d) && Math.abs(Math.abs(dot(norm(sub(d, c)), u)) - 1) < 1e-4);
            if (pa) { if (dot(norm(sub(pa[1], pa[0])), u) < 0 || j < i) behall = false; }   // fog, eller samma sida i en tidigare polygon
            else if (inuti(P[j], m[0], m[1])) behall = false;
          }
          if (behall) delar.push([p0, p1]);
        }
      }
    }
    // hörnen: punkter inom tol blir samma
    const punkter = [];
    const index = p => { for (let k = 0; k < punkter.length; k++) if (Math.abs(punkter[k][0] - p[0]) < tol && Math.abs(punkter[k][1] - p[1]) < tol) return k; punkter.push(p); return punkter.length - 1; };
    const ut = new Map();
    const sid = delar.map(([p0, p1]) => ({ a: index(p0), b: index(p1), anvand: false })).filter(s => s.a !== s.b);
    sid.forEach(s => { if (!ut.has(s.a)) ut.set(s.a, []); ut.get(s.a).push(s); });
    const ringar = [];
    let oppen = false;
    for (const s0 of sid) {
      if (s0.anvand) continue;
      const ring = [];
      let s = s0, sista = null;
      while (s && !s.anvand) {
        sista = s;
        s.anvand = true; ring.push(punkter[s.a]);
        const kand = (ut.get(s.b) || []).filter(x => !x.anvand);
        if (kand.length <= 1) { s = kand[0]; continue; }
        // flera vägar ur samma hörn: den som svänger mest åt höger håller ringarna isär
        const inn = norm(sub(punkter[s.b], punkter[s.a]));
        const sving = x => { const v = norm(sub(punkter[x.b], punkter[x.a])); return Math.atan2(inn[0] * v[1] - inn[1] * v[0], dot(inn, v)); };
        s = kand.sort((x, y) => sving(x) - sving(y))[0];
      }
      if (sista.b !== s0.a) oppen = true;
      const r = rensa(ring, tol / 2);
      if (r.length >= 3 && Math.abs(area(r)) > 1e-6) ringar.push(r);
    }
    // En ring som inte går ihop är ett fel i unionen. Hellre kropparna var för sig än en kropp som försvinner.
    if (oppen) return P.map(p => p.map(q => q.slice()));
    return ringar;
  }
  /** Arean av unionen (hål dras av). */
  const unionArea = polys => union(polys).reduce((s, r) => s + area(r), 0);
  /** Om två fotavtryck går in i varandra eller ligger an mot varandra längs en sida (inte bara i ett hörn). */
  function horIhop(A, B, tol = 0.03) {
    const a = moturs(A), b = moturs(B);
    const xs = p => p.map(q => q[0]), ys = p => p.map(q => q[1]);
    if (Math.max(...xs(a)) < Math.min(...xs(b)) - tol || Math.max(...xs(b)) < Math.min(...xs(a)) - tol
      || Math.max(...ys(a)) < Math.min(...ys(b)) - tol || Math.max(...ys(b)) < Math.min(...ys(a)) - tol) return false;
    // sidor som korsar varandra (inte bara rör vid varandra i ändarna)
    for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
      const p = a[i], q = a[(i + 1) % a.length], c = b[j], d = b[(j + 1) % b.length], t = skarning(p, q, c, d);
      if (t == null || t < 1e-6 || t > 1 - 1e-6) continue;
      const u = skarning(c, d, p, q);
      if (u != null && u > 1e-6 && u < 1 - 1e-6) return true;
    }
    // ett hörn eller en sidmitt inuti den andra
    const iA = p => inuti(a, p[0], p[1]) && a.every((x, i) => avstand(p, x, a[(i + 1) % a.length]) > 1e-6);
    const iB = p => inuti(b, p[0], p[1]) && b.every((x, i) => avstand(p, x, b[(i + 1) % b.length]) > 1e-6);
    const mitt = p => p.map((x, i) => mul(add(x, p[(i + 1) % p.length]), 0.5));
    if (a.some(iB) || b.some(iA) || mitt(a).some(iB) || mitt(b).some(iA)) return true;
    const ca = mul(a.reduce((s, q) => add(s, q), [0, 0]), 1 / a.length), cb = mul(b.reduce((s, q) => add(s, q), [0, 0]), 1 / b.length);
    if (iB(ca) || iA(cb)) return true;
    // fog: motriktade sidor som ligger an
    return fogsidor({ fotavtryck: a }, [{ fotavtryck: b }], tol).size > 0;
  }
  /**
   * Byggnadernas yttre skal (0.16.0): kroppar med samma status som går in i varandra eller ligger an mot
   * varandra redovisas som en byggnad, med unionen som kontur. Kroppar med olika status (en tillbyggnad mot
   * det befintliga huset) hålls isär, så att fogen syns.
   * Ger [{ id (kropparnas id med +), status, kroppar: [id], ringar (moturs yttre, medurs hål), yttre (den
   *        största yttre ringen) }] i samma ordning som kropparna.
   */
  function skal(volymer) {
    const lista = (volymer || []).filter(v => v.fotavtryck && v.fotavtryck.length >= 3);
    const far = lista.map((v, i) => i);
    const rot = i => { while (far[i] !== i) { far[i] = far[far[i]]; i = far[i]; } return i; };
    for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
      if (status(lista[i]) !== status(lista[j]) || rot(i) === rot(j)) continue;
      if (horIhop(lista[i].fotavtryck, lista[j].fotavtryck)) far[rot(j)] = rot(i);
    }
    const grupper = new Map();
    lista.forEach((v, i) => { const r = rot(i); if (!grupper.has(r)) grupper.set(r, []); grupper.get(r).push(v); });
    return [...grupper.values()].map(g => {
      const ringar = g.length === 1 ? [moturs(g[0].fotavtryck).map(q => q.slice())] : union(g.map(v => v.fotavtryck));
      const yttre = ringar.filter(r => area(r) > 0).sort((x, y) => area(y) - area(x))[0] || moturs(g[0].fotavtryck);
      return { id: g.map(v => v.id).join('+'), status: status(g[0]), kroppar: g.map(v => v.id), ringar, yttre };
    });
  }

  return {
    STATUS, SLAG, slag, satSlag, planmarke, for3d, gavlar, anslutTak, status, normalisera, forAnalys, ersatta, area, moturs, rensa, sidor, arRektangel, vinkel,
    entrePunkt, flyttaEntre, andra, nyRektangel, nyPolygon, franHus, satFotavtryck, satHorn, korsarSig, byaMedHus, satTakform, nockVal, satNock, flytta, vrid,
    tal, tolka, strackor, gransmatt, relativaMatt, fogsidor, anliggande, yttermattSidor, hojdText, fgText, bya,
    inuti, union, unionArea, horIhop, skal,
    klippLinje, rivsKryss, dockning, mattMot, beskrivning,
  };
}));
