/* jshint esversion: 6 */
'use strict';

module.exports=async function flashProbe(page){
  const Transpiler=require('../../lib/Transpiler'),{binary,token:t,integer:n,text}=require('./tokens');
  const sources=[16,64,4096].map(colours=>new Transpiler(binary([
    [t('Screen Open'),n(0),t(','),n(320),t(','),n(96),t(','),n(colours),t(','),t('Lowres')],
    [t('Colour'),n(1),t(','),n(0xfff)],[t('Cls Colour'),n(colours===64?33:1)],
    [t('Double Buffer')],[t('Autoback'),n(0)],[t('Cls Colour'),n(0)],
    [t('Flash'),n(1),t(','),text('(f00,2)(0f0,3)(00f,1)')],[t('Wait Key')],[t('Flash Off')],[t('Wait Key')]
  ])).toModule());
  return page.evaluate(({sources,timerSource})=>{
    const makeClock=new Function(`return (${timerSource});`)(),factories=sources.map(source=>{const m={exports:{}};new Function('module',source)(m);return m.exports;});
    const check=(condition,message)=>{if(!condition)throw new Error(message);};let frames=0,comparedPixels=0;
    const modes=['Normal','EHB','HAM6'];
    for(let mode=0;mode<3;mode++){
      const clock=makeClock(),program=factories[mode]({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
      const canvas=document.createElement('canvas'),host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
      try{
        host.attach(program);program.tick(1000);const d=program.display,s=d.screen(),physical=s.physicalPixels,logical=s.pixels;
        const bytes=physical.slice(),snapshot=d.snapshotDisplay(),palette=snapshot.frame.linePal.slice(),ticks=program.state.ticks;
        let elapsed=0;
        for(const [at,word]of [[0,0xfff],[20,0xf00],[60,0x0f0],[120,0x00f],[140,0xf00]]){
          clock.tick(at-elapsed);elapsed=at;host.render();const rgb=mode===1?(word>>1)&0x777:word;
          const expected=[(rgb>>8&15)*17,(rgb>>4&15)*17,(rgb&15)*17,255];
          check(canvas.width===320&&canvas.height===96,'Incorrect Flash surface geometry');
          const actual=canvas.getContext('2d').getImageData(0,0,320,96).data,cpu=d.renderDisplay();
          for(let i=0;i<actual.length;i++)check(actual[i]===expected[i%4],`Canvas Flash mismatch ${mode}:${at}:${i}`);
          for(let i=0;i<cpu.length;i++)check(cpu[i]===expected[i%4],`CPU Flash mismatch ${mode}:${at}:${i}`);
          check(s.physicalPixels===physical&&s.pixels===logical&&physical.every((v,i)=>v===bytes[i]),'Flash changed bitmap identity or bytes');
          check(program.state.ticks===ticks&&snapshot.frame.linePal.every((v,i)=>v===palette[i]),'Flash changed the VM or old snapshot');
          if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:`${modes[mode]}: ${at} ms`,width:320,height:96,rgba:actual});
          frames++;comparedPixels+=320*96;
        }
        program.sendKey('off');clock.tick(0);const colour=s.palette[1];clock.tick(1000);
        check(program.state.flashes.length===0&&clock.pending()===0&&s.palette[1]===colour,'Flash Off failed to retain its last colour and cancel wakes');
      }finally{host.detach();program.stop();}
    }
    if(globalThis.AMOS_FLASH_DEMO_CLEANUP)globalThis.AMOS_FLASH_DEMO_CLEANUP();
    const previous=document.getElementById('flash-controls');if(previous)previous.remove();
    const controls=document.createElement('section');controls.id='flash-controls';
    const title=document.createElement('h2');title.textContent='Live Flash / Flash Off';
    const help=document.createElement('p');help.textContent='Synthetic compiled program: Flash 1,"(f00,2)(0f0,3)(00f,1)". Colour durations use the injected 50 Hz clock. Flash Off retains the last colour; Stop pauses host callbacks and Resume reconciles elapsed fields. Implicit colour-3 flashing on Screen Open is not implemented.';
    const surface=document.createElement('canvas');surface.id='flash-output';surface.style.cssText='width:640px;max-width:100%;image-rendering:pixelated';
    const status=document.createElement('pre');status.id='flash-status';let program=null,host=null;
    const button=(id,label,handler)=>{const el=document.createElement('button');el.id=id;el.textContent=label;el.addEventListener('click',handler);return el;};
    function report(){controls.dataset.phase=program.state.stopped?'stopped':program.state.flashes.length?'running':'off';
      status.textContent=`${controls.dataset.phase}; ${program.state.flashes.length} active colour(s)`;host.render();}
    function restart(){if(host)host.detach();if(program)program.stop();program=factories[0]({now:()=>performance.now(),setTimeout,clearTimeout});
      host=AMOS_BROWSER.createCanvasHost(surface);host.attach(program);program.tick(1000);report();}
    const stop=button('flash-stop','Stop',()=>{program.stop();report();});
    const resume=button('flash-resume','Resume',()=>{program.resume();report();});
    const off=button('flash-off','Flash Off',()=>{if(program.state.stopped)program.resume();if(program.state.flashes.length){program.sendKey('off');program.tick(1000);}report();});
    const reset=button('flash-restart','Restart',restart);
    controls.append(title,help,stop,resume,off,reset,surface,status);
    const results=document.getElementById('results');if(results)results.before(controls);else document.body.append(controls);restart();
    globalThis.AMOS_FLASH_DEMO_CLEANUP=()=>{host.detach();program.stop();};
    return {frames,comparedPixels,cancellations:3,gameRunning:false};
  },{sources,timerSource:require('./fakeTimers').createFakeTimers.toString()});
};
