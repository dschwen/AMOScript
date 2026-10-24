/* jshint esversion: 6 */
'use strict';

module.exports=async function screenCopyProbe(page){
  const fs=require('fs'),path=require('path'),Transpiler=require('../../lib/Transpiler');
  const sources=[1,2,3,4,5].map(level=>new Transpiler(require('./wonderlandMapCopy')(level)).toModule());
  const assets=Object.fromEntries(['Title_Screen.Iff','Landscape.Iff','Score_Panel.Iff','Wonderland_Samples.Abk'].map(name=>
    [name,fs.readFileSync(path.join(__dirname,'../../examples/Wonderland',name)).toString('base64')]));
  return page.evaluate(({sources,assets,timerSource})=>{
    const createClock=new Function(`return (${timerSource});`)();
    const factories=sources.map(source=>{const m={exports:{}};new Function('module',source)(m);return m.exports;});
    const files={read:name=>{const data=assets[name.split('/').pop()];if(!data)throw new Error(`Unexpected asset ${name}`);return atob(data);}};
    const check=(condition,message)=>{if(!condition)throw new Error(message);};
    const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
    const make=(level,canvas)=>{
      const clock=createClock(),program=factories[level-1]({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files});
      const host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
      host.attach(program);program.tick(100000);clock.tick(20);
      check(program.state.waiting==='key','Missing title guard');
      return {clock,program,host,dispose(){host.detach();program.stop();}};
    };
    let comparedPixels=0;
    for(let level=1;level<=5;level++){
      const canvas=document.createElement('canvas'),run=make(level,canvas),{clock,program,host}=run,d=program.display;
      try{
        program.sendKey('map');clock.tick(20);
        const world=d.screen(0),panel=d.screen(1),logical=world.pixels,physical=world.physicalPixels;
        const expected=logical.slice(),oldPhysical=physical.slice(),hud=panel.physicalPixels.slice();
        check(!equal(expected,oldPhysical)&&program.state.waiting==='sleep','Map must remain hidden until the copy');
        for(const published of [false,true]){
          if(published){clock.tick(20);check(world.pixels===logical&&world.physicalPixels===physical,'Copy swapped buffer identities');
            check(equal(physical,expected)&&equal(logical,expected)&&equal(panel.physicalPixels,hud),'Raw bitmap copy or HUD preservation failed');}
          host.render();check(canvas.width===320&&canvas.height===202,'Incorrect map window geometry');
          const actual=canvas.getContext('2d').getImageData(0,0,320,202).data,cpu=d.renderDisplay();
          const indices=published?expected:oldPhysical;
          for(let y=0;y<202;y++)for(let x=0;x<320;x++){
            const at=(y*320+x)*4,ref=(y*640+x*2)*4;
            for(let c=0;c<4;c++)check(actual[at+c]===cpu[ref+c],`Canvas/CPU mismatch ${level}:${x},${y}`);
            if(y===168||y===169)continue; // Copper palette setup spans these blank rows.
            const code=y<168?indices[y*world.width+x]:hud[(y-170)*panel.width+x];
            const colour=(y<168?world:panel).palette[code],rgb=[(colour>>8&15)*17,(colour>>4&15)*17,(colour&15)*17,255];
            for(let c=0;c<4;c++)check(actual[at+c]===rgb[c],`Indexed palette mismatch ${level}:${x},${y}`);
            comparedPixels++;
          }
          if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:`Level ${level} ${published?'published':'before copy'}`,width:320,height:202,rgba:actual});
        }
        clock.tick(20);check(program.state.waiting==='key'&&clock.pending()===0,'Map fixture did not reach its final guard');
      }finally{run.dispose();}
    }
    if(globalThis.AMOS_COPY_DEMO_CLEANUP)globalThis.AMOS_COPY_DEMO_CLEANUP();
    const previous=document.getElementById('copy-controls');if(previous)previous.remove();
    const controls=document.createElement('section');controls.id='copy-controls';
    const heading=document.createElement('h2');heading.textContent='Step through the original map copy';
    const help=document.createElement('p');help.textContent='Prepare executes the original level-data and Paste Bob loops into a hidden 960×288 logical bitmap. Publish advances the original Wait Vbl / Screen Copy Logic To Physic / Wait Vbl sequence on an injected clock. The sliders inspect the published bitmap through host-controlled offsets. Rainbow activation, enemies and gameplay are excluded.';
    const level=document.createElement('select');level.id='copy-level';level.setAttribute('aria-label','Level');
    for(let i=1;i<=5;i++){const option=document.createElement('option');option.value=i;option.textContent=`Level ${i}`;level.append(option);}
    const surface=document.createElement('canvas');surface.id='copy-output';surface.style.cssText='width:640px;max-width:100%;image-rendering:pixelated';
    const status=document.createElement('pre');status.id='copy-status';let run=null;
    const button=(id,label,handler)=>{const el=document.createElement('button');el.id=id;el.textContent=label;el.addEventListener('click',handler);return el;};
    function report(phase){
      const s=run.program.display.screen(0);controls.dataset.phase=phase;controls.dataset.buffersEqual=String(equal(s.pixels,s.physicalPixels));
      prepare.disabled=phase!=='title';publish.disabled=phase!=='prepared';x.disabled=y.disabled=phase==='title';
      status.textContent=`Level ${level.value}: ${phase}. Logical and physical bytes equal: ${controls.dataset.buffersEqual}.`;
      run.host.render();
    }
    function restart(){if(run)run.dispose();run=make(Number(level.value),surface);x.value=y.value=0;report('title');}
    const reset=button('copy-reset','Reset selected level',restart);
    const prepare=button('copy-prepare','Prepare hidden map',()=>{run.program.sendKey('map');run.clock.tick(20);report('prepared');});
    const publish=button('copy-publish','Publish map',()=>{run.clock.tick(40);report('published');});
    function slider(id,max,step){const el=document.createElement('input');el.id=id;el.type='range';el.min=0;el.max=max;el.step=step;el.value=0;
      el.addEventListener('input',()=>{run.program.display.screenOffset(0,Number(x.value),Number(y.value));run.host.render();controls.dataset.offset=`${x.value},${y.value}`;});return el;}
    const x=slider('copy-x',640,16),y=slider('copy-y',120,12);
    const label=(name,input)=>{const el=document.createElement('label');el.append(name,input);return el;};
    controls.append(heading,help,level,reset,prepare,publish,label('Inspect X ',x),label(' Y ',y),surface,status);
    const results=document.getElementById('results');if(results)results.before(controls);else document.body.append(controls);
    restart();globalThis.AMOS_COPY_DEMO_CLEANUP=()=>run.dispose();
    return {levels:5,frames:10,comparedPixels,gameRunning:false};
  },{sources,assets,timerSource:require('./fakeTimers').createFakeTimers.toString()});
};
