/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const expected=require('./fixtures/roller2/movement.json');
const create=require('./helpers/program').compile(require('./helpers/roller2ConnectedMenu')({movement:true})).create;
function start(level='1'){
  const clock=require('./helpers/fakeTimers').createFakeTimers(4),events=[],names=Object.keys(require('../examples/Roller2/manifest.json').files),find=name=>names.find(file=>file.toLowerCase()===name.replace(/^rii:/i,'').toLowerCase());
  const p=create({print(){},audio:{command:event=>events.push(event)},files:{isDirectory:name=>name==='RII:',exists:name=>!!find(name),read:name=>fs.readFileSync(path.join(__dirname,'../examples/Roller2',name.toLowerCase()==='rii:levl/1'?`levl/${level}`:find(name)),'latin1'),write(){throw Error('write');}},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
  p.tick(1000);clock.tick(1000);p.sendKey('a');clock.tick(1840);p.setMouse(158,182,1);clock.tick(1300);p.setMouse(158,182,0);clock.tick(560);p.setJoystick(1,16);clock.tick(700);p.setJoystick(1,0);return{p,clock,events};
}
test('Roller2 movement: the original first-level floor handler slides three cells through uppercase SAS$ dispatch to a colour-tile guard',()=>{
  const {p,clock}=start(),original=Buffer.from(p.banks.get(10).data);p.setJoystick(1,8);
  const checkFrame=step=>{const frame=expected.frames.find(frame=>frame.field===step);if(frame){const golden=require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/roller2',frame.png)));assert.deepStrictEqual(Buffer.from(p.display.canvasFrame().rgba),Buffer.from(golden.rgba),frame.png);}};
  for(let step=1;step<=24;step++){
    clock.tick(20);const target=expected.trajectory[step-1];assert.deepStrictEqual([p.sprites.get(1).x,p.sprites.get(1).y,p.state.variables.int_bx,p.state.variables.int_by],[target.x,target.y,target.bx,target.by]);checkFrame(step);
    if(step===2)p.setJoystick(1,0); // Native floor sliding continues after release.
  }
  clock.tick(20);checkFrame(25);const v=p.state.variables;assert.strictEqual(v.string_selection,'tile:kcweg');assert.strictEqual(p.state.waiting,'key');
  assert.deepStrictEqual([v.int_bx,v.int_by,v.int_hd,v.int_hc,v.int_last],[8,9,3,2,1]);assert.strictEqual(v.int_noi,5);assert.strictEqual(v.int_hi,0);
  assert.deepStrictEqual(Buffer.from(p.banks.get(10).data),original);assert.strictEqual(p.state.stack.length,0);p.stop();assert.strictEqual(clock.pending(),0);
});

test('Roller2 movement: original wall checks bump without moving and cycle sample voices through bounded Add',()=>{
  for(const mask of [1,2,4]){
    const {p,clock,events}=start();p.setJoystick(1,mask);clock.tick(100);p.setJoystick(1,0);clock.tick(40);
    assert.deepStrictEqual([p.state.variables.int_bx,p.state.variables.int_by,p.sprites.get(1).x,p.sprites.get(1).y],[5,9,208,194]);
    assert.strictEqual(p.state.variables.string_selection,'');assert.ok(p.state.variables.int_v>=0&&p.state.variables.int_v<=3);
    const plays=events.filter(event=>event.type==='play'&&event.sample.bank===6&&event.sample.number===2);assert.ok(plays.length>=4);assert.deepStrictEqual(plays.slice(0,4).map(event=>event.mask),[1,2,4,8]);p.stop();assert.strictEqual(clock.pending(),0);
  }
});

test('Roller2 movement: prepared original maps exercise stop-tile returns and Lasttest floor collapse without editing VM state',()=>{
  const stop=start('9');stop.p.setJoystick(1,8);stop.clock.tick(20);stop.p.setJoystick(1,0);stop.clock.tick(620);
  assert.deepStrictEqual([stop.p.state.variables.int_bx,stop.p.state.variables.int_by,stop.p.sprites.get(1).x],[9,7,272]);assert.strictEqual(stop.p.state.variables.string_selection,'');assert.strictEqual(stop.p.state.stack.length,0);stop.p.stop();assert.strictEqual(stop.clock.pending(),0);
  const collapse=start('4'),before=Buffer.from(collapse.p.banks.get(10).data);collapse.p.setJoystick(1,4);collapse.clock.tick(20);collapse.p.setJoystick(1,0);collapse.clock.tick(1400);
  const after=Buffer.from(collapse.p.banks.get(10).data),changed=[];for(let i=0;i<after.length;i++)if(after[i]!==before[i])changed.push(i);
  assert.deepStrictEqual(changed,[91]);assert.strictEqual(before[91],18);assert.strictEqual(after[91],33);assert.strictEqual(collapse.p.state.variables.int_bx,6);assert.strictEqual(collapse.p.state.stack.length,0);
  assert.ok(collapse.events.some(event=>event.type==='play'&&event.sample.bank===6&&event.sample.number===2&&event.period===Math.floor(3546895/17000)));
  collapse.p.stop();assert.strictEqual(collapse.clock.pending(),0);
});

test('Roller2 movement: Stop/Resume freezes a partial slide and independent factories keep separate trajectories',()=>{
  const a=start(),b=start();a.p.setJoystick(1,8);a.clock.tick(40);a.p.stop();const x=a.p.sprites.get(1).x;a.clock.tick(500);assert.strictEqual(a.p.sprites.get(1).x,x);assert.strictEqual(b.p.sprites.get(1).x,208);
  a.p.resume();a.clock.tick(700);assert.strictEqual(a.p.state.variables.string_selection,'tile:kcweg');assert.strictEqual(b.p.state.variables.string_selection,'');assert.strictEqual(b.p.state.variables.int_bx,5);
  a.p.stop();b.p.stop();assert.strictEqual(a.clock.pending(),0);assert.strictEqual(b.clock.pending(),0);
});
