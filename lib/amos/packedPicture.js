/* jshint esversion: 6 */
'use strict';

// AMOS SCCode/BMCode full-screen picture decoder. No host APIs or mutations.
function readPackedPicture(input) {
  const fail = message => { throw new Error(`Packed picture: ${message}`); };
  if (!ArrayBuffer.isView(input) || Object.prototype.toString.call(input) !== '[object Uint8Array]' || input.length > 16 * 1024 * 1024) fail('expected bounded bytes');
  const bytes = Uint8Array.from(input), view = new DataView(bytes.buffer);
  if (bytes.length < 117) fail('truncated screen/bitmap headers');
  const word = at => view.getUint16(at, false), long = at => view.getUint32(at, false);
  if (long(0) !== 0x12031990 || long(90) !== 0x06071963) fail('expected packed screen and bitmap signatures');
  const width = word(4), height = word(6), depth = word(24), control = word(20), colours = word(22);
  const hires = !!(control & 0x8000);
  if (width < 16 || width > 1024 || width % 16 || height < 1 || height > 1023 || depth < 1 || depth > (hires ? 4 : 6) ||
      colours !== 1 << depth || (control & ~0x0200) !== ((depth << 12) | (hires ? 0x8000 : 0))) fail('unsupported screen dimensions/mode');
  const x = word(8), y = view.getInt16(10, false), windowWidth = word(12), windowHeight = word(14), offsetX = word(16), offsetY = word(18);
  if (y < -4095 || windowWidth < 128 || windowWidth > 320 || !windowHeight ||
      offsetX >= width || offsetY >= height || y + windowHeight > 28671 ||
      (hires && offsetX % 2)) fail('unsupported screen window/offset');
  const palette = Array.from({ length: 32 }, (_, index) => word(26 + index * 2));
  if (palette.some(value => value > 0xfff)) fail('invalid palette word');
  const bitmap = 90, columns = word(bitmap + 8), bands = word(bitmap + 10), squareHeight = word(bitmap + 12);
  if (word(bitmap + 4) || word(bitmap + 6) || word(bitmap + 14) !== depth || columns * 8 !== width ||
      !bands || !squareHeight || squareHeight > height || bands * squareHeight !== height) fail('unsupported partial bitmap/geometry');
  const flagsStart = bitmap + long(bitmap + 16), pointersStart = bitmap + long(bitmap + 20), dataStart = bitmap + 24;
  if (pointersStart <= dataStart || flagsStart <= pointersStart || flagsStart >= bytes.length) fail('invalid stream offsets');
  let dataAt = dataStart, flagsAt = flagsStart, pointerAt = pointersStart;
  const data = () => { if (dataAt >= pointersStart) fail('truncated byte stream'); return bytes[dataAt++]; };
  const flags = () => { if (flagsAt >= bytes.length) fail('truncated flag stream'); return bytes[flagsAt++]; };
  const pointerBit = bit => { if (pointerAt >= flagsStart) fail('truncated pointer stream'); return bytes[pointerAt] & (1 << bit); };
  let flag = flags(), value = data(), flagBit = 7, tableBit = 7;
  if (pointerBit(tableBit)) flag = flags(); tableBit--;
  const planeSize = columns * height, planar = new Uint8Array(planeSize * depth);
  for (let plane = 0; plane < depth; plane++) for (let band = 0; band < bands; band++) for (let column = 0; column < columns; column++) {
    for (let row = 0; row < squareHeight; row++) {
      if (flag & (1 << flagBit)) value = data();
      planar[plane * planeSize + (band * squareHeight + row) * columns + column] = value;
      if (--flagBit < 0) {
        flagBit = 7;
        if (pointerBit(tableBit)) flag = flags();
        if (--tableBit < 0) { tableBit = 7; pointerAt++; }
      }
    }
  }
  const pixels = new Uint8Array(width * height);
  for (let plane = 0; plane < depth; plane++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (planar[plane * planeSize + y * columns + (x >> 3)] & (128 >> (x & 7))) pixels[y * width + x] |= 1 << plane;
  }
  return { width, height, depth, colours, control, mode: hires ? 0x8000 : 0, palette, pixels,
    window: { x, y, width: windowWidth, height: windowHeight, offsetX, offsetY },
    consumed: { data: dataAt - dataStart, flags: flagsAt - flagsStart, pointers: pointerAt - pointersStart + (tableBit === 7 ? 0 : 1) } };
}
if (typeof module === 'object' && module.exports) module.exports = readPackedPicture;
