/* jshint esversion: 6 */
'use strict';

// Original selection border 333, erase 354 and redraw 356 in a declared blank
// screen/palette preview. A prepared Input# replaces original mouse-cell 355;
// editor panel construction, Writing and editor/game loops are excluded.
module.exports = function roller2LinePattern() {
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,text,identifier:id}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/Roller2/Roller II.AMOS')),r=new Reader(raw);
  const line=number=>raw.subarray(r.lines[number-1],r.lines[number-1]+raw[r.lines[number-1]]*2);
  const statements=lines=>binary(lines).subarray(20);
  const code=Buffer.concat([statements([[t('Load'),text('icons')],
    [t('Screen Open'),n(1),t(','),n(320),t(','),n(200),t(','),n(64),t(','),t('Lowres')],
    [t('Cls Colour'),n(0)],[t('Get Icon Palette')]]),line(333),statements([[t('Wait Key')]]),line(354),
    statements([[t('Wait Key')],[t('Open In'),n(1),t(','),text('cell')],
      [t('Input#'),n(1),t(','),id('xkst'),t(','),id('ykst')],[t('Close'),n(1)]]),line(356),statements([[t('Wait Key')],[t('End')]])]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]);
};
