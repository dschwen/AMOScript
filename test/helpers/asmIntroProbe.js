'use strict';
module.exports=async function asmIntroProbe(page) {
  const fs=require('fs'),path=require('path'),T=require('../../lib/Transpiler');
  const root=path.join(__dirname,'../../examples/ASM'),{prepare,bitmap}=require('../../tools/asmIntroAssets'),prepared=prepare();
  const fonts=prepared.diskFonts.map(f=>({...f,data:Array.from(f.data)}));
  return page.evaluate(async ({source,assets,fonts,expected,clockSource,gpuSources,debugPage})=>{
    const check=(v,m)=>{if(!v)throw Error(m);},make=t=>new Function(`return (${t});`)();
    const model=make(gpuSources.model)(),gpu=make(gpuSources.renderer)(model,make(gpuSources.sprites)(),make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout))(document.createElement('canvas'));
    const canvas=document.createElement('canvas'),host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
    const gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
    const memory=Object.fromEntries(Object.entries(assets).map(([n,b])=>[n,atob(b)])),events=[],requests=[];
    const module={exports:{}};new Function('module',source)(module);
    const clock=make(clockSource)(4),p=module.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){},
      displayOptions:{diskFonts:fonts.map(f=>({...f,data:Uint8Array.from(f.data)}))},audio:{command:e=>events.push(e)},
      files:{read:n=>{const v=memory[n.toLowerCase()];if(v==null)throw Error('Missing ASM asset: '+n);return v;},write:(n,b)=>{memory[n.toLowerCase()]=b;},exists:n=>Object.keys(memory).some(k=>k.startsWith(n.toLowerCase()))},
      system:{command:(n,r)=>requests.push([n,r])}});
    let frames=0,gpuFrames=0,picturePixels=0;
    const line=()=>p.state.location&&p.state.location.line;
    const until=(test,label)=>{for(let i=0;i<40000;i++){if(test())return;p.tick(1);clock.tick(4);}throw Error('ASM timed out at '+label+', line '+line());};
    const click=(x,y,buttons=1)=>p.setMouse(x+128,y+50,buttons),release=()=>p.setMouse(278,200,0);
    const capture=(label,match=null,ham=false)=>{
      if(match){const want=Uint8Array.from(atob(expected[match]),c=>c.charCodeAt(0)),actual=p.display.screen().pixels;check(want.length===actual.length&&actual.every((v,i)=>v===want[i]),'ASM picture pixels differ: '+label);picturePixels+=want.length;}
      host.render();const cpu=p.display.canvasFrame();frames++;
      if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:'Canvas: ASM '+label,width:cpu.width,height:cpu.height,rgba:cpu.rgba});
      if(ham){check(p.display.screen().ham,'Expected actual HAM screen');return;}
      const old=p.display.canvasFrame;p.display.canvasFrame=()=>{throw Error('ASM GPU used CPU presentation');};
      try{gpuHost.render();}finally{p.display.canvasFrame=old;}
      const actual=gpu.readPixels(),reference=p.display.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&actual.length===reference.length&&actual.every((v,i)=>v===reference[i]),'ASM GPU mismatch: '+label);gpuFrames++;
      if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:'WebGL: ASM '+label,width:gpu.stats.lastResult.width,height:gpu.stats.lastResult.lines,rgba:actual});
    };
    try {
      host.attach(p);gpuHost.attach(p);
      until(()=>line()===14,'sound menu');capture('sound menu');
      click(150,115);until(()=>p.state.variables.int_musik===1,'no music');release();
      until(()=>line()===14,'sound menu');click(150,75);until(()=>p.state.variables.int_musik===0,'music');release();
      until(()=>line()===14,'sound menu');click(150,160);until(()=>line()===17&&p.state.waiting==='sleep','difficulty switch');release();
      until(()=>line()===24,'difficulty menu');capture('difficulty menu','Level.Pic');
      click(45,80);until(()=>line()===27&&p.state.waiting==='sleep','logo switch');release();
      until(()=>line()===42,'logo');capture('animated logo');check(events.some(e=>e.type==='play'),'Zoom music never played');
      p.stop();const ticks=p.state.ticks;clock.tick(200);check(p.state.ticks===ticks,'Stop advanced source');p.resume();
      click(150,150);until(()=>line()===43,'logo click');release();
      for(let n=0;n<4;n++){
        until(()=>line()===75&&p.state.stack.length>0,'title '+n);
        capture('title '+(n+1),n<3?'Intro'+(n+1)+'.Pic':null,n===2);
        const depth=p.state.stack.length;click(150,150);until(()=>p.state.stack.length<depth,'title return');release();
      }
      until(()=>p.state.halted,'Run');capture('loading');
      check(requests.at(-1)[0]==='Run'&&requests.at(-1)[1].filename==='ASM:ASM.Main','Original Run target differs');
      check(memory['ram:level']==='1\r\n','Selected level was not saved');check(clock.pending()===0,'Terminal Run left timers');
      // Exercise the actual packaged page, with its selected Canvas renderer,
      // preloaded fonts, icon controls and no startup clicks injected into AMOS.
      const frame=document.createElement('iframe');frame.style.cssText='width:800px;height:600px';document.body.append(frame);
      const loaded=new Promise(resolve=>frame.onload=resolve);frame.srcdoc=debugPage;await loaded;
      try{
        const doc=frame.contentDocument,win=frame.contentWindow;doc.getElementById('play-game').click();await new Promise(r=>setTimeout(r,180));
        check(doc.getElementById('game-viewport').dataset.phase==='running','Packaged intro failed to start');
        check(doc.getElementById('game-input').getContext('2d'),'HAM showcase did not select Canvas');
        doc.getElementById('game-stop').click();check(doc.getElementById('game-viewport').dataset.phase==='stopped','Packaged Stop');
        doc.getElementById('game-resume').click();check(doc.getElementById('game-viewport').dataset.phase==='running','Packaged Resume');
        doc.getElementById('game-restart').click();await new Promise(r=>setTimeout(r,100));check(doc.getElementById('game-viewport').dataset.phase==='running','Packaged Restart');
        const pause=ms=>new Promise(r=>setTimeout(r,ms));
        const point=async(x,y,buttons=1)=>{
          const input=doc.getElementById('game-input'),rect=input.getBoundingClientRect(),clientX=rect.left+x/input.width*rect.width,clientY=rect.top+y/input.height*rect.height;
          input.dispatchEvent(new win.PointerEvent('pointerdown',{pointerId:1,pointerType:'mouse',button:buttons===2?2:0,buttons,clientX,clientY,bubbles:true}));await pause(40);
          input.dispatchEvent(new win.PointerEvent('pointerup',{pointerId:1,pointerType:'mouse',button:0,buttons:0,clientX,clientY,bubbles:true}));await pause(40);
        };
        const atLine=async wanted=>{for(let i=0;i<200;i++){if(wanted.includes(Number(doc.getElementById('game-viewport').dataset.line)))return;await pause(30);}throw Error('Packaged intro timed out at line '+doc.getElementById('game-viewport').dataset.line+'; wanted '+wanted);};
        await atLine([14]);await point(150,115);await atLine([14]);await point(150,160);await atLine([24]);
        await point(45,160);await atLine([42]);await point(150,100);await atLine([75,76,77]);await point(150,100,2);await atLine([72]);

        check(doc.getElementById('game-viewport').dataset.phase==='ended','Packaged intro did not finish: '+doc.getElementById('game-status').textContent);
        check(doc.getElementById('game-status').textContent.includes('not included in this development preview'),'Unlinked Run did not report the next milestone');
        check(win.AMOS_GAME_PAGE.files.read('ram:level')==='2\r\n','Packaged difficulty selection differs');
        await win.AMOS_GAME_PAGE.dispose();
      }finally{frame.remove();}
      return {frames,gpuFrames,picturePixels,ham:true,levelFile:memory['ram:level'],runTarget:requests.at(-1)[1].filename,standalonePage:true};
    }finally{host.detach();gpuHost.detach();p.stop();const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();}
  },{source:new T(fs.readFileSync(path.join(root,'ASM_Intro.AMOS'))).toModule(),assets:prepared.assets,fonts,
    expected:Object.fromEntries(['Level.Pic','Intro1.Pic','Intro2.Pic','Intro3.Pic'].map(n=>[n,Buffer.from(bitmap(path.join(root,'intro',n)).pixels).toString('base64')])),
    clockSource:require('./fakeTimers').createFakeTimers.toString(),gpuSources:require('./webglHostSources')(),debugPage:require('../../tools/build_asm').pages().get('asm-intro-debug.html')});
};
