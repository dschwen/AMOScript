'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),Transpiler=require('../lib/Transpiler');
const {createFakeTimers}=require('./helpers/fakeTimers'),{createMemoryFiles}=require('../lib/amos/files');
const root=path.join(__dirname,'../examples/ASM/game'),assetsTool=require('../tools/asmGameAssets');
test('ASM rooms: all 23 original entry routines complete on declared fresh state and match independent bitmap/Bob pixels',()=>{
  require('../tools/build_asm').inputs();
  const assets=assetsTool.prepare(),fonts=require('../tools/asmIntroAssets').prepare().diskFonts;
  const mod={exports:{}};new Function('module',new Transpiler(require('./helpers/asmRoomsFixture')()).toModule())(mod);
  const dialogueMod={exports:{}};new Function('module',new Transpiler(require('./helpers/asmRoomsFixture')(true)).toModule())(dialogueMod);
  const oracle=require('./fixtures/asm/rooms.json').rooms;
  for(let room=1;room<=23;room++){
    const memory=createMemoryFiles({...Object.fromEntries(Object.entries(assets).map(([n,b])=>[n,Buffer.from(b,'base64').toString('latin1')])),'ram:level':'2\r\n','fixture:room':room+'\r\n'},[],['df0:','ram:']);
    const files={read:n=>memory.read(n.toLowerCase()),write:(n,b)=>memory.write(n.toLowerCase(),b),remove:n=>memory.remove(n.toLowerCase()),exists:n=>memory.exists(n.toLowerCase())},clock=createFakeTimers(4);
    const p=(room<=14?dialogueMod.exports:mod.exports)({files,displayOptions:{diskFonts:fonts},now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,print(){}});
    try{require('./helpers/asmRoomEntry')(p,clock,room);assert.deepStrictEqual(Buffer.from(p.display.screen(2).pixels),Buffer.from(oracle[room],'base64'),'room '+room);p.display.canvasFrame();assert.ok(p.display.screen(0).zones.length>0);if(room<=14){assert.ok(p.state.variables.int_fragen>0&&p.state.variables.int_fragen<=10,'dialogue '+room);assert.ok(p.state.variables.array_string_frage.values.get(1).length>0);}}
    finally{p.stop();}
  }
});
test('ASM recovered art: canonical palette permutations match paired source palettes and four surviving authoring pictures exactly',()=>{
  const profile=require('../examples/ASM/game/asset-profile.json'),BR=require('../lib/BankReader'),P=require('../lib/amos/packedPicture');
  const unpack=file=>{
    let b=Buffer.from(BR.readFile(fs.readFileSync(path.join(root,file))).banks[0].data);
    if(b.readUInt32BE(0)===0x06071963){const width=b.readUInt16BE(8)*8,height=b.readUInt16BE(10)*b.readUInt16BE(12),depth=b.readUInt16BE(14),h=Buffer.alloc(90);h.writeUInt32BE(0x12031990);[width,height,128,80,width,height,0,0,depth<<12,1<<depth,depth].forEach((v,i)=>h.writeUInt16BE(v,4+i*2));b=Buffer.concat([h,b]);}
    return P(b);
  };
  for(const [name,recipe]of Object.entries(profile.recovered))if(recipe.sourcePalette){
    const palette=BR.readFile(fs.readFileSync(path.join(root,recipe.sourcePalette))).banks[0].palette;
    const mapped=palette.map((_,i)=>palette[recipe.swap17And31?(i===17?31:i===31?17:i):i]);assert.deepStrictEqual(assetsTool.decodePicture(name).palette,mapped,name);
  }
  for(const sample of profile.normalizationChecks){const packed=unpack(sample.file),original=assetsTool.decodePicture('Room'+sample.room+'.Pic');
    for(let y=0;y<128;y++)for(let x=0;x<320;x++){let c=packed.pixels[y*320+x],lo=c&31;if(sample.swap17And31&&(lo===17||lo===31))c=(c&32)|(lo===17?31:17);assert.strictEqual(c,original.pixels[y*original.width+x],'room '+sample.room+' at '+x+','+y);}
  }
});
