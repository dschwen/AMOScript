/* jshint esversion: 6 */
'use strict';
// Public example harness, embedded by build_game_page.js. No source-specific
// startup keys: each game retains its own intro, menu and joystick behavior.
function installGamePage(createProgram, encodedAssets, createRenderer, port, fireKeys, debug, installUI) {
  const byId = id => document.getElementById(id), viewport = byId('game-viewport'), slot = byId('game-surface');
  const play = byId('play-game'), status = byId('game-status'), soundButton = byId('game-sound'), touchMode = byId('game-touch');
  let canvas = byId('game-input'), host = null, gpu = null, live = null, disposed = false, revision = 0, launch = 0, failure = '';
  const key = name => name.replace(/\\/g, '/').toLowerCase();
  const memory = AMOS_FILES.createMemoryFiles(Object.fromEntries(Object.entries(encodedAssets).map(([name, bytes]) => [key(name), atob(bytes)])));
  const files = { read: name => memory.read(key(name)), write: (name, bytes) => memory.write(key(name), bytes),
    exists: name => memory.exists(key(name)), isDirectory: name => memory.isDirectory(key(name)), select: request => memory.select(request) };
  const ui = installUI({ container: viewport, toolbar: viewport.querySelector('.amos-fullscreen-toolbar'), files: memory, debug });
  const sound = AMOS_BROWSER_AUDIO.createBrowserAudioSession(AMOS_WEB_AUDIO.createWebAudioHost);
  const fullscreen = AMOS_FULLSCREEN.createFullscreenHost(viewport, { button: byId('game-fullscreen'), statusElement: byId('fullscreen-status'), surface: slot, getContent: () => canvas });
  function update() {
    const audio = sound.status(); soundButton.textContent = audio.requested ? 'Mute sound' : 'Enable sound';
    status.textContent = (failure ? 'Game stopped after an error. Restart to try again.' : '') || (!live ? 'Click Play Game, then follow the game’s intro and menu prompts.' : live.state.halted ? 'Ended. Restart to play again.' : live.state.stopped ? 'Stopped.' : 'Running.') +
      (audio.error ? ` Sound unavailable: ${audio.error}` : '');
    viewport.dataset.phase = failure ? 'error' : !live ? 'idle' : live.state.halted ? 'ended' : live.state.stopped ? 'stopped' : 'running';
    viewport.dataset.sound = audio.state; viewport.dataset.backend = gpu ? 'webgl' : 'canvas';
    status.hidden = !!live && !failure && !live.state.halted && !live.state.stopped && !audio.error;
    ui.update({ phase: viewport.dataset.phase, location: live && live.state.location, error: failure, audio });
    fullscreen.refresh();
  }
  function fail(error) { ui.recordError(error); failure = error.message; if (live) live.stop(); if (host) host.detach(); update(); }
  function releaseGpu() { if (!gpu) return; const gl = gpu.resources.context; gpu.dispose(); gpu = null; const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext(); }
  function start() {
    revision++; const token = revision; failure = '';
    if (host) host.detach(); if (live) live.stop(); releaseGpu();
    const next = document.createElement('canvas'); next.id = 'game-input'; next.tabIndex = 0; next.width = 320; next.height = 256;
    next.setAttribute('aria-label', 'Game display'); canvas.replaceWith(next); canvas = next;
    if (createRenderer) try { gpu = createRenderer(canvas); } catch (_) {
      const gl = canvas.getContext('webgl2'), ext = gl && gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
      const fallback = canvas.cloneNode(); canvas.replaceWith(fallback); canvas = fallback;
    }
    const guard = fn => () => { if (!disposed && token === revision) try { fn(); } catch (error) { fail(error); } };
    live = createProgram({ files, audio: sound.bind(), now: () => performance.now(),
      setTimeout: (fn, ms) => setTimeout(guard(fn), ms), clearTimeout, print() {} });
    host = AMOS_BROWSER.createCanvasHost(canvas, { renderer: gpu, mouseCoordinates: 'hardware',
      joysticks: [{ port, keyboard: { fire: fireKeys }, gamepad: true }],
      virtualJoystick: { container: viewport, port, visibility: touchMode.value },
      requestAnimationFrame: fn => requestAnimationFrame(guard(fn)), cancelAnimationFrame });
    host.attach(live); live.tick(1000); host.focus(); update();
  }
  play.onclick = async () => {
    const token = ++launch; play.disabled = true;
    // Both permission requests happen before this handler's first await.
    const audio = sound.enable(), screen = fullscreen.status().active ? Promise.resolve(true) : fullscreen.toggle();
    try {
      await Promise.allSettled([audio, screen]);
      if (disposed || token !== launch) return;
      if (!live || live.state.halted || failure) start(); else if (live.state.stopped) live.resume();
      document.body.dataset.playing = 'true'; host.focus(); update();
    } catch (error) { fail(error); }
    finally { if (!disposed && token === launch) play.disabled = false; }
  };
  soundButton.onclick = () => { if (sound.status().requested) sound.mute(); else sound.enable().then(update); if (host) host.focus(); update(); };
  byId('game-restart').onclick = () => { launch++; play.disabled = false; try { start(); } catch (error) { fail(error); } };
  byId('game-stop').onclick = () => { launch++; play.disabled = false; if (live) live.stop(); update(); };
  byId('game-resume').onclick = () => { if (live && !failure) live.resume(); if (host) host.focus(); update(); };
  touchMode.onchange = () => { if (host) { host.setVirtualJoystickVisibility(touchMode.value); host.focus(); } };
  const monitor = setInterval(update, 100);
  function dispose() {
    if (disposed) return Promise.resolve(); disposed = true; revision++; launch++; clearInterval(monitor); ui.dispose();
    if (host) host.detach(); if (live) live.stop(); releaseGpu();
    window.removeEventListener('pagehide', dispose);
    return Promise.allSettled([sound.dispose(), fullscreen.dispose()]);
  }
  window.addEventListener('pagehide', dispose);
  // The embedding page may call this when unmounting an application view.
  globalThis.AMOS_GAME_PAGE = { dispose, files: memory, joystickStatus: () => host ? host.pollJoysticks() : [] };
  update();
}
module.exports = installGamePage;
