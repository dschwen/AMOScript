'use strict';
const assert = require('assert');
const crypto = require('crypto');
const sequence = require('../lib/amos/amcafSequencer');
const pitch = require('../lib/amos/amcafPitch');
const pcm = require('../lib/amos/amcafPcm');
function moduleFixture(length = 2048) {
  const samples = Array.from({ length: 31 }, (_, index) => ({ number: index + 1, length: 0,
    loopStart: 0, loopLength: 0, finetune: 0, volume: 0, pcm: new Int8Array(0) }));
  samples[0] = { ...samples[0], length, loopLength: 2, volume: 64,
    pcm: Int8Array.from({ length }, (_, index) => index % 127) };
  return { songLength: 1, orderTable: new Uint8Array(128), samples,
    patterns: [Array.from({ length: 256 }, () => ({ sample: 0, period: 0, effect: 0, parameter: 0 }))] };
}
function cell(module, row, sample, period, effect, parameter) {
  module.patterns[0][row * 4] = { sample, period, effect, parameter };
}
function nextRow(player, enabled = 15) {
  let frame;
  do { frame = player.tick(enabled); } while (!frame.isRow);
  return frame;
}
test('AMCAF 9xx: offset memory, double note dispatch, instrument reset and retained DMA pointers follow native words', () => {
  const module = moduleFixture();
  cell(module, 0, 1, 428, 9, 1);
  cell(module, 1, 0, 428, 9, 0);
  cell(module, 2, 0, 0, 9, 2);
  cell(module, 3, 0, 428, 0, 0);
  cell(module, 4, 1, 428, 9, 0);
  const player = sequence(module, pitch);
  assert.deepStrictEqual(nextRow(player).triggers, [{ voice: 0, sample: 1, start: 256, length: 1792 }]);
  assert.deepStrictEqual([player.state.voices[0].fetchStart, player.state.voices[0].fetchLength], [512, 1536]);
  assert.deepStrictEqual(nextRow(player).triggers, [{ voice: 0, sample: 1, start: 768, length: 1280 }]);
  assert.deepStrictEqual(nextRow(player).triggers, []);
  assert.deepStrictEqual(nextRow(player).triggers, [{ voice: 0, sample: 1, start: 1536, length: 512 }]);
  assert.deepStrictEqual(nextRow(player).triggers, [{ voice: 0, sample: 1, start: 512, length: 1536 }]);
  assert.strictEqual(player.state.voices[0].sampleOffset, 2);
  assert.strictEqual(player.state.voices[0].fetchStart, 1024);
});
test('AMCAF 9xx: one-word fallback, signed length comparison, loop-relative fetch and masked offset state', () => {
  for (const length of [256, 65536]) {
    const module = moduleFixture(length);
    cell(module, 0, 1, 428, 9, 1);
    assert.deepStrictEqual(nextRow(sequence(module, pitch)).triggers, [{ voice: 0, sample: 1, length: 2 }]);
  }
  const module = moduleFixture(1024);
  Object.assign(module.samples[0], { loopStart: 256, loopLength: 128 });
  cell(module, 0, 1, 428, 9, 1);
  cell(module, 1, 0, 428, 0, 0);
  const player = sequence(module, pitch), first = nextRow(player, 14);
  assert.deepStrictEqual(first.triggers, [{ voice: 0, sample: 1, start: 256, length: 128 }]);
  assert.deepStrictEqual(first.repeats.at(-1), { voice: 0, sample: 1, start: 256, length: 128 });
  assert.deepStrictEqual(nextRow(player).triggers, [{ voice: 0, sample: 1, start: 256, length: 2 }]);
});
test('AMCAF E9x: tick multiples, row-note suppression, zero interval, voice masks and repeat restoration', () => {
  const module = moduleFixture();
  cell(module, 0, 1, 428, 14, 0x92);
  cell(module, 1, 0, 0, 14, 0x93);
  cell(module, 2, 0, 0, 14, 0x90);
  const player = sequence(module, pitch), events = [];
  for (let tick = 1; tick <= 23; tick++) {
    const frame = player.tick();
    if (frame.triggers.length) events.push(tick);
    if ([8, 10, 15].includes(tick)) assert.deepStrictEqual(frame.repeats, [{ voice: 0, sample: 1, start: 0, length: 2 }]);
  }
  assert.deepStrictEqual(events, [6, 8, 10, 12, 15]);
  const muted = sequence(module, pitch);
  nextRow(muted);
  for (let i = 0; i < 11; i++) assert.deepStrictEqual(muted.tick(14).triggers, []);
});
test('AMCAF PCM offsets: shifted initial fetch reaches its original repeat and failed range validation preserves phase', () => {
  const samples = [{ number: 1, length: 8, pcm: Int8Array.from([8,16,24,32,40,48,56,64]) }];
  const renderer = pcm(samples, { sampleRate: 8000 });
  const frame = { tick: 1, triggers: [{ voice: 0, sample: 1, start: 4, length: 4 }],
    repeats: [{ voice: 0, sample: 1, start: 2, length: 2 }],
    state: { voices: Array.from({ length: 4 }, () => ({ outputPeriod: 428, outputVolume: 64 })) } };
  renderer.apply(frame);
  assert.deepStrictEqual(Array.from(renderer.render(7).left, value => value * 256), [40,48,56,64,24,32,24]);
  const before = renderer.state;
  assert.throws(() => renderer.apply({ ...frame, tick: 2, triggers: [{ voice: 0, sample: 1, start: 6, length: 4 }] }), /region exceeds/);
  assert.deepStrictEqual(renderer.state, before);
});
test('AMCAF 4 spirits: all first-wrap DMA fetches and row positions match the independent native register audit', () => {
  const oracle = require('./fixtures/amcaf/spirits.json');
  const bytes = require('fs').readFileSync(__dirname + '/fixtures/amcaf/modland-4spirits.mod');
  assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), oracle.sha256);
  const module = require('../lib/amos/mod')(bytes), player = sequence(module, pitch), sampler = pcm(module.samples);
  const dma = crypto.createHash('sha256'), rows = crypto.createHash('sha256');
  let triggers = 0, rowCount = 0, offsets = 0;
  while (!player.state.ends && player.state.ticks < 30000) {
    const frame = player.tick();
    sampler.apply(frame);
    if (frame.isRow) { const bytes = Buffer.alloc(6); bytes.writeUInt32BE(frame.tick); bytes[4] = frame.order; bytes[5] = frame.row; rows.update(bytes); rowCount++; }
    for (const trigger of frame.triggers) {
      const bytes = Buffer.alloc(14); bytes.writeUInt32BE(frame.tick); bytes[4] = trigger.voice; bytes[5] = trigger.sample;
      bytes.writeUInt32BE(trigger.start || 0, 6); bytes.writeUInt32BE(trigger.length, 10); dma.update(bytes);
      triggers++; if (trigger.start) offsets++;
    }
  }
  assert.strictEqual(player.state.ticks, oracle.ticks); assert.strictEqual(player.state.ends, 1);
  assert.strictEqual(triggers, oracle.triggers); assert.strictEqual(offsets, oracle.offsetTriggers); assert.strictEqual(rowCount, oracle.rows);
  assert.strictEqual(dma.digest('hex'), oracle.dmaSha256); assert.strictEqual(rows.digest('hex'), oracle.rowsSha256);
});
