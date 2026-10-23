/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const staticFrame = require('../lib/display/model/staticFrame');
const reference = require('../lib/display/reference/render');
const model = require('../lib/display/model/frameState');

const palette = Array.from({ length: 32 }, (_, i) => ((i & 15) << 8) | ((i >> 4) << 7));
const colour = i => [(i & 15) * 17, (i >> 4) * 136, 0, 255];
function fixture(options = {}) {
  const chip = new Uint8Array(524288);
  const frame = staticFrame({ width: 32, height: 1, depth: 2, pointers: [0, 4], rowBytes: 4, palette, ...options });
  for (let line = 0; line < frame.lines; line++) {
    frame.lineRegs[line * 32 + 10] |= 4 | (4 << 3); frame.lineRegs[line * 32 + 16] |= 4;
  }
  return { chip, frame };
}
function sprite(frame, channel, a, b = 0, x = 0, flags = 0x80000000, line = 0) {
  frame.lineSprites.set([x >>> 0, a, b, flags], line * 32 + channel * 4);
}
const pixel = (snapshot, x, line = 0) => {
  const { chip, frame } = snapshot, rgba = reference.render(chip, frame), at = (line * frame.outputWidth + x) * 4;
  return Array.from(rgba.slice(at, at + 4));
};

test('physical sprites: eight channels decode both words MSB-first with pair palettes and transparent zero', () => {
  for (let channel = 0; channel < 8; channel++) {
    const snapshot = fixture(), { frame } = snapshot;
    sprite(frame, channel, 0xa000, 0x6000);
    const base = 16 + Math.floor(channel / 2) * 4;
    for (const [x, index] of [[0, base + 1], [2, base + 2], [4, base + 3], [6, 0]]) {
      assert.deepStrictEqual(pixel(snapshot, x), colour(index));
      assert.deepStrictEqual(pixel(snapshot, x + 1), colour(index));
    }
    const trace = reference.explainPixel(snapshot.chip, frame, 2, 0);
    assert.strictEqual(trace.sprite.channel, channel); assert.strictEqual(trace.sprite.paletteIndex, base + 2);
    assert.strictEqual(trace.palette.index, 0); assert.strictEqual(trace.final, `#${colour(base + 2).slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('')}`);
  }
});

test('physical sprites: all valid priority codes mask either nonzero dual playfield independently', () => {
  const inFront = [[], [0], [0, 1], [0, 1, 2], [0, 1, 2, 3]];
  for (const pf2First of [false, true]) for (let p1 = 0; p1 < 5; p1++) for (let p2 = 0; p2 < 5; p2++) {
    for (let raw = 0; raw < 4; raw++) for (let pair = 0; pair < 4; pair++) {
      const snapshot = fixture({ dualPlayfield: true }), { chip, frame } = snapshot;
      if (raw & 1) chip[0] = 0x80;
      if (raw & 2) chip[4] = 0x80;
      frame.lineRegs[10] = p1 | (p2 << 3) | (pf2First ? 64 : 0);
      sprite(frame, pair * 2, 0x8000);
      const visible = (!(raw & 1) || inFront[p1].includes(pair)) && (!(raw & 2) || inFront[p2].includes(pair));
      const base = raw === 3 ? (pf2First ? 9 : 1) : raw === 2 ? 9 : raw;
      assert.deepStrictEqual(pixel(snapshot, 0), colour(visible ? 17 + pair * 4 : base));
      assert.strictEqual(reference.explainPixel(chip, frame, 0, 0).sprite.visible, visible);
    }
  }
});

test('physical sprites: normal playfields use PF2 priority and hardware sprite order precedes masking', () => {
  for (let priority = 0; priority < 5; priority++) for (let pair = 0; pair < 4; pair++) {
    const snapshot = fixture(), { chip, frame } = snapshot;
    chip[0] = 0x80; frame.lineRegs[10] = (priority << 3) | (4 - priority);
    sprite(frame, pair * 2, 0x8000);
    assert.deepStrictEqual(pixel(snapshot, 0), colour(pair < priority ? 17 + pair * 4 : 1));
  }
  const snapshot = fixture(), { chip, frame } = snapshot;
  sprite(frame, 1, 0x8000); sprite(frame, 0, 0, 0x8000); sprite(frame, 2, 0x8000);
  assert.deepStrictEqual(pixel(snapshot, 0), colour(18));
  chip[0] = 0x80; frame.lineRegs[10] = 0;
  assert.strictEqual(reference.explainPixel(chip, frame, 0, 0).sprite.channel, 0);
  assert.deepStrictEqual(pixel(snapshot, 0), colour(1));
});

test('physical sprites: attached pairs produce all fifteen colours and keep independent horizontal starts', () => {
  // Each source position contains its own four-bit index 0..15.
  for (let pair = 0; pair < 4; pair++) {
    const snapshot = fixture(), { frame } = snapshot;
    sprite(frame, pair * 2, 0x5555, 0x3333);
    sprite(frame, pair * 2 + 1, 0x0f0f, 0x00ff, 0, 0x80000001);
    for (let value = 0; value < 16; value++) assert.deepStrictEqual(pixel(snapshot, value * 2), colour(value ? 16 + value : 0));
    sprite(frame, pair * 2, 0x8000, 0, 0);
    sprite(frame, pair * 2 + 1, 0x8000, 0, 2, 0x80000001);
    assert.deepStrictEqual(pixel(snapshot, 0), colour(17));
    assert.deepStrictEqual(pixel(snapshot, 2), colour(20));
  }
});

test('physical sprites: signed edge clipping and native-grid sampling are independent of playfield resolution', () => {
  for (const hires of [false, true]) for (const samples of [2, 4]) {
    const snapshot = fixture({ hires, width: 64, rowBytes: 8, pointers: [0, 8] }), { frame } = snapshot;
    if (samples === 4) { frame.chipset = 'ECS'; frame.samplesPerLowresPixel = 4; }
    sprite(frame, 0, 0xffff, 0, -1);
    assert.deepStrictEqual(pixel(snapshot, 0), colour(17));
    assert.deepStrictEqual(pixel(snapshot, 16 * samples - 2), colour(17));
    assert.deepStrictEqual(pixel(snapshot, 16 * samples - 1), colour(0));
    sprite(frame, 0, 0xc000, 0, frame.outputWidth - 1);
    assert.deepStrictEqual(pixel(snapshot, frame.outputWidth - 1), colour(17));
  }
});

test('physical sprites: line state, DMA-independent arming, borders and snapshot ownership are explicit', () => {
  const snapshot = fixture({ height: 2, pointers: [0, 8] }), { chip, frame } = snapshot;
  frame.lineRegs[13] = 8; frame.lineRegs[14] = 24;
  sprite(frame, 0, 0xffff); sprite(frame, 0, 0, 0xffff, 0, 0x80000000, 1);
  assert.deepStrictEqual(pixel(snapshot, 0), colour(17));
  assert.deepStrictEqual(pixel(snapshot, 0, 1), colour(18));
  const frozen = model.createSnapshot(snapshot);
  frame.lineRegs[16] &= ~4;
  assert.deepStrictEqual(pixel(snapshot, 0), colour(17));
  frame.lineSprites[3] = 0;
  assert.deepStrictEqual(pixel(snapshot, 0), colour(0));
  assert.deepStrictEqual(pixel(frozen, 0), colour(17));
  assert.deepStrictEqual(Array.from(reference.render(chip, frozen.frame)), Array.from(reference.render(frozen.chip, frozen.frame)));
});

test('physical sprites: overlaying a HAM command preserves its contribution to later colour history', () => {
  const snapshot = fixture({ depth: 6, ham: true, pointers: [0, 4, 8, 12, 16, 20] }), { chip, frame } = snapshot;
  for (let plane = 0; plane < 6; plane++) chip[plane * 4] = ((0x1f >> plane) & 1) * 0x80 | ((0x2a >> plane) & 1) * 0x40;
  for (let line = 0; line < frame.lines; line++) {
    frame.linePal.set([17, 34, 51, 255], line * 1024);
    frame.linePal.set([255, 0, 0, 255], line * 1024 + 17 * 4);
  }
  sprite(frame, 0, 0x8000);
  assert.deepStrictEqual(pixel(snapshot, 0), [255, 0, 0, 255]);
  assert.deepStrictEqual(pixel(snapshot, 2), [170, 34, 255, 255]);
  const trace = reference.explainPixel(chip, frame, 2, 0);
  assert.deepStrictEqual(trace.ham.previous, [17, 34, 255, 255]);
  assert.strictEqual(trace.sprite, null);
});

test('physical sprites: unsupported widths, even attachment and undocumented priorities reject explicitly', () => {
  for (const change of [frame => sprite(frame, 0, 0, 0, 0, 0x80000002),
    frame => sprite(frame, 0, 0, 0, 0, 0x80000001), frame => sprite(frame, 0, 65536),
    frame => { sprite(frame, 0, 1); frame.lineRegs[10] = 5 << 3; }]) {
    const snapshot = fixture(); change(snapshot.frame);
    assert.throws(() => reference.render(snapshot.chip, snapshot.frame), /unsupported sprite.*line 0/);
  }
});
