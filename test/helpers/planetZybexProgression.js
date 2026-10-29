'use strict';
// Frozen joystick presses only. Observation never modifies VM state or assets.
function replayPlanetZybexProgression(create,clock,files,makeInput,inputs,capture=()=>{},audio=null,standard='PAL'){
  const check=(v,m)=>{if(!v)throw Error(m);},route=[];
  for(const[mask,count]of inputs.segments){check(Number.isInteger(mask)&&mask>=0&&mask<=31&&Number.isInteger(count)&&count>0,'Invalid progression input');for(let i=0;i<count;i++)route.push(mask);}
  const p=create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files,print(){},audio,vblHz:standard==='PAL'?50:60,audioStandard:standard,displayOptions:{snapshotStandard:standard}});
  const input=makeInput(p),update=p.update,docking=[],scenes=new Map([[1,'Departure'],[300,'Enemy corridor'],[600,'Dock approach'],[640,'Scroll limit'],[701,'Dock reached'],[702,'Dock hold'],[703,'Dock image 20'],[704,'Dock image 21'],[705,'Dock image 22']]);
  const verticalScenes=new Map([[1,'Vertical entry'],[6,'Vertical up'],[11,'Vertical left'],[16,'Vertical hold'],[25,'Vertical scroll']]);
  let frames=0,vertical=0,steps=0,held=-1,previous=0,paused=false,bank1=null,bank2=null;
  p.update=()=>{update();frames++;if(p.state.variables.int_level===2)vertical++;};
  const set=mask=>{if(mask!==held){input.set(mask);held=mask;}};
  try{
    set(route[0]);p.tick(10000);
    while(vertical<25){
      check(++steps<24000,'Progression replay exceeded its time budget');
      const level=p.state.variables.int_level;
      set(level===1?route[Math.min(frames,route.length-1)]:vertical<5?16:vertical<10?17:vertical<15?20:16);
      clock.tick(1);check(!p.state.halted&&p.amreg(24)!==99&&p.state.variables.int_lives===5,'Progression lost the ship');
      if(frames===previous)continue;previous=frames;
      const name=vertical?verticalScenes.get(vertical):scenes.get(frames);
      if(name){
        check(p.state.variables.int_level===(vertical?2:1),'Wrong progression level');
        if(frames===1)bank1=p.banks.get(10);
        if(frames===701){check(p.amreg(13)===640&&p.spriteInfo('X Sprite',15)===336&&p.spriteInfo('Y Sprite',15)===174,'Dock zone was not reached');}
        if(frames>=703&&frames<=705){docking.push(p.spriteInfo('I Sprite',15));check(p.amalSnapshot().every(c=>c.number!==15),'Docking retained ship AMAL');}
        if(vertical===1){bank2=p.banks.get(10);check(bank1!==bank2&&p.display.screen(1).width===320&&p.display.screen(1).height===640&&p.amalSnapshot().length===18,'Vertical setup did not replace world/animations');}
        capture(name,p,{frame:frames,vertical,lives:5,score:p.state.variables.int_score});
      }
      if(frames===300&&!paused){
        set(0);p.stop();const old=p.state.ip;check(clock.pending()===0&&p.joystickInfo('Joy',1)===0,'Stop retained input/timers');clock.tick(100);check(p.state.ip===old&&frames===300,'Stopped progression advanced');p.resume();held=-1;paused=true;
      }
    }
    check(frames===730&&docking.join(',')==='20,21,22'&&p.amreg(13)===25&&p.spriteInfo('X Sprite',15)===311&&p.spriteInfo('Y Sprite',15)===149&&p.spriteInfo('I Sprite',15)===22&&p.state.variables.int_score===470,'Original docking/vertical trace differs');
    return{frames,verticalFrames:vertical,docking,lives:5,level:2,score:470,stopResume:paused};
  }finally{input.dispose();p.stop();check(clock.pending()===0,'Progression cleanup retained timers');}
}
module.exports=replayPlanetZybexProgression;
