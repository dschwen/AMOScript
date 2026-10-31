'use strict';
module.exports=async function asmMainProbe(page){
  const fs=require('fs'),T=require('../../lib/Transpiler'),intro=require('../../tools/asmIntroAssets').prepare();
  return page.evaluate(async ({source,assets,fonts,oracle,replay,clockSource,gpuSources,linkedPage})=>{
    const make=t=>new Function(`return (${t});`)(),check=(v,m)=>{if(!v)throw Error(m);};
    const module={exports:{}};new Function('module',source)(module);const clock=make(clockSource)(4);
    const memory=Object.fromEntries(Object.entries(assets).map(([n,b])=>[n,atob(b)]));memory['ram:level']='2\r\n';
    const p=module.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){},displayOptions:{diskFonts:fonts.map(f=>({...f,data:Uint8Array.from(f.data)}))},
      files:{write:(n,b)=>{memory[n.toLowerCase()]=b;},read:n=>{const b=memory[n.toLowerCase()];if(b==null)throw Error('Missing ASM file '+n);return b;},remove:n=>{delete memory[n.toLowerCase()];},exists:n=>Object.keys(memory).some(k=>k.startsWith(n.toLowerCase()))}});
    const model=make(gpuSources.model)(),gpu=make(gpuSources.renderer)(model,make(gpuSources.sprites)(),make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout))(document.createElement('canvas'));
    const host=AMOS_BROWSER.createCanvasHost(document.createElement('canvas'),{requestAnimationFrame:()=>1,cancelAnimationFrame(){}}),gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
    let frames=0,gpuFrames=0,independentPixels=0;
    try{
      host.attach(p);gpuHost.attach(p);
      const result=make(replay)(p,clock,(label,key)=>{
        if(key){const expected=Uint8Array.from(atob(oracle[key]),c=>c.charCodeAt(0)),actual=p.display.screen(2).pixels;check(actual.length===expected.length&&actual.every((v,i)=>v===expected[i]),'Independent room mismatch '+label);independentPixels+=expected.length;}
        host.render();const cpu=p.display.canvasFrame(),old=p.display.canvasFrame;p.display.canvasFrame=()=>{throw Error('Main game GPU used CPU presentation');};try{gpuHost.render();}finally{p.display.canvasFrame=old;}
        const rgba=gpu.readPixels(),reference=p.display.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&rgba.length===reference.length&&rgba.every((v,i)=>v===reference[i]),'Main game GPU mismatch '+label);frames++;gpuFrames++;
        if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:'Canvas: ASM main '+label,width:cpu.width,height:cpu.height,rgba:cpu.rgba});globalThis.AMOS_DEMO_OBSERVE({name:'WebGL: ASM main '+label,width:gpu.stats.lastResult.width,height:gpu.stats.lastResult.lines,rgba});}
      },check);
      check(!Object.hasOwn(memory,'ram:level'),'Main game did not consume the intro level file');
      const frame=document.createElement('iframe');frame.style.cssText='width:800px;height:700px';document.body.append(frame);const loaded=new Promise(r=>frame.onload=r);frame.srcdoc=linkedPage;await loaded;
      try{
        const doc=frame.contentDocument,win=frame.contentWindow,pause=ms=>new Promise(r=>setTimeout(r,ms)),viewport=doc.getElementById('game-viewport');
        const atLine=async wanted=>{for(let i=0;i<600;i++){if(viewport.dataset.phase==='error')throw Error(doc.querySelector('[data-debug-log]').textContent);if(viewport.dataset.sourceError)throw Error(viewport.dataset.sourceError);if(wanted.includes(Number(viewport.dataset.line)))return;await pause(30);}throw Error('Linked ASM timed out '+viewport.dataset.line+' wanted '+wanted);};
        const point=async(x,y,buttons=1)=>{const input=doc.getElementById('game-input'),rect=input.getBoundingClientRect(),clientX=rect.left+x/input.width*rect.width,clientY=rect.top+y/input.height*rect.height;
          input.dispatchEvent(new win.PointerEvent('pointerdown',{pointerId:1,pointerType:'mouse',button:buttons===2?2:0,buttons,clientX,clientY,bubbles:true}));await pause(40);input.dispatchEvent(new win.PointerEvent('pointerup',{pointerId:1,pointerType:'mouse',buttons:0,clientX,clientY,bubbles:true}));await pause(50);};
        doc.getElementById('play-game').click();await atLine([14]);await point(150,115);await atLine([14]);await point(150,160);await atLine([24]);await point(45,160);await atLine([42]);await point(150,100);await atLine([75,76,77]);await point(150,100,2);
        await atLine([1701]);check(!win.AMOS_GAME_PAGE.files.exists('ram:level'),'Linked main did not delete Ram:Level');
        await point(150,80);await atLine([1701]);await point(150,80);await atLine([1113]);
        doc.querySelector('.amos-text-keyboard-toggle').click();const input=doc.querySelector('.amos-text-keyboard input');check(doc.activeElement===input,'Main game mobile keyboard focus failed');
        input.value='M';input.dispatchEvent(new win.InputEvent('input',{inputType:'insertText',data:'M',bubbles:true}));await atLine([1701]);
        check(viewport.dataset.phase==='running'&&!viewport.dataset.sourceError,'Main game mobile answer failed');
        doc.getElementById('game-restart').click();await atLine([14]);check(viewport.dataset.phase==='running','Restart did not return to the entry intro');
        await win.AMOS_GAME_PAGE.dispose();
      }finally{frame.remove();}
      return {frames,gpuFrames,independentPixels,...result,linkedPage:true,mobileText:true};
    }finally{host.detach();gpuHost.detach();p.stop();const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();}
  },{source:new T(fs.readFileSync(require('path').join(__dirname,'../../examples/ASM/ASM.AMOS'))).toModule(),assets:{...intro.assets,...require('../../tools/asmGameAssets').prepare()},fonts:intro.diskFonts.map(f=>({...f,data:Array.from(f.data)})),oracle:require('../fixtures/asm/room1.json'),replay:require('./asmMainReplay').toString(),clockSource:require('./fakeTimers').createFakeTimers.toString(),gpuSources:require('./webglHostSources')(),linkedPage:require('../../tools/build_asm').pages().get('asm-game-debug.html')});
};
