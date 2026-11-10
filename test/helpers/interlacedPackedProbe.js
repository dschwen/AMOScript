'use strict';
module.exports=async function(page){
  const f=require('./interlacedPackedProgram')();
  return page.evaluate(({source,bank,gpuSources})=>{
    const make=s=>new Function(`return (${s});`)(),m={exports:{}};new Function('module',source)(m);
    const model=make(gpuSources.model)(),sprites=make(gpuSources.sprites)(),gpu=make(gpuSources.renderer)(model,sprites,make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout))(document.createElement('canvas'));
    const canvas=document.createElement('canvas');document.body.append(canvas);
    const opts={requestAnimationFrame:()=>1,cancelAnimationFrame(){}},host=AMOS_BROWSER.createCanvasHost(canvas,opts),gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{...opts,renderer:gpu});
    const p=m.exports({setTimeout,clearTimeout,files:{read:name=>{if(name!=='atlas.abk')throw Error(name);return atob(bank);}}}),check=(ok,message)=>{if(!ok)throw Error(message);};
    const sizes=[[684,536],[640,8],[640,32],[320,12]],palette=[0,0xf00,0x0f0,0x00f,0xff0,0xf0f,0x0ff,0xfff];let samples=0;
    try{host.attach(p);gpuHost.attach(p);for(let stage=0;stage<4;stage++){
      if(stage)p.sendKey('next');p.tick(1000);check(!p.state.error,'VM error');
      const [width,height]=sizes[stage],expected=new Uint8ClampedArray(width*height*4);
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        let rgb;
        if(stage===3||stage===2&&y>=8)rgb=0xfff;
        else if(stage===2&&y>=6)rgb=0;
        else{const sx=(x>>1)+(stage?16:0),sy=y+(stage?891:0);rgb=palette[((sx>>4)+3*sy)&7];}
        const at=(y*width+x)*4;expected[at]=(rgb>>8)*17;expected[at+1]=((rgb>>4)&15)*17;expected[at+2]=(rgb&15)*17;expected[at+3]=255;samples++;
      }
      host.render();check(canvas.width===width&&canvas.height===height,'Canvas geometry');
      const actual=canvas.getContext('2d').getImageData(0,0,width,height).data;check(actual.every((v,i)=>v===expected[i]),'Independent Canvas pixels stage '+stage);
      const old=p.display.canvasFrame;p.display.canvasFrame=()=>{throw Error('CPU fallback');};try{gpuHost.render();}finally{p.display.canvasFrame=old;}
      const result=gpu.readPixels(),frame=p.display.snapshotDisplay().frame;
      if(stage===3){check(frame.outputWidth===width*2,'Progressive lowres grid');for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let c=0;c<4;c++)check(result[(y*width*2+x*2)*4+c]===expected[(y*width+x)*4+c],'GPU progressive pixels');}
      else check(result.length===expected.length&&result.every((v,i)=>v===expected[i]),'Independent GPU pixels stage '+stage);
      check(gpu.stats.lastResult.backend==='gpu','GPU backend');
      if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:`Canvas: interlaced unpack ${stage+1}`,width,height,rgba:actual});globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: interlaced unpack ${stage+1}`,width:frame.outputWidth,height:frame.lines,rgba:result});}
    }return{frames:4,gpuFrames:4,samples,bitmapRows:900};}finally{host.detach();gpuHost.detach();p.stop();const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();}
  },{source:new(require('../../lib/Transpiler'))(f.bytes).toModule(),bank:f.bank.toString('base64'),gpuSources:require('./webglHostSources')()});
};
