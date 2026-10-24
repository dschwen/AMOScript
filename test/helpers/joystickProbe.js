/* jshint esversion: 6 */
'use strict';

module.exports = async function joystickProbe(page) {
  const fs = require('fs'), path = require('path'), Transpiler = require('../../lib/Transpiler');
  const { binary, token: t } = require('./tokens');
  const idle = new Transpiler(binary([[t('Wait Key')]])).toModule();
  const menu = new Transpiler(require('./wonderlandMenu')()).toModule();
  const assets = Object.fromEntries(['Title_Screen.Iff','Wonderland_Samples.Abk'].map(name => [name,
    fs.readFileSync(path.join(__dirname,'../../examples/Wonderland',name)).toString('base64')]));
  const timers = require('./fakeTimers').createFakeTimers.toString();
  return page.evaluate(({ idle, menu, assets, timers }) => {
    const factory = source => { const m = {exports:{}}; new Function('module',source)(m); return m.exports; };
    const create = factory(idle), createMenu = factory(menu), makeClock = new Function(`return (${timers});`)();
    const pad = (axes=[0,0], pressed=[], mapping='standard') => ({connected:true,mapping,axes,
      buttons:Array.from({length:16},(_,i)=>({pressed:pressed.includes(i)}))});
    const equal = (a,b) => {if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error(`Joystick mismatch: ${JSON.stringify(a)} / ${JSON.stringify(b)}`);};
    const key = (canvas,type,code,repeat=false) => canvas.dispatchEvent(new KeyboardEvent(type,{code,key:code==='Space'?' ':code,repeat,bubbles:true,cancelable:true}));
    const clock = makeClock(), p = create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
    p.tick(10);
    let pads=[null,pad([0.8,-0.9],[0])], blocked=false, focused=true, polls=0, frames=0;
    const canvas=document.createElement('canvas'), host=AMOS_BROWSER.createCanvasHost(canvas,{
      hasFocus:()=>focused,getGamepads(){polls++;if(blocked) throw new DOMException('Denied','SecurityError');return pads;},
      requestAnimationFrame:()=>{frames++;return 1;},cancelAnimationFrame(){},
      joysticks:[{port:1,keyboard:true,gamepad:{index:1,deadZone:0.3}}]
    });
    host.attach(p); equal(p.joystickInfo('Joy',1),25); equal(frames,0);
    key(canvas,'keydown','ArrowDown');equal(p.joystickInfo('Joy',1),24);equal(p.state.input.keys.length,0);
    pads=[];equal(p.joystickInfo('Joy',1),2);equal(host.joystickStatus()[0].status,'waiting');
    key(canvas,'keyup','ArrowDown');equal(p.joystickInfo('Joy',1),0);
    host.configureJoysticks([{port:1,keyboard:{up:'KeyW',fire:'KeyZ'},gamepad:true}]);
    pads=[pad([1,0],[],'')];key(canvas,'keydown','KeyW');equal(p.joystickInfo('Joy',1),1);
    equal(host.joystickStatus()[0].status,'unmapped');
    blocked=true;equal(p.joystickInfo('Joy',1),1);equal(host.joystickStatus()[0].status,'blocked');
    focused=false;canvas.dispatchEvent(new Event('blur'));equal(p.joystickInfo('Joy',1),0);
    focused=true;key(canvas,'keydown','KeyW');equal(p.joystickInfo('Joy',1),1);
    p.stop();equal(p.joystickInfo('Joy',1),0);p.resume();key(canvas,'keydown','KeyW',true);equal(p.joystickInfo('Joy',1),0);
    key(canvas,'keydown','KeyW');equal(p.joystickInfo('Joy',1),1);
    host.configureJoysticks([]);p.setJoystick(1,8);equal(p.joystickInfo('Joy',1),8);host.detach();p.stop();
    const native=create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
    const nativeHost=AMOS_BROWSER.createCanvasHost(canvas,{hasFocus:()=>true,joysticks:[{port:1,gamepad:true}]});
    nativeHost.attach(native);native.joystickInfo('Joy',1);
    const nativeStatus=nativeHost.joystickStatus()[0].status;
    if(!['waiting','unavailable','blocked','connected','unmapped'].includes(nativeStatus)) throw new Error('Native Gamepad API probe failed');
    nativeHost.detach();native.stop();

    function setup(mode) {
      const c=makeClock(), device={value:pad()}, program=createMenu({now:c.now,
        setTimeout:(fn,ms)=>c.setTimeout(fn,Math.max(1,ms)),clearTimeout:c.clearTimeout,
        files:{read:name=>atob(assets[name.split('/').pop()])}});
      const surface=document.createElement('canvas');
      const adapter=AMOS_BROWSER.createCanvasHost(surface,{hasFocus:()=>true,getGamepads:()=>[device.value],
        requestAnimationFrame:()=>1,cancelAnimationFrame(){},
        joysticks:[{port:1,keyboard:mode==='keyboard',gamepad:mode==='gamepad'}]});
      adapter.attach(program);program.tick(100000);program.tick(500);c.tick(20);
      const capture=name=>{adapter.render();if(globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({name,width:320,height:256,
        rgba:surface.getContext('2d').getImageData(0,0,320,256).data});};
      return {c,device,program,surface,adapter,capture};
    }
    const selections=[];let animatedMoves=0;
    for(const mode of ['keyboard','gamepad']) {
      const s=setup(mode), {program,adapter,surface,device,c}=s;
      const set=action=>{
        if(mode==='keyboard') key(surface,'keydown',action==='down'?'ArrowDown':action==='up'?'ArrowUp':'Space');
        else device.value=pad([0,action==='down'?1:action==='up'?-1:0],action==='fire'?[0]:[]);
      };
      const release=action=>{if(mode==='keyboard') key(surface,'keyup',action==='down'?'ArrowDown':action==='up'?'ArrowUp':'Space');else device.value=pad();};
      const move=action=>{set(action);program.tick(500);release(action);c.tick(500);animatedMoves++;};
      s.capture(`Original menu (${mode})`);move('down');equal(program.state.variables.int_p,25);equal(program.bobInfo('Y Bob',0),117);
      if(mode==='keyboard') {
        move('down');equal(program.state.variables.int_p,50);set('fire');program.tick(500);release('fire');program.tick(500);
        equal(program.state.variables.int_bgon,0);equal(program.bobInfo('I Bob',1),75);s.capture('Original background toggle');
        move('up');move('up');equal(program.state.variables.int_p,0);
      }
      s.capture(`Original menu selection (${mode})`);set('fire');program.tick(500);
      equal(program.state.halted,true);equal(c.pending(),0);
      selections.push(program.state.variables.int_game);adapter.detach();
    }

    if(globalThis.AMOS_MENU_DEMO_CLEANUP) globalThis.AMOS_MENU_DEMO_CLEANUP();
    const old=document.getElementById('menu-controls');if(old) old.remove();
    const controls=document.createElement('section');controls.id='menu-controls';
    const heading=document.createElement('h2');heading.textContent='Interactive original menu';
    const help=document.createElement('p');help.textContent='Focus the live canvas below, then move and fire. For a gamepad, press a controller button after focusing. Selection stops before gameplay/editor; Restart lets you choose again.';
    const mode=document.createElement('select');mode.id='menu-input-mode';
    for(const value of ['keyboard','gamepad','both']) {const option=document.createElement('option');option.value=value;option.textContent=value;mode.append(option);}
    const layout=document.createElement('select');layout.id='menu-keyboard-layout';
    for(const [value,label] of [['arrows','Arrows + Space/Enter'],['wasd','WASD + Z']]) {const o=document.createElement('option');o.value=value;o.textContent=label;layout.append(o);}
    const index=document.createElement('input');index.type='number';index.min='0';index.step='1';index.value='0';index.id='menu-gamepad-index';index.setAttribute('aria-label','Gamepad index');
    const dead=document.createElement('input');dead.type='range';dead.min='0';dead.max='0.9';dead.step='0.05';dead.value='0.25';dead.id='menu-dead-zone';dead.setAttribute('aria-label','Gamepad dead zone');
    const liveCanvas=document.createElement('canvas');liveCanvas.id='menu-input';liveCanvas.tabIndex=0;liveCanvas.style.cssText='border:2px solid #7ba;image-rendering:pixelated;width:640px;max-width:100%';
    const status=document.createElement('p');status.id='menu-status';let live=null,liveHost=null;
    function configuration() {return [{port:1,keyboard:mode.value==='gamepad'?false:layout.value==='wasd'?{up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',fire:'KeyZ'}:true,
      gamepad:mode.value==='keyboard'?false:{index:Number(index.value),deadZone:Number(dead.value)}}];}
    function update() {
      if(!live) return;
      const pads=liveHost.pollJoysticks(), choice=live.state.variables.int_game;
      controls.dataset.position=String(live.state.variables.int_p);controls.dataset.selected=String(choice);
      status.textContent=live.state.halted?`Selected ${choice===1?'Start Game':'Level Editor'}. This fixture stops before that mode; use Restart.`:
        live.state.stopped?'Stopped. Resume or Restart.':`Position ${live.state.variables.int_p}/50. ${pads.map(p=>`Gamepad: ${p.status}`).join(' ')}`;
    }
    function start() {
      const bindings=configuration();AMOS_BROWSER.createJoystickInput(bindings);
      if(liveHost) liveHost.detach();if(live) live.stop();
      live=createMenu({setTimeout,clearTimeout,now:()=>performance.now(),files:{read:name=>atob(assets[name.split('/').pop()])}});
      liveHost=AMOS_BROWSER.createCanvasHost(liveCanvas,{joysticks:bindings});liveHost.attach(live);
      live.tick(100000);live.tick(500);update();
    }
    const label=(text,control)=>{const item=document.createElement('label');item.append(`${text} `,control);return item;};
    controls.append(heading,help,label('Input',mode),label('Keyboard',layout),label('Controller',index),label('Dead zone',dead),liveCanvas,status);
    for(const input of [mode,layout,index,dead]) input.addEventListener('change',()=>{
      try{liveHost.configureJoysticks(configuration());liveHost.focus();update();}catch(error){status.textContent=error.message;}
    });
    for(const action of ['restart','stop','resume']) {const button=document.createElement('button');button.id=`menu-${action}`;button.textContent=action;
      button.addEventListener('click',()=>{try{if(action==='restart') start();else if(action==='stop') live.stop();else live.resume();liveHost.focus();update();}catch(error){status.textContent=error.message;}});controls.append(button);}
    const results=document.getElementById('results');if(results) results.before(controls);else document.body.append(controls);start();
    const monitor=setInterval(update,100);
    globalThis.AMOS_MENU_DEMO_CLEANUP=()=>{clearInterval(monitor);liveHost.detach();live.stop();};
    return {selections,backendChecks:12,animatedMoves,nativeGamepadStatus:nativeStatus,polledWithoutAnimation:polls>0,gameRunning:false,
      evidence:'Original menu line bytes/routines with explicit End before unsupported dispatch; injected gamepad records and native API probe, not a physical-controller or Amiga capture.'};
  },{idle,menu,assets,timers});
};
