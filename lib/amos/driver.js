/* jshint esversion: 6 */
'use strict';

// Minimal, test-friendly codegen driver
// Usage: const prog = createProgram(cases, { setTimeout, vblHz, sleepScale });
// - cases: Array of functions(state) returning optional control object:
//   { yield: true } | { sleepVbl: n } | { goto: ip } | { halt: true }

function createProgram(cases, options = {}) {
  const timing = {
    setTimeout: options.setTimeout || (typeof setTimeout !== 'undefined' ? setTimeout : null),
    vblHz: options.vblHz || 50,
    sleepScale: options.sleepScale == null ? 1 : options.sleepScale
  };

  if (!timing.setTimeout) throw new Error('setTimeout not available: provide via options');

  const state = {
    ip: 0,
    halted: false,
    ticks: 0,
    user: Object.create(null),
    stack: [],
  };

  let lastMaxSteps = 1000;

  function scheduleNext(delayMs) {
    timing.setTimeout(() => tick(lastMaxSteps), Math.max(0, delayMs | 0));
  }

  function step() {
    if (state.halted) return { done: true };
    const fn = cases[state.ip];
    if (!fn) { state.halted = true; return { done: true }; }

    const ipBefore = state.ip;
    const res = fn(state) || {};
    state.ticks++;

    if (res.goto != null) state.ip = res.goto;
    if (res.call != null) { state.stack.push(ipBefore + 1); state.ip = res.call; }
    if (res.ret) { const retIp = state.stack.pop(); state.ip = (retIp == null ? ipBefore + 1 : retIp); }
    // default fallthrough if case didn't change ip
    if (state.ip === ipBefore && !res.halt) state.ip = ipBefore + 1;

    if (res.halt) { state.halted = true; return { done: true }; }
    if (res.yield) { scheduleNext(0); return { yielded: true }; }
    if (res.sleepVbl != null) {
      const delay = (1000 / timing.vblHz) * res.sleepVbl * timing.sleepScale;
      scheduleNext(delay);
      return { yielded: true };
    }
    return { done: false };
  }

  function tick(maxSteps = 1000) {
    lastMaxSteps = maxSteps;
    let steps = 0;
    while (steps < maxSteps && !state.halted) {
      const out = step();
      steps++;
      if (out.yielded) break;
    }
    if (!state.halted && steps >= maxSteps) scheduleNext(0);
    return { steps, ip: state.ip, halted: state.halted };
  }

  return { state, tick };
}

// UMD-style export for Node and Browser
if (typeof module === 'object' && module.exports) {
  module.exports = { createProgram };
} else if (typeof window !== 'undefined') {
  window.AMOS_DRIVER = window.AMOS_DRIVER || {};
  window.AMOS_DRIVER.createProgram = createProgram;
}
