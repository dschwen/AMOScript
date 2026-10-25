/* jshint esversion: 6 */
'use strict';

// Original GAMEDISP 72–86, FDZ 57–62, ICCOPY 240–246 and entry calls 570.
// A declared Load/screen harness calls GAMEDISP, then guards before a synthetic
// palette restoration for inspecting its bitmap. No foreground prompt/game loop.
module.exports=function roller2Board(){
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,text,identifier:id}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/Roller2/Roller II.AMOS')),r=new Reader(raw);
  const lines=(a,b)=>raw.subarray(r.lines[a-1],r.lines[b-1]+raw[r.lines[b-1]]*2),statements=lines=>binary(lines).subarray(20);
  const code=Buffer.concat([statements([[t('Load'),text('icons')],[t('Make Icon Mask')]]),lines(570,570),
    statements([[t('Load Bank'),text('level'),t(','),n(10)],[t('Screen Open'),n(0),t(','),n(320),t(','),n(200),t(','),n(64),t(','),t('Lowres')],
      [t('Cls Colour'),n(0)],[t('Get Icon Palette')],[id('gamedisp',0x12)],[id('counted'),t('='),t('Param')],[t('Wait Key')],
      [t('Get Icon Palette')],[t('Wait Key')],[t('End')]]),lines(57,62),lines(72,86),lines(240,246)]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);return Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]);
};
