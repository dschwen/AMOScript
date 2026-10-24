/* jshint esversion: 6 */
'use strict';

module.exports=async function rawFilesProbe(page){
  const fs=require('fs'),path=require('path'),Transpiler=require('../../lib/Transpiler');
  const sources=[1,2,3,4,5].map(level=>new Transpiler(require('./wonderlandLevelIO')(level)).toModule());
  const original=Array.from(require('./wonderlandLevelBytes')());
  const samples=fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Wonderland_Samples.Abk')).toString('base64');
  return page.evaluate(({sources,original,samples,timerSource})=>{
    const factories=sources.map(source=>{const m={exports:{}};new Function('module',source)(m);return m.exports;}),makeClock=new Function(`return (${timerSource});`)();
    const check=(condition,message)=>{if(!condition)throw new Error(message);};
    function make(level){
      const clock=makeClock(),files=new Map();const program=factories[level-1]({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,
        files:{read:name=>{if(files.has(name))return files.get(name);if(name.endsWith('/Wonderland_Samples.Abk'))return atob(samples);throw new Error(`Missing raw file ${name}`);},write:(name,data)=>{files.set(name,data);}}});
      program.tick(100000);check(program.state.waiting==='key','Original map read missed its guard');
      return {program,files,advance(){program.sendKey('step');clock.tick(0);check(program.state.waiting==='key'&&clock.pending()===0,'Original file slice missed its guard');},dispose(){program.stop();}};
    }
    let comparedBytes=0;
    for(let level=1;level<=5;level++){
      const run=make(level),p=run.program,data=p.banks.get(4).data,address=p.bankStart(4);
      try{
        const expected=original.slice(0,7205);expected[(level-1)*1440]=level+3;
        p.arraySet(p.state.variables.array_int_scr,[1,1],level+3);run.advance();const saved=run.files.get('levels.lev');
        check(saved.length===7205&&expected.every((v,i)=>saved.charCodeAt(i)===v),'Original exclusive-end Bsave bytes differ');comparedBytes+=saved.length;
        data.fill(99);data[7205]=100+level;run.advance();
        check(expected.every((v,i)=>data[i]===v)&&data[7205]===100+level,'Original Bload did not preserve its unloaded tail');comparedBytes+=expected.length;
        check(p.banks.get(4).data===data&&p.bankStart(4)===address&&p.arrayGet(p.state.variables.array_int_scr,[1,1])===level+3,'Raw I/O replaced storage or failed to reread the map');
        const seeds=[1,2,3,4,5].map(i=>p.arrayGet(p.state.variables.array_int_rbowseed,[i]));check(JSON.stringify(seeds)===JSON.stringify([55,7,45,10,100+level]),'Original seed refresh differs');
      }finally{run.dispose();}
    }
    if(globalThis.AMOS_RAW_DEMO_CLEANUP)globalThis.AMOS_RAW_DEMO_CLEANUP();const previous=document.getElementById('raw-controls');if(previous)previous.remove();
    const controls=document.createElement('section');controls.id='raw-controls';
    const title=document.createElement('h2');title.textContent='Original level-file round trip';
    const help=document.createElement('p');help.textContent='Edit a cell in the decoded map array, then run the original writeback and Bsave statements. The original exclusive end writes 7,205 of 7,206 bank bytes, omitting the fifth rainbow seed. Damage the live bank and reload to inspect that retained tail. Download saves raw bytes; optional local uploads preload the synchronous files adapter. File selection and gameplay are excluded.';
    const level=document.createElement('select');level.id='raw-level';level.setAttribute('aria-label','Level');for(let i=1;i<=5;i++){const o=document.createElement('option');o.value=i;o.textContent=`Level ${i}`;level.append(o);}
    const field=(id,min,max,value)=>{const el=document.createElement('input');el.id=id;el.type='number';el.min=min;el.max=max;el.value=value;return el;};
    const x=field('raw-x',1,60,1),y=field('raw-y',1,24,1),tile=field('raw-tile',0,255,4);
    const status=document.createElement('pre');status.id='raw-status';const download=document.createElement('a');download.id='raw-download';download.download='Wonderland.lev';download.textContent='Download raw .lev';
    const upload=document.createElement('input');upload.id='raw-upload';upload.type='file';upload.accept='.lev';upload.setAttribute('aria-label','Preload a local raw level file');
    let live=null,phase='editing',url=null;
    function revoke(){if(url)URL.revokeObjectURL(url);url=null;download.removeAttribute('href');}
    function link(){revoke();const file=live.files.get('levels.lev');if(file!=null){url=URL.createObjectURL(new Blob([Uint8Array.from(file,c=>c.charCodeAt(0))],{type:'application/octet-stream'}));download.href=url;}}
    function cell(){const a=Number(x.value),b=Number(y.value);if(!Number.isInteger(a)||a<1||a>60||!Number.isInteger(b)||b<1||b>24)throw new Error('Cell coordinates must be 1–60 and 1–24.');return[a,b];}
    function report(){const p=live.program,seeds=[1,2,3,4,5].map(i=>p.arrayGet(p.state.variables.array_int_rbowseed,[i])),file=live.files.get('levels.lev');
      controls.dataset.phase=phase;controls.dataset.cell=String(p.arrayGet(p.state.variables.array_int_scr,cell()));controls.dataset.fileBytes=String(file==null?0:file.length);controls.dataset.tail=String(p.banks.get(4).data[7205]);
      save.disabled=apply.disabled=phase!=='editing';damage.disabled=reload.disabled=upload.disabled=!['saved','damaged'].includes(phase);
      status.textContent=JSON.stringify({phase,level:Number(level.value),cell:cell(),tile:Number(controls.dataset.cell),fileBytes:Number(controls.dataset.fileBytes),fifthSeedByte:Number(controls.dataset.tail),seedArray:seeds,filePrefix:file==null?null:Array.from(file.slice(0,24),c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join(' ')},null,2);
    }
    function restart(){if(live)live.dispose();live=make(Number(level.value));phase='editing';x.value=y.value=1;tile.value=4;upload.value='';revoke();report();}
    const button=(id,label,handler)=>{const el=document.createElement('button');el.id=id;el.textContent=label;el.addEventListener('click',()=>{try{handler();}catch(error){status.textContent=error.message;}});return el;};
    const reset=button('raw-restart','Reset selected level',restart);
    const apply=button('raw-apply','Edit map cell',()=>{const value=Number(tile.value);if(!Number.isInteger(value)||value<0||value>255)throw new Error('Tile byte must be 0–255.');live.program.arraySet(live.program.state.variables.array_int_scr,cell(),value);report();});
    const save=button('raw-save','Run original Bsave',()=>{live.advance();phase='saved';link();report();});
    const damage=button('raw-damage','Damage live bank',()=>{live.program.banks.get(4).data.fill(99);live.program.banks.get(4).data[7205]=100;phase='damaged';report();});
    const reload=button('raw-reload','Run original Bload',()=>{live.advance();phase='loaded';report();});
    upload.addEventListener('change',async()=>{const file=upload.files[0],target=live,previousPhase=phase;if(!file)return;try{if(file.size>7206)throw new Error('Raw file exceeds the 7,206-byte destination bank.');phase='preloading';report();const bytes=new Uint8Array(await file.arrayBuffer());if(target!==live)return;live.files.set('levels.lev',String.fromCharCode(...bytes));phase=previousPhase;link();report();}catch(error){if(target!==live)return;phase=previousPhase;report();status.textContent=error.message;}});
    const label=(name,input)=>{const el=document.createElement('label');el.append(name,input);return el;};
    controls.append(title,help,level,reset,label(' X ',x),label(' Y ',y),label(' Tile byte ',tile),apply,save,damage,reload,download,label(' Preload ',upload),status);
    const results=document.getElementById('results');if(results)results.before(controls);else document.body.append(controls);restart();globalThis.AMOS_RAW_DEMO_CLEANUP=()=>{revoke();live.dispose();};
    return {levels:5,savedBytes:7205,comparedBytes,omittedFifthSeed:true,gameRunning:false};
  },{sources,original,samples,timerSource:require('./fakeTimers').createFakeTimers.toString()});
};
