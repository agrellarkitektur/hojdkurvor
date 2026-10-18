/*
 * 3D-förhandsvisning av utsnittet: terrängen, träden och skissade volymer.
 * three.js (vendor/three/three.module.min.js) laddas först när vyn öppnas.
 * Egen enkel styrning: dra för att snurra, scrolla eller nyp för att zooma.
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
    const terrang = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    grupp.add(terrang);

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
      grupp.add(krona, stam);
    }

    // skissade volymer: väggar till takfot och tak efter takform
    (data.volymer || []).forEach(v => {
      const fp = v.fotavtryck;
      const shape = new THREE.Shape(fp.map(p => new THREE.Vector2(p[0] - cx, p[1] - cy)));
      const vagg = new THREE.ExtrudeGeometry(shape, { depth: v.takfot, bevelEnabled: false });
      vagg.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(vagg, new THREE.MeshLambertMaterial({ color: '#ffffff' }));
      mesh.position.y = v.golv - zmin;
      grupp.add(mesh);
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
        grupp.add(new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ color: data.volym || '#e85528', side: THREE.DoubleSide })));
      } else {
        const tak = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ color: data.volym || '#e85528', side: THREE.DoubleSide }));
        tak.rotateX(-Math.PI / 2); tak.position.y = v.golv + v.takfot - zmin + 0.02;
        grupp.add(tak);
      }
    });

    scen.add(new THREE.HemisphereLight('#ffffff', '#8a8070', 1.6));
    const sol = new THREE.DirectionalLight('#ffffff', 1.6);
    sol.position.set(-200, 300, 150);
    scen.add(sol);

    // kamera och styrning
    const storlek = Math.max(r.xmax - r.xmin, r.ymax - r.ymin);
    const kamera = new THREE.PerspectiveCamera(40, W() / H(), 0.5, storlek * 20);
    let azimut = -0.6, lutning = 0.65, avst = storlek * 1.4;
    const mal = new THREE.Vector3(0, (zmax - zmin) / 2, 0);
    const placera = () => {
      kamera.position.set(mal.x + avst * Math.cos(lutning) * Math.sin(azimut), mal.y + avst * Math.sin(lutning), mal.z + avst * Math.cos(lutning) * Math.cos(azimut));
      kamera.lookAt(mal);
    };
    placera();
    const pekare = new Map();
    let pinch = null;
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', e => { pekare.set(e.pointerId, [e.clientX, e.clientY]); el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      const f = pekare.get(e.pointerId);
      if (!f) return;
      if (pekare.size === 1) {
        azimut -= (e.clientX - f[0]) * 0.008;
        lutning = Math.max(0.08, Math.min(1.5, lutning + (e.clientY - f[1]) * 0.006));
      }
      pekare.set(e.pointerId, [e.clientX, e.clientY]);
      if (pekare.size === 2) {
        const [a, b] = [...pekare.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch) avst = Math.max(storlek * 0.2, Math.min(storlek * 8, avst * pinch / d));
        pinch = d;
      }
      placera();
    });
    const slapp = e => { pekare.delete(e.pointerId); if (pekare.size < 2) pinch = null; };
    el.addEventListener('pointerup', slapp); el.addEventListener('pointercancel', slapp);
    el.addEventListener('wheel', e => { e.preventDefault(); avst = Math.max(storlek * 0.2, Math.min(storlek * 8, avst * Math.exp(e.deltaY * 0.001))); placera(); }, { passive: false });
    const storleksandring = () => { renderer.setSize(W(), H()); kamera.aspect = W() / H(); kamera.updateProjectionMatrix(); };
    window.addEventListener('resize', storleksandring);

    let aktiv = true;
    const loop = () => { if (!aktiv) return; renderer.render(scen, kamera); requestAnimationFrame(loop); };
    loop();
    return {
      overdriv(f) { if (f == null) return faktor; faktor = f; grupp.scale.set(1, f, 1); return faktor; },
      stang() {
        aktiv = false;
        window.removeEventListener('resize', storleksandring);
        renderer.dispose();
        scen.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        yta.innerHTML = '';
      },
    };
  }
  window.Vy3D = { visa };
}());
