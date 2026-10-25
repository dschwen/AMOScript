/* jshint esversion: 6 */
'use strict';
module.exports = async function roller2StartupProbe(page) {
  const fs = require('fs'), path = require('path'), directory = path.join(__dirname, '../../examples/Roller2');
  const assets = Object.fromEntries(['music/Roller_II_Samples.Abk', 'music/mod.Roller_II_mus'].map(name => [`rii:${name.toLowerCase()}`, fs.readFileSync(path.join(directory, name)).toString('base64')]));
  return page.evaluate(({ source, assets, timerSource, filesSource }) => {
    const compiled = { exports: {} }; new Function('module', source)(compiled);
    const createTimers = new Function(`return (${timerSource});`)(), createFiles = new Function(`return (${filesSource});`)();
    const data = Object.fromEntries(Object.entries(assets).map(([name, bytes]) => [name, atob(bytes)]));
    const memory = createFiles(data), files = { read: name => memory.read(name.toLowerCase()),
      exists: name => memory.exists(name.toLowerCase()), isDirectory: name => memory.isDirectory(name.toLowerCase()) };
    const check = (value, message) => { if (!value) throw new Error(message); };
    let program, timers, notes;
    function start() {
      if (program) program.stop();
      timers = createTimers(); notes = [];
      program = compiled.exports({ files, now: timers.now, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
        audio: { command: e => { if (e.type === 'play') notes.push({ field: e.field, channel: Math.log2(e.mask), instrument: e.sample.number, period: e.period }); } } });
      program.tick(1000);
    }
    start();
    check(program.compilation.stackEntries === 501 && program.compilation.variableBufferBytes === 20480, 'Original directive metadata differs');
    check(program.currentDirectory() === 'RII:' && program.state.breakEnabled === false, 'Original directory/break settings differ');
    check(program.state.variables.int_itrom === -1 && program.state.variables.string_pic === 'RII:iffp/', 'Original boolean/path variables differ');
    check(program.state.audio.bank === 6 && program.state.tracker.bank === 22 && program.state.tracker.loop, 'Original bank/loop setup differs');
    check(program.state.waiting === 'key' && !program.mouseVisible(), 'Startup escaped its guard or failed to hide the pointer');
    check(program.fileExists('music/mod.Roller_II_mus') === -1 && program.fileExists('missing') === 0, 'Relative existence query differs');
    // Native cursor checks use a temporary Canvas host. Its captured default
    // screen precedes FLOAD; there is no title image or gameplay in this fixture.
    const canvas = document.createElement('canvas'); canvas.style.cursor = 'crosshair'; document.body.append(canvas);
    const host = AMOS_BROWSER.createCanvasHost(canvas); host.attach(program);
    try {
      host.render(); check(canvas.style.cursor === 'none', 'Original Hide did not reach Canvas');
      program.hide(); program.show(); host.render(); check(canvas.style.cursor === 'none', 'Nested Hide/Show lost a level');
      program.show(); host.render(); check(canvas.style.cursor === 'crosshair', 'Final Show did not restore the host cursor');
      program.hideOn(); host.render(); check(canvas.style.cursor === 'none', 'Hide On failed to reset nesting');
    } finally { host.detach(); check(canvas.style.cursor === 'crosshair', 'Detach did not restore the host cursor'); canvas.remove(); }
    timers.tick(120); check(notes.length === 1 && notes[0].instrument === 4 && program.state.tracker.position.field === 6, 'Original startup music did not reach its opening note');
    if (globalThis.AMOS_ROLLER2_STARTUP_CLEANUP) globalThis.AMOS_ROLLER2_STARTUP_CLEANUP();
    const old = document.getElementById('roller2-startup-controls'); if (old) old.remove();
    const controls = document.createElement('section'); controls.id = 'roller2-startup-controls';
    const help = document.createElement('p'); help.textContent = 'Unmodified first 17 physical Roller II lines, followed by a synthetic Wait Key. Step the injected 50 Hz clock to inspect music commands silently. Line 18 begins FLOAD; title rendering and gameplay are not executed here. Use the music demo for audible playback.';
    const step = document.createElement('button'); step.id = 'roller2-startup-step'; step.textContent = 'Advance 6 fields';
    const reset = document.createElement('button'); reset.id = 'roller2-startup-reset'; reset.textContent = 'Restart startup';
    const status = document.createElement('pre'); status.id = 'roller2-startup-status';
    function update() {
      controls.dataset.field = String(program.state.tracker.position.field);
      status.textContent = JSON.stringify({ boundary: 'original lines 1–17; synthetic Wait Key', compilation: program.compilation,
        directory: program.currentDirectory(), breakEnabled: program.state.breakEnabled, introMusic: program.state.variables.int_itrom,
        pointerVisible: program.mouseVisible(), tracker: program.state.tracker, notes }, null, 2);
    }
    step.addEventListener('click', () => { timers.tick(120); update(); });
    reset.addEventListener('click', () => { start(); update(); });
    controls.append(help, step, reset, status); document.body.append(controls); update();
    globalThis.AMOS_ROLLER2_STARTUP_CLEANUP = () => program.stop();
    return { lines: 17, variableBufferBytes: 20480, stackEntries: 501, directory: 'RII:', introMusic: -1, pointerChecks: 5, trackerField: 6, firstInstrument: 4, titleRendered: false };
  }, { source: new(require('../../lib/Transpiler'))(require('./roller2Startup')()).toModule(), assets,
    timerSource: require('./fakeTimers').createFakeTimers.toString(), filesSource: require('../../lib/amos/files').createMemoryFiles.toString() });
};
