/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const createDisplay = require('../lib/amos/display');
const { token: t, integer: n, word, text, binary, execute } = require('./helpers/program');
const golden = Buffer.from(fs.readFileSync(path.join(__dirname, 'fixtures/image-banks.hex'), 'utf8').replace(/\s/g, ''), 'hex');
const withBanks = lines => Buffer.concat([binary(lines), golden.subarray(20)]);
const setup = [
  [t('Screen Open'), n(0), t(','), n(64), t(','), n(32), t(','), n(4), t(','), t('Lowres')],
  [t('Cls Colour'), n(3)], [t('Hot Spot'), n(1), t(','), n(0), t(','), n(0)],
  [t('Bob Update Off')], [t('Double Buffer')]
];
const physical = (display, x, y) => display.screen().physicalPixels[y * display.screen().width + x];

test('buffers: Double Buffer clones pixels; Point reads logical while RGBA presents physical', () => {
  const display = createDisplay();
  display.clear(0);
  assert.strictEqual(display.screen().pixels, display.screen().physicalPixels);
  display.doubleBuffer();
  assert.notStrictEqual(display.screen().pixels, display.screen().physicalPixels);
  assert.strictEqual(display.screen().autoback, 2);
  display.autoback(0);
  display.plot(0, 0, 2);
  assert.strictEqual(display.point(0, 0), 2);
  assert.strictEqual(physical(display, 0, 0), 0);
  assert.deepStrictEqual(Array.from(display.rgba().slice(0, 4)), [0, 0, 0, 255]);
  display.swap(0);
  assert.strictEqual(display.point(0, 0), 0);
  assert.strictEqual(physical(display, 0, 0), 2);
  assert.deepStrictEqual(Array.from(display.rgba().slice(0, 4)), [255, 255, 255, 255]);
  display.swap(0);
  assert.strictEqual(display.point(0, 0), 2);
  assert.throws(() => display.doubleBuffer(), /already double buffered/);
});

test('buffers: Screen Swap selects one screen or all double-buffered screens', () => {
  const display = createDisplay();
  for (const id of [0, 1]) {
    display.open(id, 16, 16, 4, 0); display.clear(0);
    display.doubleBuffer(); display.autoback(0); display.plot(0, 0, id + 1);
  }
  display.swap(0);
  assert.strictEqual(display.screen(0).physicalPixels[0], 1);
  assert.strictEqual(display.screen(1).physicalPixels[0], 0);
  display.swap();
  assert.strictEqual(display.screen(0).physicalPixels[0], 0);
  assert.strictEqual(display.screen(1).physicalPixels[0], 2);
  display.close(1);
  assert.throws(() => display.swap(1), /not open/);
  assert.throws(() => display.autoback(3), /Invalid Autoback/);
});

test('buffers: Autoback duplicates graphics/text while advancing cursors only once', () => {
  for (const mode of [1, 2]) {
    const display = createDisplay();
    display.open(0, 32, 16, 4, 0); display.clear(0); display.paper(0);
    display.doubleBuffer(); display.autoback(mode);
    display.write('A');
    assert.strictEqual(display.screen().x, 1);
    display.plot(1, 10, 3); display.drawTo(4, 10);
    assert.strictEqual(display.screen().gx, 4);
    display.bar(6, 10, 8, 12); display.box(10, 10, 13, 13);
    display.ink(2); display.text(20, 15, 'B');
    assert.deepStrictEqual(display.screen().pixels, display.screen().physicalPixels);
    display.write('\nC\nD'); // Includes scrolling.
    assert.deepStrictEqual(display.screen().pixels, display.screen().physicalPixels);
    const { logs } = execute(binary([[t('Double Buffer')], [t('Autoback'), n(mode)], [t('Print'), text('once')]]));
    assert.deepStrictEqual(logs, [['once']]);
  }
});

test('buffers: each Bob frame keeps its own background through successive swaps and removal', () => {
  const { program } = execute(withBanks([...setup, [t('Autoback'), n(0)]]));
  const display = program.display;
  program.setBob(0, 0, 0, 1); program.updateBobs();
  assert.strictEqual(physical(display, 0, 0), 1);
  assert.strictEqual(display.point(0, 0), 3);
  program.setBob(0, 20, 0, null); program.updateBobs();
  assert.strictEqual(physical(display, 0, 0), 3);
  assert.strictEqual(physical(display, 20, 0), 1);
  assert.strictEqual(display.point(0, 0), 1);
  program.setBob(0, 40, 0, null); program.updateBobs();
  assert.strictEqual(physical(display, 0, 0), 3);
  assert.strictEqual(physical(display, 20, 0), 3);
  assert.strictEqual(physical(display, 40, 0), 1);
  program.bobOff(); program.updateBobs(); program.updateBobs();
  assert.deepStrictEqual(Array.from(display.screen().pixels), Array(64 * 32).fill(3));
  assert.deepStrictEqual(display.screen().pixels, display.screen().physicalPixels);
});

test('buffers: Autoback 2 protects changed graphics beneath Bobs in both saved backgrounds', () => {
  const { program } = execute(withBanks(setup));
  const display = program.display;
  program.setBob(0, 0, 0, 1); program.updateBobs();
  display.plot(0, 0, 2);
  assert.strictEqual(display.point(0, 0), 1);
  assert.strictEqual(physical(display, 0, 0), 1);
  program.setBob(0, 20, 0, null); program.updateBobs(); program.updateBobs();
  assert.strictEqual(display.point(0, 0), 2);
  assert.strictEqual(physical(display, 0, 0), 2);
  program.bobOff(); program.updateBobs(); program.updateBobs();
  assert.strictEqual(display.point(20, 0), 3);
  assert.strictEqual(physical(display, 20, 0), 3);
});

test('buffers: Autoback 1 copies drawing to both buffers without adjusting Bob backgrounds', () => {
  const { program } = execute(withBanks([...setup, [t('Autoback'), n(1)]]));
  const display = program.display;
  program.setBob(0, 0, 0, 1); program.updateBobs(); program.updateBobs();
  display.plot(0, 0, 2); display.plot(50, 10, 2);
  assert.strictEqual(display.point(0, 0), 2);
  assert.strictEqual(physical(display, 0, 0), 2);
  program.setBob(0, 20, 0, null); program.updateBobs(); program.updateBobs();
  assert.strictEqual(display.point(0, 0), 3);
  assert.strictEqual(physical(display, 0, 0), 3);
  assert.strictEqual(display.point(50, 10), 2);
  assert.strictEqual(physical(display, 50, 10), 2);
});

test('buffers: manual Bob Clear/Draw affects logical pixels and Screen Swap presents the result', () => {
  const { program } = execute(withBanks([...setup, [t('Autoback'), n(0)]]));
  const display = program.display;
  program.setBob(0, 0, 0, 1); program.bobDraw();
  assert.strictEqual(display.point(0, 0), 1);
  assert.strictEqual(physical(display, 0, 0), 3);
  display.swap(0);
  program.bobClear(); program.setBob(0, 20, 0, null); program.bobDraw();
  assert.strictEqual(physical(display, 0, 0), 1);
  display.swap(0);
  assert.strictEqual(physical(display, 0, 0), 3);
  assert.strictEqual(physical(display, 20, 0), 1);
  program.bobClear();
  assert.strictEqual(display.point(0, 0), 3);
});

test('buffers: enabling buffering after Bobs preserves both backgrounds and reopening drops stale frames', () => {
  const { program } = execute(withBanks(setup.slice(0, -1)));
  const display = program.display;
  program.setBob(0, 0, 0, 1); program.updateBobs(); program.doubleBuffer();
  assert.strictEqual(display.point(0, 0), 1);
  assert.strictEqual(physical(display, 0, 0), 1);
  program.bobOff(); program.updateBobs(); program.updateBobs();
  assert.strictEqual(display.point(0, 0), 3);
  assert.strictEqual(physical(display, 0, 0), 3);
  display.open(0, 64, 32, 4, 0); display.clear(2); program.updateBobs();
  assert.strictEqual(display.screen().doubleBuffered, false);
  assert.strictEqual(display.screen().pixels, display.screen().physicalPixels);
  assert.strictEqual(display.point(0, 0), 2);
});

test('buffers: raw AMOS buffering opcodes lower and invalid modes report source context', () => {
  const { program } = execute(binary([
    [word(0x12c)], [word(0xe2c), n(0)], [t('Plot Colour'), n(0), t(','), n(0), t(','), n(2)],
    [word(0xaf4), n(0)], [word(0xae2)]
  ]));
  assert.strictEqual(program.display.point(0, 0), 2);
  assert.strictEqual(physical(program.display, 0, 0), 1);
  assert.throws(() => execute(binary([[t('Double Buffer')], [t('Double Buffer')]])), /already double buffered at line 2/);
  assert.throws(() => execute(binary([[t('Autoback'), n(-1)]])), /Invalid Autoback mode at line 1/);
  assert.throws(() => execute(binary([[t('Screen Swap Number'), n(7)]])), /Screen 7 is not open at line 1/);
});

test('buffers: static image commands without moving Bobs do not trigger an automatic swap', () => {
  const { program } = execute(withBanks([
    ...setup.slice(0, 3), [t('Double Buffer')], [t('Autoback'), n(0)],
    [t('Make Mask Image'), n(1)], [t('Priority On')],
    [t('Paste Bob'), n(0), t(','), n(0), t(','), n(1)]
  ]));
  assert.strictEqual(program.bobs.size, 0);
  assert.strictEqual(program.display.point(0, 0), 1);
  assert.strictEqual(physical(program.display, 0, 0), 3);
  program.display.swap(0);
  assert.strictEqual(physical(program.display, 0, 0), 1);
});
