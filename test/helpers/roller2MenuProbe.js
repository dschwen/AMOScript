/* jshint esversion: 6 */
'use strict';
module.exports = async function roller2MenuProbe(page) {
  const fs=require('fs'),path=require('path');
  return page.evaluate(async ({source,title,png,timerSource,gpuSources})=>{
    const compiled={exports:{}};new Function('module',source)(compiled);
    const makeClock=new Function(`return (${timerSource});`)(),files={read(name){if(name!=='title')throw new Error(`Unexpected menu asset: ${name}`);return atob(title);}};
    const check=(value,message)=>{if(!value)throw new Error(message);};
    const factory=name=>new Function(`return (${gpuSources[name]});`)();
    const model=factory('model')(),sprites=factory('sprites')();
    const createGpu=factory('renderer')(model,sprites,factory('resources')(model),factory('shaders'),factory('layout'));
    const release=gpu=>{if(!gpu)return;const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();};
    const image=new Image();image.src=`data:image/png;base64,${png}`;await image.decode();
    const oracle=document.createElement('canvas');oracle.width=320;oracle.height=512;oracle.getContext('2d').drawImage(image,0,0);
    const golden=oracle.getContext('2d').getImageData(0,0,320,268).data;
    const cases=[['pointer-game',30,140,'game'],['pointer-editor',290,140,'editor'],['pointer-scores',150,140,'scores'],['pointer-help',270,46,'help'],
      ['keyboard-h',0,0,'scores'],['keyboard-help',0,0,'help'],['keyboard-fire',0,0,'game'],['gamepad-fire',0,0,'game'],['gamepad-moved-fire',28,140,'game'],['blank',80,80,'']];
    let selections=0,gpuFrames=0,gpuUnavailable=null;
    for(const [mode,x,y,action] of cases){
      const clock=makeClock(4),program=compiled.exports({files,now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
      const canvas=document.createElement('canvas');canvas.tabIndex=0;canvas.style.border='0';document.body.append(canvas);let pad=null,gpu=null,gpuHost=null;
      const host=AMOS_BROWSER.createCanvasHost(canvas,{mouseCoordinates:'hardware',hasFocus:()=>true,requestAnimationFrame:()=>1,cancelAnimationFrame(){},getGamepads:()=>[pad],joysticks:[{port:1,keyboard:true,gamepad:true}]});
      const pointer=buttons=>{const r=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+(x+.25)*r.width/320,clientY:r.top+(y+.25)*r.height/268,buttons,bubbles:true}));};
      function capture(name,black){
        host.render();const pixels=canvas.getContext('2d').getImageData(0,0,320,268).data;
        for(let i=0;i<pixels.length;i++)check(pixels[i]===(black?(i%4===3?255:0):golden[i]),`${name}: independent Canvas pixel ${i}`);
        if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:`Canvas: ${name}`,width:320,height:268,rgba:pixels});
        if(gpuHost){gpuHost.render();const actual=gpu.readPixels(),cpu=program.display.renderDisplay();
          check(gpu.stats.lastResult.backend==='gpu'&&actual.length===cpu.length&&actual.every((v,i)=>v===cpu[i]),`${name}: GPU differs`);gpuFrames++;
          if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: ${name}`,width:640,height:268,rgba:actual});}
      }
      try{
        host.attach(program);program.tick(1000);host.render();
        if(mode==='pointer-game'){
          try{gpu=createGpu(document.createElement('canvas'));gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});gpuHost.attach(program);}catch(error){gpuUnavailable=error.message;}
          capture('original menu title',false);
        }
        if(mode.startsWith('pointer-')||mode==='blank')pointer(1);
        else if(mode.startsWith('keyboard-')){const [key,code]=mode==='keyboard-h'?['h','KeyH']:mode==='keyboard-help'?['Help','Help']:[' ','Space'];canvas.dispatchEvent(new KeyboardEvent('keydown',{key,code,bubbles:true,cancelable:true}));}
        else{
          if(mode==='gamepad-moved-fire'){pointer(0);pad={connected:true,mapping:'standard',axes:[1,0],buttons:[]};clock.tick(24);}
          pad={connected:true,mapping:'standard',axes:[0,0],buttons:[{pressed:true}]};
        }
        clock.tick(640);check(program.state.variables.string_selection===action,`${mode}: wrong target guard`);
        check(program.state.waiting===(action?'key':null),`${mode}: wrong wait state`);
        if(action)selections++;
        if(mode==='gamepad-moved-fire')check(program.state.variables.int_movj===-1&&program.state.variables.int_mz===1,'Moved fire skipped original zone branch');
        if(mode==='pointer-game')capture('game target guard after original FDZ',true);
      }finally{host.detach();if(gpuHost)gpuHost.detach();program.stop();release(gpu);canvas.remove();}
    }
    if(globalThis.AMOS_ROLLER2_MENU_CLEANUP)await globalThis.AMOS_ROLLER2_MENU_CLEANUP();
    const previous=document.getElementById('roller2-menu-controls');if(previous)previous.remove();
    const controls=document.createElement('section');controls.id='roller2-menu-controls';
    const help=document.createElement('p');help.textContent='Original LIMM, zones, joystick/keyboard/mouse loop and FDZ run after a synthetic title load. Click a menu region or the help symbol, press H for scores, or use keyboard arrows/Space or gamepad directions/fire. The replay also injects the Amiga Help key. Targets report a guarded selection; game, editor, scores and help routines are excluded. Restart returns to the menu. Silent preview; full startup/setup and music are excluded.';
    const viewport=document.createElement('section');viewport.id='roller2-menu-viewport';const toolbar=document.createElement('div');toolbar.className='amos-fullscreen-toolbar';
    const slot=document.createElement('div'),status=document.createElement('pre'),fullButton=document.createElement('button'),fullStatus=document.createElement('span');fullButton.id='roller2-menu-fullscreen';
    let surface=document.createElement('canvas'),gpu=null;surface.id='roller2-menu-input';surface.tabIndex=0;surface.setAttribute('aria-label','Roller II guarded title menu');slot.append(surface);
    toolbar.append(fullButton,fullStatus);viewport.append(toolbar,slot,status);controls.append(help,viewport);document.body.append(controls);
    try{gpu=createGpu(surface);}catch(_){const gl=surface.getContext('webgl2'),ext=gl&&gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();const next=surface.cloneNode();surface.replaceWith(next);surface=next;}
    let live=null,adapter=null,error='',disposed=false;
    function update(){if(!live)return;const v=live.state.variables,action=v.string_selection||'';
      controls.dataset.phase=error?'error':live.state.halted?'ended':live.state.stopped?'stopped':action?'selected':live.state.fade.active?'fading':'menu';
      controls.dataset.action=action;controls.dataset.backend=gpu?'webgl':'canvas';controls.dataset.zone=String(live.inputValue('Mouse Zone'));
      status.textContent=error||JSON.stringify({phase:controls.dataset.phase,selectedTarget:action||'none',zone:Number(controls.dataset.zone),hardwareMouse:live.state.input.mouse,backend:gpu?'WebGL2':'Canvas 2D (WebGL unavailable)',gameRunning:false},null,2);fullscreen.refresh();}
    function fail(e){error=e.message;if(live)live.stop();update();}
    function start(){if(adapter)adapter.detach();if(live)live.stop();if(gpu)gpu.clear();error='';
      live=compiled.exports({files,now:()=>performance.now(),clearTimeout,setTimeout(fn,delay){return setTimeout(()=>{if(!disposed){try{fn();}catch(e){fail(e);}}},delay);}});
      adapter=AMOS_BROWSER.createCanvasHost(surface,{renderer:gpu,mouseCoordinates:'hardware',joysticks:[{port:1,keyboard:true,gamepad:true}]});adapter.attach(live);live.tick(1000);adapter.focus();update();}
    for(const action of ['restart','stop','resume']){const button=document.createElement('button');button.id=`roller2-menu-${action}`;button.textContent=action;button.addEventListener('click',()=>{try{if(action==='restart')start();else if(action==='stop')live.stop();else if(!error)live.resume();adapter.focus();update();}catch(e){fail(e);}});toolbar.append(button);}
    const fullscreen=AMOS_FULLSCREEN.createFullscreenHost(viewport,{button:fullButton,statusElement:fullStatus,surface:slot,getContent:()=>surface});start();const monitor=setInterval(update,50);
    globalThis.AMOS_ROLLER2_MENU_CLEANUP=()=>{disposed=true;clearInterval(monitor);adapter.detach();live.stop();release(gpu);return fullscreen.dispose();};
    return{cases:cases.length,selections,gpuFrames,gpuUnavailable,gameRunning:false,guardedTargets:true};
  },{source:new(require('../../lib/Transpiler'))(require('./roller2MenuSelection')()).toModule(),title:fs.readFileSync(path.join(__dirname,'../../examples/Roller2/iffp/roller titel')).toString('base64'),
    png:fs.readFileSync(path.join(__dirname,'../fixtures/roller2/roller-title.png')).toString('base64'),timerSource:require('./fakeTimers').createFakeTimers.toString(),gpuSources:require('./webglHostSources')()});
};
