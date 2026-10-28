'use strict';
module.exports = async function screenSlideProbe(page) {
  return page.evaluate(async input => {
    const { sources, assets, oracle, gpuSources, clockSource } = input;
    const make = source => new Function(`return (${source});`)();
    const check = (value, message) => { if (!value) throw Error(message); };
    const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), v => v.toString(16).padStart(2, '0')).join('');
    const model = make(gpuSources.model)(), sprites = make(gpuSources.sprites)(), canvas = document.createElement('canvas'); canvas.tabIndex = 0; document.body.append(canvas);
    const gpu = make(gpuSources.renderer)(model, sprites, make(gpuSources.resources)(model), make(gpuSources.shaders), make(gpuSources.layout))(document.createElement('canvas'));
    const host = AMOS_BROWSER.createCanvasHost(canvas, { mouseCoordinates: 'hardware', requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const gpuHost = AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas, { renderer: gpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    let p, frames = 0, gpuFrames = 0, pointerChecks = 0, plays = 0, paused = false;
    try {
      for (const standard of ['PAL', 'NTSC']) for (const [name, source] of Object.entries(sources)) {
        const module = { exports: {} }; new Function('module', source)(module); const clock = make(clockSource)();
        p = module.exports({ displayOptions: { snapshotStandard: standard }, audio: { command: event => { if (event.type === 'play') plays++; } },
          now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
          files: { read(name) { const data = assets[name.toLowerCase()]; if (!data) throw Error(`Missing ${name}`); return atob(data); } } });
        host.attach(p); gpuHost.attach(p); p.tick(10000);
        for (const expected of oracle.frames.filter(frame => frame.name === name && frame.standard === standard)) {
          host.render(); const rgba = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          check(canvas.width === 320 && canvas.height === expected.height && await hash(rgba) === expected.sha256, `${name} ${standard} step ${expected.step}: independent pixels differ`); frames++;
          if ([0, 13, 16, 17, 25, 26, 49].includes(expected.step)) {
            const previous = p.display.canvasFrame; p.display.canvasFrame = () => { throw Error('GPU used CPU presentation'); };
            try { gpuHost.render(); } finally { p.display.canvasFrame = previous; }
            const actual = gpu.readPixels(), reference = p.display.renderDisplay();
            check(gpu.stats.lastResult.backend === 'gpu' && actual.length === reference.length && actual.every((v, i) => v === reference[i]), `${name}: GPU differs`); gpuFrames++;
            host.focus(); const rect = canvas.getBoundingClientRect(); canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: rect.left + canvas.clientLeft + 0.25, clientY: rect.top + canvas.clientTop + 0.25, buttons: 0, bubbles: true }));
            check(p.state.input.mouse.x === 128 && p.state.input.mouse.y === expected.top, `${name}: pointer crop differs`); pointerChecks++;
            if (globalThis.AMOS_DEMO_OBSERVE) {
              globalThis.AMOS_DEMO_OBSERVE({ name: `Canvas: ${name} ${standard} slide ${expected.step + 1}`, width: canvas.width, height: canvas.height, rgba });
              globalThis.AMOS_DEMO_OBSERVE({ name: `WebGL: ${name} ${standard} slide ${expected.step + 1}`, width: gpu.stats.lastResult.width, height: gpu.stats.lastResult.lines, rgba: actual });
            }
          }
          if (!paused && expected.step === 18) { p.stop(); clock.tick(1000); check(await hash(p.display.canvasFrame().rgba) === expected.sha256, 'Stop advanced slide'); p.resume(); paused = true; }
          clock.tick(20);
        }
        clock.tick(20); check(p.state.waiting === 'key', `${name}: missing final prompt`); host.focus();
        canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true })); clock.tick(20);
        check(p.state.halted && clock.pending() === 0, `${name}: key did not finish`); host.detach(); gpuHost.detach(); p.stop();
      }
      return { frames, gpuFrames, pointerChecks, plays, paused, bothSourcesEnded: true };
    } finally {
      host.detach(); gpuHost.detach(); if (p) p.stop(); canvas.remove(); const gl = gpu.resources.context; gpu.dispose(); const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext();
    }
  }, require('./screenSlideFixture')());
};
