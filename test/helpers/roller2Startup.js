/* jshint esversion: 6 */
'use strict';

// Unmodified first 17 physical lines, through Hide. The first FLOAD call on
// line 18 and the rest of the game are excluded. A synthetic Wait Key guard
// keeps the original music alive without claiming title/game execution.
module.exports = function roller2Startup() {
  const fs = require('fs'), path = require('path'), BufferReader = require('../../lib/Buffer');
  const { binary, token } = require('./tokens');
  const raw = fs.readFileSync(path.join(__dirname, '../../examples/Roller2/Roller II.AMOS'));
  const reader = new BufferReader(raw), last = reader.lines[16], end = last + raw[last] * 2;
  const header = Buffer.from(raw.subarray(0, 20));
  const code = Buffer.concat([raw.subarray(20, end), binary([[token('Wait Key')]]).subarray(20)]);
  header.writeUInt32BE(code.length, 16);
  return Buffer.concat([header, code, raw.subarray(20 + reader.code_bytes)]);
};
