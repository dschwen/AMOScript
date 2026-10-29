'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {binary,token:t,integer:n,text,compile,execute}=require('./helpers/program'),createAmal=require('../lib/amos/amal');
const plain=x=>JSON.parse(JSON.stringify(x)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function idle(source) {
  return execute(binary([[t('Synchro Off')],[t('Update Off')],[t('Bob'),n(0),t(','),n(0),t(','),n(0),t(','),n(0)],[t('Channel'),n(0),t('To'),t('Bob'),n(0)],[t('Amal'),n(0),t(','),text(source)],[t('Wait Key')]]));
}

test('AMAL Autotest: validate block modes, global initial labels, conditional actions and paired register-only loops before installation',()=>{
  const a=createAmal({globals:new Int16Array(26)});
  for(const source of ['AUtotest(AU())','AUtotest(Move 1,2,3)','AUtotest(For R0=1 To 2;Next R0)','AUtotest(Pause)','eXit','Direct F;F:Pause','AUtotest(Jump Finish);Finish:Pause','Jump Auto;AUtotest(Auto:eXit)','Begin:Pause;AUtotest(Banana:eXit)','AUtotest(eXit','For R0=1 To 2','Next R0','For X=1 To 2;Next X','For R0=1 To 2;Next R1','If RA eXit'])assert.throws(()=>a.compile(source),/AMAL/);
  assert.ok(Object.isFrozen(a.compile('AUtotest(If RA Direct Finish);Finish:Pause').ops[1].action));
  assert.doesNotThrow(()=>a.compile('For RA=1 To 2;For R0=1 To 2;Next R0;Next RA'));
});

test('AMAL Autotest: activates at the declaration, runs before normal resumption on following calls, and has an independent twenty-jump quota',()=>{
  const {program:p}=idle('AUtotest(Loop:Let RA=RA+1;Jump Loop);Begin:Let RB=RB+1;P;Jump Begin');p.amalOn();assert.strictEqual(p.amalSnapshot()[0].autotest,false);p.synchro();assert.deepStrictEqual([p.amreg(0),p.amreg(1)],[0,1]);assert.strictEqual(p.amalSnapshot()[0].autotest,true);p.synchro();assert.deepStrictEqual([p.amreg(0),p.amreg(1)],[20,2]);p.synchro();assert.deepStrictEqual([p.amreg(0),p.amreg(1)],[40,3]);p.stop();
});

test('AMAL Direct: aborts an in-flight Move and starts the main target in the same pass; eXit preserves ordinary resumption',()=>{
  const {program:p}=idle('AUtotest(If RC Jump Hit;eXit;Hit:Direct Finish);Move 0,-12,6;Let RD=7;End;Finish:Let Y=100;Let RB=RB+1;P;Jump Finish');p.amalOn();p.synchro();assert.strictEqual(p.bobInfo('Y Bob',0),-2);assert.strictEqual(p.amalSnapshot()[0].remaining,6);
  p.synchro();assert.strictEqual(p.bobInfo('Y Bob',0),-4);assert.strictEqual(p.amalSnapshot()[0].remaining,5);p.setAmreg(2,1);p.synchro();assert.strictEqual(p.bobInfo('Y Bob',0),100);assert.deepStrictEqual([p.amreg(1),p.amreg(3)],[1,0]);assert.strictEqual(p.amalSnapshot()[0].remaining,0);p.setAmreg(2,0);p.synchro();assert.strictEqual(p.amreg(1),2);p.stop();
});

test('AMAL For/Next: evaluate both bounds before storing start, capture end, yield only on repeats and permit nested local/global loops',()=>{
  const {program:p}=idle('Let R0=4;For R0=1 To R0;Let RA=RA+1;Next R0;Let RB=R0;End');p.amalOn();for(let i=1;i<=4;i++){p.synchro();assert.strictEqual(p.amreg(0),i);assert.strictEqual(p.amalSnapshot()[0].locals[0],i+1);}assert.strictEqual(p.amreg(1),5);assert.strictEqual(p.amalSnapshot()[0].ended,true);
  p.installAmal(0,'For R0=1 To RC;Let RA=RA+1;Next R0;End');p.setAmreg(2,3);p.setAmreg(0,0);p.amalOn();p.synchro();p.setAmreg(2,0);p.synchro();p.synchro();assert.strictEqual(p.amreg(0),3);assert.strictEqual(p.amalSnapshot()[0].ended,true);
  p.installAmal(0,'For RA=1 To 2;For R0=1 To 2;Let RB=RB+1;Next R0;Next RA;End');p.setAmreg(1,0);p.amalOn();for(let i=0;i<4;i++)p.synchro();assert.strictEqual(p.amreg(1),4);assert.strictEqual(p.amalSnapshot()[0].ended,true);p.stop();
});

test('AMAL For/Next: native body-first and signed wrapping differ from a Basic pre-check; unentered For cells start with bound zero',()=>{
  const {program:p}=idle('For R0=3 To 1;Let RA=RA+1;Next R0;Let RB=R0;End');p.amalOn();p.synchro();assert.deepStrictEqual([p.amreg(0),p.amreg(1)],[1,4]);assert.strictEqual(p.amalSnapshot()[0].ended,true);
  p.installAmal(0,'For R0=32767 To 32767;Let RA=RA+1;Next R0');p.amalOn();p.synchro();assert.strictEqual(p.amalSnapshot()[0].locals[0],-32768);assert.strictEqual(p.amalSnapshot()[0].ended,false);p.synchro();assert.strictEqual(p.amalSnapshot()[0].locals[0],-32767);
  p.installAmal(0,'Jump Next;For R0=1 To 2;Next:Next R0;End');p.amalOn();p.synchro();assert.strictEqual(p.amalSnapshot()[0].locals[0],1);assert.strictEqual(p.amalSnapshot()[0].ended,true);p.stop();
});

test('AMAL AU() and End: disable the active test; an End reached in Autotest also stops normal execution',()=>{
  const {program:p}=idle('AUtotest(Let RA=RA+1);P;AU();Let RB=2;P;End');p.amalOn();p.synchro();assert.strictEqual(p.amreg(0),0);p.synchro();assert.deepStrictEqual([p.amreg(0),p.amreg(1)],[1,2]);assert.strictEqual(p.amalSnapshot()[0].autotest,false);p.synchro();assert.strictEqual(p.amreg(0),1);
  p.installAmal(0,'AUtotest(End);Begin:Let RA=RA+1;P;Jump Begin');p.setAmreg(0,0);p.amalOn();p.synchro();p.synchro();assert.strictEqual(p.amreg(0),1);assert.strictEqual(p.amalSnapshot()[0].ended,true);assert.strictEqual(p.amalSnapshot()[0].autotest,false);p.stop();
});

test('AMAL BC: reuse live Bob masks/owner/range and the shared collision table without generating masks or drawing',()=>{
  const {program:p}=idle('Begin:AUtotest(If BC(0,1,8) Direct Finish;eXit);P;Jump Begin;Finish:Let RJ=RJ+10;End'),d=p.display;
  d.clear(1);p.getBob(1,0,0,16,16);d.clear(0);p.setBob(0,100,100,1);p.setBob(1,100,100,1);p.amalOn();const version=d.version;p.synchro();p.synchro();assert.strictEqual(p.amreg(9),0);assert.strictEqual(p.banks.get(1).images[0].mask,null);assert.strictEqual(d.version,version);assert.strictEqual(p.collisionInfo(1),0);
  p.update();d.open(1,16,16,2,0);p.synchro();assert.strictEqual(p.amreg(9),10);assert.strictEqual(p.collisionInfo(1),-1);assert.strictEqual(d.current,1);
  p.installAmal(0,'Let RA=BC(-1,1,8);End');p.amalOn();p.synchro();assert.strictEqual(p.amreg(0),0);assert.strictEqual(p.collisionInfo(1),0);p.stop();
});

test('AMAL Autotest failures retain the executing test character and installation location, not a suspended Move offset',()=>{
  const a=createAmal({globals:new Int16Array(26),resolve:()=>({alive:()=>true,read:()=>0,write(){}}),bobCollision(){throw Error('collision failure');}});
  a.install(0,'AUtotest(If BC(0,1,8) Jump Hit;eXit;Hit:eXit);Move 0,10,10',{type:'bob',number:0},{line:7,offset:123});a.control(null,true);a.step();assert.throws(()=>a.step(),/collision failure in AMAL channel 0, character 9 at line 7, byte 123/);
});

test('Planet Zybex missile: unchanged first enemy Autotest/Move/delay runs match independent world/image/mask traces in PAL/NTSC',()=>{
  const oracle=require('./fixtures/planet-zybex/amal-missile.json');for(const testCase of oracle.cases)for(const hz of [50,60]){
    const {create}=compile(require('./helpers/planetZybexMissile')(testCase.bullet)),c=require('./helpers/fakeTimers').createFakeTimers(),p=create({vblHz:hz,displayOptions:{snapshotStandard:hz===50?'PAL':'NTSC'},now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,files:{read:name=>fs.readFileSync(path.join(__dirname,'../examples/PlanetZybex',name),'latin1')}});let count=0;const update=p.update;
    p.update=()=>{update();const f=testCase.frames[count++],channel=p.amalSnapshot()[0];assert.deepStrictEqual([p.bobInfo('X Bob',20),p.bobInfo('Y Bob',20),p.amreg(9),channel.remaining,channel.locals[0],channel.locals[1],channel.autotest],[f.x,f.y,f.score,f.remaining,f.r0,f.r1,f.autotest]);assert.strictEqual(p.collisionInfo(1),f.collision?-1:0);assert.strictEqual(hash(p.display.screen(1).pixels),f.indicesSha256);const actual=p.display.canvasFrame();assert.strictEqual(hash(actual.rgba),f.rgbaSha256);if(f.png){const png=require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/planet-zybex',f.png)));assert.deepStrictEqual(Buffer.from(actual.rgba),Buffer.from(png.rgba));}};
    p.tick(1000);p.sendKey('go');c.tick(2000);assert.strictEqual(count,81);assert.strictEqual(p.state.waiting,'key');p.sendKey('end');c.tick(0);assert.strictEqual(p.amalSnapshot().length,0);assert.strictEqual(c.pending(),0);p.stop();
  }
});

test('Planet Zybex missile: Stop/Resume preserves an armed Autotest and flight/delay state without missed-pass catch-up',()=>{
  const {program:p,timers:c}=execute(require('./helpers/planetZybexMissile')(true),1000,{files:{read:name=>fs.readFileSync(path.join(__dirname,'../examples/PlanetZybex',name),'latin1')}});p.sendKey('go');c.tick(100);assert.strictEqual(p.state.variables.int_frame,6);assert.strictEqual(p.amreg(9),0);p.stop();const before=plain(p.amalSnapshot());c.tick(1000);p.synchro();assert.deepStrictEqual(plain(p.amalSnapshot()),before);assert.strictEqual(c.pending(),0);p.resume();c.tick(2000);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.amreg(9),20);p.stop();assert.strictEqual(c.pending(),0);
});
