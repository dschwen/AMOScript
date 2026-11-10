'use strict';
const assert=require('assert'),vm=require('vm'),Transpiler=require('../lib/Transpiler');
const {binary,token:t,word:w,integer:n,text}=require('./helpers/tokens');
const {createFakeTimers}=require('./helpers/fakeTimers');
const createFiles=require('../lib/amos/files').createMemoryFiles;
const raw=require('./helpers/amcafPreviewBytes')();
const extension=offset=>[w(0x4e),[8,0],w(offset)];
function compile(lines){const sandbox={module:{exports:{}}};vm.runInNewContext(new Transpiler(binary(lines),{extensions:{8:'amcaf-1.50beta4'}}).toModule(),sandbox);return sandbox.module.exports;}
function start({speed=null,lines=[],host=null,standard='PAL',hz=50}={}){
  const clock=createFakeTimers(),events=[];
  const create=compile([[[w(0x4e),[1,0],w(0x2ba)],text('music'),t(','),n(3)],...(speed==null?[]:[[extension(0x10f2),n(speed)]]),[extension(0x108e),n(3)],...lines,[t('Wait Key')],[extension(0x10a8)],[t('End')]]);
  const p=create({files:createFiles({music:raw.toString('latin1')}),now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,vblHz:hz,audioStandard:standard,
    audio:{command:e=>{events.push(e);if(host)host(e);}}});p.tick(1000);return{p,clock,events};
}

test('AMCAF VM: explicit slots compile standalone; VBL ticks run independently while waiting without mutating MOD banks',()=>{
  const {p,clock,events}=start({speed:0});assert.strictEqual(p.state.waiting,'key');const instructions=p.state.ticks;
  clock.tick(119.9);assert.strictEqual(p.state.tracker.position.position.sequence.ticks,5);
  clock.tick(0.1);assert.strictEqual(p.state.tracker.position.position.sequence.ticks,6);
  assert.strictEqual(p.state.ticks,instructions);assert.strictEqual(p.state.tracker.engine,'amcaf');
  assert.deepStrictEqual(Buffer.from(p.banks.get(3).data.subarray(0,-32)),raw);
  const chunks=events.filter(e=>e.type==='pcm');assert.strictEqual(chunks.length,6);
  assert.deepStrictEqual(chunks.map(e=>[e.frame,e.channels[0].length]),[[0,960],[960,960],[1920,960],[2880,960],[3840,960],[4800,960]]);
  clock.tick(20);assert(events.at(-1).channels[0].some(v=>v!==0));
  p.sendKey('x');p.tick(100);assert(p.state.halted);assert.strictEqual(clock.pending(),0);assert.strictEqual(p.state.tracker.playing,false);
});

test('AMCAF VM: PAL/NTSC CIA reloads use fractional deadlines and cumulative PCM-frame rounding',()=>{
  for(const [standard,hz,constant,frequency]of [['PAL',50,1773447,709379],['NTSC',60,1789773,715909]]){
    const {p,clock,events}=start({standard,hz}),interval=(Math.floor(constant/125)+1)/frequency*1000;
    clock.tick(interval*6-0.001);assert.strictEqual(p.state.tracker.position.position.sequence.ticks,5);
    clock.tick(0.002);assert.strictEqual(p.state.tracker.position.position.sequence.ticks,6);
    const chunks=events.filter(e=>e.type==='pcm');
    assert.strictEqual(chunks.reduce((sum,e)=>sum+e.channels[0].length,0),Math.floor(interval*6*48+1e-7));
    for(let i=1;i<chunks.length;i++)assert.strictEqual(chunks[i].frame,chunks[i-1].frame+chunks[i-1].channels[0].length);
    p.stop();
  }
});

test('AMCAF VM: host Stop/Resume freezes phase and counters and reopens one owned timeline',()=>{
  const {p,clock,events}=start();clock.tick(200);p.stop();const frozen=JSON.stringify(p.state.tracker.position.position);
  assert.strictEqual(clock.pending(),0);clock.tick(1234);assert.strictEqual(JSON.stringify(p.state.tracker.position.position),frozen);
  p.resume();clock.tick(21);const last=events.filter(e=>e.type==='pcm').at(-1);
  assert.strictEqual(last.stream,2);assert.strictEqual(last.frame,0);assert.strictEqual(p.state.tracker.paused,false);p.stop();
});

test('AMCAF VM: volume and clock mode commands preserve latch rules, replacement retires banks and active writes reject',()=>{
  const {p,clock}=start();p.extensionPtVolume(16);assert.strictEqual(p.state.tracker.playing,true);
  p.extensionPtCiaSpeed(0);clock.tick(140);assert.strictEqual(p.state.tracker.position.position.sequence.master,16);
  assert.strictEqual(p.state.tracker.position.cia,false);
  const at=p.bankStart(3);assert.throws(()=>p.poke(at,0),/active Tracker.*Pt Stop/);
  p.extensionPtStop();p.poke(at,0);assert.strictEqual(clock.pending(),0);
  const fresh=start();fresh.p.eraseBank(3);assert.strictEqual(fresh.p.state.tracker.playing,false);assert.strictEqual(fresh.clock.pending(),0);
});

test('AMCAF VM: source-located host failures and invalid tempo halt with no live wakes',()=>{
  const {p,clock}=start({host:e=>{if(e.type==='pcm')throw Error('PCM sink failed');}});
  assert.throws(()=>clock.tick(30),/PCM sink failed.*line 2/);assert(p.state.halted);assert.strictEqual(clock.pending(),0);
  assert.throws(()=>start({lines:[[extension(0x10f2),n(1)]]}),/Pt Cia Speed requires.*line 3/);
});

test('AMCAF VM: synchronous host Stop during a PCM callback pauses without reentering the renderer',()=>{
  let current;const {p,clock}=start({host:e=>{if(e.type==='pcm')current.stop();}});current=p;
  clock.tick(30);assert(p.state.stopped);assert(!p.state.halted);assert.strictEqual(clock.pending(),0);
  assert.strictEqual(p.state.tracker.position.position.paused,true);
  assert.strictEqual(p.state.tracker.position.position.sequence.ticks,0);
  assert.strictEqual(p.state.tracker.position.frames,p.state.tracker.position.position.frame);
  p.extensionPtStop();
});

test('AMCAF VM: compiled Pt Sam Stop uses low mask bits without stopping music or retiring its bank',()=>{
  const {p,clock,events}=start({speed:0,lines:[[t('Wait Key')],[extension(0x1400),n(17)]]});
  clock.tick(140);const ticks=p.state.tracker.position.position.sequence.ticks;
  p.sendKey('x');p.tick(100);assert.strictEqual(p.state.waiting,'key');
  assert.strictEqual(events.at(-1).type,'stop');assert.strictEqual(events.at(-1).mask,1);
  assert.strictEqual(p.state.tracker.playing,true);assert.strictEqual(clock.pending(),1);
  assert.strictEqual(p.state.tracker.position.position.sequence.ticks,ticks);
  assert.throws(()=>p.poke(p.bankStart(3),0),/active Tracker/);
  clock.tick(20);const e=events.at(-1);assert.strictEqual(e.type,'pcm');
  assert(e.channels[0].every(v=>v===0));assert(e.channels[1].some(v=>v!==0));
  p.stop();const frozen=JSON.stringify(p.state.tracker.position.position.sequence);
  p.extensionPtSamStop(-1);assert.strictEqual(events.at(-1).mask,15);
  assert.strictEqual(JSON.stringify(p.state.tracker.position.position.sequence),frozen);
  p.resume();clock.tick(20);assert(events.at(-1).channels.every(channel=>channel.every(v=>v===0)));
  p.extensionPtStop();assert.strictEqual(clock.pending(),0);
  p.extensionPtSamStop(0x10008);assert.strictEqual(events.at(-1).mask,8);
});
