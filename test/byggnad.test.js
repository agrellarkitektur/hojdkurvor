// Kör med: node test/byggnad.test.js
// Läser låtsasfilen test/data/byggnad_kn0513.zip (skapas av test/data/make_vektor.py).
// Med BYGGNAD_GPKG=sökväg/byggnad_kn0884.gpkg körs samma kontroller även på en riktig fil.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
globalThis.proj4 = require('../vendor/proj4.js');
globalThis.Terrang = require('../js/karna.js');
globalThis.Dxf = require('../js/dxf.js');
globalThis.JSZip = require('../vendor/jszip.min.js');
globalThis.Kommunfil = require('../js/kommunfil.js');
const B = require('../js/byggnad.js');
const initSqlJs = require('../vendor/sql-wasm.js');
Terrang.registreraZoner();

(async () => {
  const SQL = await initSqlJs({ locateFile: f => path.join(__dirname, '..', 'vendor', f) });

  // ändamål
  assert.strictEqual(B.andamalText('Bostad;Småhus friliggande'), 'Småhus friliggande');
  assert.strictEqual(B.andamalText('Komplementbyggnad;'), 'Komplementbyggnad');
  assert.strictEqual(B.andamalText('Bostad;Ospecificerad'), 'Bostad');
  assert.strictEqual(B.andamalText(null), null);

  // linjeklippning tar med skärningen mot kanten
  const kl = Kommunfil.klippLinje([[-10, 5], [5, 5], [5, 20]], { xmin: 0, xmax: 10, ymin: 0, ymax: 10 });
  assert.deepStrictEqual(kl, [[[0, 5], [5, 5], [5, 10]]], 'klippLinje: ' + JSON.stringify(kl));

  // låtsasfilen
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(__dirname, 'data', 'byggnad_kn0513.zip')));
  const gpkg = await Object.values(zip.files).find(f => /\.gpkg$/.test(f.name)).async('uint8array');
  const r = { xmin: 539700, xmax: 539900, ymin: 6427600, ymax: 6427800 };
  const res = Kommunfil.lasGpkg(SQL, gpkg, r, { tabell: B.arByggnadsyta, falt: B.FALT });
  assert.ok(res.tabeller.some(t => t.namn === 'byggnadspunkt'), 'punktskiktet finns i filen');
  const bygg = B.franObjekt(res.objekt, r);
  assert.strictEqual(bygg.length, 2, 'huset och garaget, inte ladan utanför eller vindkraftverket');
  const hus = bygg.find(b => b.husnummer === '1');
  assert.strictEqual(hus.typ, 'Bostad');
  assert.deepStrictEqual(hus.andamal, ['Småhus friliggande']);
  assert.ok(hus.huvud);
  assert.strictEqual(Math.round(hus.yta), 240);

  // höjd ur en ytmodell: marken 100 m, huset 8 m högt, garaget saknas i laserdatan
  const W = 201, H = 201, y = { W, H, s: 1, x0: 539700, y1: 6427800, dtm: new Float32Array(W * H).fill(100), ndsm: new Float32Array(W * H) };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = y.x0 + i, yy = y.y1 - j;
    if (x >= 539790 && x <= 539810 && yy >= 6427694 && yy <= 6427706) y.ndsm[j * W + i] = 6 + 4 * (1 - Math.abs(yy - 6427700) / 6);
  }
  B.hojder(bygg, y);
  assert.strictEqual(hus.mark, 100);
  assert.ok(hus.hojd >= 9 && hus.hojd <= 10, 'husets höjd nära nocken: ' + hus.hojd);
  const garage = bygg.find(b => b.husnummer === '2');
  assert.strictEqual(garage.hojd, null, 'garaget har ingen höjd i laserdatan');
  assert.strictEqual(B.somVolymer(bygg).length, 1, 'bara byggnader med höjd blir volymer');
  assert.strictEqual(B.somVolymer(bygg, { utanHojd: 3 }).length, 2);

  // DXF och CSV
  const dxf = B.dxf(bygg, r, r.xmin, r.ymin, 0);
  for (const l of ['BYGGNAD_BOSTAD', 'BYGGNAD_KOMPLEMENTBYGGNAD', 'BYGGNAD_TAK', 'BYGGNAD_TEXT', 'UTSNITT']) assert.ok(dxf.includes('\r\n' + l + '\r\n'), 'lager ' + l);
  assert.ok(dxf.includes('Hus 1'));
  const csv = B.csv(bygg, 0, 0, 0);
  assert.strictEqual(csv.trim().split('\r\n').length, 3);
  assert.ok(csv.includes('Bostad;Småhus friliggande;1;'), csv);

  // riktig fil
  if (process.env.BYGGNAD_GPKG) {
    const t0 = Date.now();
    const verklig = fs.readFileSync(process.env.BYGGNAD_GPKG);
    const rv = { xmin: 552700, xmax: 553100, ymin: 6391500, ymax: 6391900 };   // Vimmerby centrum
    const rr = Kommunfil.lasGpkg(SQL, verklig, rv, { tabell: B.arByggnadsyta, falt: B.FALT });
    const bv = B.franObjekt(rr.objekt, rv);
    const typer = B.perTyp(bv);
    console.log(`riktig fil: ${bv.length} byggnader på ${Date.now() - t0} ms`, typer, bv.slice(0, 3).map(B.beteckning));
    assert.ok(bv.length > 20, 'Vimmerby centrum har byggnader');
    assert.ok(bv.every(b => b.fotavtryck.length >= 3 && b.typ));
  }
  console.log('byggnad: alla test godkända');
})().catch(e => { console.error(e); process.exit(1); });
