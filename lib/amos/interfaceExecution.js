/* jshint esversion: 6 */
'use strict';

// Bounded, synchronous, noninteractive Interface execution. Resource commands,
// control blocks and event waits deliberately do not fall through as no-ops.
function executeInterface(channel,label,x,y,host) {
  let position=0,retained=0;
  const fail=message=>{const error=Error('Interface '+message+' at character '+position);error.interfacePosition=position;throw error;};
  const number=value=>{if(!Number.isInteger(value)||value<-2147483648||value>2147483647)fail('requires an integer');return value;};
  const word=value=>(number(value)<<16)>>16;
  const string=value=>{if(typeof value!=='string'||value.length>255||/[^\x00-\xff]/.test(value))fail('requires a Latin-1 string of at most 255 bytes');return value;};
  const index=value=>{value=number(value);if(value<0||value>channel.nvar||value>8191)fail('variable index out of bounds');return value;};
  const live=()=>{if(!host.alive())fail('channel or VM retired during Dialog Run');};
  const geometry=channel.geometry||(channel.geometry={BX:0,BY:0,SX:0,SY:0,XA:0,YA:0,XB:0,YB:0});
  if(x!==null&&x!==-2147483648)geometry.BX=number(x);
  if(y!==null&&y!==-2147483648)geometry.BY=number(y);
  geometry.XA=geometry.YA=geometry.XB=geometry.YB=0;
  let ip=0;
  if(label>=0){if(!Object.hasOwn(channel.program.labels,label))fail('label is not defined');ip=channel.program.labels[label]+1;}
  const available=channel.bufferBytes-4-6*(Object.keys(channel.program.labels).length+Object.keys(channel.program.definitions).length);
  let temporary=0;
  function materialize(value){value=string(value);temporary+=(6+value.length+1)&~1;if(retained+temporary+16>available)fail('string buffer exhausted');return value;}
  function evaluate(tokens){
    const stack=[];
    const pop=()=>{if(!stack.length)fail('expression stack underflow');return stack.pop();};
    const numeric=()=>number(pop());
    for(const token of tokens){position=token.offset;live();
      if(token.kind==='number')stack.push(token.value);
      else if(token.kind==='string')stack.push(materialize(token.value));
      else {
        const op=token.value;
        if(Object.hasOwn(geometry,op))stack.push(geometry[op]);
        else if(op==='VA')stack.push(channel.variables[index(numeric())]);
        else if(op==='SW'||op==='SH')stack.push(op==='SW'?channel.screen.width:channel.screen.height);
        else if(op==='TH')stack.push(host.textHeight());
        else if(op==='AR'){const at=numeric(),ref=numeric();stack.push(host.arrayRead(ref,at));}
        else if(op==='AS')stack.push(host.arraySize(numeric()));
        else if(op==='NE')stack.push((-numeric())|0);
        else if(op==='#')stack.push(materialize(String(numeric())));
        else if(op==='!'){const b=string(pop()),a=string(pop());stack.push(materialize(a+b));}
        else if(op==='TL')stack.push(string(pop()).length);
        else if(op==='TW'||op==='CX'){const width=host.textWidth(string(pop()));stack.push(op==='TW'?width:Math.max(0,(geometry.SX-width)|0)>>>1);}
        else if(['+','-','*','/','=','\\','<','>','&','|','MI','MA'].includes(op)){
          const b=numeric(),a=numeric();let value;
          if(op==='+')value=(a+b)|0;else if(op==='-')value=(a-b)|0;
          else if(op==='*')value=word(a)*word(b);
          else if(op==='/'){if(!word(b))fail('division by zero');value=Math.trunc(word(a)/word(b));if(value<-32768||value>32767)fail('division overflow is not implemented');}
          else if(op==='=')value=a===b?-1:0;else if(op==='\\')value=a!==b?-1:0;
          else if(op==='<')value=a<b?-1:0;else if(op==='>')value=a>b?-1:0;
          else if(op==='&')value=a&b;else if(op==='|')value=a|b;
          else value=op==='MI'?Math.min(a,b):Math.max(a,b);
          stack.push(value);
        }else fail('unsupported expression function '+op);
      }
      if(stack.length>64||retained+temporary+stack.length*4+4>available)fail('expression buffer exhausted');
      if(typeof stack[stack.length-1]==='string')string(stack[stack.length-1]);
    }
    if(stack.length!==1)fail('expression must produce exactly one value');return stack[0];
  }
  const bounds=values=>{values.forEach(value=>{number(value);if(value<-32768||value>32767)fail('drawing requires signed-word coordinates');});return values;};
  function coords(args,base=true){bounds(args);return bounds(args.map((value,i)=>number(value)+(base?(i%2?geometry.BY:geometry.BX):0)));}
  function remember(args){[geometry.XA,geometry.YA,geometry.XB,geometry.YB]=args.map(word);}
  try{
  live();host.begin();live();
  for(let budget=0;budget<4096;budget++){
    live();const node=channel.program.nodes[ip++];
    if(!node)fail('program must finish with EX');position=node.offset;
    if(node.kind!=='instruction')fail('control blocks and user instructions are not implemented');
    if(node.name==='EX')return 0;
    const supported=['LA','SV','SI','BA','XY','IN','SW','SL','GL','GB','GS','GP','PR'];
    if(!supported.includes(node.name))fail('unsupported instruction '+node.name);
    temporary=0;const args=node.args.map(evaluate);position=node.offset;live();
    switch(node.name){
      case 'LA':break;
      case 'SV': {const at=index(args[0]),value=args[1];if(typeof value==='string')string(value);else number(value);retained+=temporary;channel.variables[at]=value;break;}
      case 'SI':geometry.SX=((number(args[0])+15)|0)&~15;geometry.SY=number(args[1]);break;
      case 'BA':geometry.BX=number(args[0])&~15;geometry.BY=number(args[1]);break;
      case 'XY':remember(args);break;
      case 'IN':host.ink(args.map(number));break;
      case 'SW':if(number(args[0])>=0){if(args[0]!==0&&args[0]!==1)fail('writing mode is not implemented');host.writing(args[0]);}break;
      case 'SL':if(number(args[0])>=0){if((args[0]&65535)!==65535)fail('patterned lines are not implemented');host.line(args[0]);}break;
      case 'GL':case 'GB':case 'GS': {const points=coords(args);if(node.name==='GB'&&(points[2]<=points[0]||points[3]<=points[1]))fail('GB requires increasing endpoints');host.draw(node.name,points);remember(args);break;}
      case 'GP': {const points=coords(args.slice(0,2),false);host.plot(points,number(args[2]));geometry.XA=geometry.YA=word(args[0]);geometry.XB=geometry.YB=word(number(args[1])+1);break;}
      case 'PR': {const value=string(args[2]),ink=number(args[3]),points=coords(args.slice(0,2));bounds([points[0],points[1]+7]);const width=host.textWidth(value);host.print(points,value,ink);geometry.XA=word(args[0]);geometry.YA=word(args[1]);geometry.XB=word(number(args[0])+width);geometry.YB=word(number(args[1])+(value.length?8:0));break;}
    }
    live();
  }
  fail('execution exceeds the 4096-instruction noninteractive budget');
  }catch(error){if(error.interfacePosition==null){error.interfacePosition=position;error.message+=' at Interface character '+position;}throw error;}
}
if(typeof module==='object'&&module.exports)module.exports=executeInterface;
if(typeof globalThis!=='undefined')globalThis.AMOS_INTERFACE_EXECUTION=executeInterface;
