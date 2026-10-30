'use strict';
const assert=require('assert'),fs=require('fs');
const {binary,token:t,integer:n,execute,compile}=require('./helpers/program'),{createFakeTimers}=require('./helpers/fakeTimers');

test('mouse polling: stale coordinates reconcile against limits without motion, drawing or invented click edges',()=>{
  const {program:p}=execute(binary([[t('Wait Key')]]));p.setMouse(0,0,5);assert.strictEqual(p.inputValue('Mouse Click'),5);
  const before=Buffer.from(p.display.screen().pixels),version=p.display.version;
  p.limitMouse(1,2,160,150);assert.deepStrictEqual({...p.state.input.mouse},{x:0,y:0,buttons:5});
  assert.strictEqual(p.inputValue('X Mouse'),1);assert.strictEqual(p.inputValue('Y Mouse'),2);assert.strictEqual(p.inputValue('Mouse Click'),0);assert.strictEqual(p.inputValue('Mouse Key'),5);
  p.limitMouse(10,20,30,40);assert.strictEqual(p.inputValue('Mouse Zone'),0);assert.deepStrictEqual({...p.state.input.mouse},{x:10,y:20,buttons:5});
  assert.strictEqual(p.inputValue('Mouse Click'),0);assert.strictEqual(p.display.version,version);assert.deepStrictEqual(Buffer.from(p.display.screen().pixels),before);
  p.stop();assert.deepStrictEqual({...p.state.input.mouse},{x:10,y:20,buttons:0});
});

test('mouse polling: no-limit positions stay unrestricted, coordinate polls preserve held keys and failed Mouse Zone does not reconcile',()=>{
  const {program:p}=execute(binary([[t('Wait Key')]]));p.setMouse(-500,999,1);p.setKeyState(0x20,true);p.putKeys('a');
  assert.strictEqual(p.inputValue('X Mouse'),-500);assert.strictEqual(p.inputValue('Y Mouse'),999);
  p.limitMouse(1,1,160,160);p.display.close(0);assert.throws(()=>p.inputValue('Mouse Zone'),/not open/);assert.strictEqual(p.state.input.mouse.x,-500);
  assert.strictEqual(p.inputValue('X Mouse'),1);assert.strictEqual(p.inputValue('Y Mouse'),160);assert.strictEqual(p.inputValue('Inkey$'),'a');assert.strictEqual(p.state.input.rawKeys[0x20],1);p.stop();
});

test('Bump: original source starts with no pointer event, selects a radius, renders the full image and exits through real source prompts',()=>{
  const bytes=fs.readFileSync(`${__dirname}/../examples/CompilerExamples/Graphics/Demo_pic.iff`),decoded=require('./helpers/decodeSavedIff')(bytes);
  const clock=createFakeTimers(),p=compile(fs.readFileSync(`${__dirname}/../examples/CompilerExamples/Bump.AMOS`)).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){},files:{read:name=>{assert.strictEqual(name.toLowerCase(),'amospro_extras:compiler_examples/graphics/demo_pic.iff');return bytes.toString('latin1');}}});
  try {
    p.tick(1000);assert.strictEqual(p.state.location.line,53);assert.strictEqual(p.state.variables.int_r0,1);assert.deepStrictEqual({...p.state.input.mouse},{x:1,y:1,buttons:0});
    p.setMouse(80,80,0);clock.tick(20);assert.strictEqual(p.state.variables.int_r0,80);
    p.setMouse(80,80,1);clock.tick(20);assert.strictEqual(p.state.location.line,118);
    const compared=require('./helpers/bumpPixels')(p.display.screen(0).physicalPixels,decoded.pixels);assert(compared>60000);
    p.setMouse(80,80,0);clock.tick(20);assert.strictEqual(p.state.location.line,132);assert.strictEqual(p.state.variables.int_n,6);
    p.sendKey('a');clock.tick(20);assert.strictEqual(p.state.halted,true);assert.strictEqual(clock.pending(),0);
  }finally{p.stop();}
});
