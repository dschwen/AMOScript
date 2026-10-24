/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {compile}=require('./helpers/program');
const source=fs.readFileSync(path.join(__dirname,'../examples/Wonderland/Wonderland.AMOS'));
const files={read:name=>fs.readFileSync(path.join(__dirname,'../examples/Wonderland',name.split('/').pop()),'latin1')};

test('Wonderland: input-only full-source replay renders three deaths/fades, two life restarts, game over and a fresh game',()=>{
  const {create}=compile(source),clock=require('./helpers/steppedTimers').createSteppedTimers();let frames=0;
  const result=require('./helpers/wonderlandReplay')(create,clock,files,p=>({set:action=>p.setJoystick(1,action==='fire'?16:action==='left'?4:0),dispose(){}}),(name,p)=>{
    const snapshot=p.display.snapshotDisplay();
    assert.strictEqual(snapshot.frame.lineRegs.some((v,i)=>i%32===17&&v),false,name);
    assert.strictEqual(p.display.renderDisplay().length,snapshot.frame.outputWidth*snapshot.frame.lines*4,name);frames++;
  });
  assert.deepStrictEqual(result.deaths,[2,1,0]);assert.strictEqual(result.restarts,2);assert.strictEqual(result.fades,3);
  assert.ok(result.stopResume);assert.strictEqual(result.freshLives,3);assert.ok(result.gameOverTime>10000&&result.gameOverTime<15000);assert.ok(frames>=10);
});

test('Wonderland: original up/right controls jump, scroll and Escape returns to its title without variable injection',()=>{
  const {create}=compile(source),c=require('./helpers/steppedTimers').createSteppedTimers();
  const p=create({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,files,print(){}});
  try{
    p.tick(100000);p.setJoystick(1,16);for(let i=0;i<5;i++)assert.ok(c.next());
    p.setJoystick(1,0);for(let i=0;i<20;i++)assert.ok(c.next());const y=p.state.variables.int_y;
    p.setJoystick(1,9);for(let i=0;i<10;i++)assert.ok(c.next());
    assert.ok(p.state.variables.int_y<y);assert.strictEqual(p.state.variables.int_jump,1);
    p.setJoystick(1,8);for(let i=0;i<60;i++)assert.ok(c.next());assert.ok(p.state.variables.int_rsx>0);
    p.setJoystick(1,0);p.sendKey('\x1b',69);for(let i=0;i<10&&p.state.location.line!==66;i++)assert.ok(c.next());
    assert.strictEqual(p.state.location.line,66);assert.strictEqual(p.display.canvasFrame().height,256);assert.strictEqual(p.state.halted,false);
  }finally{p.stop();assert.strictEqual(c.pending(),0);}
});
