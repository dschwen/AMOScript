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
    model: model.createFrameStateModel.toString(), memory: require('../../lib/display/model/ChipMemory').toString(),
    frame: require('../../lib/display/model/staticFrame').toString(),
    colour: require('../../lib/display/model/color').createColorModel.toString(),
    sprites: require('../../lib/display/reference/sprites').createSpriteModel.toString(),
    reference: require('../../lib/display/reference/render').createReferenceRenderer.toString(),
    resources: require('../../lib/display/webgl/resources').createResourceFactory.toString(),
    renderer: require('../../lib/display/webgl/renderer').createRendererFactory.toString(),
    shaders: require('../../lib/display/webgl/shaders').toString(),
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
  const result = await page.evaluate(async ({ sources, images, packets }) => {
    const factory = name => new Function(`return (${sources[name]});`)();
    const model = factory('model')(), colours = factory('colour')(), sprites = factory('sprites')();
    const frame = factory('frame'), Memory = factory('memory'), regs = factory('registers')();
    const build = factory('builder')(regs), dma = factory('dma')(regs), interpret = factory('copper')(model, regs, dma);
    const reference = factory('reference')(model, colours, sprites), createResources = factory('resources')(model);
    const createRenderer = factory('renderer')(model, sprites, createResources, factory('shaders'));
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
    let injectMismatch = false, sample = null;
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
      const empty = frame({ width: 17, height: 0, depth: 1, pointers: [0], rowBytes: 4, palette: [0], interlaceField: 1, outputHeight: 1 });
      assert(gpu.render({ chip: new Uint8Array(524288), frame: empty }).backend === 'gpu-empty' && gpu.readPixels().length === 0, 'empty field');
      const gl = gpu.resources.context, extension = gl.getExtension('WEBGL_lose_context'); assert(extension, 'loss extension');
      const event = name => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`GPU timeout: ${name}`)), 5000);
        canvas.addEventListener(name, () => { clearTimeout(timer); setTimeout(resolve, 0); }, { once: true });
      });
      const lost = event('webglcontextlost'); extension.loseContext(); await lost;
      const snapshot = cases.random(9173), expected = reference.render(snapshot.chip, snapshot.frame);
      assert(gpu.render(snapshot).backend === 'unavailable', 'lost context is not GPU coverage');
      const restored = event('webglcontextrestored'); extension.restoreContext(); await restored;
      assert(gpu.state === 'ready' && gpu.stats.lastResult.backend === 'gpu', 'restored shaders rerender');
      assert(same(gpu.readPixels(), expected), 'restored GPU pixels match latest frame');
      return { checked, imageCount, namedCount, randomCount, drawCalls: gpu.stats.drawCalls, restored: true, reducerVerified: true, sample };
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
