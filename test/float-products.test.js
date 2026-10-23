/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const { binary, token: t, word: w, dword, integer: n, identifier: id, text, execute } = require('./helpers/program');
const ffp = bits => [w(0x46), dword(bits)];
const val = value => [t('Val'), t('('), text(value), t(')')];

test('float products: multiplication rounds mantissas, normalization carries and signed results', () => {
  const cases = [
    [0x80000141, 0x80000141, 1.000000238418579],
    [0x80000141, 0xc0000041, 1.500000238418579],
    [0x800001c1, 0xc0000041, -1.500000238418579],
    [0x800001c1, 0xc00000c1, 1.500000238418579],
    [0xcccccd3d, 0xcccccd3d, 0.010000000707805157],
    [0x80000140, 0xfffffe40, 0.5]
  ];
  for (const reverse of [false, true]) {
    assert.deepStrictEqual(execute(binary(cases.map(([a, b]) =>
      [t('Print'), ffp(reverse ? b : a), t('*'), ffp(reverse ? a : b)]))).logs,
    cases.map(([, , expected]) => [expected]));
  }
});

test('float products: division rounds recurring quotients and preserves source estimate boundaries', () => {
  const cases = [
    [0x80000041, 0xc0000042, 0.3333333432674408],
    [0x80000041, 0xa0000044, 0.10000000149011612],
    [0x80000042, 0xc0000042, 0.6666666865348816],
    [0xc0000042, 0x80000042, 1.5],
    [0x800000c1, 0xc0000042, -0.3333333432674408],
    [0x800000c1, 0xc00000c2, 0.3333333432674408],
    [0x80000041, 0x80000141, 0.9999998807907104],
    [0xffa3de41, 0xe2b9a541, 1.12750244140625],
    [0x88596c41, 0x8885db41, 0.9987335205078125]
  ];
  assert.deepStrictEqual(execute(binary(cases.map(([a, b]) => [t('Print'), ffp(a), t('/'), ffp(b)]))).logs,
    cases.map(([, , expected]) => [expected]));
});

test('float products: exponent guards precede normalization and preserve signed range limits', () => {
  const maximum = 16777215 * Math.pow(2, 39);
  const cases = [
    [0x8000007f, '*', 0x80000041, maximum],
    [0x800000ff, '*', 0x80000041, -maximum],
    [0x8000007e, '*', 0x80000041, Math.pow(2, 61)],
    [0x80000001, '*', 0x80000040, 0],
    [0x80000081, '*', 0x80000040, -Math.pow(2, -65)],
    [0x80000080, '*', 0x80000041, -Math.pow(2, -65)],
    [0x80000080, '*', 0x80000040, 0],
    [0xffffff7f, '/', 0x80000040, maximum],
    [0xffffffff, '/', 0x80000040, -maximum],
    [0x80000001, '/', 0x80000042, 0],
    [0x80000081, '/', 0x80000042, 0],
    [0x80000081, '/', 0xc0000041, -0xaaaaab * Math.pow(2, -88)],
    [0x80000001, '/', 0x8000007f, 0]
  ];
  assert.deepStrictEqual(execute(binary(cases.map(([a, op, b]) => [t('Print'), ffp(a), t(op), ffp(b)]))).logs,
    cases.map(([, , , expected]) => [expected]));
});

test('float products: Val, nested expressions and typed storage use the shared operations', () => {
  const values = [
    [val('1.0'), t('/'), n(3)],
    [n(1), t('/'), val('3.0')],
    [val('1.0'), t('/'), val('10.0')],
    [t('('), val('1.0'), t('/'), n(3), t(')'), t('*'), n(3)],
    [t('('), val('1.0'), t('/'), n(10), t(')'), t('='), ffp(0xcccccd3d)],
    [val('7'), t('/'), n(2)]
  ];
  const lines = values.map(expr => [t('Print'), expr]);
  lines.push([id('x', 6, 1), t('='), val('1.0'), t('/'), n(3)],
    [id('y'), t('='), id('x', 6, 1), t('*'), n(3)],
    [t('Data'), w(0), ffp(0x80000041), t('/'), n(10)],
    [t('Read'), id('z', 6, 1)],
    [t('Print'), id('x', 6, 1), t(','), id('y'), t(','), id('z', 6, 1)]);
  assert.deepStrictEqual(execute(binary(lines)).logs,
    [[0.3333333432674408], [0.3333333432674408], [0.10000000149011612], [1], [-1], [3],
      [0.3333333432674408, 1, 0.10000000149011612]]);
});

test('float products: zero is canonical and floating division by zero halts with source context', () => {
  const values = [[ffp(0), t('*'), ffp(0x800000c1)], [ffp(0), t('/'), ffp(0x800000c1)]];
  const { logs } = execute(binary(values.map(expr => [t('Print'), expr])));
  assert.deepStrictEqual(logs, [[0], [0]]);
  for (const zero of [n(0), ffp(0), val('0.0')]) {
    assert.throws(() => execute(binary([[t('Print'), ffp(0x80000041), t('/'), zero]])),
      /Division by zero at line 1, byte/);
  }
});
