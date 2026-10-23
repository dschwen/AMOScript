/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const staticFrame = require('../lib/display/model/staticFrame');
const reference = require('../lib/display/reference/render');
const readIlbm = require('../lib/display/model/ilbm');
const createDisplay = require('../lib/amos/display');
const ChipMemory = require('../lib/display/model/ChipMemory');
const build = require('../lib/display/copper/builder');
const interpret = require('../lib/display/copper/interpreter');
const { decodePng } = require('./helpers/displayPng');
const { comparePixels } = require('./helpers/displayFrames');
const { binary, token: t, word: w, dword, integer: n, identifier: id, text, execute } = require('./helpers/program');
const array = () => [id('a', 6, 0x40), t('('), n(0), t(')')];
const fn = (name, arg) => [t(name), t('('), arg, t(')')];

test('display modes: all odd/even scroll delays use lowres units at both resolutions', () => {
  const chip = new Uint8Array(524288);
  chip.set([0x80, 0, 0x80, 0, 0x80, 0, 0x80, 0, 0x40, 0, 0x40, 0, 0x40, 0, 0x40, 0]);
  const palette = [0, 0xf00, 0x0f0, 0x00f];
  for (const hires of [false, true]) for (const extra of [false, true]) {
    const scale = hires ? 2 : 1, samples = hires ? 1 : 2, offset = extra ? 16 * scale : 0;
    for (let odd = 0; odd < 16; odd++) for (let even = 0; even < 16; even++) {
      const frame = staticFrame({ width: 32, height: 1, depth: 2, pointers: [0, 8], rowBytes: 8, palette,
        hires, scroll: odd | (even << 4), fetchOffset: offset });
      const rgba = reference.render(chip, frame), expected = [];
      for (let x = 0; x < 32 * samples; x++) {
        const source = Math.floor(x / samples) + offset;
        const a = source - odd * scale, b = source - even * scale;
        const index = (a >= 0 && a < 64 && a % 16 === 0 ? 1 : 0) | (b >= 0 && b < 64 && b % 16 === 1 ? 2 : 0);
        const rgb = palette[index];
        expected.push(((rgb >> 8) & 15) * 17, ((rgb >> 4) & 15) * 17, (rgb & 15) * 17, 255);
      }
      assert.deepStrictEqual(Array.from(rgba), expected, JSON.stringify({ hires, extra, odd, even }));
    }
  }
});

test('display modes: negative source bits blank safely and trace the scroll/fetch origin', () => {
  const chip = new Uint8Array(524288); chip[0] = 0x80;
  const frame = staticFrame({ width: 4, height: 1, depth: 1, pointers: [0], rowBytes: 2, palette: [0, 0xf00], fetchOffset: -1 });
  const first = reference.explainPixel(chip, frame, 0, 0);
  assert.strictEqual(first.rawIndex, 0);
  assert.strictEqual(first.planes[0].sourceBit, -1); assert.strictEqual(first.planes[0].byteAddress, null);
  assert.strictEqual(reference.explainPixel(chip, frame, 2, 0).rawIndex, 1);
});

test('display modes: dual playfields split 2/4/6 planes with both priorities and transparent zero', () => {
  const raw = [0, 1, 2, 3, 4, 8, 12, 15, 16, 32, 48, 63];
  const pf1 = [0, 1, 0, 1, 2, 0, 2, 3, 4, 0, 4, 7];
  const pf2 = [0, 0, 1, 1, 0, 2, 2, 3, 0, 4, 4, 7];
  const palette = Array.from({ length: 32 }, (_, index) => (index << 4) | index);
  palette[0] = 0x123; palette[8] = 0xf00;
  for (const depth of [2, 4, 6]) for (const front2 of [false, true]) {
    const count = depth === 2 ? 4 : depth === 4 ? 8 : 12, chip = new Uint8Array(524288);
    for (let x = 0; x < count; x++) for (let plane = 0; plane < depth; plane++) {
      if (raw[x] & (1 << plane)) chip[plane * 2 + (x >> 3)] |= 0x80 >> (x & 7);
    }
    const frame = staticFrame({ width: count, height: 1, depth, pointers: Array.from({ length: depth }, (_, i) => i * 2),
      rowBytes: 2, palette, dualPlayfield: true, pf2Priority: front2 });
    for (let x = 0; x < count; x++) {
      const selected = pf2[x] && (front2 || !pf1[x]) ? 2 : pf1[x] ? 1 : 0;
      const index = selected === 2 ? pf2[x] + 8 : selected === 1 ? pf1[x] : 0;
      const trace = reference.explainPixel(chip, frame, x * 2, 0);
      assert.deepStrictEqual(trace.playfields, { pf1: pf1[x], pf2: pf2[x], selected });
      assert.strictEqual(trace.palette.index, index); assert.strictEqual(trace.mode, 'dual-playfield');
      const rgb = palette[index];
      assert.deepStrictEqual(trace.palette.rgba, [((rgb >> 8) & 15) * 17, ((rgb >> 4) & 15) * 17, (rgb & 15) * 17, 255]);
    }
    assert.strictEqual(reference.explainPixel(chip, frame, 0, 0).final, '#112233');
  }
});

test('display modes: independent six-plane EHB ILBMs match PNGs for raw and ByteRun1', () => {
  const directory = path.join(__dirname, 'fixtures/display');
  const fixture = JSON.parse(fs.readFileSync(path.join(directory, 'ehb-fixtures.json')));
  assert.strictEqual(fixture.evidence.kind, 'synthetic');
  const read = descriptor => {
    const bytes = fs.readFileSync(path.join(directory, descriptor.file));
    assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), descriptor.sha256);
    return bytes;
  };
  const golden = decodePng(read(fixture.files.golden));
  for (const kind of ['raw', 'byterun']) {
    const { snapshot, image } = readIlbm(read(fixture.files[kind]));
    assert.strictEqual(image.depth, 6); assert.strictEqual(image.mode, 0x80);
    const report = comparePixels(golden.width, golden.height, reference.render(snapshot.chip, snapshot.frame), golden.rgba);
    assert.strictEqual(report.pass, true, JSON.stringify(report.first));
    const trace = reference.explainPixel(snapshot.chip, snapshot.frame, 64, 0);
    assert.strictEqual(trace.mode, 'EHB'); assert.strictEqual(trace.halfbrite, true);
    assert.strictEqual(trace.rawIndex, 32); assert.strictEqual(trace.palette.index, 0);
    assert.deepStrictEqual(trace.palette.rgba, [0, 0, 51, 255]);
    const bad = read(fixture.files[kind]); bad.writeUInt32BE(0, bad.indexOf(Buffer.from('CAMG')) + 8);
    assert.throws(() => readIlbm(bad), /EHB mode and plane count/);
  }
});

test('display modes: EHB screen commands preserve typed DATA, arrays and procedure results in standalone output', () => {
  const source = binary([
    [t('Dim'), array()], [t('Data'), w(0), n(64), t(','), n(33), t(','), n(0x1135)],
    [t('Read'), id('colours'), t(','), array(), t(','), id('rgb')],
    [w(0x09ea), n(0), t(','), n(320), t(','), n(200), t(','), id('colours'), t(','), t('Lowres')],
    [t('Cls Colour'), n(0)], [w(0x0d1c), fn('Val', text('33.75')), t(','), id('rgb')],
    [t('Procedure'), dword(0), w(0), 0, 0, id('p')],
    [t('End Proc'), t('['), fn('Val', text('33.75')), t(']')], [id('p', 0x12)],
    [t('Plot Colour'), n(10), t(','), n(10), t(','), t('Param#')],
    [t('Plot Colour'), n(11), t(','), n(10), t(','), array()],
    [t('Print'), t('Point'), t('('), n(10), t(','), n(10), t(')'), t(','), fn('Colour Value', n(33))]
  ]);
  const { program, logs } = execute(source);
  assert.deepStrictEqual(logs, [[33, 0x135]]);
  assert.strictEqual(program.display.point(10, 10), 33); assert.strictEqual(program.display.point(11, 10), 33);
  const rgb = Array.from(program.display.rgba().slice((10 * 320 + 10) * 4, (10 * 320 + 12) * 4));
  assert.deepStrictEqual(rgb, [0, 17, 34, 255, 0, 17, 34, 255]);
  assert.deepStrictEqual(Array.from(program.display.renderDisplay()), Array.from(program.display.renderPlayfield()));
  program.display.setColour(-1, -1);
  program.display.paste({ width: 1, height: 1, depth: 6, pixels: Uint8Array.of(63) }, 20, 10, false);
  assert.strictEqual(program.display.point(20, 10), 63);
  assert.deepStrictEqual(Array.from(program.display.rgba().slice((10 * 320 + 20) * 4, (10 * 320 + 20) * 4 + 4)), [119, 119, 119, 255]);
});

test('display modes: palette masks, signed-word Palette omission and hires limits follow source handlers', () => {
  const display = createDisplay();
  display.setColour(33, 0x12345); assert.strictEqual(display.info('Colour Value', 1), 0x345);
  display.setColour(-1, -1); assert.strictEqual(display.info('Colour Value', 63), 0xfff);
  const original = display.info('Colour Value', 0);
  display.setPalette(-1, 0x1123, 0x8000, 0x10001);
  assert.strictEqual(display.info('Colour Value', 0), original);
  assert.strictEqual(display.info('Colour Value', 1), 0x123);
  assert.strictEqual(display.info('Colour Value', 2), 0xfff);
  assert.strictEqual(display.info('Colour Value', 3), 1);
  assert.throws(() => display.open(1, 320, 200, 32, 0x8000), /at most 16/);
  assert.throws(() => display.open(1, 320, 200, 64, 0x8000), /at most 16/);
  assert.throws(() => execute(binary([[w(0x09ea), n(1), t(','), n(320), t(','), n(200), t(','), n(64), t(','), t('Hires')]])),
    /at most 16 colours at line 1, byte/);
});

test('display modes: copper scroll setup exports prefix and advances full padded rows at each resolution', () => {
  for (const hires of [false, true]) {
    const memory = new ChipMemory(524288), rowBytes = hires ? 84 : 42, allocation = memory.allocate(rowBytes * 200);
    const pixels = new Uint8Array(allocation.length);
    for (let y = 0; y < 200; y++) { pixels[y * rowBytes] = 0x80; pixels[y * rowBytes + (hires ? 4 : 2)] = 0x80; }
    memory.writeBytes(allocation.address, pixels);
    const compiled = build([{ width: hires ? 640 : 320, height: 200, x: 128, y: 50, depth: 1,
      pointers: [allocation.address], rowBytes, palette: [0, 0xf00], scroll: 1, hires }]);
    const list = memory.allocate(compiled.bytes.length); memory.writeBytes(list.address, compiled.bytes);
    const { snapshot } = interpret(memory.bytes, { ...compiled.interpretOptions, initialRegisters: compiled.initialRegisters, address: list.address });
    assert.strictEqual(snapshot.frame.lineRegs[15], hires ? 32 : 16);
    assert.strictEqual(snapshot.frame.lineRegs[32], allocation.address + rowBytes);
    const rgba = reference.render(snapshot.chip, snapshot.frame);
    assert.deepStrictEqual(Array.from(rgba.slice(0, 16)), [0, 0, 0, 255, 0, 0, 0, 255, 255, 0, 0, 255, ...(hires ? [0, 0, 0, 255] : [255, 0, 0, 255])]);
  }
});
