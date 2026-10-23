/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMemoryFiles, createNodeFiles } = require('../lib/amos/files');
const { token: t, integer: n, identifier: id, text, binary, compile } = require('./helpers/program');
const open = (mode, channel = 1, name = 'test.txt') => [t(mode), n(channel), t(','), text(name)];
const info = (name, channel = 1) => [t(name), t('('), n(channel), t(')')];

function run(lines, files) {
  const logs = [];
  const program = compile(binary(lines)).create({ setTimeout() {}, files, print: (...args) => logs.push(args) });
  program.tick(1000);
  return { logs, program };
}

test('files: sequential output, append, comma input and EOF round-trip through an explicit memory host', () => {
  const files = createMemoryFiles();
  const { logs } = run([
    open('Open Out'), [t('Print#'), n(1), t(','), text('AMOS,42')], [t('Close'), n(1)],
    open('Append'), [t('Print#'), n(1), t(','), text('last')], [t('Close All')],
    open('Open In'), [t('Input#'), n(1), t(','), id('s', 6, 2), t(','), id('n')],
    [t('Print'), id('s', 6, 2), t(','), id('n'), t(','), info('Eof')],
    [t('Line Input#'), n(1), t(','), id('line', 6, 2)],
    [t('Print'), id('line', 6, 2), t(','), info('Eof'), t(','), info('Lof'), t(','), info('Pof')], [t('Close'), n(1)]
  ], files);
  assert.deepStrictEqual(logs, [['AMOS', 42, 0], ['last', -1, 15, 15]]);
  assert.deepStrictEqual(files.snapshot(), { 'test.txt': 'AMOS,42\r\nlast\r\n' });
});

test('files: Print# preserves tabs, semicolons and trailing separator suppression', () => {
  const files = createMemoryFiles();
  run([open('Open Out'), [t('Print#'), n(1), t(','), text('A'), t(','), text('B'), t(';')], [t('Print#'), n(1), t(','), text('C')], [t('Close All')]], files);
  assert.strictEqual(files.read('test.txt'), 'A\tBC\r\n');
});

test('files: Line Input# preserves commas, CRLF and empty lines', () => {
  const files = createMemoryFiles({ 'test.txt': 'A,B\r\n\r\nC\n' });
  const { logs } = run([open('Open In'), [t('Line Input#'), n(1), t(','), id('a', 6, 2), t(','), id('b', 6, 2), t(','), id('c', 6, 2)], [t('Print'), id('a', 6, 2), t(','), id('b', 6, 2), t(','), id('c', 6, 2)]], files);
  assert.deepStrictEqual(logs, [['A,B', '', 'C']]);
});

test('files: writes are committed on Close and adapters are isolated between instances', () => {
  const files = createMemoryFiles({ 'test.txt': 'old' });
  run([open('Open Out'), [t('Print#'), n(1), t(','), text('new')]], files);
  assert.strictEqual(files.read('test.txt'), 'old');
  run([open('Open Out'), [t('Print#'), n(1), t(','), text('new')], [t('Close'), n(1)]], files);
  assert.strictEqual(files.read('test.txt'), 'new\r\n');
  assert.deepStrictEqual(createMemoryFiles().snapshot(), {});
});

test('files: missing host/files, duplicate channels, access modes and end of file fail explicitly', () => {
  const inputs = [
    [[open('Open Out')], undefined, /host adapter/],
    [[open('Open In')], createMemoryFiles(), /File not found/],
    [[open('Open Out', 0)], createMemoryFiles(), /Invalid file channel/],
    [[open('Open Out'), open('Open Out')], createMemoryFiles(), /already open/],
    [[open('Open Out'), [t('Input#'), n(1), t(','), id('a')]], createMemoryFiles(), /access mode/],
    [[open('Open In'), [t('Input#'), n(1), t(','), id('a')]], createMemoryFiles({ 'test.txt': '' }), /End of file/],
    [[[t('Close'), n(1)]], createMemoryFiles(), /not open/]
  ];
  for (const [lines, files, message] of inputs) assert.throws(() => run(lines, files), message);
});

test('files: Node adapter uses real byte-preserving filesystem reads/writes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'amoscript-files-'));
  try {
    const files = createNodeFiles(directory);
    run([open('Open Out'), [t('Print#'), n(1), t(','), text('AMOS\xff')], [t('Close'), n(1)]], files);
    assert.strictEqual(fs.readFileSync(path.join(directory, 'test.txt'), 'latin1'), 'AMOS\xff\r\n');
    assert.deepStrictEqual(run([open('Open In'), [t('Line Input#'), n(1), t(','), id('a', 6, 2)], [t('Print'), id('a', 6, 2)]], files).logs, [['AMOS\xff']]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
