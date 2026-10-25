/* jshint esversion: 6 */
'use strict';
// Original ICCOPY 240–246 and game-entry calls 570. Synthetic screen/pastes and
// Wait Key guards expose before/after icon pixels without executing game setup.
module.exports=function roller2IconCopy(){
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,text}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/Roller2/Roller II.AMOS')),r=new Reader(raw);
  const lines=(a,b)=>raw.subarray(r.lines[a-1],r.lines[b-1]+raw[r.lines[b-1]]*2),statements=lines=>binary(lines).subarray(20);
  const pastes=[18,29,76,74].map((image,index)=>[t('Paste Icon'),n(index*32),t(','),n(0),t(','),n(image)]);
  const code=Buffer.concat([statements([[t('Load'),text('icons')],[t('Make Icon Mask')],[t('Screen Open'),n(0),t(','),n(320),t(','),n(200),t(','),n(64),t(','),t('Lowres')],[t('Get Icon Palette')],[t('Cls Colour'),n(0)],...pastes,[t('Wait Key')]]),
    lines(570,570),statements([[t('Cls Colour'),n(0)],...pastes,[t('Wait Key')],[t('End')]]),lines(240,246)]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);return Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]);
};
