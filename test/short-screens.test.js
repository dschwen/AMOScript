'use strict';
const assert=require('assert'),fs=require('fs'),createDisplay=require('../lib/amos/display');
const {compile}=require('./helpers/program'),{createFakeTimers}=require('./helpers/fakeTimers');

test('short screens: default PAL/NTSC bitmaps use bounded real DMA without changing logical geometry or physical buffers',()=>{
  for(const standard of ['PAL','NTSC'])for(const height of [1,8,32,77,78,79]) {
    const d=createDisplay({snapshotStandard:standard});d.open(0,320,height,4,0);
    const s=d.screen();s.palette[0]=0x123;s.palette[1]=0xf00;s.palette[2]=0x0f0;s.palette[3]=0x00f;
    for(let y=0;y<height;y++)for(let x=0;x<320;x++)s.pixels[y*320+x]=((x>>4)+y)&3;
    d.doubleBuffer();s.pixels.fill(3);const physical=s.physicalPixels,logical=s.pixels;
    const snapshot=d.snapshotDisplay(),canvas=d.canvasFrame(),hardware=d.renderDisplay();
    assert.deepStrictEqual([snapshot.frame.outputWidth,snapshot.frame.lines,canvas.width,canvas.height],[640,height,320,height]);
    assert.strictEqual(s.width,320);assert.strictEqual(s.height,height);assert.strictEqual(s.hardwareY,50);assert.strictEqual(s.windowed,false);assert.strictEqual(s.pixels,logical);assert.strictEqual(s.physicalPixels,physical);
    for(let y=0;y<height;y++)for(let x=0;x<320;x++) {
      const rgb=s.palette[((x>>4)+y)&3],expected=[(rgb>>8)*17,((rgb>>4)&15)*17,(rgb&15)*17,255];
      assert.deepStrictEqual(Array.from(canvas.rgba.slice((y*320+x)*4,(y*320+x)*4+4)),expected);
      assert.deepStrictEqual(Array.from(hardware.slice((y*640+x*2)*4,(y*640+x*2)*4+8)),[...expected,...expected]);
    }
    const extended=d.snapshotDisplay(null,{origin:{x:128,y:40},lines:120});
    for(let y=0;y<120;y++)assert.strictEqual(!!(extended.frame.lineRegs[y*32+16]&2),y>=10&&y<10+height,`${standard} height=${height} row=${y}`);
    assert.deepStrictEqual(d.pointerHardwarePosition(0,0,320,height),[128,50]);
  }
});

test('short screens: unchanged 3Dcube3 renders its reported startup, completes precalculation, all 500 PAL frames and both input prompts',()=>{
  const clock=createFakeTimers(),p=compile(fs.readFileSync(`${__dirname}/../examples/CompilerExamples/3Dcube3.AMOS`)).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){}});
  try {
    p.tick(1000);assert.deepStrictEqual({...p.state.location},{line:95,offset:2984});assert.strictEqual(p.display.snapshotDisplay().frame.lines,32);
    clock.tick(0);assert.strictEqual(p.state.location.line,163);assert.strictEqual(p.display.snapshotDisplay().frame.lines,32);
    p.sendKey('a');clock.tick(20);assert.strictEqual(p.state.location.line,215);assert.strictEqual(p.display.snapshotDisplay().frame.lines,256);
    clock.tick(10000);assert.strictEqual(p.state.location.line,230);assert.strictEqual(p.state.variables.int_n,501);assert.strictEqual(p.state.variables.float_t,500);assert.strictEqual(p.display.snapshotDisplay().frame.lines,256);
    p.sendKey('b');clock.tick(20);assert.strictEqual(p.state.halted,true);assert.strictEqual(clock.pending(),0);
  }finally{p.stop();}
});
