/* jshint esversion: 6 */
'use strict';

// Independent file addressing, separate from BankReader and createAudio:
// 20-byte AmBk wrapper, word count, relative long offsets, 14-byte records.
module.exports=function wonderlandSamples(){
  const bytes=require('fs').readFileSync(require('path').join(__dirname,'../../examples/Wonderland/Wonderland_Samples.Abk'));
  return Array.from({length:bytes.readUInt16BE(20)},(_,index)=>{
    const record=20+bytes.readUInt32BE(22+index*4),length=bytes.readUInt32BE(record+10);
    return {number:index+1,length,frequency:bytes.readUInt16BE(record+8),pcm:Array.from({length},(_,i)=>bytes.readInt8(record+14+i)/128)};
  });
};
