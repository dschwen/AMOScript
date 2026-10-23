/* jshint esversion: 6 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { token: t, integer: n, word, text, binary, execute, compile } = require('./helpers/program');
const golden = Buffer.from(fs.readFileSync(path.join(__dirname, 'fixtures/image-banks.hex'), 'utf8').replace(/\s/g, ''), 'hex');
const withBanks = lines => Buffer.concat([binary(lines), golden.subarray(20)]);
const setup = [[t('Bob Update Off')], [t('Hot Spot'), n(1), t(','), n(0), t(','), n(0)]];
const masked = [...setup, [t('Make Mask Image'), n(1)]];
const bob = (id, x, y, image = 1) => [t('Bob'), n(id), t(','), n(x), t(','), n(y), t(','), n(image)];
const fn = (name, value) => [t(name), t('('), n(value), t(')')];
const range = (id, first, last) => [t('Bob Col Range'), t('('), n(id), t(','), n(first), t('To'), n(last), t(')')];

test('collisions: masks distinguish transparent bounding-box overlap from one-pixel contact', () => {
  const { program, logs } = execute(withBanks([
    ...masked, bob(0, 0, 0), bob(1, 3, 0), [t('Print'), fn('Bob Col', 0)]
  ]));
  assert.deepStrictEqual(logs, [[0]]);
  program.setBob(1, 2, 0, null);
  assert.strictEqual(program.bobCollision(0), -1);
  assert.strictEqual(program.collisionInfo(1), -1);
  assert.strictEqual(program.collisionInfo(0), 0); // The source is never a target.
  program.setBob(1, 16, 0, null);
  assert.strictEqual(program.bobCollision(0), 0);
  program.setBob(1, 0, 2, null);
  assert.strictEqual(program.bobCollision(0), 0);
  program.setBob(1, 0, 1, null);
  assert.strictEqual(program.bobCollision(0), -1);
});

test('collisions: ranged syntax includes endpoints, excludes self, and replaces the hit table', () => {
  const { program, logs } = execute(withBanks([
    ...masked, bob(0, 0, 0), bob(1, 0, 0), bob(2, 0, 0), bob(3, 40, 0),
    [t('Print'), range(0, 1, 2), t(','), fn('Col', 1), t(','), fn('Col', 2), t(','), fn('Col', 3)],
    [t('Print'), range(0, 2, 2), t(','), fn('Col', 1), t(','), fn('Col', 2)],
    [t('Print'), range(0, 0, 0)], [t('Print'), range(0, 3, 1)]
  ]));
  assert.deepStrictEqual(logs, [[-1, -1, -1, 0], [-1, 0, -1], [0], [0]]);
  assert.strictEqual(program.collisionInfo(2), 0);
});

test('collisions: Col negative searches are repeatable, skip Bob zero at -1, and retain historical hits', () => {
  const { program } = execute(withBanks([...masked, bob(0, 0, 0), bob(1, 0, 0), bob(2, 0, 0), bob(4, 0, 0)]));
  assert.strictEqual(program.bobCollision(1), -1);
  assert.strictEqual(program.collisionInfo(0), -1);
  assert.strictEqual(program.collisionInfo(-1), 2);
  assert.strictEqual(program.collisionInfo(-1), 2); // Search does not consume results.
  assert.strictEqual(program.collisionInfo(-3), 4);
  assert.strictEqual(program.collisionInfo(-5), 0);
  assert.strictEqual(program.collisionInfo(256), -1); // GetCol keeps the low byte.
  assert.strictEqual(program.collisionInfo(-255), 0);
  program.bobOff(2);
  assert.strictEqual(program.collisionInfo(2), -1);
  assert.strictEqual(program.bobCollision(99), 0);
  assert.strictEqual(program.collisionInfo(0), 0);
  assert.strictEqual(program.collisionInfo(4), 0);
});

test('collisions: absent masks, No Mask and hidden images do not collide; drawing creates default masks', () => {
  const { program } = execute(withBanks([...setup, bob(0, 0, 0), bob(1, 0, 0)]));
  assert.strictEqual(program.bobCollision(0), 0);
  assert.strictEqual(program.banks.get(1).images[0].mask, null);
  program.updateBobs();
  assert.strictEqual(program.bobCollision(0), -1);
  program.noMask(1);
  assert.strictEqual(program.bobCollision(0), 0);
  program.makeMask(1);
  assert.strictEqual(program.bobCollision(0), -1);
  program.setBob(1, null, null, 0);
  assert.strictEqual(program.bobCollision(0), 0);
  const withoutBank = execute(binary([[t('Print'), fn('Bob Col', 0)]])).logs;
  assert.deepStrictEqual(withoutBank, [[0]]);
});

test('collisions: queued coordinates and full masks ignore screen bounds, visibility limits and plane selection', () => {
  const { program } = execute(withBanks([
    ...masked, [t('Set Bob'), n(0), t(','), n(0), t(','), n(0), t(',')],
    bob(0, -100, -100), bob(1, -99, -100),
    [t('Limit Bobs Area'), n(0), t(','), n(100), t('To'), n(32), t(','), n(120)]
  ]));
  assert.strictEqual(program.bobCollision(0), -1);
  program.display.open(1, 320, 200, 16, 0);
  program.setBob(2, -100, -100, 1);
  assert.strictEqual(program.bobCollision(2), 0);
  program.setBob(1, 40, 40, null);
  assert.strictEqual(program.bobCollision(0), 0);
  program.setBob(1, -100, -100, null);
  assert.strictEqual(program.bobCollision(0), -1);
});

test('collisions: masks and hotspots use stored orientation until a flipped image is actually drawn', () => {
  // Replace the empty second Sprite slot with another copy of the independent
  // image bytes, so one image can flip while the target mask remains unchanged.
  const banks = Buffer.concat([golden.subarray(0, 50), golden.subarray(32, 50), golden.subarray(60)]);
  const { program } = execute(Buffer.concat([binary([
    ...setup, [t('Hot Spot'), n(2), t(','), n(0), t(','), n(0)], [t('Make Mask')],
    bob(0, 16, 0, 0x8001), bob(1, 13, 0, 2)
  ]), banks.subarray(20)]));
  const image = program.banks.get(1).images[0];
  assert.strictEqual(program.bobCollision(0), 0);
  assert.strictEqual(image.orientation, 0);
  // Off-screen Paste Bob moves the source's opaque pixels from x=16..18 to
  // x=13..15, where they overlap the target. Querying alone did not flip it.
  program.pasteBob(1000, 1000, 0x8001);
  assert.strictEqual(image.orientation, 0x8000);
  assert.strictEqual(image.hotspotX, 16);
  assert.strictEqual(program.bobCollision(0), -1);
  assert.strictEqual(image.orientation, 0x8000); // Queries do not reorient.
  program.pasteBob(1000, 1000, 1);
  assert.strictEqual(program.bobCollision(0), 0);
  program.hotSpot(1, 5, 3);
  program.setBob(0, 5, 3, null); program.setBob(1, 0, 0, null);
  assert.strictEqual(program.bobCollision(0), -1);
  program.setBob(0, 32767, 0, null); program.setBob(1, 32767, 0, null);
  program.hotSpot(1, 0, 0);
  assert.strictEqual(program.bobCollision(0), 0); // Signed-word bounds wrap.
});

test('collisions: result tables are per program and argument errors preserve previous results', () => {
  const { create } = compile(withBanks([...masked, bob(0, 0, 0), bob(1, 0, 0)]));
  const a = create({ setTimeout() {}, print() {} }), b = create({ setTimeout() {}, print() {} });
  a.tick(100); b.tick(100);
  assert.strictEqual(a.bobCollision(0), -1);
  assert.strictEqual(b.collisionInfo(1), 0);
  assert.throws(() => a.bobCollision(-1), /Invalid Bob collision argument/);
  assert.strictEqual(a.collisionInfo(1), -1);
  assert.throws(() => a.bobCollision(0, -1, 2), /Invalid Bob collision argument/);
  assert.strictEqual(a.bobCollision(65536), -1); // Source lookup uses its low word.
});

test('collisions: original opcodes, To grammar, types and source-located errors are checked', () => {
  const { logs } = execute(withBanks([
    ...masked, bob(0, 0, 0), bob(1, 0, 0),
    [t('Print'), word(0x1b36), t('('), n(0), t(')'), t(','), word(0x1b52), t('('), n(1), t(')')],
    [t('Print'), word(0x1b46), t('('), n(0), t(','), n(1), t('To'), n(1), t(')')]
  ]));
  assert.deepStrictEqual(logs, [[-1, -1], [-1]]);
  assert.throws(() => compile(withBanks([[t('Print'), t('Bob Col Range'), t('('), n(0), t(','), n(1), t(','), n(2), t(')')]])), /Expected To/);
  assert.throws(() => compile(withBanks([[t('Print'), t('Bob Col'), t('('), text('bad'), t(')')]])), /Wrong argument type/);
  assert.throws(() => execute(withBanks([[t('Print'), fn('Bob Col', -1)]])), /Invalid Bob collision argument at line 1/);
  assert.throws(() => execute(withBanks([[t('Print'), range(0, 0, -1)]])), /Invalid Bob collision argument at line 1/);
});
