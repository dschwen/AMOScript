/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),crypto=require('crypto');
const {compile,binary,word:w,integer:n,token:t}=require('./helpers/program');
const createAudio=require('../lib/amos/audio'),expected=require('./fixtures/audio/boom.json');
const boom=[w(0x4e),1,0,w(0x74)],hash=data=>crypto.createHash('sha256').update(Buffer.from(data.buffer,data.byteOffset,data.byteLength)).digest('hex');

test('Boom: all four pitches, integer envelope and field-mutated finite PCM match independent PAL/phase/NTSC vectors',()=>{
  for(const vector of expected.cases){
    let field=vector.phase;const events=[],audio=createAudio(new Map(),{standard:vector.name==='ntsc'?'NTSC':'PAL',vblHz:vector.hz,noiseSeed:vector.seed,noiseBeam:vector.beam,fieldTime:()=>field,host:{command:e=>events.push(e)}});
    audio.boom();assert.strictEqual(events.length,4);
    for(const [index,voice]of vector.voices.entries()){const event=events[index];assert.deepStrictEqual([event.mask,event.period,event.sample.length,event.rate,event.loopMask,event.effect,event.sample.format],[voice.mask,voice.period,voice.length,44100,0,'boom','float32']);assert.strictEqual(hash(event.sample.data),voice.sha256);}
    audio.loop(true);assert.strictEqual(events.at(-1).mask,0,'Sam loop must not loop finite Boom PCM');
    const initial=audio.noiseState();assert.strictEqual(initial.seed,vector.initialSeed);assert.strictEqual(hash(initial.wave),vector.initialWaveSha256);assert.deepStrictEqual(initial.volumes,expected.volumes);
    field=1;assert.strictEqual(hash(audio.noiseState().wave),vector.field1WaveSha256);field=61;assert.strictEqual(audio.noiseState().mask,0);assert.strictEqual(hash(audio.noiseState().wave),vector.field60WaveSha256);assert.strictEqual(events.length,5,'logical advancement must not replay PCM');
  }
});

test('Boom: generated no-import program dispatches verified token once, preserves Sam state, and Stop/End silence owned voices',()=>{
  const source=binary([[boom],[t('Wait Key')],[t('End')]]),clock=require('./helpers/fakeTimers').createFakeTimers(4),events=[];
  const p=compile(source).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,audio:{command:e=>events.push(e)}});p.tick(1000);
  assert.deepStrictEqual(events.map(e=>e.mask),[8,4,2,1]);assert.deepStrictEqual({...p.state.audio},{bank:5,loopMask:0,filterEnabled:true});assert.strictEqual(clock.pending(),0);
  p.stop();assert.strictEqual(events.at(-1).type,'stop');clock.tick(1000);p.resume();assert.strictEqual(events.filter(e=>e.type==='play').length,4);p.sendKey('x');clock.tick(4);assert.strictEqual(p.state.halted,true);assert.strictEqual(clock.pending(),0);
  assert.throws(()=>compile(binary([[boom,n(1)]])),/line 1/);
});

test('Boom: noise history is per factory, snapshots/PCM are owned, and replacement/stop masks cancel noise before later starts',()=>{
  let field=0;const make=()=>createAudio(new Map(),{fieldTime:()=>field}),a=make(),b=make();a.boom();const pristine=a.noiseState();pristine.wave.fill(0);
  field=10;const after=a.noiseState();assert.notStrictEqual(hash(after.wave),hash(pristine.wave));a.stop(7);assert.strictEqual(a.noiseState().mask,8);
  a.command({type:'play',mask:8,volume:32,sample:{data:new Uint8Array(2),length:2}});assert.strictEqual(a.noiseState().mask,0);const frozen=a.noiseState();field=100;assert.strictEqual(hash(a.noiseState().wave),hash(frozen.wave));b.boom();assert.strictEqual(hash(b.noiseState().wave),expected.cases[0].initialWaveSha256);
  a.boom();assert.notStrictEqual(hash(a.noiseState().wave),hash(b.noiseState().wave));a.silence();assert.strictEqual(a.noiseState().mask,0);
  field=0;const first=[],second=[],c=createAudio(new Map(),{fieldTime:()=>field,host:{command:e=>first.push(e)}}),d=createAudio(new Map(),{fieldTime:()=>field,host:{command:e=>second.push(e)}});c.boom();d.boom();field=10;c.noiseState();field=10.5;c.boom();d.boom();assert.deepStrictEqual(first.slice(-4).map(e=>hash(e.sample.data)),second.slice(-4).map(e=>hash(e.sample.data)),'Observing noise must not change later onset volumes');
});

test('Boom: invalid portable seed/beam/clock fail boundedly and host errors halt with source context and cleanup',()=>{
  for(const options of [{noiseSeed:-1},{noiseBeam:65536},{noiseBeam:Promise.resolve(1)},{fieldTime:()=>NaN}])assert.throws(()=>createAudio(new Map(),options).boom(),/Boom/);
  const clock=require('./helpers/fakeTimers').createFakeTimers(4),events=[];const p=compile(binary([[boom],[t('Wait Key')]])).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,audio:{command(e){events.push(e);if(e.type==='play')throw Error('blocked effect');}}});
  assert.throws(()=>p.tick(1000),/blocked effect at line 1, byte/);assert.strictEqual(p.state.halted,true);assert.strictEqual(events.at(-1).type,'stop');assert.strictEqual(clock.pending(),0);
});


test('Boom: synchronous host Stop or a newer Boom cancels the remaining older voice starts',()=>{
  const clock=require('./helpers/fakeTimers').createFakeTimers(4),events=[];let p;
  p=compile(binary([[boom],[t('Wait Key')]])).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,audio:{command(e){events.push(e);if(e.type==='play')p.stop();}}});
  p.tick(1000);assert.strictEqual(p.state.stopped,true);assert.deepStrictEqual(events.map(e=>[e.type,e.mask]),[['play',8],['stop',15]]);assert.strictEqual(clock.pending(),0);
  let nested=false;const masks=[];const audio=createAudio(new Map(),{host:{command(e){if(e.type==='play'){masks.push(e.mask);if(!nested){nested=true;audio.boom();}}}}});audio.boom();assert.deepStrictEqual(masks,[8,8,4,2,1]);assert.strictEqual(audio.noiseState().mask,15);audio.silence();
});
