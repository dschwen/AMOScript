'use strict';
module.exports=async function gruSupportProbe(page){
  const T=require('../../lib/Transpiler'),{binary,token:t,integer:n,identifier:id,text,word}=require('./tokens');
  const fn=(name,...args)=>[t(name),t('('),...args.flatMap((a,i)=>[...(i?[t(',')]:[]),a]),t(')')];
  const blank=binary([[t('Wait Key')]]),start=fn('Start',n(10));
  const root=binary([[t('Colour'),n(1),t(','),n(0xf00)],[t('Ink'),n(1)],[t('Bar'),n(0),t(','),n(0),t('To'),n(31),t(','),n(31)],[t('Wait Key')],[t('Run File'),text('game:next.amos')]]);
  const child=binary([[t('Reserve As Work'),n(10),t(','),n(1)],
    [t('If'),word(0),fn('Exist',text('game:runs.bin')),t('Then'),t('Bload'),text('game:runs.bin'),t(','),n(10)],
    [t('Poke'),start,t(','),fn('Peek',start),t('+'),n(1)],
    [t('Bsave'),text('game:runs.bin'),t(','),start,t('To'),start,t('+'),n(1)],
    [t('Colour'),n(1),t(','),n(0x0f0)],[t('Wait Key')],[t('Run')]]);
  return page.evaluate(async({blank,html,clockSource,gpuSources})=>{
    const check=(v,m)=>{if(!v)throw Error(m);},make=s=>new Function(`return (${s});`)();
    const module={exports:{}};new Function('module',blank)(module);const clock=make(clockSource)(),p=module.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
    const model=make(gpuSources.model)(),gpu=make(gpuSources.renderer)(model,make(gpuSources.sprites)(),make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout))(document.createElement('canvas'));
    const canvas=document.createElement('canvas'),host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}}),gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
    let gpuFrames=0,independentPixels=0;
    try{
      p.tick(10);p.display.open(0,320,64,16,0);for(let i=0;i<16;i++)p.display.setColour(i,i*0x111);host.attach(p);gpuHost.attach(p);
      for(const[dx,dy]of [[-1,0],[1,0],[0,-1],[0,1],[-3,-2],[4,3]]){
        const s=p.display.screen();for(let y=0;y<64;y++)for(let x=0;x<320;x++)s.pixels[y*320+x]=(x*7+y*3)%16;
        const before=s.pixels.slice(),expected=before.slice();for(let y=2;y<60;y++)for(let x=1;x<319;x++){const tx=x+dx,ty=y+dy;if(tx>=0&&tx<320&&ty>=0&&ty<64)expected[ty*320+tx]=before[y*320+x];}
        p.display.defineScroll(1,1,2,319,60,dx,dy);p.display.scroll(1);check(s.pixels.every((v,i)=>v===expected[i]),'Independent Scroll pixels differ');independentPixels+=expected.length;
        host.render();const old=p.display.canvasFrame;p.display.canvasFrame=()=>{throw Error('Scroll GPU used CPU presentation');};try{gpuHost.render();}finally{p.display.canvasFrame=old;}
        const actual=gpu.readPixels(),reference=p.display.renderDisplay();check(gpu.stats.lastResult.backend==='gpu' && actual.every((v,i)=>v===reference[i]),'Scroll GPU mismatch');gpuFrames++;
        if(globalThis.AMOS_DEMO_OBSERVE){const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;globalThis.AMOS_DEMO_OBSERVE({name:`Canvas: Scroll ${dx},${dy}`,width:canvas.width,height:canvas.height,rgba});const f=p.display.snapshotDisplay().frame;globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: Scroll ${dx},${dy}`,width:f.outputWidth,height:f.lines,rgba:actual});}
      }
    }finally{host.detach();gpuHost.detach();p.stop();gpu.dispose();}
    const frame=document.createElement('iframe');frame.title='Linked Run programs';frame.style.cssText='width:100%;height:580px';document.body.append(frame);
    const loaded=new Promise(resolve=>frame.onload=resolve);frame.srcdoc=html;await loaded;
    const doc=frame.contentDocument,win=frame.contentWindow;
    const wait=async predicate=>{for(let i=0;i<150;i++){if(predicate())return;await new Promise(r=>setTimeout(r,20));}throw Error('Linked Run did not complete: '+doc.getElementById('game-status').textContent);};
    try{
      doc.getElementById('game-restart').click();check(doc.getElementById('game-viewport').dataset.phase==='running','Root did not start');
      const send=()=>{const canvas=doc.getElementById('game-input');canvas.focus();canvas.dispatchEvent(new win.KeyboardEvent('keydown',{code:'KeyA',key:'a',bubbles:true}));canvas.dispatchEvent(new win.KeyboardEvent('keyup',{code:'KeyA',key:'a',bubbles:true}));};
      send();await wait(()=>win.AMOS_GAME_PAGE.files.exists('game:runs.bin'));
      check(win.AMOS_GAME_PAGE.files.read('game:runs.bin').charCodeAt(0)===1,'Run File did not enter linked factory');
      send();await wait(()=>win.AMOS_GAME_PAGE.files.read('game:runs.bin').charCodeAt(0)===2);
      check(doc.getElementById('game-viewport').dataset.phase==='running','Bare Run did not restart current factory');
      check(win.AMOS_GAME_PAGE.sleepScale()===1,'Run lost host speed');
    }finally{await win.AMOS_GAME_PAGE.dispose();frame.remove();}
    return{gpuFrames,independentPixels,linkedRun:true,bareRun:true};
  },{blank:new T(blank).toModule(),html:require('../../tools/build_game_page').buildGamePage(root,{programs:{'game:next.amos':child.toString('base64')},title:'Linked AMOS programs',debug:true}),clockSource:require('./fakeTimers').createFakeTimers.toString(),gpuSources:require('./webglHostSources')()});
};
