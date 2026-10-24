/* jshint esversion: 6 */
'use strict';
const assert=require('assert');
const {binary,token:t,word:w,dword,integer:n,identifier:id,text,compile,execute}=require('./helpers/program');
const using=(format,item)=>[w(0x4a6),format,t(';'),item];
const print=(format,item)=>[t('Print'),using(text(format),item)];
const fn=(name,arg)=>[t(name),t('('),arg,t(')')];

test('Print Using: raw token pads and truncates signed 32-bit integer fields using explicit sign slots',()=>{
  const cases=[['######',123,'   123'],['#',12,'2'],['######',-42,'    42'],['##########',-2147483648,'2147483648'],
    ['+##########',-2147483648,'-2147483648'],['######',2147483647,'483647'],['+##',7,'+ 7'],['+##',-7,'- 7'],
    ['-###',12,'  12'],['-###',-12,'- 12'],['##',0,' 0'],['value=##!',123,'value=23!'],['literal',1,'literal'],['',1,'']];
  const result=execute(binary(cases.map(([format,value])=>print(format,n(value)))));
  assert.deepStrictEqual(result.logs,cases.map(item=>[item[2]]));assert.strictEqual(result.program.state.halted,true);
});

test('Print Using: format lifetime is one item, repeated Using and screen/file separators retain their contracts',()=>{
  const line=[t('Print'),using(text('###'),n(12)),t(';'),n(34),t(';'),using(text('+##'),n(5)),t(';')];
  assert.deepStrictEqual(execute(binary([line])).logs,[[' 12',34,'+ 5']]);
  let output='';const p=compile(binary([[t('Print'),using(text('###'),n(12)),t(','),text('X')]])).create({setTimeout(){},write:value=>{output+=value;}});
  p.tick(100);assert.strictEqual(output,' 12 X\n');
  const files=require('../lib/amos/files').createMemoryFiles();
  execute(binary([[t('Open Out'),n(1),t(','),text('out')],[t('Print#'),n(1),t(','),using(text('###'),n(12)),t(','),using(text('##'),n(3)),t(';')],[t('Close All')]]),100,{files});
  assert.strictEqual(files.read('out'),' 12\t 3');
});

test('Print Using: typed scalar/array/DATA/procedure results and dynamic integer Val remain exact',()=>{
  const data=binary([[t('Data'),w(0),text('######'),t(','),n(123)],[t('Read'),id('mask',6,2),t(','),id('value')],
    [t('Dim'),id('a'),t('('),n(0),t(')')],[id('a'),t('('),n(0),t(')'),t('='),id('value')],
    [t('Procedure'),dword(0),w(0),0,0,id('p'),t('['),id('x'),t(']')],[t('End Proc'),t('['),id('x'),t(']')],
    [id('p',0x12),t('['),id('a'),t('('),n(0),t(')'),t(']')],
    [t('Print'),using(id('mask',6,2),t('Param')),t(','),using(text('##'),fn('Val',text('42')))]]);
  assert.deepStrictEqual(execute(data).logs,[['   123','42']]);
});

test('Print Using: string fields pad, truncate, preserve literals and respect NUL and bounded buffer rules',()=>{
  const cases=[['[~~~]','a','[a  ]'],['~~~','abcdef','abc'],['~ / ~','ab','a / b'],['~~','','  '],['###','42','###'],
    ['~~~','a\0b','a  '],['~~\0tail','abc','ab'],['~~~','x'.repeat(121),'xxx']];
  assert.deepStrictEqual(execute(binary(cases.map(([f,v])=>print(f,text(v))))).logs,cases.map(item=>[item[2]]));
  assert.throws(()=>execute(binary([print('~~~',text('x'.repeat(122)))])),/Long-string Print Using.*line 1/);
  assert.deepStrictEqual(execute(binary([print('##\0tail',n(123)),print('#'.repeat(119),n(1))])).logs,[['23'],[' '.repeat(118)+'1']]);
  assert.throws(()=>execute(binary([print('#'.repeat(120),n(1))])),/shorter than 120.*line 1/);
});

test('Print Using: formats evaluate before values exactly once and bad format bounds precede value reads',()=>{
  const {create}=compile(binary([[t('Print'),using(t('Inkey$'),fn('Joy',n(1)))]])),logs=[],p=create({setTimeout(){},print:v=>logs.push(v)});
  let reads=0;p.sendKey('#');p.setJoystickReader(()=>{reads++;return 7;});p.tick(100);
  assert.deepStrictEqual(logs,['7']);assert.strictEqual(reads,1);
  const array=[id('a'),t('('),n(1),t(')')];
  assert.throws(()=>execute(binary([[t('Dim'),id('a'),t('('),n(0),t(')')],print('#'.repeat(120),array)])),/shorter than 120.*line 2/);
  const {program}=execute(binary([[t('Wait Key')]]));let evaluated=false;
  assert.throws(()=>program.formatUsing('\u0100',()=>{evaluated=true;return 1;},'integer'),/byte-string/);assert.strictEqual(evaluated,false);
});

test('Print Using: unsupported floats/decimal/exponent formats and invalid syntax fail with source context',()=>{
  for(const f of ['###.##','###;##','^^^^^'])assert.throws(()=>execute(binary([print(f,n(1))])),/Decimal\/exponent.*line 1/);
  assert.throws(()=>compile(binary([print('###',[w(0x46),dword(0x80000041)])])),/Floating-point Print Using.*line 1/);
  const {create}=compile(binary([print('###',fn('Val',text('1.5')))])),p=create({setTimeout(){}});
  assert.throws(()=>p.tick(100),/Floating-point Print Using.*line 1/);assert.strictEqual(p.state.halted,true);
  for(const line of [[t('Print'),using(n(1),n(1))],[t('Print'),t('Using'),text('##'),t(','),n(1)],
    [t('Print'),t('Using'),text('##'),t(';')],[w(0x4a6),text('##'),t(';'),n(1)]])assert.throws(()=>compile(binary([line])),/Using|Expected|Unsupported/);
});

test('Print Using: later ordinary Prints and independent factories retain no hidden format state',()=>{
  const {create}=compile(binary([print('######',n(12)),[t('Print'),n(345)]])),a=[],b=[];
  const first=create({setTimeout(){},print:v=>a.push(v)}),second=create({setTimeout(){},print:v=>b.push(v)});
  first.tick(100);second.tick(100);assert.deepStrictEqual(a,['    12',345]);assert.deepStrictEqual(b,a);
});

test('Print Using: unchanged Wonderland level/score statements match separately rasterized panel expectations',()=>{
  const fs=require('fs'),path=require('path');
  for(const item of require('./helpers/scorePanelGoldens')()){
    const {program,logs,timers}=execute(require('./helpers/wonderlandScore')(item.level,item.score,item.secondLevelLine),1000,
      {files:{read:name=>fs.readFileSync(path.join(__dirname,'../examples/Wonderland',name.split('/').pop())).toString('latin1')}});
    assert.deepStrictEqual(logs,[[item.levelText],[item.scoreText]]);
    assert.deepStrictEqual(Buffer.from(program.display.renderDisplay()),Buffer.from(item.rgba));
    assert.strictEqual(program.state.waiting,'key');assert.strictEqual(timers.pending(),0);program.stop();
  }
});
