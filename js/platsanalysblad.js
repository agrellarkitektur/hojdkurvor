/*
 * Platsanalysblad: ett A3-häfte (PDF) med sammanställning, sol, skuggor, terräng och
 * vatten, skydd och risker samt källor. Ritas med jsPDF och Utskriftens hjälpfunktioner.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Platsanalysblad = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const U = () => (typeof Utskrift !== 'undefined' ? Utskrift : globalThis.Utskrift);
  const Pa = () => (typeof Platsanalys !== 'undefined' ? Platsanalys : globalThis.Platsanalys);
  const S = () => (typeof Sol !== 'undefined' ? Sol : globalThis.Sol);
  const PW = 420, PH = 297, M = 12;
  const BLA = [31, 111, 178], LJUSBLA = [127, 178, 224], LILA = [107, 63, 160], GRON = [46, 125, 50];
  const komma = (v, d = 0) => Number(v).toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const SKALOR = [200, 250, 400, 500, 1000, 2000, 2500, 4000, 5000, 10000];

  /**
   * opt: { fonter, titel: { projekt, kommun, system, datum }, r, kurvor, markhojd: { lo, hi },
   *        lutning: { lt, konturer }, skyfall: { lagpunkter, floden }, volymer, byggnader,
   *        sol: (opt till Sol.soldiagramPdf), skuggor: (opt till Utskrift.skuggblad),
   *        natur, lamningar, oversvamning, strand, kallor: [text], kapitel: { sol, terrang, vatten, skydd } }
   * Värdena natur/lamningar/oversvamning/strand är antingen data eller { fel: text }.
   */
  function skapa(opt) {
    const dok = U().nyttDokument('a3', true, opt.fonter);
    const { doc } = dok;
    doc.setProperties({ title: `Platsanalys ${opt.titel.projekt || ''}`.trim(), creator: 'höjdkurvor.se' });
    const sidor = ['Sammanställning'];
    if (opt.kapitel.sol && opt.sol) sidor.push('Sol');
    if (opt.kapitel.sol && opt.skuggor) sidor.push('Skuggor');
    if (opt.kapitel.terrang || opt.kapitel.vatten) sidor.push('Terräng och vatten');
    if (opt.kapitel.skydd) sidor.push('Skydd och risker');
    sidor.push('Källor och villkor');
    const ctx = { opt, dok, sidor };

    sammanstallning(ctx);
    if (opt.kapitel.sol && opt.sol) S().soldiagramPdf(Object.assign({}, opt.sol, { dok, farg: 'svart' }));
    if (opt.kapitel.sol && opt.skuggor) U().skuggblad(Object.assign({}, opt.skuggor, { dok }));
    if (opt.kapitel.terrang || opt.kapitel.vatten) terrangOchVatten(ctx);
    if (opt.kapitel.skydd) skyddOchRisker(ctx);
    kallor(ctx);
    return doc.output('arraybuffer');
  }

  // ------------------------------------------------------------------
  // Gemensamt
  // ------------------------------------------------------------------
  function verktyg(ctx) {
    const { doc, font, mono } = ctx.dok;
    const F = U().F;
    const text = (s, x, y, pt, o = {}) => {
      doc.setFont(o.mono ? mono : font, o.mono ? 'normal' : (o.vikt || 'normal')); doc.setFontSize(pt);
      doc.setTextColor(...(o.farg || F.blck));
      doc.text(String(s), x, y, { align: o.ha || 'left', baseline: o.va || 'middle', maxWidth: o.max });
    };
    const stycke = (s, x, y, bredd, pt, o = {}) => {
      doc.setFont(o.mono ? mono : font, o.vikt || 'normal'); doc.setFontSize(pt);
      const rader = doc.splitTextToSize(String(s), bredd);
      rader.forEach((rad, i) => text(rad, x, y + i * pt * 0.42, pt, o));
      return y + rader.length * pt * 0.42;
    };
    return { doc, font, mono, F, text, stycke };
  }
  /** Ram, sidhuvud och ritningshuvud på en A3-sida. */
  function sida(ctx, nr, rubrik, ny = true) {
    const { doc, F, text } = verktyg(ctx);
    if (ny) doc.addPage('a3', 'landscape');
    doc.setDrawColor(...F.blck); doc.setLineWidth(0.4); doc.rect(M, M, PW - 2 * M, PH - 2 * M);
    text(`PLATSANALYS · BLAD ${nr} AV ${ctx.sidor.length}`, M + 6, M + 7, 7, { mono: true, farg: F.gra });
    text(rubrik, M + 6, M + 15, 18, { vikt: 'bold' });
    // ritningshuvud nere till höger
    const t = ctx.opt.titel, bw = 150, bh = 22, bx = PW - M - bw, by = PH - M - bh;
    doc.setLineWidth(0.3); doc.setFillColor(255, 255, 255); doc.rect(bx, by, bw, bh, 'FD');
    doc.line(bx + 70, by, bx + 70, by + bh); doc.line(bx + 70, by + bh / 2, bx + bw, by + bh / 2); doc.line(bx + 115, by, bx + 115, by + bh);
    text('PROJEKT', bx + 3, by + 3.5, 5.5, { mono: true, farg: F.gra });
    text(t.projekt || 'Platsanalys', bx + 3, by + 10, 12, { vikt: 'bold' });
    text(t.kommun || '', bx + 3, by + 17, 7);
    text('SYSTEM', bx + 73, by + 3.5, 5.5, { mono: true, farg: F.gra }); text(t.system || '', bx + 73, by + 8, 6.5);
    text('DATUM', bx + 118, by + 3.5, 5.5, { mono: true, farg: F.gra }); text(t.datum || '', bx + 118, by + 8, 6.5, { mono: true });
    text('BLAD', bx + 118, by + 14.5, 5.5, { mono: true, farg: F.gra }); text(`${nr} / ${ctx.sidor.length}`, bx + 118, by + 19, 6.5, { mono: true });
    U().marke(doc, bx + 73, by + 13.2, 5, F.blck, F.annot);
    doc.setFont(ctx.dok.font, 'bold'); doc.setFontSize(8.5); doc.setTextColor(...F.blck);
    doc.text('höjdkurvor', bx + 79.5, by + 16.5, { baseline: 'middle' });
    const wl = doc.getTextWidth('höjdkurvor');
    doc.setTextColor(...F.annot); doc.text('.', bx + 79.5 + wl, by + 16.5, { baseline: 'middle' });
    doc.setTextColor(...F.blck); doc.text('se', bx + 79.5 + wl + doc.getTextWidth('.'), by + 16.5, { baseline: 'middle' });
  }

  /**
   * Kartfält: ritar i rutan (mm) med lämplig skala. lager: funktion(P, L, k) som ritar.
   * Returnerar { k, skala }.
   */
  function kartfalt(ctx, box, rita) {
    const { doc, F, text } = verktyg(ctx);
    const r = ctx.opt.r, marg = Math.max(10, 0.08 * Math.max(r.xmax - r.xmin, r.ymax - r.ymin));
    const vy = { xmin: r.xmin - marg, xmax: r.xmax + marg, ymin: r.ymin - marg, ymax: r.ymax + marg };
    const kmax = Math.min(box.w / (vy.xmax - vy.xmin), box.h / (vy.ymax - vy.ymin));
    const skala = SKALOR.find(s => 1000 / s <= kmax) || Math.ceil(1000 / kmax);
    const k = 1000 / skala;
    const mx = (r.xmin + r.xmax) / 2, my = (r.ymin + r.ymax) / 2, cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const P = (x, y) => [cx + (x - mx) * k, cy - (y - my) * k];
    const L = (pts, stang) => {
      if (pts.length < 2) return;
      const [a, b] = P(pts[0][0], pts[0][1]); doc.moveTo(a, b);
      for (let i = 1; i < pts.length; i++) { const [x, y] = P(pts[i][0], pts[i][1]); doc.lineTo(x, y); }
      if (stang) doc.close();
    };
    doc.saveGraphicsState();
    doc.rect(box.x, box.y, box.w, box.h, null); doc.clip(); doc.discardPath();
    rita(P, L, k);
    doc.restoreGraphicsState();
    // utsnittet
    doc.setDrawColor(...F.ram); doc.setLineWidth(0.35);
    L([[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax]], true); doc.stroke();
    // norrpil och skalstock
    const nx = box.x + box.w - 8, ny = box.y + 12;
    doc.setFillColor(...F.blck); doc.triangle(nx, ny - 8, nx - 2.6, ny + 1.6, nx, ny, 'F');
    doc.setDrawColor(...F.blck); doc.setLineWidth(0.2); doc.triangle(nx, ny - 8, nx + 2.6, ny + 1.6, nx, ny, 'S');
    text('N', nx, ny - 10.5, 8, { ha: 'center', vikt: 'bold' });
    const steg = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500].find(s => s * k >= 8) || 500;
    const sx = box.x + 4, sy = box.y + box.h - 6;
    doc.setFillColor(255, 255, 255); doc.rect(sx - 2, sy - 5, 4 * steg * k + 18, 9, 'F');
    for (let i = 0; i < 4; i++) { doc.setFillColor(...(i % 2 ? [255, 255, 255] : F.blck)); doc.rect(sx + i * steg * k, sy, steg * k, 1.4, 'FD'); }
    text('0', sx, sy - 1.5, 5.5, { mono: true, ha: 'center', va: 'bottom' });
    text(`${komma(4 * steg)} m`, sx + 4 * steg * k, sy - 1.5, 5.5, { mono: true, ha: 'center', va: 'bottom' });
    text(`1:${komma(skala)} (A3)`, sx + 4 * steg * k + 3, sy + 0.7, 5.5, { mono: true });
    return { k, skala };
  }
  /** Rasterbild i zonens koordinater (x0, y1 = mitten av övre vänstra pixeln). */
  function bild(doc, P, b) {
    const [x, y] = P(b.x0 - b.s / 2, b.y1 + b.s / 2);
    const [x2, y2] = P(b.x0 - b.s / 2 + b.W * b.s, b.y1 + b.s / 2 - b.H * b.s);
    doc.addImage(b.url, 'PNG', x, y, x2 - x, y2 - y, undefined, 'FAST');
  }
  function forklaring(ctx, x, y, rader) {
    const { doc, text } = verktyg(ctx);
    rader.forEach(([rita, s], i) => { rita(x, y + i * 4.6); text(s, x + 9, y + i * 4.6, 7); });
    return y + rader.length * 4.6;
  }
  const ruta = (doc, rgb, kant) => (x, y) => { doc.setFillColor(...rgb); if (kant) doc.setDrawColor(...kant); doc.setLineWidth(0.15); doc.rect(x, y - 1.4, 6, 2.8, kant ? 'FD' : 'F'); };
  const linje = (doc, rgb, b, streck) => (x, y) => { doc.setDrawColor(...rgb); doc.setLineWidth(b); if (streck) doc.setLineDashPattern(streck, 0); doc.line(x, y, x + 6, y); doc.setLineDashPattern([], 0); };
  const romb = (doc, rgb) => (x, y) => { doc.setDrawColor(...rgb); doc.setFillColor(255, 255, 255); doc.setLineWidth(0.35); doc.lines([[1.6, 1.6], [-1.6, 1.6], [-1.6, -1.6], [1.6, -1.6]], x + 3, y - 1.6, [1, 1], 'FD', true); };

  // lager som återkommer
  function ritaLutning(doc, P, L, opt) {
    if (opt.lutning && opt.lutning.bild) bild(doc, P, opt.lutning.bild);
  }
  function ritaKurvor(doc, L, opt, svag = false) {
    const F = U().F;
    doc.setDrawColor(...F.kurva);
    (opt.kurvor || []).forEach(k => { doc.setLineWidth((k.lager === 'HOJDKURVA_5M' || k.lager === 'HOJDKURVA_10M' ? 0.22 : 0.08) * (svag ? 0.8 : 1)); L(k.pts, k.sluten); doc.stroke(); });
  }
  function ritaSkyfall(doc, L, opt) {
    const sk = opt.skyfall;
    if (!sk) return;
    doc.setFillColor(...LJUSBLA); doc.setDrawColor(...BLA); doc.setLineWidth(0.2);
    sk.lagpunkter.forEach(l => l.konturer.forEach(k => { L(k, true); doc.fillStroke(); }));
    doc.setDrawColor(...BLA);
    sk.floden.forEach(f => { doc.setLineWidth(f.ack > 4 * (sk.troskel || 400) ? 0.55 : 0.35); L(f.pts, false); doc.stroke(); });
  }
  function ritaVolymer(doc, P, L, opt) {
    const F = U().F;
    (opt.byggnader || []).forEach(b => {
      doc.setFillColor(205, 200, 194); doc.setDrawColor(55, 55, 55); doc.setLineWidth(0.15);
      L(b.fotavtryck, true); doc.fillStroke();
    });
    (opt.volymer || []).forEach(v => {
      doc.setFillColor(255, 255, 255); doc.setDrawColor(...F.annot); doc.setLineWidth(0.4);
      L(v.fotavtryck, true); doc.fillStroke();
    });
  }
  function ritaLamningar(doc, P, opt) {
    const l = opt.lamningar;
    if (!Array.isArray(l)) return;
    l.filter(x => x.x != null).forEach(x => { const [a, b] = P(x.x, x.y); romb(doc, LILA)(a - 3, b); });
  }
  function ritaNatur(doc, L, opt) {
    const n = opt.natur;
    if (!Array.isArray(n)) return;
    doc.setDrawColor(...GRON); doc.setLineWidth(0.45); doc.setLineDashPattern([2, 1], 0);
    n.forEach(o => o.ringar.forEach(rg => { L(rg, true); doc.stroke(); }));
    doc.setLineDashPattern([], 0);
  }

  // ------------------------------------------------------------------
  // Sida 1: sammanställning
  // ------------------------------------------------------------------
  function sammanstallning(ctx) {
    const { opt } = ctx;
    const { doc, F, text, stycke } = verktyg(ctx);
    sida(ctx, 1, 'Sammanställning', false);
    const kol = 146, box = { x: M + 6, y: M + 22, w: PW - 2 * M - kol - 18, h: PH - 2 * M - 30 };
    doc.setFillColor(250, 249, 245); doc.rect(box.x, box.y, box.w, box.h, 'F');
    kartfalt(ctx, box, (P, L) => {
      if (opt.kapitel.terrang) ritaLutning(doc, P, L, opt);
      ritaKurvor(doc, L, opt, true);
      if (opt.kapitel.vatten) ritaSkyfall(doc, L, opt);
      if (opt.kapitel.skydd) { ritaNatur(doc, L, opt); ritaLamningar(doc, P, opt); }
      ritaVolymer(doc, P, L, opt);
    });
    doc.setDrawColor(...F.blck); doc.setLineWidth(0.25); doc.rect(box.x, box.y, box.w, box.h);
    // förklaring i kartans övre vänstra hörn
    const rader = [];
    if (opt.kapitel.terrang && opt.lutning) Pa().LUTNING.forEach(k => rader.push([ruta(doc, k.rgb), `Lutning ${k.kort}`]));
    if (opt.kapitel.vatten && opt.skyfall) { rader.push([ruta(doc, LJUSBLA, BLA), 'Lågpunkt, vatten blir stående']); rader.push([linje(doc, BLA, 0.45), 'Flödesväg vid skyfall']); }
    if (opt.kapitel.skydd && Array.isArray(opt.lamningar) && opt.lamningar.length) rader.push([romb(doc, LILA), 'Lämning (RAÄ)']);
    if (opt.kapitel.skydd && Array.isArray(opt.natur) && opt.natur.length) rader.push([linje(doc, GRON, 0.45, [2, 1]), 'Skyddad natur']);
    if (opt.byggnader && opt.byggnader.length) rader.push([ruta(doc, [205, 200, 194], [55, 55, 55]), 'Befintlig byggnad']);
    if (opt.volymer && opt.volymer.length) rader.push([ruta(doc, [255, 255, 255], F.annot), 'Skissad volym']);
    rader.push([linje(doc, F.ram, 0.35), 'Utsnitt']);
    doc.setFillColor(255, 255, 255); doc.setDrawColor(...F.blck); doc.setLineWidth(0.2);
    doc.rect(box.x + 3, box.y + 3, 62, rader.length * 4.6 + 4, 'FD');
    forklaring(ctx, box.x + 6, box.y + 7, rader);

    // högerspalt med fakta
    const x = PW - M - kol - 4, w = kol;
    let y = M + 26;
    const rubrik = s => { text(s, x, y, 6.5, { mono: true, farg: F.gra }); y += 5; };
    const rad = (a, b, o = {}) => {
      doc.setFont(ctx.dok.font, 'normal'); doc.setFontSize(8);
      const hb = doc.splitTextToSize(String(b), w * 0.48);
      text(a, x, y, 8, { max: w * 0.5 });
      hb.forEach((t, i) => text(t, x + w, y + i * 3.6, 8, Object.assign({ ha: 'right', mono: true }, o)));
      y += Math.max(1, hb.length) * 3.6 + 1.2;
    };
    const linjeUnder = () => { doc.setDrawColor(...F.ljus); doc.setLineWidth(0.2); doc.line(x, y - 1, x + w, y - 1); y += 3; };
    if (opt.markhojd) { rubrik('TERRÄNG'); rad('Markhöjd', `${komma(opt.markhojd.lo, 1)}–${komma(opt.markhojd.hi, 1)} m`); }
    if (opt.kapitel.terrang && opt.lutning) {
      const a = opt.lutning.lt.andel;
      rad('Flackare än 1:20', `${komma((a[0] + a[1]) * 100)} %`);
      rad('Brantare än 1:12', `${komma(a[3] * 100)} %`);
    }
    if (opt.markhojd || opt.lutning) linjeUnder();
    if (opt.kapitel.vatten && opt.skyfall) {
      rubrik('VATTEN VID SKYFALL');
      const lp = opt.skyfall.lagpunkter;
      rad('Lågpunkter i utsnittet', `${lp.length} st`);
      if (lp.length) {
        const st = lp.reduce((m, l) => (l.volym > m.volym ? l : m), lp[0]);
        rad('Största', `${komma(st.yta)} m², ${komma(st.maxDjup, 2)} m djup`);
        rad('Vattenvolym totalt', `${komma(lp.reduce((s, l) => s + l.volym, 0))} m³`);
      }
      linjeUnder();
    }
    if (opt.kapitel.sol && opt.solSammanfattning) {
      rubrik('SOL');
      opt.solSammanfattning.forEach(([a, b]) => rad(a, b));
      linjeUnder();
    }
    if (opt.kapitel.skydd) {
      rubrik('SKYDD OCH RISKER');
      const l = opt.lamningar;
      rad('Lämningar inom 100 m', Array.isArray(l) ? (l.length ? `${l.length} st, se blad ${ctx.sidor.indexOf('Skydd och risker') + 1}` : 'Inga registrerade') : 'Kunde inte kontrolleras', Array.isArray(l) && l.length ? { farg: LILA } : {});
      const n = opt.natur;
      rad('Skyddad natur', Array.isArray(n) ? (n.length ? [...new Set(n.map(o => o.typ))].join(', ') : 'Inget skyddat område') : 'Kunde inte kontrolleras');
      const s = opt.strand;
      rad('Strandskydd', s && !s.fel ? strandText(s).kort : 'Kunde inte kontrolleras');
      const o = opt.oversvamning;
      rad('Översvämning, 100-årsflöde', Array.isArray(o) ? oversvamningKort(o) : 'Kunde inte kontrolleras');
      linjeUnder();
    }
    rubrik('KLIMAT');
    rad('Snölast och vind', 'Kommer i en senare version');
    linjeUnder();
    y = Math.max(y, PH - M - 66);
    stycke('Underlag för tidiga skeden. Uppgifterna ersätter inte myndigheternas egna besked, en geoteknisk undersökning, en dagvattenutredning eller en bullerutredning. Kontrollera alltid mot kommunen och länsstyrelsen. Källor och datum på sista bladet.', x, y, w, 7, { farg: F.gra });
  }
  function strandText(s) {
    if (s.avstand == null || !isFinite(s.avstand)) return { kort: 'Inget vatten inom 300 m', lang: 'Inget vatten i OpenStreetMap inom 300 m från utsnittet.' };
    const d = Math.round(s.avstand), namn = s.objekt ? `${s.objekt.typ}${s.objekt.namn ? ' ' + s.objekt.namn : ''}` : 'vatten';
    if (d <= 100) return { kort: `Kan gälla (${namn}, ${d} m)`, lang: `Utsnittet ligger ${d} m från ${namn}. Generellt strandskydd gäller 100 m från strandlinjen, om det inte är upphävt i en detaljplan.` };
    if (d <= 300) return { kort: `Utvidgat kan gälla (${d} m)`, lang: `Utsnittet ligger ${d} m från ${namn}. Länsstyrelsen kan ha utvidgat strandskyddet till 300 m.` };
    return { kort: 'Inget vatten inom 300 m', lang: 'Inget vatten i OpenStreetMap inom 300 m från utsnittet.' };
  }
  function oversvamningKort(o) {
    const h = o.find(x => x.lager === '13'), k = o.find(x => x.lager === '12'), b = o.find(x => x.lager === '9');
    if (h && h.andel > 0.001) return `Ja, ${komma(h.andel * 100)} % av utsnittet`;
    if ((k && k.andel > 0.001) || (b && b.andel > 0.001)) return 'Nej, men vid högre flöden';
    return 'Inte inom karterat område';
  }

  // ------------------------------------------------------------------
  // Terräng och vatten
  // ------------------------------------------------------------------
  function terrangOchVatten(ctx) {
    const { opt } = ctx;
    const { doc, F, text } = verktyg(ctx);
    sida(ctx, ctx.sidor.indexOf('Terräng och vatten') + 1, 'Terräng och vatten');
    const kol = 146, box = { x: M + 6, y: M + 22, w: PW - 2 * M - kol - 18, h: PH - 2 * M - 30 };
    doc.setFillColor(250, 249, 245); doc.rect(box.x, box.y, box.w, box.h, 'F');
    kartfalt(ctx, box, (P, L) => {
      if (opt.kapitel.terrang) ritaLutning(doc, P, L, opt);
      ritaKurvor(doc, L, opt);
      if (opt.kapitel.vatten) ritaSkyfall(doc, L, opt);
      ritaVolymer(doc, P, L, opt);
      if (opt.kapitel.vatten && opt.skyfall) opt.skyfall.lagpunkter.forEach((l, i) => {
        const [a, b] = P(l.x, l.y);
        doc.setFont(ctx.dok.font, 'bold'); doc.setFontSize(7); doc.setTextColor(...BLA); doc.text(`L${i + 1}`, a + 1.5, b - 1.5);
      });
    });
    doc.setDrawColor(...F.blck); doc.setLineWidth(0.25); doc.rect(box.x, box.y, box.w, box.h);
    const x = PW - M - kol - 4;
    let y = M + 26;
    if (opt.kapitel.terrang && opt.lutning) {
      text('LUTNING', x, y, 6.5, { mono: true, farg: F.gra }); y += 5;
      Pa().LUTNING.forEach((k, i) => {
        ruta(doc, k.rgb)(x, y);
        text(k.namn, x + 9, y, 8); text(`${komma(opt.lutning.lt.andel[i] * 100)} %`, x + kol, y, 8, { ha: 'right', mono: true });
        y += 4.8;
      });
      y = verktyg(ctx).stycke('Klasserna följer tillgänglighetskraven: 1:20 för gångvägar och 1:12 för kortare ramper. Lutningen är räknad över 2 m i markmodellen.', x, y + 2, kol, 7, { farg: F.gra }) + 6;
    }
    if (opt.kapitel.vatten && opt.skyfall) {
      text('LÅGPUNKTER', x, y, 6.5, { mono: true, farg: F.gra }); y += 5;
      text('Nr', x, y, 6.5, { mono: true, farg: F.gra }); text('Yta', x + 30, y, 6.5, { mono: true, farg: F.gra, ha: 'right' });
      text('Djup', x + 60, y, 6.5, { mono: true, farg: F.gra, ha: 'right' }); text('Volym', x + kol, y, 6.5, { mono: true, farg: F.gra, ha: 'right' });
      y += 4;
      const lp = opt.skyfall.lagpunkter.slice(0, 18);
      lp.forEach((l, i) => {
        text(`L${i + 1}`, x, y, 7.5, { mono: true }); text(`${komma(l.yta)} m²`, x + 30, y, 7.5, { mono: true, ha: 'right' });
        text(`${komma(l.maxDjup, 2)} m`, x + 60, y, 7.5, { mono: true, ha: 'right' }); text(`${komma(l.volym, 1)} m³`, x + kol, y, 7.5, { mono: true, ha: 'right' });
        y += 3.8;
      });
      if (!lp.length) { text('Inga instängda områden i utsnittet.', x, y, 7.5); y += 4; }
      if (opt.skyfall.lagpunkter.length > lp.length) { text(`… och ${opt.skyfall.lagpunkter.length - lp.length} till`, x, y, 7); y += 4; }
      verktyg(ctx).stycke('Lågpunkter är instängda områden där vatten blir stående tills det når en tröskel och rinner vidare. Flödesvägarna visar var vattnet rinner på markytan. Beräknat ur Markhöjdmodell (1 m) utan hänsyn till ledningar, diken under mark, infiltration eller regnets mängd' + (opt.volymer && opt.volymer.length ? '. Skissade volymer räknas som hinder.' : '.'), x, y + 3, kol, 7, { farg: F.gra });
    }
  }

  // ------------------------------------------------------------------
  // Skydd och risker
  // ------------------------------------------------------------------
  function skyddOchRisker(ctx) {
    const { opt } = ctx;
    const { doc, F, text, stycke } = verktyg(ctx);
    sida(ctx, ctx.sidor.indexOf('Skydd och risker') + 1, 'Skydd och risker');
    const kol = 146, box = { x: M + 6, y: M + 22, w: PW - 2 * M - kol - 18, h: PH - 2 * M - 30 };
    doc.setFillColor(250, 249, 245); doc.rect(box.x, box.y, box.w, box.h, 'F');
    kartfalt(ctx, box, (P, L) => {
      (opt.oversvamningBilder || []).forEach(b => bild(doc, P, b));
      ritaKurvor(doc, L, opt, true);
      ritaNatur(doc, L, opt);
      ritaLamningar(doc, P, opt);
      ritaVolymer(doc, P, L, opt);
    });
    doc.setDrawColor(...F.blck); doc.setLineWidth(0.25); doc.rect(box.x, box.y, box.w, box.h);
    const x = PW - M - kol - 4;
    let y = M + 26;
    const avsnitt = (rubrik, fn) => { text(rubrik, x, y, 6.5, { mono: true, farg: F.gra }); y += 5; fn(); y += 4; };
    avsnitt('LÄMNINGAR (RIKSANTIKVARIEÄMBETET)', () => {
      const l = opt.lamningar;
      if (!Array.isArray(l)) { y = stycke(`Kunde inte kontrolleras: ${(l && l.fel) || 'okänt fel'}. Sök i Fornsök, app.raa.se/open/fornsok.`, x, y, kol, 7.5); return; }
      if (!l.length) { y = stycke('Inga registrerade lämningar inom 100 m från utsnittet.', x, y, kol, 7.5); return; }
      l.slice(0, 12).forEach(o => { romb(doc, LILA)(x, y); y = stycke(`${o.klass}${o.namn ? ', ' + o.namn : ''}${o.id ? ' (' + o.id + ')' : ''}`, x + 9, y, kol - 9, 7.5) + 1; });
      if (l.length > 12) { text(`… och ${l.length - 12} till`, x + 9, y, 7); y += 4; }
      y = stycke('Fornlämningar är skyddade enligt kulturmiljölagen. Ingrepp kräver tillstånd från länsstyrelsen.', x, y + 1, kol, 7, { farg: F.gra });
    });
    avsnitt('SKYDDAD NATUR (NATURVÅRDSVERKET)', () => {
      const n = opt.natur;
      if (!Array.isArray(n)) { y = stycke(`Kunde inte kontrolleras: ${(n && n.fel) || 'okänt fel'}.`, x, y, kol, 7.5); return; }
      if (!n.length) { y = stycke('Utsnittet berör inget naturreservat, biotopskyddsområde, Natura 2000-område eller annat skyddat område i Naturvårdsregistret.', x, y, kol, 7.5); return; }
      n.slice(0, 10).forEach(o => { linje(doc, GRON, 0.45, [2, 1])(x, y); y = stycke(`${o.typ}${o.namn ? ': ' + o.namn : ''}`, x + 9, y, kol - 9, 7.5) + 1; });
    });
    avsnitt('STRANDSKYDD (INDIKATION)', () => {
      const s = opt.strand;
      y = stycke(s && !s.fel ? strandText(s).lang + ' Kontrollera med kommunen och länsstyrelsen.' : `Kunde inte kontrolleras: ${(s && s.fel) || 'okänt fel'}.`, x, y, kol, 7.5);
    });
    avsnitt('ÖVERSVÄMNING (MYNDIGHETEN FÖR CIVILT FÖRSVAR)', () => {
      const o = opt.oversvamning;
      if (!Array.isArray(o)) { y = stycke(`Kunde inte kontrolleras: ${(o && o.fel) || 'okänt fel'}.`, x, y, kol, 7.5); return; }
      o.forEach(v => { ruta(doc, LJUSBLA)(x, y); text(v.namn, x + 9, y, 7.5, { max: kol - 35 }); text(v.andel > 0.001 ? `${komma(v.andel * 100)} %` : 'nej', x + kol, y, 7.5, { ha: 'right', mono: true }); y += 4.4; });
      y = stycke('Andel av utsnittet inom karterat område. Översvämningskarteringarna täcker större vattendrag och sjöar, inte skyfall eller mindre bäckar.', x, y + 1, kol, 7, { farg: F.gra });
    });
  }

  // ------------------------------------------------------------------
  // Källor
  // ------------------------------------------------------------------
  function kallor(ctx) {
    const { doc, F, text, stycke } = verktyg(ctx);
    sida(ctx, ctx.sidor.length, 'Källor och villkor');
    let y = M + 30;
    const x = M + 8, w = 250;
    text('INNEHÅLL', x, y, 6.5, { mono: true, farg: F.gra }); y += 5;
    ctx.sidor.forEach((s, i) => { text(`${String(i + 1).padStart(2, '0')}  ${s}`, x, y, 9, { mono: true }); y += 5; });
    y += 6;
    text('KÄLLOR', x, y, 6.5, { mono: true, farg: F.gra }); y += 5;
    (ctx.opt.kallor || []).forEach(k => { y = stycke(k, x, y, w, 8.5) + 1.8; });
    y += 6;
    text('VILLKOR', x, y, 6.5, { mono: true, farg: F.gra }); y += 5;
    stycke('Platsanalysen är framtagen automatiskt med höjdkurvor.se, en gratis betatjänst från Agrell Arkitektur. Den är tänkt som underlag i tidiga skeden och tillhandahålls i befintligt skick, utan garantier. Kontrollera uppgifterna mot kommunen, länsstyrelsen och respektive myndighet innan de används för projektering, bygglov eller utsättning.', x, y, w, 8.5);
  }

  return { skapa, strandText, oversvamningKort };
}));
