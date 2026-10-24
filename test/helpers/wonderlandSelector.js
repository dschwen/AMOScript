/* jshint esversion: 6 */
'use strict';

// Original startup 1–48, save 435–437 or load 426–431, and the complete
// filesel routine 706–712 including its own Gosub/Return, extension retry loop
// and Show/Hide. A synthetic Wait Key/End separates main code from the routine.
module.exports=function wonderlandSelector(mode='load'){
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t}=require('./tokens');const source=fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Wonderland.AMOS'));
  const reader=new Reader(source),end=20+reader.code_bytes,lines=(a,b)=>source.subarray(reader.lines[a-1],reader.lines[b]);
  if(!['load','save'].includes(mode))throw new Error('Invalid selector fixture mode');
  const guard=binary([[t('Wait Key')],[t('End')]]).subarray(20);
  const code=Buffer.concat([lines(1,48),mode==='load'?lines(426,431):lines(435,437),guard,lines(706,712)]);
  const header=Buffer.from(source.subarray(0,20));header.writeUInt32BE(code.length,16);return Buffer.concat([header,code,source.subarray(end)]);
};
