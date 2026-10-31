'use strict';
// Build-time preparation for the supplied ASM intro, not runtime format aliases.
const fs = require('fs'), path = require('path');
const readIlbm = require('../lib/display/model/ilbm'), writeIlbm = require('../lib/display/model/ilbmWriter');
const BankWriter = require('../lib/BankWriter');
const root = path.join(__dirname, '../examples/ASM');
function bitmap(filename) {
  const { snapshot, image } = readIlbm(fs.readFileSync(filename), { ignoreMonitor: true });
  if (image.width < 320 || image.height < 256 || image.depth !== 6 || image.masking) throw Error('ASM picture format changed');
  const pixels = new Uint8Array(320 * 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 320; x++) for (let plane = 0; plane < 6; plane++) {
    if (snapshot.chip[snapshot.frame.lineRegs[plane] + y * image.rowBytes + (x >> 3)] & (128 >> (x & 7))) pixels[y * 320 + x] |= 1 << plane;
  }
  const palette = Array.from({ length: 32 }, (_, i) => (snapshot.frame.linePal[i * 4] >> 4) * 256 + (snapshot.frame.linePal[i * 4 + 1] >> 4) * 16 + (snapshot.frame.linePal[i * 4 + 2] >> 4));
  return { width: 320, height: 256, colours: 64, mode: 0, ham: !!(image.displayMode & 0x800), pixels, palette,
    hardwareX: 128, hardwareY: 50, windowWidth: 320, windowHeight: 256, offsetX: 0, offsetY: 0 };
}
function packed(screen) {
  // Literal-only SCCode/BMCode: no run sharing, flags always $ff, pointer
  // bits always zero. Traversal is plane/column/row (one 256-row band).
  const size = 40 * 256 * 6, data = Buffer.alloc(114 + size + 1 + Math.ceil((size / 8 + 1) / 8) + 1);
  data.writeUInt32BE(0x12031990, 0);
  [320,256,128,50,320,256,0,0,0x6000,64,6].forEach((v,i) => data.writeUInt16BE(v, 4 + i * 2));
  screen.palette.forEach((v,i) => data.writeUInt16BE(v,26+i*2));
  data.writeUInt32BE(0x06071963,90);
  [0,0,40,1,256,6].forEach((v,i) => data.writeUInt16BE(v,94+i*2));
  const pointers = 114 + size + 1;
  data.writeUInt32BE(data.length - 1 - 90,106); data.writeUInt32BE(pointers - 90,110);
  let at = 115; // Initial last-byte literal is unused when every flag is set.
  for (let plane=0;plane<6;plane++) for(let column=0;column<40;column++) for(let y=0;y<256;y++) {
    let value=0;for(let bit=0;bit<8;bit++) if(screen.pixels[y*320+column*8+bit] & (1<<plane))value |= 128>>bit;
    data[at++]=value;
  }
  data[data.length-1]=255;
  return BankWriter.write([{number:8,type:'data',memory:'fast',permanent:true,name:'Pac.Pic.',data}]);
}
function font(filename, name) {
  const b = fs.readFileSync(filename), base = 32;
  // Pinned single-code-hunk FontEd files, TextFont at hunk+$3a; no general
  // executable loader or relocation is exposed to the browser.
  const u16 = at => b.readUInt16BE(at), u32 = at => b.readUInt32BE(at);
  if (u32(0)!==0x3f3 || u32(8)!==1 || u32(24)!==0x3e9 || u16(50)!==0x0f80 || u16(120)!==0 || u16(122)!==255) throw Error('ASM font layout changed');
  const height=u16(110), width=u16(114), baseline=u16(116), rowBytes=u16(128), rows=base+u32(124), loc=base+u32(130), spacing=u32(134), kern=u32(138);
  const data=new Uint8Array(256*height*Math.ceil(width/8)), advances=[];
  for(let c=0;c<256;c++) {
    const start=u16(loc+c*4), bits=u16(loc+c*4+2);
    if(bits>width || start+bits>rowBytes*8 || (kern && b.readInt16BE(base+kern+c*2)!==0))throw Error('Unsupported ASM font metrics');
    advances.push(spacing?b.readInt16BE(base+spacing+c*2):width);
    for(let y=0;y<height;y++)for(let x=0;x<bits;x++)if(b[rows+y*rowBytes+((start+x)>>3)] & (128>>((start+x)&7)))data[(c*height+y)*Math.ceil(width/8)+(x>>3)]|=128>>(x&7);
  }
  return {name,width,height,baseline,data,advances};
}
function prepare() {
  const assets=Object.create(null);
  const files=['SoundAuswahl.Pic','Level.Pic','Loading.Pic','Intro1.Pic','Intro2.Pic','Intro3.Pic','Intro4.Pic','Tronic.Anim','Zoom.Mus','ASMTit.Mus'];
  for(const name of files) {
    const filename=path.join(root,'intro',name);
    const bytes=/\.Pic$/.test(name)? (/^(SoundAuswahl|Level|Loading)/.test(name)?packed(bitmap(filename)):writeIlbm(bitmap(filename))):fs.readFileSync(filename);
    assets['asm:intro-graphics/'+name.toLowerCase()]=Buffer.from(bytes).toString('base64');
  }
  // No score file was supplied. Explicit empty initial table, not invented
  // historical scores; source still reads all thirty original fields.
  assets['asm:asm.scores']=Buffer.from(Array.from({length:10},()=> '\n\n0\n').join('')).toString('base64');
  return {assets,diskFonts:[font(path.join(root,'fonts/ASM-6'),'ASM.Font'),font(path.join(root,'fonts/ASM2-9'),'ASM2.Font')]};
}
module.exports={prepare,bitmap};
