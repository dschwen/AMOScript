'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const read=require('../lib/amos/resourceScreen'),BankReader=require('../lib/BankReader'),BankWriter=require('../lib/BankWriter');
const {binary,token:t,word:w,integer:n,text,compile,execute}=require('./helpers/program');
const {createFakeTimers}=require('./helpers/fakeTimers'),startup=require('./helpers/interfaceStartup');
const external=()=>Uint8Array.from(BankReader.readFile(startup.resource()).banks[0].data);
const expected=[0,11,144,3072,1602,2694,3786,4095,4064,255,1288,3007,2794,4027,4000,127,0,3784,3168,3744,639,1181,1454,2783,3039,3311,4095,1032,2574,3598,3592,3822];
function bank(payload,colours=16,control=0xc200){
  if(!payload){payload=Buffer.alloc(76);payload.writeUInt16BE(1);payload.writeUInt32BE(6,2);payload.writeUInt16BE(colours,8);payload.writeUInt16BE(control,10);expected.forEach((v,i)=>payload.writeUInt16BE(v,12+i*2));}
  return {number:16,type:'data',memory:'fast',permanent:true,name:'Resource',data:Array.from(payload)};
}
function idle(record=bank()){
  const bytes=Buffer.concat([binary([[t('Wait Key')]]),Buffer.from(BankWriter.write([record],true))]),c=createFakeTimers(4),{create}=compile(bytes),p=create({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,print(){}});p.tick(1000);return {p,c};
}

test('Resource screen: original 90-image table supplies native 16-colour hires settings and all 32 registers without unpacking artwork',()=>{
  const bytes=external(),info=read(bytes);assert.deepStrictEqual([info.colours,info.control,info.mode,info.source],[16,0xc200,0x8000,'bank']);assert.deepStrictEqual(info.palette,expected);bytes.fill(0);assert.deepStrictEqual(info.palette,expected);
  const limited=external().subarray(0,448);assert.deepStrictEqual(read(limited),info); // image payloads are deliberately not consumed
});

test('Resource screen: pinned system metadata is independently recovered from the official default resource fixture',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'fixtures/interface/default-resource.abk'));assert.strictEqual(crypto.createHash('sha256').update(raw).digest('hex'),'8044d44b249b1a7aa4474cbcaaf55c88145b787f2debfdf3986f1463a5bea056');
  const data=Buffer.from(BankReader.readFile(raw).banks[0].data),graphics=data.readUInt32BE(2),at=graphics+2+4*data.readUInt16BE(graphics),info=read();assert.deepStrictEqual([at,info.colours,info.control,info.mode],[400,8,0xb200,0x8000]);assert.deepStrictEqual(info.palette,Array.from({length:32},(_,i)=>data.readUInt16BE(at+4+i*2)));
  info.palette[0]=0xfff;assert.strictEqual(read().palette[0],0);assert.deepStrictEqual(read(Uint8Array.from([0,0])),read());assert.deepStrictEqual(read(Uint8Array.from([0,1,0,0,0,0])),read());
});

test('Resource screen: table alignment, ranges, bounded counts and complete metadata reject malformed input',()=>{
  for(const mutate of [b=>b.writeUInt32BE(19,2),b=>b.writeUInt32BE(0xfffffffe,2),b=>b.writeUInt32BE(4,2),b=>b.writeUInt16BE(4097,18),b=>b.writeUInt16BE(3,380)]){const raw=Buffer.from(external());mutate(raw);assert.throws(()=>read(raw),/Resource screen/);}
  for(const bytes of [new Uint8Array(0),new Uint8Array(1),external().subarray(0,447),new Uint16Array(64)])assert.throws(()=>read(bytes),/Resource screen/);
  const raw=Buffer.from(external());raw.writeUInt16BE(0xfabc,384);assert.strictEqual(read(raw).palette[0],0xabc);
});

test('Resource Screen Open: exact four-argument token uses system resources, native width rounding, independent palettes and cursor-off intent',()=>{
  const {program:p}=execute(binary([[w(0x28ee),n(2),t(','),n(639),t(','),n(200),t(','),n(0)],[t('Wait Key')]]));
  try{const s=p.display.screen();assert.deepStrictEqual([p.display.current,s.width,s.height,s.colours,s.mode,s.cursorVisible,s.cursorColour],[2,624,200,8,0x8000,false,3]);assert.deepStrictEqual(Array.from(s.palette),read().palette);assert.strictEqual(p.banks.size,0);assert.ok(s.pixels.every(v=>v===1));assert.ok(p.display.renderDisplay().length);assert.strictEqual(p.state.flashes.length,0);}finally{p.stop();}
  assert.throws(()=>compile(binary([[t('Resource Screen Open'),n(0),t(','),text('640'),t(','),n(200),t(','),n(0)]])),/Expected numeric expression/);
  assert.throws(()=>compile(binary([[t('Resource Screen Open'),n(0),t(','),n(640),t(','),n(200)]])),/Expected ,/);
});

test('Resource Screen Open: current bank bytes and bank swaps control subsequent opens without stale metadata or address changes',()=>{
  const {p}=idle();try{
    p.setResourceBank(16);const address=p.bankStart(16);p.resourceScreenOpen(0,640,200,0);const old=p.display.screen(),pixels=old.pixels.slice();assert.deepStrictEqual(Array.from(old.palette),expected);
    p.doke(address+12,0x123);p.resourceScreenOpen(1,320,100,0);assert.strictEqual(p.display.screen().palette[0],0x123);assert.strictEqual(old.palette[0],0);assert.deepStrictEqual(old.pixels,pixels);assert.strictEqual(p.bankStart(16),address);
    p.reserveData(17,76);const other=p.banks.get(17);other.name='ResoTest';other.data.set(Uint8Array.from(bank(null,2,0).data));p.swapBanks(16,17);p.resourceScreenOpen(2,320,120,0);assert.deepStrictEqual([p.display.screen().colours,p.display.screen().mode,p.display.screen().cursorColour],[2,0,1]);
    p.eraseBank(16);assert.throws(()=>p.resourceScreenOpen(2,320,120,0),/not reserved/);p.setResourceBank(0);p.resourceScreenOpen(3,640,200,0);assert.strictEqual(p.display.screen().colours,8);
  }finally{p.stop();}
});

test('Resource Screen Open: invalid metadata, interlace, cursor flags, geometry and live clones preserve the previous target and its jobs',()=>{
  const {p,c}=idle();try{
    p.setResourceBank(16);const old=p.display.screen(),pixels=old.pixels.slice(),palette=old.palette.slice(),address=p.bankStart(16);p.flash(1,'(f00,2)');const pending=c.pending();
    for(const args of [[8,640,200,0],[0,15,200,0],[0,1024,200,0],[0,640,1024,0],[0,640,200,16]])assert.throws(()=>p.resourceScreenOpen(...args),/Invalid Resource Screen Open/);
    p.doke(address+10,0x8004);assert.throws(()=>p.resourceScreenOpen(0,640,200,0),/interlace/);p.doke(address+10,0x8000);
    p.doke(address+8,32);assert.throws(()=>p.resourceScreenOpen(0,640,200,0),/Hires/);p.doke(address+8,16);
    p.loke(address+2,0x7ffffffe);assert.throws(()=>p.resourceScreenOpen(0,640,200,0),/Resource screen/);p.loke(address+2,6);
    p.display.clone(2);assert.throws(()=>p.resourceScreenOpen(0,640,200,0),/clones/);p.display.close(2);
    assert.strictEqual(p.display.screen(),old);assert.deepStrictEqual(old.pixels,pixels);assert.deepStrictEqual(old.palette,palette);assert.strictEqual(c.pending(),pending);assert.strictEqual(p.state.flashes.length,1);
  }finally{p.stop();}
});

test('Resource Screen Open: nonzero cursor colour starts the real default Flash job and replacement/Stop retain ordinary ownership',()=>{
  const {p,c}=idle();try{p.setResourceBank(16);p.resourceScreenOpen(0,640,200,3);const s=p.display.screen();assert.deepStrictEqual([s.cursorVisible,s.cursorColour],[true,3]);assert.strictEqual(p.state.flashes.length,1);c.tick(20);assert.strictEqual(s.palette[3],0);c.tick(40);assert.strictEqual(s.palette[3],0x440);p.stop();assert.strictEqual(c.pending(),0);p.resume();p.resourceScreenOpen(0,640,200,0);assert.strictEqual(p.state.flashes.length,0);assert.strictEqual(c.pending(),0);assert.strictEqual(p.display.screen().cursorVisible,false);}finally{p.stop();}
});

test('Resource Screen Open: eight unchanged Interface prefixes reach their first wait and initialize real hires screens',()=>{
  const names=fs.readdirSync(startup.folder).filter(n=>/\.AMOS$/i.test(n)&&n!=='Full_Example.AMOS');assert.strictEqual(names.length,8);
  for(const name of names){const c=createFakeTimers(4),p=compile(startup.prefix(name)).create({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,print(){},files:{read(filename){assert.strictEqual(filename.toLowerCase(),'amospro_tutorial:tutorials/interface/example_resource.abk');return startup.resource().toString('latin1');}}});try{p.tick(1000);c.tick(40);const s=p.display.screen();assert.deepStrictEqual([p.state.waiting,p.display.current,s.width,s.height,s.colours,s.mode,s.cursorVisible],['key',0,640,200,16,0x8000,false],name);assert.ok(s.pixels.every(v=>v===0),name);assert.ok(p.display.renderDisplay().length,name);}finally{p.stop();}assert.strictEqual(c.pending(),0,name);}
});
