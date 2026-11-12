'use strict';
// Prepared browser walkthrough of the desktop form. Native dialogs and IPC
// isolation are covered separately by test/desktop-smoke.js.
module.exports=async function projectBuilderProbe(page){
  const fs=require('fs'),path=require('path'),os=require('os'),backend=require('../../tools/project'),root=path.join(__dirname,'../..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'AMOScript builder demo '));
  let preview,exported,stats;
  try{fs.writeFileSync(path.join(temp,'sample.dat'),Buffer.from([0,128,255]));const p={version:1,main:path.join(root,'examples/Graphics.AMOS'),mounts:[{label:'GAME:',directory:temp}],options:{title:'Prepared builder example',touch:'off'}};const result=backend.buildProject(p,{preview:true});preview=result.html;stats=result.stats;exported=backend.buildProject(p).html;}finally{fs.rmSync(temp,{recursive:true,force:true});}
  let ui=fs.readFileSync(path.join(root,'desktop/index.html'),'utf8').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,'');
  ui=ui.replace('<link rel="stylesheet" href="style.css">','<style>'+fs.readFileSync(path.join(root,'desktop/style.css'),'utf8')+'</style>').replace('<script src="renderer.js"></script>','<script>window.amosBuilder=parent.AMOS_BUILDER_DEMO_API;</script><script>'+fs.readFileSync(path.join(root,'desktop/renderer.js'),'utf8').replace(/<\/script/gi,'<\\/script')+'</script>');
  return page.evaluate(async({ui,preview,exported,stats})=>{
    if(globalThis.AMOS_PROJECT_DEMO_CLEANUP)globalThis.AMOS_PROJECT_DEMO_CLEANUP();
    let form=null,download=null,downloadURL=null;
    const cleanup=()=>{try{game?.contentWindow?.AMOS_GAME_PAGE?.dispose();}catch(_){}game?.remove();form?.remove();download?.remove();if(downloadURL)URL.revokeObjectURL(downloadURL);window.removeEventListener('pagehide',cleanup);if(globalThis.AMOS_PROJECT_DEMO_CLEANUP===cleanup){delete globalThis.AMOS_PROJECT_DEMO_CLEANUP;delete globalThis.AMOS_BUILDER_DEMO_API;}};
    globalThis.AMOS_PROJECT_DEMO_CLEANUP=cleanup;window.addEventListener('pagehide',cleanup,{once:true});
    const check=(v,m)=>{if(!v)throw Error(m);};let saved=null,built=false,exportReady=false,game=null;
    const folder='/prepared/Disk',main='/prepared/Graphics.AMOS';
    globalThis.AMOS_BUILDER_DEMO_API={extensionLibraries:async()=>['amcaf-1.50beta4','turbo-plus-2.15'],chooseMain:async()=>main,chooseDirectory:async()=>folder,setDirty:async()=>{},onPreviewError:()=>()=>{},openProject:async()=>({filename:'/prepared/example.amos-project.json',project:saved}),saveProject:async p=>{saved=JSON.parse(JSON.stringify(p));return'/prepared/example.amos-project.json';},build:async p=>{check(p.mounts[0].label==='GAME:'&&p.options.touch==='off','Prepared volume/options');built=true;if(game){try{game.contentWindow.AMOS_GAME_PAGE?.dispose();}catch(_){}game.remove();}game=document.createElement('iframe');game.id='project-game-preview';game.title='Prepared project game preview';game.style.cssText='width:100%;height:600px;border:0';game.srcdoc=preview;document.body.append(game);return stats;},exportHTML:async()=>{exportReady=true;if(download)download.remove();if(downloadURL)URL.revokeObjectURL(downloadURL);const a=document.createElement('a');download=a;a.textContent='Download the prepared standalone HTML';a.dataset.projectExport='';const url=URL.createObjectURL(new Blob([exported],{type:'text/html'}));downloadURL=url;a.href=url;a.download='prepared-game.html';document.body.append(a);return{filename:'prepared-game.html',stats};}};
    const frame=document.createElement('iframe');form=frame;frame.id='project-builder-form';frame.title='Desktop builder walkthrough with prepared selections';frame.style.cssText='width:100%;height:1000px;border:0';document.body.append(frame);const loaded=new Promise(r=>frame.onload=r);frame.srcdoc=ui;await loaded;
    const doc=frame.contentDocument,pause=()=>new Promise(r=>setTimeout(r,20)),ready=async()=>{for(let i=0;i<100;i++){if(!doc.querySelector('#choose-main').disabled)return;await pause();}throw Error('Builder form stayed busy');};
    const click=async id=>{doc.getElementById(id).click();await pause();await ready();};
    await click('choose-main');await click('add-mount');const label=doc.querySelector('[aria-label="Disk label 1"]');label.value='GAME:';label.dispatchEvent(new Event('input'));
    doc.getElementById('touch').value='off';doc.getElementById('touch').dispatchEvent(new Event('input'));doc.getElementById('title').value='Prepared builder example';doc.getElementById('title').dispatchEvent(new Event('input'));
    await click('save');check(saved.main===main&&saved.mounts[0].directory===folder,'Prepared project save');await click('build');check(built,'Prepared build');
    for(let i=0;i<150;i++){if(game.contentDocument?.getElementById('play-game'))break;await pause();}check(game.contentDocument.getElementById('play-game'),'Preview page loaded');check(!game.contentWindow.amosBuilder,'Game has no builder API');
    await click('export');check(exportReady&&document.querySelector('[data-project-export]'),'Prepared HTML export');
    check(doc.getElementById('error').hidden,'Builder has no errors');return{files:stats.files,bytes:stats.bytes,saved:true,preview:true,exported:true};
  },{ui,preview,exported,stats});
};
