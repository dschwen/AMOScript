/* jshint esversion: 6 */
'use strict';
module.exports = async function roller2IntroProbe(page) {
  const fs = require('fs'), path = require('path'), directory = path.join(__dirname, '../../examples/Roller2');
  const assets = Object.fromEntries(['music/Roller_II_Samples.Abk', 'music/mod.Roller_II_mus', 'iffp/terminator el', 'iffp/roller titel'].map(name => [`rii:${name.toLowerCase()}`, fs.readFileSync(path.join(directory, name)).toString('base64')]));
  return page.evaluate(async ({ source, assets, timerSource, firstPNG, titlePNG, titleIndices, gpuSources }) => {
    const module = { exports: {} }; new Function('module', source)(module);
    const createClock = new Function(`return (${timerSource});`)();
    const files = { isDirectory: name => name === 'RII:', read(name) {
      const bytes = assets[name.toLowerCase()]; if (!bytes) throw new Error(`Asset not preloaded: ${name}`); return atob(bytes);
    } };
    const check = (value, message) => { if (!value) throw new Error(message); };
    async function pixels(png, height) {
      const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = height;
      canvas.getContext('2d').drawImage(image, 0, 0); return canvas.getContext('2d').getImageData(0, 0, 320, height).data;
    }
    const first = await pixels(firstPNG, 256), title = await pixels(titlePNG, 512);
    const indices = Uint8Array.from(atob(titleIndices), c => c.charCodeAt(0));
    const factory = name => new Function(`return (${gpuSources[name]});`)();
    const model = factory('model')(), sprites = factory('sprites')();
    const createGpu = factory('renderer')(model, sprites, factory('resources')(model), factory('shaders'), factory('layout'));
    function releaseGpu(gpu) {
      if (!gpu) return; const gl = gpu.resources.context; gpu.dispose(); const ext = gl.getExtension('WEBGL_lose_context');
      if (ext && !gl.isContextLost()) ext.loseContext();
    }
    let gpuFrames = 0, gpuUnavailable = null, frames = 0;
    for (const input of ['keyboard', 'mouse', 'gamepad']) {
      const clock = createClock(4), program = module.exports({ files, now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
      const canvas = document.createElement('canvas'); canvas.tabIndex = 0; document.body.append(canvas);
      let pad = null, gpu = null, gpuHost = null;
      const host = AMOS_BROWSER.createCanvasHost(canvas, { requestAnimationFrame: () => 1, cancelAnimationFrame() {}, hasFocus: () => true,
        getGamepads: () => [pad], joysticks: [{ port: 1, keyboard: false, gamepad: true }] });
      if (input === 'keyboard') {
        try { gpu = createGpu(document.createElement('canvas')); } catch (error) { gpuUnavailable = error.message; }
        if (gpu) gpuHost = AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas, { renderer: gpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
      }
      function capture(name, step, main, offset = 0) {
        host.render(); const height = main ? 268 : 256, expected = main ? title : first;
        const actual = canvas.getContext('2d').getImageData(0, 0, 320, height).data, cpu = program.display.renderDisplay();
        for (let i = 0; i < actual.length; i++) {
          const pixel = Math.floor(i / 4), original = pixel + offset * 320, channel = i % 4;
          const limit = main && indices[original] >= 32 ? step >> 1 : step;
          const value = channel === 3 ? 255 : main ? Math.min(limit, expected[original * 4 + channel] / 17) * 17 : Math.max(0, expected[i] - step * 17);
          check(actual[i] === value, `${name}: independent Canvas pixel ${i} differs`);
          const at = pixel * 8 + channel; check(cpu[at] === value && cpu[at + 4] === value, `${name}: independent copper pixel ${i} differs`);
        }
        if (globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: `Canvas: ${name}`, width: 320, height, rgba: actual });
        if (gpuHost) {
          const previous = program.display.canvasFrame; program.display.canvasFrame = () => { throw new Error('GPU used CPU presentation'); };
          try { gpuHost.render(); } finally { program.display.canvasFrame = previous; }
          const actual = gpu.readPixels(); check(gpu.stats.lastResult.backend === 'gpu' && actual.length === cpu.length && actual.every((v, i) => v === cpu[i]), `${name}: GPU frame differs`);
          gpuFrames++;
          if (globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: `WebGL: ${name}`, width: 640, height, rgba: actual });
        }
        frames++;
      }
      try {
        host.attach(program); if (gpuHost) gpuHost.attach(program); program.tick(1000); clock.tick(1000); host.render();
        check(program.display.screen().height === 256 && program.state.waiting === null && program.state.frames.length === 1, 'Original WTIN was not reached');
        if (input === 'keyboard') {
          capture('intro waiting for input', 0, false);
          canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
          canvas.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
        } else if (input === 'mouse') {
          const r = canvas.getBoundingClientRect(); canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + 10, clientY: r.top + 10, buttons: 1, bubbles: true }));
        } else pad = { connected: true, mapping: 'standard', axes: [0, 0], buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 0 })) };
        clock.tick(4); check(program.state.waiting === 'sleep' && program.state.fade.active, `Original WTIN ignored ${input}`);
        if (input === 'keyboard') for (const time of [1004, 1020, 1440, 1860]) {
          clock.tick(time - clock.now()); capture(`intro fade-out (${time} ms)`, time < 1020 ? 0 : Math.min(15, Math.floor((time - 1020) / 60) + 1), false);
        }
        clock.tick(1904 - clock.now()); host.render(); if (gpuHost) gpuHost.render();
        check(!program.display.presentedScreen() && program.display.screen().height === 512, 'Title load did not preserve the tall bitmap while hidden');
        if (input === 'keyboard') for (const time of [1924, 1940, 2360, 2780, 2840]) {
          clock.tick(time - clock.now()); capture(`main title (${input}, ${time} ms)`, time < 1940 ? 0 : Math.min(15, Math.floor((time - 1940) / 60) + 1), true);
        } else { clock.tick(2840 - clock.now()); capture(`main title (${input})`, 15, true); }
        check(program.state.waiting === 'key' && !program.state.fade.active && program.mouseVisible(), 'Original intro/title handoff failed to finish');
        check(program.display.screen().physicalPixels.every((v, i) => v === indices[i]), 'Tall source bitmap changed');
        if (input === 'keyboard') { program.display.screenOffset(0, 0, 240); capture('lower title bitmap viewport', 15, true, 240); }
      } finally { host.detach(); if (gpuHost) gpuHost.detach(); program.stop(); releaseGpu(gpu); canvas.remove(); }
    }

    if (globalThis.AMOS_ROLLER2_INTRO_CLEANUP) await globalThis.AMOS_ROLLER2_INTRO_CLEANUP();
    const old = document.getElementById('roller2-intro-controls'); if (old) old.remove();
    const controls = document.createElement('section'); controls.id = 'roller2-intro-controls';
    const help = document.createElement('p'); help.textContent = 'Original intro lines 1–20 and WTIN/FDZ/FLOAD run unchanged. Press a key, click the image or use gamepad fire to leave the intro. A declared harness then runs original main-title load 287, skipping game initialization 21–286. The menu/game is not running. This preview is silent; tracker commands continue.';
    const viewport = document.createElement('section'); viewport.id = 'roller2-intro-viewport';
    const toolbar = document.createElement('div'); toolbar.className = 'amos-fullscreen-toolbar'; const slot = document.createElement('div');
    function makeSurface() { const c = document.createElement('canvas'); c.id = 'roller2-intro-input'; c.tabIndex = 0; c.setAttribute('aria-label', 'Original Roller II intro; key, click or gamepad fire advances'); return c; }
    let surface = makeSurface(), gpu = null; slot.append(surface);
    const status = document.createElement('p'), fullButton = document.createElement('button'), fullStatus = document.createElement('span');
    fullButton.id = 'roller2-intro-fullscreen'; toolbar.append(fullButton, fullStatus); viewport.append(toolbar, slot, status); controls.append(help, viewport); document.body.append(controls);
    try { gpu = createGpu(surface); } catch (_) {
      const gl = surface.getContext('webgl2'), ext = gl && gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext();
      surface = makeSurface(); slot.replaceChildren(surface);
    }
    let live = null, adapter = null, error = '', disposed = false;
    function update() {
      if (!live) return;
      controls.dataset.phase = error ? 'error' : live.state.halted ? 'ended' : live.state.stopped ? 'stopped' : live.state.waiting === 'key' ? 'title-ready' : live.state.fade.active ? 'fading' : live.display.screen().height === 512 ? 'title-loading' : live.state.waiting === 'sleep' ? 'loading' : 'waiting-input';
      controls.dataset.backend = gpu ? 'webgl' : 'canvas'; controls.dataset.bitmapHeight = String(live.display.screen().height); controls.dataset.gpuFrames = String(gpu ? gpu.stats.gpuFrames : 0);
      status.textContent = error || `${controls.dataset.phase}; ${gpu ? 'WebGL2' : 'Canvas 2D (WebGL unavailable)'}; main menu/game excluded`; fullscreen.refresh();
    }
    function fail(failure) { error = failure.message; if (live) live.stop(); update(); }
    function start() {
      if (adapter) adapter.detach(); if (live) live.stop(); if (gpu) gpu.clear(); error = '';
      live = module.exports({ files, now: () => performance.now(), clearTimeout, setTimeout(fn, delay) {
        return setTimeout(() => { if (!disposed) { try { fn(); } catch (failure) { fail(failure); } } }, delay);
      } });
      adapter = AMOS_BROWSER.createCanvasHost(surface, { renderer: gpu, joysticks: [{ port: 1, keyboard: false, gamepad: true }] });
      adapter.attach(live); live.tick(1000); adapter.focus(); update();
    }
    for (const action of ['restart', 'stop', 'resume']) {
      const button = document.createElement('button'); button.id = `roller2-intro-${action}`; button.textContent = action;
      button.addEventListener('click', () => { try { if (action === 'restart') start(); else if (action === 'stop') live.stop(); else if (!error) live.resume(); adapter.focus(); update(); } catch (failure) { fail(failure); } }); toolbar.append(button);
    }
    const fullscreen = AMOS_FULLSCREEN.createFullscreenHost(viewport, { button: fullButton, statusElement: fullStatus, surface: slot, getContent: () => surface });
    start(); const monitor = setInterval(update, 50);
    globalThis.AMOS_ROLLER2_INTRO_CLEANUP = () => { disposed = true; clearInterval(monitor); adapter.detach(); live.stop(); releaseGpu(gpu); return fullscreen.dispose(); };
    return { inputModes: 3, frames, gpuFrames, gpuUnavailable, fullBitmap: [320, 512], viewport: [320, 268], declaredMainTitleHandoff: true, gameRunning: false };
  }, { source: new(require('../../lib/Transpiler'))(require('./roller2Intro')()).toModule(), assets, timerSource: require('./fakeTimers').createFakeTimers.toString(),
    firstPNG: fs.readFileSync(path.join(__dirname, '../fixtures/roller2/terminator-el.png')).toString('base64'), titlePNG: fs.readFileSync(path.join(__dirname, '../fixtures/roller2/roller-title.png')).toString('base64'),
    titleIndices: fs.readFileSync(path.join(__dirname, '../fixtures/roller2/roller-title.indices')).toString('base64'), gpuSources: require('./webglHostSources')() });
};
