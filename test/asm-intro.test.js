'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {compile}=require('./helpers/program'),{createFakeTimers}=require('./helpers/fakeTimers');
const {prepare,bitmap}=require('../tools/asmIntroAssets');
const root=path.join(__dirname,'../examples/ASM');

test('ASM: pinned source inventory has seven compilable originals and the remaining ZoneDefiner blocker',()=>{
  const manifest=require('../tools/build_asm').inputs();let compiled=0;
  for(const name of manifest.sources) {
    const bytes=fs.readFileSync(path.join(root,name));
    if(name==='ZoneDefiner.AMOS')assert.throws(()=>compile(bytes),/0x14f8.*line 25/);
    else{compile(bytes);compiled++;}
  }
  assert.strictEqual(compiled,7);
});

test('ASM: prepared packed pictures preserve the declared original top-left 320×256 pixels and palette; font glyphs/advances are pinned',()=>{
  const {assets,diskFonts}=prepare(),BankReader=require('../lib/BankReader'),read=require('../lib/amos/packedPicture');
  for(const name of ['SoundAuswahl.Pic','Level.Pic','Loading.Pic']) {
    const bank=BankReader.readFile(Buffer.from(assets['asm:intro-graphics/'+name.toLowerCase()],'base64')).banks[0],image=read(Uint8Array.from(bank.data));
    const expected=bitmap(path.join(root,'intro',name));assert.deepStrictEqual(image.pixels,expected.pixels);assert.deepStrictEqual(image.palette,expected.palette);
  }
  assert.deepStrictEqual(Array.from(diskFonts[0].data.slice(65*6,66*6)),[0x60,0x90,0xf0,0x90,0x90,0]);
  assert.deepStrictEqual([diskFonts[0].baseline,diskFonts[0].advances[49],diskFonts[0].advances[65]],[4,4,5]);
});

test('ASM: unmodified silent intro selects the full JOY edition and right-click skips titles through Pop, saving the level before Run',()=>{
  const prepared=prepare(),clock=createFakeTimers(4),files=Object.fromEntries(Object.entries(prepared.assets).map(([n,b])=>[n,Buffer.from(b,'base64').toString('latin1')])),commands=[],audio=[];
  const p=compile(fs.readFileSync(path.join(root,'ASM_Intro.AMOS'))).create({displayOptions:{diskFonts:prepared.diskFonts},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){},audio:{command:e=>audio.push(e)},
    files:{read:n=>files[n.toLowerCase()],write:(n,b)=>{files[n.toLowerCase()]=b;},exists:n=>Object.keys(files).some(k=>k.startsWith(n.toLowerCase()))},system:{command:(n,r)=>commands.push([n,r])}});
  const line=()=>p.state.location&&p.state.location.line;
  const until=(test,label)=>{for(let i=0;i<30000;i++){if(test())return;p.tick(1);clock.tick(4);}throw Error('ASM timeout '+label+' at '+line());};
  const click=(x,y,b=1)=>p.setMouse(x+128,y+50,b),release=()=>p.setMouse(278,200,0);
  try{
    until(()=>line()===14,'sound');click(150,115);until(()=>p.state.variables.int_musik===1,'silent');release();
    until(()=>line()===14,'sound');click(150,160);until(()=>line()===17&&p.state.waiting==='sleep','difficulty switch');release();
    until(()=>line()===24,'difficulty');click(45,160);until(()=>line()===27&&p.state.waiting==='sleep','logo switch');release();
    until(()=>line()===42,'logo');click(150,150);until(()=>line()===43,'logo click');release();
    until(()=>line()===75&&p.state.stack.length>0,'title');click(150,150,2);
    until(()=>p.state.halted,'Run');
    assert.strictEqual(files['ram:level'],'2\r\n');assert.strictEqual(commands.at(-1)[1].filename,'ASM:ASM.Main');assert.strictEqual(commands.at(-1)[1].location.line,72);
    assert.strictEqual(audio.filter(e=>e.type==='play').length,0);assert.strictEqual(p.state.stack.length,0);assert.strictEqual(clock.pending(),0);
  }finally{p.stop();}
});
