'use strict';
// Complete unchanged program. Host input, clock and Stop/Resume only.
function replayPlanetZybex(create,clock,files,makeInput,capture=()=>{},audio=null,standard='PAL'){
  const check=(v,m)=>{if(!v)throw Error(m);};
  const p=create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files,print(){},audio,
    vblHz:standard==='PAL'?50:60,audioStandard:standard,displayOptions:{snapshotStandard:standard}});
  const input=makeInput(p),update=p.update,deaths=[],restarts=[];
  let frames=0,steps=0,previousLives=5,stopResume=false;
  p.update=()=>{update();frames++;};
  const next=()=>{check(++steps<20000,'Zybex replay exceeded its time budget');clock.tick(1);check(!p.state.halted,'Zybex unexpectedly halted');};
  const until=predicate=>{while(!predicate())next();};
  const snap=(name)=>capture(name,p,{frame:frames,lives:p.state.variables.int_lives});
  try{
    input.set(0);p.tick(10000);
    until(()=>frames===1);snap('First field');
    for(const target of [5,6,10,15,20,25]){
      until(()=>frames===target);
      if([6,15,25].includes(target))snap(`Field ${target}`);
      if(target===5)input.set(8);
      if(target===15)input.set(17);
      if(target===20)check(p.bobInfo('Y Bob',1)>0,'Original bullet did not launch');
      if(target===25)input.set(0);
      if(target===10){
        input.set(0);p.stop();const ip=p.state.ip,old=frames;
        check(clock.pending()===0 && p.joystickInfo('Joy',1)===0,'Stop retained input or timers');
        clock.tick(100);check(frames===old && p.state.ip===ip,'Stopped game advanced');p.resume();input.set(8);stopResume=true;
      }
    }
    let pendingRestart=null;
    until(()=>{
      const lives=p.state.variables.int_lives;
      if(lives!==previousLives){
        check(lives===previousLives-1,'Life loss did not follow the original order');
        check(p.amreg(24)===99,'Life loss bypassed the original explosion');
        deaths.push(lives);previousLives=lives;
        if(lives)pendingRestart={lives,frame:frames};
      }
      if(pendingRestart && frames>pendingRestart.frame){
        check(p.spriteInfo('X Sprite',15)===176 && p.spriteInfo('Y Sprite',15)===124 && p.amalSnapshot().length===17,'Original life restart did not rebuild the ship/enemies');
        restarts.push(pendingRestart.lives);snap(`Restart with ${pendingRestart.lives} lives`);pendingRestart=null;
      }
      return lives===0 && p.state.location.line===172;
    });
    check(deaths.join(',')==='4,3,2,1,0' && restarts.join(',')==='4,3,2,1','Original loss/restart sequence incomplete');
    check(p.amalSnapshot().length===0 && p.spriteInfo('I Sprite',15)===0,'Game over retained AMAL/Sprite output');snap('Game over');
    const before=frames;input.set(0);input.key('a');
    until(()=>p.state.variables.int_lives===5 && frames>before);
    check(p.state.variables.int_level===1 && p.spriteInfo('X Sprite',15)===176 && p.spriteInfo('Y Sprite',15)===124 && p.amalSnapshot().length===17,'Game-over input did not start a fresh game');snap('Fresh game');
    return {deaths,restarts,frames,stopResume,freshLives:5,freshLevel:1};
  }finally{input.dispose();p.stop();check(clock.pending()===0,'Zybex replay cleanup retained timers');}
}
module.exports=replayPlanetZybex;
