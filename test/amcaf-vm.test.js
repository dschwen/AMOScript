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

test('AMCAF VM: raw sound effects preflight checked memory, retain owned bytes and use native period/word/countdown arithmetic',()=>{
  const {p,clock,events}=start({speed:0});
  p.reserveChipWork(5,8);
  const at=p.bankStart(5);for(let i=0;i<8;i++)p.poke(at+i,i*30);
  p.extensionPtSamBank(5);assert.strictEqual(p.state.audio.ptSampleBank,at);
  p.extensionPtSamBank(at+2);assert.strictEqual(p.state.audio.ptSampleBank,at+2);
  const before=JSON.stringify(p.state.tracker.position);
  assert.throws(()=>p.extensionPtRawPlay(8,at+6,4,8000),/out of bounds/);
  assert.strictEqual(JSON.stringify(p.state.tracker.position),before);
  p.extensionPtRawPlay(8,at,7,8000);p.poke(at,255);
  const raw=p.state.tracker.position.position;
  assert.strictEqual(raw.sampler.voices[3].length,6);assert.strictEqual(raw.sampler.voices[3].period,447);
  assert.deepStrictEqual(Array.from(raw.leases),[0,0,0,1]);clock.tick(20);
  const chunks=events.filter(e=>e.type==='pcm');assert.strictEqual(chunks[0].channels[3][0],0);
  assert.strictEqual(p.state.tracker.position.position.sampler.rawMask,0);assert.strictEqual(p.state.tracker.playing,true);
  assert.throws(()=>p.extensionPtRawPlay(8,at+1,4,8000),/even chip/);
  p.reserveWork(6,8);assert.throws(()=>p.extensionPtRawPlay(8,p.bankStart(6),4,8000),/generic chip/);
  assert.throws(()=>p.extensionPtSamBank(99),/not reserved/);assert.strictEqual(p.state.audio.ptSampleBank,at+2);
  assert.throws(()=>p.extensionPtRawPlay(-1,at,4,8000),/negative voice/);
  p.extensionPtRawPlay(8,at,-4,8000);assert.strictEqual(p.state.tracker.position.position.leases[3],-2);clock.tick(100);assert.strictEqual(p.state.tracker.position.position.leases[3],-2);p.extensionPtSamStop(8);
  assert.throws(()=>p.extensionPtRawPlay(8,at,1,8000),/word-rounded/);
  p.extensionPtRawPlay(8,at,2,0xffff);assert.strictEqual(p.state.tracker.position.position.sampler.voices[3].period,8948);
  p.extensionPtSamStop(8);p.stop();
});

test('AMCAF VM: compiled raw-only playback needs no MOD, releases its own wake and claims only selected channels',()=>{
  const lines=[[t('Reserve As Chip Work'),n(5),t(','),n(4)],
    [[w(0x21ca)],t('Start'),t('('),n(5),t(')'),t(','),n(128)],
    [extension(0x142a),n(5)],
    [extension(0x1412),n(8),t(','),t('Start'),t('('),n(5),t(')'),t(','),n(4),t(','),n(8000)],
    [t('Wait Key')]];
  const clock=createFakeTimers(),events=[],p=compile(lines)({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,audio:{command:e=>events.push(e)}});
  p.tick(100);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.state.tracker.position.position.sequence,null);
  assert.strictEqual(p.state.audio.ptSampleBank,p.bankStart(5));clock.tick(20);
  const chunk=events.find(e=>e.type==='pcm');assert.strictEqual(chunk.mask,8);assert.strictEqual(chunk.channels[3][0],-0.5);
  assert.strictEqual(clock.pending(),0);assert.strictEqual(p.state.tracker.position.position.sampler.rawMask,0);
  clock.tick(10000);p.extensionPtRawPlay(8,p.bankStart(5),4,8000);assert.strictEqual(clock.pending(),1);
  p.stop();clock.tick(200);p.resume();clock.tick(20);assert.strictEqual(clock.pending(),0);p.extensionPtStop();
});

test('AMCAF VM: raw chip Work MODs play without Tracker workspace; user masks persist across songs and retain bank protection',()=>{
 const clock=createFakeTimers(),events=[],create=compile([[extension(0x0456),text('music'),t(','),n(-7)],[extension(0x10d6),n(0x1000e)],[extension(0x108e),n(7)],[t('Wait Key')]]);
 const p=create({...clock,files:createFiles({music:raw.toString('latin1')}),audio:{command:e=>events.push(e)}});
 try{p.tick(1000);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.banks.get(7).name,'Work    ');assert.deepStrictEqual(Buffer.from(p.banks.get(7).data),raw);clock.tick(160);
  assert.strictEqual(p.state.tracker.position.position.mask,14);assert(events.filter(e=>e.type==='pcm').every(e=>e.mask===14&&e.channels[0].every(v=>v===0)));
  assert.throws(()=>p.poke(p.bankStart(7),0),/active Tracker/);p.extensionPtStop();p.extensionPtPlay(7);clock.tick(160);assert.strictEqual(p.state.tracker.position.position.mask,14);
  const old=p.state.tracker.position;p.reserveWork(9,4);assert.throws(()=>p.extensionPtPlay(9),/chip bank/);assert.strictEqual(p.state.tracker.position,old);
  p.extensionWload('music',-7);assert.strictEqual(p.state.tracker.playing,false);assert.strictEqual(clock.pending(),0);
 }finally{p.stop();}
});

test('AMCAF VM: malformed Work module preflight preserves current playback and host callback Stop during mask flush cannot restart ticks',()=>{
 let current,armed=false;const {p,clock}=start({speed:0,host:e=>{if(armed&&e.type==='pcm'){armed=false;current.stop();}}});current=p;
 try{p.reserveChipWork(9,1084);const prior=p.state.tracker.position;assert.throws(()=>p.extensionPtPlay(9),/MOD/);assert.strictEqual(p.state.tracker.position,prior);
  clock.tick(145);armed=true;p.extensionPtVoice(0);assert(p.state.stopped);assert.strictEqual(clock.pending(),0);const ticks=p.state.tracker.position.position.sequence.ticks;
  clock.tick(100);assert.strictEqual(p.state.tracker.position.position.sequence.ticks,ticks);p.resume();clock.tick(20);assert.strictEqual(p.state.tracker.position.position.mask,0);
 }finally{p.stop();}
});

test('AMCAF VM: E0 filter notification updates shared intent and synchronous host Stop defers tick cleanup safely',()=>{
 const bytes=Buffer.from(raw);bytes[1086]=0x1e;bytes[1087]=0;
 const clock=createFakeTimers();let p,armed=true;
 const make=compile([[[w(0x4e),[1,0],w(0x2ba)],text('music'),t(','),n(3)],[extension(0x10f2),n(0)],[extension(0x108e),n(3)],[t('Wait Key')]]);
 p=make({...clock,files:createFiles({music:bytes.toString('latin1')}),audio:{command:e=>{if(armed&&e.type==='filter'&&e.enabled){armed=false;p.stop();}}}});
 try{p.tick(1000);clock.tick(140);assert(p.state.stopped);assert.strictEqual(p.state.audio.filterEnabled,true);assert.strictEqual(clock.pending(),0);assert.strictEqual(p.state.tracker.position.position.sequence.ticks,6);p.resume();clock.tick(20);assert.strictEqual(p.state.tracker.position.position.sequence.ticks,7);}finally{p.stop();}
});
