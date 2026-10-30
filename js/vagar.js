/*
 * Vägar från OpenStreetMap (ODbL) via Overpass API, som mittlinjer i utsnittet.
 *
 * Sedan 0.11.0 delas de i bilvägar och gångvägar (`slag`: 'bil' eller 'gang'), och appen kan
 * göra ett utkast till vägytorna: bredden ur OSM-taggarna (width, lanes) eller en schablon per
 * vägtyp, för bilvägarna mätt i ortofotot om det finns. Ytorna slås ihop i ett rutnät (så att
 * korsningarna blir en sammanhängande yta) och ritas som slutna polylinjer. Ingen AI: mätningen
 * går ut från mittlinjen åt båda håll och stannar där färgen slutar likna vägbanan.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Vagar = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const T = () => (typeof Terrang !== 'undefined' ? Terrang : globalThis.Terrang);
  const URL_STD = 'https://overpass-api.de/api/interpreter';

  // lager, DXF-färg (ACI), linjebredd i utskriften (mm), streckning och slag (bil eller gång)
  const KLASSER = {
    VAG_HUVUDVAG: { aci: 1, mm: 0.55, slag: 'bil', namn: 'Huvudvägar (motorväg till tertiär väg)' },
    VAG_LOKALGATA: { aci: 7, mm: 0.4, slag: 'bil', namn: 'Lokalgator, bostadsgator och tillfarter' },
    VAG_OVRIG: { aci: 8, mm: 0.3, slag: 'bil', namn: 'Övriga vägar (skogsbilväg, traktorväg m.fl.)' },
    VAG_GANG_CYKEL: { aci: 3, mm: 0.22, streck: true, slag: 'gang', namn: 'Gång- och cykelvägar, stigar och trappor' },
  };
  // vägytorna (0.11.0)
  const YTLAGER = {
    VAG_YTA_BIL: { aci: 8, namn: 'Bilvägarnas ytor (utkast)' },
    VAG_YTA_GANG: { aci: 3, namn: 'Gång- och cykelvägarnas ytor (utkast)' },
  };
  const SLAGNAMN = { bil: 'Bilvägar', gang: 'Gång- och cykelvägar' };

  function klass(h) {
    if (/^(motorway|trunk|primary|secondary|tertiary)(_link)?$/.test(h)) return 'VAG_HUVUDVAG';
    if (/^(residential|unclassified|living_street|service|road)$/.test(h)) return 'VAG_LOKALGATA';
    if (/^(footway|cycleway|path|pedestrian|steps|bridleway|corridor|sidewalk|crossing)$/.test(h)) return 'VAG_GANG_CYKEL';
    if (/^(proposed|construction|abandoned|disused|razed|platform|raceway|bus_stop|elevator)$/.test(h)) return null;
    return 'VAG_OVRIG';
  }
  const slag = lager => (KLASSER[lager] ? KLASSER[lager].slag : 'bil');

  /*
   * Bredd i meter för hela vägen (båda riktningarna) när OSM inte anger den. Ungefärliga mått för
   * svenska vägar (vägbana utan diken); motorväg och motortrafikled är en körbana per riktning i OSM.
   */
  const SCHABLON = {
    motorway: 11, trunk: 9, primary: 8, secondary: 7, tertiary: 6.5,
    motorway_link: 5.5, trunk_link: 5.5, primary_link: 5, secondary_link: 5, tertiary_link: 5,
    residential: 5.5, unclassified: 5, living_street: 4.5, road: 5, service: 3.5, track: 3,
    footway: 2, cycleway: 2.5, path: 1.2, pedestrian: 5, steps: 1.8, bridleway: 2, corridor: 2, sidewalk: 2, crossing: 2.5,
  };
  const KORFALT = 3.25;
  /** OSM:s width ("5", "5.5 m", "5,5") i meter, eller null. */
  function tolkaBredd(v) {
    if (v == null) return null;
    const m = /^\s*([0-9]+(?:[.,][0-9]+)?)\s*(m)?\s*$/.exec(String(v));
    if (!m) return null;
    const b = parseFloat(m[1].replace(',', '.'));
    return b > 0.3 && b < 60 ? b : null;
  }
  /** Bredden för en linje: { bredd, kalla } där kalla är 'osm' (width), 'korfalt' (lanes) eller 'schablon'. */
  function schablon(l) {
    const b = tolkaBredd(l.bredd);
    if (b) return { bredd: b, kalla: 'osm' };
    const k = parseInt(l.korfalt, 10);
    if (k > 0 && k < 12 && slag(l.lager) === 'bil') return { bredd: Math.round((k * KORFALT + 0.5) * 10) / 10, kalla: 'korfalt' };
    let s = SCHABLON[l.typ];
    if (s == null) s = slag(l.lager) === 'gang' ? 1.5 : 4;
    if (l.typ === 'service' && /^(driveway|parking_aisle)$/.test(l.service || '')) s = 3;
    if (l.enkelriktad && /^(primary|secondary|tertiary|residential|unclassified)$/.test(l.typ)) s = Math.max(3.5, s * 0.6);
    return { bredd: s, kalla: 'schablon' };
  }

  /** Klipper en polylinje mot en rektangel (Liang–Barsky per segment). Returnerar delar. */
  function klipp(pts, r) {
    const delar = [];
    let aktuell = null;
    for (let i = 1; i < pts.length; i++) {
      let [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const dx = x1 - x0, dy = y1 - y0;
      let t0 = 0, t1 = 1, ok = true;
      for (const [p, q] of [[-dx, x0 - r.xmin], [dx, r.xmax - x0], [-dy, y0 - r.ymin], [dy, r.ymax - y0]]) {
        if (p === 0) { if (q < 0) { ok = false; break; } }
        else {
          const t = q / p;
          if (p < 0) { if (t > t1) { ok = false; break; } if (t > t0) t0 = t; }
          else { if (t < t0) { ok = false; break; } if (t < t1) t1 = t; }
        }
      }
      if (!ok) { aktuell = null; continue; }
      const a = [x0 + t0 * dx, y0 + t0 * dy], b = [x0 + t1 * dx, y0 + t1 * dy];
      if (!aktuell || t0 > 0) { aktuell = [a]; delar.push(aktuell); }
      aktuell.push(b);
      if (t1 < 1) aktuell = null;
    }
    return delar.filter(d => d.length > 1);
  }

  /** Gör om Overpass-svaret till linjer i zonen, klippta mot r (utan marginal: ytorna behöver vägarna lite utanför). */
  function tolka(d, tillZon, r, marg = 0) {
    const rm = { xmin: r.xmin - marg, ymin: r.ymin - marg, xmax: r.xmax + marg, ymax: r.ymax + marg };
    const linjer = [];
    for (const el of d.elements || []) {
      if (el.type !== 'way' || !el.geometry || !el.tags) continue;
      const tg = el.tags;
      const lager = klass(tg.highway || '');
      if (!lager) continue;
      if (tg.area === 'yes' && tg.highway !== 'pedestrian') continue;
      const pts = el.geometry.map(g => tillZon([g.lon, g.lat]));
      const extra = {};
      if (tg.width != null) extra.bredd = tg.width;
      if (tg.lanes != null) extra.korfalt = tg.lanes;
      if (tg.oneway === 'yes' || tg.oneway === '1') extra.enkelriktad = true;
      if (tg.surface) extra.ytskikt = tg.surface;
      if (tg.service) extra.service = tg.service;
      for (const del of klipp(pts, rm)) linjer.push(Object.assign({ lager, slag: slag(lager), typ: tg.highway, namn: tg.name || '', pts: del }, extra));
    }
    return linjer;
  }

  /**
   * Hämtar vägar inom utsnittet (i zonen). Returnerar { linjer: [{lager, slag, typ, namn, pts, bredd?, …}], antal }.
   * `linjer` är klippta mot utsnittet; `alla` går `marg` meter utanför (för ytorna).
   */
  async function hamta({ utsnitt: r, epsg, marg = 20 }) {
    const tillLL = T().omvandlare(epsg, 4326).forward, tillZon = T().omvandlare(4326, epsg).forward;
    const hörn = [[r.xmin - marg, r.ymin - marg], [r.xmax + marg, r.ymin - marg], [r.xmax + marg, r.ymax + marg], [r.xmin - marg, r.ymax + marg]].map(tillLL);
    const s = Math.min(...hörn.map(p => p[1])), n = Math.max(...hörn.map(p => p[1]));
    const w = Math.min(...hörn.map(p => p[0])), e = Math.max(...hörn.map(p => p[0]));
    const fraga = `[out:json][timeout:25];way["highway"](${s.toFixed(6)},${w.toFixed(6)},${n.toFixed(6)},${e.toFixed(6)});out geom tags;`;
    let svar;
    try {
      svar = await fetch((typeof self !== 'undefined' && self.TERRANG_OVERPASS) || URL_STD, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(fraga),
      });
    } catch (err) { throw new Error('kunde inte nå OpenStreetMap (Overpass).'); }
    if (svar.status === 429 || svar.status === 504) throw new Error('OpenStreetMap är överbelastat just nu. Försök igen om en stund.');
    if (!svar.ok) throw new Error(`OpenStreetMap svarade ${svar.status}.`);
    const d = await svar.json();
    const linjer = tolka(d, tillZon, r, 0), alla = tolka(d, tillZon, r, Math.min(marg, 15));
    return { linjer, alla, antal: linjer.length };
  }

  // ------------------------------------------------------------------
  // Bredden mätt i ortofotot (0.11.0)
  // ------------------------------------------------------------------
  /** Punkter längs linjen var `steg` meter, med normal (åt vänster) i varje punkt. */
  function stationer(pts, steg) {
    const ut = [];
    let rest = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], L = Math.hypot(x1 - x0, y1 - y0);
      if (!L) continue;
      const ux = (x1 - x0) / L, uy = (y1 - y0) / L;
      let t = rest;
      for (; t <= L + 1e-9; t += steg) ut.push({ x: x0 + ux * t, y: y0 + uy * t, nx: -uy, ny: ux });
      rest = t - L;
    }
    const sista = pts[pts.length - 1];
    if (ut.length && Math.hypot(ut[ut.length - 1].x - sista[0], ut[ut.length - 1].y - sista[1]) > steg * 0.3) {
      const f = ut[ut.length - 1];
      ut.push({ x: sista[0], y: sista[1], nx: f.nx, ny: f.ny });
    }
    // normalen i en punkt: medel av grannarnas riktningar, så att svängar inte ger hack
    for (let k = 0; k < ut.length; k++) {
      const a = ut[Math.max(0, k - 1)], b = ut[Math.min(ut.length - 1, k + 1)], L = Math.hypot(b.x - a.x, b.y - a.y);
      if (L > 1e-6) { ut[k].nx = -(b.y - a.y) / L; ut[k].ny = (b.x - a.x) / L; }
    }
    return ut;
  }
  /** Pixelns färg (r, g, b) i punkten, eller null utanför bilden eller där bilden är tom (vit). */
  function pixel(bild, x, y) {
    const i = Math.round((x - bild.x0) / bild.s), j = Math.round((bild.y1 - y) / bild.s);
    if (i < 0 || j < 0 || i >= bild.W || j >= bild.H) return null;
    const k = (j * bild.W + i) * 4, d = bild.rgba;
    if (d[k + 3] === 0 || (d[k] === 255 && d[k + 1] === 255 && d[k + 2] === 255)) return null;
    return [d[k], d[k + 1], d[k + 2]];
  }
  const median = a => { if (!a.length) return NaN; const b = a.slice().sort((p, q) => p - q), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  /** Grönska (krona eller gräs): grönt klart över rött och blått. */
  const gront = c => c[1] > c[0] + 8 && c[1] > c[2] + 4;
  /**
   * Mäter vägbanans kanter längs en linje i ortofotot. def = väntad bredd i meter.
   * Returnerar { st: stationer med v (vänster) och h (höger) halvbredd eller null, andel } där andel
   * är andelen stationer där båda kanterna hittades.
   */
  function matLinje(pts, bild, def, { steg = 2, tol = 42 } = {}) {
    const st = stationer(pts, steg);
    const dr = Math.max(0.1, bild.s * 0.75);
    const max = def * 0.9 + 1.5, slut = Math.max(2, Math.round(0.45 / dr));
    // vägbanans färg mitt på vägen, lokalt (skuggor och beläggning skiftar längs vägen)
    const mitt = st.map(p => {
      const c = [];
      for (let o = -0.3 * def; o <= 0.3 * def + 1e-9; o += dr) { const q = pixel(bild, p.x + p.nx * o, p.y + p.ny * o); if (q && !gront(q)) c.push(q); }
      return c;
    });
    const ref = st.map((p, k) => {
      const c = [];
      for (let m = Math.max(0, k - 3); m <= Math.min(st.length - 1, k + 3); m++) c.push(...mitt[m]);
      if (c.length < 3) return null;
      const f = [0, 1, 2].map(n => median(c.map(q => q[n])));
      // vägbanan är grå eller gråbrun (asfalt, grus); en starkt färgad mitt är något annat (tak, markering, bil)
      return Math.max(...f) - Math.min(...f) <= 70 ? f : null;
    });
    let bada = 0;
    st.forEach((p, k) => {
      p.v = p.h = null;
      const f = ref[k];
      if (!f) return;
      const lik = q => q && !gront(q) && Math.hypot(q[0] - f[0], q[1] - f[1], q[2] - f[2]) < tol;
      for (const [sida, tecken] of [['v', 1], ['h', -1]]) {
        let miss = 0, sistaLik = 0;
        for (let o = dr; o <= max; o += dr) {
          if (lik(pixel(bild, p.x + tecken * p.nx * o, p.y + tecken * p.ny * o))) { miss = 0; sistaLik = o; }
          else if (++miss >= slut) { p[sida] = sistaLik + dr / 2; break; }
        }
      }
      if (p.v != null && p.h != null) bada++;
    });
    return { st, andel: st.length ? bada / st.length : 0 };
  }
  /** Rullande median över fönstret ±n, bara över värden som finns; luckor fylls av grannarna. */
  function rullande(v, n) {
    const ut = v.map((_, k) => median(v.slice(Math.max(0, k - n), k + n + 1).filter(x => x != null && x === x)));
    // fyll luckor (NaN) med närmaste värde
    let sen = NaN;
    for (let k = 0; k < ut.length; k++) { if (ut[k] === ut[k]) sen = ut[k]; else ut[k] = sen; }
    sen = NaN;
    for (let k = ut.length - 1; k >= 0; k--) { if (ut[k] === ut[k]) sen = ut[k]; else ut[k] = sen; }
    return ut;
  }
  /**
   * Bredd och sidförskjutning per station för en linje: ur OSM:s width rakt av, annars mätt i
   * ortofotot (bilvägar) och annars schablonen. Returnerar { pts, bredd (per punkt), median, kalla }.
   * pts är mittlinjen förskjuten dit vägbanan ligger i bilden.
   */
  function profil(l, bild, opt = {}) {
    const sch = schablon(l);
    const steg = opt.steg || 2;
    const rak = () => ({ pts: l.pts.map(p => [p[0], p[1]]), bredd: l.pts.map(() => sch.bredd), median: sch.bredd, kalla: sch.kalla });
    if (sch.kalla === 'osm' || !bild || slag(l.lager) !== 'bil') return rak();
    const m = matLinje(l.pts, bild, sch.bredd, { steg, tol: opt.tol });
    if (m.st.length < 3 || m.andel < 0.35) return rak();
    const lo = Math.max(2.5, sch.bredd * 0.6), hi = sch.bredd * 1.6 + 1;
    const tot = rullande(m.st.map(p => (p.v != null && p.h != null ? p.v + p.h : null)), 7).map(b => Math.min(hi, Math.max(lo, b)));
    const fors = rullande(m.st.map(p => (p.v != null && p.h != null ? (p.v - p.h) / 2 : null)), 7);
    const pts = m.st.map((p, k) => {
      const c = Math.max(-Math.min(1.5, tot[k] * 0.25), Math.min(Math.min(1.5, tot[k] * 0.25), fors[k] || 0));
      return [p.x + p.nx * c, p.y + p.ny * c];
    });
    return { pts, bredd: tot.map(b => Math.round(b * 10) / 10), median: Math.round(median(tot) * 10) / 10, kalla: 'ortofoto' };
  }

  // ------------------------------------------------------------------
  // Vägytorna: alla linjer med sin bredd i ett rutnät, ihopslagna (0.11.0)
  // ------------------------------------------------------------------
  /** Ringar → polygoner med hål: { ringar: [yttre, hål …], yta }. En ring inne i ett udda antal andra är ett hål. */
  function polygoner(ringar) {
    const area = p => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return a / 2; };
    const inne = (q, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { if ((p[i][1] > q[1]) !== (p[j][1] > q[1]) && q[0] < (p[j][0] - p[i][0]) * (q[1] - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; } return c; };
    const r = ringar.map(p => ({ p, a: Math.abs(area(p)) })).filter(x => x.a > 0.5);
    const djup = r.map(x => r.filter(y => y !== x && y.a > x.a && inne(x.p[0], y.p)).length);
    const ut = [];
    r.forEach((x, i) => { if (djup[i] % 2 === 0) ut.push({ ringar: [x.p], yta: x.a, djup: djup[i] }); });
    r.forEach((x, i) => {
      if (djup[i] % 2 === 0) return;
      // hålet hör till den minsta yttre ring som omsluter det
      const agare = ut.filter(o => o.djup === djup[i] - 1 && o.yta > x.a && inne(x.p[0], o.ringar[0])).sort((a, b) => a.yta - b.yta)[0];
      if (agare) { agare.ringar.push(x.p); agare.yta -= x.a; }
    });
    return ut.map(o => ({ ringar: o.ringar, yta: Math.round(o.yta * 10) / 10 }));
  }
  /**
   * Vägytorna inom utsnittet r för linjer med profiler (ur `profil`). Returnerar
   * { bil: [polygoner], gang: [polygoner] } i zonens koordinater.
   */
  function ytor(profiler, r, { cell = 0, maxCeller = 3e6, tol = 0.08 } = {}) {
    const Wm = r.xmax - r.xmin, Hm = r.ymax - r.ymin;
    const s = cell || Math.max(0.2, Math.sqrt(Wm * Hm / maxCeller));
    const W = Math.ceil(Wm / s) + 1, H = Math.ceil(Hm / s) + 1;
    const ut = {};
    for (const sl of ['bil', 'gang']) {
      const lista = profiler.filter(p => p.slag === sl);
      if (!lista.length) { ut[sl] = []; continue; }
      const z = new Float32Array(W * H).fill(-1);
      for (const p of lista) {
        for (let k = 1; k < p.pts.length; k++) {
          const [ax, ay] = p.pts[k - 1], [bx, by] = p.pts[k];
          const wa = p.bredd[k - 1] / 2, wb = p.bredd[k] / 2, wm = Math.max(wa, wb) + s;
          const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
          const i0 = Math.max(1, Math.floor((Math.min(ax, bx) - wm - r.xmin) / s)), i1 = Math.min(W - 2, Math.ceil((Math.max(ax, bx) + wm - r.xmin) / s));
          const j0 = Math.max(1, Math.floor((r.ymax - Math.max(ay, by) - wm) / s)), j1 = Math.min(H - 2, Math.ceil((r.ymax - Math.min(ay, by) + wm) / s));
          for (let j = j0; j <= j1; j++) {
            const y = r.ymax - j * s;
            for (let i = i0; i <= i1; i++) {
              const x = r.xmin + i * s;
              const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0;
              const v = wa + t * (wb - wa) - Math.hypot(x - ax - t * dx, y - ay - t * dy);
              const c = j * W + i;
              if (v > z[c]) z[c] = v;
            }
          }
        }
      }
      const g = { W, H, s, x0: r.xmin, y1: r.ymax, z };
      const ringar = T().kurvorForNiva(g, 0).filter(l => l.sluten).map(l => T().forenkla(l.pts.slice(0, -1), tol)).filter(p => p.length >= 3);
      ut[sl] = polygoner(ringar);
    }
    return ut;
  }

  /**
   * Utkastet för en hämtning: profiler för alla linjer (också lite utanför utsnittet) och ytorna.
   * bild = { rgba, W, H, x0, y1, s } (x0/y1 = mitten av övre vänstra pixeln) eller null.
   * Returnerar { bil, gang, profiler: [{ namn, typ, slag, median, kalla }], matta, schabloner }.
   */
  function utkast(res, r, bild, opt = {}) {
    const linjer = res.alla || res.linjer;
    const profiler = linjer.map(l => Object.assign({ slag: slag(l.lager), namn: l.namn, typ: l.typ }, profil(l, bild, opt)));
    const y = ytor(profiler, r, opt);
    const inom = profiler.filter(p => p.pts.some(q => q[0] >= r.xmin && q[0] <= r.xmax && q[1] >= r.ymin && q[1] <= r.ymax));
    return {
      bil: y.bil, gang: y.gang, profiler: inom.map(p => ({ namn: p.namn, typ: p.typ, slag: p.slag, median: p.median, kalla: p.kalla })),
      matta: inom.filter(p => p.kalla === 'ortofoto').length, medBild: !!bild,
    };
  }

  function dxf(res, r, dx, dy, { slag: bara } = {}) {
    const lager = { UTSNITT: 3 }, objekt = [];
    for (const l of res.linjer) {
      if (bara && slag(l.lager) !== bara) continue;
      lager[l.lager] = KLASSER[l.lager].aci; objekt.push({ typ: 'pl', lager: l.lager, pts: l.pts });
    }
    if (res.ytor) for (const [sl, ln] of [['bil', 'VAG_YTA_BIL'], ['gang', 'VAG_YTA_GANG']]) {
      if (bara && sl !== bara) continue;
      for (const p of res.ytor[sl] || []) for (const ring of p.ringar) { lager[ln] = YTLAGER[ln].aci; objekt.push({ typ: 'pl', lager: ln, pts: ring, sluten: true }); }
    }
    objekt.push({ typ: 'pl', lager: 'UTSNITT', pts: [[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax]], sluten: true });
    return Dxf.skriv(lager, objekt, { dx, dy, ext: r });
  }

  return { hamta, tolka, dxf, klipp, klass, slag, schablon, tolkaBredd, stationer, matLinje, profil, ytor, polygoner, utkast, KLASSER, YTLAGER, SLAGNAMN, SCHABLON, URL_STD };
}));
