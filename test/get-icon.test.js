/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {binary,token:t,integer:n,word:w,dword,identifier:id,text,compile,execute}=require('./helpers/program');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const open=(number=0,width=32,height=8,colours=64)=>[t('Screen Open'),n(number),t(','),n(width),t(','),n(height),t(','),n(colours),t(','),t('Lowres')];
const get=(number,x1,y1,x2,y2)=>[t('Get Icon'),n(number),t(','),n(x1),t(','),n(y1),t('To'),n(x2),t(','),n(y2)];
function program(){return execute(binary([[t('Wait Key')]])).program;}

test('Get Icon: exclusive odd-origin capture pads each row to 16, keeps raw planes and has zero hotspots/no mask without drawing',()=>{
  const p=program(),d=p.display,s=d.screen();s.pixels.forEach((_,i)=>{s.pixels[i]=(i*7+Math.floor(i/320))&15;});const before=s.pixels.slice(),revision=d.version,xy=[s.x,s.y,s.gx,s.gy];
  p.getIcon(3,3,2,20,5);const bank=p.banks.get(2),image=bank.images[2];assert.deepStrictEqual(Array.from(bank.images.slice(0,2)),[null,null]);assert.deepStrictEqual([image.width,image.height,image.depth,image.hotspotX,image.hotspotY,image.orientation,image.masked,image.mask],[32,3,4,0,0,0,false,null]);
  for(let y=0;y<3;y++)for(let x=0;x<32;x++)assert.strictEqual(image.pixels[y*32+x],x<17?before[(y+2)*320+x+3]:0);
  assert.deepStrictEqual(bank.palette,s.palette);assert.notStrictEqual(bank.palette,s.palette);assert.deepStrictEqual(s.pixels,before);assert.deepStrictEqual([s.x,s.y,s.gx,s.gy],xy);assert.strictEqual(d.version,revision);p.stop();
  const q=program();q.display.open(1,16,8,64,0);q.display.screen().pixels.fill(63);q.getIcon(1,0,0,16,8);assert.strictEqual(q.banks.get(2).images[0].depth,6);assert.ok(q.banks.get(2).images[0].pixels.every(v=>v===63));q.stop();
});

test('Get Icon: explicit source uses logical pixels, selected palette on creation and existing palette on growth/replacement',()=>{
  const p=program(),d=p.display;
  d.open(1,32,8,16,0);d.doubleBuffer();d.autoback(2);const source=d.screen();source.pixels.fill(3);source.physicalPixels.fill(7);source.palette[1]=0xf00;d.select(0);d.screen().palette[1]=0x123;
  p.getIcon(1,1,1,1,18,4);const bank=p.banks.get(2),first=bank.images[0],base=p.bankStart(2);assert.strictEqual(d.current,0);assert.strictEqual(bank.palette[1],0x123);assert.ok(first.pixels.every((v,i)=>i%32<17?v===3:v===0));assert.ok(source.physicalPixels.every(v=>v===7));
  const record=p.leek(base+2);p.makeIconMask(1);assert.strictEqual(first.masked,true);const palette=bank.palette,oldPixels=first.pixels;d.screen().palette[1]=0x456;p.getIcon(1,1,0,0,2,2);assert.strictEqual(p.banks.get(2),bank);assert.strictEqual(bank.palette,palette);assert.strictEqual(bank.palette[1],0x123);assert.notStrictEqual(bank.images[0],first);assert.strictEqual(bank.images[0].masked,false);assert.deepStrictEqual(first.pixels,oldPixels);assert.throws(()=>p.peek(base),/retired/);assert.throws(()=>p.peek(record),/retired/);
  const retained=bank.images[0],next=p.bankStart(2);p.getIcon(1,5,0,0,1,1);assert.strictEqual(bank.images[0],retained);assert.strictEqual(bank.images.length,5);assert.strictEqual(bank.images[3],null);assert.throws(()=>p.peek(next),/retired/);p.stop();
});

test('Get Icon: held Bob pixels are captured as stored without restoring backgrounds, replaying Autoback or changing ownership',()=>{
  const banks=Buffer.from(fs.readFileSync(path.join(__dirname,'fixtures/image-banks.hex'),'utf8').replace(/\s/g,''),'hex');
  const {program:p}=execute(Buffer.concat([binary([open(0,64,32,4),[t('Cls Colour'),n(3)],[t('Double Buffer')],[t('Autoback'),n(2)],
    [t('Hot Spot'),n(1),t(','),n(0),t(','),n(0)],[t('Bob'),n(0),t(','),n(2),t(','),n(8),t(','),n(1)],[t('Bob Update')],[t('Wait Key')]]),banks.subarray(20)]));
  const s=p.display.screen(),logical=s.pixels.slice(),physical=s.physicalPixels.slice(),bob=p.bobs.get(0);
  p.getIcon(2,0,8,16,10);assert.strictEqual(p.bobs.get(0),bob);assert.deepStrictEqual(s.pixels,logical);assert.deepStrictEqual(s.physicalPixels,physical);
  const image=p.banks.get(2).images[1];for(let y=0;y<2;y++)for(let x=0;x<16;x++)assert.strictEqual(image.pixels[y*16+x],logical[(8+y)*64+x]);assert.ok(image.pixels.every(v=>v===3));assert.ok(physical.some(v=>v!==3));p.display.swap(0);p.getIcon(3,0,8,16,10);const held=p.banks.get(2).images[2];assert.ok(held.pixels.some(v=>v!==3));p.bobOff(0);p.updateBobs();assert.ok(held.pixels.some(v=>v!==3));p.stop();
});

test('Get Icon: both original signatures accept typed DATA/array/procedure/boxed arguments and evaluate each expression once in source order',()=>{
  const {program:p}=execute(binary([open(),[t('Data'),w(0),n(1)],[t('Read'),id('number')],[t('Dim'),id('a'),t('('),n(1),t(')')],[id('a'),t('('),n(1),t(')'),t('='),n(3)],
    [t('Procedure'),dword(0),w(0),0,0,id('edge')],[t('End Proc'),t('['),t('Val'),t('('),text('4.9'),t(')'),t(']')],[id('edge',0x12)],
    [w(0x1cc6),id('number'),t(','),n(0),t(','),n(0),t('To'),id('a'),t('('),n(1),t(')'),t(','),t('Param#')],[t('Wait Key')]]));assert.strictEqual(p.banks.get(2).images[0].height,4);p.stop();
  const calls=[],v=name=>[t('Val'),t('('),t('Fsel$'),t('('),text(name),t(')'),t(')')];
  const {program:q}=execute(binary([[w(0x1cde),v('s'),t(','),v('n'),t(','),v('x1'),t(','),v('y1'),t('To'),v('x2'),t(','),v('y2')],[t('Wait Key')]]),1000,{files:{select({path}){calls.push(path);return {s:'0',n:'2.9',x1:'1',y1:'2',x2:'4',y2:'5'}[path];}}});assert.deepStrictEqual(calls,['s','n','x1','y1','x2','y2']);assert.strictEqual(q.banks.get(2).images[1].height,3);q.stop();
  assert.throws(()=>compile(binary([[t('Get Icon'),text('1'),t(','),n(0),t(','),n(0),t('To'),n(1),t(','),n(1)]])),/numeric.*line 1/);
  assert.throws(()=>compile(binary([[t('Get Icon'),n(1),t(','),n(0),t(','),n(0),t(','),n(1),t(','),n(1)]])),/Expected To/);
});

test('Get Icon: invalid geometry/index/payload/source/type preflights before replacement, mask loss or address retirement',()=>{
  const p=program();p.getIcon(1,0,0,16,2);p.makeIconMask(1);const bank=p.banks.get(2),image=bank.images[0],base=p.bankStart(2),revision=p.display.version;
  for(const args of [[],[1,0,0,1],[0,1,0,0,1,1,2],[0,0,0,1,1],[16384,0,0,1,1],[1,-1,0,1,1],[1,0,-1,1,1],[1,0,0,321,1],[1,0,0,1,201],[1,1,0,1,1],[1,0,1,1,1],[7,1,0,0,1,1]]){assert.throws(()=>p.getIcon(...args),/Get Icon|not open/);assert.strictEqual(bank.images[0],image);assert.strictEqual(image.masked,true);assert.strictEqual(p.deek(base),1);assert.strictEqual(p.display.version,revision);}
  p.display.open(1,1024,1023,64,0);assert.throws(()=>p.getIcon(1,0,0,1024,1023),/payload size/);assert.strictEqual(bank.images[0],image);p.display.close(1);p.display.close(0);assert.throws(()=>p.getIcon(1,0,0,1,1),/not open/);p.stop();
  const q=program();q.reserveWork(2,8);const old=q.banks.get(2);assert.throws(()=>q.getIcon(1,0,0,1,1),/icon bank/);assert.strictEqual(q.banks.get(2),old);q.stop();
  assert.throws(()=>execute(binary([get(1,0,0,321,1)])),/Invalid Get Icon.*line 1, byte/);
});

test('Get Icon: Save wire bytes independently encode rounded rows, plane order and new-bank palette, then reload in another factory',()=>{
  const files=require('../lib/amos/files').createMemoryFiles(),p=program();p.display.open(0,16,4,4,0);p.display.setPalette(...Array(32).fill(0));p.display.setColour(1,0x123);const s=p.display.screen();s.pixels.set([1,2,3],17);s.pixels.set([0,3,1],33);p.getIcon(1,1,1,4,3);
  const bytes=require('../lib/BankWriter').write([p.banks.get(2)],false),expected='416d4963000100010002000200000000a000600060004000'+'00000123'+'0000'.repeat(30);assert.strictEqual(Buffer.from(bytes).toString('hex'),expected);files.write('captured',Buffer.from(bytes).toString('latin1'));
  const {program:q}=execute(binary([[t('Load'),text('captured')],[t('Wait Key')]]),1000,{files});assert.deepStrictEqual(Array.from(q.banks.get(2).images[0].pixels),Array.from(p.banks.get(2).images[0].pixels));assert.notStrictEqual(q.banks.get(2),p.banks.get(2));q.banks.get(2).images[0].pixels[0]=3;assert.strictEqual(p.banks.get(2).images[0].pixels[0],1);p.stop();q.stop();
});

test('Roller2 Get Icon: original requester/overwrite captures and restores match independent raw-icon/pattern PNGs and captured image hashes',()=>{
  const icons=fs.readFileSync(path.join(__dirname,'../examples/Roller2/iffp/icons.abk'),'latin1'),frames=require('./fixtures/roller2/get-icon.json').frames;
  for(const overwrite of [false,true]){const calls=[],{program:p,timers:c}=execute(require('./helpers/roller2GetIcon')(overwrite),5000,{files:{read:()=>icons,exists(name){calls.push(name);return false;}}});
    for(let stage=0;stage<3;stage++){if(stage){p.sendKey('next');c.tick(stage===1?100:0);}const frame=frames[(overwrite?3:0)+stage],s=p.display.screen(),rgba=p.display.canvasFrame().rgba;assert.strictEqual(p.state.waiting,'key');assert.strictEqual(hash(s.pixels),frame.indicesSha256);assert.strictEqual(hash(rgba),frame.rgbaSha256);const png=require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/roller2',frame.png))).rgba;assert.deepStrictEqual(Buffer.from(rgba),Buffer.from(png));if(stage){const image=p.banks.get(2).images[117];assert.deepStrictEqual([image.width,image.height,image.depth,image.masked],[112,overwrite?70:40,6,true]);assert.strictEqual(hash(image.pixels),frame.captureSha256);}}
    if(!overwrite){assert.deepStrictEqual(calls,['RII:levl/1']);p.sendKey('return');c.tick(0);assert.strictEqual(p.state.frames.length,0);assert.strictEqual(p.state.waiting,'key');}p.stop();assert.strictEqual(c.pending(),0);
  }
});
