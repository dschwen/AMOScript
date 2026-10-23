/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ChipMemory = require('../lib/display/model/ChipMemory');
const staticFrame = require('../lib/display/model/staticFrame');
const model = require('../lib/display/model/frameState');
const reference = require('../lib/display/reference/render');
const createDisplay = require('../lib/amos/display');
const { runFixture } = require('./helpers/displayFrames');
const { execute } = require('./helpers/program');

function screenFrame(options = {}) {
  return staticFrame({ width: 16, height: 1, depth: 1, pointers: [0], rowBytes: 2, palette: [0, 0xf00], ...options });
}
function indices(chip, frame) {
  return Array.from({ length: frame.outputWidth * frame.lines }, (_, i) =>
    reference.explainPixel(chip, frame, i % frame.outputWidth, Math.floor(i / frame.outputWidth)).rawIndex);
}
function assertPlayfield(display, id = display.current) {
  const target = display.screen(id), old = display.rgba(id), samples = target.mode === 0x8000 ? 1 : 2;
  const expected = new Uint8ClampedArray(old.length * samples);
  for (let i = 0; i < old.length / 4; i++) for (let sample = 0; sample < samples; sample++) {
    expected.set(old.subarray(i * 4, i * 4 + 4), (i * samples + sample) * 4);
  }
  assert.deepStrictEqual(Array.from(display.renderPlayfield(id)), Array.from(expected));
}

test('chip memory: words are big-endian, accesses are bounded and snapshots own bytes', () => {
  const memory = new ChipMemory(524288);
  memory.writeWord(0, 0x8123); memory.writeWord(524286, 0xfedc);
  assert.deepStrictEqual(Array.from(memory.readBytes(0, 2)), [0x81, 0x23]);
  assert.strictEqual(memory.readWord(524286), 0xfedc);
  const copy = memory.snapshot(); copy[0] = 0;
  assert.strictEqual(memory.readWord(0), 0x8123);
  const read = memory.readBytes(0, 2); read[0] = 0;
  assert.strictEqual(memory.bytes[0], 0x81);
  assert.throws(() => memory.readWord(1), /Unaligned/);
  assert.throws(() => memory.writeWord(524288, 1), /out of bounds/);
  assert.throws(() => memory.writeWord(0, 65536), /Invalid chip word/);
  assert.throws(() => memory.writeBytes(-1, new Uint8Array(1)), /out of bounds/);
  assert.throws(() => new ChipMemory(32), /size/);
});

test('chip memory: dirty revisions remain available independently and expired history requires full upload', () => {
  const memory = new ChipMemory(524288, 2);
  assert.deepStrictEqual(memory.dirtySince(-1), { revision: 0, full: true, rows: [[0, 256]] });
  memory.writeBytes(2047, Uint8Array.of(1, 2));
  const first = memory.dirtySince(0);
  assert.deepStrictEqual(first, { revision: 1, full: false, rows: [[0, 2]] });
  first.rows[0][1] = 9;
  assert.deepStrictEqual(memory.dirtySince(0).rows, [[0, 2]]);
  memory.writeWord(8192, 1);
  assert.deepStrictEqual(memory.dirtySince(1).rows, [[4, 5]]);
  assert.deepStrictEqual(memory.dirtySince(0).rows, [[0, 2], [4, 5]]);
  memory.writeWord(8192, 1);
  assert.strictEqual(memory.revision, 2);
  memory.bytes[4096] = 1; memory.markDirty(4096, 1);
  assert.deepStrictEqual(memory.dirtySince(0), { revision: 3, full: true, rows: [[0, 256]] });
  assert.deepStrictEqual(memory.dirtySince(1).rows, [[2, 3], [4, 5]]);
  assert.deepStrictEqual(memory.dirtySince(3).rows, []);
  assert.throws(() => memory.dirtySince(4), /revision/);
});

test('chip memory: allocations align, fail without mutation, clear on release and coalesce', () => {
  const memory = new ChipMemory(524288), other = new ChipMemory(524288);
  const a = memory.allocate(3), b = memory.allocate(4, 8);
  assert.deepStrictEqual(a, { address: 0, length: 3 });
  assert.deepStrictEqual(b, { address: 8, length: 4 });
  memory.writeWord(b.address, 0xffff);
  assert.throws(() => memory.allocate(524289), /exhausted/);
  assert.strictEqual(memory.readWord(b.address), 0xffff);
  assert.throws(() => other.free(a), /handle/);
  memory.free(a); memory.free(b);
  assert.strictEqual(memory.readWord(8), 0);
  assert.deepStrictEqual(memory.allocate(524288), { address: 0, length: 524288 });
  assert.throws(() => memory.free(b), /handle/);
  assert.throws(() => memory.allocate(1, 3), /allocation/);
});

test('planar reference: independent golden renders with the real decoder and pixel explanation', async () => {
  const file = path.join(__dirname, 'fixtures/display/basic-planar.frame.json');
  const report = await runFixture(file, reference.render, { backend: 'js-reference' });
  assert.strictEqual(report.pass, true);
  const { loadFixture } = require('./helpers/displayFrames');
  const { chip, frame } = loadFixture(file).snapshot;
  const pixel = reference.explainPixel(chip, frame, 1, 0);
  assert.strictEqual(pixel.final, '#ff0000'); assert.strictEqual(pixel.rawIndex, 1);
  assert.deepStrictEqual(pixel.planes, [{ plane: 1, pointer: 0, byteAddress: 0, byte: 0xa0, bitPosition: 7, bit: 1 }]);
  assert.strictEqual(reference.explainPixel(chip, frame, 2, 0).rawIndex, 0);
  assert.strictEqual(reference.explainPixel(chip, frame, 0, 1).planes[0].byteAddress, 2);
});

test('planar reference: all five planes distinguish MSB-first bytes, word boundaries, stride and rows', () => {
  const chip = new Uint8Array(524288), pointers = [0, 8, 16, 24, 32];
  const frame = screenFrame({ width: 17, height: 2, depth: 5, pointers, rowBytes: 4,
    palette: Array.from({ length: 32 }, (_, index) => ((index & 15) << 8) | ((index >> 4) << 4)) });
  for (let plane = 0; plane < 5; plane++) {
    chip.fill(0); chip.set([0x81, 0x81, 0x80, 0], pointers[plane]); chip[pointers[plane] + 4] = 0x40;
    const expected = Array.from({ length: 34 }, (_, i) =>
      i < 17 ? ([0, 7, 8, 15, 16].includes(i) ? 1 << plane : 0) : i === 18 ? 1 << plane : 0).flatMap(index => [index, index]);
    assert.deepStrictEqual(indices(chip, frame), expected);
    const rgba = reference.render(chip, frame);
    for (let i = 0; i < expected.length; i++) {
      const index = expected[i];
      assert.deepStrictEqual(Array.from(rgba.subarray(i * 4, i * 4 + 4)), [(index & 15) * 17, (index >> 4) * 17, 0, 255]);
    }
  }
});

test('planar reference: native lowres sampling, horizontal border and DMA flags select palette zero', () => {
  const chip = new Uint8Array(524288); chip[0] = 0x80;
  const frame = screenFrame({ width: 4 });
  frame.lineRegs[13] = 2; frame.lineRegs[14] = 6;
  assert.deepStrictEqual(indices(chip, frame), [0, 0, 1, 1, 0, 0, 0, 0]);
  assert.strictEqual(reference.explainPixel(chip, frame, 0, 0).active, false);
  frame.lineRegs[16] = 2;
  assert.deepStrictEqual(indices(chip, frame), Array(8).fill(0));
  frame.lineRegs[16] = 3; frame.lineRegs[13] = 0xffffffff; frame.lineRegs[14] = 7;
  assert.deepStrictEqual(indices(chip, frame), [1, 0, 0, 0, 0, 0, 0, 0]);
});

test('planar reference: unsupported modes/events/sprites and out-of-bounds fetches fail with raster context', () => {
  const chip = new Uint8Array(524288);
  for (const change of [frame => { frame.lineRegs[8] |= 0x800; }, frame => { frame.lineRegs[9] = 0x100; },
    frame => { frame.lineRegs[17] = 1; frame.lineEvents[1] = 0x180; },
    frame => { frame.lineSprites[3] = 0x80000002; }]) {
    const frame = screenFrame(); change(frame);
    assert.throws(() => reference.render(chip, frame), /not implemented|unsupported/);
  }
  const frame = screenFrame({ width: 17, rowBytes: 4 });
  frame.lineRegs[0] = chip.length - 2;
  assert.throws(() => reference.render(chip, frame), /fetch out of bounds on line 0, x 32/);
  assert.throws(() => reference.explainPixel(chip, screenFrame(), -1, 0), /pixel out of bounds/);
});

test('physical bridge: raw writes, padding and palettes export physical pixels without changing Point', () => {
  const display = createDisplay({ snapshotChipBytes: 524288 });
  const target = display.open(1, 17, 2, 4, 0);
  display.clear(0); target.pixels[0] = 1; target.pixels[16] = 2;
  const first = display.snapshotPlayfield();
  const pointers = Array.from(first.frame.lineRegs.slice(0, 2));
  assert.strictEqual(first.chip[pointers[0]], 0x80);
  assert.strictEqual(first.chip[pointers[1] + 2], 0x80);
  assert.strictEqual(first.chip[pointers[1] + 3], 0);
  assertPlayfield(display);
  const version = display.version;
  target.pixels[1] = 3;
  const second = display.snapshotPlayfield();
  assert.strictEqual(display.version, version);
  assert.ok(second.frame.revision > first.frame.revision);
  assert.strictEqual(first.chip[pointers[0]], 0x80);
  assert.strictEqual(second.chip[pointers[0]], 0xc0);
  display.setColour(3, 0x123); assertPlayfield(display);
  assert.strictEqual(display.point(1, 0), 3);
  assert.deepStrictEqual(Array.from(display.snapshotPlayfield().chip), Array.from(second.chip));
});

test('physical bridge: Screen Swap retains allocation identity and logical drawing stays hidden', () => {
  const display = createDisplay({ snapshotChipBytes: 524288 });
  display.open(1, 16, 8, 4, 0); display.clear(0);
  const a = display.snapshotPlayfield();
  display.doubleBuffer(); display.autoback(0); display.plot(0, 0, 1);
  const hidden = display.snapshotPlayfield();
  assert.strictEqual(hidden.frame.lineRegs[0], a.frame.lineRegs[0]);
  assert.strictEqual(hidden.chip[hidden.frame.lineRegs[0]], 0);
  assert.strictEqual(display.point(0, 0), 1); assertPlayfield(display);
  display.swap();
  const b = display.snapshotPlayfield();
  assert.notStrictEqual(b.frame.lineRegs[0], a.frame.lineRegs[0]);
  assert.strictEqual(b.chip[b.frame.lineRegs[0]], 0x80); assertPlayfield(display);
  display.swap();
  assert.strictEqual(display.snapshotPlayfield().frame.lineRegs[0], a.frame.lineRegs[0]);
  assertPlayfield(display);
});

test('physical bridge: Autoback modes and hires retain the indexed physical result', () => {
  for (const mode of [0, 1, 2]) for (const hires of [false, true]) {
    const display = createDisplay({ snapshotChipBytes: 524288 });
    display.open(1, 17, 8, 4, hires ? 0x8000 : 0); display.clear(0); display.doubleBuffer(); display.autoback(mode);
    display.plot(16, 0, 3); assertPlayfield(display);
    display.swap(); assertPlayfield(display);
    display.ink(2); display.bar(0, 0, 8, 7); assertPlayfield(display);
    display.swap(); assertPlayfield(display);
    assert.strictEqual(display.snapshotPlayfield().frame.outputWidth, hires ? 17 : 34);
  }
});

test('physical bridge: screen cleanup recycles memory and capacity/errors preserve the indexed display', () => {
  const display = createDisplay({ snapshotChipBytes: 524288 });
  for (let i = 0; i < 4; i++) {
    display.open(1, 512, 512, 32, 0);
    assert.strictEqual(display.snapshotPlayfield().frame.lineRegs[0], 0);
  }
  display.open(1, 1024, 1023, 32, 0);
  assert.throws(() => display.snapshotPlayfield(), /Chip memory exhausted/);
  assert.strictEqual(display.point(0, 0), 1);
  display.close(1); display.open(2, 8, 8, 2, 0);
  assert.strictEqual(display.snapshotPlayfield().frame.lineRegs[0], 0);
  display.screen().physicalPixels[0] = 2;
  assert.throws(() => display.snapshotPlayfield(), /Invalid indexed pixel/);
});

test('physical bridge: standalone factories export text/images and buffered Bobs without require', () => {
  for (const file of ['Graphics.AMOS', 'Bobs.AMOS', 'Test14.AMOS']) {
    const source = fs.readFileSync(path.join(__dirname, '../examples', file));
    const { program, timers } = execute(source);
    assertPlayfield(program.display);
    const hardware = program.display.snapshotDisplay();
    assert.deepStrictEqual(Array.from(reference.render(hardware.chip, hardware.frame)), Array.from(program.display.renderPlayfield()));
    if (file === 'Bobs.AMOS') {
      for (let i = 0; i < 3; i++) {
        program.sendKey('x'); timers.runAll(); assertPlayfield(program.display);
        assert.deepStrictEqual(Array.from(program.display.renderDisplay()), Array.from(program.display.renderPlayfield()));
      }
    }
    const snapshot = program.display.snapshotPlayfield();
    assert.strictEqual(model.validateSnapshot(snapshot), snapshot);
  }
});
