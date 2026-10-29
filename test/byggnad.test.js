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
  // takformer ur laserdatan (0.9.1): sadeltak, takfot 6 m, nock 10 m, en skorsten
  {
    const W = 60, H = 40, dtm = new Float32Array(W * H).fill(100), ndsm = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = i, y = 40 - j;
      if (Math.abs(x - 30) < 10 && Math.abs(y - 20) < 6) ndsm[j * W + i] = 10 - 4 * Math.abs(y - 20) / 6;
    }
    ndsm[(40 - 22) * W + 25] = 14;
    const b = { fotavtryck: [[20, 14], [40, 14], [40, 26], [20, 26]], hal: [] };
    B.hojder([b], { W, H, s: 1, x0: 0, y1: 40, dtm, ndsm });
    assert.ok(b.tak && !Object.keys(b).includes('tak'), 'takets höjder följer inte med när byggnaden sparas');
    const t = B.takmodell(b);
    assert.ok(t, 'takform');
    assert.ok(Math.abs(t.nock - 110) < 0.01, `nocken utan skorstenen: ${t.nock}`);
    assert.ok(t.takfot > 105.5 && t.takfot < 107.5, `takfoten nära 6 m: ${t.takfot}`);
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i < t.pos.length; i += 3) {
      xmin = Math.min(xmin, t.pos[i]); xmax = Math.max(xmax, t.pos[i]); ymin = Math.min(ymin, t.pos[i + 1]); ymax = Math.max(ymax, t.pos[i + 1]);
      assert.ok(t.pos[i + 2] >= t.takfot - 0.01 && t.pos[i + 2] <= t.nock + 0.01);
    }
    assert.deepStrictEqual([xmin, xmax, ymin, ymax].map(Math.round), [20, 40, 14, 26], 'taket går ut till fotavtryckets kanter');
    // trianglarna vänder uppåt (moturs ovanifrån)
    for (let k = 0; k < t.index.length; k += 3) {
      const [a, c, d] = [t.index[k], t.index[k + 1], t.index[k + 2]].map(q => [t.pos[q * 3], t.pos[q * 3 + 1]]);
      assert.ok((c[0] - a[0]) * (d[1] - a[1]) - (c[1] - a[1]) * (d[0] - a[0]) > 0);
    }
    assert.strictEqual(B.takmodell({ fotavtryck: b.fotavtryck, hal: [], mark: 100, hojd: 9 }), null, 'utan laserdata ingen takform');
    console.log('ok takform ur laserdatan');
  }
  console.log('byggnad: alla test godkända');
})().catch(e => { console.error(e); process.exit(1); });
