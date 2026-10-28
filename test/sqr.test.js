/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { binary, token: t, word: w, dword, integer: n, identifier: id, text, execute, compile } = require('./helpers/program');
const Transpiler = require('../lib/Transpiler');
const oracle = require('./fixtures/conformance/sqr.json');
const ffp = bits => [w(0x46), dword(bits)];
const fn = (name, arg) => [t(name), t('('), arg, t(')')];
const decode = hex => {
  const bits = parseInt(hex, 16);
  return bits ? (bits >>> 8) * Math.pow(2, (bits & 127) - 88) : 0;
};

test('Sqr: original token and exact independent FFP vectors span normalization and rounding boundaries', () => {
  assert.deepStrictEqual(t('Sqr'), [0x07, 0x68]);
  const { logs } = execute(binary(oracle.vectors.map(vector =>
    [t('Print'), fn('Sqr', ffp(parseInt(vector.input, 16)))])), 10000);
  assert.deepStrictEqual(logs, oracle.vectors.map(vector => [decode(vector.output)]));
});

test('Sqr: integer promotion and Val tags always produce float results', () => {
  const values = [n(9), ffp(0x90000044), fn('Val', text('9')), fn('Val', text('9.0'))];
  const { logs } = execute(binary(values.map(value => [t('Print'), fn('Sqr', value), t('/'), n(2)])));
  assert.deepStrictEqual(logs, [[1.5], [1.5], [1.5], [1.5]]);
  const promoted = execute(binary([[t('Print'), fn('Sqr', n(16777217)), t(','), fn('Sqr', ffp(0x80000159))]])).logs;
  assert.strictEqual(promoted[0][0], promoted[0][1]);
});

test('Sqr: scalar, array, DATA and procedure returns retain float typing', () => {
  const array = [id('a', 6, 0x41), t('('), n(0), t(')')];
  const lines = [[t('Dim'), array], [array, t('='), fn('Sqr', n(9))],
    [id('i'), t('='), fn('Sqr', n(2))], [id('f', 6, 1), t('='), fn('Sqr', n(9))],
    [t('Data'), w(0), fn('Sqr', n(9))], [t('Read'), id('d', 6, 1)],
    [t('Procedure'), dword(0), w(0), 0, 0, id('p')],
    [t('End Proc'), t('['), fn('Sqr', fn('Val', text('9'))), t(']')], [id('p', 0x12)],
    [t('Print'), array, t('/'), n(2), t(','), id('i'), t(','), id('f', 6, 1), t('/'), n(2),
      t(','), id('d', 6, 1), t('/'), n(2), t(','), t('Param#'), t('/'), n(2)]];
  const { logs, program, timers } = execute(binary(lines));
  assert.deepStrictEqual(logs, [[1.5, 1, 1.5, 1.5, 1.5]]);
  assert.strictEqual(program.state.halted, true);
  assert.strictEqual(timers.pending(), 0);
});

test('Sqr: negative operands fail before assignment with original line context and cancel wakes', () => {
  for (const argument of [n(-1), ffp(0x800000c1), fn('Val', text('-1.0'))]) {
    const { create } = compile(binary([[id('x'), t('='), n(7)], [id('x'), t('='), fn('Sqr', argument)], [t('Print'), n(99)]]));
    const p = create({ setTimeout: () => 1, clearTimeout() {}, now: () => 0 });
    assert.throws(() => p.tick(100), /Illegal function call: Sqr at line 2, byte/);
    assert.strictEqual(p.state.variables.int_x, 7);
    assert.strictEqual(p.state.halted, true);
    assert.strictEqual(p.state.waiting, null);
    assert.throws(() => p.floatSqrt(-0), /Illegal function call: Sqr/);
  }
  assert.throws(() => execute(binary([[t('Data'), w(0), fn('Sqr', n(-1))], [t('Read'), id('x')]])),
    /Illegal function call: Sqr at line 2, byte/);
});

test('Sqr: invalid signatures reject and effectful operands execute once in optimized modules', () => {
  assert.throws(() => new Transpiler(binary([[t('Print'), fn('Sqr', text('9'))]])), /Wrong argument type for Sqr.*line 1/);
  for (const args of [[], [n(1), t(','), n(2)]]) {
    assert.throws(() => new Transpiler(binary([[t('Print'), t('Sqr'), t('('), args, t(')')]])), /line 1/);
  }
  const bytes = binary([[id('x'), t('='), n(1)], [id('y'), t('='), n(2)],
    [id('z', 6, 1), t('='), fn('Sqr', fn('Rnd', n(4)))], [t('Print'), id('z', 6, 1)]]);
  for (const optimize of [false, true]) {
    const vm = require('vm'), sandbox = { module: { exports: {} } };
    vm.runInNewContext(new Transpiler(bytes).toModule({ optimize }), sandbox);
    let reads = 0;
    const p = sandbox.module.exports({ setTimeout: () => 1, clearTimeout() {}, now: () => 0, readRandomBeam: () => { reads++; return 0; } });
    p.tick(100);
    assert.strictEqual(reads, 1);
    assert.strictEqual(p.state.halted, true);
  }
});

test('Sqr: unchanged Kugel source compiles and reveals its negative Plot colour without relaxing validation', () => {
  const bytes = fs.readFileSync(path.join(__dirname, '../examples/Introideen/Kugel.amos'));
  assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), oracle.kugelSha256);
  const { create } = compile(bytes);
  const p = create({ setTimeout: () => 1, clearTimeout() {}, now: () => 0 });
  assert.throws(() => p.tick(300000), /Invalid colour index at line 14, byte 520/);
  const expected = oracle.kugelFailure;
  assert.strictEqual(p.state.variables.int_gx, expected.gx);
  assert.strictEqual(p.state.variables.int_gy, expected.gy);
  assert.strictEqual(p.state.variables.int_p, expected.p);
  assert.strictEqual(p.state.ticks, expected.ticks);
  assert.strictEqual(p.state.halted, true);
  // The independent Euclidean expression crosses the negative integer boundary here.
  assert.strictEqual(Math.trunc(15 - Math.sqrt(109 * 109 + 82 * 82) / 8.5), -1);
});
