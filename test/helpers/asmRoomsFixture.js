'use strict';
// Declared room-entry fixture: original setup/DATA and INITRAUM, without the
// opening messages. Room selection is a synchronous input file, not a VM edit.
module.exports=function asmRoomsFixture(loadDialogue=false){
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,text,identifier:id}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/ASM/ASM.current.AMOS')),reader=new Reader(raw);
  const line=parts=>binary([parts]).subarray(20),code=[];
  for(let i=0;i<reader.lines.length;i++){
    const at=reader.lines[i],number=i+1;
    if(number===13)code.push(line([t('Open In'),n(2),t(','),text('fixture:room'),t(':'),t('Input#'),n(2),t(','),id('r'),t(':'),t('Close'),n(2),t(':'),t('Gosub'),id('initraum',0x18),t(':'),...(loadDialogue?[id('unterhaltung_laden',0x12),t('['),id('r'),t(']'),t(':')]:[]),t('Wait Key'),t(':'),t('End')]));
    else if(number===1110)code.push(line([t('Return')]));
    else if(number>=1111&&number<=1114)code.push(line([]));
    else code.push(raw.subarray(at,at+raw[at]*2));
  }
  const data=Buffer.concat(code),header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(data.length,16);
  return Buffer.concat([header,data,raw.subarray(20+reader.code_bytes)]);
};
