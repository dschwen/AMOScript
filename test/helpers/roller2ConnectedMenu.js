/* jshint esversion: 6 */
'use strict';

// Original executable sequence 1–316, retaining all reached procedures and
// omitting only unused procedure definitions/comments. Destinations record an
// outcome and wait instead of running the game, editor, scores or help.
module.exports = function roller2ConnectedMenu() {
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,text,identifier:id}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/Roller2/Roller II.AMOS')),reader=new Reader(raw);
  const lines=(first,last)=>raw.subarray(reader.lines[first-1],reader.lines[last-1]+raw[reader.lines[last-1]]*2);
  const targets=[['rollergame','game'],['rollereditor','editor'],['highausw','scores'],['help','help']];
  const guards=targets.flatMap(([label,action])=>[[id(label,0xc)],[id('selection',6,2),t('='),text(action)],[t('Wait Key')],[t('End')]]);
  const code=Buffer.concat([lines(1,71),lines(163,165),lines(205,239),lines(275,316),binary([[t('End')],...guards]).subarray(20)]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+reader.code_bytes)]);
};
