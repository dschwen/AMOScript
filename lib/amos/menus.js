/* jshint esversion: 6 */
'use strict';
const menuGraphicsFactory=typeof module==='object'&&module.exports?require('./menuGraphics'):globalThis.AMOS_MENU_GRAPHICS;
const menuLayoutFactory=typeof module==='object'&&module.exports?require('./menuLayout'):globalThis.AMOS_MENU_LAYOUT;
const menuBankFactory=typeof module==='object'&&module.exports?require('./menuBank'):globalThis.AMOS_MENU_BANK;

// Indexed, modal menus. Hosts supply physical input; the driver owns wakes and
// executes yielded procedure requests through the ordinary procedure stack.
function createMenus(options) {
  const display=options.display,graphics=menuGraphicsFactory(),layoutEngine=menuLayoutFactory(graphics),codec=menuBankFactory();
  const fail=message=>{throw Error('Menu: '+message);};
  const integer=value=>{if(!Number.isInteger(value))fail('expected integer');return value;};
  const word=value=>integer(value)<<16>>16;
  let tree=[],owner=null,enabled=false,mouseMode=false,revision=0,measured=null,calculateRequested=false;
  let defaults=[96,72,72,72,72,72,72,72],choices=new Int16Array(8),latch=0;
  let handlers=[],events=false,pendingHandler=null;
  let active=false,background=null,measurementBackground=null,openedSelection=null,selected=[],visible=[],hover=null,job=null,jobResult=null,inProcedure=false,jobRevision=0,lastField=-1,lastInput='',drag=null,translation={x:0,y:0},cancelSelection=false;
  const savedFields=['ink','inkBackground','inkBorder','graphicsBackground','graphicsMode','fillPattern','paintBorder','textStyle','linePattern','linePhase','gx','gy'];
  const pathKey=path=>path.join(',');
  function checkedPath(path){if(!Array.isArray(path)||path.length<1||path.length>8)fail('expected a one to eight level item path');return path.map(v=>{integer(v);if(v<1||v>255)fail('item number must be 1..255');return v;});}
  function find(path){let items=tree,node=null;for(const number of checkedPath(path)){node=items.find(n=>n.number===number);if(!node)fail('item is not defined');items=node.children;}return node;}
  function live(){return owner&&display.screens.get(owner.id)===owner;}
  function close(){
    if(background)display.restore(background);
    if(openedSelection!=null&&display.screens.has(openedSelection))display.select(openedSelection);
    active=false;background=null;selected=[];visible=[];hover=null;drag=null;openedSelection=null;lastInput='';
  }
  function changed(){close();if(measurementBackground)display.restore(measurementBackground);measurementBackground=null;revision++;measured=null;job=null;jobResult=null;inProcedure=false;}
  function bind(){const target=display.screen();if(owner&&owner!==target)fail('items must belong to one screen');if(target.doubleBuffered||target.cloneOwner||target.ham||target.dualPartner||target.dualOwner)fail('requires a single-buffered indexed screen');owner=target;}
  function setItem(path,values){
    path=checkedPath(path);if(!Array.isArray(values)||values.length<1||values.length>4)fail('expected one to four drawing strings');
    const parsed=values.map(value=>value==null?null:graphics.parse(value));
    let items=path.length===1?tree:find(path.slice(0,-1)).children;
    bind();let node=items.find(n=>n.number===path.at(-1));
    if(!node){node={number:path.at(-1),flags:defaults[path.length-1],lowFlags:0,x:0,y:0,width:0,height:0,key:{flags:0,ascii:0,scan:0,shift:0},ink:[owner.paper,owner.pen,owner.paper,owner.pen,owner.paper,owner.paper],objects:[null,null,null,null],children:[]};items.push(node);items.sort((a,b)=>a.number-b.number);items.forEach((item,index)=>{item.flags=(item.flags&~1)|(index===0?1:0);});}
    node.ink=[owner.paper,owner.pen,owner.paper,owner.pen,owner.paper,owner.paper];
    values.forEach((value,i)=>{if(value!=null)node.objects[[1,2,3,0][i]]=value.length?parsed[i]:null;});changed();
  }
  const styles={'Menu Bar':[8,true],'Menu Line':[40,false],'Menu Tline':[8,false,32], 'Menu Movable':[64,true],'Menu Static':[64,false],'Menu Item Movable':[128,true],'Menu Item Static':[128,false],'Menu Active':[16,false],'Menu Inactive':[16,true],'Menu Separate':[4,true],'Menu Link':[4,false]};
  function command(name,path=[],args=[],depth=null){
    if(name==='Menu$'){setItem(path,args);return;}
    if(styles[name]){const [mask,on,extra=0]=styles[name];if(depth!=null){integer(depth);if(depth<1||depth>8)fail('depth must be 1..8');defaults[depth-1]=(on?defaults[depth-1]|mask:defaults[depth-1]&~mask)|extra;}else{const node=find(path);node.flags=(on?node.flags|mask:node.flags&~mask)|extra;}changed();return;}
    if(name==='Set Menu'){const node=find(path),x=word(args[0]),y=word(args[1]);node.x=x;node.y=y;node.flags|=2;changed();return;}
    if(name==='Menu Base'){if(!tree.length)fail('no items defined');const [x,y]=args.map(v=>v==null||v===-2147483648?null:word(v));if(x!=null)tree[0].x=x;if(y!=null)tree[0].y=y;if(x!=null||y!=null)tree[0].flags|=2;changed();return;}
    if(name==='Menu Called'||name==='Menu Once'){find(path).lowFlags=name==='Menu Called'?255:0;changed();return;}
    if(name==='Menu Del'){if(!path.length){tree=[];owner=null;enabled=false;choices.fill(0);latch=0;}else{const node=find(path),items=path.length===1?tree:find(path.slice(0,-1)).children;items.splice(items.indexOf(node),1);items.forEach((item,index)=>{item.flags=(item.flags&~1)|(index===0?1:0);});if(!tree.length){owner=null;enabled=false;}}changed();return;}
    if(name==='Menu Key'){
      const node=find(path);if(node.children.length)fail('shortcuts require a leaf item');let key={flags:0,ascii:0,scan:0,shift:0};
      if(args.length){if(typeof args[0]==='string'){if(!args[0].length||args[0].charCodeAt(0)>255||args.length>1)fail('expected a nonempty byte string shortcut');key={...key,flags:1,ascii:args[0].charCodeAt(0)};}else{integer(args[0]);const shift=args[1]==null?0:integer(args[1]);if(args[0]<0||args[0]>127||shift<0||shift>255)fail('invalid shortcut scancode/qualifiers');key={...key,flags:255,scan:args[0],shift};}}
      node.key=key;return;
    }
    if(name==='Menu On'){enabled=!!tree.length;return;}
    if(name==='Menu Off'){enabled=false;close();job=null;inProcedure=false;return;}
    if(name==='Menu Calc'){if(!tree.length)fail('no items defined');calculateRequested=true;measured=null;return;}
    if(name==='Menu Mouse On'||name==='Menu Mouse Off'){mouseMode=name==='Menu Mouse On';return;}
    if(name==='On Menu On'){events=true;return;}
    if(name==='On Menu Off'){events=false;return;}
    if(name==='On Menu Del'){events=false;handlers=[];pendingHandler=null;return;}
    fail('unsupported command '+name);
  }
  function choose(path){
    let items=tree;for(const number of path){const node=items.find(n=>n.number===number);if(!node||node.flags&16)return false;items=node.children;}
    if(items.length)return false;
    choices.fill(0);choices.set(path);latch=-1;
    if(events&&handlers[path[0]-1]){events=false;pendingHandler={...handlers[path[0]-1],menuHandler:true,interrupt:true};}
    return true;
  }
  function shortcut(key,scanCode=null,shift=0){
    if(!enabled||!live()||active||inProcedure)return false;
    function search(items,path){for(const node of items){if(node.flags&16)continue;const next=[...path,node.number];if(node.children.length){const found=search(node.children,next);if(found)return found;}else if((node.key.flags===1&&key.length&&key.charCodeAt(0)===node.key.ascii)||(node.key.flags===255&&scanCode===node.key.scan&&shift===node.key.shift))return next;}return null;}
    const match=search(tree,[]);return match?choose(match):false;
  }
  function withStyle(fn){
    const selectedId=display.info('Screen Number'),saved=Object.fromEntries(savedFields.map(key=>[key,{present:Object.hasOwn(owner,key),value:owner[key]}]));
    display.select(owner.id);
    try{return fn();}finally{for(const [key,entry]of Object.entries(saved))if(entry.present)owner[key]=entry.value;else delete owner[key];if(display.screens.has(selectedId))display.select(selectedId);}
  }
  const api={image:(bank,n)=>options.image(bank,n),reserve:size=>options.reserve(currentNode,size)};let currentNode=null;
  function drawingApi(origin){
    return {...api,style(s){if(s.font)fail('graphical menu disk fonts are not implemented');display.ink(s.ink&(owner.colours-1),s.paper&(owner.colours-1),s.border&(owner.colours-1));display.grWriting(1);display.setText(s.textStyle);display.setPaint(s.outline?1:0);options.pattern(s.pattern);display.setLine(s.line);},
      text:(x,y,text)=>display.text(origin.x+x,origin.y+y+7,text),bar:(x,y,r,b)=>display.bar(origin.x+x,origin.y+y,origin.x+r,origin.y+b),
      line:(x,y,r,b)=>display.draw(origin.x+x,origin.y+y,origin.x+r,origin.y+b),ellipse:(x,y,rx,ry)=>display.ellipse(origin.x+x,origin.y+y,rx,ry),
      paste:(bank,n,x,y)=>options.paste(bank,origin.x+x,origin.y+y,n)};
  }
  function* drawObject(commands,node,path,origin,ink,selectedFlag,first){
    const state=graphics.context(ink),adapter=drawingApi(origin);let next=0;
    if(!commands)return state;
    while(true){currentNode=node;const result=withStyle(()=>graphics.run(commands,state,adapter,next,false));if(result.done)return state;
      const dimensions=yield {procedure:result.procedure,node,path,x:origin.x+state.x,y:origin.y+state.y,measure:false,selected:selectedFlag,first,data:state.data};
      graphics.returned(state,dimensions.x-origin.x,dimensions.y-origin.y);next=result.next;
    }
  }
  function* drawItem(item,first=true){
    const node=item.node,selectedFlag=selected.includes(node)&&!(node.flags&16),a=node.ink;
    const frame=yield* drawObject(node.objects[0],node,item.path,{x:item.left,y:item.top},{ink:a[1],paper:a[0],border:a[2]},false,first);
    const inactive=!!(node.flags&16),custom=selectedFlag&&node.objects[2];
    const commands=inactive&&node.objects[3]?node.objects[3]:custom||node.objects[1];
    const index=selectedFlag&&!custom?3:0;
    yield* drawObject(commands,node,item.path,{x:item.left+frame.x,y:item.top+frame.y},{ink:a[index],paper:a[index+1],border:a[index+2]},selectedFlag,first);
  }
  function* drawAll(){
    display.restore(background);visible=[];let items=tree,x=translation.x,y=translation.y;
    for(let depth=0;items.length&&depth<8;depth++){
      const groups=layoutEngine.place(measured,items,x,y);visible.push(groups);
      for(const group of groups){
        const ink=group.items[0].node.ink;
        if(group.framed)withStyle(()=>{display.setLine(65535);options.pattern(0);display.setPaint(0);display.ink(ink[1]&(owner.colours-1));display.bar(group.total?0:group.left,group.top,(group.total?owner.width:group.right)-1,group.bottom-1);display.ink(ink[2]&(owner.colours-1));display.box(group.total?0:group.left,group.top,(group.total?owner.width:group.right)-1,group.bottom-1);});
        for(const item of group.items)yield* drawItem(item);
      }
      const next=selected[depth],placed=groups.flatMap(group=>group.items).find(item=>item.node===next);
      if(!placed||!next.children.length)break;
      items=next.children;x=placed.left;y=placed.top;
    }
  }
  function* drawCalled(){for(const groups of visible)for(const group of groups)for(const item of group.items)if(item.node.lowFlags===255)yield* drawItem(item,false);}
  function startJob(iterator){job=iterator;jobRevision=revision;jobResult=null;}
  function advanceJob(){
    while(job){
      const result=job.next(jobResult);jobResult=null;
      if(result.done){job=null;if(result.value&&result.value.records){measured=result.value;if(measurementBackground)display.restore(measurementBackground);measurementBackground=null;}return null;}
      const request=result.value;currentNode=request.node;const target=options.procedure(request.procedure);
      if(!target||target.parameters.length)fail('drawing procedure must exist and take no arguments: '+request.procedure);
      options.registers(request);inProcedure=true;return {...target,menuDraw:true,interrupt:true};
    }
    return null;
  }
  function returned(){if(!inProcedure)return;inProcedure=false;if(job&&jobRevision===revision)jobResult=options.dimensions();}
  function service(field){
    if(inProcedure)return null;
    if(owner&&!live()){close();enabled=false;owner=null;job=null;measured=null;calculateRequested=false;pendingHandler=null;}
    if(job){const control=advanceJob();if(control)return control;}
    if(pendingHandler){const result=pendingHandler;pendingHandler=null;return result;}
    if(!live()||(!enabled&&!calculateRequested))return null;
    const mouse=options.mouse(),x=display.coordinate('X Screen',owner.id,mouse.x),y=display.coordinate('Y Screen',owner.id,mouse.y),right=!!(mouse.buttons&2);
    if(!measured&&(right||calculateRequested)){calculateRequested=false;measurementBackground=display.capture(0,0,owner.width,owner.height,owner.id);startJob(layoutEngine.calculate(tree,{...api,reserve:(size,node)=>options.reserve(node,size)}));const result=advanceJob();if(result)return result;}
    if(!enabled)return null;
    if(right&&!active){
      openedSelection=display.info('Screen Number');background=display.capture(0,0,owner.width,owner.height,owner.id);active=true;cancelSelection=false;choices.fill(0);latch=0;selected=[];
      translation=mouseMode?{x,y}:{x:0,y:0};lastInput='';startJob(drawAll());const result=advanceJob();if(result)return result;
    }
    if(!active)return null;
    const signature=[x,y,mouse.buttons].join(','),changedInput=signature!==lastInput;
    let hit=null;for(let i=visible.length-1;i>=0;i--){hit=layoutEngine.hit(visible[i],x,y);if(hit)break;}
    if(hit&&(hit.node.flags&16))hit=null;
    if(!right){close();if(!cancelSelection&&hit&&!hit.node.children.length)choose(hit.path);if(pendingHandler){const result=pendingHandler;pendingHandler=null;return result;}return null;}
    if(mouse.buttons&1){
      if(!drag&&hit&&(hit.node.flags&192)){
        const groups=visible[hit.path.length-1],group=groups.find(group=>group.items.includes(hit)),individual=!!(hit.node.flags&128),item=individual?hit:group.items[0],all=groups.flatMap(group=>group.items),last=individual?hit:group.items.at(-1),next=all[all.indexOf(last)+1];
        drag={node:item.node,x,y,baseX:measured.records.get(item.node).x,baseY:measured.records.get(item.node).y,next:next&&next.node,nextX:next&&next.x,nextY:next&&next.y};
      }
      if(drag&&(x!==drag.x||y!==drag.y)){
        const dx=x-drag.x,dy=y-drag.y;drag.node.x=word(drag.baseX+dx);drag.node.y=word(drag.baseY+dy);drag.node.flags|=2;const record=measured.records.get(drag.node);record.x=drag.node.x;record.y=drag.node.y;
        if(drag.next){drag.next.x=word(drag.nextX-dx);drag.next.y=word(drag.nextY-dy);drag.next.flags|=2;const next=measured.records.get(drag.next);next.x=drag.next.x;next.y=drag.next.y;}
      }
    }else drag=null;
    let needsDraw=!!drag&&changedInput;
    if(hit&&(!hover||pathKey(hit.path)!==pathKey(hover.path))){selected=hit.path.map((_,i)=>find(hit.path.slice(0,i+1)));needsDraw=true;}
    hover=hit;lastInput=signature;
    if(needsDraw)startJob(drawAll());else if(field!==lastField&&visible.some(groups=>groups.some(group=>group.items.some(item=>item.node.lowFlags===255))))startJob(drawCalled());
    lastField=field;const result=advanceJob();return result||{menuWait:true};
  }
  function load(data){const decoded=codec.decode(data);changed();tree=decoded;owner=display.screen();enabled=false;choices.fill(0);latch=0;}
  function cancel(){changed();enabled=false;pendingHandler=null;calculateRequested=false;}
  return {command,service,returned,shortcut,cancel,enabled:()=>enabled||calculateRequested||!!job,
    resetInput(){hover=null;drag=null;cancelSelection=true;},
    owns(node){const visit=items=>items.some(item=>item===node||visit(item.children));return !!live()&&visit(tree);},
    handlers:targets=>{handlers=targets;events=false;pendingHandler=null;},
    choice(index=null){if(index==null){const value=latch;latch=0;return value;}integer(index);if(index<1||index>8)fail('Choice index must be 1..8');return choices[index-1];},
    save:()=>codec.encode(tree),load,
    snapshot:()=>({enabled,active,tree:tree.length?codec.decode(codec.encode(tree)):[],choices:Array.from(choices),visible:visible.map(groups=>groups.flatMap(g=>g.items).map(({path,left,top,right,bottom})=>({path,left,top,right,bottom})))})};
}
if(typeof module==='object'&&module.exports)module.exports=createMenus;
else globalThis.AMOS_MENUS=createMenus;
