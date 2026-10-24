/* jshint esversion: 6 */
'use strict';

module.exports = async function fadeProbe(page) {
  const fs=require('fs'),path=require('path'),Transpiler=require('../../lib/Transpiler');
  const source=new Transpiler(require('./wonderlandFade')()).toModule();
  const timers=require('./fakeTimers').createFakeTimers.toString();
  const directory=path.join(__dirname,'../../examples/Wonderland');
  const assets=Object.fromEntries(['Title_Screen.Iff','Wonderland_Samples.Abk'].map(name=>[name,fs.readFileSync(path.join(directory,name)).toString('base64')]));
  const golden=fs.readFileSync(path.join(__dirname,'../fixtures/wonderland/title-setup.png')).toString('base64');
  return page.evaluate(async ({source,timers,assets,golden})=>{
    const module={exports:{}};new Function('module',source)(module);const create=module.exports;
    const makeClock=new Function(`return (${timers});`)(),clock=makeClock();
    const files={read:name=>{const bytes=assets[name.split('/').pop()];if(!bytes)throw new Error(`Unexpected original asset ${name}`);return atob(bytes);}};
    const program=create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files});
    const canvas=document.createElement('canvas');let requestedFrames=0;
    const host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>++requestedFrames,cancelAnimationFrame(){}});
    const check=(condition,message)=>{if(!condition)throw new Error(message);};
    const image=new Image();image.src=`data:image/png;base64,${golden}`;await image.decode();
    const reference=document.createElement('canvas');reference.width=image.width;reference.height=image.height;
    reference.getContext('2d').drawImage(image,0,0);
    const original=reference.getContext('2d').getImageData(0,0,image.width,image.height).data;
    const times=[0,19,20,60,140,300,580,620,1300];let frames=0,comparedPixels=0;
    try {
      host.attach(program);program.tick(100000);clock.tick(20);check(program.state.waiting==='key','Original title did not reach trigger');
      const pixels=program.display.screen().physicalPixels.slice(),snapshot=program.display.snapshotDisplay(),oldPalette=snapshot.frame.linePal.slice();
      program.sendKey('f');clock.tick(0);const ticks=program.state.ticks;check(program.state.waiting==='sleep','Fade did not reach original Wait 64');
      let elapsed=0;
      for(const at of times) {
        clock.tick(at-elapsed);elapsed=at;host.render();
        const steps=at<20?0:Math.min(15,Math.floor((at-20)/40)+1);
        const cpu=program.display.renderDisplay(),actual=canvas.getContext('2d').getImageData(0,0,320,256).data;
        for(let i=0;i<cpu.length;i++) {
          const expected=i%4===3?255:Math.max(0,original[i]-steps*17);
          check(cpu[i]===expected,`CPU fade mismatch at ${at} ms, byte ${i}`);
        }
        for(let i=0;i<actual.length;i++) {
          const pixel=Math.floor(i/4),y=Math.floor(pixel/320),x=pixel%320,source=(y*640+x*2)*4+i%4;
          const expected=i%4===3?255:Math.max(0,original[source]-steps*17);
          check(actual[i]===expected,`Canvas fade mismatch at ${at} ms, byte ${i}`);
        }
        comparedPixels+=320*256;
        check(program.display.screen().physicalPixels.every((value,i)=>value===pixels[i]),'Fade mutated physical pixels');
        check(snapshot.frame.linePal.every((value,i)=>value===oldPalette[i]),'Fade mutated an old snapshot');
        if(at<=620)check(program.state.ticks===ticks,'Palette wake executed program instructions');
        if(at===580)check(program.state.fade.active,'Source completion check ended too early');
        if(at===620)check(!program.state.fade.active,'Fade completion check did not finish');
        if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:`Wonderland Fade: ${at} ms`,width:320,height:256,rgba:actual});
        frames++;
      }
      check(program.state.waiting==='key'&&clock.pending()===0,'Original Wait 64 / Wait Vbl did not finish cleanly');
      check(requestedFrames===1,'Expected one unexecuted, coalesced animation request');
    }finally{host.detach();program.stop();}

    if(globalThis.AMOS_FADE_DEMO_CLEANUP)globalThis.AMOS_FADE_DEMO_CLEANUP();
    const previous=document.getElementById('fade-controls');if(previous)previous.remove();
    const controls=document.createElement('section');controls.id='fade-controls';controls.dataset.phase='loading';
    const heading=document.createElement('h2');heading.textContent='Live original Fade 2';
    const help=document.createElement('p');help.textContent='Fade the original title using the copied post-death Fade 2 / Wait 64 / Wait Vbl lines. Stop cancels wakeups; Resume catches up to elapsed AMOS time. Restart reloads the title.';
    const surface=document.createElement('canvas');surface.id='fade-input';surface.style.cssText='width:640px;max-width:100%;image-rendering:pixelated';
    const status=document.createElement('p');status.id='fade-status';let live=null,adapter=null,started=false;
    const buttons={};
    function update(){
      if(!live)return;
      const phase=live.state.stopped?'stopped':!started?(live.state.waiting==='key'?'ready':'loading'):live.state.fade.active?'fading':live.state.waiting==='key'?'complete':'waiting';
      controls.dataset.phase=phase;controls.dataset.active=String(live.state.fade.active);
      status.textContent=`${phase}; next fade VBL: ${live.state.fade.nextVbl==null?'none':live.state.fade.nextVbl}`;
      buttons.fade.disabled=phase!=='ready';
    }
    function start(){
      if(adapter)adapter.detach();if(live)live.stop();started=false;
      live=create({setTimeout,clearTimeout,now:()=>performance.now(),files});
      adapter=AMOS_BROWSER.createCanvasHost(surface);adapter.attach(live);live.tick(100000);update();
    }
    controls.append(heading,help,surface,status);
    for(const action of ['fade','restart','stop','resume']){
      const button=document.createElement('button');button.id=`fade-${action}`;button.textContent=action;buttons[action]=button;
      button.addEventListener('click',()=>{if(action==='restart')start();else if(action==='stop')live.stop();else if(action==='resume')live.resume();else if(controls.dataset.phase==='ready'){started=true;live.sendKey('f');}update();});controls.append(button);
    }
    const results=document.getElementById('results');if(results)results.before(controls);else document.body.append(controls);
    start();const monitor=setInterval(update,25);
    globalThis.AMOS_FADE_DEMO_CLEANUP=()=>{clearInterval(monitor);adapter.detach();live.stop();};
    return {frames,comparedPixels,noAnimationRequired:true,sourceWaitFinished:true,endpointBlack:true,gameRunning:false};
  },{source,timers,assets,golden});
};
