/*
 * Marktäcke Nedladdning, vektor – hämtar kommunens GeoPackage (zip), sparar den i
 * webbläsaren, klipper ut utsnittet och skriver DXF med ett lager per marktäckesklass.
 *
 * Kräver JSZip, sql.js (initSqlJs), proj4, Terrang och Dxf.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Marktacke = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const T = () => (typeof Terrang !== 'undefined' ? Terrang : globalThis.Terrang);
  const KONF = () => (typeof self !== 'undefined' && self.TERRANG_KONFIG) || {};
  const URL_MALL = kod => `https://dl1.lantmateriet.se/mark/marktacke/marktacke_kn${kod}.zip`;
  const MAX_ALDER = 30 * 864e5;

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
  /** Sparade filer: [{nyckel, kod, storlek, sparad, anvand}] */
  async function listaSparade() {
    try {
      const d = await db();
      return await new Promise(ok => {
        const ut = [], q = d.transaction('filer').objectStore('filer').openCursor();
        q.onsuccess = () => {
          const c = q.result;
          if (!c) return ok(ut);
          const v = c.value || {};
          ut.push({ nyckel: c.key, kod: String(c.key).split(':')[1], storlek: v.data ? v.data.byteLength : 0,
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

  /** Hämtar kommunens zip (från lokal lagring om den är aktuell). */
  async function hamtaKommun(kod, auth, { logg = () => {}, bekrafta = async () => true, framsteg = () => {} } = {}) {
    const url = T().dlUrl(URL_MALL(kod));
    const sparad = await cacheLas('marktacke:' + kod);
    const h = await huvud(url, auth);
    if (h && h.nekad)
      throw new (T().InloggningsFel)('Lantmäteriet nekade åtkomst till marktäcket. Kontrollera att Marktäcke Nedladdning, vektor är beställd för kontot.');
    if (sparad) {
      const samma = h ? (h.etag && h.etag === sparad.etag) || (h.andrad && h.andrad === sparad.andrad) : Date.now() - sparad.sparad < MAX_ALDER;
      if (samma) {
        logg(`Marktäcke för kommun ${kod} hämtat från webbläsarens lagring.`);
        cacheSpara('marktacke:' + kod, Object.assign({}, sparad, { anvand: Date.now() }));
        return sparad.data;
      }
    }
    if (h && h.storlek && h.storlek > 120e6) {
      const ok = await bekrafta(h.storlek);
      if (!ok) throw new Error('Hämtningen av marktäcke avbröts.');
    }
    logg(`Hämtar marktäcke för kommun ${kod}${h && h.storlek ? ` (${(h.storlek / 1e6).toFixed(0)} MB)` : ''} …`);
    let r;
    try { r = await fetch(url, { headers: { Authorization: auth } }); } catch (e) { throw new Error('Kunde inte nå Lantmäteriets server för marktäcke.'); }
    if (r.status === 401 || r.status === 403)
      throw new (T().InloggningsFel)('Lantmäteriet nekade åtkomst till marktäcket. Kontrollera att Marktäcke Nedladdning, vektor är beställd för kontot.');
    if (!r.ok) throw new Error(`Lantmäteriet svarade ${r.status} för marktäcket.`);
    // läs med framsteg
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
    await cacheSpara('marktacke:' + kod, { data, etag: h && h.etag, andrad: h && h.andrad, sparad: Date.now(), anvand: Date.now() });
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

  /** WKB (även GeoPackage-huvud) → [{typ:'yta'|'linje', ringar:[[[x,y],…],…]}] */
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
      if (typ === 1) { o += 8 * dim; return; }
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
  /** Linjer: behåll delar inom rektangeln (enkel punkt-för-punkt-klippning). */
  function klippLinje(pts, r) {
    const inne = p => p[0] >= r.xmin && p[0] <= r.xmax && p[1] >= r.ymin && p[1] <= r.ymax;
    const delar = []; let akt = [];
    for (const p of pts) { if (inne(p)) akt.push(p); else if (akt.length) { if (akt.length > 1) delar.push(akt); akt = []; } }
    if (akt.length > 1) delar.push(akt);
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

  const KLASSFALT = [/^objekttyp$/i, /objekttyp/i, /^kategori/i, /^klass/i, /typ$/i, /typ/i];

  /** Läser objekt inom tmBox ur en GeoPackage. */
  function lasGpkg(SQL, gpkgBytes, tmBox) {
    const d = new SQL.Database(new Uint8Array(gpkgBytes));
    try {
      const fraga = (q, p) => { const st = d.prepare(q); if (p) st.bind(p); const rader = []; while (st.step()) rader.push(st.getAsObject()); st.free(); return rader; };
      const tabeller = fraga("SELECT c.table_name AS t, g.column_name AS g, g.srs_id AS srs FROM gpkg_contents c JOIN gpkg_geometry_columns g ON g.table_name = c.table_name WHERE c.data_type = 'features'");
      const ut = [];
      for (const { t, g, srs } of tabeller) {
        const kol = fraga(`PRAGMA table_info("${t.replace(/"/g, '""')}")`);
        const pk = (kol.find(c => c.pk === 1) || { name: 'fid' }).name;
        const textkol = kol.filter(c => /TEXT|CHAR/i.test(c.type) && c.name !== g).map(c => c.name);
        let klassKol = null;
        for (const re of KLASSFALT) { klassKol = textkol.find(n => re.test(n)); if (klassKol) break; }
        if (!klassKol) klassKol = textkol.find(n => !/id$|identitet/i.test(n)) || null;
        const q = (n) => `"${n.replace(/"/g, '""')}"`;
        const valj = `SELECT ${q(g)} AS geom${klassKol ? `, ${q(klassKol)} AS klass` : ''} FROM ${q(t)}`;
        let ids = null;
        try {
          if (fraga("SELECT name FROM sqlite_master WHERE name = ?", [`rtree_${t}_${g}_node`]).length)
            ids = rtreeSok(fraga, `rtree_${t}_${g}`, tmBox);
        } catch (e) { ids = null; }
        let rader = [];
        if (ids) {
          for (let i = 0; i < ids.length; i += 500)
            rader = rader.concat(fraga(`${valj} WHERE ${q(pk)} IN (${ids.slice(i, i + 500).join(',')})`));
        } else {
          rader = fraga(valj).filter(rad => {
            const b = rad.geom && huvudBox(rad.geom);
            return !b || !(b.xmax < tmBox.xmin || b.xmin > tmBox.xmax || b.ymax < tmBox.ymin || b.ymin > tmBox.ymax);
          });
        }
        for (const rad of rader) {
          if (!rad.geom) continue;
          for (const geo of lasGeometri(rad.geom)) ut.push({ tabell: t, srs, klass: rad.klass != null ? String(rad.klass) : t, ...geo });
        }
      }
      return { objekt: ut, tabeller: tabeller.map(x => x.t) };
    } finally { d.close(); }
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
    const { utsnitt: r, epsg, auth } = opt;
    const logg = opt.logg || (() => {});
    const tillTM = epsg === 3006 ? (p => p) : T().omvandlare(epsg, 3006).forward;
    const tillZon = epsg === 3006 ? (p => p) : T().omvandlare(3006, epsg).forward;
    const tm = T().kantlinje(r).map(tillTM);
    const tmBox = { xmin: Math.min(...tm.map(p => p[0])) - 1, xmax: Math.max(...tm.map(p => p[0])) + 1,
      ymin: Math.min(...tm.map(p => p[1])) - 1, ymax: Math.max(...tm.map(p => p[1])) + 1 };
    const SQL = await sql();
    const ytor = [], linjer = [], klasser = {};
    for (let i = 0; i < opt.kommuner.length; i++) {
      const kod = opt.kommuner[i];
      const zipData = await hamtaKommun(kod, auth, {
        logg, bekrafta: opt.bekrafta, framsteg: f => opt.framsteg && opt.framsteg((i + f * 0.8) / opt.kommuner.length),
      });
      const zip = await JSZip.loadAsync(zipData);
      const gpkgFiler = Object.values(zip.files).filter(f => /\.gpkg$/i.test(f.name));
      if (!gpkgFiler.length) throw new Error('Hittade ingen GeoPackage i marktäckesfilen.');
      for (const fil of gpkgFiler) {
        const bytes = await fil.async('uint8array');
        const { objekt } = lasGpkg(SQL, bytes, tmBox);
        for (const o of objekt) {
          const ringarZon = o.ringar.map(ring => ring.map(p => tillZon(p)));
          if (o.typ === 'yta') {
            const klippta = ringarZon.flatMap(ring => klippRing(ring, r, true));
            if (!klippta.length) continue;
            ytor.push({ klass: o.klass, ringar: klippta });
            klasser[o.klass] = (klasser[o.klass] || 0) + 1;
          } else {
            const delar = ringarZon.flatMap(l => klippLinje(l, r));
            delar.forEach(d => linjer.push({ klass: o.klass, pts: d }));
            if (delar.length) klasser[o.klass] = (klasser[o.klass] || 0) + delar.length;
          }
        }
      }
      opt.framsteg && opt.framsteg((i + 1) / opt.kommuner.length);
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

  return { hamtaUtsnitt, dxf, lagerNamn, farg, lasGeometri, klippRing, lasGpkg, URL_MALL, listaSparade, taBort };
}));
