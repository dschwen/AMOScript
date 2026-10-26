/* jshint esversion: 6 */
'use strict';
// Original sample load 15 and ROUNDTURN 949–957. PHALT is a declared Return
// stub; BEWEG is a Wait Key guard. Direction, bitmap and entry gate are prepared.
module.exports=function roller2Edit(){
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,identifier:id,text}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/Roller2/Roller II.AMOS')),r=new Reader(raw);
  const lines=(a,b)=>raw.subarray(r.lines[a-1],r.lines[b-1]+raw[r.lines[b-1]]*2),statements=rows=>binary(rows).subarray(20);
  const code=Buffer.concat([lines(15,15),statements([[t('Open In'),n(1),t(','),text('direction')],[t('Input#'),n(1),t(','),id('dx'),t(','),id('dy')],[t('Close'),n(1)],
    [id('v'),t('='),n(0)],[id('fx'),t('='),n(1)],[t('Cls Colour'),n(1)],[t('Colour'),n(1),t(','),n(0x135)],[t('Ink'),n(2)],
    [t('Draw'),n(160),t(','),n(100),t('To'),n(160),t('+'),id('dx'),t('*'),n(40),t(','),n(100),t('+'),id('dy'),t('*'),n(40)],[t('Wait Key')]]),lines(949,957),
    statements([[t('End')],[id('beweg',0xc)],[id('guard',6,2),t('='),text('beweg')],[t('Wait Key')],[t('End')],[id('phalt',0xc)],[t('Return')]])]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);return Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]);
};
