/* jshint esversion: 6 */
'use strict';
module.exports = function writingMatrix() {
  const {binary,token:t,integer:n,text}=require('./tokens');
  const lines=[[t('Load'),text('icons')],[t('Screen Open'),n(1),t(','),n(320),t(','),n(200),t(','),n(64),t(','),t('Lowres')],
    [t('Cls Colour'),n(36)],[t('Get Icon Palette')],[t('Pen'),n(21)],[t('Paper'),n(10)]];
  for(let parts=0;parts<3;parts++)for(let mode=0;mode<5;mode++)lines.push([t('Writing2'),n(mode),t(','),n(parts)],
    [t('Locate'),n(mode*8+3),t(','),n(parts*6+3)],[t('Print'),text('A')]);
  lines.push([t('Wait Key')],[t('End')]);return binary(lines);
};
