/* jshint esversion: 6 */
'use strict';
const assert=require('assert');
const {binary,token:t,integer:n,word:w,identifier:id,text,execute,compile}=require('./helpers/program');

test('string branches: DATA/arrays and procedure string results select main labels case-insensitively with ordinary Gosub return',()=>{
  const {logs}=execute(binary([[t('Data'),w(0),text('WORK')],[t('Read'),id('name',6,2)],[t('Dim'),id('a',6,2),t('('),n(0),t(')')],
    [id('a',6,2),t('('),n(0),t(')'),t('='),id('name',6,2)],[t('Gosub'),id('a',6,2),t('('),n(0),t(')')],
    [t('Procedure'),[0,0,0,0],w(0),0,0,id('getname')],[t('End Proc'),t('['),text('DONE'),t(']')],[id('getname',0x12)],[t('Goto'),t('Param$')],
    [id('work',0xc),t('Print'),text('work')],[t('Return')],[id('done',0xc),t('Print'),text('done')],[t('End')]]));assert.deepStrictEqual(logs,[['work'],['done']]);
});

test('string branches: target expressions evaluate once, instruction zero and prototype-like names are valid',()=>{
  let calls=0;const {logs}=execute(binary([[t('Goto'),t('Fsel$'),t('('),text('*'),t(')')],[t('End')],[id('__proto__',0xc),t('Print'),text('safe')]]),100,{files:{select(){calls++;return'__PROTO__';}}});assert.strictEqual(calls,1);assert.deepStrictEqual(logs,[['safe']]);
  const clock=require('./helpers/fakeTimers').createFakeTimers(),p=compile(binary([[id('entry',0xc),t('Goto'),text('ENTRY')]])).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});p.tick(7);assert.strictEqual(p.state.ip,0);assert.strictEqual(p.state.halted,false);p.stop();assert.strictEqual(clock.pending(),0);
});

test('string branches: unknown, blank, oversized, non-ASCII and whitespace names halt with source context',()=>{
  for(const name of ['missing','constructor','','x'.repeat(32),'\xc9',' target '])assert.throws(()=>execute(binary([[t('Goto'),text(name)],[id('target',0xc),t('End')]])),/(?:Undefined|Unsupported) string label.*line 1/);
  assert.throws(()=>compile(binary([[t('Goto'),n(1)]])),/numeric targets are not implemented/);
  assert.throws(()=>compile(binary([[t('Procedure'),[0,0,0,0],w(0),0,0,id('p')],[t('Goto'),text('local')],[id('local',0xc)],[t('End Proc')]])),/inside procedures are not implemented/);
});

test('string branches: main lookup excludes procedure labels and factory call stacks remain independent',()=>{
  assert.throws(()=>execute(binary([[t('Goto'),text('local')],[t('Procedure'),[0,0,0,0],w(0),0,0,id('p')],[id('local',0xc)],[t('End Proc')]])),/Undefined string label local/);
  const create=compile(binary([[t('Gosub'),text('SUB')],[t('End')],[id('sub',0xc)],[t('Wait Key')],[t('Return')]])).create,clock=require('./helpers/fakeTimers').createFakeTimers(4),options={now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout};
  const a=create(options),b=create(options);a.tick(100);b.tick(100);a.sendKey('go');clock.tick(4);assert.strictEqual(a.state.halted,true);assert.strictEqual(b.state.waiting,'key');assert.strictEqual(b.state.stack.length,1);b.stop();assert.strictEqual(clock.pending(),0);
});
