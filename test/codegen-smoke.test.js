'use strict';

const assert = require('assert');
const { createFakeTimers } = require('./helpers/fakeTimers');
const { createProgram } = require('../lib/amos/driver');

test('codegen driver: switch(ip) dispatch, yield and sleep', () => {
  const ft = createFakeTimers();

  const log = [];
  const cases = [];
  cases[0] = (state) => { log.push('op0'); /* default next ip */ };
  cases[1] = (state) => { log.push('op1'); return { yield: true }; };
  cases[2] = (state) => { log.push('op2'); return { sleepVbl: 1 }; };
  cases[3] = (state) => { log.push('op3'); return { halt: true }; };

  const prog = createProgram(cases, { setTimeout: ft.setTimeout, vblHz: 50, sleepScale: 1 });

  // First tick runs op0 and op1, yields after op1 and schedules immediate continuation
  const r1 = prog.tick(10);
  assert.strictEqual(r1.ip, 2);
  assert.deepStrictEqual(log, ['op0', 'op1']);
  assert.strictEqual(ft.pending(), 1);

  // Run scheduled continuation (delay 0), which executes op2 and schedules a sleep of 1 VBL (20ms)
  ft.tick(0);
  assert.deepStrictEqual(log, ['op0', 'op1', 'op2']);
  assert.strictEqual(ft.pending(), 1);

  // Advance time by 20ms (1 VBL at 50Hz), which continues to op3 and halts.
  ft.tick(20);
  assert.deepStrictEqual(log, ['op0', 'op1', 'op2', 'op3']);
  assert.strictEqual(ft.pending(), 0);
});

