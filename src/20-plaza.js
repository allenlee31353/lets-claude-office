// =============================================================================
//  The floor: platform, glowing grid, cat fountain, breathing ring,
//  rainbow light lines and the seven nature sculptures
// =============================================================================
const ring = { color: new THREE.Color(RAINBOW[0]), index: 0, level: 0 };
const RING_PERIOD = 4.6;
onFrame((dt, t) => {
  const P = REDUCED ? RING_PERIOD * 1.6 : RING_PERIOD;
  const k = t / P;
  ring.index = Math.floor(k) % 7;
  const ph = k - Math.floor(k);
  ring.level = Math.pow(Math.sin(Math.PI * ph), 2);
  ring.color.copy(RAINBOW_C[ring.index]);
});

const GARDEN_Y = -0.16;
const groundY = r => (r > FLOOR_R + 0.05 ? GARDEN_Y : 0);

// ---------------------------------------------------------- platform ------
{
  // the slab the whole floor stands on, floating over the city
  cyl(GARDEN_R + 0.6, GARDEN_R - 3.5, 3.4, std(0x0b0e18, 0.5, 0.7), 0, GARDEN_Y - 1.74, 0, scene, 160);
  // rainbow band round the rim
  const band = new THREE.Mesh(new THREE.CylinderGeometry(GARDEN_R + 0.62, GARDEN_R + 0.62, 0.22, 240, 1, true), new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      vec3 hue(float h){ return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
      void main(){ vec3 c = hue(fract(vUv.x * 3. + uTime * .02));
        float e = smoothstep(0.,.35,vUv.y) * smoothstep(1.,.65,vUv.y);
        gl_FragColor = vec4(c * 2.2 * (0.55 + .45*e), 1.); }`,
  }));
  band.position.y = GARDEN_Y - 0.32;
  scene.add(band);
  onFrame((dt, t) => { band.material.uniforms.uTime.value = REDUCED ? 0 : t; });
  // underside glow ring
  const under = new THREE.Mesh(new THREE.RingGeometry(GARDEN_R - 6, GARDEN_R - 2.5, 160), glow('#6a63ff', 0.25, 1.2));
  under.rotation.x = Math.PI / 2; under.position.y = GARDEN_Y - 3.45;
  scene.add(under);

  // glass balustrade round the garden
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(GARDEN_R, GARDEN_R, 1.05, 200, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.07, roughness: 0.05, metalness: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  rail.position.y = GARDEN_Y + 0.52;
  scene.add(rail);
  const railTop = new THREE.Mesh(new THREE.TorusGeometry(GARDEN_R, 0.035, 6, 240), neon('#9fd0ff', 1.3));
  railTop.rotation.x = Math.PI / 2; railTop.position.y = GARDEN_Y + 1.05;
  scene.add(railTop);
  const railBase = new THREE.Mesh(new THREE.TorusGeometry(GARDEN_R, 0.05, 6, 240), neon('#b05cff', 1.8));
  railBase.rotation.x = Math.PI / 2; railBase.position.y = GARDEN_Y + 0.03;
  scene.add(railBase);
}

// ---------------------------------------------------------- floor ---------
const floorUniforms = { uTime: { value: 0 }, uRing: { value: ring.color }, uLevel: { value: 0 } };
{
  const mat = new THREE.MeshStandardMaterial({ color: 0x080b16, roughness: 0.28, metalness: 0.55 });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, floorUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP; uniform float uTime, uLevel; uniform vec3 uRing;
        float gridLine(vec2 p, float s){ vec2 q = p / s; vec2 g = abs(fract(q - .5) - .5) / fwidth(q); return 1. - min(min(g.x, g.y), 1.); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float r = length(vWP.xz);
          float minor = gridLine(vWP.xz, 1.5);
          float major = gridLine(vWP.xz, 6.0);
          float fade = smoothstep(${FLOOR_R.toFixed(1)}, 8.0, r);
          float wave = exp(-pow(r - mod(uTime * 4.0, 60.0), 2.0) * 0.35);
          vec3 gc = vec3(0.22, 0.5, 1.0);
          totalEmissiveRadiance += gc * (minor * 0.05 + major * 0.16) * (0.5 + fade) * (1.0 + wave * 2.5);
          // circular guide rings
          float rings = smoothstep(.04, .0, abs(r - ${RING_WALK.toFixed(1)})) * 0.18 + smoothstep(.03, .0, abs(r - 7.0)) * .12;
          totalEmissiveRadiance += vec3(.4,.6,1.) * rings;
          // ring colour spills onto the floor near the fountain
          float spill = exp(-max(r - 4.6, 0.0) * 0.42) * step(3.4, r);
          totalEmissiveRadiance += uRing * spill * (0.08 + 0.32 * uLevel);
        }`);
  };
  const floor = new THREE.Mesh(new THREE.CircleGeometry(FLOOR_R, 160), mat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  onFrame((dt, t) => { floorUniforms.uTime.value = REDUCED ? 0 : t; floorUniforms.uLevel.value = ring.level; });

  // floor edge: a small step down to the garden with a light strip
  const edge = new THREE.Mesh(new THREE.CylinderGeometry(FLOOR_R, FLOOR_R, -GARDEN_Y, 200, 1, true), std(0x10141f, 0.4, 0.6));
  edge.position.y = GARDEN_Y / 2;
  scene.add(edge);
  const strip = new THREE.Mesh(new THREE.TorusGeometry(FLOOR_R + 0.01, 0.025, 6, 260), neon('#7fc8ff', 1.6));
  strip.rotation.x = Math.PI / 2; strip.position.y = -0.02;
  scene.add(strip);
}

// ---------------------------------------------------------- fountain ------
const fountain = new THREE.Group();
scene.add(fountain);
const waterUniforms = { uTime: { value: 0 }, uColor: { value: ring.color }, uLevel: { value: 0 } };
{
  const marble = std(0xe8edf6, 0.22, 0.05);
  const marbleDark = std(0xb9c3d6, 0.3, 0.1);
  // basin rim
  const prof = [[3.0, 0.05], [3.0, 0.38], [3.12, 0.52], [3.32, 0.6], [3.55, 0.58], [3.68, 0.44], [3.66, 0.12], [3.8, 0.0]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(prof, 128), marble, 0, 0, 0, fountain);
  // pool bottom with glowing tiles
  const poolMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uLevel, uTime; varying vec2 vP;
      void main(){ float r = length(vP); vec2 t = abs(fract(vP * 1.6) - .5);
        float tile = smoothstep(.47,.5,max(t.x,t.y));
        float caust = pow(.5 + .5 * sin(vP.x * 3.1 + uTime * 1.3) * sin(vP.y * 2.7 - uTime * 1.1), 3.);
        vec3 c = vec3(.02,.05,.1) + uColor * (0.25 + 0.75 * uLevel) * (0.25 + caust * 0.6 + tile * .4) * smoothstep(3.1, 1.0, r);
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }`,
  });
  const poolBottom = new THREE.Mesh(new THREE.CircleGeometry(3.05, 64), poolMat);
  poolBottom.rotation.x = -Math.PI / 2; poolBottom.position.y = 0.06;
  fountain.add(poolBottom);
  // water surface
  const water = new THREE.Mesh(new THREE.CircleGeometry(3.06, 96), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: waterUniforms,
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uLevel, uTime; varying vec2 vP;
      void main(){ float r = length(vP);
        float rip = sin(r * 9.0 - uTime * 3.2) * .5 + .5;
        float rip2 = 0.0;
        for (int i = 0; i < 7; i++) { float a = float(i) * 0.8976 ; vec2 c = vec2(sin(a), cos(a)) * 2.95; float d = length(vP - c); rip2 += (sin(d * 14. - uTime * 6.) * .5 + .5) * exp(-d * 2.2); }
        float centre = exp(-r * 1.6) * (sin(r * 18. - uTime * 7.) * .5 + .5);
        vec3 deep = vec3(.03,.09,.16);
        vec3 c = deep + uColor * (0.18 + .55 * uLevel) * (0.35 + rip * .25 + rip2 * .5 + centre * 1.2);
        c += vec3(.7,.85,1.) * pow(rip, 18.) * .25;
        gl_FragColor = vec4(c, .72);
      }`,
  }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.42;
  fountain.add(water);
  onFrame((dt, t) => { waterUniforms.uTime.value = REDUCED ? t * 0.25 : t; waterUniforms.uLevel.value = ring.level; });

  // rim light strip follows the ring colour
  const rimMat = neon(RAINBOW[0], 2.2);
  const rim = mesh(new THREE.TorusGeometry(3.32, 0.028, 6, 160), rimMat, 0, 0.615, 0, fountain);
  rim.rotation.x = Math.PI / 2;
  onFrame(() => { rimMat.color.copy(ring.color).multiplyScalar(1.2 + ring.level * 1.6); });

  // central pedestal and bowl
  const ped = [[0.0, 0], [0.55, 0], [0.42, 0.2], [0.26, 0.4], [0.22, 0.9], [0.3, 1.05], [0.72, 1.12], [0.8, 1.2], [0.7, 1.26], [0.0, 1.2]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(ped, 64), std(0x6c7790, 0.35, 0.4), 0, 0.1, 0, fountain);
  const bowlWater = mesh(new THREE.CircleGeometry(0.68, 32), glow('#bfe6ff', 0.35, 0.6), 0, 1.33, 0, fountain);
  bowlWater.rotation.x = -Math.PI / 2;
  onFrame(() => { bowlWater.material.color.copy(ring.color).lerp(new THREE.Color(1, 1, 1), 0.3).multiplyScalar(0.5 + ring.level * 0.7); });

  // seven little cat-head spouts on the rim, one per rainbow colour
  const white = std(0xc9d2e2, 0.25, 0.85);
  for (let i = 0; i < 7; i++) {
    const a = i * TAU / 7;
    const g = new THREE.Group();
    g.position.copy(polar(3.36, a, 0.72));
    g.rotation.y = a + Math.PI;
    sph(0.12, white, 0, 0, 0, g);
    [-1, 1].forEach(s => {
      const ear = mesh(new THREE.ConeGeometry(0.045, 0.09, 4), white, s * 0.07, 0.11, -0.02, g);
      ear.rotation.z = -s * 0.35;
    });
    const nose = mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 20), neon(RAINBOW[i], 2.4), 0, -0.02, 0.11, g);
    fountain.add(g);
  }

  // water jets: seven arcs from the rim to the centre, GPU-animated
  const PER = IS_MOBILE ? 110 : 180;
  const N = PER * 7;
  const aJet = new Float32Array(N), aU = new Float32Array(N), aJit = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    aJet[i] = Math.floor(i / PER); aU[i] = rand();
    aJit[i * 3] = rr(-1, 1); aJit[i * 3 + 1] = rr(-1, 1); aJit[i * 3 + 2] = rand();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('aJet', new THREE.BufferAttribute(aJet, 1));
  g.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
  g.setAttribute('aJit', new THREE.BufferAttribute(aJit, 3));
  const jets = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: ring.color }, uLevel: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uScale: { value: 1 } },
    vertexShader: `
      attribute float aJet, aU; attribute vec3 aJit;
      uniform float uTime, uPR, uScale; varying float vA; varying float vT;
      void main(){
        float a = aJet * 0.8975979;
        float t = fract(aU + uTime * 0.42);
        vec3 s = vec3(sin(a) * 3.2, 0.78, cos(a) * 3.2);
        vec3 e = vec3(sin(a) * 0.18, 1.32, cos(a) * 0.18);
        vec3 p = mix(s, e, t);
        p.y += 4.0 * 2.25 * t * (1.0 - t);
        vec3 side = normalize(vec3(cos(a), 0., -sin(a)));
        p += side * aJit.x * 0.05 * (0.4 + t) + vec3(0., aJit.y * 0.04, 0.);
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        vT = t; vA = smoothstep(0., .06, t) * smoothstep(1., .9, t) * (0.6 + 0.4 * aJit.z);
        gl_PointSize = (2.2 + aJit.z * 2.6) * uPR * uScale * (40. / -mv.z);
      }`,
    fragmentShader: `uniform vec3 uColor; uniform float uLevel; varying float vA; varying float vT;
      void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d) * vA;
        vec3 c = mix(vec3(.7,.85,1.), uColor, .45 + .45 * uLevel) * (0.75 + uLevel * .55);
        gl_FragColor = vec4(c * a * .55, a); }`,
  }));
  jets.frustumCulled = false;
  fountain.add(jets);

  // continuous water arcs under the spray
  const arcMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uTime: { value: 0 }, uColor: { value: ring.color }, uLevel: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime, uLevel; uniform vec3 uColor; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float f = 1. - abs(dot(vN, vV)); float flow = .55 + .45 * sin(vUv.x * 60. - uTime * 14.);
        float ends = smoothstep(0., .05, vUv.x) * smoothstep(1., .9, vUv.x);
        vec3 c = mix(vec3(.6,.82,1.), uColor, .4 + .4 * uLevel) * (0.25 + f * .9) * flow * ends * (.6 + uLevel * .5);
        gl_FragColor = vec4(c, 1.); }`,
  });
  for (let i = 0; i < 7; i++) {
    const a = i * TAU / 7;
    const pts = [];
    for (let k = 0; k <= 24; k++) {
      const t = k / 24;
      const s = V3(Math.sin(a) * 3.2, 0.78, Math.cos(a) * 3.2), e = V3(Math.sin(a) * 0.18, 1.32, Math.cos(a) * 0.18);
      const p = s.lerp(e, t); p.y += 9 * t * (1 - t);
      pts.push(p);
    }
    fountain.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.032, 8), arcMat));
  }
  onFrame((dt, t) => { arcMat.uniforms.uTime.value = REDUCED ? t * 0.25 : t; arcMat.uniforms.uLevel.value = ring.level; });

  // splash at the centre
  const SN = 160;
  const sg = new THREE.BufferGeometry();
  const sSeed = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { sSeed[i * 3] = rand(); sSeed[i * 3 + 1] = rand(); sSeed[i * 3 + 2] = rand(); }
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SN * 3), 3));
  sg.setAttribute('aS', new THREE.BufferAttribute(sSeed, 3));
  const splash = new THREE.Points(sg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: jets.material.uniforms,
    vertexShader: `attribute vec3 aS; uniform float uTime, uPR, uScale; varying float vA;
      void main(){ float t = fract(aS.x + uTime * 0.9); float a = aS.y * 6.2831;
        float sp = 0.25 + aS.z * 0.55;
        vec3 p = vec3(sin(a) * sp * t, 1.4 + (1.6 * t - 2.2 * t * t) * (0.4 + aS.z * .6), cos(a) * sp * t);
        vec4 mv = modelViewMatrix * vec4(p,1.); gl_Position = projectionMatrix * mv;
        vA = (1. - t) * .45; gl_PointSize = (1.5 + aS.z * 2.) * uPR * uScale * (40. / -mv.z); }`,
    fragmentShader: jets.material.fragmentShader.replace('varying float vT;', ''),
  }));
  splash.frustumCulled = false;
  fountain.add(splash);
  onFrame((dt, t) => {
    const u = jets.material.uniforms;
    u.uTime.value = REDUCED ? t * 0.35 : t; u.uLevel.value = ring.level;
    u.uScale.value = clamp(innerHeight / 900, 0.6, 1.6);
  });

  const fl = new THREE.PointLight(0xffffff, 18, 11, 1.6);
  fl.position.set(0, 1.8, 0);
  fountain.add(fl);
  onFrame(() => { fl.color.copy(ring.color); fl.intensity = 5 + ring.level * 12; });
}

// ---------------------------------------------------------- ring ----------
{
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uColor: { value: ring.color }, uLevel: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uLevel, uTime; varying vec2 vP;
      void main(){ float r = length(vP);
        float core = exp(-pow((r - 4.65) / 0.07, 2.));
        float halo = exp(-pow((r - 4.65) / 0.42, 2.));
        float inner = exp(-pow((r - 4.18) / 0.025, 2.)) * .5 + exp(-pow((r - 5.12) / 0.025, 2.)) * .35;
        float ticks = step(.9, fract(atan(vP.y, vP.x) / 6.2831 * 84.)) * exp(-pow((r - 5.12) / 0.09, 2.));
        float l = 0.06 + uLevel;
        vec3 c = uColor * (core * 3.2 * l + halo * 0.7 * l + (inner + ticks) * (0.35 + l));
        gl_FragColor = vec4(c, 1.); }`,
  });
  const r = new THREE.Mesh(new THREE.RingGeometry(3.95, 5.6, 200, 1), mat);
  r.rotation.x = -Math.PI / 2; r.position.y = 0.012;
  scene.add(r);
  onFrame((dt, t) => { mat.uniforms.uLevel.value = ring.level; });
}

// ---------------------------------------------------------- light lines ---
{
  const r0 = 5.7, r1 = DOOR_R - 0.15, L = r1 - r0;
  EXECS.forEach((e, i) => {
    const a = slotAngle(i + 1);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uColor: { value: e.col.clone() }, uTime: { value: 0 }, uBoost: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uTime, uBoost; varying vec2 vUv;
        void main(){ float x = abs(vUv.x - .5) * 2.; float s = 1. - vUv.y;
          float core = exp(-x * x * 90.);
          float halo = exp(-x * x * 6.) * .22;
          float pulse = pow(fract(s * 2.2 - uTime * .35), 6.) * exp(-x * x * 20.);
          float ends = smoothstep(0., .04, s) * smoothstep(1., .96, s);
          vec3 c = uColor * (core * 1.8 + halo + pulse * (1.6 + uBoost * 2.)) * ends * (1. + uBoost * .6);
          gl_FragColor = vec4(c, 1.); }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, L), mat);
    m.rotation.order = 'YXZ';
    m.rotation.set(-Math.PI / 2, a, 0);
    m.position.copy(polar(r0 + L / 2, a, 0.014));
    scene.add(m);
    e.line = mat;
    onFrame((dt, t) => { mat.uniforms.uTime.value = REDUCED ? 0 : t + i * 0.37; });
  });
}

// ---------------------------------------------------------- sculptures ----
function teardrop(h, w, seg = 40, power = 0.75) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = Math.pow(Math.sin(Math.PI * Math.min(t * 1.15, 1)), power) * w * Math.pow(1 - t, 0.55);
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), t * h));
  }
  return new THREE.LatheGeometry(pts, seg);
}
function fresnelMat(color, power = 2.2, base = 0.08) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.FrontSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uP: { value: power }, uB: { value: base }, uI: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uP, uB, uI; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1. - abs(dot(vN, vV)), uP); vec3 c = uColor * (uB + f * 2.6) * uI; gl_FragColor = vec4(c, 1.); }`,
  });
}
function sparkles(n, color, radius, height, size = 1) {
  const g = new THREE.BufferGeometry();
  const s = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) s.set([rand(), rand(), rand(), rand()], i * 4);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aS', new THREE.BufferAttribute(s, 4));
  const p = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uR: { value: radius }, uH: { value: height }, uPR: { value: renderer.getPixelRatio() * size } },
    vertexShader: `attribute vec4 aS; uniform float uTime, uR, uH, uPR; varying float vA;
      void main(){ float t = fract(aS.x + uTime * (0.12 + aS.w * .15)); float a = aS.y * 6.2831 + t * 1.5;
        float r = uR * (0.3 + aS.z * .7);
        vec3 p = vec3(sin(a) * r, t * uH, cos(a) * r);
        vec4 mv = modelViewMatrix * vec4(p,1.); gl_Position = projectionMatrix * mv;
        vA = sin(t * 3.14159) * (0.5 + .5 * sin(uTime * 6. + aS.w * 30.));
        gl_PointSize = (2. + aS.w * 3.) * uPR * (36. / -mv.z); }`,
    fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ float d = length(gl_PointCoord - .5);
      float a = smoothstep(.5,.0,d) * vA; gl_FragColor = vec4(uColor * 2. * a, a); }`,
  }));
  p.frustumCulled = false;
  return p;
}

const sculptures = [];
{
  const metal = std(0x161b2a, 0.35, 0.8);
  const builders = {
    flame(g, c) {
      const layers = [[1.25, 0.42, '#ff2a4a', 0.55], [0.95, 0.3, '#ff6a3a', 0.7], [0.62, 0.17, '#ffd0a0', 0.9]].map(([h, w, col, op]) => {
        const m = new THREE.Mesh(teardrop(h, w), glow(col, op, 1.9));
        m.position.y = -0.15;
        g.add(m);
        return m;
      });
      const sp = sparkles(36, '#ff5a6a', 0.35, 1.8);
      sp.position.y = -0.1; g.add(sp);
      return (t, dt) => {
        layers.forEach((m, i) => {
          const f = Math.sin(t * (7 + i * 2.3)) * 0.06 + Math.sin(t * 13.1 + i) * 0.04;
          m.scale.set(1 - f * 0.6, 1 + f * 1.4, 1 - f * 0.6);
          m.rotation.y = t * (0.6 + i * 0.3);
          m.rotation.z = Math.sin(t * 2.1 + i) * 0.05;
        });
        sp.material.uniforms.uTime.value = t;
      };
    },
    sunset(g, c) {
      const sun = new THREE.Mesh(new THREE.SphereGeometry(0.46, 40, 20, 0, TAU, 0, Math.PI / 2), fresnelMat('#ff8a2b', 1.4, 0.75));
      g.add(sun);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 16, 0, TAU, 0, Math.PI / 2), neon('#ffb070', 1.6));
      g.add(core);
      const horizon = mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.02, 64), glow('#ff8a2b', 0.5, 1.4), 0, -0.01, 0, g);
      const bars = [0.72, 0.56, 0.4, 0.26].map((w, i) => {
        const b = mesh(new THREE.BoxGeometry(w * 2, 0.025, 0.05), glow('#ffa040', 0.9 - i * 0.15, 2.0), 0, -0.1 - i * 0.1, 0, g);
        return b;
      });
      const halo = mesh(new THREE.TorusGeometry(0.62, 0.01, 6, 80), glow('#ffb36a', 0.7, 1.8), 0, 0, 0, g);
      halo.rotation.x = Math.PI / 2;
      return (t) => {
        const y = Math.sin(t * 0.5) * 0.12 - 0.05;
        sun.position.y = core.position.y = y;
        bars.forEach((b, i) => { b.scale.x = 0.85 + 0.15 * Math.sin(t * 2 + i); });
        g.rotation.y = t * 0.25;
        halo.scale.setScalar(1 + 0.05 * Math.sin(t * 1.5));
      };
    },
    sun(g, c) {
      mesh(new THREE.SphereGeometry(0.34, 32, 16), neon('#ffe27a', 2.0), 0, 0, 0, g);
      mesh(new THREE.SphereGeometry(0.46, 32, 16), fresnelMat('#ffd23a', 1.6, 0.25), 0, 0, 0, g);
      const rays = new THREE.Group(); g.add(rays);
      const rayGeo = new THREE.ConeGeometry(0.05, 0.36, 6); rayGeo.translate(0, 0.62, 0);
      const rayMat = glow('#ffd23a', 0.9, 2.2);
      for (let i = 0; i < 12; i++) { const r = new THREE.Mesh(rayGeo, rayMat); r.rotation.z = i * TAU / 12; rays.add(r); }
      const rays2 = rays.clone(); rays2.rotation.x = Math.PI / 2; g.add(rays2);
      return (t) => {
        rays.rotation.z = t * 0.4; rays2.rotation.y = -t * 0.3;
        const s = 1 + 0.08 * Math.sin(t * 2.2);
        rays.scale.setScalar(s); rays2.scale.setScalar(2 - s);
        g.rotation.y = t * 0.2;
      };
    },
    leaf(g, c) {
      const sh = new THREE.Shape();
      sh.moveTo(0, -0.5);
      sh.bezierCurveTo(0.42, -0.25, 0.4, 0.3, 0, 0.62);
      sh.bezierCurveTo(-0.4, 0.3, -0.42, -0.25, 0, -0.5);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 24 });
      geo.translate(0, 0, -0.02);
      const leaf = new THREE.Mesh(geo, glow('#33e08a', 0.55, 1.6));
      const holder = new THREE.Group(); holder.add(leaf); g.add(holder);
      const vein = mesh(new THREE.BoxGeometry(0.025, 1.0, 0.07), neon('#a8ffcf', 2.2), 0, 0.05, 0, leaf);
      for (let i = 0; i < 4; i++) {
        [-1, 1].forEach(s => {
          const v = mesh(new THREE.BoxGeometry(0.018, 0.28 - i * 0.04, 0.06), neon('#7dffb8', 1.6), s * 0.09, -0.15 + i * 0.17, 0, leaf);
          v.rotation.z = -s * 0.8;
        });
      }
      const stem = mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.3, 6), neon('#33e08a', 1.8), 0, -0.62, 0, leaf);
      const sp = sparkles(24, '#7dffb8', 0.55, 1.2); sp.position.y = -0.6; g.add(sp);
      return (t) => {
        holder.rotation.y = t * 0.5;
        leaf.rotation.z = Math.sin(t * 1.3) * 0.25;
        leaf.rotation.x = Math.sin(t * 0.9) * 0.18;
        holder.position.y = Math.sin(t * 1.1) * 0.06;
        sp.material.uniforms.uTime.value = t;
      };
    },
    drop(g, c) {
      const geo = teardrop(1.0, 0.36, 48, 0.62);
      geo.rotateX(Math.PI); geo.translate(0, 0.62, 0);
      const drop = new THREE.Mesh(geo, fresnelMat('#2fa8ff', 1.5, 0.22));
      g.add(drop);
      const inner = new THREE.Mesh(geo, glow('#7ccbff', 0.18, 1.2)); inner.scale.setScalar(0.7); inner.position.y = 0.08; g.add(inner);
      const hl = sph(0.05, neon('#e6f6ff', 2.2), -0.12, 0.05, 0.22, g, 12, 8);
      const ripples = [0, 1, 2].map(i => {
        const r = mesh(new THREE.RingGeometry(0.2, 0.235, 64), glow('#2fa8ff', 0.8, 2.0), 0, -1.04, 0, g);
        r.rotation.x = -Math.PI / 2; return r;
      });
      return (t) => {
        const b = Math.sin(t * 1.6);
        drop.position.y = inner.position.y = b * 0.08;
        hl.position.y = 0.05 + b * 0.08;
        g.rotation.y = t * 0.3;
        ripples.forEach((r, i) => {
          const k = (t * 0.45 + i / 3) % 1;
          r.scale.setScalar(1 + k * 2.6);
          r.material.opacity = (1 - k) * 0.8;
        });
      };
    },
    bolt(g, c) {
      const sh = new THREE.Shape();
      const P = [[0.08, 0.62], [-0.22, 0.05], [0.0, 0.05], [-0.14, -0.6], [0.24, 0.12], [0.02, 0.12], [0.2, 0.62]];
      sh.moveTo(P[0][0], P[0][1]); P.slice(1).forEach(p => sh.lineTo(p[0], p[1])); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2 });
      geo.center();
      const mat = neon('#7a6bff', 2.0);
      const bolt = new THREE.Mesh(geo, mat); g.add(bolt);
      const aura = new THREE.Mesh(geo, glow('#6a63ff', 0.35, 1.5)); aura.scale.setScalar(1.35); g.add(aura);
      const cloudMat = std(0x2a2850, 0.8, 0.1, { emissive: new THREE.Color('#3a2f9a'), emissiveIntensity: 0.6 });
      const cloud = new THREE.Group(); cloud.position.y = 0.78; g.add(cloud);
      [[-0.22, 0, 0.17], [0, 0.07, 0.22], [0.22, 0, 0.16], [0.08, -0.04, 0.15]].forEach(([x, y, r]) => sph(r, cloudMat, x, y, 0, cloud, 16, 12));
      const base = new THREE.Color('#7a6bff');
      let flash = 0, next = 1;
      return (t, dt) => {
        g.rotation.y = t * 0.45;
        next -= dt;
        if (next <= 0) { flash = 1; next = REDUCED ? 99 : rr(1.2, 3.5); }
        flash = Math.max(0, flash - dt * 3.2);
        const flick = flash > 0 ? (Math.sin(t * 90) > 0 ? 1 : 0.3) * flash : 0;
        mat.color.copy(base).multiplyScalar(1.6 + flick * 3.5);
        aura.material.opacity = 0.25 + flick * 0.5;
        cloudMat.emissiveIntensity = 0.5 + flick * 2.5;
      };
    },
    moon(g, c) {
      const R = 0.5, te = Math.PI * 0.68, cx = -0.34;
      const sh = new THREE.Shape();
      for (let i = 0; i <= 40; i++) { const a = -te + (2 * te) * i / 40; const x = R * Math.cos(a), y = R * Math.sin(a); i ? sh.lineTo(x, y) : sh.moveTo(x, y); }
      const ex = R * Math.cos(te), ey = R * Math.sin(te);
      const r2 = Math.hypot(ex - cx, ey);
      const a0 = Math.atan2(ey, ex - cx);
      for (let i = 0; i <= 40; i++) { const a = a0 - (2 * a0) * i / 40; sh.lineTo(cx + r2 * Math.cos(a), r2 * Math.sin(a)); }
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 4, curveSegments: 32 });
      geo.center();
      const moon = new THREE.Mesh(geo, neon('#c99bff', 1.7)); g.add(moon);
      const aura = new THREE.Mesh(geo, glow('#b05cff', 0.3, 1.5)); aura.scale.setScalar(1.25); g.add(aura);
      const stars = [];
      const sg = new THREE.OctahedronGeometry(0.06, 0);
      for (let i = 0; i < 6; i++) {
        const s = new THREE.Mesh(sg, neon('#e9d6ff', 2.4));
        s.position.set(Math.cos(i * 1.1) * rr(0.55, 0.8), rr(-0.4, 0.6), Math.sin(i * 1.1) * rr(0.55, 0.8));
        s.scale.setScalar(rr(0.5, 1.1)); s.userData.p = rand() * 10;
        g.add(s); stars.push(s);
      }
      return (t) => {
        moon.rotation.y = aura.rotation.y = t * 0.35;
        moon.rotation.z = aura.rotation.z = Math.sin(t * 0.8) * 0.15 - 0.3;
        stars.forEach(s => { const k = 0.5 + 0.5 * Math.sin(t * 2.4 + s.userData.p); s.scale.setScalar(0.4 + k * 0.8); s.rotation.y = t; });
      };
    },
  };

  EXECS.forEach((e, i) => {
    const a = slotAngle(i + 1);
    const root = new THREE.Group();
    root.position.copy(polar(SCULPT_R, a));
    scene.add(root);
    // plinth
    cyl(0.5, 0.62, 0.42, metal, 0, 0.21, 0, root, 6).rotation.y = Math.PI / 6;
    cyl(0.46, 0.5, 0.06, std(0x0e111c, 0.2, 0.9), 0, 0.45, 0, root, 6).rotation.y = Math.PI / 6;
    const ringTop = mesh(new THREE.TorusGeometry(0.47, 0.018, 6, 6), neon(e.color, 2.6), 0, 0.48, 0, root);
    ringTop.rotation.x = Math.PI / 2; ringTop.rotation.z = Math.PI / 6;
    const pool = mesh(new THREE.CircleGeometry(1.6, 48), glow(e.color, 0.12, 1.2), 0, 0.016, 0, root);
    pool.rotation.x = -Math.PI / 2;
    const g = new THREE.Group(); g.position.y = 1.55; root.add(g);
    const up = builders[e.nature](g, e.col);
    const sc = { root, g, up, exec: e, baseY: 1.55 };
    sculptures.push(sc);
    root.traverse(o => { if (o.isMesh) o.userData.pick = { type: 'sculpture', index: i }; });
    pickables.push(root);
    onFrame((dt, t) => {
      const tt = REDUCED ? t * 0.25 : t;
      up(tt + i * 1.7, dt);
      g.position.y = sc.baseY + Math.sin(tt * 0.9 + i) * 0.07;
    });
  });
}

// ---------------------------------------------------------- planters ------
// Round benches with a little tree, between the light lines.
const plazaObstacles = sculptures.map(s => ({ p: s.root.position, r: 1.15 }));
{
  const seat = std(0x2b2f3d, 0.5, 0.4), wood = std(0x8a5e3c, 0.55, 0.05), soil = std(0x2a1d14, 1, 0);
  const leafA = std(0x3f9a5a, 0.7, 0, { emissive: new THREE.Color(0x0d2a16), emissiveIntensity: 0.6 });
  const leafB = std(0xff9ec7, 0.7, 0, { emissive: new THREE.Color(0xff5c9a), emissiveIntensity: 0.18 });
  for (let k = 0; k < 8; k++) {
    const a = slotAngle(k) + Math.PI / 8;
    const p = polar(8.3, a);
    const g = new THREE.Group(); g.position.copy(p); scene.add(g);
    cyl(1.05, 1.1, 0.42, seat, 0, 0.21, 0, g, 40);
    const top = mesh(new THREE.TorusGeometry(0.88, 0.17, 8, 48), wood, 0, 0.44, 0, g); top.rotation.x = Math.PI / 2; top.scale.z = 0.35;
    cyl(0.7, 0.72, 0.62, std(0x1a1e2a, 0.4, 0.5), 0, 0.31, 0, g, 32);
    cyl(0.66, 0.66, 0.02, soil, 0, 0.62, 0, g, 24);
    const base = mesh(new THREE.TorusGeometry(1.1, 0.02, 6, 64), neon('#bfe0ff', 1.4), 0, 0.03, 0, g); base.rotation.x = Math.PI / 2;
    cyl(0.05, 0.07, 1.0, std(0x4a3426, 0.9), 0, 1.1, 0, g, 6);
    const leaf = k % 2 ? leafB : leafA;
    for (let i = 0; i < 7; i++) {
      const b = sph(rr(0.28, 0.4), leaf, rr(-0.35, 0.35), 1.65 + rr(-0.15, 0.25), rr(-0.35, 0.35), g, 10, 8);
      b.scale.y = 0.8;
    }
    plazaObstacles.push({ p: g.position, r: 1.5 });
  }
}

// ---------------------------------------------------------- mascot --------
const mascot = new THREE.Group();
{
  const white = std(0xfbfcff, 0.45, 0.0, { emissive: new THREE.Color(0x5566aa), emissiveIntensity: 0.12 });
  const pink = std(0xffa7c4, 0.5, 0.0);
  const dark = std(0x141626, 0.3, 0.0);
  const body = sph(0.5, white, 0, 0, 0, mascot); body.scale.set(0.95, 0.85, 1.15);
  const head = new THREE.Group(); head.position.set(0, 0.52, 0.42); mascot.add(head);
  const hs = sph(0.46, white, 0, 0, 0, head, 32, 24); hs.scale.set(1.08, 0.95, 1);
  [-1, 1].forEach(s => {
    const ear = mesh(new THREE.ConeGeometry(0.16, 0.3, 16), white, s * 0.27, 0.4, -0.04, head); ear.rotation.z = -s * 0.32;
    const inner = mesh(new THREE.ConeGeometry(0.09, 0.18, 12), pink, s * 0.26, 0.38, 0.03, head); inner.rotation.z = -s * 0.32;
    const eye = sph(0.085, dark, s * 0.17, 0.04, 0.39, head, 16, 12); eye.scale.set(1, 1.2, 0.7);
    sph(0.026, neon('#ffffff', 1.4), s * 0.15, 0.08, 0.45, head, 8, 6);
    const iris = sph(0.05, neon('#7cc8ff', 1.3), s * 0.17, 0.02, 0.44, head, 12, 8); iris.scale.z = 0.4;
    const blush = mesh(new THREE.CircleGeometry(0.06, 16), std(0xff8fb3, 0.8, 0, { transparent: true, opacity: 0.6 }), s * 0.27, -0.09, 0.4, head);
    blush.rotation.y = s * 0.55;
    for (let k = 0; k < 2; k++) {
      const w = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.34, 4), std(0xd8dcff, 0.6), s * 0.38, -0.06 - k * 0.05, 0.3, head);
      w.rotation.z = Math.PI / 2 + s * (0.12 - k * 0.2);
    }
  });
  sph(0.04, pink, 0, -0.05, 0.46, head, 12, 8);
  // rainbow collar
  const collarTex = canvasTex(256, 8, (g, w) => { RAINBOW.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * w / 7, 0, w / 7 + 1, 8); }); });
  const collar = mesh(new THREE.TorusGeometry(0.33, 0.055, 10, 56), new THREE.MeshBasicMaterial({ map: collarTex, toneMapped: false, color: new THREE.Color(2, 2, 2) }), 0, 0.28, 0.32, mascot);
  collar.rotation.x = Math.PI / 2 - 0.5;
  const bell = sph(0.06, std(0xffd36a, 0.25, 0.9, { emissive: new THREE.Color(0xffb020), emissiveIntensity: 0.6 }), 0, 0.12, 0.62, mascot, 16, 12);
  // paws
  [[-0.22, -0.4, 0.28], [0.22, -0.4, 0.28], [-0.2, -0.38, -0.3], [0.2, -0.38, -0.3]].forEach(p => sph(0.1, white, ...p, mascot, 12, 8));
  // tail
  const tailCurve = new THREE.CatmullRomCurve3([V3(0, 0, -0.5), V3(0, 0.15, -0.8), V3(0.1, 0.5, -0.95), V3(0.05, 0.8, -0.8)]);
  const tail = mesh(new THREE.TubeGeometry(tailCurve, 24, 0.07, 8), white, 0, 0, 0, mascot);
  // wings
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.bezierCurveTo(0.3, 0.55, 0.9, 0.85, 1.45, 0.78);
  wingShape.bezierCurveTo(1.3, 0.6, 1.4, 0.5, 1.55, 0.42);
  wingShape.bezierCurveTo(1.25, 0.3, 1.3, 0.18, 1.42, 0.06);
  wingShape.bezierCurveTo(1.05, 0.02, 1.08, -0.1, 1.15, -0.22);
  wingShape.bezierCurveTo(0.7, -0.2, 0.3, -0.12, 0, 0);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.02, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 20 });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: new THREE.Color(0xc8dcff), emissiveIntensity: 0.55 });
  const featherMat = neon('#e9f3ff', 1.4);
  const wings = [-1, 1].map(s => {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.25, 0.32, -0.05); mascot.add(pivot);
    const w = new THREE.Mesh(wingGeo, wingMat); w.scale.set(s * 0.8, 0.8, 0.8); w.rotation.y = s * -0.35; pivot.add(w);
    // feather edge highlights
    const edge = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0.05, 0.05, 0.03), V3(0.6, 0.62, 0.03), V3(1.4, 0.76, 0.03)]), 20, 0.012, 4), featherMat);
    w.add(edge);
    return pivot;
  });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: canvasTex(128, 128, (g, w, h) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(200,220,255,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); }),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  halo.scale.setScalar(4.2); mascot.add(halo);
  mascot.scale.setScalar(0.95);
  mascot.position.set(0, 5.2, 0);
  scene.add(mascot);
  mascot.traverse(o => { if (o.isMesh) o.userData.pick = { type: 'mascot' }; });
  pickables.push(mascot);
  onFrame((dt, t) => {
    const tt = REDUCED ? t * 0.3 : t;
    const flap = Math.sin(tt * (REDUCED ? 3 : 7.5));
    wings[0].rotation.z = -0.25 - flap * 0.55; wings[1].rotation.z = 0.25 + flap * 0.55;
    wings[0].rotation.y = 0.2; wings[1].rotation.y = -0.2;
    mascot.position.y = 5.0 + Math.sin(tt * 1.3) * 0.28 + flap * 0.04;
    mascot.position.x = Math.sin(tt * 0.31) * 0.5;
    mascot.position.z = Math.cos(tt * 0.31) * 0.5;
    mascot.rotation.y = Math.sin(tt * 0.22) * 0.7;
    mascot.rotation.z = Math.sin(tt * 1.3) * 0.05;
    head.rotation.z = Math.sin(tt * 0.9) * 0.12;
    head.rotation.x = -0.15 + Math.sin(tt * 0.7) * 0.05;
    tail.rotation.z = Math.sin(tt * 2.1) * 0.25;
    bell.position.y = 0.12 + Math.sin(tt * 6) * 0.01;
  });
}
