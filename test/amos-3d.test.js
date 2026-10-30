'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { binary, word, token: t, integer: n, text, compile, execute } = require('./helpers/program');
const createThreeD = require('../lib/amos/threeD'), createDisplay = require('../lib/amos/display');
const { createFakeTimers } = require('./helpers/fakeTimers');
const root = path.join(__dirname, '../examples/Amos3D');
const assets = Object.fromEntries(require('../examples/Amos3D/manifest.json').assets.map(a => [a.name, fs.readFileSync(path.join(root, a.name)).toString('latin1')]));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const ext = offset => [...word(0x4e), 4, 0, ...word(offset)];
function setup(read = file => assets[file]) {
  const display = createDisplay(), controller = createThreeD({ display, integer: Math.trunc, read });
  return { display, controller };
}

test('AMOS 3D: original assets and implemented slot-4 names/signatures match pinned provenance', () => {
  for (const asset of require('../examples/Amos3D/manifest.json').assets) {
    const bytes = Buffer.from(assets[asset.name], 'latin1'); assert.strictEqual(bytes.length, asset.byteLength); assert.strictEqual(hash(bytes), asset.sha256);
  }
  const table = require('../tools/reference/amos-3d-tokens.json');
  assert.strictEqual(table.assembledVerification.matchedEntries, 82);
  for (const [offset, entry] of Object.entries(require('../lib/ExtensionTable')[4])) {
    const original = table.tokens[Number(offset).toString(16).padStart(4, '0')];
    assert.strictEqual(entry.name.toLowerCase(), original.name);
    assert.strictEqual('I' + entry.args.map(type => type === 'string' ? '2' : '0').join(','), original.signature);
  }
  assert.throws(() => compile(binary([[ext(0x6c), n(1)]])), /Unsupported extension 4:0x6c/);
  assert.throws(() => compile(binary([[ext(0x16), n(1)]])), /requires a string/);
});

test('AMOS 3D: original object/template/surface reads are synchronous, deduplicated per load and committed atomically', () => {
  const reads = [], { controller: c } = setup(file => { reads.push(file); return assets[file]; });
  c.load('auto'); c.load('hero'); c.load('auto');
  assert.deepStrictEqual(reads, ['auto.3DO', 'p8.3DT', 'hero.3DO', 'p8.3DT', 'pq236002.3DS', 'pq236001.3DS']);
  assert.deepStrictEqual(c.snapshot().definitions, ['auto', 'hero']);
  for (const invalid of [undefined, Promise.resolve('bad'), 'bad', '(999999)short', '(1)\u0100']) {
    const { controller } = setup(() => invalid); assert.throws(() => controller.load('auto'), /AMOS 3D/); assert.deepStrictEqual(controller.snapshot().definitions, []);
  }
  const { controller } = setup(file => file === 'p8.3DT' ? assets[file].slice(0, -1) : assets[file]);
  assert.throws(() => controller.load('auto'), /truncated/); assert.deepStrictEqual(controller.snapshot().definitions, []);
});

test('AMOS 3D: malformed offsets, reference types, surface pointers and unsupported strokes reject before installing a model', () => {
  const mutate = (name, offset, bytes) => { const b = Buffer.from(assets[name], 'latin1'), start = b.indexOf(41) + 1; b.set(bytes, start + offset); return b.toString('latin1'); };
  for (const [name, modified] of [
    ['auto.3DO', mutate('auto.3DO', 60, [255, 255])],
    ['auto.3DO', assets['auto.3DO'].replace('(4,110,p8)', '(2,110,p8)')],
    ['auto.3DO', assets['auto.3DO'].replace('(4,156,p8)', '(4,110,p8)')],
    ['p8.3DT', mutate('p8.3DT', 3388, [255])],
    ['pq236001.3DS', mutate('pq236001.3DS', 38, [0, 0, 0, 1])],
    ['pq236001.3DS', mutate('pq236001.3DS', 198, [2, 0])]
  ]) {
    const { controller } = setup(file => file === name ? modified : assets[file]);
    assert.throws(() => controller.load(name === 'auto.3DO' || name === 'p8.3DT' ? 'auto' : 'hero'), /AMOS 3D/);
    assert.deepStrictEqual(controller.snapshot().definitions, []);
  }
});

test('AMOS 3D: directory and Dir$ resolution are captured before file callbacks; instances own their poses', () => {
  let c; const reads = []; const display = createDisplay();
  c = createThreeD({ display, integer: Math.trunc, resolve: name => 'volume:' + name, read(file) { reads.push(file); c.dir('changed'); return assets[file.split('/').pop()]; } });
  c.dir('objects'); c.load('auto'); assert.deepStrictEqual(reads, ['volume:objects/auto.3DO', 'volume:objects/p8.3DT']);
  c.object(1, 'auto', 1, 2, 1000, -1, 65536, 65537); c.object(2, 'auto', 0, 0, 2000, 0, 0, 0);
  c.moveRel(1, 5, -4, 3); c.angleRel(1, 2, -1, 65535);
  assert.deepStrictEqual(c.snapshot().objects[0], { id: 1, name: 'auto', position: [6, -2, 1003], angles: [1, 65535, 0] });
  assert.deepStrictEqual(c.snapshot().objects[1].position, [0, 0, 2000]);
  const snapshot = c.snapshot(); snapshot.objects[0].position[0] = 99; assert.strictEqual(c.snapshot().objects[0].position[0], 6);
  assert.throws(() => c.object(1, 'auto', 0, 0, 0, 0, 0, 0), /unused/);
  assert.throws(() => c.move(1, 9000000, 0, 0), /range/); assert.deepStrictEqual(c.snapshot().objects[0].position, [6, -2, 1003]);
  assert.throws(() => c.dir('../outside'), /directory/); assert.throws(() => c.load('auto.3DO'), /bare/);
  c.kill(1); assert.strictEqual(c.snapshot().definitions.length, 1); c.clearAll(); assert.strictEqual(c.snapshot().definitions.length, 0);
});

test('AMOS 3D: all 104 unchanged excerpt frames run; six full indexed images match an independent Python ray/plane renderer', () => {
  const clock = createFakeTimers(), p = compile(require('./helpers/amos3DProgram')()).create({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    files: { read: file => assets[file.split('/').pop()] } });
  const oracle = require('./fixtures/amos-3d.json'); p.tick(10000);
  for (let frame = 1; frame <= 104; frame++) {
    assert.strictEqual(p.state.waiting, 'sleep');
    const expected = oracle.frames.find(f => f.frame === frame);
    if (expected) {
      const object = p.threeDSnapshot().objects[0]; assert.deepStrictEqual(Array.from(object.position), expected.position); assert.deepStrictEqual(Array.from(object.angles), expected.angles);
      assert.strictEqual(hash(p.display.screen().physicalPixels), expected.sha256);
    }
    clock.tick(20);
  }
  assert.strictEqual(p.state.waiting, 'key'); assert.strictEqual(p.threeDSnapshot().objects[0].name, 'hero');
  p.sendKey('done'); clock.tick(0); assert.strictEqual(p.state.halted, true); assert.strictEqual(clock.pending(), 0);
});

test('AMOS 3D: foreground masks, upper bitplanes, logical buffer ownership, palette, graphics cursor and drawing hooks are preserved', () => {
  const { controller: c, display: d } = setup(); d.open(0, 320, 240, 64, 0); c.load('auto'); c.object(1, 'auto', 0, 0, 1000, 0, 0, 0);
  const s = d.screen(); s.pixels.fill(16); s.pixels[100 * 320 + 160] = 31; d.doubleBuffer(); d.autoback(2); d.setLine(0xaaaa); d.grLocate(3, 4); d.locate(2, 3);
  let hooks = 0; d.setDrawingHooks({ before() { hooks++; }, after() { hooks++; } }); const before = s.physicalPixels.slice(), palette = s.palette.slice(), phase = s.linePhase;
  const snapshot = d.snapshotPlayfield(); c.redraw(); assert.strictEqual(s.pixels[100 * 320 + 160], 31); assert.ok(s.pixels.every(v => v & 16));
  assert.deepStrictEqual(s.physicalPixels, before); assert.deepStrictEqual(s.palette, palette); assert.deepStrictEqual([s.gx, s.gy, s.x, s.y, s.linePhase, hooks], [3, 4, 2, 3, phase, 0]);
  const rendered = s.pixels.slice(); c.redraw(); assert.deepStrictEqual(s.pixels, rendered); // occupied bit 3 masks the second redraw
  c.cls(); assert.ok(s.pixels.slice(0, 64000).every(v => v === 16)); assert.deepStrictEqual(s.pixels.slice(64000), before.slice(64000));
  assert.strictEqual(snapshot.frame.outputWidth, 640); d.swap(); assert.notStrictEqual(s.pixels, s.physicalPixels);
});

test('AMOS 3D: camera translation, angle wrapping and object-centre ordering have deterministic rendering', () => {
  const { controller: c, display: d } = setup(); c.load('auto'); c.object(1, 'auto', 25, 30, 1000, 0, 0, 0); c.cls(); c.redraw(); const image = d.screen().pixels.slice();
  c.move(0, 50, -10, 100); c.move(1, 75, 20, 1100); c.cls(); c.redraw(); assert.deepStrictEqual(d.screen().pixels, image);
  c.angle(1, 65536, -65536, 131072); c.cls(); c.redraw(); assert.deepStrictEqual(d.screen().pixels, image);
  c.move(1, 0, 0, -1000); c.cls(); c.redraw(); assert.ok(d.screen().pixels.every(v => v === 0));
});

test('AMOS 3D: near-plane geometry is bounded; unsupported clipped surfaces fail without partial pixels', () => {
  const { controller: c, display: d } = setup(); c.load('auto'); c.load('hero'); c.object(1, 'auto', 0, 0, 20, 0, 0, 0); c.cls(); c.redraw(); assert.ok(d.screen().pixels.every(v => v <= 15));
  c.object(2, 'hero', 0, 0, 20, 8000, 0, 0); const before = d.screen().pixels.slice(); assert.throws(() => c.redraw(), /near-clipped surface/); assert.deepStrictEqual(d.screen().pixels, before);
  c.clearAll(); c.cls(); assert.ok(d.screen().pixels.every(v => v === 0));
});

test('AMOS 3D: geometry/depth constraints reject before writes and height controls only the top region', () => {
  for (const [w, h, colours, mode] of [[320, 100, 16, 0], [320, 200, 8, 0], [640, 200, 16, 32768], [320, 200, 4096, 0], [320, 200, 16, 32768]]) {
    const { controller: c, display: d } = setup(); d.open(0, w, h, colours, mode); const before = d.screen().pixels.slice(); assert.throws(() => c.cls(), /requires a nonlaced/); assert.deepStrictEqual(d.screen().pixels, before);
  }
  const { controller: c, display: d } = setup(); c.screenHeight(32); c.cls(); assert.ok(d.screen().pixels.slice(0, 10240).every(v => v === 0)); assert.ok(d.screen().pixels.slice(10240).every(v => v === 1));
  for (const value of [0, -1, 257]) assert.throws(() => c.screenHeight(value), /1..256/);
});


test('AMOS 3D: all twelve registered statements execute in standalone factories with source-located failures', () => {
  const p = execute(binary([
    [ext(0x4d6), text('models/')], [ext(0x16), text('auto')], [ext(0x54), n(120)],
    [ext(0x36), n(1), t(','), text('auto'), ...[0,0,1000,0,0,0].flatMap(v => [t(','), n(v)])],
    [ext(0xec), ...[1,1,2,1200].flatMap((v,i) => [...(i ? t(',') : []), n(v)])],
    [ext(0xd4), ...[1,3,4,5].flatMap((v,i) => [...(i ? t(',') : []), n(v)])],
    [ext(0x1a6), ...[1,1000,2000,3000].flatMap((v,i) => [...(i ? t(',') : []), n(v)])],
    [ext(0x18c), ...[1,10,20,30].flatMap((v,i) => [...(i ? t(',') : []), n(v)])],
    [ext(0x53c)], [ext(0x318)], [ext(0x90), n(1)], [ext(0x24)], [t('Wait Key')]
  ]), 100, { files: { read: file => assets[file.slice(7)] } }).program;
  assert.strictEqual(p.threeDSnapshot().height, 120); assert.strictEqual(p.threeDSnapshot().objects.length, 0); assert.strictEqual(p.threeDSnapshot().definitions.length, 0); p.stop();
  assert.throws(() => execute(binary([[ext(0x90), n(1)]])), /object instance not defined at line 1, byte 22/);
});
