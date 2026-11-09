'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const readMod = require('../lib/amos/mod');
const create = require('../lib/amos/amcafSequencer');
const pitch = require('../lib/amos/amcafPitch');
function fixture() {
  const literal = require('./fixtures/mod-literal.json'), bytes = Buffer.alloc(literal.byteLength);
  for (const [at, hex] of literal.patches) Buffer.from(hex, 'hex').copy(bytes, at);
  const m = readMod(bytes);
  m.patterns[0].forEach(c => { c.sample = c.period = c.effect = c.parameter = 0; });
  m.samples[0].finetune = 0;
  return m;
}
function cell(m, row, voice, sample, period, effect = 0, parameter = 0) {
  m.patterns[0][row * 4 + voice] = { sample, period, effect, parameter };
}
function ticks(p, n) { let t; for (let i = 0; i < n; i++) t = p.tick(); return t; }

test('AMCAF sequencer: first row at tick six, arpeggio on intervening ticks and original restart ignored', () => {
  const m = fixture(); cell(m, 0, 0, 1, 428, 0, 0x47);
  const p = create(m, pitch);
  for (let i = 0; i < 5; i++) assert.strictEqual(p.tick().isRow, false);
  const first = p.tick();
  assert.deepStrictEqual(first.triggers, [{ voice: 0, sample: 1, length: 8 }]);
  assert.strictEqual(first.state.voices[0].outputPeriod, 428);
  assert.deepStrictEqual(Array.from({ length: 5 }, () => p.tick().state.voices[0].outputPeriod), [339,285,428,339,285]);
  p.tick(); assert.strictEqual(p.state.voices[0].outputPeriod, 428);
  ticks(p, 372); assert.strictEqual(p.state.order, 0); assert.strictEqual(p.state.row, 0);
  assert.strictEqual(p.state.ends, 1); assert.strictEqual(m.restart, 127);
});

test('AMCAF sequencer: tone portamento keeps initial DMA and updates speed only at the next tick', () => {
  const m = fixture(); cell(m, 0, 0, 1, 428);
  cell(m, 1, 0, 0, 381, 3, 10); cell(m, 2, 0, 0, 428, 5, 0x03);
  const p = create(m, pitch); ticks(p, 6);
  const t = ticks(p, 6); assert.deepStrictEqual(t.triggers, []);
  assert.strictEqual(t.state.voices[0].target, 381); assert.strictEqual(t.state.voices[0].portaSpeed, 0);
  assert.deepStrictEqual(Array.from({ length: 5 }, () => p.tick().state.voices[0].period), [418,408,398,388,381]);
  assert.strictEqual(p.state.voices[0].target, 0);
  p.tick(); const next = p.tick().state.voices[0];
  assert.strictEqual(next.period, 391); assert.strictEqual(next.portaSpeed, 10); assert.strictEqual(next.volume, 29);
});

test('AMCAF sequencer: vibrato plus slide preserves speed/depth; master changes wait for native volume writes', () => {
  const m = fixture(); cell(m, 0, 0, 1, 428, 4, 0x47);
  cell(m, 1, 0, 0, 0, 6, 0x02);
  const p = create(m, pitch); ticks(p, 6); p.setVolume(32);
  assert.strictEqual(p.state.voices[0].outputVolume, 32);
  assert.deepStrictEqual(Array.from({ length: 5 }, () => p.tick().state.voices[0].outputPeriod), [428,433,437,440,441]);
  assert.strictEqual(p.state.voices[0].outputVolume, 32);
  const row = p.tick(); assert.strictEqual(row.state.voices[0].outputVolume, 16);
  const next = p.tick().state.voices[0];
  assert.strictEqual(next.vibratoMemory, 0x47); assert.strictEqual(next.volume, 30);
  assert.strictEqual(next.outputVolume, 15); assert.strictEqual(next.outputPeriod, 440);
  p.setVolume(65536); assert.strictEqual(p.state.master, 0);
  p.setVolume(-1); assert.strictEqual(p.state.master, 0);
  p.setVolume(127); assert.strictEqual(p.state.master, 64);
});

test('AMCAF sequencer: instrument-only rows rebind repeats without restarting or clearing sample data', () => {
  const m = fixture(); cell(m, 0, 0, 1, 428);
  m.samples[1] = { ...m.samples[0], number: 2, loopStart: 0, loopLength: 2, finetune: 1, volume: 12 };
  cell(m, 1, 0, 2, 0);
  const original = Array.from(m.samples[0].pcm), p = create(m, pitch);
  assert.deepStrictEqual(Array.from(p.sample(1).pcm), original);
  m.samples[0].pcm.fill(0); m.samples[1].pcm.fill(0);
  const first = ticks(p, 6);
  assert.strictEqual(first.triggers[0].length, 8);
  const change = ticks(p, 6);
  assert.deepStrictEqual(change.triggers, []);
  assert.deepStrictEqual(change.repeats.map(x => x.voice), [3,2,1,0]);
  assert.deepStrictEqual(change.repeats[3], { voice: 0, sample: 2, start: 0, length: 2 });
  assert.strictEqual(change.state.voices[0].period, 428);
  assert.strictEqual(change.state.voices[0].outputVolume, 12);
  assert.deepStrictEqual(Array.from(p.sample(1).pcm), original);
  p.sample(1).pcm.fill(0); assert.deepStrictEqual(Array.from(p.sample(1).pcm), original);
});

test('AMCAF sequencer: speed/tempo changes, BCD break, jump and independent counter', () => {
  const m = fixture(); m.patterns.push(m.patterns[0].map(c => ({ ...c })));
  m.songLength = 2; m.orderTable[1] = 1;
  cell(m, 0, 0, 0, 0, 15, 3); cell(m, 0, 1, 0, 0, 15, 150);
  cell(m, 1, 0, 0, 0, 13, 0x12);
  m.patterns[1][12 * 4] = { sample: 0, period: 0, effect: 11, parameter: 0 };
  const p = create(m, pitch); ticks(p, 6);
  assert.strictEqual(p.state.speed, 3); assert.strictEqual(p.state.bpm, 150);
  ticks(p, 3); assert.strictEqual(p.state.order, 1); assert.strictEqual(p.state.row, 12);
  ticks(p, 3); assert.strictEqual(p.state.order, 0); assert.strictEqual(p.state.row, 0);
  assert.strictEqual(p.state.ends, 1);
  assert.strictEqual(create(m, pitch).state.speed, 6);
});

test('AMCAF sequencer: validates unused effects before ticks; freezes snapshots, stops once and attributes pitch failures', () => {
  const m = fixture(); m.patterns.push(m.patterns[0].map(c => ({ ...c })));
  m.patterns[1][255].effect = 14;
  assert.throws(() => create(m, pitch), /unsupported effect e:0 at pattern 1, row 63, channel 3/);
  m.patterns.pop(); cell(m, 0, 0, 1, 1); m.samples[0].finetune = -1;
  const p = create(m, pitch); ticks(p, 5);
  assert.throws(() => p.tick(), /table address.*AMCAF tick 6, order 0, row 0/);
  assert.strictEqual(p.state.playing, false); assert.strictEqual(p.tick(), null);
  assert(Object.isFrozen(p.state.voices[0]));
  const other = create(fixture(), pitch); other.stop(); other.stop(); assert.strictEqual(other.tick(), null);
  const standalone = vm.runInNewContext(`(${create.toString()})(input, (${pitch.toString()}))`, { input: fixture() });
  assert.strictEqual(ticks(standalone, 6).isRow, true);
});
