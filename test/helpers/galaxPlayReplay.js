'use strict';
// Input-only replay of the complete original game. No source/VM-state edits.
module.exports=function galaxPlayReplay(p,clock,capture=()=>{}) {
  const check=(value,message)=>{if(!value)throw Error(message);};
  p.tick(1000);clock.tick(6700);
  check(p.state.location.line===1025,'GALAX original menu missing');p.sendKey('1');
  let timeout=0;
  while(!p.amalSnapshot().some(c=>c.enabled) && timeout++<300)clock.tick(20);
  check(p.amalSnapshot().length===16 && p.state.location.line===635,'GALAX gameplay setup missing');
  const lives=p.state.variables.int_liv;
  check(lives===5,'GALAX initial lives differ');capture('Original GALAX game start');
  for(let field=0;field<180;field++) {
    p.setJoystick(1,field<40?8:field<80?20:field<120?4:16);clock.tick(20);
    if(field===20)check(p.spriteInfo('X Sprite',15)===330,'GALAX automatic right movement differs');
    if(field===40)check(p.spriteInfo('X Sprite',15)===398,'GALAX right boundary differs');
    if(field===60) {
      check(p.spriteInfo('X Sprite',15)===318,'GALAX left/fire movement differs');
      check(p.amreg(1)>0 && p.spriteInfo('Y Sprite',17)<227,'GALAX automatic shot missing');
    }
    if([20,60,100,160].includes(field))capture('Original GALAX play field '+(field+1));
    check(!p.state.halted,'GALAX halted during play');
  }
  check(p.state.variables.int_liv===lives-1,'GALAX death did not spend one life');timeout=0;
  while(!p.amalSnapshot().some(c=>c.enabled) && timeout++<300)clock.tick(20);
  check(p.amalSnapshot().length===16 && p.state.location.line===635,'GALAX next life did not restart');
  capture('Original GALAX next life');
  return{gameFields:180,lives:p.state.variables.int_liv,channels:p.amalSnapshot().length};
};
