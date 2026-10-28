'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const createDisplay = require('../lib/amos/display'), oracle = require('./fixtures/screen-slide.json');
const { createFakeTimers } = require('./helpers/fakeTimers');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

test('signed screen windows: native top crop retains logical placement, offsets and staged identities', () => {
  const d = createDisplay(); d.open(0, 320, 200, 16, 0); const s = d.screen();
  for (let y = 0; y < 200; y++) s.pixels.fill(y % 16, y * 320, (y + 1) * 320);
  d.screenDisplay(0, 128, -12, 320, 80); d.screenOffset(0, 0, 3);
  const snap = d.snapshotDisplay(), frame = d.canvasFrame(); assert.deepStrictEqual([snap.frame.origin.y, frame.height], [26, 42]);
  const rgb = s.palette[41 % 16]; assert.deepStrictEqual(Array.from(frame.rgba.slice(0, 4)), [(rgb >> 8) * 17, (rgb >> 4 & 15) * 17, (rgb & 15) * 17, 255]);
  assert.deepStrictEqual(d.pointerPosition(0, 0, 320, 42), [0, 41]); assert.deepStrictEqual(d.pointerHardwarePosition(0, 0, 320, 42), [128, 26]);
  const pixels = s.pixels, regs = snap.frame.lineRegs.slice(); d.autoViewOff(); d.screenDisplay(0, null, 30); assert.strictEqual(d.canvasFrame().height, 42);
  d.view(); assert.strictEqual(d.canvasFrame().height, 80); assert.strictEqual(s.pixels, pixels); assert.deepStrictEqual(snap.frame.lineRegs, regs);
});

test('signed screen windows: early endings stop DMA instead of wrapping DIW into later bitmap rows', () => {
  for (const standard of ['PAL', 'NTSC']) {
    const d = createDisplay({ snapshotStandard: standard }); d.open(0, 320, 40, 16, 0); d.clear(4); d.screenDisplay(0, 128, -8, 320, 39);
    const first = d.snapshotDisplay(); assert.deepStrictEqual([first.frame.origin.y, first.frame.lines], [26, 5]);
    d.open(1, 320, 40, 16, 0); d.clear(3); d.screenDisplay(1, 128, 150, 320, 39);
    const frame = d.canvasFrame(); assert.strictEqual(frame.height, 163);
    for (let y = 0; y < frame.height; y++) {
      const colour = y < 5 ? 4 : y >= 124 ? 3 : 0, rgb = d.screen().palette[colour];
      assert.deepStrictEqual(Array.from(frame.rgba.slice(y * 320 * 4, y * 320 * 4 + 4)), [(rgb >> 8) * 17, (rgb >> 4 & 15) * 17, (rgb & 15) * 17, 255]);
    }
  }
});

test('signed screen windows: clipped priority slices preserve setup blank rows and resumed source rows', () => {
  const d = createDisplay(); d.open(0, 320, 100, 16, 0);
  for (let y = 0; y < 100; y++) d.screen().pixels.fill(y % 16, y * 320, (y + 1) * 320);
  d.screenDisplay(0, 128, -10, 320, 100);
  d.open(1, 320, 40, 16, 0); d.clear(3); d.screenDisplay(1, 128, 40, 320, 40); d.screenToFront(1);
  const frame = d.canvasFrame(); assert.strictEqual(frame.height, 64);
  for (let y = 26; y < 90; y++) {
    const colour = y === 39 || y === 80 ? 0 : y >= 40 && y < 80 ? 3 : (y + 10) % 16, rgb = d.screen().palette[colour];
    assert.deepStrictEqual(Array.from(frame.rgba.slice((y - 26) * 320 * 4, (y - 26) * 320 * 4 + 4)), [(rgb >> 8) * 17, (rgb >> 4 & 15) * 17, (rgb & 15) * 17, 255]);
  }
});

test('signed screen windows: parked upper windows have no fetch, while wrapped coordinates and invalid bitmap ranges reject', () => {
  const d = createDisplay(); d.open(0, 320, 40, 16, 0); d.clear(4); d.screenDisplay(0, 128, -76, 320, 39);
  assert.ok(d.canvasFrame().rgba.every((value, i) => value === (i % 4 === 3 ? 255 : 0)));
  const s = d.screen(); for (const y of [-4096, -32768, 28672, 32768, 65535]) assert.throws(() => d.screenDisplay(0, 128, y), /vertical placement/);
  assert.strictEqual(s.hardwareY, -76); d.screenOffset(0, 0, 39); assert.throws(() => d.snapshotDisplay(), /outside physical bitmap/);
});

test('RolIntrIdee2: unchanged sources match independent ILBM/crop pixels for every PAL/NTSC movement frame', () => {
  const input = require('./helpers/screenSlideFixture')();
  for (const [name, expected] of Object.entries(oracle.hashes)) assert.strictEqual(hash(fs.readFileSync(path.join(__dirname, '../examples/Introideen', name))), expected);
  for (const standard of ['PAL', 'NTSC']) for (const [name, source] of Object.entries(input.sources)) {
    const clock = createFakeTimers(), module = { exports: {} }, events = []; new Function('module', source)(module);
    const p = module.exports({ displayOptions: { snapshotStandard: standard }, now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
      audio: { command: event => events.push(event) }, files: { read: name => Buffer.from(input.assets[name.toLowerCase()], 'base64').toString('latin1') } });
    try {
      p.tick(10000); assert.strictEqual(hash(p.display.screen(0).pixels), oracle.bitmapSha256);
      assert.strictEqual(hash(p.display.screen(1).pixels), oracle.bitmaps[name][0]); assert.strictEqual(hash(p.display.screen(2).pixels), oracle.bitmaps[name][1]);
      for (const expected of oracle.frames.filter(frame => frame.standard === standard && frame.name === name)) {
        const frame = p.display.canvasFrame(); assert.strictEqual(frame.height, expected.height);
        assert.strictEqual(hash(frame.rgba), expected.sha256, `${name} ${standard} step ${expected.step}`); clock.tick(20);
      }
      clock.tick(20); assert.strictEqual(p.state.waiting, 'key'); p.sendKey('x'); p.tick(1000); assert.strictEqual(p.state.halted, true);
      assert.strictEqual(events.filter(event => event.type === 'play').length, name.endsWith('.Bak') ? 0 : 2);
    } finally { p.stop(); }
  }
});

test('RolIntrIdee2: Stop/Resume retains a partial slide without advancing its screen windows', () => {
  const input = require('./helpers/screenSlideFixture')(), clock = createFakeTimers(), module = { exports: {} }; new Function('module', input.sources['RolIntrIdee2.amos'])(module);
  const p = module.exports({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    files: { read: name => Buffer.from(input.assets[name.toLowerCase()], 'base64').toString('latin1') } });
  p.tick(10000); clock.tick(360); const frame = hash(p.display.canvasFrame().rgba); p.stop(); clock.tick(1000); assert.strictEqual(hash(p.display.canvasFrame().rgba), frame);
  p.resume(); clock.tick(20); assert.notStrictEqual(hash(p.display.canvasFrame().rgba), frame); p.stop();
});
