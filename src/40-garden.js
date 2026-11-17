// =============================================================================
//  The garden ring: grass, cherry trees, maples, bamboo, koi pond, karesansui,
//  stone lanterns and fireflies. The side nearest the camera stays low.
// =============================================================================
const GARDEN_PATH_R = 30.5;
const NEAR_HALF = THREE.MathUtils.degToRad(64);
const isNear = a => Math.abs(angleDiff(0, a)) < NEAR_HALF;
const deg = THREE.MathUtils.degToRad;
const gardenUniforms = { uTime: { value: 0 } };
onFrame((dt, t) => { gardenUniforms.uTime.value = REDUCED ? 0 : t; });

const POND = { a: deg(90), r: GARDEN_PATH_R, rad: 4.4 };
const ZEN = { a: deg(270), r: 31.4, rad: 4.6 };
POND.p = polar(POND.r, POND.a); ZEN.p = polar(ZEN.r, ZEN.a);
const features = [POND, ZEN];
const midAngles = [0, 1, 2, 3, 4, 5, 6, 7].map(k => slotAngle(k) + Math.PI / 8);

function gardenFree(x, z, rad = 0.5) {
  const r = Math.hypot(x, z), a = Math.atan2(x, z);
  if (r < FLOOR_R + 0.4 + rad || r > GARDEN_R - 0.6 - rad) return false;
  if (Math.abs(r - GARDEN_PATH_R) < 1.0 + rad) return false;
  for (const m of midAngles) if (Math.abs(angleDiff(a, m)) * r < 1.0 + rad && r < GARDEN_PATH_R + 1) return false;
  for (const f of features) if (Math.hypot(x - f.p.x, z - f.p.z) < f.rad + 0.6 + rad) return false;
  return true;
}
function gardenPoint(a0, a1, r0, r1, rad, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const a = rr(a0, a1), r = rr(r0, r1);
    const p = polar(r, a);
    if (gardenFree(p.x, p.z, rad)) return p;
  }
  return null;
}
function swayMaterial(mat, amount = 0.06, speed = 1.2) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = gardenUniforms.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
          float h = max(position.y, 0.0);
          float sw = sin(uTime * ${speed.toFixed(2)} + ip.x * 0.35 + ip.z * 0.27);
          transformed.x += sw * ${amount.toFixed(3)} * (0.5 + h);
          transformed.z += cos(uTime * ${(speed * 0.8).toFixed(2)} + ip.z * 0.31) * ${(amount * 0.6).toFixed(3)} * (0.5 + h);
        #endif`);
  };
  return mat;
}
function instanced(geo, mat, list, colorFn) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  list.forEach((it, i) => {
    e.set(it.rx || 0, it.ry || 0, it.rz || 0);
    q.setFromEuler(e);
    m4.compose(it.p, q, it.s instanceof THREE.Vector3 ? it.s : V3(it.s, it.s, it.s));
    im.setMatrixAt(i, m4);
    if (colorFn) im.setColorAt(i, colorFn(it, i));
  });
  im.count = list.length;
  scene.add(im);
  return im;
}

// ---------------------------------------------------------- ground --------
{
  const blot = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = rand() * w, y = rand() * h, r = rr(10, 46), v = rand() < 0.5 ? 0 : 255, a = rr(0.04, 0.12);
      for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gr.addColorStop(0, `rgba(${v},${v},${v},${a})`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
        g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }, { repeat: true });
  blot.colorSpace = THREE.NoColorSpace;
  const mat = new THREE.MeshStandardMaterial({ color: 0x1b3a26, roughness: 0.95, metalness: 0 });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uBlot = { value: blot };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWP; uniform sampler2D uBlot;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float nz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(hh(i), hh(i+vec2(1,0)), f.x), mix(hh(i+vec2(0,1)), hh(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        { float n = texture2D(uBlot, vWP.xz / 16.).r * .65 + texture2D(uBlot, vWP.xz / 5.3 + .37).r * .35;
          diffuseColor.rgb *= mix(0.62, 1.38, n); }`);
  };
  const ground = new THREE.Mesh(new THREE.RingGeometry(FLOOR_R - 0.2, GARDEN_R + 0.05, 200, 6), mat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = GARDEN_Y;
  scene.add(ground);
}

// ---------------------------------------------------------- paths ---------
{
  const stones = [];
  const N = 150;
  for (let i = 0; i < N; i++) {
    const a = i / N * TAU + rr(-0.004, 0.004);
    const p = polar(GARDEN_PATH_R + rr(-0.15, 0.15), a, GARDEN_Y + 0.02);
    if (Math.hypot(p.x - POND.p.x, p.z - POND.p.z) < POND.rad + 0.3) continue;
    stones.push({ p, s: V3(rr(0.42, 0.55), 1, rr(0.34, 0.44)), ry: a + rr(-0.3, 0.3) });
  }
  midAngles.forEach(m => {
    for (let r = FLOOR_R + 0.7; r < GARDEN_PATH_R - 0.6; r += 0.95) stones.push({ p: polar(r, m + rr(-0.01, 0.01), GARDEN_Y + 0.02), s: V3(rr(0.45, 0.6), 1, rr(0.35, 0.45)), ry: m + rr(-0.4, 0.4) });
  });
  const geo = new THREE.CylinderGeometry(1, 1, 0.06, 9);
  instanced(geo, std(0x8d93a3, 0.85, 0.05), stones, () => new THREE.Color().setHSL(0.62, 0.06, rr(0.42, 0.6)));
}

// ---------------------------------------------------------- koi pond ------
const koi = [];
{
  const { p, rad } = POND;
  const pondU = { uTime: gardenUniforms.uTime };
  const water = new THREE.Mesh(new THREE.CircleGeometry(rad, 72), new THREE.ShaderMaterial({
    transparent: true, uniforms: pondU,
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uTime; varying vec2 vP;
      void main(){ float r = length(vP);
        float w = sin(vP.x * 2.3 + uTime * .8) * sin(vP.y * 2.9 - uTime * .6) * .5 + .5;
        vec3 c = mix(vec3(.01,.05,.08), vec3(.03,.12,.17), smoothstep(${rad.toFixed(1)}, 0., r));
        c += vec3(.25,.45,.6) * pow(w, 10.) * .35;
        c += vec3(1.,.75,.4) * exp(-pow(length(vP - vec2(2.6, -2.2)), 2.) * .6) * .25;
        gl_FragColor = vec4(c, .82); }`,
  }));
  water.rotation.x = -Math.PI / 2; water.position.set(p.x, GARDEN_Y + 0.02, p.z);
  scene.add(water);
  // pond floor so the koi read through the water
  const bed = new THREE.Mesh(new THREE.CircleGeometry(rad, 48), std(0x0c1a1e, 0.9));
  bed.rotation.x = -Math.PI / 2; bed.position.set(p.x, GARDEN_Y - 0.35, p.z);
  scene.add(bed);
  // edge rocks
  const rocks = [];
  for (let i = 0; i < 46; i++) {
    const a = i / 46 * TAU;
    rocks.push({ p: V3(p.x + Math.sin(a) * (rad + rr(0.05, 0.3)), GARDEN_Y + 0.05, p.z + Math.cos(a) * (rad + rr(0.05, 0.3))), s: V3(rr(0.35, 0.6), rr(0.22, 0.38), rr(0.3, 0.5)), ry: rand() * 3 });
  }
  instanced(new THREE.DodecahedronGeometry(1, 0), std(0x6f7585, 0.9, 0.05), rocks, () => new THREE.Color().setHSL(0.6, 0.05, rr(0.3, 0.5)));
  // lily pads and lotus
  const padGeo = new THREE.CircleGeometry(0.32, 20, 0.3, TAU - 0.3); padGeo.rotateX(-Math.PI / 2);
  const pads = [];
  for (let i = 0; i < 9; i++) { const a = rand() * TAU, r = rr(1.5, rad - 0.6); pads.push({ p: V3(p.x + Math.sin(a) * r, GARDEN_Y + 0.035, p.z + Math.cos(a) * r), s: rr(0.7, 1.2), ry: rand() * TAU }); }
  instanced(padGeo, std(0x2f8a4a, 0.7, 0, { side: THREE.DoubleSide }), pads, () => new THREE.Color().setHSL(0.36, 0.5, rr(0.25, 0.38)));
  pads.slice(0, 4).forEach(pd => {
    const lotus = new THREE.Group(); lotus.position.copy(pd.p).add(V3(0.05, 0.04, 0)); scene.add(lotus);
    for (let k = 0; k < 8; k++) { const pe = sph(0.07, std(0xffb7d5, 0.6, 0, { emissive: new THREE.Color(0xff6fa8), emissiveIntensity: 0.35 }), 0, 0.05, 0, lotus, 8, 6); pe.scale.set(0.5, 1, 0.3); pe.rotation.set(0.6, k * TAU / 8, 0); pe.translateY(0.04); }
    sph(0.04, neon('#ffe38a', 1.6), 0, 0.07, 0, lotus, 8, 6);
  });
  // arched bridge
  const br = new THREE.Group();
  br.position.set(p.x, GARDEN_Y, p.z); br.rotation.y = POND.a + Math.PI / 2; scene.add(br);
  const arch = new THREE.CatmullRomCurve3([V3(0, 0.05, -rad - 0.8), V3(0, 0.55, -rad * 0.4), V3(0, 0.7, 0), V3(0, 0.55, rad * 0.4), V3(0, 0.05, rad + 0.8)]);
  const red = std(0xc8303a, 0.6, 0.1, { emissive: new THREE.Color(0x5a0a10), emissiveIntensity: 0.3 });
  for (let i = 0; i <= 26; i++) {
    const t = i / 26, q = arch.getPoint(t), tan = arch.getTangent(t);
    const plank = box(1.25, 0.05, 0.36, std(0x6a4a34, 0.8), q.x, q.y, q.z, br);
    plank.rotation.x = -Math.atan2(tan.y, tan.z);
  }
  [-1, 1].forEach(s => {
    const rail = new THREE.CatmullRomCurve3(arch.points.map(v => V3(s * 0.62, v.y + 0.45, v.z)));
    mesh(new THREE.TubeGeometry(rail, 40, 0.035, 6), red, 0, 0, 0, br);
    for (let i = 0; i <= 8; i++) { const q = arch.getPoint(i / 8); box(0.06, 0.48, 0.06, red, s * 0.62, q.y + 0.22, q.z, br); }
    [arch.getPoint(0.02), arch.getPoint(0.98)].forEach(q => sph(0.07, neon('#ffc77a', 1.8), s * 0.62, q.y + 0.72, q.z, br, 10, 8));
  });
  // koi
  const koiBody = new THREE.SphereGeometry(0.16, 16, 10); koiBody.scale(0.55, 0.42, 1.25);
  const finGeo = new THREE.ConeGeometry(0.12, 0.22, 4); finGeo.rotateX(-Math.PI / 2); finGeo.scale(1, 0.25, 1);
  const koiCols = [[0xff7a2b, 0xffffff], [0xffffff, 0xff3d3d], [0xffb21e, 0xffe3a0], [0x1a1a22, 0xff7a2b], [0xff5a1e, 0xffffff], [0xffffff, 0x111111], [0xffa040, 0xffa040], [0xf2f2f2, 0xff4040]];
  koiCols.forEach(([c1, c2], i) => {
    const f = new THREE.Group(); scene.add(f);
    const body = mesh(koiBody, std(c1, 0.35, 0.1, { emissive: new THREE.Color(c1), emissiveIntensity: 0.25 }), 0, 0, 0, f);
    const spot = sph(0.09, std(c2, 0.4, 0, { emissive: new THREE.Color(c2), emissiveIntensity: 0.2 }), 0, 0.04, 0.03, f, 10, 8); spot.scale.set(0.8, 0.5, 1.4);
    const tail = new THREE.Group(); tail.position.z = -0.2; f.add(tail);
    mesh(finGeo, std(c1, 0.5, 0, { transparent: true, opacity: 0.85 }), 0, 0, -0.1, tail);
    const orbit = { r: rr(1.2, rad - 0.8), sp: rr(0.18, 0.32) * (i % 2 ? 1 : -1), ph: rand() * TAU, wob: rand() * 10, depth: rr(0.08, 0.2) };
    koi.push({ f, tail, orbit });
  });
  onFrame((dt, t) => {
    const tt = REDUCED ? t * 0.3 : t;
    koi.forEach(k => {
      const o = k.orbit, a = o.ph + tt * o.sp;
      const r = o.r + Math.sin(tt * 0.3 + o.wob) * 0.5;
      const x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
      const nx = p.x + Math.sin(a + 0.05 * Math.sign(o.sp)) * r, nz = p.z + Math.cos(a + 0.05 * Math.sign(o.sp)) * r;
      k.f.position.set(x, GARDEN_Y - o.depth, z);
      k.f.lookAt(nx, GARDEN_Y - o.depth, nz);
      k.tail.rotation.y = Math.sin(tt * 6 + o.wob) * 0.5;
    });
  });
}

// ---------------------------------------------------------- karesansui ----
{
  const { p, rad } = ZEN;
  const rocksAt = [V3(-1.2, 0, 0.6), V3(1.4, 0, -0.4), V3(0.3, 0, 1.9)];
  const gravel = new THREE.Mesh(new THREE.CircleGeometry(rad, 96), new THREE.ShaderMaterial({
    uniforms: { uR: { value: rocksAt.map(v => new THREE.Vector2(v.x, -v.z)) } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform vec2 uR[3]; varying vec2 vP;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        float d = 1e3; for (int i = 0; i < 3; i++) d = min(d, length(vP - uR[i]) - 0.55);
        float lines = d < 1.6 ? sin(d * 22.) : sin(vP.x * 22. + sin(vP.y * .8) * 1.5);
        float g = .5 + .5 * lines;
        vec3 c = mix(vec3(.42,.44,.5), vec3(.7,.72,.78), g);
        c *= .85 + hh(floor(vP * 60.)) * .25;
        c *= smoothstep(${rad.toFixed(1)}, ${(rad - 0.3).toFixed(1)}, length(vP));
        gl_FragColor = vec4(c * .55, 1.);
        #include <colorspace_fragment>
      }`,
  }));
  gravel.rotation.x = -Math.PI / 2; gravel.rotation.z = ZEN.a;
  gravel.position.set(p.x, GARDEN_Y + 0.015, p.z);
  scene.add(gravel);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.08, 6, 96), std(0x4a4e58, 0.8));
  frame.rotation.x = Math.PI / 2; frame.position.set(p.x, GARDEN_Y + 0.05, p.z); scene.add(frame);
  const grp = new THREE.Group(); grp.position.set(p.x, GARDEN_Y, p.z); grp.rotation.y = ZEN.a; scene.add(grp);
  const rockMat = std(0x5d6170, 0.9, 0.05), moss = std(0x2f6b3a, 1, 0);
  rocksAt.forEach((v, i) => {
    const r = mesh(new THREE.DodecahedronGeometry(0.55 - i * 0.08, 1), rockMat, v.x, 0.25, v.z, grp);
    r.scale.set(1.1, 0.75 + i * 0.15, 0.9); r.rotation.set(rand(), rand(), rand());
    const m = mesh(new THREE.CircleGeometry(0.75 - i * 0.08, 24), moss, v.x, 0.02, v.z, grp); m.rotation.x = -Math.PI / 2;
  });
}

// ---------------------------------------------------------- trees ---------
const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
const blossomList = [], mapleList = [], trunkList = [], petalsAt = [];
function tree(p, kind, scale = 1) {
  const s = scale;
  const h = (kind === 'cherry' ? 2.6 : 3.0) * s;
  const lean = rr(-0.12, 0.12);
  trunkList.push({ p: p.clone().setY(GARDEN_Y + h / 2), s: V3(0.16 * s, h, 0.16 * s), rz: lean, ry: rand() * 3 });
  const top = p.clone().setY(GARDEN_Y + h).add(V3(Math.sin(lean) * -h * 0.5, 0, 0));
  // branches
  for (let i = 0; i < 3; i++) {
    const a = rand() * TAU;
    trunkList.push({ p: top.clone().add(V3(Math.sin(a) * 0.45 * s, -0.25 * s, Math.cos(a) * 0.45 * s)), s: V3(0.07 * s, 1.2 * s, 0.07 * s), rx: Math.cos(a) * 0.8, rz: -Math.sin(a) * 0.8 });
  }
  const list = kind === 'cherry' ? blossomList : mapleList;
  const n = kind === 'cherry' ? 22 : 18;
  for (let i = 0; i < n; i++) {
    const dir = new THREE.Vector3().randomDirection(); dir.y = Math.abs(dir.y) * 0.7 - 0.1;
    list.push({ p: top.clone().add(dir.multiplyScalar(rr(0.3, 1.25) * s)).add(V3(0, 0.25 * s, 0)), s: rr(0.42, 0.72) * s, ry: rand() * 3, kind });
  }
  if (kind === 'cherry') petalsAt.push(top);
}
{
  const cherryZones = [[deg(112), deg(165)], [deg(195), deg(248)]];
  cherryZones.forEach(([a0, a1]) => {
    for (let i = 0; i < 6; i++) { const p = gardenPoint(a0, a1, 25.5, 38, 1.6); if (p) tree(p, 'cherry', rr(1.0, 1.35)); }
  });
  const mapleZones = [[deg(68), deg(84)], [deg(98), deg(112)], [deg(250), deg(262)], [deg(278), deg(296)]];
  mapleZones.forEach(([a0, a1]) => {
    for (let i = 0; i < 2; i++) { const p = gardenPoint(a0, a1, 25.5, 38.5, 1.4); if (p) tree(p, 'maple', rr(0.9, 1.15)); }
  });
  instanced(new THREE.CylinderGeometry(0.6, 1, 1, 7), std(0x3a2a22, 0.9, 0), trunkList);
  const blossomMat = swayMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, emissive: new THREE.Color(0xff5c9a), emissiveIntensity: 0.22, flatShading: true }), 0.03, 0.9);
  instanced(canopyGeo, blossomMat, blossomList, () => new THREE.Color().setHSL(rr(0.92, 0.97), rr(0.6, 0.85), rr(0.72, 0.86)));
  const mapleMat = swayMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, emissive: new THREE.Color(0xff3010), emissiveIntensity: 0.16, flatShading: true }), 0.03, 0.9);
  instanced(canopyGeo, mapleMat, mapleList, () => new THREE.Color().setHSL(rr(0.0, 0.07), rr(0.75, 0.95), rr(0.38, 0.52)));
}

// petals drifting under the cherry trees
{
  const N = Math.min(260, petalsAt.length * 28);
  const g = new THREE.BufferGeometry();
  const base = new Float32Array(N * 3), seed = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const t = petalsAt[i % petalsAt.length];
    base.set([t.x + rr(-1.5, 1.5), t.y + rr(0, 1), t.z + rr(-1.5, 1.5)], i * 3);
    seed.set([rand(), rand(), rand()], i * 3);
  }
  g.setAttribute('position', new THREE.BufferAttribute(base, 3));
  g.setAttribute('aS', new THREE.BufferAttribute(seed, 3));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: gardenUniforms.uTime, uPR: { value: renderer.getPixelRatio() }, uG: { value: GARDEN_Y } },
    vertexShader: `attribute vec3 aS; uniform float uTime, uPR, uG; varying float vA;
      void main(){ float t = fract(aS.x + uTime * (0.05 + aS.y * 0.05));
        vec3 p = position; float fall = t * (p.y - uG);
        p.y -= fall; p.x += sin(uTime * .7 + aS.z * 20.) * .6 * t + t * 1.2; p.z += cos(uTime * .5 + aS.y * 9.) * .5 * t;
        vec4 mv = modelViewMatrix * vec4(p,1.); gl_Position = projectionMatrix * mv;
        vA = smoothstep(0., .1, t) * smoothstep(1., .85, t); gl_PointSize = (2. + aS.z * 2.) * uPR * (60. / -mv.z); }`,
    fragmentShader: `varying float vA; void main(){ vec2 q = gl_PointCoord - .5; float d = length(q * vec2(1., 1.8));
      float a = smoothstep(.5, .3, d) * vA; gl_FragColor = vec4(vec3(1., .75, .86) * a * 1.3, a); }`,
  }));
  pts.frustumCulled = false;
  scene.add(pts);
}

// ---------------------------------------------------------- bamboo --------
{
  const culms = [], leaves = [];
  for (let i = 0; i < 150; i++) {
    const p = gardenPoint(deg(160), deg(200), 25.3, 39, 0.12, 20);
    if (!p) continue;
    const h = rr(5, 8.5);
    culms.push({ p: p.clone().setY(GARDEN_Y + h / 2), s: V3(1, h, 1), rx: rr(-0.05, 0.05), rz: rr(-0.05, 0.05) });
    for (let k = 0; k < 4; k++) leaves.push({ p: p.clone().setY(GARDEN_Y + h * rr(0.6, 1.0)).add(V3(rr(-0.5, 0.5), 0, rr(-0.5, 0.5))), s: V3(rr(0.5, 0.9), 0.06, rr(0.15, 0.25)), ry: rand() * TAU, rz: rr(-0.4, 0.4) });
  }
  const cg = new THREE.CylinderGeometry(0.065, 0.075, 1, 7, 6);
  const cm = swayMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), 0.02, 0.7);
  instanced(cg, cm, culms, () => new THREE.Color().setHSL(rr(0.24, 0.3), 0.55, rr(0.3, 0.42)));
  // nodes
  const nodes = [];
  culms.forEach(c => { for (let y = 0.6; y < c.s.y; y += rr(0.6, 0.9)) nodes.push({ p: V3(c.p.x, GARDEN_Y + y, c.p.z), s: V3(0.085, 0.03, 0.085) }); });
  instanced(new THREE.CylinderGeometry(1, 1, 1, 7), std(0x7a9a3a, 0.6), nodes);
  const lg = new THREE.SphereGeometry(1, 6, 4);
  instanced(lg, swayMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: new THREE.Color(0x1a4a20), emissiveIntensity: 0.3 }), 0.05, 1.1), leaves, () => new THREE.Color().setHSL(rr(0.25, 0.32), 0.6, rr(0.28, 0.4)));
}

// ---------------------------------------------------------- low plants ----
{
  const tufts = [], flowers = [], shrubs = [];
  const flowerCols = ['#ff9ec7', '#ffffff', '#b9a4ff', '#ffd76a', '#ff6f91', '#8fd3ff'].map(c => new THREE.Color(c));
  for (let i = 0; i < (IS_MOBILE ? 500 : 800); i++) {
    const a = rand() * TAU, r = rr(FLOOR_R + 0.3, GARDEN_R - 0.5);
    const p = polar(r, a, GARDEN_Y);
    if (!gardenFree(p.x, p.z, 0)) continue;
    tufts.push({ p, s: V3(rr(0.06, 0.1), rr(0.18, 0.36), rr(0.06, 0.1)), ry: rand() * 3, rx: rr(-0.2, 0.2), rz: rr(-0.2, 0.2) });
  }
  // flower beds: dense on the near side, sprinkled elsewhere
  for (let b = 0; b < 26; b++) {
    const near = b < 18;
    const c = near ? gardenPoint(-NEAR_HALF, NEAR_HALF, FLOOR_R + 1.0, GARDEN_R - 1.2, 0.8) : gardenPoint(0, TAU, FLOOR_R + 1, GARDEN_R - 1.2, 0.8);
    if (!c) continue;
    const col = flowerCols[b % flowerCols.length];
    const n = near ? 60 : 30;
    for (let i = 0; i < n; i++) {
      const p = c.clone().add(V3(rr(-1.3, 1.3), 0, rr(-1.0, 1.0)));
      if (!gardenFree(p.x, p.z, 0)) continue;
      const h = rr(0.12, 0.38);
      flowers.push({ p: p.setY(GARDEN_Y + h), s: rr(0.05, 0.085), col: rand() < 0.2 ? flowerCols[(b + 2) % flowerCols.length] : col });
      tufts.push({ p: p.clone().setY(GARDEN_Y), s: V3(0.05, h, 0.05), ry: rand() * 3 });
    }
  }
  // low rounded shrubs (near side included: they stay under knee height)
  for (let i = 0; i < 46; i++) {
    const near = i < 18;
    const p = near ? gardenPoint(-NEAR_HALF, NEAR_HALF, FLOOR_R + 0.8, GARDEN_R - 0.9, 0.5) : gardenPoint(0, TAU, FLOOR_R + 0.8, GARDEN_R - 0.9, 0.5);
    if (!p) continue;
    const s = near ? rr(0.28, 0.48) : rr(0.4, 0.85);
    shrubs.push({ p: p.setY(GARDEN_Y + s * 0.4), s: V3(s * rr(1, 1.4), s * 0.75, s * rr(1, 1.3)), ry: rand() * 3 });
  }
  const tuftGeo = new THREE.ConeGeometry(1, 1, 3); tuftGeo.translate(0, 0.5, 0);
  instanced(tuftGeo, swayMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), 0.08, 1.6), tufts, () => new THREE.Color().setHSL(rr(0.27, 0.36), rr(0.35, 0.5), rr(0.16, 0.26)));
  instanced(new THREE.IcosahedronGeometry(1, 0), swayMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.12 }), 0.03, 1.6), flowers, it => it.col);
  instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), shrubs, () => new THREE.Color().setHSL(rr(0.26, 0.4), rr(0.3, 0.5), rr(0.1, 0.2)));
}

// ---------------------------------------------------------- lanterns ------
const lanternSpots = [];
{
  const stone = std(0x9aa0ad, 0.85, 0.05), stoneDark = std(0x6c7280, 0.9, 0.05);
  const spots = [
    polar(GARDEN_PATH_R + 1.4, deg(79)), polar(GARDEN_PATH_R + 1.4, deg(101)), polar(GARDEN_PATH_R - 1.4, deg(259)), polar(GARDEN_PATH_R - 1.4, deg(281)),
    polar(GARDEN_PATH_R + 1.4, deg(146)), polar(GARDEN_PATH_R + 1.4, deg(214)), polar(GARDEN_PATH_R - 1.4, deg(180)), polar(GARDEN_PATH_R + 1.6, deg(125)), polar(GARDEN_PATH_R + 1.6, deg(235)),
  ];
  const glowTex = canvasTex(128, 128, (g, w, h) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,190,110,.9)'); r.addColorStop(0.3, 'rgba(255,150,60,.25)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  spots.forEach((p, i) => {
    const l = new THREE.Group(); l.position.set(p.x, GARDEN_Y, p.z); l.rotation.y = rand() * TAU; scene.add(l);
    cyl(0.32, 0.38, 0.14, stoneDark, 0, 0.07, 0, l, 6);
    cyl(0.12, 0.15, 0.62, stone, 0, 0.45, 0, l, 6);
    cyl(0.3, 0.24, 0.12, stone, 0, 0.82, 0, l, 6);
    const boxG = new THREE.Group(); boxG.position.y = 1.02; l.add(boxG);
    [0, 1, 2, 3].forEach(k => { const post = box(0.06, 0.28, 0.06, stone, 0, 0, 0, boxG); post.rotation.y = k * Math.PI / 2; post.translateX(0.17); post.translateZ(0.17); });
    box(0.3, 0.24, 0.3, neon('#ffb45a', 1.8), 0, 0, 0, boxG);
    const roof = cyl(0.04, 0.48, 0.24, stone, 0, 1.28, 0, l, 6);
    sph(0.07, stone, 0, 1.44, 0, l, 8, 6);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    halo.position.y = 1.02; halo.scale.setScalar(2.6); l.add(halo);
    lanternSpots.push(l.position.clone());
    onFrame((dt, t) => { halo.material.opacity = REDUCED ? 0.9 : 0.8 + 0.2 * Math.sin(t * 3 + i * 2.1) * Math.sin(t * 1.3 + i); });
  });
}

// ---------------------------------------------------------- fireflies -----
{
  const N = IS_MOBILE ? 140 : 240;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), s = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    let a = rand() * TAU, r = rr(FLOOR_R + 0.5, GARDEN_R - 0.5);
    if (i < N * 0.2) { a = POND.a + rr(-0.15, 0.15); r = POND.r + rr(-3.5, 3.5); }
    const near = isNear(a);
    pos.set([Math.sin(a) * r, GARDEN_Y + (near ? rr(0.2, 0.8) : rr(0.3, 2.6)), Math.cos(a) * r], i * 3);
    s.set([rand(), rand(), rand(), rand()], i * 4);
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aS', new THREE.BufferAttribute(s, 4));
  const ff = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: gardenUniforms.uTime, uPR: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute vec4 aS; uniform float uTime, uPR; varying float vA;
      void main(){ vec3 p = position;
        p.x += sin(uTime * (.3 + aS.x * .4) + aS.y * 30.) * .7;
        p.z += cos(uTime * (.25 + aS.z * .4) + aS.x * 20.) * .7;
        p.y += sin(uTime * (.5 + aS.w) + aS.z * 10.) * .25;
        vec4 mv = modelViewMatrix * vec4(p,1.); gl_Position = projectionMatrix * mv;
        float b = pow(max(0., sin(uTime * (0.8 + aS.w * 1.5) + aS.x * 40.)), 3.);
        vA = 0.08 + b; gl_PointSize = (3. + aS.y * 3.) * uPR * (50. / -mv.z); }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d);
      a = a * a * vA; gl_FragColor = vec4(vec3(.85,1.3,.35) * a * 1.6, a); }`,
  }));
  ff.frustumCulled = false;
  scene.add(ff);
}
