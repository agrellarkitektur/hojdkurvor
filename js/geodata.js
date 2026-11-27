// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Agrell Arkitektur AB
/*
 * Öppna geodata från andra myndigheter till platsanalysen.
 *
 * - Skyddad natur: Naturvårdsverket, Naturvårdsregistret och Natura 2000 (WFS, CC0)
 * - Fornlämningar och andra lämningar: Riksantikvarieämbetet, Kulturmiljöregistret (WMS)
 * - Översvämning: Myndigheten för civilt försvar (f.d. MSB), översvämningskarteringar (WMS)
 * - Vatten för strandskyddsindikation: OpenStreetMap via Overpass
 * - Skyddad natur som reserv när Naturvårdsverket inte svarar: OpenStreetMap via Overpass (0.14.4)
 *
 * Varje anrop görs först direkt från webbläsaren. Spärras det (CORS) går det via
 * geodata.php på webbhotellet, som bara släpper igenom adresserna i VITLISTA.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Geodata = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TJANSTER = {
    naturWfs: 'https://geodata.naturvardsverket.se/naturvardsregistret/wfs',
    natura2000Wfs: 'https://geodata.naturvardsverket.se/n2000/wfs',
    naturWms: 'https://geodata.naturvardsverket.se/naturvardsregistret/wms',
    lamningarWms: 'https://pub.raa.se/visning/lamningar_v1/wms',
    oversvamningWms: 'https://gis-tjanster.mcf.se/arcgis/services/Oversvamningskarteringar/karteringar/MapServer/WmsServer',
    overpass: 'https://overpass-api.de/api/interpreter',
    // Reserv när huvudservern inte svarar efter tre försök (0.16.1, BG)
    overpassReserv: 'https://overpass.kumi.systems/api/interpreter',
  };
  /** Lager i Kulturmiljöregistret som räknas, från mest till minst skyddat. */
  const LAMNINGAR = [
    { lager: 'fornlamning', namn: 'Fornlämning' },
    { lager: 'mojligfornlamning', namn: 'Möjlig fornlämning' },
    { lager: 'ovrkulthistlamning', namn: 'Övrig kulturhistorisk lämning' },
  ];
  /** Översvämningskarteringar: lagernummer i tjänsten. */
  const OVERSVAMNING = [
    { lager: '13', namn: '100-årsflöde' },
    { lager: '12', namn: '100-årsflöde, klimatanpassat (slutet av seklet)' },
    { lager: '9', namn: 'Beräknat högsta flöde' },
  ];

  const konf = () => (typeof self !== 'undefined' && self.TERRANG_KONFIG) || {};
  const proxyUrl = () => (typeof self !== 'undefined' && self.TERRANG_GEODATA_PROXY) || (konf().geodataProxy !== undefined ? konf().geodataProxy : 'geodata.php');
  /** Testkrok: byt ut tjänsternas adresser. */
  const adress = nyckel => ((typeof self !== 'undefined' && self.TERRANG_GEODATA) || {})[nyckel] || TJANSTER[nyckel];

  /** Svar som brukar gå över av sig själva: överbelastad eller tillfälligt otillgänglig tjänst. */
  const TILLFALLIGT = [429, 502, 503, 504];
  /** Pauser före nya försök (ms). Testkrok: TERRANG_PAUSER. */
  const pauser = () => (typeof self !== 'undefined' && self.TERRANG_PAUSER) || [2000, 5000];
  /**
   * Kör fn och försöker igen efter en paus när tjänsten svarar med ett tillfälligt fel
   * (felet har då `status`). Andra fel kastas direkt. Efter sista försöket står antalet i felet.
   */
  async function medOmforsok(fn, vanta = pauser()) {
    for (let i = 0; ; i++) {
      try { return await fn(); } catch (e) {
        if (!e || !(TILLFALLIGT.includes(e.status) || e.tidsgrans)) throw e;
        if (i >= vanta.length) { if (i) e.message += ` (${i + 1} försök)`; throw e; }
        await new Promise(r => setTimeout(r, vanta[i]));
      }
    }
  }

  /**
   * Hämtar en adress direkt, och via proxyn om webbläsaren spärrar. typ: 'json' | 'text' | 'blob'.
   * Svarar tjänsten 429, 502, 503 eller 504 görs två nya försök med några sekunders paus (0.13.4).
   * Svarar den inte inom `tid` ms räknas det likadant (0.13.5; förut kom felet "signal is aborted without reason").
   * Ett sådant fel prövas inte via proxyn (meddelandet börjar med "svarade").
   */
  async function hamta(url, typ = 'json', { tid = 25000, metod = 'GET', kropp = null } = {}) {
    const forsok = u => medOmforsok(async () => {
      const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), tid);
      try {
        let svar;
        try {
          svar = await fetch(u, { signal: ctrl.signal, method: metod, body: kropp, headers: kropp ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined });
        } catch (e) {
          if (ctrl.signal.aborted) throw Object.assign(new Error(`svarade inte inom ${Math.round(tid / 1000)} s`), { tidsgrans: true });
          throw e;
        }
        if (!svar.ok) throw Object.assign(new Error(`svarade ${svar.status}`), { status: svar.status });
        if (typ !== 'json') return typ === 'blob' ? await svar.blob() : await svar.text();
        const text = await svar.text();
        try { return JSON.parse(text); } catch (e) {
          // WFS/WMS svarar ofta 200 med ett XML-fel (ServiceException) när tjänsten har problem (0.12.1)
          const fel = /<(?:\w+:)?(?:ExceptionText|ServiceException)[^>]*>\s*(?:<!\[CDATA\[)?([^<\]]{1,200})/.exec(text);   // texten står ofta i CDATA
          if (/^\s*</.test(text)) throw new Error('svarade med ett fel i stället för data' + (fel ? `: ${fel[1].trim()}` : '') + '. Försök igen senare.');
          throw e;
        }
      } finally { clearTimeout(t); }
    });
    try {
      return await forsok(url);
    } catch (e) {
      const p = proxyUrl();
      if (!p || metod !== 'GET' || (e && e.message && e.message.startsWith('svarade'))) throw e;
      // Felet säger att frågan gick via servern, så att det går att se var det stoppade (0.14.4)
      try { return await forsok(`${p}?u=${encodeURIComponent(url)}`); } catch (e2) {
        if (e2 && e2.message && !/via servern/.test(e2.message)) e2.message += ' via servern';
        throw e2;
      }
    }
  }
  /**
   * Overpass-fråga (POST) mot huvudservern och, om den fortfarande svarar med ett tillfälligt fel
   * eller inte svarar alls efter tre försök, mot reservservern (0.16.1, BG). Felet från huvudservern
   * står kvar om också reserven faller.
   */
  async function overpass(q, tid = 40000) {
    const kropp = 'data=' + encodeURIComponent(q);
    try { return await hamta(adress('overpass'), 'json', { metod: 'POST', kropp, tid }); } catch (e) {
      const reserv = adress('overpassReserv');
      if (!reserv || reserv === adress('overpass') || !(TILLFALLIGT.includes(e.status) || e.tidsgrans || e instanceof TypeError)) throw e;
      try { return await hamta(reserv, 'json', { metod: 'POST', kropp, tid }); } catch (e2) {
        e.message += `; reservservern ${e2 && e2.message ? e2.message : 'svarade inte'}`;
        throw e;
      }
    }
  }
  /**
   * Linjerna i en geometri ur `out geom(ruta)`: noder utanför rutan kommer som null, så linjen
   * delas där (0.16.1). En linje räknas som sluten bara när hela ringen kom med.
   */
  function osmDelar(g) {
    if (!g) return [];
    const delar = []; let del = [];
    for (const p of g) {
      if (p && p.lat != null) del.push(p);
      else { if (del.length >= 2) delar.push(del); del = []; }
    }
    if (del.length >= 2) delar.push(del);
    const hel = delar.length === 1 && delar[0].length === g.length;
    return delar.map(d => ({ pts: d, sluten: hel && d[0].lat === d[d.length - 1].lat && d[0].lon === d[d.length - 1].lon }));
  }
  const bboxText = b => [b.xmin, b.ymin, b.xmax, b.ymax].map(v => Math.round(v)).join(',');
  /** Rutan med nordvärdet först, som WFS 2.0 vill ha den för EPSG:3006 (axelordning N, E). */
  const bboxNordOst = b => [b.ymin, b.xmin, b.ymax, b.xmax].map(v => Math.round(v)).join(',');
  const qs = o => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

  /** Första egenskapen som finns, utan hänsyn till skiftläge. */
  function egenskap(p, namn) {
    if (!p) return '';
    const nycklar = Object.keys(p);
    for (const n of namn) {
      const k = nycklar.find(x => x.toLowerCase() === n.toLowerCase());
      if (k && p[k] != null && p[k] !== '') return String(p[k]);
    }
    return '';
  }

  /**
   * GeoJSON-ringar (i TM) → [[x,y],...] i zonen. Koordinaterna ska vara [E, N]; kommer de
   * som [N, E] (nordvärdet är alltid över 6 miljoner, östvärdet under 1) vänds de.
   */
  function ringar(geom, tillZon) {
    if (!geom) return [];
    const t = c => tillZon(c[0] > 5e6 && c[1] < 5e6 ? [c[1], c[0]] : [c[0], c[1]]);
    if (geom.type === 'Polygon') return geom.coordinates.map(r => r.map(t));
    if (geom.type === 'MultiPolygon') return geom.coordinates.flatMap(p => p.map(r => r.map(t)));
    return [];
  }

  /**
   * Klipper ringar mot en ruta { xmin, ymin, xmax, ymax } (Sutherland–Hodgman, ring för ring) (0.16.4, DE).
   * Ett stort skyddat område (Natura 2000 i Vättern) kom förut med hela sin kustlinje, och kartan, planvyn och
   * situationsplanen blev sega. Ringar som hamnar helt utanför försvinner.
   */
  function klippRingar(rs, b) {
    const ut = [];
    for (const r of rs || []) {
      if (!r || r.length < 3) continue;
      let p = r;
      for (const [inne, skar] of [
        [q => q[0] >= b.xmin, (a, c) => [b.xmin, a[1] + (c[1] - a[1]) * (b.xmin - a[0]) / (c[0] - a[0])]],
        [q => q[0] <= b.xmax, (a, c) => [b.xmax, a[1] + (c[1] - a[1]) * (b.xmax - a[0]) / (c[0] - a[0])]],
        [q => q[1] >= b.ymin, (a, c) => [a[0] + (c[0] - a[0]) * (b.ymin - a[1]) / (c[1] - a[1]), b.ymin]],
        [q => q[1] <= b.ymax, (a, c) => [a[0] + (c[0] - a[0]) * (b.ymax - a[1]) / (c[1] - a[1]), b.ymax]],
      ]) {
        if (!p.length) break;
        const ny = [];
        for (let i = 0; i < p.length; i++) {
          const a = p[i], c = p[(i + 1) % p.length], ia = inne(a), ic = inne(c);
          if (ia) ny.push(a);
          if (ia !== ic) ny.push(skar(a, c));
        }
        p = ny;
      }
      if (p.length >= 3) ut.push(p);
    }
    return ut;
  }

  /** Natura 2000-områdets typ (SPA, SCI, SAC) som direktiv i klartext. */
  function natura2000Typ(t) {
    const d = [/SPA/i.test(t) && 'fågeldirektivet', /SCI|SAC/i.test(t) && 'art- och habitatdirektivet'].filter(Boolean);
    return 'Natura 2000' + (d.length ? ', ' + d.join(' och ') : '');
  }

  /**
   * Adress till en WFS-fråga om objekt som berör rutan bTM (SWEREF 99 TM).
   * Naturvårdsverkets tjänster (ArcGIS) vill ha outputFormat=GEOJSON, inte application/json,
   * som de svarar på med ett XML-fel, och rutan med nordvärdet först: med östvärdet först blir
   * svaret tomt utan fel. Svarets koordinater är ändå [E, N]. Kontrollerat mot tjänsterna
   * 19 november 2026.
   */
  function wfsUrl(url, typ, bTM) {
    return `${url}?${qs({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: typ, outputFormat: 'GEOJSON', srsName: 'EPSG:3006', bbox: bboxNordOst(bTM) + ',EPSG:3006', count: 200 })}`;
  }

  /**
   * Skyddade områden (naturreservat, nationalpark, biotopskydd m.fl.) och Natura 2000 som
   * berör rutan bTM (SWEREF 99 TM). tillZon: [E, N] → zonens [x, y].
   * Svarar bara den ena tjänsten kommer dess områden med, och `ut.saknas` säger vilken som föll bort.
   * Med llRuta (WGS 84: syd, vast, nord, ost) och llTillZon ([lon, lat] → zonen) fylls listan på
   * ur OpenStreetMap när Naturvårdsverket inte svarar; `ut.reserv` säger då hur många som kom därifrån.
   */
  async function skyddadNatur(bTM, tillZon, llRuta = null, llTillZon = null) {
    const fraga = (nyckel, typ) => hamta(wfsUrl(adress(nyckel), typ, bTM));
    const [nat, n2k] = await Promise.allSettled([
      fraga('naturWfs', 'Naturvardsregistret_WFS:SkyddadeOmraden'),
      fraga('natura2000Wfs', 'N2000_WFS:N2000'),
    ]);
    const ut = [];
    if (nat.status === 'fulfilled') (nat.value.features || []).forEach(f => {
      const status = egenskap(f.properties, ['BESLUTSSTATUS']);
      ut.push({
        typ: (egenskap(f.properties, ['SKYDDSTYP', 'skyddsform', 'Skyddsform', 'TYP']) || 'Skyddat område') + (status && !/^gällande$/i.test(status) ? ` (${status.toLowerCase()})` : ''),
        namn: egenskap(f.properties, ['NAMN', 'namn', 'Name', 'OMRADESNAMN']),
        id: egenskap(f.properties, ['NVRID', 'nvrid', 'OBJECTID', 'id']) || f.id || '',
        ringar: ringar(f.geometry, tillZon),
      });
    });
    if (n2k.status === 'fulfilled') (n2k.value.features || []).forEach(f => ut.push({
      typ: natura2000Typ(egenskap(f.properties, ['OMRADESTYP', 'DIREKTIV'])),
      namn: egenskap(f.properties, ['OMRADESNAMN', 'NAMN', 'SITENAME']),
      id: egenskap(f.properties, ['OMRADESKOD', 'SITECODE']) || f.id || '',
      ringar: ringar(f.geometry, tillZon),
    }));
    const fel = [nat.status === 'rejected' && ['Naturvårdsregistret', nat.reason], n2k.status === 'rejected' && ['Natura 2000', n2k.reason]].filter(Boolean);
    const felText = fel.map(([n, e]) => `${n} ${(e && e.message) || 'svarade inte'}`).join('; ');
    // Svarar inte Naturvårdsverket fylls listan på ur OpenStreetMap (0.14.4), om rutan i WGS 84 finns med
    if (fel.length && llRuta && llTillZon) {
      try {
        const osm = await skyddadNaturOsm(llRuta, llTillZon);
        const kanda = new Set(ut.map(o => o.namn.toLowerCase()).filter(Boolean));
        const nya = osm.filter(o => !o.namn || !kanda.has(o.namn.toLowerCase()));
        ut.push(...nya);
        ut.reserv = { antal: nya.length, fel: felText };
        if (fel.length === 2) { ut.saknas = felText; ut.helaReserv = true; return ut; }
      } catch (e) { /* OpenStreetMap svarade inte heller: som förut */ }
    }
    if (fel.length === 2) throw nat.reason;
    // en av två: det som kom är med, men svaret är inte fullständigt
    if (fel.length) ut.saknas = felText;
    return ut;
  }

  /**
   * Fogar ihop linjer (OSM-vägar ur en relation) till ringar där ändpunkterna möts.
   * Linjer som inte går att sluta kommer med som de är.
   */
  function fogaRingar(linjer) {
    const kvar = linjer.filter(l => l && l.length >= 2).map(l => l.slice());
    const lika = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
    const ut = [];
    while (kvar.length) {
      let ring = kvar.shift();
      let vaxte = true;
      while (!lika(ring[0], ring[ring.length - 1]) && vaxte) {
        vaxte = false;
        for (let i = 0; i < kvar.length; i++) {
          const l = kvar[i], slut = ring[ring.length - 1];
          if (lika(l[0], slut)) ring = ring.concat(l.slice(1));
          else if (lika(l[l.length - 1], slut)) ring = ring.concat(l.slice(0, -1).reverse());
          else continue;
          kvar.splice(i, 1); vaxte = true; break;
        }
      }
      ut.push(ring);
    }
    return ut;
  }

  /** Skyddsform i klartext ur OSM-taggarna. */
  function osmSkyddstyp(t) {
    if (t.boundary === 'national_park') return 'Nationalpark';
    if (t.protection_title) return t.protection_title.charAt(0).toUpperCase() + t.protection_title.slice(1);
    if (t.leisure === 'nature_reserve') return 'Naturreservat';
    return 'Skyddat område';
  }

  /**
   * Skyddade områden ur OpenStreetMap (naturreservat, nationalparker, protected_area) inom en
   * WGS 84-ruta. Reserv när Naturvårdsverket inte svarar (0.14.4). Ger samma form som
   * skyddadNatur, med `kalla: 'osm'`. Vattenskyddsområden och liknande (protect_class 12, 14 …) tas inte med.
   */
  async function skyddadNaturOsm(llRuta, tillZon) {
    const bb = `${llRuta.syd},${llRuta.vast},${llRuta.nord},${llRuta.ost}`;
    const q = `[out:json][timeout:35];(nwr["leisure"="nature_reserve"](${bb});nwr["boundary"~"^(protected_area|national_park)$"](${bb}););out geom;`;
    const svar = await overpass(q);
    const ut = [];
    for (const e of (svar.elements || [])) {
      const t = e.tags || {};
      if (e.type === 'node') continue;
      const klass = parseInt(t.protect_class, 10);
      if (t.boundary === 'protected_area' && t.leisure !== 'nature_reserve' && !(klass >= 1 && klass <= 7) && !t.protection_title) continue;
      const linjer = e.type === 'way' ? [e.geometry] : (e.members || []).filter(m => m.geometry && m.role !== 'inner').map(m => m.geometry);
      const ringarna = fogaRingar(linjer.filter(Boolean).map(g => g.map(p => [p.lon, p.lat]))).filter(r => r.length >= 3).map(r => r.map(tillZon));
      if (!ringarna.length) continue;
      ut.push({ typ: osmSkyddstyp(t), namn: t.name || '', id: `osm ${e.type}/${e.id}`, ringar: ringarna, kalla: 'osm' });
    }
    return ut;
  }

  /**
   * Lämningar ur Kulturmiljöregistret inom rutan, via WMS GetFeatureInfo med en sökradie
   * som täcker hela rutan. Returnerar [{ klass, namn, id, typ, x, y }].
   */
  async function lamningar(bTM, tillZon) {
    const N = 101;
    const svar = await hamta(`${adress('lamningarWms')}?${qs({
      service: 'WMS', version: '1.1.1', request: 'GetFeatureInfo', layers: LAMNINGAR.map(l => l.lager).join(','),
      query_layers: LAMNINGAR.map(l => l.lager).join(','), styles: '', srs: 'EPSG:3006', bbox: bboxText(bTM),
      width: N, height: N, x: 50, y: 50, info_format: 'application/json', feature_count: 200, buffer: 75,
    })}`);
    const ut = [];
    for (const f of (svar.features || [])) {
      const lagerId = String(f.id || '').split('.')[0];
      const klass = LAMNINGAR.find(l => lagerId.toLowerCase().includes(l.lager)) || LAMNINGAR.find(l => JSON.stringify(f.properties || {}).toLowerCase().includes(l.namn.toLowerCase()));
      let x = null, y = null;
      const g = f.geometry;
      if (g) {
        const c = g.type === 'Point' ? g.coordinates : g.type === 'MultiPoint' ? g.coordinates[0] : g.type === 'Polygon' ? g.coordinates[0][0] : g.type === 'MultiPolygon' ? g.coordinates[0][0][0] : g.type === 'LineString' ? g.coordinates[0] : null;
        if (c) [x, y] = tillZon([c[0], c[1]]);
      }
      ut.push({
        klass: klass ? klass.namn : 'Lämning',
        namn: egenskap(f.properties, ['lamningstyp', 'lämningstyp', 'typ', 'namn', 'benamning']),
        id: egenskap(f.properties, ['lamningsnummer', 'lämningsnummer', 'raa_nummer', 'raanummer', 'fornsok_id', 'id']) || String(f.id || ''),
        x, y,
      });
    }
    return ut;
  }

  /** Adress till en WMS-bild över rutan bTM (SWEREF 99 TM). */
  function wmsBildUrl(tjanst, lager, bTM, W, H) {
    return `${adress(tjanst)}?${qs({ service: 'WMS', version: '1.1.1', request: 'GetMap', layers: lager, styles: '', srs: 'EPSG:3006', bbox: bboxText(bTM), width: W, height: H, format: 'image/png', transparent: 'true' })}`;
  }
  async function wmsCanvas(tjanst, lager, bTM, W, H) {
    const blob = await hamta(wmsBildUrl(tjanst, lager, bTM, W, H), 'blob');
    const bild = await createImageBitmap(blob);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.getContext('2d').drawImage(bild, 0, 0, W, H);
    return c;
  }
  /** Andel synliga pixlar i en WMS-bild (alfa > 20). */
  function tackning(c) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
    return n / (c.width * c.height);
  }
  /**
   * Översvämningskarteringar: hur stor del av rutan som ligger inom varje karterat flöde.
   * Returnerar [{ namn, andel, bild }] (bild = canvas över rutan, för karta och PDF).
   */
  async function oversvamning(bTM) {
    const W = 256, H = Math.max(16, Math.round(256 * (bTM.ymax - bTM.ymin) / (bTM.xmax - bTM.xmin)));
    const ut = [];
    for (const o of OVERSVAMNING) {
      const c = await wmsCanvas('oversvamningWms', o.lager, bTM, W, H);
      ut.push({ namn: o.namn, lager: o.lager, andel: tackning(c), bild: c });
    }
    return ut;
  }

  /** Anlagt vatten i OSM (water=…): strandskydd bara om det fanns före juli 1975. */
  const ANLAGT = /^(basin|wastewater|reservoir_covered)$/;
  /**
   * Sjöar, vattendrag och hav från OpenStreetMap inom rutan (WGS 84-ruta).
   * Ger [{ typ, namn, yta, sluten, pts (zon) }]; typ är sjö, vattendrag, bäck, kanal, kust eller anlagt.
   * Overpass får 40 s (0.13.5) och försöks igen vid överbelastning och tidsgräns.
   */
  async function vatten(llRuta, tillZon) {
    const bb = `${llRuta.syd},${llRuta.vast},${llRuta.nord},${llRuta.ost}`;
    // Geometrin klipps mot rutan (out geom(ruta), 0.16.1): stora sjöar som Vättern gav annars så
    // stora svar att Overpass svarade 502/504 (BG).
    const q = `[out:json][timeout:35];(way["natural"="water"](${bb});relation["natural"="water"](${bb});way["waterway"~"^(river|stream|canal)$"](${bb});way["natural"="coastline"](${bb}););out geom(${bb});`;
    const svar = await overpass(q);
    const ut = [];
    for (const e of (svar.elements || [])) {
      const t = e.tags || {};
      const typ = t.natural === 'coastline' ? 'kust' : t.waterway ? (t.waterway === 'stream' ? 'bäck' : t.waterway === 'canal' ? 'kanal' : 'vattendrag')
        : t.water === 'river' ? 'vattendrag' : ANLAGT.test(t.water || '') ? 'anlagt' : 'sjö';
      const linjer = e.type === 'way' ? [e.geometry] : (e.members || []).filter(m => m.geometry).map(m => m.geometry);
      if (e.type === 'way') {
        // en klippt bit av en sjö är en strand med vatten på ena sidan (yta, inte sluten; 0.16.5, DX)
        for (const d of osmDelar(e.geometry)) ut.push({ typ, namn: t.name || '', yta: t.natural === 'water', sluten: d.sluten, pts: d.pts.map(p => tillZon([p.lon, p.lat])) });
        continue;
      }
      // En relation: vägarna fogas till ringar (0.16.3, B6). Det som inte går ihop (klippt mot rutan) är en
      // strandlinje, inte en yta som går tillbaka till sin första punkt.
      const delar = linjer.flatMap(g => osmDelar(g)), lika = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
      const hela = delar.filter(d => d.sluten).map(d => d.pts.map(p => [p.lon, p.lat]));
      const fogade = fogaRingar(delar.filter(d => !d.sluten).map(d => d.pts.map(p => [p.lon, p.lat])));
      for (const r of hela.concat(fogade)) {
        const sluten = r.length >= 4 && lika(r[0], r[r.length - 1]);
        ut.push({ typ, namn: t.name || '', yta: true, sluten, pts: (sluten ? r.slice(0, -1) : r).map(p => tillZon(p)) });
      }
    }
    return ut;
  }

  const KALLOR = {
    natur: 'Skyddad natur: Naturvårdsverket, Naturvårdsregistret och Natura 2000 (CC0).',
    lamningar: 'Lämningar: Riksantikvarieämbetet, Kulturmiljöregistret.',
    oversvamning: 'Översvämning: Myndigheten för civilt försvar, översvämningskarteringar.',
    vatten: 'Vatten: © OpenStreetMap-bidragsgivare (ODbL).',
    naturOsm: 'Skyddad natur (reserv): © OpenStreetMap-bidragsgivare (ODbL).',
  };

  return { TJANSTER, LAMNINGAR, OVERSVAMNING, KALLOR, TILLFALLIGT, hamta, medOmforsok, overpass, osmDelar, wfsUrl, natura2000Typ, ringar, klippRingar, skyddadNatur, skyddadNaturOsm, fogaRingar, lamningar, oversvamning, vatten, wmsBildUrl, wmsCanvas, tackning, egenskap };
}));
