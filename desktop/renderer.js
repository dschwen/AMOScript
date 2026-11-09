'use strict';
const api=window.amosBuilder,$=id=>document.getElementById(id);
let main='',mounts=[],filename=null,dirty=false,busy=false;
const fields=['extensions','title','renderer','port','fire','slowdown','touch','optimize','debug'];
function extensionMappings(){const result={};for(const item of $('extensions').value.split(/[\s,]+/).filter(Boolean)){const match=/^(\d+)=([^=]+)$/.exec(item);if(!match)throw Error('Use extension mappings such as 8=amcaf-1.50beta4');if(Object.hasOwn(result,match[1]))throw Error('Duplicate extension slot: '+match[1]);result[match[1]]=match[2];}return result;}
function project(){return{version:1,main,mounts:mounts.map(m=>({...m})),options:{extensions:extensionMappings(),title:$('title').value,renderer:$('renderer').value,port:Number($('port').value),fire:$('fire').value.split(',').map(k=>k.trim()).filter(Boolean),slowdown:Number($('slowdown').value),touch:$('touch').value,optimize:$('optimize').checked,debug:$('debug').checked}};}
function changed(value=true){dirty=value;api.setDirty(value).catch(showError);$('project-path').textContent=(filename||'Unsaved project')+(dirty?' • modified':'');}
function showError(error){$('error').hidden=false;$('error').textContent=error.message||String(error);$('status').textContent='Check the details below.';}
function setBusy(value){busy=value;for(const control of document.querySelectorAll('button,input,select'))control.disabled=value;}
async function task(fn){if(busy)return;setBusy(true);$('error').hidden=true;try{await fn();}catch(error){showError(error);}finally{setBusy(false);}}
function renderMounts(){const host=$('mounts');host.replaceChildren();mounts.forEach((mount,index)=>{
  const row=document.createElement('div');row.className='mount';
  const label=document.createElement('input');label.value=mount.label;label.placeholder='GAME:';label.setAttribute('aria-label','Disk label '+(index+1));label.addEventListener('input',()=>{mount.label=label.value;changed();});
  const directory=document.createElement('output');directory.textContent=mount.directory;
  const browse=document.createElement('button');browse.textContent='Folder…';browse.setAttribute('aria-label','Change directory '+(index+1));browse.onclick=()=>task(async()=>{const selected=await api.chooseDirectory();if(selected){mount.directory=selected;renderMounts();changed();}});
  const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label','Remove disk '+(index+1));remove.onclick=()=>{mounts.splice(index,1);renderMounts();changed();};row.append(label,directory,browse,remove);host.append(row);
});}
function install(p,file=null){main=p.main||'';mounts=p.mounts.map(m=>({...m}));filename=file;for(const name of fields){const control=$(name),value=p.options[name];if(name==='extensions')control.value=Object.entries(value||{}).map(([slot,library])=>slot+'='+library).join(', ');else if(control.type==='checkbox')control.checked=!!value;else if(name==='fire')control.value=value.join(',');else{if(name==='slowdown'&&![...control.options].some(o=>o.value===String(value))){const o=new Option(Math.round(100/value)+'%',String(value));control.add(o);}control.value=value;}}$('main-path').textContent=main||'No program selected';renderMounts();$('stats').textContent='';$('error').hidden=true;changed(false);$('status').textContent=main?'Project ready. Build a preview or export HTML.':'Choose your main program to get started.';}
function discard(){return!dirty||confirm('Discard unsaved project changes?');}
function stats(value){$('stats').textContent=value.files+' asset files · '+(value.bytes/1024/1024).toFixed(2)+' MiB';}
$('new').onclick=()=>{if(discard())install({main:'',mounts:[],options:{title:'My AMOS game',renderer:'webgl',port:1,fire:['Space','Enter'],slowdown:1,touch:'auto',optimize:false,debug:false}});};
$('open').onclick=()=>{if(discard())task(async()=>{const result=await api.openProject();if(result)install(result.project,result.filename);});};
$('save').onclick=()=>task(async()=>{const result=await api.saveProject(project(),filename);if(result){filename=result;changed(false);$('status').textContent='Project saved.';}});
$('choose-main').onclick=()=>task(async()=>{const result=await api.chooseMain();if(result){main=result;$('main-path').textContent=result;changed();$('status').textContent='Add your asset directories, or build a self-contained program.';}});
$('add-mount').onclick=()=>task(async()=>{const directory=await api.chooseDirectory();if(directory){mounts.push({label:'',directory});renderMounts();changed();}});
for(const name of fields)$(name).addEventListener('input',()=>changed());
$('build').onclick=()=>task(async()=>{$('status').textContent='Compiling and importing assets…';const result=await api.build(project());stats(result);$('status').textContent='Preview opened. Click Play Game in its window.';});
$('export').onclick=()=>task(async()=>{$('status').textContent='Building the standalone page…';const result=await api.exportHTML(project());if(result){stats(result.stats);$('status').textContent='Exported '+result.filename;}else $('status').textContent='Export cancelled.';});
api.onPreviewError(text=>showError(Error(text)));
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&!busy){const action={s:'save',o:'open',n:'new'}[event.key.toLowerCase()];if(action){event.preventDefault();$(action).click();}}});
