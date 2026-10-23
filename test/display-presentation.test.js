/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const layout = require('../lib/display/presentation/layout');
const field = { outputWidth: 640, lines: 200, pixelAspect: { numerator: 1, denominator: 2 } };

test('presentation layout: exact pixel aspect and integer scaling preserve native detail with letterboxing', () => {
  const value = layout(field, 1280, 900);
  assert.deepStrictEqual([value.x, value.y, value.width, value.height, value.scale, value.integerScale], [0, 50, 1280, 800, 2, true]);
  const odd = layout({ ...field, outputWidth: 17, lines: 3, pixelAspect: { numerator: 10, denominator: 11 } }, 200, 100);
  assert.deepStrictEqual([odd.x, odd.y, odd.width, odd.height], [15, 33, 170, 33]);
});

test('presentation layout: fractional fit and undersized viewports report noninteger scaling', () => {
  const integer = layout(field, 1000, 700), fit = layout(field, 1000, 700, { integerScale: false });
  assert.deepStrictEqual([integer.x, integer.y, integer.width, integer.height], [180, 150, 640, 400]);
  assert.deepStrictEqual([fit.x, fit.y, fit.width, fit.height, fit.integerScale], [0, 37, 1000, 625, false]);
  const small = layout(field, 64, 40);
  assert.deepStrictEqual([small.width, small.height, small.integerScale], [64, 40, false]);
});

test('presentation layout: aspect overrides are owned/reduced and empty fields contain no invented row', () => {
  const aspect = { numerator: 2, denominator: 4 }, value = layout(field, 640, 480, { pixelAspect: aspect });
  assert.deepStrictEqual(value.pixelAspect, { numerator: 1, denominator: 2 });
  assert.deepStrictEqual(aspect, { numerator: 2, denominator: 4 });
  assert.ok(Object.isFrozen(value) && Object.isFrozen(value.pixelAspect));
  const empty = layout({ ...field, lines: 0 }, 640, 480);
  assert.deepStrictEqual([empty.width, empty.height, empty.scale], [0, 0, 0]);
});

test('presentation layout: invalid geometry/aspects reject before canvas allocation', () => {
  for (const size of [0, -1, 1.5, 16385, NaN]) assert.throws(() => layout(field, size, 480), /viewport/);
  for (const aspect of [{ numerator: 0, denominator: 1 }, { numerator: 1, denominator: 0 }, { numerator: 1.5, denominator: 1 }]) {
    assert.throws(() => layout(field, 640, 480, { pixelAspect: aspect }), /aspect/);
  }
  assert.throws(() => layout({ ...field, lines: -1 }, 640, 480), /dimensions/);
  assert.throws(() => layout(field, 640, 480, { integerScale: 'yes' }), /integer scale/);
});
