'use strict';
// Original Global/array setup and clear_amal procedure with declared register
// inputs and an End before the procedure body. No game loop/AMAL interpreter.
module.exports = function planetZybexRegisters() {
  const fs = require('fs'), path = require('path'), BufferReader = require('../../lib/Buffer');
  const { binary, token: t, integer: n, identifier: id } = require('./tokens');
  const raw = fs.readFileSync(path.join(__dirname, '../../examples/PlanetZybex/Zybex.AMOS')), reader = new BufferReader(raw);
  const lines = (first, last) => raw.subarray(reader.lines[first - 1], reader.lines[last - 1] + raw[reader.lines[last - 1]] * 2);
  const setup = binary([[t('Amreg'), t('('), n(9), t(')'), t('='), n(1234)], [t('Amreg'), t('('), n(20), t(')'), t('='), n(4)],
    [id('clear_amal', 0x12)], [t('End')]]).subarray(20);
  const code = Buffer.concat([lines(97,108), setup, lines(220,238)]), header = Buffer.from(raw.subarray(0,20)); header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+reader.code_bytes)]);
};
