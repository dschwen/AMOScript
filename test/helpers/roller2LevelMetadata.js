/* jshint esversion: 6 */
'use strict';

// Original game metadata read 608 and editor Doke/Wait Vbl write 474.
// Synthetic Load and Input# use prepared files; Wait Key guards bracket the
// edit. No drawing, game/editor loop or persistence is executed.
module.exports=function roller2LevelMetadata(){
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,text,identifier:id}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/Roller2/Roller II.AMOS')),reader=new Reader(raw);
  const line=number=>raw.subarray(reader.lines[number-1],reader.lines[number-1]+raw[reader.lines[number-1]]*2);
  const statements=lines=>binary(lines).subarray(20);
  const code=Buffer.concat([statements([[t('Load Bank'),text('level'),t(','),n(10)]]),line(608),statements([[t('Wait Key')],
    [t('Open In'),n(1),t(','),text('time')],[t('Input#'),n(1),t(','),id('tm')],[t('Close'),n(1)]]),line(474),statements([[t('Wait Key')],[t('End')]])]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);return Buffer.concat([header,code,raw.subarray(20+reader.code_bytes)]);
};
