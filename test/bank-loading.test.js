/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Transpiler = require('../lib/Transpiler');
const BankReader = require('../lib/BankReader');
const { createMemoryFiles, createNodeFiles } = require('../lib/amos/files');
const { binary, token: t, word: w, integer: n, text, execute, compile } = require('./helpers/program');
const golden = Buffer.from(fs.readFileSync(path.join(__dirname, 'fixtures/image-banks.hex'), 'utf8').replace(/\s/g, ''), 'hex');
const sprites = golden.subarray(26, 124), icons = golden.subarray(124);
const generic = Buffer.from('416d426b000700018000000b44617461202020200080ff', 'hex');
const files = () => createMemoryFiles({ sprites: sprites.toString('latin1'), icons: icons.toString('latin1'),
  data: generic.toString('latin1'), group: golden.subarray(20).toString('latin1'), empty: 'AmBs\0\0' });
const load = (name, destination) => [t(destination == null ? 'Load' : 'Load Bank'), text(name), ...(destination == null ? [] : [t(','), n(destination)])];
const run = lines => execute(binary(lines), 1000, { files: files() });

test('bank loading: one bounded decoder accepts standalone images/data and grouped files', () => {
  assert.strictEqual(BankReader.readFile(sprites).banks[0].type, 'sprites');
  assert.strictEqual(BankReader.readFile(icons).banks[0].type, 'icons');
  assert.deepStrictEqual(BankReader.readFile(generic).banks[0].data, [0, 128, 255]);
  assert.strictEqual(BankReader.readFile(golden.subarray(20)).grouped, true);
  for (const file of [sprites, icons, generic]) {
    for (let length = 0; length < file.length; length++) {
      assert.throws(() => BankReader.readFile(file.subarray(0, length)), /Truncated bank data.*at byte/);
    }
    assert.throws(() => BankReader.readFile(Buffer.concat([file, Buffer.from([0])])), /Unexpected data after bank file/);
  }
});

test('bank loading: generic destinations follow the saved number or explicit override', () => {
  const { program } = run([load('data'), load('data', 12), load('data', 0), load('data', -1)]);
  assert.deepStrictEqual([...program.banks.keys()], [7, 12, 0]);
  for (const bank of program.banks.values()) {
    assert.deepStrictEqual(Array.from(bank.data), [0, 128, 255]);
    assert.strictEqual(bank.name, 'Data    ');
    assert.strictEqual(bank.permanent, true);
  }
  assert.throws(() => run([load('data', 65536)]), /Invalid bank number at line 1/);
  const raw = [[w(0x184e), text('data')], [w(0x185a), text('data'), t(','), n(9)]];
  assert.deepStrictEqual([...run(raw).program.banks.keys()], [7, 9]);
});

test('bank loading: image overrides append at bank 1/2 and reload resets new masks/orientation', () => {
  const { program } = run([load('sprites'), [t('No Mask Image'), n(1)], load('sprites', 99), load('icons'), load('icons', 42)]);
  assert.deepStrictEqual([...program.banks.keys()], [1, 2]);
  const objects = program.banks.get(1), pictures = program.banks.get(2);
  assert.strictEqual(objects.images.length, 4);
  assert.strictEqual(objects.images[1], null);
  assert.strictEqual(objects.images[3], null);
  assert.strictEqual(objects.images[0].masked, false);
  assert.strictEqual(objects.images[2].masked, true);
  assert.strictEqual(objects.images[2].orientation, 0);
  assert.strictEqual(pictures.images.length, 2);
  assert.strictEqual(pictures.images[1].masked, false);
  const replacement = run([load('sprites'), load('sprites', 1), load('sprites', 0)]).program;
  assert.strictEqual(replacement.banks.get(1).images.length, 2);
});

test('bank loading: groups replace the bank set, ignore overrides and remain per-instance', () => {
  const source = binary([load('data', 15), load('group', 99)]);
  const { create } = compile(source);
  const a = create({ setTimeout() {}, files: files() }), b = create({ setTimeout() {}, files: files() });
  a.tick(100); b.tick(100);
  assert.deepStrictEqual([...a.banks.keys()], [1, 2]);
  a.banks.get(1).images[0].pixels[0] = 3;
  assert.strictEqual(b.banks.get(1).images[0].pixels[0], 1);
  assert.strictEqual(run([load('data'), load('empty')]).program.banks.size, 0);
});

test('bank loading: removing/reloading images restores buffered Bob backgrounds and retains Bob state', () => {
  const source = binary([load('sprites'), [t('Cls Colour'), n(3)], [t('Double Buffer')], [t('Bob Update Off')],
    [t('Bob'), n(0), t(','), n(10), t(','), n(10), t(','), n(1)], [t('Bob Update')],
    [t('Wait Key')], load('empty'), [t('Bob Update')], [t('Wait Key')], load('sprites'), [t('Bob Update')]]);
  const { program, timers } = execute(source, 1000, { files: files() });
  const physical = () => program.display.screen().physicalPixels[11 * program.display.screen().width + 9];
  assert.strictEqual(physical(), 1);
  program.sendKey('x'); timers.runAll();
  assert.strictEqual(program.display.point(9, 11), 3);
  assert.strictEqual(physical(), 3);
  assert.strictEqual(program.bobs.size, 1);
  assert.strictEqual(program.banks.size, 0);
  program.sendKey('x'); timers.runAll();
  assert.strictEqual(physical(), 1);
  assert.strictEqual(program.state.halted, true);
  assert.strictEqual(timers.pending(), 0);
});

test('bank loading: malformed files and host/type errors halt with locations before bank mutation', () => {
  for (const host of [undefined, {}, { read: () => Promise.resolve('AmBs\0\0') }, { read: () => '\u0100' }, { read: () => 'wrong' }]) {
    assert.throws(() => execute(binary([load('bad')]), 100, { files: host }), /(?:host adapter|byte string synchronously|Unsupported bank type).*line 1/);
  }
  const source = binary([load('data'), load('missing')]);
  const { create } = compile(source), program = create({ setTimeout() {}, files: files() });
  assert.throws(() => program.tick(100), /File not found.*line 2/);
  assert.strictEqual(program.state.halted, true);
  assert.strictEqual(program.banks.has(7), true);
  const bad = files(); bad.write('bad', 'AmSp\0\x01');
  const invalid = compile(binary([load('data'), load('bad')])).create({ setTimeout() {}, files: bad });
  assert.throws(() => invalid.tick(100), /Truncated bank data.*line 2/);
  assert.deepStrictEqual([...invalid.banks.keys()], [7]);
  assert.throws(() => new Transpiler(binary([[t('Load'), n(1)]])), /requires a string.*line 1/);
  assert.throws(() => new Transpiler(binary([[t('Load Bank'), text('data'), t(','), text('1')]])), /Expected numeric expression.*line 1/);
});

test('bank loading: standalone output reads external ABK bytes through the Node file adapter', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'amoscript-banks-'));
  try {
    fs.writeFileSync(path.join(directory, 'objects.abk'), sprites);
    const lines = [[t('Cls Colour'), n(0)], load('objects.abk'), [t('Paste Bob'), n(10), t(','), n(10), t(','), n(1)],
      [t('Print'), t('Point'), t('('), n(10), t(','), n(10), t(')'), t(','),
        t('Point'), t('('), n(11), t(','), n(10), t(')')]];
    assert.deepStrictEqual(execute(binary(lines), 100, { files: createNodeFiles(directory) }).logs, [[1, 2]]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
