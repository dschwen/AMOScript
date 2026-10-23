/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const staticFrame = require('../lib/display/model/staticFrame');
const reference = require('../lib/display/reference/render');
const readIlbm = require('../lib/display/model/ilbm');
const composeField = require('../lib/display/presentation/composeField');
const createDisplay = require('../lib/amos/display');
const { decodePng } = require('./helpers/displayPng');
const { comparePixels } = require('./helpers/displayFrames');
const { binary, token: t, word: w, dword, integer: n, identifier: id, text, execute } = require('./helpers/program');
const directory = path.join(__dirname, 'fixtures/display');
const corpus = JSON.parse(fs.readFileSync(path.join(directory, 'ham-fixtures.json')));
function read(descriptor) {
  const bytes = fs.readFileSync(path.join(directory, descriptor.file));
  assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), descriptor.sha256);
  return bytes;
}
function pattern(rows, depth = 6) {
  const width = rows[0].length, height = rows.length, rowBytes = Math.ceil(width / 16) * 2;
  const chip = new Uint8Array(524288);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let plane = 0; plane < depth; plane++) {
    if (rows[y][x] & (1 << plane)) chip[plane * rowBytes * height + y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
  }
  const frame = staticFrame({ width, height, depth, pointers: Array.from({ length: depth }, (_, plane) => plane * rowBytes * height),
    rowBytes, palette: [0x123, 0x456, 0x789, 0xabc], ham: true });
  return { chip, frame };
}
const pixel = (rgba, width, x, y = 0) => Array.from(rgba.slice((y * width + x) * 4, (y * width + x + 1) * 4));

test('HAM: ten independent six-plane IFF images, five-plane and laced variants match PNG goldens', () => {
  assert.strictEqual(corpus.evidence.kind, 'synthetic');
  assert.ok(corpus.fixtures.filter(fixture => fixture.depth === 6 && !(fixture.mode & 4)).length >= 10);
  for (const fixture of corpus.fixtures) for (const kind of ['raw', 'byterun']) {
    const bytes = read(fixture.files[kind]), golden = decodePng(read(fixture.files.golden));
    let output;
    if (fixture.mode & 4) {
      for (const field of [0, 1]) {
        const { snapshot } = readIlbm(bytes, { field });
        output = composeField(snapshot.frame, reference.render(snapshot.chip, snapshot.frame), output);
      }
    } else {
      const { snapshot, image } = readIlbm(bytes);
      assert.strictEqual(image.mode, 0x800); assert.strictEqual(image.depth, fixture.depth);
      output = reference.render(snapshot.chip, snapshot.frame);
    }
    const diff = comparePixels(golden.width, golden.height, output, golden.rgba);
    assert.strictEqual(diff.pass, true, JSON.stringify({ seed: fixture.seed, kind, first: diff.first }));
  }
});

test('HAM: component commands, palette reset and line-start carry are exact on duplicated native samples', () => {
  const { chip, frame } = pattern([[0x1f, 0x20, 0x37, 3, 0x11, 0x2e, 0x34], [0x1f, 0x20, 0x37, 3, 0x11, 0x2e, 0x34]]);
  const rgba = reference.render(chip, frame);
  const expected = [[17, 34, 255, 255], [0, 34, 255, 255], [0, 119, 255, 255], [170, 187, 204, 255],
    [170, 187, 17, 255], [238, 187, 17, 255], [238, 68, 17, 255]];
  for (const y of [0, 1]) for (let x = 0; x < 14; x++) {
    assert.deepStrictEqual(pixel(rgba, 14, x, y), expected[Math.floor(x / 2)]);
    assert.strictEqual(reference.explainPixel(chip, frame, x, y).ham.sourcePixelsProcessed, Math.floor(x / 2) + 1);
  }
  const trace = reference.explainPixel(chip, frame, 10, 0);
  assert.strictEqual(trace.mode, 'HAM6'); assert.strictEqual(trace.ham.operation, 'red');
  assert.strictEqual(trace.palette.source, 'hold-modify'); assert.strictEqual(trace.palette.index, null);
  assert.deepStrictEqual(trace.ham.previous, [170, 187, 17, 255]);
});

test('HAM: long modify-only runs and absent sixth plane keep the correct channel history', () => {
  const codes = Array.from({ length: 257 }, (_, x) => ((1 + x % 3) << 4) | (x & 15));
  const { chip, frame } = pattern([codes]);
  const output = reference.render(chip, frame);
  // The final three channel writes are green=14, blue=15, red=0.
  assert.deepStrictEqual(pixel(output, 514, 512), [0, 238, 255, 255]);
  const five = pattern([[0x1f, 0x10, 0x11, 3, 0x1a]], 5);
  const rgba = reference.render(five.chip, five.frame);
  assert.deepStrictEqual(pixel(rgba, 10, 0), [17, 34, 255, 255]);
  assert.deepStrictEqual(pixel(rgba, 10, 2), [17, 34, 0, 255]);
  assert.deepStrictEqual(pixel(rgba, 10, 8), [170, 187, 170, 255]);
});

test('HAM: cropped prefixes carry into the visible window and borders do not inherit modifications', () => {
  const { chip, frame } = pattern([[0x1f, 0x2a, 0x33, 0x10]]);
  frame.outputWidth = 6; frame.lineRegs[13] = (-4) >>> 0; frame.lineRegs[14] = 4;
  const output = reference.render(chip, frame);
  assert.deepStrictEqual(pixel(output, 6, 0), [170, 51, 255, 255]);
  assert.deepStrictEqual(pixel(output, 6, 2), [170, 51, 0, 255]);
  assert.deepStrictEqual(pixel(output, 6, 4), [17, 34, 51, 255]);
  assert.strictEqual(reference.explainPixel(chip, frame, 0, 0).ham.sourcePixelsProcessed, 3);
  frame.lineRegs[13] = (-9000) >>> 0;
  assert.throws(() => reference.render(chip, frame), /HAM source span.*line 0/);
});

test('HAM: source-encoded Screen Open retains six-bit DATA/array/procedure pixel codes and palette dependence', () => {
  const array = () => [id('a', 6, 0x40), t('('), n(0), t(')')];
  const source = binary([
    [t('Dim'), array()], [t('Data'), w(0), n(4096), t(','), n(42)], [t('Read'), id('colours'), t(','), array()],
    [w(0x09ea), n(0), t(','), n(320), t(','), n(200), t(','), id('colours'), t(','), t('Lowres')],
    [t('Cls Colour'), n(0)], [t('Colour'), n(0), t(','), n(0x123)], [t('Colour'), n(1), t(','), n(0xabc)],
    [t('Procedure'), dword(0), w(0), 0, 0, id('p')],
    [t('End Proc'), t('['), t('Val'), t('('), text('31.75'), t(')'), t(']')], [id('p', 0x12)],
    [t('Plot Colour'), n(10), t(','), n(10), t(','), t('Param#')],
    [t('Plot Colour'), n(11), t(','), n(10), t(','), array()],
    [t('Plot Colour'), n(12), t(','), n(10), t(','), n(51)],
    [t('Plot Colour'), n(13), t(','), n(10), t(','), n(1)]
  ]);
  const { program } = execute(source), display = program.display;
  assert.strictEqual(display.screen().ham, true); assert.strictEqual(display.screen().colours, 64);
  assert.deepStrictEqual([10, 11, 12, 13].map(x => display.point(x, 10)), [31, 42, 51, 1]);
  const rgba = display.rgba();
  assert.deepStrictEqual(pixel(rgba, 320, 10, 10), [17, 34, 255, 255]);
  assert.deepStrictEqual(pixel(rgba, 320, 11, 10), [170, 34, 255, 255]);
  assert.deepStrictEqual(pixel(rgba, 320, 12, 10), [170, 51, 255, 255]);
  assert.deepStrictEqual(pixel(rgba, 320, 13, 10), [170, 187, 204, 255]);
  const old = display.snapshotPlayfield();
  assert.strictEqual(old.frame.lineRegs[8], 0x6800);
  assert.deepStrictEqual(Array.from(display.renderPlayfield()), Array.from(display.renderDisplay()));
  display.setColour(0, 0x456);
  assert.deepStrictEqual(pixel(display.rgba(), 320, 10, 10), [68, 85, 255, 255]);
  assert.deepStrictEqual(pixel(reference.render(old.chip, old.frame), 640, 20, 10), [17, 34, 255, 255]);
});

test('HAM: logical/physical buffers and code-background restoration recompute the carried colour', () => {
  const display = createDisplay(); display.open(0, 16, 2, 4096, 0); display.setColour(0, 0x123); display.clear(0);
  display.doubleBuffer(); display.autoback(0); display.plot(0, 0, 0x1f);
  assert.deepStrictEqual(pixel(display.rgba(), 16, 0), [17, 34, 51, 255]);
  display.swap(); assert.deepStrictEqual(pixel(display.rgba(), 16, 0), [17, 34, 255, 255]);
  display.swap(); display.autoback(1); display.plot(1, 0, 0x2a);
  assert.deepStrictEqual(pixel(display.rgba(), 16, 1), [170, 34, 51, 255]);
  display.swap(); assert.deepStrictEqual(pixel(display.rgba(), 16, 1), [170, 34, 255, 255]);
  display.autoback(0);
  const saved = display.capture(0, 0, 2, 1);
  const before = display.screen().pixels.slice();
  display.paste({ width: 2, height: 1, depth: 6, pixels: Uint8Array.of(3, 0x33) }, 0, 0, false);
  display.restore(saved);
  assert.deepStrictEqual(display.screen().pixels, before);
});

test('HAM: incompatible flags, unsupported depth and malformed codes reject explicitly', () => {
  const base = { width: 16, height: 1, depth: 6, pointers: [0, 2, 4, 6, 8, 10], rowBytes: 2, palette: [0], ham: true };
  assert.throws(() => staticFrame({ ...base, dualPlayfield: true }), /HAM mode/);
  assert.throws(() => staticFrame({ ...base, depth: 4, pointers: [0, 2, 4, 6] }), /HAM mode/);
  const display = createDisplay();
  assert.throws(() => display.open(1, 320, 200, 4096, 0x8000), /at most 16/);
  display.open(1, 16, 8, 4096, 0); display.screen().pixels[0] = 64;
  assert.throws(() => display.rgba(), /HAM pixel code/);
  assert.throws(() => display.snapshotPlayfield(), /indexed pixel/);
  const bytes = read(corpus.fixtures[0].files.raw), at = bytes.indexOf(Buffer.from('CAMG')) + 8;
  bytes.writeUInt32BE(0x880, at);
  assert.throws(() => readIlbm(bytes), /HAM mode and plane count/);
});
