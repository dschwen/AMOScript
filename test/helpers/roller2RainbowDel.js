/* jshint esversion: 6 */
'use strict';
// Original line 557, including its HOPSCREEN call. The bounce is replaced by a
// declared Wait Key procedure guard; screens/overlapping rainbows are prepared.
module.exports=function roller2RainbowDel(){
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,word:w,identifier:id,text}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/Roller2/Roller II.AMOS')),r=new Reader(raw);
  const original=raw.subarray(r.lines[556],r.lines[556]+raw[r.lines[556]]*2),statements=lines=>binary(lines).subarray(20);
  const code=Buffer.concat([statements([[t('Screen Open'),n(1),t(','),n(320),t(','),n(256),t(','),n(16),t(','),t('Lowres')],
    [t('Cls Colour'),n(1)],[t('Colour'),n(1),t(','),n(0x135)],
    [t('Set Rainbow'),n(0),t(','),n(1),t(','),n(16),t(','),text(''),t(','),text(''),t(','),text('')],
    [t('For'),w(0),id('row'),t('='),n(0),t('To'),n(15)],
    [t('Rain'),t('('),n(0),t(','),id('row'),t(')'),t('='),id('row'),t('*'),n(0x111)],[t('Next'),id('row')],
    [t('Set Rainbow Colour'),n(1),t(','),n(1),t(','),n(16),t(','),text(''),t(','),text(''),t(','),text(''),t(','),n(0xf00)],
    [t('Rainbow'),n(1),t(','),n(0),t(','),n(250),t(','),n(10)],
    [t('Rainbow'),n(0),t(','),n(3),t(','),n(250),t(','),n(5)],[t('Screen'),n(0)]]),original,
    statements([[t('Wait Key')],[t('Rainbow Del')],[t('Wait Key')],[t('End')],
      [t('Procedure'),[0,0,0,0],w(0),0,0,id('hopscreen')],[t('Wait Key')],[t('End Proc')]])]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);return Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]);
};
