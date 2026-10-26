/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), createDisplay = require('../lib/amos/display');
const rgba = rgb => [(rgb >> 8) * 17, ((rgb >> 4) & 15) * 17, (rgb & 15) * 17, 255];

test('screen clipping: a late first window fetches row zero, parks off-field and returns with intact buffers and View staging in PAL/NTSC', () => {
  for (const standard of ['PAL', 'NTSC']) {
    const end = standard === 'PAL' ? 310 : 260, y = standard === 'PAL' ? 280 : 256;
    const d = createDisplay({ snapshotStandard: standard }); d.open(0, 320, 96, 16, 0);
    const s = d.screen(); s.palette[0] = 0x123;
    for (let row = 0; row < 96; row++) s.pixels.fill(row % 15 + 1, row * 320, (row + 1) * 320);
    d.doubleBuffer(); s.pixels.fill(0);
    d.screenDisplay(0, 128, y, 320, 96);
    const before = d.canvasFrame(), snapshot = d.snapshotDisplay();
    assert.deepStrictEqual([before.width, before.height], [320, end - y]);
    for (let row = 0; row < before.height; row++) assert.deepStrictEqual(Array.from(before.rgba.slice(row * 1280, row * 1280 + 4)), rgba(s.palette[row % 15 + 1]));
    assert.deepStrictEqual(d.pointerHardwarePosition(0, 0, 320, end - y), [128, y]);
    d.autoViewOff(); d.screenDisplay(0, null, 500);
    assert.deepStrictEqual(d.canvasFrame().rgba, before.rgba); d.view();
    const parked = d.canvasFrame(); assert.strictEqual(parked.height, end);
    for (const row of [0, end - 1]) assert.deepStrictEqual(Array.from(parked.rgba.slice(row * 1280, row * 1280 + 4)), rgba(0x123));
    assert.strictEqual(s.hardwareY, 500); assert.strictEqual(s.windowHeight, 96);
    assert.strictEqual(d.snapshotDisplay().frame.lineRegs.some((value, i) => i % 32 === 16 && (value & 2)), false);
    assert.deepStrictEqual(d.pointerHardwarePosition(160, end - 1, 320, end), [288, end - 1]);
    d.screenOffset(0, 16, 0); d.view(); assert.throws(() => d.snapshotDisplay(), /outside physical bitmap/); d.screenOffset(0, 0, 0); d.view();
    d.screenDisplay(0, null, y); d.view(); assert.deepStrictEqual(d.canvasFrame().rgba, before.rgba);
    assert.ok(s.pixels.every(value => value === 0)); assert.strictEqual(snapshot.frame.origin.y, y);
  }
});

test('screen clipping: falling foreground windows preserve native setup rows, field bounds, source geometry and background restoration', () => {
  const d = createDisplay(); d.open(0, 320, 256, 16, 0); d.clear(1); d.setColour(1, 0xf00); d.screenDisplay(0, 128, 42, 320, 256);
  d.open(1, 320, 200, 16, 0); d.clear(1); d.setColour(1, 0x0f0);
  for (const y of [240, 241, 242, 255, 256, 280, 297, 298, 299, 309, 310, 315, 500]) {
    d.screenDisplay(1, 128, y, 320, 56);
    const frame = d.canvasFrame(), bottom = y < 310 ? Math.max(298, Math.min(310, y + 56)) : 298;
    assert.deepStrictEqual([frame.width, frame.height], [320, bottom - 42]);
    for (let line = 42; line < bottom; line++) {
      const front = line >= y && line < y + 56;
      const setup = line === y - 1 || (line === y + 56 && line < 298);
      const rgb = setup ? 0 : front ? 0x0f0 : line < 298 ? 0xf00 : 0;
      assert.deepStrictEqual(Array.from(frame.rgba.slice((line - 42) * 1280, (line - 42) * 1280 + 4)), rgba(rgb), `window Y=${y}, raster ${line}`);
    }
    assert.strictEqual(d.screen(1).windowHeight, 56); assert.strictEqual(d.screen(1).hardwareY, y);
  }
});
