/* jshint esversion: 6 */
'use strict';

// Declared fixture: exact original lines 351–362, including Flash Off and
// Auto View On, with explicit game/bgon inputs and a synthetic Wait Key suffix.
// The enclosing Gosub/Return is not executed.
module.exports = function wonderlandScreens(game = 1, background = 1) {
  const fs = require('fs'), path = require('path'), Reader = require('../../lib/Buffer');
  const { binary, token: t, integer: n, identifier: id } = require('./tokens');
  const source = fs.readFileSync(path.join(__dirname, '../../examples/Wonderland/Wonderland.AMOS'));
  const buffer = new Reader(source), codeEnd = 20 + buffer.code_bytes;
  const prefix = binary([[id('game'), t('='), n(game)], [id('bgon'), t('='), n(background)]]);
  const suffix = binary([[t('Wait Key')]]);
  const code = Buffer.concat([prefix.subarray(20), source.subarray(buffer.lines[350], buffer.lines[362]), suffix.subarray(20)]);
  const header = Buffer.from(source.subarray(0, 20)); header.writeUInt32BE(code.length, 16);
  return Buffer.concat([header, code, source.subarray(codeEnd)]);
};
