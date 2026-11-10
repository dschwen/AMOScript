'use strict';
const assert=require('assert'),fixture=require('./helpers/interlacedPackedProgram'),{compile}=require('./helpers/program'),clockFactory=require('./helpers/fakeTimers').createFakeTimers,model=require('../lib/display/model/frameState');
function setup(standard='PAL'){const f=fixture(),clock=clockFactory(),p=compile(f.bytes).create({...clock,displayOptions:{snapshotStandard:standard},files:{read:()=>f.bank.toString('latin1')}});p.tick(1000);return{p,f};}
test('Unpack Screen interlace: full atlas storage, two alternating field pointers, PAL/NTSC clipping and exact source strides',()=>{
  for(const standard of ['PAL','NTSC']){const {p}=setup(standard);try{
    const s=p.display.screen(2);assert.deepStrictEqual([s.width,s.height,s.mode,s.hardwareX,s.hardwareY,s.windowHeight],[368,900,4,112,42,900]);
    for(let y=0;y<900;y++)for(let x=0;x<368;x++)assert.strictEqual(s.pixels[y*368+x],((x>>4)+3*y)&7);
    const snap=p.display.snapshotDisplay(),f=snap.frame;model.validateSnapshot(snap);
    assert.strictEqual(f.outputWidth,684);assert.strictEqual(f.lines,(standard==='PAL'?268:218)*2);assert.strictEqual(f.outputHeight,f.lines);
    assert.strictEqual(f.pixelAspect.numerator/f.pixelAspect.denominator,1);
    for(let y=0;y<f.lines;y++)for(let plane=0;plane<3;plane++){
      assert.strictEqual(f.lineRegs[y*32+plane],f.lineRegs[plane]+y*46);
      assert(f.lineRegs[y*32+8]&4);
    }
    const raw=p.display.snapshotPlayfield(2);assert.strictEqual(raw.frame.lines,900);assert.strictEqual(raw.frame.outputWidth,736);
    assert.strictEqual(p.display.snapshotDisplay([2]).frame.lines,f.lines);
    p.display.screenDisplay(2,113,24,368,900);const clipped=p.display.snapshotDisplay().frame;
    assert.strictEqual(clipped.lineRegs[0],f.lineRegs[0]+4*46);assert.strictEqual(clipped.lineRegs[32],clipped.lineRegs[0]+46);
    const old=snap.chip.slice();s.pixels.fill(0);p.display.snapshotDisplay();assert.deepStrictEqual(snap.chip,old);
  }finally{p.stop();}}
});
test('Unpack Screen interlace: odd offsets retain both rows; logical input, zones and hardware scan use field heights',()=>{
  const {p}=setup();try{p.sendKey('next');p.tick(1000);const d=p.display,s=d.screen(2),f=d.snapshotDisplay().frame;
    assert.strictEqual(f.lines,8);assert.strictEqual(f.lineRegs[32]-f.lineRegs[0],46);assert.strictEqual(f.lineRegs[64]-f.lineRegs[0],92);
    assert.deepStrictEqual(Array.from(d.pointerPosition(1,1,640,8)),[16,892]);assert.deepStrictEqual(Array.from(d.pointerHardwarePosition(0,6,640,8)),[128,53]);
    assert.strictEqual(d.coordinate('Y Hard',6),53);assert.strictEqual(d.coordinate('Y Screen',53),897);
    assert.strictEqual(d.screenIn(128,53),2);assert.strictEqual(d.screenIn(128,54),-2147483648);
    d.reserveZones(1);d.setZone(1,16,897,20,898);assert.strictEqual(d.mouseZone(128,53),1);
    s.windowHeight=7;d.view();assert.strictEqual(d.snapshotDisplay().frame.lines,6);
    s.windowHeight=8;s.offsetY=893;d.view();assert.throws(()=>d.snapshotDisplay(),/outside physical bitmap/);
  }finally{p.stop();}
});
test('Interlaced presentation: adjacent progressive screen repeats rows, preserves setup blanks and leaves the weave when lace is hidden or fully covered',()=>{
  const {p}=setup();try{p.sendKey('x');p.tick(1000);p.sendKey('x');p.tick(1000);const d=p.display,f=d.snapshotDisplay().frame;
    assert.strictEqual(f.lines,32);for(let y=8;y<32;y+=2)assert.strictEqual(f.lineRegs[y*32],f.lineRegs[(y+1)*32]);
    for(const y of [6,7])assert.strictEqual(f.lineRegs[y*32+16]&2,0);
    d.screenDisplay(0,128,50,320,12);assert.strictEqual(d.snapshotDisplay().frame.lines,12);assert.strictEqual(d.canvasFrame().width,320);
    d.screenDisplay(0,128,54,320,12);p.sendKey('x');p.tick(1000);assert.strictEqual(d.canvasFrame().height,12);assert.strictEqual(d.canvasFrame().width,320);
  }finally{p.stop();}
});
test('Interlaced Screen Open: hires masks stay independent and rejected packed window replacement is atomic',()=>{
  const {p}=setup();try{const d=p.display,old=d.screen(2);d.open(3,320,8,8,0x8004);d.screenDisplay(3,128,50,160,8);d.hideScreen(2);
    const f=d.snapshotDisplay().frame;assert.strictEqual(f.lines,8);assert.strictEqual(f.outputWidth,320);assert.strictEqual(f.lineRegs[8]&0x8004,0x8004);
    assert.throws(()=>d.open(3,320,8,32,0x8004),/Hires/);
    const data=p.banks.get(6).data;data[12]=1;data[13]=144;assert.throws(()=>p.unpackScreen(6,2),/display window/);assert.strictEqual(d.screen(2),old);
  }finally{p.stop();}
});
