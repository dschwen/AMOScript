/* jshint esversion: 6 */
'use strict';
const assert=require('assert');
const {createFullscreenHost}=require('../lib/amos/fullscreen');
function fixture(){
  const node=()=>{const listeners=new Map(),classes=new Set();return {style:{width:'',height:''},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},listeners,
    addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),setAttribute(name,value){this[name]=value;},remove(){this.removed=true;}};};
  const doc=node(),win=node(),button=node(),root=node(),surface=node(),status=node();let exits=0;
  let image={...node(),width:320,height:200,clientWidth:640,clientHeight:400,offsetWidth:644,offsetHeight:404};image.style.width='640px';
  doc.defaultView=win;doc.head={appendChild(){}};doc.createElement=node;doc.fullscreenEnabled=true;doc.fullscreenElement=null;root.ownerDocument=doc;
  surface.clientWidth=800;surface.clientHeight=600;surface.querySelector=()=>image;
  const changed=()=>{const fn=doc.listeners.get('fullscreenchange');if(fn)fn();};
  root.requestFullscreen=()=>{doc.fullscreenElement=root;changed();return Promise.resolve();};
  doc.exitFullscreen=()=>{exits++;doc.fullscreenElement=null;changed();return Promise.resolve();};
  return {doc,win,button,root,surface,status,create:()=>createFullscreenHost(root,{button,surface,statusElement:status}),get image(){return image;},replace(){const old=image;image={...node(),width:640,height:404,offsetWidth:644,clientWidth:640,offsetHeight:408,clientHeight:404};return old;},exits:()=>exits,changed};
}

test('fullscreen: fits CSS without resizing the bitmap, Escape exits and ordinary styles return',async()=>{
  const f=fixture(),host=f.create();assert.strictEqual(await host.toggle(),true);assert.strictEqual(f.doc.fullscreenElement,f.root);
  assert.strictEqual(f.image.width,320);assert.strictEqual(f.image.height,200);assert.strictEqual(f.image.style.width,'796px');assert.strictEqual(f.image.style.height,'497px');
  assert.strictEqual(f.button['aria-pressed'],'true');let prevented=false,stopped=false;
  f.doc.listeners.get('keydown')({key:'Escape',preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});
  await Promise.resolve();await Promise.resolve();assert.ok(prevented&&stopped);assert.strictEqual(f.doc.fullscreenElement,null);
  assert.strictEqual(f.image.style.width,'640px');assert.strictEqual(f.image.style.height,'');await host.dispose();
});

test('fullscreen: missing permission/API or a rejected request does not throw or leave controls pending',async()=>{
  const unavailable=fixture();unavailable.doc.fullscreenEnabled=false;const off=unavailable.create();assert.strictEqual(await off.toggle(),false);assert.strictEqual(unavailable.button.disabled,true);assert.match(unavailable.status.textContent,/unavailable/);await off.dispose();
  for(const synchronous of [false,true]){
    const f=fixture();f.root.requestFullscreen=()=>{if(synchronous)throw new Error('denied');return Promise.reject(new Error('denied'));};const host=f.create();
    assert.strictEqual(await host.toggle(),false);assert.match(f.status.textContent,/denied/);assert.strictEqual(f.button.disabled,false);assert.strictEqual(host.status().pending,false);await host.dispose();
  }
});

test('fullscreen: replacing a renderer keeps the container fullscreen and disposal removes owned listeners',async()=>{
  const f=fixture(),host=f.create();await host.toggle();const old=f.replace();host.refresh();
  assert.strictEqual(f.doc.fullscreenElement,f.root);assert.strictEqual(old.style.width,'640px');assert.strictEqual(f.image.width,640);assert.ok(parseInt(f.image.style.height,10)<=596);
  await host.dispose();await host.dispose();assert.strictEqual(f.exits(),1);assert.strictEqual(f.doc.listeners.size,0);assert.strictEqual(f.win.listeners.size,0);assert.strictEqual(f.surface.listeners.size,0);
  const other=fixture(),otherHost=other.create(),unrelated={};other.doc.fullscreenElement=unrelated;await otherHost.dispose();assert.strictEqual(other.doc.fullscreenElement,unrelated);assert.strictEqual(other.exits(),0);
});

test('fullscreen: a late request resolution after disposal exits only the owned container',async()=>{
  const f=fixture();let resolve;f.root.requestFullscreen=()=>new Promise(done=>{resolve=()=>{f.doc.fullscreenElement=f.root;f.changed();done();};});
  const host=f.create(),request=host.toggle(),cleanup=host.dispose();resolve();assert.strictEqual(await request,false);await cleanup;
  assert.strictEqual(f.doc.fullscreenElement,null);assert.strictEqual(f.exits(),1);assert.strictEqual(host.status().disposed,true);
});
