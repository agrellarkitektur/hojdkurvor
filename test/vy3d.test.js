/*
 * Enhetstest för 3D-vyns hjälpmoduler (0.9.0): trädmodellerna (js/trad3d.js) och
 * beräkningarna för bilderna (js/bild3d.js). Själva 3D-vyn testas i ui_test.py.
 *   node test/vy3d.test.js
 */
'use strict';
const assert = require('assert');
const Trad3D = require('../js/trad3d.js');
const Bild3D = require('../js/bild3d.js');
let antal = 0;
const prov = (namn, f) => { f(); antal++; console.log('ok', namn); };

prov('trädmodellerna är 1 m höga och breda, med foten i origo', () => {
  for (const art of Trad3D.ARTER) for (const niva of ['enkel', 'detaljerad']) {
    const m = Trad3D.modell(art, niva);
    assert.strictEqual(m.pos.length % 9, 0);
    assert.strictEqual(m.pos.length, m.norm.length);
    assert.strictEqual(m.pos.length, m.farg.length);
    let ymin = Infinity, ymax = -Infinity, rmax = 0;
    for (let i = 0; i < m.pos.length; i += 3) {
      ymin = Math.min(ymin, m.pos[i + 1]); ymax = Math.max(ymax, m.pos[i + 1]);
      rmax = Math.max(rmax, Math.abs(m.pos[i]), Math.abs(m.pos[i + 2]));
    }
    assert(Math.abs(ymin) < 1e-6, `${art} ${niva}: foten i y = 0`);
    assert(Math.abs(ymax - 1) < 1e-6, `${art} ${niva}: toppen i y = 1`);
    assert(Math.abs(rmax - 0.5) < 1e-6, `${art} ${niva}: halva bredden 0,5`);
    for (let i = 0; i < m.norm.length; i += 3) assert(Math.abs(Math.hypot(m.norm[i], m.norm[i + 1], m.norm[i + 2]) - 1) < 1e-4);
  }
});

prov('de enkla modellerna har få ytor, de detaljerade fler', () => {
  for (const art of Trad3D.ARTER) {
    const e = Trad3D.modell(art, 'enkel').pos.length / 9, d = Trad3D.modell(art, 'detaljerad').pos.length / 9;
    assert(e <= 40, `${art}: ${e} ytor enkel`);
    assert(d > 3 * e && d < 800, `${art}: ${d} ytor detaljerad`);
  }
});

prov('ytorna vänder utåt (granens kon)', () => {
  const m = Trad3D.modell('gran', 'enkel');
  for (let i = 0; i < m.pos.length; i += 9) {
    const c = [0, 1, 2].map(k => (m.pos[i + k] + m.pos[i + 3 + k] + m.pos[i + 6 + k]) / 3);
    const ut = c[0] * m.norm[i] + c[2] * m.norm[i + 2] + (c[1] < 0.11 && m.norm[i + 1] < -0.9 ? 1 : 0);
    assert(ut >= -1e-9, 'yta vänd inåt');
  }
});

prov('arten gissas ur formen, variationen är densamma varje gång', () => {
  assert.strictEqual(Trad3D.art({ hojd: 22, krona: 4 }), 'gran');
  assert.strictEqual(Trad3D.art({ hojd: 20, krona: 9 }), 'tall');
  assert.strictEqual(Trad3D.art({ hojd: 9, krona: 8 }), 'lov');
  const a = Trad3D.variation({ x: 540123.4, y: 6428001.2 }), b = Trad3D.variation({ x: 540123.4, y: 6428001.2 });
  assert.deepStrictEqual(a, b);
  assert(a.ljus >= 0.85 && a.ljus <= 1.15 && a.vrid >= 0 && a.vrid < 2 * Math.PI);
});

prov('vand: raderna nerifrån och upp blir uppifrån och ner', () => {
  const px = new Uint8Array([1, 1, 1, 1, 2, 2, 2, 2]);   // 1 × 2, rad 0 är den nedersta
  assert.deepStrictEqual([...Bild3D.vand(px, 1, 2)], [2, 2, 2, 2, 1, 1, 1, 1]);
});

prov('djupet avkodas ur 24 bitar och himlen blir 0', () => {
  const kod = v => { const e = [v, v * 255, v * 65025].map(x => x - Math.floor(x)); e[0] -= e[1] / 255; e[1] -= e[2] / 255; return e.map(x => Math.round(x * 255)); };
  const W = 2, H = 1, px = new Uint8Array(W * H * 4);
  px.set([...kod(0.123456), 255], 0);   // pixel 0 har ett djup, pixel 1 är himmel (alfa 0)
  const d = Bild3D.avkodaDjup(px, W, H, 1000);
  assert(Math.abs(d[0] - 123.456) < 0.01, `djup ${d[0]}`);
  assert.strictEqual(d[1], 0);
});

prov('djupkartan: nära är ljust, långt bort mörkt, himlen svart', () => {
  const W = 4, H = 1, d = new Float32Array([10, 50, 200, 0]);
  const b = Bild3D.djupbild(d, W, H);
  assert(b[0] > b[4] && b[4] > b[8], 'ljusare närmare');
  assert.strictEqual(b[12], 0, 'himlen svart');
  assert.strictEqual(b[0], 255);
});

prov('kanter: där djupet hoppar och där ytan viker, inte på en plan yta', () => {
  const W = 12, H = 12, d = new Float32Array(W * H), n = new Float32Array(W * H * 3);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const c = j * W + i;
    d[c] = i < 6 ? 20 : 40;                         // hopp mellan kolumn 5 och 6
    n[c * 3 + 1] = 1;
    if (j >= 8) { n[c * 3 + 1] = 0; n[c * 3 + 2] = 1; }   // vikning mellan rad 7 och 8
  }
  const k = Bild3D.kanter(d, n, W, H);
  const svart = (i, j) => k[(j * W + i) * 4] === 0;
  assert(svart(5, 3), 'hoppet ger en linje på den närmare sidan');
  assert(!svart(6, 3) && !svart(2, 3), 'inga linjer på plana ytor');
  assert(svart(2, 7) || svart(2, 8), 'vikningen ger en linje');
  const bred = Bild3D.kanter(d, n, W, H, { bredd: 3 });
  assert(bred[(3 * W + 4) * 4] === 0 && bred[(3 * W + 6) * 4] === 0, 'bredare linje vid större bild');
});

prov('storleken följer skalan och håller sig inom gränserna', () => {
  assert.deepStrictEqual(Bild3D.storlek(1000, 600, 3), { bredd: 3000, hojd: 1800, skala: 3 });
  const s = Bild3D.storlek(2560, 1300, 4, { maxSida: 8192, maxPx: 40e6 });
  assert(s.bredd <= 8192 && s.bredd * s.hojd <= 40e6 && s.skala < 4);
  const m = Bild3D.storlek(390, 700, 4, { maxPx: 16e6 });
  assert(m.bredd * m.hojd <= 16e6);
});

prov('realistiska träd: stam och lövkort i 1 × 1 m, bilden har en ruta per art', () => {
  for (const art of Trad3D.ARTER) {
    const m = Trad3D.realistisk(art);
    assert.strictEqual(m.stam.pos.length % 9, 0);
    assert.strictEqual(m.lov.pos.length % 9, 0);
    assert.strictEqual(m.lov.uv.length / 2, m.lov.pos.length / 3);
    let ymin = Infinity, ymax = -Infinity, rmax = 0;
    for (const P of [m.stam.pos, m.lov.pos]) for (let i = 0; i < P.length; i += 3) {
      ymin = Math.min(ymin, P[i + 1]); ymax = Math.max(ymax, P[i + 1]); rmax = Math.max(rmax, Math.abs(P[i]), Math.abs(P[i + 2]));
    }
    assert(ymin >= -1e-6 && Math.abs(ymax - 1) < 1e-6 && Math.abs(rmax - 0.5) < 1e-6, `${art}: ${ymin} ${ymax} ${rmax}`);
    const kort = m.lov.pos.length / 18;
    assert(kort >= 60 && kort <= 150, `${art}: ${kort} kort`);
    // alla kort i artens ruta i lövbilden
    const ruta = { gran: 0, tall: 1, lov: 2 }[art];
    for (let i = 0; i < m.lov.uv.length; i += 2) assert(m.lov.uv[i] * 3 >= ruta && m.lov.uv[i] * 3 <= ruta + 1);
  }
});

console.log(`${antal} prov gick igenom`);
