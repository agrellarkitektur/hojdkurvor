// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Det senaste resultatet sparat i webbläsaren (0.13.6, BJ).
 *
 * Efter Skapa sparas state.senaste (det som ritas på kartan, i 3D-vyn och i utskrifterna) och
 * zip-filens innehåll i IndexedDB, objektlagringen `resultat` i databasen `terrangunderlag`
 * (version 3, samma uppgradering i projekt.js och kommunfil.js). Bara det senaste per projekt,
 * för högst MAX_PROJEKT projekt och högst TAK byte sammanlagt. När kartan öppnas och projektet
 * är detsamma läses det in igen, så att underlaget inte försvinner när man går till en annan sida.
 *
 * Nycklar: `meta:<id>` (liten: id, tid, storlek, zip), `data:<id>` (resultatet), `zip:<id>`
 * (zip-filens filer). Resultatet görs om till något IndexedDB kan spara (`tillLagring`):
 * funktioner och Leaflet-lager tas bort, canvas blir bild (Blob), egenskaper som inte är
 * uppräkningsbara (till exempel husens `tak`) följer med och blir det igen vid läsningen
 * (`franLagring`). Samma objekt på två ställen blir samma objekt efter läsningen.
 */
(function (rot, fabrik) {
  if (typeof module === 'object' && module.exports) module.exports = fabrik(typeof Projekt !== 'undefined' ? Projekt : null);
  else rot.Resultat = fabrik(rot.Projekt);
}(typeof self !== 'undefined' ? self : this, function (Projekt) {
  'use strict';

  const LAGRING = 'resultat';
  const MAX_PROJEKT = 3;            // resultat för så många projekt sparas, de senaste
  const TAK = 600e6;                // byte sammanlagt (ungefär)
  const FORMAT = 1;                 // höjs om lagringen ändras så att äldre resultat inte går att läsa

  const ARKIV = '__hk';             // märket på omgjorda värden

  const arCanvas = v => (typeof HTMLCanvasElement !== 'undefined' && v instanceof HTMLCanvasElement)
    || (typeof OffscreenCanvas !== 'undefined' && v instanceof OffscreenCanvas);
  const arLeaflet = v => typeof L !== 'undefined' && L.Layer && v instanceof L.Layer;
  const arDom = v => typeof Node !== 'undefined' && v instanceof Node;
  const arBlob = v => typeof Blob !== 'undefined' && v instanceof Blob;

  /**
   * Gör om ett värde så att det kan sparas i IndexedDB. Ger { varde, storlek, canvas } där
   * canvas är en lista [platshållare, canvas] som `bilder` gör om till Blob.
   */
  function tillLagringSynk(v) {
    const sedda = new Map(), canvas = [];
    let storlek = 0;
    function gor(x) {
      if (x === null || x === undefined) return x;
      const t = typeof x;
      if (t === 'string') { storlek += x.length; return x; }
      if (t === 'number' || t === 'boolean' || t === 'bigint') { storlek += 8; return x; }
      if (t === 'function' || t === 'symbol') return undefined;
      if (sedda.has(x)) return sedda.get(x);
      if (ArrayBuffer.isView(x)) { storlek += x.byteLength; sedda.set(x, x); return x; }
      if (x instanceof ArrayBuffer) { storlek += x.byteLength; sedda.set(x, x); return x; }
      if (arBlob(x)) { storlek += x.size; sedda.set(x, x); return x; }
      if (x instanceof Date || x instanceof RegExp) { sedda.set(x, x); return x; }
      if (arCanvas(x)) {
        const p = { [ARKIV]: 'canvas', w: x.width, h: x.height, blob: null };
        sedda.set(x, p); canvas.push([p, x]); storlek += x.width * x.height;   // ungefär, som bild
        return p;
      }
      if (arLeaflet(x) || arDom(x)) return undefined;
      if (Array.isArray(x)) {
        const ut = new Array(x.length);
        sedda.set(x, ut);
        for (let i = 0; i < x.length; i++) { const y = gor(x[i]); ut[i] = y === undefined ? null : y; }
        return ut;
      }
      if (x instanceof Map) {
        const p = { [ARKIV]: 'map', e: [] }; sedda.set(x, p);
        x.forEach((val, k) => p.e.push([gor(k), gor(val)]));
        return p;
      }
      if (x instanceof Set) {
        const p = { [ARKIV]: 'set', e: [] }; sedda.set(x, p);
        x.forEach(val => p.e.push(gor(val)));
        return p;
      }
      if (x instanceof Error) { const e = { [ARKIV]: 'fel', message: String(x.message) }; sedda.set(x, e); return e; }
      // vanliga objekt (och andra klasser, som vanliga objekt): också egenskaper som inte är uppräkningsbara
      const ut = {};
      sedda.set(x, ut);
      const dolda = [];
      for (const k of Object.getOwnPropertyNames(x)) {
        const d = Object.getOwnPropertyDescriptor(x, k);
        if (!('value' in d)) continue;            // getters hoppas över
        const y = gor(d.value);
        if (y === undefined) continue;
        ut[k] = y;
        if (!d.enumerable) dolda.push(k);
      }
      if (dolda.length) ut[ARKIV + 'dolda'] = dolda;
      return ut;
    }
    const varde = gor(v);
    return { varde, storlek, canvas };
  }

  /** Canvas → Blob: PNG för små bilder, JPEG för stora (ortofotot är redan JPEG och utan genomskinlighet). */
  function canvasTillBlob(c) {
    const stor = c.width * c.height > 2e6;
    if (c.convertToBlob) return c.convertToBlob(stor ? { type: 'image/jpeg', quality: 0.92 } : { type: 'image/png' });
    return new Promise((ok, fel) => c.toBlob(b => (b ? ok(b) : fel(new Error('bilden kunde inte sparas'))), stor ? 'image/jpeg' : 'image/png', 0.92));
  }

  /** Som tillLagringSynk men gör också om canvas till Blob. Ger { varde, storlek }. */
  async function tillLagring(v) {
    const r = tillLagringSynk(v);
    let storlek = r.storlek;
    for (const [p, c] of r.canvas) {
      p.blob = await canvasTillBlob(c);
      storlek += p.blob.size - c.width * c.height;
    }
    return { varde: r.varde, storlek };
  }

  /** Blob → canvas (i webbläsaren). */
  async function blobTillCanvas(blob, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    if (!blob) return c;
    let bild;
    if (typeof createImageBitmap === 'function') bild = await createImageBitmap(blob);
    else bild = await new Promise((ok, fel) => {
      const img = new Image(), url = URL.createObjectURL(blob);
      img.onload = () => { URL.revokeObjectURL(url); ok(img); };
      img.onerror = () => { URL.revokeObjectURL(url); fel(new Error('bilden kunde inte läsas')); };
      img.src = url;
    });
    c.getContext('2d').drawImage(bild, 0, 0);
    if (bild.close) bild.close();
    return c;
  }

  /**
   * Tillbaka från lagringen. `bildTill(blob, w, h)` gör en canvas (standard: blobTillCanvas;
   * i testerna något annat). Ändrar inte det inlästa i onödan, men delade objekt blir delade.
   */
  async function franLagring(v, bildTill = blobTillCanvas) {
    // först bilderna: varje platshållare blir en canvas
    const bilder = new Map(), besokta = new Set(), vantar = [];
    (function hitta(x) {
      if (x === null || typeof x !== 'object' || besokta.has(x)) return;
      if (ArrayBuffer.isView(x) || x instanceof ArrayBuffer || arBlob(x)) return;
      besokta.add(x);
      if (x[ARKIV] === 'canvas') { vantar.push(Promise.resolve(bildTill(x.blob, x.w, x.h)).then(c => bilder.set(x, c))); return; }
      for (const k of Object.keys(x)) hitta(x[k]);
    }(v));
    await Promise.all(vantar);
    const sedda = new Map();
    function gor(x) {
      if (x === null || typeof x !== 'object') return x;
      if (bilder.has(x)) return bilder.get(x);
      if (sedda.has(x)) return sedda.get(x);
      if (ArrayBuffer.isView(x) || x instanceof ArrayBuffer || arBlob(x) || x instanceof Date || x instanceof RegExp) { sedda.set(x, x); return x; }
      if (Array.isArray(x)) {
        const ut = new Array(x.length); sedda.set(x, ut);
        for (let i = 0; i < x.length; i++) ut[i] = gor(x[i]);
        return ut;
      }
      const typ = x[ARKIV];
      if (typ === 'map') { const m = new Map(); sedda.set(x, m); x.e.forEach(([k, val]) => m.set(gor(k), gor(val))); return m; }
      if (typ === 'set') { const st = new Set(); sedda.set(x, st); x.e.forEach(val => st.add(gor(val))); return st; }
      if (typ === 'fel') { const e = new Error(x.message); sedda.set(x, e); return e; }
      const ut = {}; sedda.set(x, ut);
      const dolda = x[ARKIV + 'dolda'] || [];
      for (const k of Object.keys(x)) {
        if (k === ARKIV + 'dolda') continue;
        const val = gor(x[k]);
        if (dolda.includes(k)) Object.defineProperty(ut, k, { value: val, writable: true, configurable: true, enumerable: false });
        else ut[k] = val;
      }
      return ut;
    }
    return gor(v);
  }

  // ------------------------------------------------------------------
  // Lagringen
  // ------------------------------------------------------------------
  async function tx(lage, gor) {
    const db = await Projekt.oppnaDb();
    return new Promise((ok, fel) => {
      const t = db.transaction(LAGRING, lage), s = t.objectStore(LAGRING);
      const svar = gor(s);
      let res;
      if (svar && 'onsuccess' in svar) svar.onsuccess = () => { res = svar.result; };
      t.oncomplete = () => ok(res);
      t.onerror = () => fel(t.error);
      t.onabort = () => fel(t.error || new Error('avbrutet'));
    });
  }
  const omrade = prefix => (typeof IDBKeyRange !== 'undefined' ? IDBKeyRange.bound(prefix, prefix + '￿') : null);
  /** Alla sparade resultat (bara de små posterna), senaste först. */
  async function alla() {
    const lista = await tx('readonly', s => s.getAll(omrade('meta:')));
    return (lista || []).sort((a, b) => (b.tid || 0) - (a.tid || 0));
  }
  async function taBort(id) {
    await tx('readwrite', s => { s.delete('meta:' + id); s.delete('data:' + id); s.delete('zip:' + id); });
  }
  async function taBortAlla() {
    await tx('readwrite', s => s.clear());
  }

  /**
   * Sparar resultatet för projektet `id`. `data` är det som ska sparas (state.senaste och det
   * som behövs för att visa det), `zip` zip-filens filer eller null (då behålls den sparade,
   * om `behallZip`). Ger { sparat, zip, storlek } eller kastar.
   */
  async function spara(id, data, zip, o = {}) {
    const d = await tillLagring(data);
    let z = null;
    if (zip) z = tillLagringSynk(zip);
    const forra = (await alla()).find(m => m.id === id);
    let zipStorlek = z ? z.storlek : (o.behallZip && forra && forra.zip ? forra.zipStorlek || 0 : 0);
    let medZip = !!z || !!(o.behallZip && forra && forra.zip);
    if (d.storlek > TAK) { await taBort(id); return { sparat: false, zip: false, storlek: d.storlek }; }
    if (d.storlek + zipStorlek > TAK) { medZip = false; z = null; zipStorlek = 0; }
    const meta = { id, tid: Date.now(), format: FORMAT, storlek: d.storlek, zip: false, zipStorlek, app: o.app || '' };
    // gör plats: äldre projekt tas bort tills det ryms
    const andra = (await alla()).filter(m => m.id !== id);
    let summa = meta.storlek + meta.zipStorlek;
    const kvar = [];
    for (const m of andra) {
      const n = (m.storlek || 0) + (m.zip ? m.zipStorlek || 0 : 0);
      if (kvar.length < MAX_PROJEKT - 1 && summa + n <= TAK) { kvar.push(m); summa += n; } else await taBort(m.id);
    }
    meta.zip = medZip;
    const skriv = () => tx('readwrite', st => {
      st.put(meta, 'meta:' + id);
      st.put(d.varde, 'data:' + id);
      if (z && meta.zip) st.put(z.varde, 'zip:' + id);
      else if (!meta.zip) st.delete('zip:' + id);
    });
    try {
      await skriv();
    } catch (e) {
      if (!meta.zip) throw e;
      // fullt: försök utan zip-filen
      meta.zip = false; meta.zipStorlek = 0; z = null;
      await skriv();
    }
    return { sparat: true, zip: meta.zip, storlek: meta.storlek + meta.zipStorlek };
  }
  /** Sparar bara resultatet (efter en ändring i 3D-vyn), zip-filen ligger kvar. */
  const sparaData = (id, data, app) => spara(id, data, null, { behallZip: true, app });

  /** Läser det sparade resultatet för projektet `id`: { meta, data } eller null. */
  async function las(id, bildTill) {
    const [meta, data] = await Promise.all([
      tx('readonly', s => s.get('meta:' + id)),
      tx('readonly', s => s.get('data:' + id)),
    ]);
    if (!meta || !data || meta.format !== FORMAT) return null;
    return { meta, data: await franLagring(data, bildTill) };
  }
  /** Zip-filens filer för projektet `id`, eller null. */
  async function lasZip(id) {
    const z = await tx('readonly', s => s.get('zip:' + id));
    return z ? franLagring(z) : null;
  }

  return { LAGRING, MAX_PROJEKT, TAK, FORMAT, tillLagringSynk, tillLagring, franLagring, spara, sparaData, las, lasZip, alla, taBort, taBortAlla };
}));
