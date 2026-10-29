/* jshint esversion: 6 */
'use strict';
// Original packed-background inspector. This is explicitly not a game launcher.
function installPlanetZybexPreview({ sources, assets, oracle, gpuSources, scoreSource, defaultSource, gameOverSource, channelsSource, channelsOracle, amalSource, missileSources, huntersSource, spritesSource, shipSource }) {
  const root = document.getElementById('planet-zybex-preview'), make = source => new Function(`return (${source});`)();
  const introduction = document.createElement('p'); introduction.textContent = 'Planet Zybex is the next game target. Preview its original level backgrounds and a prepared score-display fixture below. Ship controls/animation and AMAL enemy previews are available. The complete source also passes a bounded movement/firing/explosion replay; longer gameplay and a full launcher remain in progress.';
  const toolbar = document.createElement('div'); toolbar.className = 'amos-fullscreen-toolbar';
  const select = document.createElement('select'); select.id = 'zybex-level'; select.setAttribute('aria-label', 'Level background');
  for (const level of oracle.levels) select.add(new Option(`Level ${level.level}`, String(level.level)));
  select.add(new Option('Ship controls and animation (arrows / Ctrl / gamepad)', 'ship'));
  select.add(new Option('Computed ship sprites (image/allocation preview)', 'sprites'));
  select.add(new Option('Score display (fixture)', 'score'));
  select.add(new Option('Default startup (fixture)', 'default'));
  select.add(new Option('Game-over text (fixture)', 'game-over'));
  select.add(new Option('Channel routing (fixture)', 'channels'));
  select.add(new Option('AMAL enemy drop (slow preview)', 'amal'));
  select.add(new Option('AMAL missile loop (slow preview)', 'missile'));
  select.add(new Option('AMAL missile collision (prepared bullet)', 'missile-hit'));
  select.add(new Option('AMAL random hunters (portable beam 0)', 'hunters'));
  select.add(new Option('AMAL random hunters (controlled beam 65535)', 'hunters-beam'));
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
    if(select.value==='ship'){
      host.render();const frame=program.state.variables.int_frame;
      root.dataset.level='ship';root.dataset.shipFrame=String(frame);root.dataset.shipX=String(program.spriteInfo('X Sprite',15));root.dataset.shipY=String(program.spriteInfo('Y Sprite',15));root.dataset.shipImage=String(program.spriteInfo('I Sprite',15));root.dataset.shipFire=String(program.amreg(0));root.dataset.shipDead=String(program.amreg(24));root.dataset.backend=gpu?'webgl':'canvas';root.dataset.phase='preview';
      status.textContent='Original ship program: arrows move; Ctrl or gamepad fire sets its fire flag (bullet-launch housekeeping omitted). Waits slowed by 3×. '+(frame===0?'Advance to play, then use the focused canvas.':frame>88?'Preview complete; select another view and return to replay.':frame>=73?'Declared landscape-collision trigger: playing the original explosion.':'Playing. A declared collision at field 73 triggers the explosion.');
      next.disabled=frame!==0;fullscreen.refresh();return;
    }
    if(select.value==='sprites'){
      host.render();const stage=program.state.variables.int_stage;
      root.dataset.level='sprites';root.dataset.spriteStage=String(stage);root.dataset.backend=gpu?'webgl':'canvas';root.dataset.phase='preview';
      status.textContent=(stage<13?`Original player Sprite 15, ship image ${stage+1} of 13.`:stage===13?'Three ships reuse the hardware channels on separate rows.':stage===14?'A direct ship reserves six channels; only one strip of the next ship fits.':stage===15?'Visible mouse reserves channel 0; the ship uses pairs 2, 4 and 6.':'Sprite Off clears all ship output.')+' Advance or press a key. This is an allocation preview; ship controls and animation are not running.';
      next.disabled=stage===16;fullscreen.refresh();return;
    }
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
    if (['hunters','hunters-beam'].includes(select.value)) {
      host.render();const frame=program.state.variables.int_frame,score=program.amreg(9),seed=program.amalRandomState().seed,beam=select.value==='hunters-beam'?65535:0;
      root.dataset.level=select.value;root.dataset.huntersFrame=String(frame);root.dataset.huntersScore=String(score);root.dataset.huntersSeed=String(seed);root.dataset.backend=gpu?'webgl':'canvas';root.dataset.phase='preview';
      status.textContent=`Three original hunters share the AMAL random stream. Prepared player/scroll inputs, beam ${beam}; waits slowed by 3×. Score: ${score}. `+(frame>80?'Preview complete; select another view and return to replay.':frame===0?'Advance or press a key to play.':'Playing.');
      next.disabled=program.state.halted || program.state.waiting!=='key';fullscreen.refresh();return;
    }
    if (['missile','missile-hit'].includes(select.value)) {
      host.render();const frame=program.state.variables.int_frame,score=program.amreg(9),complete=frame>80;
      root.dataset.level=select.value;root.dataset.missileFrame=String(frame);root.dataset.missileScore=String(score);root.dataset.backend=gpu?'webgl':'canvas';root.dataset.phase='preview';
      status.textContent='Original missile Autotest/Move/For/Next program, slowed by 3× on the level-1 bitmap. '+(select.value==='missile-hit'?'A prepared stationary bullet triggers real mask collisions. ':'No bullet is present. ')+`AMAL score: ${score}. `+(complete?'Preview complete; select another view and return to replay.':frame===0?'Advance or press a key to play.':'Playing.');
      next.disabled=program.state.halted || program.state.waiting!=='key';fullscreen.refresh();return;
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
    const module = { exports: {} }; new Function('module', select.value==='ship' ? shipSource : select.value==='sprites' ? spritesSource : ['hunters','hunters-beam'].includes(select.value) ? huntersSource : ['missile','missile-hit'].includes(select.value) ? missileSources[select.value==='missile-hit'?1:0] : select.value === 'amal' ? amalSource : select.value === 'channels' ? channelsSource : select.value === 'game-over' ? gameOverSource : select.value === 'default' ? defaultSource : select.value === 'score' ? scoreSource : sources[Number(select.value) - 1])(module);
    program = module.exports({ files, readAmalBeam: select.value==='hunters-beam' ? ()=>65535 : undefined, sleepScale: ['ship','missile','missile-hit','hunters','hunters-beam'].includes(select.value) ? 3 : select.value === 'amal' ? 5 : 1 }); host = AMOS_BROWSER.createCanvasHost(canvas, { renderer: gpu, joysticks:select.value==='ship'?[{port:1,keyboard:{fire:['ControlLeft','ControlRight']},gamepad:true}]:[] }); host.attach(program);
    try {
      program.tick(1000); bindingTable.hidden = select.value !== 'channels'; next.hidden = !['ship','sprites','default','game-over','channels','amal','missile','missile-hit','hunters','hunters-beam'].includes(select.value); next.disabled = false; scroll.disabled = ['ship','sprites','score','default','game-over','channels','amal','missile','missile-hit','hunters','hunters-beam'].includes(select.value); const level = oracle.levels[Number(select.value) - 1]; scroll.max = level ? String(Math.max(level.width - 320, level.height - 160)) : '0'; scroll.value = '0'; update();
    } catch (error) { program.stop(); root.dataset.phase = 'error'; status.textContent = error.message; }
  }
  next.onclick = () => { if (program && !disposed && ['ship','sprites','default','game-over','channels','amal','missile','missile-hit','hunters','hunters-beam'].includes(select.value)) { program.sendKey('next'); if(select.value==='ship')host.focus(); update(); } };
  select.onchange = choose; scroll.oninput = update;
  const monitor = setInterval(() => { if (['ship','sprites','score','default','game-over','channels','amal','missile','missile-hit','hunters','hunters-beam'].includes(select.value)) update(); }, 50);
  function dispose() {
    if (disposed) return; disposed = true; clearInterval(monitor); if (host) host.detach(); if (program) program.stop(); fullscreen.dispose();
    if (gpu) { const gl = gpu.resources.context; gpu.dispose(); const ext = gl.getExtension('WEBGL_lose_context'); if (ext && !gl.isContextLost()) ext.loseContext(); }
    root.dataset.phase = 'disposed'; window.removeEventListener('pagehide', dispose);
  }
  window.addEventListener('pagehide', dispose); choose();
}
module.exports = installPlanetZybexPreview;
