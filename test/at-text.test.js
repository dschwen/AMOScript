'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {binary,token:t,integer:n,word:w,identifier:id,text,compile,execute}=require('./helpers/program');
const at=(x,y)=>[w(0x13c6),t('('),x==null?[]:n(x),t(','),y==null?[]:n(y),t(')')];
const idle=()=>execute(binary([[t('Wait Key')]])).program;

test('At: both optional coordinates encode pure byte strings with native 0..207/EntNul bounds and no cursor effects',()=>{
  const p=idle(),s=p.display.screen();p.display.locate(4,3);const before=s.pixels.slice();
  assert.strictEqual(p.atString(0,207),'\x1bX0\x1bY\xff');assert.strictEqual(p.atString(2,null),'\x1bX2');assert.strictEqual(p.atString(null,1),'\x1bY1');assert.strictEqual(p.atString(null,null),'');assert.strictEqual(p.atString(-2147483648,-2147483648),'');assert.strictEqual(p.atString({value:2.9,numericType:'float'},1.9),'\x1bX2\x1bY1');
  for(const args of [[-1,0],[208,0],[0,-1],[0,208]])assert.throws(()=>p.atString(...args),/At coordinate/);
  assert.deepStrictEqual([s.x,s.y],[4,3]);assert.deepStrictEqual(s.pixels,before);p.display.close(0);assert.strictEqual(p.atString(2,1),'\x1bX2\x1bY1');p.stop();
});

test('At: original token is string-typed through assignment, arrays, DATA/Read, procedure results and concatenation; expressions run once left-to-right',()=>{
  const a=id('a',6,2),arr=id('array',6,2);const {program:p,logs}=execute(binary([[a,t('='),at(2,null)],[t('Dim'),arr,t('('),n(1),t(')')],[arr,t('('),n(0),t(')'),t('='),a,t('+'),text('A')],
    [t('Data'),w(0),at(null,1)],[t('Read'),a],[t('Procedure'),[0,0,0,0],w(0),0,0,id('position')],[t('End Proc'),t('['),at(3,2),t(']')],[id('position',0x12)],
    [t('Print'),arr,t('('),n(0),t(')'),t(';'),a,t(';'),t('Param$'),t(';')],[t('Wait Key')]]));assert.deepStrictEqual(logs,[['\x1bX2A','\x1bY1','\x1bX3\x1bY2']]);assert.deepStrictEqual([p.display.screen().x,p.display.screen().y],[3,2]);p.stop();
  const calls=[],value=name=>[t('Val'),t('('),t('Fsel$'),t('('),text(name),t(')'),t(')')];
  const q=execute(binary([[a,t('='),t('At'),t('('),value('x'),t(','),value('y'),t(')')],[t('Wait Key')]]),1000,{files:{select({path}){calls.push(path);return path==='x'?'2.9':'1';}}}).program;assert.deepStrictEqual(calls,['x','y']);assert.strictEqual(q.state.variables.string_a,'\x1bX2\x1bY1');q.stop();
  for(const bad of [[t('Print'),t('At'),t('('),text('x'),t(','),n(0),t(')')],[t('Print'),t('At'),t('('),n(0),t(')')],[id('n'),t('='),at(0,0)]])assert.throws(()=>compile(binary([bad])),/argument type|Expected ,|Assignment type mismatch/i);
});

test('At output: stored/split byte controls retain omitted axes, survive Stop and are per screen; comma tabs use the moved cursor',()=>{
  const writes=[],{program:p}=execute(binary([[t('Set Tab'),n(4)],[t('Print'),at(5,2),t(','),text('A'),t(';')],[t('Wait Key')]]),1000,{write:s=>writes.push(s)});
  assert.strictEqual(writes[0],'\x1bX5\x1bY2   A');const d=p.display,s=d.screen();assert.deepStrictEqual([s.x,s.y],[9,2]);
  d.write('\x1b');p.stop();p.resume();d.write('X');d.open(1,320,200,16,0);d.write('A');assert.strictEqual(d.screen().x,1);d.select(0);d.write('2B');assert.deepStrictEqual([s.x,s.y],[3,2]);
  d.write('\x1bY1C');assert.deepStrictEqual([s.x,s.y],[4,1]);assert.strictEqual(s.textEscape,'');d.write('\x1b\x1bZA');assert.deepStrictEqual([s.x,s.y],[5,1]);p.stop();
});

test('At output: bounds fail on consumption with source context; unrelated text escapes remain gated; Autoback consumes controls once',()=>{
  assert.throws(()=>execute(binary([[t('Print'),at(40,0),t(';')]])),/Text cursor out of bounds at line 1/);assert.throws(()=>execute(binary([[t('Print'),at(-1,0)]])),/At coordinate.*line 1/);
  const p=idle(),d=p.display,s=d.screen();d.clear(0);d.cursOff();d.doubleBuffer();d.autoback(2);d.write('\x1bX2\x1b');d.write('Y1A');assert.deepStrictEqual([s.x,s.y,s.textEscape],[3,1,'']);assert.deepStrictEqual(s.pixels,s.physicalPixels);assert.throws(()=>d.write('\x1bP2'),/Unsupported text escape P/);p.stop();
});

test('Planet Zybex score: both original updates share lowres/hires copper output and match independent full-frame PNGs in PAL and NTSC',()=>{
  const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),oracle=require('./fixtures/planet-zybex/score.json');
  for(const standard of ['PAL','NTSC']){const {program:p,timers}=execute(require('./helpers/planetZybexScore')(),10000,{displayOptions:{snapshotStandard:standard},files:{read:name=>fs.readFileSync(path.join(__dirname,'../examples/PlanetZybex',name.toLowerCase()),'latin1')}});
    for(const [i,expected]of oracle.frames.entries()){if(i){p.sendKey('next');timers.tick(0);}assert.strictEqual(p.state.waiting,'key');assert.deepStrictEqual([...p.display.screens.keys()],[5,2,1]);assert.deepStrictEqual([p.display.screen(5).x,p.display.screen(5).y],[77,0]);assert.strictEqual(hash(p.display.screen(5).pixels),expected.scoreSha256);
      const frame=p.display.canvasFrame();assert.deepStrictEqual([frame.width,frame.height],[640,171]);assert.strictEqual(hash(frame.rgba),expected.rgbaSha256);const png=require('./helpers/displayPng').decodePng(fs.readFileSync(path.join(__dirname,'fixtures/planet-zybex',expected.png)));assert.deepStrictEqual(Buffer.from(frame.rgba),Buffer.from(png.rgba));
      const snapshot=p.display.snapshotDisplay().frame;assert.deepStrictEqual(Array.from(snapshot.origin?Object.values(snapshot.origin):[]),[128,50]);assert.strictEqual(snapshot.lineRegs[0*32+8]&0x8000,0);assert.strictEqual(snapshot.lineRegs[161*32+8]&0x8000,0x8000);assert.strictEqual(snapshot.lineRegs[161*32+8]>>>12&7,1);
    }p.stop();assert.strictEqual(timers.pending(),0);}
});

test('Mixed-resolution priority: hires strip preserves per-screen backgrounds and retains hires-overlap gates with unequal nonoverlapping windows',()=>{
  const p=idle(),d=p.display;d.close(0);d.open(2,320,160,16,0);d.clear(0);d.screenDisplay(2,128,50,320,160);d.open(5,640,10,2,0x8000);d.clear(0);d.setColour(0,0);d.screenDisplay(5,128,211,640,10);d.screenToFront(2);
  const frame=d.canvasFrame();assert.deepStrictEqual(Array.from(frame.rgba.subarray((170*640)*4,(170*640)*4+4)),[0,0,0,255]);
  d.select(5);d.setColour(0,0x123);const coloured=d.canvasFrame();
  for(const y of [160,161,170])assert.deepStrictEqual(Array.from(coloured.rgba.subarray(y*640*4,y*640*4+4)),[17,34,51,255]);
  assert.deepStrictEqual(Array.from(coloured.rgba.subarray(0,4)),[0,0,0,255]);assert.strictEqual(d.snapshotDisplay().frame.overflowEvents.length,0);d.setColour(0,0);
  const retained=d.snapshotDisplay(),copy=retained.chip.slice();d.screenDisplay(5,128,205,640,10);assert.throws(()=>d.snapshotDisplay(),/lowres.*overlaps/);assert.deepStrictEqual(retained.chip,copy);
  d.screenDisplay(5,128,211,160,10);d.setColour(1,0xfff);d.clear(1);const narrow=d.canvasFrame();assert.deepStrictEqual([narrow.width,narrow.height],[640,171]);assert.deepStrictEqual(Array.from(narrow.rgba.subarray((170*640+100)*4,(170*640+100)*4+4)),[255,255,255,255]);assert.deepStrictEqual(Array.from(narrow.rgba.subarray((170*640+500)*4,(170*640+500)*4+4)),[0,0,0,255]);d.screenDisplay(5,128,1000,320,10);d.screenDisplay(2,128,1000,320,160);assert.doesNotThrow(()=>d.snapshotDisplay());p.stop();
});
