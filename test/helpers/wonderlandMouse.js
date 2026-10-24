/* jshint esversion: 6 */
'use strict';

// Exact original screen setup 351–362, editor zone/limit setup 371–379 and
// click/zone/action-selection statements 387–392. Synthetic inputs and a
// Repeat/Wait Key guard reset action outputs between probes. No editor action,
// sprite loop, file selector or file operation executes.
module.exports=function wonderlandMouse(){
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,word:w,integer:n,identifier:id,text}=require('./tokens');
  const source=fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Wonderland.AMOS'));
  const reader=new Reader(source),end=20+reader.code_bytes;
  const lines=(first,last)=>source.subarray(reader.lines[first-1],reader.lines[last]);
  const prefix=binary([[id('game'),t('='),n(2)],[id('bgon'),t('='),n(0)]]).subarray(20);
  const repeat=binary([[t('Repeat'),w(0)],[t('Wait Key')],[id('i',6,2),t('='),text('')],[id('scod'),t('='),n(0)]]).subarray(20);
  const suffix=binary([[t('Until'),n(0)]]).subarray(20);
  const code=Buffer.concat([prefix,lines(351,362),lines(371,379),repeat,lines(387,392),suffix]);
  const header=Buffer.from(source.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,source.subarray(end)]);
};
