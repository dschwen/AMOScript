/* jshint esversion: 6 */
'use strict';
// Original missing-level line 480, or overwrite 490–491, on a prepared indexed
// pattern and original icon bank. WTIN/WTREL are explicit Wait Key procedure
// guards. Overwrite restoration is a declared synthetic Paste Icon preview.
module.exports=function roller2GetIcon(overwrite=false){
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,text,identifier:id,word:w}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/Roller2/Roller II.AMOS')),r=new Reader(raw);
  const line=number=>raw.subarray(r.lines[number-1],r.lines[number-1]+raw[r.lines[number-1]]*2),statements=lines=>binary(lines).subarray(20);
  const setup=[[t('Load'),text('icons')],[t('Make Icon Mask')],[t('Screen Open'),n(0),t(','),n(320),t(','),n(200),t(','),n(64),t(','),t('Lowres')],
    [t('Get Icon Palette')],[t('For'),w(0),id('row'),t('='),n(0),t('To'),n(199)],
    [t('Ink'),t('('),id('row'),t('*'),n(3),t(')'),t('Mod'),n(63),t('+'),n(1)],
    [t('Draw'),n(0),t(','),id('row'),t('To'),n(319),t(','),id('row')],[t('Next'),id('row')],
    [id('dr',6,2),t('='),text('RII:levl/')],[id('lv'),t('='),n(1)],[t('Wait Key')]];
  const middle=overwrite?[line(490),line(491),statements([[t('Wait Key')],[t('Paste Icon'),n(110),t(','),n(80),t(','),n(118)],[t('Wait Key')],[t('End')]])]:
    [line(480),statements([[t('End')],[id('edab',12)],[t('Wait Key')],[t('End')],
      [t('Procedure'),[0,0,0,0],w(0),0,0,id('wtin')],[t('Wait Key')],[t('End Proc')],
      [t('Procedure'),[0,0,0,0],w(0),0,0,id('wtrel')],[t('Wait Key')],[t('End Proc')]])];
  const code=Buffer.concat([statements(setup),...middle]),header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]);
};
