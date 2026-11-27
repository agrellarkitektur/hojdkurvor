// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Enhetstest för kropparnas geometri (förarbete till 0.17.0, js/kroppgeo.js) och kopplingen till
 * Volym3D, projektfilen och utbytet med cad-apa.
 *   node test/kroppgeo.test.js
 */
'use strict';
const assert = require('assert');
globalThis.proj4 = require('../vendor/proj4.js');
const T = require('../js/karna.js');
const K = require('../js/kroppgeo.js');
globalThis.Kroppgeo = K;
const V = require('../js/volym3d.js');
globalThis.Volym3D = V;
const P = require('../js/projekt.js');
const Kropp = require('../js/kropp.js');
T.registreraZoner();

let antal = 0;
const prov = (namn, f) => { f(); antal++; console.log('ok', namn); };
const nara = (a, b, e = 1e-6, t = '') => assert(Math.abs(a - b) <= e, `${t} ${a} ≠ ${b}`);
const RAD = Math.PI / 180;
const kropp = (prim, extra = {}) => Object.assign({ id: 'k', namn: 'K', golv: 100, takfot: 6, primitiv: Object.assign({ x: 150000, y: 6500000, vrid: 0 }, prim) }, extra);

/** Varje kant ska delas av precis två trianglar (meshen är sluten). */
function sluten(h) {
  const { pos, index } = h.mesh, nyckel = i => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]].map(x => Math.round(x * 1e4)).join(',');
  const kanter = new Map();
  for (let t = 0; t < index.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = nyckel(index[t + k]), b = nyckel(index[t + (k + 1) % 3]), e = a < b ? a + '|' + b : b + '|' + a;
    kanter.set(e, (kanter.get(e) || 0) + 1);
  }
  // en kant kan delas i flera bitar där en yta möter två andra (T-korsning); den räknas inte
  return [...kanter.values()].filter(n => n % 2 === 1).length;
}

prov('volym och area för alla basformer och takformer', () => {
  const fall = [
    ['block platt', { typ: 'block', b: 20, d: 10, tak: 'platt' }, 200, 1200],
    ['sadel', { typ: 'block', b: 20, d: 10, tak: 'sadel', th: 4 }, 200, 1600],
    ['valm', { typ: 'block', b: 20, d: 10, tak: 'sadel', th: 4, gavlar: [{ form: 'tak' }, { form: 'tak' }] }, 200, 1200 + 4 * 10 / 6 * (40 + 10)],
    ['pyramid', { typ: 'block', b: 10, d: 10, tak: 'pyramid', th: 6 }, 100, 600 + 200],
    ['pulpet', { typ: 'block', b: 20, d: 10, tak: 'pulpet', th: 3 }, 200, 1500],
    ['gering', { typ: 'block', b: 20, d: 10, tak: 'platt', gavlar: [{ gering: 30 }, { gering: -20 }] }, 200, 1200],
    ['n-hörn med kon', { typ: 'cylinder', b: 8, n: 6, tak: 'kon', th: 5 }, 1.5 * Math.sqrt(3) * 16, 1.5 * Math.sqrt(3) * 16 * (6 + 5 / 3)],
    ['gård, platt', { typ: 'block', b: 40, d: 30, tak: 'platt', gard: { husdjup: 10 } }, 1000, 6000],
    ['gård, sadel', { typ: 'block', b: 40, d: 30, tak: 'sadel', th: 4, gard: { husdjup: 10 } }, 1000, 6000 + 20 * 100],
  ];
  for (const [namn, prim, a, vol] of fall) {
    const h = K.harledd(kropp(prim));
    nara(K.area(h), a, 1e-6, namn + ' area');
    nara(K.volym(h), vol, 1e-6, namn + ' volym');
  }
  // cylinder och sfär: avrundade, nära det exakta
  const c = K.harledd(kropp({ typ: 'cylinder', b: 8, tak: 'platt' }));
  nara(K.area(c), Math.PI * 16, 0.4, 'rund cylinder'); nara(K.volym(c), K.area(c) * 6, 1e-6, 'rund cylinder volym');
  const s = K.harledd(kropp({ typ: 'sfar', b: 10 }, { takfot: 7 }));
  nara(K.volym(s), Math.PI * 49 * (15 - 7) / 3, 4, 'klotets volym');
  // mur: tre punkter, 0,3 m tjock och 2 m hög
  const m = K.harledd(kropp({ typ: 'mur', pts: [[0, 0], [10, 0], [10, 10]], tjocklek: 0.3 }, { takfot: 2 }));
  nara(K.area(m), 20 * 0.3, 1e-6, 'murens area'); nara(K.volym(m), 20 * 0.3 * 2, 1e-6, 'murens volym');
});

prov('meshen är sluten och normalerna pekar utåt', () => {
  const former = [
    { typ: 'block', b: 20, d: 10, tak: 'sadel', th: 4 }, { typ: 'block', b: 20, d: 10, tak: 'sadel', th: 4, gavlar: [{ form: 'tak', start: 0.4 }, { form: 'egen', lutning: 50 }] },
    { typ: 'block', b: 20, d: 10, tak: 'mansard', th: 5, mansard: { nedreLutning: 70, nedreBredd: 1.2 } }, { typ: 'block', b: 20, d: 10, tak: 'valv', th: 3 },
    { typ: 'block', b: 20, d: 10, tak: 'sadel', th: 4, gavlar: [{ gering: 30 }, { gering: -20 }] }, { typ: 'cylinder', b: 8, tak: 'kupol', th: 4 },
    { typ: 'cylinder', b: 8, n: 5, tak: 'kon', th: 3 }, { typ: 'yta', pts: [[0, 0], [10, 0], [10, 5], [5, 8], [0, 5]], tak: 'pulpet', th: 1 },
    { typ: 'mur', pts: [[0, 0], [10, 0], [10, 10], [0, 12]], tjocklek: 0.3, topp: 'rak' }, { typ: 'sfar', b: 10 },
  ];
  for (const prim of former) {
    const h = K.harledd(kropp(prim, { takfot: prim.typ === 'yta' ? 0.3 : 6 }));
    assert.strictEqual(sluten(h), 0, prim.typ + ' ' + (prim.tak || '') + ': öppna kanter');
    assert(K.volym(h) > 0, prim.typ + ' ' + (prim.tak || '') + ': normalerna inåt');
  }
});

prov('taket i en punkt: sadel, valm och halvvalm', () => {
  const h = K.harledd(kropp({ typ: 'block', b: 20, d: 10, tak: 'sadel', th: 4 }));
  nara(K.hojdVid(h, 150000, 6500000), 110, 1e-9, 'nocken');
  nara(K.hojdVid(h, 150000, 6500000 + 2.5), 108, 1e-9, 'halvvägs ner');
  assert.strictEqual(K.hojdVid(h, 150000 + 11, 6500000), null, 'utanför');
  const v = K.harledd(kropp({ typ: 'block', b: 20, d: 10, tak: 'sadel', th: 4, gavlar: [{ form: 'tak' }, { form: 'tak' }] }));
  nara(K.hojdVid(v, 150000 + 9, 6500000), 106 + 4 * (1 / 5), 1e-9, 'valmen nära gaveln');
  const hv = K.harledd(kropp({ typ: 'block', b: 20, d: 10, tak: 'sadel', th: 4, gavlar: [{ form: 'gavel' }, { form: 'tak', start: 0.5 }] }));
  nara(K.hojdVid(hv, 150000 + 9.9, 6500000 + 4), 106 + 4 * 0.2, 1e-9, 'halvvalmen: gaveln upp till start');
  nara(K.hojdVid(hv, 150000 + 9.9, 6500000), 106 + 2 + 0.1 * 4 / 5, 1e-6, 'halvvalmen: lutar från halva takhöjden, som takfallen');
});

prov('riktningarna: gering, gårdens hörn, polygonens lutning och murens punkter i appens lokala system', () => {
  // gering 30° på änden +u: änden står längre ut på norrsidan (lokalt v > 0)
  const g = K.harledd(kropp({ typ: 'block', b: 20, d: 10, tak: 'platt', gavlar: [{ gering: 0 }, { gering: 30 }] }));
  const xs = g.ringar[0][0].map(q => [Math.round((q[0] - 150000) * 1000) / 1000, Math.round((q[1] - 6500000) * 1000) / 1000]);
  const ost = xs.filter(q => q[0] > 5).sort((a, b) => a[1] - b[1]);
  nara(ost[0][0], 10 - 5 * Math.tan(30 * RAD), 1e-3, 'söder'); nara(ost[1][0], 10 + 5 * Math.tan(30 * RAD), 1e-3, 'norr');
  // gårdens hörn "1,1" = nordost: med gavel i x-led går norra längan igenom till östra kanten
  const B = 20, D = 15, hd = 10, th = 4;
  const gard = gav => K.harledd(kropp({ typ: 'block', b: 2 * B, d: 2 * D, tak: 'sadel', th, gard: { husdjup: hd, gavlar: gav } }));
  const punkt = [150000 + B - 1, 6500000 + D - hd / 2];
  nara(K.hojdVid(gard({}), ...punkt), 106 + th * (1 - 4 / 5), 1e-6, 'gerat hörn');
  nara(K.hojdVid(gard({ '1,1': { x: true, z: false } }), ...punkt), 106 + th, 1e-6, 'gavel i x-led i nordost');
  nara(K.hojdVid(gard({ '1,-1': { x: true, z: false } }), ...punkt), 106 + th * (1 - 4 / 5), 1e-6, 'gaveln i sydost rör inte nordost');
  // polygonens pulpettak stiger åt lutningsriktningen (90° = lokalt norr), också med vridning
  for (const vrid of [0, 40]) {
    const y = K.harledd(kropp({ typ: 'yta', vrid, pts: [[-5, -5], [5, -5], [5, 5], [-5, 5]], tak: 'pulpet', th: 2, lutningsriktning: 90 }, { takfot: 0.3 }));
    const r = vrid * RAD, lok = (u, v) => [150000 + u * Math.cos(r) - v * Math.sin(r), 6500000 + u * Math.sin(r) + v * Math.cos(r)];
    nara(K.hojdVid(y, ...lok(0, 4.9)), 100 + 0.3 + 2 * 9.9 / 10, 1e-6, 'norr ' + vrid);
    nara(K.hojdVid(y, ...lok(0, -4.9)), 100 + 0.3 + 2 * 0.1 / 10, 1e-6, 'söder ' + vrid);
  }
  // murens punkter är lokala (u, v): vriden 90° går muren norrut
  const m = K.harledd(kropp({ typ: 'mur', vrid: 90, pts: [[0, 0], [10, 0]], tjocklek: 0.2 }, { takfot: 2 }));
  const ys = m.ringar[0][0].map(q => q[1] - 6500000), mx = m.ringar[0][0].map(q => q[0] - 150000);
  nara(Math.max(...ys), 10, 1e-6, 'muren slutar 10 m norrut'); nara(Math.max(...mx) - Math.min(...mx), 0.2, 1e-6, 'tjockleken öster–väster');
  // ytterringen moturs, gårdens hål medurs
  const area = r => r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  const gr = gard({}).ringar[0];
  assert(area(gr[0]) > 0 && area(gr[1]) < 0);
});

prov('marken: muren följer marken, sockeln går ner till lägsta marken + 0,5 m', () => {
  const markH = (x) => 100 + (x - 150000) * 0.1;   // lutar 10 % mot öster
  const m = K.harledd(kropp({ typ: 'mur', pts: [[0, 0], [10, 0]], tjocklek: 0.2 }, { takfot: 1.5, golv: 100 }), { markH });
  nara(K.hojdVid(m, 150000 + 9.5, 6500000), 100 + 0.95 + 1.5, 0.02, 'murens topp följer marken');
  const b = K.harledd(kropp({ typ: 'block', b: 10, d: 10, tak: 'platt' }, { golv: 100.8 }), { markH });
  nara(b.sockel, 100.8 - (100 - 0.5 - 0.5), 1e-9, 'sockel till lägsta marken under huset (x = −5) minus 0,5');
  assert(b.mesh.del.includes('sockel'));
  assert.strictEqual(sluten(b), 0); assert(K.volym(b) > 0);
  const fast = K.harledd(kropp({ typ: 'block', b: 10, d: 10, tak: 'platt' }, { golv: 100.8, sockel: 0.2 }), { markH });
  nara(fast.sockel, 0.2);
});

prov('dagens prisma ger samma tak ur meshen som ur takfallens plan', () => {
  for (const takform of ['sadel', 'valm', 'pulpet']) for (const vrid of [0, 33]) {
    const gammal = V.ny({ typ: 'prisma', b: 14, d: 9, hojd: 5, takform, taklutning: 30, vrid }, 150000, 6500000, 100, 'p', 'p');
    const h = K.harledd(gammal), pl = V.plan(gammal);
    nara(K.area(h), 14 * 9, 1e-6, takform + ' area');
    for (let i = -6; i <= 6; i += 1.5) for (let j = -4; j <= 4; j += 1) {
      const r = vrid * RAD, x = 150000 + i * Math.cos(r) - j * Math.sin(r), y = 6500000 + i * Math.sin(r) + j * Math.cos(r);
      nara(K.hojdVid(h, x, y), V.hojdVid(gammal, x, y, pl), 2e-3, `${takform} ${vrid}° (${i}, ${j})`);   // fotavtrycket är avrundat till mm
    }
  }
});

prov('Volym3D: nya kroppar får fotavtryck och dagens takfält, det som inte går räknas ur meshen', () => {
  // ett block med sadel i den nya modellen är samma sak som dagens prisma
  const ny = V.uppdatera(kropp({ typ: 'block', b: 14, d: 9, tak: 'sadel', th: 4.5 * Math.tan(30 * RAD), vrid: 20 }));
  const gammal = V.ny({ typ: 'prisma', b: 14, d: 9, hojd: 6, takform: 'sadel', taklutning: 30, vrid: 20 }, 150000, 6500000, 100, 'p', 'p');
  assert.strictEqual(ny.takform, 'sadel'); nara(ny.taklutning, 30, 1e-4); assert.strictEqual(ny.nockriktning, 20);
  ny.fotavtryck.forEach((q, i) => { nara(q[0], gammal.fotavtryck[i][0], 1e-3); nara(q[1], gammal.fotavtryck[i][1], 1e-3); });
  assert.strictEqual(V.nyForm(ny), false);
  const valm = V.uppdatera(kropp({ typ: 'block', b: 14, d: 9, tak: 'sadel', th: 3, gavlar: [{ form: 'tak' }, { form: 'tak' }] }));
  assert.strictEqual(valm.takform, 'valm'); assert.strictEqual(V.nyForm(valm), false);
  // pulpet: samma högsida som meshen
  const pu = V.uppdatera(kropp({ typ: 'block', b: 14, d: 9, tak: 'pulpet', th: 3, vrid: 10 }));
  const hp = K.harledd(pu), r = 10 * RAD, q = (u, v) => [150000 + u * Math.cos(r) - v * Math.sin(r), 6500000 + u * Math.sin(r) + v * Math.cos(r)];
  for (const v of [-4, 0, 4]) nara(V.hojdVid(pu, ...q(0, v)), K.hojdVid(hp, ...q(0, v)), 2e-3, 'pulpet v=' + v);
  // halvvalm, mansard, gård och mur går inte att säga med dagens fält
  const hv = V.uppdatera(kropp({ typ: 'block', b: 14, d: 9, tak: 'sadel', th: 3, gavlar: [{ form: 'tak', start: 0.5 }, null] }));
  assert.strictEqual(V.nyForm(hv), true); assert.strictEqual(V.plan(hv), null); assert.strictEqual(V.takytor(hv), null);
  nara(V.hojdVid(hv, 150000, 6500000), 109, 1e-9, 'nocken ur meshen');
  nara(V.topp(hv), 109, 1e-9);
  const g = V.uppdatera(kropp({ typ: 'block', b: 40, d: 30, tak: 'platt', gard: { husdjup: 10 } }));
  assert.strictEqual(V.nyForm(g), true);
  assert.strictEqual(V.inutiVolym(g, 150000, 6500000, 102), false, 'gården är inte inne i huset');
  assert.strictEqual(V.inutiVolym(g, 150000 + 17, 6500000, 102), true, 'längan är det');
  const mur = V.uppdatera(kropp({ typ: 'mur', pts: [[0, 0], [10, 0]], tjocklek: 0.2 }, { takfot: 2 }));
  assert.strictEqual(mur.fotavtryck.length, 4); assert.strictEqual(V.nyForm(mur), true);
  // planvyn låter nya kroppar vara
  const fore = JSON.stringify(g);
  assert.strictEqual(Kropp.satHorn(g, [[0, 0], [1, 0], [1, 1], [0, 1]]), false);
  Kropp.satTakform(g, 'sadel');
  assert.strictEqual(JSON.stringify(g), fore);
  // dagens volymer får också en härledd mesh: polygon med sadeltak
  const pol = { id: 'q', golv: 100, takfot: 5, takform: 'sadel', taklutning: 30, nockriktning: 0, fotavtryck: [[0, 0], [10, 0], [10, 8], [0, 8]] };
  const hpol = V.harledd(pol);
  nara(K.hojdVid(hpol, 5, 4), V.hojdVid(pol, 5, 4), 1e-9, 'polygonens nock');
  assert(K.volym(hpol) > 400);
});

prov('projektfilen: fälten bevaras, tal kontrolleras och en mur utan fotavtryck får ett', () => {
  const d = P.nytt({ namn: 'Ny modell' });
  d.inmatning.volymer = [
    Object.assign(kropp({ typ: 'block', b: 40, d: 30, tak: 'sadel', th: 4, gard: { husdjup: 10, gavlar: { '1,1': { x: true, z: false }, 'fel': { x: true } } }, gavlar: [{ form: 'egen', lutning: 50, start: 0.3, gering: 12 }] }), { roll: 'omgivning', sockel: null, grupp: 'g1', last: true }),
    kropp({ typ: 'mur', pts: [[0, 0], [10, 0], 'x', [10, 5]], tjocklek: 0.25, topp: 'rak' }, { id: 'mur', takfot: 1.2 }),
    kropp({ typ: 'block', b: '"><img src=x onerror=alert(1)>', d: 8, tak: 'kupol<script>' }, { id: 'farlig', fotavtryck: [[0, 0], [1, 0], [1, 1]] }),
  ];
  const l = P.las(JSON.parse(JSON.stringify(d)));
  const [g, m, f] = l.inmatning.volymer;
  assert.deepStrictEqual(g.primitiv.gard.gavlar, { '1,1': { x: true, z: false } });
  assert.deepStrictEqual(g.primitiv.gavlar[0], { form: 'egen', lutning: 50, start: 0.3, gering: 12 });
  assert.strictEqual(g.roll, 'omgivning'); assert.strictEqual(g.grupp, 'g1'); assert.strictEqual(g.last, true);
  assert.strictEqual(m.primitiv.pts.length, 3, 'punkten som inte är en punkt tas bort');
  assert(m.fotavtryck && m.fotavtryck.length === 6, 'muren fick ett fotavtryck ur parametrarna');
  assert.strictEqual(f.primitiv.b, undefined, 'text i ett tal tas bort'); assert.strictEqual(f.primitiv.tak, undefined);
  // fel typ eller saknad mitt: primitiven blir null
  assert.strictEqual(P.rensaPrimitiv({ typ: 'hus', x: 1, y: 2 }), null);
  assert.strictEqual(P.rensaPrimitiv({ typ: 'block', x: 'a', y: 2 }), null);
  // mellan zon och SWEREF 99 TM: lokala punkter, ändar och gård följer med oförändrade, mitten och vridningen räknas om
  const tillTM = T.omvandlare(3007, 3006).forward, franTM = T.omvandlare(3006, 3007).forward;
  const v = V.uppdatera(kropp({ typ: 'block', b: 40, d: 30, x: 150050, y: 6430250, vrid: 15, tak: 'sadel', th: 4, gard: { husdjup: 10 } }));
  const iTM = P.flyttaVolym(v, tillTM), tillbaka = P.flyttaVolym(iTM, franTM);
  assert.deepStrictEqual(iTM.primitiv.gard, v.primitiv.gard);
  nara(tillbaka.primitiv.vrid, 15, 1e-5); nara(tillbaka.primitiv.x, 150050, 0.002); nara(tillbaka.primitiv.y, 6430250, 0.002);
  const omraknad = V.uppdatera(JSON.parse(JSON.stringify(iTM)));
  omraknad.fotavtryck.forEach((q, i) => assert(Math.hypot(q[0] - iTM.fotavtryck[i][0], q[1] - iTM.fotavtryck[i][1]) < 0.01, 'hörn ' + i));
});

prov('tillbaka från cad-apa: oförändrade kroppar behåller sina parametrar', () => {
  const c = V.ny({ typ: 'cylinder', diam: 10, hojd: 4 }, 150000, 6500000, 50, 'c', 'Torn');
  c.roll = 'omgivning';
  const fran = { id: 'c', namn: 'Torn', fotavtryck: c.fotavtryck.map(q => [q[0] + 0.0004, q[1]]), golv: 50, takfot: 4, takform: 'platt', taklutning: 0, nockriktning: null };
  const b = V.behallForm(fran, c);
  assert.strictEqual(b.primitiv.typ, 'cylinder'); assert.strictEqual(b.roll, 'omgivning');
  // ändrad i cad-apa: blir en polygon som förut
  const andrad = Object.assign({}, fran, { takfot: 5 });
  assert.strictEqual(V.behallForm(andrad, c).primitiv, undefined);
  const flyttad = Object.assign({}, fran, { fotavtryck: fran.fotavtryck.map(q => [q[0] + 1, q[1]]) });
  assert.strictEqual(V.behallForm(flyttad, c).primitiv, undefined);
  // samma hörn i annan ordning räknas som samma fotavtryck
  const vriden = Object.assign({}, fran, { fotavtryck: fran.fotavtryck.slice(5).concat(fran.fotavtryck.slice(0, 5)) });
  assert.strictEqual(V.behallForm(vriden, c).primitiv.typ, 'cylinder');
});

console.log(`${antal} prov gick igenom`);
