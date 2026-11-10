'use strict';
module.exports=async function(page){
 const source=new(require('../../lib/Transpiler'))(require('./amcafStatusProgram')(),{extensions:{19:'amcaf-1.50beta4'}}).toModule();
 return page.evaluate(({source,timerSource,filesSource,bytes})=>{
  const make=s=>new Function('return ('+s+');')(),module={exports:{}};new Function('module',source)(module);
  const clock=make(timerSource)(),logs=[],p=module.exports({...clock,files:make(filesSource)({music:atob(bytes)}),print:(...a)=>logs.push(a)});
  try{p.tick(1000);clock.tick(140);const before=p.state.tracker.position;
   for(let i=0;i<1000;i++)p.extensionPtCpos();if(p.state.tracker.position!==before)throw Error('Queries advanced or republished player state');
   p.sendKey('first report');p.tick(1000);clock.tick(940);p.sendKey('second report');p.tick(1000);
   const row=p.extensionPtCpos(),note=p.extensionPtCnote(0);p.extensionPtStop();p.eraseBank(3);
   return{logs,row,note,retained:p.extensionPtCpos()===row&&p.extensionPtCnote(0)===note,pending:clock.pending()};
  }finally{p.stop();}
 },{source,timerSource:require('./fakeTimers').createFakeTimers.toString(),filesSource:require('../../lib/amos/files').createMemoryFiles.toString(),bytes:require('./amcafPreviewBytes')().toString('base64')});
};
