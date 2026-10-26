/* jshint esversion: 6 */
'use strict';
module.exports=async function roller2GetIconProbe(page){
  const fs=require('fs'),path=require('path'),expected=require('../fixtures/roller2/get-icon.json').frames;
  const icons=fs.readFileSync(path.join(__dirname,'../../examples/Roller2/iffp/icons.abk')).toString('base64');
  const pngs=expected.map(frame=>fs.readFileSync(path.join(__dirname,'../fixtures/roller2',frame.png)).toString('base64'));
  return page.evaluate(async({sources,icons,pngs,expected,timerSource,gpuSources})=>{
    const compiled=sources.map(source=>{const item={exports:{}};new Function('module',source)(item);return item;});const makeClock=new Function(`return (${timerSource});`)();
    const factory=name=>new Function(`return (${gpuSources[name]});`)(),model=factory('model')(),sprites=factory('sprites')();
    const createGpu=factory('renderer')(model,sprites,factory('resources')(model),factory('shaders'),factory('layout'));
    const check=(v,m)=>{if(!v)throw Error(m);},release=gpu=>{if(!gpu)return;const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();};
    const goldens=await Promise.all(pngs.map(async bytes=>{const image=new Image();image.src=`data:image/png;base64,${bytes}`;await image.decode();const c=document.createElement('canvas');c.width=320;c.height=200;c.getContext('2d').drawImage(image,0,0);return c.getContext('2d').getImageData(0,0,320,200).data;}));
    function make(overwrite=false){const clock=makeClock(4),program=compiled[overwrite?1:0].exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files:{read(name){if(name==='icons')return atob(icons);throw Error('Unexpected fixture file');},exists(name){check(name==='RII:levl/1','Unexpected requester path');return false;},write(){throw Error('Unexpected persistence');}}});program.tick(5000);return{program,clock};}
    const run=make(),canvas=document.createElement('canvas'),host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}});let gpu=null,gpuHost=null,gpuUnavailable=null,frames=0,gpuFrames=0;
    try{gpu=createGpu(document.createElement('canvas'));gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});}catch(e){gpuUnavailable=e.message;}
    try{host.attach(run.program);if(gpuHost)gpuHost.attach(run.program);
      for(const [index,frame]of expected.entries()){
        const stage=index%3;
        if(index===3){host.detach();if(gpuHost)gpuHost.detach();run.program.stop();Object.assign(run,make(true));host.attach(run.program);if(gpuHost)gpuHost.attach(run.program);}else if(stage){run.program.sendKey('next');run.clock.tick(stage===1?100:4);}
        check(run.program.state.waiting==='key','Capture fixture missed guard');
        if(stage){const image=run.program.banks.get(2).images[117],top=index<3?100:80;check(image.width===112&&image.height===frame.height&&image.depth===6&&image.masked,'Captured image metadata differs');check(image.pixels.every((v,i)=>v===(i%112<106?((Math.floor(i/112)+top)*3)%63+1:0)),'Captured source pixels/padding differ');}
        host.render();const rgba=canvas.getContext('2d').getImageData(0,0,320,200).data;check(rgba.every((v,i)=>v===goldens[index][i]),'Independent requester pixels differ');frames++;
        if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:`Canvas: ${frame.mode} ${frame.stage}`,width:320,height:200,rgba});
        if(gpuHost){const old=run.program.display.canvasFrame;run.program.display.canvasFrame=()=>{throw Error('GPU used CPU presentation');};try{gpuHost.render();}finally{run.program.display.canvasFrame=old;}const actual=gpu.readPixels(),cpu=run.program.display.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&actual.length===cpu.length&&actual.every((v,i)=>v===cpu[i]),'Requester GPU differs');gpuFrames++;if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: ${frame.mode} ${frame.stage}`,width:640,height:200,rgba:actual});}}

    }finally{host.detach();if(gpuHost)gpuHost.detach();run.program.stop();release(gpu);}
    if(globalThis.AMOS_ROLLER2_GET_ICON_CLEANUP)await globalThis.AMOS_ROLLER2_GET_ICON_CLEANUP();const old=document.getElementById('roller2-get-icon-controls');if(old)old.remove();
    const controls=document.createElement('section');controls.id='roller2-get-icon-controls';const help=document.createElement('p');help.textContent='Original Roller II missing-level line 480 or overwrite lines 490–491 capture icon 118 and show the original prompt over prepared stripes. Step to restore: missing-level uses its original Paste Icon; overwrite uses a declared synthetic restore preview. WTIN/WTREL are Wait Key guards; editor input, board setup and persistence are excluded.';
    const viewport=document.createElement('section'),toolbar=document.createElement('div'),slot=document.createElement('div'),status=document.createElement('p');viewport.id='roller2-get-icon-viewport';toolbar.className='amos-fullscreen-toolbar';let surface=document.createElement('canvas');surface.id='roller2-get-icon-input';slot.append(surface);
    const step=document.createElement('button'),mode=document.createElement('select'),restart=document.createElement('button'),full=document.createElement('button'),fullStatus=document.createElement('span');step.id='roller2-get-icon-step';mode.id='roller2-get-icon-mode';mode.setAttribute('aria-label','Original requester');for(const value of ['missing','overwrite']){const option=document.createElement('option');option.value=value;option.textContent=value==='missing'?'Missing level':'Overwrite preview';mode.append(option);}restart.id='roller2-get-icon-restart';full.id='roller2-get-icon-fullscreen';step.textContent='Next requester stage';restart.textContent='Restart';toolbar.append(mode,step,restart,full,fullStatus);viewport.append(toolbar,slot,status);controls.append(help,viewport);document.body.append(controls);
    let liveGpu=null;try{liveGpu=createGpu(surface);}catch(_){const next=surface.cloneNode();surface.replaceWith(next);surface=next;}
    let live=null,adapter=null,stage=0,error='';
    function update(){controls.dataset.phase=error?'error':['prepared','popup','restored'][stage];controls.dataset.backend=liveGpu?'webgl':'canvas';controls.dataset.mode=mode.value;step.disabled=!!error||stage===2;status.textContent=error||`${mode.value}; ${controls.dataset.phase}; ${liveGpu?'WebGL2':'Canvas 2D (WebGL unavailable)'}; capture width 106, stored width 112`;fullscreen.refresh();}
    function start(){try{if(adapter)adapter.detach();if(live)live.program.stop();if(liveGpu)liveGpu.clear();stage=0;error='';live=make(mode.value==='overwrite');adapter=AMOS_BROWSER.createCanvasHost(surface,{renderer:liveGpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});adapter.attach(live.program);adapter.render();update();}catch(e){error=e.message;if(live)live.program.stop();update();}}
    function advance(){try{live.program.sendKey('next');live.clock.tick(stage===0?100:4);stage++;adapter.render();update();}catch(e){error=e.message;live.program.stop();update();}}
    const fullscreen=AMOS_FULLSCREEN.createFullscreenHost(viewport,{button:full,statusElement:fullStatus,surface:slot,getContent:()=>surface});step.addEventListener('click',advance);mode.addEventListener('change',start);restart.addEventListener('click',start);start();
    globalThis.AMOS_ROLLER2_GET_ICON_CLEANUP=()=>{if(adapter)adapter.detach();if(live)live.program.stop();release(liveGpu);return fullscreen.dispose();};
    return{frames,gpuFrames,gpuUnavailable,captureCases:2,editorRunning:false};
  },{sources:[false,true].map(mode=>new(require('../../lib/Transpiler'))(require('./roller2GetIcon')(mode)).toModule()),icons,pngs,expected,timerSource:require('./fakeTimers').createFakeTimers.toString(),gpuSources:require('./webglHostSources')()});
};
