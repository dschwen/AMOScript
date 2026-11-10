'use strict';
module.exports=async function smouseKeyProbe(page){
  const{binary,token:t,word:w,identifier:id}=require('./tokens');
  const source=new(require('../../lib/Transpiler'))(binary([
    [t('Print'),require('./tokens').text('Shift: second fire; X: third fire')],
    [t('Do'),w(0)],[id('buttons'),t('='),w(0x4e),[8,0],w(0x158c)],[t('Wait Vbl')],[t('Loop')]
  ]),{extensions:{8:'amcaf-1.50beta4'}}).toModule();
  return page.evaluate(({source,browserSource})=>{
    const module={exports:{}};new Function('module',source)(module);
    const createHost=new Function(`${browserSource};return createCanvasHost;`)();
    if(globalThis.AMOS_SMOUSE_CLEANUP)globalThis.AMOS_SMOUSE_CLEANUP();document.getElementById('smouse-controls')?.remove();
    const controls=document.createElement('section');controls.id='smouse-controls';
    const canvas=document.createElement('canvas');canvas.id='smouse-input';canvas.tabIndex=0;canvas.setAttribute('aria-label','Three-button joystick input');
    const status=document.createElement('pre');status.id='smouse-status';
    let live=null,host=null,disposed=false,typing=false;
    const mapping=()=>[{port:1,keyboard:typing?false:{fire2:['ShiftLeft','ShiftRight'],fire3:['KeyX']},gamepad:{buttons:{fire2:1,fire3:2}}}];
    function refresh(){
      if(!live)return;const buttons=live.extensionSmouseKey(),joy=live.joystickInfo('Joy',1),mouse=live.inputValue('Mouse Key');
      status.dataset.buttons=String(buttons);status.dataset.joy=String(joy);status.dataset.mouse=String(mouse);
      status.dataset.compiled=String(live.state.variables.int_buttons||0);status.dataset.stopped=String(live.state.stopped);
      status.textContent=`Smouse Key (port 1): ${buttons}\nJoy(1): ${joy}\nMain Mouse Key: ${mouse}\nLast compiled query: ${status.dataset.compiled}\nKeyboard: ${typing?'Typing':'Joystick'}; ${live.state.stopped?'stopped':'running'}\nShift = secondary; X = third; Space/Enter = primary; standard gamepad face buttons 0/1/2.`;
    }
    function start(){if(host)host.detach();if(live)live.stop();live=module.exports();host=createHost(canvas,{joysticks:mapping(),requestAnimationFrame:()=>1,cancelAnimationFrame(){}});host.attach(live);live.tick(100);host.render();host.focus();refresh();}
    for(const[id,label,fn]of[
      ['stop','Stop',()=>live.stop()],['resume','Resume',()=>live.resume()],['restart','Restart',start],
      ['typing','Toggle typing mode',()=>{typing=!typing;host.configureJoysticks(mapping());}],
      ['speed','Key Speed',()=>live.keySpeed(10,2)]
    ]){const b=document.createElement('button');b.id='smouse-'+id;b.textContent=label;b.onclick=()=>{if(!disposed){fn();host.focus();refresh();}};controls.append(b);}
    controls.append(canvas,status);document.body.append(controls);start();
    // Separate literal button checks leave the live VM/input state untouched.
    const check=module.exports();check.setMouse(0,0,7);check.setPortButtons(1,6);check.setJoystick(1,16);
    const actual=[check.extensionSmouseKey(),check.joystickInfo('Joy',1),check.inputValue('Mouse Key')];
    if(JSON.stringify(actual)!=='[7,16,7]')throw Error('Second-port bit mapping differs');check.stop();
    const monitor=setInterval(refresh,25);
    const cleanup=()=>{if(disposed)return;disposed=true;clearInterval(monitor);host.detach();live.stop();window.removeEventListener('pagehide',cleanup);};
    window.addEventListener('pagehide',cleanup);globalThis.AMOS_SMOUSE_CLEANUP=cleanup;
    return{buttons:actual[0],joy:actual[1],mainMouse:actual[2],device:'second mouse/joystick port; no native hardware capture'};
  },{source,browserSource:require('fs').readFileSync(require('path').join(__dirname,'../../lib/amos/browser.js'),'utf8')});
};
