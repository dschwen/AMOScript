/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const createDisplay = require('../lib/amos/display'), oracle = require('./fixtures/polygon.json');
const { binary, token: t, word: w, dword, integer: n, identifier: id, text, execute, compile } = require('./helpers/program');
const polygon = pairs => [w(0xeba), ...pairs.flatMap((pair, i) => [i ? t('To') : [], pair[0], t(','), pair[1]])];

test('Polygon: original token renders independent exact interiors and inclusive boundary matrices', () => {
  assert.deepStrictEqual(t('Polygon'), [0x0e, 0xba]);
  for (const frame of oracle.frames) {
    const { program: p } = execute(binary([[t('Screen Open'), n(0), t(','), n(oracle.width), t(','), n(oracle.height), t(','), n(4), t(','), t('Lowres')],
      [t('Cls Colour'), n(0)], [t('Ink'), n(3)], polygon(frame.points.map(pair => pair.map(n)))]));
    assert.strictEqual(Buffer.from(p.display.screen().pixels).toString('hex'), frame.pixelsHex, frame.name);
  }
});

test('Polygon: closure, reversed winding and solid Ink ignore Set Line while preserving cursor and phase', () => {
  const d = createDisplay(); d.open(0, 16, 12, 4, 0); d.clear(0); d.ink(3, 1, 2); d.grLocate(7, 8); d.locate(1, 0); d.setLine(0);
  const points = [[2, 2], [11, 2], [11, 8], [2, 8]], s = d.screen(), phase = s.linePhase;
  d.polygon(points); const expected = s.pixels.slice();
  for (const shape of [[...points, points[0]], points.slice().reverse()]) { d.clear(0); d.polygon(shape); assert.deepStrictEqual(s.pixels, expected); }
  assert.deepStrictEqual([s.gx, s.gy, s.linePhase, s.ink, s.inkBackground, s.inkBorder], [7, 8, phase, 3, 1, 2]);
  assert.strictEqual(d.point(11, 8), 3); assert.strictEqual(d.point(12, 8), 0);
});

test('Polygon: direct area calls bypass Bob/Autoback replay and retain explicit buffer owners', () => {
  for (const mode of [0, 1, 2]) {
    const d = createDisplay(); d.open(0, 16, 12, 4, 0); d.clear(0); d.doubleBuffer(); d.autoback(mode); d.ink(3);
    const s = d.screen(), logical = s.pixels, physical = s.physicalPixels;
    d.setDrawingHooks({ before() { throw Error('Polygon restored Bobs'); }, after() { throw Error('Polygon replayed Bobs'); } });
    d.polygon([[1, 1], [8, 1], [8, 8], [1, 8]]);
    assert.strictEqual(s.pixels, logical); assert.strictEqual(s.physicalPixels, physical); assert.ok(physical.every(v => v === 0));
    assert.strictEqual(d.point(4, 4), 3); d.swap(0); assert.strictEqual(d.point(4, 4), 0); assert.strictEqual(s.physicalPixels[4 * 16 + 4], 3);
  }
});

test('Polygon: malformed, wrapped and overfull area lists reject before pixel/cursor mutation', () => {
  const d = createDisplay(), s = d.screen(), old = s.pixels.slice();
  for (const points of [[], [[0, 0], [1, 1]], [[0, 0], [1, 1], [2]], [[0, 0], [1, 1], [32768, 1]],
    [[0, 0], [1, 1], [NaN, 1]], Array.from({ length: 16 }, (_, i) => [i, 0])]) {
    assert.throws(() => d.polygon(points), /Polygon/); assert.deepStrictEqual(s.pixels, old);
  }
  const closed = Array.from({ length: 15 }, (_, i) => [i, 0]); closed.push(closed[0]); d.polygon(closed);
  assert.throws(() => compile(binary([[t('Polygon'), t('To'), n(0), t(','), n(0), t('To'), n(1), t(','), n(1)]])), /Polygon To is not implemented/);
  assert.throws(() => compile(binary([polygon([[n(0), n(0)], [n(1), n(1)]])])), /at least three/);
  assert.throws(() => compile(binary([polygon(Array.from({ length: 17 }, () => [n(0), n(0)]))])), /at most 16/);
  assert.throws(() => execute(binary([polygon([[n(0), n(0)], [n(1), n(1)], [n(1), n(40000)]])])), /Polygon.*line 1, byte 22/);
});

test('Polygon: typed coordinates and once-only ordered callbacks lower without parser side effects', () => {
  const element = [id('a'), t('('), n(0), t(')')];
  const lines = [[t('Data'), w(0), n(3)], [t('Read'), id('x')], [t('Dim'), element], [element, t('='), n(5)],
    [t('Procedure'), dword(0), w(0), 0, 0, id('p')], [t('End Proc'), t('['), n(1), t(']')], [id('p', 0x12)],
    [t('Ink'), n(3)], polygon([[t('Param'), n(1)], [element, n(1)], [id('x'), n(5)]])];
  assert.strictEqual(execute(binary(lines)).program.display.point(3, 2), 3);
  const calls = [], fn = (name, arg) => [t(name), t('('), arg, t(')')];
  const values = [1, 1, 5, 1, 3, 5], args = values.map((_, i) => fn('Val', fn('Fsel$', text(String(i)))));
  execute(binary([polygon([[args[0], args[1]], [args[2], args[3]], [args[4], args[5]]])]), 100, { files: {
    select(request) { calls.push(request.path); return String(values[Number(request.path)]); }
  } });
  assert.deepStrictEqual(calls, ['0', '1', '2', '3', '4', '5']);
  assert.throws(() => compile(binary([polygon([[text('0'), n(0)], [n(1), n(1)], [n(2), n(2)]])])), /numeric.*line 1/);
});

test('Polygon: source backup produces eight checked IFFs through ordinary execution and per-factory state', () => {
  const bytes = fs.readFileSync(path.join(__dirname, '../examples/Introideen/KugelanimBerech.Bak'));
  assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), oracle.sourceSha256);
  const { create } = compile(bytes), writes = []; let p;
  p = create({ now: () => 0, setTimeout: () => 1, clearTimeout() {}, files: { write(name, data) {
    const image = require('./helpers/decodeSavedIff')(Uint8Array.from(data, c => c.charCodeAt(0)));
    assert.strictEqual(Buffer.from(image.pixels).toString('hex'), Buffer.from(p.display.screen().pixels).toString('hex'));
    assert.deepStrictEqual([image.width, image.height, image.depth], [320, 200, 4]); writes.push(name);
  } } });
  p.tick(250000); assert.strictEqual(p.state.halted, true); assert.strictEqual(p.state.ticks, 191160);
  assert.deepStrictEqual(writes, Array.from({ length: 8 }, (_, i) => `df1:kugel0${10 + i}`));
  const a = createDisplay(), b = createDisplay(); a.ink(3); a.polygon([[0, 0], [5, 0], [0, 5]]);
  assert.strictEqual(a.point(1, 1), 3); assert.strictEqual(b.point(1, 1), 1);
});
