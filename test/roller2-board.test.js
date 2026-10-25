/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {compile}=require('./helpers/program'),goldens=require('./fixtures/roller2/boards.json').levels;
const create=compile(require('./helpers/roller2Board')()).create,icons=fs.readFileSync(path.join(__dirname,'../examples/Roller2/iffp/icons.abk'),'latin1');
function start(level='1',invalid=false){const clock=require('./helpers/fakeTimers').createFakeTimers(4),raw=fs.readFileSync(path.join(__dirname,'../examples/Roller2/levl',level));if(invalid)raw[20]=0;
  const p=create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files:{read:name=>name==='icons'?icons:raw.toString('latin1')}});p.tick(1000);return{p,clock,raw};}
const hash=bytes=>crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');

test('Roller2 GAMEDISP: all fifteen original boards match independent indexed/RGBA goldens and source tile counts',()=>{
  for(const item of goldens){const {p,clock,raw}=start(item.level);clock.tick(700);const pixels=p.display.screen().physicalPixels;
    assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.state.variables.int_counted,item.countedTiles);assert.strictEqual(hash(raw),item.sourceSha256);assert.strictEqual(hash(pixels),item.indicesSha256);
    assert.deepStrictEqual(Buffer.from(p.banks.get(10).data),raw.subarray(20));assert.ok(p.display.screen().palette.every(rgb=>rgb===0));
    p.sendKey('preview');clock.tick(4);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(hash(p.display.canvasFrame().rgba),item.rgbaSha256);
    const png=require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/roller2',item.png)));assert.deepStrictEqual(Buffer.from(p.display.canvasFrame().rgba),Buffer.from(png.rgba));
    assert.strictEqual(hash(pixels),item.indicesSha256);p.stop();assert.strictEqual(clock.pending(),0);
  }
});

test('Roller2 GAMEDISP: two fresh factories own independent copied icons, maps, palette and procedure results',()=>{
  const a=start('1'),b=start('10');a.clock.tick(700);b.clock.tick(700);
  assert.strictEqual(a.p.state.variables.int_counted,goldens.find(x=>x.level==='1').countedTiles);assert.strictEqual(b.p.state.variables.int_counted,goldens.find(x=>x.level==='10').countedTiles);
  a.p.banks.get(2).images[17].pixels.fill(0);a.p.banks.get(10).data.fill(0);a.p.display.screen().physicalPixels.fill(0);
  assert.strictEqual(hash(b.p.display.screen().physicalPixels),goldens.find(x=>x.level==='10').indicesSha256);a.p.stop();b.p.stop();
});

test('Roller2 GAMEDISP: Stop pauses its original FDZ wait; Resume completes its original drawing',()=>{
  const {p,clock}=start();clock.tick(200);assert.strictEqual(p.state.waiting,'sleep');p.stop();const ticks=p.state.ticks;clock.tick(1000);assert.strictEqual(p.state.ticks,ticks);
  p.resume();clock.tick(700);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(hash(p.display.screen().physicalPixels),goldens[0].indicesSha256);p.stop();assert.strictEqual(clock.pending(),0);
});

test('Roller2 GAMEDISP: invalid tile data halts with source context and no pending timers',()=>{
  const {p,clock}=start('1',true);assert.throws(()=>clock.tick(700),/Invalid image number.*line \d+, byte/);assert.strictEqual(p.state.halted,true);assert.strictEqual(clock.pending(),0);
});
