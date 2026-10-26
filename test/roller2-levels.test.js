/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const create=require('./helpers/program').compile(require('./helpers/roller2ConnectedMenu')({levels:true})).create;
const expected=require('./fixtures/roller2/levels.json');
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

test('Roller2 levels: original inclusive bonus, Return and LEVLOAD replace the bank and start real level 2 with exact pixels',()=>{
  const run=start(),{p,clock}=run,old=p.bankStart(10);collect(run);
  assert.deepStrictEqual(run.bonus.map(row=>row.score),Array.from({length:expected.bonusPoints},(_,index)=>51+index));
  assert.strictEqual(run.bonus[0].timer,expected.bonusTimer);assert.strictEqual(Math.trunc((35*50-expected.bonusTimer)/10)+30,expected.bonusUpper);
  assert.deepStrictEqual([p.state.variables.int_lv,p.state.variables.int_hi,p.state.variables.int_cnt,p.state.variables.int_noi],[2,227,177,3]);assert.strictEqual(p.state.stack.length,0);
  assert.deepStrictEqual(run.reads.filter(name=>/levl\//i.test(name)),['RII:levl/1','RII:levl/2']);assert.notStrictEqual(p.bankStart(10),old);assert.throws(()=>p.peek(old),/out of bounds|retired/);
  assert.deepStrictEqual(Buffer.from(p.banks.get(10).data),fs.readFileSync(path.join(__dirname,'../examples/Roller2/levl/2')).subarray(20));
  const effects=run.events.filter(event=>event.type==='play'&&event.sample.bank===6&&event.sample.number===2&&event.period===Math.floor(3546895/10000));
  assert.strictEqual(effects.length,177);assert.ok(effects.every((event,index)=>event.mask===(1<<((index+1)%4))));
  p.setJoystick(1,16);clock.tick(800);p.setJoystick(1,0);
  const v=p.state.variables;assert.deepStrictEqual([v.int_bx,v.int_by,v.int_bc,v.int_tm,v.int_hi,v.int_noi],[8,1,1,30,227,3]);assert.strictEqual(v.string_selection,'');assert.strictEqual(p.state.stack.length,0);
  const rgba=Buffer.from(p.display.canvasFrame().rgba),png=require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/roller2',expected.png))).rgba;
  assert.deepStrictEqual(rgba,Buffer.from(png));assert.strictEqual(crypto.createHash('sha256').update(rgba).digest('hex'),expected.rgbaSha256);close(run);
});

test('Roller2 levels: Stop/Resume during bonus preserves the captured For bound without duplicate score or load',()=>{
  const run=start();collect(run,11020);let budget=100;
  while(run.p.state.variables.int_hi<=50&&budget--)run.clock.tick(4);
  assert.ok(budget>0);assert.ok(run.p.state.variables.int_hi<227);const score=run.p.state.variables.int_hi;
  run.p.stop();run.clock.tick(500);assert.strictEqual(run.p.state.variables.int_hi,score);run.p.resume();run.clock.tick(3000);
  assert.strictEqual(run.p.state.variables.int_hi,227);assert.strictEqual(run.p.state.variables.int_lv,2);assert.strictEqual(run.reads.filter(name=>name==='RII:levl/2').length,1);assert.strictEqual(run.p.state.stack.length,0);close(run);
});

test('Roller2 levels: absent next-level metadata follows original Exist/win branch without reading a missing file',()=>{
  const run=start({missing:true});collect(run);run.clock.tick(3000);
  assert.strictEqual(run.p.state.variables.string_selection,'win');assert.strictEqual(run.p.state.variables.int_hi,227);assert.strictEqual(run.p.state.stack.length,0);assert.strictEqual(run.p.state.waiting,'key');assert.ok(!run.reads.includes('RII:levl/2'));close(run);
});
