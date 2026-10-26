/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto'),createDisplay=require('../lib/amos/display');
const {binary,token:t,integer:n,word:w,dword,identifier:id,text,compile,execute}=require('./helpers/program');
const reserve=(slot)=>[t('Set Rainbow'),n(slot),t(','),n(1),t(','),n(16),t(','),text(''),t(','),text(''),t(','),text('')];

test('Rainbow Del: defined/absent slots, negative/all forms, recreation and factory ownership are independent of screens',()=>{
  const d=createDisplay(),other=createDisplay();for(let slot=0;slot<4;slot++)d.setRainbow(slot,1,16,'','','',0x123+slot);other.setRainbow(0,1,16,'','','',0xabc);
  const first=d.rainbows.get(0),retained=d.rainbows.get(1);d.rainbowDel(0);assert.strictEqual(d.rainbows.size,3);assert.strictEqual(d.rainbows.get(1),retained);assert.throws(()=>d.rainColour(0,0),/out of bounds/);assert.throws(()=>d.rainbow(0),/not defined/);
  const version=d.version;d.rainbowDel(0);assert.strictEqual(d.version,version);for(const number of [4,65536,0.5,NaN,Infinity]){assert.throws(()=>d.rainbowDel(number),/Rainbow Del|integer/);assert.strictEqual(d.rainbows.size,3);assert.strictEqual(d.version,version);}
  d.setRainbow(0,1,16,'','','');assert.notStrictEqual(d.rainbows.get(0),first);first.colours[0]=0xfff;assert.strictEqual(d.rainColour(0,0),0);assert.strictEqual(d.rainbowDel(-2),undefined);assert.strictEqual(d.rainbows.size,0);assert.strictEqual(other.rainColour(0,0),0xabc);
  d.setRainbow(3,1,16,'','','');d.close(0);d.rainbowDel();assert.strictEqual(d.rainbows.size,0);const emptyVersion=d.version;d.rainbowDel(-2147483648);assert.strictEqual(d.version,emptyVersion);
});

test('Rainbow Del: original arities and typed DATA/array/procedure/boxed selectors evaluate once with source-context failures',()=>{
  const calls=[],{program:p,timers:c}=execute(binary([reserve(0),reserve(1),[t('Data'),w(0),n(1)],[t('Read'),id('slot')],[t('Dim'),id('a'),t('('),n(1),t(')')],[id('a'),t('('),n(1),t(')'),t('='),id('slot')],
    [t('Procedure'),dword(0),w(0),0,0,id('selector')],[t('End Proc'),t('['),t('Val'),t('('),text('0.9'),t(')'),t(']')],[id('selector',0x12)],
    [w(0xdd4),t('Param#')],[t('Wait Key')],[t('Rainbow Del Number'),id('a'),t('('),n(1),t(')')],[t('Wait Key')],reserve(2),reserve(3),
    [t('Rainbow Del Number'),t('Val'),t('('),t('Fsel$'),t('('),text('selector'),t(')'),t(')')],[t('Wait Key')],reserve(0),[w(0xdc2)],[t('Wait Key')]]),1000,{files:{select({path}){calls.push(path);return'-2.9';}}});
  assert.deepStrictEqual(Array.from(p.display.rainbows.keys()),[1]);p.sendKey('next');c.tick(0);assert.strictEqual(p.display.rainbows.size,0);p.sendKey('next');c.tick(0);assert.strictEqual(p.display.rainbows.size,0);assert.deepStrictEqual(calls,['selector']);p.sendKey('next');c.tick(0);assert.strictEqual(p.display.rainbows.size,0);p.stop();
  assert.throws(()=>compile(binary([[t('Rainbow Del Number'),text('0')]])),/numeric.*line 1/);assert.throws(()=>compile(binary([[t('Rainbow Del'),n(0)]])),/end of statement/);assert.throws(()=>execute(binary([[t('Rainbow Del Number'),n(4)]])),/Unsupported Rainbow Del.*line 1, byte/);
});

test('Rainbow Del: live removal under Auto View Off reveals the current palette without mutating snapshots, buffers or fade wakes',()=>{
  const {program:p,timers:c}=execute(binary([[t('Wait Key')]])),d=p.display;d.clear(1);d.setColour(1,0xfff);d.setRainbow(0,1,16,'','','',0x0f0);d.rainbow(0,0,50,16);d.autoViewOff();const snapshot=d.snapshotDisplay(),pixels=d.screen().pixels.slice(),selection=d.current;
  p.fade(1);c.tick(20);assert.strictEqual(d.screen().palette[1],0xeee);assert.strictEqual(p.state.fade.active,true);d.rainbowDel(0);assert.strictEqual(d.autoView,false);assert.strictEqual(d.current,selection);assert.deepStrictEqual(d.screen().pixels,pixels);assert.deepStrictEqual(Array.from(d.rgba().slice(0,4)),[238,238,238,255]);assert.deepStrictEqual(Array.from(d.renderDisplay().slice(0,4)),[238,238,238,255]);assert.deepStrictEqual(Array.from(snapshot.frame.linePal.slice(4,8)),[0,255,0,255]);
  c.tick(20);assert.strictEqual(d.screen().palette[1],0xddd);assert.strictEqual(p.state.fade.active,true);p.stop();assert.strictEqual(c.pending(),0);
});

test('Roller2 Rainbow Del: unchanged line 557 returns through its declared HOPSCREEN guard and three independent PAL images match Canvas/copper',()=>{
  const {program:p,timers:c}=execute(require('./helpers/roller2RainbowDel')()),expected=require('./fixtures/roller2/rainbow-del.json').frames,hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
  const table=p.display.rainbows.get(1),pixels=p.display.screen().pixels.slice();let previous=null;
  for(const [index,frame]of expected.entries()){if(index){p.sendKey('next');c.tick(0);}const rgba=p.display.canvasFrame().rgba,png=require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/roller2',frame.png))).rgba;assert.deepStrictEqual(Array.from(p.display.rainbows.keys()),frame.slots);assert.strictEqual(p.display.current,1);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.state.frames.length,index===0?1:0);assert.strictEqual(hash(rgba),frame.rgbaSha256);assert.deepStrictEqual(Buffer.from(rgba),Buffer.from(png));assert.deepStrictEqual(p.display.screen().pixels,pixels);
    const cpu=p.display.renderDisplay();for(let i=0;i<rgba.length;i++)assert.strictEqual(cpu[Math.floor(i/4)*8+i%4],rgba[i]);if(index===1)assert.strictEqual(p.display.rainbows.get(1),table);if(previous)assert.notDeepStrictEqual(rgba,previous);previous=rgba;
  }p.stop();assert.strictEqual(c.pending(),0);
});
