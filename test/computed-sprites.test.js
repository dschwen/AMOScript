'use strict';
const assert=require('assert'),pool=require('../lib/amos/spriteBuffer');
const {execute,token:t}=require('./helpers/program'),attached=require('./helpers/attachedSprite');
const image=(number,x,y,width=16,height=2,depth=4)=>({number,x,y,width,height,depth,pixels:Uint8Array.from({length:width*height},(_,i)=>i%16)});
const words=(snapshot,channel,row=0,count=2)=>{
  const at=snapshot.physical*snapshot.frameBytes+channel*snapshot.columnBytes+row*4;
  return Array.from({length:count},(_,i)=>snapshot.bytes[at+2*i]*256+snapshot.bytes[at+2*i+1]);
};
test('Computed sprites: sorted word streams reuse eight channels with a one-line gap and independent expected POS/CTL/data',()=>{
  const b=pool();b.setPointerVisible(false);
  // Insert in reverse order: sorted Y then number determines physical priority.
  const frames=[image(12,138,62),image(11,144,60),image(10,142,60),image(9,140,60),image(8,138,60),image(13,140,63)];
  b.update(new Map(frames.map(f=>[f.number,f])));const s=b.snapshot();
  for(const c of [0,2,4,6])assert.deepStrictEqual(words(s,c,0,6),[0x3c45+c/2,0x3e00,0x5555,0x3333,0x5555,0x3333]);
  for(const c of [1,3,5,7])assert.deepStrictEqual(words(s,c),[0x3c45+(c-1)/2,0x3e80]);
  // Top 62 overlaps the required blank line and is omitted. Top 63 resumes at the last rejected pair, 6.
  assert.deepStrictEqual(words(s,6,3,4),[0x3f46,0x4100,0x5555,0x3333]);
  assert.deepStrictEqual(words(s,7,3),[0x3f46,0x4180]);
  assert.deepStrictEqual(words(s,2,3),[0,0]);
});
test('Computed sprites: pointer/direct reservations, even attached pairs and partial wide allocation share one pool',()=>{
  const b=pool(),wide=image(15,176,124,48,10);
  b.update(new Map([[15,wide]]));let s=b.snapshot();
  assert.deepStrictEqual(words(s,0),[0,0]);
  for(const [c,x]of [[2,88],[4,96],[6,104]])assert.deepStrictEqual(words(s,c),[0x7c00+x,0x8600]);
  // A direct attached object at odd channel 3 reserves 3,4,5. Only
  // pair 6 remains for the wide object; native packing keeps its first strip.
  b.update(new Map([[15,wide],[3,image(3,220,80)]]));s=b.snapshot();
  assert.deepStrictEqual(words(s,3),[0,0]);assert.deepStrictEqual(words(s,4),[0x506e,0x5200]);
  assert.deepStrictEqual(words(s,6),[0x7c58,0x8600]);assert.deepStrictEqual(words(s,2),[0,0]);
  b.setPointerVisible(false);s=b.snapshot();assert.deepStrictEqual(words(s,0),[0x7c58,0x8600]);
});
test('Wide direct sprites: 16-pixel strips advance packed horizontal controls, consume pairs and truncate at channel 7',()=>{
  const b=pool();b.setPointerVisible(false);b.update(new Map([[1,image(1,176,124,48,10)]]));const s=b.snapshot();
  assert.deepStrictEqual(words(s,1),[0,0]);
  for(const [c,x]of [[2,88],[4,96],[6,104]]){assert.deepStrictEqual(words(s,c),[0x7c00+x,0x8600]);assert.deepStrictEqual(words(s,c+1),[0x7c00+x,0x8680]);}
  b.update(new Map([[6,image(6,176,124,48,10)]]));assert.deepStrictEqual(words(b.snapshot(),6),[0x7c58,0x8600]);assert.deepStrictEqual(words(b.snapshot(),0),[0,0]);
});
test('Computed sprites: cumulative capacity is strict and failed allocation leaves no partial record or cross-column writes',()=>{
  const b=pool();b.resize(16);b.setPointerVisible(false);
  const frames=Array.from({length:16},(_,i)=>image(8+i,138,60+Math.floor(i/4)*8,16,7));
  b.update(new Map(frames.map(f=>[f.number,f])));const s=b.snapshot();
  // Two 8-long records would equal PMax=16, so only the first fits.
  for(let c=0;c<8;c++){assert.strictEqual(words(s,c)[0],0x3c45);assert.deepStrictEqual(words(s,c,8),[0,0]);}
  const before=b.snapshot();assert.throws(()=>b.update(new Map([[15,{...image(15,0,0),width:17}]])),/Invalid direct Sprite/);assert.deepStrictEqual(b.snapshot(),before);
  b.resize(17);b.update(new Map(frames.map(f=>[f.number,f])));assert.deepStrictEqual(words(b.snapshot(),0,8),[0x4445,0x4b00]);
});
test('Computed sprites: shallow images use single channels and low two planes; published rows decode every multiplexed record',()=>{
  const b=pool();b.setPointerVisible(false);const frames=Array.from({length:16},(_,i)=>image(8+i,138+i,60+Math.floor(i/8)*3,16,2,3));b.update(new Map(frames.map(f=>[f.number,f])));
  const frame={origin:{x:128,y:50},samplesPerLowresPixel:1,lines:20,lineSprites:new Uint32Array(20*32),lineRegs:new Uint32Array(20*32)};b.publish(frame);
  for(let c=0;c<8;c++)for(const row of [10,11,13,14]){assert.strictEqual(frame.lineSprites[row*32+c*4+1],0x5555);assert.strictEqual(frame.lineSprites[row*32+c*4+2],0x3333);assert.strictEqual(frame.lineSprites[row*32+c*4+3],0x80000000);}
  for(let c=0;c<8;c++)assert.strictEqual(frame.lineSprites[12*32+c*4+3],0);
});
test('Computed Sprite AMAL: captured ownership, manual publication, Off/resize and exported snapshots retain their lifecycle',()=>{
  const {program:p}=execute(attached.source([...attached.palette,[t('Synchro Off')],[t('Update Off')],[t('Wait Key')]]));p.hideOn();p.setSprite(15,138,60,1);p.setChannel(15,'sprite',()=>15);p.installAmal(15,'Let X=X+4;Pause;Let Y=Y+4;End');p.amalOn();p.update();const old=p.display.snapshotDisplay(),before=p.spriteBufferSnapshot().bytes;
  p.synchro();assert.strictEqual(p.spriteInfo('X Sprite',15),142);assert.deepStrictEqual(p.spriteBufferSnapshot().bytes,before);p.update();assert.notDeepStrictEqual(p.spriteBufferSnapshot().bytes,before);assert.ok(old.frame.lineSprites.some(Boolean));
  p.setSprite(15,150,null,null);p.synchro();assert.strictEqual(p.spriteInfo('Y Sprite',15),64);p.spriteOff(15);assert.strictEqual(p.amalSnapshot().length,0);p.update();assert.ok(!p.display.snapshotDisplay().frame.lineSprites.some((v,i)=>i%4===3&&v));p.installAmal(15,'Pause');p.setSpriteBuffer(48);assert.strictEqual(p.amalSnapshot().length,0);p.stop();
});

const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {compile}=require('./helpers/program'),oracle=require('./fixtures/planet-zybex/computed-sprites.json');
test('Planet Zybex computed ship: original Sprite 15 and all 13 ship images, row reuse, contention and mouse reservations match independent PAL/NTSC pixels',()=>{
  for(const standard of ['PAL','NTSC']){
    const c=require('./helpers/fakeTimers').createFakeTimers(),{create}=compile(require('./helpers/planetZybexSprites')());
    const p=create({displayOptions:{snapshotStandard:standard},now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,files:{read:name=>fs.readFileSync(path.join(__dirname,'../examples/PlanetZybex',name),'latin1')}});p.tick(10000);
    for(const expected of oracle.frames){
      if(expected.stage){p.sendKey('next');c.tick(0);}
      assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.state.variables.int_stage,expected.stage);
      assert.strictEqual(crypto.createHash('sha256').update(p.display.canvasFrame().rgba).digest('hex'),expected.rgbaSha256,standard+' stage '+expected.stage);
    }
    assert.strictEqual(p.amalSnapshot().length,0);p.stop();assert.strictEqual(c.pending(),0);
  }
});
