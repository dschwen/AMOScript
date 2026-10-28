'use strict';
// Original Load/Unpack physical lines, then a declared Wait Key preview guard.
// All other game statements are omitted; embedded banks remain unchanged.
module.exports = function planetZybexLevel(level) {
  const fs = require('fs'), path = require('path'), BufferReader = require('../../lib/Buffer');
  const { binary, token } = require('./tokens');
  const ranges = [[245,247],[368,369],[437,439],[562,563],[619,621],[692,693],[829,831]];
  if (!Number.isInteger(level) || level < 1 || level > ranges.length) throw Error('Invalid Planet Zybex level');
  const raw = fs.readFileSync(path.join(__dirname, '../../examples/PlanetZybex/Zybex.AMOS')), reader = new BufferReader(raw);
  const [first, last] = ranges[level - 1];
  const original = raw.subarray(reader.lines[first - 1], reader.lines[last - 1] + raw[reader.lines[last - 1]] * 2);
  const code = Buffer.concat([original, binary([[token('Wait Key')]]).subarray(20)]);
  const header = Buffer.from(raw.subarray(0, 20)); header.writeUInt32BE(code.length, 16);
  return Buffer.concat([header, code, raw.subarray(20 + reader.code_bytes)]);
};
