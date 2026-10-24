/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const { binary, token: t, integer: n, word: w, text, compile, execute } = require('./helpers/program');

test('Key Speed: source timing uses fixed 50 Hz units with isolated, frozen configuration', () => {
  const { create } = compile(binary([[w(0x11c6), n(10), t(','), n(2)], [t('Wait Key')]]));
  const options = { now: () => 0, setTimeout: () => 1, clearTimeout() {}, vblHz: 60 };
  const a = create(options), b = create(options); a.tick(100);
  assert.deepStrictEqual({ ...a.state.input.keySpeed }, { delay: 10, interval: 2, delayMs: 200, intervalMs: 40 });
  assert.ok(Object.isFrozen(a.state.input.keySpeed)); assert.strictEqual(b.state.input.keySpeed, undefined);
  a.keySpeed(0, 1); assert.strictEqual(a.state.input.keySpeed.delayMs, 0);
});

test('Key Speed: changing timing, Stop, termination and failures notify input reset subscribers', () => {
  const { create } = compile(binary([[t('Key Speed'), n(10), t(','), n(2)], [t('Wait Key')], [t('Return')]]));
  const p = create({ now: () => 0, setTimeout: () => 1, clearTimeout() {} });
  let resets = 0; const unsubscribe = p.subscribeInputReset(() => { resets++; });
  p.tick(100); assert.strictEqual(resets, 1);
  p.stop(); assert.strictEqual(resets, 2);
  p.resume(); p.sendKey('x'); assert.throws(() => p.tick(100), /Return without Gosub/);
  assert.strictEqual(resets, 3); unsubscribe(); p.stop(); assert.strictEqual(resets, 3);
});

test('Key Speed: negative, zero-period, large and string forms reject explicitly with source locations', () => {
  for (const [delay, period] of [[-1, 2], [1, -1], [1, 0], [32768, 1], [1, 32768]]) {
    assert.throws(() => execute(binary([[t('Key Speed'), n(delay), t(','), n(period)]])), /Key Speed.*at line 1, byte 22/);
  }
  assert.throws(() => compile(binary([[t('Key Speed'), text('10'), t(','), n(2)]])), /numeric|number/i);
});
