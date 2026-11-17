// Headless screenshots for visual review.
// Usage: node tools/shoot.mjs <outdir> <scenario...>
//   THREE_DIR=/path/to/three (a checkout with build/ and examples/jsm/) serves the CDN locally.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { readFileSync, existsSync, mkdirSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const THREE_DIR = process.env.THREE_DIR || '/tmp/threesrc';
const out = process.argv[2] || '/tmp/shots';
const names = process.argv.slice(3);
mkdirSync(out, { recursive: true });

// a fake ~/.claude/lets-office folder
const site = '/tmp/office-site';
mkdirSync(site, { recursive: true });
copyFileSync(join(root, 'web', 'index.html'), join(site, 'index.html'));
const now = Math.floor(Date.now() / 1000);
const roster = (list) => `window.LETS_OFFICE_ROSTER = ${JSON.stringify({ version: 1, updated: now, sessions: list })};`;
const SESS = [
  { id: 'a1b2c3d4-0000', project: 'my-app', state: 'working', pid: 4242, seat: 0, started: now - 900, updated: now - 4 },
  { id: 'b1b2c3d4-0000', project: 'api-server', state: 'idle', pid: 4243, seat: 1, started: now - 800, updated: now - 30 },
  { id: 'c1b2c3d4-0000', project: 'landing-page', state: 'waiting', pid: 4244, seat: 2, started: now - 700, updated: now - 2 },
  { id: 'd1b2c3d4-0000', project: 'infra', state: 'working', pid: 4245, seat: 3, started: now - 600, updated: now - 1 },
  { id: 'e1b2c3d4-0000', project: 'data-pipeline', state: 'idle', pid: 4246, seat: 4, started: now - 500, updated: now - 60 },
];
writeFileSync(join(site, 'roster.js'), roster(SESS));

const W = { desktop: [1600, 900], mobile: [390, 844], wide: [1920, 1080] };
const scenarios = {
  overview: { size: 'desktop', q: '?nointro&test', advance: 20 },
  overviewWide: { size: 'wide', q: '?nointro&test', advance: 20 },
  intro0: { size: 'desktop', q: '?test&live&introhold', wait: 2500, raw: true, anim: 900 },
  intro1: { size: 'desktop', q: '?test&live&introhold', wait: 2500, raw: true, anim: 3000 },
  fly: { size: 'desktop', q: '?test', advance: 0.1, js: `document.getElementById('introSkip').click()`, after: 0.9 },
  cto: { size: 'desktop', q: '?nointro&test', advance: 20, js: `__office.focusRoom(4)`, after: 3 },
  ceo: { size: 'desktop', q: '?nointro&test', advance: 20, js: `__office.focusRoom(1)`, after: 3 },
  coo: { size: 'desktop', q: '?nointro&test', advance: 20, js: `__office.focusRoom(2)`, after: 3 },
  cfo: { size: 'desktop', q: '?nointro&test', advance: 20, js: `__office.focusRoom(3)`, after: 3 },
  cpo: { size: 'desktop', q: '?nointro&test', advance: 20, js: `__office.focusRoom(5)`, after: 3 },
  cmo: { size: 'desktop', q: '?nointro&test', advance: 20, js: `__office.focusRoom(6)`, after: 3 },
  chro: { size: 'desktop', q: '?nointro&test', advance: 20, js: `__office.focusRoom(7)`, after: 3 },
  lobby: { size: 'desktop', q: '?nointro&test', advance: 20, js: `__office.focusRoom(0)`, after: 3 },
  fountain: { size: 'desktop', q: '?nointro&test', advance: 20, js: `__office.camera.position.set(0,9,15); __office.controls.target.set(0,2.2,0); __office.controls.update();`, after: 0.5 },
  exec: { size: 'desktop', q: '?nointro&test', advance: 20, js: `__office.focusExec(2)`, after: 3 },
  garden: { size: 'desktop', q: '?nointro&test', advance: 20, js: `__office.controls.minAzimuthAngle=-Infinity;__office.controls.maxAzimuthAngle=Infinity;__office.camera.position.set(-10,22,-62); __office.controls.target.set(0,0,-24); __office.controls.update();`, after: 0.5 },
  pond: { size: 'desktop', q: '?nointro&test', advance: 20, js: `__office.controls.minAzimuthAngle=-Infinity;__office.controls.maxAzimuthAngle=Infinity;__office.camera.position.set(52,16,12); __office.controls.target.set(30,0,0); __office.controls.update();`, after: 0.5 },
  zen: { size: 'desktop', q: '?nointro&test', advance: 20, js: `__office.controls.minAzimuthAngle=-Infinity;__office.controls.maxAzimuthAngle=Infinity;__office.camera.position.set(-50,16,12); __office.controls.target.set(-30,0,0); __office.controls.update();`, after: 0.5 },
  cats: { size: 'desktop', q: '?nointro&test', advance: 20, js: `__office.camera.position.set(4,4.2,11); __office.controls.target.set(0,0.5,4); __office.controls.update();`, after: 0.2 },
  mobile: { size: 'mobile', q: '?nointro&test', advance: 20 },
  mobileRoom: { size: 'mobile', q: '?nointro&test', advance: 20, js: `__office.focusRoom(4)`, after: 3 },
  settings: { size: 'desktop', q: '?nointro&test', advance: 10, js: `document.getElementById('settingsBtn').click()`, after: 0.5 },
  demo: { size: 'desktop', q: '?nointro&test&demo', advance: 20, noRoster: true },
  reduced: { size: 'desktop', q: '?test&reduced&live', wait: 1500, raw: true },
};

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'],
});
for (const name of names.length ? names : ['overview']) {
  const sc = scenarios[name];
  if (!sc) { console.log('unknown scenario', name); continue; }
  const [w, h] = W[sc.size];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: name === 'reduced' ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', async route => {
    const p = route.request().url().replace('https://cdn.jsdelivr.net/npm/three@0.170.0/', '');
    const f = join(THREE_DIR, p);
    if (existsSync(f)) await route.fulfill({ body: readFileSync(f), contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } });
    else await route.fulfill({ status: 404, body: '' });
  });
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  if (sc.noRoster) { try { unlinkSync(join(site, 'roster.js')); } catch {} } else writeFileSync(join(site, 'roster.js'), roster(SESS));
  const url = 'file://' + join(site, 'index.html') + sc.q;
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'commit', timeout: 120000 });
  await page.waitForFunction(() => window.__office, null, { timeout: 120000 }).catch(() => errors.push('timeout waiting for __office'));
  if (sc.raw) {
    await page.waitForTimeout(sc.wait || 1000);
    if (sc.anim != null) await page.evaluate(t => document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; }), sc.anim);
  } else {
    await page.waitForTimeout(2500);
    const tA = Date.now(); await page.evaluate(n => window.__office && window.__office.advance(n), sc.advance || 5); console.log('  advance', (Date.now()-tA)/1000);
    if (sc.js) { await page.evaluate(sc.js); await page.evaluate(n => window.__office.advance(n), sc.after || 1); }
    await page.waitForTimeout(400);
  }
  const file = join(out, name + '.png');
  await page.screenshot({ path: file, timeout: 180000 });
  console.log(`${name}: ${file} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (errors.length) console.log('  ' + [...new Set(errors)].slice(0, 12).join('\n  '));
  await ctx.close();
}
await browser.close();
