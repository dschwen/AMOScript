'use strict';
module.exports=async function galaxPlayProbe(page) {
  const fs=require('fs'),path=require('path'),T=require('../../lib/Transpiler');
  const {binary,token:t,integer:n,text}=require('./tokens');
  const sample=binary([
    [t('Load Bank'),text('galax/Sprites.Abk'),t(','),n(1)],[t('Load Bank'),text('galax/Moves.Abk'),t(','),n(4)],
    [t('Sprite'),n(0),t(','),n(250),t(','),n(80),t(','),n(1)],
    [t('Amal'),n(0),t(','),text('PLay 1;Let RZ=1;End')],[t('Amal On')],[t('Wait Key')]
  ]);
  return page.evaluate(({source,sample,assets,oracle,clockSource,replaySource,gpuSources})=>{
    const make=s=>new Function(`return (${s});`)(),factory=s=>{const module={exports:{}};new Function('module',s)(module);return module.exports;};
    const check=(value,message)=>{if(!value)throw Error(message);};
    const files={read:name=>{const value=assets[name.toLowerCase()];if(!value)throw Error('Missing GALAX asset '+name);return atob(value);},isDirectory:()=>true,exists:name=>!!assets[name.toLowerCase()]};
    const model=make(gpuSources.model)(),gpu=make(gpuSources.renderer)(model,make(gpuSources.sprites)(),make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout))(document.createElement('canvas'));
    const canvas=document.createElement('canvas'),host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
    const gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
    let gpuFrames=0,positions=0;
    const capture=(p,name)=>{
      host.render();const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      const old=p.display.canvasFrame;p.display.canvasFrame=()=>{throw Error('GALAX GPU called CPU presentation');};
      try{gpuHost.render();}finally{p.display.canvasFrame=old;}
      const actual=gpu.readPixels(),expected=p.display.renderDisplay();
      check(gpu.stats.lastResult.backend==='gpu' && actual.every((v,i)=>v===expected[i]),'GALAX GPU/reference differs: '+name);gpuFrames++;
      if(globalThis.AMOS_DEMO_OBSERVE){const f=p.display.snapshotDisplay().frame;globalThis.AMOS_DEMO_OBSERVE({name:'Canvas: '+name,width:canvas.width,height:canvas.height,rgba});globalThis.AMOS_DEMO_OBSERVE({name:'WebGL: '+name,width:f.outputWidth,height:f.lines,rgba:actual});}
    };
    const attach=p=>{host.attach(p);gpuHost.attach(p);};
    const detach=(p,c)=>{host.detach();gpuHost.detach();p.stop();check(c.pending()===0,'GALAX retained a wake');};
    let result;
    try {
      for(const trace of oracle.traces) {
        const c=make(clockSource)(),p=factory(sample)({files,now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout});
        try {
          attach(p);p.tick(1000);p.installAmal(0,`PLay ${trace.number};Let RZ=1;End`);p.amalOn();
          for(let i=0;i<trace.positions.length;i++) {
            c.tick(20);const [x,y]=trace.positions[i];
            check(p.spriteInfo('X Sprite',0)===x && p.spriteInfo('Y Sprite',0)===y,`Independent PLay differs: ${trace.number}:${i}`);positions++;
            if(i===0 || i===Math.floor(trace.positions.length/2))capture(p,`Recorded path ${trace.number}, field ${i+1}`);
          }
          check(p.amreg(25)===1 && c.pending()===0,'Recorded path did not finish');
        }finally{detach(p,c);}
      }
      const c=make(clockSource)(),p=factory(source)({files,now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,print(){}});
      try{attach(p);result=make(replaySource)(p,c,name=>capture(p,name));}finally{detach(p,c);}
    }finally{host.detach();gpuHost.detach();const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();}
    return{...result,gpuFrames,positions};
  },{source:new T(fs.readFileSync(path.join(__dirname,'../../examples/CompilerExamples/Galax/GALAX.AMOS'))).toModule({optimize:true}),sample:new T(sample).toModule({optimize:true}),assets:require('../../tools/build_compiler_examples').buildCompilerExamples().assets,oracle:require('../fixtures/compiler-examples/galax-movements.json'),clockSource:require('./fakeTimers').createFakeTimers.toString(),replaySource:require('./galaxPlayReplay').toString(),gpuSources:require('./webglHostSources')()});
};
