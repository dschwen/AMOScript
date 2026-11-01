/* jshint esversion: 6 */
'use strict';

// MnCa0/MnDraw/MnMaxi, expressed without a display or a host event loop.
// A yielded procedure is an ordinary AMOS call request. The caller resumes
// measurement with its returned D0/D1; callbacks are never evaluated as JS.
function createMenuLayout(graphics) {
  const fail=message=>{throw Error('Menu layout: '+message);};
  const coordinate=value=>{if(!Number.isInteger(value)||value < -32768||value>32767)fail('geometry exceeds signed-word bounds');return value;};
  function* calculate(nodes,api={}) {
    const records=new Map(),paths=new Map(),seen=new Set();
    function* object(commands,node,path,origin) {
      const state=graphics.context();
      if(!commands)return state;
      let next=0;
      while(true){
        const result=graphics.run(commands,state,{...api,reserve:size=>api.reserve?api.reserve(size,node):fail('reserve adapter is not available')},next,true);
        if(result.done)return state;
        const dimensions=yield {procedure:result.procedure,node,path:path.slice(),x:origin.x+state.x,y:origin.y+state.y,measure:true,first:true,data:state.data};
        if(!dimensions)fail('procedure dimensions were not returned');
        graphics.returned(state,coordinate(dimensions.x-origin.x),coordinate(dimensions.y-origin.y));
        next=result.next;
      }
    }
    function* branch(items,dx,dy,prefix) {
      if(!Array.isArray(items)||prefix.length>=8)fail('invalid tree depth');
      const siblings=new Set();
      for(let i=0;i<items.length;i++){
        const node=items[i];
        if(!node||seen.has(node)||seen.size>=4096||!Number.isInteger(node.number)||node.number<1||node.number>255||siblings.has(node.number))fail('invalid/cyclic tree');
        const path=[...prefix,node.number];
        seen.add(node);siblings.add(node.number);
        if(!Array.isArray(node.objects)||node.objects.length!==4||!Number.isInteger(node.flags)||node.flags<0||node.flags>255)fail('invalid item');
        if((i===0||(node.flags&4))&&!node.objects[0]){dx+=2;dy+=2;}
        const x=coordinate(node.flags&2?node.x:dx),y=coordinate(node.flags&2?node.y:dy);
        const frame=yield* object(node.objects[0],node,path,{x:0,y:0});
        const content=node.objects[0]&&(node.flags&16)&&node.objects[3]?node.objects[3]:node.objects[1];
        const normal=yield* object(content,node,path,{x:frame.x,y:frame.y});
        const record={node,path,x,y,width:coordinate(Math.max(frame.maxX,normal.maxX)),height:coordinate(Math.max(frame.maxY,normal.maxY)),contentX:frame.x,contentY:frame.y};
        records.set(node,record);paths.set(path.join(','),record);
        // Bar means vertical traversal; Line/Tline mean horizontal traversal.
        if(node.children&&node.children.length)yield* branch(node.children,node.flags&8?normal.x:0,node.flags&8?0:normal.y,path);
        dx=node.flags&8?0:normal.x;dy=node.flags&8?normal.y:0;
      }
    }
    yield* branch(nodes,0,0,[]);
    return {records,paths};
  }
  // Each sibling's position is relative to its predecessor, not to the parent.
  // A Separate item starts a new framed group but retains that relative origin.
  function place(layout,items,x=0,y=0) {
    coordinate(x);coordinate(y);const groups=[];let group=null;
    for(let i=0;i<items.length;i++){
      const node=items[i],record=layout.records.get(node);if(!record)fail('item has not been measured');
      x=coordinate(x+record.x);y=coordinate(y+record.y);
      const placed={...record,left:x,top:y,right:coordinate(x+record.width),bottom:coordinate(y+record.height)};
      if(i===0||(node.flags&4)){group={items:[],left:x,top:y,right:placed.right,bottom:placed.bottom,framed:!node.objects[0],total:!!(node.flags&32)&&!(node.flags&8)};groups.push(group);}
      group.items.push(placed);group.left=Math.min(group.left,x);group.top=Math.min(group.top,y);group.right=Math.max(group.right,placed.right);group.bottom=Math.max(group.bottom,placed.bottom);
    }
    for(const group of groups)if(group.framed){group.left=coordinate(group.left-2);group.top=coordinate(group.top-2);group.right=coordinate(group.right+2);group.bottom=coordinate(group.bottom+2);}
    return groups;
  }
  function hit(groups,x,y) {
    for(const group of groups)for(const item of group.items)if(x>=item.left&&x<item.right&&y>=item.top&&y<item.bottom)return item;
    return null;
  }
  return {calculate,place,hit};
}
if(typeof module==='object'&&module.exports)module.exports=createMenuLayout;
else globalThis.AMOS_MENU_LAYOUT=createMenuLayout;
