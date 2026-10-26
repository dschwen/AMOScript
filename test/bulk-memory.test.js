/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {binary,token:t,word:w,integer:n,identifier:id,text,execute,compile}=require('./helpers/program');
const reserve=(bank,length)=>[t('Reserve As Work'),n(bank),t(','),n(length)],fn=(name,arg)=>[t(name),t('('),arg,t(')')];
const idle=()=>execute(binary([[t('Wait Key')]])).program;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('Bulk memory Fill: original token repeats big-endian long bytes across blocks/tails and the exclusive end, with bounded odd-tail access',()=>{
  const {program:p,logs}=execute(binary([reserve(4,40),[id('p'),t('='),fn('Start',n(4))],
    [w(0x219a),id('p'),t('+'),n(2),t('To'),id('p'),t('+'),n(37),t(','),n(0x12345678)],
    [t('Print'),fn('Leek',[id('p'),t('+'),n(2)])],[t('Wait Key')]]));
  assert.deepStrictEqual(logs,[[0x12345678]]);const address=p.bankStart(4),data=p.banks.get(4).data;
  assert.strictEqual(Buffer.from(data).toString('hex'),'0000'+'12345678'.repeat(8)+'123456'+'000000');
  for(let length=0;length<=35;length++){data.fill(9);p.fillMemory(address+2,address+2+length,0x12345678);const expected=Buffer.alloc(40,9);Buffer.from('12345678'.repeat(9),'hex').copy(expected,2,0,length);assert.deepStrictEqual(Buffer.from(data),expected);}
  data.fill(9);p.fillMemory(address+1,address+16,0x12345678);assert.strictEqual(Buffer.from(data.slice(1,16)).toString('hex'),'123456781234567812345678123456');const before=data.slice();assert.throws(()=>p.fillMemory(address+1,address+17,0),/Odd Fill block/);assert.deepStrictEqual(data,before);
  p.fillMemory(4,address+4,-1);assert.deepStrictEqual(Array.from(data.slice(0,4)),[255,255,255,255]);assert.throws(()=>p.fillMemory(1024,address,0),/bounds/);p.stop();
});

test('Bulk memory Copy: original token handles forward/backward overlap, identical ranges and separate banks without replacing storage',()=>{
  const {program:p}=execute(binary([reserve(4,10),reserve(5,10),[w(0x219a),fn('Start',n(4)),t('To'),fn('Start',n(4)),t('+'),n(10),t(','),n(0x01020304)],
    [w(0x21aa),fn('Start',n(4)),t(','),fn('Start',n(4)),t('+'),n(10),t('To'),fn('Start',n(5))],[t('Wait Key')]]));
  const a=p.bankStart(4),b=p.bankStart(5),data=p.banks.get(4).data,other=p.banks.get(5).data;
  assert.strictEqual(Buffer.from(other).toString('hex'),'01020304010203040102');
  data.set([0,1,2,3,4,5,6,7,8,9]);p.copyMemory(a,a+8,a+1);assert.deepStrictEqual(Array.from(data),[0,0,1,2,3,4,5,6,7,9]);
  data.set([0,1,2,3,4,5,6,7,8,9]);p.copyMemory(a+1,a+9,a);assert.deepStrictEqual(Array.from(data),[1,2,3,4,5,6,7,8,8,9]);
  const before=data.slice();p.copyMemory(a+1,a+7,a+1);assert.deepStrictEqual(data,before);p.copyMemory(a,a+10,b);assert.deepStrictEqual(other,data);assert.strictEqual(p.banks.get(4).data,data);assert.strictEqual(p.banks.get(5).data,other);p.stop();
});

test('Bulk memory: DATA/arrays/procedure results and dynamic numeric conversion retain integer pattern bits and reject string forms',()=>{
  const {program:p,logs}=execute(binary([reserve(4,16),reserve(5,16),[t('Data'),w(0),n(0x12345678),t(','),n(8)],[t('Read'),id('value'),t(','),id('count')],
    [t('Dim'),id('a'),t('('),n(1),t(')')],[id('a'),t('('),n(1),t(')'),t('='),id('value')],
    [t('Fill'),n(4),t('To'),fn('Start',n(4)),t('+'),id('count'),t(','),id('a'),t('('),n(1),t(')')],
    [t('Procedure'),[0,0,0,0],w(0),0,0,id('pattern')],[t('End Proc'),t('['),n(-1985229329),t(']')],[id('pattern',0x12)],
    [t('Fill'),fn('Start',n(4)),t('+'),n(8),t('To'),fn('Start',n(4)),t('+'),n(16),t(','),t('Param')],
    [t('Copy'),fn('Start',n(4)),t(','),fn('Start',n(4)),t('+'),fn('Val',text('16.9')),t('To'),fn('Start',n(5))],
    [t('Print'),fn('Leek',fn('Start',n(5))),t(','),fn('Leek',[fn('Start',n(5)),t('+'),n(8)])]]));
  assert.deepStrictEqual(logs,[[0x12345678,-1985229329]]);assert.strictEqual(Buffer.from(p.banks.get(5).data).toString('hex'),'123456781234567889abcdef89abcdef');
  for(const line of [[t('Fill'),text('4'),t('To'),n(5),t(','),n(0)],[t('Fill'),n(4),t('To'),n(5),t(','),text('0')],[t('Copy'),n(4),t(','),text('5'),t('To'),n(6)]])assert.throws(()=>compile(binary([line])),/numeric.*line 1/);
  assert.throws(()=>compile(binary([[t('Fill'),n(4),t(','),n(5),t(','),n(0)]])),/Expected To/);assert.throws(()=>compile(binary([[t('Copy'),n(4),t('To'),n(5),t(','),n(0)]])),/Expected ,/);p.stop();
});

test('Bulk memory: argument expressions run once left-to-right and stale addresses from later callbacks reject before mutation',()=>{
  const value=name=>fn('Val',fn('Fsel$',text(name))),lines=[reserve(4,12),reserve(5,12),[t('Wait Key')],
    [t('Fill'),value('a'),t('To'),value('b'),t(','),value('c')],[t('Copy'),value('d'),t(','),value('e'),t('To'),value('f')],[t('Wait Key')]];
  let p;const calls=[],files={select({path:name}){calls.push(name);const a=p.bankStart(4),b=p.bankStart(5);return String({a,b:a+8,c:0x12345678,d:a,e:a+8,f:b}[name]);}};
  const clock=require('./helpers/fakeTimers').createFakeTimers();p=compile(binary(lines)).create({files,now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});p.tick(1000);p.sendKey('go');clock.tick(0);
  assert.deepStrictEqual(calls,['a','b','c','d','e','f']);assert.strictEqual(Buffer.from(p.banks.get(5).data.slice(0,8)).toString('hex'),'1234567812345678');p.stop();
  for(const command of ['Fill','Copy']){
    let q;const c=require('./helpers/fakeTimers').createFakeTimers();let base;
    const read={select({path:name}){if(name==='first'){base=q.bankStart(4);return String(base);}if(name==='last')return String(base+4);q.reserveWork(4,12);return command==='Fill'?'1':String(q.bankStart(5));}};
    const statement=command==='Fill'?[t('Fill'),value('first'),t('To'),value('last'),t(','),value('replace')]:[t('Copy'),value('first'),t(','),value('last'),t('To'),value('replace')];
    q=compile(binary([reserve(4,12),reserve(5,12),[t('Wait Key')],statement])).create({files:read,now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout});q.tick(1000);q.sendKey('go');assert.throws(()=>c.tick(0),/retired.*line 4/);assert.ok(q.banks.get(4).data.every(v=>v===0));assert.ok(q.banks.get(5).data.every(v=>v===0));assert.strictEqual(c.pending(),0);
  }
});

test('Bulk memory: complete ranges, retirement and the explicit Fill DBRA bound reject before any byte changes',()=>{
  const p=idle();p.reserveWork(4,8);p.reserveWork(5,8);const a=p.bankStart(4),b=p.bankStart(5),data=p.banks.get(4).data;data.fill(9);
  for(const action of [()=>p.fillMemory(a,a-1,0),()=>p.fillMemory(a,a+9,0),()=>p.copyMemory(a,a,a),()=>p.copyMemory(a,a-1,a),()=>p.copyMemory(a,a+9,b),()=>p.copyMemory(b,b+8,a+1),()=>p.copyMemory(a,a+1,5)]){assert.throws(action,/range|bounds/);assert.ok(data.every(v=>v===9));assert.ok(p.banks.get(5).data.every(v=>v===0));}
  p.fillMemory(a+8,a+8,0);assert.ok(data.every(v=>v===9));assert.throws(()=>p.fillMemory(a+9,a+9,0),/bounds/);
  p.swapBanks(4,7);p.fillMemory(a,a+2,0);assert.strictEqual(p.bankStart(7),a);p.shrinkBank(7,1);assert.throws(()=>p.copyMemory(a,a+2,b),/bounds/);p.eraseBank(7);assert.throws(()=>p.fillMemory(a,a,0),/retired/);
  p.reserveWork(6,1048577);const large=p.bankStart(6),bytes=p.banks.get(6).data;bytes.fill(0x55);p.fillMemory(large,large+1048576,-559038737);assert.strictEqual(Buffer.from(bytes.slice(0,4)).toString('hex'),'deadbeef');assert.strictEqual(Buffer.from(bytes.slice(-5)).toString('hex'),'deadbeef55');const before=hash(bytes);assert.throws(()=>p.fillMemory(large,large+1048577,0),/above 1 MiB/);assert.strictEqual(hash(bytes),before);p.stop();
});

test('Bulk memory: icon planar writes share canonical pixels and preserve old masks; protected headers/mask-pointer reads preflight',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'../examples/Roller2/iffp/icons.abk')),{program:p}=execute(require('./helpers/roller2IconCopy')(),1000,{files:require('../lib/amos/files').createMemoryFiles({icons:raw.toString('latin1')})});
  const base=p.bankStart(2),pointer=p.leek(base+2+17*8),image=p.banks.get(2).images[17],old=image.pixels.slice(),mask=image.mask.slice();
  p.fillMemory(pointer+10,pointer+14,-2147483648);const pixels=old.slice();for(let i=0;i<32;i++)pixels[i]=(pixels[i]&~1)|(i===0?1:0);assert.deepStrictEqual(image.pixels,pixels);assert.deepStrictEqual(image.mask,mask);
  const bytes=Array.from({length:10},(_,i)=>p.peek(pointer+10+i)),expected=bytes.slice();expected.splice(1,8,...bytes.slice(0,8));p.copyMemory(pointer+10,pointer+18,pointer+11);assert.deepStrictEqual(Array.from({length:10},(_,i)=>p.peek(pointer+10+i)),expected);assert.deepStrictEqual(image.mask,mask);
  const before=image.pixels.slice();for(const action of [()=>p.fillMemory(pointer+9,pointer+11,0),()=>p.copyMemory(pointer+10,pointer+12,pointer+9),()=>p.fillMemory(pointer+207,pointer+209,0)])assert.throws(action,/header writes|bounds/);assert.deepStrictEqual(image.pixels,before);
  p.reserveWork(4,8);const dest=p.bankStart(4);p.fillMemory(dest,dest+8,-1);assert.throws(()=>p.copyMemory(base+6,base+10,dest),/mask pointers/);assert.ok(p.banks.get(4).data.every(v=>v===255));p.stop();
});

test('Bulk memory: active Tracker writes reject before mutation while reads and empty Fill remain allowed',()=>{
  const directory=path.join(__dirname,'../examples/Roller2'),files={read:name=>fs.readFileSync(path.join(directory,/samples/i.test(name)?'music/Roller_II_Samples.Abk':'music/mod.Roller_II_mus'),'latin1')};
  const {program:p}=execute(require('./helpers/roller2Music')(),1000,{files}),a=p.bankStart(22),data=p.banks.get(22).data,before=data.slice();p.reserveWork(4,8);const b=p.bankStart(4);
  for(const action of [()=>p.fillMemory(a,a+4,0),()=>p.copyMemory(b,b+4,a),()=>p.copyMemory(a,a+4,a)])assert.throws(action,/active Tracker bank/);assert.deepStrictEqual(data,before);p.fillMemory(a,a,0);p.copyMemory(a,a+8,b);assert.deepStrictEqual(Array.from(p.banks.get(4).data),Array.from(before.slice(0,8)));p.trackStop();p.fillMemory(a,a+4,0);assert.ok(data.slice(0,4).every(v=>v===0));p.stop();
});

test('Roller2 transfers: original backup/clear/restore statements preserve all fifteen payloads, bank identities and metadata at a declared redraw guard',()=>{
  const create=compile(require('./helpers/roller2Transfers')()).create,expected=require('./fixtures/roller2/transfers.json').levels;
  for(const item of expected){const raw=fs.readFileSync(path.join(__dirname,'../examples/Roller2/levl',item.level)).subarray(20),clock=require('./helpers/fakeTimers').createFakeTimers(),p=create({files:{read:()=>fs.readFileSync(path.join(__dirname,'../examples/Roller2/levl',item.level),'latin1')},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
    p.tick(1000);const bank=p.banks.get(10),data=bank.data,address=p.bankStart(10),backup=p.banks.get(23).data;assert.strictEqual(p.state.waiting,'key');assert.strictEqual(hash(data),item.payloadSha256);assert.deepStrictEqual(Buffer.from(backup),raw);assert.notStrictEqual(data,backup);
    p.sendKey('clear');clock.tick(0);assert.strictEqual(hash(data),item.clearedSha256);assert.strictEqual(Buffer.from(data.slice(480)).toString('hex'),item.metadataHex);assert.deepStrictEqual(Buffer.from(backup),raw);assert.strictEqual(p.banks.get(10),bank);assert.strictEqual(p.banks.get(10).data,data);assert.strictEqual(p.bankStart(10),address);
    p.sendKey('restore');clock.tick(0);assert.deepStrictEqual(Buffer.from(data),raw);assert.strictEqual(p.state.frames.length,1);assert.strictEqual(p.state.waiting,'key');p.sendKey('finish');clock.tick(0);assert.strictEqual(p.state.halted,true);assert.strictEqual(p.state.frames.length,0);assert.strictEqual(clock.pending(),0);p.stop();
  }
});
