/*
 * Marktäcke Nedladdning, vektor – klipper ut utsnittet ur kommunens GeoPackage och
 * skriver DXF med ett lager per marktäckesklass.
 *
 * Hämtning och GeoPackage-läsning i kommunfil.js. Kräver Kommunfil, Terrang och Dxf.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Marktacke = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const K = () => (typeof Kommunfil !== 'undefined' ? Kommunfil : globalThis.Kommunfil);
  const URL_MALL = kod => K().PRODUKTER.marktacke.url(kod);
  const KLASSFALT = [/^objekttyp$/i, /objekttyp/i, /^kategori/i, /^klass/i, /typ$/i, /typ/i];

  /** Klassen ur ett objekts textattribut (samma val som tidigare: objekttyp i första hand). */
  function klassFor(o) {
    const namn = Object.keys(o.attr || {});
    let k = null;
    for (const re of KLASSFALT) { k = namn.find(n => re.test(n)); if (k) break; }
    if (!k) k = namn.find(n => !/id$|identitet/i.test(n)) || null;
    return k && o.attr[k] != null ? String(o.attr[k]) : o.tabell;
  }

  // ------------------------------------------------------------------
  // Klasser och färger
  // ------------------------------------------------------------------
  function farg(klass) {
    const k = klass.toLowerCase();
    if (/sjö|vatten|hav|vattendrag/.test(k)) return { aci: 5, css: '#3a78c8' };
    if (/barr|bland|skog|löv/.test(k)) return { aci: 3, css: '#3f8f3a' };
    if (/åker|odling|fruktodling|gård/.test(k)) return { aci: 2, css: '#d9b93a' };
    if (/bebyggelse|industri|handel|tätort/.test(k)) return { aci: 1, css: '#c0504d' };
    if (/öppen|kalfjäll|mark|gräs|golf|idrott/.test(k)) return { aci: 31, css: '#c9a26b' };
    if (/myr|sank|våtmark|torv/.test(k)) return { aci: 4, css: '#5fa9a0' };
    if (/väg|järnväg|bana|flyg/.test(k)) return { aci: 8, css: '#7f7f7f' };
    return { aci: 7, css: '#888888' };
  }

  // ------------------------------------------------------------------
  // Hela kedjan
  // ------------------------------------------------------------------
  /**
   * opt: { kommuner: ['0513', …], utsnitt, epsg, auth, logg, framsteg, bekrafta }
   * Returnerar { ytor: [{klass, ringar (i zonen)}], linjer: [...], klasser: {namn: antal} }
   */
  async function hamtaUtsnitt(opt) {
    const r = opt.utsnitt;
    const { objekt } = await K().lasUtsnitt(Object.assign({ produkt: 'marktacke' }, opt));
    const ytor = [], linjer = [], klasser = {};
    for (const o of objekt) {
      const klass = klassFor(o);
      if (o.typ === 'yta') {
        const klippta = o.ringar.flatMap(ring => K().klippRing(ring, r, true));
        if (!klippta.length) continue;
        ytor.push({ klass, ringar: klippta });
        klasser[klass] = (klasser[klass] || 0) + 1;
      } else if (o.typ === 'linje') {
        const delar = o.ringar.flatMap(l => K().klippLinje(l, r));
        delar.forEach(d => linjer.push({ klass, pts: d }));
        if (delar.length) klasser[klass] = (klasser[klass] || 0) + delar.length;
      }
    }
    return { ytor, linjer, klasser };
  }

  /** DXF-lagernamn per marktäckesklass, högst 31 tecken (DXF R12). */
  function lagerNamn(klasser) {
    const lista = [...new Set(klasser)].sort();
    const fulla = lista.map(k => 'MARKTACKE_' + Dxf.lagernamn(k));
    const kort = Dxf.kortaNamn(fulla.concat('UTSNITT'));
    return Object.fromEntries(lista.map((k, i) => [k, kort[fulla[i]]]));
  }

  function dxf(res, r, dx, dy) {
    const lager = {}, objekt = [];
    const namn = lagerNamn(res.ytor.map(y => y.klass).concat(res.linjer.map(l => l.klass)));
    const lagerFor = klass => { const n = namn[klass]; lager[n] = farg(klass).aci; return n; };
    for (const y of res.ytor) { const l = lagerFor(y.klass); y.ringar.forEach(ring => objekt.push({ typ: 'pl', lager: l, pts: ring, sluten: true })); }
    for (const li of res.linjer) objekt.push({ typ: 'pl', lager: lagerFor(li.klass), pts: li.pts, sluten: false });
    lager.UTSNITT = 3;
    objekt.push({ typ: 'pl', lager: 'UTSNITT', pts: [[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax]], sluten: true });
    return Dxf.skriv(lager, objekt, { dx, dy, ext: r });
  }

  return { hamtaUtsnitt, dxf, lagerNamn, farg, klassFor, URL_MALL };
}));
