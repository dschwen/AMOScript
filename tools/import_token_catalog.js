/* jshint esversion: 6 */
'use strict';

// Diagnostic metadata only. Importing this catalogue never enables a compiler
// command. Offsets/names come from assembled AMOS library tables, not guesses.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function libraryTable(bytes) {
  const fail = () => { throw new Error('Invalid AMOS reference library token table'); };
  if (bytes.length < 60 || bytes.toString('ascii', 50, 54) !== 'AP20') fail();
  const base = 54 + bytes.readUInt32BE(32), entries = {};
  let position = base + 6, previous = '';
  while (position + 4 <= bytes.length && bytes.readUInt16BE(position)) {
    let p = position + 4;
    const start = p;
    while (p < bytes.length && bytes[p] < 128) p++;
    if (p >= bytes.length) fail();
    const raw = bytes.subarray(start, ++p);
    let name = Array.from(raw, value => String.fromCharCode(value & 127)).join('');
    if (raw[0] >= 128 && raw[0] <= 159) name = previous;
    else { if (name.startsWith('!')) name = name.slice(1); previous = name; }
    const signatureStart = p;
    while (p < bytes.length && bytes[p] < 128) p++;
    if (p >= bytes.length) fail();
    entries[(position - base).toString(16).padStart(4, '0')] = { name: name.trim(), signature: bytes.toString('latin1', signatureStart, p) };
    p++; position = p + p % 2;
  }
  if (position + 4 > bytes.length) fail();
  return entries;
}

function importCatalog(directory) {
  const libraries = {}, extensions = {};
  function read(filename) {
    const bytes = fs.readFileSync(path.join(directory, filename));
    libraries[filename] = { byteLength: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    return libraryTable(bytes);
  }
  const main = read('AMOSPro.Lib');
  for (const [slot, filename] of [[1, 'AMOSPro_Music.Lib'], [2, 'AMOSPro_Compact.Lib'], [3, 'AMOSPro_Request.Lib'], [6, 'AMOSPro_IOPorts.Lib']]) {
    if (fs.existsSync(path.join(directory, filename))) extensions[slot] = read(filename);
  }
  return { version: 1, description: 'Original assembled token offsets/signatures for diagnostic inventory, not compiler support or reference execution.',
    source: 'https://github.com/AOZ-Studio/AMOS-Professional-Official', libraries, main, extensions };
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node tools/import_token_catalog.js <reference-library-directory>');
    process.stdout.write(JSON.stringify(importCatalog(process.argv[2]), null, 2) + '\n');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { libraryTable, importCatalog };
