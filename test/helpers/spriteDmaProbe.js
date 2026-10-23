/* jshint esversion: 6 */
'use strict';

// Exercise the same dependency-free factories embedded in generated modules,
// using independently written OCS register/descriptor words in real Chromium.
module.exports = async function spriteDmaProbe(page) {
  const { createRegisterModel } = require('../../lib/display/model/registers');
  const { createFrameStateModel } = require('../../lib/display/model/frameState');
  const { createSpriteDmaFactory } = require('../../lib/display/copper/spriteDma');
  const { createCopperInterpreter } = require('../../lib/display/copper/interpreter');
  const { createColorModel } = require('../../lib/display/model/color');
  const { createSpriteModel } = require('../../lib/display/reference/sprites');
  const { createReferenceRenderer } = require('../../lib/display/reference/render');
  const source = `
    const registers = (${createRegisterModel.toString()})();
    const model = (${createFrameStateModel.toString()})();
    const dma = (${createSpriteDmaFactory.toString()})(registers);
    const interpret = (${createCopperInterpreter.toString()})(model, registers, dma);
    const colours = (${createColorModel.toString()})();
    const sprites = (${createSpriteModel.toString()})();
    const reference = (${createReferenceRenderer.toString()})(model, colours, sprites);
    return { interpret, reference };
  `;
  return page.evaluate(source => {
    const { interpret, reference } = new Function(source)();
    const chip = new Uint8Array(524288), registers = new Uint16Array(256), view = new DataView(chip.buffer);
    const write = (address, words) => words.forEach((word, i) => view.setUint16(address + i * 2, word, false));
    registers[0x96 / 2] = 0x3a0; registers[0x8e / 2] = 0x0080; registers[0x90 / 2] = 0x8000;
    registers[0x104 / 2] = 0x24;
    registers[0x1a2 / 2] = 0xf00; registers[0x1a4 / 2] = 0x0f0;
    for (let n = 0; n < 8; n++) registers[(0x122 + n * 4) / 2] = n ? 0x2000 : 0x3000;
    write(0, [0xffff, 0xfffe]);
    write(0x3000, [0x1e41, 0x2000, 0x8000, 0, 0x4000, 0,
      0x224b, 0x2301, 0, 0x8000, 0, 0]);
    const { snapshot, diagnostics } = interpret(chip, { address: 0, initialRegisters: registers,
      origin: { x: 128, y: 28 }, outputWidth: 640, lines: 10 });
    const rgba = reference.render(snapshot.chip, snapshot.frame);
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 10;
    const context = canvas.getContext('2d'); context.putImageData(new ImageData(rgba, 640, 10), 0, 0);
    const positions = [[4, 2], [6, 3], [4, 4], [46, 6], [46, 7]];
    const pixels = positions.map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data));
    // Fetch status must not suppress a row that has already been armed.
    snapshot.frame.lineRegs[2 * 32 + 16] &= ~4;
    const held = Array.from(reference.render(snapshot.chip, snapshot.frame).slice((2 * 640 + 4) * 4, (2 * 640 + 4) * 4 + 4));
    return { pixels, held, words: diagnostics.spriteWords, pointer: diagnostics.registers[0x122 / 2], png: canvas.toDataURL('image/png') };
  }, source);
};
