/* jshint esversion: 6 */
'use strict';

// Input-only replay of the complete original source. No variable, IP or asset edits.
function replayWonderland(create, clock, files, makeInput, capture = () => {}) {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const p = create({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, files, print() {} });
  const input = makeInput(p), deaths = [], fades = new Set();
  let callbacks = 0, restarted = 0, previousLives = 3, stopped = false;
  const next = () => { check(++callbacks <= 1000, 'Original replay exceeded its callback budget'); check(clock.next(), 'Original replay lost its continuation'); };
  try {
    p.tick(100000); input.set('fire');
    for(let i=0;i<5;i++)next();
    check(p.state.variables.int_li===3 && p.state.location.line===204, 'Original game did not enter its first loop');
    capture('Original level 1',p);const startX=p.state.variables.int_x;input.set('left');
    for(let i=0;i<900;i++) {
      next();const v=p.state.variables,line=p.state.location.line;
      if(!stopped && i===20) {
        p.stop();check(clock.pending()===0 && p.joystickInfo('Joy',1)===0, 'Stop retained owned input or timers');
        p.resume();input.set('left');stopped=true;
      }
      if(v.int_li!==previousLives) {
        check(v.int_li===previousLives-1 && line===228, 'Death did not follow the original animation');
        deaths.push({lives:v.int_li,time:clock.now()});previousLives=v.int_li;capture(`Death: ${v.int_li} lives`,p);
      }
      if(line===237 && !fades.has(v.int_li)) {fades.add(v.int_li);capture(`Original fade: ${v.int_li} lives`,p);}
      if(line===204 && previousLives>0 && deaths.length>restarted) {restarted++;capture(`Restart: ${v.int_li} lives`,p);}
      if(previousLives===0 && line===66)break;
    }
    check(deaths.length===3 && fades.size===3 && restarted===2 && p.state.location.line===66, 'Original loss/restart/title path did not complete');
    input.set(null);capture('Original title after game over',p);const gameOverTime=clock.now();
    input.set('fire');
    for(let i=0;i<20 && p.state.location.line!==204;i++)next();
    input.set(null);
    check(p.state.location.line===204 && p.state.variables.int_li===3 && p.state.variables.int_lev===1, 'Original menu did not start a fresh game');
    capture('Original fresh game',p);
    return {deaths:deaths.map(item=>item.lives),restarts:restarted,fades:fades.size,gameOverTime,callbacks,stopResume:stopped,freshLives:3,startX};
  } finally {input.dispose();p.stop();check(clock.pending()===0,'Replay cleanup retained a timer');}
}
module.exports = replayWonderland;
