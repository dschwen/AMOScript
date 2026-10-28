/* jshint esversion: 6 */
'use strict';
module.exports = async function anim5Probe(page) {
  const fs = require('fs'), path = require('path'), Transpiler = require('../../lib/Transpiler');
  const { binary, token: t, integer: n, identifier: id, text, word: w } = require('./tokens');
  const root = path.join(__dirname, '../../examples/Introideen');
  const player = binary([[t('Open In'), n(1), t(','), text('df1:kugelanim')],
    [id('n'), t('='), t('Frame Load'), t('('), n(1), t('To'), n(10), t(','), n(1000), t(')')], [t('Close'), n(1)],
    [t('Cls Colour'), n(0)], [t('Double Buffer')], [t('Autoback'), n(0)], [id('f'), t('='), n(10)],
    [t('For'), w(0), id('j'), t('='), n(1), t('To'), n(20)],
    [id('f'), t('='), t('Frame Play'), t('('), id('f'), t(','), n(1), t(')')], [t('Screen Swap')], [t('Wait Vbl')], [t('Next')]]);
  return page.evaluate(async ({ sources, assets, oracle, clockSource, gpuSources }) => {
    const make = source => new Function(`return (${source});`)(), factory = code => { const module = { exports: {} }; new Function('module', code)(module); return module.exports; };
    const check = (value, message) => { if (!value) throw Error(message); };
    const hash = async pixels => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', pixels)), byte => byte.toString(16).padStart(2, '0')).join('');
    const files = { read(name) { const data = assets[name.toLowerCase()]; if (!data) throw Error(`Unexpected asset ${name}`); return atob(data); }, write() { throw Error('Animation must not write files'); } };
    const model = make(gpuSources.model)(), sprites = make(gpuSources.sprites)(), canvas = document.createElement('canvas'); canvas.tabIndex = 0; document.body.append(canvas);
    const gpu = make(gpuSources.renderer)(model, sprites, make(gpuSources.resources)(model), make(gpuSources.shaders), make(gpuSources.layout))(document.createElement('canvas'));
    const host = AMOS_BROWSER.createCanvasHost(canvas, { requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const gpuHost = AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas, { renderer: gpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    let p, gpuFrames = 0, independentPixels = 0, sourceFrames = 0, paused = false;
    function capture(name, gpuFrame) {
      host.render(); const cpu = p.display.canvasFrame();
      if (gpuFrame) {
        const previous = p.display.canvasFrame; p.display.canvasFrame = () => { throw Error('GPU used CPU presentation'); };
        try { gpuHost.render(); } finally { p.display.canvasFrame = previous; }
        const actual = gpu.readPixels(), expected = p.display.renderDisplay();
        check(gpu.stats.lastResult.backend === 'gpu' && actual.length === expected.length && actual.every((value, i) => value === expected[i]), `${name}: GPU differs`); gpuFrames++;
        if (globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: `WebGL: ${name}`, width: gpu.stats.lastResult.width, height: gpu.stats.lastResult.lines, rgba: actual });
      }
      if (globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: `Canvas: ${name}`, width: cpu.width, height: cpu.height, rgba: cpu.rgba });
    }
    try {
      for (const name of ['player', 'Logoanim.amos', 'Logoanim.Bak']) {
        const clock = make(clockSource)(4); p = factory(sources[name])({ files, now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
        host.attach(p); gpuHost.attach(p); p.tick(10000);
        const total = name === 'player' ? 20 : 18;
        check(p.state.variables.int_n === total, `${name}: wrong Frame Load return`);
        for (let i = 0; i < total; i++) {
          const pixels = p.display.screen(name === 'player' ? 0 : 2).physicalPixels;
          check(await hash(pixels) === oracle.frames[i].sha256, `${name}: frame ${i + 1} differs from independent planes`);
          capture(name === 'player' ? `Asset frame ${i + 1}` : `${name} sphere ${i + 1}`, name === 'player' ? [0, 1, 9, 17, 18, 19].includes(i) : [0, 8, 17].includes(i));
          if (name === 'player') {
            const rgba = canvas.getContext('2d').getImageData(0, 0, 320, 200).data;
            for (let at = 0; at < pixels.length; at++) {
              const rgb = oracle.palette[pixels[at]];
              check(rgba[at * 4] === (rgb >> 8 & 15) * 17 && rgba[at * 4 + 1] === (rgb >> 4 & 15) * 17 && rgba[at * 4 + 2] === (rgb & 15) * 17 && rgba[at * 4 + 3] === 255, `Asset frame ${i + 1}, pixel ${at}`); independentPixels++;
            }
          } else sourceFrames++;
          if (name === 'Logoanim.amos' && i === 8) {
            p.stop(); clock.tick(1000); check(await hash(p.display.screen(2).physicalPixels) === oracle.frames[i].sha256, 'Stop advanced animation'); p.resume(); paused = true;
          }
          clock.tick(name === 'player' ? 20 : name.endsWith('.Bak') ? 120 : 80);
        }
        if (name !== 'player') {
          capture(`${name} logo-copy handoff`, true); host.focus();
          const rectangle = canvas.getBoundingClientRect();
          canvas.dispatchEvent(new PointerEvent('pointermove', { button: 0, buttons: 1, clientX: rectangle.left + 20, clientY: rectangle.top + 20, bubbles: true }));
          check(p.state.input.mouse.buttons & 1, `${name}: host mouse button was not held`);
          clock.tick(15000); check(p.state.halted, `${name}: mouse exit did not finish`); capture(`${name} ended`, true);
        }
        check(p.state.halted && clock.pending() === 0, `${name}: did not finish cleanly`);
        host.detach(); gpuHost.detach(); p.stop();
      }
      return { assetFrames: 20, sourceFrames, independentPixels, gpuFrames, paused, bothSourcesEnded: true };
    } finally {
      host.detach(); gpuHost.detach(); if (p) p.stop(); canvas.remove(); const gl = gpu.resources.context; gpu.dispose();
      const extension = gl.getExtension('WEBGL_lose_context'); if (extension && !gl.isContextLost()) extension.loseContext();
    }
  }, { sources: { player: new Transpiler(player).toModule(), ...Object.fromEntries(['Logoanim.amos', 'Logoanim.Bak'].map(name => [name, new Transpiler(fs.readFileSync(path.join(root, name))).toModule()])) },
    assets: Object.fromEntries(['KugelAnim', 'introroller'].map(name => [`df1:${name.toLowerCase()}`, fs.readFileSync(path.join(root, name)).toString('base64')])),
    oracle: require('../fixtures/anim5.json'), clockSource: require('./fakeTimers').createFakeTimers.toString(), gpuSources: require('./webglHostSources')() });
};
