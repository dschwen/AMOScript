/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), vm = require('vm');
const Transpiler = require('../lib/Transpiler');
const { binary, token: t, word: w, integer: n, identifier: id, text, example } = require('./helpers/program');
const { createFakeTimers } = require('./helpers/fakeTimers');
function compile(bytes, optimize) {
  const context = { module: { exports: {} } };
  vm.runInNewContext(new Transpiler(bytes).toModule({ optimize }), context);
  return context.module.exports;
}
const snapshot = p => JSON.parse(JSON.stringify({ ip: p.state.ip, ticks: p.state.ticks, location: p.state.location,
  variables: p.state.variables, halted: p.state.halted, waiting: p.state.waiting, stack: p.state.stack,
  frames: p.state.frames, locals: p.state.locals, param: p.state.param },
  (key, value) => Object.prototype.toString.call(value) === '[object Map]' ? Array.from(value) : value));
function pair(bytes, options = () => ({})) {
  return [false, true].map(optimize => {
    const clock = createFakeTimers(4), logs = [], extra = options();
    return { clock, logs, p: compile(bytes, optimize)({ now: clock.now, setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout, write: text => logs.push(text), ...extra }) };
  });
}
test('optimizer: original instruction budgets, typed arithmetic, locations and independent factories', () => {
  const runs = pair(require('./helpers/optimizerProgram')());
  for (const budget of [1, 2, 3, 17, 31, 1000, 7, 2, 4096]) {
    const results = runs.map(({ p }) => JSON.parse(JSON.stringify(p.tick(budget))));
    assert.deepStrictEqual(results[1], results[0]); assert.deepStrictEqual(snapshot(runs[1].p), snapshot(runs[0].p));
  }
  assert.ok(runs[1].p.optimization.blocksExecuted > 0);
  const create = compile(require('./helpers/optimizerProgram')(), true), a = create({ setTimeout() {} }), b = create({ setTimeout() {} });
  a.tick(100); assert.strictEqual(b.optimization.blocksExecuted, 0); assert.strictEqual(b.state.ticks, 0);
  assert.throws(() => new Transpiler(example(1)).toModule({ optimize: 'yes' }), /boolean/);
  runs.forEach(({ p }) => p.stop()); a.stop(); b.stop();
});
test('optimizer: exceptions in a fused block retain the failing instruction and partial progress', () => {
  const bytes = binary([[id('a'), t('='), n(3)], [id('b'), t('='), n(7)],
    [id('c'), t('='), n(1), t('/'), n(0)], [id('d'), t('='), n(9)]]);
  const runs = pair(bytes), errors = runs.map(({ p }) => { try { p.tick(100); } catch (e) { return e.message; } });
  assert.match(errors[0], /zero.*line 3/i); assert.strictEqual(errors[1], errors[0]);
  assert.deepStrictEqual(snapshot(runs[1].p), snapshot(runs[0].p));
  assert.strictEqual(runs[1].p.state.ticks, 2); assert.strictEqual(runs[1].p.state.ip, 2);
  assert.strictEqual(runs[1].p.state.variables.int_d, 0);
});
test('optimizer: calls, arrays and host queries stay barriers; active palette hooks retain clock reads', () => {
  const bytes = binary([[id('a'), t('='), n(1)], [id('b'), t('='), n(2)],
    [id('c'), t('='), t('Timer')], [id('d'), t('='), n(3)], [id('e'), t('='), n(4)], [t('Wait Key')]]);
  const ir = new Transpiler(bytes)._ops;
  assert.strictEqual(ir[0].pure, true); assert.strictEqual(ir[2].pure, undefined);
  for (const active of [false, true]) {
    const runs = pair(bytes);
    runs.forEach(({ p }) => {
      if (active) { p.display.setColour(1, 0xfff); p.fade(2); }
    });
    runs.forEach(({ p }) => p.tick(100));
    assert.deepStrictEqual(snapshot(runs[1].p), snapshot(runs[0].p));
    assert.strictEqual(runs[1].p.optimization.instructionsBatched, active ? 0 : 4);
    runs.forEach(({ p, clock }) => { p.stop(); assert.strictEqual(clock.pending(), 0); });
  }
  const clocks = [0, 0], ps = [false, true].map((optimize, i) => compile(bytes, optimize)({ setTimeout() {}, clearTimeout() {}, now: () => ++clocks[i] }));
  ps.forEach(p => { p.display.setColour(1, 0xfff); p.fade(2); });
  ps.forEach(p => p.tick(100)); assert.strictEqual(clocks[0], clocks[1]);
  assert.deepStrictEqual(snapshot(ps[1]), snapshot(ps[0])); ps.forEach(p => p.stop());
});
test('optimizer: existing numerical, DATA, branching and procedure fixtures match at each tick', () => {
  for (const number of [7, 14, 21, 26, 27]) {
    const runs = pair(example(number));
    for (let tick = 0; tick < 100 && !runs[0].p.state.halted; tick++) {
      const results = runs.map(({ p }) => JSON.parse(JSON.stringify(p.tick([1, 3, 19, 1000][tick % 4]))));
      assert.deepStrictEqual(results[1], results[0]); assert.deepStrictEqual(snapshot(runs[1].p), snapshot(runs[0].p));
      assert.deepStrictEqual(runs[1].logs, runs[0].logs);
    }
    assert.strictEqual(runs[0].p.state.halted, true, `Test${number} did not halt`);
    runs.forEach(({ p }) => p.stop());
  }
});
test('optimizer: complete current Roller II source runs the same input-only milestone replay', () => {
  const assets = require('./helpers/roller2CurrentAssets')(), bytes = Buffer.from(assets['rii:Roller II.AMOS'], 'latin1');
  const results = [false, true].map(optimize => {
    const clock = createFakeTimers(4), files = require('./helpers/roller2GameFiles')(assets), create = compile(bytes, optimize);
    const frames = [], events = []; let p;
    const result = require('./helpers/roller2CurrentReplay')(opts => {
      p = create({ ...opts, audio: { command: e => events.push(e) } }); return p;
    }, clock, files, p => ({ joy: m => p.setJoystick(1, m), key: () => p.sendKey('a'), dispose() {} }),
    () => frames.push(snapshot(p)));
    return JSON.parse(JSON.stringify({ result, frames, events }));
  });
  assert.deepStrictEqual(results[1], results[0]);
});

test('optimizer: arrays, sleep/key waits and named entry points preserve ordinary control flow', () => {
  const array = () => [id('items', 6, 0x40), t('('), n(0), t(')')];
  const bytes = binary([[t('Dim'), array()], [id('a'), t('='), n(1)], [id('b'), t('='), n(2)],
    [array(), t('='), n(9)], [id('c'), t('='), array()], [id('d'), t('='), n(4)],
    [t('Wait Vbl')], [id('a'), t('='), n(5)], [id('b'), t('='), n(6)],
    [t('Wait Key')], [t('Goto'), text('middle')], [id('a'), t('='), n(99)],
    [id('middle', 0xc), id('b'), t('='), n(7)], [id('c'), t('='), n(8)], [t('End')]]);
  const transpiler = new Transpiler(bytes), ir = transpiler._ops;
  assert.strictEqual(ir[3].pure, undefined); assert.strictEqual(ir[4].pure, undefined);
  const runs = pair(bytes);
  runs.forEach(({ p }) => p.tick(100));
  assert.deepStrictEqual(snapshot(runs[1].p), snapshot(runs[0].p)); assert.strictEqual(runs[0].p.state.waiting, 'sleep');
  runs.forEach(({ clock }) => clock.tick(20));
  assert.deepStrictEqual(snapshot(runs[1].p), snapshot(runs[0].p)); assert.strictEqual(runs[0].p.state.waiting, 'key');
  runs.forEach(({ p, clock }) => { p.sendKey('a'); clock.tick(4); });
  assert.deepStrictEqual(snapshot(runs[1].p), snapshot(runs[0].p)); assert.strictEqual(runs[0].p.state.halted, true);
  assert.strictEqual(runs[1].p.state.variables.int_a, 5);
  // No block may span a label, even a dynamically selected, unreferenced one.
  const source = transpiler.toModule({ optimize: true }), middle = transpiler._labels.middle;
  assert.ok(Number.isInteger(middle));
  for (const match of source.matchAll(/blocks\[(\d+)\] = \{ length: (\d+)/g)) {
    assert.ok(!(Number(match[1]) < middle && Number(match[1]) + Number(match[2]) > middle));
  }
});
test('optimizer: long runs split at the bounded block size without changing execution counts', () => {
  const bytes = binary(Array.from({ length: 70 }, (_, i) => [id('a'), t('='), n(i)]));
  const runs = pair(bytes); runs.forEach(({ p }) => p.tick(70));
  assert.deepStrictEqual(snapshot(runs[1].p), snapshot(runs[0].p));
  assert.strictEqual(runs[1].p.optimization.blocksExecuted, 3);
  assert.strictEqual(runs[1].p.optimization.instructionsBatched, 70);
  runs.forEach(({ p }) => p.stop());
});
test('driver Stop: a host callback stops at the completed instruction before following plain or optimized assignments, and Resume continues once',()=>{
  const bytes=binary([[t('Print'),text('pause')],[id('a'),t('='),n(1)],[id('b'),t('='),n(2)]]);
  for(const optimize of [false,true]){
    const clock=createFakeTimers();let p,calls=0;p=compile(bytes,optimize)({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){calls++;p.stop();}});
    p.tick(100);assert.strictEqual(p.state.stopped,true);assert.strictEqual(p.state.halted,false);assert.strictEqual(p.state.ip,1);assert.strictEqual(p.state.variables.int_a,0);assert.strictEqual(p.state.variables.int_b,0);assert.strictEqual(clock.pending(),0);
    clock.tick(1000);assert.strictEqual(p.state.ip,1);p.resume();clock.tick(0);assert.strictEqual(p.state.halted,true);assert.strictEqual(p.state.variables.int_a,1);assert.strictEqual(p.state.variables.int_b,2);assert.strictEqual(calls,1);assert.strictEqual(clock.pending(),0);
  }
});
