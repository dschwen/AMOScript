/* jshint esversion: 6 */
'use strict';

function createCopperBuilder(registerModel) {
  const { R, fetchBytes } = registerModel;
  return function build(screens, options = {}) {
    const fail = message => { throw new Error(`Copper builder: ${message}`); };
    if (options.standard && !['PAL', 'NTSC'].includes(options.standard)) fail('unsupported video standard');
    if (!Array.isArray(screens) || screens.length > 8 || (!screens.length && !options.backgroundPalette)) fail('expected 1–8 screens');
    const views = screens.slice().sort((a, b) => a.y - b.y);
    const initialRegisters = new Uint16Array(256), words = [], changesByLine = new Map();
    const dmaSetupRows = new Set(), spriteSafeSetupRows = [];
    if (options.backgroundPalette) {
      if (options.backgroundPalette.length > 32) fail('invalid background palette');
      for (let index = 0; index < 32; index++) {
        const colour = options.backgroundPalette[index] == null ? 0 : options.backgroundPalette[index];
        if (!Number.isInteger(colour) || colour < 0 || colour > 0xfff) fail('invalid background palette');
        initialRegisters[(R.COLOR00 + index * 2) / 2] = colour;
      }
    }
    const paletteRows = options.paletteRows || [], paletteByLine = new Map();
    if (!Array.isArray(paletteRows) || paletteRows.length > 624) fail('invalid palette row count');
    for (const row of paletteRows) {
      if (!Number.isInteger(row.y) || row.y < 0 || row.y >= (options.standard === 'NTSC' ? 262 : 312) ||
          !Number.isInteger(row.index) || row.index < 0 || row.index > 31 ||
          !Number.isInteger(row.rgb) || row.rgb < 0 || row.rgb > 0xfff) fail('invalid palette row');
      if (!paletteByLine.has(row.y)) paletteByLine.set(row.y, new Map());
      paletteByLine.get(row.y).set(R.COLOR00 + row.index * 2, row.rgb);
    }
    const blankRow = y => views.some((view, index) => index > 0 && y >= views[index - 1].y + views[index - 1].height && y < view.y);
    const captureStart = Math.min(64, Math.ceil((options.origin || { x: 128 }).x / 2));
    // Nonzero playfield-only colours cannot affect blank pixels or hardware
    // sprites (which use 16..31). Omit a gap write only when the following row
    // writes that register again; never lose the final restoration value.
    const redundant = [];
    for (const [y, palette] of paletteByLine) if (blankRow(y)) {
      const next = paletteByLine.get(y + 1);
      for (const reg of palette.keys()) if (reg > R.COLOR00 && reg < R.COLOR00 + 32 && next && next.has(reg)) redundant.push([y, reg]);
    }
    for (const [y, reg] of redundant) paletteByLine.get(y).delete(reg);
    let previous = null;
    const emit = (first, second) => { words.push(first, second); };
    const wait = y => emit(((y & 255) << 8) | 1, 0xfffe);
    for (const view of views) {
      const { width, height, depth, pointers, rowBytes, palette, x, y } = view;
      const hires = view.hires === true, sourceWidth = hires ? Math.ceil(width / 2) : width;
      const endX = x + sourceWidth, endY = y + height;
      const windowY = view.windowY == null ? y : view.windowY;
      const windowEnd = view.windowEnd == null ? endY : view.windowEnd;
      if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 0 || (height === 0 && view.setupOnly !== true) ||
          !Number.isInteger(depth) || depth < 1 || depth > (hires ? 4 : 6) ||
          x !== 128 || !Number.isInteger(y) || y < 0 || y >= (options.standard === 'NTSC' ? 262 : 312) ||
          !Number.isInteger(windowY) || windowY < 0 || windowY > 255 || windowY > y || endX < 256 || endX > 511 ||
          !Number.isInteger(windowEnd) || windowEnd < 128 || windowEnd < endY ||
          windowEnd > (options.standard === 'NTSC' ? 262 : 312) ||
          !Number.isInteger(rowBytes) || rowBytes % 2 || rowBytes < Math.ceil(width / 16) * 2 ||
          !pointers || pointers.length !== depth || !palette || palette.length > 32) fail('unsupported OCS screen geometry/depth');
      if (previous && y < previous.endY) fail('overlapping screen windows are not implemented');
      const setup = new Map();
      if (view.ham && (![5, 6].includes(depth) || hires || view.dualPlayfield)) fail('invalid HAM mode');
      const scroll = view.scroll == null ? 0 : view.scroll;
      if (!Number.isInteger(scroll) || scroll < 0 || scroll > 255) fail('invalid scroll');
      const control = (depth << 12) | (hires ? 0x8000 : 0) | (view.dualPlayfield ? 0x400 : 0) | (view.ham ? 0x800 : 0);
      const fetchWords = hires ? Math.ceil(width / 32) * 2 : Math.ceil(width / 16);
      const advance = view.fetchAdvance == null ? 8 : view.fetchAdvance;
      if (![4, 8].includes(advance) || (!hires && advance !== 8)) fail('invalid fetch advance');
      const normalStart = hires ? 0x3c : 0x38, ddfStart = normalStart - (scroll ? advance : 0);
      const ddfStop = normalStart + (fetchWords - (hires ? 2 : 1)) * (hires ? 4 : 8);
      let fetchedBytes;
      try { fetchedBytes = fetchBytes(control, ddfStart, ddfStop); } catch (error) { fail(error.message); }
      const mod = rowBytes - fetchedBytes;
      if (mod < -32768 || mod > 32766) fail('modulo out of range');
      setup.set(R.DIWSTRT, (windowY << 8) | x);
      setup.set(R.DIWSTOP, ((windowEnd & 255) << 8) | (endX & 255));
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
      if (!previous) {
        for (const [reg, value] of setup) initialRegisters[reg / 2] = value;
        // A late first window must not fetch from its 8-bit DIW start.
        // Enable DMA at the actual slice start, before the first fetch.
        if ((y > 255 || view.dmaWindow) && !view.setupOnly) changesByLine.set(y, new Map([[R.DMACON, 0x8300]]));
      } else {
        const rowPalette = paletteByLine.get(y) || new Map();
        const changes = Array.from(setup).filter(([reg, value]) => !rowPalette.has(reg) &&
          ((reg >= R.BPL1PTH && reg < R.BPL1PTH + 32) || previous.setup.get(reg) !== value));
        // Reprogram in the left blanking interval. Never pretend an oversized
        // palette/pointer update fit before DMA or blank-row snapshot capture.
        const combined = new Set([...changes.map(([reg]) => reg), ...rowPalette.keys()]).size;
        if (view.blankSetup) {
          const line = y - 1;
          const pending = changesByLine.get(line);
          if (line < previous.endY || (pending && [...pending].some(([reg, value]) => reg !== R.DMACON || value !== 0x100))) fail('unsafe priority setup row');
          // Native EcCopHo starts the palette with COLOR00 after DMA off.
          // It colours the blank row too, so write it before capture alongside
          // sprite colours. Later playfield-only writes remain invisible.
          const spriteColour = reg => reg >= R.COLOR00 + 32 && reg <= R.COLOR00 + 62;
          const early = changes.filter(([reg]) => reg === R.COLOR00 || spriteColour(reg));
          const late = changes.filter(([reg]) => reg !== R.COLOR00 && !spriteColour(reg));
          if (2 + (1 + early.length) * 4 < captureStart &&
              !Array.from(paletteByLine.get(line) || []).some(([reg]) => spriteColour(reg))) spriteSafeSetupRows.push(line);
          changesByLine.set(line, new Map([[R.DMACON, 0x100], ...early, ...late]));
          if (!view.setupOnly) changesByLine.set(y, new Map([[R.DMACON, 0x8300]]));
          dmaSetupRows.add(line);
        } else if (2 + combined * 4 >= ddfStart) {
          // Spread setup over actual blank rows, always before fetch/capture.
          // DIWSTRT/STOP come first, keeping DMA inactive until the new window.
          const slots = []; let capacity = 0, start = y + 1;
          while (capacity < changes.length) {
            start--;
            const deadline = start < y ? captureStart : ddfStart;
            const perLine = Math.floor((deadline - 3) / 4);
            const available = perLine - (paletteByLine.get(start) || new Map()).size;
            if (perLine < 1 || available < 0 || start < previous.endY) fail('screen setup exceeds pre-fetch copper budget');
            slots.unshift(available); capacity += available;
          }
          let index = 0;
          for (let line = 0; line < slots.length; line++) {
            changesByLine.set(start + line, new Map(changes.slice(index, index + slots[line]))); index += slots[line];
          }
        } else changesByLine.set(y, new Map(changes));
      }
      if (previous && previous.dmaWindow && !view.blankSetup && !view.setupOnly) {
        if (!changesByLine.has(y)) changesByLine.set(y, new Map());
        changesByLine.get(y).set(R.DMACON, 0x8300);
      }
      if (view.dmaWindow) {
        if (!changesByLine.has(endY)) changesByLine.set(endY, new Map());
        changesByLine.get(endY).set(R.DMACON, 0x100);
      }
      previous = { setup, endY, ddfStart, dmaWindow: view.dmaWindow };
    }
    for (const [y, palette] of paletteByLine) {
      if (!changesByLine.has(y)) changesByLine.set(y, new Map());
      for (const [reg, rgb] of palette) changesByLine.get(y).set(reg, rgb);
    }
    let wrapped = false;
    for (const [y, changes] of Array.from(changesByLine).sort((a, b) => a[0] - b[0])) {
      const view = views.slice().reverse().find(view => view.y <= y) || views[0];
      const fetchStart = !view ? 0x38 : (view.hires ? 0x3c : 0x38) - (view.scroll ? (view.fetchAdvance == null ? 8 : view.fetchAdvance) : 0);
      // DMA-disabled setup may use a whole blank row. All other writes retain
      // the existing capture/fetch deadline, including re-enabling next row.
      const deadline = dmaSetupRows.has(y) ? 227 : blankRow(y) ? captureStart : fetchStart;
      if (2 + changes.size * 4 >= deadline) fail('screen/palette setup exceeds pre-fetch copper budget');
      if (y >= 256 && !wrapped) { emit(0xffdf, 0xfffe); wrapped = true; }
      wait(y);
      for (const [reg, value] of changes) emit(reg, value);
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
    initialRegisters[R.DMACON / 2] = (spritePointers == null ? 0x380 : 0x3a0) & (views.length && (views[0].y > 255 || views[0].dmaWindow || views[0].setupOnly) ? ~0x100 : 0xffff);
    emit(0xffff, 0xfffe);
    const bytes = new Uint8Array(words.length * 2), output = new DataView(bytes.buffer);
    words.forEach((word, index) => output.setUint16(index * 2, word, false));
    return { bytes, initialRegisters, spriteSafeSetupRows,
      interpretOptions: { standard: options.standard || 'PAL', origin: options.origin || { x: 128, y: 50 },
        outputWidth: options.outputWidth == null ? 640 : options.outputWidth,
        lines: options.lines == null ? 200 : options.lines,
        videoRate: options.videoRate, pixelAspect: options.pixelAspect, maxSpriteWords: options.maxSpriteWords } };
  };
}

module.exports = createCopperBuilder(require('../model/registers'));
module.exports.createCopperBuilder = createCopperBuilder;
