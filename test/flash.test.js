/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {binary,token:t,word:w,dword,integer:n,identifier:id,text,compile,execute}=require('./helpers/program');
const {createFakeTimers}=require('./helpers/fakeTimers');
const hooks=c=>({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout});
const flash=(colour,pattern)=>[w(0xd44),n(colour),t(','),text(pattern)];
const idle=()=>binary([[t('Colour'),n(1),t(','),n(0x123)],flash(1,'(f00,2)(0f0,3)(00f,1)'),[t('Wait Key')]]);
const rgba=rgb=>[(rgb>>8&15)*17,(rgb>>4&15)*17,(rgb&15)*17,255];

test('Flash: original tokens cycle on VBL while waiting, without changing bitmap bytes or running instructions',()=>{
  const {program:p,timers:c}=execute(idle()),s=p.display.screen(),pixels=Buffer.from(s.pixels),ticks=p.state.ticks;
  assert.ok(Object.isFrozen(p.state.flashes)&&Object.isFrozen(p.state.flashes[0]));assert.strictEqual(c.pending(),1);
  let elapsed=0;
  for(const [at,rgb]of [[19,0x123],[20,0xf00],[59,0xf00],[60,0x0f0],[119,0x0f0],[120,0x00f],[140,0xf00]]){
    c.tick(at-elapsed);elapsed=at;assert.strictEqual(s.palette[1],rgb);assert.deepStrictEqual(Array.from(p.display.rgba().slice(0,4)),rgba(rgb));
    assert.deepStrictEqual(Buffer.from(s.pixels),pixels);assert.strictEqual(p.state.ticks,ticks);
  }
  p.stop();assert.strictEqual(c.pending(),0);
});

test('Flash Off: only selected-screen jobs stop, retaining colours, physical buffers and unrelated Fade work',()=>{
  const c=createFakeTimers(),p=compile(binary([[t('Wait Key')]])).create(hooks(c)),d=p.display;
  p.tick(100);p.flash(1,'(f00,2)(0f0,2)');d.open(1,320,200,16,0);p.flash(1,'(00f,2)(fff,2)');
  c.tick(20);assert.strictEqual(d.screen(0).palette[1],0xf00);assert.strictEqual(d.screen(1).palette[1],0x00f);
  p.flashOff();p.flashOff();c.tick(40);assert.strictEqual(d.screen(0).palette[1],0x0f0);assert.strictEqual(d.screen(1).palette[1],0x00f);
  assert.strictEqual(p.state.flashes.length,1);d.select(0);p.fade(1);p.flashOff();assert.strictEqual(p.state.fade.active,true);
  c.tick(20);assert.strictEqual(d.screen().palette[1],0x0e0);p.cancelFade();assert.strictEqual(c.pending(),0);p.stop();
  const exact=execute(binary([flash(1,'(f00,1)'),[t('Wait Vbl')],[w(0xd34)],[t('Wait Key')]]));exact.timers.tick(20);
  assert.strictEqual(exact.program.display.screen().palette[1],0xf00);assert.strictEqual(exact.program.state.flashes.length,0);assert.strictEqual(exact.timers.pending(),0);exact.program.stop();
});

test('Flash: replacements, empty cancellation, screen identity cleanup and independent factories preserve ownership',()=>{
  const c=createFakeTimers(),create=compile(idle()).create,a=create(hooks(c)),b=create(hooks(c));a.tick(100);b.tick(100);
  a.flash(1,'(abc,1)');c.tick(20);assert.strictEqual(a.display.screen().palette[1],0xabc);assert.strictEqual(b.display.screen().palette[1],0xf00);
  a.flash(1,'');assert.strictEqual(a.state.flashes.length,0);a.flash(2,'(123,1)');a.display.autoViewOff();a.display.open(0,320,200,16,0);
  assert.strictEqual(a.state.flashes.length,0);a.flash(1,'(fff,1)');a.display.close(0);assert.strictEqual(a.state.flashes.length,0);
  b.stop();a.stop();assert.strictEqual(c.pending(),0);
});

test('Flash: Stop/Resume and late callbacks reconcile bounded cycles with 50/60 Hz phase and ignore stale tasks',()=>{
  for(const rate of [50,60]){
    let now=7,sequence=0;const tasks=new Map(),create=compile(binary([[t('Wait Key')]])).create;
    const p=create({now:()=>now,vblHz:rate,sleepScale:0,setTimeout(fn,delay){tasks.set(++sequence,{fn,delay});return sequence;},clearTimeout(id){tasks.delete(id);}});
    p.tick(100);now=12;p.setTimer(-200);p.flash(1,'(f00,2)(0f0,3)(00f,1)');
    const stale=tasks.values().next().value.fn;p.stop();const before=p.display.screen().palette[1];
    now=7+1000000*1000/rate+0.01;stale();assert.strictEqual(p.display.screen().palette[1],before);
    p.resume(); // Frame 1,000,000: cycle position 3 after starting on frame 1 -> green.
    assert.strictEqual(p.display.screen().palette[1],0x0f0);assert.strictEqual(p.state.flashes[0].nextVbl,1000002);
    assert.strictEqual(tasks.size,1);p.stop();assert.strictEqual(tasks.size,0);
  }
});

test('Flash/Fade: late reconciliation agrees with each VBL, including tie ordering and flashes after fade completion',()=>{
  const create=compile(binary([[t('Wait Key')]])).create;
  for(const until of [1,3,5,16,40,1000003]){
    const c=createFakeTimers(),a=create(hooks(c));a.tick(100);a.display.setColour(1,0x321);a.flash(1,'(f00,2)(0f0,3)(00f,1)');a.fade(2);
    const steps=[{rgb:0xf00,speed:2},{rgb:0x0f0,speed:3},{rgb:0x00f,speed:1}];let next=1,pos=0,expected=0x321,fadeNext=1,captured=0x321;
    // Independent per-field oracle, bounded to a representative prefix then the
    // final cycle once the three-component fade has completed.
    const limit=Math.min(until,100);
    for(let vbl=1;vbl<=limit;vbl++){
      if(vbl===next){expected=steps[pos].rgb;next+=steps[pos].speed;pos=(pos+1)%3;}
      if(vbl===fadeNext){if(captured){captured=Math.max(0,(captured>>8)-1)*256+Math.max(0,(captured>>4&15)-1)*16+Math.max(0,(captured&15)-1);expected=captured;}fadeNext+=2;}
    }
    if(until>100){const phase=(until-1)%6;expected=phase<2?0xf00:phase<5?0x0f0:0x00f;}
    a.advancePalette(until);assert.strictEqual(a.display.screen().palette[1],expected,`late frame ${until}`);a.stop();
  }
});

test('Flash: normal/EHB/HAM output and immutable snapshots use the same palette without Autoback or Bob writes',()=>{
  for(const colours of [16,64,4096]){
    const c=createFakeTimers(),p=compile(binary([[t('Wait Key')]])).create(hooks(c)),d=p.display;p.tick(100);
    d.open(0,320,200,colours,0);d.setColour(1,0x123);d.clear(colours===64?33:1);d.doubleBuffer();d.autoback(0);d.clear(0);
    const old=d.snapshotDisplay(),oldPal=Buffer.from(old.frame.linePal),physical=Buffer.from(d.screen().physicalPixels);
    p.flash(1,'(f53,1)(135,1)');c.tick(20);const expected=rgba(colours===64?0x721:0xf53);
    assert.deepStrictEqual(Array.from(d.renderDisplay().slice(0,4)),expected);assert.deepStrictEqual(Array.from(d.rgba().slice(0,4)),expected);
    assert.deepStrictEqual(Buffer.from(d.screen().physicalPixels),physical);assert.ok(d.screen().pixels.every(v=>v===0));
    assert.deepStrictEqual(Buffer.from(old.frame.linePal),oldPal);p.stop();
  }
});

test('Flash: patterns, capacity, typed arguments, failures and lifecycle boundaries have explicit behavior',()=>{
  const {program:p,timers:c}=execute(binary([[t('Wait Key')]]));
  for(const pattern of [' ','(fff,0)','(fff,-1)','(fff,32768)','(ffff,1)','(ggg,1)','(fff,1) ',Array(17).fill('(fff,1)').join('')])assert.throws(()=>p.flash(1,pattern),/Unsupported Flash/);
  for(let i=0;i<16;i++)p.flash(i,'( f f f, 1 0 )');assert.strictEqual(p.state.flashes.length,16);
  assert.throws(()=>p.flash(0,''),/Too many flashing colours/);p.flashOff();assert.strictEqual(c.pending(),0);
  for(const index of [-1,32])assert.throws(()=>p.flash(index,'(fff,1)'),/Unsupported Flash colour/);p.display.close(0);assert.throws(()=>p.flashOff(),/not open/);p.stop();
  for(const line of [[w(0xd44),text('1'),t(','),text('(fff,1)')],[w(0xd44),n(1),t(','),n(2)],[w(0xd34),n(1)]])assert.throws(()=>compile(binary([line])),/Wrong argument type|numeric|requires a string|end of statement/i);
  for(const ending of [t('End'),t('Return')]){
    const x=compile(binary([flash(1,'(fff,1)'),[ending]])).create(hooks(c));if(ending[1]===0x60)assert.throws(()=>x.tick(100),/Return without Gosub/);else x.tick(100);
    assert.strictEqual(x.state.flashes.length,0);assert.strictEqual(c.pending(),0);
  }
  const typed=execute(binary([[t('Data'),w(0),text('(abc,2)'),t(','),n(1)],[t('Read'),id('pattern',6,2),t(','),id('colour')],
    [t('Dim'),id('a'),t('('),n(0),t(')')],[id('a'),t('('),n(0),t(')'),t('='),id('colour')],
    [t('Procedure'),dword(0),w(0),0,0,id('p'),t('['),id('v'),t(']')],[t('End Proc'),t('['),id('v'),t(']')],
    [id('p',0x12),t('['),id('a'),t('('),n(0),t(')'),t(']')],[w(0xd44),t('Param'),t(','),id('pattern',6,2)],[t('Wait Key')]]));
  typed.timers.tick(20);assert.strictEqual(typed.program.display.screen().palette[1],0xabc);typed.program.stop();
  const broken=execute(binary([flash(1,'(fff,1)'),[t('Wait Key')]]));broken.program.display.subscribe(()=>{throw new Error('flash observer failed');});
  assert.throws(()=>broken.timers.tick(20),/flash observer failed at line 1, byte 22/);assert.strictEqual(broken.program.state.halted,true);assert.strictEqual(broken.timers.pending(),0);
});

test('Flash Off: complete original Wonderland game/editor screen setup reaches its own Auto View On',()=>{
  for(const game of [1,2]){
    const {program:p,timers:c}=execute(require('./helpers/wonderlandScreens')(game,1),1000,{files:{read:name=>fs.readFileSync(path.join(__dirname,'../examples/Wonderland',name.split('/').pop())).toString('latin1')}});
    c.tick(20);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.display.current,0);assert.strictEqual(p.display.autoView,true);assert.strictEqual(p.state.flashes.length,0);assert.strictEqual(c.pending(),0);p.stop();
  }
});
