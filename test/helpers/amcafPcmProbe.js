'use strict';
module.exports = async function amcafPcmProbe(page) {
  return page.evaluate(async ({ pitchSource, sequenceSource, pcmSource, moduleSource, streamSource, hostSource, sampleHostSource }) => {
    const make = source => new Function(`return (${source})`)();
    const createPitch = make(pitchSource), createSequence = make(sequenceSource), createPcm = make(pcmSource), preview = make(moduleSource);
    const createStream = make(streamSource), createHost = make(hostSource), createSampleHost = make(sampleHostSource);
    const check = (value, message) => { if (!value) throw new Error(message); };
    const bank = [
      { number: 1, length: 8, pcm: Int8Array.from([8,16,24,32,40,48,56,64]) },
      { number: 2, length: 6, pcm: Int8Array.from([80,88,96,104,112,120]) }
    ];
    const frame = (tick, period = 428, triggers = [], repeats = []) => ({ tick, triggers, repeats,
      state: { voices: Array.from({ length: 4 }, () => ({ outputPeriod: period, outputVolume: 64 })) } });
    let maxDifference = 0;
    for (const standard of ['PAL','NTSC']) for (let voice = 0; voice < 4; voice++) {
      const sampler = createPcm(bank, { sampleRate: 8000, standard }), side = voice === 0 || voice === 3 ? 0 : 1;
      sampler.apply(frame(1, 428, [{ voice, sample: 1, length: 8 }], [{ voice, sample: 1, start: 2, length: 4 }]));
      const a = sampler.render(128);
      sampler.apply(frame(2, 856, [], [{ voice, sample: 2, start: 1, length: 3 }]));
      const b = sampler.render(384), actual = [new Float32Array(512), new Float32Array(512)];
      actual[0].set(a.left); actual[0].set(b.left,128); actual[1].set(a.right); actual[1].set(b.right,128);
      // Independent absolute-phase formula: finish A's currently latched loop
      // before switching to B. Pitch changes alter future slope, not past phase.
      const step = (standard === 'PAL' ? 3546895 : 3579545) / 428 / 8000;
      const phaseAtChange = 128 * step, boundary = 8 + Math.ceil((phaseAtChange - 8) / 4) * 4;
      const literal = new Float32Array(512);
      for (let i = 0; i < 512; i++) {
        const phase = i < 128 ? i * step : phaseAtChange + (i - 128) * step / 2;
        literal[i] = (phase < 8 ? bank[0].pcm[Math.floor(phase)] : phase < boundary ? bank[0].pcm[2 + Math.floor((phase - 8) % 4)]
          : bank[1].pcm[1 + Math.floor((phase - boundary) % 3)]) / 256;
      }
      for (let i = 0; i < 512; i++) {
        check(actual[1 - side][i] === 0, 'Opposite stereo channel leaked');
        maxDifference = Math.max(maxDifference, Math.abs(actual[side][i] - literal[i]));
      }
      // Deliver rendered PCM through a real native stereo graph. Expected PCM
      // is independently calculated above, not copied from the sampler.
      const context = new OfflineAudioContext(2,512,8000), host = createHost(context,createSampleHost,{latency:0});
      for (let at = 0; at < 512; at += 128) {
        const channels = Array.from({length:4},()=>new Float32Array(128));
        channels[voice].set(actual[side].subarray(at,at+128));
        host.command({type:'pcm',stream:1,frame:at,mask:1<<voice,sampleRate:8000,channels});
      }
      const rendered = await context.startRendering();
      for (let channel = 0; channel < 2; channel++) for (let i = 0; i < 512; i++) {
        maxDifference = Math.max(maxDifference, Math.abs(rendered.getChannelData(channel)[i] - (channel === side ? literal[i] : 0)));
      }
      host.dispose();
      sampler.stop();
    }
    // Real streaming takeover at a native render-quantum boundary: voice 3
    // changes to an ordinary sample while voices 0/1/2 continue their PCM.
    const block = (frame,count=512) => ({type:'pcm',stream:1,frame,mask:15,sampleRate:8000,
      channels:Array.from({length:4},(_,v)=>new Float32Array(count).fill((v+1)/8))});
    const takeover = new OfflineAudioContext(2,512,8000), takeoverHost = createHost(takeover,createSampleHost,{latency:0});
    takeoverHost.command(block(0));
    const changed = takeover.suspend(128/8000).then(()=>{
      takeoverHost.command({type:'play',mask:8,sample:{length:128,data:new Uint8Array(128).fill(64)},rate:8000,volume:64,loopMask:0,filterEnabled:false});
      return takeover.resume();
    });
    const replaced = await takeover.startRendering(); await changed;
    for(let i=0;i<512;i++) {
      maxDifference=Math.max(maxDifference,Math.abs(replaced.getChannelData(0)[i]-(i<128?0.625:i<256?0.375:0.125)),
        Math.abs(replaced.getChannelData(1)[i]-0.625));
    }
    takeoverHost.dispose();
    const underrun = new OfflineAudioContext(2,512,8000), lateHost = createHost(underrun,createSampleHost,{latency:0});
    lateHost.command(block(0,128));
    const late = underrun.suspend(256/8000).then(()=>{
      lateHost.command(block(128,128)); // Entirely expired: do not replay.
      lateHost.command(block(256,128)); return underrun.resume();
    });
    const recovered = await underrun.startRendering(); await late;
    for(let c=0;c<2;c++)for(let i=0;i<512;i++) maxDifference=Math.max(maxDifference,
      Math.abs(recovered.getChannelData(c)[i]-((i<128||i>=256&&i<384)?0.625:0)));
    lateHost.dispose();
    const filtered=new OfflineAudioContext(2,512,8000),filterHost=createHost(filtered,createSampleHost,{latency:0});
    filterHost.command({type:'filter',enabled:true});filterHost.command(block(0));
    const reference=new OfflineAudioContext(2,512,8000),referenceSource=reference.createBufferSource();
    const referenceBuffer=reference.createBuffer(2,512,8000),referenceFilter=reference.createBiquadFilter();
    referenceBuffer.getChannelData(0).fill(0.625);referenceBuffer.getChannelData(1).fill(0.625);
    referenceSource.buffer=referenceBuffer;referenceFilter.type='lowpass';referenceFilter.frequency.value=3300;referenceFilter.Q.value=Math.SQRT1_2;
    referenceSource.connect(referenceFilter);referenceFilter.connect(reference.destination);referenceSource.start();
    const outputs=await Promise.all([filtered.startRendering(),reference.startRendering()]);
    for(let c=0;c<2;c++)for(let i=0;i<512;i++)maxDifference=Math.max(maxDifference,Math.abs(outputs[0].getChannelData(c)[i]-outputs[1].getChannelData(c)[i]));
    filterHost.dispose();
    check(maxDifference < 1e-6, `Repeat/pitch/stream PCM comparison failed: ${maxDifference}`);
    const factories={sequence:createSequence,pitch:createPitch,pcm:createPcm};
    const data=preview(),sequence=createSequence(data,createPitch),sampler=createPcm(data.samples,{sampleRate:8000});
    let repeatOnly=0,notes=0,energy=0;
    for(let tick=1;tick<=384;tick++) {
      const f=sequence.tick();sampler.apply(f);notes+=f.triggers.length;
      if(tick===54)repeatOnly=f.repeats.filter(r=>r.voice===0&&r.sample===2&&!f.triggers.some(t=>t.voice===0)).length;
      const pcm=sampler.render(160);energy+=pcm.left.reduce((n,v)=>n+v*v,0)+pcm.right.reduce((n,v)=>n+v*v,0);
    }
    check(notes>2&&repeatOnly===1&&energy>0,'Synthetic music did not reach its notes/repeat change');
    sampler.stop();sequence.stop();
    if (globalThis.AMOS_AMCAF_PCM_CLEANUP) await globalThis.AMOS_AMCAF_PCM_CLEANUP();
    document.getElementById('amcaf-pcm-controls')?.remove();
    const controls = document.createElement('section'); controls.id = 'amcaf-pcm-controls';
    const status = document.createElement('p'); status.id = 'amcaf-pcm-status'; status.dataset.state = 'off'; status.dataset.contexts = '0';
    status.textContent = 'Play a synthetic AMCAF music preview (50-Hz clock; no game assets).';
    const play = document.createElement('button'); play.id = 'amcaf-pcm-play'; play.textContent = 'Play music preview';
    const stop = document.createElement('button'); stop.id = 'amcaf-pcm-stop'; stop.textContent = 'Stop';
    const pause=document.createElement('button');pause.id='amcaf-pcm-pause';pause.textContent='Pause';pause.disabled=true;
    controls.append(play,pause,stop,status); document.body.append(controls);
    let live = null, generation = 0, disposed = false, contexts = 0;
    const pending = new Set();
    function stopLive() {
      generation++; const old = live; live = null;
      if (old) {
        if(old.timer!=null)clearTimeout(old.timer);
        try{if(old.bridge)old.bridge.stop();}finally{if(old.host)old.host.dispose();}
        const closed = old.context.close().catch(() => {}).finally(() => {
          contexts--; status.dataset.contexts = String(contexts); pending.delete(closed);
        });
        pending.add(closed);
      }
      status.dataset.state = 'off'; status.textContent = 'Stopped';pause.disabled=true;pause.textContent='Pause';
    }
    play.addEventListener('click', async () => {
      if (disposed) return;
      stopLive(); const token = generation;
      try {
        const context = new AudioContext(); live = { context, host:null, bridge:null, timer:null };
        contexts++; status.dataset.contexts = String(contexts);
        const instance = live, resumed = context.resume();
        await resumed;
        if (disposed || token !== generation || instance !== live) return;
        instance.host=createHost(context,createSampleHost);
        instance.bridge=createStream(preview(),factories,{sampleRate:8000,host:instance.host});
        instance.bridge.render(160);instance.next=performance.now()+20;
        instance.pump=()=>{
          if(disposed||token!==generation||live!==instance||instance.bridge.state.paused)return;
          try{
            const now=performance.now();
            if(now-instance.next>200)throw new Error('Preview timer fell behind; press Play to restart');
            while(instance.next<=now){instance.bridge.tick();instance.bridge.render(160);instance.next+=20;}
            status.dataset.ticks=String(instance.bridge.state.sequence.ticks);
            instance.timer=setTimeout(instance.pump,Math.max(1,instance.next-performance.now()));
          }catch(error){stopLive();status.dataset.state='error';status.textContent=error.message;}
        };
        pause.disabled=false;status.dataset.state='playing';status.textContent='Streaming synthetic AMCAF music';instance.pump();
      } catch (error) {
        if (disposed || token !== generation) return;
        stopLive(); status.dataset.state = 'error'; status.textContent = `Audio failed: ${error.message}`;
      }
    });
    pause.addEventListener('click',()=>{
      if(!live||!live.bridge||disposed)return;
      try{
        if(live.bridge.state.paused){
          live.bridge.resume();live.bridge.render(160);live.next=performance.now()+20;live.pump();
          pause.textContent='Pause';status.dataset.state='playing';status.textContent='Streaming synthetic AMCAF music';
        }else{
          if(live.timer!=null)clearTimeout(live.timer);live.timer=null;live.bridge.pause();
          pause.textContent='Resume';status.dataset.state='paused';status.textContent='Paused';
        }
      }catch(error){stopLive();status.dataset.state='error';status.textContent=error.message;}
    });
    stop.addEventListener('click', () => { if (!disposed) stopLive(); });
    const onHide = () => { void cleanup(); };
    async function cleanup() {
      disposed = true; stopLive(); window.removeEventListener('pagehide',onHide);
      await Promise.all([...pending]);
    }
    window.addEventListener('pagehide',onHide);
    globalThis.AMOS_AMCAF_PCM_CLEANUP = cleanup;
    return { comparisons: 8, streamingComparisons:3, maxDifference, previewTicks: 384, instrumentOnlyChange: repeatOnly, notes,
      evidence: 'Synthetic source-derived PCM and native Web Audio delivery; no Amiga capture or VM/CIA timing.' };
  }, { pitchSource: require('../../lib/amos/amcafPitch').toString(), sequenceSource: require('../../lib/amos/amcafSequencer').toString(),
    pcmSource: require('../../lib/amos/amcafPcm').toString(), moduleSource: require('./amcafPreviewModule').toString(), streamSource:require('../../lib/amos/amcafStream').toString(),
    hostSource:require('../../lib/amos/webAudioStream').toString(),sampleHostSource:require('../../lib/amos/webAudio').createWebAudioHost.toString() });
};
