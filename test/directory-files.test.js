/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { binary, token: t, integer: n, text, execute } = require('./helpers/program');
const { createMemoryFiles, createNodeFiles } = require('../lib/amos/files');
const idle = files => execute(binary([[t('Wait Key')]]), 100, { files }).program;

test('directory files: raw and structured transfers resolve once, including a host directory change during write', () => {
  const memory = createMemoryFiles({ 'A:raw': '\x01\x02\x03\x04' }, [], ['B:']), writes = [];
  let p; const files = { ...memory, write(name, data) { writes.push(name); memory.write(name, data); if (name === 'A:saved') p.setDirectory('B:'); } };
  p = idle(files); p.setDirectory('A:'); p.reserveWork(5, 4); p.bload('raw', 5);
  const start = p.bankStart(5); p.bsave('saved', start, start + 4);
  assert.deepStrictEqual(writes, ['A:saved', 'A:saved']); assert.strictEqual(memory.read('A:saved'), '\x01\x02\x03\x04');
  assert.strictEqual(p.currentDirectory(), 'B:'); p.saveBanks('bank.abk', 5); p.eraseBank(5); p.loadBanks('bank.abk');
  assert.strictEqual(p.peek(p.bankStart(5)), 1); assert.strictEqual(p.fileExists('bank.abk'), -1); assert.strictEqual(memory.exists('A:bank.abk'), false); p.stop();
});

test('directory files: open channels keep resolved filenames across later Dir$ changes', () => {
  const files = createMemoryFiles({}, [], ['A:', 'B:']);
  execute(binary([[t('Dir$'), t('='), text('A:')], [t('Open Out'), n(1), t(','), text('channel')],
    [t('Print#'), n(1), t(','), text('hello')], [t('Dir$'), t('='), text('B:')], [t('Close'), n(1)]]), 100, { files });
  assert.strictEqual(files.read('A:channel'), 'hello\r\n'); assert.strictEqual(files.exists('B:channel'), false);
});

test('directory files: image and tracker loaders use the same current-directory prefix as byte and bank I/O', () => {
  const directory = path.join(__dirname, '../examples/Roller2');
  const files = createMemoryFiles({
    'RII:music/mod': fs.readFileSync(path.join(directory, 'music/mod.Roller_II_mus'), 'latin1'),
    'RII:iffp/title': fs.readFileSync(path.join(__dirname, '../examples/Wonderland/Title_Screen.Iff'), 'latin1')
  });
  const p = idle(files); p.setDirectory('RII:'); p.trackLoad('music/mod', 22); assert.strictEqual(p.banks.get(22).data.length, 84038);
  p.loadIff('iffp/title', 0); assert.strictEqual(p.display.screen().width, 320); p.stop();
});

test('directory files: metadata methods are synchronous booleans, failed directory changes retain state and exceptions surface', () => {
  const p = idle({ isDirectory: name => name === 'OK:' }); p.setDirectory('OK:');
  assert.throws(() => p.setDirectory('NO:'), /Directory not found/); assert.strictEqual(p.currentDirectory(), 'OK:'); p.stop();
  for (const value of [undefined, 1, -1, 'yes', Promise.resolve(true)]) {
    const p = idle({ isDirectory: () => value, exists: () => value });
    assert.throws(() => p.setDirectory('X:'), /boolean synchronously/); assert.strictEqual(p.currentDirectory(), '');
    assert.throws(() => p.fileExists('x'), /boolean synchronously/); p.stop();
  }
  const missing = idle(); assert.throws(() => missing.setDirectory('X:'), /files.isDirectory adapter/);
  assert.throws(() => missing.fileExists('x'), /files.exists adapter/); assert.strictEqual(missing.fileExists(''), 0); missing.stop();
  for (const operation of [p => p.setDirectory('X:'), p => p.fileExists('x')]) {
    const p = idle({ isDirectory() { throw new Error('host metadata failed'); }, exists() { throw new Error('host metadata failed'); } });
    assert.throws(() => operation(p), /host metadata failed/); p.stop();
  }
  assert.throws(() => execute(binary([[t('Dir$'), t('='), text('X:')]]), 100, { files: { isDirectory: () => false } }), /Directory not found.*line 1, byte 22/);
  for (const name of ['', '/parent', ':root', 'a//b', 'a/../b', 'X:../b', 'a/./b', 'X:Y:z', 'a\0b']) {
    const p = idle({ isDirectory: () => true }); assert.throws(() => p.setDirectory(name), /Unsupported directory path/); p.stop();
  }
});

test('directory files: memory metadata infers parent directories and explicit empty directories, preserving exact case', () => {
  const files = createMemoryFiles({ 'Vol:dir/file': '', 'plain': 'x' }, [], ['Empty:', 'Vol:empty', 'Nested:child']);
  for (const name of ['Vol:', 'Vol:dir/', 'Vol:empty/', 'Empty:', 'Nested:']) assert.strictEqual(files.isDirectory(name), true);
  assert.strictEqual(files.exists('Vol:dir/file'), true); assert.strictEqual(files.exists('Vol:dir'), true);
  assert.strictEqual(files.isDirectory('plain'), false); assert.strictEqual(files.exists('vol:dir/file'), false);
  assert.strictEqual(files.exists('Vol:missing'), false); assert.throws(() => createMemoryFiles({}, [], [1]), /Directories/);
});

test('directory files: Node stat queries and per-program relative directories leave the process working directory alone', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'amos-directory-')), cwd = process.cwd();
  try {
    fs.mkdirSync(path.join(directory, 'sub')); fs.writeFileSync(path.join(directory, 'sub/input'), 'data');
    const files = createNodeFiles(directory), p = idle(files); p.setDirectory('sub');
    assert.strictEqual(p.currentDirectory(), 'sub/'); assert.strictEqual(p.fileExists('input'), -1);
    assert.strictEqual(files.isDirectory('sub/input'), false); assert.strictEqual(files.exists('sub/input/nochild'), false);
    assert.strictEqual(files.isDirectory('missing'), false); assert.strictEqual(p.fileExists('missing'), 0);
    assert.strictEqual(process.cwd(), cwd); p.stop();
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
