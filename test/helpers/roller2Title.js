/* jshint esversion: 6 */
'use strict';

// Unchanged physical lines 1–18, through the first FLOAD call, and the complete
// original FLOAD definition (63–68). A synthetic Wait Key before the definition
// and End after it bound execution before WTIN and the rest of the game.
module.exports = function roller2Title() {
  const fs = require('fs'), path = require('path'), BufferReader = require('../../lib/Buffer');
  const { binary, token } = require('./tokens');
  const raw = fs.readFileSync(path.join(__dirname, '../../examples/Roller2/Roller II.AMOS')), reader = new BufferReader(raw);
  const lines = (first, last) => raw.subarray(reader.lines[first - 1], reader.lines[last - 1] + raw[reader.lines[last - 1]] * 2);
  const code = Buffer.concat([lines(1, 18), binary([[token('Wait Key')]]).subarray(20), lines(63, 68), binary([[token('End')]]).subarray(20)]);
  const header = Buffer.from(raw.subarray(0, 20)); header.writeUInt32BE(code.length, 16);
  return Buffer.concat([header, code, raw.subarray(20 + reader.code_bytes)]);
};
