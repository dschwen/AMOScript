/* jshint esversion: 6 */
'use strict';
module.exports = async function trackerProbe(page) {
  return page.evaluate(async ({ moduleBytes, readerSource, trackerSource, hostSource, expectedNotes, programSource, sampleBank, timerSource }) => {
    const read = new Function(`return (${readerSource});`)(), createTracker = new Function(`return (${trackerSource});`)();
    const createHost = new Function(`return (${hostSource});`)();
    const raw = Uint8Array.from(atob(moduleBytes), c => c.charCodeAt(0)), module = read(raw);
    const check = (value, message) => { if (!value) throw new Error(message); };
    // Independent native control graph: partial sample loop, live volume/rate
    // changes at a render quantum, and Paula stereo routing. No Amiga capture.
    const actual = new OfflineAudioContext(2, 4096, 8000), expected = new OfflineAudioContext(2, 4096, 8000);
    const host = createHost(actual), values = [0,32,64,96,127,96,64,32];
    host.command({ type:'play', mask:1, sample:{length:8,data:values}, rate:8000, volume:32,
      loopMask:1, loopStart:2, loopEnd:4, filterEnabled:false });
    const buffer = expected.createBuffer(1,8,8000); buffer.getChannelData(0).set(values.map(v=>v/128));
    const source = expected.createBufferSource(), gain = expected.createGain(), merger = expected.createChannelMerger(2);
    // Two independent native sources specify an entire initial fetch followed
    // by the repeat. Unlike the adapter, this graph never appends loop PCM.
    const initial=expected.createBufferSource(), repeat=expected.createBuffer(1,2,8000);
    repeat.getChannelData(0).set(values.slice(2,4).map(v=>v/128));
    initial.buffer=buffer;initial.connect(gain);initial.start();
    source.buffer=repeat;source.loop=true;gain.gain.value=32/64;
    source.connect(gain); gain.connect(merger,0,0); merger.connect(expected.destination); source.start(8/8000);
    const changeActual = actual.suspend(0.128).then(()=>{
      host.command({type:'voice',mask:1,volume:16,rate:4000}); return actual.resume();
    });
    const changeExpected = expected.suspend(0.128).then(()=>{
      gain.gain.setValueAtTime(16/64,expected.currentTime); source.playbackRate.setValueAtTime(4000/8000,expected.currentTime); return expected.resume();
    });
    const rendered = await Promise.all([actual.startRendering(),expected.startRendering()]);
    await Promise.all([changeActual,changeExpected]);
    let difference=0, energy=0;
    for(let channel=0;channel<2;channel++)for(let i=0;i<4096;i++){
      const a=rendered[0].getChannelData(channel)[i], b=rendered[1].getChannelData(channel)[i];
      difference=Math.max(difference,Math.abs(a-b)); energy+=a*a;
      if(channel===1)check(a===0,'Tracker voice leaked into opposite stereo channel');
    }
    check(difference<1e-6&&energy>0,'Loop/volume/rate native audio comparison failed'); host.dispose();
    const notes=[],firstPlays=new Map(); const trace=createTracker(module,{host:{command:e=>{
      if(e.type==='play'){notes.push([e.field,Math.log2(e.mask),e.sample.number,e.period,e.volume]);if(!firstPlays.has(e.sample.number))firstPlays.set(e.sample.number,e);}
    }}});
    while(trace.state.playing&&trace.state.field<12000)trace.tick();
    check(trace.state.field===9631&&!trace.state.playing&&notes.length===1997,'Original tune traversal differs');
    check(JSON.stringify(notes)===JSON.stringify(expectedNotes),'An original note trigger/period/instrument/volume differs');
    const compiled={exports:{}};new Function('module',programSource)(compiled);
    const createTimers=new Function(`return (${timerSource});`)();
    const files={read:name=>{
      const key=name.replace(/^rii:/i,'').toLowerCase();
      if(key==='music/mod.roller_ii_mus')return atob(moduleBytes);
      if(key==='music/roller_ii_samples.abk')return atob(sampleBank);
      throw new Error(`Asset not preloaded: ${name}`);
    }};
    const timers=createTimers(),vmNotes=[],vm=compiled.exports({files,now:timers.now,setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout,
      audio:{command:e=>{if(e.type==='play')vmNotes.push([e.field,Math.log2(e.mask),e.sample.number,e.period,e.volume]);}}});
    vm.tick(1000);const instructions=vm.state.ticks;
    timers.tick(192620);
    check(JSON.stringify(vmNotes)===JSON.stringify(expectedNotes)&&vm.state.ticks===instructions&&!vm.state.tracker.playing,'Compiled VM field-clock note trace differs');
    check(timers.pending()===0&&vm.state.waiting==='key','Completed song leaked VM timers');vm.stop();
    // Independent literal header/sample offsets supply the native graph. For
    // one-word silent repeats, its buffer simply ends rather than looping.
    let sampleOffset=13372;const instrumentChecks=[];
    for(let number=1;number<=10;number++){
      const word=at=>raw[at]*256+raw[at+1],header=20+(number-1)*30;
      const length=word(header+22)*2,loopStart=word(header+26)*2,loopLength=word(header+28)*2;
      const channel=(number-1)%4,side=channel===0||channel===3?0:1,mask=1<<channel;
      const actual=new OfflineAudioContext(2,24000,8000),expected=new OfflineAudioContext(2,24000,8000),host=createHost(actual);
      const event=firstPlays.get(number);check(!!event,`No original note for instrument ${number}`);
      host.command({...event,mask,loopMask:mask,rate:3546895/428,volume:32,filterEnabled:false});
      // Explicit zero tail avoids one-shot interpolation beyond the last
      // nonzero PCM frame; this represents the native silent repeat.
      const buffer=expected.createBuffer(1,length+(loopLength<=2?32:0),8000),pcm=buffer.getChannelData(0);
      for(let i=4;i<length;i++)pcm[i]=((raw[sampleOffset+i]<<24)>>24)/128;
      const source=expected.createBufferSource(),gain=expected.createGain(),merger=expected.createChannelMerger(2);
      source.buffer=buffer;source.playbackRate.value=(3546895/428)/8000;source.loop=loopLength>2;
      source.loopStart=loopStart/8000;source.loopEnd=(loopStart+loopLength)/8000;gain.gain.value=0.5;
      source.connect(gain);gain.connect(merger,0,side);merger.connect(expected.destination);source.start();
      const rendered=await Promise.all([actual.startRendering(),expected.startRendering()]);
      let difference=0,energy=0,tailEnergy=0,firstDifference=-1;
      for(let c=0;c<2;c++)for(let i=0;i<24000;i++){
        const a=rendered[0].getChannelData(c)[i],b=rendered[1].getChannelData(c)[i];
        difference=Math.max(difference,Math.abs(a-b));if(firstDifference<0&&Math.abs(a-b)>1e-6)firstDifference=i;energy+=a*a;if(i>=20000)tailEnergy+=a*a;
        if(c!==side)check(a===0,`Instrument ${number} stereo route differs`);
      }
      check(energy>0&&difference<1e-6,`Instrument ${number} initial PCM/repeat differs (${difference}, energy ${energy}, frame ${firstDifference})`);
      if(loopLength===2)check(tailEnergy===0,`Instrument ${number} silent repeat leaked audio`);
      instrumentChecks.push({number,nonzero:true,maxDifference:difference});host.dispose();sampleOffset+=length;
    }
    // The generated factory also reaches Web Audio through the shared runtime
    // controller. Its opening C-16 instrument-4 note is channel 1, period 453.
    const vmActual=new OfflineAudioContext(2,16000,8000),vmExpected=new OfflineAudioContext(2,16000,8000),vmHost=createHost(vmActual),vmTimers=createTimers();
    const sounding=compiled.exports({files,audio:vmHost,now:vmTimers.now,setTimeout:vmTimers.setTimeout,clearTimeout:vmTimers.clearTimeout});
    sounding.tick(1000);vmTimers.tick(120);
    const vmBuffer=vmExpected.createBuffer(1,15054,8000),vmPCM=vmBuffer.getChannelData(0);
    for(let i=4;i<15054;i++)vmPCM[i]=((raw[21760+i]<<24)>>24)/128;
    const vmSource=vmExpected.createBufferSource(),vmGain=vmExpected.createGain(),vmMerger=vmExpected.createChannelMerger(2);
    vmSource.buffer=vmBuffer;vmSource.loop=true;vmSource.playbackRate.value=(3546895/453)/8000;vmGain.gain.value=16/64;
    vmSource.connect(vmGain);vmGain.connect(vmMerger,0,1);vmMerger.connect(vmExpected.destination);vmSource.start();
    const vmRendered=await Promise.all([vmActual.startRendering(),vmExpected.startRendering()]);let vmDifference=0,vmEnergy=0;
    for(let c=0;c<2;c++)for(let i=0;i<16000;i++){
      const a=vmRendered[0].getChannelData(c)[i],b=vmRendered[1].getChannelData(c)[i];
      vmDifference=Math.max(vmDifference,Math.abs(a-b));vmEnergy+=a*a;
    }
    check(vmDifference<1e-6&&vmEnergy>0,'Compiled VM native audio comparison failed');sounding.stop();vmHost.dispose();

    if(globalThis.AMOS_TRACKER_DEMO_CLEANUP)await globalThis.AMOS_TRACKER_DEMO_CLEANUP();
    const old=document.getElementById('tracker-controls');if(old)old.remove();
    const controls=document.createElement('section');controls.id='tracker-controls';
    const help=document.createElement('p');help.textContent='Roller II original music statements now run in a compiled VM: asset loads, Led Off and Track Play 22, followed by a synthetic Wait Key. The full game does not compile yet. All 1,997 notes and ten instrument waveforms are checked. Play starts sound after a click; Pause freezes the sequencer, and Resume continues it (held samples return on later notes). No Amiga capture is claimed.';
    const play=document.createElement('button');play.id='tracker-play';play.textContent='Play Roller II music';
    const stop=document.createElement('button');stop.id='tracker-stop';stop.textContent='Stop music';
    const pause=document.createElement('button');pause.id='tracker-pause';pause.textContent='Pause';pause.disabled=true;
    const status=document.createElement('p');status.id='tracker-status';status.textContent='Ready (sound off)';status.dataset.state='off';
    controls.append(help,play,pause,stop,status);document.body.append(controls);
    let live=null,timer=null,generation=0,disposed=false;
    async function close(){
      generation++;if(timer!=null)clearTimeout(timer);timer=null;
      const previous=live;live=null;pause.disabled=true;pause.textContent='Pause';
      if(previous){try{previous.program.stop();previous.program.trackStop();previous.host.dispose();}finally{await previous.context.close();}}
    }
    play.addEventListener('click',async()=>{
      if(disposed)return;
      try{
        // Construct/resume before awaiting cleanup to retain user activation.
        const context=new AudioContext(), resume=context.resume();
        const cleanup=close(),token=generation;await cleanup;await resume;
        if(disposed||generation!==token){await context.close();return;}
        const host=createHost(context),program=compiled.exports({files,audio:host,now:()=>performance.now(),clearTimeout,
          setTimeout(fn,delay){return setTimeout(()=>{
            if(disposed||generation!==token)return;
            try{fn();}catch(error){status.textContent=error.message;status.dataset.state='error';void close();}
          },delay);}});
        live={context,host,program};program.tick(1000);pause.disabled=false;
        function wake(){
          if(disposed||generation!==token||!live)return;
          try{
            const player=program.state.tracker.position;
            status.textContent=`${program.state.stopped?'Paused':'Playing'}: order ${player.order}, row ${player.row}, field ${player.field}`;
            status.dataset.state=program.state.stopped?'paused':'playing';status.dataset.field=String(player.field);
            if(program.state.tracker.playing)timer=setTimeout(wake,50);
            else{status.textContent='Song finished';status.dataset.state='off';void close();}
          }catch(error){status.textContent=error.message;status.dataset.state='error';void close();}
        }
        wake();
      }catch(error){status.textContent=error.message;status.dataset.state='error';await close();}
    });
    pause.addEventListener('click',()=>{
      if(!live)return;
      if(live.program.state.stopped){live.program.resume();pause.textContent='Pause';}
      else{live.program.stop();pause.textContent='Resume';}
    });
    stop.addEventListener('click',()=>{void close();status.textContent='Stopped';status.dataset.state='off';});
    globalThis.AMOS_TRACKER_DEMO_CLEANUP=async()=>{disposed=true;await close();};
    return {fields:9631,orders:22,rows:1376,notes:notes.length,nativeComparisons:12,instruments:instrumentChecks.length,nonzero:true,vmPlayback:true};
  }, {moduleBytes:require('fs').readFileSync(require('path').join(__dirname,'../../examples/Roller2/music/mod.Roller_II_mus')).toString('base64'),
    readerSource:require('../../lib/amos/mod').toString(),trackerSource:require('../../lib/amos/tracker').toString(),hostSource:require('../../lib/amos/webAudio').createWebAudioHost.toString(),
    expectedNotes:require('./roller2NoteAudit')(require('fs').readFileSync(require('path').join(__dirname,'../../examples/Roller2/music/mod.Roller_II_mus'))).notes,
    programSource:new(require('../../lib/Transpiler'))(require('./roller2Music')()).toModule(),
    sampleBank:require('fs').readFileSync(require('path').join(__dirname,'../../examples/Roller2/music/Roller_II_Samples.Abk')).toString('base64'),
    timerSource:require('./fakeTimers').createFakeTimers.toString()});
};
