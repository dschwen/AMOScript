'use strict';
// Original user-supplied ICONBANKING procedure, with declared three-bank setup.
module.exports = function joyIconBanking() {
  const fs = require('fs'), Reader = require('../../lib/Buffer'), path = require('path');
  const { binary, token: t, integer: n, text, identifier: id } = require('./tokens');
  const raw = fs.readFileSync(path.join(__dirname, '../../examples/Joy/Source1/Labyrinth.Bak')), reader = new Reader(raw);
  const lines = [[t('Load'), text('one')], [t('Bank Swap'), n(2), t(','), n(10)], [t('Load'), text('two')], [t('Bank Swap'), n(2), t(','), n(9)], [t('Load'), text('zero')]];
  for (const mode of [0, 1, 1, 2, 2, 0, 0, 2, 1, 0]) lines.push([id('iconbanking', 18), t('['), n(mode), t(']')], [t('Wait Key')]);
  lines.push([t('End')]);
  const code = Buffer.concat([binary(lines).subarray(20), raw.subarray(reader.lines[94], 20 + reader.code_bytes)]), header = Buffer.from(raw.subarray(0, 20)); header.writeUInt32BE(code.length, 16);
  return Buffer.concat([header, code]);
};
