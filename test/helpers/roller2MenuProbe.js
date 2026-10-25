/* jshint esversion: 6 */
'use strict';
module.exports = async function roller2MenuProbe(page) {
  const fs=require('fs'),path=require('path');
  const directory=path.join(__dirname,'../../examples/Roller2');
  const assets=Object.fromEntries(['music/Roller_II_Samples.Abk','music/mod.Roller_II_mus','iffp/terminator el','iffp/roller titel','Highscores','iffp/icons.abk','iffp/sprites.abk'].map(name=>[`rii:${name.toLowerCase()}`,fs.readFileSync(path.join(directory,name)).toString('base64')]));
  return page.evaluate(async ({source,assets,png,firstPNG,timerSource,gpuSources,initializationSource,initializationExpected,audioHostSource,audioSessionSource})=>{
    const compiled={exports:{}};new Function('module',source)(compiled);
    const makeClock=new Function(`return (${timerSource});`)(),checkInitialization=new Function(`return (${initializationSource});`)();
    const files={isDirectory:name=>name==='RII:',exists:name=>Object.prototype.hasOwnProperty.call(assets,name.toLowerCase()),write(){throw new Error('Unexpected menu write');},read(name){const bytes=assets[name.toLowerCase()];if(!bytes)throw new Error(`Unexpected menu asset: ${name}`);return atob(bytes);}};
    const check=(value,message)=>{if(!value)throw new Error(message);};
    const factory=name=>new Function(`return (${gpuSources[name]});`)();
    const model=factory('model')(),sprites=factory('sprites')();
    const createGpu=factory('renderer')(model,sprites,factory('resources')(model),factory('shaders'),factory('layout'));
    const release=gpu=>{if(!gpu)return;const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();};
    const image=new Image();image.src=`data:image/png;base64,${png}`;await image.decode();
    const oracle=document.createElement('canvas');oracle.width=320;oracle.height=512;oracle.getContext('2d').drawImage(image,0,0);
    const golden=oracle.getContext('2d').getImageData(0,0,320,268).data;
    const firstImage=new Image();firstImage.src=`data:image/png;base64,${firstPNG}`;await firstImage.decode();oracle.getContext('2d').drawImage(firstImage,0,0);
    const firstGolden=oracle.getContext('2d').getImageData(0,0,320,256).data;
    const cases=[['pointer-game',30,140,'game'],['pointer-editor',290,140,'editor'],['pointer-scores',150,140,'scores'],['pointer-help',270,46,'help'],
      ['keyboard-h',0,0,'scores'],['keyboard-help',0,0,'help'],['keyboard-fire',0,0,'game'],['gamepad-fire',0,0,'game'],['gamepad-moved-fire',28,140,'game'],['blank',80,80,'']];
    let selections=0,gpuFrames=0,gpuUnavailable=null;
    for(const [mode,x,y,action] of cases){
      const clock=makeClock(4),program=compiled.exports({files,now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
      const canvas=document.createElement('canvas');canvas.tabIndex=0;canvas.style.border='0';document.body.append(canvas);let pad=null,gpu=null,gpuHost=null;
      const host=AMOS_BROWSER.createCanvasHost(canvas,{mouseCoordinates:'hardware',hasFocus:()=>true,requestAnimationFrame:()=>1,cancelAnimationFrame(){},getGamepads:()=>[pad],joysticks:[{port:1,keyboard:true,gamepad:true}]});
      const pointer=buttons=>{const r=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+(x+.25)*r.width/320,clientY:r.top+(y+.25)*r.height/268,buttons,bubbles:true}));};
      function capture(name,black,first=false){
        const height=first?256:268,expected=first?firstGolden:golden;
        host.render();const pixels=canvas.getContext('2d').getImageData(0,0,320,height).data;
        for(let i=0;i<pixels.length;i++)check(pixels[i]===(black?(i%4===3?255:0):expected[i]),`${name}: independent Canvas pixel ${i}`);
        if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:`Canvas: ${name}`,width:320,height,rgba:pixels});
        if(gpuHost){const previous=program.display.canvasFrame;program.display.canvasFrame=()=>{throw new Error('GPU used CPU presentation');};try{gpuHost.render();}finally{program.display.canvasFrame=previous;}const actual=gpu.readPixels(),cpu=program.display.renderDisplay();
          check(gpu.stats.lastResult.backend==='gpu'&&actual.length===cpu.length&&actual.every((v,i)=>v===cpu[i]),`${name}: GPU differs`);gpuFrames++;
          if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: ${name}`,width:640,height,rgba:actual});}
      }
      try{
        host.attach(program);
        if(mode==='pointer-game'){
          try{gpu=createGpu(document.createElement('canvas'));gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});gpuHost.attach(program);}catch(error){gpuUnavailable=error.message;}
        }
        program.tick(1000);clock.tick(1000);const tracker=program.banks.get(22);
        if(mode==='pointer-game')capture('original intro logo',false,true);
        canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'a',code:'KeyA',bubbles:true,cancelable:true}));canvas.dispatchEvent(new KeyboardEvent('keyup',{key:'a',code:'KeyA',bubbles:true}));clock.tick(1840);host.render();
        checkInitialization(program,initializationExpected);
        check(program.banks.get(2).images.every(image=>!image||(image.masked&&image.mask&&image.mask.every((bit,index)=>bit===(image.pixels[index]===0?0:1)))),'Original Make Icon Mask setup did not run');
        check(!program.state.audio.filterEnabled&&program.banks.get(22)===tracker&&program.state.tracker.position.field===142,'Original setup or tracker continuity differs');
        if(mode==='pointer-game')capture('original menu title',false);
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
    const help=document.createElement('p');help.textContent='Original startup, intro, initialization, setup and menu now run in order. Press a key or fire to leave the logo. At the title, click a menu region/help symbol, press H for scores, or use arrows/Space or gamepad directions/fire. Destinations report guarded selections; game, editor, scores and help routines remain excluded. Enable music to hear the original MOD; Restart begins at the intro.';
    const viewport=document.createElement('section');viewport.id='roller2-menu-viewport';const toolbar=document.createElement('div');toolbar.className='amos-fullscreen-toolbar';
    const slot=document.createElement('div'),status=document.createElement('pre'),fullButton=document.createElement('button'),fullStatus=document.createElement('span');fullButton.id='roller2-menu-fullscreen';
    let surface=document.createElement('canvas'),gpu=null;surface.id='roller2-menu-input';surface.tabIndex=0;surface.setAttribute('aria-label','Roller II guarded title menu');slot.append(surface);
    toolbar.append(fullButton,fullStatus);viewport.append(toolbar,slot,status);controls.append(help,viewport);document.body.append(controls);
    try{gpu=createGpu(surface);}catch(_){const gl=surface.getContext('webgl2'),ext=gl&&gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();const next=surface.cloneNode();surface.replaceWith(next);surface=next;}
    const createAudioHost=new Function(`return (${audioHostSource});`)(),createAudioSession=new Function(`return (${audioSessionSource});`)();
    const sound=createAudioSession(createAudioHost),soundButton=document.createElement('button');soundButton.id='roller2-menu-sound';toolbar.append(soundButton);
    let live=null,adapter=null,error='',disposed=false,revision=0;
    function update(){if(!live)return;const v=live.state.variables,action=v.string_selection||'',target=live.display.screens.get(live.display.current);
      const phase=!target?'loading':target.height===256?(live.state.fade.active?'intro-fading':live.state.waiting===null?'intro-input':'intro-loading'):
        target.height===512?(target.zones&&!live.state.fade.active?'menu':'title-loading'):'loading';
      controls.dataset.phase=error?'error':live.state.halted?'ended':live.state.stopped?'stopped':action?'selected':phase;
      controls.dataset.action=action;controls.dataset.backend=gpu?'webgl':'canvas';controls.dataset.zone=String(target?live.inputValue('Mouse Zone'):0);
      const audio=sound.status();controls.dataset.sound=audio.state;controls.dataset.soundContext=audio.contextState||'none';controls.dataset.soundPlays=String(audio.plays);controls.dataset.soundVoices=String(audio.voices.length);
      controls.dataset.trackerField=String(live.state.tracker.position?live.state.tracker.position.field:0);soundButton.textContent=['on','starting'].includes(audio.state)?'Mute music':'Enable music';
      status.textContent=error||JSON.stringify({phase:controls.dataset.phase,selectedTarget:action||'none',zone:Number(controls.dataset.zone),hardwareMouse:live.state.input.mouse,backend:gpu?'WebGL2':'Canvas 2D (WebGL unavailable)',music:audio.state,musicError:audio.error,trackerField:Number(controls.dataset.trackerField),gameRunning:false},null,2);fullscreen.refresh();}
    function fail(e){error=e.message;if(live)live.stop();update();}
    function start(){const token=++revision;if(adapter)adapter.detach();if(live)live.stop();if(gpu)gpu.clear();error='';
      if(sound.status().requested)sound.enable().then(()=>{if(!disposed&&token===revision)update();});
      live=compiled.exports({files,audio:sound.bind(),now:()=>performance.now(),clearTimeout,setTimeout(fn,delay){return setTimeout(()=>{if(!disposed&&token===revision){try{fn();}catch(e){fail(e);}}},delay);}});
      adapter=AMOS_BROWSER.createCanvasHost(surface,{renderer:gpu,mouseCoordinates:'hardware',joysticks:[{port:1,keyboard:true,gamepad:true}]});adapter.attach(live);live.tick(1000);adapter.focus();update();}
    for(const action of ['restart','stop','resume']){const button=document.createElement('button');button.id=`roller2-menu-${action}`;button.textContent=action;button.addEventListener('click',()=>{try{if(action==='restart')start();else if(action==='stop')live.stop();else if(!error){if(sound.status().requested)sound.enable().then(()=>{if(!disposed)update();});live.resume();}adapter.focus();update();}catch(e){fail(e);}});toolbar.append(button);}
    soundButton.addEventListener('click',()=>{if(['on','starting'].includes(sound.status().state))sound.mute();else sound.enable().then(()=>{if(!disposed)update();});adapter.focus();update();});
    const fullscreen=AMOS_FULLSCREEN.createFullscreenHost(viewport,{button:fullButton,statusElement:fullStatus,surface:slot,getContent:()=>surface});start();const monitor=setInterval(update,50);
    globalThis.AMOS_ROLLER2_MENU_CLEANUP=()=>{disposed=true;revision++;clearInterval(monitor);adapter.detach();live.stop();release(gpu);const closing=Promise.all([fullscreen.dispose(),sound.dispose()]);update();return closing.then(()=>update());};
    return{cases:cases.length,selections,gpuFrames,gpuUnavailable,gameRunning:false,guardedTargets:true,connectedStartup:true};
  },{source:new(require('../../lib/Transpiler'))(require('./roller2ConnectedMenu')()).toModule(),assets,
    png:fs.readFileSync(path.join(__dirname,'../fixtures/roller2/roller-title.png')).toString('base64'),firstPNG:fs.readFileSync(path.join(__dirname,'../fixtures/roller2/terminator-el.png')).toString('base64'),
    timerSource:require('./fakeTimers').createFakeTimers.toString(),gpuSources:require('./webglHostSources')(),initializationSource:require('./checkRoller2Initialization').toString(),initializationExpected:require('../fixtures/roller2/initialization.json'),
    audioHostSource:require('../../lib/amos/webAudio').createWebAudioHost.toString(),audioSessionSource:require('../../lib/amos/browserAudio').createBrowserAudioSession.toString()});
};
