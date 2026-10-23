/* jshint esversion: 6 */
'use strict';

function createCopperBuilder(registerModel) {
  const { R, fetchBytes } = registerModel;
  return function build(screens, options = {}) {
    const fail = message => { throw new Error(`Copper builder: ${message}`); };
    if (options.standard && !['PAL', 'NTSC'].includes(options.standard)) fail('unsupported video standard');
    if (!Array.isArray(screens) || !screens.length || screens.length > 8) fail('expected 1–8 screens');
    const views = screens.slice().sort((a, b) => a.y - b.y);
    const initialRegisters = new Uint16Array(256), words = [];
    let previous = null;
    const emit = (first, second) => { words.push(first, second); };
    const wait = y => emit(((y & 255) << 8) | 1, 0xfffe);
    for (const view of views) {
      const { width, height, depth, pointers, rowBytes, palette, x, y } = view;
      const hires = view.hires === true, sourceWidth = hires ? Math.ceil(width / 2) : width;
      const endX = x + sourceWidth, endY = y + height;
      if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1 ||
          !Number.isInteger(depth) || depth < 1 || depth > (hires ? 4 : 6) ||
          x !== 128 || !Number.isInteger(y) || y < 0 || y > 255 || endX < 256 || endX > 511 ||
          endY < 128 || endY > (options.standard === 'NTSC' ? 262 : 312) ||
          !Number.isInteger(rowBytes) || rowBytes % 2 || rowBytes < Math.ceil(width / 16) * 2 ||
          !pointers || pointers.length !== depth || !palette || palette.length > 32) fail('unsupported OCS screen geometry/depth');
      if (previous && y < previous.endY) fail('overlapping screen windows are not implemented');
      const setup = new Map();
      if (view.ham && (![5, 6].includes(depth) || hires || view.dualPlayfield)) fail('invalid HAM mode');
      const scroll = view.scroll == null ? 0 : view.scroll;
      if (!Number.isInteger(scroll) || scroll < 0 || scroll > 255) fail('invalid scroll');
      const control = (depth << 12) | (hires ? 0x8000 : 0) | (view.dualPlayfield ? 0x400 : 0) | (view.ham ? 0x800 : 0);
      const fetchWords = hires ? Math.ceil(width / 32) * 2 : Math.ceil(width / 16);
      const normalStart = hires ? 0x3c : 0x38, ddfStart = normalStart - (scroll ? 8 : 0);
      const ddfStop = normalStart + (fetchWords - (hires ? 2 : 1)) * (hires ? 4 : 8);
      let fetchedBytes;
      try { fetchedBytes = fetchBytes(control, ddfStart, ddfStop); } catch (error) { fail(error.message); }
      const mod = rowBytes - fetchedBytes;
      if (mod < -32768 || mod > 32766) fail('modulo out of range');
      setup.set(R.DIWSTRT, (y << 8) | x);
      setup.set(R.DIWSTOP, ((endY & 255) << 8) | (endX & 255));
      setup.set(R.DDFSTRT, ddfStart); setup.set(R.DDFSTOP, ddfStop);
      const priority = view.bplcon2 == null ? (view.pf2Priority ? 0x40 : 0) : view.bplcon2;
      if (!Number.isInteger(priority) || priority < 0 || priority > 127) fail('invalid playfield/sprite priority');
      setup.set(R.BPLCON0, control); setup.set(R.BPLCON1, scroll); setup.set(R.BPLCON2, priority);
      setup.set(R.BPL1MOD, mod & 65535); setup.set(R.BPL2MOD, mod & 65535);
      for (let plane = 0; plane < depth; plane++) {
        const pointer = pointers[plane];
        if (!Number.isSafeInteger(pointer) || pointer < 0 || pointer > 0xffffffff || pointer % 2) fail('invalid plane pointer');
        setup.set(R.BPL1PTH + plane * 4, pointer >>> 16);
        setup.set(R.BPL1PTH + plane * 4 + 2, pointer & 65535);
      }
      for (let index = 0; index < 32; index++) {
        const colour = palette[index] == null ? 0 : palette[index];
        if (!Number.isInteger(colour) || colour < 0 || colour > 0xfff) fail('invalid palette');
        setup.set(R.COLOR00 + index * 2, colour);
      }
      if (!previous) for (const [reg, value] of setup) initialRegisters[reg / 2] = value;
      else {
        const changes = Array.from(setup).filter(([reg, value]) =>
          (reg >= R.BPL1PTH && reg < R.BPL1PTH + 32) || previous.setup.get(reg) !== value);
        // Reprogram in the left blanking interval. Never pretend an oversized
        // palette/pointer update fit before DMA; wider scheduling is a later gate.
        if (2 + changes.length * 4 >= ddfStart) fail('screen setup exceeds pre-fetch copper budget');
        wait(y);
        for (const [reg, value] of changes) emit(reg, value);
      }
      previous = { setup, endY };
    }
    const spritePointers = options.spritePointers;
    if (spritePointers != null) {
      if ((!Array.isArray(spritePointers) && !ArrayBuffer.isView(spritePointers)) || spritePointers.length !== 8) fail('eight sprite pointers are required');
      for (let channel = 0; channel < 8; channel++) {
        const address = spritePointers[channel];
        if (!Number.isSafeInteger(address) || address < 0 || address > 0xfffffffe || address % 2) fail('invalid sprite pointer');
        initialRegisters[(R.SPR0PTH + channel * 4) / 2] = address >>> 16;
        initialRegisters[(R.SPR0PTH + channel * 4 + 2) / 2] = address & 65535;
      }
    }
    initialRegisters[R.DMACON / 2] = spritePointers == null ? 0x380 : 0x3a0;
    emit(0xffff, 0xfffe);
    const bytes = new Uint8Array(words.length * 2), output = new DataView(bytes.buffer);
    words.forEach((word, index) => output.setUint16(index * 2, word, false));
    return { bytes, initialRegisters,
      interpretOptions: { standard: options.standard || 'PAL', origin: options.origin || { x: 128, y: 50 },
        outputWidth: options.outputWidth == null ? 640 : options.outputWidth,
        lines: options.lines == null ? 200 : options.lines,
        videoRate: options.videoRate, pixelAspect: options.pixelAspect, maxSpriteWords: options.maxSpriteWords } };
  };
}

module.exports = createCopperBuilder(require('../model/registers'));
module.exports.createCopperBuilder = createCopperBuilder;
