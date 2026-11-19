// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Licensen och länken till källkoden (0.13.2):
 * - js/kalla.js ger rätt adresser med och utan commit, och raden `commit: ''`
 *   som arbetsflödena skriver in commiten på finns kvar,
 * - alla fyra sidor laddar kalla.js och har en länk till källkoden,
 * - LICENSE är AGPL-3.0 och alla egna källfiler har licenshuvudet.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const rot = path.join(__dirname, '..');
const las = f => fs.readFileSync(path.join(rot, f), 'utf8');
const K = require('../js/kalla.js');
const REPO = 'https://github.com/agrellarkitektur/hojdkurvor';

assert.strictEqual(K.KALLA.repo, REPO);
assert.strictEqual(K.url(), REPO, 'utan commit går länken till repot');
assert.strictEqual(K.url('0123abcdef'), `${REPO}/tree/0123abcdef`);
assert.strictEqual(K.url('inte en commit'), REPO);
assert.strictEqual(K.filUrl('LICENSE'), `${REPO}/blob/main/LICENSE`);
assert.strictEqual(K.filUrl('THIRD-PARTY.md', 'a'.repeat(40)), `${REPO}/blob/${'a'.repeat(40)}/THIRD-PARTY.md`);
const kalla = las('js/kalla.js');
assert.strictEqual((kalla.match(/commit: ''/g) || []).length, 1, "js/kalla.js ska ha raden commit: '' exakt en gång");

// Samma ersättning som i publicera-vps.yml och release.yml
const sha = 'f'.repeat(40);
const publicerad = kalla.replace("commit: ''", `commit: '${sha}'`);
const m = { exports: {} };
new Function('module', 'window', 'document', publicerad)(m, undefined, undefined);
assert.strictEqual(m.exports.url(), `${REPO}/tree/${sha}`);
for (const f of ['.github/workflows/publicera-vps.yml', '.github/workflows/release.yml']) {
  assert.ok(las(f).includes(`sed -i "s/commit: ''/commit: '$GITHUB_SHA'/"`), `${f} skriver inte in commiten`);
}

for (const sida of ['index.html', 'om.html', 'instruktioner.html', 'bestall.html']) {
  const t = las(sida);
  assert.ok(/<script src="js\/kalla\.js\?v=[^"]+" defer><\/script>/.test(t), `${sida} laddar inte js/kalla.js`);
  assert.ok(/<a data-kalla [^>]*>Källkoden/.test(t), `${sida} saknar länken Källkoden`);
}
const om = las('om.html');
assert.ok(om.includes('<h2>Stöd utvecklingen</h2>'), 'om.html saknar Stöd utvecklingen');
assert.ok(!/donation/i.test(om), 'om.html säger donation');
assert.ok(/class="swish-qr/.test(om), 'om.html saknar rutan för Swish-QR:n');

assert.ok(/^\s*GNU AFFERO GENERAL PUBLIC LICENSE\s+Version 3, 19 November 2007/.test(las('LICENSE')), 'LICENSE är inte AGPL-3.0');
assert.ok(las('LICENSES/GPL-3.0.txt').startsWith('GNU GENERAL PUBLIC LICENSE'), 'LICENSES/GPL-3.0.txt saknas');

// Licenshuvudet i alla egna källfiler (inte vendor/)
const MONSTER = [['js', /\.js$/], ['.', /^(config\.js|app\.css|.*\.php|.*\.html)$/], ['test', /\.(js|py|html)$/],
  ['test/data', /\.py$/], ['.github/workflows', /\.yml$/]];
let antal = 0;
for (const [kat, re] of MONSTER) {
  for (const f of fs.readdirSync(path.join(rot, kat)).filter(n => re.test(n))) {
    const huvud = las(path.join(kat, f)).split('\n').slice(0, 4).join('\n');
    assert.ok(huvud.includes('SPDX-License-Identifier: AGPL-3.0-or-later'), `${kat}/${f} saknar licenshuvudet`);
    assert.ok(huvud.includes('Copyright (C) 2026 Agrell Arkitektur AB'), `${kat}/${f} saknar copyrightraden`);
    antal++;
  }
}
assert.ok(antal > 60, `bara ${antal} källfiler hittades`);
console.log(`kalla: länkarna, sidorna och licenshuvudet i ${antal} filer stämmer`);
