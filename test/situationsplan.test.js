// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Enhetstest för situationsplanen (0.16.0, js/situationsplan.js): byggnaderna som yttre skal, den markerade
 * byggnaden uppdelad i kroppar, måtten på skalet och hur de ändras, dolda och flyttade mått, etiketterna,
 * skrafferingen, ramen, DXF:ens lager och PDF:en.
 *   node test/situationsplan.test.js
 */
'use strict';
const assert = require('assert');
globalThis.window = globalThis;
globalThis.jspdf = require('../vendor/jspdf.umd.min.js');
globalThis.Kropp = require('../js/kropp.js');
globalThis.Utskrift = require('../js/utskrift.js');
globalThis.Dxf = require('../js/dxf.js');
const S = require('../js/situationsplan.js');
const K = globalThis.Kropp;
let antal = 0;
const prov = (namn, f) => { f(); antal++; console.log('ok', namn); };
const nara = (a, b, e = 1e-6, t = '') => assert(Math.abs(a - b) <= e, `${t} ${a} ≠ ${b}`);
const rekt = (id, x, y, b, d, extra = {}) => Object.assign(K.nyRektangel([x, y], [1, 0], [0, 1], b, d, { id, namn: id, golv: 32.8, takfot: 3, takform: 'sadel' }), extra);
const TOMT = [{ pts: [[0, 0], [40, 0], [40, 30], [0, 30], [0, 0]] }];
// huset 12 × 8 och en flygel 4 × 14 som går in i det: en L-formad byggnad
const L = () => [rekt('hus', 6, 8, 12, 8, { huvudbyggnad: true }), rekt('flygel', 14, 8, 4, 14)];

prov('enheterna: skalet, och kropparna var för sig när en av dem är markerad', () => {
  const v = L().concat([rekt('bef', 26, 4, 8, 6, { status: 'befintlig' })]);
  let e = S.enheter(v);
  assert.deepStrictEqual(e.map(x => x.id), ['flygel+hus', 'bef']);
  assert.strictEqual(e[0].agare, 'flygel', 'ägaren är den första i bokstavsordning');
  assert.strictEqual(e[0].yttre.length, 6); assert(!e[0].oppen);
  e = S.enheter(v, { oppen: 'hus' });
  assert.deepStrictEqual(e.map(x => [x.id, x.oppen]), [['hus', true], ['flygel', true], ['bef', false]]);
  assert.strictEqual(S.enhetFor(e, 'flygel').id, 'flygel');
});

prov('måtten på skalet: ett per yttersida, gränsmåtten flyttar hela byggnaden', () => {
  const v = L(), m = S.matt(v, TOMT);
  const sidor = m.filter(x => x.typ === 'sida');
  assert.deepStrictEqual(sidor.map(x => x.text).sort(), ['12,0', '14,0', '4,0', '6,0', '8,0', '8,0']);
  assert(!m.some(x => x.typ === 'relativ'), 'inga mått mellan kropparna i samma byggnad');
  const g = m.filter(x => x.typ === 'grans');
  assert.strictEqual(g.length, 3);
  assert.deepStrictEqual(g[0].andra.kroppar.sort(), ['flygel', 'hus']);
  // sidan 14 hör till flygeln och går att ändra; flygelns inre sida (6) går inte
  const s14 = sidor.find(x => x.text === '14,0'), s6 = sidor.find(x => x.text === '6,0');
  assert.strictEqual(s14.andra.kropp, 'flygel'); assert(s6.andra === null);
  // husets översida (8 av 12): ändringen läggs på kroppens sida
  const s8 = sidor.find(x => x.text === '8,0' && x.n[1] > 0.5);
  assert.strictEqual(s8.andra.kropp, 'hus'); nara(s8.andra.l, 12);
  // markerad: måtten på kropparna, med mått mellan dem om de ligger an
  const o = S.matt(v, TOMT, { oppen: 'hus' });
  assert(o.filter(x => x.typ === 'sida').length >= 4);
});

prov('dolda och flyttade mått: sparas på ägaren, nyckeln följer skalet', () => {
  const v = L(), m = S.matt(v, TOMT), s = m.find(x => x.typ === 'sida' && x.text === '12,0');
  S.satAnnot(v, s, { dold: true });
  const agare = v.find(x => x.id === 'flygel');
  assert.deepStrictEqual(Object.keys(agare.matt), [`flygel+hus|${s.nyckel}`]);
  assert(S.matt(v, TOMT).find(x => x.nyckel === s.nyckel).dold);
  const y = m.find(x => x.typ === 'sida' && x.text === '14,0');
  S.satAnnot(v, y, { off: 3.5 });
  nara(S.matt(v, TOMT).find(x => x.nyckel === y.nyckel).off, 3.5);
  // flytta byggnaden: nycklarna gäller fortfarande
  v.forEach(x => K.flytta([x], x.id, 1, 1));
  assert(S.matt(v, TOMT).find(x => x.nyckel === s.nyckel).dold);
  S.visaDolda(v);
  assert(!S.matt(v, TOMT).some(x => x.dold)); assert(agare.matt, 'flyttade mått står kvar');
  S.satAnnot(v, y, null);
  assert.strictEqual(agare.matt, undefined, 'tomt fält tas bort');
});

prov('etiketter: FG en gång för skalet, per kropp om golven skiljer', () => {
  const v = L();
  let e = S.enheter(v)[0], et = S.etiketter(e, v);
  assert.strictEqual(et.length, 1); assert.deepStrictEqual(et[0].rader.map(r => r.text), ['HUS', 'FG +32,8']);
  v[1].golv = 33.1;
  et = S.etiketter(S.enheter(v)[0], v);
  assert.strictEqual(et.length, 2);
  assert.deepStrictEqual(et.map(x => x.rader.map(r => r.text).join(' ')), ['HUS FG +32,8', 'FG +33,1']);
  // flygelns etikett ligger i den del som inte täcks av huset
  assert(et[1].p[1] > 16, 'ovanför huset');
  const r = rekt('r', 30, 20, 5, 4, { status: 'rivs' });
  assert.deepStrictEqual(S.etiketter(S.enheter([r])[0], [r])[0].rader.map(x => x.text), ['RIVS']);
});

prov('skraffering och ram', () => {
  const sk = S.skraffering([[[0, 0], [4, 0], [4, 4], [0, 4]]], 0.5);
  assert(sk.length > 10);
  sk.forEach(([a, b]) => { [a, b].forEach(p => assert(p[0] > -1e-9 && p[0] < 4 + 1e-9 && p[1] > -1e-9 && p[1] < 4 + 1e-9)); nara(Math.abs((b[1] - a[1]) / (b[0] - a[0])), 1, 1e-9); });
  const r = S.ram({ format: 'a3', liggande: true, skala: 400, centrum: [100, 200] });
  nara(r.zon.xmax - r.zon.xmin, (420 - 30) * 0.4, 1e-9, 'fältets bredd i meter');
  nara(r.zon.ymax - r.zon.ymin, (297 - 20) * 0.4, 1e-9);
  nara((r.zon.xmin + r.zon.xmax) / 2, 100, 1e-9);
  assert.deepStrictEqual(S.mitt(L()), [12, 15]);
});

prov('DXF: lager per innehåll, texter med vinkel och mitt', () => {
  const v = L().concat([rekt('t', 18, 9, 3, 4, { status: 'tillbyggnad', entre: { sida: 0, t: 0.5 } })]);
  const d = S.dxf({ volymer: v, granser: TOMT, hus: [{ fotavtryck: [[-8, 2], [-2, 2], [-2, 8], [-8, 8]] }], skala: 400, visa: { koord: true } });
  const lager = new Set([...d.matchAll(/\r\n8\r\n(SITPLAN_[A-Z_]+)\r\n/g)].map(m => m[1]));
  for (const l of ['SITPLAN_NY', 'SITPLAN_TILLBYGGNAD', 'SITPLAN_SKRAFFERING', 'SITPLAN_FASTIGHETSGRANS', 'SITPLAN_BYGGNAD_LM', 'SITPLAN_HUVUDBYGGNAD', 'SITPLAN_ENTRE', 'SITPLAN_MATT', 'SITPLAN_MATTEXT', 'SITPLAN_TEXT', 'SITPLAN_KOORDINATER']) assert(lager.has(l), l);
  assert(/\r\n50\r\n90\.000\r\n/.test(d), 'lodräta texter har vinkeln 90');
  assert(/\r\n72\r\n4\r\n11\r\n/.test(d), 'texterna är centrerade');
  // skalet är en polylinje med sex hörn på lagret för nya byggnader
  const ny = d.split('POLYLINE').filter(x => /\r\n8\r\nSITPLAN_NY\r\n/.test(x.slice(0, 40)));
  assert.strictEqual(ny.length, 1); assert.strictEqual((ny[0].match(/VERTEX/g) || []).length, 6);
});

prov('PDF: A3 och A4 med ritningshuvud', () => {
  const v = L();
  for (const [format, liggande, skala] of [['a3', true, 400], ['a4', false, 500]]) {
    const b = Buffer.from(S.pdf({ format, liggande, skala, volymer: v, granser: TOMT, uppgifter: { fastighet: 'Staren 2', kommun: 'Vimmerby', datum: '2026-11-22' }, zonNamn: 'SWEREF 99 15 00' }));
    assert.strictEqual(b.slice(0, 4).toString(), '%PDF');
    const t = b.toString('latin1');
    const mb = t.match(/\/MediaBox \[0 0 ([0-9.]+) ([0-9.]+)/).slice(1).map(Number);
    assert.deepStrictEqual(mb.map(Math.round), format === 'a3' ? [1191, 842] : [595, 842], 'pappersformatet');
  }
});

console.log(`${antal} prov gick igenom`);
