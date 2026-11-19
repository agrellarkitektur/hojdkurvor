// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
// Geodata från andra myndigheter (0.13.4): frågan till Naturvårdsverket och nya försök vid
// tillfälliga fel. Svaren efterliknar de riktiga tjänsterna som de såg ut 19 november 2026.
// Kör: node test/geodata.test.js
'use strict';
const assert = require('assert');
const G = require('../js/geodata.js');

globalThis.self = globalThis;
globalThis.TERRANG_PAUSER = [1, 1];
globalThis.TERRANG_KONFIG = { geodataProxy: '' };

const XMLFEL = fmt => '<ExceptionReport version="2.0.0" xmlns="http://www.opengis.net/ows/1.1"><Exception exceptionCode="InvalidParameterValue" locator="outputFormat">'
  + `<ExceptionText><![CDATA[OutputFormat '${fmt}' not supported.]]></ExceptionText></Exception></ExceptionReport>`;
const svar = (status, text) => ({ ok: status >= 200 && status < 300, status, text: async () => text, json: async () => JSON.parse(text) });
const RESERVAT = { type: 'Feature', properties: { GmlID: 'SkyddadeOmraden.1', NVRID: '2001234', NAMN: 'Borgberget', SKYDDSTYP: 'Naturreservat', BESLUTSSTATUS: 'Gällande', KOMMUN: 'Västervik' },
  geometry: { type: 'MultiPolygon', coordinates: [[[[580691.75, 6393348.41], [580800, 6393348], [580800, 6393500], [580691.75, 6393348.41]]]] } };
const OVERKLAGAT = { type: 'Feature', properties: { NVRID: '2009999', NAMN: 'Nya skogen', SKYDDSTYP: 'Naturreservat', BESLUTSSTATUS: 'Överklagat' }, geometry: RESERVAT.geometry };
const N2000 = { type: 'Feature', properties: { OMRADESNAMN: 'Stora Grindö', OMRADESKOD: 'SE0330189', OMRADESTYP: 'SCI' },
  geometry: { type: 'MultiPolygon', coordinates: [[[[580700, 6393400], [580750, 6393400], [580750, 6393450], [580700, 6393400]]]] } };

/** Låtsastjänst som de riktiga: bara GEOJSON, och rutan med nordvärdet först. */
function naturvardsverket(url) {
  const u = new URL(url), fmt = u.searchParams.get('outputFormat');
  if (fmt !== 'GEOJSON') return svar(200, XMLFEL(fmt));
  const b = u.searchParams.get('bbox').split(',');
  assert.strictEqual(b[4], 'EPSG:3006');
  const nordForst = +b[0] > 5e6 && +b[1] < 5e6;
  const alla = u.pathname.includes('n2000') ? [N2000] : [RESERVAT, OVERKLAGAT];
  return svar(200, JSON.stringify({ type: 'FeatureCollection', crs: { type: 'name', properties: { name: 'EPSG:3006' } }, features: nordForst ? alla : [] }));
}
const bTM = { xmin: 580000, ymin: 6393000, xmax: 581000, ymax: 6394000 };
const somDen = p => p;

(async () => {
  // --- frågan: formatet och axelordningen som tjänsten kräver
  const u = new URL(G.wfsUrl(G.TJANSTER.naturWfs, 'Naturvardsregistret_WFS:SkyddadeOmraden', bTM));
  assert.strictEqual(u.searchParams.get('outputFormat'), 'GEOJSON');
  assert.strictEqual(u.searchParams.get('bbox'), '6393000,580000,6394000,581000,EPSG:3006', 'nordvärdet först');
  assert.strictEqual(u.searchParams.get('typeNames'), 'Naturvardsregistret_WFS:SkyddadeOmraden');

  // --- svaren tolkas med tjänsternas egna fältnamn
  let anrop = [];
  globalThis.fetch = async url => { anrop.push(url); return naturvardsverket(url); };
  let n = await G.skyddadNatur(bTM, somDen);
  assert.strictEqual(anrop.length, 2);
  assert.strictEqual(n.length, 3);
  assert.deepStrictEqual([n[0].typ, n[0].namn, n[0].id], ['Naturreservat', 'Borgberget', '2001234']);
  assert.strictEqual(n[1].typ, 'Naturreservat (överklagat)', 'ett beslut som inte gäller än sägs i klartext');
  assert.deepStrictEqual([n[2].typ, n[2].namn, n[2].id], ['Natura 2000, art- och habitatdirektivet', 'Stora Grindö', 'SE0330189']);
  assert.deepStrictEqual(n[0].ringar[0][0], [580691.75, 6393348.41], 'östvärdet först i svaret');
  assert.strictEqual(n.saknas, undefined);
  assert.strictEqual(G.natura2000Typ('SPA/SCI'), 'Natura 2000, fågeldirektivet och art- och habitatdirektivet');
  assert.strictEqual(G.natura2000Typ(''), 'Natura 2000');

  // koordinater med nordvärdet först i svaret vänds
  assert.deepStrictEqual(G.ringar({ type: 'Polygon', coordinates: [[[6393348, 580691], [6393500, 580800]]] }, somDen), [[[580691, 6393348], [580800, 6393500]]]);

  // --- den gamla frågan (application/json) gav det fel som syntes i testet 17 och 19 november
  globalThis.fetch = async () => svar(200, XMLFEL('application/json'));
  await assert.rejects(G.skyddadNatur(bTM, somDen), /svarade med ett fel i stället för data: OutputFormat 'application\/json' not supported/);

  // --- bara den ena tjänsten svarar: det som kom är med, och det sägs att svaret inte är helt
  globalThis.fetch = async url => (url.includes('n2000') ? svar(500, '') : naturvardsverket(url));
  n = await G.skyddadNatur(bTM, somDen);
  assert.strictEqual(n.length, 2);
  assert.match(n.saknas, /^Natura 2000 svarade 500$/);

  // --- nya försök: 502 två gånger, sedan svar
  let nr = 0;
  globalThis.fetch = async () => (++nr <= 2 ? svar(502, '') : svar(200, JSON.stringify({ elements: [] })));
  assert.deepStrictEqual(await G.hamta('https://x/api', 'json', { metod: 'POST', kropp: 'data=1' }), { elements: [] });
  assert.strictEqual(nr, 3, 'tre försök');

  // ger upp efter tre, och säger hur många
  nr = 0;
  globalThis.fetch = async () => { nr++; return svar(502, ''); };
  await assert.rejects(G.hamta('https://x/api', 'json', { metod: 'POST', kropp: 'data=1' }), e => e.message === 'svarade 502 (3 försök)' && e.status === 502);
  assert.strictEqual(nr, 3);

  // andra fel försöks inte igen
  for (const status of [400, 404, 500]) {
    nr = 0;
    globalThis.fetch = async () => { nr++; return svar(status, ''); };
    await assert.rejects(G.hamta('https://x/api'), new RegExp(`^Error: svarade ${status}$`));
    assert.strictEqual(nr, 1, `${status} försöks inte igen`);
  }
  for (const status of G.TILLFALLIGT) {
    nr = 0;
    globalThis.fetch = async () => (++nr === 1 ? svar(status, '') : svar(200, '{}'));
    await G.hamta('https://x/api');
    assert.strictEqual(nr, 2, `${status} försöks igen`);
  }

  // strandskyddets vatten kommer efter ett 502
  nr = 0;
  globalThis.fetch = async () => (++nr === 1 ? svar(502, '') : svar(200, JSON.stringify({ elements: [
    { type: 'way', tags: { natural: 'water', name: 'Lillsjön' }, geometry: [{ lat: 58, lon: 15 }, { lat: 58.001, lon: 15 }, { lat: 58, lon: 15 }] }] })));
  const v = await G.vatten({ syd: 57.9, vast: 14.9, nord: 58.1, ost: 15.1 }, somDen);
  assert.strictEqual(v.length, 1);
  assert.strictEqual(v[0].namn, 'Lillsjön');

  console.log('geodata.test.js: allt godkänt');
})().catch(e => { console.error(e); process.exit(1); });
