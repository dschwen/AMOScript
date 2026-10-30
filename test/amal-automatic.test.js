'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {binary,token:t,integer:n,text,compile}=require('./helpers/program');
const {createFakeTimers}=require('./helpers/fakeTimers');
const readBanks=require('../lib/BankReader');
const oracle=require('./fixtures/compiler-examples/galax-movements.json');
const raw=fs.readFileSync(path.join(__dirname,'../examples/CompilerExamples/Galax/Moves.Abk'));
const bank=readBanks.readFile(raw).banks[0];
function idle({manual=false,hz=50,source='L:Let X=X+1;Pause;Jump L',banks=[]}={}) {
  const lines=manual?[[t('Synchro Off')]]:[];
  lines.push([t('Sprite'),n(0),t(','),n(250),t(','),n(80),t(','),n(0)],
    [t('Amal'),n(0),t(','),text(source)],[t('Amal On')],[t('Wait Key')],[t('End')]);
  const input=banks.length?Buffer.concat([binary(lines),Buffer.from(require('../lib/BankWriter').write(banks,true))]):binary(lines);
  const c=createFakeTimers(),p=compile(input).create({vblHz:hz,now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout});
  p.tick(1000);return{p,c};
}
test('Automatic AMAL: PAL/NTSC fields run during Wait Key, manual Synchro does not double-step and mode changes retain movement',()=>{
  for(const hz of [50,60]) {
    const {p,c}=idle({hz});const field=1000/hz;
    try {
      assert.strictEqual(p.spriteInfo('X Sprite',0),250);c.tick(field-0.01);assert.strictEqual(p.spriteInfo('X Sprite',0),250);
      c.tick(0.02);assert.strictEqual(p.spriteInfo('X Sprite',0),251);p.synchro();assert.strictEqual(p.spriteInfo('X Sprite',0),251);
      c.tick(field*3);assert.strictEqual(p.spriteInfo('X Sprite',0),254);
      p.synchroOff();assert.strictEqual(c.pending(),0);c.tick(1000);assert.strictEqual(p.spriteInfo('X Sprite',0),254);
      p.synchro();assert.strictEqual(p.spriteInfo('X Sprite',0),255);p.synchroOn();c.tick(field+0.01);assert.strictEqual(p.spriteInfo('X Sprite',0),256);
      p.stop();assert.strictEqual(c.pending(),0);c.tick(1000);p.resume();c.tick(field+0.01);assert.strictEqual(p.spriteInfo('X Sprite',0),257);
      p.amalOff();assert.strictEqual(c.pending(),0);
    }finally{p.stop();}
  }
});
test('Automatic AMAL: Freeze/On, replacement, target retirement, terminal cleanup and asynchronous source errors own their wakes',()=>{
  const {p,c}=idle();c.tick(20);p.amalFreeze();c.tick(20);assert.strictEqual(p.spriteInfo('X Sprite',0),251);assert.strictEqual(c.pending(),0);
  p.amalOn();c.tick(20);assert.strictEqual(p.spriteInfo('X Sprite',0),252);
  p.installAmal(0,'Let X=7;End');assert.strictEqual(c.pending(),0);p.amalOn();c.tick(20);assert.strictEqual(p.spriteInfo('X Sprite',0),7);assert.strictEqual(c.pending(),0);
  p.installAmal(0,'L:Pause;Jump L');p.amalOn();p.spriteOff(0);assert.strictEqual(c.pending(),0);
  p.installAmal(0,'Let X=BC(0,0,0)');p.amalOn();assert.throws(()=>c.tick(20),/BC requires Synchro Off.*AMAL channel 0.*line 4/);assert.strictEqual(p.state.halted,true);assert.strictEqual(c.pending(),0);assert.strictEqual(p.amalSnapshot().length,0);
  const q=idle();q.p.sendKey('end');q.c.tick(0);assert.strictEqual(q.p.state.halted,true);assert.strictEqual(q.c.pending(),0);
});
test('AMAL PLay: all fifteen unchanged GALAX movements match 4,444 independent field positions; invalid selectors fall through',()=>{
  assert.strictEqual(crypto.createHash('sha256').update(raw).digest('hex'),oracle.sourceSha256);
  for(const trace of oracle.traces) {
    const {p,c}=idle({manual:true,banks:[bank],source:`PLay ${trace.number};Let RZ=1;End`});
    try {
      for(let i=0;i<trace.positions.length;i++) {
        p.synchro();assert.deepStrictEqual([p.spriteInfo('X Sprite',0),p.spriteInfo('Y Sprite',0)],trace.positions[i],`movement ${trace.number}, field ${i}`);
        assert.strictEqual(p.amreg(25),i===trace.positions.length-1?1:0);
      }
      assert.strictEqual(c.pending(),0);
    }finally{p.stop();}
  }
  for(const number of [0,16,49,-1]){const {p}=idle({manual:true,banks:[bank],source:`PLay ${number};Let RZ=1`});p.synchro();assert.strictEqual(p.amreg(25),1);assert.strictEqual(p.spriteInfo('X Sprite',0),250);p.stop();}
});
test('AMAL PLay: automatic field clocks agree with independent paths and active bank writes/replacement fail safely',()=>{
  for(const hz of [50,60]) {
    const {p,c}=idle({hz,banks:[bank],source:'PLay 1;Let RZ=1;End'});
    try {
      for(let i=0;i<oracle.traces[0].positions.length;i++) {
        c.tick((i+1)*1000/hz+0.001-c.now());
        assert.deepStrictEqual([p.spriteInfo('X Sprite',0),p.spriteInfo('Y Sprite',0)],oracle.traces[0].positions[i]);
      }
      assert.strictEqual(p.amreg(25),1);assert.strictEqual(c.pending(),0);
    }finally{p.stop();}
  }
  const {p,c}=idle({banks:[bank],source:'PLay 1'});c.tick(20);const address=p.bankStart(4),before=p.peek(address);
  assert.throws(()=>p.poke(address,0),/active AMAL/);assert.strictEqual(p.peek(address),before);
  p.eraseBank(4);assert.throws(()=>c.tick(20),/bank changed during PLay.*line 2/);assert.strictEqual(p.state.halted,true);assert.strictEqual(c.pending(),0);
  const shrink=idle({banks:[bank],source:'PLay 1'});shrink.c.tick(20);shrink.p.shrinkBank(4,100);
  assert.throws(()=>shrink.c.tick(20),/bank changed during PLay.*line 2/);assert.strictEqual(shrink.p.state.halted,true);assert.strictEqual(shrink.c.pending(),0);
  assert.throws(()=>idle({source:'PLay 1'}),/requires an Amal movement bank 4/);
});

test('Automatic AMAL: delayed wakes catch up by fields, Stop invalidates uncancellable callbacks and Resume rebases without catch-up',()=>{
  let now=0;const tasks=[];
  const input=binary([[t('Amal'),n(0),t(','),text('L:Let X=X+1;Pause;Jump L')],[t('Amal On')],[t('Wait Key')]]);
  const p=compile(input).create({now:()=>now,setTimeout:fn=>{tasks.push(fn);return tasks.length;},clearTimeout(){}});
  p.tick(1000);now=100;for(const fn of tasks.splice(0))fn();assert.strictEqual(p.spriteInfo('X Sprite',0),5);
  const stale=tasks.splice(0);p.stop();now=2000;for(const fn of stale)fn();assert.strictEqual(p.spriteInfo('X Sprite',0),5);
  p.resume();now=2020;tasks.pop()();assert.strictEqual(p.spriteInfo('X Sprite',0),6);
  now=10000;assert.throws(()=>tasks.pop()(),/AMAL field catch-up exceeds 250/);assert.strictEqual(p.state.halted,true);assert.strictEqual(p.amalSnapshot().length,0);
});

test('AMAL PLay: signed seven-bit deltas, wait bytes, speed countdown and malformed stream/header checks retain explicit bounds',()=>{
  const data=Uint8Array.from([0,0,0,0,0,1,0,4,0,0,0,0]);
  // One entry at byte 12, speed 2; X bytes begin at 17, Y at 25.
  const payload=Uint8Array.from([...data,0,2,0,12,0,1,127,64,63,128,130,1,0,129,2,3,4,5,6,7,8,9,0]);
  const make=bytes=>({...bank,data:bytes});
  const {p}=idle({manual:true,banks:[make(payload)],source:'PLay 1;Let RZ=1'});
  const expected=[[251,80],[251,80],[250,80],[250,80],[186,82],[186,82],[249,85],[249,85],[249,89],[249,89],[249,94],[249,94],[249,100],[249,100],[249,107],[249,107],[250,115],[250,115],[250,115]];
  try{for(const [i,position] of expected.entries()){p.synchro();assert.deepStrictEqual([p.spriteInfo('X Sprite',0),p.spriteInfo('Y Sprite',0)],position,`synthetic field ${i}`);}assert.strictEqual(p.amreg(25),1);}finally{p.stop();}
  for(const mutate of [b=>{b[12]=0;b[13]=0;},b=>{b[14]=127;b[15]=255;},b=>b.fill(1,25),b=>{b[6]=127;b[7]=255;}]) {
    const bytes=payload.slice();mutate(bytes);const q=idle({manual:true,banks:[make(bytes)],source:'PLay 1'}).p;
    assert.throws(()=>q.synchro(),/AMAL movement/);assert.deepStrictEqual([q.spriteInfo('X Sprite',0),q.spriteInfo('Y Sprite',0)],[250,80]);q.stop();
  }
});
