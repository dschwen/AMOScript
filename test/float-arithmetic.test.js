/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const { binary, token: t, word: w, dword, integer: n, identifier: id, text, execute } = require('./helpers/program');
const ffp = bits => [w(0x46), dword(bits)];
const val = value => [t('Val'), t('('), text(value), t(')')];
const real = name => id(name, 6, 1);

test('float arithmetic: addition aligns mantissas and ignores exponent differences of at least 24', () => {
  const cases = [
    [0x80000041, 0x80000029, 1],
    [0x80000041, 0xc0000029, 1],
    [0x80000041, 0x8000002a, 1.0000001192092896],
    [0x800000c1, 0x800000a9, -1],
    [0x80000041, 0x80000141, 2],
    [0x80000041, 0xffffff40, 2]
  ];
  for (const reverse of [false, true]) {
    const lines = cases.map(([a, b]) => [t('Print'), ffp(reverse ? b : a), t('+'), ffp(reverse ? a : b)]);
    assert.deepStrictEqual(execute(binary(lines)).logs, cases.map(([, , expected]) => [expected]));
  }
});

test('float arithmetic: cancellation normalizes signed differences and preserves the source rounding bias', () => {
  const cases = [
    [0x80000141, '-', 0x80000041, Math.pow(2, -23)],
    [0x80000041, '-', 0x80000141, -Math.pow(2, -23)],
    [0x80000041, '-', 0xffffff40, Math.pow(2, -23)],
    [0xffffff40, '-', 0x80000041, -Math.pow(2, -23)],
    [0x80000041, '-', 0x80000029, 1],
    [0x800000c1, '+', 0x80000041, 0]
  ];
  const { logs } = execute(binary(cases.map(([a, op, b]) => [t('Print'), ffp(a), t(op), ffp(b)])));
  assert.deepStrictEqual(logs, cases.map(([, , , expected]) => [expected]));
  assert.strictEqual(Object.is(logs[logs.length - 1][0], -0), false);
});

test('float arithmetic: overflow saturates with its sign and underflow returns canonical zero', () => {
  const maximum = 16777215 * Math.pow(2, 39);
  const cases = [
    [0xffffff7f, '+', 0xffffff7f, maximum],
    [0xffffffff, '+', 0xffffffff, -maximum],
    [0xffffff7f, '-', 0xffffffff, maximum],
    [0x80000101, '-', 0x80000001, 0],
    [0xc0000081, '+', 0x80000001, -Math.pow(2, -65)],
    [0x80000001, '+', 0x80000080, 0],
    [0, '+', 0x80000080, -Math.pow(2, -65)]
  ];
  assert.deepStrictEqual(execute(binary(cases.map(([a, op, b]) => [t('Print'), ffp(a), t(op), ffp(b)]))).logs,
    cases.map(([, , , expected]) => [expected]));
});

test('float arithmetic: Val and static operands share rounding before nested comparisons and typed storage', () => {
  const expressions = [
    [val('1.0'), t('+'), ffp(0x80000029)],
    [ffp(0x80000029), t('+'), val('1.0')],
    [val('1.0'), t('-'), ffp(0xffffff40)],
    [t('('), val('1.0'), t('+'), ffp(0x80000029), t(')'), t('='), n(1)],
    [t('('), ffp(0x80000041), t('+'), ffp(0x80000029), t(')'), t('-'), val('1.0')]
  ];
  const lines = expressions.map(expr => [t('Print'), expr]);
  lines.push([real('x'), t('='), val('1.0'), t('+'), ffp(0x80000029)],
    [t('Data'), w(0), ffp(0x80000041), t('+'), ffp(0x80000029)],
    [t('Read'), real('y')], [t('Print'), real('x'), t(','), real('y')]);
  assert.deepStrictEqual(execute(binary(lines)).logs,
    [[1], [1], [Math.pow(2, -23)], [-1], [0], [1, 1]]);
});

test('float arithmetic: floating For/Next rounds each increment with the same adder', () => {
  const lines = [
    [t('For'), w(0), real('x'), t('='), n(0), t('To'), val('0.25'), t('Step'), val('0.1')],
    [t('Print'), real('x')], [t('Next'), real('x')],
    [t('Print'), real('x')]
  ];
  assert.deepStrictEqual(execute(binary(lines)).logs,
    [[0], [0.10000000149011612], [0.20000000298023224], [0.30000001192092896]]);
});

test('float arithmetic: a long source expression compiles without repeatedly expanding its subtrees', () => {
  const expression = Array.from({ length: 60 }, (_, i) => [...(i ? t('+') : []), ...ffp(0x80000041)]);
  assert.deepStrictEqual(execute(binary([[t('Print'), expression]])).logs, [[60]]);
});
