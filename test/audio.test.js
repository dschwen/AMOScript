/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const BufferReader = require('../lib/Buffer');
const TokenReader = require('../lib/TokenReader');
const BankReader = require('../lib/BankReader');
const createAudio = require('../lib/amos/audio');
const { binary, token: t, word: w, integer: n, text, execute, compile } = require('./helpers/program');
const { createMemoryFiles } = require('../lib/amos/files');
const ext = offset => [w(0x4e), 1, 0, w(offset)];
// Independent AmBk + Samples payload: one record at offset 6; four PCM bytes.
const small = Buffer.from('416d426b000500008000002053616d706c657320000100000006546f6e65202020200fa000000004007f80ff', 'hex');
const filename = 'AMOSPro_Productivity2:Wonderland/Wonderland_Samples.Abk';
const original = fs.readFileSync(path.join(__dirname, '../examples/Wonderland/Wonderland_Samples.Abk'));
const load = [t('Load'), text('samples')];
const bytes = () => createMemoryFiles({ samples: small.toString('latin1') });
const run = (lines, options = {}) => execute(binary([load, ...lines]), 1000, { files: bytes(), ...options });

test('audio: extension decoding keeps slot/offset/source locations and rejects unknown or truncated calls', () => {
  const tokens = new TokenReader(new BufferReader(binary([[ext(0x1d6)], [ext(0xee), n(1), t(','), n(1)]]))).read();
  assert.strictEqual(tokens[0].name, 'Led Off'); assert.strictEqual(tokens[0].location.offset, 22);
  assert.deepStrictEqual(tokens[0].extension, { slot: 1, reference: 0, offset: 0x1d6 });
  assert.strictEqual(tokens[2].name, 'Sam Play Voices');
  for (const command of [[w(0x4e)], [w(0x4e), 2, 0, w(0x1d6)], ext(0xffff), ext(0xac)]) {
    assert.throws(() => compile(binary([[command]])), /(?:Unsupported extension|Truncated token).*line 1/);
  }
  assert.throws(() => compile(binary([[ext(0x8a), text('5')]])), /numeric|number/i);
  assert.throws(() => compile(binary([[ext(0xee), n(1)]])), /Expected ,.*line 1/);
});

test('audio: independent sample record bytes and all six original samples decode without changing the bank', () => {
  const bank = BankReader.readFile(small).banks[0]; bank.data = Uint8Array.from(bank.data);
  const audio = createAudio(new Map([[5, bank]])), sample = audio.sample(1);
  assert.deepStrictEqual([sample.name, sample.frequency, sample.length, Array.from(sample.data)], ['Tone    ', 4000, 4, [0, 127, 128, 255]]);
  sample.data[0] = 99; assert.strictEqual(audio.sample(1).data[0], 0);
  const real = BankReader.readFile(original).banks[0]; real.data = Uint8Array.from(real.data);
  const reader = createAudio(new Map([[5, real]]));
  [2048, 2486, 180, 3862, 5148, 6960].forEach((length, index) => {
    const result = reader.sample(index + 1);
    assert.deepStrictEqual([result.name, result.frequency, result.length], [':Dithell', 4000, length]);
    // Independently address the original file: 20-byte bank wrapper, table and 14-byte record header.
    const record = original.readUInt32BE(22 + index * 4);
    assert.deepStrictEqual(Buffer.from(result.data), original.subarray(20 + record + 14, 20 + record + 14 + length));
  });
});

test('audio: malformed sample tables, offsets, lengths and frequencies reject boundedly', () => {
  const initial = BankReader.readFile(small).banks[0], originalData = Buffer.from(initial.data);
  for (const mutate of [
    b => b.writeUInt16BE(65535, 0), b => b.writeUInt32BE(0, 2), b => b.writeUInt32BE(2, 2),
    b => b.writeUInt32BE(7, 2), b => b.writeUInt32BE(0xfffffffe, 2), b => b.writeUInt16BE(0, 14),
    b => b.writeUInt32BE(0, 16), b => b.writeUInt32BE(3, 16), b => b.writeUInt32BE(0x1000002, 16)
  ]) {
    const data = Buffer.from(originalData); mutate(data);
    assert.throws(() => createAudio(new Map([[5, { ...initial, data }]])).sample(1), /sample/i);
  }
  for (let length = 0; length < originalData.length; length++) {
    assert.throws(() => createAudio(new Map([[5, { ...initial, data: originalData.subarray(0, length) }]])).sample(1), /sample/i);
  }
  assert.throws(() => createAudio(new Map()).sample(1), /Sample bank not found/);
  assert.throws(() => createAudio(new Map([[5, { ...initial, data: originalData }]])).sample(2), /Sample not defined/);
});

test('audio: all implemented overloads retain masks, default volume, loop/filter state and Paula rates', () => {
  const events = [];
  const { program } = run([
    [ext(0x8a), n(5)], [ext(0x1d6)], [ext(0x9a)], [ext(0xc6), n(2)],
    [ext(0xde), n(1)], [ext(0x256), n(5)], [ext(0xb4)], [ext(0x9a)],
    [ext(0xee), n(0x12), t(','), n(1)], [ext(0xf8), n(-1), t(','), n(1), t(','), n(100000)],
    [ext(0x1ca)], [ext(0x246)]
  ], { audio: { command: event => { events.push(event); } } });
  const plays = events.filter(event => event.type === 'play');
  assert.deepStrictEqual(plays.map(event => [event.mask, event.loopMask, event.volume, event.period]), [[15, 13, 56, 886], [2, 15, 56, 886], [15, 15, 56, 124]]);
  assert.strictEqual(plays[0].rate, 3546895 / 886);
  assert.deepStrictEqual({ ...program.state.audio }, { bank: 5, loopMask: 15, filterEnabled: true });
  assert.deepStrictEqual(events.filter(event => event.type === 'stop').map(event => event.mask), [5, 15]);
  const ntsc = [];
  run([[ext(0xde), n(1)]], { audioStandard: 'NTSC', audio: { command: event => { ntsc.push(event); } } });
  assert.strictEqual(ntsc[0].rate, 3579545 / 894);
  const fixture = require('./fixtures/conformance/music-samples.json'), fixtureEvents = [];
  execute(Buffer.from(fixture.programHex, 'hex'), 100, {
    files: createMemoryFiles(Object.fromEntries(Object.entries(fixture.files).map(([name, hex]) => [name, Buffer.from(hex, 'hex').toString('latin1')]))),
    audio: { command: event => { fixtureEvents.push(event); } }
  });
  assert.deepStrictEqual(fixtureEvents.map(event => event.type), ['filter', 'loop', 'play', 'stop']);
  assert.deepStrictEqual(Array.from(fixtureEvents[2].sample.data), [0, 127, 128, 255]);
});

test('audio: invalid bank/sample/rate and synchronous host failures halt with source context', () => {
  for (const line of [[ext(0x8a), n(0)], [ext(0x8a), n(17)], [ext(0xde), n(0)], [ext(0xde), n(2)],
    [ext(0xf8), n(1), t(','), n(1), t(','), n(500)]]) {
    assert.throws(() => run([line]), /at line 2, byte/);
  }
  for (const audio of [{}, { command: () => ({ then() {} }) }, { command() { throw new Error('audio failed'); } }]) {
    assert.throws(() => run([[ext(0xde), n(1)]], { audio }), /at line 2, byte/);
  }
  assert.throws(() => run([[ext(0x8a), n(6)], [ext(0xde), n(1)]]), /Sample bank not found at line 3/);
});

test('audio: Stop, End, runtime failures and independent factories preserve voice cleanup and configuration', () => {
  const { create } = compile(binary([load, [ext(0x9a)], [ext(0xde), n(1)], [t('Wait Key')], [t('Return')]]));
  const events = [], a = create({ files: bytes(), audio: { command: event => { events.push(event.type); } },
    setTimeout: () => 1, clearTimeout() {}, now: () => 0 }), b = create({ files: bytes(), setTimeout: () => 1, clearTimeout() {}, now: () => 0 });
  a.tick(100); assert.deepStrictEqual(events, ['loop', 'play']);
  assert.strictEqual(b.state.audio.loopMask, 0);
  a.stop(); assert.deepStrictEqual(events, ['loop', 'play', 'stop']);
  a.resume(); a.samPlay(1); a.sendKey('x');
  assert.throws(() => a.tick(100), /Return without Gosub/);
  assert.strictEqual(events[events.length - 1], 'stop');
  assert.strictEqual(a.state.halted, true);
  const halted = [];
  run([[ext(0xde), n(1)]], { audio: { command: event => { halted.push(event.type); } } });
  assert.deepStrictEqual(halted, ['play', 'stop']);
});

test('Wonderland: original first fifteen lines load the original volume path and configure sample bank five', () => {
  const { create } = compile(require('./helpers/wonderlandStartup')(15));
  for (const preloaded of [false, true]) {
    const reads = [], events = [];
    const program = create({ files: { read(name) { reads.push(name); return original.toString('latin1'); } },
      audio: { command: event => { events.push(event); } }, setTimeout: () => 1, clearTimeout() {}, now: () => 0 });
    if (preloaded) {
      const bank = BankReader.readFile(original).banks[0]; bank.data = Uint8Array.from(bank.data); program.banks.set(5, bank);
    }
    program.tick(100000);
    assert.strictEqual(program.state.halted, true);
    assert.deepStrictEqual(reads, preloaded ? [] : [filename]);
    assert.deepStrictEqual({ ...program.state.audio }, { bank: 5, loopMask: 0, filterEnabled: false });
    assert.strictEqual(program.audio.sample(6).length, 6960);
    assert.deepStrictEqual(events.map(event => event.type), ['filter', 'loop']);
  }
});

test('audio: uncached Sam Play base token resolves only its verified one/two/three-argument family',()=>{
  for(const [args,voices,frequency]of [[[n(1)],15,4000],[[n(2),t(','),n(1)],2,4000],[[n(4),t(','),n(1),t(','),n(9000)],4,9000]]){
    const events=[],{program}=run([[ext(0xde),...args]],{audio:{command:event=>events.push(event)}}),event=events.find(item=>item.type==='play');
    assert.strictEqual(event.mask,voices);assert.strictEqual(event.period,Math.floor(3546895/frequency));assert.strictEqual(program.state.halted,true);
  }
  assert.throws(()=>compile(binary([[ext(0xde),n(1),t(','),n(1),t(','),n(9000),t(','),n(1)]])),/Unsupported Sam Play argument count/);
  assert.throws(()=>compile(binary([[[w(0x4e),1,1,w(0xde)],n(1),t(','),n(1)]])),/Expected end of statement/);
  assert.throws(()=>compile(binary([[ext(0xde),n(1),t(','),text('sample')]])),/numeric|number/i);
});
