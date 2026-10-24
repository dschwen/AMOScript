/* jshint esversion: 6 */
'use strict';
const assert=require('assert');
const {binary,token:t,word:w,integer:n,dword,identifier:id,text,compile,execute}=require('./helpers/program');
const {createFakeTimers}=require('./helpers/fakeTimers');
const hooks=c=>({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout});
const colour=(index,rgb)=>[t('Colour'),n(index),t(','),n(rgb)];
const idle=speed=>binary([colour(1,0xf31),[w(0xdfe),n(speed)],[t('Wait Key')]]);

test('Fade: original token starts one owned 32-register job without blocking or immediately changing pixels',()=>{
  const {create}=compile(idle(2)),c=createFakeTimers(),a=create(hooks(c)),b=create(hooks(c));a.tick(100);
  assert.deepStrictEqual({...a.state.fade},{active:true,screen:0,speed:2,nextVbl:1});assert.ok(Object.isFrozen(a.state.fade));
  assert.strictEqual(a.state.waiting,'key');assert.strictEqual(c.pending(),1);assert.strictEqual(b.state.fade.active,false);
  assert.strictEqual(a.display.screen().palette[1],0xf31);const ticks=a.state.ticks;
  c.tick(19);assert.strictEqual(a.display.screen().palette[1],0xf31);c.tick(1);assert.strictEqual(a.display.screen().palette[1],0xe20);
  c.tick(39);assert.strictEqual(a.display.screen().palette[1],0xe20);c.tick(1);assert.strictEqual(a.display.screen().palette[1],0xd10);
  assert.strictEqual(a.state.ticks,ticks);c.tick(520);assert.strictEqual(a.display.screen().palette[1],0);assert.strictEqual(a.state.fade.active,true);
  c.tick(40);assert.strictEqual(a.state.fade.active,false);assert.strictEqual(c.pending(),0);a.stop();b.stop();
});

test('Fade: first step uses the global VBL phase at 50/60 Hz, independent of Timer and sleepScale',()=>{
  for(const rate of [50,60]) {
    const c=createFakeTimers(),p=compile(binary([[t('Wait Vbl')],[t('Wait Key')]])).create({...hooks(c),vblHz:rate,sleepScale:0});
    p.tick(100);c.tick(7);p.display.setColour(1,0xf31);p.setTimer(-200);p.fade(2);
    c.tick(1000/rate-7-0.01);assert.strictEqual(p.display.screen().palette[1],0xf31);
    c.tick(0.02);assert.strictEqual(p.display.screen().palette[1],0xe20);
    c.tick(2*1000/rate);assert.strictEqual(p.display.screen().palette[1],0xd10);
    p.stop();assert.strictEqual(c.pending(),0);
  }
});

test('Fade: normal/EHB/HAM Canvas and copper share palette changes; physical pixels and old snapshots stay intact',()=>{
  for(const mode of [16,64,4096]) {
    const c=createFakeTimers(),p=compile(binary([[t('Wait Key')]])).create(hooks(c)),d=p.display;
    d.open(0,320,200,mode,0);d.setColour(1,0xf53);d.setColour(31,0x135);d.clear(mode===64?33:1);d.doubleBuffer();d.autoback(0);d.clear(0);
    const target=d.screen(),physical=Buffer.from(target.physicalPixels),before=d.snapshotDisplay(),oldPal=Buffer.from(before.frame.linePal);
    p.fade(1);c.tick(60);assert.strictEqual(target.palette[1],0xc20);assert.strictEqual(target.palette[31],0x002);
    const rgb=mode===64?0x610:0xc20,expected=[(rgb>>8)*17,((rgb>>4)&15)*17,(rgb&15)*17,255];
    assert.deepStrictEqual(Array.from(d.rgba().slice(0,4)),expected);assert.deepStrictEqual(Array.from(d.renderDisplay().slice(0,4)),expected);
    assert.deepStrictEqual(Buffer.from(target.physicalPixels),physical);assert.ok(target.pixels.every(value=>value===0));
    assert.deepStrictEqual(Buffer.from(before.frame.linePal),oldPal);assert.notDeepStrictEqual(Buffer.from(d.snapshotDisplay().frame.linePal),oldPal);p.stop();
  }
});

test('Fade: new jobs replace the global fade, screen selection does not retarget it, and closure/replacement cancels it',()=>{
  const c=createFakeTimers(),p=compile(binary([[t('Wait Key')]])).create(hooks(c)),d=p.display;
  d.setColour(1,0xf31);p.fade(1);d.open(1,320,200,16,0);d.setColour(1,0x3f1);c.tick(20);
  assert.strictEqual(d.screen(0).palette[1],0xe20);assert.strictEqual(d.screen(1).palette[1],0x3f1);
  p.fade(2);c.tick(20);assert.strictEqual(d.screen(0).palette[1],0xe20);assert.strictEqual(d.screen(1).palette[1],0x2e0);assert.strictEqual(c.pending(),1);
  d.select(0);d.close(1);assert.strictEqual(p.state.fade.active,false);assert.strictEqual(c.pending(),0);
  p.fade(1);d.autoViewOff();const old=d.screen();d.open(0,320,200,16,0);assert.strictEqual(p.state.fade.active,false);c.tick(100);assert.strictEqual(old.palette[1],0xe20);p.stop();
});

test('Fade: captured components overwrite intervening Colour writes, while completed entries and rainbow rows stay independent',()=>{
  const c=createFakeTimers(),p=compile(binary([[t('Wait Key')]])).create(hooks(c)),d=p.display;
  d.setPalette(...Array(32).fill(0));d.setColour(1,0x211);d.clear(1);p.fade(1);c.tick(20);assert.strictEqual(d.screen().palette[1],0x100);
  d.setColour(1,0xfff);c.tick(20);assert.strictEqual(d.screen().palette[1],0);d.setColour(1,0xf00);c.tick(20);assert.strictEqual(d.screen().palette[1],0xf00);assert.strictEqual(p.state.fade.active,false);
  d.setRainbow(1,1,16,'','','',0x0f0);d.rainbow(1,0,50,10);p.fade(1);c.tick(20);
  assert.strictEqual(d.screen().palette[1],0xe00);assert.deepStrictEqual(Array.from(d.rgba().slice(0,4)),[0,255,0,255]);p.stop();
});

test('Fade: Stop cancels wakeups, Resume catches up bounded elapsed VBLs, and asynchronous failures retain Fade context',()=>{
  const {program:p,timers:c}=execute(idle(2));c.tick(20);const before=p.display.screen().palette[1];p.stop();assert.strictEqual(c.pending(),0);
  c.tick(1e9);assert.strictEqual(p.display.screen().palette[1],before);const ticks=p.state.ticks;p.resume();assert.strictEqual(p.display.screen().palette[1],0);
  assert.strictEqual(p.state.fade.active,false);assert.strictEqual(p.state.ticks,ticks);assert.strictEqual(c.pending(),0);p.stop();
  const bad=execute(binary([[w(0xdfe),n(2)],[t('Wait'),n(100)]]));
  bad.program.display.subscribe(()=>{throw new Error('display observer failed');});
  assert.throws(()=>bad.timers.tick(20),/display observer failed at line 1, byte 22/);
  assert.strictEqual(bad.program.state.halted,true);assert.strictEqual(bad.program.state.fade.active,false);assert.strictEqual(bad.timers.pending(),0);
  const collision=execute(binary([[w(0xdfe),n(2)],[t('Wait'),n(3)],[t('End')]]));
  collision.program.display.subscribe(()=>{if(collision.timers.now()>=60)throw new Error('coincident observer failed');});
  assert.throws(()=>collision.timers.tick(60),/coincident observer failed at line 1, byte 22/);
  assert.strictEqual(collision.program.state.halted,true);assert.strictEqual(collision.timers.pending(),0);
  const brokenClock=createFakeTimers(),broken=compile(binary([colour(1,0xf31),[w(0xdfe),n(2)],[t('Wait'),n(3)]])).create({...hooks(brokenClock),clearTimeout(){throw new Error('cannot cancel');}});
  broken.tick(100);broken.display.subscribe(()=>{throw new Error('original observer error');});
  assert.throws(()=>brokenClock.tick(20),/original observer error at line 2/);
  const last=broken.display.screen().palette[1];brokenClock.tick(100);
  assert.strictEqual(broken.display.screen().palette[1],last);assert.strictEqual(brokenClock.pending(),0);
});

test('Fade: End/errors and stale callbacks cancel effects; typed speeds and unsupported forms use explicit diagnostics',()=>{
  for(const ending of [t('End'),t('Return')]) {
    const c=createFakeTimers(),p=compile(binary([[w(0xdfe),n(2)],[ending]])).create(hooks(c));
    if(ending[1]===0x60)assert.throws(()=>p.tick(100),/Return without Gosub/);else p.tick(100);
    assert.strictEqual(c.pending(),0);assert.strictEqual(p.state.fade.active,false);
  }
  let now=0;const tasks=[],p=compile(idle(2)).create({now:()=>now,setTimeout(fn){tasks.push(fn);return tasks.length;}});p.tick(100);p.stop();p.resume();
  now=20;tasks[0]();assert.strictEqual(p.display.screen().palette[1],0xf31);tasks[1]();assert.strictEqual(p.display.screen().palette[1],0xe20);p.stop();
  for(const speed of [-1,0,32768])assert.throws(()=>execute(idle(speed)),/Unsupported Fade speed.*line 2/);
  for(const line of [[w(0xdfe),text('2')],[w(0xdfe),n(2),t(','),n(0)],[w(0xdfe),n(2),t('To'),n(1)]])assert.throws(()=>compile(binary([line])),/numeric|end of statement/i);
  const data=binary([[t('Data'),w(0),n(2)],[t('Read'),id('s')],[t('Dim'),id('a'),t('('),n(0),t(')')],
    [id('a'),t('('),n(0),t(')'),t('='),id('s')],[t('Procedure'),dword(0),w(0),0,0,id('speed'),t('['),id('v'),t(']')],
    [t('End Proc'),t('['),id('v'),t(']')],[id('speed',0x12),t('['),id('a'),t('('),n(0),t(')'),t(']')],
    [w(0xdfe),t('Param')],[t('Wait Key')]]);
  const typed=execute(data);assert.strictEqual(typed.program.state.fade.speed,2);typed.program.stop();
  const dynamic=execute(binary([[w(0xdfe),t('Val'),t('('),text('2.9'),t(')')],[t('Wait Key')]]));
  assert.strictEqual(dynamic.program.state.fade.speed,2);dynamic.program.stop();
});

test('Fade: original Wonderland Fade 2 / Wait 64 / Wait Vbl fades the unchanged title against independent RGB expectations',()=>{
  const fs=require('fs'),path=require('path'),{decodePng}=require('./helpers/displayPng');
  const {program:p,timers:c}=execute(require('./helpers/wonderlandFade')(),100000,{files:{read:name=>fs.readFileSync(path.join(__dirname,'../examples/Wonderland',name.split('/').pop())).toString('latin1')}});
  c.tick(20);assert.strictEqual(p.state.waiting,'key');
  const golden=decodePng(fs.readFileSync(path.join(__dirname,'fixtures/wonderland/title-setup.png'))).rgba;
  assert.deepStrictEqual(Buffer.from(p.display.renderDisplay()),Buffer.from(golden));const pixels=Buffer.from(p.display.screen().physicalPixels);
  p.sendKey('f');c.tick(0);assert.strictEqual(p.state.waiting,'sleep');const ticks=p.state.ticks;
  let elapsed=0;
  for(const at of [19,20,60,300,580,620]) {
    c.tick(at-elapsed);elapsed=at;const steps=at<20?0:Math.min(15,Math.floor((at-20)/40)+1),expected=Buffer.from(golden);
    for(let i=0;i<expected.length;i++)if(i%4!==3)expected[i]=Math.max(0,expected[i]-steps*17);
    assert.deepStrictEqual(Buffer.from(p.display.renderDisplay()),expected,`elapsed ${at}`);
    assert.deepStrictEqual(Buffer.from(p.display.screen().physicalPixels),pixels);assert.strictEqual(p.state.ticks,ticks);
  }
  c.tick(680);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(c.pending(),0);assert.strictEqual(p.state.fade.active,false);p.stop();
});
