/* jshint esversion: 6 */
'use strict';

// Unchanged intro, array/highscore setup, SASINIT and work/image bank loads.
// A declared harness omits unused procedures and setup 281–286, then falls
// through to main-title load 287 and waits. This is not the title menu/game.
module.exports = function roller2Intro() {
  const fs = require('fs'), path = require('path'), BufferReader = require('../../lib/Buffer');
  const { binary, token } = require('./tokens');
  const raw = fs.readFileSync(path.join(__dirname, '../../examples/Roller2/Roller II.AMOS')), reader = new BufferReader(raw);
  const lines = (first, last) => raw.subarray(reader.lines[first - 1], reader.lines[last - 1] + raw[reader.lines[last - 1]] * 2);
  const code = Buffer.concat([lines(1, 20), lines(32, 56), lines(205, 239), lines(275, 279),
    lines(287, 287), binary([[token('Wait Key')]]).subarray(20),
    lines(57, 68), lines(163, 165), binary([[token('End')]]).subarray(20)]);
  const header = Buffer.from(raw.subarray(0, 20)); header.writeUInt32BE(code.length, 16);
  return Buffer.concat([header, code, raw.subarray(20 + reader.code_bytes)]);
};
