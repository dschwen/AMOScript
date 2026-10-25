/* jshint esversion: 6 */
'use strict';
module.exports=async function roller2LevelProbe(page){
  const fs=require('fs'),path=require('path'),expected=require('../fixtures/roller2/level-metadata.json').levels;
  const assets=Object.fromEntries(expected.map(item=>[item.level,fs.readFileSync(path.join(__dirname,'../../examples/Roller2/levl',item.level)).toString('base64')]));
  return page.evaluate(({source,assets,expected,timerSource})=>{
    const compiled={exports:{}};new Function('module',source)(compiled);const makeClock=new Function(`return (${timerSource});`)();
    const check=(value,message)=>{if(!value)throw new Error(message);};
    function make(level,time){const clock=makeClock(),p=compiled.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files:{
      read(name){if(name==='level')return atob(assets[level]);if(name==='time')return `${time()}\r\n`;throw new Error(`Unexpected metadata file: ${name}`);},write(){throw new Error('Metadata preview never persists files');}}});p.tick(1000);return{p,clock};}
    let reads=0,writes=0;
    for(const item of expected){
      const {p,clock}=make(item.level,()=>43981);
      try{
        const v=p.state.variables;check(v.int_bx===item.x&&v.int_by===item.y&&v.int_bc===item.colour&&v.int_tm===item.time,`Level ${item.level}: original metadata read differs`);reads++;
        const bank=p.banks.get(10),address=p.bankStart(10),before=bank.data.slice();
        check(p.leek(address+482)===((item.x<<24)|(item.y<<16)|(item.colour<<8)),`Level ${item.level}: long read differs`);
        p.sendKey('edit');clock.tick(20);check(p.state.waiting==='key'&&p.bankStart(10)===address&&p.banks.get(10)===bank,'Metadata write replaced the bank');
        for(let i=0;i<before.length;i++)check(bank.data[i]===(i===486?0xab:i===487?0xcd:before[i]),`Level ${item.level}: byte ${i} differs`);
        check(p.deek(address+486)===43981,'Time word did not use big endian');writes++;p.sendKey('finish');clock.tick(0);check(p.state.halted&&clock.pending()===0,'Metadata fixture did not end cleanly');
      }finally{p.stop();}
    }
    if(globalThis.AMOS_ROLLER2_LEVEL_CLEANUP)globalThis.AMOS_ROLLER2_LEVEL_CLEANUP();const previous=document.getElementById('roller2-level-controls');if(previous)previous.remove();
    const controls=document.createElement('section');controls.id='roller2-level-controls';
    const help=document.createElement('p');help.textContent='Inspect all fifteen original Roller II level headers. Original game line 608 reads the ball position/colour and Deek time. Apply a time to run original editor line 474 (Doke and Wait Vbl) on the loaded memory bank. Only bytes 486–487 change. Load original resets the preview; no files are saved. Game/editor loops and rendering are excluded.';
    const select=document.createElement('select');select.id='roller2-level-select';select.setAttribute('aria-label','Original Roller II level');for(const item of expected){const option=document.createElement('option');option.value=item.level;option.textContent=`Level ${item.level}`;select.append(option);}
    const time=document.createElement('input');time.id='roller2-level-time';time.type='number';time.min='0';time.max='65535';time.step='1';time.setAttribute('aria-label','New time word');
    const load=document.createElement('button');load.id='roller2-level-load';load.textContent='Load original';
    const apply=document.createElement('button');apply.id='roller2-level-apply';apply.textContent='Apply to memory';
    const output=document.createElement('pre');output.id='roller2-level-status';let live=null,preparedTime=0,edited=false,error='';
    function update(){controls.dataset.phase=error?'error':edited?'edited':'loaded';controls.dataset.level=select.value;apply.disabled=edited||!!error;
      if(error){output.textContent=error;return;}const p=live.p,v=p.state.variables,address=p.bankStart(10);controls.dataset.time=String(p.deek(address+486));
      output.textContent=JSON.stringify({level:select.value,ball:{x:v.int_bx,y:v.int_by,colour:v.int_bc},timeWord:Number(controls.dataset.time),timeBytes:Array.from(p.banks.get(10).data.slice(486,488)),packedBallLong:p.leek(address+482),edited,persistent:false,gameRunning:false},null,2);}
    function start(){if(live)live.p.stop();error='';edited=false;const item=expected.find(item=>item.level===select.value);preparedTime=item.time;time.value=String(item.time);live=make(item.level,()=>preparedTime);update();}
    function fail(e){error=e.message;if(live)live.p.stop();update();}
    load.addEventListener('click',()=>{try{start();}catch(e){fail(e);}});select.addEventListener('change',()=>{try{start();}catch(e){fail(e);}});
    apply.addEventListener('click',()=>{try{const value=Number(time.value);if(time.value===''||!Number.isInteger(value)||value<0||value>65535)throw new Error('Time must be an integer from 0 to 65535. Load original to reset.');preparedTime=value;live.p.sendKey('apply');live.clock.tick(20);check(live.p.state.waiting==='key','Edit missed its completion guard');edited=true;update();}catch(e){fail(e);}});
    controls.append(help,select,load,time,apply,output);document.body.append(controls);start();globalThis.AMOS_ROLLER2_LEVEL_CLEANUP=()=>{if(live)live.p.stop();};
    return{levels:expected.length,metadataReads:reads,timeWrites:writes,persistent:false,gameRunning:false};
  },{source:new(require('../../lib/Transpiler'))(require('./roller2LevelMetadata')()).toModule(),assets,expected,timerSource:require('./fakeTimers').createFakeTimers.toString()});
};
