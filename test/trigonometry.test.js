/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const Transpiler = require('../lib/Transpiler');
const { binary, token: t, word: w, dword, integer: n, identifier: id, text, execute, compile } = require('./helpers/program');
const { createFakeTimers } = require('./helpers/fakeTimers');
const ffp = bits => [w(0x46), dword(bits)];
const fn = (name, arg) => [t(name), t('('), arg, t(')')];
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * tolerance, `${actual} != ${expected}`);

test('trigonometry: circular CORDIC computes signed sine, cosine and tangent in default radians', () => {
  const values = [0, 1, -1, 3, -3, 5];
  for (const [name, reference] of [['Sin', Math.sin], ['Cos', Math.cos], ['Tan', Math.tan]]) {
    const { logs } = execute(binary(values.map(value => [t('Print'), fn(name, n(value))])));
    values.forEach((value, i) => close(logs[i][0], reference(value)));
  }
});

test('trigonometry: small-angle identities, output truncation and infinite tangent follow source branches', () => {
  const bits = [0x80000038, 0xffffff38, 0x800000b8, 0x80000001];
  const lines = bits.flatMap(value => [[t('Print'), fn('Sin', ffp(value)), t('='), ffp(value)],
    [t('Print'), fn('Tan', ffp(value)), t('='), ffp(value)]]);
  lines.push([t('Degree')], [t('Print'), fn('Sin', n(90)), t(','), fn('Cos', n(90)), t(','), fn('Tan', n(90))],
    [t('Print'), fn('Sin', n(180)), t(','), fn('Cos', n(180)), t(','), fn('Tan', n(-90))]);
  assert.deepStrictEqual(execute(binary(lines)).logs, [...bits.flatMap(() => [[-1], [-1]]),
    [1, 0, 16777215 * Math.pow(2, 39)], [0, -1, 16777215 * Math.pow(2, 39)]]);
});

test('trigonometry: angle modes are global to procedures but isolated between factory instances', () => {
  const lines = [[t('Wait Key')], [t('Print'), fn('Sin', n(1))], [t('Degree')], [t('Wait Key')],
    [t('Print'), fn('Sin', n(1))], [t('Procedure'), dword(0), w(0), 0, 0, id('reset')],
    [t('Radian')], [t('End Proc')], [id('reset', 0x12)], [t('Print'), fn('Sin', n(1))]];
  const { create } = compile(binary(lines));
  const instance = () => {
    const timers = createFakeTimers(), logs = [];
    const program = create({ setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
      now: timers.now, print: (...args) => logs.push(args) });
    program.tick(100);
    return { program, timers, logs };
  };
  const a = instance(), b = instance();
  for (const current of [a, b, a, b]) { current.program.sendKey('x'); current.timers.runAll(); }
  for (const current of [a, b]) {
    assert.deepStrictEqual(current.logs, [[0.8414710760116577], [0.017452407628297806], [0.8414710760116577]]);
    assert.strictEqual(current.program.state.halted, true);
    assert.strictEqual(current.timers.pending(), 0);
  }
});

test('trigonometry: range reduction loses precision and excessive-input returns retain the altered byte', () => {
  const values = [-1000, -100, -32, 32, 100, 1000];
  const lines = values.map(value => [t('Print'), fn('Sin', n(value)), t(','), fn('Cos', n(value))]);
  const { logs } = execute(binary(lines));
  values.forEach((value, i) => {
    const tolerance = Math.max(1e-6, Math.pow(2, Math.floor(Math.log2(Math.abs(value))) - 23));
    close(logs[i][0], Math.sin(value), tolerance);
    close(logs[i][1], Math.cos(value), tolerance);
  });
  for (const name of ['Sin', 'Cos', 'Tan']) {
    const { logs: large } = execute(binary([1048576, -1048576, 1073741824].map(value => [t('Print'), fn(name, n(value))])));
    assert.deepStrictEqual(large, [[-Math.pow(2, -23)], [-Math.pow(2, -23)], [-0.125]]);
  }
});

test('trigonometry: float results and read-time angle modes survive arrays, DATA and procedure returns', () => {
  const array = [id('a', 6, 0x41), t('('), n(0), t(')')];
  const lines = [[t('Data'), w(0), fn('Sin', n(30))], [t('Dim'), array], [t('Degree')],
    [array, t('='), fn('Cos', n(0))], [t('Read'), id('x', 6, 1)],
    [t('Procedure'), dword(0), w(0), 0, 0, id('p')],
    [t('End Proc'), t('['), fn('Tan', n(45)), t(']')], [id('p', 0x12)],
    [t('Print'), array, t(','), id('x', 6, 1), t(','), t('Param#')],
    [t('Print'), array, t('/'), n(2), t(','), t('Param#'), t('/'), n(2)]];
  const { logs } = execute(binary(lines));
  assert.strictEqual(logs[0][0], 1);
  close(logs[0][1], 0.5);
  close(logs[0][2], 1);
  close(logs[1][0], 0.5);
  close(logs[1][1], 0.5);
});

test('trigonometry: original angle/function bytes and invalid arguments have source diagnostics', () => {
  const lines = [[w(0x6ca)], [t('Print'), w(0x70c), t('('), n(90), t(')')],
    [t('Print'), w(0x716), t('('), n(0), t(')')], [w(0x6be)], [t('Print'), w(0x702), t('('), n(0), t(')')]];
  assert.deepStrictEqual(execute(binary(lines)).logs, [[0], [0], [0]]);
  for (const name of ['Sin', 'Cos', 'Tan']) {
    assert.throws(() => new Transpiler(binary([[t('Print'), fn(name, text('angle'))]])), /Wrong argument type.*line 1/);
  }
  assert.throws(() => new Transpiler(binary([[t('Degree'), n(1)]])), /Expected end of statement.*line 1/);
});
