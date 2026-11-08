/* jshint esversion: 6 */
'use strict';

// Own fullscreen for a stable container, independently of rendering and VM time.
function createFullscreenHost(container, options = {}) {
  const doc=container.ownerDocument, win=doc.defaultView, button=options.button;
  const surface=options.surface||container;
  const content=options.getContent||(()=>surface.querySelector('canvas,img'));
  const supported=typeof container.requestFullscreen==='function'&&typeof doc.exitFullscreen==='function'&&doc.fullscreenEnabled!==false;
  let disposed=false,pending=false,error=null,current=null,saved=null,transition=null,closing=null;
  const active=()=>doc.fullscreenElement===container;
  if(!supported){
    if(button){button.textContent='Fullscreen';button.disabled=true;button.setAttribute('aria-pressed','false');}
    if(options.statusElement)options.statusElement.textContent='Fullscreen is unavailable in this browser or frame.';
    return {toggle:()=>Promise.resolve(false),refresh(){},dispose(){disposed=true;return Promise.resolve();},status:()=>({active:false,supported:false,pending:false,error:null,disposed})};
  }

  const style=doc.createElement('style');
  style.textContent=`
.amos-fullscreen:fullscreen{position:relative;display:block;box-sizing:border-box;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;gap:0;border:0!important;border-radius:0!important;overflow:hidden;background:#000;color:#fff}
.amos-fullscreen:fullscreen>.amos-fullscreen-toolbar{position:absolute;z-index:20;top:env(safe-area-inset-top,0px);left:50%;transform:translateX(-50%);box-sizing:border-box;width:max-content;max-width:100%;font:14px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px;padding:6px 10px!important;margin:0;background:rgba(20,25,32,.94);border:0;border-radius:0 0 10px 10px;visibility:hidden;pointer-events:none}
.amos-fullscreen.amos-controls-visible:fullscreen>.amos-fullscreen-toolbar{visibility:visible;pointer-events:auto}
@media (pointer:coarse) and (orientation:portrait){.amos-fullscreen:fullscreen>.amos-fullscreen-toolbar{visibility:visible;pointer-events:auto}}
.amos-fullscreen:fullscreen>.amos-fullscreen-messages{position:absolute;z-index:19;bottom:0;left:0;right:0;max-height:40%;overflow:auto;font-size:14px;background:rgba(0,0,0,.85)}
.amos-fullscreen-messages>p{margin:4px 0}
.amos-fullscreen:fullscreen>.amos-fullscreen-surface{position:absolute;inset:0;min-width:0;min-height:0;width:100%;height:100%;margin:0;padding:0;border:0!important;border-radius:0!important;max-height:none!important;overflow:hidden!important;display:flex;align-items:center;justify-content:center;background:#000}
.amos-fullscreen:fullscreen>.amos-fullscreen-surface>canvas,.amos-fullscreen:fullscreen>.amos-fullscreen-surface>img{flex:none;min-width:0!important;max-width:none!important;max-height:none!important;border:0!important;border-radius:0!important;image-rendering:pixelated}`;
  doc.head.appendChild(style);container.classList.add('amos-fullscreen');surface.classList.add('amos-fullscreen-surface');
  function restore(){if(current&&saved){current.style.width=saved.width;current.style.height=saved.height;}current=null;saved=null;}
  function refresh(){
    const next=content();
    if(!active()||disposed||next!==current)restore();
    if(active()&&!disposed&&next){
      if(!current){current=next;saved={width:next.style.width,height:next.style.height};}
      const width=next.naturalWidth||next.width,height=next.naturalHeight||next.height;
      const borderX=Math.max(0,next.offsetWidth-next.clientWidth),borderY=Math.max(0,next.offsetHeight-next.clientHeight);
      const scale=Math.min((surface.clientWidth-borderX)/width,(surface.clientHeight-borderY)/height);
      if(width>0&&height>0&&scale>0){const w=`${Math.max(1,Math.floor(width*scale))}px`,h=`${Math.max(1,Math.floor(height*scale))}px`;if(next.style.width!==w)next.style.width=w;if(next.style.height!==h)next.style.height=h;}
    }
    if(button){button.textContent=active()?'Exit fullscreen':'Fullscreen';button.setAttribute('aria-pressed',String(active()));button.disabled=!supported||pending||disposed;}
    if(options.statusElement)options.statusElement.textContent=error?`Fullscreen unavailable: ${error}`:!supported?'Fullscreen is unavailable in this browser or frame.':'';
  }
  function toggle(){
    if(disposed||pending||!supported)return Promise.resolve(false);
    pending=true;error=null;refresh();
    let operation;
    try{operation=active()?doc.exitFullscreen():container.requestFullscreen();}
    catch(failure){error=failure.message;pending=false;refresh();return Promise.resolve(false);}
    transition=Promise.resolve(operation).then(async()=>{
      if(disposed&&active())await doc.exitFullscreen();
      return !disposed;
    }).catch(failure=>{error=failure.message;return false;}).finally(()=>{pending=false;refresh();});
    return transition;
  }
  let previousActive=active();
  function changed(){controls(false);refresh();const entered=active();if(entered!==previousActive){previousActive=entered;if(!disposed&&options.onChange)options.onChange(entered);}}
  function controls(show){container.classList[show?'add':'remove']('amos-controls-visible');}
  function pointer(event){
    if(!active()||event.pointerType==='touch')return;
    const rect=container.getBoundingClientRect(),toolbar=container.querySelector('.amos-fullscreen-toolbar');
    if(event.clientY-rect.top<=12)controls(true);
    else if(!toolbar||!toolbar.contains(event.target))controls(false);
  }
  function leave(){controls(false);}
  function keyboard(event){if(active()&&event.key==='Tab')controls(true);}
  function escape(event){if(active()&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();toggle();}}
  container.addEventListener('pointermove',pointer);container.addEventListener('pointerleave',leave);
  doc.addEventListener('keydown',keyboard);
  if(button)button.addEventListener('click',toggle);
  doc.addEventListener('fullscreenchange',changed);doc.addEventListener('keydown',escape,true);
  function resized(){controls(false);refresh();}
  if(win)win.addEventListener('resize',resized);surface.addEventListener('load',refresh,true);
  const resize=win&&win.ResizeObserver?new win.ResizeObserver(refresh):null;if(resize)resize.observe(surface);
  const mutation=win&&win.MutationObserver?new win.MutationObserver(refresh):null;
  if(mutation)mutation.observe(surface,{childList:true,subtree:true,attributes:true,attributeFilter:['width','height','src','style']});
  refresh();
  function dispose(){
    if(disposed)return closing||Promise.resolve();disposed=true;
    if(button)button.removeEventListener('click',toggle);
    doc.removeEventListener('fullscreenchange',changed);doc.removeEventListener('keydown',escape,true);
    if(win)win.removeEventListener('resize',resized);surface.removeEventListener('load',refresh,true);if(resize)resize.disconnect();if(mutation)mutation.disconnect();
    container.removeEventListener('pointermove',pointer);container.removeEventListener('pointerleave',leave);doc.removeEventListener('keydown',keyboard);controls(false);
    restore();style.remove();container.classList.remove('amos-fullscreen');surface.classList.remove('amos-fullscreen-surface');
    let exit;try{exit=active()?doc.exitFullscreen():null;}catch(failure){error=failure.message;}
    closing=Promise.allSettled([transition,exit]).then(()=>{refresh();});return closing;
  }
  return {toggle,refresh,dispose,status:()=>({active:active(),supported,pending,error,disposed})};
}

if(typeof module==='object'&&module.exports)module.exports={createFullscreenHost};
else globalThis.AMOS_FULLSCREEN={createFullscreenHost};
