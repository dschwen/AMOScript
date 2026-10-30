'use strict';
// Declared excerpt: original Anim 1–5 and 36–55, with a prepared double-buffered
// screen 1 and palette. The preceding IFF/sprite/STOS intro is not executed.
module.exports = function amos3DProgram({ heroTurntable = false } = {}) {
  const fs = require('fs'), path = require('path'), Reader = require('../../lib/Buffer');
  const { binary, token: t, integer: n, identifier: id, word } = require('./tokens');
  const raw = fs.readFileSync(path.join(__dirname, '../../examples/GruPrograms/Gru1/Intr/Anim.AMOS')), reader = new Reader(raw);
  const slice = (a, b) => raw.subarray(reader.lines[a - 1], reader.lines[b - 1] + raw[reader.lines[b - 1]] * 2);
  const setup = binary([[t('Screen Open'), n(1), t(','), n(320), t(','), n(200), t(','), n(32), t(','), t('Lowres')],
    [t('Flash Off')], [t('Colour'), n(0), t(','), n(0)], [t('Double Buffer')], [t('Autoback'), n(0)]]).subarray(20);
  // Optional, explicitly synthetic showcase continuation. Original source ends
  // after displaying the hero once; rotation uses ordinary compiled TD commands.
  const ext = offset => [...word(0x4e), 4, 0, ...word(offset)];
  const end = binary(heroTurntable ? [
    [t('Do'), word(0)],
    [t('For'), word(0), id('demoangle'), t('='), n(0), t('To'), n(65024), t('Step'), n(512)],
    [ext(0x1a6), n(1), t(','), n(3250), t(','), id('demoangle'), t('-'), n(1000), t(','), t('-'), n(3200)],
    [ext(0x53c), t(':'), ext(0x318), t(':'), t('Screen Swap'), t(':'), t('Wait Vbl')],
    [t('Next')], [t('Loop')]
  ] : [[t('Wait Key')]]).subarray(20), code = Buffer.concat([setup, slice(1, 5), slice(36, 55), end]);
  const header = Buffer.from(raw.subarray(0, 20)); header.writeUInt32BE(code.length, 16);
  return Buffer.concat([header, code]);
};
