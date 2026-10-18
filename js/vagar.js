/*
 * Vägar från OpenStreetMap (ODbL) via Overpass API, som mittlinjer i utsnittet.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Vagar = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const T = () => (typeof Terrang !== 'undefined' ? Terrang : globalThis.Terrang);
  const URL_STD = 'https://overpass-api.de/api/interpreter';

  // lager, DXF-färg (ACI), linjebredd i utskriften (mm) och streckning
  const KLASSER = {
    VAG_HUVUDVAG: { aci: 1, mm: 0.55, namn: 'Huvudvägar (motorväg till tertiär väg)' },
    VAG_LOKALGATA: { aci: 7, mm: 0.4, namn: 'Lokalgator, bostadsgator och tillfarter' },
    VAG_GANG_CYKEL: { aci: 3, mm: 0.22, streck: true, namn: 'Gång- och cykelvägar, stigar och trappor' },
    VAG_OVRIG: { aci: 8, mm: 0.3, namn: 'Övriga vägar (skogsbilväg, traktorväg m.fl.)' },
  };
  function klass(h) {
    if (/^(motorway|trunk|primary|secondary|tertiary)(_link)?$/.test(h)) return 'VAG_HUVUDVAG';
    if (/^(residential|unclassified|living_street|service|road)$/.test(h)) return 'VAG_LOKALGATA';
    if (/^(footway|cycleway|path|pedestrian|steps|bridleway|corridor)$/.test(h)) return 'VAG_GANG_CYKEL';
    if (/^(proposed|construction|abandoned|disused|razed|platform|raceway|bus_stop|elevator)$/.test(h)) return null;
    return 'VAG_OVRIG';
  }

  /** Klipper en polylinje mot en rektangel (Liang–Barsky per segment). Returnerar delar. */
  function klipp(pts, r) {
    const delar = [];
    let aktuell = null;
    for (let i = 1; i < pts.length; i++) {
      let [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const dx = x1 - x0, dy = y1 - y0;
      let t0 = 0, t1 = 1, ok = true;
      for (const [p, q] of [[-dx, x0 - r.xmin], [dx, r.xmax - x0], [-dy, y0 - r.ymin], [dy, r.ymax - y0]]) {
        if (p === 0) { if (q < 0) { ok = false; break; } }
        else {
          const t = q / p;
          if (p < 0) { if (t > t1) { ok = false; break; } if (t > t0) t0 = t; }
          else { if (t < t0) { ok = false; break; } if (t < t1) t1 = t; }
        }
      }
      if (!ok) { aktuell = null; continue; }
      const a = [x0 + t0 * dx, y0 + t0 * dy], b = [x0 + t1 * dx, y0 + t1 * dy];
      if (!aktuell || t0 > 0) { aktuell = [a]; delar.push(aktuell); }
      aktuell.push(b);
      if (t1 < 1) aktuell = null;
    }
    return delar.filter(d => d.length > 1);
  }

  /** Hämtar vägar inom utsnittet (i zonen). Returnerar { linjer: [{lager, typ, namn, pts}], antal }. */
  async function hamta({ utsnitt: r, epsg, marg = 20 }) {
    const tillLL = T().omvandlare(epsg, 4326).forward, tillZon = T().omvandlare(4326, epsg).forward;
    const hörn = [[r.xmin - marg, r.ymin - marg], [r.xmax + marg, r.ymin - marg], [r.xmax + marg, r.ymax + marg], [r.xmin - marg, r.ymax + marg]].map(tillLL);
    const s = Math.min(...hörn.map(p => p[1])), n = Math.max(...hörn.map(p => p[1]));
    const w = Math.min(...hörn.map(p => p[0])), e = Math.max(...hörn.map(p => p[0]));
    const fraga = `[out:json][timeout:25];way["highway"](${s.toFixed(6)},${w.toFixed(6)},${n.toFixed(6)},${e.toFixed(6)});out geom tags;`;
    let svar;
    try {
      svar = await fetch((typeof self !== 'undefined' && self.TERRANG_OVERPASS) || URL_STD, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(fraga),
      });
    } catch (err) { throw new Error('kunde inte nå OpenStreetMap (Overpass).'); }
    if (svar.status === 429 || svar.status === 504) throw new Error('OpenStreetMap är överbelastat just nu. Försök igen om en stund.');
    if (!svar.ok) throw new Error(`OpenStreetMap svarade ${svar.status}.`);
    const d = await svar.json();
    const linjer = [];
    for (const el of d.elements || []) {
      if (el.type !== 'way' || !el.geometry || !el.tags) continue;
      const lager = klass(el.tags.highway || '');
      if (!lager) continue;
      const pts = el.geometry.map(g => tillZon([g.lon, g.lat]));
      for (const del of klipp(pts, r)) linjer.push({ lager, typ: el.tags.highway, namn: el.tags.name || '', pts: del });
    }
    return { linjer, antal: linjer.length };
  }

  function dxf(res, r, dx, dy) {
    const lager = { UTSNITT: 3 }, objekt = [];
    for (const l of res.linjer) { lager[l.lager] = KLASSER[l.lager].aci; objekt.push({ typ: 'pl', lager: l.lager, pts: l.pts }); }
    objekt.push({ typ: 'pl', lager: 'UTSNITT', pts: [[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax]], sluten: true });
    return Dxf.skriv(lager, objekt, { dx, dy, ext: r });
  }

  return { hamta, dxf, klipp, klass, KLASSER, URL_STD };
}));
