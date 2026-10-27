/*
 * Kontrollerar att versionen är densamma överallt (0.8.1):
 * - ?v=<version> på alla egna skript och stilmallar i de fyra HTML-sidorna, så att
 *   webbläsaren hämtar nya filer när versionen höjs,
 * - FILVERSION i js/app.js och Vy3D.version i js/vy3d.js, som appen jämför med version.js.
 *
 * Höj versionen i js/version.js och kör sedan
 *   node test/version.test.js --skriv
 * så skrivs den nya versionen in på alla ställen.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const rot = path.join(__dirname, '..');
const las = f => fs.readFileSync(path.join(rot, f), 'utf8');
const m = las('js/version.js').match(/version:\s*'([^']+)'/);
if (!m) { console.error('Hittar ingen version i js/version.js'); process.exit(1); }
const version = m[1];
const skriv = process.argv.includes('--skriv');

const SIDOR = ['index.html', 'om.html', 'instruktioner.html', 'bestall.html'];
// egna filer: relativa sökvägar till .js och .css (inte http:, // eller data:)
const REF = /(\s(?:src|href)=")((?![a-z]+:|\/\/)[^"?#]+\.(?:js|css))(\?v=[^"]*)?(")/g;
const KONSTANTER = [
  ['js/app.js', /(const FILVERSION = ')([^']*)(')/],
  ['js/vy3d.js', /(window\.Vy3D = \{ visa, version: ')([^']*)(')/],
];

let fel = 0, antal = 0;
for (const sida of SIDOR) {
  const text = las(sida);
  const ny = text.replace(REF, (hel, a, fil, v, b) => {
    antal++;
    if (v !== '?v=' + version) {
      if (!skriv) { console.error(`FEL ${sida}: ${fil}${v || ''} saknar ?v=${version}`); fel++; }
    }
    return `${a}${fil}?v=${version}${b}`;
  });
  if (skriv && ny !== text) { fs.writeFileSync(path.join(rot, sida), ny); console.log(`skrev ${sida}`); }
}
for (const [fil, re] of KONSTANTER) {
  const text = las(fil), t = text.match(re);
  if (!t) { console.error(`FEL ${fil}: hittar inte versionskonstanten`); fel++; continue; }
  if (t[2] !== version) {
    if (skriv) { fs.writeFileSync(path.join(rot, fil), text.replace(re, `$1${version}$3`)); console.log(`skrev ${fil}`); }
    else { console.error(`FEL ${fil}: ${t[2]}, version.js säger ${version}`); fel++; }
  }
}
if (antal < 30) { console.error(`FEL: bara ${antal} skript och stilmallar hittades i HTML-sidorna`); fel++; }
if (fel) { console.error(`${fel} fel. Kör: node test/version.test.js --skriv`); process.exit(1); }
console.log(`version ${version}: ${antal} referenser i ${SIDOR.length} sidor och ${KONSTANTER.length} konstanter stämmer`);
