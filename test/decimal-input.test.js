/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const { binary, token: t, word: w, dword, integer: n, identifier: id, text, execute, compile } = require('./helpers/program');
const { createMemoryFiles } = require('../lib/amos/files');
const val = value => [t('Val'), t('('), text(value), t(')')];
const ffp = bits => [w(0x46), dword(bits)];
const real = name => id(name, 6, 1);

test('decimal input: Val uses FFP digit accumulation and decimal scaling before output or comparison', () => {
  const cases = [['0.1', 0.10000000149011612], ['3.141', 3.1409997940063477],
    ['16777217.0', 16777216], ['-16777217.0', -16777216], ['.5', 0.5], ['-12.5suffix', -12.5]];
  const lines = cases.map(([value]) => [t('Print'), val(value)]);
  lines.push([t('Print'), val('0.1'), t('='), ffp(0xcccccd3d)],
    [t('Print'), val('3.141'), t('='), ffp(0xc9062442)]);
  assert.deepStrictEqual(execute(binary(lines)).logs, [...cases.map(([, expected]) => [expected]), [-1], [-1]]);
});

test('decimal input: prefix scanning preserves runtime numeric type for incomplete exponents and spaces', () => {
  const cases = [['1e', 0], ['1e+', 0.5], ['1.e', 0.5], ['1eX', 0],
    [' 1 2 ', 6], [' 1 . 5 e + 1 suffix', 7.5], ['\t1.0', 0], ['1\t.5', 0], ['.', 0]];
  assert.deepStrictEqual(execute(binary(cases.map(([value]) => [t('Print'), val(value), t('/'), n(2)]))).logs,
    cases.map(([, expected]) => [expected]));
});

test('decimal input: decimal integer bounds and based scanner boundaries follow ValRout', () => {
  const cases = [['2147483647', 2147483647], ['-2147483647', -2147483647],
    ['2147483648', 0], ['-2147483648', 0], ['$80000000', -2147483648],
    ['$FFFFFFFF', -1], ['-$FFFFFFFF', 1], ['$000000001', 0], ['$F F', 15],
    ['%1 0 1', 5], ['%0' + '1'.repeat(32), -1], ['%' + '0'.repeat(33) + '12', 12]];
  assert.deepStrictEqual(execute(binary(cases.map(([value]) => [t('Print'), val(value)]))).logs,
    cases.map(([, expected]) => [expected]));
});

test('decimal input: scale underflow, saturation, exponent wrapping and the 33-byte conversion bound are explicit', () => {
  const maximum = 16777215 * Math.pow(2, 39);
  const cases = [['1e-20', 0], ['-1e-20', 0], ['1000000e-20', 0],
    ['1e20', maximum], ['-1e20', -maximum], ['0e20', 0], ['1e65536', 1],
    ['1e65535', 0.10000000149011612], ['1e-65535', 10], ['1e32768', 0],
    ['0'.repeat(33) + '.1', 0]];
  assert.deepStrictEqual(execute(binary(cases.map(([value]) => [t('Print'), val(value)]))).logs,
    cases.map(([, expected]) => [expected]));
});

test('decimal input: file numeric input shares conversion and destination types with Val', () => {
  const lines = [
    [t('Open In'), n(1), t(','), text('numbers')],
    [t('Input#'), n(1), t(','), real('a'), t(','), real('b'), t(','), id('c'), t(','), real('d')],
    [t('Print'), real('a'), t(','), real('b'), t(','), id('c'), t(','), real('d')],
    [t('Close'), n(1)]
  ];
  const logs = [];
  const files = createMemoryFiles({ numbers: '0.1,16777217,16777217.0,1e-20\r\n' });
  const program = compile(binary(lines)).create({ setTimeout() {}, files, print: (...args) => logs.push(args) });
  program.tick(1000);
  assert.deepStrictEqual(logs, [[0.10000000149011612, 16777218, 16777216, 0]]);
  assert.strictEqual(program.state.halted, true);
});

test('decimal input: DATA and procedure returns retain the converted floating value and type', () => {
  const lines = [
    [t('Data'), w(0), val('0.1')], [t('Read'), real('x')],
    [t('Procedure'), dword(0), w(0), 0, 0, id('p')],
    [t('End Proc'), t('['), val('0.1'), t(']')], [id('p', 0x12)],
    [t('Print'), real('x'), t(','), t('Param#'), t(','), t('Param#'), t('='), val('0.1')]
  ];
  assert.deepStrictEqual(execute(binary(lines)).logs, [[0.10000000149011612, 0.10000000149011612, -1]]);
});
