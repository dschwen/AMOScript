'use strict';
// Declared excerpt: original Anim 1–5 and 36–55, with a prepared double-buffered
// screen 1 and palette. The preceding IFF/sprite/STOS intro is not executed.
module.exports = function amos3DProgram() {
  const fs = require('fs'), path = require('path'), Reader = require('../../lib/Buffer');
  const { binary, token: t, integer: n } = require('./tokens');
  const raw = fs.readFileSync(path.join(__dirname, '../../examples/GruPrograms/Gru1/Intr/Anim.AMOS')), reader = new Reader(raw);
  const slice = (a, b) => raw.subarray(reader.lines[a - 1], reader.lines[b - 1] + raw[reader.lines[b - 1]] * 2);
  const setup = binary([[t('Screen Open'), n(1), t(','), n(320), t(','), n(200), t(','), n(32), t(','), t('Lowres')],
    [t('Flash Off')], [t('Colour'), n(0), t(','), n(0)], [t('Double Buffer')], [t('Autoback'), n(0)]]).subarray(20);
  const end = binary([[t('Wait Key')]]).subarray(20), code = Buffer.concat([setup, slice(1, 5), slice(36, 55), end]);
  const header = Buffer.from(raw.subarray(0, 20)); header.writeUInt32BE(code.length, 16);
  return Buffer.concat([header, code]);
};
