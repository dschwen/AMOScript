/* jshint esversion: 6 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const createDisplay = require('../lib/amos/display');
const { binary, token: t, integer: n, word: w, execute } = require('./helpers/program');
const { decodePng } = require('./helpers/displayPng');

const command = (code, ...args) => [w(code), ...args.flatMap((value, i) => [...(i ? [t(',')] : []), ...(value == null ? [] : [n(value)])])];

test('screen windows: original offsets, optional arguments and integer typing execute standalone', () => {
  const { program } = execute(binary([[t('Screen Open'), n(0), t(','), n(640), t(','), n(288), t(','), n(16), t(','), t('Lowres')],
    command(0xa18, 0, 143, 48, 335, 168), command(0xa36, 0, 37, 84), command(0xa36, 0, null, 85), command(0xa18, 0, null, 49, null, null)]));
  const s = program.display.screen();
  assert.deepStrictEqual([s.hardwareX,s.hardwareY,s.windowWidth,s.windowHeight,s.offsetX,s.offsetY], [128,49,320,168,37,85]);
  assert.strictEqual(program.display.coordinate('X Screen',128),37);
  assert.strictEqual(program.display.coordinate('Y Screen',49),85);
  assert.strictEqual(program.display.coordinate('X Hard',10),138);
  assert.deepStrictEqual(Array.from(program.display.pointerPosition(0,0,320,168)),[37,85]);
  assert.throws(() => execute(binary([command(0xa36, 7, 0, 0)])), /not open.*line 1/);
  assert.throws(() => execute(binary([command(0xa18, 0, 160, 50, 320, 100)])), /horizontal placement.*line 1/);
});

test('screen windows: all fine/coarse phases retain physical buffers, plane stride and immutable snapshots', () => {
  for (const hires of [false,true]) {
    const d = createDisplay(); d.open(0, hires ? 960 : 640, 288, 16, hires ? 0x8000 : 0);
    const s = d.screen(); d.screenDisplay(0,128,48,320,168);
    for (let i=0;i<s.pixels.length;i++) s.pixels[i] = (i % s.width + Math.floor(i/s.width)*3) % 16;
    d.doubleBuffer(); s.pixels.fill(0); d.autoback(0);
    for (let x=0;x<40;x++) {
      d.screenOffset(0,x,3); const snapshot = d.snapshotDisplay(); const output = d.renderDisplay();
      for (const y of [0,1,167]) for (let px=0;px<s.windowWidth;px++) {
        const index = s.physicalPixels[(y+3)*s.width+(hires ? x&~1 : x)+px], rgb=s.palette[index];
        const at = (y*s.windowWidth*(hires?1:2)+px*(hires?1:2))*4;
        assert.deepStrictEqual(Array.from(output.slice(at,at+4)), [(rgb>>8)*17,((rgb>>4)&15)*17,(rgb&15)*17,255]);
      }
      const pointers = Array.from(snapshot.frame.lineRegs); d.screenOffset(0,0,0);
      assert.deepStrictEqual(Array.from(snapshot.frame.lineRegs), pointers);
    }
    assert.ok(d.renderPlayfield().some(value => value)); // Migration export is still the full physical bitmap.
    assert.ok(s.pixels.every(value=>value===0));
    d.screenOffset(0,0,0); d.swap(); assert.deepStrictEqual(Array.from(d.canvasFrame().rgba.slice(0,4)), [0,0,0,255]);
  }
});

test('screen windows: View stages geometry and keeps old screen buffers alive across replacement/close', () => {
  const d=createDisplay(); d.open(0,640,288,16,0); d.clear(3); d.screenDisplay(0,128,48,320,168);
  const before=d.canvasFrame(); d.autoViewOff(); d.screenOffset(0,25,40); d.screenDisplay(0,null,60,null,100);
  assert.strictEqual(d.canvasFrame().height,168); assert.deepStrictEqual(d.canvasFrame().rgba,before.rgba);
  d.view(); assert.strictEqual(d.canvasFrame().height,100);
  d.open(0,320,256,16,0); d.clear(4); assert.deepStrictEqual(d.canvasFrame().rgba,before.rgba.subarray(0,320*100*4));
  d.close(0); assert.strictEqual(d.canvasFrame().height,100); d.autoViewOn(); assert.strictEqual(d.canvasFrame(),null);
});

test('screen windows: Wonderland original game/editor setup presents panels and a genuine blank gap', () => {
  for (const game of [1,2]) for (const background of [0,1]) {
    const {program,timers}=execute(require('./helpers/wonderlandScreens')(game,background),1000,{files:{read:name=>fs.readFileSync(`${__dirname}/../examples/Wonderland/${name.split('/').pop()}`).toString('latin1')}});
    timers.tick(20); const d=program.display, frame=d.canvasFrame();
    const fieldHeight=game===1?168:144, panelY=game===1?218:194;
    assert.deepStrictEqual([frame.width,frame.height],[320,fieldHeight+34]);
    const panel=decodePng(fs.readFileSync(`${__dirname}/fixtures/wonderland/${game===1?'Score':'Editor'}_Panel.Iff.png`));
    for(let y=0;y<32;y++) for(let x=0;x<320;x++) {
      const at=((panelY-48+y)*320+x)*4, source=(y*640+x*2)*4;
      assert.deepStrictEqual(Array.from(frame.rgba.slice(at,at+4)),Array.from(panel.rgba.slice(source,source+4)));
    }
    const snap=d.snapshotDisplay();
    for(const y of [fieldHeight,fieldHeight+1]) assert.strictEqual(snap.frame.lineRegs[y*32+16]&2,0);
    assert.strictEqual(d.screen(0).doubleBuffered,true); program.stop();
  }
});

test('screen windows: unsupported wrapping and placements reject explicitly', () => {
  const d=createDisplay(); d.open(0,640,288,16,0); d.screenDisplay(0,128,48,320,168);
  assert.throws(()=>d.screenOffset(0,-1,0),/outside bitmap/);
  d.screenOffset(0,639,0); assert.throws(()=>d.snapshotDisplay(),/outside physical bitmap/); d.screenOffset(0,0,0);
  d.open(1,320,256,16,0); d.screenDisplay(1,128,50,320,128);
  assert.ok(d.snapshotDisplay().frame.lines > 0);
  d.screenDisplay(1,128,255,320,256); assert.strictEqual(d.screen(1).windowHeight,256);
  assert.strictEqual(d.snapshotDisplay().frame.lines,262);
  assert.throws(()=>d.screenDisplay(1,128,32768,320,256),/vertical placement/);
  d.open(2,320,256,4096,0); d.screenDisplay(2,128,50,320,128); // HAM decoding still uses the fetched row's history.
  assert.throws(()=>d.screenOffset(2,0,256),/outside bitmap/);
  assert.throws(()=>d.screenOffset(2,1,0),/HAM fine/);
});
