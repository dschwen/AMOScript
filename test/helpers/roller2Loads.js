/* jshint esversion: 6 */
'use strict';

// Original line 15 and only the leading Track Load statement of line 16.
// The fixture terminates before TRUE, Track Play and the rest of the game.
module.exports=function roller2Loads(){
  const fs=require('fs'),path=require('path'),BufferReader=require('../../lib/Buffer');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/Roller2/Roller II.AMOS')),b=new BufferReader(raw);
  const header=Buffer.from(raw.subarray(0,20)),start=b.lines[14],line15=raw.subarray(start,start+raw[start]*2);
  const line16=Buffer.concat([Buffer.from([0,raw[b.lines[15]+1]]),raw.subarray(328,374),Buffer.from([0,0])]);
  // 2-byte line header + 46-byte original statement + 2-byte EOL = 50 bytes.
  line16[0]=line16.length/2;
  const code=Buffer.concat([line15,line16,Buffer.from('030003b60000','hex')]);header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+b.code_bytes)]);
};
