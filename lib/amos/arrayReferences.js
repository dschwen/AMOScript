/* jshint esversion: 6 */
'use strict';

// Logical array-header references. These never alias bank, bitmap or Varptr
// bytes. Native FnArray retains the header while evaluating unused subscripts.
function createArrayReferences() {
  const entries=new Map(),arrays=new WeakMap();let next=0x1000;
  function prune(){for(const [handle,entry]of entries)if(!entry.alive())entries.delete(handle);}
  function reference(array,type,indices,alive){
    if(!array||!Array.isArray(array.dimensions)||!array.dimensions.length||!(array.values instanceof Map))throw Error('Array not dimensioned');
    if(!['integer','string','float'].includes(type))throw Error('Unsupported Array element type');
    if(array.dimensions.length!==indices.length)throw Error('Wrong number of Array indices');
    if(array.dimensions.some(size=>!Number.isInteger(size)||size<1||size>65536))throw Error('Invalid Array dimensions');
    const dimensions=array.dimensions.slice(),valid=()=>alive()&&array.dimensions.length===dimensions.length&&array.dimensions.every((size,i)=>size===dimensions[i]);
    if(!valid())throw Error('Array reference owner is retired');
    for(const evaluate of indices){evaluate();if(!valid())throw Error('Array reference owner changed during subscript evaluation');}
    prune();let entry=arrays.get(array);
    if(entry&&entries.has(entry.handle))return entry.handle;
    if(next>=0x10000)throw Error('Array reference space exhausted');
    entry={handle:next,array,type,dimensions,alive:valid};next+=4;
    arrays.set(array,entry);entries.set(entry.handle,entry);return entry.handle;
  }
  function resolve(handle){prune();const entry=entries.get(handle);if(!entry)throw Error('Array reference is invalid or retired');return entry;}
  function vector(handle){const entry=resolve(handle);if(entry.dimensions.length!==1||entry.type==='float')throw Error('Interface arrays require one-dimensional integer or string storage');return entry;}
  function size(handle){return handle===0?0:vector(handle).dimensions[0]-1;}
  function value(handle,index){const entry=vector(handle);if(!Number.isInteger(index)||index<0||index>=entry.dimensions[0])throw Error('Array element index out of bounds');const value=entry.array.values.has(index)?entry.array.values.get(index):entry.array.defaultValue;if(entry.type==='string'?(typeof value!=='string'||value.length>65535||/[^\x00-\xff]/.test(value)):(!Number.isInteger(value)||value<-2147483648||value>2147483647))throw Error('Invalid Interface array value');return value;}
  function read(handle,index){if(!Number.isInteger(index)||index<0||index>=size(handle))throw Error('Interface array index out of bounds');return value(handle,index);}
  function info(handle){const entry=resolve(handle);return Object.freeze({handle,type:entry.type,dimensions:Object.freeze(entry.dimensions.slice())});}
  return {reference,size,read,value,info};
}
if(typeof module==='object'&&module.exports)module.exports=createArrayReferences;
if(typeof globalThis!=='undefined')globalThis.AMOS_ARRAY_REFERENCES=createArrayReferences;
