// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Enhetstest för byggnadskropparna (0.14.0, js/kropp.js): inmatningsraden, måtten till tomtgräns
 * (två gränser, två mått från långsidan och ett från kortsidan), måtten mellan kroppar, yttermåtten,
 * FG-texten, status i analyserna, nock och entré när kroppen ändras, och kroppen ur ett befintligt hus.
 *   node test/kropp.test.js
 */
'use strict';
const assert = require('assert');
const K = require('../js/kropp.js');
const V = require('../js/volym3d.js');
let antal = 0;
const prov = (namn, f) => { f(); antal++; console.log('ok', namn); };
const nara = (a, b, e = 1e-6, t = '') => assert(Math.abs(a - b) <= e, `${t} ${a} ≠ ${b}`);
const rekt = (id, x, y, b, d, extra = {}) => Object.assign(K.nyRektangel([x, y], [1, 0], [0, 1], b, d, { id, namn: id, golv: 32.8, takfot: 3, takform: 'sadel' }), extra);
// tomten: 40 × 30 m med hörnet i (0, 0), som en polylinje runt om
const TOMT = [{ pts: [[0, 0], [40, 0], [40, 30], [0, 30], [0, 0]] }];

prov('inmatningsraden: mått, relativt, längd och vinkel, absolut', () => {
  assert.deepStrictEqual(K.tolka('12,6x9'), { typ: 'matt', b: 12.6, d: 9 });
  assert.deepStrictEqual(K.tolka('12,6 × 9'), { typ: 'matt', b: 12.6, d: 9 });
  assert.deepStrictEqual(K.tolka('8*5,5'), { typ: 'matt', b: 8, d: 5.5 });
  let r = K.tolka('@3;4', { bas: [10, 10], axel: 0 });
  assert.deepStrictEqual(r.p, [13, 14]);
  r = K.tolka('@3,4', { bas: [10, 10], axel: 0 });
  assert.deepStrictEqual(r.p, [13, 14], 'med @ delar kommat talparet');
  r = K.tolka('@3;0', { bas: [0, 0], axel: 90 });
  nara(r.p[0], 0, 1e-9); nara(r.p[1], 3, 1e-9);
  r = K.tolka('6<90', { bas: [1, 1], axel: 0 });
  nara(r.p[0], 1, 1e-9); nara(r.p[1], 7, 1e-9);
  r = K.tolka('5', { bas: [0, 0], mot: [0, -1] });
  assert.deepStrictEqual(r.p, [0, -5], 'ensam längd mot markören');
  r = K.tolka('12,6', { bas: [0, 0], mot: [1, 0] });
  nara(r.p[0], 12.6, 1e-9, 'utan @ är kommat ett decimalkomma');
  r = K.tolka('153410;6432110');
  assert.deepStrictEqual(r, { typ: 'punkt', p: [153410, 6432110], absolut: true });
  r = K.tolka('153410,5 6432110,25');
  assert.deepStrictEqual(r.p, [153410.5, 6432110.25]);
  assert.strictEqual(K.tolka('hej'), null);
  assert.strictEqual(K.tolka('6<90'), null, 'vinkel kräver en förra punkt');
  assert.strictEqual(K.tolka('0x5'), null);
});

prov('måtten till tomtgräns: två gränser, två från långsidan och ett från kortsidan', () => {
  const v = rekt('h', 5, 6, 12.8, 9.4);
  const m = K.gransmatt(v.fotavtryck, TOMT);
  assert.strictEqual(m.length, 3);
  // långsidan (12,8) mot södra gränsen från båda hörnen, kortsidan mot västra från det gemensamma hörnet
  nara(m[0].d, 6, 1e-9); nara(m[1].d, 6, 1e-9); nara(m[2].d, 5, 1e-9);
  assert.deepStrictEqual(m[0].fran, [5, 6]); assert.deepStrictEqual(m[0].till, [5, 0]);
  assert.deepStrictEqual(m[1].fran, [17.8, 6]); assert.deepStrictEqual(m[1].till, [17.8, 0]);
  assert.deepStrictEqual(m[2].fran, [5, 6], 'två mått till samma hörn'); assert.deepStrictEqual(m[2].till, [0, 6]);
  // närmare norra och östra gränsen: måtten byter sida
  const n = K.gransmatt(rekt('n', 25, 18, 12, 9).fotavtryck, TOMT);
  nara(n[0].d, 3, 1e-9); nara(n[1].d, 3, 1e-9); nara(n[2].d, 3, 1e-9);
  assert(n.slice(0, 2).every(x => Math.abs(x.till[1] - 30) < 1e-9), 'långsidan mot norra gränsen');
  assert(Math.abs(n[2].till[0] - 40) < 1e-9, 'kortsidan mot östra gränsen');
  // en kortare sida mot en närmare gräns: långsidan får ändå två mått
  const s = K.gransmatt(rekt('s', 1, 10, 6, 14).fotavtryck, TOMT);
  assert(Math.abs(s[0].till[0]) < 1e-9 && Math.abs(s[1].till[0]) < 1e-9, 'långsidan (14 m) mot västra gränsen');
  // en vriden kropp mäts vinkelrätt mot gränsen
  const vr = rekt('v', 10, 10, 10, 6); V.vrid(vr, 10, 15, 13);
  const vm = K.gransmatt(vr.fotavtryck, TOMT);
  assert.strictEqual(vm.length, 3);
  vm.forEach(x => { const d = [x.till[0] - x.fran[0], x.till[1] - x.fran[1]]; assert(Math.abs(d[0]) < 1e-9 || Math.abs(d[1]) < 1e-9, 'vinkelrätt mot gränsen'); });
  assert.deepStrictEqual(K.gransmatt(vr.fotavtryck, []), []);
});

prov('måtten till tomtgräns slutar på gränsen när gränsen har en brytpunkt (0.16.3, B2)', () => {
  const hus = [[2, 0], [18, 0], [18, 4], [2, 4]];
  const gr = [[[-5, 10], [10, 10], [25, 5]], [[-5, -20], [-5, 10]], [[-5, -20], [25, -20]], [[25, -20], [25, 5]]];
  // avståndet från punkten p till gränslinjen
  const avst = p => Math.min(...gr.flatMap(g => g.slice(1).map((b, i) => { const a = g[i], e = [b[0] - a[0], b[1] - a[1]], l2 = e[0] ** 2 + e[1] ** 2;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * e[0] + (p[1] - a[1]) * e[1]) / l2)); return Math.hypot(p[0] - a[0] - e[0] * t, p[1] - a[1] - e[1] * t); })));
  const m = K.gransmatt(hus, gr);
  assert(m.length >= 2, `${m.length} mått`);
  m.forEach(x => assert(avst(x.till) < 0.01, `måttet från ${x.fran} slutar ${avst(x.till).toFixed(2)} m från gränsen`));
  // slumpade tomter: inget mått slutar utanför gränsen
  let fro = 7; const sl = () => (fro = (fro * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 300; k++) {
    const n = 4 + Math.floor(sl() * 3), ring = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI + sl() * 0.6, r = 18 + sl() * 14; ring.push([Math.cos(a) * r, Math.sin(a) * r]); }
    ring.push(ring[0]);
    const b = 4 + sl() * 8, d = 3 + sl() * 5, h = [[-b / 2, -d / 2], [b / 2, -d / 2], [b / 2, d / 2], [-b / 2, d / 2]];
    for (const x of K.gransmatt(h, [ring])) {
      const dd = Math.min(...ring.slice(1).map((q, i) => { const a = ring[i], e = [q[0] - a[0], q[1] - a[1]], l2 = e[0] ** 2 + e[1] ** 2;
        const t = Math.max(0, Math.min(1, ((x.till[0] - a[0]) * e[0] + (x.till[1] - a[1]) * e[1]) / l2)); return Math.hypot(x.till[0] - a[0] - e[0] * t, x.till[1] - a[1] - e[1] * t); }));
      assert(dd < 0.05, `tomt ${k}: måttet slutar ${dd.toFixed(2)} m från gränsen`);
    }
  }
});

prov('BYA med Lantmäteriets hus på fastigheten som befintliga (0.16.3)', () => {
  const tomt = { beteckning: 'Kinda Tomten 1:2', etikett: '1:2', ringar: [[[0, 0], [40, 0], [40, 30], [0, 30]]] };
  const granne = { beteckning: 'Kinda Tomten 1:3', etikett: '1:3', ringar: [[[40, 0], [80, 0], [80, 30], [40, 30]]] };
  const ny = { id: 'n', fotavtryck: [[5, 5], [17, 5], [17, 15], [5, 15]], huvudbyggnad: true };   // 120 m²
  const hus = [
    { id: 1, fotavtryck: [[25, 5], [35, 5], [35, 13], [25, 13]] },                                        // 80 m² på tomten
    { id: 2, fotavtryck: [[50, 5], [60, 5], [60, 15], [50, 15]] },                                        // grannens
    { id: 3, fotavtryck: [[20, 18], [38, 18], [38, 28], [20, 28]], hal: [[[24, 21], [34, 21], [34, 25], [24, 25]]] },   // 180 − 40
  ];
  const b = K.byaMedHus([ny], hus, [tomt, granne], null);
  assert.strictEqual(b.lmhus, 2); assert.strictEqual(b.tomt, tomt);
  nara(b.befintlig, 80 + 140, 1e-6); nara(b.tillkommande, 120, 1e-6); nara(b.totalt, 340, 1e-6);
  // utan kroppar: fastigheten ur beteckningen; utan fastighet: bara kropparna
  nara(K.byaMedHus([], hus, [tomt, granne], '1:3').befintlig, 100, 1e-6);
  // ett hus som en ny kropp är ritad över står inte kvar
  const over = K.byaMedHus([ny, { id: 'o', fotavtryck: [[24, 4], [30, 4], [30, 10], [24, 10]] }], hus, [tomt, granne], null);
  assert.strictEqual(over.lmhus, 1); nara(over.befintlig, 140, 1e-6); nara(over.tillkommande, 156, 1e-6);
  const utan = K.byaMedHus([ny], hus, [], null);
  assert.strictEqual(utan.lmhus, 0); nara(utan.befintlig, 0, 1e-9); nara(utan.totalt, 120, 1e-6);
});

prov('ett hörn som dras över en annan sida ändrar ingenting (0.16.3)', () => {
  const fem = [[0, 0], [10, 0], [10, 6], [5, 9], [0, 6]];
  const v = K.nyPolygon(fem, { id: 'p', namn: 'P', golv: 10, takfot: 3 });
  const fore = JSON.stringify(v.fotavtryck), a0 = K.area(v.fotavtryck);
  const over = fem.map(q => q.slice()); over[3] = [5, -4];   // nocken dras ner under bottensidan
  assert.strictEqual(K.korsarSig(over), true);
  assert.strictEqual(K.satHorn(v, over), false);
  assert.strictEqual(JSON.stringify(v.fotavtryck), fore); nara(K.area(v.fotavtryck), a0, 1e-9);
  const ok = fem.map(q => q.slice()); ok[3] = [5, 12];
  assert.strictEqual(K.korsarSig(ok), false);
  K.satHorn(v, ok); nara(Math.abs(K.area(v.fotavtryck)), 60 + 30, 1e-6);
});

prov('union: en fog som slutar några millimeter från ett hörn (0.16.3, B1)', () => {
  const A = [[0, 0], [10, 0], [10, 5], [0, 5]];
  for (const d of [0, 0.001, 0.002, 0.003, 0.004, 0.01]) {
    const B = [[10, d], [14, d], [14, 5 + d], [10, 5 + d]], C = [[10, d], [14, 0], [14, 5], [10, 5]];
    nara(K.unionArea([A, B]), 70, 0.01); nara(K.unionArea([A, C]), 70 - 2 * d, 0.01);
    nara(K.bya([{ id: 'a', fotavtryck: A }, { id: 'b', fotavtryck: B }]).totalt, 70, 0.01);
  }
  // slumpade par av axelparallella rätblock som ligger an eller nästan an: arean som summan minus överlappet
  let fro = 11; const sl = () => (fro = (fro * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 2000; k++) {
    const w = 2 + sl() * 10, h = 2 + sl() * 10, w2 = 2 + sl() * 10, h2 = 2 + sl() * 10;
    const x2 = w + (sl() < 0.5 ? 0 : (sl() - 0.5) * 0.01), y2 = (sl() - 0.5) * h + (sl() < 0.3 ? Math.round(sl() * 8 - 4) / 1000 : 0);
    const R = (x, y, b, c) => [[x, y], [x + b, y], [x + b, y + c], [x, y + c]];
    const ox = Math.max(0, Math.min(w, x2 + w2) - Math.max(0, x2)), oy = Math.max(0, Math.min(h, y2 + h2) - Math.max(0, y2));
    const ratt = w * h + w2 * h2 - ox * oy;
    nara(K.unionArea([R(0, 0, w, h), R(x2, y2, w2, h2)]), ratt, 0.03, `par ${k}`);   // hörnen fogas inom 2 mm
  }
});

prov('måtten mellan kroppar: tillbyggnaden mot huvudbyggnaden', () => {
  const h = rekt('h', 5, 6, 12.8, 9.4, { status: 'befintlig' });
  const t = rekt('t', 17.8, 6.3, 4, 5.6, { status: 'tillbyggnad' });
  const r = K.relativaMatt([h, t]);
  assert.strictEqual(r.length, 2);
  assert(r.every(x => x.kropp === 't' && x.mot === 'h'), 'den mindre måttsätts mot den större');
  nara(r[0].d, 0.3, 1e-9, 'indraget 0,3 m som i ägarens exempel');
  nara(r[1].d, 3.5, 1e-9);
  // flytta 0,2 m längs måttets riktning: måttet blir 0,5
  const u = [r[0].ande[0] - r[0].fast[0], r[0].ande[1] - r[0].fast[1]], l = Math.hypot(...u);
  K.flytta([h, t], 't', u[0] / l * 0.2, u[1] / l * 0.2);
  nara(K.relativaMatt([h, t])[0].d, 0.5, 1e-9);
  // kroppar som inte ligger an får inga mått
  assert.deepStrictEqual(K.relativaMatt([h, rekt('x', 30, 20, 3, 3)]), []);
  // samma linje i båda ändar: inga mått
  assert.deepStrictEqual(K.relativaMatt([rekt('a', 0, 0, 10, 8), rekt('b', 10, 0, 4, 8)]), []);
});

prov('yttermåtten: en lång och en kort sida, inte fogen och helst inte där gränsmåtten är', () => {
  const h = rekt('h', 5, 6, 12.8, 9.4, { status: 'befintlig' });
  const t = rekt('t', 17.8, 6.3, 4, 5.6, { status: 'tillbyggnad' });
  const s = i => K.sidor(t.fotavtryck).find(x => x.i === i);
  const yt = K.yttermattSidor(t, [h, t], K.gransmatt(t.fotavtryck, TOMT));
  assert.strictEqual(yt.length, 2);
  assert(!K.fogsidor(t, [h, t]).has(yt[0]) && !K.fogsidor(t, [h, t]).has(yt[1]), 'inte fogen mot huset');
  assert(yt.some(i => Math.abs(s(i).u[0]) > 0.99) && yt.some(i => Math.abs(s(i).u[1]) > 0.99), 'en sida i varje riktning');
  assert.deepStrictEqual(K.yttermattSidor(h, [h, t], []).sort(), [2, 3], 'norra och västra sidan, som i exemplet');
  const l = K.nyPolygon([[0, 0], [10, 0], [10, 4], [4, 4], [4, 9], [0, 9]], { id: 'l', namn: 'L', golv: 1 });
  assert.strictEqual(K.yttermattSidor(l, [l], []).length, 6, 'en L-form får alla sidor');
});

prov('FG-texten och höjder med decimalkomma', () => {
  const h = rekt('h', 5, 6, 12.8, 9.4, { status: 'befintlig' });
  const t = rekt('t', 17.8, 6.3, 4, 5.6, { status: 'tillbyggnad' });
  assert.strictEqual(K.fgText(h, [h, t]), 'FG +32,8');
  assert.strictEqual(K.fgText(t, [h, t]), 'FG lika bef');
  t.golv = 32.95;
  assert.strictEqual(K.fgText(t, [h, t]), 'FG +32,95');
  t.golv = NaN;
  assert.strictEqual(K.fgText(t, [h, t]), 'FG ?');
  assert.strictEqual(K.hojdText(100), '100'); assert.strictEqual(K.hojdText(-1.5), '−1,5'); assert.strictEqual(K.hojdText(12.345), '12,35');
});

prov('status: rivs räknas inte i analyserna, ersatta hus och BYA', () => {
  const a = rekt('a', 0, 0, 10, 10), b = rekt('b', 20, 0, 5, 4, { status: 'rivs', kalla: 'LM-2' }), c = rekt('c', 0, 20, 10, 5, { status: 'befintlig', kalla: 'LM-1' });
  assert.deepStrictEqual(K.forAnalys([a, b, c]).map(v => v.id), ['a', 'c']);
  assert.deepStrictEqual([...K.ersatta([a, b, c])].sort(), ['LM-1', 'LM-2']);
  const s = K.bya([a, b, c]);
  nara(s.tillkommande, 100); nara(s.befintlig, 50); nara(s.rivs, 20); nara(s.totalt, 150);
  const n = K.normalisera({ fotavtryck: [[0, 0], [0, 1], [1, 1], [1, 0]], entre: { sida: 9, t: 0.5 } });
  assert.strictEqual(n.status, 'ny'); assert.strictEqual(n.huvudbyggnad, false); assert.strictEqual(n.entre, null);
  assert(K.area(n.fotavtryck) > 0, 'moturs');
});

prov('takform och nock: prisma och rätblock byter typ, nocken kan läggas tvärs', () => {
  const v = rekt('v', 0, 0, 12, 8);
  assert.strictEqual(v.primitiv.typ, 'prisma'); nara(v.nockriktning, 0);
  K.satTakform(v, 'platt');
  assert.strictEqual(v.primitiv.typ, 'block'); assert.strictEqual(v.takform, 'platt');
  K.satTakform(v, 'valm');
  assert.strictEqual(v.primitiv.typ, 'prisma'); assert.strictEqual(v.takform, 'valm'); assert(v.taklutning > 0);
  const fore = v.fotavtryck.map(p => p.join()).sort();
  const val = K.nockVal(v);
  assert.strictEqual(val.length, 2); assert(val[0].vald);
  K.satNock(v, 90);
  nara(v.nockriktning, 90);
  assert.deepStrictEqual(v.fotavtryck.map(p => p.join()).sort(), fore, 'samma fotavtryck med nocken tvärs');
  K.satTakform(v, 'sadel');
  nara(v.nockriktning, 90);
  nara(V.topp(v) - v.golv - v.takfot, 6 * Math.tan(v.taklutning * Math.PI / 180), 1e-6, 'sadeltak med nocken tvärs: gavlarna på långsidorna');
  K.satTakform(v, 'pulpet');
  assert.strictEqual(K.nockVal(v).length, 4, 'pulpet: högt vid vilken sida som helst');
  // polygon
  const l = K.nyPolygon([[0, 0], [10, 0], [10, 6], [0, 6]], { id: 'p', namn: 'p', golv: 0 });
  K.satTakform(l, 'sadel'); nara(l.nockriktning, 0);
  K.satNock(l, 90); nara(l.nockriktning, 90);
});

prov('entrén följer med när kroppen flyttas, vrids, får nya hörn eller nocken läggs om', () => {
  const v = rekt('v', 0, 0, 12, 8);
  v.entre = { sida: 0, t: 0.25 };
  let e = K.entrePunkt(v);
  assert.deepStrictEqual(e.p, [3, 0]); assert.deepStrictEqual(e.n, [0, -1]);
  K.flytta([v], 'v', 5, 5);
  assert.deepStrictEqual(K.entrePunkt(v).p, [8, 5]);
  K.satNock(v, 90);   // prismat vrids om: hörnen får ny ordning
  e = K.entrePunkt(v);
  nara(e.p[0], 8, 1e-6); nara(e.p[1], 5, 1e-6); assert.deepStrictEqual(e.n.map(Math.round), [0, -1]);
  K.satHorn(v, [[5, 5], [17, 5], [17, 15], [5, 15]]);   // djupare
  e = K.entrePunkt(v);
  nara(e.p[0], 8, 1e-6); nara(e.p[1], 5, 1e-6);
  assert(['block', 'prisma'].includes(v.primitiv.typ), 'en rektangel i samma riktning förblir ett prisma');
  K.satHorn(v, [[5, 5], [17, 5], [17, 15], [8, 15], [5, 12]]);
  assert.strictEqual(v.primitiv.typ, 'polygon');
  nara(K.entrePunkt(v).p[1], 5, 1e-6);
});

prov('kroppen ur ett befintligt hus och rensade hörn', () => {
  const b = { id: 'abc', fotavtryck: [[0, 0], [0, 10], [5, 10], [10, 10], [10, 0], [0, 0]], mark: 101.234, hojd: 5.55, huvudbyggnad: true };
  const v = K.franHus(b, { id: 'k1', namn: 'Hus', golv: NaN });
  assert.strictEqual(v.status, 'befintlig'); assert.strictEqual(v.kalla, 'abc'); assert.strictEqual(v.huvudbyggnad, true);
  assert.strictEqual(v.fotavtryck.length, 4, 'slutpunkten och hörnet mitt på sidan är borta');
  assert(K.area(v.fotavtryck) > 0);
  nara(v.golv, 101.23, 1e-9); nara(v.takfot, 5.6, 1e-9);
  assert(K.arRektangel(v.fotavtryck));
  // ett hus med innergård blir ingen kropp, gården skulle annars fyllas (0.16.3, P6)
  const gard = { id: 'g', fotavtryck: [[0, 0], [30, 0], [30, 30], [0, 30]], hal: [[[8, 8], [22, 8], [22, 22], [8, 22]]], mark: 10, hojd: 12 };
  assert.strictEqual(K.franHus(gard, { id: 'k2', namn: 'Kvarter', golv: NaN }), null);
  assert(K.franHus(Object.assign({}, gard, { hal: [] }), { id: 'k3', namn: 'Kvarter', golv: NaN }));
});

prov('flytta och vrida följer länkade kroppar (kedjan i 3D-vyn)', () => {
  const a = rekt('a', 0, 0, 10, 8), b = rekt('b', 10, 0, 4, 4), c = rekt('c', 30, 0, 4, 4);
  V.vaxlaLank(a, b);
  K.flytta([a, b, c], 'a', 1, 2);
  assert.deepStrictEqual(b.fotavtryck[0], [11, 2]); assert.deepStrictEqual(c.fotavtryck[0], [30, 0]);
  K.vrid([a, b, c], 'b', 90, [11, 2]);
  nara(a.primitiv.vrid, 90, 1e-9);
});

prov('union: vinkel, fog, innergård, kors och stora koordinater (0.16.0)', () => {
  const r = (x, y, b, d) => [[x, y], [x + b, y], [x + b, y + d], [x, y + d]];
  let u = K.union([r(0, 0, 10, 4), r(6, 0, 4, 10)]);
  assert.strictEqual(u.length, 1); assert.strictEqual(u[0].length, 6, 'L-formen har sex hörn'); nara(K.area(u[0]), 64, 1e-9);
  u = K.union([r(0, 0, 10, 4), r(10, 0, 4, 4)]);
  assert.strictEqual(u[0].length, 4, 'fogen försvinner'); nara(K.area(u[0]), 56, 1e-9);
  u = K.union([r(0, 0, 10, 4), r(10, 1, 4, 2)]);
  assert.strictEqual(u[0].length, 8); nara(K.area(u[0]), 48, 1e-9);
  nara(K.area(K.union([r(0, 0, 10, 4), r(0, 0, 10, 4)])[0]), 40, 1e-9, 'två lika');
  nara(K.area(K.union([r(0, 0, 10, 10), r(2, 2, 3, 3)])[0]), 100, 1e-9, 'en inuti en annan');
  assert.strictEqual(K.union([r(0, 0, 1, 1), r(5, 5, 1, 1)]).length, 2, 'skilda');
  u = K.union([r(0, 0, 10, 2), r(0, 8, 10, 2), r(0, 0, 2, 10), r(8, 0, 2, 10)]);
  assert.deepStrictEqual(u.map(q => Math.round(K.area(q))).sort((a, b) => a - b), [-36, 100], 'innergården är ett hål (medurs)');
  u = K.union([r(0, 4, 12, 4), r(4, 0, 4, 12)]);
  assert.strictEqual(u[0].length, 12); nara(K.area(u[0]), 80, 1e-9);
  const vr = p => p.map(([x, y]) => [x * Math.cos(0.3) - y * Math.sin(0.3) + 153456.7, x * Math.sin(0.3) + y * Math.cos(0.3) + 6543210.3]);
  u = K.union([vr(r(0, 0, 10, 4)), vr(r(6, 0, 4, 10))]);
  assert.strictEqual(u[0].length, 6); nara(K.area(u[0]), 64, 1e-6);
});

prov('yttre skal: samma status går ihop, olika status hålls isär; BYA räknar överlapp en gång', () => {
  const a = rekt('a', 0, 0, 10, 4), b = rekt('b', 6, 0, 4, 10), c = rekt('c', 30, 0, 5, 5);
  let s = K.skal([a, b, c]);
  assert.strictEqual(s.length, 2);
  assert.deepStrictEqual(s[0].kroppar, ['a', 'b']); assert.strictEqual(s[0].id, 'a+b'); assert.strictEqual(s[0].yttre.length, 6);
  assert.deepStrictEqual(s[1].kroppar, ['c']);
  // tillbyggnad mot befintligt: två skal, fogen syns
  const h = rekt('h', 0, 0, 12, 9, { status: 'befintlig' }), t = rekt('t', 12, 1, 4, 5, { status: 'tillbyggnad' });
  assert.strictEqual(K.skal([h, t]).length, 2);
  // samma status som ligger an: ett skal
  const g = rekt('g', 12, 1, 4, 5, { status: 'befintlig' });
  assert.strictEqual(K.skal([h, g]).length, 1);
  // bara ett hörn gemensamt: två
  assert.strictEqual(K.skal([rekt('p', 0, 0, 4, 4), rekt('q', 4, 4, 4, 4)]).length, 2);
  const by = K.bya([a, b, c]);
  nara(by.tillkommande, 64 + 25, 1e-6); nara(by.totalt, 89, 1e-6);
  // en tillbyggnad som går in i det befintliga räknar bara det nya
  const t2 = rekt('t2', 10, 0, 4, 4, { status: 'tillbyggnad' });
  const by2 = K.bya([h, t2]);
  nara(by2.befintlig, 108, 1e-6); nara(by2.tillkommande, 8, 1e-6); nara(by2.totalt, 116, 1e-6);
});

prov('0.16.1: markering i plan med indrag, takanslutning och utdraget tak i 3D', () => {
  const h = rekt('h', 0, 0, 10, 8);
  K.satSlag(h, 'huvud');
  assert.strictEqual(h.huvudbyggnad, true);
  let m = K.planmarke(h, 0.5);
  assert.strictEqual(m.length, 2);
  nara(Math.hypot(m[0][0][0], m[0][0][1]), 0.5, 1e-9, 'krysset börjar 0,5 m in från hörnet');
  K.satSlag(h, 'komplement');
  assert.strictEqual(h.huvudbyggnad, false);
  m = K.planmarke(h, 0.5);
  assert.strictEqual(m.length, 1);
  assert.deepStrictEqual(m[0].map(p => p.map(x => Math.round(x * 1000) / 1000)).sort((a, b) => a[0] - b[0]), [[0.5, 4], [9.5, 4]], 'nocken mellan gavlarnas mitt');
  K.satSlag(h, 'skarmtak');
  assert.strictEqual(K.planmarke(h, 0.5).length, 1);
  K.satSlag(h, '');
  assert.deepStrictEqual(K.planmarke(h), []);
  // äldre filer: huvudbyggnad utan slag
  assert.strictEqual(K.slag({ huvudbyggnad: true }), 'huvud');
  // en flygel som går in mot huvudhuset: taket dras ut vid gaveln mot huset, inte vid den fria
  const w = rekt('w', 10, 2, 6, 4);
  const r = K.anslutTak(w, [h, w]);
  assert(r.andrat && w.takutdrag[0] > 0 && w.takutdrag[0] < 2 && w.takutdrag[1] === 0, JSON.stringify(w.takutdrag));
  const u = V.utdragen(w);
  assert.notStrictEqual(u, w);
  nara(Math.min(...u.fotavtryck.map(p => p[0])), 10 - w.takutdrag[0], 1e-9);
  assert.deepStrictEqual(w.fotavtryck.map(p => p[0]).sort((a, b) => a - b)[0], 10, 'fotavtrycket i plan är detsamma');
  assert.strictEqual(K.for3d([w, rekt('r', 30, 30, 3, 3, { status: 'rivs' })]).length, 1);
  assert.deepStrictEqual(K.gavlar(w).map(g => g.ande), [0, 1]);
  // fristående: inget att ansluta mot
  const f = rekt('f', 50, 50, 6, 4);
  assert.deepStrictEqual(K.anslutTak(f, [h, f]).utdrag, [0, 0]);
  assert.strictEqual(V.utdragen(f), f);
  // normalisera tar bort ogiltiga utdrag och ny nockriktning nollställer
  assert.strictEqual(K.normalisera(Object.assign({}, w, { takutdrag: [-1, 2] })).takutdrag, undefined);
  K.satNock(w, 90);
  assert.strictEqual(w.takutdrag, undefined);
});

console.log(`${antal} prov gick igenom`);
