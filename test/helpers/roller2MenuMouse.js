/* jshint esversion: 6 */
'use strict';

// Original LIMM call 288, procedure 69–71 and joystick mouse movement 299–303.
// A synthetic title load and Repeat/Wait Key gate permit one bounded menu step.
// Zones, selections, remaining setup and gameplay are deliberately excluded.
module.exports = function roller2MenuMouse() {
  const fs = require('fs'), path = require('path'), Reader = require('../../lib/Buffer');
  const { binary, token: t, integer: n, word: w, text } = require('./tokens');
  const raw = fs.readFileSync(path.join(__dirname, '../../examples/Roller2/Roller II.AMOS')), reader = new Reader(raw);
  const lines = (first, last) => raw.subarray(reader.lines[first - 1], reader.lines[last - 1] + raw[reader.lines[last - 1]] * 2);
  const statements = lines => binary(lines).subarray(20);
  const code = Buffer.concat([statements([[t('Load Iff Screen'), text('title'), t(','), n(0)]]), lines(288, 288),
    statements([[t('Repeat'), w(0)], [t('Wait Key')]]), lines(299, 303),
    statements([[t('Until'), n(0)]]), lines(69, 71), statements([[t('End')]])]);
  const header = Buffer.from(raw.subarray(0, 20)); header.writeUInt32BE(code.length, 16);
  return Buffer.concat([header, code, raw.subarray(20 + reader.code_bytes)]);
};
