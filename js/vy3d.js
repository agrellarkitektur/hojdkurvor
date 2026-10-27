/*
 * 3D-förhandsvisning av utsnittet: terrängen (med ortofoto om det finns), höjdkurvor, träd, befintliga byggnader,
 * fastighetsgränser, vägar och skissade volymer. Varje lager kan slås av och på (0.7.0).
 * three.js (vendor/three/three.module.min.js) laddas först när vyn öppnas.
 * Egen enkel styrning: dra för att snurra, scrolla eller nyp för att zooma, högerdra, skift-dra eller
 * dra med två fingrar för att flytta (0.8.0). Läget Flytta gör vanlig dragning till flyttning (0.8.1).
 * Dubbelklick återställer vyn.
 */
(function () {
  'use strict';
  let THREEP = null;
  const skriptUrl = document.currentScript ? document.currentScript.src : location.href;

  async function visa(yta, data) {
    const THREE = await (THREEP = THREEP || import(new URL('../vendor/three/three.module.min.js', skriptUrl).href));
    yta.innerHTML = '';
    const W = () => yta.clientWidth || 800, H = () => yta.clientHeight || 600;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W(), H());
    yta.append(renderer.domElement);
    const scen = new THREE.Scene();
    scen.background = new THREE.Color(data.bakgrund || '#f0eee9');
    const g = data.rutnat, r = data.utsnitt;
    const cx = (r.xmin + r.xmax) / 2, cy = (r.ymin + r.ymax) / 2;
    // höjdnivå: lägsta punkten i utsnittet
    let zmin = Infinity, zmax = -Infinity;
    for (const v of g.z) if (v === v) { if (v < zmin) zmin = v; if (v > zmax) zmax = v; }
    let faktor = 1;
    const grupp = new THREE.Group();
    scen.add(grupp);
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
    const markMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const terrang = new THREE.Mesh(geo, markMat);
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
      ortoMat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
      terrang.material = ortoMat;
    }

    // utsnittets ram
    const ramPts = [[r.xmin, r.ymin], [r.xmax, r.ymin], [r.xmax, r.ymax], [r.xmin, r.ymax], [r.xmin, r.ymin]].map(([x, y]) => {
      const i = Math.round((x - g.x0) / g.s), j = Math.round((g.y1 - y) / g.s), z = g.z[Math.min(g.H - 1, Math.max(0, j)) * g.W + Math.min(g.W - 1, Math.max(0, i))];
      return new THREE.Vector3(x - cx, (z === z ? z : zmin) - zmin + 0.2, -(y - cy));
    });
    grupp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ramPts), new THREE.LineBasicMaterial({ color: data.ram || '#1d4f8c' })));

    // träd: stam och krona som klot
    if (data.trad && data.trad.length) {
      const krona = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshLambertMaterial({ color: '#5f8f52' }), data.trad.length);
      const stam = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, 1, 6), new THREE.MeshLambertMaterial({ color: '#6b5a48' }), data.trad.length);
      const m = new THREE.Matrix4();
      data.trad.forEach((t, i) => {
        const b = (t.zMark != null ? t.zMark : t.mark) - zmin, kr = Math.max(1, t.krona), h = t.hojd;
        m.compose(new THREE.Vector3(t.x - cx, b + h - kr * 0.55, -(t.y - cy)), new THREE.Quaternion(), new THREE.Vector3(kr, Math.min(h, kr * 1.2), kr));
        krona.setMatrixAt(i, m);
        m.compose(new THREE.Vector3(t.x - cx, b + (h - kr * 0.6) / 2, -(t.y - cy)), new THREE.Quaternion(), new THREE.Vector3(1, Math.max(0.5, h - kr * 0.6), 1));
        stam.setMatrixAt(i, m);
      });
      nyttLager('trad').add(krona, stam);
    }

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
    if (data.fastigheter && data.fastigheter.length) nyttLager('fastigheter').add(draperade(data.fastigheter, data.fastighet || '#b0306a', 0.25));
    if (data.vagar && data.vagar.length) nyttLager('vagar').add(draperade(data.vagar, data.vag || '#6b6258', 0.15));

    // befintliga byggnader: lådor till höjden ur laserdatan, fotavtryck på marken för dem utan höjd
    if ((data.befintliga && data.befintliga.length) || (data.fotavtryck && data.fotavtryck.length)) {
      const l = nyttLager('byggnader');
      const mat = new THREE.MeshLambertMaterial({ color: data.befintlig || '#b9b3aa' });
      (data.befintliga || []).forEach(v => {
        const shape = new THREE.Shape(v.fotavtryck.map(p => new THREE.Vector2(p[0] - cx, p[1] - cy)));
        const g = new THREE.ExtrudeGeometry(shape, { depth: v.takfot, bevelEnabled: false });
        g.rotateX(-Math.PI / 2);
        const mesh = new THREE.Mesh(g, mat);
        mesh.position.y = v.golv - zmin;
        l.add(mesh);
      });
      if (data.fotavtryck && data.fotavtryck.length) l.add(draperade(data.fotavtryck.map(f => f.concat([f[0]])), data.byggnad || '#5b4636', 0.3));
    }

    // skissade volymer: väggar till takfot och tak efter takform
    const skiss = (data.volymer || []).length ? nyttLager('skiss') : null;
    (data.volymer || []).forEach(v => {
      const fp = v.fotavtryck;
      const shape = new THREE.Shape(fp.map(p => new THREE.Vector2(p[0] - cx, p[1] - cy)));
      const vagg = new THREE.ExtrudeGeometry(shape, { depth: v.takfot, bevelEnabled: false });
      vagg.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(vagg, new THREE.MeshLambertMaterial({ color: '#ffffff' }));
      mesh.position.y = v.golv - zmin;
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
        skiss.add(new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ color: data.volym || '#e85528', side: THREE.DoubleSide })));
      } else {
        const tak = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ color: data.volym || '#e85528', side: THREE.DoubleSide }));
        tak.rotateX(-Math.PI / 2); tak.position.y = v.golv + v.takfot - zmin + 0.02;
        skiss.add(tak);
      }
    });

    scen.add(new THREE.HemisphereLight('#ffffff', '#8a8070', 1.6));
    const sol = new THREE.DirectionalLight('#ffffff', 1.6);
    sol.position.set(-200, 300, 150);
    scen.add(sol);

    // kamera och styrning
    const storlek = Math.max(r.xmax - r.xmin, r.ymax - r.ymin);
    const kamera = new THREE.PerspectiveCamera(40, W() / H(), 0.5, storlek * 20);
    const START = { azimut: -0.6, lutning: 0.65, avst: storlek * 1.4, mal: [0, (zmax - zmin) / 2, 0] };
    let azimut = START.azimut, lutning = START.lutning, avst = START.avst;
    const mal = new THREE.Vector3(...START.mal);
    const placera = () => {
      kamera.position.set(mal.x + avst * Math.cos(lutning) * Math.sin(azimut), mal.y + avst * Math.sin(lutning), mal.z + avst * Math.cos(lutning) * Math.cos(azimut));
      kamera.lookAt(mal);
    };
    placera();
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
    const pekare = new Map();
    let pinch = null, mitt = null, panLage = false, dragLage = 'snurra';
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      pekare.set(e.pointerId, [e.clientX, e.clientY]); el.setPointerCapture(e.pointerId);
      // höger- eller mittenknappen, eller skift/ctrl med vänster, gör det motsatta mot valt läge (Snurra/Flytta)
      const byt = e.pointerType === 'mouse' && (e.button === 1 || e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey);
      panLage = (dragLage === 'flytta') !== byt;
    });
    el.addEventListener('pointermove', e => {
      const f = pekare.get(e.pointerId);
      if (!f) return;
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
    const slapp = e => { pekare.delete(e.pointerId); if (pekare.size < 2) { pinch = null; mitt = null; } if (!pekare.size) panLage = false; };
    el.addEventListener('pointerup', slapp); el.addEventListener('pointercancel', slapp);
    el.addEventListener('wheel', e => { e.preventDefault(); avst = Math.max(storlek * 0.05, Math.min(storlek * 8, avst * Math.exp(e.deltaY * 0.001))); placera(); }, { passive: false });
    el.addEventListener('dblclick', () => aterstall());
    const aterstall = () => { azimut = START.azimut; lutning = START.lutning; avst = START.avst; mal.set(...START.mal); placera(); };
    const storleksandring = () => { renderer.setSize(W(), H()); kamera.aspect = W() / H(); kamera.updateProjectionMatrix(); };
    window.addEventListener('resize', storleksandring);

    let aktiv = true;
    const loop = () => { if (!aktiv) return; renderer.render(scen, kamera); requestAnimationFrame(loop); };
    loop();
    return {
      /** Ortofotot på eller av; null om det saknas. */
      ortofoto(pa) { if (!ortoMat) return null; if (pa != null) terrang.material = pa ? ortoMat : markMat; return terrang.material === ortoMat; },
      /** Lagren som finns i vyn och om de syns: { kurvor: true, … }. */
      lager() { const ut = {}; for (const n in lager) ut[n] = lager[n].visible; return ut; },
      /** Slår ett lager av eller på; returnerar om det syns, eller null om det saknas. */
      visaLager(namn, pa) { const l = lager[namn]; if (!l) return null; if (pa != null) l.visible = !!pa; return l.visible; },
      overdriv(f) { if (f == null) return faktor; mal.y = mal.y / faktor * f; faktor = f; grupp.scale.set(1, f, 1); placera(); return faktor; },
      /** Höjdkurvornas färg (#rrggbb); utan argument den nuvarande. null om kurvor saknas. */
      kurvfarg(c) { if (!kurvMat) return null; if (c) kurvMat.color.set(c); return '#' + kurvMat.color.getHexString(); },
      /** Vad det gör att dra med ett finger eller vänster musknapp: 'snurra' eller 'flytta' (0.8.1). */
      dragLage(l) { if (l === 'snurra' || l === 'flytta') dragLage = l; return dragLage; },
      /** Kameran tillbaka till startläget (även dubbelklick). */
      aterstall() { aterstall(); },
      /** Kamerans läge, för testerna. */
      kameralage() { return { azimut, lutning, avst, mal: [mal.x, mal.y, mal.z] }; },
      /** Flyttar vyn dx, dy pixlar som när man drar (för testerna). */
      panorera(dx, dy) { panorera(dx, dy); placera(); },
      stang() {
        aktiv = false;
        window.removeEventListener('resize', storleksandring);
        renderer.dispose();
        scen.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
        [markMat, ortoMat].forEach(m => { if (m) { if (m.map) m.map.dispose(); m.dispose(); } });
        yta.innerHTML = '';
      },
    };
  }
  /** version: ska vara samma som i version.js (test/version.test.js kontrollerar). */
  window.Vy3D = { visa, version: '0.8.1' };
}());
