/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {binary,token:t,integer:n,word:w,dword,identifier:id,text,execute,compile}=require('./helpers/program');
const variable=(name,flags=0)=>id(name,6,flags),element=(name,index,flags=0)=>[variable(name,flags),t('('),index,t(')')];
const select=name=>[t('Val'),t('('),t('Fsel$'),t('('),text(name),t(')'),t(')')];
function make(lines,options={}){const c=require('./helpers/fakeTimers').createFakeTimers(),p=compile(binary(lines)).create({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,...options});return{p,c};}

test('Swap: original opcode exchanges same-type integer/string/float scalar values without conversions, including alias/default storage',()=>{
  const {program:p,transpiler}=execute(binary([[variable('a'),t('='),n(-2147483648)],[variable('b'),t('='),n(2147483647)],[w(0xa6),variable('a'),t(','),variable('b')],
    [variable('s',2),t('='),text('a\0\xff')],[variable('t',2),t('='),text('')],[t('Swap'),variable('s',2),t(','),variable('t',2)],[t('Swap'),variable('a'),t(','),variable('a')],[t('Swap'),variable('x'),t(','),variable('y')],[t('Wait Key')]]));
  assert.deepStrictEqual([p.state.variables.int_a,p.state.variables.int_b,p.state.variables.string_s,p.state.variables.string_t,p.state.variables.int_x,p.state.variables.int_y],[2147483647,-2147483648,'','a\0\xff',0,0]);assert.strictEqual(transpiler.ast.statements.filter(node=>node.kind==='Swap').length,4);assert.strictEqual(transpiler._ops.filter(op=>op.kind==='swap').length,4);p.stop();
  const {program:q,timers:c}=execute(binary([[t('Procedure'),dword(0),w(0),0,0,id('floats')],[t('Wait Key')],[t('Swap'),variable('a',1),t(','),variable('b',1)],[t('Wait Key')],[t('End Proc')],[id('floats',0x12)]]));q.state.locals.float_a=-0;q.state.locals.float_b=1.25;q.sendKey('go');c.tick(0);assert.strictEqual(q.state.locals.float_a,1.25);assert.strictEqual(Object.is(q.state.locals.float_b,-0),true);q.stop();
});

test('Swap: scalar/array and multidimensional/default/aliased elements capture destinations before either store',()=>{
  const {program:p}=execute(binary([[t('Dim'),element('a',n(2))],[element('a',n(1)),t('='),n(7)],[variable('i'),t('='),n(1)],
    [t('Swap'),variable('i'),t(','),element('a',variable('i'))],[t('Swap'),element('a',n(1)),t(','),element('a',n(2))],[t('Swap'),element('a',n(2)),t(','),element('a',n(2))],
    [t('Dim'),variable('m'),t('('),n(1),t(','),n(1),t(')')],[variable('m'),t('('),n(1),t(','),n(0),t(')'),t('='),n(22)],
    [t('Swap'),variable('m'),t('('),n(1),t(','),n(0),t(')'),t(','),variable('i')],[t('Wait Key')]]));
  assert.strictEqual(p.state.variables.int_i,22);assert.strictEqual(p.arrayGet(p.state.variables.array_int_a,[1]),0);assert.strictEqual(p.arrayGet(p.state.variables.array_int_a,[2]),1);assert.strictEqual(p.arrayGet(p.state.variables.array_int_m,[1,0]),7);p.stop();
});

test('Swap: both addresses resolve once left-to-right, retain array identities/linear offsets, and read latest values after callbacks',()=>{
  const calls=[];let p,old,replacement;
  const built=make([[t('Procedure'),dword(0),w(0),0,0,id('arrays')],[t('Dim'),element('a',n(0))],[element('a',n(0)),t('='),n(11)],[t('Swap'),element('a',select('left')),t(','),element('a',select('right'))],[t('Wait Key')],[t('End Proc')],[id('arrays',0x12)]],{files:{select({path}){calls.push(path);if(path==='left'){old=p.state.locals.array_int_a;replacement=p.dim([0],'integer');replacement.values.set(0,22);p.state.locals.array_int_a=replacement;}else{old.values.set(0,77);replacement.values.set(0,88);}return'0';}}});p=built.p;p.tick(1000);assert.deepStrictEqual(calls,['left','right']);assert.strictEqual(old.values.get(0),88);assert.strictEqual(replacement.values.get(0),77);p.stop();
  let q,source;
  const second=make([[t('Dim'),element('b',n(0))],[element('b',n(0)),t('='),n(29)],[t('Dim'),variable('a'),t('('),n(1),t(','),n(1),t(')')],[variable('a'),t('('),n(1),t(','),n(0),t(')'),t('='),n(17)],[variable('v'),t('='),n(29)],
    [t('Swap'),variable('a'),t('('),n(1),t(','),n(0),t(')'),t(','),element('b',select('right'))]],{files:{select(){source=q.state.variables.array_int_a;source.dimensions=[4,1];return'0';}}});q=second.p;q.tick(1000);assert.strictEqual(source.values.get(2),29);assert.strictEqual(q.state.variables.array_int_b.values.get(0),17);q.stop();
});

test('Swap: mismatched/invalid lvalues and failed target resolution reject with source context before Swap stores',()=>{
  for(const [left,right]of [[variable('a'),variable('b',1)],[variable('a',2),variable('b')],[variable('a',1),variable('b',2)]])assert.throws(()=>compile(binary([[t('Swap'),left,t(','),right]])),/same type.*line 1/);
  for(const target of [n(1),[variable('a'),t('+'),n(1)],variable('a',0x40)])assert.throws(()=>compile(binary([[t('Swap'),target,t(','),variable('b')]])),/variable|Expected ,|indices/);
  let calls=0;const first=make([[t('Dim'),element('a',n(0))],[t('Swap'),element('a',n(1)),t(','),element('a',select('right'))]],{files:{select(){calls++;return'0';}}});assert.throws(()=>first.p.tick(1000),/out of bounds.*line 2, byte/);assert.strictEqual(calls,0);assert.strictEqual(first.c.pending(),0);
  const missing=make([[t('Swap'),element('a',select('index')),t(','),variable('v')]],{files:{select(){calls++;return'0';}}});assert.throws(()=>missing.p.tick(1000),/not dimensioned.*line 1/);assert.strictEqual(calls,0);assert.strictEqual(missing.c.pending(),0);
  const dimension=make([[t('Dim'),variable('a'),t('('),n(0),t(','),n(0),t(')')],[t('Swap'),variable('a'),t('('),n(1),t(','),select('later'),t(')'),t(','),variable('v')]],{files:{select(){calls++;return'0';}}});assert.throws(()=>dimension.p.tick(1000),/out of bounds.*line 2/);assert.strictEqual(calls,0);assert.strictEqual(dimension.c.pending(),0);
  const second=make([[t('Dim'),element('a',n(0))],[variable('v'),t('='),n(7)],[t('Swap'),variable('v'),t(','),element('a',n(1))]]);assert.throws(()=>second.p.tick(1000),/out of bounds.*line 3/);assert.strictEqual(second.p.state.variables.int_v,7);assert.strictEqual(second.p.arrayGet(second.p.state.variables.array_int_a,[0]),0);assert.strictEqual(second.c.pending(),0);
  const third=make([[t('Dim'),element('a',n(0))],[element('a',n(0)),t('='),n(8)],[t('Swap'),element('a',n(0)),t(','),element('a',select('fail'))]],{files:{select(){throw Error('selector failed');}}});assert.throws(()=>third.p.tick(1000),/selector failed.*line 3/);assert.strictEqual(third.p.arrayGet(third.p.state.variables.array_int_a,[0]),8);assert.strictEqual(third.c.pending(),0);
});

test('Swap: DATA, procedure parameters/locals and Global/Shared arrays and strings retain ordinary scope and factory isolation',()=>{
  const data=binary([[t('Data'),w(0),n(11),t(','),n(22),t(','),text('left'),t(','),text('right')],[t('Read'),variable('g'),t(','),variable('v'),t(','),variable('first',2),t(','),variable('second',2)],
    [t('Dim'),element('a',n(1))],[element('a',n(0)),t('='),variable('g')],[element('a',n(1)),t('='),variable('v')],[t('Global'),variable('g'),t(','),variable('a'),t('('),t(')')],
    [t('Procedure'),dword(0),w(0),0,0,id('exchange'),t('['),variable('param'),t(']')],[t('Shared'),variable('first',2),t(','),variable('second',2)],
    [t('Swap'),variable('g'),t(','),variable('param')],[t('Swap'),element('a',n(0)),t(','),element('a',n(1))],[t('Swap'),variable('first',2),t(','),variable('second',2)],[t('End Proc'),t('['),variable('param'),t(']')],
    [id('exchange',0x12),t('['),variable('v'),t(']')],[t('Print'),variable('g'),t(','),variable('v'),t(','),t('Param'),t(','),element('a',n(0)),t(','),element('a',n(1)),t(','),variable('first',2),t(','),variable('second',2)],[t('Wait Key')]]);
  const {program:p,logs}=execute(data),{program:q}=execute(data);assert.deepStrictEqual(logs,[[22,22,11,22,11,'right','left']]);p.state.variables.array_int_a.values.set(0,99);assert.strictEqual(q.arrayGet(q.state.variables.array_int_a,[0]),22);p.stop();q.stop();
});

test('Roller2 Swap: original insertion and strict-max paired sorts match five independent row orders and fifteen preview PNG/hash frames',()=>{
  const expected=require('./fixtures/roller2/swap.json').cases,hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
  for(const entry of expected){const {program:p,timers:c}=execute(require('./helpers/roller2Swap')(),10000,{files:{read:()=>`${entry.score}\r\n${entry.name}\r\n`,write(){throw Error('Unexpected scoresave');}}});
    for(const [index,frame]of entry.frames.entries()){if(index){p.sendKey('next');c.tick(0);}const rows=Array.from({length:11},(_,i)=>[p.arrayGet(p.state.variables.array_int_scr,[i+1]),p.arrayGet(p.state.variables.array_string_hi,[i+1])]);assert.deepStrictEqual(rows,frame.rows);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.state.frames.length,0);assert.strictEqual(p.arrayGet(p.state.variables.array_int_scr,[0]),0);assert.strictEqual(p.arrayGet(p.state.variables.array_string_hi,[0]),'');const pixels=p.display.screen().pixels,rgba=p.display.canvasFrame().rgba,png=require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/roller2',frame.png))).rgba;assert.strictEqual(hash(pixels),frame.indicesSha256);assert.strictEqual(hash(rgba),frame.rgbaSha256);assert.deepStrictEqual(Buffer.from(rgba),Buffer.from(png));}p.stop();assert.strictEqual(c.pending(),0);
  }
});
