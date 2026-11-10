'use strict';
module.exports=async function(page){
 const fs=require('fs'),path=require('path'),T=require('../../lib/Transpiler'),compile=bytes=>new T(bytes,{extensions:{8:'amcaf-1.50beta4'}}).toModule();
 return page.evaluate(({primitive,original,oracle,packed,timerSource,filesSource,gpuSources})=>{
  const make=s=>new Function('return ('+s+');')(),factory=s=>{const m={exports:{}};new Function('module',s)(m);return m.exports;},check=(v,m)=>{if(!v)throw Error(m);};
  const model=make(gpuSources.model)(),sprites=make(gpuSources.sprites)(),gpu=make(gpuSources.renderer)(model,sprites,make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout))(document.createElement('canvas'));
  const canvas=document.createElement('canvas');document.body.append(canvas);const opts={requestAnimationFrame:()=>1,cancelAnimationFrame(){}},cpuHost=AMOS_BROWSER.createCanvasHost(canvas,opts),gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{...opts,renderer:gpu});
  let independentPixels=0,frames=0,p;
  function capture(label){cpuHost.render();const cpu=p.display.canvasFrame(),image=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;check(image.every((v,i)=>v===cpu.rgba[i]),'Canvas presentation');
    const previous=p.display.canvasFrame;p.display.canvasFrame=()=>{throw Error('CPU fallback');};try{gpuHost.render();}finally{p.display.canvasFrame=previous;}
    const rgba=gpu.readPixels(),reference=p.display.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&rgba.length===reference.length&&rgba.every((v,i)=>v===reference[i]),'Real GPU comparison');frames++;
    if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:'Canvas: '+label,width:cpu.width,height:cpu.height,rgba:cpu.rgba});globalThis.AMOS_DEMO_OBSERVE({name:'WebGL: '+label,width:gpu.stats.lastResult.width,height:gpu.stats.lastResult.lines,rgba});}
  }
  try{let clock=make(timerSource)();p=factory(primitive)({...clock});cpuHost.attach(p);gpuHost.attach(p);
   for(let f=0;f<oracle.frames.length;f++){if(f)p.sendKey('next');p.tick(1000);const s=p.display.screen(0),expected=oracle.frames[f];
    for(let y=0;y<64;y++)for(let x=0;x<64;x++){check(s.pixels[y*64+x]===parseInt(expected.logical[y][x],16)&&s.physicalPixels[y*64+x]===parseInt(expected.physical[y][x],16),'Independent primitive planes');independentPixels+=2;}
    capture('AMCAF blitter '+(f+1));
   }
   cpuHost.detach();gpuHost.detach();p.stop();clock=make(timerSource)();p=factory(original)({...clock,files:make(filesSource)({'Data/mod.hawkeye':atob(packed)})});cpuHost.attach(p);gpuHost.attach(p);p.tick(10000);let field=0;
   for(const expected of oracle.protracker2){while(field<expected.field){clock.tick(20);field++;}const s=p.display.screen(0);
    for(let y=0;y<160;y++)for(let x=32;x<288;x++){check(s.physicalPixels[y*320+x]===Number(expected.rows[y][x-32]),`Independent original bar at field ${field}, ${x},${y}`);independentPixels++;}
    capture('original Protracker2 field '+field);
   }
   p.setMouse(128,50,1);clock.tick(40);check(p.state.halted&&!p.state.tracker.playing&&p.display.screens.size===0&&clock.pending()===0,'Original mouse exit and cleanup');
   return{frames,gpuFrames:frames,independentPixels,originalExit:true};
  }finally{cpuHost.detach();gpuHost.detach();if(p)p.stop();const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();}
 },{primitive:compile(require('./amcafBlitterProgram')()),original:compile(fs.readFileSync(path.join(__dirname,'../../examples/AMCAF/AMCAF_Examples/Protracker2.AMOS'))),oracle:require('../fixtures/amcaf/blitter.json'),packed:fs.readFileSync(path.join(__dirname,'../../examples/AMCAF/AMCAF_Examples/Data/mod.hawkeye')).toString('base64'),timerSource:require('./fakeTimers').createFakeTimers.toString(),filesSource:require('../../lib/amos/files').createMemoryFiles.toString(),gpuSources:require('./webglHostSources')()});
};
