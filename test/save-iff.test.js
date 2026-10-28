/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const writeIlbm = require('../lib/display/model/ilbmWriter'), createDisplay = require('../lib/amos/display');
const decode = require('./helpers/decodeSavedIff'), oracle = require('./fixtures/save-iff.json');
const { binary, token: t, word: w, dword, integer: n, identifier: id, text, compile, execute } = require('./helpers/program');
const { createFakeTimers } = require('./helpers/fakeTimers');
const save = value => [w(0xafc), value];
const fixtureScreen = f => {
  const d = createDisplay(); d.open(0, f.width, f.height, 1 << f.depth, 0);
  d.screen().pixels.set(Buffer.from(f.pixelsHex, 'hex')); d.screen().palette = Array.from({ length: 32 }, (_, i) => (i & 15) * 0x111);
  return d.screen();
};

test('Save Iff: independent complete bytes verify uncompressed rows, default compression and odd external padding', () => {
  assert.deepStrictEqual(t('Save Iff'), [0x0a, 0xfc]);
  for (const [f, compression] of [[oracle.uncompressed, 0], [oracle.compressedOdd, 1]]) {
    const bytes = writeIlbm(fixtureScreen(f), compression);
    assert.strictEqual(Buffer.from(bytes).toString('hex'), f.fileHex);
    assert.strictEqual(Buffer.from(decode(bytes).pixels).toString('hex'), f.pixelsHex);
  }
  assert.strictEqual(Buffer.from(writeIlbm(fixtureScreen(oracle.compressedOdd))).toString('hex'), oracle.compressedOdd.fileHex);
});

test('Save Iff: ByteRun1 packets stay within planar rows and handle 128-byte repeat/literal boundaries', () => {
  for (const raw of [Array(128).fill(0x12), Array.from({ length: 128 }, (_, i) => i),
    Array.from({ length: 128 }, (_, i) => i < 65 ? 0 : 255), Array(128).fill(0xff)]) {
    const d = createDisplay(); d.open(0, 1024, 2, 2, 0);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 1024; x++) d.screen().pixels[y * 1024 + x] = raw[x >> 3] >> (7 - (x & 7)) & 1;
    const bytes = writeIlbm(d.screen()), image = decode(bytes);
    assert.deepStrictEqual(image.pixels, d.screen().pixels);
    if (raw.every(v => v === raw[0])) assert.deepStrictEqual(Array.from(bytes.subarray(image.chunks.BODY.start)), [129, raw[0], 129, raw[0]]);
    if (raw[0] === 0 && raw[1] === 1) assert.strictEqual(bytes[image.chunks.BODY.start], 127);
  }
});

test('Save Iff: normal/hires/EHB/HAM metadata, all palette registers and zero right padding are preserved', () => {
  for (const [colours, mode, expectedMode] of [[4, 0, 0], [16, 0x8000, 0x8000], [64, 0, 0x80], [4096, 0, 0x800]]) {
    const d = createDisplay(); d.open(0, 320, 200, colours, mode); const s = d.screen();
    for (let i = 0; i < s.pixels.length; i++) s.pixels[i] = i % s.colours;
    d.setColour(31, 0xabc); d.setAutoView(false); d.screenDisplay(0, 128, 80, mode ? 160 : 320, 150);
    const offset = s.ham ? 16 : 2; d.screenOffset(0, offset, 3); d.hideScreen(0);
    const pixels = s.pixels, palette = s.palette, image = decode(writeIlbm(s));
    assert.deepStrictEqual(image.pixels, pixels); assert.strictEqual(image.palette[31], 0xabc); assert.strictEqual(image.mode, expectedMode);
    assert.deepStrictEqual(image.aspect, [mode ? 10 : 20, 22]);
    assert.deepStrictEqual(image.page, [320, 150]);
    assert.deepStrictEqual(image.amosScreen, [128, 80, mode ? 160 : 320, 150, offset, 3, 0x8000]);
    assert.strictEqual(s.pixels, pixels); assert.strictEqual(s.palette, palette); assert.strictEqual(d.current, 0);
  }
});

test('Save Iff: complete bytes and resolved paths survive write callbacks that change directory and screen', () => {
  const { create } = compile(binary([[t('Dir$'), t('='), text('disk:')], save(text('picture'))]));
  const writes = []; let p;
  p = create({ now: () => 0, setTimeout: () => 1, clearTimeout() {}, files: {
    isDirectory: () => true, write(name, data) { p.setDirectory('other:'); p.display.clear(2); writes.push([name, data]); }
  } });
  p.tick(100); assert.strictEqual(writes.length, 1); assert.strictEqual(writes[0][0], 'disk:picture');
  assert.ok(decode(Uint8Array.from(writes[0][1], c => c.charCodeAt(0))).pixels.every(v => v === 1));
  assert.strictEqual(p.currentDirectory(), 'other:'); assert.ok(p.display.screen().pixels.every(v => v === 2));
});

test('Save Iff: unsupported state fails before writes and host failures retain source locations', () => {
  for (const invalidate of [p => p.display.doubleBuffer(), p => { p.display.screen().pixels[0] = 255; },
    p => { p.display.screen().palette[0] = 0x1000; }]) {
    let file = 'old', writes = 0; const { create } = compile(binary([save(text('saved'))]));
    const p = create({ now: () => 0, setTimeout: () => 1, clearTimeout() {}, files: { write(name, data) { writes++; file = data; } } });
    invalidate(p); assert.throws(() => p.tick(100), /Save Iff:.*line 1, byte 22/);
    assert.strictEqual(writes, 0); assert.strictEqual(file, 'old'); assert.strictEqual(p.state.halted, true);
  }
  assert.throws(() => execute(binary([save(text('x'))])), /files host adapter.*line 1/);
  assert.throws(() => execute(binary([save(text('x'))]), 100, { files: { write() { throw Error('disk full'); } } }), /disk full at line 1/);
  assert.throws(() => execute(binary([save(text('x'))]), 100, { files: { write: () => Promise.resolve() } }), /write synchronously.*line 1/);
  assert.throws(() => writeIlbm(createDisplay().screen(), 2), /unsupported compression/);
});

test('Save Iff: typed string operands evaluate once, factories own their exports and extra overloads remain gated', () => {
  const element = [id('a', 6, 0x42), t('('), n(0), t(')')];
  const lines = [[t('Data'), w(0), text('from-data')], [t('Read'), id('name', 6, 2)], [t('Dim'), element], [element, t('='), id('name', 6, 2)],
    [t('Procedure'), dword(0), w(0), 0, 0, id('p'), t('['), id('arg', 6, 2), t(']')],
    [t('End Proc'), t('['), id('arg', 6, 2), t(']')], [id('p', 0x12), t('['), element, t(']')], save(t('Param$'))];
  const writes = []; execute(binary(lines), 100, { files: { write: (name, bytes) => writes.push([name, bytes]) } });
  assert.strictEqual(writes[0][0], 'from-data');
  let selections = 0; execute(binary([save([t('Fsel$'), t('('), text('name'), t(')')])]), 100, { files: {
    select() { selections++; return 'selected'; }, write(name) { assert.strictEqual(name, 'selected'); }
  } }); assert.strictEqual(selections, 1);
  const { create } = compile(binary([save(text('x'))]));
  const outputs = [], opts = { now: () => 0, setTimeout: () => 1, clearTimeout() {}, files: { write: (name, bytes) => outputs.push(bytes) } };
  const a = create(opts), b = create(opts); a.display.clear(3); a.tick(100); b.tick(100);
  assert.ok(decode(Uint8Array.from(outputs[0], c => c.charCodeAt(0))).pixels.every(v => v === 3));
  assert.ok(decode(Uint8Array.from(outputs[1], c => c.charCodeAt(0))).pixels.every(v => v === 1));
  assert.throws(() => compile(binary([save(n(1))])), /string.*line 1/);
  assert.throws(() => compile(binary([[...save(text('x')), t(','), n(0)]])), /end of statement/);
  assert.throws(() => compile(binary([[w(0xb0c), text('x'), t(','), n(0)]])), /Unsupported token/);
});

test('Save Iff: unchanged generator saves rollerball after its key prompt and reloads identical indexed pixels', () => {
  const bytes = fs.readFileSync(path.join(__dirname, '../examples/Introideen/KugelanimBerech.amos'));
  assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), oracle.generatorSha256);
  const { create } = compile(bytes), clock = createFakeTimers(), files = require('../lib/amos/files').createMemoryFiles();
  const p = create({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, files });
  try {
    p.tick(400000); assert.strictEqual(p.state.waiting, 'key'); assert.strictEqual(p.state.location.line, 32);
    assert.deepStrictEqual(files.snapshot(), {}); const before = p.display.screen().pixels.slice();
    p.sendKey('a'); clock.tick(0); assert.strictEqual(p.state.halted, true); assert.strictEqual(clock.pending(), 0);
    const image = decode(Uint8Array.from(files.read('rollerball'), c => c.charCodeAt(0)));
    assert.strictEqual(Buffer.from(image.pixels).toString('hex'), Buffer.from(before).toString('hex')); assert.deepStrictEqual(p.display.screen().pixels, before);
    const loaded = execute(binary([[t('Load Iff Screen'), text('rollerball'), t(','), n(0)]]), 100, { files });
    assert.strictEqual(Buffer.from(loaded.program.display.screen().pixels).toString('hex'), Buffer.from(before).toString('hex'));
  } finally { p.stop(); }
});
