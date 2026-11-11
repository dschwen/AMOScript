'use strict';
function installGamePortsControls() {
 const app=AMOS_GAME_PAGE,original=AMOS_BROWSER.createCanvasHost;
 let program=null,unsubscribe=null,timer=null,disposed=false;
 const holds=new Map(),buttons=[];
 const section=document.createElement('section');section.id='gameports-simulations';
 section.innerHTML='<h2>Controller inputs</h2><p>Browser gamepads 1 and 2 feed ports 0 and 1. Keyboard arrows and Space/Enter feed port 1; Shift, Y, G, R, F and P supply buttons 1–6. Choose Typing to release keyboard mappings. Escape leaves fullscreen; press it again on the canvas to exit the program.</p><p>The controls below simulate the parallel-port adapter and second mouse; they do not detect physical parallel ports or a second USB mouse. Leave fullscreen to use them. Hold an arrow to move the second mouse. Its buttons share port 1, as on the Amiga.</p>';
 document.getElementById('game-viewport').before(section);
 function clear(){holds.clear();if(timer!=null)clearInterval(timer);timer=null;if(program)for(let port=0;port<2;port++)program.setParallelJoystick(port,0);for(const button of buttons)button.setAttribute('aria-pressed','false');}
 function update(){if(!program||program.state.halted||program.state.stopped){clear();return;}
  for(let port=0;port<2;port++){let mask=0;for(const h of holds.values())if(h.port===port)mask|=h.bit;if((mask&3)===3)mask&=~3;if((mask&12)===12)mask&=~12;program.setParallelJoystick(port,mask);}
  for(const button of buttons)button.setAttribute('aria-pressed',String([...holds.values()].some(h=>h.button===button)));
 }
 function move(){if(!program||program.state.halted||program.state.stopped){clear();return;}let dx=0,dy=0;for(const h of holds.values())if(h.port===-1){dx+=h.dx;dy+=h.dy;}program.moveSecondaryMouse(Math.sign(dx)*16,Math.sign(dy)*16);}
 function group(label,port){const row=document.createElement('p'),title=document.createElement('strong');title.textContent=label+' ';row.append(title);section.append(row);
  for(const [name,bit,dx,dy]of [['Up',1,0,-1],['Down',2,0,1],['Left',4,-1,0],['Right',8,1,0],...(port<0?[]:[['Fire',16,0,0]])]){
   const button=document.createElement('button');button.type='button';button.textContent=name;button.dataset.device=String(port);button.dataset.direction=name.toLowerCase();button.setAttribute('aria-label',label+' '+name);button.setAttribute('aria-pressed','false');button.style.touchAction='none';buttons.push(button);row.append(button);
   button.onpointerdown=event=>{if(!program||program.state.halted||program.state.stopped)return;event.preventDefault();holds.set(event.pointerId,{port,bit,dx,dy,button});update();if(port<0){move();if(timer==null)timer=setInterval(move,20);}};
  }
 }
 group('Parallel port 0',0);group('Parallel port 1',1);group('Second mouse',-1);
 function release(event){if(!holds.delete(event.pointerId))return;update();if(![...holds.values()].some(h=>h.port===-1)&&timer!=null){clearInterval(timer);timer=null;}}
 const wrapper=(...args)=>{const host=original(...args);return{...host,attach(p){clear();if(unsubscribe)unsubscribe();program=p;unsubscribe=p.subscribeInputReset(reason=>{if(reason!=='key-speed')clear();});return host.attach(p);}};};
 AMOS_BROWSER.createCanvasHost=wrapper;
 document.addEventListener('pointerup',release);document.addEventListener('pointercancel',release);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);document.addEventListener('fullscreenchange',clear);
 function dispose(){if(disposed)return;disposed=true;clear();if(unsubscribe)unsubscribe();program=null;document.removeEventListener('pointerup',release);document.removeEventListener('pointercancel',release);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);document.removeEventListener('fullscreenchange',clear);window.removeEventListener('pagehide',dispose);if(AMOS_BROWSER.createCanvasHost===wrapper)AMOS_BROWSER.createCanvasHost=original;section.remove();}
 const previous=app.dispose;app.dispose=()=>{dispose();return previous();};window.addEventListener('pagehide',dispose);
}
module.exports=installGamePortsControls;
