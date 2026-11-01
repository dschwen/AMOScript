'use strict';
const fs=require('fs'),path=require('path'),BankWriter=require('../lib/BankWriter'),BankReader=require('../lib/BankReader');
const readIlbm=require('../lib/display/model/ilbm'),readPacked=require('../lib/amos/packedPicture');
const root=path.join(__dirname,'../examples/ASM/game'),profile=require('../examples/ASM/game/asset-profile.json');
function decodePicture(name) {
  const recovery=profile.recovered[name];
  if(recovery){
    const banks=BankReader.readFile(fs.readFileSync(path.join(root,recovery.file))).banks;
    if(banks.length!==1||banks[0].type!=='data'||banks[0].name!=='Pac.Pic.')throw Error('Invalid recovered picture bank '+name);
    let data=Buffer.from(banks[0].data);
    if(data.readUInt32BE(0)===0x06071963){
      const width=data.readUInt16BE(8)*8,height=data.readUInt16BE(10)*data.readUInt16BE(12),depth=data.readUInt16BE(14),header=Buffer.alloc(90);
      header.writeUInt32BE(0x12031990);[width,height,128,80,width,height,0,0,depth<<12,1<<depth,depth].forEach((v,i)=>header.writeUInt16BE(v,4+i*2));
      data=Buffer.concat([header,data]);
    }
    const image=readPacked(data);
    const palette=recovery.palette.endsWith('.Abk')?BankReader.readFile(fs.readFileSync(path.join(root,recovery.palette))).banks[0].palette:decodePicture(recovery.palette).palette;
    if(recovery.swap17And31)for(let i=0;i<image.pixels.length;i++){const low=image.pixels[i]&31;if(low===17||low===31)image.pixels[i]=(image.pixels[i]&32)|(low===17?31:17);}
    return {...image,palette:palette.slice()};
  }
  let bytes=fs.readFileSync(path.join(root,name));
  if(profile.paddingRepairs.includes(name)){
    // These pinned authoring IFFs count one final zero alignment byte in BODY.
    bytes=Buffer.from(bytes);let at=12,found=false;
    while(at+8<=bytes.length){const size=bytes.readUInt32BE(at+4);if(bytes.toString('ascii',at,at+4)==='BODY'){
      if(size%2||bytes[at+8+size-1]!==0)throw Error('Picture BODY padding precondition changed: '+name);
      bytes.writeUInt32BE(size-1,at+4);found=true;break;}at+=8+size+(size&1);}
    if(!found)throw Error('Missing picture BODY: '+name);
  }
  const {snapshot,image}=readIlbm(bytes,{ignoreMonitor:true}),pixels=new Uint8Array(image.width*image.height);
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)for(let p=0;p<image.depth;p++)
    pixels[y*image.width+x]|=((snapshot.chip[snapshot.frame.lineRegs[p]+y*image.rowBytes+(x>>3)]>>(7-(x&7)))&1)<<p;
  const palette=Array.from({length:32},(_,i)=>(snapshot.frame.linePal[i*4]>>4)*256+(snapshot.frame.linePal[i*4+1]>>4)*16+(snapshot.frame.linePal[i*4+2]>>4));
  return {...image,pixels,palette};
}
function readPicture(name,height,hardwareY){
  const image=decodePicture(name);
  if((image.width!==320&&!(['Room14_1.Pic','Room14_2.Pic'].includes(name)&&image.width===352))||image.height<height||image.depth!==6||image.masking)throw Error('ASM room image format changed: '+name);
  const size=40*height*6,pointers=115+size,flags=pointers+Math.ceil((size/8+1)/8),data=Buffer.alloc(flags+1);
  data.writeUInt32BE(0x12031990);[320,height,128,hardwareY,320,height,0,0,0x6000,64,6].forEach((v,i)=>data.writeUInt16BE(v,4+i*2));
  image.palette.forEach((v,i)=>data.writeUInt16BE(v,26+i*2));
  data.writeUInt32BE(0x06071963,90);[0,0,40,1,height,6].forEach((v,i)=>data.writeUInt16BE(v,94+i*2));
  data.writeUInt32BE(flags-90,106);data.writeUInt32BE(pointers-90,110);data[flags]=255;let pos=115;
  for(let p=0;p<6;p++)for(let x=0;x<40;x++)for(let y=0;y<height;y++){let value=0;for(let bit=0;bit<8;bit++)if(image.pixels[y*image.width+x*8+bit]&(1<<p))value|=128>>bit;data[pos++]=value;}
  return BankWriter.write([{type:'data',number:8,memory:'fast',permanent:true,name:'Pac.Pic.',data}]);
}
function prepare(){
  const files=Object.create(null),add=(name,bytes)=>{files[name.toLowerCase()]=Buffer.from(bytes).toString('base64');};
  const raw=(prefix,name)=>add(prefix+name,fs.readFileSync(path.join(root,name)));
  for(const room of profile.rooms){
    for(const ext of ['Sprites.Abk','Txt','Zones'])raw('ASM_1:Rooms/','Room'+room+'.'+ext);
    add('ASM_1:Rooms/Room'+room+'.Pic',readPicture('Room'+room+'.Pic',128,80));
  }
  for(const name of ['Room5_1.Pic','Room14_1.Pic','Room14_2.Pic','FAR.Pic','TEL.Pic','TRE.Pic','GOG.Pic','GOK.Pic','END.Pic'])add('ASM_1:Rooms/'+name,readPicture(name,128,80));
  for(const name of ['Icons.Abk','Icons2.Abk','Icons3.Abk','LAB.Icons.Abk','FAR.Sprites.Abk','TEL.Sprites.Abk','TEL.Zones','TRE.Sprites.Abk','GOG.Sprites.Abk','GOK.Sprites.Abk','END.Sprites.Abk'])raw('ASM_1:Rooms/',name);
  for(const name of ['Befehle.Pic','Befehle2.Pic','Befehle4.Pic'])add('ASM_1:'+name,readPicture(name,90,208));
  raw('ASM_1:','Gesichter.Abk');for(const name of ['Ereignisse.Txt','Objekte.Txt'])raw('ASM_1:Texte/',name);
  for(const folder of ['Unterhaltungen','Labyrinth'])for(const name of fs.readdirSync(path.join(root,folder)))raw('ASM_1:',folder+'/'+name);
  return files;
}
module.exports={prepare,readPicture,decodePicture};
