/*
 * Topografisk webbkarta Nedladdning, raster (Lantmäteriet, CC BY 4.0).
 * En GeoPackage på ca 170 GB med kartrutor 256 × 256 px i SWEREF 99 TM, nivå 0–13 (4096–0,5 m/px).
 * Filen läses i bitar med HTTP Range: databasens sidor hämtas en och en och kartrutorna
 * slås upp via indexet (zoom_level, tile_column, tile_row). Inget annat än de sidor som behövs hämtas.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Topowebb = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const T = () => (typeof Terrang !== 'undefined' ? Terrang : globalThis.Terrang);
  const URL_STD = 'https://dl1.lantmateriet.se/karta/topowebb/data/topowebb-3006.gpkg';
  const KALLA = 'Topografisk webbkarta © Lantmäteriet, CC BY 4.0';

  // ------------------------------------------------------------------
  // SQLite över HTTP Range
  // ------------------------------------------------------------------
  function varint(b, i) {
    let v = 0;
    for (let k = 0; k < 9; k++) {
      const c = b[i + k];
      if (k === 8) return [v * 256 + c, i + 9];
      v = v * 128 + (c & 0x7f);
      if (c < 0x80) return [v, i + k + 1];
    }
    return [v, i + 9];
  }
  const u16 = (b, i) => (b[i] << 8) | b[i + 1];
  const u32 = (b, i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];

  /** Avkodar en post (record) till en lista med värden; blobbar som Uint8Array. */
  function post(b) {
    const [hl, j0] = varint(b, 0);
    const typer = [];
    let j = j0;
    while (j < hl) { const [t, n] = varint(b, j); typer.push(t); j = n; }
    const v = [];
    let k = hl;
    for (const t of typer) {
      if (t === 0) v.push(null);
      else if (t >= 1 && t <= 6) {
        const n = [1, 2, 3, 4, 6, 8][t - 1];
        let x = 0;
        for (let q = 0; q < n; q++) x = x * 256 + b[k + q];
        if (b[k] & 0x80) x -= Math.pow(2, 8 * n);
        v.push(x); k += n;
      } else if (t === 7) { v.push(new DataView(b.buffer, b.byteOffset + k, 8).getFloat64(0)); k += 8; }
      else if (t === 8) v.push(0);
      else if (t === 9) v.push(1);
      else if (t >= 12) {
        const n = (t - (t % 2 ? 13 : 12)) / 2;
        const d = b.subarray(k, k + n);
        v.push(t % 2 ? new TextDecoder().decode(d) : d); k += n;
      }
    }
    return v;
  }

  class FjarrSqlite {
    constructor(url, auth) {
      this.url = url; this.auth = auth; this.sidor = new Map(); this.ps = 4096; this.us = 4096;
      this.aktiva = 0; this.ko = [];
    }
    async hamta(fran, till) {
      if (this.aktiva >= 6) await new Promise(ok => this.ko.push(ok));
      this.aktiva++;
      try {
        let r;
        try {
          r = await fetch(T().dlUrl(this.url), { headers: { Authorization: this.auth, Range: `bytes=${fran}-${till}` } });
        } catch (e) { throw new Error('Kunde inte nå Lantmäteriets kartfil.'); }
        if (r.status === 401 || r.status === 403)
          throw new (T().InloggningsFel)('Lantmäteriet nekade åtkomst till kartan. Kontrollera att Topografisk webbkarta Nedladdning, raster är beställd för kontot.');
        if (r.status !== 206 && r.status !== 200) throw new Error(`Kartfilen svarade ${r.status}.`);
        const b = new Uint8Array(await r.arrayBuffer());
        return r.status === 200 ? b.subarray(fran, till + 1) : b;
      } finally {
        this.aktiva--;
        const nasta = this.ko.shift();
        if (nasta) nasta();
      }
    }
    sida(n) {
      let p = this.sidor.get(n);
      if (!p) {
        p = this.hamta((n - 1) * this.ps, n * this.ps - 1);
        p.catch(() => this.sidor.delete(n));
        this.sidor.set(n, p);
        if (this.sidor.size > 4000) this.sidor.delete(this.sidor.keys().next().value);
      }
      return p;
    }
    /** Läser cellens hela innehåll, även det som ligger på överflödessidor. */
    async innehall(b, i, langd, tabellBlad) {
      const U = this.us;
      const X = tabellBlad ? U - 35 : Math.floor((U - 12) * 64 / 255) - 23;
      if (langd <= X) return b.subarray(i, i + langd);
      const M = Math.floor((U - 12) * 32 / 255) - 23;
      const K = M + ((langd - M) % (U - 4));
      const lokal = K <= X ? K : M;
      const ut = new Uint8Array(langd);
      ut.set(b.subarray(i, i + lokal), 0);
      let pos = lokal, nasta = u32(b, i + lokal);
      while (pos < langd && nasta) {
        const s = await this.sida(nasta);
        const n = Math.min(U - 4, langd - pos);
        ut.set(s.subarray(4, 4 + n), pos);
        pos += n; nasta = u32(s, 0);
      }
      return ut;
    }
    huvud(s, n) { const h = n === 1 ? 100 : 0; return { h, typ: s[h], antal: u16(s, h + 3), hoger: (s[h] === 2 || s[h] === 5) ? u32(s, h + 8) : 0, start: h + ((s[h] === 2 || s[h] === 5) ? 12 : 8) }; }

    async oppna() {
      const b = await this.hamta(0, 99);
      if (new TextDecoder().decode(b.subarray(0, 15)) !== 'SQLite format 3') throw new Error('Kartfilen är inte en GeoPackage.');
      this.ps = u16(b, 16) === 1 ? 65536 : u16(b, 16);
      this.us = this.ps - b[20];
      this.sidor.clear();
      return this;
    }
    /** Alla rader i en tabell (bara för små tabeller). */
    async rader(rot) {
      const ut = [];
      const gå = async n => {
        const s = await this.sida(n), hd = this.huvud(s, n);
        if (hd.typ === 5) {
          for (let c = 0; c < hd.antal; c++) await gå(u32(s, u16(s, hd.start + 2 * c)));
          await gå(hd.hoger);
        } else if (hd.typ === 13) {
          for (let c = 0; c < hd.antal; c++) {
            let i = u16(s, hd.start + 2 * c);
            const [langd, a] = varint(s, i); const [rowid, d] = varint(s, a);
            ut.push({ rowid, v: post(await this.innehall(s, d, langd, true)) });
          }
        }
      };
      await gå(rot);
      return ut;
    }
    /** Rowid för nyckeln i ett index med heltalsnycklar, eller null. */
    async sokIndex(rot, nyckel) {
      const jfr = v => { for (let q = 0; q < nyckel.length; q++) { if (v[q] !== nyckel[q]) return v[q] < nyckel[q] ? -1 : 1; } return 0; };
      let n = rot;
      for (;;) {
        const s = await this.sida(n), hd = this.huvud(s, n);
        if (hd.typ === 2) {
          let nasta = hd.hoger;
          for (let c = 0; c < hd.antal; c++) {
            const i = u16(s, hd.start + 2 * c);
            const vanster = u32(s, i);
            const [langd, a] = varint(s, i + 4);
            const v = post(await this.innehall(s, a, langd, false));
            const j = jfr(v);
            if (j === 0) return v[v.length - 1];
            if (j > 0) { nasta = vanster; break; }
          }
          n = nasta;
        } else if (hd.typ === 10) {
          for (let c = 0; c < hd.antal; c++) {
            const i = u16(s, hd.start + 2 * c);
            const [langd, a] = varint(s, i);
            const v = post(await this.innehall(s, a, langd, false));
            const j = jfr(v);
            if (j === 0) return v[v.length - 1];
            if (j > 0) return null;
          }
          return null;
        } else throw new Error('Oväntad sidtyp i kartfilens index.');
      }
    }
    /** Raden med ett visst rowid i en tabell, eller null. */
    async radMedId(rot, rowid) {
      let n = rot;
      for (;;) {
        const s = await this.sida(n), hd = this.huvud(s, n);
        if (hd.typ === 5) {
          let nasta = hd.hoger;
          for (let c = 0; c < hd.antal; c++) {
            const i = u16(s, hd.start + 2 * c);
            const [nyckel] = varint(s, i + 4);
            if (rowid <= nyckel) { nasta = u32(s, i); break; }
          }
          n = nasta;
        } else if (hd.typ === 13) {
          for (let c = 0; c < hd.antal; c++) {
            const i = u16(s, hd.start + 2 * c);
            const [langd, a] = varint(s, i); const [id, d] = varint(s, a);
            if (id === rowid) return post(await this.innehall(s, d, langd, true));
          }
          return null;
        } else throw new Error('Oväntad sidtyp i kartfilen.');
      }
    }
  }

  // ------------------------------------------------------------------
  // Kartan
  // ------------------------------------------------------------------
  const oppnade = new Map();
  /** Öppnar kartfilen och läser rutnätet. Återanvänds per inloggning. */
  function oppna(auth, url = (typeof self !== 'undefined' && self.TERRANG_TOPOWEBB) || URL_STD) {
    const nyckel = auth + '|' + url;
    if (!oppnade.has(nyckel)) {
      const p = (async () => {
        const db = await new FjarrSqlite(url, auth).oppna();
        const schema = await db.rader(1);
        const objekt = schema.map(r => ({ typ: r.v[0], namn: r.v[1], tabell: r.v[2], rot: r.v[3] }));
        const innehall = await db.rader(objekt.find(o => o.namn === 'gpkg_contents').rot);
        const tabell = (innehall.find(r => r.v[1] === 'tiles') || {}).v;
        if (!tabell) throw new Error('Kartfilen innehåller inga kartrutor.');
        const tnamn = tabell[0];
        const mset = (await db.rader(objekt.find(o => o.namn === 'gpkg_tile_matrix_set').rot)).find(r => r.v[0] === tnamn).v;
        const nivaer = (await db.rader(objekt.find(o => o.namn === 'gpkg_tile_matrix').rot))
          .filter(r => r.v[0] === tnamn).map(r => ({ z: r.v[1], bredd: r.v[2], hojd: r.v[3], tw: r.v[4], th: r.v[5], px: r.v[6], py: r.v[7] }))
          .sort((a, b) => a.z - b.z);
        const tab = objekt.find(o => o.typ === 'table' && o.namn === tnamn);
        const idx = objekt.find(o => o.typ === 'index' && o.tabell === tnamn && /autoindex|zoom/i.test(o.namn));
        if (!tab || !idx) throw new Error('Kartfilens index saknas.');
        const karta = {
          db, tnamn, nivaer, minx: mset[2], miny: mset[3], maxx: mset[4], maxy: mset[5], srs: mset[1],
          rutor: new Map(),
          ruta(z, c, r) {
            const k = `${z}/${c}/${r}`;
            if (!this.rutor.has(k)) {
              const p = (async () => {
                const id = await db.sokIndex(idx.rot, [z, c, r]);
                if (id == null) return null;
                const rad = await db.radMedId(tab.rot, id);
                return rad ? rad[4] : null;
              })();
              p.catch(() => this.rutor.delete(k));
              this.rutor.set(k, p);
              if (this.rutor.size > 3000) this.rutor.delete(this.rutor.keys().next().value);
            }
            return this.rutor.get(k);
          },
          /** Grövsta nivån som är minst så fin som m per pixel. */
          niva(mPerPx) {
            let val = this.nivaer[this.nivaer.length - 1];
            for (let i = this.nivaer.length - 1; i >= 0; i--) { if (this.nivaer[i].px <= mPerPx * 1.25) val = this.nivaer[i]; else break; }
            return val;
          },
        };
        return karta;
      })();
      p.catch(() => oppnade.delete(nyckel));
      oppnade.set(nyckel, p);
    }
    return oppnade.get(nyckel);
  }

  async function avkoda(data) {
    const blob = new Blob([data], { type: data[0] === 0xff ? 'image/jpeg' : data[0] === 0x52 ? 'image/webp' : 'image/png' });
    if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
    const url = URL.createObjectURL(blob);
    try { const im = new Image(); im.src = url; await im.decode(); return im; } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }

  /**
   * Hämtar kartbilden för en ruta i SWEREF 99 TM.
   * Returnerar { canvas, x0, y1, s } där (x0, y1) är övre vänstra hörnet och s meter per pixel.
   */
  async function bild(karta, tm, mPerPx, { framsteg } = {}) {
    const n = karta.niva(mPerPx);
    const span = n.tw * n.px, spanY = n.th * n.py;
    const c0 = Math.max(0, Math.floor((tm.xmin - karta.minx) / span)), c1 = Math.min(n.bredd - 1, Math.floor((tm.xmax - karta.minx) / span));
    const r0 = Math.max(0, Math.floor((karta.maxy - tm.ymax) / spanY)), r1 = Math.min(n.hojd - 1, Math.floor((karta.maxy - tm.ymin) / spanY));
    const antal = (c1 - c0 + 1) * (r1 - r0 + 1);
    if (antal > 400) throw new Error('Kartområdet är för stort för Lantmäteriets karta.');
    const canvas = document.createElement('canvas');
    canvas.width = (c1 - c0 + 1) * n.tw; canvas.height = (r1 - r0 + 1) * n.th;
    const cx = canvas.getContext('2d');
    let klara = 0, hittade = 0;
    const jobb = [];
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      jobb.push(karta.ruta(n.z, c, r).then(async d => {
        if (d) { cx.drawImage(await avkoda(d), (c - c0) * n.tw, (r - r0) * n.th); hittade++; }
        klara++; if (framsteg) framsteg(klara / antal);
      }));
    }
    await Promise.all(jobb);
    return { canvas, x0: karta.minx + c0 * span, y1: karta.maxy - r0 * spanY, s: n.px, niva: n.z, hittade, antal };
  }

  /** Affin avbildning som bestäms av tre punktpar: [[x,y]→[u,v]] × 3. */
  function affin(fran, till) {
    const [[x0, y0], [x1, y1], [x2, y2]] = fran, [[u0, v0], [u1, v1], [u2, v2]] = till;
    const d = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / d;
    const b = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / d;
    const c = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / d;
    const e = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / d;
    return { a, b, c, d: e, e: u0 - a * x0 - b * y0, f: v0 - c * x0 - e * y0 };   // u = a x + b y + e, v = c x + d y + f
  }

  /**
   * Ritar om en TM-bild till ett annat rutnät.
   * mal: { x0, y1, s, W, H } i målets koordinater; tillTM(x, y) → [E, N].
   */
  function omprojicera(kalla, mal, tillTM) {
    const ut = document.createElement('canvas');
    ut.width = mal.W; ut.height = mal.H;
    const cx = ut.getContext('2d');
    // tre punkter i målbilden (pixel) → TM → pixel i källbilden
    const P = [[0, 0], [mal.W, 0], [0, mal.H]];
    const kallPx = P.map(([i, j]) => {
      const [E, N] = tillTM(mal.x0 + i * mal.s, mal.y1 - j * mal.s);
      return [(E - kalla.x0) / kalla.s, (kalla.y1 - N) / kalla.s];
    });
    const m = affin(kallPx, P);    // källpixel → målpixel
    cx.imageSmoothingQuality = 'high';
    cx.setTransform(m.a, m.c, m.b, m.d, m.e, m.f);
    cx.drawImage(kalla.canvas, 0, 0);
    return ut;
  }

  /** Tonar ner bilden: 'farg' (lätt nedtonad), 'gra' (gråskala) eller 'ingen'. */
  function tona(canvas, lage) {
    if (lage === 'ingen') return canvas;
    const cx = canvas.getContext('2d');
    const d = cx.getImageData(0, 0, canvas.width, canvas.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      if (lage === 'gra') {
        const l = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
        const v = 255 - (255 - l) * 0.55;
        p[i] = p[i + 1] = p[i + 2] = v;
      } else {
        for (let k = 0; k < 3; k++) p[i + k] = 255 - (255 - p[i + k]) * 0.62;
      }
    }
    cx.putImageData(d, 0, 0);
    return canvas;
  }

  /** Leaflet-lager som visar kartan på en Web Mercator-karta. */
  function leafletLager(L, auth, { omvandla, ...opt } = {}) {
    const Lager = L.GridLayer.extend({
      createTile(coords, klar) {
        const tile = document.createElement('canvas');
        const sz = this.getTileSize();
        tile.width = sz.x; tile.height = sz.y;
        const karta = this._map;
        const nw = coords.scaleBy(sz);
        const ll = (dx, dy) => karta.unproject([nw.x + dx, nw.y + dy], coords.z);
        const hörn = [ll(0, 0), ll(sz.x, 0), ll(0, sz.y), ll(sz.x, sz.y)].map(p => omvandla([p.lng, p.lat]));
        const tm = { xmin: Math.min(...hörn.map(p => p[0])), xmax: Math.max(...hörn.map(p => p[0])), ymin: Math.min(...hörn.map(p => p[1])), ymax: Math.max(...hörn.map(p => p[1])) };
        const mPerPx = Math.hypot(hörn[1][0] - hörn[0][0], hörn[1][1] - hörn[0][1]) / sz.x;
        oppna(auth).then(k => bild(k, tm, mPerPx)).then(b => {
          // TM-pixel i b → tile-pixel via tre hörn
          const fran = [hörn[0], hörn[1], hörn[2]].map(([E, N]) => [(E - b.x0) / b.s, (b.y1 - N) / b.s]);
          const m = affin(fran, [[0, 0], [sz.x, 0], [0, sz.y]]);
          const cx = tile.getContext('2d');
          cx.setTransform(m.a, m.c, m.b, m.d, m.e, m.f);
          cx.drawImage(b.canvas, 0, 0);
          klar(null, tile);
        }).catch(e => { if (opt.fel) opt.fel(e); klar(e, tile); });
        return tile;
      },
    });
    return new Lager({ attribution: KALLA, maxZoom: 20, maxNativeZoom: 19, minZoom: 5, tileSize: 256, keepBuffer: 1, updateWhenIdle: true });
  }

  return { oppna, bild, omprojicera, tona, affin, leafletLager, FjarrSqlite, post, KALLA, URL_STD };
}));
