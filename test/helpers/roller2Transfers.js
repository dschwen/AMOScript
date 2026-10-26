/* jshint esversion: 6 */
'use strict';

// Prepared original level -> original editor backup 415 -> editor clear 325–326
// -> original restore 561. Its EDDISP call reaches a declared procedure/Wait Key
// guard; no editor redraw or game/editor input loop is included.
module.exports = function roller2Transfers() {
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,text,identifier:id,word:w}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/Roller2/Roller II.AMOS')),reader=new Reader(raw);
  const line=number=>raw.subarray(reader.lines[number-1],reader.lines[number-1]+raw[reader.lines[number-1]]*2);
  const statements=lines=>binary(lines).subarray(20);
  const code=Buffer.concat([statements([[t('Load Bank'),text('level'),t(','),n(10)]]),line(415),
    statements([[t('Wait Key')]]),line(325),line(326),statements([[t('Wait Key')]]),line(561),statements([[t('End')],
      [t('Procedure'),[0,0,0,0],w(0),0,0,id('eddisp')],[t('Wait Key')],[t('End Proc')]])]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+reader.code_bytes)]);
};
