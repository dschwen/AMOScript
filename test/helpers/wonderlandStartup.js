/* jshint esversion: 6 */
'use strict';

// Exact leading physical lines of the pinned original source (default: the
// nine-line speed test). This is a startup fixture, never a playable game substitute.
module.exports = function wonderlandStartup(lines = 9, includeBanks = false) {
  const fs = require('fs'), path = require('path'), BufferReader = require('../../lib/Buffer');
  const source = fs.readFileSync(path.join(__dirname, '../../examples/Wonderland/Wonderland.AMOS'));
  const buffer = new BufferReader(source), prefix = Buffer.from(source.subarray(0, buffer.lines[lines]));
  prefix.writeUInt32BE(prefix.length - 20, 16);
  return includeBanks ? Buffer.concat([prefix, source.subarray(20 + buffer.code_bytes)]) : prefix;
};
