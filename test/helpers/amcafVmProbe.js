'use strict';
module.exports=async function amcafVmProbe(page){
  const effect=require('./amcafRawPreviewBytes')(),bytes=require('./amcafPreviewBytes')(),program=require('./amcafPreviewProgram')(),extensions={8:'amcaf-1.50beta4'};
  const source=new(require('../../lib/Transpiler'))(program,{extensions}).toModule();
  const app=require('../../tools/build_game_page').buildGamePage(program,{extensions,title:'Compiled AMCAF music',assets:{'music.mod':bytes.toString('base64'),'sound.raw':effect.toString('base64')}});
  return page.evaluate(async({source,bytes,effect,app,timerSource,hostSource,sampleHostSource})=>{
    const compiled={exports:{}};new Function('module',source)(compiled);
    const timers=new Function(`return (${timerSource})`)()();
    const createHost=new Function(`return (${hostSource})`)(),createSampleHost=new Function(`return (${sampleHostSource})`)();
    const context=new OfflineAudioContext(2,12000,48000),host=createHost(context,createSampleHost,{latency:0});
    const raw=Uint8Array.from(atob(bytes),c=>c.charCodeAt(0));
    const files={read:name=>{if(name==='music.mod')return atob(bytes);if(name==='sound.raw')return atob(effect);throw Error('Unexpected asset');}};
    const p=compiled.exports({files,
      now:timers.now,setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout,audio:host});
    p.tick(1000);timers.tick(200.1);
    const ticks=p.state.tracker.position.position.sequence.ticks;
    if(ticks!==10||p.state.waiting!=='key')throw Error('Compiled Pt Play field clock did not reach tick ten');
    const rendered=await context.startRendering();
    const interval=(Math.floor(1773447/125)+1)/709379;
    const onset=Math.floor(6*interval*48000+1e-7),step=3546895/428/48000;
    let difference=0;
    for(let i=0;i<onset;i++)if(rendered.getChannelData(0)[i]!==0)throw Error('Compiled VM played a note too early');
    for(let i=0;i<128;i++){
      const signed=(raw[2108+Math.floor(i*step)%64]<<24)>>24;
      difference=Math.max(difference,Math.abs(rendered.getChannelData(0)[onset+i]-signed/512));
    }
    if(difference>1e-6)throw Error('Compiled VM opening PCM differs: '+difference);
    p.stop();p.extensionPtStop();host.dispose();
    if(timers.pending()!==0)throw Error('VM cleanup leaked wakes');
    // A second offline graph checks masked cancellation independently of the
    // opening-wave comparison, whose queued nodes must remain untouched.
    const stopContext=new OfflineAudioContext(2,12000,48000),stopHost=createHost(stopContext,createSampleHost,{latency:0});
    const stopTimers=new Function(`return (${timerSource})`)()();
    const stopped=compiled.exports({files,now:stopTimers.now,
      setTimeout:stopTimers.setTimeout,clearTimeout:stopTimers.clearTimeout,audio:stopHost});
    stopped.tick(1000);stopTimers.tick(140);stopped.sendKey('q');stopped.tick(1000);stopTimers.tick(40);
    if(!stopped.state.tracker.playing||stopped.state.tracker.position.position.sampler.voices[0].active)throw Error('Pt Sam Stop did not retain song ownership and stop voice 1');
    const silence=await stopContext.startRendering();
    if(silence.getChannelData(0).some(x=>x!==0)||!silence.getChannelData(1).some(x=>x!==0))throw Error('Pt Sam Stop did not cancel only its selected Web Audio channel');
    stopped.stop();stopped.extensionPtStop();stopHost.dispose();
    if(stopTimers.pending()!==0)throw Error('Pt Sam Stop probe leaked wakes');
    const rawContext=new OfflineAudioContext(2,12000,48000),rawHost=createHost(rawContext,createSampleHost,{latency:0});
    const rawTimers=new Function(`return (${timerSource})`)()();
    const rawProgram=compiled.exports({files,now:rawTimers.now,setTimeout:rawTimers.setTimeout,clearTimeout:rawTimers.clearTimeout,audio:rawHost});
    rawProgram.tick(1000);rawProgram.sendKey('q');rawProgram.tick(1000);rawProgram.sendKey('q');rawProgram.tick(1000);rawTimers.tick(180);
    if(rawProgram.state.tracker.position.position.sampler.rawMask!==8)throw Error('Compiled raw effect did not own voice 4');
    const rawOutput=await rawContext.startRendering(),rawStep=3546895/447/48000;
    for(let i=0;i<4000;i++){
      const value=((Math.floor(i*rawStep)%64)*4-128)/256;
      if(Math.abs(rawOutput.getChannelData(0)[i]-value)>1e-6)throw Error('Raw effect PCM mismatch at '+i);
    }
    rawProgram.stop();rawProgram.extensionPtStop();rawHost.dispose();
    if(rawTimers.pending()!==0)throw Error('Raw effect probe leaked wakes');
    if(globalThis.AMOS_AMCAF_VM_CLEANUP)await globalThis.AMOS_AMCAF_VM_CLEANUP();
    document.getElementById('amcaf-vm-player')?.remove();
    const frame=document.createElement('iframe');frame.id='amcaf-vm-player';frame.title='Compiled AMCAF music application';
    frame.style.cssText='width:100%;height:700px;border:0';frame.allow='autoplay; fullscreen';frame.allowFullscreen=true;
    const loaded=new Promise(resolve=>frame.onload=resolve);frame.srcdoc=app;document.body.append(frame);await loaded;
    globalThis.AMOS_AMCAF_VM_CLEANUP=async()=>{if(frame.contentWindow?.AMOS_GAME_PAGE)await frame.contentWindow.AMOS_GAME_PAGE.dispose();frame.remove();};
    return{vmTicks:ticks,openingSamples:128,maxDifference:difference,compiled:true,builderStreamingHost:true,maskedSampleStop:true,rawSamples:4000};
  },{source,bytes:bytes.toString('base64'),effect:effect.toString('base64'),app,timerSource:require('./fakeTimers').createFakeTimers.toString(),
    hostSource:require('../../lib/amos/webAudioStream').toString(),sampleHostSource:require('../../lib/amos/webAudio').createWebAudioHost.toString()});
};
