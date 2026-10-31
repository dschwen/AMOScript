'use strict';
const fs=require('fs'),path=require('path'),BankWriter=require('../lib/BankWriter'),readIlbm=require('../lib/display/model/ilbm');
const root=path.join(__dirname,'../examples/ASM/game');
function readPicture(name,height,hardwareY) {
  let bytes=fs.readFileSync(path.join(root,name));
  if(name==='Befehle.Pic') {
    // The supplied IFF counts its final zero alignment byte inside BODY.
    bytes=Buffer.from(bytes);let at=12;
    while(at<bytes.length){const size=bytes.readUInt32BE(at+4);if(bytes.toString('ascii',at,at+4)==='BODY'){if(size%2 || bytes[at+8+size-1]!==0)throw Error('Befehle BODY repair precondition changed');bytes.writeUInt32BE(size-1,at+4);break;}at+=8+size+(size&1);}
  }
  const {snapshot,image}=readIlbm(bytes,{ignoreMonitor:true});
  if(image.width!==320||image.height<height||image.depth!==6||image.masking)throw Error('ASM room image format changed');
  const size=40*height*6,pointers=115+size,flags=pointers+Math.ceil((size/8+1)/8),data=Buffer.alloc(flags+1);
  data.writeUInt32BE(0x12031990);[320,height,128,hardwareY,320,height,0,0,0x6000,64,6].forEach((v,i)=>data.writeUInt16BE(v,4+i*2));
  for(let i=0;i<32;i++){const p=snapshot.frame.linePal;data.writeUInt16BE((p[i*4]>>4)*256+(p[i*4+1]>>4)*16+(p[i*4+2]>>4),26+i*2);}
  data.writeUInt32BE(0x06071963,90);[0,0,40,1,height,6].forEach((v,i)=>data.writeUInt16BE(v,94+i*2));
  data.writeUInt32BE(flags-90,106);data.writeUInt32BE(pointers-90,110);data[flags]=255;let pos=115;
  for(let p=0;p<6;p++)for(let x=0;x<40;x++)for(let y=0;y<height;y++)data[pos++]=snapshot.chip[snapshot.frame.lineRegs[p]+y*image.rowBytes+x];
  return BankWriter.write([{type:'data',number:8,memory:'fast',permanent:true,name:'Pac.Pic.',data}]);
}
function prepare() {
  const files=Object.create(null),add=(name,bytes)=>{files[name.toLowerCase()]=Buffer.from(bytes).toString('base64');};
  for(const name of ['Room1.Zones','Room1.Txt','Room1.Sprites.Abk','Icons.Abk','Icons3.Abk'])add('ASM_1:Rooms/'+name,fs.readFileSync(path.join(root,name)));
  add('ASM_1:Rooms/Room1.Pic',readPicture('Room1.Pic',128,80));
  for(const name of ['Befehle.Pic','Befehle4.Pic'])add('ASM_1:'+name,readPicture(name,90,208));
  // Original Befehle2.Pic is a zero-byte upload; its disk-image data block
  // 1422 is overwritten. Explicit provisional conversation artwork, not a
  // repaired original: reuse the supplied Befehle4 panel until it is recovered.
  add('ASM_1:Befehle2.Pic',readPicture('Befehle4.Pic',90,208));
  add('ASM_1:Gesichter.Abk',fs.readFileSync(path.join(root,'Gesichter.Abk')));
  for(const name of ['Ereignisse.Txt','Objekte.Txt'])add('ASM_1:Texte/'+name,fs.readFileSync(path.join(root,name)));
  return files;
}
module.exports={prepare,readPicture};
