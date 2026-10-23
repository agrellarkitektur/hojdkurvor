// Kör med: node test/ortofoto.test.js
// Urvalet prövas på ett riktigt svar från Lantmäteriets bildkatalog (Vimmerby, test/data/stac-bild-sok-vimmerby.json).
// Läsningen prövas på låtsasortofotona från test/data/make_orto.py (hoppas över om de saknas).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
globalThis.proj4 = require('../vendor/proj4.js');
globalThis.Worker = globalThis.Worker || class {};      // webbläsarbygget av geotiff.js vill se Worker när det laddas
globalThis.GeoTIFF = require('../vendor/geotiff.js');
globalThis.Terrang = require('../js/karna.js');
const O = require('../js/ortofoto.js');
Terrang.registreraZoner();

(async () => {
  // --- tolkning och urval, riktigt katalogsvar
  const items = O.tolka(JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'stac-bild-sok-vimmerby.json'), 'utf8')));
  assert.strictEqual(items.length, 21);
  const ny = items.find(i => i.id === 'o63900_5500_25_mr25');
  assert.deepStrictEqual([ny.ar, ny.spektral, ny.upplosning, ny.epsg, ny.samling], [2025, 'rgbi', 0.16, 3006, 'orto-i2-2025']);
  assert.ok(ny.href.endsWith('o63900_5500_25_mr25.tif'));
  assert.strictEqual(items.find(i => i.id === 'o06g8a_c59').epsg, 3021);
  const tm = { xmin: 551000, ymin: 6391000, xmax: 551400, ymax: 6391300 };
  let v = O.valj(items, tm);
  assert.deepStrictEqual([v.valda.map(i => i.id), v.ar, v.spektral, v.tackning], [['o63900_5500_25_mr25'], 2025, 'rgbi', 1]);
  // utan 2025 och 2023–2019: färgbilden 2017 (rgb), inte cir
  v = O.valj(items.filter(i => i.ar <= 2017), tm);
  assert.deepStrictEqual([v.valda.map(i => i.id), v.spektral, v.upplosning], [['o63900_5500_25_fm17'], 'rgb', 0.25]);
  // bara historiska (pan, EPSG:3021) ger inget
  assert.strictEqual(O.valj(items.filter(i => i.ar < 2007), tm), null);
  // ett nyare år som bara täcker halva ytan väljs bort till förmån för ett äldre som täcker allt
  const halv = { id: 'halv', ar: 2026, spektral: 'rgbi', upplosning: 0.16, epsg: 3006, bbox: [551200, 6390000, 552500, 6392500], href: 'x', datum: '2026-05-01' };
  v = O.valj([halv, ...items], tm);
  assert.strictEqual(v.ar, 2025);
  v = O.valj([halv], tm);
  assert.ok(Math.abs(v.tackning - 0.5) < 1e-9, 'täckning ' + v.tackning);

  // --- upplösning
  assert.strictEqual(O.upplosning({ xmin: 0, ymin: 0, xmax: 300, ymax: 200 }, 0.16), 0.16);
  assert.strictEqual(O.upplosning({ xmin: 0, ymin: 0, xmax: 1000, ymax: 1000 }, 0.16), 0.25);
  assert.strictEqual(O.upplosning({ xmin: 0, ymin: 0, xmax: 2000, ymax: 1500 }, 0.16), 0.5);
  assert.strictEqual(O.upplosning({ xmin: 0, ymin: 0, xmax: 300, ymax: 200 }, 0.5), 0.5);
  assert.strictEqual(O.upplosning({ xmin: 0, ymin: 0, xmax: 9000, ymax: 100 }, 0.25), 2);   // längsta sidan högst 8192 px

  // --- läsning och omritning till zon 15 00 över två rutor
  const fil = n => path.join(__dirname, 'data', n);
  if (!fs.existsSync(fil('o64275_5390_t_mr25.tif'))) {
    console.log('ortofoto: låtsasfilerna saknas (kör test/data/make_orto.py), läsningen prövas inte');
    console.log('ortofoto: urvalet OK');
    return;
  }
  const oppna = href => { const b = fs.readFileSync(fil(path.basename(href))); return GeoTIFF.fromArrayBuffer(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
  const ruta = (id, x0, x1) => ({ id, href: `https://dl1.lantmateriet.se/bild/data/orto/test/${id}.tif`, bbox: [x0, 6427000, x1, 6429000] });
  const valda = [ruta('o64275_5390_t_mr25', 539000, 539800), ruta('o64275_5398_t_mr25', 539800, 540600)];
  const tillZ = Terrang.omvandlare(3006, 3009).forward;
  const [cx, cy] = tillZ([539800, 6427700]);
  const r = Terrang.avrunda({ xmin: cx - 120, xmax: cx + 120, ymin: cy - 80, ymax: cy + 80 }, 1);
  const mal = O.rutnat(r, 0.5);
  assert.deepStrictEqual([mal.W, mal.H], [480, 320]);
  const t0 = Date.now();
  const b = await O.las(valda, mal, 3009, null, { oppna });
  const ms = Date.now() - t0;
  assert.deepStrictEqual(b.rutor, valda.map(x => x.id));
  assert.ok(b.tackt > 0.999, 'täckt ' + b.tackt);
  const px = (E, N) => {     // färgen i målbilden vid en punkt i TM
    const [x, y] = tillZ([E, N]);
    const i = Math.floor((x - mal.x0) / mal.s), j = Math.floor((mal.y1 - y) / mal.s), q = (j * mal.W + i) * 4;
    return [b.rgba[q], b.rgba[q + 1], b.rgba[q + 2], b.rgba[q + 3]];
  };
  const rod = c => c[0] > 180 && c[1] < 120 && c[2] < 120, bla = c => c[2] > 180 && c[0] < 120 && c[1] < 120;
  // röda linjer var tionde meter i öst, i båda rutorna; blå var tionde meter i norr (x5)
  let rattRod = 0, rattBla = 0, n = 0;
  for (const E of [539700, 539730, 539770, 539790, 539810, 539850, 539890]) for (const N of [6427652, 6427688, 6427722, 6427748]) {
    n++; if (rod(px(E, N))) rattRod++;
    assert.ok(!rod(px(E + 2.5, N)), `inte röd 2,5 m bredvid linjen vid ${E + 2.5}, ${N}: ${px(E + 2.5, N)}`);
  }
  for (const N of [6427645, 6427685, 6427725, 6427755]) for (const E of [539712, 539756, 539833, 539877]) {
    if (bla(px(E, N))) rattBla++;
    assert.ok(!bla(px(E, N + 2.5)), `inte blå 2,5 m bredvid linjen vid ${E}, ${N + 2.5}`);
  }
  assert.strictEqual(rattRod, n, `röda linjer på rätt plats: ${rattRod} av ${n}`);
  assert.strictEqual(rattBla, 16, `blå linjer på rätt plats: ${rattBla} av 16`);
  // skarven mellan rutorna: grannrutan är blåare
  const vanster = px(539795, 6427700), hoger = px(539805, 6427700);
  assert.ok(hoger[2] - vanster[2] > 20, `skarven: ${vanster} / ${hoger}`);

  // --- JPEG med YCbCr (2019, rgb): gula linjer ska bli gula, inte felfärgade
  const b19 = await O.las([ruta('o64275_5390_t_fm19', 539000, 539800)], mal, 3009, null, { oppna });
  assert.ok(b19.tackt > 0.4 && b19.tackt < 0.7, 'täckt 2019 ' + b19.tackt);
  const [x19, y19] = tillZ([539770, 6427700]);
  const q19 = (Math.floor((mal.y1 - y19) / mal.s) * mal.W + Math.floor((x19 - mal.x0) / mal.s)) * 4;
  const gul = [...b19.rgba.slice(q19, q19 + 3)];
  assert.ok(gul[0] > 190 && gul[1] > 170 && gul[2] < 90, 'gul linje 2019: ' + gul);

  // --- grövre bild läses från en översiktsnivå
  const grov = O.rutnat(r, 2);
  const bg = await O.las(valda, grov, 3009, null, { oppna });
  assert.ok(bg.tackt > 0.999);

  console.log(`ortofoto: OK (omritning ${mal.W}×${mal.H} px på ${ms} ms)`);
})().catch(e => { console.error(e); process.exit(1); });
