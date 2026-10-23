/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readIlbm = require('../lib/display/model/ilbm');
const reference = require('../lib/display/reference/render');
const { comparePixels } = require('./helpers/displayFrames');
const { decodePng } = require('./helpers/displayPng');
const directory = path.join(__dirname, 'fixtures/display');
const fixtures = JSON.parse(fs.readFileSync(path.join(directory, 'ilbm-fixtures.json')));
function read(descriptor) {
  const bytes = fs.readFileSync(path.join(directory, descriptor.file));
  assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), descriptor.sha256);
  return bytes;
}
function chunk(tag, data) {
  const result = Buffer.alloc(8 + data.length + (data.length & 1));
  result.write(tag, 0); result.writeUInt32BE(data.length, 4); data.copy(result, 8);
  return result;
}
// Independent small protocol fixture constructor, deliberately not a production
// encoder. The captured file matrix above is independent of this too.
function small(body, options = {}) {
  const bmhd = Buffer.from('00100001000000000100000000000a0b00100001', 'hex');
  bmhd[9] = options.masking || 0; bmhd[10] = options.compression || 0;
  const payload = Buffer.concat([Buffer.from('ILBM'), chunk('BMHD', bmhd),
    chunk('CMAP', Buffer.from('000000ff0000', 'hex')), ...(options.extra || []), chunk('BODY', Buffer.from(body))]);
  const form = Buffer.alloc(8); form.write('FORM'); form.writeUInt32BE(payload.length, 4);
  return Buffer.concat([form, payload]);
}

test('ILBM: independent 2/4/8/16/32-colour files match PNGs with raw and ByteRun1 row decoding', () => {
  assert.strictEqual(fixtures.evidence.kind, 'synthetic');
  for (const fixture of fixtures.fixtures) {
    const golden = decodePng(read(fixture.files.golden));
    const snapshots = [];
    for (const kind of ['raw', 'byterun']) {
      const bytes = read(fixture.files[kind]);
      const padded = Buffer.concat([Buffer.from([0]), bytes, Buffer.from([0])]);
      const { snapshot, image, mask } = readIlbm(padded.subarray(1, -1));
      assert.deepStrictEqual([image.width, image.height, image.depth, image.rowBytes], [33, 3, fixture.depth, 6]);
      assert.strictEqual(image.x, -3); assert.strictEqual(image.y, 4); assert.strictEqual(mask, null);
      assert.deepStrictEqual(snapshot.frame.pixelAspect, { numerator: 10, denominator: 22 });
      const report = comparePixels(golden.width, golden.height, reference.render(snapshot.chip, snapshot.frame), golden.rgba);
      assert.strictEqual(report.pass, true, JSON.stringify({ depth: fixture.depth, kind, first: report.first }));
      snapshots.push(snapshot);
    }
    assert.deepStrictEqual(snapshots[0].chip, snapshots[1].chip);
  }
});

test('ILBM: ByteRun1 repeat/literal/NOP packets respect row boundaries and reject truncation', () => {
  for (const [body, expected] of [
    [[128, 255, 0x81, 128], [0x81, 0x81]],
    [[128, 1, 0x80, 0, 128], [0x80, 0]]
  ]) {
    const decoded = readIlbm(small(body, { compression: 1 }));
    assert.deepStrictEqual(Array.from(decoded.snapshot.chip.slice(0, 2)), expected);
  }
  for (const [body, error] of [
    [[254, 0xff], /crosses row boundary/],
    [[2, 0, 0, 0], /crosses row boundary/],
    [[1, 0], /truncated ByteRun1 literal/],
    [[255], /truncated ByteRun1 repeat/],
    [[128], /truncated ByteRun1 row/],
    [[255, 0, 0], /trailing BODY data/]
  ]) assert.throws(() => readIlbm(small(body, { compression: 1 })), error);
  assert.throws(() => readIlbm(small([0])), /truncated uncompressed row/);
  assert.throws(() => readIlbm(small([0, 0, 0, 0])), /trailing BODY data/);
});

test('ILBM: masks are deinterleaved and retained as brush metadata, not mixed with colour planes', () => {
  const source = small([0x80, 0, 0x40, 0], { masking: 1 });
  const { snapshot, image, mask } = readIlbm(source);
  assert.strictEqual(image.masking, 1);
  assert.deepStrictEqual(Array.from(mask), [0x40, 0]);
  assert.deepStrictEqual(Array.from(snapshot.chip.slice(0, 4)), [0x80, 0, 0, 0]);
  assert.strictEqual(reference.explainPixel(snapshot.chip, snapshot.frame, 0, 0).rawIndex, 1);
  const transparent = readIlbm(small([0x80, 0], { masking: 2 }));
  assert.strictEqual(transparent.mask, null); assert.strictEqual(transparent.image.transparentColour, 0);
  assert.throws(() => readIlbm(small([0, 0], { masking: 3 })), /masking/);
});

test('ILBM: CMAP uses high nibbles and CAMG hires changes native sampling without losing pixels', () => {
  const camg = Buffer.alloc(4); camg.writeUInt32BE(0x8000);
  const bytes = small([0x80, 0], { extra: [chunk('CAMG', camg)] });
  const at = bytes.indexOf(Buffer.from('CMAP')) + 8;
  bytes.set([0x12, 0x34, 0x56, 0xf0, 0xe0, 0xd0], at);
  const { snapshot } = readIlbm(bytes);
  assert.strictEqual(snapshot.frame.outputWidth, 16);
  assert.deepStrictEqual(Array.from(reference.render(snapshot.chip, snapshot.frame).slice(0, 8)), [255, 238, 221, 255, 17, 51, 85, 255]);
  assert.deepStrictEqual(snapshot.frame.pixelAspect, { numerator: 10, denominator: 11 });
});

test('ILBM: FORM/chunk bounds, semantic extensions, unsupported modes and malformed headers reject', () => {
  const original = small([0, 0]);
  const cases = [
    [b => b.writeUInt32BE(9999, 4), /FORM bounds/],
    [b => b.writeUInt32BE(9999, 16), /truncated chunk/],
    [b => b.writeUInt16BE(0, 20), /dimensions\/depth/],
    [b => { b[28] = 7; }, /dimensions\/depth/],
    [b => { b[30] = 2; }, /compression/]
  ];
  for (const [change, error] of cases) {
    const bytes = Buffer.from(original); change(bytes);
    assert.throws(() => readIlbm(bytes), error);
  }
  const transparent = small([0, 0], { masking: 2 }); transparent.writeUInt16BE(9, 32);
  assert.throws(() => readIlbm(transparent), /transparent colour/);
  assert.throws(() => readIlbm(original.subarray(0, -1)), /FORM bounds/);
  assert.throws(() => readIlbm(small([0, 0], { extra: [chunk('DEST', Buffer.alloc(0))] })), /unsupported DEST/);
  assert.throws(() => readIlbm(small([0, 0], { extra: [chunk('CAMG', Buffer.from('00001000', 'hex'))] })), /unsupported CAMG/);
  assert.throws(() => readIlbm(small([0, 0], { extra: [chunk('CMAP', Buffer.alloc(3))] })), /duplicate CMAP/);
  const huge = Buffer.from(original);
  huge.writeUInt16BE(1024, 20); huge.writeUInt16BE(1023, 22); huge[28] = 5;
  assert.throws(() => readIlbm(huge, { chipBytes: 524288 }), /ILBM at byte 20: image exceeds chip capacity/);
});
