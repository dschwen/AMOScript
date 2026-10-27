/* jshint esversion: 6 */
'use strict';

function createCanvasHost(canvas, options = {}) {
  const mouseCoordinates = options.mouseCoordinates == null ? 'screen' : options.mouseCoordinates;
  if (mouseCoordinates !== 'screen' && mouseCoordinates !== 'hardware') throw new Error('Invalid mouse coordinate mode');
  if (options.getGamepads != null && typeof options.getGamepads !== 'function') throw new Error('getGamepads must be a function');
  let touchOptions = null;
  if (options.virtualJoystick != null && options.virtualJoystick !== false) {
    const config = options.virtualJoystick;
    if (!config || typeof config !== 'object' || !config.container || typeof config.container.append !== 'function' ||
        (config.port != null && ![0, 1].includes(config.port)) ||
        (config.visibility != null && !['auto', 'always', 'off'].includes(config.visibility)) ||
        (config.fullscreenOnly != null && typeof config.fullscreenOnly !== 'boolean')) throw new Error('Invalid virtual joystick configuration');
    touchOptions = { ...config, port: config.port == null ? 1 : config.port };
  }
  function withTouch(configurations) {
    if (!Array.isArray(configurations)) return configurations;
    return touchOptions && !configurations.some(config => config && config.port === touchOptions.port) ? [...configurations, { port: touchOptions.port }] : configurations;
  }
  const renderer = options.renderer || null;
  if (renderer && ['render','present','clear'].some(name => typeof renderer[name] !== 'function')) throw new Error('Invalid display renderer');
  const context = renderer ? null : canvas.getContext('2d');
  if (!renderer && !context) throw new Error('Canvas 2D rendering is not available');
  const request = options.requestAnimationFrame || (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : callback => setTimeout(callback, 0));
  const cancel = options.cancelAnimationFrame || (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout);
  const delay = options.setTimeout || setTimeout, clearDelay = options.clearTimeout || clearTimeout;
  let program = null;
  let unsubscribe = null;
  let pending = null;
  let previousCursor = null;
  let unsubscribeInput = null, held = null, repeatTask = null;
  let joystickInput = createJoystickInput(withTouch(options.joysticks || [])), unsubscribeJoystick = null;
  let joystickStatus = [], touch = null;
  let focusSuspended = false;
  const rawHeld = new Map();
  function releaseRawKeys() {
    if (program && program.setKeyState) for (const scan of rawHeld.values()) program.setKeyState(scan, false);
    rawHeld.clear();
  }
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
    if (touch) for (const entry of result) if (entry.port === touchOptions.port) {
      entry.virtual = active ? touch.mask() : 0;
      entry.mask = entry.keyboard | entry.gamepad | entry.virtual;
      if ((entry.mask & 3) === 3) entry.mask &= ~3;
      if ((entry.mask & 12) === 12) entry.mask &= ~12;
    }
    for (const entry of result) program.setJoystick(entry.port, entry.mask);
    joystickStatus = result;
    return result;
  }
  function resetJoysticks() {
    joystickInput.reset(); if (touch) touch.reset(false);
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
    const next = createJoystickInput(withTouch(configurations));
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
      program.sendKey(current.key, current.scanCode);
      if (held === current) repeatAfter(current.config.intervalMs);
    }, ms);
  }

  function render() {
    if (!program) return;
    const display = program.display;
    if (canvas.style && program.mouseVisible) {
      const shape = program.mouseShape ? program.mouseShape() : null;
      const cursor = shape === 1 ? 'default' : shape === 2 ? 'crosshair' : shape === 3 ? 'wait' : previousCursor || '';
      canvas.style.cursor = program.mouseVisible() ? cursor : 'none';
    }
    const screen = display.presentedScreen ? display.presentedScreen() : display.current == null ? null : display.screen();
    if (!screen) { if (renderer) renderer.clear(); canvas.width = 0; canvas.height = 0; return; }
    if (renderer) {
      const snapshot = display.snapshotDisplay(), frame = snapshot.frame;
      renderer.render(snapshot);
      // Exact rational cells preserve the snapshot's pixel aspect without
      // letterboxing, so the existing pointer contract covers the full canvas.
      let divisor = frame.pixelAspect.numerator, remainder = frame.pixelAspect.denominator;
      while (remainder) { const next = divisor % remainder; divisor = remainder; remainder = next; }
      return renderer.present({ width: frame.outputWidth * (frame.pixelAspect.numerator / divisor),
        height: Math.max(1, frame.lines * (frame.pixelAspect.denominator / divisor)) });
    }
    const output = display.canvasFrame ? display.canvasFrame() : { width: screen.width, height: screen.height, rgba: display.rgba(screen) };
    if (canvas.width !== output.width) canvas.width = output.width;
    if (canvas.height !== output.height) canvas.height = output.height;
    const frame = context.createImageData(output.width, output.height);
    frame.data.set(output.rgba);
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
    if (event.isComposing || event.key === 'Dead' || event.key === 'Process') return;
    const controlJoystick = event.ctrlKey && !event.metaKey && !event.altKey && joystickInput.controlChord(event.code || event.key);
    if ((event.ctrlKey || event.metaKey || event.altKey) && !controlJoystick) {
      releaseKey(); releaseRawKeys(); resetJoysticks();
      if (program.clearScanCodes) program.clearScanCodes();
      return;
    }
    if (controlJoystick) releaseKey();
    const rawCode = event.code || event.key, rawScan = amigaScanCode(rawCode);
    if (!event.repeat && rawScan != null && focused() && !program.state.stopped && !program.state.halted && program.setKeyState) {
      rawHeld.set(rawCode, rawScan); program.setKeyState(rawScan, true);
    }
    const joystick = joystickInput.keydown(event.code || (event.key === ' ' ? 'Space' : event.key), !!event.repeat);
    if (joystick.matched && (!focused() || program.state.stopped || program.state.halted)) resetJoysticks();
    if (joystick.matched) { pollJoysticks(); if (joystick.consume) { event.preventDefault(); return; } }
    // Explicit Ctrl joystick chords may update held input, but never produce
    // modified text when a mapping opts out of consuming browser events.
    if (event.ctrlKey) return;
    const code = event.code || event.key;
    const special = { Enter: '\r', NumpadEnter: '\r', Escape: '\x1b', Backspace: '\b', Tab: '\t',
      ArrowUp: '\x1e', ArrowDown: '\x1f', ArrowRight: '\x1c', ArrowLeft: '\x1d', Delete: '\0', Help: '\0' };
    let key = null;
    if (Object.prototype.hasOwnProperty.call(special, code)) key = special[code];
    else if (/^F(?:[1-9]|10)$/.test(code)) key = '\0';
    else if (event.key.length === 1 && event.key.charCodeAt(0) <= 255) key = event.key;
    if (key == null) return;
    event.preventDefault();
    const config = program.state.input.keySpeed;
    if (program.state.halted || program.state.stopped || (config && event.repeat)) return;
    const scanCode = amigaScanCode(code);
    program.sendKey(key, scanCode == null ? 0 : scanCode);
    if (config) {
      releaseKey(); held = { code, key, scanCode: scanCode == null ? 0 : scanCode, config };
      repeatAfter(config.delayMs);
    }
  }
  function keyup(event) {
    const code = event.code || event.key;
    if (rawHeld.has(code)) {
      if (program && program.setKeyState) program.setKeyState(rawHeld.get(code), false);
      rawHeld.delete(code);
    }
    if (held && held.code === (event.code || event.key)) releaseKey();
    if (joystickInput.keyup(event.code || (event.key === ' ' ? 'Space' : event.key))) pollJoysticks();
  }
  function pointer(event) {
    if (!program || (mouseCoordinates === 'hardware' && (focusSuspended || program.state.stopped || program.state.halted))) return;
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
    const position = mouseCoordinates === 'hardware' ? program.display.pointerHardwarePosition : program.display.pointerPosition;
    const [x, y] = position ? position.call(program.display, event.clientX - left, event.clientY - top, width, height) : [
      Math.max(0, Math.min(screen.width - 1, Math.floor((event.clientX - left) * screen.width / width))),
      Math.max(0, Math.min(screen.height - 1, Math.floor((event.clientY - top) * screen.height / height)))];
    program.setMouse(x, y, event.buttons & 7);
  }
  function pointerdown(event) {
    if (canvas.focus) canvas.focus();
    if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
    pointer(event);
  }
  function blur() {
    focusSuspended = true;
    releaseKey(); releaseRawKeys();
    resetJoysticks();
    if (program) {
      if (program.clearScanCodes) program.clearScanCodes();
      if (program.clearMouseButtons) program.clearMouseButtons();
      else program.setMouse(program.state.input.mouse.x, program.state.input.mouse.y, 0);
    }
  }
  function focus() { focusSuspended = false; }
  function visibility() { if (canvas.ownerDocument.hidden) blur(); }
  const events = { keydown, keyup, pointermove: pointer, pointerdown, pointerup: pointer, blur, focus };

  function detach() {
    if (touch) { touch.dispose(); touch = null; }
    releaseKey(); releaseRawKeys();
    resetJoysticks();
    if (program && program.clearScanCodes) program.clearScanCodes();
    if (program && program.clearMouseButtons) program.clearMouseButtons();
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
    if (mouseCoordinates === 'hardware' && typeof next.display.pointerHardwarePosition !== 'function') throw new Error('Hardware mouse coordinates are unavailable');
    program = next;
    if (program.subscribeInputReset) unsubscribeInput = program.subscribeInputReset(reason => {
      releaseKey(); if (reason !== 'key-speed') { releaseRawKeys(); resetJoysticks(); }
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
    if (touchOptions) touch = createVirtualJoystick(touchOptions.container, { ...touchOptions,
      focus: () => canvas.focus(), onChange: pollJoysticks, isActive: () => program && focused() && !program.state.stopped && !program.state.halted });
    render();
  }
  return { attach, detach, render,
    setVirtualJoystickVisibility(value) { if (!touchOptions) throw new Error('Virtual joystick is not configured'); if (!['auto', 'always', 'off'].includes(value)) throw new Error('Invalid virtual joystick visibility'); touchOptions.visibility = value; if (touch) touch.setVisibility(value); },
    virtualJoystickStatus: () => touch ? { ...touch.status(), port: touchOptions.port } : null, focus: () => canvas.focus(), configureJoysticks, pollJoysticks,
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
    controlChord: code => (match('ControlLeft') || match('ControlRight')) && match(code),
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

// Optional pointer controller. It owns only its DOM, pointer holds and listeners;
// the Canvas host merges its mask with keyboard/Gamepad input at query time.
function createVirtualJoystick(container, options = {}) {
  const doc = container.ownerDocument, win = doc.defaultView;
  let visibility = options.visibility || 'auto';
  const validate = value => { if (!['auto', 'always', 'off'].includes(value)) throw new Error('Invalid virtual joystick visibility'); };
  validate(visibility);
  const media = win.matchMedia ? win.matchMedia('(pointer: coarse)') : null;
  const pointers = new Map(), buttons = new Map(); let disposed = false;
  const bits = { up: 1, down: 2, left: 4, right: 8, fire: 16 };
  const pad = doc.createElement('div'); pad.className = 'amos-virtual-joystick'; pad.setAttribute('aria-label', 'Virtual joystick');
  const style = doc.createElement('style');
  style.textContent = '.amos-virtual-joystick{position:fixed;right:calc(12px + env(safe-area-inset-right));bottom:calc(12px + env(safe-area-inset-bottom));z-index:20;display:grid;grid-template:repeat(3,clamp(44px,10vmin,64px))/repeat(3,clamp(44px,10vmin,64px));gap:4px;touch-action:none;user-select:none;-webkit-user-select:none}.amos-virtual-joystick[hidden]{display:none}.amos-virtual-joystick button{margin:0;padding:0;min-width:0;border:2px solid #fff;border-radius:12px;background:#17202add;color:#fff;font:700 24px system-ui;touch-action:none;user-select:none;-webkit-touch-callout:none}.amos-virtual-joystick button[data-direction=fire]{background:#b51621dd}.amos-virtual-joystick button[aria-pressed=true]{background:#07569c;border-color:#ffe665}.amos-virtual-joystick button:focus-visible{outline:3px solid #ffe665}';
  for (const [direction, label, row, column] of [['up', '\u2191', 1, 2], ['left', '\u2190', 2, 1], ['fire', '\u25cf', 2, 2], ['right', '\u2192', 2, 3], ['down', '\u2193', 3, 2]]) {
    const button = doc.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.direction = direction;
    button.setAttribute('aria-label', direction === 'fire' ? 'Fire' : direction[0].toUpperCase() + direction.slice(1));
    button.style.gridRow = row; button.style.gridColumn = column; pad.append(button); buttons.set(direction, button);
  }
  doc.head.append(style); container.append(pad);
  function mask() { let value = 0; for (const bit of pointers.values()) value |= bit; return value; }
  function changed(notify = true) {
    const value = mask(); pad.dataset.mask = String(value);
    for (const [direction, button] of buttons) button.setAttribute('aria-pressed', String(!!(value & bits[direction])));
    if (notify && options.onChange) options.onChange();
  }
  function releaseCapture(id) { try { if (pad.hasPointerCapture && pad.hasPointerCapture(id)) pad.releasePointerCapture(id); } catch (_) { /* Already retired by the browser. */ } }
  function reset(notify = true) { const ids = [...pointers.keys()]; pointers.clear(); for (const id of ids) releaseCapture(id); changed(notify); }
  function refresh() {
    const fullscreen = doc.fullscreenElement === container;
    const touch = !!((media && media.matches) || (win.navigator && win.navigator.maxTouchPoints > 0));
    pad.hidden = disposed || visibility === 'off' || (options.fullscreenOnly !== false && !fullscreen) || (visibility === 'auto' && !touch);
    if (pad.hidden && pointers.size) reset();
  }
  function directionAt(target) { const button = target && target.closest ? target.closest('button[data-direction]') : null; return button && pad.contains(button) ? bits[button.dataset.direction] : 0; }
  function down(event) {
    if (disposed || pad.hidden || (event.button != null && event.button !== 0)) return;
    const bit = directionAt(event.target); if (!bit) return;
    event.preventDefault(); if (options.focus) options.focus();
    if (options.isActive && !options.isActive()) return;
    pointers.set(event.pointerId, bit);
    try { pad.setPointerCapture(event.pointerId); } catch (_) { /* Synthetic tests have no native active pointer. */ }
    changed();
  }
  function move(event) {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault(); pointers.set(event.pointerId, directionAt(doc.elementFromPoint(event.clientX, event.clientY))); changed();
  }
  function up(event) { if (!pointers.has(event.pointerId)) return; event.preventDefault(); pointers.delete(event.pointerId); releaseCapture(event.pointerId); changed(); }
  const prevent = event => event.preventDefault();
  const events = { pointerdown: down, pointermove: move, pointerup: up, pointercancel: up, lostpointercapture: up, contextmenu: prevent };
  for (const [name, handler] of Object.entries(events)) pad.addEventListener(name, handler);
  doc.addEventListener('fullscreenchange', refresh);
  doc.addEventListener('pointerup', up); doc.addEventListener('pointercancel', up);
  if (media && media.addEventListener) media.addEventListener('change', refresh);
  if (win) win.addEventListener('resize', refresh);
  changed(false); refresh();
  return { mask, reset, refresh, setVisibility(value) { validate(value); visibility = value; refresh(); },
    status: () => ({ visible: !pad.hidden, mask: mask(), visibility }),
    dispose() {
      if (disposed) return; disposed = true; pad.hidden = true; reset(false);
      for (const [name, handler] of Object.entries(events)) pad.removeEventListener(name, handler);
      doc.removeEventListener('fullscreenchange', refresh);
      doc.removeEventListener('pointerup', up); doc.removeEventListener('pointercancel', up);
      if (media && media.removeEventListener) media.removeEventListener('change', refresh);
      if (win) win.removeEventListener('resize', refresh);
      pad.remove(); style.remove();
    }
  };
}

const amigaKeyCodes = (() => {
  const codes = { Numpad0: 0x0f, Numpad1: 0x1d, Numpad2: 0x1e, Numpad3: 0x1f,
    Numpad4: 0x2d, Numpad5: 0x2e, Numpad6: 0x2f, IntlBackslash: 0x30, NumpadDecimal: 0x3c,
    Numpad7: 0x3d, Numpad8: 0x3e, Numpad9: 0x3f, Space: 0x40, Backspace: 0x41, Tab: 0x42,
    NumpadEnter: 0x43, Enter: 0x44, Escape: 0x45, Delete: 0x46, NumpadSubtract: 0x4a,
    ArrowUp: 0x4c, ArrowDown: 0x4d, ArrowRight: 0x4e, ArrowLeft: 0x4f,
    NumpadDivide: 0x5c, NumpadMultiply: 0x5d, NumpadAdd: 0x5e, Help: 0x5f };
  for (const [start, row] of [[0, 'Backquote Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus Equal Backslash'],
    [0x10, 'KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP BracketLeft BracketRight'],
    [0x20, 'KeyA KeyS KeyD KeyF KeyG KeyH KeyJ KeyK KeyL Semicolon Quote'],
    [0x31, 'KeyZ KeyX KeyC KeyV KeyB KeyN KeyM Comma Period Slash']]) row.split(' ').forEach((code, i) => { codes[code] = start + i; });
  for (let number = 1; number <= 10; number++) codes[`F${number}`] = 0x4f + number;
  return Object.freeze(codes);
})();
function amigaScanCode(code) { return Object.prototype.hasOwnProperty.call(amigaKeyCodes, code) ? amigaKeyCodes[code] : null; }

if (typeof module === 'object' && module.exports) module.exports = { createCanvasHost, createJoystickInput, createVirtualJoystick, amigaScanCode };
else globalThis.AMOS_BROWSER = { createCanvasHost, createJoystickInput, createVirtualJoystick, amigaScanCode };
