/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),{execute}=require('./helpers/program');
const raw=fs.readFileSync(path.join(__dirname,'../examples/Roller2/iffp/icons.abk')),expected=require('./fixtures/roller2/icon-copy.json');
function start(){const files=require('../lib/amos/files').createMemoryFiles({icons:raw.toString('latin1')});return{...execute(require('./helpers/roller2IconCopy')(),1000,{files}),files};}
const pointer=(p,number)=>p.leek(p.bankStart(2)+2+(number-1)*8);
const bytes=(p,address,length)=>Buffer.from(Array.from({length},(_,i)=>p.peek(address+i)));

test('icon memory: native table/header/planar aliases match independent bytes; metadata and mask pointers reject unsupported access',()=>{
  const {program:p}=start(),base=p.bankStart(2);assert.strictEqual(p.deek(base),117);assert.strictEqual(p.bankStart(2),base);
  for(const number of [18,29,74,76]){const item=expected.images[number],address=pointer(p,number);
    assert.deepStrictEqual([p.deek(address),p.deek(address+2),p.deek(address+4)],[1,16,6]);assert.strictEqual(bytes(p,address+10,192).toString('hex'),item.planarHex);
    const before=p.banks.get(2).images[number-1].pixels.slice();for(const write of [()=>p.poke(address,0),()=>p.doke(address+9,0),()=>p.loke(base+2+(number-1)*8,0)])assert.throws(write,/table\/header writes/);
    assert.deepStrictEqual(p.banks.get(2).images[number-1].pixels,before);assert.throws(()=>p.leek(base+6+(number-1)*8),/mask pointers/);
  }
  p.banks.get(2).images.forEach((image,index)=>{if(!image)assert.strictEqual(pointer(p,index+1),0);});
  for(let i=0;i<32;i++)assert.strictEqual(p.deek(base+2+117*8+i*2),expected.palette[i]);p.stop();
});

test('icon memory: original inclusive ICCOPY copies all 192 plane bytes plus owned padding, preserving stale masks and image identity',()=>{
  const {program:p,timers:c,files}=start(),bank=p.banks.get(2),old=bank.images[17],mask=old.mask.slice(),source=pointer(p,76),dest=pointer(p,18);
  assert.strictEqual(p.peek(source+202),0);p.poke(source+202,0x7e);p.sendKey('copy');c.tick(0);
  assert.strictEqual(p.state.waiting,'key');assert.strictEqual(bank.images[17],old);assert.strictEqual(pointer(p,18),dest);
  for(const [a,b]of [[76,18],[74,29]]){assert.strictEqual(bytes(p,pointer(p,b)+10,192).toString('hex'),expected.images[a].planarHex);assert.strictEqual(Buffer.from(bank.images[b-1].pixels).toString('hex'),expected.images[a].pixelsHex);}
  assert.strictEqual(p.peek(dest+202),0x7e);assert.deepStrictEqual(old.mask,mask);assert.throws(()=>p.peek(dest+208),/out of bounds/);
  const before=bytes(p,dest+10,198);assert.throws(()=>p.loke(dest+206,0),/out of bounds/);assert.deepStrictEqual(bytes(p,dest+10,198),before);
  p.bsave('plane',source+10,source+203);assert.strictEqual(files.read('plane').length,193);assert.strictEqual(files.read('plane').charCodeAt(192),0x7e);
  p.saveBanks('saved',2);const saved=Buffer.from(files.read('saved'),'latin1'),want=Buffer.from(raw);
  for(const [a,b]of [[76,18],[74,29]])Buffer.from(expected.images[a].planarHex,'hex').copy(want,expected.images[b].dataOffset);
  assert.deepStrictEqual(saved,want);p.makeIconMask(18);assert.ok(old.mask.every((value,index)=>value===(old.pixels[index]===0?0:1)));p.stop();
});

test('icon memory: orientation and canonical pixel changes are visible through existing pointers without cached planar state',()=>{
  const {program:p,files}=start(),address=pointer(p,76),original=Buffer.from(expected.images[76].planarHex,'hex');
  p.pasteIcon(0,32,76|0x8000);assert.strictEqual(pointer(p,76),address);assert.strictEqual(p.deek(address+6),0x8010);
  const reverse=value=>parseInt(value.toString(2).padStart(8,'0').split('').reverse().join(''),2),flipped=Buffer.alloc(192);
  for(let i=0;i<192;i+=2){flipped[i]=reverse(original[i+1]);flipped[i+1]=reverse(original[i]);}
  assert.deepStrictEqual(bytes(p,address+10,192),flipped);p.saveBanks('normal',2);assert.deepStrictEqual(Buffer.from(files.read('normal'),'latin1'),raw);
  assert.strictEqual(pointer(p,76),address);assert.deepStrictEqual(bytes(p,address+10,192),original);
  p.banks.get(2).images[75].pixels[0]^=1;assert.strictEqual(p.peek(address+10),original[0]^128);p.stop();
});

test('icon memory: swaps retain table/record addresses; reload, append and image replacement retire every old region',()=>{
  const {program:p}=start();let base=p.bankStart(2),address=pointer(p,18);p.swapBanks(2,3);assert.strictEqual(p.bankStart(3),base);assert.strictEqual(p.deek(address),1);p.swapBanks(2,3);
  for(const replace of [()=>p.loadBanks('icons'),()=>p.loadBanks('icons',2),()=>{const bank=p.banks.get(2);bank.images[17]={...bank.images[17],pixels:bank.images[17].pixels.slice()};}]){
    replace();assert.throws(()=>p.peek(base),/retired/);assert.throws(()=>p.peek(address+202),/retired/);base=p.bankStart(2);address=pointer(p,18);
  }
  p.eraseBank(2);assert.throws(()=>p.peek(address),/retired/);p.stop();
});

test('icon memory: Bload preflights protected/cross-record ranges and Bsave validates before truncation',()=>{
  const {program:p,files}=start(),address=pointer(p,18),base=p.bankStart(2),image=p.banks.get(2).images[17],before=image.pixels.slice();
  files.write('span','\xff\xff');assert.throws(()=>p.bload('span',address+9),/table\/header writes/);assert.deepStrictEqual(image.pixels,before);
  assert.throws(()=>p.bload('span',address+207),/out of bounds/);assert.deepStrictEqual(image.pixels,before);
  files.write('guarded','keep');assert.throws(()=>p.bsave('guarded',base+2,base+7),/mask pointers/);assert.strictEqual(files.read('guarded'),'keep');
  files.write('empty','');p.bload('empty',address+208);assert.deepStrictEqual(image.pixels,before);
  files.write('zero','\0'.repeat(193));const mask=image.mask.slice();p.bload('zero',address+10);assert.ok(image.pixels.every(value=>value===0));assert.deepStrictEqual(image.mask,mask);
  image.width=32;assert.throws(()=>p.peek(address),/retired/);assert.throws(()=>p.bankStart(2),/Unsupported raw icon record/);image.width=16;assert.notStrictEqual(p.bankStart(2),base);p.stop();
});
