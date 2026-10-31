'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {binary,token:t,integer:n,text,compile,execute}=require('./helpers/program');
const createAmal=require('../lib/amos/amal'),oracle=require('./fixtures/planet-zybex/amal-drop.json');
const plain=value=>JSON.parse(JSON.stringify(value)),hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function idle(source='Pause;') {
  const {program:p,timers:c}=execute(binary([[t('Synchro Off')],[t('Update Off')],[t('Bob'),n(0),t(','),n(0),t(','),n(0),t(','),n(0)],[t('Channel'),n(0),t('To'),t('Bob'),n(0)],[t('Amal'),n(0),t(','),text(source)],[t('Wait Key')]]));
  return {p,c};
}

test('AMAL: uppercase-initial scanner, single-letter labels, frozen owned IR and bounded unsupported syntax',()=>{
  const a=createAmal({globals:new Int16Array(26)}),code=a.compile('Begin: Let R0=2+3*4; Pause; Jump Begin');assert.ok(Object.isFrozen(code.ops[0].expr));assert.strictEqual(code.ops[2].destination,0);
  assert.strictEqual(a.compile('B:L R0=$FFFF;P;J B').ops[0].expr.value,-1);
  for(const source of ['Begin: P; Banana: P','Jump Gone','Wait','Let R0=(1+2)','Let R0=-RX','Let R0=1+'.repeat(100),'x'.repeat(32767)])assert.throws(()=>a.compile(source),/AMAL/);
  assert.strictEqual(a.compile('Let R0=1\0Unsupported').ops.length,2);
  assert.throws(()=>a.compile('Let R0='+Array(90).fill('1').join('+')),/depth 64/);
});

test('AMAL: word arithmetic is left associative; locals are private and globals share Amreg; Pause/End retain the native boundaries',()=>{
  const {p,c}=idle('Let R0=2+3*4; Let RJ=32767+1; Pause; Let RK=RJ/-1; Let RL=7/0; Let RM=3>2; End; Let RN=9');
  assert.strictEqual(c.pending(),0);p.synchro();assert.strictEqual(p.amreg(9),0);p.amalOn();p.synchro();assert.strictEqual(p.amreg(9),-32768);assert.strictEqual(p.amalSnapshot()[0].locals[0],20);assert.strictEqual(p.amreg(10),0);
  p.synchro();assert.deepStrictEqual([p.amreg(10),p.amreg(11),p.amreg(12),p.amreg(13)],[-32768,7,-1,0]);assert.strictEqual(p.amalSnapshot()[0].ended,true);p.amalOn();p.synchro();assert.strictEqual(p.amreg(13),0);p.installAmal(0,'Let X=-1/2');p.amalOn();p.synchro();assert.strictEqual(Object.is(p.bobs.get(0).x,-0),false);assert.strictEqual(p.bobInfo('X Bob',0),0);assert.strictEqual(c.pending(),0);p.stop();
});

test('AMAL: ten taken jumps yield, conditional fallthrough does not spend the jump quota, and numbered channels execute in ascending order',()=>{
  const {p}=idle('Begin: Let RJ=RJ+1;Jump Begin');p.amalOn();p.synchro();assert.strictEqual(p.amreg(9),10);p.synchro();assert.strictEqual(p.amreg(9),20);
  p.setChannel(1,'bob',()=>0);p.installAmal(1,'Let RJ=RJ+100;End');p.amalOn();p.synchro();assert.strictEqual(p.amreg(9),130);
  p.installAmal(0,'If RJ<0 Jump End; Let RJ=1;End: Pause');p.amalOn();p.synchro();assert.strictEqual(p.amreg(9),1);p.stop();
});

test('AMAL: MOVE matches independent native 8.8 slope/half-pixel traces, including negative deltas, overflow and nonpositive counts',()=>{
  for(const v of oracle.vectors){const {p}=idle(`Move ${v.dx},${v.dy},${v.steps};Let RJ=1`);p.amalOn();for(const position of v.positions){p.synchro();assert.deepStrictEqual([p.bobInfo('X Bob',0),p.bobInfo('Y Bob',0)],position);}assert.strictEqual(p.amreg(9),0);p.synchro();assert.strictEqual(p.amreg(9),1);assert.strictEqual(p.amalSnapshot()[0].ended,true);p.stop();}
  const {p}=idle('Move 10,0,3');p.amalOn();p.synchro();p.setBob(0,100,null,null);p.synchro();assert.strictEqual(p.bobInfo('X Bob',0),104);p.stop();
});

test('AMAL: coordinate functions use live hardware geometry/offsets and word screen selectors without changing selection or View',()=>{
  const {p}=idle('Let RJ=XS(9,200);Let RK=YS(1,100);Let RL=XH(1,100);Let RM=YH(1,100)');const d=p.display;d.open(1,640,200,16,0x8000);d.screenDisplay(1,128,60,320,100);d.screenOffset(1,10,20);d.select(0);p.amalOn();p.synchro();assert.deepStrictEqual([p.amreg(9),p.amreg(10),p.amreg(11),p.amreg(12)],[154,60,178,160]);assert.strictEqual(d.current,0);p.stop();
});

test('AMAL: installation captures binding/object identity; remapping does not retarget it, Bob writes retain ownership and Off deletes locals',()=>{
  const {p}=idle('Let X=X+1;Let R0=7;Pause;Let X=X+1');p.setBob(1,50,0,0);p.setChannel(0,'bob',()=>1);p.amalOn();p.synchro();assert.strictEqual(p.bobInfo('X Bob',0),1);assert.strictEqual(p.bobInfo('X Bob',1),50);
  p.setBob(0,100,null,null);p.synchro();assert.strictEqual(p.bobInfo('X Bob',0),101);const before=p.amalSnapshot();assert.ok(Object.isFrozen(before[0].locals));p.amalOff(0);assert.strictEqual(p.amalSnapshot().length,0);p.installAmal(0,'Pause');assert.deepStrictEqual(plain(p.amalSnapshot()[0].locals),Array(10).fill(0));assert.deepStrictEqual(plain(before[0].binding),{type:'bob',number:0});p.stop();
});

test('AMAL: malformed replacements preserve programs, target-resolution failures retire them, and unsupported bank forms reject with source context',()=>{
  const {p}=idle();const before=plain(p.amalSnapshot());assert.throws(()=>p.installAmal(0,'Wait'),/Unsupported AMAL/);assert.deepStrictEqual(plain(p.amalSnapshot()),before);p.setChannel(0,'bob',()=>63);assert.throws(()=>p.installAmal(0,'Pause'),/target not defined/);assert.strictEqual(p.amalSnapshot().length,0);
  for(const number of [-2,64]){assert.throws(()=>p.amalOn(number),/channel number/);assert.throws(()=>p.amalOff(number),/channel number/);}p.stop();
  assert.throws(()=>execute(binary([[t('Amal'),n(16),t(','),text('Pause')]])),/Automatic AMAL.*line 1/);
  assert.throws(()=>compile(binary([[t('Amal'),n(0),t(','),n(1)]])),/requires a string/);
  assert.throws(()=>idle('Wait'),/AMAL character 0 at line 5/);
});

test('AMAL: object/screen retirement, Sprite Off/resize and Default clear owned programs; Stop freezes manual steps and terminal errors cannot leave programs alive',()=>{
  const {p,c}=idle('Let X=X+1;Pause;Let X=X+1');p.amalOn();p.stop();p.synchro();assert.strictEqual(p.bobInfo('X Bob',0),0);c.tick(1000);p.resume();p.synchro();assert.strictEqual(p.bobInfo('X Bob',0),1);p.bobOff(0);assert.strictEqual(p.amalSnapshot().length,0);
  p.setBob(0,0,0,0);p.installAmal(0,'Pause');p.display.close(0);assert.strictEqual(p.amalSnapshot().length,0);p.setChannel(0,'sprite',()=>0);p.installAmal(0,'Let X=100');p.spriteOff(0);assert.strictEqual(p.amalSnapshot().length,0);p.installAmal(0,'Pause');p.setSpriteBuffer(48);assert.strictEqual(p.amalSnapshot().length,0);p.installAmal(0,'Pause');p.resetDefault();assert.strictEqual(p.amalSnapshot().length,0);p.installAmal(0,'Pause');p.stop();assert.strictEqual(c.pending(),0);
  const q=idle().p;q.sendKey('end');q.tick(1000);assert.strictEqual(q.state.halted,true);assert.strictEqual(q.amalSnapshot().length,0);
});

test('Update: manual Synchro changes object intent only; combined Update restores/draws/swaps Bobs and publishes direct Sprites',()=>{
  const {p}=idle('Let X=X+10;Pause');const d=p.display;d.clear(0);d.ink(3);d.bar(0,0,15,7);p.getBob(1,0,0,16,8);d.clear(0);p.doubleBuffer();d.autoback(0);p.setBob(0,20,20,1);p.hideOn();p.setSprite(0,138,60,1);p.flushBobs();assert.ok(d.screen().physicalPixels.every(v=>v===0));p.update();assert.strictEqual(d.screen().physicalPixels[20*320+20],3);
  const before=p.spriteBufferSnapshot().bytes;p.setChannel(1,'sprite',()=>0);p.installAmal(1,'Let X=X+10;Let A=1;Pause');p.amalOn();p.synchro();assert.strictEqual(p.bobInfo('X Bob',0),30);assert.strictEqual(p.spriteInfo('X Sprite',0),148);assert.strictEqual(d.screen().physicalPixels[20*320+20],3);assert.deepStrictEqual(p.spriteBufferSnapshot().bytes,before);
  p.update();assert.strictEqual(d.screen().physicalPixels[20*320+20],0);assert.strictEqual(d.screen().physicalPixels[20*320+30],3);assert.notDeepStrictEqual(p.spriteBufferSnapshot().bytes,before);p.stop();
});

test('Planet Zybex AMAL: original Bob 21 string executes all independent PAL/NTSC positions/pixels through real Wait Vbl/Synchro/Update',()=>{
  for(const hz of [50,60]){const {create}=compile(require('./helpers/planetZybexAmal')()),c=require('./helpers/fakeTimers').createFakeTimers(),p=create({vblHz:hz,displayOptions:{snapshotStandard:hz===50?'PAL':'NTSC'},now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,files:{read:name=>fs.readFileSync(path.join(__dirname,'../examples/PlanetZybex',name),'latin1')}});
    let count=0;const update=p.update;p.update=()=>{update();const f=oracle.frames[count++];assert.strictEqual(p.bobInfo('X Bob',21),f.x);assert.strictEqual(p.bobInfo('Y Bob',21),f.y);assert.strictEqual(p.amalSnapshot()[0].remaining,f.remaining);assert.strictEqual(p.amalSnapshot()[0].ended,f.ended);assert.strictEqual(hash(p.display.screen(1).pixels),f.indicesSha256);const actual=p.display.canvasFrame();assert.strictEqual(hash(actual.rgba),f.rgbaSha256);if(f.png){const png=require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/planet-zybex',f.png)));assert.deepStrictEqual(Buffer.from(actual.rgba),Buffer.from(png.rgba));}};
    p.tick(1000);assert.strictEqual(p.state.waiting,'key');p.sendKey('play');c.tick(1000);assert.strictEqual(count,14);assert.strictEqual(p.state.waiting,'key');p.sendKey('end');c.tick(0);assert.strictEqual(p.state.halted,true);assert.strictEqual(p.amalSnapshot().length,0);assert.strictEqual(c.pending(),0);p.stop();}
});

test('Planet Zybex: the complete unchanged source runs 40 input-only fields, real movement/firing/explosion and stops without a runtime gate',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'../examples/PlanetZybex/Zybex.AMOS'));assert.strictEqual(hash(raw),oracle.sourceSha256);const {create,transpiler}=compile(raw);assert.strictEqual(transpiler._ops.length,1122);
  for(const standard of ['PAL','NTSC']){
    const c=require('./helpers/fakeTimers').createFakeTimers(),p=create({print(){},vblHz:standard==='PAL'?50:60,displayOptions:{snapshotStandard:standard},now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,files:{read:name=>fs.readFileSync(path.join(__dirname,'../examples/PlanetZybex',name),'latin1')}});
    let frames=0;const update=p.update;p.setJoystickReader(port=>port===1?(frames<5?0:frames<15?8:frames<25?17:0):0);
    p.update=()=>{update();frames++;if(frames<=25){assert.strictEqual(p.spriteInfo('X Sprite',15),176+5*Math.max(0,Math.min(10,frames-5)));assert.strictEqual(p.spriteInfo('Y Sprite',15),124-5*Math.max(0,Math.min(10,frames-15)));assert.strictEqual(p.spriteInfo('I Sprite',15),Math.floor((frames-1)/5)%2?2:3);assert.strictEqual(p.state.variables.int_lives,5);}if(frames===20){assert.strictEqual(p.amreg(0),1);assert.ok(p.bobInfo('Y Bob',1)>0);}if(frames===40){assert.strictEqual(p.spriteInfo('Y Sprite',15),0);assert.strictEqual(p.spriteInfo('I Sprite',15),11);p.stop();}};
    p.tick(10000);c.tick(1000);assert.strictEqual(frames,40);assert.strictEqual(p.state.halted,false);assert.strictEqual(p.state.stopped,true);assert.strictEqual(p.amalSnapshot().length,17);assert.strictEqual(c.pending(),0);assert.deepStrictEqual(Array.from(p.state.input.joysticks),[0,0]);const old=p.display.renderDisplay();c.tick(1000);assert.strictEqual(frames,40);assert.deepStrictEqual(p.display.renderDisplay(),old);p.stop();
  }
});

test('AMAL coordinates: native YS/YH and XS/XH agree with Basic conversions under offsets, hires, signed-word wrapping and screen aliases',()=>{
  for(const mode of [0,0x8000])for(const value of [-32768,-1,0,100,32767]){
    const {p}=idle(`Let RJ=XS(9,${value});Let RK=YS(9,${value});Let RL=XH(9,${value});Let RM=YH(9,${value});End`);
    p.display.open(1,640,200,16,mode);p.display.screenDisplay(1,132,70,320,100);p.display.screenOffset(1,18,20);p.display.select(0);p.amalOn();p.synchro();
    assert.deepStrictEqual([9,10,11,12].map(i=>p.amreg(i)),['X Screen','Y Screen','X Hard','Y Hard'].map(name=>p.display.coordinate(name,1,value)));assert.strictEqual(p.display.current,0);p.stop();
  }
});

test('AMAL: XM/YM read current hardware mouse words and numbered Freeze retains only that channel',()=>{
  const {p}=idle('L: Let X=XM; Let Y=YM; Pause; Jump L');
  p.installAmal(1,'L: Let R0=R0+1; Pause; Jump L');p.amalOn();
  p.setMouse(301,209,0);p.synchro();assert.strictEqual(p.bobInfo('X Bob',0),301);assert.strictEqual(p.bobInfo('Y Bob',0),209);
  p.amalFreeze(0);p.setMouse(400,230,0);p.synchro();assert.strictEqual(p.bobInfo('X Bob',0),301);
  assert.strictEqual(p.amalSnapshot().find(c=>c.number===1).enabled,true);
  p.amalOn(0);p.synchro();assert.strictEqual(p.bobInfo('X Bob',0),400);p.stop();
});
