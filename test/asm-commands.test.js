'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {compile}=require('./helpers/program'),{createFakeTimers}=require('./helpers/fakeTimers');
const {prepare}=require('../tools/asmIntroAssets'),{createMemoryFiles}=require('../lib/amos/files');

test('ASM main: commands redraw the bar, preserve sprite palette events and enter room 2 through Zurück',()=>{
  require('../tools/build_asm').inputs();const intro=prepare(),assets={...intro.assets,...require('../tools/asmGameAssets').prepare()},initial=Object.fromEntries(Object.entries(assets).map(([n,b])=>[n,Buffer.from(b,'base64').toString('latin1')]));initial['ram:level']='2\r\n';
  const memory=createMemoryFiles(initial,[],['df0:']),clock=createFakeTimers(4),requests=[];
  const files={read:n=>memory.read(n.toLowerCase()),write:(n,b)=>memory.write(n.toLowerCase(),b,n),remove:n=>memory.remove(n.toLowerCase()),exists:n=>memory.exists(n.toLowerCase()),isDirectory:n=>memory.isDirectory(n.toLowerCase()),list:n=>memory.list(n.toLowerCase()),freeSpace:n=>memory.freeSpace(n.toLowerCase())};
  const p=compile(fs.readFileSync(path.join(__dirname,'../examples/ASM/ASM.current.AMOS'))).create({files,displayOptions:{diskFonts:intro.diskFonts},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,system:{command:(...args)=>requests.push(args)},print(){}});
  let frames=0,pixels=0;
  try{
    const result=require('./helpers/asmMainReplay')(p,clock,(name,oracle)=>{frames++;if(oracle){const expected=Buffer.from(require('./fixtures/asm/room1.json')[oracle],'base64');assert.deepStrictEqual(Buffer.from(p.display.screen(2).pixels),expected,name);pixels+=expected.length;}p.display.canvasFrame();},assert.ok,true);
    assert.deepStrictEqual(result,{room:2,handle:2});assert.strictEqual(frames,21);assert.strictEqual(pixels,81920);assert.strictEqual(p.state.error,undefined);
  }finally{p.stop();}
});

test('ASM current source: only room-load line 886 changes; original lines and trailing banks stay pinned',()=>{
  const Reader=require('../lib/Buffer');const original=fs.readFileSync(path.join(__dirname,'../examples/ASM/ASM.AMOS')),current=fs.readFileSync(path.join(__dirname,'../examples/ASM/ASM.current.AMOS'));
  const a=new Reader(original),b=new Reader(current);assert.strictEqual(a.lines.length,b.lines.length);
  for(let i=0;i<a.lines.length;i++){
    const from=a.lines[i],to=b.lines[i],old=original.subarray(from,from+original[from]*2),now=current.subarray(to,to+current[to]*2);
    if(i!==885)assert.deepStrictEqual(now,old,'changed source line '+(i+1));
    else{assert.strictEqual(now.length,old.length+10);assert.deepStrictEqual(now.subarray(1,old.length-2),old.subarray(1,old.length-2));assert.strictEqual(now.subarray(old.length-2,now.length-2).toString('hex'),'00540a88003e00000000');}
  }
  assert.deepStrictEqual(current.subarray(20+b.code_bytes),original.subarray(20+a.code_bytes));
 });
