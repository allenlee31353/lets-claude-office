// =============================================================================
//  Let's Claude Office — 3D office for your running Claude Code sessions
// =============================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angleDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

// Seeded random so the garden and city look the same on every visit.
let _seed = 20261117;
const rand = () => { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; };
const rr = (a, b) => a + (b - a) * rand();
const pick = arr => arr[Math.floor(rand() * arr.length)];

const QS = new URLSearchParams(location.search);
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let REDUCED = motionQuery.matches || QS.has('reduced');
const IS_MOBILE = matchMedia('(max-width: 760px)').matches || /Mobi|Android/i.test(navigator.userAgent);
const IS_TEST = QS.has('test');

// ------------------------------------------------------------- palette ------
const RAINBOW = ['#ff3d5a', '#ff8a2b', '#ffd23a', '#33e08a', '#2fa8ff', '#6a63ff', '#b05cff'];
const RAINBOW_C = RAINBOW.map(c => new THREE.Color(c));
const LOBBY_COLOR = '#bfe6ff';

const EXECS = [
  { key: 'ceo',  title: 'CEO 執行長',  room: '執行長室', name: 'Monday',    nature: 'flame',  natureName: '紅色火焰', hair: 0x1b1b22, hairStyle: 'slick', skin: 0xffd9c2 },
  { key: 'coo',  title: 'COO 營運長',  room: '營運部',   name: 'Tuesday',   nature: 'sunset', natureName: '橙色夕陽', hair: 0x5a3622, hairStyle: 'bob',   skin: 0xffdcc8 },
  { key: 'cfo',  title: 'CFO 財務長',  room: '財務部',   name: 'Wednesday', nature: 'sun',    natureName: '黃色太陽', hair: 0x2b2420, hairStyle: 'bun',   skin: 0xf8d0b4 },
  { key: 'cto',  title: 'CTO 技術長',  room: '技術部',   name: 'Thursday',  nature: 'leaf',   natureName: '綠色葉子', hair: 0x14161c, hairStyle: 'messy', skin: 0xffd6bd },
  { key: 'cpo',  title: 'CPO 採購長',  room: '採購部',   name: 'Friday',    nature: 'drop',   natureName: '藍色水滴', hair: 0x8a5a33, hairStyle: 'pony',  skin: 0xffdcc6 },
  { key: 'cmo',  title: 'CMO 行銷長',  room: '行銷部',   name: 'Saturday',  nature: 'bolt',   natureName: '靛色閃電', hair: 0xe9e2ff, hairStyle: 'spiky', skin: 0xffd8c4 },
  { key: 'chro', title: 'CHRO 人資長', room: '人資部',   name: 'Sunday',    nature: 'moon',   natureName: '紫色月亮', hair: 0x3b2a4a, hairStyle: 'long',  skin: 0xffdccb },
];
EXECS.forEach((e, i) => { e.index = i; e.color = RAINBOW[i]; e.col = RAINBOW_C[i]; });

const STATE_LABEL = { working: '工作中', waiting: '等你回覆', idle: '閒置', offline: '未上線' };

// ------------------------------------------------------------- settings -----
const SETTINGS_KEY = 'lets-office:settings:v1';
const DEFAULTS = () => ({
  company: "Let's Claude Office",
  lobby: '接待大廳',
  rooms: EXECS.map(e => e.room),
  titles: EXECS.map(e => e.title),
  names: EXECS.map(e => e.name),
  demo: false,
  bloom: true,
});
function loadSettings() {
  const d = DEFAULTS();
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (!s || typeof s !== 'object') return d;
    const str = (v, f, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : f);
    return {
      company: str(s.company, d.company, 40),
      lobby: str(s.lobby, d.lobby, 24),
      rooms: d.rooms.map((f, i) => str(s.rooms?.[i], f, 24)),
      titles: d.titles.map((f, i) => str(s.titles?.[i], f, 24)),
      names: d.names.map((f, i) => str(s.names?.[i], f, 24)),
      demo: !!s.demo,
      bloom: s.bloom !== false,
    };
  } catch { return d; }
}
function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); return true; } catch { return false; } }
let SETTINGS = loadSettings();
if (QS.has('demo')) SETTINGS.demo = true;

// ------------------------------------------------------------- layout -------
// Eight slots round the circular floor: slot 0 is the lobby (nearest the
// camera), slots 1–7 belong to CEO … CHRO. Each office is a half-disc: a flat
// back wall on the outside and a curved glass front with the door facing the
// fountain.
const ROOM_R = 21;                 // distance from centre to the flat back wall
const ROOM_RAD = 5.6;              // half-disc radius
const DOOR_R = ROOM_R - ROOM_RAD;  // 15.4 — the door, in the middle of the arc
const FLOOR_R = 23.6;
const GARDEN_R = 40;
const RING_WALK = 12.8;            // corridor ring people walk along
const SCULPT_R = 10.0;             // nature sculptures on the light lines
const FOUNTAIN_R = 3.3;
const slotAngle = s => s * Math.PI / 4;
const polar = (r, a, y = 0) => V3(r * Math.sin(a), y, r * Math.cos(a));

// ------------------------------------------------------------- materials ----
const _matCache = new Map();
function std(color, rough = 0.6, metal = 0.1, extra = {}) {
  const { unique, ...rest } = extra;
  const key = `${color}|${rough}|${metal}|${JSON.stringify(rest)}`;
  if (!unique && _matCache.has(key)) return _matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...rest });
  if (!unique) _matCache.set(key, m);
  return m;
}
function neon(color, intensity = 2.4, extra = {}) {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...extra });
}
function glow(color, opacity = 0.6, intensity = 1.6) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  });
}

function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}
const box = (w, h, d, mat, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
const rbox = (w, h, d, r, mat, x, y, z, parent) => mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), mat, x, y, z, parent);
const cyl = (rt, rb, h, mat, x, y, z, parent, seg = 24) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, parent);
const sph = (r, mat, x, y, z, parent, ws = 24, hs = 16) => mesh(new THREE.SphereGeometry(r, ws, hs), mat, x, y, z, parent);

// Canvas → texture helper
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.userData = { canvas: c, ctx: g };
  return t;
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const FONT = '"Space Grotesk","Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif';
const MONO = '"JetBrains Mono",ui-monospace,Menlo,monospace';

// Animated things register here: fn(dt, t)
const updaters = [];
const onFrame = fn => updaters.push(fn);
// Things that should fade when they stand between the camera and a room
const pickables = [];
