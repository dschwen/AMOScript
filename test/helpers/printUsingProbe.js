/* jshint esversion: 6 */
'use strict';

module.exports=async function printUsingProbe(page){
  const fs=require('fs'),path=require('path'),Transpiler=require('../../lib/Transpiler');
  const {binary,token:t,integer:n,identifier:id,text}=require('./tokens');
  const cases=require('./scorePanelGoldens')().map(item=>({...item,rgba:Array.from(item.rgba),
    source:new Transpiler(require('./wonderlandScore')(item.level,item.score,item.secondLevelLine)).toModule()}));
  const panel=fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Score_Panel.Iff')).toString('base64');
  const liveSource=new Transpiler(binary([[t('Open In'),n(1),t(','),text('field.txt')],
    [t('Line Input#'),n(1),t(','),id('mask',6,2)],[t('Input#'),n(1),t(','),id('number')],[t('Close All')],
    [t('Screen Open'),n(0),t(','),n(320),t(','),n(96),t(','),n(16),t(','),t('Lowres')],
    [t('Cls Colour'),n(0)],[t('Colour'),n(1),t(','),n(0xfff)],[t('Pen'),n(1)],[t('Paper'),n(0)],
    [t('Locate'),n(1),t(','),n(1)],[t('Print'),t('Using'),id('mask',6,2),t(';'),id('number')],[t('Wait Key')]])).toModule();
  return page.evaluate(({cases,panel,liveSource})=>{
    const factory=source=>{const m={exports:{}};new Function('module',source)(m);return m.exports;};
    const check=(condition,message)=>{if(!condition)throw new Error(message);};
    const outputs=[];let comparedPixels=0;
    for(const item of cases){
      const logs=[],program=factory(item.source)({setTimeout,clearTimeout,now:()=>performance.now(),print:v=>logs.push(v),
        files:{read:name=>{if(!name.endsWith('/Score_Panel.Iff'))throw new Error('Unexpected original path');return atob(panel);}}});
      const canvas=document.createElement('canvas'),host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
      try{
        host.attach(program);program.tick(1000);host.render();
        check(JSON.stringify(logs)===JSON.stringify([item.levelText,item.scoreText]),'Original formatted field output differs');
        check(program.state.waiting==='key'&&canvas.width===320&&canvas.height===32,'Incorrect panel geometry or guard');
        const actual=canvas.getContext('2d').getImageData(0,0,320,32).data,cpu=program.display.renderDisplay();
        for(let i=0;i<cpu.length;i++)check(cpu[i]===item.rgba[i],`CPU panel mismatch at byte ${i}`);
        for(let i=0;i<actual.length;i++){const pixel=Math.floor(i/4),y=Math.floor(pixel/320),x=pixel%320;
          check(actual[i]===item.rgba[(y*640+x*2)*4+i%4],`Canvas panel mismatch at byte ${i}`);}
        comparedPixels+=320*32;
        if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:`Wonderland level ${item.level}, score ${item.score}`,width:320,height:32,rgba:actual});
        outputs.push(logs);
      }finally{host.detach();program.stop();}
    }
    if(globalThis.AMOS_USING_DEMO_CLEANUP)globalThis.AMOS_USING_DEMO_CLEANUP();
    const previous=document.getElementById('using-controls');if(previous)previous.remove();
    const controls=document.createElement('section');controls.id='using-controls';
    const heading=document.createElement('h2');heading.textContent='Live integer field';
    const help=document.createElement('p');help.textContent='The compiled program reads these inputs through its files adapter, then executes Print Using. # takes integer digits; + and - are sign fields. Overflow keeps the last digits. Decimal and exponent formatting are not implemented.';
    const mask=document.createElement('input');mask.id='using-format';mask.value='######';mask.setAttribute('aria-label','Format');
    const number=document.createElement('input');number.id='using-value';number.value='123';number.setAttribute('aria-label','Signed 32-bit integer');
    const surface=document.createElement('canvas');surface.id='using-output';surface.style.cssText='width:640px;max-width:100%;image-rendering:pixelated';
    const status=document.createElement('pre');status.id='using-status';let program=null,host=null;
    const create=factory(liveSource);
    function render(){
      if(!/^[+-]?\d+$/.test(number.value)||!Number.isInteger(Number(number.value))||Number(number.value)<-2147483648||Number(number.value)>2147483647)throw new Error('Enter a signed 32-bit integer.');
      let formatted='';
      const next=create({setTimeout,clearTimeout,now:()=>performance.now(),print:v=>{formatted=v;},
        files:{read:()=>`${mask.value}\n${number.value}\n`,write(){}}});
      next.tick(1000);
      if(host)host.detach();if(program)program.stop();program=next;
      host=AMOS_BROWSER.createCanvasHost(surface);host.attach(program);host.render();
      controls.dataset.output=formatted;status.textContent=`${JSON.stringify(formatted)} (${formatted.length} characters)`;
    }
    const button=document.createElement('button');button.id='using-render';button.textContent='Render field';
    button.addEventListener('click',()=>{try{render();}catch(error){status.textContent=error.message;}});
    const label=(name,input)=>{const element=document.createElement('label');element.append(`${name} `,input);return element;};
    controls.append(heading,help,label('Format',mask),label('Value',number),button,surface,status);
    const results=document.getElementById('results');if(results)results.before(controls);else document.body.append(controls);render();
    globalThis.AMOS_USING_DEMO_CLEANUP=()=>{host.detach();program.stop();};
    return{outputs,frames:cases.length,comparedPixels,gameRunning:false};
  },{cases,panel,liveSource});
};
