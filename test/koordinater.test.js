// Kör med: node test/koordinater.test.js
// Prövar hur dialogen Klistra in koordinater föreslår koordinatsystem (Terrang.tolkaZon)
// mot de riktiga kommungränserna i data/kommuner.json.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
globalThis.proj4 = require('../vendor/proj4.js');
const T = require('../js/karna.js');
T.registreraZoner();

const kommuner = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'kommuner.json'), 'utf8')).features;
function iRing(pt, ring) {
  let inne = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inne = !inne;
  }
  return inne;
}
function hittaKommun(lon, lat) {
  for (const f of kommuner) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const p of polys) if (iRing([lon, lat], p[0]) && !p.slice(1).some(h => iRing([lon, lat], h))) return f.properties;
  }
  return null;
}
const passar = (epsg, lon, lat) => {
  const [x, y] = T.omvandlare(4326, epsg).forward([lon, lat]);
  return T.tolkaZon(x, y, hittaKommun).filter(t => t.passar).map(t => t.epsg);
};

// Varje kommuns egna koordinater föreslår kommunens system. Fel zon kan ibland hamna i en
// annan kommun som också "passar"; därför visar dialogen alltid vilken kommun det blir.
for (const [namn, lon, lat] of [['Vimmerby', 15.8553, 57.6650], ['Göteborg', 11.9668, 57.7072], ['Kinda', 15.6343, 58.0019], ['Umeå', 20.2630, 63.8258]]) {
  const k = hittaKommun(lon, lat);
  assert.ok(k && k.namn === namn, namn + ' hittas');
  assert.ok(passar(k.epsg, lon, lat).includes(k.epsg), `${namn}: ${T.zon(k.epsg).namn} föreslås`);
}
// samma östvärde i en annan zon flyttar punkten i öst–väst
const [x, y] = T.omvandlare(4326, 3010).forward([15.8553, 57.6650]);
const rader = T.tolkaZon(x, y, hittaKommun);
assert.strictEqual(rader.length, T.ZONER.length);
assert.ok(rader.find(r => r.epsg === 3010).passar, 'Vimmerby i 16 30');
const i1500 = rader.find(r => r.epsg === 3009);
assert.ok(i1500.lon < 14.5, 'i 15 00 hamnar Vimmerbys koordinater en och en halv grad västerut');
assert.ok(!(i1500.kommun && i1500.kommun.namn === 'Vimmerby'));
console.log('koordinater: alla test godkända');
