'use strict';
const assert=require('assert'),vm=require('vm'),fs=require('fs'),path=require('path'),create=require('../lib/amos/amcafMath'),oracle=require('./fixtures/amcaf/math.json');
const{binary,token:t,word:w,integer:n,identifier:id}=require('./helpers/program'),{createFakeTimers}=require('./helpers/fakeTimers');
function compile(bytes,options){const m={exports:{}};vm.runInNewContext(new(require('../lib/Transpiler'))(bytes,options).toModule(),{module:m});return{create:m.exports};}
test('AMCAF quick maths: literal tables and source arithmetic match independent boundary/quadrant vectors',()=>{
  for(const p of [create(),vm.runInNewContext(`(${create.toString()})()`)]){
    for(const[a,r,s,c]of oracle.trig){assert.strictEqual(p.sin(a,r),s);assert.strictEqual(p.cos(a,r),c);}
    for(const[v,r]of oracle.sqrt)assert.strictEqual(p.sqr(v),r);
    for(const[x,y,a]of oracle.arc)assert.strictEqual(p.arc(x,y),a);
    for(const value of [NaN,Infinity,1.5,2147483648]){assert.throws(()=>p.sqr(value),/signed long/);assert.throws(()=>p.sin(value,1),/signed long/);}
    assert.strictEqual(p.cos(2147483647,1),p.sin((2147483647+256)|0,1));
    assert.throws(()=>p.sqr(-1),/nonnegative/);assert.throws(()=>p.arc(32768,0),/signed-word/);
  }
});
test('AMCAF quick maths: original complete example runs unchanged through three directions and its own Escape exit',()=>{
  const bytes=fs.readFileSync(path.join(__dirname,'../examples/AMCAF/AMCAF_Examples/QsinCosArcSqr.AMOS'));
  const clock=createFakeTimers(),p=compile(bytes,{extensions:{8:'amcaf-1.50beta4'}}).create({...clock});
  try{p.tick(1000);for(const[x,y,arc,rad]of [[230,128,0,70],[160,198,256,70],[90,128,512,70]]){
    p.setMouse(128+x,50+y);clock.tick(40);assert.strictEqual(p.state.variables.int_arc,arc);assert.strictEqual(p.state.variables.int_rad,rad);assert.strictEqual(p.state.waiting,'sleep');
    const s=p.display.screen(0);assert.strictEqual(s.physicalPixels[128*320+160],1);
  }p.sendKey('\x1b');clock.tick(20);assert.strictEqual(p.state.halted,true);assert.strictEqual(p.display.screens.size,0);assert.strictEqual(clock.pending(),0);}finally{p.stop();}
});
test('AMCAF Blitter Clear: full/word-rounded rectangle clears selected logical planes without cursor, mask or buffer side effects',()=>{
  const ext=off=>[w(0x4e),[8,0],w(off)],clock=createFakeTimers();
  const p=compile(binary([[t('Wait Key')]]),{extensions:{8:'amcaf-1.50beta4'}}).create({...clock});
  try{const d=p.display,s=d.open(2,64,8,8,0);s.pixels.fill(7);d.doubleBuffer();s.physicalPixels.fill(3);s.x=2;s.y=1;s.gx=5;s.gy=6;d.setGraphicsPlanes(0);
    p.extensionBlitterClear(2,1,17,1,33,3);
    for(let y=0;y<8;y++)for(let x=0;x<64;x++)assert.strictEqual(s.pixels[y*64+x],y>=1&&y<3&&x>=16&&x<48?5:7);
    assert(s.physicalPixels.every(v=>v===3));assert.deepStrictEqual([s.x,s.y,s.gx,s.gy,s.graphicsPlaneMask],[2,1,5,6,0]);
    const before=s.pixels.slice();assert.throws(()=>p.extensionBlitterClear(2,3),/bitplane/);assert.throws(()=>p.extensionBlitterClear(2,1,-1,0,16,1),/bounded/);assert.deepStrictEqual(s.pixels,before);
    p.extensionBlitterClear(2,0);assert(s.pixels.every(v=>(v&1)===0));
    const module=compile(binary([[ext(0x1234),n(2),t(','),n(0),t(','),n(0),t(','),n(0),t('To'),n(16),t(','),n(2)]]),{extensions:{8:'amcaf-1.50beta4'}});assert(module.create);
  }finally{p.stop();}
});
