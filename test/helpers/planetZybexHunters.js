'use strict';
// Original level-1 three-hunter setup/complete AMAL strings, on the world bitmap.
// A hidden screen 2 supplies the original coordinate-function geometry; prepared
// RN=250/RX=288/RW=130 replace player/scroll inputs. The key/eighty-pass loop is
// a declared fixture, not connected gameplay or VM-variable/IP patching.
module.exports = function planetZybexHunters() {
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,identifier:id}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/PlanetZybex/Zybex.AMOS')),r=new Reader(raw);
  const lines=(a,b)=>raw.subarray(r.lines[a-1],r.lines[b-1]+raw[r.lines[b-1]]*2),syn=rows=>binary(rows).subarray(20);
  const assign=(index,value)=>[t('Amreg'),t('('),n(index),t(')'),t('='),n(value)],key=syn([[t('Wait Key')]]);
  const setup=syn([[t('Screen Open'),n(2),t(','),n(320),t(','),n(160),t(','),n(16),t(','),t('Lowres')],[t('Screen Hide Number'),n(2)],[t('Screen'),n(1)],[t('Screen Offset'),n(1),t(','),n(320),t(','),n(0)],assign(13,250),assign(23,288),assign(22,130),[id('frame'),t('='),n(0)]]);
  const code=Buffer.concat([lines(245,247),lines(257,257),setup,lines(291,308),lines(1191,1191),lines(1302,1302),key,
    syn([[t('For'),[0,0],id('frame'),t('='),n(1),t('To'),n(80)]]),lines(255,255),lines(1301,1302),syn([[t('Next'),id('frame')]]),key]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]);
};
