/* jshint esversion: 6 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadFixture, comparePixels } = require('./displayFrames');
const { decodePng, encodePng } = require('./displayPng');
const model = require('../../lib/display/model/frameState');

module.exports = async function webglRendererProbe(page, artifacts) {
  const directory = path.join(__dirname, '../fixtures/display');
  const sources = {
    windowProgram: new (require('../../lib/Transpiler'))(require('./tokens').binary([[require('./tokens').token('Wait Key')]])).toModule(),
    model: model.createFrameStateModel.toString(), memory: require('../../lib/display/model/ChipMemory').toString(),
    frame: require('../../lib/display/model/staticFrame').toString(),
    colour: require('../../lib/display/model/color').createColorModel.toString(),
    sprites: require('../../lib/display/reference/sprites').createSpriteModel.toString(),
    reference: require('../../lib/display/reference/render').createReferenceRenderer.toString(),
    resources: require('../../lib/display/webgl/resources').createResourceFactory.toString(),
    renderer: require('../../lib/display/webgl/renderer').createRendererFactory.toString(),
    shaders: require('../../lib/display/webgl/shaders').toString(),
    layout: require('../../lib/display/presentation/layout').toString(),
    registers: require('../../lib/display/model/registers').createRegisterModel.toString(),
    builder: require('../../lib/display/copper/builder').createCopperBuilder.toString(),
    dma: require('../../lib/display/copper/spriteDma').createSpriteDmaFactory.toString(),
    copper: require('../../lib/display/copper/interpreter').createCopperInterpreter.toString(),
    ilbm: require('../../lib/display/model/ilbm').createIlbmReader.toString(), cases: require('./gpuFrames').toString()
  };
  function bytes(descriptor) {
    const value = fs.readFileSync(path.join(directory, descriptor.file));
    if (crypto.createHash('sha256').update(value).digest('hex') !== descriptor.sha256) throw new Error(`GPU fixture hash mismatch: ${descriptor.file}`);
    return value;
  }
  const images = [];
  for (const name of ['ilbm', 'ehb', 'laced']) {
    const corpus = JSON.parse(fs.readFileSync(path.join(directory, `${name}-fixtures.json`)));
    for (const fixture of corpus.fixtures || [corpus]) for (const encoding of ['raw', 'byterun']) {
      const golden = decodePng(bytes(fixture.files.golden));
      images.push({ name: fixture.files[encoding].file, bytes: bytes(fixture.files[encoding]).toString('base64'),
        golden: Buffer.from(golden.rgba).toString('base64'), width: golden.width, height: golden.height, laced: name === 'laced' });
    }
  }
  const manifests = [path.join(directory, 'basic-planar.frame.json')];
  const regressions = path.join(directory, 'gpu-regressions');
  if (fs.existsSync(regressions)) for (const name of fs.readdirSync(regressions).filter(name => name.endsWith('.frame.json')).sort()) manifests.push(path.join(regressions, name));
  const packets = manifests.map(filename => {
    const fixture = loadFixture(filename), wire = model.serializeSnapshot(fixture.snapshot);
    return { name: fixture.manifest.name, header: wire.header, chip: Buffer.from(wire.chip).toString('base64'),
      tables: Buffer.from(wire.tables).toString('base64'), golden: Buffer.from(fixture.golden.rgba).toString('base64') };
  });
  function addPacket(name, snapshot, golden) {
    const wire = model.serializeSnapshot(snapshot);
    packets.push({ name, header: wire.header, chip: Buffer.from(wire.chip).toString('base64'),
      tables: Buffer.from(wire.tables).toString('base64'), golden: Buffer.from(golden).toString('base64') });
  }
  const { compile } = require('./program'), { createFakeTimers } = require('./fakeTimers');
  const { create } = compile(require('./wonderlandStartup')(64, true)), timers = createFakeTimers();
  const title = create({ now: timers.now, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
    displayOptions: { snapshotChipBytes: 524288 }, files: { read: name => fs.readFileSync(path.join(__dirname, '../../examples/Wonderland', name.split('/').pop())).toString('latin1') } });
  title.tick(100000); timers.tick(20);
  addPacket('wonderland-original-title', title.display.snapshotDisplay(), decodePng(fs.readFileSync(path.join(__dirname, '../fixtures/wonderland/title-setup.png'))).rgba);
  const rainbow = require('../../lib/amos/display')({ snapshotChipBytes: 524288 });
  rainbow.open(0, 320, 256, 16, 0); rainbow.clear(14); rainbow.setColour(14, 0x135);
  rainbow.setRainbow(1, 14, 16, '', '', '');
  for (let y = 0; y < 16; y++) rainbow.setRain(1, y, y * 0x111);
  rainbow.rainbow(1, 3, 250, 10);
  const golden = new Uint8Array(640 * 256 * 4);
  for (let y = 0; y < 256; y++) {
    const rgb = y >= 200 && y < 210 ? (3 + y - 200) * 0x111 : 0x135;
    for (let x = 0; x < 640; x++) golden.set([(rgb >> 8) * 17, ((rgb >> 4) & 15) * 17, (rgb & 15) * 17, 255], (y * 640 + x) * 4);
  }
  addPacket('amos-rainbow-pal-wrap', rainbow.snapshotDisplay(), golden);
  const result = await page.evaluate(async ({ sources, images, packets }) => {
    const factory = name => new Function(`return (${sources[name]});`)();
    const model = factory('model')(), colours = factory('colour')(), sprites = factory('sprites')();
    const frame = factory('frame'), Memory = factory('memory'), regs = factory('registers')();
    const build = factory('builder')(regs), dma = factory('dma')(regs), interpret = factory('copper')(model, regs, dma);
    const reference = factory('reference')(model, colours, sprites), createResources = factory('resources')(model);
    const createRenderer = factory('renderer')(model, sprites, createResources, factory('shaders'), factory('layout'));
    const readIlbm = factory('ilbm')(Memory, model, frame), cases = factory('cases')(frame, build, interpret, regs);
    const canvas = document.createElement('canvas'), gpu = createRenderer(canvas);
    const from64 = text => Uint8Array.from(atob(text), ch => ch.charCodeAt(0));
    const to64 = bytes => {
      let text = ''; for (let i = 0; i < bytes.length; i += 16384) text += String.fromCharCode(...bytes.subarray(i, i + 16384));
      return btoa(text);
    };
    const same = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);
    const assert = (condition, message) => { if (!condition) throw new Error(`GPU parity: ${message}`); };
    let checked = 0, randomCount = 0, namedCount = 0, imageCount = 0;
    let injectMismatch = false, sample = null, presentationChecks = 0;
    function compare(snapshot) {
      const before = gpu.stats.drawCalls, result = gpu.render(snapshot);
      assert(result.backend === 'gpu' && result.passes === 2 && gpu.stats.drawCalls === before + 2, 'actual GPU passes required');
      const actual = gpu.readPixels();
      if (injectMismatch) actual[0] ^= 1; // Prove the reducer, without inventing a GPU defect.
      return { actual, expected: reference.render(snapshot.chip, snapshot.frame) };
    }
    function mismatch(snapshot) { const output = compare(snapshot); return same(output.actual, output.expected) ? null : output; }
    function minimized(snapshot) {
      let current = model.createSnapshot(snapshot), output = mismatch(current);
      const first = output.actual.findIndex((value, i) => value !== output.expected[i]), line = Math.floor(first / 4 / current.frame.outputWidth);
      const f = current.frame, one = { ...f, lines: 1, outputHeight: 1, interlaceField: null,
        lineRegs: f.lineRegs.slice(line * 32, (line + 1) * 32), linePal: f.linePal.slice(line * 1024, (line + 1) * 1024),
        lineSprites: f.lineSprites.slice(line * 32, (line + 1) * 32), lineEvents: new Uint32Array(f.maxEvents * 4),
        eventOffsets: new Uint32Array(2), overflowEvents: new Uint32Array(0) };
      let candidate = model.createSnapshot({ chip: current.chip, frame: one });
      if (mismatch(candidate)) current = candidate;
      for (let planes = ((current.frame.lineRegs[8] >> 12) & 7) - 1; planes >= 0; planes--) {
        candidate = model.createSnapshot(current); candidate.frame.lineRegs[8] = (candidate.frame.lineRegs[8] & ~0x7000) | (planes << 12);
        if (mismatch(candidate)) current = candidate;
      }
      for (let channel = 7; channel >= 0; channel--) {
        candidate = model.createSnapshot(current); candidate.frame.lineSprites.fill(0, channel * 4, channel * 4 + 4);
        if (mismatch(candidate)) current = candidate;
      }
      output = compare(current);
      const wire = model.serializeSnapshot(current);
      return { header: wire.header, chip: to64(wire.chip), tables: to64(wire.tables),
        width: current.frame.outputWidth, height: current.frame.lines, actual: to64(output.actual), expected: to64(output.expected) };
    }
    function verify(snapshot, name, golden = null) {
      const output = compare(snapshot);
      if (golden) assert(same(output.expected, golden), `CPU oracle differs from independent golden ${name}`);
      if (!same(output.actual, output.expected)) return { name, ...minimized(snapshot) };
      if (typeof globalThis.AMOS_DEMO_OBSERVE === 'function') globalThis.AMOS_DEMO_OBSERVE({ name,
        width: snapshot.frame.outputWidth, height: snapshot.frame.lines, rgba: output.actual });
      const indices = gpu.resources.readTexture('indexBuf');
      for (let y = 0; y < snapshot.frame.lines; y++) for (let x = 0; x < snapshot.frame.outputWidth; x++) {
        // Sparse traces keep the test bounded on large priority/scroll matrices.
        if (![0, Math.floor(snapshot.frame.lines / 2), snapshot.frame.lines - 1].includes(y)) continue;
        if (x > 3 && x % 17 !== 0 && x !== snapshot.frame.outputWidth - 1) continue;
        const trace = reference.explainPixel(snapshot.chip, snapshot.frame, x, y), value = indices[y * snapshot.frame.outputWidth + x];
        assert((value & 255) === trace.rawIndex && !!(value & 256) === !trace.active, `${name} decode stage at ${x},${y}`);
      }
      checked++; return null;
    }
    try {
      // Language bridge snapshots, independently expected from indexed patterns.
      // Two palette banks force setup across the real two-row blank gap.
      const module = { exports: {} }; new Function('module', sources.windowProgram)(module);
      const windowProgram = module.exports(), display = windowProgram.display;
      for (const hires of [false, true]) {
        display.open(0, hires ? 960 : 640, 288, 16, hires ? 0x8000 : 0);
        display.setPalette(...Array.from({ length: 16 }, (_, i) => i * 0x111));
        const world = display.screen();
        for (let i = 0; i < world.pixels.length; i++) world.pixels[i] = ((i % world.width) + Math.floor(i / world.width)) % 16;
        display.screenDisplay(0, 128, 48, 320, 168);
        display.open(1, hires ? 640 : 320, 256, 16, hires ? 0x8000 : 0);
        display.setPalette(...Array.from({ length: 16 }, (_, i) => i << 8));
        const panel = display.screen();
        for (let i = 0; i < panel.pixels.length; i++) panel.pixels[i] = ((i % panel.width) + Math.floor(i / panel.width) * 3) % 16;
        display.screenDisplay(1, 128, 218, 320, 32); display.select(0);
        for (const offset of hires ? [2, 14, 16, 38] : [1, 15, 16, 37]) {
          display.screenOffset(0, offset, 84);
          const expected = new Uint8Array(640 * 202 * 4);
          for (let y = 0; y < 202; y++) for (let x = 0; x < 640; x++) {
            const sourceX = hires ? x : x >> 1;
            const value = y < 168 ? (sourceX + offset + y + 84) % 16 : y >= 170 ? (sourceX + (y - 170) * 3) % 16 : 0;
            const colour = value * 17;
            expected.set([colour, y < 168 ? colour : 0, y < 168 ? colour : 0, 255], (y * 640 + x) * 4);
          }
          const failure = verify(display.snapshotDisplay(), `amos-${hires ? 'hires' : 'lowres'}-window-${offset}`, expected);
          if (failure) return { failure };
        }
      }
      windowProgram.stop();
      const fading = module.exports({ now: () => 0, setTimeout: () => 1, clearTimeout() {} });
      const fadeDisplay = fading.display;
      fadeDisplay.setPalette(...Array(32).fill(0)); fadeDisplay.setColour(1, 0xf53); fadeDisplay.clear(1);
      fading.fade(2);
      for (const [vbl, steps] of [[1, 1], [3, 2], [15, 8], [29, 15]]) {
        fading.advanceFade(vbl);
        const expected = new Uint8Array(640 * 200 * 4);
        const pixel = [Math.max(0, 15 - steps) * 17, Math.max(0, 5 - steps) * 17, Math.max(0, 3 - steps) * 17, 255];
        for (let at = 0; at < expected.length; at += 4) expected.set(pixel, at);
        const failure = verify(fadeDisplay.snapshotDisplay(), `amos-fade-vbl-${vbl}`, expected);
        if (failure) return { failure };
      }
      fading.stop();
      const copying = module.exports({ now: () => 0, setTimeout: () => 1, clearTimeout() {} });
      const copyDisplay = copying.display;
      copyDisplay.setPalette(...Array(32).fill(0));copyDisplay.setColour(1,0xf00);copyDisplay.setColour(2,0x0f0);
      copyDisplay.clear(1);copyDisplay.doubleBuffer();copyDisplay.autoback(0);copyDisplay.clear(2);
      const logical = copyDisplay.screen().pixels, physical = copyDisplay.screen().physicalPixels;
      for (const published of [false,true]) {
        if (published) copyDisplay.copyScreen(copyDisplay.bufferSelector('Logic'),copyDisplay.bufferSelector('Physic'));
        assert(copyDisplay.screen().pixels === logical && copyDisplay.screen().physicalPixels === physical,'Copy must retain buffer identities');
        const expected = new Uint8Array(640 * 200 * 4), pixel = published ? [0,255,0,255] : [255,0,0,255];
        for (let at = 0; at < expected.length; at += 4) expected.set(pixel,at);
        const failure = verify(copyDisplay.snapshotDisplay(),`amos-screen-copy-${published ? 'published' : 'hidden'}`,expected);
        if (failure) return { failure };
      }
      copying.stop();
      const flashing = module.exports({ now: () => 0, setTimeout: () => 1, clearTimeout() {} });
      flashing.display.clear(1);flashing.flash(1,'(f00,2)(0f0,3)(00f,1)');
      for (const [vbl,pixel] of [[1,[255,0,0,255]],[3,[0,255,0,255]]]) {
        flashing.advancePalette(vbl);
        const expected = new Uint8Array(640 * 200 * 4);
        for (let at = 0; at < expected.length; at += 4) expected.set(pixel,at);
        const failure = verify(flashing.display.snapshotDisplay(),`amos-flash-vbl-${vbl}`,expected);
        if (failure) return { failure };
      }
      flashing.stop();
      for (const packet of packets) {
        const snapshot = model.deserializeSnapshot(packet.header, from64(packet.chip), from64(packet.tables));
        const failure = verify(snapshot, packet.name, from64(packet.golden)); if (failure) return { failure };
      }
      for (const image of images) for (const field of image.laced ? [0, 1] : [null]) {
        const snapshot = readIlbm(from64(image.bytes), field == null ? {} : { field }).snapshot;
        const full = from64(image.golden), golden = new Uint8Array(image.width * snapshot.frame.lines * 4);
        for (let y = 0; y < snapshot.frame.lines; y++) {
          const source = (field == null ? y : y * 2 + field) * image.width * 4;
          golden.set(full.subarray(source, source + image.width * 4), y * image.width * 4);
        }
        const failure = verify(snapshot, `${image.name}-${field}`, golden); if (failure) return { failure };
        imageCount++;
      }
      for (const item of cases.named()) {
        const failure = verify(item.snapshot, item.name); if (failure) return { failure }; namedCount++;
        if (item.name === 'copper-stack-dma') sample = { width: item.snapshot.frame.outputWidth, height: item.snapshot.frame.lines, rgba: to64(gpu.readPixels()) };
      }
      for (let i = 0; i < 100; i++) {
        const seed = (0x414d4f53 + Math.imul(i, 0x9e3779b9)) >>> 0, snapshot = cases.random(seed);
        const failure = verify(snapshot, `seed-${seed}`); if (failure) return { failure }; randomCount++;
      }
      injectMismatch = true;
      const reduced = minimized(cases.random(9173));
      injectMismatch = false;
      const reducedSnapshot = model.deserializeSnapshot(reduced.header, from64(reduced.chip), from64(reduced.tables));
      assert(reducedSnapshot.frame.lines === 1 && ((reducedSnapshot.frame.lineRegs[8] >> 12) & 7) === 0 &&
        reducedSnapshot.frame.lineSprites.every(value => value === 0), 'reducer shrinks rows, planes and sprites');
      assert(same(compare(reducedSnapshot).actual, from64(reduced.expected)), 'reduced fixture replays without the deliberate harness mismatch');
      const before = gpu.stats.drawCalls;
      const invalid = frame({ width: 33, height: 1, depth: 1, pointers: [524286], rowBytes: 6, palette: [0] });
      let rejected = false;
      try { gpu.render({ chip: new Uint8Array(524288), frame: invalid }); } catch (error) { rejected = /out of bounds/.test(error.message); }
      assert(rejected && gpu.stats.drawCalls === before, 'bounds reject before drawing');
      for (const change of [f => { f.lineRegs[8] = 0x6800; }, f => { f.lineRegs[17] = 1; f.lineEvents[1] = 0x180; },
        f => { f.chipset = 'AGA'; f.samplesPerLowresPixel = 4; }]) {
        const f = frame({ width: 17, height: 1, depth: 1, pointers: [0], rowBytes: 4, palette: [0] }); change(f);
        rejected = false; try { gpu.render({ chip: new Uint8Array(524288), frame: f }); } catch (error) { rejected = /not implemented/.test(error.message); }
        assert(rejected && gpu.stats.drawCalls === before, 'unsupported mode rejects without fallback');
      }
      const readCanvas = () => {
        const gl = gpu.resources.context, bytes = new Uint8Array(canvas.width * canvas.height * 4), top = new Uint8ClampedArray(bytes.length);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
        for (let y = 0; y < canvas.height; y++) top.set(bytes.subarray((canvas.height - 1 - y) * canvas.width * 4, (canvas.height - y) * canvas.width * 4), y * canvas.width * 4);
        assert(gl.getError() === gl.NO_ERROR, 'canvas readback'); return top;
      };
      const quad = { chip: new Uint8Array(524288), frame: frame({ width: 2, height: 2, depth: 2, pointers: [0, 4], rowBytes: 2, palette: [0, 0xf00, 0x0f0, 0x00f] }) };
      quad.chip.set([0x80, 0, 0x80, 0, 0x40, 0, 0x80, 0]); gpu.render(quad);
      const nativeQuad = reference.render(quad.chip, quad.frame);
      const colours = [[0,0,0,255],[255,0,0,255],[0,255,0,255],[0,0,255,255]];
      const presentationCases = [
        { name: 'presentation-integer-aspect', options: { width: 12, height: 10 }, rect: [2,1,8,8], integer: true,
          at: (x,y) => y >= 1 && y <= 4 ? (x >= 2 && x <= 5 ? 1 : x >= 6 && x <= 9 ? 2 : 0) : y >= 5 && y <= 8 && x >= 2 && x <= 5 ? 3 : 0 },
        { name: 'presentation-square-aspect', options: { width: 8, height: 8, pixelAspect: { numerator: 1, denominator: 1 } }, rect: [0,2,8,4], integer: true,
          at: (x,y) => y >= 2 && y <= 3 ? (x < 4 ? 1 : 2) : y >= 4 && y <= 5 && x < 4 ? 3 : 0 },
        { name: 'presentation-fractional-fit', options: { width: 3, height: 3, integerScale: false, pixelAspect: { numerator: 1, denominator: 1 } }, rect: [0,0,3,2], integer: false,
          at: (x,y) => [[1,2,2],[3,0,0],[0,0,0]][y][x] },
        { name: 'presentation-downsample', options: { width: 2, height: 2 }, rect: [0,0,2,2], integer: false,
          at: (x,y) => [[1,2],[3,0]][y][x] }
      ];
      for (const item of presentationCases) {
        const draws = gpu.stats.drawCalls, shown = gpu.present(item.options), r = shown.layout;
        assert(shown.backend === 'gpu' && shown.passes === 1 && gpu.stats.drawCalls === draws + 1, `${item.name} actual presentation draw`);
        assert(same([r.x,r.y,r.width,r.height], item.rect) && r.integerScale === item.integer, `${item.name} layout`);
        const actual = readCanvas(), expected = new Uint8ClampedArray(actual.length);
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) expected.set(colours[item.at(x,y)], (y * canvas.width + x) * 4);
        assert(same(actual, expected), `${item.name} nearest samples, orientation and opaque borders`);
        assert(same(gpu.readPixels(), nativeQuad), 'presentation preserves native framebuffer');
        if (typeof globalThis.AMOS_DEMO_OBSERVE === 'function') globalThis.AMOS_DEMO_OBSERVE({ name: item.name, width: canvas.width, height: canvas.height, rgba: actual });
        presentationChecks++;
      }
      let invalidViewport = false;
      try { gpu.present({ width: 0, height: 10 }); } catch (error) { invalidViewport = /viewport/.test(error.message); }
      assert(invalidViewport, 'invalid viewport rejects');
      const empty = frame({ width: 17, height: 0, depth: 1, pointers: [0], rowBytes: 4, palette: [0], interlaceField: 1, outputHeight: 1 });
      assert(gpu.render({ chip: new Uint8Array(524288), frame: empty }).backend === 'gpu-empty' && gpu.readPixels().length === 0, 'empty field');
      assert(gpu.present({ width: 3, height: 2 }).backend === 'gpu-empty' && readCanvas().every((value, i) => value === (i % 4 === 3 ? 255 : 0)), 'empty field clears presentation without inventing rows');
      presentationChecks++;
      const gl = gpu.resources.context, extension = gl.getExtension('WEBGL_lose_context'); assert(extension, 'loss extension');
      const event = name => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`GPU timeout: ${name}`)), 5000);
        canvas.addEventListener(name, () => { clearTimeout(timer); setTimeout(resolve, 0); }, { once: true });
      });
      const lost = event('webglcontextlost'); extension.loseContext(); await lost;
      const snapshot = cases.random(9173), expected = reference.render(snapshot.chip, snapshot.frame);
      assert(gpu.render(snapshot).backend === 'unavailable', 'lost context is not GPU coverage');
      assert(gpu.present({ width: 12, height: 10, integerScale: false, pixelAspect: { numerator: 1, denominator: 1 } }).backend === 'unavailable', 'lost presentation is not GPU coverage');
      const restored = event('webglcontextrestored'); extension.restoreContext(); await restored;
      assert(gpu.state === 'ready' && gpu.stats.lastResult.backend === 'gpu', 'restored shaders rerender');
      assert(same(gpu.readPixels(), expected), 'restored GPU pixels match latest frame');
      const restoredView = gpu.stats.lastPresentation;
      assert(restoredView.backend === 'gpu' && canvas.width === 12 && canvas.height === 10, 'restore presents the latest requested viewport');
      const shown = readCanvas(), r = restoredView.layout, wanted = new Uint8ClampedArray(shown.length);
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const at = (y * canvas.width + x) * 4;
        wanted[at + 3] = 255;
        if (x < r.x || y < r.y || x >= r.x + r.width || y >= r.y + r.height) continue;
        const sx = Math.floor((x - r.x + 0.5) * snapshot.frame.outputWidth / r.width), sy = Math.floor((y - r.y + 0.5) * snapshot.frame.lines / r.height);
        wanted.set(expected.subarray((sy * snapshot.frame.outputWidth + sx) * 4, (sy * snapshot.frame.outputWidth + sx + 1) * 4), at);
      }
      assert(same(shown, wanted), 'restored canvas presents latest owned GPU pixels'); presentationChecks++;
      return { checked, imageCount, namedCount, randomCount, presentationChecks, drawCalls: gpu.stats.drawCalls, restored: true, reducerVerified: true, sample };
    } finally {
      const gl = gpu.resources.context; gpu.dispose();
      const extension = gl.getExtension('WEBGL_lose_context'); if (extension && !gl.isContextLost()) extension.loseContext();
    }
  }, { sources, images, packets });
  if (result.failure) {
    const f = result.failure, safe = f.name.replace(/[^a-zA-Z0-9_-]/g, '-');
    const actual = Buffer.from(f.actual, 'base64'), expected = Buffer.from(f.expected, 'base64');
    const diff = comparePixels(f.width, f.height, actual, expected);
    fs.mkdirSync(artifacts, { recursive: true }); fs.mkdirSync(regressions, { recursive: true });
    fs.writeFileSync(path.join(artifacts, `${safe}-gpu.png`), encodePng(f.width, f.height, actual));
    fs.writeFileSync(path.join(artifacts, `${safe}-diff.png`), encodePng(f.width, f.height, diff.diff));
    const data = { chip: Buffer.from(f.chip, 'base64'), tables: Buffer.from(f.tables, 'base64'), golden: encodePng(f.width, f.height, expected) };
    const blobs = {};
    for (const [kind, bytes] of Object.entries(data)) {
      const file = `${safe}.${kind === 'golden' ? 'png' : `${kind}.bin`}`; fs.writeFileSync(path.join(regressions, file), bytes);
      blobs[kind] = { file, byteLength: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    }
    fs.writeFileSync(path.join(regressions, `${safe}.frame.json`), JSON.stringify({ fixtureVersion: 1, name: safe,
      evidence: { kind: 'synthetic', description: `Automatically reduced GPU/CPU parity failure ${f.name}; expected output is the CPU reference, not an Amiga capture.` }, snapshot: f.header, blobs }, null, 2) + '\n');
    throw new Error(`GPU parity failed: ${f.name}, ${JSON.stringify(diff.first)}; minimized fixture saved in ${regressions}`);
  }
  if (result.sample) fs.writeFileSync(path.join(artifacts, 'gpu-copper-stack.png'), encodePng(result.sample.width, result.sample.height, Buffer.from(result.sample.rgba, 'base64')));
  delete result.sample;
  return result;
};
