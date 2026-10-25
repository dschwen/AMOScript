/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {compile}=require('./helpers/program'),expected=require('./fixtures/roller2/initialization.json'),checkInitialization=require('./helpers/checkRoller2Initialization');
const names=Object.keys(require('../examples/Roller2/manifest.json').files),create=compile(require('./helpers/roller2ConnectedMenu')()).create;
function start({missingLevel=false}={}){
  const clock=require('./helpers/fakeTimers').createFakeTimers(4),reads=[],events=[],prints=[];
  const find=name=>names.find(file=>file.toLowerCase()===name.replace(/^rii:/i,'').toLowerCase());
  const files={isDirectory:name=>name==='RII:',exists:name=>!(missingLevel&&name.toLowerCase()==='rii:levl/1')&&!!find(name),read(name){reads.push(name);return fs.readFileSync(path.join(__dirname,'../examples/Roller2',find(name)),'latin1');},write(){throw Error('Unexpected write');}};
  const p=create({files,print:(...args)=>prints.push(args),audio:{command:event=>events.push(event)},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});p.tick(1000);clock.tick(1000);return{p,clock,reads,events,prints};
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
    const {p,clock}=boot();p.setMouse(128+x,42+y,1);clock.tick(action==='game'?1300:640);
    assert.strictEqual(p.state.variables.string_selection,action);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.state.tracker.position.field,action==='game'?207:174);
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

test('Roller2 game load: original setup and first level reach the post-600 guard with independent panel pixels and unchanged level bytes',()=>{
  const {p,clock,prints}=boot();p.setMouse(158,182,1);clock.tick(1300);const v=p.state.variables,s=p.display.screen(),hidden=p.display.screen(1);
  assert.strictEqual(v.string_selection,'game');assert.deepStrictEqual([v.int_lv,v.int_li,v.int_hi,v.int_tm,v.int_mus,v.int_fx,v.int_blspd],[1,3,0,0,1,1,2]);
  assert.deepStrictEqual([s.width,s.height,s.hardwareX,s.hardwareY,s.pen,s.paper,s.cursorVisible],[320,250,128,50,1,0,false]);
  assert.deepStrictEqual([hidden.width,hidden.height,hidden.hardwareY,hidden.windowHeight,hidden.hidden],[320,32,140,32,true]);assert.strictEqual(p.mouseVisible(),false);
  const raw=fs.readFileSync(path.join(__dirname,'../examples/Roller2/levl/1'));assert.deepStrictEqual(Buffer.from(p.banks.get(10).data),raw.subarray(20));
  assert.deepStrictEqual(Buffer.from(s.physicalPixels),fs.readFileSync(path.join(__dirname,'fixtures/roller2/game-load-panel.indices')));
  const rgba=require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/roller2/game-load-panel.png'))).rgba;
  assert.deepStrictEqual(Buffer.from(p.display.canvasFrame().rgba),Buffer.from(rgba));assert.strictEqual(p.display.snapshotDisplay().frame.lines,250);
  assert.deepStrictEqual(prints,[['Score  : 0'],['Level  : 0'],['Time   : 0'],['HiScore:',4406],['LoScore:',400],['Score  :',0],['Level  :',1],['Time   :',0]]);
  assert.strictEqual(p.state.tracker.playing,true);p.stop();assert.strictEqual(clock.pending(),0);
});

test('Roller2 game load: original missing-level Exist branch reaches a win guard before loading or clearing level data',()=>{
  const {p,clock,reads}=start({missingLevel:true});p.sendKey('a');clock.tick(1840);const bank=p.banks.get(10);p.setMouse(158,182,1);clock.tick(2600);
  assert.strictEqual(p.state.variables.string_selection,'win');assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.banks.get(10),bank);assert.ok(bank.data.every(value=>value===0));
  assert.strictEqual(reads.some(name=>name.toLowerCase()==='rii:levl/1'),false);p.stop();assert.strictEqual(clock.pending(),0);
});
