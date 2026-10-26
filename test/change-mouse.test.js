/* jshint esversion: 6 */
'use strict';
const assert=require('assert');
const {binary,token:t,integer:n,word:w,dword,identifier:id,text,execute,compile}=require('./helpers/program');

test('Change Mouse: original token selects the built-in shape without drawing, changing visibility or moving input/cursors',()=>{
  const {program:p}=execute(binary([[w(0x1e02),n(2)],[t('Wait Key')]]));
  const d=p.display,s=d.screen(),pixels=s.pixels.slice(),snapshot=d.snapshotDisplay(),cursor=[s.x,s.y,s.gx,s.gy];p.setMouse(140,80,1);p.setKeyState(32,true);p.hide();p.hide();
  for(const shape of [1,2,3]){p.changeMouse(shape);assert.strictEqual(p.mouseShape(),shape);assert.strictEqual(p.mouseVisible(),false);assert.deepStrictEqual(s.pixels,pixels);assert.deepStrictEqual([s.x,s.y,s.gx,s.gy],cursor);assert.strictEqual(p.inputValue('Mouse Key'),1);assert.strictEqual(p.keyState(32),-1);assert.deepStrictEqual({...d.snapshotDisplay().frame,revision:snapshot.frame.revision},{...snapshot.frame});}
  p.show();assert.strictEqual(p.mouseVisible(),false);p.show();assert.strictEqual(p.mouseVisible(),true);assert.strictEqual(p.mouseShape(),3);assert.strictEqual(p.inputValue('Mouse Click'),1);p.stop();assert.strictEqual(p.mouseShape(),3);p.resume();assert.strictEqual(p.mouseShape(),3);p.stop();
});

test('Change Mouse: typed DATA/array/procedure and boxed Val arguments convert once, with source-context rejection of unsupported forms',()=>{
  const order=[],{program:p}=execute(binary([[t('Data'),w(0),n(2)],[t('Read'),id('shape')],[t('Dim'),id('a'),t('('),n(1),t(')')],
    [id('a'),t('('),n(1),t(')'),t('='),id('shape')],[t('Change Mouse'),id('a'),t('('),n(1),t(')')],
    [t('Procedure'),dword(0),w(0),0,0,id('shapeproc')],[t('End Proc'),t('['),t('Val'),t('('),text('3.9'),t(')'),t(']')],[id('shapeproc',0x12)],[t('Change Mouse'),t('Param#')],
    [t('Change Mouse'),t('Val'),t('('),t('Fsel$'),t('('),text('shape'),t(')'),t(')')],[t('Wait Key')]]),1000,{files:{select({path}){order.push(path);return'1.9';}}});
  assert.strictEqual(p.mouseShape(),1);assert.deepStrictEqual(order,['shape']);p.stop();
  assert.throws(()=>compile(binary([[t('Change Mouse'),text('2')]])),/numeric.*line 1/);
  for(const shape of [0,-1,4,65537])assert.throws(()=>execute(binary([[t('Change Mouse'),n(shape)]])),/Unsupported Change Mouse.*line 1, byte/);
  const q=execute(binary([[t('Wait Key')]])).program;assert.strictEqual(q.mouseShape(),null);q.changeMouse({value:2.9,numericType:'float'});assert.strictEqual(q.mouseShape(),2);const revision=q.display.version;
  for(const shape of [0,-1,4,65537,NaN,Infinity]){assert.throws(()=>q.changeMouse(shape),/Unsupported Change Mouse|Invalid floating/);assert.strictEqual(q.mouseShape(),2);assert.strictEqual(q.display.version,revision);}q.stop();
});

test('Change Mouse: shape state belongs to each factory, works without a selected screen and remains independent of Hide/Show On',()=>{
  const {create}=compile(binary([[t('Wait Key')]])),make=()=>{const c=require('./helpers/fakeTimers').createFakeTimers();return create({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout});},a=make(),b=make();a.tick(1000);b.tick(1000);a.changeMouse(2);assert.strictEqual(b.mouseShape(),null);
  a.display.close(0);a.hideOn();a.changeMouse(3);a.showOn();assert.strictEqual(a.mouseShape(),3);assert.strictEqual(a.mouseVisible(),true);a.hide();assert.strictEqual(b.mouseVisible(),true);a.stop();b.stop();
});

test('Roller2 Change Mouse: seven unchanged editor pointer statements reach prepared gates with no pixel/bank/input mutations',()=>{
  const {program:p,timers:c}=execute(require('./helpers/roller2Pointer')()),pixels=p.display.screen().pixels.slice();
  for(const [index,shape]of [2,1,2,1,2,3,1].entries()){if(index){p.sendKey('next');c.tick(0);}assert.strictEqual(p.mouseShape(),shape);assert.strictEqual(p.mouseVisible(),true);assert.strictEqual(p.state.waiting,'key');assert.deepStrictEqual(p.display.screen().pixels,pixels);assert.strictEqual(p.banks.size,0);}
  p.stop();assert.strictEqual(c.pending(),0);
});
