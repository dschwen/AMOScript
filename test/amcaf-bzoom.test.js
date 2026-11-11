'use strict';
const assert=require('assert'),fs=require('fs'),crypto=require('crypto'),original=require('./helpers/amcafOriginal'),oracle=require('./fixtures/amcaf/bzoom.json');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
test('AMCAF ANIM: original raw-file animation decodes all 42 frames against independent byte/plane hashes',()=>{
 const data=fs.readFileSync('examples/AMCAF/AMCAF_Examples/Data/AMCAF.Anim'),a=require('../lib/amos/anim')(data);assert.strictEqual(hash(data),oracle.assetSha256);assert.strictEqual(a.frames.length,42);a.frames.forEach((frame,i)=>{assert.strictEqual(hash(frame.pixels),oracle.frames[i].sha256);assert.strictEqual(frame.sourceOffset,oracle.frames[i].offset);});
});
test('AMCAF Bzoom player: original raw load, extra sentinel, bank continuations and two-buffer crop replay match 90 independent frames including loops',()=>{
 const{p,clock}=original('BZoomAnimPlayer'),swap=p.display.swap;let frames=0;
 p.display.swap=(...args)=>{swap(...args);if(p.display.screens.has(1)&&frames<90)assert.strictEqual(hash(p.display.screen(1).physicalPixels),oracle.application[frames++]);};
 p.tick(10000);while(frames<90&&clock.now()<10000)clock.tick(20);assert.strictEqual(frames,90);p.sendKey('\x1b');clock.tick(80);assert(p.state.halted);assert.strictEqual(p.display.screens.size,0);assert.strictEqual(clock.pending(),0);
});
test('AMCAF Bzoom: nibble factors and byte/word alignment write raw destination planes and preflight invalid or aliased extents',()=>{
 const d=require('../lib/amos/display')();d.open(0,64,8,16,0);for(let y=0;y<8;y++)for(let x=0;x<64;x++)d.screen().pixels[y*64+x]=(x+y)&15;d.open(1,128,64,4,0);d.clear(3);d.doubleBuffer();d.autoback(2);
 d.bzoom(0,1,1,25,4,1,15,2,0x24);for(let y=0;y<64;y++)for(let x=0;x<128;x++)assert.strictEqual(d.screen(1).pixels[y*128+x],x<96&&y>=2&&y<8?((Math.floor(x/4)+1+Math.floor((y-2)/2))&3):3);
 assert(d.screen(1).physicalPixels.every(v=>v===3));const before=d.screen(1).pixels.slice();for(const args of [[0,0,0,8,1,1,0,0,0x23],[0,0,0,8,1,1,0,0,0x02],[0,0,0,64,8,1,0,0,0x88],[1,0,0,8,1,1,0,0,0x11]])assert.throws(()=>d.bzoom(...args));assert.deepStrictEqual(d.screen(1).pixels,before);
});
test('AMCAF object metadata: synchronous stat snapshots size without reading file contents, preserves the last snapshot on failure and respects prefix resolution',()=>{
 const calls=[],metadata={size:123,directory:false},{p}=original('GamePorts',{files:{stat:name=>{calls.push(name);return metadata;},read(){throw Error('Unexpected read');}}});
 assert.throws(()=>p.extensionObjectSize(),/first/);p.extensionExamineObject('a');metadata.size=456;assert.strictEqual(p.extensionObjectSize(),123);metadata.size=-1;assert.throws(()=>p.extensionExamineObject('b'),/metadata/);assert.strictEqual(p.extensionObjectSize(),123);metadata.size=7;assert.strictEqual(p.extensionObjectSizeNamed('c'),7);assert.deepStrictEqual(calls,['a','b','c']);p.stop();
});
test('raw ANIM banks: swap preserves frame addresses; mutated/truncated payloads revalidate before screen replacement and erasure retires pointers',()=>{
 const{p}=original('BZoomAnimPlayer');p.tick(10000);const addr=p.bankStart(9),screen=p.display.screen(0),pixels=screen.pixels.slice(),old=p.peek(addr+32);p.poke(addr+32,1);assert.throws(()=>p.framePlay(addr+12,1,0),/ILBM|ANIM/);assert.strictEqual(p.display.screen(0),screen);assert.deepStrictEqual(screen.pixels,pixels);p.poke(addr+32,old);p.swapBanks(9,20);const next=p.framePlay(addr+12,1,0);assert.strictEqual(next,addr+oracle.frames[1].offset);p.shrinkBank(20,p.bankLength(20)-2);assert.throws(()=>p.framePlay(addr+12,1,0),/exact ANIM/);p.eraseBank(20);assert.throws(()=>p.framePlay(next,1),/bounds/);p.stop();
});
