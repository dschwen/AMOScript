/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const Transpiler = require('../lib/Transpiler');
const { token: t, integer: n, identifier: id, word: w, dword, text, binary, execute, compile } = require('./helpers/program');
const string = name => id(name, 6, 2);
const array = (...indices) => [id('a', 6, 0x42), t('('), indices.flatMap((value, i) => [...(i ? t(',') : []), value]), t(')')];
const fn = (name, ...args) => [t(name), t('('), args.flatMap((arg, i) => [...(i ? t(',') : []), arg]), t(')')];
const write = (name, target, args, value) => [fn(name, target, ...args), t('='), value];

test('substring assignment: all four variants overwrite without changing string length', () => {
  const cases = [
    ['Left$', [n(4)], 'XY', 'XYcdef'], ['Right$', [n(4)], 'XY', 'abXYef'],
    ['Mid$', [n(3), n(2)], 'WXYZ', 'abWXef'], ['Mid$2', [n(3)], 'WXYZ', 'abWXYZ'],
    ['Mid$', [n(3), n(4)], 'X', 'abXdef'], ['Left$', [n(99)], 'XYZWXYZW', 'XYZWXY'],
    ['Right$', [n(99)], 'X', 'Xbcdef'], ['Mid$2', [n(6)], 'XYZ', 'abcdeX']
  ];
  const lines = cases.flatMap(([name, args, value]) => [[string('s'), t('='), text('abcdef')],
    write(name, string('s'), args, text(value)), [t('Print'), string('s'), t(','), fn('Len', string('s'))]]);
  assert.deepStrictEqual(execute(binary(lines)).logs, cases.map(entry => [entry[3], 6]));
});

test('substring assignment: zero offsets, empty replacements and past-end writes retain source bounds', () => {
  const cases = [
    ['Left$', [n(0)], 'XYZ', 'abc'], ['Right$', [n(0)], 'XYZ', 'abc'],
    ['Mid$', [n(0), n(2)], 'XYZ', 'XYc'], ['Mid$2', [n(1)], '', 'abc'],
    ['Mid$2', [n(4)], 'XYZ', 'abc'], ['Mid$', [n(99), n(-1)], 'XYZ', 'abc'],
    ['Mid$', [n(2), n(0)], 'XYZ', 'abc']
  ];
  const lines = cases.flatMap(([name, args, value]) => [[string('s'), t('='), text('abc')],
    write(name, string('s'), args, text(value)), [t('Print'), string('s')]]);
  lines.push(write('Left$', string('empty'), [n(-1)], text('X')), [t('Print'), string('empty')]);
  assert.deepStrictEqual(execute(binary(lines)).logs, [...cases.map(entry => [entry[3]]), ['']]);
});

test('substring assignment: shared strings and self-replacement use the original bytes', () => {
  const lines = [[string('s'), t('='), text('abc\0\xfff')], [string('copy'), t('='), string('s')],
    write('Mid$', string('s'), [n(2), n(4)], string('s')),
    [t('Print'), string('s'), t(','), string('copy')],
    write('Right$', string('s'), [n(2)], fn('Left$', string('s'), n(2))), [t('Print'), string('s')]];
  assert.deepStrictEqual(execute(binary(lines)).logs, [['aabc\0f', 'abc\0\xfff'], ['aabcaa']]);
});

test('substring assignment: multidimensional arrays, Shared and procedure locals preserve lvalue scope', () => {
  const lines = [[t('Dim'), array(n(1), n(1))], [array(n(1), n(0)), t('='), text('abcdef')],
    [string('s'), t('='), text('global')],
    [t('Procedure'), dword(0), w(0), 0, 0, id('p')],
    [t('Shared'), id('a', 6, 0x42), t('('), t(')')],
    [string('s'), t('='), text('local')], write('Left$', string('s'), [n(2)], text('XX')),
    write('Right$', array(n(1), n(0)), [n(3)], text('Y')),
    [t('End Proc'), t('['), string('s'), t(']')], [id('p', 0x12)],
    [t('Print'), string('s'), t(','), array(n(1), n(0)), t(','), t('Param$')]];
  assert.deepStrictEqual(execute(binary(lines)).logs, [['global', 'abcYef', 'XXcal']]);
});

test('substring assignment: array index, bounds and RHS evaluate once in source order', () => {
  const lines = [[t('Dim'), array(n(1))], [array(n(0)), t('='), text('abcd')],
    [array(n(1)), t('='), text('other')],
    write('Left$', array(t('X Mouse')), [t('X Mouse')], fn('Chr$', t('X Mouse'))),
    [t('Print'), array(n(0)), t(','), array(n(1))]];
  const logs = [], values = [0, 2, 90];
  const program = compile(binary(lines)).create({ setTimeout() {}, print: (...args) => logs.push(args) });
  let calls = 0;
  program.inputValue = name => { assert.strictEqual(name, 'X Mouse'); return values[calls++]; };
  program.tick(100);
  assert.strictEqual(calls, 3);
  assert.deepStrictEqual(logs, [['Zbcd', 'other']]);
});

test('substring assignment: bounds convert numeric types and inline branches accept write statements', () => {
  const lines = [[string('s'), t('='), text('abcd')],
    [t('If'), w(0), n(1), t('Then'), write('Mid$', string('s'),
      [fn('Val', text('2.9')), fn('Val', text('1e20'))], text('XYZ')), t('Else'), w(0),
      write('Left$', string('s'), [n(1)], text('!'))], [t('Print'), string('s')]];
  assert.deepStrictEqual(execute(binary(lines)).logs, [['aXYZ']]);
});

test('substring assignment: type, lvalue, array and validation-order errors retain source locations', () => {
  const cases = [
    [write('Left$', id('s'), [n(1)], text('x')), /requires a string variable.*line 1/],
    [write('Left$', string('s'), [n(1)], n(1)), /requires a string value.*line 1/],
    [write('Left$', string('s'), [text('1')], text('x')), /Expected numeric expression.*line 1/],
    [write('Left$', text('abc'), [n(1)], text('x')), /Expected variable.*line 1/]
  ];
  for (const [line, error] of cases) assert.throws(() => new Transpiler(binary([line])), error);
  const run = line => execute(binary([[string('s'), t('='), text('abc')], line]));
  assert.throws(() => run(write('Mid$2', string('s'), [n(-1)], text('x'))), /Invalid substring position at line 2/);
  assert.throws(() => run(write('Left$', string('s'), [n(-1)], text('x'))), /Invalid substring length at line 2/);
  assert.throws(() => run(write('Right$', string('s'), [n(-1)], fn('Left$', text('x'), n(-1)))), /Invalid substring length at line 2/);
  assert.throws(() => run(write('Mid$2', string('s'), [n(99)], fn('Left$', text('x'), n(-1)))), /Invalid string length at line 2/);
  assert.throws(() => run(write('Mid$2', string('s'), [n(-1)], fn('Left$', text('x'), n(-1)))), /Invalid string length at line 2/);
  assert.throws(() => execute(binary([write('Left$', array(n(0)), [n(1)], text('x'))])), /Array not dimensioned at line 1/);
});
