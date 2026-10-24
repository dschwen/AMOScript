/* jshint esversion: 6 */
'use strict';

// Exact original line 360 (Screen/Paper/Pen), level line 285 or 323 and
// score line 655. Synthetic inputs/load/window and Wait Key/End guards expose
// the original panel fields without running setupmap, score awards or gameplay.
module.exports=function wonderlandScore(level=1,score=0,secondLevelLine=false){
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,identifier:id,text}=require('./tokens');
  const source=fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Wonderland.AMOS'));
  const reader=new Reader(source),end=20+reader.code_bytes;
  const lines=(first,last)=>source.subarray(reader.lines[first-1],reader.lines[last]);
  const prefix=binary([[t('Load Iff Screen'),text('AMOSPro_Productivity2:Wonderland/Score_Panel.Iff'),t(','),n(1)],
    [id('lev'),t('='),n(level)],[id('scor'),t('='),n(score)]]);
  const suffix=binary([[t('Screen Display'),n(1),t(','),n(128),t(','),n(218),t(','),n(320),t(','),n(32)],[t('Wait Key')],[t('End')]]);
  const code=Buffer.concat([prefix.subarray(20),lines(360,360),lines(secondLevelLine?323:285,secondLevelLine?323:285),lines(655,655),suffix.subarray(20)]);
  const header=Buffer.from(source.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,source.subarray(end)]);
};
