/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const Transpiler = require('../lib/Transpiler');
const { binary, token: t, word, dword, identifier: v, integer: n, text, execute } = require('./helpers/program');
const ffp = bits => [word(0x46), dword(bits)];

test('numbers: AMOS operator token priority, left-associative power and unary sign', () => {
  const result = execute(binary([
    [t('Print'), n(2), t('^'), n(3), t('^'), n(2)],
    [t('Print'), t('-'), n(2), t('^'), n(2)],
    [t('Print'), n(3), t('*'), n(4), t('/'), n(5)],
    [t('Print'), n(7), t('/'), n(2)],
    [t('Print'), t('-'), n(7), t('/'), n(2)],
    [t('Print'), n(1), t('Xor'), n(1), t('Or'), n(1)]
  ]));
  // Power runs through FFP log/multiply/exp, whose documented precision
  // is about six digits. The integer operations remain exact.
  assert.ok(Math.abs(result.logs[0][0] - 64) <= 64e-6);
  assert.ok(Math.abs(result.logs[1][0] - 4) <= 4e-6);
  assert.deepStrictEqual(result.logs.slice(2), [[0], [3], [-3], [0]]);
});

test('numbers: integer assignments truncate floats; float variables preserve fractional results', () => {
  const data = binary([
    [v('a'), t('='), ffp(0xc9062442)],
    [v('a', 6, 1), t('='), ffp(0xc9062442)],
    [v('b'), t('='), t('-'), ffp(0xc9062442)],
    [t('Print'), v('a'), t(','), v('a', 6, 1), t(','), v('b')]
  ]);
  assert.deepStrictEqual(execute(data).logs, [[3, 3.1409997940063477, -3]]);
});

// Decimal Val rejects magnitude 2147483648 before applying its sign.
// Use the valid hexadecimal representation when testing arithmetic at INT_MIN.
const val = value => [t('Val'), t('('), text(value === '-2147483648' ? '$80000000' : value), t(')')];

test('numbers: static and Val integer division retain the signed 32-bit quotient', () => {
  const values = [[-2147483648, -1], [-7, 2], [7, -2], [-2147483648, 1], [0, -1]];
  for (const dynamic of [false, true]) {
    const operand = value => dynamic ? val(String(value)) : n(value);
    const result = execute(binary(values.map(([a, b]) => [t('Print'), operand(a), t('/'), operand(b)])));
    assert.deepStrictEqual(result.logs, [[-2147483648], [-3], [-3], [-2147483648], [0]]);
  }
});

test('numbers: static and Val integer errors halt rather than wrapping arithmetic', () => {
  for (const operand of [n, value => val(String(value))]) {
    for (const [a, op, b, message] of [[2147483647, '+', 1, 'Integer overflow'], [-2147483648, '-', 1, 'Integer overflow'], [2147483647, '*', 2, 'Integer overflow'], [1, '/', 0, 'Division by zero']]) {
      assert.throws(() => execute(binary([[t('Print'), operand(a), t(op), operand(b)]])), new RegExp(`${message} at line 1, byte`));
    }
  }
});

test('numbers: Mod uses evaluator token precedence and returns an integer in nested expressions', () => {
  const values = [
    [n(20), t('Mod'), n(3), t('*'), n(2)],
    [n(20), t('/'), n(3), t('Mod'), n(2)],
    [n(20), t('Mod'), n(3), t('Mod'), n(2)],
    [n(1), t('+'), n(20), t('Mod'), n(6)],
    [val('-7'), t('Mod'), val('4'), t('+'), n(2)],
    [t('-'), t('('), val('17'), t('Mod'), n(5), t(')')],
    [ffp(0xc0000042), t('Mod'), n(2)],
    [t('('), val('3.5'), t('Mod'), n(2), t(')'), t('/'), n(2)]
  ];
  assert.deepStrictEqual(execute(binary(values.map(value => [t('Print'), value]))).logs, [[2], [0], [0], [3], [3], [-2], [1], [0]]);
  assert.throws(() => new Transpiler(binary([[t('Print'), text('17'), t('Mod'), n(5)]])), /Cannot mix/);
  assert.throws(() => new Transpiler(binary([[t('Print'), text('17'), t('Mod'), text('5')]])), /Invalid string operator/);
});

test('numbers: integer multiplication preserves the evaluator quick and checked paths', () => {
  for (const operand of [n, value => val(String(value))]) {
    const pairs = [[50000, 50000], [-50000, 50000], [65535, 65535], [65536, 32767], [-2147483648, 0]];
    assert.deepStrictEqual(execute(binary(pairs.map(([a, b]) => [t('Print'), operand(a), t('*'), operand(b)]))).logs, [[-1794967296], [1794967296], [-131071], [2147418112], [0]]);
    for (const [a, b] of [[65536, 32768], [-2147483648, 1]]) {
      assert.throws(() => execute(binary([[t('Print'), operand(a), t('*'), operand(b)]])), /Integer overflow at line 1, byte/);
    }
  }
});

test('numbers: For stores bound and step once, after initializing its variable', () => {
  const data = binary([
    [v('limit'), t('='), n(3)], [v('step'), t('='), n(1)],
    [t('For'), word(0), v('i'), t('='), n(1), t('To'), v('i'), t('+'), v('limit'), t('Step'), v('step')],
    [t('Print'), v('i')], [v('limit'), t('='), n(0)], [v('step'), t('='), n(99)], [t('Next')]
  ]);
  assert.deepStrictEqual(execute(data).logs, [[1], [2], [3], [4]]);
});

test('numbers: division by zero and integer arithmetic overflow halt with source locations', () => {
  assert.throws(() => execute(binary([[t('Print'), n(3), t('/'), n(0)]])), /Division by zero at line 1/);
  assert.throws(() => execute(binary([[t('Print'), n(2147483647), t('+'), n(1)]])), /Integer overflow at line 1/);
});

test('numbers: integer Inc and unary negation use 32-bit arithmetic', () => {
  const data = binary([
    [v('a'), t('='), n(2147483647)], [t('Inc'), v('a')],
    [t('Print'), v('a')], [t('Print'), t('-'), n(-2147483648)]
  ]);
  assert.deepStrictEqual(execute(data).logs, [[-2147483648], [-2147483648]]);
});

test('strings: Min/Max compare text and subtraction removes repeated occurrences', () => {
  const data = binary([
    [t('Print'), t('Min'), t('('), text('AMOS'), t(','), text('AMOS Professional'), t(')')],
    [t('Print'), t('Max'), t('('), text('AMOS'), t(','), text('AMOS Professional'), t(')')],
    [t('Print'), text('aabb'), t('-'), text('ab')]
  ]);
  assert.deepStrictEqual(execute(data).logs, [['AMOS'], ['AMOS Professional'], ['']]);
});

test('types: string/numeric mixing and wrong assignment types are compile errors', () => {
  const inputs = [
    binary([[v('a'), t('='), text('text')]]),
    binary([[v('a', 6, 2), t('='), n(1)]]),
    binary([[t('Print'), text('text'), t('+'), n(1)]]),
    binary([[t('Print'), t('Sin'), t('('), text('text'), t(')')]])
  ];
  for (const data of inputs) assert.throws(() => new Transpiler(data), /mismatch|mix|Wrong argument type/);
});
