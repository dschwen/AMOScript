/* jshint esversion: 6 */
'use strict';

module.exports=async function mouseProbe(page){
  const fs=require('fs'),path=require('path'),Transpiler=require('../../lib/Transpiler');
  const source=new Transpiler(require('./wonderlandMouse')()).toModule();
  const {binary,token:t}=require('./tokens');const idleSource=new Transpiler(binary([[t('Wait Key')]])).toModule();
  const panel=fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Editor_Panel.Iff')).toString('base64');
  const rollerSource=new Transpiler(require('./roller2MenuMouse')()).toModule();
  const rollerTitle=fs.readFileSync(path.join(__dirname,'../../examples/Roller2/iffp/roller titel')).toString('base64');
  return page.evaluate(({source,idleSource,panel,timerSource,rollerSource,rollerTitle})=>{
    const module={exports:{}};new Function('module',source)(module);const create=module.exports;
    const idle={exports:{}};new Function('module',idleSource)(idle);const makeClock=new Function(`return (${timerSource});`)();
    const check=(condition,message)=>{if(!condition)throw new Error(message);};
    function make(canvas){
      const clock=makeClock(),program=create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,
        files:{read:name=>{if(!name.endsWith('/Editor_Panel.Iff'))throw new Error('Unexpected mouse fixture asset');return atob(panel);}}});
      const host=AMOS_BROWSER.createCanvasHost(canvas,{mouseCoordinates:'hardware',requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
      host.attach(program);program.tick(1000);clock.tick(20);host.render();
      const poll=()=>{program.sendKey('probe');clock.tick(0);check(program.state.waiting==='key'&&clock.pending()===0,'Selection slice missed its guard');
        const v=program.state.variables;return {click:v.int_mc,zone:v.int_z,key:v.string_i,scan:v.int_scod};};
      return{program,host,poll,dispose(){host.detach();program.stop();}};
    }
    const canvas=document.createElement('canvas');canvas.style.cssText='position:absolute;left:-10000px;top:0;width:640px;height:356px;border:3px solid;transform:scale(.75);transform-origin:top left';document.body.append(canvas);
    const run=make(canvas),{program:p,host}=run,d=p.display;let selections=0,lifecycleChecks=0;
    function emit(hx,hy,buttons){
      const r=canvas.getBoundingClientRect(),sx=r.width/canvas.offsetWidth,sy=r.height/canvas.offsetHeight;
      canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+canvas.clientLeft*sx+(hx-128)*canvas.clientWidth*sx/320,
        clientY:r.top+canvas.clientTop*sy+(hy-48)*canvas.clientHeight*sy/178,buttons,bubbles:true}));
    }
    try{
      const before=d.screen(1).physicalPixels.slice(),snapshot=d.snapshotDisplay(),palette=snapshot.frame.linePal.slice();
      for(const [x,zone,key,scan]of [[136,1,'l',0],[208,2,'s',0],[272,3,'c',0],[336,4,'',69],[384,5,'',0]]){
        emit(x,202,0);run.poll();emit(x,202,1);const selected=run.poll();
        check(JSON.stringify(selected)===JSON.stringify({click:1,zone,key,scan}),`Original editor selection failed ${zone}`);selections++;
        check(run.poll().click===0,'Held button repeated a click');emit(x,202,0);emit(x,202,1);check(run.poll().click===0,'Unobserved release incorrectly queued a click');
      }
      emit(200,202,0);run.poll();emit(200,202,6);check(run.poll().click===6&&p.inputValue('Mouse Key')===6,'Right/middle button bits differ');
      emit(-100,-100,0);check(p.state.input.mouse.x===128&&p.state.input.mouse.y===48,'Lower mouse bounds failed');
      emit(999,999,0);check(p.state.input.mouse.x===448&&p.state.input.mouse.y===220,'Upper mouse bounds failed');
      d.screenOffset(0,320,144);d.select(0);emit(208,202,0);check(p.state.input.mouse.x===208&&p.state.input.mouse.y===202,'Scrolling/selection retargeted hardware input');d.select(1);
      for(const reason of ['blur','window','visibility','stop','detach']){
        emit(136,202,1);run.poll();
        if(reason==='blur')canvas.dispatchEvent(new Event('blur'));
        if(reason==='window')window.dispatchEvent(new Event('blur'));
        if(reason==='visibility'){
          const descriptor=Object.getOwnPropertyDescriptor(document,'hidden');
          Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
          if(descriptor)Object.defineProperty(document,'hidden',descriptor);else delete document.hidden;
        }
        if(reason==='stop')p.stop();
        if(reason==='detach')host.detach();
        check(p.state.input.mouse.buttons===0&&p.state.input.mouseClick===0,`Mouse cleanup failed: ${reason}`);lifecycleChecks++;
        if(['blur','window','visibility'].includes(reason)){emit(136,202,1);check(p.state.input.mouse.buttons===0,'Unfocused host accepted held input');canvas.dispatchEvent(new Event('focus'));}
        if(reason==='stop'){emit(136,202,1);check(p.state.input.mouse.buttons===0,'Stopped host accepted held input');p.resume();}
        if(reason==='detach'){emit(136,202,1);check(p.state.input.mouse.buttons===0,'Detached listeners remain active');host.attach(p);}
      }
      check(d.screen(1).physicalPixels.every((v,i)=>v===before[i])&&snapshot.frame.linePal.every((v,i)=>v===palette[i]),'Mouse input changed physical output');
      if(globalThis.AMOS_DEMO_OBSERVE){host.render();const rgba=canvas.getContext('2d').getImageData(0,0,320,178).data;globalThis.AMOS_DEMO_OBSERVE({name:'Original editor selection fixture',width:320,height:178,rgba});}
    }finally{run.dispose();canvas.remove();}
    for(const mode of ['screen','hardware']){
      const c=makeClock(),program=idle.exports({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout}),surface=document.createElement('canvas');
      surface.style.cssText='position:absolute;left:-10000px;top:0;width:320px;height:200px;border:0';document.body.append(surface);
      const adapter=AMOS_BROWSER.createCanvasHost(surface,{mouseCoordinates:mode,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
      try{adapter.attach(program);program.tick(100);const rect=surface.getBoundingClientRect();surface.dispatchEvent(new PointerEvent('pointermove',{clientX:rect.left+10.25,clientY:rect.top+20.25,buttons:0}));
        check(program.state.input.mouse.x===(mode==='screen'?10:138)&&program.state.input.mouse.y===(mode==='screen'?20:70),'Mouse coordinate opt-in changed its contract');
      }finally{adapter.detach();program.stop();surface.remove();}
    }
    check((()=>{try{AMOS_BROWSER.createCanvasHost(document.createElement('canvas'),{mouseCoordinates:'invalid'});return false;}catch(_){return true;}})(),'Invalid coordinate option accepted');
    const roller={exports:{}};new Function('module',rollerSource)(roller);let rollerMouseSteps=0;
    const directions=[['ArrowLeft'],['ArrowRight'],['ArrowUp'],['ArrowDown'],['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'],['ArrowLeft','ArrowUp'],['ArrowRight','ArrowDown']];
    const positions=[[198,100],[200,100],[200,98],[200,100],[200,100],[128,42],[447,312]];
    for(const mode of ['keyboard','gamepad']){
      const clock=makeClock(),program=roller.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files:{read:()=>atob(rollerTitle)}});
      const canvas=document.createElement('canvas');canvas.tabIndex=0;document.body.append(canvas);let pad=null;
      const adapter=AMOS_BROWSER.createCanvasHost(canvas,{mouseCoordinates:'hardware',hasFocus:()=>true,requestAnimationFrame:()=>1,cancelAnimationFrame(){},getGamepads:()=>[pad],
        joysticks:[{port:1,keyboard:mode==='keyboard',gamepad:mode==='gamepad'}]});
      try{
        adapter.attach(program);program.tick(1000);program.setMouse(200,100);const before=program.display.screen().physicalPixels.slice();
        for(let index=0;index<directions.length;index++){
          const keys=directions[index];if(index===5)program.setMouse(128,42);if(index===6)program.setMouse(447,312);
          if(mode==='keyboard')for(const key of keys)canvas.dispatchEvent(new KeyboardEvent('keydown',{key,code:key,bubbles:true,cancelable:true}));
          else pad={connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:16},(_,i)=>({pressed:keys.includes({12:'ArrowUp',13:'ArrowDown',14:'ArrowLeft',15:'ArrowRight'}[i])}))};
          program.sendKey('step');clock.tick(20);
          check(program.state.waiting==='key',`Roller II ${mode} movement escaped its guard`);
          check(program.inputValue('X Mouse')===positions[index][0]&&program.inputValue('Y Mouse')===positions[index][1],`Roller II ${mode} mouse step ${index} differs`);rollerMouseSteps++;
          if(mode==='keyboard')for(const key of keys)canvas.dispatchEvent(new KeyboardEvent('keyup',{key,code:key,bubbles:true}));else pad=null;
        }
        check(program.state.variables.int_movj===-1&&program.display.screen().physicalPixels.every((v,i)=>v===before[i]),'Roller II movement changed its title bitmap');
        adapter.render();if(mode==='gamepad'&&globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:'Roller II original joystick mouse movement',width:320,height:268,rgba:canvas.getContext('2d').getImageData(0,0,320,268).data});
      }finally{adapter.detach();program.stop();canvas.remove();}
    }
    if(globalThis.AMOS_MOUSE_DEMO_CLEANUP)globalThis.AMOS_MOUSE_DEMO_CLEANUP();const previous=document.getElementById('mouse-controls');if(previous)previous.remove();
    const controls=document.createElement('section');controls.id='mouse-controls';
    const title=document.createElement('h2');title.textContent='Original editor button selection';
    const help=document.createElement('p');help.textContent='The replay also checks fourteen original Roller II joystick mouse steps using keyboard and injected Gamepad API input, including limits. Its zones/menu actions remain excluded. Below, click and hold a Wonderland panel button briefly. A synthetic 50 Hz polling harness steps the unchanged original Mouse Click / Zone / selection statements. Selected actions are reported; files, clearing, exiting and the rest of the editor are not executed.';
    const surface=document.createElement('canvas');surface.id='mouse-panel';surface.style.cssText='width:640px;max-width:100%;image-rendering:pixelated';
    surface.addEventListener('contextmenu',event=>event.preventDefault());
    const status=document.createElement('pre');status.id='mouse-status';let live=null,last='none';
    function report(){controls.dataset.phase=live.program.state.stopped?'stopped':'running';const m=live.program.state.input.mouse;
      controls.dataset.buttons=String(m.buttons);status.textContent=JSON.stringify({phase:controls.dataset.phase,hardware:m,zone:controls.dataset.zone||'0',lastSelection:last},null,2);}
    function restart(){if(live)live.dispose();live=make(surface);last='none';controls.dataset.action=last;controls.dataset.zone='0';report();}
    const button=(id,label,handler)=>{const el=document.createElement('button');el.id=id;el.textContent=label;el.addEventListener('click',handler);return el;};
    controls.append(title,help,button('mouse-stop','Stop',()=>{live.program.stop();report();}),button('mouse-resume','Resume',()=>{live.program.resume();report();}),
      button('mouse-restart','Restart',restart),surface,status);
    const results=document.getElementById('results');if(results)results.before(controls);else document.body.append(controls);restart();
    const interval=setInterval(()=>{if(live.program.state.stopped)return;const result=live.poll();controls.dataset.zone=String(result.zone);
      if(result.click){last=result.key||(result.scan===69?'escape':'none');controls.dataset.action=last;}report();},20);
    globalThis.AMOS_MOUSE_DEMO_CLEANUP=()=>{clearInterval(interval);live.dispose();};
    return{selections,lifecycleChecks,coordinateModes:2,rollerMouseSteps,gameRunning:false};
  },{source,idleSource,panel,rollerSource,rollerTitle,timerSource:require('./fakeTimers').createFakeTimers.toString()});
};
