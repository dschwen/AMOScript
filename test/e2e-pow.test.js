/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const { execute, example } = require('./helpers/program');

test('e2e: exponent precedence from Tests26/27.AMOS at FFP precision', () => {
  for (const [number, values] of [[26, [11]], [27, [27, 128, 2187]]]) {
    const { logs, program } = execute(example(number));
    assert.deepStrictEqual(logs.map(args => args.length), values.map(() => 1));
    // FFPPWR uses FFP log/multiply/exp, rather than exact integer powers.
    // Keep the output order strict and allow its documented six-digit error.
    values.forEach((expected, i) => {
      const actual = logs[i][0];
      assert.ok(Number.isFinite(actual));
      assert.ok(Math.abs(actual - expected) <= expected * 1e-6);
    });
    assert.strictEqual(program.state.halted, true);
  }
});

