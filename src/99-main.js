// =============================================================================
//  Main loop
// =============================================================================
const clock = new THREE.Clock();
let elapsed = 0;
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); document.getElementById('fallback').classList.add('show'); });

function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  elapsed += dt;
  for (const fn of updaters) fn(dt, elapsed);
  controls.update();
  composer.render();
  requestAnimationFrame(frame);
}
refreshSessions();
// Compile every shader behind the intro curtain first, so the logo animation
// and the fly-in never stutter. ?test renders on demand for headless capture.
const ready = (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve()).catch(() => {});
ready.then(() => {
  startIntro();
  if (IS_TEST && !QS.has('live')) composer.render();
  else { clock.getDelta(); requestAnimationFrame(frame); }
});

// Small hook for automated screenshots and curious people in the console.
window.__office = {
  THREE, scene, camera, controls, people, cats, rooms, live, SETTINGS: () => SETTINGS,
  focusRoom, focusExec, goOverview, refreshSessions,
  setStates(list) { live.mode = 'live'; live.sessions = list; refreshSessions(); },
  tick(sec, step = 1 / 30) { for (let t = 0; t < sec; t += step) { elapsed += step; for (const fn of updaters) fn(step, elapsed); } },
  advance(sec, step = 1 / 30) { for (let t = 0; t < sec; t += step) { elapsed += step; for (const fn of updaters) fn(step, elapsed); controls.update(); } composer.render(); },
};
