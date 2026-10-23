/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Transpiler = require('../lib/Transpiler');
const BankReader = require('../lib/BankReader');
const BankWriter = require('../lib/BankWriter');
const { createMemoryFiles, createNodeFiles } = require('../lib/amos/files');
const { binary, token: t, integer: n, text, execute, compile } = require('./helpers/program');
const golden = Buffer.from(fs.readFileSync(path.join(__dirname, 'fixtures/image-banks.hex'), 'utf8').replace(/\s/g, ''), 'hex');
const withBanks = lines => Buffer.concat([binary(lines), golden.subarray(20)]);
const save = (name, number) => [t(number == null ? 'Save' : 'Save Bank'), text(name), ...(number == null ? [] : [t(','), n(number)])];
const reserve = (kind, number, size) => [t(`Reserve As ${kind}`), n(number), t(','), n(size)];
const hex = (files, name) => Buffer.from(files.read(name), 'latin1').toString('hex');
const decode = (files, name) => BankReader.readFile(Buffer.from(files.read(name), 'latin1'));
const fn = (name, value) => [t(name), t('('), n(value), t(')')];

test('bank saving: generic bytes and grouped work/data selection match independent wire bytes', () => {
  const files = createMemoryFiles();
  execute(binary([reserve('Work', 5, 3), reserve('Chip Data', 6, 2), save('all'), save('work', 5), save('data', 6)]), 100, { files });
  const work = '416d426b000500010000000b576f726b20202020000000';
  const data = '416d426b000600008000000a44617461202020200000';
  assert.strictEqual(hex(files, 'work'), work);
  assert.strictEqual(hex(files, 'data'), data);
  assert.strictEqual(hex(files, 'all'), '416d42730002' + data + work);
  const empty = createMemoryFiles();
  execute(binary([save('empty')]), 100, { files: empty });
  assert.strictEqual(hex(empty, 'empty'), '416d42730000');
});

test('bank saving: grouped order follows bank creation, replacement, swapping and reload', () => {
  const files = createMemoryFiles();
  const lines = [reserve('Work', 5, 3), reserve('Data', 6, 2), [t('Bank Swap'), n(5), t(','), n(6)], save('swapped'),
    reserve('Work', 6, 4), save('replaced'), [t('Load'), text('replaced')], save('reloaded')];
  execute(binary(lines), 100, { files });
  assert.deepStrictEqual(decode(files, 'swapped').banks.map(bank => bank.number), [5, 6]);
  assert.deepStrictEqual(decode(files, 'replaced').banks.map(bank => bank.number), [6, 5]);
  assert.deepStrictEqual(decode(files, 'reloaded').banks.map(bank => bank.number), [5, 6]);
  assert.deepStrictEqual(decode(files, 'reloaded').banks.map(bank => bank.permanent), [true, false]);
});

test('bank saving: planar image files preserve slots/palette and canonicalize loaded hotspot flags', () => {
  const files = createMemoryFiles();
  execute(withBanks([save('objects', 1), save('icons', 2)]), 100, { files });
  const sprites = Buffer.from(golden.subarray(26, 124)), icons = Buffer.from(golden.subarray(124));
  sprites.writeUInt16BE(1, 12); icons.writeUInt16BE(1, 12);
  assert.strictEqual(hex(files, 'objects'), sprites.toString('hex'));
  assert.strictEqual(hex(files, 'icons'), icons.toString('hex'));
  execute(withBanks([[t('Bank Swap'), n(1), t(','), n(10)], save('moved', 10),
    [t('Erase All')], [t('Load'), text('moved')]]), 100, { files });
  assert.strictEqual(hex(files, 'moved'), sprites.toString('hex'));
  assert.strictEqual(decode(files, 'moved').banks[0].number, 1);
  const negative = Buffer.from(golden); negative.writeUInt16BE(0x3fff, 38);
  execute(Buffer.concat([binary([save('negative', 1)]), negative.subarray(20)]), 100, { files });
  assert.strictEqual(Buffer.from(files.read('negative'), 'latin1').readUInt16BE(12), 0xffff);
  assert.strictEqual(decode(files, 'negative').banks[0].images[0].hotspotX, -1);
});

test('bank saving: live flipped pixels, masks and hotspots normalize before writing and reload', () => {
  const files = createMemoryFiles();
  const lines = [[t('Paste Bob'), n(10), t(','), n(10), t(','), fn('Rev', 1)], [t('Wait Key')],
    save('objects', 1), [t('Wait Key')], [t('No Mask Image'), n(1)], save('no-mask', 1),
    [t('Erase'), n(1)], [t('Load'), text('no-mask')]];
  const { program, timers } = execute(withBanks(lines), 100, { files });
  const image = program.banks.get(1).images[0];
  assert.strictEqual(image.orientation, 0xc000);
  program.sendKey('x'); timers.runAll();
  assert.strictEqual(image.orientation, 0);
  assert.strictEqual(image.hotspotX, 1);
  assert.strictEqual(image.hotspotY, -1);
  assert.deepStrictEqual(Array.from(image.pixels).slice(0, 4), [1, 2, 3, 0]);
  assert.deepStrictEqual(Array.from(image.mask).slice(0, 4), [1, 1, 1, 0]);
  program.sendKey('x'); timers.runAll();
  assert.strictEqual(program.banks.get(1).images[0].masked, true);
  assert.strictEqual(hex(files, 'objects'), hex(files, 'no-mask'));
  assert.strictEqual(program.state.halted, true);
});

test('bank saving: missing banks truncate first, write failures and wrong types retain context', () => {
  const files = createMemoryFiles({ missing: 'old bytes' });
  assert.throws(() => execute(binary([save('missing', 99)]), 100, { files }), /Bank not reserved at line 1/);
  assert.strictEqual(files.read('missing'), '');
  for (const host of [undefined, {}, { write: () => Promise.resolve() }]) {
    assert.throws(() => execute(binary([save('all')]), 100, { files: host }), /(?:host adapter|write bank bytes synchronously).*line 1/);
  }
  const source = withBanks([[t('Paste Bob'), n(10), t(','), n(10), t(','), fn('Hrev', 1)], save('objects', 1)]);
  const program = compile(source).create({ setTimeout() {}, files: { write() { throw new Error('disk failure'); } } });
  assert.throws(() => program.tick(100), /disk failure at line 2/);
  assert.strictEqual(program.banks.get(1).images[0].orientation, 0x8000);
  assert.throws(() => new Transpiler(binary([[t('Save'), n(1)]])), /requires a string/);
  assert.throws(() => new Transpiler(binary([[t('Save Bank'), text('x'), t(','), text('1')]])), /Expected numeric expression/);
});

test('bank saving: encoder rejects unsupported image count/size and invalid planar data', () => {
  const bank = BankReader.readFile(golden.subarray(26, 124)).banks[0];
  assert.throws(() => BankWriter.write([{ ...bank, images: Array(32769).fill(null) }]), /Unsupported image save count/);
  const large = { width: 16, height: 32768, depth: 1, hotspotX: 0, hotspotY: 0, pixels: new Uint8Array(16 * 32768) };
  assert.throws(() => BankWriter.write([{ ...bank, images: [large] }]), /Unsupported image save size/);
  const invalid = { ...bank.images[0], pixels: Array(32).fill(4) };
  assert.throws(() => BankWriter.write([{ ...bank, images: [invalid] }]), /Invalid saved image pixel/);
});

test('bank saving: standalone output writes and reloads real ABK files with the Node adapter', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'amoscript-save-'));
  try {
    const files = createNodeFiles(directory);
    const lines = [reserve('Chip Data', 7, 4), save('data.abk', 7), [t('Erase All')], [t('Load'), text('data.abk')],
      [t('Print'), t('Length'), t('('), n(7), t(')')]];
    assert.deepStrictEqual(execute(binary(lines), 100, { files }).logs, [[4]]);
    assert.strictEqual(fs.readFileSync(path.join(directory, 'data.abk')).toString('hex'),
      '416d426b000700008000000c446174612020202000000000');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
