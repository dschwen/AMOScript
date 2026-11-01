'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {binary,token:t,word:w,integer:n,identifier:id,text,compile,execute}=require('./helpers/program');
const {createFakeTimers}=require('./helpers/fakeTimers');
const createDisplay=require('../lib/amos/display'),createAudio=require('../lib/amos/audio');
const hash=data=>crypto.createHash('sha256').update(Buffer.from(data.buffer,data.byteOffset,data.byteLength)).digest('hex');
const idle=()=>{const c=createFakeTimers(4),p=compile(binary([[t('Wait Key')]])).create({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,print(){}});p.tick(100);return {p,c};};

test('Tutorial core: counted Cline clears only the bounded cursor span, including old uncached parentheses',()=>{
  const d=createDisplay();d.open(0,32,16,16,0);d.clear(5);d.paper(3);d.locate(1,1);d.clearCountedLine(2);
  for(let y=0;y<16;y++)for(let x=0;x<32;x++)assert.strictEqual(d.point(x,y),y>=8&&x>=8&&x<24?3:5);
  assert.deepStrictEqual([d.screen().x,d.screen().y],[1,1]);assert.throws(()=>d.clearCountedLine(0),/1..206/);assert.throws(()=>d.clearCountedLine(207),/1..206/);
  const bytes=binary([[t('Cline'),t('('),n(20),t(')')],[t('Wait Key')]]);bytes.write('AMOS Basic v1.34',0,'latin1');const {program:p}=execute(bytes);assert.strictEqual(p.state.waiting,'key');p.stop();
});

test('Tutorial core: Centre counts escape controls once and hires Circle uses double horizontal radius',()=>{
  const d=createDisplay();d.open(0,80,24,16,0);d.pen(3);d.paper(0);d.reserveZones(2);d.centre('\x1bZ0AB\x1bZ1');
  const expected=createDisplay();expected.open(0,80,24,16,0);expected.pen(3);expected.paper(0);expected.locate(4,0);expected.write('AB\n');assert.deepStrictEqual(d.screen().pixels,expected.screen().pixels);
  d.open(0,640,200,16,0x8000);d.ink(7);d.circle(320,100,20);for(const [x,y]of [[280,100],[360,100],[320,80],[320,120]])assert.strictEqual(d.point(x,y),7);
});

test('Tutorial core: masked Fade captures selected registers and retains unselected palette jobs/pixels',()=>{
  const {p,c}=idle();p.display.open(1,320,200,16,0);p.display.screen(1).palette.fill(0);p.display.select(0);p.display.screen().palette.fill(0x333);const pixels=p.display.screen().pixels.slice();
  p.fade(1,1,0x5555);c.tick(20);for(let i=0;i<32;i++)assert.strictEqual(p.display.screen().palette[i],i<16 && !(i&1)?0x222:0x333);
  p.display.screen(1).palette.fill(0xfff);c.tick(100);for(let i=0;i<32;i++)assert.strictEqual(p.display.screen().palette[i],i<16 && !(i&1)?0:0x333);
  assert.deepStrictEqual(p.display.screen().pixels,pixels);p.stop();
});

test('Tutorial core: programmed rainbow components follow independent countdown and four-bit wrapping',()=>{
  const d=createDisplay();d.setRainbow(0,1,16,'(2,1,3)(1,-2,2)','','(1,1,0)',0x300);
  const red=[3,3,4,4,5,5,6,4,2,2,3,3,4,4,5,3],blue=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
  assert.deepStrictEqual(Array.from(d.rainbows.get(0).colours),red.map((r,i)=>(r<<8)|blue[i]));
  const table=d.rainbows.get(0);assert.throws(()=>d.setRainbow(0,1,16,'(0,1,2)','',''));assert.strictEqual(d.rainbows.get(0),table);
});

test('Tutorial core: Shoot PCM, periods and envelope match independent Fraction/Python PAL and NTSC vectors',()=>{
  const expected=require('./fixtures/audio/shoot.json');
  for(const vector of expected.cases){let field=vector.phase;const events=[],a=createAudio(new Map(),{standard:vector.name==='ntsc'?'NTSC':'PAL',vblHz:vector.hz,noiseSeed:vector.seed,noiseBeam:vector.beam,fieldTime:()=>field,host:{command:e=>events.push(e)}});a.shoot();assert.strictEqual(events.length,4);for(const [i,v]of vector.voices.entries()){const e=events[i];assert.deepStrictEqual([e.mask,e.period,e.sample.length,e.effect],[v.mask,v.period,v.length,'shoot']);assert.strictEqual(hash(e.sample.data),v.sha256);}assert.deepStrictEqual(a.noiseState().volumes,expected.volumes);field=11;assert.strictEqual(a.noiseState().mask,0);assert.strictEqual(hash(a.noiseState().wave),vector.field10WaveSha256);}
});

test('Tutorial core: Bell note overload uses native octave lengths and validates before replacing held sound',()=>{
  const events=[],a=createAudio(new Map(),{host:{command:e=>events.push(e)}});
  for(const [note,size,freq]of [[1,256,33],[30,128,175],[55,32,740],[70,8,1760],[80,8,3136],[96,4,7902]]){a.bell(note);assert.strictEqual(events.at(-1).period,Math.max(124,Math.floor(3546895/(size*freq))));}
  const count=events.length;assert.throws(()=>a.bell(97));assert.strictEqual(events.length,count);a.bell(0);assert.strictEqual(events.at(-1).type,'stop');
  const {program:p}=execute(binary([[w(0x4e),1,0,w(0x124),n(55)],[t('Wait Key')]]));p.stop();
});

test('Tutorial core: all 97 original ANIM frames match independent pixel hashes, lengths and frame parameters',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'../examples/Tutorial/Iff_Anim/AMOS.Anim')),expected=require('./fixtures/tutorial/anim5.json');
  const c=createFakeTimers(4),q=compile(binary([[t('Wait Key')]])).create({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,files:{read:()=>raw.toString('latin1'),write(){}}});q.tick(100);q.fileOpen(1,'animation','Open In');
  const position=q.fileInfo('Pof',1);const length=q.frameLength(1,999);assert.strictEqual(q.fileInfo('Pof',1),position);assert.strictEqual(q.frameLoad(1,10,999),97);assert.strictEqual(q.banks.get(10).data.length,length);
  let address=q.framePlay(10,1,0);assert.deepStrictEqual([q.display.screen().width,q.display.screen().height,q.display.screen().colours],[320,256,8]);assert.strictEqual(hash(q.display.screen().pixels),expected.frames[0].sha256);q.doubleBuffer();
  for(let i=1;i<97;i++){address=q.framePlay(address,1);q.display.swap(0);assert.strictEqual(hash(q.display.screen().physicalPixels),expected.frames[i].sha256,'frame '+i);assert.strictEqual(q.frameParam(),expected.frames[i].delay);}
  q.stop();
});

test('Tutorial core: Amplay exposes native local R0/R1, reverses the live pointer and Chanmv tracks actual movement',()=>{
  const payload=[0,0,0,0,0,1,0,4,0,0,0,0,0,2,0,9,0,1,2,3,0,0,10,20,30,0];
  const bank={number:4,type:'data',memory:'fast',permanent:false,name:'Amal    ',data:payload};
  const source=Buffer.concat([binary([[t('Synchro Off')],[t('Sprite'),n(0),t(','),n(250),t(','),n(80),t(','),n(0)],[t('Wait Key')]]),Buffer.from(require('../lib/BankWriter').write([bank],true))]);
  const {program:p}=execute(source);p.installAmal(0,'PLay 1;Let RZ=1');p.amalOn(0);assert.strictEqual(p.channelMoving(0),0);p.synchro();
  assert.strictEqual(p.channelMoving(0),-1);assert.deepStrictEqual([p.amregLocal(0,0),p.amregLocal(0,1)],[2,1]);
  p.setAmregLocal(0,5,70000);assert.strictEqual(p.amregLocal(0,5),4464);p.amplay(1,0);
  const positions=[[251,90],[249,70],[248,60],[248,60]];
  for(const xy of positions){p.synchro();assert.deepStrictEqual([p.spriteInfo('X Sprite',0),p.spriteInfo('Y Sprite',0)],xy);}
  assert.strictEqual(p.channelMoving(0),0);assert.strictEqual(p.amreg(25),1);assert.throws(()=>p.amregLocal(2,0),/not defined/);p.stop();
});

test('Tutorial core: AMAL mouse buttons and Rainbow channel bindings share live owned input and retire deleted tables',()=>{
  const {p}=idle();p.synchroOff();p.installAmal(0,'L:Let R0=K1;Let R1=K2;Pause;Jump L');p.amalOn(0);p.setMouse(200,100,3);p.synchro();assert.deepStrictEqual([p.amregLocal(0,0),p.amregLocal(0,1)],[-1,-1]);p.setMouse(200,100,0);p.synchro();assert.deepStrictEqual([p.amregLocal(0,0),p.amregLocal(0,1)],[0,0]);
  p.display.setRainbow(0,1,16,'','','');p.setChannel(1,'rainbow',()=>0);p.installAmal(1,'Let X=3;Let Y=60;Let A=5');p.amalOn(1);p.synchro();const r=p.display.rainbows.get(0);assert.deepStrictEqual([r.base,r.y,r.height],[3,60,5]);p.display.rainbowDel(0);p.synchro();assert.throws(()=>p.amregLocal(1,0),/not defined/);p.stop();
});

test('Tutorial core: mixed Bob/Sprite mask collisions convert hardware coordinates, filter ranges and preserve bitmap data',()=>{
  const banks=Buffer.from(fs.readFileSync(path.join(__dirname,'fixtures/image-banks.hex'),'utf8').replace(/\s/g,''),'hex');
  const {program:p}=execute(Buffer.concat([binary([[t('Wait Key')]]),banks.subarray(20)]));p.makeMask();p.setBob(1,20,20,1);p.setSprite(8,148,70,1);const before=p.display.screen().pixels.slice();
  assert.strictEqual(p.mixedCollision('Bob',1,8,8),-1);assert.strictEqual(p.collisionInfo(8),-1);assert.strictEqual(p.mixedCollision('Bob',1,0,7),0);assert.strictEqual(p.collisionInfo(8),0);
  assert.strictEqual(p.mixedCollision('Sprite',8,1,1),-1);assert.strictEqual(p.collisionInfo(1),-1);p.setSprite(8,400,200,1);assert.strictEqual(p.mixedCollision('Sprite',8),0);assert.deepStrictEqual(p.display.screen().pixels,before);p.stop();
});

test('Tutorial core: the complete original Iff_Animation source plays to Edit using only mouse input and the VBL clock',()=>{
  const folder=path.join(__dirname,'../examples/Tutorial'),raw=fs.readFileSync(path.join(folder,'Iff_Anim/AMOS.Anim')).toString('latin1'),source=fs.readFileSync(path.join(folder,'Tutorials/Iff_Animation.AMOS')),expected=require('./fixtures/tutorial/anim5.json');
  const c=createFakeTimers(4),p=compile(source).create({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,print(){},files:{read(name){assert.strictEqual(name.toLowerCase(),'amospro_tutorial:iff_anim/amos.anim');return raw;},write(){}}});
  try{p.tick(1000);c.tick(2000);assert.strictEqual(p.state.location.line,141);assert.strictEqual(p.state.variables.int_nof,97);assert.strictEqual(p.state.variables.int_memory,p.banks.get(10).data.length);p.setMouse(200,100,1);c.tick(10000);assert.strictEqual(p.state.halted,true);assert.strictEqual(p.state.editRequest.location.line,182);assert.strictEqual(hash(p.display.screen().physicalPixels),expected.frames[96].sha256);assert.strictEqual(c.pending(),0);}finally{p.stop();}
});
