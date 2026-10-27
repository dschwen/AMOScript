/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const { compile } = require('./helpers/program'), { createFakeTimers } = require('./helpers/fakeTimers');
const makeFiles = require('./helpers/roller2GameFiles'), replay = require('./helpers/roller2Replay');
const directory = path.join(__dirname, '../examples/Roller2');
function assets() { return Object.fromEntries(Object.keys(require('../examples/Roller2/manifest.json').files).map(name => [`rii:${name}`, fs.readFileSync(path.join(directory, name), 'latin1')])); }

test('Roller2 full game: unchanged standalone source/assets reach level 2, original arrows, timeout game-over music and declared missing-image failure using only input/host lifecycle', () => {
  const compiled = compile(fs.readFileSync(path.join(directory, 'Roller II.AMOS'))), clock = createFakeTimers(4), files = makeFiles(assets()), events = [];
  const result = replay(options => compiled.create({ ...options, audio: { command: e => events.push(e) } }), clock, files, p => ({
    joy: mask => p.setJoystick(1, mask), key: () => p.sendKey('a'), dispose() {}
  }));
  assert.strictEqual(result.level, 2); assert.strictEqual(result.score, 248); assert.deepStrictEqual(result.ball, [5, 3]); assert.strictEqual(result.frames, 11);
  assert.match(result.missing, /roller hi.*line 1044/); assert.strictEqual(clock.pending(), 0);
  assert.ok(events.some(e => e.source === 'amos-music' && e.type === 'play'));
  assert.strictEqual(events.filter(e => e.type === 'play' && e.effect === 'boom').length, 8);
  assert.strictEqual(events.at(-1).type, 'stop');
});

test('Roller2 session files: case/volume mapping, missing assets and writes are explicit and factory-owned', () => {
  const a = makeFiles(assets()), b = makeFiles(assets()), before = b.read('RII:Highscores');
  assert.strictEqual(a.isDirectory('RII:'), true); assert.strictEqual(a.isDirectory('RII:iffp'), true);
  assert.strictEqual(a.exists('rii:iffp/ROLLER HI'), false); assert.throws(() => a.read('RII:iffp/roller hi'), /Missing Roller II asset/);
  a.write('RII:Highscores', 'session'); assert.strictEqual(a.read('rii:HIGHSCORES'), 'session'); assert.strictEqual(b.read('RII:Highscores'), before);
  assert.strictEqual(a.writes.length, 1); assert.strictEqual(b.writes.length, 0);
});

test('Roller2 current assets: byte-exact supplied refresh completes the original warp, restored scores, menu/music return and fresh-game path', () => {
  const crypto = require('crypto'), root = path.join(directory, 'current'), manifest = require('../examples/Roller2/current/manifest.json');
  for (const entry of Object.values(manifest.files)) { const bytes = fs.readFileSync(path.join(root, entry.path)); assert.strictEqual(bytes.length, entry.byteLength); assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256); }
  const current = require('./helpers/roller2CurrentAssets')(), files = makeFiles(current), clock = createFakeTimers(4);
  assert.strictEqual(files.exists('RII:iffp/roller hi'), true);
  const { create } = compile(Buffer.from(current['rii:Roller II.AMOS'], 'latin1'));
  const result = require('./helpers/roller2CurrentReplay')(create, clock, files, p => ({ joy: m => p.setJoystick(1, m), key: () => p.sendKey('a'), dispose() {} }));
  assert.deepStrictEqual(result, { frames: 15, score: 299, level: 3, returnedToMenu: true, freshGame: true, writes: 0 }); assert.strictEqual(clock.pending(), 0);
});

test('Roller2 editor: original menu opens overlapping windows, places a tile, tests the edited level and returns through the animated panel', () => {
  const current = require('./helpers/roller2CurrentAssets')(), clock = createFakeTimers(4), files = makeFiles(current);
  const { create } = compile(Buffer.from(current['rii:Roller II.AMOS'], 'latin1'));
  let frames = 0;
  const result = require('./helpers/roller2EditorReplay')(create, clock, files, p => ({
    key: (name = 'a') => p.sendKey(name === 'Escape' ? '\x1b' : name, name === 'Escape' ? 69 : 0), mouse: (...args) => p.setMouse(...args), dispose() {}
  }), (name, p) => {
    const frame = p.display.canvasFrame(); assert.strictEqual(frame.width, 320); assert.ok(frame.height >= 256 && frame.height <= 268);
    if (name !== 'Editor opening fade') assert.ok(frame.rgba.some((value, i) => i % 4 !== 3 && value > 0), name);
    assert.strictEqual(p.display.snapshotDisplay().frame.overflowEvents.length, 0); frames++;
  });
  assert.deepStrictEqual(result, { frames: 10, placedTile: 3, selectedScreen: 1, testedLevel: true, returnedToEditor: true, writes: 0 });
  assert.strictEqual(frames, 10); assert.strictEqual(clock.pending(), 0);
});

test('Roller2 help: original full-source input path displays all seven icon pages and timed examples, then returns to the menu', () => {
  const current = require('./helpers/roller2CurrentAssets')(), files = makeFiles(current), clock = createFakeTimers(4);
  const { create } = compile(Buffer.from(current['rii:Roller II.AMOS'], 'latin1'));
  const result = require('./helpers/roller2HelpReplay')(create, clock, files, p => ({ key: name => p.sendKey(name === 'Help' ? '\0' : 'a', name === 'Help' ? 95 : 0), dispose() {} }), (name, p) => {
    if (name !== 'Help icons 49–52') return;
    const target = p.display.screen();
    assert.strictEqual(target.columns, 40); assert.strictEqual(target.rows, 25);
    for (const image of require('./fixtures/roller2/help.json').images) {
      const expected = Buffer.from(image.pixelsHex, 'hex');
      for (let i = 0; i < expected.length; i++) assert.strictEqual(target.pixels[(image.y + Math.floor(i / 16)) * target.width + image.x + i % 16], expected[i], `Help icon ${image.number}, pixel ${i}`);
    }
    assert.ok(p.state.variables.array_string_descr.values.size >= 52);
  });
  assert.deepStrictEqual(result, { pages: 7, finalEntries: [49, 50, 51, 52], frames: 9, returnedToMenu: true, writes: 0 });
});

test('Roller2 help: only two integer literals change on line 1129, and restoring them reproduces the reported source failure', () => {
  const bytes = fs.readFileSync(path.join(directory, 'current/Roller II.AMOS')), original = Buffer.from(bytes);
  const Reader = require('../lib/TokenReader'), BufferReader = require('../lib/Buffer');
  const tokens = new Reader(new BufferReader(bytes)).read().filter(t => t.location.line === 1129 && t.name === 'number' && t.value === 48);
  assert.deepStrictEqual(tokens.map(t => t.location.offset), [60496, 60554]);
  tokens.forEach(t => original.writeInt32BE(40, t.location.offset + 2));
  assert.strictEqual(require('crypto').createHash('sha256').update(original).digest('hex'), '3637b3b07b79d1b352174f8a3e770a5a0f28b73cf8077f2110853b03071836c8');
  const current = require('./helpers/roller2CurrentAssets')(), files = makeFiles(current), clock = createFakeTimers(4);
  const { create } = compile(original);
  assert.throws(() => require('./helpers/roller2HelpReplay')(create, clock, files, p => ({ key: name => p.sendKey(name === 'Help' ? '\0' : 'a', name === 'Help' ? 95 : 0), dispose() {} })), /Text cursor out of bounds at line 1129, byte 60532/);
});
