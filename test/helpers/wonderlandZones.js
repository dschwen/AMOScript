/* jshint esversion: 6 */
'use strict';

// Declared fixture: unchanged screen setup 351–362, editor zone definitions
// 371–377 and the explicit-screen Zone query at 388. Synthetic game/background
// inputs and a Repeat / Wait Key / Until guard join the slices.
// Hardware mouse coordinates are injected; Limit Mouse, Mouse Click and the
// original editor loop/actions are excluded.
module.exports=function wonderlandZones(){
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,word:w,integer:n,identifier:id}=require('./tokens');
  const source=fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Wonderland.AMOS'));
  const reader=new Reader(source),end=20+reader.code_bytes;
  const lines=(first,last)=>source.subarray(reader.lines[first-1],reader.lines[last]);
  const prefix=binary([[id('game'),t('='),n(2)],[id('bgon'),t('='),n(0)]]).subarray(20);
  const repeat=binary([[t('Repeat'),w(0)],[t('Wait Key')]]).subarray(20);
  const suffix=binary([[t('Until'),n(0)]]).subarray(20);
  const code=Buffer.concat([prefix,lines(351,362),lines(371,377),repeat,lines(388,388),suffix]);
  const header=Buffer.from(source.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,source.subarray(end)]);
};
