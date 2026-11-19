// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Det sparade resultatet (0.13.6, js/resultat.js): omvandlingen till något IndexedDB kan spara
 * och tillbaka. Typade arrayer, delade objekt, egenskaper som inte är uppräkningsbara (husens
 * tak), Map, Set och fel följer med; funktioner tas bort; canvas blir Blob och tillbaka.
 * Själva lagringen prövas i webbläsaren (ui_test.py).
 */
'use strict';
const assert = require('assert');

// en låtsad canvas, som i webbläsaren
global.HTMLCanvasElement = class {
  constructor(w, h) { this.width = w; this.height = h; }
  toBlob(f, typ) { f(new Blob([new Uint8Array(10)], { type: typ })); }
};
const R = require('../js/resultat.js');

(async () => {
  const tak = { z: new Float32Array([1, 2, 3]), W: 3 };
  const hus = { id: 7, namn: 'A' };
  Object.defineProperty(hus, 'tak', { value: tak, enumerable: false, writable: true, configurable: true });
  const trad = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
  const canvas = new HTMLCanvasElement(4, 3);
  const s = {
    r: { xmin: 0, xmax: 10, ymin: 0, ymax: 10 }, epsg: 3009,
    rutnat: { W: 2, H: 2, z: new Float32Array([1, 2, 3, 4]) },
    byggnaderAlla: [hus], byggnader: [hus],
    tradAlla: trad, trad: [trad[1]],
    laserKarta: { x: new Float64Array([1.5]), y: new Float64Array([2.5]), k: new Uint8Array([2]) },
    ortofoto: { bild: 'data:image/jpeg;base64,AAAA', canvas },
    funktion: () => 1,
    opt: { ritare: function () {}, farg: '#fff' },
    karta: new Map([['a', 1]]), mangd: new Set([1, 2]),
    natur: { fel: 'nere' }, err: new Error('fel i tjänsten'),
    tom: null, odef: undefined, lista: [1, () => 2, 3],
  };
  const { varde, storlek } = await R.tillLagring(s);
  assert.ok(storlek > 0);
  // det som sparas ska gå att klona som IndexedDB gör
  const klon = structuredClone(varde);
  const ut = await R.franLagring(klon, (blob, w, h) => ({ canvas: true, w, h, typ: blob.type }));

  assert.deepStrictEqual(ut.r, s.r);
  assert.ok(ut.rutnat.z instanceof Float32Array && ut.rutnat.z[3] === 4);
  assert.strictEqual(ut.byggnader[0], ut.byggnaderAlla[0], 'samma hus på två ställen ska bli samma objekt');
  assert.strictEqual(ut.trad[0], ut.tradAlla[1], 'samma träd på två ställen ska bli samma objekt');
  assert.ok(!Object.keys(ut.byggnader[0]).includes('tak'), 'taket ska inte bli uppräkningsbart');
  assert.ok(ut.byggnader[0].tak && ut.byggnader[0].tak.z[2] === 3, 'taket ska följa med');
  assert.strictEqual(JSON.stringify(ut.byggnader[0]), '{"id":7,"namn":"A"}');
  assert.ok(ut.laserKarta.k instanceof Uint8Array && ut.laserKarta.x[0] === 1.5);
  assert.deepStrictEqual(ut.ortofoto.canvas, { canvas: true, w: 4, h: 3, typ: 'image/png' });
  assert.ok(!('funktion' in ut), 'funktioner tas bort');
  assert.deepStrictEqual(ut.opt, { farg: '#fff' });
  assert.ok(ut.karta instanceof Map && ut.karta.get('a') === 1);
  assert.ok(ut.mangd instanceof Set && ut.mangd.has(2));
  assert.deepStrictEqual(ut.natur, { fel: 'nere' });
  assert.ok(ut.err instanceof Error && ut.err.message === 'fel i tjänsten');
  assert.strictEqual(ut.tom, null);
  assert.deepStrictEqual(ut.lista, [1, null, 3]);

  // en stor canvas sparas som JPEG
  const stor = await R.tillLagring({ c: new HTMLCanvasElement(2000, 1500) });
  assert.strictEqual(stor.varde.c.blob.type, 'image/jpeg');
  // ett objekt som pekar på sig självt
  const a = { namn: 'a' }; a.jag = a;
  const b = await R.franLagring(structuredClone((await R.tillLagring(a)).varde));
  assert.strictEqual(b.jag, b);
  console.log('resultat: omvandlingen till och från lagringen stämmer');
})().catch(e => { console.error(e); process.exit(1); });
