/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { auditProgram } = require('../tools/audit_program');
const { libraryTable } = require('../tools/import_token_catalog');
const readIlbm = require('../lib/display/model/ilbm');
const reference = require('../lib/display/reference/render');
const { decodePng } = require('./helpers/displayPng');
const directory = path.join(__dirname, '../examples/Wonderland');
const read = name => fs.readFileSync(path.join(directory, name));

test('Wonderland: pinned original program/assets retain their upstream bytes', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.strictEqual(Object.keys(manifest.files).length, 8);
  for (const [name, entry] of Object.entries(manifest.files)) {
    const bytes = read(name);
    assert.strictEqual(bytes.length, entry.byteLength);
    assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256);
  }
});

test('Wonderland: bounded full-source inventory includes extension calls and embedded banks', () => {
  const report = auditProgram(read('Wonderland.AMOS'));
  assert.deepStrictEqual([report.physicalLines, report.tokenOccurrences, report.distinctEncodings], [753, 6011, 142]);
  // Complete lexical/compiler coverage is distinct from gameplay compatibility.
  assert.strictEqual(report.unrecognizedEncodings,0);assert.strictEqual(report.compiler.ok,true);
  const sample = report.tokens.find(token => token.code === '004e:1:00ee');
  assert.strictEqual(sample.name, 'sam play'); assert.strictEqual(sample.count, 2);
  assert.deepStrictEqual(sample.locations.map(location => location.line), [170, 703]);
  assert.deepStrictEqual(report.banks, [
    { number: 1, type: 'sprites', images: 75, depths: [4] },
    { number: 4, type: 'data', name: 'Datas   ', bytes: 7206 }
  ]);
  assert.match(report.evidence, /does not imply/);
  const sampleBank = require('../lib/BankReader').readFile(read('Wonderland_Samples.Abk')).banks[0];
  assert.deepStrictEqual([sampleBank.number, sampleBank.name, sampleBank.data.length], [5, 'Samples ', 20794]);
  const supported = auditProgram(fs.readFileSync(path.join(directory, '../Test21.AMOS')));
  assert.strictEqual(supported.compiler.ok, true); assert.strictEqual(supported.compiler.instructions, 11);
});

test('Wonderland: diagnostic scanner rejects unknown and truncated encodings without resynchronizing', () => {
  const original = read('Wonderland.AMOS');
  const unknown = Buffer.from(original); unknown.writeUInt16BE(0xffff, 52);
  assert.throws(() => auditProgram(unknown), /unknown encoding ffff on line 2/);
  const truncated = Buffer.from(original); truncated.writeUInt16BE(0x26, 52); truncated.writeUInt16BE(65535, 54);
  assert.throws(() => auditProgram(truncated), /truncated payload on line 2/);
  const extension = Buffer.from(original), report = auditProgram(original);
  const call = report.tokens.find(token => token.code === '004e:1:00ee').locations[0];
  extension.writeUInt16BE(0xffff, call.offset + 4);
  assert.throws(() => auditProgram(extension), /unknown extension encoding/);
});

test('Wonderland: reference library importer decodes independent bytes and rejects truncation', () => {
  // Base=54, entry=base+6: two handler words, high-bit name terminator,
  // ASCII signature and high-bit terminator; then a zero table terminator.
  const fixture = Buffer.alloc(80); fixture.write('AP20', 50);
  Buffer.from('00010002464feF49308000000000', 'hex').copy(fixture, 60);
  assert.deepStrictEqual(libraryTable(fixture), { '0006': { name: 'FOo', signature: 'I0' } });
  assert.throws(() => libraryTable(fixture.subarray(0, 67)), /Invalid AMOS/);
  assert.throws(() => libraryTable(Buffer.alloc(80)), /Invalid AMOS/);
});

test('Wonderland: all four original IFFs match independently decoded PNGs pixel for pixel', () => {
  const goldens = path.join(__dirname, 'fixtures/wonderland');
  const manifest = JSON.parse(fs.readFileSync(path.join(goldens, 'manifest.json')));
  for (const descriptor of manifest.images) {
    const bytes = fs.readFileSync(path.join(goldens, descriptor.file));
    assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), descriptor.sha256);
    const expected = decodePng(bytes), decoded = readIlbm(read(descriptor.source));
    assert.strictEqual(decoded.snapshot.frame.outputWidth, expected.width);
    assert.strictEqual(decoded.snapshot.frame.lines, expected.height);
    assert.deepStrictEqual(reference.render(decoded.snapshot.chip, decoded.snapshot.frame), expected.rgba);
  }
});
