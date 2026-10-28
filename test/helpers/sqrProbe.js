/* jshint esversion: 6 */
'use strict';

module.exports = async function sqrProbe(page) {
  const fs = require('fs'), path = require('path'), Transpiler = require('../../lib/Transpiler');
  const { binary, token: t, integer: n } = require('./tokens');
  const root = value => [t('Sqr'), t('('), n(value), t(')')];
  const lines = [[t('Cls Colour'), n(0)], [t('Flash Off')]];
  for (let index = 0; index < 16; index++) {
    lines.push([t('Colour'), n(index), t(','), n(index * 0x111)],
      [t('Ink'), root(index * index)],
      [t('Bar'), n(16 + index * 18), t(','), n(24), t('To'), n(31 + index * 18), t(','), n(39)]);
  }
  return page.evaluate(({ tiles, kugel, gpuSources }) => {
    const make = text => new Function(`return (${text});`)();
    const model = make(gpuSources.model)(), sprites = make(gpuSources.sprites)();
    const canvas = document.createElement('canvas');
    const gpu = make(gpuSources.renderer)(model, sprites, make(gpuSources.resources)(model), make(gpuSources.shaders), make(gpuSources.layout))(document.createElement('canvas'));
    let cpuHost, gpuHost, program, gpuFrames = 0, independentPixels = 0, error = '';
    const check = (value, message) => { if (!value) throw Error(message); };
    const start = source => {
      if (cpuHost) cpuHost.detach(); if (gpuHost) gpuHost.detach(); if (program) program.stop();
      const module = { exports: {} }; new Function('module', source)(module);
      program = module.exports({ now: () => 0, setTimeout: () => 1, clearTimeout() {}, print() {} });
      cpuHost = AMOS_BROWSER.createCanvasHost(canvas, { requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
      gpuHost = AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas, { renderer: gpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
      cpuHost.attach(program); gpuHost.attach(program);
    };
    const capture = name => {
      cpuHost.render();
      const cpu = program.display.canvasFrame(), previous = program.display.canvasFrame;
      program.display.canvasFrame = () => { throw Error('GPU used CPU presentation'); };
      try { gpuHost.render(); } finally { program.display.canvasFrame = previous; }
      const actual = gpu.readPixels(), expected = program.display.renderDisplay();
      check(gpu.stats.lastResult.backend === 'gpu' && actual.length === expected.length && actual.every((value, i) => value === expected[i]), `${name}: GPU/CPU mismatch`);
      gpuFrames++;
      if (globalThis.AMOS_DEMO_OBSERVE) {
        globalThis.AMOS_DEMO_OBSERVE({ name: `Canvas: ${name}`, width: cpu.width, height: cpu.height, rgba: cpu.rgba });
        globalThis.AMOS_DEMO_OBSERVE({ name: `WebGL: ${name}`, width: gpu.stats.lastResult.width, height: gpu.stats.lastResult.lines, rgba: actual });
      }
    };
    try {
      start(tiles); program.tick(1000); capture('Exact square-root shades');
      const context = canvas.getContext('2d');
      for (let colour = 0; colour < 16; colour++) {
        const data = context.getImageData(16 + colour * 18, 24, 16, 16).data;
        for (let i = 0; i < data.length; i += 4) {
          check(data[i] === colour * 17 && data[i + 1] === colour * 17 && data[i + 2] === colour * 17 && data[i + 3] === 255, `Square-root shade ${colour} differs`);
          independentPixels++;
        }
      }
      start(kugel);
      try { program.tick(300000); } catch (failure) { error = failure.message; }
      check(error === 'Invalid colour index at line 14, byte 520', 'Original Kugel must reveal its negative colour');
      const v = program.state.variables;
      check(v.int_gx === 89 && v.int_gy === 42 && v.int_p === -1 && program.state.halted, 'Unexpected Kugel source failure state');
      capture('Original Kugel — stopped at negative colour');
      return { gpuFrames, independentPixels, error, ticks: program.state.ticks, partialSphere: true, gameRunning: false };
    } finally {
      if (cpuHost) cpuHost.detach(); if (gpuHost) gpuHost.detach(); if (program) program.stop();
      const gl = gpu.resources.context; gpu.dispose(); const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext();
    }
  }, { tiles: new Transpiler(binary(lines)).toModule(),
    kugel: new Transpiler(fs.readFileSync(path.join(__dirname, '../../examples/Introideen/Kugel.amos'))).toModule(),
    gpuSources: require('./webglHostSources')() });
};
