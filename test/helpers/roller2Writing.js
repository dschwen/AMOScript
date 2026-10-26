/* jshint esversion: 6 */
'use strict';

// Original 333–334 on a declared blank/palette screen. LV/TM and the extra
// Paper/Print proof are prepared fixtures; the trailing Screen 1 selects the
// preview after unchanged line 334 returns to Screen 0. No editor loop/panel.
module.exports = function roller2Writing() {
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,text,identifier:id}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/Roller2/Roller II.AMOS')),r=new Reader(raw);
  const line=number=>raw.subarray(r.lines[number-1],r.lines[number-1]+raw[r.lines[number-1]]*2);
  const statements=lines=>binary(lines).subarray(20);
  const code=Buffer.concat([statements([[t('Load'),text('icons')],
    [t('Screen Open'),n(1),t(','),n(320),t(','),n(200),t(','),n(64),t(','),t('Lowres')],
    [t('Cls Colour'),n(0)],[t('Get Icon Palette')],[id('lv'),t('='),n(1)],[id('tm'),t('='),n(300)]]),line(333),
    statements([[t('Wait Key')]]),line(334),statements([[t('Screen'),n(1)],[t('Wait Key')],
      [t('Paper'),n(7)],[t('Pen'),n(5)],[t('Locate'),n(1),t(','),n(3)],[t('Print'),text('A')],[t('Wait Key')],[t('End')]])]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]);
};
