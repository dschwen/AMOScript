/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const Transpiler = require('../lib/Transpiler');
const { token: t, word: w, dword, integer: n, identifier: id, text, binary, execute } = require('./helpers/program');
const proc = name => [t('Procedure'), dword(0), w(0), 0, 0, id(name)];
const result = value => [t('End Proc'), t('['), value, t(']')];
const call = name => id(name, 0x12);

test('procedures: End Proc results update their own Param slots', () => {
  const data = binary([
    proc('integer'), result(n(42)), proc('string'), result(text('AMOS')),
    proc('real'), result([w(0x46), dword(0xc9062442)]),
    [call('integer')], [call('string')], [call('real')],
    [t('Print'), w(0x3e2), t(','), w(0x3d6), t(','), w(0x3ca)]
  ]);
  assert.deepStrictEqual(execute(data).logs, [[42, 'AMOS', 3.1409997940063477]]);
});

test('procedures: Shared is scoped to one procedure and does not leak to another', () => {
  const data = binary([
    [id('a'), t('='), n(10)], proc('shared'), [t('Shared'), id('a')], [t('Inc'), id('a')], result(id('a')),
    proc('local'), result(id('a')),
    [call('shared')], [t('Print'), t('Param'), t(','), id('a')],
    [call('local')], [t('Print'), t('Param'), t(','), id('a')]
  ]);
  assert.deepStrictEqual(execute(data).logs, [[11, 11], [0, 11]]);
  assert.throws(() => new Transpiler(binary([[t('Shared'), id('a')]])), /Shared requires a procedure/);
});

test('conditionals: Else If chains choose one branch and skip later alternatives', () => {
  for (const value of [0, 1, 2, 3]) {
    const data = binary([
      [id('a'), t('='), n(value)], [t('If'), w(0), id('a'), t('='), n(1)], [t('Print'), text('one')],
      [t('Else If'), w(0), id('a'), t('='), n(2)], [t('Print'), text('two')],
      [t('Else'), w(0)], [t('Print'), text('other')], [t('Endif')]
    ]);
    assert.deepStrictEqual(execute(data).logs, [[value === 1 ? 'one' : value === 2 ? 'two' : 'other']]);
  }
});

test('loops: Exit If evaluates its exit depth only for a true condition', () => {
  const data = binary([
    [t('Do'), w(0)], [t('Do'), w(0)],
    [t('Exit If'), w(0), w(0), n(0), t(','), n(1), t('/'), n(0)],
    [t('Exit If'), w(0), w(0), n(1), t(','), n(2)],
    [t('Loop')], [t('Loop')], [t('Print'), text('done')]
  ]);
  assert.deepStrictEqual(execute(data).logs, [['done']]);
});
