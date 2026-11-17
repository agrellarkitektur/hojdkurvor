// Horisontens grova höjdmodell (0.12.1): rutor som inte går att läsa hoppas över.
// Kör: node test/horisont.test.js
'use strict';
const assert = require('assert');
const T = require('../js/karna.js');

// Låtsas-GeoTIFF: varje ruta har höjden 100 + rutans östliga index.
globalThis.GeoTIFF = {
  async fromUrl(url) {
    const m = url.match(/m(\d+)_(\d+)\.tif/), n = +m[1], e = +m[2];
    const box = [e * 1e4, n * 1e4, (e + 1) * 1e4, (n + 1) * 1e4];
    return {
      async getImage() { return { getBoundingBox: () => box, getGDALNoData: () => null }; },
      async readRasters({ width, height }) { return [new Float32Array(width * height).fill(100 + e)]; },
    };
  },
};

let svar;   // id → 'ok' | 404 | 'natfel' | 401
globalThis.fetch = async (url) => {
  const id = url.match(/m(\d+_\d+)\.tif/)[1], s = svar[id] || 'ok';
  if (s === 'natfel') throw new TypeError('Failed to fetch');
  if (s === 'ok') return { status: 206, ok: true };
  return { status: s, ok: false };
};

// 10 × 10 km kring en punkt nära rutgränsen ger fyra rutor.
const box = { xmin: 545000, xmax: 555000, ymin: 6395000, ymax: 6405000 };

(async () => {
  svar = {};
  let m = await T.lasHojderGrov(box, 100, 'Basic x');
  assert.deepStrictEqual([m.saknas, m.fel], [[], []]);
  assert.ok(m.data.every(v => v >= 154 && v <= 155), 'alla rutor lästa');

  // En ruta ger nätverksfel (t.ex. 404 utan CORS-huvuden), en finns inte, en svarar 401.
  svar = { '639_55': 'natfel', '640_54': 404, '640_55': 401 };
  m = await T.lasHojderGrov(box, 100, 'Basic x');
  assert.deepStrictEqual(m.saknas, ['640_54']);
  assert.deepStrictEqual(m.fel.sort(), ['639_55', '640_55']);
  const lasta = m.data.filter(v => !isNaN(v)).length;
  assert.strictEqual(lasta, m.w * m.h / 4, 'bara den lästa rutan har värden');

  // Ingen ruta går att läsa: felet kastas, så att appen kan göra soldiagrammet utan horisont.
  svar = { '639_54': 'natfel', '639_55': 'natfel', '640_54': 404, '640_55': 'natfel' };
  await assert.rejects(T.lasHojderGrov(box, 100, 'Basic x'), /Kunde inte nå Lantmäteriets server/);

  console.log('horisont: ok');
})().catch(e => { console.error(e); process.exit(1); });
