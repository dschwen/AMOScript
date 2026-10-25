/* jshint esversion: 6 */
'use strict';
const assert = require('assert');
const { binary, token: t, word: w, dword, integer: n, text, identifier: id, compile, execute } = require('./helpers/program');
const procedure = name => [t('Procedure'), dword(0), w(0), 0, 0, id(name)];

test('Pop Proc: nested Gosub/For exits preserve caller calls, locals, DATA and dynamic Param result', () => {
  const { program: p, logs } = execute(binary([
    [t('Data'), w(0), n(10), t(','), n(20)], [t('Read'), id('a')], [t('Gosub'), id('main', 0x18)], [t('End')],
    [id('main', 0xc)], [id('leave', 0x12)], [t('Read'), id('b')], [t('Print'), id('a'), t(','), id('b'), t(','), t('Param#')], [t('Return')],
    procedure('leave'), [t('Data'), w(0), n(1), t(','), n(2)], [t('Read'), id('a')], [t('Gosub'), id('inner', 0x18)],
    [t('Print'), text('unreachable')], [id('inner', 0xc)], [t('For'), w(0), id('i'), t('='), n(0), t('To'), n(9)],
    [w(0x33c), t('['), t('Val'), t('('), text('3.5'), t(')'), t(']')], [t('Next')], [t('End Proc'), t('['), n(99), t(']')]
  ]));
  assert.deepStrictEqual(logs, [[10, 20, 3.5]]); assert.strictEqual(p.state.stack.length, 0); assert.strictEqual(p.state.frames.length, 0);
});

test('Pop Proc: optional integer/float/string results use ordinary typed Param boundaries; no result preserves Param', () => {
  for (const [value, query, expected] of [[n(7), 'Param', 7], [[t('Val'), t('('), text('2.5'), t(')')], 'Param#', 2.5], [text('answer'), 'Param$', 'answer']]) {
    const { logs } = execute(binary([procedure('answer'), [w(0x33c), t('['), value, t(']')], [t('Print'), text('unreachable')], [t('End Proc')],
      [id('answer', 0x12)], [t('Print'), t(query)]]));
    assert.deepStrictEqual(logs, [[expected]]);
  }
  const { logs } = execute(binary([procedure('first'), [t('End Proc'), t('['), n(13), t(']')], procedure('leave'), [w(0x33c)], [t('End Proc')],
    [id('first', 0x12)], [id('leave', 0x12)], [t('Print'), t('Param')]])); assert.deepStrictEqual(logs, [[13]]);
});

test('Pop Proc: invalid scope/arity reject, while ordinary End Proc still rejects an unfinished Gosub', () => {
  assert.throws(() => compile(binary([[w(0x33c)]])), /requires a procedure.*line 1/);
  assert.throws(() => compile(binary([procedure('bad'), [w(0x33c), t('['), n(1), t(','), n(2), t(']')], [t('End Proc')]])), /accepts one result/);
  assert.throws(() => execute(binary([procedure('bad'), [t('Gosub'), id('inner', 0x18)], [id('inner', 0xc)], [t('End Proc')], [id('bad', 0x12)]])), /Invalid procedure return.*line 4/);
});
