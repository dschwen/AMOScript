'use strict';
module.exports=async function(page){
 const T=require('../../lib/Transpiler');
 return page.evaluate(({source,oracle,timers,gpuSources})=>{
  const make=s=>new Function('return ('+s+');')(),m={exports:{}};new Function('module',source)(m);
  const clock=make(timers)(),p=m.exports({...clock}),model=make(gpuSources.model)(),sprites=make(gpuSources.sprites)(),gpu=make(gpuSources.renderer)(model,sprites,make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout))(document.createElement('canvas'));
  const canvas=document.createElement('canvas'),opts={requestAnimationFrame:()=>1,cancelAnimationFrame(){}},cpu=AMOS_BROWSER.createCanvasHost(canvas,opts),glHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{...opts,renderer:gpu});document.body.append(canvas);cpu.attach(p);glHost.attach(p);
  const check=(ok,message)=>{if(!ok)throw Error(message);},frames=[1,2,3,5,7,10,14,17,51,54,57,61,101,104,107,111];let comparisons=0,fieldChecks=0;
  try{p.tick(1000);for(let field=1;field<=111;field++){
   clock.tick(20);const phase=Math.min(2,Math.floor((field-1)/50)),local=(field-1)%50+1,names=[['hithihat','hitbass','clap'],['openhihat','hitsnare','clap'],['hithihat','hitboth','clap']][phase];
   names.forEach((name,i)=>{const c=oracle.cases.find(c=>c.name===name),expected=c.images[Math.min(local,c.images.length-1)];check(p.spriteInfo('I Sprite',[0,2,6][i])===expected,'Independent '+name+' image at field '+field);fieldChecks++;});
   if(frames.includes(field)){cpu.render();const frame=p.display.canvasFrame(),previous=p.display.canvasFrame;p.display.canvasFrame=()=>{throw Error('CPU fallback');};try{glHost.render();}finally{p.display.canvasFrame=previous;}const rgba=gpu.readPixels(),reference=p.display.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&rgba.length===reference.length&&rgba.every((v,i)=>v===reference[i]),'GPU sprite composition');comparisons++;
    if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:'Canvas: drums field '+field,width:frame.width,height:frame.height,rgba:frame.rgba});globalThis.AMOS_DEMO_OBSERVE({name:'WebGL: drums field '+field,width:gpu.stats.lastResult.width,height:gpu.stats.lastResult.lines,rgba});}
   }
  }
  p.stop();check(clock.pending()===0,'Stop owns animation/VM wakes');const before=p.animSnapshot();clock.tick(1000);check(JSON.stringify(before)===JSON.stringify(p.animSnapshot()),'Stopped sequence moved');p.resume();clock.tick(20);p.spriteOff();check(p.animSnapshot().length===0,'Sprite retirement retains Anim');
  return{gpuFrames:comparisons,fieldChecks,sequences:6,sourceUnchanged:true};
  }finally{cpu.detach();glHost.detach();p.stop();const gl=gpu.resources.context;gpu.dispose();const extension=gl.getExtension('WEBGL_lose_context');if(extension&&!gl.isContextLost())extension.loseContext();}
 },{source:new T(require('./amcafDrumsProgram')()).toModule(),oracle:require('../fixtures/amcaf/anim.json'),timers:require('./fakeTimers').createFakeTimers.toString(),gpuSources:require('./webglHostSources')()});
};
