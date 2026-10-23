/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const { createMemoryFiles } = require('../lib/amos/files');
const { binary, token: t, word: w, dword, integer: n, identifier: id, text, execute, compile } = require('./helpers/program');
const ffp = bits => [w(0x46), dword(bits)];
const val = value => [t('Val'), t('('), text(value), t(')')];

test('float to integer: truncation and signed saturation follow SPFix boundaries', () => {
  const bits = [0, 0x80000001, 0x80000081, 0xc0000040, 0xc00000c0,
    0xffffff5f, 0x80000060, 0x80000160, 0xffffffdf, 0x800000e0,
    0x800001e0, 0x80000061, 0x800000e1, 0xffffff7f, 0xffffffff];
  const expected = [0, 0, 0, 0, 0, 2147483520, 2147483647, 2147483647,
    -2147483520, -2147483648, -2147483648, 2147483647, -2147483648, 2147483647, -2147483648];
  const lines = bits.flatMap(bits => [[id('x'), t('='), ffp(bits)], [t('Print'), id('x')]]);
  assert.deepStrictEqual(execute(binary(lines)).logs, expected.map(value => [value]));
});

test('float to integer: Val conversions and integer arithmetic keep separate overflow rules', () => {
  const values = ['3.5', '-3.5', '2147483648.0', '-2147483648.0', '1e20', '-1e20'];
  const lines = values.flatMap(value => [[id('x'), t('='), val(value)], [t('Print'), id('x')]]);
  assert.deepStrictEqual(execute(binary(lines)).logs, [[3], [-3], [2147483647], [-2147483648], [2147483647], [-2147483648]]);
  for (const operand of [ffp(0x80000061), val('1e20')]) {
    assert.throws(() => execute(binary([[id('x'), t('='), operand],
      [id('x'), t('='), id('x'), t('+'), n(1)]])), /Integer overflow at line 2/);
  }
});

test('float to integer: bitwise and Mod operands convert identically for static and Val expressions', () => {
  for (const [positive, negative] of [[ffp(0x80000061), ffp(0x800000e1)], [val('1e20'), val('-1e20')]]) {
    const lines = [
      [t('Print'), positive, t('And'), n(255)],
      [t('Print'), positive, t('Xor'), n(2147483647)],
      [t('Print'), negative, t('Or'), n(0)],
      [t('Print'), positive, t('Mod'), n(3)],
      [t('Print'), negative, t('Mod'), n(3)]
    ];
    assert.deepStrictEqual(execute(binary(lines)).logs, [[255], [0], [-2147483648], [1], [2]]);
  }
});

test('float to integer: array, DATA and procedure parameter conversion agree', () => {
  const array = [id('a', 6, 0x40), t('('), n(0), t(')')];
  const lines = [[t('Dim'), array], [array, t('='), ffp(0x80000061)],
    [t('Data'), w(0), ffp(0x800000e1), t(','), val('1e20')],
    [t('Read'), id('x'), t(','), id('y')],
    [t('Procedure'), dword(0), w(0), 0, 0, id('p'), t('['), id('arg'), t(']')],
    [t('End Proc'), t('['), id('arg'), t(']')],
    [id('p', 0x12), t('['), ffp(0x80000061), t(']')],
    [t('Print'), array, t(','), id('x'), t(','), id('y'), t(','), t('Param')],
    [id('p', 0x12), t('['), val('-1e20'), t(']')], [t('Print'), t('Param')]];
  const { logs, program, timers } = execute(binary(lines));
  assert.deepStrictEqual(logs, [[2147483647, -2147483648, 2147483647, 2147483647], [-2147483648]]);
  assert.strictEqual(program.state.halted, true);
  assert.strictEqual(timers.pending(), 0);
});

test('float to integer: sequential numeric input saturates before storage', () => {
  const lines = [[t('Open In'), n(1), t(','), text('numbers')],
    [t('Input#'), n(1), t(','), id('a'), t(','), id('b'), t(','), id('c'), t(','), id('d')],
    [t('Print'), id('a'), t(','), id('b'), t(','), id('c'), t(','), id('d')], [t('Close All')]];
  const logs = [];
  const program = compile(binary(lines)).create({ setTimeout() {},
    files: createMemoryFiles({ numbers: '1e20,-1e20,3.5,-3.5\r\n' }), print: (...values) => logs.push(values) });
  program.tick(100);
  assert.deepStrictEqual(logs, [[2147483647, -2147483648, 3, -3]]);
  assert.strictEqual(program.state.halted, true);
});
