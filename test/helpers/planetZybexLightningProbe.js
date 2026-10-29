'use strict';
module.exports = async function planetZybexLightningProbe(page) {
  return page.evaluate(({ source, assets, inputs, progressionSource, clockSource, lightningSource, gpuSources }) => {
    const make = s => new Function(`return (${s});`)(), check = (v, m) => { if (!v) throw Error(m); };
    const compiled = { exports: {} }; new Function('module', source)(compiled);
    const progression = make(progressionSource), lightning = make(lightningSource), clockFactory = make(clockSource);
    const model = make(gpuSources.model)(), renderer = make(gpuSources.renderer)(model, make(gpuSources.sprites)(), make(gpuSources.resources)(model), make(gpuSources.shaders), make(gpuSources.layout));
    const keys = [[1, 'ArrowUp'], [2, 'ArrowDown'], [4, 'ArrowLeft'], [8, 'ArrowRight'], [16, 'KeyZ']];
    let runs = 0, gpuFrames = 0, paletteRows = 0;
    for (const standard of ['PAL', 'NTSC']) for (const scale of [1, 2]) {
      const clock = clockFactory(1), canvas = document.createElement('canvas'), gpu = renderer(document.createElement('canvas'));
      const gpuHost = AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas, { renderer: gpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
      let host;
      try {
        const result = lightning(progression, compiled.exports, clock, { read: name => atob(assets[name.toLowerCase()]) }, p => {
          host = AMOS_BROWSER.createCanvasHost(canvas, { joysticks: [{ port: 1, keyboard: { fire: ['KeyZ'] } }], hasFocus: () => true, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
          host.attach(p); gpuHost.attach(p); let held = 0;
          const set = mask => { for (const [bit, code] of keys) if ((held & bit) !== (mask & bit)) canvas.dispatchEvent(new KeyboardEvent(mask & bit ? 'keydown' : 'keyup', { code, key: code === 'KeyZ' ? 'z' : code, bubbles: true, cancelable: true })); held = mask; };
          return { set, dispose() { set(0); host.detach(); gpuHost.detach(); } };
        }, inputs, (name, p, meta) => {
          const f = p.display.snapshotDisplay().frame;
          check(f.lines === 171 && f.outputWidth === 640 && f.overflowEvents.length === 0, 'Lightning geometry/events differ');
          check(meta.line === (meta.level === 1 ? 1251 : 1423) && meta.offset === (meta.level === 1 ? 58398 : 64474), 'Original lightning wait location differs');
          check(p.display.screen(5).palette[0] === 0 && !(f.lineRegs[160 * 32 + 16] & 2), 'HUD palette/setup DMA differs');
          for (let y = 0; y < 171; y++) {
            const expected = y < 160 ? meta.colour / 0x111 * 17 : 0, at = y * 1024;
            check(f.linePal[at] === expected && f.linePal[at + 1] === expected && f.linePal[at + 2] === expected && f.linePal[at + 3] === 255, 'Independent per-screen COLOR00 differs'); paletteRows++;
          }
          host.render(); const actual = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          const previous = p.display.canvasFrame; p.display.canvasFrame = () => { throw Error('GPU used CPU presentation'); };
          try { gpuHost.render(); } finally { p.display.canvasFrame = previous; }
          const hardware = gpu.readPixels(), reference = p.display.renderDisplay();
          check(gpu.stats.lastResult.backend === 'gpu' && hardware.length === reference.length && hardware.length === actual.length && hardware.every((v, i) => v === reference[i] && v === actual[i]), 'Lightning GPU/Canvas/reference differs'); gpuFrames++;
          if (globalThis.AMOS_DEMO_OBSERVE) {
            const label = `${standard} ${scale}x ${name}`;
            globalThis.AMOS_DEMO_OBSERVE({ name: `Canvas: ${label}`, width: 640, height: 171, rgba: actual });
            globalThis.AMOS_DEMO_OBSERVE({ name: `WebGL: ${label}`, width: 640, height: 171, rgba: hardware });
          }
        }, standard, scale);
        const peak = 10 + scale, expected = [...Array.from({ length: peak }, (_, i) => i + 1), ...Array.from({ length: peak }, (_, i) => peak - 1 - i)];
        for (const level of [1, 2]) check(JSON.stringify(result.flashes.filter(f => f.level === level).map(f => f.colour / 0x111)) === JSON.stringify(expected), 'Lightning fade sequence differs');
        check(result.progression.lives === 5 && result.progression.level === 3 && clock.pending() === 0, 'Lightning progression/cleanup differs'); runs++;
      } finally {
        if (host) host.detach(); gpuHost.detach(); const gl = gpu.resources.context; gpu.dispose(); const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext();
      }
    }
    return { runs, gpuFrames, paletteRows, sourceUnchanged: true, level: 3, lives: 5 };
  }, { ...require('./planetZybexGameFixture')(), lightningSource: require('./planetZybexLightning').toString() });
};
