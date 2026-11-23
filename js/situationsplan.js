// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Situationsplanen (0.16.0): det som planvyn, PDF:en och DXF:en har gemensamt.
 *
 *   enheter(volymer, { oppen })   Det som ritas som en byggnad: kroppar med samma status som går in i
 *                                 varandra eller ligger an blir ett yttre skal (unionen). Den markerade
 *                                 kroppens skal (oppen = kroppens id) delas upp i sina kroppar, så att de
 *                                 kan ändras var för sig.
 *   matt(volymer, granser, opt)   Måtten: till tomtgräns (nya och tillbyggnader), yttermått och mått mellan
 *                                 byggnader, räknade på enheterna. Dolda och flyttade mått ur kroppens fält
 *                                 matt (se nedan).
 *   ritning(data, { skala })      Hela planen som linjer, ytor och texter i zonens koordinater, med
 *                                 papperets mått (mm) för linjebredder och texthöjder. PDF och DXF ritar den.
 *   pdf(opt), dxf(opt)            Situationsplanen som vektor-PDF (A4/A3, ritningshuvud, teckenförklaring,
 *                                 norrpil och skalstock) och som DXF med ett lager per innehåll.
 *   ram(opt)                      Kartfältet i zonen för ett format och en skala.
 *
 * Kroppens fält matt (valfritt, 0.16.0): { "<enhet>|<mått>": { dold: true } | { off: meter } }. Enheten är
 * kropparnas id i bokstavsordning med +, måttet t.ex. g0 (första gränsmåttet), y|90|0 (yttermått, normalens
 * riktning och ordning) eller r|<annan enhet>|0. Fältet ligger på enhetens första kropp (i bokstavsordning).
 *
 * Kräver Kropp (och Utskrift, Dxf för pdf och dxf).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Situationsplan = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const g = n => (typeof globalThis !== 'undefined' && globalThis[n]) || (typeof window !== 'undefined' && window[n]) || null;
  const K = () => g('Kropp') || require('./kropp.js');
  const RAD = Math.PI / 180;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]], mul = (a, s) => [a[0] * s, a[1] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1], len = a => Math.hypot(a[0], a[1]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
  const perp = a => [-a[1], a[0]];
  const tyngd = p => mul(p.reduce((s, q) => add(s, q), [0, 0]), 1 / p.length);
  const fmt = (v, d = 2) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d).replace('.', ',');
  /** Mått med en decimal om det räcker (på millimetern när), annars två. */
  const mattText = v => (Math.abs(Math.round(v * 10) / 10 - v) < 0.0005 ? fmt(v, 1) : fmt(v, 2));
  const ORDNING = { rivs: 0, befintlig: 1, tillbyggnad: 2, ny: 3 };

  // ------------------------------------------------------------------
  // Enheterna
  // ------------------------------------------------------------------
  const enhetsId = ids => ids.slice().sort().join('+');
  /** Enheterna att rita och måttsätta. Varje enhet: { id, status, kroppar, ringar, yttre, agare, oppen, volymer }. */
  function enheter(volymer, opt = {}) {
    const Kr = K(), lista = (volymer || []).filter(v => v.fotavtryck && v.fotavtryck.length >= 3);
    const per = new Map(lista.map(v => [v.id, v]));
    const ut = [];
    for (const s of Kr.skal(lista)) {
      const vol = s.kroppar.map(id => per.get(id));
      if (opt.oppen != null && s.kroppar.length > 1 && s.kroppar.includes(opt.oppen)) {
        vol.forEach(v => ut.push({ id: enhetsId([v.id]), status: s.status, kroppar: [v.id], ringar: [Kr.moturs(v.fotavtryck)], yttre: Kr.moturs(v.fotavtryck), agare: v.id, oppen: true, skal: s.id, volymer: [v] }));
      } else {
        const ids = s.kroppar.slice().sort();
        ut.push({ id: enhetsId(s.kroppar), status: s.status, kroppar: s.kroppar, ringar: s.ringar, yttre: s.yttre, agare: ids[0], oppen: false, skal: s.id, volymer: vol });
      }
    }
    return ut;
  }
  /** Enheten som en kropp hör till. */
  const enhetFor = (enh, id) => enh.find(e => e.kroppar.includes(id)) || null;

  // ------------------------------------------------------------------
  // Måtten
  // ------------------------------------------------------------------
  /** Kroppens sida som en sida i skalet kan ändras genom: samma linje, och skalsidans slut i kroppssidans slut. */
  function sidaIKropp(e, s, tol = 0.005) {
    const Kr = K();
    for (const v of e.volymer) {
      for (const x of Kr.sidor(v.fotavtryck)) {
        if (dot(x.u, s.u) < 0.99999) continue;
        if (Math.abs(dot(sub(s.a, x.a), x.n)) > tol || Math.abs(dot(sub(s.b, x.a), x.n)) > tol) continue;
        if (len(sub(s.b, x.b)) > tol) continue;
        const ta = dot(sub(s.a, x.a), x.u);
        if (ta < -tol || ta > x.l + tol) continue;
        return { kropp: v.id, i: x.i, l: x.l };
      }
    }
    return null;
  }
  /** Nycklarna för yttermåtten: normalens riktning (hela grader) och ordningen bland sidor med samma riktning. */
  function sidnycklar(sd) {
    const ut = new Map(), grupp = new Map();
    sd.forEach(s => { const a = Math.round(((Math.atan2(s.n[1], s.n[0]) / RAD) % 360 + 360) % 360) % 360; if (!grupp.has(a)) grupp.set(a, []); grupp.get(a).push(s); });
    for (const [a, l] of grupp) l.sort((x, y) => dot(y.a, y.n) - dot(x.a, x.n)).forEach((s, k) => ut.set(s.i, `y|${a}|${k}`));
    return ut;
  }
  /**
   * Måtten för planen. opt: { oppen, visa: { grans, ytter, relativa } }.
   * Ger [{ typ: 'grans'|'sida'|'relativ', nyckel, agare, enhet, kroppar, fran, till, n, d, text, off, dold, andra }]:
   *   n    sidan som måttlinjen ligger åt (yttermått och mått mellan byggnader)
   *   off  sparad förskjutning i meter (eller null: ritas med standardavståndet)
   *   andra hur måttet ändras: { flytta: [dx, dy] per meter, kroppar } eller { kropp, i } (sidans längd), eller null
   */
  function matt(volymer, granser, opt = {}) {
    const Kr = K(), visa = Object.assign({ grans: true, ytter: true, relativa: true }, opt.visa || {});
    const enh = opt.enheter || enheter(volymer, opt);
    const per = new Map((volymer || []).map(v => [v.id, v]));
    const annot = (e, nyckel) => { const v = per.get(e.agare), a = v && v.matt && v.matt[`${e.id}|${nyckel}`]; return a || {}; };
    const ut = [];
    const pseudo = enh.map(e => ({ id: e.id, fotavtryck: e.yttre, e }));
    const gm = new Map();
    if (granser && granser.length) pseudo.forEach(p => {
      if (p.e.status !== 'ny' && p.e.status !== 'tillbyggnad') return;
      const m = Kr.gransmatt(p.fotavtryck, granser);
      gm.set(p.id, m);
      if (!visa.grans) return;
      m.forEach((x, k) => {
        const nyckel = 'g' + k, a = annot(p.e, nyckel);
        ut.push({ typ: 'grans', nyckel, agare: p.e.agare, enhet: p.e.id, kroppar: p.e.kroppar, fran: x.fran, till: x.till, d: x.d, text: mattText(x.d), off: null, dold: !!a.dold,
          andra: { flytta: norm(sub(x.fran, x.till)), kroppar: p.e.kroppar } });
      });
    });
    if (visa.ytter) pseudo.forEach(p => {
      if (p.e.status === 'rivs') return;
      const sd = Kr.sidor(p.fotavtryck), nyck = sidnycklar(sd);
      Kr.yttermattSidor(p, pseudo.filter(q => q.e.status !== 'rivs'), gm.get(p.id)).forEach(i => {
        const s = sd.find(x => x.i === i);
        if (!s) return;
        const nyckel = nyck.get(i), a = annot(p.e, nyckel);
        const andra = p.e.kroppar.length === 1 ? { kropp: p.e.kroppar[0], i: s.i } : sidaIKropp(p.e, s);
        ut.push({ typ: 'sida', nyckel, agare: p.e.agare, enhet: p.e.id, kroppar: p.e.kroppar, fran: s.a, till: s.b, n: s.n, d: s.l, text: mattText(s.l), off: a.off != null ? a.off : null, dold: !!a.dold, andra });
      });
    });
    if (visa.relativa) {
      const lista = pseudo.filter(q => q.e.status !== 'rivs');
      const raknare = new Map();
      Kr.relativaMatt(lista).forEach(r => {
        const e = lista.find(q => q.id === r.kropp).e, bas = `r|${r.mot}`, k = raknare.get(bas) || 0;
        raknare.set(bas, k + 1);
        const nyckel = `${bas}|${k}`, a = annot(e, nyckel);
        ut.push({ typ: 'relativ', nyckel, agare: e.agare, enhet: e.id, kroppar: e.kroppar, fran: r.fran, till: r.till, n: r.n, d: r.d, text: mattText(r.d), off: a.off != null ? a.off : null, dold: !!a.dold,
          andra: { flytta: norm(sub(r.ande, r.fast)), kroppar: e.kroppar } });
      });
    }
    return ut;
  }
  /** Sätter (eller tar bort) en anteckning för ett mått på kroppen som äger det. Ändrar volymen. */
  function satAnnot(volymer, m, varde) {
    const v = (volymer || []).find(x => x.id === m.agare);
    if (!v) return;
    const k = `${m.enhet}|${m.nyckel}`;
    v.matt = Object.assign({}, v.matt || {});
    if (varde == null) delete v.matt[k]; else v.matt[k] = varde;
    if (!Object.keys(v.matt).length) delete v.matt;
  }
  /** Tar bort dolda mått (alla, eller för en enhet). */
  function visaDolda(volymer) {
    for (const v of volymer || []) {
      if (!v.matt) continue;
      for (const [k, a] of Object.entries(v.matt)) if (a && a.dold) delete v.matt[k];
      if (!Object.keys(v.matt).length) delete v.matt;
    }
  }

  // ------------------------------------------------------------------
  // Etiketter
  // ------------------------------------------------------------------
  /** Etiketterna för en enhet: [{ p, vinkel (rad, läsbar), rader: [{ text, fet }], bredd (m, sidans längd), djup (m) }]. */
  function etiketter(e, volymer) {
    const Kr = K();
    const plats = (fot, p) => {
      const sd = Kr.sidor(fot).sort((a, b) => b.l - a.l)[0];
      let a = sd ? Math.atan2(sd.u[1], sd.u[0]) : 0;
      while (a > Math.PI / 2 + 1e-9) a -= Math.PI;
      while (a <= -Math.PI / 2 + 1e-9) a += Math.PI;
      const nn = sd ? perp(sd.u) : [0, 1];
      const djup = Math.max(...fot.map(q => Math.abs(dot(sub(q, fot[0]), nn))));
      return { p, vinkel: a, bredd: sd ? sd.l : 0, djup };
    };
    if (e.status === 'rivs') {
      const v = e.volymer.slice().sort((a, b) => Math.abs(Kr.area(b.fotavtryck)) - Math.abs(Kr.area(a.fotavtryck)))[0];
      return [Object.assign(plats(Kr.moturs(v.fotavtryck), tyngd(Kr.moturs(v.fotavtryck))), { rader: [{ text: 'RIVS', fet: true }] })];
    }
    const golv = e.volymer.map(v => v.golv).filter(x => x === x && x != null);
    const lika = golv.length === e.volymer.length && golv.every(x => Math.abs(x - golv[0]) < 0.005);
    const stor = e.volymer.slice().sort((a, b) => (b.huvudbyggnad - a.huvudbyggnad) || (Math.abs(Kr.area(b.fotavtryck)) - Math.abs(Kr.area(a.fotavtryck))));
    if (e.volymer.length === 1 || lika) {
      const v = stor[0], f = Kr.moturs(v.fotavtryck);
      return [Object.assign(plats(f, tyngd(f)), { rader: [{ text: (v.namn || '').toUpperCase(), fet: false }, { text: Kr.fgText(v, volymer), fet: true }] })];
    }
    // olika golv i samma byggnad: FG per kropp, i den del av kroppen som inte täcks av de andra; namnet i den största
    return stor.map((v, i) => {
      const f = Kr.moturs(v.fotavtryck), andra = e.volymer.filter(x => x !== v).map(x => Kr.moturs(x.fotavtryck));
      const pl = plats(f, tyngd(f)), fri = friDel(f, andra, pl.vinkel);
      if (fri) Object.assign(pl, fri);
      return Object.assign(pl, { rader: (i === 0 ? [{ text: (v.namn || '').toUpperCase(), fet: false }] : []).concat([{ text: Kr.fgText(v, volymer), fet: true }]) });
    });
  }
  /**
   * Mitten och utbredningen av den del av fotavtrycket f som inte ligger i någon av polygonerna andra, ungefär
   * (ett rutnät med 16 × 16 prov längs textens riktning). Ger { p, bredd, djup } eller null.
   */
  function friDel(f, andra, vinkel) {
    const Kr = K(), u = [Math.cos(vinkel), Math.sin(vinkel)], n = perp(u), N = 16;
    const lu = f.map(q => dot(q, u)), ln = f.map(q => dot(q, n));
    const u0 = Math.min(...lu), u1 = Math.max(...lu), n0 = Math.min(...ln), n1 = Math.max(...ln);
    const prov = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const a = u0 + (u1 - u0) * (i + 0.5) / N, b = n0 + (n1 - n0) * (j + 0.5) / N, p = add(mul(u, a), mul(n, b));
      if (Kr.inuti(f, p[0], p[1]) && !andra.some(o => Kr.inuti(o, p[0], p[1]))) prov.push({ p, a, b });
    }
    if (!prov.length) return null;
    // provens mitt, eller det prov som ligger närmast den om mitten hamnar utanför (en L-formad rest)
    const am = prov.reduce((s, q) => s + q.a, 0) / prov.length, bm = prov.reduce((s, q) => s + q.b, 0) / prov.length;
    let c = add(mul(u, am), mul(n, bm));
    if (!prov.some(q => len(sub(q.p, c)) < Math.max(u1 - u0, n1 - n0) / N)) c = prov.sort((x, y) => len(sub(x.p, c)) - len(sub(y.p, c)))[0].p;
    const as = prov.map(q => q.a), bs = prov.map(q => q.b);
    const bredd = (Math.max(...as) - Math.min(...as)) + (u1 - u0) / N, djup = (Math.max(...bs) - Math.min(...bs)) + (n1 - n0) / N;
    // texten längs den längre riktningen i den fria delen
    return djup > bredd * 1.15 ? { p: c, bredd: djup, djup: bredd, vinkel: lasbar(vinkel + Math.PI / 2) } : { p: c, bredd, djup };
  }

  // ------------------------------------------------------------------
  // Ritningen i zonens koordinater
  // ------------------------------------------------------------------
  /** Delarna av linjen genom p i riktningen u som ligger inuti ringarna (jämn–udda). */
  function klippLinje(p, u, ringar) {
    const ts = [];
    for (const r of ringar) for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length], s = sub(b, a), q = u[0] * s[1] - u[1] * s[0];
      if (Math.abs(q) < 1e-12) continue;
      const w = sub(a, p), t = (w[0] * s[1] - w[1] * s[0]) / q, v = (w[0] * u[1] - w[1] * u[0]) / q;
      if (v >= 0 && v < 1) ts.push(t);
    }
    ts.sort((a, b) => a - b);
    const ut = [];
    for (let i = 0; i + 1 < ts.length; i += 2) if (ts[i + 1] - ts[i] > 1e-6) ut.push([add(p, mul(u, ts[i])), add(p, mul(u, ts[i + 1]))]);
    return ut;
  }
  /** Skrafferingen (45° mot rutnätet) med avståndet steg (m). */
  function skraffering(ringar, steg) {
    const u = norm([1, 1]), n = perp(u), all = ringar.flat();
    const proj = all.map(q => dot(q, n)), lo = Math.min(...proj), hi = Math.max(...proj);
    const ut = [];
    for (let s = Math.ceil(lo / steg) * steg; s <= hi; s += steg) ut.push(...klippLinje(mul(n, s), u, ringar));
    return ut;
  }
  /**
   * Planen som primitiver. data: { volymer, granser, hus, ytor (fastigheternas beteckningar { etikett, ankare }),
   * ledare: [{ id, pts: [pil, text], text }] (0.16.1), underlag: { kurvor, trad, vagar, skydd } (0.16.1),
   * visa: { matt, grans, ytter, relativa, koord, koordlista, entre, kurvor, trad, vagar, skydd } }.
   * skala: 400 eller 500 (för texthöjder och avstånd).
   * Ger { linjer: [{ lager, pts, sluten, b (mm), streck, farg }], ytor: [{ lager, ringar, fyll }],
   *       texter: [{ lager, p, text, h (mm), vinkel (rad), ha, va, fet, mono, halo }], pilar: [{ lager, pts }],
   *       cirklar: [{ lager, p, r (m), b }], koordlista: [{ nr, x, y }] }.
   */
  function ritning(data, { skala = 400 } = {}) {
    const Kr = K(), mm = skala / 1000;
    const visa = Object.assign({ matt: true, grans: true, ytter: true, relativa: true, koord: false, koordlista: false, entre: true }, data.visa || {});
    const vol = (data.volymer || []).filter(v => v.fotavtryck && v.fotavtryck.length >= 3);
    const enh = enheter(vol).sort((a, b) => ORDNING[a.status] - ORDNING[b.status]);
    const R = { linjer: [], ytor: [], texter: [], pilar: [], cirklar: [], koordlista: [] };
    const linje = (lager, pts, b, o = {}) => R.linjer.push(Object.assign({ lager, pts, b }, o));
    const text = (lager, p, s, h, o = {}) => R.texter.push(Object.assign({ lager, p, text: String(s), h, vinkel: 0, ha: 'center', va: 'middle' }, o));
    // underlaget (0.16.1): höjdkurvor, vägar, skydd och träd under byggnaderna
    underlag(R, data.underlag || {}, visa, mm, linje, text);
    // befintliga hus från Lantmäteriet
    for (const h of data.hus || []) if (h.fotavtryck && h.fotavtryck.length >= 3) R.ytor.push({ lager: 'LMHUS', ringar: [h.fotavtryck], fyll: 'lmhus', kant: 0.18 });
    // byggnaderna
    for (const e of enh) {
      const lager = e.status.toUpperCase();
      const yta = { lager, ringar: e.ringar, fyll: e.status, kant: e.status === 'ny' || e.status === 'tillbyggnad' ? 0.5 : 0.25, streck: e.status === 'rivs' ? 'rivs' : null };
      R.ytor.push(yta);
      const marken = [];
      for (const v of e.volymer) {
        // kryss, nock och skärmtak med indrag från hörnen (0.16.1); ritas efter texterna, som de lämnar plats för
        if (e.status !== 'rivs') for (const l of Kr.planmarke(v, 1.5 * mm)) marken.push([Kr.slag(v) === 'huvud' ? 'KRYSS' : Kr.slag(v) === 'komplement' ? 'NOCK' : 'SKARMTAK', l]);
        if (visa.entre && v.entre && e.status !== 'rivs') {
          const p = Kr.entrePunkt(v);
          if (p) {
            const u = perp(p.n), tip = add(p.p, mul(p.n, 0.6 * mm)), bas = add(p.p, mul(p.n, 4.5 * mm));
            R.pilar.push({ lager: 'ENTRE', pts: [tip, add(bas, mul(u, 1.8 * mm)), sub(bas, mul(u, 1.8 * mm))] });
          }
        }
      }
      const rutor = [];
      for (const et of etiketter(e, vol)) {
        const nn = [-Math.sin(et.vinkel), Math.cos(et.vinkel)], rad = et.rader.filter(r => r.text);
        // namnet bara om det får plats i byggnaden (ungefär 0,55 × höjden per tecken); FG och RIVS alltid,
        // med en vit kant om de inte ryms
        const passar = r => r.text.length * (r.fet ? 2.6 : 2.0) * 0.55 * mm < et.bredd - 1 * mm;
        const ryms = et.djup >= (rad.length > 1 ? 6 : 3.2) * mm;
        const synliga = rad.filter(r => r.fet || (passar(r) && ryms && rad.filter(x => x.fet).every(passar)));
        const rh = 3.2 * mm, y0 = (synliga.length - 1) / 2 * rh;
        // en nock genom etikettens mitt: texten flyttas till sidan av den (0.16.1)
        const skift = sidanOmNock(et.p, nn, marken.filter(m => m[0] === 'NOCK').map(m => m[1]), (synliga.length * rh) / 2 + 0.6 * mm);
        synliga.forEach((r, i) => {
          const p = add(add(et.p, skift), mul(nn, y0 - i * rh)), hh = r.fet ? 2.6 : 2.0;
          text('ETIKETT', p, r.text, hh, { vinkel: et.vinkel, fet: r.fet, halo: !passar(r) || et.djup < 3.2 * mm });
          rutor.push({ p, vinkel: et.vinkel, b: r.text.length * hh * 0.6 * mm + 1.6 * mm, h: hh * 1.5 * mm });
        });
      }
      for (const [lager, l] of marken) for (const del of utanforRutor([l], rutor)) linje(lager, del, 0.18);
      // skrafferingen lämnar plats för texterna, så att de går att läsa (0.16.1)
      if (e.status === 'tillbyggnad') {
        const sk = utanforRutor(skraffering(e.ringar, 1.2 * mm), rutor);
        yta.skraff = sk;
        sk.forEach(s => linje('SKRAFF', s, 0.13));
      }
      if (visa.koord && !visa.koordlista && (e.status === 'ny' || e.status === 'tillbyggnad')) {
        const c = tyngd(e.yttre);
        for (const r of e.ringar) for (const q of hornOrdning(r)) {
          const d = norm(sub(q, c));
          {
            const t = add(q, mul(d, 7 * mm));
            text('KOORD', add(t, [0, 1.1 * mm]), 'N ' + fmt(q[1], 2), 1.7, { mono: true, halo: true });
            text('KOORD', sub(t, [0, 1.1 * mm]), 'E ' + fmt(q[0], 2), 1.7, { mono: true, halo: true });
          }
        }
      }
    }
    // numrerade hörn och en koordinatlista (0.16.1): nya byggnader först, sedan tillbyggnader
    if (visa.koordlista) for (const h of numreradeHorn(enh)) {
      R.koordlista.push({ nr: h.nr, x: h.p[0], y: h.p[1] });
      text('KOORDNR', add(h.p, mul(h.ut, 2.6 * mm)), String(h.nr), 2.0, { fet: true, halo: true });
    }
    // fastighetsgränser och beteckningar ovanpå byggnaderna, så att ingen byggnad skymmer en gräns (0.16.1)
    for (const gr of data.granser || []) { const pts = gr.pts || gr; if (pts.length >= 2) linje('GRANS', pts, 0.35, { streck: 'grans' }); }
    for (const y of data.ytor || []) if (y.ankare && y.etikett) text('FASTIGHET', y.ankare, y.etikett, 3.2, { halo: true });
    // måtten
    if (visa.matt !== false) for (const m of matt(vol, data.granser, { visa })) {
      if (m.dold) continue;
      if (m.typ === 'grans') {
        const d = norm(sub(m.till, m.fran)), n = perp(d), tk = mul(norm(add(d, n)), 0.9 * mm);
        linje('MATT', [m.fran, m.till], 0.13);
        linje('MATT', [sub(m.fran, tk), add(m.fran, tk)], 0.25); linje('MATT', [sub(m.till, tk), add(m.till, tk)], 0.25);
        text('MATTEXT', add(mul(add(m.fran, m.till), 0.5), mul(n, 1.4 * mm)), m.text, 2.2, { vinkel: lasbar(Math.atan2(d[1], d[0])), halo: true });
      } else {
        const off = m.off != null ? m.off : 4 * mm, u = norm(sub(m.till, m.fran)), n = m.n;
        const a2 = add(m.fran, mul(n, off)), b2 = add(m.till, mul(n, off)), tk = mul(norm(add(u, n)), 0.9 * mm);
        linje('MATT', [add(m.fran, mul(n, 0.8 * mm)), add(m.fran, mul(n, off + 1.2 * mm))], 0.13);
        linje('MATT', [add(m.till, mul(n, 0.8 * mm)), add(m.till, mul(n, off + 1.2 * mm))], 0.13);
        linje('MATT', [a2, b2], 0.13);
        linje('MATT', [sub(a2, tk), add(a2, tk)], 0.25); linje('MATT', [sub(b2, tk), add(b2, tk)], 0.25);
        text('MATTEXT', add(mul(add(a2, b2), 0.5), mul(n, 1.4 * mm)), m.text, 2.2, { vinkel: lasbar(Math.atan2(u[1], u[0])) });
      }
    }
    // ledare med fritext (0.16.1)
    for (const l of data.ledare || []) {
      const g = ledarGeometri(l, mm);
      if (!g) continue;
      linje('LEDARE', g.linje, 0.18);
      R.pilar.push({ lager: 'LEDARE', pts: g.pil });
      text('LEDARTEXT', g.textP, l.text, 2.2, { ha: g.ha, halo: true });
    }
    return R;
  }
  /**
   * Hur långt en etikett i p (tvärs riktningen nn) ska flyttas för att inte ligga på en nock (0.16.1):
   * [0, 0] om ingen nock går nära p, annars nn × halv (åt det håll som är närmast).
   */
  function sidanOmNock(p, nn, nockar, halv) {
    for (const [a, b] of nockar) {
      const e = sub(b, a), l2 = dot(e, e);
      if (!l2) continue;
      const t = dot(sub(p, a), e) / l2;
      if (t < 0 || t > 1) continue;
      const d = dot(sub(p, add(a, mul(e, t))), nn);
      if (Math.abs(d) < halv) return mul(nn, (d >= 0 ? 1 : -1) * halv - d);
    }
    return [0, 0];
  }
  /**
   * Ledarens linje, pil och textens läge (0.16.1). l = { pts: [pil, text], text }. mm = meter per mm på papperet.
   * Linjen går från pilen till textpunkten och sedan en kort vågrät bit åt det håll texten står.
   */
  function ledarGeometri(l, mm) {
    if (!l || !l.text || !Array.isArray(l.pts) || l.pts.length < 2) return null;
    const [a, b] = l.pts, d = sub(b, a), L = len(d);
    if (L < 1e-6) return null;
    const hoger = d[0] >= 0, hylla = add(b, [(hoger ? 1 : -1) * 2 * mm, 0]), u = mul(d, 1 / L), w = perp(u);
    const s = Math.min(1.6 * mm, L / 3), tip = a, bas = add(a, mul(u, 2.4 * mm > L / 2 ? L / 2 : 2.4 * mm));
    return {
      linje: [a, b, hylla],
      pil: [tip, add(bas, mul(w, s / 2.4)), sub(bas, mul(w, s / 2.4))],
      textP: add(hylla, [(hoger ? 1 : -1) * 0.8 * mm, 0]), ha: hoger ? 'left' : 'right',
    };
  }
  /**
   * Hörnen att numrera i koordinatlistan (0.16.1): nya byggnader först, sedan tillbyggnader, varje ring medurs
   * från det nordvästligaste hörnet. enh = enheter(…) eller volymerna. Ger [{ nr, p, ut (riktning från mitten) }].
   */
  function numreradeHorn(enh) {
    if (enh.length && enh[0].fotavtryck) enh = enheter(enh);
    const ut = [];
    for (const st of ['ny', 'tillbyggnad']) for (const e of enh.filter(x => x.status === st)) {
      const c = tyngd(e.yttre);
      for (const r of e.ringar) for (const q of hornOrdning(r)) ut.push({ nr: ut.length + 1, p: q, ut: norm(sub(q, c)) });
    }
    return ut;
  }
  /** Hörnen medurs från det nordvästligaste, som en koordinatlista brukar vara (0.16.1). */
  function hornOrdning(r) {
    const p = K().area(r) > 0 ? r.slice().reverse() : r.slice();
    let i0 = 0;
    p.forEach((q, i) => { if (q[1] - q[0] > p[i0][1] - p[i0][0] + 1e-9) i0 = i; });
    return p.slice(i0).concat(p.slice(0, i0));
  }
  /** Delarna av sträckorna som ligger utanför rutorna { p, vinkel, b, h } (0.16.1). */
  function utanforRutor(strackor, rutor) {
    if (!rutor.length) return strackor;
    let ut = strackor;
    for (const r of rutor) {
      const u = [Math.cos(r.vinkel), Math.sin(r.vinkel)], n = perp(u), hb = r.b / 2, hh = r.h / 2, nya = [];
      for (const [a, b] of ut) {
        // rutans koordinater: s längs texten, t tvärs
        const sa = dot(sub(a, r.p), u), ta = dot(sub(a, r.p), n), sb = dot(sub(b, r.p), u), tb = dot(sub(b, r.p), n);
        let t0 = 0, t1 = 1;
        for (const [p0, dp, lo, hi] of [[sa, sb - sa, -hb, hb], [ta, tb - ta, -hh, hh]]) {
          if (Math.abs(dp) < 1e-12) { if (p0 < lo || p0 > hi) { t0 = 1; t1 = 0; } continue; }
          let x0 = (lo - p0) / dp, x1 = (hi - p0) / dp;
          if (x0 > x1) [x0, x1] = [x1, x0];
          t0 = Math.max(t0, x0); t1 = Math.min(t1, x1);
        }
        if (t0 >= t1) { nya.push([a, b]); continue; }
        const P = t => add(a, mul(sub(b, a), t));
        if (t0 > 1e-6) nya.push([a, P(t0)]);
        if (t1 < 1 - 1e-6) nya.push([P(t1), b]);
      }
      ut = nya;
    }
    return ut;
  }
  /** Underlaget på ritningen (0.16.1): det som är ikryssat och finns. */
  function underlag(R, u, visa, mm, linje, text) {
    if (visa.kurvor && u.kurvor && u.kurvor.length) {
      const B = { HOJDKURVA_10M: 0.3, HOJDKURVA_5M: 0.22, HOJDKURVA_1M: 0.13, HOJDKURVA_0_5M: 0.09, HOJDKURVA_0_25M: 0.07 };
      const harHel = u.kurvor.some(k => k.lager === 'HOJDKURVA_1M' || k.lager === 'HOJDKURVA_5M' || k.lager === 'HOJDKURVA_10M');
      for (const k of u.kurvor) {
        if (!k.pts || k.pts.length < 2) continue;
        linje('KURVA', k.pts, B[k.lager] || 0.1, { sluten: !!k.sluten, farg: 'kurva' });
        // en siffra per hel meter-kurva, där kurvan är tillräckligt lång
        if (k.h == null || (harHel && k.lager !== 'HOJDKURVA_1M' && k.lager !== 'HOJDKURVA_5M' && k.lager !== 'HOJDKURVA_10M')) continue;
        let tot = 0;
        for (let i = 1; i < k.pts.length; i++) tot += len(sub(k.pts[i], k.pts[i - 1]));
        if (tot < 40 * mm) continue;
        let acc = 0;
        for (let i = 1; i < k.pts.length; i++) {
          const a = k.pts[i - 1], b = k.pts[i], l = len(sub(b, a));
          if (acc + l >= tot / 2) {
            const p = add(a, mul(sub(b, a), l ? (tot / 2 - acc) / l : 0));
            text('KURVTEXT', p, fmt(k.h, k.h % 1 ? 1 : 0), 1.8, { vinkel: lasbar(Math.atan2(b[1] - a[1], b[0] - a[0])), halo: true, farg: 'kurva' });
            break;
          }
          acc += l;
        }
      }
    }
    if (visa.vagar && u.vagar) {
      const ytor = u.vagar.ytor ? (u.vagar.ytor.bil || []).concat(u.vagar.ytor.gang || []) : [];
      if (ytor.length) for (const p of ytor) R.ytor.push({ lager: 'VAG', ringar: p.ringar, fyll: 'vag', kant: 0.18 });
      else for (const l of u.vagar.linjer || []) if (l.pts && l.pts.length >= 2) linje('VAG', l.pts, l.slag === 'gang' ? 0.13 : 0.25, { streck: l.slag === 'gang' ? 'gang' : null, farg: 'vag' });
    }
    if (visa.skydd && u.skydd) {
      const s = u.skydd;
      if (s.strand && s.strand.zoner) {
        for (const p of s.strand.zoner.m100 || []) linje('STRAND', p, 0.3, { farg: 'strand' });
        for (const p of s.strand.zoner.m300 || []) linje('STRAND', p, 0.25, { streck: 'strand', farg: 'strand' });
      }
      for (const o of Array.isArray(s.natur) ? s.natur : []) for (const r of o.ringar || []) {
        linje('NATUR', r.concat([r[0]]), 0.3, { streck: 'natur', farg: 'natur' });
      }
      for (const l of Array.isArray(s.lamningar) ? s.lamningar : []) if (l.x != null) {
        R.cirklar.push({ lager: 'LAMNING', p: [l.x, l.y], r: 1.1 * mm, b: 0.25, farg: 'lamning' });
        text('LAMNING', [l.x + 1.6 * mm, l.y], l.klass || 'Lämning', 1.7, { ha: 'left', halo: true, farg: 'lamning' });
      }
    }
    if (visa.trad && u.trad) for (const t of u.trad) {
      if (t.dolt || !(t.krona > 0)) continue;
      R.cirklar.push({ lager: 'TRAD', p: [t.x, t.y], r: t.krona / 2, b: 0.18, farg: 'trad' });
      linje('TRAD', [[t.x - 0.5 * mm, t.y], [t.x + 0.5 * mm, t.y]], 0.13, { farg: 'trad' });
      linje('TRAD', [[t.x, t.y - 0.5 * mm], [t.x, t.y + 0.5 * mm]], 0.13, { farg: 'trad' });
    }
  }
  function lasbar(a) {
    while (a > Math.PI / 2 + 1e-9) a -= Math.PI;
    while (a <= -Math.PI / 2 + 1e-9) a += Math.PI;
    return a;
  }

  // ------------------------------------------------------------------
  // Papperet
  // ------------------------------------------------------------------
  const FORMAT = { a4: [297, 210], a3: [420, 297] };
  const MARG = 10, VMARG = 20;   // vänster marginal för pärm
  const papper = (format, liggande) => { const [a, b] = FORMAT[format] || FORMAT.a3; return liggande ? [a, b] : [b, a]; };
  /** Kartfältet på papperet (mm) och i zonen. centrum hamnar mitt i fältet ovanför ritningshuvudet. */
  function ram({ format = 'a3', liggande = true, skala = 400, centrum }) {
    const [PW, PH] = papper(format, liggande), k = 1000 / skala;
    const f = { x: VMARG, y: MARG, w: PW - VMARG - MARG, h: PH - 2 * MARG };
    const c = centrum || [0, 0], my = f.y + f.h / 2 - 12;   // lite ovanför mitten: ritningshuvudet ligger nere till höger
    const x0 = c[0] - (f.x + f.w / 2 - f.x) / k, y1 = c[1] + (my - f.y) / k;
    return { papper: [PW, PH], falt: f, k, zon: { xmin: x0, xmax: x0 + f.w / k, ymax: y1, ymin: y1 - f.h / k } };
  }
  /** Mitten av byggnaderna (eller utsnittets mitt). */
  function mitt(volymer, utsnitt) {
    const pts = (volymer || []).flatMap(v => v.fotavtryck || []);
    if (!pts.length) return utsnitt ? [(utsnitt.xmin + utsnitt.xmax) / 2, (utsnitt.ymin + utsnitt.ymax) / 2] : [0, 0];
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  }

  const FARG = { blck: [23, 25, 27], gra: [94, 98, 102], grans: [23, 25, 27], lmhus: [222, 220, 216], ny: [205, 205, 205], befintlig: [255, 255, 255], annot: [232, 85, 40],
    // underlaget (0.16.1)
    kurva: [160, 120, 80], vag: [120, 122, 125], vagyta: [236, 234, 229], strand: [40, 105, 170], natur: [40, 125, 70], lamning: [140, 60, 130], trad: [70, 125, 65] };
  const STRECK = { grans: [4, 0.8, 0.6, 0.8], rivs: [1.6, 1], gang: [1, 0.8], strand: [3, 1.5], natur: [3, 1, 0.6, 1] };
  const TECKEN = [
    ['ny', 'Ny byggnad'], ['tillbyggnad', 'Tillbyggnad'], ['befintlig', 'Befintlig byggnad'], ['rivs', 'Byggnad som rivs'],
    ['lmhus', 'Befintlig byggnad (Lantmäteriet)'], ['grans', 'Fastighetsgräns'], ['kryss', 'Huvudbyggnad'], ['nock', 'Komplementbyggnad'], ['skarmtak', 'Skärmtak'],
    ['entre', 'Entré'], ['matt', 'Mått i meter'],
    ['kurva', 'Höjdkurva (RH 2000)'], ['vag', 'Väg (OpenStreetMap)'], ['trad', 'Träd (laserdata)'], ['strand', 'Strandskydd 100 och 300 m (indikation)'],
    ['natur', 'Skyddad natur'], ['lamning', 'Lämning (Kulturmiljöregistret)'], ['ledare', 'Anteckning'],
  ];
  /** Lagren som ligger under byggnaderna (0.16.1). */
  const UNDER = new Set(['KURVA', 'KURVTEXT', 'VAG', 'STRAND', 'NATUR', 'TRAD', 'LAMNING']);

  /**
   * Situationsplanen som PDF. opt: { format, liggande, skala, centrum, volymer, granser, hus, ytor, visa,
   *   uppgifter: { fastighet, kommun, uppdrag, ritadAv, ritningsnummer, datum }, zonNamn, fonter, kallor }.
   * Ger en ArrayBuffer.
   */
  function pdf(opt) {
    const U = g('Utskrift') || require('./utskrift.js');
    const { format = 'a3', liggande = true, skala = 400 } = opt;
    const rm = ram({ format, liggande, skala, centrum: opt.centrum || mitt(opt.volymer) });
    const [PW, PH] = rm.papper, f = rm.falt, k = rm.k, z = rm.zon;
    const { doc, font, mono } = U.nyttDokument(format, liggande, opt.fonter);
    const up = opt.uppgifter || {};
    doc.setProperties({ title: `Situationsplan ${up.fastighet || ''} 1:${skala}`.trim(), creator: 'Höjdkurvor' });
    const P = q => [f.x + (q[0] - z.xmin) * k, f.y + (z.ymax - q[1]) * k];
    const L = (pts, stang) => { const [a, b] = P(pts[0]); doc.moveTo(a, b); for (let i = 1; i < pts.length; i++) { const [x, y] = P(pts[i]); doc.lineTo(x, y); } if (stang) doc.close(); };
    const pt = h => h / 0.3528;   // mm → punkter
    const skrift = (s, x, y, h, o = {}) => {
      doc.setFont(o.mono ? mono : font, o.mono ? 'normal' : (o.fet ? 'bold' : 'normal')); doc.setFontSize(o.pt || pt(h));
      const arg = { align: o.ha || 'left', baseline: o.va || 'middle', angle: o.vinkel || 0 };
      if (o.halo) {
        doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.6);
        doc.text(String(s), x, y, Object.assign({ renderingMode: 'stroke' }, arg));
      }
      doc.setTextColor(...(o.farg || FARG.blck));
      doc.text(String(s), x, y, Object.assign({ renderingMode: 'fill' }, arg));
    };
    const R = ritning(opt, { skala });
    const fargAv = n => (n && FARG[n]) || FARG.blck;
    const ritaLinje = l => {
      doc.setDrawColor(...fargAv(l.farg)); doc.setLineWidth(l.b); doc.setLineDashPattern(l.streck ? STRECK[l.streck] : [], 0);
      L(l.pts, l.sluten); doc.stroke();
    };
    const ritaText = t => { const [x, y] = P(t.p); skrift(t.text, x, y, t.h, { ha: t.ha, va: t.va, vinkel: t.vinkel / RAD, fet: t.fet, mono: t.mono, halo: t.halo, farg: t.farg ? fargAv(t.farg) : null }); };

    doc.saveGraphicsState(); doc.rect(f.x, f.y, f.w, f.h, null); doc.clip(); doc.discardPath();
    // underlaget först (0.16.1): vägytor, linjer, träd och deras texter, under byggnaderna
    for (const y of R.ytor) if (y.fyll === 'vag') {
      doc.setLineWidth(y.kant); doc.setDrawColor(...FARG.vag); doc.setFillColor(...FARG.vagyta); doc.setLineDashPattern([], 0);
      y.ringar.forEach(r => L(r, true)); doc.fillStrokeEvenOdd();
    }
    for (const l of R.linjer) if (UNDER.has(l.lager)) ritaLinje(l);
    doc.setLineDashPattern([], 0);
    for (const c of R.cirklar) {
      const [x, y] = P(c.p);
      doc.setDrawColor(...fargAv(c.farg)); doc.setLineWidth(c.b); doc.circle(x, y, c.r * k, 'S');
    }
    for (const t of R.texter) if (UNDER.has(t.lager)) ritaText(t);
    // ytorna: hus och byggnader
    for (const y of R.ytor) {
      if (y.fyll === 'vag') continue;
      const fyll = y.fyll === 'lmhus' ? FARG.lmhus : y.fyll === 'ny' ? FARG.ny : y.fyll === 'tillbyggnad' || y.fyll === 'befintlig' ? FARG.befintlig : null;
      doc.setLineWidth(y.kant); doc.setDrawColor(...(y.fyll === 'lmhus' ? FARG.gra : FARG.blck));
      doc.setLineDashPattern(y.streck ? STRECK[y.streck] : [], 0);
      y.ringar.forEach(r => L(r, true));
      if (fyll) { doc.setFillColor(...fyll); doc.fillStrokeEvenOdd(); } else doc.stroke();
      // skrafferingen ritas direkt efter tillbyggnadens yta, före konturen ovanpå
      if (y.fyll === 'tillbyggnad') {
        doc.setLineDashPattern([], 0); doc.setLineWidth(0.13);
        (y.skraff || []).forEach(l => { L(l, false); doc.stroke(); });
        doc.setLineWidth(y.kant); y.ringar.forEach(r => L(r, true)); doc.stroke();
      }
    }
    doc.setLineDashPattern([], 0);
    for (const l of R.linjer) if (l.lager !== 'SKRAFF' && !UNDER.has(l.lager)) ritaLinje(l);
    doc.setLineDashPattern([], 0);
    doc.setFillColor(...FARG.blck);
    for (const a of R.pilar) { const [p, q, r] = a.pts.map(P); doc.triangle(p[0], p[1], q[0], q[1], r[0], r[1], 'F'); }
    for (const t of R.texter) if (!UNDER.has(t.lager)) ritaText(t);
    doc.restoreGraphicsState();
    doc.setDrawColor(...FARG.blck); doc.setLineWidth(0.35); doc.rect(f.x, f.y, f.w, f.h, 'S');

    // norrpil (rutnätets nord)
    const nx = f.x + f.w - 12, ny = f.y + 18;
    doc.setFillColor(...FARG.blck); doc.setDrawColor(...FARG.blck); doc.setLineWidth(0.25);
    doc.triangle(nx, ny - 10, nx - 3.2, ny + 2, nx, ny, 'F'); doc.triangle(nx, ny - 10, nx + 3.2, ny + 2, nx, ny, 'S');
    skrift('N', nx, ny - 12.5, 0, { pt: 10, fet: true, ha: 'center' });

    // ritningshuvudet nere till höger, teckenförklaringen ovanför
    const bw = Math.min(118, f.w * 0.45), bx = f.x + f.w - bw;
    const tOvre = tecken(doc, skrift, R, bx, bw, ritningshuvud(doc, skrift, font, opt, bx, bw, f, skala, format));
    koordinatlista(doc, skrift, R.koordlista, bx, bw, tOvre, f, opt.zonNamn);
    // upplysningen och skalstocken nere till vänster
    const upp = [
      'Fastighetsgränser och byggnader ur Lantmäteriets fastighetsindelning och byggnadsskikt (© Lantmäteriet, CC BY 4.0).',
      'Gränserna är inte juridiskt säkerställda. Kontrollera med kommunen vilket kartunderlag som krävs.',
      `Hörnkoordinater i ${opt.zonNamn || 'arbetszonen'}, höjder i RH 2000. FG = färdigt golv. Mått i meter.`,
    ].concat(opt.kallor ? [opt.kallor] : []);
    doc.setFont(font, 'normal'); doc.setFontSize(6.2);
    const uw = Math.max(60, f.w - bw - 12), rader = upp.flatMap(s => doc.splitTextToSize(s, uw - 4));
    const uh = 3.2 + rader.length * 2.8, ux = f.x, uy = f.y + f.h - uh;
    doc.setFillColor(255, 255, 255); doc.setDrawColor(...FARG.blck); doc.setLineWidth(0.25); doc.rect(ux, uy, uw, uh, 'FD');
    rader.forEach((r, i) => skrift(r, ux + 2, uy + 2.6 + i * 2.8, 0, { pt: 6.2, farg: FARG.gra }));
    // skalstock: 4 delar à 2, 5 eller 10 m
    const steg = [2, 5, 10, 20].find(s => s * 4 * k >= 30) || 20, sx = ux + 4, sy = uy - 7;
    doc.setFillColor(255, 255, 255); doc.rect(sx - 3, sy - 4.5, 4 * steg * k + 12, 10.5, 'F');
    doc.setLineWidth(0.2); doc.setDrawColor(...FARG.blck);
    for (let i = 0; i < 4; i++) { doc.setFillColor(...(i % 2 ? [255, 255, 255] : FARG.blck)); doc.rect(sx + i * steg * k, sy, steg * k, 1.4, 'FD'); }
    for (const i of [0, 2, 4]) skrift(String(i * steg), sx + i * steg * k, sy - 1.2, 0, { pt: 6, mono: true, ha: 'center', va: 'bottom' });
    skrift(`m   Skala 1:${skala} (${format.toUpperCase()})`, sx + 4 * steg * k + 3, sy - 1.2, 0, { pt: 6, mono: true, va: 'bottom' });
    skrift('Skriv ut i verklig storlek (100 %). Kontrollera skalan med skalstocken.', f.x, PH - MARG + 4.5, 0, { pt: 6, farg: FARG.gra });
    return doc.output('arraybuffer');
  }
  /** Ritningshuvudet. Ger överkanten (mm). */
  function ritningshuvud(doc, skrift, font, opt, bx, bw, f, skala, format) {
    const U = g('Utskrift') || require('./utskrift.js');
    const up = opt.uppgifter || {}, b = K().bya(opt.volymer || []);
    const rad = (etikett, varde) => [etikett, varde == null || varde === '' ? '–' : String(varde)];
    const falt = [
      rad('Fastighet', up.fastighet), rad('Kommun', up.kommun), rad('Åtgärd', up.uppdrag),
      rad('Skala', `1:${skala} (${format.toUpperCase()})`), rad('Datum', up.datum), rad('Ritad av', up.ritadAv), rad('Ritningsnummer', up.ritningsnummer),
      rad('Koordinatsystem', `${opt.zonNamn || ''}, RH 2000`.replace(/^, /, '')),
      rad('Byggnadsarea', `tillkommande ${fmt(b.tillkommande, 1)} m², befintlig ${fmt(b.befintlig, 1)} m², totalt ${fmt(b.totalt, 1)} m²`),
    ];
    doc.setFontSize(7);
    const vw = bw - 30, varden = falt.map(([, v]) => doc.splitTextToSize(v, vw - 2));
    const bh = 13 + varden.reduce((s, v) => s + v.length * 3.1 + 0.6, 0) + 8, by = f.y + f.h - bh;
    doc.setFillColor(255, 255, 255); doc.setDrawColor(23, 25, 27); doc.setLineWidth(0.35); doc.rect(bx, by, bw, bh, 'FD');
    skrift('SITUATIONSPLAN', bx + 3, by + 6, 0, { pt: 13, fet: true });
    doc.setLineWidth(0.15); doc.line(bx, by + 10.5, bx + bw, by + 10.5);
    let y = by + 14;
    falt.forEach(([e], i) => {
      skrift(e, bx + 3, y, 0, { pt: 6, farg: FARG.gra });
      varden[i].forEach((r, j) => skrift(r, bx + 28, y + j * 3.1, 0, { pt: 7, fet: i === 0 }));
      y += varden[i].length * 3.1 + 0.6;
    });
    U.marke(doc, bx + 3, by + bh - 6.8, 4.6, U.F.blck, U.F.annot);
    doc.setFontSize(8); doc.setFont(font, 'bold');
    U.ordbild(doc, bx + 9, by + bh - 3.8);
    return by;
  }
  /** Teckenförklaringen ovanför ritningshuvudet, bara det som finns på planen. Ger överkanten. */
  function tecken(doc, skrift, R, bx, bw, botten) {
    const finns = new Set();
    R.ytor.forEach(y => finns.add(y.fyll));
    if (R.linjer.some(l => l.lager === 'GRANS')) finns.add('grans');
    for (const [lager, id] of [['KRYSS', 'kryss'], ['NOCK', 'nock'], ['SKARMTAK', 'skarmtak'], ['MATT', 'matt'], ['KURVA', 'kurva'], ['VAG', 'vag'], ['STRAND', 'strand'], ['NATUR', 'natur'], ['LEDARE', 'ledare']]) {
      if (R.linjer.some(l => l.lager === lager)) finns.add(id);
    }
    if (R.ytor.some(y => y.fyll === 'vag')) finns.add('vag');
    if (R.cirklar.some(c => c.lager === 'TRAD')) finns.add('trad');
    if (R.cirklar.some(c => c.lager === 'LAMNING')) finns.add('lamning');
    if (R.pilar.some(p => p.lager === 'ENTRE')) finns.add('entre');
    const rader = TECKEN.filter(([id]) => finns.has(id));
    if (!rader.length) return botten;
    // två spalter när det blir många rader (0.16.1)
    const tva = rader.length > 9, per = tva ? Math.ceil(rader.length / 2) : rader.length;
    const h = 5 + per * 4, y0 = botten - h;
    doc.setFillColor(255, 255, 255); doc.setDrawColor(23, 25, 27); doc.setLineWidth(0.25); doc.rect(bx, y0, bw, h, 'FD');
    let y = y0 + 4.2;
    for (const [k, [id, t]] of rader.entries()) {
      const x = bx + 3 + (tva && k >= per ? bw / 2 : 0);
      if (tva && k === per) y = y0 + 4.2;
      doc.setLineDashPattern([], 0); doc.setDrawColor(23, 25, 27);
      if (['ny', 'tillbyggnad', 'befintlig', 'rivs', 'lmhus'].includes(id)) {
        doc.setLineWidth(id === 'ny' || id === 'tillbyggnad' ? 0.5 : id === 'lmhus' ? 0.18 : 0.25);
        if (id === 'rivs') doc.setLineDashPattern(STRECK.rivs, 0);
        if (id === 'lmhus') doc.setDrawColor(...FARG.gra);
        const fyll = id === 'ny' ? FARG.ny : id === 'lmhus' ? FARG.lmhus : id === 'rivs' ? null : FARG.befintlig;
        if (fyll) { doc.setFillColor(...fyll); doc.rect(x, y - 1.3, 8, 2.6, 'FD'); } else doc.rect(x, y - 1.3, 8, 2.6, 'S');
        if (id === 'tillbyggnad') { doc.setLineWidth(0.13); for (let s = -2; s < 8; s += 1.2) { const a = Math.max(0, -s), b = Math.min(2.6, 8 - s); if (b > a) doc.line(x + s + a, y + 1.3 - a, x + s + b, y + 1.3 - b); } }
        doc.setLineDashPattern([], 0);
      } else if (id === 'grans') { doc.setLineWidth(0.35); doc.setLineDashPattern(STRECK.grans, 0); doc.line(x, y, x + 8, y); doc.setLineDashPattern([], 0); }
      else if (id === 'kryss') { doc.setLineWidth(0.5); doc.rect(x, y - 1.3, 8, 2.6, 'S'); doc.setLineWidth(0.18); doc.line(x + 0.8, y - 1.0, x + 7.2, y + 1.0); doc.line(x + 0.8, y + 1.0, x + 7.2, y - 1.0); }
      else if (id === 'nock') { doc.setLineWidth(0.5); doc.rect(x, y - 1.3, 8, 2.6, 'S'); doc.setLineWidth(0.18); doc.line(x + 1, y, x + 7, y); }
      else if (id === 'skarmtak') { doc.setLineWidth(0.5); doc.rect(x, y - 1.3, 8, 2.6, 'S'); doc.setLineWidth(0.18); doc.line(x + 0.8, y + 1.0, x + 7.2, y - 1.0); }
      else if (id === 'kurva') { doc.setDrawColor(...FARG.kurva); doc.setLineWidth(0.2); doc.lines([[2, -1], [2, 1], [2, -0.6], [2, 0.4]], x, y); }
      else if (id === 'vag') { doc.setDrawColor(...FARG.vag); doc.setFillColor(...FARG.vagyta); doc.setLineWidth(0.18); doc.rect(x, y - 1.1, 8, 2.2, 'FD'); }
      else if (id === 'trad') { doc.setDrawColor(...FARG.trad); doc.setLineWidth(0.18); doc.circle(x + 4, y, 1.3, 'S'); doc.line(x + 3.6, y, x + 4.4, y); doc.line(x + 4, y - 0.4, x + 4, y + 0.4); }
      else if (id === 'strand') { doc.setDrawColor(...FARG.strand); doc.setLineWidth(0.3); doc.line(x, y - 0.6, x + 8, y - 0.6); doc.setLineDashPattern(STRECK.strand, 0); doc.line(x, y + 0.7, x + 8, y + 0.7); doc.setLineDashPattern([], 0); }
      else if (id === 'natur') { doc.setDrawColor(...FARG.natur); doc.setLineWidth(0.3); doc.setLineDashPattern(STRECK.natur, 0); doc.line(x, y, x + 8, y); doc.setLineDashPattern([], 0); }
      else if (id === 'lamning') { doc.setDrawColor(...FARG.lamning); doc.setLineWidth(0.25); doc.circle(x + 4, y, 0.8, 'S'); }
      else if (id === 'ledare') { doc.setLineWidth(0.18); doc.line(x, y + 1, x + 5, y - 0.6); doc.line(x + 5, y - 0.6, x + 8, y - 0.6); doc.setFillColor(23, 25, 27); doc.triangle(x, y + 1, x + 1.5, y + 0.1, x + 1.0, y + 0.95, 'F'); }
      else if (id === 'entre') { doc.setFillColor(23, 25, 27); doc.triangle(x + 4, y - 1.2, x + 2.4, y + 1.6, x + 5.6, y + 1.6, 'F'); }
      else if (id === 'matt') { doc.setLineWidth(0.13); doc.line(x, y, x + 8, y); doc.setLineWidth(0.25); doc.line(x - 0.6, y + 0.6, x + 0.6, y - 0.6); doc.line(x + 7.4, y + 0.6, x + 8.6, y - 0.6); }
      skrift(t, x + 11, y, 0, { pt: 6.5 });
      y += 4;
    }
    return y0;
  }

  /**
   * Koordinatlistan (0.16.1): numrerade hörn med N och E, ovanför teckenförklaringen; i flera spalter om den
   * blir hög. Ger överkanten.
   */
  function koordinatlista(doc, skrift, lista, bx, bw, botten, f, zonNamn) {
    if (!lista || !lista.length) return botten;
    // spalter om 56 mm (nr, N, E); så många som behövs för att listan inte ska bli högre än 12 rader
    const radH = 3.0, SW = 56, maxSp = Math.max(1, Math.floor(bw / SW));
    const sp = Math.min(maxSp, Math.max(1, Math.ceil(lista.length / 12))), per = Math.ceil(lista.length / sp);
    const h = 9 + per * radH, y0 = botten - h;
    doc.setFillColor(255, 255, 255); doc.setDrawColor(23, 25, 27); doc.setLineWidth(0.25); doc.rect(bx, y0, bw, h, 'FD');
    skrift(`KOORDINATER, ${zonNamn || 'zonen'}`, bx + 3, y0 + 3.4, 0, { pt: 6.5, fet: true });
    for (let c = 0; c < sp; c++) {
      const x = bx + 3 + c * SW;
      skrift('Nr', x, y0 + 7, 0, { pt: 5.8, farg: FARG.gra });
      skrift('N', x + 28, y0 + 7, 0, { pt: 5.8, farg: FARG.gra, ha: 'right' });
      skrift('E', x + 50, y0 + 7, 0, { pt: 5.8, farg: FARG.gra, ha: 'right' });
      lista.slice(c * per, (c + 1) * per).forEach((p, i) => {
        const y = y0 + 10 + i * radH;
        skrift(String(p.nr), x, y, 0, { pt: 6.2, fet: true });
        skrift(fmt(p.y, 2), x + 28, y, 0, { pt: 6.2, mono: true, ha: 'right' });
        skrift(fmt(p.x, 2), x + 50, y, 0, { pt: 6.2, mono: true, ha: 'right' });
      });
    }
    return y0;
  }

  /**
   * Situationsplanen som DXF (R12) i zonens koordinater, ett lager per innehåll. Texthöjderna följer skalan.
   * opt som pdf (utan format och fonter). Ger texten.
   */
  function dxf(opt) {
    const D = g('Dxf') || require('./dxf.js');
    const skala = opt.skala || 400, mm = skala / 1000;
    const R = ritning(opt, { skala });
    const LAGER = {
      SITPLAN_FASTIGHETSGRANS: 7, SITPLAN_FASTIGHETSBETECKNING: 7, SITPLAN_BYGGNAD_LM: 8,
      SITPLAN_NY: 7, SITPLAN_TILLBYGGNAD: 7, SITPLAN_SKRAFFERING: 8, SITPLAN_BEFINTLIG: 7, SITPLAN_RIVS: 1,
      SITPLAN_HUVUDBYGGNAD: 7, SITPLAN_ENTRE: 7, SITPLAN_MATT: 3, SITPLAN_MATTEXT: 3, SITPLAN_TEXT: 7, SITPLAN_KOORDINATER: 5,
      // 0.16.1
      SITPLAN_KOMPLEMENT: 7, SITPLAN_SKARMTAK: 7, SITPLAN_KOORDINATLISTA: 5, SITPLAN_LEDARE: 7, SITPLAN_HOJDKURVA: 34, SITPLAN_HOJDKURVA_TEXT: 34,
      SITPLAN_VAG: 8, SITPLAN_TRAD: 3, SITPLAN_STRANDSKYDD: 5, SITPLAN_SKYDDAD_NATUR: 3, SITPLAN_LAMNING: 6,
    };
    const NAMN = { GRANS: 'SITPLAN_FASTIGHETSGRANS', FASTIGHET: 'SITPLAN_FASTIGHETSBETECKNING', LMHUS: 'SITPLAN_BYGGNAD_LM', NY: 'SITPLAN_NY', TILLBYGGNAD: 'SITPLAN_TILLBYGGNAD',
      SKRAFF: 'SITPLAN_SKRAFFERING', BEFINTLIG: 'SITPLAN_BEFINTLIG', RIVS: 'SITPLAN_RIVS', KRYSS: 'SITPLAN_HUVUDBYGGNAD', ENTRE: 'SITPLAN_ENTRE', MATT: 'SITPLAN_MATT',
      MATTEXT: 'SITPLAN_MATTEXT', ETIKETT: 'SITPLAN_TEXT', KOORD: 'SITPLAN_KOORDINATER',
      NOCK: 'SITPLAN_KOMPLEMENT', SKARMTAK: 'SITPLAN_SKARMTAK', KOORDNR: 'SITPLAN_KOORDINATLISTA', LEDARE: 'SITPLAN_LEDARE', LEDARTEXT: 'SITPLAN_LEDARE',
      KURVA: 'SITPLAN_HOJDKURVA', KURVTEXT: 'SITPLAN_HOJDKURVA_TEXT', VAG: 'SITPLAN_VAG', TRAD: 'SITPLAN_TRAD', STRAND: 'SITPLAN_STRANDSKYDD', NATUR: 'SITPLAN_SKYDDAD_NATUR', LAMNING: 'SITPLAN_LAMNING' };
    const obj = [];
    R.ytor.forEach(y => y.ringar.forEach(r => obj.push({ typ: 'pl', lager: NAMN[y.lager], pts: r, sluten: true })));
    R.linjer.forEach(l => obj.push({ typ: 'pl', lager: NAMN[l.lager], pts: l.pts, sluten: !!l.sluten }));
    R.pilar.forEach(a => obj.push({ typ: 'pl', lager: NAMN[a.lager], pts: a.pts, sluten: true }));
    R.cirklar.forEach(c => obj.push({ typ: 'cirkel', lager: NAMN[c.lager], x: c.p[0], y: c.p[1], r: c.r }));
    R.texter.forEach(t => obj.push({ typ: 'text', lager: NAMN[t.lager], x: t.p[0], y: t.p[1], h: t.h * mm * 0.75, text: t.text, vinkel: t.vinkel / RAD, centrerad: !t.ha || t.ha === 'center', just: t.ha }));
    const pts = obj.flatMap(o => o.pts || [[o.x, o.y]]);
    const ext = pts.length ? { xmin: Math.min(...pts.map(p => p[0])), ymin: Math.min(...pts.map(p => p[1])), xmax: Math.max(...pts.map(p => p[0])), ymax: Math.max(...pts.map(p => p[1])) } : null;
    // koordinatlistan som text till höger om planen (0.16.1)
    if (R.koordlista.length && ext) {
      const h = 2.0 * mm, x = ext.xmax + 10 * mm;
      let y = ext.ymax;
      const rad = s => { obj.push({ typ: 'text', lager: 'SITPLAN_KOORDINATLISTA', x, y, h, text: s }); y -= h * 1.6; };
      rad(`KOORDINATER (${opt.zonNamn || 'zonen'})   NR   N   E`);
      R.koordlista.forEach(p => rad(`${p.nr}   N ${fmt(p.y, 3)}   E ${fmt(p.x, 3)}`));
    }
    return D.skriv(LAGER, obj, { ext });
  }

  return { enheter, enhetFor, matt, satAnnot, visaDolda, sidaIKropp, etiketter, skraffering, klippLinje, utanforRutor, hornOrdning, numreradeHorn, ledarGeometri, sidanOmNock, ritning, ram, mitt, pdf, dxf, mattText, FORMAT };
}));
