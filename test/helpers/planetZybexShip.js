'use strict';
// Unchanged horizontal_ship, all eight original bullet programs and clear_amal.
// Declared hidden screen geometry, level=1, finite manual frame loop and an
// AMOS-side RZ trigger at frame 73 replace the omitted landscape/game loop.
module.exports=function planetZybexShip(){
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,identifier:id}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/PlanetZybex/Zybex.AMOS')),r=new Reader(raw);
  const lines=(a,b)=>raw.subarray(r.lines[a-1],r.lines[b-1]+raw[r.lines[b-1]]*2),syn=rows=>binary(rows).subarray(20);
  const setup=syn([[t('Set Sprite Buffer'),n(48)],[t('Hide On')],
    [t('Screen Open'),n(2),t(','),n(320),t(','),n(160),t(','),n(16),t(','),t('Lowres')],[t('Screen Hide Number'),n(2)],
    [id('level'),t('='),n(1)],[id('clear_amal',0x12)],[id('horizontal_ship',0x12)],[id('frame'),t('='),n(0)]]);
  const key=syn([[t('Wait Key')]]);
  const code=Buffer.concat([lines(97,97),lines(101,101),lines(245,247),lines(257,257),setup,lines(1191,1191),lines(1302,1302),key,
    syn([[t('For'),[0,0],id('frame'),t('='),n(1),t('To'),n(88)]]),lines(255,255),
    syn([[t('If'),[0,0],id('frame'),t('='),n(73)],[t('Amreg'),t('('),n(25),t(')'),t('='),n(1)],[t('Endif')]]),
    lines(1301,1302),syn([[t('Next'),id('frame')]]),key,syn([[t('End')]]),lines(220,238),lines(1043,1169)]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]);
};
