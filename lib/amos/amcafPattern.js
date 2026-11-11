/* jshint esversion: 6 */
'use strict';
// Bounded DOS-style pattern AST. AMCAF expands every * to #? before parsing.
function matchAmcafPattern(value,pattern) {
 const bytes=v=>typeof v==='string'&&!/[^\x01-\xff]/.test(v);
 if(!bytes(value)||!bytes(pattern)||value.length>255||pattern.length>255)throw Error('Pattern Match requires at most 255 non-NUL byte characters');
 const upper=v=>v.replace(/[a-z]/g,c=>String.fromCharCode(c.charCodeAt(0)-32));
 value=upper(value);pattern=upper(pattern.replace(/\*/g,'#?')||'#?');
 let at=0,id=0,depth=0;
 const node=(kind,data)=>({kind,data,id:id++});
 const fail=()=>{throw Error('Invalid DOS pattern');};
 function sequence(){const terms=[];while(at<pattern.length&&pattern[at]!==')'&&pattern[at]!=='|')terms.push(atom());return node('sequence',terms);}
 function choice(){const terms=[sequence()];while(pattern[at]==='|'){at++;terms.push(sequence());}return node('choice',terms);}
 function atom(){if(++depth>32)fail();let result;const c=pattern[at++];
  if(c==='#'||c==='~'){if(at===pattern.length)fail();result=node(c==='#'?'repeat':'not',atom());}
  else if(c==='('){result=choice();if(pattern[at++]!==')')fail();}
  else if(c==='?')result=node('any');
  else if(c==='%')result=node('sequence',[]);
  else if(c==="'"){if(at===pattern.length)fail();result=node('literal',pattern[at++]);}
  else if(c==='['){let inverse=false;if(pattern[at]==='~'){inverse=true;at++;}const ranges=[];while(at<pattern.length&&pattern[at]!==']'){let start=pattern[at++];if(start==="'"){if(at===pattern.length)fail();start=pattern[at++];}let end=start;if(pattern[at]==='-'&&pattern[at+1]!==']'){at++;end=pattern[at++];if(end===undefined||end<start)fail();}ranges.push([start,end]);}if(pattern[at++]!==']'||!ranges.length)fail();result=node('class',{inverse,ranges});}
  else if(c===']'||c===')'||c==='|')fail();else result=node('literal',c);
  depth--;return result;
 }
 const ast=choice();if(at!==pattern.length)fail();
 const memo=new Map();let budget=500000;
 const spend=()=>{if(--budget<0)throw Error('Pattern Match budget exceeded');};
 function ends(n,start){spend();const key=n.id+':'+start;if(memo.has(key))return memo.get(key);let out=new Set();
  if(n.kind==='literal'){if(value[start]===n.data)out.add(start+1);}
  else if(n.kind==='any'){if(start<value.length)out.add(start+1);}
  else if(n.kind==='class'){if(start<value.length&&n.data.ranges.some(([a,b])=>value[start]>=a&&value[start]<=b)!==n.data.inverse)out.add(start+1);}
  else if(n.kind==='choice'){for(const term of n.data)for(const end of ends(term,start)){spend();out.add(end);}}
  else if(n.kind==='sequence'){out.add(start);for(const term of n.data){const next=new Set();for(const p of out)for(const end of ends(term,p)){spend();next.add(end);}out=next;}}
  else if(n.kind==='not'){const denied=ends(n.data,start);for(let end=start;end<=value.length;end++)if(!denied.has(end)){spend();out.add(end);}}
  else if(n.kind==='repeat'){out.add(start);const queue=[start];for(let i=0;i<queue.length;i++)for(const end of ends(n.data,queue[i]))if(!out.has(end)){{spend();out.add(end);}queue.push(end);}}
  memo.set(key,out);return out;
 }
 return ends(ast,0).has(value.length)?-1:0;
}
if(typeof module==='object'&&module.exports)module.exports=matchAmcafPattern;
else globalThis.AMOS_AMCAF_PATTERN=matchAmcafPattern;
