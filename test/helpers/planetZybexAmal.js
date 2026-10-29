'use strict';
// Original Bob 21 and complete three-string AMAL program, on the level-1
// background instead of the omitted connected game/screen-2 setup. Declared
// RX=260/RN=0 admits the drop; synthetic loop/key guards call original manual
// housekeeping once per Wait Vbl. No VM/IP/bank patching or AMAL substitutions.
module.exports = function planetZybexAmal() {
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,identifier:id}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/PlanetZybex/Zybex.AMOS')),r=new Reader(raw);
  const lines=(a,b)=>raw.subarray(r.lines[a-1],r.lines[b-1]+raw[r.lines[b-1]]*2),syn=rows=>binary(rows).subarray(20);
  const assign=(index,value)=>[t('Amreg'),t('('),n(index),t(')'),t('='),n(value)],key=syn([[t('Wait Key')]]);
  const code=Buffer.concat([lines(245,247),lines(257,257),syn([assign(23,260),assign(13,0),[id('frame'),t('='),n(0)]]),lines(279,284),lines(1191,1191),lines(1302,1302),key,
    syn([[t('For'),[0,0],id('frame'),t('='),n(1),t('To'),n(13)]]),lines(255,255),lines(1301,1302),syn([[t('Next'),id('frame')]]),key]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]);
};
