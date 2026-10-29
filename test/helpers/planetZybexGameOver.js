'use strict';
// Original 189–199 on declared blank screen 2, then explicit comparison modes
// replay original 193–199. These key guards do not execute finish_message's
// AMAL/audio/fade/manual-update or score-message paths.
module.exports = function planetZybexGameOver() {
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer'),{binary,token:t,integer:n,identifier:id}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/PlanetZybex/Zybex.AMOS')),r=new Reader(raw);
  const lines=(a,b)=>raw.subarray(r.lines[a-1],r.lines[b-1]+raw[r.lines[b-1]]*2),synthetic=rows=>binary(rows).subarray(20);
  const key=synthetic([[t('Wait Key')]]),stage=value=>[id('stage'),t('='),n(value)];
  const setup=synthetic([[t('Screen Close'),n(0)],[t('Screen Open'),n(2),t(','),n(320),t(','),n(160),t(','),n(16),t(','),t('Lowres')],[t('Curs Off')],[t('Flash Off')],[t('Cls Colour'),n(0)],[t('Ink2'),n(2),t(','),n(0)],stage(0)]);
  const code=Buffer.concat([setup,lines(189,199),key,synthetic([[t('Gr Writing'),n(1)],stage(1)]),lines(193,199),key,synthetic([[t('Gr Writing'),n(0)],stage(2)]),lines(193,199),key]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]);
};
