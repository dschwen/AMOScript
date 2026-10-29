'use strict';
// Original level load and initial player Sprite statement, followed by a
// declared image/allocation matrix. No ship input/animation program is run.
module.exports=function planetZybexSprites(){
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,identifier:id}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/PlanetZybex/Zybex.AMOS')),r=new Reader(raw);
  const lines=(a,b)=>raw.subarray(r.lines[a-1],r.lines[b-1]+raw[r.lines[b-1]]*2),syn=rows=>binary(rows).subarray(20);
  const sprite=(num,x,y,img)=>[t('Sprite'),n(num),t(','),n(x),t(','),n(y),t(','),n(img)];
  const stage=i=>[id('stage'),t('='),n(i)],off=[t('Sprite Off')],update=[t('Update')],key=[t('Wait Key')];
  const parts=[lines(245,247),lines(257,257),syn([[t('Set Sprite Buffer'),n(48)],[t('Hide On')],stage(0)]),lines(1129,1129),syn([update,key])];
  for(let i=1;i<13;i++)parts.push(syn([stage(i),sprite(15,176,124,i+1),update,key]));
  parts.push(syn([stage(13),off,sprite(15,176,70,1),sprite(16,176,100,2),sprite(17,176,130,3),update,key]));
  parts.push(syn([stage(14),off,sprite(0,176,70,1),sprite(15,240,70,12),update,key]));
  parts.push(syn([stage(15),off,[t('Show On')],sprite(15,176,124,1),update,key]));
  parts.push(syn([stage(16),off,update,key]));
  const code=Buffer.concat(parts),header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]);
};
