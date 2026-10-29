'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {binary,token:t,integer:n,text,compile,execute}=require('./helpers/program');
const vectors=require('./fixtures/planet-zybex/amal-random-vectors.json'),plain=x=>JSON.parse(JSON.stringify(x)),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function idle(source='Begin:Let R0=Z(RA);P;Jump Begin',options={}) {
  return execute(binary([[t('Synchro Off')],[t('Update Off')],[t('Bob'),n(0),t(','),n(0),t(','),n(0),t(','),n(0)],[t('Channel'),n(0),t('To'),t('Bob'),n(0)],[t('Amal'),n(0),t(','),text(source)],[t('Wait Key')]]),1000,options);
}

test('AMAL Z: cold seed and all word/mask/beam transitions match independent Python vectors',()=>{
  for(const draws of vectors.vectors){let calls=0;const {program:p}=idle(undefined,{readAmalBeam:()=>draws[calls++].beam});assert.deepStrictEqual(plain(p.amalRandomState()),{seed:0x1234});p.amalOn();for(const expected of draws){p.setAmreg(0,expected.mask);p.synchro();assert.strictEqual(p.amalSnapshot()[0].locals[0],expected.value);assert.strictEqual(p.amalRandomState().seed,expected.seed);}assert.strictEqual(calls,draws.length);p.stop();}
});

test('AMAL Z: zero advances, negative masks retain signed word results, and a word carry must not reach the product high word',()=>{
  const {program:p}=idle();p.amalOn();p.setAmreg(0,0);p.synchro();assert.strictEqual(p.amalSnapshot()[0].locals[0],0);assert.strictEqual(p.amalRandomState().seed,vectors.vectors[0][0].seed);p.setAmreg(0,-1);p.synchro();assert.strictEqual(p.amalSnapshot()[0].locals[0],vectors.vectors[0][1].value);p.stop();
  const {program:q}=idle(undefined,{readAmalBeam:()=>65535});q.setAmreg(0,-1);q.amalOn();q.synchro();const product=0x1234*0x3171,naive=((product+65536)>>>8)<<16>>16,actual=q.amalSnapshot()[0].locals[0];assert.strictEqual(actual,(product>>>8)<<16>>16);assert.notStrictEqual(actual,naive);q.stop();
});

test('AMAL Z: programs share one stream in ascending channel order; compilation/On do not consume it and mask expressions evaluate before the next draw',()=>{
  const beam=0,draws=vectors.vectors[0];let calls=0;const {program:p}=idle('Let R0=Z(0);P',{readAmalBeam:()=>{calls++;return beam;}});p.setChannel(1,'bob',()=>0);p.installAmal(1,'Let R0=Z(-1);P');assert.strictEqual(calls,0);p.amalOn();assert.strictEqual(calls,0);p.synchro();assert.strictEqual(p.amalSnapshot()[0].locals[0],draws[0].value);assert.strictEqual(p.amalSnapshot()[1].locals[0],draws[1].value);assert.strictEqual(p.amalRandomState().seed,draws[1].seed);assert.strictEqual(calls,2);
  p.amalOff();p.installAmal(0,'Let RA=Z(Z(0));P');p.amalOn();p.synchro();assert.strictEqual(calls,4);assert.strictEqual(p.amalRandomState().seed,draws[3].seed);assert.strictEqual(p.amreg(0),0);p.stop();
});

test('AMAL Z: independent factories, Basic Randomize/Rnd separation, immutable diagnostics and native Default/Off seed retention',()=>{
  const {program:p,timers:c}=idle(),{program:q}=idle();p.randomize(123);const basic=plain(p.state.random);p.amalOn();p.setAmreg(0,0);p.synchro();assert.deepStrictEqual(plain(p.state.random),basic);assert.strictEqual(q.amalRandomState().seed,0x1234);const old=p.amalRandomState();assert.ok(Object.isFrozen(old));p.rnd(-100);assert.strictEqual(p.amalRandomState().seed,old.seed);
  p.amalOff();assert.strictEqual(p.amalRandomState().seed,old.seed);p.resetDefault();assert.strictEqual(p.amalRandomState().seed,old.seed);p.synchroOff();p.setBob(0,0,0,0);p.setChannel(0,'bob',()=>0);p.installAmal(0,'Let R0=Z(-1);P');p.amalOn();p.synchro();assert.strictEqual(p.amalRandomState().seed,vectors.vectors[0][1].seed);assert.strictEqual(old.seed,vectors.vectors[0][0].seed);p.stop();q.stop();assert.strictEqual(c.pending(),0);
});

test('AMAL Z: invalid/async/throwing beam readers preserve the pending draw and assignment with executing/installation context',()=>{
  for(const result of [-1,65536,1.5,NaN,undefined,Promise.resolve(0)]){const {program:p}=idle('Let RA=Z(0);P',{readAmalBeam:()=>result});p.amalOn();assert.throws(()=>p.synchro(),/AMAL beam reader.*channel 0, character 0 at line 5/);assert.strictEqual(p.amalRandomState().seed,0x1234);assert.strictEqual(p.amreg(0),0);p.stop();}
  assert.throws(()=>idle(undefined,{readAmalBeam:1}),/readAmalBeam must be a synchronous function/);
  const {program:q}=idle('Let RA=Z(0);P',{readAmalBeam(){throw Error('beam failed');}});q.amalOn();assert.throws(()=>q.synchro(),/beam failed in AMAL channel 0/);assert.strictEqual(q.amalRandomState().seed,0x1234);q.stop();
  let calls=0;const {program:p}=idle('Let RA=Z(Z(0));P',{readAmalBeam:()=>++calls===1?0:65536});p.amalOn();assert.throws(()=>p.synchro(),/AMAL beam reader/);assert.strictEqual(p.amalRandomState().seed,vectors.vectors[0][0].seed);assert.strictEqual(p.amreg(0),0);p.stop();
});

test('AMAL Z: beam callbacks cannot recursively step or continue a retired/stopped program',()=>{
  for(const action of ['reenter','off','default','stop']){let p;({program:p}=idle('Let RA=Z(0);Let RB=99;P',{readAmalBeam:()=>{if(action==='reenter')p.synchro();else if(action==='off')p.amalOff();else if(action==='default')p.resetDefault();else p.stop();return 0;}}));p.amalOn();assert.throws(()=>p.synchro(),/Reentrant AMAL|AMAL changed during random beam read/);assert.strictEqual(p.amalRandomState().seed,0x1234);assert.strictEqual(p.amreg(1),0);p.stop();}
});

test('AMAL Z: source-instruction beam failures halt/clean the VM once; Stop/Resume preserves successful stream position',()=>{
  let calls=0;const {create}=compile(binary([[t('Synchro Off')],[t('Bob'),n(0),t(','),n(0),t(','),n(0),t(','),n(0)],[t('Channel'),n(0),t('To'),t('Bob'),n(0)],[t('Amal'),n(0),t(','),text('Let RA=Z(0);P')],[t('Amal On')],[t('Synchro')],[t('Wait Key')]]));
  const c=require('./helpers/fakeTimers').createFakeTimers(),p=create({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,readAmalBeam:()=>{calls++;return -1;}});
  assert.throws(()=>p.tick(1000),error=>{assert.match(error.message,/AMAL beam reader.*at line 4/);assert.strictEqual((error.message.match(/ at line /g)||[]).length,1);return true;});assert.strictEqual(p.state.halted,true);assert.strictEqual(p.amalSnapshot().length,0);assert.strictEqual(p.amalRandomState().seed,0x1234);assert.strictEqual(c.pending(),0);c.tick(1000);assert.strictEqual(calls,1);p.stop();
  const {program:q,timers:d}=idle();q.amalOn();q.synchro();const before=q.amalRandomState();q.stop();d.tick(1000);q.synchro();assert.strictEqual(q.amalRandomState().seed,before.seed);q.resume();q.synchro();assert.strictEqual(q.amalRandomState().seed,vectors.vectors[0][1].seed);q.stop();
});

test('Planet Zybex hunters: three unchanged random/coordinate/movement/delay programs share the independently traced stream in PAL/NTSC',()=>{
  const oracle=require('./fixtures/planet-zybex/amal-hunters.json');for(const testCase of oracle.cases)for(const hz of [50,60]){let calls=0;const {create}=compile(require('./helpers/planetZybexHunters')()),c=require('./helpers/fakeTimers').createFakeTimers(),p=create({vblHz:hz,displayOptions:{snapshotStandard:hz===50?'PAL':'NTSC'},now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,readAmalBeam:()=>{calls++;return testCase.beam;},files:{read:name=>fs.readFileSync(path.join(__dirname,'../examples/PlanetZybex',name),'latin1')}});let count=0;const update=p.update;p.update=()=>{update();const f=testCase.frames[count++];assert.strictEqual(p.amreg(9),f.score);assert.deepStrictEqual([p.amalRandomState().seed,calls],[f.seed,f.calls]);for(const h of f.hunters){const channel=p.amalSnapshot().find(x=>x.number===h.number);assert.deepStrictEqual([p.bobInfo('X Bob',h.number),p.bobInfo('Y Bob',h.number),channel.remaining,channel.autotest], [h.x,h.y,h.remaining,h.autotest]);assert.deepStrictEqual(plain(channel.locals),h.locals);}assert.strictEqual(hash(p.display.screen(1).pixels),f.indicesSha256);const actual=p.display.canvasFrame();assert.strictEqual(hash(actual.rgba),f.rgbaSha256);if(f.png){const png=require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/planet-zybex',f.png)));assert.deepStrictEqual(Buffer.from(actual.rgba),Buffer.from(png.rgba));}};p.tick(1000);p.sendKey('go');c.tick(2000);assert.strictEqual(count,81);assert.strictEqual(p.state.waiting,'key');p.sendKey('end');c.tick(0);assert.strictEqual(p.amalSnapshot().length,0);assert.strictEqual(c.pending(),0);p.stop();}
});
