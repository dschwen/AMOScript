'use strict';

const assert = require('assert');
const { createFakeTimers } = require('./helpers/fakeTimers');
const { createProgram } = require('../lib/amos/driver');

test('codegen driver: call/ret stack', () => {
  const ft = createFakeTimers();
  const seen = [];

  const cases = [];
  // 0: call sub at 2, then continue at 1
  cases[0] = (s) => { seen.push(0); return { call: 2 }; };
  // 1: halt
  cases[1] = (s) => { seen.push(1); return { halt: true }; };
  // 2: do work then ret
  cases[2] = (s) => { seen.push(2); return { ret: true }; };

  const prog = createProgram(cases, { setTimeout: ft.setTimeout });
  const r1 = prog.tick(10);

  assert.deepStrictEqual(seen, [0, 2, 1]);
  assert.strictEqual(r1.halted, true);
  assert.strictEqual(ft.pending(), 0);
});

