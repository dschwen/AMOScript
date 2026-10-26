/* jshint esversion: 6 */
'use strict';
module.exports=async function boomProbe(page){
  const fs=require('fs'),path=require('path'),{binary,word:w,token:t}=require('./tokens');
  const source=new(require('../../lib/Transpiler'))(binary([[[w(0x4e),1,0,w(0x1d6)]],[[w(0x4e),1,0,w(0x74)]],[t('Wait Key')]])).toModule();
  const expected=require('../fixtures/audio/boom.json').cases[0],pcm=expected.voices.map(v=>fs.readFileSync(path.join(__dirname,'../fixtures/audio',v.file)).toString('base64'));
  return page.evaluate(async({source,pcm,expected,hostSource,sessionSource})=>{
    const compiled={exports:{}};new Function('module',source)(compiled);
    const createHost=new Function(`return (${hostSource});`)(),createSession=new Function(`return (${sessionSource});`)();
    const check=(v,m)=>{if(!v)throw Error(m);},goldens=pcm.map(bytes=>{const raw=Uint8Array.from(atob(bytes),c=>c.charCodeAt(0)),view=new DataView(raw.buffer);return Float32Array.from({length:raw.length/4},(_,i)=>view.getFloat32(i*4,true));});
    const comparisons=[];
    for(const mask of [8,4,2,1,15]){
      const actual=new OfflineAudioContext(2,44100,44100),reference=new OfflineAudioContext(2,44100,44100),host=createHost(actual),merger=reference.createChannelMerger(2);merger.connect(reference.destination);
      const p=compiled.exports({now:()=>0,setTimeout:()=>1,clearTimeout(){},audio:{command:e=>{if(e.type!=='play'||e.mask&mask)host.command(e);}}});p.tick(1000);
      for(const [index,voice]of expected.voices.entries())if(voice.mask&mask){const buffer=reference.createBuffer(1,goldens[index].length,44100);buffer.getChannelData(0).set(goldens[index]);const node=reference.createBufferSource();node.buffer=buffer;node.connect(merger,0,voice.voice===0||voice.voice===3?0:1);node.start();}
      const [a,b]=await Promise.all([actual.startRendering(),reference.startRendering()]);let difference=0,energy=0;
      for(let channel=0;channel<2;channel++)for(let i=0;i<44100;i++){difference=Math.max(difference,Math.abs(a.getChannelData(channel)[i]-b.getChannelData(channel)[i]));energy+=a.getChannelData(channel)[i]**2;}
      check(difference<1e-6&&energy>0,'Boom native Web Audio graph differs from independent PCM/stereo');comparisons.push({mask,difference,energy});p.stop();host.dispose();
    }
    const stopped=new OfflineAudioContext(2,4096,44100),host=createHost(stopped),p=compiled.exports({now:()=>0,setTimeout:()=>1,clearTimeout(){},audio:host});p.tick(1000);let invalid=false;try{host.command({type:'play',mask:15,rate:44100,volume:64,sample:{length:1,format:'float32',data:[NaN]}});}catch(e){invalid=/Invalid float audio PCM/.test(e.message);}check(invalid&&host.activeVoices().length===4,'Invalid float PCM replaced active Boom');p.stop();check(host.activeVoices().length===0,'Stopped Boom retained voices');host.dispose();const silent=await stopped.startRendering();check([0,1].every(c=>silent.getChannelData(c).every(v=>v===0)),'Stopped Boom leaked audio');
    if(globalThis.AMOS_BOOM_CLEANUP)await globalThis.AMOS_BOOM_CLEANUP();const old=document.getElementById('boom-controls');if(old)old.remove();
    const controls=document.createElement('section'),play=document.createElement('button'),mute=document.createElement('button'),status=document.createElement('p');controls.id='boom-controls';play.id='boom-play';mute.id='boom-mute';play.textContent='Play Boom';mute.textContent='Mute / Stop';controls.append(play,mute,status);document.body.append(controls);
    const session=createSession(createHost,()=>new AudioContext());let live=null,disposed=false;
    function update(){const s=session.status();controls.dataset.sound=s.state;controls.dataset.plays=String(s.plays);controls.dataset.voices=String(s.voices.length);status.textContent=s.error||`Sound ${s.state}; four source pitches, portable deterministic noise and finite VBL envelope PCM. No Amiga capture.`;}
    play.addEventListener('click',async()=>{play.disabled=true;try{if(await session.enable()){if(disposed)return;if(live)live.stop();live=compiled.exports({audio:session.bind(),now:()=>0,setTimeout:()=>1,clearTimeout(){}});live.tick(1000);}}catch(e){status.textContent=e.message;}finally{play.disabled=false;update();}});
    mute.addEventListener('click',()=>{if(live)live.stop();session.mute();update();});update();
    globalThis.AMOS_BOOM_CLEANUP=()=>{disposed=true;if(live)live.stop();return session.dispose();};
    return{voices:4,comparisons:comparisons.length,maximumDifference:Math.max(...comparisons.map(c=>c.difference)),stoppedSilent:true,finite:true,amigaCapture:false};
  },{source,pcm,expected,hostSource:require('../../lib/amos/webAudio').createWebAudioHost.toString(),sessionSource:require('../../lib/amos/browserAudio').createBrowserAudioSession.toString()});
};
