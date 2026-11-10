'use strict';
const assert=require('assert');
const {binary,token:t,integer:n,identifier:id,text,execute,compile}=require('./helpers/program');
const array=(name,index)=>[id(name),t('('),n(index),t(')')];
test('Bchg: emitted scalar and array longs toggle modulo 32, including the sign bit, without changing Bset/Bclr',()=>{
 const {program:p,logs}=execute(binary([[t('Dim'),array('a',1)],
  [t('Bchg'),n(31),t(','),id('x')],[t('Bchg'),n(33),t(','),array('a',1)],
  [t('Print'),id('x'),t(','),array('a',1)],
  [t('Bchg'),n(63),t(','),id('x')],[t('Bchg'),n(1),t(','),array('a',1)],
  [t('Bset'),n(2),t(','),id('x')],[t('Bclr'),n(2),t(','),id('x')],
  [t('Print'),id('x'),t(','),array('a',1)],[t('Wait Key')]]));
 assert.deepStrictEqual(logs,[[-2147483648,2],[0,0]]);p.stop();
 assert.throws(()=>compile(binary([[t('Bchg'),n(0),t(','),id('f',6,1)]])),/integer variable/);
});
test('Bchg: parenthesized operands toggle checked address bytes modulo 8 and reject before partial writes or later callbacks',()=>{
 const address=[t('('),id('addr'),t(')')];
 const {program:p,logs}=execute(binary([[t('Reserve As Work'),n(5),t(','),n(2)],
  [id('addr'),t('='),t('Start'),t('('),n(5),t(')')],
  [t('Poke'),id('addr'),t(','),n(0x12)],[t('Bchg'),n(9),t(','),address],
  [t('Print'),t('Peek'),t('('),id('addr'),t(')')],
  [t('Bchg'),n(1),t(','),address],[t('Print'),t('Peek'),t('('),id('addr'),t(')')],[t('Wait Key')]]));
 assert.deepStrictEqual(logs,[[0x10],[0x12]]);const start=p.bankStart(5);assert.throws(()=>p.modifyMemoryBit('Bchg',1,start+2),/bounds/);assert.strictEqual(p.peek(start),0x12);p.stop();
 let calls=0;const exists=[t('Exist'),t('('),text('side'),t(')')],options={files:{exists(){calls++;return false;}}};
 assert.throws(()=>execute(binary([[t('Bchg'),n(-1),t(','),exists]]),100,options),/nonnegative/);assert.strictEqual(calls,0);
 assert.throws(()=>execute(binary([[t('Bchg'),n(0),t(','),id('missing'),t('('),exists,t(')')]]),100,options),/not dimensioned/);assert.strictEqual(calls,0);
});
test('Cursor strings: native single-byte values compare with Inkey without consuming input or accepting arguments',()=>{
 for(const [name,code] of [['Cup$',30],['Cdown$',31],['Cleft$',29],['Cright$',28]]){
  const {program:p,logs}=execute(binary([[t('Print'),t(name),t(','),t('Asc'),t('('),t(name),t(')')],[t('Wait Key')]]));
  assert.deepStrictEqual(logs,[[String.fromCharCode(code),code]]);p.stop();
  assert.throws(()=>compile(binary([[t('Print'),t(name),t('('),n(1),t(')')]])));
 }
});
