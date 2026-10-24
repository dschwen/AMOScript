/* jshint esversion: 6 */
'use strict';

// Declared dispatch fixture: exact original On line 121 plus initredthing
// (575–577), initeye (633–635), and initsnake (649–651), including original banks.
// Synthetic inputs select one array element; a synthetic drawing/output suffix
// reports the result. Initblob/initgreenthing are explicit End guards, since their
// Rnd-dependent paths are not implemented. This is not enemy gameplay.
module.exports = function wonderlandDispatch(selector = 2) {
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,word:w,integer:n,identifier:id,text}=require('./tokens');
  const source=fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Wonderland.AMOS'));
  const reader=new Reader(source),end=20+reader.code_bytes;
  const array=name=>[id(name),t('('),n(0),t(')')];
  const prefix=binary([[t('Dim'),...['alt','xs','ys'].flatMap((name,i)=>[...(i?[t(',')]:[]),array(name)])],
    [array('alt'),t('='),n(selector)],[array('xs'),t('='),n(99)],[array('ys'),t('='),n(99)]]);
  const suffix=binary([[t('Print'),array('xs'),t(','),array('ys')],[t('Cls Colour'),n(0)],[t('Get Bob Palette')],
    [t('Ink'),n(2)],[t('Text'),n(8),t(','),n(16),t(','),text(`Original ${selector===2?'initredthing':selector===4?'initeye':selector===5?'initsnake':'dispatch'}`)],
    ...(selector===2||selector===4||selector===5?[[t('Paste Bob'),n(64),t(','),n(64),t(','),n(selector===2?39:selector===4?45:47)]]:[]),[t('End')],
    [id('initblob',0xc),t('End')],[id('initgreenthing',0xc),t('End')]]);
  const lines=(first,last)=>source.subarray(reader.lines[first-1],reader.lines[last]);
  const code=Buffer.concat([prefix.subarray(20),lines(121,121),suffix.subarray(20),lines(575,577),lines(633,635),lines(649,651)]);
  const header=Buffer.from(source.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,source.subarray(end)]);
};
