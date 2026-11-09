'use strict';
module.exports=async function narrowPackedProbe(page){
  const f=require('./narrowPackedProgram')(),T=require('../../lib/Transpiler');
  return page.evaluate(({source,bank,widths,heights,gpuSources})=>{
    const make=s=>new Function(`return (${s});`)(),m={exports:{}};new Function('module',source)(m);
    const model=make(gpuSources.model)(),sprites=make(gpuSources.sprites)(),gpu=make(gpuSources.renderer)(model,sprites,make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout))(document.createElement('canvas'));
    const canvas=document.createElement('canvas');document.body.append(canvas);const opts={requestAnimationFrame:()=>1,cancelAnimationFrame(){}},host=AMOS_BROWSER.createCanvasHost(canvas,opts),gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{...opts,renderer:gpu});
    const p=m.exports({setTimeout,clearTimeout,files:{read:name=>{if(name!=='lace.abk')throw Error(name);return atob(bank);}}}),check=(ok,message)=>{if(!ok)throw Error(message);};let samples=0;
    try{host.attach(p);gpuHost.attach(p);for(let frame=0;frame<3;frame++){
      if(frame)p.sendKey('next');p.tick(1000);const target=p.display.screen(frame===1?6:0);check(target.width===widths[frame],'Native width');
      for(let y=0;y<heights[frame];y++)for(let x=0;x<widths[frame];x++){const code=frame===1?32|(y<2?((0xa5>>(7-x%8))&1):0):3;check(target.physicalPixels[y*target.width+x]===code,'Independent pixel');samples++;}
      host.render();const cpu=p.display.canvasFrame(),actual=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;check(canvas.width===widths[frame]&&actual.length===cpu.rgba.length&&actual.every((v,i)=>v===cpu.rgba[i]),'Canvas differs');
      const old=p.display.canvasFrame;p.display.canvasFrame=()=>{throw Error('CPU fallback');};try{gpuHost.render();}finally{p.display.canvasFrame=old;}
      const result=gpu.readPixels(),reference=p.display.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&result.length===reference.length&&result.every((v,i)=>v===reference[i]),'GPU differs');
      if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:`Canvas: native screen ${frame+1}`,width:cpu.width,height:cpu.height,rgba:cpu.rgba});globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: native screen ${frame+1}`,width:gpu.stats.lastResult.width,height:gpu.stats.lastResult.lines,rgba:result});}
    }return {frames:3,gpuFrames:3,samples,widths};}finally{host.detach();gpuHost.detach();p.stop();const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();}
  },{source:new T(f.bytes).toModule(),bank:f.bank.toString('base64'),widths:f.widths,heights:f.heights,gpuSources:require('./webglHostSources')()});
};
