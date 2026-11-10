'use strict';
const assert=require('assert'),fs=require('fs'),crypto=require('crypto'),vm=require('vm');
const decode=require('../lib/amos/amcafImploder');
const {binary,token:t,word:w,integer:n,text}=require('./helpers/program');
function literal(){
  const b=Buffer.alloc(114);b.write('IMP!');b.writeUInt32BE(64,4);b.writeUInt32BE(64,8);
  for(let i=12;i<64;i++)b[i]=i;
  for(let i=0;i<12;i++)b[64+(i<4?8+i:i<8?i:i-8)]=i;
  b.writeUInt32BE(64,76);b.writeUInt16BE(0x8000,80);
  let sum=7;for(let i=0;i<110;i+=2)sum=(sum+b.readUInt16BE(i))>>>0;b.writeUInt32BE(sum,110);return b;
}
test('AMCAF Imploder: independent literal bytes, ownership, checksum and malformed length bounds',()=>{
  for(const unpack of [decode,vm.runInNewContext('('+decode.toString()+')')]){
    const b=literal(),saved=Buffer.from(b),out=unpack(b,{verifyChecksum:true});
    assert.deepStrictEqual(Array.from(out),Array.from({length:64},(_,i)=>i));assert.deepStrictEqual(b,saved);
    out[0]=255;assert.deepStrictEqual(b,saved);
    const bad=Buffer.from(b);bad[113]^=1;assert.throws(()=>unpack(bad,{verifyChecksum:true}),/checksum/);
    assert.strictEqual(unpack(bad).length,64);
    for(const length of [0,1,61,100])assert.throws(()=>unpack(b.subarray(0,length)),/Imploder/);
    for(const size of [0,16777217]){const bad=Buffer.from(b);bad.writeUInt32BE(size,4);assert.throws(()=>unpack(bad),/lengths/);}
    const badRun=Buffer.from(b);badRun.writeUInt32BE(65,76);assert.throws(()=>unpack(badRun),/literal run/);
  }
});
test('AMCAF Imploder: backward overlapping matches and native zero-byte 256 count',()=>{
  for(const size of [64,257]){
    const b=Buffer.alloc(66);b.write('IMP!');b.writeUInt32BE(size,4);b.writeUInt32BE(16,8);
    // One literal Z, then a distance-one match; byte zero means 256 natively.
    b[12]=0;b[13]=(size-1)&255;b[14]=90;b.writeUInt32BE(1,28);b.writeUInt16BE(0xf9,32);b.fill(1,50,62);
    const out=decode(b);assert.strictEqual(out.length,size);assert(out.every(v=>v===90));
    const bad=Buffer.from(b);bad[53]=255;assert.throws(()=>decode(bad),/bit count/);
    bad.set(b);bad.writeUInt32BE(size-1,4);assert.throws(()=>decode(bad),/match exceeds/);
  }
});
test('AMCAF Imploder: supplied packed data has pinned expanded lengths and digests',()=>{
  for(const[name,length,hash]of [
    ['mod.hawkeye',62068,'847b4017191e92ab5140d447d4edf218186237d10f9ed96e277ed285cf45013a'],
    ['AMCAFAdvert.Abk',162468,'99e6fef30636d9b8e443f654cde429cfa6b72e05653b9c0eddca858ddee97ab4'],
    ['MyBootLogo.raw',327680,'c63b4f8385ce6da2c3213c8130edccd9dd618683813e80ceb7532a6cfbcecd17']]){
    const data=decode(fs.readFileSync(__dirname+'/../examples/AMCAF/AMCAF_Examples/Data/'+name),{verifyChecksum:true});
    assert.strictEqual(data.length,length);assert.strictEqual(crypto.createHash('sha256').update(data).digest('hex'),hash);
  }
});
test('AMCAF Imploder: embedded original Fonts bank decodes without altering bank bytes',()=>{
  const banks=new(require('../lib/BankReader'))(new(require('../lib/Buffer'))(fs.readFileSync(__dirname+'/../examples/AMCAF/AMCAF_Examples/Fonts.AMOS'))).read();
  const b=Uint8Array.from(banks.find(b=>b.number===9).data),before=b.slice(),out=decode(b,{verifyChecksum:true});
  assert.strictEqual(out.length,13474);assert.strictEqual(crypto.createHash('sha256').update(out).digest('hex'),'eb290493ea691d47958308d19d753580b4704f11efc2e315b59943a45a3cdf70');
  assert.deepStrictEqual(b,before);
});
test('AMCAF Imploder: standalone Load and Unpack preserve source and reject mutations on decode failure',()=>{
  const ext=off=>[w(0x4e),[8,0],w(off)],module={exports:{}};
  const source=binary([[ext(0x0ea2),text('packed'),t(','),n(9)],[t('Wait Key')],[ext(0x0e8a),n(9),t('To'),n(-8)],[t('Wait Key')]]);
  // Load raw bytes containing a packed stream through a separate plain source.
  const initial=literal(),factorySource=new(require('../lib/Transpiler'))(source,{extensions:{8:'amcaf-1.50beta4'}}).toModule();
  vm.runInNewContext(factorySource,{module});
  let contents=initial.toString('latin1');
  const p=module.exports({...require('./helpers/fakeTimers').createFakeTimers(),files:{read:()=>contents}});
  try{
    // Load decodes directly; replace the source with the packed bytes to test Unpack independently.
    p.tick(100);assert.strictEqual(p.banks.get(9).data.length,64);
    p.reserveWork(9,initial.length);const address=p.bankStart(9);for(let i=0;i<initial.length;i++)p.poke(address+i,initial[i]);
    p.sendKey('x');p.tick(100);assert.strictEqual(p.banks.get(8).memory,'chip');assert.strictEqual(p.banks.get(8).permanent,false);
    assert.deepStrictEqual(Array.from(p.banks.get(8).data),Array.from({length:64},(_,i)=>i));assert.strictEqual(p.bankStart(9),address);
    const target=p.banks.get(8);p.poke(address,0);assert.throws(()=>p.extensionImploderUnpack(9,8),/IMP!/);assert.strictEqual(p.banks.get(8),target);
    assert.throws(()=>p.extensionImploderUnpack(9,9),/different/);
    contents='ordinary raw data';p.extensionImploderLoad('raw',-7);assert.strictEqual(p.banks.get(7).memory,'chip');assert.strictEqual(Buffer.from(p.banks.get(7).data).toString(),contents);
    const raw=p.banks.get(7);for(const invalid of ['PP20........',Promise.resolve('bytes'),'short','non-byte \u0100 string']){
      contents=invalid;assert.throws(()=>p.extensionImploderLoad('invalid',7),/PP20|byte|12 bytes/);assert.strictEqual(p.banks.get(7),raw);
    }
  }finally{p.stop();}
});
