'use strict';
module.exports=async function webglHamProbe(page){
  const fs=require('fs'),path=require('path'),crypto=require('crypto'),model=require('../../lib/display/model/frameState'),frame=require('../../lib/display/model/staticFrame'),reference=require('../../lib/display/reference/render');
  const directory=path.join(__dirname,'../fixtures/display'),packets=[];
  const add=(name,snapshot,golden,independent=false)=>{let required=1;
    for(let i=snapshot.chip.length-1;i>=0;i--)if(snapshot.chip[i]){required=i+1;break;}
    const wire=model.serializeSnapshot(snapshot);packets.push({name,header:wire.header,chip:Buffer.from(wire.chip.subarray(0,required)).toString('base64'),tables:Buffer.from(wire.tables).toString('base64'),golden:Buffer.from(golden||reference.render(snapshot.chip,snapshot.frame)).toString('base64'),independent});};
  const read=item=>{const bytes=fs.readFileSync(path.join(directory,item.file));if(crypto.createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('HAM fixture hash mismatch: '+item.file);return bytes;};
  for(const item of require('../fixtures/display/ham-fixtures.json').fixtures)for(const encoding of ['raw','byterun'])for(const field of item.mode&4?[0,1]:[null]){
    const {snapshot}=require('../../lib/display/model/ilbm')(read(item.files[encoding]),field==null?{}:{field}),image=require('./displayPng').decodePng(read(item.files.golden)),golden=new Uint8Array(snapshot.frame.outputWidth*snapshot.frame.lines*4);
    for(let y=0;y<snapshot.frame.lines;y++){const at=(field==null?y:y*2+field)*image.width*4;golden.set(image.rgba.subarray(at,at+image.width*4),y*image.width*4);}
    add(item.files[encoding].file+' field '+field,snapshot,golden,true);
  }
  const pattern=(width=513,height=3,depth=6)=>{
    const rowBytes=Math.ceil(width/16)*2,chip=new Uint8Array(524288),pointers=Array.from({length:depth},(_,p)=>p*rowBytes*height);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      // Long modify-only runs, with palette resets on just one row.
      const code=y===1&&x%37===0?x%16:((1+(x+y)%3)<<4)|((x*7+y)&15);
      for(let p=0;p<depth;p++)if(code&(1<<p))chip[pointers[p]+y*rowBytes+(x>>3)]|=128>>(x&7);
    }
    return{chip,frame:frame({width,height,depth,rowBytes,pointers,palette:Array.from({length:32},(_,i)=>(i*0x123)&4095),ham:true})};
  };
  for(const depth of [5,6])for(const crop of [0,1,197,801]){
    const s=pattern(513,3,depth);for(let y=0;y<3;y++){s.frame.lineRegs[y*32+13]=(-crop)>>>0;s.frame.lineRegs[y*32+14]=1026-crop;}
    add('HAM'+depth+' cropped prefix '+crop,s);
  }
  for(const scroll of [0,0x13,0xf0,0xff])for(const offset of [-17,13]){
    const s=pattern();for(let y=0;y<3;y++){s.frame.lineRegs[y*32+9]=scroll;s.frame.lineRegs[y*32+15]=offset>>>0;}add('scroll '+scroll+' offset '+offset,s);
  }
  for(const flags of [0,1,2,3]){const s=pattern(33);s.frame.lineRegs[16]=flags;s.frame.lineRegs[45]=13;s.frame.lineRegs[46]=51;add('DMA and borders '+flags,s);}
  const disabled=pattern(33,1);disabled.frame.lineRegs[16]=0;add('all DMA disabled',disabled);
  const ecs=pattern(65);ecs.frame.chipset='ECS';ecs.frame.samplesPerLowresPixel=4;ecs.frame.outputWidth*=2;for(let y=0;y<3;y++)ecs.frame.lineRegs[y*32+14]*=2;add('ECS four native samples',ecs);
  const mixed=pattern(97,4);mixed.frame.lineRegs[8]=0x6000;mixed.frame.lineRegs[40]=0x6000|0x400;mixed.frame.lineRegs[72]=0x6000|0x800;mixed.frame.lineRegs[104]=0x5000|0x800;
  mixed.frame.linePal.set([255,0,255,255],2*1024);mixed.frame.linePal.set([0,255,255,255],3*1024);add('mixed EHB DPF HAM6 HAM5 rows',mixed);
  for(const attached of [false,true])for(const priority of [0,0x24]){
    const s=pattern(65);for(let y=0;y<3;y++){s.frame.lineRegs[y*32+10]=priority;for(let c=0;c<4;c++)s.frame.lineSprites.set([10+c*8,0xa5a5,0x5a5a,0x80000000|((c&1)&&attached?1:0)],y*32+c*4);}add('sprites '+attached+' priority '+priority,s);
  }
  // 4096 decoded source positions including a large clipped prefix. An offset
  // aliases existing chip bytes; no oversized bitmap or hidden CPU RGB upload.
  const limit=pattern(2048,1);limit.frame.lineRegs[13]=(-4096)>>>0;limit.frame.lineRegs[14]=4096;add('4096 source-pixel bound',limit);
  const small=pattern(1,1);add('one source pixel',small);
  return page.evaluate(async({sources,packets})=>{
    const make=s=>new Function('return ('+s+')')(),model=make(sources.model)(),gpu=make(sources.renderer)(model,make(sources.sprites)(),make(sources.resources)(model),make(sources.shaders),make(sources.layout))(document.createElement('canvas'));
    const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)),check=(v,m)=>{if(!v)throw Error('GPU HAM: '+m);},equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
    let frames=0,independentFrames=0,independentPixels=0,maxPasses=0;
    const snapshot=p=>{const chip=new Uint8Array(p.header.chipByteLength);chip.set(bytes(p.chip));return model.deserializeSnapshot(p.header,chip,bytes(p.tables));};
    const render=packet=>{const s=snapshot(packet),before=gpu.stats.drawCalls,result=gpu.render(s),actual=gpu.readPixels(),expected=bytes(packet.golden);check(result.backend==='gpu'&&result.passes===gpu.stats.drawCalls-before&&result.passes>=2,'native scan passes '+packet.name);check(equal(actual,expected),packet.name+' colour mismatch at byte '+actual.findIndex((v,i)=>v!==expected[i]));frames++;maxPasses=Math.max(maxPasses,result.passes);if(packet.independent){independentFrames++;independentPixels+=expected.length/4;}if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:'WebGL: '+packet.name,width:s.frame.outputWidth,height:s.frame.lines,rgba:actual});return s;};
    try{
      for(const packet of packets)render(packet);
      const original=snapshot(packets[0]),before=gpu.stats.drawCalls;
      for(const [name,change]of[
        ['HAM4',s=>{s.frame.lineRegs[8]=0x4800;}],['hires HAM',s=>{s.frame.lineRegs[8]=0xe800;}],['dual HAM',s=>{s.frame.lineRegs[8]=0x6c00;}],
        ['span',s=>{s.frame.lineRegs[13]=(-8192)>>>0;}],['fetch',s=>{s.frame.lineRegs[0]=s.chip.length-2;}],['events',s=>{s.frame.lineRegs[17]=1;s.frame.lineEvents[1]=0x180;}]
      ]){const s=model.createSnapshot(original);change(s);let rejected=false;try{gpu.render(s);}catch(e){rejected=name==='fetch'?/fetch out of bounds/.test(e.message):true;}check(rejected&&gpu.stats.drawCalls===before,'reject '+name+' before draws');}
      const packet=packets[0];render(packet);const canvas=gpu.resources.context.canvas,extension=gpu.resources.context.getExtension('WEBGL_lose_context');check(extension,'context loss extension');
      const event=name=>new Promise(resolve=>canvas.addEventListener(name,()=>setTimeout(resolve,0),{once:true}));
      gpu.present({width:640,height:400});let pending=event('webglcontextlost');extension.loseContext();await pending;
      check(gpu.render(snapshot(packets[2])).backend==='unavailable','lost context does not use CPU fallback');
      pending=event('webglcontextrestored');extension.restoreContext();await pending;check(gpu.state==='ready'&&equal(gpu.readPixels(),bytes(packets[2].golden)),'restore latest retained HAM frame');
      const normal=model.createSnapshot(original);for(let y=0;y<normal.frame.lines;y++)normal.frame.lineRegs[y*32+8]&=~0x800;check(gpu.render(normal).passes===2,'normal frame keeps two passes');let released=false;try{gpu.resources.getTexture('hamA');}catch(e){released=true;}check(released,'release HAM scratch targets on normal transition');
      const empty=model.createSnapshot({chip:original.chip,frame:{...original.frame,lines:0,outputHeight:1,interlaceField:1,lineRegs:new Uint32Array(0),linePal:new Uint8Array(0),lineSprites:new Uint32Array(0),lineEvents:new Uint32Array(0),eventOffsets:new Uint32Array(1),overflowEvents:new Uint32Array(0)}});
      render(packets.at(-1));check(gpu.render(empty).backend==='gpu-empty','empty field transition');let emptyReleased=false;try{gpu.resources.getTexture('hamA');}catch(e){emptyReleased=true;}check(emptyReleased,'release HAM scratch on empty transition');
      render(packets.at(-1));gpu.clear();pending=event('webglcontextlost');extension.loseContext();await pending;pending=event('webglcontextrestored');extension.restoreContext();await pending;check(gpu.stats.lastResult===null,'clear prevents stale restoration');
      return{frames,independentFrames,independentPixels,maxPasses,restored:true,rejected:6,nonHamPasses:2};
    }finally{const gl=gpu.resources.context;gpu.dispose();check(gpu.state==='disposed','owned disposal');const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();}
  },{sources:require('./webglHostSources')(),packets});
};
