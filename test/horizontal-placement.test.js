'use strict';
const assert=require('assert'),createDisplay=require('../lib/amos/display');
const {compile}=require('./helpers/program'),{createFakeTimers}=require('./helpers/fakeTimers');
const colour=v=>[(v>>8)*17,((v>>4)&15)*17,(v&15)*17,255];

test('horizontal windows: rounded placement, fetch origin, fine offsets and right clipping preserve source pixels in lowres/hires',()=>{
  for(const hires of [false,true])for(const requestedX of [96,143,180,240])for(const offset of [0,1,15,16,31]){
    const d=createDisplay();d.open(0,768,64,4,hires?0x8000:0);const s=d.screen(),x=requestedX&0xfff0;
    s.palette=[0x123,0xf00,0x0f0,0x00f,...Array(28).fill(0)];
    for(let y=0;y<64;y++)for(let sx=0;sx<768;sx++)s.pixels[y*768+sx]=(sx^(sx>>3)^(sx>>5)^y*3)&3;
    d.doubleBuffer();s.pixels.fill(0);d.screenDisplay(0,requestedX,50,320,32);d.screenOffset(0,offset,3);
    const snapshot=d.snapshotDisplay(),end=Math.min(hires?448:454,x+320),width=(end-x)*2,sourceOffset=hires?offset&~1:offset,rgba=d.renderDisplay(),canvas=d.canvasFrame();
    assert.deepStrictEqual([snapshot.frame.origin.x,snapshot.frame.outputWidth,snapshot.frame.lines],[x,width,32]);
    assert.strictEqual(s.hardwareX,x);assert.strictEqual(s.windowWidth,hires?640:320);assert(s.pixels.every(v=>v===0));
    for(const row of [0,1,31])for(let px=0;px<width;px++){
      const sx=sourceOffset+Math.floor(px/(hires?1:2)),index=(sx^(sx>>3)^(sx>>5)^(row+3)*3)&3,at=(row*width+px)*4;
      assert.deepStrictEqual(Array.from(rgba.slice(at,at+4)),colour(s.palette[index]));
    }
    assert.strictEqual(canvas.width,hires?width:width/2);assert.strictEqual(canvas.height,32);
    assert.deepStrictEqual(d.pointerHardwarePosition(0,0,canvas.width,32),[x,50]);assert.deepStrictEqual(d.pointerPosition(0,0,canvas.width,32),[sourceOffset,3]);
    assert.deepStrictEqual(d.pointerPosition(canvas.width-1,31,canvas.width,32),[sourceOffset+canvas.width-1,34]);
    const saved=Buffer.from(canvas.rgba);d.autoViewOff();d.screenDisplay(0,128,60);assert.deepStrictEqual(Buffer.from(d.canvasFrame().rgba),saved);
  }
});

test('horizontal windows: different-width shifted screens compose priority slices and newly opened default windows',()=>{
  const d=createDisplay();d.open(0,512,200,4,0);d.clear(1);d.setColour(0,0);d.setColour(1,0xf00);d.screenDisplay(0,160,50,256,100);
  d.open(1,320,32,4,0);d.clear(1);d.setColour(0,0);d.setColour(1,0x0f0);d.select(0);
  const c=d.canvasFrame();assert.deepStrictEqual([c.width,c.height],[320,100]);
  for(let y=0;y<100;y++)for(let x=0;x<320;x++){
    const rgb=y<32?0x0f0:y===32?0:x>=32&&x<288?0xf00:0;
    assert.deepStrictEqual(Array.from(c.rgba.slice((y*320+x)*4,(y*320+x)*4+4)),colour(rgb));
  }
  assert.deepStrictEqual(d.pointerPosition(0,0,320,100),[-32,0]);d.hideScreen(1);assert.strictEqual(d.canvasFrame().width,256);assert.deepStrictEqual(d.pointerPosition(0,0,256,100),[0,0]);
});

test('horizontal windows: rejected hardware ranges leave committed geometry and buffer identity untouched',()=>{
  const d=createDisplay(),s=d.screen(),before=d.canvasFrame();for(const x of [-1,0,80,256,512])assert.throws(()=>d.screenDisplay(0,x,50),/horizontal placement/);
  assert.strictEqual(d.screen(),s);assert.strictEqual(s.hardwareX,128);assert.deepStrictEqual(d.canvasFrame(),before);
});

test('horizontal windows: unchanged Fractal3 completes and Plasma reaches animated offset/palette loop with its report window',()=>{
  const fs=require('fs');for(const name of ['Fractal3','Plasma']){
    const clock=createFakeTimers(),p=compile(fs.readFileSync(`${__dirname}/../examples/CompilerExamples/${name}.AMOS`)).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){}});
    try{p.tick(1000);clock.tick(80);assert.strictEqual(p.state.halted,false);assert.strictEqual(p.state.location.line,name==='Fractal3'?54:109);p.display.snapshotDisplay();assert.strictEqual(p.display.screen(0).hardwareX,name==='Fractal3'?176:160);
      if(name==='Plasma'){assert.strictEqual(p.display.canvasFrame().width,320);assert(p.display.screen(0).offsetX>0);assert.strictEqual(p.display.screen(1).windowed,true);}
      p.sendKey('a');clock.tick(20);assert.strictEqual(p.state.halted,true);assert.strictEqual(clock.pending(),0);
    }finally{p.stop();}
  }
});
