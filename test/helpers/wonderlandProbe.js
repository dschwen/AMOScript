/* jshint esversion: 6 */
'use strict';

module.exports = async function wonderlandProbe(page) {
  const fs = require('fs'), path = require('path');
  const { auditProgram } = require('../../tools/audit_program');
  const directory = path.join(__dirname, '../../examples/Wonderland');
  const goldenDirectory = path.join(__dirname, '../fixtures/wonderland');
  const report = auditProgram(fs.readFileSync(path.join(directory, 'Wonderland.AMOS')));
  const startup = new (require('../../lib/Transpiler'))(require('./wonderlandStartup')(64, true)).toModule();
  const sampleBank = fs.readFileSync(path.join(directory, 'Wonderland_Samples.Abk')).toString('base64');
  const { createFrameStateModel } = require('../../lib/display/model/frameState');
  const { createIlbmReader } = require('../../lib/display/model/ilbm');
  const { createColorModel } = require('../../lib/display/model/color');
  const { createSpriteModel } = require('../../lib/display/reference/sprites');
  const { createReferenceRenderer } = require('../../lib/display/reference/render');
  const source = `
    const ChipMemory = (${require('../../lib/display/model/ChipMemory').toString()});
    const model = (${createFrameStateModel.toString()})();
    const read = (${createIlbmReader.toString()})(ChipMemory, model, (${require('../../lib/display/model/staticFrame').toString()}));
    const reference = (${createReferenceRenderer.toString()})(model, (${createColorModel.toString()})(), (${createSpriteModel.toString()})());
    return { read, reference };
  `;
  const assets = JSON.parse(fs.readFileSync(path.join(goldenDirectory, 'manifest.json'))).images.map(entry => ({
    name: entry.source, width: entry.width, height: entry.height,
    bytes: fs.readFileSync(path.join(directory, entry.source)).toString('base64'),
    png: fs.readFileSync(path.join(goldenDirectory, entry.file)).toString('base64')
  }));
  const titlePng = fs.readFileSync(path.join(goldenDirectory, 'title-setup.png')).toString('base64');
  return page.evaluate(async ({ source, assets, readiness, startup, sampleBank, titlePng }) => {
    const module = { exports: {} }; new Function('module', startup)(module);
    const goldenImage = new Image(); goldenImage.src = `data:image/png;base64,${titlePng}`; await goldenImage.decode();
    const goldenCanvas = document.createElement('canvas'); goldenCanvas.width = 640; goldenCanvas.height = 256;
    goldenCanvas.getContext('2d').drawImage(goldenImage, 0, 0);
    const titleGolden = goldenCanvas.getContext('2d').getImageData(0, 0, 640, 256).data;
    const runs = [false, true].map(slow => {
      let time = 0, sequence = 0; const commands = [], reads = [], tasks = new Map();
      const program = module.exports({ now: () => time,
        setTimeout(fn, ms) { const id = ++sequence; tasks.set(id, { fn, due: time + ms }); return id; }, clearTimeout(id) { tasks.delete(id); },
        files: { read(name) {
          reads.push(name);
          if (name === 'AMOSPro_Productivity2:Wonderland/Wonderland_Samples.Abk') return atob(sampleBank);
          if (name === 'AMOSPro_Productivity2:Wonderland/Title_Screen.Iff') return atob(assets[0].bytes);
          throw new Error('Unexpected original asset path');
        } },
        system: { command: name => { commands.push(name); } } });
      if (slow) { program.tick(10); time = 600; }
      program.tick(100000);
      if (program.state.waiting !== 'sleep') throw new Error('Original title setup did not wait for VBL');
      time += 20;
      for (const [id, task] of Array.from(tasks)) if (task.due <= time) { tasks.delete(id); task.fn(); }
      const native = program.display.renderDisplay(), canvas = document.createElement('canvas');
      const host = AMOS_BROWSER.createCanvasHost(canvas); host.attach(program); host.render(); host.detach();
      const rgba = canvas.getContext('2d').getImageData(0, 0, 320, 256).data;
      if (!native.every((value, i) => value === titleGolden[i]) || !rgba.every((value, i) => {
        const pixel = Math.floor(i / 4), y = Math.floor(pixel / 320), x = pixel % 320;
        return value === titleGolden[(y * 640 + x * 2) * 4 + i % 4];
      })) throw new Error('Original title/Bob composition differs from independent expectation');
      if (globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: `Original title and menu marker (${slow ? 'slow' : 'fast'} startup)`, width: 640, height: 256, rgba: native });
      if (globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: `Original title and menu marker (Canvas, ${slow ? 'slow' : 'fast'} startup)`, width: 320, height: 256, rgba });
      return { speedFlag: program.state.variables.int_a3000, halted: program.state.halted,
        titleExact: true, waitedVbl: true, timersRemaining: tasks.size,
        variableBufferBytes: program.compilation.variableBufferBytes, commands, reads,
        audio: { ...program.state.audio }, sampleCount: program.banks.get(5).data[1], keySpeed: { ...program.state.input.keySpeed },
        levelSeeds: [1,2,3,4,5].map(i => program.arrayGet(program.state.variables.array_int_rbowseed, [i])),
        imageCount: program.banks.get(1).images.length,
        firstMasks: program.banks.get(1).images.slice(0, 8).map(image => image.masked),
        finalMask: program.banks.get(1).images[74].masked };
    });
    const { read, reference } = new Function(source)(), images = [];
    for (const asset of assets) {
      const decoded = read(Uint8Array.from(atob(asset.bytes), character => character.charCodeAt(0)));
      const rgba = reference.render(decoded.snapshot.chip, decoded.snapshot.frame);
      const image = new Image(); image.src = `data:image/png;base64,${asset.png}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      canvas.getContext('2d').drawImage(image, 0, 0);
      const expected = canvas.getContext('2d').getImageData(0, 0, image.width, image.height).data;
      if (image.width !== decoded.snapshot.frame.outputWidth || image.height !== decoded.snapshot.frame.lines ||
          rgba.length !== expected.length || !rgba.every((value, index) => value === expected[index])) {
        throw new Error(`Wonderland original asset differs from independent PNG: ${asset.name}`);
      }
      if (globalThis.AMOS_DEMO_OBSERVE) globalThis.AMOS_DEMO_OBSERVE({ name: asset.name, width: image.width, height: image.height, rgba });
      images.push({ name: asset.name, width: image.width, height: image.height, exact: true });
    }
    return { milestone: 'original title setup and asset preview', gameRunning: false, startup: { physicalLines: 64, runs },
      evidence: 'Original assets / independent PNG decoding; no Amiga execution capture.', images, ...readiness };
  }, { source, assets, startup, sampleBank, titlePng, readiness: { compiler: report.compiler, physicalLines: report.physicalLines,
    unrecognizedEncodings: report.unrecognizedEncodings,
    missing: report.missing.map(token => ({ code: token.code, name: token.name, count: token.count, firstLine: token.locations[0].line })),
    banks: report.banks } });
};
