// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
// Kör med: node test/vagar.test.js
// Vägar (0.11.0): bil- och gångvägar, bredden ur OSM eller schablonen, mätningen i ett låtsat
// ortofoto och vägytorna (ihopslagna i korsningar, hål i en rondell).
const assert = require('assert');
globalThis.proj4 = require('../vendor/proj4.js');
globalThis.Terrang = require('../js/karna.js');
globalThis.Dxf = require('../js/dxf.js');
const V = require('../js/vagar.js');
Terrang.registreraZoner();

const nara = (a, b, tol, txt) => assert.ok(Math.abs(a - b) <= tol, `${txt}: ${a} borde vara ${b} ± ${tol}`);

// klassning och slag
assert.strictEqual(V.slag(V.klass('residential')), 'bil');
assert.strictEqual(V.slag(V.klass('track')), 'bil');
assert.strictEqual(V.slag(V.klass('footway')), 'gang');
assert.strictEqual(V.slag(V.klass('cycleway')), 'gang');
assert.strictEqual(V.klass('construction'), null);

// bredden: width går före lanes, som går före schablonen
assert.strictEqual(V.tolkaBredd('5,5 m'), 5.5);
assert.strictEqual(V.tolkaBredd('bred'), null);
assert.deepStrictEqual(V.schablon({ lager: 'VAG_LOKALGATA', typ: 'residential', bredd: '6' }), { bredd: 6, kalla: 'osm' });
assert.deepStrictEqual(V.schablon({ lager: 'VAG_HUVUDVAG', typ: 'secondary', korfalt: '2' }), { bredd: 7, kalla: 'korfalt' });
assert.deepStrictEqual(V.schablon({ lager: 'VAG_LOKALGATA', typ: 'residential' }), { bredd: 5.5, kalla: 'schablon' });
assert.strictEqual(V.schablon({ lager: 'VAG_GANG_CYKEL', typ: 'footway', korfalt: '2' }).kalla, 'schablon');

// Overpass-svaret tolkas med taggarna
const tillZon = p => p;   // låtsas att svaret redan är i zonen
const d = { elements: [
  { type: 'way', tags: { highway: 'residential', name: 'Skolvägen', width: '6', lanes: '2' }, geometry: [{ lon: 0, lat: 50 }, { lon: 100, lat: 50 }] },
  { type: 'way', tags: { highway: 'footway' }, geometry: [{ lon: 50, lat: 0 }, { lon: 50, lat: 100 }] },
] };
const linjer = V.tolka(d, tillZon, { xmin: 0, ymin: 0, xmax: 100, ymax: 100 });
assert.strictEqual(linjer.length, 2);
assert.strictEqual(linjer[0].slag, 'bil'); assert.strictEqual(linjer[0].bredd, '6'); assert.strictEqual(linjer[0].korfalt, '2');
assert.strictEqual(linjer[1].slag, 'gang');

// stationer var 2 m längs en bruten linje
const st = V.stationer([[0, 0], [5, 0], [5, 5]], 2);
assert.ok(st.length >= 5 && st.length <= 7, 'antal stationer ' + st.length);
for (let k = 1; k < st.length; k++) nara(Math.hypot(st[k].x - st[k - 1].x, st[k].y - st[k - 1].y), 2, 1.1, 'avstånd mellan stationer');

// Låtsat ortofoto: grå väg 6,4 m bred (y 47–53,4) på grönt, 0,25 m pixlar. OSM-linjen ligger 1 m för lågt (y = 49,2).
const s = 0.25, W = 400, H = 400;
const bild = { W, H, s, x0: s / 2, y1: 100 - s / 2, rgba: new Uint8ClampedArray(W * H * 4) };
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const x = bild.x0 + i * s, y = bild.y1 - j * s, k = (j * W + i) * 4;
  const vag = y >= 47 && y <= 53.4, brus = ((i * 7 + j * 13) % 9) - 4;
  const c = vag ? [118, 116, 112] : [70, 112, 52];
  bild.rgba[k] = c[0] + brus; bild.rgba[k + 1] = c[1] + brus; bild.rgba[k + 2] = c[2] + brus; bild.rgba[k + 3] = 255;
}
const gata = { lager: 'VAG_LOKALGATA', slag: 'bil', typ: 'residential', pts: [[5, 49.2], [95, 49.2]] };
const p = V.profil(gata, bild);
assert.strictEqual(p.kalla, 'ortofoto');
nara(p.median, 6.4, 0.6, 'mätt bredd');
// mittlinjen flyttas mot vägbanans mitt (50,2), högst 1,5 m
const mittY = p.pts.reduce((a, q) => a + q[1], 0) / p.pts.length;
nara(mittY, 50.2, 0.4, 'förskjuten mittlinje');
// utan bild: schablonen
const p0 = V.profil(gata, null);
assert.strictEqual(p0.kalla, 'schablon'); assert.strictEqual(p0.median, 5.5);
// OSM:s width går före bilden
assert.strictEqual(V.profil(Object.assign({}, gata, { bredd: '8' }), bild).kalla, 'osm');
// gångvägar mäts inte
assert.strictEqual(V.profil({ lager: 'VAG_GANG_CYKEL', slag: 'gang', typ: 'footway', pts: [[5, 50], [95, 50]] }, bild).kalla, 'schablon');
// där bilden inte visar någon väg (bara grönt) blir det schablonen
assert.strictEqual(V.profil({ lager: 'VAG_LOKALGATA', slag: 'bil', typ: 'residential', pts: [[5, 20], [95, 20]] }, bild).kalla, 'schablon');

// Ytorna: en korsning blir en enda yta, med rätt area ungefär
const r = { xmin: 0, ymin: 0, xmax: 100, ymax: 100 };
const korsning = [
  { slag: 'bil', pts: [[0, 50], [100, 50]], bredd: [6, 6] },
  { slag: 'bil', pts: [[50, 0], [50, 100]], bredd: [6, 6] },
  { slag: 'gang', pts: [[10, 10], [10, 90]], bredd: [2, 2] },
];
const y = V.ytor(korsning, r, { cell: 0.25 });
assert.strictEqual(y.bil.length, 1, 'korsningen ska vara en yta');
nara(y.bil[0].yta, 2 * 100 * 6 - 36, 25, 'korsningens yta');
assert.strictEqual(y.gang.length, 1);
nara(y.gang[0].yta, 160, 8, 'gångvägens yta');

// En rondell (ring) får ett hål
const ring = [];
for (let a = 0; a <= 64; a++) ring.push([50 + 20 * Math.cos(a / 64 * 2 * Math.PI), 50 + 20 * Math.sin(a / 64 * 2 * Math.PI)]);
const yr = V.ytor([{ slag: 'bil', pts: ring, bredd: ring.map(() => 6) }], r, { cell: 0.25 });
assert.strictEqual(yr.bil.length, 1);
assert.strictEqual(yr.bil[0].ringar.length, 2, 'rondellen ska ha ett hål');
nara(yr.bil[0].yta, Math.PI * (23 * 23 - 17 * 17), 15, 'rondellens yta');

// Utkastet och DXF:en
const res = { linjer: [gata, { lager: 'VAG_GANG_CYKEL', slag: 'gang', typ: 'footway', pts: [[50, 5], [50, 95]] }] };
const u = V.utkast(res, r, bild, { cell: 0.25 });
assert.strictEqual(u.matta, 1); assert.strictEqual(u.bil.length, 1); assert.strictEqual(u.gang.length, 1);
res.ytor = u;
const bilDxf = V.dxf(res, r, 0, 0, { slag: 'bil' }), gangDxf = V.dxf(res, r, 0, 0, { slag: 'gang' });
assert.ok(bilDxf.includes('VAG_YTA_BIL') && bilDxf.includes('VAG_LOKALGATA') && !bilDxf.includes('VAG_GANG_CYKEL'));
assert.ok(gangDxf.includes('VAG_YTA_GANG') && gangDxf.includes('VAG_GANG_CYKEL') && !gangDxf.includes('VAG_LOKALGATA'));

// Sträckor mellan korsningar (0.14.3, AJ): en T-korsning där linjerna delar en punkt
const tLinjer = [
  { lager: 'VAG_LOKALGATA', typ: 'residential', namn: 'Storgatan', pts: [[0, 50], [50, 50], [100, 50]] },
  { lager: 'VAG_LOKALGATA', typ: 'residential', namn: 'Tvärgatan', pts: [[50, 50], [50, 0]] },
  { lager: 'VAG_GANG_CYKEL', typ: 'footway', namn: '', pts: [[50, 50], [50, 100]] },
];
const sk = V.stracker(tLinjer);
assert.strictEqual(sk.stracker.length, 4, 'Storgatan delas i korsningen');
assert.deepStrictEqual(sk.noder.bil, [[50, 50]]);
assert.deepStrictEqual(sk.noder.gang, [], 'gångvägen räknas inte som korsning för bilvägarna');
// en bredd för hela sträckan, också där bilden stör
const pk = V.profil(gata, bild);
assert.ok(pk.bredd.every(b => b === pk.median), 'samma bredd längs sträckan');
assert.strictEqual(pk.median % 0.5, 0, 'avrundad till halv meter');
// hörnen i korsningen rundas av: ytan växer med två hörn à R²(1 − π/4)
const tProf = sk.stracker.filter(l => V.slag(l.lager) === 'bil').map(l => ({ slag: 'bil', pts: l.pts, bredd: l.pts.map(() => 6) }));
const utan = V.ytor(tProf, r, { cell: 0.25, radie: { bil: 0 } }), med = V.ytor(tProf, r, { cell: 0.25, noder: sk.noder });
assert.strictEqual(med.bil.length, 1);
const R = V.RADIE.bil;
nara(med.bil[0].yta - utan.bil[0].yta, 2 * R * R * (1 - Math.PI / 4), 4, 'avrundade hörn');
// vägen når fortfarande utsnittets kant (ingen avrundning av vägänden vid kanten)
assert.ok(med.bil[0].ringar[0].some(q => q[0] < 0.5), 'vägen går ut till kanten');
// två parallella gator 9 m isär växer inte ihop långt från korsningar
const par = [{ slag: 'bil', pts: [[0, 40], [100, 40]], bredd: [5, 5] }, { slag: 'bil', pts: [[0, 49], [100, 49]], bredd: [5, 5] }];
assert.strictEqual(V.ytor(par, r, { cell: 0.25, noder: { bil: [[50, 10]], gang: [] } }).bil.length, 2, 'parallella gator hålls isär');

// 0.16.5 (DU): en Overpass som aldrig svarar ger ett fel efter tidsgränsen, och reservservern provas
(async () => {
  globalThis.self = globalThis; self.TERRANG_OVERPASS_TID = 50; self.TERRANG_PAUSER = [1, 1];
  const fraga = [];
  globalThis.fetch = (url, o) => { fraga.push(url); return new Promise((_, nej) => o.signal.addEventListener('abort', () => nej(new Error('abort')))); };
  const utsnitt = { xmin: 600000, ymin: 6400000, xmax: 600100, ymax: 6400100 };
  await assert.rejects(V.hamta({ utsnitt, epsg: 3006 }), /svarade inte inom 0 s, inte heller reservservern/);
  assert.strictEqual(fraga.length, 2, 'en fråga per server, inga nya försök mot en server som inte svarar');
  // reservservern svarar
  let n = 0;
  globalThis.fetch = (url, o) => (++n === 1 ? new Promise((_, nej) => o.signal.addEventListener('abort', () => nej(new Error('abort'))))
    : Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify({ elements: [] }) }));
  const v = await V.hamta({ utsnitt, epsg: 3006 });
  assert.strictEqual(v.antal, 0);
  console.log('vagar: ok');
})().catch(e => { console.error(e); process.exit(1); });
