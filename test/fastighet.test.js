// Kör med: node test/fastighet.test.js
// Läser låtsasfilen test/data/fastighetsindelning_kn0513.zip (skapas av test/data/make_vektor.py).
// Med FASTIGHET_GPKG=sökväg/fastighetsindelning_kn0884.gpkg körs kontrollerna även på en riktig fil.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
globalThis.proj4 = require('../vendor/proj4.js');
globalThis.Terrang = require('../js/karna.js');
globalThis.Dxf = require('../js/dxf.js');
globalThis.JSZip = require('../vendor/jszip.min.js');
globalThis.Kommunfil = require('../js/kommunfil.js');
const F = require('../js/fastighet.js');
const initSqlJs = require('../vendor/sql-wasm.js');
Terrang.registreraZoner();

(async () => {
  const SQL = await initSqlJs({ locateFile: f => path.join(__dirname, '..', 'vendor', f) });
  const las = (bytes, r) => {
    const tabell = t => /registerenhetsomradesyta|registerenhetsomradesgrans|granspunkt/.test(t);
    return F.franObjekt(Kommunfil.lasGpkg(SQL, bytes, r, { tabell, falt: F.FALT }).objekt, r);
  };

  assert.strictEqual(F.beteckning({ trakt: 'VIMMERBY', block: '3', enhet: 269 }), 'Vimmerby 3:269');
  assert.strictEqual(F.beteckning({ trakt: 'RUMSKULLA-KÄLLEBERG', block: 'S', enhet: 1 }), 'Rumskulla-Källeberg S:1');
  const ank = F.ankare([[[0, 0], [10, 0], [10, 2], [2, 2], [2, 10], [0, 10]]]);
  assert.ok(F.iYta([[[0, 0], [10, 0], [10, 2], [2, 2], [2, 10], [0, 10]]], ank[0], ank[1]), 'ankaret i en L-formad yta ligger inne i ytan');

  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(__dirname, 'data', 'fastighetsindelning_kn0513.zip')));
  const gpkg = await Object.values(zip.files).find(f => /\.gpkg$/.test(f.name)).async('uint8array');
  const r = { xmin: 539700, xmax: 539900, ymin: 6427600, ymax: 6427800 };
  const f = las(gpkg, r);
  assert.deepStrictEqual(f.fastigheter.map(x => x.beteckning).sort(), ['Kisa 1:7', 'Staren 1:2', 'Staren 1:3']);
  assert.strictEqual(Math.round(f.fastigheter.find(x => x.beteckning === 'Staren 1:2').yta), 6400);
  assert.ok(f.granser.some(g => g.osakerhet === 4.5), 'osäker gräns');
  assert.strictEqual(f.punkter.length, 3, "punkten i 539920 ligger utanför");
  const dxf = F.dxf(f, r, r.xmin, r.ymin);
  for (const l of ['GRANS_FASTIGHETSGRANS', 'GRANS_FASTIGHETSGRANS_OSAKER', 'GRANSPUNKT', 'FASTIGHET_BETECKNING']) assert.ok(dxf.includes('\r\n' + l + '\r\n'), 'lager ' + l);
  assert.ok(dxf.includes('\r\n1:2\r\n'), 'beteckningen 1:2 i DXF');
  const kisa = f.ytor.find(y => y.beteckning === 'Kisa 1:7');
  assert.ok(kisa.ankare && F.iYta(kisa.ringar, kisa.ankare[0], kisa.ankare[1]), 'Kisa 1:7 (yta med hål) får beteckningen inne i ytan');

  if (process.env.FASTIGHET_GPKG) {
    const t0 = Date.now();
    const rv = { xmin: 552700, xmax: 553100, ymin: 6391500, ymax: 6391900 };
    const fv = las(fs.readFileSync(process.env.FASTIGHET_GPKG), rv);
    console.log(`riktig fil: ${fv.fastigheter.length} fastigheter, ${fv.granser.length} gränslinjer, ${fv.punkter.length} gränspunkter på ${Date.now() - t0} ms`,
      fv.fastigheter.slice(0, 5).map(x => `${x.beteckning} (${Math.round(x.yta)} m²)`), F.perLager(fv));
    assert.ok(fv.fastigheter.length > 5);
    assert.ok(fv.ytor.every(y => y.ankare), 'alla ytor har en plats för beteckningen');
  }
  console.log('fastighet: alla test godkända');
})().catch(e => { console.error(e); process.exit(1); });
