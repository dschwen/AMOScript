/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {compile}=require('./helpers/program'),expected=require('./fixtures/roller2/initialization.json'),checkInitialization=require('./helpers/checkRoller2Initialization');
const names=Object.keys(require('../examples/Roller2/manifest.json').files),create=compile(require('./helpers/roller2ConnectedMenu')()).create;
function start(){
  const clock=require('./helpers/fakeTimers').createFakeTimers(4),reads=[],events=[];
  const find=name=>names.find(file=>file.toLowerCase()===name.replace(/^rii:/i,'').toLowerCase());
  const files={isDirectory:name=>name==='RII:',exists:name=>!!find(name),read(name){reads.push(name);return fs.readFileSync(path.join(__dirname,'../examples/Roller2',find(name)),'latin1');},write(){throw Error('Unexpected write');}};
  const p=create({files,audio:{command:event=>events.push(event)},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});p.tick(1000);clock.tick(1000);return{p,clock,reads,events};
}
function boot(){const run=start();run.p.sendKey('a');run.clock.tick(1840);return run;}
function checkMasks(p){let count=0;for(const image of p.banks.get(2).images){if(!image)continue;count++;assert.strictEqual(image.masked,true);assert.strictEqual(image.mask.length,image.pixels.length);assert.ok(image.mask.every((bit,index)=>bit===(image.pixels[index]===0?0:1)));}assert.strictEqual(count,113);}

test('Roller2 connected: original intro, initialization, mask/filter/close setup and menu execute without a synthetic title handoff',()=>{
  const {p,clock,reads,events}=start(),intro=p.display.screen(),tracker=p.banks.get(22);
  assert.strictEqual(intro.height,256);assert.strictEqual(p.state.frames.length,1);p.sendKey('a');clock.tick(1840);
  checkInitialization(p,expected);checkMasks(p);assert.notStrictEqual(p.display.screen(),intro);
  assert.deepStrictEqual([...p.display.screens.keys()],[0]);assert.strictEqual(p.display.screen().height,512);assert.strictEqual(p.display.screen().zones.length,16);
  assert.strictEqual(p.state.waiting,null);assert.strictEqual(p.state.frames.length,0);assert.strictEqual(p.banks.get(22),tracker);
  assert.strictEqual(p.state.tracker.position.field,142);assert.strictEqual(p.state.audio.filterEnabled,false);assert.deepStrictEqual(events.filter(e=>e.type==='filter').map(e=>e.enabled),[false,false,false]);
  assert.deepStrictEqual(reads,['rii:music/Roller_II_Samples.abk','rII:music/mod.Roller_II_mus','RII:iffp/terminator el','RII:Highscores','RII:iffp/icons.abk','RII:iffp/sprites.abk','RII:iffp/roller titel']);
  p.stop();assert.strictEqual(clock.pending(),0);
});

test('Roller2 connected: original input selects all four guarded destinations after real FLOAD and setup',()=>{
  for(const [x,y,action]of [[30,140,'game'],[290,140,'editor'],[150,140,'scores'],[270,46,'help']]){
    const {p,clock}=boot();p.setMouse(128+x,42+y,1);clock.tick(640);
    assert.strictEqual(p.state.variables.string_selection,action);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.state.tracker.position.field,174);
    if(action==='game'||action==='editor')assert.ok(p.display.screen().palette.every(rgb=>rgb===0));
    if(action==='game')for(const [a,b]of [[76,18],[74,29]])assert.deepStrictEqual(p.banks.get(2).images[b-1].pixels,p.banks.get(2).images[a-1].pixels);
    else checkMasks(p);p.stop();assert.strictEqual(clock.pending(),0);
  }
});

test('Roller2 connected: two-button score bypass, independent factories and Stop/Resume preserve setup and tracker position',()=>{
  const first=start(),second=boot();first.p.setMouse(158,182,3);first.clock.tick(1840);checkInitialization(first.p,expected,false);checkInitialization(second.p,expected);
  first.p.banks.get(2).images.find(Boolean).mask[0]^=1;checkMasks(second.p);
  const field=second.p.state.tracker.position.field;second.p.stop();second.clock.tick(1000);assert.strictEqual(second.p.state.tracker.position.field,field);
  second.p.resume();second.clock.tick(20);assert.strictEqual(second.p.state.tracker.position.field,field+1);checkInitialization(second.p,expected);
  first.p.stop();second.p.stop();assert.strictEqual(first.clock.pending(),0);assert.strictEqual(second.clock.pending(),0);
});

test('Roller2 connected: original Highend reload/play fallback recovers a tracker bank erased during the intro',()=>{
  const {p,clock,reads}=start(),old=p.banks.get(22);p.eraseBank(22);assert.strictEqual(p.state.tracker.playing,false);p.sendKey('a');clock.tick(1840);
  assert.notStrictEqual(p.banks.get(22),old);assert.strictEqual(reads.filter(name=>name.toLowerCase()==='rii:music/mod.roller_ii_mus').length,2);
  assert.strictEqual(p.state.variables.int_itrom,-1);assert.strictEqual(p.state.tracker.playing,true);assert.strictEqual(p.state.tracker.loop,true);
  const field=p.state.tracker.position.field;clock.tick(120);assert.strictEqual(p.state.tracker.position.field,field+6);p.stop();assert.strictEqual(clock.pending(),0);
});
