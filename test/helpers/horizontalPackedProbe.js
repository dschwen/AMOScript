'use strict';
module.exports=async function horizontalPackedProbe(page){
  const fs=require('fs'),path=require('path'),T=require('../../lib/Transpiler'),{binary,token:t}=require('./tokens');
  const root=path.join(__dirname,'../../examples/CompilerExamples');
  const entries=require('../fixtures/compiler-examples/galax-packed.json').images.map(e=>({...e,pixels:fs.readFileSync(path.join(__dirname,'../fixtures/compiler-examples',e.file)).toString('base64')}));
  return page.evaluate(({blank,programs,assets,entries,clockSource,gpuSources})=>{
    const make=s=>new Function(`return (${s});`)(),check=(v,m)=>{if(!v)throw Error(m);},factory=s=>{const m={exports:{}};new Function('module',s)(m);return m.exports;};
    const decoded=entries.map(e=>({...e,pixels:Uint8Array.from(atob(e.pixels),c=>c.charCodeAt(0))}));
    const files={read:name=>{const data=assets[name.replace(/\\/g,'/').toLowerCase()];if(!data)throw Error('Unexpected asset '+name);return atob(data);},isDirectory:name=>Object.keys(assets).some(key=>key.startsWith(name.toLowerCase().replace(/\/?$/,'/'))),exists:name=>Object.hasOwn(assets,name.toLowerCase())};
    const model=make(gpuSources.model)(),gpu=make(gpuSources.renderer)(model,make(gpuSources.sprites)(),make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout))(document.createElement('canvas'));
    const canvas=document.createElement('canvas'),host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}}),gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
    let gpuFrames=0,independentPixels=0,matrixFrames=0,packedImages=0,programsEnded=0;
    const rgb=c=>[(c>>8)*17,((c>>4)&15)*17,(c&15)*17,255];
    function capture(p,name,expected=null){
      host.render();const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      if(expected)for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const at=(y*canvas.width+x)*4;check(expected(x,y).every((v,i)=>rgba[at+i]===v),`Independent pixel differs ${name}:${x},${y}`);independentPixels++;}
      const old=p.display.canvasFrame;p.display.canvasFrame=()=>{throw Error('GPU used CPU presentation');};try{gpuHost.render();}finally{p.display.canvasFrame=old;}
      const pixels=gpu.readPixels(),reference=p.display.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&pixels.every((v,i)=>v===reference[i]),'Horizontal GPU/reference differs '+name);gpuFrames++;
      if(globalThis.AMOS_DEMO_OBSERVE){const f=p.display.snapshotDisplay().frame;globalThis.AMOS_DEMO_OBSERVE({name:'Canvas: '+name,width:canvas.width,height:canvas.height,rgba});globalThis.AMOS_DEMO_OBSERVE({name:'WebGL: '+name,width:f.outputWidth,height:f.lines,rgba:pixels});}
    }
    const attach=p=>{host.attach(p);gpuHost.attach(p);},detach=p=>{host.detach();gpuHost.detach();p.stop();};
    try{
      for(const hires of [false,true])for(const x of [96,143,180,240])for(const offset of [0,5]){
        const p=factory(blank)({setTimeout(){}});p.tick(10);
        try{const d=p.display;d.open(0,768,64,4,hires?0x8000:0);const s=d.screen(),palette=[0x123,0xf00,0x0f0,0x00f];palette.forEach((c,i)=>d.setColour(i,c));for(let y=0;y<64;y++)for(let sx=0;sx<768;sx++)s.pixels[y*768+sx]=(sx^(sx>>3)^(sx>>5)^y*3)&3;d.doubleBuffer();s.pixels.fill(0);d.screenDisplay(0,x,50,320,32);d.screenOffset(0,offset,3);attach(p);
          const start=hires?offset&~1:offset;capture(p,`${hires?'Hires':'Lowres'} x=${x}, offset=${offset}`,(x,y)=>{const sx=start+x;return rgb(palette[(sx^(sx>>3)^(sx>>5)^(y+3)*3)&3]);});matrixFrames++;
        }finally{detach(p);}
      }
      for(const e of decoded){const p=factory(blank)({setTimeout(){},files});p.tick(10);
        try{p.loadBanks('amospro_extras:compiler_examples/amos_versions/galax/'+e.name.toLowerCase()+'.abk',10);
          let offset=0;if(e.name==='PicAst2'){p.display.open(0,320,670,8,0);e.palette.forEach((c,i)=>p.display.setColour(i,c));p.display.screenDisplay(0,150,56,320,228);p.unpackExisting(10);p.display.screenOffset(0,0,420);offset=420;}else p.unpackScreen(10,0);
          attach(p);capture(p,'GALAX packed '+e.name,(x,y)=>rgb(e.palette[e.pixels[(y+offset)*e.width+x]]));packedImages++;
        }finally{detach(p);}
      }
      for(const entry of programs){const clock=make(clockSource)(),p=factory(entry.source)({files,now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){}});
        try{attach(p);p.tick(1000);
          if(entry.name==='Fractal3'){clock.tick(80);check(p.state.location.line===54,'Fractal3 missed final input');capture(p,'Original Fractal3 complete');p.sendKey('a');clock.tick(20);check(p.state.halted,'Fractal3 did not end');programsEnded++;}
          if(entry.name==='Plasma'){clock.tick(80);check(p.state.location.line===109&&p.display.screen(1).windowed,'Plasma animation/report window missing');const s=p.display.screen(0);for(let y=0;y<512;y++)for(let x=0;x<512;x++){let expected=0;if(x<496&&y<496){let sx=x%248,sy=y%248;if(sx>124)sx=248-sx;if(sy>124)sy=248-sy;expected=Math.floor((sx*sx+sy*sy)/16)%31+1;}check(s.pixels[y*512+x]===expected,'Independent Plasma bitmap differs');independentPixels++;}
            capture(p,'Original Plasma with report');clock.tick(80);capture(p,'Original Plasma shifted and scrolled');p.sendKey('a');clock.tick(20);check(p.state.halted,'Plasma did not end');programsEnded++;}
          if(entry.name==='GALAX'){clock.tick(1420);check(p.state.location.line===84,'GALAX title wait missing');const e=decoded.find(e=>e.name==='PicPres');capture(p,'Original GALAX title',(x,y)=>rgb(e.palette[e.pixels[y*320+x]]));clock.tick(5200);check(p.state.location.line===1025&&!p.state.halted,'GALAX did not reach original menu');capture(p,'Original GALAX scrolling menu');}
        }finally{detach(p);check(clock.pending()===0,'Original retained a wake');}
      }
    }finally{host.detach();gpuHost.detach();const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();}
    return{gpuFrames,matrixFrames,packedImages,independentPixels,programsEnded,galaxMenu:true};
  },{blank:new T(binary([[t('Wait Key')]])).toModule(),programs:['Fractal3','Plasma','GALAX'].map(name=>({name,source:new T(fs.readFileSync(path.join(root,name==='GALAX'?'Galax/GALAX.AMOS':name+'.AMOS'))).toModule({optimize:true})})),assets:require('../../tools/build_compiler_examples').buildCompilerExamples().assets,entries,clockSource:require('./fakeTimers').createFakeTimers.toString(),gpuSources:require('./webglHostSources')()});
};
