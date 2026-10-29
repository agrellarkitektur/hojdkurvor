/*
 * Enhetstest för volymerna i 3D-vyn (0.10.0, js/volym3d.js): primitiver, taket, snäpp,
 * kontakter, länkar och konturerna när volymer går in i varandra.
 *   node test/volym3d.test.js
 */
'use strict';
const assert = require('assert');
const V = require('../js/volym3d.js');
const P = require('../js/platsanalys.js');
let antal = 0;
const prov = (namn, f) => { f(); antal++; console.log('ok', namn); };
const nara = (a, b, e = 1e-6, t = '') => assert(Math.abs(a - b) <= e, `${t} ${a} ≠ ${b}`);
const block = (id, x, y, b, d, h, golv = 100, extra = {}) => V.ny(Object.assign({ typ: 'block', b, d, hojd: h }, extra), x, y, golv, id, id);

prov('rätblock, cylinder och prisma ger rätt fotavtryck', () => {
  const a = block('a', 10, 20, 12, 8, 6);
  assert.strictEqual(a.fotavtryck.length, 4);
  nara(Math.abs(P.area(a.fotavtryck)), 96, 1e-6, 'yta');
  assert.strictEqual(a.takform, 'platt');
  V.vrid(a, 90, 10, 20);
  const xs = a.fotavtryck.map(p => p[0]);
  nara(Math.max(...xs) - Math.min(...xs), 8, 1e-3, 'vriden 90°: bredden blir djupet');
  const c = V.ny({ typ: 'cylinder', diam: 10, hojd: 4 }, 0, 0, 50, 'c', 'c');
  assert.strictEqual(c.fotavtryck.length, 32);
  nara(Math.abs(P.area(c.fotavtryck)), Math.PI * 25, 1.5, 'cylinderns yta');
  const p = V.ny({ typ: 'prisma', b: 14, d: 9, hojd: 5, takform: 'sadel', taklutning: 30, vrid: 20 }, 0, 0, 50, 'p', 'p');
  assert.strictEqual(p.nockriktning, 20);
  assert.strictEqual(p.takform, 'sadel');
});

prov('takets höjd är densamma som Platsanalys.takhojd (som analyserna använder)', () => {
  for (const takform of ['sadel', 'valm', 'pulpet']) for (const vrid of [0, 33, 90, 147]) {
    const v = V.ny({ typ: 'prisma', b: 16, d: 10, hojd: 6, takform, taklutning: 27, vrid }, 540000, 6428000, 100, 'p', 'p');
    for (let k = 0; k < 200; k++) {
      const x = 540000 + (Math.random() - 0.5) * 16, y = 6428000 + (Math.random() - 0.5) * 16;
      if (!P.inuti(v.fotavtryck, x, y)) continue;
      nara(V.hojdVid(v, x, y), P.takhojd(v, x, y), 1e-6, `${takform} ${vrid}°`);
    }
  }
});

prov('takytorna täcker fotavtrycket, ligger mellan takfot och nock och vänder uppåt', () => {
  for (const takform of ['sadel', 'valm', 'pulpet']) {
    const v = V.ny({ typ: 'prisma', b: 16, d: 10, hojd: 6, takform, taklutning: 30, vrid: 25 }, 0, 0, 100, 'p', 'p');
    const t = V.takytor(v), bas = 106, nock = V.topp(v);
    let tak = 0, gavlar = 0;
    for (let k = 0; k < t.index.length; k += 3) {
      const [a, b, c] = [0, 1, 2].map(q => t.index[k + q]).map(q => t.pos.slice(q * 3, q * 3 + 3));
      for (const p of [a, b, c]) { assert(p[2] >= bas - 1e-6 && p[2] <= nock + 1e-6); nara(p[2], p[2] === bas ? bas : p[2]); }
      const kr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(kr) < 1e-6) gavlar++;
      else { assert(kr > 0, `${takform}: takfall vänt nedåt`); tak += kr / 2; for (const p of [a, b, c]) nara(p[2], P.takhojd(v, p[0], p[1]), 1e-6, 'höjd i hörn'); }
    }
    nara(tak, 160, 0.01, `${takform}: takets yta i plan`);
    if (takform !== 'valm') assert(gavlar >= 2, `${takform}: gavlar`);
  }
  assert.strictEqual(V.takytor(block('b', 0, 0, 5, 5, 3)), null, 'platt tak har inga takytor');
});

prov('snäpp: yta mot yta med hörnen i linje, annars hörn mot hörn', () => {
  const a = block('a', 0, 0, 10, 10, 6);
  const b = block('b', 10.4, 0.3, 10, 10, 6);   // 0,4 m ifrån, 0,3 m förskjuten
  const s = V.snapp(b.fotavtryck, [{ pts: a.fotavtryck, sluten: true }], 0.6);
  assert.strictEqual(s.typ, 'yta');
  nara(s.dx, -0.4, 1e-6, 'dx'); nara(s.dy, -0.3, 1e-6, 'dy');
  // normalen pekar från a:s sida mot b
  assert(s.linje.n[0] > 0.99);
  // en gränslinje (öppen) går också
  const g = V.snapp(b.fotavtryck, [{ pts: [[15.2, -20], [15.2, 20]], sluten: false }], 0.6);
  assert.strictEqual(g.typ, 'yta'); nara(g.dx, -0.2, 1e-6);
  // en gräns lite närmare än volymen står tillbaka för volymen
  const v2 = V.snapp(b.fotavtryck, [{ pts: [[15.25, -20], [15.25, 20]], sluten: false, prio: 2 }, { pts: a.fotavtryck, sluten: true }], 0.6);
  assert.strictEqual(v2.mal, 1, 'volymen före gränsen');
  // vriden 45°: inga parallella sidor, hörnet snäpper
  const c = block('c', 8.03, 1, 4, 4, 3, 100, { vrid: 45 });
  const h = V.snapp(c.fotavtryck, [{ pts: a.fotavtryck, sluten: true }], 0.3);
  assert(h && h.typ === 'kant', h && h.typ);
  assert.strictEqual(V.snapp(block('d', 40, 0, 4, 4, 3).fotavtryck, [{ pts: a.fotavtryck, sluten: true }], 0.6), null);
});

prov('tyngdpunkten stämmer också med zonens stora koordinater', () => {
  const c = V.ny({ typ: 'cylinder', diam: 7, hojd: 3 }, 189666.5, 6430321.7, 100, 'c', 'c');
  const t = V.tyngdpunkt(c.fotavtryck);
  nara(t[0], 189666.5, 1e-3); nara(t[1], 6430321.7, 1e-3);
});

prov('kontakter: sida mot sida, ovanpå och in i varandra', () => {
  const a = block('a', 0, 0, 10, 10, 6), b = block('b', 10, 2, 10, 6, 4), c = block('c', 0, 0, 6, 6, 3, 106), d = block('d', 30, 0, 4, 4, 4), e = block('e', 33, 1, 4, 4, 6);
  const k = V.kontakter([a, b, c, d, e]);
  const par = k.map(q => q.a + q.b).sort();
  assert.deepStrictEqual(par, ['ab', 'ac', 'de']);
  const ab = k.find(q => q.a === 'a' && q.b === 'b');
  nara(ab.punkt[0], 5, 1e-6, 'fogen på den gemensamma väggen'); nara(ab.punkt[2], 102, 1e-6, 'mitt i höjd');
  const ac = k.find(q => q.b === 'c');
  nara(ac.punkt[2], 106, 1e-6, 'ovanpå: fogen vid den övres golv');
});

prov('länkar: kedjan gör en grupp, klick igen löser upp', () => {
  const a = block('a', 0, 0, 10, 10, 6), b = block('b', 10, 0, 10, 10, 6), c = block('c', 20, 0, 10, 10, 6);
  assert(V.vaxlaLank(a, b)); assert(V.vaxlaLank(b, c));
  assert.deepStrictEqual([...V.komponent([a, b, c], 'a')].sort(), ['a', 'b', 'c']);
  assert(!V.vaxlaLank(b, c));
  assert.deepStrictEqual([...V.komponent([a, b, c], 'a')].sort(), ['a', 'b']);
  assert.deepStrictEqual([...V.komponent([a, b, c], 'c')], ['c']);
});

prov('underlag: volymen står på den vars fotavtryck har mitten under sig', () => {
  const a = block('a', 0, 0, 10, 10, 6), b = block('b', 2, 1, 4, 4, 3, 106), c = block('c', 7, 0, 6, 6, 3);
  assert.strictEqual(V.underlag(b, [a, b, c]), a);
  assert.strictEqual(V.underlag(c, [a, b, c]), null, 'mitten utanför: på marken');
  assert.strictEqual(V.underlag(b, [a, b, c], new Set(['a'])), null, 'samma grupp räknas inte');
});

prov('flytta och vrida en polygon från cad-apa eller DXF', () => {
  const v = { id: 'x', namn: 'X', fotavtryck: [[0, 0], [10, 0], [10, 4], [0, 4]], golv: 100, takfot: 6, takform: 'sadel', taklutning: 30, nockriktning: 0 };
  V.franVolym(v);
  assert.strictEqual(v.primitiv.typ, 'polygon');
  V.flytta(v, 5, 1);
  assert.deepStrictEqual(v.fotavtryck[0], [5, 1]);
  V.vrid(v, 90, 10, 3);
  assert.strictEqual(v.nockriktning, 90);
  nara(v.fotavtryck[0][0], 12, 1e-6); nara(v.fotavtryck[0][1], -2, 1e-6);
});

// konturerna: hur många kanter som syns vid en viss punkt
const ritade = (sk, x, y, z, e = 0.05) => sk.filter(([a, b]) => {
  const t = Math.max(0, Math.min(1, ((x - a[0]) * (b[0] - a[0]) + (y - a[1]) * (b[1] - a[1]) + (z - a[2]) * (b[2] - a[2])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2 || 1)));
  return Math.hypot(a[0] + (b[0] - a[0]) * t - x, a[1] + (b[1] - a[1]) * t - y, a[2] + (b[2] - a[2]) * t - z) < e;
}).length;
/** Lådans tolv kanter i zonen. */
const ladkanter = v => {
  const f = v.fotavtryck, z0 = v.golv, z1 = v.golv + v.takfot, ut = [];
  f.forEach((p, i) => { const q = f[(i + 1) % f.length]; ut.push([[p[0], p[1], z0], [q[0], q[1], z0]], [[p[0], p[1], z1], [q[0], q[1], z1]], [[p[0], p[1], z0], [p[0], p[1], z1]]); });
  return ut;
};

prov('konturer: två lika höga lådor kant i kant blir en, en lägre behåller sin takkant', () => {
  const a = block('a', 0, 0, 10, 10, 6), b = block('b', 10, 0, 10, 10, 6);
  const sk = V.synligaKanter(ladkanter(a).concat(ladkanter(b)), [a, b]);
  assert.strictEqual(ritade(sk, 5, 0, 106), 0, 'fogen på taket syns inte');
  assert.strictEqual(ritade(sk, 5, 5, 103), 0, 'hörnet i fogen syns inte (fasaden är plan)');
  assert(ritade(sk, 0, 5, 106) >= 1, 'takkanten utmed fasaden syns');
  assert(ritade(sk, -5, 0, 106) >= 1 && ritade(sk, 15, 0, 106) >= 1, 'gavlarna syns');
  const c = block('c', 10, 0, 10, 10, 3);
  const sk2 = V.synligaKanter(ladkanter(a).concat(ladkanter(c)), [a, c]);
  assert(ritade(sk2, 5, 0, 103) >= 1, 'den lägres takkant mot den högres vägg syns');
  assert.strictEqual(ritade(sk2, 5, 0, 105), 0, 'fogen ovanför den lägre syns inte');
  assert(ritade(sk2, 5, 0, 106) >= 1, 'den högres takkant syns');
});

prov('konturer: in i varandra tas kanterna inuti bort och skärningen läggs till', () => {
  const a = block('a', 0, 0, 10, 10, 6), b = block('b', 6, 6, 10, 10, 4);   // överlapp i ett hörn
  const alla = ladkanter(a).concat(ladkanter(b)), sk = V.synligaKanter(alla.concat(V.skarningar([a, b])), [a, b]);
  assert.strictEqual(ritade(sk, 5, 5, 103), 0, 'a:s hörn inuti b syns inte');
  assert.strictEqual(ritade(sk, 1, 1, 102), 0, 'b:s hörn inuti a syns inte');
  // väggarna korsar varandra i (5, 1) och (1, 5): lodrät linje från marken till b:s tak
  assert(ritade(sk, 5, 1, 102) >= 1 && ritade(sk, 1, 5, 102) >= 1, 'lodrät skärning');
  assert.strictEqual(ritade(sk, 5, 1, 105), 0, 'inte ovanför den lägre');
  // b:s tak möter a:s vägg
  assert(ritade(sk, 5, 3, 104) >= 1, 'takets linje mot väggen');
});

console.log(`${antal} prov gick igenom`);
