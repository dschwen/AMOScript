'use strict';
// Shared, serialized input-only replay; reads state for assertions, never edits it.
module.exports=function asmMainReplay(p,clock,capture,check) {
  const line=()=>p.state.location&&p.state.location.line;
  let startup=false;
  const advance=ms=>{clock.tick(ms);if(!startup&&line()===1076){startup=true;const snapshot=p.display.snapshotDisplay(),row=79-snapshot.frame.origin.y;check((snapshot.frame.lineRegs[row*32+16]&2)===0,'Adjacent windows did not reserve the real setup row');capture('adjacent startup windows');}if(p.state.error)throw Error('ASM source error: '+p.state.error.message);};
  const until=(test,label)=>{for(let i=0;i<5000;i++){if(test())return;advance(4);}throw Error('ASM timeout '+label+' at '+line());};
  const click=(x=275,y=155)=>{p.setMouse(x,y,1);advance(40);p.setMouse(x,y,0);advance(60);};
  p.display.getDiscFonts(); // Declared host font enumeration inherited from intro.
  p.tick(1000);until(()=>line()===1701,'opening briefing');capture('opening briefing');
  click();until(()=>line()===1701,'second briefing');capture('second briefing');
  click();until(()=>line()===1113,'copy-protection prompt');
  check(p.state.variables.array_string_ereignis.values.get(65).includes('3. BUCHSTABEN'),'Expected deterministic original prompt for the third letter of ASM');capture('copy-protection prompt');
  p.sendKey('M');advance(40);until(()=>line()===1701,'accepted prompt');click();advance(100);
  capture('first room ready','initial');
  click(138,110);until(()=>line()===1701,'poster description');check(p.state.variables.int_geg1===1,'Original poster zone differs');capture('poster description');
  click();advance(100);
  click(145,247);check(p.state.variables.int_verb===4,'Ziehe command was not selected');capture('Ziehe selected');
  click(182,125);until(()=>p.state.variables.array_int_transport.values.get(2)===2,'handle pickup');advance(200);
  check([...p.state.variables.array_int_inventar.values.values()].includes(2),'Picked-up handle missing from inventory');capture('handle in inventory','handleRemoved');
  check(startup,'Startup contact-window checkpoint was not reached');
  check(p.currentDirectory()==='','Source directory prefix changed');
  return {room:p.state.variables.int_raum,handle:p.state.variables.array_int_transport.values.get(2)};
};
