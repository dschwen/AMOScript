/* jshint esversion: 6 */
'use strict';

// AMCAF FONT banks contain relative data/table offsets followed by a TextFont.
// Returned atlases use the same MSB-first layout as preloaded graphics fonts.
function createAmcafBankFont() {
  function decode(bytes) {
    const fail = message => { throw Error('Bank font: ' + message); };
    function range(offset, size) {
      if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || offset < 0 || size < 0 || offset > bytes.length - size) fail('truncated data');
    }
    const word = offset => { range(offset, 2); return bytes[offset] * 256 + bytes[offset + 1]; };
    const long = offset => word(offset) * 65536 + word(offset + 2);
    const signed = offset => (word(offset) << 16) >> 16;
    range(0, 106);
    if (long(0) !== 0x464f4e54) fail('expected FONT signature');
    const height = word(44), nominalWidth = word(48), baseline = word(50);
    const first = bytes[56], last = bytes[57], stride = word(62), style = bytes[46];
    if (!height || height > 128 || !nominalWidth || nominalWidth > 128 || baseline >= height || first > last || !stride || (stride & 1) || (style & 0x40)) fail('unsupported TextFont geometry/style');
    const count = last - first + 2;
    const bitmap = long(8), locations = long(12), spaces = long(16), kerns = long(20);
    if (!bitmap || !locations) fail('missing bitmap or character locations');
    for (const offset of [bitmap, locations, spaces, kerns]) if (offset && offset < 106) fail('table overlaps header');
    range(bitmap, stride * height); range(locations, count * 4);
    if (spaces) range(spaces, count * 2);
    if (kerns) range(kerns, count * 2);
    const glyphs = [];
    let width = nominalWidth;
    for (let index = 0; index < count; index++) {
      const start = word(locations + index * 4), size = word(locations + index * 4 + 2);
      const bearing = kerns ? signed(kerns + index * 2) : 0;
      const spacing = spaces ? signed(spaces + index * 2) : nominalWidth;
      if (size > 128 || start + size > stride * 8 || bearing < -128 || bearing > 128 || spacing + bearing < 0 || spacing + bearing > 256) fail('unsupported character metrics');
      glyphs.push({ start, size, bearing, spacing });
      width = Math.max(width, size);
    }
    const rowBytes = Math.ceil(width / 8), data = new Uint8Array(256 * height * rowBytes);
    const widths = [], bearings = [], advances = [];
    for (let code = 0; code < 256; code++) {
      const glyph = glyphs[code >= first && code <= last ? code - first : count - 1];
      widths.push(glyph.size); bearings.push(glyph.bearing); advances.push(glyph.spacing + glyph.bearing);
      for (let y = 0; y < height; y++) for (let x = 0; x < glyph.size; x++) {
        const bit = glyph.start + x;
        if (bytes[bitmap + y * stride + (bit >> 3)] & (0x80 >> (bit & 7))) data[(code * height + y) * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
    const name = String.fromCharCode(...bytes.subarray(76, 106)).split('\0')[0].trim();
    return { name, width, nominalWidth, height, baseline, rowBytes, data, widths, bearings, advances, first, last, style, defaultCode: first > 0 ? 0 : last < 255 ? 255 : 63 };
  }
  function encode(font) {
    const first = font.first == null ? 32 : font.first, last = font.last == null ? 255 : font.last;
    const codes = Array.from({ length: last - first + 2 }, (_, index) => index + first <= last ? index + first : font.defaultCode == null ? 63 : font.defaultCode);
    const widths = codes.map(code => font.widths ? font.widths[code] : font.width);
    const stride = Math.max(2, Math.ceil(widths.reduce((sum, width) => sum + width, 0) / 16) * 2);
    const bitmap = 106, locations = bitmap + stride * font.height;
    const spaces = locations + codes.length * 4, kerns = spaces + codes.length * 2;
    const bytes = new Uint8Array(kerns + codes.length * 2);
    const word = (offset, value) => { bytes[offset] = value >>> 8; bytes[offset + 1] = value; };
    const long = (offset, value) => { word(offset, value >>> 16); word(offset + 2, value); };
    long(0, 0x464f4e54); long(8, bitmap); long(12, locations); long(16, spaces); long(20, kerns);
    word(44, font.height); bytes[46] = font.style || 0; bytes[47] = 1;
    word(48, font.nominalWidth || font.width); word(50, font.baseline); word(52, 1); word(54, 9999);
    bytes[56] = first; bytes[57] = last; word(62, stride);
    const name = font.name || 'AMOS portable';
    for (let index = 0; index < Math.min(29, name.length); index++) bytes[76 + index] = name.charCodeAt(index) & 255;
    let start = 0;
    codes.forEach((code, index) => {
      const width = widths[index], bearing = font.bearings ? font.bearings[code] : 0;
      word(locations + index * 4, start); word(locations + index * 4 + 2, width);
      word(spaces + index * 2, (font.advances ? font.advances[code] : font.width) - bearing);
      word(kerns + index * 2, bearing);
      for (let y = 0; y < font.height; y++) for (let x = 0; x < width; x++) {
        if (font.data[(code * font.height + y) * font.rowBytes + (x >> 3)] & (0x80 >> (x & 7))) bytes[bitmap + y * stride + ((start + x) >> 3)] |= 0x80 >> ((start + x) & 7);
      }
      start += width;
    });
    decode(bytes); // Validate the complete export before its caller installs it.
    return bytes;
  }
  return { decode, encode };
}
if (typeof module === 'object' && module.exports) module.exports = createAmcafBankFont;
else globalThis.AMOS_AMCAF_BANK_FONT = createAmcafBankFont;
