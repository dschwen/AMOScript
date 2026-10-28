'use strict';
// Declared presentation fixture: original score/playfield setup, world-1 load,
// board-copy/priority statements, and both original score update statements.
// Prepared score/lives/scroll inputs and Wait Key guards replace the game loop;
// Default/AMAL/manual Update and gameplay do not execute here.
module.exports = function planetZybexScore() {
  const fs = require('fs'), path = require('path'), BufferReader = require('../../lib/Buffer');
  const { binary, token:t, integer:n, identifier:id } = require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/PlanetZybex/Zybex.AMOS')),reader=new BufferReader(raw);
  const lines=(first,last)=>raw.subarray(reader.lines[first-1],reader.lines[last-1]+raw[reader.lines[last-1]]*2);
  const synthetic=rows=>binary(rows).subarray(20), assign=(name,value)=>[id(name),t('='),n(value)], key=()=>synthetic([[t('Wait Key')]]);
  const setup=synthetic([[t('Screen Close'),n(0)],assign('lives',5),assign('lop',0),[t('Amreg'),t('('),n(9),t(')'),t('='),n(1234)]]);
  const code=Buffer.concat([setup,lines(111,128),lines(245,249),lines(1207,1209),lines(1252,1252),synthetic([[t('Screen Swap Number'),n(2)]]),lines(1310,1313),key(),
    synthetic([assign('lives',4),[t('Amreg'),t('('),n(9),t(')'),t('='),n(9876)]]),lines(1482,1485),key()]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+reader.code_bytes)]);
};
