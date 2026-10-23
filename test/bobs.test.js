/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { token: t, integer: n, word, text, binary, execute, compile } = require('./helpers/program');
const golden = Buffer.from(fs.readFileSync(path.join(__dirname, 'fixtures/image-banks.hex'), 'utf8').replace(/\s/g, ''), 'hex');
const withBanks = lines => Buffer.concat([binary(lines), golden.subarray(20)]);
const screen = id => [t('Screen Open'), n(id), t(','), n(64), t(','), n(32), t(','), n(4), t(','), t('Lowres')];
const setup = [screen(0), [t('Cls Colour'), n(3)], [t('Hot Spot'), n(1), t(','), n(0), t(','), n(0)], [t('Bob Update Off')]];
const bob = (id, x, y, image = n(1)) => [t('Bob'), n(id), t(','), x == null ? [] : n(x), t(','), y == null ? [] : n(y), t(','), image];

test('bobs: explicit updates move screen pixels, restore background, and remove objects after a key wait', () => {
  const { program, timers } = execute(withBanks([
    ...setup, bob(0, 1, 1), [t('Bob Update')], [t('Wait Vbl')],
    bob(0, 10, null, []), [t('Bob Update')], [t('Wait Key')],
    [t('Bob Off Number'), n(0)], [t('Bob Update')]
  ]));
  assert.strictEqual(program.display.point(1, 1), 1);
  assert.strictEqual(program.display.point(2, 1), 2);
  assert.strictEqual(program.state.waiting, 'sleep');
  timers.tick(20);
  assert.strictEqual(program.display.point(1, 1), 3);
  assert.strictEqual(program.display.point(10, 1), 1);
  assert.strictEqual(program.bobInfo('Y Bob', 0), 1);
  assert.strictEqual(program.state.waiting, 'key');
  program.sendKey('x'); timers.runAll();
  assert.strictEqual(program.bobs.size, 0);
  assert.strictEqual(program.display.point(10, 1), 3);
  assert.strictEqual(program.state.halted, true);
  assert.strictEqual(timers.pending(), 0);
});

test('bobs: backgrounds are saved before overlapping objects draw, with higher numbers in front', () => {
  const { program } = execute(withBanks([...setup, bob(0, 0, 0), bob(1, 1, 0), [t('Bob Update')]]));
  assert.deepStrictEqual([0, 1, 2].map(x => program.display.point(x, 0)), [1, 1, 2]);
  program.bobOff(1); program.updateBobs();
  assert.deepStrictEqual([0, 1, 2].map(x => program.display.point(x, 0)), [1, 2, 3]);
  program.bobOff(); program.updateBobs();
  assert.deepStrictEqual(Array.from(program.display.screen().pixels), Array(64 * 32).fill(3));
  program.setBob(0, -1, -1, 1); program.updateBobs();
  assert.strictEqual(program.display.point(0, 0), 1);
  program.setBob(0, 30000, 30000, null); program.updateBobs();
  assert.deepStrictEqual(Array.from(program.display.screen().pixels), Array(64 * 32).fill(3));
  const other = compile(withBanks([])).create({ setTimeout() {} });
  assert.strictEqual(other.bobs.size, 0);
  assert.notStrictEqual(other.bobs, program.bobs);
});

test('bobs: Bob Clear/Draw preserve manual background changes and work only on the current screen', () => {
  const { program } = execute(withBanks([...setup, bob(0, 0, 0), screen(1), [t('Cls Colour'), n(2)], bob(1, 0, 0), [t('Bob Update')]]));
  program.bobClear();
  assert.strictEqual(program.display.point(0, 0), 2);
  program.display.plot(0, 0, 3);
  program.bobDraw();
  assert.strictEqual(program.display.point(0, 0), 1);
  program.bobClear();
  assert.strictEqual(program.display.point(0, 0), 3);
  program.display.select(0);
  assert.strictEqual(program.display.point(0, 0), 1);
  program.bobClear();
  assert.strictEqual(program.display.point(0, 0), 3);
});

test('bobs: hotspots, flipping, image zero and omitted parameters affect positioning without trails', () => {
  const { program, logs } = execute(withBanks([
    ...setup, [t('Hot Spot Preset'), n(1), t(','), n(0x11)],
    bob(3, 8, 4), [t('Bob Update')],
    [t('Print'), t('X Bob'), t('('), n(3), t(')'), t(','), t('Y Bob'), t('('), n(3), t(')'), t(','), t('I Bob'), t('('), n(3), t(')')]
  ]));
  assert.deepStrictEqual(logs, [[8, 4, 1]]);
  assert.strictEqual(program.banks.get(1).images[0].hotspotX, 8);
  assert.strictEqual(program.banks.get(1).images[0].hotspotY, 1);
  // Avoid Print's pixels when checking restoration: draw onto another screen.
  program.display.open(1, 64, 32, 4, 0); program.display.clear(3);
  program.bobOff(3); program.updateBobs();
  program.hotSpot(1, 0, 0);
  program.setBob(3, 20, 4, 0x8001); program.updateBobs();
  assert.strictEqual(program.display.point(19, 4), 1);
  assert.strictEqual(program.bobInfo('I Bob', 3), -32767);
  program.setBob(3, null, null, 0); program.updateBobs();
  assert.strictEqual(program.display.point(19, 4), 3);
  assert.strictEqual(program.bobInfo('X Bob', 3), 20);
  program.setBob(3, 65537, -65537, null);
  assert.strictEqual(program.bobInfo('X Bob', 3), 1);
  assert.strictEqual(program.bobInfo('Y Bob', 3), -1);
});

test('bobs: automatic updates flush on yields, pause with execution, and remain disabled when requested', () => {
  const { program, timers } = execute(withBanks([
    screen(0), [t('Cls Colour'), n(3)], [t('Hot Spot'), n(1), t(','), n(0), t(','), n(0)],
    bob(0, 0, 0), [t('Wait Vbl')], bob(0, 10, 0), [t('Wait Key')]
  ]));
  assert.strictEqual(program.display.point(0, 0), 1);
  program.stop(); timers.tick(100);
  assert.strictEqual(program.display.point(10, 0), 3);
  program.resume(); timers.tick(20);
  assert.strictEqual(program.display.point(0, 0), 3);
  assert.strictEqual(program.display.point(10, 0), 1);
  assert.strictEqual(program.state.waiting, 'key');
  program.stop();
  const manual = execute(withBanks([...setup, bob(0, 0, 0), [t('Wait Vbl')], [t('Bob Update On')], [t('Wait Key')]]));
  assert.strictEqual(manual.program.display.point(0, 0), 3);
  manual.timers.tick(20);
  assert.strictEqual(manual.program.display.point(0, 0), 1);
  manual.program.stop();
});

test('bobs: creation binds the screen, and closing/reopening releases objects and saved backgrounds', () => {
  const { program } = execute(withBanks([...setup, bob(0, 0, 0), screen(1), [t('Cls Colour'), n(2)], bob(0, 10, 0), [t('Bob Update')]]));
  assert.strictEqual(program.display.point(10, 0), 2);
  assert.strictEqual(program.bobs.get(0).screen.id, 0);
  program.display.select(0);
  assert.strictEqual(program.display.point(10, 0), 1);
  program.display.open(0, 64, 32, 4, 0);
  assert.strictEqual(program.bobs.size, 0);
  program.display.clear(2); program.updateBobs();
  assert.strictEqual(program.display.point(10, 0), 2);
  program.setBob(1, 0, 0, 1); program.updateBobs(); program.display.close(0);
  assert.strictEqual(program.bobs.size, 0);
  assert.throws(() => program.bobInfo('X Bob', 1), /not defined/);
});

test('bobs: Y/X priorities and reverse ordering change overlapping pixels', () => {
  const { program } = execute(withBanks([...setup, bob(0, 1, 0), bob(1, 0, 0), [t('Bob Update')]]));
  assert.strictEqual(program.display.point(1, 0), 2);
  program.priorityOn(); program.updateBobs();
  assert.strictEqual(program.display.point(1, 0), 1);
  program.priorityReverseOn(); program.updateBobs();
  assert.strictEqual(program.display.point(1, 0), 2);
  program.priorityOff(); program.priorityReverseOff(); program.updateBobs();
  assert.strictEqual(program.display.point(1, 0), 2);
});

test('bobs: independent opcode coverage, type errors and missing-object diagnostics', () => {
  const { program } = execute(withBanks([
    ...setup, [word(0x1b9e), n(0), t(','), n(0), t(','), n(0), t(','), n(1)],
    [word(0x1ae6)], [word(0x1dae)], [word(0x23fc)], [word(0x2416)], [word(0x1dc0)],
    [word(0x1ab6), n(0)], [word(0x1ae6)]
  ]));
  assert.strictEqual(program.bobs.size, 0);
  assert.throws(() => execute(withBanks([...setup, bob(64, 0, 0)])), /Invalid Bob number at line/);
  assert.throws(() => execute(withBanks([...setup, bob(0, 0, 0, n(2))])), /missing or empty.*at line/);
  assert.throws(() => execute(withBanks([[t('Print'), t('X Bob'), t('('), n(0), t(')')]])), /not defined at line 1/);
  assert.throws(() => compile(withBanks([[t('Bob'), text('bad'), t(','), n(0), t(','), n(0), t(','), n(1)]])), /Expected numeric/);
});
