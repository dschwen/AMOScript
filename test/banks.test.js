/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const BufferReader = require('../lib/Buffer');
const BankReader = require('../lib/BankReader');
const Transpiler = require('../lib/Transpiler');
const { binary, token: t, integer: n, text, execute, compile } = require('./helpers/program');
const golden = Buffer.from(fs.readFileSync(path.join(__dirname, 'fixtures/image-banks.hex'), 'utf8').replace(/\s/g, ''), 'hex');
const trailer = golden.subarray(20);
const read = data => new BankReader(new BufferReader(data)).read();
const withBanks = lines => Buffer.concat([binary(lines), trailer]);

test('banks: independent planar bytes decode image slots, signed hotspots and shared palettes', () => {
  const banks = read(golden);
  assert.strictEqual(banks.length, 2);
  const [sprites, icons] = banks;
  assert.strictEqual(sprites.number, 1);
  assert.strictEqual(sprites.images[1], null);
  assert.strictEqual(sprites.images[0].width, 16);
  assert.strictEqual(sprites.images[0].height, 2);
  assert.strictEqual(sprites.images[0].depth, 2);
  assert.strictEqual(sprites.images[0].hotspotX, 1);
  assert.strictEqual(sprites.images[0].hotspotY, -1);
  assert.deepStrictEqual(sprites.images[0].pixels, [1, 2, 3, ...Array(13).fill(0), 2, 1, ...Array(14).fill(0)]);
  assert.deepStrictEqual(sprites.palette.slice(0, 4), [0, 0xf00, 0x0f0, 0x00f]);
  assert.strictEqual(icons.number, 2);
  assert.strictEqual(icons.type, 'icons');
  assert.deepStrictEqual(icons.images[0].pixels, sprites.images[0].pixels);
  const negativeHotspot = Buffer.from(golden); negativeHotspot.writeUInt16BE(0x3fff, 38);
  assert.strictEqual(read(negativeHotspot)[0].images[0].hotspotX, -1);
});

test('banks: multiword scanlines and complete six-plane images preserve high-index pixels', () => {
  const header = Buffer.from('416d42730001416d5370000100020002000600000000', 'hex');
  // Each plane occupies two 32-pixel scanlines. Plane 0 marks x=31 on
  // row 0; plane 5 marks x=0 on row 1, distinguishing rows from planes.
  const pixels = Buffer.alloc(48);
  pixels[3] = 1;
  pixels[44] = 128;
  const data = Buffer.concat([golden.subarray(0, 20), header, pixels, Buffer.alloc(64)]);
  const image = read(data)[0].images[0];
  assert.strictEqual(image.width, 32);
  assert.strictEqual(image.depth, 6);
  assert.strictEqual(image.pixels[31], 1);
  assert.strictEqual(image.pixels[32], 32);
  assert.strictEqual(image.pixels.reduce((sum, value) => sum + value, 0), 33);
});

test('banks: truncated trailers and malformed image headers fail with byte and bank context', () => {
  for (let length = 21; length < golden.length; length++) {
    assert.throws(() => read(golden.subarray(0, length)), /Truncated bank data.*at byte/);
  }
  const mutate = (offset, value) => { const data = Buffer.from(golden); data.writeUInt16BE(value, offset); return data; };
  assert.throws(() => read(mutate(36, 7)), /Unsupported image depth 7.*bank 1, image 1 at byte/);
  assert.throws(() => read(mutate(32, 0)), /Invalid empty image header/);
  assert.throws(() => read(mutate(32, 65535)), /Truncated bank data.*bank 1, image 1/);
  assert.throws(() => read(mutate(60, 0x1000)), /Unsupported palette colour.*bank 1 palette/);
  assert.throws(() => read(Buffer.concat([golden, Buffer.from([0])])), /Unexpected data after bank trailer/);
  const unknown = Buffer.from(golden); unknown.write('AbCd', 26);
  assert.throws(() => new Transpiler(unknown), /Unsupported bank type.*bank entry 1/);
  const wrongTrailer = Buffer.from(golden); wrongTrailer.write('AmSp', 20);
  assert.throws(() => read(wrongTrailer), /Expected AmBs bank trailer/);
  assert.deepStrictEqual(read(golden.subarray(0, 20)), []);
});

test('banks: generic AmBk preserves bytes, bank zero defaults to five, and data/work flags', () => {
  const header = Buffer.from('416d42730001416d426b000000018000000b44617461202020200080ff', 'hex');
  const data = Buffer.concat([golden.subarray(0, 20), header]);
  const bank = read(data)[0];
  assert.deepStrictEqual(bank, { number: 5, type: 'data', memory: 'fast', permanent: true, name: 'Data    ', data: [0, 128, 255] });
  const work = Buffer.from(data); work.writeUInt32BE(11, 34); work.writeUInt16BE(0, 32);
  assert.strictEqual(read(work)[0].permanent, false);
  assert.strictEqual(read(work)[0].memory, 'chip');
  const { create } = compile(data);
  const a = create({ setTimeout() {} }), b = create({ setTimeout() {} });
  a.banks.get(5).data[0] = 42;
  assert.deepStrictEqual(Array.from(b.banks.get(5).data), [0, 128, 255]);
  assert.throws(() => read(data.subarray(0, data.length - 1)), /Truncated bank data.*bank 5/);
  const short = Buffer.from(data); short.writeUInt32BE(7, 34);
  assert.throws(() => read(short), /Invalid bank length/);
  const duplicate = Buffer.concat([golden.subarray(0, 20), Buffer.from('416d42730002', 'hex'), trailer.subarray(6, 104), trailer.subarray(6, 104)]);
  assert.throws(() => read(duplicate), /Duplicate bank number 1/);
});

test('banks: generated modules paste transparent Bobs and opaque Icons at top-left coordinates', () => {
  const { program } = execute(withBanks([
    [t('Screen Open'), n(0), t(','), n(32), t(','), n(16), t(','), n(4), t(','), t('Lowres')],
    [t('Cls Colour'), n(3)], [t('Get Sprite Palette')],
    [t('Paste Bob'), n(0), t(','), n(2), t(','), n(1)],
    [t('Paste Icon'), n(0), t(','), n(6), t(','), n(1)],
    [t('Paste Bob'), n(-1), t(','), n(-1), t(','), n(1)],
    [t('Paste Bob'), n(2147483647), t(','), n(2147483647), t(','), n(1)]
  ]));
  const display = program.display;
  assert.deepStrictEqual([0, 1, 2, 3].map(x => display.point(x, 2)), [1, 2, 3, 3]);
  assert.deepStrictEqual([0, 1, 2, 3].map(x => display.point(x, 6)), [1, 2, 3, 0]);
  assert.strictEqual(display.point(0, 0), 1);
  assert.strictEqual(display.point(1, 0), 3);
  const offset = (2 * 32) * 4;
  assert.deepStrictEqual(Array.from(display.rgba().slice(offset, offset + 4)), [255, 0, 0, 255]);
});

test('banks: palettes honour masks, bank aliases and independent program storage', () => {
  const data = withBanks([
    [t('Get Bob Palette')], [t('Colour'), n(1), t(','), n(0x123)],
    [t('Get Sprite Palette Mask'), n(4)], [t('Get Icon Palette Mask'), n(8)]
  ]);
  const { create, transpiler } = compile(data);
  const a = create({ setTimeout() {}, print() {} });
  const b = create({ setTimeout() {}, print() {} });
  a.tick(100);
  assert.strictEqual(a.display.screen().palette[1], 0x123);
  assert.strictEqual(a.display.screen().palette[2], 0x0f0);
  assert.strictEqual(a.display.screen().palette[3], 0x00f);
  a.banks.get(1).images[0].pixels[0] = 3;
  a.banks.get(1).palette[1] = 0;
  assert.strictEqual(b.banks.get(1).images[0].pixels[0], 1);
  assert.strictEqual(b.banks.get(1).palette[1], 0xf00);
  assert.strictEqual(transpiler.banks[0].images[0].pixels[0], 1);
  assert.strictEqual(b.display.screen().palette[1], 0xf80);
});

test('banks: missing/empty images and invalid arguments have source diagnostics', () => {
  const paste = number => [t('Paste Bob'), n(0), t(','), n(0), t(','), n(number)];
  assert.throws(() => execute(binary([paste(1)])), /Image bank 1 is not loaded at line 1, byte/);
  assert.throws(() => execute(withBanks([paste(2)])), /Image 2 is missing or empty.*at line 1, byte/);
  assert.throws(() => execute(withBanks([paste(3)])), /Image 3 is missing or empty/);
  assert.throws(() => execute(withBanks([paste(0)])), /Invalid image number/);
  assert.throws(() => execute(withBanks([paste(-1)])), /Invalid image number/);
  assert.throws(() => execute(withBanks([paste(0x8000)])), /Invalid image number/);
  assert.throws(() => new Transpiler(withBanks([[t('Paste Bob'), text('x'), t(','), n(0), t(','), n(1)]])), /Expected numeric/);
});

const fn = (name, argument) => [t(name), t('('), argument, t(')')];
const pasteBob = (x, y, image) => [t('Paste Bob'), n(x), t(','), n(y), t(','), image];

test('banks: flip functions return flags without changing pixels, and pasting selects an absolute orientation', () => {
  const { program, logs } = execute(withBanks([
    [t('Print'), fn('Hrev', n(1)), t(','), fn('Vrev', n(1)), t(','), fn('Rev', n(1)), t(','), fn('Hrev', fn('Hrev', n(1)))],
    pasteBob(10000, 10000, fn('Hrev', n(1)))
  ]));
  assert.deepStrictEqual(logs, [[0x8001, 0x4001, 0xc001, 0x8001]]);
  const image = program.banks.get(1).images[0];
  assert.strictEqual(image.orientation, 0x8000);
  assert.deepStrictEqual(Array.from(image.pixels.slice(0, 16)), [...Array(13).fill(0), 3, 2, 1]);
  assert.strictEqual(image.hotspotX, 15); // Original RBobX uses width - x.
  assert.strictEqual(image.hotspotY, -1);
  const unchanged = Array.from(image.pixels);
  program.pasteBob(10000, 10000, 0x8001);
  assert.deepStrictEqual(Array.from(image.pixels), unchanged);
  program.pasteBob(10000, 10000, 0x4001);
  assert.strictEqual(image.hotspotX, 1);
  assert.strictEqual(image.hotspotY, 3); // Original RBobY uses height - y.
  assert.deepStrictEqual(Array.from(image.pixels.slice(0, 4)), [2, 1, 0, 0]);
  program.pasteBob(10000, 10000, 1);
  assert.deepStrictEqual(Array.from(image.pixels), read(golden)[0].images[0].pixels);
  assert.strictEqual(image.hotspotY, -1);
});

test('banks: flipping mirrors masks and clipped rendered pixels', () => {
  const { program } = execute(withBanks([
    [t('Screen Open'), n(0), t(','), n(32), t(','), n(16), t(','), n(4), t(','), t('Lowres')],
    [t('Cls Colour'), n(3)], [t('Make Mask Image'), n(1)],
    pasteBob(-13, 0, fn('Rev', n(1)))
  ]));
  // Reversed second source row becomes ...0,1,2 at its right edge.
  assert.deepStrictEqual([0, 1, 2].map(x => program.display.point(x, 0)), [3, 1, 2]);
  const image = program.banks.get(1).images[0];
  assert.deepStrictEqual(Array.from(image.mask.slice(0, 16)), [...Array(14).fill(0), 1, 1]);
  assert.strictEqual(image.orientation, 0xc000);
  const { create } = compile(withBanks([]));
  const other = create({ setTimeout() {} });
  assert.strictEqual(other.banks.get(1).images[0].orientation, 0);
  assert.strictEqual(other.banks.get(1).images[0].mask, null);
});

test('banks: Make/No Mask commands switch one image or whole banks and skip empty slots', () => {
  const { program } = execute(withBanks([
    [t('No Mask Image'), n(1)], [t('Make Icon Mask Image'), n(1)]
  ]));
  const image = program.banks.get(1).images[0];
  const icon = program.banks.get(2).images[0];
  assert.strictEqual(image.masked, false);
  assert.strictEqual(icon.masked, true);
  program.display.clear(15);
  program.pasteBob(0, 0, 1);
  assert.strictEqual(program.display.point(3, 0), 12);
  program.pasteIcon(0, 4, 1);
  assert.strictEqual(program.display.point(3, 4), 15);
  program.makeMask();
  program.noIconMask();
  assert.strictEqual(image.masked, true);
  assert.strictEqual(icon.masked, false);
  program.makeMask(2); // Empty slot is valid for mask commands.
  program.noMask(2);
  program.noMask();
  program.makeIconMask();
  assert.strictEqual(image.masked, false);
  assert.strictEqual(icon.masked, true);
  program.makeMask(1);
  program.noIconMask(1);
  assert.strictEqual(image.masked, true);
  assert.strictEqual(icon.masked, false);
  assert.throws(() => program.makeMask(3), /missing or empty/);
  assert.throws(() => execute(binary([[t('No Mask')]])), /Image bank 1 is not loaded at line 1/);
});

test('banks: mixed-depth pastes preserve upper destination planes and mask using every source plane', () => {
  const { program } = execute(withBanks([[t('Cls Colour'), n(15)], pasteBob(0, 0, n(1))]));
  assert.deepStrictEqual([0, 1, 2, 3].map(x => program.display.point(x, 0)), [13, 14, 15, 15]);
  const low = execute(withBanks([
    [t('Screen Open'), n(0), t(','), n(32), t(','), n(16), t(','), n(2), t(','), t('Lowres')],
    [t('Cls Colour'), n(1)], pasteBob(0, 0, n(1))
  ])).program;
  assert.deepStrictEqual([0, 1, 2, 3].map(x => low.display.point(x, 0)), [1, 0, 1, 1]);
  low.pasteIcon(0, 4, 1);
  assert.deepStrictEqual([0, 1, 2, 3].map(x => low.display.point(x, 4)), [1, 0, 1, 0]);
});

test('banks: independent flip and mask opcodes decode without the test token encoder', () => {
  const raw = value => [(value >>> 8) & 255, value & 255];
  const { logs, program } = execute(withBanks([
    [t('Print'), raw(0x2476), t('('), n(1), t(')'), t(','), raw(0x2482), t('('), n(1), t(')'), t(','), raw(0x248e), t('('), n(1), t(')')],
    [raw(0x1d40)], [raw(0x1d28)], [raw(0x1d56)], [raw(0x1d88), n(1)]
  ]));
  assert.deepStrictEqual(logs, [[0x8001, 0x4001, 0xc001]]);
  assert.strictEqual(program.banks.get(1).images[0].masked, true);
  assert.strictEqual(program.banks.get(2).images[0].masked, false);
});
