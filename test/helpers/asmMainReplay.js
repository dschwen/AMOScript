'use strict';
// Shared, serialized input-only replay; reads state for assertions, never edits it.
module.exports=function asmMainReplay(p,clock,capture,check,commands=false,explore=false) {
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
  if(commands){
    click(140,220);const bar=p.display.screen(1).pixels.slice(0,320*8);
    for(const [x,y] of [[140,220],[140,229],[140,238],[140,247],[140,256],[140,274],[140,283],[140,292],[195,220]]){click(x,y);capture('command '+p.state.variables.int_verb);}
    click(140,220);check(p.display.screen(1).pixels.slice(0,320*8).every((v,i)=>v===bar[i]),'Command bar retains old letters');capture('command bar restored');
    click(195,229);until(()=>p.state.variables.int_raum===2&&line()>=14&&line()<=58,'room 2 parser');advance(100);check(p.state.variables.int_raum===2,'Zurück did not enter room 2');capture('room 2');
    check(p.display.screenIn(338,110)===0,'Artwork screen obscures interactive screen after Unpack');
    click(140,229);click(340,125);until(()=>p.state.variables.array_int_flag.values.get(6)===1,'room 2 door opens');advance(100);capture('room 2 door open');
    click(140,238);click(340,125);until(()=>p.state.variables.array_int_flag.values.get(6)===0,'room 2 door closes');advance(100);capture('room 2 door closed');
    click(140,229);click(340,125);until(()=>p.state.variables.array_int_flag.values.get(6)===1,'room 2 door reopens');advance(100);capture('room 2 door reopened');
    click(195,220);check(p.state.variables.int_verb===10,'Gehe command not selected');click(340,125);
    until(()=>p.state.variables.int_raum===3&&line()>=14&&line()<=58,'room 3 parser');advance(100);capture('room 3 ready','room3Initial');
    check(p.display.screenIn(276,159)===0,'Room 3 artwork obscures its clickable screen');
    click(140,229);click(276,159);until(()=>p.state.variables.array_int_flag.values.get(11)===1,'room 3 drawer opens');advance(100);capture('room 3 drawer open','room3DrawerOpen');
    click(140,238);click(276,159);until(()=>p.state.variables.array_int_flag.values.get(11)===0,'room 3 drawer closes');advance(100);capture('room 3 drawer closed','room3Initial');
    click(195,229);until(()=>p.state.variables.int_raum===2&&line()>=14&&line()<=58,'room 2 return parser');advance(100);capture('returned to room 2');

  }
  if(explore){
    const v=p.state.variables,visited=new Set([1,2,3]);
    const atParser=room=>v.int_raum===room&&((line()>=14&&line()<=58)||(line()>=262&&line()<=276));
    const settle=room=>{for(let i=0;i<12000;i++){if(atParser(room)){advance(100);visited.add(room);return;}if(line()===1701)click();else advance(4);}throw Error('ASM map timeout room '+room+' at '+line());};
    const act=(verb,x,y)=>{click(verb<=9?140:195,209+(verb<=9?verb:verb-9)*9+3);click(x,y);advance(100);};
    const go=(x,y,room,label)=>{act(10,x,y);settle(room);if(label)capture(label);};
    const back=room=>{click(195,229);settle(room);};
    act(1,380,135);for(let i=0;i<8000&&v.array_int_transport.values.get(33)!==2;i++){if(line()===1701)click();else advance(4);}
    check(v.array_int_transport.values.get(33)===2,'Original cabinet did not yield the key');settle(2);capture('key found');
    back(1);capture('room 1 with key');
    act(7,308,235);click(208,130);settle(1);check(v.array_int_transport.values.get(2)===1,'Handle was not reattached');capture('handle reattached');
    act(7,260,235);click(208,130);until(()=>line()===1701,'key unlock message');click();settle(1);check(v.array_int_flag.values.get(1)===0,'Office door did not unlock');capture('office door unlocked');
    act(2,208,130);until(()=>line()===1701,'office door story');click();settle(1);capture('office door open');
    go(208,130,4,'room 4 corridor');
    act(2,238,130);go(238,130,5,'room 5 office');back(4);
    act(2,251,140);go(251,140,6,'room 6 darkroom');
    act(4,260,147);act(4,278,120);act(2,278,120);check(v.array_int_flag.values.get(24)===2&&v.array_int_flag.values.get(25)===1,'Darkroom door puzzle did not complete');capture('darkroom door mechanism');
    go(278,120,10,'room 10 landing');go(400,200,13,'room 13 landing');act(2,330,130);go(330,130,12,'room 12 archive');back(13);go(400,200,15,'room 15 street');
    go(180,160,19,'room 19 recovered bookshop');back(15);
    act(2,253,140);go(253,140,17,'room 17 basement');back(15);
    act(2,435,140);act(10,435,140);click(265,145);settle(16);capture('room 16 recovered supermarket');back(15);
    act(10,435,140);click(300,145);settle(15);check(v.array_int_handlung.values.get(4)===0,'Expected original hospital story gate');capture('hospital story gate retained');
    back(14);capture('room 14 courtyard');go(190,130,15);go(253,90,13);back(10);back(6);back(4);
    act(2,296,140);go(296,140,7,'room 7 stairs');go(340,90,8,'room 8 attic office');act(2,260,120);go(260,120,9,'room 9 roof');back(8);back(7);go(338,190,11,'room 11 terrace');back(7);back(4);capture('returned to room 4');
    check(visited.size===18,'Natural replay did not visit all eighteen expected rooms');
    return {room:v.int_raum,handle:v.array_int_transport.values.get(2),roomsVisited:visited.size};
  }
  return {room:p.state.variables.int_raum,handle:p.state.variables.array_int_transport.values.get(2)};
};
