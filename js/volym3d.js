/*
 * Volymer att modellera i 3D-vyn (0.10.0). Ren geometri utan three.js, så att den kan testas i Node.
 *
 * En volym är som förut { id, namn, fotavtryck, golv, takfot, takform, taklutning, nockriktning },
 * så att skuggor, horisont, skyfall, DXF och cad-apa läser den som vanligt. Det nya är primitiv:
 *   { typ: 'block'|'cylinder'|'prisma'|'polygon', x, y (mitten i zonen), vrid (grader moturs från öster),
 *     b, d (rätblock och prisma), diam (cylinder), pts (polygon, lokala koordinater kring mitten),
 *     nock0 (polygonens nockriktning vid vrid 0), lankar (id för volymer som sitter ihop med den),
 *     golvAuto (golvet följer marken eller volymen under), pa (id för volymen den står på) }
 * Fotavtrycket och nockriktningen räknas ur primitiven med uppdatera(v). Höjden är takfot (m över golvet),
 * taket takform och taklutning, precis som för andra volymer.
 *
 * Här finns också: taket som exakta plana ytor (takytor), snäpp mot andra volymer, hus och gränser
 * (snapp), vilka volymer som rör vid varandra (kontakter), grupper av länkade volymer (komponent) och
 * konturerna för volymer som går in i varandra (synligaKanter, skarningar): kanter inuti en annan volym
 * eller mitt på en plan yta tas bort, och linjer där två volymer möts läggs till. Det ger en union av
 * volymerna på skärmen; analyserna räknar redan överlapp som en union.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Volym3D = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const RAD = Math.PI / 180;
  const TYPER = ['block', 'cylinder', 'prisma', 'polygon'];
  const CYLINDERSIDOR = 32;

  // ------------------------------------------------------------------
  // Plana hjälpfunktioner
  // ------------------------------------------------------------------
  // räknas relativt första hörnet: zonens stora koordinater ger annars stora avrundningsfel
  const yta = p => { if (!p.length) return 0; const [ox, oy] = p[0]; let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += (p[i][0] - ox) * (q[1] - oy) - (q[0] - ox) * (p[i][1] - oy); } return a / 2; };
  const moturs = p => (yta(p) < 0 ? p.slice().reverse() : p);
  function inuti(poly, x, y) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function tyngdpunkt(p) {
    const [ox, oy] = p[0];
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < p.length; i++) {
      const x0 = p[i][0] - ox, y0 = p[i][1] - oy, x1 = p[(i + 1) % p.length][0] - ox, y1 = p[(i + 1) % p.length][1] - oy, k = x0 * y1 - x1 * y0;
      a += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k;
    }
    if (Math.abs(a) < 1e-9) return [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
    return [ox + cx / (3 * a), oy + cy / (3 * a)];
  }
  function konvex(p) {
    let tecken = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], c = p[(i + 2) % p.length];
      const k = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(k) < 1e-9) continue;
      if (!tecken) tecken = Math.sign(k); else if (Math.sign(k) !== tecken) return false;
    }
    return true;
  }
  /** Behåller den del av den konvexa polygonen där f(x, y) ≥ 0 (f linjär). */
  function klipp(poly, f) {
    const ut = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], c = poly[(i + 1) % poly.length], fa = f(a[0], a[1]), fc = f(c[0], c[1]);
      if (fa >= -1e-9) ut.push(a);
      if ((fa >= -1e-9) !== (fc >= -1e-9)) { const t = fa / (fa - fc); ut.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]); }
    }
    return ut;
  }
  /** Riktningen på fotavtryckets längsta sida, i grader (som Platsanalys.langsida). */
  function langsida(p) {
    let best = 0, ang = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l > best) { best = l; ang = Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD; }
    }
    return ang;
  }
  /** Närmaste punkt på sträckan a–b. */
  function narmast(a, b, x, y) {
    const ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey;
    const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / l2)) : 0;
    return [a[0] + ex * t, a[1] + ey * t, t];
  }
  function skar(a, b, c, d) {
    const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], k = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(k) < 1e-12) return null;
    const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / k, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / k;
    return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9 ? [a[0] + r[0] * t, a[1] + r[1] * t] : null;
  }
  /** Avståndet från punkten till polygonens kant. */
  function tillKant(poly, x, y) {
    let m = Infinity;
    for (let i = 0; i < poly.length; i++) { const p = narmast(poly[i], poly[(i + 1) % poly.length], x, y); m = Math.min(m, Math.hypot(p[0] - x, p[1] - y)); }
    return m;
  }
  /** Om två polygoner överlappar (inte bara rör vid varandra). */
  function overlappar(a, b) {
    if (a.some(p => inuti(b, p[0], p[1]) && tillKant(b, p[0], p[1]) > 1e-3) || b.some(p => inuti(a, p[0], p[1]) && tillKant(a, p[0], p[1]) > 1e-3)) return true;
    for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) if (skar(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
    const c = tyngdpunkt(a);
    return inuti(b, c[0], c[1]) && tillKant(b, c[0], c[1]) > 1e-3;
  }
  const avrunda = (v, n = 3) => Math.round(v * 10 ** n) / 10 ** n;

  // ------------------------------------------------------------------
  // Primitiver
  // ------------------------------------------------------------------
  /** Lokala hörn (före vridning) för primitiven, moturs. */
  function lokalaHorn(p) {
    if (p.typ === 'cylinder') {
      const r = Math.max(0.05, p.diam / 2);
      return Array.from({ length: CYLINDERSIDOR }, (_, i) => { const a = (i + 0.5) / CYLINDERSIDOR * 2 * Math.PI; return [r * Math.cos(a), r * Math.sin(a)]; });
    }
    if (p.typ === 'polygon') return moturs(p.pts);
    const b = Math.max(0.05, p.b) / 2, d = Math.max(0.05, p.d) / 2;
    return [[-b, -d], [b, -d], [b, d], [-b, d]];
  }
  /** Fotavtrycket i zonen: de lokala hörnen vridna vrid grader och flyttade till (x, y). */
  function fotavtryck(p) {
    const c = Math.cos((p.vrid || 0) * RAD), s = Math.sin((p.vrid || 0) * RAD);
    return lokalaHorn(p).map(([u, v]) => [avrunda(p.x + u * c - v * s), avrunda(p.y + u * s + v * c)]);
  }
  /** Sätter fotavtrycket och nockriktningen ur primitiven. Rätblock och cylinder har platt tak. */
  function uppdatera(v) {
    const p = v.primitiv;
    if (!p) return v;
    v.fotavtryck = fotavtryck(p);
    if (p.typ === 'block' || p.typ === 'cylinder') { v.takform = 'platt'; v.taklutning = 0; v.nockriktning = null; }
    else if (p.typ === 'prisma') {
      if (!['sadel', 'pulpet', 'valm'].includes(v.takform)) v.takform = 'sadel';
      v.nockriktning = avrunda(((p.vrid || 0) % 360 + 360) % 360, 2);
    } else v.nockriktning = p.nock0 == null ? null : avrunda(((p.nock0 + (p.vrid || 0)) % 360 + 360) % 360, 2);
    return v;
  }
  /** Ny volym ur en mall { typ, b, d, diam, hojd, takform, taklutning } med mitten i (x, y) och golvet golv. */
  function ny(mall, x, y, golv, id, namn) {
    const typ = TYPER.includes(mall.typ) && mall.typ !== 'polygon' ? mall.typ : 'block';
    const v = {
      id, namn, golv, takfot: Math.max(0.1, +mall.hojd || 3),
      takform: typ === 'prisma' ? (mall.takform || 'sadel') : 'platt', taklutning: typ === 'prisma' ? Math.min(75, Math.max(0, +mall.taklutning || 0)) : 0, nockriktning: null,
      primitiv: { typ, x, y, vrid: +mall.vrid || 0, lankar: [], golvAuto: true, pa: null },
    };
    if (typ === 'cylinder') v.primitiv.diam = Math.max(0.1, +mall.diam || 6);
    else { v.primitiv.b = Math.max(0.1, +mall.b || 10); v.primitiv.d = Math.max(0.1, +mall.d || 8); }
    return uppdatera(v);
  }
  /** Ger en volym utan primitiv (från cad-apa eller DXF) en polygon kring tyngdpunkten, så att den kan flyttas och vridas. */
  function franVolym(v) {
    if (v.primitiv && TYPER.includes(v.primitiv.typ)) {
      v.primitiv.lankar = (v.primitiv.lankar || []).slice();
      return v;
    }
    const c = tyngdpunkt(v.fotavtryck);
    v.primitiv = { typ: 'polygon', x: avrunda(c[0]), y: avrunda(c[1]), vrid: 0, pts: v.fotavtryck.map(p => [p[0] - c[0], p[1] - c[1]]),
      nock0: v.nockriktning == null ? null : v.nockriktning, lankar: [], golvAuto: false, pa: null };
    return v;
  }
  /** Mitten av primitiven (eller fotavtryckets tyngdpunkt). */
  const mitt = v => (v.primitiv ? [v.primitiv.x, v.primitiv.y] : tyngdpunkt(v.fotavtryck));

  // ------------------------------------------------------------------
  // Taket: plan för takfallen (samma höjder som Platsanalys.takhojd) och exakta ytor
  // ------------------------------------------------------------------
  /** Takfallens plan [a, b, c] (z = a·x + b·y + c); takets höjd är det lägsta av dem. null för platt tak. */
  function plan(v) {
    const bas = v.golv + v.takfot;
    if (!v.takform || v.takform === 'platt' || !(v.taklutning > 0)) return null;
    const t = Math.tan(v.taklutning * RAD), vinkel = (v.nockriktning != null ? v.nockriktning : langsida(v.fotavtryck)) * RAD;
    const ux = Math.cos(vinkel), uy = Math.sin(vinkel);
    const tv = v.fotavtryck.map(p => -p[0] * uy + p[1] * ux), lg = v.fotavtryck.map(p => p[0] * ux + p[1] * uy);
    const tmin = Math.min(...tv), tmax = Math.max(...tv), lmin = Math.min(...lg), lmax = Math.max(...lg);
    // d = −x·uy + y·ux (tvärs nocken), l = x·ux + y·uy (längs nocken)
    const minusD = c => [t * uy, -t * ux, c], plusD = c => [-t * uy, t * ux, c];
    if (v.takform === 'pulpet') return [minusD(bas + tmax * t)];
    const m = (tmin + tmax) / 2, halv = (tmax - tmin) / 2;
    const p = [minusD(bas + (halv + m) * t), plusD(bas + (halv - m) * t)];
    if (v.takform === 'valm') p.push([t * ux, t * uy, bas - lmin * t], [-t * ux, -t * uy, bas + lmax * t]);
    return p;
  }
  /** Takets höjd (RH 2000) i (x, y). */
  function hojdVid(v, x, y, pl = plan(v)) {
    const bas = v.golv + v.takfot;
    if (!pl) return bas;
    let h = Infinity;
    for (const [a, b, c] of pl) h = Math.min(h, a * x + b * y + c);
    return Math.max(bas, h);
  }
  /**
   * Taket som exakta plana ytor och gavlarna ovanför takfoten, för konvexa fotavtryck:
   * { pos: [x, y, z, …] i zonen, index: [...] }. null för platt tak eller ett inbuktat fotavtryck
   * (3D-vyn ritar då taket i ett rutnät som förut).
   */
  function takytor(v) {
    const pl = plan(v);
    if (!pl) return null;
    const fot = moturs(v.fotavtryck);
    if (!konvex(fot)) return null;
    const bas = v.golv + v.takfot, pos = [], index = [];
    const punkt = (x, y, z) => { pos.push(x, y, z); return pos.length / 3 - 1; };
    const fall = [];
    pl.forEach(([a, b, c], k) => {
      let poly = fot;
      pl.forEach(([a2, b2, c2], j) => { if (j !== k && poly.length >= 3) poly = klipp(poly, (x, y) => (a2 - a) * x + (b2 - b) * y + (c2 - c)); });
      if (poly.length >= 3 && Math.abs(yta(poly)) > 1e-6) fall.push(poly);
    });
    for (const f of fall) {
      const p = moturs(f), id = p.map(([x, y]) => punkt(x, y, hojdVid(v, x, y, pl)));
      for (let i = 1; i + 1 < id.length; i++) index.push(id[0], id[i], id[i + 1]);
    }
    // gavlarna: lodrätt från takfoten upp till taket längs varje sida
    for (let i = 0; i < fot.length; i++) {
      const A = fot[i], B = fot[(i + 1) % fot.length], ex = B[0] - A[0], ey = B[1] - A[1], l2 = ex * ex + ey * ey;
      if (l2 < 1e-9) continue;
      const ts = [0, 1];
      for (const f of fall) for (const q of f) {
        const tt = ((q[0] - A[0]) * ex + (q[1] - A[1]) * ey) / l2, ax = A[0] + ex * tt, ay = A[1] + ey * tt;
        if (tt > 1e-6 && tt < 1 - 1e-6 && Math.hypot(q[0] - ax, q[1] - ay) < 1e-6) ts.push(tt);
      }
      ts.sort((p, q) => p - q);
      for (let n = 0; n + 1 < ts.length; n++) {
        if (ts[n + 1] - ts[n] < 1e-6) continue;
        const p0 = [A[0] + ex * ts[n], A[1] + ey * ts[n]], p1 = [A[0] + ex * ts[n + 1], A[1] + ey * ts[n + 1]];
        const h0 = hojdVid(v, ...p0, pl), h1 = hojdVid(v, ...p1, pl);
        if (h0 - bas < 0.01 && h1 - bas < 0.01) continue;
        const a0 = punkt(p0[0], p0[1], bas), a1 = punkt(p1[0], p1[1], bas), b1 = punkt(p1[0], p1[1], h1), b0 = punkt(p0[0], p0[1], h0);
        index.push(a0, a1, b1, a0, b1, b0);
      }
    }
    return { pos, index };
  }
  /** Om punkten ligger inuti volymen (marginalen eps från ytorna). */
  function inutiVolym(v, x, y, z, eps = 0) {
    if (z <= v.golv + eps || !inuti(v.fotavtryck, x, y)) return false;
    if (eps && tillKant(v.fotavtryck, x, y) <= eps) return false;
    return z < hojdVid(v, x, y) - eps;
  }

  // ------------------------------------------------------------------
  // Snäpp
  // ------------------------------------------------------------------
  /**
   * Snäpper fotavtrycket fot mot målen (listor av punkter; sluten: polygon, annars linje) inom tol meter.
   * I första hand yta mot yta: en sida som är parallell med en målsida och nära den läggs an mot den,
   * och hörnen ställs i linje om de är nära. Annars hörn mot hörn, sist hörn mot kant.
   * Ett mål med prio (0 först) får stå tillbaka för ett närmare prioriterat: volymer före hus före gränser.
   * Ger { dx, dy, typ: 'yta'|'hörn'|'kant', mal (målets index), linje: { p, n } (för avstånd) } eller null.
   */
  function snapp(fot, mal, tol) {
    const sin = Math.sin(2 * RAD), c0 = tyngdpunkt(fot);
    let bast = null;
    const sidor = m => { const ut = []; const n = m.pts.length; for (let i = 0; i + 1 < n || (m.sluten && i < n); i++) ut.push([m.pts[i], m.pts[(i + 1) % n]]); return ut; };
    // yta mot yta
    mal.forEach((m, mi) => {
      for (const [c, d] of sidor(m)) {
        const lf = Math.hypot(d[0] - c[0], d[1] - c[1]);
        if (lf < 1e-6) continue;
        const w = [(d[0] - c[0]) / lf, (d[1] - c[1]) / lf];
        for (let i = 0; i < fot.length; i++) {
          const a = fot[i], b = fot[(i + 1) % fot.length], le = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (le < 1e-6) continue;
          const u = [(b[0] - a[0]) / le, (b[1] - a[1]) / le];
          if (Math.abs(u[0] * w[1] - u[1] * w[0]) > sin) continue;
          const n = [-w[1], w[0]], dist = (a[0] - c[0]) * n[0] + (a[1] - c[1]) * n[1];
          if (Math.abs(dist) > tol) continue;
          // sidorna måste gå förbi varandra
          const s0 = (a[0] - c[0]) * w[0] + (a[1] - c[1]) * w[1], s1 = (b[0] - c[0]) * w[0] + (b[1] - c[1]) * w[1];
          if (Math.min(lf, Math.max(s0, s1)) - Math.max(0, Math.min(s0, s1)) < Math.min(0.2, le * 0.2)) continue;
          let dx = -dist * n[0], dy = -dist * n[1];
          // hörnen i linje längs sidan, om de är nära
          let langs = null;
          for (const q of [s0, s1]) for (const r of [0, lf]) if (Math.abs(r - q) < tol && (langs == null || Math.abs(r - q) < Math.abs(langs))) langs = r - q;
          if (langs != null) { dx += langs * w[0]; dy += langs * w[1]; }
          const poang = Math.abs(dist) + (langs != null ? Math.abs(langs) * 0.5 : tol * 0.3) + (m.prio || 0) * tol * 0.5;
          if (!bast || poang < bast.poang) {
            // normalen pekar från målsidan mot volymen
            const sida = (c0[0] - c[0]) * n[0] + (c0[1] - c[1]) * n[1] >= 0 ? 1 : -1;
            bast = { poang, dx, dy, typ: 'yta', mal: mi, linje: { p: c, n: [n[0] * sida, n[1] * sida], sida: i } };
          }
        }
      }
    });
    if (bast) return bast;
    // hörn mot hörn
    mal.forEach((m, mi) => m.pts.forEach(q => fot.forEach(p => {
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < tol && (!bast || d < bast.poang)) bast = { poang: d, dx: q[0] - p[0], dy: q[1] - p[1], typ: 'hörn', mal: mi };
    })));
    if (bast) return bast;
    // hörn mot kant
    mal.forEach((m, mi) => {
      for (const [c, d] of sidor(m)) fot.forEach(p => {
        const q = narmast(c, d, p[0], p[1]), dd = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (dd < tol && (!bast || dd < bast.poang)) bast = { poang: dd, dx: q[0] - p[0], dy: q[1] - p[1], typ: 'kant', mal: mi };
      });
    });
    return bast;
  }

  // ------------------------------------------------------------------
  // Kontakter och grupper
  // ------------------------------------------------------------------
  /** Takets högsta höjd (nocken) ungefär: största höjden i hörnen och längs nocken. */
  function topp(v) {
    const pl = plan(v);
    if (!pl) return v.golv + v.takfot;
    let m = v.golv + v.takfot;
    const t = takytor(v);
    if (t) { for (let i = 2; i < t.pos.length; i += 3) m = Math.max(m, t.pos[i]); return m; }
    const xs = v.fotavtryck.map(p => p[0]), ys = v.fotavtryck.map(p => p[1]);
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.5) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.5) if (inuti(v.fotavtryck, x, y)) m = Math.max(m, hojdVid(v, x, y, pl));
    return m;
  }
  /**
   * Volymer som rör vid varandra: sida mot sida, ovanpå varandra eller in i varandra.
   * Ger [{ a, b (id), punkt: [x, y, z] }] där punkt är mitt i fogen (för kedjeikonen).
   */
  function kontakter(volymer, tol = 0.03) {
    const ut = [];
    for (let i = 0; i < volymer.length; i++) for (let j = i + 1; j < volymer.length; j++) {
      const A = volymer[i], B = volymer[j], fa = A.fotavtryck, fb = B.fotavtryck;
      const za = [A.golv, A.golv + A.takfot], zb = [B.golv, B.golv + B.takfot];
      const z0 = Math.max(za[0], zb[0]), z1 = Math.min(za[1], zb[1]);
      // sida mot sida: parallella sidor som ligger an och går förbi varandra
      let fog = null;
      if (z1 - z0 > tol) {
        for (let p = 0; p < fa.length && !fog; p++) {
          const a = fa[p], b = fa[(p + 1) % fa.length], le = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (le < 1e-6) continue;
          const u = [(b[0] - a[0]) / le, (b[1] - a[1]) / le], n = [-u[1], u[0]];
          for (let q = 0; q < fb.length && !fog; q++) {
            const c = fb[q], d = fb[(q + 1) % fb.length];
            if (Math.abs((c[0] - a[0]) * n[0] + (c[1] - a[1]) * n[1]) > tol || Math.abs((d[0] - a[0]) * n[0] + (d[1] - a[1]) * n[1]) > tol) continue;
            const s0 = (c[0] - a[0]) * u[0] + (c[1] - a[1]) * u[1], s1 = (d[0] - a[0]) * u[0] + (d[1] - a[1]) * u[1];
            const lo = Math.max(0, Math.min(s0, s1)), hi = Math.min(le, Math.max(s0, s1));
            if (hi - lo > 0.1) { const s = (lo + hi) / 2; fog = [a[0] + u[0] * s, a[1] + u[1] * s, (z0 + z1) / 2]; }
          }
        }
      }
      if (!fog && overlappar(fa, fb)) {
        if (Math.abs(B.golv - za[1]) < tol || Math.abs(A.golv - zb[1]) < tol) {
          // ovanpå: fogen mitt under den övre
          const ovre = Math.abs(B.golv - za[1]) < tol ? B : A, c = tyngdpunkt(ovre.fotavtryck);
          fog = [c[0], c[1], ovre.golv];
        } else if (z1 - z0 > tol) {
          // in i varandra
          const ca = tyngdpunkt(fa), cb = tyngdpunkt(fb);
          fog = [(ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2, (z0 + z1) / 2];
        }
      }
      if (fog) ut.push({ a: A.id, b: B.id, punkt: fog });
    }
    return ut;
  }
  /** Alla volymer som hänger ihop med id genom länkar (kedjeikonen), id själv inräknat. */
  function komponent(volymer, id) {
    const per = new Map(volymer.map(v => [v.id, v]));
    const sedd = new Set([id]), ko = [id];
    while (ko.length) {
      const v = per.get(ko.pop());
      for (const l of (v && v.primitiv && v.primitiv.lankar) || []) if (per.has(l) && !sedd.has(l)) { sedd.add(l); ko.push(l); }
    }
    return sedd;
  }
  /** Om a och b är direkt länkade. */
  const lankade = (a, b) => !!(a.primitiv && (a.primitiv.lankar || []).includes(b.id));
  /** Länkar ihop a och b, eller löser upp länken om de redan är länkade. Ger true om de är länkade efteråt. */
  function vaxlaLank(a, b) {
    for (const v of [a, b]) franVolym(v);
    if (lankade(a, b)) {
      a.primitiv.lankar = a.primitiv.lankar.filter(x => x !== b.id);
      b.primitiv.lankar = b.primitiv.lankar.filter(x => x !== a.id);
      return false;
    }
    a.primitiv.lankar.push(b.id); b.primitiv.lankar.push(a.id);
    return true;
  }

  // ------------------------------------------------------------------
  // Flytta och vrida
  // ------------------------------------------------------------------
  function flytta(v, dx, dy, dz = 0) {
    franVolym(v);
    v.primitiv.x = avrunda(v.primitiv.x + dx); v.primitiv.y = avrunda(v.primitiv.y + dy);
    v.golv = avrunda(v.golv + dz);
    return uppdatera(v);
  }
  /** Vrider volymen grader moturs kring punkten (px, py). */
  function vrid(v, grader, px, py) {
    franVolym(v);
    const c = Math.cos(grader * RAD), s = Math.sin(grader * RAD), dx = v.primitiv.x - px, dy = v.primitiv.y - py;
    v.primitiv.x = avrunda(px + dx * c - dy * s); v.primitiv.y = avrunda(py + dx * s + dy * c);
    v.primitiv.vrid = avrunda((((v.primitiv.vrid || 0) + grader) % 360 + 360) % 360, 4);
    return uppdatera(v);
  }
  /** Volymen som fotavtrycket står på: den (utanför grupp) vars fotavtryck har mitten inuti, högst först. */
  function underlag(v, volymer, utom = new Set()) {
    const c = mitt(v);
    let bast = null;
    for (const w of volymer) {
      if (w === v || utom.has(w.id) || !inuti(w.fotavtryck, c[0], c[1])) continue;
      if (!bast || w.golv + w.takfot > bast.golv + bast.takfot) bast = w;
    }
    return bast;
  }

  // ------------------------------------------------------------------
  // Konturer för volymer som går in i varandra
  // ------------------------------------------------------------------
  const PROV = 16;
  /** Hur många av provpunkterna runt sträckans mitt som ligger inuti någon volym (0–16). */
  function inutiRunt(volymer, p, d, eps) {
    const l = Math.hypot(d[0], d[1], d[2]) || 1, u = [d[0] / l, d[1] / l, d[2] / l];
    const hj = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    let e1 = [u[1] * hj[2] - u[2] * hj[1], u[2] * hj[0] - u[0] * hj[2], u[0] * hj[1] - u[1] * hj[0]];
    const l1 = Math.hypot(...e1); e1 = e1.map(q => q / l1);
    const e2 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]];
    let n = 0;
    for (let k = 0; k < PROV; k++) {
      const a = (k + 0.5) / PROV * 2 * Math.PI, ca = Math.cos(a) * eps, sa = Math.sin(a) * eps;
      const x = p[0] + e1[0] * ca + e2[0] * sa, y = p[1] + e1[1] * ca + e2[1] * sa, z = p[2] + e1[2] * ca + e2[2] * sa;
      for (const v of volymer) {
        const b = v._box;
        if (b && (x < b[0] || x > b[1] || y < b[2] || y > b[3] || z < b[4] || z > b[5])) continue;
        if (inutiVolym(v, x, y, z)) { n++; break; }
      }
    }
    return n;
  }
  function lador(volymer) {
    for (const v of volymer) {
      const xs = v.fotavtryck.map(p => p[0]), ys = v.fotavtryck.map(p => p[1]);
      Object.defineProperty(v, '_box', { value: [Math.min(...xs) - 0.1, Math.max(...xs) + 0.1, Math.min(...ys) - 0.1, Math.max(...ys) + 0.1, v.golv - 0.1, topp(v) + 0.1], configurable: true, enumerable: false, writable: true });
    }
  }
  /**
   * Behåller de delar av kanterna som syns när volymerna slås ihop: inte inuti en annan volym och
   * inte mitt på en plan yta (där två volymer möts kant i kant). sträckor: [[[x, y, z], [x, y, z]], …] i zonen.
   */
  function synligaKanter(strackor, volymer, { eps = 0.04 } = {}) {
    lador(volymer);
    const ut = [];
    for (const [a, b] of strackor) {
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d);
      if (l < 1e-4) continue;
      // bara volymerna nära sträckan prövas
      const nara = volymer.filter(v => { const q = v._box; return Math.max(a[0], b[0]) >= q[0] && Math.min(a[0], b[0]) <= q[1] && Math.max(a[1], b[1]) >= q[2] && Math.min(a[1], b[1]) <= q[3] && Math.max(a[2], b[2]) >= q[4] && Math.min(a[2], b[2]) <= q[5]; });
      if (nara.length <= 1) { ut.push([a, b]); continue; }
      const n = Math.max(1, Math.min(60, Math.ceil(l / 0.5)));
      let start = null;
      for (let k = 0; k <= n; k++) {
        let syns = false;
        if (k < n) {
          const t = (k + 0.5) / n, p = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
          const c = inutiRunt(nara, p, d, eps);
          syns = c > 0 && c < PROV && Math.abs(c - PROV / 2) >= 2;
        }
        if (syns && start == null) start = k;
        if (!syns && start != null) {
          const t0 = start / n, t1 = k / n;
          ut.push([[a[0] + d[0] * t0, a[1] + d[1] * t0, a[2] + d[2] * t0], [a[0] + d[0] * t1, a[1] + d[1] * t1, a[2] + d[2] * t1]]);
          start = null;
        }
      }
    }
    return ut;
  }
  /**
   * Linjer där två volymer möts och som inte är kanter på någon av dem: lodräta där väggarna korsar
   * varandra, och där ett tak eller ett golv möter en vägg. Prövas sedan med synligaKanter.
   */
  function skarningar(volymer) {
    const ut = [];
    for (let i = 0; i < volymer.length; i++) for (let j = 0; j < volymer.length; j++) {
      if (i === j) continue;
      const A = volymer[i], B = volymer[j], fa = A.fotavtryck, fb = B.fotavtryck;
      const xa = fa.map(p => p[0]), ya = fa.map(p => p[1]), xb = fb.map(p => p[0]), yb = fb.map(p => p[1]);
      if (Math.max(...xa) < Math.min(...xb) || Math.max(...xb) < Math.min(...xa) || Math.max(...ya) < Math.min(...yb) || Math.max(...yb) < Math.min(...ya)) continue;
      // lodrätt där väggarna korsar varandra (en gång per par)
      if (i < j) for (let p = 0; p < fa.length; p++) for (let q = 0; q < fb.length; q++) {
        const s = skar(fa[p], fa[(p + 1) % fa.length], fb[q], fb[(q + 1) % fb.length]);
        if (!s) continue;
        const z0 = Math.max(A.golv, B.golv), z1 = Math.min(hojdVid(A, s[0], s[1]), hojdVid(B, s[0], s[1]));
        if (z1 - z0 > 0.01) ut.push([[s[0], s[1], z0], [s[0], s[1], z1]]);
      }
      // A:s väggar där de går in under B:s tak eller över B:s golv
      for (let p = 0; p < fa.length; p++) {
        const a = fa[p], b = fa[(p + 1) % fa.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(1, Math.ceil(l / 0.5));
        for (const niva of ['tak', 'golv']) {
          let forra = null;
          for (let k = 0; k <= n; k++) {
            const t = k / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
            const z = niva === 'tak' ? hojdVid(B, x, y) : B.golv;
            const ok = inuti(fb, x, y) || tillKant(fb, x, y) < 1e-6;
            const iVagg = z > A.golv + 0.01 && z < hojdVid(A, x, y) - 0.01;
            const q = ok && iVagg ? [x, y, z] : null;
            if (q && forra) ut.push([forra, q]);
            forra = q;
          }
        }
      }
    }
    return ut;
  }

  return {
    TYPER, ny, franVolym, uppdatera, fotavtryck, mitt, plan, hojdVid, takytor, inutiVolym, topp,
    snapp, kontakter, komponent, lankade, vaxlaLank, flytta, vrid, underlag, synligaKanter, skarningar,
    tyngdpunkt, inuti, konvex, overlappar, langsida,
  };
}));
