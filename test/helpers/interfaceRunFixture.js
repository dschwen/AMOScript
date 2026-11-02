/* jshint esversion: 6 */
'use strict';
const fs=require('fs'),path=require('path'),BufferReader=require('../../lib/Buffer'),TokenReader=require('../../lib/TokenReader');
const startup=require('./interfaceStartup'),{binary,token:t,integer:n,text,identifier:v}=require('./tokens');
const run=(id,label)=>[t('Dialog Run Label'),t('('),n(id),t(','),n(label),t(')')];
function append(prefix,lines){const reader=new BufferReader(prefix),guard=reader.lines[reader.lines.length-1],source=Buffer.concat([prefix.subarray(0,guard),binary(lines).subarray(20)]);source.writeUInt32BE(source.length-20,16);return source;}
function originals(){
  const raw=fs.readFileSync(path.join(startup.folder,'Graphics.AMOS')),reader=new BufferReader(raw),cut=Buffer.from(raw.subarray(0,reader.lines[106]));cut.writeUInt32BE(cut.length-20,16);
  const strings=new TokenReader(new BufferReader(cut)).read().filter(tok=>tok.name==='string'&&(tok.location.line===34||(tok.location.line>=71&&tok.location.line<=83)));
  if(strings.length!==14)throw Error('Original Graphics rectangle excerpt changed');return strings.map(tok=>tok.value);
}
function shapes(){
  const parts=['LA1;',...originals(),'EX;LA2;BA0,0;',"PR16,8,'Dialog Run: original Graphics rectangle excerpt',7;",'SV0,2 3+;EX;'];
  return append(startup.prefix(),[[v('I',6,2),t('='),text('')],...parts.map(part=>[v('I',6,2),t('='),v('I',6,2),t('+'),text(part)]),[t('Dialog Open'),n(1),t(','),v('I',6,2)],[v('RESULT'),t('='),run(1,1)],[t('Wait Key')],[v('RESULT'),t('='),run(1,2)],[t('Wait Key')]]);
}
function arrays(){
  return append(startup.arrayPrefix(),[[t('Dialog Open'),n(2),t(','),text("BA16,8;PR0,0,'Native AS upper bound:',7;PR176,0,0VA AS #,7;PR0,16,0VA 0 AR,7;SV1,0VA 99 AR;PR0,32,1VA,7;EX;")],
    [t('Vdialog'),t('('),n(2),t(','),n(0),t(')'),t('='),t('Vdialog'),t('('),n(1),t(','),n(0),t(')')],[v('RESULT'),t('='),run(2,-1)],[t('Wait Key')]]);
}
module.exports={shapes,arrays,originals,resource:startup.resource};
