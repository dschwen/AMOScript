/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {compile,binary,token:t,integer:n,identifier:id}=require('./helpers/program');
const create=compile(require('./helpers/roller2ConnectedMenu')({ball:true})).create,expected=require('./fixtures/roller2/ball.json');
function start(){
  const clock=require('./helpers/fakeTimers').createFakeTimers(4),names=Object.keys(require('../examples/Roller2/manifest.json').files),find=name=>names.find(file=>file.toLowerCase()===name.replace(/^rii:/i,'').toLowerCase());
  const p=create({print(){},files:{isDirectory:name=>name==='RII:',exists:name=>!!find(name),read:name=>fs.readFileSync(path.join(__dirname,'../examples/Roller2',find(name)),'latin1'),write(){throw Error('write');}},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
  p.tick(1000);clock.tick(1000);p.sendKey('a');clock.tick(1840);p.setMouse(158,182,1);clock.tick(1300);p.setMouse(158,182,0);clock.tick(560);p.setJoystick(1,16);return{p,clock};
}
const png=name=>require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/roller2',name))).rgba;
test('Roller2 ball: original 609–617 fades the actual six-plane ball and board, draws the border and initializes the timer',()=>{
  const {p,clock}=start();
  for(const [delay,name]of [[100,'ball-fade-2.png'],[200,'ball-fade-7.png'],[400,'ball-start.png']]){
    clock.tick(delay);assert.deepStrictEqual(Buffer.from(p.display.canvasFrame().rgba),Buffer.from(png(name)),name);
    const frame=p.display.snapshotDisplay().frame;assert.ok(!frame.lineRegs.some((value,index)=>index%32===17&&value));
    for(let y=0;y<16;y++)assert.deepStrictEqual([frame.lineSprites[(144+y)*32+9],frame.lineSprites[(144+y)*32+10],frame.lineSprites[(144+y)*32+13],frame.lineSprites[(144+y)*32+14]],expected.spriteWords[y]);
    assert.ok(frame.lineSprites[144*32+11]&0x80000000);assert.strictEqual(frame.lineSprites[144*32+15],0x80000001);
  }
  const v=p.state.variables;assert.strictEqual(v.string_selection,'game');assert.strictEqual(p.state.waiting,'key');
  assert.deepStrictEqual([v.int_bx,v.int_by,v.int_bc,v.int_tm,v.int_ky,v.int_jxp,v.int_jxn,v.int_jyp,v.int_jyn],[5,9,1,35,-1,1,-1,1,-1]);
  assert.deepStrictEqual([p.sprites.get(1).x,p.sprites.get(1).y,p.sprites.get(1).image],[208,194,2]);
  assert.deepStrictEqual(Array.from(p.display.screen(0).palette),Array.from(p.display.screen(1).palette));assert.strictEqual(p.display.screen(1).hidden,true);
  p.stop();assert.strictEqual(clock.pending(),0);
});

test('Roller2 ball: Stop/Resume preserves the VM wait, reconciles the fade and keeps factories independent',()=>{
  const first=start(),second=start();first.clock.tick(100);second.clock.tick(100);const frame=first.p.display.canvasFrame(),field=first.p.state.tracker.position.field;
  first.p.stop();first.clock.tick(1000);assert.deepStrictEqual(first.p.display.canvasFrame().rgba,frame.rgba);assert.strictEqual(first.p.state.tracker.position.field,field);
  first.p.resume();first.clock.tick(700);assert.strictEqual(first.p.state.variables.string_selection,'game');assert.deepStrictEqual(Buffer.from(first.p.display.canvasFrame().rgba),Buffer.from(png('ball-start.png')));
  assert.strictEqual(second.p.state.variables.string_selection,'');assert.deepStrictEqual(second.p.display.canvasFrame().rgba,frame.rgba);
  first.p.banks.get(1).images[1].pixels.fill(0);assert.ok(second.p.banks.get(1).images[1].pixels.some(Boolean));
  first.p.stop();second.p.stop();assert.strictEqual(first.clock.pending(),0);assert.strictEqual(second.clock.pending(),0);
});

test('Roller2 BALLFARBEN: all original sparse Palette branches preserve unrelated registers',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'../examples/Roller2/Roller II.AMOS')),reader=new(require('../lib/Buffer'))(raw);
  const body=raw.subarray(reader.lines[196],reader.lines[203]+raw[reader.lines[203]]*2);
  for(const [value,goal]of [[1,[0xf66,0xf00,0x900]],[2,[0x9f9,0xd0,0xa0]],[3,[0x66f,15,9]],[4,[0xff6,0xdd0,0x990]],[5,[0x6ff,0xdd,0x99]],[-2,[0xfff,0xfff,0xfff]],[0,[0x123,0x123,0x123]]]){
    const head=binary([[id('ballfarben',0x12),t('['),n(value),t(']')],[t('End')]]),code=Buffer.concat([head.subarray(20),body]),header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
    const clock=require('./helpers/fakeTimers').createFakeTimers(4),p=compile(Buffer.concat([header,code])).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});p.display.setPalette(...Array(32).fill(0x123));p.tick(1000);
    assert.deepStrictEqual(Array.from(p.display.screen().palette),Array.from({length:32},(_,i)=>i>=17&&i<20?goal[i-17]:0x123));
  }
});
