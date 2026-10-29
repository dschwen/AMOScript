'use strict';
// Declared routing-table preview: original level-1 Load/Unpack plus channel
// loops from separate enemy/player/bullet paths. AMAL, object creation and the
// surrounding gameplay/control flow are omitted; key guards join the excerpts.
module.exports = function planetZybexChannels() {
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,identifier:id}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/PlanetZybex/Zybex.AMOS')),r=new Reader(raw);
  const lines=(a,b)=>raw.subarray(r.lines[a-1],r.lines[b-1]+raw[r.lines[b-1]]*2);
  const synthetic=rows=>binary(rows).subarray(20),key=synthetic([[t('Wait Key')]]);
  const stage=value=>synthetic([[id('stage'),t('='),n(value)]]);
  const code=Buffer.concat([lines(245,247),stage(0),lines(383,385),key,stage(1),lines(460,462),key,stage(2),lines(991,991),lines(1029,1031),key]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]);
};
