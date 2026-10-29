'use strict';
module.exports = async function compilerExamplesProbe(page) {
  const fs=require('fs'),path=require('path'),Transpiler=require('../../lib/Transpiler');
  return page.evaluate(({source,cube,clockSource,gpuSources,graphicsAssets,graphicsPrograms,decodeSource})=>{
    const make=s=>new Function(`return (${s});`)(), check=(v,m)=>{if(!v)throw Error(m);};
    const model=make(gpuSources.model)(), gpu=make(gpuSources.renderer)(model,make(gpuSources.sprites)(),make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout))(document.createElement('canvas'));
    const clock=make(clockSource)(), m={exports:{}};new Function('module',source)(m);
    const p=m.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
    const canvas=document.createElement('canvas'),host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}}),gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
    let frames=0,independentPixels=0,cubeFields=0,graphicsPixels=0;const clocks=[];
    function capture(program,name,expected) {
      host.render();const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      if(expected)for(let y=0;y<32;y++)for(let x=0;x<320;x++){
        const color=expected(x,y),at=(y*320+x)*4;check(color.every((v,i)=>rgba[at+i]===v),`Independent dual pixel differs ${name}:${x},${y}`);independentPixels++;
      }
      const old=program.display.canvasFrame;program.display.canvasFrame=()=>{throw Error('GPU used CPU rendering');};
      try{gpuHost.render();}finally{program.display.canvasFrame=old;}
      const hardware=gpu.readPixels(),reference=program.display.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&hardware.every((v,i)=>v===reference[i]),'GPU/reference differs');frames++;
      if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:'Canvas: '+name,width:canvas.width,height:canvas.height,rgba});const snap=program.display.snapshotDisplay();globalThis.AMOS_DEMO_OBSERVE({name:'WebGL: '+name,width:snap.frame.outputWidth,height:snap.frame.lines,rgba:hardware});}
    }
    try{
      host.attach(p);gpuHost.attach(p);p.tick(1000);check(p.state.waiting==='key','Prepared fixture did not reach key');
      capture(p,'Dual playfields and planar Copy/blocks',(x,y)=>x===0&&y===0?[255,0,0,255]:x===1&&y<4?[0,255,0,255]:[0,0,0,255]);
      p.shiftUp(2,1,3,1);clock.tick(20);
      capture(p,'Shift Up at first VBL',(x,y)=>x===0&&y===0?[255,255,255,255]:x===1&&y<4?[0,255,0,255]:[0,0,0,255]);
      p.shiftOff();p.stop();host.detach();gpuHost.detach();
      // The original cube source runs without source slicing or VM state edits.
      for(const [hz,fields] of [[50,60],[50,120]]) {
        const module={exports:{}};new Function('module',cube)(module);const time=make(clockSource)();clocks.push(time);
        const original=module.exports({vblHz:hz,now:time.now,setTimeout:time.setTimeout,clearTimeout:time.clearTimeout,displayOptions:{snapshotStandard:hz===60?'NTSC':'PAL'}});
        try {host.attach(original);gpuHost.attach(original);original.tick(1000);for(let f=0;f<fields;f++){time.tick(1000/hz);cubeFields++;}check(!original.state.halted,'Cube halted unexpectedly');capture(original,`Original 3Dcube1 ${hz}Hz — ${fields} fields`);}
        finally{host.detach();gpuHost.detach();original.stop();check(time.pending()===0,'Cube retained wake');}
      }
      const decode=make(decodeSource), files={read:name=>{const bytes=graphicsAssets[name.replace(/\\/g,'/').toLowerCase().split('/').pop()];if(!bytes)throw Error('Missing supplied graphic: '+name);return atob(bytes);}};
      for(const entry of graphicsPrograms) {
        const module={exports:{}};new Function('module',entry.source)(module);const time=make(clockSource)();
        const original=module.exports({files,now:time.now,setTimeout:time.setTimeout,clearTimeout:time.clearTimeout,print(){}});
        const bytes=Uint8Array.from(atob(graphicsAssets[entry.image]),c=>c.charCodeAt(0)),expected=decode(bytes);
        try {
          host.attach(original);gpuHost.attach(original);original.tick(1000);
          if(entry.name==='Mapping') {
            const loaded=original.display.screen(1).pixels;check(loaded.length===expected.pixels.length&&loaded.every((v,i)=>v===expected.pixels[i]),'Mapping image differs from independent ILBM decoder');graphicsPixels+=loaded.length;
            capture(original,'Original Mapping instructions');time.tick(3200);check(original.state.location.line===107&&!original.state.halted,'Mapping did not reach original preview wait');capture(original,'Original Mapping preview');
          } else {
            const image=original.banks.get(1).images[0];for(let y=0;y<16;y++)for(let x=0;x<16;x++)check(image.pixels[y*16+x]===expected.pixels[y*320+x],'Captured original Bob differs');graphicsPixels+=256;
            time.tick(2000);check(original.bobs.size===63&&[...original.bobs.values()].filter(b=>b.image&0x3fff).length===7&&!original.state.halted,'BouncBobs did not reach live animation');capture(original,'Original BouncBobs — seven active Bobs');
          }
        } finally{host.detach();gpuHost.detach();original.stop();check(time.pending()===0,'Graphics example retained a wake');}
      }
    } finally{host.detach();gpuHost.detach();p.stop();const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();}
    return {frames,gpuFrames:frames,independentPixels,cubeFields,graphicsPixels};
  },{source:new Transpiler(require('./compilerExamplesProgram')()).toModule({optimize:true}),cube:new Transpiler(fs.readFileSync(path.join(__dirname,'../../examples/CompilerExamples/3Dcube1.AMOS'))).toModule({optimize:true}),clockSource:require('./fakeTimers').createFakeTimers.toString(),gpuSources:require('./webglHostSources')(),decodeSource:require('./decodeSavedIff').toString(),graphicsAssets:Object.fromEntries(['Demo_pic.iff','Sprites_pic.iff'].map(name=>[name.toLowerCase(),fs.readFileSync(path.join(__dirname,'../../examples/CompilerExamples/Graphics',name)).toString('base64')])),graphicsPrograms:['Mapping','BouncBobs'].map(name=>({name,image:name==='Mapping'?'demo_pic.iff':'sprites_pic.iff',source:new Transpiler(fs.readFileSync(path.join(__dirname,'../../examples/CompilerExamples',name+'.AMOS'))).toModule({optimize:true})}))});
};
