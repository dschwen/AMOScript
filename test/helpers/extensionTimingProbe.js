'use strict';
module.exports=async function extensionTimingProbe(page){
  const{binary,token:t,word:w,integer:n}=require('./tokens');
  const ext=(slot,offset)=>[w(0x4e),[slot,0],w(offset)];
  const source=new(require('../../lib/Transpiler'))(binary([
    [ext(12,0x928),n(20)],[t('Print'),n(1)],[ext(8,0x346),n(156)],
    [ext(12,0x928),n(0)],[t('Print'),n(2)],[t('Wait Key')],[t('End')]
  ]),{extensions:{8:'amcaf-1.50beta4',12:'turbo-plus-2.15'}}).toModule({optimize:true});
  return page.evaluate(({source,timerSource})=>{
    const module={exports:{}};new Function('module',source)(module);
    const timers=new Function(`return (${timerSource})`)();
    function make(standard='PAL'){
      const clock=timers(),logs=[],requests=[];
      const program=module.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,
        displayOptions:{snapshotStandard:standard},vblHz:standard==='PAL'?50:60,sleepScale:4,
        print:value=>logs.push(value),system:{command:(name,r)=>{if(name==='Amos Pri')requests.push(r.priority);}}});
      program.tick(100);return{clock,logs,requests,program};
    }
    const cases=[];
    for(const standard of ['PAL','NTSC']){
      const run=make(standard),deadline=1000*156/(standard==='PAL'?50*312:60*262);
      const before=run.program.state.waiting==='sleep'&&run.program.state.system.amosPriority===20;
      run.clock.tick(deadline-0.001);if(run.logs.length!==1)throw Error('Raster wait ended too soon');
      run.clock.tick(0.002);const after=run.program.state.waiting==='key'&&run.program.state.system.amosPriority===0;
      if(!before||!after||JSON.stringify(run.logs)!=='[1,2]'||JSON.stringify(run.requests)!=='[20,0]')throw Error('Timing/priority state differs');
      run.program.stop();if(run.clock.pending())throw Error('Timing fixture leaked a wake');cases.push({standard,before,after});
    }
    if(globalThis.AMOS_EXTENSION_TIMING_CLEANUP)globalThis.AMOS_EXTENSION_TIMING_CLEANUP();
    document.getElementById('extension-timing-controls')?.remove();
    const controls=document.createElement('section');controls.id='extension-timing-controls';
    const status=document.createElement('pre');status.id='extension-timing-status';let live=make(),disposed=false;
    function update(){
      const p=live.program;status.dataset.priority=String(p.state.system.amosPriority);status.dataset.waiting=p.state.halted?'ended':p.state.waiting||'running';
      status.dataset.stopped=String(p.state.stopped);status.dataset.logs=JSON.stringify(live.logs);
      status.textContent=`Manual PAL clock: ${live.clock.now().toFixed(3)} ms\nRequested priority: ${p.state.system.amosPriority}\nVM: ${p.state.stopped?'stopped':status.dataset.waiting}\nOutput: ${live.logs.join(', ')}\nPriority is host intent; the browser's OS priority is unchanged.`;
    }
    for(const[id,label,action]of[
      ['one','Advance 1 ms',()=>live.clock.tick(1)],['ten','Advance 10 ms',()=>live.clock.tick(10)],
      ['stop','Stop',()=>live.program.stop()],['resume','Resume',()=>live.program.resume()],
      ['finish','Send key / finish',()=>{live.program.sendKey('x');live.program.tick(100);}],
      ['restart','Restart',()=>{live.program.stop();live=make();}]
    ]){
      const b=document.createElement('button');b.id='timing-'+id;b.textContent=label;
      b.onclick=()=>{if(!disposed){action();update();}};controls.append(b);
    }
    controls.append(status);document.body.append(controls);update();
    globalThis.AMOS_EXTENSION_TIMING_CLEANUP=()=>{disposed=true;live.program.stop();};
    return{cases,slowdown:4,priorityRequests:[20,0],clock:'declared manual nonlaced field model; no Amiga capture'};
  },{source,timerSource:require('./fakeTimers').createFakeTimers.toString()});
};
