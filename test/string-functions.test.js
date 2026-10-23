/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const Transpiler = require('../lib/Transpiler');
const { token: t, integer: n, identifier: id, word, dword, text, binary, execute } = require('./helpers/program');
const fn = (name, ...args) => [t(name), t('('), args.flatMap((arg, i) => [...(i ? t(',') : []), ...arg.flat(Infinity)]), t(')')];

test('strings: slicing, both Mid variants and reversal preserve byte strings', () => {
  const values = [fn('Left$', text('AMOS'), n(2)), fn('Right$', text('AMOS'), n(2)), fn('Mid$', text('AMOS'), n(2), n(2)), fn('Mid$2', text('AMOS'), n(3)), fn('Flip$', text('AMOS'))];
  const data = binary(values.map(value => [t('Print'), value]));
  assert.deepStrictEqual(execute(data).logs, [['AM'], ['OS'], ['MO'], ['OS'], ['SOMA']]);
});

test('strings: construction, case mapping, ASCII and substring search', () => {
  const values = [
    fn('Chr$', n(65)), fn('Asc', text('AMOS')), fn('Asc', text('')), fn('Len', text('AMOS')),
    fn('Space$', n(3)), fn('String$', text('xyz'), n(3)),
    fn('Upper$', text('Amos')), fn('Lower$', text('Amos')),
    fn('Instr', text('AMOS AMOS'), text('AMOS')), fn('Instr3', text('AMOS AMOS'), text('AMOS'), n(2))
  ];
  assert.deepStrictEqual(execute(binary(values.map(value => [t('Print'), value]))).logs, [['A'], [65], [0], [4], ['   '], ['xxx'], ['AMOS'], ['amos'], [1], [6]]);
});

test('strings: Val accepts decimal prefixes, exponent notation, hex and binary', () => {
  const values = ['  -12.5suffix', '1.25 E+03', '$FF', '%1010', '-$FF', '$FFFFFFFF', '1 2', 'invalid'].map(value => fn('Val', text(value)));
  assert.deepStrictEqual(execute(binary(values.map(value => [t('Print'), value]))).logs, [[-12.5], [1250], [255], [10], [-255], [-1], [12], [0]]);
});

test('strings: invalid types, lengths and byte codes are diagnosed', () => {
  assert.throws(() => new Transpiler(binary([[t('Print'), fn('Len', n(1))]])), /Wrong argument type/);
  assert.throws(() => execute(binary([[t('Print'), fn('Chr$', n(256))]])), /Invalid character code/);
  assert.throws(() => execute(binary([[t('Print'), fn('Space$', n(-1))]])), /Invalid string length/);
  assert.throws(() => execute(binary([[t('Print'), fn('Mid$2', text('AMOS'), n(-1))]])), /Invalid string position/);
});

test('strings: zero offsets mean the first character, and empty searches do not match', () => {
  const values = [fn('Mid$2', text('AMOS'), n(0)), fn('Instr3', text('AMOS'), text('A'), n(0)), fn('Instr', text('AMOS'), text('')), fn('Left$', text('AMOS'), n(70000))];
  assert.deepStrictEqual(execute(binary(values.map(value => [t('Print'), value]))).logs, [['AMOS'], [1], [0], ['AMOS']]);
});

test('strings: Str$ preserves the leading positive-number sign space', () => {
  const values = [fn('Str$', n(12)), fn('Str$', n(-12)), fn('Str$', fn('Val', text('3.5')))];
  assert.deepStrictEqual(execute(binary(values.map(value => [t('Print'), value]))).logs, [[' 12'], ['-12'], [' 3.5']]);
});

test('numbers: Val retains runtime integer/float types in nested arithmetic and comparisons', () => {
  const values = [
    [fn('Val', text('3')), t('/'), n(2)],
    [fn('Val', text('3.0')), t('/'), n(2)],
    [fn('Val', text('3.0')), t('+'), fn('Val', text('0.5'))],
    [fn('Val', text('3.0')), t('='), fn('Val', text('3'))],
    [fn('Min', fn('Val', text('3.5')), n(2)), t('/'), n(4)],
    [fn('Sin', fn('Val', text('0')))]
  ];
  assert.deepStrictEqual(execute(binary(values.map(value => [t('Print'), value]))).logs, [[1], [1.5], [3.5], [-1], [0.5], [0]]);
});

test('numbers: Val converts at typed assignments and uses numeric truth in conditions', () => {
  const data = binary([
    [id('a'), t('='), fn('Val', text('3.5'))], [id('b', 6, 1), t('='), fn('Val', text('3.5'))],
    [t('If'), word(0), fn('Val', text('0')), t('Then'), t('Print'), text('wrong'), t('Else'), word(0), t('Print'), id('a'), t(','), id('b', 6, 1)]
  ]);
  assert.deepStrictEqual(execute(data).logs, [[3, 3.5]]);
});

test('numbers: Val results retain type through Data and procedure returns', () => {
  const data = binary([
    [t('Data'), word(0), fn('Val', text('3.5'))], [t('Read'), id('a', 6, 1)],
    [t('Procedure'), dword(0), word(0), 0, 0, id('p')],
    [t('End Proc'), t('['), fn('Val', text('4.5')), t(']')], [id('p', 0x12)],
    [t('Print'), id('a', 6, 1), t(','), t('Param#')]
  ]);
  assert.deepStrictEqual(execute(data).logs, [[3.5, 4.5]]);
});
