// =============================================================================
//  Chibi executives, seven cats, and how they get around
// =============================================================================
const shadowTex = canvasTex(128, 128, (g, w, h) => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(0.6, 'rgba(0,0,0,.2)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});
function blobShadow(parent, size) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.035; m.renderOrder = 1;
  parent.add(m);
  return m;
}

// ---------------------------------------------------------- navigation ----
function zoneOf(p) {
  const r = Math.hypot(p.x, p.z);
  if (r > FLOOR_R + 0.05) return { kind: 'garden' };
  for (let s = 0; s < 8; s++) {
    const room = rooms[s];
    const a = room.angle;
    // into room-local coordinates
    const dx = p.x - room.group.position.x, dz = p.z - room.group.position.z;
    const th = a + Math.PI;
    const lx = dx * Math.cos(th) - dz * Math.sin(th);
    const lz = dx * Math.sin(th) + dz * Math.cos(th);
    if (lz > -0.3 && lx * lx + lz * lz < (ROOM_RAD + 0.15) ** 2) return { kind: 'room', slot: s };
  }
  return { kind: 'plaza' };
}
function arcPoints(r, a0, a1, y = 0) {
  const d = angleDiff(a0, a1);
  const n = Math.max(1, Math.ceil(Math.abs(d) / 0.12));
  const out = [];
  for (let i = 1; i <= n; i++) out.push(polar(r, a0 + d * i / n, y));
  return out;
}
const angOf = p => Math.atan2(p.x, p.z);
const sculptAngles = EXECS.map((e, i) => slotAngle(i + 1));
function nearestMid(a) { let best = midAngles[0], bd = 9; for (const m of midAngles) { const d = Math.abs(angleDiff(a, m)); if (d < bd) { bd = d; best = m; } } return best; }

// Route from a position to a destination, walking corridors, doors and paths.
function planRoute(from, fromSpot, dest) {
  const pts = [];
  let cur = from.clone();
  const z = zoneOf(cur);
  // leave the current zone
  if (z.kind === 'room') {
    const room = rooms[z.slot];
    if (dest.kind === 'room' && dest.slot === z.slot) {
      if (fromSpot && fromSpot.key === dest.spot) return [];
      if (fromSpot) (room.def.spots[fromSpot.key + 'Via'] || []).slice().reverse().forEach(([x, zz]) => pts.push(room.local(x, zz)));
      pts.push(room.local(0, ROOM_RAD - 1.1));
      (room.def.spots[dest.spot + 'Via'] || []).forEach(([x, zz]) => pts.push(room.local(x, zz)));
      const sp = room.def.spots[dest.spot]; pts.push(room.local(sp.x, sp.z));
      return pts;
    }
    if (fromSpot && room.def.spots) (room.def.spots[fromSpot.key + 'Via'] || []).slice().reverse().forEach(([x, zz]) => pts.push(room.local(x, zz)));
    pts.push(room.doorIn(), room.doorOut());
    cur = room.doorOut();
  } else if (z.kind === 'garden') {
    const a = angOf(cur);
    const r = Math.hypot(cur.x, cur.z);
    const m = nearestMid(a);
    if (Math.abs(r - GARDEN_PATH_R) > 0.3) pts.push(polar(GARDEN_PATH_R, a, GARDEN_Y));
    if (dest.kind === 'garden') {
      pts.push(...arcPoints(GARDEN_PATH_R, a, dest.a, GARDEN_Y));
      return pts;
    }
    pts.push(...arcPoints(GARDEN_PATH_R, a, m, GARDEN_Y));
    pts.push(polar(FLOOR_R + 0.6, m, GARDEN_Y), polar(FLOOR_R - 0.6, m), polar(RING_WALK + 2.0, m));
    cur = polar(RING_WALK + 2.0, m);
  }
  // across the plaza on the walking ring
  const ca = angOf(cur);
  pts.push(polar(RING_WALK, ca));
  if (dest.kind === 'room') {
    const room = rooms[dest.slot];
    pts.push(...arcPoints(RING_WALK, ca, room.angle));
    pts.push(room.doorOut(), room.doorIn());
    (room.def.spots?.[dest.spot + 'Via'] || []).forEach(([x, zz]) => pts.push(room.local(x, zz)));
    if (dest.spot && room.def.spots) { const sp = room.def.spots[dest.spot]; pts.push(room.local(sp.x, sp.z)); }
  } else if (dest.kind === 'plaza') {
    pts.push(...arcPoints(RING_WALK, ca, angOf(dest.p)));
    pts.push(dest.p.clone());
  } else if (dest.kind === 'garden') {
    const m = nearestMid(dest.a);
    pts.push(...arcPoints(RING_WALK, ca, m));
    pts.push(polar(FLOOR_R - 0.6, m), polar(FLOOR_R + 0.6, m, GARDEN_Y), polar(GARDEN_PATH_R, m, GARDEN_Y));
    pts.push(...arcPoints(GARDEN_PATH_R, m, dest.a, GARDEN_Y));
  }
  return pts;
}
function radialClear(a, r0, r1) {
  for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r += 0.3) {
    const q = polar(r, a);
    for (const o of plazaObstacles) if (Math.hypot(q.x - o.p.x, q.z - o.p.z) < o.r + 0.35) return false;
  }
  return true;
}
function randomPlazaPoint() {
  for (let i = 0; i < 60; i++) {
    const a = rand() * TAU, r = rr(6.0, 14.4);
    if (!radialClear(a, r, RING_WALK)) continue;
    return polar(r, a);
  }
  return polar(13.6, rand() * TAU);
}
// path height: the pond bridge arches up
function walkY(p) {
  const r = Math.hypot(p.x, p.z);
  if (r <= FLOOR_R + 0.05) return 0;
  const d = Math.hypot(p.x - POND.p.x, p.z - POND.p.z);
  if (d < POND.rad + 0.8) { const k = 1 - Math.pow(d / (POND.rad + 0.8), 2); return GARDEN_Y + 0.72 * Math.sqrt(Math.max(0, k)); }
  return GARDEN_Y;
}

// ---------------------------------------------------------- name tags -----
function makeTag(exec) {
  const tex = canvasTex(640, 220, () => {});
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const sp = new THREE.Sprite(mat);
  sp.center.set(0.5, 0);
  sp.renderOrder = 50;
  return { sp, tex, key: '' };
}
function drawTag(tag, exec, state, blinkOn) {
  const title = SETTINGS.titles[exec.index], name = SETTINGS.names[exec.index];
  const key = `${title}|${name}|${state}|${blinkOn}`;
  if (tag.key === key) return;
  tag.key = key;
  const c = tag.tex.userData.ctx, w = 640, h = 220;
  c.clearRect(0, 0, w, h);
  const off = state === 'offline';
  c.font = `600 50px ${FONT}`;
  const tw = c.measureText(title).width;
  c.font = `700 70px ${FONT}`;
  const nw = c.measureText(name).width;
  const bw = Math.min(w - 20, Math.max(tw, nw) + 120), bx = (w - bw) / 2, by = 12, bh = 168;
  roundRect(c, bx, by, bw, bh, 30);
  c.fillStyle = off ? 'rgba(8,10,18,.55)' : 'rgba(8,10,20,.78)'; c.fill();
  c.lineWidth = 4; c.strokeStyle = state === 'waiting' ? (blinkOn ? '#ffd23a' : 'rgba(255,210,58,.35)') : (off ? 'rgba(255,255,255,.12)' : exec.color); c.stroke();
  // pointer
  c.beginPath(); c.moveTo(w / 2 - 16, by + bh); c.lineTo(w / 2, by + bh + 24); c.lineTo(w / 2 + 16, by + bh); c.closePath();
  c.fillStyle = off ? 'rgba(8,10,18,.55)' : 'rgba(8,10,20,.78)'; c.fill();
  // status dot
  const dot = { working: '#33e08a', waiting: '#ffd23a', idle: '#7fb4ff', offline: '#5b6480' }[state];
  c.fillStyle = dot; c.shadowColor = dot; c.shadowBlur = state === 'offline' ? 0 : 16;
  c.beginPath(); c.arc(bx + 42, by + 50, 12, 0, TAU); c.fill(); c.shadowBlur = 0;
  c.textBaseline = 'middle'; c.textAlign = 'center';
  const yellow = state === 'waiting' && blinkOn;
  c.font = `600 50px ${FONT}`; c.fillStyle = yellow ? '#ffd23a' : (off ? 'rgba(200,210,235,.5)' : exec.color);
  c.fillText(title, w / 2 + 12, by + 50);
  c.font = `700 70px ${FONT}`; c.fillStyle = yellow ? '#ffd23a' : (off ? 'rgba(235,240,255,.55)' : '#ffffff');
  c.fillText(name, w / 2, by + 118);
  c.textAlign = 'left';
  tag.tex.needsUpdate = true;
}

// ---------------------------------------------------------- execs ---------
const people = [];
function hairFor(head, style, color) {
  const m = std(color, 0.55, 0.05);
  const R = 0.37;
  const cap = mesh(new THREE.SphereGeometry(R * 1.06, 28, 18, 0, TAU, 0, Math.PI * 0.56), m, 0, 0.02, -0.02, head);
  cap.rotation.x = -0.32;
  const fringe = (n, y, spread, sz) => { for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : i / (n - 1) - 0.5; const f = sph(sz, m, t * spread, y, 0.29 - Math.abs(t) * 0.12, head, 12, 8); f.scale.set(1.2, 0.7, 0.8); } };
  switch (style) {
    case 'slick': fringe(1, 0.25, 0, 0.17); { const s = sph(0.12, m, 0.14, 0.27, 0.22, head, 12, 8); s.scale.set(1.5, 0.6, 1); } break;
    case 'bob': fringe(4, 0.22, 0.42, 0.11); [-1, 1].forEach(s => { const b = sph(0.2, m, s * 0.3, -0.06, -0.04, head, 14, 10); b.scale.set(0.7, 1.35, 1.1); }); { const b = sph(0.36, m, 0, -0.02, -0.14, head, 18, 12); b.scale.set(1.1, 1.0, 0.9); } break;
    case 'bun': fringe(3, 0.24, 0.3, 0.12); sph(0.14, m, 0, 0.4, -0.18, head, 14, 10); break;
    case 'messy': fringe(5, 0.23, 0.48, 0.1); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; const s = sph(0.11, m, Math.sin(a) * 0.24, 0.3 + rand() * 0.06, Math.cos(a) * 0.2 - 0.06, head, 10, 8); s.scale.set(1, 0.8, 1); } break;
    case 'pony': fringe(4, 0.22, 0.4, 0.11); { const p = sph(0.13, m, 0, 0.0, -0.42, head, 14, 10); p.scale.set(0.8, 1.9, 0.8); p.rotation.x = 0.4; sph(0.05, neon('#2fa8ff', 2), 0, 0.17, -0.38, head, 8, 6); } break;
    case 'spiky': fringe(3, 0.23, 0.34, 0.1); for (let i = 0; i < 7; i++) { const c = mesh(new THREE.ConeGeometry(0.08, 0.24, 6), m, -0.24 + i * 0.08, 0.38 - Math.abs(i - 3) * 0.02, -0.02 - (i % 2) * 0.08, head); c.rotation.z = (3 - i) * 0.18; c.rotation.x = -0.3; } break;
    case 'long': fringe(4, 0.22, 0.42, 0.11); { const b = sph(0.36, m, 0, -0.18, -0.12, head, 18, 12); b.scale.set(1.1, 1.5, 0.85); } [-1, 1].forEach(s => { const b = sph(0.16, m, s * 0.3, -0.2, 0.02, head, 12, 8); b.scale.set(0.6, 1.8, 0.9); }); break;
  }
}

function makeExec(exec) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const jacket = std(exec.color, 0.55, 0.05, { emissive: new THREE.Color(exec.color), emissiveIntensity: 0.12 });
  const pants = std(0x1d2130, 0.7, 0.05);
  const skin = std(exec.skin, 0.65, 0);
  const shoe = std(0x0f1118, 0.4, 0.2);
  const legs = [-1, 1].map(s => {
    const pv = new THREE.Group(); pv.position.set(s * 0.1, 0.42, 0); body.add(pv);
    const leg = mesh(new THREE.CapsuleGeometry(0.075, 0.26, 4, 10), pants, 0, -0.19, 0, pv);
    const sh = sph(0.085, shoe, 0, -0.38, 0.04, pv, 12, 8); sh.scale.set(1, 0.6, 1.4);
    return pv;
  });
  const torso = mesh(new THREE.CapsuleGeometry(0.2, 0.22, 6, 16), jacket, 0, 0.67, 0, body);
  torso.scale.set(1.12, 1, 0.82);
  // shirt and tie
  const shirt = mesh(new THREE.CircleGeometry(0.11, 3), M.white, 0, 0.8, 0.17, body); shirt.rotation.z = Math.PI / 2 * 3; shirt.scale.set(1, 1.2, 1);
  const tie = mesh(new THREE.BoxGeometry(0.045, 0.2, 0.02), std(new THREE.Color(exec.color).multiplyScalar(0.55).getHex(), 0.5), 0, 0.7, 0.185, body);
  // arms
  const arms = [-1, 1].map(s => {
    const pv = new THREE.Group(); pv.position.set(s * 0.27, 0.83, 0); body.add(pv);
    mesh(new THREE.CapsuleGeometry(0.06, 0.24, 4, 8), jacket, 0, -0.16, 0, pv);
    sph(0.065, skin, 0, -0.33, 0, pv, 10, 8);
    pv.rotation.z = s * 0.12;
    return pv;
  });
  // head
  const head = new THREE.Group(); head.position.y = 1.26; body.add(head);
  const hs = sph(0.37, skin, 0, 0, 0, head, 32, 24); hs.scale.set(1.05, 0.98, 1);
  [-1, 1].forEach(s => {
    const eye = sph(0.055, std(0x161824, 0.3), s * 0.13, -0.01, 0.325, head, 14, 10); eye.scale.set(0.85, 1.2, 0.6);
    sph(0.018, neon('#ffffff', 1.3), s * 0.115, 0.02, 0.36, head, 8, 6);
    const bl = mesh(new THREE.CircleGeometry(0.05, 16), std(0xff9aa8, 0.9, 0, { transparent: true, opacity: 0.55 }), s * 0.21, -0.1, 0.305, head);
    bl.rotation.y = s * 0.55;
    sph(0.06, skin, s * 0.37, -0.02, 0, head, 10, 8).scale.set(0.5, 1, 0.8);
  });
  const mouth = mesh(new THREE.TorusGeometry(0.035, 0.009, 4, 12, Math.PI), std(0x6a2a2a, 0.6), 0, -0.12, 0.34, head);
  mouth.rotation.z = Math.PI;
  hairFor(head, exec.hairStyle, exec.hair);
  if (exec.key === 'cto') {
    // glasses
    const gm = std(0x101218, 0.3, 0.6);
    [-1, 1].forEach(s => mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 20), gm, s * 0.13, 0.0, 0.345, head));
    box(0.08, 0.012, 0.012, gm, 0, 0.01, 0.35, head);
  }
  if (exec.key === 'ceo') { const pin = sph(0.025, M.gold, 0.12, 0.83, 0.17, body, 8, 6); }
  if (exec.key === 'cmo') { const bh = mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 20, Math.PI * 1.2), std(0x101218, 0.3), 0.37, 0.05, 0, head); bh.rotation.y = Math.PI / 2; }
  const shadow = blobShadow(root, 1.0);
  // status ring under feet (pulses while waiting)
  const sring = mesh(new THREE.RingGeometry(0.45, 0.55, 40), glow('#ffd23a', 0, 2), 0, 0.04, 0, root);
  sring.rotation.x = -Math.PI / 2;
  const tag = makeTag(exec);
  root.add(tag.sp);
  tag.sp.position.y = 1.85;
  root.traverse(o => { if (o.isMesh) o.userData.pick = { type: 'exec', index: exec.index }; });
  scene.add(root);
  pickables.push(root);
  const p = {
    kind: 'exec', exec, root, body, legs, arms, head, torso, tag, sring, shadow,
    pos: V3(), yaw: 0, path: [], speed: 1.2, spot: null, pendingSpot: null,
    sit: 0, sitH: 0.46, walkPhase: 0, moving: false, wait: 0, wave: 0,
    state: 'offline', session: null, idleTimer: rr(1, 4), lastDest: null, blink: 0,
  };
  people.push(p);
  return p;
}
EXECS.forEach(makeExec);

// starting places: each exec rests in their own office
people.forEach(p => {
  const room = rooms[p.exec.index + 1];
  const sp = room.def.spots.rest;
  p.pos.copy(room.local(sp.x, sp.z));
  p.yaw = room.group.rotation.y + sp.rot;
  p.spot = { slot: room.slot, key: 'rest', ...sp };
  p.sit = sp.sit ? 1 : 0; p.sitH = sp.sit || 0.46;
});

function goTo(p, dest, speed) {
  const pts = planRoute(p.pos, p.spot, dest);
  p.path = pts;
  p.speed = speed;
  p.pendingSpot = dest.kind === 'room' && dest.spot ? { slot: dest.slot, key: dest.spot, ...rooms[dest.slot].def.spots[dest.spot] } : null;
  if (dest.kind === 'plaza' || dest.kind === 'garden') p.pendingSpot = null;
  p.spot = null;
  p.lastDest = dest;
}

function personBehaviour(p, dt, t) {
  const ownSlot = p.exec.index + 1;
  const want = p.state;
  const at = s => p.spot && p.spot.slot === ownSlot && p.spot.key === s;
  const heading = (s) => p.pendingSpot && p.pendingSpot.slot === ownSlot && p.pendingSpot.key === s;
  if (want === 'waiting') { p.path.length = 0; return; }
  if (want === 'working') {
    if (!at('work') && !heading('work')) goTo(p, { kind: 'room', slot: ownSlot, spot: 'work' }, REDUCED ? 2.2 : 3.4);
    return;
  }
  if (want === 'offline') {
    if (!at('rest') && !heading('rest')) goTo(p, { kind: 'room', slot: ownSlot, spot: 'rest' }, 1.3);
    return;
  }
  // idle: wander about
  if (p.path.length) return;
  p.idleTimer -= dt;
  if (p.idleTimer > 0) return;
  p.idleTimer = rr(3, 9);
  const roll = rand();
  if (roll < 0.5) goTo(p, { kind: 'plaza', p: randomPlazaPoint() }, 1.15);
  else if (roll < 0.82) goTo(p, { kind: 'garden', a: rand() * TAU }, 1.15);
  else goTo(p, { kind: 'room', slot: ownSlot, spot: 'rest' }, 1.15);
}

const _v = V3();
function stepAlong(p, dt) {
  // returns true while moving
  if (!p.path.length) return false;
  if (p.sit > 0.02) { p.sit = Math.max(0, p.sit - dt * 3); return true; }
  let remaining = p.speed * dt;
  while (remaining > 0 && p.path.length) {
    const tgt = p.path[0];
    _v.set(tgt.x - p.pos.x, 0, tgt.z - p.pos.z);
    const d = _v.length();
    if (d < 1e-4) { p.path.shift(); continue; }
    if (d <= remaining) { p.pos.x = tgt.x; p.pos.z = tgt.z; remaining -= d; p.path.shift(); }
    else { _v.multiplyScalar(remaining / d); p.pos.x += _v.x; p.pos.z += _v.z; remaining = 0; }
    const want = Math.atan2(tgt.x - p.pos.x, tgt.z - p.pos.z);
    if (d > 0.05) p.yaw += angleDiff(p.yaw, want) * Math.min(1, dt * 10);
  }
  if (!p.path.length) {
    if (p.pendingSpot) { p.spot = p.pendingSpot; p.pendingSpot = null; p.sitH = p.spot.sit || 0.46; }
  }
  return true;
}

const _camFlat = V3();
function animateExec(p, dt, t) {
  personBehaviour(p, dt, t);
  const moving = stepAlong(p, dt);
  p.moving = moving;
  // settle into the spot
  if (!moving && p.spot && p.state !== 'waiting') {
    const room = rooms[p.spot.slot];
    const yaw = room.group.rotation.y + p.spot.rot;
    p.yaw += angleDiff(p.yaw, yaw) * Math.min(1, dt * 6);
    if (p.spot.sit && p.state !== 'waiting') p.sit = Math.min(1, p.sit + dt * 2.5);
  }
  if (p.state === 'waiting') {
    p.sit = Math.max(0, p.sit - dt * 3);
    // face the camera and wave
    _camFlat.copy(camera.position).sub(p.pos);
    p.yaw += angleDiff(p.yaw, Math.atan2(_camFlat.x, _camFlat.z)) * Math.min(1, dt * 5);
  }
  const y = walkY(p.pos);
  p.root.position.set(p.pos.x, y, p.pos.z);
  p.root.rotation.y = p.yaw;
  const fast = p.speed > 2;
  if (moving && !p.sit) p.walkPhase += dt * (fast ? 15 : 9);
  const w = moving ? 1 : 0;
  p.wave = damp(p.wave, w, 10, dt);
  const sw = Math.sin(p.walkPhase) * p.wave;
  const sit = p.sit;
  // sitting: lower the hips onto the chair and swing the legs forward
  const hip = lerp(0, p.sitH - 0.42, sit);
  p.body.position.y = hip + Math.abs(Math.cos(p.walkPhase)) * 0.05 * p.wave * (fast ? 1.4 : 1);
  p.body.rotation.x = (fast ? 0.12 : 0.04) * p.wave;
  p.legs[0].rotation.x = lerp(sw * 0.7, -1.45, sit);
  p.legs[1].rotation.x = lerp(-sw * 0.7, -1.45, sit);
  const working = p.state === 'working' && !moving && p.spot?.key === 'work';
  const typing = working ? Math.sin(t * 18) * 0.08 : 0;
  const waving = p.state === 'waiting';
  p.arms[0].rotation.x = working ? -1.0 + typing : lerp(-sw * 0.8, -0.25, sit * 0.6);
  p.arms[1].rotation.x = working ? -1.0 - typing : (waving ? -2.6 : lerp(sw * 0.8, -0.25, sit * 0.6));
  p.arms[1].rotation.z = waving ? 0.25 + Math.sin(t * 9) * 0.35 : 0.12;
  p.arms[0].rotation.z = -0.12;
  // head: look around when idle, at the screen when working
  const look = p.state === 'idle' && !moving ? Math.sin(t * 0.7 + p.exec.index) * 0.5 : 0;
  p.head.rotation.y = damp(p.head.rotation.y, look, 3, dt);
  p.head.rotation.x = working ? 0.12 : Math.sin(t * 1.3 + p.exec.index) * 0.03;
  p.head.rotation.z = p.state === 'waiting' ? Math.sin(t * 2.4) * 0.12 : 0;
  // breathing
  p.torso.scale.y = 1 + Math.sin(t * 2 + p.exec.index) * 0.015;
  // waiting ring
  const ringOp = p.state === 'waiting' ? 0.4 + 0.4 * Math.sin(t * 6) : 0;
  p.sring.material.opacity = damp(p.sring.material.opacity, ringOp, 8, dt);
  p.sring.scale.setScalar(1 + (p.state === 'waiting' ? (t * 0.8) % 1 * 0.4 : 0));
  // name tag: constant on-screen size, blinks yellow while waiting
  const dist = camera.position.distanceTo(p.root.position);
  const s = clamp(dist * 0.07, 1.3, 8.5);
  p.tag.sp.scale.set(s, s * 220 / 640, 1);
  p.tag.sp.position.y = 1.78 + (sit ? -0.1 : 0) + clamp(dist * 0.004, 0, 0.4);
  const blinkOn = REDUCED ? true : Math.floor(t * 2.5) % 2 === 0;
  drawTag(p.tag, p.exec, p.state, blinkOn);
  p.tag.sp.material.opacity = p.state === 'offline' ? 0.75 : 1;
}

// ---------------------------------------------------------- cats ----------
const cats = [];
function catTexture(base, stripe, pattern, isHead) {
  return canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    if (pattern === 'tabby') {
      c.fillStyle = stripe;
      if (isHead) {
        // forehead "M" and cheek stripes, centred on the face (u = 0.25)
        const fx = w * 0.25;
        c.lineWidth = 9; c.strokeStyle = stripe; c.lineCap = 'round';
        c.beginPath(); c.moveTo(fx - 40, h * 0.34); c.lineTo(fx - 20, h * 0.22); c.lineTo(fx, h * 0.32); c.lineTo(fx + 20, h * 0.22); c.lineTo(fx + 40, h * 0.34); c.stroke();
        for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(fx - 120 + i * 48, h * 0.1); c.quadraticCurveTo(fx - 110 + i * 48, h * 0.2, fx - 118 + i * 48, h * 0.26); c.stroke(); }
        [-1, 1].forEach(s => { for (let k = 0; k < 2; k++) { c.beginPath(); c.moveTo(fx + s * 70, h * (0.5 + k * 0.07)); c.lineTo(fx + s * 120, h * (0.47 + k * 0.07)); c.stroke(); } });
      } else {
        for (let i = 0; i < 13; i++) {
          const y = 18 + i * 18;
          c.beginPath();
          for (let x = 0; x <= w; x += 16) { const yy = y + Math.sin(x * 0.05 + i) * 5; x ? c.lineTo(x, yy) : c.moveTo(x, yy); }
          for (let x = w; x >= 0; x -= 16) { const yy = y + 7 + Math.sin(x * 0.06 + i * 2) * 4; c.lineTo(x, yy); }
          c.closePath(); c.fill();
        }
      }
    } else if (pattern === 'point') {
      if (isHead) {
        const fx = w * 0.25, fy = h * 0.58;
        const g = c.createRadialGradient(fx, fy, 6, fx, fy, 120);
        g.addColorStop(0, stripe); g.addColorStop(0.55, stripe + 'aa'); g.addColorStop(1, stripe + '00');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      } else {
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, stripe + '00'); g.addColorStop(0.55, stripe + '22'); g.addColorStop(1, stripe + 'cc');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      }
    } else if (pattern === 'bicolor') {
      c.fillStyle = stripe; c.fillRect(0, h * 0.55, w, h * 0.45);
    }
    const id = c.getImageData(0, 0, w, h);
    for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 16; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
    c.putImageData(id, 0, 0);
  });
}
function makeCat(o) {
  const root = new THREE.Group();
  const furB = new THREE.MeshStandardMaterial({ map: catTexture(o.base, o.stripe, o.pattern, false), roughness: 0.9 });
  const furH = new THREE.MeshStandardMaterial({ map: catTexture(o.base, o.stripe, o.pattern, true), roughness: 0.9 });
  const solid = std(o.base, 0.9, 0);
  const extremity = o.pattern === 'point' ? std(o.stripe, 0.9, 0) : (o.pattern === 'tabby' ? std(o.stripe, 0.9, 0) : solid);
  const white = std(0xf6f4ef, 0.9, 0);
  const legH = o.short ? 0.09 : 0.19;
  const k = o.size || 1;
  root.scale.setScalar(k);
  const body = new THREE.Group(); root.add(body);
  const bg = new THREE.SphereGeometry(0.2, 28, 18); bg.rotateX(Math.PI / 2);
  const torso = mesh(bg, furB, 0, 0, 0, body); torso.scale.set(o.chunky ? 1.18 : 1.02, o.chunky ? 1.0 : 0.92, 1.72);
  if (o.fluffy) { const ruff = sph(0.16, o.pattern === 'point' ? white : solid, 0, 0.0, 0.24, body, 16, 12); ruff.scale.set(1.15, 1.1, 0.9); }
  if (o.pattern === 'bicolor' || o.chest) { const ch = sph(0.12, white, 0, -0.04, 0.27, body, 14, 10); ch.scale.set(1, 1.1, 0.7); }
  const head = new THREE.Group(); head.position.set(0, 0.16, 0.33); body.add(head);
  const hm = sph(0.17, furH, 0, 0, 0, head, 28, 20); hm.scale.set(o.chunky ? 1.18 : 1.06, o.chunky ? 0.98 : 0.95, 0.96);
  [-1, 1].forEach(s => {
    const ear = mesh(new THREE.ConeGeometry(o.chunky ? 0.06 : 0.065, o.chunky ? 0.1 : 0.13, 4), extremity, s * 0.1, 0.14, -0.02, head);
    ear.rotation.set(-0.1, 0, -s * 0.28); ear.scale.z = 0.55;
    const inner = mesh(new THREE.ConeGeometry(0.035, 0.08, 4), std(0xffa9bf, 0.8), s * 0.098, 0.135, 0.008, head); inner.rotation.set(-0.1, 0, -s * 0.28); inner.scale.z = 0.4;
    const eye = sph(0.034, std(0x0a0a0f, 0.2), s * 0.065, 0.025, 0.14, head, 14, 10); eye.scale.set(1, o.sleepy ? 0.15 : 1.05, 0.55);
    const iris = sph(0.026, neon(o.eye, 1.5), s * 0.066, 0.025, 0.152, head, 12, 8); iris.scale.set(1, 1, 0.4);
    const pupil = box(0.009, 0.034, 0.005, std(0x050508), s * 0.066, 0.025, 0.163, head);
    sph(0.007, neon('#ffffff', 2), s * 0.058, 0.04, 0.165, head, 6, 4);
    const cheek = sph(0.06, o.pattern === 'bicolor' || o.base === '#15151a' ? solid : furH, s * 0.07, -0.05, 0.1, head, 12, 8); cheek.scale.set(1, 0.8, 0.8);
    for (let w = 0; w < 3; w++) { const wh = mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.16, 3), std(0xffffff, 0.5), s * 0.13, -0.04 - w * 0.012, 0.11, head); wh.rotation.z = Math.PI / 2 + s * (w - 1) * 0.15; }
    o['eye' + s] = [eye, iris, pupil];
  });
  const muzzle = sph(0.05, o.base === '#15151a' ? solid : white, 0, -0.05, 0.13, head, 12, 8); muzzle.scale.set(1.3, 0.8, 0.9);
  sph(0.016, std(o.base === '#15151a' ? 0x333338 : 0xff8fa8, 0.5), 0, -0.02, 0.17, head, 8, 6);
  // collar
  const collar = mesh(new THREE.TorusGeometry(0.115, 0.018, 8, 32), neon(o.collar, 2.8), 0, 0.075, 0.25, body); collar.rotation.x = Math.PI / 2 - 0.6;
  sph(0.022, std(0xffd36a, 0.2, 0.9, { emissive: new THREE.Color(0xffa020), emissiveIntensity: 0.6 }), 0, 0.0, 0.33, body, 10, 8);
  // legs
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {
    const pv = new THREE.Group(); pv.position.set(sx * 0.09, 0, sz * 0.2); root.add(pv);
    mesh(new THREE.CapsuleGeometry(0.042, Math.max(0.01, legH - 0.06), 4, 8), o.pattern === 'point' ? extremity : solid, 0, -legH / 2, 0, pv);
    const paw = sph(0.048, o.pattern === 'bicolor' ? white : (o.pattern === 'point' ? white : solid), 0, -legH + 0.01, 0.02, pv, 10, 8); paw.scale.set(1, 0.6, 1.25);
    return pv;
  });
  // tail: a chain of segments
  const tail = []; let parent = body;
  const tailRoot = new THREE.Group(); tailRoot.position.set(0, 0.06, -0.32); body.add(tailRoot); parent = tailRoot;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Group(); seg.position.set(0, 0, i ? -0.075 : 0); parent.add(seg);
    const r = (o.fluffy ? 0.05 : 0.034) * (1 - i * 0.07);
    const m = mesh(new THREE.CapsuleGeometry(r, 0.05, 4, 8), i > 3 && o.pattern === 'point' ? extremity : (o.pattern === 'tabby' && i % 2 ? extremity : solid), 0, 0, -0.035, seg);
    m.rotation.x = Math.PI / 2;
    tail.push(seg); parent = seg;
  }
  blobShadow(root, 0.85);
  root.traverse(m => { if (m.isMesh) m.userData.pick = { type: 'cat', index: cats.length }; });
  scene.add(root);
  pickables.push(root);
  const cat = {
    kind: 'cat', o, root, body, head, legs, tail, legH, pos: V3(), yaw: 0, target: null, speed: 0.75,
    pose: { sit: 0, lie: 0, curl: 0 }, mode: 'walk', timer: rr(1, 5), walkPhase: rand() * 10, baseY: 0,
  };
  cats.push(cat);
  return cat;
}

const CAT_DEFS = [
  { name: '英國短毛貓', en: 'British Shorthair', base: '#eeeef2', stripe: '#d8d8e0', pattern: 'solid', eye: '#ff9a3c', chunky: true, size: 1.08, where: '坐在噴水池邊看水' },
  { name: '黃色虎斑貓', en: 'Ginger tabby', base: '#f0a24a', stripe: '#b85a14', pattern: 'tabby', eye: '#c8e04a', chest: true, where: '在走廊上巡邏' },
  { name: '黑色虎斑貓', en: 'Black tabby', base: '#74747c', stripe: '#1c1c22', pattern: 'tabby', eye: '#7be07a', where: '在走廊上散步' },
  { name: '布偶貓', en: 'Ragdoll', base: '#f4ece0', stripe: '#6b4a3a', pattern: 'point', eye: '#5ab8ff', fluffy: true, sleepy: true, size: 1.12, where: '在接待大廳的沙發上睡覺' },
  { name: '布偶貓', en: 'Ragdoll', base: '#f2eadf', stripe: '#8a7a8a', pattern: 'point', eye: '#5ab8ff', fluffy: true, size: 1.1, where: '在走廊上閒晃' },
  { name: '曼赤肯', en: 'Munchkin', base: '#f2c890', stripe: '#ffffff', pattern: 'bicolor', eye: '#b8a040', short: true, where: '用小短腿努力散步' },
  { name: '黑貓', en: 'Black cat', base: '#15151a', stripe: '#15151a', pattern: 'solid', eye: '#ffd23a', where: '在走廊上散步' },
];
CAT_DEFS.forEach((d, i) => { d.collar = RAINBOW[i]; d.index = i; makeCat(d); });

// placement
{
  // British shorthair: sits on the fountain's edge, looking at the water
  const b = cats[0];
  const a = THREE.MathUtils.degToRad(-22);
  b.pos.copy(polar(4.05, a)); b.yaw = a + Math.PI; b.mode = 'fixed-sit'; b.pose.sit = 1;
  // ragdoll asleep on the lobby sofa
  const r = cats[3];
  const lobby = rooms[0];
  r.pos.copy(lobby.local(-3.62, 2.35)); r.yaw = lobby.group.rotation.y + Math.PI * 0.55; r.mode = 'fixed-sleep'; r.pose.curl = 1; r.baseY = 0.45;
  // the rest roam the corridor
  [1, 2, 4, 5, 6].forEach((i, k) => { const c = cats[i]; c.pos.copy(randomCatPoint()); c.yaw = rand() * TAU; c.mode = ['sit', 'lie', 'walk', 'walk', 'lie'][k]; c.timer = rr(2, 8); c.pose.sit = c.mode === 'sit' ? 1 : 0; c.pose.lie = c.mode === 'lie' ? 1 : 0; });
}
function randomCatPoint() {
  for (let i = 0; i < 60; i++) {
    const a = rand() * TAU, r = rr(5.7, 14.6);
    const p = polar(r, a);
    if (plazaObstacles.some(o => Math.hypot(p.x - o.p.x, p.z - o.p.z) < o.r + 0.3)) continue;
    return p;
  }
  return polar(8, rand() * TAU);
}
function catPathClear(a, b) {
  for (let i = 1; i <= 12; i++) {
    const p = a.clone().lerp(b, i / 12);
    const r = Math.hypot(p.x, p.z);
    if (r < 5.2 || r > 14.9) return false;
    for (const o of plazaObstacles) if (Math.hypot(p.x - o.p.x, p.z - o.p.z) < o.r + 0.2) return false;
  }
  return true;
}
function animateCat(c, dt, t) {
  const P = c.pose;
  let moving = false;
  if (c.mode === 'walk') {
    if (!c.target) {
      for (let i = 0; i < 20 && !c.target; i++) { const q = randomCatPoint(); if (catPathClear(c.pos, q)) c.target = q; }
      if (!c.target) { c.mode = 'sit'; c.timer = 3; }
    }
    if (c.target) {
      _v.set(c.target.x - c.pos.x, 0, c.target.z - c.pos.z);
      const d = _v.length();
      const want = Math.atan2(_v.x, _v.z);
      c.yaw += angleDiff(c.yaw, want) * Math.min(1, dt * 4);
      const sp = c.speed * (c.o.short ? 0.75 : 1) * (REDUCED ? 0.6 : 1);
      if (d < 0.05) { c.target = null; const r = rand(); c.mode = r < 0.45 ? 'sit' : (r < 0.85 ? 'lie' : 'walk'); c.timer = c.mode === 'lie' ? rr(8, 18) : rr(3, 8); }
      else { const step = Math.min(d, sp * dt * smooth(0.6, 1, Math.cos(angleDiff(c.yaw, want)))); c.pos.x += _v.x / d * step; c.pos.z += _v.z / d * step; moving = step > 0; }
    }
    P.sit = damp(P.sit, 0, 6, dt); P.lie = damp(P.lie, 0, 6, dt);
  } else if (c.mode === 'sit' || c.mode === 'lie') {
    c.timer -= dt;
    P.sit = damp(P.sit, c.mode === 'sit' ? 1 : 0, 4, dt);
    P.lie = damp(P.lie, c.mode === 'lie' ? 1 : 0, 3, dt);
    if (c.timer <= 0) { c.mode = 'walk'; c.target = null; }
  }
  if (moving) c.walkPhase += dt * 11 * (c.o.short ? 1.5 : 1);
  const mv = moving ? 1 : 0;
  c.root.position.set(c.pos.x, c.baseY + walkY(c.pos), c.pos.z);
  c.root.rotation.y = c.yaw;
  const sw = Math.sin(c.walkPhase) * mv;
  const L = c.legH;
  // body height & pitch from the pose blend
  const standY = L + 0.16;
  let by = standY + Math.abs(Math.cos(c.walkPhase)) * 0.015 * mv;
  by = lerp(by, L * 0.55 + 0.17, P.sit);
  by = lerp(by, 0.15, P.lie);
  by = lerp(by, 0.13, P.curl);
  c.body.position.y = by;
  c.body.position.z = lerp(0, -0.07, P.sit);
  c.body.rotation.x = lerp(0, -0.62, P.sit);
  c.body.rotation.z = lerp(0, 0.5, P.curl);
  c.body.rotation.y = lerp(0, 0.35, P.curl);
  const breathe = 1 + Math.sin(t * (P.curl ? 1.6 : 2.4) + c.walkPhase) * (P.curl ? 0.035 : 0.015);
  c.body.children[0].scale.y = (c.o.chunky ? 1.0 : 0.92) * breathe;
  // legs
  const lieK = Math.min(1, P.lie + P.curl);
  const f0 = lerp(sw * 0.55, 0.15, P.sit), f1 = lerp(-sw * 0.55, 0.15, P.sit);
  const b0 = lerp(-sw * 0.55, -1.25, P.sit), b1 = lerp(sw * 0.55, -1.25, P.sit);
  [f0, f1, b0, b1].forEach((v, i) => {
    const l = c.legs[i];
    l.rotation.x = lerp(v, -1.35, lieK);
    l.position.y = lerp(i >= 2 ? lerp(L, 0.1, P.sit) : L, 0.08, lieK);
    l.visible = P.curl < 0.5;
  });
  // head
  const look = c.mode === 'fixed-sit' ? Math.sin(t * 0.35) * 0.5 + (Math.sin(t * 0.11) > 0.8 ? 0.6 : 0) : (moving ? 0 : Math.sin(t * 0.5 + c.walkPhase) * 0.4);
  c.head.rotation.y = damp(c.head.rotation.y, look, 2, dt);
  c.head.rotation.x = lerp(lerp(0, 0.6, P.sit), 0.15, P.lie) + (P.curl ? 0.5 : 0);
  c.head.position.y = lerp(0.16, 0.08, P.curl);
  c.head.position.z = lerp(0.33, 0.22, P.curl);
  if (P.curl) c.head.rotation.z = 0.6;
  // tail
  c.tail.forEach((s, i) => {
    const wag = Math.sin(t * (moving ? 5 : 1.6) - i * 0.6 + c.walkPhase * 0.2);
    const up = moving ? 0.55 : lerp(0.2, -0.05, P.lie);
    s.rotation.x = i === 0 ? lerp(-up - 0.4, 0.5, P.sit) + P.curl * 0.2 : (moving ? -0.12 : 0.12) * (1 - P.curl);
    s.rotation.y = (i === 0 ? 0 : wag * 0.18) + P.curl * 0.45;
  });
  // blink
  const blinkK = (Math.sin(t * 0.9 + c.walkPhase) > 0.985 || P.curl > 0.5 || (P.lie > 0.8 && Math.sin(t * 0.2 + c.walkPhase) > 0.3)) ? 0.12 : 1;
  [-1, 1].forEach(s => { const [e, ir, pu] = c.o['eye' + s]; e.scale.y = 1.05 * blinkK; ir.scale.y = blinkK; pu.visible = blinkK > 0.5; ir.visible = blinkK > 0.5; });
}

// ---------------------------------------------------------- per frame -----
onFrame((dt, t) => {
  doorUsers.length = 0;
  for (const p of people) { animateExec(p, dt, t); doorUsers.push(p.pos); }
  for (const c of cats) animateCat(c, dt, t);
});
