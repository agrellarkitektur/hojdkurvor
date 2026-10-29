/*
 * Bilder ur 3D-vyn (0.9.0): räknar fram kantlinjer och djupkarta ur de pixlar 3D-vyn läser
 * tillbaka från grafikkortet. Ren beräkning utan three.js, så att den kan testas i Node.
 *
 * Djupet kommer kodat i RGB (24 bitar, avstånd / bortre gränsen), normalerna som n · 0,5 + 0,5.
 * Raderna kommer nerifrån och upp (WebGL), utdata är uppifrån och ner som en vanlig bild.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Bild3D = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** RGBA nerifrån och upp → RGBA uppifrån och ner. */
  function vand(px, W, H) {
    const ut = new Uint8ClampedArray(W * H * 4), rad = W * 4;
    for (let j = 0; j < H; j++) ut.set(px.subarray((H - 1 - j) * rad, (H - j) * rad), j * rad);
    return ut;
  }

  /** Avstånd i meter per pixel ur kodat djup (nerifrån och upp in, uppifrån och ner ut). 0 = himmel. */
  function avkodaDjup(px, W, H, bortre) {
    const d = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const q = ((H - 1 - j) * W + i) * 4;
      if (px[q + 3] === 0) continue;
      const v = px[q] / 255 + px[q + 1] / 65025 + px[q + 2] / 16581375;
      d[j * W + i] = v * bortre;
    }
    return d;
  }

  /** Normaler (−1–1) per pixel, uppifrån och ner. Himmel får längden 0. */
  function avkodaNormaler(px, W, H) {
    const n = new Float32Array(W * H * 3);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const q = ((H - 1 - j) * W + i) * 4, o = (j * W + i) * 3;
      if (px[q + 3] === 0) continue;
      n[o] = px[q] / 127.5 - 1; n[o + 1] = px[q + 1] / 127.5 - 1; n[o + 2] = px[q + 2] / 127.5 - 1;
    }
    return n;
  }

  /**
   * Djupkarta som gråskala (RGBA): nära är ljust, långt bort mörkt, himlen svart.
   * Skalan går på 1/avstånd (som MiDaS och ControlNet), mellan 1:a och 99:e percentilen.
   */
  function djupbild(d, W, H) {
    const giltiga = [];
    const steg = Math.max(1, Math.floor(d.length / 200000));
    for (let i = 0; i < d.length; i += steg) if (d[i] > 0) giltiga.push(1 / d[i]);
    const ut = new Uint8ClampedArray(W * H * 4);
    if (!giltiga.length) { for (let i = 3; i < ut.length; i += 4) ut[i] = 255; return ut; }
    giltiga.sort((a, b) => a - b);
    const lag = giltiga[Math.floor(giltiga.length * 0.01)], hog = giltiga[Math.min(giltiga.length - 1, Math.floor(giltiga.length * 0.99))];
    const sp = hog > lag ? hog - lag : 1;
    for (let i = 0; i < d.length; i++) {
      const v = d[i] > 0 ? Math.round(255 * Math.max(0, Math.min(1, (1 / d[i] - lag) / sp))) : 0;
      ut[i * 4] = ut[i * 4 + 1] = ut[i * 4 + 2] = d[i] > 0 ? Math.max(8, v) : 0; ut[i * 4 + 3] = 255;
    }
    return ut;
  }

  /**
   * Kantlinjer (RGBA, svart på vitt) där djupet hoppar eller ytan byter riktning.
   * bredd: linjens bredd i pixlar (följer bildens skala). vinkel: grader mellan ytor som ger kant.
   */
  function kanter(d, n, W, H, { bredd = 1, vinkel = 35, hopp = 0.04 } = {}) {
    const kant = new Uint8Array(W * H), cos = Math.cos(vinkel * Math.PI / 180);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const c = j * W + i, dc = d[c];
      for (const [a, b] of [[1, 0], [0, 1]]) {
        const ii = i + a, jj = j + b;
        if (ii >= W || jj >= H) continue;
        const o = jj * W + ii, dov = d[o];
        let ar = false;
        if ((dc > 0) !== (dov > 0)) ar = true;   // mot himlen
        else if (dc > 0) {
          if (Math.abs(dc - dov) > hopp * Math.min(dc, dov)) ar = true;
          else {
            const p = c * 3, q = o * 3;
            const dot = n[p] * n[q] + n[p + 1] * n[q + 1] + n[p + 2] * n[q + 2];
            if (dot < cos) ar = true;
          }
        }
        if (ar) { kant[dc > 0 && (dov <= 0 || dc <= dov) ? c : o] = 1; }
      }
    }
    // bredda linjen
    let k = kant;
    const r = Math.max(0, Math.round(bredd) - 1);
    if (r > 0) {
      const tmp = new Uint8Array(W * H); k = new Uint8Array(W * H);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        if (!kant[j * W + i]) continue;
        for (let a = -r; a <= r; a++) { const ii = i + a; if (ii >= 0 && ii < W) tmp[j * W + ii] = 1; }
      }
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        if (!tmp[j * W + i]) continue;
        for (let b = -r; b <= r; b++) { const jj = j + b; if (jj >= 0 && jj < H) k[jj * W + i] = 1; }
      }
    }
    const ut = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) { const v = k[i] ? 0 : 255; ut[i * 4] = ut[i * 4 + 1] = ut[i * 4 + 2] = v; ut[i * 4 + 3] = 255; }
    return ut;
  }

  /** Storlek på exporten: skala gånger skärmen, inom gränserna för sida och antal pixlar. */
  function storlek(bredd, hojd, skala, { maxSida = 8192, maxPx = 40e6 } = {}) {
    let f = skala;
    f = Math.min(f, maxSida / bredd, maxSida / hojd, Math.sqrt(maxPx / (bredd * hojd)));
    return { bredd: Math.max(1, Math.floor(bredd * f)), hojd: Math.max(1, Math.floor(hojd * f)), skala: f };
  }

  return { vand, avkodaDjup, avkodaNormaler, djupbild, kanter, storlek };
}));
