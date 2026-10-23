/*
 * Fastighetsindelning Nedladdning, vektor – fastighetsgränser, gränspunkter och
 * fastighetsbeteckningar ur kommunens GeoPackage, som DXF och lista över de
 * fastigheter som utsnittet berör.
 *
 * Skikt (2025-versionen): registerenhetsomradesyta, registerenhetsomradesgrans,
 * granspunkt. Gränserna i registret är inte rättsligt bindande och kan avvika
 * flera meter; det står i info-filen och i platsanalysen.
 *
 * Kräver Kommunfil, Terrang och Dxf.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Fastighet = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const K = () => (typeof Kommunfil !== 'undefined' ? Kommunfil : globalThis.Kommunfil);
  const D = () => (typeof Dxf !== 'undefined' ? Dxf : globalThis.Dxf);

  const ARYTA = t => /^registerenhetsomradesyta$|^registerenhet_yta$/i.test(t);
  const ARGRANS = t => /^registerenhetsomradesgrans$|^fastighetsgrans$/i.test(t);
  const ARPUNKT = t => /^granspunkt$/i.test(t);
  const FALT = ['objektidentitet', 'registerenhetsreferens', 'objekttyp', 'detaljtyp', 'kommunnamn', 'trakt', 'block', 'blockenhet', 'enhet',
    'omradesnummer', 'omrnr', 'etikett', 'osakertlage', 'lagesosakerhetplan', 'xyfel', 'matmetodplan', 'markeringstyp'];
  /** Gränser med större lägesosäkerhet än så här (m) hamnar på ett eget lager och streckas. */
  const OSAKER = 1;

  const titel = s => String(s || '').toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

  /** Fastighetsbeteckning utan kommun, t.ex. "Vimmerby 3:269" eller "Kisa S:1". */
  function beteckning(a) {
    const trakt = titel(a.trakt);
    if (a.block != null && a.enhet != null) return `${trakt} ${String(a.block).toUpperCase()}:${a.enhet}`.trim();
    if (a.blockenhet) return `${trakt} ${a.blockenhet}`.trim();
    return (a.etikett ? `${trakt} ${a.etikett}` : trakt) || 'Okänd';
  }

  function area(p) {
    let a = 0;
    for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
    return a / 2;
  }
  function inuti(poly, x, y) {
    let inne = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inne = !inne;
    }
    return inne;
  }
  const iYta = (ringar, x, y) => inuti(ringar[0], x, y) && !ringar.slice(1).some(h => inuti(h, x, y));

  /**
   * En punkt inne i ytan att sätta beteckningen på: mitten av det bredaste
   * vågräta snittet genom ytan, prövat på några höjder.
   */
  function ankare(ringar) {
    const ys = ringar[0].map(p => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
    let bast = null;
    for (const f of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
      const y = y0 + (y1 - y0) * f, xs = [];
      for (const ring of ringar) for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const w = xs[i + 1] - xs[i];
        if (!bast || w > bast.w) bast = { w, p: [(xs[i] + xs[i + 1]) / 2, y] };
      }
      if (bast && bast.w > (y1 - y0) * 0.3) break;
    }
    return bast ? bast.p : null;
  }

  /** Gör om GeoPackage-objekt (i zonen) till gränser, punkter och ytor inom utsnittet r. */
  function franObjekt(objekt, r) {
    const ytor = [], granser = [], punkter = [];
    const per = new Map();
    for (const o of objekt) {
      const a = o.attr || {};
      if (o.typ === 'yta' && ARYTA(o.tabell)) {
        const klippta = o.ringar.flatMap(ring => K().klippRing(ring, r, true));
        if (!klippta.length) continue;
        // ytan inom utsnittet: yttre ringen klippt minus klippta hål
        const yttre = K().klippRing(o.ringar[0], r, true);
        if (!yttre.length) continue;
        const hal = o.ringar.slice(1).flatMap(h => K().klippRing(h, r, true));
        const inom = Math.abs(area(yttre[0])) - hal.reduce((s, h) => s + Math.abs(area(h)), 0);
        if (inom < 0.5) continue;
        const bet = beteckning(a);
        const omr = Number(a.omradesnummer || a.omrnr || 1);
        const ringar = [yttre[0], ...hal];
        const typ = String(a.objekttyp || a.detaljtyp || 'fastighetsområde');
        ytor.push({ beteckning: bet, etikett: a.etikett ? String(a.etikett) : bet.split(' ').pop(), typ, omrade: omr, osaker: !!Number(a.osakertlage),
          kommun: titel(a.kommunnamn), ringar, ankare: ankare(ringar), yta: inom, ref: a.registerenhetsreferens || a.objektidentitet || bet });
        const k = a.registerenhetsreferens || bet;
        const f = per.get(k) || { beteckning: bet, kommun: titel(a.kommunnamn), typ, yta: 0, omraden: 0 };
        f.yta += inom; f.omraden++;
        per.set(k, f);
      } else if (o.typ === 'linje' && ARGRANS(o.tabell)) {
        const fel = Number(a.lagesosakerhetplan != null ? a.lagesosakerhetplan : a.xyfel);
        const typ = String(a.objekttyp || a.detaljtyp || 'fastighetsgräns');
        for (const pts of K().klippLinje(o.ringar[0], r))
          granser.push({ typ, osakerhet: isFinite(fel) && fel > 0 ? fel : null, metod: a.matmetodplan != null ? String(a.matmetodplan) : null, pts });
      } else if (o.typ === 'punkt' && ARPUNKT(o.tabell)) {
        const [x, y] = o.ringar[0][0];
        if (x < r.xmin || x > r.xmax || y < r.ymin || y > r.ymax) continue;
        const fel = Number(a.lagesosakerhetplan != null ? a.lagesosakerhetplan : a.xyfel);
        punkter.push({ x, y, typ: String(a.objekttyp || a.detaljtyp || 'gränspunkt'), markering: a.markeringstyp ? String(a.markeringstyp) : null,
          etikett: a.etikett ? String(a.etikett) : null, osakerhet: isFinite(fel) && fel > 0 ? fel : null });
      }
    }
    const fastigheter = [...per.values()].sort((a, b) => b.yta - a.yta);
    return { ytor, granser, punkter, fastigheter };
  }

  /**
   * Hämtar fastighetsindelningen kring utsnittet.
   * opt: { kommuner, utsnitt, epsg, auth, logg, framsteg, bekrafta }
   */
  async function hamta(opt) {
    const tabell = t => ARYTA(t) || ARGRANS(t) || ARPUNKT(t);
    const res = await K().lasUtsnitt(Object.assign({ produkt: 'fastighet', tabell, falt: FALT }, opt));
    if (!res.tabeller.some(t => ARYTA(t.namn) || ARGRANS(t.namn)))
      throw new Error(`hittade inga fastighetsgränser i filen (skikt: ${res.tabeller.map(t => t.namn).join(', ') || 'inga'}).`);
    return franObjekt(res.objekt, opt.utsnitt);
  }

  /** DXF-lager för en gräns, t.ex. GRANS_FASTIGHETSGRANS eller GRANS_FASTIGHETSGRANS_OSAKER. */
  function lagerFor(g) {
    return 'GRANS_' + D().lagernamn(g.typ) + (g.osakerhet != null && g.osakerhet > OSAKER ? '_OSAKER' : '');
  }
  const ACI = { GRANS_FASTIGHETSGRANS: 6, GRANS_FASTIGHETSSTRAND: 4, GRANS_TRAKTGRANS: 1, GRANS_KVARTERSTRAKTGRANS: 1, GRANS_KOMMUNGRANS: 1, GRANS_LANSGRANS: 1 };

  /** DXF: gränser per typ (osäkra på eget lager), gränspunkter och beteckningar. */
  function dxf(f, r, dx, dy) {
    const lager = { FASTIGHET_BETECKNING: 6, GRANSPUNKT: 6, UTSNITT: 3 }, o = [];
    for (const g of f.granser) {
      const l = lagerFor(g);
      lager[l] = ACI[l.replace(/_OSAKER$/, '')] || 6;
      o.push({ typ: 'pl', lager: l, sluten: false, pts: g.pts });
    }
    for (const p of f.punkter) o.push({ typ: 'punkt', lager: 'GRANSPUNKT', x: p.x, y: p.y });
    for (const y of f.ytor) {
      if (!y.ankare) continue;
      const h = Math.max(1, Math.min(4, Math.sqrt(y.yta) / 12));
      o.push({ typ: 'text', lager: 'FASTIGHET_BETECKNING', x: y.ankare[0], y: y.ankare[1], h, text: y.etikett });
    }
    o.push({ typ: 'pl', lager: 'UTSNITT', sluten: true, pts: [[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax]] });
    return D().skriv(lager, o, { dx, dy, ext: r });
  }

  /** Antal gränslinjer per lager, för info-filen. */
  function perLager(f) {
    const ut = {};
    f.granser.forEach(g => { const l = lagerFor(g); ut[l] = (ut[l] || 0) + 1; });
    return ut;
  }

  const VARNING = 'Gränserna i fastighetsregistrets karta är inte rättsligt bindande. De kan avvika flera meter från gränsernas verkliga läge, ' +
    'särskilt där de är digitaliserade från äldre kartor. Det som gäller är förrättningskartor och lantmäteriförrättningar. ' +
    'Beställ en gränsutvisning eller en fastighetsbestämning av Lantmäteriet när gränsens läge har betydelse.';

  return { hamta, franObjekt, dxf, perLager, lagerFor, beteckning, ankare, iYta, VARNING, OSAKER, FALT };
}));
