/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const model = require('../lib/display/model/frameState');
const readIlbm = require('../lib/display/model/ilbm');
const reference = require('../lib/display/reference/render');
const staticFrame = require('../lib/display/model/staticFrame');
const composeField = require('../lib/display/presentation/composeField');
const { decodePng } = require('./helpers/displayPng');
const { comparePixels } = require('./helpers/displayFrames');
const directory = path.join(__dirname, 'fixtures/display');
const fixtures = JSON.parse(fs.readFileSync(path.join(directory, 'laced-fixtures.json')));
function read(descriptor) {
  const bytes = fs.readFileSync(path.join(directory, descriptor.file));
  assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), descriptor.sha256);
  return bytes;
}

test('display fields: independent even/odd, hires and EHB IFFs weave to full PNGs in either field order', () => {
  assert.strictEqual(fixtures.evidence.kind, 'synthetic');
  for (const fixture of fixtures.fixtures) for (const kind of ['raw', 'byterun']) {
    const bytes = read(fixture.files[kind]), golden = decodePng(read(fixture.files.golden));
    const fields = [0, 1].map(field => readIlbm(bytes, { field }).snapshot);
    for (const field of [0, 1]) {
      const { chip, frame } = fields[field];
      assert.strictEqual(frame.interlaceField, field); assert.strictEqual(frame.outputHeight, fixture.height);
      assert.strictEqual(frame.lines, Math.ceil((fixture.height - field) / 2));
      assert.strictEqual(frame.lineRegs[0], field * 6);
      assert.strictEqual(frame.lineRegs[32], (field + 2) * 6);
      const wire = model.serializeSnapshot(fields[field]);
      assert.deepStrictEqual(model.deserializeSnapshot(wire.header, wire.chip, wire.tables), fields[field]);
      assert.strictEqual(reference.render(chip, frame).length, golden.width * frame.lines * 4);
    }
    for (const order of [[0, 1], [1, 0]]) {
      let output = null;
      for (const index of order) {
        const { chip, frame } = fields[index];
        output = composeField(frame, reference.render(chip, frame), output);
      }
      const diff = comparePixels(golden.width, golden.height, output, golden.rgba);
      assert.strictEqual(diff.pass, true, JSON.stringify({ fixture: fixture.name, kind, order, first: diff.first }));
    }
  }
});

test('display fields: incomplete history is opaque black and supplied history remains owned by its caller', () => {
  const { snapshot } = readIlbm(read(fixtures.fixtures[1].files.raw), { field: 0 });
  const rgba = reference.render(snapshot.chip, snapshot.frame);
  const first = composeField(snapshot.frame, rgba);
  const stride = snapshot.frame.outputWidth * 4;
  assert.deepStrictEqual(Array.from(first.slice(stride, stride + 4)), [0, 0, 0, 255]);
  const previous = new Uint8ClampedArray(first.length).fill(7), saved = previous.slice();
  const next = composeField(snapshot.frame, rgba, previous);
  assert.deepStrictEqual(previous, saved);
  assert.deepStrictEqual(Array.from(next.slice(stride, stride + 4)), [7, 7, 7, 7]);
  next[0] ^= 1;
  assert.strictEqual(rgba[0], first[0]);
});

test('display fields: line doubling, empty odd fields and noninterlaced copies have explicit semantics', () => {
  const chip = new Uint8Array(524288);
  const frame = staticFrame({ width: 1, height: 2, depth: 1, pointers: [0], rowBytes: 2,
    palette: [0, 0xf00], interlaceField: 1, outputHeight: 5 });
  chip[2] = 0x80;
  const rgba = reference.render(chip, frame), doubled = composeField(frame, rgba, null, 'line-double');
  const stride = frame.outputWidth * 4;
  assert.deepStrictEqual(Array.from(doubled.slice(0, 4)), [0, 0, 0, 255]);
  for (const y of [2, 3, 4]) assert.deepStrictEqual(Array.from(doubled.slice(y * stride, y * stride + 4)), [255, 0, 0, 255]);
  const empty = staticFrame({ width: 1, height: 0, depth: 1, pointers: [0], rowBytes: 2,
    palette: [0], interlaceField: 1, outputHeight: 1 });
  model.createSnapshot({ chip, frame: empty });
  const emptyPixels = reference.render(chip, empty), previous = Uint8ClampedArray.from([1, 2, 3, 255, 1, 2, 3, 255]);
  assert.strictEqual(emptyPixels.length, 0);
  assert.deepStrictEqual(composeField(empty, emptyPixels, previous), previous);
  const plain = { ...frame, interlaceField: null, outputHeight: 2 };
  const copy = composeField(plain, rgba); copy[0] = 1;
  assert.strictEqual(rgba[0], 0);
});

test('display fields: invalid parity/dimensions, byte lengths and history sizes reject; VM arrays work', () => {
  const { snapshot } = readIlbm(read(fixtures.fixtures[1].files.raw), { field: 1 });
  const { chip, frame } = snapshot, pixels = reference.render(chip, frame);
  assert.throws(() => composeField({ ...frame, lines: 3 }, pixels), /field dimensions/);
  assert.throws(() => composeField({ ...frame, interlaceField: 2 }, pixels), /field parity/);
  assert.throws(() => composeField(frame, pixels.slice(1)), /current-field RGBA/);
  assert.throws(() => composeField(frame, pixels, new Uint8Array(1)), /previous output dimensions/);
  assert.throws(() => composeField(frame, pixels, null, 'blend'), /Unsupported/);
  const isolated = vm.runInNewContext('new Uint8ClampedArray(pixels)', { pixels });
  assert.deepStrictEqual(composeField(frame, isolated), composeField(frame, pixels));
  assert.throws(() => readIlbm(read(fixtures.fixtures[0].files.raw), { field: 2 }), /field selection/);
});
