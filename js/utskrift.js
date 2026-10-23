/*
 * Skalenlig utskrift (PDF) med samma lager som kartan, A4–A1, och skuggstudieblad.
 * Kräver jsPDF (window.jspdf). Grafiken följer höjdkurvor.se: blå ram, orange markeringar.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Utskrift = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const FORMAT = { a4: [297, 210], a3: [420, 297], a2: [594, 420], a1: [841, 594] };
  const MARG = 10;
  const komma = (v, d = 0) => Number(v).toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const KURVSTIL = { HOJDKURVA_0_25M: 0.06, HOJDKURVA_0_5M: 0.09, HOJDKURVA_1M: 0.14, HOJDKURVA_5M: 0.28, HOJDKURVA_10M: 0.42 };
  const F = {                                   // färger i utskriften
    kurva: [143, 79, 34], ram: [29, 79, 140], annot: [232, 85, 40], trad: [63, 122, 58], sp: [170, 30, 30],
    vag: [107, 98, 88], blck: [23, 25, 27], gra: [94, 98, 102], ljus: [217, 217, 212],
  };
  const VAGSTIL = {
    VAG_HUVUDVAG: { b: 0.55 }, VAG_LOKALGATA: { b: 0.38 }, VAG_GANG_CYKEL: { b: 0.2, streck: [1.2, 0.8] }, VAG_OVRIG: { b: 0.28, streck: [2.5, 1] },
  };

  function nyttDokument(format, liggande, fonter) {
    const { jsPDF } = (typeof window !== 'undefined' ? window.jspdf : require('jspdf'));
    const doc = new jsPDF({ orientation: liggande ? 'landscape' : 'portrait', unit: 'mm', format, compress: true });
    let font = 'helvetica', mono = 'courier';
    if (fonter) {
      doc.addFileToVFS('Familjen-Regular.ttf', fonter.normal); doc.addFont('Familjen-Regular.ttf', 'Familjen', 'normal');
      doc.addFileToVFS('Familjen-Bold.ttf', fonter.bold); doc.addFont('Familjen-Bold.ttf', 'Familjen', 'bold');
      font = 'Familjen';
      if (fonter.mono) { doc.addFileToVFS('PlexMono.ttf', fonter.mono); doc.addFont('PlexMono.ttf', 'PlexMono', 'normal'); mono = 'PlexMono'; }
    }
    doc.setLineCap('round'); doc.setLineJoin('round');
    return { doc, font, mono };
  }

  /** Ytterformatet för pappret (mm) med hänsyn till orientering. */
  function papper(format, liggande) {
    const [a, b] = FORMAT[format];
    return liggande ? [Math.max(a, b), Math.min(a, b)] : [Math.min(a, b), Math.max(a, b)];
  }

  /** Största standardskala som får plats, bland vanliga arkitektskalor. */
  function foreslaSkala(r, format, liggande) {
    const [W, H] = papper(format, liggande);
    const fw = W - 2 * MARG, fh = H - 2 * MARG - 36;
    for (const s of [100, 200, 250, 400, 500, 1000, 2000, 5000]) {
      if ((r.xmax - r.xmin) * 1000 / s <= fw && (r.ymax - r.ymin) * 1000 / s <= fh) return s;
    }
    return 5000;
  }

  /** Kartfältet i zonkoordinater för en utskrift (för att hämta bakgrundskartan). */
  function kartfalt(r, format, liggande, skala) {
    const [PW, PH] = papper(format, liggande);
    const k = 1000 / skala, fw = PW - 2 * MARG, fh = PH - 2 * MARG;
    const mx = (r.xmin + r.xmax) / 2, my = (r.ymin + r.ymax) / 2, cyOff = (fh - 34) / 2;
    return { xmin: mx - fw / 2 / k, xmax: mx + fw / 2 / k, ymax: my + cyOff / k, ymin: my - (fh - cyOff) / k };
  }

  /** Märket (tre höjdkurvor och ett kors) ritat i PDF. */
  function marke(doc, x, y, sz, ring, kors) {
    const sk = sz / 64;
    const ell = (cx, cy, rx, ry) => {
      const v = -14 * Math.PI / 180, c = Math.cos(v), s = Math.sin(v), pts = [];
      for (let i = 0; i <= 48; i++) {
        const a = i / 48 * 2 * Math.PI, ex = rx * Math.cos(a), ey = ry * Math.sin(a);
        const px = 32 + (cx - 32 + ex) * c - (cy - 32 + ey) * s, py = 32 + (cx - 32 + ex) * s + (cy - 32 + ey) * c;
        pts.push([x + px * sk, y + py * sk]);
      }
      doc.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => doc.lineTo(p[0], p[1])); doc.stroke();
    };
    doc.setDrawColor(...ring); doc.setLineWidth(2.4 * sk);
    ell(30, 34, 27, 21); ell(34.5, 31, 17.5, 13.5); ell(38, 29, 8.5, 6.5);
    doc.setDrawColor(...kors); doc.line(x + 36 * sk, y + 27 * sk, x + 43 * sk, y + 27 * sk); doc.line(x + 39.5 * sk, y + 23.5 * sk, x + 39.5 * sk, y + 30.5 * sk);
  }

  // ------------------------------------------------------------------
  // Plankarta i skala
  // ------------------------------------------------------------------
  /**
   * opt: { format, liggande, skala, utsnitt, lager: {...}, titel: {...}, fonter }
   * lager: { bakgrund: {bild (dataURL), x0, y1, W, H, s}, kurvor, siffror, marktacke: {ytor}, marktackeFarg,
   *          byggnader: [{fotavtryck, hal, husnummer, centrum}], fastigheter: {granser, ytor},
   *          hom: {bild, x0, y1, W, H, s}, ortofoto: {bild (JPEG), x0, y1, W, H, s, ar}, skuggor: {konturer, etikett}, trad, stompunkter, dz, vagar: {linjer},
   *          sektioner: [{namn, a, b, vand}], nollpunkt: {x, y}, ram, rutnat }
   */
  function plan(opt) {
    const { format, liggande, skala, utsnitt: r } = opt;
    const [PW, PH] = papper(format, liggande);
    const { doc, font, mono } = nyttDokument(format, liggande, opt.fonter);
    doc.setProperties({ title: `${opt.titel.projekt || 'Terrängunderlag'} 1:${skala}`, creator: 'höjdkurvor.se' });
    const k = 1000 / skala;
    const fx0 = MARG, fy0 = MARG, fw = PW - 2 * MARG, fh = PH - 2 * MARG;
    const mx = (r.xmin + r.xmax) / 2, my = (r.ymin + r.ymax) / 2;
    const cx = fx0 + fw / 2, cy = fy0 + (fh - 34) / 2;      // centrera ovanför namnrutan
    const P = (x, y) => [cx + (x - mx) * k, cy - (y - my) * k];
    const L = (pts, stang) => {
      if (pts.length < 2) return;
      const [a, b] = P(pts[0][0], pts[0][1]); doc.moveTo(a, b);
      for (let i = 1; i < pts.length; i++) { const [x, y] = P(pts[i][0], pts[i][1]); doc.lineTo(x, y); }
      if (stang) doc.close();
    };
    const text = (s, x, y, pt, o = {}) => {
      doc.setFont(o.mono ? mono : font, o.mono ? 'normal' : (o.vikt || 'normal')); doc.setFontSize(pt);
      doc.text(String(s), x, y, { align: o.ha || 'left', baseline: o.va || 'middle', angle: o.vinkel || 0 });
    };
    const halo = (s, x, y, pt, o = {}) => {
      doc.setFont(o.mono ? mono : font, o.mono ? 'normal' : (o.vikt || 'normal')); doc.setFontSize(pt);
      const opt2 = { align: o.ha || 'center', baseline: o.va || 'middle', angle: o.vinkel || 0 };
      doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.7);
      doc.text(String(s), x, y, Object.assign({ renderingMode: 'stroke' }, opt2));
      doc.setTextColor(...(o.farg || F.blck));
      doc.text(String(s), x, y, Object.assign({ renderingMode: 'fill' }, opt2));
    };
    const g = opt.lager || {};
    const klippRuta = (x0, y0, w, h) => { doc.saveGraphicsState(); doc.rect(x0, y0, w, h, null); doc.clip(); doc.discardPath(); };
    const klippUtsnitt = () => { doc.saveGraphicsState(); L([[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax]], true); doc.clip(); doc.discardPath(); };

    klippRuta(fx0, fy0, fw, fh);

    // bakgrundskarta över hela kartfältet
    if (g.bakgrund && g.bakgrund.bild) {
      const b = g.bakgrund, [x0, y0] = P(b.x0, b.y1);
      doc.addImage(b.bild, 'JPEG', x0, y0, b.W * b.s * k, b.H * b.s * k, undefined, 'FAST');
    }
    // ortofoto, bara inom utsnittet
    if (g.ortofoto && g.ortofoto.bild) {
      klippUtsnitt();
      const o = g.ortofoto, [x0, y0] = P(o.x0 - o.s / 2, o.y1 + o.s / 2);
      doc.addImage(o.bild, 'JPEG', x0, y0, o.W * o.s * k, o.H * o.s * k, undefined, 'FAST');
      doc.restoreGraphicsState();
    }
    // marktäcke (halvgenomskinligt om det finns en bakgrundskarta eller ett ortofoto)
    if (g.marktacke) {
      doc.saveGraphicsState();
      if (g.bakgrund || g.ortofoto) doc.setGState(new doc.GState({ opacity: 0.55 }));
      doc.setLineWidth(0.08); doc.setDrawColor(150, 150, 150);
      for (const y of g.marktacke.ytor) {
        doc.setFillColor(...(g.marktackeFarg ? g.marktackeFarg(y.klass) : [235, 235, 235]));
        y.ringar.forEach(ring => L(ring, true));
        doc.fillStrokeEvenOdd();
      }
      doc.restoreGraphicsState();
    }
    // höjd över mark (genomskinlig under 1,5 m), bara inom utsnittet
    if (g.hom && g.hom.bild) {
      klippUtsnitt();
      const [x0, y0] = P(g.hom.x0 - g.hom.s / 2, g.hom.y1 + g.hom.s / 2);
      doc.addImage(g.hom.bild, 'PNG', x0, y0, g.hom.W * g.hom.s * k, g.hom.H * g.hom.s * k, undefined, 'FAST');
      doc.restoreGraphicsState();
    }
    // lutning, bara inom utsnittet
    if (g.lutning) {
      klippUtsnitt();
      const b = g.lutning, [x0, y0] = P(b.x0 - b.s / 2, b.y1 + b.s / 2);
      doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: 0.8 }));
      doc.addImage(b.url, 'PNG', x0, y0, b.W * b.s * k, b.H * b.s * k, undefined, 'FAST');
      doc.restoreGraphicsState();
      doc.restoreGraphicsState();
    }
    // skyfall: lågpunkter och flödesvägar
    if (g.skyfall) {
      doc.setFillColor(127, 178, 224); doc.setDrawColor(31, 111, 178); doc.setLineWidth(0.15);
      g.skyfall.lagpunkter.forEach(l => l.konturer.forEach(kt => { L(kt, true); doc.fillStroke(); }));
      g.skyfall.floden.forEach(f => { doc.setLineWidth(f.ack > 4 * (g.skyfall.troskel || 400) ? 0.45 : 0.28); L(f.pts, false); doc.stroke(); });
    }
    // skuggor
    if (g.skuggor && g.skuggor.konturer.length) {
      klippUtsnitt();
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.28 }));
      doc.setFillColor(40, 40, 40);
      g.skuggor.konturer.forEach(l => L(l.pts, true));
      doc.fillEvenOdd();
      doc.restoreGraphicsState();
      doc.setLineWidth(0.1); doc.setDrawColor(90, 90, 90);
      g.skuggor.konturer.forEach(l => { L(l.pts, true); doc.stroke(); });
      doc.restoreGraphicsState();
    }
    // vägar
    if (g.vagar && g.vagar.linjer.length) {
      for (const l of g.vagar.linjer) {
        const st = VAGSTIL[l.lager] || VAGSTIL.VAG_OVRIG;
        doc.setDrawColor(...F.vag); doc.setLineWidth(st.b);
        doc.setLineDashPattern(st.streck || [], 0);
        L(l.pts, false); doc.stroke();
      }
      doc.setLineDashPattern([], 0);
    }
    // höjdkurvor
    if (g.kurvor) {
      doc.setDrawColor(...F.kurva);
      for (const kv of g.kurvor) {
        doc.setLineWidth(KURVSTIL[kv.lager] || 0.1);
        L(kv.pts, kv.sluten); doc.stroke();
      }
      if (g.siffror) {
        const harFem = g.kurvor.some(kv => kv.lager === 'HOJDKURVA_5M' || kv.lager === 'HOJDKURVA_10M');
        const ok = kv => harFem ? (kv.lager === 'HOJDKURVA_5M' || kv.lager === 'HOJDKURVA_10M') : kv.lager === 'HOJDKURVA_1M';
        for (const kv of g.kurvor) {
          if (!ok(kv)) continue;
          const pts = kv.pts.map(p => P(p[0], p[1]));
          let acc = 25, langd = 0;
          for (let i = 1; i < pts.length; i++) langd += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          if (langd < 30) continue;
          for (let i = 1; i < pts.length; i++) {
            const [x1, y1] = pts[i - 1], [x2, y2] = pts[i], d = Math.hypot(x2 - x1, y2 - y1);
            acc += d;
            if (acc < 70 || x2 < fx0 + 5 || x2 > fx0 + fw - 5 || y2 < fy0 + 5 || y2 > fy0 + fh - 5) continue;
            let v = Math.atan2(-(y2 - y1), x2 - x1) * 180 / Math.PI;
            if (v > 90) v -= 180; if (v < -90) v += 180;
            halo(komma(kv.h, kv.h % 1 ? 1 : 0), (x1 + x2) / 2, (y1 + y2) / 2, 5.5, { vinkel: v, farg: F.kurva });
            acc = 0;
          }
        }
        doc.setTextColor(0, 0, 0);
      }
    }
    // befintliga byggnader, med husnummer i skala 1:1000 och större
    if (g.byggnader) {
      doc.setFillColor(205, 200, 194); doc.setDrawColor(55, 55, 55); doc.setLineWidth(0.18);
      for (const b of g.byggnader) { L(b.fotavtryck, true); (b.hal || []).forEach(h => L(h, true)); doc.fillStrokeEvenOdd(); }
      if (opt.skala <= 1000) {
        doc.setTextColor(55, 55, 55);
        for (const b of g.byggnader) {
          if (!b.husnummer || !b.centrum) continue;
          const [x, y] = P(b.centrum[0], b.centrum[1]);
          text(b.husnummer, x, y, 5, { ha: 'center' });
        }
        doc.setTextColor(0, 0, 0);
      }
    }
    // fastighetsgränser (streckade där registret anger osäkerhet över 1 m) och beteckningar
    if (g.fastigheter) {
      doc.setDrawColor(176, 48, 106);
      for (const gr of g.fastigheter.granser) {
        doc.setLineWidth(gr.typ === 'fastighetsgräns' ? 0.3 : 0.45);
        doc.setLineDashPattern(gr.osakerhet > 1 ? [1.6, 1.0] : [], 0);
        L(gr.pts, false); doc.stroke();
      }
      doc.setLineDashPattern([], 0);
      if (opt.skala <= 2000) for (const y of g.fastigheter.ytor) {
        if (!y.ankare) continue;
        const [x, yy] = P(y.ankare[0], y.ankare[1]);
        halo(y.etikett, x, yy, opt.skala <= 500 ? 9 : 7, { farg: [176, 48, 106] });
      }
    }
    // skissade volymer
    if (g.volymer) {
      doc.setFillColor(255, 255, 255); doc.setDrawColor(...F.annot); doc.setLineWidth(0.35);
      g.volymer.forEach(v => { L(v.fotavtryck, true); doc.fillStroke(); });
    }
    // höjdpunkter
    if (g.hojdpunkter) {
      doc.setFillColor(...F.annot);
      for (const p of g.hojdpunkter) {
        const [x, y] = P(p.x, p.y);
        doc.circle(x, y, 0.35, 'F');
        if (k >= 1.5) halo((p.z - (g.dz || 0)).toFixed(2).replace('.', ','), x + 0.8, y - 0.9, 4.6, { ha: 'left', farg: F.annot, mono: true });
      }
      doc.setTextColor(0, 0, 0);
    }
    // träd
    if (g.trad) {
      doc.setDrawColor(...F.trad); doc.setFillColor(...F.trad); doc.setLineWidth(0.12);
      for (const t of g.trad) {
        const [x, y] = P(t.x, t.y);
        doc.circle(x, y, Math.max(0.4, t.krona / 2 * k), 'S');
        doc.circle(x, y, 0.25, 'F');
      }
    }
    // stompunkter
    if (g.stompunkter) {
      for (const p of g.stompunkter) {
        const [x, y] = P(p.x, p.y);
        doc.setDrawColor(...F.sp); doc.setFillColor(255, 255, 255); doc.setLineWidth(0.35);
        doc.circle(x, y, 1.1, 'FD');
        doc.setTextColor(...F.sp);
        text(`${p.namn || ''}${p.z != null ? '  +' + komma(p.z - (g.dz || 0), 2) : ''}`, x + 1.8, y, 5.5, { mono: true });
      }
      doc.setTextColor(0, 0, 0);
    }
    // utsnittets ram
    if (g.ram !== false) {
      doc.setDrawColor(...F.ram); doc.setLineWidth(0.3);
      L([[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax]], true); doc.stroke();
    }
    // sektionslinjer: tunn orange linje, öppna pilar åt blickriktningen, bokstäver i linjens förlängning
    if (g.sektioner) {
      for (const s of g.sektioner) {
        const [x1, y1] = P(s.a[0], s.a[1]), [x2, y2] = P(s.b[0], s.b[1]);
        const l = Math.hypot(x2 - x1, y2 - y1); if (!l) continue;
        const dx = (x2 - x1) / l, dy = (y2 - y1) / l;
        // blickriktning: vänster om A→B på kartan (pappret har y nedåt), höger om linjen är vänd
        const nx = s.vand ? -dy : dy, ny = s.vand ? dx : -dx;
        doc.setDrawColor(...F.annot); doc.setLineWidth(0.22);
        doc.line(x1, y1, x2, y2);
        for (const [ex, ey, ut] of [[x1, y1, -1], [x2, y2, 1]]) {
          const tx = ex + nx * 4, ty = ey + ny * 4;
          doc.line(ex, ey, tx, ty);
          const h = 1.3;
          doc.line(tx - nx * h + dx * h * 0.7, ty - ny * h + dy * h * 0.7, tx, ty);
          doc.line(tx - nx * h - dx * h * 0.7, ty - ny * h - dy * h * 0.7, tx, ty);
          // bokstaven: baslinjen i linjens förlängning, toppen åt blickriktningen
          const vinkel = Math.atan2(nx, -ny);      // medurs från uppåt, i papperets riktning
          const bx = ex + dx * ut * 2.6, by = ey + dy * ut * 2.6;
          doc.setFont(font, 'bold'); doc.setFontSize(9);
          const w = doc.getTextWidth(s.namn);
          const ux = Math.cos(vinkel), uy = Math.sin(vinkel);  // textens baslinjeriktning på pappret
          doc.setTextColor(...F.annot);
          doc.text(s.namn, bx - ux * w / 2, by - uy * w / 2, { angle: -vinkel * 180 / Math.PI, baseline: 'alphabetic' });
        }
        doc.setTextColor(0, 0, 0);
      }
    }
    // nollpunkt
    if (g.nollpunkt) {
      const [x, y] = P(g.nollpunkt.x, g.nollpunkt.y);
      doc.setDrawColor(...F.annot); doc.setLineWidth(0.35);
      doc.circle(x, y, 1.6, 'S'); doc.line(x - 3.2, y, x + 3.2, y); doc.line(x, y - 3.2, x, y + 3.2);
      doc.setTextColor(...F.annot);
      halo(`X = ${komma(g.nollpunkt.x, g.nollpunkt.x % 1 ? 3 : 0)}`, x + 2.6, y + 3.4, 5.8, { ha: 'left', mono: true, farg: F.annot });
      halo(`Y = ${komma(g.nollpunkt.y, g.nollpunkt.y % 1 ? 3 : 0)}`, x + 2.6, y + 6.0, 5.8, { ha: 'left', mono: true, farg: F.annot });
      doc.setTextColor(0, 0, 0);
    }
    // koordinatkryss
    const steg = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find(s => s * k >= 40) || 1000;
    if (g.rutnat !== false) {
      doc.setDrawColor(...F.gra); doc.setLineWidth(0.12);
      const xa = (x) => cx + (x - mx) * k, ya = (y) => cy - (y - my) * k;
      const xmin = mx - (cx - fx0) / k, xmax = mx + (fx0 + fw - cx) / k, ymax = my + (cy - fy0) / k, ymin = my - (fy0 + fh - cy) / k;
      for (let x = Math.ceil(xmin / steg) * steg; x <= xmax; x += steg)
        for (let y = Math.ceil(ymin / steg) * steg; y <= ymax; y += steg) {
          doc.line(xa(x) - 1.5, ya(y), xa(x) + 1.5, ya(y)); doc.line(xa(x), ya(y) - 1.5, xa(x), ya(y) + 1.5);
        }
      doc.restoreGraphicsState();
      doc.setTextColor(...F.gra);
      for (let x = Math.ceil(xmin / steg) * steg; x <= xmax; x += steg) if (xa(x) > fx0 + 8 && xa(x) < fx0 + fw - 8) text(komma(x), xa(x), fy0 - 1.6, 5.5, { ha: 'center', va: 'bottom', mono: true });
      for (let y = Math.ceil(ymin / steg) * steg; y <= ymax; y += steg) if (ya(y) > fy0 + 12 && ya(y) < fy0 + fh - 12) text(komma(y), fx0 - 1.6, ya(y), 5.5, { ha: 'center', va: 'bottom', vinkel: 90, mono: true });
      doc.setTextColor(0, 0, 0);
    } else doc.restoreGraphicsState();

    // ram runt kartan
    doc.setDrawColor(...F.blck); doc.setLineWidth(0.35); doc.rect(fx0, fy0, fw, fh, 'S');

    // nordpil (rutnätsnord uppåt)
    const nx = fx0 + fw - 12, ny = fy0 + 16;
    doc.setFillColor(...F.blck); doc.setDrawColor(...F.blck); doc.setLineWidth(0.25);
    doc.triangle(nx, ny - 9, nx - 3, ny + 2, nx, ny, 'F');
    doc.triangle(nx, ny - 9, nx + 3, ny + 2, nx, ny, 'S');
    text('N', nx, ny - 11.5, 9, { ha: 'center', vikt: 'bold' });

    // skalstock
    const sx = fx0 + 6, sy = fy0 + fh - 8, segm = steg / 2, antal = 4;
    doc.setFillColor(255, 255, 255); doc.rect(sx - 3, sy - 5.5, antal * segm * k + 9, 12.5, 'F');
    doc.setLineWidth(0.25); doc.setDrawColor(...F.blck);
    for (let i = 0; i < antal; i++) {
      doc.setFillColor(...(i % 2 ? [255, 255, 255] : F.blck));
      doc.rect(sx + i * segm * k, sy, segm * k, 1.6, 'FD');
    }
    text('0', sx, sy - 1.2, 6, { ha: 'center', va: 'bottom', mono: true });
    text(`${komma(segm * antal)} m`, sx + antal * segm * k, sy - 1.2, 6, { ha: 'center', va: 'bottom', mono: true });
    text(`Skala 1:${komma(skala)} (${format.toUpperCase()})`, sx, sy + 4.5, 6.5, { mono: true });

    // namnruta
    const t = opt.titel || {};
    // teckenförklaring och källor bestämmer rutans höjd
    const rader = [];
    if (g.ortofoto) rader.push([(x, y) => { [[118, 139, 92], [164, 158, 132], [92, 112, 80]].forEach((c, i) => { doc.setFillColor(...c); doc.rect(x + i * 2.34, y - 1.1, 2.34, 2.2, 'F'); }); }, `Ortofoto ${g.ortofoto.ar || ''}`.trim()]);
    if (g.kurvor) rader.push([(x, y) => { doc.setDrawColor(...F.kurva); doc.setLineWidth(0.28); doc.line(x, y, x + 7, y); }, `Höjdkurvor${t.ekvidistans ? ', ' + t.ekvidistans : ''}`]);
    if (g.marktacke) rader.push([(x, y) => { doc.setFillColor(220, 235, 213); doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.08); doc.rect(x, y - 1.1, 7, 2.2, 'FD'); }, 'Marktäcke']);
    if (g.byggnader) rader.push([(x, y) => { doc.setFillColor(205, 200, 194); doc.setDrawColor(55, 55, 55); doc.setLineWidth(0.18); doc.rect(x, y - 1.1, 7, 2.2, 'FD'); }, 'Befintlig byggnad']);
    if (g.fastigheter) rader.push([(x, y) => { doc.setDrawColor(176, 48, 106); doc.setLineWidth(0.3); doc.line(x, y, x + 3, y); doc.setLineDashPattern([1, 0.7], 0); doc.line(x + 4, y, x + 7, y); doc.setLineDashPattern([], 0); }, 'Fastighetsgräns (streckad: osäker)']);
    if (g.hom) rader.push([(x, y) => { doc.setFillColor(120, 170, 110); doc.rect(x, y - 1.1, 7, 2.2, 'F'); }, 'Höjd över mark']);
    if (g.skuggor) rader.push([(x, y) => { doc.setFillColor(170, 170, 170); doc.rect(x, y - 1.1, 7, 2.2, 'F'); }, `Skugga ${g.skuggor.etikett || ''}`]);
    if (g.lutning) rader.push([(x, y) => { [[241, 215, 122], [237, 162, 90], [200, 85, 61]].forEach((c, i) => { doc.setFillColor(...c); doc.rect(x + i * 2.34, y - 1.1, 2.34, 2.2, 'F'); }); }, 'Lutning 1:50 / 1:20 / 1:12']);
    if (g.skyfall) rader.push([(x, y) => { doc.setFillColor(127, 178, 224); doc.rect(x, y - 1.1, 3.2, 2.2, 'F'); doc.setDrawColor(31, 111, 178); doc.setLineWidth(0.35); doc.line(x + 4, y, x + 7, y); }, 'Lågpunkt och flödesväg']);
    if (g.hojdpunkter) rader.push([(x, y) => { doc.setFillColor(...F.annot); doc.circle(x + 3.5, y, 0.45, 'F'); }, 'Höjdpunkt']);
    if (g.volymer) rader.push([(x, y) => { doc.setDrawColor(...F.annot); doc.setLineWidth(0.35); doc.rect(x, y - 1.1, 7, 2.2, 'S'); }, 'Skissad volym']);
    if (g.trad) rader.push([(x, y) => { doc.setDrawColor(...F.trad); doc.setLineWidth(0.12); doc.circle(x + 3.5, y, 1.1, 'S'); }, 'Träd (krona)']);
    if (g.stompunkter) rader.push([(x, y) => { doc.setDrawColor(...F.sp); doc.setFillColor(255, 255, 255); doc.setLineWidth(0.3); doc.circle(x + 3.5, y, 0.9, 'FD'); }, 'Stompunkt']);
    if (g.vagar) rader.push([(x, y) => { doc.setDrawColor(...F.vag); doc.setLineWidth(0.4); doc.line(x, y, x + 7, y); }, 'Väg, mittlinje (OSM)']);
    if (g.sektioner) rader.push([(x, y) => { doc.setDrawColor(...F.annot); doc.setLineWidth(0.22); doc.line(x, y, x + 7, y); }, 'Sektionslinje']);
    if (g.ram !== false) rader.push([(x, y) => { doc.setDrawColor(...F.ram); doc.setLineWidth(0.3); doc.line(x, y, x + 7, y); }, 'Utsnitt']);
    if (g.nollpunkt) rader.push([(x, y) => { doc.setDrawColor(...F.annot); doc.setLineWidth(0.25); doc.circle(x + 3.5, y, 0.9, 'S'); doc.line(x + 1.7, y, x + 5.3, y); doc.line(x + 3.5, y - 1.6, x + 3.5, y + 1.6); }, 'Lokal nollpunkt']);
    const kallor = doc.setFont(font, 'normal').setFontSize(5).splitTextToSize(t.kallor || '© Lantmäteriet, CC BY 4.0', 60).slice(0, 4);
    const bw = 132, bh = Math.max(36, 4.2 + rader.length * 3.3 + 1.2 + kallor.length * 2.3 + 1), bx = fx0 + fw - bw, by = fy0 + fh - bh;
    doc.setFillColor(255, 255, 255); doc.setDrawColor(...F.blck); doc.setLineWidth(0.35); doc.rect(bx, by, bw, bh, 'FD');
    doc.setLineWidth(0.15); doc.line(bx + 64, by, bx + 64, by + bh);
    let ty = by + 5;
    text(t.projekt || 'Terrängunderlag', bx + 3, ty, 10, { vikt: 'bold' }); ty += 5;
    if (t.kommun) { text(t.kommun, bx + 3, ty, 7); ty += 4; }
    text(`Skala 1:${komma(skala)} i ${format.toUpperCase()}`, bx + 3, ty, 7); ty += 4;
    text(t.system || '', bx + 3, ty, 6.5); ty += 3.5;
    text('Höjdsystem RH 2000', bx + 3, ty, 6.5); ty += 3.5;
    if (t.datum) text(t.datum, bx + 3, ty, 6.5, { mono: true });
    // höjdkurvor.se
    marke(doc, bx + 3, by + bh - 7.2, 5, F.blck, F.annot);
    doc.setFont(font, 'bold'); doc.setFontSize(8.5); doc.setTextColor(...F.blck);
    doc.text('höjdkurvor', bx + 9.4, by + bh - 4, { baseline: 'middle' });
    const wl = doc.getTextWidth('höjdkurvor');
    doc.setTextColor(...F.annot); doc.text('.', bx + 9.4 + wl, by + bh - 4, { baseline: 'middle' });
    doc.setTextColor(...F.blck); doc.text('se', bx + 9.4 + wl + doc.getTextWidth('.'), by + bh - 4, { baseline: 'middle' });
    let ly = by + 4.2;
    for (const [rita, txt] of rader) { rita(bx + 67, ly); text(txt, bx + 76, ly, 5.8); ly += 3.3; }
    kallor.forEach((k, i) => text(k, bx + 67, by + bh - 2.6 - (kallor.length - 1 - i) * 2.3, 5));

    text('Skriv ut i verklig storlek (100 %). Kontrollera skalan med skalstocken.', fx0, PH - MARG + 4.5, 6, { va: 'middle' });
    return doc.output('arraybuffer');
  }

  // ------------------------------------------------------------------
  // Skuggstudie som översiktsblad
  // ------------------------------------------------------------------
  /**
   * opt: { utsnitt, rader: [{namn, tider: [{etikett, konturer}]}], kurvor, titel, fonter, notis }
   */
  function skuggblad(opt) {
    const r = opt.utsnitt, nr = opt.rader.length, nk = Math.max(...opt.rader.map(x => x.tider.length));
    const liggande = true, format = nk > 4 || nr > 3 ? 'a3' : 'a4';
    const [PW, PH] = papper(format, liggande);
    // opt.dok = { doc, font, mono }: rita som en ny sida i ett befintligt dokument
    const { doc, font, mono } = opt.dok || nyttDokument(format, liggande, opt.fonter);
    if (opt.dok) doc.addPage(format, 'landscape');
    else doc.setProperties({ title: `Skuggstudie ${opt.titel.projekt || ''}`, creator: 'höjdkurvor.se' });
    const text = (s, x, y, pt, o = {}) => { doc.setFont(o.mono ? mono : font, o.mono ? 'normal' : (o.vikt || 'normal')); doc.setFontSize(pt); doc.text(String(s), x, y, { align: o.ha || 'left', baseline: o.va || 'middle' }); };
    text(`Skuggstudie${opt.titel.projekt ? ' – ' + opt.titel.projekt : ''}`, MARG, MARG + 4, 16, { vikt: 'bold' });
    text([opt.titel.kommun, opt.titel.system].filter(Boolean).join('. '), MARG, MARG + 11, 7.5);
    const top = MARG + 18, vanster = MARG + 28, botten = PH - MARG - 14;
    const cw = (PW - MARG - vanster) / nk, ch = (botten - top) / nr;
    const rw = r.xmax - r.xmin, rh = r.ymax - r.ymin;
    const k = Math.min((cw - 6) / rw, (ch - 9) / rh);
    opt.rader.forEach((rd, i) => {
      const y0 = top + i * ch;
      text(rd.namn, MARG, y0 + ch / 2 - 2, 8, { vikt: 'bold' });
      if (rd.under) text(rd.under, MARG, y0 + ch / 2 + 2.5, 6.5);
      rd.tider.forEach((ti, j) => {
        const x0 = vanster + j * cw + (cw - rw * k) / 2, yy0 = y0 + 6;
        const P = (x, y) => [x0 + (x - r.xmin) * k, yy0 + (r.ymax - y) * k];
        const L = (pts, stang) => { const [a, b] = P(pts[0][0], pts[0][1]); doc.moveTo(a, b); for (let q = 1; q < pts.length; q++) { const [x, y] = P(pts[q][0], pts[q][1]); doc.lineTo(x, y); } if (stang) doc.close(); };
        text(ti.etikett, x0, y0 + 3, 7, { mono: true });
        if (ti.konturer && ti.konturer.length) {
          doc.setFillColor(150, 150, 150); ti.konturer.forEach(l => L(l.pts, true)); doc.fillEvenOdd();
        }
        if (ti.text) text(ti.text, x0 + rw * k / 2, yy0 + rh * k / 2, 7, { ha: 'center' });
        if (opt.kurvor) {
          doc.setDrawColor(...F.kurva); doc.setLineWidth(0.08);
          opt.kurvor.filter(kv => kv.lager !== 'HOJDKURVA_0_5M' && kv.lager !== 'HOJDKURVA_0_25M').forEach(kv => { L(kv.pts, kv.sluten); doc.stroke(); });
        }
        doc.setDrawColor(...F.ram); doc.setLineWidth(0.25); doc.rect(x0, yy0, rw * k, rh * k, 'S');
      });
    });
    // nordpil
    const nx = PW - MARG - 4, ny = MARG + 6;
    doc.setFillColor(...F.blck); doc.triangle(nx, ny - 5, nx - 1.8, ny + 1.5, nx + 1.8, ny + 1.5, 'F');
    text('N', nx, ny - 7, 7, { ha: 'center', vikt: 'bold' });
    (opt.notis || []).forEach((n, i) => text(n, MARG, PH - MARG - 9 + i * 3.2, 6.2));
    // höjdkurvor.se
    marke(doc, PW - MARG - 30, PH - MARG - 4.6, 4.5, F.blck, F.annot);
    doc.setFont(font, 'bold'); doc.setFontSize(8); doc.setTextColor(...F.blck);
    const x0 = PW - MARG - 24.4, y0 = PH - MARG - 1.8;
    doc.text('höjdkurvor', x0, y0, { baseline: 'middle' });
    const wl = doc.getTextWidth('höjdkurvor');
    doc.setTextColor(...F.annot); doc.text('.', x0 + wl, y0, { baseline: 'middle' });
    doc.setTextColor(...F.blck); doc.text('se', x0 + wl + doc.getTextWidth('.'), y0, { baseline: 'middle' });
    if (opt.dok) return doc;
    return doc.output('arraybuffer');
  }

  /** Färgad bild av höjd över mark (canvas). Kräver canvas. */
  function homCanvas(ndsm, W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cx = c.getContext('2d'), img = cx.createImageData(W, H);
    const klass = [[1.5, null], [4, [205, 225, 195, 150]], [8, [160, 200, 145, 185]], [15, [110, 165, 100, 210]],
      [25, [65, 125, 65, 230]], [Infinity, [35, 85, 40, 240]]];
    for (let q = 0; q < W * H; q++) {
      const v = ndsm[q];
      const f = klass.find(k => v < k[0])[1];
      if (!f) continue;
      img.data.set(f, q * 4);
    }
    cx.putImageData(img, 0, 0);
    return c;
  }
  /** Färgad bild av höjd över mark (dataURL). */
  function homBild(ndsm, W, H) { return homCanvas(ndsm, W, H).toDataURL('image/png'); }

  return { plan, skuggblad, foreslaSkala, papper, kartfalt, homBild, homCanvas, marke, nyttDokument, F, FORMAT, MARG };
}));
