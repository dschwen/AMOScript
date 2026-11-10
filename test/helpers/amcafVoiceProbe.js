'use strict';
module.exports=async function(page){
 const fs=require('fs'),packed=fs.readFileSync(require('path').join(__dirname,'../../examples/AMCAF/AMCAF_Examples/Data/mod.hawkeye'));
 const sources=Object.fromEntries(['Pitch','Sequencer','Pcm','Stream','Playback','Imploder'].map(n=>[n,require('../../lib/amos/amcaf'+n).toString()]));
 return page.evaluate(async({sources,moduleSource,modSource,packed,hostSource,sampleHostSource})=>{
  const make=s=>new Function('return ('+s+');')(),check=(ok,message)=>{if(!ok)throw Error(message);};
  const f={pitch:make(sources.Pitch),sequence:make(sources.Sequencer),pcm:make(sources.Pcm),stream:make(sources.Stream)},create=make(sources.Playback);
  const m=make(moduleSource)();m.patterns[0].forEach(c=>{c.sample=c.period=c.effect=c.parameter=0;});m.samples[0].pcm.fill(64);m.samples[0].volume=32;
  for(let v=0;v<4;v++)Object.assign(m.patterns[0][v],{sample:1,period:428});Object.assign(m.patterns[0][8],{sample:1,period:428});
  const events=[],p=create(m,f,{sampleRate:8000,cia:false,host:{command:e=>events.push(e)}}),chunks=[];
  try{p.advance(7);chunks.push([events.at(-1),.25]);p.setVoiceMask(14,7.25);check(events.at(-2).channels[0].length===40,'Partial-field flush');
   p.advance(8);chunks.push([events.at(-1),.125]);const tick=p.state.position.sequence.ticks;
   p.setVoiceMask(15,8.25);p.advance(9);check(p.state.position.sequence.ticks===tick+1,'Music clock continued');chunks.push([events.at(-1),.125]);
   p.advance(19);chunks.push([events.at(-1),.25]);
  }finally{p.stop();}
  let maxDifference=0;
  for(const[e,left]of chunks){
   check(e.type==='pcm'&&e.channels[0].length>=120,'PCM phase block');
   const context=new OfflineAudioContext(2,120,8000),host=make(hostSource)(context,make(sampleHostSource),{latency:0});
   try{host.command({type:'filter',enabled:false});host.command({...e,frame:0,channels:e.channels.map(c=>c.slice(0,120))});const result=await context.startRendering();
    for(let i=0;i<120;i++)for(let side=0;side<2;side++)maxDifference=Math.max(maxDifference,Math.abs(result.getChannelData(side)[i]-(side?.25:left)));
   }finally{host.dispose();}
  }
  check(maxDifference<1e-6,'Independent native stereo mix');
  const bytes=make(sources.Imploder)(Uint8Array.from(atob(packed),c=>c.charCodeAt(0)),{verifyChecksum:true}),module=make(modSource)(bytes),seq=f.sequence(module,f.pitch);
  let triggers=0,filters=0;while(!seq.state.ends&&seq.state.ticks<30000){const frame=seq.tick();triggers+=frame.triggers.length;filters+=(frame.filters||[]).length;}
  check(seq.state.ends===1,'Supplied Hawkeye first wrap');
  return{graphs:chunks.length,maxDifference,hawkeyeBytes:bytes.length,hawkeyeTicks:seq.state.ticks,triggers,filters};
 },{sources,moduleSource:require('./amcafPreviewModule').toString(),modSource:require('../../lib/amos/mod').toString(),packed:packed.toString('base64'),hostSource:require('../../lib/amos/webAudioStream').toString(),sampleHostSource:require('../../lib/amos/webAudio').createWebAudioHost.toString()});
};
