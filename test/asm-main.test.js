'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {compile}=require('./helpers/program'),{createFakeTimers}=require('./helpers/fakeTimers');
const {prepare}=require('../tools/asmIntroAssets'),{createMemoryFiles}=require('../lib/amos/files');

test('ASM main: complete unchanged source starts the JOY edition, answers its original prompt, inspects a poster and picks up the handle',()=>{
  require('../tools/build_asm').inputs();const intro=prepare(),assets={...intro.assets,...require('../tools/asmGameAssets').prepare()},initial=Object.fromEntries(Object.entries(assets).map(([n,b])=>[n,Buffer.from(b,'base64').toString('latin1')]));initial['ram:level']='2\r\n';
  const memory=createMemoryFiles(initial,[],['df0:']),clock=createFakeTimers(4),requests=[];
  const files={read:n=>memory.read(n.toLowerCase()),write:(n,b)=>memory.write(n.toLowerCase(),b,n),remove:n=>memory.remove(n.toLowerCase()),exists:n=>memory.exists(n.toLowerCase()),isDirectory:n=>memory.isDirectory(n.toLowerCase()),list:n=>memory.list(n.toLowerCase()),freeSpace:n=>memory.freeSpace(n.toLowerCase())};
  const p=compile(fs.readFileSync(path.join(__dirname,'../examples/ASM/ASM.AMOS'))).create({files,displayOptions:{diskFonts:intro.diskFonts},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,system:{command:(...args)=>requests.push(args)},print(){}});
  let frames=0,pixels=0;
  try{
    const result=require('./helpers/asmMainReplay')(p,clock,(name,oracle)=>{frames++;if(oracle){const expected=Buffer.from(require('./fixtures/asm/room1.json')[oracle],'base64');assert.deepStrictEqual(Buffer.from(p.display.screen(2).pixels),expected,name);pixels+=expected.length;}p.display.canvasFrame();},assert.ok);
    assert.deepStrictEqual(result,{room:1,handle:2});assert.strictEqual(frames,8);assert.strictEqual(pixels,81920);assert.strictEqual(memory.exists('ram:level'),false);assert.ok(requests.some(r=>r[0]==='Request Wb'));assert.strictEqual(p.state.error,undefined);
  }finally{p.stop();}
});
