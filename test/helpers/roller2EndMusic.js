/* jshint esversion: 6 */
'use strict';

// Original load and Led Off/Music lines, then a declared Wait Key audition
// boundary; original game-over volume-fade/Off/Erase 1006 and final Wait Key.
// No FLOAD/end-state graphics, win logic, highscores or menu return is included.
module.exports = function roller2EndMusic(won = false) {
  const fs = require('fs'), path = require('path'), Reader = require('../../lib/Buffer');
  const { binary, token } = require('./tokens');
  const raw = fs.readFileSync(path.join(__dirname, '../../examples/Roller2/Roller II.AMOS')), r = new Reader(raw);
  const line = n => raw.subarray(r.lines[n - 1], r.lines[n - 1] + raw[r.lines[n - 1]] * 2);
  const wait = binary([[token('Wait Key')]]).subarray(20);
  const code = Buffer.concat([line(won ? 1012 : 990), line(won ? 1014 : 992), wait, line(1006), wait]);
  const header = Buffer.from(raw.subarray(0, 20)); header.writeUInt32BE(code.length, 16);
  return Buffer.concat([header, code, raw.subarray(20 + r.code_bytes)]);
};
