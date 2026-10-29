/* jshint esversion: 6 */
'use strict';

const operationsFactory = typeof module === 'object' && module.exports
  ? require('./operations') : globalThis.AMOS_OPERATIONS;

// Minimal, test-friendly codegen driver
// Usage: const prog = createProgram(cases, { setTimeout, vblHz, sleepScale });
// - cases: Array of functions(state) returning optional control object:
//   { yield: true } | { sleepVbl: n } | { goto: ip } | { halt: true }

function createProgram(cases, options = {}, blocks = null) {
  const optimization = { blocksExecuted: 0, instructionsBatched: 0 };
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
    editRequest: null,
    column: 0,
    input: { keys: [], scanCode: 0, rawKeys: new Uint8Array(128), mouse: { x: 0, y: 0, buttons: 0 }, mouseClick: 0, mouseLimits: null, joysticks: [0, 0] },
  };

  let lastMaxSteps = 1000;
  let scheduled = null;
  let paletteWake = null;
  let trackerWake = null;
  let musicWake = null;
  let sleepRemaining = 0;
  let pendingEdit = null;
  const keys = state.input.keys;
  const inputResetListeners = new Set();
  function clearScanCodes() {
    state.input.scanCode = 0;
    for (let i = 0; i < keys.length; i++) if (keys[i] && typeof keys[i] === 'object') keys[i] = keys[i].key;
  }
  function resetInput(reason = 'lifecycle') {
    if (reason !== 'key-speed') { state.input.joysticks.fill(0); clearScanCodes(); clearKeyStates(); clearMouseButtons(); }
    for (const listener of Array.from(inputResetListeners)) {
      try { listener(reason); } catch (_) { /* cleanup must preserve source failures */ }
    }
  }
  function clearMouseButtons() {
    state.input.mouse.buttons = 0;
    state.input.mouseClick = 0;
  }
  function clearKeyStates() { state.input.rawKeys.fill(0); }
  function setKeyState(code, down) {
    if (!Number.isInteger(code) || code < 0 || code > 127 || typeof down !== 'boolean') throw new Error('Invalid raw key state');
    state.input.rawKeys[code] = down ? 1 : 0;
  }
  function silenceAfterFailure() {
    // A failing host must not replace the original source-context error.
    cancelTrackerWake(); cancelMusicWake();
    operations.cancelAmal();
    try { operations.cancelMusic(); } catch (_) { /* best-effort cleanup */ }
    try { operations.trackStop(); } catch (_) { /* best-effort cleanup */ }
    try { operations.audio.silence(); } catch (_) { /* best-effort cleanup */ }
    try { operations.closePorts(); } catch (_) { /* Consume terminal port handles once. */ }
  }

  function cancelScheduled() {
    if (!scheduled) return;
    const previous = scheduled;
    scheduled = null;
    if (timing.clearTimeout && previous.id != null) timing.clearTimeout.call(globalThis, previous.id);
  }
  function cancelPaletteWake() {
    if (!paletteWake) return;
    const task = paletteWake; paletteWake = null;
    if (timing.clearTimeout && task.id != null) {
      try { timing.clearTimeout.call(globalThis, task.id); }
      catch (_) { /* The invalidated ownership token still makes the wake inert. */ }
    }
  }
  function failPalette(error, location) {
    state.halted = true; state.waiting = null;
    try { cancelScheduled(); } catch (_) { /* Keep the original asynchronous failure. */ }
    cancelPaletteWake(); operations.cancelPaletteEffects();
    resetInput(); silenceAfterFailure();
    if (location && !error.message.includes(' at line ')) error.message += ` at line ${location.line}, byte ${location.offset}`;
    throw error;
  }
  function requestPaletteWake() {
    cancelPaletteWake();
    if (state.halted || state.stopped) return;
    const frame = operations.nextPaletteVbl();
    if (frame == null) return;
    const delay = Math.max(0.001, timerEpoch + frame * 1000 / timing.vblHz - timing.now());
    const task = { id: null }; paletteWake = task;
    task.id = timing.setTimeout.call(globalThis, () => {
      if (paletteWake !== task) return;
      paletteWake = null;
      if (state.halted || state.stopped) return;
      const location = operations.paletteLocation();
      try {
        operations.advancePalette(vblCount());
        if (!paletteWake) requestPaletteWake();
      } catch (error) { failPalette(error, location); }
    }, delay);
  }
  function cancelTrackerWake() {
    if (!trackerWake) return;
    const task = trackerWake; trackerWake = null;
    if (timing.clearTimeout && task.id != null) {
      try { timing.clearTimeout.call(globalThis, task.id); }
      catch (_) { /* invalidated ownership makes late callbacks inert */ }
    }
  }
  function requestTrackerWake() {
    cancelTrackerWake();
    if (state.halted || state.stopped) return;
    const field = operations.nextTrackerVbl();
    if (field == null) return;
    const task = { id: null }; trackerWake = task;
    task.id = timing.setTimeout.call(globalThis, () => {
      if (trackerWake !== task) return;
      trackerWake = null;
      if (state.halted || state.stopped) return;
      const location = operations.trackerLocation();
      try { operations.advanceTracker(vblCount()); requestTrackerWake(); }
      catch (error) { failPalette(error, location); }
    }, Math.max(0.001, timerEpoch + field * 1000 / timing.vblHz - timing.now()));
  }

  function cancelMusicWake() {
    if (!musicWake) return;
    const task = musicWake; musicWake = null;
    if (timing.clearTimeout && task.id != null) {
      try { timing.clearTimeout.call(globalThis, task.id); }
      catch (_) { /* invalidated ownership makes late callbacks inert */ }
    }
  }
  function requestMusicWake() {
    cancelMusicWake();
    if (state.halted || state.stopped) return;
    const field = operations.nextMusicVbl();
    if (field == null) return;
    const task = { id: null }; musicWake = task;
    task.id = timing.setTimeout.call(globalThis, () => {
      if (musicWake !== task) return;
      musicWake = null;
      if (state.halted || state.stopped) return;
      const location = operations.musicLocation();
      try { operations.advanceMusic(vblCount()); requestMusicWake(); }
      catch (error) { failPalette(error, location); }
    }, Math.max(0.001, timerEpoch + field * 1000 / timing.vblHz - timing.now()));
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
    if (operations.nextTrackerVbl() != null) {
      const location = operations.trackerLocation();
      try { operations.advanceTracker(vblCount()); }
      catch (error) { failPalette(error, location); }
    }
    if (operations.nextMusicVbl() != null) {
      const location = operations.musicLocation();
      try { operations.advanceMusic(vblCount()); }
      catch (error) { failPalette(error, location); }
    }
    if (operations.nextPaletteVbl() != null) {
      const location = operations.paletteLocation();
      try { operations.advancePalette(vblCount()); }
      catch (error) { failPalette(error, location); }
    }
    try {
      res = fn(state) || {};
    } catch (error) {
      state.halted = true;
      cancelScheduled();
      if (state.location && !error.message.includes(' at line ')) error.message += ` at line ${state.location.line}, byte ${state.location.offset}`;
      throw error;
    }
    state.ticks++;
    if (res.edit) {
      state.editRequest = Object.freeze({ command: 'Edit', location: state.location ? Object.freeze({ ...state.location }) : null });
      pendingEdit = state.editRequest;
      state.halted = true;
      state.waiting = null;
      return { done: true };
    }

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
      if (frame && res.discardGosubs && state.stack.length >= frame.stackDepth) state.stack.length = frame.stackDepth;
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
        const block = blocks && blocks[state.ip];
        // Preserve the original per-instruction clock/host hooks while any
        // asynchronous engine is active. Pure blocks cannot start those engines.
        if (block && block.length <= maxSteps - steps &&
          operations.nextTrackerVbl() == null && operations.nextMusicVbl() == null &&
          operations.nextPaletteVbl() == null) {
          block.run(state);
          steps += block.length;
          optimization.blocksExecuted++;
          optimization.instructionsBatched += block.length;
          continue;
        }
        out = step();
      } catch (error) {
        state.halted = true;
        state.waiting = null;
        cancelScheduled();
        cancelPaletteWake(); operations.cancelPaletteEffects();
        resetInput();
        silenceAfterFailure();
        if (state.location && !error.message.includes(' at line ')) error.message += ` at line ${state.location.line}, byte ${state.location.offset}`;
        throw error;
      }
      steps++;
      if (out.yielded) break;
    }
    try {
      operations.flushBobs();
      if (state.halted) { operations.cancelAmal(); cancelPaletteWake(); operations.cancelPaletteEffects(); operations.trackStop(); operations.cancelMusic(); resetInput(); operations.audio.silence(); operations.closePorts(); }
    } catch (error) {
      pendingEdit = null;
      state.halted = true;
      state.waiting = null;
      cancelScheduled();
      cancelPaletteWake(); operations.cancelPaletteEffects();
      resetInput();
      silenceAfterFailure();
      if (state.location && !error.message.includes(' at line ')) error.message += ` at line ${state.location.line}, byte ${state.location.offset}`;
      throw error;
    }
    // Notify only after terminal cleanup. Consume the request first so a
    // reentrant/throwing host cannot replay it or run old cleanup after a new VM.
    const request = pendingEdit;
    pendingEdit = null;
    if (request && options.system != null) {
      try {
        if (typeof options.system.command !== 'function') throw new Error('System host requires a synchronous command method');
        const result = options.system.command('Edit', request);
        if (result && typeof result.then === 'function') throw new Error('System host commands must complete synchronously');
      } catch (error) {
        const failure = error && typeof error.message === 'string' ? error : new Error(String(error));
        if (request.location && !failure.message.includes(' at line ')) failure.message += ` at line ${request.location.line}, byte ${request.location.offset}`;
        throw failure;
      }
    }
    if (!state.halted && !state.waiting && steps >= maxSteps) scheduleNext(0);
    return { steps, ip: state.ip, halted: state.halted };
  }

  function stop() {
    if (state.waiting === 'sleep' && scheduled) sleepRemaining = Math.max(0, scheduled.due - timing.now());
    state.stopped = true;
    cancelScheduled();
    cancelPaletteWake();
    cancelTrackerWake(); operations.pauseTracker();
    cancelMusicWake(); operations.pauseMusic();
    resetInput();
    operations.audio.silence();
  }

  function resume() {
    if (!state.stopped || state.halted) return;
    state.stopped = false;
    const location = operations.paletteLocation();
    try {
      if (operations.nextPaletteVbl() != null) operations.advancePalette(vblCount());
      requestPaletteWake();
    } catch (error) { failPalette(error, location); }
    try { operations.resumeTracker(); requestTrackerWake(); }
    catch (error) { failPalette(error, operations.trackerLocation()); }
    try { operations.resumeMusic(); requestMusicWake(); }
    catch (error) { failPalette(error, operations.musicLocation()); }
    if (state.waiting === 'sleep') scheduleNext(sleepRemaining);
    else if (!state.waiting) scheduleNext(0);
  }

  function sendKey(key, scanCode = null) {
    if (typeof key !== 'string') throw new Error('Keyboard input must be a string');
    if (scanCode != null && (!Number.isInteger(scanCode) || scanCode < 0 || scanCode > 127 || key.length !== 1 || key.charCodeAt(0) > 255)) throw new Error('Invalid raw keyboard input');
    if (state.halted) return;
    if (state.waiting === 'key') {
      state.waiting = null;
      if (!state.stopped) scheduleNext(0);
    } else keys.push(scanCode == null ? key : { key, scanCode });
  }

  function print(values, separators = []) {
    values = values.map(operations.value);
    state.column = operations.display.screen().x;
    const tabSize = operations.display.screen().tabSize;
    if (!Number.isInteger(tabSize) || tabSize < 1) throw new Error('Invalid tab size');
    let text = '';
    const append = value => {
      text += value;
      state.column = operations.display.outputColumn(text);
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

  const operations = operationsFactory(state, Object.assign({}, options, { resetInput, vblNow: vblCount,
    audioFieldTime: () => (timing.now() - timerEpoch) * timing.vblHz / 1000, audioVblHz: timing.vblHz,
    requestPaletteWake, requestTrackerWake, requestMusicWake }));
  return {
    ...(blocks ? { optimization: Object.freeze({
      get blocksExecuted() { return optimization.blocksExecuted; },
      get instructionsBatched() { return optimization.instructionsBatched; }
    }) } : {}),
    state, tick, stop, resume, sendKey, clearScanCodes, clearKeyStates, setKeyState, clearMouseButtons, print,
    subscribeInputReset(listener) {
      if (typeof listener !== 'function') throw new Error('Input listener must be a function');
      inputResetListeners.add(listener); return () => inputResetListeners.delete(listener);
    },
    timer: () => (timerBase + (vblCount() - timerWrittenAt) % 4294967296) | 0,
    setTimer(value) {
      const number = operations.integer(value), count = vblCount();
      timerBase = number; timerWrittenAt = count;
    },
    setMouse(x, y, buttons = state.input.mouse.buttons) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(buttons) || buttons < 0 || buttons > 7) throw new Error('Invalid mouse state');
      const limits = state.input.mouseLimits;
      if (limits) { x = Math.max(limits.x1, Math.min(limits.x2, x)); y = Math.max(limits.y1, Math.min(limits.y2, y)); }
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
