// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur
// Kör med: node test/sol.test.js
// Solens läge (js/sol.js) mot referensvärden räknade med NREL:s SPA (pvlib 0.13, geometrisk höjd),
// dagjämningar och solstånd 2026, svensk tid kring sommartidens gränser, och upp- och nedgång.
// Skuggorna (js/analys.js) prövas på en mur där skuggans längd går att räkna för hand.
const assert = require('assert');
globalThis.window = globalThis;
globalThis.proj4 = require('../vendor/proj4.js');
globalThis.Terrang = require('../js/karna.js');
const Sol = require('../js/sol.js');
const Analys = require('../js/analys.js');

// plats, lat, lon, tid (UTC), azimut och höjd i grader
const REF = [
  ['Vimmerby', 57.67, 15.86, '2026-03-20T11:00:00Z', 178.815, 32.26], ['Vimmerby', 57.67, 15.86, '2026-06-21T04:30:00Z', 71.297, 15.998],
  ['Vimmerby', 57.67, 15.86, '2026-06-21T16:00:00Z', 271.113, 27.372], ['Vimmerby', 57.67, 15.86, '2026-09-23T07:15:00Z', 122.071, 18.443],
  ['Vimmerby', 57.67, 15.86, '2026-12-21T11:00:00Z', 181.253, 8.883], ['Vimmerby', 57.67, 15.86, '2030-04-02T10:00:00Z', 161.363, 36.046],
  ['Hudiksvall', 61.73, 17.1, '2026-03-20T11:00:00Z', 180.27, 28.206], ['Hudiksvall', 61.73, 17.1, '2026-06-21T04:30:00Z', 73.488, 17.823],
  ['Hudiksvall', 61.73, 17.1, '2026-06-21T16:00:00Z', 270.104, 26.789], ['Hudiksvall', 61.73, 17.1, '2026-09-23T07:15:00Z', 124.329, 16.742],
  ['Hudiksvall', 61.73, 17.1, '2026-12-21T11:00:00Z', 182.384, 4.805], ['Hudiksvall', 61.73, 17.1, '2030-04-02T10:00:00Z', 163.67, 32.361],
  ['Kiruna', 67.85, 20.22, '2026-03-20T11:00:00Z', 183.623, 22.046], ['Kiruna', 67.85, 20.22, '2026-06-21T04:30:00Z', 78.272, 20.608],
  ['Kiruna', 67.85, 20.22, '2026-06-21T16:00:00Z', 269.927, 25.46], ['Kiruna', 67.85, 20.22, '2026-09-23T07:15:00Z', 128.735, 14.166],
  ['Kiruna', 67.85, 20.22, '2026-12-21T11:00:00Z', 185.238, -1.388], ['Kiruna', 67.85, 20.22, '2030-04-02T10:00:00Z', 168.076, 26.751],
  ['Malmö', 55.6, 13.0, '2026-03-20T11:00:00Z', 175.326, 34.247], ['Malmö', 55.6, 13.0, '2026-06-21T04:30:00Z', 68.534, 13.81],
  ['Malmö', 55.6, 13.0, '2026-06-21T16:00:00Z', 269.838, 28.928], ['Malmö', 55.6, 13.0, '2026-09-23T07:15:00Z', 118.828, 18.135],
  ['Malmö', 55.6, 13.0, '2026-12-21T11:00:00Z', 178.588, 10.95], ['Malmö', 55.6, 13.0, '2030-04-02T10:00:00Z', 157.33, 37.428],
];
let storst = 0;
for (const [plats, lat, lon, tid, az, h] of REF) {
  const p = Sol.solensLage(Date.parse(tid), lat, lon, true);
  const daz = Math.abs(((p.az - az + 540) % 360) - 180), dh = Math.abs(p.h - h);
  storst = Math.max(storst, daz, dh);
  assert.ok(daz < 0.03 && dh < 0.03, `${plats} ${tid}: az ${p.az.toFixed(3)} (${az}), höjd ${p.h.toFixed(3)} (${h})`);
}
// skenbar höjd: refraktionen lyfter solen, mest vid horisonten
const lag = Sol.solensLage(Date.parse('2026-12-21T11:00:00Z'), 61.73, 17.1), lagG = Sol.solensLage(Date.parse('2026-12-21T11:00:00Z'), 61.73, 17.1, true);
assert.ok(lag.h - lagG.h > 0.1 && lag.h - lagG.h < 0.25, 'refraktion vid 5°');

// dagjämningar och solstånd 2026 (UTC), inom två minuter
for (const [k, tid] of [['mars', '2026-03-20T14:46Z'], ['juni', '2026-06-21T08:24Z'], ['sept', '2026-09-23T00:05Z'], ['dec', '2026-12-21T20:50Z']]) {
  assert.ok(Math.abs(Sol.solhandelse(2026, k) - Date.parse(tid)) < 120e3, `${k}: ${new Date(Sol.solhandelse(2026, k)).toISOString()}`);
}

// svensk tid: sommartid 29 mars–25 oktober 2026
assert.strictEqual(Sol.offsetMin(Date.parse('2026-03-29T00:59:00Z')), 60); assert.strictEqual(Sol.offsetMin(Date.parse('2026-03-29T01:00:00Z')), 120);
assert.strictEqual(Sol.offsetMin(Date.parse('2026-10-25T00:59:00Z')), 120); assert.strictEqual(Sol.offsetMin(Date.parse('2026-10-25T01:00:00Z')), 60);
assert.strictEqual(Sol.lokalTillMs(2026, 6, 21, 12), Date.parse('2026-06-21T10:00:00Z')); assert.strictEqual(Sol.lokalTillMs(2026, 12, 21, 12), Date.parse('2026-12-21T11:00:00Z'));

// en dag: Stockholm vid sommarsolståndet, solen upp ca 03:31 och ned ca 22:08 svensk tid
const d = Sol.dagdata(2026, 6, 21, 59.33, 18.07);
const kl = ms => { const l = Sol.lokal(ms); return l.tim * 60 + l.min; };
assert.ok(Math.abs(kl(d.upp) - (3 * 60 + 31)) <= 3 && Math.abs(kl(d.ned) - (22 * 60 + 8)) <= 3, `upp ${kl(d.upp)}, ned ${kl(d.ned)}`);
assert.ok(d.sommartid && d.top.h > 53.5 && d.top.h < 54.5);

// skuggor: en 10 m hög mur (x 49–51, y 20–80) på plan mark, solen i väster på 45°. Skuggan ska nå
// 10 − 0,3 m (mottagarens höjd) öster om muren, också när rutnätet är vridet mot sann nord.
const W = 101, dtm = new Float32Array(W * W).fill(10), dsm = Float32Array.from(dtm);
for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) if (i >= 49 && i <= 51 && 100 - j >= 20 && 100 - j <= 80) dsm[j * W + i] = 20;
const yta = { W, H: W, s: 1, x0: 0, y1: 100, dtm, dsm }, r = { xmin: 0, ymin: 0, xmax: 100, ymax: 100 };
for (const konv of [0, 5, -3]) {
  const sk = Analys.skuggor(yta, r, [{ az: 270 + konv, h: 45 }, { az: 270 + konv, h: -2 }], { konv });
  const rad = Math.round((sk.y1 - 50) / sk.s), m = sk.masker[0];
  let sista = -1; for (let i = 0; i < sk.W; i++) if (m[rad * sk.W + i]) sista = sk.x0 + i * sk.s;
  assert.ok(Math.abs(sista - 60.7) <= 0.75, `konv ${konv}: skuggan når x = ${sista}`);
  assert.ok(!m[rad * sk.W + 40] && m[rad * sk.W + 55], 'ljust väster om muren, skugga öster om');
  assert.ok(sk.masker[1].every(v => v === 1), 'solen under horisonten: allt i skugga');
}
console.log(`sol: ${REF.length} lägen inom ${storst.toFixed(3)}°, dagjämningar, svensk tid och skuggor stämmer`);
