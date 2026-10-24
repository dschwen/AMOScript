/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {binary,token:t,word:w,dword,integer:n,identifier:id,text,compile,execute}=require('./helpers/program');
const {createMemoryFiles,createNodeFiles}=require('../lib/amos/files');
const reserve=(bank,size)=>[t('Reserve As Work'),n(bank),t(','),n(size)];
const fn=(name,arg)=>[t(name),t('('),arg,t(')')];
const idle=files=>execute(binary([[t('Wait Key')]]),100,{files}).program;

test('Raw files: original Bload/Bsave words transfer byte strings into existing payloads with exclusive ends',()=>{
  const files=createMemoryFiles({raw:'\0\x80\xff'});
  const {program:p,logs}=execute(binary([reserve(4,5),[w(0x180c),text('raw'),t(','),n(4)],
    [w(0x181a),text('saved'),t(','),fn('Start',n(4)),t('To'),fn('Start',n(4)),t('+'),n(2)],
    [t('Print'),fn('Peek',fn('Start',n(4)))],[t('Wait Key')]]),100,{files});
  assert.strictEqual(files.read('saved'),'\0\x80');const bank=p.banks.get(4),data=bank.data,address=p.bankStart(4);
  assert.deepStrictEqual(Array.from(data),[0,128,255,0,0]);assert.deepStrictEqual(logs,[[0]]);
  p.bload('raw',address+2);assert.deepStrictEqual(Array.from(data),[0,128,0,128,255]);assert.strictEqual(p.banks.get(4),bank);assert.strictEqual(bank.data,data);assert.strictEqual(p.bankStart(4),address);p.stop();
});

test('Raw files: complete ranges are checked before mutation, without crossing banks, resizing or touching invalid output files',()=>{
  const files=createMemoryFiles({raw:'abcd',empty:'',saved:'keep',emptybank:Buffer.from('416d426b00060000800000084461746120202020','hex').toString('latin1')}),p=idle(files);p.reserveWork(4,3);p.reserveWork(5,3);const a=p.bankStart(4),data=p.banks.get(4).data;data.fill(9);
  assert.throws(()=>p.bload('raw',a),/bounds/);assert.deepStrictEqual(Array.from(data),[9,9,9]);assert.throws(()=>p.bsave('saved',a,a+4),/bounds/);assert.strictEqual(files.read('saved'),'keep');
  for(const stop of [a,a-1])assert.throws(()=>p.bsave('saved',a,stop),/Invalid Bsave range/);
  p.bload('empty',a+3);assert.throws(()=>p.peek(a+3),/bounds/);p.loadBanks('emptybank');p.bload('empty',p.bankStart(6));
  assert.throws(()=>p.bload('raw',a+3),/bounds/);assert.throws(()=>p.bload('empty',a+4),/bounds/);p.stop();
});

test('Raw files: bank/address threshold, swaps, shrink and replacement preserve checked ownership',()=>{
  const files=createMemoryFiles({raw:'\x81\xff'}),p=idle(files);p.reserveWork(4,4);const a=p.bankStart(4);p.swapBanks(4,7);p.bload('raw',a);assert.strictEqual(p.peek(p.bankStart(7)),129);
  p.shrinkBank(7,1);assert.throws(()=>p.bload('raw',a),/bounds/);assert.strictEqual(p.peek(a),129);p.eraseBank(7);p.reserveWork(7,4);assert.throws(()=>p.bload('raw',a),/retired/);
  p.reserveWork(1023,2);p.bload('raw',1023);p.reserveWork(1024,2);assert.throws(()=>p.bload('raw',1024),/bounds/);p.bload('raw',p.bankStart(1024));
  assert.throws(()=>p.bload('raw',-1),/Bank not reserved/);p.stop();
  const {program:images}=execute(require('./helpers/wonderlandStartup')(1,true),100,{files});assert.throws(()=>images.bload('raw',1),/image banks/);images.stop();
});

test('Raw files: adapter errors, thenables and nonbyte strings fail synchronously with source context; stale reads cannot write replacement banks',()=>{
  const make=files=>execute(binary([reserve(4,4),[w(0x180c),text('raw'),t(','),n(4)]]),100,{files});
  assert.throws(()=>make(),/host adapter.*line 2/);assert.throws(()=>make(createMemoryFiles()),/File not found.*line 2/);
  for(const contents of [Promise.resolve('x'),'\u0100',new Uint8Array([1])])assert.throws(()=>make({read:()=>contents}),/raw bytes synchronously.*line 2/);
  const files=createMemoryFiles({saved:'old'}),p=idle(files);p.reserveWork(4,4);const a=p.bankStart(4);
  const bad=idle({write:()=>Promise.resolve()});bad.reserveWork(4,4);assert.throws(()=>bad.bsave('saved',4,bad.bankStart(4)+1),/synchronously/);bad.stop();
  let replaced;replaced=idle({read(){replaced.reserveWork(4,4);return 'abc';}});replaced.reserveWork(4,4);const stale=replaced.bankStart(4);assert.throws(()=>replaced.bload('raw',stale),/retired/);assert.deepStrictEqual(Array.from(replaced.banks.get(4).data),[0,0,0,0]);replaced.stop();
  assert.throws(()=>p.bsave('saved',a,-1),/bounds/);assert.strictEqual(files.read('saved'),'old');p.stop();
});

test('Raw files: valid Bsave truncates before writing and snapshots bytes before reentrant host changes',()=>{
  const writes=[];let p;p=idle({write(name,value){writes.push(value);p.banks.get(4).data.fill(99);if(value)throw new Error('disk full');}});p.reserveWork(4,3);p.banks.get(4).data.set([0,128,255]);
  assert.throws(()=>p.bsave('raw',4,p.bankStart(4)+3),/disk full/);assert.deepStrictEqual(writes,['','\0\x80\xff']);p.stop();
  const q=idle();q.reserveWork(4,1);assert.throws(()=>q.bsave('x',4,q.bankStart(4)+1),/host adapter/);q.stop();
});

test('Raw files: typed DATA/array/procedure arguments and Val agree, while unsupported forms fail explicitly',()=>{
  const files=createMemoryFiles({raw:'ABCD'});
  const result=execute(binary([reserve(4,4),[t('Data'),w(0),text('raw'),t(','),n(4)],[t('Read'),id('f',6,2),t(','),id('bank')],
    [t('Dim'),id('a'),t('('),n(0),t(')')],[id('a'),t('('),n(0),t(')'),t('='),fn('Start',id('bank'))],
    [t('Procedure'),dword(0),w(0),0,0,id('p'),t('['),id('v'),t(']')],[t('End Proc'),t('['),id('v'),t(']')],
    [id('p',0x12),t('['),id('a'),t('('),n(0),t(')'),t(']')],[w(0x180c),id('f',6,2),t(','),t('Param')],
    [w(0x181a),text('saved'),t(','),t('Param'),t('To'),t('Param'),t('+'),fn('Val',text('3.9'))]]),100,{files});
  assert.strictEqual(files.read('saved'),'ABC');assert.strictEqual(result.program.state.halted,true);
  for(const line of [[t('Bload'),n(1),t(','),n(4)],[t('Bload'),text('raw'),t(','),text('4')],[t('Bsave'),text('raw'),t(','),n(4),t('To'),text('5')]])assert.throws(()=>compile(binary([line])),/requires a string|numeric/i);
});

test('Raw files: real Node adapters preserve all bytes across chunked output, and factories/audio see only their owned in-place changes',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'amoscript-raw-'));
  try{
    const files=createNodeFiles(directory),bytes=Buffer.from(Array.from({length:20000},(_,i)=>i&255));files.write('in',bytes.toString('latin1'));
    const a=idle(files),b=idle(files);a.reserveWork(4,20000);b.reserveWork(4,20000);a.bload('in',4);a.bsave('out',4,a.bankStart(4)+20000);
    assert.deepStrictEqual(fs.readFileSync(path.join(directory,'out')),bytes);assert.strictEqual(b.peek(b.bankStart(4)),0);assert.strictEqual(b.peek(b.bankStart(4)+1),0);a.stop();b.stop();
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
  const sample=Buffer.from('416d426b000500008000002053616d706c657320000100000006546f6e65202020200fa000000004007f80ff','hex');
  const files=createMemoryFiles({sample:sample.toString('latin1'),raw:'\xff'}),p=idle(files);p.loadBanks('sample');p.bload('raw',p.bankStart(5)+20);assert.strictEqual(p.audio.sample(1).data[0],255);p.stop();
});

test('Raw files: all five original Wonderland map writeback/save/load loops round-trip 7205 bytes and retain the omitted fifth seed',()=>{
  const original=require('./helpers/wonderlandLevelBytes')();
  for(let level=1;level<=5;level++){
    const files=createMemoryFiles({["AMOSPro_Productivity2:Wonderland/Wonderland_Samples.Abk"]:fs.readFileSync(path.join(__dirname,'../examples/Wonderland/Wonderland_Samples.Abk')).toString('latin1')});
    const {program:p,timers:c}=execute(require('./helpers/wonderlandLevelIO')(level),100000,{files});assert.strictEqual(p.state.waiting,'key');
    const bank=p.banks.get(4),data=bank.data,address=p.bankStart(4),expected=Buffer.from(original.subarray(0,7205));expected[(level-1)*1440]=level+3;
    p.arraySet(p.state.variables.array_int_scr,[1,1],level+3);p.sendKey('save');c.tick(0);assert.strictEqual(p.state.waiting,'key');
    assert.deepStrictEqual(Buffer.from(files.read('levels.lev'),'latin1'),expected);data.fill(99);data[7205]=100+level;
    p.sendKey('load');c.tick(0);assert.deepStrictEqual(Buffer.from(data.subarray(0,7205)),expected);assert.strictEqual(data[7205],100+level);
    assert.strictEqual(p.banks.get(4),bank);assert.strictEqual(bank.data,data);assert.strictEqual(p.bankStart(4),address);assert.strictEqual(p.arrayGet(p.state.variables.array_int_scr,[1,1]),level+3);
    assert.deepStrictEqual([1,2,3,4,5].map(i=>p.arrayGet(p.state.variables.array_int_rbowseed,[i])),[55,7,45,10,100+level]);assert.strictEqual(c.pending(),0);p.stop();
  }
});
