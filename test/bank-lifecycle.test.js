/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Transpiler = require('../lib/Transpiler');
const { createProgram } = require('../lib/amos/driver');
const { binary, token: t, word: w, integer: n, text, execute, compile } = require('./helpers/program');
const golden = Buffer.from(fs.readFileSync(path.join(__dirname, 'fixtures/image-banks.hex'), 'utf8').replace(/\s/g, ''), 'hex');
const withBanks = lines => Buffer.concat([binary(lines), golden.subarray(20)]);
const reserve = (kind, number, length) => [t(`Reserve As ${kind}`), n(number), t(','), n(length)];
const length = number => [t('Length'), t('('), n(number), t(')')];
const printLengths = (...numbers) => [t('Print'), numbers.flatMap((number, i) => [...(i ? t(',') : []), length(number)])];

test('bank lifecycle: Reserve creates zeroed independent banks with work/data and chip/fast metadata', () => {
  const lines = [reserve('Work', 5, 3), reserve('Chip Work', 6, 4), reserve('Data', 7, 5), reserve('Chip Data', 8, 6), printLengths(5, 6, 7, 8)];
  const { create } = compile(binary(lines));
  const make = () => { const program = create({ setTimeout() {}, print() {} }); program.tick(100); return program; };
  const a = make(), b = make();
  for (const [number, memory, permanent, size] of [[5, 'fast', false, 3], [6, 'chip', false, 4], [7, 'fast', true, 5], [8, 'chip', true, 6]]) {
    const bank = a.banks.get(number);
    assert.strictEqual(bank.memory, memory);
    assert.strictEqual(bank.permanent, permanent);
    assert.strictEqual(bank.name, permanent ? 'Data    ' : 'Work    ');
    assert.deepStrictEqual(Array.from(bank.data), Array(size).fill(0));
  }
  a.banks.get(5).data[0] = 9;
  assert.strictEqual(b.banks.get(5).data[0], 0);
  a.reserveData(5, 7);
  assert.deepStrictEqual(Array.from(a.banks.get(5).data), Array(7).fill(0));
  assert.strictEqual(a.banks.get(5).permanent, true);
  assert.deepStrictEqual(execute(binary(lines)).logs, [[3, 4, 5, 6]]);
});

test('bank lifecycle: Erase Temp removes work banks and preserves data, Objects and Icons', () => {
  const { program, logs } = execute(withBanks([
    reserve('Work', 5, 3), reserve('Chip Work', 6, 4), reserve('Data', 7, 5), reserve('Chip Data', 8, 6),
    [t('Erase Temp')], printLengths(1, 2, 5, 6, 7, 8), [t('Erase'), n(7)], printLengths(7, 8)
  ]));
  assert.deepStrictEqual(logs, [[2, 1, 0, 0, 5, 6], [0, 6]]);
  assert.deepStrictEqual([...program.banks.keys()], [1, 2, 8]);
});

test('bank lifecycle: missing-bank Erase is harmless and Erase All clears all types repeatedly', () => {
  const { program, logs } = execute(withBanks([reserve('Work', 5, 7), [t('Erase'), n(-1)],
    [t('Erase'), n(999999)], printLengths(1, 2, 5), [t('Erase All')], printLengths(1, 2, 5),
    [t('Erase All')], [t('Erase Temp')], [t('Erase'), n(1)]]));
  assert.deepStrictEqual(logs, [[2, 1, 7], [0, 0, 0]]);
  assert.strictEqual(program.banks.size, 0);
});

test('bank lifecycle: allocation failure follows erasure and halts without restoring the old bank', () => {
  const program = createProgram([() => { program.reserveData(5, 7); return {}; }], { setTimeout() {} });
  program.reserveWork(5, 3);
  const TypedArray = global.Uint8Array;
  try {
    global.Uint8Array = function(size) {
      if (size === 7) throw new RangeError('simulated allocation failure');
      return new TypedArray(size);
    };
    assert.throws(() => program.tick(10), /simulated allocation failure/);
    assert.strictEqual(program.banks.has(5), false);
    assert.strictEqual(program.state.halted, true);
  } finally {
    global.Uint8Array = TypedArray;
  }
});

test('bank lifecycle: erasing or reserving over Object bank restores both Bob screen buffers', () => {
  for (const command of [[t('Erase'), n(1)], [t('Erase All')], reserve('Work', 1, 3)]) {
    const source = withBanks([[t('Cls Colour'), n(3)], [t('Hot Spot'), n(1), t(','), n(0), t(','), n(0)],
      [t('Double Buffer')], [t('Bob Update Off')],
      [t('Bob'), n(0), t(','), n(10), t(','), n(10), t(','), n(1)], [t('Bob Update')], [t('Wait Key')], command, [t('Bob Update')]]);
    const { program, timers } = execute(source);
    const physical = () => program.display.screen().physicalPixels[10 * program.display.screen().width + 10];
    assert.strictEqual(physical(), 1);
    program.sendKey('x'); timers.runAll();
    assert.strictEqual(physical(), 3);
    assert.strictEqual(program.display.point(10, 10), 3);
    assert.strictEqual(program.bobs.size, 1);
    assert.strictEqual(program.state.halted, true);
    assert.strictEqual(timers.pending(), 0);
  }
});

test('bank lifecycle: Length is integer-valued and command numbers use numeric conversion', () => {
  const val = value => [t('Val'), t('('), text(value), t(')')];
  const lines = [[t('Reserve As Data'), val('5.9'), t(','), val('7.9')],
    [t('Print'), length(5), t('/'), n(2), t(','), t('Length'), t('('), val('5.9'), t(')')],
    [t('Erase'), val('5.9')], printLengths(5), reserve('Work', 65535, 1), printLengths(65535)];
  assert.deepStrictEqual(execute(binary(lines)).logs, [[3, 7], [0], [1]]);
});

test('bank lifecycle: original opcode offsets, invalid bounds and wrong types have diagnostics', () => {
  const source = binary([[w(0x20f2), n(5), t(','), n(3)], [w(0x2128), n(6), t(','), n(4)],
    [w(0x26c8)], [t('Print'), w(0x14c), t('('), n(5), t(')'), t(','), length(6)],
    [w(0x215e), n(6)], [w(0x26d8)], printLengths(6)]);
  assert.deepStrictEqual(execute(source).logs, [[0, 4], [0]]);
  for (const [number, size, message] of [[0, 3, 'bank number'], [-1, 3, 'bank number'], [65536, 3, 'bank number'], [5, 0, 'bank length'], [5, -1, 'bank length']]) {
    assert.throws(() => execute(binary([reserve('Data', number, size)])), new RegExp(`Invalid ${message} at line 1, byte`));
  }
  assert.throws(() => new Transpiler(binary([[t('Erase'), text('1')]])), /Expected numeric expression.*line 1/);
  assert.throws(() => new Transpiler(binary([[t('Print'), t('Length'), t('('), text('1'), t(')')]])), /Wrong argument type.*line 1/);
  assert.throws(() => new Transpiler(binary([[t('Erase All'), n(1)]])), /Expected end of statement.*line 1/);
});
