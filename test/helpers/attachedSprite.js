/* jshint esversion: 6 */
'use strict';
const fs = require('fs'), path = require('path');
const { binary, token: t, integer: n } = require('./tokens');
// Independent literal AmSp bytes: row zero is 0..15, row one is 15..0.
const bank = Buffer.from(fs.readFileSync(path.join(__dirname, '../fixtures/attached-sprite.hex'), 'utf8').replace(/\s/g, ''), 'hex');
const source = lines => Buffer.concat([binary(lines), Buffer.from('416d42730001', 'hex'), bank]);
const palette = [[t('Cls Colour'), n(0)], ...Array.from({length: 16}, (_, i) => [t('Colour'), n(16+i), t(','), n(i*0x111)])];
const sprite = (number, x = 138, y = 60) => [t('Sprite'), n(number), t(','), n(x), t(','), n(y), t(','), n(1)];
module.exports = { bank, source, palette, sprite };
