'use strict';
module.exports = async function joySource1Probe(page) {
  const fs = require('fs'), path = require('path'), T = require('../../lib/Transpiler');
  const root = path.join(__dirname, '../../examples/Joy/Source1'), { loadAssets, buildGamePage } = require('../../tools/build_game_page');
  const sources = Object.fromEntries(['LabEdit.AMOS', 'LabEdit.Bak'].map(name => [name, new T(fs.readFileSync(path.join(root, name))).toModule()]));
  const original = fs.readFileSync(path.join(root, 'LabEdit.AMOS')), trailer = 20 + original.readUInt32BE(16);
  if (original.toString('ascii', trailer + 6, trailer + 10) !== 'AmBk' || original.readUInt16BE(trailer + 10) !== 10 || (original.readUInt32BE(trailer + 14) & 0xfffffff) !== 392) throw Error('Pinned editor map layout changed');
  const initialMaps = { 'LabEdit.AMOS': original.subarray(trailer + 26, trailer + 26 + 384).toString('base64') };
  return page.evaluate(async ({ sources, sourceNames, assets, initialMaps, gpuSources, clockSource, debugPage }) => {
    const make = text => new Function(`return (${text});`)(), check = (v, m) => { if (!v) throw Error(m); };
    // Independent planar-row decode of the pinned external LAB icon bank.
    const raw = Uint8Array.from(atob(assets['joyii:grafiken/lab.icons.abk']), c => c.charCodeAt(0)); let at = 4;
    const word = () => { const v = raw[at] * 256 + raw[at + 1]; at += 2; return v; }, count = word(), icons = [];
    for (let i = 0; i < count; i++) {
      const width = word() * 16, height = word(), depth = word(); check(word() === 0 && word() === 0, 'Fixture hotspot changed');
      const pixels = new Uint8Array(width * height), bytes = width / 8 * height;
      for (let plane = 0; plane < depth; plane++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (raw[at + plane * bytes + y * width / 8 + (x >> 3)] & (128 >> (x & 7))) pixels[y * width + x] += 2 ** plane;
      at += bytes * depth; icons.push({ width, height, pixels });
    }
    const model = make(gpuSources.model)(), canvas = document.createElement('canvas');
    const gpu = make(gpuSources.renderer)(model, make(gpuSources.sprites)(), make(gpuSources.resources)(model), make(gpuSources.shaders), make(gpuSources.layout))(document.createElement('canvas'));
    const host = AMOS_BROWSER.createCanvasHost(canvas, { requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const gpuHost = AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas, { renderer: gpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    let p, frames = 0, gpuFrames = 0, independentPixels = 0;
    try {
      for (const name of sourceNames) {
        const module = { exports: {} }; new Function('module', sources[name])(module);
        const clock = make(clockSource)(4); p = module.exports({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
          files: { read(file) { const data = assets[file.toLowerCase()]; if (!data) throw Error('Missing asset ' + file); return atob(data); } } });
        p.setMouse(133, 50, 0); host.attach(p); gpuHost.attach(p); p.tick(1000); clock.tick(40);
        let map = initialMaps[name] ? Uint8Array.from(atob(initialMaps[name]), c => c.charCodeAt(0)) : new Uint8Array(384);
        if (!initialMaps[name]) { map[0] = 17; map[1] = 21; }
        const capture = label => {
          check(p.banks.get(10).data.every((v, i) => v === map[i]), name + ': map differs at ' + label);
          const expected = new Uint8Array(320 * 120);
          // Source _AUFBAU draws X then Y and uses zero-transparent icons; only
          // the common four screen planes are retained from five-plane images.
          for (let x = 0; x < 32; x++) for (let y = 0; y < 12; y++) {
            const number = map[y * 32 + x]; if (!number) continue; const image = icons[number - 1];
            for (let iy = 0; iy < image.height; iy++) for (let ix = 0; ix < image.width; ix++) {
              const tx = x * 10 + ix, ty = y * 10 + iy, v = image.pixels[iy * image.width + ix];
              if (v && tx < 320 && ty < 120) expected[ty * 320 + tx] = v & 15;
            }
          }
          check(p.display.screen().pixels.slice(0, expected.length).every((v, i) => v === expected[i]), name + ': independent grid pixels differ at ' + label); independentPixels += expected.length;
          host.render(); const cpu = p.display.canvasFrame(), old = p.display.canvasFrame; p.display.canvasFrame = () => { throw Error('Joy GPU used CPU presentation'); };
          try { gpuHost.render(); } finally { p.display.canvasFrame = old; }
          const actual = gpu.readPixels(), reference = p.display.renderDisplay();
          check(gpu.stats.lastResult.backend === 'gpu' && actual.length === reference.length && actual.every((v, i) => v === reference[i]), 'Joy GPU mismatch'); gpuFrames++; frames++;
          if (globalThis.AMOS_DEMO_OBSERVE) {
            globalThis.AMOS_DEMO_OBSERVE({ name: `Canvas: ${name} ${label}`, width: cpu.width, height: cpu.height, rgba: cpu.rgba });
            globalThis.AMOS_DEMO_OBSERVE({ name: `WebGL: ${name} ${label}`, width: gpu.stats.lastResult.width, height: gpu.stats.lastResult.lines, rgba: actual });
          }
        };
        const press = key => { p.sendKey(key); clock.tick(40); };
        capture('initial grid');
        press('5'); press('f'); capture('protected start marker — Pop');
        press('6'); press('f'); capture('protected finish marker — Pop');
        press('2'); p.setMouse(170, 87, 1); clock.tick(4); p.setMouse(170, 87, 0); clock.tick(4); map[132] = 3; capture('painted cell');
        press('f'); map.fill(3); map[0] = 17; map[1] = 21; capture('filled map');
        press('c'); map.fill(0); map[0] = 17; map[1] = 21; capture('cleared map');
        press('\x1b'); check(p.state.halted && p.state.editRequest && clock.pending() === 0 && p.state.stack.length === 0, 'Editor did not terminate through Edit'); host.detach(); gpuHost.detach(); p.stop();
      }
      const frame = document.createElement('iframe'); frame.title = 'Standalone Joy editor page'; frame.style.cssText = 'width:100%;height:600px'; document.body.append(frame);
      const loaded = new Promise(resolve => { frame.onload = resolve; }); frame.srcdoc = debugPage; await loaded;
      try {
        const doc = frame.contentDocument, win = frame.contentWindow;
        doc.getElementById('game-restart').click();
        await new Promise(resolve => setTimeout(resolve, 160));
        check(doc.getElementById('game-viewport').dataset.phase === 'running', 'Standalone editor initial pointer failed');
        const input = doc.getElementById('game-input'); input.focus();
        for (const key of ['5', 'f', '6', 'f', '2', 'f', 'c']) {
          for (const type of ['keydown', 'keyup']) input.dispatchEvent(new win.KeyboardEvent(type, { code: /[0-9]/.test(key) ? 'Digit' + key : 'Key' + key.toUpperCase(), key, bubbles: true }));
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        check(doc.getElementById('game-viewport').dataset.phase === 'running', 'Standalone editor controls failed');
        for (const type of ['keydown', 'keyup']) input.dispatchEvent(new win.KeyboardEvent(type, { code: 'Escape', key: 'Escape', bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 120));
        check(doc.getElementById('game-viewport').dataset.phase === 'ended', 'Standalone editor did not reach Edit');
        await win.AMOS_GAME_PAGE.dispose();
      } finally { frame.remove(); }
      return { editors: 2, frames, gpuFrames, independentPixels, protectedPopExits: 4, ended: true, standalonePage: true };
    } finally { host.detach(); gpuHost.detach(); if (p) p.stop(); const gl = gpu.resources.context; gpu.dispose(); const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext(); }
  }, { sources, initialMaps, sourceNames: Object.keys(sources), assets: loadAssets(path.join(root, 'manifest.json')), gpuSources: require('./webglHostSources')(), clockSource: require('./fakeTimers').createFakeTimers.toString(),
    debugPage: buildGamePage(fs.readFileSync(path.join(root, 'LabEdit.AMOS')), { title: 'Joy Src1 editor', assets: loadAssets(path.join(root, 'manifest.json')), debug: true, initialMouse: [133, 50, 0] }),
    initialMouse: [133, 50, 0], playLabel: 'Open Editor', subject: 'editor', finishHint: 'Prepared initial pointer inside the map. Keys 1–6 select tiles; click to paint, F fills and C clears. Escape ends through Edit. Load/Save require prepared file selections.' });
};
