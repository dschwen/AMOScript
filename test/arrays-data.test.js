/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const Transpiler = require('../lib/Transpiler');
const { token: t, word: w, dword, integer: n, identifier: id, text, binary, execute } = require('./helpers/program');
const array = (name, indices, flags = 0) => [id(name, 6, flags | 0x40), t('('), indices.flatMap((value, i) => [...(i ? t(',') : []), ...value.flat(Infinity)]), t(')')];
const declaration = (name, flags = 0) => [id(name, 6, flags | 0x40), t('('), t(')')];
const proc = name => [t('Procedure'), dword(0), w(0), 0, 0, id(name)];
const call = name => id(name, 0x12);

test('arrays: inclusive multidimensional bounds and independent scalar/array typed namespaces', () => {
  const data = binary([
    [t('Dim'), array('a', [n(1), n(2)]), t(','), array('a', [n(0)], 2)],
    [id('a'), t('='), n(99)],
    [array('a', [n(1), n(2)]), t('='), n(42)],
    [array('a', [n(0)], 2), t('='), text('AMOS')],
    [t('Inc'), array('a', [n(1), n(2)])],
    [t('Print'), id('a'), t(','), array('a', [n(1), n(2)]), t(','), array('a', [n(0), n(0)]), t(','), array('a', [n(0)], 2)]
  ]);
  assert.deepStrictEqual(execute(data).logs, [[99, 43, 0, 'AMOS']]);
});

test('arrays: dimensions, indexing and duplicate dimension errors are explicit', () => {
  const inputs = [
    [binary([[t('Print'), array('a', [n(0)])]]), /Array not dimensioned/],
    [binary([[t('Dim'), array('a', [n(-1)])]]), /Invalid array dimensions/],
    [binary([[t('Dim'), array('a', [n(65536)])]]), /Invalid array dimensions/],
    [binary([[t('Dim'), array('a', [n(1)])], [t('Print'), array('a', [n(2)])]]), /out of bounds/],
    [binary([[t('Dim'), array('a', [n(1), n(1)])], [t('Print'), array('a', [n(0)])]]), /Wrong number/],
    [binary([[t('Dim'), array('a', [n(1)])], [t('Dim'), array('a', [n(1)])]]), /already dimensioned/]
  ];
  for (const [data, message] of inputs) assert.throws(() => execute(data), message);
});

test('arrays: procedural Shared arrays update caller storage; local arrays start fresh', () => {
  const data = binary([
    [t('Dim'), array('a', [n(0)])],
    proc('p'), [t('Shared'), declaration('a')], [t('Dim'), array('b', [n(0)])],
    [t('Inc'), array('a', [n(0)])], [t('Inc'), array('b', [n(0)])],
    [t('Print'), array('a', [n(0)]), t(','), array('b', [n(0)])],
    [t('End Proc')], [call('p')], [call('p')]
  ]);
  assert.deepStrictEqual(execute(data).logs, [[1, 1], [2, 1]]);
});

test('data: Read evaluates expressions at read time and Restore resets the cursor', () => {
  const data = binary([
    [t('Data'), w(0), id('a'), t('+'), n(1), t(','), text('text'), t(','), t(','), n(8)],
    [id('a'), t('='), n(4)], [t('Read'), id('b'), t(','), id('s', 6, 2), t(','), id('empty'), t(','), id('c')],
    [t('Print'), id('b'), t(','), id('s', 6, 2), t(','), id('empty'), t(','), id('c')],
    [id('a'), t('='), n(10)], [t('Restore')], [t('Read'), id('b')], [t('Print'), id('b')]
  ]);
  assert.deepStrictEqual(execute(data).logs, [[5, 'text', 0, 8], [11]]);
});

test('data: Restore a labeled Data statement, read into arrays and consume empty strings', () => {
  const data = binary([
    [t('Dim'), array('a', [n(1)])], [t('Restore'), id('values', 0x18)],
    [t('Read'), array('a', [n(1)]), t(','), id('s', 6, 2)],
    [t('Print'), array('a', [n(1)]), t(','), id('s', 6, 2)],
    [t('Data'), w(0), text('skip')],
    [id('values', 0xc), t('Data'), w(0), n(7), t(',')]
  ]);
  assert.deepStrictEqual(execute(data).logs, [[7, '']]);
});

test('data: procedure cursors are fresh on entry and restore the caller cursor', () => {
  const data = binary([
    [t('Data'), w(0), n(10), t(','), n(20)],
    proc('main'), [t('Data'), w(0), n(99)], [t('Read'), id('x')], [t('Print'), id('x')], [t('End Proc')],
    [t('Read'), id('a')], [call('main')], [t('Read'), id('b')], [t('Print'), id('a'), t(','), id('b')], [call('main')]
  ]);
  assert.deepStrictEqual(execute(data).logs, [[99], [10, 20], [99]]);
});

test('data: missing entries, mismatched types and invalid Restore labels fail explicitly', () => {
  assert.throws(() => execute(binary([[t('Read'), id('a')]])), /Out of Data.*line 1/);
  assert.throws(() => execute(binary([[t('Data'), w(0), text('text')], [t('Read'), id('a')]])), /Data type mismatch.*line 2/);
  assert.throws(() => new Transpiler(binary([[t('Restore'), id('missing', 0x18)]])), /does not identify Data/);
  assert.throws(() => new Transpiler(binary([[t('Print'), n(1), t(':'), t('Data'), w(0), n(2)]])), /Data must start a line/);
});

test('tokens: Until uses the original AMOS 0x025c opcode', () => {
  const data = binary([[t('Repeat'), w(0)], [t('Print'), text('once')], [w(0x25c), n(1)]]);
  assert.deepStrictEqual(execute(data).logs, [['once']]);
});
