'use strict';
module.exports=function amcafPreviewBytes(){
  const m=require('./amcafPreviewModule')(),bytes=Buffer.alloc(1084+1024+128);
  bytes.write('AMCAF synthetic');bytes[950]=1;bytes[951]=127;bytes.write('M.K.',1080);
  for(let i=0;i<31;i++){
    const s=m.samples[i],at=20+i*30;
    bytes.writeUInt16BE(s.length/2,at+22);bytes[at+24]=s.finetune&15;bytes[at+25]=s.volume;
    bytes.writeUInt16BE(s.loopStart/2,at+26);bytes.writeUInt16BE(s.loopLength/2,at+28);
  }
  for(let i=0;i<256;i++){
    const c=m.patterns[0][i],at=1084+i*4;
    bytes[at]=(c.sample&240)|(c.period>>8);bytes[at+1]=c.period&255;
    bytes[at+2]=((c.sample&15)<<4)|c.effect;bytes[at+3]=c.parameter;
  }
  bytes.set(m.samples[0].pcm,2108);bytes.set(m.samples[1].pcm,2172);return bytes;
};
