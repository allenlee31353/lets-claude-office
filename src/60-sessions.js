// =============================================================================
//  Live sessions: read ~/.claude/lets-office/roster.js every 2 seconds.
//  The hook writes only ids, folder names, states, pids and timestamps.
// =============================================================================
const live = { mode: 'connecting', sessions: [], overflow: [], updated: 0, misses: 0, first: true };
const SEAT_STATES = ['working', 'waiting', 'idle'];

function pollRoster() {
  const s = document.createElement('script');
  s.src = 'roster.js?t=' + Date.now();
  s.async = true;
  const done = ok => {
    s.remove();
    if (ok) {
      const r = window.LETS_OFFICE_ROSTER;
      if (r && Array.isArray(r.sessions)) {
        live.misses = 0;
        live.updated = r.updated || 0;
        live.mode = 'live';
        live.sessions = r.sessions.filter(x => x && typeof x.id === 'string').map(x => ({
          id: String(x.id).slice(0, 80), project: String(x.project || 'session').slice(0, 80),
          state: SEAT_STATES.includes(x.state) ? x.state : 'idle',
          pid: Number(x.pid) || 0, seat: Number.isInteger(x.seat) ? x.seat : -1,
          started: Number(x.started) || 0, updatedAt: Number(x.updated) || 0,
        }));
      }
    } else {
      live.misses++;
      if (live.mode !== 'live' || live.misses > 3) live.mode = 'missing';
    }
    refreshSessions();
  };
  s.onload = () => done(true);
  s.onerror = () => done(false);
  document.head.appendChild(s);
}

// ---------------------------------------------------------- demo ----------
const demo = { sessions: [], timer: 0 };
const DEMO_PROJECTS = ['my-app', 'api-server', 'landing-page', 'data-pipeline', 'mobile-app', 'design-system', 'infra'];
function demoTick(dt) {
  if (!demo.sessions.length) {
    const now = Date.now() / 1000;
    [0, 1, 3, 4, 5].forEach((seat, k) => demo.sessions.push({
      id: 'demo-' + seat + '-' + Math.random().toString(16).slice(2, 10), project: DEMO_PROJECTS[seat], seat,
      state: ['working', 'idle', 'working', 'waiting', 'idle'][k], pid: 40000 + seat * 17, started: now - 600 * (k + 1), updatedAt: now, next: rr(5, 12),
    }));
  }
  let changed = false;
  for (const s of demo.sessions) {
    s.next -= dt;
    if (s.next <= 0) {
      const r = Math.random();
      s.state = r < 0.5 ? 'working' : (r < 0.78 ? 'idle' : 'waiting');
      s.next = s.state === 'waiting' ? rr(5, 9) : rr(8, 18);
      s.updatedAt = Date.now() / 1000;
      changed = true;
    }
  }
  return changed;
}
function demoActive() {
  return live.mode === 'missing' || (SETTINGS.demo && !live.sessions.length);
}
let demoAcc = 0;
onFrame((dt) => {
  if (!demoActive()) return;
  demoAcc += dt;
  if (demoTick(dt) || demoAcc > 2) { demoAcc = 0; refreshSessions(); }
});

// ---------------------------------------------------------- apply ---------
function currentSessions() { return demoActive() ? demo.sessions : live.sessions; }
function refreshSessions() {
  const list = currentSessions();
  const bySeat = new Map();
  const overflow = [];
  [...list].sort((a, b) => a.started - b.started).forEach(s => {
    if (s.seat >= 0 && s.seat < 7 && !bySeat.has(s.seat)) bySeat.set(s.seat, s);
    else overflow.push(s);
  });
  live.overflow = overflow;
  people.forEach((p, i) => {
    const s = bySeat.get(i) || null;
    const st = s ? s.state : 'offline';
    if (st !== p.state && !live.first) announce(p, p.state, st, s);
    p.state = st;
    p.session = s;
  });
  if (live.mode !== 'connecting') live.first = false;
  updateHUDSessions();
}

function announce(p, from, to, s) {
  const who = `${SETTINGS.names[p.exec.index]}（${SETTINGS.titles[p.exec.index]}）`;
  const proj = s ? ` · ${s.project}` : '';
  if (to === 'waiting') toast(p.exec.color, `${who} 在等你回覆${proj}`);
  else if (from === 'offline' && to !== 'offline') toast(p.exec.color, `${who} 上班了${proj}`);
  else if (to === 'offline') toast(p.exec.color, `${who} 下班了`);
  else if (from === 'working' && to === 'idle') toast(p.exec.color, `${who} 做完了${proj}`);
}

setInterval(pollRoster, 2000);
pollRoster();
