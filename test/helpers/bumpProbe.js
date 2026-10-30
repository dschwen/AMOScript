'use strict';
module.exports=async function bumpProbe(page){
  const fs=require('fs'),path=require('path'),T=require('../../lib/Transpiler');
  return page.evaluate(({source,image,clockSource,decodeSource,oracleSource,gpuSources})=>{
    const make=s=>new Function(`return (${s});`)(),check=(v,m)=>{if(!v)throw Error(m);},clock=make(clockSource)(),m={exports:{}};
    new Function('module',source)(m);const raw=atob(image),decoded=make(decodeSource)(Uint8Array.from(raw,c=>c.charCodeAt(0)));
    const p=m.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){},files:{read:name=>{check(name.toLowerCase()==='amospro_extras:compiler_examples/graphics/demo_pic.iff','Unexpected Bump asset');return raw;}}});
    const model=make(gpuSources.model)(),gpu=make(gpuSources.renderer)(model,make(gpuSources.sprites)(),make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout))(document.createElement('canvas'));
    const canvas=document.createElement('canvas');canvas.style.cssText='position:absolute;left:-10000px;top:0;width:320px;height:200px;border:0;max-width:none';document.body.append(canvas);
    const host=AMOS_BROWSER.createCanvasHost(canvas,{mouseCoordinates:'hardware',requestAnimationFrame:()=>1,cancelAnimationFrame(){}}),gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
    let gpuFrames=0,independentPixels=0;
    function capture(name){
      host.render();const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      const old=p.display.canvasFrame;p.display.canvasFrame=()=>{throw Error('GPU used CPU presentation');};try{gpuHost.render();}finally{p.display.canvasFrame=old;}
      const pixels=gpu.readPixels(),reference=p.display.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&pixels.every((v,i)=>v===reference[i]),'Bump GPU/reference differs');gpuFrames++;
      if(globalThis.AMOS_DEMO_OBSERVE){const f=p.display.snapshotDisplay().frame;globalThis.AMOS_DEMO_OBSERVE({name:'Canvas: '+name,width:canvas.width,height:canvas.height,rgba});globalThis.AMOS_DEMO_OBSERVE({name:'WebGL: '+name,width:f.outputWidth,height:f.lines,rgba:pixels});}
    }
    function pointer(x,y,buttons){host.focus();const r=canvas.getBoundingClientRect(),s=p.display.presentedScreen();canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+(x-s.hardwareX)*r.width/s.width,clientY:r.top+(y-s.hardwareY)*r.height/s.height,buttons,bubbles:true}));}
    try{
      host.attach(p);gpuHost.attach(p);p.tick(1000);check(p.state.location.line===53&&p.state.variables.int_r0===1,'No-motion Bump startup failed');check(p.state.input.mouse.buttons===0&&p.state.input.mouseClick===0,'Polling fabricated input');
      for(const [x,y,value]of [[159,100,1],[161,100,1],[160,99,1],[160,101,1],[160,100,0]]){check(p.display.screen().physicalPixels[y*320+x]===value,'Initial radius-one circle differs');independentPixels++;}capture('Bump startup without pointer motion');
      pointer(80,80,0);clock.tick(20);check(p.state.variables.int_r0===80,'Pointer did not select radius 80');capture('Bump radius selection');
      pointer(80,80,1);clock.tick(20);check(p.state.location.line===118&&p.state.variables.int_y===200,'Bump did not finish its image');independentPixels+=make(oracleSource)(p.display.screen(0).physicalPixels,decoded.pixels);capture('Bump deformed image');
      pointer(80,80,0);clock.tick(20);check(p.state.location.line===132&&p.state.variables.int_n===6&&!p.state.halted,'Original final prompt was not reached');capture('Bump final report');
      host.focus();canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'a',code:'KeyA',bubbles:true}));canvas.dispatchEvent(new KeyboardEvent('keyup',{key:'a',code:'KeyA',bubbles:true}));clock.tick(20);check(p.state.halted&&clock.pending()===0,'Original final keyboard input did not end Bump');
    }finally{host.detach();gpuHost.detach();p.stop();canvas.remove();const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();}
    return{gpuFrames,independentPixels,radius:80,renderedPixels:64000,ended:true};
  },{source:new T(fs.readFileSync(path.join(__dirname,'../../examples/CompilerExamples/Bump.AMOS'))).toModule({optimize:true}),image:fs.readFileSync(path.join(__dirname,'../../examples/CompilerExamples/Graphics/Demo_pic.iff')).toString('base64'),clockSource:require('./fakeTimers').createFakeTimers.toString(),decodeSource:require('./decodeSavedIff').toString(),oracleSource:require('./bumpPixels').toString(),gpuSources:require('./webglHostSources')()});
};
