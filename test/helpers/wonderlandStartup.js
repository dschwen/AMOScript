/* jshint esversion: 6 */
'use strict';

// Exact first nine physical lines of the pinned original source, ending at the
// startup speed test. This is a startup fixture, never a playable game substitute.
module.exports = function wonderlandStartup() {
  const fs = require('fs'), path = require('path'), BufferReader = require('../../lib/Buffer');
  const source = fs.readFileSync(path.join(__dirname, '../../examples/Wonderland/Wonderland.AMOS'));
  const buffer = new BufferReader(source), prefix = Buffer.from(source.subarray(0, buffer.lines[9]));
  prefix.writeUInt32BE(prefix.length - 20, 16);
  return prefix;
};
