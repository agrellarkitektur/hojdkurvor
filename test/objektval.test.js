// Kör med: node test/objektval.test.js
// Egna val för träd och hus (0.11.0): dölja, rätta höjd, krona och art, känna igen trädet på nytt
// och skära bort dolda träd och hus ur ytmodellen för skuggorna.
const assert = require('assert');
const O = require('../js/objektval.js');
const T3 = require('../js/trad3d.js');

const trad = [
  { x: 100.04, y: 200.02, zMark: 50, hojd: 18, krona: 5 },
  { x: 110, y: 200, zMark: 50, hojd: 9, krona: 6 },
  { x: 120, y: 200, zMark: 50, hojd: 12, krona: 4 },
];
const val = {};
O.sattTrad(val, trad[0], { dolt: true });
O.sattTrad(val, trad[1], { hojd: 11.04, art: 'bjork', okant: 1 });
assert.deepStrictEqual(Object.keys(val).sort(), ['100,200', '110,200']);
assert.deepStrictEqual(val['110,200'], { hojd: 11, art: 'bjork' });

let r = O.tillampaTrad(trad, val);
assert.strictEqual(r.trad.length, 2); assert.strictEqual(r.dolda.length, 1);
assert.strictEqual(r.trad[0].hojd, 11); assert.strictEqual(r.trad[0].andrat, true); assert.deepStrictEqual(r.trad[0].ra, { hojd: 9, krona: 6 });
assert.strictEqual(r.trad[1], trad[2], 'oändrade träd ska vara samma objekt');
assert.strictEqual(trad[1].hojd, 9, 'originalet ändras inte');
assert.strictEqual(T3.typ(r.trad[0]), 'bjork');
// medDolda: alla, de dolda markerade
r = O.tillampaTrad(trad, val, { medDolda: true });
assert.strictEqual(r.trad.length, 3); assert.strictEqual(r.trad[0].dolt, true);

// samma träd hittat en bit därifrån nästa gång (inom 0,6 m) känns igen, längre bort inte
assert.strictEqual(O.tillampaTrad([{ x: 100.4, y: 200.3, hojd: 18, krona: 5 }], val).dolda.length, 1);
assert.strictEqual(O.tillampaTrad([{ x: 101, y: 200, hojd: 18, krona: 5 }], val).dolda.length, 0);
// ett nytt val för ett träd som flyttat lite ersätter det gamla
O.sattTrad(val, { x: 100.3, y: 200.1 }, { hojd: 20 });
assert.ok(!val['100,200'] && val['100.3,200.1'].hojd === 20);
// tomt val tar bort posten
O.sattTrad(val, trad[1], {});
assert.ok(!val['110,200']);

// hus
const hus = [{ id: 'a', fotavtryck: [[0, 0], [10, 0], [10, 8], [0, 8]] }, { id: 'b', fotavtryck: [[20, 0], [30, 0], [30, 8], [20, 8]] }, { fotavtryck: [[40, 0], [41, 0], [41, 1]] }];
const hr = O.tillampaHus(hus, { a: { dolt: true } });
assert.deepStrictEqual(hr.byggnader.map(b => b.id), ['b', undefined]);
assert.deepStrictEqual(hr.dolda.map(b => b.id), ['a']);
assert.strictEqual(O.tillampaHus(hus, { a: { dolt: true } }, { medDolda: true }).byggnader.length, 3);

// skära bort ur ytmodellen: 1 m rutor, marken 50, allt annat 60
const W = 60, H = 20, y = { W, H, s: 1, x0: 0, y1: 19, dtm: new Float32Array(W * H).fill(50) };
const dsm = new Float32Array(W * H).fill(60);
const ut = O.skarBort(y, dsm, { hus: [hus[0]], trad: [{ x: 50, y: 10, krona: 4 }] });
const z = (x, yy) => ut[(19 - yy) * W + x];
assert.strictEqual(z(5, 4), 50, 'inne i huset');
assert.strictEqual(z(10, 8), 50, 'husets hörn');
assert.strictEqual(z(15, 4), 60, 'utanför huset');
assert.strictEqual(z(50, 10), 50, 'trädets mitt');
assert.strictEqual(z(52, 10), 50, 'inom kronan');
assert.strictEqual(z(54, 10), 60, 'utanför kronan');
assert.strictEqual(dsm[0], 60, 'originalet ändras inte');
assert.strictEqual(O.skarBort(y, dsm, {}), dsm);

console.log('objektval: ok');
