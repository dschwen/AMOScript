/* jshint esversion: 6 */
'use strict';

module.exports = async function zoomProbe(page) {
  const fs = require('fs'), path = require('path'), Transpiler = require('../../lib/Transpiler');
  const fixture = name => fs.readFileSync(path.join(__dirname, '../../examples/Introideen', name));
  return page.evaluate(async ({ source, asset, oracle, clockSource, gpuSources }) => {
    const make = text => new Function(`return (${text});`)(), module = { exports: {} };
    new Function('module', source)(module);
    const clock = make(clockSource)(), reads = [], bytes = atob(asset);
    const p = module.exports({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
      files: { read(name) { reads.push(name); if (name !== 'df1:r.abk') throw Error(`Unexpected asset ${name}`); return bytes; }, write() { throw Error('Unexpected intro write'); } } });
    const model = make(gpuSources.model)(), sprites = make(gpuSources.sprites)();
    const canvas = document.createElement('canvas');
    const gpu = make(gpuSources.renderer)(model, sprites, make(gpuSources.resources)(model), make(gpuSources.shaders), make(gpuSources.layout))(document.createElement('canvas'));
    const host = AMOS_BROWSER.createCanvasHost(canvas, { requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const gpuHost = AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas, { renderer: gpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const check = (value, message) => { if (!value) throw Error(message); };
    let iconPixels = 0, canvasPixels = 0, gpuFrames = 0;
    try {
      host.attach(p); gpuHost.attach(p); p.tick(100000);
      for (const expected of oracle.icons) {
        const image = p.banks.get(2).images[expected.number - 1], data = expected.pixelsHex.match(/../g).map(value => parseInt(value, 16));
        check(image.width === 16 && image.height === 16 && image.depth === 4 && image.pixels.every((value, i) => value === data[i]), `Generated icon ${expected.number} differs`);
        iconPixels += data.length;
      }
      for (let frame = 1; frame <= 29; frame++) {
        check(p.state.waiting === 'sleep', `Frame ${frame} missing original wait`);
        const pixels = p.display.screen().physicalPixels;
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', pixels)), byte => byte.toString(16).padStart(2, '0')).join('');
        check(digest === oracle.frames[frame - 1].sha256, `Original intro frame ${frame} differs from Python simulation`);
        host.render();
        const cpu = p.display.canvasFrame();
        if ([1, 9, 16, 29].includes(frame)) {
          const actualCanvas = canvas.getContext('2d').getImageData(0, 0, 320, 200).data;
          for (let i = 0; i < pixels.length; i++) {
            const rgb = oracle.palette[pixels[i]], at = i * 4;
            check(actualCanvas[at] === (rgb >> 8 & 15) * 17 && actualCanvas[at + 1] === (rgb >> 4 & 15) * 17 && actualCanvas[at + 2] === (rgb & 15) * 17 && actualCanvas[at + 3] === 255, `Canvas intro pixel ${i}, frame ${frame} differs`);
            canvasPixels++;
          }
          const previous = p.display.canvasFrame; p.display.canvasFrame = () => { throw Error('GPU used CPU presentation'); };
          try { gpuHost.render(); } finally { p.display.canvasFrame = previous; }
          const actual = gpu.readPixels(), reference = p.display.renderDisplay();
          check(gpu.stats.lastResult.backend === 'gpu' && actual.length === reference.length && actual.every((value, i) => value === reference[i]), `Intro GPU frame ${frame} differs`);
          gpuFrames++;
          if (globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: `WebGL: Original intro frame ${frame}`, width: gpu.stats.lastResult.width, height: gpu.stats.lastResult.lines, rgba: actual });
        }
        if (globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: `Canvas: Original intro frame ${frame}`, width: cpu.width, height: cpu.height, rgba: cpu.rgba });
        clock.tick(20);
      }
      check(p.state.waiting === 'key' && p.state.location.line === 49, 'Intro did not reach final original key prompt');
      canvas.tabIndex = 0; document.body.append(canvas); host.focus();
      for (const type of ['keydown', 'keyup']) canvas.dispatchEvent(new KeyboardEvent(type, { code: 'KeyA', key: 'a', bubbles: true, cancelable: true }));
      clock.tick(0); canvas.remove();
      check(p.state.halted && clock.pending() === 0, 'Original final key did not finish cleanly');
      check(JSON.stringify(reads) === '["df1:r.abk"]', 'Original asset requests changed');
      return { frames: 29, icons: 17, iconPixels, canvasPixels, gpuFrames, ended: true, sourceUnchanged: true };
    } finally {
      canvas.remove(); host.detach(); gpuHost.detach(); p.stop();
      const gl = gpu.resources.context; gpu.dispose(); const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext();
    }
  }, { source: new Transpiler(fixture('RollerIIIntroIdee.amos')).toModule(), asset: fixture('R.abk').toString('base64'),
    oracle: require('../fixtures/zoom.json'), clockSource: require('./fakeTimers').createFakeTimers.toString(), gpuSources: require('./webglHostSources')() });
};
