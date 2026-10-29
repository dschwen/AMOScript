'use strict';
// Original channel-20 setup and complete AMAL string. Declared level-1 bitmap
// replaces screen-2/game setup; an optional stationary original-image-25 Bob 1
// is a prepared collision fixture, not gameplay or an injected VM mutation.
module.exports = function planetZybexMissile(hit=false) {
  if(typeof hit!=='boolean')throw Error('Expected collision fixture boolean');
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,identifier:id}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/PlanetZybex/Zybex.AMOS')),r=new Reader(raw);
  const lines=(a,b)=>raw.subarray(r.lines[a-1],r.lines[b-1]+raw[r.lines[b-1]]*2),syn=rows=>binary(rows).subarray(20);
  const key=syn([[t('Wait Key')]]),prepared=hit?syn([[t('Bob'),n(1),t(','),n(243),t(','),n(91),t(','),n(25)]]):Buffer.alloc(0);
  const code=Buffer.concat([lines(245,247),lines(257,257),lines(263,276),prepared,syn([[id('frame'),t('='),n(0)]]),lines(1191,1191),lines(1302,1302),key,
    syn([[t('For'),[0,0],id('frame'),t('='),n(1),t('To'),n(80)]]),lines(255,255),lines(1301,1302),syn([[t('Next'),id('frame')]]),key]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]);
};
