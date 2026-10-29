'use strict';
const assert = require('assert');
const Transpiler = require('../lib/Transpiler');
const { binary, token: t, integer: n, identifier: id, word: w } = require('./helpers/tokens');
const { createFakeTimers } = require('./helpers/fakeTimers');
const source = binary([[t('Do'), w(0)], [id('a'), t('='), id('a'), t('+'), n(1)], [t('Wait Vbl')], [t('Loop')]]);
function create(options, optimize = false) {
  const compiled = { exports: {} }; new Function('module', new Transpiler(source).toModule({ optimize }))(compiled);
  return compiled.exports(options);
}
test('runtime pacing: emitted factories scale VBL waits under PAL/NTSC without changing the Timer clock or instruction budgets', () => {
  for (const vblHz of [50, 60]) for (const optimize of [false, true]) {
    const clock = createFakeTimers(), p = create({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, vblHz, sleepScale: 3 }, optimize);
    p.tick(1000); assert.strictEqual(p.state.variables.int_a, 1);
    clock.tick(1000 / vblHz * 3 - 0.01); assert.strictEqual(p.state.variables.int_a, 1);
    clock.tick(0.02); assert.strictEqual(p.state.variables.int_a, 2);
    assert.strictEqual(p.timer(), 3); assert.strictEqual(p.sleepScale(), 3);
    p.stop(); assert.strictEqual(clock.pending(), 0);
  }
});
test('runtime pacing: changes apply to future waits; Stop/Resume preserves the outstanding deadline and rejects invalid scales atomically', () => {
  const clock = createFakeTimers(), p = create({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, sleepScale: 2 });
  p.tick(1000); clock.tick(10); p.setSleepScale(4);
  for (const value of [-1, NaN, Infinity, '2', null]) assert.throws(() => p.setSleepScale(value), /sleep scale/);
  assert.strictEqual(p.sleepScale(), 4); clock.tick(29); assert.strictEqual(p.state.variables.int_a, 1);
  clock.tick(1); assert.strictEqual(p.state.variables.int_a, 2); // The old 40ms deadline survives.
  clock.tick(10); p.stop(); clock.tick(1000); assert.strictEqual(p.state.variables.int_a, 2);
  assert.strictEqual(p.timer(), 52); // Stop and slowdown leave real elapsed VBLs intact.
  p.resume(); clock.tick(69); assert.strictEqual(p.state.variables.int_a, 2);
  clock.tick(1); assert.strictEqual(p.state.variables.int_a, 3); // Remaining 70ms, no catch-up burst.
  p.setSleepScale(1); clock.tick(79); assert.strictEqual(p.state.variables.int_a, 3);
  clock.tick(1); assert.strictEqual(p.state.variables.int_a, 4);
  clock.tick(20); assert.strictEqual(p.state.variables.int_a, 5); p.stop(); assert.strictEqual(clock.pending(), 0);
});
