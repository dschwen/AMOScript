/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const createDisplay = require('../lib/amos/display');
const createFont = require('../lib/amos/font');
const { token: t, integer: n, text, binary, execute, compile } = require('./helpers/program');

test('display: default screen and independent screen palettes and cursors', () => {
  const display = createDisplay();
  assert.strictEqual(display.screen().width, 320);
  assert.strictEqual(display.screen().height, 200);
  assert.strictEqual(display.screen().colours, 16);
  display.locate(2, 3);
  display.open(1, 32, 16, 4, 0);
  display.setColour(2, 0xf00);
  display.select(0);
  assert.strictEqual(display.screen().x, 2);
  assert.strictEqual(display.screen().y, 3);
  assert.strictEqual(display.info('Colour Value', 2), 0xfff);
  display.close(1);
  assert.throws(() => display.select(1), /not open/);
});

test('display: indexed drawing, palette conversion, clipping, and graphics cursor', () => {
  const display = createDisplay();
  display.open(0, 16, 16, 4, 0);
  display.clear(0);
  display.setColour(3, 0xf84);
  display.ink(3);
  display.draw(-2147483648, 0, 2147483647, 0);
  for (let x = 0; x < 16; x++) assert.strictEqual(display.point(x, 0), 3);
  display.bar(2, 2, 4, 4);
  assert.strictEqual(display.point(3, 3), 3);
  assert.strictEqual(display.point(5, 5), 0);
  display.ink(2);
  display.box(6, 6, 9, 9);
  assert.strictEqual(display.point(6, 6), 2);
  assert.strictEqual(display.point(7, 7), 0);
  assert.strictEqual(display.point(-1, 0), -1);
  assert.strictEqual(display.screen().gx, 9);
  assert.deepStrictEqual(Array.from(display.rgba().slice(0, 4)), [255, 136, 68, 255]);
});

test('display: rasterized characters share the graphics pixel buffer', () => {
  const display = createDisplay();
  display.open(0, 16, 16, 4, 0);
  display.clear(0);
  display.paper(0);
  display.pen(2);
  display.write('A');
  const font = createFont();
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    assert.strictEqual(display.point(x, y), font[65 * 8 + y] & (1 << x) ? 2 : 0);
  }
  assert.strictEqual(display.screen().x, 1);
  display.locate(0, 1);
  display.write('B\n');
  assert.strictEqual(display.screen().y, 1);
  assert.strictEqual(display.point(0, 0), font[66 * 8] & 1 ? 2 : 0);
});

test('display: invalid screens, colours, cursors and modes fail explicitly', () => {
  const display = createDisplay();
  assert.throws(() => display.open(8, 320, 200, 16, 0), /screen number/);
  assert.throws(() => display.open(1, 0, 200, 16, 0), /dimensions/);
  assert.throws(() => display.open(1, 320, 200, 4096, 0), /Unsupported screen colour/);
  assert.throws(() => display.open(1, 320, 200, 16, 1), /resolution/);
  assert.throws(() => display.setColour(32, 0xfff), /colour index/);
  assert.throws(() => display.setColour(0, 0x1000), /12-bit/);
  assert.throws(() => display.locate(40, 0), /cursor out of bounds/);
  assert.throws(() => display.draw(-1e308, 0, 1e308, 0), /safe integer/);
  display.open(1, 16, 1, 2, 0);
  display.plot(1, 0, 1);
  assert.strictEqual(display.point(1, 0), 1);
  assert.throws(() => display.write('A'), /too small for text/);
});

test('display: AMOS drawing tokens lower into exact indexed pixels and query functions', () => {
  const result = execute(binary([
    [t('Screen Open'), n(1), t(','), n(128), t(','), n(64), t(','), n(4), t(','), t('Lowres')],
    [t('Cls Colour'), n(0)], [t('Colour'), n(3), t(','), n(0xf00)], [t('Ink'), n(3)],
    [t('Bar'), n(1), t(','), n(40), t('To'), n(3), t(','), n(42)],
    [t('Print'), t('Point'), t('('), n(2), t(','), n(41), t(')'), t(','), t('Colour Value'), t('('), n(3), t(')'), t(','), t('Screen Width'), t(','), t('Screen Height'), t(','), t('Screen Number')]
  ]));
  assert.deepStrictEqual(result.logs, [[3, 0xf00, 128, 64, 1]]);
  assert.strictEqual(result.program.display.point(2, 41), 3);
});

test('display: omitted coordinates, persistent Plot colour, Locate and Set Tab', () => {
  const result = execute(binary([
    [t('Gr Locate'), n(10), t(','), n(20)], [t('Plot Colour'), t(','), n(21), t(','), n(3)],
    [t('Draw To'), n(12), t(','), n(21)], [t('Locate'), n(2), t(','), n(1)],
    [t('Set Tab'), n(8)], [t('Print'), text('A'), t(','), text('B'), t(';')]
  ]));
  assert.strictEqual(result.program.display.point(10, 21), 3);
  assert.strictEqual(result.program.display.point(12, 21), 3);
  assert.strictEqual(result.program.display.screen().x, 9);
  assert.strictEqual(result.program.display.screen().y, 1);
});

test('display: keyboard queue, Clear Key, and mouse queries share injected input state', () => {
  const data = binary([
    [t('Put Key'), text('ab')], [t('Print'), t('Inkey$'), t(','), t('Inkey$')],
    [t('Put Key'), text('c')], [t('Clear Key')],
    [t('Print'), t('Inkey$'), t(','), t('X Mouse'), t(','), t('Y Mouse'), t(','), t('Mouse Key')]
  ]);
  const logs = [];
  const program = compile(data).create({ setTimeout() {}, print: (...args) => logs.push(args) });
  program.setMouse(12, 34, 3);
  program.tick(100);
  assert.deepStrictEqual(logs, [['a', 'b'], ['', 12, 34, 3]]);
});
