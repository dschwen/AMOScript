/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const Transpiler = require('../lib/Transpiler');
const BufferReader = require('../lib/Buffer');
const { binary, token, text, integer, identifier, example, execute, word } = require('./helpers/program');

test('parser: identical source statements both execute', () => {
  const { logs, program } = execute(binary([
    [token('Print'), text('again')], [token('Print'), text('again')]
  ]));
  assert.deepStrictEqual(logs, [['again'], ['again']]);
  assert.strictEqual(program.state.halted, true);
});

test('parser: colon-separated statements execute completely', () => {
  assert.deepStrictEqual(execute(example(8)).logs, [['Hallo'], [1], ['End']]);
  assert.deepStrictEqual(execute(example(13)).logs, [[2], [5], [8], [11], [14], [17], [20]]);
});

test('parser: a label targets the first statement on its line', () => {
  const { logs, program } = execute(example(25), 6);
  assert.deepStrictEqual(logs, [['Hallo'], ['Hallo'], ['Hallo']]);
  assert.strictEqual(program.state.halted, false);
});

test('parser: numbers preserve order and scientific notation in Test7', () => {
  const { logs, program, transpiler } = execute(example(7));
  assert.strictEqual(logs.length, 4);
  assert.ok(Math.abs(logs[0][0] - 3.141) < 0.000001);
  assert.strictEqual(logs[1][0], -100);
  assert.strictEqual(logs[2][0], 10000);
  // The binary's FFP payload is 0x96b43f55; the .Asc reference is rounded.
  assert.strictEqual(logs[3][0], 1234567.875);
  assert.strictEqual(program.state.halted, true);
  assert.ok(transpiler._ops.every(op => op.location && op.location.offset >= 20));
});

test('parser: Test21 has exact output without filtering duplicates or trailing code', () => {
  const { logs, program } = execute(example(21));
  assert.deepStrictEqual(logs, [['Start'], ['One'], ['Two'], ['Three'], ['End']]);
  assert.strictEqual(program.state.halted, true);
  assert.strictEqual(program.state.stack.length, 0);
});

test('parser: rejects unresolved/duplicate labels, unmatched loops, unknown tokens and trailing syntax', () => {
  const bad = [
    [binary([[token('Goto'), identifier('missing', 0x18)]]), /Unresolved label missing.*line 1, byte/],
    [binary([[identifier('same', 0xc)], [identifier('same', 0xc)]]), /Duplicate label same/],
    [binary([[token('Next')]]), /Next without For/],
    [example(14).subarray(0, 80), /Truncated AMOS/],
    [binary([[word(0x1234)]]), /Unsupported token 0x1234.*line 1, byte 22/],
    [binary([[token('Print'), integer(1), integer(2)]]), /Expected end of statement/]
  ];
  for (const [data, expected] of bad) assert.throws(() => new Transpiler(data), expected);
});

test('parser: strings escape quotes, slashes and newlines safely', () => {
  const value = 'a"\\\n\'b';
  assert.deepStrictEqual(execute(binary([[token('Print'), text(value)]])).logs, [[value]]);
});

test('buffer: containing line lookup and absolute address zero', () => {
  const data = binary([[token('Print'), text('x')], []]);
  const b = new BufferReader(data);
  b.ip = b.lines[0] + 3;
  assert.strictEqual(b.lineNumber(), 0);
  b.ip = b.lines[1];
  assert.strictEqual(b.lineNumber(), 1);
  b.ip++;
  assert.strictEqual(b.lineNumber(), 1);
  b.ip = 20 + b.code_bytes;
  assert.strictEqual(b.lineNumber(), 2);
  assert.strictEqual(b.getByte(0), 'A'.charCodeAt(0));
});

test('buffer: truncated headers, zero/short lines and out-of-bounds payloads fail promptly', () => {
  assert.throws(() => new BufferReader(new Uint8Array(19)), /Truncated/);
  for (const size of [0, 1, 255]) {
    const data = binary([[]]);
    data[20] = size;
    assert.throws(() => new BufferReader(data), /Invalid AMOS line length/);
  }
  assert.throws(() => new Transpiler(binary([[token('Print'), word(0x26), word(100)]])), /Truncated token.*line 1/);
});
