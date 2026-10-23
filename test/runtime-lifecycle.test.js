/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const { createProgram } = require('../lib/amos/driver');
const { createFakeTimers } = require('./helpers/fakeTimers');

function make(cases, options = {}) {
  const timers = createFakeTimers();
  const program = createProgram(cases, { setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout, now: timers.now, ...options });
  return { program, timers };
}

test('runtime: self-jumps stay at their target within a bounded step budget', () => {
  const { program, timers } = make([() => ({ goto: 0 })]);
  const result = program.tick(5);
  assert.strictEqual(result.ip, 0);
  assert.strictEqual(result.steps, 5);
  assert.strictEqual(program.state.ticks, 5);
  assert.strictEqual(timers.pending(), 1);
  program.tick(5);
  assert.strictEqual(program.state.ticks, 10);
  assert.strictEqual(timers.pending(), 1);
  program.stop();
  assert.strictEqual(timers.pending(), 0);
  timers.runAll();
  assert.strictEqual(program.state.ticks, 10);
});

test('runtime: stopping and resuming preserves the remaining sleep duration', () => {
  let count = 0;
  const { program, timers } = make([() => ({ sleepVbl: 5 }), () => { count++; return { halt: true }; }]);
  program.tick(10);
  timers.tick(30);
  program.stop();
  timers.tick(500);
  assert.strictEqual(count, 0);
  assert.strictEqual(program.tick(10).steps, 0);
  program.resume();
  timers.tick(69);
  assert.strictEqual(count, 0);
  timers.tick(1);
  assert.strictEqual(count, 1);
  assert.strictEqual(program.state.halted, true);
  assert.strictEqual(timers.pending(), 0);
});

test('runtime: stale callbacks are ignored without a matching clearTimeout', () => {
  const queue = [];
  const program = createProgram([() => ({ goto: 0 })], { setTimeout: callback => queue.push(callback), clearTimeout() {} });
  program.tick(1);
  program.tick(1);
  program.stop();
  queue.forEach(callback => callback());
  assert.strictEqual(program.state.ticks, 2);
});

test('runtime: errors halt execution and invalid options are rejected', () => {
  const { program, timers } = make([() => { throw new Error('failed operation'); }]);
  assert.throws(() => program.tick(5), /failed operation/);
  assert.strictEqual(program.state.halted, true);
  assert.strictEqual(timers.pending(), 0);
  assert.throws(() => program.tick(0), /Step budget/);
  assert.throws(() => make([], { vblHz: -1 }), /timing/);
  assert.throws(() => make([], { sleepScale: -1 }), /timing/);
});
