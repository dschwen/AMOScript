/* jshint esversion: 6 */
'use strict';
module.exports=async function roller2BoardProbe(page){
  const fs=require('fs'),path=require('path'),expected=require('../fixtures/roller2/boards.json').levels;
  const icons=fs.readFileSync(path.join(__dirname,'../../examples/Roller2/iffp/icons.abk')).toString('base64');
  const levels=Object.fromEntries(expected.map(item=>[item.level,fs.readFileSync(path.join(__dirname,'../../examples/Roller2/levl',item.level)).toString('base64')]));
  const pngs=Object.fromEntries(expected.map(item=>[item.level,fs.readFileSync(path.join(__dirname,'../fixtures/roller2',item.png)).toString('base64')]));
  return page.evaluate(async({source,icons,levels,pngs,expected,timerSource,gpuSources})=>{
    const compiled={exports:{}};new Function('module',source)(compiled);const makeClock=new Function(`return (${timerSource});`)();
    const factory=name=>new Function(`return (${gpuSources[name]});`)(),model=factory('model')(),sprites=factory('sprites')();
    const createGpu=factory('renderer')(model,sprites,factory('resources')(model),factory('shaders'),factory('layout'));
    const check=(value,message)=>{if(!value)throw new Error(message);};
    const release=gpu=>{if(!gpu)return;const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();};
    async function golden(level){const image=new Image();image.src=`data:image/png;base64,${pngs[level]}`;await image.decode();const c=document.createElement('canvas');c.width=320;c.height=200;c.getContext('2d').drawImage(image,0,0);return c.getContext('2d').getImageData(0,0,320,200).data;}
    function make(level){const clock=makeClock(4),program=compiled.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files:{read(name){if(name==='icons')return atob(icons);if(name==='level')return atob(levels[level]);throw new Error(`Unexpected board file: ${name}`);}}});return{program,clock};}
    let frames=0,gpuFrames=0,gpuUnavailable=null;
    for(const item of expected){
      const reference=await golden(item.level),run=make(item.level),canvas=document.createElement('canvas');let gpu=null,gpuHost=null;
      const host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
      if(item.level==='1'){try{gpu=createGpu(document.createElement('canvas'));gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});}catch(e){gpuUnavailable=e.message;}}
      function capture(name,black=false){host.render();const rgba=canvas.getContext('2d').getImageData(0,0,320,200).data;
        check(rgba.every((value,index)=>value===(black?(index%4===3?255:0):reference[index])),`${name}: independent board pixels differ`);frames++;
        if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:`Canvas: ${name}`,width:320,height:200,rgba});
        if(gpuHost){const old=run.program.display.canvasFrame;run.program.display.canvasFrame=()=>{throw new Error('GPU used CPU presentation');};try{gpuHost.render();}finally{run.program.display.canvasFrame=old;}const pixels=gpu.readPixels(),cpu=run.program.display.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&pixels.length===cpu.length&&pixels.every((value,index)=>value===cpu[index]),'Board GPU differs');gpuFrames++;
          if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: ${name}`,width:640,height:200,rgba:pixels});}}
      try{host.attach(run.program);if(gpuHost)gpuHost.attach(run.program);run.program.tick(1000);run.clock.tick(700);
        check(run.program.state.waiting==='key'&&run.program.state.variables.int_counted===item.countedTiles,`Level ${item.level}: original GAMEDISP count differs`);
        const payload=atob(levels[item.level]).slice(20);check(run.program.banks.get(10).data.every((value,index)=>value===payload.charCodeAt(index)),'GAMEDISP modified the map');
        if(item.level==='1')capture('board rendered with original black palette',true);
        run.program.sendKey('palette');run.clock.tick(4);check(run.program.state.waiting==='key','Palette preview escaped its guard');capture(`original level ${item.level} board`);
      }finally{host.detach();if(gpuHost)gpuHost.detach();run.program.stop();release(gpu);}
    }
    if(globalThis.AMOS_ROLLER2_BOARD_CLEANUP)await globalThis.AMOS_ROLLER2_BOARD_CLEANUP();const old=document.getElementById('roller2-board-controls');if(old)old.remove();
    const controls=document.createElement('section');controls.id='roller2-board-controls';const help=document.createElement('p');help.textContent='Original GAMEDISP draws each supplied level using its background colours, original icon copies and retained masks. The harness loads assets, simulates the original FDZ wait, and restores the icon palette for inspection. The 320×192 board occupies a 320×200 preview. Foreground prompt integration, sprites and gameplay remain excluded.';
    const select=document.createElement('select');select.id='roller2-board-level';select.setAttribute('aria-label','Original Roller II board');for(const item of expected){const option=document.createElement('option');option.value=item.level;option.textContent=`Level ${item.level}`;select.append(option);}
    const load=document.createElement('button');load.id='roller2-board-load';load.textContent='Reload board';
    const viewport=document.createElement('section'),toolbar=document.createElement('div'),slot=document.createElement('div'),status=document.createElement('p');viewport.id='roller2-board-viewport';toolbar.className='amos-fullscreen-toolbar';
    let surface=document.createElement('canvas'),liveGpu=null;surface.id='roller2-board-input';slot.append(surface);const fullButton=document.createElement('button'),fullStatus=document.createElement('span');fullButton.id='roller2-board-fullscreen';toolbar.append(select,load,fullButton,fullStatus);viewport.append(toolbar,slot,status);controls.append(help,viewport);document.body.append(controls);
    try{liveGpu=createGpu(surface);}catch(_){const gl=surface.getContext('webgl2'),ext=gl&&gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();const next=surface.cloneNode();surface.replaceWith(next);surface=next;}
    let live=null,adapter=null,error='';
    function update(){controls.dataset.phase=error?'error':'ready';controls.dataset.level=select.value;controls.dataset.backend=liveGpu?'webgl':'canvas';controls.dataset.count=String(live?live.program.state.variables.int_counted:0);status.textContent=error||`Level ${select.value}; GAMEDISP count ${controls.dataset.count}; ${liveGpu?'WebGL2':'Canvas 2D (WebGL unavailable)'}; palette restored by preview harness; gameplay excluded`;fullscreen.refresh();}
    function start(){try{if(adapter)adapter.detach();if(live)live.program.stop();if(liveGpu)liveGpu.clear();error='';live=make(select.value);adapter=AMOS_BROWSER.createCanvasHost(surface,{renderer:liveGpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});adapter.attach(live.program);live.program.tick(1000);live.clock.tick(700);live.program.sendKey('palette');live.clock.tick(4);adapter.render();update();}catch(e){error=e.message;if(live)live.program.stop();update();}}
    select.addEventListener('change',start);load.addEventListener('click',start);const fullscreen=AMOS_FULLSCREEN.createFullscreenHost(viewport,{button:fullButton,statusElement:fullStatus,surface:slot,getContent:()=>surface});start();
    globalThis.AMOS_ROLLER2_BOARD_CLEANUP=()=>{if(adapter)adapter.detach();if(live)live.program.stop();release(liveGpu);return fullscreen.dispose();};
    return{levels:expected.length,frames,gpuFrames,gpuUnavailable,gameRunning:false,isolatedBoard:true};
  },{source:new(require('../../lib/Transpiler'))(require('./roller2Board')()).toModule(),icons,levels,pngs,expected,timerSource:require('./fakeTimers').createFakeTimers.toString(),gpuSources:require('./webglHostSources')()});
};
