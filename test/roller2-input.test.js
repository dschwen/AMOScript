/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {compile}=require('./helpers/program'),create=compile(require('./helpers/roller2ConnectedMenu')({input:true})).create;
function start(){
  const clock=require('./helpers/fakeTimers').createFakeTimers(4),events=[],names=Object.keys(require('../examples/Roller2/manifest.json').files),find=name=>names.find(file=>file.toLowerCase()===name.replace(/^rii:/i,'').toLowerCase());
  const p=create({print(){},audio:{command:event=>events.push(event)},files:{isDirectory:name=>name==='RII:',exists:name=>!!find(name),read:name=>fs.readFileSync(path.join(__dirname,'../examples/Roller2',find(name)),'latin1'),write(){throw Error('write');}},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
  p.tick(1000);clock.tick(1000);p.sendKey('a');clock.tick(1840);p.setMouse(158,182,1);clock.tick(1300);p.setMouse(158,182,0);clock.tick(560);p.setJoystick(1,16);clock.tick(700);p.setJoystick(1,0);return{p,clock,events};
}
test('Roller2 input: unchanged JOAB idles with the original countdown and retained ball/map',()=>{
  const {p,clock}=start(),raw=Buffer.from(p.banks.get(10).data),golden=require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/roller2/ball-idle.png')));
  assert.strictEqual(p.state.variables.string_selection,'');assert.strictEqual(p.state.waiting,null);assert.strictEqual(p.sprites.get(1).image,1);
  assert.deepStrictEqual(Buffer.from(p.display.canvasFrame().rgba),Buffer.from(golden.rgba));assert.strictEqual(p.timer(),1);
  p.setKeyState(95,true);p.sendKey('\0',95);clock.tick(40);assert.strictEqual(p.state.variables.string_selection,'');assert.strictEqual(p.keyState(95),-1);
  assert.deepStrictEqual(Buffer.from(p.banks.get(10).data),raw);assert.strictEqual(p.state.tracker.playing,true);p.stop();assert.strictEqual(clock.pending(),0);
});

test('Roller2 input: all directions use original multipliers and priority before the movement guard',()=>{
  for(const [mask,dx,dy]of [[1,0,-1],[2,0,1],[4,-1,0],[8,1,0],[15,0,-1]]){
    const {p,clock}=start();p.setJoystick(1,mask);clock.tick(4);assert.strictEqual(p.state.variables.string_selection,'move');assert.strictEqual(p.state.waiting,'key');
    assert.deepStrictEqual([p.state.variables.int_dx,p.state.variables.int_dy],[dx,dy]);assert.deepStrictEqual([p.state.variables.int_bx,p.state.variables.int_by],[5,9]);
    assert.deepStrictEqual([p.sprites.get(1).x,p.sprites.get(1).y],[208,194]);p.stop();assert.strictEqual(clock.pending(),0);
  }
});

test('Roller2 input: original effect/music keys, Space guard and Escape title return preserve source behavior',()=>{
  const {p,clock}=start();p.sendKey('f',35);clock.tick(4);assert.strictEqual(p.state.variables.int_fx,0);p.sendKey('f',35);clock.tick(4);assert.strictEqual(p.state.variables.int_fx,1);
  p.sendKey('m',55);clock.tick(20);assert.strictEqual(p.state.variables.int_mus,0);assert.strictEqual(p.state.tracker.playing,false);assert.strictEqual(p.state.variables.int_itrom,0);
  p.sendKey('m',55);clock.tick(20);assert.strictEqual(p.state.variables.int_mus,1);assert.strictEqual(p.state.tracker.playing,true);assert.strictEqual(p.state.variables.int_itrom,-1);
  p.sendKey(' ',64);clock.tick(20);assert.strictEqual(p.state.variables.string_selection,'ipause');p.stop();assert.strictEqual(clock.pending(),0);
  const escape=start();escape.p.sendKey('\x1b',69);escape.clock.tick(3000);assert.strictEqual(escape.p.state.variables.string_selection,'');assert.strictEqual(escape.p.display.screen().height,512);assert.strictEqual(escape.p.display.screens.size,1);assert.strictEqual(escape.p.state.tracker.playing,true);escape.p.stop();assert.strictEqual(escape.clock.pending(),0);
});
