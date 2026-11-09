'use strict';
const assert=require('assert');
const vm=require('vm');
const create=require('../lib/amos/webAudioStream');
function fixture(options={}) {
  const sources=[],events=[],active=new Set();
  const node=()=>({connect(){},disconnect(){this.disconnected=true;},frequency:{value:0},Q:{value:0}});
  const context={currentTime:0,state:'running',destination:{},createGain:node,createBiquadFilter:node,createChannelMerger:node,
    createBuffer(channels,length,rate){const data=new Float32Array(length);return{length,sampleRate:rate,data,copyToChannel(v){data.set(v);}};},
    createBufferSource(){const s={...node(),start(...args){this.started=args;},stop(){this.stopped=true;}};sources.push(s);return s;}};
  const native=()=>({command(e){events.push(e);for(let v=0;v<4;v++)if(e.mask&(1<<v)){if(e.type==='stop')active.delete(v);if(e.type==='play')active.add(v);}},activeVoices:()=>[...active],dispose(){active.clear();}});
  const host=create(context,native,options);
  return{context,host,sources,events,native};
}
const block=(frame=0,mask=15,stream=1,count=160)=>({type:'pcm',frame,mask,stream,sampleRate:8000,channels:Array.from({length:4},(_,v)=>new Float32Array(count).fill((v+1)/8))});

test('Web Audio PCM: contiguous block scheduling, owned copies, exact stereo routing and retired-node cleanup',()=>{
  const {host,sources,events}=fixture();const e=block();host.command(e);host.command(block(160));
  assert.deepStrictEqual(sources.map(s=>s.started),Array.from({length:8},(_,i)=>[i<4?0.04:0.06,0]));
  e.channels[0].fill(0);assert.strictEqual(sources[0].buffer.data[0],0.125);
  assert.deepStrictEqual(host.activeVoices(),[0,1,2,3]);assert.strictEqual(events.filter(e=>e.type==='stop').length,4);
  const late=sources[0].onended;host.command({type:'stop',mask:1});late();assert(sources[0].stopped);
  assert.deepStrictEqual(host.activeVoices(),[1,2,3]);host.dispose();host.dispose();assert.deepStrictEqual(host.activeVoices(),[]);
  assert(sources.every(s=>s.disconnected));
});

test('Web Audio PCM: late blocks are trimmed or dropped on the original timeline, never replayed',()=>{
  const {host,context,sources}=fixture({latency:0});host.command(block(0,1));
  context.currentTime=0.03;host.command(block(160,1));
  assert.deepStrictEqual(sources[1].started,[0.03,0.01]);
  context.currentTime=0.1;host.command(block(320,1));assert.strictEqual(sources.length,2);
  host.command(block(480,1));host.command(block(640,1));assert.strictEqual(sources.length,2);
  host.command(block(800,1));assert.strictEqual(sources.length,3);assert.deepStrictEqual(sources[2].started,[0.1,0]);
});

test('Web Audio PCM: mask-local native takeover, stream resumption and aligned new channels',()=>{
  const {host,context,sources,events}=fixture();host.command(block());
  host.command({type:'play',mask:8,volume:64});assert(sources[3].stopped);assert(!sources[0].stopped);
  assert.strictEqual(events.at(-1).volume,32);
  context.currentTime=0.02;host.command(block(160,7));
  host.command(block(320,15));assert.deepStrictEqual(sources.at(-1).started,[0.08,0]);
  assert.deepStrictEqual(host.activeVoices(),[0,1,2,3]);
  host.command({type:'stop',mask:15});host.command(block(0,15,2));assert.deepStrictEqual(sources.at(-1).started,[0.06,0]);
});

test('Web Audio PCM: complete preflight preserves ownership on invalid PCM, gaps, rates or lookahead',()=>{
  const {host,sources}=fixture();host.command(block());
  for(const mutate of [e=>{e.channels[3][0]=NaN;},e=>{e.channels[0]=new Float32Array(1);},e=>{e.frame=161;},e=>{e.sampleRate=16000;},e=>{e.channels=e.channels.map(()=>new Float32Array(8000));}]){
    const e=block(160);mutate(e);assert.throws(()=>host.command(e),/PCM/);assert.strictEqual(sources.length,4);assert(sources.every(s=>!s.stopped));
  }
  assert.throws(()=>host.command({type:'voice',mask:1,rate:8000}),/rendered/);
  host.command({type:'stop',mask:15});assert.deepStrictEqual(host.activeVoices(),[]);
  host.dispose();assert.throws(()=>host.command(block()),/disposed/);
});

test('Web Audio PCM: bounded short-block queues and failed start release only affected channels',()=>{
  const {host,context,sources}=fixture({latency:0});
  for(let i=0;i<128;i++)host.command(block(i,1,1,1));
  assert.throws(()=>host.command(block(128,1,1,1)),/node bound/);
  context.currentTime=0.02;host.command(block(128,1,1,1));assert.deepStrictEqual(host.activeVoices(),[]);
  host.command(block(0,2,2));const good=sources.at(-1);
  context.createBufferSource=()=>({connect(){},disconnect(){},stop(){},start(){throw Error('failed start');}});
  assert.throws(()=>host.command(block(0,1,3)),/failed start/);assert(!good.stopped);assert.deepStrictEqual(host.activeVoices(),[1]);
});

test('Web Audio PCM: standalone composition rejects async native commands and cleans closed contexts',()=>{
  const {context,native}=fixture();const host=vm.runInNewContext(`(${create.toString()})(context,native)`,{context,native});host.command(block());
  context.state='closed';assert.throws(()=>host.command(block(160)),/closed/);host.command({type:'stop',mask:15});host.dispose();
  const async=create(context,()=>({command:()=>Promise.resolve(),activeVoices:()=>[],dispose(){}}));
  assert.throws(()=>async.command({type:'stop',mask:15}),/synchronously/);async.dispose();
});
