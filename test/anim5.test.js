/* jshint esversion: 6 */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const readAnim = require('../lib/amos/anim'), oracle = require('./fixtures/anim5.json');
const { binary, token: t, integer: n, word: w, text, identifier: id, compile, execute } = require('./helpers/program');
const { createFakeTimers } = require('./helpers/fakeTimers');
const folder = path.join(__dirname, '../examples/Introideen'), asset = () => fs.readFileSync(path.join(folder, 'KugelAnim'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const chunk = (name, data) => { const header = Buffer.alloc(8); header.write(name); header.writeUInt32BE(data.length, 4); return Buffer.concat([header, data, ...(data.length & 1 ? [Buffer.alloc(1)] : [])]); };
const form = (name, data) => chunk('FORM', Buffer.concat([Buffer.from(name), data]));
const assets = () => Object.fromEntries(['KugelAnim', 'introroller'].map(name => [`df1:${name.toLowerCase()}`, fs.readFileSync(path.join(folder, name)).toString('latin1')]));
const make = (replacement = null) => {
  const { create } = compile(binary([[t('Wait Key')]])), clock = createFakeTimers(), reads = assets();
  if (replacement) reads['df1:kugelanim'] = replacement.toString('latin1');
  const p = create({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    files: { read: name => reads[name], write() {} } });
  p.fileOpen(1, 'df1:kugelanim', 'Open In'); return { p, clock };
};

test('ANIM-5: all twenty owned frames and loop buffers match independent Python plane/history hashes', () => {
  const raw = asset(), animation = readAnim(raw);
  for (const [name, expected] of Object.entries(oracle.hashes)) assert.strictEqual(hash(fs.readFileSync(path.join(folder, name))), expected);
  assert.deepStrictEqual([animation.width, animation.height, animation.depth, animation.frames.length], [320, 200, 4, 20]);
  for (const [i, frame] of animation.frames.entries()) {
    assert.strictEqual(hash(frame.pixels), oracle.frames[i].sha256);
    assert.strictEqual(frame.offset, oracle.frames[i].offset);
  }
  assert.strictEqual(hash(animation.frames[0].pixels), hash(animation.frames[18].pixels));
  raw.fill(0); assert.strictEqual(hash(animation.frames[0].pixels), oracle.frames[0].sha256);
  assert.strictEqual(Buffer.from(animation.raw.slice(-4)).toString(), 'AenD');
  assert.strictEqual(readAnim(asset(), { count: 18 }).nextPosition, oracle.frames[18].sourceOffset);
});

test('ANIM-5: byte-column skip, repeat and unique runs are preflighted against complete streams', () => {
  const bmhd = Buffer.alloc(20); bmhd.writeUInt16BE(16); bmhd.writeUInt16BE(5, 2); bmhd[8] = 1;
  const first = form('ILBM', Buffer.concat([chunk('BMHD', bmhd), chunk('CMAP', Buffer.from('000000ffffff', 'hex')), chunk('BODY', Buffer.alloc(10))]));
  const header = Buffer.alloc(40); header[0] = 5; header.writeUInt16BE(16, 2); header.writeUInt16BE(5, 4);
  const table = Buffer.alloc(64); table.writeUInt32BE(64);
  const delta = Buffer.concat([table, Buffer.from([3, 1, 0, 2, 128, 130, 64, 32, 0])]);
  const build = data => form('ANIM', Buffer.concat([first, form('ILBM', Buffer.concat([chunk('ANHD', header), chunk('DLTA', data)]))]));
  const decoded = readAnim(build(delta));
  assert.deepStrictEqual(Array.from(decoded.frames[1].pixels.entries()).filter(([, value]) => value).map(([at]) => at), [16, 32, 49, 66]);
  for (const mutation of [data => data.writeUInt32BE(63), data => { data[64 + 3] = 255; }, data => data.writeUInt32BE(64, 4)]) {
    const bad = Buffer.from(delta); mutation(bad); assert.throws(() => readAnim(build(bad)), /ANIM-5:/);
  }
  assert.throws(() => readAnim(build(delta).subarray(0, -1)), /truncated/);
});

test('Frame Load: exact function encoding, cursor and raw fast/work bank preserve the selected prefix', () => {
  const source = binary([[t('Open In'), n(1), t(','), text('df1:kugelanim')],
    [id('n'), t('='), w(0x25e0), t('('), n(1), t('To'), n(10), t(','), n(18), t(')')],
    [t('Print'), id('n'), t('/'), n(2)], [t('Close'), n(1)]]);
  const files = assets(), result = execute(source, 1000, { files: { read: name => files[name], write() {} } });
  assert.deepStrictEqual(result.logs, [[9]]);
  const bank = result.program.banks.get(10);
  assert.deepStrictEqual([bank.name, bank.memory, bank.permanent], ['Iff     ', 'fast', false]);
  assert.strictEqual(Buffer.from(bank.data.slice(0, 12)).toString('latin1').slice(8), 'ILBM');
  assert.strictEqual(Buffer.from(bank.data.slice(-4)).toString(), 'AenD');
  const { p } = make(); assert.strictEqual(p.frameLoad(1, 10, 18), 18);
  assert.strictEqual(p.fileInfo('Pof', 1), oracle.frames[18].sourceOffset);
  assert.throws(() => p.frameLoad(1, 11, 1), /expected FORM ANIM/); p.stop();
});

test('Frame Load: invalid later frames, parameters and channels preserve existing banks and cursor', () => {
  const raw = asset(), bad = Buffer.from(raw); bad[1886] = 4;
  assert.strictEqual(readAnim(bad, { count: 1 }).frames.length, 1);
  assert.throws(() => readAnim(bad, { count: 2 }), /ANIM-5/);
  const { p: broken } = make(bad); broken.reserveWork(10, 8);
  const previous = broken.banks.get(10), previousAddress = broken.bankStart(10);
  assert.throws(() => broken.frameLoad(1, 10, 2), /ANIM-5/);
  assert.strictEqual(broken.fileInfo('Pof', 1), 0);
  assert.strictEqual(broken.banks.get(10), previous); assert.strictEqual(broken.bankStart(10), previousAddress); broken.stop();
  const { p } = make(); p.reserveWork(10, 8); const old = p.banks.get(10), address = p.bankStart(10);
  p.fileClose(1); p.fileOpen(1, 'df1:kugelanim', 'Open In');
  assert.throws(() => p.frameLoad(1, 1024, 1), /bank\/count/); assert.strictEqual(p.fileInfo('Pof', 1), 0);
  assert.strictEqual(p.banks.get(10), old); assert.strictEqual(p.bankStart(10), address);
  p.fileClose(1); assert.throws(() => p.frameLoad(1, 10, 1), /not open/); p.stop();
});

test('Frame Play: ordinary function returns checked continuation addresses through all double-buffered frames', () => {
  assert.deepStrictEqual(t('Frame Play'), [0x25, 0xec]); const { p } = make(); p.frameLoad(1, 10, 1000);
  p.display.clear(0); p.display.doubleBuffer(); let address = 10;
  for (let i = 0; i < 20; i++) {
    address = p.framePlay(address, 1); p.display.swap(0);
    assert.strictEqual(hash(p.display.screen().physicalPixels), oracle.frames[i].sha256);
  }
  assert.strictEqual(p.framePlay(address, 1), address);
  assert.throws(() => p.framePlay(p.bankStart(10) + 1, 1), /boundary/);
  assert.throws(() => p.framePlay(10, -1), /count/);
  p.display.close(0); assert.strictEqual(p.framePlay(10, 0), p.bankStart(10)); p.stop();
});

test('Frame Play: raw patches preserve unrelated graphics and bypass Bob/Autoback replay', () => {
  const { p } = make(); p.frameLoad(1, 10, 18); p.display.doubleBuffer(); p.display.autoback(0);
  let next = p.framePlay(10, 1); p.display.swap(0); p.display.plot(319, 199, 3); p.display.autoback(2);
  p.display.setDrawingHooks({ before() { throw Error('Frame Play restored Bobs'); }, after() { throw Error('Frame Play replayed Bobs'); } });
  const physical = p.display.screen().physicalPixels.slice(); next = p.framePlay(next, 1);
  assert.strictEqual(p.display.point(319, 199), 3); assert.deepStrictEqual(p.display.screen().physicalPixels, physical);
  p.display.open(1, 320, 100, 16, 0); const old = p.display.screen().pixels.slice();
  assert.throws(() => p.framePlay(next, 1), /format differs/); assert.deepStrictEqual(p.display.screen().pixels, old); p.stop();
});

test('Frame banks: swaps retain addresses while raw writes/shrinks reject and erasure retires continuations', () => {
  const { p } = make(); p.frameLoad(1, 10, 18); const base = p.bankStart(10), next = p.framePlay(10, 1), old = p.banks.get(10).data.slice();
  assert.throws(() => p.poke(base, 0), /animation bank/); assert.throws(() => p.shrinkBank(10, 10), /animation bank/);
  assert.deepStrictEqual(p.banks.get(10).data, old); p.swapBanks(10, 11); assert.strictEqual(p.bankStart(11), base);
  assert.ok(p.framePlay(next, 1) > next); p.eraseBank(11); assert.throws(() => p.framePlay(next, 1), /retired/); p.stop();
});

test('Frame functions: unsupported overloads/types reject and two independent factories own banks and addresses', () => {
  const { p: a } = make(), { p: b } = make(); a.frameLoad(1, 10, 18);
  assert.throws(() => b.framePlay(10, 1), /not reserved/);
  assert.throws(() => compile(binary([[t('Print'), w(0x25cc), t('('), n(1), t('To'), n(10), t(')')]])), /Unsupported token/);
  assert.throws(() => compile(binary([[t('Print'), w(0x2600), t('('), n(10), t(','), n(1), t(','), n(0), t(')')]])), /Unsupported token/);
  assert.throws(() => compile(binary([[t('Print'), t('Frame Play'), t('('), text('10'), t(','), n(1), t(')')]])), /Wrong argument type/);
  a.stop(); b.stop();
});

test('Logoanim: both unchanged complete sources play eighteen original frames, then finish their logo/fade paths', () => {
  for (const name of ['Logoanim.amos', 'Logoanim.Bak']) {
    const raw = fs.readFileSync(path.join(folder, name)); assert.strictEqual(hash(raw), oracle.hashes[name]);
    const { create } = compile(raw), clock = createFakeTimers(), files = assets();
    const p = create({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
      files: { read: name => files[name.toLowerCase()], write() { throw Error('Logo must not write files'); } } });
    try {
      p.tick(10000); assert.strictEqual(p.state.variables.int_n, 18);
      for (let i = 0; i < 18; i++) {
        assert.strictEqual(hash(p.display.screen(2).physicalPixels), oracle.frames[i].sha256, `${name} frame ${i + 1}`);
        clock.tick(name.endsWith('.Bak') ? 120 : 80);
      }
      p.setMouse(0, 0, 1); clock.tick(15000);
      assert.strictEqual(p.state.halted, true); assert.strictEqual(clock.pending(), 0);
    } finally { p.stop(); }
  }
});

test('Frame Play: Stop/Resume preserves source waits, frame addresses and raw buffers without private wakes', () => {
  const source = binary([[t('Open In'), n(1), t(','), text('df1:kugelanim')],
    [id('n'), t('='), t('Frame Load'), t('('), n(1), t('To'), n(10), t(','), n(18), t(')')],
    [t('Cls Colour'), n(0)], [t('Double Buffer')], [t('Autoback'), n(0)],
    [id('f'), t('='), t('Frame Play'), t('('), n(10), t(','), n(1), t(')')], [t('Screen Swap')], [t('Wait Vbl')],
    [id('f'), t('='), t('Frame Play'), t('('), id('f'), t(','), n(1), t(')')], [t('Screen Swap')], [t('Wait Key')]]);
  const { create } = compile(source), clock = createFakeTimers(), files = assets();
  const p = create({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    files: { read: name => files[name], write() {} } });
  p.tick(1000); const address = p.state.variables.int_f, old = hash(p.display.screen().physicalPixels);
  p.stop(); clock.tick(200); assert.strictEqual(hash(p.display.screen().physicalPixels), old); assert.strictEqual(p.state.variables.int_f, address);
  p.resume(); clock.tick(20); assert.strictEqual(p.state.waiting, 'key');
  assert.strictEqual(hash(p.display.screen().physicalPixels), oracle.frames[1].sha256); assert.strictEqual(clock.pending(), 0); p.stop();
});
