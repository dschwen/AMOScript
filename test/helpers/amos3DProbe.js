'use strict';
module.exports = async function amos3DProbe(page) {
  const fs = require('fs'), path = require('path'), T = require('../../lib/Transpiler');
  const source = new T(require('./amos3DProgram')()).toModule(), title = 'Original excerpt — static hero ending';
  const rotatingTitle = 'Car + rotating hero — added demo loop', rotatingSource = new T(require('./amos3DProgram')({ heroTurntable: true })).toModule();
  const assets = Object.fromEntries(require('../../examples/Amos3D/manifest.json').assets.map(a => ['gru1:intr/' + a.name.toLowerCase(), fs.readFileSync(path.join(__dirname, '../../examples/Amos3D', a.name)).toString('base64')]));
  return page.evaluate(async ({ sources, sourceNames, verificationSource, assets, oracle, clockSource, gpuSources }) => {
    const make = text => new Function(`return (${text});`)(), module = { exports: {} };
    new Function('module', verificationSource)(module);
    const clock = make(clockSource)(), reads = [], p = module.exports({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
      files: { read(file) { reads.push(file); if (!assets[file.toLowerCase()]) throw Error('Missing model dependency ' + file); return atob(assets[file.toLowerCase()]); } } });
    const model = make(gpuSources.model)(), canvas = document.createElement('canvas');
    const gpu = make(gpuSources.renderer)(model, make(gpuSources.sprites)(), make(gpuSources.resources)(model), make(gpuSources.shaders), make(gpuSources.layout))(document.createElement('canvas'));
    const host = AMOS_BROWSER.createCanvasHost(canvas, { requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const gpuHost = AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas, { renderer: gpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const check = (value, message) => { if (!value) throw Error(message); };
    let independentPixels = 0, gpuFrames = 0;
    try {
      host.attach(p); gpuHost.attach(p); p.tick(10000);
      for (let frame = 1; frame <= 104; frame++) {
        check(p.state.waiting === 'sleep', 'Missing original VBL at frame ' + frame);
        const expected = oracle.frames.find(f => f.frame === frame);
        if (expected) {
          const pixels = p.display.screen().physicalPixels;
          const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', pixels)), v => v.toString(16).padStart(2, '0')).join('');
          check(digest === expected.sha256, 'Independent 3D frame differs: ' + frame); independentPixels += pixels.length;
          host.render(); const cpu = p.display.canvasFrame();
          const previous = p.display.canvasFrame; p.display.canvasFrame = () => { throw Error('3D WebGL used CPU presentation'); };
          try { gpuHost.render(); } finally { p.display.canvasFrame = previous; }
          const actual = gpu.readPixels(), reference = p.display.renderDisplay();
          check(gpu.stats.lastResult.backend === 'gpu' && actual.length === reference.length && actual.every((v, i) => v === reference[i]), '3D GPU mismatch at frame ' + frame); gpuFrames++;
          const rgba = canvas.getContext('2d').getImageData(0, 0, cpu.width, cpu.height).data;
          check(rgba.every((v, i) => v === cpu.rgba[i]), '3D Canvas mismatch');
          if (globalThis.AMOS_DEMO_OBSERVE) {
            globalThis.AMOS_DEMO_OBSERVE({ name: `Canvas: ${expected.name} frame ${frame}`, width: cpu.width, height: cpu.height, rgba });
            globalThis.AMOS_DEMO_OBSERVE({ name: `WebGL: ${expected.name} frame ${frame}`, width: gpu.stats.lastResult.width, height: gpu.stats.lastResult.lines, rgba: actual });
          }
        }
        clock.tick(20);
      }
      check(p.state.waiting === 'key' && p.threeDSnapshot().objects[0].name === 'hero', 'Excerpt did not finish on hero');
      check(reads.length === 6, 'Unexpected dependency read count');
      p.sendKey('finish'); clock.tick(0); check(p.state.halted && clock.pending() === 0, 'Final key did not finish');
      return { sourceFrames: 104, definitions: 2, dependencies: 5, independentPixels, gpuFrames, ended: true, fullIntro: false };
    } finally { host.detach(); gpuHost.detach(); p.stop(); const gl = gpu.resources.context; gpu.dispose(); const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext(); }
  }, { sources: { [rotatingTitle]: rotatingSource, [title]: source }, sourceNames: [rotatingTitle, title], verificationSource: source, assets, oracle: require('../fixtures/amos-3d.json'), clockSource: require('./fakeTimers').createFakeTimers.toString(), gpuSources: require('./webglHostSources')(),
    subject: '3D excerpt', finishHint: 'The rotating hero uses an added AMOS demo loop. Select the original excerpt to see its static hero ending, then press a key to finish. Prepared screen/palette; preceding sprite intro excluded.' });
};
