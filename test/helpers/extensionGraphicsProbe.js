'use strict';
module.exports = async function extensionGraphicsProbe(page) {
  const fixture=require('./extensionGraphicsProgram')(),T=require('../../lib/Transpiler');
  return page.evaluate(({source,frames,gpuSources})=>{
    const make=text=>new Function(`return (${text});`)(),module={exports:{}};new Function('module',source)(module);
    const model=make(gpuSources.model)(),sprites=make(gpuSources.sprites)();
    const gpu=make(gpuSources.renderer)(model,sprites,make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout))(document.createElement('canvas'));
    const canvas=document.createElement('canvas');document.body.append(canvas);
    const opts={requestAnimationFrame:()=>1,cancelAnimationFrame(){}};
    const host=AMOS_BROWSER.createCanvasHost(canvas,opts),gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{...opts,renderer:gpu});
    const p=module.exports({setTimeout,clearTimeout}),check=(ok,msg)=>{if(!ok)throw Error(msg);};let independentPixels=0;
    try{host.attach(p);gpuHost.attach(p);
      for(let frame=0;frame<frames.length;frame++){
        if(frame)p.sendKey('next');p.tick(1000);const s=p.display.screen(),expected=frames[frame];
        for(let i=0;i<expected.logical.length;i++){check(s.pixels[i]===expected.logical[i]&&s.physicalPixels[i]===expected.physical[i],`Independent bit matrix ${frame}:${i}`);independentPixels+=2;}
        host.render();const cpu=p.display.canvasFrame(),actual=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        check(actual.length===cpu.rgba.length&&actual.every((value,i)=>value===cpu.rgba[i]),'Canvas presentation differs');
        const previous=p.display.canvasFrame;p.display.canvasFrame=()=>{throw Error('CPU fallback in GPU host');};
        try{gpuHost.render();}finally{p.display.canvasFrame=previous;}
        const pixels=gpu.readPixels(),reference=p.display.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&pixels.length===reference.length&&pixels.every((value,i)=>value===reference[i]),'GPU differs');
        if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:`Canvas: extension lighting ${frame+1}`,width:cpu.width,height:cpu.height,rgba:cpu.rgba});globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: extension lighting ${frame+1}`,width:gpu.stats.lastResult.width,height:gpu.stats.lastResult.lines,rgba:pixels});}
      }
      p.display.clear(32);p.putBlock(1,0,0,-2147483648);check(p.extensionFastPoint(8,8)===2,'EntNul must select all block planes');
      return {frames:6,gpuFrames:6,independentPixels};
    }finally{host.detach();gpuHost.detach();p.stop();const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();}
  },{source:new T(fixture.bytes,{extensions:{12:'turbo-plus-2.15'}}).toModule(),frames:fixture.frames,gpuSources:require('./webglHostSources')()});
};
