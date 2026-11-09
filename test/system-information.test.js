/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), vm = require('vm');
const Transpiler = require('../lib/Transpiler');
const memoryFactory = require('../lib/amos/bankMemory');
const { binary, token: t, word: w, integer: n, identifier: id } = require('./helpers/program');
const { createFakeTimers } = require('./helpers/fakeTimers');
const ext = (slot, offset) => [w(0x4e), [slot, 0], w(offset)];
const fn = (name, args) => [t(name), t('('), args, t(')')];
function build(lines) {
  const transpiler = new Transpiler(binary(lines), { extensions: {8:'amcaf-1.50beta4'} });
  const sandbox = { module: {exports:{}} }; vm.runInNewContext(transpiler.toModule(), sandbox);
  return sandbox.module.exports;
}
function instance(create, options = {}) {
  const timers = createFakeTimers();
  return create({ ...options, now:timers.now, setTimeout:timers.setTimeout, clearTimeout:timers.clearTimeout });
}

test('System information: explicit isolated Exec version islands, big-endian bytes and strict default bounds', () => {
  const create = build([[id('v'), t('='), fn('Deek', [fn('Leek', n(4)), t('+'), n(20)])], [t('Wait Key')]]);
  const info = {execVersion:40}, a = instance(create, {systemInfo:info}), b = instance(create, {systemInfo:{execVersion:34}});
  info.execVersion = 1; a.tick(100); b.tick(100);
  assert.strictEqual(a.state.variables.int_v, 40); assert.strictEqual(b.state.variables.int_v, 34);
  assert.strictEqual(a.leek(4), 0x2000); assert.strictEqual(a.peek(0x2014), 0); assert.strictEqual(a.peek(0x2015), 40);
  const ordinary = instance(create); assert.throws(() => ordinary.tick(100), /out of bounds.*line 1/);
  for (const address of [0, 3, 8, 0x2000, 0x2013, 0x2016]) assert.throws(() => a.peek(address), /bounds/);
  assert.throws(() => a.leek(5), /bounds/); assert.throws(() => a.leek(0x2014), /bounds/);
  for (const systemInfo of [{}, [], {execVersion:-1}, {execVersion:65536}, {execVersion:1.5}, {execVersion:40, other:1}]) assert.throws(() => instance(create,{systemInfo}), /systemInfo/);
  a.stop(); b.stop();
});

test('System information: all writes and bulk destinations reject before mutation while checked reads can copy out', () => {
  const bank = {number:9,type:'data',data:new Uint8Array(16)}, memory = memoryFactory(new Map([[9,bank]]), {systemInfo:{execVersion:40}});
  const address = memory.start(9);
  for (const operation of [() => memory.poke(4,0), () => memory.doke(0x2014,0), () => memory.loke(4,0),
    () => memory.write(4,Uint8Array.of(1,2,3,4)), () => memory.fill(4,8,0), () => memory.copy(address,address+4,4)]) assert.throws(operation,/read-only/);
  assert.strictEqual(memory.leek(4),0x2000); assert.strictEqual(memory.deek(0x2014),40);
  memory.copy(4,8,address); assert.deepStrictEqual(Array.from(bank.data.slice(0,4)),[0,0,32,0]);
  assert.throws(() => memory.copy(0x2014,0x2018,address),/bounds/);
  assert.deepStrictEqual(Array.from(bank.data.slice(0,4)),[0,0,32,0]);
  const p = instance(build([[t('Wait Key')]]),{systemInfo:{execVersion:40},files:{read:()=>String.fromCharCode(1,2)}});
  assert.throws(() => p.bload('version.bin',0x2014),/read-only/);
  assert.strictEqual(p.deek(0x2014),40); p.stop();
});

test('Ghostlight boot expression: the original Exec version comparison chooses old/new branches without unbounded RAM access', () => {
  const create = build([[id('wb13'),t('='),fn('Deek',[fn('Leek',n(4)),t('+'),n(20)]),t('<'),n(36)], [t('If'),w(0),id('wb13')],
    [t('Break Off')],[t('Endif')],[t('Close Workbench')],[ext(8,0x05d6)],[ext(8,0x0956)],[t('Wait Key')]]);
  for (const version of [34,36,40,65535]) {
    const calls = [], p = instance(create,{systemInfo:{execVersion:version},system:{command:name=>{calls.push(name);}}}); p.tick(100);
    assert.strictEqual(p.state.variables.int_wb13,version<36?-1:0); assert.strictEqual(p.state.breakEnabled,version>=36);
    assert.deepStrictEqual(calls,[...(version<36?['Break Off']:[]),'Close Workbench','Flush Libs','Audio Lock']);
    assert.strictEqual(p.state.system.libraryFlushRequests,1); assert.strictEqual(p.state.system.audioLocked,true); p.stop();
  }
});

test('Boot commands: original offsets notify synchronously, commit after success and preserve factory isolation', () => {
  const create = build([[ext(3,0x0016)],[w(0x24aa)],[ext(8,0x05d6)],[ext(8,0x0956)],[t('Wait Key')]]);
  const calls = [], a = instance(create,{system:{command:name=>{calls.push(name);}}}), b = instance(create);
  a.state.system.amosFront = false; a.tick(100);
  assert.deepStrictEqual(calls,['Request Off','Amos To Front','Flush Libs','Audio Lock']);
  assert.strictEqual(a.state.system.requesterTarget,'off'); assert.strictEqual(a.state.system.amosFront,true);
  assert.strictEqual(b.state.system.audioLocked,undefined); b.tick(100); assert.strictEqual(b.state.system.audioLocked,true);
  for (const command of [() => Promise.resolve(), () => {throw Error('host failure');}]) {
    const p = instance(build([[ext(8,0x0956)]]),{system:{command}});
    assert.throws(() => p.tick(100),/synchronously|host failure/); assert.strictEqual(p.state.system.audioLocked,undefined);
  }
  a.stop(); b.stop();
});

test('System information: standalone page opts in explicitly and validates metadata before emitting HTML', () => {
  const {buildGamePage} = require('../tools/build_game_page');
  const source = binary([[t('Print'),fn('Deek',[fn('Leek',n(4)),t('+'),n(20)])],[t('End')]]);
  assert.ok(buildGamePage(source,{systemInfo:{execVersion:40}}).includes('"systemInfo":{"execVersion":40}'));
  assert.throws(() => buildGamePage(source,{systemInfo:{execVersion:-1}}),/systemInfo/);
});
