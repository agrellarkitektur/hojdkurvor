/*
 * Trädmodeller för 3D-vyn (0.9.0). Ren geometri utan three.js, så att den kan testas i Node.
 *
 * Tre modeller: gran, tall och lövträd, var och en i två nivåer: 'enkel' (low-poly, för
 * mobilen och träd långt bort) och 'detaljerad'. En modell är 1 m hög och 1 m bred med
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

  return { modell, art, variation, ARTER: ['gran', 'tall', 'lov'] };
}));
