'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const readPacked = require('../lib/amos/packedPicture'), oracle = require('./fixtures/packed-picture.json');
const { binary, token: t, integer: n, text, compile, execute } = require('./helpers/program');
const { createMemoryFiles } = require('../lib/amos/files');
const { createFakeTimers } = require('./helpers/fakeTimers');
const folder = path.join(__dirname, '../examples/PlanetZybex');
const bytes = level => fs.readFileSync(path.join(folder, `level${level}_screen.abk`));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const extension = (offset = 0x56, reference = 1) => [0, 0x4e, 2, reference, offset >> 8, offset & 255];
function small(literals = [0xa5], pointers = [0], flags = [0]) {
  const header = Buffer.alloc(114); header.writeUInt32BE(0x12031990); header.writeUInt16BE(128, 4); header.writeUInt16BE(2, 6);
  header.writeUInt16BE(128, 8); header.writeUInt16BE(50, 10); header.writeUInt16BE(128, 12); header.writeUInt16BE(2, 14);
  header.writeUInt16BE(0x1000, 20); header.writeUInt16BE(2, 22); header.writeUInt16BE(1, 24); header.writeUInt16BE(0xfff, 28);
  header.writeUInt32BE(0x06071963, 90); header.writeUInt16BE(16, 98); header.writeUInt16BE(1, 100); header.writeUInt16BE(2, 102); header.writeUInt16BE(1, 104);
  header.writeUInt32BE(24 + literals.length + pointers.length, 106); header.writeUInt32BE(24 + literals.length, 110);
  return Buffer.concat([header, Buffer.from(literals), Buffer.from(pointers), Buffer.from(flags)]);
}
function program() {
  const clock = createFakeTimers(), { create } = compile(binary([[t('Wait Key')]]));
  return create({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    files: createMemoryFiles(Object.fromEntries(oracle.levels.map(level => [level.file, bytes(level.level).toString('latin1')]))) });
}

test('Packed picture: all seven original banks match independent expanded control/run and indexed hashes', () => {
  assert.strictEqual(hash(fs.readFileSync(path.join(folder, 'Zybex.AMOS'))), oracle.programSha256);
  for (const level of oracle.levels) {
    const raw = bytes(level.level); assert.strictEqual(hash(raw), level.sourceSha256);
    const image = readPacked(raw.subarray(20)); assert.deepStrictEqual([image.width, image.height, image.depth], [level.width, level.height, 4]);
    assert.strictEqual(hash(image.pixels), level.indexedSha256); assert.deepStrictEqual(image.palette, level.palette);
    raw.fill(0); assert.strictEqual(hash(image.pixels), level.indexedSha256);
  }
});

test('Packed picture: repeated literals, changing flag tables and column-square traversal match explicit pixels', () => {
  const image = readPacked(small());
  for (let y = 0; y < 2; y++) for (let x = 0; x < 128; x++) assert.strictEqual(image.pixels[y * 128 + x], 0xa5 >> (7 - x % 8) & 1);
  const changed = readPacked(small([0xaa, 0xff, 0xf0, 0x0f], [0x40], [0, 0x80]));
  for (let y = 0; y < 2; y++) for (let x = 0; x < 128; x++) assert.strictEqual(changed.pixels[y * 128 + x], [0xaa, 0xff, 0xf0, 0x0f][Math.floor(x / 32)] >> (7 - x % 8) & 1);
  const literal = readPacked(small([0, ...Array.from({ length: 32 }, (_, i) => i)], [0], [255]));
  for (let column = 0; column < 16; column++) for (let y = 0; y < 2; y++) for (let bit = 0; bit < 8; bit++) assert.strictEqual(literal.pixels[y * 128 + column * 8 + bit], (column * 2 + y) >> (7 - bit) & 1);
});

test('Packed picture: malformed geometry, modes, stream ranges and truncation reject before allocating a screen', () => {
  for (const mutate of [b => b.writeUInt32BE(0), b => b.writeUInt16BE(0, 4), b => b.writeUInt16BE(0x1800, 20), b => b.writeUInt16BE(4, 22),
    b => b.writeUInt16BE(1, 94), b => b.writeUInt16BE(2, 104), b => b.writeUInt32BE(24, 110), b => b.writeUInt32BE(99999, 106), b => b.writeUInt16BE(0x1000, 26)]) {
    const bad = small(); mutate(bad); assert.throws(() => readPacked(bad), /Packed picture/);
  }
  const bad = small([0], [0], [255]); assert.throws(() => readPacked(bad), /truncated byte stream/);
  assert.throws(() => readPacked(small([0, 1, 2, 3], [0x40], [0, 0x80]).subarray(0, -1)), /truncated flag stream/);
});

test('Unpack To: exact extension signature preserves effects, bank ownership and metadata; other overloads stay gated', () => {
  for (const reference of [0, 1]) {
    const result = execute(binary([[t('Load Bank'), text('level2_screen.abk'), t(','), n(10)],
      [extension(0x56, reference), n(10), t('To'), n(1)]]), 100, { files: createMemoryFiles({ 'level2_screen.abk': bytes(2).toString('latin1') }) });
    const p = result.program, s = p.display.screen();
    assert.deepStrictEqual([p.display.current, s.width, s.height, s.hardwareY, s.windowHeight, s.cursorVisible], [1, 320, 640, 42, 160, false]);
    assert.strictEqual(hash(s.pixels), oracle.levels[1].indexedSha256); assert.strictEqual(hash(p.banks.get(10).data), hash(bytes(2).subarray(20)));
  }
  for (const offset of [0x46, 0x5e]) assert.throws(() => compile(binary([[extension(offset), n(10)]])), /Unsupported extension/);
  assert.throws(() => compile(binary([[extension(), text('bad'), t('To'), n(1)]])), /Expected numeric expression/);
});

test('Unpack To: failed decode, invalid destination and clone ownership preserve existing screens and bank addresses', () => {
  const p = program(); p.loadBanks('level1_screen.abk', 10); p.unpackScreen(10, 1); const s = p.display.screen(), old = s.pixels.slice(), start = p.bankStart(10);
  p.poke(start, 0); assert.throws(() => p.unpackScreen(10, 1), /signatures/); assert.strictEqual(p.display.screen(), s); assert.deepStrictEqual(s.pixels, old); assert.strictEqual(p.bankStart(10), start);
  p.poke(start, 0x12); assert.throws(() => p.unpackScreen(10, 8), /screen number/); assert.strictEqual(p.display.screen(), s);
  p.display.clone(2); assert.throws(() => p.unpackScreen(10, 1), /clones/); assert.strictEqual(p.display.screen(), s);
  p.display.close(2); p.unpackScreen(10, 1); assert.notStrictEqual(p.display.screen(), s); assert.strictEqual(p.bankStart(10), start); p.stop();
});

test('Planet Zybex backgrounds: original Load/Unpack excerpts match 35 independent windows without compiling the game', () => {
  for (const level of oracle.levels) {
    const { program: p } = execute(require('./helpers/planetZybexLevel')(level.level), 100, { files: createMemoryFiles({ [level.file]: bytes(level.level).toString('latin1') }) });
    assert.strictEqual(p.state.waiting, 'key'); assert.strictEqual(p.banks.get(1).images.length, 47); assert.strictEqual(p.banks.get(5).name, 'Samples ');
    for (const view of level.windows) { p.display.screenOffset(1, view.x, view.y); assert.strictEqual(hash(p.display.canvasFrame().rgba), view.sha256, `${level.level} ${view.x},${view.y}`); }
    p.stop();
  }
  assert.throws(() => compile(fs.readFileSync(path.join(folder, 'Zybex.AMOS'))), /Unsupported token 0x1986 at line 93, byte 6506/);
});
