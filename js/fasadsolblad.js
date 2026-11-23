// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Sol på fasaderna som PDF (0.15.0): A3 liggande, med
 *   0. (0.16.1) en översikt: byggnaderna i 3D från två håll med summan på fasaderna, en nyckelplan och ett kort
 *      per fasad (kropp och väderstreck). Fasaderna är numrerade, och numren följer med på alla sidor.
 *   1. staplar per kropp och väderstreck (summa i kWh/m² och högsta samtidiga fasadmedel i W/m²),
 *      en tabell med lokal och samtidig topp och hur mycket skuggningen tar bort,
 *   2. timme × dag per kropp och väderstreck,
 *   3. värsta dygnet per kropp och väderstreck.
 * Beräkningen finns i js/fasadsol.js; här ritas bara. jsPDF via Utskrift.nyttDokument.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./utskrift.js'), require('./fasadsol.js'), require('./volym3d.js'));
  else root.Fasadsolblad = factory(root.Utskrift, root.Fasadsol, root.Volym3D);
}(typeof self !== 'undefined' ? self : this, function (U, Fs, V3) {
  'use strict';
  const M = U.MARG, Fa = U.F;
  const MANAD = ['jan', 'feb', 'mars', 'april', 'maj', 'juni', 'juli', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const tal = (v, d = 0) => Number(v).toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const narText = n => (n ? `${n.dag.dag} ${MANAD[n.dag.man - 1]} kl. ${String(n.tim).padStart(2, '0')}–${String(n.tim + 1).padStart(2, '0')}` : '–');
  const RAD = Math.PI / 180;
  const ytaMt = p => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += (p[i][0] - p[0][0]) * (q[1] - p[0][1]) - (q[0] - p[0][0]) * (p[i][1] - p[0][1]); } return a; };
  const moturs = p => (ytaMt(p) < 0 ? p.slice().reverse() : p);

  /**
   * opt: { res (Fasadsol.berakna), titel: { projekt, kommun, system }, fonter, notis: [text],
   *        punkter (Fasadsol.punkter, för översikten), volymer (kropparna som räknades, 0.16.1) }.
   * Utan punkter och volymer blir det ingen översiktssida.
   * Ger PDF:en som ArrayBuffer (eller dokumentet med opt.dok).
   */
  function blad(opt) {
    const res = opt.res, PW = 420, PH = 297;
    const { doc, font, mono } = U.nyttDokument('a3', true, opt.fonter);
    doc.setProperties({ title: `Sol på fasaderna ${opt.titel.projekt || ''}`.trim(), creator: 'Höjdkurvor' });
    const text = (s, x, y, pt, o = {}) => {
      doc.setFont(o.mono ? mono : font, o.mono ? 'normal' : (o.vikt || 'normal')); doc.setFontSize(pt);
      doc.setTextColor(...(o.farg || Fa.blck)); doc.text(String(s), x, y, { align: o.ha || 'left', baseline: o.va || 'middle', angle: o.vinkel || 0 });
    };
    const period = Fs.PERIODER[res.period].namn, tid = Fs.TIDER[res.tid].namn;
    let sida = 0;
    const huvud = (rubrik, under) => {
      if (sida++) doc.addPage('a3', 'landscape');
      text(`${rubrik}${opt.titel.projekt ? ' – ' + opt.titel.projekt : ''}`, M, M + 4, 16, { vikt: 'bold' });
      text(under || [opt.titel.kommun, opt.titel.system, `${period} ${res.ar}, ${tid}, klar himmel`].filter(Boolean).join('. '), M, M + 11, 7.5);
      U.marke(doc, PW - M - 30, PH - M - 4.6, 4.5, Fa.blck, Fa.annot);
      doc.setFont(font, 'bold'); doc.setFontSize(8);
      U.ordbild(doc, PW - M - 24.4, PH - M - 1.8);
      text(`Sida ${sida}`, PW - M - 34, PH - M - 1.8, 6.5, { ha: 'right', farg: Fa.gra });
    };
    const fyll = rgb => { doc.setFillColor(...rgb); };
    const skalstock = (x, y, w, h, [a, b], enhet) => {
      const n = 40;
      for (let i = 0; i < n; i++) { fyll(Fs.farg((i + 0.5) / n)); doc.rect(x + i * w / n, y, w / n + 0.05, h, 'F'); }
      doc.setDrawColor(...Fa.gra); doc.setLineWidth(0.1); doc.rect(x, y, w, h, 'S');
      for (let k = 0; k <= 4; k++) text(tal(a + (b - a) * k / 4), x + w * k / 4, y + h + 2.5, 6, { ha: 'center' });
      text(enhet, x + w + 2, y + h / 2, 6.5);
    };

    const SK = Fs.skala(res);
    // --- 0. Översikt (0.16.1): numrerade fasader, 3D från två håll med summan på fasaderna, nyckelplan och ett kort per fasad
    const nummer = new Map(res.grupper.map((g, i) => [g, i + 1]));
    const gruppNamn = g => `${g.namn}, ${Fs.STRECK_NAMN[g.streck]}`;
    const gruppFor = f => res.grupper.find(g => g.volym === f.volym && g.streck === f.streck);
    const badge = (x, y, n, r = 2.6) => {
      fyll(Fa.annot); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.35); doc.circle(x, y, r, 'FD');
      text(String(n), x, y + 0.1, r > 2.4 ? 7.5 : 6.2, { ha: 'center', vikt: 'bold', farg: [255, 255, 255] });
    };
    if (opt.punkter && opt.volymer && opt.punkter.length) {
      huvud('Sol på fasaderna – översikt');
      // fler än 8 fasader: lägre vyer och två rader kort på samma sida
      const tvaRader = res.grupper.length > 8;
      const Y0 = M + 20, VY = tvaRader ? 100 : 150;   // vyernas höjd
      const vy1 = { x: M, y: Y0, w: 132, h: VY }, vy2 = { x: M + 136, y: Y0, w: 132, h: VY }, plan = { x: M + 274, y: Y0, w: PW - 2 * M - 274, h: VY };
      axonometri(vy1, 45, 'Från sydväst');
      axonometri(vy2, 225, 'Från nordost');
      nyckelplan(plan);
      // skalan under vyerna
      skalstock(M + 4, Y0 + VY + 3, 110, 3, SK.summa, 'kWh/m² under perioden (fasadens färg)');
      // korten
      const per = 8, kw = (PW - 2 * M - (per - 1) * 3) / per, KY = Y0 + VY + 16, rader = tvaRader ? 2 : 1;
      const KH = (PH - M - 8 - KY - (rader - 1) * 4) / rader;
      res.grupper.slice(0, per * rader).forEach((g, i) => kort(g, M + (i % per) * (kw + 3), KY + Math.floor(i / per) * (KH + 4), kw, KH));
      for (let s0 = per * rader; s0 < res.grupper.length; s0 += 3 * per) {
        huvud('Sol på fasaderna – fasaderna');
        const kh = (PH - M - 8 - (M + 24) - 8) / 3;
        res.grupper.slice(s0, s0 + 3 * per).forEach((g, i) => kort(g, M + (i % per) * (kw + 3), M + 24 + Math.floor(i / per) * (kh + 4), kw, kh));
      }
    }
    /**
     * Byggnaderna i parallellprojektion sedd mot kompassriktningen mot (grader, 45 = mot nordost), 30° ovanifrån.
     * Väggarna, taken och fasadpunkterna ritas bakifrån och fram (en vägg eller en takyta i taget), punkterna i
     * summans färg, och fasadernas nummer där fasaden vetter mot betraktaren.
     */
    function axonometri(ruta, mot, rubrik) {
      // ljuset från nordväst och ovanifrån, som på en karta: takfallen får olika ton
      const ljus = n => { const L = [-0.45, 0.45, 0.77]; return Math.max(0, Math.min(1, 0.35 + 0.65 * (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]))); };
      const el = 30 * RAD, a = mot * RAD, d = [Math.sin(a), Math.cos(a)], r = [Math.cos(a), -Math.sin(a)];
      const vol = opt.volymer.filter(v => v.fotavtryck && v.fotavtryck.length >= 3 && v.golv === v.golv);
      const alla = vol.flatMap(v => v.fotavtryck);
      const cx = alla.reduce((s, p) => s + p[0], 0) / alla.length, cy = alla.reduce((s, p) => s + p[1], 0) / alla.length;
      const z0 = Math.min(...vol.map(v => v.golv));
      const pr = (x, y, z) => { const hx = x - cx, hy = y - cy; return [hx * r[0] + hy * r[1], (z - z0) * Math.cos(el) + (hx * d[0] + hy * d[1]) * Math.sin(el)]; };
      const djup = (x, y, z) => (x - cx) * d[0] + (y - cy) * d[1] - (z - z0) * Math.tan(el) * 0.001;
      const enheter = [];
      // väggarna med sina punkter
      const perVagg = new Map();
      opt.punkter.forEach((p, k) => {
        const f = res.fasader[p.f];
        if (!f) return;
        const nyck = `${f.id}:${f.sida}`;
        if (!perVagg.has(nyck)) perVagg.set(nyck, []);
        perVagg.get(nyck).push(k);
      });
      const summa = res.punkt.summa, skS = SK.summa[1];
      for (const v of vol) {
        const fot = moturs(v.fotavtryck), pl = V3 ? V3.plan(v) : null;
        fot.forEach((A, s) => {
          const B = fot[(s + 1) % fot.length], ex = B[0] - A[0], ey = B[1] - A[1], L = Math.hypot(ex, ey);
          if (L < 0.1) return;
          const nx = ey / L, ny = -ex / L;
          if (nx * d[0] + ny * d[1] > -0.02) return;   // vetter bort
          const topp = [];
          for (let i = 0; i <= 16; i++) {
            const t = i / 16, x = A[0] + ex * t, y = A[1] + ey * t;
            topp.push([x, y, pl && V3 ? Math.max(v.golv + v.takfot, V3.hojdVid(v, x - nx * 0.01, y - ny * 0.01, pl)) : v.golv + v.takfot]);
          }
          const panel = [[A[0], A[1], v.golv], ...topp, [B[0], B[1], v.golv]];
          const m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
          enheter.push({ djup: djup(m[0], m[1], v.golv + v.takfot / 2), typ: 'vagg', panel, punkter: perVagg.get(`${v.id}:${s}`) || [] });
        });
        // taket: takytorna (utan gavlarna) eller det platta taket
        const t = V3 && V3.takytor ? V3.takytor(v) : null;
        if (t) {
          for (let i = 0; i < t.index.length; i += 3) {
            const q = [0, 1, 2].map(j => t.pos.slice(t.index[i + j] * 3, t.index[i + j] * 3 + 3));
            const u1 = q[1].map((c, j) => c - q[0][j]), u2 = q[2].map((c, j) => c - q[0][j]);
            let n = [u1[1] * u2[2] - u1[2] * u2[1], u1[2] * u2[0] - u1[0] * u2[2], u1[0] * u2[1] - u1[1] * u2[0]];
            const nl = Math.hypot(...n);
            if (!nl || Math.abs(n[2] / nl) < 0.1) continue;   // gavlar
            n = n.map(c => c / nl * Math.sign(n[2]));
            const c = [0, 1, 2].map(j => (q[0][j] + q[1][j] + q[2][j]) / 3);
            enheter.push({ djup: djup(c[0], c[1], c[2]) - 0.3, typ: 'tak', poly: q, ljus: ljus(n) });
          }
        } else {
          const z = v.golv + v.takfot;
          const c = fot.reduce((s2, p) => [s2[0] + p[0] / fot.length, s2[1] + p[1] / fot.length], [0, 0]);
          enheter.push({ djup: djup(c[0], c[1], z) - 0.3, typ: 'tak', poly: fot.map(p => [p[0], p[1], z]), ljus: ljus([0, 0, 1]) });
        }
      }
      // skala: allt får plats i rutan
      const P = [];
      for (const e of enheter) (e.panel || e.poly).forEach(q => P.push(pr(...q)));
      const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
      const bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0 = Math.min(...ys), by1 = Math.max(...ys);
      const k = Math.min((ruta.w - 8) / (bx1 - bx0 || 1), (ruta.h - 22) / (by1 - by0 || 1));
      const ox = ruta.x + ruta.w / 2 - (bx0 + bx1) / 2 * k, oy = ruta.y + 14 + (ruta.h - 22) / 2 + (by0 + by1) / 2 * k;
      const S = q => { const p = pr(...q); return [ox + p[0] * k, oy - p[1] * k]; };
      const polygon = (pts, stil) => { const s0 = S(pts[0]); doc.moveTo(s0[0], s0[1]); for (let i = 1; i < pts.length; i++) { const s1 = S(pts[i]); doc.lineTo(s1[0], s1[1]); } doc.close(); doc[stil === 'FD' ? 'fillStroke' : stil === 'F' ? 'fill' : 'stroke'](); };
      fyll([246, 245, 241]); doc.rect(ruta.x, ruta.y, ruta.w, ruta.h, 'F');
      text(rubrik, ruta.x + 3, ruta.y + 5, 8, { vikt: 'bold' });
      // marken: en skugga av fotavtrycken rakt under
      fyll([226, 223, 216]);
      for (const v of vol) polygon(moturs(v.fotavtryck).map(p => [p[0] + 0.6, p[1] - 0.6, z0 - 0.05]), 'F');
      enheter.sort((p, q) => q.djup - p.djup);
      for (const e of enheter) {
        if (e.typ === 'tak') {
          const g = Math.round(170 + 75 * e.ljus), rgb = [g, g - 2, g - 6];
          // samma färg på kanten, så att trianglarna inte syns som linjer
          fyll(rgb); doc.setDrawColor(...rgb); doc.setLineWidth(0.1); polygon(e.poly, 'FD');
          continue;
        }
        fyll([214, 211, 204]); doc.setDrawColor(90, 92, 96); doc.setLineWidth(0.15); polygon(e.panel, 'FD');
        for (const i of e.punkter) {
          const p = opt.punkter[i], tx = -p.ny, ty = p.nx, ux = p.x + p.nx * 0.03, uy = p.y + p.ny * 0.03;
          const hw = p.w / 2 + 0.06, hh = p.h / 2 + 0.06;
          fyll(Fs.farg(summa[i] / skS));
          polygon([[ux - tx * hw, uy - ty * hw, p.z - hh], [ux + tx * hw, uy + ty * hw, p.z - hh], [ux + tx * hw, uy + ty * hw, p.z + hh], [ux - tx * hw, uy - ty * hw, p.z + hh]], 'F');
        }
        doc.setDrawColor(70, 72, 76); doc.setLineWidth(0.18); polygon(e.panel, 'S');
        if (e.punkter.length) {
          const p0 = opt.punkter[e.punkter[0]], f = res.fasader[p0.f], g = gruppFor(f);
          const zs = e.punkter.map(i => opt.punkter[i].z), zm = (Math.min(...zs) + Math.max(...zs)) / 2;
          // numret direkt efter väggen, så att det som står framför skymmer det
          const bp = S([(f.a[0] + f.b[0]) / 2 + f.nx * 0.2, (f.a[1] + f.b[1]) / 2 + f.ny * 0.2, zm]);
          badge(bp[0], bp[1], nummer.get(g));
        }
      }
      // norrpil i hörnet: rutnätets nord i projektionen
      const n0 = [ruta.x + ruta.w - 10, ruta.y + ruta.h - 10], nv = [-d[1] * 0 + r[1], Math.sin(el) * d[1]];
      const nl = Math.hypot(nv[0], nv[1]) || 1, nn = [nv[0] / nl * 6, -nv[1] / nl * 6];
      doc.setDrawColor(...Fa.blck); doc.setLineWidth(0.3); doc.line(n0[0] - nn[0], n0[1] - nn[1], n0[0] + nn[0], n0[1] + nn[1]);
      fyll(Fa.blck); doc.triangle(n0[0] + nn[0], n0[1] + nn[1], n0[0] + nn[0] * 0.55 - nn[1] * 0.3, n0[1] + nn[1] * 0.55 + nn[0] * 0.3, n0[0] + nn[0] * 0.55 + nn[1] * 0.3, n0[1] + nn[1] * 0.55 - nn[0] * 0.3, 'F');
      text('N', n0[0] + nn[0] * 1.5, n0[1] + nn[1] * 1.5, 7, { ha: 'center', vikt: 'bold' });
    }
    /** Nyckelplanen: fotavtrycken, fasaderna i summans färg och deras nummer. */
    function nyckelplan(ruta) {
      const vol = opt.volymer.filter(v => v.fotavtryck && v.fotavtryck.length >= 3);
      const pts = vol.flatMap(v => v.fotavtryck);
      const x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1])), y1 = Math.max(...pts.map(p => p[1]));
      const k = Math.min((ruta.w - 24) / (x1 - x0 || 1), (ruta.h - 40) / (y1 - y0 || 1));
      const ox = ruta.x + ruta.w / 2 - (x0 + x1) / 2 * k, oy = ruta.y + 12 + (ruta.h - 30) / 2 + (y0 + y1) / 2 * k;
      const S = p => [ox + p[0] * k, oy - p[1] * k];
      fyll([246, 245, 241]); doc.rect(ruta.x, ruta.y, ruta.w, ruta.h, 'F');
      text('Nyckelplan', ruta.x + 3, ruta.y + 5, 8, { vikt: 'bold' });
      for (const v of vol) {
        const f = moturs(v.fotavtryck), s0 = S(f[0]);
        doc.moveTo(s0[0], s0[1]); f.slice(1).forEach(p => { const s1 = S(p); doc.lineTo(s1[0], s1[1]); }); doc.close();
        fyll([226, 223, 216]); doc.setDrawColor(...Fa.gra); doc.setLineWidth(0.15); doc.fillStroke();
      }
      const skS = SK.summa[1];
      for (const f of res.fasader) {
        const a = S(f.a), b = S(f.b);
        doc.setDrawColor(...Fs.farg(f.summa / skS)); doc.setLineWidth(1.6); doc.line(a[0], a[1], b[0], b[1]);
      }
      // ett nummer per fasadgrupp och vägg, utanför väggens mitt
      for (const f of res.fasader) {
        const g = gruppFor(f), m = S([(f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2]);
        badge(m[0] + f.nx * 5.5, m[1] - f.ny * 5.5, nummer.get(g), 2.3);
      }
      // norrpil och skala
      const nx = ruta.x + ruta.w - 9, ny = ruta.y + 12;
      fyll(Fa.blck); doc.triangle(nx, ny - 5, nx - 2, ny + 2, nx + 2, ny + 2, 'F');
      text('N', nx, ny - 7.5, 7, { ha: 'center', vikt: 'bold' });
      const st = [5, 10, 20, 50, 100].find(m => m * k >= 15) || 100;
      doc.setDrawColor(...Fa.blck); doc.setLineWidth(0.3);
      const sx = ruta.x + 4, sy = ruta.y + ruta.h - 6;
      doc.line(sx, sy, sx + st * k, sy); doc.line(sx, sy - 1, sx, sy + 1); doc.line(sx + st * k, sy - 1, sx + st * k, sy + 1);
      text(`${st} m`, sx + st * k + 2, sy, 6);
    }
    /** Kortet för en fasadgrupp: nummer, summan stort, topparna, timme × dag och värsta dygnet i litet format. */
    function kort(g, x, y, w, h) {
      const skS = SK.summa[1], skT = SK.topp[1];
      doc.setDrawColor(...Fa.ljus); doc.setLineWidth(0.2); fyll([255, 255, 255]); doc.rect(x, y, w, h, 'FD');
      fyll(Fs.farg(g.summa / skS)); doc.rect(x, y, w, 2.2, 'F');
      badge(x + 5, y + 7.5, nummer.get(g), 3);
      const namn = doc.splitTextToSize(g.namn, w - 12);
      text(namn[0], x + 10, y + 6, 7, { vikt: 'bold' });
      text(Fs.STRECK_NAMN[g.streck].replace(/^./, c => c.toUpperCase()) + `, ${tal(g.area)} m²`, x + 10, y + 9.6, 6, { farg: Fa.gra });
      text(tal(g.summa), x + 3, y + 17.5, 15, { vikt: 'bold' });
      text('kWh/m²', x + 3 + doc.getTextWidth(tal(g.summa)) + 1, y + 18.2, 6, { farg: Fa.gra });
      const rad = (et, v, yy) => { text(et, x + 3, yy, 5.6, { farg: Fa.gra }); text(v, x + w - 3, yy, 6.2, { ha: 'right', vikt: 'bold' }); };
      rad('Lokal topp', `${tal(g.lokal)} W/m²`, y + 24);
      rad('Samtidig topp', `${tal(g.samtidig)} W/m²`, y + 27.6);
      text(g.nar ? narText(g.nar) : '–', x + w - 3, y + 30.8, 5.4, { ha: 'right', farg: Fa.gra });
      rad('Skugga, byggnader', `${tal(g.skuggning.volymer * 100)} %`, y + 34.4);
      rad('Skugga, omgivning', `${tal(g.skuggning.omgivning * 100)} %`, y + 38);
      // timme × dag och värsta dygnet i litet format; på ett lågt kort bredvid varandra
      const bredvid = h < 85, nd = res.dagar.length;
      const hx = x + 3, hy = y + 41.5, hw = bredvid ? (w - 9) / 2 : w - 6;
      const hh2 = bredvid ? h - 41.5 - 6 : Math.max(10, (h - 41.5 - 16) * 0.55);
      const kol = Math.min(nd, 60), per = nd / kol;
      for (let c = 0; c < kol; c++) for (let t = 0; t < 24; t++) {
        let m = 0;
        for (let dd = Math.floor(c * per); dd < Math.floor((c + 1) * per) || dd === Math.floor(c * per); dd++) m = Math.max(m, g.matris[Math.min(nd - 1, dd) * 24 + t] || 0);
        if (m < 1) continue;
        fyll(Fs.farg(m / skT)); doc.rect(hx + c * hw / kol, hy + t * hh2 / 24, hw / kol + 0.03, hh2 / 24 + 0.03, 'F');
      }
      doc.setDrawColor(...Fa.ljus); doc.setLineWidth(0.1); doc.rect(hx, hy, hw, hh2, 'S');
      text('Timme × dag', hx, hy + hh2 + 2.2, 5, { farg: Fa.gra });
      // värsta dygnet
      const dx0 = bredvid ? hx + hw + 3 : hx, dy0 = bredvid ? hy : hy + hh2 + 5, dh = bredvid ? hh2 : h - (dy0 - y) - 5;
      if (dh > 5) {
        fyll([240, 238, 232]); doc.rect(dx0 + hw * 8 / 24, dy0, hw * 9 / 24, dh, 'F');
        doc.setDrawColor(...Fa.annot); doc.setLineWidth(0.4);
        let forra = null;
        for (let t = 0; t < 24; t++) {
          const p = [dx0 + hw * (t + 0.5) / 24, dy0 + dh - dh * Math.min(1, g.dygn[t] / 1000)];
          if (forra) doc.line(forra[0], forra[1], p[0], p[1]);
          forra = p;
        }
        doc.setDrawColor(...Fa.ljus); doc.setLineWidth(0.1); doc.rect(dx0, dy0, hw, dh, 'S');
        const d = g.varstaDag >= 0 ? res.dagar[g.varstaDag] : null;
        text(d ? (bredvid ? `Värst ${d.dag} ${MANAD[d.man - 1]}` : `Värsta dygnet ${d.dag} ${MANAD[d.man - 1]}`) : 'Värsta dygnet', dx0, dy0 + dh + 2.2, 5, { farg: Fa.gra });
      }
    }

    // --- 1. Staplar och tabell
    const kroppar = [];
    for (const g of res.grupper) { let k = kroppar.find(q => q.volym === g.volym); if (!k) kroppar.push(k = { volym: g.volym, namn: g.namn, grupper: [] }); k.grupper.push(g); }
    // axlarna: fyra jämna steg (1, 2, 2,5 eller 5 gånger en tiopotens) upp över det största värdet
    const axel = m => { const r = m / 4, p = 10 ** Math.floor(Math.log10(r)), st = [1, 2, 2.5, 5, 10].map(k => k * p).find(k => k >= r); return st * 4; };
    const sS = axel(Math.max(SK.summa[1], ...res.grupper.map(g => g.summa))), sT = axel(Math.max(SK.topp[1], ...res.grupper.map(g => g.samtidig)));
    const RAD_H = 50, PER_SIDA = 4;
    const staplar = (x, y, w, h, grupper, falt, skala, fargSkala, rubrik) => {
      text(rubrik, x, y - 3, 7, { vikt: 'bold' });
      doc.setDrawColor(...Fa.ljus); doc.setLineWidth(0.1);
      for (let k = 0; k <= 4; k++) { const yy = y + h - h * k / 4; doc.line(x, yy, x + w, yy); text(tal(skala * k / 4), x - 1.5, yy, 5.5, { ha: 'right', farg: Fa.gra }); }
      const bw = w / 4;
      Fs.STRECK.forEach((s, i) => {
        const g = grupper.find(q => q.streck === s), bx = x + i * bw + bw * 0.2;
        text(s, bx + bw * 0.3, y + h + 3, 7, { ha: 'center' });
        if (!g) return;
        badge(bx + bw * 0.3, y + h + 7.5, nummer.get(g), 2);
        const v = g[falt], bh = h * Math.min(1, v / skala);
        fyll(Fs.farg(v / fargSkala)); doc.rect(bx, y + h - bh, bw * 0.6, bh, 'F');
        text(tal(v), bx + bw * 0.3, y + h - bh - 2, 6.5, { ha: 'center', vikt: 'bold' });
      });
    };
    for (let s0 = 0; s0 < Math.max(1, kroppar.length); s0 += PER_SIDA) {
      huvud('Sol på fasaderna');
      const y0 = M + 26;
      kroppar.slice(s0, s0 + PER_SIDA).forEach((k, i) => {
        const y = y0 + i * RAD_H;
        text(k.namn, M, y, 9, { vikt: 'bold' });
        staplar(M + 12, y + 9, 80, RAD_H - 22, k.grupper, 'summa', sS, SK.summa[1], 'Summa, kWh/m²');
        staplar(M + 112, y + 9, 80, RAD_H - 22, k.grupper, 'samtidig', sT, SK.topp[1], 'Högsta samtidiga fasadmedel, W/m²');
      });
      if (s0 === 0) {
        // tabellen
        const tx = 222, kol = [0, 34, 52, 72, 92, 112, 132, 160, 178], rubr = ['Kropp', 'Väderstreck', 'Area, m²', 'Summa, kWh/m²', 'Lokal topp, W/m²', 'Samtidig topp, W/m²', 'Samtidig topp, när', 'Skugga av andra byggnader', 'Skugga av omgivningen'];
        let y = y0;
        text('Per kropp och väderstreck', tx, y - 4, 9, { vikt: 'bold' });
        rubr.forEach((r, i) => {
          const rader = doc.splitTextToSize(r, (kol[i + 1] || 196) - kol[i] - 1.5);
          rader.forEach((rr, n) => text(rr, tx + kol[i] + (i >= 2 && i !== 6 ? (kol[i + 1] || 196) - kol[i] - 1.5 : 0), y + 1 + n * 2.6, 5.8, { vikt: 'bold', ha: i >= 2 && i !== 6 ? 'right' : 'left' }));
        });
        y += 9;
        doc.setDrawColor(...Fa.gra); doc.setLineWidth(0.15); doc.line(tx, y - 2.5, tx + 196, y - 2.5);
        for (const g of res.grupper) {
          if (y > PH - M - 70) { text(`… och ${res.grupper.length - res.grupper.indexOf(g)} till, se CSV-filen.`, tx, y, 6.5); break; }
          const v = [doc.splitTextToSize(g.namn, 32)[0], Fs.STRECK_NAMN[g.streck], tal(g.area), tal(g.summa), tal(g.lokal), tal(g.samtidig), narText(g.nar), `${tal(g.skuggning.volymer * 100)} %`, `${tal(g.skuggning.omgivning * 100)} %`];
          badge(tx - 3.5, y, nummer.get(g), 1.8);
          v.forEach((s, i) => text(s, tx + kol[i] + (i >= 2 && i !== 6 ? (kol[i + 1] || 196) - kol[i] - 1.5 : 0), y, 6.2, { ha: i >= 2 && i !== 6 ? 'right' : 'left', mono: i >= 2 && i !== 6 }));
          y += 4.2;
        }
        // förklaringen
        const forkl = [
          'Summa: instrålningen per kvadratmeter fasad under perioden och tiden ovan, medel för fasaderna åt det hållet.',
          'Lokal topp: högsta timmedel i någon punkt på fasaden, alltså det värsta rummet. Används för solvärmelasten per rum.',
          'Samtidig topp: högsta timmedel för hela fasaden på en gång (areaviktat). Används för kylsystemet.',
          'Skugga: hur mycket mindre direkt sol fasaden får av de andra byggnaderna i skissen, och sedan av omgivningen',
          '(terräng, befintliga hus, träd och fjärran horisont), jämfört med byggnaden ensam.',
          '',
          'Klar himmel varje dag (ESRA, Linkes grumlighetsfaktor 3). Topparna dimensionerar; summorna blir högre än med',
          'verkligt väder. Diffus strålning efter Hay–Davies med den del av himlen fasaden ser, reflex från marken med',
          'albedo 0,2. Fasadpunkter i ett rutnät på cirka 1 m. Svensk tid, med sommartid när den gäller.',
          ...(opt.notis || []),
        ];
        let fy = y + 10;
        text('Så läses bladet', tx, fy, 8, { vikt: 'bold' }); fy += 5;
        for (const r of forkl) { for (const rr of doc.splitTextToSize(r, 196)) { text(rr, tx, fy, 6.3); fy += 3.1; } }
      }
    }

    // --- 2. Timme × dag
    const ng = res.grupper.length, nd = res.dagar.length;
    const RUTOR = 8, KOL = 4;
    const cw = (PW - 2 * M - 12) / KOL, chh = (PH - M - 40 - 22) / 2;
    const skala = SK.topp[1];
    const nivaer = 30;
    for (let s0 = 0; s0 < ng; s0 += RUTOR) {
      huvud('Instrålning över dygnet och perioden');
      res.grupper.slice(s0, s0 + RUTOR).forEach((g, i) => {
        const x = M + 12 + (i % KOL) * cw, y = M + 28 + Math.floor(i / KOL) * chh;
        const w = cw - 14, h = chh - 22;
        badge(x + 2.2, y - 2.4, nummer.get(g), 2.2);
        text(gruppNamn(g), x + 6, y - 2, 8, { vikt: 'bold' });
        const dx = w / nd, dy = h / 24;
        for (let hh = 0; hh < 24; hh++) {
          let start = 0, niva = -1;
          const ritaRun = (fran, till, nv) => { if (nv <= 0) return; fyll(Fs.farg((nv - 0.5) / nivaer)); doc.rect(x + fran * dx, y + hh * dy, (till - fran) * dx + 0.04, dy + 0.04, 'F'); };
          for (let d = 0; d <= nd; d++) {
            const v = d < nd ? g.matris[d * 24 + hh] : -1;
            const nv = d < nd ? (v > 1 ? Math.min(nivaer, Math.ceil(v / skala * nivaer)) : 0) : -2;
            if (nv !== niva) { ritaRun(start, d, niva); start = d; niva = nv; }
          }
        }
        doc.setDrawColor(...Fa.gra); doc.setLineWidth(0.12); doc.rect(x, y, w, h, 'S');
        // kontorstiden
        doc.setDrawColor(...Fa.blck); doc.setLineWidth(0.15); doc.setLineDashPattern([0.8, 0.8], 0);
        for (const t of [8, 17]) doc.line(x, y + t * dy, x + w, y + t * dy);
        doc.setLineDashPattern([], 0);
        for (const t of [0, 6, 12, 18, 24]) text(String(t), x - 1.5, y + t * dy, 5.5, { ha: 'right', farg: Fa.gra });
        // månaderna
        const forstaEtikett = res.dagar.findIndex(d => d.dag === 1);
        res.dagar.forEach((d, k) => {
          if (nd <= 62 && d.dag % 10 === 0) { doc.setDrawColor(...Fa.gra); doc.setLineWidth(0.1); doc.line(x + k * dx, y + h, x + k * dx, y + h + 0.8); text(String(d.dag), x + k * dx, y + h + 3, 5.5, { ha: 'center', farg: Fa.gra }); }
          if (d.dag === 1 || (k === 0 && (forstaEtikett < 0 || forstaEtikett > 12))) { doc.setDrawColor(...Fa.gra); doc.setLineWidth(0.1); doc.line(x + k * dx, y + h, x + k * dx, y + h + 1.2); text(k === 0 && d.dag !== 1 ? `${d.dag} ${MANAD[d.man - 1]}` : MANAD[d.man - 1], x + k * dx + 0.5, y + h + 3, 5.5); }
        });
        if (g.nar) text(`Samtidig topp ${tal(g.samtidig)} W/m², ${narText(g.nar)}`, x, y + h + 7, 6);
      });
      text('Timme (svensk tid), streckat: kl. 8 och 17. Areaviktat medel för fasaderna åt det hållet, alla timmar.', M + 12, PH - M - 14, 6.5);
      skalstock(M + 12, PH - M - 10, 90, 3, SK.topp, 'W/m²');
    }

    // --- 3. Värsta dygnet
    for (let s0 = 0; s0 < ng; s0 += RUTOR) {
      huvud('Värsta dygnet per fasad');
      res.grupper.slice(s0, s0 + RUTOR).forEach((g, i) => {
        const x = M + 14 + (i % KOL) * cw, y = M + 28 + Math.floor(i / KOL) * chh;
        const w = cw - 18, h = chh - 24;
        const d = g.varstaDag >= 0 ? res.dagar[g.varstaDag] : null;
        badge(x + 2.2, y - 6.4, nummer.get(g), 2.2);
        text(gruppNamn(g), x + 6, y - 6, 8, { vikt: 'bold' });
        text(d ? `${d.dag} ${MANAD[d.man - 1]} ${res.ar}` : 'ingen sol under tiden', x, y - 2, 6.5);
        const ymax = 1000;
        // kontorstiden i grått
        fyll([238, 236, 230]); doc.rect(x + w * 8 / 24, y, w * 9 / 24, h, 'F');
        doc.setDrawColor(...Fa.ljus); doc.setLineWidth(0.1);
        for (let k = 0; k <= 5; k++) { const yy = y + h - h * k / 5; doc.line(x, yy, x + w, yy); text(tal(ymax * k / 5), x - 1.5, yy, 5.5, { ha: 'right', farg: Fa.gra }); }
        for (const t of [0, 6, 12, 18, 24]) text(String(t), x + w * t / 24, y + h + 3, 5.5, { ha: 'center', farg: Fa.gra });
        doc.setDrawColor(...Fa.annot); doc.setLineWidth(0.45);
        const P = hh => [x + w * (hh + 0.5) / 24, y + h - h * Math.min(1, g.dygn[hh] / ymax)];
        let forra = null;
        for (let hh = 0; hh < 24; hh++) {
          const p = P(hh);
          if (forra) doc.line(forra[0], forra[1], p[0], p[1]);
          forra = p;
        }
        doc.setDrawColor(...Fa.gra); doc.setLineWidth(0.12); doc.rect(x, y, w, h, 'S');
        if (g.nar) text(`Topp ${tal(g.samtidig)} W/m² kl. ${String(g.nar.tim).padStart(2, '0')}–${String(g.nar.tim + 1).padStart(2, '0')}`, x, y + h + 7, 6);
      });
      text('Areaviktat timmedel för fasaderna åt det hållet, W/m². Värsta dygnet är dagen med den högsta samtidiga toppen under tiden; grått: kl. 8–17.', M + 14, PH - M - 12, 6.5);
    }
    if (opt.dok) return doc;
    return doc.output('arraybuffer');
  }

  /** Fasaderna som CSV (semikolon, decimalkomma), en rad per fasad. */
  function csv(res, { dx = 0, dy = 0 } = {}) {
    const k = (v, d = 0) => v.toFixed(d).replace('.', ',');
    const rader = ['kropp;sida;vaderstreck;azimut;langd_m;area_m2;x1;y1;x2;y2;summa_kWh_m2;lokal_topp_W_m2;samtidig_topp_W_m2;samtidig_topp_datum;samtidig_topp_timme'];
    for (const f of res.fasader) {
      rader.push([f.namn.replace(/;/g, ','), f.sida + 1, f.streck, k(f.az, 1), k(f.langd, 2), k(f.area, 1), k(f.a[0] - dx, 3), k(f.a[1] - dy, 3), k(f.b[0] - dx, 3), k(f.b[1] - dy, 3),
        k(f.summa), k(f.lokal), k(f.samtidig), f.nar ? `${res.ar}-${String(f.nar.dag.man).padStart(2, '0')}-${String(f.nar.dag.dag).padStart(2, '0')}` : '', f.nar ? `${f.nar.tim}-${f.nar.tim + 1}` : ''].join(';'));
    }
    return rader.join('\r\n') + '\r\n';
  }

  return { blad, csv };
}));
