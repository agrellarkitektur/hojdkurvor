/*
 * Utbyte med ritprogrammet cad-apa (se docs/UTBYTE-CAD-APA.md).
 *
 *   höjdkurvor → cad-apa: platspaket (format "hojdkurvor-plats")
 *   cad-apa → höjdkurvor: skiss med volymer (format "cad-apa-skiss")
 *
 * Paketen skickas med postMessage mellan flikarna, eller sparas och öppnas som fil.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Utbyte = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const PLATS = 'hojdkurvor-plats', SKISS = 'cad-apa-skiss', VERSION = 1;
  const MAX_NODER = 1200000;

  /** Float32Array → base64 (little-endian). */
  function kodaFloat32(a) {
    const u8 = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function avkodaFloat32(s) {
    const bin = atob(s), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Float32Array(u8.buffer);
  }
  const avrunda = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
  const runda = pts => pts.map(p => [avrunda(p[0]), avrunda(p[1])]);
  const nyttId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

  /**
   * Bygger ett platspaket. o: { projekt, kommun, projektId, epsg, systemNamn, utsnitt, nollpunkt {x,y,z},
   *   vridning, sannNord, rutnat {W,H,s,x0,y1,z}, kurvor, trad, vagar, stompunkter, volymer, byggnader,
   *   fastigheter { granser, punkter, ytor }, fastighetVarning, ortofoto { bild, x0, y1, s, W, H, ar },
   *   projektlank, kalla }
   */
  function platspaket(o) {
    const p = {
      format: PLATS, version: VERSION, skapad: new Date().toISOString(), kalla: o.kalla || 'höjdkurvor.se',
      projekt: { id: o.projektId || nyttId(), namn: o.projekt || '', kommun: o.kommun || '' },
      koordinatsystem: { plan: { epsg: o.epsg, namn: o.systemNamn || '' }, hojd: 'RH 2000', enhet: 'm' },
      utsnitt: { xmin: o.utsnitt.xmin, ymin: o.utsnitt.ymin, xmax: o.utsnitt.xmax, ymax: o.utsnitt.ymax },
      nollpunkt: { x: o.nollpunkt.x, y: o.nollpunkt.y, z: o.nollpunkt.z || 0 },
      vridning: avrunda(o.vridning || 0, 6),
      sannNord: avrunda(o.sannNord || 0, 6),
      terrang: {},
      lankar: o.projektlank ? { projekt: o.projektlank } : {},
      licens: 'Höjddata och laserdata © Lantmäteriet (CC BY 4.0). Vägar © OpenStreetMap-bidragsgivare (ODbL).',
    };
    if (o.rutnat) {
      const g = o.rutnat;
      p.terrang.rutnat = { x0: g.x0, y1: g.y1, s: g.s, W: g.W, H: g.H, z: kodaFloat32(g.z instanceof Float32Array ? g.z : Float32Array.from(g.z)) };
    }
    if (o.kurvor) p.terrang.kurvor = o.kurvor.map(k => ({ z: avrunda(k.h != null ? k.h : k.z, 3), lager: k.lager, sluten: !!k.sluten, pts: runda(k.pts) }));
    if (o.trad) {
      // arten, modellen och variationen (0.11.0), så att cad-apa kan rita samma träd som 3D-vyn
      const T3 = o.trad3d || (typeof Trad3D !== 'undefined' ? Trad3D : null);
      p.trad = o.trad.map(t => {
        const ut = { x: avrunda(t.x), y: avrunda(t.y), mark: avrunda(t.zMark != null ? t.zMark : t.mark, 2), hojd: avrunda(t.hojd, 1), krona: avrunda(t.krona, 1) };
        if (T3) {
          const v = T3.variation(t), typ = T3.typ(t);
          Object.assign(ut, { art: typ === 'bjork' ? 'bjork' : T3.art(t), modell: typ, vrid: avrunda(v.vrid * 180 / Math.PI, 1), ljus: avrunda(v.ljus, 2) });
        }
        if (t.andrat) ut.andrat = true;
        return ut;
      });
      if (T3 && p.trad.length) p.tradmodeller = tradmodeller(T3, new Set(p.trad.map(t => t.modell)));
    }
    if (o.vagar) {
      p.vagar = o.vagar.linjer.map(l => ({ typ: l.typ, lager: l.lager, slag: l.slag || (l.lager === 'VAG_GANG_CYKEL' ? 'gang' : 'bil'), namn: l.namn || '', pts: runda(l.pts) }));
      // vägytorna (0.11.0): utkast, slutna ringar (första yttre, resten hål) per slag
      const y = o.vagar.ytor;
      if (y && ((y.bil && y.bil.length) || (y.gang && y.gang.length))) {
        const poly = lista => (lista || []).map(q => ({ ringar: q.ringar.map(runda), yta: avrunda(q.yta, 1) }));
        p.vagytor = { bil: poly(y.bil), gang: poly(y.gang) };
      }
    }
    if (o.stompunkter) p.stompunkter = o.stompunkter.map(s => ({ namn: s.namn || s.id, x: s.x, y: s.y, z: s.z }));
    if (o.volymer && o.volymer.length) p.volymer = o.volymer.map(volymTillPaket);
    if (o.byggnader && o.byggnader.length) {
      p.byggnader = o.byggnader.map(b => ({
        id: b.id || null, typ: b.typ, andamal: b.andamal || [], husnummer: b.husnummer || null, namn: b.namn || null,
        fotavtryck: runda(b.fotavtryck), mark: b.mark == null ? null : avrunda(b.mark, 2), hojd: b.hojd == null ? null : avrunda(b.hojd, 1),
      }));
      p.licens = p.licens.replace('Höjddata och laserdata', 'Höjddata, laserdata och byggnader');
    }
    if (o.fastigheter && (o.fastigheter.granser.length || o.fastigheter.ytor.length)) {
      const f = o.fastigheter, osaker = v => (v == null ? null : avrunda(v, 2));
      p.fastigheter = {
        granser: f.granser.map(g => ({ typ: g.typ, osakerhet: osaker(g.osakerhet), pts: runda(g.pts) })),
        punkter: f.punkter.map(q => ({ x: avrunda(q.x), y: avrunda(q.y), typ: q.typ, markering: q.markering || null, osakerhet: osaker(q.osakerhet) })),
        ytor: f.ytor.map(y => ({ beteckning: y.beteckning, etikett: y.etikett, kommun: y.kommun || '', typ: y.typ,
          ringar: y.ringar.map(runda), ankare: y.ankare ? [avrunda(y.ankare[0]), avrunda(y.ankare[1])] : null, yta: avrunda(y.yta, 1) })),
        varning: o.fastighetVarning || '',
      };
      p.licens = p.licens.replace(/^(Höjddata[^©]*?) ©/, (m, a) => a.replace(/ och ([^,]+)$/, ', $1') + ' och fastighetsindelning ©');
    }
    // Ortofotot (0.10.1): data-URL och läget som i en världsfil (x0/y1 = mitten av övre vänstra pixeln).
    const o2 = o.ortofoto;
    if (o2 && typeof o2.bild === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(o2.bild) && o2.s > 0 && o2.W >= 1 && o2.H >= 1) {
      p.ortofoto = { bild: o2.bild, x0: o2.x0, y1: o2.y1, s: o2.s, W: o2.W, H: o2.H };
      if (o2.ar) p.ortofoto.ar = o2.ar;
      p.licens = p.licens.replace(/^(Höjddata[^©]*?) ©/, (m, a) => a.replace(/ och ([^,]+)$/, ', $1') + ' och ortofoto ©');
    }
    return p;
  }
  /**
   * De detaljerade trädmodellerna (0.11.0): en per typ, 1 m hög och 1 m bred med stammens fot i origo,
   * x österut, y norrut och z uppåt. Trianglar utan index (tre hörn i rad), färg per hörn (linjär rgb 0–1).
   */
  function tradmodeller(T3, typer) {
    const ut = {};
    for (const typ of typer) {
      const m = T3.modell(typ, 'detaljerad'), n = m.pos.length, pos = new Float32Array(n);
      for (let i = 0; i < n; i += 3) { pos[i] = avrunda(m.pos[i], 4); pos[i + 1] = avrunda(-m.pos[i + 2], 4); pos[i + 2] = avrunda(m.pos[i + 1], 4); }
      ut[typ] = { antal: n / 3, pos: kodaFloat32(pos), farg: kodaFloat32(m.farg instanceof Float32Array ? m.farg : Float32Array.from(m.farg)) };
    }
    return ut;
  }
  const volymTillPaket = v => ({ id: v.id, namn: v.namn, fotavtryck: runda(v.fotavtryck), golv: avrunda(v.golv), takfot: avrunda(v.takfot), takform: v.takform || 'platt', taklutning: v.taklutning || 0, nockriktning: v.nockriktning == null ? null : v.nockriktning });

  /** Glesar ut ett rutnät så att det har högst MAX_NODER noder. */
  function glesa(g) {
    let k = 1;
    while (Math.ceil(g.W / k) * Math.ceil(g.H / k) > MAX_NODER) k++;
    if (k === 1) return g;
    const W = Math.floor((g.W - 1) / k) + 1, H = Math.floor((g.H - 1) / k) + 1, z = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) z[j * W + i] = g.z[j * k * g.W + i * k];
    return { W, H, s: g.s * k, x0: g.x0, y1: g.y1, z };
  }

  /** Lokala koordinater (relativt nollpunkten, vridna medurs v grader) → zonens. */
  function lokalTillZon(p, np, v) {
    const r = (v || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const [xl, yl] = p;
    return [np.x + xl * c - yl * s, np.y + xl * s + yl * c];
  }

  /**
   * Läser och kontrollerar en skiss från cad-apa. Returnerar { plats, volymer } med
   * volymerna i zonens koordinater och golvnivå i RH 2000.
   */
  function lasSkiss(data) {
    const d = typeof data === 'string' ? JSON.parse(data) : data;
    if (!d || d.format !== SKISS) throw new Error('filen är inte en skiss från cad-apa');
    if (d.version > VERSION) throw new Error(`skissen har format ${d.version}, den här versionen klarar ${VERSION}. Ladda om sidan.`);
    const plats = d.plats || null;
    const np = plats && plats.nollpunkt ? plats.nollpunkt : { x: 0, y: 0, z: 0 };
    const vrid = plats && plats.vridning ? plats.vridning : 0;
    const lokal = d.koordinater === 'lokal';
    const tal = (v, def) => (typeof v === 'number' && isFinite(v) ? v : def);
    const volymer = (d.volymer || []).map((v, i) => {
      const pts = (v.fotavtryck || []).filter(p => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]));
      if (pts.length < 3) return null;
      return {
        id: String(v.id || 'v' + (i + 1)),
        namn: String(v.namn || `Volym ${i + 1}`).slice(0, 60),
        fotavtryck: lokal ? pts.map(p => lokalTillZon(p, np, vrid)) : pts.map(p => [p[0], p[1]]),
        golv: tal(v.golv, NaN) + (lokal ? (np.z || 0) : 0),
        takfot: Math.max(0, tal(v.takfot, 3)),
        takform: ['platt', 'pulpet', 'sadel', 'valm'].includes(v.takform) ? v.takform : 'platt',
        taklutning: Math.min(75, Math.max(0, tal(v.taklutning, 0))),
        nockriktning: v.nockriktning == null ? null : tal(v.nockriktning, 0) + (lokal ? vrid : 0),
      };
    }).filter(Boolean);
    if (!volymer.length) throw new Error('skissen innehåller inga volymer');
    return { plats, volymer };
  }

  // ------------------------------------------------------------------
  // Meddelanden mellan flikarna
  // ------------------------------------------------------------------
  const ursprung = url => { try { return new URL(url, location.href).origin; } catch (e) { return null; } };

  /**
   * Öppnar cad-apa i en ny flik och skickar platspaketet när cad-apa säger att den är redo.
   * Måste anropas direkt vid ett klick (annars spärras fönstret). Löser med 'mottaget',
   * 'skickat' (inget kvitto) eller kastar om fliken inte svarar.
   */
  function skickaTillCadApa(url, paket, { tid = 30000 } = {}) {
    const mal = ursprung(url);
    const fonster = window.open(url.replace(/#.*$/, '') + '#hojdkurvor-import', 'cad-apa');
    if (!fonster) return Promise.reject(new Error('webbläsaren stoppade den nya fliken. Tillåt popup-fönster för sidan, eller spara platsfilen och öppna den i cad-apa.'));
    return new Promise((ok, fel) => {
      let skickat = false;
      const klar = (fn, v) => { window.removeEventListener('message', lyss); clearTimeout(t); fn(v); };
      const lyss = e => {
        if (e.source !== fonster || e.origin !== mal || !e.data || typeof e.data !== 'object') return;
        if (e.data.typ === 'cad-apa:redo' && !skickat) {
          skickat = true;
          fonster.postMessage({ typ: 'hojdkurvor:plats', data: paket }, mal);
          setTimeout(() => klar(ok, 'skickat'), 8000);
        } else if (e.data.typ === 'cad-apa:mottaget') {
          klar(e.data.ok === false ? fel : ok, e.data.ok === false ? new Error(e.data.fel || 'cad-apa kunde inte läsa platsen') : 'mottaget');
        }
      };
      const t = setTimeout(() => klar(fel, new Error('cad-apa svarade inte. Spara platsfilen och öppna den i cad-apa i stället.')), tid);
      window.addEventListener('message', lyss);
    });
  }

  /**
   * Tar emot skisser från cad-apa. Om sidan öppnats av cad-apa (#cad-apa-import) säger den
   * att den är redo. Varje godkänd skiss skickas till vidSkiss(data).
   */
  function lyssnaPaCadApa(url, vidSkiss) {
    const mal = ursprung(url);
    window.addEventListener('message', e => {
      if (e.origin !== mal || !e.data || typeof e.data !== 'object' || e.data.typ !== 'cad-apa:skiss') return;
      let svar = { typ: 'hojdkurvor:mottaget', ok: true };
      try { vidSkiss(e.data.data); } catch (err) { svar = { typ: 'hojdkurvor:mottaget', ok: false, fel: err.message }; }
      if (e.source) e.source.postMessage(svar, mal);
    });
    if (/^#cad-apa-import/.test(location.hash) && window.opener) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignoreras */ }
      window.opener.postMessage({ typ: 'hojdkurvor:redo', version: VERSION }, mal);
    }
  }

  return { PLATS, SKISS, VERSION, platspaket, tradmodeller, glesa, lasSkiss, lokalTillZon, kodaFloat32, avkodaFloat32, skickaTillCadApa, lyssnaPaCadApa, volymTillPaket, nyttId };
}));
