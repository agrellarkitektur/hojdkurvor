/*
 * Stompunkt Direkt v1.1 – plan- och höjdpunkter i Lantmäteriets referensnät.
 * Teknisk beskrivning 1.0.1: POST /filter (sök inom geometri, max 5000 träffar),
 * POST /id (fullständig information, max 250 id per fråga). Svar i GeoJSON.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Stompunkt = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const T = () => (typeof Terrang !== 'undefined' ? Terrang : globalThis.Terrang);
  const BAS = () => (typeof self !== 'undefined' && self.TERRANG_API_BAS || 'https://api.lantmateriet.se') +
    '/distribution/produkter/stompunkt-direkt/v1.1';
  // plansystem → samma plansystem med RH 2000 (teknisk beskrivning, tabell Referenssystem)
  const MED_RH2000 = { 3006: 5845, 3007: 5846, 3008: 5847, 3012: 5851, 3009: 5848, 3013: 5852, 3010: 5849,
    3014: 5853, 3011: 5850, 3015: 5854, 3016: 5855, 3017: 5856, 3018: 5857 };

  async function post(sokvag, kropp, auth) {
    let r;
    try {
      r = await fetch(BAS() + sokvag, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(kropp) });
    } catch (e) { throw new Error('Kunde inte nå Stompunkt Direkt.'); }
    if (r.status === 401 || r.status === 403)
      throw new (T().InloggningsFel)('Lantmäteriet nekade åtkomst till stompunkterna. Kontrollera att Stompunkt Direkt är beställd för kontot.');
    let j = null;
    try { j = await r.json(); } catch (e) { /* tomt svar */ }
    if (!r.ok) {
      const orsak = j && (j.errors && j.errors.join(', ') || j.reason);
      if (orsak && /too many/i.test(orsak)) throw new Error('området ger fler än 5000 stompunkter. Välj ett mindre område.');
      throw new Error(`Stompunkt Direkt svarade ${r.status}${orsak ? ': ' + orsak : ''}.`);
    }
    return j;
  }

  const text = v => (v == null ? '' : String(v));

  /** Plattar ut en stompunkt till en rad med de uppgifter som är relevanta i projektering. */
  function rad(f) {
    const p = f.properties || {}, c = (f.geometry && f.geometry.coordinates) || [];
    const besk = (p.anmarkning || []).filter(a => /läges/i.test(a.anmarkningTyp || ''))
      .map(a => text(a.anmarkningText).replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim()).join(' ');
    return {
      id: text(p.stompunktId || f.id), namn: text(p.namn), typ: text(p.typ), kategori: text(p.kategori),
      x: c[0], y: c[1], z: c.length > 2 ? c[2] : null,
      kvalitetPlan: text(p.mbPlan && p.mbPlan.kvalitetKlass), osakerhetPlan: p.mbPlan && p.mbPlan.lagesosakerhet,
      kvalitetHojd: text(p.mbHojd && p.mbHojd.kvalitetKlass), osakerhetHojd: p.mbHojd && p.mbHojd.lagesosakerhet,
      markering: [p.markering && p.markering.markeringTyp, p.markering && p.markering.underlag].filter(Boolean).join(' i '),
      aterfunnen: text(p.historik && p.historik.aterfunnen), forstord: text(p.historik && p.historik.forstord),
      nat: text(p.stomnat && p.stomnat.natNamn), beskrivning: besk, skiss: text((p.bild || [])[0]),
    };
  }

  /**
   * Hämtar stompunkter inom utsnittet (rektangel i zonen). Söker med polygonen i
   * SWEREF 99 TM och får svaren i zonen med RH 2000-höjder.
   */
  async function hamta({ utsnitt: r, epsg, auth, buffer = 0, logg = () => {} }) {
    const tillTM = epsg === 3006 ? (p => p) : T().omvandlare(epsg, 3006).forward;
    const ring = T().kantlinje(r, 4).map(tillTM).map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
    ring.push(ring[0]);
    const srid = MED_RH2000[epsg] || epsg;
    const sok = await post(`/filter?srid=${srid}`, {
      geometri: { type: 'Polygon', crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::3006' } }, coordinates: [ring] },
      buffer,
    }, auth);
    const traffar = (sok && sok.features) || [];
    logg(`Hittade ${traffar.length} stompunkter.`);
    const ids = traffar.map(f => (f.properties && f.properties.stompunktId) || f.id).filter(Boolean);
    let fulla = [];
    for (let i = 0; i < ids.length; i += 250) {
      const j = await post(`/id?srid=${srid}`, ids.slice(i, i + 250), auth);
      fulla = fulla.concat((j && j.features) || []);
    }
    // om detaljerna saknas för någon punkt, använd sökträffen
    const perId = new Map(fulla.map(f => [(f.properties && f.properties.stompunktId) || f.id, f]));
    return traffar.map(f => rad(perId.get((f.properties && f.properties.stompunktId) || f.id) || f));
  }

  function csv(punkter, dx, dy, dz) {
    const q = v => { const s = text(v); return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const tal = (v, d = 3) => (v == null || !isFinite(v) ? '' : Number(v).toFixed(d));
    const huvud = ['id', 'namn', 'typ', 'kategori', 'x', 'y', 'z_rh2000', 'x_lokal', 'y_lokal', 'z_lokal',
      'kvalitet_plan', 'osakerhet_plan_m', 'kvalitet_hojd', 'osakerhet_hojd_m', 'markering', 'aterfunnen', 'forstord', 'nat', 'lagesbeskrivning', 'skiss'];
    const lok = Terrang.tillLokal(dx, dy);
    const rader = punkter.map(p => [p.id, p.namn, p.typ, p.kategori, tal(p.x), tal(p.y), tal(p.z),
      tal(lok(p.x, p.y)[0]), tal(lok(p.x, p.y)[1]), p.z == null ? '' : tal(p.z - dz), p.kvalitetPlan, tal(p.osakerhetPlan), p.kvalitetHojd,
      tal(p.osakerhetHojd), p.markering, p.aterfunnen, p.forstord, p.nat, p.beskrivning, p.skiss].map(q).join(';'));
    return '﻿' + [huvud.join(';')].concat(rader).join('\r\n') + '\r\n';
  }

  /** DXF: punkt på rätt höjd, kryss och namn. Plan- och höjdpunkter på var sitt lager. */
  function dxf(punkter, r, dx, dy, dz) {
    const lager = { STOMPUNKT_PLAN: 1, STOMPUNKT_HOJD: 5, STOMPUNKT_TEXT: 7, UTSNITT: 3 };
    const objekt = [];
    for (const p of punkter) {
      const l = /höjd/i.test(p.typ) && !/plan/i.test(p.typ) ? 'STOMPUNKT_HOJD' : 'STOMPUNKT_PLAN';
      const z = p.z == null ? null : p.z;
      objekt.push({ typ: 'punkt', lager: l, x: p.x, y: p.y, z });
      objekt.push({ typ: 'pl', lager: l, pts: [[p.x - 0.5, p.y - 0.5], [p.x + 0.5, p.y + 0.5]] });
      objekt.push({ typ: 'pl', lager: l, pts: [[p.x - 0.5, p.y + 0.5], [p.x + 0.5, p.y - 0.5]] });
      const hojd = z == null ? '' : ` +${(z - dz).toFixed(3).replace('.', ',')}`;
      objekt.push({ typ: 'text', lager: 'STOMPUNKT_TEXT', x: p.x + 0.8, y: p.y + 0.3, h: 0.8, text: `${p.namn || p.id}${hojd}` });
    }
    objekt.push({ typ: 'pl', lager: 'UTSNITT', pts: [[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax]], sluten: true });
    return Dxf.skriv(lager, objekt, { dx, dy, dz, ext: r });
  }

  return { hamta, csv, dxf, MED_RH2000 };
}));
