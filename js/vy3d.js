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
    // Träd: gran, tall eller lövträd efter formen, enkla eller detaljerade (0.9.0)
    // ------------------------------------------------------------------
    const Trad3D = window.Trad3D;
    const trad = (data.trad || []).map(t => {
      const v = Trad3D ? Trad3D.variation(t) : { vrid: 0, ljus: 1 };
      return { x: t.x - cx, z: -(t.y - cy), b: (t.zMark != null ? t.zMark : t.mark) - zmin, h: Math.max(1, t.hojd), kr: Math.max(1, t.krona),
        art: Trad3D ? Trad3D.art(t) : 'lov', vrid: v.vrid, ljus: v.ljus };
    });
    const tradMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const NIVAER = ['enkel', 'detaljerad', 'realistisk'];
    const tradMesh = {};   // art → { enkel: [mesh], detaljerad: [mesh], realistisk: [stam, lövverk] }
    let tradniva = NIVAER.includes(data.tradniva) ? data.tradniva : 'enkel', tradskugga = data.tradskuggor !== false;
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
      if (m.uv) tg.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2));
      return tg;
    };
    if (tradLager) {
      for (const art of Trad3D.ARTER) {
        const antal = trad.filter(t => t.art === art).length;
        if (!antal) continue;
        tradMesh[art] = { antal };
        for (const niva of ['enkel', 'detaljerad']) tradMesh[art][niva] = [instanser(geometri(Trad3D.modell(art, niva)), tradMat, antal)];
      }
    }
    /**
     * Lövkorten: dubbelsidiga, men med samma normal på båda sidor (ut från kronan), så att kronan
     * ljussätts som en helhet. three.js vänder normalen på baksidan; här vänds den tillbaka.
     */
    const sammaNormal = mat => {
      mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\n\tnormal *= faceDirection;\n#endif'); };
      mat.customProgramCacheKey = () => 'lovkort';
      return mat;
    };
    let lovTex = null, lovMat = null, lovDjup = null;
    /** Realistiska träd byggs först när de väljs: lövbilden ritas och korten läggs ut (0.9.1). */
    const byggRealistiska = () => {
      if (lovMat || !tradLager || !Trad3D.realistisk) return;
      const c = document.createElement('canvas'), S = mobil ? 256 : 512;
      c.width = 3 * S; c.height = S;
      Trad3D.ritaLovbild(c.getContext('2d'), S);
      lovTex = new THREE.CanvasTexture(c);
      lovTex.colorSpace = THREE.SRGBColorSpace;
      lovTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      lovMat = sammaNormal(new THREE.MeshLambertMaterial({ map: lovTex, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, alphaToCoverage: true }));
      lovDjup = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: lovTex, alphaTest: 0.45, side: THREE.DoubleSide });
      for (const art in tradMesh) {
        const m = Trad3D.realistisk(art), antal = tradMesh[art].antal;
        const stam = instanser(geometri(m.stam), tradMat, antal), lov = instanser(geometri(m.lov), lovMat, antal);
        lov.customDepthMaterial = lovDjup;
        lov.userData.lov = true;
        tradMesh[art].realistisk = [stam, lov];
      }
    };
    // detaljerade eller realistiska träd närmast kameran, enkla längre bort (mobilen orkar färre)
    const MAX_NARA = { detaljerad: mobil ? 600 : 6000, realistisk: mobil ? 400 : 3000 }, NARA_MOBIL = { detaljerad: 250, realistisk: 200 };
    let tradPlats = null;
    const placeraTrad = () => {
      if (!tradLager) return;
      if (tradniva === 'realistisk') byggRealistiska();
      const narNiva = tradniva === 'realistisk' && !lovMat ? 'detaljerad' : tradniva;
      const kp = kamera.position, m = new THREE.Matrix4(), q = new THREE.Quaternion(), ax = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
      const nara = new Set();
      if (narNiva !== 'enkel') {
        const avst = trad.map((t, i) => [Math.hypot(t.x - kp.x, t.z - kp.z), i]).sort((a, b) => a[0] - b[0]);
        for (let n = 0; n < Math.min(MAX_NARA[narNiva], avst.length); n++) { if (mobil && avst[n][0] > NARA_MOBIL[narNiva]) break; nara.add(avst[n][1]); }
      }
      const raknare = {};
      for (const art in tradMesh) raknare[art] = { enkel: 0, detaljerad: 0, realistisk: 0 };
      trad.forEach((t, i) => {
        const niva = nara.has(i) ? narNiva : 'enkel', n = raknare[t.art][niva]++;
        m.compose(new THREE.Vector3(t.x, t.b, t.z), q.setFromAxisAngle(ax, t.vrid), new THREE.Vector3(t.kr, t.h, t.kr));
        for (const im of tradMesh[t.art][niva]) { im.setMatrixAt(n, m); im.setColorAt(n, c.setScalar(t.ljus)); }
      });
      for (const art in tradMesh) for (const niva of NIVAER) for (const im of tradMesh[art][niva] || []) {
        im.count = raknare[art][niva];
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
    if ((data.befintliga && data.befintliga.length) || (data.fotavtryck && data.fotavtryck.length)) {
      const l = nyttLager('byggnader');
      const former = new Map((data.takmodeller || []).map(t => [t.id, t]));
      (data.befintliga || []).forEach(v => {
        const lada = vaggar(v, v.takfot);
        l.add(lada);
        harBefintliga = true;
        const t = former.get(v.id);
        if (!t) return;
        // väggar till takfoten och taket som en yta (i zonens koordinater, RH 2000)
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
    const visaTakformer = pa => {
      takformerPa = !!pa;
      formade.forEach(({ lada, form }) => { lada.visible = !takformerPa; form.visible = takformerPa; });
      skuggaOm();
    };

    // skissade volymer: väggar till takfot och tak efter takform, i skissens färg
    const skissMat = new THREE.MeshLambertMaterial({ color: data.skissfarg || data.volym || '#e85528', side: THREE.DoubleSide, shadowSide: THREE.FrontSide });
    const skiss = (data.volymer || []).length ? nyttLager('skiss') : null;
    (data.volymer || []).forEach(v => {
      const fp = v.fotavtryck;
      const shape = new THREE.Shape(fp.map(p => new THREE.Vector2(p[0] - cx, p[1] - cy)));
      const vagg = new THREE.ExtrudeGeometry(shape, { depth: v.takfot, bevelEnabled: false });
      vagg.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(vagg, skissMat);
      mesh.position.y = v.golv - zmin;
      mesh.castShadow = mesh.receiveShadow = true;
      kontur(mesh);
      skiss.add(mesh);
      if (v.takform && v.takform !== 'platt' && v.taklutning > 0 && typeof Platsanalys !== 'undefined') {
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
        const tg = new THREE.BufferGeometry();
        tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tg.setIndex(ti); tg.computeVertexNormals();
        const tak = new THREE.Mesh(tg, skissMat);
        tak.castShadow = tak.receiveShadow = true;
        kontur(tak, 30);
        skiss.add(tak);
      }
    });

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
    const START = { azimut: -0.6, lutning: 0.65, avst: storlek * 1.4, mal: [0, (zmax - zmin) / 2, 0] };
    let azimut = START.azimut, lutning = START.lutning, avst = START.avst;
    const mal = new THREE.Vector3(...START.mal);
    // läge: 'oversikt' (snurra runt), 'valj' (klicka på marken där du vill stå) eller 'ogon' (gå runt i ögonhöjd)
    let lage = 'oversikt';
    const ogon = { x: 0, z: 0, yaw: 0, pitch: 0 };
    const lyssnare = [];
    const meddela = () => lyssnare.forEach(f => { try { f({ lage, last: document.pointerLockElement === el }); } catch (e) { console.error(e); } });
    const placera = () => {
      if (lage === 'ogon') {
        kamera.position.set(ogon.x, markScen(ogon.x, ogon.z) + OGONHOJD, ogon.z);
        const cp = Math.cos(ogon.pitch);
        kamera.lookAt(ogon.x + Math.sin(ogon.yaw) * cp, kamera.position.y + Math.sin(ogon.pitch), ogon.z + Math.cos(ogon.yaw) * cp);
        return;
      }
      kamera.position.set(mal.x + avst * Math.cos(lutning) * Math.sin(azimut), mal.y + avst * Math.sin(lutning), mal.z + avst * Math.cos(lutning) * Math.cos(azimut));
      kamera.lookAt(mal);
    };
    placera();
    placeraTrad();
    /**
     * Flyttar punkten som kameran tittar på längs marken, som att dra kartan med handen.
     * dx, dy i pixlar; meter per pixel följer avståndet. Punkten hålls inom utsnittet plus en halv bredd.
     */
    const panorera = (dx, dy) => {
      const mpp = 2 * avst * Math.tan(20 * Math.PI / 180) / H();
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
      ray.setFromCamera(new THREE.Vector2((sx - b.left) / b.width * 2 - 1, -((sy - b.top) / b.height) * 2 + 1), kamera);
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

    const pekare = new Map();
    let pinch = null, mitt = null, panLage = false, dragLage = 'snurra', nedVid = null, anvandTouch = false;
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') anvandTouch = true;
      pekare.set(e.pointerId, [e.clientX, e.clientY]); el.setPointerCapture(e.pointerId);
      nedVid = [e.clientX, e.clientY];
      // höger- eller mittenknappen, eller skift/ctrl med vänster, gör det motsatta mot valt läge (Snurra/Flytta)
      const byt = e.pointerType === 'mouse' && (e.button === 1 || e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey);
      panLage = (dragLage === 'flytta') !== byt;
    });
    el.addEventListener('pointermove', e => {
      const f = pekare.get(e.pointerId);
      if (!f) return;
      if (lage === 'ogon') {
        // dra för att titta (pekarlåset sköts av mousemove nedan)
        if (document.pointerLockElement !== el && pekare.size === 1) titta(e.clientX - f[0], e.clientY - f[1]);
        pekare.set(e.pointerId, [e.clientX, e.clientY]);
        return;
      }
      if (pekare.size === 1) {
        if (panLage) panorera(e.clientX - f[0], e.clientY - f[1]);
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
      const klick = nedVid && pekare.size === 1 && Math.hypot(e.clientX - nedVid[0], e.clientY - nedVid[1]) < 6 && e.type === 'pointerup';
      pekare.delete(e.pointerId); if (pekare.size < 2) { pinch = null; mitt = null; } if (!pekare.size) panLage = false;
      if (!klick) return;
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

    const storleksandring = () => { renderer.setSize(W(), H()); kamera.aspect = W() / H(); kamera.updateProjectionMatrix(); };
    window.addEventListener('resize', storleksandring);

    let aktiv = true, forraTid = performance.now(), tradTid = 0;
    const loop = nu => {
      if (!aktiv) return;
      nu = nu || performance.now();
      const dt = Math.min(0.25, (nu - forraTid) / 1000); forraTid = nu;
      if (lage === 'ogon') ga(dt);
      // byt detaljerade och enkla träd när kameran har flyttat sig en bit
      if (tradniva !== 'enkel' && tradPlats && nu - tradTid > 250) {
        const flytt = kamera.position.distanceTo(tradPlats), avstand = Math.max(10, kamera.position.distanceTo(mal));
        if (flytt > Math.min(20, Math.max(2, avstand * 0.05))) { placeraTrad(); tradTid = nu; }
      }
      renderer.render(scen, kamera);
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
        #ifdef LOV
          varying vec2 vUv;
        #endif
        void main() { vec4 p = vec4(position, 1.0);
        #ifdef LOV
          vUv = uv;
        #endif
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
          vec4 mv = modelViewMatrix * p; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float bortre; varying float vD;
        #ifdef LOV
          uniform sampler2D karta; varying vec2 vUv;
        #endif
        void main() {
        #ifdef LOV
          if (texture2D(karta, vUv).a < 0.45) discard;
        #endif
          float v = clamp(vD / bortre, 0.0, 0.99999);
          vec3 e = fract(v * vec3(1.0, 255.0, 65025.0)); e -= e.yzz * vec3(1.0 / 255.0, 1.0 / 255.0, 0.0);
          gl_FragColor = vec4(e, 1.0); }`,
    });
    const normalMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: `varying vec3 vN;
        #ifdef LOV
          varying vec2 vUv;
        #endif
        void main() { vec4 p = vec4(position, 1.0); vec3 n = normal;
        #ifdef LOV
          vUv = uv;
        #endif
        #ifdef USE_INSTANCING
          p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
        #endif
          vN = normalize(normalMatrix * n); gl_Position = projectionMatrix * modelViewMatrix * p; }`,
      fragmentShader: `varying vec3 vN;
        #ifdef LOV
          uniform sampler2D karta; varying vec2 vUv;
        #endif
        void main() {
        #ifdef LOV
          if (texture2D(karta, vUv).a < 0.45) discard;
        #endif
          vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0); gl_FragColor = vec4(n * 0.5 + 0.5, 1.0); }`,
    });
    const leraMat = new THREE.MeshLambertMaterial({ color: '#f4f2ee', side: THREE.DoubleSide, shadowSide: THREE.FrontSide });
    // lövkorten behåller sina hål i lermodellen, djupkartan och normalerna
    const lovVariant = mat => { const m = mat.clone(); m.defines = Object.assign({}, m.defines, { LOV: '' }); m.uniforms = Object.assign({}, m.uniforms, { karta: { value: null } }); return m; };
    const djupLovMat = lovVariant(djupMat), normalLovMat = lovVariant(normalMat);
    let leraLovMat = null;
    /** Byter material på alla ytor under gor(): vanlig för det mesta, lov för lövkorten. */
    const medMaterial = (vanlig, lov, gor) => {
      const byten = [];
      scen.traverse(o => { if (o.isMesh) { byten.push([o, o.material]); o.material = o.userData.lov ? lov : vanlig; } });
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
      const kam = kamera.clone(); kam.aspect = w / h; kam.updateProjectionMatrix();
      const ut = { bredd: w, hojd: h, skala: st.skala };
      ut.farg = await somPng(tillCanvas(Bild3D.vand(rendera(kam, w, h), w, h), w, h));
      if (!ai) return ut;
      // lermodell: allt vitt, utan linjer, med skuggorna som de är
      if (lovTex && !leraLovMat) {
        leraLovMat = sammaNormal(new THREE.MeshLambertMaterial({ color: '#f4f2ee', alphaMap: null, map: lovTex, alphaTest: 0.45, side: THREE.DoubleSide }));
        // bara bildens genomskinlighet, inte färgen
        const forra = leraLovMat.onBeforeCompile;
        leraLovMat.onBeforeCompile = sh => { forra(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb = diffuse;'); };
        leraLovMat.customProgramCacheKey = () => 'lovkort-lera';
      }
      scen.background = new THREE.Color('#ffffff');
      try { ut.lera = await somPng(tillCanvas(Bild3D.vand(medMaterial(leraMat, leraLovMat || leraMat, () => utanLinjer(() => rendera(kam, w, h))), w, h), w, h)); }
      finally { scen.background = bakgrund; }
      // djup och normaler utan kantutjämning, himlen genomskinlig
      const forraKlar = renderer.getClearAlpha(), forraFarg = renderer.getClearColor(new THREE.Color());
      scen.background = null; renderer.setClearColor(0x000000, 0);
      let djupPx, normPx;
      djupMat.uniforms.bortre.value = djupLovMat.uniforms.bortre.value = kam.far;
      djupLovMat.uniforms.karta.value = normalLovMat.uniforms.karta.value = lovTex;
      try {
        utanLinjer(() => {
          djupPx = medMaterial(djupMat, djupLovMat, () => rendera(kam, w, h, { msaa: false, srgb: false }));
          normPx = medMaterial(normalMat, normalLovMat, () => rendera(kam, w, h, { msaa: false, srgb: false }));
        });
      } finally { scen.background = bakgrund; renderer.setClearColor(forraFarg, forraKlar); }
      const d = Bild3D.avkodaDjup(djupPx, w, h, kam.far);
      ut.djup = await somPng(tillCanvas(Bild3D.djupbild(d, w, h), w, h));
      const n = Bild3D.avkodaNormaler(normPx, w, h);
      ut.kanter = await somPng(tillCanvas(Bild3D.kanter(d, n, w, h, { bredd: Math.max(1, Math.round(st.skala)) }), w, h));
      return ut;
    }

    const material = () => [markMat, ortoMat, tradMat, kurvMat, konturMat, befMat, skissMat, takMat, lovMat, lovDjup, leraLovMat, djupLovMat, normalLovMat];
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
      skissfarg(c) { if (!skiss) return null; if (c) skissMat.color.set(c); return '#' + skissMat.color.getHexString(); },
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
        if (pa != null) { tradskugga = !!pa; for (const a in tradMesh) for (const n of NIVAER) for (const im of tradMesh[a][n] || []) im.castShadow = tradskugga; skuggaOm(); }
        return tradskugga;
      },
      /** 'enkel', 'detaljerad' eller 'realistisk' (0.9.1); null om träd saknas. */
      tradniva(n) { if (!tradLager) return null; if (NIVAER.includes(n)) { tradniva = n; placeraTrad(); } return tradniva; },
      /** Hur många träd av varje art och nivå som visas, för testerna. */
      tradantal() { const ut = {}; for (const a in tradMesh) { ut[a] = {}; for (const n of NIVAER) ut[a][n] = tradMesh[a][n] ? tradMesh[a][n][0].count : 0; } return ut; },
      /** Vad det gör att dra med ett finger eller vänster musknapp: 'snurra' eller 'flytta' (0.8.1). */
      dragLage(l) { if (l === 'snurra' || l === 'flytta') dragLage = l; return dragLage; },
      /**
       * Ögonhöjd (0.9.0): första anropet väntar på ett klick på marken, nästa (eller Esc) går tillbaka.
       * Med en punkt { x, y } i zonens koordinater ställer det sig där direkt (för testerna).
       */
      ogonhojd(punkt) {
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
        window.removeEventListener('keydown', tangentNed);
        window.removeEventListener('keyup', tangentUpp);
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
  window.Vy3D = { visa, version: '0.9.1' };
}());
