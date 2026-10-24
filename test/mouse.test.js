/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const createDisplay=require('../lib/amos/display');
const {binary,token:t,word:w,dword,integer:n,identifier:id,text,compile,execute}=require('./helpers/program');
const {createFakeTimers}=require('./helpers/fakeTimers');
const hooks=c=>({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout});
const limits=(a,b,c,d)=>[w(0x1e6e),n(a),t(','),n(b),t('To'),n(c),t(','),n(d)];
const idle=()=>execute(binary([[t('Wait Key')]]));
const click=p=>p.inputValue('Mouse Click');

test('Mouse limits: original rectangle token applies inclusive bounds to subsequent injection without repositioning or drawing',()=>{
  const {program:p}=execute(binary([limits(128,48,448,220),[t('Wait Key')]]));
  assert.deepStrictEqual({...p.state.input.mouse},{x:0,y:0,buttons:0});assert.ok(Object.isFrozen(p.state.input.mouseLimits));
  const version=p.display.version,pixels=Buffer.from(p.display.screen().pixels);
  for(const [x,y,expected]of [[0,0,[128,48]],[999,999,[448,220]],[128,48,[128,48]],[448,220,[448,220]],[200,150,[200,150]]]){
    p.setMouse(x,y,7);assert.deepStrictEqual({...p.state.input.mouse},{x:expected[0],y:expected[1],buttons:7});
  }
  assert.strictEqual(p.display.version,version);assert.deepStrictEqual(Buffer.from(p.display.screen().pixels),pixels);
  p.stop();assert.deepStrictEqual({...p.state.input.mouseLimits},{x1:128,y1:48,x2:448,y2:220});
});

test('Mouse limits: unsigned words, signed lower bounds, upper caps and endpoint swaps follow source order',()=>{
  const {program:p}=idle();
  for(const [values,expected]of [
    [[-5,-6,999,999],[0,0,458,312]],[[400,200,100,50],[100,50,400,200]],[[900,900,999,999],[458,312,900,900]],
    [[65537,65538,65540,65541],[1,2,4,5]],[[7,8,7,8],[7,8,7,8]],[[32768,32768,-1,-1],[0,0,458,312]]]){
    p.limitMouse(...values);const [x1,y1,x2,y2]=expected;assert.deepStrictEqual({...p.state.input.mouseLimits},{x1,y1,x2,y2});
  }
  p.stop();
});

test('Mouse limits: current/numbered screen forms capture full bitmap extent and hires hardware width independently of source offsets',()=>{
  const {program:p}=execute(binary([[t('Screen Open'),n(0),t(','),n(640),t(','),n(200),t(','),n(16),t(','),t('Hires')],[w(0x1e54)],[t('Wait Key')]]));
  assert.deepStrictEqual({...p.state.input.mouseLimits},{x1:128,y1:50,x2:447,y2:249});
  p.display.open(1,320,200,16,0);p.display.screenDisplay(1,128,70,320,100);p.display.screenOffset(1,16,20);p.display.select(0);p.limitMouseScreen(1);
  assert.deepStrictEqual({...p.state.input.mouseLimits},{x1:128,y1:70,x2:447,y2:269});assert.strictEqual(p.display.current,0);
  p.display.close(1);assert.deepStrictEqual({...p.state.input.mouseLimits},{x1:128,y1:70,x2:447,y2:269});
  for(const id of [-1,8])assert.throws(()=>p.limitMouseScreen(id),/Unsupported mouse screen/);assert.throws(()=>p.limitMouseScreen(1),/not open/);p.stop();
  const numbered=execute(binary([[w(0x1e66),n(0)],[t('Wait Key')]]));assert.strictEqual(numbered.program.state.input.mouseLimits.x1,128);numbered.program.stop();
});

test('Mouse Click: reads compare current buttons against the previous query, preserving Mouse Key and missing unobserved releases',()=>{
  const {program:p}=idle();
  p.setMouse(12,34,3);assert.strictEqual(click(p),3);assert.strictEqual(click(p),0);assert.strictEqual(p.inputValue('Mouse Key'),3);
  p.setMouse(12,34,7);assert.strictEqual(click(p),4);p.setMouse(12,34,0);p.setMouse(12,34,7);assert.strictEqual(click(p),0);
  p.setMouse(12,34,0);assert.strictEqual(click(p),0);p.setMouse(12,34,2);assert.strictEqual(click(p),2);
  p.clearKeys();p.keySpeed(10,2);assert.strictEqual(click(p),0);assert.strictEqual(p.inputValue('Mouse Key'),2);
  p.clearMouseButtons();assert.strictEqual(click(p),0);p.setMouse(12,34,1);assert.strictEqual(click(p),1);p.stop();
  const first=idle().program;first.setMouse(0,0,1);first.setMouse(0,0,0);assert.strictEqual(click(first),0);first.stop();
});

test('Mouse: Stop, End, failure and independent factories clear held/read state without resetting bounds or coordinates',()=>{
  const c=createFakeTimers(),create=compile(binary([[t('Wait Key')],[t('End')]])).create,a=create(hooks(c)),b=create(hooks(c));a.tick(100);b.tick(100);
  a.limitMouse(128,48,448,220);a.setMouse(200,100,7);assert.strictEqual(click(a),7);assert.deepStrictEqual({...b.state.input.mouse},{x:0,y:0,buttons:0});assert.strictEqual(b.state.input.mouseLimits,null);
  a.stop();assert.deepStrictEqual({...a.state.input.mouse},{x:200,y:100,buttons:0});assert.strictEqual(click(a),0);a.resume();a.sendKey('end');c.tick(0);assert.strictEqual(a.state.halted,true);assert.strictEqual(a.state.input.mouseClick,0);b.stop();
  const failed=execute(binary([[t('Wait Key')],[t('Return')]]));failed.program.setMouse(1,2,3);failed.program.sendKey('fail');assert.throws(()=>failed.timers.tick(0),/Return without Gosub/);assert.strictEqual(failed.program.state.input.mouse.buttons,0);assert.strictEqual(failed.program.state.input.mouseClick,0);
});

test('Hardware mouse bridge: committed raster geometry survives selection, scrolling, mixed resolutions and Auto View staging',()=>{
  const d=createDisplay();assert.deepStrictEqual(d.pointerPosition(10,20,320,200),[10,20]);assert.deepStrictEqual(d.pointerHardwarePosition(10,20,320,200),[138,70]);
  d.autoViewOff();d.screenDisplay(0,128,60,320,128);assert.deepStrictEqual(d.pointerHardwarePosition(10,20,320,200),[138,70]);d.view();assert.deepStrictEqual(d.pointerHardwarePosition(10,20,320,128),[138,80]);
  d.open(1,640,256,16,0x8000);d.screenDisplay(1,128,194,320,32);d.select(1);d.view();
  assert.deepStrictEqual(d.pointerHardwarePosition(20,300,640,332),[138,210]);d.screenOffset(1,32,12);assert.deepStrictEqual(d.pointerHardwarePosition(20,300,640,332),[138,210]);
  d.select(0);assert.deepStrictEqual(d.pointerHardwarePosition(20,300,640,332),[138,210]);d.autoViewOn();d.close(1);d.close(0);assert.throws(()=>d.pointerHardwarePosition(0,0,1,1),/No physical display/);
});

test('Mouse arguments: DATA/scalars/arrays/procedure results and Val use numeric conversion with explicit source failures',()=>{
  const result=execute(binary([[t('Data'),w(0),n(128),t(','),n(48)],[t('Read'),id('x'),t(','),id('y')],
    [t('Dim'),id('a'),t('('),n(0),t(')')],[id('a'),t('('),n(0),t(')'),t('='),id('x')],
    [t('Procedure'),dword(0),w(0),0,0,id('p'),t('['),id('v'),t(']')],[t('End Proc'),t('['),id('v'),t(']')],
    [id('p',0x12),t('['),id('a'),t('('),n(0),t(')'),t(']')],
    [t('Limit Mouse Rectangle'),t('Param'),t(','),id('y'),t('To'),t('Val'),t('('),text('448.9'),t(')'),t(','),n(220)],
    [t('Wait Key')]]));assert.strictEqual(result.program.state.input.mouseLimits.x2,448);result.program.stop();
  assert.throws(()=>compile(binary([[t('Limit Mouse Rectangle'),text('0'),t(','),n(0),t('To'),n(1),t(','),n(1)]])),/numeric/i);
  const {program:p}=idle();p.display.close(0);assert.throws(()=>p.limitMouse(0,0,1,1),/not open/);p.stop();
  assert.throws(()=>execute(binary([[t('Limit Mouse Screen'),n(8)]])),/Unsupported mouse screen.*line 1, byte 22/);
});

test('Mouse: unchanged original Wonderland limit/click/zone statements select editor actions without executing them',()=>{
  const {program:p,timers:c}=execute(require('./helpers/wonderlandMouse')(),1000,{files:{read:name=>fs.readFileSync(path.join(__dirname,'../examples/Wonderland',name.split('/').pop())).toString('latin1')}});
  c.tick(20);assert.deepStrictEqual({...p.state.input.mouseLimits},{x1:128,y1:48,x2:448,y2:220});
  const probe=(x,y,buttons)=>{p.setMouse(x,y,buttons);p.sendKey('probe');c.tick(0);return [p.state.variables.int_mc,p.state.variables.int_z,p.state.variables.string_i,p.state.variables.int_scod];};
  for(const [x,zone,key,scan]of [[136,1,'l',0],[208,2,'s',0],[272,3,'c',0],[336,4,'',69],[384,5,'',0]]){
    probe(x,202,0);assert.deepStrictEqual(probe(x,202,1),[1,zone,key,scan]);assert.deepStrictEqual(probe(x,202,1),[0,zone,'',0]);
  }
  assert.deepStrictEqual(probe(-100,999,0),[0,0,'',0]);assert.deepStrictEqual({...p.state.input.mouse},{x:128,y:220,buttons:0});assert.strictEqual(c.pending(),0);p.stop();
});
