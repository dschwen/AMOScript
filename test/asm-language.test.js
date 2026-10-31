'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {binary,token:t,integer:n,identifier:id,word:w,text,execute,compile}=require('./helpers/program');
const {createMemoryFiles,createNodeFiles}=require('../lib/amos/files');
const label=name=>id(name,12),ref=name=>id(name,24),array=(name,i)=>[id(name),t('('),n(i),t(')')];
const idle=()=>execute(binary([[t('Wait Key')]])).program;

test('ASM bits: emitted scalar/array mutation and Btst retain signed 32-bit words and modulo bit positions',()=>{
  const {program:p,logs}=execute(binary([[t('Dim'),array('a',1)],[t('Bset'),n(31),t(','),id('x')],
    [t('Bset'),n(33),t(','),array('a',1)],[t('Bclr'),n(1),t(','),array('a',1)],
    [t('Print'),id('x'),t(','),t('Btst'),t('('),n(31),t(','),id('x'),t(')'),t(','),array('a',1)],[t('Wait Key')]]));
  assert.deepStrictEqual(logs,[[-2147483648,-1,0]]);assert.throws(()=>p.bitIndex(-1),/nonnegative/);
  assert.throws(()=>compile(binary([[t('Bset'),n(1),t(','),id('x',6,1)]])),/integer variable/);p.stop();
});

test('ASM bits: byte-address operations use checked bank memory, with preflighted failed writes',()=>{
  const p=idle();p.reserveWork(5,4);const start=p.bankStart(5);p.poke(start,0x12);
  p.modifyMemoryBit('Bset',9,start);assert.strictEqual(p.peek(start),0x12);
  p.modifyMemoryBit('Bclr',1,start);assert.strictEqual(p.peek(start),0x10);
  assert.strictEqual(p.testBit(12,()=>start,true),-1);assert.throws(()=>p.modifyMemoryBit('Bset',1,start+5),/bounds/);assert.strictEqual(p.peek(start),0x10);p.stop();
  const address=[t('('),id('addr'),t(')')];
  const r=execute(binary([[t('Reserve As Work'),n(5),t(','),n(4)],[id('addr'),t('='),t('Start'),t('('),n(5),t(')')],
    [t('Bset'),n(12),t(','),address],[t('Print'),t('Btst'),t('('),n(4),t(','),address,t(')')],
    [t('Bclr'),n(4),t(','),address],[t('Print'),t('Btst'),t('('),n(4),t(','),address,t(')')]]));
  assert.deepStrictEqual(r.logs,[[-1],[0]]);
  let calls=0;assert.throws(()=>execute(binary([[t('Bset'),n(1),t(','),id('missing'),t('('),t('Exist'),t('('),text('side'),t(')'),t(')')]]),100,{files:{exists(){calls++;return false;}}}),/not dimensioned/);assert.strictEqual(calls,0);

});

test('ASM Sort: complete owned arrays sort ascending, preserving array identity and typed values',()=>{
  const p=idle(),a=p.dim([3],'integer');p.arraySet(a,[0],7);p.arraySet(a,[1],-3);p.arraySet(a,[3],1);p.sortArray(a);
  assert.deepStrictEqual([0,1,2,3].map(i=>p.arrayGet(a,[i])),[-3,0,1,7]);
  const s=p.dim([2],'string');p.arraySet(s,[0],'B');p.arraySet(s,[1],'Ä');p.arraySet(s,[2],'A');p.sortArray(s);assert.deepStrictEqual([0,1,2].map(i=>p.arrayGet(s,[i])),['A','B','Ä']);p.stop();
});

test('ASM Resume and colon-form Else: named recovery, retry and nested block branches use ordinary checked control flow',()=>{
  const lines=[[t('On Error'),t('Goto'),ref('handler')],[id('d'),t('='),n(0)],[label('retry'),id('x'),t('='),n(12),t('/'),id('d')],[t('Goto'),ref('done')],
    [label('handler'),id('d'),t('='),n(3)],[t('Resume')],[label('done'),t('Print'),id('x')],[t('End')]];
  assert.deepStrictEqual(execute(binary(lines)).logs,[[4]]);
  lines[5]=[t('Resume'),ref('done')];assert.deepStrictEqual(execute(binary(lines)).logs,[[0]]);
  assert.throws(()=>execute(binary([[t('Resume')]])),/Resume without error/);
  assert.deepStrictEqual(execute(binary([[t('If'),w(0),n(1),t(':')],[t('If'),w(0),n(0),t(':'),t('Print'),text('bad'),t('Else'),w(0),t('Print'),text('ok'),t(':')],[t('Endif')],[t('Endif')]])).logs,[['ok']]);
});

test('ASM System and Request Wb: optional synchronous host boundary, terminal cleanup and immutable metadata',()=>{
  const calls=[],p=execute(binary([[t('System')],[t('Print'),text('bad')]]),100,{system:{command:(...args)=>calls.push(args)}}).program;
  assert.strictEqual(p.state.halted,true);assert.strictEqual(calls.length,1);assert.strictEqual(calls[0][0],'System');assert.ok(Object.isFrozen(p.state.systemRequest));p.resume();p.tick();assert.strictEqual(calls.length,1);
  const q=idle();q.requestWorkbench();assert.strictEqual(q.state.system.requesterTarget,'workbench');q.stop();
});

test('ASM Cblocks: byte-rounded capture, separate numbering, raw logical writes and common-plane restoration',()=>{
  const p=idle(),d=p.display;d.clear(0);for(let y=0;y<3;y++)for(let x=0;x<32;x++)d.screen().pixels[y*320+x]=x%16;
  p.getCblock(1,7,0,19,3);d.clear(15);p.putCblock(1,17,5);
  for(let y=5;y<8;y++)for(let x=0;x<40;x++)assert.strictEqual(d.point(x,y),x>=16&&x<32?(x-16)%16:15);
  const before=d.screen().pixels.slice();assert.throws(()=>p.getCblock(1,0,0,400,3),/rectangle/);assert.throws(()=>p.putCblock(1,319,199),/outside/);assert.deepStrictEqual(d.screen().pixels,before);
  p.delCblock(1);assert.throws(()=>p.putCblock(1),/not defined/);p.stop();
});

test('ASM Clip and minterms: graphics stay in an exclusive per-screen region; raw copies bypass Clip and OR preserves destination planes',()=>{
  const p=idle(),d=p.display;d.clear(0);d.clip(8,4,16,9);d.ink(3);d.bar(0,0,30,20);
  for(let y=0;y<22;y++)for(let x=0;x<32;x++)assert.strictEqual(d.point(x,y),x>=8&&x<16&&y>=4&&y<9?3:0);
  d.clear(0);d.ink(2);d.paint(10,6);assert.strictEqual(d.point(8,4),2);assert.strictEqual(d.point(7,4),0);
  d.clear(0);d.ink(1);d.plot(0,0);assert.strictEqual(d.point(0,0),0);d.clip();d.plot(0,0);assert.strictEqual(d.point(0,0),1);
  d.open(1,320,200,32,0);d.clear(16);d.copyScreenRectangle(0,0,0,1,1,1,0,0,224);assert.strictEqual(d.point(0,0),17);
  assert.throws(()=>d.copyScreenRectangle(0,0,0,1,1,1,0,0,256),/minterm/);p.stop();
});

test('ASM directory adapters: owned snapshots retain original case, fixed filename fields, deletion and explicit virtual capacity',()=>{
  const memory=createMemoryFiles({},[],['Df0:','Df0:Folder/'],{capacity:40});memory.write('Df0:ASM_File_1.TEST','abc');
  const p=execute(binary([[t('Wait Key')]]),100,{files:memory}).program;p.setDirectory('Df0:');
  assert.strictEqual(p.diskFree(),37);assert.ok(p.directoryFirst('Df0:').startsWith('*Folder'));const first=p.directoryNext();assert.strictEqual(first.slice(0,23),' ASM_File_1.TEST'.padEnd(23,' '));assert.strictEqual(first.length,38);
  memory.write('Df0:other','x');assert.strictEqual(p.directoryNext(),'');p.fileDelete('Df0:ASM_File_1.TEST');assert.strictEqual(memory.exists('Df0:ASM_File_1.TEST'),false);
  assert.throws(()=>memory.write('big','x'.repeat(41)),/full/);assert.throws(()=>p.fileDelete('missing'),/not found/);p.stop();
  const dir=fs.mkdtempSync('/tmp/asm-files-');try{fs.writeFileSync(path.join(dir,'file'),'abc');const node=createNodeFiles(dir);assert.strictEqual(node.list('')[0].size,3);assert.ok(node.freeSpace('')>=0);node.remove('file');assert.strictEqual(node.exists('file'),false);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
