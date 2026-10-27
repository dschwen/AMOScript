/* jshint esversion: 6 */
'use strict';
module.exports = async function roller2GameProbe(page) {
  const fs = require('fs'), path = require('path'), directory = path.join(__dirname, '../../examples/Roller2');
  const currentAssets = require('./roller2CurrentAssets')();
  const assets = Object.fromEntries(Object.entries(currentAssets).map(([name, bytes]) => [name, Buffer.from(bytes, 'latin1').toString('base64')]));
  const images = ['terminator-el.png', 'current-roller-title.png'];
  return page.evaluate(async ({ source, assets, images, replaySource, editorReplaySource, filesSource, timerSource, gpuSources, audioSource, sessionSource, launchSource, liveOnly = false }) => {
    const compiled = { exports: {} }; new Function('module', source)(compiled);
    const make = text => new Function(`return (${text});`)(), replay = make(replaySource), makeFiles = make(filesSource), makeClock = make(timerSource);
    const initial = Object.fromEntries(Object.entries(assets).map(([name, value]) => [name, atob(value)]));
    const model = make(gpuSources.model)(), sprites = make(gpuSources.sprites)();
    const createGpu = make(gpuSources.renderer)(model, sprites, make(gpuSources.resources)(model), make(gpuSources.shaders), make(gpuSources.layout));
    const release = gpu => { if (!gpu) return; const gl = gpu.resources.context; gpu.dispose(); const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext(); };
    const goldens = liveOnly ? {} : Object.fromEntries(await Promise.all(Object.entries(images).map(async ([name, bytes]) => {
      const image = new Image(); image.src = `data:image/png;base64,${bytes}`; await image.decode(); const c = document.createElement('canvas'); c.width = image.width; c.height = image.height; c.getContext('2d').drawImage(image, 0, 0);
      return [name, c.getContext('2d').getImageData(0, 0, c.width, c.height).data];
    })));
    const check = (value, message) => { if (!value) throw Error(message); };
    const results = []; let frames = 0, gpuFrames = 0, independent = 0, emptyFrames = 0, emptyGpuFrames = 0;
    for (const mode of liveOnly ? [] : ['keyboard', 'gamepad']) {
      const surface = document.createElement('canvas'); surface.tabIndex = 0; document.body.append(surface);
      let host, gpu = null, gpuHost = null, pad = null, held = null;
      const key = (type, code) => surface.dispatchEvent(new KeyboardEvent(type, { code, key: code === 'KeyA' ? 'a' : code, bubbles: true, cancelable: true }));
      try {
        results.push(replay(compiled.exports, makeClock(4), makeFiles(initial), p => {
          host = AMOS_BROWSER.createCanvasHost(surface, { mouseCoordinates: 'hardware', hasFocus: () => true, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, getGamepads: () => [pad], joysticks: [{ port: 1, keyboard: { fire: ['Enter'] }, gamepad: true }] }); host.attach(p);
          if (mode === 'keyboard') { gpu = createGpu(document.createElement('canvas')); gpuHost = AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas, { renderer: gpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} }); gpuHost.attach(p); }
          return {
            joy(mask) {
              if (held) key('keyup', held); held = null;
              if (mode === 'keyboard') { held = mask === 16 ? 'Enter' : mask === 8 ? 'ArrowRight' : mask === 4 ? 'ArrowLeft' : mask === 1 ? 'ArrowUp' : mask === 2 ? 'ArrowDown' : null; if (held) key('keydown', held); }
              else pad = { index: 0, connected: true, mapping: 'standard', axes: [mask === 8 ? 1 : mask === 4 ? -1 : 0, mask === 1 ? -1 : mask === 2 ? 1 : 0], buttons: [{ pressed: mask === 16, value: mask === 16 ? 1 : 0 }] };
            },
            key(code) { key('keydown', code); key('keyup', code); }, dispose() { if (held) key('keyup', held); host.detach(); }
          };
        }, (name, p, oracle, rows) => {
          host.render(); const actual = surface.width && surface.height ? surface.getContext('2d').getImageData(0, 0, surface.width, surface.height).data : new Uint8ClampedArray(0), expected = (p.display.canvasFrame() || { rgba: new Uint8ClampedArray(0) }).rgba;
          check(actual.length === expected.length && actual.every((v, i) => v === expected[i]), `${mode} full-source Canvas mismatch: ${name}`);
          if (oracle) { const golden = goldens[oracle]; for (let i = 0; i < 320 * rows * 4; i++) check(actual[i] === golden[i], `${name}: independent pixel ${i}: ${actual[i]} != ${golden[i]}`); independent++; }
          if (actual.length && globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: `${mode}: ${name}`, width: surface.width, height: surface.height, rgba: actual }); if (actual.length) frames++; else emptyFrames++;
          if (gpuHost) {
            const previous = p.display.canvasFrame; p.display.canvasFrame = () => { throw Error('GPU used CPU presentation'); }; try { gpuHost.render(); } finally { p.display.canvasFrame = previous; }
            if (!actual.length) {
              check(gpu.stats.lastResult === null && gpu.resources.context.canvas.width === 0, 'Missing screen retained GPU presentation');
              let retired = false; try { gpu.readPixels(); } catch (error) { retired = /no frame/.test(error.message); }
              check(retired, 'GPU retained removed-screen readback'); emptyGpuFrames++; return;
            }
            const pixels = gpu.readPixels(), cpu = p.display.renderDisplay(); check(gpu.stats.lastResult.backend === (cpu.length ? 'gpu' : 'gpu-empty') && pixels.length === cpu.length && pixels.every((v, i) => v === cpu[i]), `Full-source GPU mismatch: ${name}`);
            if (pixels.length && globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: `WebGL: ${name}`, width: gpu.stats.lastResult.width, height: gpu.stats.lastResult.lines, rgba: pixels }); if (pixels.length) gpuFrames++; else emptyGpuFrames++;
          }
        }));
      } finally { if (host) host.detach(); if (gpuHost) gpuHost.detach(); release(gpu); surface.remove(); }
    }
    let editorHost = null, editorGpu = null, editorGpuHost = null, editorFrames = 0, editorGpuFrames = 0;
    const editorSurface = document.createElement('canvas'); document.body.append(editorSurface);
    let editor;
    if (!liveOnly) try {
      editorGpu = createGpu(document.createElement('canvas'));
      editor = make(editorReplaySource)(compiled.exports, makeClock(4), makeFiles(initial), p => {
        editorHost = AMOS_BROWSER.createCanvasHost(editorSurface, { mouseCoordinates: 'hardware', requestAnimationFrame: () => 1, cancelAnimationFrame() {} }); editorHost.attach(p);
        editorGpuHost = AMOS_BROWSER.createCanvasHost(editorGpu.resources.context.canvas, { renderer: editorGpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} }); editorGpuHost.attach(p);
        return {
          key(name = 'a') { for (const type of ['keydown', 'keyup']) editorSurface.dispatchEvent(new KeyboardEvent(type, { code: name === 'Escape' ? 'Escape' : `Key${name.toUpperCase()}`, key: name, bubbles: true })); },
          mouse(x, y, buttons) {
            editorHost.render(); const rect = editorSurface.getBoundingClientRect(), frame = p.display.snapshotDisplay().frame;
            const sx = rect.width / editorSurface.offsetWidth, sy = rect.height / editorSurface.offsetHeight;
            editorSurface.dispatchEvent(new PointerEvent('pointermove', { clientX: rect.left + editorSurface.clientLeft * sx + (x - frame.origin.x + .25) * editorSurface.clientWidth * sx / (frame.outputWidth / 2), clientY: rect.top + editorSurface.clientTop * sy + (y - frame.origin.y + .25) * editorSurface.clientHeight * sy / frame.lines, buttons, bubbles: true }));
          }, dispose() {}
        };
      }, (name, p) => {
        editorHost.render(); const expected = p.display.canvasFrame(), actual = editorSurface.getContext('2d').getImageData(0, 0, expected.width, expected.height).data;
        check(actual.length === expected.rgba.length && actual.every((v, i) => v === expected.rgba[i]), `Editor Canvas mismatch: ${name}`); editorFrames++;
        const previous = p.display.canvasFrame; p.display.canvasFrame = () => { throw Error('Editor GPU used CPU presentation'); };
        try { editorGpuHost.render(); } finally { p.display.canvasFrame = previous; }
        const gpuPixels = editorGpu.readPixels(), cpu = p.display.renderDisplay();
        check(editorGpu.stats.lastResult.backend === 'gpu' && gpuPixels.length === cpu.length && gpuPixels.every((v, i) => v === cpu[i]), `Editor GPU mismatch: ${name}`); editorGpuFrames++;
        if (globalThis.AMOS_DEMO_OBSERVE) {
          globalThis.AMOS_DEMO_OBSERVE({ name: `Canvas: ${name}`, width: expected.width, height: expected.height, rgba: actual });
          globalThis.AMOS_DEMO_OBSERVE({ name: `WebGL: ${name}`, width: editorGpu.stats.lastResult.width, height: editorGpu.stats.lastResult.lines, rgba: gpuPixels });
        }
      });
    } finally { if (editorHost) editorHost.detach(); if (editorGpuHost) editorGpuHost.detach(); release(editorGpu); editorSurface.remove(); }
    if (globalThis.AMOS_ROLLER2_GAME_CLEANUP) await globalThis.AMOS_ROLLER2_GAME_CLEANUP();
    const previous = document.getElementById('roller2-game-controls'); if (previous) previous.remove();
    const controls = document.createElement('section'); controls.id = 'roller2-game-controls';
    const help = document.createElement('p'); help.textContent = 'Roller II with the level-3 time-bonus crash fixed and the current supplied assets. Press a key at the logo; Enter/gamepad fire starts the game and exits ready prompts. Arrows move; Space pauses; M/F toggle music/effects. Escape returns to title after fullscreen exits. The current supplied assets include the restored high-score image; game over returns through scores to the title. H opens the title-menu scores view. Click Editor on the title to open the original overlapping editor windows and place tiles with the mouse. Press T to test the edited level; Escape returns through the original key prompt. Editor save/load and other actions remain unverified. Errors require Restart. File writes stay in session memory and disappear on page reload; IndexedDB remains planned.';
    const viewport = document.createElement('section'); viewport.id = 'roller2-game-viewport'; const toolbar = document.createElement('div'); toolbar.className = 'amos-fullscreen-toolbar'; const slot = document.createElement('div'), status = document.createElement('pre');
    const fullButton = document.createElement('button'), fullStatus = document.createElement('span'); fullButton.id = 'roller2-game-fullscreen'; toolbar.append(fullButton, fullStatus);
    let surface = document.createElement('canvas'), gpu = null; surface.id = 'roller2-game-input'; surface.tabIndex = 0; surface.setAttribute('aria-label', 'Complete Roller II game'); slot.append(surface); viewport.append(toolbar, slot, status); controls.append(help, viewport); (document.getElementById('game-player') || document.body).append(controls);
    try { gpu = createGpu(surface); } catch (_) { const gl = surface.getContext('webgl2'), ext = gl && gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); const next = surface.cloneNode(); surface.replaceWith(next); surface = next; }
    const sound = make(sessionSource)(make(audioSource)), files = makeFiles(initial); let live = null, host = null, disposed = false, revision = 0, error = '', launcher = null;
    const soundButton = document.createElement('button'); soundButton.id = 'roller2-game-sound'; toolbar.append(soundButton);
    function update() {
      if (!live) return; const v = live.state.variables, location = live.state.location, target = live.display.screens.get(0), s = sound.status();
      const phase = error ? 'error' : live.state.stopped ? 'stopped' : live.state.halted ? 'ended' : live.state.music.playing ? 'game-over' : location && location.line >= 1083 && location.line <= 1104 ? 'scores' : location && location.line >= 298 && location.line <= 316 && !live.state.fade.active ? 'menu' : location && location.line >= 324 && location.line <= 564 ? 'editor' : v.int_lv > 0 && (live.sprites.get(1) || {}).image > 0 ? 'game' : v.int_lv > 0 ? 'ready' : 'intro';
      Object.assign(controls.dataset, { phase, line: String(location ? location.line : 0), level: String(v.int_lv || 0), score: String(v.int_hi || 0), backend: gpu ? 'webgl' : 'canvas', sound: s.state, soundContext: s.contextState || 'none', soundVoices: String(s.voices.length), soundPlays: String(s.plays), writes: String(files.writes.length) });
      soundButton.textContent = ['on', 'starting'].includes(s.state) ? 'Mute sound' : 'Enable sound'; status.textContent = error || JSON.stringify({ phase, level: v.int_lv, score: v.int_hi, ball: [v.int_bx, v.int_by], line: location && location.line, audio: s.state, audioError: s.error, writesInSessionMemory: files.writes.length }, null, 2); fullscreen.refresh();
    }
    function fail(e) { error = e.message; if (launcher) launcher.cancel(); if (live) live.stop(); update(); }
    function start() {
      if (launcher) launcher.cancel();
      const token = ++revision; if (host) host.detach(); if (live) live.stop(); if (gpu) gpu.clear(); error = '';
      live = compiled.exports({ files, print() {}, audio: sound.bind(), now: () => performance.now(), clearTimeout, setTimeout(fn, delay) { return setTimeout(() => { if (!disposed && token === revision) { try { fn(); } catch (e) { fail(e); } } }, delay); } });
      host = AMOS_BROWSER.createCanvasHost(surface, { renderer: gpu, mouseCoordinates: 'hardware', joysticks: [{ port: 1, keyboard: { fire: ['Enter'] }, gamepad: true }] }); host.attach(live); live.tick(1000); host.focus(); update();
    }
    for (const action of ['restart', 'stop', 'resume']) { const button = document.createElement('button'); button.id = `roller2-game-${action}`; button.textContent = action; toolbar.append(button); button.onclick = () => { try { if (action === 'restart') start(); else if (action === 'stop') { launcher.cancel(); live.stop(); } else if (!error) live.resume(); host.focus(); update(); } catch (e) { fail(e); } }; }
    soundButton.onclick = () => { if (['on', 'starting'].includes(sound.status().state)) sound.mute(); else sound.enable().then(() => { if (!disposed) update(); }); host.focus(); update(); };
    const fullscreen = AMOS_FULLSCREEN.createFullscreenHost(viewport, { button: fullButton, statusElement: fullStatus, surface: slot, getContent: () => surface }); start(); const monitor = setInterval(update, 50);
    launcher = make(launchSource)({ sound, fullscreen, focus: () => host.focus(), update, fail,
      prepare() { if (error || live.state.halted) start(); else if (live.state.stopped) live.resume(); },
      release() {}, step: () => true
    });
    const play = () => launcher.play(); globalThis.AMOS_PLAY_GAME = play;
    globalThis.AMOS_ROLLER2_GAME_CLEANUP = async () => { disposed = true; revision++; launcher.dispose(); if (globalThis.AMOS_PLAY_GAME === play) delete globalThis.AMOS_PLAY_GAME; clearInterval(monitor); host.detach(); live.stop(); release(gpu); await Promise.all([fullscreen.dispose(), sound.dispose()]); update(); return sound.status(); };
    if (liveOnly) return play();
    return { frames, gpuFrames, independent, emptyFrames, emptyGpuFrames, editorFrames, editorGpuFrames, editor, replays: results, restoredImage: 'iffp/roller hi' };
  }, { source: new (require('../../lib/Transpiler'))(Buffer.from(currentAssets['rii:Roller II.AMOS'], 'latin1')).toModule(), assets,
    images: Object.fromEntries(images.map(name => [name, fs.readFileSync(path.join(__dirname, '../fixtures/roller2', name)).toString('base64')])), replaySource: require('./roller2CurrentReplay').toString(), editorReplaySource: require('./roller2EditorReplay').toString(), filesSource: require('./roller2GameFiles').toString(), timerSource: require('./fakeTimers').createFakeTimers.toString(), gpuSources: require('./webglHostSources')(), launchSource: require('../../tools/gameLauncher').toString(), audioSource: require('../../lib/amos/webAudio').createWebAudioHost.toString(), sessionSource: require('../../lib/amos/browserAudio').createBrowserAudioSession.toString() });
};
