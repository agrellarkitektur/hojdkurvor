// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Sol på fasaderna som PDF (0.15.0): A3 liggande, med
 *   1. staplar per kropp och väderstreck (summa i kWh/m² och högsta samtidiga fasadmedel i W/m²),
 *      en tabell med lokal och samtidig topp och hur mycket skuggningen tar bort,
 *   2. timme × dag per kropp och väderstreck,
 *   3. värsta dygnet per kropp och väderstreck.
 * Beräkningen finns i js/fasadsol.js; här ritas bara. jsPDF via Utskrift.nyttDokument.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./utskrift.js'), require('./fasadsol.js'));
  else root.Fasadsolblad = factory(root.Utskrift, root.Fasadsol);
}(typeof self !== 'undefined' ? self : this, function (U, Fs) {
  'use strict';
  const M = U.MARG, Fa = U.F;
  const MANAD = ['jan', 'feb', 'mars', 'april', 'maj', 'juni', 'juli', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const tal = (v, d = 0) => Number(v).toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const narText = n => (n ? `${n.dag.dag} ${MANAD[n.dag.man - 1]} kl. ${String(n.tim).padStart(2, '0')}–${String(n.tim + 1).padStart(2, '0')}` : '–');
  const gruppNamn = g => `${g.namn}, ${Fs.STRECK_NAMN[g.streck]}`;

  /**
   * opt: { res (Fasadsol.berakna), titel: { projekt, kommun, system }, fonter, notis: [text] }.
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

    // --- 1. Staplar och tabell
    const kroppar = [];
    for (const g of res.grupper) { let k = kroppar.find(q => q.volym === g.volym); if (!k) kroppar.push(k = { volym: g.volym, namn: g.namn, grupper: [] }); k.grupper.push(g); }
    const SK = Fs.skala(res);
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
        text(gruppNamn(g), x, y - 2, 8, { vikt: 'bold' });
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
        text(gruppNamn(g), x, y - 6, 8, { vikt: 'bold' });
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
