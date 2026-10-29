'use strict';
const assert = require('assert'), fs = require('fs');
const { compile } = require('./helpers/program'), { createFakeTimers } = require('./helpers/fakeTimers');
const lightning = require('./helpers/planetZybexLightning'), progression = require('./helpers/planetZybexProgression');
test('Planet Zybex lightning: original horizontal/vertical fades retain separate HUD COLOR00 at every step under PAL/NTSC and normal/half speed', () => {
  const { create } = compile(fs.readFileSync('examples/PlanetZybex/current/Zybex.AMOS'));
  let frames = 0;
  for (const standard of ['PAL', 'NTSC']) for (const scale of [1, 2]) {
    const clock = createFakeTimers(1);
    const result = lightning(progression, create, clock, { read: name => fs.readFileSync('examples/PlanetZybex/' + name, 'latin1') }, p => {
      let mask = 0; const off = p.setJoystickReader(() => mask);
      return { set(value) { mask = value; }, dispose() { mask = 0; off(); } };
    }, require('./fixtures/planet-zybex/progression-input.json'), (name, p, meta) => {
      const s = p.display.snapshotDisplay(), f = s.frame;
      assert.deepStrictEqual([f.outputWidth, f.lines, f.origin.x, f.origin.y], [640, 171, 128, 50]);
      assert.strictEqual(p.display.screen(5).palette[0], 0);
      assert.strictEqual(meta.line, meta.level === 1 ? 1251 : 1423);
      assert.strictEqual(meta.offset, meta.level === 1 ? 58398 : 64474);
      assert.strictEqual(f.overflowEvents.length, 0);
      for (let y = 0; y < 171; y++) {
        const grey = y < 160 ? meta.colour / 0x111 * 17 : 0;
        assert.deepStrictEqual(Array.from(f.linePal.subarray(y * 1024, y * 1024 + 4)), [grey, grey, grey, 255], `${standard} ${scale} ${name} row ${y}`);
      }
      assert.strictEqual(f.lineRegs[160 * 32 + 16] & 2, 0);
      frames++;
    }, standard, scale);
    const peak = 10 + scale, expected = [...Array.from({ length: peak }, (_, i) => i + 1), ...Array.from({ length: peak }, (_, i) => peak - 1 - i)];
    for (const level of [1, 2]) assert.deepStrictEqual(result.flashes.filter(f => f.level === level).map(f => f.colour / 0x111), expected);
    assert.strictEqual(result.progression.level, 3); assert.strictEqual(result.progression.lives, 5);
    assert.strictEqual(clock.pending(), 0);
  }
  assert.strictEqual(frames, 184);
});
