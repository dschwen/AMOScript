/* jshint esversion: 6 */
'use strict';

function createCanvasHost(canvas, options = {}) {
  if (options.getGamepads != null && typeof options.getGamepads !== 'function') throw new Error('getGamepads must be a function');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D rendering is not available');
  const request = options.requestAnimationFrame || (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : callback => setTimeout(callback, 0));
  const cancel = options.cancelAnimationFrame || (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout);
  const delay = options.setTimeout || setTimeout, clearDelay = options.clearTimeout || clearTimeout;
  let program = null;
  let unsubscribe = null;
  let pending = null;
  let previousCursor = null;
  let unsubscribeInput = null, held = null, repeatTask = null;
  let joystickInput = createJoystickInput(options.joysticks || []), unsubscribeJoystick = null;
  let joystickStatus = [];
  let focusSuspended = false;
  function focused() {
    return options.hasFocus ? options.hasFocus() : !!(!focusSuspended && canvas.ownerDocument && canvas.ownerDocument.activeElement === canvas && !canvas.ownerDocument.hidden);
  }
  function pollJoysticks() {
    if (!program || !joystickInput.ports.length) return [];
    let pads = [], status = 'disabled';
    const active = focused() && !program.state.stopped && !program.state.halted;
    if (active && joystickInput.usesGamepad) {
      try {
        if (options.getGamepads) { pads = options.getGamepads(); status = 'available'; }
        else if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') { pads = navigator.getGamepads(); status = 'available'; }
        else status = 'unavailable';
      } catch (_) { status = 'blocked'; }
    }
    const result = joystickInput.read(active ? pads : [], active ? status : 'inactive', active);
    for (const entry of result) program.setJoystick(entry.port, entry.mask);
    joystickStatus = result;
    return result;
  }
  function resetJoysticks() {
    joystickInput.reset();
    if (program && program.setJoystick) for (const port of joystickInput.ports) program.setJoystick(port, 0);
    joystickStatus = [];
  }
  function bindJoysticks() {
    if (program && program.setJoystickReader && joystickInput.ports.length) unsubscribeJoystick = program.setJoystickReader(port => {
      const entry = pollJoysticks().find(entry => entry.port === port);
      return entry ? entry.mask : null;
    });
  }
  function configureJoysticks(configurations) {
    const next = createJoystickInput(configurations);
    resetJoysticks();
    if (unsubscribeJoystick) unsubscribeJoystick(); unsubscribeJoystick = null;
    joystickInput = next; bindJoysticks();
  }

  function releaseKey() {
    held = null;
    if (repeatTask) { const previous = repeatTask; repeatTask = null; clearDelay(previous.id); }
  }
  function repeatAfter(ms) {
    const task = { id: null }; repeatTask = task;
    task.id = delay(() => {
      if (repeatTask !== task) return;
      repeatTask = null;
      if (!program || !held || program.state.halted || program.state.stopped) { releaseKey(); return; }
      const current = held;
      program.sendKey(current.key);
      if (held === current) repeatAfter(current.config.intervalMs);
    }, ms);
  }

  function render() {
    if (!program) return;
    const display = program.display;
    if (canvas.style && program.mouseVisible) canvas.style.cursor = program.mouseVisible() ? previousCursor || '' : 'none';
    const screen = display.presentedScreen ? display.presentedScreen() : display.current == null ? null : display.screen();
    if (!screen) { canvas.width = 0; canvas.height = 0; return; }
    if (canvas.width !== screen.width) canvas.width = screen.width;
    if (canvas.height !== screen.height) canvas.height = screen.height;
    const frame = context.createImageData(screen.width, screen.height);
    frame.data.set(display.rgba(screen));
    context.putImageData(frame, 0, 0);
  }
  function schedule() {
    if (pending) return;
    const task = { id: null };
    pending = task;
    task.id = request(() => {
      if (pending !== task) return;
      pending = null;
      render();
    });
  }
  function keydown(event) {
    if (!program) return;
    if (event.ctrlKey || event.metaKey || event.altKey) { releaseKey(); resetJoysticks(); return; }
    const joystick = joystickInput.keydown(event.code || (event.key === ' ' ? 'Space' : event.key), !!event.repeat);
    if (joystick.matched && (!focused() || program.state.stopped || program.state.halted)) resetJoysticks();
    if (joystick.matched) { pollJoysticks(); if (joystick.consume) { event.preventDefault(); return; } }
    const key = event.key.length === 1 ? event.key : { Enter: '\r', Escape: '\x1b', Backspace: '\b' }[event.key];
    if (key == null) return;
    event.preventDefault();
    const config = program.state.input.keySpeed;
    if (config && (event.repeat || program.state.halted || program.state.stopped)) return;
    program.sendKey(key);
    if (config) {
      releaseKey(); held = { code: event.code || event.key, key, config };
      repeatAfter(config.delayMs);
    }
  }
  function keyup(event) {
    if (held && held.code === (event.code || event.key)) releaseKey();
    if (joystickInput.keyup(event.code || (event.key === ' ' ? 'Space' : event.key))) pollJoysticks();
  }
  function pointer(event) {
    if (!program) return;
    const screen = program.display.presentedScreen ? program.display.presentedScreen() : program.display.current == null ? null : program.display.screen();
    if (!screen) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const scaleX = canvas.offsetWidth ? bounds.width / canvas.offsetWidth : 1;
    const scaleY = canvas.offsetHeight ? bounds.height / canvas.offsetHeight : 1;
    const width = canvas.clientWidth ? canvas.clientWidth * scaleX : bounds.width;
    const height = canvas.clientHeight ? canvas.clientHeight * scaleY : bounds.height;
    const left = bounds.left + (canvas.clientLeft || 0) * scaleX;
    const top = bounds.top + (canvas.clientTop || 0) * scaleY;
    const x = Math.max(0, Math.min(screen.width - 1, Math.floor((event.clientX - left) * screen.width / width)));
    const y = Math.max(0, Math.min(screen.height - 1, Math.floor((event.clientY - top) * screen.height / height)));
    program.setMouse(x, y, event.buttons & 7);
  }
  function pointerdown(event) {
    if (canvas.focus) canvas.focus();
    if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
    pointer(event);
  }
  function blur() {
    focusSuspended = true;
    releaseKey();
    resetJoysticks();
    if (program) program.setMouse(program.state.input.mouse.x, program.state.input.mouse.y, 0);
  }
  function focus() { focusSuspended = false; }
  function visibility() { if (canvas.ownerDocument.hidden) blur(); }
  const events = { keydown, keyup, pointermove: pointer, pointerdown, pointerup: pointer, blur, focus };

  function detach() {
    releaseKey();
    resetJoysticks();
    if (unsubscribeJoystick) unsubscribeJoystick(); unsubscribeJoystick = null;
    if (unsubscribeInput) unsubscribeInput();
    unsubscribeInput = null;
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    if (pending) { cancel(pending.id); pending = null; }
    for (const [name, listener] of Object.entries(events)) canvas.removeEventListener(name, listener);
    if (canvas.ownerDocument) {
      canvas.ownerDocument.removeEventListener('visibilitychange', visibility);
      if (canvas.ownerDocument.defaultView) {
        canvas.ownerDocument.defaultView.removeEventListener('blur', blur);
        canvas.ownerDocument.defaultView.removeEventListener('focus', focus);
      }
    }
    program = null;
    if (canvas.style && previousCursor != null) canvas.style.cursor = previousCursor;
    previousCursor = null;
  }
  function attach(next) {
    detach();
    program = next;
    if (program.subscribeInputReset) unsubscribeInput = program.subscribeInputReset(reason => {
      releaseKey(); if (reason !== 'key-speed') resetJoysticks();
    });
    bindJoysticks();
    if (canvas.style) previousCursor = canvas.style.cursor;
    unsubscribe = program.display.subscribe(schedule);
    for (const [name, listener] of Object.entries(events)) canvas.addEventListener(name, listener);
    if (canvas.ownerDocument) {
      canvas.ownerDocument.addEventListener('visibilitychange', visibility);
      if (canvas.ownerDocument.defaultView) {
        canvas.ownerDocument.defaultView.addEventListener('blur', blur);
        canvas.ownerDocument.defaultView.addEventListener('focus', focus);
      }
    }
    render();
  }
  return { attach, detach, render, focus: () => canvas.focus(), configureJoysticks, pollJoysticks,
    joystickStatus: () => joystickStatus.map(entry => ({ ...entry })) };
}

function createJoystickInput(configurations) {
  if (!Array.isArray(configurations) || configurations.length > 2) throw new Error('Expected at most two joystick configurations');
  const ports = new Set(), keys = new Set();
  const defaults = { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], fire: ['Space', 'Enter'] };
  const bits = { up: 1, down: 2, left: 4, right: 8, fire: 16 };
  const configs = configurations.map(config => {
    if (!config || !Number.isInteger(config.port) || config.port < 0 || config.port > 1 || ports.has(config.port)) throw new Error('Invalid or duplicate joystick port');
    ports.add(config.port);
    const keyboard = [];
    if (config.keyboard) {
      if (config.keyboard !== true && (typeof config.keyboard !== 'object' || Array.isArray(config.keyboard))) throw new Error('Invalid keyboard mapping');
      for (const action of Object.keys(bits)) {
        const supplied = config.keyboard === true || config.keyboard[action] == null ? defaults[action] : config.keyboard[action];
        const codes = typeof supplied === 'string' ? [supplied] : supplied;
        if (!Array.isArray(codes) || codes.some(code => typeof code !== 'string' || !code)) throw new Error('Invalid joystick key binding');
        for (const code of codes) keyboard.push({ code, bit: bits[action] });
      }
    }
    let gamepad = null;
    if (config.gamepad) {
      if (config.gamepad !== true && (typeof config.gamepad !== 'object' || Array.isArray(config.gamepad))) throw new Error('Invalid gamepad mapping');
      const supplied = config.gamepad === true ? {} : config.gamepad;
      if ([supplied.axes,supplied.buttons].some(value => value != null && (typeof value !== 'object' || Array.isArray(value)))) throw new Error('Gamepad axes/buttons must be binding objects');
      const index = supplied.index == null ? 0 : supplied.index, deadZone = supplied.deadZone == null ? 0.25 : supplied.deadZone;
      const axes = { x: 0, y: 1, ...supplied.axes }, buttons = { up: 12, down: 13, left: 14, right: 15, fire: 0, ...supplied.buttons };
      if (!Number.isSafeInteger(index) || index < 0 || !Number.isFinite(deadZone) || deadZone < 0 || deadZone >= 1 ||
          [...Object.values(axes), ...Object.values(buttons)].some(value => value !== null && (!Number.isSafeInteger(value) || value < 0))) throw new Error('Invalid gamepad index, dead zone or binding');
      gamepad = { index, deadZone, axes, buttons, standardOnly: supplied.standardOnly !== false };
    }
    return { port: config.port, keyboard, consume: config.keyboard === true || !config.keyboard || config.keyboard.consume !== false, gamepad };
  });
  function match(code) { return configs.some(config => config.keyboard.some(binding => binding.code === code)); }
  return { ports: [...ports], usesGamepad: configs.some(config => config.gamepad),
    keydown(code, repeat = false) {
      const matching = configs.filter(config => config.keyboard.some(binding => binding.code === code));
      if (matching.length && !repeat) keys.add(code);
      return { matched: !!matching.length, consume: matching.some(config => config.consume) };
    },
    keyup(code) { keys.delete(code); return match(code); },
    reset() { keys.clear(); },
    read(pads, apiStatus = 'available', active = true) {
      return configs.map(config => {
        let keyboard = 0, gamepad = 0, status = config.gamepad ? apiStatus : 'disabled';
        if (active) for (const binding of config.keyboard) if (keys.has(binding.code)) keyboard |= binding.bit;
        const spec = config.gamepad, pad = active && spec && pads && pads[spec.index];
        if (spec && active && apiStatus === 'available') {
          status = !pad || pad.connected === false ? 'waiting' : spec.standardOnly && pad.mapping !== 'standard' ? 'unmapped' : 'connected';
          if (status === 'connected') {
            const x = spec.axes.x == null ? 0 : pad.axes && pad.axes[spec.axes.x], y = spec.axes.y == null ? 0 : pad.axes && pad.axes[spec.axes.y];
            if (Number.isFinite(x) && x >= -1 && x <= 1) gamepad |= x < -spec.deadZone ? 4 : x > spec.deadZone ? 8 : 0;
            if (Number.isFinite(y) && y >= -1 && y <= 1) gamepad |= y < -spec.deadZone ? 1 : y > spec.deadZone ? 2 : 0;
            for (const action of Object.keys(bits)) {
              const index = spec.buttons[action];
              if (index != null && pad.buttons && pad.buttons[index] && pad.buttons[index].pressed === true) gamepad |= bits[action];
            }
          }
        }
        let mask = keyboard | gamepad;
        if ((mask & 3) === 3) mask &= ~3;
        if ((mask & 12) === 12) mask &= ~12;
        return { port: config.port, mask, keyboard, gamepad, status };
      });
    } };
}

if (typeof module === 'object' && module.exports) module.exports = { createCanvasHost, createJoystickInput };
else globalThis.AMOS_BROWSER = { createCanvasHost, createJoystickInput };
