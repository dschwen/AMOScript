'use strict';
const assert = require('assert');
const vm = require('vm');
const create = require('../lib/amos/amcafStream');
const factories = { sequence: require('../lib/amos/amcafSequencer'), pitch: require('../lib/amos/amcafPitch'), pcm: require('../lib/amos/amcafPcm') };
const preview = require('./helpers/amcafPreviewModule');

test('AMCAF stream: contiguous four-voice PCM, unchanged mix and independently masked channels', () => {
  const events = [], module = preview(), p = create(module,factories,{sampleRate:8000,host:{command:e=>events.push(e)}});
  const seq = factories.sequence(module,factories.pitch), pcm = factories.pcm(module.samples,{sampleRate:8000});
  for (let i=0;i<10;i++) {
    p.tick(); pcm.apply(seq.tick()); p.render(160); const mixed=pcm.render(160),e=events.at(-1);
    assert.deepStrictEqual([e.type,e.stream,e.frame,e.sampleRate,e.mask],['pcm',1,i*160,8000,15]);
    assert.deepStrictEqual(Array.from(mixed.left),Array.from(e.channels[0],(x,j)=>x+e.channels[3][j]));
    assert.deepStrictEqual(Array.from(mixed.right),Array.from(e.channels[1],(x,j)=>x+e.channels[2][j]));
  }
  p.setMask(7);assert.deepStrictEqual(events.at(-1),{type:'stop',mask:8});
  p.render(160);assert.strictEqual(events.at(-1).mask,7);
  assert.strictEqual(p.state.sampler.frames,1760); p.setMask(0);const count=events.length;
  p.render(160);assert.strictEqual(events.length,count);assert.strictEqual(p.state.frame,1920);
});

test('AMCAF stream: Pause freezes cursors and counters; Resume opens a fresh host timeline', () => {
  const events=[],p=create(preview(),factories,{sampleRate:8000,host:{command:e=>events.push(e)}});
  for(let i=0;i<8;i++){p.tick();p.render(160);}p.pause();const frozen=p.state;
  assert.deepStrictEqual(events.at(-1),{type:'stop',mask:15});
  assert.strictEqual(p.tick(),null);assert.strictEqual(p.render(160),false);assert.deepStrictEqual(p.state,frozen);
  p.resume();assert.deepStrictEqual(p.state.sampler,frozen.sampler);assert.deepStrictEqual(p.state.sequence,frozen.sequence);
  p.render(160);assert.deepStrictEqual([events.at(-1).stream,events.at(-1).frame],[2,0]);
  p.stop();p.stop();const count=events.length;assert.strictEqual(p.render(160),false);assert.strictEqual(events.length,count);
});

test('AMCAF stream: synchronous callback Stop is terminal; recursive rendering and async hosts fail cleanly', () => {
  let p;const types=[];
  p=create(preview(),factories,{host:{command:e=>{types.push(e.type);if(e.type==='pcm')p.stop();}}});
  assert.strictEqual(p.render(128),false);assert.deepStrictEqual(types,['pcm','stop']);assert(p.state.stopped);
  let r;const events=[];
  r=create(preview(),factories,{host:{command:e=>{events.push(e.type);if(e.type==='pcm')r.render(1);}}});
  assert.throws(()=>r.render(1),/cannot be entered/);assert(r.state.stopped);assert.deepStrictEqual(events,['pcm','stop']);
  const async=create(preview(),factories,{host:{command:()=>Promise.resolve()}});
  assert.throws(()=>async.render(1),/synchronously/);assert(async.state.stopped);
});

test('AMCAF stream: volume uses sequencer latches; invalid bounds halt and standalone factory needs no imports', () => {
  const p=create(preview(),factories,{sampleRate:8000});
  p.setVolume(16);assert.strictEqual(p.state.sequence.master,16);
  assert.throws(()=>p.setMask(16),/mask/);assert(p.state.stopped);
  const q=create(preview(),factories);assert.throws(()=>q.render(65537),/frame count/);
  const source=`(${create.toString()})(input,{sequence:(${factories.sequence.toString()}),pitch:(${factories.pitch.toString()}),pcm:(${factories.pcm.toString()})})`;
  const standalone=vm.runInNewContext(source,{input:preview()});
  for(let i=0;i<6;i++)standalone.tick();assert.strictEqual(standalone.render(128),true);
});
