'use strict';
// Declared harness: original drum literals and untouched embedded sprite bank,
// with a synthetic three-phase sequencer instead of unavailable MOD effect-8 cues.
module.exports=function(){
 const fs=require('fs'),path=require('path'),{binary,token:t,integer:n,text,word:w}=require('./tokens'),oracle=require('../fixtures/amcaf/anim.json');
 const original=fs.readFileSync(path.join(__dirname,'../../examples/AMCAF/AMCAF_Examples/Protracker.AMOS'));
 if(require('crypto').createHash('sha256').update(original).digest('hex')!==oracle.sourceSha256)throw Error('AMCAF drum source differs');
 const lines=[[t('Screen Open'),n(0),t(','),n(320),t(','),n(200),t(','),n(4),t(','),t('Lowres')],[t('Hide')],[t('Curs Off')],[t('Flash Off')],[t('Get Sprite Palette')],[t('Palette'),n(0),t(','),n(0xfff),t(','),n(0x0f0),t(','),n(0xff0)]];
 for(const [channel,sprite,x,image]of [[0,0,112,1],[1,2,128,11],[2,6,176,6]])lines.push([t('Sprite'),n(sprite),t(','),t('X Hard'),t('('),n(x),t(')'),t(','),t('Y Hard'),t('('),n(64),t(')'),t(','),n(image)],[t('Channel'),n(channel),t('To'),t('Sprite'),n(sprite)]);
 lines.push([t('Do'),w(0)]);
 for(const names of [['hithihat','hitbass','clap'],['openhihat','hitsnare','clap'],['hithihat','hitboth','clap']]){
  for(const name of names){const c=oracle.cases.find(c=>c.name===name);lines.push([t('Anim'),n(c.channel),t(','),text(c.source)]);}
  lines.push([t('Anim On')],[t('Wait'),n(50)]);
 }
 lines.push([t('Loop')]);
 return Buffer.concat([binary(lines),original.subarray(20+original.readUInt32BE(16))]);
};
