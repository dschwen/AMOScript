'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const graphics=require('../lib/amos/menuGraphics')(),layout=require('../lib/amos/menuLayout')(graphics),codec=require('../lib/amos/menuBank')();
const native=()=>codec.decode(Uint8Array.from(require('../lib/BankReader').readFile(fs.readFileSync(path.join(__dirname,'../examples/Tutorial/Tutorials/Menus/Data.Menu'))).banks[0].data));
const node=(number,text,flags=8)=>({number,flags,x:0,y:0,objects:[null,graphics.parse(text),null,null],children:[]});

test('Menu graphics: native two-letter commands preserve text and produce independently specified opcodes',()=>{
  assert.deepStrictEqual(graphics.parse('Title (Ink 1,2:SS 4)A(SS0:LOcate 4,6:BAR 30,15)'),[
    {code:4,text:'Title '},{code:24,args:[1,2]},{code:60,args:[4]},{code:4,text:'A'},{code:60,args:[0]},{code:36,args:[4,6]},{code:8,args:[30,15]}
  ]);
  assert.deepStrictEqual(graphics.parse('(PRoc TEST:REserve 12)'),[{code:52,name:'test'},{code:56,args:[12]}]);
  assert.deepStrictEqual(graphics.parse('(LO 65535,0:SL 65535)'),[{code:36,args:[-1,0]},{code:44,args:[-1]}]);
  for(const text of ['(BA 1)','(LI 1,2,3)','(LO 1.5,2)','(OU 65536)','(SS -32769)','(unknown 1)','(PR test[1])','(BA 1,2','\u0100'])assert.throws(()=>graphics.parse(text),/Menu graphics/);
});

test('Menu graphics: geometry includes native inclusive Line/Bar endpoints and preserves maxima after Locate',()=>{
  const commands=graphics.parse('AB(LO 1,2:LI 7,9:BA 20,15:LO 2,3:EL 5,4)'),calls=[];
  const api={text:(...v)=>calls.push(['text',...v.slice(0,3)]),line:(...v)=>calls.push(['line',...v]),bar:(...v)=>calls.push(['bar',...v]),ellipse:(...v)=>calls.push(['ellipse',...v])};
  const state=graphics.context();assert.strictEqual(graphics.run(commands,state,api).done,true);
  assert.deepStrictEqual(calls,[['text',0,0,'AB'],['line',1,2,7,9],['bar',8,10,20,15],['ellipse',2,3,5,4]]);
  assert.deepStrictEqual([state.x,state.y,state.maxX,state.maxY],[8,8,21,16]);
  calls.length=0;const measure=graphics.context();graphics.run(commands,measure,api,0,true);assert.deepStrictEqual(calls,[]);assert.deepStrictEqual(measure,state);
});

test('Menu graphics: measurement reserves native per-item bytes once and procedure continuation does not replay earlier commands',()=>{
  const commands=graphics.parse('(RE 16)A(PR TEST)B'),calls=[],state=graphics.context(),api={reserve:size=>{calls.push(['reserve',size]);return 4096;},text:(x,y,text)=>calls.push(['text',x,y,text])};
  const pending=graphics.run(commands,state,api,0,true);assert.deepStrictEqual([pending.procedure,pending.next,pending.state.data],['test',3,4096]);assert.deepStrictEqual(calls,[['reserve',16]]);
  graphics.returned(state,20,12);assert.strictEqual(graphics.run(commands,state,api,pending.next,true).done,true);assert.deepStrictEqual([state.maxX,state.maxY],[28,20]);assert.strictEqual(calls.length,1);
  const draw=graphics.context();const drawPending=graphics.run(commands,draw,api);assert.strictEqual(drawPending.procedure,'test');assert.deepStrictEqual(calls,[['reserve',16],['text',0,0,'A']]);
  assert.throws(()=>graphics.returned(state,32768,0),/dimensions/);
});

test('Menu layout: saved native title widths and the separate colour grid retain relative placement',()=>{
  const tree=native(),result=layout.calculate(tree,{image:()=>({width:16,height:16})}).next();assert.strictEqual(result.done,true);
  const groups=layout.place(result.value,tree);assert.strictEqual(groups.length,1);assert.deepStrictEqual(groups[0].items.map(n=>[n.left,n.top,n.width,n.height]),[[2,2,72,8],[74,2,64,8],[138,2,72,8],[210,2,48,8],[258,2,64,8]]);
  const colours=layout.place(result.value,tree[2].children,138,2),items=colours.flatMap(g=>g.items);
  // Each separate row adds (2,2), text contributes eight rows, and item17
  // explicitly starts the second column relative to item16 at (18,-150).
  assert.deepStrictEqual([0,15,16,31].map(i=>[items[i].left,items[i].top]),[[122,15],[152,165],[170,15],[200,165]]);
  assert.strictEqual(layout.hit(colours,122,15).path.join(','),'3,1');assert.strictEqual(layout.hit(colours,161,22).path.join(','),'3,1');assert.strictEqual(layout.hit(colours,162,22),null);assert.strictEqual(layout.hit(colours,122,23),null);
  assert.deepStrictEqual([tree[0].width,tree[2].children[0].width],[0,0]); // layout never rewrites saved bytes/records
});

test('Menu layout: graphical procedures yield genuine call requests with explicit returned dimensions',()=>{
  const root=node(1,'Menu',32),child=node(1,'(PR TEST)');root.children=[child];child.flags|=2;child.x=10;child.y=14;
  const iterator=layout.calculate([root]),request=iterator.next();assert.strictEqual(request.done,false);assert.strictEqual(request.value.procedure,'test');assert.deepStrictEqual(request.value.path,[1,1]);assert.strictEqual(request.value.measure,true);
  const result=iterator.next({x:130,y:65});assert.strictEqual(result.done,true);const title=layout.place(result.value,[root])[0].items[0],item=layout.place(result.value,root.children,title.left,title.top)[0].items[0];
  assert.deepStrictEqual([item.left,item.top,item.width,item.height],[12,16,130,65]);
  const invalid=layout.calculate([root]);invalid.next();assert.throws(()=>invalid.next({x:65536,y:0}),/bounds/);
});

test('Menu layout: cyclic trees, excessive depth, missing metrics and overflowing placements reject',()=>{
  const root=node(1,'A');root.children=[root];assert.throws(()=>layout.calculate([root]).next(),/cyclic/);
  assert.throws(()=>layout.calculate([null]).next(),/tree/);
  const deep=node(1,'A');let parent=deep;for(let i=0;i<8;i++){const child=node(1,'A');parent.children=[child];parent=child;}assert.throws(()=>layout.calculate([deep]).next(),/depth/);
  const item=node(1,'A');const calculated=layout.calculate([item]).next().value;assert.throws(()=>layout.place(calculated,[item],32767,0),/bounds/);assert.throws(()=>layout.place(calculated,[node(2,'B')]),/measured/);
  const image=node(1,'(BO 1)');assert.throws(()=>layout.calculate([image]).next(),/image/);
});

test('Menu banks: graphical streams and native procedure records serialize to independent big-endian object bytes',()=>{
  const item=node(1,'A(PR TEST:LI 7,9)');const bytes=codec.encode([item]);
  // 70-byte item header, object length24, text opcode/length/odd padding,
  // procedure opcode/name length and four bytes, Line operands, terminator.
  assert.strictEqual(Buffer.from(bytes.subarray(70)).toString('hex'),'00180004000141000034000474657374000c000700090000');
  const commands=codec.decode(bytes)[0].objects[1];assert.strictEqual(graphics.procedureName(commands[1]),'test');
  const root=node(1,'A'),second=node(2,'B'),child=node(1,'C'),sibling=node(2,'D');second.children=[child,sibling];
  const linked=codec.encode([root,second]),view=new DataView(linked.buffer),next=view.getUint32(4),firstChild=view.getUint32(next+8),nextChild=view.getUint32(firstChild+4);
  assert.strictEqual(view.getUint32(next),0);assert.strictEqual(view.getUint32(firstChild),0);assert.strictEqual(view.getUint32(nextChild),0);
  // Saved MnPrev is stale native memory, not a bank-relative input pointer.
  view.setUint32(firstChild,0xfedcba98);assert.deepStrictEqual(codec.decode(linked),codec.decode(codec.encode([root,second])));
  const invalid=node(1,'');invalid.objects[1]=[{code:52,raw:Uint8Array.from([0,8,65,0])}];assert.throws(()=>codec.encode([invalid]),/procedure/);
  invalid.objects[1]=[{code:4,text:'A'.repeat(32766)},{code:4,text:'B'.repeat(32766)}];assert.throws(()=>codec.encode([invalid]),/size/);
});
