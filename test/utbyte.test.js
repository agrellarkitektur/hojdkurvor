// Kör med: node test/utbyte.test.js
// Platspaketet till cad-apa (docs/UTBYTE-CAD-APA.md): grundfälten, byggnader och fastighetsgränser.
// Fastigheterna läses ur låtsasfilen test/data/fastighetsindelning_kn0513.zip (test/data/make_vektor.py).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
globalThis.proj4 = require('../vendor/proj4.js');
globalThis.Terrang = require('../js/karna.js');
globalThis.Dxf = require('../js/dxf.js');
globalThis.JSZip = require('../vendor/jszip.min.js');
globalThis.Kommunfil = require('../js/kommunfil.js');
const F = require('../js/fastighet.js');
const U = require('../js/utbyte.js');
const initSqlJs = require('../vendor/sql-wasm.js');
Terrang.registreraZoner();

(async () => {
  const r = { xmin: 539700, xmax: 539900, ymin: 6427600, ymax: 6427800 };
  const z = new Float32Array(21 * 21).fill(100);
  const bas = { projekt: 'Staren 2', kommun: 'Kinda', epsg: 3006, systemNamn: 'SWEREF 99 TM', utsnitt: r, nollpunkt: { x: r.xmin, y: r.ymin, z: 0 },
    rutnat: { W: 21, H: 21, s: 10, x0: r.xmin, y1: r.ymax, z } };

  // utan tillval: inga fält för byggnader och fastigheter
  const p0 = U.platspaket(bas);
  assert.strictEqual(p0.format, 'hojdkurvor-plats');
  assert.strictEqual(p0.version, 1);
  assert.ok(!('fastigheter' in p0) && !('byggnader' in p0));
  assert.deepStrictEqual(Array.from(U.avkodaFloat32(p0.terrang.rutnat.z)).slice(0, 3), [100, 100, 100]);

  // kurvorna från Terrang.skapaKurvor har höjden i h; den ska komma fram som z (fel före 0.7.0: null)
  const pk = JSON.parse(JSON.stringify(U.platspaket(Object.assign({ kurvor: [{ h: 114.5, lager: 'HOJDKURVA_050', sluten: false, pts: [[0, 0], [1, 1]] }] }, bas))));
  assert.strictEqual(pk.terrang.kurvor[0].z, 114.5);

  // med fastighetsindelningen
  const SQL = await initSqlJs({ locateFile: f => path.join(__dirname, '..', 'vendor', f) });
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(__dirname, 'data', 'fastighetsindelning_kn0513.zip')));
  const gpkg = await Object.values(zip.files).find(f => /\.gpkg$/.test(f.name)).async('uint8array');
  const tabell = t => /registerenhetsomradesyta|registerenhetsomradesgrans|granspunkt/.test(t);
  const fi = F.franObjekt(Kommunfil.lasGpkg(SQL, gpkg, r, { tabell, falt: F.FALT }).objekt, r);
  const p = JSON.parse(JSON.stringify(U.platspaket(Object.assign({ fastigheter: fi, fastighetVarning: F.VARNING }, bas))));
  const f = p.fastigheter;
  assert.ok(f, 'fältet fastigheter finns');
  assert.strictEqual(f.granser.length, fi.granser.length);
  assert.strictEqual(f.punkter.length, 3);
  assert.deepStrictEqual(f.ytor.map(y => y.beteckning).sort(), ['Kisa 1:7', 'Staren 1:2', 'Staren 1:3']);
  assert.ok(f.granser.some(g => g.osakerhet === 4.5), 'osäkerheten följer med');
  assert.ok(f.granser.every(g => g.pts.every(([x, y]) => x >= r.xmin - 1e-6 && x <= r.xmax + 1e-6 && y >= r.ymin - 1e-6 && y <= r.ymax + 1e-6)), 'gränserna är klippta till utsnittet');
  const kisa = f.ytor.find(y => y.beteckning === 'Kisa 1:7');
  assert.ok(kisa.ringar.length >= 2, 'ytan med hål har hålet som egen ring');
  assert.ok(F.iYta(kisa.ringar, kisa.ankare[0], kisa.ankare[1]), 'beteckningens plats ligger inne i ytan');
  assert.strictEqual(Math.round(f.ytor.find(y => y.beteckning === 'Staren 1:2').yta), 6400);
  assert.ok(/inte rättsligt bindande/.test(f.varning));
  assert.ok(/fastighetsindelning © Lantmäteriet/.test(p.licens), p.licens);
  console.log('utbyte: alla test godkända');
})().catch(e => { console.error(e); process.exit(1); });
