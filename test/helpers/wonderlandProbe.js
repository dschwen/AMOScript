/* jshint esversion: 6 */
'use strict';

module.exports = async function wonderlandProbe(page) {
  const fs = require('fs'), path = require('path');
  const { auditProgram } = require('../../tools/audit_program');
  const directory = path.join(__dirname, '../../examples/Wonderland');
  const goldenDirectory = path.join(__dirname, '../fixtures/wonderland');
  const report = auditProgram(fs.readFileSync(path.join(directory, 'Wonderland.AMOS')));
  const startup = new (require('../../lib/Transpiler'))(require('./wonderlandStartup')()).toModule();
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
  return page.evaluate(async ({ source, assets, readiness, startup }) => {
    const module = { exports: {} }; new Function('module', startup)(module);
    const runs = [false, true].map(slow => {
      let time = 0; const commands = [];
      const program = module.exports({ now: () => time, setTimeout: () => 1, clearTimeout() {},
        system: { command: name => { commands.push(name); } } });
      if (slow) { program.tick(10); time = 600; }
      program.tick(100000);
      return { speedFlag: program.state.variables.int_a3000, halted: program.state.halted,
        variableBufferBytes: program.compilation.variableBufferBytes, commands };
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
    return { milestone: 'startup benchmark and original asset preview', gameRunning: false, startup: { physicalLines: 9, runs },
      evidence: 'Original assets / independent PNG decoding; no Amiga execution capture.', images, ...readiness };
  }, { source, assets, startup, readiness: { compiler: report.compiler, physicalLines: report.physicalLines,
    unrecognizedEncodings: report.unrecognizedEncodings,
    missing: report.missing.map(token => ({ code: token.code, name: token.name, count: token.count, firstLine: token.locations[0].line })),
    banks: report.banks } });
};
