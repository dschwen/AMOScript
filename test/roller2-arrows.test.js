/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const create=require('./helpers/program').compile(require('./helpers/roller2ConnectedMenu')({arrows:true})).create;
const expected=require('./fixtures/roller2/levels.json'),arrows=require('./fixtures/roller2/arrows.json');
function ready(run){collect(run);run.p.setJoystick(1,16);run.clock.tick(800);run.p.setJoystick(1,0);}
function press(run,mask,ms){run.p.setJoystick(1,mask);run.clock.tick(20);run.p.setJoystick(1,0);run.clock.tick(ms-20);}
function image(p,frame){const rgba=Buffer.from(p.display.canvasFrame().rgba),expectedPng=require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/roller2',frame.png))).rgba;assert.deepStrictEqual(rgba,Buffer.from(expectedPng));assert.strictEqual(crypto.createHash('sha256').update(rgba).digest('hex'),frame.rgbaSha256);}
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


test('Roller2 arrows: original PFEIL moves one pixel per step, turns down/up/left on real level 2 and leaves the bank intact',()=>{
  const run=start(),{p,clock}=run;ready(run);const bank=Buffer.from(p.banks.get(10).data),plays=run.events.length;
  p.setJoystick(1,8);
  for(const point of arrows.trajectory){clock.tick(20);if(point.time===13020)p.setJoystick(1,0);assert.deepStrictEqual([p.sprites.get(1).x,p.sprites.get(1).y,p.state.variables.int_bx,p.state.variables.int_by],[point.x,point.y,point.bx,point.by]);if(point.time===13140)image(p,arrows.frames[0]);}
  clock.tick(14000-clock.now());assert.deepStrictEqual([p.state.variables.int_bx,p.state.variables.int_by,p.state.variables.int_dx,p.state.variables.int_dy],[9,4,0,1]);image(p,arrows.frames[1]);
  press(run,4,1400);assert.deepStrictEqual([p.state.variables.int_bx,p.state.variables.int_by,p.state.variables.int_dx,p.state.variables.int_dy],[5,3,-1,0]);image(p,arrows.frames[2]);
  assert.strictEqual(run.events.slice(plays).filter(e=>e.type==='play'&&e.sample.bank===6&&e.sample.number===1).length,3);assert.deepStrictEqual(Buffer.from(p.banks.get(10).data),bank);assert.deepStrictEqual([p.state.variables.int_hi,p.state.variables.int_noi,p.state.variables.int_bc],[227,3,1]);assert.strictEqual(p.state.variables.string_selection,'');assert.strictEqual(p.state.stack.length,0);close(run);
});

test('Roller2 arrows: real N34 and mismatched HCWEG reverse the ball repeatedly without consuming tiles or accepting new input mid-slide',()=>{
  const run=start(),{p,clock}=run;ready(run);press(run,8,1000);press(run,4,1400);press(run,1,600);assert.deepStrictEqual([p.state.variables.int_bx,p.state.variables.int_by],[5,1]);const bank=Buffer.from(p.banks.get(10).data);
  p.setJoystick(1,4);clock.tick(4);p.setJoystick(1,0);assert.strictEqual(p.state.variables.int_dx,1);clock.tick(200);assert.strictEqual(p.state.variables.int_dx,-1);clock.tick(200);assert.strictEqual(p.state.variables.int_dx,1);
  assert.deepStrictEqual(Buffer.from(p.banks.get(10).data),bank);assert.deepStrictEqual([p.state.variables.int_hi,p.state.variables.int_noi],[227,3]);assert.strictEqual(p.state.stack.length,0);close(run);
});

test('Roller2 arrows: original timeout inside PFEIL executes Boom and reaches the declared game-over guard',()=>{
  const run=start(),{p,clock}=run;ready(run);clock.tick((1450-p.timer())*20);assert.strictEqual(p.timer(),1450);press(run,8,400);
  assert.strictEqual(p.state.variables.string_selection,'timeout');assert.strictEqual(p.state.variables.int_j,16);assert.deepStrictEqual([p.state.variables.int_bx,p.state.variables.int_by],[8,1]);const effects=run.events.filter(e=>e.effect==='boom');assert.deepStrictEqual(effects.map(e=>e.mask),[8,4,2,1]);assert.ok(effects.every(e=>e.sample.data.some(value=>value!==0)));assert.strictEqual(p.state.stack.length,0);close(run);
});

test('Roller2 arrows: host Stop/Resume freezes a partial one-pixel arrow step and resumes its original loop without duplicate turning effects',()=>{
  const run=start(),{p,clock}=run;ready(run);press(run,8,140);const x=p.sprites.get(1).x,frame=p.display.canvasFrame();p.stop();clock.tick(600);assert.strictEqual(p.sprites.get(1).x,x);assert.deepStrictEqual(p.display.canvasFrame().rgba,frame.rgba);p.resume();clock.tick(1200);assert.deepStrictEqual([p.state.variables.int_bx,p.state.variables.int_by],[9,4]);assert.strictEqual(run.events.filter(e=>e.type==='play'&&e.sample.bank===6&&e.sample.number===1).length,1);close(run);
});
