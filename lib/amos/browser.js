/* jshint esversion: 6 */
'use strict';

function createCanvasHost(canvas, options = {}) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D rendering is not available');
  const request = options.requestAnimationFrame || (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : callback => setTimeout(callback, 0));
  const cancel = options.cancelAnimationFrame || (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout);
  let program = null;
  let unsubscribe = null;
  let pending = null;

  function render() {
    if (!program) return;
    const display = program.display;
    if (display.current == null) { canvas.width = 0; canvas.height = 0; return; }
    const screen = display.screen();
    if (canvas.width !== screen.width) canvas.width = screen.width;
    if (canvas.height !== screen.height) canvas.height = screen.height;
    const frame = context.createImageData(screen.width, screen.height);
    frame.data.set(display.rgba());
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
    if (!program || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.length === 1 ? event.key : { Enter: '\r', Escape: '\x1b', Backspace: '\b' }[event.key];
    if (key == null) return;
    event.preventDefault();
    program.sendKey(key);
  }
  function pointer(event) {
    if (!program || program.display.current == null) return;
    const screen = program.display.screen();
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
    if (program) program.setMouse(program.state.input.mouse.x, program.state.input.mouse.y, 0);
  }
  const events = { keydown, pointermove: pointer, pointerdown, pointerup: pointer, blur };

  function detach() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    if (pending) { cancel(pending.id); pending = null; }
    for (const [name, listener] of Object.entries(events)) canvas.removeEventListener(name, listener);
    program = null;
  }
  function attach(next) {
    detach();
    program = next;
    unsubscribe = program.display.subscribe(schedule);
    for (const [name, listener] of Object.entries(events)) canvas.addEventListener(name, listener);
    render();
  }
  return { attach, detach, render, focus: () => canvas.focus() };
}

if (typeof module === 'object' && module.exports) module.exports = { createCanvasHost };
else globalThis.AMOS_BROWSER = { createCanvasHost };
