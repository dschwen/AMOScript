/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const Transpiler = require('../lib/Transpiler');
const { binary, token: t, word: w, dword, integer: n, identifier: id, text, execute } = require('./helpers/program');
const ffp = bits => [w(0x46), dword(bits)];
const fn = (name, arg) => [t(name), t('('), arg, t(')')];

test('number functions: Abs and Int preserve the argument numeric type', () => {
  const lines = [
    [t('Print'), fn('Abs', n(-3)), t('/'), n(2), t(','), fn('Abs', ffp(0xe00000c2)), t('/'), n(2)],
    [t('Print'), fn('Int', n(3)), t('/'), n(2), t(','), fn('Int', ffp(0xe0000042)), t('/'), n(2)],
    [t('Print'), fn('Int', ffp(0xe00000c2)), t(','), fn('Int', ffp(0x800000c0))],
    [t('Print'), fn('Int', ffp(0x80000061)), t(','), fn('Abs', ffp(0x800000e1))],
    [t('Print'), fn('Abs', n(-2147483648)), t(','), fn('Int', n(-2147483648))]
  ];
  assert.deepStrictEqual(execute(binary(lines)).logs, [[1, 1.75], [1, 1.5], [-4, -1],
    [4294967296, 4294967296], [-2147483648, -2147483648]]);
});

test('number functions: Sgn returns integer signs for both argument types', () => {
  const values = [n(-3), n(0), n(3), ffp(0xe00000c2), ffp(0), ffp(0xe0000042)];
  const lines = values.flatMap(value => [[t('Print'), fn('Sgn', value)],
    [t('Print'), fn('Sgn', value), t('/'), n(2)]]);
  assert.deepStrictEqual(execute(binary(lines)).logs, [-1, 0, 1, -1, 0, 1].flatMap(sign => [[sign], [0]]));
});

test('number functions: Val tags survive nested Abs and Int and Sgn consumes them', () => {
  const values = ['-3', '-3.5', '3.5', '$80000000'];
  const lines = values.map(value => [t('Print'), fn('Abs', fn('Int', fn('Val', text(value)))), t('/'), n(2),
    t(','), fn('Sgn', fn('Abs', fn('Val', text(value))))]);
  assert.deepStrictEqual(execute(binary(lines)).logs, [[1, 1], [2, 1], [1.5, 1], [-1073741824, -1]]);
});

test('number functions: typed results cross scalar, array, DATA and procedure boundaries', () => {
  const array = [id('a', 6, 0x41), t('('), n(0), t(')')];
  const lines = [[t('Dim'), array], [array, t('='), fn('Int', ffp(0xe0000042))],
    [id('x', 6, 1), t('='), fn('Abs', n(-16777217))],
    [t('Data'), w(0), fn('Int', fn('Val', text('3.5'))), t(','), fn('Sgn', ffp(0xe00000c2))],
    [t('Read'), id('y', 6, 1), t(','), id('z')],
    [t('Procedure'), dword(0), w(0), 0, 0, id('p')],
    [t('End Proc'), t('['), fn('Int', fn('Val', text('3.5'))), t(']')], [id('p', 0x12)],
    [t('Print'), array, t('/'), n(2), t(','), id('x', 6, 1), t(','), id('y', 6, 1), t('/'), n(2),
      t(','), id('z'), t(','), t('Param#'), t('/'), n(2)]];
  const { logs, program, timers } = execute(binary(lines));
  assert.deepStrictEqual(logs, [[1.5, 16777218, 1.5, -1, 1.5]]);
  assert.strictEqual(program.state.halted, true);
  assert.strictEqual(timers.pending(), 0);
});

test('number functions: original token bytes and argument diagnostics are supported', () => {
  const lines = [[t('Print'), w(0x6aa), t('('), n(-3), t(')')],
    [t('Print'), w(0x6a0), t('('), n(-3), t(')')],
    [t('Print'), w(0x6b4), t('('), ffp(0xe00000c2), t(')')]];
  assert.deepStrictEqual(execute(binary(lines)).logs, [[3], [-1], [-4]]);
  for (const name of ['Abs', 'Sgn', 'Int']) {
    assert.throws(() => new Transpiler(binary([[t('Print'), fn(name, text('3'))]])), /Wrong argument type.*line 1/);
    assert.throws(() => new Transpiler(binary([[t('Print'), t(name), t('('), n(1), t(','), n(2), t(')')]])), /line 1/);
  }
});
