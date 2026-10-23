/* jshint esversion: 6 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { deserializeSnapshot } = require('../../lib/display/model/frameState');
const { encodePng, decodePng, isByteArray } = require('./displayPng');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function readBlob(directory, descriptor, maximum) {
  if (!descriptor || typeof descriptor.file !== 'string' ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(descriptor.file) ||
      !Number.isSafeInteger(descriptor.byteLength) || descriptor.byteLength < 0 || descriptor.byteLength > maximum ||
      !/^[a-f0-9]{64}$/.test(descriptor.sha256)) throw new Error('Invalid display fixture blob descriptor');
  const file = path.join(directory, descriptor.file);
  if (fs.statSync(file).size !== descriptor.byteLength) throw new Error(`Display fixture length mismatch: ${descriptor.file}`);
  const bytes = fs.readFileSync(file);
  if (sha256(bytes) !== descriptor.sha256) throw new Error(`Display fixture hash mismatch: ${descriptor.file}`);
  return bytes;
}
function loadFixture(filename) {
  if (fs.statSync(filename).size > 65536) throw new Error('Display fixture manifest too large');
  const manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (manifest.fixtureVersion !== 1 || typeof manifest.name !== 'string' ||
      !manifest.evidence || !['synthetic', 'source-analysis', 'reference-capture'].includes(manifest.evidence.kind) ||
      typeof manifest.evidence.description !== 'string' || !manifest.evidence.description.trim()) {
    throw new Error('Invalid display fixture version/provenance');
  }
  if (manifest.evidence.kind === 'reference-capture' &&
      (typeof manifest.evidence.environment !== 'string' || !manifest.evidence.environment.trim() ||
       typeof manifest.evidence.captureProcedure !== 'string' || !manifest.evidence.captureProcedure.trim())) {
    throw new Error('Reference display fixture needs environment and capture procedure');
  }
  const directory = path.dirname(filename);
  if (!manifest.blobs || !manifest.snapshot) throw new Error('Missing display fixture blobs/snapshot');
  const snapshot = deserializeSnapshot(manifest.snapshot,
    readBlob(directory, manifest.blobs.chip, 2097152), readBlob(directory, manifest.blobs.tables, 16 * 1024 * 1024));
  const golden = decodePng(readBlob(directory, manifest.blobs.golden, 72 * 1024 * 1024));
  // A renderer returns one current field. Woven histories have their own fixture
  // and composer gate rather than an implicit stateful renderer in this harness.
  if (golden.width !== snapshot.frame.outputWidth || golden.height !== snapshot.frame.lines) {
    throw new Error('Display golden dimensions differ from current field');
  }
  return { manifest, snapshot, golden };
}
function comparePixels(width, height, actual, expected, limit = 16) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 4096 || height > 4096 ||
      !Number.isInteger(limit) || limit < 0 || limit > 1000) throw new Error('Invalid display comparison dimensions/limit');
  for (const bytes of [actual, expected]) {
    if (!isByteArray(bytes) || bytes.length !== width * height * 4) {
      throw new Error('Display comparison requires exact RGBA byte lengths');
    }
  }
  const diff = new Uint8ClampedArray(actual.length), first = [];
  let mismatchPixels = 0, mismatchBytes = 0;
  for (let i = 0; i < actual.length; i += 4) {
    let different = false;
    for (let channel = 0; channel < 4; channel++) if (actual[i + channel] !== expected[i + channel]) {
      different = true; mismatchBytes++;
    }
    if (different) {
      mismatchPixels++;
      diff.set([255, 0, 255, 255], i);
      if (first.length < limit) first.push({ x: (i / 4) % width, y: Math.floor(i / 4 / width),
        expected: Array.from(expected.subarray(i, i + 4)), actual: Array.from(actual.subarray(i, i + 4)) });
    } else diff.set([0, 0, 0, 255], i);
  }
  return { pass: mismatchPixels === 0, mismatchPixels, mismatchBytes, first, diff };
}
async function runFixture(filename, renderer, options = {}) {
  if (typeof options.backend !== 'string' || !options.backend.trim()) throw new Error('Display comparison requires an explicit backend name');
  const fixture = loadFixture(filename);
  const { chip, frame } = fixture.snapshot;
  const actual = await renderer(chip, frame);
  const comparison = comparePixels(frame.outputWidth, frame.lines, actual, fixture.golden.rgba, options.limit);
  const { diff, ...report } = comparison;
  Object.assign(report, { name: fixture.manifest.name, backend: options.backend, evidence: fixture.manifest.evidence });
  if (options.artifactDirectory) {
    fs.mkdirSync(options.artifactDirectory, { recursive: true });
    fs.writeFileSync(path.join(options.artifactDirectory, 'actual.png'), encodePng(frame.outputWidth, frame.lines, actual));
    fs.writeFileSync(path.join(options.artifactDirectory, 'diff.png'), encodePng(frame.outputWidth, frame.lines, diff));
    fs.writeFileSync(path.join(options.artifactDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}
module.exports = { loadFixture, comparePixels, runFixture };
