'use strict';
const assert=require('assert'),create=require('../lib/amos/amcafSequencer'),pitch=require('../lib/amos/amcafPitch');
function fixture(){const m=require('./helpers/amcafPreviewModule')();m.patterns[0].forEach(c=>{c.sample=c.period=c.effect=c.parameter=0;});m.patterns.push(m.patterns[0].map(c=>({...c})));m.songLength=2;m.orderTable[0]=1;return m;}
const put=(m,row,voice,sample,period,effect=0,parameter=0)=>Object.assign(m.patterns[1][row*4+voice],{sample,period,effect,parameter});
const ticks=(p,n)=>{while(n--)p.tick();};
test('AMCAF status: order versus pattern, next row, current-cell nibble, base-period frequency and destructive volume/signal bytes',()=>{
 const m=fixture();put(m,0,0,17,428,12,7);put(m,0,1,2,856);put(m,0,2,1,428,4,0x47);put(m,0,3,0,0,8,42);
 put(m,1,0,2,0,12,3);put(m,2,0,0,339);const p=create(m,pitch);
 assert.strictEqual(p.readStatus('order'),0);assert.strictEqual(p.readStatus('row'),0);assert.strictEqual(p.readStatus('note',0),0);ticks(p,6);
 assert.strictEqual(p.readStatus('order'),0,'order slot 0 selects physical pattern 1');assert.strictEqual(p.readStatus('row'),1);
 assert.strictEqual(p.readStatus('instrument',0),1,'native Cinstr only reads the low instrument nibble');assert.strictEqual(p.readStatus('note',0),8287);assert.strictEqual(p.readStatus('note',1),4143);
 assert.throws(()=>p.readStatus('vu',4),/query voice/);assert.strictEqual(p.readStatus('vu',0),7);assert.strictEqual(p.readStatus('vu',0),0);assert.strictEqual(p.readStatus('vu',1),20);
 assert.strictEqual(p.readStatus('signal'),42);assert.strictEqual(p.readStatus('signal'),0);
 const before=p.state;for(let i=0;i<1000;i++){assert.strictEqual(p.readStatus('row'),1);assert.strictEqual(p.readStatus('note',2),8287);}assert.deepStrictEqual(p.state,before);
 ticks(p,3);assert.notStrictEqual(p.state.voices[2].outputPeriod,428);assert.strictEqual(p.readStatus('note',2),8287,'vibrato output is not the base period queried by Cnote');
 ticks(p,3);assert.strictEqual(p.readStatus('instrument',0),2);assert.strictEqual(p.state.voices[0].volume,3);assert.strictEqual(p.readStatus('vu',0),20,'instrument-only Cxx retains the instrument volume latch');
 ticks(p,6);assert.strictEqual(p.readStatus('instrument',0),0);assert.strictEqual(p.readStatus('vu',0),0,'a note without an instrument does not refresh VU');
 assert.strictEqual(p.readStatus('note',0),10462);ticks(p,384-p.state.ticks);assert.strictEqual(p.readStatus('order'),1);assert.strictEqual(p.readStatus('row'),0);assert.strictEqual(p.readStatus('signal'),0);
 ticks(p,384);assert.strictEqual(p.readStatus('order'),0);assert.strictEqual(p.readStatus('signal'),255);assert.strictEqual(p.readStatus('signal'),0);p.stop();assert.strictEqual(p.readStatus('note',0),10462);
});
test('AMCAF VU and signals: masked sample writes preserve pending latches, last assignment wins, backward branch/wrap produces unsigned 255',()=>{
 const m=fixture();put(m,0,0,1,428);put(m,1,0,2,0,12,9);put(m,0,1,0,0,8,19);put(m,0,2,0,0,8,231);
 const p=create(m,pitch);ticks(p,6);assert.strictEqual(p.readStatus('signal'),231);for(let i=0;i<6;i++)p.tick(14);assert.strictEqual(p.readStatus('vu',0),32);assert.strictEqual(p.readStatus('vu',0),0);
 const latest=create(m,pitch);ticks(latest,12);latest.setVolume(16);assert.strictEqual(latest.readStatus('vu',0),20,'last assignment wins, and master changes do not rewrite an existing latch');
 const q=fixture();put(q,0,0,0,0,8,4);put(q,0,1,0,0,11,0);const s=create(q,pitch);ticks(s,6);assert.strictEqual(s.readStatus('signal'),255);assert.strictEqual(s.readStatus('signal'),0);
});
test('AMCAF VM queries: relocated compiled reads, field-clock independence, channel preflight and post-Stop retention',()=>{
 const vm=require('vm'),module={exports:{}};vm.runInNewContext(new(require('../lib/Transpiler'))(require('./helpers/amcafStatusProgram')(),{extensions:{19:'amcaf-1.50beta4'}}).toModule(),{module});
 const clock=require('./helpers/fakeTimers').createFakeTimers(),logs=[],files=require('../lib/amos/files').createMemoryFiles({music:require('./helpers/amcafPreviewBytes')().toString('latin1')}),p=module.exports({...clock,files,print:(...a)=>logs.push(a)});
 try{assert.strictEqual(p.extensionPtCpattern(),0);assert.strictEqual(p.extensionPtCnote(0),0);assert.throws(()=>p.extensionPtVu(4),/0..3/);p.tick(1000);clock.tick(140);
 const before=p.state.tracker.position;for(let i=0;i<1000;i++)p.extensionPtCpos();assert.strictEqual(p.state.tracker.position,before);
 p.sendKey('x');p.tick(1000);assert.deepStrictEqual(logs,[[0,1,1,8287,32,0,0,0]]);clock.tick(940);p.sendKey('x');p.tick(1000);assert.deepStrictEqual(logs[1],[0,9,2,8287,20,0,0,0]);
 p.stop();const note=p.extensionPtCnote(0),row=p.extensionPtCpos();clock.tick(100);assert.strictEqual(p.extensionPtCnote(0),note);assert.strictEqual(p.extensionPtCpos(),row);
 p.extensionPtStop();p.eraseBank(3);assert.strictEqual(p.extensionPtCnote(0),note);assert.strictEqual(clock.pending(),0);p.extensionWload('music',-3);p.extensionPtPlay(3);assert.strictEqual(p.extensionPtCnote(0),0);assert.strictEqual(p.extensionPtVu(0),0);assert.strictEqual(p.extensionPtSignal(),0);for(const v of [-1,4,256])assert.throws(()=>p.extensionPtCinstr(v),/0..3/);
 }finally{p.stop();}
});
