/* jshint esversion: 6 */
'use strict';

module.exports = async function scancodeProbe(page) {
  const fs=require('fs'),path=require('path'),Transpiler=require('../../lib/Transpiler');
  const {binary,token:t,word:w,integer:n,identifier:id,text}=require('./tokens');
  const source=new Transpiler(binary([[t('Do'),w(0)],[t('Wait Vbl')],[t('Loop')]])).toModule();
  const live=new Transpiler(binary([[t('Key Speed'),n(10),t(','),n(2)],[t('Do'),w(0)],
    [id('key',6,2),t('='),t('Inkey$')],[t('If'),w(0),id('key',6,2),t('<>'),text(''),t('Then'),t('Print'),id('key',6,2),t(','),t('Scancode')],
    [t('Wait Vbl')],[t('Loop')]])).toModule();
  const original=new Transpiler(require('./wonderlandKeyboard')()).toModule();
  const timers=require('./fakeTimers').createFakeTimers.toString();
  const title=fs.readFileSync(path.join(__dirname,'../../examples/Wonderland/Title_Screen.Iff')).toString('base64');
  const golden=fs.readFileSync(path.join(__dirname,'../fixtures/wonderland/title-setup.png')).toString('base64');
  return page.evaluate(async ({source,live,original,timers,title,golden})=>{
    const factory=source=>{const m={exports:{}};new Function('module',source)(m);return m.exports;};
    const makeClock=new Function(`return (${timers});`)(),clock=makeClock();
    const options=c=>({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout});
    const p=factory(source)(options(clock)),canvas=document.createElement('canvas');
    const adapterOptions={...options(clock),hasFocus:()=>true,requestAnimationFrame:()=>1,cancelAnimationFrame(){}};
    const host=AMOS_BROWSER.createCanvasHost(canvas,adapterOptions);host.attach(p);p.tick(100);
    const equal=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(`Scancode differs: ${JSON.stringify(a)} / ${JSON.stringify(b)}`);};
    const event=(surface,type,code,key,extra={})=>surface.dispatchEvent(new KeyboardEvent(type,{code,key,bubbles:true,cancelable:true,...extra}));
    const read=()=>[p.inputValue('Inkey$'),p.inputValue('Scancode'),p.inputValue('Scancode')];
    event(canvas,'keydown','KeyA','A',{shiftKey:true});equal(read(),['A',32,0]);event(canvas,'keyup','KeyA','A');
    const keys=[['Escape','Escape','\x1b',69],['ArrowUp','ArrowUp','\x1e',76],['ArrowDown','ArrowDown','\x1f',77],
      ['ArrowRight','ArrowRight','\x1c',78],['ArrowLeft','ArrowLeft','\x1d',79],['F2','F2','\0',81],['NumpadEnter','Enter','\r',67],['Enter','Enter','\r',68]];
    for(const [code,key,char,scan]of keys){event(canvas,'keydown',code,key);event(canvas,'keyup',code,key);equal(read(),[char,scan,0]);}
    p.keySpeed(10,2);event(canvas,'keydown','KeyB','b');equal(read(),['b',53,0]);event(canvas,'keydown','KeyB','b',{repeat:true});
    clock.tick(199);equal(read(),['',0,0]);clock.tick(1);equal(read(),['b',53,0]);clock.tick(40);equal(read(),['b',53,0]);event(canvas,'keyup','KeyB','b');
    // Empty reads/Clear Key do not clear a consumed latch; keyup does not either.
    event(canvas,'keydown','KeyC','c');equal(p.inputValue('Inkey$'),'c');event(canvas,'keyup','KeyC','c');p.clearKeys();equal(p.inputValue('Inkey$'),'');equal(p.inputValue('Scancode'),51);
    host.configureJoysticks([{port:1,keyboard:true}]);event(canvas,'keydown','ArrowUp','ArrowUp');equal(read(),['',0,0]);equal(p.joystickInfo('Joy',1),1);event(canvas,'keyup','ArrowUp','ArrowUp');
    host.configureJoysticks([{port:1,keyboard:{consume:false}}]);event(canvas,'keydown','ArrowUp','ArrowUp');equal(read(),['\x1e',76,0]);event(canvas,'keyup','ArrowUp','ArrowUp');host.configureJoysticks([]);
    let lifecycleChecks=0;
    const latch=()=>{event(canvas,'keydown','Escape','Escape');equal(p.inputValue('Inkey$'),'\x1b');};
    latch();canvas.dispatchEvent(new Event('blur'));equal(p.inputValue('Scancode'),0);lifecycleChecks++;
    latch();window.dispatchEvent(new Event('blur'));equal(p.inputValue('Scancode'),0);window.dispatchEvent(new Event('focus'));lifecycleChecks++;
    latch();const hidden=Object.getOwnPropertyDescriptor(document,'hidden');
    try{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));equal(p.inputValue('Scancode'),0);}
    finally{if(hidden)Object.defineProperty(document,'hidden',hidden);else delete document.hidden;}lifecycleChecks++;
    latch();event(canvas,'keydown','KeyC','c',{ctrlKey:true});equal(p.inputValue('Scancode'),0);lifecycleChecks++;
    latch();p.stop();equal(p.inputValue('Scancode'),0);event(canvas,'keydown','KeyA','a');equal(read(),['',0,0]);p.resume();clock.tick(0);lifecycleChecks++;
    event(canvas,'keydown','Escape','Escape');host.detach();equal(read(),['\x1b',0,0]);host.attach(p);lifecycleChecks++;
    event(canvas,'keydown','KeyA','a',{isComposing:true});event(canvas,'keydown','Quote','Dead');event(canvas,'keydown','KeyA','\u0100');equal(read(),['',0,0]);
    event(canvas,'keydown','constructor','v');event(canvas,'keyup','constructor','v');equal(read(),['v',0,0]);
    let heldChecks=0;
    canvas.dispatchEvent(new Event('blur'));p.clearKeys();p.clearScanCodes();
    event(canvas,'keydown','Help','Help');equal(p.keyState(95),-1);equal(p.keyState(95),-1);equal(p.inputValue('Inkey$'),'\0');equal(p.inputValue('Scancode'),95);event(canvas,'keyup','Help','Help');equal(p.keyState(95),0);heldChecks++;
    event(canvas,'keydown','KeyA','a');event(canvas,'keydown','KeyB','b');equal([p.keyState(32),p.keyState(53)],[-1,-1]);event(canvas,'keyup','KeyB','b');equal([p.keyState(32),p.keyState(53)],[-1,0]);heldChecks++;
    p.clearKeys();p.clearScanCodes();p.keySpeed(1,1);equal(p.keyState(32),-1);event(canvas,'keyup','KeyA','a');equal(p.keyState(32),0);heldChecks++;
    host.configureJoysticks([{port:1,keyboard:true}]);event(canvas,'keydown','ArrowUp','ArrowUp');equal([p.keyState(76),p.joystickInfo('Joy',1)],[-1,1]);event(canvas,'keyup','ArrowUp','ArrowUp');equal([p.keyState(76),p.joystickInfo('Joy',1)],[0,0]);host.configureJoysticks([]);heldChecks++;
    event(canvas,'keydown','Help','Help');canvas.dispatchEvent(new Event('blur'));event(canvas,'keydown','Help','Help',{repeat:true});equal(p.keyState(95),0);heldChecks++;
    event(canvas,'keydown','Help','Help');p.stop();equal(p.keyState(95),0);p.resume();clock.tick(0);equal(p.keyState(95),0);heldChecks++;
    p.setKeyState(127,true);event(canvas,'keydown','Help','Help');host.detach();equal([p.keyState(95),p.keyState(127)],[0,-1]);heldChecks++;
    p.stop();equal(clock.pending(),0);

    const image=new Image();image.src=`data:image/png;base64,${golden}`;await image.decode();
    const reference=document.createElement('canvas');reference.width=image.width;reference.height=image.height;reference.getContext('2d').drawImage(image,0,0);
    const titlePixels=reference.getContext('2d').getImageData(0,0,image.width,image.height).data;
    const createOriginal=factory(original),routes=[];
    for(const [code,key,char,scan]of [...keys.slice(0,5),['KeyA','A','A',32]]) {
      const c=makeClock(),program=createOriginal({...options(c),files:{read:name=>{if(!name.endsWith('/Title_Screen.Iff'))throw new Error('Unexpected original path');return atob(title);}}});
      const surface=document.createElement('canvas'),adapter=AMOS_BROWSER.createCanvasHost(surface,{...options(c),requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
      try {
        adapter.attach(program);program.tick(1000);event(surface,'keydown',code,key);event(surface,'keyup',code,key);c.tick(40);adapter.render();
        const route=code==='Escape'?2:1;equal(program.state.variables.int_route,route);equal(program.state.variables.int_scod,scan);
        equal(program.state.variables.string_i,char.toLowerCase());equal(program.display.screens.size,route===2?1:2);
        const rgba=surface.getContext('2d').getImageData(0,0,surface.width,surface.height).data;
        if(route===2) {
          for(let i=0;i<rgba.length;i++){const pixel=Math.floor(i/4),y=Math.floor(pixel/320),x=pixel%320;
            if(rgba[i]!==titlePixels[(y*640+x*2)*4+i%4])throw new Error('Escape title differs from independent golden');}
        }else{program.display.text(8,16,`${code}: Scancode ${scan}`);adapter.render();}
        if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:route===2?'Wonderland Escape to original title':`Original key read: ${code}`,width:surface.width,height:surface.height,
          rgba:surface.getContext('2d').getImageData(0,0,surface.width,surface.height).data});
        routes.push({scan,route});equal(c.pending(),0);
      }finally{adapter.detach();program.stop();}
    }

    if(globalThis.AMOS_SCANCODE_DEMO_CLEANUP)globalThis.AMOS_SCANCODE_DEMO_CLEANUP();
    const old=document.getElementById('scan-controls');if(old)old.remove();
    const controls=document.createElement('section');controls.id='scan-controls';controls.dataset.status='running';
    const heading=document.createElement('h2');heading.textContent='Live keyboard scan codes';
    const help=document.createElement('p');help.textContent='Focus this canvas, then press letters, arrows or Escape. The compiled AMOS loop reads Inkey$ and Scancode; held keys repeat after 200 ms, then every 40 ms. Key State below reports held physical raw keys independently of text and Scancode.';
    const surface=document.createElement('canvas');surface.id='scan-input';surface.tabIndex=0;surface.style.cssText='border:2px solid #8ba;max-width:100%';
    const heldStatus=document.createElement('p');heldStatus.id='scan-held';
    const status=document.createElement('pre');status.id='scan-log';status.dataset.scan='0';status.dataset.count='0';
    const program=factory(live)({setTimeout,clearTimeout,now:()=>performance.now(),print:(key,scan)=>{
      status.dataset.scan=String(scan);status.dataset.count=String(Number(status.dataset.count)+1);status.textContent=`Inkey$: ${JSON.stringify(key)}\nScancode: ${scan} ($${scan.toString(16)})`;
    }}),adapter=AMOS_BROWSER.createCanvasHost(surface);adapter.attach(program);program.tick(100);
    const showHeld=()=>{const codes=Array.from(program.state.input.rawKeys).flatMap((value,code)=>value?[code]:[]);heldStatus.textContent=`Held raw keys: ${codes.join(', ')||'none'}`;heldStatus.dataset.help=String(program.keyState(95));};
    for(const name of ['keydown','keyup','blur'])surface.addEventListener(name,showHeld);
    const unsubscribeHeld=program.subscribeInputReset(showHeld);window.addEventListener('blur',showHeld);showHeld();
    controls.append(heading,help,surface,status,heldStatus);
    for(const action of ['stop','resume','clear']){const button=document.createElement('button');button.id=`scan-${action}`;button.textContent=action;
      button.addEventListener('click',()=>{if(action==='stop'){program.stop();controls.dataset.status='stopped';}
        else if(action==='resume'){program.resume();controls.dataset.status='running';adapter.focus();}
        else{program.clearKeys();program.clearScanCodes();status.dataset.scan='0';status.textContent='Input cleared.';adapter.focus();}});controls.append(button);}
    const results=document.getElementById('results');if(results)results.before(controls);else document.body.append(controls);
    globalThis.AMOS_SCANCODE_DEMO_CLEANUP=()=>{unsubscribeHeld();window.removeEventListener('blur',showHeld);adapter.detach();program.stop();};
    return {heldChecks,routes,keyChecks:keys.length+1,repeatScans:[53,53,53],lifecycleChecks,timersRemaining:clock.pending(),titleExact:true,gameRunning:false};
  },{source,live,original,timers,title,golden});
};
