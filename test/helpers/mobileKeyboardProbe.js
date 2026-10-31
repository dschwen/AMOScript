'use strict';
module.exports=async function mobileKeyboardProbe(page){
  const {binary,token:t,integer:n,identifier:id,word:w,text}=require('./program'),T=require('../../lib/Transpiler');
  const code=binary([[t('Cls Colour'),n(0)],[t('Print'),text('Device keyboard: type below')],[t('Do'),w(0)],[id('k',6,2),t('='),t('Inkey$')],
    [t('If'),w(0),id('k',6,2),t('<>'),text(''),t('Then'),id('a',6,2),t('='),id('a',6,2),t('+'),id('k',6,2),t(':'),t('Print'),id('k',6,2),t(';')],[t('Wait Vbl')],[t('Loop')]]);
  return page.evaluate(({source,clockSource})=>{
    if(globalThis.AMOS_MOBILE_KEYBOARD_DISPOSE)globalThis.AMOS_MOBILE_KEYBOARD_DISPOSE();
    const check=(v,m)=>{if(!v)throw Error(m);},module={exports:{}};new Function('module',source)(module);
    const root=document.createElement('section'),toolbar=document.createElement('div'),canvas=document.createElement('canvas');root.id='device-keyboard-demo';toolbar.className='amos-fullscreen-toolbar';root.append(toolbar,canvas);document.body.append(root);
    const clock=new Function(`return (${clockSource})(4);`)(),p=module.exports({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){}});
    const host=AMOS_BROWSER.createCanvasHost(canvas,{textInput:{container:root,toolbar},joysticks:[{port:1,keyboard:{fire:['KeyZ','Enter']}}],requestAnimationFrame:()=>1,cancelAnimationFrame(){}});host.attach(p);p.tick(1000);
    let live=null,liveHost=null;
    try{
      const toggle=root.querySelector('.amos-text-keyboard-toggle');toggle.click();let input=root.querySelector('input');
      check(document.activeElement===input,'Device keyboard field did not receive focus');
      const write=(value,composing=false)=>{input.value=value;input.dispatchEvent(new InputEvent('input',{inputType:'insertText',data:value,isComposing:composing,bubbles:true}));clock.tick(100);};
      write('Zä');check(p.state.variables.string_a==='Zä','Text or Latin-1 input differs');
      input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));write('u',true);write('u\u0308',true);
      check(p.state.variables.string_a==='Zä','IME sent an unfinished composition');input.dispatchEvent(new CompositionEvent('compositionend',{data:'ü',bubbles:true}));input.dispatchEvent(new InputEvent('input',{inputType:'insertText',data:'ü',bubbles:true}));clock.tick(100);
      check(p.state.variables.string_a==='Zäü','IME committed more than once');
      input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));clock.tick(100);
      check(p.state.variables.string_a==='Zäü\r','Enter was not sent exactly once');check(p.state.input.scanCode===0x44,'Enter scan-code metadata differs');
      input.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}));clock.tick(100);
      check(p.state.variables.string_a==='Zäü\r\b','Backspace differs');write('ABZ');check(p.state.input.joysticks[1]===0,'Text activated joystick fire');
      p.keySpeed(1,1);check(toggle.getAttribute('aria-expanded')==='true','Key Speed closed text input');
      p.stop();check(toggle.getAttribute('aria-expanded')==='false','Stop left the device keyboard active');write('late');check(p.state.input.keys.length===0,'Stopped text queued for Resume');
      p.resume();toggle.click();write('!');check(p.state.variables.string_a==='Zäü\r\bABZ!','Resume replayed stopped input');
      const old=input;host.detach();check(root.querySelectorAll('.amos-text-keyboard-toggle').length===0,'Detach leaked the widget');
      old.value='stale';old.dispatchEvent(new InputEvent('input',{data:'stale',bubbles:true}));check(p.state.input.keys.length===0,'Detached field sent input');p.stop();
      // Keep a fresh, real-time AMOS program visible for interactive gallery use.
      live=module.exports({print(){}});liveHost=AMOS_BROWSER.createCanvasHost(canvas,{textInput:{container:root,toolbar},joysticks:[{port:1,keyboard:{fire:['KeyZ','Enter']}}]});liveHost.attach(live);live.tick(1000);liveHost.render();
      globalThis.AMOS_MOBILE_KEYBOARD_DISPOSE=()=>{liveHost.detach();if(live)live.stop();root.remove();globalThis.AMOS_MOBILE_KEYBOARD_DISPOSE=null;};
      return {text:'Zäü\r\bABZ!',compositionCommits:1,joystickFire:false,focus:true,lifecycle:true};
    }catch(error){host.detach();if(liveHost)liveHost.detach();p.stop();if(live)live.stop();root.remove();throw error;}
  },{source:new T(code).toModule(),clockSource:require('./fakeTimers').createFakeTimers.toString()});
};
