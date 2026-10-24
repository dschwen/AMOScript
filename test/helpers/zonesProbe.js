/* jshint esversion: 6 */
'use strict';

module.exports=async function zonesProbe(page){
  const fs=require('fs'),path=require('path'),Transpiler=require('../../lib/Transpiler');
  const source=new Transpiler(require('./wonderlandZones')()).toModule();
  const panel=fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Editor_Panel.Iff')).toString('base64');
  const golden=fs.readFileSync(path.join(__dirname,'../fixtures/wonderland/Editor_Panel.Iff.png')).toString('base64');
  return page.evaluate(async({source,panel,golden,timerSource})=>{
    const module={exports:{}};new Function('module',source)(module);const create=module.exports;
    const makeClock=new Function(`return (${timerSource});`)();
    const check=(condition,message)=>{if(!condition)throw new Error(message);};
    function make(){
      const clock=makeClock(),program=create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,
        files:{read:name=>{if(!name.endsWith('/Editor_Panel.Iff'))throw new Error(`Unexpected original asset ${name}`);return atob(panel);}}});
      const canvas=document.createElement('canvas'),host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
      host.attach(program);program.tick(1000);clock.tick(20);check(program.state.waiting==='key','Editor zones did not reach the synthetic guard');host.render();
      return {clock,program,canvas,host,query(x,y){program.setMouse(x,y,0);program.sendKey('probe');clock.tick(0);
        check(program.state.waiting==='key'&&clock.pending()===0,'Zone fixture exceeded its guard');return program.state.variables.int_z;},
      dispose(){host.detach();program.stop();}};
    }
    const image=new Image();image.src=`data:image/png;base64,${golden}`;await image.decode();
    const reference=document.createElement('canvas');reference.width=image.width;reference.height=image.height;reference.getContext('2d').drawImage(image,0,0);
    const rgba=reference.getContext('2d').getImageData(0,0,image.width,32).data;
    const run=make(),counts=Array(6).fill(0),rectangles=[[7,7,56,24],[71,7,120,24],[135,7,184,24],[199,7,240,24],[247,7,264,24]];
    try{
      check(run.canvas.width===320&&run.canvas.height===178,'Incorrect original editor windows');
      const d=run.program.display,world=d.screen(0).physicalPixels.slice(),panelBytes=d.screen(1).physicalPixels.slice();
      const snapshot=d.snapshotDisplay(),palette=snapshot.frame.linePal.slice(),version=d.version;
      const actual=run.canvas.getContext('2d').getImageData(0,146,320,32).data,cpu=d.renderDisplay();
      for(let y=0;y<32;y++)for(let x=0;x<320;x++){
        const at=(y*320+x)*4,expected=(y*image.width+x*2)*4,physical=((y+146)*640+x*2)*4;
        for(let c=0;c<4;c++)check(actual[at+c]===rgba[expected+c]&&actual[at+c]===cpu[physical+c],`Editor panel pixel mismatch ${x},${y}`);
        const zone=rectangles.findIndex(([x1,y1,x2,y2])=>x>=x1&&x<=x2&&y>=y1&&y<=y2)+1;
        const selected=run.query(x+128,y+194);check(selected===zone,`Original Zone expression mismatch ${x},${y}`);counts[selected]++;
      }
      check(d.screen(0).physicalPixels.every((v,i)=>v===world[i])&&d.screen(1).physicalPixels.every((v,i)=>v===panelBytes[i]),'Zone queries changed bitmap bytes');
      check(d.version===version&&snapshot.frame.linePal.every((v,i)=>v===palette[i]),'Queries changed presentation or old snapshots');
      if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:'Original editor panel',width:320,height:32,rgba:actual});
    }finally{run.dispose();}
    if(globalThis.AMOS_ZONES_DEMO_CLEANUP)globalThis.AMOS_ZONES_DEMO_CLEANUP();
    const previous=document.getElementById('zones-controls');if(previous)previous.remove();
    const controls=document.createElement('section');controls.id='zones-controls';
    const title=document.createElement('h2');title.textContent='Inspect the original editor zones';
    const help=document.createElement('p');help.textContent='Move over the panel or enter hardware coordinates to replay the original Zone(1,X Mouse-128,Y Mouse-194) expression. This inspector injects coordinates; Mouse Click, Limit Mouse and editor actions are excluded. The panel is cropped from the actual Canvas output. Reset clears metadata without drawing.';
    const x=document.createElement('input'),y=document.createElement('input');x.id='zones-x';y.id='zones-y';x.type=y.type='number';
    const panelCanvas=document.createElement('canvas');panelCanvas.id='zones-panel';panelCanvas.width=320;panelCanvas.height=32;panelCanvas.style.cssText='display:block;width:640px;max-width:100%;image-rendering:pixelated';
    const status=document.createElement('pre');status.id='zones-status';let live=null,lastZone=0;
    const names=['none','Load','Save','Clear','Exit','Tile'];
    function query(){
      const hx=Number(x.value),hy=Number(y.value);if(!Number.isInteger(hx)||!Number.isInteger(hy)||Math.abs(hx)>2147483647||Math.abs(hy)>2147483647){status.textContent='Enter signed integer hardware coordinates.';return;}
      lastZone=live.query(hx,hy);controls.dataset.zone=String(lastZone);
      status.textContent=`Hardware (${hx}, ${hy}); panel (${hx-128}, ${hy-194}); zone ${lastZone}: ${names[lastZone]}.`;
    }
    function restart(){if(live)live.dispose();live=make();panelCanvas.getContext('2d').drawImage(live.canvas,0,146,320,32,0,0,320,32);x.value=136;y.value=202;query();}
    const button=(id,label,handler)=>{const el=document.createElement('button');el.id=id;el.textContent=label;el.addEventListener('click',handler);return el;};
    panelCanvas.addEventListener('pointermove',event=>{
      const rect=panelCanvas.getBoundingClientRect(),scale=rect.width/panelCanvas.offsetWidth;
      const px=Math.floor((event.clientX-rect.left-panelCanvas.clientLeft*scale)*320/(panelCanvas.clientWidth*scale));
      const py=Math.floor((event.clientY-rect.top-panelCanvas.clientTop*scale)*32/(panelCanvas.clientHeight*scale));
      x.value=px+128;y.value=py+194;query();
    });
    const label=(name,input)=>{const el=document.createElement('label');el.append(name,input);return el;};
    controls.append(title,help,label('Hardware X ',x),label(' Y ',y),button('zones-query','Query',query),
      button('zones-reset-one','Reset selected zone',()=>{if(lastZone)live.program.display.resetZone(lastZone);query();}),
      button('zones-reset-all','Reset all zones',()=>{live.program.display.resetZone();query();}),button('zones-restart','Restore original definitions',restart),panelCanvas,status);
    const results=document.getElementById('results');if(results)results.before(controls);else document.body.append(controls);restart();
    globalThis.AMOS_ZONES_DEMO_CLEANUP=()=>live.dispose();
    return {zoneQueries:10240,panelPixels:10240,counts,gameRunning:false};
  },{source,panel,golden,timerSource:require('./fakeTimers').createFakeTimers.toString()});
};
