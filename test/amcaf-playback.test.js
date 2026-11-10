'use strict';
const assert=require('assert');
const create=require('../lib/amos/amcafPlayback');
const factories={stream:require('../lib/amos/amcafStream'),sequence:require('../lib/amos/amcafSequencer'),pitch:require('../lib/amos/amcafPitch'),pcm:require('../lib/amos/amcafPcm')};
const moduleData=require('./helpers/amcafPreviewModule');
const fields=bpm=>(Math.floor(1773447/bpm)+1)/709379*50;

test('AMCAF clock: row Fxx updates the latch after the current hardware reload',()=>{
  const m=moduleData();m.patterns[0][0].effect=15;m.patterns[0][0].parameter=250;
  const p=create(m,factories,{sampleRate:8000});p.advance(fields(125)*6+1e-9);
  assert.strictEqual(p.state.position.sequence.bpm,250);
  assert(Math.abs(p.state.next-fields(125)*7)<1e-8);
  p.advance(fields(125)*7+1e-9);
  assert(Math.abs(p.state.next-(fields(125)*7+fields(250)))<1e-8);p.stop();
});

test('AMCAF clock: mode changes flush partial PCM and VBL mode stays on global field boundaries',()=>{
  const events=[],p=create(moduleData(),factories,{sampleRate:8000,host:{command:e=>events.push(e)}});
  p.setSpeed(0,0.25);assert.strictEqual(p.state.next,1);assert.strictEqual(events.at(-1).channels[0].length,40);
  p.advance(1);assert.strictEqual(p.state.position.sequence.ticks,1);assert.strictEqual(p.state.next,2);
  p.pause();const frozen=p.state.position.sampler;
  p.setSpeed(180,100);assert.strictEqual(p.nextField(),null);assert.deepStrictEqual(p.state.position.sampler,frozen);
  p.setSpeed(0,100.1);p.resume(100.25);
  assert.strictEqual(p.state.next,101);assert.deepStrictEqual(p.state.position.sampler,frozen);
  p.setSpeed(180,100.5);assert(Math.abs(p.state.next-(100.5+fields(180)))<1e-8);p.stop();
});

test('AMCAF clock: catch-up is bounded, and callback Stop cannot continue old ticks',()=>{
  let p;const types=[];
  p=create(moduleData(),factories,{host:{command:e=>{types.push(e.type);if(e.type==='pcm')p.stop();}}});
  p.advance(20);assert.strictEqual(p.state.playing,false);assert.strictEqual(p.state.position.sequence.ticks,0);
  assert.deepStrictEqual(types,['pcm','stop']);
  const q=create(moduleData(),factories);assert.throws(()=>q.advance(251),/five seconds/);q.stop();
  let reads=0;const cheap=create(moduleData(),{stream:()=>({get state(){reads++;return{sequence:{bpm:125}};},stop(){}})});
  const initial=reads;for(let i=0;i<10000;i++)assert(cheap.nextField()>0);
  assert.strictEqual(reads,initial,'Polling a deadline must not inspect/copy voice state');cheap.stop();
});

test('AMCAF clock: sample cancellation flushes partial fields without rebasing the tick deadline',()=>{
  const events=[],p=create(moduleData(),factories,{sampleRate:8000,cia:false,host:{command:e=>events.push(e)}});
  p.advance(7);const next=p.nextField(),ticks=p.state.position.sequence.ticks;
  p.stopVoices(1,7.25);
  assert.deepStrictEqual(events.at(-1),{type:'stop',mask:1});
  assert.strictEqual(events.at(-2).channels[0].length,40);
  assert.strictEqual(p.nextField(),next);assert.strictEqual(p.state.position.sequence.ticks,ticks);
  assert.strictEqual(p.state.frames,1160);p.advance(8);
  assert.strictEqual(events.at(-1).channels[0].length,120);
  assert(events.at(-1).channels[0].every(x=>x===0));assert(events.at(-1).channels[1].some(x=>x!==0));
  const before=p.state;assert.throws(()=>p.stopVoices(16,8.25),/mask/);assert.deepStrictEqual(p.state,before);p.stop();
});
