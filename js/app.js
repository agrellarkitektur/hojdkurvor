/* höjdkurvor.se – kartan och gränssnittet */
(function () {
  'use strict';
  /** Versionen den här filen hör till. Ska vara samma som i version.js (test/version.test.js kontrollerar). */
  const FILVERSION = '0.11.0';
  const VERSION = window.HOJDKURVOR ? window.HOJDKURVOR.version : FILVERSION;
  /**
   * Säger till när webbläsaren eller webbhotellet har gamla filer kvar, så att sidan blandar versioner.
   * Visas överst på sidan med en knapp som laddar om.
   */
  function varnaGamlaFiler(fil, version) {
    if (version === VERSION || document.getElementById('gamla-filer')) return;
    const d = document.createElement('div');
    d.id = 'gamla-filer'; d.className = 'gamla-filer'; d.setAttribute('role', 'alert');
    d.textContent = `Sidan har gamla filer (${fil} är version ${version || 'okänd'}, sidan ${VERSION}), så allt fungerar inte. `;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'knapp liten'; b.textContent = 'Ladda om';
    b.addEventListener('click', () => location.reload());
    d.append(b);
    document.body.prepend(d);
  }
  varnaGamlaFiler('app.js', FILVERSION);
  const T = window.Terrang;
  T.registreraZoner();

  const $ = id => document.getElementById(id);
  const fmt = (v, d = 0) => Number(v).toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MAX_AREA = 4e6, STOR_AREA = 1e6, STEG = 10;

  const state = {
    geo: null,          // ritat område som [[lat,lon] sv, [lat,lon] no]
    utsnitt: null,      // avrundat utsnitt i vald zon
    epsg: 3009,
    zonManuell: false,
    kommun: null,
    zipBlob: null,
    kommuner: null,
    bakgrund: 'osm',
    ortho: false,
    horPunkt: null,     // [lat, lon] för horisonten, annars utsnittets mitt
    skuggaVal: 0,
  };

  // ------------------------------------------------------------------
  // Lagring (fungerar även om webbläsaren spärrar den)
  // ------------------------------------------------------------------
  const lager = {
    las(typ, nyckel) { try { return JSON.parse(window[typ].getItem(nyckel)); } catch (e) { return null; } },
    spara(typ, nyckel, v) { try { window[typ].setItem(nyckel, JSON.stringify(v)); } catch (e) { /* ignoreras */ } },
    ta(typ, nyckel) { try { window[typ].removeItem(nyckel); } catch (e) { /* ignoreras */ } },
  };
  const farg = n => Tema.farg(n);

  // ------------------------------------------------------------------
  // Karta och bakgrunder
  // ------------------------------------------------------------------
  const KONF = window.TERRANG_KONFIG || {};
  const karta = L.map('karta', { zoomSnap: 0.5, preferCanvas: true, maxZoom: 19 }).fitBounds([[55.2, 10.9], [69.1, 24.2]]);
  const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bidragsgivare';
  const inloggning = () => { const a = $('anv').value.trim(), l = $('losen').value; return a && l ? T.basicAuth(a, l) : null; };
  const BAKGRUNDER = [
    { id: 'osm', namn: 'KARTA', skapa: () => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: OSM_ATTR }) },
    { id: 'otm', namn: 'TERRÄNG', skapa: () => L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      subdomains: 'abc', maxZoom: 19, maxNativeZoom: 17,
      attribution: `Kartdata: ${OSM_ATTR}, SRTM. Kartstil: © <a href="https://opentopomap.org">OpenTopoMap</a> (CC BY-SA)` }) },
    { id: 'lm', namn: 'LANTMÄTERIET' },
    { id: 'ingen', namn: 'INGEN', skapa: () => null },
  ];
  if (KONF.esriNyckel) {
    BAKGRUNDER.splice(3, 0, { id: 'foto', namn: 'FLYGFOTO', skapa: () => L.tileLayer(
      'https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=' + encodeURIComponent(KONF.esriNyckel),
      { maxZoom: 19, attribution: 'Powered by <a href="https://www.esri.com">Esri</a>. Källor: Esri, Maxar, Earthstar Geographics' }) });
  }
  const bakgrundCache = {};
  let bakgrundLager = null, lmAuth = null;
  function bakgrundFor(id) {
    if (id === 'lm') {
      const a = inloggning();
      if (!a) return undefined;
      if (!bakgrundCache.lm || lmAuth !== a) {
        bakgrundCache.lm = Topowebb.leafletLager(L, a, { omvandla: T.omvandlare(4326, 3006).forward, fel: kartfel });
        lmAuth = a;
      }
      return bakgrundCache.lm;
    }
    if (!(id in bakgrundCache)) bakgrundCache[id] = BAKGRUNDER.find(b => b.id === id).skapa();
    return bakgrundCache[id];
  }
  let senasteKartfel = 0;
  function kartfel(e) {
    if (Date.now() - senasteKartfel < 5000) return;
    senasteKartfel = Date.now();
    lagerpanelMeddelande(e instanceof T.InloggningsFel ? e.message : 'Lantmäteriets karta kunde inte visas: ' + e.message);
  }
  function valjBakgrund(id, tyst) {
    if (!BAKGRUNDER.some(b => b.id === id)) id = 'osm';
    const ny = bakgrundFor(id);
    if (ny === undefined) {
      if (!tyst) lagerpanelMeddelande('Fyll i inloggningen till Lantmäteriet (steg 01 Plats) för att visa deras karta.');
      if (state.bakgrund === id) id = 'osm'; else return false;
      return valjBakgrund(id, true);
    }
    if (bakgrundLager && bakgrundLager !== ny) bakgrundLager.remove();
    bakgrundLager = ny;
    if (ny && !karta.hasLayer(ny)) { ny.addTo(karta); ny.bringToBack(); }
    state.bakgrund = id;
    lager.spara('localStorage', 'terrang-bakgrund', id);
    ritaValjare();
    passar();
    return true;
  }

  // testkrok: skärmpunkt för en lat/lng (används av de automatiska testerna)
  window.__punkt = ll => { const p = karta.latLngToContainerPoint(ll), r = karta.getContainer().getBoundingClientRect(); return [r.left + p.x, r.top + p.y]; };
  const kurvRitare = L.canvas({ padding: 0.5 });

  const tillLatLng = (epsg) => {
    const f = T.omvandlare(epsg, 4326).forward;
    return p => { const [lon, lat] = f(p); return [lat, lon]; };
  };
  const franLatLng = (epsg) => {
    const f = T.omvandlare(4326, epsg).forward;
    return ([lat, lon]) => f([lon, lat]);
  };

  // --- kontroller: 90°-läge, skala med nordpil, lagerpanel
  const Knapp = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const d = L.DomUtil.create('div', 'leaflet-bar');
      const b = L.DomUtil.create('button', 'karta-knapp', d);
      b.type = 'button'; b.id = 'ortho'; b.textContent = '90°';
      b.title = 'Sektioner längs koordinataxlarna (eller håll in Shift)';
      b.setAttribute('aria-label', 'Ortogonalt läge: sektioner längs koordinataxlarna');
      b.setAttribute('aria-pressed', 'false');
      L.DomEvent.disableClickPropagation(d);
      L.DomEvent.on(b, 'click', () => { state.ortho = !state.ortho; b.setAttribute('aria-pressed', String(state.ortho)); });
      return d;
    },
  });
  new Knapp().addTo(karta);
  const SkalRuta = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd(m) {
      const d = L.DomUtil.create('div', 'skala-ruta');
      d.innerHTML = '<svg viewBox="0 0 16 28" role="img" aria-label="Norr uppåt"><path d="M8 2 L14 20 L8 16 L2 20 Z" fill="none" stroke="currentColor" stroke-width="1.3"/><text x="8" y="27" font-size="8" text-anchor="middle" fill="currentColor">N</text></svg>';
      const sk = L.control.scale({ imperial: false, maxWidth: 120 });
      sk._map = m;
      d.append(sk.onAdd(m));
      return d;
    },
  });
  new SkalRuta().addTo(karta);

  // --- resultatlager som visas på kartan och i utskriften
  // [id, namn, symbol, färg, grupp]
  const RES = [
    ['kurvor', 'Höjdkurvor', 'linje', 'sw-kurva', 'u'], ['hojdpunkter', 'Höjdpunkter', 'ring', 'annot', 'u'], ['byggnader', 'Byggnader', 'yta', 'sw-byggnad', 'u'], ['fastigheter', 'Fastighetsgränser', 'linje', 'sw-fastighet', 'u'], ['marktacke', 'Marktäcke', 'yta', 'sw-mark', 'u'], ['ortofoto', 'Ortofoto', 'yta', 'sw-orto', 'u'],
    ['hom', 'Höjd över mark', 'yta', 'sw-hom', 'u'], ['trad', 'Träd', 'ring', 'sw-trad', 'u'], ['stompunkter', 'Stompunkter', 'ring', 'sw-sp', 'u'],
    ['vagar', 'Vägar (OSM)', 'linje', 'sw-vag', 'u'], ['gangvagar', 'Gång- och cykelvägar (OSM)', 'linje', 'sw-vag-gang', 'u'], ['laser', 'Laserpunkter', 'yta', 'sw-skugga', 'u'],
    ['lutning', 'Lutning', 'yta', 'sw-lutning', 'a'], ['skyfall', 'Skyfall', 'yta', 'sw-skyfall', 'a'], ['skugga', 'Skugga', 'yta', 'sw-skugga', 'a'],
    ['lamningar', 'Lämningar (RAÄ)', 'ring', 'sw-lamning', 'a'], ['natur', 'Skyddad natur', 'linje', 'sw-natur', 'a'], ['oversvamning', 'Översvämning', 'yta', 'sw-skyfall', 'a'],
  ];
  const GRUPPER = { u: 'UNDERLAG', a: 'ANALYS', s: 'SKISS' };
  const TRAD_VID_HUS = 1;   // meter: träd så nära en byggnad räknas som byggnaden
  const UTSKRIVBARA = new Set(['ortofoto', 'kurvor', 'byggnader', 'fastigheter', 'marktacke', 'hom', 'skugga', 'trad', 'stompunkter', 'vagar', 'gangvagar', 'sektioner', 'hojdpunkter', 'lutning', 'skyfall', 'volymer']);
  const resultat = {};
  karta.createPane('ortofotoPane').style.zIndex = 350;      // under kurvor och andra resultat
  const dolda = new Set(lager.las('localStorage', 'terrang-dolda-lager') || []);
  const synlig = id => !dolda.has(id);
  function visaResultatLager(id, lagerObj, stil) {
    if (resultat[id]) { resultat[id].lager.remove(); delete resultat[id]; }
    if (lagerObj) {
      resultat[id] = { lager: lagerObj, stil };
      if (synlig(id)) lagerObj.addTo(karta);
    }
    ritaLagerlista();
  }
  function satSynlig(id, pa) {
    if (pa) dolda.delete(id); else dolda.add(id);
    lager.spara('localStorage', 'terrang-dolda-lager', [...dolda]);
    const o = id === 'sektioner' ? sektionLager : id === 'volymer' ? volymLager : resultat[id] && resultat[id].lager;
    if (o) { if (pa) o.addTo(karta); else o.remove(); }
  }

  // --- lagerpanelen
  const Lagerpanel = L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
      const d = L.DomUtil.create('section', 'lagerpanel');
      d.setAttribute('aria-label', 'Karta och lager');
      d.innerHTML = `
        <div class="rubrikrad"><h2>KARTA OCH LAGER</h2><button type="button" class="fall" id="lp-fall" aria-expanded="true" aria-controls="lp-innehall">Dölj</button></div>
        <div class="innehall" id="lp-innehall">
          <span class="etikett" id="lp-bg-r">BAKGRUND</span>
          <div class="seg fyra" role="radiogroup" aria-labelledby="lp-bg-r" id="lp-bakgrund"></div>
          <p class="hjalp" id="lp-medd" hidden></p>
          <span class="etikett">LAGER</span>
          <div class="lager-lista" id="lp-lager"></div>
          <button type="button" class="knapp" id="lp-skriv" aria-expanded="false" aria-controls="lp-utskrift" disabled>SKRIV UT I SKALA</button>
          <div class="utskriftsruta" id="lp-utskrift" hidden>
            <div class="falt-rad"><label for="pr-format">Format</label>
              <select id="pr-format"><option value="a4">A4</option><option value="a3" selected>A3</option><option value="a2">A2</option><option value="a1">A1</option></select></div>
            <div class="falt-rad"><label for="pr-orient">Riktning</label>
              <select id="pr-orient"><option value="1">Liggande</option><option value="0">Stående</option></select></div>
            <div class="falt-rad"><label for="pr-skala">Skala</label>
              <select id="pr-skala"><option value="100">1:100</option><option value="200">1:200</option><option value="250">1:250</option><option value="400">1:400</option><option value="500">1:500</option><option value="1000">1:1000</option><option value="2000">1:2000</option><option value="5000">1:5000</option></select></div>
            <div class="falt-rad" id="pr-bg-rad" hidden><label for="pr-bg">Bakgrund</label>
              <select id="pr-bg"><option value="farg">Nedtonad</option><option value="gra">Gråskala</option><option value="ingen">Full färg</option></select></div>
            <label class="kryss"><input type="checkbox" id="pr-siffror" checked> Höjdsiffror</label>
            <label class="kryss"><input type="checkbox" id="pr-rutnat" checked> Koordinatkryss</label>
            <label class="kryss"><input type="checkbox" id="pr-noll" checked> Nollpunkt</label>
            <p class="hjalp" id="pr-passar"></p>
            <p class="hjalp" id="pr-bg-info"></p>
            <button type="button" class="knapp primar" id="pr-skapa">SKAPA PDF</button>
            <p class="hjalp">Utskriften visar lagren som är på. Skriv ut i verklig storlek (100 %).</p>
          </div>
        </div>`;
      L.DomEvent.disableClickPropagation(d);
      L.DomEvent.disableScrollPropagation(d);
      return d;
    },
  });
  const lagerpanel = new Lagerpanel().addTo(karta).getContainer();
  const panelHojd = () => { lagerpanel.style.maxHeight = Math.max(160, karta.getSize().y - 50) + 'px'; };
  panelHojd(); karta.on('resize', panelHojd);
  if (window.innerWidth < 760) { lagerpanel.classList.add('ihop'); $('lp-fall').textContent = 'Visa'; $('lp-fall').setAttribute('aria-expanded', 'false'); }
  $('lp-fall').addEventListener('click', () => {
    const ihop = lagerpanel.classList.toggle('ihop');
    $('lp-fall').textContent = ihop ? 'Visa' : 'Dölj';
    $('lp-fall').setAttribute('aria-expanded', String(!ihop));
  });
  function lagerpanelMeddelande(t) {
    const p = $('lp-medd');
    p.textContent = t || ''; p.hidden = !t;
    if (t) { lagerpanel.classList.remove('ihop'); setTimeout(() => { if (p.textContent === t) p.hidden = true; }, 9000); }
  }
  function segKnappar(el, val, aktiv, vid) {
    el.innerHTML = '';
    val.forEach(([id, namn]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(id === aktiv)); b.textContent = namn;
      b.addEventListener('click', () => vid(id));
      el.append(b);
    });
  }
  function ritaValjare() {
    segKnappar($('lp-bakgrund'), BAKGRUNDER.map(b => [b.id, b.namn]), state.bakgrund, id => valjBakgrund(id));
  }
  function ritaLagerlista() {
    const el = $('lp-lager');
    el.innerHTML = '';
    const rader = RES.filter(([id]) => resultat[id]);
    if (state.sektioner && state.sektioner.length) rader.push(['sektioner', 'Sektioner', 'linje', 'annot', 'u']);
    if (state.volymer && state.volymer.length) rader.push(['volymer', 'Volymer', 'yta', 'annot', 's']);
    if (!rader.length) { el.innerHTML = '<p class="tom">Lagren visas här när underlaget är skapat.</p>'; }
    rader.sort((a, b) => 'uas'.indexOf(a[4]) - 'uas'.indexOf(b[4]));
    let grupp = null;
    for (const [id, namn, form, sw, gr] of rader) {
      if (gr !== grupp) {
        grupp = gr;
        const h = document.createElement('span'); h.className = 'etikett lager-grupp'; h.textContent = GRUPPER[gr];
        el.append(h);
      }
      const rad = document.createElement('div');
      rad.className = 'lager-rad';
      rad.innerHTML = `<label><input type="checkbox" ${synlig(id) ? 'checked' : ''}><span class="sw ${form}" style="${form === 'yta' ? 'background' : form === 'linje' ? 'border-top-color' : 'border-color'}: var(--${sw})"></span>${esc(namn)}</label>`;
      rad.querySelector('input').addEventListener('change', e => satSynlig(id, e.target.checked));
      if (id === 'skugga' && state.senaste && state.senaste.skuggor && state.senaste.skuggor.length > 1) {
        const sel = document.createElement('select');
        sel.setAttribute('aria-label', 'Tidpunkt för skuggan');
        state.senaste.skuggor.forEach((t, i) => {
          const o = document.createElement('option');
          o.value = i; o.textContent = `${KORT_DATUM[t.k]} ${t.etikett.replace(':', '.')}`; o.selected = i === state.skuggaVal;
          sel.append(o);
        });
        sel.addEventListener('change', () => { state.skuggaVal = +sel.value; visaSkugga(); });
        rad.append(sel);
      }
      el.append(rad);
    }
    $('lp-skriv').disabled = !state.senaste;
  }
  const KORT_DATUM = { mars: '20 mar', juni: '21 jun', sept: '23 sep', dec: '21 dec' };
  document.addEventListener('temabyte', () => {
    ritaValjare();
    if (utsnittLager) utsnittLager.setStyle({ color: farg('ram') });
    ritaSektioner();
    Object.values(resultat).forEach(r => { if (r.stil) r.stil(); });
  });
  // ------------------------------------------------------------------
  // Koordinatsystem
  // ------------------------------------------------------------------
  const zonVal = $('zon');
  [...T.ZONER.filter(z => z.epsg !== 3006).sort((a, b) => a.lon0 - b.lon0), T.zon(3006)].forEach(z => {
    const o = document.createElement('option');
    o.value = z.epsg;
    o.textContent = z.epsg === 3006 ? 'SWEREF 99 TM (rikstäckande)' : z.namn;
    zonVal.append(o);
  });
  zonVal.value = state.epsg;

  fetch('data/kommuner.json').then(r => r.json()).then(d => { state.kommuner = d.features; }).catch(() => {});

  function iRing(pt, ring) {
    let inne = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inne = !inne;
    }
    return inne;
  }
  function hittaKommun(lon, lat) {
    if (!state.kommuner) return null;
    for (const f of state.kommuner) {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const p of polys) {
        if (iRing([lon, lat], p[0]) && !p.slice(1).some(h => iRing([lon, lat], h))) return f.properties;
      }
    }
    return null;
  }

  /** Kommunkoder som utsnittet berör (hörn, kantmitter och mitt). */
  function kommunerIUtsnitt() {
    if (!state.utsnitt || !state.kommuner) return [];
    const r = state.utsnitt, t = tillLatLng(state.epsg), koder = new Set();
    const xs = [r.xmin, (r.xmin + r.xmax) / 2, r.xmax], ys = [r.ymin, (r.ymin + r.ymax) / 2, r.ymax];
    xs.forEach(x => ys.forEach(y => {
      const [lat, lon] = t([x, y]);
      const k = hittaKommun(lon, lat);
      if (k) koder.add(k.kod);
    }));
    return [...koder];
  }

  /** Uppdaterar kommunen efter inskrivna koordinater, utan att byta koordinatsystem. */
  function uppdateraKommun() {
    const [s0, w0] = state.geo[0], [n0, e0] = state.geo[1];
    const k = hittaKommun((w0 + e0) / 2, (s0 + n0) / 2);
    state.kommun = k;
    if (k && k.epsg && k.epsg !== state.epsg)
      $('zon-hjalp').textContent = `Området ligger i ${k.namn} kommun, som normalt använder ${T.zon(k.epsg).namn}. Kontrollera mot grundkartan.`;
    else if (k && k.epsg) $('zon-hjalp').textContent = `${T.zon(state.epsg).namn} är förslaget för ${k.namn} kommun. Kontrollera mot grundkartan.`;
  }

  function foreslaZon(lat, lon) {
    const k = hittaKommun(lon, lat);
    const forra = state.kommun && state.kommun.namn;
    state.kommun = k;
    let epsg, text;
    if (k && k.epsg) {
      epsg = k.epsg;
      text = `Förslag för ${k.namn} kommun. Kontrollera mot kommunens grundkarta.`;
    } else if (k) {
      epsg = T.narmasteZon(lon, [3015, 3016, 3017, 3018]);
      text = `${k.namn} kommun använder flera zoner. Det här är zonen närmast platsen – kontrollera mot grundkartan.`;
    } else {
      epsg = T.narmasteZon(lon);
      text = 'Kunde inte avgöra kommunen. Zonen närmast platsen är vald – kontrollera mot grundkartan.';
    }
    if (!state.zonManuell || (k && k.namn) !== forra) {
      state.zonManuell = false;
      state.epsg = epsg;
      zonVal.value = epsg;
      $('zon-hjalp').textContent = text;
    }
  }

  zonVal.addEventListener('change', () => {
    state.zonManuell = true;
    state.epsg = Number(zonVal.value);
    $('zon-hjalp').textContent = state.kommun && state.kommun.epsg && state.kommun.epsg !== state.epsg
      ? `Du har valt ett annat system än förslaget för ${state.kommun.namn} kommun (${T.zon(state.kommun.epsg).namn}).`
      : 'Valt manuellt.';
    if (state.geo) beraknaUtsnitt();
  });

  // ------------------------------------------------------------------
  // Utsnitt
  // ------------------------------------------------------------------
  function beraknaUtsnitt() {
    const f = franLatLng(state.epsg);
    const [s, w] = state.geo[0], [n, e] = state.geo[1];
    const pts = [[s, w], [s, e], [n, e], [n, w]].map(f);
    state.utsnitt = T.avrunda({
      xmin: Math.min(...pts.map(p => p[0])), xmax: Math.max(...pts.map(p => p[0])),
      ymin: Math.min(...pts.map(p => p[1])), ymax: Math.max(...pts.map(p => p[1])),
    }, STEG);
    visaUtsnitt();
  }

  function satGeoFranUtsnitt() {
    const t = tillLatLng(state.epsg), r = state.utsnitt;
    const pts = [[r.xmin, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax], [r.xmax, r.ymin]].map(t);
    state.geo = [[Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1]))],
                 [Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]];
  }

  // --- grafik: ram, handtag, kryssruta, mått och nollpunkt
  let utsnittLager = null, stangMarkor = null, nollMarkor = null;
  const handtag = {}, matt = {};
  const svgHandtag = v => v
    ? '<svg viewBox="0 0 12 20" aria-hidden="true"><path d="M3 7.5 l3 -3 l3 3 M3 12.5 l3 3 l3 -3"/></svg>'
    : '<svg viewBox="0 0 20 12" aria-hidden="true"><path d="M7.5 3 l-3 3 l3 3 M12.5 3 l3 3 l-3 3"/></svg>';
  function nyttHandtag(kant) {
    const v = kant === 'n' || kant === 's';
    const m = L.marker([0, 0], {
      draggable: true, keyboard: false, zIndexOffset: 1000, title: 'Dra för att ändra storleken',
      icon: L.divIcon({ className: 'handtag-wrap ' + (v ? 'ns' : 'ew'), html: `<div class="handtag ${v ? 'v' : 'h'}">${svgHandtag(v)}</div>`, iconSize: v ? [24, 30] : [30, 24], iconAnchor: v ? [12, 15] : [15, 12] }),
    });
    m.on('drag', e => {
      const [x, y] = franLatLng(state.epsg)([e.latlng.lat, e.latlng.lng]);
      const r = { ...state.utsnitt }, snap = q => Math.round(q / STEG) * STEG;
      if (kant === 'n') r.ymax = Math.max(r.ymin + STEG, snap(y));
      if (kant === 's') r.ymin = Math.min(r.ymax - STEG, snap(y));
      if (kant === 'o') r.xmax = Math.max(r.xmin + STEG, snap(x));
      if (kant === 'v') r.xmin = Math.min(r.xmax - STEG, snap(x));
      state.utsnitt = r;
      ritaUtsnittsGrafik(kant);
      $('storlek-text').textContent = `${fmt(r.xmax - r.xmin)} × ${fmt(r.ymax - r.ymin)} m`;
      visaLatLon();
    });
    m.on('dragend', () => { satGeoFranUtsnitt(); uppdateraKommun(); visaUtsnitt(); });
    return m;
  }
  function rensaUtsnittsGrafik() {
    [utsnittLager, stangMarkor, nollMarkor, ...Object.values(handtag), ...Object.values(matt)].forEach(o => { if (o) o.remove(); });
  }
  /** Ritar ram, handtag, kryssruta, mått och nollpunkt. utom = handtaget som dras just nu. */
  function ritaUtsnittsGrafik(utom) {
    const r = state.utsnitt;
    if (!r) { rensaUtsnittsGrafik(); return; }
    const t = tillLatLng(state.epsg);
    const poly = T.kantlinje(r).map(t);
    if (!utsnittLager) utsnittLager = L.polygon(poly, { color: farg('ram'), weight: 1.2, fill: false, interactive: false });
    else utsnittLager.setLatLngs(poly).setStyle({ color: farg('ram') });
    if (!karta.hasLayer(utsnittLager)) utsnittLager.addTo(karta);
    const mx = (r.xmin + r.xmax) / 2, my = (r.ymin + r.ymax) / 2;
    const pos = { n: [mx, r.ymax], s: [mx, r.ymin], v: [r.xmin, my], o: [r.xmax, my] };
    for (const k of ['n', 's', 'v', 'o']) {
      if (!handtag[k]) handtag[k] = nyttHandtag(k);
      if (k !== utom) handtag[k].setLatLng(t(pos[k]));
      if (!karta.hasLayer(handtag[k])) handtag[k].addTo(karta);
    }
    // kryssrutan sitter i ramens övre högra innerhörn
    if (!stangMarkor) {
      stangMarkor = L.marker([0, 0], {
        keyboard: false, zIndexOffset: 1100, title: 'Ta bort markeringen',
        icon: L.divIcon({ className: '', html: '<button type="button" class="stang-utsnitt" aria-label="Ta bort markeringen"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5 l7 7 M8.5 1.5 l-7 7"/></svg></button>', iconSize: [16, 16], iconAnchor: [16, 0] }),
      });
      stangMarkor.on('click', rensaUtsnitt);
    }
    stangMarkor.setLatLng(t([r.xmax, r.ymax]));
    if (!karta.hasLayer(stangMarkor)) stangMarkor.addTo(karta);
    // mått utan decimaler: bredden ovanför ramen, höjden till höger
    const mattIkon = (txt, klass) => L.divIcon({ className: '', html: `<span class="matt ${klass}">${txt}</span>`, iconSize: [0, 0] });
    if (!matt.b) matt.b = L.marker([0, 0], { interactive: false, keyboard: false });
    if (!matt.h) matt.h = L.marker([0, 0], { interactive: false, keyboard: false });
    matt.b.setIcon(mattIkon(fmt(r.xmax - r.xmin), 'ovan')).setLatLng(t([mx, r.ymax]));
    matt.h.setIcon(mattIkon(fmt(r.ymax - r.ymin), 'hoger')).setLatLng(t([r.xmax, my]));
    [matt.b, matt.h].forEach(m => { if (!karta.hasLayer(m)) m.addTo(karta); });
    ritaNollpunkt();
  }
  /** Nollpunkten: hårkors i ring och koordinaterna på två rader. */
  function ritaNollpunkt() {
    if (!state.utsnitt) { if (nollMarkor) nollMarkor.remove(); return; }
    const np = lasNollpunkt();
    const x = np.ok && np.varde ? np.varde.x : state.utsnitt.xmin, y = np.ok && np.varde ? np.varde.y : state.utsnitt.ymin;
    const ikon = L.divIcon({
      className: '', iconSize: [30, 30], iconAnchor: [15, 15],
      html: `<div class="nollpunkt" title="Lokal nollpunkt"><svg viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="6"/><path d="M1 15 H29 M15 1 V29"/></svg><div class="text">X = ${fmt(x, x % 1 ? 3 : 0)}<br>Y = ${fmt(y, y % 1 ? 3 : 0)}</div></div>`,
    });
    if (!nollMarkor) nollMarkor = L.marker([0, 0], { interactive: false, keyboard: false, zIndexOffset: 500 });
    nollMarkor.setIcon(ikon).setLatLng(tillLatLng(state.epsg)([x, y]));
    if (!karta.hasLayer(nollMarkor)) nollMarkor.addTo(karta);
  }
  function rensaUtsnitt() {
    state.utsnitt = null; state.geo = null;
    $('koord-kopiera').hidden = true;
    $('kopiera-projektlank').disabled = true;
    rensaUtsnittsGrafik();
    nollstallResultat();
    $('utsnitt').hidden = true;
    $('ladda-sol').disabled = true;
    $('skapa').disabled = true;
    $('steg-omrade').classList.remove('klar');
    ritKnapp.textContent = 'Rita område på kartan';
    visaStatus('Välj ett område för att börja.');
  }

  function visaUtsnitt() {
    const r = state.utsnitt;
    if (!r) return;
    ritaUtsnittsGrafik();
    $('koord-kopiera').hidden = false;
    sparaUtsnittForBestallning();
    $('kopiera-projektlank').disabled = false;
    if (typeof uppdateraMobil === 'function') setTimeout(uppdateraMobil, 0);
    const b = r.xmax - r.xmin, h = r.ymax - r.ymin;
    $('utsnitt').hidden = false;
    $('ladda-sol').disabled = false;
    if (!ritar) ritKnapp.textContent = 'Rita om området';
    $('steg-omrade').classList.add('klar');
    $('steg-zon').classList.add('klar');
    $('zon-namn-kort').textContent = T.zon(state.epsg).namn;
    $('np-hjalp').textContent = `Ange projektets nollpunkt i ${T.zon(state.epsg).namn}. Z dras av från alla höjder i de lokala filerna, så att till exempel färdigt golv kan bli 0.`;
    ['xmin', 'xmax', 'ymin', 'ymax'].forEach(k => { $(k).value = r[k]; });
    const area = b * h;
    $('storlek-text').textContent = `${fmt(b)} × ${fmt(h)} m` + (area >= 1e6 ? ` (${fmt(area / 1e6, 2)} km²)` : '') + (state.kommun ? `  ·  ${state.kommun.namn}` : '');
    visaLatLon();
    nollstallResultat();
    if (area > MAX_AREA) {
      visaStatus(`Området är för stort. Högst ${fmt(MAX_AREA / 1e6)} km² går att hämta på en gång.`, true);
      $('skapa').disabled = true;
    } else {
      visaStatus(area > STOR_AREA ? 'Stort område – det kan ta en halv minut eller mer.' : 'Klart att skapa underlag.');
      $('skapa').disabled = false;
    }
  }

  ['xmin', 'xmax', 'ymin', 'ymax'].forEach(k => $(k).addEventListener('change', () => {
    const v = {};
    for (const n of ['xmin', 'xmax', 'ymin', 'ymax']) {
      v[n] = parseFloat(String($(n).value).replace(',', '.').replace(/\s/g, ''));
      if (!isFinite(v[n])) { visaUtsnitt(); return; }
    }
    if (v.xmax < v.xmin) [v.xmin, v.xmax] = [v.xmax, v.xmin];
    if (v.ymax < v.ymin) [v.ymin, v.ymax] = [v.ymax, v.ymin];
    state.utsnitt = T.avrunda(v, STEG);
    satGeoFranUtsnitt();
    uppdateraKommun();
    visaUtsnitt();
    visaPaKartan();
  }));

  let visaTimer = 0;
  function visaPaKartan() {
    clearTimeout(visaTimer);
    visaTimer = setTimeout(passaKartan, 250);
  }
  function passaKartan() {
    karta.stop();
    if (utsnittLager) karta.fitBounds(utsnittLager.getBounds(), { paddingTopLeft: [70, 60], paddingBottomRight: [60 + panelBredd(), 60], maxZoom: 18 });
  }
  /** Hur mycket av kartans högra del lagerpanelen täcker. */
  function panelBredd() {
    const p = document.querySelector('.lagerpanel');
    if (!p) return 0;
    const k = karta.getContainer().getBoundingClientRect(), r = p.getBoundingClientRect();
    if (!r.width || r.height > k.height * 0.9) return 0;
    const w = k.right - r.left;
    return w > 0 && w < k.width * 0.5 ? w : 0;
  }

  // --- kopiera och klistra in hörnens koordinater
  function koordinatText() {
    const r = state.utsnitt, projekt = $('projekt').value.trim();
    return [projekt ? `höjdkurvor.se – ${projekt}` : 'höjdkurvor.se', `${T.zon(state.epsg).namn} (EPSG:${state.epsg})`,
      `Väst ${r.xmin}`, `Öst ${r.xmax}`, `Syd ${r.ymin}`, `Nord ${r.ymax}`].join('\n');
  }
  /** Sparar utsnittet så att sidan Beställ kan hämta det. */
  function sparaUtsnittForBestallning() {
    if (!state.utsnitt) return;
    lager.spara('localStorage', 'terrang-utsnitt', { epsg: state.epsg, system: T.zon(state.epsg).namn, r: state.utsnitt,
      projekt: $('projekt').value.trim(), kommun: state.kommun ? state.kommun.namn : '', text: koordinatText() });
  }
  $('projekt').addEventListener('change', sparaUtsnittForBestallning);
  /** Läser väst, öst, syd och nord ur fri text. Östvärden är under 5 000 000 och nordvärden över, så ordningen spelar ingen roll. */
  function lasKoordinater(text) {
    let epsg = null;
    const e = /EPSG\s*:?\s*(\d{4})/i.exec(text);
    if (e && T.ZONER.some(z => z.epsg === +e[1])) epsg = +e[1];
    if (!epsg) {
      const n = /SWEREF\s*99\s*(TM|\d{2}\s?\d{2})/i.exec(text);
      if (n) {
        const k = n[1].replace(/\s/g, '').toUpperCase();
        const z = T.ZONER.find(z => z.namn.replace(/\s/g, '').toUpperCase() === 'SWEREF99' + k);
        if (z) epsg = z.epsg;
      }
    }
    const tal = (text.replace(/EPSG\s*:?\s*\d{4}/gi, ' ').match(/\d{1,3}(?:[  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g) || [])
      .map(t => parseFloat(t.replace(/[  ]/g, '').replace(',', '.'))).filter(v => v >= 10000);
    const ost = tal.filter(v => v < 5e6), nord = tal.filter(v => v >= 5e6);
    if (ost.length < 2 || nord.length < 2) return null;
    return { epsg, xmin: Math.min(ost[0], ost[1]), xmax: Math.max(ost[0], ost[1]), ymin: Math.min(nord[0], nord[1]), ymax: Math.max(nord[0], nord[1]) };
  }
  /** Ställer in utsnittet efter tolkade koordinater k i systemet epsg. */
  function anvandKoordinater(k, epsg) {
    if (epsg !== state.epsg) {
      state.epsg = epsg; zonVal.value = epsg;
    }
    state.zonManuell = true;
    $('zon-hjalp').textContent = `${T.zon(epsg).namn}, valt när koordinaterna klistrades in.`;
    for (const n of ['xmin', 'xmax', 'ymin', 'ymax']) $(n).value = k[n];
    $('xmin').dispatchEvent(new Event('change'));   // uppdaterar kommunen och säger till om systemet inte är kommunens
    $('koord-status').textContent = `Koordinaterna är inklistrade i ${T.zon(epsg).namn}.`;
  }
  async function kopieraText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* reserv nedan */ }
    const t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.append(t); t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    t.remove();
    return ok;
  }
  $('koord-kopiera').addEventListener('click', async () => {
    if (!state.utsnitt) return;
    const ok = await kopieraText(koordinatText());
    $('koord-status').textContent = ok ? 'Hörnens koordinater är kopierade.' : 'Kunde inte kopiera. Markera koordinaterna ovan och kopiera dem för hand.';
  });
  // --- dialogen Klistra in koordinater: text, kommun och koordinatsystem (0.7.0)
  const kd = { dlg: $('koorddialog'), k: null, kand: [] };
  [...T.ZONER.filter(z => z.epsg !== 3006).sort((a, b) => a.lon0 - b.lon0), T.zon(3006)].forEach(z => {
    const o = document.createElement('option');
    o.value = z.epsg; o.textContent = z.epsg === 3006 ? 'SWEREF 99 TM (rikstäckande)' : z.namn;
    $('kd-zon').append(o);
  });
  const sifferText = v => fmt(Math.round(v));
  /** Var mitten av de tolkade koordinaterna hamnar i det valda systemet. */
  function kdKontroll() {
    const k = kd.k, epsg = Number($('kd-zon').value), ut = $('kd-kontroll');
    $('kd-ok').disabled = !k;
    if (!k) { ut.textContent = ''; return; }
    const rad = T.tolkaZon((k.xmin + k.xmax) / 2, (k.ymin + k.ymax) / 2, hittaKommun).find(t => t.epsg === epsg);
    const namn = T.zon(epsg).namn;
    if (!state.kommuner) ut.textContent = `Läser in kommungränserna … Kontrollera att ${namn} stämmer.`;
    else if (!rad || !rad.kommun) ut.textContent = `I ${namn} hamnar området utanför Sveriges kommuner. Koordinaterna hör troligen till ett annat system.`;
    else if (rad.passar) ut.textContent = `I ${namn} hamnar området i ${rad.kommun.namn} kommun, som normalt använder just det systemet.`;
    else if (rad.kommun.epsg) ut.textContent = `I ${namn} hamnar området i ${rad.kommun.namn} kommun, som normalt använder ${T.zon(rad.kommun.epsg).namn}. Kontrollera att systemet stämmer.`;
    else ut.textContent = `I ${namn} hamnar området i ${rad.kommun.namn} kommun, som använder flera zoner. Kontrollera att systemet stämmer.`;
    const andra = (kd.kand || []).filter(t => t.epsg !== epsg);
    if (andra.length) ut.textContent += ` Koordinaterna passar också ${andra.map(t => `${T.zon(t.epsg).namn} (${t.kommun.namn} kommun)`).join(' och ')}. Välj den kommun som gäller.`;
  }
  /** Tolkar texten och föreslår system: det som står i texten, annars ett som passar kommunen där området hamnar. */
  function kdTolka() {
    const text = $('kd-text').value, k = text.trim() ? lasKoordinater(text) : null;
    kd.k = k; kd.kand = [];
    if (!k) {
      $('kd-tolkat').textContent = text.trim() ? 'Hittade inte fyra koordinater i texten. Två östvärden och två nordvärden behövs.'
        : 'Klistra in med Ctrl+V (Cmd+V på Mac). Två östvärden och två nordvärden behövs.';
      kdKontroll();
      return;
    }
    $('kd-tolkat').textContent = `Väst ${sifferText(k.xmin)}, öst ${sifferText(k.xmax)}, syd ${sifferText(k.ymin)}, nord ${sifferText(k.ymax)}: ${fmt(k.xmax - k.xmin)} × ${fmt(k.ymax - k.ymin)} m.`;
    let epsg = k.epsg, kommun = null;
    kd.kand = state.kommuner ? T.tolkaZon((k.xmin + k.xmax) / 2, (k.ymin + k.ymax) / 2, hittaKommun).filter(t => t.passar && t.epsg !== 3006) : [];
    if (!epsg && kd.kand.length) {
      const kand = kd.kand;
      const val = kand.find(t => state.kommun && t.kommun.kod === state.kommun.kod) || kand.find(t => t.epsg === state.epsg) || kand[0];
      if (val) { epsg = val.epsg; kommun = val.kommun; }
    }
    if (epsg) {
      $('kd-zon').value = epsg;
      if (!kommun) { const rad = T.tolkaZon((k.xmin + k.xmax) / 2, (k.ymin + k.ymax) / 2, hittaKommun).find(t => t.epsg === epsg); kommun = rad && rad.kommun; }
      $('kd-kommun').value = kommun ? kommun.kod : '';
    }
    kdKontroll();
    if (k.epsg) $('kd-kontroll').textContent = `${T.zon(k.epsg).namn} står i texten. ` + $('kd-kontroll').textContent;
  }
  function oppnaKoordDialog(text) {
    if (!$('kd-kommun').options[1] && state.kommuner) {
      [...state.kommuner].map(f => f.properties).sort((a, b) => a.namn.localeCompare(b.namn, 'sv')).forEach(p => {
        const o = document.createElement('option');
        o.value = p.kod; o.textContent = p.namn;
        $('kd-kommun').append(o);
      });
    }
    $('kd-zon').value = state.epsg;
    $('kd-kommun').value = state.kommun ? state.kommun.kod : '';
    $('kd-text').value = text || '';
    kdTolka();
    kd.dlg.showModal();
    $('kd-text').focus();
  }
  $('kd-text').addEventListener('input', kdTolka);
  $('kd-zon').addEventListener('change', kdKontroll);
  $('kd-kommun').addEventListener('change', () => {
    const f = (state.kommuner || []).find(f => f.properties.kod === $('kd-kommun').value);
    if (f && f.properties.epsg) $('kd-zon').value = f.properties.epsg;
    kdKontroll();
    if (f && !f.properties.epsg) $('kd-kontroll').textContent = `${f.properties.namn} kommun använder flera zoner. Välj systemet nedan. ` + $('kd-kontroll').textContent;
  });
  kd.dlg.addEventListener('click', e => { if (e.target === kd.dlg || e.target.closest('[data-kd-avbryt]')) kd.dlg.close(); });
  kd.dlg.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    if (!kd.k) return;
    anvandKoordinater(kd.k, Number($('kd-zon').value));
    kd.dlg.close();
  });
  kd.dlg.addEventListener('close', () => $('koord-klistra').focus());
  $('koord-klistra').addEventListener('click', async () => {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch (e) { text = ''; }
    oppnaKoordDialog(text && lasKoordinater(text) ? text : '');
  });
  // klistrar man in alla fyra värden i ett av fälten öppnas dialogen med dem
  ['xmin', 'xmax', 'ymin', 'ymax'].forEach(n => $(n).addEventListener('paste', e => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (text && lasKoordinater(text)) { e.preventDefault(); oppnaKoordDialog(text); }
  }));

  function nyttOmrade(sv, no) {
    state.geo = [sv, no];
    foreslaZon((sv[0] + no[0]) / 2, (sv[1] + no[1]) / 2);
    beraknaUtsnitt();
  }

  // Rita rektangel
  const ritKnapp = $('rita');
  let ritar = false, start = null, tillfallig = null;
  function satRitlage(pa) {
    ritar = pa;
    ritKnapp.setAttribute('aria-pressed', String(pa));
    ritKnapp.textContent = pa ? 'Avbryt ritning' : (state.utsnitt ? 'Rita om området' : 'Rita område på kartan');
    document.body.classList.toggle('ritlage', pa);
    if (pa) karta.dragging.disable(); else karta.dragging.enable();
    // på pekskärm ska fingret rita, inte rulla sidan
    karta.getContainer().style.touchAction = pa ? 'none' : '';
  }
  ritKnapp.addEventListener('click', () => satRitlage(!ritar));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ritar) satRitlage(false); });

  const kartBehallare = karta.getContainer();
  kartBehallare.addEventListener('pointerdown', e => {
    if (!ritar || e.button !== 0) return;
    if (e.target.closest('.leaflet-control')) return;
    e.preventDefault();
    kartBehallare.setPointerCapture(e.pointerId);
    start = karta.mouseEventToLatLng(e);
    tillfallig = L.rectangle([start, start], { color: farg('ram'), weight: 1.2, dashArray: '5 4', fillOpacity: 0.04, interactive: false }).addTo(karta);
  });
  kartBehallare.addEventListener('pointermove', e => {
    if (!ritar || !start || !tillfallig) return;
    tillfallig.setBounds([start, karta.mouseEventToLatLng(e)]);
  });
  kartBehallare.addEventListener('pointerup', e => {
    if (!ritar || !start) return;
    const slut = karta.mouseEventToLatLng(e);
    const p0 = karta.latLngToContainerPoint(start), p1 = karta.latLngToContainerPoint(slut);
    if (tillfallig) { tillfallig.remove(); tillfallig = null; }
    const s0 = start; start = null;
    if (Math.abs(p0.x - p1.x) < 6 || Math.abs(p0.y - p1.y) < 6) return;   // för litet, fortsätt rita
    satRitlage(false);
    nyttOmrade([Math.min(s0.lat, slut.lat), Math.min(s0.lng, slut.lng)],
               [Math.max(s0.lat, slut.lat), Math.max(s0.lng, slut.lng)]);
  });

  // ------------------------------------------------------------------
  // Adressök (Nominatim)
  // ------------------------------------------------------------------
  $('sok').addEventListener('submit', async e => {
    e.preventDefault();
    const q = $('sok-text').value.trim();
    const lista = $('sokresultat');
    if (!q) return;
    lista.hidden = false;
    lista.innerHTML = '<li><button type="button" disabled>Söker …</button></li>';
    try {
      const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=se&limit=6&accept-language=sv&q=' + encodeURIComponent(q);
      const svar = await (await fetch(url)).json();
      lista.innerHTML = '';
      if (!svar.length) { lista.innerHTML = '<li><button type="button" disabled>Inga träffar. Prova med ort eller gatuadress.</button></li>'; return; }
      svar.forEach(t => {
        const li = document.createElement('li'), b = document.createElement('button');
        b.type = 'button';
        b.textContent = t.display_name;
        b.addEventListener('click', () => {
          const bb = t.boundingbox.map(Number);
          const liten = Math.abs(bb[1] - bb[0]) < 0.003;
          if (liten) karta.setView([+t.lat, +t.lon], 17);
          else karta.fitBounds([[bb[0], bb[2]], [bb[1], bb[3]]], { maxZoom: 17 });
          lista.hidden = true;
          if (!state.utsnitt) satRitlage(true);
        });
        li.append(b); lista.append(li);
      });
    } catch (err) {
      lista.innerHTML = '<li><button type="button" disabled>Sökningen fungerade inte just nu. Zooma in på kartan i stället.</button></li>';
    }
  });

  // ------------------------------------------------------------------
  // Inställningar och inloggning
  // ------------------------------------------------------------------
  const inst = lager.las('localStorage', 'terrang-installningar') || {};
  if (inst.intervall) $('intervall').value = inst.intervall;
  if (inst.mesh) $('mesh').value = inst.mesh;
  if (inst.utjamning !== undefined) {
    const r = document.querySelector(`input[name=utjamning][value="${inst.utjamning}"]`);
    if (r) r.checked = true;
  }
  const utjamning = () => Number(document.querySelector('input[name=utjamning]:checked').value);
  function sparaInst() {
    lager.spara('localStorage', 'terrang-installningar',
      { intervall: $('intervall').value, mesh: $('mesh').value, utjamning: utjamning(), format: formatVal(), tillval: tillval(),
        vrid: $('vrid').value, vridGrader: $('vrid-grader').value, kapitel: kapitel(), ritprogram: state.ritprogram || null,
        hojdpunktSteg: $('hojdpunkt-steg').value });
    nollstallResultat();
    sammanfatta();
  }
  ['intervall', 'mesh', 'hojdpunkt-steg'].forEach(id => $(id).addEventListener('change', sparaInst));
  if (inst.hojdpunktSteg) $('hojdpunkt-steg').value = inst.hojdpunktSteg;

  // Stegen: Plats, Underlag, Analys, Skiss
  const flikar = [...document.querySelectorAll('.stegnav [role=tab]')];
  function visaSteg(namn) {
    const f = $('flik-' + namn);
    flikar.forEach(x => {
      const vald = x === f;
      x.setAttribute('aria-selected', String(vald)); x.tabIndex = vald ? 0 : -1;
      $(x.getAttribute('aria-controls')).hidden = !vald;
    });
    $('panel-rulla').scrollTop = 0;
    lager.spara('sessionStorage', 'terrang-steg', namn);
  }
  flikar.forEach((f, i) => {
    f.addEventListener('click', () => visaSteg(f.id.replace('flik-', '')));
    f.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const n = flikar[(i + (e.key === 'ArrowRight' ? 1 : flikar.length - 1)) % flikar.length];
      visaSteg(n.id.replace('flik-', '')); n.focus();
    });
  });

  // Projekt eller fastighet → filnamn, så länge filnamnet inte ändrats för hand
  let namnAndrat = false;
  const slug = v => v.trim().replace(/[^\wåäöÅÄÖ.-]+/g, '_').replace(/^_+|_+$/g, '');
  $('namn').addEventListener('input', () => { namnAndrat = true; });
  $('projekt').addEventListener('input', () => {
    if (!namnAndrat) $('namn').value = slug($('projekt').value) || 'terrang';
    nollstallResultat();
  });

  // Tillval
  const tillval = () => {
    const t = {};
    document.querySelectorAll('input[name=tillval]').forEach(c => { t[c.value] = c.checked; });
    return t;
  };
  if (inst.tillval) document.querySelectorAll('input[name=tillval]').forEach(c => {
    if (c.value in inst.tillval) c.checked = !!inst.tillval[c.value];
  });
  document.querySelectorAll('input[name=tillval]').forEach(c => c.addEventListener('change', sparaInst));
  const SOL_AR = new Date().getFullYear();
  $('sol-ar').textContent = SOL_AR;

  // Lokal nollpunkt
  const nollpunktsVal = () => document.querySelector('input[name=nollpunkt]:checked').value;
  document.querySelectorAll('input[name=nollpunkt]').forEach(r => r.addEventListener('change', () => {
    const egen = nollpunktsVal() === 'egen';
    $('egen-nollpunkt').hidden = !egen;
    if (egen && state.utsnitt && !$('np-x').value && !$('np-y').value) {
      $('np-x').value = state.utsnitt.xmin;
      $('np-y').value = state.utsnitt.ymin;
    }
    if (egen) $('np-x').focus();
    nollstallResultat();
    ritaNollpunkt();
  }));
  ['np-x', 'np-y', 'np-z'].forEach(id => $(id).addEventListener('change', () => { nollstallResultat(); ritaNollpunkt(); }));

  // Vridning av lokala filer
  if (inst.vrid) $('vrid').value = inst.vrid;
  if (inst.vridGrader) $('vrid-grader').value = inst.vridGrader;
  $('vrid-egen-rad').hidden = $('vrid').value !== 'egen';
  ['vrid', 'vrid-grader'].forEach(id => $(id).addEventListener('change', () => { $('vrid-egen-rad').hidden = $('vrid').value !== 'egen'; sparaInst(); }));
  const tal = v => {
    const t = String(v).trim().replace(/[\s\u00a0]/g, '').replace(',', '.');
    return t === '' ? NaN : Number(t);
  };
  function lasNollpunkt() {
    if (nollpunktsVal() !== 'egen') return { ok: true, varde: null };
    const x = tal($('np-x').value), y = tal($('np-y').value);
    const zt = $('np-z').value.trim(), z = zt === '' ? 0 : tal(zt);
    if (!isFinite(x) || !isFinite(y) || !isFinite(z))
      return { ok: false, fel: 'Ange egen nollpunkt med siffror för X och Y, och Z om höjden ska flyttas.' };
    return { ok: true, varde: { x, y, z } };
  }

  // Filer att skapa
  const formatVal = () => {
    const f = {};
    document.querySelectorAll('input[name=format]').forEach(c => { f[c.value] = c.checked; });
    return f;
  };
  if (inst.format) document.querySelectorAll('input[name=format]').forEach(c => {
    if (c.value in inst.format) c.checked = !!inst.format[c.value];
  });
  document.querySelectorAll('input[name=format]').forEach(c => c.addEventListener('change', sparaInst));
  document.querySelectorAll('input[name=utjamning]').forEach(r => r.addEventListener('change', sparaInst));
  $('steg-installningar').classList.add('klar');

  // Platsanalysens kapitel
  const kapitel = () => {
    const k = {};
    document.querySelectorAll('input[name=kapitel]').forEach(c => { k[c.value] = c.checked; });
    return k;
  };
  if (inst.kapitel) document.querySelectorAll('input[name=kapitel]').forEach(c => { if (c.value in inst.kapitel) c.checked = !!inst.kapitel[c.value]; });
  document.querySelectorAll('input[name=kapitel]').forEach(c => c.addEventListener('change', sparaInst));
  /** Det som faktiskt skapas: analysernas val gäller bara när platsanalysen är på. */
  function effektivaVal() {
    const t = tillval(), k = kapitel(), pa = !!t.platsanalys;
    return Object.assign({}, t, {
      sol: pa && k.sol && t.sol, horisont: pa && k.sol && t.sol && t.horisont, skugga: pa && k.sol && t.skugga,
      lutning: pa && k.terrang, skyfall: pa && k.vatten, skydd: pa && k.skydd,
      byggnadshojd: !!(t.byggnader && t.byggnadshojd), vagytor: !!(t.vagar && t.vagytor),
    });
  }

  // Förval efter ritprogram
  const RITPROGRAM = {
    archicad: { format: { dxf: true, xyz: true, csv: false }, hojdpunkter: true, text: 'Archicad: kurvor som DXF (File › Interoperability › Merge) och markmodell som XYZ för Mesh.' },
    revit: { format: { dxf: true, xyz: false, csv: true }, hojdpunkter: false, text: 'Revit: kurvor som DXF och punkter som CSV för Toposolid.' },
    autocad: { format: { dxf: true, xyz: false, csv: false }, hojdpunkter: true, text: 'AutoCAD: kurvor och höjdpunkter som DXF.' },
    annat: { format: { dxf: true, xyz: true, csv: true }, hojdpunkter: true, text: 'Alla terrängfiler. Välj bort det du inte behöver.' },
  };
  function visaRitprogram() {
    document.querySelectorAll('#ritprogram button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.prog === state.ritprogram)));
    if (state.ritprogram) $('ritprogram-hjalp').textContent = RITPROGRAM[state.ritprogram].text + ' Du kan ändra filerna nedan.';
  }
  state.ritprogram = inst.ritprogram || null;
  document.querySelectorAll('#ritprogram button').forEach(b => b.addEventListener('click', () => {
    const p = RITPROGRAM[b.dataset.prog];
    state.ritprogram = b.dataset.prog;
    document.querySelectorAll('input[name=format]').forEach(c => { c.checked = !!p.format[c.value]; });
    document.querySelector('input[name=tillval][value=hojdpunkter]').checked = p.hojdpunkter;
    visaRitprogram();
    sparaInst();
  }));
  visaRitprogram();

  // Sammanfattningar på de ihopfällda grupperna och längst ner i panelen
  const kryssad = (namn, v) => { const c = document.querySelector(`input[name=${namn}][value=${v}]`); return !!(c && c.checked); };
  function sammanfatta() {
    const lista = (par) => { const v = par.filter(([n, , vv]) => kryssad(n, vv)).map(([, t]) => t); return v.length ? `${v.join(', ')} · ${v.length} av ${par.length}` : 'inget valt'; };
    $('sf-terrang').textContent = lista([['format', 'kurvor', 'dxf'], ['format', 'XYZ', 'xyz'], ['format', 'CSV', 'csv'], ['tillval', 'höjdpunkter', 'hojdpunkter']]);
    $('sf-laser').textContent = lista([['tillval', 'punktmoln', 'laser'], ['tillval', 'träd', 'trad'], ['tillval', 'höjd över mark', 'hom']]);
    $('sf-kartdata').textContent = lista([['tillval', 'ortofoto', 'ortofoto'], ['tillval', 'byggnader', 'byggnader'], ['tillval', 'fastighetsgränser', 'fastigheter'], ['tillval', 'marktäcke', 'marktacke'], ['tillval', 'stompunkter', 'stompunkter'], ['tillval', 'vägar', 'vagar']]);
    const sek = state.sektioner || [];
    $('sf-sektioner').textContent = kryssad('tillval', 'sektion') ? (sek.length ? sek.map(x => `${x.namn}–${x.namn}`).join(', ') : 'ingen ritad') : 'av';
    const np = document.querySelector('input[name=nollpunkt]:checked');
    $('sf-lokalt').textContent = `${np && np.value === 'egen' ? 'egen nollpunkt' : 'SV-hörnet'} · ${({ ingen: 'ej vriden', sann: 'mot sann nord', egen: 'egen vinkel' })[$('vrid').value]}`;
    const k = kapitel(), kn = ['sol', 'terrang', 'vatten', 'skydd'].filter(x => k[x]).length;
    $('sf-kapitel').textContent = `${kn} av 4`;
    $('kapitel').classList.toggle('av', !kryssad('tillval', 'platsanalys'));
    $('sf-sol').textContent = [kryssad('tillval', 'sol') && 'soldiagram', kryssad('tillval', 'sol') && kryssad('tillval', 'horisont') && 'horisont', kryssad('tillval', 'skugga') && 'skuggor'].filter(Boolean).join(', ') || 'inget valt';
    const ev = effektivaVal(), f = formatVal();
    const antal = ['dxf', 'xyz', 'csv'].filter(x => f[x]).length + ['hojdpunkter', 'laser', 'trad', 'hom', 'ortofoto', 'byggnader', 'fastigheter', 'marktacke', 'stompunkter', 'vagar', 'sektion'].filter(x => ev[x]).length;
    const vol = (state.volymer || []).length;
    $('val-sammanf').innerHTML = `<span>Underlag · ${antal} val</span><span>Platsanalys · ${ev.platsanalys ? `${kn} kapitel` : 'av'}</span><span>Skiss · ${vol ? vol + (vol === 1 ? ' volym' : ' volymer') : '–'}</span>`;
    $('skapa').textContent = ev.platsanalys ? 'Skapa underlag och platsanalys →' : 'Skapa underlag →';
  }
  ['change', 'input'].forEach(t => $('steg-underlag').addEventListener(t, sammanfatta));
  ['change'].forEach(t => $('steg-analys').addEventListener(t, sammanfatta));
  ['change'].forEach(t => $('g-lokalt').addEventListener(t, sammanfatta));

  const NYCKEL = 'terrang-inloggning';
  const b64url = {
    koda(text) {
      let bin = '';
      new TextEncoder().encode(text).forEach(b => { bin += String.fromCharCode(b); });
      return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    avkoda(s) {
      const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
      return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
    },
  };
  function fyllInlogg(u, kalla) {
    if (!u || !u.anv) return false;
    $('anv').value = u.anv; $('losen').value = u.losen || '';
    if (kalla) { $('inlogg-kalla').textContent = kalla; $('inlogg-kalla').hidden = false; }
    return true;
  }
  // 1. Länk med inloggning (#lm=...). Tas bort ur adressfältet direkt.
  let franLank = false;
  const lmMatch = location.hash.match(/(?:^#|&)lm=([^&]+)/);
  if (lmMatch) {
    try {
      const u = JSON.parse(b64url.avkoda(lmMatch[1]));
      franLank = fyllInlogg({ anv: u.a, losen: u.l }, 'Inloggningen kommer från länken du öppnade.');
    } catch (e) { /* trasig länk, ignoreras */ }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignoreras */ }
  }
  // 2. Förifylld i config.js (intranät), 3. sparad på datorn, 4. sparad i fliken
  if (!franLank && !fyllInlogg(KONF.inloggning, 'Inloggningen är förifylld för den här installationen.')) {
    fyllInlogg(lager.las('localStorage', NYCKEL)) || fyllInlogg(lager.las('sessionStorage', NYCKEL));
  }
  const komIhag = $('kom-ihag');
  komIhag.value = lager.las('localStorage', 'terrang-kom-ihag') || (lager.las('localStorage', NYCKEL) ? 'dator' : 'flik');
  function sparaInlogg() {
    const val = komIhag.value, u = { anv: $('anv').value.trim(), losen: $('losen').value };
    lager.spara('localStorage', 'terrang-kom-ihag', val);
    lager.ta('localStorage', NYCKEL); lager.ta('sessionStorage', NYCKEL);
    if (!u.anv || !u.losen) return;
    if (val === 'dator') lager.spara('localStorage', NYCKEL, u);
    else if (val === 'flik') lager.spara('sessionStorage', NYCKEL, u);
  }
  komIhag.addEventListener('change', sparaInlogg);

  function inloggKlar() {
    $('steg-inloggning').classList.toggle('klar', !!($('anv').value && $('losen').value));
  }
  ['anv', 'losen'].forEach(id => $(id).addEventListener('input', () => { inloggKlar(); $('inlogg-kalla').hidden = true; }));
  inloggKlar();

  $('kopiera-lank').addEventListener('click', async () => {
    const anv = $('anv').value.trim(), losen = $('losen').value;
    const hjalp = $('lank-hjalp');
    if (!anv || !losen) { hjalp.textContent = 'Fyll i användarnamn och lösenord först.'; return; }
    const lank = location.origin + location.pathname + '#lm=' + b64url.koda(JSON.stringify({ a: anv, l: losen }));
    try {
      await navigator.clipboard.writeText(lank);
      hjalp.textContent = 'Länken är kopierad. Den innehåller lösenordet, så dela den bara i en betrodd miljö.';
    } catch (e) {
      window.prompt('Kopiera länken:', lank);
    }
  });

  // ------------------------------------------------------------------
  // Skapa underlag
  // ------------------------------------------------------------------
  function visaStatus(text, fel = false) {
    const p = $('status-text');
    p.textContent = text;
    p.classList.toggle('fel', fel);
  }
  function matare(p) {
    $('matare').hidden = p === null;
    $('matare-fyll').style.width = (p || 0) + '%';
  }
  function visaLatLon() {
    const r = state.utsnitt;
    $('latlon-text').textContent = r ? T.latLonText(state.epsg, (r.xmin + r.xmax) / 2, (r.ymin + r.ymax) / 2) : '';
  }
  $('kopiera-latlon').addEventListener('click', async () => {
    const t = $('latlon-text').textContent, k = $('kopiera-latlon');
    let ok = false;
    try { await navigator.clipboard.writeText(t); ok = true; } catch (e) {
      const sel = window.getSelection(), rng = document.createRange();
      rng.selectNodeContents($('latlon-text')); sel.removeAllRanges(); sel.addRange(rng);
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    }
    k.textContent = ok ? 'Kopierat' : 'Markerat, kopiera själv';
    setTimeout(() => { k.textContent = 'Kopiera'; }, 1800);
  });
  function nollstallResultat() {
    $('resultat').hidden = true;
    $('visa-3d').hidden = true;
    $('skapa').classList.remove('gjord');
    state.zipBlob = null;
    state.senaste = null;
    Object.keys(resultat).forEach(n => visaResultatLager(n, null));
    $('lp-utskrift').hidden = true;
    $('lp-skriv').setAttribute('aria-expanded', 'false');
    ritaLagerlista();
  }

  // ------------------------------------------------------------------
  // Bibliotek som bara laddas när de behövs
  // ------------------------------------------------------------------
  const laddade = {};
  function laddaSkript(src) {
    if (!laddade[src]) laddade[src] = new Promise((ok, fel) => {
      const el = document.createElement('script');
      el.src = src + '?v=' + encodeURIComponent(VERSION); el.onload = ok;
      el.onerror = () => { delete laddade[src]; fel(new Error('Kunde inte ladda ' + src)); };
      document.head.append(el);
    });
    return laddade[src];
  }
  async function base64Fil(url) {
    const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  let fonter = null;

  // ------------------------------------------------------------------
  // Hjälp
  // ------------------------------------------------------------------
  const RAD = Math.PI / 180;
  async function laddaPdf() {
    await laddaSkript('vendor/jspdf.umd.min.js');
    if (!fonter) fonter = { normal: await base64Fil('vendor/fonts/familjen-400.ttf'), bold: await base64Fil('vendor/fonts/familjen-700.ttf'), mono: await base64Fil('vendor/fonts/plexmono-400.ttf') };
  }
  function laddaNer(data, filnamn, typ = 'application/octet-stream') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
    a.download = filnamn;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 20000);
  }
  /**
   * "Spara som": väljer fil med webbläsarens dialog där den finns (Chrome, Edge), annars vanlig nedladdning.
   * Måste anropas direkt vid klicket. Returnerar ett filhandtag, null (vanlig nedladdning) eller AVBRUTET.
   */
  const AVBRUTET = Symbol('avbrutet');
  async function valjFil(filnamn, typ, beskrivning) {
    if (typeof window.showSaveFilePicker !== 'function') return null;
    const ext = '.' + filnamn.split('.').pop();
    try {
      return await window.showSaveFilePicker({ suggestedName: filnamn, types: [{ description: beskrivning, accept: { [typ]: [ext] } }] });
    } catch (e) {
      return e && e.name === 'AbortError' ? AVBRUTET : null;
    }
  }
  async function skrivFil(mal, blob, filnamn) {
    if (mal) { const w = await mal.createWritable(); await w.write(blob); await w.close(); return; }
    laddaNer(blob, filnamn);
  }
  /** Utsnittets mitt och meridiankonvergens för ett koordinatsystem (rutnätets nord, öster +). */
  function konvergens(epsg, lat, lon) {
    const f = T.omvandlare(4326, epsg).forward;
    const a = f([lon, lat]), b = f([lon, lat + 0.01]);
    return -Math.atan2(b[0] - a[0], b[1] - a[1]) / RAD;
  }
  function utsnittsMitt() {
    const r = state.utsnitt, t = tillLatLng(state.epsg);
    const [lat, lon] = t([(r.xmin + r.xmax) / 2, (r.ymin + r.ymax) / 2]);
    return { lat, lon, konvergens: konvergens(state.epsg, lat, lon) };
  }
  /** Rektangel i zonen → omslutande ruta i SWEREF 99 TM. */
  function tmRuta(rr, epsg, marg = 2) {
    const tillTM = epsg === 3006 ? (q => q) : T.omvandlare(epsg, 3006).forward;
    const k = T.kantlinje(rr).map(tillTM);
    return { xmin: Math.min(...k.map(q => q[0])) - marg, xmax: Math.max(...k.map(q => q[0])) + marg,
      ymin: Math.min(...k.map(q => q[1])) - marg, ymax: Math.max(...k.map(q => q[1])) + marg };
  }
  const forena = (a, b) => (!a ? b : !b ? a : { xmin: Math.min(a.xmin, b.xmin), ymin: Math.min(a.ymin, b.ymin), xmax: Math.max(a.xmax, b.xmax), ymax: Math.max(a.ymax, b.ymax) });
  const kommunText = () => (state.kommun ? `${state.kommun.namn} kommun` : '');
  const idag = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  // ------------------------------------------------------------------
  // Soldiagram
  // ------------------------------------------------------------------
  async function skapaSoldiagram(extra = {}) {
    await laddaPdf();
    const m = utsnittsMitt();
    const bas = { lat: m.lat, lon: m.lon, ar: SOL_AR, namn: $('projekt').value.trim(), kommun: kommunText(),
      zonNamn: T.zon(state.epsg).namn, konvergens: m.konvergens, fonter, ...extra };
    return { svart: Sol.soldiagramPdf({ ...bas, farg: 'svart' }), vit: Sol.soldiagramPdf({ ...bas, farg: 'vit' }), opt: bas };
  }
  $('ladda-sol').addEventListener('click', async () => {
    if (!state.utsnitt) return;
    const knapp = $('ladda-sol');
    const filnamn = `${slug($('projekt').value) || 'soldiagram'}_soldiagram_${SOL_AR}.zip`;
    const mal = await valjFil(filnamn, 'application/zip', 'Zip-fil');
    if (mal === AVBRUTET) return;
    knapp.disabled = true;
    try {
      const sd = await skapaSoldiagram();
      const zip = new JSZip();
      zip.file(`soldiagram_${SOL_AR}_svart.pdf`, sd.svart);
      zip.file(`soldiagram_${SOL_AR}_vit.pdf`, sd.vit);
      await skrivFil(mal, await zip.generateAsync({ type: 'blob' }), filnamn);
    } catch (e) {
      console.error(e);
      visaStatus('Soldiagrammet kunde inte skapas: ' + e.message, true);
    } finally { knapp.disabled = false; }
  });

  // ------------------------------------------------------------------
  // Sektionslinjer
  // ------------------------------------------------------------------
  state.sektioner = lager.las('sessionStorage', 'terrang-sektioner') || [];
  let sektionRitar = false, sektionStart = null, sektionTemp = null;
  const sektionLager = L.layerGroup();
  if (synlig('sektioner')) sektionLager.addTo(karta);
  /** Ändpunktens dekor: tick och öppen pil åt blickriktningen, bokstaven i linjens förlängning. */
  function sektionsAnde(s, vid) {
    const p1 = karta.latLngToLayerPoint(s.a), p2 = karta.latLngToLayerPoint(s.b);
    const l = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1, dx = (p2.x - p1.x) / l, dy = (p2.y - p1.y) / l;
    const nx = s.vand ? -dy : dy, ny = s.vand ? dx : -dx;          // vänster om A→B på skärmen, eller höger om vänd
    const ut = vid === 'a' ? -1 : 1, T1 = [nx * 16, ny * 16];
    const arm = sgn => [T1[0] - nx * 5 + sgn * dx * 3.6, T1[1] - ny * 5 + sgn * dy * 3.6];
    const [a1, a2] = [arm(1), arm(-1)];
    const vinkel = Math.atan2(nx, -ny) * 180 / Math.PI;
    const f = v => v.toFixed(1);
    return L.divIcon({
      className: 'sektion-ande', iconSize: [60, 60], iconAnchor: [30, 30],
      html: `<svg width="60" height="60" viewBox="-30 -30 60 60" aria-hidden="true"><path d="M0 0 L${f(T1[0])} ${f(T1[1])} M${f(a1[0])} ${f(a1[1])} L${f(T1[0])} ${f(T1[1])} L${f(a2[0])} ${f(a2[1])}"/>` +
        `<text transform="translate(${f(dx * ut * 9)} ${f(dy * ut * 9)}) rotate(${f(vinkel)})" text-anchor="middle">${esc(s.namn)}</text></svg>`,
    });
  }
  function ritaSektioner() {
    sektionLager.clearLayers();
    const lista = $('sektionslista');
    lista.innerHTML = '';
    state.sektioner.forEach((s, i) => {
      const linje = L.polyline([s.a, s.b], { color: farg('annot'), weight: 1.3, interactive: true, bubblingMouseEvents: false })
        .bindTooltip(`${s.namn}–${s.namn}: klicka för att vända blickriktningen`, { sticky: true });
      linje.on('click', () => vandSektion(i));
      linje.addTo(sektionLager);
      L.marker(s.a, { interactive: false, keyboard: false, icon: sektionsAnde(s, 'a') }).addTo(sektionLager);
      L.marker(s.b, { interactive: false, keyboard: false, icon: sektionsAnde(s, 'b') }).addTo(sektionLager);
      const li = document.createElement('li');
      li.innerHTML = `<span>${esc(s.namn)}–${esc(s.namn)}, ${fmt(karta.distance(s.a, s.b))} m</span>`;
      const knappar = document.createElement('span'); knappar.className = 'knappar';
      const v = document.createElement('button');
      v.type = 'button'; v.className = 'lank-ta-bort'; v.textContent = 'Vänd';
      v.setAttribute('aria-label', `Vänd blickriktningen för sektion ${s.namn}`);
      v.addEventListener('click', () => vandSektion(i));
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'lank-ta-bort'; b.textContent = 'Ta bort';
      b.setAttribute('aria-label', `Ta bort sektion ${s.namn}`);
      b.addEventListener('click', () => { state.sektioner.splice(i, 1); sparaSektioner(); ritaSektioner(); nollstallResultat(); });
      knappar.append(v, b); li.append(knappar); lista.append(li);
    });
    ritaLagerlista();
    sammanfatta();
  }
  function vandSektion(i) {
    state.sektioner[i].vand = !state.sektioner[i].vand;
    sparaSektioner(); ritaSektioner();
    if (state.senaste && state.senaste.sektioner) nollstallResultat();
  }
  function sparaSektioner() { lager.spara('sessionStorage', 'terrang-sektioner', state.sektioner); }
  function satSektionslage(pa) {
    sektionRitar = pa; sektionStart = null;
    if (sektionTemp) { sektionTemp.remove(); sektionTemp = null; }
    $('rita-sektion').setAttribute('aria-pressed', String(pa));
    $('rita-sektion').textContent = pa ? 'Klicka start och slut på kartan …' : 'Rita sektionslinje';
    document.body.classList.toggle('ritlage', pa);
    // Shift används för 90°-linjer, så rutzoomen får vila medan man ritar
    if (pa) karta.boxZoom.disable(); else karta.boxZoom.enable();
    if (pa && ritar) satRitlage(false);
    if (pa) satHorisontlage(false);
  }
  /** Låser linjen till koordinataxlarna (zonens x eller y). */
  function ortho(start, slut) {
    const f = franLatLng(state.epsg), t = tillLatLng(state.epsg);
    const a = f(start), b = f(slut);
    return Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? t([b[0], a[1]]) : t([a[0], b[1]]);
  }
  $('rita-sektion').addEventListener('click', () => satSektionslage(!sektionRitar));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && sektionRitar) satSektionslage(false); });
  karta.on('mousemove', e => {
    if (!sektionRitar || !sektionStart) return;
    let slut = [e.latlng.lat, e.latlng.lng];
    if (state.ortho || (e.originalEvent && e.originalEvent.shiftKey)) slut = ortho(sektionStart, slut);
    if (!sektionTemp) sektionTemp = L.polyline([sektionStart, slut], { color: farg('annot'), weight: 1.2, dashArray: '4 4', interactive: false }).addTo(karta);
    else sektionTemp.setLatLngs([sektionStart, slut]);
  });

  // ------------------------------------------------------------------
  // Betraktelsepunkt för horisonten
  // ------------------------------------------------------------------
  state.horPunkt = lager.las('sessionStorage', 'terrang-horpunkt');
  let horValjer = false, horMarkor = null;
  function satHorisontlage(pa) {
    horValjer = pa;
    $('hor-valj').setAttribute('aria-pressed', String(pa));
    $('hor-valj').textContent = pa ? 'Klicka på kartan …' : 'Välj punkt på kartan';
    document.body.classList.toggle('ritlage', pa || sektionRitar);
  }
  function ritaHorPunkt() {
    if (horMarkor) { horMarkor.remove(); horMarkor = null; }
    const p = $('hor-punkt-text');
    if (!state.horPunkt) { p.textContent = 'Punkten är utsnittets mitt.'; return; }
    horMarkor = L.marker(state.horPunkt, {
      draggable: true, keyboard: false, title: 'Betraktelsepunkt för horisonten',
      icon: L.divIcon({ className: 'horpunkt', iconSize: [22, 22], iconAnchor: [11, 11], html: '<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="8"/><circle class="prick" cx="11" cy="11" r="2.5"/></svg>' }),
    }).addTo(karta);
    horMarkor.on('dragend', () => { const ll = horMarkor.getLatLng(); state.horPunkt = [ll.lat, ll.lng]; lager.spara('sessionStorage', 'terrang-horpunkt', state.horPunkt); ritaHorPunkt(); nollstallResultat(); });
    const [x, y] = franLatLng(state.epsg)(state.horPunkt);
    p.innerHTML = `Vald punkt: X ${fmt(x)}, Y ${fmt(y)}. <button type="button" class="lank-ta-bort" id="hor-aterstall">Använd utsnittets mitt</button>`;
    $('hor-aterstall').addEventListener('click', () => { state.horPunkt = null; lager.ta('sessionStorage', 'terrang-horpunkt'); ritaHorPunkt(); nollstallResultat(); });
  }
  $('hor-valj').addEventListener('click', () => { if (sektionRitar) satSektionslage(false); satHorisontlage(!horValjer); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && horValjer) satHorisontlage(false); });

  karta.on('click', e => {
    if (horValjer) {
      state.horPunkt = [e.latlng.lat, e.latlng.lng];
      lager.spara('sessionStorage', 'terrang-horpunkt', state.horPunkt);
      satHorisontlage(false);
      ritaHorPunkt();
      const kryss = document.querySelector('input[name=tillval][value=horisont]');
      if (kryss && !kryss.checked) { kryss.checked = true; sparaInst(); }
      nollstallResultat();
      return;
    }
    if (!sektionRitar) return;
    if (!sektionStart) {
      sektionStart = [e.latlng.lat, e.latlng.lng];
      return;
    }
    let slut = [e.latlng.lat, e.latlng.lng];
    if (state.ortho || (e.originalEvent && e.originalEvent.shiftKey)) slut = ortho(sektionStart, slut);
    if (karta.distance(sektionStart, slut) < 5) return;
    if (karta.distance(sektionStart, slut) > 2000) { visaStatus('En sektion kan vara högst 2 km lång.', true); return; }
    const anv = new Set(state.sektioner.map(s => s.namn));
    const namn = 'ABCDEFGHJKLMNPRSTUVXYZ'.split('').find(c => !anv.has(c)) || String(state.sektioner.length + 1);
    state.sektioner.push({ namn, a: sektionStart, b: slut, vand: false });
    sparaSektioner();
    satSektionslage(false);
    ritaSektioner();
    const kryss = document.querySelector('input[name=tillval][value=sektion]');
    if (kryss && !kryss.checked) { kryss.checked = true; sparaInst(); }
    nollstallResultat();
  });

  // ------------------------------------------------------------------
  // Sparade filer
  // ------------------------------------------------------------------
  const datumKort = ms => { if (!ms) return '–'; const d = new Date(ms); return `${d.getDate()} ${['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][d.getMonth()]} ${d.getFullYear()}`; };
  const storlekText = b => b < 1e6 ? `${fmt(Math.max(1, Math.round(b / 1e3)))} kB` : `${fmt(b / 1e6, 1)} MB`;
  async function visaLagring() {
    const lista = await Kommunfil.listaSparade();
    const ul = $('lagring-lista');
    ul.innerHTML = '';
    const total = lista.reduce((a, f) => a + f.storlek, 0);
    $('lagring-status').textContent = lista.length
      ? `${lista.length} ${lista.length === 1 ? 'fil' : 'filer'}, ${storlekText(total)}. Filerna ligger kvar tills du tar bort dem eller rensar webbplatsdata.`
      : 'Inget sparat.';
    lista.sort((a, b) => (b.anvand || 0) - (a.anvand || 0)).forEach(f => {
      const k = state.kommuner && state.kommuner.find(x => x.properties.kod === f.kod);
      const li = document.createElement('li');
      const prod = Kommunfil.PRODUKTER[f.produkt];
      li.innerHTML = `<span>${prod ? prod.namn : f.produkt} ${k ? k.properties.namn : f.kod}, ${storlekText(f.storlek)}<br><small>hämtat ${datumKort(f.sparad)}, använt ${datumKort(f.anvand)}</small></span>`;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'lank-ta-bort'; b.textContent = 'Ta bort';
      b.addEventListener('click', async () => { await Kommunfil.taBort(f.nyckel); visaLagring(); });
      li.append(b); ul.append(li);
    });
    $('lagring-tom').hidden = !lista.length;
  }
  $('lagring-tom').addEventListener('click', async () => {
    if (!window.confirm('Ta bort alla sparade filer? De hämtas på nytt nästa gång de behövs.')) return;
    await Kommunfil.taBort(null); visaLagring();
  });
  $('g-sparat').addEventListener('toggle', () => { if ($('g-sparat').open) visaLagring(); });
  setTimeout(visaLagring, 500);

  // ------------------------------------------------------------------
  // Inställningar för analyserna sparas med övriga
  // ------------------------------------------------------------------
  const extraInst = lager.las('localStorage', 'terrang-analys') || {};
  if (extraInst.skuggdatum) document.querySelectorAll('input[name=skuggdatum]').forEach(c => { c.checked = extraInst.skuggdatum.includes(c.value); });
  if (extraInst.skuggtider) $('skuggtider').value = extraInst.skuggtider;
  if (extraInst.ogonhojd) $('ogonhojd').value = extraInst.ogonhojd;
  const sparaExtra = () => {
    lager.spara('localStorage', 'terrang-analys', {
      skuggdatum: [...document.querySelectorAll('input[name=skuggdatum]:checked')].map(c => c.value),
      skuggtider: $('skuggtider').value, ogonhojd: $('ogonhojd').value,
    });
    nollstallResultat();
  };
  document.querySelectorAll('input[name=skuggdatum]').forEach(c => c.addEventListener('change', sparaExtra));
  ['skuggtider', 'ogonhojd'].forEach(id => $(id).addEventListener('change', sparaExtra));
  $('hor-tomt').addEventListener('change', nollstallResultat);

  /** Klockslag "9, 12, 13.30" → [[9,0],[12,0],[13,30]] */
  function lasTider(s) {
    return String(s).split(/[,;\s]+/).filter(Boolean).map(t => {
      const m = t.match(/^(\d{1,2})(?:[.:](\d{1,2}))?$/);
      if (!m) return null;
      const h = +m[1], mi = +(m[2] || 0);
      return h < 24 && mi < 60 ? [h, mi] : null;
    }).filter(Boolean);
  }

  // ------------------------------------------------------------------
  // Resultat på kartan
  // ------------------------------------------------------------------
  /** Ritar om en bild i zonens rutnät till kartans (lat/lon-rätvinklig) så att den hamnar rätt. */
  function bildTillKarta(canvas, x0, y1, s, epsg) {
    const W = canvas.width, H = canvas.height, t = tillLatLng(epsg);
    const v = x0 - s / 2, o = y1 + s / 2;
    const h = [[v, o], [v + W * s, o], [v, o - H * s], [v + W * s, o - H * s]].map(t);
    const n = Math.max(...h.map(p => p[0])), so = Math.min(...h.map(p => p[0])), w = Math.min(...h.map(p => p[1])), e = Math.max(...h.map(p => p[1]));
    const ut = document.createElement('canvas'); ut.width = W + 4; ut.height = H + 4;
    const px = ([lat, lng]) => [(lng - w) / (e - w) * ut.width, (n - lat) / (n - so) * ut.height];
    const m = Topowebb.affin([[0, 0], [W, 0], [0, H]], [px(h[0]), px(h[1]), px(h[2])]);
    const cx = ut.getContext('2d');
    cx.setTransform(m.a, m.c, m.b, m.d, m.e, m.f);
    cx.drawImage(canvas, 0, 0);
    return { url: ut.toDataURL('image/png'), bounds: [[so, w], [n, e]] };
  }
  function visaSkugga() {
    const s = state.senaste;
    if (!s || !s.skuggor || !s.skuggor.length) return;
    const t = tillLatLng(s.epsg), f = s.skuggor[Math.min(state.skuggaVal, s.skuggor.length - 1)];
    const stil = () => ({ color: farg('skugga'), weight: 0.5, opacity: 0.6, fillColor: farg('skugga'), fillOpacity: +farg('skugga-op') || 0.3, interactive: false });
    const grp = L.featureGroup(f.konturer.map(l => L.polygon(l.pts.map(t), stil())));
    visaResultatLager('skugga', grp, () => grp.setStyle(stil()));
  }

  // ------------------------------------------------------------------
  // Skapa underlag
  // ------------------------------------------------------------------
  $('skapa').addEventListener('click', async () => {
    const anv = $('anv').value.trim(), losen = $('losen').value;
    if (!state.utsnitt) return;
    if (!anv || !losen) {
      visaStatus('Fyll i användarnamn och lösenord från Geotorget.', true);
      $(anv ? 'losen' : 'anv').focus();
      return;
    }
    sparaInlogg();
    const np = lasNollpunkt();
    if (!np.ok) { visaStatus(np.fel, true); $('np-x').focus(); return; }
    const format = formatVal();
    const val = effektivaVal();
    const volymer = (state.volymer || []).map(v => Object.assign({}, v));
    if (!Object.values(format).some(Boolean) && !Object.values(val).some(Boolean)) { visaStatus('Välj minst en fil att skapa.', true); return; }
    if (val.platsanalys && !['sol', 'terrang', 'vatten', 'skydd'].some(k => kapitel()[k])) { visaStatus('Välj minst ett kapitel i platsanalysen, eller bocka ur den.', true); visaSteg('analys'); return; }
    const skuggTider = lasTider($('skuggtider').value);
    const skuggDatum = [...document.querySelectorAll('input[name=skuggdatum]:checked')].map(c => c.value);
    if (val.skugga && (!skuggTider.length || !skuggDatum.length)) { visaStatus('Välj minst ett datum och ett klockslag för skuggstudien.', true); return; }
    if (val.sektion && !state.sektioner.length) { visaStatus('Rita minst en sektionslinje på kartan, eller bocka ur Terrängsektioner.', true); return; }
    const ogon = parseFloat(String($('ogonhojd').value).replace(',', '.'));
    if (val.sol && val.horisont && !(ogon >= 0 && ogon < 200)) { visaStatus('Ange höjd över mark för horisonten i meter.', true); $('ogonhojd').focus(); return; }
    const mittV = utsnittsMitt();
    let vrid = 0, vridText = '';
    if ($('vrid').value === 'sann') { vrid = mittV.konvergens; vridText = 'sann nord uppåt'; }
    else if ($('vrid').value === 'egen') {
      vrid = tal($('vrid-grader').value);
      if (!isFinite(vrid) || Math.abs(vrid) > 360) { visaStatus('Ange vridningen i grader medurs, till exempel 12,5.', true); visaSteg('plats'); $('g-lokalt').open = true; $('vrid-grader').focus(); return; }
      vridText = 'egen vinkel';
    }
    if (val.horisont && state.horPunkt && karta.distance(state.horPunkt, [mittV.lat, mittV.lon]) > 3000) {
      visaStatus('Betraktelsepunkten för horisonten ligger mer än 3 km från utsnittet. Välj en punkt närmare.', true); return;
    }

    const knapp = $('skapa');
    knapp.disabled = true;
    nollstallResultat();
    matare(0);
    const varningar = [];
    if (np.varde) {
      const r0 = state.utsnitt;
      const avst = Math.hypot(np.varde.x - (r0.xmin + r0.xmax) / 2, np.varde.y - (r0.ymin + r0.ymax) / 2);
      if (avst > 5000) varningar.push(`OBS: den egna nollpunkten ligger ${fmt(avst / 1000, 1)} km från utsnittet. Kontrollera att den är angiven i ${T.zon(state.epsg).namn}.`);
    }
    const namn = ($('namn').value.trim() || 'terrang');
    const projekt = $('projekt').value.trim();
    const auth = T.basicAuth(anv, losen);
    const r = state.utsnitt, epsg = state.epsg;
    const tt = tillLatLng(epsg), franLL = franLatLng(epsg);
    const mitt = mittV;
    const horLL = val.sol && val.horisont && state.horPunkt ? { lat: state.horPunkt[0], lon: state.horPunkt[1] } : { lat: mitt.lat, lon: mitt.lon };
    const behoverYta = val.trad || val.hom || val.skugga;
    const behoverLaser = val.laser || behoverYta || val.sektion || (val.sol && val.horisont) || val.byggnadshojd;
    const behoverDtm = behoverYta || val.sektion || val.hojdpunkter || val.lutning || val.skyfall || volymer.length || val.byggnader;

    // områden: utsnittet, marginal för skuggor, sektionslinjer, horisontens närområde
    const MARG_SKUGGA = 150;
    let rm = { ...r };
    if (val.skugga) rm = { xmin: r.xmin - MARG_SKUGGA, ymin: r.ymin - MARG_SKUGGA, xmax: r.xmax + MARG_SKUGGA, ymax: r.ymax + MARG_SKUGGA };
    else if (val.trad || val.hom) rm = { xmin: r.xmin - 10, ymin: r.ymin - 10, xmax: r.xmax + 10, ymax: r.ymax + 10 };
    const sektioner = val.sektion ? state.sektioner.map(s => ({ namn: s.namn, a: franLL(s.a), b: franLL(s.b), vand: !!s.vand })) : [];
    sektioner.forEach(s => {
      rm = forena(rm, { xmin: Math.min(s.a[0], s.b[0]) - 5, xmax: Math.max(s.a[0], s.b[0]) + 5, ymin: Math.min(s.a[1], s.b[1]) - 5, ymax: Math.max(s.a[1], s.b[1]) + 5 });
    });
    const MARG_SKYFALL = 60;
    if (val.skyfall) rm = forena(rm, { xmin: r.xmin - MARG_SKYFALL, ymin: r.ymin - MARG_SKYFALL, xmax: r.xmax + MARG_SKYFALL, ymax: r.ymax + MARG_SKYFALL });
    if (val.lutning) rm = forena(rm, { xmin: r.xmin - 3, ymin: r.ymin - 3, xmax: r.xmax + 3, ymax: r.ymax + 3 });
    if (val.byggnader) rm = forena(rm, { xmin: r.xmin - 30, ymin: r.ymin - 30, xmax: r.xmax + 30, ymax: r.ymax + 30 });   // hus som sticker ut
    rm = T.avrunda(rm, 1);
    let tmBox = tmRuta(rm, epsg);
    const mittTM = T.omvandlare(4326, 3006).forward([horLL.lon, horLL.lat]);
    if (val.sol && val.horisont) tmBox = forena(tmBox, { xmin: mittTM[0] - 402, xmax: mittTM[0] + 402, ymin: mittTM[1] - 402, ymax: mittTM[1] + 402 });
    const yta = (tmBox.xmax - tmBox.xmin) * (tmBox.ymax - tmBox.ymin);
    if (yta > 6e6) {
      visaStatus(`Området för analyserna blir ${fmt(yta / 1e6, 1)} km², högst 6 km² går. Välj ett mindre utsnitt, kortare sektioner eller färre analyser.`, true);
      knapp.disabled = false; matare(null); return;
    }

    const plan = ['hojd', 'terrang', behoverLaser && 'laser', val.byggnader && 'byggnader', behoverYta && 'analys', (val.lutning || val.skyfall) && 'platsanalys', val.skydd && 'skydd', val.fastigheter && 'fastigheter', val.marktacke && 'marktacke', val.ortofoto && 'ortofoto', val.stompunkter && 'stompunkter', val.vagar && 'vagar', val.sol && 'sol', val.platsanalys && 'blad'].filter(Boolean);
    const vikt = { hojd: 2, terrang: 2, laser: 3, byggnader: 1, analys: 2, platsanalys: 2, skydd: 1, fastigheter: 1, marktacke: 2, ortofoto: 2, stompunkter: 1, vagar: 1, sol: val.horisont ? 2 : 1, blad: 1 };
    const totalVikt = plan.reduce((a, k) => a + vikt[k], 0);
    const delStart = k => 100 * plan.slice(0, plan.indexOf(k)).reduce((a, x) => a + vikt[x], 0) / totalVikt;
    const delFramsteg = (k, f, txt) => { matare(delStart(k) + 100 * vikt[k] / totalVikt * Math.min(1, f)); if (txt) visaStatus(txt + ' …'); };
    const senaste = { r, epsg, namn, projekt, kommun: kommunText(), intervall: Number($('intervall').value) };
    T.lokal.vrid = vrid;

    try {
      // --- Höjddata (en gång för hela analysområdet)
      delFramsteg('hojd', 0, 'Hämtar höjddata från Lantmäteriet');
      const mos = await T.lasHojder(tmBox, auth, { logg: t => { if (t.includes('finns inte')) varningar.push(t); } });
      if (!mos.rutor.length) throw new Error('Det finns ingen höjddata för det här området.');

      // --- Terräng
      const res = await T.skapaUnderlag({
        utsnitt: r, epsg, auth, namn, projekt, mosaik: mos,
        intervall: Number($('intervall').value), meshavstand: Number($('mesh').value),
        utjamning: utjamning(), tolerans: 0.05, nollpunkt: np.varde, format, konvergens: mitt.konvergens, vridText,
        kommun: state.kommun && state.kommun.epsg === epsg ? `${state.kommun.namn} kommun` : null,
        logg: t => { if (t.startsWith('OBS')) varningar.push(t); },
        framsteg: (p, t) => delFramsteg('terrang', p / 100, t),
      });
      const X0 = res.X0, Y0 = res.Y0, Z0 = res.Z0 || 0;
      senaste.kurvor = res.kurvor; senaste.Z0 = Z0; senaste.nollpunkt = { x: X0, y: Y0 };
      senaste.rutnat = Utbyte.glesa(T.rutnat(mos, r, 1, epsg));
      const infoNamn = Object.keys(res.filer).find(f => f.endsWith('_info.txt'));
      const filer = {};
      Object.entries(res.filer).forEach(([f, c]) => { if (f === infoNamn || format[f.split('.').pop() === 'dxf' ? 'dxf' : f.endsWith('.csv') ? 'csv' : 'xyz']) filer[f === infoNamn ? f : 'terrang/' + f] = c; });
      const extraInfo = [], sammanExtra = [];

      // --- Laserdata
      let pTM = null, pz = null, laserDatum = '';
      if (behoverLaser) {
        try {
          delFramsteg('laser', 0, 'Söker laserdata');
          await laddaSkript('vendor/copc-bundle.js');
          const valda = Laser.valjRutor(await Laser.sokRutor(tmBox), tmBox);
          if (!valda.valda.length) varningar.push('Laserdata: det finns ingen laserdata för området.');
          else {
            pTM = await Laser.lasPunkter(valda.valda, tmBox, auth, {
              klassFilter: kl => !(Laser.KLASSER[kl] || {}).brus,
              framsteg: f => delFramsteg('laser', 0.05 + 0.85 * f, 'Läser laserdata'),
            });
            pz = Laser.tillZon(pTM, epsg, rm);
            laserDatum = [...new Set(valda.valda.map(v => String(v.datum).slice(0, 10)))].join(', ');
            const omr = [...new Set(valda.valda.map(v => v.omrade))].join(', ');
            if (valda.tackning < 0.999) varningar.push(`Laserdata: bara ${fmt(valda.tackning * 100)} % av området täcks av samma skanning.`);
            extraInfo.push('', 'LASERDATA',
              '  Källa: Laserdata Nedladdning, skog. © Lantmäteriet. Bearbetad: utklippt, omprojicerad och analyserad.',
              '  Licens: CC BY 4.0.',
              `  Skanning: ${laserDatum} (område ${omr}). Rutor: ${valda.valda.map(v => v.id).join(', ')}`);
            if (val.laser) {
              const z = Laser.tillZon(pTM, epsg, r);
              filer[`laser/${namn}_laser_lokal.las`] = Laser.las(z, X0, Y0, Z0, 0);
              filer[`laser/${namn}_laser_sweref.las`] = Laser.las(z, 0, 0, 0, epsg);
              filer[`laser/${namn}_laser_lokal.xyz`] = Laser.xyzRgb(z, X0, Y0, Z0);
              const per = Laser.sammanfattning(z);
              extraInfo.push(`  Punktmoln: ${z.antal} st, ${fmt(z.antal / ((r.xmax - r.xmin) * (r.ymax - r.ymin)), 2)} per m². Brus (klass 7 och 18) är borttaget.`,
                ...Object.keys(per).sort((a, b) => a - b).map(kl => `    Klass ${kl} ${Laser.klassInfo(+kl).namn}: ${per[kl]} st`),
                '  Filer: _laser_lokal.las och _laser_sweref.las (LAS 1.2, klass bevarad),',
                '         _laser_lokal.xyz (X Y Z R G B, färg per klass, för Archicad). Samma nollpunkt och Z0 som terrängen.');
              sammanExtra.push(['Laserpunkter', `${fmt(z.antal)} st, skannat ${laserDatum}`]);
              const ritare = L.canvas({ padding: 0.3 }), steg = Math.max(1, Math.ceil(z.antal / 25000)), pts = [];
              for (let i = 0; i < z.antal; i += steg) {
                const c = Laser.klassInfo(z.k[i]).rgb;
                pts.push(L.circleMarker(tt([z.x[i], z.y[i]]), { radius: 1.3, stroke: false, fillOpacity: 0.85, fillColor: `rgb(${c[0]},${c[1]},${c[2]})`, renderer: ritare, interactive: false }));
              }
              visaResultatLager('laser', L.layerGroup(pts));
            }
          }
        } catch (e) {
          if (e instanceof T.InloggningsFel) varningar.push('Laserdata: ' + e.message);
          else { console.error(e); varningar.push('Laserdata: ' + e.message); }
          pTM = pz = null;
        }
      }

      // --- Analyser: ytmodell, träd, höjd över mark, skuggor
      let dtmZ = null;
      if (behoverDtm) dtmZ = T.rutnat(mos, rm, 1, epsg);

      // --- Befintliga byggnader (höjd ur ytmodellen, som sedan återanvänds av analyserna)
      let ytaFardig = null;
      if (val.byggnader) {
        try {
          delFramsteg('byggnader', 0, 'Hämtar byggnader');
          await laddaSkript('vendor/sql-wasm.js');
          const kommuner = kommunerIUtsnitt();
          if (!kommuner.length) throw new Error('kunde inte avgöra vilken kommun området ligger i.');
          const byggAlla = await Byggnad.hamta({
            kommuner, utsnitt: r, epsg, auth,
            logg: t => visaStatus(t),
            framsteg: f => delFramsteg('byggnader', f * 0.8),
            bekrafta: async storlek => window.confirm(`Byggnaderna för kommunen är ${fmt(storlek / 1e6)} MB. De hämtas en gång och sparas sedan i webbläsaren. Vill du hämta dem?`),
          });
          delFramsteg('byggnader', 0.85, 'Räknar byggnadshöjder');
          if (pz && val.byggnadshojd) ytaFardig = Analys.ytmodell(dtmZ, pz);
          Byggnad.hojder(byggAlla, ytaFardig || { W: dtmZ.W, H: dtmZ.H, s: dtmZ.s, x0: dtmZ.x0, y1: dtmZ.y1, dtm: dtmZ.z, ndsm: new Float32Array(dtmZ.z.length) });
          // hus som användaren har dolt (0.11.0) kommer inte med någonstans
          const { byggnader: bygg, dolda: byggDolda } = Objektval.tillampaHus(byggAlla, husval());
          senaste.byggnaderAlla = byggAlla; senaste.byggnader = bygg; senaste.byggnaderDolda = byggDolda;
          const medHojd = bygg.filter(b => b.hojd != null).length;
          filer[`byggnader/${namn}_byggnader_lokal.dxf`] = Byggnad.dxf(bygg, r, X0, Y0, Z0);
          filer[`byggnader/${namn}_byggnader_sweref.dxf`] = Byggnad.dxf(bygg, r, 0, 0, 0);
          filer[`byggnader/${namn}_byggnader.csv`] = Byggnad.csv(bygg, X0, Y0, Z0);
          // 3D-modell i IFC för byggnader med höjd (0.8.0)
          const ifcOpt = { projekt: $('projekt').value.trim() || namn, projektId: state.projektId || namn, systemNamn: T.zon(epsg).namn,
            kalla: `höjdkurvor.se ${window.HOJDKURVOR ? window.HOJDKURVOR.version : ''}`.trim() };
          const ifcLokal = Ifc.byggnader(bygg, Object.assign({ dx: X0, dy: Y0, dz: Z0, lokal: true, filnamn: `${namn}_byggnader_lokal.ifc` }, ifcOpt));
          if (ifcLokal.antal) {
            filer[`byggnader/${namn}_byggnader_lokal.ifc`] = ifcLokal.text;
            filer[`byggnader/${namn}_byggnader_sweref.ifc`] = Ifc.byggnader(bygg, Object.assign({ lokal: false, filnamn: `${namn}_byggnader_sweref.ifc` }, ifcOpt)).text;
          }
          else if (bygg.length) {
            // Säg till direkt, inte bara i info-filen (0.8.1)
            varningar.push('Byggnader: ingen IFC-fil skapades, eftersom ingen byggnad fick någon höjd. '
              + (!val.byggnadshojd ? 'Kryssa i Höjd ur laserdatan och skapa underlaget igen.' : 'Det finns ingen laserdata för området.'));
          }
          const per = Byggnad.perTyp(bygg);
          extraInfo.push('', 'BEFINTLIGA BYGGNADER',
            '  Källa: Byggnad Nedladdning, vektor. © Lantmäteriet. Bearbetad: utvald och omprojicerad. Licens: CC BY 4.0.',
            `  ${bygg.length} byggnader som berör utsnittet. Hela fotavtrycket är med, även den del som ligger utanför.`,
            ...(byggDolda.length ? [`  ${byggDolda.length} ${byggDolda.length === 1 ? 'byggnad är dold' : 'byggnader är dolda'} i 3D-vyn och är inte med i filerna eller skuggorna.`] : []),
            ...Object.keys(per).sort().map(t => `    ${t}: ${per[t]} st (lager ${Byggnad.lagerFor({ typ: t })})`),
            '  Fotavtrycken är oftast inmätta vid takkanten, inte vid fasaden, och kan avvika någon meter.',
            '  Kontrollera mot grundkartan eller en inmätning innan de används för projektering.',
            '  DXF: fotavtrycket på markhöjden, BYGGNAD_TAK på takhöjden när den är känd, BYGGNAD_TEXT med husnummer, ändamål och höjd.',
            pz && val.byggnadshojd
              ? `  Höjd över mark ur laserdata ${laserDatum} (90:e percentilen inom fotavtrycket) för ${medHojd} av ${bygg.length} byggnader. Taken är förenklade till platta.`
              : '  Ingen höjd: laserdata hämtades inte. Markhöjd ur Markhöjdmodell (median inom fotavtrycket).',
            '  CSV (semikolon): id, typ, ändamål, husnummer, namn, huvudbyggnad, yta, tyngdpunkt, markhöjd och höjd (höjder minus Z0).',
            ifcLokal.antal
              ? `  IFC (IFC4): ${ifcLokal.antal} ${ifcLokal.antal === 1 ? 'byggnad som volym' : 'byggnader som volymer'} från markhöjden till takhöjden, med platta tak och gårdar som hål. Varje hus är ett eget objekt`
                + ' (IfcBuildingElementProxy) med husnummer, ändamål och höjd i egenskaperna Hojdkurvor_Byggnad. _lokal.ifc har samma nollpunkt, vridning och Z0 som'
                + ' de lokala DXF-filerna; _sweref.ifc har SWEREF-koordinater och höjder i RH 2000. Samma hus får samma id vid en ny export.'
                + (ifcLokal.utanHojd ? ` ${ifcLokal.utanHojd} ${ifcLokal.utanHojd === 1 ? 'byggnad' : 'byggnader'} utan höjd är inte med.` : '')
              : '  IFC: ingen byggnad har höjd, så ingen IFC-fil skapades. Kryssa i Höjd ur laserdatan.');
          sammanExtra.push(['Byggnader', `${bygg.length} st` + (medHojd ? `, ${medHojd} med höjd` : '')]);
          visaByggnaderKarta(bygg, tt);
          visaLagring();
        } catch (e) { console.error(e); varningar.push('Byggnader: ' + e.message); }
      }
      // skissade volymer utan golvnivå står på marken i fotavtryckets tyngdpunkt
      volymer.forEach(v => {
        if (!(v.golv === v.golv) && dtmZ) { const c = Platsanalys.tyngdpunkt(v.fotavtryck); v.golv = Math.round(Analys.nod(dtmZ, dtmZ.z, c[0], c[1]) * 100) / 100; }
      });
      senaste.volymer = volymer.filter(v => v.golv === v.golv);
      if (behoverYta && (pz || val.skugga)) {
        try {
          delFramsteg('analys', 0, 'Bygger ytmodell');
          const y = ytaFardig || (pz ? Analys.ytmodell(dtmZ, pz) : { W: dtmZ.W, H: dtmZ.H, s: dtmZ.s, x0: dtmZ.x0, y1: dtmZ.y1, dtm: dtmZ.z, ndsm: new Float32Array(dtmZ.z.length), dsm: Float32Array.from(dtmZ.z) });
          if (!pz) varningar.push(`Skuggstudien räknades utan laserdata, så bara terrängen${senaste.volymer.length ? ' och skissen' : ''} kastar skugga.`);
          senaste.yta = y;
          const iUtsnitt = t => t.x >= r.xmin && t.x <= r.xmax && t.y >= r.ymin && t.y <= r.ymax;
          let tradDolda = [];
          if (val.trad && pz) {
            delFramsteg('analys', 0.1, 'Söker träd');
            const hittade = Analys.hittaTrad(y, pz).filter(iUtsnitt);
            // träd på eller precis vid en byggnad är oftast takkanten, inte ett träd (0.8.0)
            const { kvar: tradHittade, borttagna: tradVidHus } = Byggnad.tradVidByggnader(hittade, senaste.byggnader, TRAD_VID_HUS);
            // egna val för enskilda träd (0.11.0): dolda och rättade
            const { trad, dolda } = Objektval.tillampaTrad(tradHittade, tradval());
            senaste.tradAlla = tradHittade; senaste.trad = trad; tradDolda = dolda;
            filer[`trad/${namn}_trad_lokal.dxf`] = Analys.dxfTrad(trad, r, X0, Y0, Z0);
            filer[`trad/${namn}_trad_sweref.dxf`] = Analys.dxfTrad(trad, r, 0, 0, 0);
            filer[`trad/${namn}_trad.csv`] = Analys.csvTrad(trad, X0, Y0, Z0);
            extraInfo.push('', 'TRÄD',
              `  ${trad.length} träd med höjd minst 3 m, hittade som toppar i höjd över mark (laserdata ${laserDatum}).`,
              '  Toppar utan markträffar under kronan räknas som tak och är borttagna. I tät skog hittas inte alla träd.',
              senaste.byggnader
                ? (tradVidHus.length
                  ? `  ${tradVidHus.length} ${tradVidHus.length === 1 ? 'topp' : 'toppar'} på eller högst ${fmt(TRAD_VID_HUS, 1)} m från en byggnad ${tradVidHus.length === 1 ? 'är borttagen' : 'är borttagna'}, eftersom det oftast är byggnaden som är inmätt.`
                  : `  Ingen topp låg på eller högst ${fmt(TRAD_VID_HUS, 1)} m från en byggnad.`)
                : '  Kryssa i Befintliga byggnader för att också ta bort toppar som ligger på eller precis vid en byggnad.',
              ...(dolda.length || trad.some(t => t.andrat) ? [`  Ändrade i 3D-vyn: ${dolda.length} dolda, ${trad.filter(t => t.andrat).length} med egen höjd, krona eller art. De dolda är inte med i filerna eller skuggorna.`] : []),
              '  DXF-lager: TRAD_KRONA (cirkel på toppens höjd), TRAD_STAM (punkt på marken), TRAD_TEXT (höjd).',
              '  CSV: id;x;y;x_lokal;y_lokal;markhojd;tradhojd_m;topphojd;kronbredd_m (höjder minus Z0).');
            sammanExtra.push(['Träd', `${fmt(trad.length)} st`]);
            visaTradKarta(trad, tt);
          }
          if (pz) {   // bilden behövs också som lager i utskriften
            const homC = Utskrift.homCanvas(y.ndsm, y.W, y.H), bild = homC.toDataURL('image/png');
            senaste.hom = { bild, x0: y.x0, y1: y.y1, W: y.W, H: y.H, s: y.s };
            if (val.hom) {
              const png = await (await fetch(bild)).arrayBuffer();
              filer[`hojd_over_mark/${namn}_hojd_over_mark.png`] = png;
              filer[`hojd_over_mark/${namn}_hojd_over_mark_sweref.pgw`] = Analys.varldsfil(y.x0, y.y1, y.s);
              filer[`hojd_over_mark/${namn}_hojd_over_mark_lokal.pgw`] = Analys.varldsfil(y.x0, y.y1, y.s, X0, Y0);
              extraInfo.push('', 'HÖJD ÖVER MARK',
                '  Bild med 1 m pixlar. Färg efter höjd över mark: under 1,5 m genomskinlig, 1,5–4, 4–8, 8–15, 15–25 och över 25 m.',
                '  Byt namn på en av .pgw-filerna så att den heter som bilden för att få den på rätt plats (lokalt eller SWEREF).');
              // på kartan bara inom utsnittet, som i utskriften
              const i0 = Math.max(0, Math.round((r.xmin - y.x0) / y.s)), i1 = Math.min(y.W, Math.round((r.xmax - y.x0) / y.s) + 1);
              const j0 = Math.max(0, Math.round((y.y1 - r.ymax) / y.s)), j1 = Math.min(y.H, Math.round((y.y1 - r.ymin) / y.s) + 1);
              const klipp = document.createElement('canvas'); klipp.width = i1 - i0; klipp.height = j1 - j0;
              klipp.getContext('2d').drawImage(homC, -i0, -j0);
              const kb = bildTillKarta(klipp, y.x0 + i0 * y.s, y.y1 - j0 * y.s, y.s, epsg);
              visaResultatLager('hom', L.imageOverlay(kb.url, kb.bounds, { opacity: 0.85, interactive: false }));
              sammanExtra.push(['Höjd över mark', 'bild med världsfil']);
            }
          }
          // dolda träd och hus (0.11.0) kastar ingen skugga
          if (pz) y.dsm = Objektval.skarBort(y, y.dsm, { trad: tradDolda, hus: senaste.byggnaderDolda || [] });
          if (senaste.volymer.length) y.dsm = Platsanalys.branInVolymer(y, y.dsm, senaste.volymer);
          if (val.skugga) {
            delFramsteg('analys', 0.3, 'Räknar skuggor');
            const tider = [];
            for (const k of ['mars', 'juni', 'sept', 'dec'].filter(x => skuggDatum.includes(x))) {
              const l = Sol.lokal(Sol.solhandelse(SOL_AR, k));
              for (const [h, mi] of skuggTider) {
                const ms = Sol.lokalTillMs(l.ar, l.man, l.dag, h, mi);
                const pos = Sol.solensLage(ms, mitt.lat, mitt.lon);
                tider.push({ k, ms, ...pos, etikett: `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`,
                  lager: `SKUGGA_${String(l.man).padStart(2, '0')}${String(l.dag).padStart(2, '0')}_${String(h).padStart(2, '0')}${String(mi).padStart(2, '0')}` });
              }
            }
            const synliga = tider.filter(t => t.h > 2);
            const sk = Analys.skuggor(y, r, synliga, { konv: mitt.konvergens, maxAvst: MARG_SKUGGA });
            synliga.forEach((t, i) => { t.konturer = Analys.maskKonturer(sk, sk.masker[i]); t.andel = sk.masker[i].reduce((a, v) => a + v, 0) / sk.masker[i].length; });
            senaste.skuggor = synliga;
            filer[`skuggor/${namn}_skuggor_lokal.dxf`] = Analys.dxfSkuggor(synliga, r, X0, Y0);
            filer[`skuggor/${namn}_skuggor_sweref.dxf`] = Analys.dxfSkuggor(synliga, r, 0, 0);
            await laddaPdf();
            const DNAMN = { mars: 'Vårdagjämning', juni: 'Sommarsolstånd', sept: 'Höstdagjämning', dec: 'Vintersolstånd' };
            const rader = ['mars', 'juni', 'sept', 'dec'].filter(x => skuggDatum.includes(x)).map(k => {
              const l = Sol.lokal(Sol.solhandelse(SOL_AR, k));
              return {
                namn: DNAMN[k], under: `${l.dag}/${l.man} ${SOL_AR}, ${Sol.offsetMin(Sol.lokalTillMs(l.ar, l.man, l.dag, 12)) === 120 ? 'sommartid' : 'normaltid'}`,
                tider: tider.filter(t => t.k === k).map(t => ({ etikett: `kl ${t.etikett}`, konturer: t.konturer || [], text: t.h > 2 ? '' : 'solen står för lågt' })),
              };
            });
            const skuggOpt = {
              utsnitt: r, rader, kurvor: res.kurvor, fonter,
              titel: { projekt, kommun: kommunText(), system: `${T.zon(epsg).namn}, RH 2000` },
              notis: [(pz ? `Skuggor från terräng, träd och byggnader enligt laserdata ${laserDatum}. Träd räknas som täta.` : 'Skuggor från terrängen (ingen laserdata).') +
                (senaste.volymer.length ? ' Skissade volymer ingår.' : '') + ` Skuggor från objekt mer än ${MARG_SKUGGA} m utanför utsnittet ingår inte.`,
                'Grått: skugga på marken. Rutnätsnord uppåt. Underlag för tidiga skeden.'],
            };
            senaste.skuggOpt = skuggOpt;
            filer[`skuggor/${namn}_skuggstudie.pdf`] = Utskrift.skuggblad(skuggOpt);
            extraInfo.push('', 'SKUGGSTUDIE',
              `  Skuggor på marken från terräng, träd och byggnader, ${synliga.length} tidpunkter. Träd räknas som täta.`,
              `  Objekt upp till ${MARG_SKUGGA} m utanför utsnittet är med. Upplösning 1 m.`,
              '  DXF-lager SKUGGA_MMDD_HHMM (svensk tid), slutna polylinjer runt skuggade ytor:',
              ...synliga.map(t => `    ${t.lager}: solhöjd ${fmt(t.h, 1)}°, azimut ${fmt(t.az)}°, skugga på ${fmt(t.andel * 100)} % av utsnittet`),
              ...(tider.length > synliga.length ? [`  ${tider.length - synliga.length} tidpunkter hoppades över eftersom solen stod lägre än 2°.`] : []));
            sammanExtra.push(['Skuggstudie', `${synliga.length} tidpunkter`]);
            state.skuggaVal = Math.max(0, synliga.findIndex(t => t.k === 'mars' && t.etikett === '12:00'));
          }
        } catch (e) {
          console.error(e);
          varningar.push('Analyser: ' + e.message);
        }
      }
      if ((val.trad || val.hom) && !pz) varningar.push('Träd och höjd över mark kräver laserdata och kunde inte skapas.');

      // --- Höjdpunkter, lutning och skyfall ur markmodellen
      if (val.hojdpunkter && dtmZ) {
        const hp = Platsanalys.hojdpunkter(dtmZ, r, Number($('hojdpunkt-steg').value));
        senaste.hojdpunkter = hp;
        filer[`terrang/${namn}_hojdpunkter_lokal.dxf`] = Platsanalys.dxfHojdpunkter(hp, r, X0, Y0, Z0);
        filer[`terrang/${namn}_hojdpunkter_sweref.dxf`] = Platsanalys.dxfHojdpunkter(hp, r, 0, 0, 0);
        extraInfo.push('', 'HÖJDPUNKTER',
          `  ${hp.length} punkter var ${$('hojdpunkt-steg').value} m på jämna koordinater, markhöjd ur Markhöjdmodell (1 m).`,
          '  DXF-lager: HOJDPUNKT (punkt på rätt höjd och kryss), HOJDPUNKT_TEXT (höjd' + (Z0 ? ' minus Z0' : ' i RH 2000') + ').');
        sammanExtra.push(['Höjdpunkter', `${fmt(hp.length)} st`]);
        visaHojdpunkter(hp, epsg);
      }
      if ((val.lutning || val.skyfall) && dtmZ) {
        try {
          delFramsteg('platsanalys', 0, val.skyfall ? 'Räknar lutning och skyfall' : 'Räknar lutning');
          if (val.lutning) {
            const g1 = T.rutnat(mos, { xmin: r.xmin - 2, xmax: r.xmax + 2, ymin: r.ymin - 2, ymax: r.ymax + 2 }, 1, epsg);
            const ltHel = Platsanalys.lutning(g1, r, 1);
            const lt = klippRaster(ltHel, r);
            const konturer = Platsanalys.lutningKonturer(lt);
            const bild = { url: Platsanalys.lutningCanvas(lt).toDataURL('image/png'), x0: lt.x0, y1: lt.y1, s: lt.s, W: lt.W, H: lt.H };
            senaste.lutning = { lt: { andel: ltHel.andel }, konturer, bild };
            filer[`platsanalys/${namn}_lutning_lokal.dxf`] = Platsanalys.dxfLutning(konturer, r, X0, Y0);
            filer[`platsanalys/${namn}_lutning_sweref.dxf`] = Platsanalys.dxfLutning(konturer, r, 0, 0);
            extraInfo.push('', 'LUTNING',
              '  Lutning ur Markhöjdmodell (1 m), räknad över 2 m. Klasser efter tillgänglighet:',
              ...Platsanalys.LUTNING.map((k, i) => `    ${k.namn}: ${fmt(ltHel.andel[i] * 100)} % av utsnittet` + (i ? ` (DXF-lager ${k.lager})` : '')));
            sammanExtra.push(['Lutning', `${fmt((ltHel.andel[0] + ltHel.andel[1]) * 100)} % flackare än 1:20`]);
            visaRasterLager('lutning', bild, epsg, 0.75);
          }
          if (val.skyfall) {
            delFramsteg('platsanalys', 0.4, 'Räknar skyfall');
            const omr = { xmin: r.xmin - MARG_SKYFALL, ymin: r.ymin - MARG_SKYFALL, xmax: r.xmax + MARG_SKYFALL, ymax: r.ymax + MARG_SKYFALL };
            const sSky = Math.max(1, Math.ceil(Math.sqrt((omr.xmax - omr.xmin) * (omr.ymax - omr.ymin) / 1.5e6)));
            const gs = T.rutnat(mos, omr, sSky, epsg);
            const befSpar = senaste.byggnader ? Byggnad.somVolymer(senaste.byggnader, { utanHojd: 3 }) : [];
            const hinder = senaste.volymer.concat(befSpar);
            if (hinder.length) gs.z = Platsanalys.branInVolymer(gs, gs.z, hinder, { spar: true });
            await new Promise(ok => setTimeout(ok, 0));
            const sk = Platsanalys.skyfall(gs, r);
            senaste.skyfall = sk;
            filer[`platsanalys/${namn}_skyfall_lokal.dxf`] = Platsanalys.dxfSkyfall(sk, r, X0, Y0);
            filer[`platsanalys/${namn}_skyfall_sweref.dxf`] = Platsanalys.dxfSkyfall(sk, r, 0, 0);
            extraInfo.push('', 'SKYFALL',
              `  Lågpunkter (instängda områden) och flödesvägar ur Markhöjdmodell (${sSky} m), ${MARG_SKYFALL} m runt utsnittet.` + (senaste.volymer.length ? ' Skissade volymer räknas som hinder.' : '') + (befSpar.length ? ` ${befSpar.length} befintliga byggnader räknas som hinder.` : ''),
              '  Ingen hänsyn till ledningar, trummor, infiltration eller regnets mängd.',
              '  DXF-lager: SKYFALL_LAGPUNKT (slutna polylinjer), SKYFALL_FLODESVAG, SKYFALL_TEXT (nummer och största djup).',
              ...sk.lagpunkter.map((l, i) => `    L${i + 1}: ${fmt(l.yta)} m², största djup ${fmt(l.maxDjup, 2)} m, ${fmt(l.volym, 1)} m³`));
            sammanExtra.push(['Skyfall', `${sk.lagpunkter.length} lågpunkter, ${sk.floden.length} flödesvägar`]);
            visaSkyfall(sk, epsg);
          }
        } catch (e) { console.error(e); varningar.push('Platsanalys: ' + e.message); }
      }
      if (senaste.volymer.length) {
        filer[`skiss/${namn}_volymer_lokal.dxf`] = Platsanalys.dxfVolymer(senaste.volymer, r, X0, Y0, Z0);
        filer[`skiss/${namn}_volymer_sweref.dxf`] = Platsanalys.dxfVolymer(senaste.volymer, r, 0, 0, 0);
        sammanExtra.push(['Skiss', `${senaste.volymer.length} volymer`]);
      }

      // --- Skydd och risker från andra myndigheter
      if (val.skydd) {
        delFramsteg('skydd', 0, 'Hämtar fornlämningar, skyddad natur och översvämning');
        const tillZon = epsg === 3006 ? (p => p) : (f => p => f(p))(T.omvandlare(3006, epsg).forward);
        const llTillZon = (f => p => f(p))(T.omvandlare(4326, epsg).forward);
        const b100 = tmRuta({ xmin: r.xmin - 100, ymin: r.ymin - 100, xmax: r.xmax + 100, ymax: r.ymax + 100 }, epsg, 0);
        const bUts = tmRuta(r, epsg, 0);
        const ll = (() => { const t = tillLatLng(epsg), k = T.kantlinje({ xmin: r.xmin - 300, ymin: r.ymin - 300, xmax: r.xmax + 300, ymax: r.ymax + 300 }).map(t);
          return { syd: Math.min(...k.map(q => q[0])), nord: Math.max(...k.map(q => q[0])), vast: Math.min(...k.map(q => q[1])), ost: Math.max(...k.map(q => q[1])) }; })();
        const fel = e => ({ fel: (e && e.message) || 'okänt fel' });
        const [lam, nat, ovs, vat] = await Promise.allSettled([
          Geodata.lamningar(b100, tillZon), Geodata.skyddadNatur(bUts, tillZon), Geodata.oversvamning(bUts), Geodata.vatten(ll, llTillZon),
        ]);
        senaste.lamningar = lam.status === 'fulfilled' ? lam.value : fel(lam.reason);
        senaste.natur = nat.status === 'fulfilled' ? nat.value : fel(nat.reason);
        senaste.oversvamning = ovs.status === 'fulfilled' ? ovs.value : fel(ovs.reason);
        senaste.strand = vat.status === 'fulfilled' ? Platsanalys.narmasteVatten(r, vat.value) : fel(vat.reason);
        if (vat.status === 'fulfilled') senaste.vatten = vat.value;
        if (ovs.status === 'fulfilled') {
          const tillTM = epsg === 3006 ? ((x, y) => [x, y]) : (f => (x, y) => f([x, y]))(T.omvandlare(epsg, 3006).forward);
          senaste.oversvamningBilder = ovs.value.filter(o => o.andel > 0).slice(0, 1).map(o => {
            const s0 = (bUts.xmax - bUts.xmin) / o.bild.width, Wz = Math.ceil((r.xmax - r.xmin) / s0), Hz = Math.ceil((r.ymax - r.ymin) / s0);
            const c = Topowebb.omprojicera({ canvas: o.bild, x0: bUts.xmin, y1: bUts.ymax, s: s0 }, { x0: r.xmin, y1: r.ymax, s: s0, W: Wz, H: Hz }, tillTM);
            return { url: c.toDataURL('image/png'), x0: r.xmin + s0 / 2, y1: r.ymax - s0 / 2, s: s0, W: Wz, H: Hz };
          });
        }
        [['Lämningar', senaste.lamningar], ['Skyddad natur', senaste.natur], ['Översvämning', senaste.oversvamning], ['Strandskydd', senaste.strand]]
          .forEach(([n, v]) => { if (v && v.fel) varningar.push(`${n}: kunde inte hämtas (${v.fel}).`); });
        extraInfo.push('', 'SKYDD OCH RISKER',
          '  Lämningar inom 100 m: ' + (Array.isArray(senaste.lamningar) ? (senaste.lamningar.length ? senaste.lamningar.map(l => `${l.klass}${l.id ? ' ' + l.id : ''}`).join('; ') : 'inga registrerade') : 'kunde inte kontrolleras'),
          '  Skyddad natur: ' + (Array.isArray(senaste.natur) ? (senaste.natur.length ? senaste.natur.map(o => `${o.typ}${o.namn ? ' ' + o.namn : ''}`).join('; ') : 'inget skyddat område') : 'kunde inte kontrolleras'),
          '  Strandskydd (indikation): ' + (senaste.strand && !senaste.strand.fel ? Platsanalysblad.strandText(senaste.strand).lang : 'kunde inte kontrolleras'),
          '  Översvämning: ' + (Array.isArray(senaste.oversvamning) ? senaste.oversvamning.map(o => `${o.namn} ${o.andel > 0.001 ? fmt(o.andel * 100) + ' %' : 'nej'}`).join(', ') : 'kunde inte kontrolleras'),
          '  ' + Object.values(Geodata.KALLOR).join(' '));
        sammanExtra.push(['Skydd och risker', [Array.isArray(senaste.lamningar) ? `${senaste.lamningar.length} lämningar` : null, Array.isArray(senaste.natur) ? `${senaste.natur.length} skyddade områden` : null].filter(Boolean).join(', ') || 'se varningar']);
        visaSkydd(senaste, epsg, bUts);
      }

      // --- Sektioner
      if (sektioner.length) {
        try {
          // profilen ritas från vänster till höger sett i blickriktningen: A→B normalt, B→A om linjen är vänd
          const sek = sektioner.map(s => Object.assign({ namn: s.namn, a: s.a, b: s.b, vand: s.vand }, s.vand ? Analys.sektion(s.b, s.a, dtmZ, pz) : Analys.sektion(s.a, s.b, dtmZ, pz)));
          senaste.sektioner = sek;
          filer[`sektioner/${namn}_sektioner.dxf`] = Analys.dxfSektioner(sek, Z0);
          filer[`sektioner/${namn}_sektionslinjer_lokal.dxf`] = Analys.dxfSektionslinjer(sek, r, X0, Y0);
          filer[`sektioner/${namn}_sektionslinjer_sweref.dxf`] = Analys.dxfSektionslinjer(sek, r, 0, 0);
          extraInfo.push('', 'SEKTIONER',
            `  ${sek.map(s => `${s.namn}–${s.namn} ${fmt(s.langd, 1)} m`).join(', ')}.`,
            '  Blickriktningen visas med pilar i _sektionslinjer-filerna. Profilen ritas så som den syns i blickriktningen.',
            '  _sektioner.dxf: x = avstånd längs linjen (m), y = höjd i RH 2000' + (Z0 ? ` minus Z0 (${fmt(Z0, 3)})` : '') + '. Sektionerna ligger under varandra.',
            '  Lager: SEKTION_MARK (marken), SEKTION_YTA (övre kontur av träd och byggnader), SEKTION_PUNKTER (laserpunkter inom 2 m),',
            '         SEKTION_REF (referenslinje med avstånd var 10:e meter), SEKTION_TEXT.',
            ...(pz ? [] : ['  Laserdata saknas, så sektionerna visar bara marken.']));
          sammanExtra.push(['Sektioner', sek.map(s => s.namn).join(', ')]);
        } catch (e) { console.error(e); varningar.push('Sektioner: ' + e.message); }
      }

      // --- Fastighetsindelning
      if (val.fastigheter) {
        try {
          delFramsteg('fastigheter', 0, 'Hämtar fastighetsindelning');
          await laddaSkript('vendor/sql-wasm.js');
          const kommuner = kommunerIUtsnitt();
          if (!kommuner.length) throw new Error('kunde inte avgöra vilken kommun området ligger i.');
          const fi = await Fastighet.hamta({
            kommuner, utsnitt: r, epsg, auth,
            logg: t => visaStatus(t),
            framsteg: f => delFramsteg('fastigheter', f * 0.9),
            bekrafta: async storlek => window.confirm(`Fastighetsindelningen för kommunen är ${fmt(storlek / 1e6)} MB. Den hämtas en gång och sparas sedan i webbläsaren. Vill du hämta den?`),
          });
          senaste.fastigheter = fi;
          filer[`fastigheter/${namn}_fastigheter_lokal.dxf`] = Fastighet.dxf(fi, r, X0, Y0);
          filer[`fastigheter/${namn}_fastigheter_sweref.dxf`] = Fastighet.dxf(fi, r, 0, 0);
          const pl = Fastighet.perLager(fi);
          extraInfo.push('', 'FASTIGHETSINDELNING',
            '  Källa: Fastighetsindelning Nedladdning, vektor. © Lantmäteriet. Bearbetad: utklippt och omprojicerad. Licens: CC BY 4.0.',
            ...Fastighet.VARNING.match(/.{1,100}(\s|$)/g).map(t => '  ' + t.trim()),
            '  DXF-lager:',
            ...Object.keys(pl).sort().map(l => `    ${l}: ${pl[l]} linjer`),
            `    _OSAKER i lagernamnet: lägesosäkerhet över ${Fastighet.OSAKER} m enligt registret.`,
            `    GRANSPUNKT: ${fi.punkter.length} gränspunkter. FASTIGHET_BETECKNING: beteckningen inne i varje område.`,
            `  Fastigheter som utsnittet berör (${fi.fastigheter.length}), största delen först:`,
            ...fi.fastigheter.map(f => `    ${f.beteckning}${f.kommun ? ', ' + f.kommun : ''}: ${fmt(f.yta)} m² inom utsnittet` + (f.typ !== 'fastighetsområde' ? ` (${f.typ})` : '')));
          sammanExtra.push(['Fastigheter', `${fi.fastigheter.length} st`]);
          const fstil = g => ({ color: farg('fastighet'), weight: 1.6, opacity: 0.95, dashArray: g.osakerhet > Fastighet.OSAKER ? '6 5' : null, interactive: true });
          const fgrp = L.featureGroup([
            ...fi.granser.map(g => L.polyline(g.pts.map(tt), fstil(g))
              .bindTooltip(`${esc(g.typ)}${g.osakerhet != null ? `, osäkerhet ${fmt(g.osakerhet, 2)} m` : ''}${g.metod ? `<br><small>${esc(g.metod)}</small>` : ''}`, { sticky: true })),
            ...fi.ytor.filter(y => y.ankare).map(y => L.marker(tt(y.ankare), { interactive: false, keyboard: false,
              icon: L.divIcon({ className: 'fastighet-etikett', html: `<span>${esc(y.etikett)}</span>`, iconSize: null }) })),
          ]);
          visaResultatLager('fastigheter', fgrp, () => fgrp.eachLayer(l => { if (l.setStyle) l.setStyle({ color: farg('fastighet') }); }));
          visaLagring();
        } catch (e) { console.error(e); varningar.push('Fastighetsindelning: ' + e.message); }
      }

      // --- Marktäcke
      if (val.marktacke) {
        try {
          delFramsteg('marktacke', 0, 'Hämtar marktäcke');
          await laddaSkript('vendor/sql-wasm.js');
          const kommuner = kommunerIUtsnitt();
          if (!kommuner.length) throw new Error('kunde inte avgöra vilken kommun området ligger i.');
          const m = await Marktacke.hamtaUtsnitt({
            kommuner, utsnitt: r, epsg, auth,
            logg: t => visaStatus(t),
            framsteg: f => delFramsteg('marktacke', f * 0.9),
            bekrafta: async storlek => window.confirm(`Marktäcket för kommunen är ${fmt(storlek / 1e6)} MB. Det hämtas en gång och sparas sedan i webbläsaren. Vill du hämta det?`),
          });
          senaste.marktacke = m;
          filer[`marktacke/${namn}_marktacke_lokal.dxf`] = Marktacke.dxf(m, r, X0, Y0);
          filer[`marktacke/${namn}_marktacke_sweref.dxf`] = Marktacke.dxf(m, r, 0, 0);
          const typer = Object.keys(m.klasser).sort();
          extraInfo.push('', 'MARKTÄCKE',
            '  Källa: Marktäcke Nedladdning, vektor. © Lantmäteriet. Bearbetad: utklippt och omprojicerad.',
            '  Licens: CC BY 4.0.',
            `  Kommuner: ${kommuner.map(kod => { const f = state.kommuner.find(x => x.properties.kod === kod); return f ? `${f.properties.namn} (${kod})` : kod; }).join(', ')}`,
            '  DXF-lager (slutna polylinjer, ett lager per typ):',
            ...(ln => typer.map(t => `    ${ln[t]}: ${t}, ${m.klasser[t]} st`))(Marktacke.lagerNamn(m.ytor.map(y => y.klass).concat(m.linjer.map(l => l.klass)))));
          sammanExtra.push(['Marktäcke', `${typer.length} typer, ${m.ytor.length} ytor`]);
          visaResultatLager('marktacke', L.layerGroup(m.ytor.map(y => {
            const f = Marktacke.farg(y.klass);
            return L.polygon(y.ringar.map(ring => ring.map(tt)), { color: f.css, weight: 0.8, fillColor: f.css, fillOpacity: 0.3 }).bindTooltip(y.klass, { sticky: true });
          })));
          visaLagring();
        } catch (e) { console.error(e); varningar.push('Marktäcke: ' + e.message); }
      }

      // --- Ortofoto
      if (val.ortofoto) {
        try {
          delFramsteg('ortofoto', 0, 'Söker ortofoto');
          const tmR = tmRuta(r, epsg);
          const v = Ortofoto.valj(await Ortofoto.sok(tmR), tmR);
          if (!v) throw new Error('det finns inget ortofoto i färg för området.');
          const s = Ortofoto.upplosning(r, v.upplosning), mal = Ortofoto.rutnat(r, s);
          delFramsteg('ortofoto', 0.05, `Läser ortofoto från ${v.ar}`);
          const b = await Ortofoto.las(v.valda, mal, epsg, auth, { framsteg: f => delFramsteg('ortofoto', 0.05 + 0.8 * f) });
          if (!b.tackt) throw new Error('bildfilerna innehöll ingen bild inom utsnittet.');
          delFramsteg('ortofoto', 0.9, 'Sparar ortofotot');
          const c = document.createElement('canvas'); c.width = b.W; c.height = b.H;
          const cx = c.getContext('2d');
          cx.putImageData(new ImageData(b.rgba, b.W, b.H), 0, 0);
          // JPEG saknar genomskinlighet: tomma delar blir vita
          const jc = document.createElement('canvas'); jc.width = b.W; jc.height = b.H;
          const jx = jc.getContext('2d'); jx.fillStyle = '#ffffff'; jx.fillRect(0, 0, b.W, b.H); jx.drawImage(c, 0, 0);
          const bild = jc.toDataURL('image/jpeg', 0.88);
          const x0c = mal.x0 + s / 2, y1c = mal.y1 - s / 2;     // mitten av övre vänstra pixeln
          filer[`ortofoto/${namn}_ortofoto.jpg`] = await (await fetch(bild)).arrayBuffer();
          filer[`ortofoto/${namn}_ortofoto_sweref.jgw`] = Analys.varldsfil(x0c, y1c, s);
          filer[`ortofoto/${namn}_ortofoto_lokal.jgw`] = Analys.varldsfil(x0c, y1c, s, X0, Y0);
          senaste.ortofoto = { bild, x0: x0c, y1: y1c, W: b.W, H: b.H, s, canvas: jc, ar: v.ar };
          const sTxt = String(s).replace('.', ',');
          extraInfo.push('', 'ORTOFOTO',
            '  Källa: ' + Ortofoto.kallText(v) + ' © Lantmäteriet. Bearbetad: utklippt och omprojicerad.',
            '  Licens: CC BY 4.0.',
            `  Rutor: ${b.rutor.join(', ')}`,
            `  Bild: ${b.W} × ${b.H} pixlar, ${sTxt} m per pixel, i ${T.zon(epsg).namn}. JPEG utan genomskinlighet; delar utan bild är vita.`,
            '  Byt namn på en av .jgw-filerna så att den heter som bilden för att få den på rätt plats (lokalt eller SWEREF).');
          if (b.tackt < 0.995) varningar.push(`Ortofoto: bara ${fmt(b.tackt * 100)} % av utsnittet har bild från ${v.ar}.`);
          sammanExtra.push(['Ortofoto', `flygår ${v.ar}, ${sTxt} m per pixel`]);
          // på kartan i lägre upplösning (stora bilder blir tunga som överlägg)
          const f = Math.max(1, Math.ceil(Math.max(b.W, b.H) / 2048));
          const liten = document.createElement('canvas'); liten.width = Math.ceil(b.W / f); liten.height = Math.ceil(b.H / f);
          liten.getContext('2d').drawImage(c, 0, 0, b.W / f, b.H / f);
          const kb = bildTillKarta(liten, mal.x0 + s * f / 2, mal.y1 - s * f / 2, s * f, epsg);
          visaResultatLager('ortofoto', L.imageOverlay(kb.url, kb.bounds, { pane: 'ortofotoPane', interactive: false }));
        } catch (e) { console.error(e); varningar.push('Ortofoto: ' + e.message); }
      }

      // --- Stompunkter
      if (val.stompunkter) {
        try {
          delFramsteg('stompunkter', 0, 'Hämtar stompunkter');
          const sp = await Stompunkt.hamta({ utsnitt: r, epsg, auth });
          senaste.stompunkter = sp;
          filer[`stompunkter/${namn}_stompunkter_lokal.dxf`] = Stompunkt.dxf(sp, r, X0, Y0, Z0);
          filer[`stompunkter/${namn}_stompunkter_sweref.dxf`] = Stompunkt.dxf(sp, r, 0, 0, 0);
          filer[`stompunkter/${namn}_stompunkter.csv`] = Stompunkt.csv(sp, X0, Y0, Z0);
          extraInfo.push('', 'STOMPUNKTER',
            '  Källa: Stompunkt Direkt, Lantmäteriet. Öppna data med villkor enligt CC0.',
            `  ${sp.length} punkter inom utsnittet (förstörda punkter ingår inte). Koordinater i ${T.zon(epsg).namn}, höjder i RH 2000.`,
            '  DXF-lager: STOMPUNKT_PLAN, STOMPUNKT_HOJD (punkt på rätt höjd och kryss), STOMPUNKT_TEXT (namn och höjd minus Z0).',
            '  CSV (semikolon): koordinater, lokala koordinater, kvalitet, osäkerhet, markering, lägesbeskrivning och länk till skiss.',
            ...sp.map(p => `    ${p.namn || p.id}: ${p.typ}, ${p.x.toFixed(3)} ${p.y.toFixed(3)}${p.z != null ? ' +' + p.z.toFixed(3) : ''}`));
          sammanExtra.push(['Stompunkter', `${sp.length} st`]);
          const spStil = () => ({ color: farg('sp'), weight: 2, fillColor: farg('sp-fyll'), fillOpacity: 1 });
          const spGrp = L.featureGroup(sp.map(p => L.circleMarker(tt([p.x, p.y]), Object.assign({ radius: 6 }, spStil()))
            .bindPopup(`<strong>${p.namn || p.id}</strong><br>${p.typ}${p.kategori ? ', ' + p.kategori : ''}<br>${p.z != null ? 'Höjd ' + fmt(p.z, 3) + ' m (RH 2000)<br>' : ''}${p.markering ? 'Markering: ' + p.markering + '<br>' : ''}${p.beskrivning ? '<small>' + p.beskrivning + '</small>' : ''}`)));
          visaResultatLager('stompunkter', spGrp, () => spGrp.setStyle(spStil()));
        } catch (e) { console.error(e); varningar.push('Stompunkter: ' + e.message); }
      }

      // --- Vägar från OpenStreetMap
      if (val.vagar) {
        try {
          delFramsteg('vagar', 0, 'Hämtar vägar från OpenStreetMap');
          const v = await Vagar.hamta({ utsnitt: r, epsg });
          senaste.vagar = v;
          // utkast till vägytorna (0.11.0): bredden ur OSM, mätt i ortofotot eller schablonen
          if (val.vagytor) {
            delFramsteg('vagar', 0.4, senaste.ortofoto ? 'Mäter vägarnas bredd i ortofotot' : 'Ritar vägytorna');
            await new Promise(res => setTimeout(res, 0));
            v.ytor = Vagar.utkast(v, r, ortofotoPixlar(senaste.ortofoto));
          }
          const slagFil = { bil: 'vagar', gang: 'gangvagar' };
          for (const sl of ['bil', 'gang']) {
            if (!v.linjer.some(l => l.slag === sl)) continue;
            filer[`vagar/${namn}_${slagFil[sl]}_lokal.dxf`] = Vagar.dxf(v, r, X0, Y0, { slag: sl });
            filer[`vagar/${namn}_${slagFil[sl]}_sweref.dxf`] = Vagar.dxf(v, r, 0, 0, { slag: sl });
          }
          const per = {};
          v.linjer.forEach(l => { per[l.lager] = (per[l.lager] || 0) + 1; });
          const antalSlag = sl => v.linjer.filter(l => l.slag === sl).length;
          const y = v.ytor, kallText = { osm: 'bredd i OSM', korfalt: 'antal körfält i OSM', ortofoto: 'mätt i ortofotot', schablon: 'schablon för vägtypen' };
          const perKalla = {};
          if (y) y.profiler.forEach(p => { perKalla[p.kalla] = (perKalla[p.kalla] || 0) + 1; });
          extraInfo.push('', 'VÄGAR',
            '  Källa: © OpenStreetMap-bidragsgivare, licens ODbL (www.openstreetmap.org/copyright). Hämtat via Overpass API.',
            '  Mittlinjer i 2D (Z = 0), klippta mot utsnittet. Kvaliteten varierar; kontrollera mot grundkartan.',
            `  Bilvägar och gångvägar i varsin fil: _vagar (${antalSlag('bil')} linjer) och _gangvagar (${antalSlag('gang')} linjer).`,
            '  DXF-lager:',
            ...Object.keys(Vagar.KLASSER).filter(k => per[k]).map(k => `    ${k}: ${Vagar.KLASSER[k].namn}, ${per[k]} linjer`),
            ...(y ? [
              '  VÄGYTOR (utkast): slutna polylinjer i lagren VAG_YTA_BIL och VAG_YTA_GANG, ihopslagna i korsningarna.',
              '    Bredden kommer från OSM:s bredd eller antal körfält när de finns, annars en schablon för vägtypen.'
                + (y.medBild ? ' Bilvägarnas bredd och läge är mätta i ortofotot där vägbanan syns (färgen mitt på vägen följs ut till kanterna).' : ' Kryssa i Ortofoto för att mäta bilvägarnas bredd i bilden.'),
              `    ${Object.keys(perKalla).map(k => `${perKalla[k]} ${perKalla[k] === 1 ? 'väg' : 'vägar'}: ${kallText[k]}`).join(', ')}.`,
              '    Träd över vägen, skuggor, parkeringar och infarter gör mätningen osäker. Ett utkast att rätta, inte en inmätning.',
            ] : []));
          sammanExtra.push(['Vägar', `${antalSlag('bil')} bilvägar, ${antalSlag('gang')} gångvägar (OSM)` + (y ? `, ytor ${y.matta ? `(${y.matta} mätta i ortofotot)` : '(schablon)'}` : '')]);
          visaVagar(v, tt);
        } catch (e) { console.error(e); varningar.push('Vägar: ' + e.message); }
      }

      // --- Soldiagram, med horisont om den är vald
      if (val.sol) {
        try {
          delFramsteg('sol', 0, val.horisont ? 'Räknar horisont' : 'Ritar soldiagram');
          let extra = {};
          if (val.horisont) {
            const rTM = tmRuta(r, epsg, 0);
            const medTomt = $('hor-tomt').checked;
            const utesluts = medTomt ? null : (E, N) => E >= rTM.xmin && E <= rTM.xmax && N >= rTM.ymin && N <= rTM.ymax;
            const bara = { ...mos, s: 1 };
            let nara = pTM ? Analys.ytmodellTM(mos, pTM, { utesluts }) : bara;
            if (senaste.volymer.length) {   // skissen räknas med i horisonten
              const tm = epsg === 3006 ? (q => q) : T.omvandlare(epsg, 3006).forward;
              const volTM = senaste.volymer.map(v => Object.assign({}, v, { fotavtryck: v.fotavtryck.map(q => tm(q)) }));
              nara = Object.assign({}, nara, { data: Platsanalys.branInVolymer({ x0: nara.E0 + 0.5, y1: nara.N1 - 0.5, s: 1, W: nara.w, H: nara.h }, nara.data, volTM) });
            }
            // står punkten i ett hus eller under en krona räknas det objektet bort
            const rensat = pTM ? Analys.rensaVidPunkt(nara, mos, mittTM[0], mittTM[1]) : 0;
            const fjarr = await T.lasHojderGrov({ xmin: mittTM[0] - 5000, xmax: mittTM[0] + 5000, ymin: mittTM[1] - 5000, ymax: mittTM[1] + 5000 }, 8, auth);
            const z0 = T.sampla(mos, mittTM[0], mittTM[1]) + ogon;
            const konvH = konvergens(3006, horLL.lat, horLL.lon);
            const varText = state.horPunkt ? 'i vald punkt' : 'i utsnittets mitt';
            const hor = Analys.horisont(mittTM[0], mittTM[1], z0, nara, fjarr, konvH);
            const horMark = pTM ? Analys.horisont(mittTM[0], mittTM[1], z0, bara, fjarr, konvH) : null;
            const ogonTxt = String(ogon).replace('.', ',');
            const rensatTxt = rensat ? ` Ett träd eller en byggnad (${fmt(rensat)} m²) står på punkten och räknas inte.` : '';
            extra = {
              horisont: hor,
              horisontMark: horMark,
              horisontPunkt: `${ogonTxt} m över mark ${varText}`,
              horisontText: `Horisont: terräng, sedd ${ogonTxt} m över mark ${varText}.`,
              horisontNot: `Horisont ur Markhöjdmodell (5 km)${pTM ? ` och Laserdata skog ${laserDatum} (400 m)` : ''}.` +
                (pTM ? (medTomt ? ' Träd och byggnader inom utsnittet ingår.' : ' Träd och byggnader inom utsnittet ingår inte.') + rensatTxt : ' Laserdata saknas, så bara terrängen ingår.'),
            };
            senaste.horisont = hor;
            extraInfo.push('', 'HORISONT',
              `  Sedd ${state.horPunkt ? `från vald punkt (X ${fmt(franLL(state.horPunkt)[0])}, Y ${fmt(franLL(state.horPunkt)[1])})` : 'från utsnittets mitt'}, ${ogonTxt} m över mark (${fmt(z0, 2)} m i RH 2000).`,
              `  Terräng inom 5 km (8 m upplösning) och ${pTM ? 'träd och byggnader inom 400 m' : 'ingen laserdata'}. Jordkrökning och refraktion är med.`,
              ...(rensat ? [`  Punkten står i eller under ett träd eller en byggnad (${fmt(rensat)} m²). Det objektet räknas inte.`] : []),
              `  Horisontens höjdvinkel var 15:e grad (azimut: ${horMark ? 'terräng / med träd och byggnader' : 'vinkel'}):`,
              '    ' + Array.from({ length: 24 }, (_, i) => `${i * 15}°: ${horMark ? fmt(Math.max(0, horMark[i * 30]), 1) + ' / ' : ''}${fmt(Math.max(0, hor[i * 30]), 1)}°`).join(', '));
          }
          const sd = await skapaSoldiagram(extra);
          senaste.solOpt = sd.opt;
          filer[`soldiagram/soldiagram_${SOL_AR}_svart.pdf`] = sd.svart;
          filer[`soldiagram/soldiagram_${SOL_AR}_vit.pdf`] = sd.vit;
          extraInfo.push('', 'SOLDIAGRAM',
            `  Dagjämningar och solstånd ${SOL_AR} för utsnittets mitt, ${fmt(mitt.lat, 4)}° N ${fmt(mitt.lon, 4)}° Ö.`,
            '  Beräknat med NOAA:s solalgoritm och Meeus, kontrollerat mot NREL SPA.');
          sammanExtra.push(['Soldiagram', `${SOL_AR}${val.horisont ? ', med horisont' : ''}`]);
        } catch (e) { console.error(e); varningar.push('Soldiagram: ' + e.message); }
      }
      // --- Platsanalysbladet
      if (val.platsanalys) {
        try {
          delFramsteg('blad', 0, 'Ritar platsanalysbladet');
          await laddaPdf();
          const kap = kapitel();
          const kallor = [['Markhöjdmodell', pTM && 'Laserdata skog', val.byggnader && 'Byggnad', val.fastigheter && 'Fastighetsindelning', val.marktacke && 'Marktäcke']
            .filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' och $1') + ': © Lantmäteriet (CC BY 4.0).'];
          if (val.fastigheter) kallor.push(Fastighet.VARNING);
          if (val.skydd) kallor.push(...Object.values(Geodata.KALLOR));
          if (val.sol) kallor.push('Solens läge: NOAA:s solalgoritm och Meeus, kontrollerat mot NREL SPA.');
          kallor.push(`Skapat ${idag()} med höjdkurvor.se ${window.HOJDKURVOR ? window.HOJDKURVOR.version : ''}.`);
          filer[`platsanalys/${namn}_platsanalys.pdf`] = Platsanalysblad.skapa({
            fonter, r, kurvor: res.kurvor, markhojd: { lo: res.lo, hi: res.hi },
            titel: { projekt: projekt || namn, kommun: kommunText(), system: `${T.zon(epsg).namn}, RH 2000`, datum: idag() },
            kapitel: { sol: kap.sol, terrang: kap.terrang, vatten: kap.vatten, skydd: kap.skydd },
            lutning: senaste.lutning, skyfall: senaste.skyfall, volymer: senaste.volymer, byggnader: senaste.byggnader, fastigheter: senaste.fastigheter,
            sol: kap.sol ? senaste.solOpt : null, skuggor: kap.sol ? senaste.skuggOpt : null,
            solSammanfattning: senaste.horisont ? [['Horisont', state.horPunkt ? 'från vald punkt, se blad 2' : 'från utsnittets mitt, se blad 2']] : null,
            natur: senaste.natur, lamningar: senaste.lamningar, oversvamning: senaste.oversvamning, oversvamningBilder: senaste.oversvamningBilder, strand: senaste.strand,
            kallor,
          });
          sammanExtra.push(['Platsanalys', 'blad i PDF']);
        } catch (e) { console.error(e); varningar.push('Platsanalysbladet: ' + e.message); }
      }
      if (extraInfo.length) filer[infoNamn] = res.filer[infoNamn] + extraInfo.join('\r\n') + '\r\n';

      // --- Paketera
      visaStatus('Packar zip-filen …');
      matare(99);
      const zip = new JSZip();
      const mapp = namn.replace(/[^\wåäöÅÄÖ.-]+/g, '_');
      Object.entries(filer).forEach(([fil, innehall]) => zip.file(fil, innehall));
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      state.zipBlob = blob; state.zipNamn = `${mapp}.zip`;
      $('ladda-ner').textContent = `Ladda ner ${mapp}.zip (${fmt(blob.size / 1e6, 1)} MB)`;

      const rader = [
        ['Nollpunkt', `X ${fmt(res.X0, res.X0 % 1 ? 3 : 0)}, Y ${fmt(res.Y0, res.Y0 % 1 ? 3 : 0)}` + (res.Z0 ? `, Z ${fmt(res.Z0, 3)}` : '') + (res.egen ? ' (egen)' : '')],
        ...(vrid ? [['Vridning', `${fmt(vrid, 2)}° medurs (${vridText})`]] : []),
        ['System', T.zon(epsg).namn],
        ['Storlek', `${fmt(r.xmax - r.xmin)} × ${fmt(r.ymax - r.ymin)} m`],
        ['Markhöjd', `${fmt(res.lo, 2)}–${fmt(res.hi, 2)} m`],
        ['Kurvor', `${fmt(res.kurvor.length)} linjer`],
        ...sammanExtra,
        ['Filer', Object.keys(filer).length + ' st i zip-filen'],
      ];
      const dl = $('sammanfattning');
      dl.innerHTML = '';
      rader.forEach(([a, b]) => { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = a; dd.textContent = b; dl.append(dt, dd); });
      state.senaste = senaste;
      visaSkugga();
      $('resultat').hidden = false;
      $('visa-3d').hidden = !senaste.rutnat;
      $('skapa').classList.add('gjord');
      matare(null);
      visaStatus(varningar.length ? varningar.join('\n') : 'Klart. Resultatet visas på kartan som kontroll.', false);

      const stil = {
        HOJDKURVA_10M: { weight: 2.4, opacity: 1 }, HOJDKURVA_5M: { weight: 1.7, opacity: 0.95 }, HOJDKURVA_1M: { weight: 1, opacity: 0.85 },
        HOJDKURVA_0_5M: { weight: 0.6, opacity: 0.7 }, HOJDKURVA_0_25M: { weight: 0.4, opacity: 0.6 },
      };
      const kGrp = L.featureGroup(res.kurvor.map(k => {
        const pts = k.pts.map(tt);
        if (k.sluten) pts.push(pts[0]);
        return L.polyline(pts, Object.assign({ color: farg('kurva'), renderer: kurvRitare, interactive: false }, stil[k.lager]));
      }));
      visaResultatLager('kurvor', kGrp, () => kGrp.setStyle({ color: farg('kurva') }));
      fyllUtskrift();
      visaPaKartan();
      $('resultat').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (window.innerWidth >= 760) lagerpanel.classList.remove('ihop');
    } catch (err) {
      matare(null);
      if (err instanceof T.InloggningsFel) { visaStatus(err.message, true); $('anv').focus(); }
      else { console.error(err); visaStatus((err && err.message) || 'Något gick fel när underlaget skapades.', true); }
    } finally {
      knapp.disabled = false;
      T.lokal.vrid = 0;
    }
  });

  $('ladda-ner').addEventListener('click', async () => {
    if (!state.zipBlob) return;
    const mal = await valjFil(state.zipNamn, 'application/zip', 'Zip-fil');
    if (mal === AVBRUTET) return;
    try { await skrivFil(mal, state.zipBlob, state.zipNamn); } catch (e) { console.error(e); visaStatus('Filen kunde inte sparas: ' + e.message, true); }
  });

  // ------------------------------------------------------------------
  // Skalenlig utskrift: speglar lagren som är på i kartan
  // ------------------------------------------------------------------
  const prInst = lager.las('localStorage', 'terrang-utskrift') || {};
  ['pr-format', 'pr-orient', 'pr-bg'].forEach(id => { if (prInst[id]) $(id).value = prInst[id]; });
  ['pr-siffror', 'pr-rutnat', 'pr-noll'].forEach(id => { if (id in prInst) $(id).checked = !!prInst[id]; });
  function sparaPr() {
    const v = {};
    ['pr-format', 'pr-orient', 'pr-bg'].forEach(id => { v[id] = $(id).value; });
    ['pr-siffror', 'pr-rutnat', 'pr-noll'].forEach(id => { v[id] = $(id).checked; });
    lager.spara('localStorage', 'terrang-utskrift', v);
  }
  $('lp-skriv').addEventListener('click', () => {
    const ruta = $('lp-utskrift'), visa = ruta.hidden;
    ruta.hidden = !visa;
    $('lp-skriv').setAttribute('aria-expanded', String(visa));
    if (visa) { fyllUtskrift(); requestAnimationFrame(() => $('pr-skapa').scrollIntoView({ block: 'nearest' })); }
  });
  function fyllUtskrift() {
    const s = state.senaste;
    if (!s) return;
    $('pr-skala').value = String(Utskrift.foreslaSkala(s.r, $('pr-format').value, $('pr-orient').value === '1'));
    passar();
  }
  function passar() {
    const s = state.senaste;
    if (!s || !$('pr-passar')) return;
    const [W, H] = Utskrift.papper($('pr-format').value, $('pr-orient').value === '1');
    const sk = +$('pr-skala').value, bw = (s.r.xmax - s.r.xmin) * 1000 / sk, bh = (s.r.ymax - s.r.ymin) * 1000 / sk;
    $('pr-passar').textContent = `Utsnittet blir ${fmt(bw)} × ${fmt(bh)} mm.` + (bw > W - 20 || bh > H - 56 ? ' Det får inte plats helt.' : '');
    const lm = state.bakgrund === 'lm';
    $('pr-bg-rad').hidden = !lm;
    $('pr-bg-info').textContent = lm
      ? (sk <= 500 ? 'Lantmäteriets karta är grov i den här skalan (0,5 m per pixel) och blir suddig.' : 'Bakgrund: Lantmäteriets karta.')
      : 'OpenStreetMap och terrängkartan kan inte skrivas ut. Välj LANTMÄTERIET som bakgrund för att få med en karta.';
  }
  ['pr-format', 'pr-orient'].forEach(id => $(id).addEventListener('change', () => {
    if (state.senaste) $('pr-skala').value = String(Utskrift.foreslaSkala(state.senaste.r, $('pr-format').value, $('pr-orient').value === '1'));
    passar(); sparaPr();
  }));
  $('pr-skala').addEventListener('change', passar);
  ['pr-bg', 'pr-siffror', 'pr-rutnat', 'pr-noll'].forEach(id => $(id).addEventListener('change', sparaPr));

  const MFARG = klass => {
    const k = klass.toLowerCase();
    if (/sjö|vatten|hav/.test(k)) return [205, 225, 243];
    if (/skog|barr|löv|bland/.test(k)) return [222, 236, 214];
    if (/åker|odling/.test(k)) return [244, 238, 205];
    if (/bebyggelse|industri/.test(k)) return [238, 222, 222];
    if (/myr|sank|våtmark/.test(k)) return [215, 234, 232];
    return [238, 238, 236];
  };

  /** Lantmäteriets karta för utskriftens kartfält, omritad till zonen. */
  async function utskriftsbakgrund(s, format, liggande, skala, lage) {
    const a = inloggning();
    if (!a) throw new Error('fyll i inloggningen till Lantmäteriet för att få med kartan.');
    const falt = Utskrift.kartfalt(s.r, format, liggande, skala);
    const tillTM = s.epsg === 3006 ? ((x, y) => [x, y]) : (f => (x, y) => f([x, y]))(T.omvandlare(s.epsg, 3006).forward);
    const hörn = [[falt.xmin, falt.ymin], [falt.xmax, falt.ymin], [falt.xmax, falt.ymax], [falt.xmin, falt.ymax]].map(([x, y]) => tillTM(x, y));
    const tm = { xmin: Math.min(...hörn.map(p => p[0])) - 10, xmax: Math.max(...hörn.map(p => p[0])) + 10, ymin: Math.min(...hörn.map(p => p[1])) - 10, ymax: Math.max(...hörn.map(p => p[1])) + 10 };
    const k = await Topowebb.oppna(a);
    const b = await Topowebb.bild(k, tm, skala * 0.0254 / 150);
    if (!b.hittade) throw new Error('Lantmäteriets karta saknas för området.');
    const sMal = Math.max(b.s / 1.5, (falt.xmax - falt.xmin) / 5000);
    const W = Math.ceil((falt.xmax - falt.xmin) / sMal), H = Math.ceil((falt.ymax - falt.ymin) / sMal);
    const c = Topowebb.omprojicera(b, { x0: falt.xmin, y1: falt.ymax, s: sMal, W, H }, tillTM);
    Topowebb.tona(c, lage);
    return { bild: c.toDataURL('image/jpeg', 0.86), x0: falt.xmin, y1: falt.ymax, W, H, s: sMal, niva: b.niva };
  }

  $('pr-skapa').addEventListener('click', async () => {
    const s = state.senaste;
    if (!s) return;
    const knapp = $('pr-skapa');
    const format = $('pr-format').value, liggande = $('pr-orient').value === '1', skala = +$('pr-skala').value;
    const filnamn = `${s.namn}_1-${skala}_${format.toUpperCase()}.pdf`;
    const mal = await valjFil(filnamn, 'application/pdf', 'PDF');
    if (mal === AVBRUTET) return;
    knapp.disabled = true; knapp.textContent = 'SKAPAR …';
    try {
      await laddaPdf();
      const syns = id => resultat[id] && synlig(id);
      let bakgrund = null, bgFel = '';
      if (state.bakgrund === 'lm') {
        try { bakgrund = await utskriftsbakgrund(s, format, liggande, skala, $('pr-bg').value); } catch (e) { console.error(e); bgFel = e.message; }
      }
      const sk = syns('skugga') && s.skuggor && s.skuggor[state.skuggaVal];
      const np = s.nollpunkt;
      const pdf = Utskrift.plan({
        format, liggande, skala, utsnitt: s.r, fonter,
        lager: {
          bakgrund,
          ortofoto: syns('ortofoto') ? s.ortofoto : null,
          kurvor: syns('kurvor') ? s.kurvor : null, siffror: syns('kurvor') && $('pr-siffror').checked,
          fastigheter: syns('fastigheter') && s.fastigheter ? s.fastigheter : null,
          byggnader: syns('byggnader') && s.byggnader ? s.byggnader.map(b => Object.assign({ centrum: Byggnad.tyngdpunkt(b.fotavtryck) }, b)) : null,
          marktacke: syns('marktacke') ? s.marktacke : null, marktackeFarg: MFARG,
          hom: syns('hom') ? s.hom : null,
          skuggor: sk ? { konturer: sk.konturer, etikett: `${KORT_DATUM[sk.k]} kl ${sk.etikett}` } : null,
          trad: syns('trad') ? s.trad : null, stompunkter: syns('stompunkter') ? s.stompunkter : null, dz: s.Z0 || 0,
          vagar: vagarTillUtskrift(s.vagar, syns),
          lutning: syns('lutning') && s.lutning ? s.lutning.bild : null, skyfall: syns('skyfall') ? s.skyfall : null,
          hojdpunkter: syns('hojdpunkter') ? s.hojdpunkter : null, volymer: synlig('volymer') && s.volymer && s.volymer.length ? s.volymer : null,
          sektioner: s.sektioner && synlig('sektioner') ? s.sektioner : null,
          nollpunkt: $('pr-noll').checked ? np : null, ram: true, rutnat: $('pr-rutnat').checked,
        },
        titel: { projekt: s.projekt || s.namn, kommun: s.kommun, system: `Koordinatsystem ${T.zon(s.epsg).namn}`, datum: idag(),
          ekvidistans: `${String(s.intervall).replace('.', ',')} m`,
          kallor: ['© Lantmäteriet (CC BY 4.0)', bakgrund ? 'Bakgrund: Topografisk webbkarta' : '', syns('vagar') || syns('gangvagar') ? 'Vägar © OpenStreetMap-bidragsgivare (ODbL)' : '', 'Underlag för tidiga skeden.'].filter(Boolean).join('. ') },
      });
      await skrivFil(mal, new Blob([pdf], { type: 'application/pdf' }), filnamn);
      if (bgFel) lagerpanelMeddelande('PDF:en skapades utan bakgrundskarta: ' + bgFel);
    } catch (e) {
      console.error(e);
      lagerpanelMeddelande('Utskriften kunde inte skapas: ' + e.message);
    } finally { knapp.disabled = false; knapp.textContent = 'SKAPA PDF'; }
  });

  // ------------------------------------------------------------------
  // Nya lager: höjdpunkter, lutning, skyfall, skydd och risker
  // ------------------------------------------------------------------
  /** Klipper ett nodraster (lutning) till utsnittet. */
  function klippRaster(lt, r) {
    const i0 = Math.max(0, Math.round((r.xmin - lt.x0) / lt.s)), i1 = Math.min(lt.W - 1, Math.round((r.xmax - lt.x0) / lt.s));
    const j0 = Math.max(0, Math.round((lt.y1 - r.ymax) / lt.s)), j1 = Math.min(lt.H - 1, Math.round((lt.y1 - r.ymin) / lt.s));
    const W = i1 - i0 + 1, H = j1 - j0 + 1, klass = new Uint8Array(W * H), varde = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { klass[j * W + i] = lt.klass[(j + j0) * lt.W + i + i0]; varde[j * W + i] = lt.varde[(j + j0) * lt.W + i + i0]; }
    return { W, H, s: lt.s, x0: lt.x0 + i0 * lt.s, y1: lt.y1 - j0 * lt.s, klass, varde, andel: lt.andel };
  }
  function visaRasterLager(id, b, epsg, opacitet) {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = b.W; c.height = b.H; c.getContext('2d').drawImage(img, 0, 0);
      const kb = bildTillKarta(c, b.x0, b.y1, b.s, epsg);
      visaResultatLager(id, L.imageOverlay(kb.url, kb.bounds, { opacity: opacitet, interactive: false }));
    };
    img.src = b.url;
  }
  function visaHojdpunkter(hp, epsg) {
    const t = tillLatLng(epsg), Z = (state.senaste && state.senaste.Z0) || 0, ritare = L.canvas({ padding: 0.3 });
    const etiketter = hp.length <= 400;
    const grp = L.featureGroup(hp.map(p => {
      const m = L.circleMarker(t([p.x, p.y]), { radius: 2.2, stroke: false, fillColor: farg('annot'), fillOpacity: 1, renderer: ritare });
      m.bindTooltip(Platsanalys.hojdText(p.z, Z), etiketter ? { permanent: true, direction: 'right', className: 'hojd-etikett', offset: [3, 0] } : { direction: 'top' });
      return m;
    }));
    visaResultatLager('hojdpunkter', grp, () => grp.eachLayer(m => m.setStyle({ fillColor: farg('annot') })));
  }
  function visaSkyfall(sk, epsg) {
    const t = tillLatLng(epsg);
    const stil = () => ({ color: farg('skyfall'), weight: 1, fillColor: farg('skyfall'), fillOpacity: 0.35 });
    const lag = sk.lagpunkter.flatMap((l, i) => l.konturer.map(k => L.polygon(k.map(t), stil())
      .bindTooltip(`L${i + 1}: ${fmt(l.yta)} m², djup ${fmt(l.maxDjup, 2)} m, ${fmt(l.volym, 1)} m³`, { sticky: true })));
    const flo = sk.floden.map(f => L.polyline(f.pts.map(t), { color: farg('skyfall'), weight: f.ack > 4 * sk.troskel ? 2.4 : 1.5, opacity: 0.9, interactive: false }));
    const grp = L.featureGroup([...lag, ...flo]);
    visaResultatLager('skyfall', grp, () => { lag.forEach(p => p.setStyle(stil())); flo.forEach(p => p.setStyle({ color: farg('skyfall') })); });
  }
  function visaSkydd(s, epsg, bUts) {
    const t = tillLatLng(epsg);
    if (Array.isArray(s.lamningar)) {
      const ikon = L.divIcon({ className: 'lamning-ikon', iconSize: [14, 14], iconAnchor: [7, 7], html: '<span></span>' });
      const grp = L.featureGroup(s.lamningar.filter(l => l.x != null).map(l => L.marker(t([l.x, l.y]), { icon: ikon, keyboard: false })
        .bindPopup(`<strong>${esc(l.klass)}</strong>${l.namn ? '<br>' + esc(l.namn) : ''}${l.id ? '<br><small>' + esc(l.id) + '</small>' : ''}<br><a href="https://app.raa.se/open/fornsok/" target="_blank" rel="noopener">Fornsök</a>`)));
      visaResultatLager('lamningar', grp);
    } else {
      visaResultatLager('lamningar', L.tileLayer.wms(Geodata.TJANSTER.lamningarWms, { layers: Geodata.LAMNINGAR.map(l => l.lager).join(','), format: 'image/png', transparent: true, maxZoom: 19, attribution: 'Lämningar: Riksantikvarieämbetet' }));
    }
    if (Array.isArray(s.natur) && s.natur.length) {
      const stil = () => ({ color: farg('natur'), weight: 2, dashArray: '6 4', fillColor: farg('natur'), fillOpacity: 0.08 });
      const pol = s.natur.flatMap(o => o.ringar.map(rg => L.polygon(rg.map(t), stil()).bindTooltip(`${o.typ}${o.namn ? ': ' + o.namn : ''}`, { sticky: true })));
      const grp = L.featureGroup(pol);
      visaResultatLager('natur', grp, () => pol.forEach(p => p.setStyle(stil())));
    }
    visaResultatLager('oversvamning', L.tileLayer.wms(Geodata.TJANSTER.oversvamningWms, { layers: '13', format: 'image/png', transparent: true, opacity: 0.6, maxZoom: 19, attribution: 'Översvämning: Myndigheten för civilt försvar' }));
  }

  // ------------------------------------------------------------------
  // Skiss: volymer från cad-apa eller DXF
  // ------------------------------------------------------------------
  const volymLager = L.featureGroup();
  if (synlig('volymer')) volymLager.addTo(karta);
  (() => {
    const sparat = lager.las('sessionStorage', 'terrang-volymer');
    state.volymer = sparat && sparat.volymer ? sparat.volymer : [];
    state.volymEpsg = sparat ? sparat.epsg : null;
  })();
  function sparaVolymer() { lager.spara('sessionStorage', 'terrang-volymer', { epsg: state.epsg, volymer: state.volymer }); }
  /** Byter koordinatsystem på volymerna om utsnittets system har ändrats. */
  function volymerIZon() {
    if (state.volymEpsg && state.volymEpsg !== state.epsg && state.volymer.length) {
      const f = T.omvandlare(state.volymEpsg, state.epsg).forward;
      state.volymer.forEach(v => { v.fotavtryck = v.fotavtryck.map(p => f(p)); });
    }
    state.volymEpsg = state.epsg;
  }
  const TAKFORMER = { platt: 'Platt', pulpet: 'Pulpet', sadel: 'Sadel', valm: 'Valm' };
  function ritaVolymer() {
    volymerIZon();
    volymLager.clearLayers();
    const t = tillLatLng(state.epsg);
    state.volymer.forEach(v => {
      L.polygon(v.fotavtryck.map(t), { color: farg('annot'), weight: 2, fillColor: farg('annot'), fillOpacity: 0.12 })
        .bindTooltip(`${esc(v.namn)}: ${fmt(Platsanalys.area(v.fotavtryck))} m², ${TAKFORMER[v.takform] || ''} tak`, { sticky: true }).addTo(volymLager);
    });
    const ul = $('volymlista');
    ul.innerHTML = '';
    state.volymer.forEach((v, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<div class="volym-huvud"><strong>${esc(v.namn)}</strong><span>${fmt(Platsanalys.area(v.fotavtryck))} m²</span></div>
        <div class="volym-falt">
          <label>Golv (FG)<input type="text" inputmode="decimal" data-f="golv" value="${v.golv === v.golv && v.golv != null ? String(v.golv).replace('.', ',') : ''}" placeholder="marken"></label>
          <label>Takfot, m<input type="text" inputmode="decimal" data-f="takfot" value="${String(v.takfot).replace('.', ',')}"></label>
          <label>Tak<select data-f="takform">${Object.entries(TAKFORMER).map(([k, n]) => `<option value="${k}"${k === v.takform ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
          <label>Lutning, °<input type="text" inputmode="decimal" data-f="taklutning" value="${v.taklutning || 0}"></label>
        </div>
        <button type="button" class="lank-ta-bort">Ta bort</button>`;
      li.querySelectorAll('[data-f]').forEach(el => el.addEventListener('change', () => {
        const f = el.dataset.f;
        if (f === 'takform') v.takform = el.value;
        else { const x = tal(el.value); v[f] = f === 'golv' && !isFinite(x) ? NaN : (isFinite(x) ? x : v[f]); }
        sparaVolymer(); nollstallResultat(); ritaVolymer();
      }));
      li.querySelector('.lank-ta-bort').addEventListener('click', () => { state.volymer.splice(i, 1); sparaVolymer(); nollstallResultat(); ritaVolymer(); });
      ul.append(li);
    });
    $('volym-hjalp').hidden = !state.volymer.length;
    ritaLagerlista();
    sammanfatta();
  }
  /** Tar emot en skiss ({ plats, volymer }) och öppnar platsen om den inte redan är öppen. */
  function laddaSkiss(sk, kalla) {
    const p = sk.plats;
    if (p && p.utsnitt && p.koordinatsystem && p.koordinatsystem.plan) {
      const e = Number(p.koordinatsystem.plan.epsg), u = p.utsnitt;
      const samma = state.utsnitt && state.epsg === e && ['xmin', 'ymin', 'xmax', 'ymax'].every(k => Math.abs(state.utsnitt[k] - u[k]) < 0.5);
      if (!samma && T.ZONER.some(z => z.epsg === e)) {
        state.epsg = e; state.zonManuell = true; zonVal.value = e;
        state.utsnitt = { xmin: u.xmin, ymin: u.ymin, xmax: u.xmax, ymax: u.ymax };
        if (p.projekt && p.projekt.namn) { $('projekt').value = p.projekt.namn; $('projekt').dispatchEvent(new Event('input')); }
        if (p.nollpunkt && (Math.abs(p.nollpunkt.x - u.xmin) > 0.001 || Math.abs(p.nollpunkt.y - u.ymin) > 0.001 || p.nollpunkt.z)) {
          document.querySelector('input[name=nollpunkt][value=egen]').checked = true; $('egen-nollpunkt').hidden = false;
          $('np-x').value = p.nollpunkt.x; $('np-y').value = p.nollpunkt.y; $('np-z').value = p.nollpunkt.z || '';
        }
        if (p.projekt && p.projekt.id) state.projektId = p.projekt.id;
        satGeoFranUtsnitt(); uppdateraKommun(); visaUtsnitt(); passaKartan();
      }
    }
    state.volymEpsg = state.epsg;
    state.volymer = sk.volymer;
    sparaVolymer(); nollstallResultat(); ritaVolymer();
    visaSteg('skiss');
    const pa = document.querySelector('input[name=tillval][value=platsanalys]');
    $('skiss-status').textContent = `${sk.volymer.length} ${sk.volymer.length === 1 ? 'volym' : 'volymer'} från ${kalla}. ` + (pa.checked ? 'Välj Skapa för att räkna om platsanalysen med skissen.' : 'Slå på platsanalysen under 03 Analys och välj Skapa för att pröva skissen.');
    visaStatus(`Skissen från ${kalla} är inläst.`);
  }
  let dxfVantar = null;
  $('skiss-importera').addEventListener('click', () => $('skiss-fil').click());
  $('skiss-fil').addEventListener('change', async () => {
    const fil = $('skiss-fil').files[0];
    $('skiss-fil').value = '';
    if (!fil) return;
    try {
      const text = await fil.text();
      if (/^\s*\{/.test(text)) {
        const d = JSON.parse(text);
        if (d.format === Utbyte.PLATS) throw new Error('det här är en platsfil från höjdkurvor.se. Den öppnas i cad-apa.');
        laddaSkiss(Utbyte.lasSkiss(d), 'filen');
      } else {
        const fa = Platsanalys.lasDxfFotavtryck(text);
        if (!fa.length) throw new Error('hittade inga slutna polylinjer i DXF-filen.');
        dxfVantar = fa;
        $('skiss-dxf').hidden = false;
        $('skiss-status').textContent = `${fa.length} slutna polylinjer i ${fil.name}. Ange hur koordinaterna är angivna.`;
      }
    } catch (e) { $('skiss-status').textContent = 'Filen kunde inte läsas: ' + e.message; }
  });
  $('skiss-dxf-ok').addEventListener('click', () => {
    if (!dxfVantar || !state.utsnitt) { $('skiss-status').textContent = 'Välj ett område först.'; return; }
    const lokal = document.querySelector('input[name=dxf-koord]:checked').value === 'lokal';
    const np = lasNollpunkt(), n0 = np.varde || { x: state.utsnitt.xmin, y: state.utsnitt.ymin, z: 0 };
    const vrid = $('vrid').value === 'sann' ? utsnittsMitt().konvergens : $('vrid').value === 'egen' ? (tal($('vrid-grader').value) || 0) : 0;
    const volymer = dxfVantar.map((f, i) => ({
      id: 'dxf' + (i + 1), namn: f.lager && f.lager !== '0' ? `${f.lager} ${i + 1}` : `Volym ${i + 1}`,
      fotavtryck: lokal ? f.pts.map(p => Utbyte.lokalTillZon(p, n0, vrid)) : f.pts,
      golv: NaN, takfot: 6, takform: 'sadel', taklutning: 27, nockriktning: null,
    }));
    const r = state.utsnitt, utanfor = volymer.filter(v => !v.fotavtryck.some(p => p[0] > r.xmin - 500 && p[0] < r.xmax + 500 && p[1] > r.ymin - 500 && p[1] < r.ymax + 500));
    if (utanfor.length === volymer.length) { $('skiss-status').textContent = 'Fotavtrycken hamnar långt från utsnittet. Kontrollera om koordinaterna är lokala eller SWEREF.'; return; }
    dxfVantar = null; $('skiss-dxf').hidden = true;
    laddaSkiss({ plats: null, volymer }, 'DXF-filen');
  });

  // ------------------------------------------------------------------
  // Vägar (0.11.0): bilvägar och gångvägar som egna lager, vägytorna som utkast
  // ------------------------------------------------------------------
  /** Ortofotots pixlar för mätningen av vägarna: { rgba, W, H, x0, y1, s }, eller null. */
  function ortofotoPixlar(o) {
    if (!o || !o.canvas) return null;
    try {
      const d = o.canvas.getContext('2d').getImageData(0, 0, o.W, o.H);
      return { rgba: d.data, W: o.W, H: o.H, x0: o.x0, y1: o.y1, s: o.s };
    } catch (e) { console.error(e); return null; }
  }
  /** Ritar vägarna på kartan: bilvägar i lagret Vägar, gång- och cykelvägar i sitt eget, ytorna under linjerna. */
  function visaVagar(v, tt) {
    const gang = l => l.slag === 'gang';
    const vStil = l => ({ color: farg(gang(l) ? 'vag-gang' : 'vag'), weight: l.lager === 'VAG_HUVUDVAG' ? 3 : gang(l) ? 1.2 : 2, dashArray: gang(l) ? '4 3' : null, opacity: 0.85 });
    const yStil = sl => ({ color: farg(sl === 'gang' ? 'vag-gang' : 'vag'), weight: 0.8, fillColor: farg(sl === 'gang' ? 'vag-gang' : 'vag'), fillOpacity: 0.18, opacity: 0.7, interactive: false });
    for (const [id, sl] of [['vagar', 'bil'], ['gangvagar', 'gang']]) {
      const linjer = v.linjer.filter(l => l.slag === sl), ytor = v.ytor ? v.ytor[sl] : [];
      if (!linjer.length && !ytor.length) { visaResultatLager(id, null); continue; }
      const yGrp = ytor.map(p => L.polygon(p.ringar.map(ring => ring.map(tt)), yStil(sl)));
      const lGrp = linjer.map(l => L.polyline(l.pts.map(tt), vStil(l)).bindTooltip(esc(l.namn || l.typ), { sticky: true }));
      const grp = L.featureGroup(yGrp.concat(lGrp));
      visaResultatLager(id, grp, () => { yGrp.forEach(p => p.setStyle(yStil(sl))); lGrp.forEach((pl, i) => pl.setStyle(vStil(linjer[i]))); });
    }
  }
  /** Vägarnas linjer till 3D-vyn för ett slag: mittlinjerna och ytornas kanter (slutna). */
  function vagar3d(v, sl) {
    if (!v) return null;
    const ut = v.linjer.filter(l => (l.slag || Vagar.slag(l.lager)) === sl).map(l => l.pts);
    if (v.ytor) for (const p of v.ytor[sl] || []) for (const ring of p.ringar) ut.push(ring.concat([ring[0]]));
    return ut.length ? ut : null;
  }
  /** Vägarna till utskriften: bara de lager som syns. */
  function vagarTillUtskrift(v, syns) {
    if (!v) return null;
    const med = sl => syns(sl === 'gang' ? 'gangvagar' : 'vagar');
    if (!med('bil') && !med('gang')) return null;
    return {
      linjer: v.linjer.filter(l => med(l.slag || Vagar.slag(l.lager))),
      ytor: v.ytor ? { bil: med('bil') ? v.ytor.bil : [], gang: med('gang') ? v.ytor.gang : [] } : null,
    };
  }

  // ------------------------------------------------------------------
  // cad-apa
  // ------------------------------------------------------------------
  const CADAPA = window.TERRANG_CADAPA || KONF.cadApaUrl || '../cad-apa/';   // TERRANG_CADAPA: testkrok
  function platspaket() {
    const s = state.senaste, r = state.utsnitt;
    const np = lasNollpunkt();
    const n0 = s && s.nollpunkt ? { x: s.nollpunkt.x, y: s.nollpunkt.y, z: s.Z0 || 0 } : (np.varde || { x: r.xmin, y: r.ymin, z: 0 });
    const m = utsnittsMitt();
    if (!state.projektId) { state.projektId = Utbyte.nyttId(); lager.spara('sessionStorage', 'terrang-projektid', state.projektId); }
    return Utbyte.platspaket({
      projekt: $('projekt').value.trim(), kommun: kommunText(), projektId: state.projektId,
      epsg: state.epsg, systemNamn: T.zon(state.epsg).namn, utsnitt: r, nollpunkt: n0,
      vridning: $('vrid').value === 'sann' ? m.konvergens : $('vrid').value === 'egen' ? (tal($('vrid-grader').value) || 0) : 0,
      sannNord: m.konvergens,
      rutnat: s && s.rutnat, kurvor: s && s.kurvor, trad: s && s.trad, vagar: s && s.vagar, stompunkter: s && s.stompunkter,
      volymer: state.volymer, byggnader: s && s.byggnader, fastigheter: s && s.fastigheter, fastighetVarning: Fastighet.VARNING,
      ortofoto: ortofotoTillCadApa(s), projektlank: projektlank(), kalla: `höjdkurvor.se ${window.HOJDKURVOR ? window.HOJDKURVOR.version : ''}`.trim(),
    });
  }
  /**
   * Ortofotot till cad-apa: sedan 0.11.0 i full upplösning, samma bild som i zip:en (högst 8 192 pixlar
   * per sida, se Ortofoto.upplosning). 0.10.1 skalade ned till 4 096 pixlar.
   */
  function ortofotoTillCadApa(s) {
    const o = s && s.ortofoto;
    return o ? { bild: o.bild, x0: o.x0, y1: o.y1, s: o.s, W: o.W, H: o.H, ar: o.ar } : null;
  }
  /** Påminnelse om fastighetsgränser och byggnader som inte kom med, eftersom de inte var ikryssade (0.8.0). */
  function saknasTillCadApa() {
    const s = state.senaste;
    if (!s) return '';
    const saknas = [!s.fastigheter && 'Fastighetsgränser', !s.byggnader && 'Befintliga byggnader', !s.ortofoto && 'Ortofotot'].filter(Boolean);
    return saknas.length ? ` ${saknas.length > 1 ? saknas.slice(0, -1).join(', ') + ' och ' + saknas[saknas.length - 1].toLowerCase() : saknas[0]} kom inte med. Kryssa i dem och skapa underlaget igen om du vill ha med dem.` : '';
  }
  async function tillCadApa(statusEl) {
    if (!state.utsnitt) { statusEl.textContent = 'Välj ett område först.'; return; }
    const paket = platspaket();
    statusEl.textContent = state.senaste ? 'Öppnar cad-apa …' : 'Öppnar cad-apa med platsen. Terrängen följer med när du har skapat underlaget.';
    try {
      const svar = await Utbyte.skickaTillCadApa(CADAPA, paket);
      statusEl.textContent = (svar === 'mottaget' ? 'Platsen är öppnad i cad-apa.' : 'Platsen är skickad till cad-apa.') + saknasTillCadApa();
    } catch (e) { statusEl.textContent = 'cad-apa: ' + e.message; }
  }
  $('skiss-cadapa').addEventListener('click', () => tillCadApa($('skiss-status')));
  $('till-cadapa').addEventListener('click', () => tillCadApa($('status-text')));
  $('spara-platsfil').addEventListener('click', async () => {
    if (!state.utsnitt) return;
    const namn = `${($('namn').value.trim() || 'plats')}.hkplats.json`;
    const mal = await valjFil(namn, 'application/json', 'Platsfil för cad-apa');
    if (mal === AVBRUTET) return;
    await skrivFil(mal, new Blob([JSON.stringify(platspaket())], { type: 'application/json' }), namn);
  });
  state.projektId = lager.las('sessionStorage', 'terrang-projektid');
  Utbyte.lyssnaPaCadApa(CADAPA, data => laddaSkiss(Utbyte.lasSkiss(data), 'cad-apa'));

  // ------------------------------------------------------------------
  // Projektlänk: utsnitt och val i adressen (#p=...), utan inloggning
  // ------------------------------------------------------------------
  function projektlank() {
    if (!state.utsnitt) return null;
    const r = state.utsnitt, np = lasNollpunkt(), t = tillval(), k = kapitel(), f = formatVal();
    const p = {
      v: 1, e: state.epsg, r: [r.xmin, r.ymin, r.xmax, r.ymax], n: $('projekt').value.trim() || undefined,
      np: np.varde ? [np.varde.x, np.varde.y, np.varde.z] : undefined,
      vr: $('vrid').value !== 'ingen' ? [$('vrid').value, $('vrid-grader').value] : undefined,
      t: Object.keys(t).filter(x => t[x]), k: Object.keys(k).filter(x => k[x]), f: Object.keys(f).filter(x => f[x]),
      i: $('intervall').value, m: $('mesh').value, u: utjamning(), hp: $('hojdpunkt-steg').value,
      s: state.sektioner.length ? state.sektioner.map(x => [x.namn, ...x.a.map(c => +c.toFixed(6)), ...x.b.map(c => +c.toFixed(6)), x.vand ? 1 : 0]) : undefined,
      h: state.horPunkt ? state.horPunkt.map(c => +c.toFixed(6)) : undefined,
    };
    return location.origin + location.pathname + '#p=' + b64url.koda(JSON.stringify(p));
  }
  function lasProjektlank() {
    const m = location.hash.match(/(?:^#|&)p=([^&]+)/);
    if (!m) return false;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignoreras */ }
    let p;
    try { p = JSON.parse(b64url.avkoda(m[1])); } catch (e) { visaStatus('Projektlänken gick inte att läsa.', true); return false; }
    if (!p || p.v !== 1 || !Array.isArray(p.r) || !T.ZONER.some(z => z.epsg === p.e)) return false;
    const satt = (namn, lista) => { if (lista) document.querySelectorAll(`input[name=${namn}]`).forEach(c => { if (!c.disabled) c.checked = lista.includes(c.value); }); };
    satt('tillval', p.t); satt('kapitel', p.k); satt('format', p.f);
    if (p.i) $('intervall').value = p.i;
    if (p.m) $('mesh').value = p.m;
    if (p.hp) $('hojdpunkt-steg').value = p.hp;
    if (p.u != null) { const rr = document.querySelector(`input[name=utjamning][value="${p.u}"]`); if (rr) rr.checked = true; }
    if (p.n) { $('projekt').value = p.n; $('projekt').dispatchEvent(new Event('input')); }
    if (p.np) {
      document.querySelector('input[name=nollpunkt][value=egen]').checked = true; $('egen-nollpunkt').hidden = false;
      [$('np-x').value, $('np-y').value, $('np-z').value] = p.np.map(String);
    }
    if (p.vr) { $('vrid').value = p.vr[0]; $('vrid-grader').value = p.vr[1] || ''; $('vrid-egen-rad').hidden = p.vr[0] !== 'egen'; }
    if (p.s) { state.sektioner = p.s.map(x => ({ namn: x[0], a: [x[1], x[2]], b: [x[3], x[4]], vand: !!x[5] })); sparaSektioner(); }
    if (p.h) { state.horPunkt = p.h; lager.spara('sessionStorage', 'terrang-horpunkt', p.h); }
    state.epsg = p.e; state.zonManuell = true; zonVal.value = p.e;
    state.utsnitt = { xmin: p.r[0], ymin: p.r[1], xmax: p.r[2], ymax: p.r[3] };
    satGeoFranUtsnitt(); uppdateraKommun(); visaUtsnitt();
    karta.whenReady(() => setTimeout(passaKartan, 50));
    sparaInst();
    visaStatus('Området och valen kommer från projektlänken. Fyll i inloggningen och välj Skapa.');
    return true;
  }
  $('kopiera-projektlank').addEventListener('click', async () => {
    const l = projektlank();
    if (!l) return;
    const ok = await kopieraText(l);
    $('projektlank-status').textContent = ok ? 'Länken är kopierad. Den innehåller område och val, men ingen inloggning.' : 'Kopiera länken: ' + l;
  });

  // ------------------------------------------------------------------
  // Felrapport
  // ------------------------------------------------------------------
  const felLogg = [];
  window.addEventListener('error', e => { felLogg.push(String(e.message || e.error).slice(0, 200)); if (felLogg.length > 5) felLogg.shift(); });
  window.addEventListener('unhandledrejection', e => { felLogg.push(String((e.reason && e.reason.message) || e.reason).slice(0, 200)); if (felLogg.length > 5) felLogg.shift(); });
  $('felrapport').addEventListener('click', () => {
    const rader = [
      'Beskriv vad du gjorde och vad som hände:', '', '', '',
      '--- Teknisk information (ta bort det du inte vill skicka) ---',
      `Version: ${window.HOJDKURVOR ? window.HOJDKURVOR.version : '?'}`,
      `Webbläsare: ${navigator.userAgent}`,
      `Skärm: ${window.innerWidth} × ${window.innerHeight}, tema ${Tema.aktuellt}`,
      `Projekt: ${projektlank() || 'inget område valt'}`,
      `Meddelande: ${$('status-text').textContent.slice(0, 400)}`,
      ...(felLogg.length ? ['Fel:', ...felLogg] : []),
    ];
    const kropp = rader.join('\n').slice(0, 1800);
    location.href = `mailto:kontakt@agrellarkitektur.se?subject=${encodeURIComponent('Felrapport höjdkurvor.se')}&body=${encodeURIComponent(kropp)}`;
  });

  // ------------------------------------------------------------------
  // Mobilflödet
  // ------------------------------------------------------------------
  const mobilMQ = window.matchMedia('(max-width: 760px) and (pointer: coarse)');
  const mobilVald = () => mobilMQ.matches && !lager.las('localStorage', 'terrang-hela-verktyget');
  function satMobil(pa) {
    document.body.classList.toggle('mobilflode', pa);
    ['mobil-sok', 'mobil-blad'].forEach(id => { $(id).hidden = !pa; });
    $('mobil-ram').hidden = !pa || !!state.utsnitt;
    document.querySelector('.mobilvy-rad').hidden = pa || !mobilMQ.matches;
    setTimeout(() => karta.invalidateSize(), 50);
    uppdateraMobil();
  }
  function uppdateraMobil() {
    if (!document.body.classList.contains('mobilflode')) return;
    const r = state.utsnitt;
    $('mobil-markera').hidden = !!r; $('mobil-resultat').hidden = !r; $('mobil-ram').hidden = !!r;
    if (!r) { mobilMatt(); return; }
    $('mobil-storlek').textContent = `${fmt(r.xmax - r.xmin)} × ${fmt(r.ymax - r.ymin)} m`;
    $('mobil-kommun').textContent = state.kommun ? `${state.kommun.namn} kommun` : '';
    $('mobil-system').textContent = `HÖRN I ${T.zon(state.epsg).namn.toUpperCase()}`;
    $('mobil-koord').innerHTML = [['Väst', r.xmin], ['Öst', r.xmax], ['Syd', r.ymin], ['Nord', r.ymax]].map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
  }
  /** Ramens storlek i meter, visas ovanför ramen. */
  function mobilMatt() {
    const ram = $('mobil-ram').getBoundingClientRect(), k = karta.getContainer().getBoundingClientRect();
    if (!ram.width) return;
    const a = karta.containerPointToLatLng([ram.left - k.left, ram.bottom - k.top]), b = karta.containerPointToLatLng([ram.right - k.left, ram.top - k.top]);
    const w = karta.distance(a, [a.lat, b.lng]), h = karta.distance(a, [b.lat, a.lng]);
    $('mobil-matt').textContent = `ca ${fmt(Math.round(w / 10) * 10)} × ${fmt(Math.round(h / 10) * 10)} m`;
  }
  karta.on('move zoom', () => { if (document.body.classList.contains('mobilflode') && !state.utsnitt) mobilMatt(); });
  $('mobil-markera-knapp').addEventListener('click', () => {
    const ram = $('mobil-ram').getBoundingClientRect(), k = karta.getContainer().getBoundingClientRect();
    const sv = karta.containerPointToLatLng([ram.left - k.left, ram.bottom - k.top]), no = karta.containerPointToLatLng([ram.right - k.left, ram.top - k.top]);
    const yta = karta.distance(sv, [sv.lat, no.lng]) * karta.distance(sv, [no.lat, sv.lng]);
    if (yta > MAX_AREA) { $('mobil-markera').querySelector('p').textContent = `Ramen täcker ${fmt(yta / 1e6, 1)} km². Zooma in, högst ${fmt(MAX_AREA / 1e6)} km² går.`; return; }
    nyttOmrade([sv.lat, sv.lng], [no.lat, no.lng]);
    uppdateraMobil();
  });
  $('mobil-om').addEventListener('click', () => { rensaUtsnitt(); uppdateraMobil(); });
  [$('mobil-hela'), $('mobil-hela-2')].forEach(b => b.addEventListener('click', () => { lager.spara('localStorage', 'terrang-hela-verktyget', true); satMobil(false); }));
  $('till-mobilvy').addEventListener('click', () => { lager.ta('localStorage', 'terrang-hela-verktyget'); satMobil(true); window.scrollTo(0, 0); });
  $('mobil-kopiera').addEventListener('click', async () => {
    const ok = state.utsnitt && await kopieraText(koordinatText());
    $('mobil-hjalp').textContent = ok ? 'Koordinaterna är kopierade. Klistra in dem på datorn under Område, eller på sidan Beställ.' : 'Kunde inte kopiera.';
  });
  $('mobil-dela').addEventListener('click', async () => {
    const l = projektlank();
    if (!l) return;
    const data = { title: `höjdkurvor.se${$('projekt').value.trim() ? ' – ' + $('projekt').value.trim() : ''}`, text: 'Område att skapa underlag för:', url: l };
    try {
      if (navigator.share) { await navigator.share(data); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const ok = await kopieraText(l);
    $('mobil-hjalp').textContent = ok ? 'Länken är kopierad. Skicka den till dig själv och öppna den på datorn.' : 'Kopiera länken: ' + l;
  });
  $('mobil-sok').addEventListener('submit', async e => {
    e.preventDefault();
    const q = $('mobil-sok-text').value.trim(), lista = $('mobil-sokresultat');
    if (!q) return;
    lista.hidden = false; lista.innerHTML = '<li><button type="button" disabled>Söker …</button></li>';
    try {
      const svar = await (await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=se&limit=5&accept-language=sv&q=' + encodeURIComponent(q))).json();
      lista.innerHTML = svar.length ? '' : '<li><button type="button" disabled>Inga träffar.</button></li>';
      svar.forEach(t => {
        const li = document.createElement('li'), b = document.createElement('button');
        b.type = 'button'; b.textContent = t.display_name;
        b.addEventListener('click', () => { karta.setView([+t.lat, +t.lon], 17); lista.hidden = true; $('mobil-sok-text').blur(); });
        li.append(b); lista.append(li);
      });
    } catch (err) { lista.innerHTML = '<li><button type="button" disabled>Sökningen fungerade inte just nu.</button></li>'; }
  });
  mobilMQ.addEventListener && mobilMQ.addEventListener('change', () => satMobil(mobilVald()));

  // ------------------------------------------------------------------
  // 3D-förhandsvisning (three.js laddas först när den öppnas)
  // ------------------------------------------------------------------
  let vy3d = null;
  const HJALP3D = $('vy3d-hjalp').innerHTML;
  /** Sparade val i 3D-vyn: en färg (#rrggbb) ur localStorage, annars förvalet. */
  const sparadFarg = (nyckel, forval) => { const c = lager.las('localStorage', nyckel); return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : forval; };
  $('visa-3d').addEventListener('click', async () => {
    const s = state.senaste;
    if (!s || !s.rutnat) return;
    $('vy3d').hidden = false;
    document.body.classList.add('vy3d-oppen');
    try {
      await Promise.all([!window.Trad3D && 'js/trad3d.js', 'js/bild3d.js', 'js/volym3d.js'].filter(Boolean).map(laddaSkript));
      await laddaSkript('js/vy3d.js');
      varnaGamlaFiler('vy3d.js', Vy3D.version);
      if (vy3d) vy3d.stang();
      stoppaUppspelning();
      let sol = null;
      try { const m = utsnittsMitt(); sol = { lat: m.lat, lon: m.lon, konvergens: m.konvergens, tid: soltid3d() }; } catch (e) { console.error(e); }
      // alla träd och hus, de dolda markerade, så att de kan visas igen (0.11.0)
      trad3d = s.trad ? Objektval.tillampaTrad(s.tradAlla || s.trad, tradval(), { medDolda: true }).trad : [];
      const husAlla = s.byggnaderAlla || s.byggnader;
      const takm = takmodeller3d(husAlla);
      vy3d = await Vy3D.visa($('vy3d-yta'), { rutnat: s.rutnat, utsnitt: s.r, trad: s.trad ? trad3d : null, volymer: s.volymer, befintliga: husAlla ? Byggnad.somVolymer(husAlla) : null,
        doldaHus: doldaHus3d(),
        fotavtryck: s.byggnader ? s.byggnader.filter(b => b.hojd == null).map(b => b.fotavtryck) : null,
        kurvor: s.kurvor, fastigheter: s.fastigheter ? s.fastigheter.granser.map(g => g.pts) : null, vagar: vagar3d(s.vagar, 'bil'), gangvagar: vagar3d(s.vagar, 'gang'),
        kurva: kurvfarg3d(), fastighet: farg('fastighet'), vag: farg('vag'), vagGang: farg('vag-gang'), byggnad: farg('byggnad'),
        befintlig: sparadFarg('terrang-3d-husfarg', '#b9b3aa'), skissfarg: sparadFarg('terrang-3d-skissfarg', farg('annot')),
        konturfarg: sparadFarg('terrang-3d-konturfarg', '#000000'), gransfarg: sparadFarg('terrang-3d-gransfarg', farg('fastighet')),
        takmodeller: takm,
        tradniva: ['detaljerad', 'realistisk'].includes(lager.las('localStorage', 'terrang-3d-trad')) ? 'detaljerad' : 'enkel',
        konturer: lager.las('localStorage', 'terrang-3d-konturer') === true, sol,
        bakgrund: farg('karta-bg'), mark: farg('kurva'), ram: farg('ram'), volym: farg('annot'),
        ortofoto: s.ortofoto ? { canvas: s.ortofoto.canvas, x0: s.ortofoto.x0 - s.ortofoto.s / 2, y1: s.ortofoto.y1 + s.ortofoto.s / 2, bredd: s.ortofoto.W * s.ortofoto.s, hojd: s.ortofoto.H * s.ortofoto.s } : null });
      $('vy3d-faktor').textContent = '1';
      const orto = vy3d.ortofoto();
      $('vy3d-orto').hidden = orto == null;
      $('vy3d-orto').setAttribute('aria-pressed', String(!!orto));
      vy3d.dragLage(dragLage3d);
      vy3d.lyssna(visaLage3d);
      vy3d.lyssnaSkiss(skissFran3d);
      vy3d.lyssnaHus(visaTakpanel);
      vy3d.lyssnaTrad(visaTradpanel);
      stangTakpanel(); stangTradpanel();
      objektAndrade = false;
      uppdateraDoldaKnapp();
      $('vy3d-nyform').hidden = true; vantarPlacering = false;
      skissFran3d({ typ: 'start', redigera: false, toppvy: false, vald: null, kanAngra: false, kanGoraOm: false });
      visaLage3d({ lage: 'oversikt' });
      if (window.TERRANG_TEST) { window.TERRANG_TEST.vy3d = vy3d; window.TERRANG_TEST.byggnader = s.byggnader; window.TERRANG_TEST.senaste = () => state.senaste; }   // testkrokar: kamerans läge och takformerna i gränssnittstestet
      ritaLager3d();
      $('vy3d-kurvfarg-rad').hidden = vy3d.kurvfarg() == null;
      $('vy3d-kurvfarg').value = kurvfarg3d();
      const hus = vy3d.byggnadsfarg(), skiss = vy3d.skissfarg(), kont = vy3d.konturer(), tn = vy3d.tradniva();
      const kf = vy3d.konturfarg(), gf = vy3d.gransfarg(), tf = vy3d.takformer();
      $('vy3d-husfarg-rad').hidden = hus == null; if (hus) $('vy3d-husfarg').value = hus;
      $('vy3d-skissfarg-rad').hidden = skiss == null; if (skiss) $('vy3d-skissfarg').value = skiss;
      $('vy3d-konturfarg-rad').hidden = kf == null; if (kf) $('vy3d-konturfarg').value = kf;
      $('vy3d-gransfarg-rad').hidden = gf == null; if (gf) $('vy3d-gransfarg').value = gf;
      $('vy3d-konturer').hidden = kont == null; $('vy3d-konturer').setAttribute('aria-pressed', String(!!kont));
      $('vy3d-tradniva-rad').hidden = tn == null; if (tn) $('vy3d-tradniva').value = tn;
      $('vy3d-takformer').hidden = tf == null;
      if (tf != null) { const pa = vy3d.takformer(lager.las('localStorage', 'terrang-3d-takformer') === true); $('vy3d-takformer').setAttribute('aria-pressed', String(!!pa)); }
      $('vy3d-tradskuggor').hidden = vy3d.tradskuggor() == null; $('vy3d-tradskuggor').setAttribute('aria-pressed', 'true');
      const kan = vy3d.skuggor() != null;
      $('vy3d-skuggor').hidden = !kan;
      satSkuggor3d(kan && lager.las('sessionStorage', 'terrang-3d-skuggor') === true);
    } catch (e) {
      console.error(e);
      $('vy3d-yta').textContent = '3D-vyn kunde inte öppnas: ' + e.message;
    }
    $('vy3d-stang').focus();
  });
  const stang3d = () => {
    stoppaUppspelning(); $('vy3d').hidden = true; document.body.classList.remove('vy3d-oppen');
    const andrad = vy3d && vy3d.skissAndrad();
    stangTakpanel(); stangTradpanel(); $('vy3d-modell').hidden = true;
    if (vy3d) { vy3d.stang(); vy3d = null; }
    if (andrad) {
      // underlaget i zip:en och PDF:en har den gamla skissen tills man skapar igen
      $('skapa').classList.remove('gjord');
      visaStatus('Skissen är ändrad i 3D-vyn. Välj Skapa igen för att räkna om skuggor, horisont och filer med den.');
    } else if (objektAndrade) {
      $('skapa').classList.remove('gjord');
      visaStatus('Träd eller hus är ändrade i 3D-vyn. Kartan och platsen till cad-apa har ändringen; välj Skapa igen för att få den i filerna och skuggorna.');
    }
    objektAndrade = false;
    $('visa-3d').focus();
  };
  $('vy3d-stang').addEventListener('click', stang3d);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || $('vy3d').hidden) return;
    // Esc avbryter först en placering eller ett val i modelleringen, och stänger takpanelen
    if (vy3d && vy3d.avbryt()) return;
    if (!$('vy3d-tak').hidden) { stangTakpanel(); return; }
    if (!$('vy3d-trad').hidden) { stangTradpanel(); return; }
    // i ögonhöjd går Esc tillbaka till översikten, annars stänger den vyn
    if (vy3d && vy3d.lage() !== 'oversikt') { vy3d.oversikt(); return; }
    stang3d();
  });
  /** En knapp per lager som finns i 3D-vyn, i samma ordning varje gång. Valen sparas så länge fliken är öppen. */
  const LAGER3D = [['kurvor', 'Höjdkurvor'], ['trad', 'Träd'], ['byggnader', 'Byggnader'], ['fastigheter', 'Fastighetsgränser'], ['vagar', 'Vägar'], ['gangvagar', 'Gångvägar'], ['skiss', 'Skiss']];
  function ritaLager3d() {
    const rad = $('vy3d-lager'), finns = vy3d.lager(), dolda = lager.las('sessionStorage', 'terrang-3d-dolda') || [];
    rad.querySelectorAll('[data-lager3d]').forEach(b => b.remove());
    for (const [namn, text] of LAGER3D) {
      if (!(namn in finns)) continue;
      const pa = !dolda.includes(namn);
      vy3d.visaLager(namn, pa);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'knapp liten'; b.dataset.lager3d = namn; b.textContent = text;
      b.setAttribute('aria-pressed', String(pa));
      b.addEventListener('click', () => {
        const nu = vy3d.visaLager(namn, !vy3d.visaLager(namn));
        b.setAttribute('aria-pressed', String(nu));
        const d = (lager.las('sessionStorage', 'terrang-3d-dolda') || []).filter(n => n !== namn);
        if (!nu) d.push(namn);
        lager.spara('sessionStorage', 'terrang-3d-dolda', d);
      });
      rad.append(b);
    }
    // övriga val sist i raden, i samma ordning varje gång
    rad.append($('vy3d-orto'), $('vy3d-takformer'), $('vy3d-konturer'), $('vy3d-tradniva-rad'), $('vy3d-skuggor'), $('vy3d-dolda'), $('vy3d-kurvfarg-rad'), $('vy3d-husfarg-rad'), $('vy3d-konturfarg-rad'), $('vy3d-gransfarg-rad'), $('vy3d-skissfarg-rad'));
  }
  $('vy3d-orto').addEventListener('click', () => {
    if (!vy3d) return;
    const pa = vy3d.ortofoto(!vy3d.ortofoto());
    $('vy3d-orto').setAttribute('aria-pressed', String(!!pa));
  });
  /** Höjdkurvornas färg i 3D-vyn: svart om inget annat är valt. Valet sparas i webbläsaren. */
  function kurvfarg3d() { return sparadFarg('terrang-3d-kurvfarg', '#000000'); }
  $('vy3d-kurvfarg').addEventListener('input', e => {
    if (!vy3d) return;
    vy3d.kurvfarg(e.target.value);
    lager.spara('localStorage', 'terrang-3d-kurvfarg', e.target.value);
  });
  $('vy3d-husfarg').addEventListener('input', e => {
    if (!vy3d) return;
    vy3d.byggnadsfarg(e.target.value);
    lager.spara('localStorage', 'terrang-3d-husfarg', e.target.value);
  });
  $('vy3d-skissfarg').addEventListener('input', e => {
    if (!vy3d) return;
    vy3d.skissfarg(e.target.value);
    lager.spara('localStorage', 'terrang-3d-skissfarg', e.target.value);
  });
  $('vy3d-konturfarg').addEventListener('input', e => {
    if (!vy3d) return;
    vy3d.konturfarg(e.target.value);
    lager.spara('localStorage', 'terrang-3d-konturfarg', e.target.value);
  });
  $('vy3d-gransfarg').addEventListener('input', e => {
    if (!vy3d) return;
    vy3d.gransfarg(e.target.value);
    lager.spara('localStorage', 'terrang-3d-gransfarg', e.target.value);
  });
  $('vy3d-takformer').addEventListener('click', () => {
    if (!vy3d) return;
    const pa = vy3d.takformer(!vy3d.takformer());
    $('vy3d-takformer').setAttribute('aria-pressed', String(!!pa));
    lager.spara('localStorage', 'terrang-3d-takformer', !!pa);
  });
  /**
   * Takformer ur laserdatan för husen som har höjd (0.9.1), med samma id som Byggnad.somVolymer ger,
   * så att 3D-vyn kan byta lådan mot huset med tak. Tomt om laserdatan inte finns kvar.
   */
  function takmodeller3d(byggnader) {
    hus3d = new Map();
    if (!byggnader) return null;
    const val = takval();
    return byggnader.filter(b => b.mark != null && b.hojd != null).map((b, i) => {
      const id = 'befintlig-' + (b.id || i);
      hus3d.set(id, b);
      const t = Byggnad.takmodell(b, val[husNyckel(b)]);
      return t && Object.assign(t, { id });
    }).filter(Boolean);
  }
  // ------------------------------------------------------------------
  // Egen takform på befintliga hus (0.10.0): klicka på ett hus i 3D-vyn
  // ------------------------------------------------------------------
  const TAKVAL = 'terrang-takval';
  const TAKNAMN = { sadeltak: 'Sadeltak', valmat: 'Valmat', pulpettak: 'Pulpettak', platt: 'Platt' };
  /** Valen per hus (nyckel: objektidentiteten), sparade i webbläsaren. */
  const takval = () => { const v = lager.las('localStorage', TAKVAL); return v && typeof v === 'object' ? v : {}; };
  const husNyckel = b => (b && b.id ? String(b.id) : null);
  let hus3d = new Map(), husVal = null;
  const decimal = (v, d = 2) => (v == null || !isFinite(v) ? '' : String(Math.round(v * 10 ** d) / 10 ** d).replace('.', ','));
  function stangTakpanel() {
    $('vy3d-tak').hidden = true; husVal = null;
    if (vy3d) vy3d.markeraHus(null);
  }
  function visaTakpanel(id) {
    const b = id && hus3d.get(id);
    if (!b || !vy3d || vy3d.modellera()) { stangTakpanel(); return; }
    husVal = { id, b };
    vy3d.markeraHus(id);
    $('tak-namn').textContent = Byggnad.beteckning(b) || 'Hus';
    const e = takval()[husNyckel(b)] || {};
    $('tak-form').value = e.form || '';
    $('tak-lutning').value = decimal(e.lutning, 1);
    $('tak-riktning').value = e.tvars ? 'tvars' : '';
    $('tak-nock').value = decimal(e.nock);
    $('tak-vand').checked = !!e.vand;
    uppdateraTak(false);
    $('vy3d-tak').hidden = false;
  }
  /** Räknar om taket med valen i panelen; spara = valen sparas och taket byts i vyn. */
  function uppdateraTak(spara) {
    if (!husVal) return;
    const e = {};
    if ($('tak-form').value) e.form = $('tak-form').value;
    const lut = tal($('tak-lutning').value), nock = tal($('tak-nock').value);
    if (lut > 0) e.lutning = lut;
    if (nock > 0) e.nock = nock;
    if ($('tak-riktning').value === 'tvars') e.tvars = true;
    if (e.form === 'pulpettak' && $('tak-vand').checked) e.vand = true;
    $('tak-vand-rad').hidden = e.form !== 'pulpettak';
    const t = Byggnad.takmodell(husVal.b, e), nyckel = husNyckel(husVal.b);
    if (spara) {
      const alla = takval();
      if (nyckel) { if (Object.keys(e).length) alla[nyckel] = e; else delete alla[nyckel]; lager.spara('localStorage', TAKVAL, alla); }
      vy3d.bytTak(husVal.id, t && Object.assign(t, { id: husVal.id }));
      $('vy3d-takformer').hidden = false; $('vy3d-takformer').setAttribute('aria-pressed', 'true');
      lager.spara('localStorage', 'terrang-3d-takformer', true);
    }
    $('tak-info').textContent = !t ? 'Huset har ingen laserdata för taket, så formen kan inte ritas.'
      : `${TAKNAMN[t.form]}${t.form !== 'platt' ? ` ${t.lutning}°` : ''}, nock ${decimal(t.nock)} och takfot ${decimal(t.takfot)} (RH 2000).`
        + (Object.keys(e).length ? '' : ' Allt ur laserdatan.') + (nyckel ? '' : ' Valet sparas inte, huset saknar id.');
  }
  ['tak-form', 'tak-lutning', 'tak-riktning', 'tak-nock', 'tak-vand'].forEach(id => $(id).addEventListener('change', () => uppdateraTak(true)));
  $('tak-aterstall').addEventListener('click', () => {
    ['tak-form', 'tak-lutning', 'tak-riktning', 'tak-nock'].forEach(id => { $(id).value = ''; });
    $('tak-vand').checked = false;
    uppdateraTak(true);
  });
  $('tak-stang').addEventListener('click', stangTakpanel);

  // ------------------------------------------------------------------
  // Enskilda träd och hus (0.11.0): dölja dem som är uppenbart fel och rätta träden. Valen sparas i
  // webbläsaren (Objektval). Kartan och platsen till cad-apa följer med direkt, filerna och skuggorna
  // när man skapar underlaget igen.
  // ------------------------------------------------------------------
  const TRADVAL = 'terrang-tradval', HUSVAL = 'terrang-husval';
  function tradval() { const v = lager.las('localStorage', TRADVAL); return v && typeof v === 'object' ? v : {}; }
  function husval() { const v = lager.las('localStorage', HUSVAL); return v && typeof v === 'object' ? v : {}; }
  const ARTNAMN = { gran: 'Gran', tall: 'Tall', lov: 'Lövträd', bjork: 'Björk' };
  let trad3d = [], tradVal = null, objektAndrade = false;
  /** Träden på kartan, som cirklar med kronans storlek. */
  function visaTradKarta(trad, tt) {
    const tstil = () => ({ color: farg('trad'), weight: 1, fillColor: farg('trad'), fillOpacity: 0.15 });
    const tgrp = L.featureGroup(trad.map(t => L.circle(tt([t.x, t.y]), Object.assign({ radius: t.krona / 2 }, tstil()))
      .bindTooltip(`${fmt(t.hojd)} m högt, krona ${fmt(t.krona, 1)} m` + (t.andrat ? ' (ändrat)' : ''), { sticky: true })));
    visaResultatLager('trad', tgrp, () => tgrp.setStyle(tstil()));
  }
  /** Byggnaderna på kartan. */
  function visaByggnaderKarta(bygg, tt) {
    const bstil = () => ({ color: farg('byggnad'), weight: 1.2, fillColor: farg('byggnad'), fillOpacity: 0.35 });
    const bgrp = L.featureGroup(bygg.map(b => L.polygon([b.fotavtryck.map(tt), ...b.hal.map(h => h.map(tt))], bstil())
      .bindTooltip(esc(Byggnad.beteckning(b)) + (b.hojd != null ? `, ${fmt(b.hojd, 1)} m` : ''), { sticky: true })));
    visaResultatLager('byggnader', bgrp, () => bgrp.setStyle(bstil()));
  }
  /** Efter en ändring: träd och hus i state.senaste och på kartan. */
  function objektAndrat() {
    const s = state.senaste;
    if (!s) return;
    const tt = tillLatLng(s.epsg);
    if (s.tradAlla) { s.trad = Objektval.tillampaTrad(s.tradAlla, tradval()).trad; if (resultat.trad) visaTradKarta(s.trad, tt); }
    if (s.byggnaderAlla) {
      const h = Objektval.tillampaHus(s.byggnaderAlla, husval());
      s.byggnader = h.byggnader; s.byggnaderDolda = h.dolda;
      if (resultat.byggnader) visaByggnaderKarta(s.byggnader, tt);
    }
    objektAndrade = true;
    uppdateraDoldaKnapp();
  }
  /** Husen som är dolda i 3D-vyn (id som i Byggnad.somVolymer). */
  const doldaHus3d = () => { const v = husval(); return [...hus3d].filter(([, b]) => b.id != null && v[String(b.id)] && v[String(b.id)].dolt).map(([id]) => id); };
  function uppdateraDoldaKnapp() {
    const n = trad3d.filter(t => t.dolt).length + doldaHus3d().length;
    $('vy3d-dolda').hidden = !vy3d || n === 0;
    $('vy3d-dolda').textContent = `Visa dolda (${n})`;
  }
  function stangTradpanel() {
    $('vy3d-trad').hidden = true; tradVal = null;
    if (vy3d) vy3d.markeraTrad(null);
  }
  function visaTradpanel(i) {
    const t = i != null && trad3d[i];
    if (!t || !vy3d || vy3d.modellera()) { stangTradpanel(); return; }
    tradVal = i;
    vy3d.markeraTrad(i);
    const e = Objektval.valFor(t, tradval());
    $('trad-art').value = e.art || '';
    $('trad-hojd').value = decimal(e.hojd, 1); $('trad-krona').value = decimal(e.krona, 1);
    const ra = t.ra || t;
    $('trad-hojd').placeholder = decimal(ra.hojd, 1); $('trad-krona').placeholder = decimal(ra.krona, 1);
    tradInfo(t);
    $('vy3d-trad').hidden = false;
  }
  function tradInfo(t) {
    const ra = t.ra || t, typ = Trad3D.typ(t);
    $('trad-info').textContent = `${ARTNAMN[typ === 'bjork' ? 'bjork' : Trad3D.art(t)]}, ${decimal(t.hojd, 1)} m högt, krona ${decimal(t.krona, 1)} m.`
      + (t.andrat ? ` Ur laserdatan: ${decimal(ra.hojd, 1)} m, krona ${decimal(ra.krona, 1)} m.` : ' Allt ur laserdatan; arten är gissad ur formen.');
  }
  /** Sparar valet för det valda trädet och byter det i vyn. */
  function sparaTrad(e) {
    const s = state.senaste, i = tradVal;
    if (i == null || !s) return;
    const orig = (s.tradAlla || s.trad)[i];
    if (!orig) return;
    const val = Objektval.sattTrad(tradval(), orig, e);
    lager.spara('localStorage', TRADVAL, val);
    trad3d[i] = Objektval.tillampaTrad([orig], val, { medDolda: true }).trad[0];
    vy3d.bytTrad(i, trad3d[i]);
    objektAndrat();
    if (trad3d[i].dolt) stangTradpanel(); else tradInfo(trad3d[i]);
  }
  const tradFalt = () => {
    const e = {}, h = tal($('trad-hojd').value), k = tal($('trad-krona').value);
    if ($('trad-art').value) e.art = $('trad-art').value;
    if (h > 0) e.hojd = h;
    if (k > 0) e.krona = k;
    return e;
  };
  ['trad-art', 'trad-hojd', 'trad-krona'].forEach(id => $(id).addEventListener('change', () => sparaTrad(tradFalt())));
  $('trad-aterstall').addEventListener('click', () => { ['trad-art', 'trad-hojd', 'trad-krona'].forEach(id => { $(id).value = ''; }); sparaTrad({}); });
  $('trad-dolj').addEventListener('click', () => sparaTrad(Object.assign(tradFalt(), { dolt: true })));
  $('trad-stang').addEventListener('click', stangTradpanel);
  $('hus-dolj').addEventListener('click', () => {
    if (!husVal || !vy3d) return;
    const nyckel = husNyckel(husVal.b), id = husVal.id;
    if (!nyckel) { $('tak-info').textContent = 'Huset saknar id, så det går inte att dölja.'; return; }
    const v = husval(); v[nyckel] = { dolt: true };
    lager.spara('localStorage', HUSVAL, v);
    stangTakpanel();
    vy3d.doljHus(id, true);
    objektAndrat();
  });
  /** Visar igen alla träd och hus som är dolda här (de andra ändringarna av träden står kvar). */
  $('vy3d-dolda').addEventListener('click', () => {
    const s = state.senaste;
    if (!vy3d || !s) return;
    const val = tradval();
    trad3d.forEach((t, i) => {
      if (!t.dolt) return;
      const orig = (s.tradAlla || s.trad)[i], e = Objektval.valFor(t, val);
      delete e.dolt;
      Objektval.sattTrad(val, orig, e);
      trad3d[i] = Objektval.tillampaTrad([orig], val, { medDolda: true }).trad[0];
      vy3d.bytTrad(i, trad3d[i]);
    });
    lager.spara('localStorage', TRADVAL, val);
    const hv = husval();
    for (const id of doldaHus3d()) { delete hv[String(hus3d.get(id).id)]; vy3d.doljHus(id, false); }
    lager.spara('localStorage', HUSVAL, hv);
    objektAndrat();
  });

  // ------------------------------------------------------------------
  // Modellera i 3D-vyn (0.10.0): volymer med mått, snäpp och länkar. Skissen går tillbaka till
  // state.volymer (och listan under 04 Skiss) och följer med i analyserna nästa gång man skapar.
  // ------------------------------------------------------------------
  const TYPNAMN = { block: 'Rätblock', cylinder: 'Cylinder', prisma: 'Prisma med tak', polygon: 'Fotavtryck från cad-apa eller DXF' };
  /** Visar fält som gäller formen (data-for="block prisma …"), döljer de andra. */
  const visaFor = (rot, typ) => rot.querySelectorAll('[data-for]').forEach(el => { el.hidden = !el.dataset.for.split(' ').includes(typ); });
  let vantarPlacering = false;
  function skissFran3d(ut) {
    if (ut.typ === 'andrad') {
      state.volymer = ut.volymer.map(v => Object.assign({}, v));
      if (state.senaste) state.senaste.volymer = ut.volymer.map(v => Object.assign({}, v));
      sparaVolymer(); ritaVolymer();
    }
    $('vy3d-modellera').setAttribute('aria-pressed', String(ut.redigera));
    $('vy3d-toppvy').setAttribute('aria-pressed', String(ut.toppvy));
    $('vy3d-modell').hidden = !ut.redigera;
    if (ut.redigera) { stangTakpanel(); stangTradpanel(); }
    $('vy3d-angra').disabled = !ut.kanAngra; $('vy3d-gorom').disabled = !ut.kanGoraOm;
    if (vantarPlacering && !ut.placerar) { vantarPlacering = false; $('vy3d-nyform').hidden = true; visaLage3d({ lage: vy3d ? vy3d.lage() : 'oversikt' }); }
    const v = ut.vald, f = $('vy3d-valdform');
    f.hidden = !v || !$('vy3d-nyform').hidden;
    $('vy3d-modellhjalp').hidden = !!v || !$('vy3d-nyform').hidden;
    if (!v) return;
    const p = v.primitiv || { typ: 'polygon' }, aktiv = document.activeElement;
    visaFor(f, p.typ);
    const satt = (id, varde) => { if ($(id) !== aktiv) $(id).value = varde; };
    satt('vald-namn', v.namn || '');
    $('vald-typ').textContent = `${TYPNAMN[p.typ] || ''}, ${fmt(Math.abs(Platsanalys.area(v.fotavtryck)))} m².`;
    satt('vald-b', decimal(p.b)); satt('vald-d', decimal(p.d)); satt('vald-diam', decimal(p.diam)); satt('vald-h', decimal(v.takfot));
    satt('vald-tak', v.takform || 'platt'); satt('vald-lutning', decimal(v.taklutning, 1));
    satt('vald-vrid', decimal(p.vrid, 1)); satt('vald-golv', decimal(v.golv));
    $('vald-golvauto').checked = !!p.golvAuto;
    $('vald-golvtext').textContent = p.golvAuto ? (ut.under ? `Står på ${ut.under}` : 'Står på marken') : 'Ställ på marken eller volymen under';
    const sn = ut.snapp && ut.snapp.typ === 'yta' && ut.snapp.avstand != null ? ut.snapp : null;
    $('vald-snapp').hidden = !sn;
    if (sn) { $('vald-snapptext').textContent = `Avstånd till ${sn.mot}, m`; satt('vald-avstand', decimal(sn.avstand)); }
    $('vald-grupp').hidden = ut.grupp < 2;
    $('vald-grupp').textContent = ut.grupp === 2 ? 'Sitter ihop med en annan volym. De flyttas och vrids tillsammans.' : `Sitter ihop med ${ut.grupp - 1} andra volymer. De flyttas och vrids tillsammans.`;
  }
  $('vy3d-modellera').addEventListener('click', () => {
    if (!vy3d) return;
    const pa = vy3d.modellera(!vy3d.modellera());
    if (pa) {
      // skissen ska synas när man modellerar
      const b = document.querySelector('[data-lager3d=skiss]');
      if (b) b.setAttribute('aria-pressed', 'true');
      lager.spara('sessionStorage', 'terrang-3d-dolda', (lager.las('sessionStorage', 'terrang-3d-dolda') || []).filter(n => n !== 'skiss'));
      if (!vy3d.volymer().length) { $('vy3d-nyform').hidden = false; visaFor($('vy3d-nyform'), $('ny-typ').value); $('vy3d-modellhjalp').hidden = true; }
    }
  });
  $('vy3d-toppvy').addEventListener('click', () => { if (vy3d) vy3d.toppvy(!vy3d.toppvy()); });
  $('vy3d-ny').addEventListener('click', () => {
    const f = $('vy3d-nyform');
    f.hidden = !f.hidden;
    if (vy3d) vy3d.avbryt(false);
    visaFor(f, $('ny-typ').value);
    $('vy3d-valdform').hidden = true; $('vy3d-modellhjalp').hidden = !f.hidden;
  });
  $('ny-typ').addEventListener('change', () => visaFor($('vy3d-nyform'), $('ny-typ').value));
  $('vy3d-nyform').addEventListener('submit', e => {
    e.preventDefault();
    if (!vy3d) return;
    vantarPlacering = true;
    vy3d.nyVolym({ typ: $('ny-typ').value, b: tal($('ny-b').value), d: tal($('ny-d').value), diam: tal($('ny-diam').value), hojd: tal($('ny-h').value), takform: $('ny-tak').value, taklutning: tal($('ny-lutning').value) });
    $('vy3d-hjalp').textContent = 'Klicka i vyn där volymen ska stå. Esc avbryter.';
  });
  $('ny-avbryt').addEventListener('click', () => { vantarPlacering = false; $('vy3d-nyform').hidden = true; if (vy3d) vy3d.avbryt(false); $('vy3d-modellhjalp').hidden = false; });
  $('vy3d-angra').addEventListener('click', () => vy3d && vy3d.angra());
  $('vy3d-gorom').addEventListener('click', () => vy3d && vy3d.gorOm());
  const VALDFALT = { 'vald-namn': 'namn', 'vald-b': 'b', 'vald-d': 'd', 'vald-diam': 'diam', 'vald-h': 'hojd', 'vald-tak': 'takform', 'vald-lutning': 'taklutning', 'vald-vrid': 'vrid', 'vald-golv': 'golv' };
  Object.entries(VALDFALT).forEach(([id, falt]) => $(id).addEventListener('change', () => {
    if (!vy3d) return;
    const el = $(id), varde = falt === 'namn' || falt === 'takform' ? el.value : tal(el.value);
    if (typeof varde === 'number' && !isFinite(varde)) return;
    vy3d.andraVald({ [falt]: varde });
  }));
  $('vald-golvauto').addEventListener('change', e => { if (vy3d && e.target.checked) vy3d.andraVald({ golvAuto: true }); else if (vy3d) vy3d.andraVald({ golv: tal($('vald-golv').value) }); });
  $('vald-avstand').addEventListener('change', e => { const m = tal(e.target.value); if (vy3d && isFinite(m)) vy3d.avstand(m); });
  $('vald-kopiera').addEventListener('click', () => vy3d && vy3d.kopieraVald());
  $('vald-tabort').addEventListener('click', () => vy3d && vy3d.taBortVald());
  // Enter i ett fält ändrar direkt utan att skicka formuläret
  $('vy3d-valdform').addEventListener('submit', e => e.preventDefault());

  $('vy3d-konturer').addEventListener('click', () => {
    if (!vy3d) return;
    const pa = vy3d.konturer(!vy3d.konturer());
    $('vy3d-konturer').setAttribute('aria-pressed', String(!!pa));
    lager.spara('localStorage', 'terrang-3d-konturer', !!pa);
  });
  $('vy3d-tradniva').addEventListener('change', e => {
    if (!vy3d) return;
    const n = vy3d.tradniva(e.target.value);
    lager.spara('localStorage', 'terrang-3d-trad', n);
  });
  $('vy3d-aterstall').addEventListener('click', () => { if (vy3d) vy3d.aterstall(); });
  /** Flytta: vanlig dragning flyttar vyn i stället för att snurra. Valet gäller så länge sidan är öppen. */
  let dragLage3d = 'snurra';
  $('vy3d-flytta').addEventListener('click', () => {
    dragLage3d = dragLage3d === 'flytta' ? 'snurra' : 'flytta';
    if (vy3d) vy3d.dragLage(dragLage3d);
    $('vy3d-flytta').setAttribute('aria-pressed', String(dragLage3d === 'flytta'));
  });
  $('vy3d-overdriv').addEventListener('click', () => {
    if (!vy3d) return;
    const f = vy3d.overdriv() === 1 ? 2 : 1;
    vy3d.overdriv(f); $('vy3d-faktor').textContent = String(f);
  });

  // Ögonhöjd (0.9.0): klicka på marken, gå med tangenterna eller spaken
  const pekskarm = () => !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  $('vy3d-val').addEventListener('click', () => {
    const ut = $('vy3d-huvud').classList.toggle('utfalld');
    $('vy3d-val').setAttribute('aria-expanded', String(ut));
    $('vy3d-val').textContent = ut ? 'Dölj val' : 'Val';
  });
  function visaLage3d({ lage }) {
    $('vy3d-huvud').dataset.lage = lage;
    $('vy3d-ogon').setAttribute('aria-pressed', String(lage !== 'oversikt'));
    $('vy3d-ogon').textContent = lage === 'oversikt' ? 'Ögonhöjd' : 'Tillbaka';
    $('vy3d-flytta').hidden = lage === 'ogon';
    $('vy3d-overdriv').hidden = lage === 'ogon';
    const h = $('vy3d-hjalp');
    if (lage === 'valj') h.textContent = pekskarm() ? 'Tryck på marken där du vill stå.' : 'Klicka på marken där du vill stå. Esc avbryter.';
    else if (lage === 'ogon') h.textContent = pekskarm()
      ? 'Gå med spaken, längst ut springer du. Dra för att titta runt. Tillbaka tar dig upp igen.'
      : 'Gå med W A S D eller pilarna, skift springer. Dra med musen för att titta runt. Esc eller Tillbaka går upp igen.';
    else h.innerHTML = HJALP3D.replace(/(<span id="vy3d-faktor">)\d+/, `$1${vy3d ? vy3d.overdriv() : 1}`);
  }
  $('vy3d-ogon').addEventListener('click', () => { if (vy3d) vy3d.ogonhojd(); });

  // Skuggor (0.9.0): datum och tid, snabbval och uppspelning över dagen
  const tvaSiffror = n => String(n).padStart(2, '0');
  /** Tidpunkten (ms) som datumet och reglaget visar. Förval: i dag kl. 12, sparat så länge fliken är öppen. */
  function soltid3d() {
    if (!$('vy3d-datum').value) {
      const sparad = lager.las('sessionStorage', 'terrang-3d-soltid');
      const l = Sol.lokal(typeof sparad === 'number' ? sparad : Date.now());
      $('vy3d-datum').value = `${l.ar}-${tvaSiffror(l.man)}-${tvaSiffror(l.dag)}`;
      if (typeof sparad === 'number') $('vy3d-tid').value = String(l.tim * 60 + l.min);
    }
    const [ar, man, dag] = $('vy3d-datum').value.split('-').map(Number), min = +$('vy3d-tid').value;
    $('vy3d-tidtext').textContent = `${tvaSiffror(Math.floor(min / 60))}:${tvaSiffror(min % 60)}`;
    return Sol.lokalTillMs(ar, man, dag, Math.floor(min / 60), min % 60);
  }
  function uppdateraSol3d() {
    const ms = soltid3d();
    lager.spara('sessionStorage', 'terrang-3d-soltid', ms);
    if (!vy3d) return;
    const p = vy3d.soltid(ms);
    if (!p) return;
    $('vy3d-solinfo').textContent = p.h > 0
      ? `Solhöjd ${Math.round(p.h)}°, azimut ${Math.round(p.az)}°`
      : 'Solen är under horisonten.';
  }
  function satSkuggor3d(pa) {
    if (!vy3d || vy3d.skuggor() == null) return;
    vy3d.skuggor(pa);
    $('vy3d-skuggor').setAttribute('aria-pressed', String(pa));
    $('vy3d-sol').hidden = !pa;
    lager.spara('sessionStorage', 'terrang-3d-skuggor', pa);
    if (pa) uppdateraSol3d(); else stoppaUppspelning();
  }
  $('vy3d-skuggor').addEventListener('click', () => satSkuggor3d(!vy3d.skuggor()));
  $('vy3d-datum').addEventListener('change', uppdateraSol3d);
  $('vy3d-tid').addEventListener('input', uppdateraSol3d);
  document.querySelectorAll('[data-solhandelse]').forEach(b => b.addEventListener('click', () => {
    const ar = +($('vy3d-datum').value.split('-')[0]) || new Date().getFullYear();
    const l = Sol.lokal(Sol.solhandelse(ar, b.dataset.solhandelse));
    $('vy3d-datum').value = `${l.ar}-${tvaSiffror(l.man)}-${tvaSiffror(l.dag)}`;
    uppdateraSol3d();
  }));
  $('vy3d-tradskuggor').addEventListener('click', () => {
    if (!vy3d) return;
    const pa = vy3d.tradskuggor(!vy3d.tradskuggor());
    $('vy3d-tradskuggor').setAttribute('aria-pressed', String(!!pa));
  });
  /** Spela dagen: från soluppgång till solnedgång på 20 sekunder, om och om igen. */
  let spelar = null;
  function stoppaUppspelning() {
    if (spelar) cancelAnimationFrame(spelar.id);
    spelar = null;
    $('vy3d-spela').setAttribute('aria-pressed', 'false');
    $('vy3d-spela').textContent = 'Spela dagen';
  }
  $('vy3d-spela').addEventListener('click', () => {
    if (spelar) { stoppaUppspelning(); return; }
    const [ar, man, dag] = $('vy3d-datum').value.split('-').map(Number);
    let start = 0, slut = 1435;
    try {
      const m = utsnittsMitt(), d = Sol.dagdata(ar, man, dag, m.lat, m.lon), l = ms => { const t = Sol.lokal(ms); return t.tim * 60 + t.min; };
      if (d.upp && d.ned) { start = Math.floor(l(d.upp) / 5) * 5; slut = Math.ceil(l(d.ned) / 5) * 5; }
    } catch (e) { console.error(e); }
    let min = +$('vy3d-tid').value;
    if (min < start || min >= slut) min = start;
    const minPerSek = (slut - start) / 20;
    let forra = performance.now();
    spelar = { id: 0 };
    $('vy3d-spela').setAttribute('aria-pressed', 'true');
    $('vy3d-spela').textContent = 'Pausa';
    const steg = nu => {
      if (!spelar) return;
      min += (nu - forra) / 1000 * minPerSek; forra = nu;
      if (min > slut) min = start;
      $('vy3d-tid').value = String(Math.round(min / 5) * 5);
      uppdateraSol3d();
      spelar.id = requestAnimationFrame(steg);
    };
    spelar.id = requestAnimationFrame(steg);
  });

  // Spara bild (0.9.0): PNG i flera gånger skärmens storlek, eller fyra bilder för AI i en zip
  async function sparaBild3d(ai) {
    if (!vy3d) return;
    const knapp = $(ai ? 'vy3d-ai' : 'vy3d-bild'), text = knapp.textContent;
    knapp.disabled = true; knapp.textContent = 'Sparar …';
    try {
      await new Promise(ok => setTimeout(ok, 30));   // låt knappen visa att det arbetar
      const b = await vy3d.bilder({ skala: +$('vy3d-skala').value || 3, ai });
      const namn = slug($('projekt').value) || 'hojdkurvor';
      if (!ai) { laddaNer(b.farg, `${namn}_3d.png`); return; }
      const zip = new JSZip();
      zip.file(`${namn}_3d_farg.png`, b.farg);
      zip.file(`${namn}_3d_lera.png`, b.lera);
      zip.file(`${namn}_3d_kanter.png`, b.kanter);
      zip.file(`${namn}_3d_djup.png`, b.djup);
      const sol = vy3d.skuggor() ? vy3d.soltid() : null;
      zip.file(`${namn}_3d_las_mig.txt`, [
        `Bilder ur 3D-vyn i höjdkurvor.se ${window.HOJDKURVOR.version}, ${b.bredd} × ${b.hojd} px.`,
        'Alla fyra visar samma vy och kan läggas på varandra.', '',
        '_farg.png    Vyn som på skärmen, utan knappar.',
        '_lera.png    Lermodell: allt vitt, utan linjer' + (sol ? ', med skuggorna.' : '.'),
        '_kanter.png  Kantlinjer, svart på vitt, där djupet hoppar eller ytan byter riktning.',
        '_djup.png    Djupkarta: nära är ljust, långt bort mörkt, himlen svart (skala efter 1/avstånd).', '',
        sol && sol.h > 0 ? `Skuggor: ${$('vy3d-datum').value} kl. ${$('vy3d-tidtext').textContent}, solhöjd ${Math.round(sol.h)}°, azimut ${Math.round(sol.az)}°.` : 'Skuggor: av.',
        '', 'Underlag: Lantmäteriet (CC BY 4.0).', ''].join('\r\n'));
      laddaNer(await zip.generateAsync({ type: 'blob' }), `${namn}_3d_ai.zip`);
    } catch (e) {
      console.error(e);
      $('vy3d-hjalp').textContent = 'Bilden kunde inte sparas: ' + e.message;
    } finally { knapp.disabled = false; knapp.textContent = text; }
  }
  $('vy3d-bild').addEventListener('click', () => sparaBild3d(false));
  $('vy3d-ai').addEventListener('click', () => sparaBild3d(true));

  // ------------------------------------------------------------------
  // Start
  // ------------------------------------------------------------------
  ritaValjare();
  if (!valjBakgrund(lager.las('localStorage', 'terrang-bakgrund') || 'osm', true)) valjBakgrund('osm', true);
  ritaSektioner();
  ritaHorPunkt();
  ritaVolymer();
  ['anv', 'losen'].forEach(id => $(id).addEventListener('change', () => { if (state.bakgrund === 'lm') valjBakgrund('lm', true); }));
  const franLankProj = lasProjektlank();
  visaSteg(franLankProj ? 'plats' : (lager.las('sessionStorage', 'terrang-steg') || 'plats'));
  satMobil(mobilVald());
  sammanfatta();
})();
