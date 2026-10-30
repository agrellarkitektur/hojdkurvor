/*
 * Egna val för enskilda träd och befintliga hus (0.11.0): dölja dem som är uppenbart fel och rätta
 * trädens höjd, kronbredd och art. Valen sparas i webbläsaren och gäller nästa gång underlaget skapas
 * för samma plats: i kartan, utskriften, DXF, CSV, IFC, 3D-vyn, skuggstudien och till cad-apa.
 *
 * Träd känns igen på läget (avrundat till dm, eller närmast inom 0,6 m; topparna ligger minst 1,5 m
 * isär), hus på objektidentiteten. Ren data utan DOM, testad i test/objektval.test.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Objektval = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const NARA = 0.6;
  const ARTER = ['gran', 'tall', 'lov', 'bjork'];
  const dm = v => Math.round(v * 10) / 10;
  /** Nyckeln för ett träd: läget i dm, "x,y". */
  const tradNyckel = t => `${dm(t.x)},${dm(t.y)}`;

  /** Valet för ett träd: exakt nyckel, annars närmaste inom NARA meter. Returnerar [nyckel, val] eller null. */
  function hittaVal(t, val, poster) {
    const k = tradNyckel(t);
    if (val[k]) return [k, val[k]];
    let bast = null, d0 = NARA;
    for (const p of poster) { const d = Math.hypot(p.x - t.x, p.y - t.y); if (d < d0) { d0 = d; bast = p; } }
    return bast ? [bast.k, bast.v] : null;
  }
  const poster = val => Object.keys(val || {}).map(k => { const [x, y] = k.split(',').map(Number); return { k, x, y, v: val[k] }; }).filter(p => isFinite(p.x) && isFinite(p.y));

  /** Rensar ett val: bara kända fält med rimliga värden. Tomt objekt = inget val. */
  function rensaTrad(e) {
    const ut = {};
    if (!e) return ut;
    if (e.dolt) ut.dolt = true;
    if (e.hojd > 0.5 && e.hojd < 80) ut.hojd = Math.round(e.hojd * 10) / 10;
    if (e.krona > 0.3 && e.krona < 40) ut.krona = Math.round(e.krona * 10) / 10;
    if (ARTER.includes(e.art)) ut.art = e.art;
    return ut;
  }

  /**
   * Trädens val. alla = träden ur laserdatan, val = { "x,y": { dolt, hojd, krona, art } }.
   * Returnerar { trad, dolda }: trad utan de dolda (med medDolda: alla, de dolda med dolt: true).
   * Ändrade träd är kopior med andrat: true och ra = { hojd, krona } ur laserdatan.
   */
  function tillampaTrad(alla, val, { medDolda = false } = {}) {
    const p = poster(val), trad = [], dolda = [];
    for (const t of alla || []) {
      const h = p.length ? hittaVal(t, val, p) : null;
      const e = h && rensaTrad(h[1]);
      if (!e || !Object.keys(e).length) { trad.push(t); continue; }
      const n = Object.assign({}, t, { andrat: true, ra: { hojd: t.hojd, krona: t.krona } });
      if (e.hojd) n.hojd = e.hojd;
      if (e.krona) n.krona = e.krona;
      if (e.art) n.art = e.art;
      if (e.dolt) { n.dolt = true; dolda.push(n); if (medDolda) trad.push(n); }
      else trad.push(n);
    }
    return { trad, dolda };
  }
  /** Det sparade valet för trädet t (rensat), eller {}. */
  function valFor(t, val) { const h = hittaVal(t, val || {}, poster(val)); return h ? rensaTrad(h[1]) : {}; }
  /** Sparar valet för trädet t i val (ändrar val och returnerar det). Ett tomt val tar bort posten. */
  function sattTrad(val, t, e) {
    const p = poster(val), h = hittaVal(t, val, p);
    if (h) delete val[h[0]];
    const r = rensaTrad(e);
    if (Object.keys(r).length) val[tradNyckel(t)] = r;
    return val;
  }

  /** Husens val: val = { id: { dolt } }. Returnerar { byggnader, dolda } (med medDolda: alla, de dolda med dolt: true). */
  function tillampaHus(alla, val, { medDolda = false } = {}) {
    const byggnader = [], dolda = [];
    for (const b of alla || []) {
      const e = b && b.id != null && val ? val[String(b.id)] : null;
      if (e && e.dolt) { dolda.push(b); if (medDolda) byggnader.push(b); }
      else byggnader.push(b);
    }
    return { byggnader, dolda };
  }

  const inuti = (p, x, y) => {
    let c = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
    return c;
  };
  const avstand = (p, x, y) => {
    let d = Infinity;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [ax, ay] = p[j], [bx, by] = p[i], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0;
      d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
    return d;
  };
  /**
   * Ytmodellen utan de dolda träden och husen, för skuggorna: en ny dsm där markhöjden gäller inom
   * kronan (halva kronbredden + marg) och inom fotavtrycket (+ marg). y = { W, H, s, x0, y1, dtm }.
   */
  function skarBort(y, dsm, { trad = [], hus = [] } = {}, marg = 0.5) {
    if (!trad.length && !hus.length) return dsm;
    const ut = Float32Array.from(dsm), { W, H, s, x0, y1, dtm } = y;
    const ruta = (xa, xb, ya, yb, f) => {
      const i0 = Math.max(0, Math.floor((xa - x0) / s)), i1 = Math.min(W - 1, Math.ceil((xb - x0) / s));
      const j0 = Math.max(0, Math.floor((y1 - yb) / s)), j1 = Math.min(H - 1, Math.ceil((y1 - ya) / s));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (f(x0 + i * s, y1 - j * s)) { const c = j * W + i; ut[c] = dtm[c]; }
    };
    for (const t of trad) {
      const r = (t.ra ? Math.max(t.krona, t.ra.krona) : t.krona) / 2 + marg;
      ruta(t.x - r, t.x + r, t.y - r, t.y + r, (x, yy) => Math.hypot(x - t.x, yy - t.y) <= r);
    }
    for (const b of hus) {
      const f = b.fotavtryck, xs = f.map(p => p[0]), ys = f.map(p => p[1]);
      ruta(Math.min(...xs) - marg, Math.max(...xs) + marg, Math.min(...ys) - marg, Math.max(...ys) + marg,
        (x, yy) => inuti(f, x, yy) || avstand(f, x, yy) <= marg);
    }
    return ut;
  }

  return { tradNyckel, tillampaTrad, valFor, sattTrad, rensaTrad, tillampaHus, skarBort, ARTER, NARA };
}));
