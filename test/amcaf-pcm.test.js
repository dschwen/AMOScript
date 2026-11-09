'use strict';
const assert = require('assert');
const vm = require('vm');
const create = require('../lib/amos/amcafPcm');
const samples = () => [
  { number: 1, length: 8, pcm: Int8Array.from([8,16,24,32,40,48,56,64]) },
  { number: 2, length: 6, pcm: Int8Array.from([80,88,96,104,112,120]) }
];
function frame(tick, { triggers = [], repeats = [], period = 428, volume = 64 } = {}) {
  return { tick, triggers, repeats, state: { voices: Array.from({ length: 4 }, () => ({ outputPeriod: period, outputVolume: volume })) } };
}
const begin = voice => frame(1, { triggers: [{ voice, sample: 1, length: 8 }], repeats: [{ voice, sample: 1, start: 2, length: 4 }] });

test('AMCAF PCM: initial fetch finishes before a repeat rebind, which waits for the active region boundary', () => {
  const p = create(samples(), { sampleRate: 8000 }); p.apply(begin(0));
  assert.deepStrictEqual(Array.from(p.render(10).left, x => x * 256), [8,16,24,32,40,48,56,64,24,32]);
  p.apply(frame(2, { repeats: [{ voice: 0, sample: 2, start: 1, length: 3 }] }));
  // Existing A[2..5] finishes; B[1..3] then repeats without a note restart.
  assert.deepStrictEqual(Array.from(p.render(8).left, x => x * 256), [40,48,88,96,104,88,96,104]);
  p.apply(frame(3, { period: 856 }));
  assert.deepStrictEqual(Array.from(p.render(6).left, x => x * 256), [88,96,96,104,104,88]);
});

test('AMCAF PCM: repeat changes during initial fetch retain that fetch; one-word repeats stay audible', () => {
  const p = create(samples(), { sampleRate: 8000 }); p.apply(begin(0)); p.render(2);
  p.apply(frame(2, { repeats: [{ voice: 0, sample: 2, start: 4, length: 2 }] }));
  assert.deepStrictEqual(Array.from(p.render(10).left, x => x * 256), [24,32,40,48,56,64,112,120,112,120]);
  assert.strictEqual(p.state.voices[0].sample, 2);
});

test('AMCAF PCM: removing a repeat finishes the current fetch; an empty trigger silences immediately', () => {
  const p = create(samples(), { sampleRate: 8000 }); p.apply(begin(0)); p.render(2);
  p.apply(frame(2, { repeats: [{ voice: 0, sample: 0, start: 0, length: 0 }] }));
  assert.deepStrictEqual(Array.from(p.render(10).left, x => x * 256), [24,32,40,48,56,64,0,0,0,0]);
  assert.strictEqual(p.state.voices[0].active, false);
  p.apply(frame(3, { triggers: [{ voice: 0, sample: 1, length: 4 }] }));
  assert.strictEqual(p.render(1).left[0] * 256, 8);
  p.apply(frame(4, { period: 0, triggers: [{ voice: 0, sample: 0, length: 0 }] }));
  assert(p.render(10).left.every(v => v === 0));
});

test('AMCAF PCM: retrigger resets only its voice; volume changes preserve muted fetch phase', () => {
  const p = create(samples(), { sampleRate: 8000 });
  const first = begin(0); first.triggers.push({ voice: 1, sample: 1, length: 8 });
  first.repeats.push({ voice: 1, sample: 1, start: 2, length: 4 }); p.apply(first); p.render(5);
  p.apply(frame(2, { triggers: [{ voice: 0, sample: 2, length: 6 }], volume: 0 })); p.render(2);
  assert(p.state.voices[0].offset > 2); assert(p.state.voices[1].offset > 7);
  p.apply(frame(3)); const out = p.render(1);
  assert.strictEqual(out.left[0] * 256, 96); assert.strictEqual(out.right[0] * 256, 64);
});

test('AMCAF PCM: four-voice stereo pairs, finite scaling, NTSC pitch and render chunk invariance', () => {
  for (const standard of ['PAL', 'NTSC']) {
    const a = create(samples(), { sampleRate: 8000, standard }), b = create(samples(), { sampleRate: 8000, standard });
    const f = begin(0);
    for (let voice = 1; voice < 4; voice++) { f.triggers.push({ voice, sample: 1, length: 8 }); f.repeats.push({ voice, sample: 1, start: 2, length: 4 }); }
    a.apply(f); b.apply(f);
    const all = a.render(1000), first = b.render(13), rest = b.render(987);
    for (const side of ['left','right']) {
      assert.deepStrictEqual(Array.from(all[side]), [...first[side], ...rest[side]]);
      assert(all[side].every(x => Number.isFinite(x) && Math.abs(x) <= 1));
    }
    assert.deepStrictEqual(all.left, all.right); assert.deepStrictEqual(a.state, b.state);
    const step = (standard === 'PAL' ? 3546895 : 3579545) / 428 / 8000;
    const expected = Array.from({ length: 1000 }, (_, i) => {
      const at = i * step, index = at < 8 ? Math.floor(at) : 2 + Math.floor((at - 8) % 4);
      return samples()[0].pcm[index] / 128;
    });
    assert.deepStrictEqual(Array.from(all.left), expected);
  }
});

test('AMCAF PCM: validates complete intents before mutation, owns PCM and has terminal silence', () => {
  const bank = samples(), p = create(bank, { sampleRate: 8000 }); p.apply(begin(0));
  const before = p.state;
  assert.throws(() => p.apply(frame(2, { repeats: [{ voice: 0, sample: 2, start: 5, length: 2 }] })), /region exceeds/);
  assert.throws(() => p.apply(frame(2, { period: 0 })), /zero period/);
  assert.throws(() => p.apply(begin(0)), /tick sequence/);
  assert.deepStrictEqual(p.state, before);
  bank[0].pcm.fill(0); assert.strictEqual(p.render(1).left[0] * 256, 8);
  assert(Object.isFrozen(p.state.voices[0]));
  p.stop(); p.stop(); assert(p.render(100).left.every(x => x === 0));
  assert.throws(() => p.apply(frame(2)), /stopped/);
  assert.throws(() => create(samples(), { standard: 'ECS' }), /standard/);
  assert.throws(() => create(samples(), { sampleRate: 0 }), /sample rate/);
  assert.throws(() => p.render(1048577), /frame count/);
  const standalone = vm.runInNewContext(`(${create.toString()})(bank,{sampleRate:8000})`, { bank: samples() });
  standalone.apply(begin(3)); assert.strictEqual(standalone.render(1).left[0] * 256, 8);
});
