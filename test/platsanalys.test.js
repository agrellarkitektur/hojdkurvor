// Kör med: node test/platsanalys.test.js
const assert = require('assert');
globalThis.proj4 = require('../vendor/proj4.js');
globalThis.Terrang = require('../js/karna.js');
globalThis.Analys = require('../js/analys.js');
globalThis.Dxf = require('../js/dxf.js');
const P = require('../js/platsanalys.js');

// syntetisk terräng: lutning 3 % mot öster, en skål (lågpunkt) och en kulle
const W = 201, H = 151, s = 1, x0 = 1000, y1 = 2150;
const z = new Float32Array(W * H);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const x = i * s, y = j * s;
  let v = 100 + 0.03 * (W - i);
  v -= 0.8 * Math.exp(-((x - 60) ** 2 + (y - 70) ** 2) / (2 * 8 ** 2));     // skål
  v += 6 * Math.exp(-((x - 150) ** 2 + (y - 40) ** 2) / (2 * 15 ** 2));    // kulle
  z[j * W + i] = v;
}
const g = { W, H, s, x0, y1, z };
const r = { xmin: 1000, xmax: 1200, ymin: 2000, ymax: 2150 };

const hp = P.hojdpunkter(g, r, 10);
assert.strictEqual(hp.length, 21 * 16, 'höjdpunkter i 10 m-rutnät');
assert.ok(hp.every(p => p.x % 10 === 0 && p.y % 10 === 0));

const lt = P.lutning(g, r);
const summa = lt.andel.reduce((a, b) => a + b, 0);
assert.ok(Math.abs(summa - 1) < 1e-6, 'andelarna summerar till 1');
assert.ok(lt.andel[1] > 0.4, '3 % lutning hamnar oftast i klassen 1:50–1:20: ' + lt.andel.map(a => a.toFixed(2)));
assert.ok(lt.andel[3] > 0, 'kullen har brantare partier');
const lk = P.lutningKonturer(lt);
assert.ok(lk.length > 0);
assert.ok(P.dxfLutning(lk, r, 1000, 2000).includes('LUTNING_OVER_1_12'));

const t0 = Date.now();
const sk = P.skyfall(g, r);
assert.strictEqual(sk.lagpunkter.length, 1, 'en lågpunkt: ' + sk.lagpunkter.length);
const l = sk.lagpunkter[0];
assert.ok(Math.abs(l.x - 1060) <= 4 && Math.abs(l.y - (2150 - 70)) <= 4, 'lågpunkten i skålen ' + l.x + ' ' + l.y);
assert.ok(l.maxDjup > 0.1 && l.maxDjup < 0.8, 'djup ' + l.maxDjup);
assert.ok(l.konturer.length >= 1);
assert.ok(sk.floden.length >= 1, 'minst en flödesväg');
console.log('skyfall', Date.now() - t0, 'ms;', sk.floden.length, 'flödesvägar; lågpunkt', l.yta, 'm²', l.maxDjup.toFixed(2), 'm');

// volymer: sadeltak, nock längs x
const v = { namn: 'Hus', fotavtryck: [[1100, 2100], [1120, 2100], [1120, 2110], [1100, 2110]], golv: 105, takfot: 6, takform: 'sadel', taklutning: 30, nockriktning: 0 };
assert.ok(Math.abs(P.takhojd(v, 1110, 2105) - (111 + 5 * Math.tan(Math.PI / 6))) < 1e-6, 'nockhöjd mitt på');
assert.ok(Math.abs(P.takhojd(v, 1110, 2100) - 111) < 1e-6, 'takfot vid långsidan');
const zb = P.branInVolymer(g, z, [v]);
const q = (2150 - 2105) * W + (1110 - 1000);
assert.ok(zb[q] > 113, 'volymen bränns in');
assert.ok(P.dxfVolymer([v], r, 1000, 2000, 0).includes('SKISS_FOTAVTRYCK'));

// DXF: fotavtryck ut och in igen
const dxf = Dxf.skriv({ HUS: 7 }, [{ typ: 'pl', lager: 'HUS', sluten: true, pts: v.fotavtryck }]);
const fa = P.lasDxfFotavtryck(dxf);
assert.strictEqual(fa.length, 1); assert.strictEqual(fa[0].pts.length, 4); assert.strictEqual(fa[0].lager, 'HUS');
const lw = ['0', 'SECTION', '2', 'ENTITIES', '0', 'LWPOLYLINE', '8', 'A', '90', '4', '70', '1', '10', '0', '20', '0', '10', '10', '20', '0', '10', '10', '20', '5', '10', '0', '20', '5', '0', 'ENDSEC', '0', 'EOF'].join('\n');
const fb = P.lasDxfFotavtryck(lw);
assert.strictEqual(fb.length, 1); assert.deepStrictEqual(fb[0].pts[2], [10, 5]);

// strandskydd
const vatten = [{ typ: 'sjö', namn: 'Sjön', yta: true, pts: [[1300, 2000], [1400, 2000], [1400, 2100], [1300, 2100]] }];
assert.strictEqual(Math.round(P.narmasteVatten(r, vatten).avstand), 100);
console.log('platsanalys: alla test godkända');
