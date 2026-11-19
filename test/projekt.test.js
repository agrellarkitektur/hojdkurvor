// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur
// Kör med: node test/projekt.test.js
// Projektfilen (0.13.0, docs/PROJEKTFIL.md): nytt projekt, läsning och migrering, okända fält som
// bevaras, spara → öppna → spara ger samma fil, volymer och trädval mellan zon och SWEREF 99 TM,
// inmatning utanför utsnittet och zip-filen med bilagor.
const assert = require('assert');
globalThis.proj4 = require('../vendor/proj4.js');
const T = require('../js/karna.js');
const JSZip = require('../vendor/jszip.min.js');
const V = require('../js/volym3d.js');
const P = require('../js/projekt.js');
T.registreraZoner();

(async () => {
  // --- nytt projekt
  const d = P.nytt({ namn: 'Staren 2', app: '0.13.0' });
  assert.strictEqual(d.format, 'hojdkurvor-projekt'); assert.strictEqual(d.version, 1);
  assert.ok(d.projekt.id); assert.strictEqual(d.inmatning.forslag.length, 1); assert.strictEqual(d.inmatning.forslag[0].namn, 'Basfall');
  assert.strictEqual(d.historik[0].handelse, 'Projektet skapat');
  assert.notStrictEqual(P.nytt().projekt.id, d.projekt.id);

  // --- läsning: fel format, nyare version, saknade fält fylls i
  assert.throws(() => P.las({ format: 'nagot-annat', version: 1 }), /ingen projektfil/);
  assert.throws(() => P.las('{ inte json'), /JSON/);
  assert.throws(() => P.las({ format: P.FORMAT, version: P.VERSION + 1 }), e => e instanceof P.NyareVersion && /nyare version/.test(e.message));
  const minimal = P.las({ format: P.FORMAT, version: 1, projekt: { id: 'abc' } });
  assert.strictEqual(minimal.projekt.id, 'abc'); assert.deepStrictEqual(minimal.inmatning.volymer, []);
  assert.deepStrictEqual(minimal.plats.nollpunkt, { typ: 'auto' }); assert.strictEqual(minimal.inmatning.forslag.length, 1);
  // migrering: en påhittad version 0 → 1 körs före läsningen
  P.MIGRERA[0] = x => Object.assign(x, { version: 1, projekt: { id: 'migrerad', namn: x.namn } });
  const mig = P.las({ format: P.FORMAT, version: 0, namn: 'Gammal' });
  assert.strictEqual(mig.projekt.id, 'migrerad'); assert.strictEqual(mig.projekt.namn, 'Gammal'); assert.strictEqual(mig.version, 1);
  assert.throws(() => P.las({ format: P.FORMAT }), /saknar version/);
  delete P.MIGRERA[0];

  // --- okända fält bevaras, men det appen äger (rättelser) tas bort när det tas bort
  const fil = P.nytt({ namn: 'A' });
  fil.framtid = { sol: 1 };
  fil.plats.nyttFalt = 7;
  fil.inmatning.punkter = [{ id: 'p1', typ: 'berg', x: 1, y: 2 }];
  fil.inmatning.volymer = [{ id: 'v1', namn: 'Hus', framtidsfalt: 'behåll', fotavtryck: [[0, 0], [1, 0], [1, 1]] }];
  fil.inmatning.rattelser.hus = { gammal: { dolt: true } };
  const ny = { format: P.FORMAT, version: 1, projekt: fil.projekt, plats: { zon: 3006 },
    inmatning: { volymer: [{ id: 'v1', namn: 'Hus 2', fotavtryck: [[0, 0], [2, 0], [2, 2]] }, { id: 'v2', namn: 'Nytt' }], rattelser: { tak: {}, trad: {}, hus: {} } } };
  const b = P.bevara(fil, ny);
  assert.deepStrictEqual(b.framtid, { sol: 1 }); assert.strictEqual(b.plats.nyttFalt, 7); assert.strictEqual(b.plats.zon, 3006);
  assert.deepStrictEqual(b.inmatning.punkter, fil.inmatning.punkter, 'listor som appen inte skriver följer med');
  assert.strictEqual(b.inmatning.volymer[0].namn, 'Hus 2'); assert.strictEqual(b.inmatning.volymer[0].framtidsfalt, 'behåll');
  assert.strictEqual(b.inmatning.volymer.length, 2);
  assert.deepStrictEqual(b.inmatning.rattelser.hus, {}, 'borttagen rättelse kommer inte tillbaka');
  assert.deepStrictEqual(Object.keys(b).slice(-1), ['framtid'], 'okända fält sist');

  // --- innehåll: tider och historik räknas inte
  const e = JSON.parse(JSON.stringify(fil)); e.sparad = '2030-01-01'; P.logga(e, 'Något');
  assert.strictEqual(P.innehall(e), P.innehall(fil));
  e.plats.radie = 40;
  assert.notStrictEqual(P.innehall(e), P.innehall(fil));
  assert.strictEqual(P.stabil({ b: 1, a: [1, { d: 2, c: 3 }] }), P.stabil({ a: [1, { c: 3, d: 2 }], b: 1 }));
  // historiken: samma händelse inom tio minuter blir en rad
  const h = P.nytt();
  P.logga(h, 'Utsnittet ändrat', '2026-11-17T10:00:00Z'); P.logga(h, 'Utsnittet ändrat', '2026-11-17T10:05:00Z');
  P.logga(h, 'Utsnittet ändrat', '2026-11-17T10:30:00Z');
  assert.strictEqual(h.historik.length, 3); assert.strictEqual(h.historik[1].tid, '2026-11-17T10:05:00Z');

  // --- volymer mellan SWEREF 99 12 00 (3007) och TM (15° vs 12°): läge, vridning, nockriktning, golv på marken
  const tillTM = T.omvandlare(3007, 3006).forward, franTM = T.omvandlare(3006, 3007).forward;
  const vol = V.ny({ typ: 'block', b: 12, d: 8, hojd: 6, takform: 'sadel', taklutning: 30, vrid: 15 }, 150050, 6430250, 112, 'v1', 'Hus A');
  V.uppdatera(vol);
  const iTM = P.flyttaVolym(vol, tillTM);
  const vinkel = P.vinkel(tillTM, [150050, 6430250]);
  assert.ok(Math.abs(vinkel) > 0.1, 'zonerna är vridna mot varandra: ' + vinkel);
  assert.ok(Math.abs(iTM.primitiv.vrid - (15 + vinkel)) < 1e-5);
  const tillbaka = P.flyttaVolym(iTM, franTM);
  assert.ok(Math.abs(tillbaka.primitiv.x - vol.primitiv.x) < 0.002 && Math.abs(tillbaka.primitiv.y - vol.primitiv.y) < 0.002);
  assert.ok(Math.abs(tillbaka.primitiv.vrid - 15) < 1e-5);
  // fotavtrycket som räknas om ur primitiven ligger där det omräknade fotavtrycket ligger
  const omraknad = JSON.parse(JSON.stringify(iTM)); V.uppdatera(omraknad);
  omraknad.fotavtryck.forEach((p, i) => assert.ok(Math.hypot(p[0] - iTM.fotavtryck[i][0], p[1] - iTM.fotavtryck[i][1]) < 0.01, 'hörn ' + i));
  // nockriktning och golv på marken (NaN i appen, null i filen)
  const dxfVol = { id: 'd1', namn: 'DXF', fotavtryck: [[150000, 6430200], [150010, 6430200], [150010, 6430210], [150000, 6430210]], golv: NaN, takfot: 6, takform: 'sadel', taklutning: 27, nockriktning: 0 };
  const dTM = P.flyttaVolym(dxfVol, tillTM);
  assert.strictEqual(dTM.golv, null); assert.ok(Math.abs(dTM.nockriktning - P.vinkel(tillTM, [150005, 6430205])) < 1e-5);
  assert.strictEqual(JSON.parse(JSON.stringify(dTM)).golv, null);

  // --- trädval: nycklar i dm, bara de som väljs ut
  const tv = { '150000,6430200': { dolt: true }, '160000,6430200': { art: 'tall' } };
  const tvTM = P.flyttaTradval(tv, tillTM, (x) => x < 155000);
  assert.strictEqual(Object.keys(tvTM).length, 1);
  const [k] = Object.keys(tvTM);
  const tvTillbaka = P.flyttaTradval(tvTM, franTM);
  assert.deepStrictEqual(Object.keys(tvTillbaka), ['150000,6430200'], k);

  // --- utanför utsnittet
  const r = { xmin: 0, ymin: 0, xmax: 100, ymax: 100 };
  const u = P.utanfor([{ fotavtryck: [[10, 10], [20, 10], [20, 20]] }, { fotavtryck: [[200, 200], [210, 200], [210, 210]] }, { fotavtryck: [[95, 50], [120, 50], [120, 60]] }],
    [[[10, 10], [50, 50]], [[-50, 50], [150, 50]], [[300, 300], [400, 300]]], r);
  assert.deepStrictEqual(u, { volymer: 1, sektioner: 1 });
  assert.strictEqual(P.utanforText(u), '1 volym och 1 sektion ligger utanför utsnittet. De finns kvar i projektet.');
  assert.strictEqual(P.utanforText({ volymer: 0, sektioner: 0 }), '');
  assert.strictEqual(P.sammanfattningText(P.sammanfatta(fil)), '1 volym, 1 rättelse, 1 punkt');

  // --- zip: spara → öppna → spara ger samma fil, bilagorna följer med
  const proj = P.nytt({ namn: 'Ölandet 1:2', app: '0.13.0' });
  proj.plats = Object.assign(proj.plats, { zon: 3009, utsnitt: { xmin: 150000, ymin: 6430200, xmax: 150100, ymax: 6430300 }, radie: 50 });
  proj.inmatning.volymer = [Object.assign(iTM, { forslag: proj.inmatning.forslag[0].id }), dTM];
  proj.inmatning.sektioner = [{ id: 's1', namn: 'A', a: [540000.123, 6428000], b: [540100, 6428000], vand: false }];
  proj.framtid = { något: [1, 2, 3] };
  const bilagor = { 'plan.png': new Uint8Array([137, 80, 78, 71, 1, 2, 3]) };
  const zip1 = await P.packa(proj, bilagor, JSZip, 'uint8array');
  assert.strictEqual(zip1[0], 0x50); assert.strictEqual(zip1[1], 0x4b);
  const las1 = await P.lasFil(zip1, JSZip);
  assert.deepStrictEqual(Array.from(las1.bilagor['plan.png']), Array.from(bilagor['plan.png']));
  assert.strictEqual(las1.data.projekt.namn, 'Ölandet 1:2');
  assert.deepStrictEqual(las1.data.framtid, proj.framtid);
  const zip2 = await P.packa(P.bevara(las1.data, las1.data), las1.bilagor, JSZip, 'uint8array');
  const las2 = await P.lasFil(zip2, JSZip);
  assert.strictEqual(JSON.stringify(las2.data), JSON.stringify(las1.data), 'spara → öppna → spara ger samma projekt.json');
  // ren JSON går också att öppna, med BOM
  const json = new TextEncoder().encode('﻿' + JSON.stringify(proj));
  assert.strictEqual((await P.lasFil(json, JSZip)).data.projekt.id, proj.projekt.id);
  // zip utan projekt.json
  const tom = new JSZip(); tom.file('annat.txt', 'x');
  await assert.rejects(P.lasFil(await tom.generateAsync({ type: 'uint8array' }), JSZip), /projekt\.json/);

  // --- kopia
  const kop = P.somKopia(proj);
  assert.notStrictEqual(kop.projekt.id, proj.projekt.id); assert.strictEqual(kop.projekt.namn, 'Ölandet 1:2 (kopia)');
  assert.strictEqual(kop.inmatning.volymer.length, 2);

  console.log('projekt: ok');
})().catch(e => { console.error(e); process.exit(1); });
