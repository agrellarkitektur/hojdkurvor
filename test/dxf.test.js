// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
// Kör med: node test/dxf.test.js
// Samlad DXF (0.12.0): Dxf.sammanfoga slår ihop filer från Dxf.skriv och höjdkurvornas egen skrivare.
// Med DXF_UT=mapp sparas den samlade filen, så att den kan kontrolleras med ezdxf.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
globalThis.proj4 = require('../vendor/proj4.js');
globalThis.Terrang = require('../js/karna.js');
const Dxf = require('../js/dxf.js');
Terrang.registreraZoner();

const r = { xmin: 1000, ymin: 2000, xmax: 1100, ymax: 2080 };
const a = Dxf.skriv({ HUS: 7, UTSNITT: 3 }, [
  { typ: 'pl', lager: 'HUS', sluten: true, pts: [[1010, 2010], [1020, 2010], [1020, 2020]] },
  { typ: 'text', lager: 'HUS', x: 1015, y: 2015, h: 1, text: 'Förråd' },
], { ext: r });
const b = Dxf.skriv({ VAG: 1, UTSNITT: 3 }, [
  { typ: 'pl', lager: 'VAG', pts: [[1000, 2040], [1100, 2050]] },
  { typ: 'punkt', lager: 'VAG', x: 1050, y: 2045, z: 3 },
], { ext: { xmin: 900, ymin: 2000, xmax: 1100, ymax: 2100 } });
const k = Terrang.dxf([{ lager: 'HOJDKURVA_1M', h: 12, pts: [[1000, 2000], [1050, 2030]], sluten: false }], r, 0, 0, 0);

const s = Dxf.sammanfoga([a, b, k]);
const rader = s.split('\r\n');
const lager = [];
for (let i = 0; i < rader.length - 3; i++) if (rader[i] === '0' && rader[i + 1] === 'LAYER' && rader[i + 2] === '2') lager.push(rader[i + 3]);
assert.deepStrictEqual(lager.sort(), ['HOJDKURVA_1M', 'HUS', 'UTSNITT', 'VAG'], 'varje lager en gång');
const antal = typ => rader.filter((q, i) => q === typ && rader[i - 1] === '0').length;
assert.strictEqual(antal('POLYLINE'), 3 + 1, 'alla polylinjer, också kurvfilens utsnitt');
assert.strictEqual(antal('TEXT'), 1);
assert.strictEqual(antal('POINT'), 1);
assert.strictEqual(antal('SECTION'), 3);
assert.strictEqual(antal('EOF'), 1);
assert.ok(s.includes('F\\U+00F6rr\\U+00E5d'), 'texten följer med som den är');
const ext = rader.indexOf('$EXTMIN');
assert.strictEqual(Number(rader[ext + 2]), 900);
assert.strictEqual(Number(rader[rader.indexOf('$EXTMAX') + 4]), 2100);
if (process.env.DXF_UT) fs.writeFileSync(path.join(process.env.DXF_UT, 'samlad.dxf'), s);
console.log('dxf: ok');
