/* jshint esversion: 6 */
'use strict';

module.exports = async function saveIffProbe(page) {
  const fs = require('fs'), path = require('path'), Transpiler = require('../../lib/Transpiler');
  const { binary, token: t, integer: n, text } = require('./tokens');
  const bytes = fs.readFileSync(path.join(__dirname, '../../examples/Introideen/KugelanimBerech.amos'));
  return page.evaluate(async ({ source, reload, clockSource, decoderSource, uiSource, gpuSources }) => {
    if (globalThis.AMOS_SAVE_IFF_CLEANUP) globalThis.AMOS_SAVE_IFF_CLEANUP();
    const make = text => new Function(`return (${text});`)(), decode = make(decoderSource), clock = make(clockSource)();
    const stored = new Map(); let writes = 0, image = null, gpuFrames = 0, comparedPixels = 0, success = false;
    const files = { read(name) { if (!stored.has(name)) throw Error(`Missing ${name}`); return stored.get(name); },
      write(name, data) { writes++; stored.set(name, data); }, snapshot: () => Object.fromEntries(stored) };
    const area = document.createElement('section'); area.id = 'save-iff-export';
    const toolbar = document.createElement('div'), canvas = document.createElement('canvas'); canvas.tabIndex = 0;
    area.append(toolbar, canvas); document.body.append(area);
    const ui = make(uiSource)({ container: area, toolbar, files, debug: true });
    const model = make(gpuSources.model)(), sprites = make(gpuSources.sprites)();
    const gpu = make(gpuSources.renderer)(model, sprites, make(gpuSources.resources)(model), make(gpuSources.shaders), make(gpuSources.layout))(document.createElement('canvas'));
    const host = AMOS_BROWSER.createCanvasHost(canvas, { requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const gpuHost = AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas, { renderer: gpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const factory = code => { const module = { exports: {} }; new Function('module', code)(module); return module.exports; };
    const options = { files, now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout };
    const p = factory(source)(options); let loaded = null;
    const check = (value, message) => { if (!value) throw Error(message); };
    function capture(program, name, expected) {
      host.render(); const cpu = program.display.canvasFrame(), rgba = canvas.getContext('2d').getImageData(0, 0, 320, 200).data;
      for (let i = 0; i < expected.length; i++) {
        const value = expected[i] * 17;
        check(rgba[i * 4] === value && rgba[i * 4 + 1] === value && rgba[i * 4 + 2] === value && rgba[i * 4 + 3] === 255, `${name}: Canvas pixel ${i}`);
        comparedPixels++;
      }
      const previous = program.display.canvasFrame; program.display.canvasFrame = () => { throw Error('GPU used CPU presentation'); };
      try { gpuHost.render(); } finally { program.display.canvasFrame = previous; }
      const actual = gpu.readPixels(), reference = program.display.renderDisplay();
      check(gpu.stats.lastResult.backend === 'gpu' && actual.length === reference.length && actual.every((value, i) => value === reference[i]), `${name}: GPU differs`);
      gpuFrames++;
      if (globalThis.AMOS_DEMO_OBSERVE) {
        globalThis.AMOS_DEMO_OBSERVE({ name: `Canvas: ${name}`, width: cpu.width, height: cpu.height, rgba: cpu.rgba });
        globalThis.AMOS_DEMO_OBSERVE({ name: `WebGL: ${name}`, width: gpu.stats.lastResult.width, height: gpu.stats.lastResult.lines, rgba: actual });
      }
    }
    try {
      host.attach(p); gpuHost.attach(p); p.tick(400000);
      check(p.state.waiting === 'key' && p.state.location.line === 32 && writes === 0, 'Original generator did not wait before saving');
      const pixels = p.display.screen().pixels.slice(); capture(p, 'Original generator before Save Iff', pixels);
      host.focus();
      for (const type of ['keydown', 'keyup']) canvas.dispatchEvent(new KeyboardEvent(type, { code: 'KeyA', key: 'a', bubbles: true, cancelable: true }));
      clock.tick(0);
      check(p.state.halted && clock.pending() === 0 && writes === 1 && stored.has('rollerball'), 'Original save did not finish once');
      const bytes = Uint8Array.from(stored.get('rollerball'), c => c.charCodeAt(0)); image = decode(bytes);
      check(image.width === 320 && image.height === 200 && image.depth === 4 && image.compression === 1, 'Saved bitmap metadata differs');
      check(image.pixels.every((value, i) => value === pixels[i]), 'Independent file pixels differ from rendered source');
      host.detach(); gpuHost.detach(); loaded = factory(reload)(options); host.attach(loaded); gpuHost.attach(loaded); loaded.tick(1000);
      check(loaded.state.halted, 'Separate reload preview did not finish');
      capture(loaded, 'Reloaded rollerball IFF', image.pixels);
      const menu = area.querySelector('.game-debug'); menu.open = true;
      await new Promise(resolve => setTimeout(resolve, 0)); area.querySelector('[data-debug-refresh]').click();
      const link = area.querySelector('[data-debug-files] a');
      check(link && link.download === 'rollerball', 'Saved file is not downloadable');
      const downloaded = new Uint8Array(await (await fetch(link.href)).arrayBuffer());
      check(downloaded.length === bytes.length && downloaded.every((value, i) => value === bytes[i]), 'Debug download changed IFF bytes');
      canvas.remove(); success = true;
      globalThis.AMOS_SAVE_IFF_CLEANUP = () => { ui.dispose(); area.remove(); };
      return { writes, filename: 'rollerball', comparedPixels, gpuFrames, downloadExact: true, reloaded: true, sourceUnchanged: true };
    } finally {
      host.detach(); gpuHost.detach(); p.stop(); if (loaded) loaded.stop();
      const gl = gpu.resources.context; gpu.dispose(); const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext();
      if (!success) { ui.dispose(); area.remove(); }
    }
  }, { source: new Transpiler(bytes).toModule(),
    reload: new Transpiler(binary([[t('Load Iff Screen'), text('rollerball'), t(','), n(0)]])).toModule(),
    clockSource: require('./fakeTimers').createFakeTimers.toString(), decoderSource: require('./decodeSavedIff').toString(),
    uiSource: require('../../tools/gamePageUI').toString(), gpuSources: require('./webglHostSources')() });
};
