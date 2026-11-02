'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {binary,token:t,word:w,integer:n,text,compile,execute}=require('./helpers/program');
const {createFakeTimers}=require('./helpers/fakeTimers');
const BufferReader=require('../lib/Buffer'),Transpiler=require('../lib/Transpiler');
const root=path.join(__dirname,'../examples/Tutorial/Tutorials/Interface');

test('Resource Bank: native 0x28ca lowers one numeric selector and runs in a standalone factory without a files adapter',()=>{
  assert.strictEqual(require('../lib/TokenTable').token_by_name['Resource Bank'],0x28ca);
  const bytes=binary([[w(0x28ca),t('Val'),t('('),text('65536'),t(')')],[t('Wait Key')]]),{transpiler,program:p}=execute(bytes);
  try{assert.strictEqual(transpiler.ast.statements[0].command,'Resource Bank');assert.strictEqual(transpiler._ops[0].method,'setResourceBank');assert.strictEqual(p.resourceBank(),65536);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.banks.size,0);}finally{p.stop();}
  assert.throws(()=>compile(binary([[t('Resource Bank'),text('16')]])),/Expected numeric expression.*line 1/);
  assert.throws(()=>compile(binary([[t('Resource Bank')]])),/Expected expression.*line 1/);
  assert.throws(()=>compile(binary([[t('Resource Bank'),n(16),t(','),n(1)]])),/Expected end of statement.*line 1/);
});

test('Resource Bank: full longword selection, numeric conversion and invalid updates follow native store-after-check order',()=>{
  const {program:p}=execute(binary([[t('Wait Key')]]));
  try{
    assert.strictEqual(p.resourceBank(),0);
    for(const [input,expected]of [[16.9,16],[65536,65536],[2147483647,2147483647],[{numericType:'float',value:8.75},8],[-0.75,0]]){p.setResourceBank(input);assert.strictEqual(p.resourceBank(),expected);}
    p.setResourceBank(16);for(const invalid of [-1,-1.75,NaN,Infinity,-Infinity]){assert.throws(()=>p.setResourceBank(invalid),/nonnegative|Invalid floating-point/);assert.strictEqual(p.resourceBank(),16);}
    p.setResourceBank(0);assert.strictEqual(p.resourceBank(),0);
  }finally{p.stop();}
  assert.throws(()=>execute(binary([[t('Resource Bank'),n(16)],[t('Resource Bank'),t('-'),n(1)]])),/Resource Bank requires a nonnegative selector at line 2, byte/);
});

test('Resource Bank: selection is deferred and survives load/replacement, swap, erasure and Stop/Resume as a numeric selector',()=>{
  const {program:p,timers:c}=execute(binary([[t('Resource Bank'),n(16)],[t('Wait Key')]]));
  try{
    assert.strictEqual(p.banks.has(16),false);p.reserveData(16,16);const first=p.banks.get(16);assert.strictEqual(p.resourceBank(),16);
    p.reserveData(16,32);assert.notStrictEqual(p.banks.get(16),first);assert.strictEqual(p.resourceBank(),16);
    p.reserveData(17,8);const second=p.banks.get(17);p.swapBanks(16,17);assert.strictEqual(p.banks.get(p.resourceBank()),second);
    p.eraseBank(16);assert.strictEqual(p.resourceBank(),16);assert.strictEqual(p.banks.has(16),false);
    p.eraseAll();assert.strictEqual(p.resourceBank(),16);p.stop();c.tick(100);p.resume();assert.strictEqual(p.resourceBank(),16);
  }finally{p.stop();}
});

test('Resource Bank: each VM starts with system selection zero, including separate instances of the same compiled factory',()=>{
  const {create}=compile(binary([[t('Wait Key')]])),clock=createFakeTimers(),options={now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout},a=create(options),b=create(options);
  try{a.tick(100);b.tick(100);a.setResourceBank(16);assert.strictEqual(b.resourceBank(),0);b.setResourceBank(7);assert.strictEqual(a.resourceBank(),16);a.setResourceBank(0);assert.strictEqual(b.resourceBank(),7);}finally{a.stop();b.stop();}
});

test('Resource Bank: eight original Interface startup prefixes load the supplied resource bank and stop before Resource Screen Open',()=>{
  const resource=fs.readFileSync(path.join(root,'Example_Resource.Abk')),wait=binary([[t('Wait Key')]]).subarray(20),names=fs.readdirSync(root).filter(name=>/\.AMOS$/i.test(name)&&name!=='Full_Example.AMOS');
  assert.strictEqual(names.length,8);
  for(const name of names){
    const raw=fs.readFileSync(path.join(root,name)),b=new BufferReader(raw),end=b.lines[12],fixture=Buffer.concat([raw.subarray(0,end),wait]);fixture.writeUInt32BE(fixture.length-20,16);
    const {create}=compile(fixture),reads=[],clock=createFakeTimers();let p;
    p=create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){},files:{read(filename){reads.push([filename,p.resourceBank()]);assert.strictEqual(filename.toLowerCase(),'amospro_tutorial:tutorials/interface/example_resource.abk');return resource.toString('latin1');}}});
    try{p.tick(1000);assert.strictEqual(p.state.waiting,'key',name);assert.strictEqual(p.resourceBank(),16,name);assert.strictEqual(p.banks.get(16).name,'Resource');assert.strictEqual(p.banks.get(16).data.length,7028);assert.strictEqual(reads.length,1);assert.strictEqual(reads[0][1],name==='Sliders.AMOS'?16:0);}finally{p.stop();}
  }
});

test('Resource Bank: all nine complete Interface tutorials now advance to the genuine dialogue blockers',()=>{
  const names=fs.readdirSync(root).filter(name=>/\.AMOS$/i.test(name));assert.strictEqual(names.length,9);
  for(const name of names){const code=name==='Editing_Zones.AMOS'?'27e6':['Full_Example.AMOS','Sliders.AMOS','Communication.AMOS'].includes(name)?'2796':'26e8';assert.throws(()=>new Transpiler(fs.readFileSync(path.join(root,name))),new RegExp('Unsupported token 0x'+code+' at line'));}
});
