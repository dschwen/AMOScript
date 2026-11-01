/* jshint esversion: 6 */
'use strict';

// Interface opening is a verification pass, not execution. Keep expressions as
// tokens: native Dia_OpenChannel also postpones stack/type checks until Run.
function createInterface() {
  const arities={EX:0,UN:3,LI:4,BO:5,SI:2,BA:2,PU:1,SV:2,IL:0,PR:4,PO:5,IN:3,SF:2,SW:1,SL:1,SP:2,BU:8,JP:1,RU:2,BR:1,ED:8,JS:1,RT:0,BC:2,KY:2,SA:1,DI:8,BL:1,LA:1,BQ:0,HS:9,VS:9,AL:10,ZC:2,UI:0,GB:4,GS:4,GL:4,IF:1,SZ:1,XY:4,NW:0,VT:4,VL:4,HT:10,CA:1,SM:0,GE:4,GP:3,SS:8};
  const functions=new Set('BX BY SX SY NE ME TW TH VA CX SW SH MI MA BP MZ XA YA XB YB AR ZP P1 P2 P3 P4 P5 P6 P7 P8 P9 ZV ZN TL AS'.split(' '));
  const channels=new Map();let errorPosition=0;
  function parse(source,bufferBytes=1024) {
    if(typeof source!=='string'||!source.length||source.length>65535)throw Error('Interface requires a nonempty string of at most 65535 bytes');
    for(let i=0;i<source.length;i++)if(source.charCodeAt(i)>255)throw Error('Interface requires a Latin-1 string');
    let pos=0,depth=0;const nodes=[],labels=Object.create(null),definitions=Object.create(null);
    const fail=message=>{const e=Error('Interface '+message+' at character '+pos);e.interfacePosition=pos;throw e;};
    function skip(){while(pos<source.length){const code=source.charCodeAt(pos);if((code>0&&code<=32)||code>=97||code===40||code===41||code===46)pos++;else break;}}
    function next(){skip();return pos<source.length?source[pos++]:'';}
    function separator(){const c=next();if(!';:`'.includes(c)||!c)fail('expected separator');}
    function expression(){
      const tokens=[];
      for(;;){skip();const c=source[pos];if(c===undefined||',;:`'.includes(c))break;
        const at=pos;
        if(c==='"'||c==="'"){pos++;const begin=pos;while(pos<source.length&&source[pos]!==c){if(source.charCodeAt(pos)<32)fail('unterminated string');pos++;}if(pos===source.length)fail('unterminated string');tokens.push(Object.freeze({kind:'string',value:source.slice(begin,pos++),offset:at}));}
        else if(/[0-9$%]/.test(c)){
          pos++;const radix=c==='$'?16:c==='%'?2:10;let digits=/[0-9]/.test(c)?c:'';
          for(;;){skip();const digit=source[pos];if(digit===undefined||!(radix===16?/[0-9A-F]/:radix===2?/[01]/:/[0-9]/).test(digit))break;digits+=digit;pos++;}
          if(!digits.length)fail('expected digits');let value=0;for(const digit of digits)value=(value*radix+parseInt(digit,radix))|0;tokens.push(Object.freeze({kind:'number',value,offset:at}));
        }else if('+-*/#!=\\<>&|'.includes(c)){pos++;tokens.push(Object.freeze({kind:'function',value:c,offset:at}));}
        else if(/[A-Z]/.test(c)){const name=next()+next();if(!functions.has(name))fail('unknown expression token '+name);tokens.push(Object.freeze({kind:'function',value:name,offset:at}));}
        else fail('unexpected expression character '+c);
      }
      if(!tokens.length)fail('expected expression');return Object.freeze(tokens);
    }
    while(true){skip();if(pos===source.length)break;const offset=pos,c=next();
      if(c==='['){if(++depth>64)fail('block nesting exceeds 64');nodes.push(Object.freeze({kind:'begin',offset}));continue;}
      if(c===']'){if(!depth--)fail('unmatched closing block');nodes.push(Object.freeze({kind:'end',offset}));continue;}
      if(!/[A-Z]/.test(c))fail('expected instruction');const name=c+next();if(!/^[A-Z]{2}$/.test(name))fail('expected two-letter instruction');
      const args=[];
      if(name==='UI'){
        const custom=next()+next();if(!/^[A-Z]{2}$/.test(custom)||Object.hasOwn(arities,custom)||Object.hasOwn(definitions,custom))fail('invalid or duplicate user instruction '+custom);
        if(next()!==',')fail('expected comma');const count=expression();if(count.length!==1||count[0].kind!=='number'||count[0].value<0||count[0].value>9)fail('invalid user instruction arity');separator();skip();if(source[pos]!=='[')fail('expected user instruction block');definitions[custom]=count[0].value;
        nodes.push(Object.freeze({kind:'definition',name:custom,arity:count[0].value,offset}));continue;
      }
      const count=Object.hasOwn(arities,name)?arities[name]:definitions[name];
      // Native opening accepts unresolved custom calls; their definition may
      // follow the call. Resolve and check their arity after collecting labels.
      if(count===undefined){skip();if(!';:`'.includes(source[pos]||' ')){args.push(expression());while(source[pos]===','){pos++;args.push(expression());}}}
      else for(let i=0;i<count;i++){if(i&&next()!==',')fail('expected comma for '+name);args.push(expression());}
      separator();
      if(name==='LA'){
        const value=args[0];if(value.length!==1||value[0].kind!=='number'||value[0].value<0||value[0].value>=65536)fail('invalid label');const label=value[0].value;if(Object.hasOwn(labels,label))fail('duplicate label '+label);labels[label]=nodes.length;
      }
      nodes.push(Object.freeze({kind:'instruction',name,args:Object.freeze(args),offset}));
      if(nodes.length>16384)fail('instruction limit exceeded');
    }
    if(depth)fail('unclosed block');
    for(const node of nodes)if(node.kind==='instruction'&&!Object.hasOwn(arities,node.name)&&(!Object.hasOwn(definitions,node.name)||node.args.length!==definitions[node.name])){pos=node.offset;fail('undefined user instruction or wrong arity '+node.name);}
    // Native label entries occupy six bytes, followed by a four-byte sentinel.
    const labelBytes=6*(Object.keys(labels).length+Object.keys(definitions).length)+4;
    if(labelBytes>=bufferBytes)fail('label table exceeds channel buffer');
    return Object.freeze({source,nodes:Object.freeze(nodes),labels:Object.freeze(labels),definitions:Object.freeze(definitions)});
  }
  function open(id,source,nvar,bufferBytes,screen,resourceBank){
    if(!Number.isInteger(id)||id<=0)throw Error('Dialog Open requires a positive channel');
    if(!Number.isInteger(nvar)||nvar<0||nvar>65535||!Number.isInteger(bufferBytes)||bufferBytes<=256||bufferBytes>1048576)throw Error('Dialog Open requires 0..65535 variables and a buffer of 257..1048576 bytes');
    errorPosition=0;
    if(channels.has(id))throw Error('Dialog channel '+id+' is already open');
    if(!screen)throw Error('Dialog Open requires an open screen');
    let bytes=(typeof source==='string'?source.length:0)+bufferBytes+4*(nvar+1);
    for(const c of channels.values())bytes+=c.program.source.length+c.bufferBytes+4*(c.nvar+1);
    if(bytes>16777216)throw Error('Dialog channel storage exceeds 16 MiB');
    let program;try{program=parse(source,bufferBytes&~1);}catch(error){errorPosition=error.interfacePosition||0;throw error;}
    channels.set(id,{program,screen,resourceBank,nvar,variables:Array(nvar+1).fill(0),bufferBytes:bufferBytes&~1});
  }
  function close(id){if(id===undefined){channels.clear();return;}if(!Number.isInteger(id)||id<=0)throw Error('Dialog Close requires a positive channel');if(!channels.delete(id))throw Error('Dialog channel '+id+' is not open');}
  function variable(id,index){
    const channel=channels.get(id);if(!channel)throw Error('Dialog channel '+id+' is not open');
    if(!Number.isInteger(index)||index<0||index>channel.nvar)throw Error('Dialog variable index is out of bounds');
    if(index>8191)throw Error('Dialog variable address wrapping is not implemented');
    return channel.variables;
  }
  function get(type,id,index){const value=variable(id,index)[index];if((typeof value==='string')!==(type==='string'))throw Error('Dialog variables do not reinterpret strings as memory addresses');return value;}
  function set(id,index,value){const values=variable(id,index);if(typeof value!=='string'&&!Number.isInteger(value))throw Error('Dialog variable requires an integer or string');if(typeof value==='string'&&(value.length>65535||Array.from(value).some(c=>c.charCodeAt(0)>255)))throw Error('Dialog variable requires a bounded Latin-1 string');values[index]=value;}
  function inspect(){return Object.freeze(Array.from(channels,([id,c])=>Object.freeze({id,nvar:c.nvar,variables:c.nvar+1,bufferBytes:c.bufferBytes,screen:c.screen.id,resourceBank:c.resourceBank,source:c.program.source,instructions:c.program.nodes.length,labels:Object.freeze({...c.program.labels})})));}
  return {parse,open,close,get,set,inspect,errorPosition:()=>errorPosition};
}
if(typeof module==='object'&&module.exports)module.exports=createInterface;
if(typeof globalThis!=='undefined')globalThis.AMOS_INTERFACE=createInterface;
