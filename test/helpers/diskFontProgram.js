'use strict';
module.exports = function diskFontProgram() {
  const { binary, token: t, integer: n, text } = require('./tokens');
  return binary([[t('Cls Colour'), n(0)], [t('Colour'), n(1), t(','), n(0xfff)], [t('Colour'), n(2), t(','), n(0x00f)], [t('Colour'), n(3), t(','), n(0x0f0)],
    [t('Pen'), n(1)], [t('Paper'), n(0)], [t('Ink2'), n(1), t(','), n(3)], [t('Gr Writing'), n(0)],
    [t('Get Disc Fonts')], [t('Set Font'), n(1)], [t('Text'), n(3), t(','), n(8), t(','), text('A?')], [t('Wait Key')],
    [t('Cls Colour'), n(2)], [t('Gr Writing'), n(1)], [t('Text'), n(3), t(','), n(8), t(','), text('A?')], [t('Wait Key')],
    [t('Set Font'), n(0)], [t('Gr Writing'), n(0)], [t('Cls Colour'), n(0)], [t('Print'), text('A')], [t('Text'), n(16), t(','), n(15), t(','), text('A')], [t('Wait Key')]]);
};
