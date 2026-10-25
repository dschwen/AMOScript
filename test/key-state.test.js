/* jshint esversion: 6 */
'use strict';
const assert=require('assert');
const {compile,binary,token:t,word:w,integer:n,identifier:id,text}=require('./helpers/program');
const {createFakeTimers}=require('./helpers/fakeTimers');
const query=value=>[w(0x11d8),t('('),...value,t(')')];
function make(lines){const clock=createFakeTimers(4),logs=[],p=compile(binary(lines)).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print:(...args)=>logs.push(args)});return{p,clock,logs};}

test('Key State: literal native token returns nondestructive AMOS booleans for all 128 codes',()=>{
  const {p,clock,logs}=make([[t('Print'),query([n(95)])],[t('Wait Key')]]);
  for(let code=0;code<128;code++){p.setKeyState(code,true);assert.strictEqual(p.keyState(code),-1);assert.strictEqual(p.keyState(code),-1);p.setKeyState(code,false);assert.strictEqual(p.keyState(code),0);}
  p.setKeyState(95,true);p.tick(100);assert.deepStrictEqual(logs,[[-1]]);assert.strictEqual(p.keyState(95),-1);
  p.sendKey('a',32);assert.strictEqual(p.keyState(32),0);assert.strictEqual(p.keyState(95),-1);p.stop();assert.strictEqual(clock.pending(),0);
});

test('Key State: numeric DATA, arrays, typed scalars and procedure results retain integer values',()=>{
  const {p,logs}=make([[t('Data'),w(0),n(95)],[t('Read'),id('code')],[t('Dim'),id('a'),t('('),n(1),t(')')],
    [id('a'),t('('),n(1),t(')'),t('='),query([id('code')])],[id('f',6,1),t('='),query([n(95)])],
    [t('Procedure'),[0,0,0,0],w(0),0,0,id('held')],[t('End Proc'),t('['),query([n(95)]),t(']')],[id('held',0x12)],
    [t('Print'),id('a'),t('('),n(1),t(')'),t(','),id('f',6,1),t(','),t('Param')],[t('Wait Key')]]);
  p.setKeyState(95,true);p.tick(100);assert.deepStrictEqual(logs,[[-1,-1,-1]]);p.stop();
});

test('Key State: queue, destructive Scancode, Clear Key and Key Speed stay independent of physical state',()=>{
  const a=make([[t('Wait Key')]]),b=make([[t('Wait Key')]]);a.p.tick(10);b.p.tick(10);
  a.p.setKeyState(95,true);assert.strictEqual(a.p.state.waiting,'key');assert.strictEqual(b.p.keyState(95),0);
  a.p.sendKey('wake');a.clock.tick(4); // Program completion clears host input.
  const run=make([[t('Wait Key')],[t('Wait Key')]]);run.p.tick(10);run.p.sendKey('wake');run.clock.tick(4);
  run.p.setKeyState(95,true);run.p.state.input.keys.push({key:'a',scanCode:32});assert.strictEqual(run.p.inputValue('Inkey$'),'a');
  run.p.clearKeys();run.p.clearScanCodes();assert.strictEqual(run.p.keyState(95),-1);run.p.keySpeed(1,2);assert.strictEqual(run.p.keyState(95),-1);
  assert.strictEqual(run.p.inputValue('Scancode'),0);run.p.stop();assert.strictEqual(run.p.keyState(95),0);run.p.resume();assert.strictEqual(run.p.keyState(95),0);
  b.p.stop();run.p.stop();assert.strictEqual(run.clock.pending(),0);
});

test('Key State: native range/type errors halt with source context, while malformed host injections reject',()=>{
  for(const value of [-1,128,2147483647]){const {p}=make([[t('Print'),query([n(value)])]]);assert.throws(()=>p.tick(10),/Key State.*0\.\.127.*line 1/);assert.strictEqual(p.state.halted,true);}
  assert.throws(()=>compile(binary([[t('Print'),query([text('95')])]])),/Wrong argument type/);
  const {p}=make([[t('Wait Key')]]);for(const [code,down]of [[128,true],[-1,true],[1.5,true],[1,1]])assert.throws(()=>p.setKeyState(code,down),/Invalid raw key state/);
  p.setKeyState(95,true);p.clearKeyStates();assert.strictEqual(p.keyState(95),0);p.stop();
});
