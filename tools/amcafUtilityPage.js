'use strict';
// Uploads complete before preparing synchronous Fsel$ answers. No modal/Promise
// enters the AMOS VM. Downloads contain the bytes actually written by the source.
function installUtility(kind,prepared) {
 const app=AMOS_GAME_PAGE,play=document.getElementById('play-game'),restart=document.getElementById('game-restart');
 const section=document.createElement('section');section.id='utility-files';
 section.innerHTML='<h2>Input and output files</h2><p>Choose a file before starting, or try the declared synthetic sample. For the sample-bank fixer, press Space after each sample. Downloads appear after the program finishes.</p><label>Input file <input id="utility-upload" type="file"></label> <button id="utility-sample">Use sample</button> <label id="utility-base-label">Output base name <input id="utility-base" value="converted"></label><p id="utility-message" role="status"></p><div id="utility-downloads"></div>';
 document.getElementById('game-viewport').before(section);
 const upload=section.querySelector('input[type=file]'),base=section.querySelector('#utility-base'),message=section.querySelector('#utility-message'),downloads=section.querySelector('#utility-downloads');
 upload.accept=kind==='iff'?'.iff,.ilbm':'.abk';section.querySelector('#utility-base-label').hidden=kind!=='iff';
 let selected=null,initial='',urls=[],disposed=false,generation=0,last='',outputBase='',activeRun=false;
 const revoke=()=>{urls.forEach(url=>URL.revokeObjectURL(url));urls=[];downloads.replaceChildren();};
 function choose(name,bytes){if(disposed)return;activeRun=false;selected=name.toLowerCase();initial=bytes;app.files.write(selected,bytes);message.textContent='Ready: '+name+'. Click Play Game.';play.disabled=false;revoke();last='';}
 play.disabled=true;
 section.querySelector('#utility-sample').onclick=()=>{generation++;choose(prepared.name,atob(prepared.data));};
 upload.onchange=async()=>{const file=upload.files[0],token=++generation;if(!file)return;play.disabled=true;message.textContent='Reading input…';try{const bytes=new Uint8Array(await file.arrayBuffer());if(token!==generation||disposed)return;let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));choose(file.name,text);}catch(error){message.textContent=error.message;}};
 function prepare(event){if(!selected){event.stopImmediatePropagation();message.textContent='Choose an input file first.';return;}if(kind==='iff'&&!base.value.trim()){event.stopImmediatePropagation();message.textContent='Enter an output base name.';return;}upload.disabled=base.disabled=section.querySelector('#utility-sample').disabled=true;activeRun=true;outputBase=base.value.trim();app.files.write(selected,initial);app.files.replaceSelections([selected,kind==='iff'?outputBase:'']);}
 // Repeat Play while running retains the VM and must not alter its pending choices.
 function beforePlay(event){if(['idle','ended','error'].includes(document.getElementById('game-viewport').dataset.phase))prepare(event);}
 play.addEventListener('click',beforePlay,true);restart.addEventListener('click',prepare,true);
 const timer=setInterval(()=>{const phase=document.getElementById('game-viewport').dataset.phase,busy=['running','stopped'].includes(phase);upload.disabled=base.disabled=section.querySelector('#utility-sample').disabled=busy;if(phase!=='ended'||!selected||!activeRun)return;const names=kind==='iff'?[outputBase+'.col',outputBase+'.raw']:[selected];
  const entries=names.map(name=>[name,app.files.snapshot()[name.toLowerCase()]]).filter(([,bytes])=>typeof bytes==='string');const signature=JSON.stringify(entries);if(signature===last)return;last=signature;revoke();for(const[name,bytes]of entries){const url=URL.createObjectURL(new Blob([Uint8Array.from(bytes,c=>c.charCodeAt(0))],{type:'application/octet-stream'}));urls.push(url);const a=document.createElement('a');a.href=url;a.download=name;a.textContent='Download '+name;a.style.marginRight='1rem';downloads.append(a);}message.textContent=entries.length?'Finished. Download the generated files below.':'No output files were written.';
 },100);
 function dispose(){if(disposed)return;disposed=true;generation++;clearInterval(timer);revoke();play.removeEventListener('click',beforePlay,true);restart.removeEventListener('click',prepare,true);upload.onchange=null;section.querySelector('#utility-sample').onclick=null;window.removeEventListener('pagehide',dispose);}
 const previous=app.dispose;app.dispose=()=>{dispose();return previous();};window.addEventListener('pagehide',dispose);
}
module.exports=installUtility;
