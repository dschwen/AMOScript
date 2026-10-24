/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const createDisplay=require('../lib/amos/display');
const {binary,token:t,word:w,dword,integer:n,identifier:id,text,compile,execute}=require('./helpers/program');
const zone=(...args)=>[t(args.length===2?'Zone':'Zone Of'),t('('),args.flatMap((v,i)=>[...(i?[t(',')]:[]),n(v)]),t(')')];
const rect=(number,x1,y1,x2,y2)=>[t('Set Zone'),n(number),t(','),n(x1),t(','),n(y1),t('To'),n(x2),t(','),n(y2)];

test('Zones: original overload words reserve, define, reset, query and release through standalone generated code',()=>{
  const result=execute(binary([[w(0x1646),n(2)],rect(1,1,2,5,6),rect(2,3,4,7,8),[t('Print'),zone(3,4),t(','),zone(7,8)],
    [w(0x1660),n(1)],[t('Print'),zone(3,4)],[w(0x164e)],[t('Print'),zone(3,4)],rect(2,1,1,2,2),
    [w(0x1632)],[t('Print'),zone(1,1)]]));
  assert.deepStrictEqual(result.logs,[[1,2],[2],[0],[0]]);assert.strictEqual(result.program.state.halted,true);assert.strictEqual(result.timers.pending(),0);
});

test('Zones: rectangles include all edges, overlap chooses the lowest number, and definitions are independent of bitmap bounds',()=>{
  const d=createDisplay();d.reserveZones(3);d.setZone(2,2,3,8,9);d.setZone(1,4,5,10,11);d.setZone(3,500,600,510,610);
  for(const [x,y,expected]of [[2,3,2],[8,3,2],[2,9,2],[8,9,1],[4,5,1],[10,11,1],[1,3,0],[11,11,0],[500,600,3],[510,610,3]])assert.strictEqual(d.zone(x,y),expected,`${x},${y}`);
  d.resetZone(1);assert.strictEqual(d.zone(8,9),2);d.setZone(1,0,0,1,1);assert.strictEqual(d.zone(0,0),1);
  d.resetZone();assert.strictEqual(d.zone(0,0),0);assert.strictEqual(d.screen().zones.length,12);d.setZone(3,0,0,1,1);assert.strictEqual(d.zone(0,0),3);
  d.reserveZones(1);assert.strictEqual(d.zone(0,0),0);assert.strictEqual(d.screen().zones.length,4);
});

test('Zones: coordinates store/query unsigned words, without endpoint normalization or clipping',()=>{
  const d=createDisplay();d.reserveZones(2);d.setZone(1,-2,-3,-1,-1);d.setZone(2,65536,65536,65537,65537);
  assert.strictEqual(d.zone(-1,-1),1);assert.strictEqual(d.zone(65534,65533),1);assert.strictEqual(d.zone(131071,-1),1);
  assert.strictEqual(d.zone(0,0),2);assert.strictEqual(d.zone(65537,65537),2);assert.strictEqual(d.zone(65538,65537),0);
  assert.throws(()=>d.setZone(1,2,3,1,4),/Invalid zone rectangle/);assert.throws(()=>d.setZone(1,1,3,2,3),/Invalid zone rectangle/);
  assert.throws(()=>d.setZone(1,65535,0,65536,1),/Invalid zone rectangle/);
});

test('Zones: ownership follows actual screens, independent factories and lifecycle, preserving buffers/cursors/presentation',()=>{
  const d=createDisplay();d.reserveZones(1);d.setZone(1,1,1,3,3);const first=d.screen(),zones=first.zones;d.doubleBuffer();d.autoback(2);
  const logical=first.pixels,physical=first.physicalPixels;d.locate(3,4);const version=d.version,before=d.snapshotDisplay();
  d.resetZone(1);d.setZone(1,1,1,3,3);assert.strictEqual(d.version,version);assert.deepStrictEqual(d.snapshotDisplay().frame.linePal,before.frame.linePal);
  d.swap(0);assert.strictEqual(first.zones,zones);assert.strictEqual(first.pixels,physical);assert.strictEqual(first.physicalPixels,logical);assert.deepStrictEqual([first.x,first.y],[3,4]);
  d.open(1,320,200,16,0);assert.strictEqual(d.zone(2,2),0);assert.strictEqual(d.zone(0,2,2),1);assert.strictEqual(d.current,1);
  d.reserveZones(1);d.setZone(1,4,4,5,5);d.screenOffset(1,16,20);assert.strictEqual(d.zone(4,4),1);assert.strictEqual(d.zone(-1,4,4),1);
  d.autoViewOff();d.open(0,320,200,16,0);assert.strictEqual(d.zone(2,2),0);assert.notStrictEqual(d.screen(),first);d.close(0);assert.strictEqual(d.zone(1,4,4),1);
  const {create}=compile(binary([[t('Wait Key')]])),c=require('./helpers/fakeTimers').createFakeTimers(),hooks={now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout},a=create(hooks),b=create(hooks);a.display.reserveZones(1);a.display.setZone(1,0,0,1,1);assert.strictEqual(b.display.zone(0,0),0);a.stop();b.stop();
});

test('Zones: DATA, scalar/array/procedure results and dynamic numeric conversions share the argument path',()=>{
  const val=s=>[t('Val'),t('('),text(s),t(')')];
  const result=execute(binary([[t('Data'),w(0),n(1),t(','),n(3)],[t('Read'),id('count'),t(','),id('edge')],
    [t('Dim'),id('a'),t('('),n(0),t(')')],[id('a'),t('('),n(0),t(')'),t('='),id('edge')],
    [t('Procedure'),dword(0),w(0),0,0,id('p'),t('['),id('v'),t(']')],[t('End Proc'),t('['),id('v'),t(']')],
    [id('p',0x12),t('['),id('a'),t('('),n(0),t(')'),t(']')],
    [t('Reserve Zone Number'),id('count')],[t('Set Zone'),val('1.9'),t(','),n(0),t(','),n(0),t('To'),t('Param'),t(','),t('Param')],
    [id('a'),t('('),n(0),t(')'),t('='),[t('Zone'),t('('),val('3.9'),t(','),n(3),t(')')]],
    [t('Print'),id('a'),t('('),n(0),t(')')]]));
  assert.deepStrictEqual(result.logs,[[1]]);
});

test('Zones: reservations, geometry, missing screens and unsupported forms fail with source context',()=>{
  const d=createDisplay();assert.strictEqual(d.zone(0,0),0);assert.throws(()=>d.setZone(1,0,0,1,1),/not reserved/);assert.throws(()=>d.resetZone(),/not reserved/);
  for(const count of [-1,65536])assert.throws(()=>d.reserveZones(count),/Unsupported zone count/);
  d.reserveZones(65535);d.setZone(65535,1,1,2,2);assert.strictEqual(d.zone(2,2),65535);d.reserveZones(2);
  for(const number of [-1,0,3])assert.throws(()=>d.setZone(number,0,0,1,1),/Invalid zone number/);
  for(const number of [-1,3])assert.throws(()=>d.resetZone(number),/Invalid zone number/);
  for(const which of [-2,8,65535])assert.throws(()=>d.zone(which,0,0),/Unsupported zone screen/);
  assert.throws(()=>d.zone(1,0,0),/not open/);d.close(0);assert.throws(()=>d.zone(1,0,0),/not open/);
  assert.throws(()=>execute(binary([rect(1,0,0,1,1)])),/Zones are not reserved.*line 1, byte 22/);
  for(const line of [[t('Reserve Zone Number'),text('1')],[t('Set Zone'),n(1),t(','),text('0'),t(','),n(0),t('To'),n(1),t(','),n(1)],
    [t('Print'),t('Zone'),t('('),text('0'),t(','),n(0),t(')')]])assert.throws(()=>compile(binary([line])),/numeric|Wrong argument type/i);
  assert.throws(()=>compile(binary([[w(0x169a),t('('),n(0),t(','),n(0),t(')')]])),/Unsupported token/);
});

test('Zones: original Wonderland five-button declarations and Zone expression classify the full panel grid',()=>{
  const {program:p,timers:c}=execute(require('./helpers/wonderlandZones')(),1000,{files:{read:name=>fs.readFileSync(path.join(__dirname,'../examples/Wonderland',name.split('/').pop())).toString('latin1')}});
  c.tick(20);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.display.current,1);const panel=p.display.screen(1),physical=Buffer.from(panel.physicalPixels);
  const rectangles=[[7,7,56,24],[71,7,120,24],[135,7,184,24],[199,7,240,24],[247,7,264,24]];
  for(let y=0;y<32;y++)for(let x=0;x<320;x++){
    const expected=rectangles.findIndex(([x1,y1,x2,y2])=>x>=x1&&x<=x2&&y>=y1&&y<=y2)+1;
    p.setMouse(x+128,y+194,0);p.sendKey('probe');c.tick(0);assert.strictEqual(p.state.variables.int_z,expected,`${x},${y}`);
  }
  assert.deepStrictEqual(Buffer.from(panel.physicalPixels),physical);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(c.pending(),0);p.stop();
});
