/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Transpiler = require('../lib/Transpiler');
const { createMemoryFiles } = require('../lib/amos/files');
const { binary, token: t, word: w, integer: n, text, execute } = require('./helpers/program');
const golden = Buffer.from(fs.readFileSync(path.join(__dirname, 'fixtures/image-banks.hex'), 'utf8').replace(/\s/g, ''), 'hex');
const generic = '416d426b000500018000000b44617461202020200080ff';
const files = () => createMemoryFiles({ data: Buffer.from(generic, 'hex').toString('latin1') });
const reserve = (number, length) => [t('Reserve As Work'), n(number), t(','), n(length)];
const swap = (a, b) => [t('Bank Swap'), n(a), t(','), n(b)];
const shrink = (bank, size) => [t('Bank Shrink'), n(bank), t('To'), n(size)];
const length = bank => [t('Length'), t('('), n(bank), t(')')];
const withBanks = lines => Buffer.concat([binary(lines), golden.subarray(20)]);

test('bank manipulation: Swap preserves bank/data identity, metadata and mutable bytes', () => {
  const lines = [[t('Load'), text('data')], reserve(6, 7), [t('Wait Key')], swap(5, 6)];
  const { program, timers } = execute(binary(lines), 100, { files: files() });
  const data = program.banks.get(5), work = program.banks.get(6);
  work.data[0] = 42;
  const bytes = data.data;
  program.sendKey('x'); timers.runAll();
  assert.strictEqual(program.banks.get(6), data);
  assert.strictEqual(program.banks.get(5), work);
  assert.strictEqual(data.number, 6);
  assert.strictEqual(work.number, 5);
  assert.strictEqual(data.data, bytes);
  assert.deepStrictEqual(Array.from(data.data), [0, 128, 255]);
  assert.strictEqual(work.data[0], 42);
  program.eraseTemp();
  assert.deepStrictEqual([...program.banks.keys()], [6]);
});

test('bank manipulation: Swap moves into an empty number and existing self-swap is unchanged', () => {
  const lines = [reserve(5, 7), swap(5, 9), swap(9, 9),
    [t('Print'), length(5), t(','), length(9)], swap(7, 9),
    [t('Print'), length(7), t(','), length(9)]];
  const { logs, program } = execute(binary(lines));
  assert.deepStrictEqual(logs, [[0, 7], [7, 0]]);
  assert.strictEqual(program.banks.get(7).number, 7);
  assert.throws(() => execute(binary([swap(5, 6)])), /Cannot swap two missing banks at line 1/);
});

test('bank manipulation: Shrink retains prefix bytes and bank flags, including an unchanged-size request', () => {
  const lines = [[t('Load'), text('data')], swap(5, 9), shrink(9, 2), shrink(9, 2),
    [t('Print'), length(9), t('/'), n(2)]];
  const { program, logs } = execute(binary(lines), 100, { files: files() });
  const bank = program.banks.get(9);
  assert.deepStrictEqual(Array.from(bank.data), [0, 128]);
  assert.strictEqual(bank.memory, 'fast');
  assert.strictEqual(bank.permanent, true);
  assert.strictEqual(bank.name, 'Data    ');
  assert.deepStrictEqual(logs, [[1]]);
  const val = value => [t('Val'), t('('), text(value), t(')')];
  const converted = [reserve(5, 7), [t('Bank Swap'), val('5.9'), t(','), val('6.9')],
    [t('Bank Shrink'), val('6.9'), t('To'), val('3.9')], [t('Print'), length(6)]];
  assert.deepStrictEqual(execute(binary(converted)).logs, [[3]]);
});

test('bank manipulation: swapping Object bank out and back restores both buffers and retargets existing Bobs', () => {
  const lines = [[t('Cls Colour'), n(3)], [t('Hot Spot'), n(1), t(','), n(0), t(','), n(0)],
    [t('Double Buffer')], [t('Bob Update Off')],
    [t('Bob'), n(0), t(','), n(10), t(','), n(10), t(','), n(1)], [t('Bob Update')], [t('Wait Key')],
    swap(1, 10), [t('Bob Update')], [t('Wait Key')], swap(1, 10), [t('Bob Update')]];
  const { program, timers } = execute(withBanks(lines));
  const bank = program.banks.get(1), image = bank.images[0];
  const physical = () => program.display.screen().physicalPixels[10 * program.display.screen().width + 10];
  assert.strictEqual(physical(), 1);
  program.sendKey('x'); timers.runAll();
  assert.strictEqual(physical(), 3);
  assert.strictEqual(program.display.point(10, 10), 3);
  assert.strictEqual(program.banks.get(10), bank);
  assert.strictEqual(program.banks.get(10).type, 'sprites');
  assert.strictEqual(program.bankLength(10), 2);
  program.sendKey('x'); timers.runAll();
  assert.strictEqual(physical(), 1);
  assert.strictEqual(program.banks.get(1).images[0], image);
  assert.strictEqual(program.bobs.size, 1);
  assert.strictEqual(program.state.halted, true);
});

test('bank manipulation: original tokens, argument errors and shrink validation retain source context', () => {
  const lines = [reserve(5, 7), [w(0x2498), n(5), t(','), n(6)],
    [w(0x2a9c), n(6), t('To'), n(3)], [t('Print'), length(6)]];
  assert.deepStrictEqual(execute(binary(lines)).logs, [[3]]);
  for (const command of [swap(0, 5), swap(5, -1), swap(5, 65536)]) {
    assert.throws(() => execute(binary([reserve(5, 7), command])), /Invalid bank number at line 2/);
  }
  for (const size of [0, -1, 8]) {
    assert.throws(() => execute(binary([reserve(5, 7), shrink(5, size)])), /Invalid bank length at line 2/);
  }
  assert.throws(() => execute(binary([shrink(99, 0)])), /Invalid bank length/);
  assert.throws(() => execute(binary([shrink(99, 1)])), /Bank not reserved/);
  assert.throws(() => execute(withBanks([shrink(1, 1)])), /Cannot shrink an image bank/);
  assert.throws(() => new Transpiler(binary([[t('Bank Swap'), text('5'), t(','), n(6)]])), /Expected numeric expression/);
  assert.throws(() => new Transpiler(binary([[t('Bank Shrink'), n(5), t(','), n(1)]])), /Expected To/);
});
