/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const create=require('./helpers/program').compile(require('./helpers/roller2ConnectedMenu')({ready:true})).create;
function start(){
  const clock=require('./helpers/fakeTimers').createFakeTimers(4),names=Object.keys(require('../examples/Roller2/manifest.json').files),find=name=>names.find(file=>file.toLowerCase()===name.replace(/^rii:/i,'').toLowerCase());
  const p=create({print(){},files:{isDirectory:name=>name==='RII:',exists:name=>!!find(name),read:name=>fs.readFileSync(path.join(__dirname,'../examples/Roller2',find(name)),'latin1'),write(){throw Error('write');}},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
  p.tick(1000);clock.tick(1000);p.sendKey('a');clock.tick(1840);p.setMouse(158,182,1);clock.tick(1300);p.setMouse(158,182,0);return{p,clock};
}
const png=name=>require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/roller2',name))).rgba;
test('Roller2 ready: connected original 601–608 switches real foreground slices and reads level metadata after mouse input',()=>{
  const {p,clock}=start();clock.tick(20);const prompt=png('ready-prompt.png');
  assert.deepStrictEqual(Buffer.from(p.display.canvasFrame().rgba),Buffer.from(prompt));assert.strictEqual(p.display.current,0);
  clock.tick(420);assert.strictEqual(p.display.screen(1).hidden,true);assert.strictEqual(p.state.variables.int_noi,5);
  assert.deepStrictEqual(Buffer.from(p.display.canvasFrame().rgba),Buffer.from(png('game-load-panel.png')));
  const board=new Uint8Array(320*200);board.set(p.display.screen(0).pixels.subarray(0,320*192));
  assert.strictEqual(crypto.createHash('sha256').update(board).digest('hex'),require('./fixtures/roller2/boards.json').levels.find(item=>item.level==='1').indicesSha256);
  clock.tick(120);assert.strictEqual(p.display.screen(1).hidden,false);assert.deepStrictEqual(Buffer.from(p.display.canvasFrame().rgba),Buffer.from(prompt));
  p.setMouse(158,182,1);clock.tick(300);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.state.variables.string_selection,'game');
  assert.deepStrictEqual([p.state.variables.int_bx,p.state.variables.int_by,p.state.variables.int_bc,p.state.variables.int_tm],[5,9,1,35]);
  assert.strictEqual(p.display.screen(1).hidden,true);assert.strictEqual(p.state.tracker.playing,true);p.stop();assert.strictEqual(clock.pending(),0);
});

test('Roller2 ready: Fire(1), Stop/Resume and independent program state preserve the guarded path',()=>{
  const first=start(),second=start();first.clock.tick(560);second.clock.tick(560);const field=first.p.state.tracker.position.field;
  first.p.stop();first.clock.tick(1000);assert.strictEqual(first.p.state.tracker.position.field,field);first.p.resume();
  first.p.setJoystick(1,16);first.clock.tick(400);assert.strictEqual(first.p.state.variables.string_selection,'game');
  assert.strictEqual(second.p.state.variables.string_selection,'');assert.notStrictEqual(first.p.display.screen(0).pixels,second.p.display.screen(0).pixels);
  second.p.setJoystick(1,16);second.clock.tick(400);assert.strictEqual(second.p.state.variables.int_tm,35);
  first.p.stop();second.p.stop();assert.strictEqual(first.clock.pending(),0);assert.strictEqual(second.clock.pending(),0);
});
