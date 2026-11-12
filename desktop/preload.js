'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const call=async(name,...args)=>{const result=await ipcRenderer.invoke('builder:'+name,...args);if(!result.ok)throw Error(result.error);return result.value;};
contextBridge.exposeInMainWorld('amosBuilder',{
  extensionLibraries:()=>call('extension-libraries'),
  chooseMain:()=>call('main'),chooseDirectory:()=>call('directory'),openProject:()=>call('open'),saveProject:(project,filename)=>call('save',project,filename),
  build:project=>call('build',project),exportHTML:project=>call('export',project),setDirty:value=>call('dirty',value),
  onPreviewError:callback=>{if(typeof callback!=='function')throw Error('Expected callback');const listener=(_event,text)=>callback(text&&typeof text==='object'?{message:String(text.message||'').slice(0,4000),code:text.code==='AMOS_SYSTEM_INFO_REQUIRED'?text.code:null}:String(text));ipcRenderer.on('builder:preview-error',listener);return()=>ipcRenderer.removeListener('builder:preview-error',listener);}
});
