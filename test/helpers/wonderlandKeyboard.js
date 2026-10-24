/* jshint esversion: 6 */
'use strict';

// Declared fixture: exact original input/Escape lines 130–135 and title routine
// 49–64. Synthetic screens, masks, bgon and an initial VBL allow key injection;
// path markers / Wait Key guards stop before menu/game/editor loops.
module.exports = function wonderlandKeyboard() {
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,integer:n,identifier:id}=require('./tokens');
  const source=fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Wonderland.AMOS'));
  const reader=new Reader(source),end=20+reader.code_bytes;
  const prefix=binary([
    [t('Screen Open'),n(0),t(','),n(320),t(','),n(200),t(','),n(16),t(','),t('Lowres')],
    [t('Screen Open'),n(1),t(','),n(320),t(','),n(32),t(','),n(16),t(','),t('Lowres')],
    [t('Screen'),n(0)],[id('bgon'),t('='),n(1)],
    [t('No Mask Image'),n(74)],[t('No Mask Image'),n(75)],[t('Wait Vbl')]]);
  const guard=route=>binary([[id('route'),t('='),n(route)],[t('Wait Key')],[t('End')]]).subarray(20);
  const lines=(first,last)=>source.subarray(reader.lines[first-1],reader.lines[last]);
  const code=Buffer.concat([prefix.subarray(20),lines(130,135),guard(1),lines(49,64),guard(2)]);
  const header=Buffer.from(source.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,source.subarray(end)]);
};
