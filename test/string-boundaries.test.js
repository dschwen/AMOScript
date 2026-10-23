/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const { token: t, integer: n, identifier: id, word: w, dword, text, binary, execute } = require('./helpers/program');
const s = name => id(name, 6, 2);
const fn = (name, ...args) => [t(name), t('('), args.flatMap((arg, i) => [...(i ? t(',') : []), arg]), t(')')];
const repeated = length => fn('String$', text('x'), n(length));

test('string boundaries: retrieval validates offsets before counts and retains zero-offset conventions', () => {
  const cases = [
    ['Left$', [text(''), n(-1)], ''], ['Right$', [text('abc'), n(0)], ''],
    ['Mid$', [text('abc'), n(4), n(-1)], ''], ['Mid$', [text(''), n(1), n(-1)], ''],
    ['Mid$', [text('abc'), n(0), n(2)], 'ab'], ['Mid$2', [text('abc'), n(0)], 'abc'],
    ['Right$', [text('abc'), n(70000)], 'abc'], ['Left$', [text('abc'), n(70000)], 'abc']
  ];
  assert.deepStrictEqual(execute(binary(cases.map(([name, args]) => [t('Print'), fn(name, ...args)]))).logs,
    cases.map(entry => [entry[2]]));
  for (const expression of [fn('Left$', text('abc'), n(-1)), fn('Right$', text(''), n(-1)),
    fn('Mid$', text('abc'), n(2), n(-1))]) {
    assert.throws(() => execute(binary([[t('Print'), expression]])), /Invalid string length at line 1/);
  }
  assert.throws(() => execute(binary([[t('Print'), fn('Mid$', text(''), n(-1), n(0))]])), /Invalid string position at line 1/);
});

test('string boundaries: repeated strings retain the RString word length and empty-source bypass', () => {
  const values = [0, 1, 65500, 65535, 65536, 65537, 131073];
  const lines = values.map(value => [t('Print'), fn('Len', repeated(value)),
    t(','), fn('Len', fn('Space$', n(value)))]);
  lines.push([t('Print'), fn('Len', fn('String$', text(''), n(-1)))]);
  assert.deepStrictEqual(execute(binary(lines)).logs,
    [[0, 0], [1, 1], [65500, 65500], [65535, 65535], [0, 0], [1, 1], [1, 1], [0]]);
  assert.throws(() => execute(binary([[t('Print'), fn('String$', text('x'), n(-1))]])), /Invalid string length/);
});

test('string boundaries: concatenation checks String_Max only when both operands are nonempty', () => {
  const lines = [[t('Print'), fn('Len', [repeated(65470), t('+'), text('y')])],
    [t('Print'), fn('Len', [text(''), t('+'), repeated(65535)])],
    [t('Print'), fn('Len', [repeated(65535), t('+'), text('')])]];
  assert.deepStrictEqual(execute(binary(lines)).logs, [[65471], [65535], [65535]]);
  for (const expression of [[repeated(65471), t('+'), text('y')], [text('y'), t('+'), repeated(65535)]]) {
    assert.throws(() => execute(binary([[s('x'), t('='), expression]])), /String too long at line 1, byte/);
  }
});

test('string boundaries: DATA, arrays and procedure results share concatenation validation', () => {
  const array = [id('a', 6, 0x42), t('('), n(0), t(')')];
  const lines = [[t('Dim'), array], [array, t('='), repeated(65470), t('+'), text('y')],
    [t('Data'), w(0), repeated(65470), t('+'), text('y')], [t('Read'), s('x')],
    [t('Procedure'), dword(0), w(0), 0, 0, id('p')],
    [t('End Proc'), t('['), repeated(65535), t('+'), text(''), t(']')], [id('p', 0x12)],
    [t('Print'), fn('Len', array), t(','), fn('Len', s('x')), t(','), fn('Len', t('Param$'))]];
  assert.deepStrictEqual(execute(binary(lines)).logs, [[65471, 65471, 65535]]);
  const invalid = binary([[t('Data'), w(0), repeated(65471), t('+'), text('y')], [t('Read'), s('x')]]);
  assert.throws(() => execute(invalid), /String too long at line 2, byte/);
});

test('string boundaries: every byte survives storage and only ASCII letters change case', () => {
  const bytes = String.fromCharCode(...Array.from({ length: 256 }, (_, i) => i));
  const lines = [[s('x'), t('='), text(bytes)], [t('Print'), fn('Upper$', s('x'))],
    [t('Print'), fn('Lower$', s('x'))], [t('Print'), fn('Flip$', s('x'))],
    [t('Print'), fn('Len', s('x')), t(','), fn('Asc', fn('Mid$', s('x'), n(256), n(1)))],
    [t('Print'), fn('Instr', s('x'), text('\0\x01'))],
    [t('Print'), [text('a\0b\0c'), t('-'), text('\0')]]];
  const { logs } = execute(binary(lines));
  assert.strictEqual(logs[0][0].length, 256);
  assert.strictEqual(logs[1][0].length, 256);
  for (let i = 0; i < 256; i++) {
    assert.strictEqual(logs[0][0].charCodeAt(i), i >= 97 && i <= 122 ? i - 32 : i);
    assert.strictEqual(logs[1][0].charCodeAt(i), i >= 65 && i <= 90 ? i + 32 : i);
    assert.strictEqual(logs[2][0].charCodeAt(i), 255 - i);
  }
  assert.deepStrictEqual(logs.slice(3), [[256, 255], [1], ['abc']]);
});
