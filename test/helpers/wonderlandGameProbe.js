/* jshint esversion: 6 */
'use strict';

module.exports=async function wonderlandGameProbe(page){
  const fs=require('fs'),path=require('path'),Transpiler=require('../../lib/Transpiler');
  const source=new Transpiler(fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Wonderland.AMOS'))).toModule();
  const assets=Object.fromEntries(['Wonderland_Samples.Abk','Title_Screen.Iff','Landscape.Iff','Score_Panel.Iff','Editor_Panel.Iff','Game1.lev','Game2.lev'].map(name=>[name,fs.readFileSync(path.join(__dirname,'../../examples/Wonderland',name)).toString('base64')]));
  return page.evaluate(async ({source,assets,timerSource,replaySource,audioHostSource,audioSessionSource,samples,gpuSources,launchSource,uiSource,liveOnly=false})=>{
    const module={exports:{}};new Function('module',source)(module);const create=module.exports;
    const makeClock=new Function(`return (${timerSource});`)(),replay=new Function(`return (${replaySource});`)();
    const contents=new Map(Object.entries(assets).map(([name,bytes])=>[name.toLowerCase(),atob(bytes)]));
    const fileKey=name=>name.replace(/\\/g,'/').split('/').pop().toLowerCase();
    const files={read:name=>{const bytes=contents.get(fileKey(name));if(bytes==null)throw new Error(`File not preloaded: ${name}`);return bytes;},write:(name,bytes)=>contents.set(fileKey(name),bytes),snapshot:()=>Object.fromEntries(contents)};
    const key=(canvas,type,code)=>canvas.dispatchEvent(new KeyboardEvent(type,{code,key:code==='Space'?' ':code,bubbles:true,cancelable:true}));
    const check=(condition,message)=>{if(!condition)throw new Error(message);};
    const createAudioHost=new Function(`return (${audioHostSource});`)(),createAudioSession=new Function(`return (${audioSessionSource});`)();
    const gpuFactory=name=>new Function(`return (${gpuSources[name]});`)();
    const snapshotModel=gpuFactory('model')(),spriteModel=gpuFactory('sprites')();
    const createGpu=gpuFactory('renderer')(snapshotModel,spriteModel,gpuFactory('resources')(snapshotModel),gpuFactory('shaders'),gpuFactory('layout'));
    function releaseGpu(renderer){if(!renderer)return;const gl=renderer.resources.context;renderer.dispose();const extension=gl.getExtension('WEBGL_lose_context');if(extension&&!gl.isContextLost())extension.loseContext();}
    const gpuSurface=document.createElement('canvas');let probeGpu=null,gpuUnavailable=null,gpuFrames=0,gpuReplay=null;
    try{if(!liveOnly)probeGpu=createGpu(gpuSurface);}catch(error){gpuUnavailable=error.message;}
    const audioEvents=[],replays=[];let frames=0;
    for(const mode of liveOnly?[]:['keyboard','gamepad',...(probeGpu?['webgl']:[])]){
      const surface=mode==='webgl'?gpuSurface:document.createElement('canvas'),clock=makeClock();let adapter=null,pad=null,held=null;
      const result=replay(options=>create({...options,audio:{command(event){if(mode==='keyboard'&&event.type==='play')audioEvents.push(event);}}}),clock,files,p=>{
        if(mode==='webgl')p.display.canvasFrame=()=>{throw new Error('GPU host called CPU presentation');};
        adapter=AMOS_BROWSER.createCanvasHost(surface,{renderer:mode==='webgl'?probeGpu:null,hasFocus:()=>true,getGamepads:()=>[pad],
          setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame(){},
          joysticks:[{port:1,keyboard:mode!=='gamepad',gamepad:mode==='gamepad'}]});adapter.attach(p);
        return {set(action){
          if(held)key(surface,'keyup',held);held=null;
          if(mode!=='gamepad'){held=action==='fire'?'Space':action==='left'?'ArrowLeft':null;if(held)key(surface,'keydown',held);}
          else pad={connected:true,mapping:'standard',axes:[action==='left'?-1:0,0],buttons:Array.from({length:16},(_,i)=>({pressed:action==='fire'&&i===0}))};
        },dispose(){adapter.detach();if(mode==='webgl')releaseGpu(probeGpu);}};
      },(name,p)=>{
        adapter.render();
        if(mode==='webgl'){
          const expected=p.display.renderDisplay(),actual=probeGpu.readPixels();
          check(surface.getContext('2d')===null&&probeGpu.stats.lastResult.backend==='gpu','GPU host used a fallback');
          check(actual.length===expected.length&&actual.every((v,i)=>v===expected[i]),`Original GPU mismatch: ${name}`);gpuFrames++;
          if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: ${name}`,width:probeGpu.stats.lastResult.width,height:probeGpu.stats.lastResult.lines,rgba:actual});
        }else{
          const output=p.display.canvasFrame(),actual=surface.getContext('2d').getImageData(0,0,surface.width,surface.height).data;
          check(actual.length===output.rgba.length&&actual.every((v,i)=>v===output.rgba[i]),`Original ${mode} Canvas mismatch: ${name}`);
          if(mode==='keyboard'&&globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name,width:surface.width,height:surface.height,rgba:actual});
        }
        frames++;
      });
      check(JSON.stringify(result.deaths)==='[2,1,0]'&&result.restarts===2&&result.fades===3&&result.freshLives===3,'Original game replay did not complete');if(mode==='webgl')gpuReplay=result;else replays.push(result);
    }
    if(!liveOnly)check(JSON.stringify(audioEvents.map(e=>[e.sample.number,e.mask]))==='[[1,1],[1,1],[1,1],[1,1],[5,12],[5,12],[5,12],[6,12]]','Original game sample sequence changed');
    let audioComparisons=0;
    for(const number of liveOnly?[]:[1,5,6]){
      const event=audioEvents.find(e=>e.sample.number===number),sample=samples[number-1];
      const actualContext=new OfflineAudioContext(2,16000,8000),expectedContext=new OfflineAudioContext(2,16000,8000),audioHost=createAudioHost(actualContext);
      check(event.sample.data.every((v,i)=>((v<<24)>>24)/128===sample.pcm[i]),'Original game PCM bytes differ');
      check(!event.filterEnabled&&event.loopMask===0&&event.volume===56,'Original game audio configuration changed');
      audioHost.command(event);
      const buffer=expectedContext.createBuffer(1,sample.length,8000);buffer.getChannelData(0).set(sample.pcm);
      const merger=expectedContext.createChannelMerger(2);merger.connect(expectedContext.destination);
      for(let voice=0;voice<4;voice++)if(event.mask&(1<<voice)){
        const source=expectedContext.createBufferSource(),gain=expectedContext.createGain();source.buffer=buffer;
        source.playbackRate.value=(3546895/Math.max(124,Math.floor(3546895/sample.frequency)))/8000;gain.gain.value=56/64;
        source.connect(gain);gain.connect(merger,0,voice===0||voice===3?0:1);source.start();
      }
      try{
        const [actual,expected]=await Promise.all([actualContext.startRendering(),expectedContext.startRendering()]);
        let difference=0;const energy=[0,0];
        for(let c=0;c<2;c++)for(let i=0;i<16000;i++){
          const value=actual.getChannelData(c)[i];difference=Math.max(difference,Math.abs(value-expected.getChannelData(c)[i]));energy[c]+=value*value;
        }
        check(difference<=1e-6&&energy[0]>0&&(number===1?energy[1]===0:energy[1]>0),'Original game sample/stereo output differs');audioComparisons++;
      }finally{audioHost.dispose();}
    }
    if(globalThis.AMOS_GAME_DEMO_CLEANUP)await globalThis.AMOS_GAME_DEMO_CLEANUP();
    const previous=document.getElementById('game-controls');if(previous)previous.remove();
    const controls=document.createElement('section');controls.id='game-controls';
    const heading=document.createElement('h2');heading.textContent="Play Dithell's Wonderland";
    const help=document.createElement('p');help.textContent='Focus the canvas, then use arrows to move and jump, Space/Enter to select, and Escape to return to the title. Choose WASD + Z or a standard browser gamepad below. WebGL2 is the default renderer; Canvas 2D is an explicit alternative. Switching preserves the running game and sound. Fullscreen fits the display without stretching; Escape leaves fullscreen before it reaches the game. The complete original source and all seven companion files are embedded. Click Enable sound to hear the original sample effects; Mute stops them immediately. The integrated editor file requester/writeback remains open. Runtime/display errors stop the session and appear here.';
    const mode=document.createElement('select');mode.id='game-input-mode';
    for(const value of ['keyboard','gamepad','both']){const option=document.createElement('option');option.value=value;option.textContent=value;mode.append(option);}
    const layout=document.createElement('select');layout.id='game-keyboard-layout';
    for(const [value,text] of [['arrows','Arrows + Space/Enter'],['wasd','WASD + Z']]){const option=document.createElement('option');option.value=value;option.textContent=text;layout.append(option);}
    function makeCanvas(){const canvas=document.createElement('canvas');canvas.id='game-input';canvas.tabIndex=0;canvas.setAttribute('aria-label','Live unmodified Wonderland');canvas.style.cssText='display:block;width:640px;max-width:100%;image-rendering:pixelated;border:2px solid #7ba';return canvas;}
    let canvas=makeCanvas();
    const backend=document.createElement('select');backend.id='game-renderer';backend.setAttribute('aria-label','Display renderer');
    for(const [value,text] of [['webgl','WebGL2'],['canvas','Canvas 2D']]){const option=document.createElement('option');option.value=value;option.textContent=text;backend.append(option);}
    const viewport=document.createElement('section');viewport.id='game-viewport';
    const touchMode=document.createElement('select');touchMode.id='game-touch';touchMode.setAttribute('aria-label','Touch joystick');
    for(const [value,text]of[['auto','Touch: Auto'],['always','Touch: On'],['off','Touch: Off']]){const option=document.createElement('option');option.value=value;option.textContent=text;touchMode.append(option);}
    const toolbar=document.createElement('div');toolbar.className='amos-fullscreen-toolbar';
    const surfaceSlot=document.createElement('div');surfaceSlot.id='game-surface';surfaceSlot.append(canvas);
    const fullscreenButton=document.createElement('button');fullscreenButton.id='game-fullscreen';
    const fullscreenStatus=document.createElement('span');fullscreenStatus.id='game-fullscreen-status';fullscreenStatus.setAttribute('role','status');
    const status=document.createElement('p');status.id='game-status';status.setAttribute('aria-live','polite');
    const sound=createAudioSession(createAudioHost),soundButton=document.createElement('button'),soundStatus=document.createElement('p');
    soundButton.id='game-sound';soundStatus.id='game-sound-status';soundStatus.setAttribute('aria-live','polite');
    let live=null,host=null,gpu=null,guard=callback=>callback,revision=0,errorMessage='',disposed=false,launcher=null,ui=null;
    const configuration=()=>[{port:1,keyboard:mode.value==='gamepad'?false:layout.value==='wasd'?{up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',fire:'KeyZ'}:true,gamepad:mode.value!=='keyboard'}];
    function update(){
      if(!live)return;const v=live.state.variables;
      controls.dataset.phase=errorMessage?'error':live.state.halted?'halted':live.state.stopped?'stopped':'running';
      controls.dataset.line=String(live.state.location&&live.state.location.line);controls.dataset.game=String(v.int_game);controls.dataset.level=String(v.int_lev);controls.dataset.menuPosition=String(v.int_p);
      controls.dataset.lives=String(v.int_li);controls.dataset.x=String(v.int_x);controls.dataset.y=String(v.int_y);controls.dataset.count=String(v.int_count);controls.dataset.mouseX=String(live.state.input.mouse.x);controls.dataset.mouseY=String(live.state.input.mouse.y);
      const gpuStats=gpu?gpu.stats:null;controls.dataset.backend=!host?'unavailable':gpu?'webgl':'canvas';controls.dataset.gpuState=gpu?gpu.state:'none';controls.dataset.gpuFrames=String(gpuStats?gpuStats.gpuFrames:0);controls.dataset.displayLines=String(gpuStats&&gpuStats.lastResult?gpuStats.lastResult.lines:canvas.height);
      const audio=sound.status();controls.dataset.sound=audio.state;controls.dataset.soundContext=audio.contextState||'none';controls.dataset.soundPlays=String(audio.plays);controls.dataset.soundVoices=String(audio.voices.length);controls.dataset.soundSample=String(audio.lastSample);
      soundButton.textContent=['on','starting'].includes(audio.state)?'Mute sound':'Enable sound';
      soundStatus.textContent=audio.error?`Sound unavailable: ${audio.error}. The game can continue silently.`:audio.state==='off'?'Sound off. Click Enable sound.':audio.state==='suspended'?'Sound suspended. Click Enable sound or Resume.':`Sound ${audio.state}.`;
      const pads=host?host.pollJoysticks():[];
      status.textContent=errorMessage||`${controls.dataset.phase}. ${gpu?'WebGL2 ('+gpu.state+')':'Canvas 2D'}. Level ${v.int_lev}, lives ${v.int_li}. ${pads.map(p=>`Gamepad: ${p.status}`).join(' ')}`;
      status.hidden=liveOnly&&!errorMessage&&!live.state.stopped&&!live.state.halted&&!audio.error; soundStatus.hidden=liveOnly&&!audio.error; if(liveOnly)status.textContent=errorMessage?'Game stopped after an error. Restart to try again.':live.state.stopped?'Stopped.':live.state.halted?'Ended. Restart to play again.':audio.error?'Sound unavailable.':''; if(ui)ui.update({location:live.state.location,error:errorMessage,audio,phase:controls.dataset.phase});
    }
    function fail(error){if(ui)ui.recordError(error);if(launcher)launcher.cancel();errorMessage=`${error.message} Restart to begin a new session.`;if(live)live.stop();if(host)host.detach();update();}
    function installHost(){
      const surface=makeCanvas();let nextGpu=null,nextHost=null;
      try{
        if(backend.value==='webgl')nextGpu=createGpu(surface,{onStateChange:event=>{if(event.state==='error'&&gpu===nextGpu)fail(new Error(event.error||'GPU restoration failed'));}});
        nextHost=AMOS_BROWSER.createCanvasHost(surface,{renderer:nextGpu,joysticks:configuration(),textInput:{container:viewport,toolbar},virtualJoystick:{container:viewport,port:1,visibility:touchMode.value},mouseCoordinates:'hardware',requestAnimationFrame:callback=>requestAnimationFrame(guard(callback)),cancelAnimationFrame});
        nextHost.attach(live);
      }catch(error){if(nextHost)nextHost.detach();releaseGpu(nextGpu);throw error;}
      if(host)host.detach();releaseGpu(gpu);canvas.replaceWith(surface);canvas=surface;gpu=nextGpu;host=nextHost;
    }
    function start(){
      if(launcher)launcher.cancel();
      const bindings=configuration();AMOS_BROWSER.createJoystickInput(bindings);
      revision++;const token=revision;if(host)host.detach();if(live)live.stop();errorMessage='';
      if(sound.status().requested)sound.enable().then(()=>{if(!disposed&&token===revision)update();});
      guard=callback=>(...args)=>{if(disposed||token!==revision)return;try{callback(...args);}catch(error){fail(error);} };
      live=create({files,audio:sound.bind(),now:()=>performance.now(),setTimeout:(callback,ms)=>setTimeout(guard(callback),ms),clearTimeout,print(){}});
      installHost();live.tick(2000);update();
    }
    const label=(text,input)=>{const label=document.createElement('label');label.append(`${text} `,input);return label;};
    const instructions=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Controls and help';instructions.append(summary,help);controls.append(heading,instructions);toolbar.append(label('Renderer',backend),label('Input',mode),label('Keyboard',layout));
    for(const action of ['restart','stop','resume']){const button=document.createElement('button');button.id=`game-${action}`;button.textContent=action;
      button.addEventListener('click',()=>{try{if(action==='restart')start();else if(action==='stop'){launcher.cancel();live.stop();}else if(!errorMessage){if(sound.status().requested)sound.enable().then(()=>{if(!disposed)update();});live.resume();}host.focus();update();}catch(error){fail(error);}});toolbar.append(button);}
    backend.addEventListener('change',()=>{try{launcher.cancel();installHost();host.focus();update();}catch(error){fail(error);}});
    for(const input of [mode,layout])input.addEventListener('change',()=>{try{launcher.cancel();host.configureJoysticks(configuration());host.focus();update();}catch(error){fail(error);}});
    soundButton.addEventListener('click',()=>{if(['on','starting'].includes(sound.status().state)){sound.mute();update();}else{sound.enable().then(()=>{if(!disposed)update();});update();}host.focus();});
    touchMode.addEventListener('change',()=>{if(host){host.setVirtualJoystickVisibility(touchMode.value);host.focus();}});
    toolbar.append(soundButton,fullscreenButton,fullscreenStatus,touchMode);const messages=document.createElement('div');messages.className='amos-fullscreen-messages';messages.append(soundStatus,status);viewport.append(toolbar,surfaceSlot,messages);controls.append(viewport);const player=document.getElementById('game-player'),results=document.getElementById('results');if(player)player.append(controls);else if(results)results.before(controls);else document.body.append(controls);
    ui=new Function(`return (${uiSource});`)()({container:viewport,toolbar,files,debug:!liveOnly});
    const fullscreen=AMOS_FULLSCREEN.createFullscreenHost(viewport,{button:fullscreenButton,statusElement:fullscreenStatus,surface:surfaceSlot,getContent:()=>canvas,onChange(){if(host&&!disposed){canvas.blur();host.focus();}}});
    const monitor=setInterval(update,100);globalThis.AMOS_GAME_DEMO_CLEANUP=()=>{disposed=true;revision++;if(launcher)launcher.dispose();if(globalThis.AMOS_PLAY_GAME===play)delete globalThis.AMOS_PLAY_GAME;clearInterval(monitor);ui.dispose();if(host)host.detach();if(live)live.stop();releaseGpu(gpu);const closing=Promise.all([sound.dispose(),fullscreen.dispose()]);update();return closing.then(()=>update());};
    try{start();}catch(error){fail(error);}
    launcher=new Function(`return (${launchSource});`)()({sound,fullscreen,focus:()=>host.focus(),update,fail,
      prepare(){if(errorMessage||live.state.halted)start();else if(live.state.stopped)live.resume();},
      release(){},step:()=>true
    });
    const play=()=>launcher.play();globalThis.AMOS_PLAY_GAME=play;
    if(liveOnly)return play();
    return {inputModes:2,deaths:replays.map(r=>r.deaths),restarts:replays.map(r=>r.restarts),fades:replays.map(r=>r.fades),freshLives:replays.map(r=>r.freshLives),stopResume:replays.every(r=>r.stopResume),frames,audioCommands:audioEvents.length,audioComparisons,gpuFrames,gpuUnavailable,gpuDeaths:gpuReplay?gpuReplay.deaths:null,gameRunning:true};
  },{source,assets,launchSource:require('../../tools/gameLauncher').toString(),uiSource:require('../../tools/gamePageUI').toString(),timerSource:require('./steppedTimers').createSteppedTimers.toString(),replaySource:require('./wonderlandReplay').toString(),audioHostSource:require('../../lib/amos/webAudio').createWebAudioHost.toString(),audioSessionSource:require('../../lib/amos/browserAudio').createBrowserAudioSession.toString(),samples:require('./wonderlandSamples')(),gpuSources:require('./webglHostSources')()});
};
