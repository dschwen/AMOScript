/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const { binary, token: t, word: w, dword, integer: n, identifier: id, text, execute } = require('./helpers/program');
const ffp = bits => [w(0x46), dword(bits)];
const val = value => [t('Val'), t('('), text(value), t(')')];
const fn = (name, arg) => [t(name), t('('), arg, t(')')];
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * tolerance, `${actual} != ${expected}`);

test('transcendental: natural log uses CORDIC mantissas and the finite zero sentinel', () => {
  const args = [n(0), n(1), n(2), n(4), ffp(0x80000040), ffp(0xc0000041), n(10)];
  const { logs } = execute(binary(args.map(arg => [t('Print'), fn('Ln', arg)])));
  assert.deepStrictEqual(logs.slice(0, 5), [[-16777215 * Math.pow(2, 39)], [0],
    [0.6931471824645996], [1.3862943649291992], [-0.6931471824645996]]);
  close(logs[5][0], Math.log(1.5));
  close(logs[6][0], Math.log(10));
});

test('transcendental: exponential uses repeated CORDIC shifts and finite range limits', () => {
  const values = [0, 1, -1, 2, -2, 10, -10, 40, 50, -50, 1000, -1000];
  const { logs } = execute(binary(values.map(value => [t('Print'), fn('Exp', n(value))])));
  assert.deepStrictEqual(logs.slice(0, 2), [[1], [2.7182817459106445]]);
  values.slice(2, 7).forEach((value, i) => close(logs[i + 2][0], Math.exp(value)));
  // Larger arguments lose precision in the FFP range-reduction product.
  // Use one input ULP at 40 for this case, beyond the source's |x|<30 claim.
  close(logs[7][0], Math.exp(40), Math.pow(2, -18));
  const maximum = 16777215 * Math.pow(2, 39);
  assert.deepStrictEqual(logs.slice(8), [[maximum], [0], [maximum], [0]]);
});

test('transcendental: power shares FFP log/multiply/exp for static and Val-derived operands', () => {
  for (const operand of [n, value => val(String(value))]) {
    const pairs = [[2, 3], [-2, 3], [-2, 2], [3, -2], [0, 0], [0, 2], [0, -1]];
    const { logs } = execute(binary(pairs.map(([a, b]) => [t('Print'), operand(a), t('^'), operand(b)])));
    [8, 8, 4, 1 / 9, 1, 0].forEach((expected, i) => close(logs[i][0], expected));
    assert.deepStrictEqual(logs[6], [16777215 * Math.pow(2, 39)]);
  }
});

test('transcendental: converted results retain float type through DATA, arrays and procedure returns', () => {
  const array = [id('a', 6, 0x41), t('('), n(0), t(')')];
  const lines = [
    [t('Dim'), array], [array, t('='), fn('Exp', n(1))],
    [t('Data'), w(0), fn('Ln', n(2))], [t('Read'), id('x', 6, 1)],
    [t('Procedure'), dword(0), w(0), 0, 0, id('p')],
    [t('End Proc'), t('['), fn('Exp', n(1)), t(']')], [id('p', 0x12)],
    [t('Print'), array, t(','), id('x', 6, 1), t(','), t('Param#')],
    [t('Print'), fn('Exp', val('0')), t('/'), n(2)]
  ];
  assert.deepStrictEqual(execute(binary(lines)).logs,
    [[2.7182817459106445, 0.6931471824645996, 2.7182817459106445], [0.5]]);
});

test('transcendental: Ln rejects the sign checked by AMOS and halts with source location', () => {
  for (const arg of [n(-1), val('-1.0'), [t('-'), ffp(0)]]) {
    assert.throws(() => execute(binary([[t('Print'), fn('Ln', arg)]])),
      /Illegal function call: Ln at line 1, byte/);
  }
});

test('transcendental: Pi uses the stored AMOS single-precision constant', () => {
  const lines = [[t('Print'), t('Pi#')],
    [t('Print'), t('Pi#'), t('='), ffp(0xc90fd942)]];
  assert.deepStrictEqual(execute(binary(lines)).logs, [[3.141592264175415], [-1]]);
});
