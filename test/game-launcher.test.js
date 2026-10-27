/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), vm = require('vm');
const { createFakeTimers } = require('./helpers/fakeTimers');

test('game launch: gesture APIs run synchronously, cancellation releases startup input and disposal prevents stale continuation', async () => {
  const clock = createFakeTimers(), calls = [];
  const make = vm.runInNewContext(`(${require('../tools/gameLauncher').toString()})`, { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, performance: { now: clock.now }, Promise });
  let ready = false;
  const launcher = make({
    sound: { enable() { calls.push('sound'); return Promise.resolve(false); } },
    fullscreen: { status: () => ({ active: false }), toggle() { calls.push('fullscreen'); return Promise.resolve(false); } },
    prepare() { calls.push('prepare'); }, release() { calls.push('release'); }, focus() { calls.push('focus'); }, update() {},
    step() { calls.push('step'); return ready; }, fail(error) { throw error; }
  });
  const launching = launcher.play();
  assert.deepStrictEqual(calls, ['release', 'prepare', 'sound', 'fullscreen', 'focus']);
  await launching; clock.tick(20); assert.strictEqual(calls.filter(call => call === 'step').length, 1);
  launcher.cancel(); const cancelled = calls.length; clock.tick(1000);
  assert.strictEqual(calls.length, cancelled); assert.strictEqual(calls.at(-1), 'release');
  ready = true; await launcher.play(); clock.tick(20); assert.strictEqual(clock.pending(), 0);
  launcher.dispose(); const disposed = calls.length; await launcher.play(); clock.tick(20000);
  assert.strictEqual(calls.length, disposed); assert.strictEqual(clock.pending(), 0);
});
