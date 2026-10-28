/* jshint esversion: 6 */
'use strict';
// Original packed-background inspector. This is explicitly not a game launcher.
function installPlanetZybexPreview({ sources, assets, oracle, gpuSources }) {
  const root = document.getElementById('planet-zybex-preview'), make = source => new Function(`return (${source});`)();
  const introduction = document.createElement('p'); introduction.textContent = 'Planet Zybex is the next game target. Preview its original level backgrounds below. Player controls, enemies and bullets still require AMAL and sprite support.';
  const toolbar = document.createElement('div'); toolbar.className = 'amos-fullscreen-toolbar';
  const select = document.createElement('select'); select.id = 'zybex-level'; select.setAttribute('aria-label', 'Level background');
  for (const level of oracle.levels) select.add(new Option(`Level ${level.level}`, String(level.level)));
  const scroll = document.createElement('input'); scroll.id = 'zybex-scroll'; scroll.type = 'range'; scroll.min = '0'; scroll.step = '1'; scroll.value = '0'; scroll.setAttribute('aria-label', 'Scroll through level background');
  const fullButton = document.createElement('button'); fullButton.type = 'button'; fullButton.id = 'zybex-fullscreen'; fullButton.textContent = 'Fullscreen';
  toolbar.append(select, scroll, fullButton);
  const slot = document.createElement('div'), status = document.createElement('p'); status.id = 'zybex-preview-status'; status.className = 'amos-fullscreen-messages'; status.setAttribute('role', 'status');
  let canvas = document.createElement('canvas'); canvas.id = 'zybex-preview-input'; canvas.width = 320; canvas.height = 160; canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Planet Zybex background preview'); canvas.style.cssText = 'display:block;width:640px;max-width:100%;image-rendering:pixelated;background:black';
  slot.append(canvas); root.append(introduction, toolbar, slot, status);
  let program = null, host = null, gpu = null, disposed = false;
  try {
    const model = make(gpuSources.model)(), sprites = make(gpuSources.sprites)();
    gpu = make(gpuSources.renderer)(model, sprites, make(gpuSources.resources)(model), make(gpuSources.shaders), make(gpuSources.layout))(canvas);
  } catch (_) {
    const gl = canvas.getContext('webgl2'), ext = gl && gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
    const fallback = canvas.cloneNode(); canvas.replaceWith(fallback); canvas = fallback;
  }
  const fullscreen = AMOS_FULLSCREEN.createFullscreenHost(root, { button: fullButton, surface: slot, getContent: () => canvas });
  const files = { read(name) { const value = assets[name.toLowerCase()]; if (!value) throw Error(`Missing level asset: ${name}`); return atob(value); } };
  function update() {
    if (!program || disposed) return;
    const level = oracle.levels[Number(select.value) - 1], position = Number(scroll.value);
    program.display.screenOffset(1, level.width > 320 ? position : 0, level.height > 160 ? position : 0); host.render();
    root.dataset.level = select.value; root.dataset.scroll = String(position); root.dataset.backend = gpu ? 'webgl' : 'canvas'; root.dataset.phase = 'preview';
    status.textContent = `Level ${level.level}: ${level.width} × ${level.height} pixels. ${level.width > 320 ? 'Horizontal' : 'Vertical'} offset ${position}. ${gpu ? 'WebGL2' : 'Canvas'} background preview.`;
    fullscreen.refresh();
  }
  function choose() {
    if (disposed) return;
    if (host) host.detach(); if (program) program.stop(); if (gpu) gpu.clear();
    const module = { exports: {} }; new Function('module', sources[Number(select.value) - 1])(module);
    program = module.exports({ files }); host = AMOS_BROWSER.createCanvasHost(canvas, { renderer: gpu }); host.attach(program);
    try {
      program.tick(1000); const level = oracle.levels[Number(select.value) - 1]; scroll.max = String(Math.max(level.width - 320, level.height - 160)); scroll.value = '0'; update();
    } catch (error) { program.stop(); root.dataset.phase = 'error'; status.textContent = error.message; }
  }
  select.onchange = choose; scroll.oninput = update;
  function dispose() {
    if (disposed) return; disposed = true; if (host) host.detach(); if (program) program.stop(); fullscreen.dispose();
    if (gpu) { const gl = gpu.resources.context; gpu.dispose(); const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext(); }
    root.dataset.phase = 'disposed'; window.removeEventListener('pagehide', dispose);
  }
  window.addEventListener('pagehide', dispose); choose();
}
module.exports = installPlanetZybexPreview;
