'use strict';
// A wholly synthetic packed atlas: literal byte traversal, constant flag table.
// It shares geometry with the private milestone, never its source or pixels.
function packed(width=368,height=900,mode=4){
  const depth=3,header=Buffer.alloc(114),data=[0];
  for(let p=0;p<depth;p++)for(let col=0;col<width/8;col++)for(let y=0;y<height;y++){
    let byte=0;for(let bit=0;bit<8;bit++)if((Math.floor((col*8+bit)/16)+3*y)&(1<<p))byte|=128>>bit;data.push(byte);
  }
  const pointers=Buffer.alloc(Math.ceil(data.length/64)+1);
  header.writeUInt32BE(0x12031990);header.writeUInt16BE(width,4);header.writeUInt16BE(height,6);
  header.writeUInt16BE(113,8);header.writeUInt16BE(42,10);header.writeUInt16BE(width/(mode&0x8000?2:1),12);header.writeUInt16BE(height,14);
  header.writeUInt16BE(0x3200|mode,20);header.writeUInt16BE(8,22);header.writeUInt16BE(depth,24);
  [0,0xf00,0x0f0,0x00f,0xff0,0xf0f,0x0ff,0xfff].forEach((rgb,i)=>header.writeUInt16BE(rgb,26+i*2));
  header.writeUInt32BE(0x06071963,90);header.writeUInt16BE(width/8,98);header.writeUInt16BE(1,100);header.writeUInt16BE(height,102);header.writeUInt16BE(depth,104);
  header.writeUInt32BE(24+data.length+pointers.length,106);header.writeUInt32BE(24+data.length,110);
  return Buffer.concat([header,Buffer.from(data),pointers,Buffer.from([255])]);
}
module.exports=function(){
  const{binary,token:t,integer:n,text}=require('./tokens'),args=a=>a.flatMap((v,i)=>[i?t(','):[],n(v)]);
  const payload=packed(),head=Buffer.alloc(20);head.write('AmBk');head.writeUInt16BE(6,4);head.writeUInt32BE(payload.length+8,8);head.write('Pac.Pic.',12);
  const bytes=binary([[t('Screen Close'),n(0)],[t('Load Bank'),text('atlas.abk'),t(','),n(6)],
    [[0,0x4e,2,0,0,0x56],n(6),t('To'),n(2)],[t('Wait Key')],
    [t('Screen Display'),args([2,128,50,320,8])],[t('Screen Offset'),args([2,16,891])],[t('Wait Key')],
    [t('Screen Open'),args([0,320,12,8]),t(','),t('Lowres')],[t('Curs Off')],[t('Cls Colour'),n(2)],
    [t('Screen Display'),args([0,128,54,320,12])],[t('Wait Key')],
    [t('Screen Hide Number'),n(2)],[t('Wait Key')]]);
  return {bytes,bank:Buffer.concat([head,payload])};
};
module.exports.packed=packed;
