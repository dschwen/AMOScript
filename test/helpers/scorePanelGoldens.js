/* jshint esversion: 6 */
'use strict';

// Independent panel composition over the independently decoded ILBM PNG.
// Literal public-domain font8x8 digit input rows, with a separate rasterizer;
// no production formatter, font factory or drawing code is used here.
module.exports=function scorePanelGoldens(){
  const fs=require('fs'),path=require('path'),{decodePng}=require('./displayPng');
  const png=decodePng(fs.readFileSync(path.join(__dirname,'../fixtures/wonderland/Score_Panel.Iff.png')));
  const iff=fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Score_Panel.Iff'));
  let colours;
  for(let at=12;at<iff.length;){const size=iff.readUInt32BE(at+4);
    if(iff.toString('ascii',at,at+4)==='CMAP'){colours=[0,3].map(index=>[0,1,2].map(c=>(iff[at+8+index*3+c]>>4)*17).concat(255));break;}
    at+=8+size+(size&1);
  }
  if(!colours)throw new Error('Missing expected panel palette');
  const rows=['3e63737b6f673e00','0c0e0c0c0c0c3f00','1e33301c06333f00','1e33301c30331e00','383c36337f307800',
    '3f031f3030331e00','1c06031f33331e00','3f3330180c0c0c00','1e33331e33331e00','1e33333e30180e00'].map(hex=>Buffer.from(hex,'hex'));
  const cases=[{level:1,score:0,levelText:'1',scoreText:'     0'},
    {level:5,score:12345,levelText:'5',scoreText:' 12345'},
    {level:12,score:1234567,levelText:'2',scoreText:'234567'},
    {level:-1,score:-42,levelText:'1',scoreText:'    42'},
    {level:3,score:-2147483648,secondLevelLine:true,levelText:'3',scoreText:'483648'}];
  return cases.map(item=>{
    const rgba=Uint8Array.from(png.rgba.subarray(0,640*32*4));
    for(const [column,chars]of [[36,item.levelText],[1,item.scoreText]])for(let index=0;index<chars.length;index++){
      const glyph=chars[index]===' '?new Uint8Array(8):rows[Number(chars[index])];
      for(let y=0;y<8;y++)for(let x=0;x<8;x++)for(let sample=0;sample<2;sample++){
        const at=((16+y)*640+(column*8+index*8+x)*2+sample)*4;
        rgba.set(colours[(glyph[y]>>x)&1],at);
      }
    }
    return {...item,rgba};
  });
};
