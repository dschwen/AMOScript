/* jshint esversion: 6 */
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const BufferReader = require('../lib/Buffer');
const BankReader = require('../lib/BankReader');
const Transpiler = require('../lib/Transpiler');
const { token_by_name: names } = require('../lib/TokenTable');
const catalog = require('./reference/amos-pro-tokens.json');
const extensions = require('../lib/ExtensionTable');
const known = new Map(Object.entries(names).map(([name, code]) => [code, name]));

function auditProgram(data) {
  const buffer = new BufferReader(data), definitions = new Map(), strings = new Set();
  const special = new Set([6, 12, 18, 24, 30, 38, 46, 54, 62, 70]);
  let occurrences = 0;
  for (let line = 0; line < buffer.lines.length; line++) {
    const start = buffer.lines[line], end = start + data[start] * 2;
    let position = start + 2, terminated = false;
    const requireBytes = length => {
      if (!Number.isInteger(length) || length < 0 || position + length > end) throw new Error(`Audit: truncated payload on line ${line + 1}, byte ${position}`);
    };
    const word = at => data[at] * 256 + data[at + 1];
    while (position < end) {
      const offset = position; requireBytes(2);
      const code = word(position); position += 2;
      if (code === 0) { if (position !== end) throw new Error(`Audit: data after terminator on line ${line + 1}`); terminated = true; break; }
      let key = code.toString(16).padStart(4, '0'), entry = catalog.main[key], length = 0;
      if ([6, 12, 18, 24].includes(code)) { requireBytes(4); length = 4 + data[position + 2] + data[position + 2] % 2; }
      else if ([38, 46, 0x64a, 0x652].includes(code)) {
        requireBytes(2); const size = word(position); length = 2 + size + size % 2;
        requireBytes(length);
        if (code === 38 || code === 46) strings.add(String.fromCharCode(...data.subarray(position + 2, position + 2 + size)));
      } else if ([30, 54, 62, 70].includes(code)) length = 4;
      else if (code === 0x4e) {
        requireBytes(4); const slot = data[position], token = word(position + 2).toString(16).padStart(4, '0');
        entry = catalog.extensions[slot] && catalog.extensions[slot][token]; key += `:${slot}:${token}`; length = 4;
        if (!entry) throw new Error(`Audit: unknown extension encoding ${key} on line ${line + 1}`);
      } else if ([0x23c, 0x250, 0x268, 0x27e, 0x2be, 0x2d0, 0x25a4, 0x404].includes(code)) length = 2;
      else if ([0x290, 0x29e, 0x316].includes(code)) length = 4;
      else if (code === 0x376) {
        length = 8; requireBytes(length);
        if (data[position + 6] & 0x30) throw new Error(`Audit: encrypted/compiled procedure on line ${line + 1}`);
      } else if (code === 0x2b6a) length = 8;
      else if (code >= 0x2a40 && code <= 0x2a64) length = 6;
      if (!entry && !special.has(code) && !known.has(code)) throw new Error(`Audit: unknown encoding ${key} on line ${line + 1}`);
      requireBytes(length); position += length; occurrences++;
      let definition = definitions.get(key);
      if (!definition) {
        definition = { code: key, name: entry ? entry.name : known.get(code) || 'literal/identifier',
          signature: entry ? entry.signature : null,
          decoderRecognized: code === 0x4e ? !!(extensions[data[offset + 2]] && extensions[data[offset + 2]][word(offset + 4)]) : special.has(code) || known.has(code),
          count: 0, locations: [] };
        definitions.set(key, definition);
      }
      definition.count++; definition.locations.push({ line: line + 1, offset });
    }
    if (!terminated) throw new Error(`Audit: missing terminator on line ${line + 1}`);
  }
  const banks = new BankReader(buffer).read().map(bank => ({ number: bank.number, type: bank.type,
    ...(bank.name ? { name: bank.name, bytes: bank.data.length } : { images: bank.images.length,
      depths: [...new Set(bank.images.filter(Boolean).map(image => image.depth))] }) }));
  let compiler;
  try {
    const result = new Transpiler(data);
    compiler = { ok: true, instructions: result._ops.length, moduleBytes: Buffer.byteLength(result.toModule()) };
  } catch (error) { compiler = { ok: false, error: error.message }; }
  const tokens = [...definitions.values()], missing = tokens.filter(token => !token.decoderRecognized);
  return { version: 1, sha256: crypto.createHash('sha256').update(data).digest('hex'), bytes: data.length,
    header: buffer.magic, codeBytes: buffer.code_bytes, physicalLines: buffer.lines.length,
    tokenOccurrences: occurrences, distinctEncodings: tokens.length, unrecognizedEncodings: missing.length,
    compiler, banks, strings: [...strings], missing, tokens,
    evidence: 'Static bounded token/asset inventory. Decoder recognition does not imply parser/runtime support or reference execution.' };
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node tools/audit_program.js <file.AMOS>');
    process.stdout.write(JSON.stringify(auditProgram(fs.readFileSync(process.argv[2])), null, 2) + '\n');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { auditProgram };
