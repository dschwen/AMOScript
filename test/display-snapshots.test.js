/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const model = require('../lib/display/model/frameState');
const { loadFixture, comparePixels, runFixture } = require('./helpers/displayFrames');
const { encodePng, decodePng } = require('./helpers/displayPng');
const fixturePath = path.join(__dirname, 'fixtures/display/basic-planar.frame.json');
const load = () => loadFixture(fixturePath);
const mutable = () => {
  const { snapshot } = load();
  return { chip: snapshot.chip.slice(), frame: { ...snapshot.frame } };
};

test('display snapshots: independent fixture preserves endian, planes, metadata and RGBA bytes', () => {
  const { snapshot, manifest, golden } = load();
  assert.strictEqual(manifest.evidence.kind, 'synthetic');
  assert.deepStrictEqual(Array.from(snapshot.chip.slice(0, 4)), [0xa0, 0x50, 0xf0, 0x0f]);
  assert.strictEqual(snapshot.frame.lineRegs[8], 0x1000);
  assert.strictEqual(snapshot.frame.lineRegs[32], 2);
  assert.deepStrictEqual(snapshot.frame.origin, { x: 128, y: 50 });
  assert.deepStrictEqual(Array.from(golden.rgba), [...[255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255],
    ...Array(4).fill([255, 0, 0, 255]).flat()]);
  const encoded = model.serializeSnapshot(snapshot);
  assert.deepStrictEqual(encoded.header, manifest.snapshot);
  const tables = fs.readFileSync(path.join(path.dirname(fixturePath), manifest.blobs.tables.file));
  assert.deepStrictEqual(Buffer.from(encoded.tables), tables);
  const unaligned = new Uint8Array(encoded.tables.length + 1);
  unaligned.set(encoded.tables, 1);
  const decoded = model.deserializeSnapshot(encoded.header, encoded.chip, unaligned.subarray(1));
  assert.deepStrictEqual(decoded, snapshot);
});

test('display snapshots: publication owns bytes and codec works without DOM or Node globals', () => {
  const source = mutable();
  const snapshot = model.createSnapshot(source);
  source.chip[0] = 0; source.frame.lineRegs[8] = 0; source.frame.origin = { x: 0, y: 0 };
  assert.strictEqual(snapshot.chip[0], 0xa0);
  assert.strictEqual(snapshot.frame.lineRegs[8], 0x1000);
  assert.deepStrictEqual(snapshot.frame.origin, { x: 128, y: 50 });
  assert.throws(() => { snapshot.frame.origin.x = 9; }, TypeError);
  const encoded = model.serializeSnapshot(snapshot);
  encoded.chip[0] = 0; encoded.tables[0] = 255;
  assert.strictEqual(snapshot.chip[0], 0xa0);
  assert.strictEqual(snapshot.frame.lineRegs[0], 0);
  const context = { module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../lib/display/model/frameState.js'), 'utf8'), context);
  assert.strictEqual(context.module.exports.VERSION, 1);
  assert.strictEqual(typeof context.module.exports.deserializeSnapshot, 'function');
  const wire = model.serializeSnapshot(snapshot);
  const isolated = context.module.exports.deserializeSnapshot(wire.header, wire.chip, wire.tables);
  assert.strictEqual(isolated.chip[0], 0xa0);
  assert.strictEqual(model.validateSnapshot(isolated), isolated);
});

test('display snapshots: schema, dimensions, pointer bounds and table lengths reject malformed input', () => {
  const cases = [
    [s => { s.frame.schemaVersion = 99; }, /schema version/],
    [s => { s.chip = new Uint8Array(32); }, /chip memory/],
    [s => { s.frame.outputWidth = 4097; }, /output width/],
    [s => { s.frame.interlaceField = 2; }, /field parity/],
    [s => { s.frame.outputHeight = 4; }, /field dimensions/],
    [s => { s.frame.samplesPerLowresPixel = 4; }, /sampling grid/],
    [s => { s.frame.lineRegs = new Uint32Array(1); }, /lineRegs/],
    [s => { s.frame.lineRegs[0] = 1; }, /plane pointer/],
    [s => { s.frame.lineRegs[0] = s.chip.length; }, /plane pointer/],
    [s => { s.frame.lineRegs[18] = 1; }, /reserved/],
    [s => { s.frame.extra = true; }, /frame fields/],
    [s => { s.frame.videoRate = { numerator: 50, denominator: 0 }; }, /video rate denominator/]
  ];
  for (const [change, error] of cases) {
    const source = mutable(); change(source);
    assert.throws(() => model.createSnapshot(source), error);
  }
  const source = mutable(); source.frame.interlaceField = 1; source.frame.outputHeight = 4;
  assert.strictEqual(model.createSnapshot(source).frame.lines, 2);
  source.frame.chipset = 'ECS'; source.frame.samplesPerLowresPixel = 4;
  assert.strictEqual(model.createSnapshot(source).frame.samplesPerLowresPixel, 4);
});

test('display snapshots: signed positions and stable overflow events survive without dropping writes', () => {
  const source = mutable(), frame = source.frame;
  frame.lineSprites[0] = 0xffffffff; frame.lineSprites[3] = 0x80000000;
  frame.lineRegs[17] = 3;
  frame.eventOffsets = Uint32Array.from([0, 3, 3]);
  frame.overflowEvents = Uint32Array.from([0xffffffff, 0x180, 0x123, 0, 2, 0x180, 0x456, 0, 2, 0x180, 0x789, 0]);
  frame.lineEvents.set(frame.overflowEvents.subarray(0, 8));
  const encoded = model.serializeSnapshot(source);
  const decoded = model.deserializeSnapshot(encoded.header, encoded.chip, encoded.tables);
  assert.strictEqual(decoded.frame.lineSprites[0] | 0, -1);
  assert.deepStrictEqual(Array.from(decoded.frame.overflowEvents), Array.from(frame.overflowEvents));
  frame.overflowEvents[4] = 0xfffffffe;
  assert.throws(() => model.validateSnapshot(source), /not ordered/);
  frame.overflowEvents[4] = 2; frame.lineEvents[2] = 0;
  assert.throws(() => model.validateSnapshot(source), /prefix differs/);
  frame.lineEvents[2] = 0x123; frame.eventOffsets[1] = 2;
  assert.throws(() => model.validateSnapshot(source), /overflow event count/);
});

test('display snapshots: wire bounds, strides, endian tags and trailing bytes are checked', () => {
  const encoded = model.serializeSnapshot(load().snapshot);
  const cases = [
    [h => { h.schemaVersion = 2; }, /format\/version/],
    [h => { h.tables.lineRegs.type = 'u32le'; }, /lineRegs descriptor/],
    [h => { h.tables.linePal.offset = 0; }, /linePal descriptor/],
    [h => { h.tables.linePal.stride = 4; }, /linePal descriptor/],
    [h => { h.tables.overflowEvents.length = 999999999; }, /overflow length/]
  ];
  for (const [change, error] of cases) {
    const header = JSON.parse(JSON.stringify(encoded.header)); change(header);
    assert.throws(() => model.deserializeSnapshot(header, encoded.chip, encoded.tables), error);
  }
  assert.throws(() => model.deserializeSnapshot(encoded.header, encoded.chip.subarray(1), encoded.tables), /chip blob/);
  assert.throws(() => model.deserializeSnapshot(encoded.header, encoded.chip, encoded.tables.subarray(1)), /table blob/);
  const trailing = new Uint8Array(encoded.tables.length + 4);
  trailing.set(encoded.tables);
  assert.throws(() => model.deserializeSnapshot({ ...encoded.header, tablesByteLength: trailing.length }, encoded.chip, trailing), /trailing table/);
});

test('display diff: exact bytes count pixels and channels with bounded top-left mismatch reports', () => {
  const expected = Uint8ClampedArray.from([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255]);
  const actual = expected.slice(); actual[2]++; actual[8]++; actual[11] = 0;
  const report = comparePixels(2, 2, actual, expected, 1);
  assert.strictEqual(report.pass, false);
  assert.strictEqual(report.mismatchPixels, 2); assert.strictEqual(report.mismatchBytes, 3);
  assert.deepStrictEqual(report.first, [{ x: 0, y: 0, expected: [1, 2, 3, 255], actual: [1, 2, 4, 255] }]);
  assert.deepStrictEqual(Array.from(report.diff), [255, 0, 255, 255, 0, 0, 0, 255, 255, 0, 255, 255, 0, 0, 0, 255]);
  assert.strictEqual(comparePixels(2, 2, expected, expected).pass, true);
  assert.throws(() => comparePixels(2, 2, new Uint8Array(1), expected), /RGBA/);
  assert.throws(() => comparePixels(2, 2, actual, expected, -1), /dimensions\/limit/);
});

test('display fixtures: stub renderer produces pass/fail, PNG artifacts and preserved evidence', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'amos-display-'));
  try {
    const stub = () => load().golden.rgba.slice();
    const passed = await runFixture(fixturePath, stub, { backend: 'stub', artifactDirectory: directory });
    assert.strictEqual(passed.pass, true); assert.strictEqual(passed.backend, 'stub');
    assert.strictEqual(passed.evidence.kind, 'synthetic');
    const isolated = await runFixture(fixturePath,
      () => vm.runInNewContext('new Uint8ClampedArray(pixels)', { pixels: stub() }),
      { backend: 'headless-vm-stub', artifactDirectory: directory });
    assert.strictEqual(isolated.pass, true);
    const failed = await runFixture(fixturePath, () => { const pixels = stub(); pixels[0] = 0; return pixels; },
      { backend: 'fault-injected-stub', artifactDirectory: directory });
    assert.strictEqual(failed.mismatchPixels, 1);
    assert.deepStrictEqual(Array.from(decodePng(fs.readFileSync(path.join(directory, 'diff.png'))).rgba.slice(0, 8)),
      [255, 0, 255, 255, 0, 0, 0, 255]);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(directory, 'report.json'))).pass, false);
    await assert.rejects(() => runFixture(fixturePath, stub), /backend name/);
    await assert.rejects(() => runFixture(fixturePath, () => { throw new Error('renderer failure'); }, { backend: 'stub' }), /renderer failure/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('display fixtures: corruption, unsafe filenames and falsely attributed captures reject before rendering', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'amos-display-'));
  try {
    const manifest = JSON.parse(fs.readFileSync(fixturePath));
    for (const descriptor of Object.values(manifest.blobs)) {
      fs.copyFileSync(path.join(path.dirname(fixturePath), descriptor.file), path.join(directory, descriptor.file));
    }
    const filename = path.join(directory, 'case.frame.json');
    const write = () => fs.writeFileSync(filename, JSON.stringify(manifest));
    const chipPath = path.join(directory, manifest.blobs.chip.file);
    const chip = fs.readFileSync(chipPath); chip[0] ^= 1; fs.writeFileSync(chipPath, chip); write();
    assert.throws(() => loadFixture(filename), /hash mismatch/);
    fs.writeFileSync(chipPath, chip.subarray(1));
    assert.throws(() => loadFixture(filename), /length mismatch/);
    manifest.blobs.chip.file = '../outside'; write();
    assert.throws(() => loadFixture(filename), /blob descriptor/);
    manifest.evidence.kind = 'reference-capture'; write();
    assert.throws(() => loadFixture(filename), /environment and capture procedure/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('display PNG: canonical artifacts preserve exact RGBA and reject corruption/limits', () => {
  const expected = load().golden;
  const png = encodePng(expected.width, expected.height, expected.rgba);
  assert.deepStrictEqual(decodePng(png), expected);
  const corrupt = Buffer.from(png); corrupt[corrupt.length - 1] ^= 1;
  assert.throws(() => decodePng(corrupt), /CRC/);
  assert.throws(() => decodePng(png.subarray(0, -5)), /Truncated/);
  assert.throws(() => decodePng(Buffer.from('invalid')), /signature/);
  assert.throws(() => encodePng(4097, 1, new Uint8Array(1)), /dimensions/);
  assert.throws(() => encodePng(2, 2, new Uint8Array(1)), /RGBA/);
});

test('display PNG: independently filtered RGB/RGBA fixtures decode all five filters exactly', () => {
  for (const channels of [3, 4]) {
    const file = path.join(__dirname, `fixtures/display/filters-${channels === 3 ? 'rgb' : 'rgba'}.png`);
    const decoded = decodePng(fs.readFileSync(file));
    assert.strictEqual(decoded.width, 2); assert.strictEqual(decoded.height, 5);
    const expected = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 2; x++) {
      for (let channel = 0; channel < 4; channel++) expected.push(channel === 3 && channels === 3 ? 255 : (y * 41 + x * 17 + channel * 29) & 255);
    }
    assert.deepStrictEqual(Array.from(decoded.rgba), expected);
  }
});
