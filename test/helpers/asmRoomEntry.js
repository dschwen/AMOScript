'use strict';
module.exports=function asmRoomEntry(p,clock,room){
  p.display.getDiscFonts();p.tick(1000);
  for(let i=0;i<8000;i++){
    if(p.state.error)throw Error('Room '+room+': '+p.state.error.message);
    if(p.state.waiting==='key'&&p.state.location.line===13){
      if(p.state.variables.int_raum!==room)throw Error('Wrong room entry');
      if(p.display.screenIn(200,120)!==0)throw Error('Room artwork intercepted interactive screen');
      return;
    }
    if(p.state.location.line===1701){p.setMouse(275,155,1);clock.tick(40);p.setMouse(275,155,0);clock.tick(60);}
    else clock.tick(4);
  }
  throw Error('Room '+room+' entry timed out at '+JSON.stringify(p.state.location));
};
