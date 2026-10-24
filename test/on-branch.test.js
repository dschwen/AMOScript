/* jshint esversion: 6 */
'use strict';
const assert = require('assert');
const {binary,token:t,integer:n,identifier:id,word:w,dword,text,execute,compile}=require('./helpers/program');
const on=(selector,branch='Gosub',labels=['one','two'])=>[w(0x316),w(0xabcd),w(0xfedc),selector,t(branch),labels.flatMap((name,i)=>[...(i?[t(',')]:[]),id(name,0x18)])];
const labelled=(name,...parts)=>[id(name,0xc),...parts];
const call=name=>[id(name,0x12)];
const subroutines=[labelled('one',t('Print'),n(1)),[t('Return')],labelled('two',t('Print'),n(2)),[t('Return')]];

test('On: raw metadata and one-based Gosub selectors preserve fallthrough and same-line continuation',()=>{
  for(const selector of [-2147483648,-1,0,1,2,3,2147483647]) {
    const data=binary([[on(n(selector)),t(':'),t('Print'),text('after')],[t('End')],...subroutines]);
    const {program,logs,timers}=execute(data);
    assert.deepStrictEqual(logs,[...(selector===1||selector===2?[[selector]]:[]),['after']]);
    assert.strictEqual(program.state.stack.length,0);assert.strictEqual(timers.pending(),0);
  }
});

test('On: Goto skips the continuation without pushing a return address, including target zero and backward loops',()=>{
  const data=binary([labelled('start',t('Inc'),id('a')),
    [on([id('a'),t('<'),n(3),t('And'),n(1)],'Goto',['start'])],[t('Print'),id('a')],[t('End')]]);
  // Comparison true is -1, masked to 1; target is instruction zero.
  const {program,logs}=execute(data);assert.deepStrictEqual(logs,[[3]]);assert.strictEqual(program.state.stack.length,0);
  const result=execute(binary([[on(n(2),'Goto')],[t('Print'),n(99)],[t('End')],
    labelled('one',t('Print'),n(1)),[t('End')],labelled('two',t('Print'),n(2)),[t('End')]]));
  assert.deepStrictEqual(result.logs,[[2]]);assert.strictEqual(result.program.state.stack.length,0);
});

test('On: arrays, DATA, floats, Val tags and procedure results use shared integer selector conversion',()=>{
  const val=value=>[t('Val'),t('('),text(value),t(')')];
  const sources=[n(2),[w(0x46),dword(0xa0000042)],val('2.9'),val('2'),[id('real',6,1)],
    [id('a'),t('('),n(0),t(')')],[t('Param')]];
  for(const selector of sources) {
    const result=execute(binary([[t('Dim'),id('a'),t('('),n(0),t(')')],
      [t('Data'),w(0),n(2)],[t('Read'),id('a'),t('('),n(0),t(')')],
      [id('real',6,1),t('='),val('2.9')],
      [t('Procedure'),dword(0),w(0),0,0,id('result')],[t('End Proc'),t('['),n(2),t(']')],call('result'),
      [on(selector)],[t('End')],...subroutines]));
    assert.deepStrictEqual(result.logs,[[2]]);
  }
});

test('On: selectors evaluate once and nested Gosubs retain waits and independent stacks',()=>{
  const data=binary([[on([t('Joy'),t('('),n(1),t(')')])],[t('Print'),text('end')],[t('End')],
    labelled('one',on(n(1),'Gosub',['inner'])),[t('Print'),text('outer')],[t('Return')],
    labelled('inner',t('Wait Vbl')),[t('Print'),text('inner')],[t('Return')],
    labelled('two',t('Print'),n(2)),[t('Return')]]);
  const {create}=compile(data),clock=require('./helpers/fakeTimers').createFakeTimers(),logs=[];
  const options={setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,now:clock.now,print:value=>logs.push(value)};
  const a=create(options),b=create(options);let calls=0;a.setJoystickReader(()=>{calls++;return 1;});
  a.tick(100);assert.strictEqual(calls,1);assert.strictEqual(a.state.stack.length,2);assert.strictEqual(b.state.stack.length,0);
  a.stop();clock.tick(40);assert.deepStrictEqual(logs,[]);a.resume();clock.tick(20);
  assert.deepStrictEqual(logs,['inner','outer','end']);assert.strictEqual(a.state.stack.length,0);assert.strictEqual(calls,1);
  b.tick(100);assert.deepStrictEqual(logs,['inner','outer','end','end']);assert.strictEqual(b.state.halted,true);
});

test('On: procedure labels stay local and computed calls return to their enclosing procedure',()=>{
  const result=execute(binary([[t('Procedure'),dword(0),w(0),0,0,id('p'),t('['),id('arg'),t(']')],
    [on(id('arg'))],[t('Goto'),id('done',0x18)],
    labelled('one',id('value'),t('='),n(7)),[t('Return')],labelled('two',id('value'),t('='),n(8)),[t('Return')],
    labelled('done'),[t('End Proc'),t('['),id('value'),t(']')],
    [id('p',0x12),t('['),n(2),t(']')],[t('Print'),t('Param')],[t('End')],
    labelled('one',t('Print'),n(99)),[t('Return')]]));
  assert.deepStrictEqual(result.logs,[[8]]);assert.strictEqual(result.program.state.frames.length,0);assert.strictEqual(result.program.state.stack.length,0);
  assert.throws(()=>compile(binary([[t('Procedure'),dword(0),w(0),0,0,id('p')],[on(n(0),'Gosub',['outside'])],
    [t('End Proc')],labelled('outside'),[t('End')]])),/Unresolved label @p:outside.*line 2/);
});

test('On: invalid selectors, missing labels and unsupported destinations fail with source locations',()=>{
  assert.throws(()=>compile(binary([[on(text('1'))],...subroutines])),/Expected numeric expression.*line 1/);
  assert.throws(()=>compile(binary([[on(n(0),'Gosub',['missing'])]])),/Unresolved label missing.*line 1/);
  assert.throws(()=>compile(binary([[w(0x316),w(0),w(0),n(1),t('Gosub')]])),/Expected labelRef.*line 1/);
  assert.throws(()=>compile(binary([[on(n(1)),t(',')],...subroutines])),/Expected labelRef.*line 1/);
  assert.throws(()=>compile(binary([[w(0x316),w(0),w(0),n(1),t('Gosub'),n(100)]])),/Expected labelRef.*line 1/);
  assert.throws(()=>compile(binary([[w(0x316),w(0),w(0),n(1),t('Return')]])),/On requires Goto or Gosub.*line 1/);
  assert.throws(()=>compile(binary([[w(0x316)]])),/Truncated token.*line 1/);
  const {program}=execute(binary([[t('Dim'),id('a'),t('('),n(0),t(')')],[t('Wait Key')],
    [on([id('a'),t('('),n(1),t(')')])],[t('End')],...subroutines]));
  program.sendKey('x');assert.throws(()=>program.tick(100),/Array index.*line 3/);assert.strictEqual(program.state.halted,true);
});

test('On: original Wonderland dispatch selects three unchanged enemy initializers with declared guards',()=>{
  for(const [selector,expected]of [[0,[99,99]],[2,[-4,99]],[4,[0,0]],[5,[-4,99]],[6,[99,99]]]) {
    const result=execute(require('./helpers/wonderlandDispatch')(selector));assert.deepStrictEqual(result.logs,[expected]);
    assert.strictEqual(result.program.state.halted,true);assert.strictEqual(result.program.state.stack.length,0);
    assert.strictEqual(result.program.banks.get(1).images.length,75);
  }
  for(const selector of [1,3]) assert.deepStrictEqual(execute(require('./helpers/wonderlandDispatch')(selector)).logs,[]);
});
