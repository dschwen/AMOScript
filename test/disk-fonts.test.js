'use strict';
const assert = require('assert'), fs = require('fs'), createDisplay = require('../lib/amos/display');
const { binary, token: t, integer: n, text, execute } = require('./helpers/program');
const atlas = require('./helpers/diskFontFixture');
const commands = binary([[t('Cls Colour'), n(0)], [t('Get Disc Fonts')], [t('Set Font'), n(1)], [t('Ink'), n(1)],
  [t('Text'), n(3), t(','), n(8), t(','), text('A?')], [t('Wait Key')]]);

test('disk fonts: emitted Get Disc Fonts/Set Font rasterize owned monospaced MSB-first rows with width, height, baseline and fallback', () => {
  const font = atlas(), { program: p } = execute(commands, 1000, { displayOptions: { diskFonts: [font] } });
  for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) {
    const row = y - 2, col = x - 3, glyph = Math.floor(col / 10), gx = col % 10;
    const active = row >= 0 && row < 9 && col >= 0 && col < 20;
    const expected = active && (glyph === 0 ? gx === 0 || gx === 9 || row === 4 : gx === row || gx === 9 - row) ? 1 : 0;
    assert.strictEqual(p.display.point(x, y), expected, `${x},${y}`);
  }
  font.data.fill(0); p.display.clear(0); p.display.text(3, 8, 'A\u0100'); assert.strictEqual(p.display.point(3, 2), 1); assert.strictEqual(p.display.point(13, 2), 1);
  p.display.getDiscFonts(); p.display.clear(0); p.display.text(3, 8, 'A'); assert.strictEqual(p.display.point(3, 2), 1);
  p.display.setFont(1); p.display.clear(0); p.display.text(3, 8, 'A'); assert.ok(p.display.screen().pixels.every(v => v === 0)); p.stop();
});

test('disk fonts: selection is per-screen, resets with Set Font 0 and screen replacement, and does not change Print/Writing', () => {
  const d = createDisplay({ diskFonts: [atlas()] }); d.clear(0); d.pen(1); d.paper(0); d.write('A'); const expected = d.screen().pixels.slice();
  d.clear(0); d.getDiscFonts(); d.setFont(1); d.write('A'); assert.deepStrictEqual(d.screen().pixels, expected);
  d.clear(0); d.ink(1); d.text(0, 6, 'A'); assert.strictEqual(d.point(9, 8), 1);
  d.open(1, 320, 200, 16, 0); d.clear(0); d.ink(1); d.text(0, 6, 'A'); assert.strictEqual(d.point(9, 8), 0);
  d.select(0); d.clear(0); d.text(0, 6, 'A'); assert.strictEqual(d.point(9, 8), 1);
  d.setFont(0); d.clear(0); d.text(0, 6, 'A'); assert.strictEqual(d.point(9, 8), 0);
  d.setFont(1); d.open(0, 320, 200, 16, 0); d.clear(0); d.ink(1); d.text(0, 6, 'A'); assert.strictEqual(d.point(9, 8), 0);
});

test('disk fonts: transparent/opaque graphics text clips to the bitmap while preserving ordinary indexed writes', () => {
  const d = createDisplay({ diskFonts: [atlas()] }); d.getDiscFonts(); d.setFont(1); d.clear(2); d.ink(1, 3); d.grWriting(0); d.text(-1, 6, 'A');
  assert.strictEqual(d.point(1, 1), 2); assert.strictEqual(d.point(8, 1), 1);
  d.grWriting(1); d.text(-1, 6, 'A'); assert.strictEqual(d.point(1, 1), 3); assert.strictEqual(d.point(8, 1), 1);
  d.text(318, 199, 'A'); assert.strictEqual(d.screen().pixels.length, 64000);
});

test('disk fonts: missing enumeration/bitmap, invalid selection and malformed catalogues reject without substituting the system font', () => {
  const d = createDisplay(); assert.throws(() => d.setFont(1), /not examined/); d.setFont(0); d.getDiscFonts(); assert.throws(() => d.setFont(1), /Font not defined/);
  for (const value of [-1, 0.5, NaN]) assert.throws(() => d.setFont(value));
  for (const diskFonts of [Promise.resolve([]), new Array(129), [null], new Array(1), [{ ...atlas(), width: 17 }], [{ ...atlas(), height: 33 }], [{ ...atlas(), baseline: 9 }], [{ ...atlas(), data: new Uint8Array(1) }]]) assert.throws(() => createDisplay({ diskFonts }).getDiscFonts(), /Invalid disk font/);
  const fonts = [atlas()], a = createDisplay({ diskFonts: fonts }); a.getDiscFonts(); a.setFont(1); fonts.push(null); assert.throws(() => a.getDiscFonts()); a.clear(0); a.ink(1); a.text(0, 6, 'A'); assert.strictEqual(a.point(9, 8), 1);
  const raw = fs.readFileSync(`${__dirname}/../examples/Fastball/Fastballhigh.AMOS`);
  assert.throws(() => execute(raw), /Font not defined.*line 2/);
  const { program: p } = execute(raw, 10000, { displayOptions: { diskFonts: [atlas()] } }); assert.strictEqual(p.state.waiting, 'key'); p.stop();
});

test('disk fonts: Font$ exposes the owned native 38-character catalogue and proportional advances', () => {
  const f=atlas(); f.name='ASM.Font'; f.advances=Array(256).fill(4);
  const {program:p}=execute(binary([[t('Get Disc Fonts')],[t('Print'),t('Font$'),t('('),n(1),t(')')],[t('Wait Key')]]),1000,{displayOptions:{diskFonts:[f]}});
  assert.strictEqual(p.display.fontName(1),'ASM.Font'.padEnd(30)+'9   Disc');
  assert.strictEqual(p.display.fontName(0),''); assert.strictEqual(p.display.fontName(2),'');
  f.name='changed'; f.advances.fill(0); p.display.setFont(1); p.display.clear(0); p.display.ink(1); p.display.text(0,6,'AA');
  assert.strictEqual(p.display.point(13,0),1); assert.strictEqual(p.display.point(14,0),0); p.stop();
  for(const advances of [[],Array(256).fill(-1),Array(256).fill(33),new Array(256)])assert.throws(()=>createDisplay({diskFonts:[{...atlas(),advances}]}).getDiscFonts(),/advances/);
  assert.throws(()=>p.display.fontName(-1),/font number/);
});
