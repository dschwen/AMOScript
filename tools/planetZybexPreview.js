/* jshint esversion: 6 */
'use strict';
// Original packed-background inspector. This is explicitly not a game launcher.
function installPlanetZybexPreview({ sources, assets, oracle, gpuSources, scoreSource, defaultSource, gameOverSource, channelsSource, channelsOracle, amalSource }) {
  const root = document.getElementById('planet-zybex-preview'), make = source => new Function(`return (${source});`)();
  const introduction = document.createElement('p'); introduction.textContent = 'Planet Zybex is the next game target. Preview its original level backgrounds and a prepared score-display fixture below. Player controls, enemies and bullets still require AMAL and sprite support.';
  const toolbar = document.createElement('div'); toolbar.className = 'amos-fullscreen-toolbar';
  const select = document.createElement('select'); select.id = 'zybex-level'; select.setAttribute('aria-label', 'Level background');
  for (const level of oracle.levels) select.add(new Option(`Level ${level.level}`, String(level.level)));
  select.add(new Option('Score display (fixture)', 'score'));
  select.add(new Option('Default startup (fixture)', 'default'));
  select.add(new Option('Game-over text (fixture)', 'game-over'));
  select.add(new Option('Channel routing (fixture)', 'channels'));
  select.add(new Option('AMAL enemy drop (slow preview)', 'amal'));
  const next = document.createElement('button'); next.id = 'zybex-next'; next.type = 'button'; next.textContent = 'Advance fixture'; next.hidden = true;
  const scroll = document.createElement('input'); scroll.id = 'zybex-scroll'; scroll.type = 'range'; scroll.min = '0'; scroll.step = '1'; scroll.value = '0'; scroll.setAttribute('aria-label', 'Scroll through level background');
  const fullButton = document.createElement('button'); fullButton.type = 'button'; fullButton.id = 'zybex-fullscreen'; fullButton.textContent = 'Fullscreen';
  toolbar.append(select, scroll, next, fullButton);
  const slot = document.createElement('div'), status = document.createElement('p'); status.id = 'zybex-preview-status'; status.className = 'amos-fullscreen-messages'; status.setAttribute('role', 'status');
  let canvas = document.createElement('canvas'); canvas.id = 'zybex-preview-input'; canvas.width = 320; canvas.height = 160; canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Planet Zybex background preview'); canvas.style.cssText = 'display:block;width:640px;max-width:100%;image-rendering:pixelated;background:black';
  const bindingTable = document.createElement('table'); bindingTable.id = 'zybex-channels'; bindingTable.hidden = true;
  const heading = document.createElement('thead'), headingRow = document.createElement('tr');
  for (const label of ['Channel', 'Target']) { const cell = document.createElement('th'); cell.textContent = label; headingRow.append(cell); }
  heading.append(headingRow); const bindings = document.createElement('tbody'); bindingTable.append(heading, bindings);
  slot.append(canvas); root.append(introduction, toolbar, slot, status, bindingTable);
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
    if (select.value === 'default') {
      host.render(); root.dataset.level = 'default'; root.dataset.scroll = '0'; root.dataset.stage = String(program.display.screens.size); root.dataset.bufferBytes = String(program.state.spriteBuffer.allocationBytes); root.dataset.backend = gpu ? 'webgl' : 'canvas'; root.dataset.phase = 'preview';
      status.textContent = program.display.screens.size ? 'Original Default: shipped screen and palette restored. Advance to run the original Screen Close and Close Editor statements.' : 'Original startup closed the display and allocated the 48-line Sprite buffer (4,800 bytes). AMAL and gameplay are not running.';
      next.disabled = program.state.halted; fullscreen.refresh(); return;
    }
    if (select.value === 'game-over') {
      host.render(); root.dataset.level = 'game-over'; root.dataset.graphicsStage = String(program.state.variables.int_stage); root.dataset.graphicsMode = String(program.display.screen().graphicsMode); root.dataset.backend = gpu ? 'webgl' : 'canvas'; root.dataset.phase = 'preview';
      status.textContent = ['Original GAME OVER: transparent text preserves the blue outline.', 'Harness comparison: opaque text overwrites the preceding outline.', 'Original transparent mode restored.'][program.state.variables.int_stage] + ' Advance or press a key in the canvas. This is a text fixture; gameplay is not running.';
      next.disabled = program.state.halted; fullscreen.refresh(); return;
    }
    if (select.value === 'amal') {
      host.render(); const channel = program.amalSnapshot()[0], ended = program.state.halted || !!(channel && channel.ended);
      root.dataset.level = 'amal'; root.dataset.amalY = String(program.bobInfo('Y Bob',21)); root.dataset.amalEnded = String(ended); root.dataset.backend = gpu ? 'webgl' : 'canvas'; root.dataset.phase = 'preview';
      status.textContent = 'Original Bob 21 AMAL drop, with declared trigger inputs on the level-1 background. Playback slows the frame waits by 5×. ' + (ended ? 'Drop complete; select another view and return to replay.' : program.state.waiting === 'key' ? 'Advance or press a key in the canvas to play.' : 'Playing the original movement through manual Synchro/Update.');
      next.disabled = program.state.halted || program.state.waiting !== 'key'; fullscreen.refresh(); return;
    }
    if (select.value === 'channels') {
      host.render(); const stage = program.state.variables.int_stage;
      if (root.dataset.channelStage !== String(stage)) {
        bindings.replaceChildren();
        for (let channel = 0; channel < 64; channel++) {
          const binding = program.channelBinding(channel);
          if (binding.type === 'sprite' && channel !== 15) continue;
          const row = document.createElement('tr');
          for (const value of [String(channel), `${binding.type === 'bob' ? 'Bob' : 'Sprite'} ${binding.number}`]) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
          bindings.append(row);
        }
      }
      root.dataset.level = 'channels'; root.dataset.channelStage = String(stage); root.dataset.backend = gpu ? 'webgl' : 'canvas'; root.dataset.phase = 'preview';
      status.textContent = channelsOracle.frames[stage].label + '. Original Channel statements change routing only. The excerpts are joined by key guards; AMAL and gameplay are not running. ' + (program.state.halted ? 'Select another view to restart.' : 'Advance or press a key in the canvas.');
      next.disabled = program.state.halted; fullscreen.refresh(); return;
    }
    if (select.value === 'score') {
      host.render(); root.dataset.level = 'score'; root.dataset.scroll = '0'; root.dataset.score = String(program.state.variables.int_score); root.dataset.backend = gpu ? 'webgl' : 'canvas'; root.dataset.phase = 'preview';
      status.textContent = `Prepared score ${program.state.variables.int_score}, lives ${program.state.variables.int_lives}. Original hires score strip below a lowres level-1 playfield. ${program.state.halted ? 'Fixture finished; select again to restart.' : 'Press a key in the canvas to advance or finish the fixture.'} Gameplay is not running.`;
      fullscreen.refresh(); return;
    }
    const level = oracle.levels[Number(select.value) - 1], position = Number(scroll.value);
    program.display.screenOffset(1, level.width > 320 ? position : 0, level.height > 160 ? position : 0); host.render();
    root.dataset.level = select.value; root.dataset.scroll = String(position); root.dataset.backend = gpu ? 'webgl' : 'canvas'; root.dataset.phase = 'preview';
    status.textContent = `Level ${level.level}: ${level.width} × ${level.height} pixels. ${level.width > 320 ? 'Horizontal' : 'Vertical'} offset ${position}. ${gpu ? 'WebGL2' : 'Canvas'} background preview.`;
    fullscreen.refresh();
  }
  function choose() {
    if (disposed) return;
    if (host) host.detach(); if (program) program.stop(); if (gpu) gpu.clear();
    const module = { exports: {} }; new Function('module', select.value === 'amal' ? amalSource : select.value === 'channels' ? channelsSource : select.value === 'game-over' ? gameOverSource : select.value === 'default' ? defaultSource : select.value === 'score' ? scoreSource : sources[Number(select.value) - 1])(module);
    program = module.exports({ files, sleepScale: select.value === 'amal' ? 5 : 1 }); host = AMOS_BROWSER.createCanvasHost(canvas, { renderer: gpu }); host.attach(program);
    try {
      program.tick(1000); bindingTable.hidden = select.value !== 'channels'; next.hidden = !['default','game-over','channels','amal'].includes(select.value); next.disabled = false; scroll.disabled = ['score','default','game-over','channels','amal'].includes(select.value); const level = oracle.levels[Number(select.value) - 1]; scroll.max = level ? String(Math.max(level.width - 320, level.height - 160)) : '0'; scroll.value = '0'; update();
    } catch (error) { program.stop(); root.dataset.phase = 'error'; status.textContent = error.message; }
  }
  next.onclick = () => { if (program && !disposed && ['default','game-over','channels','amal'].includes(select.value)) { program.sendKey('next'); update(); } };
  select.onchange = choose; scroll.oninput = update;
  const monitor = setInterval(() => { if (['score','default','game-over','channels','amal'].includes(select.value)) update(); }, 50);
  function dispose() {
    if (disposed) return; disposed = true; clearInterval(monitor); if (host) host.detach(); if (program) program.stop(); fullscreen.dispose();
    if (gpu) { const gl = gpu.resources.context; gpu.dispose(); const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext(); }
    root.dataset.phase = 'disposed'; window.removeEventListener('pagehide', dispose);
  }
  window.addEventListener('pagehide', dispose); choose();
}
module.exports = installPlanetZybexPreview;
