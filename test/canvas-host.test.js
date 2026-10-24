/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const { createCanvasHost } = require('../lib/amos/browser');
const { compile, example } = require('./helpers/program');
const { createFakeTimers } = require('./helpers/fakeTimers');

function canvas() {
  const events = new Map();
  const frames = [];
  return {
    width: 0, height: 0, frames, events, focused: false,
    getContext: () => ({ createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }), putImageData: frame => frames.push(frame) }),
    addEventListener: (event, handler) => events.set(event, handler),
    removeEventListener: event => events.delete(event),
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 640, height: 400 }),
    focus() { this.focused = true; }
  };
}

test('canvas: renders indexed pixels, coalesces changes, and cancels detached frames', () => {
  const timers = createFakeTimers();
  const target = canvas();
  const program = compile(example(1)).create({ setTimeout: timers.setTimeout, print() {} });
  const host = createCanvasHost(target, { requestAnimationFrame: callback => timers.setTimeout(callback, 16), cancelAnimationFrame: timers.clearTimeout });
  host.attach(program);
  assert.strictEqual(target.width, 320);
  assert.strictEqual(target.height, 200);
  program.display.plot(0, 0, 2);
  program.display.plot(1, 0, 2);
  assert.strictEqual(timers.pending(), 1);
  timers.tick(16);
  assert.deepStrictEqual(Array.from(target.frames[1].data.slice(0, 4)), [255, 255, 255, 255]);
  program.display.plot(2, 0, 2);
  host.detach();
  assert.strictEqual(timers.pending(), 0);
  assert.strictEqual(target.events.size, 0);
});

test('canvas: forwards focused keys and maps pointer coordinates into screen pixels', () => {
  const timers = createFakeTimers();
  const target = canvas();
  const logs = [];
  const program = compile(example(10)).create({ setTimeout: timers.setTimeout, print: (...args) => logs.push(args) });
  const host = createCanvasHost(target, { requestAnimationFrame: callback => timers.setTimeout(callback, 16), cancelAnimationFrame: timers.clearTimeout });
  host.attach(program);
  program.tick(100);
  target.events.get('keydown')({ key: 'Enter', preventDefault() {} });
  timers.runAll();
  assert.deepStrictEqual(logs, [['One'], ['Two']]);
  target.events.get('pointerdown')({ clientX: 330, clientY: 220, buttons: 1 });
  assert.strictEqual(target.focused, true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(program.state.input.mouse)), { x: 160, y: 100, buttons: 1 });
  target.events.get('blur')();
  assert.strictEqual(program.state.input.mouse.buttons, 0);
  host.detach();
});

test('canvas: pointer mapping excludes borders and accounts for CSS scaling', () => {
  const target = canvas();
  target.clientLeft = 2; target.clientTop = 2;
  target.clientWidth = 640; target.clientHeight = 400;
  target.offsetWidth = 644; target.offsetHeight = 404;
  target.getBoundingClientRect = () => ({ left: 10, top: 20, width: 1288, height: 808 });
  const program = compile(example(1)).create({ setTimeout() {}, print() {} });
  const host = createCanvasHost(target);
  host.attach(program);
  target.events.get('pointermove')({ clientX: 654, clientY: 424, buttons: 0 });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(program.state.input.mouse)), { x: 160, y: 100, buttons: 0 });
  host.detach();
});

test('canvas host: injected renderer consumes owned physical snapshots without creating a 2D context or CPU pixels',()=>{
  const target=canvas(),timers=createFakeTimers(),calls=[];
  target.getContext=()=>{throw new Error('Unexpected Canvas fallback');};
  const program=compile(example(1)).create({now:timers.now,setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout,displayOptions:{snapshotPixelAspect:{numerator:2,denominator:4}},print(){}});
  program.display.canvasFrame=program.display.rgba=()=>{throw new Error('Unexpected CPU rendering');};
  const renderer={render:snapshot=>calls.push(snapshot),present:layout=>{target.width=layout.width;target.height=layout.height;},clear(){calls.push('clear');},dispose(){throw new Error('Caller owns renderer');}};
  const host=createCanvasHost(target,{renderer,requestAnimationFrame:fn=>timers.setTimeout(fn,16),cancelAnimationFrame:timers.clearTimeout});
  host.attach(program);assert.strictEqual(target.width,640);assert.strictEqual(target.height,400);
  program.display.plot(0,0,1);timers.tick(16);assert.strictEqual(calls.length,2);
  assert.notStrictEqual(calls[0].frame.lineRegs,calls[1].frame.lineRegs);
  target.events.get('pointermove')({clientX:330,clientY:220,buttons:0});
  assert.deepStrictEqual(JSON.parse(JSON.stringify(program.state.input.mouse)),{x:160,y:100,buttons:0});
  program.display.close(0);host.render();assert.strictEqual(calls[calls.length-1],'clear');assert.strictEqual(target.width,0);
  host.detach();assert.strictEqual(timers.pending(),0);program.stop();
});

test('canvas host: invalid or failing renderers reject explicitly without selecting the CPU path',()=>{
  assert.throws(()=>createCanvasHost(canvas(),{renderer:{render(){}}}),/Invalid display renderer/);
  const program=compile(example(1)).create({setTimeout:()=>1,clearTimeout(){},now:()=>0,print(){}});
  const target=canvas();target.getContext=()=>{throw new Error('Unexpected fallback');};
  const host=createCanvasHost(target,{renderer:{render(){throw new Error('Unsupported GPU mode');},present(){},clear(){}}});
  assert.throws(()=>host.attach(program),/Unsupported GPU mode/);host.detach();program.stop();
});
