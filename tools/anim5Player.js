/* jshint esversion: 6 */
'use strict';

// Live original-program host, serialized into the ANIM-5 gallery page.
function installAnim5Player({ sources, assets, gpuSources, sourceNames = ['Logoanim.amos', 'Logoanim.Bak'], finishHint = 'Click the animation to finish its final logo sequence.', audioSource = null, sessionSource = null }) {
  const root = document.getElementById('animation-player');
  const make = source => new Function(`return (${source});`)();
  const toolbar = document.createElement('div'), slot = document.createElement('div'), status = document.createElement('p');
  const version = document.createElement('select'); version.id = 'animation-version'; version.setAttribute('aria-label', 'Original intro version');
  for (const name of sourceNames) version.add(new Option(name, name));
  toolbar.append(version);
  const buttons = {};
  for (const [action, label] of Object.entries({ play: 'Play Animation', stop: 'Pause', resume: 'Resume', restart: 'Restart', fullscreen: 'Fullscreen' })) {
    const button = document.createElement('button'); button.type = 'button'; button.id = `animation-${action}`; button.textContent = label; toolbar.append(button); buttons[action] = button;
  }
  status.id = 'animation-status'; status.setAttribute('role', 'status'); status.textContent = `Play the original intro. ${finishHint}`;
  toolbar.className = 'amos-fullscreen-toolbar'; status.className = 'amos-fullscreen-messages';
  buttons.play.style.cssText = 'background:#c71920;color:white;border:0;border-radius:.5rem;font-size:1.4rem;padding:.8rem 1.5rem';
  root.append(toolbar, slot, status);
  let canvas = null, program = null, host = null, gpu = null, revision = 0, disposed = false, failure = '';
  const sound = audioSource ? make(sessionSource)(make(audioSource)) : null;
  let soundButton = null;
  if (sound) { soundButton = document.createElement('button'); soundButton.id = 'animation-sound'; toolbar.append(soundButton); soundButton.onclick = () => { if (sound.status().requested) sound.mute(); else sound.enable().then(update); update(); }; }
  const fullscreen = AMOS_FULLSCREEN.createFullscreenHost(root, { button: buttons.fullscreen, surface: slot, getContent: () => canvas });
  function update() {
    root.dataset.phase = disposed ? 'disposed' : failure ? 'error' : !program ? 'idle' : program.state.halted ? 'ended' : program.state.stopped ? 'paused' : 'running';
    if (soundButton) { soundButton.textContent = sound.status().requested ? 'Mute sound' : 'Enable sound'; root.dataset.sound = sound.status().state; root.dataset.plays = String(sound.status().plays); }
    root.dataset.waiting = program ? program.state.waiting || '' : '';
    root.dataset.backend = gpu ? 'webgl' : 'canvas';
    root.dataset.frameAddress = program ? String(program.state.variables.int_f || 0) : '0';
    status.textContent = failure || (!program ? `Play the original intro. ${finishHint}` : program.state.halted ? 'Intro finished. Play again or choose another version.' : program.state.stopped ? 'Paused.' : `Playing the original intro. ${finishHint}`);
    if (sound && sound.status().error) status.textContent += ` Sound unavailable: ${sound.status().error}`;
    buttons.stop.disabled = !program || program.state.stopped || program.state.halted;
    buttons.resume.disabled = !program || !program.state.stopped || program.state.halted || !!failure;
    fullscreen.refresh();
  }
  function release() {
    revision++; if (host) host.detach(); if (program) program.stop();
    host = null; program = null;
    if (gpu) { const gl = gpu.resources.context; gpu.dispose(); gpu = null; const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext(); }
  }
  function fail(error) { failure = error.message; if (program) program.stop(); update(); }
  function start() {
    if (disposed) return;
    release(); failure = ''; const token = revision;
    canvas = document.createElement('canvas'); canvas.tabIndex = 0; canvas.width = 320; canvas.height = 200;
    canvas.id = 'animation-input'; canvas.setAttribute('aria-label', 'Live AMOS intro');
    canvas.style.cssText = 'display:block;width:640px;max-width:100%;image-rendering:pixelated;background:black'; slot.replaceChildren(canvas);
    try {
      const model = make(gpuSources.model)(), sprites = make(gpuSources.sprites)();
      gpu = make(gpuSources.renderer)(model, sprites, make(gpuSources.resources)(model), make(gpuSources.shaders), make(gpuSources.layout))(canvas);
    } catch (_) {
      const gl = canvas.getContext('webgl2'), ext = gl && gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
      const fallback = canvas.cloneNode(); canvas.replaceWith(fallback); canvas = fallback;
    }
    try {
      const module = { exports: {} }; new Function('module', sources[version.value])(module);
      program = module.exports({ audio: sound ? sound.bind() : undefined, files: { read(name) { const value = assets[name.toLowerCase()]; if (!value) throw Error(`Missing asset: ${name}`); return atob(value); }, write() { throw Error('Intro does not write files'); } },
        now: () => performance.now(), clearTimeout, setTimeout(fn, delay) { return setTimeout(() => { if (!disposed && token === revision) try { fn(); } catch (error) { fail(error); } }, delay); } });
      host = AMOS_BROWSER.createCanvasHost(canvas, { renderer: gpu }); host.attach(program); program.tick(10000); host.render(); host.focus(); update();
    } catch (error) { fail(error); }
  }
  buttons.play.onclick = async () => {
    const token = revision; buttons.play.disabled = true;
    try {
      if (sound) await sound.enable();
      if (disposed || token !== revision) return;
      if (!program || program.state.halted || failure) start();
      else { program.resume(); host.focus(); update(); }
    } finally { buttons.play.disabled = false; }
  };
  buttons.stop.onclick = () => { if (program) program.stop(); update(); };
  buttons.resume.onclick = () => { if (program && !failure) { program.resume(); host.focus(); } update(); };
  buttons.restart.onclick = start; version.onchange = start;
  const monitor = setInterval(update, 50);
  const dispose = () => { if (disposed) return; disposed = true; clearInterval(monitor); release(); if (sound) sound.dispose(); update(); fullscreen.dispose(); window.removeEventListener('pagehide', dispose); };
  window.addEventListener('pagehide', dispose); update();
}
module.exports = installAnim5Player;
