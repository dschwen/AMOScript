/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { binary, token: t, integer: n, identifier: id, word: w, text, compile, execute } = require('./helpers/program');
const { createFakeTimers } = require('./helpers/fakeTimers');
const { createJoystickInput } = require('../lib/amos/browser');
const fn = (name, port) => [t(name), t('('), n(port), t(')')];
const pad = (axes = [0, 0], pressed = [], mapping = 'standard') => ({ connected: true, mapping, axes,
  buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: pressed.includes(index) })) });

test('joystick: original query offsets return a mask and AMOS booleans for both independent ports', () => {
  const queries = [[0x11f8,31], [0x1202,-1], [0x120c,-1], [0x1218,-1], [0x1224,-1], [0x1232,-1]];
  const lines = queries.map(([offset]) => [t('Print'), w(offset), t('('), n(1), t(')')]);
  const { create } = compile(binary(lines)), clock = createFakeTimers(), logs = [];
  const p = create({ setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, now: clock.now, print: value => logs.push(value) });
  p.setJoystick(1, 31); assert.strictEqual(p.joystickInfo('Joy', 0), 0); p.tick(100);
  assert.deepStrictEqual(logs, queries.map(entry => entry[1]));
  assert.deepStrictEqual(Array.from(p.state.input.joysticks), [0,0]);
});

test('joystick: typed scalars, arrays, DATA and procedure results preserve integer queries', () => {
  const lines = [[t('Data'), w(0), n(1)], [t('Read'), id('port')], [t('Dim'), id('a'), t('('), n(1), t(')')],
    [id('a'), t('('), n(1), t(')'), t('='), t('Fire'), t('('), id('port'), t(')')],
    [id('f',6,1), t('='), fn('Joy',1)], [t('Procedure'), [0,0,0,0], w(0),0,0,id('readjoy')],
    [t('End Proc'),t('['),fn('Jup',1),t(']')], [id('readjoy',0x12)],
    [t('Print'),id('a'),t('('),n(1),t(')'),t(','),id('f',6,1),t(','),t('Param')]];
  const { create } = compile(binary(lines)), clock = createFakeTimers(), logs = [];
  const p = create({ setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, now: clock.now, print: (...values) => logs.push(values) });
  p.setJoystick(1,17); p.tick(100); assert.deepStrictEqual(logs,[[-1,17,-1]]);
  for (const port of [-1,2]) assert.throws(() => execute(binary([[t('Print'),fn('Joy',port)]])), /Invalid joystick port at line 1/);
  assert.throws(() => compile(binary([[t('Print'),t('Joy'),t('('),text('1'),t(')')]])), /Wrong argument type/);
});

test('joystick: reader ownership, invalid masks, failures and Key Speed/reset lifecycles are explicit', () => {
  const { program: p } = execute(binary([[t('Wait Key')]]));
  p.setJoystick(1,1); p.keySpeed(10,2); assert.strictEqual(p.joystickInfo('Joy',1),1);
  const old = p.setJoystickReader(() => 4), current = p.setJoystickReader(() => 8);
  old(); assert.strictEqual(p.joystickInfo('Joy',1),8); current();
  const reader=()=>2, earlier=p.setJoystickReader(reader), latest=p.setJoystickReader(reader);
  earlier();assert.strictEqual(p.joystickInfo('Joy',1),2);latest();
  p.setJoystick(1,16); p.stop(); assert.strictEqual(p.joystickInfo('Joy',1),0);
  for (const [port,mask] of [[2,1],[1,32],[1,-1],[1,1.5]]) assert.throws(() => p.setJoystick(port,mask), /joystick/);
  const { create } = compile(binary([[t('Print'),fn('Joy',1)]])), clock = createFakeTimers();
  const bad = create({ setTimeout: clock.setTimeout,clearTimeout: clock.clearTimeout,now:clock.now });
  bad.setJoystickReader(() => 99); assert.throws(() => bad.tick(10), /Invalid joystick mask at line 1/);
  assert.strictEqual(bad.state.halted,true);
});

test('joystick mapping: configurable physical keys, repeat independence and opposite-direction neutralization', () => {
  const input = createJoystickInput([{port:1,keyboard:{up:['KeyW','ArrowUp'],fire:'KeyZ'}},{port:0,keyboard:{consume:false,up:'KeyI',fire:[]}}]);
  input.keydown('KeyW'); input.keydown('KeyZ'); input.keydown('KeyI');
  assert.deepStrictEqual(input.read([]).map(entry => [entry.port,entry.mask]), [[1,17],[0,1]]);
  assert.strictEqual(input.keydown('KeyI').consume,false);
  input.keydown('ArrowDown'); assert.strictEqual(input.read([])[0].mask,16);
  input.keyup('KeyW'); assert.strictEqual(input.read([])[0].mask,18);
  input.reset(); input.keydown('KeyZ',true); assert.strictEqual(input.read([])[0].mask,0);
});

test('joystick mapping: standard axes/D-pad/fire, dead zones, raw layouts and disconnected pads', () => {
  const input = createJoystickInput([{port:1,keyboard:true,gamepad:{index:1,deadZone:0.3}}]);
  assert.strictEqual(input.read([null,pad([0.3,-0.3])])[0].mask,0);
  assert.strictEqual(input.read([null,pad([0.7,-0.8],[0])])[0].mask,25);
  assert.strictEqual(input.read([null,pad([0,0],[13,14])])[0].mask,6);
  input.keydown('ArrowUp'); assert.strictEqual(input.read([null,pad([0,1])])[0].mask,0);
  assert.strictEqual(input.read([null,pad([1,1],[],'')])[0].status,'unmapped');
  input.reset(); assert.strictEqual(input.read([])[0].mask,0);
  assert.strictEqual(input.read([null,{...pad([1,1]),connected:false}])[0].status,'waiting');
  const raw = createJoystickInput([{port:0,gamepad:{standardOnly:false,axes:{x:2,y:3},buttons:{fire:2}}}]);
  assert.strictEqual(raw.read([pad([0,0,-1,1],[2],'')])[0].mask,22);
  assert.strictEqual(raw.read([pad([NaN,Infinity,2,-2])])[0].mask,0);
});

test('joystick mapping: invalid ports, duplicate ports, key codes and gamepad settings reject', () => {
  for(const configs of [[{port:2}], [{port:1},{port:1}], [{port:1,keyboard:[]}], [{port:1,keyboard:{up:[1]}}],
    [{port:1,gamepad:{index:-1}}], [{port:1,gamepad:{deadZone:1}}], [{port:1,gamepad:{axes:{x:-1}}}]]) assert.throws(() => createJoystickInput(configs));
});

test('Wonderland: original menu routines animate, toggle background and return both selections', () => {
  const { create } = compile(require('./helpers/wonderlandMenu')());
  for(const selected of [1,2]) {
    const clock = createFakeTimers(), p = create({now:clock.now, setTimeout:(fn,ms)=>clock.setTimeout(fn,Math.max(1,ms)),clearTimeout:clock.clearTimeout,
      files:{read:name=>fs.readFileSync(path.join(__dirname,'../examples/Wonderland',name.split('/').pop())).toString('latin1')}});
    p.tick(100000); p.tick(500); clock.tick(20);
    const move = mask => {p.setJoystick(1,mask);p.tick(500);p.setJoystick(1,0);clock.tick(500);};
    move(2); assert.strictEqual(p.state.variables.int_p,25);
    move(2); assert.strictEqual(p.state.variables.int_p,50);
    p.setJoystick(1,16);p.tick(500);assert.strictEqual(p.state.variables.int_bgon,0);
    p.setJoystick(1,0);p.tick(500); assert.strictEqual(p.bobInfo('I Bob',1),75);
    move(1);assert.strictEqual(p.state.variables.int_p,25);
    if(selected===1) move(1);
    p.setJoystick(1,16);p.tick(500);
    assert.strictEqual(p.state.halted,true);assert.strictEqual(p.state.variables.int_game,selected);assert.strictEqual(clock.pending(),0);
  }
});
