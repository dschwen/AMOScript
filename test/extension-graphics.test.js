'use strict';
const assert=require('assert'),vm=require('vm'),T=require('../lib/Transpiler');
const fixture=require('./helpers/extensionGraphicsProgram'),{createFakeTimers}=require('./helpers/fakeTimers');
function setup(){const f=fixture(),sandbox={module:{exports:{}}};vm.runInNewContext(new T(f.bytes,{extensions:{12:'turbo-plus-2.15'}}).toModule(),sandbox);const timers=createFakeTimers(),p=sandbox.module.exports({...timers,now:timers.now});return{p,frames:f.frames};}
test('Extension graphics: six independent bit matrices retain separate graphics/block masks, padded transparency and logical/physical owners',()=>{
  const {p,frames}=setup();try{for(let i=0;i<frames.length;i++){if(i)p.sendKey('next');p.tick(1000);const s=p.display.screen();assert.deepStrictEqual(Array.from(s.pixels),frames[i].logical,'logical frame '+i);assert.deepStrictEqual(Array.from(s.physicalPixels),frames[i].physical,'physical frame '+i);assert.strictEqual(p.state.waiting,'key');}}finally{p.stop();}
});
test('Turbo fast pixels: no cursor/ink/clip/plane-mask side effects; bounds precede drawing hooks and negative colours reject',()=>{
  const {p}=setup();try{p.tick(1000);const d=p.display,s=d.screen();d.ink(3);s.gx=9;s.gy=10;d.setGraphicsPlanes(0);d.clip(0,0,1,1);let before=0,after=0;d.setDrawingHooks({before(){before++;},after(){after++;}});d.doubleBuffer();
    p.extensionFastPlot(20,20,95);assert.strictEqual(p.extensionFastPoint(20,20),31);assert.strictEqual(s.physicalPixels[20*160+20],31);assert.deepStrictEqual([s.gx,s.gy,s.ink],[9,10,3]);assert.deepStrictEqual([before,after],[1,1]);
    p.extensionFastPlot(-1,20,1);assert.strictEqual(p.extensionFastPoint(160,0),-1);assert.deepStrictEqual([before,after],[1,1]);
    assert.throws(()=>p.extensionFastPlot(0,0,-1),/nonnegative/);assert.throws(()=>p.extensionFastPoint(65536,0),/signed-word/);
    d.open(1,302,96,64,0);assert.throws(()=>p.extensionFastPlot(0,0,1),/word-aligned/);
  }finally{p.stop();}
});
test('Graphics plane masks: screen-local reset and selection, zero mask, line/pixel writers and window text independence',()=>{
  const {p}=setup();try{p.tick(1000);const d=p.display;d.setGraphicsPlanes(0);d.ink(63);d.plot(1,1);assert.strictEqual(d.point(1,1),0);d.clearRect(7,10,10,11,11);assert.strictEqual(d.point(10,10),7);d.locate(0,2);d.pen(3);d.write('A');assert.ok(d.screen().pixels.slice(16*160,24*160).some(value=>value!==0));d.open(1,160,96,64,0);d.clear(0);d.ink(31);d.plot(1,1);assert.strictEqual(d.point(1,1),31);d.select(0);assert.strictEqual(d.screen().graphicsPlaneMask,0);d.setGraphicsPlanes(32);d.ink(63);d.draw(0,1,3,1);for(let x=0;x<4;x++)assert.strictEqual(d.point(x,1),32);d.open(0,160,96,64,0);assert.strictEqual(d.screen().graphicsPlaneMask,255);
  }finally{p.stop();}
});
test('Masked blocks: failed recapture preserves snapshot; non-word widths pad to zero and raw Put Block avoids drawing hooks',()=>{
  const {p}=setup();try{p.tick(1000);const d=p.display;d.clear(0);d.fastPlot(0,0,3);p.getBlock(9,0,0,1,1,1);assert.throws(()=>p.getBlock(9,159,0,2,1,1),/rectangle/);d.clear(32);let hooks=0;d.doubleBuffer();d.setDrawingHooks({before(){hooks++;},after(){hooks++;}});p.putBlock(9,16,0,31);assert.strictEqual(d.point(16,0),35);for(let x=17;x<32;x++)assert.strictEqual(d.point(x,0),32);assert.strictEqual(d.screen().physicalPixels[16],32);assert.strictEqual(hooks,0);p.putBlock(9,32,0,-2147483648);assert.strictEqual(d.point(32,0),3);assert.throws(()=>p.putBlock(9,65536,0,31),/signed-word/);assert.strictEqual(d.point(16,0),35);
  }finally{p.stop();}
});
test('Graphics plane masks: flood fill and polygon interiors preserve unselected planes and zero-mask fills terminate',()=>{
  const {p}=setup();try{p.tick(1000);const d=p.display;d.clear(1);d.setGraphicsPlanes(32);d.ink(63);d.paint(0,0);assert.ok(d.screen().pixels.every(value=>value===33));d.setGraphicsPlanes(0);d.ink(0);d.paint(0,0);assert.ok(d.screen().pixels.every(value=>value===33));d.setGraphicsPlanes(16);d.ink(63);d.polygon([[2,2],[6,2],[6,6],[2,6]]);assert.strictEqual(d.point(4,4),49);assert.strictEqual(d.point(2,2),49);assert.strictEqual(d.point(0,0),33);
  }finally{p.stop();}
});
test('Turbo F Point token: nested typed expression reads logical pixels with its own two-argument signature',()=>{
  const {binary,token:t,integer:n,word:w,identifier:id}=require('./helpers/tokens'),bytes=binary([[w(0x4e),[12,0],w(0x036e),n(8),t(','),n(8),t(','),n(95)],[id('value'),t('='),[w(0x4e),[12,0],w(0x044c)],t('('),n(8),t(','),n(8),t(')')],[t('Wait Key')]]),s={module:{exports:{}}};vm.runInNewContext(new T(bytes,{extensions:{12:'turbo-plus-2.15'}}).toModule(),s);const timer=createFakeTimers(),p=s.module.exports({...timer,now:timer.now});try{p.tick(100);assert.strictEqual(p.state.variables.int_value,15);}finally{p.stop();}
});
