/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const interpret = require('../lib/display/copper/interpreter');
const build = require('../lib/display/copper/builder');
const { R, fetchBytes } = require('../lib/display/model/registers');
const ChipMemory = require('../lib/display/model/ChipMemory');
const reference = require('../lib/display/reference/render');
const createDisplay = require('../lib/amos/display');

function write(chip, address, words) {
  const view = new DataView(chip.buffer, chip.byteOffset, chip.byteLength);
  words.forEach((word, i) => view.setUint16(address + i * 2, word, false));
}
function setup() {
  const initial = new Uint16Array(256);
  initial[R.DMACON / 2] = 0x380; initial[R.DIWSTRT / 2] = 0x0080; initial[R.DIWSTOP / 2] = 0x8000;
  initial[R.DDFSTRT / 2] = 0x38; initial[R.DDFSTOP / 2] = 0x38;
  initial[R.BPLCON0 / 2] = 0x1000; initial[(R.BPL1PTH + 2) / 2] = 0x1000;
  initial[(R.COLOR00 + 2) / 2] = 0xf00;
  return initial;
}
function run(words, options = {}, change = () => {}) {
  const chip = new Uint8Array(524288), initial = setup();
  write(chip, 0, words); write(chip, 0x1000, [0x8000, 0x4000, 0x2000, 0x1000]);
  change(chip, initial);
  return interpret(chip, { address: 0, initialRegisters: initial, origin: { x: 128, y: 0 }, outputWidth: 8, lines: 4, ...options });
}
const end = [0xffff, 0xfffe];
const pixel = (snapshot, x, y) => Array.from(reference.render(snapshot.chip, snapshot.frame).slice((y * snapshot.frame.outputWidth + x) * 4, (y * snapshot.frame.outputWidth + x) * 4 + 4));

test('copper: independent MOVE/WAIT rainbow words produce per-line palettes and immutable snapshots', () => {
  const words = [0x0001, 0xfffe, 0x0180, 0x0f00, 0x0101, 0xfffe, 0x0180, 0x00f0,
    0x0201, 0xfffe, 0x0180, 0x000f, 0x0301, 0xfffe, 0x0180, 0x0fff, ...end];
  const { snapshot, diagnostics } = run(words, {}, (chip, initial) => { initial[R.BPLCON0 / 2] = 0; });
  assert.deepStrictEqual([0, 1, 2, 3].map(y => pixel(snapshot, 0, y)),
    [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 255, 255]]);
  assert.strictEqual(diagnostics.stopped, true); assert.strictEqual(diagnostics.instructions, 9);
  diagnostics.registers[R.COLOR00 / 2] = 0;
  assert.deepStrictEqual(pixel(snapshot, 0, 3), [255, 255, 255, 255]);
});

test('copper: fetch pointers advance with independent signed odd/even modulos', () => {
  const { snapshot } = run(end, {}, (chip, initial) => {
    initial[R.BPLCON0 / 2] = 0x2000;
    initial[(R.BPL1PTH + 6) / 2] = 0x2000;
    initial[R.BPL1MOD / 2] = 0xfffe;
    write(chip, 0x2000, [0, 0x8000, 0, 0x8000]);
  });
  assert.deepStrictEqual([0, 1, 2, 3].map(y => snapshot.frame.lineRegs[y * 32]), Array(4).fill(0x1000));
  assert.deepStrictEqual([0, 1, 2, 3].map(y => snapshot.frame.lineRegs[y * 32 + 1]), [0x2000, 0x2002, 0x2004, 0x2006]);
  assert.strictEqual(reference.explainPixel(snapshot.chip, snapshot.frame, 0, 1).rawIndex, 3);
  const repeated = run(end, {}, (chip, initial) => { initial[R.BPL1MOD / 2] = 0xffff; }).snapshot;
  // Modulo bit zero is not a hardware address bit: -1 normalizes to -2.
  assert.deepStrictEqual([0, 1, 2, 3].map(y => repeated.frame.lineRegs[y * 32]), Array(4).fill(0x1000));
  assert.strictEqual(fetchBytes(0x1000, 0x38, 0xd0), 40);
  assert.strictEqual(fetchBytes(0x9000, 0x38, 0xd0), 80);
});

test('copper: pointer rewrites after fetch replace the next line pointer, preserving the current latch', () => {
  const { snapshot } = run([0x0081, 0xfffe, 0x00e2, 0x2000, ...end], {}, chip => {
    write(chip, 0x2000, [0x4000, 0x2000, 0x1000]);
  });
  assert.deepStrictEqual([0, 1, 2, 3].map(y => snapshot.frame.lineRegs[y * 32]), [0x1000, 0x2000, 0x2002, 0x2004]);
  assert.strictEqual(reference.explainPixel(snapshot.chip, snapshot.frame, 0, 0).rawIndex, 1);
  assert.strictEqual(reference.explainPixel(snapshot.chip, snapshot.frame, 2, 1).rawIndex, 1);
  assert.throws(() => run([0x0039, 0xfffe, 0x00e2, 0x2000, ...end]), /during active fetch/);
});

test('copper: masked WAIT, unmaskable V7, SKIP and PAL wrap follow beam comparisons', () => {
  const masked = run([0x0501, 0xf0fe, 0x0180, 0x00f0, ...end], {}, (chip, initial) => { initial[R.BPLCON0 / 2] = 0; }).snapshot;
  assert.deepStrictEqual(pixel(masked, 0, 0), [0, 255, 0, 255]);
  const forced = run([0x8001, 0x00fe, 0x0180, 0x0f00, ...end], { origin: { x: 128, y: 127 }, lines: 2 },
    (chip, initial) => { initial[R.BPLCON0 / 2] = 0; }).snapshot;
  assert.deepStrictEqual(pixel(forced, 0, 0), [0, 0, 0, 255]);
  assert.deepStrictEqual(pixel(forced, 0, 1), [255, 0, 0, 255]);
  const skipped = run([0x0001, 0xffff, 0x0000, 0x0000, 0x0180, 0x00f0, ...end], {},
    (chip, initial) => { initial[R.BPLCON0 / 2] = 0; }).snapshot;
  assert.deepStrictEqual(pixel(skipped, 0, 0), [0, 255, 0, 255]);
  assert.throws(() => run([0x0101, 0xffff, 0x0000, 0x0000, ...end]), /protected register/);
  const wrapped = run([0xffdf, 0xfffe, 0x0101, 0xfffe, 0x0180, 0x000f, ...end],
    { origin: { x: 128, y: 256 }, lines: 3 }, (chip, initial) => { initial[R.BPLCON0 / 2] = 0; }).snapshot;
  assert.deepStrictEqual(pixel(wrapped, 0, 0), [0, 0, 0, 255]);
  assert.deepStrictEqual(pixel(wrapped, 0, 1), [0, 0, 255, 255]);
});

test('copper: COP2 jumps, DMA disabling and execution limits remain bounded', () => {
  const result = run([0x0084, 0, 0x0086, 0x0041, 0x008a, 0, 0, 0], {}, (chip, initial) => {
    write(chip, 0x40, [0x0180, 0x000f, ...end]); initial[R.BPLCON0 / 2] = 0;
  });
  assert.deepStrictEqual(pixel(result.snapshot, 0, 0), [0, 0, 255, 255]);
  assert.throws(() => run([0x0088, 0], { maxInstructions: 2 }), /instruction budget exceeded.*beam/);
  const disabled = run([0x0096, 0x0080, 0, 0]).snapshot;
  assert.strictEqual(disabled.frame.lineRegs[17], 0);
  assert.throws(() => run(end, { address: 524286 }), /instruction pointer/);
  assert.throws(() => run(end, {}, (chip, initial) => { initial[R.BPL1MOD / 2] = 0xfffc; initial[(R.BPL1PTH + 2) / 2] = 0; }), /pointer arithmetic/);
});

test('copper: mid-line writes retain exact native x and lossless overflow; unsupported rendering rejects', () => {
  const { snapshot } = run([0x0061, 0xfffe, 0x0180, 0x0f00, 0x0180, 0x00f0, ...end],
    { outputWidth: 640, maxEvents: 1 }, (chip, initial) => { initial[R.BPLCON0 / 2] = 0; });
  assert.strictEqual(snapshot.frame.lineRegs[17], 2);
  assert.deepStrictEqual(Array.from(snapshot.frame.overflowEvents), [152, 0x180, 0xf00, 0, 168, 0x180, 0x0f0, 0]);
  assert.deepStrictEqual(Array.from(snapshot.frame.eventOffsets), [0, 2, 2, 2, 2]);
  assert.throws(() => reference.render(snapshot.chip, snapshot.frame), /mid-line events/);
  assert.throws(() => run([0x0061, 0xfffe, 0x0180, 0xf00, 0x0180, 0xf0, ...end],
    { outputWidth: 640, maxTotalEvents: 1 }, (chip, initial) => { initial[R.BPLCON0 / 2] = 0; }), /event storage limit/);
  const busy = run([0x0001, 0x7ffe, 0x0180, 0xf00, ...end], { outputWidth: 640, blitterBusyUntil: 100 },
    (chip, initial) => { initial[R.BPLCON0 / 2] = 0; }).snapshot;
  assert.strictEqual(busy.frame.lineEvents[0], 168);
});

test('copper builder: different screen depths/palettes share the interpreter in one raster', () => {
  const memory = new ChipMemory(524288), top = memory.allocate(4000), bottom = memory.allocate(8000);
  memory.writeBytes(top.address, new Uint8Array(4000).fill(255));
  memory.writeBytes(bottom.address, new Uint8Array(4000).fill(255));
  const compiled = build([
    { width: 320, height: 100, x: 128, y: 50, depth: 1, rowBytes: 40, pointers: [top.address], palette: [0, 0xf00] },
    { width: 320, height: 100, x: 128, y: 150, depth: 2, rowBytes: 40, pointers: [bottom.address, bottom.address + 4000], palette: [0, 0x0f0, 0x00f, 0xfff] }
  ]);
  const list = memory.allocate(compiled.bytes.length); memory.writeBytes(list.address, compiled.bytes);
  const { snapshot } = interpret(memory.bytes, { ...compiled.interpretOptions, address: list.address, initialRegisters: compiled.initialRegisters });
  assert.strictEqual(snapshot.frame.lineRegs[8], 0x1000); assert.strictEqual(snapshot.frame.lineRegs[100 * 32 + 8], 0x2000);
  const rgba = reference.render(snapshot.chip, snapshot.frame);
  assert.deepStrictEqual(Array.from(rgba.slice(0, 4)), [255, 0, 0, 255]);
  assert.deepStrictEqual(Array.from(rgba.slice(100 * 640 * 4, 100 * 640 * 4 + 4)), [0, 255, 0, 255]);
  assert.strictEqual(snapshot.frame.lineRegs[100 * 32], bottom.address);
  assert.throws(() => build([{ width: 32, height: 10, x: 128, y: 50, depth: 1, rowBytes: 4, pointers: [0], palette: [0, 0xfff] }]), /geometry/);
});

test('copper display: screen stacks preserve selection, hidden buffers and old snapshots', () => {
  const display = createDisplay({ snapshotChipBytes: 524288 });
  display.open(1, 320, 100, 2, 0); display.setColour(1, 0xf00); display.clear(1);
  display.doubleBuffer(); display.autoback(0); display.plot(0, 0, 0);
  const bottom = display.open(2, 320, 100, 2, 0);
  bottom.hardwareY = 150; display.setColour(1, 0x0f0); display.clear(1);
  const snapshot = display.snapshotDisplay([2, 1]);
  assert.strictEqual(display.current, 2);
  assert.deepStrictEqual(pixel(snapshot, 0, 0), [255, 0, 0, 255]);
  assert.deepStrictEqual(pixel(snapshot, 0, 100), [0, 255, 0, 255]);
  display.swap(1);
  assert.deepStrictEqual(pixel(display.snapshotDisplay([1, 2]), 0, 0), [0, 0, 0, 255]);
  assert.deepStrictEqual(pixel(snapshot, 0, 0), [255, 0, 0, 255]);
  display.open(3, 16, 8, 2, 0);
  assert.throws(() => display.snapshotDisplay(), /geometry/);
  assert.strictEqual(display.snapshotPlayfield().frame.outputWidth, 32);
});

test('copper builder: mixed lowres/hires stack shares one native sampling grid', () => {
  const memory = new ChipMemory(524288), low = memory.allocate(4000), high = memory.allocate(8000);
  memory.writeBytes(low.address, new Uint8Array(4000).fill(0xaa));
  memory.writeBytes(high.address, new Uint8Array(8000).fill(0xaa));
  const compiled = build([
    { width: 320, height: 100, x: 128, y: 50, depth: 1, rowBytes: 40, pointers: [low.address], palette: [0, 0xf00] },
    { width: 640, height: 100, x: 128, y: 150, depth: 1, rowBytes: 80, pointers: [high.address], palette: [0, 0xf00], hires: true }
  ]);
  const list = memory.allocate(compiled.bytes.length); memory.writeBytes(list.address, compiled.bytes);
  const { snapshot } = interpret(memory.bytes, { ...compiled.interpretOptions, address: list.address, initialRegisters: compiled.initialRegisters });
  assert.strictEqual(snapshot.frame.lineRegs[100 * 32 + 8], 0x9000);
  assert.strictEqual(snapshot.frame.lineRegs[101 * 32], high.address + 80);
  const rgba = reference.render(snapshot.chip, snapshot.frame);
  const red = [255, 0, 0, 255], black = [0, 0, 0, 255];
  assert.deepStrictEqual(Array.from(rgba.slice(0, 16)), [...red, ...red, ...black, ...black]);
  assert.deepStrictEqual(Array.from(rgba.slice(100 * 640 * 4, 100 * 640 * 4 + 16)), [...red, ...black, ...red, ...black]);
});

test('copper builder: blank-row setup reserves rainbow writes without relaxing the pre-fetch budget', () => {
  const top={width:320,height:98,x:128,y:50,depth:1,rowBytes:40,pointers:[0],palette:Array(32).fill(0)};
  const bottom={...top,height:100,y:150,pointers:[4000],palette:Array(32).fill(0xfff)};
  const paletteRows=[148,149,150].map(y=>({y,index:14,rgb:0x123}));
  const compiled=build([top,bottom],{paletteRows});
  const words=new DataView(compiled.bytes.buffer);let moves=0,waits=0;
  for(let at=0;at<compiled.bytes.length-4;at+=4){
    if(words.getUint16(at,false)&1){if(waits)assert.ok(2+moves*4<0x38);moves=0;waits++;}
    else moves++;
  }
  assert.ok(2+moves*4<0x38);assert.strictEqual(waits,3);
  const memory=new ChipMemory(524288),list=memory.allocate(compiled.bytes.length);
  memory.writeBytes(list.address,compiled.bytes);
  const {snapshot}=interpret(memory.bytes,{...compiled.interpretOptions,address:list.address,initialRegisters:compiled.initialRegisters});
  assert.strictEqual(snapshot.frame.lineRegs[100*32],4000);
  assert.deepStrictEqual(pixel(snapshot,0,100),[255,255,255,255]);
  assert.throws(()=>build([{...top,height:99},bottom],{paletteRows}),/pre-fetch copper budget/);
  assert.throws(()=>build([top,bottom],{paletteRows:Array.from({length:14},(_,index)=>({y:148,index,rgb:0}))}),/pre-fetch copper budget/);
});
