/* jshint esversion: 6 */
'use strict';

// Full-bitmap migration/fixture/IFF path. Physical display scheduling uses the
// shared copper builder/interpreter, rather than adding hardware rules here.
function staticFrame(options) {
  const { width, height, depth, pointers, rowBytes, palette } = options;
  const field = options.interlaceField == null ? null : options.interlaceField;
  const outputHeight = options.outputHeight == null ? height * (field == null ? 1 : 2) : options.outputHeight;
  if (![null, 0, 1].includes(field) || !Number.isInteger(width) || width < 1 || width > 2048 ||
      !Number.isInteger(height) || height < 0 || (height === 0 && !(field === 1 && outputHeight === 1)) || height > 2048 ||
      !Number.isInteger(depth) || depth < 1 || depth > 6 || !Number.isInteger(rowBytes) || rowBytes % 2 ||
      rowBytes < Math.ceil(width / 16) * 2 || !pointers || pointers.length !== depth ||
      !palette || palette.length > 32) throw new Error('Invalid static planar screen');
  for (const pointer of pointers) if (!Number.isSafeInteger(pointer) || pointer < 0 || pointer % 2 || pointer > 0xffffffff) throw new Error('Invalid static plane pointer');
  for (const colour of palette) if (!Number.isInteger(colour) || colour < 0 || colour > 0xfff) throw new Error('Invalid static palette');
  const hires = options.hires === true, samples = hires ? 1 : 2;
  if (options.ham && (![5, 6].includes(depth) || hires || options.dualPlayfield)) throw new Error('Invalid static HAM mode');
  const scroll = options.scroll == null ? 0 : options.scroll, fetchOffset = options.fetchOffset == null ? 0 : options.fetchOffset;
  if ((hires && depth > 4) || !Number.isInteger(scroll) || scroll < 0 || scroll > 255 ||
      !Number.isInteger(fetchOffset) || Math.abs(fetchOffset) > 65535) throw new Error('Invalid static screen mode/scroll');
  const frame = {
    schemaVersion: 1, revision: options.revision == null ? 0 : options.revision,
    chipset: 'OCS', samplesPerLowresPixel: 2, outputWidth: width * samples,
    outputHeight, lines: height, interlaceField: field, maxEvents: 32,
    videoRate: options.videoRate || { numerator: 50, denominator: 1 },
    pixelAspect: options.pixelAspect || { numerator: 1, denominator: samples },
    origin: options.origin || { x: 128, y: 50 },
    lineRegs: new Uint32Array(height * 32), linePal: new Uint8Array(height * 1024),
    lineSprites: new Uint32Array(height * 32), lineEvents: new Uint32Array(height * 32 * 4),
    eventOffsets: new Uint32Array(height + 1), overflowEvents: new Uint32Array(0)
  };
  for (let y = 0; y < height; y++) {
    for (let plane = 0; plane < depth; plane++) {
      const pointer = pointers[plane] + y * rowBytes;
      if (!Number.isSafeInteger(pointer) || pointer > 0xffffffff) throw new Error('Static plane address overflow');
      frame.lineRegs[y * 32 + plane] = pointer;
    }
    frame.lineRegs[y * 32 + 8] = (depth << 12) | (hires ? 0x8000 : 0) | (options.dualPlayfield ? 0x400 : 0) | (options.ham ? 0x800 : 0) | (field == null ? 0 : 4);
    frame.lineRegs[y * 32 + 9] = scroll;
    frame.lineRegs[y * 32 + 10] = options.pf2Priority ? 0x40 : 0;
    frame.lineRegs[y * 32 + 14] = frame.outputWidth;
    frame.lineRegs[y * 32 + 15] = fetchOffset >>> 0;
    frame.lineRegs[y * 32 + 16] = 3;
    for (let index = 0; index < 256; index++) {
      const rgb = palette[index] || 0, at = y * 1024 + index * 4;
      frame.linePal[at] = ((rgb >> 8) & 15) * 17;
      frame.linePal[at + 1] = ((rgb >> 4) & 15) * 17;
      frame.linePal[at + 2] = (rgb & 15) * 17;
      frame.linePal[at + 3] = 255;
    }
  }
  return frame;
}

module.exports = staticFrame;
