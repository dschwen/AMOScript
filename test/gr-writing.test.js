'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {binary,token:t,word:w,integer:n,text,execute,compile}=require('./helpers/program'),createDisplay=require('../lib/amos/display');
const a=[0x0c,0x1e,0x33,0x33,0x3f,0x33,0x33,0];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('Gr Writing: original token accepts numeric conversion once, stores per-screen mode and rejects unsupported selectors atomically',()=>{
  const calls=[],{program:p}=execute(binary([[w(0x1066),t('Val'),t('('),t('Fsel$'),t('('),text('mode'),t(')'),t(')')],[t('Wait Key')]]),1000,{files:{select({path}){calls.push(path);return '1.9';}}});assert.deepStrictEqual(calls,['mode']);assert.strictEqual(p.display.screen().graphicsMode,1);
  const d=p.display,s=d.screen(),pixels=s.pixels.slice();let hooks=0;d.setDrawingHooks({before(){hooks++;},after(){hooks++;}});d.doubleBuffer();d.autoback(2);const beforeVersion=d.version;
  for(const mode of [-1,2,3,4,5,6,7,256]){assert.throws(()=>d.grWriting(mode),/Gr Writing/);assert.strictEqual(s.graphicsMode,1);assert.deepStrictEqual(s.pixels,pixels);assert.strictEqual(d.version,beforeVersion);}assert.strictEqual(hooks,0);
  d.grWriting(0);assert.strictEqual(d.version,beforeVersion);d.open(1,16,8,8,0);assert.strictEqual(d.screen().graphicsMode,null);d.grWriting(1);d.select(0);assert.strictEqual(s.graphicsMode,0);p.resetDefault();assert.strictEqual(d.screen().graphicsMode,null);p.stop();
  assert.throws(()=>compile(binary([[t('Gr Writing'),text('0')]])),/numeric/);assert.throws(()=>execute(binary([[t('Gr Writing'),n(2)]])),/Gr Writing.*line 1/);assert.throws(()=>execute(binary([[t('Screen Close'),n(0)],[t('Gr Writing'),n(0)]])),/not open.*line 2/);
});

test('Gr Writing: Text JAM1 preserves background and JAM2 uses Ink background for every zero glyph bit',()=>{
  for(const mode of [0,1]){const d=createDisplay();d.open(0,16,8,8,0);d.clear(7);d.ink(3,2);d.grWriting(mode);d.grLocate(9,6);d.text(0,7,'A');const s=d.screen();for(let y=0;y<8;y++)for(let x=0;x<8;x++)assert.strictEqual(s.pixels[y*16+x],a[y]&(1<<x)?3:mode===0?7:2);assert.deepStrictEqual([s.gx,s.gy],[9,6]);assert.ok(s.pixels.filter((_,i)=>i%16>=8).every(v=>v===7));}
});

test('Gr Writing: native initial BPen is separate from window Paper and legacy defaults; Ink changes affect both graphics paths',()=>{
  const d=createDisplay();d.open(0,16,8,8,0);d.clear(7);d.paper(5);d.ink(3);d.grWriting(1);d.text(0,7,'A');assert.strictEqual(d.screen().pixels[0],1);d.ink(3,6);d.text(0,7,'A');assert.strictEqual(d.screen().pixels[0],6);
  const legacy=createDisplay();legacy.open(0,16,8,8,0);legacy.clear(7);legacy.ink(3);legacy.text(0,7,'A');assert.strictEqual(legacy.screen().pixels[0],7);legacy.setLine(0);legacy.draw(0,0,15,0);assert.ok(legacy.screen().pixels.subarray(0,16).every(v=>v===0));
});

test('Gr Writing: patterned Draw/Draw To/Box retain traversal and phase while mode zero skips pattern holes',()=>{
  const results=[];for(const mode of [0,1]){const d=createDisplay();d.open(0,32,16,8,0);d.clear(7);d.ink(3,2);d.setLine(0xaaaa);d.grWriting(mode);d.draw(0,0,7,0);assert.deepStrictEqual(Array.from(d.screen().pixels.subarray(0,8)),[3,mode?2:7,3,mode?2:7,3,mode?2:7,3,mode?2:7]);d.drawTo(15,0);d.box(2,3,7,8);results.push([d.screen().linePhase,d.screen().gx,d.screen().gy]);d.setLine(0);const before=d.screen().pixels.slice();d.draw(0,10,20,10);if(mode===0)assert.deepStrictEqual(d.screen().pixels,before);else assert.ok(d.screen().pixels.subarray(320,341).every(v=>v===2));}
  assert.deepStrictEqual(results[0],results[1]);
});

test('Gr Writing: Plot/solid shapes stay foreground-only and Print/Writing retain independent Pen/Paper semantics',()=>{
  const {program:p}=execute(binary([[t('Wait Key')]])),d=p.display;d.open(0,64,32,8,0);d.clear(0);d.ink(3,6);d.pen(2);d.paper(1);d.writing(0,0);d.grWriting(1);d.plot(20,20);d.bar(24,20,26,22);d.circle(40,20,3);d.polygon([[48,20],[52,20],[50,24]]);d.paint(25,21);d.write('A');assert.strictEqual(d.screen().pixels[0],1);assert.strictEqual(d.screen().pixels[20*64+20],3);assert.strictEqual(d.screen().pixels[21*64+25],3);d.writing(4);d.grWriting(0);const before=d.screen().pixels.slice();d.locate(1,0);d.write('B');assert.deepStrictEqual(d.screen().pixels,before);p.stop();
});

test('Gr Writing: Autoback applies each buffer background independently, and Bob restoration retains newly drawn graphics',()=>{
  const {program:p}=execute(binary([[t('Wait Key')]])),d=p.display,s=d.screen();d.clear(0);d.ink(4);d.bar(0,0,3,3);p.getBob(1,0,0,4,4);d.clear(0);p.doubleBuffer();d.autoback(2);p.setBob(0,2,2,1);p.updateBobs();d.ink(3,2);d.grWriting(1);d.text(0,7,'A');assert.strictEqual(d.screen().pixels[2*320+2],4);p.bobOff();p.updateBobs();p.updateBobs();for(let y=0;y<8;y++)for(let x=0;x<8;x++)assert.strictEqual(s.pixels[y*320+x],a[y]&(1<<x)?3:2);
  s.pixels.fill(7);s.physicalPixels.fill(5);d.grWriting(0);d.text(0,7,'A');for(let y=0;y<8;y++)for(let x=0;x<8;x++){assert.strictEqual(s.pixels[y*320+x],a[y]&(1<<x)?3:7);assert.strictEqual(s.physicalPixels[y*320+x],a[y]&(1<<x)?3:5);}p.stop();
});

test('Planet Zybex: original five GAME OVER Text passes and explicit comparison/restoration match independent PNGs in PAL/NTSC',()=>{
  const expected=require('./fixtures/planet-zybex/game-over.json');for(const standard of ['PAL','NTSC']){const {program:p,timers:c}=execute(require('./helpers/planetZybexGameOver')(),1000,{displayOptions:{snapshotStandard:standard}});
    for(const frame of expected.frames){if(frame.stage){p.sendKey('next');c.tick(0);}assert.strictEqual(p.state.waiting,'key');assert.strictEqual(p.display.screen().graphicsMode,frame.mode);assert.strictEqual(hash(p.display.screen().pixels),frame.indicesSha256);const actual=p.display.canvasFrame();assert.strictEqual(hash(actual.rgba),frame.rgbaSha256);const png=require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/planet-zybex',frame.png)));assert.deepStrictEqual(Buffer.from(actual.rgba),Buffer.from(png.rgba));}
    p.sendKey('finish');c.tick(0);assert.strictEqual(p.state.halted,true);assert.strictEqual(c.pending(),0);p.stop();}
});
