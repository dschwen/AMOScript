'use strict';
module.exports = function extensionGraphicsProgram() {
  const {binary,token:t,integer:n,word:w} = require('./tokens');
  const ext = (offset,args) => [w(0x4e),[12,0],w(offset),args];
  const args = values => values.flatMap((v,i)=>[i?t(','):[],n(v)]);
  const bar = (a,b,c,d) => [t('Bar'),args([a,b]),t('To'),args([c,d])];
  const lines = [[t('Screen Open'),args([0,160,96,64]),t(','),t('Lowres')],[t('Curs Off')],[t('Flash Off')],[t('Cls Colour'),n(0)]];
  for(let i=0;i<32;i++)lines.push([t('Colour'),args([i,(i*83)&4095])]);
  lines.push(ext(0x036e,args([8,8,31])),[t('Wait Key')],
    ext(0x04fe,n(32)),[t('Ink'),n(63)],bar(0,0,19,19),ext(0x036e,args([8,8,2])),[t('Wait Key')],
    ext(0x04fe,n(0)),[w(0x1160),args([1,0,0,20,20,1])],[w(0x1190),args([1,40,0,48])],[t('Wait Key')],
    ext(0x04fe,n(-1)),[t('Cls Colour'),n(1)],[w(0x1190),args([1,80,0,32])],[t('Wait Key')],
    [t('Double Buffer')],ext(0x04fe,n(16)),[t('Ink'),n(16)],bar(0,32,19,51),ext(0x036e,args([8,40,5])),[w(0x1190),args([1,40,32,48])],[t('Wait Key')],
    [t('Screen Swap')],[t('Wait Key')]);
  const frames=[],size=160*96;let a=new Array(size).fill(0),b;
  const rectangle=(pixels,x,y,width,height,value)=>{for(let j=y;j<y+height;j++)for(let i=x;i<x+width;i++)pixels[j*160+i]=value;};
  const save=()=>frames.push({logical:a.slice(),physical:(b||a).slice()});
  a[8*160+8]=31;save();rectangle(a,0,0,20,20,32);a[8*160+8]=2;save();
  rectangle(a,40,0,20,20,32);a[8*160+48]=0;save();
  a.fill(1);rectangle(a,80,0,20,20,33);a[8*160+88]=1;save();
  b=a.slice();rectangle(a,0,32,20,20,17);rectangle(b,0,32,20,20,17);a[40*160+8]=b[40*160+8]=5;
  rectangle(a,40,32,20,20,33);a[40*160+48]=1;save();[a,b]=[b,a];save();
  return {bytes:binary(lines),frames};
};
