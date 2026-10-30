'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {binary,token:t,compile}=require('./helpers/program'),{createFakeTimers}=require('./helpers/fakeTimers');
const readPacked=require('../lib/amos/packedPicture'),B=require('../lib/BankReader'),root=path.join(__dirname,'../examples/CompilerExamples');
const vectors=require('./fixtures/compiler-examples/galax-packed.json').images,hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function idle(){const c=createFakeTimers();return{c,p:compile(binary([[t('Wait Key')]])).create({now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout})};}

test('GALAX packed headers: all five immutable bank images match independent Python byte/block/planar expansion',()=>{
  for(const e of vectors){const raw=fs.readFileSync(path.join(root,'Galax',e.name+'.Abk'));assert.strictEqual(hash(raw),e.sourceSha256);const image=readPacked(Uint8Array.from(B.readFile(raw).banks[0].data)),expected=fs.readFileSync(path.join(__dirname,'fixtures/compiler-examples',e.file));
    assert.deepStrictEqual([image.width,image.height,image.depth,image.control],[e.width,e.height,e.depth,e.control]);assert.deepStrictEqual(image.window,e.window);assert.deepStrictEqual(image.palette,e.palette);assert.strictEqual(hash(expected),e.indexedSha256);assert.deepStrictEqual(Buffer.from(image.pixels),expected);
  }
});

test('GALAX packed headers: Unpack To rounds stored placement and preserves all bitmap rows; bitmap-only Unpack ignores unused viewport metadata',()=>{
  const {p}=idle();p.tick(10);
  try{for(const e of vectors){const raw=fs.readFileSync(path.join(root,'Galax',e.name+'.Abk'));p.reserveWork(10,raw.length-20);p.banks.get(10).data.set(raw.subarray(20));
      if(e.name==='PicAst2') {p.display.open(0,320,670,8,0);const owner=p.display.screen(),palette=owner.palette.slice();p.unpackExisting(10);assert.strictEqual(p.display.screen(),owner);assert.deepStrictEqual(owner.palette,palette);p.display.screenDisplay(0,144,56,320,228);p.display.screenOffset(0,0,420);}
      else {p.unpackScreen(10,0);assert.strictEqual(p.display.screen().hardwareX,128);}
      assert.strictEqual(hash(p.display.screen().pixels),e.indexedSha256);p.display.snapshotDisplay();
    }
  }finally{p.stop();}
});

test('GALAX packed headers: invalid active placement/depth rejects atomically, retaining screen, bank addresses and data',()=>{
  const {p}=idle();p.tick(10);const raw=fs.readFileSync(path.join(root,'Galax/PicAst2.Abk'));p.reserveWork(10,raw.length-20);p.banks.get(10).data.set(raw.subarray(20));const address=p.bankStart(10),owner=p.display.screen(),pixels=Buffer.from(owner.pixels);
  assert.throws(()=>p.unpackScreen(10,0),/outside bitmap/);assert.strictEqual(p.display.screen(),owner);assert.deepStrictEqual(Buffer.from(owner.pixels),pixels);assert.strictEqual(p.bankStart(10),address);
  assert.throws(()=>p.unpackExisting(10),/fit current bitmap/);p.banks.get(10).data[20]|=4;assert.throws(()=>p.unpackScreen(10,0),/dimensions\/mode/);assert.strictEqual(p.display.screen(),owner);p.stop();
});

test('GALAX: complete original startup reaches its scrolling menu through actual bank loads, title fade and packed menu image',()=>{
  const {assets}=require('../tools/build_compiler_examples').buildCompilerExamples(),mem=require('../lib/amos/files').createMemoryFiles(Object.fromEntries(Object.entries(assets).map(([n,v])=>[n,Buffer.from(v,'base64').toString('latin1')]))),files={read:n=>mem.read(n.toLowerCase()),isDirectory:n=>mem.isDirectory(n.toLowerCase()),exists:n=>mem.exists(n.toLowerCase())};
  const c=createFakeTimers(),p=compile(fs.readFileSync(path.join(root,'Galax/GALAX.AMOS'))).create({files,now:c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,print(){}});
  try{p.tick(1000);c.tick(20);p.display.snapshotDisplay();c.tick(6600);assert.strictEqual(p.state.location.line,1025);assert.strictEqual(p.state.halted,false);p.display.snapshotDisplay();c.tick(80);assert.strictEqual(p.state.location.line,1025);p.display.snapshotDisplay();}finally{p.stop();assert.strictEqual(c.pending(),0);}
});
