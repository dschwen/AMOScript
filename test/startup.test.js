/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const { binary, token: t, word: w, dword, integer: n, identifier: id, text, execute, compile } = require('./helpers/program');
const { createFakeTimers } = require('./helpers/fakeTimers');

test('startup: independent original token bytes cover buffer, host commands and Timer read/write', () => {
  const fixture = require('./fixtures/conformance/wonderland-startup.json');
  assert.strictEqual(fixture.evidence.kind, 'source-analysis');
  const { program, logs } = execute(Buffer.from(fixture.programHex, 'hex'));
  assert.deepStrictEqual(logs, fixture.expected.values);
  assert.strictEqual(program.compilation.variableBufferBytes, fixture.expected.variableBufferBytes);
  assert.strictEqual(program.state.system.amosLocked, fixture.expected.amosLocked);
});

function make(create, options = {}) {
  const timers = createFakeTimers(), clock = { time: 0 }, logs = [];
  const program = create({ setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
    now: () => clock.time, print: (...args) => logs.push(args), ...options });
  return { program, timers, clock, logs };
}

test('startup: original Set Buffer decimal literal is compile metadata with unsigned-word KiB sizing', () => {
  for (const [size, bytes] of [[0, 0], [10, 10240], [65546, 10240]]) {
    const { program } = execute(binary([[w(0x4fe), n(size)], [t('End')]]));
    assert.strictEqual(program.compilation.variableBufferBytes, bytes);
    assert.ok(Object.isFrozen(program.compilation)); assert.strictEqual(program.state.halted, true);
  }
  assert.strictEqual(execute(binary([[t('End')]])).program.compilation.variableBufferBytes, null);
});

test('startup: unsupported Set Buffer expressions, nesting and placement fail with locations', () => {
  for (const value of [text('10'), id('size'), [t('-'), n(1)], [n(1), t('+'), n(1)], [w(0x46), dword(0xa0000044)], [w(0x1e), dword(10)]]) {
    assert.throws(() => compile(binary([[t('Set Buffer'), value]])), /at line 1, byte/);
  }
  for (const lines of [
    [[t('Print'), n(1)], [t('Set Buffer'), n(10)]],
    [[t('Set Buffer'), n(10)], [t('Set Buffer'), n(10)]],
    [[t('If'), w(0), n(1), t('Then'), t('Set Buffer'), n(10)]],
    [[id('label', 12), t('Set Buffer'), n(10)]]
  ]) assert.throws(() => compile(binary(lines)), /Set Buffer is supported only once before executable statements at line/);
});

test('startup: original host commands update isolated state and call synchronous system adapters', () => {
  const { create } = compile(binary([[w(0x24e0)], [w(0x171a)], [t('End')]])), calls = [];
  const a = make(create, { system: { command: name => { calls.push(name); } } }), b = make(create);
  a.program.tick(100);
  assert.deepStrictEqual(calls, ['Amos Lock', 'Close Editor']);
  assert.deepStrictEqual({ ...a.program.state.system }, { amosLocked: true, amosFront: true, editorOpen: false, forbidDepth: 0, workbenchOpen: true });
  assert.strictEqual(b.program.state.system.amosLocked, false);
  b.program.tick(100); assert.strictEqual(b.program.state.system.amosLocked, true);
  for (const system of [{}, { command: () => ({ then() {} }) }, { command() { throw new Error('host failure'); } }]) {
    const failing = make(create, { system });
    assert.throws(() => failing.program.tick(100), /at line 1, byte 22/);
    assert.strictEqual(failing.program.state.halted, true); assert.strictEqual(failing.timers.pending(), 0);
    assert.strictEqual(failing.program.state.system.amosLocked, false);
  }
});

test('Timer: VBL phase survives assignment, step budgets and Stop; factories remain independent', () => {
  const { create } = compile(binary([[t('Wait Key')], [t('End')]])), a = make(create), b = make(create);
  a.program.tick(1); a.clock.time = 19; a.program.setTimer(7);
  assert.strictEqual(a.program.timer(), 7);
  a.clock.time = 20; assert.strictEqual(a.program.timer(), 8);
  assert.strictEqual(b.program.timer(), 0);
  a.program.stop(); a.clock.time = 1020; assert.strictEqual(a.program.timer(), 58);
  assert.strictEqual(a.program.tick(100).steps, 0);
  a.program.resume(); assert.strictEqual(a.program.timer(), 58);
  b.clock.time = 20; assert.strictEqual(b.program.timer(), 1);
  const sixty = make(create, { vblHz: 60, sleepScale: 0 });
  sixty.clock.time = 1000; assert.strictEqual(sixty.program.timer(), 60);
  assert.strictEqual(sixty.timers.pending(), 0);
});

test('Timer: signed wrapping and numeric conversion match longword read/write boundaries', () => {
  const { create } = compile(binary([[t('Wait Key')]])), current = make(create);
  current.program.setTimer(2147483647); current.clock.time = 20;
  assert.strictEqual(current.program.timer(), -2147483648);
  current.program.setTimer(-1); current.clock.time = 40; assert.strictEqual(current.program.timer(), 0);
  current.clock.time = 85899345920; current.program.setTimer(0);
  current.clock.time += 85899345920; assert.strictEqual(current.program.timer(), 0);
});

test('Timer: integer typing flows through scalar/array storage, DATA and procedure results', () => {
  const lines = [
    [t('Data'), w(0), n(-5)], [t('Read'), id('seed')],
    [w(0x12ce), t('='), id('seed')], [t('Dim'), id('a'), t('('), n(1), t(')')],
    [id('a'), t('('), n(1), t(')'), t('='), t('Timer')],
    [id('f', 6, 1), t('='), t('Timer')],
    [t('Procedure'), dword(0), w(0), 0, 0, id('readtimer')],
    [t('End Proc'), t('['), t('Timer'), t(']')], [id('readtimer', 0x12)],
    [t('Print'), id('a'), t('('), n(1), t(')'), t(','), id('f', 6, 1), t(','), t('Param')],
    [t('Timer'), t('='), t('Val'), t('('), text('1.9'), t(')')], [t('Print'), t('Timer')]
  ];
  assert.deepStrictEqual(execute(binary(lines)).logs, [[-5, -5, -5], [1]]);
  assert.throws(() => compile(binary([[t('Timer'), t('='), text('wrong')]])), /numeric|number/i);
  assert.throws(() => compile(binary([[t('Print'), t('Timer'), t('('), n(1), t(')')]])), /at line/);
});

test('Wonderland: unmodified startup prefix compiles and executes both original speed-test branches', () => {
  const prefix = require('./helpers/wonderlandStartup')();
  const { create } = compile(prefix), fast = make(create), slow = make(create);
  fast.program.tick(100000);
  assert.strictEqual(fast.program.state.halted, true); assert.strictEqual(fast.program.state.variables.int_a3000, 1);
  slow.program.tick(10); slow.clock.time = 600; slow.program.tick(100000);
  assert.strictEqual(slow.program.state.halted, true); assert.strictEqual(slow.program.state.variables.int_a3000, 0);
  assert.strictEqual(slow.program.compilation.variableBufferBytes, 10240);
});
