/* jshint esversion: 6 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {binary,token:t,word:w,integer:n,identifier:id,text,compile,execute}=require('./helpers/program');
const createDisplay=require('../lib/amos/display'),glyph=require('./fixtures/roller2/panel-glyphs.json').glyphs.A;
const open=(width=8,height=8)=>[t('Screen Open'),n(0),t(','),n(width),t(','),n(height),t(','),n(64),t(','),t('Lowres')];
const expected=(old,pen,paper,mode,parts)=>Uint8Array.from({length:64},(_,at)=>{const foreground=!!(glyph[at>>3]&(1<<(at&7))),source=foreground?(parts===1?0:pen):(parts===2?0:paper);return mode===0?source:mode===1?old|source:mode===2?old^source:mode===3?old&source:old;});
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('Writing: all five combine modes and three parts selectors match independent foreground/background bit expectations',()=>{
  for(let mode=0;mode<5;mode++)for(let parts=0;parts<3;parts++){const d=createDisplay();d.open(0,8,8,64,0);d.clear(36);d.pen(21);d.paper(10);d.writing(mode,parts);d.write('A');assert.deepStrictEqual(d.screen().pixels,expected(36,21,10,mode,parts));assert.strictEqual(d.screen().x,1);assert.strictEqual(d.screen().writingActive,mode!==0||parts!==0);}
});

test('Writing: native shared pair affects only activated windows, Screen Open resets the pair, and factories remain independent',()=>{
  const d=createDisplay();d.open(0,8,8,64,0);d.clear(36);d.pen(21);d.paper(10);d.writing(2,2);
  d.open(1,8,8,64,0);d.clear(36);d.pen(3);d.paper(6);d.select(0);assert.strictEqual(d.screen().writingActive,true);d.write('A');assert.deepStrictEqual(d.screen().pixels,expected(36,21,10,0,0),'Opening a window resets the shared mode pair');
  d.clear(36);d.writing(2,2);d.select(1);d.write('A');assert.deepStrictEqual(d.screen().pixels,expected(36,3,6,0,0),'An inactive window retains the normal fast path');
  d.writing(1,1);d.select(0);d.write('A');assert.deepStrictEqual(d.screen().pixels,expected(36,21,10,1,1),'Activated windows share the most recent pair');
  d.clear(36);d.writing(1);d.write('A');assert.deepStrictEqual(d.screen().pixels,expected(36,21,10,1,0),'One argument resets parts to Both');
  const a=createDisplay(),b=createDisplay();a.open(0,8,8,64,0);a.clear(36);a.pen(21);a.paper(10);a.writing(2,2);b.open(1,8,8,64,0);a.write('A');assert.deepStrictEqual(a.screen().pixels,expected(36,21,10,2,2));
});

test('Writing: exact token arities, DATA/arrays/boxed procedure results and once-only expression order preserve atomic validation',()=>{
  const {program:p}=execute(binary([open(),[t('Cls Colour'),n(36)],[t('Pen'),n(21)],[t('Paper'),n(10)],
    [t('Data'),w(0),n(2)],[t('Read'),id('parts')],[t('Dim'),id('a'),t('('),n(1),t(')')],[id('a'),t('('),n(1),t(')'),t('='),id('parts')],
    [t('Procedure'),[0,0,0,0],w(0),0,0,id('mode')],[t('End Proc'),t('['),t('Val'),t('('),text('0.9'),t(')'),t(']')],[id('mode',0x12)],
    [w(0x1418),t('Param'),t(','),id('a'),t('('),n(1),t(')')],[t('Print'),text('A'),t(';')],[t('Wait Key')]]));
  assert.deepStrictEqual(Array.from(p.display.screen().pixels),Array.from(expected(36,21,10,0,2)));p.stop();
  const calls=[],value=name=>[t('Val'),t('('),t('Fsel$'),t('('),text(name),t(')'),t(')')];
  const result=execute(binary([[w(0x1418),value('mode'),t(','),value('parts')],[w(0x1408),n(0)],[t('Wait Key')]]),1000,{files:{select({path:name}){calls.push(name);return name==='mode'?'1':'2';}}});assert.deepStrictEqual(calls,['mode','parts']);assert.strictEqual(result.program.display.screen().writingActive,false);result.program.stop();
  for(const line of [[t('Writing'),text('0')],[t('Writing2'),n(0),t(','),text('2')]])assert.throws(()=>compile(binary([line])),/numeric.*line 1/);
  assert.throws(()=>compile(binary([[w(0x1408),n(0),t(','),n(2)]])),/end of statement/);assert.throws(()=>execute(binary([open(),[t('Writing2'),n(5),t(','),n(0)]])),/Invalid Writing.*line 2, byte/);assert.throws(()=>execute(binary([[t('Screen Close'),n(0)],[t('Writing'),n(0)]])),/not open.*line 2/);
  const d=createDisplay();d.open(0,8,8,64,0);d.pen(21);d.paper(10);d.writing(2,2);for(const args of [[-1,0],[5,0],[0,-1],[0,3]]){assert.throws(()=>d.writing(...args),/Invalid Writing/);d.clear(36);d.write('A');assert.deepStrictEqual(d.screen().pixels,expected(36,21,10,2,2));}
});

test('Writing: Ignore still advances text/control/scroll state, while Cline, graphics Text and Set Line stay independent',()=>{
  const d=createDisplay();d.open(0,16,16,16,0);d.clear(6);d.pen(5);d.paper(2);d.ink(3);d.setLine(0xcccc);const phase=d.screen().linePhase;d.writing(4,2);d.write('A');assert.ok(d.screen().pixels.every(v=>v===6));assert.deepStrictEqual([d.screen().x,d.screen().y],[1,0]);assert.strictEqual(d.screen().linePhase,phase);assert.strictEqual(d.screen().linePattern,0xcccc);
  d.locate(1,1);d.write('AB');assert.deepStrictEqual([d.screen().x,d.screen().y],[1,1]);assert.ok(d.screen().pixels.slice(8*16).every(v=>v===2),'Ignored glyphs can still cause ordinary scrolling');d.clearLine();assert.ok(d.screen().pixels.slice(8*16).every(v=>v===2));d.text(0,7,'A');assert.ok(d.screen().pixels.slice(0,8*16).some(v=>v===3));
  const {logs,program:p}=execute(binary([[t('Writing'),n(4)],[t('Print'),text('intent')],[t('Wait Key')]]));assert.deepStrictEqual(logs,[['intent']],'The existing host print hook records intent independently of raster mode');p.stop();
});

test('Writing: Autoback repeats bit composition against each owned buffer exactly once and preserves text cursor state',()=>{
  for(const mode of [0,1,2]){const d=createDisplay();d.open(0,8,8,64,0);d.doubleBuffer();d.autoback(mode);const s=d.screen(),logical=s.pixels,physical=s.physicalPixels;logical.fill(36);physical.fill(10);d.pen(21);d.paper(6);d.writing(2,0);d.write('A');assert.deepStrictEqual(logical,expected(36,21,6,2,0));assert.deepStrictEqual(physical,mode?expected(10,21,6,2,0):new Uint8Array(64).fill(10));assert.strictEqual(s.pixels,logical);assert.strictEqual(s.physicalPixels,physical);assert.deepStrictEqual([s.x,s.y],[1,0]);}
});

test('Writing: XOR text resaves Bob backgrounds; invalid mode leaves a held Bob and writing state intact',()=>{
  const banks=Buffer.from(fs.readFileSync(path.join(__dirname,'fixtures/image-banks.hex'),'utf8').replace(/\s/g,''),'hex');
  const {program:p}=execute(Buffer.concat([binary([[t('Screen Open'),n(0),t(','),n(64),t(','),n(32),t(','),n(4),t(','),t('Lowres')],[t('Cls Colour'),n(3)],
    [t('Double Buffer')],[t('Autoback'),n(2)],[t('Hot Spot'),n(1),t(','),n(0),t(','),n(0)],[t('Bob'),n(0),t(','),n(2),t(','),n(8),t(','),n(1)],[t('Bob Update')],
    [t('Pen'),n(1)],[t('Paper'),n(0)],[t('Writing2'),n(2),t(','),n(2)],[t('Locate'),n(0),t(','),n(1)],[t('Print'),text('A'),t(';')],[t('Wait Key')]]),banks.subarray(20)]));
  const s=p.display.screen(),owner=p.bobs.get(0).screen,before=s.physicalPixels.slice();assert.strictEqual(p.display.point(2,8),1);assert.throws(()=>p.display.writing(9,2),/Invalid Writing/);assert.deepStrictEqual(s.physicalPixels,before);assert.strictEqual(p.bobs.get(0).screen,owner);p.bobOff(0);p.updateBobs();assert.strictEqual(s.physicalPixels[8*64+2],2);assert.strictEqual(s.physicalPixels[8*64],3);p.stop();
});

test('Roller2 Writing: unchanged line 334 and all 15 matrix cases match independent plane-wise raw-palette/font hashes',()=>{
  const icons=fs.readFileSync(path.join(__dirname,'../examples/Roller2/iffp/icons.abk'),'latin1'),frames=require('./fixtures/roller2/writing.json').frames;
  const make=source=>execute(source,1000,{print(){},files:{read:()=>icons,write(){throw Error('write');}}});
  function image(p,frame){const s=p.display.screen(),rgba=p.display.canvasFrame().rgba,png=require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/roller2',frame.png))).rgba;assert.strictEqual(hash(s.pixels),frame.indicesSha256);assert.strictEqual(hash(rgba),frame.rgbaSha256);assert.deepStrictEqual(Buffer.from(rgba),Buffer.from(png));}
  const {program:p,timers:clock}=make(require('./helpers/roller2Writing')());for(let i=0;i<3;i++){if(i){p.sendKey('next');clock.tick(0);}image(p,frames[i]);assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.display.screen().writingActive,i!==0);assert.strictEqual(p.display.screen().linePattern,0xcccc);assert.strictEqual(p.display.screen().linePhase,11);}assert.strictEqual(p.display.screen().paper,7);p.stop();assert.strictEqual(clock.pending(),0);
  const {program:q}=make(require('./helpers/writingMatrix')());image(q,frames[3]);q.stop();
});
