'use strict';
const assert = require('assert');
const vm = require('vm');
const createPitch = require('../lib/amos/amcafPitch');

test('AMCAF pitch: literal native finetunes and 74-byte portamento stride', () => {
  const p = createPitch();
  assert.deepStrictEqual([-8,-1,0,1,7].map(f => p.tune(428, f)), [453,431,428,425,407]);
  // $974c + 15*$4a points fifteen words into the final tuning row.
  // The signed-finetune correction backs up one entry after searching.
  assert.strictEqual(p.target(428, -1), 363);
  assert.strictEqual(p.target(143, -1), 144);
  assert.strictEqual(p.target(678, 1), 674);
  assert.strictEqual(p.tune(856, 0), 856);
  assert.strictEqual(p.tune(113, 0), 113);
  assert.throws(() => p.target(1, -1), /table address/);
  assert.throws(() => p.tune(1, -1), /table address/);
});

test('AMCAF pitch: slides preserve word wrap and clamp only the low twelve bits', () => {
  const p = createPitch();
  assert.deepStrictEqual(p.slide(120, 10, false), { period: 113, output: 113 });
  assert.deepStrictEqual(p.slide(113, 255, false), { period: 65394, output: 3954 });
  assert.deepStrictEqual(p.slide(850, 10, true), { period: 856, output: 856 });
  assert.deepStrictEqual(p.slide(65530, 10, true), { period: 4, output: 4 });
  assert.deepStrictEqual(p.slide(0x1005, 0, false), { period: 0x1071, output: 113 });
});

test('AMCAF pitch: source sine, nibble memory, negative phase and byte wrap', () => {
  const p = createPitch();
  let v = p.vibrato(428, 0, 0, 0x47);
  assert.deepStrictEqual(v, { output: 428, position: 16, memory: 0x47 });
  v = p.vibrato(428, v.position, v.memory);
  assert.deepStrictEqual(v, { output: 433, position: 32, memory: 0x47 });
  assert.deepStrictEqual(p.vibrato(428, 64, 0x47), { output: 441, position: 80, memory: 0x47 });
  assert.deepStrictEqual(p.vibrato(428, 192, 0x47), { output: 415, position: 208, memory: 0x47 });
  assert.deepStrictEqual(p.vibrato(428, 240, 0x47, 0x20), { output: 423, position: 248, memory: 0x27 });
  assert.deepStrictEqual(p.vibrato(428, 248, 0x47, 0x03), { output: 427, position: 8, memory: 0x43 });
});

test('AMCAF pitch: standalone factories validate inputs and expose no mutable tables', () => {
  const p = vm.runInNewContext(`(${createPitch.toString()})()`);
  assert.strictEqual(p.tune(428, -1), 431);
  assert(Object.isFrozen(p));
  assert(Object.isFrozen(p.vibrato(428, 0, 0)));
  for (const value of [NaN, Infinity, -1, 65536, 1.5]) assert.throws(() => p.slide(value, 1, false));
  for (const value of [-9, 8, undefined]) assert.throws(() => p.tune(428, value));
  assert.throws(() => p.vibrato(428, 256, 0));
  assert.throws(() => p.vibrato(428, 0, 0, -1));
  assert.strictEqual(createPitch().tune(428, 0), 428);
});

test('AMCAF pitch: arpeggio cycles base/high/low and retains contiguous-table spill', () => {
  const p = createPitch();
  assert.deepStrictEqual([0,1,2,3,4,5].map(t => p.arpeggio(428, 0, 0x47, t)), [428,339,285,428,339,285]);
  // The next word after normal tuning's last note belongs to finetune +1.
  assert.strictEqual(p.arpeggio(113, 0, 0x10, 1), 850);
  assert.strictEqual(p.arpeggio(1, 0, 0x10, 1), null);
  assert.throws(() => p.arpeggio(113, -1, 0xf0, 1), /table address/);
  assert.strictEqual(p.arpeggio(1, -1, 0, 1), 1);
  assert.throws(() => p.arpeggio(428, 0, 0x47, -1));
});
