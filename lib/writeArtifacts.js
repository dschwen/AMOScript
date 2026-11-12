'use strict';
const fs=require('fs'),path=require('path');
// Preflight every destination; reuse an identical regular runtime, never overwrite.
module.exports=function writeArtifacts(filename,contents,files={}){
 const entries=Object.entries(files);if(entries.some(([name])=>name!=='libamoscript.js'||typeof files[name]!=='string'))throw Error('Invalid build artifact');
 if(typeof contents!=='string')throw Error('Missing compiled output');
 if(path.basename(filename).toLowerCase()==='libamoscript.js'&&entries.length)throw Error('Output filename conflicts with libamoscript.js');
 if(fs.existsSync(filename)){const e=Error('EEXIST: output already exists: '+filename);e.code='EEXIST';throw e;}
 const pending=[];
 for(const[name,text]of entries){const target=path.join(path.dirname(filename),name);try{const stat=fs.lstatSync(target);if(!stat.isFile()||fs.readFileSync(target,'utf8')!==text)throw Error('Existing '+name+' differs from this build. Use a separate output directory or the matching runtime options.');}catch(e){if(e.code!=='ENOENT')throw e;pending.push([target,text]);}}
 const created=[];
 try{for(const[target,text]of [...pending,[filename,contents]]){const fd=fs.openSync(target,'wx');created.push(target);try{fs.writeFileSync(fd,text);}finally{fs.closeSync(fd);}}}
 catch(error){for(const target of created.reverse())fs.unlinkSync(target);throw error;}
};
