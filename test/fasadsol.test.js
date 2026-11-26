// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Enhetstest för sol på fasaderna (0.15.0, js/fasadsol.js): klar himmel, fasadpunkter, horisonter,
 * skuggning från den egna kroppen, andra kroppar och omgivningen, och kontrollen mot Hudiksvall.
 *   node test/fasadsol.test.js
 */
'use strict';
const assert = require('assert');
const F = require('../js/fasadsol.js');
const V = require('../js/volym3d.js');
let antal = 0;
const prov = (namn, f) => { f(); antal++; console.log('ok', namn); };
const nara = (a, b, e, t = '') => assert(Math.abs(a - b) <= e, `${t} ${a} ≠ ${b} (±${e})`);
const block = (id, x, y, b, d, h, golv = 10, extra = {}) => V.ny(Object.assign({ typ: 'block', b, d, hojd: h }, extra), x, y, golv, id, id);
const HUD = { lat: 61.73, lon: 17.10, konv: 0, ar: 2026 };

prov('klar himmel: 2 april vid middag i Hudiksvall (solhöjd 33°)', () => {
  const k = F.klarHimmel(33, 92);
  nara(k.dni, 828, 5, 'direkt');
  nara(k.dhi, 94, 3, 'diffus');
  assert.strictEqual(F.klarHimmel(0, 92).dni, 0);
  assert(F.klarHimmel(50, 172).dni > F.klarHimmel(20, 172).dni, 'mer direkt sol när solen står högre');
  // överslaget i överlämningen: cirka 850 W/m² mot söder
  const I = F.motFasad({ h: 33, phi: 0, ...k }, 0.5, true);
  nara(I.summa, 850, 15, 'söderfasad');
  assert.strictEqual(F.motFasad({ h: 33, phi: 120, ...k }, 0.5, true).direkt, 0, 'solen bakom fasaden');
});

prov('väderstreck och himlens andel', () => {
  assert.deepStrictEqual([0, 44, 46, 134, 136, 224, 226, 314, 316].map(F.vaderstreck), ['N', 'N', 'Ö', 'Ö', 'S', 'S', 'V', 'V', 'N']);
  nara(F.seddHimmel(new Float32Array(90), 2), 0.5, 1e-3, 'fri himmel');
  nara(F.seddHimmel(new Float32Array(90).fill(89.9), 2), 0, 1e-3, 'ingen himmel');
  assert(F.seddHimmel(new Float32Array(90).fill(30), 2) < 0.5);
});

prov('fasadpunkter på ett rätblock: area, fyra fasader och väderstreck', () => {
  const v = block('a', 100, 200, 10, 6, 3);
  const { punkter, fasader } = F.punkter([v]);
  assert.strictEqual(fasader.length, 4);
  nara(fasader.reduce((s, f) => s + f.area, 0), 32 * 3, 1e-6, 'väggarnas area');
  nara(punkter.reduce((s, p) => s + p.a, 0), 96, 1e-6, 'punkternas area');
  assert.deepStrictEqual(fasader.map(f => f.streck).sort(), ['N', 'S', 'V', 'Ö']);
  for (const p of punkter) {   // normalen pekar ut från kroppen
    assert(!V.inuti(v.fotavtryck, p.x + p.nx * 0.5, p.y + p.ny * 0.5));
    assert(V.inuti(v.fotavtryck, p.x - p.nx * 0.5, p.y - p.ny * 0.5));
  }
  const vriden = F.punkter([v], { konv: 50 }).fasader;
  assert.deepStrictEqual(vriden.map(f => f.streck).sort(), ['N', 'S', 'V', 'Ö']);
  assert.notDeepStrictEqual(vriden.map(f => f.streck), fasader.map(f => f.streck), 'meridiankonvergensen vrider väderstrecken');
});

prov('gavlar upp till taket, punkter under marken och i en annan kropp tas bort', () => {
  const p = V.ny({ typ: 'prisma', b: 10, d: 8, hojd: 3, takform: 'sadel', taklutning: 45, vrid: 0 }, 0, 0, 10, 'p', 'p');
  const yta = F.punkter([p]).fasader.reduce((s, f) => s + f.area, 0);
  nara(yta, 36 * 3 + 2 * 16, 4, 'väggar och två gavlar');
  // marken på 11 m: den nedersta metern försvinner
  const iMark = F.punkter([block('a', 0, 0, 10, 6, 3)], { mark: () => 11 }).fasader.reduce((s, f) => s + f.area, 0);
  nara(iMark, 32 * 2, 1e-6, 'under marken');
  // två block som ligger an: fogen är ingen fasad
  const a = block('a', 0, 0, 10, 6, 3), b = block('b', 10, 0, 10, 6, 3);
  const tva = F.punkter([a, b]).fasader.reduce((s, f) => s + f.area, 0);
  nara(tva, (2 * 20 + 2 * 6) * 3, 1e-6, 'unionens väggar');
});

prov('utan hinder: fri horisont, ingen skuggning', () => {
  const res = F.analys([block('a', 0, 0, 20, 10, 6)], { ...HUD, period: 'april', tid: 'kontor' });
  for (const p of res.punkter) { nara(p.sedd, 0.5, 1e-6); assert(p.hor.alla.every(v => v === -90)); }
  for (const g of res.grupper) { assert.strictEqual(g.skuggning.volymer, 0); assert.strictEqual(g.skuggning.omgivning, 0); }
  const s = res.grupper.find(g => g.streck === 'S'), n = res.grupper.find(g => g.streck === 'N');
  assert(s.summa > 3 * n.summa, 'söder får mycket mer än norr');
  assert(s.samtidig <= s.lokal + 1e-6, 'samtidig topp är högst lika med lokal topp');
  assert.strictEqual(res.dagar.length, 30);
  assert.strictEqual(s.matris.length, 30 * 24);
  assert.strictEqual(s.dygn.length, 24);
});

prov('en annan kropp skuggar, den egna inte (konvex)', () => {
  // ett högt block 15 m söder om ett lågt: lågbyggets södervägg skuggas
  const lag = block('lag', 0, 0, 20, 10, 6), hog = block('hog', 0, -20, 20, 10, 30);
  const res = F.analys([lag, hog], { ...HUD, period: 'april', tid: 'kontor' });
  const sLag = res.grupper.find(g => g.id === 'lag' && g.streck === 'S');
  const nHog = res.grupper.find(g => g.id === 'hog' && g.streck === 'N');
  const sHog = res.grupper.find(g => g.id === 'hog' && g.streck === 'S');
  assert(sLag.skuggning.volymer > 0.3, `lågbyggets södervägg skuggas: ${sLag.skuggning.volymer}`);
  assert.strictEqual(sHog.skuggning.volymer, 0, 'höghusets södervägg skuggas inte');
  assert(nHog.direkt.egen >= nHog.direkt.vol);
  // den egna kroppen skuggar inte en konvex kropp
  for (const p of res.punkter) assert(p.hor.egen.every(v => v === -90), 'egen horisont för ett rätblock');
});

prov('horisonten är inte spegelvänd: ett torn snett framför fasaden (0.16.3, B3)', () => {
  // södervägg (normalen mot söder, azimut 180°) och ett torn i sydost. Sydost ligger vid phi = 135 − 180 = −45°
  // (medurs positivt, som solens azimut), alltså i den vänstra halvan av horisonten och inte vid +45°.
  const v = block('a', 0, 0, 20, 10, 6), torn = block('t', 20, -25, 8, 8, 40);   // block() har mitten i (x, y)
  const { punkter } = F.punkter([v, torn]);
  F.horisonter(punkter, { yta: null, vol: F.hinderraster([v, torn]) });
  const p = punkter.find(q => q.v === 0 && q.ny < -0.9 && Math.abs(q.x) < 1 && q.z < 12);
  assert(p, 'en punkt mitt på södersidan');
  const minus = F.horVid(p.hor.vol, p.hor.azSteg, -45), plus = F.horVid(p.hor.vol, p.hor.azSteg, 45);
  assert(minus > 20, `tornet syns vid −45°: ${minus}`);
  assert(plus < 0, `inget vid +45°: ${plus}`);
  // och i analysen: tornet i sydost skuggar på förmiddagen, inte på eftermiddagen
  const res = F.analys([v, torn], { ...HUD, period: 'april', tid: 'kontor' });
  const s = res.grupper.find(g => g.id === 'a' && g.streck === 'S');
  assert(s.skuggning.volymer > 0, `tornet skuggar södersidan: ${s.skuggning.volymer}`);
});

prov('inbuktad kropp skuggar sig själv i innerhörnet', () => {
  const L = { id: 'L', namn: 'L', golv: 10, takfot: 15, takform: 'platt', taklutning: 0, fotavtryck: [[0, 0], [30, 0], [30, 10], [10, 10], [10, 30], [0, 30]] };
  const { punkter } = F.punkter([L]);
  F.horisonter(punkter, { yta: null, vol: F.hinderraster([L]) });
  assert(punkter.some(p => p.hor.egen.some(v => v > 10)), 'innerhörnets väggar ser den egna kroppen');
});

prov('omgivningen (ytmodellen) skuggar', () => {
  const v = block('a', 0, 0, 20, 10, 6);
  // ytmodell 1 m med en 25 m hög mur 15 m söder om kroppen
  const W = 121, H = 121, x0 = -60, y1 = 60, dtm = new Float32Array(W * H).fill(10), dsm = Float32Array.from(dtm);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = x0 + i, y = y1 - j; if (y <= -20 && y >= -24 && Math.abs(x) < 40) dsm[j * W + i] = 35; }
  const yta = { W, H, s: 1, x0, y1, dtm, dsm };
  const res = F.analys([v], { ...HUD, period: 'april', tid: 'kontor', yta });
  const s = res.grupper.find(g => g.streck === 'S');
  assert(s.skuggning.omgivning > 0.5, `muren skuggar södersidan: ${s.skuggning.omgivning}`);
  assert(res.punkter.filter(p => res.fasader[p.f].streck === 'S').every(p => p.sedd < 0.5));
  // det som står på kroppen räknas inte (kroppen ersätter det)
  const yta2 = { W, H, s: 1, x0, y1, dtm, dsm: Float32Array.from(dtm) };
  for (let j = 55; j <= 65; j++) for (let i = 50; i <= 70; i++) yta2.dsm[j * W + i] = 40;
  yta2.dsm = F.rensaUnderKroppar(yta2, [v]);
  const res2 = F.analys([v], { ...HUD, period: 'april', tid: 'kontor', yta: yta2 });
  for (const g of res2.grupper) assert(g.skuggning.omgivning < 0.01, `${g.streck}: ${g.skuggning.omgivning}`);
});

prov('kontroll mot Hudiksvall: det stora blockets samtidiga toppar', () => {
  // underlaget: öster 806, söder 831, väster 850 W/m² (kl. 8–17, 21 mars–21 september)
  const stor = block('stor', 0, 0, 60, 20, 22);
  const res = F.analys([stor], { ...HUD, period: 'sommar', tid: 'kontor' });
  const t = s => res.grupper.find(g => g.streck === s).samtidig;
  nara(t('Ö'), 806, 40, 'öster');
  nara(t('S'), 831, 40, 'söder');
  nara(t('V'), 850, 90, 'väster');
  const pk = F.tillPaket(res);
  assert.strictEqual(pk.fasader.length, 4);
  assert(pk.fasader.every(f => f.samtidigTopp > 0 && f.lokalTopp >= f.samtidigTopp && f.volym === 'stor'));
});

prov('perioder och färgskala', () => {
  assert.strictEqual(F.dagar(2026, 'sommar').length, 185);
  assert.strictEqual(F.dagar(2026, 'september').length, 30);
  assert.deepStrictEqual(F.farg(0), [45, 50, 145]);
  assert.deepStrictEqual(F.farg(1), [200, 40, 40]);
});

prov('0.16.1: bladet med översikten (3D, nyckelplan, numrerade kort) och utan punkter som förut', () => {
  globalThis.window = globalThis;
  globalThis.jspdf = require('../vendor/jspdf.umd.min.js');
  const B = require('../js/fasadsolblad.js');
  const vol = [block('a', 0, 0, 20, 10, 6), block('b', 30, 0, 8, 8, 4)];
  const o = Object.assign({ steg: 2 }, HUD);
  const { punkter, fasader } = F.punkter(vol, o);
  F.horisonter(punkter, { yta: null, vol: F.hinderraster(vol) }, o);
  const res = F.berakna(punkter, fasader, Object.assign({ period: 'april', tid: 'kontor' }, o));
  const titel = { projekt: 'Prov', kommun: 'Hudiksvall', system: 'SWEREF 99 TM' };
  const med = B.blad({ res, punkter, volymer: vol, titel, dok: true }), utan = B.blad({ res, titel, dok: true });
  assert.strictEqual(med.getNumberOfPages(), utan.getNumberOfPages() + 1, 'en översiktssida till');
  assert(B.blad({ res, punkter, volymer: vol, titel }).byteLength > 20000);
});

console.log(`${antal} prov godkända`);
