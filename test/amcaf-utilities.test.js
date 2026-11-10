'use strict';
const assert=require('assert'),vm=require('vm');
const{binary,token:t}=require('./helpers/program'),{createFakeTimers}=require('./helpers/fakeTimers'),{createMemoryFiles}=require('../lib/amos/files');
function create(bytes=binary([[t('Wait Key')]]),files){const module={exports:{}};vm.runInNewContext(new(require('../lib/Transpiler'))(bytes,{extensions:{19:'amcaf-1.50beta4'}}).toModule(),{module});return module.exports({...createFakeTimers(),files});}
test('AMCAF decimal strings: native saturation, sign placement and signed NEG.L overflow match independent vectors',()=>{
 const p=create();try{
  for(const[value,width,spaces,zeros]of require('./fixtures/amcaf/strings.json').decimal){assert.strictEqual(p.extensionLsstr(value,width),spaces,`${value}/${width}`);assert.strictEqual(p.extensionLzstr(value,width),zeros,`${value}/${width}`);}
  for(const w of [-1,0,11,65537])assert.throws(()=>p.extensionLsstr(1,w),/1..10/);
 }finally{p.stop();}
});
test('AMCAF path strings: case, volumes, parent components, trailing separators and embedded bytes remain lexical',()=>{
 const p=create();try{
  for(const[input,name,path,extended]of [['','','',''],['name','name','','name/'],['disk:name','name','disk:','disk:name/'],['disk:','', 'disk:','disk:'],['a/b','b','a','a/b/'],['a/b/','','a/b','a/b/'],['/','','','/'],['a//b','b','a/','a//b/'],['a/b:c','c','a/b:','a/b:c/'],['a\\b','a\\b','','a\\b/'],['d:\x00\xff','\x00\xff','d:','d:\x00\xff/']]){
    assert.strictEqual(p.extensionFilename(input),name);assert.strictEqual(p.extensionPath(input),path);assert.strictEqual(p.extensionExtpath(input),extended);
  }
  for(const v of ['\u0100','x'.repeat(32761),null])assert.throws(()=>p.extensionFilename(v),/byte string/);
 }finally{p.stop();}
});
test('AMCAF shifts: ASR sign extension, low-six-bit counts and 32-bit overflow differ from JavaScript masked shifts',()=>{
 const p=create();try{for(const[value,count,left,right]of [[-8,1,-16,-4],[-1,32,0,-1],[1,32,0,0],[1,64,1,1],[1,-1,0,0],[-2147483648,31,0,-1],[2147483647,1,-2,1073741823]]){assert.strictEqual(p.extensionLsl(value,count),left);assert.strictEqual(p.extensionLsr(value,count),right);}}finally{p.stop();}
});
test('AMCAF Work files: relocated compiled commands round-trip raw bytes, chip banks and address selectors',()=>{
 const bytes=String.fromCharCode(...Array.from({length:256},(_,i)=>i)),files=createMemoryFiles({input:bytes}),p=create(require('./helpers/amcafUtilitiesProgram')(),files);
 try{p.tick(1000);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(files.read('snapshot'),bytes);assert.strictEqual(files.read('alias'),bytes);assert.strictEqual(p.banks.get(7).memory,'chip');assert.strictEqual(p.banks.get(7).name,'Work    ');assert.strictEqual(p.banks.get(7).permanent,false);}finally{p.stop();}
});
test('AMCAF Work files: failures preserve banks/files; writes snapshot bytes and retained paths before callbacks',()=>{
 let p,contents='abc',reads=0;const writes=[];const files={isDirectory:()=>true,read(){reads++;return contents;},write(name,data){writes.push([name,data]);if(!data){p.banks.get(7).data.fill(99);p.setDirectory('other:');}}};p=create(undefined,files);
 try{p.extensionWload('raw',7);const previous=p.banks.get(7),start=p.bankStart(7);
  p.setDirectory('original:');p.extensionWsave('out',start);assert.deepStrictEqual(writes,[['original:out',''],['original:out','abc']]);
  for(const bad of [Promise.resolve('x'),'\u0100','']){contents=bad;assert.throws(()=>p.extensionWload('bad',7),/byte|MiB/);assert.strictEqual(p.banks.get(7),previous);assert.strictEqual(p.bankStart(7),start);}
  assert.throws(()=>p.extensionWsave('out',start+1),/start address/);assert.strictEqual(writes.length,2);
  const before=reads;assert.throws(()=>p.extensionWload('bad',0),/target bank/);assert.strictEqual(reads,before);
  contents='IMP!raw payload';p.extensionWload('raw',7);assert.strictEqual(Buffer.from(p.banks.get(7).data).toString(),contents);assert.throws(()=>p.peek(start),/retired/);
 }finally{p.stop();}
});
