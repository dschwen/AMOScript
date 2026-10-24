/* jshint esversion: 6 */
'use strict';

// Exact original startup/title 1–64, screen setup 351–362, sprite palette
// setup 264–276, panel fields 285/655, level-data loop 309–315 and map-paste/copy loop 287–305.
// Synthetic game/level inputs and Wait Key/End guards join the slices.
// Score awards, enemy initialization and gameplay are excluded.
module.exports=function wonderlandMapCopy(level=1){
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,identifier:id}=require('./tokens');
  const source=fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Wonderland.AMOS'));
  const reader=new Reader(source),end=20+reader.code_bytes;
  const lines=(first,last)=>source.subarray(reader.lines[first-1],reader.lines[last]);
  const input=binary([[t('Wait Key')],[id('game'),t('='),n(1)],[id('lev'),t('='),n(level)]]).subarray(20);
  const select=binary([[t('Screen'),n(1)]]).subarray(20);
  const guard=binary([[t('Wait Key')],[t('End')]]).subarray(20);
  const code=Buffer.concat([lines(1,64),input,lines(351,362),select,lines(285,285),lines(655,655),lines(264,276),lines(309,315),lines(287,305),guard]);
  const header=Buffer.from(source.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,source.subarray(end)]);
};
