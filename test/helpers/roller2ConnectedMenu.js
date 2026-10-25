/* jshint esversion: 6 */
'use strict';

// Original executable sequence 1–316, retaining all reached procedures and
// omitting only unused procedure definitions/comments. Destinations record an
// outcome and wait; game selection runs original entry/setup/first-level load 565–600.
// The optional ready fixture adds GAMEDISP/MWAIT and original 601–608, guarding
// before ball/sprite/gameplay setup. The ball fixture adds BALLFARBEN/BDRAW
// and extends through 617. Input adds original JOAB through 639; movement adds
// BEWEG/THE_MOVING, PHALT/GSPHALTJOAB and Lasttest, guarding other SASINIT
// handlers. Colours adds BCL/GAMED/KCWEG/HCWEG and guards ZAEHLHOCH bonus
// scoring before level loading. Other selected routines remain excluded.
module.exports = function roller2ConnectedMenu({ready = false, ball = false, input = false, movement = false, colours = false} = {}) {
  movement = movement || colours;
  input = input || movement;
  ball = ball || input;
  ready = ready || ball;
  const fs=require('fs'),path=require('path'),Reader=require('../../lib/Buffer');
  const {binary,token:t,text,identifier:id}=require('./tokens');
  const raw=fs.readFileSync(path.join(__dirname,'../../examples/Roller2/Roller II.AMOS')),reader=new Reader(raw);
  const lines=(first,last)=>raw.subarray(reader.lines[first-1],reader.lines[last-1]+raw[reader.lines[last-1]]*2);
  const targets=[['rollergame','game'],['rollereditor','editor'],['highausw','scores'],['help','help'],['backfromgame','backfromgame'],['you_won','win']];
  if (input) targets.push(...(movement?[]:[['beweg','move']]),['pause','pause'],['ipause','ipause'],['game_over','timeout']);
  if (colours) targets.push(['zaehlhoch','level-bonus']);
  if (movement) for (const name of new Set(Object.values(require('../fixtures/roller2/initialization.json').handlers).map(name=>name.toLowerCase()))) {
    if (!['the_moving','gsphaltjoab',...(colours?['kcweg','hcweg']:[])].includes(name) && !targets.some(([label])=>label===name)) targets.push([name,`tile:${name}`]);
  }
  const guards=targets.map(([label,action])=>Buffer.concat([label==='rollergame'?lines(565,movement?661:input?639:ball?617:ready?608:600):binary([[id(label,0xc)]]).subarray(20),
    binary([[id('selection',6,2),t('='),text(action)],[t('Wait Key')],[t('End')]]).subarray(20)]));
  const code=Buffer.concat([lines(1,71),...(ready?[lines(72,86),lines(153,155)]:[]),...(ball?[lines(87,102),lines(197,204)]:[]),...(colours?[lines(103,115)]:[]),lines(163,165),lines(205,246),lines(275,316),binary([[t('End')]]).subarray(20),...guards,...(movement?[lines(663,676),lines(959,961),lines(1181,1187)]:[]),...(colours?[lines(743,765)]:[])]);
  const header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(code.length,16);
  return Buffer.concat([header,code,raw.subarray(20+reader.code_bytes)]);
};
