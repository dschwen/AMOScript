/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {binary,word:w,token:t,integer:n,text,identifier:id,dword,execute,compile}=require('./helpers/program');
const ext=offset=>[w(0x4e),1,0,w(offset)],directory=path.join(__dirname,'../examples/Roller2');
const assetNames=new Map(Object.keys(JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'))).files).map(name=>[name.toLowerCase(),name]));
const files={read:name=>{const selected=assetNames.get(name.replace(/^rii:/i,'').toLowerCase());if(!selected)throw new Error(`Unknown pinned asset: ${name}`);return fs.readFileSync(path.join(directory,selected),'latin1');}};

test('Roller2: supplied source/data manifest is byte-exact; whole-source audit distinguishes recognition from compilation',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json')));
  for(const [name,entry] of Object.entries(manifest.files)){const b=fs.readFileSync(path.join(directory,name));assert.strictEqual(b.length,entry.byteLength);assert.strictEqual(crypto.createHash('sha256').update(b).digest('hex'),entry.sha256);}
  const a=require('../tools/audit_program').auditProgram(fs.readFileSync(path.join(directory,'Roller II.AMOS')));
  assert.deepStrictEqual([a.physicalLines,a.distinctEncodings,a.unrecognizedEncodings],[1199,194,22]);assert.strictEqual(a.compiler.ok,false);assert.match(a.compiler.error,/1:0x74.*line 161/);assert.deepStrictEqual(a.banks,[]);
});

test('Track Load: original Roller2 asset statements run standalone with sample bank 6, raw Tracker bank 22 and zero workspace',()=>{
  const {program:p}=execute(require('./helpers/roller2Loads')(),1000,{files}),raw=fs.readFileSync(path.join(directory,'music/mod.Roller_II_mus')),bank=p.banks.get(22);
  assert.strictEqual(p.state.halted,true);assert.strictEqual(p.state.audio.bank,6);assert.strictEqual(p.state.tracker.bank,22);
  assert.deepStrictEqual([bank.name,bank.memory,bank.permanent,bank.data.length],['Tracker ','chip',true,raw.length+32]);
  assert.deepStrictEqual(Buffer.from(bank.data.subarray(0,raw.length)),raw);assert.ok(bank.data.subarray(raw.length).every(v=>v===0));
  assert.strictEqual(p.audio.sample(1).bank,6);assert.strictEqual(require('../lib/amos/mod')(bank.data.subarray(0,-32)).patternCount,12);p.stop();
});

test('Track loading/loops: literal extension offsets, typed DATA/arrays/procedure results and independent state share ordinary lowering',()=>{
  const source=binary([[t('Data'),w(0),text('raw')],[t('Read'),id('f',6,2)],[t('Dim'),id('a',6,2),t('('),n(0),t(')')],[id('a',6,2),t('('),n(0),t(')'),t('='),id('f',6,2)],
    [t('Procedure'),dword(0),w(0),0,0,id('dest')],[t('End Proc'),t('['),n(22),t(']')],[id('dest',0x12)],
    [ext(0x26e)],[ext(0x2ba),id('a',6,2),t('('),n(0),t(')'),t(','),t('Param')],[ext(0x282)]]);
  const {create}=compile(source),c=require('./helpers/fakeTimers').createFakeTimers(),make=()=>create({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,files:{read:()=> '\x00\xffA'}}),p=make(),q=make();p.tick(1000);
  assert.strictEqual(p.state.tracker.loop,false);assert.strictEqual(p.state.tracker.bank,22);assert.deepStrictEqual(Array.from(p.banks.get(22).data.slice(0,3)),[0,255,65]);assert.strictEqual(q.state.tracker.bank,null);p.trackLoopOn();assert.strictEqual(q.state.tracker.loop,false);p.stop();q.stop();
  assert.throws(()=>compile(binary([[ext(0x2ba),n(1),t(','),n(22)]])),/requires a string/);
});

test('Track Load: failed reads do not replace banks or selection; successful replacement retires old addresses',()=>{
  const p=execute(binary([[t('Wait Key')]]),100,{files:{read:name=>{if(name==='bad')throw new Error('read failed');return 'abc';}}}).program;
  p.reserveWork(22,4);const old=p.banks.get(22),address=p.bankStart(22);
  assert.throws(()=>p.trackLoad('bad',22),/read failed/);assert.strictEqual(p.banks.get(22),old);assert.strictEqual(p.state.tracker.bank,null);
  p.trackLoad('ok',22);assert.throws(()=>p.peek(address),/retired/);assert.strictEqual(p.state.tracker.bank,22);p.stop();
  for(const result of [Promise.resolve('x'),'\u0100',new Uint8Array(1)])assert.throws(()=>execute(binary([[ext(0x2ba),text('x'),t(','),n(22)]]),100,{files:{read:()=>result}}),/tracker bytes synchronously.*line 1/);
  for(const bank of [0,-1,65536])assert.throws(()=>execute(binary([[ext(0x2ba),text('x'),t(','),n(bank)]]),100,{files:{read:()=>''}}),/Invalid Track Load bank.*line 1/);
  assert.throws(()=>execute(binary([[ext(0x2a8),n(22)]])),/Tracker bank not found.*line 1/);
});
