/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), createDisplay = require('../lib/amos/display');
const { binary, token: t, integer: n, word: w, text, identifier: id, execute, compile } = require('./helpers/program');
const copy = args => [w(0x9a8), ...args.flatMap((arg, i) => i ? [t(i === 5 ? 'To' : ','), arg] : [arg])];
function prepared() {
  const d = createDisplay(); d.open(0, 32, 8, 4, 0); const a = d.screen();
  for (let y = 0; y < 8; y++) for (let x = 0; x < 32; x++) a.pixels[y * 32 + x] = (x + y) % 4;
  d.open(1, 32, 8, 16, 0); d.clear(12); return d;
}
test('Screen Copy rectangle: exclusive endpoints, all clipping edges and common planes match independent per-pixel expectations', () => {
  for (const bounds of [[2,1,7,4,5,2],[-2,-1,7,4,1,1],[2,1,30,8,-3,-2],[20,5,40,12,28,7],[0,0,0,5,0,0],[8,4,2,1,0,0],[-50,0,1,1,0,0]]) {
    const d = prepared(), [sx,sy,ex,ey,dx,dy] = bounds, source = d.screen(0).pixels.slice(), expected = d.screen(1).pixels.slice();
    // Mathematical correspondence, with clipping applied at both bitmaps.
    for (let y = Math.max(0, sy); y < Math.min(8, ey); y++) for (let x = Math.max(0, sx); x < Math.min(32, ex); x++) {
      const xx = dx + x - sx, yy = dy + y - sy;
      if (xx >= 0 && xx < 32 && yy >= 0 && yy < 8) expected[yy * 32 + xx] = 12 | source[y * 32 + x];
    }
    d.copyScreenRectangle(0,sx,sy,ex,ey,1,dx,dy); assert.deepStrictEqual(d.screen(1).pixels, expected);
  }
});
test('Screen Copy rectangle: overlapping copies in every direction snapshot source pixels and retain aliases and buffer ownership', () => {
  for (const [x,y] of [[1,0],[0,1],[1,1],[0,0]]) {
    const d = prepared(), s = d.screen(0), before = s.pixels.slice(), identity = s.pixels;
    d.copyScreenRectangle(0,0,0,20,5,0,x,y);
    for (let yy=0;yy<8;yy++) for(let xx=0;xx<32;xx++) assert.strictEqual(s.pixels[yy*32+xx],xx>=x&&xx<x+20&&yy>=y&&yy<y+5?before[(yy-y)*32+xx-x]:before[yy*32+xx]);
    assert.strictEqual(s.pixels,identity);
  }
  const d=prepared();d.select(0);d.clone(2);d.copyScreenRectangle(0,0,0,10,2,2,1,1);assert.strictEqual(d.screen(2).pixels,d.screen(0).pixels);
});
test('Screen Copy rectangle: tagged physical destinations bypass Autoback/Bob hooks and preserve palettes, selection and immutable snapshots', () => {
  const d=createDisplay();d.clear(2);d.doubleBuffer();d.autoback(2);const s=d.screen(),logical=s.pixels,physical=s.physicalPixels;
  physical.fill(0);const snapshot=d.snapshotDisplay(), old=require('../lib/display/reference/render').render(snapshot.chip,snapshot.frame),palette=s.palette.slice();
  d.setDrawingHooks({before(){throw Error('raw copy ran Bob hooks');},after(){throw Error('raw copy ran Bob hooks');}});
  d.copyScreenRectangle(0,1,1,8,4,d.bufferSelector('Physic'),2,2);
  assert.strictEqual(s.pixels,logical);assert.strictEqual(s.physicalPixels,physical);assert.strictEqual(d.current,0);assert.deepStrictEqual(s.palette,palette);
  assert.strictEqual(physical[2*320+2],logical[321]);assert.strictEqual(physical[0],0);assert.deepStrictEqual(require('../lib/display/reference/render').render(snapshot.chip,snapshot.frame),old);
});
test('Screen Copy rectangle: typed arrays/DATA and expressions lower through the eight-operand signature; malformed/wrapped forms reject atomically and explicit minterms require their operands', () => {
  const {program:p}=execute(binary([[t('Dim'),id('a'),t('('),n(0),t(')')],[t('Data'),w(0),n(4)],[t('Read'),id('a'),t('('),n(0),t(')')],
    [t('Ink'),n(2)],[t('Plot'),n(1),t(','),n(1)],copy([n(0),n(1),n(1),[id('a'),t('('),n(0),t(')')],[t('Val'),t('('),text('4'),t(')')],n(0),n(8),n(8)])]));
  assert.strictEqual(p.display.point(8,8),2);p.stop();
  const d=prepared(),before=d.screen(1).pixels.slice();
  for(const value of [32768,-32769,0.1,NaN])assert.throws(()=>d.copyScreenRectangle(0,value,0,5,5,1,0,0));
  assert.throws(()=>d.copyScreenRectangle(0,-32768,0,5,5,1,32767,0),/Wrapped/);assert.deepStrictEqual(d.screen(1).pixels,before);
  assert.throws(()=>execute(binary([copy([n(0),text('x'),n(0),n(5),n(5),n(1),n(0),n(0)])])),/numeric.*line 1/);
  assert.throws(()=>compile(binary([[w(0x9be)]])),/Expected expression/);
  assert.throws(()=>compile(binary([copy(Array(8).fill(n(0))).concat(t(','),n(0xcc))])),/end of statement/);
  assert.throws(()=>execute(binary([copy([n(7),n(0),n(0),n(5),n(5),n(6),n(0),n(0)])])),/Screen 6 is not open.*line 1/);
});
