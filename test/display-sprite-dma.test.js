/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const interpret = require('../lib/display/copper/interpreter');
const { R } = require('../lib/display/model/registers');
const reference = require('../lib/display/reference/render');
const build = require('../lib/display/copper/builder');
const ChipMemory = require('../lib/display/model/ChipMemory');

function write(chip, address, words) {
  const view = new DataView(chip.buffer, chip.byteOffset, chip.byteLength);
  words.forEach((word, i) => view.setUint16(address + i * 2, word, false));
}
function fixture() {
  const chip = new Uint8Array(524288), initial = new Uint16Array(256);
  initial[R.DMACON / 2] = 0x3a0;
  initial[R.DIWSTRT / 2] = 0x0080; initial[R.DIWSTOP / 2] = 0x8000;
  initial[R.BPLCON2 / 2] = 0x24;
  initial[R.DDFSTRT / 2] = 0x38; initial[R.DDFSTOP / 2] = 0x38;
  for (let channel = 0; channel < 8; channel++) initial[(R.SPR0PTH + channel * 4 + 2) / 2] = 0x2000;
  for (let pair = 0; pair < 4; pair++) {
    initial[(R.COLOR00 + (17 + pair * 4) * 2) / 2] = 0xf00;
    initial[(R.COLOR00 + (18 + pair * 4) * 2) / 2] = 0x0f0;
  }
  write(chip, 0, [0xffff, 0xfffe]);
  return { chip, initial };
}
function run(f, options = {}) {
  return interpret(f.chip, { address: 0, initialRegisters: f.initial, origin: { x: 128, y: 28 }, outputWidth: 640, lines: 10, ...options });
}
function channel(f, number, address, words) {
  f.initial[(R.SPR0PTH + number * 4) / 2] = address >>> 16;
  f.initial[(R.SPR0PTH + number * 4 + 2) / 2] = address & 65535;
  write(f.chip, address, words);
}
function cell(snapshot, number, hardwareLine) {
  const at = (hardwareLine - snapshot.frame.origin.y) * 32 + number * 4;
  return Array.from(snapshot.frame.lineSprites.slice(at, at + 4));
}
function pixel(snapshot, x, hardwareLine) {
  const at = ((hardwareLine - snapshot.frame.origin.y) * snapshot.frame.outputWidth + x) * 4;
  return Array.from(reference.render(snapshot.chip, snapshot.frame).slice(at, at + 4));
}
const red = [255, 0, 0, 255], green = [0, 255, 0, 255], black = [0, 0, 0, 255];

test('sprite DMA: all channels load control/data/terminators, advance pointers and own published bytes', () => {
  const f = fixture();
  for (let n = 0; n < 8; n++) channel(f, n, 0x3000 + n * 32,
    [0x1e41 + n * 8, 0x2000, 0x8000, 0, 0, 0x8000, 0, 0]);
  const { snapshot, diagnostics } = run(f);
  for (let n = 0; n < 8; n++) {
    const x = 4 + n * 32;
    assert.strictEqual(cell(snapshot, n, 29)[3] >>> 31, 0);
    assert.deepStrictEqual(cell(snapshot, n, 30), [x, 0x8000, 0, 0x80000000]);
    assert.deepStrictEqual(cell(snapshot, n, 31), [x, 0, 0x8000, 0x80000000]);
    assert.strictEqual(cell(snapshot, n, 32)[3] >>> 31, 0);
    assert.deepStrictEqual(pixel(snapshot, x, 30), red); assert.deepStrictEqual(pixel(snapshot, x, 31), green);
    assert.strictEqual(diagnostics.registers[(R.SPR0PTH + n * 4 + 2) / 2], 0x3010 + n * 32);
  }
  assert.strictEqual(diagnostics.spriteWords, 64);
  f.chip.fill(0); f.initial.fill(0);
  assert.deepStrictEqual(pixel(snapshot, 4, 30), red);
});

test('sprite DMA: chained descriptors reuse a channel after its blank control line and preserve H0', () => {
  const f = fixture();
  channel(f, 0, 0x3000, [0x1e41, 0x2000, 0x8000, 0, 0x4000, 0,
    0x224b, 0x2301, 0, 0x8000, 0, 0]);
  const { snapshot, diagnostics } = run(f);
  assert.deepStrictEqual(pixel(snapshot, 4, 30), red);
  assert.deepStrictEqual(pixel(snapshot, 6, 31), red);
  for (const line of [32, 33, 35, 36]) assert.strictEqual(cell(snapshot, 0, line)[3] >>> 31, 0);
  assert.deepStrictEqual(cell(snapshot, 0, 34), [46, 0, 0x8000, 0x80000000]);
  assert.deepStrictEqual(pixel(snapshot, 46, 34), green);
  assert.strictEqual(diagnostics.registers[(R.SPR0PTH + 2) / 2], 0x3018);
});

test('sprite DMA: zero-height descriptors skip data and use the next pair as control', () => {
  const f = fixture();
  channel(f, 0, 0x3000, [0x1e41, 0x1e00, 0x1f41, 0x2000, 0x8000, 0, 0, 0]);
  const { snapshot } = run(f);
  assert.strictEqual(cell(snapshot, 0, 30)[3] >>> 31, 0);
  assert.deepStrictEqual(pixel(snapshot, 4, 31), red);
  assert.strictEqual(cell(snapshot, 0, 32)[3] >>> 31, 0);
});

test('sprite DMA: nine-bit vertical start/stop and attached DATA/DATB retain both channel contributions', () => {
  const f = fixture();
  channel(f, 0, 0x3000, [0x0241, 0x0306, 0x8000, 0, 0, 0]);
  channel(f, 1, 0x3040, [0x0241, 0x0386, 0, 0x8000, 0, 0]);
  f.initial[(R.COLOR00 + 25 * 2) / 2] = 0xabc;
  const { snapshot } = run(f, { origin: { x: 128, y: 257 }, lines: 4 });
  assert.strictEqual(cell(snapshot, 0, 257)[3] >>> 31, 0);
  assert.deepStrictEqual(cell(snapshot, 1, 258), [4, 0, 0x8000, 0x80000001]);
  assert.deepStrictEqual(pixel(snapshot, 4, 258), [170, 187, 204, 255]);
  assert.strictEqual(cell(snapshot, 1, 259)[3] >>> 31, 0);
});

test('sprite DMA: PAL/NTSC blanking reload and pointer low-bit masking are explicit', () => {
  for (const [standard, start] of [['PAL', 26], ['NTSC', 21]]) {
    const f = fixture();
    channel(f, 0, 0x3000, [(start << 8) | 0x41, (start + 1) << 8, 0x8000, 0, 0, 0]);
    f.initial[(R.SPR0PTH + 2) / 2] |= 1;
    const { snapshot } = run(f, { standard, origin: { x: 128, y: start - 1 }, lines: 3 });
    assert.strictEqual(cell(snapshot, 0, start - 1)[3] >>> 31, 0);
    assert.deepStrictEqual(pixel(snapshot, 4, start), red);
    assert.deepStrictEqual(pixel(snapshot, 4, start + 1), black);
  }
});

test('sprite DMA: disabling fetches holds the last armed row, while CTL disarms manual output', () => {
  const f = fixture();
  channel(f, 0, 0x3000, [0x1e41, 0x2200, 0x8000, 0, 0, 0x8000, 0, 0x8000, 0, 0x8000, 0, 0]);
  // At line 31, stop DMA before its slot; at line 33, explicitly disarm.
  write(f.chip, 0, [0x1f01, 0xfffe, R.DMACON, 0x20, 0x2101, 0xfffe, R.SPR0CTL, 0x2200, 0xffff, 0xfffe]);
  const { snapshot } = run(f);
  for (const line of [30, 31, 32]) assert.deepStrictEqual(pixel(snapshot, 4, line), red);
  assert.strictEqual(snapshot.frame.lineRegs[(31 - 28) * 32 + 16] & 4, 0);
  assert.deepStrictEqual(pixel(snapshot, 4, 33), black);
  const manual = fixture(); manual.initial[R.DMACON / 2] = 0x280;
  write(manual.chip, 0, [R.SPR0POS, 0x41, R.SPR0CTL, 0, R.SPR0DATB, 0x8000, R.SPR0DATA, 0, 0xffff, 0xfffe]);
  const held = run(manual).snapshot;
  assert.deepStrictEqual(pixel(held, 4, 30), green);
  assert.strictEqual(held.frame.lineRegs[16] & 4, 0);
});

test('sprite DMA: bounds, finite word budgets, contention and mid-line writes fail explicitly', () => {
  const invalid = fixture(); channel(invalid, 3, 524286, [0]);
  assert.throws(() => run(invalid), /sprite 3 fetch out of bounds.*beam 25:/);
  assert.throws(() => run(fixture(), { maxSpriteWords: 0 }), /sprite word budget exceeded/);
  assert.throws(() => run(fixture(), { maxSpriteWords: -1 }), /invalid sprite word budget/);
  const conflict = fixture(); conflict.initial[R.BPLCON0 / 2] = 0x1000;
  conflict.initial[R.DDFSTRT / 2] = 0x18; conflict.initial[R.DDFSTOP / 2] = 0x38;
  assert.throws(() => run(conflict), /sprite.*bitplane DMA contention/);
  const midline = fixture(); midline.initial[R.DMACON / 2] = 0x280;
  write(midline.chip, 0, [0x1e61, 0xfffe, R.SPR0DATA, 0x8000, 0xffff, 0xfffe]);
  const snapshot = run(midline).snapshot;
  assert.strictEqual(snapshot.frame.lineRegs[(30 - 28) * 32 + 17], 1);
  assert.throws(() => reference.render(snapshot.chip, snapshot.frame), /mid-line events/);
});

test('sprite DMA: common screen builder installs explicit pointers and composes raw streams with playfields', () => {
  const memory = new ChipMemory(524288), plane = memory.allocate(8000), empty = memory.allocate(4), sprite = memory.allocate(12);
  write(memory.bytes, sprite.address, [0x3c41, 0x3d00, 0x8000, 0, 0, 0]);
  const palette = new Array(32).fill(0); palette[17] = 0xf00;
  const views = [{ x: 128, y: 50, width: 320, height: 200, depth: 1, rowBytes: 40, pointers: [plane.address], palette }];
  const pointers = [sprite.address, ...new Array(7).fill(empty.address)];
  const compiled = build(views, { spritePointers: pointers });
  const list = memory.allocate(compiled.bytes.length); memory.writeBytes(list.address, compiled.bytes);
  const { snapshot } = interpret(memory.bytes, { ...compiled.interpretOptions, initialRegisters: compiled.initialRegisters, address: list.address });
  assert.deepStrictEqual(pixel(snapshot, 4, 60), red);
  assert.deepStrictEqual(pixel(snapshot, 4, 61), black);
  assert.strictEqual(compiled.initialRegisters[R.DMACON / 2], 0x3a0);
  for (const invalid of [[], pointers.slice(1), [...pointers.slice(0, 7), 1], [...pointers.slice(0, 7), -2]]) {
    assert.throws(() => build(views, { spritePointers: invalid }), /sprite pointer/);
  }
});
