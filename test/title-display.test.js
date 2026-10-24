/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const createDisplay = require('../lib/amos/display');
const { binary, token: t, integer: n, word: w, text, identifier: id, execute, compile } = require('./helpers/program');
const { createFakeTimers } = require('./helpers/fakeTimers');
const { decodePng } = require('./helpers/displayPng');
const root = path.join(__dirname, '..');
const fixture = name => fs.readFileSync(path.join(root, 'test/fixtures/display', name)).toString('latin1');
const call = (name, args) => [t(name), t('('), ...args.flatMap((arg, i) => i ? [t(','), arg] : [arg]), t(')')];
const hooks = () => { const timers = createFakeTimers(); return { now: timers.now, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout }; };

test('rainbow: original tokens reserve independent tables and Rain reads/writes integer colour words', () => {
  const lines = [[w(0xd90), n(1), t(','), n(14), t(','), n(16), t(','), text(''), t(','), text(''), t(','), text('')],
    [w(0xdf0), t('('), n(1), t(','), n(0), t(')'), t('='), n(0x1f35)],
    [t('Dim'), id('a'), t('('), n(1), t(')')], [t('Data'), w(0), n(1)], [t('Read'), id('slot')],
    [id('a'), t('('), n(1), t(')'), t('='), call('Rain', [id('slot'), n(0)])],
    [t('Procedure'), [0,0,0,0], w(0), 0, 0, id('readrain')], [t('End Proc'), t('['), call('Rain', [n(1), n(0)]), t(']')],
    [id('readrain', 0x12)], [t('Print'), id('a'), t('('), n(1), t(')'), t(','), t('Param')]];
  const result = execute(binary(lines)); assert.deepStrictEqual(result.logs, [[0xf35, 0xf35]]);
  const { create } = compile(binary([[t('Wait Key')]])), a = create(hooks()), b = create(hooks());
  a.display.setRainbow(1, 14, 16, '', '', ''); a.display.setRain(1, 0, 0xfff);
  assert.throws(() => b.display.rainColour(1, 0), /out of bounds/);
});

test('rainbow: active row palettes agree in Canvas RGBA and copper across PAL line 256 and restore after the range', () => {
  const display = createDisplay(); display.open(0, 320, 256, 16, 0); display.clear(14); display.setColour(14, 0x135);
  display.setRainbow(1, 14, 16, '', '', '');
  for (let y = 0; y < 16; y++) display.setRain(1, y, y * 0x111);
  display.rainbow(1, 3, 250, 10);
  const canvas = display.rgba(), copper = display.renderDisplay();
  for (let y = 0; y < 256; y++) {
    const rgb = y >= 200 && y < 210 ? ((3 + y - 200) % 16) * 0x111 : 0x135;
    const expected = [(rgb >> 8) * 17, ((rgb >> 4) & 15) * 17, (rgb & 15) * 17, 255];
    assert.deepStrictEqual(Array.from(canvas.slice(y * 320 * 4, y * 320 * 4 + 4)), expected);
    assert.deepStrictEqual(Array.from(copper.slice(y * 640 * 4, y * 640 * 4 + 8)), [...expected, ...expected]);
  }
  const snapshot = display.snapshotDisplay(); display.setRain(1, 3, 0xf00);
  assert.notDeepStrictEqual(snapshot.frame.linePal, display.snapshotDisplay().frame.linePal);
});

test('rainbow: lower-numbered overlap wins; unsupported patterns, indices and NTSC presentation reject', () => {
  const d = createDisplay(); d.clear(1); d.setRainbow(1, 1, 16, '', '', '', 0xf00);
  d.setRainbow(0, 2, 16, '', '', '', 0x0f0); d.rainbow(1, 0, 50, 4); d.rainbow(0, 0, 50, 2);
  assert.deepStrictEqual(Array.from(d.rgba().slice(0, 4)), [255, 136, 0, 255]);
  assert.deepStrictEqual(Array.from(d.rgba().slice(2 * 320 * 4, 2 * 320 * 4 + 4)), [255, 0, 0, 255]);
  assert.deepStrictEqual(Array.from(d.renderDisplay().slice(0, 4)), [255, 136, 0, 255]);
  assert.deepStrictEqual(Array.from(d.renderDisplay().slice(2 * 640 * 4, 2 * 640 * 4 + 4)), [255, 0, 0, 255]);
  for (const action of [() => d.setRainbow(4, 1, 16, '', '', ''), () => d.setRainbow(1, 16, 16, '', '', ''),
    () => d.setRainbow(1, 1, 15, '', '', ''), () => d.setRainbow(1, 1, 16, '(1,1,1)', '', ''),
    () => d.setRain(1, 16, 0), () => d.rainbow(3, 0, 50, 1)]) assert.throws(action);
  const ntsc = createDisplay({ snapshotStandard: 'NTSC' }); ntsc.setRainbow(1, 1, 16, '', '', '');
  assert.throws(() => ntsc.rainbow(1, 0, 50, 1), /NTSC/);
  ntsc.rainbow(1, 0, 0, 0);
});

test('Load Iff: original images populate indexed screens and palette without affecting other factories', () => {
  const { create } = compile(binary([[w(0x17e4), text('image'), t(','), n(2)], [w(0x1446)]]));
  const bytes = fs.readFileSync(path.join(root, 'examples/Wonderland/Title_Screen.Iff')).toString('latin1');
  const a = create({ ...hooks(), files: { read: () => bytes } }), b = create({ ...hooks(), files: { read: () => bytes } });
  a.tick(100); assert.strictEqual(a.display.current, 2); assert.strictEqual(b.display.current, 0);
  assert.deepStrictEqual([a.display.screen().width, a.display.screen().height, a.display.screen().cursorVisible], [320, 256, false]);
  const golden = decodePng(fs.readFileSync(path.join(root, 'test/fixtures/wonderland/Title_Screen.Iff.png')));
  assert.deepStrictEqual(Buffer.from(a.display.renderDisplay()), Buffer.from(golden.rgba));
});

test('Load Iff: current-screen form writes only logical planes, keeps higher planes and crops height', () => {
  const result = execute(binary([[t('Screen Open'), n(0), t(','), n(64), t(','), n(2), t(','), n(16), t(','), t('Lowres')],
    [t('Cls Colour'), n(12)], [t('Double Buffer')], [w(0x17d4), text('image')]]), 100,
  { files: { read: () => fixture('ilbm-4-raw.ilbm') } });
  const target = result.program.display.screen();
  assert.ok(target.pixels.slice(0, 33).some(value => value !== 12));
  assert.ok(target.pixels.every(value => (value & 12) === 12));
  assert.ok(target.physicalPixels.every(value => value === 12));
  assert.throws(() => execute(binary([[t('Load Iff'), text('missing')]])), /files host.*at line 1/);
  assert.throws(() => execute(binary([[t('Load Iff'), text('bad')]]), 100, { files: { read: () => ({ then() {} }) } }), /synchronously.*at line 1/);
  assert.throws(() => execute(binary([[t('Load Iff Screen'), text('lace'), t(','), n(0)]]), 100,
    { files: { read: () => fixture('laced-hires-raw.ilbm') } }), /interlace.*at line 1/);
  const raw = Buffer.from(fixture('ilbm-4-raw.ilbm'), 'latin1');
  const chunk = Buffer.from('414d53430000000e' + '00'.repeat(14), 'hex');
  const amsc = Buffer.concat([raw.subarray(0, 12), chunk, raw.subarray(12)]); amsc.writeUInt32BE(amsc.length - 8, 4);
  assert.throws(() => execute(binary([[t('Load Iff'), text('amos')]]), 100,
    { files: { read: () => amsc.toString('latin1') } }), /AMSC placement.*at line 1/);
  const hires = Buffer.concat([raw.subarray(0, 70), raw.subarray(82)]);
  hires.writeUInt32BE(hires.length - 8, 4); hires.writeUInt16BE(640, 36);
  const loaded = execute(binary([[t('Load Iff Screen'), text('hires'), t(','), n(1)]]), 100,
    { files: { read: () => hires.toString('latin1') } }).program.display.screen();
  assert.strictEqual(loaded.mode, 0x8000); assert.strictEqual(loaded.width, 48);
  assert.strictEqual(loaded.palette[4], 0xf00);
});

test('Auto View: replacement screens are staged while physical output stays on the previous buffer', () => {
  const d = createDisplay(); d.clear(2); const old = d.presentedScreen();
  d.autoViewOff(); d.open(0, 320, 256, 16, 0); d.clear(4);
  assert.strictEqual(d.presentedScreen(), old); assert.strictEqual(d.screen().height, 256);
  assert.deepStrictEqual(Array.from(d.renderDisplay().slice(0, 4)), [255,255,255,255]);
  d.view(); assert.strictEqual(d.autoView, false); assert.strictEqual(d.presentedScreen(), d.screen());
  assert.deepStrictEqual(Array.from(d.renderDisplay().slice(0, 4)), [255,0,0,255]);
  d.open(1, 320, 200, 16, 0); d.clear(5); d.autoViewOn();
  assert.strictEqual(d.presentedScreen(), d.screen(1)); assert.strictEqual(d.autoView, true);
});

test('Wonderland: original title setup renders the source-derived title/Bob golden after Wait Vbl', () => {
  const { create } = compile(require('./helpers/wonderlandStartup')(64, true)), timers = createFakeTimers();
  const p = create({ now: timers.now, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
    files: { read: filename => fs.readFileSync(path.join(root, 'examples/Wonderland', filename.split('/').pop())).toString('latin1') } });
  p.tick(100000); assert.strictEqual(p.state.waiting, 'sleep'); assert.strictEqual(p.state.halted, false);
  timers.tick(20); assert.strictEqual(p.state.halted, true);
  const manifest = require('./fixtures/wonderland/manifest.json'), bytes = fs.readFileSync(path.join(root, 'test/fixtures/wonderland/title-setup.png'));
  assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), manifest.titleSetup.sha256);
  assert.deepStrictEqual(Buffer.from(p.display.renderDisplay()), Buffer.from(decodePng(bytes).rgba));
  assert.strictEqual(p.display.autoView, true); assert.strictEqual(p.display.screen().cursorVisible, false);
});
