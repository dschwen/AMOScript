'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {binary,token:t,word:w,integer:n,identifier:id,text,compile,execute,dword}=require('./helpers/program');
const {buildTutorial}=require('../tools/build_tutorial');
const createDisplay=require('../lib/amos/display');
const {createMemoryFiles}=require('../lib/amos/files');
const {createFakeTimers}=require('./helpers/fakeTimers');

test('Tutorial: catalogue preserves all 43 originals, versioned backups, assets and explicit failure pages',()=>{
  const b=buildTutorial({repository:true});
  assert.strictEqual(b.programs.length,43);
  assert.strictEqual(b.programs.filter(p=>p.compiled).length,30);
  assert.strictEqual(new Set(b.programs.map(p=>p.file)).size,43);
  for(const p of b.programs){assert.ok(/^[0-9a-f]{64}$/.test(p.sha256));const page=b.outputs.get(p.file);assert.ok(page.includes('Tutorial catalogue'));assert.ok(b.outputs.get('tutorial.html').includes('https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/'+p.file));if(!p.compiled)assert.ok(page.includes('does not compile yet'));}
  assert.ok(b.assets['amospro_tutorial:objects/bobs.abk']);
  assert.ok(b.assets['amospro_tutorial:tutorials/interface/example_resource.abk']);
});

test('Tutorial: every currently built original reaches its initial loop/wait and renders without source or filesystem edits',()=>{
  const b=buildTutorial(),assets=Object.fromEntries(Object.entries(b.assets).map(([key,value])=>[key,Buffer.from(value,'base64').toString('latin1')]));
  for(const item of b.programs.filter(p=>p.compiled)){
    const timers=createFakeTimers(),memory=createMemoryFiles(assets);
    const files={read:name=>memory.read(name.toLowerCase()),exists:name=>memory.exists(name.toLowerCase()),write:(name,bytes)=>memory.write(name.toLowerCase(),bytes)};
    const p=compile(fs.readFileSync(path.join(__dirname,'../examples/Tutorial',item.source))).create({print(){},files,now:timers.now,setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout});
    try{p.tick(10000);assert.ok(!p.state.error,item.source);assert.ok(p.state.location.line>0);const out=p.display.renderDisplay();assert.ok(out.length>0,item.source);}finally{p.stop();}
    assert.strictEqual(timers.pending(),0,item.source);
  }
});

test('Tutorial: dotted Basic and spaced Pro headers retain strict binary bounds and exact signatures',()=>{
  const B=require('../lib/Buffer');
  for(const header of ['AMOS Basic v1.34','AMOS Basic V1.34','AMOS Pro   v1.00','AMOS Pro   V1.00']){
    const bytes=binary([[t('End')]]);bytes.write(header,0,'latin1');assert.strictEqual(new B(bytes).magic,header);assert.ok(compile(bytes).create);
    const bad=Buffer.from(bytes);bad.writeUInt32BE(0x7fffffff,16);assert.throws(()=>new B(bad),/bounds|range|Truncated/i);
  }
  const bad=binary([[t('End')]]);bad.write('AMOS Basic v1.35',0,'latin1');assert.throws(()=>new B(bad),/Invalid AMOS/);
});

test('Tutorial: Appear follows independent stride/count positions, common-plane retention and live aliases',()=>{
  const d=createDisplay();d.open(0,16,2,16,0);d.open(1,16,2,4,0);
  d.screen(1).pixels.set(Array.from({length:32},(_,i)=>i%4));d.screen(0).pixels.fill(12);
  d.appear(1,0,5,7);const visited=new Set([5,10,15,20,25,30,3]);
  for(let i=0;i<32;i++)assert.strictEqual(d.screen(0).pixels[i],visited.has(i)?12+(i%4):12);
  d.appear(1,0,3);for(let i=0;i<32;i++)assert.strictEqual(d.screen(0).pixels[i],12+(i%4));
  const before=d.screen(0).pixels.slice();d.appear(0,0,7);assert.deepStrictEqual(d.screen(0).pixels,before);
  for(const args of [[1,0,0],[1,0,-1],[1,0,3,-1],[1,0,3,33]]){assert.throws(()=>d.appear(...args));assert.deepStrictEqual(d.screen(0).pixels,before);}
  const {program:p}=execute(binary([[t('Screen Open'),n(1),t(','),n(16),t(','),n(2),t(','),n(4),t(','),t('Lowres')],[t('Cls Colour'),n(3)],[t('Screen Open'),n(0),t(','),n(16),t(','),n(2),t(','),n(4),t(','),t('Lowres')],[t('Appear'),n(1),t('To'),n(0),t(','),n(5),t(','),n(7)],[t('Wait Key')]]));assert.strictEqual(Array.from(p.display.screen(0).pixels).filter(v=>v===3).length,7);p.stop();
});

test('Tutorial: patterns match original planar pixels and Set Paint adds a solid border without changing the pattern',()=>{
  const BankReader=require('../lib/BankReader');const bank=BankReader.readFile(fs.readFileSync(path.join(__dirname,'fixtures/tutorial/amos-pro-mouse.abk'))).banks[0];
  const d=createDisplay();d.open(0,32,32,16,0);d.ink(5,2,7);
  for(const number of [2,9,22,35]){d.setPattern(number);d.bar(0,0,31,31);const image=bank.images[number+3];for(let y=0;y<32;y++)for(let x=0;x<32;x++){const value=image.pixels[(y%16)*image.width+x%16];assert.strictEqual(d.point(x,y),image.depth===1?(value?5:2):value);}}
  d.setPattern(2);d.setPaint(1);d.bar(0,0,31,31);for(let i=0;i<32;i++){assert.strictEqual(d.point(i,0),7);assert.strictEqual(d.point(31,i),7);}assert.strictEqual(d.point(1,1),5);
  const before=d.screen().pixels.slice();assert.throws(()=>d.setPattern(36));assert.deepStrictEqual(d.screen().pixels,before);
});

test('Tutorial: Trap captures diagnostics, explicit errors retain their number, and Direct has its own terminal host boundary',()=>{
  const calls=[];const {program:p}=execute(binary([[t('Trap'),t('Error'),n(45)],[id('e'),t('='),t('Errtrap')],[id('message',6,2),t('='),t('Err$'),t('('),n(45),t(')')],[t('Trap'),t('Paper'),n(-1)],[id('bad'),t('='),t('Errtrap')],[t('Trap'),t('Paper'),n(0)],[id('ok'),t('='),t('Errtrap')],[t('Direct')],[id('never'),t('='),n(1)]]),1000,{system:{command:(...args)=>calls.push(args)}});
  assert.throws(()=>compile(binary([[t('Trap'),t('Wait Key')]])),/single synchronous command/);
  assert.strictEqual(p.state.variables.int_e,45);assert.strictEqual(p.state.variables.string_message,'AMOS error 45');assert.ok(p.state.variables.int_bad);assert.strictEqual(p.state.variables.int_ok,0);assert.strictEqual(p.state.halted,true);assert.strictEqual(p.state.editRequest,null);assert.strictEqual(p.state.directRequest.command,'Direct');assert.strictEqual(calls.length,1);assert.strictEqual(calls[0][0],'Direct');p.tick(1000);assert.strictEqual(calls.length,1);
});

test('Tutorial: On Proc uses ordinary scoped procedure calls, validates all targets and preserves fallthrough',()=>{
  const proc=name=>[t('Procedure'),dword(0),w(0),0,0,id(name)];
  const {program:p}=execute(binary([[t('Global'),id('result')],[t('On'),w(0),w(0),n(2),t('Proc'),id('first'),t(','),id('second')],[t('On'),w(0),w(0),n(0),t('Proc'),id('first')],[t('Wait Key')],proc('first'),[id('result'),t('='),n(10)],[t('End Proc')],proc('second'),[id('result'),t('='),n(20)],[t('End Proc')]]));
  assert.strictEqual(p.state.variables.int_result,20);assert.strictEqual(p.state.frames.length,0);p.stop();
  assert.throws(()=>compile(binary([[t('On'),w(0),w(0),n(0),t('Proc'),id('missing')]])),/Unknown procedure/);
});

test('Tutorial: Resume Next continues after the failing instruction and computed Restore uses scoped DATA labels',()=>{
  const label=name=>id(name,0x0c);
  const {program:p}=execute(binary([[t('On Error'),t('Goto'),id('handler')],[t('Error'),n(12)],[id('result'),t('='),n(7)],[t('End')],[label('handler'),t('Resume Next')]]));
  assert.strictEqual(p.state.variables.int_result,7);assert.strictEqual(p.state.stack.length,0);
  const {program:q}=execute(binary([[t('Restore'),t('('),n(2),t(')')],[t('Read'),id('a')],[t('End')],[label('1'),t('Data'),w(0),n(11)],[label('2'),t('Data'),w(0),n(22)]]));
  assert.strictEqual(q.state.variables.int_a,22);
  assert.throws(()=>execute(binary([[t('Restore'),t('('),n(9),t(')')],[label('1'),t('Data'),w(0),n(11)]])),/Restore label 9 does not identify Data.*line 1/);
});

test('Tutorial: text controls, nested zone/border escapes, styles and ellipse keep portable bitmap semantics',()=>{
  const d=createDisplay();d.open(0,32,24,16,0);d.reserveZones(2);d.paper(3);d.clearWindow();d.locate(1,0);d.cursorDown();assert.deepStrictEqual([d.screen().x,d.screen().y],[1,1]);
  d.write('\x1bE0\x1bZ0AB\x1bZ1\x1bE1');assert.strictEqual(d.zone(8,8),1);assert.strictEqual(d.zone(23,15),1);
  d.clearWindow();assert.ok(d.screen().pixels.every(v=>v===3));assert.deepStrictEqual([d.screen().x,d.screen().y],[0,0]);
  d.ink(5,0);d.setText(1);d.text(0,7,'A');for(let x=0;x<8;x++)assert.strictEqual(d.point(x,7),5);
  d.setText(0);d.clear(0);d.ellipse(16,12,7,4);for(const [x,y]of [[9,12],[23,12],[16,8],[16,16]])assert.strictEqual(d.point(x,y),5);
  const before=d.screen().pixels.slice();let hooks=0;d.setDrawingHooks({before(){hooks++;},after(){hooks++;}});d.doubleBuffer();d.autoback(2);assert.throws(()=>d.ellipse(16,12,-1,4));assert.throws(()=>d.ellipse(16,12,0,4));assert.strictEqual(hooks,0);assert.deepStrictEqual(d.screen().pixels,before);
});

test('Tutorial: Colour Back affects blank raster rows without changing any logical screen palette',()=>{
  const d=createDisplay();d.open(0,320,8,4,0);d.screen().palette[0]=0xf00;d.clear(0);const before=d.screen().palette.slice();d.colourBack(0x123);
  const image=d.renderDisplay(null,{origin:{x:128,y:40},lines:40});
  const rgb=y=>Array.from(image.slice(y*640*4,y*640*4+4));
  assert.deepStrictEqual(rgb(0),[17,34,51,255]);assert.deepStrictEqual(rgb(10),[255,0,0,255]);assert.deepStrictEqual(rgb(18),[17,34,51,255]);assert.deepStrictEqual(d.screen().palette,before);
});

test('Tutorial: cursor movement rejects bitmaps without a complete text cell before changing state',()=>{const d=createDisplay();d.open(0,4,4,4,0);assert.throws(()=>d.cursorDown(),/too small/);assert.strictEqual(d.screen().y,0);});
