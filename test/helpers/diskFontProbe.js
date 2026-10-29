'use strict';
module.exports = async function diskFontProbe(page) {
  return page.evaluate(({ source, fontSource, clockSource, gpuSources }) => {
    const make = s => new Function(`return (${s});`)(), check = (v, m) => { if (!v) throw Error(m); };
    const font = make(fontSource)(), clock = make(clockSource)(), compiled = { exports: {} };
    new Function('module', source)(compiled);
    const p = compiled.exports({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, displayOptions: { diskFonts: [font] } });
    const model = make(gpuSources.model)(), gpu = make(gpuSources.renderer)(model, make(gpuSources.sprites)(), make(gpuSources.resources)(model), make(gpuSources.shaders), make(gpuSources.layout))(document.createElement('canvas'));
    const canvas = document.createElement('canvas'), host = AMOS_BROWSER.createCanvasHost(canvas, { requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const gpuHost = AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas, { renderer: gpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const palette = [[0,0,0,255],[255,255,255,255],[0,0,255,255],[0,255,0,255]], a = [12,30,51,51,63,51,51,0];
    let frames = 0, independentPixels = 0;
    try {
      host.attach(p); gpuHost.attach(p); p.tick(1000);
      for (let stage = 0; stage < 3; stage++) {
        if (stage) { p.sendKey('next'); clock.tick(0); }
        check(p.state.waiting === 'key', 'Font demo did not reach key prompt'); host.render();
        const rgba = canvas.getContext('2d').getImageData(0,0,320,200).data;
        for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) {
          let index = stage === 1 ? 2 : 0;
          if (stage < 2 && y >= 2 && y < 11 && x >= 3 && x < 23) {
            const row = y - 2, col = (x - 3) % 10, first = x < 13;
            const bit = first ? col === 0 || col === 9 || row === 4 : col === row || col === 9 - row;
            index = bit ? 1 : stage === 1 ? 3 : 0;
          } else if (stage === 2) {
            if (x < 8 && y < 8 && ((a[y] >> x) & 1) || x >= 16 && x < 24 && y >= 8 && y < 16 && ((a[y-8] >> (x-16)) & 1)) index = 1;
          }
          const at = (y*320+x)*4; check(palette[index].every((v,i) => rgba[at+i] === v), `Independent disk-font pixel differs at ${stage}:${x},${y}`); independentPixels++;
        }
        const old = p.display.canvasFrame; p.display.canvasFrame = () => { throw Error('GPU used CPU presentation'); };
        try { gpuHost.render(); } finally { p.display.canvasFrame = old; }
        const hardware = gpu.readPixels(), reference = p.display.renderDisplay();
        check(gpu.stats.lastResult.backend === 'gpu' && hardware.every((v,i) => v === reference[i]), 'Disk-font GPU/reference differs'); frames++;
        if (globalThis.AMOS_DEMO_OBSERVE) {
          const name = ['Prepared font: transparent','Prepared font: opaque','Default font restored'][stage];
          globalThis.AMOS_DEMO_OBSERVE({ name: `Canvas: ${name}`, width:320,height:200,rgba });
          globalThis.AMOS_DEMO_OBSERVE({ name: `WebGL: ${name}`, width:640,height:200,rgba:hardware });
        }
        font.data.fill(0); // Enumeration owns its atlas; caller edits cannot change selected glyphs.
      }
    } finally {
      host.detach(); gpuHost.detach(); p.stop(); const gl = gpu.resources.context; gpu.dispose(); const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext();
    }
    return { frames, independentPixels, preparedFont: true, nativeFontCapture: false };
  }, { source: new (require('../../lib/Transpiler'))(require('./diskFontProgram')()).toModule(), fontSource: require('./diskFontFixture').toString(), clockSource: require('./fakeTimers').createFakeTimers.toString(), gpuSources: require('./webglHostSources')() });
};
