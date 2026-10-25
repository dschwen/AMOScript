/* jshint esversion: 6 */
'use strict';
module.exports = async function roller2TitleProbe(page) {
  const fs = require('fs'), path = require('path'), directory = path.join(__dirname, '../../examples/Roller2');
  const assets = Object.fromEntries(['music/Roller_II_Samples.Abk', 'music/mod.Roller_II_mus', 'iffp/terminator el'].map(name => [`rii:${name.toLowerCase()}`, fs.readFileSync(path.join(directory, name)).toString('base64')]));
  return page.evaluate(async ({ source, assets, timerSource, golden, gpuSources }) => {
    const module = { exports: {} }; new Function('module', source)(module);
    const createTimers = new Function(`return (${timerSource});`)();
    const files = { isDirectory: name => name === 'RII:', read(name) {
      const bytes = assets[name.toLowerCase()]; if (!bytes) throw new Error(`Asset not preloaded: ${name}`); return atob(bytes);
    } };
    const check = (value, message) => { if (!value) throw new Error(message); };
    const image = new Image(); image.src = `data:image/png;base64,${golden}`; await image.decode();
    const reference = document.createElement('canvas'); reference.width = 320; reference.height = 256;
    reference.getContext('2d').drawImage(image, 0, 0); const expected = reference.getContext('2d').getImageData(0, 0, 320, 256).data;
    const factory = name => new Function(`return (${gpuSources[name]});`)();
    const model = factory('model')(), sprites = factory('sprites')();
    const createGpu = factory('renderer')(model, sprites, factory('resources')(model), factory('shaders'), factory('layout'));
    const releaseGpu = gpu => {
      if (!gpu) return; const gl = gpu.resources.context; gpu.dispose(); const extension = gl.getExtension('WEBGL_lose_context');
      if (extension && !gl.isContextLost()) extension.loseContext();
    };
    const timers = createTimers(), program = module.exports({ files, now: timers.now, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout });
    const canvas = document.createElement('canvas'), gpuCanvas = document.createElement('canvas');
    const host = AMOS_BROWSER.createCanvasHost(canvas, { requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    let gpu = null, gpuHost = null, gpuUnavailable = null, gpuFrames = 0;
    try { gpu = createGpu(gpuCanvas); } catch (error) { gpuUnavailable = error.message; }
    if (gpu) gpuHost = AMOS_BROWSER.createCanvasHost(gpuCanvas, { renderer: gpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    try {
      host.attach(program); if (gpuHost) gpuHost.attach(program); program.tick(1000);
      host.render(); if (gpuHost) gpuHost.render(); check(!program.display.presentedScreen(), 'FLOAD did not hide the image before Wait Vbl');
      for (const time of [20, 40, 100, 460, 880, 920, 940]) {
        timers.tick(time - timers.now()); host.render();
        const actual = canvas.getContext('2d').getImageData(0, 0, 320, 256).data, cpu = program.display.renderDisplay();
        const step = time < 40 ? 0 : Math.min(15, Math.floor((time - 40) / 60) + 1);
        for (let i = 0; i < actual.length; i++) {
          const value = i % 4 === 3 ? 255 : Math.min(step, expected[i] / 17) * 17;
          check(actual[i] === value, `Original Canvas pixel differs at ${time} ms, byte ${i}`);
          const pixel = Math.floor(i / 4), at = pixel * 8 + i % 4;
          check(cpu[at] === value && cpu[at + 4] === value, `Original copper pixel differs at ${time} ms, byte ${i}`);
        }
        if (globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: `Canvas: first image (${time} ms)`, width: 320, height: 256, rgba: actual });
        if (gpuHost) {
          const previous = program.display.canvasFrame; program.display.canvasFrame = () => { throw new Error('GPU host called CPU presentation'); };
          try { gpuHost.render(); } finally { program.display.canvasFrame = previous; }
          const pixels = gpu.readPixels(); check(gpu.stats.lastResult.backend === 'gpu' && gpuCanvas.getContext('2d') === null, 'GPU fallback was used');
          check(pixels.length === cpu.length && pixels.every((v, i) => v === cpu[i]), `Original WebGL frame differs at ${time} ms`); gpuFrames++;
          if (globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: `WebGL: first image (${time} ms)`, width: 640, height: 256, rgba: pixels });
        }
      }
      check(program.state.waiting === 'key' && !program.state.fade.active && !program.display.screens.has(7), 'FLOAD did not finish and retire the palette clone');
      check(program.state.tracker.playing, 'Original music stopped during the image fade');
    } finally { host.detach(); if (gpuHost) gpuHost.detach(); program.stop(); releaseGpu(gpu); }

    if (globalThis.AMOS_ROLLER2_TITLE_CLEANUP) await globalThis.AMOS_ROLLER2_TITLE_CLEANUP();
    const old = document.getElementById('roller2-title-controls'); if (old) old.remove();
    const controls = document.createElement('section'); controls.id = 'roller2-title-controls';
    const help = document.createElement('p'); help.textContent = 'Live first image: unchanged startup lines 1–18 and original FLOAD (63–68), with a synthetic Wait Key before WTIN. This preview is silent; logical music continues. It is not the main Roller II title/menu or gameplay. Restart replays the original fade.';
    const viewport = document.createElement('section'), toolbar = document.createElement('div'), slot = document.createElement('div');
    viewport.id = 'roller2-title-viewport'; toolbar.className = 'amos-fullscreen-toolbar';
    function makeSurface() {
      const canvas = document.createElement('canvas'); canvas.id = 'roller2-title-input'; canvas.tabIndex = 0;
      canvas.setAttribute('aria-label', 'Original Roller II first image; any key ends the bounded fixture'); return canvas;
    }
    let surface = makeSurface(); slot.append(surface);
    const status = document.createElement('p'); status.id = 'roller2-title-status';
    const fullscreenButton = document.createElement('button'); fullscreenButton.id = 'roller2-title-fullscreen';
    const fullscreenStatus = document.createElement('span'); toolbar.append(fullscreenButton, fullscreenStatus);
    viewport.append(toolbar, slot, status); controls.append(help, viewport); document.body.append(controls);
    let live = null, adapter = null, liveGpu = null, error = '', disposed = false;
    try { liveGpu = createGpu(surface); } catch (_) {
      // A failed shader/device initialization may already own a WebGL context;
      // Canvas fallback therefore needs a fresh, explicitly labelled surface.
      const gl = surface.getContext('webgl2'), extension = gl && gl.getExtension('WEBGL_lose_context');
      if (extension && !gl.isContextLost()) extension.loseContext();
      surface = makeSurface(); slot.replaceChildren(surface);
    }
    function update() {
      if (!live) return;
      controls.dataset.phase = error ? 'error' : live.state.halted ? 'ended' : live.state.stopped ? 'stopped' : live.state.fade.active ? 'fading' : live.state.waiting === 'key' ? 'ready' : 'loading';
      controls.dataset.backend = liveGpu ? 'webgl' : 'canvas';
      controls.dataset.gpuFrames = String(liveGpu ? liveGpu.stats.gpuFrames : 0);
      status.textContent = error || `${controls.dataset.phase}; ${liveGpu ? 'WebGL2' : 'Canvas 2D (WebGL unavailable)'}; original first image, before WTIN`;
      fullscreen.refresh();
    }
    function fail(failure) { error = failure.message; if (live) live.stop(); update(); }
    function start() {
      if (adapter) adapter.detach(); if (live) live.stop(); if (liveGpu) liveGpu.clear(); error = '';
      live = module.exports({ files, now: () => performance.now(), clearTimeout,
        setTimeout(fn, delay) { return setTimeout(() => { if (!disposed) { try { fn(); } catch (failure) { fail(failure); } } }, delay); } });
      adapter = AMOS_BROWSER.createCanvasHost(surface, { renderer: liveGpu }); adapter.attach(live); live.tick(1000); update();
    }
    for (const action of ['restart', 'stop', 'resume']) {
      const button = document.createElement('button'); button.id = `roller2-title-${action}`; button.textContent = action;
      button.addEventListener('click', () => { try { if (action === 'restart') start(); else if (action === 'stop') live.stop(); else if (!error) live.resume(); update(); } catch (failure) { fail(failure); } }); toolbar.append(button);
    }
    const fullscreen = AMOS_FULLSCREEN.createFullscreenHost(viewport, { button: fullscreenButton, statusElement: fullscreenStatus, surface: slot, getContent: () => surface });
    start(); const monitor = setInterval(update, 50);
    globalThis.AMOS_ROLLER2_TITLE_CLEANUP = () => {
      disposed = true; clearInterval(monitor); adapter.detach(); live.stop(); releaseGpu(liveGpu); return fullscreen.dispose();
    };
    return { originalPrefix: 18, originalProcedure: [63, 68], frames: 7, gpuFrames, gpuUnavailable, origin: [128, 42], image: [320, 256], paletteCloneRetired: true, gameRunning: false };
  }, { source: new(require('../../lib/Transpiler'))(require('./roller2Title')()).toModule(), assets,
    timerSource: require('./fakeTimers').createFakeTimers.toString(), golden: fs.readFileSync(path.join(__dirname, '../fixtures/roller2/terminator-el.png')).toString('base64'), gpuSources: require('./webglHostSources')() });
};
