/* jshint esversion: 6 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const readMod = require('../lib/amos/mod');
const createTracker = require('../lib/amos/tracker');

function fixture() {
  const literal = require('./fixtures/mod-literal.json'), bytes = Buffer.alloc(literal.byteLength);
  for (const [at, hex] of literal.patches) Buffer.from(hex, 'hex').copy(bytes, at);
  const module = readMod(bytes);
  // Replace the arpeggio cell explicitly: that effect is outside this subset.
  module.patterns[0].forEach(c => { c.sample = c.period = c.effect = c.parameter = 0; });
  return module;
}
const fields = (player, count) => { for (let i = 0; i < count; i++) player.tick(); };

test('tracker: first row at field six, speed-seven slides on intervening fields and retained instruments', () => {
  const m = fixture(), events = [];
  m.patterns[0][0] = { sample: 1, period: 428, effect: 12, parameter: 32 };
  m.patterns[0][1].effect = 15; m.patterns[0][1].parameter = 7;
  m.patterns[0][4] = { sample: 0, period: 0, effect: 10, parameter: 10 };
  m.patterns[0][8] = { sample: 0, period: 856, effect: 0, parameter: 0 };
  const p = createTracker(m, { host: { command: e => events.push(e) } });
  fields(p, 5); assert.deepStrictEqual(events, []);
  p.tick(); assert.deepStrictEqual(events.filter(e => e.type === 'play').map(e => [e.field, e.period, e.volume]), [[6, 428, 32]]);
  fields(p, 7); assert.strictEqual(p.state.voices[0].volume, 32);
  fields(p, 6); assert.deepStrictEqual(events.filter(e => e.field >= 14).map(e => [e.field, e.volume]), [[14,22],[15,12],[16,2],[17,0],[18,0],[19,0]]);
  p.tick(); assert.deepStrictEqual(events.filter(e => e.type === 'play').map(e => [e.field,e.sample.number,e.period,e.volume]), [[6,1,428,32],[20,1,856,0]]);
});

test('tracker: AMOS preprocessing is owned, ignores finetune, truncates initial fetch at repeat end', () => {
  const m = fixture(), events = [], before = Array.from(m.samples[0].pcm);
  m.patterns[0][0] = { sample: 1, period: 428, effect: 0, parameter: 0 };
  fields(createTracker(m, { host: { command: e => events.push(e) } }), 6);
  const e = events.find(e => e.type === 'play');
  assert.deepStrictEqual(Array.from(e.sample.data), [0,0,0,0,1,2,254,64]);
  assert.deepStrictEqual([e.rate,e.loopStart,e.loopEnd,e.loopMask], [3546895/428,2,8,1]);
  assert.deepStrictEqual(Array.from(m.samples[0].pcm), before); assert.strictEqual(m.samples[0].finetune, -1);
  m.samples[0].length = 2; m.samples[0].pcm = Int8Array.from([9,8]); m.samples[0].loopStart = 0; m.samples[0].loopLength = 2;
  m.samples[1] = { ...m.samples[0], number: 2, length: 6, pcm: Int8Array.from([7,6,5,4,3,2]), loopStart: 2, loopLength: 2 };
  m.patterns[0][0].sample = 2; events.length = 0;
  fields(createTracker(m, { host: { command: e => events.push(e) } }), 6);
  assert.deepStrictEqual(Array.from(events.find(e => e.type === 'play').sample.data), [0,0,0,0]);
});

test('tracker: row effects clamp speed/volume, E toggles filter, D ignores row operand', () => {
  const m = fixture(), events = [];
  m.patterns[0][0] = { sample: 1, period: 428, effect: 12, parameter: 255 };
  m.patterns[0][1] = { sample: 0, period: 0, effect: 15, parameter: 255 };
  m.patterns[0][2] = { sample: 0, period: 0, effect: 14, parameter: 1 };
  m.patterns[0][3] = { sample: 0, period: 0, effect: 13, parameter: 63 };
  m.songLength = 2; m.orderTable[1] = 0;
  const p = createTracker(m, { host: { command: e => events.push(e) } }); fields(p, 6);
  assert.deepStrictEqual([p.state.speed,p.state.order,p.state.row,p.state.filterEnabled,p.state.voices[0].volume], [31,1,0,false,64]);
  m.patterns[0][1].parameter = 0; m.patterns[0][2].parameter = 0; fields(p,31);
  assert.strictEqual(p.state.speed,1); assert.strictEqual(p.state.filterEnabled,true); assert.strictEqual(p.state.playing,false);
  assert.strictEqual(events.at(-1).type,'stop');
});

test('tracker: volume-slide upper nibble wins and instrument-only rows update without restarting', () => {
  const m = fixture(), events = [];
  m.patterns[0][0] = { sample: 1, period: 428, effect: 10, parameter: 0x2f };
  m.patterns[0][4] = { sample: 1, period: 0, effect: 0, parameter: 0 };
  const p = createTracker(m, { host: { command: e => events.push(e) } }); fields(p, 11);
  assert.strictEqual(p.state.voices[0].volume,42); p.tick(); assert.strictEqual(p.state.voices[0].volume,32);
  assert.strictEqual(events.filter(e => e.type === 'play').length,1);
});

test('tracker: bounded raw restart, end/stop, synchronous host failure and independent players', () => {
  const m = fixture(); m.patterns[0][0].effect = 13; m.restart = 120;
  const a = createTracker(m, { loop: true }), b = createTracker(m);
  fields(a,6); assert.strictEqual(a.state.order,120); assert.strictEqual(b.state.field,0);
  fields(b,6); assert.strictEqual(b.state.playing,false); b.tick(); assert.strictEqual(b.state.field,6);
  a.stop(); a.stop(); assert.strictEqual(a.state.playing,false);
  m.restart = 255; const bad = createTracker(m,{loop:true}); assert.throws(() => fields(bad,6),/restart.*field 6/); assert.strictEqual(bad.state.playing,false);
  const failure = createTracker(fixture(),{host:{command(){throw new Error('host failed');}}});
  assert.throws(() => failure.stop(), /host failed/); assert.strictEqual(failure.state.playing,false);
});

test('tracker: unsupported effects reject before dispatch and async hosts fail with field context', () => {
  const m = fixture(); m.patterns[0][255].effect = 3;
  assert.throws(() => createTracker(m),/unsupported effect 3 at pattern 0, row 63, channel 3/);
  m.patterns[0][255].effect = 0; m.patterns[0][0].sample = 1;
  const p = createTracker(m,{host:{command:()=>Promise.resolve()}});
  assert.throws(() => fields(p,6),/synchronously.*field 6/); assert.strictEqual(p.state.playing,false);
});

test('tracker: original Roller II tune traverses 22 orders and preserves native restart 120', () => {
  const bytes = fs.readFileSync(require('path').join(__dirname,'../examples/Roller2/music/mod.Roller_II_mus'));
  const m = readMod(bytes), events = [], audit = require('./helpers/roller2NoteAudit')(bytes);
  const p = createTracker(m,{host:{command:e=>events.push(e)}});
  let count = 0; while(p.state.playing && count++ < 12000) p.tick();
  assert.strictEqual(p.state.playing,false); assert.strictEqual(count,9631); // 6 + (1376 - 1) * 7 fields.
  assert.strictEqual(audit.notes.length,1997); assert.strictEqual(audit.rows,1376);
  assert.deepStrictEqual(audit.byChannel,[1108,226,80,583]);
  assert.deepStrictEqual(audit.bySample,[82,430,595,82,5,585,165,2,42,9]);
  assert.deepStrictEqual(events.filter(e=>e.type==='play').map(e=>[e.field,Math.log2(e.mask),e.sample.number,e.period,e.volume]),audit.notes);
  assert.strictEqual(events.at(-1).type,'stop');
  const loop = createTracker(m,{loop:true}); fields(loop,count); assert.strictEqual(loop.state.order,120); assert.strictEqual(loop.state.row,0);
  fields(loop,7*64*8); assert.strictEqual(loop.state.order,0);
});

test('tracker: native 1xx/2xx pitch slides run between rows, clamp periods and retain no zero-parameter memory', () => {
  const m=fixture(),events=[];
  m.patterns[0][0]={sample:1,period:120,effect:1,parameter:4};
  m.patterns[0][1]={sample:1,period:850,effect:2,parameter:3};
  m.patterns[0][4]={sample:0,period:0,effect:1,parameter:0};
  m.patterns[0][5]={sample:0,period:0,effect:2,parameter:0};
  const p=createTracker(m,{host:{command:e=>events.push(e)}}); fields(p,6);
  const periods=[]; for(let i=0;i<6;i++){p.tick();periods.push([p.state.voices[0].period,p.state.voices[1].period]);}
  assert.deepStrictEqual(periods,[[116,853],[113,856],[113,856],[113,856],[113,856],[113,856]]);
  fields(p,5); assert.deepStrictEqual([p.state.voices[0].period,p.state.voices[1].period],[113,856]);
  assert.strictEqual(events.filter(e=>e.type==='play').length,2);
  assert.ok(events.some(e=>e.type==='voice'&&e.mask===1&&e.rate===3546895/116));
});

test('tracker: complete original ASM Zoom tune matches independent field-period and note-trigger traces',()=>{
  const crypto=require('crypto'),expected=require('./fixtures/asm-zoom-tracker.json'),bytes=fs.readFileSync(require('path').join(__dirname,'../examples/ASM/intro/Zoom.Mus'));
  const hash=b=>crypto.createHash('sha256').update(b).digest('hex');assert.strictEqual(hash(bytes),expected.sourceSha256);
  for(const standard of ['PAL','NTSC']) {
    const periods=[],triggers=[];
    const p=createTracker(readMod(bytes),{standard,host:{command:e=>{if(e.type==='play'){const b=Buffer.alloc(8);b.writeUInt32BE(e.field);b[4]=e.mask;b[5]=e.sample.number;b.writeUInt16BE(e.period,6);triggers.push(b);assert.strictEqual(e.rate,(standard==='PAL'?3546895:3579545)/e.period);}}}});
    for(let i=0;i<expected.fields;i++){p.tick();const b=Buffer.alloc(8);p.state.voices.forEach((v,c)=>b.writeUInt16BE(v.period,c*2));periods.push(b);}
    assert.strictEqual(p.state.playing,false);assert.strictEqual(triggers.length,expected.notes);
    assert.strictEqual(hash(Buffer.concat(periods)),expected.periodTraceSha256);assert.strictEqual(hash(Buffer.concat(triggers)),expected.triggerTraceSha256);
  }
});
