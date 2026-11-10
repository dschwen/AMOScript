'use strict';
const assert=require('assert'),vm=require('vm'),Transpiler=require('../lib/Transpiler');
const{binary,token:t,word:w,integer:n,text}=require('./helpers/tokens');
const{createFakeTimers}=require('./helpers/fakeTimers');
const ext=(slot,offset)=>[w(0x4e),[slot,0],w(offset)];
function compile(lines,optimize=false){const sandbox={module:{exports:{}}};const c=new Transpiler(binary(lines),{extensions:{8:'amcaf-1.50beta4',12:'turbo-plus-2.15'}});vm.runInNewContext(c.toModule({optimize}),sandbox);return{create:sandbox.module.exports,ir:c._ops};}
function begin(lines,options={}){const clock=createFakeTimers(),logs=[];const p=compile(lines,!!options.optimize).create({...options,now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print:x=>logs.push(x)});p.tick(100);return{p,clock,logs};}
const pri=value=>[ext(12,0x928),n(value)],wait=value=>[ext(8,0x346),n(value)];

test('Turbo Amos Pri: signed-long native bounds ignore outliers and report immutable requests before committing',()=>{
  const calls=[],clock=createFakeTimers();const p=compile([pri(-129),pri(-128),pri(20),pri(21),pri(0),[t('Wait Key')]]).create({system:{command:(name,request)=>{assert(Object.isFrozen(request));calls.push([name,request.priority]);}},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
  p.tick(100);assert.deepStrictEqual(calls,[['Amos Pri',-128],['Amos Pri',20],['Amos Pri',0]]);assert.strictEqual(p.state.system.amosPriority,0);
  assert.strictEqual(begin([pri(10),[t('Wait Key')]]).p.state.system.amosPriority,10);
  assert.strictEqual(begin([pri(100),[t('Wait Key')]],{system:{}}).p.state.system.amosPriority,undefined);
});

test('Turbo Amos Pri: host errors preserve previous intent, reentry retains the latest request and factories isolate state',()=>{
  const {p}=begin([[t('Wait Key')]]);p.extensionAmosPriority(3);
  const clock=createFakeTimers();let q;
  q=compile([[t('Wait Key')]]).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,system:{command:(name,r)=>{
    if(r.priority===20)q.extensionAmosPriority(0);if(r.priority===5)throw Error('priority failure');if(r.priority===6)return Promise.resolve();
    if(r.priority===19)try{q.extensionAmosPriority(5);}catch(_){}
  }}});q.tick(100);q.extensionAmosPriority(20);assert.strictEqual(q.state.system.amosPriority,0);
  q.extensionAmosPriority(19);assert.strictEqual(q.state.system.amosPriority,19);q.extensionAmosPriority(20);
  assert.throws(()=>q.extensionAmosPriority(5),/priority failure/);assert.strictEqual(q.state.system.amosPriority,0);
  assert.throws(()=>q.extensionAmosPriority(6),/synchronously/);assert.strictEqual(q.state.system.amosPriority,0);
  assert.strictEqual(p.state.system.amosPriority,3);
  assert.throws(()=>begin([pri(1)],{system:{command:()=>{throw Error('hook failed');}}}),/hook failed.*line 1/);
});

test('Raster Wait: a control-flow barrier sleeps to PAL/NTSC lines independently of slowdown and consumes its argument once',()=>{
  for(const[standard,hz,line]of [['PAL',50,156],['NTSC',60,131]])for(const optimize of [false,true]){
    const {p,clock,logs}=begin([wait(line),[t('Print'),n(1)],[t('Wait Key')]],{displayOptions:{snapshotStandard:standard},vblHz:hz,sleepScale:5,optimize});
    assert.strictEqual(p.state.waiting,'sleep');clock.tick(500/hz-0.001);assert.deepStrictEqual(logs,[]);
    clock.tick(0.002);assert.deepStrictEqual(logs,[1]);assert.strictEqual(p.state.waiting,'key');p.stop();
  }
  const clock=createFakeTimers(),logs=[];const p=compile([[ext(8,0x346),t('Len'),t('('),t('Inkey$'),t(')')],[t('Print'),t('Inkey$')],[t('Wait Key')]]).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print:x=>logs.push(x)});
  p.sendKey('A');p.sendKey('B');p.tick(100);clock.tick(1);assert.deepStrictEqual(logs,['B']);
  assert.strictEqual(compile([wait(10)]).ir[0].kind,'extension_control');
});

test('Raster Wait: signed low-word targets, passed lines and vertical-zero behavior match the bounded native loop',()=>{
  const {p,clock}=begin([[t('Wait Key')]]);assert(p.extensionRasterWait(0).sleepVbl>0);
  clock.tick(1);assert.deepStrictEqual(Object.keys(p.extensionRasterWait(0)),[]);
  assert.deepStrictEqual(Object.keys(p.extensionRasterWait(65536)),[]);
  assert.deepStrictEqual(Object.keys(p.extensionRasterWait(65535)),[]);
  assert(p.extensionRasterWait(156).sleepVbl>0);clock.tick(11);
  assert.deepStrictEqual(Object.keys(p.extensionRasterWait(156)),[]);
  assert.throws(()=>p.extensionRasterWait(312),/exceeds the nonlaced field/);
  assert.throws(()=>begin([wait(312)]),/nonlaced field.*line 1/);
  assert.throws(()=>compile([[t('Trap'),ext(8,0x346),n(10)]]),/synchronous command/);
});

test('Raster Wait: Stop/Resume owns one retained wait and End leaves no timer behind',()=>{
  const {p,clock,logs}=begin([wait(156),[t('Print'),text('done')],[t('End')]]);
  clock.tick(4);p.stop();assert.strictEqual(clock.pending(),0);clock.tick(100);
  p.resume();clock.tick(5);assert.deepStrictEqual(logs,[]);clock.tick(1);assert.deepStrictEqual(logs,['done']);
  assert(p.state.halted);assert.strictEqual(clock.pending(),0);
});
