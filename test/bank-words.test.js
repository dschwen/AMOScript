/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {binary,token:t,word:w,integer:n,text,identifier:id,dword,execute,compile}=require('./helpers/program');
const reserve=[t('Reserve As Work'),n(4),t(','),n(12)],fn=(name,value)=>[t(name),t('('),value,t(')')];
const address=offset=>[fn('Start',n(4)),t('+'),n(offset)];

test('bank words: original token offsets read/write big-endian words and signed longs at even and odd addresses',()=>{
  const {program:p,logs}=execute(binary([reserve,[w(0x015a),address(1),t(','),n(0x1234abcd)],
    [w(0x21d8),address(3),t(','),n(-2147483647)], [t('Print'),[w(0x21f2),t('('),address(1),t(')')],t(','),[w(0x21fe),t('('),address(3),t(')')]],
    [t('Doke'),address(0),t(','),n(-1)],[t('Loke'),address(8),t(','),n(0x7fffffff)],
    [t('Print'),fn('Deek',address(0)),t(','),fn('Leek',address(8))]]));
  assert.deepStrictEqual(logs,[[43981,-2147483647],[65535,2147483647]]);
  assert.deepStrictEqual(Array.from(p.banks.get(4).data),[255,255,205,128,0,0,1,0,127,255,255,255]);p.stop();
});

test('bank words: complete access preflight prevents partial writes and invokes mutation checks once',()=>{
  const bank={number:4,type:'data',data:new Uint8Array(8).fill(0x55)};let writes=0;
  const m=require('../lib/amos/bankMemory')(new Map([[4,bank]]),{beforeWrite(){writes++;}}),a=m.start(4),before=bank.data.slice();
  for(const action of [()=>m.doke(a+7,0),()=>m.loke(a+5,0),()=>m.doke(a-1,0),()=>m.loke(a+8,0)]){assert.throws(action,/out of bounds|retired/);assert.deepStrictEqual(bank.data,before);}
  assert.strictEqual(writes,0);assert.throws(()=>m.deek(a+7),/out of bounds/);assert.throws(()=>m.leek(a+5),/out of bounds/);
  m.doke(a+1,0x123456);assert.strictEqual(writes,1);assert.deepStrictEqual(Array.from(bank.data),[85,52,86,85,85,85,85,85]);
  const blocked=require('../lib/amos/bankMemory')(new Map([[4,bank]]),{beforeWrite(){throw Error('blocked');}}),b=blocked.start(4),snapshot=bank.data.slice();
  assert.throws(()=>blocked.loke(b+1,-1),/blocked/);assert.deepStrictEqual(bank.data,snapshot);
});

test('bank words: DATA, arrays, procedures, floats and boxed Val share integer conversions with single evaluation',()=>{
  let reads=0;
  const {logs,program:p}=execute(binary([reserve,[t('Data'),w(0),n(66051)],[t('Read'),id('v')],
    [t('Dim'),id('a'),t('('),n(0),t(')')],[id('a'),t('('),n(0),t(')'),t('='),id('v')],
    [id('f',6,1),t('='),id('a'),t('('),n(0),t(')')],[t('Doke'),address(0),t(','),id('f',6,1)],
    [t('Procedure'),dword(0),w(0),0,0,id('value')],[t('End Proc'),t('['),fn('Leek',address(2)),t(']')],
    [t('Loke'),address(2),t(','),fn('Val',text('-2147483647'))],[id('value',0x12)],
    [t('Print'),fn('Deek',address(0)),t(','),t('Param')],
    [t('Doke'),[address(6),t('-'),fn('Exist',text('address'))],t(','),[n(65536),t('-'),fn('Exist',text('value'))]],
    [t('Print'),fn('Deek',address(7))]]),1000,{files:{exists(){reads++;return true;}}});
  assert.deepStrictEqual(logs,[[515,-2147483647],[1]]);assert.strictEqual(reads,2);p.stop();
  for(const name of ['Deek','Leek'])assert.throws(()=>compile(binary([[t('Print'),fn(name,text('bad'))]])),/Wrong argument type/);
  for(const name of ['Doke','Loke'])assert.throws(()=>compile(binary([[t(name),n(0),t(','),text('bad')]])),/numeric/);
  assert.throws(()=>execute(binary([reserve,[t('Doke'),address(11),t(','),n(1)]])),/out of bounds.*line 2, byte/);
});

test('bank words: swap/shrink keep valid ranges; save/reload retire old addresses and factories own their bytes',()=>{
  const files=require('../lib/amos/files').createMemoryFiles(),a=execute(binary([reserve,[t('Wait Key')]]),100,{files}).program,b=execute(binary([reserve,[t('Wait Key')]])).program;
  const p=a.bankStart(4);a.loke(p+1,-2147483647);assert.strictEqual(b.leek(b.bankStart(4)+1),0);
  a.swapBanks(4,5);assert.strictEqual(a.bankStart(5),p);a.shrinkBank(5,5);assert.strictEqual(a.leek(p+1),-2147483647);
  const snapshot=a.banks.get(5).data.slice();assert.throws(()=>a.loke(p+2,0),/out of bounds/);assert.deepStrictEqual(a.banks.get(5).data,snapshot);
  a.saveBanks('saved',5);assert.strictEqual(Buffer.from(files.read('saved'),'latin1').subarray(20).toString('hex'),'0080000001');
  a.loadBanks('saved');assert.throws(()=>a.leek(p+1),/retired/);assert.strictEqual(a.deek(a.bankStart(5)+1),32768);a.eraseBank(5);assert.throws(()=>a.deek(p+1),/retired/);a.stop();b.stop();
});

test('bank words: active Tracker reads are allowed and every multi-byte write is rejected before mutation',()=>{
  const directory=path.join(__dirname,'../examples/Roller2'),files={read:name=>fs.readFileSync(path.join(directory,/samples/i.test(name)?'music/Roller_II_Samples.Abk':'music/mod.Roller_II_mus'),'latin1')};
  const {program:p}=execute(require('./helpers/roller2Music')(),1000,{files}),a=p.bankStart(22),bank=p.banks.get(22),before=bank.data.slice();
  assert.strictEqual(p.deek(a),before[0]*256+before[1]);assert.strictEqual(p.leek(a),0x6d6f642e);
  for(const action of [()=>p.doke(a+1,0),()=>p.loke(a+1,0)])assert.throws(action,/active Tracker bank/);
  assert.deepStrictEqual(bank.data,before);p.trackStop();p.loke(a+1,-1);assert.deepStrictEqual(Array.from(bank.data.subarray(1,5)),[255,255,255,255]);p.stop();
});

test('Roller2 metadata: all fifteen original levels match independent headers and original Doke updates only the time word',()=>{
  const expected=require('./fixtures/roller2/level-metadata.json').levels,crypto=require('crypto'),create=compile(require('./helpers/roller2LevelMetadata')()).create;
  for(const item of expected){
    const raw=fs.readFileSync(path.join(__dirname,'../examples/Roller2/levl',item.level));assert.strictEqual(crypto.createHash('sha256').update(raw).digest('hex'),item.sha256);
    const clock=require('./helpers/fakeTimers').createFakeTimers(),p=create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files:{read:name=>name==='level'?raw.toString('latin1'):'43981\r\n',write(){throw Error('write');}}});
    p.tick(1000);assert.strictEqual(p.state.waiting,'key');const v=p.state.variables;
    assert.deepStrictEqual([v.int_bx,v.int_by,v.int_bc,v.int_tm],[item.x,item.y,item.colour,item.time]);
    const bank=p.banks.get(10),address=p.bankStart(10),before=bank.data.slice();p.sendKey('edit');clock.tick(20);
    assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.banks.get(10),bank);assert.strictEqual(p.bankStart(10),address);
    const changed=before.slice();changed[486]=0xab;changed[487]=0xcd;assert.deepStrictEqual(bank.data,changed);assert.strictEqual(p.deek(address+486),43981);
    p.stop();assert.strictEqual(clock.pending(),0);
  }
});
