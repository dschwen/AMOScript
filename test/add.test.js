/* jshint esversion: 6 */
'use strict';
const assert=require('assert');
const {binary,token:t,word:w,integer:n,identifier:id,text,execute,compile}=require('./helpers/program');
const select=name=>[t('Val'),t('('),t('Fsel$'),t('('),text(name),t(')'),t(')')];

test('Add: literal opcodes wrap signed longs then snap overshoots to the opposite inclusive endpoint',()=>{
  for(const [start,delta,low,high,result]of [[0,1,0,3,1],[3,1,0,3,0],[0,-1,0,3,3],[1,100,0,3,0],[1,-100,0,3,3],[2147483647,1,-5,5,5],[-2147483648,-1,-5,5,-5],[0,0,5,-5,-5]]){
    const {logs}=execute(binary([[id('v'),t('='),n(start)],[w(0x462),id('v'),t(','),n(delta),t(','),n(low),t('To'),n(high)],[t('Print'),id('v')]]));assert.deepStrictEqual(logs,[[result]]);
  }
  assert.deepStrictEqual(execute(binary([[id('v'),t('='),n(2147483647)],[w(0x458),id('v'),t(','),n(1)],[t('Print'),id('v')]])).logs,[[-2147483648]]);
  assert.deepStrictEqual(execute(binary([[id('v'),t('='),n(3)],[w(0x458),id('v'),t(','),n(1),t(','),n(0),t('To'),n(3)],[t('Print'),id('v')]])).logs,[[0]]);
});

test('Add: typed DATA, arrays, procedure locals and numeric Val arguments share integer storage semantics',()=>{
  const {logs}=execute(binary([[t('Data'),w(0),n(3)],[t('Read'),id('v')],[t('Dim'),id('a'),t('('),n(0),t(')')],
    [id('a'),t('('),n(0),t(')'),t('='),id('v')],[t('Add'),id('a'),t('('),n(0),t(')'),t(','),t('Val'),t('('),text('1.9'),t(')'),t(','),n(0),t('To'),n(3)],
    [t('Procedure'),[0,0,0,0],w(0),0,0,id('p')],[id('v'),t('='),n(5)],[t('Add'),id('v'),t(','),n(2)],[t('End Proc'),t('['),id('v'),t(']')],[id('p',0x12)],
    [t('Print'),id('v'),t(','),id('a'),t('('),n(0),t(')'),t(','),t('Param')]]));assert.deepStrictEqual(logs,[[3,0,7]]);
});

test('Add: capture and validate the array target before evaluating operands once, then read its latest value',()=>{
  const source=binary([[t('Dim'),id('a'),t('('),n(0),t(')')],[t('Add'),id('a'),t('('),select('index'),t(')'),t(','),select('delta'),t(','),select('low'),t('To'),select('high')],[t('Wait Key')]]);
  const clock=require('./helpers/fakeTimers').createFakeTimers(),calls=[];let p;
  p=compile(source).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files:{select({path}){calls.push(path);if(path==='delta')p.state.variables.array_int_a.values.set(0,2);if(path==='high')p.state.variables.array_int_a.values.set(0,1);return{index:'0',delta:'1',low:'0',high:'3'}[path];}}});
  p.tick(100);assert.deepStrictEqual(calls,['index','delta','low','high']);assert.strictEqual(p.arrayGet(p.state.variables.array_int_a,[0]),2);p.stop();
  let invoked=0;assert.throws(()=>execute(binary([[t('Dim'),id('a'),t('('),n(0),t(')')],[t('Add'),id('a'),t('('),n(1),t(')'),t(','),select('delta')]]),100,{files:{select(){invoked++;return'1';}}}),/Array index out of bounds.*line 2/);assert.strictEqual(invoked,0);
});

test('Add: unsupported target types and incomplete bounds reject, and operand failure leaves the target unchanged',()=>{
  for(const flags of [1,2])assert.throws(()=>compile(binary([[t('Add'),id('v',6,flags),t(','),n(1)]])),/Add requires an integer/);
  assert.throws(()=>compile(binary([[w(0x462),id('v'),t(','),n(1)]])),/requires lower and upper/);
  assert.throws(()=>compile(binary([[t('Add'),id('v'),t(','),n(1),t(','),n(0)]])),/Expected To/);
  const clock=require('./helpers/fakeTimers').createFakeTimers(),p=compile(binary([[id('v'),t('='),n(7)],[t('Add'),id('v'),t(','),select('fail')]])).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files:{select(){throw Error('selector failed');}}});
  assert.throws(()=>p.tick(100),/selector failed.*line 2/);assert.strictEqual(p.state.variables.int_v,7);assert.strictEqual(p.state.halted,true);assert.strictEqual(clock.pending(),0);
});
