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
  assert.deepStrictEqual(result, { frames: 12, score: 278, level: 3, returnedToMenu: true, freshGame: true, writes: 0 }); assert.strictEqual(clock.pending(), 0);
});
