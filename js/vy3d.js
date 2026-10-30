/*
 * 3D-förhandsvisning av utsnittet: terrängen (med ortofoto om det finns), höjdkurvor, träd, befintliga byggnader,
 * fastighetsgränser, vägar och skissade volymer. Varje lager kan slås av och på (0.7.0).
 * three.js (vendor/three/three.module.min.js) laddas först när vyn öppnas.
 * Egen enkel styrning: dra för att snurra, scrolla eller nyp för att zooma, högerdra, skift-dra eller
 * dra med två fingrar för att flytta (0.8.0). Läget Flytta gör vanlig dragning till flyttning (0.8.1).
 * Dubbelklick återställer vyn.
 *
 * 0.9.0: skuggor efter solens läge (js/sol.js, samma beräkning som skuggstudien i PDF:en), konturer på
 * byggnaderna, färg på befintliga byggnader och skissen, trädmodeller (js/trad3d.js) i två nivåer,
 * ögonhöjd (gå med WASD eller spaken på mobilen) och bilder i högre upplösning, också för AI (js/bild3d.js).
 *
 * 0.9.1: färg på konturerna och fastighetsgränserna, takformer ur laserdatan (Byggnad.takmodell),
 * realistiska träd med lövkort och ögonhöjd utan pekarlås (musen syns hela tiden).
 */
(function () {
  'use strict';
  let THREEP = null;
  const skriptUrl = document.currentScript ? document.currentScript.src : location.href;
  const RAD = Math.PI / 180;
  const OGONHOJD = 1.6, GA = 4, SPRINGA = 14;   // meter, meter per sekund

  async function visa(yta, data) {
    const THREE = await (THREEP = THREEP || import(new URL('../vendor/three/three.module.min.js', skriptUrl).href));
    yta.innerHTML = '';
    const mobil = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const pekskarm = mobil || (navigator.maxTouchPoints || 0) > 0;
    const W = () => yta.clientWidth || 800, H = () => yta.clientHeight || 600;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W(), H());
    // skuggorna räknas bara om när något har ändrats (solen, lagren, träden), inte varje bild
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    yta.append(renderer.domElement);
    const scen = new THREE.Scene();
    const bakgrund = new THREE.Color(data.bakgrund || '#f0eee9');
    scen.background = bakgrund;
    const g = data.rutnat, r = data.utsnitt;
    const cx = (r.xmin + r.xmax) / 2, cy = (r.ymin + r.ymax) / 2;
    // höjdnivå: lägsta punkten i utsnittet
    let zmin = Infinity, zmax = -Infinity;
    for (const v of g.z) if (v === v) { if (v < zmin) zmin = v; if (v > zmax) zmax = v; }
    let faktor = 1;
    const grupp = new THREE.Group();
    scen.add(grupp);
    const skuggaOm = () => { renderer.shadowMap.needsUpdate = true; };
    // lager som kan slås av och på: namn → grupp
    const lager = {};
    const nyttLager = namn => { const l = new THREE.Group(); l.name = namn; grupp.add(l); lager[namn] = l; return l; };
    /** Markhöjden i (x, y) ur rutnätet, bilinjärt. */
    const markZ = (x, y) => {
      const fi = Math.max(0, Math.min(g.W - 1.001, (x - g.x0) / g.s)), fj = Math.max(0, Math.min(g.H - 1.001, (g.y1 - y) / g.s));
      const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j;
      const z = (a, b) => { const q = g.z[b * g.W + a]; return q === q ? q : zmin; };
      return (z(i, j) * (1 - u) + z(i + 1, j) * u) * (1 - v) + (z(i, j + 1) * (1 - u) + z(i + 1, j + 1) * u) * v;
    };
    /** Markens höjd i scenen (med överdriften) under scenpunkten (x, z). */
    const markScen = (x, z) => (markZ(x + cx, -z + cy) - zmin) * faktor;
    /** Linjer draperade på marken (tätare punkter än rutnätet), lyfta lyft meter. */
    const draperade = (linjer, farg, lyft) => {
      const p = [], steg = Math.max(0.5, g.s);
      for (const pts of linjer) for (let n = 0; n + 1 < pts.length; n++) {
        const [xa, ya] = pts[n], [xb, yb] = pts[n + 1];
        const delar = Math.max(1, Math.ceil(Math.hypot(xb - xa, yb - ya) / steg));
        for (let d = 0; d < delar; d++) {
          const t0 = d / delar, t1 = (d + 1) / delar;
          const x0 = xa + (xb - xa) * t0, y0 = ya + (yb - ya) * t0, x1 = xa + (xb - xa) * t1, y1 = ya + (yb - ya) * t1;
          p.push(x0 - cx, markZ(x0, y0) - zmin + lyft, -(y0 - cy), x1 - cx, markZ(x1, y1) - zmin + lyft, -(y1 - cy));
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: farg }));
    };

    // terräng: glesa till högst ~250 000 noder
    let k = 1;
    while (Math.ceil(g.W / k) * Math.ceil(g.H / k) > 250000) k++;
    const nx = Math.floor((g.W - 1) / k) + 1, ny = Math.floor((g.H - 1) / k) + 1;
    const pos = new Float32Array(nx * ny * 3), farg = new Float32Array(nx * ny * 3);
    const mark = new THREE.Color(data.mark || '#8f4f22'), ljus = new THREE.Color('#e9e4da');
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const q = (j * k) * g.W + i * k, z = g.z[q] === g.z[q] ? g.z[q] : zmin;
      const n = j * nx + i;
      pos[n * 3] = g.x0 + i * k * g.s - cx; pos[n * 3 + 1] = z - zmin; pos[n * 3 + 2] = -(g.y1 - j * k * g.s - cy);
      const t = zmax > zmin ? (z - zmin) / (zmax - zmin) : 0, c = ljus.clone().lerp(mark, 0.15 + 0.35 * t);
      farg[n * 3] = c.r; farg[n * 3 + 1] = c.g; farg[n * 3 + 2] = c.b;
    }
    const idx = [];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(farg, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const markMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, shadowSide: THREE.FrontSide });
    const terrang = new THREE.Mesh(geo, markMat);
    terrang.castShadow = terrang.receiveShadow = true;
    grupp.add(terrang);

    // ortofoto som textur: o.x0, o.y1 = bildens övre vänstra hörn, o.bredd × o.hojd i meter
    let ortoMat = null;
    if (data.ortofoto && data.ortofoto.canvas) {
      const o = data.ortofoto, max = Math.min(4096, renderer.capabilities.maxTextureSize || 4096);
      let src = o.canvas;
      if (Math.max(src.width, src.height) > max) {
        const f = max / Math.max(src.width, src.height), c = document.createElement('canvas');
        c.width = Math.max(1, Math.floor(src.width * f)); c.height = Math.max(1, Math.floor(src.height * f));
        c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
        src = c;
      }
      const uv = new Float32Array(nx * ny * 2);
      for (let n = 0; n < nx * ny; n++) {
        const X = pos[n * 3] + cx, Y = -pos[n * 3 + 2] + cy;
        uv[n * 2] = (X - o.x0) / o.bredd; uv[n * 2 + 1] = 1 - (o.y1 - Y) / o.hojd;
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      const tex = new THREE.CanvasTexture(src);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      ortoMat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, shadowSide: THREE.FrontSide });
      terrang.material = ortoMat;
    }

    // utsnittets ram
    const ramPts = [[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax], [r.xmin, r.ymin]].map(([x, y]) => {
      const i = Math.round((x - g.x0) / g.s), j = Math.round((g.y1 - y) / g.s), z = g.z[Math.min(g.H - 1, Math.max(0, j)) * g.W + Math.min(g.W - 1, Math.max(0, i))];
      return new THREE.Vector3(x - cx, (z === z ? z : zmin) - zmin + 0.2, -(y - cy));
    });
    grupp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ramPts), new THREE.LineBasicMaterial({ color: data.ram || '#1d4f8c' })));

    // ------------------------------------------------------------------
    // Träd: gran, tall eller lövträd efter formen, enkla eller detaljerade (0.9.0).
    // De detaljerade har flera varianter per art (0.10.0), en InstancedMesh per typ.
    // ------------------------------------------------------------------
    const Trad3D = window.Trad3D;
    // ett träd i scenen; dolt (0.11.0) = användaren har dolt det, det ritas inte men finns kvar så att det kan visas igen
    const tradIScen = t => {
      const v = Trad3D ? Trad3D.variation(t) : { vrid: 0, ljus: 1 };
      return { x: t.x - cx, z: -(t.y - cy), b: (t.zMark != null ? t.zMark : t.mark) - zmin, h: Math.max(1, t.hojd), kr: Math.max(1, t.krona),
        art: Trad3D ? Trad3D.art(t) : 'lov', typ: Trad3D ? Trad3D.typ(t) : 'lov', vrid: v.vrid, ljus: v.ljus, dolt: !!t.dolt };
    };
    const trad = (data.trad || []).map(tradIScen);
    const tradMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const NIVAER = ['enkel', 'detaljerad'];
    const tradMesh = { enkel: {}, detaljerad: {} };   // nivå → art eller typ → InstancedMesh
    let tradniva = data.tradniva === 'detaljerad' || data.tradniva === 'realistisk' ? 'detaljerad' : 'enkel', tradskugga = data.tradskuggor !== false;
    const tradLager = trad.length && Trad3D ? nyttLager('trad') : null;
    const instanser = (geo, mat, antal) => {
      const im = new THREE.InstancedMesh(geo, mat, antal);
      im.count = 0; im.castShadow = tradskugga; im.receiveShadow = true;
      im.frustumCulled = false;
      tradLager.add(im);
      return im;
    };
    const geometri = m => {
      const tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
      tg.setAttribute('normal', new THREE.BufferAttribute(m.norm, 3));
      tg.setAttribute('color', new THREE.BufferAttribute(m.farg, 3));
      return tg;
    };
    /** Ser till att det finns en mesh för nivån och typen (eller arten) med plats för minst antal träd. */
    const tradMeshFor = (niva, nyckel, antal) => {
      const im = tradMesh[niva][nyckel];
      if (im && im.instanceMatrix.count >= antal) return im;
      if (im) { tradLager.remove(im); im.geometry.dispose(); im.dispose(); }
      return (tradMesh[niva][nyckel] = instanser(geometri(Trad3D.modell(nyckel, niva)), tradMat, Math.max(antal, im ? Math.ceil(im.instanceMatrix.count * 1.5) : antal)));
    };
    const allaTradMesh = () => Object.values(tradMesh.enkel).concat(Object.values(tradMesh.detaljerad));
    // detaljerade träd närmast kameran, enkla längre bort (mobilen orkar färre)
    const MAX_NARA = mobil ? 600 : 4000, NARA_MOBIL = 250;
    let tradPlats = null;
    const placeraTrad = () => {
      if (!tradLager) return;
      const kp = aktivKam().position, m = new THREE.Matrix4(), q = new THREE.Quaternion(), ax = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
      const nara = new Set();
      if (tradniva !== 'enkel') {
        // i toppvyn räknas avståndet från mitten av det som syns
        const fran = toppvy ? mal : kp;
        const avst = trad.map((t, i) => [t.dolt ? Infinity : Math.hypot(t.x - fran.x, t.z - fran.z), i]).sort((a, b) => a[0] - b[0]);
        for (let n = 0; n < Math.min(MAX_NARA, avst.length); n++) { if (mobil && avst[n][0] > NARA_MOBIL) break; nara.add(avst[n][1]); }
      }
      // först hur många av varje sort, så att varje mesh har plats
      const sort = trad.map((t, i) => (t.dolt ? null : nara.has(i) ? ['detaljerad', t.typ] : ['enkel', t.art]));
      const behov = new Map();
      sort.forEach(k => { if (k) behov.set(k.join(':'), (behov.get(k.join(':')) || 0) + 1); });
      for (const [k, n] of behov) { const [niva, nyckel] = k.split(':'); tradMeshFor(niva, nyckel, n); }
      const raknare = new Map();
      trad.forEach((t, i) => {
        if (!sort[i]) return;
        const im = tradMesh[sort[i][0]][sort[i][1]];
        const n = raknare.get(im) || 0; raknare.set(im, n + 1);
        m.compose(new THREE.Vector3(t.x, t.b, t.z), q.setFromAxisAngle(ax, t.vrid), new THREE.Vector3(t.kr, t.h, t.kr));
        im.setMatrixAt(n, m); im.setColorAt(n, c.setScalar(t.ljus));
      });
      for (const im of allaTradMesh()) {
        im.count = raknare.get(im) || 0;
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
      tradPlats = kp.clone();
      skuggaOm();
    };

    // höjdkurvor på sin egen höjd, lite ovanför marken så att de syns
    // (svarta om inget annat anges, färgen kan bytas med kurvfarg)
    let kurvMat = null;
    if (data.kurvor && data.kurvor.length) {
      const p = [];
      for (const k of data.kurvor) {
        const pts = k.sluten ? k.pts.concat([k.pts[0]]) : k.pts, y = (k.h != null ? k.h : k.z) - zmin + 0.05;
        for (let n = 0; n + 1 < pts.length; n++) p.push(pts[n][0] - cx, y, -(pts[n][1] - cy), pts[n + 1][0] - cx, y, -(pts[n + 1][1] - cy));
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      kurvMat = new THREE.LineBasicMaterial({ color: data.kurva || '#000000' });
      nyttLager('kurvor').add(new THREE.LineSegments(geo, kurvMat));
    }

    // fastighetsgränser och vägar draperade på marken
    let gransMat = null;
    if (data.fastigheter && data.fastigheter.length) {
      const l = draperade(data.fastigheter, data.gransfarg || data.fastighet || '#b0306a', 0.25);
      gransMat = l.material;
      nyttLager('fastigheter').add(l);
    }
    if (data.vagar && data.vagar.length) nyttLager('vagar').add(draperade(data.vagar, data.vag || '#6b6258', 0.15));
    // gång- och cykelvägar i ett eget lager (0.11.0)
    if (data.gangvagar && data.gangvagar.length) nyttLager('gangvagar').add(draperade(data.gangvagar, data.vagGang || '#8a7f72', 0.12));

    // konturer: svarta kanter på byggnaderna och skissen, av från början (0.9.0)
    const konturMat = new THREE.LineBasicMaterial({ color: data.konturfarg || '#000000' });
    const konturer = [];
    let visaKonturer = !!data.konturer;
    const kontur = (mesh, vinkel = 20) => {
      const ls = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, vinkel), konturMat);
      ls.visible = visaKonturer; ls.userData.kontur = true;
      mesh.add(ls); konturer.push(ls);
    };

    // befintliga byggnader: lådor till höjden ur laserdatan, fotavtryck på marken för dem utan höjd.
    // Med takformer (0.9.1) byts lådan mot väggar till takfoten och taket ur laserdatan.
    const befMat = new THREE.MeshLambertMaterial({ color: data.befintlig || '#b9b3aa' });
    // taken ur laserdatan skuggas per yta, så att nockar och takfall syns (samma färg som husen)
    const takMat = new THREE.MeshLambertMaterial({ color: befMat.color, flatShading: true, side: THREE.DoubleSide, shadowSide: THREE.FrontSide });
    let harBefintliga = false, fotMat = null;
    const formade = new Map();   // id → { lada, form }
    let takformerPa = false;
    /** Väggarna: fotavtrycket (med gårdar) extruderat från golvet till höjden h. */
    const vaggar = (v, h) => {
      const shape = new THREE.Shape(v.fotavtryck.map(p => new THREE.Vector2(p[0] - cx, p[1] - cy)));
      (v.hal || []).forEach(hl => shape.holes.push(new THREE.Path(hl.map(p => new THREE.Vector2(p[0] - cx, p[1] - cy)))));
      const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(g, befMat);
      mesh.position.y = v.golv - zmin;
      mesh.castShadow = mesh.receiveShadow = true;
      kontur(mesh);
      return mesh;
    };
    /** Huset med väggar till takfoten och taket t (ur Byggnad.takmodell, i zonens koordinater, RH 2000). */
    const byggForm = (v, t) => {
      const form = new THREE.Group();
      form.add(vaggar(v, Math.max(0.5, t.takfot - v.golv)));
      const tp = new Float32Array(t.pos.length);
      for (let i = 0; i < t.pos.length; i += 3) { tp[i] = t.pos[i] - cx; tp[i + 1] = t.pos[i + 2] - zmin; tp[i + 2] = -(t.pos[i + 1] - cy); }
      const tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tg.setIndex(new THREE.BufferAttribute(t.index, 1)); tg.computeVertexNormals();
      const tak = new THREE.Mesh(tg, takMat);
      tak.castShadow = tak.receiveShadow = true;
      kontur(tak, 35);
      form.add(tak);
      form.traverse(o => { o.userData.hus = v.id; });
      return form;
    };
    const befAvId = new Map();
    let husLager = null;
    if ((data.befintliga && data.befintliga.length) || (data.fotavtryck && data.fotavtryck.length)) {
      const l = husLager = nyttLager('byggnader');
      const former = new Map((data.takmodeller || []).map(t => [t.id, t]));
      (data.befintliga || []).forEach(v => {
        const lada = vaggar(v, v.takfot);
        lada.traverse(o => { o.userData.hus = v.id; });
        l.add(lada);
        harBefintliga = true;
        befAvId.set(v.id, v);
        const t = former.get(v.id);
        if (!t) return;
        const form = byggForm(v, t);
        form.visible = false;
        l.add(form);
        formade.set(v.id, { lada, form });
      });
      if (data.fotavtryck && data.fotavtryck.length) {
        const fl = draperade(data.fotavtryck.map(f => f.concat([f[0]])), data.konturfarg || data.byggnad || '#5b4636', 0.3);
        fotMat = fl.material;
        l.add(fl);
      }
    }
    /** Byter taket på ett befintligt hus (0.10.0, egen takform). t = null tar bort takformen. */
    const bytTak = (id, t) => {
      const v = befAvId.get(id), f = formade.get(id);
      if (!v) return false;
      if (f) {
        husLager.remove(f.form);
        f.form.traverse(o => { if (o.geometry) o.geometry.dispose(); const i = konturer.indexOf(o); if (i >= 0) konturer.splice(i, 1); });
      }
      if (!t) { if (f) { f.lada.visible = true; formade.delete(id); } skuggaOm(); return true; }
      const lada = f ? f.lada : husLager.children.find(o => o.userData.hus === id && o.isMesh);
      const form = byggForm(v, t);
      husLager.add(form);
      formade.set(id, { lada, form });
      lada.visible = !takformerPa; form.visible = takformerPa;
      skuggaOm();
      return true;
    };
    const visaTakformer = pa => {
      takformerPa = !!pa;
      formade.forEach(({ lada, form }) => { lada.visible = !takformerPa; form.visible = takformerPa; });
      skuggaOm();
    };

    // ------------------------------------------------------------------
    // Skissen: volymer med väggar till takfoten och tak efter takformen, i skissens färg.
    // Sedan 0.10.0 kan de ritas och ändras här (se Modellera nedan); taket är exakta plana ytor
    // (Volym3D.takytor) och volymer som går in i varandra får gemensamma konturer.
    // ------------------------------------------------------------------
    const V3 = window.Volym3D;
    const kopia = v => JSON.parse(JSON.stringify(v));
    const skissMat = new THREE.MeshLambertMaterial({ color: data.skissfarg || data.volym || '#e85528', side: THREE.DoubleSide, shadowSide: THREE.FrontSide });
    const skissTakMat = new THREE.MeshLambertMaterial({ color: skissMat.color, side: THREE.DoubleSide, shadowSide: THREE.FrontSide, flatShading: true });
    // vald volym: ljusare; volymer i samma grupp: lite ljusare; spöket när en ny volym placeras: genomskinligt
    const valdMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, flatShading: true });
    const gruppMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, flatShading: true });
    const spokMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false });
    const satSkissfarg = c => {
      skissMat.color.set(c); skissTakMat.color.set(c);
      const vit = new THREE.Color('#ffffff');
      valdMat.color.copy(skissMat.color).lerp(vit, 0.45); valdMat.emissive.copy(skissMat.color).multiplyScalar(0.25);
      gruppMat.color.copy(skissMat.color).lerp(vit, 0.22);
      spokMat.color.copy(skissMat.color).lerp(vit, 0.3);
    };
    satSkissfarg(skissMat.color.getStyle());
    let volymer = (data.volymer || []).map(v => (V3 ? V3.franVolym(kopia(v)) : kopia(v)));
    const skiss = nyttLager('skiss');
    let skissKontur = null, valdId = null, redigera = false;
    /** Zonens punkt (x, y, z i RH 2000) som scenpunkt (före överdriften, som allt i gruppen). */
    const iScen = (x, y, z) => new THREE.Vector3(x - cx, z - zmin, -(y - cy));
    /** En volym som grupp av ytor (väggar, sockel, tak), med material efter om den är vald. */
    const byggVolym = (v, mat, takMat2) => {
      const g = new THREE.Group();
      g.userData.volym = v.id;
      const fp = V3 ? V3.franVolym(v).fotavtryck : v.fotavtryck;
      const shape = new THREE.Shape(fp.map(p => new THREE.Vector2(p[0] - cx, p[1] - cy)));
      const vagg = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.05, v.takfot), bevelEnabled: false });
      vagg.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(vagg, mat);
      mesh.position.y = v.golv - zmin;
      g.add(mesh);
      // sockel ner till marken där den sluttar under volymen
      const lagst = Math.min(...fp.map(p => markZ(p[0], p[1])));
      if (v.golv - lagst > 0.05 && !(v.primitiv && v.primitiv.pa)) {
        const sg = new THREE.ExtrudeGeometry(shape, { depth: v.golv - lagst, bevelEnabled: false });
        sg.rotateX(-Math.PI / 2);
        const sockel = new THREE.Mesh(sg, mat);
        sockel.position.y = lagst - zmin;
        g.add(sockel);
      }
      if (v.takform && v.takform !== 'platt' && v.taklutning > 0) {
        const t = V3 ? V3.takytor(v) : null;
        let tg = null;
        if (t) {
          const tp = new Float32Array(t.pos.length);
          for (let i = 0; i < t.pos.length; i += 3) { tp[i] = t.pos[i] - cx; tp[i + 1] = t.pos[i + 2] - zmin; tp[i + 2] = -(t.pos[i + 1] - cy); }
          tg = new THREE.BufferGeometry();
          tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tg.setIndex(t.index);
        } else if (typeof Platsanalys !== 'undefined') {
          // inbuktat fotavtryck: taket i ett rutnät på 0,5 m (som före 0.10.0)
          const xs = fp.map(p => p[0]), ys = fp.map(p => p[1]), st = 0.5;
          const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
          const mx = Math.ceil((x1 - x0) / st) + 1, my = Math.ceil((y1 - y0) / st) + 1;
          const tp = new Float32Array(mx * my * 3), inne = new Uint8Array(mx * my), ti = [];
          for (let j = 0; j < my; j++) for (let i = 0; i < mx; i++) {
            const x = Math.min(x1, x0 + i * st), y = Math.min(y1, y0 + j * st), n = j * mx + i;
            inne[n] = Platsanalys.inuti(fp, x, y) ? 1 : 0;
            tp[n * 3] = x - cx; tp[n * 3 + 1] = Platsanalys.takhojd(v, x, y) - zmin; tp[n * 3 + 2] = -(y - cy);
          }
          for (let j = 0; j < my - 1; j++) for (let i = 0; i < mx - 1; i++) {
            const a = j * mx + i, b = a + 1, c = a + mx, d = c + 1;
            if (inne[a] && inne[b] && inne[c]) ti.push(a, c, b);
            if (inne[b] && inne[c] && inne[d]) ti.push(b, c, d);
          }
          tg = new THREE.BufferGeometry();
          tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tg.setIndex(ti);
        }
        if (tg) { tg.computeVertexNormals(); g.add(new THREE.Mesh(tg, takMat2)); }
      }
      g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = mat !== spokMat; o.userData.volym = v.id; } });
      return g;
    };
    const kastaBort = o => o.traverse(q => { if (q.geometry) q.geometry.dispose(); });
    /** Kanterna på volymerna i zonens koordinater, för konturerna. */
    const kanterAv = grp => {
      const ut = [];
      grp.updateMatrixWorld(true);
      grp.traverse(o => {
        if (!o.isMesh) return;
        const e = new THREE.EdgesGeometry(o.geometry, 25), p = e.attributes.position, q = new THREE.Vector3();
        const zon = i => { q.fromBufferAttribute(p, i).applyMatrix4(o.matrix); return [q.x + cx, -q.z + cy, q.y + zmin]; };
        for (let i = 0; i < p.count; i += 2) ut.push([zon(i), zon(i + 1)]);
        e.dispose();
      });
      return ut;
    };
    /**
     * Ritar om skissen. Med kanter (inte medan man drar) räknas konturerna som en union:
     * kanter inuti en annan volym eller mitt på en plan yta tas bort, skärningarna läggs till.
     */
    const ritaSkiss = ({ kanter = true } = {}) => {
      const grupp2 = V3 && valdId ? V3.komponent(volymer, valdId) : new Set();
      for (const o of skiss.children.slice()) { skiss.remove(o); kastaBort(o); }
      if (skissKontur) { const i = konturer.indexOf(skissKontur); if (i >= 0) konturer.splice(i, 1); skissKontur = null; }
      const alla = [];
      for (const v of volymer) {
        const vald = redigera && v.id === valdId, iGrupp = redigera && grupp2.has(v.id);
        const g = byggVolym(v, vald ? valdMat : iGrupp ? gruppMat : skissMat, vald ? valdMat : iGrupp ? gruppMat : skissTakMat);
        skiss.add(g);
        if (kanter || !redigera) alla.push(...kanterAv(g));
      }
      if (alla.length) {
        let strackor = alla;
        if (V3 && kanter && volymer.length > 1) strackor = V3.synligaKanter(alla.concat(V3.skarningar(volymer)), volymer);
        const p = [];
        for (const [a, b] of strackor) p.push(a[0] - cx, a[2] - zmin, -(a[1] - cy), b[0] - cx, b[2] - zmin, -(b[1] - cy));
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
        skissKontur = new THREE.LineSegments(geo, konturMat);
        skissKontur.userData.kontur = true;
        skissKontur.visible = visaKonturer || redigera;
        skiss.add(skissKontur); konturer.push(skissKontur);
      }
      skuggaOm();
    };
    ritaSkiss();

    // ------------------------------------------------------------------
    // Ljus och skuggor
    // ------------------------------------------------------------------
    const storlek = Math.max(r.xmax - r.xmin, r.ymax - r.ymin);
    const himmel = new THREE.HemisphereLight('#ffffff', '#8a8070', 1.6);
    scen.add(himmel);
    const sol = new THREE.DirectionalLight('#ffffff', 1.6);
    const SOL_START = new THREE.Vector3(-200, 300, 150);
    sol.position.copy(SOL_START);
    scen.add(sol, sol.target);
    {
      const sk = sol.shadow, halv = storlek * 0.75, karta = Math.min(mobil ? 2048 : 4096, renderer.capabilities.maxTextureSize || 4096);
      sk.mapSize.set(karta, karta);
      Object.assign(sk.camera, { left: -halv, right: halv, top: halv, bottom: -halv, near: 1, far: storlek * 5 });
      sk.camera.updateProjectionMatrix();
      sk.bias = -0.0004;
      sk.normalBias = Math.max(0.05, 2 * halv / karta);
    }
    const kanSkugga = !!(data.sol && window.Sol && data.sol.lat != null);
    let skuggorPa = false, soltid = data.sol && data.sol.tid || Date.now(), solLage = null;
    const uppdateraSol = () => {
      if (!skuggorPa) {
        sol.castShadow = false; sol.position.copy(SOL_START); sol.target.position.set(0, 0, 0);
        sol.intensity = 1.6; himmel.intensity = 1.6;
        return;
      }
      const p = solLage = window.Sol.solensLage(soltid, data.sol.lat, data.sol.lon);
      // azimuten är från geografisk nord; rutnätets nord pekar konvergensen öster om den (som Analys.skuggor)
      const az = (p.az - (data.sol.konvergens || 0)) * RAD, h = Math.max(0.5, p.h) * RAD, D = storlek * 2.5;
      const mitt = (zmax - zmin) / 2 * faktor;
      sol.target.position.set(0, mitt, 0);
      sol.position.set(Math.sin(az) * Math.cos(h) * D, mitt + Math.sin(h) * D, -Math.cos(az) * Math.cos(h) * D);
      sol.castShadow = p.h > 0;
      sol.intensity = p.h > 0 ? 2.4 * Math.min(1, 0.35 + Math.sin(p.h * RAD) * 1.6) : 0;
      himmel.intensity = p.h > 0 ? 0.9 : 0.55;
      skuggaOm();
    };

    // ------------------------------------------------------------------
    // Kamera och styrning
    // ------------------------------------------------------------------
    const kamera = new THREE.PerspectiveCamera(40, W() / H(), 0.5, storlek * 20);
    // toppvyn (0.10.0): ortografisk rakt uppifrån, norr (rutnätets) uppåt, för exakt plan
    const orto = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, storlek * 40);
    orto.up.set(0, 0, -1);
    let toppvy = false;
    const aktivKam = () => (toppvy ? orto : kamera);
    const START = { azimut: -0.6, lutning: 0.65, avst: storlek * 1.4, mal: [0, (zmax - zmin) / 2, 0] };
    let azimut = START.azimut, lutning = START.lutning, avst = START.avst;
    const mal = new THREE.Vector3(...START.mal);
    // läge: 'oversikt' (snurra runt), 'valj' (klicka på marken där du vill stå) eller 'ogon' (gå runt i ögonhöjd)
    let lage = 'oversikt';
    const ogon = { x: 0, z: 0, yaw: 0, pitch: 0 };
    const lyssnare = [];
    const meddela = () => lyssnare.forEach(f => { try { f({ lage, last: document.pointerLockElement === el }); } catch (e) { console.error(e); } });
    const placera = () => {
      if (toppvy) {
        const hh = avst * Math.tan(20 * RAD), a = W() / H();
        Object.assign(orto, { left: -hh * a, right: hh * a, top: hh, bottom: -hh });
        orto.position.set(mal.x, (zmax - zmin) * faktor + storlek * 4, mal.z);
        orto.lookAt(mal.x, 0, mal.z);
        orto.updateProjectionMatrix();
        uppdateraOverlagg();
        return;
      }
      if (lage === 'ogon') {
        kamera.position.set(ogon.x, markScen(ogon.x, ogon.z) + OGONHOJD, ogon.z);
        const cp = Math.cos(ogon.pitch);
        kamera.lookAt(ogon.x + Math.sin(ogon.yaw) * cp, kamera.position.y + Math.sin(ogon.pitch), ogon.z + Math.cos(ogon.yaw) * cp);
        return;
      }
      kamera.position.set(mal.x + avst * Math.cos(lutning) * Math.sin(azimut), mal.y + avst * Math.sin(lutning), mal.z + avst * Math.cos(lutning) * Math.cos(azimut));
      kamera.lookAt(mal);
      uppdateraOverlagg();
    };
    // ikonerna ovanpå scenen (kedjor, vridning) följer kameran; sätts när modelleringen är byggd
    let uppdateraOverlagg = () => {};
    placera();
    placeraTrad();
    /**
     * Flyttar punkten som kameran tittar på längs marken, som att dra kartan med handen.
     * dx, dy i pixlar; meter per pixel följer avståndet. Punkten hålls inom utsnittet plus en halv bredd.
     */
    const panorera = (dx, dy) => {
      const mpp = 2 * avst * Math.tan(20 * Math.PI / 180) / H();
      if (toppvy) {
        mal.x -= dx * mpp; mal.z -= dy * mpp;
        const grans = storlek;
        mal.x = Math.max(-grans, Math.min(grans, mal.x)); mal.z = Math.max(-grans, Math.min(grans, mal.z));
        return;
      }
      const sa = Math.sin(azimut), ca = Math.cos(azimut), fram = mpp / Math.max(0.35, Math.sin(lutning));
      mal.x += -dx * mpp * ca - dy * fram * sa;
      mal.z += dx * mpp * sa - dy * fram * ca;
      const grans = storlek;
      mal.x = Math.max(-grans, Math.min(grans, mal.x)); mal.z = Math.max(-grans, Math.min(grans, mal.z));
      mal.y = (markZ(mal.x + cx, -mal.z + cy) - zmin) * faktor;
    };
    // utsnittets kanter i scenen, för att hålla den som går inom området
    const kant = { x0: r.xmin - cx, x1: r.xmax - cx, z0: -(r.ymax - cy), z1: -(r.ymin - cy) };
    /** Var en skärmpunkt träffar marken (scenkoordinater), eller null. Går längs strålen och halverar. */
    const traffMark = (sx, sy) => {
      const b = el.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((sx - b.left) / b.width * 2 - 1, -((sy - b.top) / b.height) * 2 + 1), aktivKam());
      const o = ray.ray.origin, d = ray.ray.direction, steg = Math.max(0.5, g.s), max = storlek * 20;
      const under = t => o.y + d.y * t <= markScen(o.x + d.x * t, o.z + d.z * t);
      let forra = 0;
      for (let t = steg; t < max; t += steg) {
        const x = o.x + d.x * t, z = o.z + d.z * t;
        if (under(t)) {
          if (x < kant.x0 || x > kant.x1 || z < kant.z0 || z > kant.z1) return null;
          let a = forra, c = t;
          for (let n = 0; n < 20; n++) { const m = (a + c) / 2; if (under(m)) c = m; else a = m; }
          return { x: o.x + d.x * c, z: o.z + d.z * c };
        }
        forra = t;
      }
      return null;
    };
    const ogonhojdVid = (p, franKamera) => {
      ogon.x = p.x; ogon.z = p.z;
      // titta bort från där kameran var, ut över platsen
      const dx = p.x - franKamera.x, dz = p.z - franKamera.z;
      ogon.yaw = Math.atan2(dx, dz); ogon.pitch = -0.05;
      lage = 'ogon';
      kamera.fov = 60; kamera.near = 0.1; kamera.updateProjectionMatrix();
      spak.hidden = !(pekskarm || anvandTouch);
      el.style.cursor = 'grab';
      placera(); placeraTrad(); meddela();
    };
    const tillOversikt = () => {
      if (lage === 'oversikt') return;
      const varOgon = lage === 'ogon';
      lage = 'oversikt';
      if (document.pointerLockElement === el && document.exitPointerLock) document.exitPointerLock();
      spak.hidden = true; spakVektor.x = spakVektor.y = 0;
      for (const t in tangent) tangent[t] = false;
      el.style.cursor = '';
      if (varOgon) {
        kamera.fov = 40; kamera.near = 0.5; kamera.updateProjectionMatrix();
        // fortsätt snurra runt platsen där man stod
        mal.set(ogon.x, markScen(ogon.x, ogon.z), ogon.z);
        avst = Math.min(avst, storlek * 0.6);
      }
      placera(); placeraTrad(); meddela();
    };

    // modelleringen (längre ner) får se pekarhändelserna först
    let skissNed = null, skissFlytt = null, skissUpp = null, skissKlick = null;
    const pekare = new Map();
    let pinch = null, mitt = null, panLage = false, dragLage = 'snurra', nedVid = null, anvandTouch = false;
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') anvandTouch = true;
      if (skissNed && skissNed(e)) return;
      pekare.set(e.pointerId, [e.clientX, e.clientY]); el.setPointerCapture(e.pointerId);
      nedVid = [e.clientX, e.clientY];
      // höger- eller mittenknappen, eller skift/ctrl med vänster, gör det motsatta mot valt läge (Snurra/Flytta)
      const byt = e.pointerType === 'mouse' && (e.button === 1 || e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey);
      panLage = (dragLage === 'flytta') !== byt;
    });
    el.addEventListener('pointermove', e => {
      if (skissFlytt && skissFlytt(e)) return;
      const f = pekare.get(e.pointerId);
      if (!f) return;
      if (lage === 'ogon') {
        // dra för att titta (pekarlåset sköts av mousemove nedan)
        if (document.pointerLockElement !== el && pekare.size === 1) titta(e.clientX - f[0], e.clientY - f[1]);
        pekare.set(e.pointerId, [e.clientX, e.clientY]);
        return;
      }
      if (pekare.size === 1) {
        if (panLage || toppvy) panorera(e.clientX - f[0], e.clientY - f[1]);
        else {
          azimut -= (e.clientX - f[0]) * 0.008;
          lutning = Math.max(0.08, Math.min(1.5, lutning + (e.clientY - f[1]) * 0.006));
        }
      }
      pekare.set(e.pointerId, [e.clientX, e.clientY]);
      if (pekare.size === 2) {
        // två fingrar: nyp för att zooma, dra för att flytta
        const [a, b] = [...pekare.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (pinch) avst = Math.max(storlek * 0.05, Math.min(storlek * 8, avst * pinch / d));
        if (mitt) panorera(m[0] - mitt[0], m[1] - mitt[1]);
        pinch = d; mitt = m;
      }
      placera();
    });
    const slapp = e => {
      if (skissUpp && skissUpp(e)) return;
      const klick = nedVid && pekare.size === 1 && Math.hypot(e.clientX - nedVid[0], e.clientY - nedVid[1]) < 6 && e.type === 'pointerup';
      pekare.delete(e.pointerId); if (pekare.size < 2) { pinch = null; mitt = null; } if (!pekare.size) panLage = false;
      if (!klick) return;
      if (skissKlick && skissKlick(e)) return;
      if (lage === 'valj' && (e.pointerType !== 'mouse' || e.button === 0)) {
        const p = traffMark(e.clientX, e.clientY);
        if (p) ogonhojdVid(p, kamera.position.clone());
      }
      // i ögonhöjd låses inte musen (0.9.1): pekaren ska synas, och Esc ska inte råka ta en ur läget
    };
    el.addEventListener('pointerup', slapp); el.addEventListener('pointercancel', slapp);
    el.addEventListener('wheel', e => {
      e.preventDefault();
      if (lage === 'ogon') return;
      avst = Math.max(storlek * 0.05, Math.min(storlek * 8, avst * Math.exp(e.deltaY * 0.001))); placera();
    }, { passive: false });
    el.addEventListener('dblclick', () => aterstall());
    const aterstall = () => {
      if (lage !== 'oversikt') tillOversikt();
      azimut = START.azimut; lutning = START.lutning; avst = START.avst; mal.set(...START.mal); mal.y *= faktor; placera(); placeraTrad();
    };

    // titta runt i ögonhöjd: dra med musen eller fingret, och gå med tangenterna eller spaken.
    // Pekarlåset finns kvar om en webbläsare låser ändå, men vyn ber inte om det sedan 0.9.1.
    const titta = (dx, dy) => {
      ogon.yaw -= dx * 0.0035;
      ogon.pitch = Math.max(-1.35, Math.min(1.35, ogon.pitch - dy * 0.0035));
      placera();
    };
    const musLas = e => { if (lage === 'ogon' && document.pointerLockElement === el) titta(e.movementX || 0, e.movementY || 0); };
    document.addEventListener('mousemove', musLas);
    const lasAndrat = () => {
      // Esc släpper pekarlåset i webbläsaren utan att skicka tangenten vidare: tillbaka till översikten
      if (lage === 'ogon' && document.pointerLockElement !== el && lastVar) tillOversikt();
      lastVar = document.pointerLockElement === el;
      meddela();
    };
    let lastVar = false;
    document.addEventListener('pointerlockchange', lasAndrat);
    const tangent = { fram: false, bak: false, vanster: false, hoger: false, spring: false };
    const TANGENTER = { KeyW: 'fram', ArrowUp: 'fram', KeyS: 'bak', ArrowDown: 'bak', KeyA: 'vanster', ArrowLeft: 'vanster', KeyD: 'hoger', ArrowRight: 'hoger', ShiftLeft: 'spring', ShiftRight: 'spring' };
    const tangentNed = e => {
      if (lage !== 'ogon' || /^(INPUT|SELECT|TEXTAREA)$/.test((e.target && e.target.tagName) || '')) return;
      const t = TANGENTER[e.code];
      if (t) { tangent[t] = true; e.preventDefault(); }
    };
    const tangentUpp = e => { const t = TANGENTER[e.code]; if (t) tangent[t] = false; };
    window.addEventListener('keydown', tangentNed);
    window.addEventListener('keyup', tangentUpp);
    window.addEventListener('blur', () => { for (const t in tangent) tangent[t] = false; });

    // spaken på pekskärmen: dra från mitten för att gå, längst ut springer man
    const spak = document.createElement('div');
    spak.className = 'vy3d-spak'; spak.hidden = true; spak.setAttribute('aria-hidden', 'true');
    const knopp = document.createElement('div');
    knopp.className = 'vy3d-spak-knopp'; spak.append(knopp);
    yta.append(spak);
    const spakVektor = { x: 0, y: 0 };
    let spakId = null;
    const spakFlytta = e => {
      const b = spak.getBoundingClientRect(), rr = b.width / 2;
      let x = (e.clientX - b.left - rr) / rr, y = (e.clientY - b.top - rr) / rr;
      const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      spakVektor.x = x; spakVektor.y = y;
      knopp.style.transform = `translate(${x * rr * 0.6}px, ${y * rr * 0.6}px)`;
    };
    spak.addEventListener('pointerdown', e => { e.stopPropagation(); spakId = e.pointerId; spak.setPointerCapture(e.pointerId); spakFlytta(e); });
    spak.addEventListener('pointermove', e => { if (e.pointerId === spakId) spakFlytta(e); });
    const spakSlapp = e => { if (e.pointerId !== spakId) return; spakId = null; spakVektor.x = spakVektor.y = 0; knopp.style.transform = ''; };
    spak.addEventListener('pointerup', spakSlapp); spak.addEventListener('pointercancel', spakSlapp);

    const ga = dt => {
      let fram = (tangent.fram ? 1 : 0) - (tangent.bak ? 1 : 0), sida = (tangent.hoger ? 1 : 0) - (tangent.vanster ? 1 : 0);
      let fart = tangent.spring ? SPRINGA : GA;
      if (spakVektor.x || spakVektor.y) {
        fram = -spakVektor.y; sida = spakVektor.x;
        const l = Math.hypot(fram, sida);
        fart = l > 0.92 ? SPRINGA : GA;
        if (l > 1) { fram /= l; sida /= l; }
      } else {
        const l = Math.hypot(fram, sida); if (l > 1) { fram /= l; sida /= l; }
      }
      if (!fram && !sida) return false;
      const s = Math.sin(ogon.yaw), c = Math.cos(ogon.yaw);
      ogon.x += (s * fram - c * sida) * fart * dt;
      ogon.z += (c * fram + s * sida) * fart * dt;
      ogon.x = Math.max(kant.x0, Math.min(kant.x1, ogon.x)); ogon.z = Math.max(kant.z0, Math.min(kant.z1, ogon.z));
      placera();
      return true;
    };

    // ------------------------------------------------------------------
    // Modellera (0.10.0): rita volymer med mått, markera, flytta, vrida, snäppa och länka.
    // Bara med mus (datorn); på mobilen visas skissen som förut.
    // ------------------------------------------------------------------
    const skissLyssnare = [], husLyssnare = [];
    let historik = [], framat = [], placering = null, spoke = null, skissDrag = null, senasteSnapp = null, skissAndrad = false;
    const perId = id => volymer.find(v => v.id === id);
    const nyttId = () => 'v' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    const nyttNamn = () => { let n = volymer.length + 1; while (volymer.some(v => v.namn === `Volym ${n}`)) n++; return `Volym ${n}`; };
    // imorterade volymer vars golv ligger på marken följer marken när de flyttas
    volymer.forEach(v => {
      if (!v.primitiv || v.primitiv.typ !== 'polygon' || v.primitiv.golvAuto) return;
      const c = V3.mitt(v);
      if (Math.abs(markZ(c[0], c[1]) - v.golv) < 0.05) v.primitiv.golvAuto = true;
    });
    /** Hur långt det är (m) från den snäppta sidan till linjen den snäppte mot. */
    const aktuelltAvstand = () => {
      const sn = senasteSnapp, v = sn && sn.linje && perId(sn.id);
      if (!v) return null;
      const a = v.fotavtryck[sn.linje.sida % v.fotavtryck.length];
      return Math.round(((a[0] - sn.linje.p[0]) * sn.linje.n[0] + (a[1] - sn.linje.p[1]) * sn.linje.n[1]) * 1000) / 1000;
    };
    const meddelaSkiss = typ => {
      const v = valdId && perId(valdId);
      const ut = { typ, redigera, toppvy, volymer: volymer.map(kopia), vald: v ? kopia(v) : null, placerar: !!placering,
        grupp: v ? V3.komponent(volymer, v.id).size : 0, under: v && v.primitiv && v.primitiv.pa ? (perId(v.primitiv.pa) || {}).namn || null : null,
        snapp: senasteSnapp && v && senasteSnapp.id === v.id ? { typ: senasteSnapp.typ, mot: senasteSnapp.mot, avstand: aktuelltAvstand() } : null,
        kanAngra: historik.length > 0, kanGoraOm: framat.length > 0, andrad: skissAndrad };
      skissLyssnare.forEach(f => { try { f(ut); } catch (e) { console.error(e); } });
    };
    const sparaHistorik = () => { historik.push(JSON.stringify(volymer)); if (historik.length > 80) historik.shift(); framat = []; };
    // mål att snäppa mot: befintliga hus, fastighetsgränser och de andra volymerna
    const fastaMal = [];
    (data.befintliga || []).forEach(v => fastaMal.push({ pts: v.fotavtryck, sluten: true, mot: 'befintligt hus', prio: 1 }));
    (data.fotavtryck || []).forEach(f => fastaMal.push({ pts: f, sluten: true, mot: 'befintligt hus', prio: 1 }));
    (data.fastigheter || []).forEach(f => fastaMal.push({ pts: f, sluten: false, mot: 'fastighetsgräns', prio: 2 }));
    fastaMal.forEach(m => { const xs = m.pts.map(p => p[0]), ys = m.pts.map(p => p[1]); m.box = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; });
    const malFor = (fot, utom, r) => {
      const xs = fot.map(p => p[0]), ys = fot.map(p => p[1]), b = [Math.min(...xs) - r, Math.max(...xs) + r, Math.min(...ys) - r, Math.max(...ys) + r];
      const ut = fastaMal.filter(m => m.box[1] >= b[0] && m.box[0] <= b[1] && m.box[3] >= b[2] && m.box[2] <= b[3]);
      volymer.forEach(v => { if (!utom.has(v.id)) ut.push({ pts: v.fotavtryck, sluten: true, mot: v.namn }); });
      return ut;
    };
    /** Golvet för en volym som följer underlaget: den volym den står på, annars marken mitt under. */
    const golvFor = (v, utom) => {
      const u = V3.underlag(v, volymer, utom), c = V3.mitt(v);
      return u ? { golv: Math.round((u.golv + u.takfot) * 1000) / 1000, pa: u.id } : { golv: Math.round(markZ(c[0], c[1]) * 100) / 100, pa: null };
    };
    /** Volymerna som står på id, direkt eller ovanpå varandra (de kan inte bära den). */
    const ovanpa = id => {
      const ut = new Set();
      for (let andr = true; andr;) {
        andr = false;
        for (const v of volymer) if (v.primitiv && v.primitiv.pa && !ut.has(v.id) && (v.primitiv.pa === id || ut.has(v.primitiv.pa))) { ut.add(v.id); andr = true; }
      }
      return ut;
    };
    const utomFor = (id, grupp) => { const u = new Set(grupp || V3.komponent(volymer, id)); ovanpa(id).forEach(i => u.add(i)); return u; };
    /** Volymer som följer underlaget får rätt golv igen (nerifrån och upp), utom de i utom. */
    const foljUnderlag = (utom = new Set()) => {
      for (let varv = 0; varv < 4; varv++) {
        let andr = false;
        for (const v of volymer.slice().sort((a, b) => a.golv - b.golv)) {
          if (utom.has(v.id) || !v.primitiv || !v.primitiv.golvAuto) continue;
          const g = golvFor(v, utomFor(v.id));
          if (Math.abs(g.golv - v.golv) > 1e-3 || g.pa !== v.primitiv.pa) { v.golv = g.golv; v.primitiv.pa = g.pa; andr = true; }
        }
        if (!andr) break;
      }
    };
    const andring = () => { skissAndrad = true; foljUnderlag(); ritaSkiss(); bygOverlagg(); meddelaSkiss('andrad'); };
    const ogonblick = id => new Map([...V3.komponent(volymer, id)].map(i => [i, kopia(perId(i))]));
    const aterstallFran = start => start.forEach((s0, id) => { const v = perId(id); v.primitiv = kopia(s0.primitiv); v.golv = s0.golv; V3.uppdatera(v); });
    /** Flyttar gruppen (dx, dy) från läget i start, snäpper och låter golvet följa underlaget. */
    const flyttaGrupp = (start, primId, dx, dy, { snappa = true, tol = 0.5 } = {}) => {
      aterstallFran(start);
      const ids = new Set(start.keys()), prim = perId(primId);
      ids.forEach(id => V3.flytta(perId(id), dx, dy));
      senasteSnapp = null;
      if (snappa) {
        const mal = malFor(prim.fotavtryck, ids, tol + 1), sn = V3.snapp(prim.fotavtryck, mal, tol);
        if (sn) { ids.forEach(id => V3.flytta(perId(id), sn.dx, sn.dy)); senasteSnapp = Object.assign(sn, { id: primId, mot: mal[sn.mal].mot }); }
      }
      if (prim.primitiv.golvAuto) {
        const u = new Set(ids); ids.forEach(id => ovanpa(id).forEach(i => u.add(i)));
        const g = golvFor(prim, u), dz = g.golv - prim.golv;
        prim.primitiv.pa = g.pa;
        if (Math.abs(dz) > 1e-6) ids.forEach(id => { const v = perId(id); v.golv = Math.round((v.golv + dz) * 1000) / 1000; });
      }
      return senasteSnapp;
    };
    const vridGrupp = (start, primId, grader) => {
      aterstallFran(start);
      const p = perId(primId).primitiv;
      start.forEach((s0, id) => V3.vrid(perId(id), grader, p.x, p.y));
    };

    // --- träffar under pekaren
    const ray = new THREE.Raycaster();
    const straleFran = (sx, sy) => { const b = el.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((sx - b.left) / b.width * 2 - 1, -((sy - b.top) / b.height) * 2 + 1), aktivKam()); return ray; };
    const synligt = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
    const traffA = (sx, sy, rot, nyckel) => {
      const t = straleFran(sx, sy).intersectObjects(rot, true).find(h => h.object.isMesh && h.object.userData[nyckel] != null && synligt(h.object));
      return t ? { id: t.object.userData[nyckel], punkt: t.point } : null;
    };
    /** Var strålen träffar ett vågrätt plan på världshöjden y, i zonens koordinater. */
    const iPlan = (sx, sy, y) => {
      const r = straleFran(sx, sy).ray;
      if (Math.abs(r.direction.y) < 1e-6) return null;
      const t = (y - r.origin.y) / r.direction.y;
      if (t < 0) return null;
      return { x: r.origin.x + r.direction.x * t + cx, y: -(r.origin.z + r.direction.z * t) + cy };
    };
    /** Snäppavståndet: tio pixlar i meter där man drar. */
    const tolerans = varld => {
      const mpp = toppvy ? (orto.top - orto.bottom) / H() : 2 * kamera.position.distanceTo(varld) * Math.tan(20 * RAD) / H();
      return Math.max(0.05, Math.min(3, mpp * 10));
    };

    // --- spöket när en ny volym placeras
    const taBortSpoke = () => { if (spoke) { grupp.remove(spoke.grupp); kastaBort(spoke.grupp); spoke = null; } };
    const visaSpoke = (sx, sy, snappa) => {
      const p = traffMark(sx, sy);
      taBortSpoke();
      if (!p) return null;
      const v = V3.ny(placering.mall, p.x + cx, -p.z + cy, 0, 'spoke', 'spoke');
      const g0 = golvFor(v, new Set()); v.golv = g0.golv; v.primitiv.pa = g0.pa;
      if (snappa) {
        const sn = V3.snapp(v.fotavtryck, malFor(v.fotavtryck, new Set(), 2), tolerans(new THREE.Vector3(p.x, markScen(p.x, p.z), p.z)));
        if (sn) { V3.flytta(v, sn.dx, sn.dy); const g = golvFor(v, new Set()); v.golv = g.golv; v.primitiv.pa = g.pa; }
      }
      spoke = { v, grupp: byggVolym(v, spokMat, spokMat) };
      grupp.add(spoke.grupp);
      return v;
    };
    const placeraVolym = v => {
      sparaHistorik();
      v.id = nyttId(); v.namn = nyttNamn();
      volymer.push(v);
      placering = null; taBortSpoke(); el.style.cursor = '';
      valdId = v.id; senasteSnapp = null;
      andring();
    };

    // --- ikoner ovanpå scenen: kedjor där volymer möts och ett handtag för att vrida den valda
    const overlagg = document.createElement('div');
    overlagg.className = 'vy3d-overlagg';
    yta.append(overlagg);
    const KEDJA = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
    const VRID = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    let ikoner = [];   // { el, punkt: [x, y, z] (zon) }
    const tillSkarm = q => {
      const w = iScen(q[0], q[1], q[2]); w.y *= faktor;
      w.project(aktivKam());
      return { x: (w.x + 1) / 2 * el.clientWidth, y: (1 - w.y) / 2 * el.clientHeight, syns: w.z < 1 && w.z > -1 && Math.abs(w.x) < 1.05 && Math.abs(w.y) < 1.05 };
    };
    uppdateraOverlagg = () => {
      overlagg.hidden = lage !== 'oversikt';
      for (const ik of ikoner) {
        const s2 = tillSkarm(ik.punkt);
        ik.el.hidden = !s2.syns || !!skissDrag;
        ik.el.style.transform = `translate(${s2.x}px, ${s2.y}px)`;
      }
    };
    const bygOverlagg = () => {
      overlagg.innerHTML = ''; ikoner = [];
      if (!redigera || lage !== 'oversikt') return;
      for (const k of V3.kontakter(volymer)) {
        const a = perId(k.a), b = perId(k.b), lank = V3.lankade(a, b);
        const knapp = document.createElement('button');
        knapp.type = 'button'; knapp.className = 'vy3d-kedja' + (lank ? ' lankad' : '');
        knapp.innerHTML = KEDJA; knapp.dataset.a = k.a; knapp.dataset.b = k.b;
        knapp.title = lank ? `${a.namn} och ${b.namn} sitter ihop. Klicka för att lösa upp.` : `Klicka för att sätta ihop ${a.namn} och ${b.namn}, så att de flyttas och vrids tillsammans.`;
        knapp.setAttribute('aria-pressed', String(lank));
        knapp.addEventListener('click', () => { sparaHistorik(); V3.vaxlaLank(a, b); andring(); });
        overlagg.append(knapp); ikoner.push({ el: knapp, punkt: k.punkt });
      }
      const v = valdId && perId(valdId);
      if (v) {
        // handtaget utanför volymen, framför den sett från kameran
        const p = v.primitiv, r = Math.max(...v.fotavtryck.map(q => Math.hypot(q[0] - p.x, q[1] - p.y))) + 1.5;
        const fram = toppvy ? [0, -1] : (() => { const d = new THREE.Vector3(); kamera.getWorldDirection(d); const l = Math.hypot(d.x, d.z) || 1; return [-d.x / l, d.z / l]; })();
        const handtag = document.createElement('button');
        handtag.type = 'button'; handtag.className = 'vy3d-vrid'; handtag.innerHTML = VRID;
        handtag.title = 'Dra för att vrida. Håll ned skift för steg om 15°.';
        handtag.addEventListener('pointerdown', e => {
          if (e.button !== 0) return;
          e.preventDefault(); e.stopPropagation();
          handtag.setPointerCapture(e.pointerId);
          const y = (v.golv - zmin) * faktor, q0 = iPlan(e.clientX, e.clientY, y);
          if (!q0) return;
          skissDrag = { typ: 'vrid', id: v.id, y, start: ogonblick(v.id), a0: Math.atan2(q0.y - p.y, q0.x - p.x), vrid0: p.vrid || 0, flyttat: false, pekare: e.pointerId };
        });
        handtag.addEventListener('pointermove', e => { if (skissDrag && skissDrag.typ === 'vrid' && e.pointerId === skissDrag.pekare) vridDrag(e); });
        const slut = e => { if (skissDrag && skissDrag.typ === 'vrid' && e.pointerId === skissDrag.pekare) slutaDra(); };
        handtag.addEventListener('pointerup', slut); handtag.addEventListener('pointercancel', slut);
        overlagg.append(handtag); ikoner.push({ el: handtag, punkt: [p.x + fram[0] * r, p.y + fram[1] * r, v.golv] });
      }
      uppdateraOverlagg();
    };
    const vridDrag = e => {
      const d = skissDrag, p0 = d.start.get(d.id).primitiv, q = iPlan(e.clientX, e.clientY, d.y);
      if (!q) return;
      if (!d.flyttat) { sparaHistorik(); d.flyttat = true; }
      let g = (Math.atan2(q.y - p0.y, q.x - p0.x) - d.a0) / RAD;
      if (e.shiftKey) g = Math.round((d.vrid0 + g) / 15) * 15 - d.vrid0;
      vridGrupp(d.start, d.id, Math.round(g * 100) / 100);
      senasteSnapp = null;
      ritaSkiss({ kanter: false });
      d.vridning = Math.round(((d.vrid0 + g) % 360 + 360) % 360);
      meddelaSkiss('drar');
    };
    const slutaDra = () => {
      const d = skissDrag;
      skissDrag = null;
      if (d && d.flyttat) andring(); else { bygOverlagg(); }
    };

    // --- pekaren
    skissNed = e => {
      if (!redigera || lage !== 'oversikt' || e.pointerType !== 'mouse' || e.button !== 0 || placering) return false;
      if (e.shiftKey || e.ctrlKey || e.metaKey) return false;
      const t = traffA(e.clientX, e.clientY, skiss.children, 'volym');
      if (!t) return false;
      if (valdId !== t.id) { valdId = t.id; senasteSnapp = null; ritaSkiss(); bygOverlagg(); meddelaSkiss('val'); }
      el.setPointerCapture(e.pointerId);
      const q0 = iPlan(e.clientX, e.clientY, t.punkt.y);
      skissDrag = { typ: 'flytta', id: t.id, y: t.punkt.y, varld: t.punkt.clone(), fran: q0, ned: [e.clientX, e.clientY], start: ogonblick(t.id), flyttat: false, pekare: e.pointerId };
      return true;
    };
    skissFlytt = e => {
      if (placering && !pekare.size && !skissDrag) { visaSpoke(e.clientX, e.clientY, !e.altKey); return false; }
      const d = skissDrag;
      if (!d || d.typ !== 'flytta' || e.pointerId !== d.pekare) return false;
      if (!d.flyttat && Math.hypot(e.clientX - d.ned[0], e.clientY - d.ned[1]) < 4) return true;
      const q = iPlan(e.clientX, e.clientY, d.y);
      if (!q || !d.fran) return true;
      if (!d.flyttat) { sparaHistorik(); d.flyttat = true; uppdateraOverlagg(); }
      flyttaGrupp(d.start, d.id, q.x - d.fran.x, q.y - d.fran.y, { snappa: !e.altKey, tol: tolerans(d.varld) });
      ritaSkiss({ kanter: false });
      meddelaSkiss('drar');
      return true;
    };
    skissUpp = e => {
      if (!skissDrag || skissDrag.typ !== 'flytta' || e.pointerId !== skissDrag.pekare) return false;
      slutaDra();
      return true;
    };
    skissKlick = e => {
      if (lage !== 'oversikt' || (e.pointerType === 'mouse' && e.button !== 0)) return false;
      if (redigera) {
        if (placering) { const v = visaSpoke(e.clientX, e.clientY, !e.altKey); if (v) placeraVolym(v); return true; }
        if (valdId) { valdId = null; senasteSnapp = null; ritaSkiss(); bygOverlagg(); meddelaSkiss('val'); }
        return true;
      }
      // utanför modelleringen: ett klick på ett befintligt hus väljer det (egen takform), på ett träd trädet (0.11.0)
      return valjObjekt(e.clientX, e.clientY);
    };
    const valjObjekt = (sx, sy) => {
      const t = husLager && traffA(sx, sy, husLager.children, 'hus');
      const tr = traffTrad(sx, sy);
      const husD = t ? straleFran(sx, sy).ray.origin.distanceTo(t.punkt) : Infinity;
      const tradVald = !!tr && tr.d < husD;
      husLyssnare.forEach(f => { try { f(t && !tradVald ? t.id : null); } catch (err) { console.error(err); } });
      tradLyssnare.forEach(f => { try { f(tradVald ? tr.i : null); } catch (err) { console.error(err); } });
      return !!t || tradVald;
    };
    const redigeraTangent = e => {
      if (!redigera || /^(INPUT|SELECT|TEXTAREA)$/.test((e.target && e.target.tagName) || '')) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) gorOm(); else angra(); }
      else if (ctrl && e.code === 'KeyY') { e.preventDefault(); gorOm(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && valdId) { e.preventDefault(); taBortVald(); }
    };
    window.addEventListener('keydown', redigeraTangent);
    const angra = () => {
      if (!historik.length) return false;
      framat.push(JSON.stringify(volymer)); volymer = JSON.parse(historik.pop());
      if (valdId && !perId(valdId)) valdId = null;
      senasteSnapp = null; skissAndrad = true; ritaSkiss(); bygOverlagg(); meddelaSkiss('andrad'); return true;
    };
    const gorOm = () => {
      if (!framat.length) return false;
      historik.push(JSON.stringify(volymer)); volymer = JSON.parse(framat.pop());
      if (valdId && !perId(valdId)) valdId = null;
      senasteSnapp = null; skissAndrad = true; ritaSkiss(); bygOverlagg(); meddelaSkiss('andrad'); return true;
    };
    const taBortVald = () => {
      const v = valdId && perId(valdId);
      if (!v) return false;
      sparaHistorik();
      volymer = volymer.filter(w => w !== v);
      volymer.forEach(w => { if (w.primitiv && w.primitiv.lankar) w.primitiv.lankar = w.primitiv.lankar.filter(i => i !== v.id); });
      valdId = null; senasteSnapp = null;
      andring(); return true;
    };
    const andraVald = f => {
      const v = valdId && perId(valdId);
      if (!v) return null;
      sparaHistorik();
      const p = V3.franVolym(v).primitiv, tal = x => (typeof x === 'number' && isFinite(x) ? x : null);
      if (typeof f.namn === 'string' && f.namn.trim()) v.namn = f.namn.trim().slice(0, 60);
      if (tal(f.hojd) > 0) v.takfot = tal(f.hojd);
      if (['platt', 'sadel', 'pulpet', 'valm'].includes(f.takform) && (p.typ === 'polygon' || (p.typ === 'prisma' && f.takform !== 'platt'))) v.takform = f.takform;
      if (tal(f.taklutning) != null) v.taklutning = Math.min(75, Math.max(0, tal(f.taklutning)));
      if (tal(f.b) > 0 && p.b != null) p.b = tal(f.b);
      if (tal(f.d) > 0 && p.d != null) p.d = tal(f.d);
      if (tal(f.diam) > 0 && p.diam != null) p.diam = tal(f.diam);
      if (tal(f.vrid) != null) V3.vrid(v, tal(f.vrid) - (p.vrid || 0), p.x, p.y);
      if (f.golvAuto === true) p.golvAuto = true;
      if (tal(f.golv) != null) { p.golvAuto = false; p.pa = null; v.golv = tal(f.golv); }
      V3.uppdatera(v);
      senasteSnapp = f.behallSnapp ? senasteSnapp : null;
      andring();
      return kopia(v);
    };
    const avstand = m => {
      const sn = senasteSnapp, v = sn && sn.linje && perId(sn.id), nu = aktuelltAvstand();
      if (!v || nu == null || !isFinite(m)) return null;
      sparaHistorik();
      const d = m - nu;
      V3.komponent(volymer, v.id).forEach(id => V3.flytta(perId(id), sn.linje.n[0] * d, sn.linje.n[1] * d));
      andring();
      return aktuelltAvstand();
    };
    const kopieraVald = () => {
      const v = valdId && perId(valdId);
      if (!v) return null;
      sparaHistorik();
      const k = kopia(v), p = V3.franVolym(k).primitiv, r = (p.vrid || 0) * RAD;
      // bredvid originalet, längs dess egen x-axel, så att sidorna ligger an
      const xs = v.fotavtryck.map(q => (q[0] - p.x) * Math.cos(r) + (q[1] - p.y) * Math.sin(r)), bredd = Math.max(...xs) - Math.min(...xs);
      k.id = nyttId(); k.namn = nyttNamn(); p.lankar = [];
      V3.flytta(k, Math.cos(r) * bredd, Math.sin(r) * bredd);
      volymer.push(k); valdId = k.id; senasteSnapp = null;
      andring();
      return kopia(k);
    };
    const satRedigera = pa => {
      pa = !!pa;
      if (pa === redigera) return redigera;
      redigera = pa;
      if (redigera) { if (lage !== 'oversikt') tillOversikt(); skiss.visible = true; }
      else { placering = null; taBortSpoke(); valdId = null; senasteSnapp = null; el.style.cursor = ''; }
      ritaSkiss(); bygOverlagg(); meddelaSkiss('lage');
      return redigera;
    };
    const satToppvy = pa => {
      pa = !!pa;
      if (pa === toppvy) return toppvy;
      if (pa && lage !== 'oversikt') tillOversikt();
      toppvy = pa;
      placera(); placeraTrad(); bygOverlagg(); meddelaSkiss('vy');
      return toppvy;
    };
    // markerat befintligt hus (egen takform)
    const valdHusMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, flatShading: true });
    let markeratHus = null;
    const markeraHus = id => {
      if (!husLager) return;
      valdHusMat.color.copy(befMat.color).lerp(new THREE.Color('#ffd27a'), 0.55);
      husLager.traverse(o => {
        if (!o.isMesh || o.userData.hus == null) return;
        if (!o.userData.egenMat) o.userData.egenMat = o.material;
        o.material = o.userData.hus === id ? valdHusMat : o.userData.egenMat;
      });
      markeratHus = id;
    };

    // ------------------------------------------------------------------
    // Enskilda träd och hus (0.11.0): välja, markera, ändra och dölja
    // ------------------------------------------------------------------
    /** Trädet som strålen träffar först: en lodrät cylinder per träd (nästan kronans radie), billigare än modellerna. */
    const traffTrad = (sx, sy) => {
      if (!tradLager || !synligt(tradLager)) return null;
      const r = straleFran(sx, sy).ray, f = faktor;
      const ox = r.origin.x, oy = r.origin.y / f, oz = r.origin.z, dx = r.direction.x, dy = r.direction.y / f, dz = r.direction.z;
      let bast = null;
      trad.forEach((t, i) => {
        if (t.dolt) return;
        const R = Math.max(0.6, t.kr * 0.45), ex = ox - t.x, ez = oz - t.z;
        const a = dx * dx + dz * dz, b = 2 * (ex * dx + ez * dz), c = ex * ex + ez * ez - R * R;
        const kand = [];
        if (a > 1e-12) { const D = b * b - 4 * a * c; if (D >= 0) { const q = Math.sqrt(D); kand.push((-b - q) / (2 * a), (-b + q) / (2 * a)); } }
        if (Math.abs(dy) > 1e-12) kand.push((t.b + t.h - oy) / dy);
        for (const u of kand) {
          if (!(u > 0) || (bast && u >= bast.d)) continue;
          const px = ex + u * dx, pz = ez + u * dz, py = oy + u * dy;
          if (px * px + pz * pz <= R * R + 1e-6 && py >= t.b - 0.1 && py <= t.b + t.h + 0.1) bast = { i, d: u };
        }
      });
      return bast;
    };
    const tradLyssnare = [];
    const tradMarkMat = new THREE.LineBasicMaterial({ color: '#ffb000', depthTest: false, transparent: true });
    let tradMark = null, markeratTrad = null;
    /** Ringar vid marken och toppen och fyra lodräta linjer runt det valda trädet. */
    const markeraTrad = i => {
      if (tradMark) { tradMark.parent.remove(tradMark); tradMark.geometry.dispose(); tradMark = null; }
      markeratTrad = i == null ? null : i;
      const t = i != null && trad[i];
      if (!t || t.dolt || !tradLager) return;
      const p = [], n = 32, R = t.kr / 2, y0 = t.b + 0.1, y1 = t.b + t.h;
      const pk = a => [t.x + R * Math.cos(a), t.z + R * Math.sin(a)];
      for (const y of [y0, y1]) for (let k = 0; k < n; k++) { const [a, b] = pk(k / n * 2 * Math.PI), [c, d] = pk((k + 1) / n * 2 * Math.PI); p.push(a, y, b, c, y, d); }
      for (let k = 0; k < 4; k++) { const [a, b] = pk(k / 4 * 2 * Math.PI + 0.4); p.push(a, y0, b, a, y1, b); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      tradMark = new THREE.LineSegments(g, tradMarkMat); tradMark.renderOrder = 10;
      tradLager.add(tradMark);
    };
    /** Döljer eller visar ett befintligt hus: objekten tas ur lagret, så att de inte syns, kastar skugga eller kan väljas. */
    const doldaHus = new Map();
    const doljHus = (id, dolt) => {
      if (!husLager) return false;
      if (dolt) {
        if (doldaHus.has(id)) return true;
        const obj = husLager.children.filter(o => o.userData.hus === id);
        if (!obj.length) return false;
        obj.forEach(o => husLager.remove(o));
        doldaHus.set(id, obj);
        if (markeratHus === id) markeraHus(null);
      } else {
        const obj = doldaHus.get(id);
        if (!obj) return false;
        obj.forEach(o => husLager.add(o));
        doldaHus.delete(id);
      }
      skuggaOm();
      return true;
    };
    (data.doldaHus || []).forEach(id => doljHus(id, true));

    const storleksandring = () => { renderer.setSize(W(), H()); kamera.aspect = W() / H(); kamera.updateProjectionMatrix(); placera(); };
    window.addEventListener('resize', storleksandring);
    // ytan ändrar storlek också när raderna ovanför bryts om (lager, solraden); canvasen följer med
    const iakttagare = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (el.width !== Math.round(W() * renderer.getPixelRatio()) || el.height !== Math.round(H() * renderer.getPixelRatio())) storleksandring(); }) : null;
    if (iakttagare) iakttagare.observe(yta);

    let aktiv = true, forraTid = performance.now(), tradTid = 0;
    const loop = nu => {
      if (!aktiv) return;
      nu = nu || performance.now();
      const dt = Math.min(0.25, (nu - forraTid) / 1000); forraTid = nu;
      if (lage === 'ogon') ga(dt);
      // byt detaljerade och enkla träd när kameran har flyttat sig en bit
      if (tradniva !== 'enkel' && tradPlats && nu - tradTid > 250) {
        const flytt = aktivKam().position.distanceTo(tradPlats), avstand = Math.max(10, toppvy ? avst : kamera.position.distanceTo(mal));
        if (flytt > Math.min(20, Math.max(2, avstand * 0.05))) { placeraTrad(); tradTid = nu; }
      }
      renderer.render(scen, aktivKam());
      requestAnimationFrame(loop);
    };
    skuggaOm();
    loop();

    // ------------------------------------------------------------------
    // Bilder (0.9.0): färgbild i högre upplösning, och för AI lermodell, kantlinjer och djupkarta
    // ------------------------------------------------------------------
    const djupMat = new THREE.ShaderMaterial({
      uniforms: { bortre: { value: 1 } }, side: THREE.DoubleSide,
      vertexShader: `varying float vD;
        void main() { vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
          vec4 mv = modelViewMatrix * p; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float bortre; varying float vD;
        void main() {
          float v = clamp(vD / bortre, 0.0, 0.99999);
          vec3 e = fract(v * vec3(1.0, 255.0, 65025.0)); e -= e.yzz * vec3(1.0 / 255.0, 1.0 / 255.0, 0.0);
          gl_FragColor = vec4(e, 1.0); }`,
    });
    const normalMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: `varying vec3 vN;
        void main() { vec4 p = vec4(position, 1.0); vec3 n = normal;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
        #endif
          vN = normalize(normalMatrix * n); gl_Position = projectionMatrix * modelViewMatrix * p; }`,
      fragmentShader: `varying vec3 vN;
        void main() {
          vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0); gl_FragColor = vec4(n * 0.5 + 0.5, 1.0); }`,
    });
    const leraMat = new THREE.MeshLambertMaterial({ color: '#f4f2ee', side: THREE.DoubleSide, shadowSide: THREE.FrontSide });
    /** Byter material på alla ytor under gor() och tar tillbaka dem efteråt. */
    const medMaterial = (mat, gor) => {
      const byten = [];
      scen.traverse(o => { if (o.isMesh && !o.userData.hjalp) { byten.push([o, o.material]); o.material = mat; } });
      try { return gor(); } finally { byten.forEach(([o, m]) => { o.material = m; }); }
    };

    /** Ritar scenen i en bild w × h och läser tillbaka pixlarna (nerifrån och upp). */
    const rendera = (kam, w, h, { msaa = true, srgb = true } = {}) => {
      const rt = new THREE.WebGLRenderTarget(w, h, { samples: msaa ? 4 : 0, type: THREE.UnsignedByteType, format: THREE.RGBAFormat });
      rt.texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      renderer.setRenderTarget(rt);
      renderer.render(scen, kam);
      const px = new Uint8Array(w * h * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
      renderer.setRenderTarget(null);
      rt.dispose();
      return px;
    };
    const tillCanvas = (rgba, w, h) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0);
      return c;
    };
    const somPng = c => new Promise((ok, fel) => c.toBlob(b => (b ? ok(b) : fel(new Error('Bilden blev för stor för webbläsaren.'))), 'image/png'));
    /** Döljer linjerna (kurvor, gränser, ram, konturer) under en rendering och tar tillbaka dem efteråt. */
    const utanLinjer = gor => {
      const dolda = [];
      scen.traverse(o => { if ((o.isLine || o.isLineSegments) && o.visible) { o.visible = false; dolda.push(o); } });
      try { return gor(); } finally { dolda.forEach(o => { o.visible = true; }); }
    };

    async function bilder({ skala = 2, ai = false } = {}) {
      const Bild3D = window.Bild3D;
      const gl = renderer.getContext();
      const maxSida = Math.min(8192, renderer.capabilities.maxTextureSize || 4096, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096);
      const st = Bild3D.storlek(W(), H(), skala, { maxSida, maxPx: mobil ? 16e6 : 40e6 });
      const w = st.bredd, h = st.hojd;
      const kam = aktivKam().clone();
      if (toppvy) { const hh = kam.top; kam.left = -hh * w / h; kam.right = hh * w / h; } else kam.aspect = w / h;
      kam.updateProjectionMatrix();
      const ut = { bredd: w, hojd: h, skala: st.skala };
      ut.farg = await somPng(tillCanvas(Bild3D.vand(rendera(kam, w, h), w, h), w, h));
      if (!ai) return ut;
      // lermodell: allt vitt, utan linjer, med skuggorna som de är
      scen.background = new THREE.Color('#ffffff');
      try { ut.lera = await somPng(tillCanvas(Bild3D.vand(medMaterial(leraMat, () => utanLinjer(() => rendera(kam, w, h))), w, h), w, h)); }
      finally { scen.background = bakgrund; }
      // djup och normaler utan kantutjämning, himlen genomskinlig
      const forraKlar = renderer.getClearAlpha(), forraFarg = renderer.getClearColor(new THREE.Color());
      scen.background = null; renderer.setClearColor(0x000000, 0);
      let djupPx, normPx;
      djupMat.uniforms.bortre.value = kam.far;
      try {
        utanLinjer(() => {
          djupPx = medMaterial(djupMat, () => rendera(kam, w, h, { msaa: false, srgb: false }));
          normPx = medMaterial(normalMat, () => rendera(kam, w, h, { msaa: false, srgb: false }));
        });
      } finally { scen.background = bakgrund; renderer.setClearColor(forraFarg, forraKlar); }
      const d = Bild3D.avkodaDjup(djupPx, w, h, kam.far);
      ut.djup = await somPng(tillCanvas(Bild3D.djupbild(d, w, h), w, h));
      const n = Bild3D.avkodaNormaler(normPx, w, h);
      ut.kanter = await somPng(tillCanvas(Bild3D.kanter(d, n, w, h, { bredd: Math.max(1, Math.round(st.skala)) }), w, h));
      return ut;
    }

    const material = () => [markMat, ortoMat, tradMat, kurvMat, konturMat, befMat, skissMat, skissTakMat, valdMat, gruppMat, spokMat, takMat, valdHusMat];
    return {
      /** Ortofotot på eller av; null om det saknas. */
      ortofoto(pa) { if (!ortoMat) return null; if (pa != null) terrang.material = pa ? ortoMat : markMat; return terrang.material === ortoMat; },
      /** Lagren som finns i vyn och om de syns: { kurvor: true, … }. */
      lager() { const ut = {}; for (const n in lager) ut[n] = lager[n].visible; return ut; },
      /** Slår ett lager av eller på; returnerar om det syns, eller null om det saknas. */
      visaLager(namn, pa) { const l = lager[namn]; if (!l) return null; if (pa != null && l.visible !== !!pa) { l.visible = !!pa; skuggaOm(); } return l.visible; },
      overdriv(f) {
        if (f == null) return faktor;
        mal.y = mal.y / faktor * f; faktor = f; grupp.scale.set(1, f, 1);
        uppdateraSol(); placera(); skuggaOm(); return faktor;
      },
      /** Höjdkurvornas färg (#rrggbb); utan argument den nuvarande. null om kurvor saknas. */
      kurvfarg(c) { if (!kurvMat) return null; if (c) kurvMat.color.set(c); return '#' + kurvMat.color.getHexString(); },
      /** Färgen på befintliga byggnader (0.9.0); null om det inte finns några med höjd. */
      byggnadsfarg(c) { if (!harBefintliga) return null; if (c) { befMat.color.set(c); takMat.color.set(c); } return '#' + befMat.color.getHexString(); },
      /** Skissens färg (0.9.0); null om det inte finns någon skiss. */
      skissfarg(c) { if (c) { satSkissfarg(c); } return '#' + skissMat.color.getHexString(); },
      /** Svarta konturer på byggnaderna och skissen (0.9.0); null om det inte finns några. */
      /** Färgen på husens konturer och fotavtrycken utan höjd (0.9.1); null om det inte finns några. */
      konturfarg(c) {
        if (!konturer.length && !fotMat) return null;
        if (c) { konturMat.color.set(c); if (fotMat) fotMat.color.set(c); }
        return '#' + (konturer.length ? konturMat : fotMat).color.getHexString();
      },
      /** Fastighetsgränsernas färg (0.9.1); null om gränser saknas. */
      gransfarg(c) { if (!gransMat) return null; if (c) gransMat.color.set(c); return '#' + gransMat.color.getHexString(); },
      /** Takformer ur laserdatan på de befintliga husen (0.9.1); null om inget hus har en takform. */
      takformer(pa) { if (!formade.size) return null; if (pa != null) visaTakformer(pa); return takformerPa; },
      /** Hur många hus som har en takform, för testerna. */
      takformantal() { return formade.size; },
      konturer(pa) { if (!konturer.length) return null; if (pa != null) { visaKonturer = !!pa; konturer.forEach(l => { l.visible = visaKonturer; }); } return visaKonturer; },
      /** Skuggor efter solens läge (0.9.0); null om platsen saknas. */
      skuggor(pa) { if (!kanSkugga) return null; if (pa != null) { skuggorPa = !!pa; uppdateraSol(); } return skuggorPa; },
      /** Tidpunkten för solen (ms, UTC). Returnerar solens läge { az, h } i grader, eller null. */
      soltid(ms) { if (!kanSkugga) return null; if (ms != null) { soltid = ms; uppdateraSol(); } return window.Sol.solensLage(soltid, data.sol.lat, data.sol.lon); },
      /** Om träden kastar skugga (kan stängas av om det blir tungt på mobilen). null om träd saknas. */
      tradskuggor(pa) {
        if (!trad.length) return null;
        if (pa != null) { tradskugga = !!pa; for (const im of allaTradMesh()) im.castShadow = tradskugga; skuggaOm(); }
        return tradskugga;
      },
      /** 'enkel' eller 'detaljerad' ('realistisk' från 0.9.1 blir detaljerad); null om träd saknas. */
      tradniva(n) { if (!tradLager) return null; if (n === 'realistisk') n = 'detaljerad'; if (NIVAER.includes(n)) { tradniva = n; placeraTrad(); } return tradniva; },
      /** Hur många träd som visas per nivå och art eller typ, för testerna: { enkel: { gran: 3 }, detaljerad: { bjork: 2 } }. */
      tradantal() { const ut = {}; for (const n of NIVAER) { ut[n] = {}; for (const k in tradMesh[n]) ut[n][k] = tradMesh[n][k].count; } return ut; },
      /** Vad det gör att dra med ett finger eller vänster musknapp: 'snurra' eller 'flytta' (0.8.1). */
      dragLage(l) { if (l === 'snurra' || l === 'flytta') dragLage = l; return dragLage; },
      /**
       * Ögonhöjd (0.9.0): första anropet väntar på ett klick på marken, nästa (eller Esc) går tillbaka.
       * Med en punkt { x, y } i zonens koordinater ställer det sig där direkt (för testerna).
       */
      ogonhojd(punkt) {
        if (toppvy) satToppvy(false);
        if (punkt) { ogonhojdVid({ x: punkt.x - cx, z: -(punkt.y - cy) }, kamera.position.clone()); return lage; }
        if (lage === 'oversikt') { lage = 'valj'; el.style.cursor = 'crosshair'; meddela(); }
        else tillOversikt();
        return lage;
      },
      /** 'oversikt', 'valj' eller 'ogon'. */
      lage() { return lage; },
      /** Tillbaka till översikten från ögonhöjd eller valet av punkt. */
      oversikt() { tillOversikt(); },
      /** Går i ögonhöjd som om tangenterna hölls nere i sek sekunder (för testerna). */
      ga(fram, sida, sek) { if (lage !== 'ogon') return null; tangent.fram = fram > 0; tangent.bak = fram < 0; tangent.hoger = sida > 0; tangent.vanster = sida < 0; for (let t = 0; t < sek; t += 0.05) ga(0.05); for (const t in tangent) tangent[t] = false; return { x: ogon.x + cx, y: -ogon.z + cy, z: kamera.position.y / faktor + zmin }; },
      /** Anropas med { lage, last } när läget ändras. */
      lyssna(fn) { lyssnare.push(fn); },
      bilder,
      // --- egen takform på befintliga hus (0.10.0)
      /** Anropas med husets id (som i Byggnad.somVolymer) när man klickar på ett hus, null utanför. */
      lyssnaHus(fn) { husLyssnare.push(fn); },
      /** Markerar ett hus (null tar bort markeringen). */
      markeraHus(id) { markeraHus(id); },
      /** Byter takformen på ett hus: t ur Byggnad.takmodell, null = ingen takform. Slår på takformerna. */
      bytTak(id, t) {
        const ok = bytTak(id, t);
        if (ok && t && !takformerPa) visaTakformer(true);
        if (ok && markeratHus === id) markeraHus(id);
        return ok;
      },
      // --- enskilda träd och hus (0.11.0)
      /** Anropas med trädets index (i data.trad) när man klickar på ett träd, null utanför. */
      lyssnaTrad(fn) { tradLyssnare.push(fn); },
      /** Markerar ett träd (null tar bort markeringen). */
      markeraTrad(i) { markeraTrad(i); },
      /** Byter träd i (samma form som i data.trad, zonens koordinater); t.dolt döljer det. */
      bytTrad(i, t) {
        if (!trad[i] || !t) return false;
        trad[i] = tradIScen(t);
        placeraTrad();
        if (markeratTrad === i) markeraTrad(trad[i].dolt ? null : i);
        return true;
      },
      /** Döljer (dolt = true) eller visar ett befintligt hus. */
      doljHus(id, dolt) { return doljHus(id, !!dolt); },
      /** Klickar på ett träd som om man klickade i vyn (för testerna): siktar mitt på kronan. */
      klickaTrad(i) {
        const t = trad[i];
        if (!t) return null;
        const q = tillSkarm([t.x + cx, -t.z + cy, t.b + zmin + t.h * 0.7]), b = el.getBoundingClientRect();
        return q ? valjObjekt(b.left + q.x, b.top + q.y) : null;
      },
      /** Klickar på ett hus som om man klickade i vyn (för testerna); zonens koordinater. */
      klickaHus(x, y) {
        const p = tillSkarm([x, y, (markZ(x, y))]), b = el.getBoundingClientRect();
        for (let dz = 0; dz < 30; dz += 1) {
          const q = tillSkarm([x, y, markZ(x, y) + dz]), t = traffA(b.left + q.x, b.top + q.y, husLager ? husLager.children : [], 'hus');
          if (t) { husLyssnare.forEach(f => f(t.id)); return t.id; }
        }
        return p && null;
      },

      // --- modellera volymer (0.10.0)
      /** Modelleringen på eller av; utan argument om den är på. */
      modellera(pa) { return pa == null ? redigera : satRedigera(pa); },
      /** Toppvyn (ortografisk, norr uppåt) på eller av. */
      toppvy(pa) { return pa == null ? toppvy : satToppvy(pa); },
      /**
       * Ny volym ur en mall { typ: 'block'|'cylinder'|'prisma', b, d, diam, hojd, takform, taklutning, vrid }.
       * Utan punkt följer den pekaren tills man klickar; med punkt { x, y } (zonen) placeras den direkt.
       */
      nyVolym(mall, punkt) {
        if (!redigera) satRedigera(true);
        if (punkt) {
          const v = V3.ny(mall, punkt.x, punkt.y, 0, 'ny', 'ny'), g = golvFor(v, new Set());
          v.golv = g.golv; v.primitiv.pa = g.pa;
          placering = { mall }; placeraVolym(v);
          return kopia(v);
        }
        placering = { mall }; valdId = null; senasteSnapp = null; el.style.cursor = 'crosshair';
        ritaSkiss(); bygOverlagg(); meddelaSkiss('placerar');
        return null;
      },
      /** Avbryter en placering, tar bort markeringen eller går ur modelleringen; true om något avbröts (Esc). */
      avbryt(urModell = true) {
        if (placering) { placering = null; taBortSpoke(); el.style.cursor = ''; meddelaSkiss('val'); return true; }
        if (redigera && valdId) { valdId = null; senasteSnapp = null; ritaSkiss(); bygOverlagg(); meddelaSkiss('val'); return true; }
        // utan något valt går Esc ur modelleringen i stället för att stänga vyn
        if (redigera && urModell) { satRedigera(false); return true; }
        return false;
      },
      /** Volymerna i skissen (kopior, i zonens koordinater). */
      volymer() { return volymer.map(kopia); },
      /** Den valda volymen (kopia) eller null; med id väljs den. */
      vald(id) {
        if (id !== undefined) { valdId = id && perId(id) ? id : null; senasteSnapp = null; ritaSkiss(); bygOverlagg(); meddelaSkiss('val'); }
        return valdId && perId(valdId) ? kopia(perId(valdId)) : null;
      },
      /** Ändrar den valda: { namn, hojd, takform, taklutning, b, d, diam, vrid, golv, golvAuto }. */
      andraVald: andraVald,
      taBortVald: taBortVald,
      kopieraVald: kopieraVald,
      /** Avståndet (m) från den senast snäppta sidan till det den snäppte mot. */
      avstand(m) { return m == null ? aktuelltAvstand() : avstand(m); },
      angra, gorOm,
      /** Flyttar volymen (och dess grupp) dx, dy meter som när man drar, med snäpp (för testerna). */
      dra(id, dx, dy, { snappa = true, tol = 0.5 } = {}) {
        if (!perId(id)) return null;
        sparaHistorik(); valdId = id;
        const sn = flyttaGrupp(ogonblick(id), id, dx, dy, { snappa, tol });
        andring();
        return sn ? { typ: sn.typ, mot: sn.mot } : null;
      },
      /** Vrider volymen (och dess grupp) grader kring dess mitt (för testerna). */
      vrida(id, grader) { if (!perId(id)) return; sparaHistorik(); vridGrupp(ogonblick(id), id, grader); andring(); },
      /** Länkar ihop eller löser upp två volymer (kedjeikonen). */
      lanka(a, b) { if (!perId(a) || !perId(b)) return null; sparaHistorik(); const l = V3.vaxlaLank(perId(a), perId(b)); andring(); return l; },
      /** Kedjeikonerna som syns: [{ a, b, lankad }]. */
      kedjor() { return [...overlagg.querySelectorAll('.vy3d-kedja')].map(k => ({ a: k.dataset.a, b: k.dataset.b, lankad: k.classList.contains('lankad') })); },
      /** Riktar kameran mot punkten (x, y) i zonen på avståndet avstand (för testerna och bilderna). */
      tittaPa(x, y, avstand) { mal.set(x - cx, (markZ(x, y) - zmin) * faktor, -(y - cy)); if (avstand > 0) avst = avstand; placera(); placeraTrad(); },
      /** Var en punkt i zonen (x, y, z i RH 2000) hamnar på skärmen (för testerna). */
      skarmpunkt(x, y, z) { const b = el.getBoundingClientRect(), q = tillSkarm([x, y, z]); return { x: b.left + q.x, y: b.top + q.y, syns: q.syns }; },
      /** Anropas med { typ, volymer, vald, … } när skissen eller valet ändras. */
      lyssnaSkiss(fn) { skissLyssnare.push(fn); },
      /** Om skissen har ändrats sedan vyn öppnades. */
      skissAndrad() { return skissAndrad; },
      /** Kameran tillbaka till startläget (även dubbelklick). */
      aterstall() { aterstall(); },
      /** Kamerans läge, för testerna. */
      kameralage() { return { azimut, lutning, avst, mal: [mal.x, mal.y, mal.z], lage, position: kamera.position.toArray() }; },
      /** Flyttar vyn dx, dy pixlar som när man drar (för testerna). */
      panorera(dx, dy) { panorera(dx, dy); placera(); },
      /** Var en skärmpunkt träffar marken i zonens koordinater, eller null (för testerna). */
      traff(sx, sy) { const p = traffMark(sx, sy); return p && { x: p.x + cx, y: -p.z + cy }; },
      stang() {
        aktiv = false;
        if (document.pointerLockElement === el && document.exitPointerLock) document.exitPointerLock();
        window.removeEventListener('resize', storleksandring);
        if (iakttagare) iakttagare.disconnect();
        window.removeEventListener('keydown', tangentNed);
        window.removeEventListener('keyup', tangentUpp);
        window.removeEventListener('keydown', redigeraTangent);
        document.removeEventListener('mousemove', musLas);
        document.removeEventListener('pointerlockchange', lasAndrat);
        renderer.dispose();
        scen.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
        material().concat([djupMat, normalMat, leraMat]).forEach(m => { if (m) { if (m.map) m.map.dispose(); m.dispose(); } });
        yta.innerHTML = '';
      },
    };
  }
  /** version: ska vara samma som i version.js (test/version.test.js kontrollerar). */
  window.Vy3D = { visa, version: '0.11.0' };
}());
