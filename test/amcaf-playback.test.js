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

test('AMCAF clock: raw leases use independent VBL deadlines, preserve song progress and freeze over host pause',()=>{
  const events=[],p=create(moduleData(),factories,{sampleRate:8000,host:{command:e=>events.push(e)}});
  p.advance(7.3);const before=p.state.position.sequence.ticks;
  p.rawPlay(8,Uint8Array.from([64,128]),428,3,7.3);
  assert.strictEqual(p.nextField(),8);p.advance(8);assert.deepStrictEqual(p.state.position.leases,[0,0,0,2]);
  p.advance(8.1);assert(p.state.position.sequence.ticks>before);p.pause();p.advance(100);p.resume(100.2);
  assert.strictEqual(p.nextField(),101);p.advance(101);assert.strictEqual(p.state.position.leases[3],1);
  p.advance(102);assert.strictEqual(p.state.position.sampler.rawMask,0);assert(events.some(e=>e.type==='stop'&&e.mask===8));p.stop();
  const raw=create(null,factories,{sampleRate:8000});assert.strictEqual(raw.nextField(),null);
  raw.rawPlay(1,Uint8Array.from([0,127]),428,1,0.2);assert.strictEqual(raw.nextField(),1);
  raw.advance(1);assert.strictEqual(raw.nextField(),null);assert.strictEqual(raw.state.position.sequence,null);raw.stop();
});

test('AMCAF clock: host Stop during raw takeover or VBL release defers pause until the command returns',()=>{
  for(const stopAt of ['takeover','release']){
    let p,armed=false;
    p=create(null,factories,{host:{command:e=>{if(armed&&e.type==='stop'&&e.mask===8)p.pause();}}});
    armed=stopAt==='takeover';p.rawPlay(8,Uint8Array.from([0,127]),428,1,0);
    if(stopAt==='release'){armed=true;p.advance(1);}
    assert.strictEqual(p.state.paused,true);assert.strictEqual(p.state.playing,true);assert.strictEqual(p.nextField(),null);
    armed=false;p.resume(10);if(stopAt==='takeover')p.advance(11);
    assert.strictEqual(p.state.position.sampler.rawMask,0);p.stop();
  }
});

test('AMCAF Pt Voice: flush partial fields, disable DMA, keep ticks running and wait for a real new note after re-enable',()=>{
 const events=[],p=create(moduleData(),factories,{sampleRate:8000,cia:false,host:{command:e=>events.push(e)}});
 p.advance(7);assert(events.at(-1).channels[0].some(v=>v!==0));const before=p.state.position.sequence.ticks;
 p.setVoiceMask(14,7.25);assert.strictEqual(events.at(-2).channels[0].length,40);assert.deepStrictEqual(events.at(-1),{type:'stop',mask:1});
 assert.strictEqual(p.state.position.sampler.voices[0].active,false);assert.strictEqual(p.nextField(),8);
 p.advance(13);assert.strictEqual(p.state.position.sequence.ticks,before+6);assert.strictEqual(events.at(-1).mask,14);
 p.setVoiceMask(15,13.25);p.advance(14);assert(events.at(-1).channels[0].every(v=>v===0));
 while(p.state.position.sequence.ticks<149){p.advance(p.nextField());assert(events.at(-1).channels[0].every(v=>v===0));}
 p.advance(150);p.advance(151);assert(events.at(-1).channels[0].some(v=>v!==0));p.stop();
});

test('AMCAF Pt Voice: pause retains the user mask; raw DMA is silenced without discarding its lease',()=>{
 const p=create(moduleData(),factories,{sampleRate:8000,cia:false});p.advance(7);p.pause();
 const ticks=p.state.position.sequence.ticks;p.setVoiceMask(0,100);assert.strictEqual(p.state.position.mask,0);assert.strictEqual(p.state.position.sequence.ticks,ticks);p.resume(100);p.advance(101);
 assert(p.state.position.sampler.voices.every(v=>!v.active));
 p.rawPlay(8,Uint8Array.of(128,64,0,64),428,3,101.25);const leases=p.state.position.leases;
 p.setVoiceMask(0,101.5);assert.deepStrictEqual(p.state.position.leases,leases);assert.strictEqual(p.state.position.sampler.rawMask,8);assert.strictEqual(p.state.position.sampler.voices[3].active,false);
 p.advance(104);assert.strictEqual(p.state.position.sampler.rawMask,0);assert.strictEqual(p.state.position.mask,0);p.stop();
});
test('AMCAF clock: a delayed first advance tags each PCM block with its age instead of replaying catch-up as future audio',()=>{
 const events=[],p=create(moduleData(),factories,{cia:false,sampleRate:8000,host:{command:e=>events.push(e)}});p.advance(100);const blocks=events.filter(e=>e.type==='pcm');assert.strictEqual(blocks.length,100);assert.strictEqual(blocks[0].lag,1.98);assert.strictEqual(blocks.at(-1).lag,undefined);assert.strictEqual(blocks.at(-1).frame,15840);p.stop();
});
