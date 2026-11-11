'use strict';
const assert=require('assert'),fs=require('fs'),T=require('../lib/Transpiler'),oracle=require('./fixtures/amcaf/fonts.json'),codec=require('../lib/amos/amcafBankFont')();
const {binary,token:t,execute}=require('./helpers/program');
function original(){const m={exports:{}};new Function('module',new T(fs.readFileSync('examples/AMCAF/AMCAF_Examples/Fonts.AMOS'),{extensions:{8:'amcaf-1.50beta4'}}).toModule())(m);const clock=require('./helpers/fakeTimers').createFakeTimers(),font=require('../examples/AMCAF/fonts/topaz-16.json');return{clock,p:m.exports({...clock,print(){},displayOptions:{diskFonts:[{...font,data:Uint8Array.from(Buffer.from(font.data,'base64'))}]}})};}
test('AMCAF fonts: unchanged original reaches both prompts, matches independent native-bit regions and captures/reloads its host font',()=>{
 const{p,clock}=original();p.tick(10000);for(let stage=0;stage<2;stage++){assert.strictEqual(p.state.waiting,'key');for(const region of oracle.regions.filter(r=>r.stage===stage))for(let row=0;row<region.height;row++)assert.deepStrictEqual(Array.from(p.display.screen().pixels.slice((region.top+row)*320,(region.top+row+1)*320)),region.rows[row]);p.sendKey(' ');p.tick(10000);}
 assert(p.state.halted);assert.strictEqual(clock.pending(),0);assert.strictEqual(codec.decode(p.banks.get(11).data).height,16);
});
test('AMCAF fonts: exported bank roundtrip preserves proportional metrics, fallback glyphs and owned bitmap bytes',()=>{
 const{p}=original();p.tick(10000);const a=codec.decode(p.banks.get(8).data),bytes=codec.encode(a),b=codec.decode(bytes);
 for(const key of ['data','widths','bearings','advances'])assert.deepStrictEqual(Array.from(b[key]),Array.from(a[key]));assert.strictEqual(p.display.textLength('Hello World!'),12*16);bytes.fill(0);assert(b.data.some(Boolean));p.stop();
});
test('AMCAF fonts: live bank edits, swaps, malformed selection and retirement are checked without replacing the selected font on failure',()=>{
 const{p}=original();p.tick(10000);p.extensionChangeBankFont(8);const bank=p.banks.get(8),before=p.display.textLength('Hello World!');assert.strictEqual(before,oracle.helloWidth);
 p.reserveWork(20,128);assert.throws(()=>p.extensionChangeBankFont(20),/FONT/);assert.strictEqual(p.display.textLength('Hello World!'),before);
 p.swapBanks(8,20);assert.strictEqual(p.display.textLength('Hello World!'),before);
 const addr=p.bankStart(20),offset=(bank.data[16]*16777216+bank.data[17]*65536+bank.data[18]*256+bank.data[19])+('H'.charCodeAt(0)-bank.data[56])*2;
 const spacing=p.deek(addr+offset);p.doke(addr+offset,spacing+1);assert.strictEqual(p.display.textLength('Hello World!'),before+1);
 p.eraseBank(20);assert.throws(()=>p.display.textLength('A'),/retired/);p.stop();
});
module.exports={original};
test('AMCAF font decoder: malformed offsets, geometry, table lengths and colour fonts reject completely',()=>{
 const{p}=original();p.tick(10000);const good=Uint8Array.from(p.banks.get(8).data);
 for(const mutate of [b=>b[0]=0,b=>b[44]=1,b=>b[46]|=64,b=>b[8]=127,b=>b[12]=127,b=>b[16]=127,b=>b[20]=127,b=>b[63]|=1,b=>b[56]=255]){const b=good.slice();mutate(b);assert.throws(()=>codec.decode(b),/Bank font/);}
 assert.throws(()=>codec.decode(good.subarray(0,105)),/truncated/);assert(codec.decode(good).data.some(Boolean));p.stop();
});
