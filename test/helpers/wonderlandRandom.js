/* jshint esversion: 6 */
'use strict';

// Unchanged startup 1–48 and blob initializer 560–563 or green jump 607–613.
// Synthetic positions/index and Repeat/Wait Key guards supply bounded calls.
// No complete movement, Bob rendering, game loop or hardware beam executes.
module.exports=function wonderlandRandom(kind='blob'){
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,word:w,integer:n,identifier:id}=require('./tokens');
  const source=fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Wonderland.AMOS'));
  const reader=new Reader(source),end=20+reader.code_bytes;
  const lines=(first,last)=>source.subarray(reader.lines[first-1],reader.lines[last]);
  const array=(name,value)=>[id(name),t('('),n(1),t(')'),t('='),n(value)];
  const inputs=binary([[id('l'),t('='),n(1)],[id('x'),t('='),n(160)],[id('y'),t('='),n(64)],array('x',kind==='green-right'?120:200),array('y',192),[t('Repeat'),w(0)],[t('Wait Key')]]).subarray(20);
  const guard=binary([[t('Until'),n(0)]]).subarray(20);
  if(!['blob','green','green-right'].includes(kind))throw new Error('Invalid random fixture kind');
  const code=Buffer.concat([lines(1,48),inputs,kind==='blob'?lines(560,563):lines(607,613),guard]);
  const header=Buffer.from(source.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,source.subarray(end)]);
};
