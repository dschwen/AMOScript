/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { token: t, integer: n, word, text, binary, execute, compile } = require('./helpers/program');
const golden = Buffer.from(fs.readFileSync(path.join(__dirname, 'fixtures/image-banks.hex'), 'utf8').replace(/\s/g, ''), 'hex');
const withBanks = lines => Buffer.concat([binary(lines), golden.subarray(20)]);
const setup = [
  [t('Screen Open'), n(0), t(','), n(64), t(','), n(64), t(','), n(4), t(','), t('Lowres')],
  [t('Cls Colour'), n(3)], [t('Hot Spot'), n(1), t(','), n(0), t(','), n(0)], [t('Bob Update Off')]
];
const mode = (id, background, planes = null, minterm = null) => [t('Set Bob'), n(id), t(','), background == null ? [] : n(background), t(','), planes == null ? [] : n(planes), t(','), minterm == null ? [] : n(minterm)];
const bob = (id, x, y) => [t('Bob'), n(id), t(','), n(x), t(','), n(y), t(','), n(1)];

test('bob modes: background zero restores, positive clears word-aligned areas, negative leaves trails', () => {
  for (const background of [0, 2, -1]) {
    const { program } = execute(withBanks([...setup, mode(0, background), bob(0, 1, 2), [t('Bob Update')]]));
    assert.strictEqual(program.display.point(1, 2), 1);
    program.setBob(0, 32, 2, null); program.updateBobs();
    assert.strictEqual(program.display.point(1, 2), background === 0 ? 3 : 1);
    assert.strictEqual(program.display.point(0, 2), background === 2 ? 1 : 3);
    assert.strictEqual(program.display.point(31, 2), background === 2 ? 1 : 3);
    program.bobOff(); program.updateBobs();
    assert.strictEqual(program.display.point(32, 2), background === 0 ? 3 : 1);
  }
  for (const reverse of [false, true]) {
    const { program } = execute(withBanks([
      ...setup, mode(0, 2), bob(0, 0, 0), bob(1, 1, 0),
      ...(reverse ? [[t('Priority Reverse On')]] : []), [t('Bob Update')]
    ]));
    program.bobOff(); program.updateBobs();
    // Bob 1's normal snapshot was captured before Bob 0 drew. Its higher
    // number restores the original background after Bob 0's colour fill.
    assert.deepStrictEqual(Array.from(program.display.screen().pixels), Array(64 * 64).fill(3));
  }
});

test('bob modes: selected planes control drawing and restoration without erasing other-plane changes', () => {
  const { program } = execute(withBanks([...setup, mode(0, 0, 1), bob(0, 0, 0), [t('Bob Update')]]));
  assert.deepStrictEqual([0, 1, 2, 3].map(x => program.display.point(x, 0)), [3, 2, 3, 3]);
  program.display.plot(1, 0, 0);
  program.setBob(0, 32, 0, null); program.updateBobs();
  assert.strictEqual(program.display.point(1, 0), 1);
  const fill = execute(withBanks([...setup, mode(0, 1, 1), bob(0, 0, 0), [t('Bob Update')]])).program;
  fill.bobOff(); fill.updateBobs();
  assert.strictEqual(fill.display.point(0, 0), 2);
  const none = execute(withBanks([...setup, mode(0, 2, 0, 255), bob(0, 0, 0), [t('Bob Update')]])).program;
  none.bobOff(); none.updateBobs();
  assert.deepStrictEqual(Array.from(none.display.screen().pixels), Array(64 * 64).fill(3));
});

test('bob modes: blitter minterms implement copy, XOR, OR, AND, inversion and mask truth functions', () => {
  const cases = [
    [0, [1, 2, 3, 2]], [0xcc, [1, 2, 3, 0]], [0x66, [3, 0, 1, 2]],
    [0xee, [3, 2, 3, 2]], [0xe2, [3, 2, 3, 2]], [0x88, [0, 2, 2, 0]], [0x33, [2, 1, 0, 3]],
    [0xaa, [2, 2, 2, 2]], [0xf0, [3, 3, 3, 0]], [0x0f, [0, 0, 0, 3]], [0xff, [3, 3, 3, 3]]
  ];
  for (const [minterm, expected] of cases) {
    const { program } = execute(withBanks([...setup, [t('Cls Colour'), n(2)], mode(0, 0, null, minterm), bob(0, 0, 0), [t('Bob Update')]]));
    assert.deepStrictEqual([0, 1, 2, 3].map(x => program.display.point(x, 0)), expected, `minterm ${minterm.toString(16)}`);
  }
  const opaque = execute(withBanks([...setup, mode(0, 0, null, 0xca), [t('No Mask Image'), n(1)], bob(0, 0, 0), [t('Bob Update')]])).program;
  assert.deepStrictEqual([0, 1, 2, 3].map(x => opaque.display.point(x, 0)), [1, 2, 3, 0]);
});

test('bob modes: configuration is installed on creation and Bob movements retain it', () => {
  const { program } = execute(withBanks([
    ...setup, mode(0, -1, 1, 0x66), bob(0, 0, 0),
    mode(0, 2, 3, 0xcc), [t('Bob Update')]
  ]));
  assert.strictEqual(program.bobs.get(0).background, -1);
  assert.strictEqual(program.bobs.get(0).planes, 1);
  assert.strictEqual(program.bobs.get(0).minterm, 0x66);
  assert.strictEqual(program.display.point(0, 0), 2);
  program.setBob(0, 32, 0, null); program.updateBobs();
  assert.strictEqual(program.display.point(0, 0), 2);
  program.bobOff(); program.updateBobs();
  program.configureBob(0, null, null, null);
  assert.strictEqual(program.bobs.get(0).background, 0);
  assert.strictEqual(program.bobs.get(0).planes, 0xffff);
});

test('bob limits: numbered, all-current-screen and reset forms clip pixels without moving coordinates', () => {
  const { program } = execute(withBanks([
    ...setup, [t('Cls Colour'), n(0)], bob(0, 15, 10),
    [t('Limit Bob Area'), n(0), t(','), n(17), t(','), n(10), t('To'), n(47), t(','), n(20)], [t('Bob Update')]
  ]));
  assert.deepStrictEqual({ ...program.bobs.get(0).limit }, { left: 16, top: 10, right: 32, bottom: 20 });
  assert.strictEqual(program.bobInfo('X Bob', 0), 15);
  assert.strictEqual(program.display.point(15, 10), 0);
  assert.strictEqual(program.display.point(16, 10), 2);
  program.setBob(0, 31, 10, null); program.updateBobs();
  assert.strictEqual(program.display.point(31, 10), 1);
  assert.strictEqual(program.display.point(32, 10), 0);
  program.resetBobLimits(); program.updateBobs();
  assert.strictEqual(program.display.point(32, 10), 2);
  program.limitBobs(16, 0, 48, 32);
  program.setBob(1, 15, 14, 1); program.updateBobs();
  assert.strictEqual(program.display.point(15, 14), 1); // A new Bob does not inherit old limits.
  program.limitBobs(16, 0, 48, 32); program.updateBobs();
  assert.strictEqual(program.display.point(15, 14), 0);
  program.display.open(1, 64, 64, 4, 0);
  program.setBob(2, 0, 0, 1); program.limitBobs(0, 4, 32, 32);
  assert.strictEqual(program.bobs.get(0).limit.left, 16);
  assert.strictEqual(program.bobs.get(2).limit.top, 4);
});

test('bob limits: source-derived bottom/left guard, empty rectangles and absent-Bob calls are explicit', () => {
  const { program } = execute(withBanks(setup));
  program.limitBobs(32, 0, 64, 16); // Original BobLim returns early for an empty list.
  program.setBob(0, 0, 10, 1);
  assert.throws(() => program.limitBobs(32, 0, 64, 16), /Invalid Bob limit rectangle/);
  program.limitBobs(0, 30, 32, 20); // Original guard does not compare top with bottom.
  program.updateBobs();
  assert.deepStrictEqual(Array.from(program.display.screen().pixels), Array(64 * 64).fill(3));
  assert.throws(() => program.limitBob(0, 0, 0, 100, 32), /Invalid Bob limit/);
});

test('bob modes: solid and no-erase backgrounds retain independent histories across screen buffers', () => {
  for (const background of [0, 2, -1]) {
    const { program } = execute(withBanks([...setup, [t('Double Buffer')], [t('Autoback'), n(0)], mode(0, background)]));
    const target = program.display.screen();
    const first = target.physicalPixels, second = target.pixels;
    program.setBob(0, 1, 2, 1); program.updateBobs();
    program.setBob(0, 33, 2, null); program.updateBobs();
    program.setBob(0, 49, 2, null); program.updateBobs();
    program.bobOff(); program.updateBobs(); program.updateBobs();
    assert.strictEqual(first[2 * 64 + 33], background === 0 ? 3 : 1);
    assert.strictEqual(second[2 * 64 + 1], background === 0 ? 3 : 1);
    assert.strictEqual(first[2 * 64 + 1], 3);
    assert.strictEqual(second[2 * 64 + 49], background === 0 ? 3 : 1);
  }
});

test('bob modes: original opcodes, omissions, type checks and source-located errors', () => {
  const { program } = execute(withBanks([
    ...setup, [word(0x1b8a), n(0), t(','), t(','), t(',')], bob(0, 15, 10),
    [word(0x1b6c), n(16), t(','), n(0), t('To'), n(48), t(','), n(32)],
    [word(0x1b7a), n(0), t(','), n(0), t(','), n(0), t('To'), n(32), t(','), n(32)],
    [word(0x1b5c)], [t('Bob Update')]
  ]));
  assert.strictEqual(program.display.point(15, 10), 1);
  assert.throws(() => execute(withBanks([...setup, mode(64, 0)])), /Invalid Bob number at line/);
  assert.throws(() => execute(withBanks([...setup, bob(0, 0, 0), [t('Limit Bobs Area'), n(0), t(','), n(0), t('To'), n(0), t(','), n(32)]])), /Invalid Bob limit rectangle at line/);
  assert.throws(() => compile(withBanks([[t('Set Bob'), n(0), t(','), text('bad'), t(','), t(',')]])), /Expected numeric/);
});
