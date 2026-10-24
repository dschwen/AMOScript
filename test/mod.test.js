/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const readMod=require('../lib/amos/mod');
const fixture=require('./fixtures/mod-literal.json');
const bytes=()=>{const b=Buffer.alloc(fixture.byteLength);for(const [offset,hex] of fixture.patches)Buffer.from(hex,'hex').copy(b,offset);return b;};

test('MOD: literal headers, four-channel cells, signed PCM, finetune and loop bounds decode independently',()=>{
  const b=bytes(),before=Buffer.from(b),m=readMod(b);
  assert.strictEqual(m.title,'literal');assert.strictEqual(m.signature,'M.K.');assert.strictEqual(m.channels,4);assert.strictEqual(m.songLength,1);assert.strictEqual(m.restart,127);assert.strictEqual(m.patternCount,1);
  assert.deepStrictEqual(m.patterns[0].slice(0,4),[{sample:1,period:428,effect:12,parameter:32},{sample:1,period:856,effect:0,parameter:7},{sample:0,period:0,effect:10,parameter:10},{sample:0,period:0,effect:14,parameter:1}]);
  assert.deepStrictEqual([m.samples[0].finetune,m.samples[0].volume,m.samples[0].loopStart,m.samples[0].loopLength,m.samples[0].looping],[-1,32,2,6,true]);
  assert.deepStrictEqual(Array.from(m.samples[0].pcm),[-128,127,0,-1,1,2,-2,64]);assert.deepStrictEqual(b,before);
});

test('MOD: all order slots locate sample storage; owned results preserve subarray offsets and factory isolation',()=>{
  const b=bytes(),two=Buffer.alloc(b.length+1024);b.subarray(0,2108).copy(two);b.subarray(2108).copy(two,3132);two[1079]=1;
  const m=readMod(two);assert.strictEqual(m.patternCount,2);assert.strictEqual(m.sampleStart,3132);assert.deepStrictEqual(Array.from(m.orders),[0]);
  const padded=Buffer.concat([Buffer.alloc(3),b,Buffer.alloc(4)]),slice=padded.subarray(3,3+b.length),a=readMod(slice),c=readMod(slice);
  slice[952]=1;slice[2108]=0;slice[1084]=0;assert.strictEqual(a.orderTable[0],0);assert.strictEqual(a.samples[0].pcm[0],-128);assert.strictEqual(a.patterns[0][0].period,428);
  a.samples[0].pcm[0]=0;assert.strictEqual(c.samples[0].pcm[0],-128);
});

test('MOD: truncation, alternate formats, invalid sample/loop fields and trailing bytes reject before playback',()=>{
  for(const size of [0,1083,1084,2108,2115])assert.throws(()=>readMod(bytes().subarray(0,size)),/truncated/);
  for(const [offset,value,expected] of [[950,0,/song length/],[952,128,/pattern number/],[44,16,/finetune/],[45,65,/volume/],[49,4,/loop/],[1084,32,/invalid sample/]]){const b=bytes();b[offset]=value;assert.throws(()=>readMod(b),expected);}
  const sig=bytes();sig.write('6CHN',1080);assert.throws(()=>readMod(sig),/unsupported signature/);
  assert.throws(()=>readMod(Buffer.concat([bytes(),Buffer.from([0])])),/trailing/);assert.throws(()=>readMod(new DataView(bytes().buffer)),/byte storage/);
  assert.throws(()=>readMod(new Uint8Array(16*1024*1024+1)),/16 MiB/);
});

test('MOD: pinned Roller2 module has twelve patterns, ten samples and the measured target effect subset',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'../examples/Roller2/music/mod.Roller_II_mus')),m=readMod(raw),effects={};
  assert.strictEqual(m.title,'mod.Roller_II_mus');assert.strictEqual(m.songLength,22);assert.strictEqual(m.patternCount,12);assert.strictEqual(m.sampleStart,13372);
  assert.deepStrictEqual(m.samples.filter(s=>s.length).map(s=>s.length),[3884,2314,2190,15054,5884,1892,13612,5872,9554,10378]);
  for(const pattern of m.patterns)for(const c of pattern)if(c.effect||c.parameter){const key=c.effect.toString(16)+(c.effect===14?(c.parameter>>4).toString(16):'');effects[key]=(effects[key]||0)+1;}
  assert.deepStrictEqual(effects,{f:12,c:491,a:337,e0:21,d:1});
});
