// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
// Laserdatan ruta för ruta (0.13.4): läsningen lämnar punkterna del för del, och ytmodellen,
// trädträffarna och horisontens modell byggs utan att punkterna sparas. Inget tak på antalet.
// Kör: node test/laser.test.js
'use strict';
const assert = require('assert');
globalThis.self = globalThis;
const T = require('../js/karna.js');
globalThis.Terrang = T;
const Analys = require('../js/analys.js');
const Laser = require('../js/laser.js');

// --- Låtsad COPC: varje ruta är 100 × 100 m med fyra noder, en per kvadrant
const RUTOR = [
  { id: 'vast', href: 'https://dl1.lantmateriet.se/laser/vast.copc.laz', x0: 0 },
  { id: 'ost', href: 'https://dl1.lantmateriet.se/laser/ost.copc.laz', x0: 100 },
];
const PER_NOD = 5000;
function nodpunkter(ruta, nx, ny) {
  // jämnt rutnät i kvadranten, var tionde punkt brus (klass 7)
  const x = [], y = [], z = [], k = [];
  for (let n = 0; n < PER_NOD; n++) {
    x.push(ruta.x0 + nx * 50 + (n % 100) * 0.5 + 0.25); y.push(ny * 50 + Math.floor(n / 100) * 1 + 0.5);
    z.push(10 + (n % 7)); k.push(n % 10 === 9 ? 7 : n % 3 ? 1 : 2);
  }
  return { x, y, z, k };
}
let lastaNoder = 0;
globalThis.CopcLib = {
  createLazPerf: async () => ({}),
  Copc: {
    async create(get) { return { info: { cube: [get.ruta.x0, 0, 0, get.ruta.x0 + 100, 100, 100], rootHierarchyPage: 'rot' }, ruta: get.ruta }; },
    async loadHierarchyPage(get) {
      return { nodes: { '0-0-0-0': { pointCount: 0 }, '1-0-0-0': { pointCount: PER_NOD, q: [0, 0] }, '1-1-0-0': { pointCount: PER_NOD, q: [1, 0] },
        '1-0-1-0': { pointCount: PER_NOD, q: [0, 1] }, '1-1-1-0': { pointCount: PER_NOD, q: [1, 1] } }, pages: {} };
    },
    async loadPointDataView(get, copc, node) {
      lastaNoder++;
      const p = nodpunkter(copc.ruta, node.q[0], node.q[1]);
      const kol = { X: p.x, Y: p.y, Z: p.z, Classification: p.k };
      return { pointCount: PER_NOD, getter(n) { if (!kol[n]) throw new Error('saknas'); return i => kol[n][i]; } };
    },
  },
};
// hamtare() i laser.js ger en funktion per adress; låtsasbiblioteket behöver veta vilken ruta det är
const riktigDlUrl = T.dlUrl;
T.dlUrl = href => href;
const fetchRuta = {};
RUTOR.forEach(r => { fetchRuta[r.href] = r; });
const _create = globalThis.CopcLib.Copc.create;
globalThis.CopcLib.Copc.create = async function (get) { get.ruta = aktuell; return _create(get); };
let aktuell = null;

(async () => {
  // --- lasRutvis: del för del, ruta för ruta, utan tak
  const box = { xmin: 20, xmax: 180, ymin: 0, ymax: 100 };
  const delar = [];
  const ordning = [];
  // rutorna läses i tur och ordning: logg säger vilken som är på tur
  const res = await Laser.lasRutvis(RUTOR, box, 'auth', {
    logg: t => { aktuell = RUTOR.find(r => t.includes(r.id)); ordning.push(aktuell.id); },
    klassFilter: k => k !== 7,
    mottag: (d, ruta) => { delar.push({ antal: d.antal, ruta: ruta.id, xmin: Math.min(...d.x), xmax: Math.max(...d.x), brus: d.k.includes(7) }); },
  });
  assert.deepStrictEqual(ordning, ['vast', 'ost']);
  assert.strictEqual(lastaNoder, 8, 'alla åtta noder korsar rutan');
  assert.strictEqual(delar.length, 8, 'en del per nod');
  assert.ok(delar.every(d => !d.brus), 'bruset är borta');
  assert.ok(delar.every(d => d.xmin >= 20 && d.xmax <= 180), 'klippt mot rutan');
  assert.strictEqual(res.antal, delar.reduce((a, d) => a + d.antal, 0));
  assert.deepStrictEqual(res.rutor.map(r => r.id), ['vast', 'ost']);
  assert.strictEqual(res.rutor[0].antal + res.rutor[1].antal, res.antal, 'antalet per ruta');
  assert.ok(res.rutor[0].antal > 0 && res.rutor[1].antal > 0);

  // en nod utanför rutan läses inte
  lastaNoder = 0;
  await Laser.lasRutvis([RUTOR[0]], { xmin: 0, xmax: 40, ymin: 0, ymax: 40 }, 'auth', { logg: () => { aktuell = RUTOR[0]; } });
  assert.strictEqual(lastaNoder, 1, 'bara noden som korsar rutan');

  // lasPunkter (allt i minnet) har taket kvar, lasRutvis har inget
  await assert.rejects(Laser.lasPunkter(RUTOR, box, 'auth', { logg: t => { aktuell = RUTOR.find(r => t.includes(r.id)); }, maxPunkter: 1000 }), /fler än 0 miljoner laserpunkter/);
  const alla = await Laser.lasPunkter(RUTOR, box, 'auth', { logg: t => { aktuell = RUTOR.find(r => t.includes(r.id)); }, klassFilter: k => k !== 7 });
  assert.strictEqual(alla.antal, res.antal);
  assert.ok(alla.x instanceof Float64Array && alla.k instanceof Uint8Array);

  // --- samlare: över taket släpps allt och full blir sann
  const sm = Laser.samlare(10);
  const bit = n => ({ antal: n, x: new Float64Array(n).fill(1), y: new Float64Array(n), z: new Float64Array(n), k: new Uint8Array(n).fill(2), i: new Uint16Array(n), ret: new Uint8Array(n), nret: new Uint8Array(n), t: new Float64Array(n) });
  sm.lagg(bit(6)); assert.strictEqual(sm.antal, 6); assert.strictEqual(sm.full, false);
  assert.strictEqual(sm.klar().antal, 6);
  sm.lagg(bit(6)); assert.strictEqual(sm.full, true); assert.strictEqual(sm.antal, 0);
  sm.lagg(bit(1)); assert.strictEqual(sm.antal, 0, 'en full samlare tar inte emot mer');
  // urval
  const u = Laser.urval({ ...bit(4), x: Float64Array.from([1, 2, 3, 4]) }, x => x > 2);
  assert.deepStrictEqual([...u.x], [3, 4]); assert.strictEqual(u.antal, 2);

  // --- ytmodellen del för del blir samma som i ett svep
  const W = 60, H = 60, dtm = { W, H, s: 1, x0: 0, y1: 59, z: new Float32Array(W * H).fill(100) };
  let fro = 7;
  const slump = () => (fro = (fro * 1103515245 + 12345) % 2147483648) / 2147483648;
  const P = { x: [], y: [], z: [], k: [] };
  const punkt = (x, y, z, k) => { P.x.push(x); P.y.push(y); P.z.push(z); P.k.push(k); };
  // mark överallt, 4 punkter per m²
  for (let j = 0; j < 120; j++) for (let i = 0; i < 120; i++) punkt(i * 0.5 + slump() * 0.4 - 0.2, j * 0.5 + slump() * 0.4 - 0.2, 100, 2);
  // ett träd i (15, 15): kon 12 m hög, kronradie 3 m, markträffar finns under
  for (let n = 0; n < 400; n++) { const a = slump() * 6.283, d = slump() * 3; punkt(15 + Math.cos(a) * d, 15 + Math.sin(a) * d, 100 + 12 * (1 - d / 3.2), 1); }
  // ett hus 10 × 8 m i (35..45, 30..38) med tälttak, 6–9 m högt: täta takträffar och ingen mark under
  for (let j = 0; j < 32; j++) for (let i = 0; i < 40; i++) { const hx = 35 + i * 0.25 + 0.1, hy = 30 + j * 0.25 + 0.1; punkt(hx, hy, 106 + 3 * (1 - Math.max(Math.abs(hx - 40) / 5, Math.abs(hy - 34) / 4)), 1); }
  const hel = { antal: P.x.length, x: Float64Array.from(P.x), y: Float64Array.from(P.y), z: Float64Array.from(P.z), k: Uint8Array.from(P.k) };
  // marken under huset finns inte i en riktig skanning
  const pts = (() => { const b = []; for (let n = 0; n < hel.antal; n++) if (!(hel.k[n] === 2 && hel.x[n] > 35.5 && hel.x[n] < 44.5 && hel.y[n] > 30.5 && hel.y[n] < 37.5)) b.push(n);
    return { antal: b.length, x: Float64Array.from(b, n => hel.x[n]), y: Float64Array.from(b, n => hel.y[n]), z: Float64Array.from(b, n => hel.z[n]), k: Uint8Array.from(b, n => hel.k[n]) }; })();
  const iEttSvep = Analys.ytmodell(dtm, pts, { traffar: true });
  const samlare = Analys.ytsamlare(dtm, { traffar: true });
  const DEL = 997;
  for (let a = 0; a < pts.antal; a += DEL) {
    const b = Math.min(pts.antal, a + DEL);
    samlare.lagg({ antal: b - a, x: pts.x.subarray(a, b), y: pts.y.subarray(a, b), z: pts.z.subarray(a, b), k: pts.k.subarray(a, b) });
  }
  const iDelar = samlare.klar();
  assert.deepStrictEqual(iDelar.ra, iEttSvep.ra, 'höjd över mark lika');
  assert.deepStrictEqual(iDelar.dsm, iEttSvep.dsm, 'ytmodellen lika');
  assert.deepStrictEqual(iDelar.traffar.mark, iEttSvep.traffar.mark, 'markträffarna lika');
  assert.deepStrictEqual(iDelar.traffar.objekt, iEttSvep.traffar.objekt);

  // --- träden: trädet hittas, taket inte, och svaret är detsamma med punkterna som med träffarna
  const urTraffar = Analys.hittaTrad(iDelar);
  const urPunkter = Analys.hittaTrad(iEttSvep, pts);
  assert.deepStrictEqual(urTraffar, urPunkter);
  assert.strictEqual(urTraffar.length, 1, `ett träd, inte taket (${JSON.stringify(urTraffar)})`);
  assert.ok(Math.hypot(urTraffar[0].x - 15, urTraffar[0].y - 15) <= 1.5 && urTraffar[0].hojd > 10 && urTraffar[0].hojd <= 12);
  assert.throws(() => Analys.hittaTrad(Analys.ytmodell(dtm, pts)), /behöver laserpunkterna/);
  // träffarna räknas rätt: 4 markpunkter per m² → omkring 4·π·r² inom radien
  const t = iDelar.traffar.rakna(8, 50, 2);
  assert.ok(t.mark > 40 && t.mark < 60 && t.objekt === 0, `markträffar inom 2 m: ${t.mark}`);
  const tak = iDelar.traffar.rakna(40, 34, 2);
  assert.ok(tak.mark === 0 && tak.objekt > 150, 'bara takträffar mitt på huset');

  // --- horisontens modell i TM del för del
  const m = { E0: 0, N1: 60, w: 60, h: 60, data: new Float32Array(3600).fill(100) };
  const utesluts = (E, N) => E > 30;
  const tmSvep = Analys.ytmodellTM(m, pts, { utesluts });
  const tmSm = Analys.ytsamlareTM(m, { utesluts });
  for (let a = 0; a < pts.antal; a += DEL) {
    const b = Math.min(pts.antal, a + DEL);
    tmSm.lagg({ antal: b - a, x: pts.x.subarray(a, b), y: pts.y.subarray(a, b), z: pts.z.subarray(a, b), k: pts.k.subarray(a, b) });
  }
  assert.deepStrictEqual(tmSm.klar().data, tmSvep.data);
  assert.ok(Math.max(...tmSvep.data.subarray(0, 3600)) > 110, 'trädet är med');
  assert.strictEqual(tmSvep.data[(60 - 34) * 60 + 40], 100, 'huset öster om 30 är uteslutet');

  // --- sektioner: bara punkterna nära linjen behöver sparas
  const nara = Analys.vidSektion([{ a: [0, 15], b: [30, 15] }], 2);
  assert.ok(nara(15, 16.9) && !nara(15, 17.1) && !nara(31, 15) && nara(0, 15));
  const urv = Laser.urval({ ...pts, i: new Uint16Array(pts.antal), ret: new Uint8Array(pts.antal), nret: new Uint8Array(pts.antal), t: new Float64Array(pts.antal) }, nara);
  const s1 = Analys.sektion([0, 15], [30, 15], dtm, pts), s2 = Analys.sektion([0, 15], [30, 15], dtm, urv);
  assert.deepStrictEqual(s2.yta, s1.yta, 'sektionen blir densamma på urvalet');
  assert.strictEqual(s2.punkter.length, s1.punkter.length);
  assert.ok(urv.antal < pts.antal / 5);

  T.dlUrl = riktigDlUrl;
  console.log('laser.test.js: allt godkänt');
})().catch(e => { console.error(e); process.exit(1); });
