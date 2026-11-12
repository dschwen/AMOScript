'use strict';
const {app,BrowserWindow,dialog,ipcMain,Menu,protocol}=require('electron');
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url'),{Worker}=require('worker_threads'),{randomUUID}=require('crypto');
const projects=require('../tools/project');
protocol.registerSchemesAsPrivileged([{scheme:'amos-preview',privileges:{standard:true,secure:true,supportFetchAPI:false}}]);
let window=null,dirty=false,discarding=false,activeWorker=null;
const previews=new Set(),editorURL=pathToFileURL(path.join(__dirname,'index.html')).href;
function build(project,preview){
  if(activeWorker)throw Error('A build is already running');const normalized=projects.normalize(project);
  return new Promise((resolve,reject)=>{
    const worker=new Worker(path.join(__dirname,'build-worker.js'),{workerData:{project:normalized,preview},resourceLimits:{maxOldGenerationSizeMb:512}});activeWorker=worker;let settled=false;
    const timer=setTimeout(()=>finish(Error('Build exceeded two minutes; try a smaller project')),120000);
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);activeWorker=null;worker.terminate();error?reject(error):resolve(value);};
    worker.once('message',message=>finish(message.ok?null:Error(message.error),message.result));worker.once('error',error=>finish(error));worker.once('exit',code=>{if(!settled)finish(Error('Build worker exited ('+code+')'));});
  });
}
function previewPage(html,title){
  for(const old of previews)if(!old.isDestroyed())old.destroy();
  const preview=new BrowserWindow({width:1000,height:760,title:'Preview — '+title,parent:window,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false,partition:'preview-'+randomUUID()}});
  previews.add(preview);const session=preview.webContents.session,url='amos-preview://game/index.html';
  session.protocol.handle('amos-preview',request=>new Response(request.url===url?html:'Not found',{status:request.url===url?200:404,headers:{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'"}}));
  session.setPermissionRequestHandler((_wc,permission,callback)=>callback(permission==='fullscreen'));
  session.setPermissionCheckHandler((_wc,permission)=>permission==='fullscreen');
  session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:details.url!==url&&!details.url.startsWith('data:')&&!details.url.startsWith('blob:')}));
  session.on('will-download',event=>{event.preventDefault();if(window&&!window.isDestroyed())window.webContents.send('builder:preview-error','Downloads are disabled in preview. Export HTML and open it in a browser to download modified files.');});
  preview.webContents.setWindowOpenHandler(()=>({action:'deny'}));preview.webContents.on('will-navigate',(event,target)=>{if(target!==url)event.preventDefault();});
  let polling=false;
  const monitor=setInterval(async()=>{if(polling||preview.isDestroyed()||!window||window.isDestroyed())return;polling=true;try{const error=await preview.webContents.executeJavaScript("(()=>{const text=document.querySelector('[data-debug-log]')?.textContent;if(!text)return '';try{const data=JSON.parse(text.split('\\n\\n')[0]);return String(data.sourceError?.message||data.error||'').slice(0,4000);}catch(_){return '';}})()");if(typeof error==='string'&&error)window.webContents.send('builder:preview-error',error.slice(0,4000));}catch(_){}finally{polling=false;}},500);
  preview.webContents.on('render-process-gone',(_event,details)=>{if(window&&!window.isDestroyed())window.webContents.send('builder:preview-error','Preview stopped: '+details.reason);});
  preview.on('closed',()=>{clearInterval(monitor);previews.delete(preview);session.protocol.unhandle('amos-preview');});
  preview.setMenuBarVisibility(false);preview.loadURL(url);return preview;
}
function register(){
  const handle=(name,fn)=>ipcMain.handle('builder:'+name,async(event,...args)=>{
    if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame.url!==editorURL)throw Error('Untrusted builder request');
    try{return{ok:true,value:await fn(...args)};}catch(error){return{ok:false,error:error.message};}
  });
  handle('extension-libraries',()=>Object.keys(require('../lib/ExtensionProfiles').libraries));
  handle('main',async()=>{const result=await dialog.showOpenDialog(window,{title:'Choose the main AMOS program',properties:['openFile'],filters:[{name:'AMOS programs',extensions:['AMOS','amos']},{name:'All files',extensions:['*']}]});return result.canceled?null:result.filePaths[0];});
  handle('directory',async()=>{const result=await dialog.showOpenDialog(window,{title:'Import an asset directory',properties:['openDirectory']});return result.canceled?null:result.filePaths[0];});
  handle('open',async()=>{const result=await dialog.showOpenDialog(window,{title:'Open an AMOScript project',properties:['openFile'],filters:[{name:'AMOScript project',extensions:['json']}]});if(result.canceled)return null;const filename=result.filePaths[0];return{filename,project:projects.loadProject(filename)};});
  handle('save',async(project,filename)=>{if(filename!=null&&typeof filename!=='string')throw Error('Invalid project filename');projects.normalize(project);const chosen=await dialog.showSaveDialog(window,{title:'Save AMOScript project',defaultPath:filename||'My Game.amos-project.json',filters:[{name:'AMOScript project',extensions:['json']}]});if(chosen.canceled)return null;projects.saveProject(chosen.filePath,project);return chosen.filePath;});
  handle('dirty',value=>{if(typeof value!=='boolean')throw Error('Invalid dirty state');dirty=value;});
  handle('build',async project=>{const normalized=projects.normalize(project),result=await build(normalized,true);previewPage(result.html,normalized.options.title);return result.stats;});
  handle('export',async project=>{const result=await build(project,false),chosen=await dialog.showSaveDialog(window,{title:'Export HTML — choose a new filename',defaultPath:'game.html',filters:[{name:'HTML page',extensions:['html']}]});if(chosen.canceled)return null;try{projects.exportHTML(chosen.filePath,result.html);}catch(error){if(error.code==='EEXIST')throw Error('That HTML file already exists. Choose a new filename.');throw error;}return{filename:chosen.filePath,stats:result.stats};});
}
app.whenReady().then(()=>{
  register();window=new BrowserWindow({width:1150,height:850,minWidth:780,minHeight:600,title:'AMOScript Builder',icon:path.join(__dirname,'icon.png'),webPreferences:{preload:path.join(__dirname,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true,webviewTag:false}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',(event,url)=>{if(url!==editorURL)event.preventDefault();});
  window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  window.on('close',event=>{if(dirty&&!discarding){event.preventDefault();const choice=dialog.showMessageBoxSync(window,{type:'question',buttons:['Keep editing','Discard changes'],defaultId:0,cancelId:0,message:'Discard unsaved project changes?'});if(choice===1){discarding=true;window.close();}}});
  window.on('closed',()=>{for(const p of previews)if(!p.isDestroyed())p.destroy();if(activeWorker)activeWorker.terminate();window=null;});
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'File',submenu:[{role:'close'},{role:'quit'}]},{label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]}]));
  window.loadURL(editorURL);
});
app.on('window-all-closed',()=>app.quit());
