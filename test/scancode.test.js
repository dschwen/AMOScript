/* jshint esversion: 6 */
'use strict';
const assert = require('assert');
const { binary, token: t, integer: n, word: w, dword, identifier: id, text, compile, execute } = require('./helpers/program');
const { amigaScanCode } = require('../lib/amos/browser');
const clockOptions = clock => ({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });

function idle() { const clock = require('./helpers/fakeTimers').createFakeTimers(); return { clock, p: compile(binary([[t('Wait Vbl')],[t('Wait Key')]])).create(clockOptions(clock)) }; }

test('Scancode: raw offset reads the last successful Inkey once, preserving it across empty reads and Clear Key', () => {
  const {p} = idle(); p.sendKey('\x1b',69);
  assert.strictEqual(p.inputValue('Scancode'),0); assert.strictEqual(p.inputValue('Inkey$'),'\x1b');
  p.clearKeys(); assert.strictEqual(p.inputValue('Inkey$'),''); assert.strictEqual(p.inputValue('Scancode'),69); assert.strictEqual(p.inputValue('Scancode'),0);
  p.sendKey('A',32); assert.strictEqual(p.inputValue('Inkey$'),'A'); p.sendKey('b',53); p.clearKeys();
  assert.strictEqual(p.inputValue('Scancode'),32); assert.strictEqual(p.inputValue('Inkey$'),'');
  p.sendKey('a',32);p.inputValue('Inkey$');p.sendKey('');p.sendKey('\0',0);
  assert.strictEqual(p.inputValue('Inkey$'),'');assert.strictEqual(p.inputValue('Inkey$'),'');assert.strictEqual(p.inputValue('Scancode'),32);
  const {create}=compile(binary([[t('Print'),w(0x1262),t(','),w(0x1262)]])), logs=[];
  const a=create({setTimeout(){},print:(...v)=>logs.push(v)});a.sendKey('x',50);a.inputValue('Inkey$');a.tick(10);assert.deepStrictEqual(logs,[[50,0]]);
});

test('Scancode: mixed text/raw queues retain per-entry metadata, including NUL ASCII and independent factories', () => {
  const {p}=idle(),{p:other}=idle(); p.sendKey('x',50);p.putKeys('ab');p.sendKey('\0',80);p.sendKey('legacy');
  const actual=[];for(let i=0;i<5;i++)actual.push([p.inputValue('Inkey$'),p.inputValue('Scancode')]);
  assert.deepStrictEqual(actual,[['x',50],['a',0],['b',0],['\0',80],['legacy',0]]);
  assert.strictEqual(other.inputValue('Scancode'),0);assert.strictEqual(other.inputValue('Inkey$'),'');
  for(const [key,scan]of [['x',-1],['x',128],['x',1.5],['xx',32],['',32],['\u0100',32]])assert.throws(()=>p.sendKey(key,scan),/raw keyboard/);
  assert.throws(()=>p.sendKey(32),/must be a string/);
  assert.throws(()=>execute(binary([[t('Put Key'),text('\x01\0\x45\x1b')]])),/Encoded Put Key.*line 1/);
});

test('Scancode: typed arrays, DATA, scalar and procedure result storage preserve destructive integer reads', () => {
  const lines=[[t('Dim'),id('a'),t('('),n(0),t(')')],[t('Data'),w(0),w(0x1262)],[t('Read'),id('value')],
    [id('a'),t('('),n(0),t(')'),t('='),id('value')],[id('f',6,1),t('='),id('value')],
    [t('Procedure'),dword(0),w(0),0,0,id('code')],[id('key',6,2),t('='),t('Inkey$')],[t('End Proc'),t('['),w(0x1262),t(']')],
    [id('code',0x12)],[t('Print'),id('a'),t('('),n(0),t(')'),t(','),id('f',6,1),t(','),t('Param')]];
  const {create}=compile(binary(lines)),logs=[],p=create({setTimeout(){},print:(...v)=>logs.push(v)});
  p.sendKey('a',32);p.inputValue('Inkey$');p.sendKey('b',53);p.tick(100);assert.deepStrictEqual(logs,[[32,32,53]]);
  assert.throws(()=>compile(binary([[t('Print'),w(0x1262),t('('),n(1),t(')')]])),/end of statement.*line 1/);
});

test('Scancode: Wait Key consumes events without changing the last Inkey latch; Key Speed retains it', () => {
  const clock=require('./helpers/fakeTimers').createFakeTimers();
  const {create}=compile(binary([[t('Wait Key')],[t('Wait Vbl')],[t('Print'),w(0x1262)]])),logs=[];
  const p=create({...clockOptions(clock),print:v=>logs.push(v)});p.sendKey('a',32);p.inputValue('Inkey$');p.keySpeed(10,2);
  p.sendKey('x',50);p.tick(100);clock.tick(20);assert.deepStrictEqual(logs,[32]);
  const waiting=create({...clockOptions(clock),print:v=>logs.push(v)});waiting.tick(100);waiting.sendKey('x',50);clock.tick(20);assert.deepStrictEqual(logs,[32,0]);
});

test('Scancode: Stop, explicit cleanup, End and failures clear physical metadata while retaining queued text', () => {
  const {p,clock}=idle();p.sendKey('\x1b',69);p.inputValue('Inkey$');p.sendKey('a',32);p.stop();
  assert.strictEqual(p.inputValue('Scancode'),0);assert.strictEqual(p.inputValue('Inkey$'),'a');assert.strictEqual(p.inputValue('Scancode'),0);
  p.resume();p.sendKey('x',50);p.clearScanCodes();assert.strictEqual(p.inputValue('Inkey$'),'x');assert.strictEqual(p.inputValue('Scancode'),0);p.stop();assert.strictEqual(clock.pending(),0);
  for(const end of [t('End'),t('Return')]) {
    const q=compile(binary([[end]])).create({setTimeout(){}});q.sendKey('a',32);q.inputValue('Inkey$');
    if(end[1]===0x60)assert.throws(()=>q.tick(10),/Return without Gosub/);else q.tick(10);
    assert.strictEqual(q.inputValue('Scancode'),0);
  }
});

test('Scancode browser mapping: physical rows, keypad, controls and function keys match Amiga codes', () => {
  const cases={Backquote:0,Digit1:1,Digit0:10,Minus:11,Backslash:13,KeyQ:16,KeyA:32,KeyZ:49,KeyM:55,
    IntlBackslash:48,Space:64,Backspace:65,Tab:66,NumpadEnter:67,Enter:68,Escape:69,Delete:70,
    ArrowUp:76,ArrowDown:77,ArrowRight:78,ArrowLeft:79,F1:80,F10:89,NumpadAdd:94,Help:95,
    Numpad0:15,Numpad1:29,Numpad5:46,Numpad9:63};
  for(const [key,scan]of Object.entries(cases))assert.strictEqual(amigaScanCode(key),scan,key);
  assert.strictEqual(amigaScanCode('F11'),null);assert.strictEqual(amigaScanCode('KeyUnidentified'),null);
});

test('Scancode: original Wonderland input/Escape branch closes both screens and loads the unchanged title routine', () => {
  const fs=require('fs'),path=require('path'),{decodePng}=require('./helpers/displayPng');
  for(const [key,scan,route]of [['\x1b',69,2],['\x1e',76,1],['\x1f',77,1],['\x1c',78,1],['\x1d',79,1],['A',32,1]]) {
    const {program:p,timers}=execute(require('./helpers/wonderlandKeyboard')(),1000,{files:{read:name=>fs.readFileSync(path.join(__dirname,'../examples/Wonderland',name.split('/').pop())).toString('latin1')}});
    p.sendKey(key,scan);timers.tick(40);
    assert.strictEqual(p.state.variables.int_scod,scan);assert.strictEqual(p.state.variables.string_i,key.toLowerCase());
    assert.strictEqual(p.state.variables.int_route,route);assert.strictEqual(p.display.screens.size,route===2?1:2);
    if(route===2) {
      const png=decodePng(fs.readFileSync(path.join(__dirname,'fixtures/wonderland/title-setup.png')));
      assert.deepStrictEqual(Buffer.from(p.display.renderDisplay()),Buffer.from(png.rgba));
    }
    assert.strictEqual(p.state.waiting,'key');assert.strictEqual(timers.pending(),0);p.stop();
  }
});
