/* jshint esversion: 6 */
'use strict';

module.exports=async function fileSelectorProbe(page){
  const fs=require('fs'),path=require('path'),Transpiler=require('../../lib/Transpiler');
  const sources=['load','save'].map(mode=>new Transpiler(require('./wonderlandSelector')(mode)).toModule());
  const whole=new Transpiler(fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Wonderland.AMOS'))).toModule();
  const assets=Object.fromEntries(['Wonderland_Samples.Abk','Title_Screen.Iff','Landscape.Iff','Score_Panel.Iff'].map(name=>[name,fs.readFileSync(path.join(__dirname,'../../examples/Wonderland',name)).toString('base64')]));
  return page.evaluate(({sources,whole,assets,original,memorySource,timerSource,stepSource})=>{
    const factories=sources.map(source=>{const m={exports:{}};new Function('module',source)(m);return m.exports;}),m={exports:{}};new Function('module',whole)(m);
    const memory=new Function(`return (${memorySource});`)(),timers=new Function(`return (${timerSource});`)(),steps=new Function(`return (${stepSource});`)();
    const check=(condition,message)=>{if(!condition)throw new Error(message);};const prefix='AMOSPro_Productivity2:Wonderland/';
    function run(mode,name,choices,data){
      const initial={[prefix+'Wonderland_Samples.Abk']:atob(assets['Wonderland_Samples.Abk'])};if(mode==='load')initial[name]=data;
      const files=memory(initial,choices),clock=timers(),program=factories[mode==='load'?0:1]({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files});
      try{program.tick(100000);check(program.state.waiting==='key'&&clock.pending()===0,'Original selector missed its completion guard');
        const v=program.state.variables;return{selected:v.string_f,requests:files.selectionRequests(),visible:program.mouseVisible(),bytes:files.read(name),seeds:[1,2,3,4,5].map(i=>program.arrayGet(v.array_int_rbowseed,[i]))};
      }finally{program.stop();}
    }
    const bytes=String.fromCharCode(...original),name=prefix+'chosen.LEV';
    for(const mode of ['load','save']){
      const result=run(mode,name,['','wrong.txt',name],bytes);check(result.selected===name&&result.requests.length===3&&!result.visible,'Original selector retry/return or Hide On failed');
      check(result.bytes===(mode==='load'?bytes:bytes.slice(0,7205)),'Original selected file bytes differ');check(JSON.stringify(result.seeds)===JSON.stringify([55,7,45,10,49]),'Selected original file seeds differ');
    }
    function probeWhole(show=false){
      const clock=steps(),files=memory(Object.fromEntries(Object.entries(assets).map(([name,data])=>[prefix+name,atob(data)])));
      const program=m.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files,print(){}});const trace=[];
      try{program.tick(100000);trace.push({time:clock.now(),line:program.state.location.line});program.setJoystick(1,16);
        for(let i=0;i<100;i++){
          check(clock.next(),'Whole program lost its scheduled continuation');if(i===4)program.setJoystick(1,0);
          if([4,10,30,99].includes(i)){
            const snapshot=program.display.snapshotDisplay(),rgba=program.display.renderDisplay();
            check(snapshot.frame.lineSprites.some(value=>value===0x80000001),'Original attached sprites missing');
            check(rgba.length===640*202*4,'Whole-program frame dimensions changed');
            trace.push({time:clock.now(),line:program.state.location.line,count:program.state.variables.int_count});
            if(show){const canvas=document.getElementById('selector-game-frame');canvas.width=640;canvas.height=202;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba),640,202),0,0);}
          }
        }
        check(!program.state.halted&&program.state.variables.int_game===1&&program.state.variables.int_lev===1&&clock.now()===2000,'Whole game dispatch did not retain its first-level loop');
        check(program.state.variables.int_count===47,'Whole game loop count changed');
        return{compiled:true,game:1,level:1,time:2000,frames:4,count:47,running:true,trace};
      }finally{program.stop();check(clock.pending()===0,'Stopped whole game retained a timer');}
    }
    const gate=probeWhole();
    if(globalThis.AMOS_SELECTOR_DEMO_CLEANUP)globalThis.AMOS_SELECTOR_DEMO_CLEANUP();const previous=document.getElementById('selector-controls');if(previous)previous.remove();
    const controls=document.createElement('section');controls.id='selector-controls';const heading=document.createElement('h2');heading.textContent='Prepare a choice, then run original Fsel$';
    const help=document.createElement('p');help.textContent='This synchronous adapter consumes prepared choices. Load uses preloaded bytes; Save may choose a new memory-file path. Optional cancellation is followed by the valid choice, so the original extension loop retries. Native modal selection, directory browsing and IndexedDB persistence remain open. The whole-source probe runs the unmodified first-level loop for two seconds and displays its final physical frame. This bounded run does not establish complete gameplay or Amiga parity.';
    const mode=document.createElement('select');mode.id='selector-mode';mode.setAttribute('aria-label','Original file operation');for(const label of ['load','save']){const option=document.createElement('option');option.value=label;option.textContent=label;mode.append(option);}
    const selected=document.createElement('input');selected.id='selector-path';selected.value=prefix+'chosen.lev';selected.setAttribute('aria-label','Prepared full file path');
    const cancel=document.createElement('input');cancel.id='selector-cancel';cancel.type='checkbox';cancel.checked=true;
    const upload=document.createElement('input');upload.id='selector-upload';upload.type='file';upload.accept='.lev';upload.setAttribute('aria-label','Preload selected local bytes');
    const status=document.createElement('pre');status.id='selector-status';let data=bytes,alive=true,revision=0;
    const execute=document.createElement('button');execute.id='selector-run';execute.textContent='Run original selector and file operation';
    execute.addEventListener('click',()=>{try{const result=run(mode.value,selected.value,cancel.checked?['',selected.value]:[selected.value],data);
      controls.dataset.selected=result.selected;controls.dataset.requests=String(result.requests.length);controls.dataset.bytes=String(result.bytes.length);controls.dataset.phase='done';status.textContent=JSON.stringify({...result,bytes:result.bytes.length},null,2);
    }catch(error){controls.dataset.phase='error';status.textContent=error.message;}});
    upload.addEventListener('change',async()=>{const file=upload.files[0],token=++revision;if(!file)return;execute.disabled=true;controls.dataset.phase='preloading';
      try{if(file.size>7206)throw new Error('Selected data exceeds the 7,206-byte destination bank.');const input=new Uint8Array(await file.arrayBuffer());if(!alive||token!==revision)return;data=String.fromCharCode(...input);selected.value=prefix+file.name;controls.dataset.phase='ready';status.textContent=`Preloaded ${input.length} bytes. Choose Load, then run.`;}
      catch(error){if(alive&&token===revision){controls.dataset.phase='error';status.textContent=error.message;}}finally{if(alive&&token===revision)execute.disabled=false;}
    });
    const gameCanvas=document.createElement('canvas');gameCanvas.id='selector-game-frame';gameCanvas.style.maxWidth='100%';gameCanvas.setAttribute('aria-label','Unmodified Wonderland first-level frame');
    const full=document.createElement('button');full.id='selector-whole';full.textContent='Probe unmodified game entry';full.addEventListener('click',()=>{const result=probeWhole(true);controls.dataset.running=String(result.running);status.textContent=JSON.stringify(result,null,2);});
    const label=document.createElement('label');label.append(cancel,' Cancel once before choosing');controls.append(heading,help,mode,selected,label,upload,execute,full,gameCanvas,status);
    const results=document.getElementById('results');if(results)results.before(controls);else document.body.append(controls);controls.dataset.phase='ready';status.textContent=JSON.stringify(gate,null,2);
    globalThis.AMOS_SELECTOR_DEMO_CLEANUP=()=>{alive=false;revision++;};
    return{selectorModes:2,retryCalls:6,wholeCompiled:gate.compiled,gameEntry:true,gameFrames:gate.frames,gameRunning:gate.running};
  },{sources,whole,assets,original:Array.from(require('./wonderlandLevelBytes')()),memorySource:require('../../lib/amos/files').createMemoryFiles.toString(),timerSource:require('./fakeTimers').createFakeTimers.toString(),stepSource:require('./steppedTimers').createSteppedTimers.toString()});
};
