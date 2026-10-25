/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {compile,binary,token:t,word:w,integer:n,identifier:id}=require('./helpers/program');
const create=compile(require('./helpers/roller2ConnectedMenu')({colours:true})).create,expected=require('./fixtures/roller2/colours.json');
function start(level='1',colour=null){
  const clock=require('./helpers/fakeTimers').createFakeTimers(4),events=[],names=Object.keys(require('../examples/Roller2/manifest.json').files),find=name=>names.find(file=>file.toLowerCase()===name.replace(/^rii:/i,'').toLowerCase());let randomReads=0;
  const p=create({print(){},readRandomBeam(){randomReads++;return 0;},audio:{command:event=>events.push(event)},files:{isDirectory:name=>name==='RII:',exists:name=>!!find(name),read(name){const raw=fs.readFileSync(path.join(__dirname,'../examples/Roller2',name.toLowerCase()==='rii:levl/1'?`levl/${level}`:find(name)));if(name.toLowerCase()==='rii:levl/1'&&colour!=null)raw[504]=colour;return raw.toString('latin1');},write(){throw Error('write');}},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
  p.tick(1000);clock.tick(1000);p.sendKey('a');clock.tick(1840);p.setMouse(158,182,1);clock.tick(1300);p.setMouse(158,182,0);clock.tick(560);p.setJoystick(1,16);clock.tick(700);p.setJoystick(1,0);return{p,clock,events,randomReads:()=>randomReads};
}
const png=name=>require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/roller2',name))).rgba;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('Roller2 colours: all five original KCWEG interactions update score/count/colour and exact map/pixels before the bonus guard',()=>{
  const run=start(),{p,clock,events}=run,original=Buffer.from(p.banks.get(10).data),background=Array.from(p.display.screen().palette);
  p.setJoystick(1,8);clock.tick(20);p.setJoystick(1,0);clock.tick(500);
  assert.deepStrictEqual(Buffer.from(p.display.canvasFrame().rgba),Buffer.from(png(expected.transition.png)),'first colour component step');
  assert.deepStrictEqual([p.state.variables.int_bc,p.state.variables.int_hi,p.state.variables.int_noi],[expected.transition.colour,expected.transition.score,expected.transition.remaining]);
  let now=5920;
  for(const frame of expected.frames){
    if(frame.time!==6600){p.setJoystick(1,8);clock.tick(20);p.setJoystick(1,0);now+=20;}
    clock.tick(frame.time-now);now=frame.time;const v=p.state.variables;
    assert.deepStrictEqual([v.int_bx,v.int_by,v.int_bc,v.int_hi,v.int_noi],[frame.bx,frame.by,frame.colour,frame.score,frame.remaining]);
    assert.strictEqual(hash(p.banks.get(10).data),frame.payloadSha256);assert.deepStrictEqual(Buffer.from(p.display.canvasFrame().rgba),Buffer.from(png(frame.png)),frame.png);
    assert.deepStrictEqual(Array.from(p.display.screen().palette).filter((_,index)=>index<17||index>19),background.filter((_,index)=>index<17||index>19));
    assert.strictEqual(p.state.random.last,frame.fillIcon-1);assert.strictEqual(p.state.fade.active,false);
  }
  const changed=[];p.banks.get(10).data.forEach((value,index)=>{if(value!==original[index])changed.push(index);});assert.deepStrictEqual(changed,expected.changedOffsets);
  assert.strictEqual(run.randomReads(),5);assert.strictEqual(p.state.variables.string_selection,'level-bonus');assert.strictEqual(p.state.stack.length,1);assert.strictEqual(p.state.waiting,'key');
  const plays=events.filter(event=>event.type==='play'&&event.sample.bank===6&&event.sample.number===4);assert.deepStrictEqual(plays.map(event=>event.mask),[1,2,4,8,1]);assert.ok(plays.every(event=>event.period===Math.floor(3546895/10000)));
  p.stop();assert.strictEqual(clock.pending(),0);
});

test('Roller2 colours: original HCWEG accepts/reverses on a matching real tile and rejects/reverses on a mismatched real tile',()=>{
  const good=start('3'),before=Buffer.from(good.p.banks.get(10).data),count=good.p.state.variables.int_noi;good.p.setJoystick(1,8);good.clock.tick(20);good.p.setJoystick(1,0);good.clock.tick(640);
  assert.deepStrictEqual([good.p.state.variables.int_bc,good.p.state.variables.int_hi,good.p.state.variables.int_noi,good.p.state.variables.int_dx],[4,20,count-1,-1]);
  const changed=[];good.p.banks.get(10).data.forEach((value,index)=>{if(value!==before[index])changed.push(index);});assert.deepStrictEqual(changed,[193]);assert.strictEqual(good.p.banks.get(10).data[193],1);good.p.stop();assert.strictEqual(good.clock.pending(),0);
  const bad=start('2'),raw=Buffer.from(bad.p.banks.get(10).data);bad.p.setJoystick(1,4);bad.clock.tick(40);bad.p.setJoystick(1,0);
  assert.deepStrictEqual([bad.p.state.variables.int_bc,bad.p.state.variables.int_hi,bad.p.state.variables.int_dx],[1,0,1]);assert.deepStrictEqual(Buffer.from(bad.p.banks.get(10).data),raw);assert.strictEqual(bad.p.state.fade.active,false);bad.p.stop();assert.strictEqual(bad.clock.pending(),0);
});

test('Roller2 colours: a declared mismatched starting-colour fixture rejects KCWEG without consuming or recolouring its tile',()=>{
  const {p,clock}=start('1',2),before=Buffer.from(p.banks.get(10).data);p.setJoystick(1,8);clock.tick(20);p.setJoystick(1,0);clock.tick(700);
  assert.deepStrictEqual([p.state.variables.int_bx,p.state.variables.int_bc,p.state.variables.int_hi,p.state.variables.int_noi],[8,2,0,5]);assert.deepStrictEqual(Buffer.from(p.banks.get(10).data),before);p.stop();assert.strictEqual(clock.pending(),0);
});

test('Roller2 BCL: every original sparse Fade branch retains unrelated palette registers',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'../examples/Roller2/Roller II.AMOS')),reader=new(require('../lib/Buffer'))(raw),body=raw.subarray(reader.lines[102],reader.lines[110]+raw[reader.lines[110]]*2);
  for(const [colour,goal]of [[1,[0xf66,0xf00,0x900]],[2,[0x9f9,0xd0,0xa0]],[3,[0x66f,15,9]],[4,[0xff6,0xdd0,0x990]],[5,[0x6ff,0xdd,0x99]],[0,[0,0,0]],[-1,[0xcfc,0xcfc,0xcfc]],[99,[0x123,0x123,0x123]]]){
    const head=binary([[id('bcl',0x12),t('['),n(colour),t(']')],[t('Wait Key')],[t('End')]]),code=Buffer.concat([head.subarray(20),body]),header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
    const clock=require('./helpers/fakeTimers').createFakeTimers(4),p=compile(Buffer.concat([header,code])).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});p.display.setPalette(...Array(32).fill(0x123));p.tick(1000);clock.tick(1000);
    assert.deepStrictEqual(Array.from(p.display.screen().palette),Array.from({length:32},(_,index)=>index>=17&&index<20?goal[index-17]:0x123));p.stop();assert.strictEqual(clock.pending(),0);
  }
});

test('Roller2 colours: Stop/Resume reconciles a partial BCL fade without repeating score, map writes or random draws',()=>{
  const a=start(),b=start();a.p.setJoystick(1,8);a.clock.tick(20);a.p.setJoystick(1,0);a.clock.tick(500);const bytes=Buffer.from(a.p.banks.get(10).data),frame=a.p.display.canvasFrame(),reads=a.randomReads();
  a.p.stop();a.clock.tick(700);assert.deepStrictEqual(a.p.display.canvasFrame().rgba,frame.rgba);a.p.resume();a.clock.tick(1000);
  assert.strictEqual(a.p.state.variables.int_hi,10);assert.strictEqual(a.p.state.variables.int_noi,4);assert.strictEqual(a.randomReads(),reads);assert.deepStrictEqual(Buffer.from(a.p.banks.get(10).data),bytes);
  assert.strictEqual(b.p.state.variables.int_hi,0);assert.strictEqual(b.randomReads(),0);a.p.stop();b.p.stop();assert.strictEqual(a.clock.pending(),0);assert.strictEqual(b.clock.pending(),0);
});
