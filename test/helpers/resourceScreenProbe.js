'use strict';
module.exports=async function resourceScreenProbe(page){
  const fs=require('fs'),path=require('path'),Transpiler=require('../../lib/Transpiler'),{binary,token:t,integer:n}=require('./tokens'),startup=require('./interfaceStartup');
  const defaults=fs.readFileSync(path.join(__dirname,'../fixtures/interface/default-resource.abk'));
  // Independent offsets in the pinned ABK: file header20 + metadata400 +4.
  const systemPalette=Array.from({length:32},(_,i)=>defaults.readUInt16BE(424+i*2));
  const graphicsPalette=[0,11,144,3072,0x222,0x666,0xaaa,0xeee,4064,255,1288,3007,2794,4027,4000,127,0,3784,3168,3744,639,1181,1454,2783,3039,3311,4095,1032,2574,3598,3592,3822];
  const cases=[{name:'Original Graphics lines 1-16',source:new Transpiler(startup.prefix()).toModule(),palette:graphicsPalette,colours:16,background:0},
    {name:'Native system resource screen',source:new Transpiler(binary([[t('Resource Screen Open'),n(0),t(','),n(640),t(','),n(200),t(','),n(0)],[t('Wait Key')]])).toModule(),palette:systemPalette,colours:8,background:1}];
  return page.evaluate(({cases,asset,clockSource,gpuSources})=>{
    const make=source=>new Function('return ('+source+');')(),check=(value,message)=>{if(!value)throw Error(message);};
    const model=make(gpuSources.model)(),createGpu=make(gpuSources.renderer)(model,make(gpuSources.sprites)(),make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout));
    let frames=0,gpuFrames=0,independentPixels=0;
    for(const entry of cases){
      const compiled={exports:{}};new Function('module',entry.source)(compiled);const clock=make(clockSource)(4);
      const p=compiled.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){},files:{read(name){check(name.toLowerCase()==='amospro_tutorial:tutorials/interface/example_resource.abk','Unexpected resource asset');return atob(asset);}}});
      const canvas=document.createElement('canvas'),gpu=createGpu(document.createElement('canvas'));
      const host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}}),gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
      try{
        host.attach(p);gpuHost.attach(p);p.tick(1000);clock.tick(40);const d=p.display,s=d.screen();
        check(p.state.waiting==='key'&&s.width===640&&s.height===200&&s.colours===entry.colours&&s.mode===0x8000&&!s.cursorVisible,'Resource screen state differs');
        check(s.palette.every((v,i)=>v===entry.palette[i]),'Independent resource palette differs');
        check(s.pixels.every(value=>value===entry.background),'Resource Screen Open drew unexpected artwork');
        function capture(label,preview){
          host.render();const cpu=d.canvasFrame(),pixels=canvas.getContext('2d').getImageData(0,0,640,200).data;
          for(let y=0;y<200;y++)for(let x=0;x<640;x++){
            if(preview&&y<60)continue;
            const index=preview&&y>=64&&y<128?Math.floor(x/(640/entry.colours)):entry.background,rgb=entry.palette[index],at=(y*640+x)*4;
            check(pixels[at]===(rgb>>8&15)*17&&pixels[at+1]===(rgb>>4&15)*17&&pixels[at+2]===(rgb&15)*17&&pixels[at+3]===255,'Independent resource pixel differs');independentPixels++;
          }
          const old=d.canvasFrame;d.canvasFrame=()=>{throw Error('Resource GPU used CPU presentation');};try{gpuHost.render();}finally{d.canvasFrame=old;}
          const actual=gpu.readPixels(),reference=d.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&actual.length===reference.length&&actual.every((v,i)=>v===reference[i]),'Resource GPU pixels differ');frames++;gpuFrames++;
          if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:'Canvas: '+label,width:cpu.width,height:cpu.height,rgba:cpu.rgba});globalThis.AMOS_DEMO_OBSERVE({name:'WebGL: '+label,width:gpu.stats.lastResult.width,height:gpu.stats.lastResult.lines,rgba:actual});}
        }
        capture(entry.name,false);
        // Declared preview only: source prefixes produce a blank screen; these
        // indexed swatches make the resource's actual palette visible.
        for(let i=0;i<entry.colours;i++){d.ink(i);d.bar(i*640/entry.colours,64,(i+1)*640/entry.colours-1,127);}
        d.ink(entry.colours-1,entry.background);d.text(8,15,entry.name);d.text(8,31,'Indexed palette preview - dialogue execution remains gated');
        capture(entry.name+' / declared palette preview',true);
      }finally{host.detach();gpuHost.detach();p.stop();check(clock.pending()===0,'Resource fixture retained timers');const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();}
    }
    return {frames,gpuFrames,independentPixels,programs:cases.length};
  },{cases,asset:startup.resource().toString('base64'),clockSource:require('./fakeTimers').createFakeTimers.toString(),gpuSources:require('./webglHostSources')()});
};
