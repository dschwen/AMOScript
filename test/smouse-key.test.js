'use strict';
const assert=require('assert'),vm=require('vm'),Transpiler=require('../lib/Transpiler');
const{binary,token:t,word:w,integer:n}=require('./helpers/tokens');
const{createFakeTimers}=require('./helpers/fakeTimers');
const{createJoystickInput}=require('../lib/amos/browser');
const ext=slot=>[w(0x4e),[slot,0],w(0x158c)];
function make(lines=[[t('Wait Key')]],slot=8){const sandbox={module:{exports:{}}};vm.runInNewContext(new Transpiler(binary(lines),{extensions:{[slot]:'amcaf-1.50beta4'}}).toModule(),sandbox);const clock=createFakeTimers(),logs=[];const p=sandbox.module.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print:x=>logs.push(x)});return{p,clock,logs};}

test('Smouse Key: exact second-port button mask, shared joystick fire and nondestructive mouse/key queries',()=>{
  const {p,logs}=make([[t('Print'),ext(8)],[t('Print'),ext(8)],[t('Print'),t('Mouse Click')],[t('Print'),t('Inkey$')],[t('Wait Key')]]);
  p.setMouse(0,0,7);p.setJoystick(1,16);p.setPortButtons(1,6);p.sendKey('Q');p.tick(100);
  assert.deepStrictEqual(logs,[7,7,7,'Q']);
  p.setPortButtons(0,7);p.setPortButtons(1,0);p.setJoystick(1,0);
  assert.strictEqual(p.extensionSmouseKey(),0);assert.strictEqual(p.inputValue('Mouse Key'),7);
  p.setPortButtons(1,1);assert.strictEqual(p.joystickInfo('Fire',1),-1);assert.strictEqual(p.joystickInfo('Joy',1),16);
  p.setPortButtons(1,6);p.setJoystick(1,0);assert.strictEqual(p.extensionSmouseKey(),6);assert.strictEqual(p.joystickInfo('Joy',1),0);
});

test('Smouse Key: reader polling, relocation, lifecycle and per-program holds remain independent',()=>{
  const {p}=make(),q=make([[t('Print'),ext(19)],[t('Wait Key')]],19);
  p.tick(100);p.setJoystickReader(port=>{p.setPortButtons(port,2);return 16;});assert.strictEqual(p.extensionSmouseKey(),3);
  q.p.setPortButtons(1,4);q.p.tick(100);assert.deepStrictEqual(q.logs,[4]);
  q.p.keySpeed(10,2);assert.strictEqual(q.p.extensionSmouseKey(),4);q.p.stop();assert.strictEqual(q.p.extensionSmouseKey(),0);
  assert.strictEqual(p.extensionSmouseKey(),3);
  for(const [port,mask]of [[-1,0],[2,0],[1,128],[1,-1],[1,1.5]])assert.throws(()=>q.p.setPortButtons(port,mask),/port|button/);
});

test('Joystick extra buttons: opt-in key/gamepad mappings retain five-bit Joy masks and merge held sources',()=>{
  const input=createJoystickInput([{port:1,keyboard:{fire2:'ShiftLeft'},gamepad:{buttons:{fire2:1,fire3:2}}}]);
  const pad=pressed=>[{connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:16},(_,i)=>({pressed:pressed.includes(i)}))}];
  input.keydown('ShiftLeft');let r=input.read(pad([0,2]))[0];assert.strictEqual(r.mask,16);assert.strictEqual(r.buttons,7);
  input.keyup('ShiftLeft');r=input.read(pad([1,2]))[0];assert.strictEqual(r.mask,0);assert.strictEqual(r.buttons,6);
  input.keydown('ArrowUp');input.keydown('ArrowDown');r=input.read(pad([1]))[0];assert.strictEqual(r.mask,0);assert.strictEqual(r.buttons,2);
  assert.strictEqual(input.read([], 'inactive',false)[0].buttons,0);
  assert.strictEqual(Object.hasOwn(createJoystickInput([{port:1,keyboard:true,gamepad:true}]).read(pad([1]))[0],'buttons'),false);
  assert.throws(()=>createJoystickInput([{port:1,keyboard:{fire2:[1]}}]),/binding/);
  assert.throws(()=>createJoystickInput([{port:1,gamepad:{buttons:{fire2:-1}}}]),/binding/);
});
