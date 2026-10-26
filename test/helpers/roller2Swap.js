/* jshint esversion: 6 */
'use strict';
// Original arrays/defaults 32–43, insertion 1066–1067 and sorting 1069–1076.
// Entry input, Print Using table and Wait Key gates are declared previews;
// original name entry, loaded scores, scoresave and subsequent menu are excluded.
module.exports=function roller2Swap(){
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,identifier:id,text,word:w}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/Roller2/Roller II.AMOS')),r=new Reader(raw);
  const lines=(a,b)=>raw.subarray(r.lines[a-1],r.lines[b-1]+raw[r.lines[b-1]]*2),statements=rows=>binary(rows).subarray(20);
  const preview=()=>statements([[id('preview',0x12)],[t('Wait Key')]]);
  const code=Buffer.concat([lines(32,43),statements([[t('Open In'),n(1),t(','),text('entry')],[t('Input#'),n(1),t(','),id('hi')],
    [t('Line Input#'),n(1),t(','),id('nampl',6,2)],[t('Close'),n(1)]]),preview(),lines(1066,1067),preview(),lines(1069,1076),preview(),
    statements([[t('End')],[t('Procedure'),[0,0,0,0],w(0),0,0,id('preview')],[t('Cls Colour'),n(0)],[t('Paper'),n(0)],[t('Pen'),n(2)],
      [t('Locate'),n(0),t(','),n(1)],[t('Centre'),text('Roller II scores')],[t('For'),w(0),id('row'),t('='),n(1),t('To'),n(11)],
      [t('Locate'),n(2),t(','),id('row'),t('+'),n(3)],
      [t('Print'),t('Using'),text('##'),t(';'),id('row'),t(';'),text(' '),t(';'),t('Using'),text('-##########'),t(';'),id('scr'),t('('),id('row'),t(')'),t(';'),text(' '),t(';'),id('hi',6,2),t('('),id('row'),t(')')],
      [t('Next'),id('row')],[t('End Proc')]])]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);return Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]);
};
