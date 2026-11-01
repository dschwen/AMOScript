'use strict';
module.exports=async function asmRoomsProbe(page){
  const fs=require('fs'),T=require('../../lib/Transpiler'),intro=require('../../tools/asmIntroAssets').prepare();
  return page.evaluate(({source,assets,fonts,oracle,entrySource,clockSource,gpuSources})=>{
    const make=s=>new Function(`return (${s});`)(),model=make(gpuSources.model)(),check=(v,m)=>{if(!v)throw Error(m);};
    const mod={exports:{}};new Function('module',source)(mod);
    const gpu=make(gpuSources.renderer)(model,make(gpuSources.sprites)(),make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout))(document.createElement('canvas'));
    const canvas=document.createElement('canvas'),cpuHost=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}}),gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
    const entry=make(entrySource),clockFactory=make(clockSource),diskFonts=fonts.map(f=>({...f,data:Uint8Array.from(f.data)}));
    let active=null,frames=0,gpuFrames=0,independentPixels=0;
    function show(room,record){
      cpuHost.detach();gpuHost.detach();if(active)active.stop();
      const clock=clockFactory(4),files={...assets,'ram:level':btoa('2\r\n'),'fixture:room':btoa(room+'\r\n')};
      const p=mod.exports({displayOptions:{diskFonts},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files:{read:n=>{if(!(n.toLowerCase() in files))throw Error('Missing '+n);return atob(files[n.toLowerCase()]);},write:(n,b)=>{files[n.toLowerCase()]=btoa(b);},remove:n=>{delete files[n.toLowerCase()];},exists:n=>Object.keys(files).some(k=>k.startsWith(n.toLowerCase()))},print(){}});active=p;
      entry(p,clock,room);
      const expected=Uint8Array.from(atob(oracle[room]),c=>c.charCodeAt(0)),pixels=p.display.screen(2).pixels;
      check(pixels.length===expected.length&&pixels.every((v,i)=>v===expected[i]),'Independent room '+room+' bitmap/Bob mismatch');
      cpuHost.attach(p);gpuHost.attach(p);cpuHost.render();const cpu=p.display.canvasFrame(),old=p.display.canvasFrame;p.display.canvasFrame=()=>{throw Error('Room GPU used CPU presentation');};try{gpuHost.render();}finally{p.display.canvasFrame=old;}
      const actual=gpu.readPixels(),reference=p.display.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&actual.length===reference.length&&actual.every((v,i)=>v===reference[i]),'Room '+room+' WebGL mismatch');
      if(record){frames++;gpuFrames++;independentPixels+=pixels.length;if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:'Canvas: ASM room '+room+' (prepared entry)',width:cpu.width,height:cpu.height,rgba:cpu.rgba});globalThis.AMOS_DEMO_OBSERVE({name:'WebGL: ASM room '+room+' (prepared entry)',width:gpu.stats.lastResult.width,height:gpu.stats.lastResult.lines,rgba:actual});}}
      p.stop(); // Keep the declared final frame; this preview is not a quest teleport.
    }
    try{for(let room=1;room<=23;room++)show(room,true);}catch(error){cpuHost.detach();gpuHost.detach();if(active)active.stop();gpu.dispose();throw error;}
    const section=document.createElement('section'),heading=document.createElement('h2');heading.textContent='Explore the 23 prepared room entries';section.append(heading);
    const note=document.createElement('p');note.textContent='These previews run the original room setup on fresh declared state. They do not bypass puzzles in the game. Rooms 16, 19 and 20 use recovered packed artwork; all room assets are also bundled into the main game.';section.append(note);
    const select=document.createElement('select');select.setAttribute('aria-label','Room preview');for(let i=1;i<=23;i++){const opt=document.createElement('option');opt.value=String(i);opt.textContent='Room '+i;select.append(opt);}section.append(select);
    const link=document.createElement('a');link.textContent='Play the main game (WebGL)';link.href='https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/asm-room1.html';section.append(' · ',link);
    for(const [label,surface]of [['Canvas',canvas],['WebGL',gpu.resources.context.canvas]]){const p=document.createElement('p');p.textContent=label;section.append(p);surface.style.cssText='display:block;width:640px;max-width:100%;image-rendering:pixelated';section.append(surface);}document.body.append(section);
    select.onchange=()=>show(Number(select.value),false);show(1,false);
    globalThis.AMOS_ASM_ROOMS_DISPOSE=()=>{cpuHost.detach();gpuHost.detach();if(active)active.stop();const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();section.remove();};
    return {rooms:23,frames,gpuFrames,independentPixels,preparedEntries:true};
  },{source:new T(require('./asmRoomsFixture')()).toModule(),assets:require('../../tools/asmGameAssets').prepare(),fonts:intro.diskFonts.map(f=>({...f,data:Array.from(f.data)})),oracle:require('../fixtures/asm/rooms.json').rooms,entrySource:require('./asmRoomEntry').toString(),clockSource:require('./fakeTimers').createFakeTimers.toString(),gpuSources:require('./webglHostSources')()});
};
