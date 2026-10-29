'use strict';
module.exports=async function planetZybexGameProbe(page){
  return page.evaluate(async({source,assets,oracle,pcm,replaySource,clockSource,gpuSources,audioSource,progressionSource,inputs,progressionOracle})=>{
    const make=s=>new Function(`return (${s});`)(),check=(v,m)=>{if(!v)throw Error(m);};
    const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
    const compiled={exports:{}};new Function('module',source)(compiled);const replay=make(replaySource),clockFactory=make(clockSource),progression=make(progressionSource);
    const model=make(gpuSources.model)(),spriteModel=make(gpuSources.sprites)(),renderer=make(gpuSources.renderer)(model,spriteModel,make(gpuSources.resources)(model),make(gpuSources.shaders),make(gpuSources.layout));
    const keys=[[1,'ArrowUp'],[2,'ArrowDown'],[4,'ArrowLeft'],[8,'ArrowRight'],[16,'ControlLeft']];
    let gpuFrames=0,regions=0,totalFrames=0,booms=0,samples=0,verticalFrames=0,thirdFrames=0,progressionRuns=0;const results=[],shots={};
    for(const standard of ['PAL','NTSC'])for(const mode of ['keyboard','gamepad'])for(const path of ['loss','progression']){
      const clock=clockFactory(1),canvas=document.createElement('canvas'),gpu=renderer(document.createElement('canvas')),captures=[];
      const gpuHost=AMOS_BROWSER.createCanvasHost(gpu.resources.context.canvas,{renderer:gpu,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
      let host,device=0,held=0;
      try{
        const run=path==='loss'?replay:(create,c,f,input,capture,audio,std)=>progression(create,c,f,input,inputs,capture,audio,std);
        const result=run(compiled.exports,clock,{read:name=>atob(assets[name.toLowerCase()])},p=>{
          host=AMOS_BROWSER.createCanvasHost(canvas,{joysticks:[{port:1,keyboard:mode==='keyboard'?{fire:['ControlLeft','ControlRight']}:false,gamepad:mode==='gamepad'}],hasFocus:()=>true,
            getGamepads:()=>[{connected:true,mapping:'standard',axes:[device&4?-1:device&8?1:0,device&1?-1:device&2?1:0],buttons:Array.from({length:16},(_,i)=>({pressed:i===0&&!!(device&16)}))}],requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
          host.attach(p);gpuHost.attach(p);
          function set(mask){
            if(mode==='gamepad')device=mask;
            else{for(const[bit,code]of keys)if((held&bit)!==(mask&bit))canvas.dispatchEvent(new KeyboardEvent(mask&bit?'keydown':'keyup',{code,key:code,ctrlKey:code==='ControlLeft',bubbles:true,cancelable:true}));held=mask;}
          }
          return{set,key:key=>{canvas.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyA',key,bubbles:true,cancelable:true}));canvas.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyA',key,bubbles:true,cancelable:true}));},dispose(){set(0);host.detach();gpuHost.detach();}};
        },(name,p,meta)=>{
          const expected=(path==='loss'?oracle:progressionOracle).frames.find(f=>f.name===name);check(expected,'Unknown replay capture');if(expected.sprite)check(expected.sprite.every((value,i)=>p.spriteInfo(['X Sprite','Y Sprite','I Sprite'][i],15)===value)&&p.state.variables.int_score===expected.score&&meta.frame===expected.frame&&meta.vertical===expected.vertical&&meta.third===(expected.third||0),'Frozen progression checkpoint differs');host.render();const actual=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          check(canvas.width===640&&canvas.height===171,'Mixed-resolution game surface differs');captures.push({actual,expected});
          const previous=p.display.canvasFrame;p.display.canvasFrame=()=>{throw Error('GPU used CPU presentation');};try{gpuHost.render();}finally{p.display.canvasFrame=previous;}
          const hardware=gpu.readPixels(),reference=p.display.renderDisplay();check(gpu.stats.lastResult.backend==='gpu'&&hardware.length===reference.length&&hardware.every((v,i)=>v===reference[i]),'Full game GPU differs');gpuFrames++;
          if(globalThis.AMOS_DEMO_OBSERVE){globalThis.AMOS_DEMO_OBSERVE({name:`Canvas: ${standard} ${mode} ${name}`,width:640,height:171,rgba:actual});globalThis.AMOS_DEMO_OBSERVE({name:`WebGL: ${standard} ${mode} ${name}`,width:gpu.stats.lastResult.width,height:gpu.stats.lastResult.lines,rgba:hardware});}
        },{command:e=>{if(e.type==='play'&&path==='loss'){if(e.effect==='boom')booms++;else if(e.sample.number===4){samples++;if(!shots[standard])shots[standard]=e;}}}},standard);
        check(clock.pending()===0&&result.stopResume,'Replay retained timers');
        if(path==='loss')check(result.deaths.join(',')==='4,3,2,1,0'&&result.restarts.join(',')==='4,3,2,1'&&result.freshLives===5&&result.freshLevel===1,'Original loss/fresh-game replay differs');
        else{check(result.frames===1201&&result.verticalFrames===486&&result.thirdFrames===10&&result.verticalDocking.join(',')==='22,21,20,2'&&result.docking.join(',')==='20,21,22'&&result.lives===5&&result.level===3&&result.score===820,'Original docking/vertical replay differs');progressionRuns++;verticalFrames+=result.verticalFrames;thirdFrames+=result.thirdFrames;}
        totalFrames+=result.frames;results.push(result);
        for(const{actual,expected}of captures)for(const r of expected.regions){
          const bytes=new Uint8Array(r.width*r.height*4);for(let y=0;y<r.height;y++)bytes.set(actual.subarray(((r.y+y)*640+r.x)*4,((r.y+y)*640+r.x+r.width)*4),y*r.width*4);
          check(await hash(bytes)===r.sha256,`${standard} ${mode}: independent ${expected.name} pixels differ`);regions++;
        }
      }finally{if(host)host.detach();gpuHost.detach();const gl=gpu.resources.context;gpu.dispose();const ext=gl.getExtension('WEBGL_lose_context');if(ext&&!gl.isContextLost())ext.loseContext();}
    }
    const raw=Uint8Array.from(atob(pcm),c=>c.charCodeAt(0)),view=new DataView(raw.buffer),values=Float32Array.from({length:raw.length/4},(_,i)=>view.getFloat32(i*4,true));
    check(await hash(raw)===oracle.audio.pcmSha256,'Independent PCM changed');let audioComparisons=0;
    for(const standard of ['PAL','NTSC']){
      const shot=shots[standard];check(shot.mask===1&&shot.period===oracle.audio.periods[standard]&&shot.volume===56&&shot.filterEnabled&&shot.loopMask===0&&shot.sample.length===4554,'Original sample parameters differ');
      check(await hash(Uint8Array.from(shot.sample.data))===oracle.audio.sha256,'Original sample bytes differ');
      const actual=new OfflineAudioContext(2,52920,44100),reference=new OfflineAudioContext(2,52920,44100),audio=make(audioSource)(actual);audio.command(shot);
      const filter=reference.createBiquadFilter();filter.type='lowpass';filter.frequency.value=3300;filter.Q.value=Math.SQRT1_2;filter.connect(reference.destination);
      const merger=reference.createChannelMerger(2);merger.connect(filter);const buffer=reference.createBuffer(1,values.length,44100);buffer.getChannelData(0).set(values);
      const node=reference.createBufferSource(),gain=reference.createGain();node.buffer=buffer;node.playbackRate.value=(standard==='PAL'?3546895:3579545)/oracle.audio.periods[standard]/44100;gain.gain.value=56/64;node.connect(gain);gain.connect(merger,0,0);node.start();
      const[a,b]=await Promise.all([actual.startRendering(),reference.startRendering()]);let error=0,energy=0;
      for(let c=0;c<2;c++)for(let i=0;i<52920;i++){error=Math.max(error,Math.abs(a.getChannelData(c)[i]-b.getChannelData(c)[i]));energy+=a.getChannelData(c)[i]**2;}
      check(error<1e-6&&energy>0&&a.getChannelData(1).every(v=>v===0),'Native shot Web Audio graph differs from independent PCM/stereo/filter');audio.dispose();audioComparisons++;
    }
    check(booms===80&&samples===8,'Original audio event counts differ');
    return{runs:results.length,frames:totalFrames,deaths:[4,3,2,1,0],restarts:4,freshLives:5,stopResume:true,independentRegions:regions,gpuFrames,audioComparisons,progressionRuns,verticalFrames,thirdFrames};
  },require('./planetZybexGameFixture')());
};
