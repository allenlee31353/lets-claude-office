// =============================================================================
//  Renderer, camera, post-processing, night sky and the city below
// =============================================================================
const canvas = document.getElementById('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: IS_TEST });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 required');
} catch (err) {
  document.getElementById('fallback').classList.add('show');
  document.getElementById('intro').remove();
  throw err;
}
const DPR_MAX = IS_MOBILE ? 1.6 : 2;
renderer.setPixelRatio(Math.min(devicePixelRatio, DPR_MAX));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02030a);
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;
  pmrem.dispose();
}

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 2400);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 10;
controls.maxDistance = 300;
controls.minPolarAngle = 0.28;
controls.maxPolarAngle = 1.22;
controls.screenSpacePanning = false;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.9;
controls.panSpeed = 0.7;
controls.keys = {};                       // keyboard is handled by the HUD
const OVERVIEW_AZ = 0.85;                 // keep the tall trees behind the offices
function setOverviewLimits(on) {
  controls.minAzimuthAngle = on ? -OVERVIEW_AZ : -Infinity;
  controls.maxAzimuthAngle = on ? OVERVIEW_AZ : Infinity;
}
setOverviewLimits(true);

// Default isometric-ish view: from the lobby side, looking down at ~44°.
const portrait = () => innerWidth / innerHeight < 0.85;
function overviewDistance() {
  const a = innerWidth / innerHeight;
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const th = tv * a;
  return portrait() ? Math.max(25 / th, 30 / tv) : Math.max(30 / th, 23.5 / tv);
}
function overviewPose() {
  const d = overviewDistance();
  const VIEW_POLAR = portrait() ? 0.5 : 0.86;
  const target = V3(0, 0, IS_MOBILE && innerWidth < innerHeight ? 1.5 : 0.8);
  const pos = target.clone().add(V3(0, Math.cos(VIEW_POLAR) * d, Math.sin(VIEW_POLAR) * d));
  return { pos, target };
}
{
  const p = overviewPose();
  camera.position.copy(p.pos); controls.target.copy(p.target);
}

// ---------------------------------------------------------- post ----------
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
  type: THREE.HalfFloatType, samples: IS_MOBILE ? 2 : 4,
}));
composer.setPixelRatio(Math.min(devicePixelRatio, DPR_MAX));
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.42, 1.0);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());
function applyBloomSetting() { bloomPass.enabled = SETTINGS.bloom; }
applyBloomSetting();

// ---------------------------------------------------------- lights --------
scene.add(new THREE.HemisphereLight(0x8aa4ff, 0x1a1028, 0.6));
const moonLight = new THREE.DirectionalLight(0xbfd4ff, 1.15);
moonLight.position.set(-40, 70, -30);
scene.add(moonLight);
const fill = new THREE.DirectionalLight(0xff9ad8, 0.35);
fill.position.set(50, 30, 60);
scene.add(fill);

// ---------------------------------------------------------- sky -----------
const SKY = {
  zenith: new THREE.Color('#02030a'), mid: new THREE.Color('#0a0c24'),
  horizon: new THREE.Color('#2a1446'), glow: new THREE.Color('#ff5fa8'), below: new THREE.Color('#05040d'),
};
{
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uZ: { value: SKY.zenith }, uM: { value: SKY.mid }, uH: { value: SKY.horizon },
      uG: { value: SKY.glow }, uB: { value: SKY.below },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `
      uniform vec3 uZ,uM,uH,uG,uB; varying vec3 vDir;
      void main(){
        float y = vDir.y;
        vec3 c = mix(uH, uM, smoothstep(0.0, 0.25, y));
        c = mix(c, uZ, smoothstep(0.25, 0.9, y));
        float band = exp(-abs(y + 0.03) * 22.0);
        c += uG * band * 0.22;
        c = mix(c, uB, smoothstep(-0.02, -0.35, y));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), mat);
  sky.renderOrder = -10;
  scene.add(sky);

  // stars
  const N = 1400, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = rand(), v = rr(0.04, 1);
    const th = u * TAU, y = Math.pow(v, 0.7);
    const r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(th) * r * 1600, y * 1600, Math.sin(th) * r * 1600], i * 3);
    seed[i] = rand();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const stars = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float aSeed; uniform float uTime, uPR; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv;
        float tw = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed * 2.0) + aSeed * 40.0);
        vA = tw * (0.35 + aSeed * 0.65); gl_PointSize = (1.0 + aSeed * 2.2) * uPR; }`,
    fragmentShader: `varying float vA; void main(){ vec2 p = gl_PointCoord - .5; float d = length(p);
      float a = smoothstep(.5, 0., d) * vA; gl_FragColor = vec4(vec3(.85,.9,1.) * a, a); }`,
  }));
  stars.renderOrder = -9;
  scene.add(stars);
  onFrame((dt, t) => { stars.material.uniforms.uTime.value = REDUCED ? 0 : t; });

  // moon
  const moonTex = canvasTex(256, 256, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,250,240,1)'); r.addColorStop(0.18, 'rgba(255,246,230,1)');
    r.addColorStop(0.21, 'rgba(200,190,255,.55)'); r.addColorStop(0.45, 'rgba(140,120,255,.14)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(200,190,170,.35)';
    [[118, 110, 9], [140, 132, 6], [126, 144, 5], [108, 132, 4]].forEach(([x, y, rad]) => { g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); });
  });
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  moon.position.set(-620, 520, -1050);
  moon.scale.setScalar(380);
  moon.renderOrder = -8;
  scene.add(moon);
}

// ---------------------------------------------------------- city ----------
const CITY_FLOOR = -190;
{
  const N = IS_MOBILE ? 520 : 900;
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uHaze: { value: SKY.horizon }, uDeep: { value: SKY.below } },
    vertexShader: `
      varying vec3 vW; varying vec3 vN; varying vec3 vLocal; varying float vSeed; varying vec3 vScale;
      void main(){
        vec4 w = modelMatrix * instanceMatrix * vec4(position,1.);
        vW = w.xyz; vLocal = position;
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vSeed = float(gl_InstanceID);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uHaze, uDeep;
      varying vec3 vW; varying vec3 vN; varying vec3 vLocal; varying float vSeed; varying vec3 vScale;
      float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
      void main(){
        vec3 base = vec3(0.012,0.014,0.03);
        vec3 col = base;
        float r = length(vW.xz);
        if (abs(vN.y) < 0.5) {
          // facade: window grid in metres along the face
          float u = (abs(vN.x) > 0.5 ? vLocal.z * vScale.z : vLocal.x * vScale.x);
          float v = vLocal.y * vScale.y;
          vec2 uv = vec2(u / 1.7, v / 2.4);
          vec2 cell = floor(uv);
          vec2 f = fract(uv);
          float aa = clamp(1.6 - max(fwidth(uv.x), fwidth(uv.y)) * 2.2, 0.0, 1.0);
          float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.22, f.y) * step(f.y, 0.78);
          float hs = h21(cell + vSeed * 7.13 + vec2(vN.x, vN.z) * 3.1);
          float style = h21(vec2(vSeed, 3.7));
          float lit = step(0.66 - style * 0.22, hs);
          float flick = 0.85 + 0.15 * sin(uTime * (0.5 + hs * 3.0) + hs * 50.0);
          vec3 warm = vec3(1.0, 0.72, 0.42), cool = vec3(0.55, 0.78, 1.0), pink = vec3(1.0,0.45,0.8);
          vec3 wc = style < 0.55 ? warm : (style < 0.88 ? cool : pink);
          wc = mix(wc, vec3(1.0), hs * 0.25);
          float topFade = smoothstep(0.0, 6.0, vScale.y - v);
          float wl = win * lit * flick * (0.35 + hs * 0.6);
          col += wc * mix(0.07, wl, aa) * topFade;
          // vertical light strips on some towers
          float strip = step(0.9, style) * smoothstep(0.08, 0.0, abs(fract(u / 9.0) - 0.5) - 0.42);
          col += vec3(0.4,0.6,1.0) * strip * 0.8;
          col *= mix(0.55, 1.0, smoothstep(-190.0, -60.0, vW.y));
        } else {
          col = vec3(0.03,0.035,0.06);
        }
        float haze = smoothstep(140.0, 900.0, r);
        col = mix(col, uHaze * 0.35, haze * 0.8);
        col = mix(col, uDeep, smoothstep(-70.0, -185.0, vW.y) * 0.65);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const city = new THREE.InstancedMesh(geo, mat, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V3(), p = V3();
  const tops = [];
  let n = 0;
  for (let i = 0; i < N * 3 && n < N; i++) {
    const r = 85 + Math.pow(rand(), 0.75) * 760;
    const a = rand() * TAU;
    const w = rr(9, 26), d = rr(9, 26);
    let top = CITY_FLOOR + rr(60, 170) + Math.max(0, (r - 220) * rr(0, 0.2));
    if (r < 120) top = Math.min(top, -40 - rand() * 40);
    else if (r < 220) top = Math.min(top, -14 - rand() * 30);
    if (rand() < 0.05 && r > 320) top += rr(40, 110);
    p.copy(polar(r, a, CITY_FLOOR));
    q.setFromAxisAngle(V3(0, 1, 0), a + rr(-0.2, 0.2));
    s.set(w, top - CITY_FLOOR, d);
    m4.compose(p, q, s);
    city.setMatrixAt(n++, m4);
    if (top > -10 && rand() < 0.5) tops.push(V3(p.x, top + 1.2, p.z));
  }
  city.count = n;
  city.frustumCulled = false;
  scene.add(city);
  onFrame((dt, t) => { mat.uniforms.uTime.value = REDUCED ? 0 : t; });

  // aviation lights
  const ag = new THREE.BufferGeometry().setFromPoints(tops);
  const seeds = new Float32Array(tops.length).map(() => rand());
  ag.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const av = new THREE.Points(ag, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float aSeed; uniform float uTime, uPR; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv;
      float b = step(0.82, fract(uTime * 0.5 + aSeed)); vA = 0.25 + b * 0.75;
      gl_PointSize = clamp(900.0 / -mv.z, 2.0, 7.0) * uPR; }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5,.0,d) * vA;
      gl_FragColor = vec4(vec3(1.6,.2,.25) * a, a); }`,
  }));
  scene.add(av);
  onFrame((dt, t) => { av.material.uniforms.uTime.value = REDUCED ? 1.0 : t; });

  // streets far below
  const streets = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uDeep: { value: SKY.below } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uDeep; varying vec2 vP;
      void main(){
        vec2 g = abs(fract(vP / 46.0) - .5);
        float road = smoothstep(.035, .0, min(g.x, g.y));
        float cars = road * step(.7, fract((vP.x + vP.y) * .05 - uTime * .6));
        vec3 c = uDeep + vec3(1.,.6,.3) * road * .035 + vec3(1.,.8,.5) * cars * .08;
        float r = length(vP); c *= smoothstep(1300., 300., r);
        gl_FragColor = vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  streets.rotation.x = -Math.PI / 2;
  streets.position.y = CITY_FLOOR;
  scene.add(streets);
  onFrame((dt, t) => { streets.material.uniforms.uTime.value = REDUCED ? 0 : t; });
}

// ---------------------------------------------------------- resize --------
function onResize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloomPass.resolution.set(w, h);
}
addEventListener('resize', onResize);
