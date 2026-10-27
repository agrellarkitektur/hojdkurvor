// Kör med: node test/ifc.test.js
// IFC-filen för befintliga byggnader (js/ifc.js) och rensningen av träd vid byggnader (Byggnad.tradVidByggnader).
// Med IFC_UT=mapp sparas testfilerna, så att de kan kontrolleras med IfcOpenShell (se test/README.md).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
globalThis.proj4 = require('../vendor/proj4.js');
globalThis.Terrang = require('../js/karna.js');
const B = require('../js/byggnad.js');
const Ifc = require('../js/ifc.js');

// ------------------------------------------------------------------
// GlobalId och text
// ------------------------------------------------------------------
const g1 = Ifc.guid('abc'), g2 = Ifc.guid('abd');
assert.match(g1, /^[0-3][0-9A-Za-z_$]{21}$/, 'GlobalId är 22 tecken: ' + g1);
assert.strictEqual(g1, Ifc.guid('abc'), 'samma nyckel ger samma id');
assert.notStrictEqual(g1, g2);
assert.strictEqual(Ifc.text("Åsa's hus"), "'\\X2\\00C5\\X0\\sa''s hus'");
assert.strictEqual(Ifc.tal(3), '3.');
assert.strictEqual(Ifc.tal(-0.0001), '0.');
assert.strictEqual(Ifc.tal(12.3456), '12.346');

// ------------------------------------------------------------------
// Byggnaderna
// ------------------------------------------------------------------
const X0 = 539700, Y0 = 6427600, Z0 = 100;
const bygg = [
  { id: 'a1', typ: 'Bostad', andamal: ['Småhus friliggande'], husnummer: '1', namn: null, huvud: true,
    fotavtryck: [[539710, 6427610], [539722, 6427610], [539722, 6427620], [539710, 6427620]], hal: [], mark: 101.5, hojd: 6.2 },
  // medurs fotavtryck med en gård, ska bli moturs med hålet medurs
  { id: 'b2', typ: 'Verksamhet', andamal: ['Kontor'], husnummer: null, namn: 'Kvarnen', huvud: false,
    fotavtryck: [[539740, 6427640], [539740, 6427670], [539770, 6427670], [539770, 6427640]],
    hal: [[[539750, 6427650], [539760, 6427650], [539760, 6427660], [539750, 6427660]]], mark: 102, hojd: 12 },
  // ingen höjd: kommer inte med
  { id: 'c3', typ: 'Komplementbyggnad', andamal: [], husnummer: null, namn: null, huvud: false,
    fotavtryck: [[539730, 6427610], [539734, 6427610], [539734, 6427614]], hal: [], mark: 101, hojd: null },
];

Terrang.lokal.vrid = 0;
const lok = Ifc.byggnader(bygg, { dx: X0, dy: Y0, dz: Z0, lokal: true, projekt: 'Testgården', projektId: 'p1', filnamn: 'test_lokal.ifc', kalla: 'höjdkurvor.se test' });
assert.strictEqual(lok.antal, 2);
assert.strictEqual(lok.utanHojd, 1);
const t = lok.text;
assert.ok(t.startsWith('ISO-10303-21;\r\nHEADER;'), 'STEP-huvud');
assert.ok(t.includes("FILE_SCHEMA(('IFC4'));"));
assert.ok(t.trimEnd().endsWith('END-ISO-10303-21;'));
assert.ok(!/[^\x00-\x7f]/.test(t), 'bara ASCII i filen (å, ä, ö kodade)');

// alla referenser pekar på rader som finns, och varje rad har ett nummer bara en gång
const rader = t.split('\r\n').filter(l => /^#\d+=/.test(l));
const nr = new Set();
for (const l of rader) { const n = +l.match(/^#(\d+)=/)[1]; assert.ok(!nr.has(n), 'dubbel rad #' + n); nr.add(n); }
for (const l of rader) for (const m of l.replace(/^#\d+=/, '').matchAll(/#(\d+)/g)) assert.ok(nr.has(+m[1]), `#${m[1]} saknas (${l.slice(0, 60)})`);
const typer = rader.map(l => l.match(/^#\d+=(\w+)\(/)[1]);
const antal = n => typer.filter(x => x === n).length;
assert.strictEqual(antal('IFCPROJECT'), 1);
assert.strictEqual(antal('IFCSITE'), 1);
assert.strictEqual(antal('IFCBUILDINGELEMENTPROXY'), 2);
assert.strictEqual(antal('IFCEXTRUDEDAREASOLID'), 2);
assert.strictEqual(antal('IFCARBITRARYPROFILEDEFWITHVOIDS'), 1, 'gården blir ett hål');
assert.strictEqual(antal('IFCRELCONTAINEDINSPATIALSTRUCTURE'), 1);
assert.strictEqual(antal('IFCPROPERTYSET'), 2);

// GlobalId är unika
const ids = [...t.matchAll(/^#\d+=IFC\w+\('([0-9A-Za-z_$]{22})'/gm)].map(m => m[1]);
assert.strictEqual(new Set(ids).size, ids.length, 'unika GlobalId');

// lokala koordinater: första huset börjar i (10, 10), golvet på 1,5 m, höjden 6,2 m
assert.ok(t.includes('IFCCARTESIANPOINT((10.,10.))'), 'lokal x/y');
assert.ok(t.includes('IFCCARTESIANPOINT((0.,0.,1.5))'), 'golv minus Z0');
assert.ok(/IFCEXTRUDEDAREASOLID\(#\d+,#\d+,#\d+,6\.2\)/.test(t), 'höjd');
assert.ok(t.includes("'Hus 1 Sm\\X2\\00E5\\X0\\hus friliggande'"), 'namn med husnummer och ändamål');
assert.ok(/IFCSITE\([^;]*\.ELEMENT\.,\$,\$,100\.,\$,\$\)/.test(t), 'platsens höjd är Z0');

// orienteringen: yttre ringen moturs, hålet medurs (b2 är medurs i indata)
function ringar(text) {
  const rad = {}; for (const l of text.split('\r\n')) { const m = l.match(/^#(\d+)=(.*);$/); if (m) rad[m[1]] = m[2]; }
  const punkt = id => rad[id].match(/\(\(([^)]*)\)\)/)[1].split(',').map(Number);
  const pl = id => rad[id].match(/IFCPOLYLINE\(\((.*)\)\)/)[1].split(',').map(r => punkt(r.slice(1)));
  const yta = p => { let a = 0; for (let i = 0; i + 1 < p.length; i++) a += p[i][0] * p[i + 1][1] - p[i + 1][0] * p[i][1]; return a / 2; };
  const ut = [];
  for (const id in rad) {
    const m = rad[id].match(/^IFCARBITRARYPROFILEDEFWITHVOIDS\(\.AREA\.,\$,#(\d+),\((.*)\)\)$/);
    if (m) ut.push({ yttre: yta(pl(m[1])), inre: m[2].split(',').map(r => yta(pl(r.slice(1)))) });
  }
  return ut;
}
const [gard] = ringar(t);
assert.ok(gard.yttre > 0 && Math.abs(gard.yttre - 900) < 1e-6, 'yttre moturs, 900 m²: ' + gard.yttre);
assert.ok(gard.inre[0] < 0 && Math.abs(gard.inre[0] + 100) < 1e-6, 'hålet medurs, 100 m²');

// samma export igen ger samma id; SWEREF-filen andra id och riktiga koordinater
const igen = Ifc.byggnader(bygg, { dx: X0, dy: Y0, dz: Z0, lokal: true, projekt: 'Testgården', projektId: 'p1' });
const idsIgen = [...igen.text.matchAll(/^#\d+=IFCBUILDINGELEMENTPROXY\('([^']+)'/gm)].map(m => m[1]);
assert.deepStrictEqual(idsIgen, [...t.matchAll(/^#\d+=IFCBUILDINGELEMENTPROXY\('([^']+)'/gm)].map(m => m[1]), 'stabila id');
const sw = Ifc.byggnader(bygg, { lokal: false, projekt: 'Testgården', projektId: 'p1', systemNamn: 'SWEREF 99 TM' });
assert.ok(sw.text.includes('IFCCARTESIANPOINT((539710.,6427610.))'), 'SWEREF x/y');
assert.ok(sw.text.includes('IFCCARTESIANPOINT((0.,0.,101.5))'), 'golv i RH 2000');
assert.ok(!sw.text.includes(idsIgen[0]), 'SWEREF-filen har egna id');

// vridningen följer de lokala DXF-filerna
Terrang.lokal.vrid = 90;
const vr = Ifc.byggnader([bygg[0]], { dx: X0, dy: Y0, dz: Z0, lokal: true, projektId: 'p1' });
const forvantad = Terrang.tillLokal(X0, Y0)(539710, 6427610).map(v => Ifc.tal(v));
assert.ok(vr.text.includes(`IFCCARTESIANPOINT((${forvantad[0]},${forvantad[1]}))`), 'vriden som DXF: ' + forvantad);
Terrang.lokal.vrid = 0;

// inga byggnader med höjd: ingen byggnad i filen
assert.strictEqual(Ifc.byggnader([bygg[2]], {}).antal, 0);

if (process.env.IFC_UT) {
  fs.mkdirSync(process.env.IFC_UT, { recursive: true });
  fs.writeFileSync(path.join(process.env.IFC_UT, 'test_lokal.ifc'), t);
  fs.writeFileSync(path.join(process.env.IFC_UT, 'test_sweref.ifc'), sw.text);
}

// ------------------------------------------------------------------
// Träd vid byggnader
// ------------------------------------------------------------------
const trad = [
  { x: 539716, y: 6427615, hojd: 7 },   // mitt på huset (takkanten eller en skorsten)
  { x: 539722.8, y: 6427615, hojd: 8 }, // 0,8 m utanför fasaden
  { x: 539724, y: 6427615, hojd: 9 },   // 2 m utanför: ett riktigt träd
  { x: 539755, y: 6427655, hojd: 10 },  // mitt på gården: riktigt träd
  { x: 539750.5, y: 6427655, hojd: 10 }, // på gården men 0,5 m från väggen
  { x: 539800, y: 6427700, hojd: 11 },
];
const { kvar, borttagna } = B.tradVidByggnader(trad, bygg, 1);
assert.deepStrictEqual(borttagna.map(t => t.hojd), [7, 8, 10], 'på huset, precis utanför och precis vid gårdsväggen');
assert.deepStrictEqual(kvar.map(t => t.hojd), [9, 10, 11]);
assert.strictEqual(B.tradVidByggnader(trad, null).kvar.length, trad.length, 'utan byggnader blir alla kvar');
assert.strictEqual(B.tradVidByggnader(trad, bygg, 0).borttagna.length, 1, 'marginal 0: bara trädet på taket');
assert.ok(Math.abs(B.avstandTillRing(bygg[0].fotavtryck, 539716, 6427625) - 5) < 1e-9);

console.log('ifc.test.js: allt ok');
