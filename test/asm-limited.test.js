'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const limited=require('../tools/asmLimitedSource'),assetsTool=require('../tools/asmGameAssets'),{compile}=require('./helpers/program'),{createFakeTimers}=require('./helpers/fakeTimers');
test('ASM limited demo: only rooms 1–5 and their required shared assets are distributed',()=>{
  require('../tools/build_asm').inputs();const files=assetsTool.prepare(),names=Object.keys(files);
  assert.deepStrictEqual([...new Set(names.flatMap(name=>{const m=/rooms\/room(\d+)[._]/.exec(name);return m?[Number(m[1])]:[];}))].sort((a,b)=>a-b),[1,2,3,4,5]);
  assert.ok(!names.some(name=>/labyrinth|\/end\.|\/far\.|\/tel\.|\/tre\.|\/gog\.|\/gok\./.test(name)));
  assert.throws(()=>assetsTool.prepare({roomLimit:23}),/limited/);
  assert.deepStrictEqual(Object.keys(require('./fixtures/asm/rooms.json').rooms),['1','2','3','4','5']);
  assert.ok(!/ASM|asm-game|asm-room/.test(fs.readFileSync(path.join(__dirname,'../README.md'),'utf8')));
});
test('ASM limited demo: source guard ends room 6 before requesting any excluded room asset',()=>{
  const assets=assetsTool.prepare(),clock=createFakeTimers(4),reads=[],source=limited(require('./helpers/asmRoomsFixture')());
  const p=compile(source).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){},displayOptions:{diskFonts:require('../tools/asmIntroAssets').prepare().diskFonts},files:{read(name){reads.push(name);if(name==='fixture:room')return'6\r\n';if(name.toLowerCase()==='ram:level')return'2\r\n';if(!(name.toLowerCase()in assets))throw Error('Missing '+name);return Buffer.from(assets[name.toLowerCase()],'base64').toString('latin1');},write(){},remove(){},exists:()=>true}});
  try{p.display.getDiscFonts();p.tick(10000);for(let i=0;i<15000&&!p.state.halted;i++)clock.tick(4);assert.strictEqual(p.state.halted,true);assert.strictEqual(p.state.error,undefined);assert.strictEqual(p.state.location.line,874);assert.ok(!reads.some(name=>/room6/i.test(name)));}finally{p.stop();}
});
test('ASM limited demo: game over ends before excluded end-screen assets',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'../examples/ASM/ASM.current.AMOS')),Reader=require('../lib/Buffer'),reader=new Reader(raw),{binary,token,identifier}=require('./helpers/tokens');
  const first=binary([[token('Goto'),identifier('game_over',0x18)]]).subarray(20),start=reader.lines[6],end=start+raw[start]*2,header=Buffer.from(raw.subarray(0,20));header.writeUInt32BE(reader.code_bytes+first.length-(end-start),16);
  const source=limited(Buffer.concat([header,raw.subarray(20,start),first,raw.subarray(end)])),clock=createFakeTimers(4),p=compile(source).create({now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,files:{read(){throw Error('Unexpected end-screen read');}},print(){}});
  try{p.tick(1000);for(let i=0;i<15000&&!p.state.halted;i++)clock.tick(4);assert.strictEqual(p.state.error,undefined);assert.strictEqual(p.state.halted,true);assert.strictEqual(p.state.location.line,1132);}finally{p.stop();}
});
