/*
 * Trädmodellerna i 3D-vyn. Ren geometri utan three.js, så att den kan testas i Node.
 *
 * Två nivåer: 'enkel' (en kon eller en klump, för mobilen och träd långt bort) och 'detaljerad'.
 * Sedan 0.10.0 är de detaljerade stiliserad low-poly: lätt böjda stammar som smalnar av, kronor av
 * många facetterade klumpar i dämpade, lite olika gröna toner, och flera varianter per art (två
 * granar, två tallar, två lövträd och en björk), så att skogen inte ser kopierad ut. Ingen textur:
 * formen och ljuset gör jobbet, som i en arkitektmodell. De realistiska träden med lövkort (0.9.1)
 * är borttagna.
 *
 * En modell är 1 m hög och 1 m bred med stammens fot i origo; 3D-vyn skalar den till laserns
 * trädhöjd och kronbredd. Arten gissas ur formen (höjd mot kronbredd), inte ur någon artdata;
 * varianten väljs ur trädets läge (samma varje gång).
 *
 * Utdata: { pos, norm, farg } som Float32Array, tre värden per hörn, trianglar utan index,
 * en normal per yta (facetterat).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Trad3D = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // dämpade färger, ungefär som en målad modell (linjära rgb-värden, ljusas av ljuset i scenen)
  const FARG = {
    stam: [0.36, 0.29, 0.23],
    tallstam: [0.58, 0.32, 0.17],
    tallbas: [0.38, 0.30, 0.25],
    bjorkstam: [0.86, 0.85, 0.80],
    bjorkflack: [0.20, 0.19, 0.18],
    gran: [0.16, 0.27, 0.19],
    granLjus: [0.24, 0.36, 0.24],
    tall: [0.26, 0.37, 0.21],
    tallLjus: [0.33, 0.44, 0.25],
    lov: [0.32, 0.45, 0.20],
    lovLjus: [0.42, 0.53, 0.24],
    bjork: [0.44, 0.55, 0.24],
    bjorkLjus: [0.52, 0.61, 0.28],
  };

  /** Slumptal 0–1 ur ett frö, samma varje gång. */
  function slump(fro) {
    let s = (fro * 2654435761) >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const blanda = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const skala = (f, k) => [f[0] * k, f[1] * k, f[2] * k];

  /** Samlar trianglar med en färg per yta. */
  function bygge() {
    const pos = [], farg = [];
    const tri = (a, b, c, f) => { for (const p of [a, b, c]) { pos.push(p[0], p[1], p[2]); farg.push(f[0], f[1], f[2]); } };
    return {
      tri,
      /** Kon eller stympad kon: radie r0 vid y0, r1 vid y1, seg sidor, med botten om botten. */
      kon(r0, y0, r1, y1, seg, f, { botten = false, vrid = 0, mitt = [0, 0], ojamn = 0, s = null, hang = 0 } = {}) {
        // ojämn kant: varje hörn i nedre ringen får egen radie och höjd (hängande granris)
        const rr = [], hh = [];
        for (let i = 0; i < seg; i++) { rr.push(r0 * (1 + (s ? (s() * 2 - 1) * ojamn : 0))); hh.push(Math.max(0, y0 - (s ? s() * hang : 0))); }
        const p0 = i => { const a = vrid + (i % seg) / seg * 2 * Math.PI; return [mitt[0] + rr[i % seg] * Math.cos(a), hh[i % seg], mitt[1] + rr[i % seg] * Math.sin(a)]; };
        const p1 = i => { const a = vrid + (i % seg) / seg * 2 * Math.PI; return [mitt[0] + r1 * Math.cos(a), y1, mitt[1] + r1 * Math.sin(a)]; };
        for (let i = 0; i < seg; i++) {
          const p00 = p0(i), p01 = p0(i + 1), p10 = p1(i), p11 = p1(i + 1);
          // utåtvända ytor (moturs sett utifrån)
          tri(p00, p10, p01, f);
          if (r1 > 0) tri(p01, p10, p11, f);
          if (botten && r0 > 0) tri([mitt[0], y0, mitt[1]], p00, p01, skala(f, 0.7));
        }
      },
      /**
       * Stam längs en lätt böjd linje: från (0, 0, 0) upp till höjden h, radien r0 nertill och r1
       * upptill, böjd b åt riktningen v (radianer). seg sidor, ringar avsnitt. Ger punkten högst upp.
       */
      stam(h, r0, r1, b, v, seg, ringar, f, { f1 = null, flackar = null, s = null } = {}) {
        const mittVid = t => [Math.cos(v) * b * Math.sin(t * Math.PI * 0.85), t * h, Math.sin(v) * b * Math.sin(t * Math.PI * 0.85)];
        const ring = t => {
          const c = mittVid(t), r = r0 + (r1 - r0) * t;
          return Array.from({ length: seg }, (_, i) => { const a = i / seg * 2 * Math.PI + t; return [c[0] + r * Math.cos(a), c[1], c[2] + r * Math.sin(a)]; });
        };
        let forra = ring(0);
        for (let k = 1; k <= ringar; k++) {
          const t = k / ringar, ny = ring(t);
          for (let i = 0; i < seg; i++) {
            let fa = f1 ? blanda(f, f1, (k - 0.5) / ringar) : f;
            if (flackar && s && s() < flackar) fa = FARG.bjorkflack;
            tri(forra[i], ny[i], forra[(i + 1) % seg], fa);
            tri(forra[(i + 1) % seg], ny[i], ny[(i + 1) % seg], fa);
          }
          forra = ny;
        }
        return { topp: mittVid(1), vid: mittVid };
      },
      /** Gren som smal kon från a till b. */
      gren(a, mal, r, f) {
        const d = [mal[0] - a[0], mal[1] - a[1], mal[2] - a[2]], l = Math.hypot(...d), dn = norm(d), [u, v] = axlar(dn), seg = 4;
        const ring = (ang, rr, t) => [0, 1, 2].map(k => a[k] + dn[k] * l * t + (u[k] * Math.cos(ang) + v[k] * Math.sin(ang)) * rr);
        for (let i = 0; i < seg; i++) {
          const a0 = i / seg * 2 * Math.PI, a1 = (i + 1) / seg * 2 * Math.PI;
          tri(ring(a0, r, 0), ring(0, 0, 1), ring(a1, r, 0), f);
        }
      },
      /**
       * Klump: ikosaeder delad n gånger, ojämn med ojamn (0–1), skalad till rx, ry, rz runt c.
       * Färgen ljusnar uppåt och utåt och mörknar under, som om ljuset kom ovanifrån.
       */
      klump(c, rx, ry, rz, n, ojamn, f, s, { ljus = null } = {}) {
        const t = (1 + Math.sqrt(5)) / 2;
        const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
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
        for (const [a, b, c2] of ytor) {
          const ny = (v[a][1] + v[b][1] + v[c2][1]) / 3;   // −1 under, 1 överst
          const ton = ljus ? blanda(f, ljus, Math.max(0, Math.min(1, 0.5 + ny * 0.5 + (s() - 0.5) * 0.35))) : f;
          tri(p[a], p[b], p[c2], skala(ton, 0.82 + 0.18 * Math.max(-0.4, ny)));
        }
      },
      /** Skalar till 1 m bredd och 1 m höjd (foten kvar i origo) och räknar en normal per yta. */
      resultat() {
        const P = new Float32Array(pos);
        let xmax = 0, ymax = 0;
        for (let i = 0; i < P.length; i += 3) { xmax = Math.max(xmax, Math.abs(P[i]), Math.abs(P[i + 2])); ymax = Math.max(ymax, P[i + 1]); }
        for (let i = 0; i < P.length; i += 3) { P[i] *= 0.5 / xmax; P[i + 1] /= ymax; P[i + 2] *= 0.5 / xmax; }
        return { pos: P, norm: ytnormaler(P), farg: new Float32Array(farg) };
      },
    };
  }
  const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const kryss = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  /** Två axlar vinkelräta mot riktningen d. */
  function axlar(d) {
    const hj = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const e1 = norm(kryss(d, hj));
    return [e1, kryss(d, e1)];
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

  /** Klumpar spridda över en ellipsoid (kronan), större i mitten, mindre ute i kanten. */
  function krona(b, s, { c, rx, ry, antal, storlek, f, ljus, platt = 0.85, n = 1, ojamn = 0.2, hang = 0 }) {
    b.klump(c, rx * 0.72, ry * 0.72, rx * 0.72, n, ojamn * 0.6, f, s, { ljus });
    for (let i = 0; i < antal; i++) {
      const a = i / antal * 2 * Math.PI + s() * 0.9, h = (s() * 2 - 1) * 0.8, l = Math.sqrt(1 - h * h);
      const r = storlek * (0.75 + s() * 0.5);
      const p = [c[0] + Math.cos(a) * l * rx * 0.62, c[1] + h * ry * 0.62 - hang * (1 - h) * 0.5, c[2] + Math.sin(a) * l * rx * 0.62];
      b.klump(p, r, r * platt, r, n, ojamn, f, s, { ljus });
    }
  }

  const MODELLER = {
    // --- granar: våningar av ojämna koner med hängande kant, mörkare nertill
    gran(niva, s) {
      const b = bygge();
      if (niva === 'enkel') {
        b.kon(0.03, 0, 0.03, 0.15, 4, FARG.stam);
        b.kon(0.5, 0.1, 0, 1, 6, FARG.gran, { botten: true });
        return b.resultat();
      }
      b.stam(0.4, 0.04, 0.02, 0.01, s() * 6, 5, 2, FARG.stam);
      const n = 8;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), y0 = 0.08 + t * 0.78, r0 = 0.5 * Math.pow(1 - t * 0.92, 1.05) * (0.92 + s() * 0.16);
        const topp = i === n - 1;
        b.kon(r0, y0, topp ? 0 : r0 * 0.3, topp ? 1 : Math.min(0.97, y0 + 0.2 + 0.06 * (1 - t)), 8,
          blanda(FARG.gran, FARG.granLjus, 0.15 + 0.6 * t + s() * 0.15), { botten: true, vrid: s() * 6, ojamn: 0.3, hang: 0.1, s, mitt: [(s() - 0.5) * 0.03, (s() - 0.5) * 0.03] });
      }
      return b.resultat();
    },
    // smalare gran med fler, kortare våningar
    gran2(niva, s) {
      if (niva === 'enkel') return MODELLER.gran(niva, s);
      const b = bygge();
      b.stam(0.3, 0.035, 0.02, 0.01, s() * 6, 5, 2, FARG.stam);
      const n = 11;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), y0 = 0.06 + t * 0.84, r0 = 0.5 * (1 - t * 0.95) * (0.9 + s() * 0.2), topp = i === n - 1;
        b.kon(r0, y0, topp ? 0 : r0 * 0.35, topp ? 1 : Math.min(0.97, y0 + 0.14), 7,
          blanda(FARG.gran, FARG.granLjus, 0.1 + 0.5 * t + s() * 0.2), { botten: true, vrid: s() * 6, ojamn: 0.3, hang: 0.07, s });
      }
      return b.resultat();
    },
    // --- tallar: hög, böjd, rödbrun stam och en platt krona av klumpar högst upp
    tall(niva, s) {
      const b = bygge();
      if (niva === 'enkel') {
        b.kon(0.03, 0, 0.025, 0.7, 4, FARG.tallstam);
        b.klump([0, 0.82, 0], 0.5, 0.18, 0.5, 0, 0, FARG.tall, s);
        return b.resultat();
      }
      const st = b.stam(0.9, 0.035, 0.016, 0.05, s() * 6, 6, 5, FARG.tallbas, { f1: FARG.tallstam });
      const klumpar = [[0.2, 0.76, 0.08, 0.2], [-0.22, 0.72, -0.1, 0.19], [0.03, 0.85, -0.22, 0.18], [-0.1, 0.83, 0.2, 0.18], [0, 0.94, 0, 0.17], [0.16, 0.9, 0.14, 0.13]];
      for (const [x, y, z, r] of klumpar) {
        const fot = st.vid((y - 0.12) / 0.9);
        const p = [fot[0] + x, y, fot[2] + z];
        b.gren([fot[0], y - 0.12, fot[2]], [p[0] * 0.85 + fot[0] * 0.15, y, p[2] * 0.85 + fot[2] * 0.15], 0.012, FARG.tallstam);
        b.klump(p, r, r * 0.45, r, 1, 0.22, blanda(FARG.tall, FARG.tallLjus, s() * 0.4), s, { ljus: FARG.tallLjus });
      }
      return b.resultat();
    },
    tall2(niva, s) {
      if (niva === 'enkel') return MODELLER.tall(niva, s);
      const b = bygge();
      const st = b.stam(0.8, 0.04, 0.02, 0.09, s() * 6, 6, 5, FARG.tallbas, { f1: FARG.tallstam });
      // ojämnare krona, lite åt sidan där stammen böjer
      for (let i = 0; i < 6; i++) {
        const y = 0.62 + i * 0.065 + s() * 0.04, fot = st.vid(Math.min(1, y / 0.8)), a = s() * 6.3, l = 0.1 + s() * 0.14, r = 0.13 + s() * 0.07;
        const p = [fot[0] + Math.cos(a) * l, y + 0.05, fot[2] + Math.sin(a) * l];
        b.gren([fot[0], y - 0.04, fot[2]], p, 0.011, FARG.tallstam);
        b.klump(p, r, r * 0.5, r * 1.1, 1, 0.24, blanda(FARG.tall, FARG.tallLjus, s() * 0.5), s, { ljus: FARG.tallLjus });
      }
      return b.resultat();
    },
    // --- lövträd: kort stam som delar sig, rund krona av många klumpar
    lov(niva, s) {
      const b = bygge();
      if (niva === 'enkel') {
        b.kon(0.04, 0, 0.03, 0.4, 4, FARG.stam);
        b.klump([0, 0.62, 0], 0.5, 0.38, 0.5, 0, 0.12, FARG.lov, s);
        return b.resultat();
      }
      const st = b.stam(0.42, 0.05, 0.032, 0.04, s() * 6, 6, 3, FARG.stam);
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * 2 * Math.PI + s();
        b.gren(st.topp, [st.topp[0] + Math.cos(a) * 0.17, 0.62, st.topp[2] + Math.sin(a) * 0.17], 0.02, FARG.stam);
      }
      krona(b, s, { c: [st.topp[0] * 0.5, 0.64, st.topp[2] * 0.5], rx: 0.46, ry: 0.36, antal: 7, storlek: 0.2, f: FARG.lov, ljus: FARG.lovLjus });
      return b.resultat();
    },
    // högre, ovalare lövträd
    lov2(niva, s) {
      if (niva === 'enkel') return MODELLER.lov(niva, s);
      const b = bygge();
      const st = b.stam(0.5, 0.045, 0.028, 0.06, s() * 6, 6, 3, FARG.stam);
      for (let i = 0; i < 2; i++) {
        const a = i * Math.PI + s();
        b.gren(st.topp, [st.topp[0] + Math.cos(a) * 0.12, 0.7, st.topp[2] + Math.sin(a) * 0.12], 0.018, FARG.stam);
      }
      krona(b, s, { c: [st.topp[0] * 0.6, 0.68, st.topp[2] * 0.6], rx: 0.38, ry: 0.42, antal: 6, storlek: 0.19, f: blanda(FARG.lov, FARG.bjork, 0.3), ljus: FARG.lovLjus, platt: 1 });
      return b.resultat();
    },
    // björk: smal vit stam med mörka fläckar, gles och lite hängande krona
    bjork(niva, s) {
      if (niva === 'enkel') return MODELLER.lov(niva, s);
      const b = bygge();
      const st = b.stam(0.72, 0.032, 0.012, 0.07, s() * 6, 5, 6, FARG.bjorkstam, { flackar: 0.22, s });
      for (let i = 0; i < 4; i++) {
        const t = 0.55 + i * 0.12, fot = st.vid(t), a = s() * 6.3;
        b.gren(fot, [fot[0] + Math.cos(a) * 0.14, fot[1] + 0.12, fot[2] + Math.sin(a) * 0.14], 0.01, FARG.bjorkstam);
      }
      krona(b, s, { c: [st.topp[0] * 0.7, 0.66, st.topp[2] * 0.7], rx: 0.36, ry: 0.36, antal: 6, storlek: 0.15, f: FARG.bjork, ljus: FARG.bjorkLjus, platt: 1.15, ojamn: 0.26, hang: 0.08 });
      return b.resultat();
    },
  };

  /** Varianterna per art; en variant i 'enkel' är artens enkla modell. */
  const VARIANTER = { gran: ['gran', 'gran2'], tall: ['tall', 'tall2'], lov: ['lov', 'lov2', 'bjork'] };
  const TYPER = [].concat(...Object.values(VARIANTER));
  const FRO = { gran: 5, gran2: 12, tall: 7, tall2: 15, lov: 3, lov2: 18, bjork: 9 };

  const cache = {};
  /** Modellen för en typ ('gran', 'gran2', 'tall', 'tall2', 'lov', 'lov2', 'bjork') och nivå ('enkel', 'detaljerad'). */
  function modell(typ, niva) {
    if (!MODELLER[typ]) typ = 'lov';
    const n = niva === 'enkel' ? 'enkel' : 'detaljerad', k = (n === 'enkel' ? artFor(typ) : typ) + ':' + n;
    return cache[k] || (cache[k] = MODELLER[n === 'enkel' ? artFor(typ) : typ](n, slump(FRO[typ])));
  }
  const artFor = typ => Object.keys(VARIANTER).find(a => VARIANTER[a].includes(typ)) || 'lov';

  /** Gissad art ur formen: smala och höga blir granar, höga med smalare krona tallar, resten lövträd. */
  function art(t) {
    const h = t.hojd, k = Math.max(0.5, t.krona), kvot = h / k;
    if (kvot >= 2.4) return 'gran';
    if (h >= 12 && kvot >= 1.6) return 'tall';
    return 'lov';
  }

  /** Vridning (radianer), ljushet (0,85–1,15) och variant (0–1) per träd, samma varje gång för samma läge. */
  function variation(t) {
    const s = slump(Math.round(t.x * 10) * 73856093 ^ Math.round(t.y * 10) * 19349663);
    return { vrid: s() * 2 * Math.PI, ljus: 0.85 + s() * 0.3, variant: s() };
  }

  /** Modelltypen för ett träd: arten ur formen och en variant ur läget (ungefär var tredje lövträd blir en björk). */
  function typ(t) {
    const a = art(t), v = variation(t).variant, lista = VARIANTER[a];
    if (a === 'lov') return v < 0.4 ? 'lov' : v < 0.65 ? 'lov2' : 'bjork';
    return lista[Math.min(lista.length - 1, Math.floor(v * lista.length))];
  }

  return { modell, art, typ, artFor, variation, ARTER: ['gran', 'tall', 'lov'], TYPER, VARIANTER };
}));
