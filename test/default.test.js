'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {binary,token:t,word:w,dword,integer:n,identifier:id,text,execute,compile}=require('./helpers/program');
const expected=require('./fixtures/defaults.json'),hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const idle=options=>execute(binary([[t('Wait Key')]]),1000,options);

test('Default: independent opcode and original Zybex prefix restore shipped screen/palette/flash, then close it and run the original Sprite-buffer allocation',()=>{
  for(const standard of ['PAL','NTSC']){const calls=[],{program:p,timers:c}=execute(require('./helpers/planetZybexDefault')(),1000,{vblHz:standard==='PAL'?50:60,displayOptions:{snapshotStandard:standard},system:{command:name=>calls.push(name)}});
    assert.strictEqual(p.state.waiting,'key');assert.deepStrictEqual(Array.from(p.display.screen().palette),expected.palette);assert.strictEqual(hash(p.display.canvasFrame().rgba),expected.initialSha256);assert.strictEqual(p.banks.get(1).images.length,47);assert.strictEqual(p.banks.get(5).name,'Samples ');assert.deepStrictEqual([p.mouseVisible(),p.mouseShape()],[true,1]);assert.strictEqual(p.state.flashes.length,1);
    p.sendKey('continue');c.tick(0);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.display.screens.size,0);assert.strictEqual(p.display.canvasFrame(),null);assert.deepStrictEqual(calls,['Close Editor']);assert.strictEqual(c.pending(),0);p.sendKey('finish');c.tick(0);assert.strictEqual(p.state.halted,true);
  }
  const p=execute(binary([[w(0x0cee)],[t('Wait Key')]])).program;assert.strictEqual(p.display.current,0);p.stop();
});

test('Default: retires clones, staged windows, buffers, Bobs, rainbows and old palette jobs; snapshots and bank addresses retain ownership',()=>{
  const {program:p,timers:c}=idle(),d=p.display;d.clear(0);d.ink(2);d.bar(0,0,15,7);p.getBob(1,0,0,16,8);p.getIcon(1,0,0,16,8);p.reserveWork(6,16);const bank=p.banks.get(6),address=p.bankStart(6);p.poke(address,123);const image=p.banks.get(1).images[0],icon=p.banks.get(2).images[0];
  d.open(1,320,200,16,0);d.clone(2);d.select(0);p.doubleBuffer();p.hideOn();p.setBob(0,30,30,1);p.updateBobs();p.setSprite(0,140,80,1);p.updateSprites();d.screenToFront(0);d.setRainbow(0,0,16,'','','');d.rainbow(0,0,50,4);p.priorityOn();p.priorityReverseOn();
  const old=d.screen(),snapshot=d.snapshotDisplay(),chip=snapshot.chip.slice();d.autoViewOff();d.close(2);d.open(3,320,200,16,0);d.clone(4);d.writing(2,2);d.setLine(0xaaaa);d.locate(9,8);d.setTab(12);
  for(let i=0;i<16;i++)p.flash(i,'(f00,3)');p.fade(2);p.resetDefault();
  assert.deepStrictEqual([...d.screens.keys()],[0]);assert.notStrictEqual(d.screen(),old);assert.strictEqual(d.autoView,true);assert.strictEqual(d.rainbows.size,0);assert.strictEqual(p.bobs.size,0);assert.strictEqual(p.spriteInfo('I Sprite',0),0);assert.deepStrictEqual([p.spriteInfo('X Sprite',0),p.spriteInfo('Y Sprite',0)],[140,80]);
  const s=d.screen();assert.deepStrictEqual([s.doubleBuffered,s.autoback,s.hidden,s.cloneOwner,s.linePattern,s.textEscape,s.x,s.y,s.tabSize,s.writingActive],[false,0,false,null,65535,'',0,0,4,false]);assert.strictEqual(s.pixels,s.physicalPixels);assert.ok(s.pixels.every(v=>v===1));assert.strictEqual(p.state.fade.active,false);assert.deepStrictEqual(Array.from(p.state.flashes,j=>[j.screen,j.colour]),[[0,3]]);assert.strictEqual(c.pending(),1);
  assert.strictEqual(p.banks.get(6),bank);assert.strictEqual(p.bankStart(6),address);assert.strictEqual(p.peek(address),123);assert.strictEqual(p.banks.get(1).images[0],image);assert.strictEqual(p.banks.get(2).images[0],icon);d.snapshotDisplay();assert.deepStrictEqual(snapshot.chip,chip);p.getBob(2,0,0,16,8);d.clear(0);p.setBob(0,30,30,1);p.setBob(1,30,30,2);p.updateBobs();assert.strictEqual(d.screen().pixels[30*320+30],1);p.stop();assert.strictEqual(c.pending(),0);
});

test('Default: flash follows all sixteen shipped colours, resets capacity and cancels on replacement/Stop without stale wakes',()=>{
  const {program:p,timers:c}=execute(binary([[t('Default')],[t('Wait Key')]]));
  for(let step=0;step<34;step++){c.tick(step?40:20);assert.strictEqual(p.display.screen().palette[3],expected.flash[step%16]);}
  p.stop();assert.strictEqual(c.pending(),0);const before=p.display.screen().palette[3];c.tick(1000);assert.strictEqual(p.display.screen().palette[3],before);p.resume();p.resetDefault();assert.strictEqual(p.state.flashes.length,1);p.display.open(0,320,200,16,0);assert.deepStrictEqual(Array.from(p.display.screen().palette),expected.palette);assert.strictEqual(p.state.flashes.length,0);assert.strictEqual(c.pending(),0);p.stop();
});

test('Default: preserves variables, call/local frames, DATA position, Timer, random stream, files/directory and held/queued input',()=>{
  const files=require('../lib/amos/files').createMemoryFiles({'saves/a':'abc'},[],['saves/']);
  const {program:p,timers:c}=execute(binary([[id('a'),t('='),n(17)],[t('Data'),w(0),n(9),t(','),n(10)],[t('Read'),id('d')],[t('Procedure'),dword(0),w(0),0,0,id('reset')],[id('a'),t('='),n(42)],[t('Default')],[t('End Proc'),t('['),id('a'),t(']')],[id('reset',0x12)],[t('Wait Key')]]),1000,{files});
  assert.strictEqual(p.state.variables.int_a,17);assert.strictEqual(p.state.param.integer,42);assert.strictEqual(p.state.data.index,1);p.setDirectory('saves/');p.fileOpen(1,'a','Open In');const randomBefore=JSON.stringify(p.state.random);p.setTimer(1234);p.setKeyState(17,true);p.setJoystick(1,18);p.putKeys('abc');const queued=p.state.input.keys.slice();p.limitMouse(10,20,100,120);const limits=p.state.input.mouseLimits;p.setMouse(30,40,1);p.keySpeed(20,5);
  p.resetDefault();assert.strictEqual(p.currentDirectory(),'saves/');assert.strictEqual(p.fileInfo('Lof',1),3);assert.strictEqual(p.timer(),1234);assert.strictEqual(JSON.stringify(p.state.random),randomBefore);assert.deepStrictEqual(p.state.input.keys,queued);assert.strictEqual(p.keyState(17),-1);assert.strictEqual(p.joystickInfo('Joy',1),18);assert.strictEqual(p.state.input.mouseLimits,limits);assert.strictEqual(p.state.input.mouse.buttons,1);assert.strictEqual(p.state.variables.int_a,17);p.fileClose(1);p.stop();
});

test('Default: native mouse bounds replace an unset/zero minimum but preserve explicit bounds; auto Bob/Sprite updates stay off until enabled',()=>{
  const {program:p}=idle(),d=p.display;p.limitMouse(0,0,100,100);p.changeMouse(3);p.hideOn();p.breakOff();p.resetDefault();assert.strictEqual(p.state.breakEnabled,true);assert.deepStrictEqual({...p.state.input.mouseLimits},{x1:129,y1:50,x2:448,y2:249});assert.deepStrictEqual([p.mouseShape(),p.mouseVisible()],[1,true]);
  d.clear(0);d.ink(2);d.bar(0,0,15,7);p.getBob(1,0,0,16,8);d.clear(0);p.setBob(0,30,30,1);p.setSprite(0,140,80,1);p.flushBobs();assert.strictEqual(d.screen().pixels[30*320+30],0);assert.strictEqual(p.spriteInfo('I Sprite',0),1);p.bobUpdateOn();p.spriteUpdateOn();p.flushBobs();assert.strictEqual(d.screen().pixels[30*320+30],2);p.stop();
});

test('Default: Music/Tracker/sample reset cancels wakes and loops without replacing banks or changing the LED/filter',()=>{
  const musicDir=path.join(__dirname,'../examples/Roller2/music');
  for(const kind of ['tracker','music','sample']){const events=[],{program:p,timers:c}=execute(require('./helpers/planetZybexDefault')(),1000,{files:{read:name=>fs.readFileSync(path.join(musicDir,name),'latin1')},audio:{command:e=>events.push(e)}});p.flashOff();p.ledOff();
    if(kind==='tracker'){p.trackLoad('mod.Roller_II_mus',6);p.trackLoopOn();p.trackPlay(6);}else if(kind==='music'){p.loadBanks('Over.mus');p.musicVolume(12);p.musicPlay(1);}else{p.samLoopOn();p.samPlay(1);p.samBank(9);}
    c.tick(40);const banks=[...p.banks].map(([n,b])=>[n,b,b.data&&hash(b.data)]);p.resetDefault();p.flashOff();assert.strictEqual(c.pending(),0);assert.strictEqual(p.state.tracker.playing,false);assert.strictEqual(p.state.tracker.loop,false);assert.strictEqual(p.state.music.playing,false);assert.strictEqual(p.state.music.volume,56);assert.deepStrictEqual({...p.state.audio},{bank:5,loopMask:0,filterEnabled:false});for(const [n,b,h]of banks){assert.strictEqual(p.banks.get(n),b);if(h)assert.strictEqual(hash(b.data),h);}const plays=events.filter(e=>e.type==='play').length;c.tick(1000);assert.strictEqual(events.filter(e=>e.type==='play').length,plays);p.stop();}
});

test('Default: regenerates portable Boom noise from retained seed/phase; failing or reentrant hosts halt once with source context',()=>{
  const {program:p,timers:c}=execute(binary([[t('Default')],[t('Wait Key')]]));let noise=p.audio.noiseState();assert.strictEqual(noise.seed,expected.noiseFirst.seed);assert.strictEqual(hash(noise.wave),expected.noiseFirst.sha256);p.boom();c.tick(40);p.resetDefault();noise=p.audio.noiseState();assert.strictEqual(noise.seed,expected.noiseAfterTwoFieldsAndReset.seed);assert.strictEqual(hash(noise.wave),expected.noiseAfterTwoFieldsAndReset.sha256);assert.strictEqual(noise.pointer,478);assert.strictEqual(noise.mask,0);p.stop();
  const bad=idle({audioNoiseBeam:-1}).program,old=bad.display.screen();assert.throws(()=>bad.resetDefault(),/Invalid Boom noise/);assert.strictEqual(bad.display.screen(),old);bad.stop();
  const {create}=compile(binary([[t('Default')],[t('Wait Key')]]));for(const nested of [false,true]){const timers=require('./helpers/fakeTimers').createFakeTimers();let q,calls=0;q=create({now:timers.now,setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout,audio:{command(e){if(e.type==='stop'&&!calls++){if(nested)q.resetDefault();else throw Error('reset host failed');}}}});assert.throws(()=>q.tick(1000),/reset host failed.*line 1|Reentrant Default.*line 1/);assert.strictEqual(q.state.halted,true);assert.strictEqual(timers.pending(),0);const count=calls;timers.tick(1000);assert.strictEqual(calls,count);}
});
