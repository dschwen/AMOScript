/* jshint esversion: 6 */
'use strict';

// Exact original title/startup lines 1–64 and post-death lines 235–238
// (Screen 0, Fade 2, Wait 64, Wait Vbl), with a synthetic Wait Key trigger
// between slices and Wait Key / End guard afterward. All selected line bytes
// and banks are unchanged. This does not execute gameplay or the death routine.
module.exports = function wonderlandFade() {
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t}=require('./tokens');
  const source=fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Wonderland.AMOS'));
  const reader=new Reader(source),end=20+reader.code_bytes;
  const code=Buffer.concat([source.subarray(20,reader.lines[64]),binary([[t('Wait Key')]]).subarray(20),
    source.subarray(reader.lines[234],reader.lines[238]),binary([[t('Wait Key')],[t('End')]]).subarray(20)]);
  const header=Buffer.from(source.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,source.subarray(end)]);
};
