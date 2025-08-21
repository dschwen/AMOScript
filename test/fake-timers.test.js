'use strict';

const assert = require('assert');
const { createFakeTimers } = require('./helpers/fakeTimers');

test('fakeTimers: schedule order and tick', () => {
  const ft = createFakeTimers();
  const events = [];

  ft.setTimeout(() => events.push(['a', ft.now()]), 10);
  ft.setTimeout(() => events.push(['b', ft.now()]), 5);
  ft.setTimeout(() => events.push(['c', ft.now()]), 5);

  // Nothing runs until tick
  assert.strictEqual(events.length, 0);

  ft.tick(5);
  assert.deepStrictEqual(events, [['b', 5], ['c', 5]]);

  ft.tick(5);
  assert.deepStrictEqual(events, [['b', 5], ['c', 5], ['a', 10]]);
  assert.strictEqual(ft.pending(), 0);
});

