/* jshint esversion: 6 */
'use strict';

module.exports = async function onBranchProbe(page) {
  const Transpiler=require('../../lib/Transpiler'),fixture=require('../fixtures/conformance/computed-label-branches.json');
  const sources=[{name:'Named-label dispatch trace',source:new Transpiler(Buffer.from(fixture.programHex,'hex')).toModule(),expected:fixture.expected.values},
    ...[2,4,5].map(selector=>({name:`Original enemy initialization ${selector}`,selector,
      source:new Transpiler(require('./wonderlandDispatch')(selector)).toModule(),expected:[selector===4?[0,0]:[-4,99]]}))];
  return page.evaluate(sources=>{
    const results=[];
    for(const item of sources) {
      const module={exports:{}},logs=[];new Function('module',item.source)(module);
      const program=module.exports({print:(...values)=>logs.push(values)}),canvas=document.createElement('canvas');
      const host=AMOS_BROWSER.createCanvasHost(canvas,{requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
      try {
        host.attach(program);program.tick(1000);host.render();
        if(JSON.stringify(logs)!==JSON.stringify(item.expected))throw new Error(`${item.name}: incorrect dispatch output`);
        if(!program.state.halted||program.state.stack.length||program.state.frames.length)throw new Error(`${item.name}: unfinished call stack`);
        const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        if(globalThis.AMOS_DEMO_OBSERVE)globalThis.AMOS_DEMO_OBSERVE({name:item.name,width:canvas.width,height:canvas.height,rgba});
        results.push({name:item.name,logs,halted:true,stack:0});
      } finally {host.detach();program.stop();}
    }
    return {results,gameRunning:false};
  },sources);
};
