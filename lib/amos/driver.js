/* jshint esversion: 6 */
'use strict';

const operationsFactory = typeof module === 'object' && module.exports
  ? require('./operations') : globalThis.AMOS_OPERATIONS;

// Minimal, test-friendly codegen driver
// Usage: const prog = createProgram(cases, { setTimeout, vblHz, sleepScale });
// - cases: Array of functions(state) returning optional control object:
//   { yield: true } | { sleepVbl: n } | { goto: ip } | { halt: true }

function createProgram(cases, options = {}) {
  const timing = {
    setTimeout: options.setTimeout || (typeof setTimeout !== 'undefined' ? setTimeout : null),
    clearTimeout: options.clearTimeout || (typeof clearTimeout !== 'undefined' ? clearTimeout : null),
    now: options.now || (() => Date.now()),
    vblHz: options.vblHz == null ? 50 : options.vblHz,
    sleepScale: options.sleepScale == null ? 1 : options.sleepScale
  };

  if (!timing.setTimeout) throw new Error('setTimeout not available: provide via options');
  if (!(timing.vblHz > 0) || !Number.isFinite(timing.vblHz) || timing.sleepScale < 0 || !Number.isFinite(timing.sleepScale)) {
    throw new Error('Invalid runtime timing options');
  }

  // TIMER is a VBL counter, not an instruction counter. Assigning it preserves
  // the field phase, and Stop suspends execution without stopping the clock.
  const timerEpoch = timing.now();
  if (!Number.isFinite(timerEpoch)) throw new Error('Invalid runtime clock');
  let timerBase = 0, timerWrittenAt = 0;
  function vblCount() {
    const count = Math.floor((timing.now() - timerEpoch) * timing.vblHz / 1000);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid runtime clock');
    return count;
  }

  const state = {
    ip: 0,
    halted: false,
    ticks: 0,
    user: Object.create(null),
    stack: [],
    frames: [],
    locals: Object.create(null),
    param: { integer: 0, float: 0, string: '' },
    data: { entries: [], index: 0 },
    stopped: false,
    waiting: null,
    location: null,
    column: 0,
    input: { keys: [], mouse: { x: 0, y: 0, buttons: 0 } },
  };

  let lastMaxSteps = 1000;
  let scheduled = null;
  let sleepRemaining = 0;
  const keys = state.input.keys;

  function cancelScheduled() {
    if (!scheduled) return;
    const previous = scheduled;
    scheduled = null;
    if (timing.clearTimeout && previous.id != null) timing.clearTimeout.call(globalThis, previous.id);
  }

  function scheduleNext(delayMs) {
    if (scheduled || state.halted || state.stopped) return;
    const task = { due: timing.now() + delayMs, id: null };
    scheduled = task;
    task.id = timing.setTimeout.call(globalThis, () => {
      if (scheduled !== task) return;
      scheduled = null;
      if (state.waiting === 'sleep') state.waiting = null;
      tick(lastMaxSteps);
    }, Math.max(0, delayMs));
  }

  function step() {
    if (state.halted) return { done: true };
    const fn = cases[state.ip];
    if (!fn) { state.halted = true; return { done: true }; }

    const ipBefore = state.ip;
    let res;
    try {
      res = fn(state) || {};
    } catch (error) {
      state.halted = true;
      cancelScheduled();
      if (state.location) error.message += ` at line ${state.location.line}, byte ${state.location.offset}`;
      throw error;
    }
    state.ticks++;

    if (res.goto != null) state.ip = res.goto;
    if (res.call != null) { state.stack.push(ipBefore + 1); state.ip = res.call; }
    if (res.ret) {
      const procedure = state.frames[state.frames.length - 1];
      if (procedure && state.stack.length <= procedure.stackDepth) throw new Error('Return without Gosub in procedure');
      const retIp = state.stack.pop();
      if (retIp == null) { state.halted = true; throw new Error('Return without Gosub'); }
      state.ip = retIp;
    }
    if (res.procCall != null) {
      state.frames.push({ ip: ipBefore + 1, locals: state.locals, data: state.data, stackDepth: state.stack.length });
      state.locals = Object.assign(Object.create(null), res.defaults);
      state.data = { entries: res.data || [], index: 0 };
      res.parameters.forEach((name, i) => { state.locals[name] = res.args[i]; });
      state.ip = res.procCall;
    }
    if (res.procReturn) {
      const frame = state.frames.pop();
      if (!frame || frame.stackDepth !== state.stack.length) { state.halted = true; throw new Error('Invalid procedure return'); }
      state.locals = frame.locals;
      state.data = frame.data;
      if (res.resultType === 'dynamic') state.param[res.result.numericType] = res.result.value;
      else if (res.resultType) state.param[res.resultType] = res.result;
      state.ip = frame.ip;
    }
    // default fallthrough if case didn't change ip
    if (state.ip === ipBefore && res.goto == null && res.call == null && res.procCall == null && !res.procReturn && !res.ret && !res.halt) state.ip = ipBefore + 1;

    if (res.halt) { state.halted = true; return { done: true }; }
    if (res.yield) { scheduleNext(0); return { yielded: true }; }
    if (res.sleepVbl != null) {
      const delay = (1000 / timing.vblHz) * res.sleepVbl * timing.sleepScale;
      if (!Number.isFinite(delay) || delay < 0) { state.halted = true; throw new Error('Invalid wait duration'); }
      state.waiting = 'sleep';
      scheduleNext(delay);
      return { yielded: true };
    }
    if (res.waitKey) {
      if (keys.length) keys.shift();
      else { state.waiting = 'key'; return { yielded: true }; }
    }
    return { done: false };
  }

  function tick(maxSteps = 1000) {
    if (!Number.isInteger(maxSteps) || maxSteps <= 0) throw new Error('Step budget must be a positive integer');
    lastMaxSteps = maxSteps;
    if (state.stopped || state.waiting || state.halted) return { steps: 0, ip: state.ip, halted: state.halted };
    cancelScheduled();
    let steps = 0;
    while (steps < maxSteps && !state.halted) {
      let out;
      try {
        out = step();
      } catch (error) {
        state.halted = true;
        state.waiting = null;
        cancelScheduled();
        if (state.location && !error.message.includes(' at line ')) error.message += ` at line ${state.location.line}, byte ${state.location.offset}`;
        throw error;
      }
      steps++;
      if (out.yielded) break;
    }
    try {
      operations.flushBobs();
    } catch (error) {
      state.halted = true;
      state.waiting = null;
      cancelScheduled();
      if (state.location && !error.message.includes(' at line ')) error.message += ` at line ${state.location.line}, byte ${state.location.offset}`;
      throw error;
    }
    if (!state.halted && !state.waiting && steps >= maxSteps) scheduleNext(0);
    return { steps, ip: state.ip, halted: state.halted };
  }

  function stop() {
    if (state.waiting === 'sleep' && scheduled) sleepRemaining = Math.max(0, scheduled.due - timing.now());
    state.stopped = true;
    cancelScheduled();
  }

  function resume() {
    if (!state.stopped || state.halted) return;
    state.stopped = false;
    if (state.waiting === 'sleep') scheduleNext(sleepRemaining);
    else if (!state.waiting) scheduleNext(0);
  }

  function sendKey(key) {
    if (state.halted) return;
    if (state.waiting === 'key') {
      state.waiting = null;
      if (!state.stopped) scheduleNext(0);
    } else keys.push(key);
  }

  function print(values, separators = []) {
    values = values.map(operations.value);
    state.column = operations.display.screen().x;
    const tabSize = operations.display.screen().tabSize;
    if (!Number.isInteger(tabSize) || tabSize < 1) throw new Error('Invalid tab size');
    let text = '';
    const append = value => {
      text += value;
      const lastNewline = value.lastIndexOf('\n');
      state.column = lastNewline < 0 ? state.column + value.length : value.length - lastNewline - 1;
    };
    values.forEach((value, i) => {
      append(String(value));
      if (separators[i] === ',') append(' '.repeat(tabSize - state.column % tabSize));
    });
    if (!values.length || separators.length < values.length) append('\n');
    operations.display.write(text);
    if (options.write) options.write(text);
    else (options.print || ((...args) => console.log(...args)))(...values);
  }

  const operations = operationsFactory(state, options);
  return {
    state, tick, stop, resume, sendKey, print,
    timer: () => (timerBase + (vblCount() - timerWrittenAt) % 4294967296) | 0,
    setTimer(value) {
      const number = operations.integer(value), count = vblCount();
      timerBase = number; timerWrittenAt = count;
    },
    setMouse(x, y, buttons = state.input.mouse.buttons) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(buttons) || buttons < 0 || buttons > 7) throw new Error('Invalid mouse state');
      state.input.mouse = { x, y, buttons };
    },
    ...operations
  };
}

// UMD-style export for Node and Browser
if (typeof module === 'object' && module.exports) {
  module.exports = { createProgram };
} else if (typeof window !== 'undefined') {
  window.AMOS_DRIVER = window.AMOS_DRIVER || {};
  window.AMOS_DRIVER.createProgram = createProgram;
}
