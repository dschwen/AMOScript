/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const createDisplay = require('../lib/amos/display');
const { binary, token: t, word: w, dword, integer: n, identifier: id, text, execute, compile } = require('./helpers/program');
const { createFakeTimers } = require('./helpers/fakeTimers');
const oracle = require('./fixtures/zoom.json');
const zoom = args => [w(0x10d6), args.slice(0, 5).flatMap((arg, i) => i ? [t(','), arg] : [arg]), t('To'),
  args.slice(5).flatMap((arg, i) => i ? [t(','), arg] : [arg])];
const fixture = name => fs.readFileSync(path.join(__dirname, '../examples/Introideen', name));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

test('Zoom: original token and every small reduction/enlargement map match independent ZooTab carries', () => {
  assert.deepStrictEqual(t('Zoom'), [0x10, 0xd6]);
  for (const m of oracle.maps) {
    const d = createDisplay(); d.open(0, 32, 32, 32, 0);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) d.screen().pixels[y * 32 + x] = x;
    d.open(1, 32, 32, 32, 0);
    d.zoom(0, 0, 0, m.source, 1, 1, 0, 0, m.destination, 1);
    assert.deepStrictEqual(Array.from(d.screen().pixels.slice(0, m.destination)), m.indices);
    for (let y = 0; y < 32; y++) d.screen(0).pixels.fill(y, y * 32, (y + 1) * 32);
    d.zoom(0, 0, 0, 1, m.source, 1, 0, 0, 1, m.destination);
    assert.deepStrictEqual(m.indices.map((_, y) => d.screen().pixels[y * 32]), m.indices);
  }
});

test('Zoom: exclusive edges, common planes and raw buffer ownership bypass Bob/Autoback hooks', () => {
  for (const mode of [0, 1, 2]) {
    const d = createDisplay(); d.open(0, 16, 16, 4, 0); d.clear(3);
    d.open(1, 32, 32, 16, 0); d.doubleBuffer(); d.autoback(mode);
    const s = d.screen(), logical = s.pixels, physical = s.physicalPixels;
    logical.fill(12); physical.fill(8); d.grLocate(5, 6); d.locate(2, 3);
    const palette = s.palette.slice();
    d.setDrawingHooks({ before() { throw Error('Zoom invoked Bob restore'); }, after() { throw Error('Zoom invoked Bob replay'); } });
    d.zoom(0, 0, 0, 16, 16, d.bufferSelector('Physic', 1), 3, 4, 23, 24);
    assert.strictEqual(s.pixels, logical); assert.strictEqual(s.physicalPixels, physical);
    assert.ok(logical.every(value => value === 12));
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) assert.strictEqual(physical[y * 32 + x], x >= 3 && x < 23 && y >= 4 && y < 24 ? 11 : 8);
    assert.deepStrictEqual(s.palette, palette);
    assert.deepStrictEqual([d.current, s.gx, s.gy, s.x, s.y, s.autoback], [1, 5, 6, 2, 3, mode]);
  }
});

test('Zoom: live aliased columns and cached repeated rows preserve source traversal rather than snapshot copies', () => {
  const d = createDisplay(); d.open(0, 16, 16, 16, 0);
  const s = d.screen(); for (let x = 0; x < 16; x++) s.pixels[x] = x;
  d.zoom(0, 0, 0, 4, 1, 0, 1, 0, 5, 1);
  assert.deepStrictEqual(Array.from(s.pixels.slice(0, 6)), [0, 0, 0, 0, 0, 5]);
  s.pixels.fill(0); s.pixels[0] = 3; s.pixels[16] = 5;
  d.zoom(0, 0, 0, 1, 2, 0, 0, 1, 1, 5);
  // The second source row was overwritten by the previous write. Duplicate
  // rows reuse each plane's fetched bit; later reads see those raw writes.
  assert.deepStrictEqual([0, 1, 2, 3, 4].map(y => s.pixels[y * 16]), [3, 3, 3, 3, 3]);
  d.clone(1); d.select(0); s.pixels[0] = 7;
  d.zoom(1, 0, 0, 1, 1, 0, 1, 0, 3, 1);
  assert.deepStrictEqual(Array.from(s.pixels.slice(0, 3)), [7, 7, 7]);
});

test('Zoom: invalid rectangles and table sizes fail atomically before any drawing hooks', () => {
  const d = createDisplay(), before = d.screen().pixels.slice();
  d.setDrawingHooks({ before() { throw Error('Invalid Zoom restored Bobs'); }, after() { throw Error('Invalid Zoom replayed Bobs'); } });
  for (const args of [[0, -1, 0, 16, 16, 0, 0, 0, 16, 16], [0, 0, 0, 0, 16, 0, 0, 0, 16, 16],
    [0, 0, 0, 321, 16, 0, 0, 0, 16, 16], [0, 0, 0, 16, 16, 0, 0, 0, 321, 16],
    [0, 0, 0, 16, 16, 0, 16, 16, 15, 16]]) assert.throws(() => d.zoom(...args), /Invalid Zoom rectangle/);
  assert.deepStrictEqual(d.screen().pixels, before);
  d.open(0, 1024, 1023, 2, 0); assert.throws(() => d.zoom(0, 0, 0, 1, 1, 0, 0, 0, 1024, 1023), /4 KiB/);
  d.close(0); assert.throws(() => d.zoom(8, 0, 0, 1, 1, 0, 0, 0, 1, 1), /Invalid screen selector/);
  assert.throws(() => execute(binary([zoom([0, -1, 0, 1, 1, 0, 0, 0, 1, 1].map(n))])), /Zoom rectangle.*line 1, byte 22/);
});

test('Zoom: typed DATA/array/procedure operands and effectful evaluation use the ordinary standalone instruction', () => {
  const array = [id('a'), t('('), n(0), t(')')];
  const fn = (name, arg) => [t(name), t('('), arg, t(')')];
  const lines = [[t('Data'), w(0), n(0)], [t('Read'), id('screen')], [t('Dim'), array], [array, t('='), n(1)],
    [t('Procedure'), dword(0), w(0), 0, 0, id('p')], [t('End Proc'), t('['), n(1), t(']')], [id('p', 0x12)],
    [t('Plot Colour'), n(0), t(','), n(0), t(','), n(3)],
    zoom([id('screen'), n(0), n(0), array, t('Param'), id('screen'), n(1), n(1), fn('Val', text('3.0')), n(3)])];
  const p = execute(binary(lines)).program;
  assert.strictEqual(p.display.point(1, 1), 3); assert.strictEqual(p.display.point(2, 2), 3);
  const calls = [];
  const args = Array.from({ length: 10 }, (_, i) => fn('Val', fn('Fsel$', text(String(i)))));
  // All operands evaluate left-to-right once before selector validation.
  assert.throws(() => execute(binary([zoom(args)]), 1000, { files: { select: request => { calls.push(request.path); return '0'; } } }), /Zoom rectangle/);
  assert.deepStrictEqual(calls, Array.from({ length: 10 }, (_, i) => String(i)));
  assert.throws(() => compile(binary([zoom([text('0'), ...Array(9).fill(n(1))])])), /numeric.*line 1/);
  assert.throws(() => compile(binary([[t('Zoom'), n(0)]])), /Expected/);
});

test('Zoom: unchanged intro generates all sixteen independent icons and twenty-nine original animation frames', () => {
  assert.strictEqual(hash(fixture('RollerIIIntroIdee.amos')), oracle.sourceSha256);
  assert.strictEqual(hash(fixture('R.abk')), oracle.assetSha256);
  const { create } = compile(fixture('RollerIIIntroIdee.amos')), clock = createFakeTimers();
  const run = require('./helpers/zoomIntroReplay')(create, clock, fixture('R.abk').toString('latin1'), (frame, p) => {
    assert.strictEqual(hash(p.display.screen().physicalPixels), oracle.frames[frame - 1].sha256, `Intro frame ${frame}`);
  });
  try {
    assert.deepStrictEqual(run.reads, ['df1:r.abk']);
    for (const expected of oracle.icons) {
      const image = run.p.banks.get(2).images[expected.number - 1];
      assert.deepStrictEqual([image.width, image.height, image.depth], [16, 16, 4]);
      assert.strictEqual(Buffer.from(image.pixels).toString('hex'), expected.pixelsHex);
    }
    run.p.sendKey('x'); clock.tick(0); assert.strictEqual(run.p.state.halted, true); assert.strictEqual(clock.pending(), 0);
  } finally { run.p.stop(); }
});
