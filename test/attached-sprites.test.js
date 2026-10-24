/* jshint esversion: 6 */
'use strict';
const assert = require('assert');
const { execute, token: t } = require('./helpers/program');
const { source, palette, sprite } = require('./helpers/attachedSprite');
const render = require('../lib/display/reference/render').render;
const at = (pixels, width, x, y) => Array.from(pixels.slice((y*width+x)*4, (y*width+x+1)*4));

test('attached sprites: literal four-plane rows publish all colours and preserve transparent zero', () => {
  const p = execute(source([...palette, sprite(1)])).program;
  const snapshot = p.display.snapshotDisplay(), pixels = render(snapshot.chip, snapshot.frame);
  const rows = snapshot.frame.lineSprites, base = 10*32;
  assert.deepStrictEqual(Array.from(rows.slice(base+8, base+16)), [20,0x5555,0x3333,0x80000000,20,0x0f0f,0x00ff,0x80000001]);
  for(let y=0;y<2;y++)for(let x=0;x<16;x++){
    const value = y ? 15-x : x, expected = [value*17,value*17,value*17,255];
    assert.deepStrictEqual(at(pixels,640,20+x*2,10+y),expected);
    assert.deepStrictEqual(at(p.display.rgba(),320,10+x,10+y),expected);
  }
  assert.strictEqual(p.display.point(14,10),0);
  p.display.setColour(0,0xf00);
  assert.deepStrictEqual(at(p.display.rgba(),320,10,10),[255,0,0,255]);
  assert.deepStrictEqual(at(p.display.rgba(),320,14,10),[68,68,68,255]);
  assert.ok(!p.display.snapshotPlayfield().frame.lineSprites.some(Boolean));
});

test('attached sprites: odd numbers consume a blank channel, pairs claim neighbours in physical order', () => {
  for(let number=0;number<8;number++){
    const p=execute(source([...palette,[t('Hide On')],sprite(number)])).program;
    const rows=p.display.snapshotDisplay().frame.lineSprites, channel=(number+1)&~1;
    const armed=Array.from({length:8},(_,i)=>!!rows[10*32+i*4+3]);
    assert.deepStrictEqual(armed,Array.from({length:8},(_,i)=>channel<8&&(i===channel||i===channel+1)));
  }
  const a=execute(source([...palette,sprite(2,168),sprite(3,198),sprite(1)])).program;
  const b=execute(source([...palette,sprite(1),sprite(3,198),sprite(2,168)])).program;
  assert.deepStrictEqual(Array.from(a.display.snapshotDisplay().frame.lineSprites),Array.from(b.display.snapshotDisplay().frame.lineSprites));
  assert.deepStrictEqual(at(a.display.rgba(),320,15,10),[85,85,85,255]);
  assert.deepStrictEqual(at(a.display.rgba(),320,45,10),[0,0,0,255]);
});

test('attached sprites: manual updates freeze image rows and old snapshots; Off reveals pending neighbours', () => {
  const p=execute(source([...palette,[t('Sprite Update Off')],sprite(2,168),sprite(1)])).program;
  p.updateSprites();const old=p.display.snapshotDisplay(), expected=render(old.chip,old.frame);
  p.setSprite(1,148,60,1);p.banks.get(1).images[0].pixels.fill(15);
  assert.deepStrictEqual(Array.from(p.display.renderDisplay()),Array.from(expected));
  p.spriteOff(1);p.updateSprites();
  const rows=p.display.snapshotDisplay().frame.lineSprites;
  assert.strictEqual(rows[10*32+8],80);assert.strictEqual(rows[10*32+11],0x80000000);
  assert.deepStrictEqual(Array.from(render(old.chip,old.frame)),Array.from(expected));
  p.eraseBank(1);p.updateSprites();assert.ok(!p.display.snapshotDisplay().frame.lineSprites.some((value,index)=>index%4===3&&value));
});

test('attached sprites: mouse reservation releases channel zero and restores logical channel one', () => {
  const p=execute(source([...palette,sprite(0),sprite(1,168)])).program;
  let rows=p.display.snapshotDisplay().frame.lineSprites;
  assert.strictEqual(rows[10*32+3],0);assert.strictEqual(rows[10*32+8],80);
  p.hideOn();rows=p.display.snapshotDisplay().frame.lineSprites;
  assert.strictEqual(rows[10*32+3],0x80000000);assert.strictEqual(rows[10*32+7],0x80000001);assert.strictEqual(rows[10*32+11],0);
  p.showOn();rows=p.display.snapshotDisplay().frame.lineSprites;
  assert.strictEqual(rows[10*32+3],0);assert.strictEqual(rows[10*32+8],80);
});

test('attached sprites: three-plane images publish low two planes, unsupported depth fails atomically', () => {
  const p=execute(source([...palette,[t('Sprite Update Off')],sprite(1)])).program;
  const image=p.banks.get(1).images[0];image.depth=3;p.updateSprites();
  const old=p.display.snapshotDisplay();assert.strictEqual(old.frame.lineSprites[10*32+7],0x80000000);assert.strictEqual(old.frame.lineSprites[10*32+11],0);
  image.depth=5;assert.throws(()=>p.updateSprites(),/above four planes/);
  assert.deepStrictEqual(Array.from(p.display.snapshotDisplay().frame.lineSprites),Array.from(old.frame.lineSprites));
});
