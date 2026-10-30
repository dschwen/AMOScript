'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {compile}=require('./helpers/program'),{createFakeTimers}=require('./helpers/fakeTimers');
test('GALAX play: unchanged complete source starts from menu, moves/fires through automatic AMAL, dies and starts its next life',()=>{
  const {assets}=require('../tools/build_compiler_examples').buildCompilerExamples();
  const files={read:name=>Buffer.from(assets[name.toLowerCase()],'base64').toString('latin1'),isDirectory:()=>true,exists:name=>!!assets[name.toLowerCase()]};
  const clock=createFakeTimers(),p=compile(fs.readFileSync(path.join(__dirname,'../examples/CompilerExamples/Galax/GALAX.AMOS'))).create({files,now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){}});
  let frames=0;
  try {
    const result=require('./helpers/galaxPlayReplay')(p,clock,()=>{p.display.snapshotDisplay();frames++;});
    assert.deepStrictEqual(result,{gameFields:180,lives:4,channels:16});assert.strictEqual(frames,6);
  }finally{p.stop();assert.strictEqual(clock.pending(),0);}
});
