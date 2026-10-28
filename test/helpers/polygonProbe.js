/* jshint esversion: 6 */
'use strict';

module.exports = async function polygonProbe(page) {
  const fs = require('fs'), path = require('path'), Transpiler = require('../../lib/Transpiler');
  const { binary, token: t, integer: n } = require('./tokens'), oracle = require('../fixtures/polygon.json');
  const lines = [[t('Flash Off')], [t('Colour'), n(0), t(','), n(0)], [t('Colour'), n(3), t(','), n(0xfff)], [t('Ink'), n(3)]];
  for (const frame of oracle.frames) lines.push([t('Cls Colour'), n(0)],
    [t('Polygon'), frame.points.flatMap((pair, i) => [i ? t('To') : [], n(pair[0]), t(','), n(pair[1])])], [t('Wait Key')]);
  return page.evaluate(async ({ source, matrices, oracle, decoderSource, uiSource, gpuSources, clockSource }) => {
    if (globalThis.AMOS_POLYGON_CLEANUP) globalThis.AMOS_POLYGON_CLEANUP();
    const make = text => new Function(`return (${text});`)(), decode = make(decoderSource), clock = make(clockSource)();
    const factory = code => { const module = { exports: {} }; new Function('module', code)(module); return module.exports; };
    const check = (value, message) => { if (!value) throw Error(message); };
    const stored = new Map(), area = document.createElement('section'), toolbar = document.createElement('div'); area.id = 'polygon-exports'; area.append(toolbar); document.body.append(area);
    const files = { snapshot: () => Object.fromEntries(stored) }, ui = make(uiSource)({ container: area, toolbar, files, debug: true });
    const model = make(gpuSources.model)(), sprites = make(gpuSources.sprites)(), canvas = document.createElement('canvas');
    const gpu = make(gpuSources.renderer)(model, sprites, make(gpuSources.resources)(model), make(gpuSources.shaders), make(gpuSources.layout))(document.createElement('canvas'));
    const host = AMOS_BROWSER.createCanvasHost(canvas, { requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const gpuHost = AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas, { renderer: gpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    let p, gpuFrames = 0, matrixPixels = 0, savedPixels = 0, savedFrames = 0, success = false;
    const options = { now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout };
    function attach(program) { host.detach(); gpuHost.detach(); host.attach(program); gpuHost.attach(program); }
    function capture(name, onGpu) {
      host.render(); const cpu = p.display.canvasFrame();
      if (onGpu) {
        const previous = p.display.canvasFrame; p.display.canvasFrame = () => { throw Error('GPU used CPU presentation'); };
        try { gpuHost.render(); } finally { p.display.canvasFrame = previous; }
        const actual = gpu.readPixels(), reference = p.display.renderDisplay();
        check(gpu.stats.lastResult.backend === 'gpu' && actual.length === reference.length && actual.every((value, i) => value === reference[i]), `${name}: GPU differs`); gpuFrames++;
        if (globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: `WebGL: ${name}`, width: gpu.stats.lastResult.width, height: gpu.stats.lastResult.lines, rgba: actual });
      }
      if (globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: `Canvas: ${name}`, width: cpu.width, height: cpu.height, rgba: cpu.rgba });
    }
    try {
      p = factory(matrices)(options); attach(p); p.tick(1000);
      for (const [index, frame] of oracle.frames.entries()) {
        const expected = frame.pixelsHex.match(/../g).map(value => parseInt(value, 16));
        capture(`Polygon ${frame.name}`, [0, 1, 3, 5].includes(index));
        const rgba = canvas.getContext('2d').getImageData(0, 0, oracle.width, oracle.height).data;
        for (let i = 0; i < expected.length; i++) {
          const rgb = expected[i] ? 255 : 0;
          check(rgba[i * 4] === rgb && rgba[i * 4 + 1] === rgb && rgba[i * 4 + 2] === rgb && rgba[i * 4 + 3] === 255, `${frame.name}: pixel ${i}`); matrixPixels++;
        }
        p.sendKey('next'); clock.tick(0);
      }
      check(p.state.halted, 'Matrix preview did not finish'); p.stop();
      p = factory(source)({ ...options, files: { write(name, data) {
        check(name === `df1:kugel0${10 + savedFrames}`, 'Original save order differs');
        const image = decode(Uint8Array.from(data, c => c.charCodeAt(0))), pixels = p.display.screen().pixels;
        check(image.width === 320 && image.height === 200 && image.depth === 4 && image.pixels.every((value, i) => value === pixels[i]), `${name}: decoded pixels differ`);
        stored.set(name, data); savedFrames++; capture(`Saved ${name}`, true);
        const rgba = canvas.getContext('2d').getImageData(0, 0, 320, 200).data;
        for (let i = 0; i < pixels.length; i++) {
          const value = image.pixels[i] * 17;
          check(rgba[i * 4] === value && rgba[i * 4 + 1] === value && rgba[i * 4 + 2] === value && rgba[i * 4 + 3] === 255, `${name}: saved Canvas pixel ${i}`); savedPixels++;
        }
      } } }); attach(p); p.tick(250000);
      check(p.state.halted && savedFrames === 8 && clock.pending() === 0, 'Original backup did not complete');
      const menu = area.querySelector('.game-debug'); menu.open = true; await new Promise(resolve => setTimeout(resolve, 0));
      area.querySelector('[data-debug-refresh]').click(); const links = [...area.querySelectorAll('[data-debug-files] a')];
      check(links.length === 8, 'Missing generated downloads');
      for (const link of links) {
        const actual = new Uint8Array(await (await fetch(link.href)).arrayBuffer()), expected = stored.get(`df1:${link.download}`);
        check(actual.length === expected.length && actual.every((value, i) => value === expected.charCodeAt(i)), 'Downloaded IFF differs');
      }
      success = true; globalThis.AMOS_POLYGON_CLEANUP = () => { ui.dispose(); area.remove(); };
      return { matrixFrames: 12, matrixPixels, savedFrames, savedPixels, gpuFrames, downloads: links.length, sourceUnchanged: true };
    } finally {
      host.detach(); gpuHost.detach(); if (p) p.stop(); const gl = gpu.resources.context; gpu.dispose();
      const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext();
      if (!success) { ui.dispose(); area.remove(); }
    }
  }, { source: new Transpiler(fs.readFileSync(path.join(__dirname, '../../examples/Introideen/KugelanimBerech.Bak'))).toModule(),
    matrices: new Transpiler(binary(lines)).toModule(), oracle,
    decoderSource: require('./decodeSavedIff').toString(), uiSource: require('../../tools/gamePageUI').toString(),
    clockSource: require('./fakeTimers').createFakeTimers.toString(), gpuSources: require('./webglHostSources')() });
};
