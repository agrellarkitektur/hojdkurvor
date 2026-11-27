// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Planvyn (0.14.0): rita och ändra byggnadskroppar i plan, numeriskt och mot fastighetsgränserna.
 * En egen 2D-vy (SVG) i ett fönster över kartan. Samma kroppar som 3D-vyn modellerar; ändringarna
 * går tillbaka till appen med opt.andrad(volymer) efter varje steg.
 *
 *   Planvy.oppna(rot, {
 *     volymer,            kropparna (kopieras)
 *     granser,            fastighetsgränserna som polylinjer [{ pts }] (zonens koordinater)
 *     hus,                Lantmäteriets byggnader [{ id, fotavtryck, mark, hojd, huvudbyggnad, namn }]
 *     utsnitt,            { xmin, ymin, xmax, ymax }
 *     zonNamn,            t.ex. "SWEREF 99 15 00"
 *     markhojd(x, y),     markens höjd (RH 2000) eller NaN
 *     nyttId(),           id för en ny kropp
 *     andrad(volymer),    anropas efter varje ändring
 *     till3d,             (valfri) öppnar 3D-vyn
 *     stangd(),           anropas när fönstret stängs
 *     saknas,             (valfri) text om underlag som saknas (gränser, byggnader)
 *     situationsplan(typ, { volymer, visa, ram }) (valfri, 0.16.0) skapar PDF ('pdf') eller DXF ('dxf')
 *     ram,                (valfri) { format, liggande, skala } för situationsplanen; ramAndrad(ram) när den ändras
 *     uppgifter(), satUppgifter(delar)  (valfria) ritningshuvudets fält: fastighet, uppdrag, ritadAv, ritningsnummer
 *     underlag,           (valfri, 0.16.1) { ortofoto: { url, x0, y1, s, W, H }, kurvor, trad, vagar, skydd } att rita under
 *     visa, visaAndrad(visa)  (valfria, 0.16.1) vad som visas, och när det ändras
 *     ledare, ledareAndrad(ledare)  (valfria, 0.16.1) ledare med fritext [{ id, pts: [pil, text], text }]
 *     tradAndrat({ typ: 'ny'|'dolj'|'visa'|'bort', t, x, y }) (valfri, 0.16.1) ger den nya trädlistan
 *     fastighetVid(x, y)  (valfri, 0.16.1) Promise med fastigheterna i punkten [{ beteckning }]
 *     ytor               (valfri, 0.16.3) fastigheterna med ringar, för BYA med Lantmäteriets hus på fastigheten
 *   }) → { stang(), volymer() }
 *
 * Kräver Kropp, Volym3D och Situationsplan. Kroppar med samma status som går in i varandra ritas som ett
 * yttre skal (0.16.0); först när en av dem markeras syns de var för sig.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Planvy = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const K = () => (typeof Kropp !== 'undefined' ? Kropp : globalThis.Kropp);
  const V3 = () => (typeof Volym3D !== 'undefined' ? Volym3D : globalThis.Volym3D);
  const SP = () => (typeof Situationsplan !== 'undefined' ? Situationsplan : globalThis.Situationsplan);
  const RAD = Math.PI / 180;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]], mul = (a, s) => [a[0] * s, a[1] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1], len = a => Math.hypot(a[0], a[1]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
  const perp = a => [-a[1], a[0]];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (v, d = 2) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d).replace('.', ',');
  /** Mått med en decimal om det räcker (på millimetern när), annars två. */
  const matt = v => (Math.abs(Math.round(v * 10) / 10 - v) < 0.0005 ? fmt(v, 1) : fmt(v, 2));
  const tyngd = p => mul(p.reduce((s, q) => add(s, q), [0, 0]), 1 / p.length);
  function inuti(poly, x, y) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function fotpunkt(c, a, b) { const e = sub(b, a), l2 = dot(e, e), t = l2 ? dot(sub(c, a), e) / l2 : 0; return { t, f: add(a, mul(e, t)) }; }
  const kopia = o => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' && !isFinite(v) ? null : v)));

  const VERKTYG = [
    ['valj', 'Välj', 'V', 'Välj, flytta och ändra'],
    ['rekt', 'Rektangel', 'R', 'Rita en rektangel'],
    ['poly', 'Polygon', 'P', 'Rita ett fritt fotavtryck'],
    ['riktn', 'Riktning', 'D', 'Ritriktning efter en gräns eller fasad'],
    ['entre', 'Entré', 'E', 'Lägg entrépilen på en fasad'],
    ['lm', 'Befintlig', 'L', 'Ta in en byggnad från Lantmäteriet'],
    ['vridmot', 'Vrid mot', 'A', 'Vrid en byggnad så att en sida blir parallell med en annan linje'],
    ['ledare', 'Ledare', 'T', 'Ledare med fritext'],
    ['trad', 'Träd', 'G', 'Lägg till, dölj eller ta bort träd'],
    ['fast', 'Fastighet', 'F', 'Hämta fastighetsbeteckningen ur kartan'],
  ];
  const PROMPT = {
    valj: 'Klicka på en byggnad. Dra för att flytta (ett hörn snäpper). Klicka på ett mått för att ändra det.',
    rekt: s => (s.ritar.length ? 'Klicka motstående hörn eller skriv bredd x djup (12,6x9).' : 'Rektangel: klicka första hörnet eller skriv E;N.'),
    poly: s => (s.ritar.length ? 'Klicka nästa hörn eller skriv längd, längd<vinkel eller @dx;dy. Enter stänger.' : 'Polygon: klicka första hörnet eller skriv E;N.'),
    riktn: 'Klicka på en tomtgräns, en fasad eller ett hus. Ortho och vinklar följer den.',
    entre: 'Klicka på fasaden där entrén ska vara.',
    lm: 'Klicka på ett grått hus från Lantmäteriet för att ta in det som befintlig byggnad.',
    vridmot: s => (s.vm ? 'Klicka på linjen som sidan ska bli parallell med (gräns, fasad eller hus).' : 'Vrid mot linje: klicka på den sida i byggnaden som ska vridas.'),
    ledare: s => (s.ritar.length ? 'Klicka där texten ska stå.' : 'Ledare: klicka där pilen ska peka.'),
    trad: 'Klicka för att lägga till ett träd. Klicka på ett träd för att dölja det (eller ta bort ett eget), igen för att visa det.',
    fast: 'Klicka på fastigheten för att hämta beteckningen till ritningshuvudet.',
  };

  function oppna(rot, opt) {
    const Kr = K(), V = V3();
    const S = {
      volymer: (opt.volymer || []).map(v => Kr.normalisera(kopia(v))),
      vald: null, verktyg: 'valj', riktning: 0, ortho: true, snapp: true,
      vy: { cx: 0, cy: 0, z: 4 }, ritar: [], markor: [0, 0], traff: null, hovKant: null, hovHus: null,
      visa: Object.assign({ matt: true, ytter: true, relativa: true, grans: true, koord: false, koordlista: false, entre: true, ram: false,
        orto: true, kurvor: true, trad: true, vagar: false, skydd: false }, opt.visa || {}),
      ledare: kopia(opt.ledare || []).filter(l => l && Array.isArray(l.pts) && l.pts.length >= 2),
      trad: (opt.underlag && opt.underlag.trad) || [], vm: null,
      ram: Object.assign({ format: 'a3', liggande: true, skala: 400 }, opt.ram || {}),
      ramCentrum: Array.isArray(opt.ramCentrum) && opt.ramCentrum.length === 2 && opt.ramCentrum.every(isFinite) ? opt.ramCentrum.slice() : null, ramRutor: [],
      angra: [], gorom: [],
    };
    S.volymer.forEach(v => { if (v.golv == null) v.golv = NaN; });
    const granser = (opt.granser || []).map(g => (g.pts || g)).filter(p => p && p.length >= 2);
    const allaHus = (opt.hus || []).filter(b => b.fotavtryck && b.fotavtryck.length >= 3);

    rot.innerHTML = `
      <div class="planvy-huvud">
        <h2 id="planvy-rubrik">Rita i plan</h2>
        <div class="planvy-verktyg" role="toolbar" aria-label="Verktyg">${VERKTYG.map(([id, namn, kort, tips]) =>
          `<button type="button" class="knapp liten" data-verktyg="${id}" aria-pressed="false" title="${esc(tips)} (${kort})">${esc(namn)}</button>`).join('')}</div>
        <div class="planvy-verktyg"><button type="button" class="knapp liten" data-pv="matt" aria-pressed="true" title="Visa eller dölj alla mått, också på ritningen">Mått</button><button type="button" class="knapp liten" data-pv="ortho" aria-pressed="true" title="Bara längs ritriktningen (F8)">Ortho</button><button type="button" class="knapp liten" data-pv="snapp" aria-pressed="true" title="Snäpp mot hörn, mittpunkter och linjer (F3)">Snäpp</button><button type="button" class="knapp liten" data-pv="angra" title="Ctrl+Z" disabled>Ångra</button><button type="button" class="knapp liten" data-pv="gorom" title="Ctrl+Y" disabled>Gör om</button><button type="button" class="knapp liten" data-pv="passa" title="Växlar mellan hela utsnittet och byggnaderna">Passa</button>${opt.till3d ? '<button type="button" class="knapp liten" data-pv="3d">3D</button>' : ''}<button type="button" class="knapp liten" data-pv="stang">Stäng</button></div>
      </div>
      <div class="planvy-kropp">
        <div class="planvy-yta"><svg class="planvy-svg" aria-label="Planvy"><g class="pv-under"></g><g class="pv-dyn"></g></svg><input class="planvy-textin" hidden autocomplete="off" aria-label="Ledarens text" placeholder="Text, Enter"><input class="planvy-mattin" hidden autocomplete="off" inputmode="decimal" aria-label="Nytt mått"><button type="button" class="planvy-mattdolj knapp liten" hidden title="Dölj måttet på planen">Dölj</button><div class="planvy-besked" aria-live="polite"></div></div>
        <aside class="planvy-panel" aria-label="Byggnadskroppar"></aside>
      </div>
      <div class="planvy-fot">
        <span class="planvy-prompt"></span>
        <input class="planvy-kommando" autocomplete="off" spellcheck="false" aria-label="Inmatning" placeholder="12,6x9 · 6 · 6<90 · @3;4 · E;N">
        <span class="planvy-status"></span>
      </div>`;
    const $ = s => rot.querySelector(s);
    const svg = $('.planvy-svg'), under = $('.pv-under'), dyn = $('.pv-dyn'), textin = $('.planvy-textin'), yta = $('.planvy-yta'), panel = $('.planvy-panel'), kommando = $('.planvy-kommando'), mattin = $('.planvy-mattin'), mattdolj = $('.planvy-mattdolj');
    let W = 800, H = 600;

    // ------------------------------------------------------------------
    // Vyn
    // ------------------------------------------------------------------
    const w2s = p => [W / 2 + (p[0] - S.vy.cx) * S.vy.z, H / 2 - (p[1] - S.vy.cy) * S.vy.z];
    const s2w = (x, y) => [S.vy.cx + (x - W / 2) / S.vy.z, S.vy.cy - (y - H / 2) / S.vy.z];
    const px = v => v / S.vy.z;   // skärmpixlar → meter
    // en millimeter på ritningen i meter (0.16.4, DI): texter och mått ritas i modellens mått, som de plottas
    const MM = () => (S.ram && S.ram.skala ? S.ram.skala : 400) / 1000;
    const pxmm = h => h * MM() * S.vy.z;
    const P = p => { const s = w2s(p); return s[0].toFixed(1) + ',' + s[1].toFixed(1); };
    const poly = (p, cls, extra = '') => `<polygon class="${cls}" points="${p.map(P).join(' ')}" ${extra}/>`;
    const linje = (a, b, cls, extra = '') => { const s = w2s(a), t = w2s(b); return `<line class="${cls}" x1="${s[0].toFixed(1)}" y1="${s[1].toFixed(1)}" x2="${t[0].toFixed(1)}" y2="${t[1].toFixed(1)}" ${extra}/>`; };
    function text(p, str, storlek, cls, vinkelRad = 0, ankare = 'middle', extra = '') {
      const s = w2s(p);
      let a = -vinkelRad / RAD;
      while (a > 90) a -= 180;
      while (a <= -90) a += 180;
      return `<text class="${cls}" x="${s[0].toFixed(1)}" y="${s[1].toFixed(1)}" font-size="${storlek}" text-anchor="${ankare}" dominant-baseline="middle" transform="rotate(${a.toFixed(2)} ${s[0].toFixed(1)} ${s[1].toFixed(1)})" ${extra}>${esc(str)}</text>`;
    }
    /** Hela utsnittet, eller (narmare) kropparna med 15 m runt om. */
    function passa(narmare) {
      W = yta.clientWidth || 800; H = yta.clientHeight || 600;
      const pts = [];
      const r = opt.utsnitt;
      if (narmare && S.volymer.length) S.volymer.forEach(v => v.fotavtryck.forEach(q => pts.push([q[0] - 15, q[1] - 15], [q[0] + 15, q[1] + 15])));
      else if (r) pts.push([r.xmin, r.ymin], [r.xmax, r.ymax]);
      if (!pts.length) S.volymer.forEach(v => pts.push(...v.fotavtryck));
      if (!pts.length) return;
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const w = Math.max(...xs) - Math.min(...xs) + 10, h = Math.max(...ys) - Math.min(...ys) + 10;
      S.vy.cx = (Math.max(...xs) + Math.min(...xs)) / 2; S.vy.cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      S.vy.z = Math.max(0.2, Math.min(W / w, H / h));
    }
    const axlar = () => { const a = S.riktning * RAD; return [[Math.cos(a), Math.sin(a)], [-Math.sin(a), Math.cos(a)]]; };
    /** Situationsplanens ram (0.16.0): kartfältet för formatet och skalan, kring byggnaderna. */
    // ramen kan flyttas (0.16.4, DF): S.ramCentrum, annars kring byggnaderna
    const ramMitt = () => S.ramCentrum || SP().mitt(S.volymer, opt.utsnitt);
    const ramHorn = () => { const z = SP().ram(Object.assign({ centrum: ramMitt() }, S.ram)).zon; return [[z.xmin, z.ymin], [z.xmax, z.ymin], [z.xmax, z.ymax], [z.xmin, z.ymax]]; };

    // ------------------------------------------------------------------
    // Ångra och ändringar
    // ------------------------------------------------------------------
    // ångra omfattar kropparna och ledarna (0.16.1)
    const ogonblick = () => JSON.stringify({ v: kopia(S.volymer), l: S.ledare });
    let senasteLedare = JSON.stringify(S.ledare);
    const aterstall = s => {
      const o = JSON.parse(s);
      S.volymer = o.v.map(v => { if (v.golv == null) v.golv = NaN; return v; });
      S.ledare = o.l || [];
      if (!S.volymer.some(v => v.id === S.vald)) S.vald = null;
    };
    function meddela() {
      $('[data-pv=angra]').disabled = !S.angra.length;
      $('[data-pv=gorom]').disabled = !S.gorom.length;
      if (opt.andrad) opt.andrad(S.volymer.map(kopia).map(v => { if (v.golv == null) v.golv = NaN; return v; }));
      const l = JSON.stringify(S.ledare);
      if (l !== senasteLedare) { senasteLedare = l; if (opt.ledareAndrad) opt.ledareAndrad(kopia(S.ledare)); }
    }
    const sparaVisa = () => { if (opt.visaAndrad) opt.visaAndrad(Object.assign({}, S.visa)); };
    function andra(fn) {
      S.angra.push(ogonblick()); if (S.angra.length > 100) S.angra.shift(); S.gorom = [];
      fn();
      meddela(); allt();
    }
    function angra() { if (!S.angra.length) return; S.gorom.push(ogonblick()); aterstall(S.angra.pop()); meddela(); allt(); }
    function gorOm() { if (!S.gorom.length) return; S.angra.push(ogonblick()); aterstall(S.gorom.pop()); meddela(); allt(); }
    const vald = () => S.volymer.find(v => v.id === S.vald) || null;

    // ------------------------------------------------------------------
    // Snäpp
    // ------------------------------------------------------------------
    const ersatta = () => Kr.ersatta(S.volymer);
    const synligaHus = () => { const e = ersatta(); return allaHus.filter(b => !e.has(String(b.id))); };
    /** Alla linjer att snäppa mot: { a, b, typ, k (kroppens id), i (sidans index), hus }. */
    function kanter(utom) {
      const ut = [];
      const [x0, y1] = s2w(-50, -50), [x1, y0] = s2w(W + 50, H + 50);
      const iVyn = (a, b) => !(Math.max(a[0], b[0]) < x0 || Math.min(a[0], b[0]) > x1 || Math.max(a[1], b[1]) < y0 || Math.min(a[1], b[1]) > y1);
      granser.forEach((g, gi) => { for (let i = 0; i + 1 < g.length; i++) if (iVyn(g[i], g[i + 1])) ut.push({ a: g[i], b: g[i + 1], typ: 'gräns', gi, si: i }); });
      S.volymer.forEach(v => { if (utom && utom.has(v.id)) return; const f = v.fotavtryck; f.forEach((a, i) => ut.push({ a, b: f[(i + 1) % f.length], typ: 'kropp', k: v.id, i })); });
      synligaHus().forEach(h => { const f = h.fotavtryck; for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; if (iVyn(a, b)) ut.push({ a, b, typ: 'hus', hus: h }); } });
      return ut;
    }
    function hittaSnapp(sx, sy, bas, utom) {
      if (!S.snapp) return null;
      const E = kanter(utom), tolP = 11, tolL = 8;
      let bast = null;
      const pröva = (p, typ, tol) => { const s = w2s(p), d = Math.hypot(s[0] - sx, s[1] - sy); if (d < tol && (!bast || d < bast.d - 0.01)) bast = { p, typ, d }; };
      E.forEach(e => { pröva(e.a, 'hörn', tolP); pröva(e.b, 'hörn', tolP); });
      S.ritar.forEach(p => pröva(p, 'hörn', tolP));
      if (bast) return bast;
      E.forEach(e => pröva(mul(add(e.a, e.b), 0.5), 'mitt', tolP));
      if (bast) return bast;
      if (bas) E.forEach(e => { const f = fotpunkt(bas, e.a, e.b); if (f.t > 0 && f.t < 1) pröva(f.f, 'vinkelrätt', tolP); });
      if (bast) return bast;
      const w = s2w(sx, sy);
      E.forEach(e => { const f = fotpunkt(w, e.a, e.b); if (f.t >= 0 && f.t <= 1) pröva(f.f, 'närmast', tolL); });
      return bast;
    }
    function orthoPunkt(bas, p) {
      const [ax, ay] = axlar(), d = sub(p, bas), lx = dot(d, ax), ly = dot(d, ay);
      return Math.abs(lx) >= Math.abs(ly) ? add(bas, mul(ax, lx)) : add(bas, mul(ay, ly));
    }
    function plocka(sx, sy, bas, utom) {
      const sn = hittaSnapp(sx, sy, bas, utom);
      S.traff = sn;
      if (sn) return sn.p;
      let w = s2w(sx, sy);
      if (bas && S.ortho) w = orthoPunkt(bas, w);
      return w;
    }
    function narmasteKant(sx, sy, filter, tol = 12) {
      let bast = null;
      const w = s2w(sx, sy);
      kanter().filter(filter).forEach(e => {
        const f = fotpunkt(w, e.a, e.b);
        if (f.t < 0 || f.t > 1) return;
        const s = w2s(f.f), d = Math.hypot(s[0] - sx, s[1] - sy);
        if (d < tol && (!bast || d < bast.d)) bast = Object.assign({ d, t: f.t }, e);
      });
      return bast;
    }

    // ------------------------------------------------------------------
    // Måtten
    // ------------------------------------------------------------------
    let senasteMatt = [], mattDrag = null, ledarDrag = null;
    const ordning = { rivs: 0, befintlig: 1, tillbyggnad: 2, ny: 3 };
    /** Måttlinje längs a–b, förskjuten off meter åt n, i ritningens mått (0.16.4). */
    function mattlinje(a, b, n, off, str, data, extra = '') {
      const mm = MM(), u = norm(sub(b, a)), a2 = add(a, mul(n, off)), b2 = add(b, mul(n, off));
      let o = linje(add(a, mul(n, 0.8 * mm)), add(a, mul(n, off + 1.2 * mm)), 'pv-matt') + linje(add(b, mul(n, 0.8 * mm)), add(b, mul(n, off + 1.2 * mm)), 'pv-matt') + linje(a2, b2, 'pv-matt');
      const tk = mul(norm(add(u, n)), 0.9 * mm);
      o += linje(sub(a2, tk), add(a2, tk), 'pv-matt pv-tick') + linje(sub(b2, tk), add(b2, tk), 'pv-matt pv-tick');
      o += text(add(mul(add(a2, b2), 0.5), mul(n, 1.4 * mm)), str, pxmm(2.2), 'pv-mattext' + extra, Math.atan2(u[1], u[0]), 'middle', data);
      return o;
    }
    /**
     * Måtten (0.16.0): räknas av Situationsplan.matt på byggnadernas yttre skal, eller på kropparna i den
     * markerade byggnaden. Dolda mått ritas inte; flyttade har sin förskjutning i meter. Sedan 0.16.4 i
     * ritningens mått, med vinkelrätsymbol mot gränsen, och ett gränsmått kan dras till en annan gräns.
     */
    function ritaMatt(enh) {
      let o = '';
      if (S.visa.matt === false) { senasteMatt = []; return o; }
      const mm = MM();
      senasteMatt = SP().matt(S.volymer, granser, { enheter: enh, visa: S.visa });
      senasteMatt.forEach((m, i) => {
        if (m.dold) return;
        const drar = mattDrag && mattDrag.i === i ? ' pv-drar' : '';
        if (m.typ === 'grans') {
          const f = mattDrag && mattDrag.i === i && mattDrag.forslag ? mattDrag.forslag : null;
          const till = f ? f.till : m.till, dl = len(sub(till, m.fran));
          const d = norm(sub(till, m.fran)), n = perp(d), tk = mul(norm(add(d, n)), 0.9 * mm);
          const q = Math.min(1.6 * mm, dl / 3), vb = mul(n, -q), va = mul(d, -q);
          o += linje(m.fran, till, 'pv-gmatt' + (f ? ' pv-forslag' : '')) + linje(sub(m.fran, tk), add(m.fran, tk), 'pv-gmatt pv-tick');
          o += `<polyline class="pv-gmatt" fill="none" points="${[add(till, va), add(add(till, va), vb), add(till, vb)].map(P).join(' ')}"/>`;
          o += text(add(mul(add(m.fran, till), 0.5), mul(n, 1.4 * mm)), f ? matt(dl) : m.text, pxmm(2.2), 'pv-gmattext' + drar, Math.atan2(d[1], d[0]), 'middle', `data-matt="${i}"`);
        } else {
          const off = mattDrag && mattDrag.i === i ? mattDrag.off : m.off;
          o += mattlinje(m.fran, m.till, m.n, off != null ? off : (m.bas || 0) + 4 * mm, m.text, `data-matt="${i}"`, drar);
        }
      });
      return o;
    }

    // ------------------------------------------------------------------
    // Underlaget (0.16.1): ortofoto, höjdkurvor, vägar, skydd och träd, som i kartan. Ritas en gång i
    // zonens koordinater (relativt utsnittets hörn, så att talen blir små) och flyttas med en transform.
    // ------------------------------------------------------------------
    const U = opt.underlag || {};
    const O = opt.utsnitt ? [opt.utsnitt.xmin, opt.utsnitt.ymin] : [0, 0];
    const L0 = p => (p[0] - O[0]).toFixed(2) + ',' + (p[1] - O[1]).toFixed(2);
    const vag = (pts, sluten) => 'M' + pts.map(L0).join('L') + (sluten ? 'Z' : '');
    const NS = 'vector-effect="non-scaling-stroke"';
    function byggUnderlag() {
      let o = '';
      const v = S.visa;
      if (v.orto && U.ortofoto && U.ortofoto.url) {
        const b = U.ortofoto;
        o += `<g transform="translate(${(b.x0 - b.s / 2 - O[0]).toFixed(3)} ${(b.y1 + b.s / 2 - O[1]).toFixed(3)}) scale(${b.s} ${-b.s})"><image class="pv-u-orto" href="${b.url}" width="${b.W}" height="${b.H}" preserveAspectRatio="none"/></g>`;
      }
      if (v.kurvor && U.kurvor) {
        const grupper = {};
        for (const k of U.kurvor) if (k.pts && k.pts.length >= 2) (grupper[k.lager] = grupper[k.lager] || []).push(vag(k.pts, k.sluten));
        for (const [lager, d] of Object.entries(grupper)) o += `<path class="pv-u-kurva pv-u-${lager.toLowerCase()}" d="${d.join('')}" ${NS}/>`;
      }
      if (v.vagar && U.vagar) {
        const ytor = U.vagar.ytor ? (U.vagar.ytor.bil || []).concat(U.vagar.ytor.gang || []) : [];
        if (ytor.length) o += `<path class="pv-u-vagyta" fill-rule="evenodd" d="${ytor.flatMap(p => p.ringar.map(r => vag(r, true))).join('')}" ${NS}/>`;
        else o += `<path class="pv-u-vag" d="${(U.vagar.linjer || []).filter(l => l.pts && l.pts.length >= 2).map(l => vag(l.pts)).join('')}" ${NS}/>`;
      }
      if (v.skydd && U.skydd) {
        const sk = U.skydd;
        if (sk.strand && sk.strand.zoner) {
          o += `<path class="pv-u-strand" d="${(sk.strand.zoner.m100 || []).map(p => vag(p)).join('')}" ${NS}/>`;
          o += `<path class="pv-u-strand pv-u-strand300" d="${(sk.strand.zoner.m300 || []).map(p => vag(p)).join('')}" ${NS}/>`;
        }
        if (Array.isArray(sk.natur)) o += `<path class="pv-u-natur" d="${sk.natur.flatMap(n => (n.ringar || []).map(r => vag(r, true))).join('')}" ${NS}/>`;
        if (Array.isArray(sk.lamningar)) sk.lamningar.filter(l => l.x != null).forEach(l => { o += `<circle class="pv-u-lamning" cx="${(l.x - O[0]).toFixed(2)}" cy="${(l.y - O[1]).toFixed(2)}" r="1.2" ${NS}><title>${esc(l.klass || 'Lämning')}</title></circle>`; });
      }
      if (v.trad || S.verktyg === 'trad') {
        for (const t of S.trad) {
          if (t.dolt && S.verktyg !== 'trad') continue;
          o += `<circle class="pv-u-trad${t.dolt ? ' pv-u-dolt' : ''}${t.ny ? ' pv-u-egen' : ''}" cx="${(t.x - O[0]).toFixed(2)}" cy="${(t.y - O[1]).toFixed(2)}" r="${Math.max(0.5, t.krona / 2).toFixed(2)}" ${NS}/>`;
        }
      }
      under.innerHTML = o;
    }
    const satUnderTransform = () => under.setAttribute('transform', `matrix(${S.vy.z} 0 0 ${-S.vy.z} ${(W / 2 + (O[0] - S.vy.cx) * S.vy.z).toFixed(2)} ${(H / 2 - (O[1] - S.vy.cy) * S.vy.z).toFixed(2)})`);
    /** Trädet under skärmpunkten (inom kronan eller 10 px). */
    function tradVid(sx, sy) {
      const w = s2w(sx, sy);
      let bast = null;
      for (const t of S.trad) {
        const d = Math.hypot(t.x - w[0], t.y - w[1]);
        if (d <= Math.max(t.krona / 2, px(10)) && (!bast || d < bast.d)) bast = { t, d };
      }
      return bast && bast.t;
    }

    // ------------------------------------------------------------------
    // Ritningen
    // ------------------------------------------------------------------
    /** En rektangel bakom en text (0.16.1), så att den går att läsa på skrafferingen. */
    const textbak = (p, bredd, hojd, vinkelRad) => {
      const u = [Math.cos(vinkelRad), Math.sin(vinkelRad)], n = perp(u), a = mul(u, px(bredd / 2)), b = mul(n, px(hojd / 2));
      return poly([sub(sub(p, a), b), sub(add(p, a), b), add(add(p, a), b), add(sub(p, a), b)], 'pv-textbak');
    };
    /** Samma, med bredd och höjd i meter (0.16.4). */
    const textbakM = (p, b, h, vinkelRad) => {
      const u = [Math.cos(vinkelRad), Math.sin(vinkelRad)], n = perp(u), a = mul(u, b / 2), c = mul(n, h / 2);
      return poly([sub(sub(p, a), c), sub(add(p, a), c), add(add(p, a), c), add(sub(p, a), c)], 'pv-textbak');
    };
    /**
     * En byggnad (0.16.0): kroppar med samma status som går in i varandra ritas som ett yttre skal. Är en av
     * dem markerad ritas skalets kroppar var för sig (enh har då en enhet per kropp, oppen = true).
     */
    function ritaEnhet(e, alla) {
      const st = e.status, sel = e.kroppar.includes(S.vald);
      const d = e.ringar.map(r => 'M' + r.map(P).join(' L') + ' Z').join(' ');
      let o = `<path class="pv-kropp pv-${st}${sel ? ' pv-vald' : ''}${e.oppen ? ' pv-oppen' : ''}" fill-rule="evenodd" d="${d}" data-k="${esc(e.kroppar[0])}"/>`;
      const mm = MM(), marken = [];
      for (const v of e.volymer) {
        // kryss, nock och skärmtak med indrag (0.16.1), i ritningens mått (0.16.4)
        if (st !== 'rivs') Kr.planmarke(v, 1.5 * mm).forEach(l => marken.push([Kr.slag(v) === 'komplement' ? 'NOCK' : 'KRYSS', l]));
        if (S.visa.entre && v.entre && st !== 'rivs') {
          const ep = Kr.entrePunkt(v);
          if (ep) {
            const u = perp(ep.n), tip = add(ep.p, mul(ep.n, 0.6 * mm)), bas = add(ep.p, mul(ep.n, 4.5 * mm));
            o += poly([tip, add(bas, mul(u, 1.8 * mm)), sub(bas, mul(u, 1.8 * mm))], 'pv-entre');
          }
        }
      }
      // rivs: ett stort kryss mot norr (0.16.4, DG)
      if (st === 'rivs') Kr.rivsKryss(e.ringar, 1.5 * mm).forEach(l => marken.push(['RIVS', l]));
      marken.forEach(([lager, [a, b]]) => { o += linje(a, b, lager === 'RIVS' ? 'pv-huvudkryss pv-rivskryss' : 'pv-huvudkryss'); });
      // texterna som på ritningen (0.16.4, DI): namnet i fetstil, FG och arean mindre, i ritningens storlek;
      // får de inte plats står de utanför med en ledare
      const bak = st === 'tillbyggnad' || st === 'ny' || marken.length;
      const et = SP().etikettText(e, S.volymer, mm, marken, alla);
      et.ledare.forEach(g => { o += `<polyline class="pv-ledare" fill="none" points="${g.linje.map(P).join(' ')}"/>` + poly(g.pil, 'pv-etikettpil'); });
      if (bak) et.rutor.forEach(r => { o += textbakM(r.p, r.b, r.h, r.vinkel); });
      et.texter.forEach(t => { o += text(t.p, t.text, pxmm(t.h), 'pv-etikett' + (t.fet ? ' pv-fet' : ''), t.vinkel, t.ha === 'left' ? 'start' : t.ha === 'right' ? 'end' : 'middle'); });
      if (S.visa.koord && !S.visa.koordlista && st !== 'befintlig') {
        const c = tyngd(e.yttre);
        e.ringar.forEach(r => r.forEach(q => {
          const mm = MM(), dd = norm(sub(q, c)), t = add(q, mul(dd, 7 * mm));
          o += text(add(t, [0, 1.1 * mm]), 'N ' + fmt(q[1], 2), pxmm(1.7), 'pv-koord') + text(sub(t, [0, 1.1 * mm]), 'E ' + fmt(q[0], 2), pxmm(1.7), 'pv-koord');
        }));
      }
      return o;
    }
    function rita() {
      W = yta.clientWidth || W; H = yta.clientHeight || H;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      satUnderTransform();
      let o = `<defs><pattern id="pv-skraff" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" class="pv-skraff-bg"/><line x1="0" y1="0" x2="0" y2="7" class="pv-skraff-linje"/></pattern></defs>`;
      const r = opt.utsnitt;
      if (r) o += poly([[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax]], 'pv-utsnitt');
      synligaHus().forEach(h => { o += poly(h.fotavtryck, 'pv-hus' + (S.hovHus === h ? ' pv-hov' : ''), ''); });
      const enh = SP().enheter(S.volymer, { oppen: S.vald }).sort((a, b) => ordning[a.status] - ordning[b.status] || (a.kroppar.includes(S.vald) - b.kroppar.includes(S.vald)));
      enh.forEach(e => { o += ritaEnhet(e, enh); });
      // gränserna ovanpå byggnaderna, så att ingen byggnad skymmer dem (0.16.1)
      granser.forEach(g => { o += `<polyline class="pv-grans" points="${g.map(P).join(' ')}"/>`; });
      if (S.vy.z > 2) granser.forEach(g => g.forEach(q => { const s = w2s(q); if (s[0] > -5 && s[0] < W + 5 && s[1] > -5 && s[1] < H + 5) o += `<circle class="pv-granspunkt" cx="${s[0].toFixed(1)}" cy="${s[1].toFixed(1)}" r="2.2"/>`; }));
      if (S.visa.koordlista) SP().numreradeHorn(S.volymer).forEach(h => {
        o += text(add(h.p, mul(h.ut, 2.6 * MM())), String(h.nr), pxmm(2.0), 'pv-koordnr');
      });
      o += ritaMatt(enh);
      o += ritaLedare();
      if (S.visa.ram && S.ram) {
        // det som ritningshuvudet, teckenförklaringen och upplysningen täcker (0.16.4, DF)
        const rm = SP().ram(Object.assign({ centrum: ramMitt() }, S.ram)), f = rm.falt, z = rm.zon;
        const Z = (x, y) => [z.xmin + (x - f.x) / rm.k, z.ymax - (y - f.y) / rm.k];
        (S.ramRutor || []).forEach(r => { o += poly([Z(r.x, r.y), Z(r.x + r.w, r.y), Z(r.x + r.w, r.y + r.h), Z(r.x, r.y + r.h)], 'pv-ramdold'); });
        o += poly(ramHorn(), 'pv-ram');
        o += poly(ramHorn(), 'pv-ramgrepp', 'data-ramgrepp="1"');
      }
      const k = vald();
      if (k && S.verktyg === 'valj') k.fotavtryck.forEach((p, i) => { const s = w2s(p); o += `<rect class="pv-grepp" data-grepp="${i}" x="${(s[0] - 5).toFixed(1)}" y="${(s[1] - 5).toFixed(1)}" width="10" height="10"/>`; });
      // pågående ritning
      if (S.verktyg === 'rekt' && S.ritar.length === 1) {
        o += poly(rektFran(S.ritar[0], S.markor), 'pv-gummi');
        const m = rektMatt(S.ritar[0], S.markor);
        o += text(add(S.markor, [px(12), px(-12)]), `${fmt(m[0], 2)} × ${fmt(m[1], 2)}`, 11, 'pv-hjalptext', 0, 'start');
      }
      if (S.verktyg === 'poly' && S.ritar.length) {
        o += `<polyline class="pv-gummi" fill="none" points="${S.ritar.concat([S.markor]).map(P).join(' ')}"/>`;
        const sista = S.ritar[S.ritar.length - 1], d = sub(S.markor, sista), l = len(d);
        if (l > 0.01) { const a = ((Math.atan2(d[1], d[0]) / RAD - S.riktning) % 360 + 360) % 360; o += text(add(S.markor, [px(12), px(-12)]), `${fmt(l, 2)} m  ${fmt(a, 1)}°`, 11, 'pv-hjalptext', 0, 'start'); }
      }
      if (S.hovKant) o += linje(S.hovKant.a, S.hovKant.b, 'pv-hovkant');
      if (S.traff) {
        const s = w2s(S.traff.p), q = 6, t = S.traff.typ;
        if (t === 'hörn') o += `<rect class="pv-snapp" x="${s[0] - q}" y="${s[1] - q}" width="${2 * q}" height="${2 * q}"/>`;
        else if (t === 'mitt') o += `<polygon class="pv-snapp" points="${s[0]},${s[1] - q} ${s[0] + q},${s[1] + q} ${s[0] - q},${s[1] + q}"/>`;
        else if (t === 'vinkelrätt') o += `<path class="pv-snapp" d="M${s[0] - q},${s[1] - q} V${s[1] + q} H${s[0] + q} M${s[0] - q},${s[1]} H${s[0]} V${s[1] + q}"/>`;
        else o += `<path class="pv-snapp" d="M${s[0] - q},${s[1] - q} L${s[0] + q},${s[1] + q} M${s[0] + q},${s[1] - q} L${s[0] - q},${s[1] + q}"/>`;
      }
      // ritriktningen och norrpilen
      const [ax, ay] = axlar(), bx = 34, by = H - 34, L = 26;
      o += `<g class="pv-ucs"><path d="M${bx},${by} L${bx + ax[0] * L},${by - ax[1] * L} M${bx},${by} L${bx + ay[0] * L},${by - ay[1] * L}"/><text x="${bx + ax[0] * (L + 9)}" y="${by - ax[1] * (L + 9) + 4}" text-anchor="middle">x</text><text x="${bx + ay[0] * (L + 9)}" y="${by - ay[1] * (L + 9) + 4}" text-anchor="middle">y</text><text x="${bx + 6}" y="${by + 20}">${fmt(S.riktning, 1)}°</text></g>`;
      o += `<g class="pv-norr" transform="translate(${W - 30},40)"><path d="M0,-16 L7,8 L0,3 L-7,8z"/><text x="0" y="24" text-anchor="middle">N</text></g>`;
      dyn.innerHTML = o;
    }
    /** Ledarna (0.16.1): linje, pil och text; texten och pilen går att dra, texten att klicka på. */
    function ritaLedare() {
      let o = '';
      S.ledare.forEach((l, i) => {
        const pts = ledarDrag && ledarDrag.i === i ? ledarDrag.pts : l.pts;
        const g = SP().ledarGeometri(Object.assign({}, l, { pts, text: l.text || ' ' }), MM());
        if (!g) return;
        o += `<polyline class="pv-ledare" fill="none" points="${g.linje.map(P).join(' ')}"/>`;
        o += poly(g.pil, 'pv-ledarpil', `data-ledarpil="${i}"`);
        o += text(g.textP, l.text, Math.max(6, pxmm(2.2)), 'pv-ledartext', 0, g.ha === 'left' ? 'start' : 'end', `data-ledare="${i}"`);
      });
      if (S.verktyg === 'ledare' && S.ritar.length === 1) o += `<polyline class="pv-gummi" fill="none" points="${[S.ritar[0], S.markor].map(P).join(' ')}"/>`;
      return o;
    }
    const rektMatt = (a, b) => { const [ax, ay] = axlar(), d = sub(b, a); return [Math.abs(dot(d, ax)), Math.abs(dot(d, ay))]; };
    function rektFran(a, b) { const [ax, ay] = axlar(), d = sub(b, a), lx = dot(d, ax), ly = dot(d, ay); return [a, add(a, mul(ax, lx)), add(add(a, mul(ax, lx)), mul(ay, ly)), add(a, mul(ay, ly))]; }

    // ------------------------------------------------------------------
    // Panelen
    // ------------------------------------------------------------------
    const tal = s => Kr.tal(s);
    const decimal = (v, d = 2) => (v == null || !(v === v) ? '' : String(Math.round(v * 10 ** d) / 10 ** d).replace('.', ','));
    function ritaPanel() {
      const k = vald();
      let o = '';
      if (k) {
        const st = Kr.status(k), form = k.takform || 'platt', nv = Kr.nockVal(k);
        o += `<section><h3>Byggnadskropp</h3>
          <label class="pv-falt">Namn <input data-f="namn" maxlength="60" value="${esc(k.namn)}"></label>
          <label class="pv-falt">Status <select data-f="status">${Object.entries(Kr.STATUS).map(([s, t]) => `<option value="${s}"${s === st ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="pv-falt">Redovisas i plan <select data-f="slag"><option value="">Inget tecken</option>${Object.entries(Kr.SLAG).map(([v, t]) => `<option value="${v}"${v === Kr.slag(k) ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="pv-falt">Färdigt golv, RH 2000 <input data-f="golv" inputmode="decimal" value="${decimal(k.golv)}" placeholder="marken"></label>
          <label class="pv-falt">Takfot över golvet, m <input data-f="takfot" inputmode="decimal" value="${decimal(k.takfot)}"></label>
          <label class="pv-falt">Tak <select data-f="takform">${[['platt', 'Platt'], ['pulpet', 'Pulpet'], ['sadel', 'Sadel'], ['valm', 'Valmat']].map(([v, t]) => `<option value="${v}"${v === form ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
          ${form !== 'platt' ? `<label class="pv-falt">Lutning, ° <input data-f="taklutning" inputmode="decimal" value="${decimal(k.taklutning, 1)}"></label>
          <label class="pv-falt">${form === 'pulpet' ? 'Högsida' : 'Nock'} <select data-f="nock">${nv.map(n => `<option value="${n.vinkel}"${n.vald ? ' selected' : ''}>${esc(n.text)}</option>`).join('')}</select></label>` : ''}
          ${form !== 'platt' && !V.konvex(Kr.moturs(k.fotavtryck)) ? '<p class="pv-not">Taket ritas förenklat på ett inbuktat fotavtryck. Dela gärna upp kroppen i två.</p>' : ''}
          ${form !== 'platt' ? `<fieldset class="pv-anslut"><legend>Takanslutning (bara i 3D)</legend>${Kr.gavlar(k).map(g => `<label class="pv-falt">${esc(g.text)}, m <input data-f="utdrag${g.ande}" inputmode="decimal" value="${decimal((k.takutdrag || [0, 0])[g.ande])}" placeholder="0"></label>`).join('')}
            <div class="pv-knappar"><button type="button" class="knapp liten" data-a="anslut" title="Dra ut taket vid gavlar som ligger an mot en annan kropp, tills gaveln är inne i den">Anslut taket</button></div>
            <p class="pv-not">Taket dras ut längs nocken in i kroppen bredvid, så att taken möts. Fotavtrycket i plan ändras inte.</p></fieldset>` : ''}
          <div class="pv-harlett" data-harlett></div>
          <div class="pv-knappar">
            <button type="button" class="knapp liten" data-a="folj" title="Vrid så att närmaste sida följer ritriktningen">Följ ritriktning</button>
            <button type="button" class="knapp liten" data-a="vrid">Vrid…</button>
            <button type="button" class="knapp liten" data-a="vridmot" title="Klicka på en sida i byggnaden och sedan på en linje (A)">Vrid mot linje</button>
            <button type="button" class="knapp liten" data-a="kopiera">Kopiera</button>
            ${k.entre ? '<button type="button" class="knapp liten" data-a="utanentre">Ta bort entré</button>' : ''}
            <button type="button" class="knapp liten" data-a="tabort">Ta bort</button>
            <button type="button" class="knapp liten" data-a="avmarkera">Klar</button>
          </div>
        </section>
        <section><h3>Hörn och sidor</h3><table class="pv-horn" data-horn></table>
          <p class="pv-not">${Kr.arRektangel(k.fotavtryck) ? 'Rektangel: en ny koordinat flyttar hela kroppen, en ny sidlängd flyttar motstående sida.' : 'En ny koordinat flyttar hörnet, en ny sidlängd flyttar nästa hörn.'} Koordinaterna är i ${esc(opt.zonNamn || 'zonen')}.</p></section>`;
      } else {
        // Lantmäteriets hus på fastigheten räknas som befintliga, som på situationsplanen (0.16.3)
        const b = Kr.byaMedHus(S.volymer, synligaHus(), opt.ytor || [], opt.uppgifter ? opt.uppgifter().fastighet : null);
        o += `<section><h3>Byggnadskroppar</h3><div class="pv-lista">${S.volymer.map(v => `<button type="button" data-valj="${esc(v.id)}"><span>${esc(v.namn)}</span><span class="pv-tagg">${Kr.STATUS[Kr.status(v)]}</span></button>`).join('') || '<p class="pv-not">Inga kroppar än. Rita med Rektangel eller Polygon, eller ta in ett befintligt hus.</p>'}</div>
          <div class="pv-harlett">BYA tillkommande ${fmt(b.tillkommande, 1)} m²<br>BYA befintlig ${fmt(b.befintlig, 1)} m²<br>BYA totalt ${fmt(b.totalt, 1)} m²${b.rivs ? `<br>Rivs ${fmt(b.rivs, 1)} m²` : ''}${b.lmhus ? `<br>Befintlig inräknat ${b.lmhus} hus från Lantmäteriet` : ''}</div>
          ${opt.saknas ? `<p class="pv-not">${esc(opt.saknas)}</p>` : ''}</section>`;
        if (S.visa.koordlista) {
          const kl = SP().numreradeHorn(S.volymer);
          if (kl.length) o += `<section><h3>Koordinatlista</h3><table class="pv-horn"><tr><th>Nr</th><th>N</th><th>E</th></tr>${kl.map((h, i) => (h.grupp && (!i || kl[i - 1].grupp !== h.grupp) ? `<tr class="pv-grupp"><td colspan="3">${esc(h.grupp)}</td></tr>` : '') + `<tr><td class="pv-nr">${h.nr}</td><td>${fmt(h.p[1], 3)}</td><td>${fmt(h.p[0], 3)}</td></tr>`).join('')}</table><p class="pv-not">I ${esc(opt.zonNamn || 'zonen')}. Nya byggnader först, sedan tillbyggnader och befintliga, varje byggnad medurs från nordväst.</p></section>`;
        }
      }
      const dolda = senasteMatt.filter(m => m.dold).length || SP().matt(S.volymer, granser, { oppen: S.vald, visa: S.visa }).filter(m => m.dold).length;
      const kryss = ([n, t, ind]) => `<label class="pv-kryss${ind ? ' pv-indrag' : ''}"><input type="checkbox" data-visa="${n}"${S.visa[n] !== false && S.visa[n] ? ' checked' : ''}${ind && S.visa.matt === false ? ' disabled' : ''}> ${t}</label>`;
      const und = [['orto', 'Ortofoto (bara här)', U.ortofoto], ['kurvor', 'Höjdkurvor', U.kurvor && U.kurvor.length], ['trad', 'Träd', S.trad.length || opt.tradAndrat],
        ['vagar', 'Vägar', U.vagar], ['skydd', 'Skydd (strandskydd, natur, lämningar)', U.skydd]].filter(x => x[2]);
      o += `<section><h3>Visa</h3>${[['matt', 'Mått'], ['ytter', 'Yttermått', 1], ['relativa', 'Mått mellan byggnader', 1], ['grans', 'Avstånd till tomtgräns', 1], ['koord', 'Hörnkoordinater'], ['koordlista', 'Numrerade hörn och koordinatlista'], ['entre', 'Entrépil'], ['ram', 'Ritningens ram']]
        .map(kryss).join('')}
        ${und.length ? `<h4 class="pv-under-rubrik">Underlag, också på ritningen</h4>${und.map(([n, t]) => kryss([n, t])).join('')}` : ''}
        ${dolda ? `<div class="pv-knappar"><button type="button" class="knapp liten" data-a="visadolda">Visa dolda mått (${dolda})</button></div>` : ''}
        <p class="pv-not">Klicka på ett mått för att ändra det eller dölja det, dra det för att flytta måttlinjen. Måtten till tomtgräns går vinkelrätt mot två gränser: två från långsidan, ett från kortsidan. Gränserna är Lantmäteriets och inte säkerställda; hörnkoordinaterna är det säkra måttet.</p>
        <p class="pv-not">Kroppar med samma status som går in i varandra visas som en byggnad. Markera en av dem för att ändra dem var för sig.</p>
        <p class="pv-not pv-teckn"><span class="pv-t pv-t-ny"></span>Ny <span class="pv-t pv-t-tillbyggnad"></span>Tillbyggnad <span class="pv-t pv-t-befintlig"></span>Befintlig <span class="pv-t pv-t-rivs"></span>Rivs</p></section>`;
      if (!k && opt.situationsplan) {
        const u = (opt.uppgifter && opt.uppgifter()) || {}, r = S.ram;
        o += `<section class="pv-sitplan"><h3>Situationsplan</h3>
          <label class="pv-falt">Format <select data-ram="format">${[['a3:1', 'A3 liggande'], ['a3:0', 'A3 stående'], ['a4:1', 'A4 liggande'], ['a4:0', 'A4 stående']].map(([v, t]) => `<option value="${v}"${v === r.format + ':' + (r.liggande ? 1 : 0) ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="pv-falt">Skala <select data-ram="skala">${[400, 500].map(x => `<option value="${x}"${x === r.skala ? ' selected' : ''}>1:${x}</option>`).join('')}</select></label>
          ${[['fastighet', 'Fastighet'], ['uppdrag', 'Åtgärd', 'Nybyggnad av enbostadshus'], ['ritadAv', 'Ritad av'], ['ritningsnummer', 'Ritningsnummer']].map(([f, t, ph]) =>
            `<label class="pv-falt">${t} <input data-u="${f}" maxlength="120" value="${esc(u[f] || '')}"${ph ? ` placeholder="${esc(ph)}"` : ''}></label>`).join('')}
          <div class="pv-knappar"><button type="button" class="knapp liten" data-a="sp-pdf">PDF</button><button type="button" class="knapp liten" data-a="sp-dxf">DXF</button>${S.ramCentrum ? '<button type="button" class="knapp liten" data-a="ram-mitt" title="Lägg ramen kring byggnaderna igen">Ramen kring byggnaderna</button>' : ''}</div>
          <p class="pv-not">Ritningshuvudet hämtar kommunen och dagens datum själv. Hämta fastigheten med verktyget Fastighet. Ramen på planen visar vad som kommer med, och det gråa det som ritningshuvudet och texterna täcker. Dra i ramens kant för att flytta den. Underlaget som är ikryssat under Visa kommer med (utom ortofotot). DXF:en är i ${esc(opt.zonNamn || 'zonen')}, med ett lager per innehåll.</p></section>`;
      }
      panel.innerHTML = o;
      ritaHarlett();
    }
    function ritaHarlett() {
      const k = vald(), d = panel.querySelector('[data-harlett]'), hb = panel.querySelector('[data-horn]');
      if (!k || !d) return;
      const f = k.fotavtryck, n = f.length, golv = k.golv === k.golv && k.golv != null;
      const s = Kr.sidor(f);
      d.innerHTML = `BYA ${fmt(Math.abs(Kr.area(f)), 1)} m²` + (golv ? `<br>Takfot +${Kr.hojdText(k.golv + k.takfot)}<br>Nock +${Kr.hojdText(V.topp(k))}` : '<br>Golvet följer marken')
        + (Kr.arRektangel(f) && s.length === 4 ? `<br>Yttermått ${fmt(s[0].l, 2)} × ${fmt(s[1].l, 2)} m` : '');
      if (!hb || hb.contains(document.activeElement)) return;
      let o = '<tr><th></th><th>E</th><th>N</th></tr>';
      f.forEach((q, i) => {
        o += `<tr><td class="pv-nr">${i + 1}</td><td><input data-h="${i}" data-c="0" inputmode="decimal" value="${fmt(q[0], 3)}"></td><td><input data-h="${i}" data-c="1" inputmode="decimal" value="${fmt(q[1], 3)}"></td></tr>`;
        o += `<tr class="pv-sida"><td></td><td colspan="2"><label>sida ${i + 1}–${(i + 1) % n + 1} <input data-sida="${i}" inputmode="decimal" value="${fmt(len(sub(f[(i + 1) % n], q)), 3)}"> m</label></td></tr>`;
      });
      hb.innerHTML = o;
    }
    panel.addEventListener('change', e => {
      const t = e.target, k = vald();
      if (t.dataset.visa) {
        S.visa[t.dataset.visa] = t.checked;
        if (t.dataset.visa === 'matt') vaxlaKnapp('matt', t.checked);
        if (['orto', 'kurvor', 'trad', 'vagar', 'skydd'].includes(t.dataset.visa)) byggUnderlag();
        sparaVisa(); allt(); return;
      }
      if (t.dataset.ram) {
        if (t.dataset.ram === 'format') { const [f, l] = t.value.split(':'); S.ram.format = f; S.ram.liggande = l === '1'; } else S.ram.skala = +t.value;
        S.visa.ram = true; if (opt.ramAndrad) opt.ramAndrad(Object.assign({}, S.ram)); allt(); return;
      }
      if (t.dataset.u) { if (opt.satUppgifter) opt.satUppgifter({ [t.dataset.u]: t.value.trim() }); return; }
      if (!k) return;
      const f = t.dataset.f;
      if (f) {
        andra(() => {
          if (f === 'namn') k.namn = t.value.trim() || k.namn;
          else if (f === 'status') { k.status = t.value; if (dockaTillbyggnad(k)) setTimeout(() => besked('Tillbyggnaden är dockad mot fasaden.'), 0); }
          else if (f === 'huvudbyggnad') k.huvudbyggnad = t.checked;
          else if (f === 'slag') Kr.satSlag(k, t.value);
          else if (f === 'utdrag0' || f === 'utdrag1') {
            const x = tal(t.value || '0'), d = (k.takutdrag || [0, 0]).slice();
            if (isFinite(x) && x >= 0) { d[+f.slice(-1)] = Math.min(40, x); if (d[0] > 0 || d[1] > 0) k.takutdrag = d; else delete k.takutdrag; }
          }
          else if (f === 'golv') { const x = tal(t.value); k.golv = isFinite(x) ? x : NaN; if (k.primitiv) k.primitiv.golvAuto = false; }
          else if (f === 'takfot') { const x = tal(t.value); if (x > 0) k.takfot = x; }
          else if (f === 'takform') Kr.satTakform(k, t.value);
          else if (f === 'taklutning') { const x = tal(t.value); if (isFinite(x)) { k.taklutning = Math.min(75, Math.max(0.5, x)); V.uppdatera(k); } }
          else if (f === 'nock') Kr.satNock(k, Number(t.value));
        });
        return;
      }
      if (t.dataset.h != null) {
        const i = +t.dataset.h, c = +t.dataset.c, x = tal(t.value);
        if (!isFinite(x)) return;
        andra(() => {
          const p = k.fotavtryck.map(q => q.slice()), d = [0, 0];
          d[c] = x - p[i][c];
          if (Kr.arRektangel(p)) Kr.flytta(S.volymer, k.id, d[0], d[1]);
          else { p[i] = add(p[i], d); if (Kr.satHorn(k, p) === false) besked('Hörnet kan inte ligga där: sidorna skulle korsa varandra.'); }
        });
        return;
      }
      if (t.dataset.sida != null) {
        const x = tal(t.value);
        if (x > 0.1) andra(() => satSida(k, +t.dataset.sida, x));
      }
    });
    /** Ändrar sidan i:s längd. En rektangel flyttar motstående sida, annars flyttas nästa hörn. */
    function satSida(k, i, l) {
      const p = k.fotavtryck.map(q => q.slice()), n = p.length, a = p[i], b = p[(i + 1) % n], u = norm(sub(b, a)), d = mul(u, l - len(sub(b, a)));
      if (Kr.arRektangel(p)) { p[(i + 1) % n] = add(p[(i + 1) % n], d); p[(i + 2) % n] = add(p[(i + 2) % n], d); }
      else p[(i + 1) % n] = add(b, d);
      if (Kr.satHorn(k, p) === false) besked('Sidan kan inte vara så lång: sidorna skulle korsa varandra.');
    }
    panel.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.valj) { S.vald = b.dataset.valj; allt(); return; }
      if (b.dataset.a === 'visadolda') { andra(() => SP().visaDolda(S.volymer)); return; }
      if (b.dataset.a === 'ram-mitt') { S.ramCentrum = null; if (opt.ramCentrumAndrad) opt.ramCentrumAndrad(null); allt(); return; }
      if (b.dataset.a === 'sp-pdf' || b.dataset.a === 'sp-dxf') {
        panel.querySelectorAll('[data-u]').forEach(el => { if (opt.satUppgifter) opt.satUppgifter({ [el.dataset.u]: el.value.trim() }); });
        opt.situationsplan(b.dataset.a === 'sp-pdf' ? 'pdf' : 'dxf', { volymer: S.volymer.map(kopia), visa: Object.assign({}, S.visa), ram: Object.assign({ centrum: ramMitt() }, S.ram), ledare: kopia(S.ledare), trad: S.trad });
        return;
      }
      const k = vald(), a = b.dataset.a;
      if (!k || !a) return;
      if (a === 'avmarkera') { S.vald = null; allt(); }
      else if (a === 'tabort') taBort();
      else if (a === 'utanentre') andra(() => { k.entre = null; });
      else if (a === 'anslut') {
        let r = null;
        andra(() => { r = Kr.anslutTak(k, S.volymer); });
        besked(r && (r.utdrag[0] || r.utdrag[1]) ? `Taket draget ${[r.utdrag[0], r.utdrag[1]].filter(x => x).map(x => fmt(x, 2) + ' m').join(' och ')} in i kroppen bredvid. Se resultatet i 3D.` : 'Ingen gavel ligger an mot en annan kropp, eller taket når inte in i den.');
      }
      else if (a === 'vridmot') { satVerktyg('vridmot'); }
      else if (a === 'kopiera') andra(() => {
        const c = kopia(k), [ax] = axlar(), sd = Kr.sidor(k.fotavtryck), bredd = Math.max(...sd.map(s => Math.abs(dot(s.u, ax)) * s.l)) || 5;
        c.id = opt.nyttId(); c.namn = (k.namn || 'Byggnad') + ' (kopia)'; c.kalla = null;
        if (c.status === 'befintlig' || c.status === 'rivs') c.status = 'ny';
        if (c.golv == null) c.golv = NaN;
        if (c.primitiv) c.primitiv.lankar = [];
        V.flytta(c, ax[0] * (bredd + 2), ax[1] * (bredd + 2));
        S.volymer.push(c); S.vald = c.id;
      });
      else if (a === 'folj') andra(() => {
        const sd = Kr.sidor(k.fotavtryck).sort((x, y) => y.l - x.l)[0];
        if (!sd) return;
        let d = S.riktning - Math.atan2(sd.u[1], sd.u[0]) / RAD;
        while (d > 45) d -= 90;
        while (d < -45) d += 90;
        Kr.vrid(S.volymer, k.id, d, tyngd(k.fotavtryck));
      });
      else if (a === 'vrid') {
        if (b.parentElement.querySelector('.pv-vridin')) return;
        const inp = document.createElement('input');
        inp.className = 'pv-vridin'; inp.placeholder = 'grader moturs'; inp.inputMode = 'decimal'; inp.setAttribute('aria-label', 'Vrid, grader moturs');
        b.parentElement.append(inp); inp.focus();
        inp.addEventListener('keydown', ev => {
          ev.stopPropagation();
          if (ev.key === 'Enter') { const x = tal(inp.value); if (isFinite(x) && x) andra(() => Kr.vrid(S.volymer, k.id, x, tyngd(k.fotavtryck))); else inp.remove(); }
          if (ev.key === 'Escape') inp.remove();
        });
      }
    });
    /**
     * En tillbyggnad dockar mot en befintlig fasad (0.16.4, DH): ligger en sida nära och nästan parallell med en
     * befintlig byggnads sida (en kropp eller ett hus från Lantmäteriet) vrids och flyttas den ut i fasadlivet.
     * Ger true om den flyttades.
     */
    function dockaTillbyggnad(k) {
      if (!k || Kr.status(k) !== 'tillbyggnad') return false;
      const egen = V.komponent(S.volymer, k.id);
      const mal = S.volymer.filter(v => !egen.has(v.id) && Kr.status(v) === 'befintlig').map(v => v.fotavtryck).concat(synligaHus().map(h => h.fotavtryck));
      const r = Kr.dockning(k, mal, { maxAvst: Math.max(0.6, px(24)) });
      if (!r || (Math.abs(r.vrid) < 1e-6 && len(r.d) < 0.0005)) return false;
      if (r.vrid) Kr.vrid(S.volymer, k.id, r.vrid, r.c);
      Kr.flytta(S.volymer, k.id, r.d[0], r.d[1]);
      return true;
    }
    function taBort() {
      const k = vald();
      if (!k) return;
      andra(() => {
        S.volymer = S.volymer.filter(v => v.id !== k.id);
        S.volymer.forEach(v => { if (v.primitiv && v.primitiv.lankar) v.primitiv.lankar = v.primitiv.lankar.filter(x => x !== k.id); });
        S.vald = null;
      });
    }

    // ------------------------------------------------------------------
    // Rita nytt
    // ------------------------------------------------------------------
    const golvVid = p => { const h = opt.markhojd ? opt.markhojd(p[0], p[1]) : NaN; return isFinite(h) ? Math.round(h * 100) / 100 : NaN; };
    const nyttNamn = () => `Byggnad ${S.volymer.length + 1}`;
    function klarRekt(a, ax, ay, lx, ly) {
      if (Math.abs(lx) < 0.3 || Math.abs(ly) < 0.3) { besked('För liten rektangel.'); return; }
      const c = add(a, add(mul(ax, lx / 2), mul(ay, ly / 2)));
      andra(() => {
        const v = Kr.nyRektangel(a, ax, ay, lx, ly, { id: opt.nyttId(), namn: nyttNamn(), golv: golvVid(c), takfot: 3, takform: 'sadel', taklutning: 27 });
        S.volymer.push(v); S.vald = v.id;
      });
      S.ritar = []; satVerktyg('valj');
    }
    function klarPoly() {
      if (S.ritar.length < 3) { besked('Minst tre hörn.'); return; }
      const pts = S.ritar.slice();
      if (Math.abs(Kr.area(pts)) < 0.5) { besked('Fotavtrycket blir för litet.'); return; }
      andra(() => {
        const v = Kr.nyPolygon(pts, { id: opt.nyttId(), namn: nyttNamn(), golv: golvVid(tyngd(pts)), takfot: 3 });
        S.volymer.push(v); S.vald = v.id;
      });
      S.ritar = []; satVerktyg('valj');
    }
    function franHus(h) {
      if ((h.hal || []).some(r => r && r.length >= 3)) {
        besked('Huset har en innergård. Hus med gård går inte att göra om till kropp än, eftersom gården då skulle räknas som byggd.');
        return;
      }
      andra(() => {
        const v = Kr.franHus(h, { id: opt.nyttId(), namn: h.namn || 'Befintlig byggnad', golv: golvVid(tyngd(h.fotavtryck)) });
        S.volymer.unshift(v); S.vald = v.id;
      });
      besked('Inlagd som befintlig byggnad. Höjd och golv är skattade; ändra dem i panelen.');
      satVerktyg('valj');
    }

    // ------------------------------------------------------------------
    // Mus och pekare
    // ------------------------------------------------------------------
    let drag = null, mellanslag = false, ramDrag = null;
    const evPunkt = e => { const r = svg.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const borjaPan = (e, sx, sy) => { drag = { typ: 'pan', sx, sy, cx: S.vy.cx, cy: S.vy.cy, flyttad: false }; svg.setPointerCapture(e.pointerId); };
    svg.addEventListener('pointerdown', e => {
      dolj();
      const [sx, sy] = evPunkt(e);
      if (e.button === 1 || e.button === 2 || (e.button === 0 && mellanslag)) { e.preventDefault(); borjaPan(e, sx, sy); return; }
      if (e.button !== 0) return;
      const t = e.target, w = s2w(sx, sy);
      // flytta ritningens ram (0.16.4, DF): dra i kanten
      if (t.dataset && t.dataset.ramgrepp) {
        e.preventDefault();
        ramDrag = { sx, sy, c0: ramMitt().slice() };
        svg.setPointerCapture(e.pointerId);
        return;
      }
      if (t.dataset && (t.dataset.ledare != null || t.dataset.ledarpil != null) && (S.verktyg === 'valj' || S.verktyg === 'ledare') && !S.ritar.length) {
        e.preventDefault();
        const i = +(t.dataset.ledare != null ? t.dataset.ledare : t.dataset.ledarpil), l = S.ledare[i];
        ledarDrag = { i, del: t.dataset.ledare != null ? 1 : 0, pts: l.pts.map(q => q.slice()), sx, sy, flyttad: false, ruta: t.getBoundingClientRect() };
        svg.setPointerCapture(e.pointerId);
        return;
      }
      if (t.dataset && t.dataset.matt != null) {
        e.preventDefault();
        const i = +t.dataset.matt, m = senasteMatt[i];
        mattDrag = { i, sx, sy, off: m && m.off, flyttad: false, ruta: t.getBoundingClientRect(), kan: !!m, forslag: null };
        svg.setPointerCapture(e.pointerId);
        return;
      }
      if (S.verktyg === 'valj') {
        const k = vald();
        if (t.dataset && t.dataset.grepp != null && k) {
          drag = { typ: 'grepp', i: +t.dataset.grepp, k: k.id, fore: ogonblick(), orig: k.fotavtryck.map(q => q.slice()) };
          svg.setPointerCapture(e.pointerId); return;
        }
        const traff = S.volymer.slice().sort((a, b) => ordning[Kr.status(b)] - ordning[Kr.status(a)]).find(v => inuti(v.fotavtryck, w[0], w[1]));
        if (traff) {
          S.vald = traff.id;
          // greppet: ett hörn inom 12 px, annars punkten
          let grepp = w;
          for (const q of traff.fotavtryck) { const s = w2s(q); if (Math.hypot(s[0] - sx, s[1] - sy) < 12) { grepp = q.slice(); break; } }
          const grupp = V.komponent(S.volymer, traff.id);
          drag = { typ: 'flytta', k: traff.id, grepp, fore: ogonblick(), flyttad: false, grupp,
            orig: new Map(S.volymer.filter(v => grupp.has(v.id)).map(v => [v.id, JSON.stringify(kopia(v))])) };
          svg.setPointerCapture(e.pointerId); allt(); return;
        }
        S.vald = null; borjaPan(e, sx, sy); allt(); return;
      }
      if (S.verktyg === 'rekt') {
        const p = plocka(sx, sy, null);
        if (!S.ritar.length) { S.ritar = [p]; rita(); prompt(); }
        else { const [ax, ay] = axlar(), d = sub(p, S.ritar[0]); klarRekt(S.ritar[0], ax, ay, dot(d, ax), dot(d, ay)); }
        return;
      }
      if (S.verktyg === 'poly') {
        if (S.ritar.length >= 3) { const s0 = w2s(S.ritar[0]); if (Math.hypot(s0[0] - sx, s0[1] - sy) < 11) { klarPoly(); return; } }
        S.ritar.push(plocka(sx, sy, S.ritar[S.ritar.length - 1])); rita(); prompt(); return;
      }
      if (S.verktyg === 'riktn') {
        const k2 = narmasteKant(sx, sy, () => true);
        if (!k2) { besked('Klicka närmare en linje.'); return; }
        const d = sub(k2.b, k2.a);
        let a = Math.atan2(d[1], d[0]) / RAD;
        while (a > 45) a -= 90;
        while (a <= -45) a += 90;
        S.riktning = Math.round(a * 1e4) / 1e4;
        besked(`Ritriktning ${fmt(S.riktning, 2)}° efter ${k2.typ === 'gräns' ? 'gränsen' : k2.typ === 'kropp' ? 'fasaden' : 'huset'}.`);
        satVerktyg('valj'); return;
      }
      if (S.verktyg === 'entre') {
        const k2 = narmasteKant(sx, sy, x => x.typ === 'kropp', 16);
        if (!k2) { besked('Klicka på en fasad.'); return; }
        andra(() => { const v = S.volymer.find(x => x.id === k2.k); v.entre = { sida: k2.i, t: Math.round(k2.t * 1000) / 1000 }; S.vald = v.id; });
        return;
      }
      if (S.verktyg === 'vridmot') {
        if (!S.vm) {
          const k2 = narmasteKant(sx, sy, x => x.typ === 'kropp', 16);
          if (!k2) { besked('Klicka på en sida i en byggnad.'); return; }
          S.vm = { k: k2.k, u: norm(sub(k2.b, k2.a)), p: add(k2.a, mul(sub(k2.b, k2.a), k2.t)) };
          S.vald = k2.k; S.hovKant = null; allt(); return;
        }
        const k2 = narmasteKant(sx, sy, x => !(x.typ === 'kropp' && V.komponent(S.volymer, S.vm.k).has(x.k)));
        if (!k2) { besked('Klicka närmare en linje.'); return; }
        const ref = norm(sub(k2.b, k2.a));
        let d = (Math.atan2(ref[1], ref[0]) - Math.atan2(S.vm.u[1], S.vm.u[0])) / RAD;
        while (d > 90) d -= 180;
        while (d <= -90) d += 180;
        const vm = S.vm;
        S.vm = null;
        if (Math.abs(d) > 1e-6) andra(() => Kr.vrid(S.volymer, vm.k, d, vm.p));
        besked(`Vriden ${fmt(d, 2)}° så att sidan följer ${k2.typ === 'gräns' ? 'gränsen' : k2.typ === 'kropp' ? 'fasaden' : 'huset'}.`);
        satVerktyg('valj'); return;
      }
      if (S.verktyg === 'ledare') {
        const p = plocka(sx, sy, S.ritar[0] || null);
        if (!S.ritar.length) { S.ritar = [p]; rita(); prompt(); return; }
        const pts = [S.ritar[0], p], sp = w2s(p);
        S.ritar = [];
        // efter mousedown, som annars tar fokus från rutan
        setTimeout(() => oppnaText(null, pts, sp), 0);
        return;
      }
      if (S.verktyg === 'trad') {
        if (!opt.tradAndrat) { besked('Träden kan inte ändras här.'); return; }
        const tr = tradVid(sx, sy);
        const typ = tr ? (tr.ny && !tr.dolt ? 'bort' : tr.dolt ? 'visa' : 'dolj') : 'ny';
        const ny = opt.tradAndrat({ typ, t: tr, x: w[0], y: w[1] });
        if (Array.isArray(ny)) S.trad = ny;
        byggUnderlag(); rita();
        besked({ ny: 'Ett träd tillagt (8 m högt, krona 5 m). Ändra det i 3D-vyn.', bort: 'Trädet borttaget.', dolj: 'Trädet dolt. Klicka igen för att visa det.', visa: 'Trädet visas igen.' }[typ]);
        return;
      }
      if (S.verktyg === 'fast') {
        if (!opt.fastighetVid) { besked('Fastighetsindelningen finns inte i underlaget.'); return; }
        besked('Letar efter fastigheten …');
        Promise.resolve(opt.fastighetVid(w[0], w[1])).then(ytor => {
          if (!ytor || !ytor.length) { besked('Ingen fastighet på den punkten.'); return; }
          if (opt.satUppgifter) opt.satUppgifter({ fastighet: ytor[0].beteckning });
          besked(`Fastighet: ${ytor[0].beteckning}`);
          satVerktyg('valj'); ritaPanel();
        }, err => besked('Fastigheten: ' + (err && err.message ? err.message : err)));
        return;
      }
      if (S.verktyg === 'lm') {
        const h = synligaHus().find(b => inuti(b.fotavtryck, w[0], w[1]));
        if (h) franHus(h); else besked(allaHus.length ? 'Klicka på ett grått hus.' : 'Det finns inga hus från Lantmäteriet. Välj Byggnader under 02 Underlag och skapa underlaget.');
      }
    });
    svg.addEventListener('contextmenu', e => e.preventDefault());
    svg.addEventListener('pointermove', e => {
      const [sx, sy] = evPunkt(e);
      if (ramDrag) { S.ramCentrum = [ramDrag.c0[0] + (sx - ramDrag.sx) / S.vy.z, ramDrag.c0[1] - (sy - ramDrag.sy) / S.vy.z]; rita(); return; }
      if (mattDrag) { if (mattDrag.kan) dragMatt(sx, sy); return; }
      if (ledarDrag) {
        if (Math.hypot(sx - ledarDrag.sx, sy - ledarDrag.sy) > 3) ledarDrag.flyttad = true;
        if (ledarDrag.flyttad) { ledarDrag.pts[ledarDrag.del] = plocka(sx, sy, null); rita(); }
        return;
      }
      if (drag && drag.typ === 'pan') {
        S.vy.cx = drag.cx - (sx - drag.sx) / S.vy.z; S.vy.cy = drag.cy + (sy - drag.sy) / S.vy.z; rita(); return;
      }
      if (drag && drag.typ === 'flytta') {
        const mal = plocka(sx, sy, null, drag.grupp), d = sub(mal, drag.grepp);
        if (len(d) * S.vy.z > 2 || drag.flyttad) {
          drag.flyttad = true;
          // från läget vid starten varje gång, så att avrundningen inte växer
          S.volymer = S.volymer.map(v => {
            if (!drag.grupp.has(v.id)) return v;
            const n = JSON.parse(drag.orig.get(v.id));
            if (n.golv == null) n.golv = NaN;
            return V.flytta(n, d[0], d[1]);
          });
          rita(); ritaHarlett(); status(mal);
        }
        return;
      }
      if (drag && drag.typ === 'grepp') {
        const k = S.volymer.find(v => v.id === drag.k), p = plocka(sx, sy, null, new Set([k.id])), o = drag.orig;
        if (Kr.arRektangel(o) && !e.altKey) {
          const mot = o[(drag.i + 2) % 4], ax = norm(sub(o[1], o[0])), ay = perp(ax), d = sub(p, mot), lx = dot(d, ax), ly = dot(d, ay);
          if (Math.abs(lx) > 0.2 && Math.abs(ly) > 0.2) {
            const q = [mot, add(mot, mul(ax, lx)), add(add(mot, mul(ax, lx)), mul(ay, ly)), add(mot, mul(ay, ly))];
            Kr.satHorn(k, q);
          }
        } else { const q = o.map(x => x.slice()); q[drag.i] = p; Kr.satHorn(k, q); }
        rita(); ritaHarlett(); status(p);
        return;
      }
      const bas = S.verktyg === 'poly' ? S.ritar[S.ritar.length - 1] : null;
      if (S.verktyg === 'rekt' || S.verktyg === 'poly' || S.verktyg === 'ledare') S.markor = plocka(sx, sy, S.verktyg === 'ledare' ? (S.ritar[0] || null) : bas);
      else { S.markor = s2w(sx, sy); S.traff = null; }
      S.hovKant = null; S.hovHus = null;
      if (S.verktyg === 'riktn') S.hovKant = narmasteKant(sx, sy, () => true);
      if (S.verktyg === 'entre') S.hovKant = narmasteKant(sx, sy, x => x.typ === 'kropp', 16);
      if (S.verktyg === 'vridmot') S.hovKant = S.vm ? narmasteKant(sx, sy, x => !(x.typ === 'kropp' && V.komponent(S.volymer, S.vm.k).has(x.k))) : narmasteKant(sx, sy, x => x.typ === 'kropp', 16);
      if (S.verktyg === 'lm') S.hovHus = synligaHus().find(b => inuti(b.fotavtryck, S.markor[0], S.markor[1])) || null;
      status(S.markor);
      rita();
    });
    svg.addEventListener('pointerup', () => {
      if (ramDrag) {
        ramDrag = null;
        if (opt.ramCentrumAndrad) opt.ramCentrumAndrad(S.ramCentrum ? S.ramCentrum.slice() : null);
        allt(); return;
      }
      if (ledarDrag) {
        const d = ledarDrag;
        ledarDrag = null;
        if (d.flyttad) andra(() => { S.ledare[d.i].pts = d.pts; });
        else { rita(); const l = S.ledare[d.i]; if (l) setTimeout(() => oppnaText(d.i, l.pts, null, d.ruta), 0); }
        return;
      }
      if (mattDrag) {
        const d = mattDrag, m = senasteMatt[d.i];
        mattDrag = null;
        if (d.flyttad && m && m.typ === 'grans') {
          // gränsmåttet släppt på en annan gräns (0.16.4, DG)
          if (d.forslag) andra(() => SP().satAnnot(S.volymer, m, Object.assign({}, annotFor(m), { mot: d.forslag.mot })));
          else { besked('Släpp måttet på en gräns som hörnet kan mätas vinkelrätt mot.'); rita(); }
        } else if (d.flyttad && m) andra(() => SP().satAnnot(S.volymer, m, Object.assign({}, { off: Math.round(d.off * 100) / 100 })));
        else { rita(); setTimeout(() => oppnaMatt(d.i, d.ruta), 0); }
        return;
      }
      if (!drag) return;
      const d = drag;
      drag = null;
      if (d.typ === 'flytta' || d.typ === 'grepp') {
        if (d.typ === 'flytta' && !d.flyttad) { allt(); return; }
        if (d.typ === 'flytta') { const k = S.volymer.find(v => v.id === d.k); if (k && dockaTillbyggnad(k)) besked('Tillbyggnaden är dockad mot fasaden.'); }
        S.angra.push(d.fore); if (S.angra.length > 100) S.angra.shift(); S.gorom = [];
        S.traff = null;
        meddela(); allt();
      }
    });
    svg.addEventListener('dblclick', () => { if (S.verktyg === 'poly' && S.ritar.length >= 3) klarPoly(); });
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const [sx, sy] = evPunkt(e), w = s2w(sx, sy), f = Math.exp(-e.deltaY * 0.0015);
      S.vy.z = Math.min(200, Math.max(0.05, S.vy.z * f));
      const w2 = s2w(sx, sy);
      S.vy.cx += w[0] - w2[0]; S.vy.cy += w[1] - w2[1];
      rita();
    }, { passive: false });

    // ------------------------------------------------------------------
    // Ledarens text (0.16.1)
    // ------------------------------------------------------------------
    let textMal = null;
    /** Öppnar textrutan för en ny ledare (i = null, pts) eller för ledaren i. s = skärmpunkt eller r = textens ruta. */
    function oppnaText(i, pts, s, r) {
      const yr = yta.getBoundingClientRect();
      const x = r ? r.left - yr.left : s[0] + 6, y = r ? r.top - yr.top - 4 : s[1] - 14;
      textMal = { i, pts };
      textin.hidden = false;
      textin.style.left = Math.max(4, Math.min(x, W - 230)) + 'px'; textin.style.top = Math.max(4, y) + 'px';
      textin.value = i != null && S.ledare[i] ? S.ledare[i].text : '';
      textin.placeholder = i != null ? 'Text (tom tar bort), Enter' : 'Text, Enter';
      textin.focus(); textin.select();
    }
    function stangText() { textin.hidden = true; textMal = null; }
    textin.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { stangText(); rita(); return; }
      if (e.key !== 'Enter' || !textMal) return;
      const txt = textin.value.trim(), m = textMal;
      stangText();
      if (m.i == null) {
        if (!txt) { rita(); return; }
        andra(() => S.ledare.push({ id: opt.nyttId ? opt.nyttId() : 'l' + Date.now(), pts: m.pts, text: txt.slice(0, 200) }));
        besked('Ledaren är inlagd. Dra i texten eller pilen för att flytta, klicka på texten för att ändra den.');
      } else if (!txt) andra(() => { S.ledare.splice(m.i, 1); });
      else andra(() => { S.ledare[m.i].text = txt.slice(0, 200); });
    });
    textin.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== textin) { stangText(); rita(); } }, 150));

    // ------------------------------------------------------------------
    // Ändra ett mått
    // ------------------------------------------------------------------
    let mattIndex = null;
    function oppnaMatt(i, r) {
      const m = senasteMatt[i];
      if (!m) return;
      mattIndex = i;
      const yr = yta.getBoundingClientRect();
      mattin.hidden = false; mattdolj.hidden = false;
      const x = r.left - yr.left + r.width / 2 - 40, y = r.top - yr.top + r.height / 2 - 14;
      mattin.style.left = x + 'px'; mattin.style.top = y + 'px';
      mattdolj.style.left = (x + 84) + 'px'; mattdolj.style.top = y + 'px';
      mattin.value = fmt(m.d, 3); mattin.readOnly = !m.andra;
      mattin.title = m.andra ? 'Skriv ett nytt mått och tryck Enter' : 'Markera byggnaden för att ändra den här sidan';
      mattin.focus(); mattin.select();
    }
    function dolj() { mattin.hidden = true; mattdolj.hidden = true; mattIndex = null; }
    /** Flyttar kropparna (och de länkade) dx, dy. */
    function flyttaKroppar(ids, dx, dy) {
      const alla = new Set();
      ids.forEach(id => V.komponent(S.volymer, id).forEach(x => alla.add(x)));
      S.volymer = S.volymer.map(v => (alla.has(v.id) ? V.flytta(v, dx, dy) : v));
    }
    mattin.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { dolj(); return; }
      if (e.key !== 'Enter') return;
      const x = tal(mattin.value), m = senasteMatt[mattIndex];
      dolj();
      if (!isFinite(x) || !m) return;
      if (!m.andra) { besked('Den här sidan går inte att ändra som en helhet. Markera byggnaden och ändra kropparna var för sig.'); return; }
      if (m.andra.flytta) {
        if (x < 0) return;
        const u = m.andra.flytta, d = x - m.d;
        andra(() => flyttaKroppar(m.andra.kroppar, u[0] * d, u[1] * d));
        if (m.typ === 'grans') besked(`Flyttad ${fmt(d, 3)} m vinkelrätt mot gränsen.`);
      } else if (m.andra.kropp && x > 0.1) {
        const k = S.volymer.find(v => v.id === m.andra.kropp);
        if (k) andra(() => satSida(k, m.andra.i, (m.andra.l != null ? m.andra.l : m.d) + (x - m.d)));
      }
    });
    mattin.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== mattdolj) dolj(); }, 120));
    mattdolj.addEventListener('click', () => {
      const m = senasteMatt[mattIndex];
      dolj();
      if (!m) return;
      andra(() => SP().satAnnot(S.volymer, m, { dold: true }));
      besked('Måttet är dolt. Visa det igen med Visa dolda mått i panelen.');
    });
    /** Dra ett yttermått eller ett mått mellan byggnader längre ut eller in (0.16.0). */
    /** Måttets sparade anteckning ({ dold, off, mot }) eller {}. */
    function annotFor(m) {
      const v = S.volymer.find(x => x.id === m.agare);
      return (v && v.matt && v.matt[`${m.enhet}|${m.nyckel}`]) || {};
    }
    function dragMatt(sx, sy) {
      const m = senasteMatt[mattDrag.i], w = s2w(sx, sy);
      if (m.typ === 'grans') {
        // dra gränsmåttet till en annan gräns (0.16.4, DG): närmaste gränssträcka som hörnet når vinkelrätt
        if (Math.hypot(sx - mattDrag.sx, sy - mattDrag.sy) > 3) mattDrag.flyttad = true;
        let bast = null;
        for (const k of kanter().filter(x => x.typ === 'gräns')) {
          const f = fotpunkt(m.fran, k.a, k.b);
          if (f.t < -0.01 || f.t > 1.01 || len(sub(f.f, m.fran)) < 0.05) continue;
          const fp = fotpunkt(w, k.a, k.b), q = add(k.a, mul(sub(k.b, k.a), Math.max(0, Math.min(1, fp.t))));
          const d = len(sub(q, w)) * S.vy.z;
          if (d < 40 && (!bast || d < bast.d)) bast = { d, till: f.f, mot: [k.gi, k.si] };
        }
        mattDrag.forslag = bast;
        rita();
        return;
      }
      mattDrag.off = Math.max(1.5 * MM(), dot(sub(w, m.fran), m.n) - 1.4 * MM());
      if (Math.hypot(sx - mattDrag.sx, sy - mattDrag.sy) > 3) mattDrag.flyttad = true;
      rita();
    }

    // ------------------------------------------------------------------
    // Inmatningsraden
    // ------------------------------------------------------------------
    function markorRiktning(bas) {
      const [ax, ay] = axlar();
      let d = sub(S.markor, bas);
      if (len(d) < 1e-6) return ax;
      if (S.ortho) { const lx = dot(d, ax), ly = dot(d, ay); return Math.abs(lx) >= Math.abs(ly) ? mul(ax, Math.sign(lx) || 1) : mul(ay, Math.sign(ly) || 1); }
      return norm(d);
    }
    kommando.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { avbryt(); kommando.value = ''; kommando.blur(); return; }
      if (e.key !== 'Enter') return;
      const s = kommando.value.trim();
      kommando.value = '';
      const bas = S.verktyg === 'poly' ? S.ritar[S.ritar.length - 1] : S.verktyg === 'rekt' ? S.ritar[0] : null;
      const r = Kr.tolka(s, { bas: bas || null, axel: S.riktning, mot: bas ? markorRiktning(bas) : null });
      if (S.verktyg === 'poly') {
        if (!s || /^[sc]$/i.test(s)) { if (S.ritar.length >= 3) klarPoly(); return; }
        if (!r || r.typ !== 'punkt') { besked(S.ritar.length ? 'Förstod inte. Prova 6, 6<90 eller @3;4.' : 'Första hörnet: skriv E;N eller klicka.'); return; }
        S.ritar.push(r.p); S.markor = r.p; rita(); prompt(); return;
      }
      if (S.verktyg === 'rekt') {
        if (!S.ritar.length) {
          if (!r || r.typ !== 'punkt') { besked('Skriv E;N för första hörnet eller klicka.'); return; }
          S.ritar = [r.p]; S.markor = add(r.p, [1, 1]); rita(); prompt(); return;
        }
        const [ax, ay] = axlar();
        if (r && r.typ === 'matt') {
          const d = sub(S.markor, S.ritar[0]), tx = Math.sign(dot(d, ax)) || 1, ty = Math.sign(dot(d, ay)) || 1;
          klarRekt(S.ritar[0], ax, ay, r.b * tx, r.d * ty); return;
        }
        if (r && r.typ === 'punkt') { const d = sub(r.p, S.ritar[0]); klarRekt(S.ritar[0], ax, ay, dot(d, ax), dot(d, ay)); return; }
        besked('Skriv bredd x djup, till exempel 12,6x9.'); return;
      }
      if (S.verktyg === 'valj' && vald() && s) {
        const f = Kr.tolka(s.startsWith('@') ? s : '@' + s, { bas: [0, 0], axel: S.riktning });
        if (f && f.typ === 'punkt') { andra(() => Kr.flytta(S.volymer, S.vald, f.p[0], f.p[1])); besked('Flyttad.'); return; }
        besked('Med en byggnad vald flyttar @dx;dy den längs ritriktningen.'); return;
      }
      besked('Välj Rektangel eller Polygon för att rita.');
    });

    // ------------------------------------------------------------------
    // Verktyg, tangenter och knappar
    // ------------------------------------------------------------------
    function avbryt() { S.ritar = []; S.traff = null; rita(); prompt(); }
    function satVerktyg(t) {
      const tradFore = S.verktyg === 'trad';
      S.verktyg = t; S.ritar = []; S.hovKant = null; S.hovHus = null; S.traff = null; S.vm = null;
      if (tradFore !== (t === 'trad')) byggUnderlag();
      rot.querySelectorAll('[data-verktyg]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.verktyg === t)));
      yta.dataset.verktyg = t;
      prompt(); rita();
    }
    function prompt() { const p = PROMPT[S.verktyg]; $('.planvy-prompt').textContent = typeof p === 'function' ? p(S) : p; }
    function status(w) {
      $('.planvy-status').textContent = `E ${fmt(w[0], 2)}  N ${fmt(w[1], 2)}${S.traff ? ' · ' + S.traff.typ : ''}${opt.zonNamn ? ' · ' + opt.zonNamn : ''}`;
    }
    let beskedTid = null;
    function besked(t) {
      const b = $('.planvy-besked');
      b.textContent = t; b.classList.add('syns');
      clearTimeout(beskedTid); beskedTid = setTimeout(() => b.classList.remove('syns'), 3200);
    }
    function vaxla(namn) {
      S[namn] = !S[namn];
      $(`[data-pv=${namn}]`).setAttribute('aria-pressed', String(S[namn]));
    }
    const vaxlaKnapp = (namn, pa) => { const b = $(`[data-pv=${namn}]`); if (b) b.setAttribute('aria-pressed', String(!!pa)); };
    rot.querySelector('.planvy-huvud').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.verktyg) { satVerktyg(b.dataset.verktyg); return; }
      const a = b.dataset.pv;
      if (a === 'ortho' || a === 'snapp') vaxla(a);
      else if (a === 'matt') { S.visa.matt = S.visa.matt === false; vaxlaKnapp('matt', S.visa.matt); sparaVisa(); allt(); }
      else if (a === 'angra') angra();
      else if (a === 'gorom') gorOm();
      else if (a === 'passa') { S.passadUtsnitt = !S.passadUtsnitt; passa(!S.passadUtsnitt); rita(); }
      else if (a === 'stang') stang();
      else if (a === '3d' && opt.till3d) { stang(); opt.till3d(); }
    });
    function tangent(e) {
      if (rot.hidden) return;
      const el = document.activeElement, skriver = el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z' && !skriver) { e.preventDefault(); angra(); return; }
      if (ctrl && e.key.toLowerCase() === 'y' && !skriver) { e.preventDefault(); gorOm(); return; }
      if (e.key === 'F8') { e.preventDefault(); vaxla('ortho'); return; }
      if (e.key === 'F3') { e.preventDefault(); vaxla('snapp'); return; }
      if (skriver) return;
      if (e.key === ' ') { mellanslag = true; e.preventDefault(); return; }
      if (e.key === 'Escape') { if (S.ritar.length || S.vm) { S.vm = null; avbryt(); } else if (S.verktyg !== 'valj') satVerktyg('valj'); else if (S.vald) { S.vald = null; allt(); } else stang(); e.preventDefault(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && vald()) { e.preventDefault(); taBort(); return; }
      if (e.key === 'Enter' && S.verktyg === 'poly' && S.ritar.length >= 3) { e.preventDefault(); klarPoly(); return; }
      const v = { v: 'valj', r: 'rekt', p: 'poly', d: 'riktn', e: 'entre', l: 'lm', a: 'vridmot', t: 'ledare', g: 'trad', f: 'fast' }[e.key.toLowerCase()];
      if (!ctrl && !e.altKey && v) { satVerktyg(v); e.preventDefault(); return; }
      if (!ctrl && /^[0-9@.,\-<]$/.test(e.key)) kommando.focus();
    }
    function tangentUpp(e) { if (e.key === ' ') mellanslag = false; }
    document.addEventListener('keydown', tangent);
    document.addEventListener('keyup', tangentUpp);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => rita()) : null;
    if (ro) ro.observe(yta);

    /** Rutorna som ritningshuvudet m.m. täcker, på papperet (0.16.4, DF). Räknas om vid ändringar, inte vid varje musrörelse. */
    function raknaRamRutor() {
      if (!S.visa.ram) { S.ramRutor = []; return; }
      try {
        const smal = { kurvor: S.visa.kurvor && U.kurvor && U.kurvor.length ? [U.kurvor[0]] : null, trad: S.visa.trad ? S.trad.filter(t => !t.dolt).slice(0, 1) : null,
          vagar: S.visa.vagar ? U.vagar : null, skydd: S.visa.skydd ? U.skydd : null };
        S.ramRutor = SP().rutor(Object.assign({ volymer: S.volymer, granser, hus: synligaHus(), ytor: opt.ytor || [], visa: S.visa, ledare: S.ledare, underlag: smal,
          uppgifter: opt.uppgifter ? opt.uppgifter() : {}, zonNamn: opt.zonNamn }, S.ram)).rutor;
      } catch (e) { S.ramRutor = []; }
    }
    function allt() { raknaRamRutor(); rita(); ritaPanel(); prompt(); }
    let stangd = false;
    function stang() {
      if (stangd) return;
      stangd = true;
      document.removeEventListener('keydown', tangent);
      document.removeEventListener('keyup', tangentUpp);
      if (ro) ro.disconnect();
      rot.hidden = true;
      rot.innerHTML = '';
      if (opt.stangd) opt.stangd();
    }

    rot.hidden = false;
    // ritriktningen efter närmaste gräns om det finns en, annars rutnätet
    {
      const c = S.volymer.length ? tyngd(S.volymer[0].fotavtryck) : opt.utsnitt ? [(opt.utsnitt.xmin + opt.utsnitt.xmax) / 2, (opt.utsnitt.ymin + opt.utsnitt.ymax) / 2] : null;
      const str = c ? Kr.strackor(granser, c, 60).sort((a, b) => b.l - a.l) : [];
      if (str.length) { let a = Math.atan2(str[0].u[1], str[0].u[0]) / RAD; while (a > 45) a -= 90; while (a <= -45) a += 90; S.riktning = Math.round(a * 1e4) / 1e4; }
    }
    S.passadUtsnitt = !S.volymer.length;
    vaxlaKnapp('matt', S.visa.matt !== false);
    byggUnderlag();
    passa(true); satVerktyg('valj'); allt();
    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => { passa(true); rita(); });

    return {
      stang,
      volymer: () => S.volymer.map(kopia),
      /** För testerna: tillståndet och vyns omräkning. */
      _test: { S, w2s, s2w, rita, byggUnderlag },
    };
  }

  return { oppna };
}));
