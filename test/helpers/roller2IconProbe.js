/* jshint esversion: 6 */
'use strict';
module.exports=async function roller2IconProbe(page){
  const fs=require('fs'),path=require('path');
  return page.evaluate(async({source,icons,beforePNG,afterPNG,timerSource,gpuSources})=>{
    const compiled={exports:{}};new Function('module',source)(compiled);const makeClock=new Function(`return (${timerSource});`)();
    const factory=name=>new Function(`return (${gpuSources[name]});`)(),model=factory('model')(),sprites=factory('sprites')();
    const createGpu=factory('renderer')(model,sprites,factory('resources')(model),factory('shaders'),factory('layout'));
    const check=(value,message)=>{if(!value)throw new Error(message);};
    const release=gpu=>{if(!gpu)return;const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();};
    async function decode(png){const image=new Image();image.src=`data:image/png;base64,${png}`;await image.decode();const c=document.createElement('canvas');c.width=320;c.height=200;c.getContext('2d').drawImage(image,0,0);return c.getContext('2d').getImageData(0,0,320,200).data;}
    const expected=[await decode(beforePNG),await decode(afterPNG)];
    function make(){const clock=makeClock(),program=compiled.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files:{read:name=>{if(name!=='icons')throw Error('Unexpected icon asset');return atob(icons);}}});return{program,clock};}
    const proof=make(),canvas=document.createElement('canvas'),host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}});let gpu=null,gpuHost=null,gpuUnavailable=null,gpuFrames=0;
    try{gpu=createGpu(document.createElement('canvas'));gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});}catch(e){gpuUnavailable=e.message;}
    try{
      host.attach(proof.program);if(gpuHost)gpuHost.attach(proof.program);proof.program.tick(1000);
      for(let step=0;step<2;step++){
        if(step){proof.program.sendKey('copy');proof.clock.tick(0);}host.render();const pixels=canvas.getContext('2d').getImageData(0,0,320,200).data;
        check(pixels.every((v,i)=>v===expected[step][i]),`Independent ${step?'after':'before'} icon pixels differ`);
        const name=`${step?'after':'before'} original ICCOPY`;if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:`Canvas: ${name}`,width:320,height:200,rgba:pixels});
        if(gpuHost){const old=proof.program.display.canvasFrame;proof.program.display.canvasFrame=()=>{throw Error('GPU used CPU presentation');};try{gpuHost.render();}finally{proof.program.display.canvasFrame=old;}
          const rgba=gpu.readPixels(),cpu=proof.program.display.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&rgba.length===cpu.length&&rgba.every((v,i)=>v===cpu[i]),'Icon GPU differs');gpuFrames++;
          if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: ${name}`,width:640,height:200,rgba});}
      }
      check(proof.program.state.waiting==='key','ICCopy missed its completion guard');
    }finally{host.detach();if(gpuHost)gpuHost.detach();proof.program.stop();release(gpu);}
    if(globalThis.AMOS_ROLLER2_ICON_CLEANUP)await globalThis.AMOS_ROLLER2_ICON_CLEANUP();const old=document.getElementById('roller2-icon-controls');if(old)old.remove();
    const controls=document.createElement('section');controls.id='roller2-icon-controls';const help=document.createElement('p');help.textContent='Original ICCOPY procedure and game-entry calls copy icon 76 to 18 and 74 to 29, including the original 193rd byte in rounded record padding. Pixels update through the raw planar alias; existing masks stay unchanged. The preview shows icons 18, 29, 76, 74. Copy executes original line 570; Reset reloads original assets. Game screen/level setup is excluded.';
    const viewport=document.createElement('section'),toolbar=document.createElement('div'),slot=document.createElement('div'),status=document.createElement('p');viewport.id='roller2-icon-viewport';toolbar.className='amos-fullscreen-toolbar';
    let surface=document.createElement('canvas'),liveGpu=null;surface.id='roller2-icon-input';slot.append(surface);const fullButton=document.createElement('button'),fullStatus=document.createElement('span');fullButton.id='roller2-icon-fullscreen';toolbar.append(fullButton,fullStatus);viewport.append(toolbar,slot,status);controls.append(help,viewport);document.body.append(controls);
    try{liveGpu=createGpu(surface);}catch(_){const gl=surface.getContext('webgl2'),ext=gl&&gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();const next=surface.cloneNode();surface.replaceWith(next);surface=next;}
    let live=null,adapter=null,copied=false;
    const copy=document.createElement('button');copy.id='roller2-icon-copy';copy.textContent='Run original ICCOPY';const reset=document.createElement('button');reset.id='roller2-icon-reset';reset.textContent='Reset';toolbar.append(copy,reset);
    function update(){controls.dataset.phase=copied?'copied':'original';controls.dataset.backend=liveGpu?'webgl':'canvas';copy.disabled=copied;status.textContent=`${controls.dataset.phase}; ${liveGpu?'WebGL2':'Canvas 2D (WebGL unavailable)'}; masks preserved; game setup excluded`;fullscreen.refresh();}
    function start(){if(adapter)adapter.detach();if(live)live.program.stop();if(liveGpu)liveGpu.clear();live=make();adapter=AMOS_BROWSER.createCanvasHost(surface,{renderer:liveGpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});adapter.attach(live.program);live.program.tick(1000);adapter.render();copied=false;update();}
    copy.addEventListener('click',()=>{live.program.sendKey('copy');live.clock.tick(0);adapter.render();copied=true;update();});reset.addEventListener('click',start);
    const fullscreen=AMOS_FULLSCREEN.createFullscreenHost(viewport,{button:fullButton,statusElement:fullStatus,surface:slot,getContent:()=>surface});start();
    globalThis.AMOS_ROLLER2_ICON_CLEANUP=()=>{adapter.detach();live.program.stop();release(liveGpu);return fullscreen.dispose();};
    return{frames:2,gpuFrames,gpuUnavailable,copiedIcons:2,bytesPerCopy:193,masksRegenerated:false,gameRunning:false};
  },{source:new(require('../../lib/Transpiler'))(require('./roller2IconCopy')()).toModule(),icons:fs.readFileSync(path.join(__dirname,'../../examples/Roller2/iffp/icons.abk')).toString('base64'),
    beforePNG:fs.readFileSync(path.join(__dirname,'../fixtures/roller2/icon-copy-before.png')).toString('base64'),afterPNG:fs.readFileSync(path.join(__dirname,'../fixtures/roller2/icon-copy-after.png')).toString('base64'),timerSource:require('./fakeTimers').createFakeTimers.toString(),gpuSources:require('./webglHostSources')()});
};
