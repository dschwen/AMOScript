'use strict';
const fs=require('fs'),path=require('path'),{buildGamePage}=require('./build_game_page'),{randomUUID}=require('crypto');
const extensionProfiles=require('../lib/ExtensionProfiles');
const defaults=Object.freeze({extensions:Object.freeze({}),title:'My AMOS game',renderer:'webgl',port:1,fire:Object.freeze(['Space','Enter']),slowdown:1,optimize:false,debug:false,touch:'auto'});
function object(value,name){if(!value||typeof value!=='object'||Array.isArray(value))throw Error(name+' must be an object');}
function keys(value,allowed,name){object(value,name);for(const key of Object.keys(value))if(!allowed.includes(key))throw Error('Unknown '+name+' field: '+key);}
function filePath(value,base,name){if(typeof value!=='string'||!value.trim()||value.includes('\0'))throw Error('Choose '+name);return path.resolve(base,value);}
function normalize(project,base=process.cwd()){
  keys(project,['version','main','mounts','options'],'project');if(project.version!==1)throw Error('Unsupported project version (expected 1)');
  if(!Array.isArray(project.mounts)||project.mounts.length>32)throw Error('Project mounts must be a list of at most 32 directories');
  const labels=new Set(),mounts=project.mounts.map(m=>{keys(m,['label','directory'],'mount');if(typeof m.label!=='string'||(m.label!==''&&!/^[^:/\\\x00-\x1f]{1,31}:$/.test(m.label)))throw Error('Disk labels must end with a colon, for example GAME: (or be empty for relative paths)');const label=m.label.normalize('NFC').replace(/[a-z]/g,c=>c.toUpperCase());if(labels.has(label.toLowerCase()))throw Error('Duplicate disk label: '+(label||'(relative paths)'));labels.add(label.toLowerCase());return{label,directory:filePath(m.directory,base,'an asset directory')};});
  const supplied=project.options===undefined?{}:project.options;keys(supplied,Object.keys(defaults),'option');const options={...defaults,...supplied};
  options.extensions=extensionProfiles.normalize(options.extensions);
  if(typeof options.title!=='string'||!options.title.trim()||options.title.length>200)throw Error('Enter a title (1–200 characters)');
  if(!['webgl','canvas'].includes(options.renderer))throw Error('Invalid renderer');if(![0,1].includes(options.port))throw Error('Joystick port must be 0 or 1');
  if(!Array.isArray(options.fire)||!options.fire.length||options.fire.length>8||options.fire.some(k=>typeof k!=='string'||!/^[A-Za-z][A-Za-z0-9]{0,31}$/.test(k)))throw Error('Enter keyboard fire codes such as Space, Enter or KeyZ');
  if(!Number.isFinite(options.slowdown)||options.slowdown<1||options.slowdown>100)throw Error('Slowdown must be between 1 and 100');
  for(const name of ['optimize','debug'])if(typeof options[name]!=='boolean')throw Error(name+' must be a boolean');
  if(!['auto','always','off'].includes(options.touch))throw Error('Invalid touch control setting');
  return{version:1,main:filePath(project.main,base,'the main .AMOS program'),mounts,options:{...options,fire:options.fire.slice()}};
}
function loadProject(filename){const bytes=fs.readFileSync(filename);if(bytes.length>1024*1024)throw Error('Project file exceeds 1 MiB');return normalize(JSON.parse(bytes.toString('utf8')),path.dirname(path.resolve(filename)));}
function saveProject(filename,project){const p=normalize(project),base=path.dirname(path.resolve(filename)),relative=value=>path.relative(base,value).split(path.sep).join('/')||'.';const data={...p,main:relative(p.main),mounts:p.mounts.map(m=>({...m,directory:relative(m.directory)}))};if(fs.existsSync(filename)){let existing;try{existing=JSON.parse(fs.readFileSync(filename,'utf8'));}catch(_){}if(!existing||existing.version!==1||typeof existing.main!=='string')throw Error('Refusing to replace a file that is not an AMOScript project');}const temporary=filename+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(temporary,JSON.stringify(data,null,2)+'\n',{flag:'wx'});fs.renameSync(temporary,filename);}finally{fs.rmSync(temporary,{force:true});}return p;}
function collect(project,{maxBytes=16*1024*1024,maxFiles=10000}={}){
  const p=normalize(project),assets=Object.create(null),directories=new Set(),names=new Map(),volumes=[];let bytes=0,count=0;
  let entries=0;
  for(const mount of p.mounts){
    const volume={label:mount.label,files:0,bytes:0};volumes.push(volume);
    const claim=(name,kind)=>{const canonical=name.toLowerCase();if(names.has(canonical))throw Error('Conflicting AMOS path: '+name+' (case-insensitive paths must be unique)');names.set(canonical,kind);return canonical;};
    const walk=(local,parts)=>{
      if(++entries>20000||parts.length>64)throw Error('Asset directory tree is too large or deeper than 64 levels');
      const info=fs.lstatSync(local);if(info.isSymbolicLink())throw Error('Symbolic links/junctions are not imported: '+local);
      const virtual=mount.label+parts.map(name=>name.normalize('NFC')).join('/');
      if(info.isDirectory()){
        if(parts.length)claim(virtual,'directory');directories.add(virtual+(parts.length?'/':''));
        const entries=fs.readdirSync(local).sort();for(const name of entries){if(/[\x00-\x1f:\\]/.test(name))throw Error('Unsupported character in asset name: '+name);walk(path.join(local,name),[...parts,name]);}
      }else if(info.isFile()){
        const canonical=claim(virtual,'file');if(++count>maxFiles)throw Error('Import exceeds '+maxFiles+' files; choose a smaller asset directory');
        if(bytes+info.size>maxBytes)throw Error('Imported assets exceed '+Math.floor(maxBytes/1024/1024)+' MiB; choose smaller asset directories');
        const data=fs.readFileSync(local);if(bytes+data.length>maxBytes)throw Error('Imported assets exceed the byte limit');bytes+=data.length;volume.bytes+=data.length;volume.files++;assets[canonical]=data.toString('base64');
      }else throw Error('Only regular files and directories can be imported: '+local);
    };
    if(!fs.lstatSync(mount.directory).isDirectory())throw Error('Asset mount is not a directory: '+mount.directory);walk(mount.directory,[]);
  }
  return{assets,directories:[...directories],stats:{files:count,bytes,volumes}};
}
function buildProject(project,{preview=false}={}){
  const p=normalize(project);if(fs.statSync(p.main).size>16*1024*1024)throw Error('Main program exceeds 16 MiB');const source=fs.readFileSync(p.main);if(source.length>16*1024*1024)throw Error('Main program exceeds 16 MiB');
  const imported=collect(p);try{return{html:buildGamePage(source,{...p.options,debug:preview||p.options.debug,assets:imported.assets,directories:imported.directories}),stats:imported.stats};}catch(error){error.message=path.basename(p.main)+': '+error.message;throw error;}
}
function exportHTML(filename,html){if(typeof html!=='string')throw Error('Missing compiled page');fs.writeFileSync(filename,html,{flag:'wx'});}
module.exports={defaults,normalize,loadProject,saveProject,collect,buildProject,exportHTML};
