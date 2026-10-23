/* jshint esversion: 6 */
'use strict';

module.exports = async function webglResourcesProbe(page) {
  const { createResourceFactory } = require('../../lib/display/webgl/resources');
  const { createFrameStateModel } = require('../../lib/display/model/frameState');
  const staticFrame = require('../../lib/display/model/staticFrame');
  const ChipMemory = require('../../lib/display/model/ChipMemory');
  return page.evaluate(async sources => {
    const model = new Function(`return (${sources.model})();`)();
    const createResources = new Function('model', `return (${sources.resources})(model);`)(model);
    const makeFrame = new Function(`return (${sources.frame});`)();
    const Memory = new Function(`return (${sources.memory});`)();
    const assert = (condition, message) => { if (!condition) throw new Error(`WebGL resources: ${message}`); };
    const equal = (actual, expected, name) => {
      assert(actual.constructor.name === expected.constructor.name && actual.length === expected.length, `${name} type/length`);
      for (let i = 0; i < actual.length; i++) assert(actual[i] === expected[i], `${name} at ${i}: ${actual[i]} != ${expected[i]}`);
    };
    const canvas = document.createElement('canvas'), states = [];
    const resources = createResources(canvas, { onStateChange: value => states.push(value.state) });
    const secondCanvas = document.createElement('canvas'), second = createResources(secondCanvas);
    const gl = resources.context, extension = gl.getExtension('WEBGL_lose_context');
    assert(extension, 'context loss extension unavailable');
    const actualUploads = [], restoredPrograms = [], restoredVaos = [];
    const texSubImage2D = gl.texSubImage2D.bind(gl), createProgram = gl.createProgram.bind(gl), createVertexArray = gl.createVertexArray.bind(gl);
    gl.texSubImage2D = (...args) => {
      if (args[4] === 2048 && args[6] === gl.RED_INTEGER && args[7] === gl.UNSIGNED_BYTE) actualUploads.push([args[3], args[3] + args[5]]);
      return texSubImage2D(...args);
    };
    gl.createProgram = () => { const value = createProgram(); restoredPrograms.push(value); return value; };
    gl.createVertexArray = () => { const value = createVertexArray(); restoredVaos.push(value); return value; };
    const event = name => new Promise((resolve, reject) => {
      const timer = setTimeout(() => { canvas.removeEventListener(name, listener); reject(new Error(`Timeout waiting for ${name}`)); }, 5000);
      // Restoration may only be requested after the lost-event dispatch has
      // completed, including its cancellation/default-action processing.
      const listener = () => { clearTimeout(timer); setTimeout(resolve, 0); };
      canvas.addEventListener(name, listener, { once: true });
    });
    const beforeDispose = [];
    try {
      const checkedSizes = [];
      for (const size of [524288, 1048576, 2097152]) {
        const memory = new Memory(size);
        for (let i = 0; i < size; i++) memory.bytes[i] = (i * 17 + (i >>> 11) * 29) & 255;
        memory.markDirty(0, size);
        const frame = makeFrame({ width: 17, height: 3, depth: 1, pointers: [0], rowBytes: 4,
          palette: Array.from({ length: 32 }, (_, i) => ((i & 15) << 8) | (((i * 3) & 15) << 4) | ((i * 7) & 15)) });
        frame.lineRegs[15] = (-7) >>> 0;
        frame.lineSprites.set([0xffffffff, 0x8123, 0xfedc, 0x80000001], 4);
        frame.lineRegs[17] = 1; frame.lineEvents.set([0xffffffff, 0x180, 0x123, 0]);
        const publish = () => model.createSnapshot({ chip: memory.bytes, frame });
        const snapshot = publish(), initialCalls = actualUploads.length; resources.upload(snapshot);
        assert(JSON.stringify(actualUploads.slice(initialCalls)) === JSON.stringify([[0, size / 2048]]), 'actual full texSubImage2D call');
        assert(resources.stats.lastUpload.full && resources.stats.lastUpload.chipRows === size / 2048, 'full upload after size change');
        equal(resources.readTexture('chip'), memory.bytes, `chip ${size}`);
        for (const name of ['lineRegs', 'linePal', 'lineSprites', 'lineEvents', 'eventOffsets', 'overflowEvents']) {
          equal(resources.readTexture(name), frame[name], name);
        }
        assert(resources.readTexture('indexBuf').every(value => value === 0), 'index target initialization');
        assert(resources.readTexture('colourBuf').every(value => value === 0), 'colour target initialization');
        const unchangedCalls = actualUploads.length;
        resources.upload(snapshot); assert(resources.stats.lastUpload.chipRows === 0, 'unchanged snapshot uploads no chip rows');
        assert(actualUploads.length === unchangedCalls, 'no actual chip upload for unchanged bytes');
        second.upload(snapshot);
        const revision = memory.revision;
        memory.writeBytes(2047, Uint8Array.of(memory.bytes[2047] ^ 255, memory.bytes[2048] ^ 255));
        memory.writeWord(size - 2, memory.readWord(size - 2) ^ 65535);
        const updated = publish(), dirtyCalls = actualUploads.length; resources.upload(updated);
        assert(resources.stats.lastUpload.chipRows === 3, 'three changed rows');
        assert(JSON.stringify(resources.stats.lastUpload.ranges) === JSON.stringify(memory.dirtySince(revision).rows), 'upload ranges agree with CPU dirty tracking');
        assert(JSON.stringify(actualUploads.slice(dirtyCalls)) === JSON.stringify(memory.dirtySince(revision).rows), 'actual GL calls cover only dirty rows');
        second.upload(updated); assert(second.stats.lastUpload.chipRows === 3, 'independent consumer uploads all changed rows');
        equal(resources.readTexture('chip'), memory.bytes, 'dirty chip');
        equal(second.readTexture('chip'), memory.bytes, 'independent chip');
        frame.linePal[0] ^= 17; resources.upload(publish());
        assert(resources.stats.lastUpload.chipRows === 0 && resources.stats.lastUpload.tableBytes > 0, 'palette-only update');
        equal(resources.readTexture('linePal'), frame.linePal, 'palette update');
        checkedSizes.push(size);
      }
      // Exercise overflow padding and dimension changes independently of fast tables.
      const memory = new Memory(524288), frame = makeFrame({ width: 33, height: 2, depth: 1,
        pointers: [0], rowBytes: 6, palette: [0, 0xf00] });
      frame.maxEvents = 1; frame.lineEvents = new Uint32Array(8);
      frame.lineRegs[17] = 2049; frame.lineEvents.set([0, 0x180, 0, 0]);
      frame.overflowEvents = new Uint32Array(2049 * 4);
      for (let i = 0; i < 2049; i++) frame.overflowEvents.set([i, 0x180, i & 0xfff, 0], i * 4);
      frame.eventOffsets.set([0, 2049, 2049]);
      const snapshot = model.createSnapshot({ chip: memory.bytes, frame });
      resources.upload(snapshot);
      equal(resources.readTexture('overflowEvents'), frame.overflowEvents, 'overflow table');
      const oldTexture = resources.getTexture('chip').texture, oldIndex = resources.getTexture('indexBuf').texture;
      const lost = event('webglcontextlost'); extension.loseContext(); await lost;
      assert(resources.state === 'lost', 'lost state');
      assert(!gl.isTexture(oldTexture), 'old texture invalidated');
      memory.writeBytes(1, Uint8Array.of(71, 93));
      const latest = model.createSnapshot({ chip: memory.bytes, frame });
      assert(resources.upload(latest) === false, 'lost upload retains without drawing');
      latest.chip[1] = 0; latest.frame.linePal[0] = 99;
      const restored = event('webglcontextrestored'); extension.restoreContext(); await restored;
      assert(resources.state === 'ready', `restore state: ${resources.stats.error}`);
      assert(resources.stats.lastUpload.full && resources.stats.lastUpload.chipRows === 256, 'restore forces full upload');
      assert(resources.getTexture('chip').texture !== oldTexture && resources.getTexture('indexBuf').texture !== oldIndex, 'restore recreates textures');
      equal(resources.readTexture('chip'), memory.bytes, 'retained latest chip after restore');
      for (const name of ['lineRegs', 'linePal', 'lineSprites', 'lineEvents', 'eventOffsets', 'overflowEvents']) equal(resources.readTexture(name), frame[name], `restored ${name}`);
      const savedStats = resources.stats; savedStats.lastUpload.ranges[0][1] = 0;
      assert(resources.stats.lastUpload.ranges[0][1] === 256, 'statistics are owned copies');
      assert(resources.stats.losses === 1 && resources.stats.restores === 1 && resources.stats.generation === 2, 'lifecycle counters');
      assert(JSON.stringify(states) === JSON.stringify(['lost', 'ready']), 'lifecycle notifications');
      const empty = makeFrame({ width: 17, height: 0, depth: 1, pointers: [0], rowBytes: 4, palette: [0], interlaceField: 1, outputHeight: 1 });
      resources.upload(model.createSnapshot({ chip: memory.bytes, frame: empty }));
      for (const name of ['lineRegs', 'linePal', 'lineSprites', 'lineEvents']) equal(resources.readTexture(name), empty[name], `empty field ${name}`);
      assert(resources.readTexture('indexBuf').length === 0, 'empty field has no output samples');
      let unavailable = false;
      const occupied = document.createElement('canvas'); occupied.getContext('2d');
      try { createResources(occupied); } catch (error) { unavailable = /unavailable/.test(error.message); }
      assert(unavailable, 'unavailable context reports failure explicitly');
      for (const name of ['chip', 'lineRegs', 'linePal', 'lineSprites', 'lineEvents', 'eventOffsets', 'overflowEvents', 'indexBuf', 'colourBuf']) beforeDispose.push(resources.getTexture(name));
      const result = { checkedSizes, dirtyRows: 3, generation: resources.stats.generation, uploads: resources.stats.uploads };
      resources.dispose(); resources.dispose();
      assert(resources.state === 'disposed', 'disposed state');
      for (const record of beforeDispose) {
        assert(!gl.isTexture(record.texture), 'texture deleted on dispose');
        if (record.framebuffer) assert(!gl.isFramebuffer(record.framebuffer), 'framebuffer deleted on dispose');
      }
      assert(restoredPrograms.length === 2 && restoredVaos.length === 1, 'restoration recreated programs and VAO');
      for (const program of restoredPrograms) assert(!gl.isProgram(program), 'program deleted on dispose');
      for (const vao of restoredVaos) assert(!gl.isVertexArray(vao), 'VAO deleted on dispose');
      let rejected = false;
      try { resources.upload(snapshot); } catch (error) { rejected = /disposed/.test(error.message); }
      assert(rejected, 'disposed upload rejects');
      return result;
    } finally {
      resources.dispose(); second.dispose();
      if (!gl.isContextLost()) extension.loseContext();
      const loseSecond = second.context.getExtension('WEBGL_lose_context'); if (loseSecond) loseSecond.loseContext();
    }
  }, { resources: createResourceFactory.toString(), model: createFrameStateModel.toString(), frame: staticFrame.toString(), memory: ChipMemory.toString() });
};
