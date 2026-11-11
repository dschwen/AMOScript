/* jshint esversion: 6 */
'use strict';
// Per-program metadata/cursor state. Host adapters own paths and filesystem APIs.
function createAmcafDos({files,resolve,pattern,devices:readDevices}) {
 let object=null,cursor=null,ioError=0;
 const byteString=(v,limit=255)=>typeof v==='string'&&v.length<=limit&&!/[^\x01-\xff]/.test(v);
 function fault(error){ioError=Number.isInteger(error.ioError)?error.ioError:error.code==='ENOENT'?205:error.code==='ENOTDIR'?212:error.code==='EACCES'?224:1;throw error;}
 function snapshot(name,m){
  if(!m||typeof m.then==='function'||!Number.isInteger(m.size)||m.size<0||m.size>2147483647||typeof m.directory!=='boolean')throw Error('Invalid synchronous object metadata');
  const value={name:m.name==null?name.replace(/[:/]+$/,'').split(/[:/]/).pop():m.name,size:m.size,directory:m.directory,date:m.date==null?0:m.date,time:m.time==null?0:m.time,protection:m.protection==null?0:m.protection,comment:m.comment==null?'':m.comment};
  if(!byteString(value.name)||!byteString(value.comment,79)||!Number.isInteger(value.date)||value.date<0||value.date>44559||!Number.isInteger(value.time)||value.time<0||value.time>>>16>1439||(value.time&65535)>2999||!Number.isInteger(value.protection)||value.protection< -2147483648||value.protection>2147483647)throw Error('Invalid extended object metadata');
  return Object.freeze(value);
 }
 function stat(name){if(!files||typeof files.stat!=='function')throw Error('Examine Object requires a synchronous files.stat adapter');return snapshot(name,files.stat(name));}
 function examine(name){name=resolve(name);try{const next=stat(name);object=next;ioError=0;}catch(error){fault(error);}}
 function stop(){cursor=null;}
 function examineDir(name){name=resolve(name);stop();try{
  const meta=stat(name);if(!meta.directory){const e=Error('Not a directory: '+name);e.code='ENOTDIR';throw e;}
  if(typeof files.list!=='function')throw Error('Examine Dir requires a synchronous files.list adapter');
  const entries=files.list(name);if(!Array.isArray(entries)||entries.length>4096)throw Error('Invalid synchronous directory listing');
  const list=Array.from(entries,e=>{if(!e||!byteString(e.name)||!e.name||/[\/:]/.test(e.name))throw Error('Invalid directory entry');return snapshot(e.name,e);});
  cursor={entries:list,index:0};object=meta;ioError=0;
 }catch(error){fault(error);}}
 function next(){if(!cursor)throw Error('Examine Dir first');if(cursor.index===cursor.entries.length){stop();ioError=232;return '';}
  object=cursor.entries[cursor.index++];ioError=0;return object.name;
 }
 function get(){if(!object)throw Error('Examine Object first');return object;}
 function devices(){return readDevices();}
 function diskType(name){if(!byteString(name)||!name.includes(':'))throw Error('Disk Type requires a volume or assign name');const key=name.slice(0,name.indexOf(':')+1).toUpperCase(),entry=devices().find(e=>e.name.toUpperCase()===key);if(!entry){const e=Error('Object not found: '+name);e.code='ENOENT';fault(e);}return entry.type;}
 const pad=v=>String(v).padStart(2,'0');
 return {examine,examineDir,next,stop,get,devices,diskType,pattern,
  error:()=>ioError,errorString:code=>({0:'No error',205:'Object not found',212:'Object is not a directory',224:'Read protected',232:'No more entries'}[code]||'I/O error '+code),
  dateString(days){if(!Number.isInteger(days)||days<0||days>44559)throw Error('Cd Date$ supports 1978..2099');const d=new Date(Date.UTC(1978,0,1)+days*86400000);return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()]+' '+pad(d.getUTCDate())+'-'+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]+'-'+pad(d.getUTCFullYear()%100);},
  timeString(time){const minutes=time>>>16,ticks=time&65535;if(!Number.isInteger(time)||time<0||minutes>1439||ticks>2999)throw Error('Invalid AMCAF packed time');return pad(Math.floor(minutes/60))+':'+pad(minutes%60)+':'+pad(Math.floor(ticks/50));},
  protectionString(value){let result='';const table='dewr----apsh';for(let bit=7;bit>=0;bit--)result+=table[bit+((value&(1<<bit))?4:0)];return result;}
 };
}
if(typeof module==='object'&&module.exports)module.exports=createAmcafDos;
else globalThis.AMOS_AMCAF_DOS=createAmcafDos;
