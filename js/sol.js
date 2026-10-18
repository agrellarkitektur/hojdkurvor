/*
 * Soldiagram – solberäkningar och PDF (jsPDF).
 *
 * Dagjämningar och solstånd: Meeus, Astronomical Algorithms kap. 27 (± ~1 min).
 * Solens läge: NOAA:s solkalkylator (Meeus-baserad), med refraktion.
 * Kontrollerat mot NREL SPA (pvlib): avvikelse < 0,02° och ~1 s för upp/ned.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sol = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const RAD = Math.PI / 180;
  const J2000_MS = Date.UTC(2000, 0, 1, 12);
  const DAG = 86400000;
  const TZ = 'Europe/Stockholm';

  // ------------------------------------------------------------------
  // Dagjämningar och solstånd
  // ------------------------------------------------------------------
  const TERMER = [
    [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186],
    [182, 27.85, 445267.112], [156, 73.14, 45036.886], [136, 171.52, 22518.443],
    [77, 222.54, 65928.934], [74, 296.72, 3034.906], [70, 243.58, 9037.513],
    [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
    [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417],
    [18, 155.12, 67555.328], [17, 288.79, 4562.452], [16, 198.04, 62894.029],
    [14, 199.76, 31436.921], [12, 95.39, 14577.848], [12, 287.11, 31931.756],
    [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074],
  ];
  const JDE0 = {
    mars: [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057],
    juni: [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.00030],
    sept: [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078],
    dec: [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032],
  };
  const jdTillMs = jd => J2000_MS + (jd - 2451545.0) * DAG;
  const msTillJd = ms => 2451545.0 + (ms - J2000_MS) / DAG;

  /** Tidpunkt (ms, UTC) för dagjämning/solstånd. vilken: mars, juni, sept, dec. */
  function solhandelse(ar, vilken) {
    const Y = (ar - 2000) / 1000, a = JDE0[vilken];
    const jde0 = a[0] + a[1] * Y + a[2] * Y * Y + a[3] * Y ** 3 + a[4] * Y ** 4;
    const T = (jde0 - 2451545.0) / 36525;
    const W = (35999.373 * T - 2.47) * RAD;
    const dl = 1 + 0.0334 * Math.cos(W) + 0.0007 * Math.cos(2 * W);
    let S = 0;
    for (const [A, B, C] of TERMER) S += A * Math.cos((B + C * T) * RAD);
    const jde = jde0 + 0.00001 * S / dl;
    const deltaT = 69 + 0.5 * (ar - 2026);   // TT − UT, sekunder
    return jdTillMs(jde - deltaT / 86400);
  }

  // ------------------------------------------------------------------
  // Solens läge
  // ------------------------------------------------------------------
  /** {az (från norr medurs), h (höjd)} i grader. Skenbar höjd om inte geometrisk. */
  function solensLage(ms, lat, lon, geometrisk) {
    const T = (msTillJd(ms) - 2451545.0) / 36525;
    const L0 = ((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360 + 360) % 360;
    const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    const C = Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
      Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * RAD) * 0.000289;
    const omega = 125.04 - 1934.136 * T;
    const lam = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
    const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
    const dekl = Math.asin(Math.sin(eps * RAD) * Math.sin(lam * RAD));
    const y = Math.tan(eps * RAD / 2) ** 2;
    const eot = 4 / RAD * (y * Math.sin(2 * L0 * RAD) - 2 * e * Math.sin(M * RAD) +
      4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * y * y * Math.sin(4 * L0 * RAD) - 1.25 * e * e * Math.sin(2 * M * RAD));
    const d = new Date(ms);
    const minuter = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 + d.getUTCMilliseconds() / 60000;
    const tst = ((minuter + eot + 4 * lon) % 1440 + 1440) % 1440;
    const ha = (tst / 4 - 180) * RAD, phi = lat * RAD;
    const cz = Math.sin(phi) * Math.sin(dekl) + Math.cos(phi) * Math.cos(dekl) * Math.cos(ha);
    const z = Math.acos(Math.max(-1, Math.min(1, cz)));
    let az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(phi) - Math.tan(dekl) * Math.cos(phi));
    az = ((az / RAD + 180) % 360 + 360) % 360;
    const h = 90 - z / RAD;
    if (geometrisk) return { az, h };
    let r;
    if (h > 85) r = 0;
    else if (h > 5) { const t = Math.tan(h * RAD); r = 58.1 / t - 0.07 / t ** 3 + 0.000086 / t ** 5; }
    else if (h > -0.575) r = 1735 + h * (-518.2 + h * (103.4 + h * (-12.79 + h * 0.711)));
    else r = -20.774 / Math.tan(h * RAD);
    return { az, h: h + r / 3600 };
  }

  // ------------------------------------------------------------------
  // Svensk tid
  // ------------------------------------------------------------------
  let fmt = null;
  /** Skillnad mot UTC i minuter vid ett ögonblick, för svensk tid. */
  function offsetMin(ms) {
    try {
      fmt = fmt || new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23',
        year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
      const p = {};
      fmt.formatToParts(new Date(ms)).forEach(x => { p[x.type] = +x.value; });
      const lokal = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
      return Math.round((lokal - Math.floor(ms / 60000) * 60000) / 60000);
    } catch (e) {
      // EU-regeln: sommartid sista söndagen i mars 01:00 UTC – sista söndagen i oktober 01:00 UTC
      const ar = new Date(ms).getUTCFullYear();
      const sistaSondag = m => { const d = new Date(Date.UTC(ar, m + 1, 0)); return Date.UTC(ar, m, d.getUTCDate() - d.getUTCDay(), 1); };
      return ms >= sistaSondag(2) && ms < sistaSondag(9) ? 120 : 60;
    }
  }
  /** UTC-ms för en lokal svensk tid. */
  function lokalTillMs(ar, man, dag, tim = 0, min = 0) {
    const gissning = Date.UTC(ar, man - 1, dag, tim, min);
    let ms = gissning - offsetMin(gissning) * 60000;
    ms = gissning - offsetMin(ms) * 60000;
    return ms;
  }
  /** Lokal tid som {ar, man, dag, tim, min}. */
  function lokal(ms) {
    const d = new Date(ms + offsetMin(ms) * 60000);
    return { ar: d.getUTCFullYear(), man: d.getUTCMonth() + 1, dag: d.getUTCDate(),
      tim: d.getUTCHours(), min: d.getUTCMinutes() };
  }
  const hhmm = ms => { const l = lokal(ms + 30000); return String(l.tim).padStart(2, '0') + ':' + String(l.min).padStart(2, '0'); };

  // ------------------------------------------------------------------
  // En dag
  // ------------------------------------------------------------------
  function uppNed(start, lat, lon) {
    const steg = 2 * 60000, ut = { upp: null, ned: null };
    let t = start, forra = solensLage(t, lat, lon, true).h + 0.833;
    for (let i = 0; i < 720; i++) {
      const t2 = t + steg, h2 = solensLage(t2, lat, lon, true).h + 0.833;
      if ((forra < 0) !== (h2 < 0)) {
        let a = t, b = t2;
        for (let k = 0; k < 30; k++) {
          const m = (a + b) / 2;
          if ((solensLage(m, lat, lon, true).h + 0.833 < 0) === (forra < 0)) a = m; else b = m;
        }
        ut[forra < 0 ? 'upp' : 'ned'] = a;
      }
      t = t2; forra = h2;
    }
    return ut;
  }

  function dagdata(ar, man, dag, lat, lon) {
    const start = lokalTillMs(ar, man, dag), slut = lokalTillMs(ar, man, dag + 1);
    const bana = [];
    for (let t = start; t <= slut; t += 3 * 60000) bana.push({ t, ...solensLage(t, lat, lon) });
    const timmar = [];
    for (let hh = 0; hh < 24; hh++) {
      const t = lokalTillMs(ar, man, dag, hh);
      const p = solensLage(t, lat, lon);
      if (p.h > 0) timmar.push({ hh, ...p });
    }
    const top = bana.reduce((a, b) => (b.h > a.h ? b : a));
    const un = uppNed(start, lat, lon);
    return { bana, timmar, top, upp: un.upp, ned: un.ned, sommartid: offsetMin(start + 12 * 3600000) === 120 };
  }

  const HANDELSER = [
    { k: 'mars', namn: 'Vårdagjämning' },
    { k: 'juni', namn: 'Sommarsolstånd' },
    { k: 'sept', namn: 'Höstdagjämning' },
    { k: 'dec', namn: 'Vintersolstånd' },
  ];
  const KORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

  /** Alla fyra datum för ett år och en plats. */
  function arsdata(ar, lat, lon) {
    return HANDELSER.map(h => {
      const ms = solhandelse(ar, h.k), l = lokal(ms);
      return Object.assign({}, h, { ms, lokal: l, ...dagdata(l.ar, l.man, l.dag, lat, lon) });
    });
  }

  // ------------------------------------------------------------------
  // PDF
  // ------------------------------------------------------------------
  const komma = (v, d = 1) => v.toFixed(d).replace('.', ',').replace('-', '−');
  const W = 297, H = 210, CX = 91, CY = 103, R = 72;
  const PT = 0.3528;   // mm per punkt

  /**
   * opt: { lat, lon, ar, namn, kommun, zonNamn, konvergens, farg: 'svart'|'vit', fonter: {normal, bold} (base64 TTF) }
   * Returnerar ArrayBuffer.
   */
  function soldiagramPdf(opt) {
    const { jsPDF } = (typeof window !== 'undefined' ? window.jspdf : require('jspdf'));
    // opt.dok = { doc, font }: rita som en ny sida i ett befintligt dokument (platsanalysbladet)
    const doc = opt.dok ? opt.dok.doc : new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    if (opt.dok) doc.addPage('a4', 'landscape');
    else doc.setProperties({ title: `Soldiagram ${opt.ar}${opt.namn ? ' – ' + opt.namn : ''}`, creator: 'höjdkurvor.se' });
    let font = opt.dok ? opt.dok.font : 'helvetica';
    if (opt.fonter && !opt.dok) {
      doc.addFileToVFS('Familjen-Regular.ttf', opt.fonter.normal);
      doc.addFont('Familjen-Regular.ttf', 'Familjen', 'normal');
      doc.addFileToVFS('Familjen-Bold.ttf', opt.fonter.bold);
      doc.addFont('Familjen-Bold.ttf', 'Familjen', 'bold');
      font = 'Familjen';
    }
    const rgb = opt.farg === 'vit' ? [255, 255, 255] : [0, 0, 0];
    doc.setDrawColor(...rgb); doc.setTextColor(...rgb); doc.setFillColor(...rgb);
    doc.setLineCap('round'); doc.setLineJoin('round');
    const Y = y => H - y;                       // ritar med y uppåt
    const lw = pt => doc.setLineWidth(pt * PT);
    const text = (s, x, y, pt, { vikt = 'normal', ha = 'left', va = 'middle' } = {}) => {
      doc.setFont(font, vikt); doc.setFontSize(pt);
      doc.text(String(s), x, Y(y), { align: ha, baseline: va });
    };
    const linje = (pts) => {
      doc.moveTo(pts[0][0], Y(pts[0][1]));
      for (let i = 1; i < pts.length; i++) doc.lineTo(pts[i][0], Y(pts[i][1]));
      doc.stroke();
    };
    const cirkel = (x, y, r, fylld) => doc.circle(x, Y(y), r, fylld ? 'F' : 'S');
    const proj = (az, h) => {
      const r = R * (90 - h) / 90;
      return [CX + r * Math.sin(az * RAD), CY + r * Math.cos(az * RAD)];
    };
    const data = arsdata(opt.ar, opt.lat, opt.lon);
    const per = Object.fromEntries(data.map(d => [d.k, d]));

    // --- Rutnät
    lw(0.25);
    for (let h = 10; h < 90; h += 10) doc.circle(CX, Y(CY), R * (90 - h) / 90, 'S');
    for (let az = 0; az < 360; az += 30) linje([proj(az, 80), proj(az, 0)]);
    for (let az = 0; az < 360; az += 5) {
      const L = az % 30 === 0 ? 3 : (az % 10 === 0 ? 2 : 1.2), a = az * RAD;
      linje([[CX + R * Math.sin(a), CY + R * Math.cos(a)], [CX + (R + L) * Math.sin(a), CY + (R + L) * Math.cos(a)]]);
    }
    lw(1.0); doc.circle(CX, Y(CY), R, 'S');
    for (let az = 0; az < 360; az += 30) {
      const a = az * RAD;
      if (az % 90 === 0) text({ 0: 'N', 90: 'Ö', 180: 'S', 270: 'V' }[az], CX + (R + 8) * Math.sin(a), CY + (R + 8) * Math.cos(a), 13, { vikt: 'bold', ha: 'center' });
      else text(`${az}°`, CX + (R + 7) * Math.sin(a), CY + (R + 7) * Math.cos(a), 7, { ha: 'center' });
    }
    for (let h = 10; h < 90; h += 10) { const [x, y] = proj(0, h); text(`${h}°`, x + 1, y + 0.8, 5.5, { va: 'bottom' }); }
    lw(0.6); linje([[CX - 2, CY], [CX + 2, CY]]); linje([[CX, CY - 2], [CX, CY + 2]]);

    // --- Horisont: skrafferat band mellan horisonten (0°) och horisontprofilen
    // Med horisontMark ritas terrängen tätt skrafferad och träd och byggnader glesare ovanpå.
    // Träd och byggnader kan bara höja horisonten, så banden ligger i lager och korsar aldrig varandra.
    const hor = opt.horisont || null;
    const horMark = hor && opt.horisontMark ? opt.horisontMark : null;
    const begr = v => Math.max(0, Math.min(89, v));
    const kontur = (h, bredd) => {
      lw(bredd);
      const pts = [];
      for (let a = 0; a <= 720; a++) pts.push(proj((a % 720) * 0.5, begr(h[a % 720])));
      linje(pts);
    };
    if (hor) {
      const bas = horMark || hor;
      lw(0.22);
      for (let a = 0; a < 720; a += 2) {
        const h = begr(bas[a]);
        if (h > 0.08) linje([proj(a * 0.5, 0), proj(a * 0.5, h)]);
      }
      if (horMark) {
        lw(0.18);
        for (let a = 0; a < 720; a += 6) {
          const h0 = begr(horMark[a]), h1 = begr(Math.max(hor[a], horMark[a]));
          if (h1 - h0 > 0.08) linje([proj(a * 0.5, h0), proj(a * 0.5, h1)]);
        }
        kontur(hor, 0.5);
      }
      kontur(bas, 0.9);
    }

    // --- Banor (dagjämningarna sammanfaller – ritas en gång)
    lw(1.3);
    for (const k of ['juni', 'mars', 'dec']) {
      const pts = per[k].bana.filter(p => p.h >= -0.3).map(p => proj(p.az, p.h));
      if (pts.length > 1) linje(pts);
    }
    // --- Timpunkter: fylld = normaltid, ofylld = sommartid. 23 sep: klockslag utanför banan.
    for (const d of data) {
      const utanfor = d.k === 'sept';
      for (const t of d.timmar) {
        const [x, y] = proj(t.az, t.h);
        if (d.sommartid) { lw(0.7); cirkel(x, y, 1.05, false); } else cirkel(x, y, 1.05, true);
        let dx = CX - x, dy = CY - y; const n = Math.hypot(dx, dy) || 1;
        const off = utanfor ? -3.6 : 3.6;
        text(String(t.hh).padStart(2, '0'), x + dx / n * off, y + dy / n * off, 6.5,
          { vikt: utanfor ? 'normal' : 'bold', ha: 'center' });
      }
      // soluppgång och solnedgång: kort radiellt streck innanför horisonten
      lw(1.3);
      for (const ms of [d.upp, d.ned]) {
        if (ms == null) continue;
        const az = solensLage(ms, opt.lat, opt.lon).az * RAD;
        linje([[CX + (R - 3.2) * Math.sin(az), CY + (R - 3.2) * Math.cos(az)], [CX + R * Math.sin(az), CY + R * Math.cos(az)]]);
      }
    }
    // datum vid banorna där de korsar sydaxeln
    for (const k of ['juni', 'mars', 'dec']) {
      const lbl = k === 'mars' ? `${per.mars.lokal.dag} mar|${per.sept.lokal.dag} sep`
        : `${per[k].lokal.dag} ${KORT[per[k].lokal.man - 1]}`;
      const [x, y] = proj(180, per[k].top.h);
      lbl.split('|').forEach((s, i) => text(s, x + 1.4, y - 1.6 - i * 2.4, 6, { va: 'top' }));
    }

    // --- Högerspalt
    const X0 = 176, X1 = 291;
    let y = 196;
    text(`Soldiagram ${opt.ar}`, X0, y, 20, { vikt: 'bold', va: 'top' });
    y -= 10;
    const plats = [opt.namn, opt.kommun].filter(Boolean).join(', ');
    if (plats) text(plats, X0, y, 8.5, { vikt: 'bold', va: 'top' });
    text(`${komma(opt.lat, 4)}° N   ${komma(opt.lon, 4)}° Ö`, plats ? X0 + 60 : X0, y, 8.5, { va: 'top' });

    y -= 10;
    const gx0 = X0 + 7, gw = (X1 - gx0) / 4, fs = 6.2;
    data.forEach((d, i) => {
      const g = gx0 + i * gw;
      lw(0.6);
      if (d.sommartid) doc.circle(g + 1.6, Y(y - 1.4), 0.9, 'S'); else cirkel(g + 1.6, y - 1.4, 0.9, true);
      text(d.namn, g + 3.6, y, 6.6, { vikt: 'bold', va: 'top' });
      text(`${d.lokal.dag} ${KORT[d.lokal.man - 1]} kl ${hhmm(d.ms)}`, g + 0.6, y - 3.4, fs, { va: 'top' });
      text(d.sommartid ? 'sommartid' : 'normaltid', g + 0.6, y - 6.4, fs, { va: 'top' });
    });
    y -= 11.5;
    const kol = [['Azimut', 8.4], ['Höjd', 16.6], ['Skugga', 25.6]];
    text('Kl', X0, y, fs, { vikt: 'bold', va: 'top' });
    data.forEach((d, i) => kol.forEach(([t, dx]) => text(t, gx0 + i * gw + dx, y, fs, { vikt: 'bold', ha: 'right', va: 'top' })));
    y -= 3.0;
    lw(0.25); linje([[X0, y], [X1, y]]);
    const yTop = y;
    y -= 1.2;
    const alla = [...new Set(data.flatMap(d => d.timmar.map(t => t.hh)))].sort((a, b) => a - b);
    const rad = alla.length > 19 || hor ? 3.0 : 3.25;
    for (const hh of alla) {
      text(String(hh).padStart(2, '0'), X0, y, fs, { va: 'top' });
      data.forEach((d, i) => {
        const g = gx0 + i * gw, t = d.timmar.find(x => x.hh === hh);
        if (!t) { text('–', g + kol[1][1], y, fs, { ha: 'right', va: 'top' }); return; }
        const sk = 1 / Math.tan(t.h * RAD);
        [`${Math.round(t.az)}°`, `${komma(t.h)}°`, sk > 50 ? '>50' : komma(sk)].forEach((v, j) =>
          text(v, g + kol[j][1], y, fs, { ha: 'right', va: 'top' }));
      });
      y -= rad;
    }
    y += rad - 3.2;
    linje([[X0, y], [X1, y]]);
    for (let i = 1; i < 4; i++) { const g = gx0 + i * gw - 0.8; linje([[g, yTop + 14], [g, y - 17.5]]); }
    y -= 1.6;
    const timmar = m => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
    const dl = d => { const m = Math.round((d.ned - d.upp) / 60000); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };
    for (const [namn, f] of [
      ['Uppgång', d => hhmm(d.upp)], ['Nedgång', d => hhmm(d.ned)], ['Dagslängd', dl],
      ['Högst', d => `${komma(d.top.h)}° kl ${hhmm(d.top.t)}`],
      ...(hor ? [
        ['Sol (horisont)', d => { const v = direktSol(d, hor); return v.forst == null ? 'ingen' : `${hhmm(v.forst)}–${hhmm(v.sist)}`; }],
        ['Soltimmar', d => timmar(direktSol(d, hor).minuter)],
        ...(horMark ? [['Utan träd/hus', d => timmar(direktSol(d, horMark).minuter)]] : []),
      ] : []),
    ]) {
      text(namn, X0, y, fs, { va: 'top' });
      data.forEach((d, i) => text(d.upp != null && d.ned != null ? f(d) : '–', gx0 + i * gw + kol[2][1], y, fs, { ha: 'right', va: 'top' }));
      y -= rad;
    }

    // --- Teckenförklaring
    let y2 = hor ? (horMark ? 70 : 62) : 42;
    const prov = (rita, s) => { rita(y2); text(s, X0 + 10, y2, 6.3); y2 -= 4.2; };
    const streck = (yy, steg, bredd, kant) => {
      lw(bredd); for (let k = 0; k <= 7.01; k += steg) linje([[X0 + k, yy - 1.4], [X0 + k, yy + 1.4]]);
      lw(kant); linje([[X0, yy + 1.4], [X0 + 7, yy + 1.4]]);
    };
    prov(yy => { lw(1.3); linje([[X0, yy], [X0 + 7, yy]]); cirkel(X0 + 3.5, yy, 1.05, true); },
      'Hel timme i normaltid (UTC+1): vårdagjämning och vintersolstånd.');
    prov(yy => { lw(1.3); linje([[X0, yy], [X0 + 7, yy]]); lw(0.7); cirkel(X0 + 3.5, yy, 1.05, false); },
      'Hel timme i sommartid (UTC+2): sommarsolstånd och höstdagjämning.');
    prov(yy => { lw(1.3); linje([[X0 + 3.5, yy - 1.6], [X0 + 3.5, yy + 1.6]]); },
      'Soluppgång och solnedgång vid horisonten.');
    if (horMark) {
      prov(yy => streck(yy, 0.6, 0.22, 0.9), 'Horisont av terrängen.');
      prov(yy => streck(yy, 1.75, 0.18, 0.5), 'Horisont av träd och byggnader, ovanpå terrängen.');
    } else if (hor) {
      prov(yy => streck(yy, 0.6, 0.22, 0.9), opt.horisontText || 'Horisont: terräng, träd och byggnader som skymmer solen.');
    }
    if (hor) {
      // hur horisonten läses
      doc.setFont(font, 'normal'); doc.setFontSize(6.3);
      const bredd = W - 12 - (X0 + 10);
      const las = [
        `Strecken visar den del av himlen som skyms, sedd ${opt.horisontPunkt || 'från platsen'}. Ju längre in strecken når, desto högre är horisonten åt det hållet.`,
        'Där solbanan går genom strecken är solen skymd. Där banan går i den vita ytan når solen punkten.',
      ];
      y2 -= 0.6;
      for (const st of las) for (const rad of doc.splitTextToSize(st, bredd)) { text(rad, X0 + 10, y2, 6.3); y2 -= 3; }
      y2 -= 1.2;
    }
    text('Klockslaget står innanför banan, för höstdagjämningen utanför.', X0 + 10, y2, 6.3);
    y = y2 + 12.6;

    const noter = [
      `Sommartid (UTC+2) gäller ${datumText(opt.ar)}, annars normaltid (UTC+1).`,
      'Skugga: skugglängd på plan mark per meter höjd. Skuggan pekar rakt bort från solen,',
      'längs linjen från solpunkten genom diagrammets mitt.',
      'Ekvidistant projektion: avståndet från mitten är 90° minus solhöjden.',
      opt.zonNamn != null && opt.konvergens != null
        ? `Azimut medurs från geografisk nord. Rutnätets nord i ${opt.zonNamn} pekar ${komma(Math.abs(opt.konvergens), 2)}° ${opt.konvergens >= 0 ? 'öster' : 'väster'} om geografisk nord här.`
        : 'Azimut medurs från geografisk nord.',
      'Beräknat med NOAA:s solalgoritm och Meeus, kontrollerat mot NREL SPA. Solhöjd med refraktion.',
      hor ? (opt.horisontNot || 'Horisonten är beräknad ur höjddata och laserdata. Sol (horisont) och soltimmar räknar med horisonten.')
        : 'Visar solens läge, inte skuggning från terräng, vegetation eller byggnader. Underlag för tidiga skeden.',
      ...(hor ? ['Träd räknas som täta. Underlag för tidiga skeden.'] : []),
    ];
    let yy = y - (hor ? 17 : 20);
    doc.setFont(font, 'normal'); doc.setFontSize(5.5);
    for (const n of noter) for (const rad of doc.splitTextToSize(n, W - 10 - X0)) { text(rad, X0, yy, 5.5, { va: 'top' }); yy -= 2.6; }

    if (opt.dok) { doc.setDrawColor(0, 0, 0); doc.setTextColor(0, 0, 0); doc.setFillColor(0, 0, 0); return doc; }
    return doc.output('arraybuffer');
  }

  /** Första och sista tid med sol över horisontprofilen, och antal minuter med direkt sol. */
  function direktSol(d, hor) {
    d._direkt = d._direkt || new Map();
    if (d._direkt.has(hor)) return d._direkt.get(hor);
    let forst = null, sist = null, minuter = 0;
    for (let i = 0; i < d.bana.length - 1; i++) {
      const p = d.bana[i];
      const f = ((p.az % 360) + 360) % 360 / 0.5, k = Math.floor(f) % 720, t = f - Math.floor(f);
      const hh = hor[k] * (1 - t) + hor[(k + 1) % 720] * t;
      if (p.h > Math.max(hh, -0.833)) { if (forst == null) forst = p.t; sist = p.t; minuter += 3; }
    }
    const v = { forst, sist, minuter };
    d._direkt.set(hor, v);
    return v;
  }

  /** "29 mar–25 okt 2026" – sommartidens gränser ett år. */
  function datumText(ar) {
    let start = null, slut = null, forra = offsetMin(Date.UTC(ar, 0, 1, 12));
    for (let d = 1; d <= 366; d++) {
      const ms = Date.UTC(ar, 0, d, 12), o = offsetMin(ms);
      if (o !== forra) { const l = new Date(ms); if (o > forra) start = l; else slut = l; forra = o; }
    }
    if (!start || !slut) return 'inte alls';
    const f = d => `${d.getUTCDate()} ${KORT[d.getUTCMonth()]}`;
    return `${f(start)}–${f(slut)} ${ar}`;
  }

  return { solhandelse, solensLage, offsetMin, lokalTillMs, lokal, dagdata, arsdata, soldiagramPdf, HANDELSER };
}));
