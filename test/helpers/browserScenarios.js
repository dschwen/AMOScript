/* jshint esversion: 6 */
'use strict';

// Shared browser scenarios: Playwright and generated standalone demo pages run
// the same evaluator, compiled AMOS inputs and result assertions.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Transpiler = require('../../lib/Transpiler');
const { binary, token: t, integer: n, text } = require('./tokens');
const bankBytes = Buffer.from(fs.readFileSync(path.join(__dirname, '../fixtures/image-banks.hex'), 'utf8').replace(/\s/g, ''), 'hex');

async function trigonometry(page) {
  const trig = (name, value) => [t(name), t('('), n(value), t(')')];
  const trigSource = new Transpiler(binary([
    [t('Cls Colour'), n(0)], [t('Colour'), n(3), t(','), n(0xf00)], [t('Ink'), n(3)], [t('Degree')],
    [t('Plot'), n(10), t(','), n(100), t('-'), trig('Sin', 90), t('*'), n(20)],
    [t('Plot'), n(20), t(','), n(100), t('-'), trig('Cos', 0), t('*'), n(20)],
    [t('Print'), trig('Sin', 90), t(','), trig('Cos', 0), t(','), trig('Tan', 0)],
    [t('Radian')], [t('Print'), trig('Sin', 0)]
  ])).toModule();
  return page.evaluate(source => {
    const module = { exports: {} };
    new Function('module', source)(module);
    const logs = [];
    const program = module.exports({ print: (...args) => logs.push(args) });
    const canvas = document.createElement('canvas');
    const host = AMOS_BROWSER.createCanvasHost(canvas);
    host.attach(program);
    program.tick(100);
    host.render();
    const pixels = [[10, 80], [20, 80], [10, 79]].map(([x, y]) => Array.from(canvas.getContext('2d').getImageData(x, y, 1, 1).data));
    const snapshot = program.display.snapshotPlayfield();
    const native = program.display.renderPlayfield();
    const hardware = program.display.renderDisplay();
    const nativePixels = [[20, 80], [40, 80], [20, 79]].map(([x, y]) =>
      Array.from(native.slice((y * snapshot.frame.outputWidth + x) * 4, (y * snapshot.frame.outputWidth + x) * 4 + 4)));
    const hardwarePixels = [[20, 80], [40, 80], [20, 79]].map(([x, y]) =>
      Array.from(hardware.slice((y * snapshot.frame.outputWidth + x) * 4, (y * snapshot.frame.outputWidth + x) * 4 + 4)));
    host.detach();
    return { logs, pixels, nativePixels, hardwarePixels, halted: program.state.halted };
  }, trigSource);
}

function checkTrigonometry(result, assert) {

  assert.deepStrictEqual(result, { logs: [[1, 1, 0], [0]],
    pixels: [[255, 0, 0, 255], [255, 0, 0, 255], [0, 0, 0, 255]],
    nativePixels: [[255, 0, 0, 255], [255, 0, 0, 255], [0, 0, 0, 255]],
    hardwarePixels: [[255, 0, 0, 255], [255, 0, 0, 255], [0, 0, 0, 255]], halted: true });
}

async function ehb(page) {
  const ehbSource = new Transpiler(binary([
    [t('Screen Open'), n(0), t(','), n(320), t(','), n(200), t(','), n(64), t(','), t('Lowres')],
    [t('Cls Colour'), n(0)], [t('Colour'), n(33), t(','), n(0x1135)],
    [t('Colour'), n(0), t(','), n(0x246)], [t('Colour'), n(31), t(','), n(0xfff)],
    ...[33, 1, 32, 63].map((colour, index) => [t('Plot Colour'), n(10 + index), t(','), n(10), t(','), n(colour)])
  ])).toModule();
  return page.evaluate(source => {
    const module = { exports: {} }; new Function('module', source)(module);
    const program = module.exports(), canvas = document.createElement('canvas');
    const host = AMOS_BROWSER.createCanvasHost(canvas);
    try {
      host.attach(program); program.tick(100); host.render();
      const native = program.display.renderPlayfield(), hardware = program.display.renderDisplay();
      return { pixels: Array.from(canvas.getContext('2d').getImageData(10, 10, 4, 1).data),
        native: [20, 22, 24, 26].flatMap(x => Array.from(native.slice((10 * 640 + x) * 4, (10 * 640 + x) * 4 + 4))),
        hardware: [20, 22, 24, 26].flatMap(x => Array.from(hardware.slice((10 * 640 + x) * 4, (10 * 640 + x) * 4 + 4))),
        indices: [10, 11, 12, 13].map(x => program.display.point(x, 10)), png: canvas.toDataURL('image/png') };
    } finally { host.detach(); program.stop(); }
  }, ehbSource);
}

function checkEhb(result, assert) {

  const ehbExpected = [0, 17, 34, 255, 17, 51, 85, 255, 17, 34, 51, 255, 119, 119, 119, 255];
  assert.deepStrictEqual(result.pixels, ehbExpected);
  assert.deepStrictEqual(result.native, ehbExpected); assert.deepStrictEqual(result.hardware, ehbExpected);
  assert.deepStrictEqual(result.indices, [33, 1, 32, 63]);
}

async function ham(page) {
  const hamSource = new Transpiler(binary([
    [t('Screen Open'), n(0), t(','), n(320), t(','), n(200), t(','), n(4096), t(','), t('Lowres')],
    [t('Cls Colour'), n(0)], [t('Colour'), n(0), t(','), n(0x123)], [t('Colour'), n(1), t(','), n(0xabc)],
    ...[31, 42, 51, 1].map((code, index) => [t('Plot Colour'), n(10 + index), t(','), n(10), t(','), n(code)]),
    [t('Plot Colour'), n(0), t(','), n(11), t(','), n(31)]
  ])).toModule();
  return page.evaluate(source => {
    const module = { exports: {} }; new Function('module', source)(module);
    const program = module.exports(), independent = module.exports();
    const canvas = document.createElement('canvas'), host = AMOS_BROWSER.createCanvasHost(canvas);
    try {
      host.attach(program); program.tick(100); host.render();
      const planar = program.display.renderPlayfield(), copper = program.display.renderDisplay();
      const positions = [[10, 10], [11, 10], [12, 10], [13, 10], [0, 11]];
      const read = (rgba, x, y) => Array.from(rgba.slice((y * 640 + x * 2) * 4, (y * 640 + x * 2) * 4 + 4));
      return { canvas: positions.map(([x, y]) => Array.from(canvas.getContext('2d').getImageData(x, y, 1, 1).data)),
        planar: positions.map(([x, y]) => read(planar, x, y)), copper: positions.map(([x, y]) => read(copper, x, y)),
        codes: positions.map(([x, y]) => program.display.point(x, y)), independentHam: independent.display.screen().ham,
        png: canvas.toDataURL('image/png') };
    } finally { host.detach(); program.stop(); independent.stop(); }
  }, hamSource);
}

function checkHam(result, assert) {

  const hamExpected = [[17, 34, 255, 255], [170, 34, 255, 255], [170, 51, 255, 255], [170, 187, 204, 255], [17, 34, 255, 255]];
  assert.deepStrictEqual(result.canvas, hamExpected); assert.deepStrictEqual(result.planar, hamExpected);
  assert.deepStrictEqual(result.copper, hamExpected); assert.deepStrictEqual(result.codes, [31, 42, 51, 1, 31]);
  assert.strictEqual(result.independentHam, false);
}

async function sprites(page) {
  const directSprite = x => [t('Sprite'), n(1), t(','), n(x), t(','), n(59), t(','), n(1)];
  const spriteSource = new Transpiler(Buffer.concat([binary([
    [t('Cls Colour'), n(0)], [t('Colour'), n(17), t(','), n(0xf00)],
    [t('Sprite Update Off')], directSprite(139), [t('Hide On')], [t('Wait Key')],
    [t('Sprite Update')], [t('Wait Key')], directSprite(149),
    [t('Sprite Update On')], [t('Show On')], [t('Wait Key')],
    [t('Sprite Off Number'), n(1)], [t('Sprite Update')]
  ]), bankBytes.subarray(20)])).toModule();
  return page.evaluate(source => {
    const module = { exports: {} };
    new Function('module', source)(module);
    // Fake all three clock hooks; Wait Key is advanced explicitly below.
    const create = () => module.exports({ setTimeout: () => 1, clearTimeout: () => {}, now: () => 0 });
    const program = create(), independent = create();
    const canvas = document.createElement('canvas');
    canvas.style.cursor = 'crosshair';
    const host = AMOS_BROWSER.createCanvasHost(canvas);
    const read = x => Array.from(canvas.getContext('2d').getImageData(x, 10, 1, 1).data);
    const stages = [];
    host.attach(program);
    const observe = () => {
      host.render();
      const native = program.display.renderDisplay();
      const readNative = x => Array.from(native.slice((10 * 640 + x * 2) * 4, (10 * 640 + x * 2) * 4 + 4));
      if (JSON.stringify([read(10), read(20)]) !== JSON.stringify([readNative(10), readNative(20)])) {
        throw new Error('Structured physical sprite output differs from Canvas');
      }
      stages.push({ old: read(10), next: read(20), cursor: canvas.style.cursor,
        indexed: program.display.point(10, 10), waiting: program.state.waiting });
    };
    try {
      program.tick(100); observe();
      for (let i = 0; i < 3; i++) {
        program.sendKey('x'); program.tick(100); observe();
      }
    } finally {
      host.detach(); program.stop(); independent.stop();
    }
    return { stages, restoredCursor: canvas.style.cursor,
      independentImage: independent.spriteInfo('I Sprite', 1), halted: program.state.halted };
  }, spriteSource);
}

function checkSprites(result, assert) {

  const black = [0, 0, 0, 255], red = [255, 0, 0, 255];
  assert.deepStrictEqual(result, {
    stages: [
      { old: black, next: black, cursor: 'none', indexed: 0, waiting: 'key' },
      { old: red, next: black, cursor: 'none', indexed: 0, waiting: 'key' },
      { old: black, next: red, cursor: 'crosshair', indexed: 0, waiting: 'key' },
      { old: black, next: black, cursor: 'crosshair', indexed: 0, waiting: null }
    ], restoredCursor: 'crosshair', independentImage: 0, halted: true
  });
}

async function banks(page) {
  const bankSource = new Transpiler(binary([
    [t('Load'), text('objects.abk')], [t('Get Sprite Palette')], [t('Cls Colour'), n(0)],
    [t('Paste Bob'), n(10), t(','), n(10), t(','), n(1)],
    [t('Load Bank'), text('objects.abk'), t(','), n(1)],
    [t('Paste Bob'), n(30), t(','), n(10), t(','), n(3)],
    [t('Paste Bob'), n(50), t(','), n(30), t(','), t('Hrev'), t('('), n(1), t(')')],
    [t('Save Bank'), text('saved.abk'), t(','), n(1)], [t('Erase'), n(1)], [t('Load'), text('saved.abk')],
    [t('Paste Bob'), n(10), t(','), n(40), t(','), n(1)],
    [t('Reserve As Work'), n(5), t(','), n(3)], [t('Reserve As Data'), n(6), t(','), n(4)],
    [t('Bank Shrink'), n(6), t('To'), n(2)],
    [t('Hot Spot'), n(1), t(','), n(0), t(','), n(0)], [t('Double Buffer')], [t('Bob Update Off')],
    [t('Bob'), n(0), t(','), n(60), t(','), n(10), t(','), n(1)], [t('Bob Update')], [t('Wait Key')],
    [t('Bank Swap'), n(1), t(','), n(10)], [t('Bob Update')], [t('Wait Key')],
    [t('Bank Swap'), n(1), t(','), n(10)], [t('Bob Update')], [t('Wait Key')],
    [t('Erase'), n(1)], [t('Bob Update')], [t('Erase Temp')]
  ])).toModule();
  return page.evaluate(({ source, bytes }) => {
    const module = { exports: {} };
    new Function('module', source)(module);
    const assets = new Map([['objects.abk', bytes]]);
    const program = module.exports({ files: { read: name => assets.get(name), write: (name, contents) => { assets.set(name, contents); } } });
    const canvas = document.createElement('canvas');
    const host = AMOS_BROWSER.createCanvasHost(canvas);
    host.attach(program);
    program.tick(100);
    host.render();
    const pixels = [[10, 10], [11, 10], [30, 10], [31, 10], [9, 10], [10, 40], [11, 40]].map(([x, y]) =>
      Array.from(canvas.getContext('2d').getImageData(x, y, 1, 1).data));
    const images = program.banks.get(1).images.length;
    const bobPixel = Array.from(canvas.getContext('2d').getImageData(60, 10, 1, 1).data);
    program.sendKey('x');
    program.tick(100);
    host.render();
    const swappedOut = Array.from(canvas.getContext('2d').getImageData(60, 10, 1, 1).data);
    program.sendKey('x');
    program.tick(100);
    host.render();
    const swappedBack = Array.from(canvas.getContext('2d').getImageData(60, 10, 1, 1).data);
    program.sendKey('x');
    program.tick(100);
    host.render();
    const restored = Array.from(canvas.getContext('2d').getImageData(60, 10, 1, 1).data);
    host.detach();
    return { pixels, images, bobPixel, swappedOut, swappedBack, restored,
      savedBytes: assets.get('saved.abk').length, savedHeader: assets.get('saved.abk').slice(0, 4),
      work: program.bankLength(5), data: program.bankLength(6), halted: program.state.halted };
  }, { source: bankSource, bytes: bankBytes.subarray(26, 124).toString('latin1') });
}

function checkBanks(result, assert) {

  assert.deepStrictEqual(result, { pixels: [[255, 0, 0, 255], [0, 255, 0, 255],
    [255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 0, 255], [255, 0, 0, 255], [0, 255, 0, 255]], images: 4,
    bobPixel: [255, 0, 0, 255], swappedOut: [0, 0, 0, 255], swappedBack: [255, 0, 0, 255],
    restored: [0, 0, 0, 255], savedBytes: 126, savedHeader: 'AmSp', work: 0, data: 2, halted: true });
}

const scenarios = [
  { id:'roller2', capturedFrames:false, title:'Roller II target and MOD inspector', description:'Original sample/Track Load statements execute with explicit fixture boundaries. A bounded M.K. reader decodes the original four-channel module, instruments and pattern effects. Whole-game compilation and tracker playback remain open.', run:require('./roller2Probe'), check(result,assert){
    assert.deepStrictEqual(result,{physicalLines:1199,encodings:194,unrecognized:41,wholeCompiled:false,trackerBank:22,moduleBytes:84006,orders:22,patterns:12,instruments:10,playback:false});
  } },
  { id: 'wonderland-game', title: 'Play unmodified Wonderland', initialFrame: 'Original level 1', description: 'The complete original game with default WebGL2 presentation, selectable Canvas 2D, fullscreen, keyboard/Gamepad controls, Stop/Resume and Restart. Input-only keyboard and injected-gamepad replays render three deaths/fades, two life restarts, game over and a fresh game. Enable/Mute controls route original sample commands through Web Audio; three native offline PCM/stereo comparisons cover the replay. No Amiga capture or persistent editor files are claimed.', run: require('./wonderlandGameProbe'), check(result, assert) {
    assert.strictEqual(result.inputModes,2);assert.deepStrictEqual(result.deaths,[[2,1,0],[2,1,0]]);
    assert.deepStrictEqual(result.restarts,[2,2]);assert.deepStrictEqual(result.fades,[3,3]);assert.deepStrictEqual(result.freshLives,[3,3]);
    assert.strictEqual(result.stopResume,true);assert.ok(result.frames>=20);assert.strictEqual(result.audioCommands,8);assert.strictEqual(result.audioComparisons,3);
    if(result.gpuUnavailable){assert.strictEqual(result.gpuFrames,0);assert.strictEqual(typeof result.gpuUnavailable,'string');}else{assert.strictEqual(result.gpuFrames,11);assert.deepStrictEqual(result.gpuDeaths,[2,1,0]);}
    assert.strictEqual(result.gameRunning,true);
  } },
  { id: 'file-selector', capturedFrames: false, title: 'Fsel$ and unmodified Wonderland game entry', description: 'Prepared synchronous file choices execute the original retry/Gosub/Return routine and selected load/save calls. The unmodified complete program runs and renders four first-level frames over two controlled seconds, including attached sprites and rainbow/HUD scheduling. No native selector GUI or complete gameplay parity is claimed.', run: require('./fileSelectorProbe'), check(result, assert) {
    assert.deepStrictEqual(result,{selectorModes:2,retryCalls:6,wholeCompiled:true,gameEntry:true,gameFrames:4,gameRunning:true});
  } },
  { id: 'random', capturedFrames: false, title: 'AMOS Rnd and original enemy initialization', description: 'Source-derived seeded PRNG vectors and eighteen original blob/green-jump streams with controlled beam input. Includes step/reset/cache controls; gameplay, native startup seeds and real beam timing remain outside this data fixture.', run: require('./randomProbe'), check(result, assert) {
    assert.deepStrictEqual(result,{vectors:5,streams:18,steps:216,gameRunning:false});
  } },
  { id: 'raw-files', capturedFrames: false, title: 'Wonderland raw level-file save/load', description: 'Original map writeback, Bsave, Bload and seed-refresh statements round-trip all five maps through an in-memory files adapter. Exact exclusive-end bytes, stable addresses and retained fifth seed are checked. Includes cell editing, raw download and optional local preload; file selection and gameplay are excluded.', run: require('./rawFilesProbe'), check(result, assert) {
    assert.deepStrictEqual(result,{levels:5,savedBytes:7205,comparedBytes:72050,omittedFifthSeed:true,gameRunning:false});
  } },
  { id: 'mouse', title: 'Wonderland hardware mouse and editor selection', initialFrame: 'Original editor selection fixture', description: 'Opt-in hardware-coordinate Canvas input, original mouse limits and polling-based Mouse Click. Original editor selection statements, scaled/bordered input and lifecycle cleanup pass; editor actions remain excluded. Includes a live button-selection harness.', run: require('./mouseProbe'), check(result, assert) {
    assert.deepStrictEqual(result,{selections:5,lifecycleChecks:5,coordinateModes:2,gameRunning:false});
  } },
  { id: 'zones', title: 'Wonderland editor panel zones', initialFrame: 'Original editor panel', description: 'Original five-button zone definitions and the original Zone expression classify all 10,240 panel positions with injected hardware coordinates. Independent panel PNG comparison and a live point/reset inspector; mouse clicks/limits and editor actions remain excluded.', run: require('./zonesProbe'), check(result, assert) {
    assert.deepStrictEqual(result,{zoneQueries:10240,panelPixels:10240,counts:[6460,900,900,900,756,324],gameRunning:false});
  } },
  { id: 'flash', title: 'AMOS Flash and screen-local Flash Off', initialFrame: 'Normal: 20 ms', description: 'Clocked colour cycles, selected-screen cancellation, unchanged physical pixels and immutable snapshots. Normal/EHB/HAM6 Canvas and CPU output use independent RGB expectations. Includes live Stop/Resume/Flash Off controls; Screen Open implicit flashing remains unsupported.', run: require('./flashProbe'), check(result, assert) {
    assert.deepStrictEqual(result,{frames:15,comparedPixels:460800,cancellations:3,gameRunning:false});
  } },
  { id: 'screen-copy', title: 'Wonderland: publish all five level maps', initialFrame: 'Level 1 published', description: 'Original level-data and Paste Bob loops build five hidden maps, then Screen Copy Logic To Physic publishes their full bitmaps without swapping. Includes a clock-stepped map demo and host scrolling inspection. Gameplay remains excluded.', run: require('./screenCopyProbe'), check(result, assert) {
    assert.deepStrictEqual(result,{levels:5,frames:10,comparedPixels:640000,gameRunning:false});
  } },
  { id: 'print-using', title: 'Wonderland score fields and Print Using', initialFrame: 'Wonderland level 5, score 12345', description: 'Original level/score statements, integer padding/truncation and five panel frames checked against a separate glyph rasterizer over independent image PNGs. Includes a compiled integer-field sandbox. Floats and decimal/exponent masks remain unsupported.', run: require('./printUsingProbe'), check(result, assert) {
    assert.strictEqual(result.frames,5);assert.strictEqual(result.comparedPixels,51200);
    assert.deepStrictEqual(result.outputs,[['1','     0'],['5',' 12345'],['2','234567'],['1','    42'],['3','483648']]);
    assert.strictEqual(result.gameRunning,false);
  } },
  { id: 'fade', title: 'Wonderland Fade and VBL palette timing', initialFrame: 'Wonderland Fade: 60 ms', description: 'Original title setup and post-death Fade 2 / Wait 64 / Wait Vbl lines, with declared trigger/exit guards. Nine independent RGB comparisons, immutable snapshots, unchanged physical pixels and clock-driven palette updates. Includes live Fade/Stop/Resume/Restart controls.', run: require('./fadeProbe'), check(result, assert) {
    assert.strictEqual(result.frames,9);assert.strictEqual(result.comparedPixels,737280);
    assert.strictEqual(result.noAnimationRequired,true);assert.strictEqual(result.sourceWaitFinished,true);
    assert.strictEqual(result.endpointBlack,true);assert.strictEqual(result.gameRunning,false);
  } },
  { id: 'scancodes', title: 'AMOS scan codes and Wonderland Escape', initialFrame: 'Wonderland Escape to original title', description: 'Inkey$/Scancode consumption, physical key mappings, repeats, joystick passthrough and lifecycle cleanup. Runs the original Wonderland input/Escape branch and title routine in a declared fixture. Includes a live compiled keyboard reader.', run: require('./scancodeProbe'), check(result, assert) {
    assert.deepStrictEqual(result.routes,[{scan:69,route:2},{scan:76,route:1},{scan:77,route:1},{scan:78,route:1},{scan:79,route:1},{scan:32,route:1}]);
    assert.strictEqual(result.keyChecks,9);assert.deepStrictEqual(result.repeatScans,[53,53,53]);assert.strictEqual(result.lifecycleChecks,6);
    assert.strictEqual(result.timersRemaining,0);assert.strictEqual(result.titleExact,true);assert.strictEqual(result.gameRunning,false);
  } },
  { id: 'computed-branches', title: 'Computed branches and Wonderland initialization', initialFrame: 'Original enemy initialization 2', description: 'One-based On Gosub/Goto, out-of-range fallthrough and return traces. Executes Wonderland\'s original dispatch line and three unchanged initializers; the other two targets have explicit End guards. Synthetic inputs and image captions; no enemy gameplay.', run: require('./onBranchProbe'), check(result, assert) {
    assert.deepStrictEqual(result.results.map(item => item.logs), [[[0],[2],[3],[4]],[[-4,99]],[[0,0]],[[-4,99]]]);
    assert.ok(result.results.every(item => item.halted && item.stack === 0));assert.strictEqual(result.gameRunning,false);
  } },
  { id: 'screen-windows', title: 'Wonderland screen windows and scrolling', initialFrame: 'Game window at 37,84', description: 'Original game/editor screen setup, physical-buffer scrolling, independent landscape/panel PNG checks, two blank rows and staged View commits. The complete game is not running.', run: require('./screenWindowProbe'), check(result, assert) {
    assert.strictEqual(result.frames,5); assert.strictEqual(result.comparedPixels,307840);
    assert.strictEqual(result.gapRows,10); assert.deepStrictEqual(result.sizes,[[320,202],[320,202],[320,202],[320,178],[320,178]]);
    assert.strictEqual(result.gameRunning,false);
  } },
  { id: 'wonderland-menu', title: 'Wonderland menu: keyboard and gamepad', initialFrame: 'Original menu (keyboard)', description: 'Original menu routines with animated movement, background toggle and mode selection. Choose keyboard mapping, Gamepad API or both in the live menu below. Stops before unsupported gameplay/editor dispatch.', run: require('./joystickProbe'), check(result, assert) {
    assert.deepStrictEqual(result.selections,[1,2]);assert.strictEqual(result.backendChecks,12);
    assert.strictEqual(result.animatedMoves,5);
    assert.strictEqual(result.polledWithoutAnimation,true);assert.strictEqual(result.gameRunning,false);
  } },
  { id: 'key-repeat', title: 'AMOS keyboard repeat and cleanup', description: 'Source-compiled Key Speed, controlled 200/40 ms repeats, ignored native duplicates and keyup/blur/Stop/detach/End cleanup. Includes a focused live keyboard demo.', run: require('./keyRepeatProbe'), check(result, assert) {
    assert.deepStrictEqual(result.initial, [[0,'a'],[200,'a'],[240,'a']]);
    assert.strictEqual(result.lifecycleChecks, 5); assert.strictEqual(result.timersRemaining, 0); assert.strictEqual(result.ended, true);
  } },
  { id: 'music', title: 'Wonderland samples and Web Audio', description: 'Six original PCM samples, independent offline stereo/rate comparisons, loops, replacement and Stop/disposal checks. Explicit buttons audition each sample.', run: require('./musicProbe'), check(result, assert) {
    assert.deepStrictEqual(result.samples.map(sample => [sample.number, sample.channel, sample.nonzero]), [[1,0,true],[2,1,true],[3,1,true],[4,0,true],[5,0,true],[6,1,true]]);
    assert.ok(result.samples.every(sample => sample.maxDifference <= 1e-6));
    assert.strictEqual(result.loopChecks, 2); assert.strictEqual(result.lifecycleChecks, 5);
  } },
  { id: 'wonderland', title: 'Wonderland milestone: original title screen', initialFrame: 'Original title and menu marker (Canvas, fast startup)', description: 'Original 64-line title setup executes through Wait Vbl, image loading and its menu marker Bob. Both startup branches match an independent source-derived image. The menu loop and game are not running yet.', run: require('./wonderlandProbe'), check(result, assert) {
    assert.strictEqual(result.gameRunning, false); assert.strictEqual(result.physicalLines, 753);
    assert.deepStrictEqual(result.images, [
      { name: 'Title_Screen.Iff', width: 640, height: 256, exact: true },
      { name: 'Landscape.Iff', width: 1920, height: 288, exact: true },
      { name: 'Score_Panel.Iff', width: 640, height: 256, exact: true },
      { name: 'Editor_Panel.Iff', width: 640, height: 256, exact: true }
    ]);
    assert.strictEqual(result.unrecognizedEncodings,0);assert.strictEqual(result.compiler.ok,true);
    assert.strictEqual(result.startup.physicalLines, 64);
    assert.deepStrictEqual(result.startup.runs, [1, 0].map(speedFlag => ({ speedFlag, halted: true, variableBufferBytes: 10240,
      titleExact: true, waitedVbl: true, timersRemaining: 0,
      commands: ['Amos Lock', 'Close Editor'], reads: ['AMOSPro_Productivity2:Wonderland/Wonderland_Samples.Abk', 'AMOSPro_Productivity2:Wonderland/Title_Screen.Iff'],
      audio: { bank: 5, loopMask: 0, filterEnabled: false }, sampleCount: 6,
      keySpeed: { delay: 10, interval: 2, delayMs: 200, intervalMs: 40 }, levelSeeds: [55,7,45,10,49],
      imageCount: 75, firstMasks: [true,false,true,true,false,true,true,false], finalMask: false })));
  } },
  { id: 'webgl-integers', title: 'WebGL2 integer readback', description: 'Exact chip bytes, unsigned addressing, integer framebuffer and PNG decoding.', run: require('./webglProbe'), check(result, assert) {
    assert.match(result.version, /^WebGL 2/); assert.ok(result.maxTextureSize >= 2048);
    assert.deepStrictEqual(result.pixels, [131,124,2,255,251,4,3,255,17,238,0,255,67,188,1,255]);
  } },
  { id: 'webgl-resources', title: 'GPU uploads and context restoration', description: 'All chip sizes and ABI tables, dirty rows, independent consumers, loss/restore and disposal.', run: require('./webglResourcesProbe'), check(result, assert) {
    assert.deepStrictEqual(result.checkedSizes, [524288,1048576,2097152]); assert.strictEqual(result.dirtyRows, 3); assert.strictEqual(result.generation, 2);
  } },
  { id: 'webgl-renderer', title: 'GPU / CPU rendering gallery', description: 'Independent IFF images, scroll and sprite matrices, copper stacks, 100 seeded frames, GPU presentation/aspect scaling and restored shaders.', run: require('./webglRendererProbe'), check(result, assert) {
    assert.strictEqual(result.randomCount, 100); assert.strictEqual(result.restored, true); assert.strictEqual(result.reducerVerified, true);
    assert.strictEqual(result.presentationChecks, 6);
  } },
  { id: 'sprite-dma', title: 'Sprite DMA and channel reuse', description: 'Chained descriptors, blank control lines, held rows and native Canvas pixels.', run: require('./spriteDmaProbe'), check(result, assert) {
    assert.deepStrictEqual(result.pixels, [[255,0,0,255],[255,0,0,255],[0,0,0,255],[0,255,0,255],[0,0,0,255]]);
    assert.deepStrictEqual(result.held, [255,0,0,255]); assert.strictEqual(result.words, 26); assert.strictEqual(result.pointer, 0x3018);
  } },
  { id: 'trigonometry', title: 'Trigonometry and angle modes', description: 'Source-compiled Sin/Cos/Tan, degree/radian modes and matching Canvas/planar/copper pixels.', run: trigonometry, check: checkTrigonometry },
  { id: 'ehb', title: 'Extra Half Brite', description: 'Six-bit pixel codes, masked palette registers and exact four-bit halving.', run: ehb, check: checkEhb },
  { id: 'ham', title: 'HAM6 colour history', description: 'Palette and component commands, row resets, independent factories and three matching output paths.', run: ham, check: checkHam },
  { id: 'sprites', title: 'Direct sprites and manual updates', description: 'Frozen/pending positions, movement, hiding, palette priority, mouse reservation and cursor restoration.', run: sprites, check: checkSprites },
  { id: 'banks', title: 'Banks, buffers and Bobs', description: 'External load/save/reload, appending, swaps, reservation, shrinking, erasure and saved Bob backgrounds.', run: banks, check: checkBanks }
];

async function runScenario(id, page, artifacts) {
  const scenario = scenarios.find(scenario => scenario.id === id);
  if (!scenario) throw new Error(`Unknown browser scenario: ${id}`);
  const result = await scenario.run(page, artifacts);
  scenario.check(result, assert);
  return result;
}
module.exports = { scenarios, runScenario };
