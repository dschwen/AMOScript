'use strict';
// Independent regions and transcribed axis vectors for original integer
// R0=80, N=5. No production math, graphics or image reader is imported.
module.exports=function checkBumpPixels(pixels,source){
  if(pixels.length!==320*256||source.length!==320*256)throw Error('Unexpected Bump bitmap size');
  let checked=0;
  const check=(x,y,sx,sy)=>{if(pixels[y*320+x]!==source[sy*320+sx])throw Error(`Independent Bump pixel differs ${x},${y}`);checked++;};
  for(let y=0;y<200;y++)for(let x=0;x<320;x++)if((x-160)**2+(y-100)**2>81**2)check(x,y,x,y);
  for(let y=200;y<256;y++)for(let x=0;x<320;x++){if(pixels[y*320+x]!==0)throw Error('Bump wrote below its source loop');checked++;}
  // Integer degree angles 67,45,22 produce scale factors 451,349,279.
  for(const [at,mapped]of [[180,195],[140,125],[200,214],[120,106],[220,225],[100,95]])check(at,100,mapped,100);
  for(const [at,mapped]of [[120,135],[80,65],[140,154],[60,46],[160,165],[40,35]])check(160,at,160,mapped);
  return checked;
};
