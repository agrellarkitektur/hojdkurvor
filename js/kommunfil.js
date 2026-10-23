/*
 * Kommunfiler från Lantmäteriets nedladdning (STAC-vektor): en zip med en
 * GeoPackage per kommun och produkt. Gemensamt för marktäcke, byggnader och
 * fastighetsindelning: hämtning med inloggning, lagring i webbläsaren
 * (IndexedDB), läsning av GeoPackage och klippning mot utsnittet.
 *
 * Adresserna följer katalogen, t.ex.
 *   https://dl1.lantmateriet.se/byggnadsverk/byggnad_kn0884.zip
 *
 * Kräver JSZip, sql.js (initSqlJs), proj4 och Terrang.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Kommunfil = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const T = () => (typeof Terrang !== 'undefined' ? Terrang : globalThis.Terrang);
  const KONF = () => (typeof self !== 'undefined' && self.TERRANG_KONFIG) || {};
  const MAX_ALDER = 30 * 864e5;
  const DL = 'https://dl1.lantmateriet.se';

  /** Produkterna. nyckel används i lagringen ("nyckel:kommunkod"). */
  const PRODUKTER = {
    marktacke: {
      namn: 'Marktäcke', bestamd: 'marktäcket', bestallning: 'Marktäcke Nedladdning, vektor',
      url: kod => `${DL}/mark/marktacke/marktacke_kn${kod}.zip`,
    },
    byggnad: {
      namn: 'Byggnader', bestamd: 'byggnaderna', bestallning: 'Byggnad Nedladdning, vektor',
      url: kod => `${DL}/byggnadsverk/byggnad_kn${kod}.zip`,
    },
    fastighet: {
      namn: 'Fastighetsindelning', bestamd: 'fastighetsindelningen', bestallning: 'Fastighetsindelning Nedladdning, vektor',
      url: kod => `${DL}/fastighet/fastighetsindelning_kn${kod}.zip`,
    },
  };

  // ------------------------------------------------------------------
  // Lokal lagring (IndexedDB)
  // ------------------------------------------------------------------
  function db() {
    return new Promise((ok, fel) => {
      const r = indexedDB.open('terrangunderlag', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('filer');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => fel(r.error);
    });
  }
  async function cacheLas(nyckel) {
    try {
      const d = await db();
      return await new Promise(ok => {
        const q = d.transaction('filer').objectStore('filer').get(nyckel);
        q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null);
      });
    } catch (e) { return null; }
  }
  async function cacheSpara(nyckel, varde) {
    try {
      const d = await db();
      await new Promise(ok => {
        const tx = d.transaction('filer', 'readwrite');
        tx.objectStore('filer').put(varde, nyckel);
        tx.oncomplete = ok; tx.onerror = ok; tx.onabort = ok;
      });
    } catch (e) { /* lagringen är en bekvämlighet */ }
  }
  /** Sparade filer: [{nyckel, produkt, kod, storlek, sparad, anvand}] */
  async function listaSparade() {
    try {
      const d = await db();
      return await new Promise(ok => {
        const ut = [], q = d.transaction('filer').objectStore('filer').openCursor();
        q.onsuccess = () => {
          const c = q.result;
          if (!c) return ok(ut);
          const v = c.value || {}, [produkt, kod] = String(c.key).split(':');
          ut.push({ nyckel: c.key, produkt, kod, storlek: v.data ? v.data.byteLength : 0,
            sparad: v.sparad || null, anvand: v.anvand || v.sparad || null });
          c.continue();
        };
        q.onerror = () => ok(ut);
      });
    } catch (e) { return []; }
  }
  async function taBort(nyckel) {
    try {
      const d = await db();
      await new Promise(ok => {
        const tx = d.transaction('filer', 'readwrite');
        if (nyckel == null) tx.objectStore('filer').clear(); else tx.objectStore('filer').delete(nyckel);
        tx.oncomplete = ok; tx.onerror = ok; tx.onabort = ok;
      });
    } catch (e) { /* ignoreras */ }
  }

  // ------------------------------------------------------------------
  // Hämtning
  // ------------------------------------------------------------------
  async function huvud(url, auth) {
    try {
      const r = await fetch(url, { method: 'HEAD', headers: { Authorization: auth } });
      if (r.status === 401 || r.status === 403) return { nekad: true };
      if (!r.ok) return null;
      return { etag: r.headers.get('ETag'), andrad: r.headers.get('Last-Modified'), storlek: +r.headers.get('Content-Length') || null };
    } catch (e) { return null; }
  }

  function nekad(p) {
    return new (T().InloggningsFel)(`Lantmäteriet nekade åtkomst till ${p.bestamd}. Kontrollera att ${p.bestallning} är beställd för kontot.`);
  }

  /** Hämtar kommunens zip för produkten (från lokal lagring om den är aktuell). */
  async function hamtaKommun(produkt, kod, auth, { logg = () => {}, bekrafta = async () => true, framsteg = () => {} } = {}) {
    const p = PRODUKTER[produkt];
    if (!p) throw new Error('Okänd produkt: ' + produkt);
    const url = T().dlUrl(p.url(kod));
    const nyckel = `${produkt}:${kod}`;
    const sparad = await cacheLas(nyckel);
    const h = await huvud(url, auth);
    if (h && h.nekad) throw nekad(p);
    if (sparad) {
      const samma = h ? (h.etag && h.etag === sparad.etag) || (h.andrad && h.andrad === sparad.andrad) : Date.now() - sparad.sparad < MAX_ALDER;
      if (samma) {
        logg(`${p.namn} för kommun ${kod} hämtat från webbläsarens lagring.`);
        cacheSpara(nyckel, Object.assign({}, sparad, { anvand: Date.now() }));
        return sparad.data;
      }
    }
    if (h && h.storlek && h.storlek > 120e6) {
      const ok = await bekrafta(h.storlek);
      if (!ok) throw new Error(`Hämtningen av ${p.bestamd} avbröts.`);
    }
    logg(`Hämtar ${p.namn.toLowerCase()} för kommun ${kod}${h && h.storlek ? ` (${(h.storlek / 1e6).toFixed(0)} MB)` : ''} …`);
    let r;
    try { r = await fetch(url, { headers: { Authorization: auth } }); } catch (e) { throw new Error(`Kunde inte nå Lantmäteriets server för ${p.bestamd}.`); }
    if (r.status === 401 || r.status === 403) throw nekad(p);
    if (!r.ok) throw new Error(`Lantmäteriet svarade ${r.status} för ${p.bestamd}.`);
    const total = +r.headers.get('Content-Length') || (h && h.storlek) || 0;
    let data;
    if (r.body && r.body.getReader && total) {
      const las = r.body.getReader(), delar = []; let fatt = 0;
      for (;;) {
        const { done, value } = await las.read();
        if (done) break;
        delar.push(value); fatt += value.length; framsteg(fatt / total);
      }
      data = new Uint8Array(fatt); let o = 0;
      for (const d of delar) { data.set(d, o); o += d.length; }
      data = data.buffer;
    } else data = await r.arrayBuffer();
    await cacheSpara(nyckel, { data, etag: h && h.etag, andrad: h && h.andrad, sparad: Date.now(), anvand: Date.now() });
    return data;
  }

  // ------------------------------------------------------------------
  // GeoPackage
  // ------------------------------------------------------------------
  let sqlLova = null;
  function sql() {
    if (!sqlLova) sqlLova = initSqlJs({ locateFile: f => (KONF().vendorBas || 'vendor/') + f });
    return sqlLova;
  }

  /** WKB (även GeoPackage-huvud) → [{typ:'yta'|'linje'|'punkt', ringar:[[[x,y],…],…]}] */
  function lasGeometri(u8) {
    let o = 0;
    if (u8[0] === 0x47 && u8[1] === 0x50) {
      const flaggor = u8[3], env = [0, 32, 48, 48, 64][(flaggor >> 1) & 7] || 0;
      o = 8 + env;
    }
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const ut = [];
    function las() {
      const le = dv.getUint8(o) === 1; o += 1;
      let typ = dv.getUint32(o, le); o += 4;
      let harZ = false, harM = false;
      if (typ & 0x80000000) harZ = true;
      if (typ & 0x40000000) harM = true;
      if (typ & 0x20000000) o += 4;                       // EWKB SRID
      typ &= 0x0fffffff;
      if (typ >= 3000) { harZ = harM = true; typ -= 3000; } else if (typ >= 2000) { harM = true; typ -= 2000; } else if (typ >= 1000) { harZ = true; typ -= 1000; }
      const dim = 2 + (harZ ? 1 : 0) + (harM ? 1 : 0);
      const punkter = () => {
        const n = dv.getUint32(o, le); o += 4;
        const pts = new Array(n);
        for (let i = 0; i < n; i++) { pts[i] = [dv.getFloat64(o, le), dv.getFloat64(o + 8, le)]; o += 8 * dim; }
        return pts;
      };
      if (typ === 1) {
        const p = [dv.getFloat64(o, le), dv.getFloat64(o + 8, le)]; o += 8 * dim;
        if (isFinite(p[0]) && isFinite(p[1])) ut.push({ typ: 'punkt', ringar: [[p]] });
        return;
      }
      if (typ === 2) { ut.push({ typ: 'linje', ringar: [punkter()] }); return; }
      if (typ === 3) {
        const n = dv.getUint32(o, le); o += 4;
        const ringar = []; for (let i = 0; i < n; i++) ringar.push(punkter());
        ut.push({ typ: 'yta', ringar }); return;
      }
      if (typ >= 4 && typ <= 7) {
        const n = dv.getUint32(o, le); o += 4;
        for (let i = 0; i < n; i++) las();
        return;
      }
      throw new Error('Geometritypen ' + typ + ' stöds inte.');
    }
    las();
    return ut;
  }

  /** Sutherland–Hodgman mot en axelparallell rektangel. */
  function klippRing(ring, r, sluten) {
    const kanter = [
      [p => p[0] >= r.xmin, (a, b) => [r.xmin, a[1] + (b[1] - a[1]) * (r.xmin - a[0]) / (b[0] - a[0])]],
      [p => p[0] <= r.xmax, (a, b) => [r.xmax, a[1] + (b[1] - a[1]) * (r.xmax - a[0]) / (b[0] - a[0])]],
      [p => p[1] >= r.ymin, (a, b) => [a[0] + (b[0] - a[0]) * (r.ymin - a[1]) / (b[1] - a[1]), r.ymin]],
      [p => p[1] <= r.ymax, (a, b) => [a[0] + (b[0] - a[0]) * (r.ymax - a[1]) / (b[1] - a[1]), r.ymax]],
    ];
    if (!sluten) return klippLinje(ring, r);
    let ut = ring.slice();
    if (ut.length > 1 && ut[0][0] === ut[ut.length - 1][0] && ut[0][1] === ut[ut.length - 1][1]) ut.pop();
    for (const [inne, skar] of kanter) {
      const inn = ut; ut = [];
      for (let i = 0; i < inn.length; i++) {
        const a = inn[(i + inn.length - 1) % inn.length], b = inn[i];
        if (inne(b)) { if (!inne(a)) ut.push(skar(a, b)); ut.push(b); }
        else if (inne(a)) ut.push(skar(a, b));
      }
      if (!ut.length) return [];
    }
    return ut.length >= 3 ? [ut] : [];
  }

  /** Linjer: behåll delarna inom rektangeln, med skärningspunkterna mot kanten. */
  function klippLinje(pts, r) {
    const inne = p => p[0] >= r.xmin && p[0] <= r.xmax && p[1] >= r.ymin && p[1] <= r.ymax;
    // Liang–Barsky för ett segment; null om det ligger helt utanför.
    const seg = (a, b) => {
      let t0 = 0, t1 = 1;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      for (const [p, q] of [[-dx, a[0] - r.xmin], [dx, r.xmax - a[0]], [-dy, a[1] - r.ymin], [dy, r.ymax - a[1]]]) {
        if (p === 0) { if (q < 0) return null; continue; }
        const t = q / p;
        if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
      }
      return [[a[0] + t0 * dx, a[1] + t0 * dy], [a[0] + t1 * dx, a[1] + t1 * dy]];
    };
    const delar = []; let akt = [];
    const slut = () => { if (akt.length > 1) delar.push(akt); akt = []; };
    for (let i = 1; i < pts.length; i++) {
      const s = seg(pts[i - 1], pts[i]);
      if (!s) { slut(); continue; }
      const sista = akt[akt.length - 1];
      if (!sista || sista[0] !== s[0][0] || sista[1] !== s[0][1]) { slut(); akt.push(s[0]); }
      akt.push(s[1]);
      if (!inne(pts[i])) slut();
    }
    slut();
    return delar;
  }

  /**
   * Söker i GeoPackagens R-träd via dess interna tabell (rtree_*_node), eftersom
   * sql.js saknar R-trädsmodulen. Noder: 2 byte djup (bara roten), 2 byte antal,
   * sedan poster om 24 byte: rowid (int64) + minx, maxx, miny, maxy (float32), big-endian.
   */
  function rtreeSok(fraga, namn, box) {
    const nod = no => { const r = fraga(`SELECT data FROM "${namn}_node" WHERE nodeno = ?`, [no]); return r.length ? r[0].data : null; };
    const rot = nod(1);
    if (!rot) return null;
    const djup = (rot[0] << 8) | rot[1];
    const ut = [];
    const besok = (data, niva) => {
      const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const n = dv.getUint16(2, false);
      for (let i = 0; i < n; i++) {
        const o = 4 + i * 24;
        const id = dv.getUint32(o, false) * 4294967296 + dv.getUint32(o + 4, false);
        const minx = dv.getFloat32(o + 8, false), maxx = dv.getFloat32(o + 12, false);
        const miny = dv.getFloat32(o + 16, false), maxy = dv.getFloat32(o + 20, false);
        if (maxx < box.xmin || minx > box.xmax || maxy < box.ymin || miny > box.ymax) continue;
        if (niva === djup) ut.push(id);
        else { const barn = nod(id); if (barn) besok(barn, niva + 1); }
      }
    };
    besok(rot, 0);
    return ut;
  }

  /** Geometrins utbredning ur GeoPackage-huvudet, om den finns. */
  function huvudBox(u8) {
    if (!(u8[0] === 0x47 && u8[1] === 0x50)) return null;
    const f = u8[3], env = (f >> 1) & 7, le = (f & 1) === 1;
    if (!env) return null;
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    return { xmin: dv.getFloat64(8, le), xmax: dv.getFloat64(16, le), ymin: dv.getFloat64(24, le), ymax: dv.getFloat64(32, le) };
  }

  /**
   * Läser objekt inom tmBox ur en GeoPackage.
   * opt.tabell(namn) väljer tabeller (standard: alla). opt.falt = kolumnnamn att
   * läsa (skiftlägesokänsligt; saknade hoppas över), annars alla textkolumner.
   * Returnerar { objekt: [{tabell, srs, typ, ringar, attr}], tabeller: [{namn, kolumner}] }.
   */
  function lasGpkg(SQL, gpkgBytes, tmBox, opt = {}) {
    const d = new SQL.Database(new Uint8Array(gpkgBytes));
    try {
      const fraga = (q, p) => { const st = d.prepare(q); if (p) st.bind(p); const rader = []; while (st.step()) rader.push(st.getAsObject()); st.free(); return rader; };
      const alla = fraga("SELECT c.table_name AS t, g.column_name AS g, g.srs_id AS srs FROM gpkg_contents c JOIN gpkg_geometry_columns g ON g.table_name = c.table_name WHERE c.data_type = 'features'");
      const ut = [], info = [];
      const q = n => `"${String(n).replace(/"/g, '""')}"`;
      for (const { t, g, srs } of alla) {
        const kol = fraga(`PRAGMA table_info(${q(t)})`);
        info.push({ namn: t, kolumner: kol.map(c => c.name) });
        if (opt.tabell && !opt.tabell(t)) continue;
        const pk = (kol.find(c => c.pk === 1) || { name: 'fid' }).name;
        const namn = opt.falt
          ? opt.falt.map(f => (kol.find(c => c.name.toLowerCase() === f.toLowerCase()) || {}).name).filter(Boolean)
          : kol.filter(c => /TEXT|CHAR/i.test(c.type) && c.name !== g).map(c => c.name);
        const valj = `SELECT ${q(g)} AS "__geom"${namn.map(n => `, ${q(n)}`).join('')} FROM ${q(t)}`;
        let ids = null;
        try {
          if (fraga('SELECT name FROM sqlite_master WHERE name = ?', [`rtree_${t}_${g}_node`]).length)
            ids = rtreeSok(fraga, `rtree_${t}_${g}`, tmBox);
        } catch (e) { ids = null; }
        let rader = [];
        if (ids) {
          for (let i = 0; i < ids.length; i += 500)
            rader = rader.concat(fraga(`${valj} WHERE ${q(pk)} IN (${ids.slice(i, i + 500).join(',')})`));
        } else {
          rader = fraga(valj).filter(rad => {
            const b = rad.__geom && huvudBox(rad.__geom);
            return !b || !(b.xmax < tmBox.xmin || b.xmin > tmBox.xmax || b.ymax < tmBox.ymin || b.ymin > tmBox.ymax);
          });
        }
        for (const rad of rader) {
          if (!rad.__geom) continue;
          const attr = {};
          namn.forEach(n => { attr[n.toLowerCase()] = rad[n]; });
          for (const geo of lasGeometri(rad.__geom)) ut.push({ tabell: t, srs, ...geo, attr });
        }
      }
      return { objekt: ut, tabeller: info };
    } finally { d.close(); }
  }

  // ------------------------------------------------------------------
  // Hela kedjan
  // ------------------------------------------------------------------
  /** Utsnittets omslutande rektangel i SWEREF 99 TM, med marginal. */
  function tmRuta(r, epsg, marginal = 1) {
    const tillTM = epsg === 3006 ? (p => p) : T().omvandlare(epsg, 3006).forward;
    const tm = T().kantlinje(r).map(tillTM);
    return { xmin: Math.min(...tm.map(p => p[0])) - marginal, xmax: Math.max(...tm.map(p => p[0])) + marginal,
      ymin: Math.min(...tm.map(p => p[1])) - marginal, ymax: Math.max(...tm.map(p => p[1])) + marginal };
  }

  /**
   * Hämtar produktens filer för kommunerna och läser objekten kring utsnittet,
   * omräknade till zonen (inte klippta).
   * opt: { produkt, kommuner, utsnitt, epsg, auth, marginal, tabell, falt, logg, framsteg, bekrafta }
   * Returnerar { objekt: [{tabell, typ, ringar (zon), attr}], tabeller }
   */
  async function lasUtsnitt(opt) {
    const { produkt, utsnitt: r, epsg, auth } = opt;
    const p = PRODUKTER[produkt];
    const tillZon = epsg === 3006 ? (pt => pt) : T().omvandlare(3006, epsg).forward;
    const tmBox = tmRuta(r, epsg, opt.marginal == null ? 1 : opt.marginal);
    const SQL = await sql();
    const objekt = []; let tabeller = [];
    for (let i = 0; i < opt.kommuner.length; i++) {
      const kod = opt.kommuner[i];
      const zipData = await hamtaKommun(produkt, kod, auth, {
        logg: opt.logg, bekrafta: opt.bekrafta,
        framsteg: f => opt.framsteg && opt.framsteg((i + f * 0.8) / opt.kommuner.length),
      });
      const zip = await JSZip.loadAsync(zipData);
      const gpkgFiler = Object.values(zip.files).filter(f => /\.gpkg$/i.test(f.name));
      if (!gpkgFiler.length) throw new Error(`Hittade ingen GeoPackage i filen för ${p.bestamd}.`);
      for (const fil of gpkgFiler) {
        const bytes = await fil.async('uint8array');
        const res = lasGpkg(SQL, bytes, tmBox, { tabell: opt.tabell, falt: opt.falt });
        tabeller = tabeller.concat(res.tabeller);
        for (const o of res.objekt) objekt.push(Object.assign(o, { kommun: kod, ringar: o.ringar.map(ring => ring.map(pt => tillZon(pt))) }));
      }
      opt.framsteg && opt.framsteg((i + 1) / opt.kommuner.length);
    }
    return { objekt, tabeller };
  }

  return { PRODUKTER, hamtaKommun, listaSparade, taBort, sql, lasGeometri, klippRing, klippLinje, rtreeSok, huvudBox, lasGpkg, tmRuta, lasUtsnitt };
}));
