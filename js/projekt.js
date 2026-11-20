// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Projektet (0.13.0): det användaren har matat in och valt för en plats. Sparas i webbläsaren
 * (IndexedDB, objektlagringen `projekt` i databasen `terrangunderlag`) och som projektfil
 * <namn>.hojdkurvor: en zip med projekt.json och mappen bilagor/. Formatet beskrivs i docs/PROJEKTFIL.md.
 *
 * Här finns formatet (nytt, las, bevara, innehall, migrering), omräkningen av volymer, sektioner och
 * trädval mellan koordinatsystem, zip-filen (packa, lasFil) och lagringen i webbläsaren (db…).
 * Allt utom lagringen går att köra i Node och testas i test/projekt.test.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Projekt = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const FORMAT = 'hojdkurvor-projekt';
  const VERSION = 1;
  const ANDELSE = '.hojdkurvor';
  const RAD = Math.PI / 180;
  const MAX_HISTORIK = 200;

  /** En fil från en nyare version av appen. */
  class NyareVersion extends Error {}

  const nyttId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID()
    : 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const nu = () => new Date().toISOString();
  const arObjekt = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const kopia = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

  /** Standardinnehållet. Används för ett nytt projekt och för att fylla i det som saknas i en fil. */
  function standard(id) {
    return {
      format: FORMAT, version: VERSION, app: '', skapad: null, sparad: null,
      projekt: { id: id || nyttId(), namn: '', kommun: '', fastighet: '', uppdrag: '', anteckning: '' },
      plats: {
        crs: 'EPSG:3006', zon: null, zonManuell: false, utsnitt: null, mitt: null, radie: null,
        nollpunkt: { typ: 'auto' }, vridning: { typ: 'ingen', grader: 0 }, horisontpunkt: null, last: false,
      },
      val: {},
      inmatning: {
        forslag: [], volymer: [], sektioner: [], rattelser: { tak: {}, trad: {}, hus: {} },
        punkter: [], overlagringar: [], anteckningar: [], vyer: [],
      },
      underlag: { senastSkapat: null, kallor: [] },
      historik: [],
    };
  }

  /** Ett nytt, tomt projekt med förslaget Basfall. */
  function nytt({ id, namn = '', app = '' } = {}) {
    const d = standard(id), t = nu();
    d.app = app; d.skapad = t; d.projekt.namn = namn;
    d.inmatning.forslag = [{ id: nyttId(), namn: 'Basfall', aktivt: true }];
    d.historik = [{ tid: t, handelse: 'Projektet skapat' }];
    return d;
  }

  /** Lägger till det som saknas i mal ur std, utan att ändra det som finns. Listor fylls inte i. */
  function fyll(mal, std) {
    for (const k of Object.keys(std)) {
      // ett fält som ska vara ett objekt men är något annat (null, text, lista) räknas som saknat
      if (!(k in mal) || mal[k] === undefined || (arObjekt(std[k]) && !arObjekt(mal[k]))) mal[k] = kopia(std[k]);
      else if (arObjekt(mal[k]) && arObjekt(std[k])) fyll(mal[k], std[k]);
    }
    return mal;
  }
  const arPunkt = p => Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number' && isFinite(p[0]) && isFinite(p[1]);

  /**
   * Migrering: MIGRERA[n](d) gör en fil i version n till version n + 1. Lägg till en funktion här
   * och höj VERSION när formatet ändras så att gamla filer inte längre kan läsas som de är.
   */
  const MIGRERA = {};

  /** Läser en projektfil (objekt eller JSON-text): kontrollerar, migrerar och fyller i det som saknas. */
  function las(d) {
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch (e) { throw new Error('filen är inte giltig JSON.'); }
    }
    if (!arObjekt(d) || d.format !== FORMAT) throw new Error('det här är ingen projektfil från Höjdkurvor.');
    if (typeof d.version !== 'number' || !(d.version >= 0)) throw new Error('projektfilen saknar version.');
    if (d.version > VERSION) throw new NyareVersion(`Filen är sparad i en nyare version av Höjdkurvor (format ${d.version}) – ladda om sidan.`);
    let ut = kopia(d);
    while (ut.version < VERSION) {
      if (!MIGRERA[ut.version]) throw new Error(`projektfilens format ${ut.version} kan inte läsas.`);
      ut = MIGRERA[ut.version](ut);
    }
    fyll(ut, standard(arObjekt(ut.projekt) ? ut.projekt.id : undefined));
    if (typeof ut.projekt.id !== 'string' || !ut.projekt.id) ut.projekt.id = typeof ut.projekt.id === 'number' ? String(ut.projekt.id) : nyttId();
    for (const k of ['forslag', 'volymer', 'sektioner', 'punkter', 'overlagringar', 'anteckningar', 'vyer']) {
      if (!Array.isArray(ut.inmatning[k])) ut.inmatning[k] = [];
    }
    // det appen ritar måste gå att rita: volymer med fotavtryck och sektioner med två punkter
    ut.inmatning.forslag = ut.inmatning.forslag.filter(arObjekt);
    ut.inmatning.volymer = ut.inmatning.volymer.filter(v => arObjekt(v) && Array.isArray(v.fotavtryck) && v.fotavtryck.length >= 3 && v.fotavtryck.every(arPunkt));
    ut.inmatning.sektioner = ut.inmatning.sektioner.filter(s => arObjekt(s) && arPunkt(s.a) && arPunkt(s.b));
    const u = ut.plats.utsnitt;
    if (u && !(['xmin', 'ymin', 'xmax', 'ymax'].every(k => typeof u[k] === 'number' && isFinite(u[k])) && u.xmax > u.xmin && u.ymax > u.ymin)) ut.plats.utsnitt = null;
    if (ut.plats.mitt && !arPunkt(ut.plats.mitt)) ut.plats.mitt = null;
    if (ut.plats.horisontpunkt && !arPunkt(ut.plats.horisontpunkt)) ut.plats.horisontpunkt = null;
    if (typeof ut.plats.last !== 'boolean') ut.plats.last = false;
    if (!ut.inmatning.forslag.length) ut.inmatning.forslag = [{ id: nyttId(), namn: 'Basfall', aktivt: true }];
    if (!Array.isArray(ut.historik)) ut.historik = [];
    return ut;
  }

  /**
   * Okända fält bevaras: ny är det appen själv byggt, gammal det som lästes in. Fält som bara finns
   * i gammal läggs till sist, och poster i listor med samma id slås ihop på samma sätt. Det appen
   * äger helt (rättelserna, historiken) bevaras inte, så att det som tagits bort är borta.
   */
  const EGNA = new Set(['inmatning.rattelser.tak', 'inmatning.rattelser.trad', 'inmatning.rattelser.hus', 'historik', 'underlag.kallor']);
  function bevara(gammal, ny, vag = '') {
    if (EGNA.has(vag)) return ny;
    if (arObjekt(gammal) && arObjekt(ny)) {
      const ut = {};
      for (const k of Object.keys(ny)) ut[k] = k in gammal ? bevara(gammal[k], ny[k], vag ? vag + '.' + k : k) : ny[k];
      for (const k of Object.keys(gammal)) if (!(k in ny)) ut[k] = gammal[k];
      return ut;
    }
    if (Array.isArray(gammal) && Array.isArray(ny)) {
      const forr = new Map(gammal.filter(e => arObjekt(e) && e.id != null).map(e => [e.id, e]));
      return ny.map(e => (arObjekt(e) && forr.has(e.id) ? bevara(forr.get(e.id), e, vag + '[]') : e));
    }
    return ny;
  }

  /** JSON med sorterade nycklar, så att två lika objekt alltid blir samma text. */
  function stabil(v) {
    if (Array.isArray(v)) return '[' + v.map(stabil).join(',') + ']';
    if (arObjekt(v)) return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + stabil(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  /** Det som räknas som projektets innehåll: allt utom tider, appversion, källor och historik. */
  function innehall(d) {
    return stabil({ projekt: d.projekt, plats: d.plats, val: d.val, inmatning: d.inmatning });
  }

  /** Lägger till en händelse i historiken. Samma händelse inom tio minuter skriver bara om tiden. */
  function logga(d, handelse, tid = nu()) {
    if (!Array.isArray(d.historik)) d.historik = [];
    const sista = d.historik[d.historik.length - 1];
    if (sista && sista.handelse === handelse && Date.parse(tid) - Date.parse(sista.tid) < 10 * 60e3) sista.tid = tid;
    else d.historik.push({ tid, handelse });
    if (d.historik.length > MAX_HISTORIK) d.historik.splice(0, d.historik.length - MAX_HISTORIK);
    return d;
  }

  /** En kopia med nytt id och namn, för Öppna som kopia. */
  function somKopia(d, namn) {
    const ut = kopia(d);
    ut.projekt.id = nyttId();
    ut.projekt.namn = namn != null ? namn : (d.projekt.namn ? d.projekt.namn + ' (kopia)' : 'Kopia');
    ut.skapad = nu(); ut.sparad = null;
    logga(ut, 'Kopierat från ett annat projekt');
    return ut;
  }

  /** Antal saker i projektet, för listorna. */
  function sammanfatta(d) {
    const i = d.inmatning || {}, r = i.rattelser || {};
    const n = o => Object.keys(o || {}).length;
    return {
      volymer: (i.volymer || []).length, sektioner: (i.sektioner || []).length,
      rattelser: n(r.tak) + n(r.trad) + n(r.hus), punkter: (i.punkter || []).length,
    };
  }
  /** "3 volymer, 2 sektioner" eller "Bara utsnitt". */
  function sammanfattningText(s) {
    const del = [];
    if (s.volymer) del.push(`${s.volymer} ${s.volymer === 1 ? 'volym' : 'volymer'}`);
    if (s.sektioner) del.push(`${s.sektioner} ${s.sektioner === 1 ? 'sektion' : 'sektioner'}`);
    if (s.rattelser) del.push(`${s.rattelser} ${s.rattelser === 1 ? 'rättelse' : 'rättelser'}`);
    if (s.punkter) del.push(`${s.punkter} ${s.punkter === 1 ? 'punkt' : 'punkter'}`);
    return del.length ? del.join(', ') : 'Bara utsnitt och val';
  }

  // ------------------------------------------------------------------
  // Koordinater: i filen ligger all geometri i SWEREF 99 TM, i appen i arbetszonen
  // ------------------------------------------------------------------
  const runda = (v, n = 3) => { const k = 10 ** n; return Math.round(v * k) / k; };
  const rundaP = p => [runda(p[0]), runda(p[1])];
  const norm = g => { let a = ((g + 180) % 360 + 360) % 360 - 180; if (a === -180) a = 180; return runda(a, 6); };
  /** Hur mycket riktningen öster vrids (grader moturs) när f räknar om kring punkten p. */
  function vinkel(f, p) {
    const a = f(p), b = f([p[0] + 10, p[1]]);
    return Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;
  }
  const medel = pts => [pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length];
  /**
   * En volym i ett annat koordinatsystem: fotavtrycket, primitivens mitt och vridning och
   * nockriktningen. f: [x, y] → [x, y]. golv NaN (står på marken) blir null i filen.
   */
  function flyttaVolym(v, f) {
    const n = kopia(v);
    if (typeof v.golv === 'number' && !(v.golv === v.golv)) n.golv = null;
    const fot = Array.isArray(v.fotavtryck) ? v.fotavtryck : [];
    const c = v.primitiv && isFinite(v.primitiv.x) ? [v.primitiv.x, v.primitiv.y] : (fot.length ? medel(fot) : null);
    if (!c) return n;
    const d = vinkel(f, c);
    n.fotavtryck = fot.map(p => rundaP(f(p)));
    if (n.primitiv && isFinite(v.primitiv.x)) {
      const [x, y] = f([v.primitiv.x, v.primitiv.y]);
      n.primitiv.x = runda(x); n.primitiv.y = runda(y);
      n.primitiv.vrid = norm((+v.primitiv.vrid || 0) + d);
    }
    if (v.nockriktning != null && isFinite(v.nockriktning)) n.nockriktning = norm(v.nockriktning + d);
    return n;
  }
  /** Trädvalen { "x,y" (dm): val } i ett annat koordinatsystem. bara(x, y) kan välja ut vilka som följer med. */
  function flyttaTradval(val, f, bara) {
    const ut = {};
    for (const [k, v] of Object.entries(val || {})) {
      const [x, y] = k.split(',').map(Number);
      if (!isFinite(x) || !isFinite(y) || (bara && !bara(x, y))) continue;
      const [a, b] = f([x, y]);
      ut[`${runda(a, 1)},${runda(b, 1)}`] = kopia(v);
    }
    return ut;
  }
  /**
   * För in trädvalen nya i mal (ändrar mal och returnerar det). Ett val som redan finns i mal inom
   * tol meter skrivs över i stället för att få en tvilling: när nycklarna (läget i dm) räknas till
   * SWEREF 99 TM och tillbaka kan de hamna en decimeter bredvid, och då fanns valet kvar när det togs bort.
   */
  function slaIhopTradval(mal, nya, tol = 0.15) {
    const lagen = Object.keys(mal).map(k => { const [x, y] = k.split(',').map(Number); return { k, x, y }; }).filter(p => isFinite(p.x) && isFinite(p.y));
    for (const [k, v] of Object.entries(nya || {})) {
      if (Object.prototype.hasOwnProperty.call(mal, k)) { mal[k] = v; continue; }
      const [x, y] = k.split(',').map(Number);
      const nara = isFinite(x) && isFinite(y) ? lagen.find(p => Math.abs(p.x - x) <= tol && Math.abs(p.y - y) <= tol) : null;
      if (nara) mal[nara.k] = v;
      else { mal[k] = v; lagen.push({ k, x, y }); }
    }
    return mal;
  }
  /** Hur många volymer och sektioner (i samma system som r) som ligger helt utanför utsnittet r. */
  function utanfor(volymer, sektioner, r) {
    if (!r) return { volymer: 0, sektioner: 0 };
    const inne = p => p[0] >= r.xmin && p[0] <= r.xmax && p[1] >= r.ymin && p[1] <= r.ymax;
    const ruta = pts => {
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      return Math.max(...xs) >= r.xmin && Math.min(...xs) <= r.xmax && Math.max(...ys) >= r.ymin && Math.min(...ys) <= r.ymax;
    };
    return {
      volymer: (volymer || []).filter(v => v.fotavtryck && v.fotavtryck.length && !ruta(v.fotavtryck)).length,
      sektioner: (sektioner || []).filter(s => !inne(s[0]) && !inne(s[1]) && !ruta(s)).length,
    };
  }
  function utanforText(u) {
    const del = [];
    if (u.volymer) del.push(`${u.volymer} ${u.volymer === 1 ? 'volym' : 'volymer'}`);
    if (u.sektioner) del.push(`${u.sektioner} ${u.sektioner === 1 ? 'sektion' : 'sektioner'}`);
    if (!del.length) return '';
    return `${del.join(' och ')} ligger utanför utsnittet. ${u.volymer + u.sektioner === 1 ? 'Den finns' : 'De finns'} kvar i projektet.`;
  }

  // ------------------------------------------------------------------
  // Projektfilen: zip med projekt.json och bilagor/, eller ren JSON
  // ------------------------------------------------------------------
  /** Packar projektet. bilagor: { filnamn: Blob | Uint8Array }. typ: 'blob' eller 'uint8array'. */
  async function packa(d, bilagor, JSZip, typ = 'blob') {
    const zip = new JSZip();
    zip.file('projekt.json', JSON.stringify(d, null, 1));
    const b = zip.folder('bilagor');
    for (const [namn, innehall] of Object.entries(bilagor || {})) b.file(namn, innehall);
    return zip.generateAsync({ type: typ, compression: 'DEFLATE', mimeType: 'application/zip' });
  }
  /** Läser en projektfil (ArrayBuffer eller Uint8Array): { data, bilagor }. */
  async function lasFil(buf, JSZip) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    if (u8[0] === 0x50 && u8[1] === 0x4b) {
      const zip = await JSZip.loadAsync(u8);
      const pj = zip.file('projekt.json');
      if (!pj) throw new Error('zip-filen har ingen projekt.json, så den är ingen projektfil från Höjdkurvor.');
      const data = las(await pj.async('string'));
      const bilagor = {};
      const filer = [];
      zip.folder('bilagor').forEach((namn, f) => { if (!f.dir) filer.push([namn, f]); });
      for (const [namn, f] of filer) bilagor[namn] = await f.async('uint8array');
      return { data, bilagor };
    }
    const text = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8').decode(u8) : Buffer.from(u8).toString('utf8');
    return { data: las(text.replace(/^﻿/, '')), bilagor: {} };
  }

  // ------------------------------------------------------------------
  // Lagringen i webbläsaren (IndexedDB). Samma databas som kommunfilerna (kommunfil.js), version 3
  // (0.13.6: objektlagringen resultat, se resultat.js).
  // ------------------------------------------------------------------
  const DB = 'terrangunderlag', DB_VERSION = 3, LAGRING = 'projekt';
  let dbLofte = null;
  /** Skapar objektlagringarna som saknas. Samma i kommunfil.js. */
  function uppgradera(db) {
    for (const n of ['filer', 'projekt', 'resultat']) if (!db.objectStoreNames.contains(n)) db.createObjectStore(n);
  }
  function oppnaDb() {
    if (!dbLofte) dbLofte = new Promise((ok, fel) => {
      if (typeof indexedDB === 'undefined') { fel(new Error('webbläsaren saknar IndexedDB')); return; }
      const r = indexedDB.open(DB, DB_VERSION);
      r.onupgradeneeded = () => uppgradera(r.result);
      r.onsuccess = () => {
        const db = r.result;
        db.onversionchange = () => { db.close(); dbLofte = null; };
        ok(db);
      };
      r.onerror = () => { dbLofte = null; fel(r.error); };
      r.onblocked = () => { dbLofte = null; fel(new Error('lagringen är låst av en annan flik med en äldre version av sidan. Ladda om den fliken.')); };
    });
    return dbLofte;
  }
  async function tx(lage, gor) {
    const db = await oppnaDb();
    return new Promise((ok, fel) => {
      const t = db.transaction(LAGRING, lage), s = t.objectStore(LAGRING);
      let svar;
      const q = gor(s);
      if (q) q.onsuccess = () => { svar = q.result; };
      t.oncomplete = () => ok(svar);
      t.onerror = () => fel(t.error);
      t.onabort = () => fel(t.error || new Error('avbrutet'));
    });
  }
  /**
   * En post: { id, namn, kommun, andrad (ms), sparadFil (ms eller null), filInnehall, forhand (SVG),
   * antal: sammanfatta(), storlek (byte), data: projektet, bilagor: { namn: Uint8Array } }.
   */
  const dbSpara = post => tx('readwrite', s => s.put(post, post.id));
  const dbLas = id => tx('readonly', s => s.get(id)).then(p => p || null);
  const dbTaBort = id => tx('readwrite', s => s.delete(id));
  async function dbAlla() {
    const alla = await tx('readonly', s => s.getAll());
    return (alla || []).sort((a, b) => (b.andrad || 0) - (a.andrad || 0));
  }
  /** Ungefärlig storlek på en post i byte. */
  function storlek(post) {
    let n = 0;
    try { n = JSON.stringify(post.data).length + (post.forhand || '').length; } catch (e) { /* ignoreras */ }
    for (const b of Object.values(post.bilagor || {})) n += b.byteLength || b.size || 0;
    return n;
  }

  return {
    FORMAT, VERSION, ANDELSE, NyareVersion, MIGRERA,
    nyttId, standard, nytt, las, bevara, stabil, innehall, logga, somKopia, sammanfatta, sammanfattningText,
    runda, vinkel, flyttaVolym, flyttaTradval, slaIhopTradval, utanfor, utanforText,
    packa, lasFil,
    uppgradera, oppnaDb, dbSpara, dbLas, dbTaBort, dbAlla, storlek,
  };
}));
