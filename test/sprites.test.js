/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Transpiler = require('../lib/Transpiler');
const { binary, token: t, word: w, integer: n, text, execute } = require('./helpers/program');
const golden = Buffer.from(fs.readFileSync(path.join(__dirname, 'fixtures/image-banks.hex'), 'utf8').replace(/\s/g, ''), 'hex');
const withBanks = lines => Buffer.concat([binary(lines), golden.subarray(20)]);
const palette = [[t('Cls Colour'), n(0)], ...[[17, 0xf00], [18, 0x0f0], [19, 0x00f], [21, 0xff0]].map(([index, rgb]) => [t('Colour'), n(index), t(','), n(rgb)])];
const sprite = (id, x = 139, y = 59, image = n(1)) => [t('Sprite'), n(id), t(','), x == null ? [] : n(x), t(','), y == null ? [] : n(y), t(','), image];
const query = (name, value) => [t(name), t('('), n(value), t(')')];
const pixel = (display, x, y) => Array.from(display.rgba().slice((y * display.screen().width + x) * 4, (y * display.screen().width + x) * 4 + 4));
const red = [255, 0, 0, 255], black = [0, 0, 0, 255], yellow = [255, 255, 0, 255];

test('sprites: direct sprites compose in hardware coordinates without changing indexed pixels', () => {
  const { program, logs } = execute(withBanks([...palette, sprite(1),
    [t('Print'), query('X Sprite', 1), t(','), query('Y Sprite', 1), t(','), query('I Sprite', 1)]]));
  assert.deepStrictEqual(logs, [[139, 59, 1]]);
  assert.deepStrictEqual(pixel(program.display, 10, 10), red);
  assert.deepStrictEqual(pixel(program.display, 11, 10), [0, 255, 0, 255]);
  assert.deepStrictEqual(pixel(program.display, 12, 10), [0, 0, 255, 255]);
  assert.strictEqual(program.display.point(10, 10), 0);
  assert.strictEqual(program.display.screen().physicalPixels[10 * 320 + 10], 0);
});

test('sprites: manual updates freeze presentation while queries track pending state', () => {
  const source = withBanks([...palette, [t('Sprite Update Off')], sprite(1), [t('Wait Key')],
    [t('Sprite Update')], [t('Wait Key')], sprite(1, 149, null, []), [t('Wait Key')], [t('Sprite Update On')]]);
  const { program, timers } = execute(source);
  const resume = () => { program.sendKey('x'); timers.runAll(); };
  assert.deepStrictEqual(pixel(program.display, 10, 10), black);
  assert.strictEqual(program.spriteInfo('X Sprite', 1), 139);
  resume(); assert.deepStrictEqual(pixel(program.display, 10, 10), red);
  resume();
  assert.strictEqual(program.spriteInfo('X Sprite', 1), 149);
  assert.deepStrictEqual(pixel(program.display, 10, 10), red);
  assert.deepStrictEqual(pixel(program.display, 20, 10), black);
  resume();
  assert.deepStrictEqual(pixel(program.display, 10, 10), black);
  assert.deepStrictEqual(pixel(program.display, 20, 10), red);
  assert.strictEqual(program.state.halted, true);
  assert.strictEqual(timers.pending(), 0);
});

test('sprites: hardware number and playfield priority select pixels from the correct register group', () => {
  const { program } = execute(withBanks([...palette, sprite(2), sprite(1)]));
  assert.deepStrictEqual(pixel(program.display, 10, 10), red);
  program.spriteOff(1); program.updateSprites();
  assert.deepStrictEqual(pixel(program.display, 10, 10), yellow);
  assert.strictEqual(program.spriteInfo('X Sprite', 1), 139);
  assert.strictEqual(program.spriteInfo('I Sprite', 1), 0);
  program.display.setColour(1, 0xfff); program.display.plot(10, 10, 1); program.spritePriority(1);
  assert.deepStrictEqual(pixel(program.display, 10, 10), [255, 255, 255, 255]);
  program.display.plot(10, 10, 0);
  assert.deepStrictEqual(pixel(program.display, 10, 10), yellow);
  program.spriteOff(); program.updateSprites();
  assert.deepStrictEqual(pixel(program.display, 10, 10), black);
});

test('sprites: direct image flags, transparent zero and mouse reservation follow separate hardware rules', () => {
  const hrev = [t('Hrev'), t('('), n(1), t(')')];
  const { program, logs } = execute(withBanks([...palette, [t('No Mask Image'), n(1)], sprite(1, 139, 59, hrev),
    sprite(0, 159, 59), [t('Print'), query('I Sprite', 1)]]));
  assert.deepStrictEqual(logs, [[-32767]]);
  assert.deepStrictEqual(pixel(program.display, 10, 10), red);
  assert.deepStrictEqual(pixel(program.display, 13, 10), black);
  assert.deepStrictEqual(pixel(program.display, 30, 10), black);
  program.hideOn();
  assert.deepStrictEqual(pixel(program.display, 30, 10), red);
  program.showOn();
  assert.deepStrictEqual(pixel(program.display, 30, 10), black);
});

test('sprites: low/high-resolution coordinate functions retain word arithmetic and scale hardware pixels', () => {
  const lines = [...palette, [t('Print'), query('X Hard', 10), t(','), query('Y Hard', 10), t(','), query('X Screen', 138), t(','), query('Y Screen', 60)],
    [t('Screen Open'), n(1), t(','), n(64), t(','), n(32), t(','), n(16), t(','), t('Hires')], ...palette,
    [t('Print'), query('X Hard', -1), t(','), query('X Screen', 127), t(','),
      t('X Hard Of'), t('('), n(0), t(','), n(10), t(')')], sprite(1, 133, 59)];
  const { program, logs } = execute(withBanks(lines));
  assert.deepStrictEqual(logs, [[138, 60, 10, 10], [127, -2, 138]]);
  assert.deepStrictEqual(pixel(program.display, 8, 10), red);
  assert.deepStrictEqual(pixel(program.display, 9, 10), red);
  assert.deepStrictEqual(pixel(program.display, 10, 10), [0, 255, 0, 255]);
  assert.strictEqual(program.display.coordinate('X Hard', 65535), 127);
});

test('sprites: bank removal clears presentation, reload retargets state and factory state is isolated', () => {
  const { program } = execute(withBanks([...palette, sprite(1)]));
  program.eraseBank(1); program.updateSprites();
  assert.deepStrictEqual(pixel(program.display, 10, 10), black);
  assert.strictEqual(program.spriteInfo('I Sprite', 1), 1);
  const other = execute(withBanks([...palette])).program;
  assert.strictEqual(other.spriteInfo('I Sprite', 1), 0);
  assert.deepStrictEqual(pixel(other.display, 10, 10), black);
  program.banks.set(1, other.banks.get(1)); program.updateSprites();
  assert.deepStrictEqual(pixel(program.display, 10, 10), red);
});

test('sprites: original bytes, omitted zero coordinates and unsupported allocation forms have diagnostics', () => {
  const raw = withBanks([...palette, [w(0x1a94), n(1), t(','), n(139), t(','), n(59), t(','), n(1)],
    [t('Print'), w(0x20d2), t('('), n(1), t(')')], [w(0x19b0), n(1)],
    [t('Print'), w(0x23ec), t('('), n(1), t(')')]]);
  assert.deepStrictEqual(execute(raw).logs, [[139], [0]]);
  assert.throws(() => execute(withBanks([sprite(1, null, null)])), /Missing Sprite coordinate/);
  assert.throws(() => execute(withBanks([sprite(1, 0), sprite(1, null)])), /Missing Sprite coordinate/);
  assert.throws(() => execute(withBanks([sprite(8)])), /Computed Sprite allocation is not implemented/);
  assert.throws(() => execute(withBanks([sprite(64)])), /Invalid Sprite number/);
  assert.throws(() => execute(withBanks([[t('Sprite Priority'), n(5)]])), /Invalid Sprite priority/);
  assert.throws(() => new Transpiler(binary([[t('Sprite'), text('1'), t(','), n(139), t(','), n(59), t(','), n(1)]])), /Expected numeric expression/);
  const { program } = execute(withBanks([]));
  const image = program.banks.get(1).images[0];
  image.width = 32; image.pixels = new Uint8Array(64);
  program.setSprite(1, 139, 59, 1);
  assert.throws(() => program.updateSprites(), /Attached or wide hardware Sprites are not implemented/);
});
