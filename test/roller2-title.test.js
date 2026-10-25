/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { binary, token: t, word: w, integer: n, text, execute } = require('./helpers/program');
const createDisplay = require('../lib/amos/display'), readIlbm = require('../lib/display/model/ilbm');
const { decodePng } = require('./helpers/displayPng');
const directory = path.join(__dirname, '../examples/Roller2');
const raw = fs.readFileSync(path.join(directory, 'iffp/terminator el'));
const expected = decodePng(fs.readFileSync(path.join(__dirname, 'fixtures/roller2/terminator-el.png')));
const evidence = require('./fixtures/roller2/terminator-el.json');
const names = Object.keys(require('../examples/Roller2/manifest.json').files);
const files = { isDirectory: name => name === 'RII:', read(name) {
  const source = names.find(entry => entry.toLowerCase() === name.replace(/^rii:/i, '').toLowerCase());
  if (!source) throw new Error(`Unknown original asset: ${name}`);
  return fs.readFileSync(path.join(directory, source), 'latin1');
} };

test('Roller2 first FLOAD: unchanged startup/call/procedure completes its fade against independently decoded image pixels', () => {
  assert.strictEqual(crypto.createHash('sha256').update(raw).digest('hex'), evidence.sourceSha256);
  assert.strictEqual(crypto.createHash('sha256').update(expected.rgba).digest('hex'), evidence.rgbaSha256);
  const { program: p, timers: c } = execute(require('./helpers/roller2Title')(), 1000, { files });
  assert.strictEqual(p.display.presentedScreen(), null); assert.strictEqual(p.state.waiting, 'sleep');
  c.tick(20); const owner = p.display.screen(0), clone = p.display.screen(7), pixels = Buffer.from(owner.pixels), old = p.display.snapshotDisplay();
  assert.strictEqual(owner.pixels, clone.pixels); assert.notStrictEqual(owner.palette, clone.palette);
  assert.strictEqual(p.display.current, 0); assert.strictEqual(clone.hidden, true); assert.strictEqual(owner.hidden, false);
  assert.deepStrictEqual({ ...old.frame.origin }, { x: 128, y: 42 });
  for (const time of [20, 40, 100, 460, 880, 920, 940]) {
    c.tick(time - c.now()); const step = time < 40 ? 0 : Math.min(15, Math.floor((time - 40) / 60) + 1);
    const canvas = p.display.canvasFrame(), copper = p.display.renderDisplay();
    assert.deepStrictEqual([canvas.width, canvas.height], [320, 256]);
    for (let i = 0; i < 320 * 256; i++) for (let channel = 0; channel < 4; channel++) {
      const value = channel === 3 ? 255 : Math.min(step, expected.rgba[i * 4 + channel] / 17) * 17;
      assert.strictEqual(canvas.rgba[i * 4 + channel], value, `Canvas ${time} pixel ${i}, channel ${channel}`);
      assert.strictEqual(copper[i * 8 + channel], value); assert.strictEqual(copper[i * 8 + 4 + channel], value);
    }
    assert.deepStrictEqual(Buffer.from(owner.pixels), pixels);
    if (time === 920) { assert.strictEqual(p.display.screens.has(7), false); assert.strictEqual(p.state.fade.active, true); }
  }
  assert.ok(old.frame.linePal.every((value, i) => i % 4 === 3 ? value === 255 : value === 0));
  assert.strictEqual(p.state.waiting, 'key'); assert.strictEqual(p.state.frames.length, 0); assert.strictEqual(p.state.fade.active, false);
  assert.strictEqual(p.state.tracker.playing, true); p.stop(); assert.strictEqual(c.pending(), 0);
});

test('AMSC: exact metadata is owned; bounded explicit placement validates before replacing a screen, implicit loads retain geometry', () => {
  assert.deepStrictEqual(readIlbm(raw).image.amosScreen, evidence.placement);
  assert.ok(Object.isFrozen(readIlbm(raw).image.amosScreen));
  const chunk = raw.indexOf(Buffer.from('AMSC'));
  const malformed = Buffer.from(raw); malformed.writeUInt32BE(13, chunk + 4);
  assert.throws(() => readIlbm(malformed), /invalid AMSC size/);
  for (const [field, value] of [[0, 160], [1, 100], [2, 160], [3, 128], [4, 1], [5, 1], [6, 1]]) {
    const bytes = Buffer.from(raw); bytes.writeUInt16BE(value, chunk + 8 + field * 2);
    const { program: p } = execute(binary([[t('Wait Key')]]), 100, { files: { read: () => bytes.toString('latin1') } });
    const old = p.display.screen(); assert.throws(() => p.loadIff('bad', 0), /AMSC placement/); assert.strictEqual(p.display.screen(), old); p.stop();
  }
  const { program: p } = execute(binary([[t('Wait Key')]]), 100, { files: { read: () => raw.toString('latin1') } });
  p.display.open(0, 320, 256, 32, 0); p.loadIff('image'); assert.strictEqual(p.display.screen().hardwareY, 50); p.stop();
  const ntsc = execute(binary([[t('Wait Key')]]), 100, { displayOptions: { snapshotStandard: 'NTSC' }, files: { read: () => raw.toString('latin1') } }).program;
  const before = ntsc.display.screen(); assert.throws(() => ntsc.loadIff('image', 0), /AMSC placement/); assert.strictEqual(ntsc.display.screen(), before); ntsc.stop();
});

test('screen visibility: selection, pixels and staged presentation survive Hide/Show independently', () => {
  const d = createDisplay(); d.screenDisplay(0, 128, 50, 320, 200); const screen = d.screen(), pixels = screen.pixels, before = d.snapshotDisplay();
  d.autoViewOff(); d.hideScreen(); assert.strictEqual(d.current, 0); assert.strictEqual(d.presentedScreen(), screen);
  assert.deepStrictEqual(d.snapshotDisplay().frame.lineRegs, before.frame.lineRegs);
  d.view(); assert.strictEqual(d.presentedScreen(), null); assert.throws(() => d.snapshotDisplay(), /at least one screen/);
  assert.strictEqual(d.screen().pixels, pixels); d.showScreen(); assert.strictEqual(d.presentedScreen(), null);
  d.view(); assert.strictEqual(d.presentedScreen(), screen); d.autoViewOn();
  d.open(1, 320, 200, 16, 0); d.hideScreen(1); assert.strictEqual(d.current, 1); assert.strictEqual(d.presentedScreen(), screen);
  d.showScreen(1); assert.strictEqual(d.presentedScreen().id, 1);
});

test('Screen Clone/Get Palette: shared static pixels, independent palettes, unselectable clones and safe owner lifecycle', () => {
  const d = createDisplay(); d.open(0, 320, 200, 32, 0); d.screenDisplay(0, 128, 50, 320, 200); d.hideScreen();
  const owner = d.screen(), clone = d.clone(7); assert.strictEqual(d.current, 0); assert.strictEqual(clone.pixels, owner.pixels);
  assert.strictEqual(clone.physicalPixels, owner.physicalPixels); assert.notStrictEqual(clone.palette, owner.palette);
  clone.palette[31] = 0xf31; owner.palette[31] = 0;
  d.getPalette(d.bufferSelector('Physic', 7), -2147483648); assert.strictEqual(owner.palette[31], 0xf31);
  d.showScreen(7); assert.strictEqual(d.presentedScreen(), clone); d.ink(3); d.plot(1, 1); assert.strictEqual(clone.pixels[321], 3);
  assert.throws(() => d.select(7), /cloned screen/);
  for (const action of [() => d.close(0), () => d.open(0, 320, 200, 16, 0), () => d.doubleBuffer()]) assert.throws(action, /Close screen clones/);
  assert.strictEqual(d.screen(0), owner); d.close(7); assert.strictEqual(owner.pixels[321], 3); d.doubleBuffer();
  assert.throws(() => d.clone(7), /double-buffered/);
});

test('Fade To: source palette is captured, components move both directions and source close does not cancel the job', () => {
  const { program: p, timers: c } = execute(binary([[t('Wait Key')]])); const d = p.display;
  d.open(1, 320, 200, 16, 0); d.setColour(1, 0x1f3); d.select(0); d.setColour(1, 0xf31);
  p.fade(2, 1); d.screen(1).palette[1] = 0; d.close(1); c.tick(20);
  assert.strictEqual(d.screen(0).palette[1], 0xe42); c.tick(520); assert.strictEqual(d.screen(0).palette[1], 0x1f3);
  c.tick(40); assert.strictEqual(p.state.fade.active, false); p.stop();
  assert.throws(() => execute(binary([[w(0xdfe), n(2), t('To'), n(-1)]])), /Unsupported Fade To screen.*line 1/);
});
