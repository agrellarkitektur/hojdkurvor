// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
// Kör med: node test/hamtminne.test.js
// Hämtminnet (0.14.3, AY): samma område hämtas inte igen, ett annat område tömmer minnet,
// felsvar sparas inte och Range-läsningar hålls isär.
const assert = require('assert');
const H = require('../js/hamtminne.js');

let anrop = 0;
globalThis.fetch = async (url, opt = {}) => {
  anrop++;
  if (String(url).includes('fel')) return new Response('nej', { status: 502 });
  const range = opt.headers && (opt.headers.Range || opt.headers.range) || '';
  return new Response(`data ${url} ${range} ${opt.body || ''}`, { status: range ? 206 : 200, headers: range ? { 'Content-Range': 'bytes 0-15/100' } : {} });
};
const ursprung = globalThis.fetch;
const text = async p => (await p).text();

(async () => {
  const A = { r: { xmin: 0, ymin: 0, xmax: 100, ymax: 100 }, epsg: 3006 };
  H.borja(A);
  assert.notStrictEqual(globalThis.fetch, ursprung);
  assert.strictEqual(await text(fetch('https://a.se/x')), 'data https://a.se/x  ');
  assert.strictEqual(await text(fetch('https://a.se/x')), 'data https://a.se/x  ');
  assert.strictEqual(anrop, 1, 'andra gången ur minnet');
  const r1 = await fetch('https://a.se/t', { headers: { Range: 'bytes=0-15' } });
  const r2 = await fetch('https://a.se/t', { headers: { Range: 'bytes=16-31' } });
  assert.strictEqual(anrop, 3, 'olika Range är olika delar');
  const r1b = await fetch('https://a.se/t', { headers: { Range: 'bytes=0-15' } });
  assert.strictEqual(anrop, 3);
  assert.strictEqual(r1b.status, 206); assert.strictEqual(r1b.headers.get('content-range'), 'bytes 0-15/100');
  assert.strictEqual(await r1b.text(), await r1.text()); await r2.text();
  await fetch('geodata.php?u=1', { method: 'POST', body: 'q=1' });
  await fetch('geodata.php?u=1', { method: 'POST', body: 'q=2' });
  await fetch('geodata.php?u=1', { method: 'POST', body: 'q=1' });
  assert.strictEqual(anrop, 5, 'POST skiljs på kroppen');
  assert.strictEqual((await fetch('https://a.se/fel')).status, 502);
  assert.strictEqual((await fetch('https://a.se/fel')).status, 502);
  assert.strictEqual(anrop, 7, 'felsvar sparas inte');
  await fetch('blob:https://a.se/1'); await fetch('blob:https://a.se/1');
  assert.strictEqual(anrop, 9, 'blob: sparas inte');
  assert.deepStrictEqual(H.stat().traffar, 3);
  H.sluta();
  assert.strictEqual(globalThis.fetch, ursprung, 'fetch återställd');
  assert.ok(H.galler(A));

  // samma område igen: allt finns
  H.borja(JSON.parse(JSON.stringify(A)));
  await fetch('https://a.se/x');
  assert.strictEqual(anrop, 9);
  H.sluta();
  // ett annat område: tömt
  const B = { r: { xmin: 10, ymin: 0, xmax: 110, ymax: 100 }, epsg: 3006 };
  assert.ok(!H.galler(B));
  H.borja(B);
  await fetch('https://a.se/x');
  assert.strictEqual(anrop, 10);
  H.sluta();
  assert.ok(!H.galler(A));
  H.tom();
  assert.ok(!H.galler(B));
  console.log('hamtminne: ok');
})().catch(e => { console.error(e); process.exit(1); });
