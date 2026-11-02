'use strict';
const Reader=require('../lib/Buffer'),Tokens=require('../lib/TokenReader'),names=require('../lib/TokenTable').token_by_name;
// Distribution-only source variant. Preserve the pinned original and its line
// numbering; end before retiring the current room or reading an excluded room.
module.exports=function limitedSource(raw){
  const reader=new Reader(raw),label=new Tokens(reader).read().find(t=>t.name==='label'&&t.value==='initraum');
  if(!label||label.location.line!==874)throw Error('ASM limited-demo entry changed');
  const at=reader.lines[873],end=at+raw[at]*2;
  const word=n=>[(n>>>8)&255,n&255],tok=name=>word(names[name]);
  // Integer literals use the normal decimal token, not an identifier named number.
  const integer=n=>[0,0x3e,0,0,0,n],r=[0,6,0,0,1,0,114,0];
  const body=[...raw.subarray(at+2,end-2),...tok('If'),0,0,...r,...tok('>'),...integer(5),...tok('Or'),...r,...tok('<'),...integer(1),...tok('Then'),...tok('End')];
  if(body.length+4>510)throw Error('ASM demo guard exceeds physical line capacity');
  const line=Buffer.from([(body.length+4)/2,raw[at+1],...body,0,0]),delta=line.length-(end-at),header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(reader.code_bytes+delta,16);
  const guarded=Buffer.concat([header,raw.subarray(20,at),line,raw.subarray(end)]);
  // Game-over artwork is outside this limited package: retain the final room
  // and end cleanly rather than trying to load the excluded GOG/GOK panels.
  const next=new Reader(guarded),over=new Tokens(next).read().find(t=>t.name==='label'&&t.value==='game_over');
  if(!over||over.location.line!==1132)throw Error('ASM limited-demo game-over entry changed');
  const start=next.lines[1131],stop=start+guarded[start]*2,body2=[...guarded.subarray(start+2,stop-2),...tok('End')],line2=Buffer.from([(body2.length+4)/2,guarded[start+1],...body2,0,0]);
  const header2=Buffer.from(guarded.subarray(0,20));header2.writeUInt32BE(next.code_bytes+line2.length-(stop-start),16);
  return Buffer.concat([header2,guarded.subarray(20,start),line2,guarded.subarray(stop)]);
};
