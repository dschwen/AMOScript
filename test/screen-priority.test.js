/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),createDisplay=require('../lib/amos/display');
const {binary,token:t,integer:n,word:w,execute}=require('./helpers/program');

test('screen priority: both original token forms preserve logical selection and standalone execution',()=>{
  const {program:p,timers}=execute(binary([[t('Screen Open'),n(1),t(','),n(320),t(','),n(200),t(','),n(16),t(','),t('Lowres')],
    [t('Screen'),n(0)],[w(0xa88),n(1)],[t('Wait Key')],[w(0xa72)],[t('Wait Key')]]));
  assert.strictEqual(p.display.current,0);assert.strictEqual(p.display.presentedScreen().id,1);
  p.sendKey('next');timers.tick(4);assert.strictEqual(p.display.presentedScreen().id,0);
  assert.throws(()=>execute(binary([[w(0xa88),n(7)]])),/not open.*line 1/);
});

test('screen priority: native slice setup blanks real rows, restores source offsets and all palette registers',()=>{
  const d=createDisplay();d.open(0,320,250,64,0);const back=d.screen();
  back.pixels.forEach((_,i)=>{back.pixels[i]=(Math.floor(i/320)%31)+1;});
  back.palette=Array.from({length:32},(_,i)=>i?i*0x11:0);
  d.open(1,320,32,64,0);const front=d.screen();front.pixels.fill(31);front.palette=Array.from({length:32},(_,i)=>i?0xf00+i:0);
  d.screenDisplay(1,128,140,320,32);d.screenToFront(1);d.select(0);
  const snapshot=d.snapshotDisplay(),rgba=d.canvasFrame().rgba;
  assert.strictEqual(snapshot.frame.eventOffsets[250],0);assert.strictEqual(snapshot.frame.overflowEvents.length,0);
  for(let y=0;y<250;y++){
    const blank=y===89||y===122,foreground=y>=90&&y<122;
    const index=foreground?31:back.pixels[y*320],rgb=blank?0:(foreground?front:back).palette[index];
    const expected=[(rgb>>8)*17,((rgb>>4)&15)*17,(rgb&15)*17,255];
    for(const x of [0,17,319])assert.deepStrictEqual(Array.from(rgba.slice((y*320+x)*4,(y*320+x)*4+4)),expected,`row ${y}`);
    assert.strictEqual(!!(snapshot.frame.lineRegs[y*32+16]&2),!blank);
  }
  d.hideScreen(1);assert.strictEqual(d.canvasFrame().rgba[89*320*4+1],((back.palette[back.pixels[89*320]]>>4)&15)*17);
  d.showScreen(1);assert.strictEqual(d.canvasFrame().rgba[89*320*4],0);
  assert.strictEqual(d.snapshotPlayfield(0).frame.lines,250);
});

test('screen priority: Auto View stages priority, visibility and ownership across replacement',()=>{
  const d=createDisplay();d.open(0,320,250,16,0);d.clear(2);d.open(1,320,32,16,0);d.clear(3);d.screenDisplay(1,128,140,320,32);d.screenToFront(1);
  const before=d.canvasFrame();d.autoViewOff();d.screenToFront(0);d.hideScreen(1);
  assert.deepStrictEqual(d.canvasFrame().rgba,before.rgba);d.view();assert.strictEqual(d.presentedScreen().id,0);
  d.showScreen(1);d.screenToFront(1);assert.strictEqual(d.presentedScreen().id,0);d.view();assert.strictEqual(d.presentedScreen().id,1);
  const retained=d.canvasFrame();d.open(1,320,32,16,0);d.clear(4);d.screenDisplay(1,128,140,320,32);
  assert.deepStrictEqual(d.canvasFrame().rgba,retained.rgba);d.close(1);assert.deepStrictEqual(d.canvasFrame().rgba,retained.rgba);
  d.autoViewOn();assert.strictEqual(d.presentedScreen().id,0);assert.strictEqual(d.canvasFrame().height,250);
  assert.deepStrictEqual(d.pointerHardwarePosition(160,125,320,250),[288,175]);
});

test('screen priority: bounded unsupported forms fail without CPU compositing',()=>{
  const d=createDisplay();d.open(0,320,250,16,0);d.open(1,320,32,16,0);d.screenDisplay(1,128,140,320,32);d.screenToFront(1);
  d.screenOffset(1,1,0);assert.throws(()=>d.snapshotDisplay(),/outside physical bitmap/);d.screenOffset(1,0,0);
  d.screenDisplay(1,128,140,160,32);assert.strictEqual(d.snapshotDisplay().frame.outputWidth,640);
  d.open(1,320,32,16,0x8000);d.screenDisplay(1,128,140,160,32);assert.throws(()=>d.snapshotDisplay(),/lowres/);
});

test('screen priority: the first explicit command retains prior open and replacement order',()=>{
  const d=createDisplay();d.open(1,320,200,16,0);d.open(2,320,200,16,0);d.open(1,320,200,16,0);
  d.screenToFront(0);d.hideScreen(0);assert.strictEqual(d.presentedScreen().id,1);
  d.hideScreen(1);assert.strictEqual(d.presentedScreen().id,2);
  d.showScreen(0);d.screenToFront(2);d.close(2);d.showScreen(1);assert.strictEqual(d.presentedScreen().id,0);
});


test('screen priority: per-owner COLOR00 colours zero pixels and setup rows before capture, including restoration after an overlap',()=>{
  const d=createDisplay();d.open(0,320,250,16,0);d.clear(0);d.setColour(0,0x123);
  d.open(1,320,32,16,0);d.clear(0);d.setColour(0,0xabc);d.screenDisplay(1,128,140,320,32);d.screenToFront(1);
  const snapshot=d.snapshotDisplay(),frame=d.canvasFrame();
  for(let y=0;y<250;y++){
    const front=y>=89&&y<122,rgb=front?[170,187,204,255]:[17,34,51,255];
    for(const x of [0,100,319])assert.deepStrictEqual(Array.from(frame.rgba.slice((y*320+x)*4,(y*320+x)*4+4)),rgb,`row ${y}`);
  }
  assert.strictEqual(snapshot.frame.overflowEvents.length,0);
  for(const y of [89,122])assert.strictEqual(snapshot.frame.lineRegs[y*32+16]&2,0);
  d.hideScreen(1);assert.deepStrictEqual(Array.from(d.canvasFrame().rgba.slice(89*1280,89*1280+4)),[17,34,51,255]);
});
