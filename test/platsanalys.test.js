// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
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
// 0.13.0: volymen som ytor (3DFACE) – fyra väggar, två takfall och två gavlar (sadeltak), ett L-format platt tak
{
  const dv = P.dxfVolymer([v], r, 1000, 2000, 0), ytor = dv.split('\r\n').filter(x => x === '3DFACE').length;
  assert.ok(dv.includes('SKISS_VOLYM'));
  assert.ok(ytor >= 4 + 2 + 2, '3DFACE: ' + ytor);
  const L = { namn: 'L', fotavtryck: [[0, 0], [20, 0], [20, 8], [8, 8], [8, 20], [0, 20]], golv: 100, takfot: 3, takform: 'platt', taklutning: 0 };
  const dl = P.dxfVolymer([L], r, 0, 0, 0), n = dl.split('\r\n').filter(x => x === '3DFACE').length;
  assert.strictEqual(n, 6 + 4, 'sex väggar och fyra trianglar i L-taket');
  // golv saknas (null eller NaN): ingen volym i DXF:en
  assert.ok(!P.dxfVolymer([Object.assign({}, v, { golv: null }), Object.assign({}, v, { golv: NaN })], r, 0, 0, 0).includes('3DFACE'));
}

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
// reglerna från 1 juli 2025 (0.13.5): små sjöar, bäckar och anlagt vatten räknas inte
assert.strictEqual(P.strandKlass({ typ: 'sjö', yta: true, pts: [[0, 0], [99, 0], [99, 99], [0, 99]] }).skydd, false);
assert.strictEqual(P.strandKlass({ typ: 'sjö', yta: true, pts: [[0, 0], [101, 0], [101, 101], [0, 101]] }).skydd, true);
assert.strictEqual(P.strandKlass({ typ: 'sjö', yta: true, sluten: false, pts: [[0, 0], [5, 0], [5, 5]] }).skydd, true, 'en bit av en stor sjö');
assert.strictEqual(P.strandKlass({ typ: 'bäck', pts: [[0, 0], [5, 0]] }).skydd, false);
assert.strictEqual(P.strandKlass({ typ: 'anlagt', yta: true, pts: [[0, 0], [500, 0], [500, 500]] }).skydd, false);
{
  const damm = { typ: 'sjö', namn: 'Dammen', yta: true, pts: [[1100, 2160], [1150, 2160], [1150, 2200], [1100, 2200]] };   // 0,2 ha, 10 m norr om utsnittet
  const st = P.strandskydd(r, [damm].concat(vatten), { zoner: true });
  assert.strictEqual(Math.round(st.avstand), 100, 'dammen räknas inte, Sjön gör det');
  assert.strictEqual(st.objekt.namn, 'Sjön');
  assert.strictEqual(st.ovrigt.objekt.namn, 'Dammen'); assert.strictEqual(Math.round(st.ovrigt.avstand), 10);
  // 100-metersgränsen kring Sjön (1300–1400, 2000–2100) går genom x = 1200 vid y = 2050
  const tillSjon = p => Math.hypot(Math.max(1300 - p[0], 0, p[0] - 1400), Math.max(2000 - p[1], 0, p[1] - 2100));
  const pts = st.zoner.m100.flat().filter(p => p[0] > 800 && p[0] < 1900 && p[1] > 1700 && p[1] < 2450);
  assert(pts.length > 4);
  pts.forEach(p => assert(Math.abs(tillSjon(p) - 100) < 4, 'punkt på 100-metersgränsen: ' + p + ' ' + tillSjon(p)));
  assert(st.zoner.m300.length > 0);
  const dxf = P.dxfStrandskydd(st, [damm].concat(vatten), r, 0, 0);
  assert(/STRANDSKYDD_100/.test(dxf) && /STRANDSKYDD_VATTEN/.test(dxf));
  // 0.16.3 (B6): en strand som är klippt mot rutan är en linje. Stranden buktar 150 m åt öster; sträckan
  // tillbaka till första punkten (x = 0) är ingen strand, så 100-metersgränsen ligger vid x = 50 som för hela sjön.
  {
    const bukt = []; for (let i = 0; i <= 24; i++) { const y = -600 + i * 50; bukt.push([150 * Math.cos((y / 600) * Math.PI / 2), y]); }
    const hel = { typ: 'sjö', namn: 'Hel', yta: true, pts: bukt.concat([[2000, 600], [2000, -600]]) };
    const klippt = { typ: 'sjö', namn: 'Klippt', yta: true, sluten: false, pts: bukt };
    const tomt = { xmin: -60, ymin: -20, xmax: 10, ymax: 20 };
    const m100 = st => st.zoner.m100.flat().filter(p => Math.abs(p[1]) < 30 && p[0] > -150 && p[0] < 100).map(p => p[0]);
    for (const v of [hel, klippt]) {
      const st = P.strandskydd(tomt, [v], { zoner: true }), xs = m100(st);
      assert(xs.length && xs.every(x => Math.abs(x - 50) < 6), `${v.namn}: ${xs.join(', ')}`);
      assert(st.avstand > 130, `${v.namn}: ${st.avstand}`);
    }
  }
  const t0 = Date.now(); P.strandskydd({ xmin: 0, ymin: 0, xmax: 2000, ymax: 2000 }, [{ typ: 'kust', pts: [[-200, -100], [2200, 2300]] }], { zoner: true });
  assert(Date.now() - t0 < 3000, 'zonerna för 2 × 2 km tar under 3 s');
}
console.log('platsanalys: alla test godkända');
