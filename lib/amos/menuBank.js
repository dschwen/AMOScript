/* jshint esversion: 6 */
'use strict';

// Native Menu banks: +Equ.s MnLong=70, +Lib.s MnTb/MnTMn and
// ObJumps. Pointers in saved records are bank-relative, never host pointers.
function createMenuBankCodec() {
  const lengths={8:2,12:2,16:2,20:1,24:2,28:1,32:1,36:2,40:1,44:1,48:1,56:1,60:1};
  const fail=message=>{throw Error('Menu bank: '+message);};
  function decode(input) {
    if(!ArrayBuffer.isView(input) || Object.prototype.toString.call(input)!=='[object Uint8Array]' || input.length>1048576)fail('invalid bytes');
    const bytes=Uint8Array.from(input),view=new DataView(bytes.buffer),seen=new Set(),objects=new Map();let commandsRead=0;
    const need=(at,size)=>{if(!Number.isInteger(at) || at<0 || at%2 || size<0 || at+size>bytes.length)fail('pointer/range out of bounds');};
    const u16=at=>{need(at,2);return view.getUint16(at,false);},s16=at=>{need(at,2);return view.getInt16(at,false);},u32=at=>{need(at,4);return view.getUint32(at,false);};
    function object(at) {
      if(!at)return null;if(objects.has(at))return objects.get(at);
      const size=u16(at);if(size<4 || size%2)fail('invalid object size');need(at,size);
      const end=at+size,commands=[];let cursor=at+2;
      while(cursor<end){if(++commandsRead>262144)fail('drawing command budget exceeded');const code=u16(cursor);cursor+=2;if(!code){if(cursor!==end)fail('bytes after object terminator');objects.set(at,commands);return commands;}
        if(code===4){const length=u16(cursor);cursor+=2;if(cursor+length+(length%2)>end)fail('truncated text');commands.push({code,text:Array.from(bytes.subarray(cursor,cursor+length),c=>String.fromCharCode(c)).join('')});cursor+=length+(length%2);}
        else if(code===52){const length=u16(cursor);if(length<2 || length>=32 || length%2 || cursor+2+length>end)fail('invalid procedure record');commands.push({code,raw:bytes.slice(cursor,cursor+2+length)});cursor+=2+length;}
        else {const count=lengths[code];if(!count || cursor+count*2>end)fail('unknown/truncated drawing command');const args=[];for(let i=0;i<count;i++){args.push(s16(cursor));cursor+=2;}commands.push({code,args});}
      }
      fail('missing object terminator');
    }
    function chain(offset,depth) {
      if(depth>8)fail('tree exceeds eight levels');const result=[];
      while(true){need(offset,70);if(seen.has(offset) || seen.size>=4096)fail('cyclic/oversized tree');seen.add(offset);
        const number=u16(offset+12);if(number<1 || number>255 || result.some(node=>node.number===number))fail('invalid/duplicate item number');
        const node={number,flags:u16(offset+14)>>>8,lowFlags:u16(offset+14)&255,x:s16(offset+16),y:s16(offset+18),width:u16(offset+20),height:u16(offset+22),key:{flags:bytes[offset+34],ascii:bytes[offset+35],scan:bytes[offset+36],shift:bytes[offset+37]},objects:[38,42,46,50].map(field=>object(u32(offset+field))),ink:Array.from(bytes.subarray(offset+64,offset+70)),children:[]};
        const child=u32(offset+8);if(child)node.children=chain(child,depth+1);result.push(node);
        const next=u32(offset+4);if(!next)break;offset=next;
      }
      return result;
    }
    return chain(0,1);
  }
  function encode(nodes) {
    const bytes=[],seen=new Set();
    const word=value=>{if(!Number.isInteger(value) || value < -32768 || value>65535)fail('invalid word');bytes.push(value>>>8&255,value&255);};
    const patch=(at,value)=>{bytes[at]=value>>>24&255;bytes[at+1]=value>>>16&255;bytes[at+2]=value>>>8&255;bytes[at+3]=value&255;};
    function object(commands) {
      if(commands==null)return 0;if(!Array.isArray(commands) || commands.length>4096)fail('invalid drawing object');const start=bytes.length;word(0);
      for(const command of commands){const code=command.code;word(code);
        if(code===4){if(typeof command.text!=='string' || command.text.length>32766 || /[^\x00-\xff]/.test(command.text))fail('invalid byte text');word(command.text.length);for(let i=0;i<command.text.length;i++)bytes.push(command.text.charCodeAt(i));if(command.text.length%2)bytes.push(0);}
        else if(code===52){
          if(command.name!=null){
            if(typeof command.name!=='string'||!/^[a-zA-Z_][a-zA-Z_0-9]{0,29}$/.test(command.name))fail('invalid procedure name');
            const name=command.name.toLowerCase();word(name.length+(name.length%2));for(let i=0;i<name.length;i++)bytes.push(name.charCodeAt(i));if(name.length%2)bytes.push(0);
          }else{
            const raw=command.raw;
            if(Object.prototype.toString.call(raw)!=='[object Uint8Array]'||raw.length<4||raw.length>32||raw.length%2||raw[0]*256+raw[1]!==raw.length-2)fail('unsupported procedure record');
            bytes.push(...raw);
          }
        }
        else {if(!lengths[code] || !Array.isArray(command.args) || command.args.length!==lengths[code])fail('invalid drawing command');for(const value of command.args)word(value);}
        if(bytes.length-start>65532||bytes.length>1048572)fail('drawing object exceeds bank/word size');
      }
      word(0);const length=bytes.length-start;if(length>65534)fail('object exceeds word size');bytes[start]=length>>>8;bytes[start+1]=length&255;return start;
    }
    function chain(items,depth) {
      if(!Array.isArray(items) || !items.length || depth>8)fail('invalid tree');const first=bytes.length,siblings=new Set();let previous=null;
      for(const node of items){if(!node || seen.has(node) || siblings.has(node.number) || seen.size>=4096 || !Number.isInteger(node.number) || node.number<1 || node.number>255)fail('invalid/cyclic tree');seen.add(node);siblings.add(node.number);
        // MnTb leaves native MnPrev pointers in saved files; MnTMn rebuilds
        // them. Never export or interpret those stale host addresses.
        const start=bytes.length;for(let i=0;i<70;i++)bytes.push(0);if(previous!=null)patch(previous+4,start);previous=start;
        if([node.flags==null?0:node.flags,node.lowFlags==null?0:node.lowFlags].some(v=>!Number.isInteger(v)||v<0||v>255))fail('invalid flags');
        const fields=[[12,node.number],[14,((node.flags||0)<<8)|(node.lowFlags||0)],...[16,18,20,22].map((offset,index)=>[offset,[node.x||0,node.y||0,node.width||0,node.height||0][index]])];
        for(const [offset,value]of fields){if(!Number.isInteger(value) || value < -32768 || value>65535)fail('invalid item geometry');bytes[start+offset]=value>>>8&255;bytes[start+offset+1]=value&255;}
        const key=node.key||{},keys=[key.flags||0,key.ascii||0,key.scan||0,key.shift||0],ink=node.ink||[2,1,2,1,2,2];
        if(!Array.isArray(ink) || ink.length!==6 || [...keys,...ink].some(v=>!Number.isInteger(v)||v<0||v>255))fail('invalid key/ink metadata');keys.forEach((v,i)=>{bytes[start+34+i]=v;});ink.forEach((v,i)=>{bytes[start+64+i]=v;});
        if(!Array.isArray(node.objects)||node.objects.length!==4)fail('invalid object slots');node.objects.forEach((commands,index)=>patch(start+38+index*4,object(commands)));
        if(node.children && node.children.length)patch(start+8,chain(node.children,depth+1));
        if(bytes.length>1048576)fail('bank exceeds 1 MiB');
      }
      return first;
    }
    chain(nodes,1);return Uint8Array.from(bytes);
  }
  return {decode,encode};
}
if(typeof module==='object' && module.exports)module.exports=createMenuBankCodec;
else globalThis.AMOS_MENU_BANK=createMenuBankCodec;
