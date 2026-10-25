/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { binary, token: t, word: w, integer: n, text, identifier: id, dword, execute, compile } = require('./helpers/program');
const { decodePng } = require('./helpers/displayPng');
const directory = path.join(__dirname, '../examples/Roller2'), names = Object.keys(require('../examples/Roller2/manifest.json').files);
const raw = fs.readFileSync(path.join(directory, 'iffp/roller titel'));
const golden = decodePng(fs.readFileSync(path.join(__dirname, 'fixtures/roller2/roller-title.png')));
const indices = fs.readFileSync(path.join(__dirname, 'fixtures/roller2/roller-title.indices'));
const evidence = require('./fixtures/roller2/roller-title.json');
const files = { isDirectory: n => n === 'RII:', read(n) {
  const name = names.find(name => name.toLowerCase() === n.replace(/^rii:/i, '').toLowerCase());
  if (!name) throw new Error(`Unexpected file: ${n}`); return fs.readFileSync(path.join(directory, name), 'latin1');
} };
function start() {
  const clock = require('./helpers/fakeTimers').createFakeTimers(4), p = compile(require('./helpers/roller2Intro')()).create({ files,
    now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout }); p.tick(1000); return { p, clock };
}

test('Roller2 intro: original WTIN exits on keyboard, mouse edge or joystick fire and original FDZ reaches the main-title load', () => {
  for (const mode of ['keyboard', 'mouse', 'joystick']) {
    const { p, clock: c } = start(); c.tick(1000);
    assert.strictEqual(p.state.waiting, null); assert.strictEqual(p.state.frames.length, 1); assert.strictEqual(p.display.screen().height, 256);
    if (mode === 'keyboard') p.sendKey(' '); else if (mode === 'mouse') p.setMouse(10, 10, 1); else p.setJoystick(1, 16);
    c.tick(4); assert.strictEqual(p.state.waiting, 'sleep'); assert.strictEqual(p.state.fade.active, true);
    c.tick(860); assert.ok(p.display.screen().palette.every(rgb => rgb === 0));
    c.tick(40); assert.strictEqual(p.display.screen().height, 512); assert.strictEqual(p.mouseVisible(), true);
    c.tick(940); assert.strictEqual(p.state.waiting, 'key'); assert.strictEqual(p.state.frames.length, 0);
    assert.strictEqual(p.state.fade.active, false); assert.strictEqual(p.display.screens.has(7), false); assert.strictEqual(p.state.tracker.playing, true);
    p.stop(); assert.strictEqual(c.pending(), 0);
  }
});

test('Roller2 main title: full independent EHB bitmap stays intact behind native-default bounded PAL viewport and scrolling', () => {
  assert.strictEqual(crypto.createHash('sha256').update(raw).digest('hex'), evidence.sourceSha256);
  assert.strictEqual(crypto.createHash('sha256').update(indices).digest('hex'), evidence.indicesSha256);
  assert.strictEqual(crypto.createHash('sha256').update(golden.rgba).digest('hex'), evidence.rgbaSha256);
  const { p, clock: c } = start(); c.tick(1000); p.sendKey(' '); c.tick(924);
  const target = p.display.screen(), pixels = Buffer.from(target.physicalPixels);
  assert.deepStrictEqual([target.width, target.height, target.windowHeight, target.hardwareY, target.colours], [320, 512, 268, 42, 64]);
  assert.deepStrictEqual(pixels, indices);
  for (const at of [1924, 1940, 2360, 2780, 2840]) {
    c.tick(at - c.now()); const step = at < 1940 ? 0 : Math.min(15, Math.floor((at - 1940) / 60) + 1), frame = p.display.canvasFrame();
    assert.deepStrictEqual([frame.width, frame.height], [320, 268]);
    for (let i = 0; i < 320 * 268; i++) for (let channel = 0; channel < 4; channel++) {
      const limit = indices[i] >= 32 ? step >> 1 : step;
      const value = channel === 3 ? 255 : Math.min(limit, golden.rgba[i * 4 + channel] / 17) * 17;
      assert.strictEqual(frame.rgba[i * 4 + channel], value, `title at ${at}, pixel ${i}, channel ${channel}`);
    }
  }
  p.display.screenOffset(0, 0, 240); const frame = p.display.canvasFrame();
  assert.deepStrictEqual(Buffer.from(frame.rgba), Buffer.from(golden.rgba.subarray(320 * 240 * 4, 320 * 508 * 4)));
  assert.deepStrictEqual(Buffer.from(target.physicalPixels), pixels); assert.strictEqual(p.display.snapshotPlayfield().frame.lines, 512); p.stop();
});

test('explicit Fade: sparse and negative entries preserve registers, integers mask to RGB12 and values evaluate once', () => {
  let reads = 0; const files = { exists: () => { reads++; return false; } };
  const { program: p, timers: c } = execute(binary([[t('Colour'), n(0), t(','), n(0xf31)], [t('Colour'), n(1), t(','), n(0x1f3)],
    [t('Colour'), n(2), t(','), n(0x777)], [t('Fade'), n(2), t(','), n(-1), t(','), n(0x1f31), t(','), t('Exist'), t('('), text('unused'), t(')')], [t('Wait Key')]]), 100, { files });
  assert.strictEqual(reads, 1); c.tick(20); assert.strictEqual(p.display.screen().palette[0], 0xf31);
  assert.strictEqual(p.display.screen().palette[1], 0x2e2); assert.strictEqual(p.display.screen().palette[2], 0x666);
  c.tick(600); assert.strictEqual(reads, 1); assert.strictEqual(p.display.screen().palette[1], 0xf31); assert.strictEqual(p.display.screen().palette[2], 0); p.stop();
});

test('explicit Fade: typed DATA, arrays, procedure integers and dynamic Val integers share palette rules', () => {
  const { program: p, timers: c } = execute(binary([[t('Data'), w(0), n(0x123)], [t('Read'), id('goal')],
    [t('Dim'), id('a'), t('('), n(0), t(')')], [id('a'), t('('), n(0), t(')'), t('='), id('goal')],
    [t('Procedure'), dword(0), w(0), 0, 0, id('goal')], [t('End Proc'), t('['), n(0x456), t(']')], [id('goal', 0x12)],
    [t('Fade'), n(1), t(','), id('a'), t('('), n(0), t(')'), t(','), t('Param'), t(','), t('Val'), t('('), text('1929'), t(')')], [t('Wait Key')]]));
  c.tick(320); assert.deepStrictEqual(Array.from(p.display.screen().palette.slice(0, 3)), [0x123, 0x456, 0x789]); p.stop();
});

test('explicit Fade: invalid float/string/oversized lists reject and dynamic float failure preserves a current fade', () => {
  for (const value of [text('0'), [w(0x46), dword(0xc0000041)]]) assert.throws(() => compile(binary([[t('Fade'), n(1), t(','), value]])), /integer values/);
  assert.throws(() => compile(binary([[t('Fade'), n(1), ...Array.from({ length: 33 }, () => [t(','), n(0)])]])), /at most 32/);
  const { program: p } = execute(binary([[t('Wait Key')]])); p.fade(2); const before = p.state.fade;
  assert.throws(() => p.fadeColours(2, [{ value: p.val('1.5'), type: 'dynamic' }]), /integer values/);
  assert.strictEqual(p.state.fade, before); p.stop();
  assert.throws(() => execute(binary([[t('Fade'), n(1), t(','), t('Val'), t('('), text('1.5'), t(')')]])), /integer values.*line 1/);
});

test('tall Load Iff: NTSC uses its own field end while ordinary 256-row images retain established placement', () => {
  const { program: p } = execute(binary([[t('Load Iff Screen'), text('title'), t(','), n(0)]]), 100,
    { displayOptions: { snapshotStandard: 'NTSC' }, files: { read: () => raw.toString('latin1') } });
  assert.deepStrictEqual([p.display.screen().height, p.display.screen().hardwareY, p.display.screen().windowHeight], [512, 42, 218]);
  assert.strictEqual(p.display.snapshotDisplay().frame.lines, 218); p.stop();
  for (const [name, width, height] of [['Title_Screen.Iff',320,256], ['Landscape.Iff',960,288]]) {
    const bytes = fs.readFileSync(path.join(__dirname, '../examples/Wonderland', name), 'latin1');
    const old = execute(binary([[t('Load Iff Screen'), text('image'), t(','), n(0)]]), 100, { files: { read: () => bytes } }).program;
    assert.deepStrictEqual([old.display.screen().width,old.display.screen().height,old.display.screen().hardwareY,old.display.screen().windowed],[width,height,50,false]); old.stop();
  }
});
