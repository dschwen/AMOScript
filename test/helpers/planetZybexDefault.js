'use strict';
// Original physical lines 90 (Default) and 91–93 (Screen Close / Close Editor / Set Sprite Buffer),
// with declared Wait Key guards. Stops after the original 48-line Sprite allocation; no AMAL executes.
module.exports = function planetZybexDefault() {
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t}=require('./tokens'),raw=fs.readFileSync(path.join(__dirname,'../../examples/PlanetZybex/Zybex.AMOS')),r=new Reader(raw);
  const lines=(first,last)=>raw.subarray(r.lines[first-1],r.lines[last-1]+raw[r.lines[last-1]]*2),key=binary([[t('Wait Key')]]).subarray(20);
  const code=Buffer.concat([lines(90,90),key,lines(91,93),key]),header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]);
};
