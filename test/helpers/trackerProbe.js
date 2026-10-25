/* jshint esversion: 6 */
'use strict';
module.exports = async function trackerProbe(page) {
  return page.evaluate(async ({ moduleBytes, readerSource, trackerSource, hostSource }) => {
    const read = new Function(`return (${readerSource});`)(), createTracker = new Function(`return (${trackerSource});`)();
    const createHost = new Function(`return (${hostSource});`)();
    const module = read(Uint8Array.from(atob(moduleBytes), c => c.charCodeAt(0)));
    const check = (value, message) => { if (!value) throw new Error(message); };
    // Independent native control graph: partial sample loop, live volume/rate
    // changes at a render quantum, and Paula stereo routing. No Amiga capture.
    const actual = new OfflineAudioContext(2, 4096, 8000), expected = new OfflineAudioContext(2, 4096, 8000);
    const host = createHost(actual), values = [0,32,64,96,127,96,64,32];
    host.command({ type:'play', mask:1, sample:{length:8,data:values}, rate:2000, volume:32,
      loopMask:1, loopStart:2, loopEnd:8, filterEnabled:false });
    const buffer = expected.createBuffer(1,8,8000); buffer.getChannelData(0).set(values.map(v=>v/128));
    const source = expected.createBufferSource(), gain = expected.createGain(), merger = expected.createChannelMerger(2);
    source.buffer=buffer; source.loop=true; source.loopStart=2/8000; source.loopEnd=8/8000;
    source.playbackRate.value=2000/8000; gain.gain.value=32/64;
    source.connect(gain); gain.connect(merger,0,0); merger.connect(expected.destination); source.start();
    const changeActual = actual.suspend(0.128).then(()=>{
      host.command({type:'voice',mask:1,volume:16,rate:1000}); return actual.resume();
    });
    const changeExpected = expected.suspend(0.128).then(()=>{
      gain.gain.setValueAtTime(16/64,expected.currentTime); source.playbackRate.setValueAtTime(1000/8000,expected.currentTime); return expected.resume();
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
    let plays=0; const trace=createTracker(module,{host:{command:e=>{if(e.type==='play')plays++;}}});
    while(trace.state.playing&&trace.state.field<12000)trace.tick();
    check(trace.state.field===9631&&!trace.state.playing&&plays>1000,'Original tune traversal differs');

    if(globalThis.AMOS_TRACKER_DEMO_CLEANUP)await globalThis.AMOS_TRACKER_DEMO_CLEANUP();
    const old=document.getElementById('tracker-controls');if(old)old.remove();
    const controls=document.createElement('section');controls.id='tracker-controls';
    const help=document.createElement('p');help.textContent='Roller II original MOD: bounded AMOS four-channel controller. Play starts sound after your click. This exercises the player directly; Track Play/Stop VM integration and the complete game remain open. Timing/audio output are portable approximations, with no Amiga capture.';
    const play=document.createElement('button');play.id='tracker-play';play.textContent='Play Roller II music';
    const stop=document.createElement('button');stop.id='tracker-stop';stop.textContent='Stop music';
    const status=document.createElement('p');status.id='tracker-status';status.textContent='Ready (sound off)';status.dataset.state='off';
    controls.append(help,play,stop,status);document.body.append(controls);
    let live=null,timer=null,generation=0,disposed=false;
    async function close(){
      generation++;if(timer!=null)clearTimeout(timer);timer=null;
      const previous=live;live=null;
      if(previous){try{previous.player.stop();previous.host.dispose();}finally{await previous.context.close();}}
    }
    play.addEventListener('click',async()=>{
      if(disposed)return;
      try{
        // Construct/resume before awaiting cleanup to retain user activation.
        const context=new AudioContext(), resume=context.resume();
        const cleanup=close(),token=generation;await cleanup;await resume;
        if(disposed||generation!==token){await context.close();return;}
        const host=createHost(context),player=createTracker(module,{host,filterEnabled:false});
        live={context,host,player};const epoch=performance.now();
        function wake(){
          if(disposed||generation!==token||!live)return;
          try{
            const due=Math.floor((performance.now()-epoch)/20);
            if(due-player.state.field>250)throw new Error('Playback clock stalled; press Play to restart');
            while(player.state.field<due&&player.state.playing)player.tick();
            status.textContent=`Playing: order ${player.state.order}, row ${player.state.row}, field ${player.state.field}`;status.dataset.state='playing';
            if(player.state.playing)timer=setTimeout(wake,Math.max(1,epoch+(player.state.field+1)*20-performance.now()));
            else{status.textContent='Song finished';status.dataset.state='off';void close();}
          }catch(error){status.textContent=error.message;status.dataset.state='error';void close();}
        }
        wake();
      }catch(error){status.textContent=error.message;status.dataset.state='error';await close();}
    });
    stop.addEventListener('click',()=>{void close();status.textContent='Stopped';status.dataset.state='off';});
    globalThis.AMOS_TRACKER_DEMO_CLEANUP=async()=>{disposed=true;await close();};
    return {fields:9631,orders:22,rows:1376,nativeComparisons:1,nonzero:true,vmPlayback:false};
  }, {moduleBytes:require('fs').readFileSync(require('path').join(__dirname,'../../examples/Roller2/music/mod.Roller_II_mus')).toString('base64'),
    readerSource:require('../../lib/amos/mod').toString(),trackerSource:require('../../lib/amos/tracker').toString(),hostSource:require('../../lib/amos/webAudio').createWebAudioHost.toString()});
};
