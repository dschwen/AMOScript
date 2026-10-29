'use strict';
const assert = require('assert'), fs = require('fs'), crypto = require('crypto');
const { binary, token: t, integer: n, text, compile, execute } = require('./helpers/program');

test('uncached display operands: original Fastball sources compile without source edits or relaxed cached arities', () => {
  const manifest = require('../examples/Fastball/manifest.json');
  for (const [name, entry] of Object.entries(manifest.files)) {
    const bytes = fs.readFileSync(`${__dirname}/../examples/Fastball/${name}`);
    assert.strictEqual(bytes.length, entry.byteLength); assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    if (name.endsWith('.font')) continue;
    const { create } = compile(bytes); assert.strictEqual(typeof create, 'function');
  }
  for (const line of [[t('Screen Show Number')], [t('Screen Hide Number')], [t('Cls Colour')],
    [t('Print'), t('Logic Of')], [t('Print'), t('Physic Of')], [t('Cls Colour'), n(0), t(','), n(0)]]) assert.throws(() => compile(binary([line])));
});

test('uncached display operands: colour/rectangle clears and numbered Hide/Show preserve selected screen; bare forms remain usable', () => {
  const { program: p } = execute(binary([
    [t('Screen Open'), n(1), t(','), n(320), t(','), n(200), t(','), n(16), t(','), t('Lowres')],
    [t('Screen'), n(0)], [t('Cls'), n(3)], [t('Cls'), n(2), t(','), n(1), t(','), n(1), t('To'), n(3), t(','), n(3)],
    [t('Screen Hide'), n(1)], [t('Wait Key')], [t('Screen Show'), n(1)], [t('Screen Hide')], [t('Wait Key')], [t('Screen Show')], [t('Cls')], [t('Wait Key')]
  ]));
  assert.strictEqual(p.display.current, 0); assert.strictEqual(p.display.screen(1).hidden, true);
  assert.strictEqual(p.display.point(0, 0), 3); assert.strictEqual(p.display.point(2, 2), 2); assert.strictEqual(p.display.point(4, 4), 3);
  p.sendKey('next'); p.tick(100); assert.strictEqual(p.display.screen(1).hidden, false); assert.strictEqual(p.display.screen(0).hidden, true);
  p.sendKey('next'); p.tick(100); assert.strictEqual(p.display.screen(0).hidden, false); assert.ok(p.display.screen(0).pixels.every(v => v === 0)); p.stop();
});

test('uncached display queries: Logic/Physic with screen arguments resolve through normal selectors and bare queries retain current selection', () => {
  const { program: p, logs } = execute(binary([[t('Screen Open'), n(1), t(','), n(320), t(','), n(200), t(','), n(16), t(','), t('Lowres')],
    [t('Double Buffer')], [t('Autoback'), n(0)], [t('Cls'), n(3)], [t('Screen'), n(0)], [t('Cls'), n(2)],
    [t('Screen Copy'), n(0), t('To'), t('Logic'), t('('), n(1), t(')')],
    [t('Print'), t('Logic'), t(','), t('Physic')], [t('Wait Key')]]));
  assert.ok(p.display.screen(1).pixels.every(v => v === 2)); assert.ok(p.display.screen(1).physicalPixels.every(v => v === 1));
  assert.strictEqual(logs[0][0], p.display.bufferSelector('Logic')); assert.strictEqual(logs[0][1], p.display.bufferSelector('Physic')); p.stop();
  assert.throws(() => execute(binary([[t('Screen Copy'), n(0), t('To'), t('Logic'), t('('), n(9), t(')')]])), /Invalid screen selector.*line 1/);
  assert.throws(() => compile(binary([[t('Cls'), text('x')]])), /numeric/);
});
