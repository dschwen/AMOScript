'use strict';
module.exports=async function(page){
 const fs=require('fs'),path=require('path'),bytes=fs.readFileSync(path.join(__dirname,'../../examples/AMCAF/AMCAF_Examples/QsinCosArcSqr.AMOS'));
 const source=new(require('../../lib/Transpiler'))(bytes,{extensions:{8:'amcaf-1.50beta4'}}).toModule();
 return page.evaluate(({source,timerSource,gpuSources})=>{
  const make=s=>new Function(`return (${s});`)(),m={exports:{}};new Function('module',source)(m);
  const clock=make(timerSource)(),p=m.exports({...clock});
  const model=make(gpuSources.model)(),sprites=make(gpuSources.sprites)(),gpu=make(gpuSources.renderer)(model,sprites,make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout))(document.createElement('canvas'));
  const canvas=document.createElement('canvas');document.body.append(canvas);const opts={requestAnimationFrame:()=>1,cancelAnimationFrame(){}},cpuHost=AMOS_BROWSER.createCanvasHost(canvas,opts),gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{...opts,renderer:gpu});
  const check=(ok,msg)=>{if(!ok)throw Error(msg);};let samples=0;
  try{cpuHost.attach(p);gpuHost.attach(p);p.tick(1000);
   for(const[index,point]of [[230,128,0],[160,198,256],[90,128,512]].entries()){
    const[x,y,angle]=point;p.setMouse(128+x,50+y);clock.tick(40);
    check(!p.state.error&&p.state.variables.int_arc===angle&&p.state.variables.int_rad===70,'Original quick-maths result');
    const s=p.display.screen(0);
    for(let py=100;py<=164;py++)for(let px=120;px<=200;px++){
     const on=index===0?py===128&&px>=160&&px<=192:index===1?px===160&&py>=128&&py<=160:py===128&&px>=128&&px<=160;
     check(s.physicalPixels[py*320+px]===(on?1:0),'Independent axis needle');samples++;
    }
    for(const[cx,cy]of [[230,128],[90,128],[160,58],[160,198]])check(s.physicalPixels[cy*320+cx]===1,'Circle cardinal');
    cpuHost.render();const cpu=p.display.canvasFrame(),image=canvas.getContext('2d').getImageData(0,0,320,256).data;check(image.every((v,i)=>v===cpu.rgba[i]),'Canvas pixels');
    const previous=p.display.canvasFrame;p.display.canvasFrame=()=>{throw Error('CPU fallback');};try{gpuHost.render();}finally{p.display.canvasFrame=previous;}
    const output=gpu.readPixels();check(gpu.stats.lastResult.backend==='gpu','GPU backend');
    for(let py=0;py<256;py++)for(let px=0;px<640;px++)for(let c=0;c<4;c++)check(output[(py*640+px)*4+c]===cpu.rgba[(py*320+(px>>1))*4+c],'GPU comparison');
    if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:`Canvas: AMCAF maths ${index+1}`,width:320,height:256,rgba:cpu.rgba});globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: AMCAF maths ${index+1}`,width:640,height:256,rgba:output});}
   }
   p.sendKey('\x1b');clock.tick(20);check(p.state.halted&&p.display.screens.size===0&&clock.pending()===0,'Original Escape exit');
   return{frames:3,gpuFrames:3,samples,originalExit:true};
  }finally{cpuHost.detach();gpuHost.detach();p.stop();const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();}
 },{source,timerSource:require('./fakeTimers').createFakeTimers.toString(),gpuSources:require('./webglHostSources')()});
};
