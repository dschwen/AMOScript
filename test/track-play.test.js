/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const { binary, word: w, token: t, integer: n, text, identifier: id, compile, execute } = require('./helpers/program');
const { createFakeTimers } = require('./helpers/fakeTimers');
const ext = offset => [w(0x4e), 1, 0, w(offset)];
const directory = path.join(__dirname, '../examples/Roller2');
const raw = fs.readFileSync(path.join(directory, 'music/mod.Roller_II_mus'));
const sampleBank = fs.readFileSync(path.join(directory, 'music/Roller_II_Samples.Abk'), 'latin1');
const files = { read: name => /samples/i.test(name) ? sampleBank : raw.toString('latin1') };
const source = () => require('./helpers/roller2Music')();
function start() {
  const events = [], result = execute(source(), 1000, { files, audio: { command: e => events.push(e) } });
  return { ...result, events };
}

test('Track Play: original bounded music statements emit all 1997 notes through an independent field wake', () => {
  const { program: p, timers: c, events } = start(), ticks = p.state.ticks, bank = p.banks.get(22);
  assert.strictEqual(p.state.waiting, 'key'); assert.strictEqual(p.state.tracker.playing, true);
  assert.strictEqual(c.pending(), 1); c.tick(119); assert.strictEqual(events.filter(e => e.type === 'play').length, 0);
  c.tick(1); assert.strictEqual(p.state.tracker.position.field, 6);
  for (const sample of require('../lib/amos/mod')(raw).samples) {
    assert.ok(bank.data.subarray(sample.offset, sample.offset + 4).every(v => v === 0));
    assert.strictEqual(bank.data[44 + (sample.number - 1) * 30], 0);
  }
  c.tick(192500);
  assert.deepStrictEqual(events.filter(e => e.type === 'play').map(e => [e.field, Math.log2(e.mask), e.sample.number, e.period, e.volume]), require('./helpers/roller2NoteAudit')(raw).notes);
  assert.strictEqual(p.state.ticks, ticks); assert.strictEqual(p.state.tracker.playing, false);
  assert.strictEqual(p.state.halted, false); assert.strictEqual(c.pending(), 0); p.stop();
});

test('Track Play: all literal overloads lower numeric expressions; default bank and ignored pattern follow the source', () => {
  for (const command of [[ext(0x296)], [ext(0x2a8), n(22)], [ext(0x2b0), id('a'), t(','), n(-999)]]) {
    const { program: p, timers: c } = execute(binary([[t('Data'), w(0), n(22)], [t('Read'), id('a')],
      [ext(0x2ba), text('mod'), t(','), n(22)], command, [t('Wait Key')]]), 100, { files });
    c.tick(120); assert.strictEqual(p.state.tracker.position.row, 1); p.stop();
  }
  for (const command of [[ext(0x2a8), text('22')], [ext(0x2b0), n(22), t(','), text('0')]]) {
    assert.throws(() => compile(binary([command])), /numeric/);
  }
  for (const bank of [0, -1, 65536]) assert.throws(() => execute(binary([[ext(0x2a8), n(bank)]])), /Invalid Track Play bank.*line 1/);
});

test('Track Play: host Stop freezes music, Resume rebases fields without replaying elapsed notes, and loop changes remain live', () => {
  const { program: p, timers: c, events } = start(); c.tick(140);
  const field = p.state.tracker.position.field; p.stop(); const count = events.length;
  assert.strictEqual(p.state.tracker.paused, true); assert.strictEqual(c.pending(), 0);
  c.tick(1000000); assert.strictEqual(events.length, count); assert.strictEqual(p.state.tracker.position.field, field);
  p.resume(); assert.strictEqual(events.length, count); c.tick(20);
  assert.strictEqual(p.state.tracker.position.field, field + 1); assert.strictEqual(p.state.tracker.paused, false);
  p.trackLoopOn(); c.tick((9631 - field - 1) * 20);
  assert.strictEqual(p.state.tracker.position.order, 120); assert.strictEqual(p.state.tracker.playing, true);
  p.trackStop(); assert.strictEqual(c.pending(), 0); assert.strictEqual(p.state.tracker.playing, false); p.stop();
  const next = start(); next.program.trackLoopOn(); next.timers.tick(200); next.program.trackLoopOff();
  next.timers.tick(192420); assert.strictEqual(next.program.state.tracker.playing, false); next.program.stop();
});

test('Track Play: shared sample voices receive tracker writes and Track Stop silences the same channels', () => {
  const { program: p, timers: c, events } = start(); c.tick(120);
  p.samLoopOff(2); assert.strictEqual(events.at(-1).mask, 0);
  p.samPlayVoices(2, 1); const sample = events.at(-1);
  assert.strictEqual(sample.sample.bank, 6); assert.strictEqual(sample.mask, 2);
  p.samLoopOn(2); assert.strictEqual(events.at(-1).mask, 2);
  c.tick(20);
  assert.ok(events.some(e => e.type === 'voice' && e.field === 7 && e.mask === 2 && e.rate === 3546895 / p.state.tracker.position.voices[1].period));
  p.samStop(2); assert.strictEqual(p.state.tracker.playing, true);
  p.ledOn(); c.tick(2240);
  const play = events.filter(e => e.type === 'play').at(-1); assert.strictEqual(play.filterEnabled, true);
  p.trackStop(); assert.strictEqual(events.at(-1).type, 'stop'); assert.strictEqual(events.at(-1).mask, 15);
  p.samPlayVoices(1, 1); const count = events.length; p.trackStop(); assert.strictEqual(events.length, count); p.stop();
});

test('Track Play: bank identity survives swaps; replacement, erasure and shrink stop playback, active raw writes reject', () => {
  for (const action of [p => p.trackLoad('new', 22), p => p.eraseBank(22), p => p.eraseAll(), p => p.shrinkBank(22, 100)]) {
    const { program: p, timers: c } = start(); c.tick(120); action(p);
    assert.strictEqual(p.state.tracker.playing, false); assert.strictEqual(c.pending(), 0); p.stop();
  }
  const { program: p, timers: c } = start(), bank = p.banks.get(22), address = p.bankStart(22);
  assert.throws(() => p.poke(address, 42), /active Tracker bank/);
  p.swapBanks(22, 23); c.tick(120); assert.strictEqual(p.banks.get(23), bank); assert.strictEqual(p.state.tracker.playing, true);
  assert.throws(() => p.bload('x', address), /active Tracker bank/);
  p.trackStop(); p.poke(address, 42); assert.strictEqual(p.peek(address), 42); p.stop();
});

test('Track Play: failed host commands retain Track Play location and cancel all music, palette and VM callbacks', () => {
  const p = execute(source(), 1000, { files, audio: { command(e) { if (e.type === 'play') throw new Error('audio refused'); } } });
  p.program.fade(2);
  assert.throws(() => p.timers.tick(120), /audio refused.*tracker field 6.*line 3, byte/);
  assert.strictEqual(p.program.state.halted, true); assert.strictEqual(p.program.state.tracker.playing, false); assert.strictEqual(p.timers.pending(), 0);
  assert.strictEqual(p.program.state.fade.active, false);
  for (const ending of [t('End'), t('Return')]) {
    const lines = [[ext(0x2ba), text('mod'), t(','), n(22)], [ext(0x296)], [ending]];
    const c = createFakeTimers(), p = compile(binary(lines)).create({ files, now: c.now, setTimeout: c.setTimeout, clearTimeout: c.clearTimeout });
    if (ending[1] === 0x60) assert.throws(() => p.tick(100), /Return without Gosub/); else p.tick(100);
    assert.strictEqual(p.state.tracker.playing, false); assert.strictEqual(c.pending(), 0);
  }
});

test('Track Play: late callbacks are inert after Stop/replacement; excessive catch-up fails with the original command context', () => {
  let now = 0; const tasks = [], p = compile(source()).create({ files, now: () => now, setTimeout(fn) { tasks.push(fn); return tasks.length; } });
  p.tick(100); p.stop(); p.resume(); now = 20; tasks[0](); assert.strictEqual(p.state.tracker.position.field, 0);
  tasks[1](); assert.strictEqual(p.state.tracker.position.field, 1);
  p.state.location = { line: 77, offset: 123 }; p.trackPlay(22);
  p.state.location = { line: 88, offset: 456 };
  const current = p.state.tracker.position; now = 40; tasks[2](); assert.strictEqual(current.field, 0);
  now = 10000; assert.throws(() => tasks[3](), /catch-up exceeds 250 fields.*line 77, byte 123/);
  assert.strictEqual(p.state.halted, true); assert.strictEqual(p.state.tracker.playing, false);
});

test('Track Play: invalid modules/effects validate before mutating or replacing a playing bank', () => {
  const { program: p, timers: c } = start(); c.tick(120); const position = p.state.tracker.position;
  p.reserveChipData(23, raw.length + 32); const b = p.banks.get(23); b.name = 'Tracker '; b.data.set(raw); b.data[1086] = 3;
  const before = Buffer.from(b.data); assert.throws(() => p.trackPlay(23), /unsupported effect 3/);
  assert.strictEqual(p.state.tracker.position, position); assert.strictEqual(p.state.tracker.playing, true);
  assert.deepStrictEqual(Buffer.from(b.data), before);
  p.reserveWork(24, 40); assert.throws(() => p.trackPlay(24), /Tracker bank not found/); p.stop();
});

test('Track Play: preprocessing mutates the selected bank while factory players and payloads stay independent', () => {
  const literal = require('./fixtures/mod-literal.json'), bytes = Buffer.alloc(literal.byteLength);
  for (const [at, hex] of literal.patches) Buffer.from(hex, 'hex').copy(bytes, at);
  bytes[1091] = 0; // Remove the fixture's unsupported arpeggio parameter.
  const c = createFakeTimers(), factory = compile(binary([[ext(0x2ba), text('literal'), t(','), n(22)], [ext(0x296)], [t('Wait Key')]])).create;
  const options = { files: { read: () => bytes.toString('latin1') }, now: c.now, setTimeout: c.setTimeout, clearTimeout: c.clearTimeout };
  const a = factory(options), b = factory(options); a.tick(100); b.tick(100);
  assert.strictEqual(bytes[44], 15); assert.strictEqual(a.banks.get(22).data[44], 0);
  assert.deepStrictEqual(Array.from(a.banks.get(22).data.subarray(2108, 2116)), [0, 0, 0, 0, 1, 2, 254, 64]);
  assert.notStrictEqual(a.state.tracker.position, b.state.tracker.position); assert.notStrictEqual(a.banks.get(22).data, b.banks.get(22).data);
  a.trackStop(); c.tick(120); assert.strictEqual(a.state.tracker.position.field, 0); assert.strictEqual(b.state.tracker.position.field, 6); b.stop();
});

test('Track Play: global 50/60 Hz field phase is independent of Timer, VM waits and sleepScale', () => {
  for (const rate of [50, 60]) {
    const c = createFakeTimers(), events = [], p = compile(binary([[t('Wait Key')]])).create({
      files, vblHz: rate, audioStandard: rate === 60 ? 'NTSC' : 'PAL', sleepScale: 0,
      now: c.now, setTimeout: c.setTimeout, clearTimeout: c.clearTimeout, audio: { command: e => events.push(e) }
    });
    p.tick(100); c.tick(7); p.trackLoad('mod', 22); p.trackPlay(); p.setTimer(-200000);
    c.tick(6000 / rate - 7 - 0.01); assert.strictEqual(events.filter(e => e.type === 'play').length, 0);
    c.tick(0.02); const first = events.find(e => e.type === 'play');
    assert.strictEqual(first.field, 6); assert.strictEqual(first.rate, (rate === 60 ? 3579545 : 3546895) / 453); p.stop();
  }
  const { program: p, timers: c } = execute(binary([[ext(0x2ba), text('mod'), t(','), n(22)], [ext(0x296)], [t('Wait'), n(1000)]]), 100, { files });
  c.tick(120); assert.strictEqual(p.state.waiting, 'sleep'); assert.strictEqual(p.state.tracker.position.field, 6); p.stop();
});
