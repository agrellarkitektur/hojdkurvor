/*
 * Trädmodeller för 3D-vyn (0.9.0). Ren geometri utan three.js, så att den kan testas i Node.
 *
 * Tre modeller: gran, tall och lövträd, var och en i två nivåer: 'enkel' (low-poly, för
 * mobilen och träd långt bort) och 'detaljerad'. Sedan 0.9.1 också 'realistisk' (realistisk(art)):
 * lövverk av små kort med en genomskinlig bild av blad eller barr (ritaLovbild). En modell är 1 m hög och 1 m bred med
 * stammens fot i origo; 3D-vyn skalar den till laserns trädhöjd och kronbredd.
 * Arten gissas ur formen (höjd mot kronbredd), inte ur någon artdata.
 *
 * Utdata: { pos, norm, farg } som Float32Array, tre värden per hörn, trianglar utan index,
 * en normal per yta (facetterat).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Trad3D = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FARG = {
    stam: [0.42, 0.35, 0.28],
    tallstam: [0.55, 0.36, 0.24],
    gran: [0.22, 0.36, 0.22],
    tall: [0.33, 0.44, 0.26],
    lov: [0.40, 0.56, 0.29],
  };

  /** Slumptal 0–1 ur ett frö, samma varje gång. */
  function slump(fro) {
    let s = (fro * 2654435761) >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /** Samlar trianglar med en färg per del. */
  function bygge() {
    const pos = [], farg = [];
    const tri = (a, b, c, f) => { for (const p of [a, b, c]) { pos.push(p[0], p[1], p[2]); farg.push(f[0], f[1], f[2]); } };
    return {
      tri,
      /** Hörnen och färgerna som de är, utan skalning. */
      ra() { return { pos, farg }; },
      /** Kon eller stympad kon: radie r0 vid y0, r1 vid y1, seg sidor, med botten om botten. */
      kon(r0, y0, r1, y1, seg, f, { botten = false, vrid = 0 } = {}) {
        for (let i = 0; i < seg; i++) {
          const a0 = vrid + i / seg * 2 * Math.PI, a1 = vrid + (i + 1) / seg * 2 * Math.PI;
          const p00 = [r0 * Math.cos(a0), y0, r0 * Math.sin(a0)], p01 = [r0 * Math.cos(a1), y0, r0 * Math.sin(a1)];
          const p10 = [r1 * Math.cos(a0), y1, r1 * Math.sin(a0)], p11 = [r1 * Math.cos(a1), y1, r1 * Math.sin(a1)];
          // utåtvända ytor (moturs sett utifrån)
          tri(p00, p10, p01, f);
          if (r1 > 0) tri(p01, p10, p11, f);
          if (botten && r0 > 0) tri([0, y0, 0], p00, p01, f);
        }
      },
      /** Ikosaeder delad n gånger, ojämn med ojamn (0–1), skalad till rx, ry, rz runt c. */
      klump(c, rx, ry, rz, n, ojamn, f, s) {
        const t = (1 + Math.sqrt(5)) / 2;
        let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
          .map(p => { const l = Math.hypot(...p); return p.map(q => q / l); });
        let ytor = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
          [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
        for (let k = 0; k < n; k++) {
          const mitt = new Map(), ny = [];
          const m = (a, b) => {
            const key = a < b ? a + ':' + b : b + ':' + a;
            if (!mitt.has(key)) { const p = [0, 1, 2].map(i => (v[a][i] + v[b][i]) / 2), l = Math.hypot(...p); v.push(p.map(q => q / l)); mitt.set(key, v.length - 1); }
            return mitt.get(key);
          };
          for (const [a, b, c2] of ytor) { const ab = m(a, b), bc = m(b, c2), ca = m(c2, a); ny.push([a, ab, ca], [b, bc, ab], [c2, ca, bc], [ab, bc, ca]); }
          ytor = ny;
        }
        const r = v.map(() => 1 + (s() * 2 - 1) * ojamn);
        const p = v.map((q, i) => [c[0] + q[0] * rx * r[i], c[1] + q[1] * ry * r[i], c[2] + q[2] * rz * r[i]]);
        for (const [a, b, c2] of ytor) tri(p[a], p[b], p[c2], f);
      },
      /** Skalar till 1 m bredd och 1 m höjd (foten kvar i origo) och räknar en normal per yta. */
      resultat() {
        const P = new Float32Array(pos), N = new Float32Array(pos.length);
        let xmax = 0, ymax = 0;
        for (let i = 0; i < P.length; i += 3) { xmax = Math.max(xmax, Math.abs(P[i]), Math.abs(P[i + 2])); ymax = Math.max(ymax, P[i + 1]); }
        for (let i = 0; i < P.length; i += 3) { P[i] *= 0.5 / xmax; P[i + 1] /= ymax; P[i + 2] *= 0.5 / xmax; }
        for (let i = 0; i < P.length; i += 9) {
          const ux = P[i + 3] - P[i], uy = P[i + 4] - P[i + 1], uz = P[i + 5] - P[i + 2], vx = P[i + 6] - P[i], vy = P[i + 7] - P[i + 1], vz = P[i + 8] - P[i + 2];
          let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          const l = Math.hypot(nx, ny, nz) || 1;
          for (let k = 0; k < 9; k += 3) { N[i + k] = nx / l; N[i + k + 1] = ny / l; N[i + k + 2] = nz / l; }
        }
        return { pos: P, norm: N, farg: new Float32Array(farg) };
      },
    };
  }

  const MODELLER = {
    gran(niva) {
      const b = bygge();
      if (niva === 'enkel') {
        b.kon(0.03, 0, 0.03, 0.15, 4, FARG.stam);
        b.kon(0.5, 0.1, 0, 1, 6, FARG.gran, { botten: true });
      } else {
        b.kon(0.03, 0, 0.02, 0.3, 6, FARG.stam);
        // våningar som hänger lite nedåt i kanten, smalare uppåt
        const n = 6;
        for (let i = 0; i < n; i++) {
          const y0 = 0.1 + i * 0.13, r0 = 0.5 * (1 - i / (n + 0.6)), y1 = Math.min(1, y0 + 0.3);
          b.kon(r0, y0, i === n - 1 ? 0 : r0 * 0.35, i === n - 1 ? 1 : y1, 10, FARG.gran, { botten: true, vrid: i * 0.6 });
        }
      }
      return b.resultat();
    },
    tall(niva) {
      const b = bygge(), s = slump(7);
      if (niva === 'enkel') {
        b.kon(0.03, 0, 0.025, 0.7, 4, FARG.tallstam);
        b.klump([0, 0.82, 0], 0.5, 0.18, 0.5, 0, 0, FARG.tall, s);
      } else {
        b.kon(0.035, 0, 0.02, 0.85, 6, FARG.tallstam);
        // grenar ut till kronans klumpar
        const klumpar = [[0.18, 0.80, 0.05, 0.30], [-0.2, 0.76, -0.12, 0.27], [0.02, 0.9, -0.2, 0.26], [-0.08, 0.86, 0.22, 0.25], [0, 0.93, 0, 0.24]];
        for (const [x, y, z, r] of klumpar) {
          b.kon(0.012, y - 0.12, 0.008, y, 4, FARG.tallstam, { vrid: x });
          b.klump([x, y, z], r, r * 0.42, r, 1, 0.18, FARG.tall, s);
        }
      }
      return b.resultat();
    },
    lov(niva) {
      const b = bygge(), s = slump(3);
      if (niva === 'enkel') {
        b.kon(0.04, 0, 0.03, 0.4, 4, FARG.stam);
        b.klump([0, 0.62, 0], 0.5, 0.38, 0.5, 0, 0.12, FARG.lov, s);
      } else {
        b.kon(0.045, 0, 0.03, 0.5, 7, FARG.stam);
        const klumpar = [[0, 0.62, 0, 0.36], [0.2, 0.58, 0.1, 0.27], [-0.2, 0.6, -0.08, 0.27], [0.05, 0.6, -0.22, 0.26], [-0.06, 0.6, 0.22, 0.26], [0, 0.8, 0, 0.27]];
        for (const [x, y, z, r] of klumpar) b.klump([x, y, z], r, r * 0.85, r, 1, 0.16, FARG.lov, s);
      }
      return b.resultat();
    },
  };

  // ------------------------------------------------------------------
  // Realistiska träd (0.9.1): stam och grenar som geometri, lövverket som små kort med en
  // genomskinlig bild av blad eller barr (alfatest), så att man ser igenom kronan och skuggan
  // blir prickig. Korten ligger åt olika håll i kronan, så att trädet ser fylligt ut från alla
  // vinklar, också ovanifrån. Normalerna pekar ut från kronans mitt, så att ljuset faller på
  // kronan som helhet i stället för på varje kort.
  // ------------------------------------------------------------------
  /** Lövbildens rutor: en per art, sida vid sida i en bild 3 × 1. */
  const RUTA = { gran: 0, tall: 1, lov: 2 };

  /** Kort med mitten c, axlarna u och v (halva sidor) och normalen n, i lövbildens ruta. */
  function kort(lista, c, u, v, n, ruta, skugg) {
    const h = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [c[0] + u[0] * a + v[0] * b, c[1] + u[1] * a + v[1] * b, c[2] + u[2] * a + v[2] * b]);
    const uv = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([a, b]) => [(ruta + 0.02 + a * 0.96) / 3, 0.02 + b * 0.96]);
    for (const k of [0, 1, 2, 0, 2, 3]) lista.push({ p: h[k], uv: uv[k], n, f: skugg });
  }
  const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const kryss = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  /** Två axlar vinkelräta mot riktningen d, vridna vinkeln a runt den. */
  function axlar(d, a) {
    const hj = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const e1 = norm(kryss(d, hj)), e2 = kryss(d, e1);
    const c = Math.cos(a), s = Math.sin(a);
    return [[e1[0] * c + e2[0] * s, e1[1] * c + e2[1] * s, e1[2] * c + e2[2] * s], [e2[0] * c - e1[0] * s, e2[1] * c - e1[1] * s, e2[2] * c - e1[2] * s]];
  }
  /** Normal utåt från kronans mitt k, lite uppåt; skuggning mörkare inåt och nedåt. */
  function ljusning(p, k, rx, ry) {
    const d = [(p[0] - k[0]) / rx, (p[1] - k[1]) / ry, (p[2] - k[2]) / rx];
    const r = Math.min(1, Math.hypot(d[0], d[1], d[2]));
    return { n: norm([d[0], d[1] + 0.35, d[2]]), skugg: 0.55 + 0.45 * r * (0.75 + 0.25 * Math.max(0, d[1] + 0.5)) };
  }

  const REALISTISK = {
    lov() {
      const b = bygge(), s = slump(11), kortlista = [];
      b.kon(0.05, 0, 0.03, 0.55, 8, FARG.stam);
      const k = [0, 0.6, 0], rx = 0.42, ry = 0.33;
      // grenar ut i kronan
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * 2 * Math.PI + s(), y = 0.38 + s() * 0.2, l = 0.22 + s() * 0.12;
        const mal = [Math.cos(a) * l, y + 0.12 + s() * 0.1, Math.sin(a) * l];
        gren(b, [0, y, 0], mal, 0.014, FARG.stam);
      }
      for (let i = 0; i < 110; i++) {
        // mest nära kronans yta, några längre in
        const t = s() * 2 * Math.PI, f = Math.acos(2 * s() - 1), r = 0.45 + 0.55 * Math.sqrt(s());
        const p = [k[0] + Math.sin(f) * Math.cos(t) * rx * r, k[1] + Math.cos(f) * ry * r, k[2] + Math.sin(f) * Math.sin(t) * rx * r];
        const d = norm([s() * 2 - 1, s() * 2 - 1, s() * 2 - 1]), [u, v] = axlar(d, s() * 6.3), st = 0.11 + s() * 0.05;
        const l = ljusning(p, k, rx, ry);
        kort(kortlista, p, u.map(q => q * st), v.map(q => q * st), l.n, RUTA.lov, l.skugg);
      }
      return { stam: b, kort: kortlista };
    },
    gran() {
      const b = bygge(), s = slump(5), kortlista = [];
      b.kon(0.03, 0, 0.006, 0.97, 7, FARG.stam);
      const varv = 13;
      for (let i = 0; i < varv; i++) {
        const t = i / (varv - 1), y = 0.24 + t * 0.7, R = 0.5 * Math.pow(1 - t * 0.97, 0.95), antal = Math.max(4, Math.round(9 - t * 4));
        for (let n = 0; n < antal; n++) {
          // en gren: ett kort ut från stammen, lite hängande i yttre änden
          const a = n / antal * 2 * Math.PI + i * 0.7 + s() * 0.4, l = R * (0.8 + s() * 0.2);
          const ut = [Math.cos(a), 0, Math.sin(a)], hang = -0.25 - s() * 0.2;
          const d = norm([ut[0], hang, ut[2]]), sid = [-ut[2], 0, ut[0]];
          const c = [ut[0] * l * 0.55, y + hang * l * 0.45, ut[2] * l * 0.55];
          const vv = d.map(q => q * l * 0.5), uu = sid.map(q => q * Math.max(0.05, l * 0.32));
          const nn = norm([ut[0] * 0.6, 1, ut[2] * 0.6]);
          kort(kortlista, c, uu, vv, nn, RUTA.gran, 0.6 + 0.4 * (0.4 + 0.6 * t) * (0.7 + 0.3 * (n % 2)));
        }
      }
      // toppskottet
      kort(kortlista, [0, 0.95, 0], [0.03, 0, 0], [0, 0.05, 0], [0, 1, 0], RUTA.gran, 1);
      kort(kortlista, [0, 0.95, 0], [0, 0, 0.03], [0, 0.05, 0], [0, 1, 0], RUTA.gran, 1);
      return { stam: b, kort: kortlista };
    },
    tall() {
      const b = bygge(), s = slump(9), kortlista = [];
      b.kon(0.035, 0, 0.018, 0.9, 7, FARG.tallstam);
      const klumpar = [[0.2, 0.78, 0.06, 0.2], [-0.22, 0.74, -0.12, 0.18], [0.03, 0.88, -0.22, 0.18], [-0.08, 0.84, 0.22, 0.17], [0, 0.94, 0, 0.17], [0.16, 0.9, 0.16, 0.14]];
      for (const [x, y, z, r] of klumpar) {
        gren(b, [0, y - 0.14, 0], [x * 0.8, y, z * 0.8], 0.012, FARG.tallstam);
        for (let i = 0; i < 18; i++) {
          const t = s() * 2 * Math.PI, f = Math.acos(2 * s() - 1), rr = 0.4 + 0.6 * Math.sqrt(s());
          const p = [x + Math.sin(f) * Math.cos(t) * r * rr, y + Math.cos(f) * r * 0.45 * rr, z + Math.sin(f) * Math.sin(t) * r * rr];
          const d = norm([s() * 0.8 - 0.4, 1, s() * 0.8 - 0.4]), [u, v] = axlar(d, s() * 6.3), st = 0.07 + s() * 0.04;
          const l = ljusning(p, [x, y, z], r, r * 0.45);
          kort(kortlista, p, u.map(q => q * st), v.map(q => q * st), l.n, RUTA.tall, l.skugg);
        }
      }
      return { stam: b, kort: kortlista };
    },
  };
  /** En gren som smal kon från a till b. */
  function gren(b, a, mal, r, f) {
    const d = [mal[0] - a[0], mal[1] - a[1], mal[2] - a[2]], l = Math.hypot(...d), dn = norm(d), [u, v] = axlar(dn, 0), seg = 4;
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * 2 * Math.PI, a1 = (i + 1) / seg * 2 * Math.PI;
      const ring = (ang, rr, t) => [0, 1, 2].map(k => a[k] + dn[k] * l * t + (u[k] * Math.cos(ang) + v[k] * Math.sin(ang)) * rr);
      const p00 = ring(a0, r, 0), p01 = ring(a1, r, 0), p1 = ring(0, 0, 1);
      b.tri(p00, p01, p1, f);
    }
  }

  const realCache = {};
  /**
   * Realistisk modell för en art (0.9.1): { stam: { pos, norm, farg }, lov: { pos, norm, uv, farg } }.
   * Stammen har en normal per yta, lövkorten normaler ut från kronan och ljushet per hörn (gråskala,
   * som multipliceras med lövbildens färger). Skalad till 1 × 1 m som de andra modellerna.
   */
  function realistisk(art) {
    if (realCache[art]) return realCache[art];
    const { stam, kort: kl } = REALISTISK[art]();
    // gemensam skala för stammen och korten: 1 m hög, 1 m bred
    const rå = stam.ra();
    let xmax = 0, ymax = 0;
    for (let i = 0; i < rå.pos.length; i += 3) { xmax = Math.max(xmax, Math.abs(rå.pos[i]), Math.abs(rå.pos[i + 2])); ymax = Math.max(ymax, rå.pos[i + 1]); }
    for (const q of kl) { xmax = Math.max(xmax, Math.abs(q.p[0]), Math.abs(q.p[2])); ymax = Math.max(ymax, q.p[1]); }
    const sx = 0.5 / xmax, sy = 1 / ymax;
    const P = new Float32Array(rå.pos.length);
    for (let i = 0; i < P.length; i += 3) { P[i] = rå.pos[i] * sx; P[i + 1] = rå.pos[i + 1] * sy; P[i + 2] = rå.pos[i + 2] * sx; }
    const stamUt = { pos: P, norm: ytnormaler(P), farg: new Float32Array(rå.farg) };
    const lp = new Float32Array(kl.length * 3), ln = new Float32Array(kl.length * 3), lu = new Float32Array(kl.length * 2), lf = new Float32Array(kl.length * 3);
    kl.forEach((q, i) => {
      lp[i * 3] = q.p[0] * sx; lp[i * 3 + 1] = q.p[1] * sy; lp[i * 3 + 2] = q.p[2] * sx;
      ln.set(q.n, i * 3); lu.set(q.uv, i * 2); lf.set([q.f, q.f, q.f], i * 3);
    });
    return (realCache[art] = { stam: stamUt, lov: { pos: lp, norm: ln, uv: lu, farg: lf } });
  }
  /** En normal per triangel. */
  function ytnormaler(P) {
    const N = new Float32Array(P.length);
    for (let i = 0; i < P.length; i += 9) {
      const ux = P[i + 3] - P[i], uy = P[i + 4] - P[i + 1], uz = P[i + 5] - P[i + 2], vx = P[i + 6] - P[i], vy = P[i + 7] - P[i + 1], vz = P[i + 8] - P[i + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
      for (let k = 0; k < 9; k += 3) { N[i + k] = nx / l; N[i + k + 1] = ny / l; N[i + k + 2] = nz / l; }
    }
    return N;
  }

  /**
   * Ritar lövbilden (3 rutor: gran, tall, lövträd) på en canvas 2D, genomskinlig mellan bladen.
   * ctx: CanvasRenderingContext2D med bredden 3 × storleken och höjden storleken.
   */
  function ritaLovbild(ctx, storlek = 512) {
    const S = storlek;
    ctx.clearRect(0, 0, 3 * S, S);
    const s = slump(21);
    const gron = (h, l, a = 1) => `hsla(${h}, ${45 + s() * 20}%, ${l}%, ${a})`;
    // gran: en grenspets med sidoskott och täta barr
    {
      const ox = 0, kvist = (x0, y0, x1, y1, tjock, barr) => {
        ctx.strokeStyle = 'rgb(70, 55, 40)'; ctx.lineWidth = tjock;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        const l = Math.hypot(x1 - x0, y1 - y0), n = Math.round(l / 3);
        for (let i = 0; i < n; i++) {
          const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, a = Math.atan2(y1 - y0, x1 - x0);
          for (const sida of [-1, 1]) {
            const v = a + sida * (0.9 + s() * 0.4), bl = barr * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 1.2)));
            ctx.strokeStyle = gron(115 + s() * 20, 18 + s() * 14); ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(v) * bl, y + Math.sin(v) * bl); ctx.stroke();
          }
        }
      };
      // grenen går nerifrån (vid stammen) och upp (spetsen)
      kvist(ox + S * 0.5, S * 0.98, ox + S * 0.5, S * 0.04, 4, S * 0.07);
      for (let i = 0; i < 9; i++) {
        const t = 0.12 + i * 0.09, y = S * (0.98 - t * 0.94), l = S * (0.34 - t * 0.22);
        for (const sida of [-1, 1]) kvist(ox + S * 0.5, y, ox + S * 0.5 + sida * l, y - l * 0.55, 2.2, S * 0.045);
      }
    }
    // tall: tofsar av långa barr
    {
      const ox = S;
      for (let n = 0; n < 9; n++) {
        const cx = ox + S * (0.22 + s() * 0.56), cy = S * (0.22 + s() * 0.56), r = S * (0.13 + s() * 0.08);
        ctx.strokeStyle = 'rgb(110, 70, 45)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(ox + S * 0.5, S * 0.98); ctx.lineTo(cx, cy); ctx.stroke();
        for (let i = 0; i < 70; i++) {
          const a = s() * 2 * Math.PI, l = r * (0.5 + s() * 0.5);
          ctx.strokeStyle = gron(95 + s() * 25, 26 + s() * 18); ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); ctx.stroke();
        }
      }
    }
    // lövträd: blad i en klunga runt några kvistar
    {
      const ox = 2 * S;
      ctx.strokeStyle = 'rgb(85, 65, 48)'; ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(ox + S * 0.5, S); ctx.lineTo(ox + S * (0.15 + s() * 0.7), S * (0.1 + s() * 0.5)); ctx.stroke(); }
      for (let i = 0; i < 260; i++) {
        const a = s() * 2 * Math.PI, rr = Math.sqrt(s()) * 0.46, x = ox + S * (0.5 + Math.cos(a) * rr), y = S * (0.5 + Math.sin(a) * rr);
        const l = S * (0.035 + s() * 0.03), b = l * (0.45 + s() * 0.15), v = s() * 2 * Math.PI;
        ctx.save(); ctx.translate(x, y); ctx.rotate(v);
        ctx.fillStyle = gron(85 + s() * 35, 24 + s() * 22 + (1 - rr * 2) * 6);
        ctx.beginPath(); ctx.moveTo(-l, 0); ctx.quadraticCurveTo(0, -b, l, 0); ctx.quadraticCurveTo(0, b, -l, 0); ctx.fill();
        ctx.restore();
      }
    }
  }

  const cache = {};
  /** Modellen för en art ('gran', 'tall', 'lov') och nivå ('enkel', 'detaljerad'). */
  function modell(art, niva) {
    const k = art + ':' + niva;
    return cache[k] || (cache[k] = MODELLER[art](niva === 'enkel' ? 'enkel' : 'detaljerad'));
  }

  /** Gissad art ur formen: smala och höga blir granar, höga med smalare krona tallar, resten lövträd. */
  function art(t) {
    const h = t.hojd, k = Math.max(0.5, t.krona), kvot = h / k;
    if (kvot >= 2.4) return 'gran';
    if (h >= 12 && kvot >= 1.6) return 'tall';
    return 'lov';
  }

  /** Vridning (radianer) och ljushet (0,85–1,15) per träd, samma varje gång för samma läge. */
  function variation(t) {
    const s = slump(Math.round(t.x * 10) * 73856093 ^ Math.round(t.y * 10) * 19349663);
    return { vrid: s() * 2 * Math.PI, ljus: 0.85 + s() * 0.3 };
  }

  return { modell, realistisk, ritaLovbild, art, variation, ARTER: ['gran', 'tall', 'lov'] };
}));
