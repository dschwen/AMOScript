'use strict';
module.exports=async function shortScreensProbe(page){
  const fs=require('fs'),path=require('path'),T=require('../../lib/Transpiler'),{binary,token:t}=require('./tokens');
  return page.evaluate(({blank,cube,clockSource,gpuSources})=>{
    const make=s=>new Function(`return (${s});`)(),check=(v,m)=>{if(!v)throw Error(m);},factory=source=>{const m={exports:{}};new Function('module',source)(m);return m.exports;};
    const model=make(gpuSources.model)(),gpu=make(gpuSources.renderer)(model,make(gpuSources.sprites)(),make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout))(document.createElement('canvas'));
    const canvas=document.createElement('canvas'),host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}}),gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
    let gpuFrames=0,matrixFrames=0,independentPixels=0;
    function capture(p,name,matrix=false){
      host.render();const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      if(matrix){const palette=[[17,34,51,255],[255,0,0,255],[0,255,0,255],[0,0,255,255]];for(let y=0;y<canvas.height;y++)for(let x=0;x<320;x++){const at=(y*320+x)*4;check(palette[((x>>4)+y)&3].every((v,i)=>rgba[at+i]===v),`Independent short-screen pixel differs ${name}:${x},${y}`);independentPixels++;}}
      const old=p.display.canvasFrame;p.display.canvasFrame=()=>{throw Error('GPU used CPU presentation');};try{gpuHost.render();}finally{p.display.canvasFrame=old;}
      const pixels=gpu.readPixels(),reference=p.display.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&pixels.every((v,i)=>v===reference[i]),'Short-screen GPU/reference differs');gpuFrames++;
      if(globalThis.AMOS_DEMO_OBSERVE){const frame=p.display.snapshotDisplay().frame;globalThis.AMOS_DEMO_OBSERVE({name:'Canvas: '+name,width:canvas.width,height:canvas.height,rgba});globalThis.AMOS_DEMO_OBSERVE({name:'WebGL: '+name,width:frame.outputWidth,height:frame.lines,rgba:pixels});}
    }
    try{
      for(const standard of ['PAL','NTSC'])for(const height of [8,32,77,78]){
        const p=factory(blank)({setTimeout(){},displayOptions:{snapshotStandard:standard}});p.tick(10);
        try{const d=p.display;d.open(0,320,height,4,0);const s=d.screen();[0x123,0xf00,0x0f0,0x00f].forEach((rgb,i)=>d.setColour(i,rgb));for(let y=0;y<height;y++)for(let x=0;x<320;x++)s.pixels[y*320+x]=((x>>4)+y)&3;d.doubleBuffer();s.pixels.fill(3);
          host.attach(p);gpuHost.attach(p);capture(p,`${standard} default ${height}-row bitmap`,true);matrixFrames++;
        }finally{host.detach();gpuHost.detach();p.stop();}
      }
      const clock=make(clockSource)(),p=factory(cube)({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){}});
      const key=code=>{host.focus();canvas.dispatchEvent(new KeyboardEvent('keydown',{key:code,code:'Key'+code.toUpperCase(),bubbles:true}));canvas.dispatchEvent(new KeyboardEvent('keyup',{key:code,code:'Key'+code.toUpperCase(),bubbles:true}));};
      try{
        host.attach(p);gpuHost.attach(p);p.tick(1000);check(p.state.location.line===95&&p.state.location.offset===2984,'Original reported startup was not reproduced');capture(p,'Original 3Dcube3 startup at 95/2984');
        clock.tick(0);check(p.state.location.line===163,'Original precalculation did not reach input');capture(p,'Original 3Dcube3 precalculation complete');
        key('a');clock.tick(20);check(p.state.location.line===215,'Original animation did not start');capture(p,'Original 3Dcube3 frame 1');
        clock.tick(5000);check(p.state.variables.int_n===251,'Original cube did not reach frame 251');capture(p,'Original 3Dcube3 frame 251');
        clock.tick(5000);check(p.state.location.line===230&&p.state.variables.int_n===501&&p.state.variables.float_t===500,'Original 500-frame benchmark did not finish');capture(p,'Original 3Dcube3 final report');
        key('b');clock.tick(20);check(p.state.halted&&clock.pending()===0,'Original final input did not end/clean the program');
      }finally{host.detach();gpuHost.detach();p.stop();}
    }finally{host.detach();gpuHost.detach();const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();}
    return{gpuFrames,matrixFrames,independentPixels,cubeFrames:500,ended:true};
  },{blank:new T(binary([[t('Wait Key')]])).toModule(),cube:new T(fs.readFileSync(path.join(__dirname,'../../examples/CompilerExamples/3Dcube3.AMOS'))).toModule({optimize:true}),clockSource:require('./fakeTimers').createFakeTimers.toString(),gpuSources:require('./webglHostSources')()});
};
