// =============================================================================
//  Offices: half-disc rooms with a flat back wall, a curved glass front and a
//  door facing the fountain. Furniture, live screens and holograms.
// =============================================================================
const WALL_H = 3.0, GLASS_H = 2.7, DOOR_HALF = 0.82;
const rooms = [];      // index = slot (0 = lobby, 1..7 = CEO..CHRO)
const screens = [];    // live canvas screens: { tex, draw, fps, acc }
const holoTime = { value: 0 };
onFrame((dt, t) => { holoTime.value = REDUCED ? t * 0.2 : t; });

function liveScreen(w, h, fps, draw) {
  const tex = canvasTex(w, h, () => {});
  const s = { tex, draw, fps, acc: 1e9, t: 0 };
  screens.push(s);
  draw(tex.userData.ctx, w, h, 0);
  tex.needsUpdate = true;
  return tex;
}
onFrame((dt, t) => {
  for (const s of screens) {
    s.acc += dt;
    const step = REDUCED ? 1 / Math.min(s.fps, 1) : 1 / s.fps;
    if (s.acc >= step) {
      s.acc = 0;
      const c = s.tex.userData.canvas;
      s.draw(s.tex.userData.ctx, c.width, c.height, t);
      s.tex.needsUpdate = true;
    }
  }
});

function screenMat(tex, bright = 0.95) {
  return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(bright, bright, bright) });
}

function holoMat(color, opacity = 0.7, scan = 1) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: holoTime, uOp: { value: opacity }, uScan: { value: scan } },
    vertexShader: `varying vec3 vW; varying vec3 vN; varying vec3 vV;
      void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uTime, uOp, uScan; varying vec3 vW; varying vec3 vN; varying vec3 vV;
      void main(){ float s = 0.72 + 0.28 * sin(vW.y * 90. - uTime * 6.) * uScan;
        float f = 0.55 + 0.9 * pow(1. - abs(dot(normalize(vN), vV)), 1.6);
        float fl = 0.92 + 0.08 * sin(uTime * 37.) * sin(uTime * 11.);
        vec3 c = uColor * 1.25 * s * f * fl * uOp; gl_FragColor = vec4(c, 1.); }`,
  });
}
function holoLine(color, opacity = 0.8) {
  return new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.8 * opacity), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
}

// ---------------------------------------------------------- textures ------
function floorTexture(kind, color) {
  return canvasTex(512, 512, (g, w, h) => {
    const c = new THREE.Color(color);
    const hex = (k, m = 1) => `rgb(${(c.r * 255 * k * 0.55 + 22 * m) | 0},${(c.g * 255 * k * 0.55 + 24 * m) | 0},${(c.b * 255 * k * 0.55 + 32 * m) | 0})`;
    if (kind === 'wood') {
      g.fillStyle = '#2a1a14'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 32) {
        for (let x = (y / 32) % 2 ? -64 : 0; x < w; x += 128) {
          const l = 34 + Math.random() * 14;
          g.fillStyle = `rgb(${l + 18},${l * 0.62 | 0},${l * 0.45 | 0})`;
          g.fillRect(x + 1, y + 1, 126, 30);
          g.strokeStyle = 'rgba(0,0,0,.18)';
          for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x, y + 6 + k * 7 + Math.random() * 3); g.bezierCurveTo(x + 40, y + 4 + k * 7, x + 80, y + 10 + k * 7, x + 128, y + 6 + k * 7); g.stroke(); }
        }
      }
    } else if (kind === 'tile') {
      g.fillStyle = '#0b1210'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(80,255,170,.13)'; g.lineWidth = 2;
      for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
      g.fillStyle = 'rgba(80,255,170,.05)';
      for (let i = 0; i < 18; i++) g.fillRect((Math.random() * 8 | 0) * 64 + 4, (Math.random() * 8 | 0) * 64 + 4, 56, 56);
      g.fillStyle = 'rgba(255,255,255,.04)';
      for (let i = 0; i < 64; i++) { g.beginPath(); g.arc((i % 8) * 64 + 32, (i / 8 | 0) * 64 + 32, 2, 0, TAU); g.fill(); }
    } else if (kind === 'marble') {
      g.fillStyle = color === LOBBY_COLOR ? '#6a7184' : '#262a34'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        g.strokeStyle = color === LOBBY_COLOR ? `rgba(220,226,240,${0.08 + Math.random() * 0.2})` : `rgba(255,215,120,${0.05 + Math.random() * 0.14})`; g.lineWidth = 0.5 + Math.random() * 2;
        g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += rr(-60, 60); y += rr(-60, 60); g.lineTo(x, y); } g.stroke();
      }
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); }
    } else if (kind === 'concrete') {
      g.fillStyle = '#2a2f3a'; g.fillRect(0, 0, w, h);
      const id = g.getImageData(0, 0, w, h);
      for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 18; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
      g.putImageData(id, 0, 0);
      g.strokeStyle = 'rgba(255,210,58,.5)'; g.lineWidth = 10; g.setLineDash([24, 18]);
      g.beginPath(); g.moveTo(0, 360); g.lineTo(w, 360); g.stroke(); g.setLineDash([]);
    } else {
      // carpet
      g.fillStyle = hex(0.22, 1); g.fillRect(0, 0, w, h);
      const id = g.getImageData(0, 0, w, h);
      for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 14; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
      g.putImageData(id, 0, 0);
      g.strokeStyle = hex(0.34, 1.4); g.lineWidth = 1;
      for (let i = 0; i < w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); }
    }
  }, { repeat: true });
}

// ---------------------------------------------------------- furniture -----
const M = {
  darkWood: std(0x3a241a, 0.45, 0.05), wood: std(0x7a5236, 0.5, 0.05), lightWood: std(0xc49a6c, 0.55, 0.0),
  black: std(0x14161e, 0.4, 0.4), graphite: std(0x232838, 0.45, 0.5), steel: std(0x8b95a8, 0.25, 0.85),
  white: std(0xbfc6d4, 0.5, 0.05), gold: std(0xe8b860, 0.22, 0.95), glassDark: std(0x0b0f18, 0.08, 0.7),
  leaf: std(0x2e9a58, 0.6, 0.0), leafDark: std(0x1d6b3e, 0.65, 0.0), pot: std(0xe9e4dc, 0.6, 0.0), potDark: std(0x2a2f3c, 0.5, 0.2),
  soil: std(0x2a1d14, 1, 0), paper: std(0xf3efe6, 0.8, 0),
};

function desk(parent, x, z, w, d, rot = 0, style = 'exec', accent = '#fff') {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g);
  const H = 0.76;
  if (style === 'exec') {
    rbox(w, 0.07, d, 0.02, M.darkWood, 0, H, 0, g);
    rbox(w - 0.1, H - 0.05, 0.06, 0.02, M.darkWood, 0, H / 2, d / 2 - 0.1, g);
    rbox(0.08, H - 0.05, d - 0.1, 0.02, M.darkWood, -w / 2 + 0.08, H / 2, 0, g);
    rbox(0.08, H - 0.05, d - 0.1, 0.02, M.darkWood, w / 2 - 0.08, H / 2, 0, g);
    box(w, 0.012, 0.012, M.gold, 0, H + 0.03, d / 2, g);
    box(w - 0.12, 0.015, 0.02, neon(accent, 1.6), 0, 0.06, d / 2 - 0.06, g);
  } else if (style === 'tech') {
    rbox(w, 0.05, d, 0.015, M.black, 0, H, 0, g);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(0.05, H, 0.05, M.graphite, sx * (w / 2 - 0.08), H / 2, sz * (d / 2 - 0.08), g));
    box(w, 0.012, 0.012, neon(accent, 2.2), 0, H - 0.03, d / 2, g);
    box(w, 0.012, 0.012, neon(accent, 2.2), 0, H - 0.03, -d / 2, g);
  } else {
    rbox(w, 0.05, d, 0.02, M.white, 0, H, 0, g);
    [[-1], [1]].forEach(([sx]) => { box(0.04, H, d * 0.8, M.steel, sx * (w / 2 - 0.1), H / 2, 0, g); });
    box(w, 0.01, 0.01, neon(accent, 1.4), 0, H - 0.03, d / 2, g);
  }
  return g;
}
function chair(parent, x, z, rot = 0, color = 0x262b3a, exec = false) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g);
  const m = std(color, 0.55, 0.1);
  rbox(0.5, 0.09, 0.48, 0.04, m, 0, 0.46, 0, g);
  rbox(0.48, exec ? 0.72 : 0.5, 0.08, 0.04, m, 0, exec ? 0.86 : 0.76, -0.22, g).rotation.x = -0.1;
  cyl(0.03, 0.03, 0.36, M.steel, 0, 0.26, 0, g, 8);
  for (let i = 0; i < 5; i++) { const leg = box(0.03, 0.03, 0.28, M.graphite, 0, 0.06, 0, g); leg.rotation.y = i * TAU / 5; leg.translateZ(0.14); }
  if (exec) [-1, 1].forEach(s => rbox(0.05, 0.05, 0.34, 0.02, m, s * 0.27, 0.62, -0.02, g));
  return g;
}
function sofa(parent, x, z, len, rot, color) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g);
  const m = std(color, 0.85, 0.0), m2 = std(new THREE.Color(color).multiplyScalar(0.8).getHex(), 0.85, 0);
  rbox(len, 0.3, 0.8, 0.08, m2, 0, 0.22, 0, g);
  rbox(len, 0.55, 0.22, 0.09, m, 0, 0.52, -0.32, g);
  [-1, 1].forEach(s => rbox(0.2, 0.42, 0.8, 0.08, m, s * (len / 2 - 0.1), 0.38, 0, g));
  const n = Math.max(1, Math.round((len - 0.4) / 0.62));
  for (let i = 0; i < n; i++) rbox((len - 0.42) / n - 0.03, 0.14, 0.6, 0.06, m, -len / 2 + 0.21 + ((len - 0.42) / n) * (i + 0.5), 0.43, 0.06, g);
  box(len - 0.1, 0.05, 0.6, M.black, 0, 0.03, 0, g);
  return g;
}
function plant(parent, x, z, kind = 'monstera', s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); parent.add(g);
  const potH = kind === 'small' ? 0.28 : 0.45;
  cyl(0.24, 0.18, potH, kind === 'snake' ? M.potDark : M.pot, 0, potH / 2, 0, g, 20);
  cyl(0.22, 0.22, 0.02, M.soil, 0, potH - 0.01, 0, g, 16);
  if (kind === 'snake') {
    for (let i = 0; i < 9; i++) {
      const b = mesh(new THREE.ConeGeometry(0.05, rr(0.7, 1.15), 4), i % 2 ? M.leaf : M.leafDark, rr(-0.1, 0.1), potH + 0.4, rr(-0.1, 0.1), g);
      b.scale.z = 0.3; b.rotation.set(rr(-0.2, 0.2), rand() * 3, rr(-0.2, 0.2));
    }
  } else if (kind === 'small') {
    for (let i = 0; i < 6; i++) { const l = sph(0.14, i % 2 ? M.leaf : M.leafDark, rr(-0.1, 0.1), potH + rr(0.06, 0.2), rr(-0.1, 0.1), g, 10, 8); l.scale.y = 0.7; }
  } else if (kind === 'tree') {
    cyl(0.03, 0.04, 1.3, M.wood, 0, potH + 0.6, 0, g, 6);
    for (let i = 0; i < 9; i++) { const l = sph(rr(0.2, 0.32), i % 3 ? M.leaf : M.leafDark, rr(-0.32, 0.32), potH + rr(1.1, 1.65), rr(-0.32, 0.32), g, 12, 8); l.scale.y = 0.8; }
  } else {
    for (let i = 0; i < 8; i++) {
      const st = new THREE.Group(); st.position.y = potH; st.rotation.set(rr(0.25, 0.85), i * TAU / 8 + rr(-0.2, 0.2), 0); g.add(st);
      cyl(0.008, 0.01, 0.55, M.leafDark, 0, 0.27, 0, st, 4);
      const leaf = sph(0.2, i % 2 ? M.leaf : M.leafDark, 0, 0.58, 0.06, st, 12, 8); leaf.scale.set(1, 0.18, 1.3); leaf.rotation.x = 0.6;
    }
  }
  return g;
}
function books(parent, x, y, z, w, depth = 0.22, maxH = 0.32) {
  const cols = [0xd94a5a, 0x3b6fd9, 0xe8b860, 0x2fa874, 0xeeeeee, 0x8a5cf0, 0x2a2f3c, 0xff8a2b];
  let cx = -w / 2;
  while (cx < w / 2 - 0.05) {
    const bw = rr(0.03, 0.07), bh = rr(0.6, 1) * maxH;
    if (rand() < 0.12) { cx += 0.12; continue; }
    box(bw, bh, depth * rr(0.8, 1), std(pick(cols), 0.7, 0), x + cx + bw / 2, y + bh / 2, z, parent);
    cx += bw + 0.005;
  }
}
function shelf(parent, x, z, w, h, rot = 0, fill = 'books') {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g);
  const m = M.graphite;
  [-1, 1].forEach(s => box(0.04, h, 0.38, m, s * w / 2, h / 2, 0, g));
  box(w, 0.04, 0.38, m, 0, h, 0, g);
  box(w, h, 0.02, M.black, 0, h / 2, -0.18, g);
  const rows = Math.round(h / 0.45);
  for (let i = 0; i < rows; i++) {
    const y = 0.05 + i * (h / rows);
    box(w, 0.025, 0.36, m, 0, y, 0, g);
    box(w - 0.06, 0.01, 0.01, neon('#ffe9c8', 1.1), 0, y + h / rows - 0.04, 0.16, g);
    if (fill === 'books') books(g, 0, y + 0.015, 0, w - 0.1);
    else if (fill === 'boxes') {
      for (let k = 0; k < 3; k++) {
        const bw = (w - 0.2) / 3;
        rbox(bw - 0.04, 0.3, 0.3, 0.02, std(pick([0xc8a070, 0xb68d5c, 0xd8b483]), 0.85, 0), -w / 2 + 0.1 + bw * (k + 0.5), y + 0.17, 0, g);
        box(bw * 0.4, 0.06, 0.005, M.paper, -w / 2 + 0.1 + bw * (k + 0.5), y + 0.2, 0.152, g);
      }
    }
  }
  return g;
}
function wallScreen(parent, x, y, z, w, h, tex, bezel = M.black, bright = 1.2) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  rbox(w + 0.08, h + 0.08, 0.06, 0.02, bezel, 0, 0, 0, g);
  const s = mesh(new THREE.PlaneGeometry(w, h), screenMat(tex, bright), 0, 0, 0.032, g);
  return { group: g, screen: s };
}
function monitor(parent, x, z, rot, w, h, tex, deskH = 0.79, uvRect = null) {
  const g = new THREE.Group(); g.position.set(x, deskH, z); g.rotation.y = rot; parent.add(g);
  box(0.18, 0.012, 0.12, M.graphite, 0, 0.006, 0, g);
  box(0.03, 0.22, 0.02, M.graphite, 0, 0.12, -0.02, g);
  rbox(w + 0.03, h + 0.03, 0.025, 0.01, M.black, 0, 0.22 + h / 2, 0, g);
  const pg = new THREE.PlaneGeometry(w, h);
  if (uvRect) { const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uvRect[0] + uv.getX(i) * uvRect[2], uvRect[1] + uv.getY(i) * uvRect[3]); }
  mesh(pg, screenMat(tex, 1.15), 0, 0.22 + h / 2, 0.014, g);
  return g;
}
function laptop(parent, x, z, rot, tex) {
  const g = new THREE.Group(); g.position.set(x, 0.79, z); g.rotation.y = rot; parent.add(g);
  box(0.36, 0.015, 0.25, M.steel, 0, 0.008, 0, g);
  const lid = new THREE.Group(); lid.position.set(0, 0.015, -0.12); lid.rotation.x = -0.25; g.add(lid);
  box(0.36, 0.24, 0.012, M.steel, 0, 0.12, 0, lid);
  mesh(new THREE.PlaneGeometry(0.33, 0.21), screenMat(tex, 1.1), 0, 0.12, 0.007, lid);
  return g;
}
function rug(parent, x, z, rx, rz, color, pattern = 'rings') {
  const tex = canvasTex(512, 512, (g, w, h) => {
    const c = new THREE.Color(color);
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.translate(w / 2, h / 2);
    const css = (k, a = 1) => `rgba(${c.r * 255 * k | 0},${c.g * 255 * k | 0},${c.b * 255 * k | 0},${a})`;
    g.fillStyle = css(0.35); g.beginPath(); g.arc(0, 0, 250, 0, TAU); g.fill();
    if (pattern === 'rings') {
      for (let i = 0; i < 6; i++) { g.strokeStyle = css(i % 2 ? 0.7 : 0.5, 0.8); g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 230 - i * 36, 0, TAU); g.stroke(); }
    } else {
      for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.fillStyle = css(0.6, 0.6); g.beginPath(); g.ellipse(0, 120, 30, 90, 0, 0, TAU); g.fill(); }
    }
    g.strokeStyle = css(1.2); g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 246, 0, TAU); g.stroke();
  });
  const m = mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, transparent: true, alphaTest: 0.5 }), x, 0.045, z, parent);
  m.rotation.x = -Math.PI / 2; m.scale.set(rx, rz, 1);
  return m;
}
function roundTable(parent, x, z, r, h = 0.74, top = M.white) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  cyl(r, r, 0.05, top, 0, h, 0, g, 40);
  cyl(0.05, 0.06, h, M.steel, 0, h / 2, 0, g, 12);
  cyl(r * 0.45, r * 0.5, 0.03, M.graphite, 0, 0.015, 0, g, 24);
  return g;
}
function floorLamp(parent, x, z, color = '#ffd9a8') {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  cyl(0.16, 0.18, 0.03, M.graphite, 0, 0.015, 0, g, 20);
  cyl(0.012, 0.012, 1.55, M.steel, 0, 0.8, 0, g, 6);
  cyl(0.13, 0.2, 0.26, std(0xf4eee2, 0.9, 0, { emissive: new THREE.Color(color), emissiveIntensity: 0.9, side: THREE.DoubleSide }), 0, 1.6, 0, g, 20).geometry = new THREE.CylinderGeometry(0.13, 0.2, 0.26, 20, 1, true);
  sph(0.05, neon(color, 2.4), 0, 1.55, 0, g, 8, 6);
  return g;
}
function projector(parent, x, z, color, onTable = 0) {
  const g = new THREE.Group(); g.position.set(x, onTable, z); parent.add(g);
  if (!onTable) cyl(0.32, 0.4, 0.12, M.black, 0, 0.06, 0, g, 32);
  else cyl(0.22, 0.26, 0.05, M.black, 0, 0.025, 0, g, 32);
  const top = onTable ? 0.05 : 0.12;
  const ringM = mesh(new THREE.TorusGeometry(onTable ? 0.2 : 0.3, 0.012, 6, 48), neon(color, 2.6), 0, top + 0.003, 0, g); ringM.rotation.x = Math.PI / 2;
  mesh(new THREE.CircleGeometry(onTable ? 0.17 : 0.26, 32), neon(color, 0.7), 0, top + 0.004, 0, g).rotation.x = -Math.PI / 2;
  const beamH = onTable ? 0.45 : 0.95;
  const beam = mesh(new THREE.CylinderGeometry(onTable ? 0.5 : 0.75, onTable ? 0.16 : 0.25, beamH, 40, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uColor; varying vec2 vUv; void main(){ float a = (1. - vUv.y) * .16 * (0.6 + .4 * sin(vUv.x * 60.)); gl_FragColor = vec4(uColor * a, a); }`,
  }), 0, top + beamH / 2, 0, g);
  beam.material.uniforms.uColor.value.multiplyScalar(1.2);
  const anchor = new THREE.Group(); anchor.position.y = top + beamH + (onTable ? 0.2 : 0.45); g.add(anchor);
  return anchor;
}

// ---------------------------------------------------------- room shell ----
function makeRoom(slot, def) {
  const a = slotAngle(slot);
  const color = def.color;
  const g = new THREE.Group();
  g.position.copy(polar(ROOM_R, a));
  g.rotation.y = a + Math.PI;
  scene.add(g);
  const room = { slot, angle: a, group: g, color, def, wallMats: [], fade: 1, doors: null, pickMeshes: [] };

  // floor
  const ftex = floorTexture(def.floor, color);
  ftex.repeat.set(def.floor === 'wood' ? 2.2 : 3, def.floor === 'wood' ? 2.2 : 3);
  const floorMat = new THREE.MeshStandardMaterial({ map: ftex, roughness: def.floor === 'marble' ? 0.18 : 0.75, metalness: def.floor === 'tile' ? 0.4 : 0.05 });
  if (def.floor === 'tile') { floorMat.emissive = new THREE.Color(0xffffff); floorMat.emissiveMap = ftex; floorMat.emissiveIntensity = 0.06; }
  const fgeo = new THREE.CircleGeometry(ROOM_RAD, 72, Math.PI, Math.PI);
  fgeo.rotateX(-Math.PI / 2);
  const floor = mesh(fgeo, floorMat, 0, 0.025, 0, g);
  floor.userData.pick = { type: 'room', slot };

  // back wall (fades when it stands between camera and room)
  const wall = new THREE.Group(); g.add(wall);
  room.wall = wall;
  const wallTex = canvasTex(1024, 256, (c, w, h) => {
    const grd = c.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#171c2c'); grd.addColorStop(1, '#0c0f19');
    c.fillStyle = grd; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 2;
    for (let x = 0; x < w; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.03)'; c.fillRect(0, h * 0.52, w, 3);
  });
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.6, metalness: 0.3, transparent: true });
  const W = ROOM_RAD * 2 + 0.24;
  box(W, WALL_H, 0.22, wallMat, 0, WALL_H / 2, -0.11, wall);
  box(W, 0.045, 0.06, neon(color, 2.0, { transparent: true }), 0, WALL_H + 0.025, 0.0, wall);
  box(W, 0.03, 0.22, std(0x0c0f18, 0.4, 0.6, { transparent: true }), 0, WALL_H, -0.11, wall);
  box(W, 0.05, 0.03, neon(color, 1.4, { transparent: true }), 0, 0.08, 0.005, wall);
  // posts where glass meets wall
  [-1, 1].forEach(s => box(0.16, WALL_H, 0.3, M.graphite, s * (ROOM_RAD + 0.02), WALL_H / 2, 0.02, g));

  // curved glass front with the door in the middle
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xa8dcff, transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0.95, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.4 });
  const segs = [[-Math.PI / 2, Math.PI / 2 - DOOR_HALF / ROOM_RAD], [DOOR_HALF / ROOM_RAD, Math.PI / 2 - DOOR_HALF / ROOM_RAD]];
  const neonBottom = neon(color, 1.9), neonTop = neon(color, 0.8);
  segs.forEach(([s0, len]) => {
    mesh(new THREE.CylinderGeometry(ROOM_RAD, ROOM_RAD, GLASS_H, 48, 1, true, s0, len), glassMat, 0, GLASS_H / 2, 0, g);
    mesh(new THREE.CylinderGeometry(ROOM_RAD + 0.012, ROOM_RAD + 0.012, 0.06, 48, 1, true, s0, len), neonBottom, 0, 0.05, 0, g);
    mesh(new THREE.CylinderGeometry(ROOM_RAD + 0.01, ROOM_RAD + 0.01, 0.05, 48, 1, true, s0, len), neonTop, 0, GLASS_H, 0, g);
  });
  // mullions
  for (let k = 1; k < 8; k++) {
    const th = -Math.PI / 2 + k * Math.PI / 8;
    if (Math.abs(th) < DOOR_HALF / ROOM_RAD + 0.05) continue;
    const m = box(0.05, GLASS_H, 0.07, M.graphite, ROOM_RAD * Math.sin(th), GLASS_H / 2, ROOM_RAD * Math.cos(th), g);
    m.rotation.y = th;
  }
  // door frame
  const dz = ROOM_RAD;
  [-1, 1].forEach(s => {
    box(0.1, GLASS_H, 0.18, M.graphite, s * (DOOR_HALF + 0.03), GLASS_H / 2, dz - 0.02, g);
    box(0.025, GLASS_H - 0.1, 0.025, neon(color, 2), s * (DOOR_HALF - 0.025), (GLASS_H - 0.1) / 2, dz + 0.08, g);
  });
  box(DOOR_HALF * 2 + 0.26, 0.18, 0.2, M.graphite, 0, GLASS_H + 0.0, dz - 0.02, g);
  box(DOOR_HALF * 2 - 0.05, 0.025, 0.025, neon(color, 2), 0, GLASS_H - 0.12, dz + 0.08, g);
  // sliding doors
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.9, depthWrite: false, side: THREE.DoubleSide });
  const doors = [-1, 1].map(s => {
    const d = new THREE.Group(); g.add(d);
    box(DOOR_HALF, GLASS_H - 0.12, 0.03, doorMat, 0, (GLASS_H - 0.12) / 2, 0, d);
    box(0.02, 0.5, 0.05, M.steel, -s * (DOOR_HALF / 2 - 0.08), 1.05, 0.03, d);
    box(DOOR_HALF - 0.1, 0.015, 0.035, neon(color, 1.4), 0, 1.2, 0, d);
    d.position.set(s * DOOR_HALF / 2, 0, dz);
    d.userData.s = s;
    return d;
  });
  room.doors = { list: doors, open: 0 };
  // door sign (two faces so it reads from inside and outside)
  const signTex = canvasTex(1024, 220, () => {});
  room.signTex = signTex;
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false, depthWrite: false });
  const sign = new THREE.Group(); sign.position.set(0, GLASS_H + 0.42, dz); g.add(sign);
  rbox(2.25, 0.5, 0.05, 0.05, std(0x0b0e18, 0.3, 0.7), 0, 0, 0, sign);
  mesh(new THREE.PlaneGeometry(2.2, 0.47), signMat, 0, 0, 0.03, sign);
  const back = mesh(new THREE.PlaneGeometry(2.2, 0.47), signMat, 0, 0, -0.03, sign); back.rotation.y = Math.PI;
  box(2.25, 0.02, 0.07, neon(color, 2.4), 0, -0.26, 0, sign);
  room.sign = sign;

  // light
  const pl = new THREE.PointLight(def.light || 0xfff0e0, 3.2, 8, 1.5);
  pl.position.set(0, 2.6, 2.4); g.add(pl);

  // anchors (local) → world helpers
  room.local = (x, z, y = 0) => { g.updateMatrixWorld(true); return g.localToWorld(V3(x, y, z)); };
  room.doorIn = () => room.local(0, ROOM_RAD - 0.75);
  room.doorOut = () => room.local(0, ROOM_RAD + 1.0);
  room.center = () => room.local(0, 2.6);

  def.build(g, room);

  // wall fade: wall-mounted things are added to room.wall by the builders
  wall.traverse(o => {
    if (o.isMesh) {
      if (!room.wallMats.includes(o.material)) {
        if (o.material !== wallMat) o.material = o.material.clone();
        o.material.transparent = true;
        o.material.userData.baseOpacity = o.material.opacity;
        room.wallMats.push(o.material);
      }
    }
  });
  g.traverse(o => { if (o.isMesh && !o.userData.pick) o.userData.pick = { type: 'room', slot }; });
  pickables.push(g);
  drawSign(room);
  rooms[slot] = room;
  return room;
}

function drawSign(room) {
  const c = room.signTex.userData.ctx, cv = room.signTex.userData.canvas, w = cv.width, h = cv.height;
  c.clearRect(0, 0, w, h);
  const isLobby = room.slot === 0;
  const name = isLobby ? SETTINGS.lobby : SETTINGS.rooms[room.slot - 1];
  const sub = isLobby ? 'RECEPTION' : (SETTINGS.titles[room.slot - 1] || '').split(/\s+/)[0].toUpperCase() + ' OFFICE';
  c.fillStyle = room.color; c.shadowColor = room.color; c.shadowBlur = 18;
  c.fillRect(34, 50, 10, h - 100);
  c.shadowBlur = 0;
  c.font = `700 92px ${FONT}`; c.fillStyle = '#ffffff'; c.textBaseline = 'middle';
  let size = 92;
  while (c.measureText(name).width > w - 120 && size > 40) { size -= 4; c.font = `700 ${size}px ${FONT}`; }
  c.fillText(name, 74, h / 2 - 18);
  c.font = `600 34px ${FONT}`; c.fillStyle = room.color;
  c.fillText(sub, 76, h / 2 + 56);
  room.signTex.needsUpdate = true;
}

// Walls facing the camera fade out so you can always see inside.
const _cd = V3();
onFrame((dt) => {
  for (const room of rooms) {
    if (!room) continue;
    _cd.copy(camera.position).sub(room.group.position); _cd.y = 0; _cd.normalize();
    const out = Math.sin(room.angle) * _cd.x + Math.cos(room.angle) * _cd.z;
    const target = out > 0.15 ? 0.08 : 1;
    room.fade = damp(room.fade, target, 6, dt);
    for (const m of room.wallMats) {
      m.opacity = (m.userData.baseOpacity ?? 1) * room.fade;
      m.depthWrite = room.fade > 0.95;
      m.visible = room.fade > 0.02;
    }
  }
});

// ============================================================== screens ====
const CODE_LINES = [
  ['kw', 'export async function', 'fn', ' deploy', 'p', '(env) {'],
  ['p', '  const ', 'v', 'build', 'p', ' = await ', 'fn', 'compile', 'p', '(src);'],
  ['p', '  if (!', 'v', 'build', 'p', '.ok) ', 'kw', 'throw', 'p', ' build.err;'],
  ['cm', '  // seven offices, zero downtime'],
  ['p', '  await ', 'fn', 'canary', 'p', '(', 'st', "'cto'", 'p', ', 0.05);'],
  ['p', '  for (const ', 'v', 'r', 'p', ' of ', 'v', 'regions', 'p', ') {'],
  ['p', '    await ', 'fn', 'rollout', 'p', '(r, { ', 'v', 'wave', 'p', ': ', 'nu', '3', 'p', ' });'],
  ['p', '  }'],
  ['p', '  ', 'kw', 'return', 'p', ' { ', 'v', 'status', 'p', ': ', 'st', "'green'", 'p', ' };'],
  ['p', '}'],
  ['p', ''],
  ['kw', 'const', 'p', ' cats = [', 'st', "'brit'", 'p', ', ', 'st', "'ragdoll'", 'p', ', ', 'st', "'munchkin'", 'p', '];'],
  ['fn', 'watch', 'p', '(', 'v', 'latency', 'p', ', { ', 'v', 'p99', 'p', ': ', 'nu', '180', 'p', ' });'],
  ['cm', '// TODO: feed the cats before the release'],
  ['kw', 'class', 'fn', ' Fountain', 'p', ' {'],
  ['p', '  ', 'fn', 'spray', 'p', '(', 'v', 'jets', 'p', ' = ', 'nu', '7', 'p', ') { ', 'kw', 'return', 'p', ' rainbow(jets); }'],
  ['p', '}'],
];
const SYN = { kw: '#c792ea', fn: '#82aaff', v: '#f07178', st: '#c3e88d', nu: '#f78c6c', cm: '#5c6b8a', p: '#d6deeb' };
function drawCode(c, x, y, w, h, t, scroll = 1, size = 15) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = '#0a0f1a'; c.fillRect(x, y, w, h);
  c.font = `${size}px ${MONO}`; c.textBaseline = 'top';
  const lh = size * 1.45; const off = Math.floor(t * scroll) % CODE_LINES.length;
  const rows = Math.ceil(h / lh) + 1;
  for (let i = 0; i < rows; i++) {
    const L = CODE_LINES[(i + off) % CODE_LINES.length];
    const yy = y + 8 + i * lh;
    c.fillStyle = '#3a4560'; c.fillText(String((i + off) % 99 + 1).padStart(2, ' '), x + 6, yy);
    let xx = x + 36;
    for (let k = 0; k < L.length; k += 2) { c.fillStyle = SYN[L[k]]; c.fillText(L[k + 1], xx, yy); xx += c.measureText(L[k + 1]).width; }
    if (i === 6 && Math.floor(t * 2) % 2) { c.fillStyle = '#82aaff'; c.fillRect(xx + 2, yy, size * 0.55, size * 1.1); }
  }
  c.restore();
}
function panelHead(c, x, y, w, title, color, right = '') {
  c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(x, y, w, 30);
  c.fillStyle = color; c.fillRect(x, y, 4, 30);
  c.font = `600 15px ${FONT}`; c.fillStyle = '#e6ecff'; c.textBaseline = 'middle'; c.fillText(title, x + 14, y + 15);
  if (right) { c.textAlign = 'right'; c.fillStyle = color; c.fillText(right, x + w - 10, y + 15); c.textAlign = 'left'; }
}
const TERM = [
  ['#8be9a8', '✔ unit tests       1,284 passed'], ['#d6deeb', '→ building image  office-api:4821'], ['#8be9a8', '✔ lint             0 problems'],
  ['#ffd23a', '⚠ cache miss       pnpm store (warming)'], ['#d6deeb', '→ canary 5%        ap-east-1'], ['#8be9a8', '✔ health check     200 OK · 41ms'],
  ['#d6deeb', '→ rollout wave 2   eu-west-1, us-east-1'], ['#8be9a8', '✔ migrations       12 applied'], ['#82aaff', 'ℹ cat detected on keyboard, ignoring'],
  ['#8be9a8', '✔ deploy complete  v2.18.4'], ['#d6deeb', '→ tailing logs …'],
];
function drawTerminal(c, x, y, w, h, t, size = 15) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = '#05080c'; c.fillRect(x, y, w, h);
  c.font = `${size}px ${MONO}`; c.textBaseline = 'top';
  const lh = size * 1.5, n = Math.floor(h / lh) - 1;
  const step = Math.floor(t * 1.4);
  for (let i = 0; i < n; i++) {
    const L = TERM[(step + i) % TERM.length];
    c.fillStyle = '#4a5878'; c.fillText('$', x + 8, y + 8 + i * lh);
    c.fillStyle = L[0]; c.fillText(L[1], x + 26, y + 8 + i * lh);
  }
  if (Math.floor(t * 2) % 2) { c.fillStyle = '#8be9a8'; c.fillRect(x + 26, y + 8 + n * lh, size * 0.6, size); }
  c.restore();
}
const LAT = { p50: [], p95: [], p99: [] };
for (let i = 0; i < 120; i++) { LAT.p50.push(40 + Math.sin(i * 0.2) * 6 + rand() * 5); LAT.p95.push(95 + Math.sin(i * 0.13) * 14 + rand() * 12); LAT.p99.push(150 + Math.sin(i * 0.09) * 20 + rand() * 25); }
let latTick = 0;
function drawLatency(c, x, y, w, h, t) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = '#070b14'; c.fillRect(x, y, w, h);
  const step = Math.floor(t * 3);
  while (latTick < step) {
    latTick++;
    LAT.p50.shift(); LAT.p50.push(40 + Math.sin(latTick * 0.2) * 6 + Math.random() * 5);
    LAT.p95.shift(); LAT.p95.push(95 + Math.sin(latTick * 0.13) * 14 + Math.random() * 12);
    LAT.p99.shift(); LAT.p99.push(150 + Math.sin(latTick * 0.09) * 20 + Math.random() * 25 + (Math.random() < 0.04 ? 60 : 0));
  }
  c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = 1;
  for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(x, y + h * i / 5); c.lineTo(x + w, y + h * i / 5); c.stroke(); }
  const plot = (arr, col, fill) => {
    c.beginPath();
    arr.forEach((v, i) => { const px = x + (i / (arr.length - 1)) * w, py = y + h - (v / 260) * h; i ? c.lineTo(px, py) : c.moveTo(px, py); });
    c.strokeStyle = col; c.lineWidth = 2.2; c.shadowColor = col; c.shadowBlur = 8; c.stroke(); c.shadowBlur = 0;
    if (fill) { c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.closePath(); const gr = c.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, col + '55'); gr.addColorStop(1, col + '00'); c.fillStyle = gr; c.fill(); }
  };
  plot(LAT.p99, '#ff6b8b'); plot(LAT.p95, '#ffd23a'); plot(LAT.p50, '#33e08a', true);
  c.font = `600 14px ${MONO}`; c.textBaseline = 'top';
  [['p50', LAT.p50, '#33e08a'], ['p95', LAT.p95, '#ffd23a'], ['p99', LAT.p99, '#ff6b8b']].forEach(([k, a, col], i) => {
    c.fillStyle = col; c.fillText(`${k} ${a[a.length - 1].toFixed(0)}ms`, x + 10 + i * 120, y + 8);
  });
  c.restore();
}
function drawCI(c, x, y, w, h, t) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = '#070b14'; c.fillRect(x, y, w, h);
  const stages = ['build', 'test', 'lint', 'image', 'canary', 'deploy'];
  const rowH = 44; const rows = Math.floor((h - 10) / rowH);
  const base = 4821 + Math.floor(t / 6);
  c.font = `13px ${MONO}`; c.textBaseline = 'middle';
  for (let r = 0; r < rows; r++) {
    const id = base - r; const yy = y + 10 + r * rowH;
    const prog = r === 0 ? ((t % 6) / 6) * stages.length : stages.length;
    const fail = (id % 9 === 0) && r > 0;
    c.fillStyle = '#9aa6c4'; c.fillText(`#${id}`, x + 10, yy + 14);
    c.fillStyle = '#5b6480'; c.fillText(['main', 'feat/cat-door', 'fix/latency', 'main', 'chore/deps'][id % 5], x + 10, yy + 32);
    stages.forEach((s, k) => {
      const sx = x + 150 + k * ((w - 170) / stages.length), sw = (w - 170) / stages.length - 8;
      let col = '#1d2436';
      if (k < Math.floor(prog)) col = fail && k === 3 ? '#ff3d5a' : '#1fae6a';
      else if (k === Math.floor(prog) && r === 0) col = Math.floor(t * 3) % 2 ? '#ffd23a' : '#a88a1c';
      if (fail && k > 3) col = '#2a2f3c';
      roundRect(c, sx, yy + 6, sw, 22, 6); c.fillStyle = col; c.fill();
      c.fillStyle = col === '#1d2436' || col === '#2a2f3c' ? '#5b6480' : '#06120c';
      c.font = `600 11px ${MONO}`; c.fillText(s, sx + 8, yy + 17);
    });
    c.font = `13px ${MONO}`;
  }
  c.restore();
}

function drawCTOWall(c, w, h, t) {
  c.fillStyle = '#03060b'; c.fillRect(0, 0, w, h);
  // header bar
  c.fillStyle = '#0a1420'; c.fillRect(0, 0, w, 44);
  c.font = `700 20px ${FONT}`; c.fillStyle = '#33e08a'; c.textBaseline = 'middle';
  c.fillText('● ENGINEERING OPS', 18, 22);
  c.fillStyle = '#9fb3d1'; c.font = `500 16px ${FONT}`;
  c.fillText('ALL SYSTEMS NOMINAL  ·  7 SERVICES  ·  3 REGIONS  ·  ON-CALL: ' + (SETTINGS.names[3] || 'Thursday').toUpperCase(), 250, 22);
  const d = new Date();
  c.textAlign = 'right'; c.fillStyle = '#e6ecff'; c.font = `600 18px ${MONO}`;
  c.fillText(d.toTimeString().slice(0, 8) + ' TST', w - 18, 22); c.textAlign = 'left';
  const pad = 12, top = 52, ph = h - top - pad, pw = (w - pad * 5) / 4;
  const X = i => pad + i * (pw + pad);
  panelHead(c, X(0), top, pw, 'CI / CD PIPELINE', '#33e08a', 'main');
  drawCI(c, X(0), top + 32, pw, ph - 32, t);
  panelHead(c, X(1), top, pw, 'office-api / deploy.ts', '#82aaff', 'TS');
  drawCode(c, X(1), top + 32, pw, ph - 32, t, 0.8, 14);
  panelHead(c, X(2), top, pw, 'TERMINAL — prod', '#8be9a8', 'zsh');
  drawTerminal(c, X(2), top + 32, pw, ph - 32, t, 14);
  panelHead(c, X(3), top, pw, 'LATENCY · ms', '#ffd23a', 'live');
  drawLatency(c, X(3), top + 32, pw, ph - 32, t);
  // scanline sheen
  c.fillStyle = 'rgba(255,255,255,.025)';
  for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
}

function drawTicker(c, w, h, t) {
  c.fillStyle = '#07090f'; c.fillRect(0, 0, w, h);
  c.font = `700 22px ${FONT}`; c.fillStyle = '#ffd23a'; c.textBaseline = 'middle';
  c.fillText('TREASURY · Q4', 22, 30);
  c.font = `500 15px ${FONT}`; c.fillStyle = '#9aa6c4'; c.fillText('Revenue  ▲ 18.4%   Burn  ▼ 6.1%   Runway  38 mo', 220, 30);
  // candles
  const N = 46, cw = (w - 60) / N, x0 = 30, y0 = 60, ch = h - 130;
  let v = 120;
  const off = Math.floor(t * 1.5);
  let sd = 777;
  const lr = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  const vals = [];
  for (let i = 0; i < N + off % 1000; i++) { const o = v; v += (lr() - 0.46) * 9; vals.push([o, v, Math.max(o, v) + lr() * 4, Math.min(o, v) - lr() * 4]); }
  const vis = vals.slice(-N);
  const lo = Math.min(...vis.map(q => q[3])), hi = Math.max(...vis.map(q => q[2]));
  const Y = val => y0 + ch - ((val - lo) / (hi - lo)) * ch;
  c.strokeStyle = 'rgba(255,255,255,.06)';
  for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(x0, y0 + ch * i / 4); c.lineTo(w - 30, y0 + ch * i / 4); c.stroke(); }
  vis.forEach(([o, cl, H, L], i) => {
    const up = cl >= o, col = up ? '#33e08a' : '#ff3d5a', x = x0 + i * cw + cw / 2;
    c.strokeStyle = col; c.beginPath(); c.moveTo(x, Y(H)); c.lineTo(x, Y(L)); c.stroke();
    c.fillStyle = col; c.fillRect(x - cw * 0.32, Math.min(Y(o), Y(cl)), cw * 0.64, Math.max(2, Math.abs(Y(o) - Y(cl))));
  });
  // ticker tape
  c.fillStyle = '#0d1220'; c.fillRect(0, h - 56, w, 56);
  const items = ['CLDE +2.4%', 'NEKO +7.7%', 'RAIN +1.2%', 'BOBA −0.8%', 'MOON +3.3%', 'SUN +0.9%', 'LEAF +4.1%', 'BOLT −1.5%'];
  c.font = `600 20px ${MONO}`; c.textBaseline = 'middle';
  let x = w - ((t * 70) % (w + 1400));
  for (let k = 0; k < 2; k++) items.forEach(s => { c.fillStyle = s.includes('−') ? '#ff6b8b' : '#33e08a'; c.fillText(s, x, h - 28); x += c.measureText(s).width + 50; });
}

function drawKanban(c, w, h, t) {
  c.fillStyle = '#f2efe9'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#1b2030'; c.font = `700 26px ${FONT}`; c.textBaseline = 'middle'; c.fillText('OPS BOARD', 24, 34);
  const cities = [['TPE', 8], ['LON', 0], ['NYC', -5], ['SFO', -8]];
  cities.forEach(([n, off], i) => {
    const d = new Date(Date.now() + (off - 8) * 3600e3 + new Date().getTimezoneOffset() * 0);
    const cx = w - 300 + i * 74, cy = 34;
    c.strokeStyle = '#1b2030'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, 20, 0, TAU); c.stroke();
    const hr = (d.getUTCHours() + off + 24) % 12, mn = d.getUTCMinutes();
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.sin((hr + mn / 60) / 12 * TAU) * 11, cy - Math.cos((hr + mn / 60) / 12 * TAU) * 11); c.stroke();
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(mn / 60 * TAU) * 16, cy - Math.cos(mn / 60 * TAU) * 16); c.stroke();
    c.font = `600 12px ${FONT}`; c.fillStyle = '#5b6480'; c.textAlign = 'center'; c.fillText(n, cx, cy + 32); c.textAlign = 'left';
  });
  const cols = ['TO DO', 'DOING', 'REVIEW', 'DONE'], colors = ['#ffd23a', '#ff8a2b', '#2fa8ff', '#33e08a', '#ff9ec7', '#b05cff'];
  const cw = (w - 60) / 4;
  const shift = Math.floor(t / 4);
  cols.forEach((name, i) => {
    const x = 20 + i * (cw + 7);
    c.fillStyle = 'rgba(27,32,48,.06)'; roundRect(c, x, 70, cw, h - 86, 10); c.fill();
    c.fillStyle = '#1b2030'; c.font = `700 15px ${FONT}`; c.fillText(name, x + 12, 90);
    const n = 3 + ((i + shift) % 3);
    for (let k = 0; k < n; k++) {
      const col = colors[(i * 3 + k + shift) % colors.length];
      const yy = 108 + k * 54;
      if (yy > h - 60) break;
      c.save(); c.translate(x + 10 + cw / 2 - 10, yy + 22); c.rotate(((i + k) % 3 - 1) * 0.015);
      c.fillStyle = col; c.shadowColor = 'rgba(0,0,0,.18)'; c.shadowBlur = 6; c.shadowOffsetY = 2; c.fillRect(-(cw - 20) / 2, -22, cw - 20, 44); c.shadowBlur = 0; c.shadowOffsetY = 0;
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(-(cw - 20) / 2 + 10, -10, (cw - 40) * (0.4 + ((k * 7 + i) % 5) / 10), 6); c.fillRect(-(cw - 20) / 2 + 10, 4, (cw - 40) * 0.3, 5);
      c.restore();
    }
  });
}

function drawCampaign(c, w, h) {
  c.fillStyle = '#0d0b1e'; c.fillRect(0, 0, w, h);
  const posters = [
    ['#6a63ff', '#ff5fa8', 'LAUNCH', 'Nov 28'], ['#ffd23a', '#ff8a2b', 'NEW', 'cat café'], ['#2fa8ff', '#33e08a', '+218%', 'reach'],
    ['#ff3d5a', '#ffb36a', 'LOVE', 'it'], ['#b05cff', '#2fa8ff', '7 DAYS', 'of rainbow'],
  ];
  const pw = (w - 40) / posters.length;
  posters.forEach(([a, b, big, small], i) => {
    const x = 20 + i * pw + 8, y = 26 + (i % 2) * 18, ww = pw - 16, hh = h - 70;
    const gr = c.createLinearGradient(x, y, x + ww, y + hh); gr.addColorStop(0, a); gr.addColorStop(1, b);
    c.fillStyle = gr; c.fillRect(x, y, ww, hh);
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(x + ww * 0.7, y + hh * 0.35, ww * 0.32, 0, TAU); c.fill();
    if (i === 3) { c.fillStyle = '#fff'; c.font = `120px ${FONT}`; c.textAlign = 'center'; c.fillText('♥', x + ww / 2, y + hh * 0.42); c.textAlign = 'left'; }
    c.fillStyle = '#fff'; c.font = `800 ${ww * 0.2}px ${FONT}`; c.textBaseline = 'alphabetic'; c.fillText(big, x + 14, y + hh - 50);
    c.font = `500 ${ww * 0.08}px ${FONT}`; c.fillText(small, x + 16, y + hh - 18);
    c.fillStyle = '#e8e3d8'; c.fillRect(x + ww / 2 - 14, y - 8, 28, 14);
  });
}

function drawBulletin(c, w, h) {
  c.fillStyle = '#b58a5a'; c.fillRect(0, 0, w, h);
  const id = c.getImageData(0, 0, w, h);
  for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 30; id.data[i] += n; id.data[i + 1] += n * 0.8; id.data[i + 2] += n * 0.6; }
  c.putImageData(id, 0, 0);
  c.strokeStyle = '#6b4a2a'; c.lineWidth = 14; c.strokeRect(7, 7, w - 14, h - 14);
  const faces = ['#ffd9c2', '#f8d0b4', '#ffdcc8', '#ffd6bd', '#ffdccb', '#ffd8c4', '#ffdcc6'];
  for (let i = 0; i < 7; i++) {
    const x = 40 + (i % 4) * 150 + (i > 3 ? 70 : 0), y = 40 + Math.floor(i / 4) * 190;
    c.save(); c.translate(x + 60, y + 75); c.rotate((i % 3 - 1) * 0.06);
    c.fillStyle = '#fff'; c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 8; c.fillRect(-60, -75, 120, 150); c.shadowBlur = 0;
    c.fillStyle = RAINBOW[i]; c.fillRect(-52, -67, 104, 104);
    c.fillStyle = faces[i]; c.beginPath(); c.arc(0, -10, 30, 0, TAU); c.fill();
    c.fillStyle = '#222'; c.beginPath(); c.arc(-10, -12, 3.5, 0, TAU); c.arc(10, -12, 3.5, 0, TAU); c.fill();
    c.strokeStyle = '#222'; c.lineWidth = 2; c.beginPath(); c.arc(0, -4, 8, 0.2, Math.PI - 0.2); c.stroke();
    c.fillStyle = '#333'; c.font = `600 16px ${FONT}`; c.textAlign = 'center'; c.fillText(SETTINGS.names[i] || EXECS[i].name, 0, 58);
    c.fillStyle = '#e33'; c.beginPath(); c.arc(0, -70, 6, 0, TAU); c.fill();
    c.restore();
  }
  c.save(); c.translate(w - 200, 70); c.rotate(0.05);
  c.fillStyle = '#fff59a'; c.fillRect(0, 0, 170, 150);
  c.fillStyle = '#5a4a20'; c.font = `700 26px ${FONT}`; c.fillText('Welcome', 18, 48);
  c.font = `500 18px ${FONT}`; c.fillText('new hires 🐾', 18, 86); c.fillText('lunch @ 12:30', 18, 116);
  c.restore();
}

function drawVision(c, w, h) {
  const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#120612'); gr.addColorStop(1, '#2a0a14');
  c.fillStyle = gr; c.fillRect(0, 0, w, h);
  c.save(); c.translate(w * 0.27, h / 2);
  for (let i = 0; i < 7; i++) {
    c.strokeStyle = RAINBOW[i]; c.lineWidth = 6; c.shadowColor = RAINBOW[i]; c.shadowBlur = 14;
    const a0 = -Math.PI / 2 + i * TAU / 7, a1 = a0 + TAU / 7, R = 120;
    c.beginPath(); c.moveTo(Math.cos(a0) * R, Math.sin(a0) * R); c.lineTo(Math.cos(a1) * R, Math.sin(a1) * R); c.stroke();
  }
  c.restore(); c.shadowBlur = 0;
  c.fillStyle = '#fff'; c.font = `800 74px ${FONT}`; c.textBaseline = 'middle'; c.fillText('VISION', w * 0.5, h * 0.4);
  c.fillStyle = '#ff9aa8'; c.font = `500 26px ${FONT}`; c.fillText('Seven days. One rainbow.', w * 0.5, h * 0.6);
}

function staticChart(color) {
  return canvasTex(512, 320, (c, w, h) => {
    c.fillStyle = '#0a0f1a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,.07)';
    for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(0, h * i / 6); c.lineTo(w, h * i / 6); c.stroke(); }
    for (let k = 0; k < 2; k++) {
      c.beginPath(); let y = h * (0.6 - k * 0.2);
      for (let x = 0; x <= w; x += 16) { y += (Math.random() - 0.48) * 22; y = clamp(y, 30, h - 20); x ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.strokeStyle = k ? '#ffffff' : color; c.lineWidth = 3; c.stroke();
    }
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? color : 'rgba(255,255,255,.4)'; const bh = 20 + Math.random() * 60; c.fillRect(20 + i * 30, h - bh - 10, 18, bh); }
  });
}
function staticCode() { return canvasTex(512, 320, (c, w, h) => drawCode(c, 0, 0, w, h, 3, 1, 14)); }

// ============================================================== rooms ======
const SPOT = (x, z, rot, sit = 0) => ({ x, z, rot, sit });

// ---- Lobby ------------------------------------------------------------
makeRoom(0, {
  color: LOBBY_COLOR, floor: 'marble', light: 0xeaf4ff,
  build(g, room) {
    // curved reception counter
    const sec = (r1, r2, a) => {
      const s = new THREE.Shape();
      for (let i = 0; i <= 32; i++) { const t = -a + 2 * a * i / 32; i ? s.lineTo(r2 * Math.sin(t), -r2 * Math.cos(t)) : s.moveTo(r2 * Math.sin(t), -r2 * Math.cos(t)); }
      for (let i = 32; i >= 0; i--) { const t = -a + 2 * a * i / 32; s.lineTo(r1 * Math.sin(t), -r1 * Math.cos(t)); }
      return s;
    };
    const counter = new THREE.Group(); counter.position.set(0, 0, 1.5); g.add(counter);
    const body = new THREE.ExtrudeGeometry(sec(1.55, 1.85, 1.15), { depth: 1.0, bevelEnabled: false, curveSegments: 32 });
    body.rotateX(-Math.PI / 2);
    mesh(body, std(0xf2f4f8, 0.25, 0.05), 0, 0, 0, counter);
    const topG = new THREE.ExtrudeGeometry(sec(1.45, 1.95, 1.2), { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
    topG.rotateX(-Math.PI / 2);
    mesh(topG, M.darkWood, 0, 1.0, 0, counter);
    const lineG = new THREE.ExtrudeGeometry(sec(1.86, 1.87, 1.15), { depth: 0.04, bevelEnabled: false });
    lineG.rotateX(-Math.PI / 2);
    mesh(lineG, neon('#bfe6ff', 2.6), 0, 0.12, 0, counter);
    mesh(lineG, neon('#bfe6ff', 2.0), 0, 0.92, 0, counter);
    // little computer and bell
    monitor(counter, 0.45, 1.62, Math.PI + 0.25, 0.42, 0.26, staticCode(), 1.06);
    sph(0.07, M.gold, -0.5, 1.12, 1.62, counter, 16, 8).scale.y = 0.6;
    // floating company sign
    const signTex = canvasTex(2048, 560, () => {});
    room.companyTex = signTex;
    drawCompanySign();
    const sign = new THREE.Group(); sign.position.set(0, 3.55, 1.6); g.add(sign);
    const sm = new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false, depthWrite: false, side: THREE.FrontSide, blending: THREE.AdditiveBlending });
    mesh(new THREE.PlaneGeometry(4.6, 1.26), sm, 0, 0, 0.01, sign);
    mesh(new THREE.PlaneGeometry(4.6, 1.26), sm, 0, 0, -0.01, sign).rotation.y = Math.PI;
    const glowBar = box(3.9, 0.02, 0.02, neon('#bfe6ff', 2.2), 0, -0.68, 0, sign);
    onFrame((dt, t) => { sign.position.y = 3.55 + Math.sin((REDUCED ? 0 : t) * 0.8) * 0.06; });
    room.companySign = sign;

    // elevators and logo on the back wall
    [-1, 1].forEach(s => {
      const x = s * 3.0;
      box(1.5, 2.45, 0.06, M.graphite, x, 1.23, 0.04, room.wall);
      [-1, 1].forEach(k => box(0.68, 2.3, 0.04, std(0x5a6274, 0.3, 0.9), x + k * 0.355, 1.17, 0.08, room.wall));
      box(1.56, 0.03, 0.05, neon('#bfe6ff', 1.5), x, 2.5, 0.09, room.wall);
      [-1, 1].forEach(k => box(0.03, 2.48, 0.05, neon('#bfe6ff', 1.1), x + k * 0.78, 1.24, 0.09, room.wall));
      const ind = canvasTex(128, 48, (c, w, h) => { c.fillStyle = '#05070d'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff8a2b'; c.font = `700 30px ${MONO}`; c.textBaseline = 'middle'; c.fillText(s < 0 ? '▲ 77' : '▼ 77', 12, 25); });
      mesh(new THREE.PlaneGeometry(0.4, 0.15), screenMat(ind, 1.4), x, 2.7, 0.08, room.wall);
    });

    // waiting sofas on both sides
    sofa(g, -3.55, 2.5, 2.0, Math.PI / 2, 0x3c4a78);
    sofa(g, 3.55, 2.5, 2.0, -Math.PI / 2, 0x3c4a78);
    roundTable(g, -2.35, 2.5, 0.42, 0.42, M.glassDark);
    roundTable(g, 2.35, 2.5, 0.42, 0.42, M.glassDark);
    [[-2.35, 2.45], [2.35, 2.55]].forEach(([x, z]) => { box(0.3, 0.02, 0.22, std(0xffd23a, 0.7), x, 0.46, z, g); box(0.28, 0.02, 0.2, std(0x2fa8ff, 0.7), x + 0.04, 0.48, z + 0.02, g).rotation.y = 0.3; });
    plant(g, -4.6, 0.65, 'tree', 1.1); plant(g, 4.6, 0.65, 'tree', 1.1);
    plant(g, -1.9, 4.75, 'snake'); plant(g, 1.9, 4.75, 'snake');
    rug(g, 0, 3.4, 1.6, 1.0, '#7fb4ff', 'petal');
    room.sofaSpot = room.local(-3.55, 2.5);
  },
});

drawCompanySign();
function drawCompanySign() {
  const room = rooms[0] || null;
  const tex = room ? room.companyTex : null;
  if (!tex) return;
  const c = tex.userData.ctx, w = tex.userData.canvas.width, h = tex.userData.canvas.height;
  c.clearRect(0, 0, w, h);
  // heptagon mark
  const cx = 250, cy = h / 2, R = 150;
  for (let i = 0; i < 7; i++) {
    const a0 = -Math.PI / 2 + i * TAU / 7, a1 = a0 + TAU / 7;
    c.strokeStyle = RAINBOW[i]; c.lineWidth = 16; c.lineCap = 'round'; c.shadowColor = RAINBOW[i]; c.shadowBlur = 30;
    c.beginPath(); c.moveTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); c.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); c.stroke();
  }
  c.shadowBlur = 0;
  c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, 22, 0, TAU); c.fill();
  const name = SETTINGS.company;
  let size = 190;
  c.font = `700 ${size}px ${FONT}`;
  while (c.measureText(name).width > w - 520 && size > 70) { size -= 6; c.font = `700 ${size}px ${FONT}`; }
  c.textBaseline = 'middle';
  c.shadowColor = '#7fb4ff'; c.shadowBlur = 40; c.fillStyle = '#e8f4ff';
  c.fillText(name, 470, h / 2 - 30);
  c.shadowBlur = 0;
  c.font = `500 56px ${FONT}`; c.fillStyle = '#8fc4ff';
  c.fillText('Claude Code · Live Office', 476, h / 2 + 120);
  tex.needsUpdate = true;
}

// ---- CEO --------------------------------------------------------------
makeRoom(1, {
  color: RAINBOW[0], floor: 'wood', light: 0xffe6d6,
  spots: { work: SPOT(0, 1.2, 0, 0.46), rest: SPOT(-3.25, 2.45, Math.PI / 2, 0.44), workVia: [[1.9, 3.3], [1.75, 1.2]], restVia: [[-1.7, 3.8]] },
  build(g, room) {
    rug(g, 0, 2.2, 2.2, 1.7, RAINBOW[0], 'rings');
    desk(g, 0, 2.0, 2.4, 0.95, 0, 'exec', RAINBOW[0]);
    chair(g, 0, 1.2, 0, 0x2a1416, true);
    chair(g, -0.6, 3.0, Math.PI, 0x5a2a30); chair(g, 0.6, 3.0, Math.PI, 0x5a2a30);
    laptop(g, 0.45, 1.85, Math.PI + 0.25, staticChart('#ff3d5a'));
    box(0.3, 0.02, 0.22, M.paper, -0.5, 0.8, 1.95, g).rotation.y = -0.2;
    cyl(0.04, 0.035, 0.1, std(0xffffff, 0.3), -0.85, 0.84, 1.75, g, 12);
    const nameplate = box(0.4, 0.08, 0.04, M.gold, 0, 0.83, 2.38, g); nameplate.rotation.x = -0.3;
    shelf(room.wall, -3.1, 0.32, 2.2, 2.3, 0, 'books');
    // trophy cabinet
    const cab = new THREE.Group(); cab.position.set(3.1, 0, 0.3); room.wall.add(cab);
    box(2.0, 0.9, 0.42, M.darkWood, 0, 0.45, 0, cab);
    box(2.0, 1.2, 0.36, std(0xa8dcff, 0.05, 0.9, { transparent: true, opacity: 0.18 }), 0, 1.5, 0, cab);
    box(2.0, 0.04, 0.42, M.darkWood, 0, 2.12, 0, cab);
    for (let i = 0; i < 4; i++) {
      const tg = new THREE.Group(); tg.position.set(-0.7 + i * 0.47, 0.93, 0); cab.add(tg);
      cyl(0.08, 0.1, 0.06, M.darkWood, 0, 0.03, 0, tg, 12);
      cyl(0.02, 0.02, 0.16, M.gold, 0, 0.14, 0, tg, 8);
      const cup = mesh(new THREE.LatheGeometry([0, 0.04, 0.09, 0.11, 0.12].map((r, k) => new THREE.Vector2(r, k * 0.05)), 20), M.gold, 0, 0.22, 0, tg);
      if (i === 1) { cup.visible = false; const star = mesh(new THREE.OctahedronGeometry(0.1), neon('#ffd23a', 1.8), 0, 0.32, 0, tg); onFrame((dt, t) => { star.rotation.y = t; }); }
    }
    box(1.9, 0.02, 0.02, neon('#ffe9c8', 1.6), 0, 2.08, 0.18, cab);
    const art = wallScreen(room.wall, 0, 2.1, 0.06, 2.0, 0.9, canvasTex(900, 400, drawVision), M.gold, 1.0);
    // lounge
    sofa(g, -3.25, 2.45, 1.8, Math.PI / 2, 0x6a1f2c);
    roundTable(g, -2.25, 2.55, 0.32, 0.4, M.glassDark);
    cyl(0.05, 0.04, 0.09, std(0xffffff, 0.3), -2.2, 0.47, 2.5, g, 10);
    floorLamp(g, -4.1, 1.2, '#ffcfa0');
    plant(g, 4.55, 0.95, 'monstera', 1.1); plant(g, -4.4, 2.9, 'small');
    // hologram: globe
    const anchor = projector(g, 3.15, 2.6, RAINBOW[0]);
    const globe = new THREE.Group(); anchor.add(globe);
    mesh(new THREE.IcosahedronGeometry(0.55, 3), holoMat(RAINBOW[0], 0.18), 0, 0, 0, globe);
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(0.56, 18, 12)), holoLine('#ff6a7a', 0.6));
    globe.add(wire);
    const cities = new THREE.Group(); globe.add(cities);
    for (let i = 0; i < 24; i++) { const p = new THREE.Vector3().randomDirection().multiplyScalar(0.57); sph(0.018, neon('#ffd0d6', 1.5), p.x, p.y, p.z, cities, 6, 4); }
    const orbit = mesh(new THREE.TorusGeometry(0.8, 0.006, 4, 90), holoMat('#ff9aa8', 0.9, 0), 0, 0, 0, anchor);
    orbit.rotation.x = Math.PI / 2 + 0.4;
    const sat = sph(0.04, neon('#ffffff', 2), 0.8, 0, 0, orbit, 8, 6);
    onFrame((dt, t) => { const tt = REDUCED ? t * 0.2 : t; globe.rotation.y = tt * 0.35; orbit.rotation.z = tt * 0.8; });
  },
});

// ---- COO --------------------------------------------------------------
makeRoom(2, {
  color: RAINBOW[1], floor: 'carpet', light: 0xffeedd,
  spots: { work: SPOT(2.2, 1.05, 0, 0.46), rest: SPOT(-0.3, 0.95, Math.PI, 0), workVia: [[3.4, 3.0], [3.35, 1.05]], restVia: [[0.2, 3.6], [0.1, 1.2]] },
  build(g, room) {
    wallScreen(room.wall, -0.2, 1.65, 0.06, 4.6, 1.6, liveScreen(1200, 420, 0.5, drawKanban), M.white, 0.62);
    desk(g, 2.2, 1.85, 1.6, 0.8, 0, 'white', RAINBOW[1]);
    chair(g, 2.2, 1.05, 0, 0x4a2a14, true);
    monitor(g, 2.2, 1.95, Math.PI, 0.7, 0.4, staticChart('#ff8a2b'));
    laptop(g, 1.65, 1.8, Math.PI + 0.4, staticCode());
    // conference table
    const t = new THREE.Group(); t.position.set(-1.7, 0, 2.7); g.add(t);
    const top = cyl(1, 1, 0.06, M.white, 0, 0.74, 0, t, 48); top.scale.set(1.25, 1, 0.7);
    cyl(0.08, 0.1, 0.72, M.steel, 0, 0.37, 0, t, 12);
    const ring1 = mesh(new THREE.TorusGeometry(1, 0.012, 4, 64), neon(RAINBOW[1], 2), 0, 0.705, 0, t); ring1.rotation.x = Math.PI / 2; ring1.scale.set(1.25, 0.7, 1);
    [[-0.8, -0.95, 0], [0.8, -0.95, 0], [-0.8, 0.95, Math.PI], [0.8, 0.95, Math.PI], [-1.65, 0, Math.PI / 2], [1.65, 0, -Math.PI / 2]].forEach(([x, z, r]) => chair(t, x, z, r, 0x3a3f52));
    // hologram: logistics map on the table
    const anchor = projector(t, 0, 0, RAINBOW[1], 0.77);
    anchor.position.y = 0.25;
    const map = new THREE.Group(); anchor.add(map);
    const hex = new THREE.CircleGeometry(0.09, 6);
    for (let q = -4; q <= 4; q++) for (let r = -3; r <= 3; r++) {
      const x = (q + r * 0.5) * 0.17, z = r * 0.15;
      if (x * x + z * z > 0.55) continue;
      const m = mesh(hex, holoMat(RAINBOW[1], rand() < 0.3 ? 0.55 : 0.18, 0), x, 0, z, map); m.rotation.x = -Math.PI / 2;
    }
    const routes = [];
    const hubs = [V3(-0.55, 0.01, -0.2), V3(0.5, 0.01, -0.3), V3(0.2, 0.01, 0.4), V3(-0.3, 0.01, 0.35), V3(0.0, 0.01, 0.0)];
    hubs.forEach(h => cyl(0.02, 0.02, 0.18, neon('#ffd0a0', 2.4), h.x, 0.09, h.z, map, 6));
    [[0, 1], [1, 2], [2, 3], [3, 0], [4, 1], [4, 3]].forEach(([i, k]) => {
      const a = hubs[i], b = hubs[k];
      const curve = new THREE.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).add(V3(0, 0.35, 0)), b);
      map.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(30)), holoLine('#ffb36a', 0.9)));
      const dot = sph(0.025, neon('#ffffff', 2.4), 0, 0, 0, map, 6, 4);
      routes.push({ curve, dot, o: rand() });
    });
    onFrame((dt, tt) => { const k = REDUCED ? tt * 0.1 : tt; map.rotation.y = k * 0.15; routes.forEach(r => r.dot.position.copy(r.curve.getPoint((k * 0.25 + r.o) % 1))); });
    plant(g, -4.5, 0.9, 'snake', 1.1); plant(g, 4.5, 0.9, 'tree');
    shelf(g, 4.3, 2.4, 0.9, 1.2, -Math.PI / 2 - 0.4, 'boxes');
  },
});

// ---- CFO --------------------------------------------------------------
makeRoom(3, {
  color: RAINBOW[2], floor: 'marble', light: 0xfff4dc,
  spots: { work: SPOT(0, 1.25, 0, 0.46), rest: SPOT(-2.6, 3.35, -2.4, 0), workVia: [[-1.8, 3.2], [-1.7, 1.25]], restVia: [[-1.2, 3.9]] },
  build(g, room) {
    wallScreen(room.wall, 0, 1.75, 0.06, 5.2, 1.75, liveScreen(1300, 440, 4, drawTicker), M.black, 1.05);
    rug(g, 0, 2.2, 2.0, 1.4, RAINBOW[2], 'rings');
    desk(g, 0, 2.05, 2.2, 0.9, 0, 'exec', RAINBOW[2]);
    chair(g, 0, 1.25, 0, 0x2a2414, true);
    monitor(g, -0.42, 2.25, Math.PI - 0.18, 0.55, 0.33, staticChart('#ffd23a'));
    monitor(g, 0.42, 2.25, Math.PI + 0.18, 0.55, 0.33, staticChart('#33e08a'));
    // coin stacks
    for (let s = 0; s < 3; s++) for (let k = 0; k < 4 + s * 2; k++) cyl(0.06, 0.06, 0.02, M.gold, 0.75 + s * 0.14, 0.8 + k * 0.022, 1.75, g, 16);
    // safe
    const safe = new THREE.Group(); safe.position.set(-4.0, 0, 1.2); safe.rotation.y = 0.9; g.add(safe);
    rbox(0.8, 0.95, 0.7, 0.04, std(0x30343e, 0.35, 0.8), 0, 0.48, 0, safe);
    box(0.7, 0.85, 0.02, std(0x3c414d, 0.3, 0.85), 0, 0.48, 0.355, safe);
    const dial = cyl(0.12, 0.12, 0.04, M.steel, 0.08, 0.55, 0.38, safe, 24); dial.rotation.x = Math.PI / 2;
    mesh(new THREE.TorusGeometry(0.13, 0.008, 4, 32), neon('#ffd23a', 2), 0.08, 0.55, 0.4, safe);
    box(0.04, 0.22, 0.05, M.gold, -0.22, 0.55, 0.39, safe);
    plant(g, 4.4, 0.9, 'monstera'); plant(g, -4.5, 2.6, 'snake');
    shelf(g, 4.2, 2.45, 0.9, 1.4, -Math.PI / 2 - 0.45, 'books');
    // hologram: growing 3D bar chart
    const anchor = projector(g, 2.85, 3.0, RAINBOW[2]);
    anchor.position.y -= 0.5;
    const chart = new THREE.Group(); anchor.add(chart);
    const bars = [];
    for (let i = 0; i < 5; i++) for (let k = 0; k < 3; k++) {
      const b = mesh(new THREE.BoxGeometry(0.11, 1, 0.11), holoMat(k === 1 ? '#ffd23a' : '#ffe9a0', k === 1 ? 0.55 : 0.3), -0.3 + i * 0.15, 0, -0.18 + k * 0.18, chart);
      b.geometry.translate(0, 0.5, 0); bars.push({ b, i, k });
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([0, 1, 2, 3, 4].map(i => V3(-0.3 + i * 0.15, 0, 0.32))), holoLine('#ffffff'));
    chart.add(line);
    onFrame((dt, t) => {
      const tt = REDUCED ? 0 : t;
      bars.forEach(({ b, i, k }) => { b.scale.y = 0.15 + (0.12 * i + 0.08 * k) * (1.2 + 0.25 * Math.sin(tt * 1.4 + i * 0.7 + k)); });
      const pos = line.geometry.attributes.position;
      for (let i = 0; i < 5; i++) pos.setY(i, 0.2 + 0.16 * i + 0.06 * Math.sin(tt * 1.4 + i));
      pos.needsUpdate = true;
      chart.rotation.y = Math.sin(tt * 0.3) * 0.6;
    });
  },
});

// ---- CTO --------------------------------------------------------------
makeRoom(4, {
  color: RAINBOW[3], floor: 'tile', light: 0xd8ffe9,
  spots: { work: SPOT(0, 3.3, Math.PI, 0.46), rest: SPOT(2.3, 1.45, Math.PI, 0), workVia: [], restVia: [[2.6, 3.9], [2.5, 1.9]] },
  build(g, room) {
    // the monitor wall
    const wallTex = liveScreen(1800, 560, 7, drawCTOWall);
    const mw = wallScreen(room.wall, 0, 1.78, 0.07, 6.6, 2.05, wallTex, M.black, 0.92);
    box(6.8, 0.03, 0.03, neon(RAINBOW[3], 1.8), 0, 0.72, 0.12, room.wall);
    box(6.8, 0.03, 0.03, neon(RAINBOW[3], 1.8), 0, 2.84, 0.12, room.wall);
    // status LEDs under the wall
    for (let i = 0; i < 24; i++) sph(0.025, neon(i % 7 === 3 ? '#ffd23a' : '#33e08a', 2.6), -3.2 + i * 0.278, 0.6, 0.1, room.wall, 6, 4);
    // server racks on both sides
    const ledGeo = new THREE.BoxGeometry(0.03, 0.012, 0.01);
    const ledCount = 6 * 26;
    const leds = new THREE.InstancedMesh(ledGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), ledCount);
    let li = 0;
    const ledColors = [new THREE.Color(0.2, 2.6, 0.9), new THREE.Color(0.2, 1.2, 2.6), new THREE.Color(2.6, 2.0, 0.2), new THREE.Color(0.05, 0.08, 0.06)];
    const m4 = new THREE.Matrix4();
    const rackSpots = [[-4.45, 0.5], [-4.1, 1.45], [-3.55, 2.35], [4.45, 0.5], [4.1, 1.45], [3.55, 2.35]];
    rackSpots.forEach(([x, z]) => {
      const r = new THREE.Group(); r.position.set(x, 0, z); r.rotation.y = Math.atan2(0 - x, 2.2 - z); g.add(r);
      rbox(0.62, 2.15, 0.8, 0.02, M.black, 0, 1.075, 0, r);
      box(0.56, 2.05, 0.02, std(0x10161a, 0.2, 0.6, { transparent: true, opacity: 0.85 }), 0, 1.075, 0.405, r);
      for (let u = 0; u < 13; u++) {
        box(0.52, 0.11, 0.02, M.graphite, 0, 0.2 + u * 0.145, 0.395, r);
        for (let k = 0; k < 2; k++) {
          r.updateMatrixWorld(true);
          m4.makeTranslation(-0.2 + k * 0.05, 0.2 + u * 0.145, 0.41);
          leds.setMatrixAt(li, m4.premultiply(new THREE.Matrix4().makeRotationY(r.rotation.y)).premultiply(new THREE.Matrix4().makeTranslation(x, 0, z)));
          leds.setColorAt(li, ledColors[(u + k) % 3]);
          li++;
        }
      }
      box(0.62, 0.03, 0.03, neon(RAINBOW[3], 2.4), 0, 2.16, 0.41, r);
      box(0.02, 2.1, 0.02, neon(RAINBOW[3], 1.6), -0.3, 1.075, 0.41, r);
    });
    leds.count = li;
    g.add(leds);
    let ledAcc = 0;
    onFrame((dt) => {
      ledAcc += dt; if (ledAcc < (REDUCED ? 2 : 0.12)) return; ledAcc = 0;
      for (let k = 0; k < 10; k++) { const i = Math.floor(Math.random() * li); leds.setColorAt(i, ledColors[Math.random() < 0.7 ? (Math.random() < 0.8 ? 0 : 1) : (Math.random() < 0.2 ? 2 : 3)]); }
      leds.instanceColor.needsUpdate = true;
    });
    // cable trays to the wall
    [-1, 1].forEach(s => {
      const tray = box(0.12, 0.02, 2.2, neon(RAINBOW[3], 0.9), s * 2.4, 0.04, 1.4, g); tray.rotation.y = s * 0.55;
    });
    // three-screen on-call desk facing the wall
    desk(g, 0, 2.55, 2.4, 0.8, 0, 'tech', RAINBOW[3]);
    chair(g, 0, 3.3, Math.PI, 0x14261c, true);
    const triTex = liveScreen(1536, 320, 5, (c, w, h, t) => {
      const pw = w / 3;
      drawLatency(c, 4, 4, pw - 8, h - 8, t);
      drawCode(c, pw + 4, 4, pw - 8, h - 8, t, 1.2, 16);
      drawTerminal(c, pw * 2 + 4, 4, pw - 8, h - 8, t, 16);
    });
    [-1, 0, 1].forEach(i => {
      monitor(g, i * 0.66, 2.4 - Math.abs(i) * 0.12, -i * 0.42, 0.62, 0.36, triTex, 0.79, [(i + 1) / 3, 0, 1 / 3, 1]);
    });
    // ON CALL sign
    const oc = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#04110a'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff3d5a'; c.font = `800 38px ${FONT}`; c.textBaseline = 'middle'; c.fillText('● ON CALL', 14, 34); });
    const ocm = mesh(new THREE.PlaneGeometry(0.42, 0.105), screenMat(oc, 1.6), 0.95, 0.86, 2.85, g); ocm.rotation.y = 0.2;
    cyl(0.045, 0.04, 0.1, std(0x33e08a, 0.4), -0.95, 0.84, 2.8, g, 12);
    // side table with the system topology hologram
    roundTable(g, -2.55, 3.05, 0.5, 0.74, M.black);
    const anchor = projector(g, -2.55, 3.05, RAINBOW[3], 0.77);
    anchor.position.y = 0.32;
    const topo = new THREE.Group(); anchor.add(topo);
    const nodes = [V3(0, 0.35, 0), V3(-0.38, 0.12, -0.1), V3(0.38, 0.12, -0.12), V3(-0.25, -0.12, 0.3), V3(0.28, -0.1, 0.3), V3(0, -0.25, -0.35), V3(-0.5, -0.2, -0.3), V3(0.5, -0.22, 0.05)];
    const labels = ['gateway', 'auth', 'api', 'queue', 'cache', 'db', 'search', 'cdn'];
    nodes.forEach((p, i) => {
      mesh(new THREE.OctahedronGeometry(i === 0 ? 0.07 : 0.05), holoMat(i === 5 ? '#2fa8ff' : RAINBOW[3], 1.2), p.x, p.y, p.z, topo);
    });
    const edges = [[0, 1], [0, 2], [2, 3], [2, 4], [3, 5], [4, 5], [1, 6], [0, 7], [2, 5], [6, 5]];
    const pulses = [];
    edges.forEach(([a, b]) => {
      topo.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([nodes[a], nodes[b]]), holoLine('#7dffb8', 0.7)));
      const d = sph(0.018, neon('#e8fff2', 3), 0, 0, 0, topo, 6, 4); pulses.push({ d, a: nodes[a], b: nodes[b], o: rand() });
    });
    const shell = mesh(new THREE.IcosahedronGeometry(0.62, 1), holoMat(RAINBOW[3], 0.08), 0, 0, 0, topo);
    const shellW = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.62, 1)), holoLine('#33e08a', 0.25)); topo.add(shellW);
    onFrame((dt, t) => { const k = REDUCED ? t * 0.1 : t; topo.rotation.y = k * 0.3; pulses.forEach(p => p.d.position.lerpVectors(p.a, p.b, (k * 0.6 + p.o) % 1)); });
    plant(g, 2.6, 4.4, 'snake'); plant(g, -1.3, 4.7, 'small');
    // beanbag for breaks
    const bb = sph(0.42, std(0x1f6b45, 0.9), 2.7, 0.25, 3.1, g, 20, 14); bb.scale.y = 0.6;
  },
});

// ---- CPO --------------------------------------------------------------
makeRoom(5, {
  color: RAINBOW[4], floor: 'concrete', light: 0xe2f0ff,
  spots: { work: SPOT(1.9, 1.45, 0, 0.46), rest: SPOT(-1.5, 1.05, Math.PI, 0), workVia: [[3.3, 3.2], [3.2, 1.45]], restVia: [[-0.6, 3.7], [-0.9, 1.4]] },
  build(g, room) {
    shelf(room.wall, -2.7, 0.3, 2.3, 2.4, 0, 'boxes');
    shelf(room.wall, 2.6, 0.3, 2.3, 2.4, 0, 'boxes');
    const bannerTex = canvasTex(512, 128, (c, w, h) => { c.fillStyle = '#071526'; c.fillRect(0, 0, w, h); c.fillStyle = '#2fa8ff'; c.font = `800 54px ${FONT}`; c.textBaseline = 'middle'; c.fillText('SUPPLY  ⇄', 30, 66); c.fillStyle = '#9fd0ff'; c.font = `500 26px ${FONT}`; c.fillText('47 POs · 12 in transit', 300, 68); });
    wallScreen(room.wall, 0, 2.3, 0.06, 1.7, 0.42, bannerTex, M.black, 1.2);
    desk(g, 1.9, 2.25, 1.6, 0.8, 0, 'white', RAINBOW[4]);
    chair(g, 1.9, 1.45, 0, 0x14263a, true);
    laptop(g, 1.9, 2.2, Math.PI, staticChart('#2fa8ff'));
    box(0.24, 0.03, 0.32, std(0x8a5a33, 0.7), 1.3, 0.8, 2.2, g);
    box(0.2, 0.01, 0.28, M.paper, 1.3, 0.82, 2.2, g);
    // pallet with crates
    const pal = new THREE.Group(); pal.position.set(-3.5, 0, 2.55); pal.rotation.y = 0.4; g.add(pal);
    for (let i = 0; i < 3; i++) box(1.2, 0.04, 0.12, M.lightWood, 0, 0.13, -0.4 + i * 0.4, pal);
    for (let i = 0; i < 3; i++) box(0.12, 0.1, 1.0, M.lightWood, -0.5 + i * 0.5, 0.05, 0, pal);
    const crate = std(0xc8a070, 0.85, 0);
    [[-0.28, 0.33, -0.22], [0.28, 0.33, -0.22], [-0.28, 0.33, 0.24], [0.28, 0.33, 0.24], [0, 0.73, 0]].forEach(([x, y, z]) => {
      rbox(0.5, 0.38, 0.42, 0.02, crate, x, y, z, pal);
      box(0.5, 0.06, 0.43, std(0x9a7a50, 0.8), x, y, z, pal);
    });
    box(0.2, 0.12, 0.005, M.paper, 0, 0.75, 0.215, pal);
    // hand truck
    const ht = new THREE.Group(); ht.position.set(3.7, 0, 1.7); ht.rotation.y = -1.2; g.add(ht);
    box(0.04, 1.2, 0.04, std(0x2fa8ff, 0.4, 0.5), -0.2, 0.62, 0, ht); box(0.04, 1.2, 0.04, std(0x2fa8ff, 0.4, 0.5), 0.2, 0.62, 0, ht);
    box(0.5, 0.04, 0.3, M.steel, 0, 0.04, 0.15, ht);
    [-1, 1].forEach(s => { const w = cyl(0.1, 0.1, 0.06, M.black, s * 0.26, 0.1, -0.05, ht, 16); w.rotation.z = Math.PI / 2; });
    rbox(0.4, 0.34, 0.3, 0.02, crate, 0, 0.24, 0.12, ht);
    plant(g, 4.5, 2.6, 'tree'); plant(g, -1.6, 4.6, 'small');
    // hologram: package with orbiting supply nodes
    const anchor = projector(g, -0.6, 2.95, RAINBOW[4]);
    const pkg = new THREE.Group(); anchor.add(pkg);
    mesh(new THREE.BoxGeometry(0.42, 0.32, 0.42), holoMat(RAINBOW[4], 0.25), 0, 0, 0, pkg);
    pkg.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.42, 0.32, 0.42)), holoLine('#9fd8ff')));
    pkg.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.06, 0.33, 0.43)), holoLine('#9fd8ff')));
    const orbits = [];
    for (let i = 0; i < 3; i++) {
      const o = new THREE.Group(); o.rotation.set(rr(-0.6, 0.6), 0, rr(-0.6, 0.6)); anchor.add(o);
      const r = 0.55 + i * 0.12;
      o.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.EllipseCurve(0, 0, r, r).getPoints(64).map(p => V3(p.x, 0, p.y))), holoLine('#2fa8ff', 0.5)));
      const n = mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), holoMat('#c8ecff', 1.2), r, 0, 0, o);
      orbits.push({ o, sp: 0.4 + i * 0.25 });
    }
    onFrame((dt, t) => { const k = REDUCED ? t * 0.1 : t; pkg.rotation.y = k * 0.5; pkg.position.y = Math.sin(k * 1.2) * 0.05; orbits.forEach(o => { o.o.rotation.y = k * o.sp; }); });
  },
});

// ---- CMO --------------------------------------------------------------
makeRoom(6, {
  color: RAINBOW[5], floor: 'carpet', light: 0xeee8ff,
  spots: { work: SPOT(2.4, 1.25, 0, 0.46), rest: SPOT(-1.25, 3.45, 0.4, 0.3), workVia: [[3.45, 3.0], [3.45, 1.25]], restVia: [[-0.4, 3.9]] },
  build(g, room) {
    wallScreen(room.wall, 0, 1.6, 0.06, 6.2, 1.9, canvasTex(1400, 440, drawCampaign), M.black, 1.0);
    desk(g, 2.4, 2.05, 1.6, 0.8, 0, 'white', RAINBOW[5]);
    chair(g, 2.4, 1.25, 0, 0x26214a, true);
    monitor(g, 2.4, 2.2, Math.PI, 0.8, 0.46, canvasTex(512, 300, (c, w, h) => { drawCampaign(c, w, h); }));
    // ring light & camera
    const rl = new THREE.Group(); rl.position.set(-3.4, 0, 1.6); rl.rotation.y = 0.9; g.add(rl);
    cyl(0.012, 0.012, 1.5, M.steel, 0, 0.75, 0, rl, 6);
    [0, 1, 2].forEach(i => { const l = box(0.02, 0.02, 0.4, M.steel, 0, 0.04, 0, rl); l.rotation.y = i * TAU / 3; l.translateZ(0.2); l.rotation.x = 0.2; });
    mesh(new THREE.TorusGeometry(0.32, 0.03, 10, 48), neon('#ffffff', 2.4), 0, 1.6, 0, rl);
    const cam = new THREE.Group(); cam.position.set(-2.4, 0, 2.6); cam.rotation.y = -2.2; g.add(cam);
    [0, 1, 2].forEach(i => { const l = cyl(0.01, 0.012, 1.3, M.black, 0, 0.62, 0, cam, 6); l.rotation.z = 0.25; l.rotation.y = i * TAU / 3; });
    rbox(0.22, 0.15, 0.12, 0.02, M.black, 0, 1.3, 0, cam);
    const lens = cyl(0.05, 0.05, 0.12, M.black, 0, 1.3, 0.11, cam, 16); lens.rotation.x = Math.PI / 2;
    sph(0.012, neon('#ff3d5a', 3), 0.08, 1.37, 0.06, cam, 6, 4);
    // bean bags
    [[-1.25, 3.45, 0xff5fa8], [0.2, 3.95, 0xffd23a], [-0.05, 2.7, 0x2fa8ff]].forEach(([x, z, c]) => { const b = sph(0.45, std(c, 0.9), x, 0.24, z, g, 20, 14); b.scale.set(1, 0.55, 1); });
    plant(g, 4.5, 2.5, 'monstera', 1.1); plant(g, -4.5, 0.8, 'snake');
    // hologram: funnel with rising hearts
    const anchor = projector(g, -1.1, 1.55, RAINBOW[5]);
    const fun = new THREE.Group(); anchor.add(fun);
    for (let i = 0; i < 5; i++) {
      const r = 0.55 - i * 0.1;
      const ring = mesh(new THREE.TorusGeometry(r, 0.012, 6, 60), holoMat(i % 2 ? '#a99bff' : RAINBOW[5], 1.1), 0, 0.3 - i * 0.14, 0, fun); ring.rotation.x = Math.PI / 2;
    }
    mesh(new THREE.CylinderGeometry(0.55, 0.12, 0.6, 40, 1, true), holoMat(RAINBOW[5], 0.14), 0, 0.02, 0, fun);
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, -0.05); heartShape.bezierCurveTo(0.12, 0.05, 0.06, 0.14, 0, 0.07); heartShape.bezierCurveTo(-0.06, 0.14, -0.12, 0.05, 0, -0.05);
    const hg = new THREE.ShapeGeometry(heartShape);
    const hearts = [];
    for (let i = 0; i < 7; i++) { const h = mesh(hg, holoMat(i % 2 ? '#ff5fa8' : '#c9b8ff', 1.4, 0), 0, 0, 0, anchor); h.userData.o = i / 7; hearts.push(h); }
    onFrame((dt, t) => {
      const k = REDUCED ? t * 0.1 : t;
      fun.rotation.y = k * 0.5;
      hearts.forEach((h, i) => { const p = (k * 0.18 + h.userData.o) % 1; const a = i * 0.9 + k * 0.6; h.position.set(Math.sin(a) * 0.65, -0.2 + p * 1.1, Math.cos(a) * 0.65); h.scale.setScalar(0.6 + Math.sin(p * Math.PI) * 0.9); h.lookAt(camera.position); });
    });
  },
});

// ---- CHRO -------------------------------------------------------------
makeRoom(7, {
  color: RAINBOW[6], floor: 'carpet', light: 0xffeef6,
  spots: { work: SPOT(2.3, 0.88, 0, 0.46), rest: SPOT(-1.5, 2.15, -Math.PI / 2, 0.46), workVia: [[3.55, 2.9], [3.5, 0.88]], restVia: [[-0.4, 3.6], [-0.9, 2.6]] },
  build(g, room) {
    wallScreen(room.wall, -1.3, 1.6, 0.06, 3.6, 1.6, canvasTex(900, 400, drawBulletin), M.lightWood, 0.7);
    desk(g, 2.3, 1.62, 1.5, 0.75, 0, 'white', RAINBOW[6]);
    chair(g, 2.3, 0.88, 0, 0x3a2450, true);
    laptop(g, 2.3, 1.6, Math.PI, staticChart('#b05cff'));
    plant(g, 3.0, 1.75, 'small', 0.6).position.y = 0.78;
    // meeting table with tea
    roundTable(g, -2.4, 2.15, 0.7, 0.74, M.lightWood);
    [[-1.5, 2.15, -Math.PI / 2], [-3.3, 2.15, Math.PI / 2], [-2.4, 3.05, Math.PI], [-2.4, 1.25, 0]].forEach(([x, z, r]) => chair(g, x, z, r, 0xd9c8f0));
    cyl(0.1, 0.08, 0.14, M.white, -2.4, 0.84, 2.15, g, 16);
    [[-2.1, 2.0], [-2.7, 2.3], [-2.35, 2.5]].forEach(([x, z]) => cyl(0.04, 0.035, 0.07, M.white, x, 0.8, z, g, 12));
    // sofa
    sofa(g, 0.6, 4.25, 1.6, Math.PI, 0xb89adc);
    // lots of plants
    plant(g, -4.5, 0.8, 'monstera', 1.15); plant(g, 4.55, 0.8, 'tree'); plant(g, -4.2, 3.0, 'snake'); plant(g, 4.0, 3.2, 'small', 1.2); plant(g, -1.0, 4.9, 'small');
    // hologram: org chart tree + heart
    const anchor = projector(g, 0.9, 2.6, RAINBOW[6]);
    const org = new THREE.Group(); anchor.add(org);
    const person = (x, y, z, c) => { const p = new THREE.Group(); p.position.set(x, y, z); org.add(p); sph(0.045, holoMat(c, 1.3), 0, 0.06, 0, p, 10, 8); const b = sph(0.065, holoMat(c, 1), 0, -0.04, 0, p, 10, 8); b.scale.y = 0.7; return p; };
    const lv = [[V3(0, 0.45, 0)], [V3(-0.35, 0.12, 0), V3(0.35, 0.12, 0)], [V3(-0.55, -0.22, 0), V3(-0.18, -0.22, 0), V3(0.18, -0.22, 0), V3(0.55, -0.22, 0)]];
    lv.flat().forEach((p, i) => person(p.x, p.y, p.z, RAINBOW[i % 7]));
    [[0, 0, 1, 0], [0, 0, 1, 1], [1, 0, 2, 0], [1, 0, 2, 1], [1, 1, 2, 2], [1, 1, 2, 3]].forEach(([l1, i1, l2, i2]) => {
      const a = lv[l1][i1], b = lv[l2][i2];
      org.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.clone().add(V3(0, -0.08, 0)), V3(a.x, (a.y + b.y) / 2, 0), V3(b.x, (a.y + b.y) / 2, 0), b.clone().add(V3(0, 0.1, 0))]), holoLine('#d9b8ff', 0.7)));
    });
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, -0.12); heartShape.bezierCurveTo(0.3, 0.12, 0.15, 0.35, 0, 0.18); heartShape.bezierCurveTo(-0.15, 0.35, -0.3, 0.12, 0, -0.12);
    const heart = mesh(new THREE.ExtrudeGeometry(heartShape, { depth: 0.04, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 }), holoMat('#ff8fc8', 0.8), 0, 0.75, 0, anchor);
    heart.geometry.center();
    onFrame((dt, t) => { const k = REDUCED ? t * 0.1 : t; org.rotation.y = Math.sin(k * 0.4) * 0.8; heart.rotation.y = k; heart.scale.setScalar(1 + Math.max(0, Math.sin(k * 3)) * 0.12); });
  },
});

// door opening: anyone close to a door makes it slide open
const doorUsers = [];   // filled with character positions each frame
onFrame((dt) => {
  for (const room of rooms) {
    if (!room) continue;
    const d0 = room._doorPos || (room._doorPos = room.local(0, ROOM_RAD));
    let near = false;
    for (const p of doorUsers) { if (Math.hypot(p.x - d0.x, p.z - d0.z) < 1.7) { near = true; break; } }
    room.doors.open = damp(room.doors.open, near ? 1 : 0, 7, dt);
    room.doors.list.forEach(d => { d.position.x = d.userData.s * (DOOR_HALF / 2 + room.doors.open * (DOOR_HALF - 0.08)); });
  }
});
