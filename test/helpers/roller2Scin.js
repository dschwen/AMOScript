/* jshint esversion: 6 */
'use strict';
// Prepared overlapping windows, colours/zones and gate around original pointer
// lines 341–342 and 344–346. Scrolling-mode line 343 and editor actions excluded.
module.exports = function roller2Scin() {
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,word:w}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/Roller2/Roller II.AMOS')),r=new Reader(raw);
  const lines=(a,b)=>raw.subarray(r.lines[a-1],r.lines[b-1]+raw[r.lines[b-1]]*2);
  const setup=[];
  for(const [screen,height,colour,rgb]of [[0,250,1,0x0f0],[1,128,2,0xf00]])setup.push(
    [t('Screen Open'),n(screen),t(','),n(screen?352:320),t(','),n(height),t(','),n(16),t(','),t('Lowres')],
    [t('Cls Colour'),n(colour)],[t('Colour'),n(0),t(','),n(0)],[t('Colour'),n(colour),t(','),n(rgb)],
    [t('Reserve Zone Number'),n(1)],[t('Set Zone'),n(1),t(','),n(screen?20:4),t(','),n(screen?12:4),t('To'),n(screen?36:20),t(','),n(screen?28:20)]);
  setup.push([t('Screen Display'),n(1),t(','),n(128),t(','),n(140),t(','),n(320),t(','),n(32)],
    [t('Screen Offset'),n(1),t(','),n(16),t(','),n(8)],[t('Screen To Front Number'),n(1)],[t('Screen'),n(0)],[t('Repeat'),w(0)],[t('Wait Key')]);
  const code=Buffer.concat([binary(setup).subarray(20),lines(341,342),lines(344,346),binary([[t('Until'),n(0)]]).subarray(20)]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+r.code_bytes)]);
};
