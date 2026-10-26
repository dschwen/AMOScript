/* jshint esversion: 6 */
'use strict';
// Only unchanged Change Mouse statements from original editor routines. The
// coloured hover surface and Wait Key gates are prepared; editor actions omitted.
module.exports=function roller2Pointer(){
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,text}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/Roller2/Roller II.AMOS')),r=new Reader(raw);
  const parts=[binary([[t('Cls Colour'),n(1)],[t('Pen'),n(2)],[t('Paper'),n(1)],[t('Locate'),n(0),t(','),n(10)],
    [t('Centre'),text('Move the pointer over this surface')]]).subarray(20)];
  for(const number of [439,453,457,466,489,503,550])parts.push(raw.subarray(r.lines[number-1],r.lines[number-1]+raw[r.lines[number-1]]*2),binary([[t('Wait Key')]]).subarray(20));
  parts.push(binary([[t('End')]]).subarray(20));const code=Buffer.concat(parts),header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]);
};
