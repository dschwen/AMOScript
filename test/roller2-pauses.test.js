/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const create=require('./helpers/program').compile(require('./helpers/roller2ConnectedMenu')({pauses:true})).create;
const expected=require('./fixtures/roller2/levels.json');
const frames=require('./fixtures/roller2/pauses.json').frames;
function image(p,index){const rgba=Buffer.from(p.display.canvasFrame().rgba),expectedPng=require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/roller2',frames[index].png))).rgba;assert.deepStrictEqual(rgba,Buffer.from(expectedPng));assert.strictEqual(crypto.createHash('sha256').update(rgba).digest('hex'),frames[index].rgbaSha256);}
function levelTwo(run){collect(run);run.p.setJoystick(1,16);run.clock.tick(800);run.p.setJoystick(1,0);}
function start({missing=false}={}){
  const clock=require('./helpers/fakeTimers').createFakeTimers(4),events=[],reads=[],bonus=[];
  const directory=path.join(__dirname,'../examples/Roller2'),names=Object.keys(require('../examples/Roller2/manifest.json').files),find=name=>names.find(file=>file.toLowerCase()===name.replace(/^rii:/i,'').toLowerCase());
  let p;
  p=create({print(value){if(p&&value==='Score  :'&&p.state.variables.int_lv===2&&p.state.variables.int_cnt<=expected.bonusUpper)bonus.push({score:p.state.variables.int_hi,timer:p.timer()});},audio:{command:event=>events.push(event)},files:{isDirectory:name=>name==='RII:',exists:name=>!(missing&&name.toLowerCase()==='rii:levl/2')&&!!find(name),read(name){reads.push(name);return fs.readFileSync(path.join(directory,find(name))).toString('latin1');},write(){throw Error('Unexpected write');}},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
  p.tick(1000);clock.tick(1000);p.sendKey('a');clock.tick(1840);p.setMouse(158,182,1);clock.tick(1300);p.setMouse(158,182,0);clock.tick(560);p.setJoystick(1,16);clock.tick(700);p.setJoystick(1,0);
  return{p,clock,events,reads,bonus};
}
function collect(run,last=12200){for(const end of [6600,8000,9400,10800,last]){run.p.setJoystick(1,8);run.clock.tick(20);run.p.setJoystick(1,0);run.clock.tick(end-run.clock.now());}}
function close(run){run.p.stop();assert.strictEqual(run.clock.pending(),0);}


test('Roller2 pause: original Help/mouse paid pause charges elapsed seconds and restores Timer, clearing the full paused text row',()=>{
  for(const mode of ['help','mouse']){
    const run=start(),{p,clock}=run;levelTwo(run);const before=Buffer.from(p.banks.get(10).data),time=p.timer(),notes=run.events.filter(e=>e.type==='play').length;
    if(mode==='help')p.setKeyState(95,true);else p.setMouse(100,100,1);
    clock.tick(2040);assert.deepStrictEqual([p.state.variables.int_tim,p.state.variables.int_oh,p.state.variables.int_hi],[time,227,225]);image(p,0);
    assert.strictEqual(p.state.tracker.playing,true);assert.strictEqual(p.state.tracker.paused,false);assert.ok(run.events.filter(e=>e.type==='play').length>notes);
    if(mode==='help')p.setKeyState(95,false);else p.setMouse(100,100,0);
    clock.tick(100);assert.strictEqual(p.state.variables.int_hi,225);assert.strictEqual(p.timer(),time+5);assert.deepStrictEqual(Buffer.from(p.banks.get(10).data),before);assert.strictEqual(p.state.stack.length,0);assert.strictEqual(p.state.variables.string_selection,'');
    close(run);
  }
});

test('Roller2 pause: unchanged Space path presents icon 78 and restores palette/sprite/negative Timer through keyboard, mouse or joystick WTIN',()=>{
  for(const mode of ['key','mouse','gamepad']){
    const run=start(),{p,clock}=run;levelTwo(run);const before=Buffer.from(p.banks.get(10).data),palette=Array.from(p.display.screen(0).palette);
    p.setKeyState(95,true);clock.tick(2040);p.setKeyState(95,false);clock.tick(100);
    const entry=p.timer();p.sendKey(' ');clock.tick(400);assert.strictEqual(p.state.variables.int_tim,entry-30);assert.strictEqual(p.display.screen(1).hidden,false);assert.ok(Array.from(p.sprites.values()).every(sprite=>sprite.image===0));assert.ok(p.display.screen(0).palette.every(c=>c===0));image(p,1);
    if(mode==='key')p.sendKey('a');else if(mode==='mouse')p.setMouse(100,100,1);else p.setJoystick(1,16);
    clock.tick(20);p.setMouse(100,100,0);p.setJoystick(1,0);clock.tick(580);assert.strictEqual(p.display.screen(1).hidden,true);assert.strictEqual(p.sprites.get(1).x,256);assert.strictEqual(p.sprites.get(1).y,66);assert.deepStrictEqual(Array.from(p.display.screen(0).palette),palette);image(p,2);
    assert.strictEqual(p.state.variables.int_hi,225);assert.strictEqual(p.timer(),-4);assert.deepStrictEqual(Buffer.from(p.banks.get(10).data),before);assert.strictEqual(p.state.stack.length,0);assert.strictEqual(p.state.variables.string_selection,'');close(run);
  }
});

test('Roller2 pause: host Stop freezes the pause popup and resumes WTIN without replaying its entry or losing the captured Timer',()=>{
  const run=start(),{p,clock}=run;levelTwo(run);p.sendKey(' ');clock.tick(400);const saved=p.state.variables.int_tim,frame=p.display.canvasFrame(),ip=p.state.ip;
  p.stop();clock.tick(1000);assert.strictEqual(p.state.ip,ip);assert.deepStrictEqual(p.display.canvasFrame().rgba,frame.rgba);assert.strictEqual(p.state.tracker.paused,true);assert.strictEqual(clock.pending(),0);
  p.resume();p.sendKey('a');clock.tick(600);assert.strictEqual(p.display.screen(1).hidden,true);assert.strictEqual(p.state.variables.int_tim,saved);assert.strictEqual(p.state.variables.int_hi,227);assert.strictEqual(p.state.stack.length,0);assert.strictEqual(p.state.tracker.playing,true);close(run);
});

test('Roller2 pause: zero-score Help is ignored and paid pause exits naturally when score is exhausted even while Help remains held',()=>{
  const run=start(),{p,clock}=run;p.setKeyState(95,true);clock.tick(100);assert.strictEqual(p.state.variables.int_hi,0);assert.strictEqual(p.state.variables.int_oh,0);p.setKeyState(95,false);
  p.setJoystick(1,8);clock.tick(20);p.setJoystick(1,0);clock.tick(800);assert.strictEqual(p.state.variables.int_hi,10);
  p.setKeyState(95,true);clock.tick(10200);assert.strictEqual(p.state.variables.int_hi,0);assert.strictEqual(p.keyState(95),-1);assert.strictEqual(p.state.variables.string_selection,'');assert.strictEqual(p.state.stack.length,0);assert.ok(p.timer()>=500);p.setKeyState(95,false);close(run);
});
