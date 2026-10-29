'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const {binary,token:t,word:w,dword,integer:n,identifier:id,text,compile,execute} = require('./helpers/program');
const {createFakeTimers} = require('./helpers/fakeTimers');
const fn = (name, ...args) => [t(name),t('('),args.flatMap((arg,i)=>[...(i?t(','):[]),arg]),t(')')];
const label = name => id(name, 0xc), ref = name => id(name, 0x18);
const proc = name => [t('Procedure'),dword(0),w(0),0,0,id(name)];
function program(lines, options={}) { const clock=createFakeTimers(); return {clock,p:compile(binary(lines)).create({...options,now:clock.now,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout})}; }

test('Compiler examples: all nineteen original source hashes compile into standalone optimized factories',()=>{
  const root=path.join(__dirname,'../examples/CompilerExamples'), manifest=require('../examples/CompilerExamples/manifest.json');
  assert.strictEqual(manifest.programs.length,19);
  for(const item of manifest.programs) {
    const bytes=fs.readFileSync(path.join(root,item.path)); assert.strictEqual(bytes.length,item.byteLength);
    assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'),item.sha256);
    const module={exports:{}};new Function('module',new (require('../lib/Transpiler'))(bytes).toModule({optimize:true}))(module);
    const p=module.exports({setTimeout(){},clearTimeout(){},now:()=>0}); assert.strictEqual(typeof p.tick,'function');p.stop();
  }
});

test('Compiler examples: batch catalogue builds every source, embeds supplied assets and reports failures without aborting',()=>{
  const {outputs,programs}=require('../tools/build_compiler_examples').buildCompilerExamples({modules:true});
  assert.strictEqual(programs.filter(p=>p.compiled).length,19);
  assert.strictEqual([...outputs.keys()].filter(n=>n.endsWith('.module.js')).length,19);
  assert(outputs.get('index.html').includes('19/19'));
  assert(outputs.get('galax-galax.html').includes('amospro_extras:compiler_examples/amos_versions/galax/mapping.abk'));
});

test('Compiler examples: Ntsc and memory queries use configured host metadata; Multi Wait yields one field',()=>{
  for(const hz of [50,60]) {
    const logs=[];const {p,clock}=program([[t('Print'),t('Ntsc'),t(','),t('Chip Free'),t(','),t('Fast Free')],[t('Multi Wait')],[t('Print'),n(7)]],{vblHz:hz,memoryFree:kind=>kind==='chip'?1024:2048,print:(...v)=>logs.push(v)});
    p.tick(100);assert.strictEqual(p.state.waiting,'sleep');assert.deepStrictEqual(logs,[[hz===60?-1:0,1024,2048]]);
    clock.tick(1000/hz);assert.deepStrictEqual(logs[1],[7]);p.stop();
  }
});

test('Compiler examples: Input waits, retries atomically, edits text and resumes typed assignments',()=>{
  const logs=[];const {p,clock}=program([[t('Input'),text('Values: '),t(';'),id('a'),t(','),id('b',6,2)],[t('Print'),id('a'),t(','),id('b',6,2)]],{print:(...v)=>logs.push(v)});
  p.tick(100);assert.strictEqual(p.state.waiting,'input');assert.strictEqual(clock.pending(),0);
  for(const c of 'bad,wrong\r')p.sendKey(c);assert.strictEqual(p.state.waiting,'input');
  for(const c of '12,AMOX\bS\r')p.sendKey(c);clock.tick(0);assert.deepStrictEqual(logs,[[12,'AMOS']]);assert(p.state.halted);
});

test('Compiler examples: Input captures array indices once and preflights bounds before prompting',()=>{
  const array=(index)=>[id('a',6,0x40),t('('),index,t(')')];
  const {p,clock}=program([[t('Dim'),array(n(1))],[t('Input'),array(fn('Joy',n(0)))],[t('Print'),array(n(1))]]);
  let polls=0;p.setJoystickReader(()=>{polls++;return 1;});p.tick(100);assert.strictEqual(polls,1);p.sendKey('4');p.sendKey('\r');clock.tick(0);assert.strictEqual(polls,1);
  assert.throws(()=>execute(binary([[t('Dim'),array(n(0))],[t('Input'),array(n(1))]])),/out of bounds.*line 2/);
});

test('Compiler examples: standalone DATA aliases resolve only across labels and comments',()=>{
  const data=binary([[t('Goto'),ref('start')],[label('alias')],[label('points')],[t('Data'),w(0),n(17)],[label('start')],[t('Restore'),ref('alias')],[t('Read'),id('a')],[t('Print'),id('a')]]);
  assert.deepStrictEqual(execute(data).logs,[[17]]);
});

test('Compiler examples: On Error Proc and Resume Label restore ordinary call state in both emit modes',()=>{
  const data=binary([[t('On Error'),t('Proc'),id('handler',0x12)],[t('Resume Label'),ref('exit')],
    [id('a'),t('='),n(1),t('/'),n(0)],[t('Print'),text('unreachable')],
    [label('exit')],[t('Print'),text('recovered')],[t('End')],
    proc('handler'),[t('Print'),text('handler')],[t('Resume Label')],[t('End Proc')]]);
  for(const optimize of [false,true]) { const m={exports:{}};new Function('module',new(require('../lib/Transpiler'))(data).toModule({optimize}))(m);const logs=[];const p=m.exports({setTimeout(){},print:(...v)=>logs.push(v)});p.tick(100);
    assert.deepStrictEqual(logs,[['handler'],['recovered']]);assert.strictEqual(p.state.frames.length,0);assert.strictEqual(p.state.stack.length,0);assert(p.state.halted);assert(p.state.error.message.includes('zero')); }
});

test('Compiler examples: a second error inside its handler is fatal and On Error zero disables registration',()=>{
  const lines=[[t('On Error'),t('Goto'),ref('handler')],[id('a'),t('='),n(1),t('/'),n(0)],[t('End')],[label('handler')],[id('b'),t('='),n(1),t('/'),n(0)]];
  assert.throws(()=>execute(binary(lines)),/zero.*line 5/);
  lines.splice(1,0,[t('On Error'),n(0)]);assert.throws(()=>execute(binary(lines)),/zero.*line 3/);
});

test('Compiler examples: Dreg and balanced Forbid/Permit retain portable state without arbitrary native calls',()=>{
  const {program:p,logs}=execute(binary([[t('Dreg'),t('('),n(0),t(')'),t('='),n(123)],
    [t('Print'),fn('Execall',n(-132)),t(','),fn('Execall',n(-138)),t(','),fn('Dreg',n(0))],[t('Amos Lock')],[t('Amos Unlock')],[t('Close Workbench')],[t('Break Off')],[t('Break On')]]));
  assert.deepStrictEqual(logs,[[123,123,123]]);assert.strictEqual(p.state.system.forbidDepth,0);assert.strictEqual(p.state.system.amosLocked,false);assert.strictEqual(p.state.system.workbenchOpen,false);
  assert.throws(()=>p.execall(-1),/Unsupported/);assert.throws(()=>p.execall(-138),/Permit/);assert.throws(()=>p.dataRegister(8),/Dreg/i);
});

test('Compiler examples: planar CPU addresses share live pixels, preserve planes and retire replaced buffers',()=>{
  const {p}=program([[t('Wait Key')]]);p.tick(10);const d=p.display;d.open(0,17,4,4,0);d.clear(0);
  const a=d.planeBase('Logic',0),b=d.planeBase('Physic',1);assert.strictEqual(b-a,16);
  p.poke(a,0x81);p.poke(b,0x40);assert.deepStrictEqual(Array.from(d.screen().pixels.slice(0,8)),[1,2,0,0,0,0,0,1]);
  p.poke(a+3,0x7f);assert.strictEqual(p.peek(a+3),0x7f);assert.strictEqual(d.point(16,0),0);
  p.copyMemory(a,a+4,a+4);assert.deepStrictEqual(Array.from(d.screen().pixels.slice(17,25)),[1,0,0,0,0,0,0,1]);
  p.doubleBuffer();const logic=d.planeBase('Logic',0);assert.notStrictEqual(logic,a);d.swap();assert.strictEqual(d.planeBase('Physic',0),logic);
  d.open(0,17,4,4,0);assert.throws(()=>p.peek(a),/retired/);p.stop();
});

test('Compiler examples: dual playfields interleave actual planes and use the primary palette',()=>{
  const d=require('../lib/amos/display')();d.open(0,320,16,4,0);d.clear(0);d.setColour(0,0);d.setColour(1,0xf00);d.setColour(9,0x0f0);d.plot(0,0,1);
  d.open(1,320,16,4,0);d.clear(0);d.plot(0,0,1);d.plot(1,0,1);d.dualPlayfield(0,1);d.select(0);
  const frame=d.snapshotDisplay(),pixels=d.renderDisplay();assert.strictEqual(frame.frame.outputWidth,640);
  assert.deepStrictEqual(Array.from(pixels.slice(0,16)),[255,0,0,255,255,0,0,255,0,255,0,255,0,255,0,255]);
  d.close(1);assert.strictEqual(d.screen().dualPartner,null);assert.deepStrictEqual(Array.from(d.renderDisplay().slice(8,12)),[0,0,0,255]);
});

test('Compiler examples: Get/Put/Del Block and Get Sprite capture owned pixels for reuse and collision',()=>{
  const {p}=program([[t('Wait Key')]]);p.tick(10);const d=p.display;d.clear(0);d.bar(0,0,15,7);p.getBlock(1,0,0,16,8);d.clear(0);p.putBlock(1,16,8);assert.strictEqual(d.point(16,8),d.screen().ink);
  p.getSprite(1,16,8,32,16);p.setSprite(0,128,50,1);p.setSprite(1,128,50,1);assert.strictEqual(p.spriteCollision(0,1,1),-1);assert.strictEqual(p.collisionInfo(1),-1);
  p.delSprite(1);assert.strictEqual(p.banks.get(1).images.length,0);p.delBlock();assert.throws(()=>p.putBlock(1),/not defined/);p.stop();
});

test('Compiler examples: Shift Up uses VBL wakes, rotates registers and stops without pixel writes',()=>{
  const {p,clock}=program([[t('Wait Key')]]);p.tick(10);const d=p.display;d.setColour(1,0x100);d.setColour(2,0x200);d.setColour(3,0x300);const before=Buffer.from(d.screen().pixels);
  p.shiftUp(2,1,3,1);clock.tick(20);assert.deepStrictEqual(Array.from(d.screen().palette.slice(1,4)),[0x300,0x100,0x200]);clock.tick(40);assert.deepStrictEqual(Array.from(d.screen().palette.slice(1,4)),[0x200,0x300,0x100]);
  assert.throws(()=>p.fade(1),/Shift Off/);assert.throws(()=>p.flash(1,'(F00,1)'),/Shift Off/);p.shiftOff();clock.tick(100);assert.deepStrictEqual(Buffer.from(d.screen().pixels),before);p.stop();assert.strictEqual(clock.pending(),0);
});

test('Compiler examples: Polyline preflights every endpoint and replays logical/physical drawing',()=>{
  const d=require('../lib/amos/display')();d.open(0,32,16,4,0);d.clear(0);d.doubleBuffer();d.autoback(1);d.ink(1);d.polyline([[1,1],[5,1],[5,5]]);assert.deepStrictEqual(d.screen().pixels,d.screen().physicalPixels);assert.strictEqual(d.point(5,4),1);
  d.setLine(0xaaaa);const before=Buffer.from(d.screen().pixels);assert.throws(()=>d.polyline([[1,1],[5,1],[40000,2]]),/signed/);assert.deepStrictEqual(Buffer.from(d.screen().pixels),before);
});

test('Compiler examples: Bell emits four finite square voices with PAL/NTSC note periods and finite envelope',()=>{
  for(const standard of ['PAL','NTSC']) {
    const events=[];let field=0;const a=require('../lib/amos/audio')(new Map(),{standard,vblHz:50,fieldTime:()=>field,host:{command:e=>events.push(e)}});a.bell();
    assert.strictEqual(events.length,4);assert.deepStrictEqual(events.map(e=>e.mask),[8,4,2,1]);
    for(const e of events) {assert.strictEqual(e.period,standard==='PAL'?251:254);assert.strictEqual(e.loopMask,0);assert.strictEqual(e.sample.length,27342);assert.strictEqual(e.sample.data[0],127/128*56/64);assert(e.sample.data.every(Number.isFinite));assert(Math.abs(e.sample.data[e.sample.length-1])<0.02);}
    a.loop(true);assert.strictEqual(events[4].mask,0);a.stop();assert.strictEqual(events.at(-1).mask,15);
  }
});


test('Compiler examples: Amal Freeze retains program/counters and Amal On continues the move',()=>{
  const {program:p}=execute(binary([[t('Synchro Off')],[t('Update Off')],[t('Bob'),n(0),t(','),n(0),t(','),n(0),t(','),n(0)],
    [t('Channel'),n(0),t('To'),t('Bob'),n(0)],[t('Amal'),n(0),t(','),text('Move 10,0,5;Pause')],[t('Amal On')],[t('Wait Key')]]));
  p.synchro();const x=p.bobInfo('X Bob',0),before=p.amalSnapshot()[0].remaining;p.amalFreeze();p.synchro();assert.strictEqual(p.bobInfo('X Bob',0),x);assert.strictEqual(p.amalSnapshot()[0].remaining,before);p.amalOn();p.synchro();assert(p.bobInfo('X Bob',0)>x);p.stop();
});

test('Compiler examples: no-destination Unpack retains bitmap identity/palette and decodes supplied packed-bank pixels',()=>{
  const {p}=program([[t('Wait Key')]]);p.tick(10);
  const raw=fs.readFileSync(path.join(__dirname,'../examples/PlanetZybex/level1_screen.abk'));
  const decoded=require('../lib/BankReader').readFile(raw).banks[0];
  const image=require('../lib/amos/packedPicture')(Uint8Array.from(decoded.data));
  p.reserveWork(14,decoded.data.length);p.banks.get(14).data.set(decoded.data);const d=p.display;d.open(0,image.width,image.height,image.colours,0);d.clear(0);const target=d.screen(),pixels=target.pixels,palette=Array.from(target.palette);
  p.unpackExisting(14);assert.strictEqual(d.screen(),target);assert.strictEqual(target.pixels,pixels);assert.deepStrictEqual(Array.from(target.palette),palette);assert.deepStrictEqual(Array.from(target.pixels),Array.from(image.pixels));p.stop();
});
