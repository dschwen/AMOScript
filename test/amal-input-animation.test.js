'use strict';
const assert=require('assert'),make=require('../lib/amos/amal');
const {execute,binary,token:t,integer:n,text}=require('./helpers/program');
function idle(source,options={}){
  return execute(binary([[t('Synchro Off')],[t('Update Off')],[t('Bob'),n(0),t(','),n(0),t(','),n(0),t(','),n(0)],
    [t('Channel'),n(0),t('To'),t('Bob'),n(0)],[t('Amal'),n(0),t(','),text(source)],[t('Wait Key')]]),1000,options);
}
test('AMAL input: J0/J1 and Joy0/Joy1 read both live ports, preserve text/scancode and reject non-native selectors',()=>{
  const {program:p}=idle('Begin:Let R0=J0;Let R1=Joy1;Let R2=Joy0;Let R3=J1;P;Jump Begin');
  p.sendKey('guard');p.sendKey('x',42);p.amalOn();for(let mask=0;mask<32;mask++){p.setJoystick(0,mask);p.setJoystick(1,31-mask);p.synchro();assert.deepStrictEqual(Array.from(p.amalSnapshot()[0].locals).slice(0,4),[mask,31-mask,mask,31-mask]);}
  assert.strictEqual(p.inputValue('Inkey$'),'x');assert.strictEqual(p.inputValue('Scancode'),42);p.stop();
  const a=make({globals:new Int16Array(26)});for(const s of ['Let R0=J2','Let R0=Joy','Let R0=J1(0)','Let R0=JOY1','Joy Begin'])assert.throws(()=>a.compile(s),/AMAL/);
  assert.throws(()=>make({readJoystick:1}),/synchronous function/);
});
test('AMAL input: expressions poll left to right on each occurrence through the shared Basic adapter, without frame caching or render dependence',()=>{
  const {program:p,timers:c}=idle('Let R0=J1+J0;P;Let R1=J1');const calls=[],values=[1,2,4,8];
  p.setJoystickReader(port=>{calls.push(port);return values.shift();});p.amalOn();p.synchro();assert.strictEqual(p.amalSnapshot()[0].locals[0],3);assert.strictEqual(p.joystickInfo('Joy',0),4);p.synchro();assert.strictEqual(p.amalSnapshot()[0].locals[1],8);assert.deepStrictEqual(calls,[1,0,0,1]);assert.strictEqual(c.pending(),0);p.stop();
});
test('AMAL input: failed, asynchronous and reentrant readers preserve the pending assignment; Stop/retirement cannot relatch input or write old targets',()=>{
  for(const value of [32,-1,1.5,Promise.resolve(1)]){const {program:p}=idle('Let X=J1');p.setJoystickReader(()=>value);p.amalOn();assert.throws(()=>p.synchro(),/joystick/i);assert.strictEqual(p.bobInfo('X Bob',0),0);p.stop();}
  for(const action of ['stop','off','replace','recursive']){
    const {program:p}=idle('Let X=J1');p.setJoystickReader(()=>{if(action==='stop')p.stop();if(action==='off')p.bobOff(0);if(action==='replace')p.installAmal(0,'Pause');if(action==='recursive')p.synchro();return 8;});p.amalOn();
    assert.throws(()=>p.synchro(),/AMAL changed|Reentrant/);if(action!=='off')assert.strictEqual(p.bobInfo('X Bob',0),0);assert.strictEqual(p.state.input.joysticks[1],0);p.stop();
  }
  const {program:p}=idle('Let X=J1');p.setJoystickReader(()=>{throw Error('reader failed');});p.amalOn();assert.throws(()=>p.synchro(),/reader failed.*channel 0, character 0.*line 5/);p.stop();
});
test('AMAL Anim: image durations, finite repeats and loop zero match independent native countdown vectors while End stops only the main lane',()=>{
  for(const [repeats,expected]of [[1,[3,3,2,2,2,2,2,2,2,2,2]],[2,[3,3,2,2,2,3,3,2,2,2,2]],[0,[3,3,2,2,2,3,3,2,2,2,3]]]){
    const {program:p}=idle(`Anim ${repeats},(3,2)(2,3);End`);p.amalOn();const snapshots=[];
    for(const value of expected){p.synchro();assert.strictEqual(p.bobInfo('I Bob',0),value);assert.strictEqual(p.amalSnapshot()[0].ended,true);snapshots.push(p.amalSnapshot()[0]);}
    assert.strictEqual(snapshots.at(-1).animation===null,repeats!==0);assert.ok(Object.isFrozen(snapshots[0].animation));assert.strictEqual(snapshots[0].animation.remaining,2);p.stop();
  }
});
test('AMAL Anim: frame expressions evaluate lazily after main/Autotest; duration sees the new A, replacement wins and Move runs concurrently',()=>{
  const {program:p}=idle('Anim 0,(RA,A)(RA+1,1);Move 8,0,4;Let RA=7;Pause;End');p.setAmreg(0,2);p.amalOn();
  p.synchro();assert.deepStrictEqual([p.bobInfo('X Bob',0),p.bobInfo('I Bob',0)],[2,2]);p.setAmreg(0,5);p.synchro();assert.strictEqual(p.bobInfo('I Bob',0),2);p.synchro();assert.deepStrictEqual([p.bobInfo('X Bob',0),p.bobInfo('I Bob',0)],[6,6]);p.synchro();assert.strictEqual(p.bobInfo('I Bob',0),5);p.synchro();assert.strictEqual(p.amreg(0),7);assert.strictEqual(p.amalSnapshot()[0].animation.remaining,4);p.stop();
  const {program:q}=idle('AUtotest(Anim 0,(4,1);eXit);Anim 0,(3,1);P;Anim 1,(2,1);End');q.amalOn();q.synchro();assert.strictEqual(q.bobInfo('I Bob',0),3);q.synchro();assert.strictEqual(q.bobInfo('I Bob',0),2);q.synchro();assert.strictEqual(q.amalSnapshot()[0].animation,null);q.stop();
});
test('AMAL Anim: zero/negative duration and repeat counts use native wrapping words, not immediate loops; malformed lists preserve installations',()=>{
  const target={image:0},a=make({globals:new Int16Array(26),resolve:()=>({alive:()=>true,read:()=>0,write:(name,v)=>{target.image=v;}})});
  for(const [duration,wait]of [[0,65536],[-1,65535]]){
    a.install(0,`Anim 1,(1,${duration})(2,1);End`,{type:'bob',number:0});a.control(null,true);a.step();assert.strictEqual(target.image,1);
    for(let i=1;i<wait;i++)a.step();assert.strictEqual(target.image,1);a.step();assert.strictEqual(target.image,2);a.step();assert.strictEqual(a.snapshot()[0].animation,null);
  }
  a.install(0,'Anim -1,(1,1);End',{type:'bob',number:0});a.control(null,true);a.step();a.step();assert.strictEqual(a.snapshot()[0].animation.loops,65534);
  const before=a.snapshot();for(const source of ['Anim 0','Anim 0,','Anim 0,()','Anim 0,(1)','Anim 0,(1,2','Anim 0,'+'(1,1)'.repeat(257)]){assert.throws(()=>a.install(0,source,{type:'bob',number:0}),/AMAL/);assert.deepStrictEqual(a.snapshot(),before);}
});
test('AMAL Anim: Stop/Resume freezes both lanes, Off/replacement/terminal cleanup release the lane and animation errors identify their own instruction',()=>{
  const {program:p,timers:c}=idle('Anim 0,(1,2)(2,2);End');p.amalOn();p.synchro();const before=p.amalSnapshot();p.stop();p.synchro();c.tick(1000);assert.deepStrictEqual(p.amalSnapshot(),before);p.resume();p.synchro();assert.strictEqual(p.bobInfo('I Bob',0),1);p.synchro();assert.strictEqual(p.bobInfo('I Bob',0),2);p.amalOff();assert.strictEqual(p.amalSnapshot().length,0);p.installAmal(0,'Anim 1,(1,1);End');assert.strictEqual(p.amalSnapshot()[0].animation,null);p.sendKey('end');c.tick(0);assert.strictEqual(p.amalSnapshot().length,0);assert.strictEqual(c.pending(),0);
  const {program:q}=idle('Anim 1,(3,J1);Pause');q.setJoystickReader(()=>99);q.amalOn();assert.throws(()=>q.synchro(),/channel 0, character 0.*line 5/);assert.strictEqual(q.bobInfo('I Bob',0),3);q.stop();
});
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{compile}=require('./helpers/program'),shipOracle=require('./fixtures/planet-zybex/amal-ship.json');
test('Planet Zybex ship: original procedure and nine complete AMAL strings match 178 independent PAL/NTSC input/movement/animation/explosion frames',()=>{
  for(const standard of ['PAL','NTSC']){
    const c=require('./helpers/fakeTimers').createFakeTimers(),{create}=compile(require('./helpers/planetZybexShip')());
    const p=create({vblHz:standard==='PAL'?50:60,displayOptions:{snapshotStandard:standard},now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,files:{read:name=>fs.readFileSync(path.join(__dirname,'../examples/PlanetZybex',name),'latin1')}});
    let count=0,reads=0;const update=p.update;p.setJoystickReader(port=>{assert.strictEqual(port,1);reads++;return shipOracle.frames[count].mask;});
    p.update=()=>{
      update();const f=shipOracle.frames[count++],channel=p.amalSnapshot().find(ch=>ch.number===15);
      assert.deepStrictEqual([p.spriteInfo('X Sprite',15),p.spriteInfo('Y Sprite',15),p.spriteInfo('I Sprite',15),p.amreg(0),p.amreg(23),p.amreg(22),p.amreg(24),p.amreg(25),channel.locals[0],channel.ended,channel.remaining,reads],[f.x,f.y,f.image,f.fire,f.rx,f.rw,f.dead,f.collision,f.r0,f.ended,f.remaining,f.reads],standard+' frame '+f.frame);
      assert.deepStrictEqual(JSON.parse(JSON.stringify(channel.animation)),f.animation);reads=0;
      const actual=p.display.canvasFrame();assert.strictEqual(crypto.createHash('sha256').update(actual.rgba).digest('hex'),f.rgbaSha256);
      if(f.png){const png=require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/planet-zybex',f.png)));assert.deepStrictEqual(Buffer.from(actual.rgba),Buffer.from(png.rgba));}
    };
    p.tick(10000);assert.strictEqual(p.amalSnapshot().length,9);p.sendKey('play');c.tick(2000);assert.strictEqual(count,89);assert.strictEqual(p.state.waiting,'key');p.sendKey('end');c.tick(0);assert.strictEqual(p.state.halted,true);assert.strictEqual(p.amalSnapshot().length,0);assert.strictEqual(c.pending(),0);p.stop();
  }
});
