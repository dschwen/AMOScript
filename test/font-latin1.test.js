/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), fs = require('fs'), crypto = require('crypto');
const createFont = require('../lib/amos/font'), createDisplay = require('../lib/amos/display');
const { binary, token: t, integer: n, text, execute } = require('./helpers/program');
const header = fs.readFileSync(`${__dirname}/fixtures/font/font8x8_ext_latin.h`, 'utf8');
const rows = [...header.matchAll(/\{\s*((?:0x[0-9a-f]+,?\s*){8})\}/gi)].map(match => match[1].match(/0x[0-9a-f]+/gi).map(Number));

test('font: all 96 Latin-1 glyphs match the pinned public-domain upstream rows and factories own their arrays', () => {
  assert.strictEqual(crypto.createHash('sha256').update(header).digest('hex'), require('./fixtures/font/source.json').sha256);
  assert.strictEqual(rows.length, 96); const font = createFont(); assert.strictEqual(font.length, 2048);
  for (let i = 0; i < 96; i++) assert.deepStrictEqual(Array.from(font.slice((160 + i) * 8, (161 + i) * 8)), rows[i]);
  font[228 * 8] = 0; assert.notStrictEqual(createFont()[228 * 8], 0);
});

test('font: standalone Print, Writing and graphics Text preserve Latin-1 bytes and rasterize umlauts independently', () => {
  const message = 'ÄÖÜ äöü ß';
  const { program: p } = execute(binary([[t('Cls Colour'), n(0)], [t('Pen'), n(1)], [t('Paper'), n(0)],
    [t('Print'), text(message)], [t('Writing'), n(2)], [t('Print'), text(message)],
    [t('Ink'), n(1)], [t('Text'), n(0), t(','), n(23), t(','), text(message)], [t('Wait Key')]]));
  for (let line = 0; line < 3; line++) for (let c = 0; c < message.length; c++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const code = message.charCodeAt(c), bits = code === 32 ? 0 : rows[code - 160][y];
    assert.strictEqual(p.display.point(c * 8 + x, line * 8 + y), (bits >> x) & 1, `${line}:${c}:${x},${y}`);
  }
  p.stop();
  const d = createDisplay(); d.clear(0); d.ink(1); d.text(0, 7, '\u0100'); d.text(8, 7, '?');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) assert.strictEqual(d.point(x, y), d.point(x + 8, y));
});
