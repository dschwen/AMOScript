/* jshint esversion: 6 */
'use strict';
module.exports=async function roller2RainbowDelProbe(page){
  const fs=require('fs'),path=require('path'),expected=require('../fixtures/roller2/rainbow-del.json').frames;
  const pngs=expected.map(frame=>fs.readFileSync(path.join(__dirname,'../fixtures/roller2',frame.png)).toString('base64'));
  return page.evaluate(async({source,pngs,expected,timerSource,gpuSources})=>{
    const compiled={exports:{}};new Function('module',source)(compiled);const makeClock=new Function(`return (${timerSource});`)();
    const factory=name=>new Function(`return (${gpuSources[name]});`)(),model=factory('model')(),sprites=factory('sprites')();
    const createGpu=factory('renderer')(model,sprites,factory('resources')(model),factory('shaders'),factory('layout'));
    const check=(v,m)=>{if(!v)throw Error(m);},release=gpu=>{if(!gpu)return;const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();};
    const goldens=await Promise.all(pngs.map(async bytes=>{const image=new Image();image.src=`data:image/png;base64,${bytes}`;await image.decode();const c=document.createElement('canvas');c.width=320;c.height=256;c.getContext('2d').drawImage(image,0,0);return c.getContext('2d').getImageData(0,0,320,256).data;}));
    function make(){const clock=makeClock(4),program=compiled.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});program.tick(1000);return{program,clock};}
    const run=make(),canvas=document.createElement('canvas'),host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}});let gpu=null,gpuHost=null,gpuUnavailable=null,frames=0,gpuFrames=0;
    try{gpu=createGpu(document.createElement('canvas'));gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});}catch(e){gpuUnavailable=e.message;}
    try{host.attach(run.program);if(gpuHost)gpuHost.attach(run.program);
      for(const [index,frame]of expected.entries()){
        if(index){run.program.sendKey('next');run.clock.tick(4);}
        check(run.program.state.waiting==='key'&&run.program.display.current===1&&run.program.state.frames.length===(index===0?1:0),'Original line 557 control state differs');
        check(JSON.stringify(Array.from(run.program.display.rainbows.keys()))===JSON.stringify(frame.slots),'Deleted rainbow slots differ');check(run.program.display.screen().pixels.every(v=>v===1),'Rainbow Del wrote indexed pixels');
        host.render();const rgba=canvas.getContext('2d').getImageData(0,0,320,256).data;check(rgba.every((v,i)=>v===goldens[index][i]),'Independent PAL rainbow rows differ');frames++;
        if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:`Canvas: ${frame.stage}`,width:320,height:256,rgba});
        if(gpuHost){const old=run.program.display.canvasFrame;run.program.display.canvasFrame=()=>{throw Error('GPU used CPU presentation');};try{gpuHost.render();}finally{run.program.display.canvasFrame=old;}const actual=gpu.readPixels(),cpu=run.program.display.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&actual.length===cpu.length&&actual.every((v,i)=>v===cpu[i]),'Rainbow deletion GPU differs');gpuFrames++;if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: ${frame.stage}`,width:640,height:256,rgba:actual});}}

    }finally{host.detach();if(gpuHost)gpuHost.detach();run.program.stop();release(gpu);}
    if(globalThis.AMOS_ROLLER2_RAINBOW_DEL_CLEANUP)await globalThis.AMOS_ROLLER2_RAINBOW_DEL_CLEANUP();const old=document.getElementById('roller2-rainbow-del-controls');if(old)old.remove();
    const controls=document.createElement('section');controls.id='roller2-rainbow-del-controls';const help=document.createElement('p');help.textContent='Original Roller II line 557 returns through a declared HOPSCREEN Wait Key guard before deleting slot 0. Prepared overlapping PAL tables show grayscale slot 0 over red slot 1 near the bottom. Step reveals slot 1, then a synthetic delete-all restores the screen colour. Bounce animation, editor/game return setup and input loops are excluded.';
    const viewport=document.createElement('section'),toolbar=document.createElement('div'),slot=document.createElement('div'),status=document.createElement('p');viewport.id='roller2-rainbow-del-viewport';toolbar.className='amos-fullscreen-toolbar';let surface=document.createElement('canvas');surface.id='roller2-rainbow-del-input';slot.append(surface);
    const step=document.createElement('button'),restart=document.createElement('button'),full=document.createElement('button'),fullStatus=document.createElement('span');step.id='roller2-rainbow-del-step';restart.id='roller2-rainbow-del-restart';full.id='roller2-rainbow-del-fullscreen';step.textContent='Next deletion stage';restart.textContent='Restart';toolbar.append(step,restart,full,fullStatus);viewport.append(toolbar,slot,status);controls.append(help,viewport);document.body.append(controls);
    let liveGpu=null;try{liveGpu=createGpu(surface);}catch(_){const next=surface.cloneNode();surface.replaceWith(next);surface=next;}
    let live=null,adapter=null,stage=0,error='';
    function update(){controls.dataset.phase=error?'error':expected[stage].stage;controls.dataset.backend=liveGpu?'webgl':'canvas';controls.dataset.slots=live?Array.from(live.program.display.rainbows.keys()).join(','):'';step.disabled=!!error||stage===2;status.textContent=error||`${controls.dataset.phase}; rainbow slots ${controls.dataset.slots||'none'}; ${liveGpu?'WebGL2':'Canvas 2D (WebGL unavailable)'}`;fullscreen.refresh();}
    function start(){try{if(adapter)adapter.detach();if(live)live.program.stop();if(liveGpu)liveGpu.clear();stage=0;error='';live=make();adapter=AMOS_BROWSER.createCanvasHost(surface,{renderer:liveGpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});adapter.attach(live.program);adapter.render();update();}catch(e){error=e.message;if(live)live.program.stop();update();}}
    function advance(){try{live.program.sendKey('next');live.clock.tick(4);stage++;adapter.render();update();}catch(e){error=e.message;live.program.stop();update();}}
    const fullscreen=AMOS_FULLSCREEN.createFullscreenHost(viewport,{button:full,statusElement:fullStatus,surface:slot,getContent:()=>surface});step.addEventListener('click',advance);restart.addEventListener('click',start);start();
    globalThis.AMOS_ROLLER2_RAINBOW_DEL_CLEANUP=()=>{if(adapter)adapter.detach();if(live)live.program.stop();release(liveGpu);return fullscreen.dispose();};
    return{frames,gpuFrames,gpuUnavailable,originalLines:1,bounceAnimation:false,editorRunning:false};
  },{source:new(require('../../lib/Transpiler'))(require('./roller2RainbowDel')()).toModule(),pngs,expected,timerSource:require('./fakeTimers').createFakeTimers.toString(),gpuSources:require('./webglHostSources')()});
};
