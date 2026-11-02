'use strict';
module.exports=async function interfaceRunProbe(page){
  const fixture=require('./interfaceRunFixture'),Transpiler=require('../../lib/Transpiler');
  return page.evaluate(({programs,asset,clockSource,gpuSources})=>{
    const make=source=>new Function('return ('+source+');')(),check=(v,m)=>{if(!v)throw Error(m);};
    const model=make(gpuSources.model)(),createGpu=make(gpuSources.renderer)(model,make(gpuSources.sprites)(),make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout));
    let frames=0,gpuFrames=0,independentPixels=0;
    for(let which=0;which<programs.length;which++){
      const compiled={exports:{}};new Function('module',programs[which])(compiled);const clock=make(clockSource)(4),p=compiled.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){},files:{read:()=>atob(asset)}});
      const canvas=document.createElement('canvas'),gpu=createGpu(document.createElement('canvas')),host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}}),gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
      try{
        host.attach(p);gpuHost.attach(p);p.tick(2000);clock.tick(40);check(p.state.waiting==='key'&&p.state.variables.int_result===0,'Interface Run did not return');
        const d=p.display;
        function capture(name,title){
          host.render();const cpu=d.canvasFrame();
          if(which===0){
            const expected=new Uint8Array(640*200),rectangles=[[20,135,40,145,1],[65,135,105,155,1],[120,135,200,155,0],[124,137,196,153,3],[220,135,272,155,4],[20,150,40,175,3],[50,160,275,175,7]];
            for(const [x1,y1,x2,y2,colour]of rectangles){for(let x=x1;x<=x2;x++){expected[(y1+5)*640+x+320]=colour;expected[(y2+5)*640+x+320]=colour;}for(let y=y1;y<=y2;y++){expected[(y+5)*640+x1+320]=colour;expected[(y+5)*640+x2+320]=colour;}}
            const palette=[0,11,144,3072,0x222,0x666,0xaaa,0xeee];
            for(let y=title?24:0;y<200;y++)for(let x=0;x<640;x++){const at=y*640+x,rgb=palette[expected[at]],rgba=at*4;check(cpu.rgba[rgba]===(rgb>>8&15)*17&&cpu.rgba[rgba+1]===(rgb>>4&15)*17&&cpu.rgba[rgba+2]===(rgb&15)*17&&cpu.rgba[rgba+3]===255,'Independent original rectangle pixel differs');independentPixels++;}
          }
          const old=d.canvasFrame;d.canvasFrame=()=>{throw Error('Interface Run GPU used CPU presentation');};try{gpuHost.render();}finally{d.canvasFrame=old;}
          const actual=gpu.readPixels(),reference=d.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&actual.length===reference.length&&actual.every((v,i)=>v===reference[i]),'Interface Run GPU differs');frames++;gpuFrames++;
          if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:'Canvas: '+name,width:cpu.width,height:cpu.height,rgba:cpu.rgba});globalThis.AMOS_DEMO_OBSERVE({name:'WebGL: '+name,width:gpu.stats.lastResult.width,height:gpu.stats.lastResult.lines,rgba:actual});}
        }
        if(which===0){capture('original Graphics rectangle excerpt',false);p.sendKey('next');clock.tick(40);check(p.dialogVariable('number',1,0)===5,'Postfix numeric literals merged');capture('rectangle excerpt and executed title',true);}
        else{check(p.dialogVariable('string',2,1)==='Select number 99','Executed AR did not read original array');capture('executed PR VA AR AS list',false);}
        p.stop();p.resume();check(p.dialogChannels().length===which+1,'Run lost channels on Stop/Resume');
      }finally{host.detach();gpuHost.detach();p.stop();check(clock.pending()===0,'Interface Run leaked timers');const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();}
    }
    return {frames,gpuFrames,independentPixels,programs:programs.length};
  },{programs:[fixture.shapes(),fixture.arrays()].map(source=>new Transpiler(source).toModule()),asset:fixture.resource().toString('base64'),clockSource:require('./fakeTimers').createFakeTimers.toString(),gpuSources:require('./webglHostSources')()});
};
