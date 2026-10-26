/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { compile } = require('./helpers/program'), { createFakeTimers } = require('./helpers/fakeTimers');
const Reader = require('../lib/Buffer'), reference = require('./fixtures/tunnel/frames.json');
const raw = fs.readFileSync(path.join(__dirname, '../examples/Tunnel/Tunneltest.amos'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
test('Tunnel: complete original source/bank runs all 24 wheel images over both ten-frame branches against 48 independent physical-buffer hashes', () => {
  assert.strictEqual(hash(raw), reference.sourceSha256); assert.strictEqual(raw.length, reference.sourceBytes);
  const r = new Reader(raw), clock = createFakeTimers(), reads = [];
  const p = compile(raw).create({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, files: { read(name) {
    reads.push(name); return (name === 'df1:intrtunic.abk' ? raw.subarray(26 + r.code_bytes) : fs.readFileSync(path.join(__dirname, 'fixtures/tunnel/blank.iff'))).toString('latin1');
  } } });
  p.tick(1000); const physical = p.display.screen(0).physicalPixels;
  for (const [i, frame] of reference.frames.entries()) {
    if (i) clock.tick(20);
    const target = p.display.screen(0); assert.strictEqual(hash(target.physicalPixels), frame.indicesSha256); assert.strictEqual(hash(p.display.canvasFrame().rgba), frame.rgbaSha256);
    assert.strictEqual(p.state.variables.int_anirad, frame.wheel === 27 ? 4 : frame.wheel + 1); assert.strictEqual(p.state.halted, false);
  }
  assert.deepStrictEqual(reads, ['df1:intrtunic.abk', 'df1:intrtunnel']); assert.strictEqual(p.display.screen(1).hidden, true); assert.ok(physical.some(Boolean));
  p.stop(); const field = p.state.ticks; clock.tick(1000); assert.strictEqual(p.state.ticks, field); assert.strictEqual(clock.pending(), 0); p.resume(); clock.tick(20); assert.ok(p.state.ticks > field); p.stop();
});
