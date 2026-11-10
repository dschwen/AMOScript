'use strict';
const assert=require('assert'),vm=require('vm'),oracle=require('./fixtures/amcaf/blitter.json');
const{binary,token:t,integer:n,text,word:w}=require('./helpers/program');
function create(bytes=binary([[t('Wait Key')]]),options={}){const module={exports:{}};vm.runInNewContext(new(require('../lib/Transpiler'))(bytes,{extensions:{8:'amcaf-1.50beta4'}}).toModule(),{module});return module.exports({...require('./helpers/fakeTimers').createFakeTimers(),...options});}
const flat=rows=>rows.flatMap(r=>[...r].map(c=>parseInt(c,16)));
test('Hex$: both exact token signatures follow native unsigned long/digit-loop vectors including width zero and negative counts',()=>{
 const p=create();try{for(const[v,width,expected]of oracle.hex)assert.strictEqual(p.stringFunction('Hex$2',[v,width]),expected);for(const v of [0,10,255,-1,-2147483648])assert.strictEqual(p.stringFunction('Hex$',[v]),oracle.hex.find(r=>r[0]===v&&r[1]===-1)[2]);}finally{p.stop();}
 const logs=[],q=create(binary([[t('Print'),t('Hex$'),t('('),n(-1),t(')'),t(','),t('Hex$2'),t('('),n(0x1234),t(','),n(2),t(')')],[t('Wait Key')]]),{print:(...a)=>logs.push(a)});try{q.tick(100);assert.deepStrictEqual(logs,[['$FFFFFFFF','$34']]);}finally{q.stop();}
 assert.throws(()=>create(binary([[t('Print'),t('Hex$2'),t('('),text('x'),t(','),n(2),t(')')]])),/argument type/);
});
test('AMCAF blitter: compiled logical writes and Screen Swap match independent pixel matrices without implicit buffer replay',()=>{
 const p=create(require('./helpers/amcafBlitterProgram')());try{for(let f=0;f<oracle.frames.length;f++){if(f)p.sendKey('next');p.tick(1000);const s=p.display.screen(0);assert.deepStrictEqual(Array.from(s.pixels),flat(oracle.frames[f].logical));assert.deepStrictEqual(Array.from(s.physicalPixels),flat(oracle.frames[f].physical));}}finally{p.stop();}
});
test('AMCAF Turbo Draw: all bounded octants, plane masks, native pattern restart and preflight preserve drawing state',()=>{
 const p=create();try{const d=p.display,s=d.open(0,64,64,8,0);s.x=2;s.y=3;s.gx=7;s.gy=9;s.linePhase=5;d.ink(6,7);d.setGraphicsPlanes(0);d.doubleBuffer();d.autoback(2);d.clip(40,40,48,48);s.physicalPixels.fill(6);let hooks=0;d.setDrawingHooks({before(){hooks++;},after(){hooks++;}});
 for(const[coords,points]of oracle.lines){s.pixels.fill(4);p.extensionTurboDraw(...coords,1,1);const expected=new Uint8Array(4096).fill(4);for(const[x,y]of points)expected[y*64+x]=5;assert.deepStrictEqual(Array.from(s.pixels),Array.from(expected));
 s.pixels.fill(4);p.extensionTurboDraw(...coords,1,-1);expected.fill(4);const firstY=points[0][1],rows=new Map();for(const[x,y]of points)if(y>firstY&&!rows.has(y))rows.set(y,x);for(const[y,x]of rows)expected[y*64+x]=5;assert.deepStrictEqual(Array.from(s.pixels),Array.from(expected));}
 assert.deepStrictEqual([s.x,s.y,s.gx,s.gy,s.linePhase,s.ink,s.graphicsPlaneMask],[2,3,7,9,5,6,0]);assert.strictEqual(hooks,0);assert(s.physicalPixels.every(v=>v===6),'raw writes must not replay Autoback');
 s.pixels.fill(4);p.extensionTurboDraw(3,3,29,25,1,-1);p.extensionTurboDraw(3,3,29,25,1,-1);assert(s.pixels.every(v=>v===4));
 const before=s.pixels.slice();assert.throws(()=>p.extensionTurboDraw(-1,0,9,9,1),/bounded/);d.setLine(0x8000);assert.throws(()=>p.extensionTurboDraw(3,3,9,9,1,-1),/solid patterns/);assert.deepStrictEqual(s.pixels,before);
 p.extensionTurboDraw(4,1,9,1,1,1);assert.strictEqual(s.pixels[64+9],5);assert.strictEqual(s.pixels[64+4],4);assert.strictEqual(s.linePhase,5);
 }finally{p.stop();}
});
test('AMCAF Blitter Fill: native exclusive word fill, separate planes, outward bounds and current chip bytes',()=>{
 const p=create();try{const d=p.display,a=d.open(0,64,4,4,0);d.open(1,64,4,8,0);d.select(0);a.pixels.fill(2);for(let i=0;i<16;i++)if(0x2418&(32768>>>i))a.pixels[16+i]|=1;
 p.extensionBlitterFill(0,0,17,0,30,1,1,2);const b=d.screen(1);let word=0;for(let i=0;i<16;i++)word=(word<<1)|((b.pixels[16+i]&4)?1:0);assert.strictEqual(word,0x1c08);
 const expectedSource=Array.from({length:256},(_,i)=>2|((i>=16&&i<32&&(0x2418&(32768>>>(i-16))))?1:0));assert.deepStrictEqual(Array.from(a.pixels),expectedSource);
 p.extensionBlitterFill(0,0,17,0,30,1);assert.strictEqual(p.deek(d.planeBase('Logic',0)+2),0x1c08);assert(a.pixels.every(v=>(v&2)===2));
 const copy=b.pixels.slice();assert.throws(()=>p.extensionBlitterFill(0,0,0,0,65,1,1,0),/bounded/);assert.deepStrictEqual(b.pixels,copy);assert.strictEqual(p.extensionBlitterWait(),true);
 }finally{p.stop();}
});
test('AMCAF Protracker2: unchanged original draws independent first-note meter pixels and exits through Mouse Key',()=>{
 const fs=require('fs'),clock=require('./helpers/fakeTimers').createFakeTimers(),module={exports:{}};
 vm.runInNewContext(new(require('../lib/Transpiler'))(fs.readFileSync(__dirname+'/../examples/AMCAF/AMCAF_Examples/Protracker2.AMOS'),{extensions:{8:'amcaf-1.50beta4'}}).toModule(),{module});
 const p=module.exports({...clock,files:require('../lib/amos/files').createMemoryFiles({'Data/mod.hawkeye':fs.readFileSync(__dirname+'/../examples/AMCAF/AMCAF_Examples/Data/mod.hawkeye').toString('latin1')})});
 try{p.tick(10000);let field=0;for(const f of oracle.protracker2){while(field<f.field){clock.tick(20);field++;}const s=p.display.screen(0);for(let y=0;y<160;y++)for(let x=32;x<288;x++)assert.strictEqual(s.physicalPixels[y*320+x],Number(f.rows[y][x-32]),`field ${field} at ${x},${y}`);}
 p.setMouse(128,50,1);clock.tick(40);assert.strictEqual(p.state.halted,true);assert.strictEqual(p.state.tracker.playing,false);assert.strictEqual(p.display.screens.size,0);assert.strictEqual(clock.pending(),0);
 }finally{p.stop();}
});
