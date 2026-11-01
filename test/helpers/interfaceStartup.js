'use strict';
const fs=require('fs'),path=require('path'),BufferReader=require('../../lib/Buffer');
const {binary,token:t}=require('./tokens');
const folder=path.join(__dirname,'../../examples/Tutorial/Tutorials/Interface');
// Declared first-level fixture: preserve original lines1..16 and replace the
// later dialogue script with a synthetic Wait Key, without changing assets.
function prefix(name='Graphics.AMOS'){
  if(name==='Full_Example.AMOS')throw Error('Full_Example has separate external music/sample dependencies');
  const original=fs.readFileSync(path.join(folder,name)),reader=new BufferReader(original),guard=binary([[t('Wait Key')]]).subarray(20);
  const source=Buffer.concat([original.subarray(0,reader.lines[16]),guard]);source.writeUInt32BE(source.length-20,16);return source;
}
// Preserve each original script construction and its first Dialog Open. The
// following execution/variable-access command is deliberately outside this fixture.
function channelPrefix(name){
  const lines={'Communication.AMOS':37,'Editing_Zones.AMOS':42,'Sliders.AMOS':50};
  if(!lines[name])throw Error('No declared channel prefix for '+name);
  const original=fs.readFileSync(path.join(folder,name)),reader=new BufferReader(original),guard=binary([[t('Wait Key')]]).subarray(20);
  const source=Buffer.concat([original.subarray(0,reader.lines[lines[name]]),guard]);source.writeUInt32BE(source.length-20,16);return source;
}
module.exports={prefix,channelPrefix,folder,resource:()=>fs.readFileSync(path.join(folder,'Example_Resource.Abk'))};
