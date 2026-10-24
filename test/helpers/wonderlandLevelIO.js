/* jshint esversion: 6 */
'use strict';

// Exact original startup 1–48, map read 309–315, writeback 441–450,
// Bsave 437, Bload/seed refresh 428–431, then map read again. Synthetic
// filename/level inputs and Wait Key guards separate edit/save/reload stages.
// File selection, editor dispatch and gameplay are excluded.
module.exports=function wonderlandLevelIO(level=1){
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,identifier:id,text}=require('./tokens');
  const source=fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Wonderland.AMOS'));
  const reader=new Reader(source),end=20+reader.code_bytes;
  const lines=(first,last)=>source.subarray(reader.lines[first-1],reader.lines[last]);
  const inputs=binary([[id('f',6,2),t('='),text('levels.lev')],[id('lev'),t('='),n(level)]]).subarray(20);
  const guard=binary([[t('Wait Key')]]).subarray(20);
  const finish=binary([[t('Wait Key')],[t('End')]]).subarray(20);
  const code=Buffer.concat([lines(1,48),inputs,lines(309,315),guard,lines(441,450),lines(437,437),guard,lines(428,431),lines(309,315),finish]);
  const header=Buffer.from(source.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,source.subarray(end)]);
};
