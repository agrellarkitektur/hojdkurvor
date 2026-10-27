/*
 * IFC4-skrivare för befintliga byggnader (0.8.0): varje byggnad med känd höjd blir en
 * IfcBuildingElementProxy med en extruderad volym från markhöjden upp till takhöjden
 * (platt tak, gårdar som hål), placerad direkt i IfcSite. Egenskaperna (husnummer,
 * ändamål, höjd …) ligger i egenskapsuppsättningen Hojdkurvor_Byggnad.
 *
 * Koordinaterna omvandlas som i DXF-filerna: dx, dy, dz dras av och de lokala filerna
 * vrids runt nollpunkten (Terrang.tillLokal). Samma byggnad får samma GlobalId varje gång
 * (räknat ur projektets id och byggnadens objektidentitet), så att en ny export kan
 * ersätta en gammal i ritprogrammet.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Ifc = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TR = () => (typeof Terrang !== 'undefined' ? Terrang : globalThis.Terrang);

  // ------------------------------------------------------------------
  // STEP-format
  // ------------------------------------------------------------------
  /** Tal med decimalpunkt, som STEP kräver ("3." i stället för "3"). */
  function tal(v) {
    const r = Math.round(v * 1000) / 1000, s = String(Object.is(r, -0) ? 0 : r);
    return /[.eE]/.test(s) ? s : s + '.';
  }
  /** Text inom apostrofer; tecken utanför ASCII som \X2\HHHH\X0\. */
  function text(s) {
    if (s == null) return '$';
    let ut = '';
    for (const c of String(s)) {
      const k = c.codePointAt(0);
      if (c === "'") ut += "''";
      else if (c === '\\') ut += '\\\\';
      else if (k >= 0x20 && k <= 0x7e) ut += c;
      else if (k <= 0xffff) ut += '\\X2\\' + k.toString(16).toUpperCase().padStart(4, '0') + '\\X0\\';
      else ut += '\\X4\\' + k.toString(16).toUpperCase().padStart(8, '0') + '\\X0\\';
    }
    return "'" + ut + "'";
  }

  // ------------------------------------------------------------------
  // GlobalId: 128 bitar som 22 tecken (IFC:s egen base64)
  // ------------------------------------------------------------------
  const TECKEN = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  /** 128-bitars hash (cyrb128) av en text, som fyra 32-bitarstal. */
  function hash128(s) {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0; i < s.length; i++) {
      const k = s.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  }
  /** GlobalId ur en nyckeltext: samma nyckel ger alltid samma id. */
  function guid(nyckel) {
    const ord = hash128(String(nyckel));
    let bitar = '';
    for (const w of ord) bitar += w.toString(2).padStart(32, '0');
    let ut = TECKEN[parseInt(bitar.slice(0, 2), 2)];
    for (let i = 2; i < 128; i += 6) ut += TECKEN[parseInt(bitar.slice(i, i + 6), 2)];
    return ut;
  }

  // ------------------------------------------------------------------
  // Geometri
  // ------------------------------------------------------------------
  function ytaMedTecken(p) {
    let a = 0;
    for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
    return a / 2;
  }
  /** Ring utan upprepade punkter (avrundat till mm), moturs om moturs annars medurs. */
  function stad(ring, moturs) {
    const ut = [];
    for (const p of ring) {
      const q = [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];
      const s = ut[ut.length - 1];
      if (!s || s[0] !== q[0] || s[1] !== q[1]) ut.push(q);
    }
    while (ut.length > 1 && ut[0][0] === ut[ut.length - 1][0] && ut[0][1] === ut[ut.length - 1][1]) ut.pop();
    if (ut.length < 3 || Math.abs(ytaMedTecken(ut)) < 0.01) return null;
    if ((ytaMedTecken(ut) > 0) !== moturs) ut.reverse();
    return ut;
  }

  /**
   * Bygger IFC-filen. byggnader: som från Byggnad.hamta + Byggnad.hojder.
   * opt: { dx, dy, dz, projekt, projektId, filnamn, kalla, systemNamn, lokal }
   *   lokal: true för filen relativt nollpunkten (vriden som DXF-filerna), annars SWEREF.
   * Returnerar { text, antal, utanHojd } där utanHojd är antalet byggnader som inte kom med.
   */
  function byggnader(lista, opt = {}) {
    const { dx = 0, dy = 0, dz = 0 } = opt;
    const tr = TR();
    const t = tr && tr.tillLokal ? tr.tillLokal(dx, dy) : ((x, y) => [x - dx, y - dy]);
    const nyckel = (opt.projektId || opt.projekt || 'hojdkurvor') + (opt.lokal ? ':lokal' : ':sweref');
    const rader = [];
    let n = 0;
    const e = s => { n++; rader.push(`#${n}=${s};`); return '#' + n; };
    const lista3 = v => '(' + v.join(',') + ')';

    // grunden: koordinatsystem, enheter, sammanhang, projekt och plats
    const origo = e('IFCCARTESIANPOINT((0.,0.,0.))');
    const zAxel = e('IFCDIRECTION((0.,0.,1.))');
    const xAxel = e('IFCDIRECTION((1.,0.,0.))');
    const wcs = e(`IFCAXIS2PLACEMENT3D(${origo},${zAxel},${xAxel})`);
    const norr = e('IFCDIRECTION((0.,1.))');
    const ctx = e(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${wcs},${norr})`);
    const body = e(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${ctx},$,.MODEL_VIEW.,$)`);
    const enheter = e(`IFCUNITASSIGNMENT(${lista3([
      e('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)'), e('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)'),
      e('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)'), e('IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)'),
    ])})`);
    const projekt = e(`IFCPROJECT('${guid(nyckel + ':projekt')}',$,${text(opt.projekt || 'Plats')},${text(`Befintliga byggnader från ${opt.kalla || 'höjdkurvor.se'}`)},$,$,$,(${ctx}),${enheter})`);
    const platsPl = e(`IFCLOCALPLACEMENT($,${wcs})`);
    const site = e(`IFCSITE('${guid(nyckel + ':site')}',$,${text(opt.projekt || 'Platsen')},${text(opt.lokal
      ? `Lokala koordinater: nollpunkt och Z0 = ${tal(dz)} (RH 2000) enligt info-filen`
      : `${opt.systemNamn || 'SWEREF 99'}, höjder i RH 2000`)},$,${platsPl},$,$,.ELEMENT.,$,$,${tal(opt.lokal ? dz : 0)},$,$)`);
    e(`IFCRELAGGREGATES('${guid(nyckel + ':agg')}',$,$,$,${projekt},(${site}))`);

    // ett gemensamt utseende: ljust grått
    const farg = e("IFCCOLOURRGB($,0.78,0.76,0.72)");
    const skuggning = e(`IFCSURFACESTYLESHADING(${farg},0.)`);
    const stil = e(`IFCSURFACESTYLE('Befintlig byggnad',.BOTH.,(${skuggning}))`);

    const delar = [];
    let utanHojd = 0;
    const sedda = new Map();
    for (const b of lista) {
      if (b.hojd == null || b.mark == null) { utanHojd++; continue; }
      const yttre = stad(b.fotavtryck.map(p => t(p[0], p[1])), true);
      if (!yttre) { utanHojd++; continue; }
      const inre = (b.hal || []).map(h => stad(h.map(p => t(p[0], p[1])), false)).filter(Boolean);
      const polylinje = ring => e(`IFCPOLYLINE(${lista3(ring.concat([ring[0]]).map(p => e(`IFCCARTESIANPOINT((${tal(p[0])},${tal(p[1])}))`)))})`);
      const profil = inre.length
        ? e(`IFCARBITRARYPROFILEDEFWITHVOIDS(.AREA.,$,${polylinje(yttre)},${lista3(inre.map(polylinje))})`)
        : e(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${polylinje(yttre)})`);
      const lage = e(`IFCAXIS2PLACEMENT3D(${e(`IFCCARTESIANPOINT((0.,0.,${tal(b.mark - dz)}))`)},$,$)`);
      const volym = e(`IFCEXTRUDEDAREASOLID(${profil},${lage},${zAxel},${tal(b.hojd)})`);
      e(`IFCSTYLEDITEM(${volym},(${stil}),$)`);
      const form = e(`IFCPRODUCTDEFINITIONSHAPE($,$,(${e(`IFCSHAPEREPRESENTATION(${body},'Body','SweptSolid',(${volym}))`)}))`);
      const pl = e(`IFCLOCALPLACEMENT(${platsPl},${wcs})`);
      // samma objektidentitet två gånger (sällsynt) får löpnummer
      const id = b.id || `${tal(yttre[0][0])},${tal(yttre[0][1])}`;
      const k = (sedda.get(id) || 0) + 1; sedda.set(id, k);
      const gid = guid(`${nyckel}:byggnad:${id}${k > 1 ? ':' + k : ''}`);
      const andamal = (b.andamal || []).join(', ');
      const namn = [b.husnummer ? `Hus ${b.husnummer}` : null, b.namn, b.andamal && b.andamal[0] || b.typ].filter(Boolean).join(' ');
      const proxy = e(`IFCBUILDINGELEMENTPROXY('${gid}',$,${text(namn || 'Befintlig byggnad')},${text(andamal || null)},${text(b.typ || 'Befintlig byggnad')},${pl},${form},${text(b.husnummer || null)},.ELEMENT.)`);
      const eg = [
        ['Objektidentitet', b.id ? `IFCIDENTIFIER(${text(b.id)})` : null],
        ['Objekttyp', b.typ ? `IFCLABEL(${text(b.typ)})` : null],
        ['Andamal', andamal ? `IFCLABEL(${text(andamal)})` : null],
        ['Husnummer', b.husnummer ? `IFCLABEL(${text(b.husnummer)})` : null],
        ['Byggnadsnamn', b.namn ? `IFCLABEL(${text(b.namn)})` : null],
        ['Huvudbyggnad', `IFCBOOLEAN(${b.huvud ? '.T.' : '.F.'})`],
        ['Markhojd_RH2000', `IFCLENGTHMEASURE(${tal(b.mark)})`],
        ['Hojd_over_mark', `IFCPOSITIVELENGTHMEASURE(${tal(b.hojd)})`],
        ['Tak', `IFCLABEL(${text('Förenklat till platt')})`],
        ['Kalla', `IFCLABEL(${text('Byggnad Nedladdning, vektor © Lantmäteriet (CC BY 4.0); höjd ur laserdata')})`],
      ].filter(([, v]) => v).map(([namn2, v]) => e(`IFCPROPERTYSINGLEVALUE(${text(namn2)},$,${v},$)`));
      const pset = e(`IFCPROPERTYSET('${guid(gid + ':pset')}',$,'Hojdkurvor_Byggnad',$,${lista3(eg)})`);
      e(`IFCRELDEFINESBYPROPERTIES('${guid(gid + ':relpset')}',$,$,$,(${proxy}),${pset})`);
      delar.push(proxy);
    }
    if (delar.length) e(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid(nyckel + ':innehall')}',$,$,$,${lista3(delar)},${site})`);

    const nu = new Date().toISOString().replace(/\.\d+Z$/, '');
    const huvud = [
      'ISO-10303-21;',
      'HEADER;',
      "FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');",
      `FILE_NAME(${text(opt.filnamn || 'byggnader.ifc')},'${nu}',(''),(''),${text(opt.kalla || 'höjdkurvor.se')},${text(opt.kalla || 'höjdkurvor.se')},'');`,
      "FILE_SCHEMA(('IFC4'));",
      'ENDSEC;',
      'DATA;',
    ];
    return { text: huvud.concat(rader, ['ENDSEC;', 'END-ISO-10303-21;']).join('\r\n') + '\r\n', antal: delar.length, utanHojd };
  }

  return { byggnader, guid, text, tal };
}));
