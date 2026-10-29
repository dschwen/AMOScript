'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {binary,token:t,integer:n,word:w,text,identifier:id,compile,execute}=require('./helpers/program');
const bind=(channel,type,number)=>[t('Channel'),channel,t('To'),t(type),number];
const plain=value=>JSON.parse(JSON.stringify(value));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('Channel: original encoding routes 64 independent selectors without requiring objects, images or a screen',()=>{
  assert.deepStrictEqual(t('Channel'),[0x1f,0x94]);
  const {program:p,timers:c}=execute(binary([[t('Screen Close'),n(0)],[w(0x1f94),n(63),t('To'),t('Bob'),n(63)],bind(n(0),'Sprite',n(63)),bind(n(15),'Sprite',n(15)),[t('Wait Key')]]),1000,{maxBobs:1});
  assert.deepStrictEqual(plain(p.channelBinding(63)),{type:'bob',number:63});assert.deepStrictEqual(plain(p.channelBinding(0)),{type:'sprite',number:63});assert.deepStrictEqual(plain(p.channelBinding(15)),{type:'sprite',number:15});
  assert.strictEqual(p.bobs.size,0);assert.strictEqual(p.display.screens.size,0);assert.strictEqual(p.spriteInfo('I Sprite',15),0);assert.strictEqual(c.pending(),0);
  const before=p.channelBinding(63);assert.ok(Object.isFrozen(before));assert.throws(()=>{before.number=1;},TypeError);
  p.setChannel(63,'sprite',()=>1);assert.deepStrictEqual(plain(before),{type:'bob',number:63});assert.deepStrictEqual(plain(p.channelBinding(63)),{type:'sprite',number:1});p.stop();
});

test('Channel: expressions evaluate once left to right, channel validation precedes the target and failures preserve the old binding',()=>{
  const selection=()=>[t('Val'),t('('),t('Fsel$'),t('('),text('selector'),t(')'),t(')')];
  const calls=[],{program:p}=execute(binary([bind(selection(),'Bob',selection()),[t('Wait Key')]]),1000,{files:{select(){calls.push(calls.length);return calls.length===1?'3.9':'62.9';}}});
  assert.deepStrictEqual(calls,[0,1]);assert.deepStrictEqual(plain(p.channelBinding(3)),{type:'bob',number:62});
  for(const channel of [-1,64,65536]){let called=false;assert.throws(()=>p.setChannel(channel,'bob',()=>{called=true;return 0;}),/AMAL channel/);assert.strictEqual(called,false);assert.throws(()=>p.channelBinding(channel),/AMAL channel/);}
  for(const object of [-1,64,65536])assert.throws(()=>p.setChannel(3,'sprite',()=>object),/Channel target/);
  assert.throws(()=>p.setChannel(3,'bob',()=>{throw Error('target failed');}),/target failed/);assert.deepStrictEqual(plain(p.channelBinding(3)),{type:'bob',number:62});p.stop();
  let reads=0;assert.throws(()=>execute(binary([bind(n(64),'Bob',selection())]),1000,{files:{select(){reads++;return '0';}}}),/AMAL channel number at line 1, byte 22/);assert.strictEqual(reads,0);
  assert.throws(()=>execute(binary([bind(n(0),'Bob',n(64))])),/Channel target number at line 1, byte 22/);
  for(const row of [bind(text('x'),'Bob',n(0)),bind(n(0),'Sprite',text('x'))])assert.throws(()=>compile(binary([row])),/numeric/);
  assert.throws(()=>compile(binary([[t('Channel'),n(0),t('To'),t('Screen Display'),n(1)]])),/Unsupported Channel target/);
});

test('Channel: factories and immutable snapshots are isolated; Default resets all identity mappings while Stop/Resume preserves them',()=>{
  const {program:p,timers:c}=execute(binary([[t('Wait Key')]])),q=execute(binary([[t('Wait Key')]])).program;
  for(let channel=0;channel<64;channel++){assert.deepStrictEqual(plain(p.channelBinding(channel)),{type:'sprite',number:channel});p.setChannel(channel,'bob',()=>63-channel);}
  const old=p.channelBinding(0);p.stop();p.resume();assert.deepStrictEqual(plain(p.channelBinding(0)),{type:'bob',number:63});assert.deepStrictEqual(plain(q.channelBinding(0)),{type:'sprite',number:0});p.resetDefault();
  for(let channel=0;channel<64;channel++)assert.deepStrictEqual(plain(p.channelBinding(channel)),{type:'sprite',number:channel});assert.deepStrictEqual(plain(old),{type:'bob',number:63});p.stop();q.stop();assert.strictEqual(c.pending(),0);
});

test('Channel: remapping does not create/remove/move objects, alter pixels/banks/Amreg or publish a Sprite update',()=>{
  const {program:p}=execute(binary([[t('Wait Key')]])),d=p.display;p.setAmreg(9,1234);d.ink(3);d.bar(0,0,15,3);p.getBob(1,0,0,16,4);d.clear(0);p.setBob(2,20,10,1);p.updateBobs();p.setSprite(1,148,60,1);p.updateSprites();
  const pixels=d.screen().pixels.slice(),frame=d.renderDisplay(),sprite=p.spriteBufferSnapshot(),bob=JSON.stringify(p.bobs.get(2)),bank=p.banks.get(1),revision=d.version;
  p.setChannel(1,'bob',()=>2);p.setChannel(1,'sprite',()=>15);
  assert.deepStrictEqual(d.screen().pixels,pixels);assert.deepStrictEqual(d.renderDisplay(),frame);assert.deepStrictEqual(p.spriteBufferSnapshot(),sprite);assert.strictEqual(JSON.stringify(p.bobs.get(2)),bob);assert.strictEqual(p.banks.get(1),bank);assert.strictEqual(d.version,revision);assert.strictEqual(p.amreg(9),1234);p.stop();
});

test('Planet Zybex: all 27 original Channel statements compile with declared loop inputs, including both logical Sprite 15 paths',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'../examples/PlanetZybex/Zybex.AMOS')),r=new(require('../lib/Buffer'))(raw);
  // Literal statement expectations; l=31 and lop=5 replace omitted loop bodies.
  const cases=[[263,20,20],[279,21,21],[292,31,31],[310,31,31],[329,31,31],[347,39,39],[384,31,31],[399,31,31],[416,31,31],[461,31,31],[582,31,31],[598,39,39],[639,31,31],[665,31,31],[718,21,21],[734,31,31],[750,24,24],[765,25,25],[783,31,31],[801,31,31],[849,31,31],[870,28,28],[887,29,29],[991,15,15],[1030,5,5],[1124,15,15],[1162,5,5]];
  for(const [line,channel,object] of cases){const setup=binary([[id('l'),t('='),n(31)],[id('lop'),t('='),n(5)]]).subarray(20),body=raw.subarray(r.lines[line-1],r.lines[line-1]+raw[r.lines[line-1]]*2),code=Buffer.concat([setup,body]),header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
    const {program:p}=execute(Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]));assert.strictEqual(p.state.halted,true);assert.deepStrictEqual(plain(p.channelBinding(channel)),{type:line===991||line===1124?'sprite':'bob',number:object},`Original line ${line}`);p.stop();}
});

test('Planet Zybex: original enemy/player/bullet routing loops preserve the independent background and stop at declared key guards',()=>{
  const oracle=require('./fixtures/planet-zybex/channels.json'),world=require('./fixtures/packed-picture.json').levels[0];
  const {program:p,timers:c}=execute(require('./helpers/planetZybexChannels')(),1000,{files:{read:name=>fs.readFileSync(path.join(__dirname,'../examples/PlanetZybex',name)).toString('latin1')}});
  for(const frame of oracle.frames){if(frame.stage){p.sendKey('next');c.tick(0);}assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.state.variables.int_stage,frame.stage);assert.strictEqual(p.bobs.size,0);for(let channel=0;channel<64;channel++)assert.deepStrictEqual(plain(p.channelBinding(channel)),{type:frame.bobs.includes(channel)?'bob':'sprite',number:channel});assert.strictEqual(hash(p.display.screen(1).pixels),world.indexedSha256);assert.strictEqual(hash(p.display.canvasFrame().rgba),world.windows[0].sha256);}
  p.sendKey('finish');c.tick(0);assert.strictEqual(p.state.halted,true);assert.strictEqual(c.pending(),0);p.stop();
});
