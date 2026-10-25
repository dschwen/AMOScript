/* jshint esversion: 6 */
'use strict';

// Original LIMM 288/69–71, zone/input/branch loop 293–316 and FDZ 57–62.
// Synthetic title loading skips startup/setup; branch targets record outcomes
// and wait instead of entering the game, editor, highscores or help routines.
module.exports = function roller2MenuSelection() {
  const fs = require('fs'), path = require('path'), Reader = require('../../lib/Buffer');
  const { binary, token: t, integer: n, text, identifier: id } = require('./tokens');
  const raw = fs.readFileSync(path.join(__dirname, '../../examples/Roller2/Roller II.AMOS')), reader = new Reader(raw);
  const lines = (first, last) => raw.subarray(reader.lines[first - 1], reader.lines[last - 1] + raw[reader.lines[last - 1]] * 2);
  const statements = lines => binary(lines).subarray(20);
  const targets = [['rollergame','game'], ['rollereditor','editor'], ['highausw','scores'], ['help','help']];
  const guards = targets.flatMap(([label, action]) => [[id(label, 0xc)], [id('selection', 6, 2), t('='), text(action)], [t('Wait Key')], [t('End')]]);
  const code = Buffer.concat([statements([[t('Load Iff Screen'), text('title'), t(','), n(0)]]), lines(288, 288),
    lines(293, 316), statements([[t('End')], ...guards]), lines(57, 62), lines(69, 71), statements([[t('End')]])]);
  const header = Buffer.from(raw.subarray(0, 20)); header.writeUInt32BE(code.length, 16);
  return Buffer.concat([header, code, raw.subarray(20 + reader.code_bytes)]);
};
