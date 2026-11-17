// =============================================================================
//  HUD: brand, clock, roster, room navigation, info cards, settings, keyboard,
//  camera flights and the opening sequence
// =============================================================================
const $ = sel => document.querySelector(sel);
const hud = $('#hud');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------- logo ----------
function heptagonEdges(container, R = 40, cls = '') {
  const pts = [];
  for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + i * TAU / 7; pts.push([50 + Math.cos(a) * R, 50 + Math.sin(a) * R]); }
  container.innerHTML = pts.map((p, i) => {
    const q = pts[(i + 1) % 7];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]).toFixed(2);
    return `<line class="${cls}" x1="${p[0].toFixed(2)}" y1="${p[1].toFixed(2)}" x2="${q[0].toFixed(2)}" y2="${q[1].toFixed(2)}" stroke="${RAINBOW[i]}" style="--len:${len};--i:${i}" stroke-width="7" stroke-linecap="round"/>`;
  }).join('');
}
heptagonEdges($('#logoEdges'));
heptagonEdges($('#introEdges'), 40, 'edge');

// ---------------------------------------------------------- clock ---------
const tzCity = (() => { try { return (Intl.DateTimeFormat().resolvedOptions().timeZone || '').split('/').pop().replace(/_/g, ' '); } catch { return ''; } })();
function tickClock() {
  const d = new Date();
  $('#hhmm').textContent = d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
  $('#ss').textContent = ':' + String(d.getSeconds()).padStart(2, '0');
  $('#date').textContent = d.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' }) + (tzCity ? ' · ' + tzCity : '');
}
tickClock();
setInterval(tickClock, 1000);

// ---------------------------------------------------------- toasts --------
function toast(color, text) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast glass';
  el.style.setProperty('--c', color);
  el.innerHTML = `<i></i><span>${esc(text)}</span>`;
  box.prepend(el);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 420); }, 4600);
}

// ---------------------------------------------------------- brand / live --
function applyBrand() {
  $('#companyName').textContent = SETTINGS.company;
  document.title = SETTINGS.company;
}
applyBrand();
function relTime(sec) {
  if (!sec) return '—';
  const d = Math.max(0, Date.now() / 1000 - sec);
  if (d < 10) return '剛剛';
  if (d < 60) return `${Math.floor(d)} 秒前`;
  if (d < 3600) return `${Math.floor(d / 60)} 分鐘前`;
  if (d < 86400) return `${Math.floor(d / 3600)} 小時前`;
  return `${Math.floor(d / 86400)} 天前`;
}

// ---------------------------------------------------------- roster --------
const rosterList = $('#rosterList');
rosterList.innerHTML = EXECS.map((e, i) => `
  <li><button class="exec-row" data-exec="${i}" style="--c:${e.color}">
    <span class="bar"></span>
    <span class="who"><div class="t"></div><div class="n"></div><div class="p"></div></span>
    <span class="chip offline">未上線</span>
  </button></li>`).join('');
rosterList.addEventListener('click', e => {
  const b = e.target.closest('[data-exec]');
  if (b) focusExec(+b.dataset.exec, true);
});
$('#rosterHead').addEventListener('click', () => {
  const r = $('#roster');
  const on = !r.classList.contains('expanded');
  r.classList.toggle('expanded', on);
  $('#rosterHead').setAttribute('aria-expanded', String(on));
});

function updateHUDSessions() {
  const rows = rosterList.querySelectorAll('.exec-row');
  let seated = 0, waiting = 0;
  people.forEach((p, i) => {
    const row = rows[i];
    row.querySelector('.t').textContent = SETTINGS.titles[i];
    row.querySelector('.n').textContent = SETTINGS.names[i];
    row.querySelector('.p').textContent = p.session ? p.session.project : '空位 · 等待 session';
    const chip = row.querySelector('.chip');
    chip.className = 'chip ' + p.state;
    chip.textContent = STATE_LABEL[p.state];
    row.setAttribute('aria-label', `${SETTINGS.titles[i]} ${SETTINGS.names[i]}，${STATE_LABEL[p.state]}${p.session ? '，專案 ' + p.session.project : ''}`);
    if (p.session) seated++;
    if (p.state === 'waiting') waiting++;
  });
  $('#rosterCount').textContent = `${seated}/7`;
  const foot = [];
  if (live.overflow.length) foot.push(`另有 ${live.overflow.length} 個 session 排隊中：${live.overflow.map(s => esc(s.project)).join('、')}`);
  if (demoActive()) foot.push(live.mode === 'missing' ? '示範模式：還沒讀到 roster.js。裝好 plugin 後開一個新的 Claude Code session，主管就會接手真正的工作。' : '示範模式：目前沒有執行中的 session。');
  $('#rosterFoot').innerHTML = foot.join('<br>');
  const liveEl = $('#live'), lt = $('#liveText');
  liveEl.className = 'live ' + (demoActive() ? 'demo' : (live.mode === 'live' ? 'ok' : 'missing'));
  lt.textContent = demoActive() ? 'Demo · 示範模式' : (live.mode === 'live' ? `Live · ${seated} 個 session` : '連線中…');
  document.title = (waiting ? `(${waiting}) ` : '') + SETTINGS.company;
  if (card.kind) renderCard();
}

// ---------------------------------------------------------- nav -----------
const NAV = [{ id: 'overview', label: '全景', key: '0' }, { id: 0, label: () => SETTINGS.lobby, key: '8', color: LOBBY_COLOR },
  ...EXECS.map((e, i) => ({ id: i + 1, label: () => SETTINGS.rooms[i], key: String(i + 1), color: e.color }))];
function buildNav() {
  $('#roomNav').innerHTML = NAV.map(n => {
    const label = typeof n.label === 'function' ? n.label() : n.label;
    return `<button class="nav-btn ${n.id === 'overview' ? 'overview' : ''}" data-nav="${n.id}" style="--c:${n.color || '#fff'}" aria-current="false">${n.id === 'overview' ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>' : '<i></i>'}${esc(label)}<span class="k">${n.key}</span></button>`;
  }).join('');
}
buildNav();
$('#roomNav').addEventListener('click', e => {
  const b = e.target.closest('[data-nav]');
  if (!b) return;
  const id = b.dataset.nav;
  if (id === 'overview') goOverview(); else focusRoom(+id);
});
function setNavActive(id) {
  document.querySelectorAll('.nav-btn').forEach(b => {
    const on = b.dataset.nav === String(id);
    b.setAttribute('aria-current', String(on));
    if (on) b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
  });
}
setNavActive('overview');

// ---------------------------------------------------------- camera --------
const flight = { active: false };
const follow = { exec: null };
function flyTo(pos, target, dur = 1.5, ease = easeInOut, done) {
  follow.exec = null;
  if (REDUCED) {
    camera.position.copy(pos); controls.target.copy(target); controls.update(); controls.enabled = true;
    flight.active = false; done && done();
    return;
  }
  Object.assign(flight, {
    active: true, t: 0, dur, ease, done,
    fromPos: camera.position.clone(), fromTgt: controls.target.clone(), toPos: pos.clone(), toTgt: target.clone(),
    lift: Math.min(14, camera.position.distanceTo(pos) * 0.18),
  });
  controls.enabled = false;
}
onFrame((dt) => {
  if (flight.active) {
    flight.t = Math.min(1, flight.t + dt / flight.dur);
    const e = flight.ease(flight.t);
    camera.position.lerpVectors(flight.fromPos, flight.toPos, e);
    camera.position.y += Math.sin(Math.PI * e) * flight.lift;
    controls.target.lerpVectors(flight.fromTgt, flight.toTgt, e);
    if (flight.t >= 1) { flight.active = false; controls.enabled = true; flight.done && flight.done(); }
  } else if (follow.exec != null) {
    const p = people[follow.exec];
    const want = p.root.position.clone().add(V3(0, 0.9, 0));
    const delta = want.sub(controls.target).multiplyScalar(1 - Math.exp(-4 * dt));
    controls.target.add(delta); camera.position.add(delta);
  }
  // keep the camera over the building
  const t = controls.target;
  const r = Math.hypot(t.x, t.z);
  if (r > 36) { t.x *= 36 / r; t.z *= 36 / r; }
  t.y = clamp(t.y, -0.5, 5);
});
function fitDistance(halfWidth, base) {
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return Math.max(base, halfWidth / (tv * camera.aspect), halfWidth * 0.75 / tv);
}
let view = { kind: 'overview' };
function goOverview() {
  view = { kind: 'overview' };
  closeCard(false);
  setNavActive('overview');
  const p = overviewPose();
  flyTo(p.pos, p.target, 1.6, easeInOut, () => setOverviewLimits(true));
}
function roomPose(slot) {
  const room = rooms[slot];
  const tgt = room.center().add(V3(0, 0.6, 0));
  const out = V3(Math.sin(room.angle), 0, Math.cos(room.angle));
  const d = fitDistance(7.2, 17);
  const polarA = 0.66;
  const pos = tgt.clone().add(out.clone().multiplyScalar(-Math.sin(polarA) * d)).add(V3(0, Math.cos(polarA) * d, 0));
  // keep cards from covering the room on wide screens
  if (!IS_MOBILE && innerWidth > 900) {
    const side = V3(Math.cos(room.angle), 0, -Math.sin(room.angle));
    tgt.add(side.clone().multiplyScalar(-1.6)); pos.add(side.multiplyScalar(-1.6));
  }
  return { pos, tgt };
}
function focusRoom(slot, fromKey = false) {
  setOverviewLimits(false);
  view = { kind: 'room', slot };
  const { pos, tgt } = roomPose(slot);
  flyTo(pos, tgt, 1.5);
  setNavActive(slot);
  openCard('room', slot);
}
function focusExec(i, followIt = true) {
  setOverviewLimits(false);
  const p = people[i];
  view = { kind: 'exec', index: i };
  const tgt = p.root.position.clone().add(V3(0, 0.9, 0));
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (dir.y < 0.5) { dir.y = 0.6; dir.normalize(); }
  const pos = tgt.clone().add(dir.multiplyScalar(fitDistance(4, 13)));
  flyTo(pos, tgt, 1.3, easeInOut, () => { if (followIt) follow.exec = i; });
  setNavActive(p.exec.index + 1);
  openCard('exec', i);
}
controls.addEventListener('start', () => { if (!flight.active) follow.exec = null; });

// ---------------------------------------------------------- card ----------
const card = { kind: null, id: null };
const cardEl = $('#card');
const ROOM_NOTES = [
  '弧形接待櫃台、兩側等候沙發、兩部電梯。櫃台上方飄著公司招牌，有一隻布偶貓常在左邊沙發上睡覺。',
  '胡桃木大辦公桌、書牆、獎盃櫃和會客沙發。全息投影是一顆緩緩自轉的地球，衛星在軌道上繞行。',
  '營運看板加世界時鐘、橢圓會議桌。桌上的全息投影是物流路線地圖，貨物沿著航線移動。',
  '即時 K 線牆與跑馬燈、雙螢幕辦公桌、保險箱和一疊疊金幣。全息投影是持續成長的 3D 長條圖。',
  '整面監控牆即時跑著 CI、程式碼、終端機和延遲圖；三螢幕值班桌、兩側機櫃閃著燈。桌上投影著整套系統拓撲。',
  '貨架、棧板、紙箱和手推車。全息投影是一個旋轉的包裹，供應鏈節點在軌道上繞著它轉。',
  '活動海報牆、環形補光燈、攝影機和懶骨頭。全息投影是轉換漏斗，愛心不斷往上飄。',
  '照片佈告欄、圓桌茶會、滿室綠植。全息投影是會呼吸的組織圖，上面還有一顆跳動的愛心。',
];
function chip(state) { return `<span class="chip ${state}">${STATE_LABEL[state]}</span>`; }
function sessionRows(p) {
  if (!p.session) return `<div class="card-note">這個位子還沒有 session。開第 ${p.exec.index + 1} 個 Claude Code session，${esc(SETTINGS.names[p.exec.index])} 就會來上班。</div>`;
  const s = p.session;
  return `<dl class="kv">
    <dt>狀態</dt><dd>${chip(p.state)}</dd>
    <dt>專案</dt><dd><code>${esc(s.project)}</code></dd>
    <dt>Session</dt><dd><code>${esc(s.id.slice(0, 8))}</code></dd>
    <dt>PID</dt><dd><code>${s.pid || '—'}</code></dd>
    <dt>開始</dt><dd>${relTime(s.started)}</dd>
    <dt>最後動作</dt><dd>${relTime(s.updatedAt)}</dd>
  </dl>`;
}
function renderCard() {
  const { kind, id } = card;
  let color = '#bfe6ff', kicker = '', title = '', sub = '', body = '', actions = '';
  if (kind === 'room') {
    if (id === 0) {
      kicker = 'Reception'; title = SETTINGS.lobby; sub = SETTINGS.company;
      body = `<dl class="kv"><dt>在線 session</dt><dd>${people.filter(p => p.session).length} / 7</dd><dt>排隊中</dt><dd>${live.overflow.length}</dd></dl><div class="card-note">${ROOM_NOTES[0]}</div>`;
    } else {
      const p = people[id - 1];
      color = p.exec.color;
      kicker = `Office ${String(id).padStart(2, '0')} · ${SETTINGS.titles[id - 1].split(/\s+/)[0]}`;
      title = SETTINGS.rooms[id - 1];
      sub = `${SETTINGS.titles[id - 1]} · ${SETTINGS.names[id - 1]}`;
      body = sessionRows(p) + `<div class="card-note">${ROOM_NOTES[id]}<br>門口光線上的雕塑：${p.exec.natureName}。</div>`;
      actions = `<div class="card-actions"><button class="pill-btn" data-act="exec" data-i="${id - 1}">看 ${esc(SETTINGS.names[id - 1])}</button><button class="pill-btn" data-act="overview">回到全景</button></div>`;
    }
  } else if (kind === 'exec') {
    const p = people[id];
    color = p.exec.color;
    kicker = SETTINGS.titles[id]; title = SETTINGS.names[id]; sub = SETTINGS.rooms[id];
    body = sessionRows(p);
    actions = `<div class="card-actions"><button class="pill-btn" data-act="room" data-i="${id + 1}">去${esc(SETTINGS.rooms[id])}</button><button class="pill-btn" data-act="overview">回到全景</button></div>`;
  } else if (kind === 'cat') {
    const c = cats[id];
    color = c.o.collar; kicker = 'Office cat'; title = c.o.name; sub = c.o.en;
    body = `<dl class="kv"><dt>項圈</dt><dd><span style="color:${c.o.collar}">●</span> ${['紅', '橙', '黃', '綠', '藍', '靛', '紫'][id]}色發光項圈</dd><dt>現在</dt><dd>${c.mode === 'walk' ? '在走廊上散步' : c.mode === 'sit' ? '坐著發呆' : c.mode === 'lie' ? '趴著休息' : c.o.where}</dd></dl>`;
  } else if (kind === 'mascot') {
    kicker = 'Mascot'; title = '飛天白貓'; sub = '公司吉祥物'; color = '#e9f3ff';
    body = `<div class="card-note">牠住在噴水池上方。七道水柱從池邊噴向中央，外圍的光環每次亮一種彩虹顏色，池水也跟著變色。</div>`;
  } else if (kind === 'sculpture') {
    const e = EXECS[id]; color = e.color;
    kicker = 'Light sculpture'; title = e.natureName; sub = `通往${SETTINGS.rooms[id]}的光線上`;
    body = `<div class="card-note">每位主管的辦公室門口都有一條自己顏色的光線，連到中央的噴水池。這座雕塑屬於 ${esc(SETTINGS.names[id])}。</div>`;
  }
  cardEl.style.setProperty('--c', color);
  cardEl.innerHTML = `
    <div class="card-top">
      <div class="card-kicker">${esc(kicker)}</div>
      <h2 class="card-title" id="cardTitle">${esc(title)}</h2>
      <div class="card-sub">${esc(sub)}</div>
      <button class="icon-btn card-close" data-act="close" aria-label="關閉資訊卡"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <div class="card-body">${body}${actions}</div>`;
}
// On phones the card is a bottom sheet: lift the picture so the subject stays visible.
function applyViewOffset() {
  if (card.kind && innerWidth <= 760) camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * 0.2, innerWidth, innerHeight);
  else camera.clearViewOffset();
}
addEventListener('resize', applyViewOffset);
function openCard(kind, id) {
  card.kind = kind; card.id = id;
  renderCard();
  cardEl.classList.add('open');
  document.body.classList.add('card-open');
  applyViewOffset();
}
function closeCard(toOverview = true) {
  card.kind = null;
  cardEl.classList.remove('open');
  document.body.classList.remove('card-open');
  applyViewOffset();
  if (toOverview && view.kind !== 'overview') goOverview();
}
cardEl.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'close') closeCard(true);
  else if (act === 'overview') goOverview();
  else if (act === 'exec') focusExec(+b.dataset.i);
  else if (act === 'room') focusRoom(+b.dataset.i);
});
setInterval(() => { if (card.kind === 'exec' || card.kind === 'room' || card.kind === 'cat') renderCard(); }, 5000);

// ---------------------------------------------------------- picking -------
const raycaster = new THREE.Raycaster();
raycaster.camera = camera;
const ndc = new THREE.Vector2();
function pickAt(x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  // tags first: they float above everything
  for (const p of people) {
    const hit = raycaster.intersectObject(p.tag.sp, false);
    if (hit.length) return { type: 'exec', index: p.exec.index };
  }
  const hits = raycaster.intersectObjects(pickables, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.pick) o = o.parent;
    if (o && o.visible !== false && o.material?.visible !== false) return o.userData.pick;
  }
  return null;
}
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; canvas.classList.add('grab'); });
addEventListener('pointerup', e => {
  canvas.classList.remove('grab');
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const quick = performance.now() - down.t < 600;
  down = null;
  if (e.target !== canvas || moved > 6 || !quick) return;
  const hit = pickAt(e.clientX, e.clientY);
  if (!hit) return;
  if (hit.type === 'room') focusRoom(hit.slot);
  else if (hit.type === 'exec') focusExec(hit.index);
  else if (hit.type === 'cat') { openCard('cat', hit.index); follow.exec = null; flyTo(cats[hit.index].root.position.clone().add(V3(0, 4.5, 7)), cats[hit.index].root.position.clone(), 1.2); setOverviewLimits(false); view = { kind: 'cat' }; }
  else if (hit.type === 'mascot') { openCard('mascot'); setOverviewLimits(false); flyTo(V3(0, 8.5, 12), V3(0, 4.2, 0), 1.3); view = { kind: 'mascot' }; }
  else if (hit.type === 'sculpture') { openCard('sculpture', hit.index); const sc = sculptures[hit.index]; setOverviewLimits(false); const p = sc.root.position; flyTo(p.clone().multiplyScalar(0.45).add(V3(0, 5, 0)), p.clone().add(V3(0, 1.4, 0)), 1.3); view = { kind: 'sculpture' }; }
});
let hoverAcc = 0, lastMove = null;
canvas.addEventListener('pointermove', e => { lastMove = e; });
onFrame((dt) => {
  hoverAcc += dt;
  if (hoverAcc < 0.12 || !lastMove || down || IS_MOBILE) return;
  hoverAcc = 0;
  const hit = pickAt(lastMove.clientX, lastMove.clientY);
  canvas.classList.toggle('pointer', !!hit);
  lastMove = null;
});

// ---------------------------------------------------------- dialogs -------
let lastFocus = null;
function openDialog(scrim) {
  lastFocus = document.activeElement;
  scrim.hidden = false;
  requestAnimationFrame(() => scrim.classList.add('open'));
  const f = scrim.querySelector('input, button:not([data-close])') || scrim.querySelector('button');
  setTimeout(() => f && f.focus(), 30);
}
function closeDialog(scrim) {
  scrim.classList.remove('open');
  setTimeout(() => { scrim.hidden = true; }, REDUCED ? 0 : 300);
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
document.querySelectorAll('.scrim').forEach(scrim => {
  scrim.addEventListener('click', e => { if (e.target === scrim || e.target.closest('[data-close]')) closeDialog(scrim); });
  scrim.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const f = [...scrim.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
});
const anyDialogOpen = () => [...document.querySelectorAll('.scrim')].some(s => !s.hidden);

// settings
function fillSettings(s) {
  $('#setCompany').value = s.company;
  $('#setLobby').value = s.lobby;
  const g = $('#setRooms');
  g.querySelectorAll('.row-el').forEach(n => n.remove());
  EXECS.forEach((e, i) => {
    const frag = document.createElement('template');
    frag.innerHTML = `
      <span class="dot row-el" style="--c:${e.color}" aria-hidden="true"></span>
      <input class="input row-el" data-f="rooms" data-i="${i}" maxlength="24" aria-label="第 ${i + 1} 間房間名稱" value="${esc(s.rooms[i])}">
      <input class="input row-el col-title" data-f="titles" data-i="${i}" maxlength="24" aria-label="第 ${i + 1} 位主管職稱" value="${esc(s.titles[i])}">
      <input class="input row-el" data-f="names" data-i="${i}" maxlength="24" aria-label="第 ${i + 1} 位主管名字" value="${esc(s.names[i])}">`;
    g.append(frag.content);
  });
  $('#setDemo').checked = s.demo;
  $('#setBloom').checked = s.bloom;
}
function openSettings() { fillSettings(SETTINGS); openDialog($('#settingsScrim')); }
$('#settingsBtn').addEventListener('click', openSettings);
$('#setReset').addEventListener('click', () => fillSettings(DEFAULTS()));
function applySettings() {
  applyBrand();
  rooms.forEach(r => r && drawSign(r));
  drawCompanySign();
  applyBloomSetting();
  buildNav();
  setNavActive(view.kind === 'room' ? view.slot : (view.kind === 'overview' ? 'overview' : ''));
  refreshSessions();
  if (card.kind) renderCard();
}
$('#setSave').addEventListener('click', () => {
  const d = DEFAULTS();
  const s = { ...SETTINGS };
  s.company = $('#setCompany').value.trim() || d.company;
  s.lobby = $('#setLobby').value.trim() || d.lobby;
  ['rooms', 'titles', 'names'].forEach(f => { s[f] = [...SETTINGS[f]]; });
  document.querySelectorAll('#setRooms input').forEach(inp => { const f = inp.dataset.f, i = +inp.dataset.i; s[f][i] = inp.value.trim() || d[f][i]; });
  s.demo = $('#setDemo').checked;
  s.bloom = $('#setBloom').checked;
  SETTINGS = s;
  const ok = saveSettings(s);
  applySettings();
  closeDialog($('#settingsScrim'));
  toast('#b05cff', ok ? '設定已儲存在這個瀏覽器' : '設定已套用（瀏覽器不允許儲存，重新整理後會還原）');
});
$('#settingsForm').addEventListener('submit', e => { e.preventDefault(); $('#setSave').click(); });
$('#hintBtn').addEventListener('click', () => openDialog($('#helpScrim')));

// ---------------------------------------------------------- keyboard ------
const navOrder = [0, 1, 2, 3, 4, 5, 6, 7];
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input, textarea')) { if (e.key === 'Escape') { const s = e.target.closest('.scrim'); s && closeDialog(s); } return; }
  if (introState.running) { skipIntro(); return; }
  if (e.key === 'Escape') {
    const open = [...document.querySelectorAll('.scrim')].find(s => !s.hidden);
    if (open) { closeDialog(open); return; }
    if (card.kind || view.kind !== 'overview') { closeCard(true); }
    return;
  }
  if (anyDialogOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
  const inNav = e.target.closest && e.target.closest('#roomNav, #rosterList, #card');
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    if (e.target.closest && e.target.closest('#roomNav')) {
      const btns = [...document.querySelectorAll('.nav-btn')];
      const i = btns.indexOf(e.target.closest('.nav-btn'));
      const n = btns[(i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length];
      n.focus(); e.preventDefault(); return;
    }
    const cur = view.kind === 'room' ? navOrder.indexOf(view.slot) : (view.kind === 'exec' ? view.index + 1 : -1);
    const next = cur < 0 ? (e.key === 'ArrowRight' ? 1 : 7) : navOrder[(cur + (e.key === 'ArrowRight' ? 1 : -1) + 8) % 8];
    focusRoom(next); e.preventDefault(); return;
  }
  const m = /^Digit([0-9])$/.exec(e.code) || /^Numpad([0-9])$/.exec(e.code);
  if (m && !inNav) {
    const d = +m[1];
    if (d === 0) goOverview();
    else if (d === 8) focusRoom(0);
    else if (d <= 7) { if (e.shiftKey) focusExec(d - 1); else focusRoom(d); }
    e.preventDefault(); return;
  }
  if (e.key === 's' || e.key === 'S') { openSettings(); e.preventDefault(); return; }
  if (e.key === '?') { openDialog($('#helpScrim')); e.preventDefault(); }
});

// ---------------------------------------------------------- reduced motion
motionQuery.addEventListener?.('change', ev => { REDUCED = ev.matches || QS.has('reduced'); });

// ---------------------------------------------------------- intro ---------
const introState = { running: false, power: 0, t: 0 };
const intro = $('#intro');
function startIntro() {
  const p = overviewPose();
  if (REDUCED || QS.has('nointro')) {
    camera.position.copy(p.pos); controls.target.copy(p.target);
    introState.power = 1;
    intro.classList.add('fade');
    setTimeout(() => intro.remove(), REDUCED ? 400 : 50);
    hud.classList.add('on');
    return;
  }
  introState.running = true;
  setOverviewLimits(false);
  // start far out, high above the city
  const far = p.target.clone().add(V3(Math.sin(1.0) * 260, 210, Math.cos(1.0) * 260));
  camera.position.copy(far); controls.target.copy(p.target);
  controls.enabled = false;
  intro.classList.add('play');
  if (!QS.has('introhold')) introState.timer = setTimeout(() => beginFly(3.6), 3100);
}
function beginFly(dur) {
  if (introState.flying) return;
  introState.flying = true;
  clearTimeout(introState.timer);
  intro.classList.add('fade');
  setTimeout(() => intro.remove(), 1200);
  const p = overviewPose();
  flyTo(p.pos, p.target, dur, easeOut, () => { introState.running = false; setOverviewLimits(true); });
  flight.lift = 0;
  introState.t = 0;
  setTimeout(() => hud.classList.add('on'), dur * 1000 * 0.55);
}
function skipIntro() { if (introState.running && !introState.flying) beginFly(1.6); }
$('#introSkip').addEventListener('click', skipIntro);
intro.addEventListener('click', skipIntro);
// neon tubes in the scene flicker on while the camera flies in
const FLICKER = [[0, 0], [0.06, 0.9], [0.1, 0.05], [0.2, 0.05], [0.24, 1], [0.28, 0.2], [0.33, 1], [0.38, 0.35], [0.5, 0.35], [0.55, 1], [1, 1]];
onFrame((dt) => {
  if (introState.flying && introState.power < 1) {
    introState.t += dt / 1.8;
    const k = Math.min(1, introState.t);
    let v = 1;
    for (let i = 1; i < FLICKER.length; i++) if (k <= FLICKER[i][0]) { v = FLICKER[i - 1][1]; break; }
    introState.power = k >= 1 ? 1 : v;
  } else if (!introState.running && !introState.flying) introState.power = 1;
  if (introState.flying && introState.t >= 1) introState.power = 1;
  bloomPass.strength = 0.75 * (0.15 + 0.85 * introState.power);
  renderer.toneMappingExposure = 0.55 + 0.45 * introState.power;
});
