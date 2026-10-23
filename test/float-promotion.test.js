/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const { binary, token: t, word: w, dword, integer: n, identifier: id, text, execute } = require('./helpers/program');
const ffp = bits => [w(0x46), dword(bits)];
const val = value => [t('Val'), t('('), text(value === -2147483648 ? '$80000000' : String(value)), t(')')];
const real = name => id(name, 6, 1);
const array = (name, index) => [id(name, 6, 0x41), t('('), n(index), t(')')];

test('float promotion: signed integer assignments round to 24 significant bits, with magnitude ties up', () => {
  const values = [0, 1, -1, 16777215, 16777216, 16777217, -16777217, 16777219, -16777219, 33554431, 33554433, 33554434, 33554435, 2147483647, -2147483648];
  const expected = [0, 1, -1, 16777215, 16777216, 16777218, -16777218, 16777220, -16777220, 33554432, 33554432, 33554436, 33554436, 2147483648, -2147483648];
  for (const operand of [n, val]) {
    const lines = values.flatMap(value => [[real('x'), t('='), operand(value)], [t('Print'), real('x')]]);
    assert.deepStrictEqual(execute(binary(lines)).logs, expected.map(value => [value]));
  }
});

test('float promotion: mixed comparisons and arithmetic promote before using the integer operand', () => {
  for (const operand of [n, val]) {
    const expressions = [
      [operand(16777217), t('='), ffp(0x80000159)],
      [ffp(0x80000159), t('='), operand(16777217)],
      [operand(16777217), t('<'), ffp(0x80000159)],
      [operand(16777217), t('-'), ffp(0x80000159)],
      [operand(16777217), t('*'), ffp(0x80000041)],
      [operand(16777217), t('/'), ffp(0x80000041)],
      [operand(16777217), t('^'), n(1), t('='), ffp(0x80000159), t('^'), n(1)],
      [t('Sin'), t('('), operand(16777217), t(')'), t('='), t('Sin'), t('('), ffp(0x80000159), t(')')],
      [operand(16777217), t('='), n(16777218)]
    ];
    assert.deepStrictEqual(execute(binary(expressions.map(expr => [t('Print'), expr]))).logs,
      [[-1], [-1], [0], [0], [16777218], [16777218], [-1], [-1], [0]]);
  }
});

test('float promotion: Min and Max use promoted values and retain the resulting numeric type', () => {
  for (const operand of [n, val]) {
    const expressions = ['Min', 'Max'].flatMap(name => [
      [t(name), t('('), operand(16777217), t(','), ffp(0x80000159), t(')')],
      [t(name), t('('), ffp(0x80000159), t(','), operand(16777217), t(')')],
      [t(name), t('('), operand(7), t(','), n(9), t(')'), t('/'), n(2)]
    ]);
    assert.deepStrictEqual(execute(binary(expressions.map(expr => [t('Print'), expr]))).logs,
      [[16777218], [16777218], [3], [16777218], [16777218], [4]]);
  }
});

test('float promotion: float arrays, DATA and procedure parameter/result storage agree', () => {
  const procedure = [t('Procedure'), dword(0), w(0), 0, 0, id('p'), t('['), real('x'), t(']')];
  const data = binary([
    [t('Dim'), array('a', 0)],
    [array('a', 0), t('='), n(16777217)],
    [t('Data'), w(0), n(16777217), t(','), val(16777217), t(','), ffp(0x80000159)],
    [t('Read'), real('x'), t(','), real('y'), t(','), real('z')],
    procedure,
    [t('End Proc'), t('['), real('x'), t(']')],
    [id('p', 0x12), t('['), n(16777217), t(']')],
    [t('Print'), array('a', 0), t(','), real('x'), t(','), real('y'), t(','), real('z'), t(','), t('Param#')],
    [id('p', 0x12), t('['), val(-16777217), t(']')],
    [t('Print'), t('Param#')]
  ]);
  assert.deepStrictEqual(execute(data).logs,
    [[16777218, 16777218, 16777218, 16777218, 16777218], [-16777218]]);
});

test('float promotion: floating values are preserved and integer destinations saturate overflow', () => {
  const data = binary([
    [real('x'), t('='), ffp(0xc9062442)],
    [real('y'), t('='), val('3.5')],
    [id('x'), t('='), real('x')],
    [t('Print'), real('x'), t(','), real('y'), t(','), id('x')]
  ]);
  assert.deepStrictEqual(execute(data).logs, [[3.1409997940063477, 3.5, 3]]);
  assert.deepStrictEqual(execute(binary([[real('x'), t('='), n(2147483647)], [id('x'), t('='), real('x')],
    [t('Print'), real('x'), t(','), id('x')]])).logs, [[2147483648, 2147483647]]);
});
