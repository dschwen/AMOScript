/* jshint esversion: 6 */
'use strict';

// The native Menu$ object language (+Lib.s MnObjet/ObJumps). This is an
// indexed drawing stream, separate from the Interface dialogue language.
function createMenuGraphics() {
  const definitions={BA:[8,2],LI:[12,2],EL:[16,2],PA:[20,1],IN:[24,2],BO:[28,1],IC:[32,1],LO:[36,2],OU:[40,1],SL:[44,1],SF:[48,1],PR:[52,'name'],RE:[56,1],SS:[60,1]};
  const fail=message=>{throw Error('Menu graphics: '+message);};
  function parse(text) {
    if(typeof text!=='string' || text.length>32766 || /[^\x00-\xff]/.test(text))fail('expected a bounded byte string');
    const commands=[];let at=0;
    while(at<text.length){
      const open=text.indexOf('(',at),end=open<0?text.length:open;
      if(end>at)commands.push({code:4,text:text.slice(at,end)});
      if(open<0)break;
      const close=text.indexOf(')',open+1);if(close<0)fail('unterminated command');
      const group=text.slice(open+1,close).split(':');
      for(const source of group){const word=/^\s*([a-zA-Z]{2,})\s*([\s\S]*)$/.exec(source);if(!word)fail('invalid command');const name=word[1].slice(0,2).toUpperCase(),definition=definitions[name];if(!definition)fail('unsupported command '+name);
        if(definition[1]==='name'){const proc=word[2].trim();if(!/^[a-zA-Z_][a-zA-Z_0-9]{0,29}$/.test(proc))fail('invalid procedure name');commands.push({code:52,name:proc.toLowerCase()});}
        else {const fields=word[2].split(',');if(fields.length!==definition[1])fail('wrong '+name+' arity');const args=fields.map(field=>{if(!/^\s*[+-]?\d+\s*$/.test(field))fail('expected integer operand');const value=Number(field);if(!Number.isInteger(value)||value < -32768 || value>65535)fail('operand exceeds word range');return value<<16>>16;});commands.push({code:definition[0],args});}
      }
      at=close+1;if(commands.length>4096)fail('command budget exceeded');
    }
    return commands;
  }
  function procedureName(command) {
    if(command.name)return command.name;
    const raw=command.raw;
    if(!raw || raw.length<4)fail('invalid native procedure record');
    const count=raw[0]*256+raw[1];
    if(count<2 || count>=32 || count%2 || count+2!==raw.length)fail('invalid native procedure name size');
    const name=Array.from(raw.subarray(2),c=>String.fromCharCode(c)).join('').replace(/\x00+$/,'');
    if(!/^[a-zA-Z_][a-zA-Z_0-9]{0,29}$/.test(name))fail('unsupported native procedure name');
    return name.toLowerCase();
  }
  function context(style={}) {return {x:0,y:0,maxX:0,maxY:0,ink:style.ink==null?2:style.ink,paper:style.paper==null?1:style.paper,border:style.border==null?2:style.border,pattern:0,line:65535,outline:false,font:0,textStyle:0,data:0};}
  // A procedure suspends this stream. The VM executes its ordinary procedure
  // call and returns D0/D1 before resuming at result.next; no JS recursion/Promise.
  function run(commands,state,api={},start=0,measure=false) {
    const touch=()=>{state.maxX=Math.max(state.maxX,state.x);state.maxY=Math.max(state.maxY,state.y);};
    const style=()=>{if(!measure && api.style)api.style(state);};
    for(let index=start;index<commands.length;index++){
      const command=commands[index],a=command.args||[];
      if(command.code===4){const width=api.textWidth?api.textWidth(command.text,state.font):command.text.length*8,height=api.fontHeight?api.fontHeight(state.font):8;style();if(!measure && api.text)api.text(state.x,state.y,command.text,state);state.x+=width;state.y+=height;}
      else if(command.code===8){if(a[0]>state.x && a[1]>state.y){style();if(!measure&&api.bar)api.bar(state.x,state.y,a[0],a[1]);state.x=a[0]+1;state.y=a[1]+1;}}
      else if(command.code===12){if(a[0]>=0&&a[1]>=0){style();if(!measure&&api.line)api.line(state.x,state.y,a[0],a[1]);state.x=a[0]+1;state.y=a[1]+1;}}
      else if(command.code===16){if(a[0]>0&&a[1]>0){style();if(!measure&&api.ellipse)api.ellipse(state.x,state.y,a[0],a[1]);state.x+=a[0]+1;state.y+=a[1]+1;}}
      else if(command.code===20)state.pattern=a[0];
      else if(command.code===24){if(a[0]<1||a[0]>3)fail('invalid ink selector');state[['ink','paper','border'][a[0]-1]]=a[1];}
      else if(command.code===28||command.code===32){const image=api.image?api.image(command.code===28?1:2,a[0]):null;if(!image)fail('image is not defined');style();if(!measure&&api.paste)api.paste(command.code===28?1:2,a[0],state.x,state.y);state.x+=image.width;state.y+=image.height;}
      else if(command.code===36){if(a[0]>=0&&a[1]>=0){state.x=a[0];state.y=a[1];}}
      else if(command.code===40)state.outline=!!a[0];
      else if(command.code===44)state.line=a[0]&65535;
      else if(command.code===48){state.font=a[0];if(state.font && !api.fontHeight)fail('font is not available');}
      else if(command.code===52){return {procedure:procedureName(command),next:index+1,state,measure};}
      else if(command.code===56){const size=a[0]&65535;if(measure && size){if(!api.reserve)fail('reserve adapter is not available');state.data=api.reserve(size);}}
      else if(command.code===60){if(a[0]<0||a[0]>7)fail('unsupported text style');state.textStyle=a[0];}
      else fail('unsupported drawing opcode '+command.code);
      touch();
    }
    return {done:true,next:commands.length,state,measure};
  }
  function returned(state,x,y) {if(!Number.isInteger(x)||!Number.isInteger(y)||x < -32768||y < -32768||x>32767||y>32767)fail('procedure dimensions exceed word range');state.x=x;state.y=y;state.maxX=Math.max(state.maxX,x);state.maxY=Math.max(state.maxY,y);}
  return {parse,procedureName,context,run,returned};
}
if(typeof module==='object' && module.exports)module.exports=createMenuGraphics;
else globalThis.AMOS_MENU_GRAPHICS=createMenuGraphics;
