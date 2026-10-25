/* jshint esversion: 6 */
'use strict';

// Original line 15 / leading Track Load (see roller2Loads), then the original
// Led Off (bytes 56..62) and Track Play 22 (394..406) statements. TRUE and Track
// Loop On are outside these explicit boundaries. A synthetic Wait Key keeps
// the VM alive for music; it does not run the complete startup or game.
module.exports = function roller2Music() {
  const fs = require('fs'), path = require('path'), BufferReader = require('../../lib/Buffer');
  const { binary, token } = require('./tokens');
  const original = fs.readFileSync(path.join(__dirname, '../../examples/Roller2/Roller II.AMOS'));
  const loaded = require('./roller2Loads')(), reader = new BufferReader(loaded);
  const header = Buffer.from(loaded.subarray(0, 20));
  const play = Buffer.concat([Buffer.from([12, 0]), original.subarray(56, 62), Buffer.from([0, 0x54]), original.subarray(394, 406), Buffer.from([0, 0])]);
  const wait = binary([[token('Wait Key')]]).subarray(20);
  const code = Buffer.concat([loaded.subarray(20, 20 + reader.code_bytes - 6), play, wait]);
  header.writeUInt32BE(code.length, 16);
  return Buffer.concat([header, code, loaded.subarray(20 + reader.code_bytes)]);
};
