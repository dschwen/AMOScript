/* jshint esversion: 6 */
'use strict';

function createReferenceRenderer(snapshotModel, colorModel, spriteModel) {
  function fail(message, line, x = null) {
    throw new Error(`Display reference: ${message} on line ${line}${x == null ? '' : `, x ${x}`}`);
  }
  function prepare(chip, frame) {
    snapshotModel.validateSnapshot({ chip, frame });
    if (frame.chipset === 'AGA') throw new Error('Display reference: AGA modes are not implemented');
    for (let line = 0; line < frame.lines; line++) {
      const row = line * 32, control = frame.lineRegs[row + 8];
      const planes = (control >> 12) & 7;
      if (planes > (control & 0x8000 ? 4 : 6) || (control & ~0xfe04) ||
          ((control & 0x800) && (![5, 6].includes(planes) || (control & 0x8400)))) fail('unsupported bitplane mode', line);
      if (frame.lineRegs[row + 9] > 255 || frame.lineRegs[row + 10] > 127 || frame.lineRegs[row + 11] ||
          frame.lineRegs[row + 12] || Math.abs(frame.lineRegs[row + 15] | 0) > 65535) fail('extended registers are not implemented', line);
      if (frame.lineRegs[row + 17]) fail('mid-line events are not implemented', line);
      if ((frame.lineRegs[row + 14] | 0) < (frame.lineRegs[row + 13] | 0)) fail('invalid horizontal window', line);
      spriteModel.validate(frame, line);
      for (let index = 0; index < 32; index++) {
        const offset = line * 1024 + index * 4;
        if (frame.linePal[offset] % 17 || frame.linePal[offset + 1] % 17 ||
            frame.linePal[offset + 2] % 17 || frame.linePal[offset + 3] !== 255) fail('invalid OCS/ECS palette', line);
      }
    }
  }
  function decode(chip, frame, x, line, trace = null) {
    const row = line * 32, control = frame.lineRegs[row + 8];
    const samples = frame.samplesPerLowresPixel / (control & 0x8000 ? 2 : 1);
    const start = frame.lineRegs[row + 13] | 0, stop = frame.lineRegs[row + 14] | 0;
    const active = (frame.lineRegs[row + 16] & 3) === 3 && x >= start && x < stop;
    const sourceX = Math.floor((x - start) / samples);
    let index = 0;
    if (active) for (let plane = 0; plane < ((control >> 12) & 7); plane++) {
      // OCS/ECS scroll nibbles are lowres units, including on hires lines.
      const delay = ((frame.lineRegs[row + 9] >> (plane % 2 ? 4 : 0)) & 15) * (control & 0x8000 ? 2 : 1);
      const bitX = sourceX + (frame.lineRegs[row + 15] | 0) - delay;
      const pointer = frame.lineRegs[row + plane], address = bitX < 0 ? null : pointer + Math.floor(bitX / 8);
      if (address != null && address >= chip.length) fail(`bitplane ${plane + 1} fetch out of bounds`, line, x);
      const bitPosition = bitX < 0 ? null : 7 - (bitX % 8), bit = bitX < 0 ? 0 : (chip[address] >> bitPosition) & 1;
      index |= bit << plane;
      if (trace) trace.push({ plane: plane + 1, pointer, byteAddress: address, byte: address == null ? 0 : chip[address], bitPosition, bit,
        ...(bitX !== sourceX ? { sourceBit: bitX } : {}) });
    }
    return { index, active, sourceX, samples };
  }
  function paletteWord(frame, line, index) {
    const at = line * 1024 + index * 4;
    return ((frame.linePal[at] >> 4) << 8) | ((frame.linePal[at + 1] >> 4) << 4) | (frame.linePal[at + 2] >> 4);
  }
  function hamLine(chip, frame, line, lastX, visit) {
    const row = line * 32, start = frame.lineRegs[row + 13] | 0, stop = frame.lineRegs[row + 14] | 0;
    if ((frame.lineRegs[row + 16] & 3) !== 3 || lastX < start || stop <= Math.max(0, start)) return;
    const samples = frame.samplesPerLowresPixel;
    const lastPixel = Math.floor((Math.min(lastX, stop - 1) - start) / samples);
    // Bitmap widths are bounded to 2048. A cropped prefix may extend that span,
    // but malformed signed windows must not cause billions of hidden decodes.
    if (lastPixel >= 4096) fail('HAM source span exceeds supported limit', line, lastX);
    let previous = paletteWord(frame, line, 0);
    for (let pixel = 0; pixel <= lastPixel; pixel++) {
      const nativeX = start + pixel * samples, decoded = decode(chip, frame, nativeX, line);
      const before = previous;
      previous = colorModel.hamWord(decoded.index, previous, paletteWord(frame, line, decoded.index & 15));
      visit(nativeX, decoded, previous, before);
    }
  }
  function resolve(frame, line, decoded) {
    const control = frame.lineRegs[line * 32 + 8];
    let index = decoded.index, playfields = null, halfbrite = false, mode = 'normal';
    if (control & 0x400) {
      let pf1 = 0, pf2 = 0;
      for (let bit = 0; bit < 3; bit++) {
        pf1 |= ((index >> (bit * 2)) & 1) << bit;
        pf2 |= ((index >> (bit * 2 + 1)) & 1) << bit;
      }
      const front2 = !!(frame.lineRegs[line * 32 + 10] & 0x40);
      const selected = pf2 && (front2 || !pf1) ? 2 : pf1 ? 1 : 0;
      index = selected === 2 ? pf2 + 8 : selected === 1 ? pf1 : 0;
      playfields = { pf1, pf2, selected }; mode = 'dual-playfield';
    } else if (!(control & 0x800) && ((control >> 12) & 7) === 6) {
      halfbrite = !!(index & 32); index &= 31; mode = 'EHB';
    }
    const word = paletteWord(frame, line, index);
    const rgba = colorModel.rgbaWord(halfbrite ? colorModel.halfbriteWord(word) : word);
    return { index, rgba, mode, halfbrite, playfields };
  }
  function render(chip, frame) {
    prepare(chip, frame);
    const out = new Uint8ClampedArray(frame.outputWidth * frame.lines * 4);
    for (let line = 0; line < frame.lines; line++) {
      if (frame.lineRegs[line * 32 + 8] & 0x800) {
        const border = colorModel.rgbaWord(paletteWord(frame, line, 0));
        for (let x = 0; x < frame.outputWidth; x++) out.set(border, (line * frame.outputWidth + x) * 4);
        hamLine(chip, frame, line, frame.outputWidth - 1, (nativeX, decoded, word) => {
          const rgba = colorModel.rgbaWord(word), stop = frame.lineRegs[line * 32 + 14] | 0;
          for (let x = Math.max(0, nativeX); x < Math.min(frame.outputWidth, stop, nativeX + decoded.samples); x++) {
            out.set(rgba, (line * frame.outputWidth + x) * 4);
          }
        });
      } else for (let x = 0; x < frame.outputWidth; x++) {
        const resolved = resolve(frame, line, decode(chip, frame, x, line));
        out.set(resolved.rgba, (line * frame.outputWidth + x) * 4);
      }
      let spritesActive = false;
      for (let channel = 0; channel < 8; channel++) spritesActive = spritesActive || !!(frame.lineSprites[line * 32 + channel * 4 + 3] & 0x80000000);
      if (spritesActive) for (let x = 0; x < frame.outputWidth; x++) {
        const sprite = spriteModel.sample(frame, line, x, decode(chip, frame, x, line).index);
        if (sprite && sprite.visible) out.set(colorModel.rgbaWord(paletteWord(frame, line, sprite.paletteIndex)), (line * frame.outputWidth + x) * 4);
      }
    }
    return out;
  }
  function explainPixel(chip, frame, x, line) {
    prepare(chip, frame);
    if (!Number.isInteger(x) || !Number.isInteger(line) || x < 0 || x >= frame.outputWidth || line < 0 || line >= frame.lines) {
      throw new Error('Display reference: pixel out of bounds');
    }
    const planes = [], decoded = decode(chip, frame, x, line, planes);
    let resolved, ham = null;
    if (frame.lineRegs[line * 32 + 8] & 0x800) {
      resolved = { mode: 'HAM6', halfbrite: false, index: 0, rgba: colorModel.rgbaWord(paletteWord(frame, line, 0)) };
      if (decoded.active) hamLine(chip, frame, line, x, (nativeX, current, word, before) => {
        if (current.sourceX !== decoded.sourceX) return;
        const operation = (current.index >> 4) & 3;
        resolved.index = operation === 0 ? current.index & 15 : null;
        resolved.rgba = colorModel.rgbaWord(word);
        ham = { operation: ['palette', 'blue', 'red', 'green'][operation], value: current.index & 15,
          previous: colorModel.rgbaWord(before), sourcePixelsProcessed: current.sourceX + 1 };
      });
    } else resolved = resolve(frame, line, decoded);
    const sprite = spriteModel.sample(frame, line, x, decoded.index);
    const rgba = sprite && sprite.visible ? colorModel.rgbaWord(paletteWord(frame, line, sprite.paletteIndex)) : resolved.rgba;
    return { line, outputX: x, playfieldX: decoded.sourceX, samplesPerPixel: decoded.samples,
      active: decoded.active, planes, rawIndex: decoded.index, mode: resolved.mode, halfbrite: resolved.halfbrite,
      ...(resolved.playfields ? { playfields: resolved.playfields } : {}),
      ...(ham ? { ham } : {}),
      palette: { source: ham && ham.operation !== 'palette' ? 'hold-modify' : 'line', index: resolved.index, rgba: resolved.rgba }, sprite,
      final: `#${rgba.slice(0, 3).map(value => value.toString(16).padStart(2, '0')).join('')}` };
  }
  return { render, explainPixel };
}

module.exports = createReferenceRenderer(require('../model/frameState'), require('../model/color'), require('./sprites'));
module.exports.createReferenceRenderer = createReferenceRenderer;
