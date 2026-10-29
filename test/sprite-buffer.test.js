'use strict';
const assert=require('assert');
const {binary,token:t,word:w,integer:n,text,compile,execute}=require('./helpers/program');
const attached=require('./helpers/attachedSprite'),makePool=require('../lib/amos/spriteBuffer');
const idle=()=>execute(attached.source([...attached.palette,[t('Wait Key')]]));

test('Sprite buffer: native allocation formulas, initial profile, bounded validation and equal-size identity are explicit',()=>{
  const b=makePool();assert.deepStrictEqual(b.layout(),{rows:128,lineLimit:126,columnBytes:512,frameBytes:4096,allocationBytes:12288,physical:0,logic:1,inter:2,generation:1});
  assert.strictEqual(b.resize(126),false);assert.strictEqual(b.resize(48),true);assert.deepStrictEqual(b.layout(),{rows:50,lineLimit:48,columnBytes:200,frameBytes:1600,allocationBytes:4800,physical:0,logic:1,inter:2,generation:2});
  const before=b.snapshot();for(const n of [-1,0,15,4095,65535,65584,1.5,NaN]){assert.throws(()=>b.resize(n),/Set Sprite Buffer/);assert.deepStrictEqual(b.snapshot(),before);}assert.strictEqual(b.resize(48),false);assert.deepStrictEqual(b.snapshot(),before);
  b.resize(4094);assert.strictEqual(b.layout().allocationBytes,393216);
});

test('Sprite buffer: physical stream control/data words match independent big-endian attached rows and rotate through all three owned slots',()=>{
  const {program:p}=idle();p.setSpriteBuffer(48);p.hideOn();p.setSprite(1,139,61,1);p.updateSprites();const s=p.spriteBufferSnapshot();
  assert.strictEqual(s.physical,1);assert.strictEqual(Buffer.from(s.bytes.subarray(2000,2016)).toString('hex'),'3d453f0155553333aaaacccc00000000');assert.strictEqual(Buffer.from(s.bytes.subarray(2200,2216)).toString('hex'),'3d453f810f0f00fff0f0ff0000000000');assert.ok(s.bytes.subarray(0,1600).every(v=>v===0));
  const old=p.display.snapshotDisplay(),rows=old.frame.lineSprites.slice();assert.strictEqual(rows[(61-50)*32+2*4+1],0x5555);assert.strictEqual(rows[(61-50)*32+3*4+2],0x00ff);
  s.bytes.fill(0);assert.deepStrictEqual(p.display.snapshotDisplay().frame.lineSprites,rows);
  p.updateSprites();assert.strictEqual(p.state.spriteBuffer.physical,2);p.updateSprites();assert.strictEqual(p.state.spriteBuffer.physical,0);assert.strictEqual(p.state.spriteBuffer.generation,2);assert.deepStrictEqual(old.frame.lineSprites,rows);p.stop();
});

test('Set Sprite Buffer: same allocation preserves logical/presented/pending sprites, mouse nesting/shape and display revision; resize clears assignments immediately',()=>{
  const {program:p}=idle();p.setSpriteBuffer(48);p.changeMouse(2);p.hide();p.hide();p.setSprite(1,138,60,1);p.updateSprites();const shown=p.display.snapshotDisplay(),pool=p.state.spriteBuffer,bytes=p.spriteBufferSnapshot().bytes,revision=p.display.version;
  p.setSprite(1,148,60,1);const pending=p.spriteInfo('X Sprite',1);p.setSpriteBuffer(48);assert.strictEqual(p.state.spriteBuffer,pool);assert.strictEqual(p.display.version,revision);assert.deepStrictEqual(p.spriteBufferSnapshot().bytes,bytes);assert.strictEqual(p.spriteInfo('X Sprite',1),pending);assert.strictEqual(p.mouseVisible(),false);p.show();assert.strictEqual(p.mouseVisible(),false);assert.strictEqual(p.mouseShape(),2);
  p.setSpriteBuffer(64);assert.strictEqual(p.mouseVisible(),true);assert.strictEqual(p.mouseShape(),2);assert.strictEqual(p.spriteInfo('I Sprite',1),0);assert.deepStrictEqual([p.spriteInfo('X Sprite',1),p.spriteInfo('Y Sprite',1)],[148,60]);assert.ok(!p.display.snapshotDisplay().frame.lineSprites.some((v,i)=>i%4===3&&v));assert.ok(shown.frame.lineSprites.some((v,i)=>i%4===3&&v));p.stop();
});

test('Set Sprite Buffer: rejected sizes retain complete presentation and memory; original token accepts numeric conversion and source errors',()=>{
  const {program:p}=idle();p.setSpriteBuffer(48);p.hideOn();p.setSprite(1,138,60,1);p.updateSprites();const before=p.spriteBufferSnapshot(),frame=p.display.renderDisplay();
  for(const n of [15,-1,4095,65535]){assert.throws(()=>p.setSpriteBuffer(n),/Set Sprite Buffer/);assert.deepStrictEqual(p.spriteBufferSnapshot(),before);assert.deepStrictEqual(p.display.renderDisplay(),frame);}p.stop();
  const q=execute(binary([[w(0x1986),t('Val'),t('('),text('48.9'),t(')')],[t('Wait Key')]])).program;assert.strictEqual(q.state.spriteBuffer.lineLimit,48);q.stop();
  assert.throws(()=>execute(binary([[w(0x1986),n(15)]])),/Set Sprite Buffer.*line 1/);assert.throws(()=>compile(binary([[t('Set Sprite Buffer'),text('48')]])),/numeric/);
});

test('Sprite buffer: direct height admission follows HsDm strict capacity comparison and retains an old image/position on rejection',()=>{
  const {program:p}=execute(binary([[t('Wait Key')]]));p.setSpriteBuffer(48);p.display.clear(2);p.getBob(1,0,0,16,46);p.getBob(2,0,0,16,47);p.hideOn();p.setSprite(1,138,60,1);p.updateSprites();const frame=p.display.snapshotDisplay().frame.lineSprites.slice();
  p.setSprite(1,168,80,2);p.updateSprites();assert.strictEqual(p.spriteInfo('I Sprite',1),2);assert.deepStrictEqual(p.display.snapshotDisplay().frame.lineSprites,frame);p.setSpriteBuffer(49);p.hideOn();p.setSprite(1,168,80,2);p.updateSprites();assert.ok(p.display.snapshotDisplay().frame.lineSprites.some((v,i)=>i%4===3&&v));
  p.setSpriteBuffer(48);p.hideOn();p.setSprite(1,138,60,2);p.updateSprites();assert.ok(!p.display.snapshotDisplay().frame.lineSprites.some((v,i)=>i%4===3&&v));p.stop();
});

test('Sprite buffer: resize works without a screen; Default restores allocation while preserving bank addresses and already exported snapshots',()=>{
  const {program:p}=idle();p.reserveWork(6,16);const bank=p.banks.get(6),base=p.bankStart(6);p.setSpriteBuffer(48);const gen=p.state.spriteBuffer.generation;p.display.close(0);p.setSpriteBuffer(64);assert.strictEqual(p.state.spriteBuffer.rows,66);p.resetDefault();assert.strictEqual(p.state.spriteBuffer.rows,130);assert.ok(p.state.spriteBuffer.generation>gen);assert.strictEqual(p.banks.get(6),bank);assert.strictEqual(p.bankStart(6),base);const current=p.state.spriteBuffer.generation;p.resetDefault();assert.strictEqual(p.state.spriteBuffer.generation,current);p.stop();
  const {program:q,timers:c}=execute(require('./helpers/planetZybexDefault')());q.sendKey('advance');c.tick(0);assert.strictEqual(q.display.screens.size,0);assert.strictEqual(q.state.spriteBuffer.allocationBytes,4800);assert.strictEqual(q.state.spriteBuffer.lineLimit,48);assert.strictEqual(c.pending(),0);q.stop();
});
