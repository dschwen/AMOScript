/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { binary, word: w, token: t, integer: n, text, identifier: id, compile, execute } = require('./helpers/program');
const { createFakeTimers } = require('./helpers/fakeTimers');
const fixture = require('./helpers/roller2EndMusic'), reference = require('./fixtures/roller2/music.json').banks;
const ext = offset => [w(0x4e), 1, 0, w(offset)];
const files = { read: name => name === 'one' ? 'B' : fs.readFileSync(path.join(__dirname, '../examples/Roller2/music', /ywon/i.test(name) ? 'Ywon.mus' : 'Over.mus'), 'latin1') };
const start = (won = false, options = {}) => {
  const events = [], result = execute(fixture(won), 1000, { files, audio: { command: e => events.push(e) }, ...options });
  return { ...result, events };
};
const hash = rows => crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');

test('Music VM: all 194 Roller II encodings now compile the complete unchanged source to a standalone factory', () => {
  const data = fs.readFileSync(path.join(__dirname, '../examples/Roller2/Roller II.AMOS'));
  const { create, transpiler } = compile(data);
  assert.strictEqual(typeof create, 'function'); assert.ok(transpiler.toModule().includes('musicPlay'));
});

test('Music VM: original load/play statements emit complete independent PAL/NTSC first-wrap traces while Wait Key stays idle', () => {
  for (let b = 0; b < 2; b++) for (const standard of ['PAL', 'NTSC']) {
    const { program: p, timers: c, events } = start(!!b, { audioStandard: standard, vblHz: standard === 'PAL' ? 50 : 60 });
    const ticks = p.state.ticks, expected = reference[b].traces[standard];
    assert.strictEqual(p.state.waiting, 'key'); assert.strictEqual(c.pending(), 1);
    c.tick(expected.fields * 1000 / (standard === 'PAL' ? 50 : 60) + 0.01);
    assert.strictEqual(p.state.music.position.field, expected.fields);
    const notes = events.filter(e => e.type === 'play').map(e => [e.field, Math.log2(e.mask), e.sample.number, e.period, e.volume]);
    const controls = events.filter(e => e.type === 'voice').map(e => [e.field, Math.log2(e.mask), e.period || 0, e.volume]);
    assert.strictEqual(hash(notes), expected.notesSha256); assert.strictEqual(hash(controls), expected.controlsSha256);
    assert.strictEqual(p.state.ticks, ticks); p.stop(); assert.strictEqual(c.pending(), 0);
  }
});

test('Music VM: original 1006 fades every three fields from 63 to 0, stops audio and erases bank 3 before the declared exit guard', () => {
  for (const won of [false, true]) {
    const { program: p, timers: c, events } = start(won); c.tick(100); p.sendKey('x'); c.tick(0);
    assert.strictEqual(p.state.waiting, 'sleep');
    c.tick(59); assert.strictEqual(p.state.music.volume, 56);
    c.tick(1); assert.strictEqual(p.state.music.volume, 63);
    c.tick(63 * 60); assert.strictEqual(p.state.music.volume, 0); assert.strictEqual(p.state.music.playing, false);
    assert.strictEqual(p.banks.has(3), false); assert.strictEqual(c.pending(), 0); assert.strictEqual(p.state.waiting, 'key');
    assert.strictEqual(events.at(-1).type, 'stop'); assert.strictEqual(events.at(-1).mask, 15); p.stop();
  }
});

test('Music VM: typed DATA/array master volume persists before playback; unsupported forms reject with context', () => {
  const data = binary([[t('Dim'), id('v'), t('('), n(0), t(')')], [t('Data'), w(0), n(31)], [t('Read'), id('v'), t('('), n(0), t(')')],
    [ext(0x196), id('v'), t('('), n(0), t(')')], [t('Load'), text('music/Over.mus')], [ext(0x58), n(1)], [t('Wait Key')]]);
  const events = [];
  const { program: p, timers: c } = execute(data, 100, { files, audio: { command: e => events.push(e) } });
  c.tick(40); assert.strictEqual(p.state.music.volume, 31); assert.strictEqual(p.state.music.position.voices[0].hardwareVolume, 30); p.stop();
  for (const level of [-1, 64, 65536]) assert.throws(() => execute(binary([[ext(0x196), n(level)]])), /Invalid Mvolume.*line 1/);
  for (const cmd of [[ext(0x58), text('1')], [ext(0x196), text('2')], [ext(0x2c), n(1)]]) assert.throws(() => compile(binary([cmd])));
  for (const song of [0, -1, 2, 65536]) assert.throws(() => execute(binary([[t('Load'), text('music/Over.mus')], [ext(0x58), n(song)]]), 100, { files }), /Music.*line 2/);
  assert.throws(() => execute(binary([[ext(0x58), n(1)]])), /Music bank 3 not found.*line 1/);
});

test('Music VM: Stop freezes fields and silences held samples; Resume rebases without replaying elapsed fields or restoring sample phase', () => {
  const { program: p, timers: c, events } = start(); c.tick(100); const field = p.state.music.position.field;
  p.stop(); const count = events.length; assert.strictEqual(p.state.music.paused, true); assert.strictEqual(c.pending(), 0);
  c.tick(1000000); assert.strictEqual(events.length, count); p.resume(); c.tick(20);
  assert.strictEqual(p.state.music.position.field, field + 1); assert.strictEqual(p.state.music.paused, false);
  assert.strictEqual(events.slice(count).some(e => e.type === 'play'), false); p.stop();
});

test('Music VM: bank replacement/erasure/shrink/swap retire active playback, checked writes preflight, invalid replacements preserve current music', () => {
  for (const action of [p => p.eraseBank(3), p => p.eraseAll(), p => p.shrinkBank(3, 100), p => p.swapBanks(3, 4), p => p.loadBanks('music/Ywon.mus')]) {
    const { program: p, timers: c } = start(); c.tick(40); action(p);
    assert.strictEqual(p.state.music.playing, false); assert.strictEqual(c.pending(), 0); p.stop();
  }
  const { program: p, timers: c } = start(), address = p.bankStart(3), original = p.peek(address);
  assert.throws(() => p.poke(address, 4), /active Music bank/); assert.strictEqual(p.peek(address), original);
  assert.throws(() => p.bload('one', address), /active Music bank/);
  assert.throws(() => p.shrinkBank(3, -1), /length/); c.tick(20); assert.strictEqual(p.state.music.playing, true);
  p.musicOff(); p.poke(address, original); assert.strictEqual(c.pending(), 0); p.stop();
});

test('Music VM: fresh starts validate before host audio, overlap/voice stealing rejects, Music Off stops shared channels and Sam loops exclude Music voices', () => {
  const { program: p, timers: c, events } = start(); c.tick(20); const count = events.length;
  for (const action of [() => p.musicPlay(1), () => p.trackPlay(22), () => p.samPlay(1), () => p.samStop(), () => p.boom()]) assert.throws(action, /not implemented/);
  assert.strictEqual(events.length, count); p.samLoopOff(15); assert.strictEqual(events.at(-1).mask, 0);
  p.musicVolume(63); c.tick(20); assert.strictEqual(p.state.music.position.voices[0].hardwareVolume, 62);
  p.musicOff(); assert.strictEqual(c.pending(), 0); assert.strictEqual(events.at(-1).mask, 15); p.musicOff(); assert.strictEqual(events.at(-1).type, 'stop');
  p.musicPlay(1); assert.strictEqual(p.state.music.position.field, 0); assert.strictEqual(p.state.music.position.volume, 63); p.stop();
  const loaded = execute(binary([[t('Load'), text('music/Over.mus')], [t('Wait Key')]]), 100, { files });
  loaded.program.banks.get(3).data[0] = 255; assert.throws(() => loaded.program.musicPlay(1), /AMOS Music/); assert.strictEqual(loaded.timers.pending(), 0); loaded.program.stop();
});

test('Music VM: End/Edit/failure cancel owned wakes; late callbacks are inert and excessive catch-up retains the Music source location', () => {
  for (const ending of [t('End'), t('Edit'), t('Return')]) {
    const c = createFakeTimers(), p = compile(binary([[t('Load'), text('music/Over.mus')], [ext(0x58), n(1)], [ending]])).create({ files, now: c.now, setTimeout: c.setTimeout, clearTimeout: c.clearTimeout });
    try { p.tick(100); } catch (error) { assert.match(error.message, /Return without Gosub/); }
    assert.strictEqual(p.state.music.playing, false); assert.strictEqual(c.pending(), 0);
  }
  const failing = start(false, { audio: { command(e) { if (e.type === 'play') throw Error('audio refused'); } } });
  assert.throws(() => failing.timers.tick(20), /audio refused.*line 2, byte/); assert.strictEqual(failing.program.state.halted, true); assert.strictEqual(failing.timers.pending(), 0);
  let now = 0; const tasks = [], p = compile(fixture()).create({ files, now: () => now, setTimeout(fn) { tasks.push(fn); return tasks.length; } });
  p.tick(100); const stale = tasks[0]; p.stop(); stale(); assert.strictEqual(p.state.music.position.field, 0); p.resume();
  now = 10000; assert.throws(() => tasks.at(-1)(), /Music field catch-up.*line 2, byte/); assert.strictEqual(p.state.halted, true); assert.strictEqual(p.state.music.playing, false);
});
