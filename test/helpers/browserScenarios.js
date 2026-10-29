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
  { id: 'roller2-highscore', title: 'Roller II Ctrl fire and Enter high-score confirmation', initialFrame: 'Typed high-score name', description: 'Complete original game execution with a declared zero-score input file so the natural 299-point run qualifies. Both Ctrl keys fire, Ctrl+arrows combine, and unmapped shortcuts stay outside AMOS. Real keyboard input types and confirms a name with Enter; the original code saves Highscores, returns to the menu and starts a fresh game. No VM variable/IP edits or native capture.', run: require('./roller2HighscoreProbe'), check(result, assert) {
    assert.ok(result.assertions >= 18); assert.deepStrictEqual({ ...result, assertions: 0 }, { assertions: 0, name: 'codex', score: 299, writes: 1, entered: true, returnedToMenu: true, freshGame: true });
  } },
  { id: 'roller2-help', title: 'Roller II help pages and menu return', initialFrame: 'Canvas: Help icons 49–52', description: 'The complete current AMOS source runs all seven help icon pages and the original timed colour/ball examples, then returns to the menu. Line 1129 has a source-level final-page offset fix; compiler cursor bounds remain strict. Four independent raw-asset icon regions and nine actual GPU/CPU frame comparisons. Input-only replay, not an Amiga capture.', run: require('./roller2HelpProbe'), check(result, assert) {
    assert.deepStrictEqual(result, { pages: 7, finalEntries: [49, 50, 51, 52], frames: 9, returnedToMenu: true, writes: 0, gpuFrames: 9, independentPixels: 1024 });
  } },
  { id: 'game-page-debug', title: 'Application debug menu and binary file downloads', capturedFrames: false, description: 'Normal and --debug page-builder examples: live game-speed selection, accessible icon controls, AMOS Bsave exports of new/modified files, exact binary bytes, compact errors, source logs and owned download URL cleanup. The examples below remain playable after checks.', run: require('./gamePageDebugProbe'), check(result, assert) {
    assert.strictEqual(result.modifiedFiles, 2); assert.deepStrictEqual(result.binaryBytes, [0, 128, 255, 10]);
    assert.strictEqual(result.compactErrors, 2); assert.strictEqual(result.revokedUrls, 2); assert.strictEqual(result.icons, 3); assert.strictEqual(result.speedControl, true);
  } },
  { id: 'optimizer', title: 'Optimized scalar instruction blocks', capturedFrames: false, description: 'Compare reference and opt-in optimized standalone modules across nine instruction budgets, preserving typed values, source locations and original instruction counts. This is a semantic comparison, not a browser performance benchmark.', run: require('./optimizerProbe'), check(result, assert) {
    assert.strictEqual(result.comparisons, 9); assert.strictEqual(result.originalTicks, 5159);
    assert.ok(result.blocksExecuted > 0); assert.ok(result.instructionsBatched > 0);
  } },
  { id: 'browser-game-harness', title: 'Game page tutorial, Latin-1 font and touch joystick', description: 'Independent umlaut glyph pixels, real GPU text, multi-pointer cross controls, keyboard/Gamepad merging and owned input cleanup. Includes a fully generated playable HTML example with sound, fullscreen and touch settings.', run: require('./browserGameHarnessProbe'), check(result, assert) {
    assert.ok(result.assertions >= 15); assert.strictEqual(result.gpuFrames, 1); assert.strictEqual(result.latin1Glyphs, 96); assert.strictEqual(result.tutorial, true);
  } },
  { id:'roller2-edit',title:'Roller II Edit host boundary',initialFrame:'Canvas: diagonal after',description:'Original ROUNDTURN rotates four directions and reaches its Edit fallback for prepared zero/diagonal inputs. Twelve vector-oracle Canvas frames, four GPU comparisons and two post-cleanup editor requests; fullscreen and Restart. PHALT/movement are guarded; no embedded editor.',run:require('./roller2EditProbe'),check(result,assert){assert.strictEqual(result.cases,6);assert.strictEqual(result.frames,12);assert.strictEqual(result.gpuFrames,result.gpuUnavailable?0:4);assert.strictEqual(result.editRequests,2);assert.strictEqual(result.embeddedEditor,false);} },
  { id:'roller2-swap',title:'Roller II paired high-score sorting',initialFrame:'Canvas: middle sorted',description:'Original defaults, insertion and integer/string Swap sort all eleven score/name pairs. Five prepared entries match fifteen independent Canvas images and three GPU frames; editable score/name, fullscreen and Restart. Portable preview; source name entry, persistence and menu return excluded.',run:require('./roller2SwapProbe'),check(result,assert){assert.strictEqual(result.cases,5);assert.strictEqual(result.frames,15);assert.strictEqual(result.gpuFrames,result.gpuUnavailable?0:3);assert.strictEqual(result.sortRows,11);assert.strictEqual(result.persistence,false);} },
  { id:'roller2-rainbow-del',title:'Roller II rainbow deletion',initialFrame:'Canvas: overlap',description:'Original line 557 deletes rainbow 0 after a declared HOPSCREEN guard. Overlapping prepared PAL tables reveal slot 1, then delete-all restores the screen palette. Three independent Canvas images/three GPU frames, fullscreen and Restart; bounce/editor return excluded.',run:require('./roller2RainbowDelProbe'),check(result,assert){assert.strictEqual(result.frames,3);assert.strictEqual(result.gpuFrames,result.gpuUnavailable?0:3);assert.strictEqual(result.originalLines,1);assert.strictEqual(result.bounceAnimation,false);assert.strictEqual(result.editorRunning,false);} },
  { id:'roller2-get-icon',title:'Roller II Get Icon requesters',initialFrame:'Canvas: overwrite restored',description:'Original missing-level and overwrite prompt captures on a prepared striped screen. Six independent Canvas images and six GPU frames verify exclusive bounds, padded icon 118 and masked restore. Declared requester guards; fullscreen and Restart, with editor/persistence excluded.',run:require('./roller2GetIconProbe'),check(result,assert){assert.strictEqual(result.frames,6);assert.strictEqual(result.gpuFrames,result.gpuUnavailable?0:6);assert.strictEqual(result.captureCases,2);assert.strictEqual(result.editorRunning,false);} },
  { id:'roller2-pointer',title:'Roller II mouse pointer shapes',initialFrame:'Canvas: original arrow (7)',description:'Seven original Change Mouse statements select browser arrow/crosshair/wait cursors. Canvas/WebGL ownership, Hide/Show nesting and program switching are checked, with seven GPU comparisons. Prepared hover surface; editor actions and native pointer pixels excluded.',run:require('./roller2PointerProbe'),check(result,assert){assert.strictEqual(result.frames,7);assert.strictEqual(result.gpuFrames,result.gpuUnavailable?0:7);assert.strictEqual(result.cursorChecks,result.gpuUnavailable?15:30);assert.strictEqual(result.originalStatements,7);assert.strictEqual(result.editorRunning,false);} },
  { id:'roller2-scin',title:'Roller II screen under pointer',initialFrame:'Canvas: pointer case 7',description:'Original pointer-selection lines on declared overlapping windows. Seven Canvas stripe-oracle frames, seven GPU comparisons and pointer mapping on both hosts; live coordinate/zone readout, fullscreen and Restart. Editor scrolling/actions excluded.',run:require('./roller2ScinProbe'),check(result,assert){assert.strictEqual(result.frames,7);assert.strictEqual(result.gpuFrames,result.gpuUnavailable?0:7);assert.strictEqual(result.pointerSteps,result.gpuUnavailable?7:14);assert.strictEqual(result.originalStatements,5);assert.strictEqual(result.editorRunning,false);} },
  { id:'roller2-writing',title:'Roller II Writing text modes',initialFrame:'Canvas: Writing mode matrix',description:'Original Writing 0,2 label statement, a pen-only background proof and all fifteen mode/part combinations. Four independent Canvas images and four GPU comparisons; fullscreen and Restart. Prepared blank preview with portable font; editor loop excluded.',run:require('./roller2WritingProbe'),check(result,assert){assert.strictEqual(result.frames,4);assert.strictEqual(result.gpuFrames,result.gpuUnavailable?0:4);assert.strictEqual(result.modeCases,15);assert.strictEqual(result.originalStatements,2);assert.strictEqual(result.editorRunning,false);assert.strictEqual(result.blankPreview,true);} },
  { id:'roller2-lines',title:'Roller II patterned selection border',initialFrame:'Canvas: original redraw',description:'Original Set Line/Box selection, erase and redraw on a declared blank preview with the original palette. Three independent Canvas frames and three GPU comparisons; clipped edge-cell controls, fullscreen and Restart. Editor panel/Writing/game loop are excluded.',run:require('./roller2LineProbe'),check(result,assert){assert.strictEqual(result.frames,3);assert.strictEqual(result.gpuFrames,result.gpuUnavailable?0:3);assert.strictEqual(result.originalStatements,3);assert.strictEqual(result.editorRunning,false);assert.strictEqual(result.blankPreview,true);} },
  { id:'roller2-transfers',title:'Roller II editor memory transfers',capturedFrames:false,description:'Original editor Fill/Copy statements back up, clear and restore all fifteen real level payloads. Tile/colour bytes change while metadata, allocations and backup remain intact; restore waits at a declared redraw guard. Live in-memory preview without persistence or editor/game loops.',run:require('./roller2TransferProbe'),check(result,assert){assert.deepStrictEqual(result,{levels:15,fills:30,backups:15,restores:15,metadataUnchanged:true,persistent:false,editorRunning:false});} },
  { id:'roller2-arrows',title:'Roller II original arrow movement',initialFrame:'Canvas: keyboard up and left arrows stopped',description:'Original PFEIL/N34 after real level progression: one-pixel arrow steps and down/up/left turns, native timeout Boom, pause and source bank integrity. Twenty independent Canvas images/ten GPU comparisons over keyboard/Gamepad paths; remaining obstacle and game-over handlers stay guarded.',run:page=>require('./roller2MovementProbe')(page,{arrows:true}),check(result,assert){assert.strictEqual(result.positions,32);assert.strictEqual(result.arrows,6);assert.strictEqual(result.frames,20);assert.strictEqual(result.gpuFrames,result.gpuUnavailable?0:10);assert.strictEqual(result.fullGame,false);} },
  { id:'boom', title:'Synthesized AMOS Boom', capturedFrames:false, description:'Original four pitches, shared field-mutated noise and integer EnvBoom rendered as finite PCM with explicit portable beam/phase choices. Five independent native Web Audio stereo comparisons, Stop/disposal and gesture-controlled audition. Exact DMA/beam capture parity remains open.',run:require('./boomProbe'),check(result,assert){assert.strictEqual(result.voices,4);assert.strictEqual(result.comparisons,5);assert.ok(result.maximumDifference<1e-6);assert.strictEqual(result.stoppedSilent,true);assert.strictEqual(result.amigaCapture,false);} },
  { id: 'roller2-pauses', title: 'Roller II original pause modes', initialFrame: 'Canvas: keyboard pause resumed', description: 'Original PAUSE/IPause after real level progression: mouse/Help paid pause, Space pause popup, keyboard/Gamepad WTIN return and source Timer restoration. Twenty independent Canvas images and ten GPU comparisons; live fullscreen/Stop/Resume/Restart. Enter is joystick fire so Space reaches AMOS. Arrows and game-over remain guarded.', run: page=>require('./roller2MovementProbe')(page,{pauses:true}), check(result, assert) {
    assert.strictEqual(result.inputModes,2);assert.strictEqual(result.pauses,4);assert.strictEqual(result.collections,10);assert.strictEqual(result.frames,20);assert.strictEqual(result.gpuFrames,result.gpuUnavailable?0:10);assert.strictEqual(result.fullGame,false);
  } },
  { id: 'roller2-progression', title: 'Roller II bonus and next level', initialFrame: 'Canvas: keyboard level 2 started', description: 'Original five-tile collection continues through ZAEHLHOCH inclusive bonus scoring, Return and LEVLOAD into the real second-level bank, ready prompt and starting ball. Fourteen independent Canvas images and seven GPU comparisons using keyboard/Gamepad. Other obstacle/pause/game-over handlers remain guarded.', run: page=>require('./roller2MovementProbe')(page,{levels:true}), check(result, assert) {
    assert.strictEqual(result.inputModes,2);assert.strictEqual(result.collections,10);assert.strictEqual(result.frames,14);assert.strictEqual(result.gpuFrames,result.gpuUnavailable?0:7);assert.strictEqual(result.guard,'other-tile-handlers');assert.strictEqual(result.fullGame,false);
  } },
  { id: 'roller2-colours', title: 'Roller II original colour collections', initialFrame: 'Canvas: keyboard colour 5 collected', description: 'Original KCWEG/BCL/GAMED collect all five first-level colour tiles, update exact map bytes, score and remaining count, and fade only the ball palette. Fourteen independent Canvas images and seven WebGL comparisons across keyboard/Gamepad input; bonus scoring/level loading remains guarded.', run: page=>require('./roller2MovementProbe')(page,{colours:true}), check(result, assert) {
    assert.strictEqual(result.inputModes,2);assert.strictEqual(result.collections,10);assert.strictEqual(result.frames,14);assert.strictEqual(result.gpuFrames,result.gpuUnavailable?0:7);assert.strictEqual(result.guard,'level-bonus');assert.strictEqual(result.mapUnchanged,false);assert.strictEqual(result.fullGame,false);
  } },
  { id: 'roller2-movement', title: 'Roller II original floor movement', initialFrame: 'Canvas: keyboard colour-tile guard', description: 'Original string-based SAS$ dispatch, wall checks and floor sliding on level 1. Keyboard and browser Gamepad paths verify 48 field positions, twelve independent Canvas frames and six WebGL comparisons; the colour handler remains guarded. Live fullscreen/Stop/Resume/Restart preview.', run: require('./roller2MovementProbe'), check(result, assert) {
    assert.strictEqual(result.inputModes,2);assert.strictEqual(result.positions,48);assert.strictEqual(result.frames,12);assert.strictEqual(result.gpuFrames,result.gpuUnavailable?0:6);assert.strictEqual(result.guard,'tile:kcweg');assert.strictEqual(result.mapUnchanged,true);assert.strictEqual(result.movement,true);assert.strictEqual(result.fullGame,false);
  } },
  { id: 'roller2-input', title: 'Roller II original game input loop', initialFrame: 'Canvas: mouse board and ball ready', description: 'Connected original setup and JOAB through 639: real countdown, physical Key State, keyboard/Gamepad directions, effects/music keys and Escape menu return. Twenty-four independent Canvas checks and six WebGL frames; movement, pause and game-over handlers are guarded.', run: page => require('./roller2ReadyProbe')(page,{input:true}), check(result, assert) {
    assert.strictEqual(result.inputModes,4);assert.strictEqual(result.frames,24);assert.strictEqual(result.gpuFrames,result.gpuUnavailable?0:6);assert.strictEqual(result.guardAfter,'movement-dispatch');assert.strictEqual(result.gameRunning,false);
  } },
  { id: 'roller2-ready', title: 'Roller II ready prompt and initial ball', initialFrame: 'Canvas: mouse board and ball ready', description: 'Connected original startup/menu, game setup, GAMEDISP and blinking foreground ready prompt through line 617. Original ball palette, six-plane sprite, fade and status border; independent pixels, eighteen Canvas checks and six WebGL frames. Mouse, keyboard and Gamepad fire reach the guard before movement; live fullscreen preview.', run: require('./roller2ReadyProbe'), check(result, assert) {
    assert.strictEqual(result.inputModes,3);assert.strictEqual(result.frames,18);assert.strictEqual(result.gpuFrames,result.gpuUnavailable?0:6);assert.strictEqual(result.guardAfter,617);assert.strictEqual(result.connectedStartup,true);assert.strictEqual(result.gameRunning,false);
  } },
  { id: 'roller2-boards', title: 'Roller II original board rendering', initialFrame: 'Canvas: original level 1 board', description: 'Unchanged GAMEDISP across all fifteen supplied maps, with original icon copies, retained masks and source tile counts. Independent board PNGs, sixteen Canvas checks and two WebGL frames. Live level selector/fullscreen preview; palette restoration is a declared harness and the full prompt/gameplay path remains excluded.', run: require('./roller2BoardProbe'), check(result, assert) {
    assert.strictEqual(result.levels,15);assert.strictEqual(result.frames,16);assert.strictEqual(result.gpuFrames,result.gpuUnavailable?0:2);assert.strictEqual(result.gameRunning,false);assert.strictEqual(result.isolatedBoard,true);
  } },
  { id: 'roller2-icons', title: 'Roller II raw icon memory and ICCOPY', initialFrame: 'Canvas: after original ICCOPY', description: 'Original game-entry icon copies through checked planar aliases, including rounded padding and unchanged masks. Independent before/after pixels and two WebGL frames; live Copy/Reset/fullscreen inspector. Game screen and level setup remain excluded.', run: require('./roller2IconProbe'), check(result, assert) {
    assert.strictEqual(result.frames,2);assert.strictEqual(result.gpuFrames,result.gpuUnavailable?0:2);assert.strictEqual(result.copiedIcons,2);assert.strictEqual(result.bytesPerCopy,193);assert.strictEqual(result.masksRegenerated,false);assert.strictEqual(result.gameRunning,false);
  } },
  { id: 'roller2-levels', title: 'Roller II level metadata and word memory', capturedFrames: false, description: 'Original metadata reads and Doke time writes across all fifteen pinned level files, checked against independent headers. Live level/time memory preview; no file persistence, game/editor loop or rendering.', run: require('./roller2LevelProbe'), check(result, assert) {
    assert.deepStrictEqual(result,{levels:15,metadataReads:15,timeWrites:15,persistent:false,gameRunning:false});
  } },
  { id: 'roller2-menu', title: 'Roller II intro, menu and first level load', initialFrame: 'Canvas: first level loaded panel', description: 'Original startup, menu and game entry now create game screens, initialize the rainbow, load level 1 and refresh status text. Ten input cases, nine guarded selections and three independent/GPU frames. WebGL/fullscreen and optional MOD music; board drawing, gameplay and editor/scores/help routines remain excluded.', run: require('./roller2MenuProbe'), check(result, assert) {
    assert.strictEqual(result.cases,10);assert.strictEqual(result.selections,9);assert.strictEqual(result.gpuFrames,result.gpuUnavailable?0:3);assert.strictEqual(result.guardedTargets,true);assert.strictEqual(result.gameRunning,false);assert.strictEqual(result.connectedStartup,true);assert.strictEqual(result.gameEntryCopies,8);assert.strictEqual(result.levelLoads,4);
  } },
  { id: 'roller2-intro', title: 'Roller II intro, initialization and main-title image', initialFrame: 'Canvas: main title (keyboard, 2840 ms)', description: 'Original intro/input wait/FDZ/FLOAD, highscore and tile-handler initialization, work/icon/sprite banks, then a declared handoff to the tall EHB title load. Keyboard, pointer and injected Gamepad API input pass independent checks. Live WebGL/fullscreen preview; setup 281–286 and menu logic remain excluded.', run: require('./roller2IntroProbe'), check(result, assert) {
    assert.strictEqual(result.inputModes,3);assert.strictEqual(result.frames,13);
    if(result.gpuUnavailable){assert.strictEqual(result.gpuFrames,0);assert.strictEqual(typeof result.gpuUnavailable,'string');}else assert.strictEqual(result.gpuFrames,11);
    assert.deepStrictEqual(result.fullBitmap,[320,512]);assert.deepStrictEqual(result.viewport,[320,268]);assert.strictEqual(result.initialized,true);assert.strictEqual(result.declaredMainTitleHandoff,true);assert.strictEqual(result.gameRunning,false);
  } },
  { id: 'roller2-title', title: 'Roller II first image and original FLOAD', initialFrame: 'Canvas: first image (940 ms)', description: 'Unchanged startup through the first FLOAD, original procedure, AMSC placement, hidden palette clone and Fade To. Independent Python image pixels verify seven Canvas/copper states and seven WebGL comparisons. Live fullscreen preview precedes WTIN, the main title and gameplay.', run: require('./roller2TitleProbe'), check(result, assert) {
    assert.strictEqual(result.originalPrefix,18);assert.deepStrictEqual(result.originalProcedure,[63,68]);assert.strictEqual(result.frames,7);
    if(result.gpuUnavailable){assert.strictEqual(result.gpuFrames,0);assert.strictEqual(typeof result.gpuUnavailable,'string');}else assert.strictEqual(result.gpuFrames,7);
    assert.deepStrictEqual(result.origin,[128,42]);assert.deepStrictEqual(result.image,[320,256]);assert.strictEqual(result.paletteCloneRetired,true);assert.strictEqual(result.gameRunning,false);
  } },
  { id: 'roller2-startup', title: 'Roller II original startup', description: 'Unmodified first 17 lines execute Set Stack/Break Off, Dir$, TRUE, original sample/tracker loads and Hide. Step/reset controls inspect the silent field clock; native Canvas checks cover nested Hide/Show. The captured default screen precedes FLOAD; title rendering and gameplay remain open.', run: require('./roller2StartupProbe'), check(result, assert) {
    assert.deepStrictEqual(result, { lines:17, variableBufferBytes:20480, stackEntries:501, directory:'RII:', introMusic:-1, pointerChecks:5, trackerField:6, firstInstrument:4, titleRendered:false });
  } },
  { id: 'tunnel', title: 'Tunnel animation', description: 'Original Tunneltest program with its supplied icon bank and IFF background. Watch the animation, step frames, use fullscreen or choose an IFF background. Independent checks cover 48 frames and all 24 wheel images.', run: require('./tunnelProbe'), check(result, assert) {
    assert.deepStrictEqual(result, { frames: 48, pngs: 5, gpuFrames: 5, icons: 27, originalAssets: true });
  } },
  { id: 'roller2-game', title: 'Play the complete original Roller II program', description: 'Source-corrected game with current supplied assets: original intro/menu, level-1 colours and warp into level 3, bottom-right time bonus and safe edge bump, host Stop/Timer expiry, game-over screen/music, restored score image, menu return and a fresh game. Keyboard/Gamepad, independent image regions, actual WebGL and a live fullscreen/audio host. Editor entry, overlapping windows, tile placement and level testing/return with the animated panel are also checked. Remaining levels, editor file actions and win paths are not yet accepted.', run: require('./roller2GameProbe'), check(result, assert) {
    assert.strictEqual(result.frames, 30); assert.strictEqual(result.gpuFrames, 15); assert.strictEqual(result.independent, 6);
    assert.strictEqual(result.editorFrames, 10); assert.strictEqual(result.editorGpuFrames, 10);
    assert.deepStrictEqual(result.editor, { frames: 10, placedTile: 3, selectedScreen: 1, testedLevel: true, returnedToEditor: true, writes: 0 });
    assert.strictEqual(result.emptyFrames, 0); assert.strictEqual(result.emptyGpuFrames, 0); assert.strictEqual(result.restoredImage, 'iffp/roller hi');
    assert.deepStrictEqual(result.replays, Array.from({ length: 2 }, () => ({ frames: 15, score: 299, level: 3, returnedToMenu: true, freshGame: true, writes: 0 })));
  } },
  { id: 'roller2-music-vm', capturedFrames: false, title: 'Roller II VM end music and volume fade', description: 'Original Music/Mvolume/Music Off statements run standalone with driver-owned VBL wakes. Full first-wrap PAL/NTSC traces, source fade/erase, Stop/Resume and owned browser audio; end-state graphics remain excluded.', run: require('./musicVmProbe'), check(result, assert) {
    assert.deepStrictEqual(result.traces, [3392, 3392, 5731, 5731]); assert.deepStrictEqual(result.fades, [0, 0, 0, 0]);
  } },
  { id: 'roller2-amos-music', capturedFrames: false, title: 'Roller II AMOS Music end tunes', description: 'Direct field-stepped playback of Over.mus and Ywon.mus; independent full-cycle PAL/NTSC traces and 25 native Web Audio instrument comparisons. Separate direct-player foundation; the VM demo adds command/lifecycle integration.', run: require('./amosMusicProbe'), check(result, assert) {
    assert.deepStrictEqual(result.traces, [3392, 3392, 5731, 5731]); assert.strictEqual(result.graphs, 25); assert.ok(result.maxDifference <= 1e-6);
  } },
  { id:'tracker', capturedFrames:false, title:'Play Roller II MOD music', description:'Original bounded load/Led Off/Track Play statements run in a compiled VM, with independent field wakes, Pause/Resume and Stop. All 1,997 notes and ten instrument waveforms pass source-derived/native Web Audio checks. Full-game integration remains open.', run:require('./trackerProbe'), check(result,assert){
    assert.deepStrictEqual(result,{fields:9631,orders:22,rows:1376,notes:1997,nativeComparisons:12,instruments:10,nonzero:true,vmPlayback:true});
  } },
  { id:'roller2', capturedFrames:false, title:'Roller II target and MOD inspector', description:'Original sample/Track Load statements execute with explicit fixture boundaries. A bounded M.K. reader decodes the original module, instruments and effects. The separate music demo runs compiled Track Play; the whole source now compiles, while full-game execution remains open.', run:require('./roller2Probe'), check(result,assert){
    assert.deepStrictEqual(result,{physicalLines:1199,encodings:194,unrecognized:0,wholeCompiled:true,trackerBank:22,moduleBytes:84006,orders:22,patterns:12,instruments:10,playback:false});
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
  { id: 'mouse', title: 'AMOS hardware mouse and original game input', initialFrame: 'Original editor selection fixture', description: 'Hardware-coordinate input, original mouse limits, polling-based Mouse Click and X/Y Mouse assignment. Original Wonderland editor selection and fourteen Roller II joystick mouse steps pass through keyboard and injected Gamepad API input. Includes a live editor button-selection harness; game actions remain excluded.', run: require('./mouseProbe'), check(result, assert) {
    assert.deepStrictEqual(result,{selections:5,lifecycleChecks:5,coordinateModes:2,rollerMouseSteps:14,gameRunning:false});
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
    assert.strictEqual(result.heldChecks,7);assert.strictEqual(result.keyChecks,9);assert.deepStrictEqual(result.repeatScans,[53,53,53]);assert.strictEqual(result.lifecycleChecks,6);
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
  { id: 'bob-test', title: 'BobTest: 64 bouncing Bobs', initialFrame: 'Canvas: BobTest frame 319', description: 'The unchanged BobTest.amos draws and captures its three images, bounces 64 objects for 500 frames, restores the grid and ends after a second key. Live WebGL/Canvas, pause, restart and fullscreen. Configured for 65 Bob slots because the source uses IDs 1–64. Portable circle raster and zero startup random seed/beam; source has no frame wait and is not a native speed benchmark. Checks verify independent image/path/composite expectations and eight actual GPU frames.', run: require('./bobTestProbe'), check(result, assert) {
    assert.deepStrictEqual(result, { images:3, objects:64, movementFrames:500, positionChecks:32064, frames:8, gpuFrames:8, restored:true, ended:true });
  } },
  { id:'planet-zybex-game',title:'Planet Zybex — full game',initialFrame:'Canvas: PAL keyboard First field',description:'The complete current source (three vertical docking copy corrections, upstream preserved) and all seven supplied level banks. Keyboard and injected Gamepad replays cover movement, real firing, five natural life losses, four life restarts, GAME OVER and a fresh game in PAL/NTSC. A second frozen input route completes both docking sequences and enters level 3 with all five lives. Independent world/score regions and complete GAME OVER, 152 GPU comparisons and two native Web Audio sample comparisons. Stop/Resume, sound/fullscreen and shared application controls. Level-3 completion, later levels and native Amiga capture remain open.',run:require('./planetZybexGameProbe'),check(result,assert){
    assert.deepStrictEqual(result,{runs:8,frames:6480,deaths:[4,3,2,1,0],restarts:4,freshLives:5,stopResume:true,independentRegions:188,gpuFrames:152,audioComparisons:2,progressionRuns:4,verticalFrames:1944,thirdFrames:40});
  } },
  { id: 'planet-zybex', title: 'Planet Zybex: background and score preview', initialFrame: 'Canvas: Level 1 at 0,0', description: 'First milestone toward a playable Planet Zybex showcase. The seven original packed level banks decode through the original Load/Unpack statements; 35 scrolled windows match independent pixels and actual WebGL output. The original score updates also run in a declared fixture: the hires strip and lowres playfield match four independent frames and GPU output. The original Default/Screen Close/Close Editor startup prefix also runs through declared key guards, with two GPU frames and owned display clearing. The original 48-line Sprite-buffer allocation now executes; ten extra Canvas/GPU frames check real direct-sprite buffer reuse, clearing and redraw. Original GAME OVER Text passes now run with transparent Gr Writing; six PAL/NTSC Canvas/GPU comparisons cover the outline, opaque comparison and restoration. Original enemy/player/bullet Channel loops now expose the native routing table without creating or moving objects. The entire original source now compiles and runs a bounded 40-field input replay per standard through movement, real bullet launch and the first explosion. The original Bob 21 AMAL program runs with manual Synchro/Update: 28 independent PAL/NTSC frames and ten GPU comparisons. The original missile Autotest/Direct/For/Next program now runs too: 324 independent PAL/NTSC frames include two real mask collisions per prepared-bullet case and twenty GPU comparisons. Three original hunters now share the native AMAL Z stream: 324 independent PAL/NTSC frames and twenty GPU comparisons cover zero/default and controlled beam inputs. Computed/wide Sprite packing adds 34 independent PAL/NTSC Canvas/GPU comparisons covering all thirteen ship images, row reuse, contention and mouse reservation. J0/J1 and independent Anim lanes add 178 independent PAL/NTSC ship input/animation/explosion frames and 24 GPU comparisons. Eight more GPU frames cover the bounded full source. The live ship fixture accepts keyboard and Gamepad input; longer gameplay, audio verification and a full launcher remain open.', run: require('./planetZybexProbe'), check(result, assert) {
    assert.deepStrictEqual(result, { registersVerified: true, levels: 7, windows: 35, scoreFrames: 4, startupFrames: 2, clearedDisplays: 2, spriteBufferFrames: 10, gameOverFrames: 6, channelStages: 3, channelBindings: 192, amalFrames: 28, missileFrames: 324, missileHits: 4, huntersFrames: 324, computedSpriteFrames: 34, shipFrames: 178, fullGameFrames: 80, gpuFrames: 174, fullGameCompiled: true, runtimeGate: null, previewOnly: true });
  } },
  { id: 'screen-slide', title: 'Roller II intro: sliding screen windows', initialFrame: 'Canvas: RolIntrIdee2.Bak PAL slide 50', description: 'Both unchanged RolIntrIdee2 sources slide cropped screens from above and below the display. All 200 PAL/NTSC movement frames match independent ILBM and raster-crop expectations, with 28 actual GPU comparisons, pointer checks and Stop/Resume. Includes live playback with optional original sample sound; no native capture is claimed.', run: require('./screenSlideProbe'), check(result, assert) {
    assert.deepStrictEqual(result, { frames: 200, gpuFrames: 28, pointerChecks: 28, plays: 4, paused: true, bothSourcesEnded: true });
  } },
  { id: 'open-port', title: 'Open Port: original printer programs', capturedFrames: false, description: 'Run three unchanged Introideen printer programs through an explicit parallel-output capture. All 5,661 bytes match independently transcribed expectations, including escape codes, tabs and high characters. Download raw .prn files and inspect their hexadecimal bytes. No printer driver or physical printing is emulated.', run: require('./openPortProbe'), check(result, assert) {
    assert.deepStrictEqual(result, { programs: 3, lengths: [2409, 178, 3074], totalBytes: 5661, downloads: 3, allClosed: true });
  } },
  { id: 'anim5', title: 'ANIM-5 and the original Logoanim intro', initialFrame: 'Canvas: Logoanim.amos sphere 18', description: 'All twenty asset frames match independent Python history/bitplane expectations. Both unchanged Logoanim sources load/play eighteen frames through ordinary bank addresses and swaps, continue their logo-copy sequence and finish through mouse input. Includes Stop/Resume and actual GPU comparisons; no native Amiga capture is claimed.', run: require('./anim5Probe'), check(result, assert) {
    assert.deepStrictEqual(result, { assetFrames: 20, sourceFrames: 36, independentPixels: 1280000, gpuFrames: 16, paused: true, bothSourcesEnded: true });
  } },
  { id: 'polygon', title: 'Polygon: sphere animation generator', initialFrame: 'Canvas: Saved df1:kugel017', description: 'Solid polygons with independently checked interiors/boundaries, plus the unchanged backup sphere generator. All eight exported IFFs match their rendered pixels and are downloadable below. The portable raster profile is documented; native AreaEnd edge parity remains unverified.', run: require('./polygonProbe'), check(result, assert) {
    assert.deepStrictEqual(result, { matrixFrames: 12, matrixPixels: 2304, savedFrames: 8, savedPixels: 512000, gpuFrames: 12, downloads: 8, sourceUnchanged: true });
  } },
  { id: 'save-iff', title: 'Save Iff: render, save and download a sphere', initialFrame: 'Canvas: Reloaded rollerball IFF', description: 'The unchanged KugelanimBerech program renders its sphere and saves rollerball after a real Canvas key event. An independent decoder checks all saved pixels; a separate Load Iff preview and two actual GPU comparisons verify presentation. Download the generated IFF from the Debug menu below. Session files are volatile.', run: require('./saveIffProbe'), check(result, assert) {
    assert.deepStrictEqual(result, { writes: 1, filename: 'rollerball', comparedPixels: 128000, gpuFrames: 2, downloadExact: true, reloaded: true, sourceUnchanged: true });
  } },
  { id: 'zoom', title: 'Roller II intro idea: Zoom animation', initialFrame: 'Canvas: Original intro frame 29', description: 'The unchanged 49-line RollerIIIntroIdee program and its supplied R.abk asset. Sixteen generated icons and all 29 animation frames match independent Python expectations; four Canvas/GPU frames are compared. Select captured frames to inspect the original animation.', run: require('./zoomProbe'), check(result, assert) {
    assert.deepStrictEqual(result, { frames: 29, icons: 17, iconPixels: 4352, canvasPixels: 256000, gpuFrames: 4, ended: true, sourceUnchanged: true });
  } },
  { id: 'sqr', title: 'Sqr and the original Kugel shading program', initialFrame: 'Canvas: Original Kugel — stopped at negative colour', description: 'Exact FFP square roots, independently checked grayscale tiles and the unchanged Kugel sphere program. The original source stops when its shading expression produces colour -1; the retained partial sphere is not a completed rendering. Two actual GPU/CPU comparisons.', run: require('./sqrProbe'), check(result, assert) {
    assert.strictEqual(result.gpuFrames, 2); assert.strictEqual(result.independentPixels, 4096);
    assert.strictEqual(result.error, 'Invalid colour index at line 14, byte 520');
    assert.strictEqual(result.ticks, 240132); assert.strictEqual(result.partialSphere, true);
    assert.strictEqual(result.gameRunning, false);
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
