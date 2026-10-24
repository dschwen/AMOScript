/* jshint esversion: 6 */
'use strict';

// Exact original lines 1–71 and 732–753, with one explicit End between the
// menu loop and its subroutines. Selection stops before unsupported gameplay or
// editor dispatch. Selected original line bytes and banks are copied unchanged;
// the code-length header is recomputed for these ranges and the End guard.
module.exports = function wonderlandMenu() {
  const fs = require('fs'), path = require('path'), BufferReader = require('../../lib/Buffer');
  const source = fs.readFileSync(path.join(__dirname, '../../examples/Wonderland/Wonderland.AMOS'));
  const buffer = new BufferReader(source), codeEnd = 20 + buffer.code_bytes;
  const header = Buffer.from(source.subarray(0, 20));
  const code = Buffer.concat([source.subarray(20, buffer.lines[71]), Buffer.from('030003b60000', 'hex'), source.subarray(buffer.lines[731], codeEnd)]);
  header.writeUInt32BE(code.length, 16);
  return Buffer.concat([header, code, source.subarray(codeEnd)]);
};
