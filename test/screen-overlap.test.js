/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), createDisplay = require('../lib/amos/display');

function windows() {
  const d = createDisplay();
  d.open(0, 640, 256, 16, 0); const back = d.screen();
  back.palette = Array.from({ length: 32 }, (_, i) => i ? 0x100 + i : 0);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 640; x++) back.pixels[y * 640 + x] = 1 + ((y + (x >> 4)) % 15);
  d.screenDisplay(0, 128, 42, 320, 256); d.screenOffset(0, 16, 0);
  d.open(1, 320, 200, 16, 0); const front = d.screen();
  front.palette = back.palette.slice(); front.palette[1] = 0x0f0; front.palette[17] = 0xf00;
  front.pixels.fill(1); d.screenDisplay(1, 128, 240, 320, 56);
  return { d, back, front };
}
const rgba = rgb => [(rgb >> 8) * 17, ((rgb >> 4) & 15) * 17, (rgb & 15) * 17, 255];

test('screen overlap: ordinary window opens use priority slices, blank setup rows and resume beyond raster 255', () => {
  const { d, back, front } = windows(), frame = d.canvasFrame(), snapshot = d.snapshotDisplay();
  assert.deepStrictEqual([frame.width, frame.height], [320, 256]);
  for (let y = 0; y < 256; y++) for (const x of [0, 17, 319]) {
    const hardwareY = 42 + y, blank = hardwareY === 239 || hardwareY === 296;
    const owner = hardwareY >= 240 && hardwareY < 296 ? front : back;
    const index = owner === front ? 1 : back.pixels[y * 640 + x + 16];
    assert.deepStrictEqual(Array.from(frame.rgba.slice((y * 320 + x) * 4, (y * 320 + x) * 4 + 4)), rgba(blank ? 0 : owner.palette[index]), `pixel ${x},${hardwareY}`);
  }
  assert.strictEqual(snapshot.frame.lineRegs[255 * 32 + 16] & 3, 3);
  assert.strictEqual(snapshot.frame.overflowEvents.length, 0);
  assert.deepStrictEqual(d.pointerHardwarePosition(20, 250, 320, 256), [148, 292]);
  d.select(0); assert.deepStrictEqual(d.canvasFrame().rgba, frame.rgba);
  d.autoViewOff(); d.hideScreen(1); assert.deepStrictEqual(d.canvasFrame().rgba, frame.rgba);
  d.view(); assert.notDeepStrictEqual(d.canvasFrame().rgba, frame.rgba);
  d.showScreen(1); d.view(); assert.deepStrictEqual(d.canvasFrame().rgba, frame.rgba);
  d.screenToFront(0); d.view(); assert.notDeepStrictEqual(d.canvasFrame().rgba, frame.rgba);
  assert.strictEqual(snapshot.frame.lineRegs[197 * 32 + 16] & 2, 0);
});

test('screen overlap: direct sprites survive setup rows with independently checked early palette changes', () => {
  const { d, back, front } = windows();
  d.setSpriteWriter(frame => {
    for (let hardwareY = 230; hardwareY < 300; hardwareY++) {
      const y = hardwareY - frame.origin.y; if (y < 0 || y >= frame.lines) continue;
      frame.lineSprites.set([600, 65535, 0, 0x80000000], y * 32);
      frame.lineRegs[y * 32 + 16] |= 4;
    }
  });
  const frame = d.canvasFrame();
  for (const hardwareY of [238, 239, 240, 295, 296, 297]) {
    const colour = hardwareY >= 239 && hardwareY < 296 ? front.palette[17] : back.palette[17];
    const offset = ((hardwareY - 42) * 320 + 300) * 4;
    assert.deepStrictEqual(Array.from(frame.rgba.slice(offset, offset + 4)), rgba(colour), `sprite row ${hardwareY}`);
  }
  front.palette = front.palette.map((value, i) => i >= 16 ? 0xfff : value);
  assert.throws(() => d.snapshotDisplay(), /Sprite palette changes.*capture budget/);
});
