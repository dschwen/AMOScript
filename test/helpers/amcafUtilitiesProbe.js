'use strict';
module.exports=async function(page){
 const source=new(require('../../lib/Transpiler'))(require('./amcafUtilitiesProgram')(),{extensions:{19:'amcaf-1.50beta4'}}).toModule();
 return page.evaluate(({source,timerSource,filesSource})=>{
  const module={exports:{}};new Function('module',source)(module);
  const make=text=>new Function('return ('+text+');')(),bytes=String.fromCharCode(...Array.from({length:256},(_,i)=>i));
  const files=make(filesSource)({input:bytes}),logs=[],clock=make(timerSource)(),p=module.exports({...clock,files,print:(...args)=>logs.push(args)});
  try{p.tick(1000);if(p.state.error||p.state.waiting!=='key')throw Error('Compiled utilities did not reach Wait Key');
   const bank=p.banks.get(7),snapshot=files.read('snapshot'),alias=files.read('alias');
   if(snapshot!==bytes||alias!==bytes)throw Error('Raw round-trip changed bytes');
   return{logs,bytes:snapshot.length,alias:alias===snapshot,memory:bank.memory,temporary:bank.permanent===false};
  }finally{p.stop();}
 },{source,timerSource:require('./fakeTimers').createFakeTimers.toString(),filesSource:require('../../lib/amos/files').createMemoryFiles.toString()});
};
