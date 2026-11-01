'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {binary,token:t,word:w,dword,integer:n,identifier:id,text,compile}=require('./helpers/program');
const {createFakeTimers}=require('./helpers/fakeTimers');
const root=path.join(__dirname,'../examples/Tutorial');
function run(bytes){const c=createFakeTimers(4),writes=[],p=compile(bytes).create({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,print(){},files:{read(name){const relative=name.toLowerCase().replace(/^amospro_tutorial:/,'');const known=['Objects/Menu_Bobs.Abk','Tutorials/Menus/Data.Menu'].find(file=>file.toLowerCase()===relative);if(!known)throw Error('Unexpected test asset '+name);return fs.readFileSync(path.join(root,known)).toString('latin1');},write(name,data){writes.push({name,data});}}});p.tick(1000);return {p,c,writes};}
const original=number=>fs.readFileSync(path.join(root,`Tutorials/Menus/Menus_${number}.AMOS`));
function mouse(p,c,x,y,buttons){p.setMouse(p.display.coordinate('X Hard',0,x),p.display.coordinate('Y Hard',0,y),buttons);c.tick(40);}
function open(p,c){mouse(p,c,4,4,2);assert.strictEqual(p.menuSnapshot().active,true);}
function item(p,path){return p.menuSnapshot().visible.flat().find(item=>item.path.join(',')===path.join(','));}
function hover(p,c,path){const target=item(p,path);assert.ok(target,'Missing menu path '+path);mouse(p,c,target.left+2,target.top+2,2);return target;}
function select(p,c,path){for(let depth=1;depth<=path.length;depth++)hover(p,c,path.slice(0,depth));const target=item(p,path);mouse(p,c,target.left+2,target.top+2,0);}
const menuLine=(path,value)=>[t('Menu$'),t('('),path.flatMap((v,i)=>[...(i?t(','):[]),n(v)]),t(')'),t('='),text(value)];
const proc=name=>[t('Procedure'),dword(0),w(0),0,0,id(name)];

test('Menus: all nine original tutorial bodies open and close indexed menus with ordinary input and no retained timers after Stop',()=>{
  for(let number=1;number<=9;number++){
    const {p,c}=run(original(number));
    try{const before=p.display.screen(0).pixels.slice();open(p,c);const title=item(p,[1]);mouse(p,c,title.left+2,title.top+2,2);assert.ok(p.menuSnapshot().visible.length>=2,'Menus_'+number);assert.notDeepStrictEqual(p.display.screen(0).pixels,before);assert.ok(p.display.renderDisplay().length);mouse(p,c,-100,-100,0);assert.strictEqual(p.menuSnapshot().active,false);assert.strictEqual(p.state.frames.length,0);assert.strictEqual(p.state.stack.length,0);assert.strictEqual(p.menuChoice(1),0);}finally{p.stop();}assert.strictEqual(c.pending(),0);
  }
});

test('Menus: original Choice polling selects a colour and text style without handler or VM edits',()=>{
  const {p,c}=run(original(1));try{open(p,c);select(p,c,[3,4]);assert.strictEqual(p.menuChoice(1),3);assert.strictEqual(p.menuChoice(2),4);assert.strictEqual(p.display.screen().ink,4);assert.strictEqual(p.state.variables.int_t,3);assert.strictEqual(p.state.variables.int_p,4);assert.strictEqual(p.menuChoice(8),0);assert.throws(()=>p.menuChoice(0),/1..8/);open(p,c);select(p,c,[2,2]);assert.strictEqual(p.display.screen().textStyle,1);}finally{p.stop();}
});

test('Menus: original keyboard shortcuts dispatch real On Menu procedures and preserve Inkey/Scancode and physical holds',()=>{
  const {p,c}=run(original(4));try{p.setKeyState(51,true);p.sendKey('c',51);c.tick(40);assert.strictEqual(p.mouseShape(),3);assert.strictEqual(p.state.frames.length,0);assert.strictEqual(p.state.input.keys.length,0);assert.strictEqual(p.inputValue('Scancode'),0);assert.strictEqual(p.state.input.rawKeys[51],1);p.sendKey('2',2);c.tick(40);assert.strictEqual(p.display.screen().ink,2);p.sendKey('1',1);c.tick(40);assert.strictEqual(p.display.screen().ink,1);assert.deepStrictEqual(Array.from(p.menuSnapshot().choices).slice(0,3),[3,1,0]);p.sendKey('?',0);assert.strictEqual(p.inputValue('Inkey$'),'?');assert.strictEqual(p.inputValue('Scancode'),0);}finally{p.stop();}
});

test('Menus: source-level Menus_6 correction removes only the undefined seventh branch and retains every native offset',()=>{
  const originalBytes=fs.readFileSync(path.join(__dirname,'fixtures/tutorial/menus6-original.amos')),current=original(6),B=require('../lib/Buffer'),a=new B(originalBytes),b=new B(current),end=a.lines[178]+a.getByte(a.lines[178])*2,expected=Buffer.from(originalBytes);
  assert.throws(()=>compile(originalBytes),/Unresolved label @demos:7/);assert.strictEqual(originalBytes.subarray(end-10,end-2).toString('hex'),'005c003e00000007');Buffer.from('0054064a00022020','hex').copy(expected,end-10);assert.deepStrictEqual(current,expected);assert.deepStrictEqual(a.lines,b.lines);assert.strictEqual(a.code_bytes,b.code_bytes);assert.ok(compile(current).create);
});

test('Menus: original movable/static and inactive/active examples run their six real handler targets',()=>{
  const {p,c}=run(original(6));try{
    open(p,c);select(p,c,[2,5]);assert.ok(p.menuSnapshot().tree[2].children[3].flags&16);
    open(p,c);hover(p,c,[3]);const cyan=item(p,[3,4]);mouse(p,c,cyan.left+2,cyan.top+2,0);assert.strictEqual(p.menuChoice(1),0);
    open(p,c);select(p,c,[2,6]);assert.strictEqual(p.menuSnapshot().tree[2].children[3].flags&16,0);
    open(p,c);select(p,c,[2,4]);assert.ok(p.menuSnapshot().tree[2].children.every(n=>!(n.flags&64)));
    open(p,c);select(p,c,[2,3]);assert.ok(p.menuSnapshot().tree[2].children.every(n=>n.flags&64));assert.strictEqual(p.state.frames.length,0);assert.strictEqual(p.state.stack.length,0);
  }finally{p.stop();}
});

test('Menus: original graphical Called procedures animate at VBL boundaries and closing restores the indexed background',()=>{
  const {p,c}=run(original(7));try{
    const pixels=p.display.screen().pixels.slice();open(p,c);hover(p,c,[1]);const first=p.state.variables.int_n;c.tick(100);assert.notStrictEqual(p.state.variables.int_n,first);assert.ok(p.state.variables.int_n>=0&&p.state.variables.int_n<=63);assert.strictEqual(p.dataRegister(0),130);assert.strictEqual(p.dataRegister(1),65);assert.notDeepStrictEqual(p.display.screen().pixels,pixels);
    p.stop();assert.strictEqual(c.pending(),0);const paused=p.state.variables.int_n;c.tick(100);assert.strictEqual(p.state.variables.int_n,paused);p.resume();c.tick(40);assert.strictEqual(p.menuSnapshot().active,false);assert.deepStrictEqual(p.display.screen().pixels,pixels);assert.strictEqual(p.menuChoice(1),0);assert.strictEqual(p.state.frames.length,0);
  }finally{p.stop();}
});

test('Menus: native Bank To Menu owns its tree after erasure and Menu To Bank writes a reloadable native Menu payload',()=>{
  const {p,c}=run(original(9));try{assert.strictEqual(p.banks.has(6),false);assert.strictEqual(p.menuSnapshot().tree.length,5);open(p,c);select(p,c,[3,7]);assert.strictEqual(p.state.variables.int_f,6);p.menuToBank(12);const bank=p.banks.get(12),tree=p.menuSnapshot().tree;assert.strictEqual(bank.name,'Menu    ');p.menuCommand('Menu Del');assert.strictEqual(p.menuSnapshot().tree.length,0);p.bankToMenu(12);assert.deepStrictEqual(p.menuSnapshot().tree,tree);p.eraseBank(12);assert.strictEqual(p.menuSnapshot().tree.length,5);}finally{p.stop();}
});

test('Menus: shortcut handler interrupts preserve pending key and sleep waits, and bare Choice drains only its own latch',()=>{
  for(const waiting of ['key','sleep']){
    const bytes=binary([[t('Global'),id('hits')],menuLine([1],'Root'),menuLine([1,1],'Item'),[t('Menu Key'),t('('),n(1),t(','),n(1),t(')'),t('To'),text('x')],[t('Menu On')],[t('On Menu'),t('Proc'),id('handler')],[t('On Menu On')],waiting==='key'?[t('Wait Key')]:[t('Wait'),n(50)],[id('done'),t('='),n(1)],[t('End')],proc('handler'),[t('Inc'),id('hits')],[t('On Menu On')],[t('End Proc')]]);
    const {p,c}=run(bytes);try{assert.strictEqual(p.state.waiting,waiting);c.tick(40);p.sendKey('x',45);c.tick(40);assert.strictEqual(p.state.variables.int_hits,1);assert.strictEqual(p.state.waiting,waiting);assert.strictEqual(p.state.variables.int_done,0);assert.strictEqual(p.menuChoice(),-1);assert.strictEqual(p.menuChoice(),0);assert.strictEqual(p.menuChoice(2),1);assert.strictEqual(p.state.frames.length,0);if(waiting==='key')p.sendKey('a');else c.tick(919);assert.strictEqual(p.state.variables.int_done,0);c.tick(8);assert.strictEqual(p.state.variables.int_done,1);}finally{p.stop();}
  }
});

test('Menus: invalid drawing strings and missing paths reject before mutation; numeric On targets remain fully validated',()=>{
  const {p}=run(original(4));try{const before=p.menuSnapshot().tree;assert.throws(()=>p.menuCommand('Menu$',[1,4],['(BA 1)']),/arity/);assert.deepStrictEqual(p.menuSnapshot().tree,before);assert.throws(()=>p.menuCommand('Menu$',[99,1],['A']),/not defined/);assert.deepStrictEqual(p.menuSnapshot().tree,before);}finally{p.stop();}
  assert.throws(()=>compile(binary([[t('On'),w(0),w(0),n(0),t('Gosub'),n(1),t(','),n(7)],[id('1',0x0c),t('End')]])),/Unresolved label 7/);
  for(const branch of ['Gosub','Goto']){
    const bytes=binary([[t('Global'),id('hits')],menuLine([1],'Root'),menuLine([1,1],'Item'),[t('Menu Key'),t('('),n(1),t(','),n(1),t(')'),t('To'),text('x')],[t('Menu On')],[t('On Menu'),t(branch),n(1)],[t('On Menu On')],[t('Wait Key')],[t('End')],[id('1',0x0c),t('Inc'),id('hits')],branch==='Gosub'?[t('Return')]:[t('End')]]);
    const {p,c}=run(bytes);try{p.sendKey('x');c.tick(40);assert.strictEqual(p.state.variables.int_hits,1);assert.strictEqual(p.state.stack.length,0);assert.strictEqual(p.state.frames.length,0);assert.strictEqual(p.state.halted,branch==='Goto');if(branch==='Gosub')assert.strictEqual(p.state.waiting,'key');}finally{p.stop();}assert.strictEqual(c.pending(),0);
  }
});

test('Menus: interrupting an unfinished Input preserves its text while a handler completes its own Input',()=>{
  const bytes=binary([[t('Global'),id('first'),t(','),id('second')],menuLine([1],'Root'),menuLine([1,1],'Item'),[t('Menu Key'),t('('),n(1),t(','),n(1),t(')'),t('To'),text('x')],[t('Menu On')],[t('On Menu'),t('Proc'),id('handler')],[t('On Menu On')],[t('Input'),id('first')],[t('Wait Key')],proc('handler'),[t('Input'),id('second')],[t('End Proc')]]);
  const {p,c}=run(bytes);try{p.sendKey('1');p.sendKey('2');p.sendKey('x');c.tick(40);assert.strictEqual(p.state.waiting,'input');assert.strictEqual(p.state.frames.length,1);p.sendKey('7');p.sendKey('\r');c.tick(40);assert.strictEqual(p.state.variables.int_second,7);assert.strictEqual(p.state.frames.length,0);assert.strictEqual(p.state.waiting,'input');p.sendKey('3');p.sendKey('\r');c.tick(40);assert.strictEqual(p.state.variables.int_first,123);assert.strictEqual(p.state.waiting,'key');}finally{p.stop();}
});

test('Menus: dragging a separate native group preserves neighboring rows and static groups retain their positions',()=>{
  const {p,c}=run(original(6));try{
    open(p,c);hover(p,c,[3]);const before=p.menuSnapshot().visible[1].map(item=>({...item})),target=before[2];
    mouse(p,c,target.left+2,target.top+2,3);mouse(p,c,target.left+12,target.top+7,3);mouse(p,c,target.left+12,target.top+7,2);
    const after=p.menuSnapshot().visible[1];for(let i=0;i<before.length;i++)assert.deepStrictEqual([after[i].left,after[i].top],[before[i].left+(i===2?10:0),before[i].top+(i===2?5:0)]);
    mouse(p,c,-100,-100,0);for(let i=1;i<=10;i++)p.menuCommand('Menu Static',[3,i]);open(p,c);hover(p,c,[3]);const fixed=item(p,[3,3]);mouse(p,c,fixed.left+2,fixed.top+2,3);mouse(p,c,fixed.left+12,fixed.top+7,3);assert.deepStrictEqual([item(p,[3,3]).left,item(p,[3,3]).top],[fixed.left,fixed.top]);
  }finally{p.stop();}
});

test('Menus: Stop preserves an interrupted sleep duration and the original Quit handler retires menu wakes',()=>{
  const bytes=binary([menuLine([1],'Root'),menuLine([1,1],'Item'),[t('Menu On')],[t('Wait'),n(50)],[id('done'),t('='),n(1)],[t('End')]]);
  const {p,c}=run(bytes);try{open(p,c);p.stop();assert.strictEqual(c.pending(),0);c.tick(1000);p.resume();c.tick(40);assert.strictEqual(p.state.waiting,'sleep');assert.strictEqual(p.menuSnapshot().active,false);c.tick(919);assert.strictEqual(p.state.variables.int_done,0);c.tick(8);assert.strictEqual(p.state.variables.int_done,1);assert.strictEqual(c.pending(),0);}finally{p.stop();}
  const quit=run(original(4));try{quit.p.sendKey('q');quit.c.tick(40);assert.strictEqual(quit.p.state.halted,true);assert.strictEqual(quit.p.state.editRequest.command,'Edit');assert.strictEqual(quit.p.menuSnapshot().enabled,false);assert.strictEqual(quit.c.pending(),0);quit.p.resume();assert.strictEqual(quit.c.pending(),0);}finally{quit.p.stop();}
});

test('Menus: retiring the owning screen cancels requested calculations without waking a pending Wait Key',()=>{
  const {p,c}=run(binary([menuLine([1],'Root'),menuLine([1,1],'Item'),[t('Menu On')],[t('Wait Key')]]));
  try{p.menuCommand('Menu Calc');p.display.close(0);c.tick(100);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.state.halted,false);assert.strictEqual(p.menuSnapshot().enabled,false);assert.strictEqual(c.pending(),0);}finally{p.stop();}
});
