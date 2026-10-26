/* jshint esversion: 6 */
'use strict';
module.exports = async function tunnelProbe(page) {
  const fs = require('fs'), path = require('path'), Transpiler = require('../../lib/Transpiler');
  const raw = fs.readFileSync(path.join(__dirname, '../../examples/Tunnel/Tunneltest.amos')), expected = require('../fixtures/tunnel/frames.json');
  return page.evaluate(async ({ source, icons, original, expected, pngs, timerSource, gpuSources }) => {
    const module = { exports: {} }; new Function('module', source)(module);
    const factory = text => new Function(`return (${text});`)(), makeClock = factory(timerSource);
    const model = factory(gpuSources.model)(), sprites = factory(gpuSources.sprites)();
    const createGpu = factory(gpuSources.renderer)(model, sprites, factory(gpuSources.resources)(model), factory(gpuSources.shaders), factory(gpuSources.layout));
    const release = gpu => { if (!gpu) return; const gl = gpu.resources.context; gpu.dispose(); const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext(); };
    const check = (value, message) => { if (!value) throw Error(message); };
    const hash = async data => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data))).map(v => v.toString(16).padStart(2, '0')).join('');
    const golden = Object.fromEntries(await Promise.all(Object.entries(pngs).map(async ([name, data]) => {
      const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode(); const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 256; canvas.getContext('2d').drawImage(image, 0, 0);
      return [name, canvas.getContext('2d').getImageData(0, 0, 320, 256).data];
    })));
    const iconBytes = atob(icons), originalBytes = atob(original);
    function make(background = originalBytes) {
      const clock = makeClock(), reads = [], p = module.exports({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
        files: { read(name) { reads.push(name); if (name === 'df1:intrtunic.abk') return iconBytes; if (name === 'df1:intrtunnel') return background; throw Error(`Unexpected tunnel file: ${name}`); } } });
      return { p, clock, reads, frame: 1 };
    }
    const run = make(), surface = document.createElement('canvas'), gpu = createGpu(document.createElement('canvas'));
    const host = AMOS_BROWSER.createCanvasHost(surface, { requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const gpuHost = AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas, { renderer: gpu, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    let gpuFrames = 0, images = 0;
    try {
      host.attach(run.p); gpuHost.attach(run.p); run.p.tick(1000);
      for (const frame of expected.frames) {
        if (frame.frame) run.clock.tick(20); host.render();
        const rgba = surface.getContext('2d').getImageData(0, 0, 320, 256).data;
        check(await hash(rgba) === frame.rgbaSha256, `Tunnel independent RGBA hash: ${frame.frame}`);
        check(await hash(run.p.display.screen(0).physicalPixels) === frame.indicesSha256, `Tunnel independent planar-code hash: ${frame.frame}`);
        if (frame.png) {
          check(rgba.every((v, i) => v === golden[frame.png][i]), `Tunnel independent PNG: ${frame.frame}`); images++;
          if (globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: `Original tunnel animation frame ${frame.frame}`, width: 320, height: 256, rgba });
          const previous = run.p.display.canvasFrame; run.p.display.canvasFrame = () => { throw Error('Tunnel GPU used CPU presentation'); }; try { gpuHost.render(); } finally { run.p.display.canvasFrame = previous; }
          const actual = gpu.readPixels(), cpu = run.p.display.renderDisplay(); check(gpu.stats.lastResult.backend === 'gpu' && actual.length === cpu.length && actual.every((v, i) => v === cpu[i]), 'Tunnel GPU differs'); gpuFrames++;
          if (globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: `WebGL tunnel frame ${frame.frame}`, width: 640, height: 256, rgba: actual });
        }
      }
      check(JSON.stringify(run.reads) === '["df1:intrtunic.abk","df1:intrtunnel"]', 'Original Load requests changed');
    } finally { host.detach(); gpuHost.detach(); run.p.stop(); release(gpu); }
    const controls = document.createElement('section'); controls.id = 'tunnel-controls';
    const help = document.createElement('p'); help.textContent = 'Original 26-line Tunneltest animation with the supplied intrtunic.abk icons and intrtunnel IFF background. Pause or step frames, use fullscreen, or choose a custom IFF background. Use original background restores the supplied file.';
    const viewport = document.createElement('section'); viewport.id = 'tunnel-viewport'; const toolbar = document.createElement('div'); toolbar.className = 'amos-fullscreen-toolbar'; const slot = document.createElement('div'), status = document.createElement('pre'), fullButton = document.createElement('button'), fullStatus = document.createElement('span'); fullButton.id = 'tunnel-fullscreen'; toolbar.append(fullButton, fullStatus);
    let canvas = document.createElement('canvas'), liveGpu = null; canvas.id = 'tunnel-input'; slot.append(canvas); viewport.append(toolbar, slot, status); controls.append(help, viewport); document.body.append(controls);
    try { liveGpu = createGpu(canvas); } catch (_) { const gl = canvas.getContext('webgl2'), ext = gl && gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); const next = canvas.cloneNode(); canvas.replaceWith(next); canvas = next; }
    let live, adapter, paused = false, disposed = false, error = '', background = originalBytes, uploadedBackground = false, upload = 0;
    function update() { Object.assign(controls.dataset, { frame: String(live ? live.frame : 0), paused: String(paused), phase: error ? 'error' : paused ? 'paused' : 'playing', background: uploadedBackground ? 'uploaded' : 'original', backend: liveGpu ? 'webgl' : 'canvas' }); status.textContent = error || `Frame ${live.frame} · ${paused ? 'Paused' : 'Playing'} · ${uploadedBackground ? 'Uploaded IFF background' : 'Original supplied background'}`; fullscreen.refresh(); }
    function fail(failure) { error = failure.message; paused = true; if (live) live.p.stop(); update(); }
    function start() { upload++; if (adapter) adapter.detach(); if (live) live.p.stop(); if (liveGpu) liveGpu.clear(); error = ''; live = make(background); adapter = AMOS_BROWSER.createCanvasHost(canvas, { renderer: liveGpu }); adapter.attach(live.p); try { live.p.tick(1000); if (paused) live.p.stop(); adapter.render(); update(); } catch (failure) { fail(failure); } }
    function advance() { if (error) return; try { if (paused) live.p.resume(); live.clock.tick(20); live.frame++; if (paused) live.p.stop(); adapter.render(); update(); } catch (failure) { fail(failure); } }
    for (const action of ['pause', 'resume', 'step', 'restart', 'original']) {
      const button = document.createElement('button'); button.id = `tunnel-${action}`; button.textContent = { pause: 'Pause', resume: 'Play', step: 'Step frame', restart: 'Restart', original: 'Use original background' }[action]; toolbar.append(button);
      button.onclick = () => { if (action === 'pause') { paused = true; live.p.stop(); } else if (action === 'resume' && !error) { paused = false; live.p.resume(); } else if (action === 'step') { paused = true; live.p.stop(); advance(); } else if (action === 'restart') start(); else if (action === 'original') { background = originalBytes; uploadedBackground = false; start(); } update(); };
    }
    const label = document.createElement('label'), picker = document.createElement('input'); label.textContent = 'Choose IFF background '; picker.id = 'tunnel-background'; picker.type = 'file'; picker.accept = '.iff,.ilbm'; label.append(picker); toolbar.append(label);
    picker.onchange = async () => { const file = picker.files[0], token = ++upload; if (!file) return; try { if (file.size > 16 * 1024 * 1024) throw Error('IFF exceeds 16 MiB'); const bytes = new Uint8Array(await file.arrayBuffer()); if (disposed || upload !== token) return; background = Array.from(bytes, byte => String.fromCharCode(byte)).join(''); uploadedBackground = true; start(); } catch (failure) { if (!disposed && upload === token) fail(failure); } };
    const fullscreen = AMOS_FULLSCREEN.createFullscreenHost(viewport, { button: fullButton, statusElement: fullStatus, surface: slot, getContent: () => canvas }); start();
    const timer = setInterval(() => { if (!disposed && !paused) advance(); }, 20);
    globalThis.AMOS_TUNNEL_CLEANUP = async () => { disposed = true; upload++; clearInterval(timer); adapter.detach(); live.p.stop(); release(liveGpu); await fullscreen.dispose(); };
    return { frames: 48, pngs: images, gpuFrames, icons: 27, originalAssets: true };
  }, { source: new Transpiler(raw).toModule(), icons: fs.readFileSync(path.join(__dirname, '../../examples/Tunnel/intrtunic.abk')).toString('base64'), original: fs.readFileSync(path.join(__dirname, '../../examples/Tunnel/intrtunnel')).toString('base64'), expected,
    pngs: Object.fromEntries(expected.frames.filter(f => f.png).map(f => [f.png, fs.readFileSync(path.join(__dirname, '../fixtures/tunnel', f.png)).toString('base64')])), timerSource: require('./fakeTimers').createFakeTimers.toString(), gpuSources: require('./webglHostSources')() });
};
