/* jshint esversion: 6 */
'use strict';
module.exports = async function roller2HelpProbe(page) {
  const Transpiler = require('../../lib/Transpiler'), initial = require('./roller2CurrentAssets')();
  return page.evaluate(({ source, assets, clockSource, filesSource, replaySource, gpuSources, oracle }) => {
    const make = text => new Function(`return (${text});`)(), module = { exports: {} }; new Function('module', source)(module);
    const clock = make(clockSource)(4), files = make(filesSource)(Object.fromEntries(Object.entries(assets).map(([name, data]) => [name, atob(data)])));
    const model = make(gpuSources.model)(), sprites = make(gpuSources.sprites)();
    const gpu = make(gpuSources.renderer)(model, sprites, make(gpuSources.resources)(model), make(gpuSources.shaders), make(gpuSources.layout))(document.createElement('canvas'));
    const surface = document.createElement('canvas'); surface.tabIndex = 0; document.body.append(surface);
    let host, gpuHost, gpuFrames = 0, independentPixels = 0;
    const check = (value, message) => { if (!value) throw Error(message); };
    try {
      const result = make(replaySource)(module.exports, clock, files, p => {
        host = AMOS_BROWSER.createCanvasHost(surface, { hasFocus: () => true, requestAnimationFrame: () => 1, cancelAnimationFrame() {} }); host.attach(p); host.focus();
        gpuHost = AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas, { renderer: gpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} }); gpuHost.attach(p);
        return { key(code) { for (const type of ['keydown', 'keyup']) surface.dispatchEvent(new KeyboardEvent(type, { code, key: code === 'KeyA' ? 'a' : code, bubbles: true, cancelable: true })); }, dispose() { host.detach(); gpuHost.detach(); } };
      }, (name, p) => {
        if (name === 'Help icons 49–52') {
          const target = p.display.screen();
          for (const image of oracle.images) {
            const pixels = image.pixelsHex.match(/../g).map(value => parseInt(value, 16));
            pixels.forEach((value, i) => { check(target.pixels[(image.y + Math.floor(i / 16)) * target.width + image.x + i % 16] === value, `Help icon ${image.number}, pixel ${i} differs`); independentPixels++; });
          }
        }
        host.render(); const cpu = p.display.canvasFrame();
        const previous = p.display.canvasFrame; p.display.canvasFrame = () => { throw Error('GPU used CPU presentation'); };
        try { gpuHost.render(); } finally { p.display.canvasFrame = previous; }
        const actual = gpu.readPixels(), expected = p.display.renderDisplay();
        check(gpu.stats.lastResult.backend === 'gpu' && actual.length === expected.length && actual.every((value, i) => value === expected[i]), `${name}: GPU/CPU mismatch`); gpuFrames++;
        if (globalThis.AMOS_DEMO_OBSERVE) {
          globalThis.AMOS_DEMO_OBSERVE({ name: `Canvas: ${name}`, width: cpu.width, height: cpu.height, rgba: cpu.rgba });
          globalThis.AMOS_DEMO_OBSERVE({ name: `WebGL: ${name}`, width: gpu.stats.lastResult.width, height: gpu.stats.lastResult.lines, rgba: actual });
        }
      });
      return { ...result, gpuFrames, independentPixels };
    } finally {
      if (host) host.detach(); if (gpuHost) gpuHost.detach(); surface.remove();
      const gl = gpu.resources.context; gpu.dispose(); const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext();
    }
  }, { source: new Transpiler(Buffer.from(initial['rii:Roller II.AMOS'], 'latin1')).toModule(), assets: Object.fromEntries(Object.entries(initial).map(([name, bytes]) => [name, Buffer.from(bytes, 'latin1').toString('base64')])),
    clockSource: require('./fakeTimers').createFakeTimers.toString(), filesSource: require('./roller2GameFiles').toString(), replaySource: require('./roller2HelpReplay').toString(), gpuSources: require('./webglHostSources')(), oracle: require('../fixtures/roller2/help.json') });
};
