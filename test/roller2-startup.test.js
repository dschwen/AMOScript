/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const { binary, token: t, word: w, dword, integer: n, text, identifier: id, compile, execute } = require('./helpers/program');
const { createMemoryFiles } = require('../lib/amos/files');

test('Roller2 startup: unchanged first 17 lines set directive metadata, directory, booleans, music and pointer state', () => {
  const directory = path.join(__dirname, '../examples/Roller2'), manifest = require('../examples/Roller2/manifest.json');
  const assets = new Map(Object.keys(manifest.files).map(name => [name.toLowerCase(), name]));
  const reads = [], files = {
    isDirectory: name => name === 'RII:',
    read(name) {
      reads.push(name);
      const original = assets.get(name.replace(/^rii:/i, '').toLowerCase());
      if (!original) throw new Error(`Unexpected asset: ${name}`);
      return fs.readFileSync(path.join(directory, original), 'latin1');
    }
  };
  const source = require('./helpers/roller2Startup')(), raw = fs.readFileSync(path.join(directory, 'Roller II.AMOS'));
  const b = new(require('../lib/Buffer'))(raw), end = b.lines[16] + raw[b.lines[16]] * 2;
  assert.deepStrictEqual(source.subarray(20, end), raw.subarray(20, end));
  const { program: p, timers: c } = execute(source, 1000, { files });
  assert.deepStrictEqual({ ...p.compilation }, { variableBufferBytes: 20480, stackEntries: 501 });
  assert.strictEqual(p.currentDirectory(), 'RII:'); assert.strictEqual(p.state.breakEnabled, false);
  assert.strictEqual(p.state.variables.int_scrlmode, 4); assert.strictEqual(p.state.variables.int_manscrlstp, 2);
  assert.strictEqual(p.state.variables.int_itrom, -1); assert.strictEqual(p.state.variables.string_pic, 'RII:iffp/');
  assert.strictEqual(p.mouseVisible(), false); assert.strictEqual(p.state.audio.bank, 6);
  assert.strictEqual(p.state.tracker.playing, true); assert.strictEqual(p.state.tracker.loop, true); assert.strictEqual(p.state.waiting, 'key');
  assert.deepStrictEqual(reads, ['rii:music/Roller_II_Samples.abk', 'rII:music/mod.Roller_II_mus']);
  c.tick(120); assert.strictEqual(p.state.tracker.position.field, 6); p.stop(); assert.strictEqual(c.pending(), 0);
});

test('Set Stack: original literal token preserves clamped low-word-plus-one metadata without allocating a native stack', () => {
  for (const [size, entries] of [[0, 11], [9, 11], [10, 11], [500, 501], [65535, 0], [65546, 11]]) {
    const { program } = execute(binary([[w(0x4fe), n(20)], [w(0x2b9e), n(size)]]));
    assert.strictEqual(program.compilation.stackEntries, entries); assert.ok(Object.isFrozen(program.compilation));
  }
  assert.strictEqual(execute(binary([[t('End')]])).program.compilation.stackEntries, null);
  for (const value of [text('500'), id('size'), [t('-'), n(1)], [n(1), t('+'), n(1)], [w(0x46), dword(0xa0000044)], [w(0x1e), dword(10)]]) {
    assert.throws(() => compile(binary([[w(0x2b9e), value]])), /at line 1, byte/);
  }
  for (const lines of [
    [[t('Print'), n(1)], [w(0x2b9e), n(500)]],
    [[w(0x2b9e), n(500)], [w(0x2b9e), n(500)]],
    [[t('If'), w(0), n(1), t('Then'), w(0x2b9e), n(500)]],
    [[id('label', 12), w(0x2b9e), n(500)]]
  ]) assert.throws(() => compile(binary(lines)), /Set Stack is supported only once before executable statements/);
});

test('Break Off: synchronous host dispatch updates one program flag without disabling host Stop', () => {
  const calls = [], { create } = compile(binary([[w(0x426)], [t('Wait Key')]]));
  const c = require('./helpers/fakeTimers').createFakeTimers(), options = { now: c.now, setTimeout: c.setTimeout, clearTimeout: c.clearTimeout };
  const a = create({ ...options, system: { command: name => calls.push(name) } }), b = create(options);
  a.tick(100); assert.deepStrictEqual(calls, ['Break Off']); assert.strictEqual(a.state.breakEnabled, false); assert.strictEqual(b.state.breakEnabled, true);
  a.stop(); assert.strictEqual(a.state.stopped, true); b.stop();
  for (const system of [{}, { command: () => Promise.resolve() }, { command() { throw new Error('host refused'); } }]) {
    assert.throws(() => execute(binary([[w(0x426)]]), 100, { system }), /at line 1, byte 22/);
  }
});

test('True/False/Not: literal offsets return AMOS integers and Not consumes its following expression', () => {
  const unary = value => [w(0x9c), value];
  const { logs } = execute(binary([[t('Print'), w(0x123e), t(','), w(0x1248), t(','), unary(n(0)), t(','), unary(w(0x123e))],
    [t('Print'), unary([n(1), t('+'), n(2)]), t(','), t('('), unary(n(1)), t(')'), t('+'), n(2), t(','), unary([n(1), t('='), n(0)])],
    [t('Print'), unary([n(1), t('And'), n(2)]), t(','), unary([n(1), t('Or'), n(2)]), t(','), unary([t('Val'), t('('), text('1.9'), t(')')])]]));
  assert.deepStrictEqual(logs, [[-1, 0, -1, 0], [-4, 0, -1], [-1, -4, -2]]);
  assert.throws(() => compile(binary([[t('Print'), unary(text('0'))]])), /Not requires a numeric expression.*line 1/);
});

test('True/False/Not: typed scalars, arrays, DATA and procedure results preserve integer conversion', () => {
  const { logs } = execute(binary([
    [t('Data'), w(0), w(0x123e), t(','), w(0x1248)], [t('Read'), id('a'), t(','), id('f', 6, 1)],
    [t('Dim'), id('x'), t('('), n(0), t(')')], [id('x'), t('('), n(0), t(')'), t('='), w(0x9c), id('f', 6, 1)],
    [t('Procedure'), dword(0), w(0), 0, 0, id('answer')], [t('End Proc'), t('['), w(0x9c), t('Val'), t('('), text('2.9'), t(')'), t(']')],
    [id('answer', 0x12)], [t('Print'), id('a'), t(','), id('f', 6, 1), t(','), id('x'), t('('), n(0), t(')'), t(','), t('Param')]
  ]));
  assert.deepStrictEqual(logs, [[-1, 0, -1, -3]]);
});

test('Hide/Show: nested signed-word levels and On resets preserve per-program visibility', () => {
  const { program: p } = execute(binary([[w(0x1de0)], [w(0x1de0)], [w(0x1df8)], [t('Wait Key')]]));
  assert.strictEqual(p.mouseVisible(), false); p.show(); assert.strictEqual(p.mouseVisible(), true);
  p.hideOn(); p.hide(); p.show(); assert.strictEqual(p.mouseVisible(), false);
  p.showOn(); assert.strictEqual(p.mouseVisible(), true);
  p.show(); p.hide(); assert.strictEqual(p.mouseVisible(), true); p.hide(); assert.strictEqual(p.mouseVisible(), false); p.stop();
  assert.strictEqual(execute(binary([[t('End')]])).program.mouseVisible(), true);
});

test('Dir$/Exist: typed directory expressions, metadata queries, booleans and isolated current paths use one synchronous call', () => {
  const memory = createMemoryFiles({ 'D:folder/item': 'payload' }, [], ['EMPTY:']), queries = [];
  const files = { ...memory, exists(name) { queries.push(name); return memory.exists(name); } };
  const { program: p, logs } = execute(binary([[t('Data'), w(0), text('D:')], [t('Read'), id('d', 6, 2)],
    [t('Dim'), id('dirs', 6, 2), t('('), n(0), t(')')], [id('dirs', 6, 2), t('('), n(0), t(')'), t('='), id('d', 6, 2)],
    [t('Procedure'), dword(0), w(0), 0, 0, id('getdir')], [t('End Proc'), t('['), text('D:'), t(']')], [id('getdir', 0x12)],
    [w(0x175a), t('='), t('Param$')], [w(0x175a), t('='), id('dirs', 6, 2), t('('), n(0), t(')')], [w(0x175a), t('='), text('folder')],
    [t('Print'), w(0x175a), t(','), w(0x174e), t('('), text('item'), t(')'), t(','), w(0x9c), w(0x174e), t('('), text('missing'), t(')')],
    [t('Print'), w(0x174e), t('('), text('EMPTY:'), t(')'), t(','), w(0x174e), t('('), text(''), t(')')],
    [t('If'), w(0), w(0x9c), w(0x174e), t('('), text('missing2'), t(')'), t('Then'), id('flag'), t('='), w(0x123e)], [t('Print'), id('flag')]
  ]), 1000, { files });
  assert.deepStrictEqual(logs, [['D:folder/', -1, -1], [-1, 0], [-1]]);
  assert.deepStrictEqual(queries, ['D:folder/item', 'D:folder/missing', 'EMPTY:', 'D:folder/missing2']);
  assert.strictEqual(p.currentDirectory(), 'D:folder/'); assert.strictEqual(execute(binary([[t('End')]])).program.currentDirectory(), '');
  for (const line of [[w(0x175a), t('='), n(1)], [t('Print'), w(0x174e), t('('), n(1), t(')')]]) {
    assert.throws(() => compile(binary([line])), /string|argument type/);
  }
});
