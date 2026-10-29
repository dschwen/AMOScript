/* jshint esversion: 6 */
'use strict';

// Independent test decoder: no production reader/writer/model imports.
module.exports = function decodeSavedIff(bytes) {
  const check = (value, message) => { if (!value) throw Error(`Independent ILBM decode: ${message}`); };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const word = at => view.getUint16(at, false), long = at => view.getUint32(at, false);
  const tag = at => String.fromCharCode(...bytes.subarray(at, at + 4));
  check(tag(0) === 'FORM' && tag(8) === 'ILBM' && long(4) + 8 === bytes.length, 'FORM bounds');
  const chunks = {};
  for (let at = 12; at < bytes.length;) {
    check(at + 8 <= bytes.length, 'chunk header');
    const name = tag(at), length = long(at + 4), start = at + 8;
    check(!chunks[name] && start + length + (length & 1) <= bytes.length, 'chunk bounds');
    if (length & 1) check(bytes[start + length] === 0, 'chunk padding');
    chunks[name] = { start, length }; at = start + length + (length & 1);
  }
  const b = chunks.BMHD.start, width = word(b), height = word(b + 2), depth = bytes[b + 8], compression = bytes[b + 10];
  check(chunks.BMHD.length === 20 && bytes[b + 9] === 0 && [0, 1].includes(compression), 'bitmap header');
  const rowSize = Math.ceil(width / 16) * 2, pixels = new Uint8Array(width * height);
  let position = chunks.BODY.start;
  const end = position + chunks.BODY.length;
  for (let y = 0; y < height; y++) for (let plane = 0; plane < depth; plane++) {
    const row = [];
    while (row.length < rowSize) {
      check(position < end, 'row source');
      let count = compression ? bytes[position++] : 0;
      if (compression && count === 128) continue;
      const repeat = compression && count > 128;
      count = !compression ? 1 : repeat ? 257 - count : count + 1;
      check(row.length + count <= rowSize && position + (repeat ? 1 : count) <= end, 'row packet');
      if (repeat) row.push(...Array(count).fill(bytes[position++]));
      else for (let i = 0; i < count; i++) row.push(bytes[position++]);
    }
    for (let x = 0; x < width; x++) if (row[x >> 3] & (128 >> (x & 7))) pixels[y * width + x] |= 1 << plane;
    for (let x = width; x < rowSize * 8; x++) check(!(row[x >> 3] & (128 >> (x & 7))), 'nonzero planar padding');
  }
  check(position === end, 'trailing BODY data');
  const a = chunks.AMSC && chunks.AMSC.start, c = chunks.CMAP.start;
  return { width, height, depth, compression, mode: long(chunks.CAMG.start),
    amosScreen: a == null ? null : Array.from({ length: 7 }, (_, i) => word(a + i * 2)),
    aspect: [bytes[b + 14], bytes[b + 15]], page: [word(b + 16), word(b + 18)],
    palette: Array.from({ length: chunks.CMAP.length / 3 }, (_, i) =>
      (bytes[c + i * 3] >> 4) * 256 + (bytes[c + i * 3 + 1] >> 4) * 16 + (bytes[c + i * 3 + 2] >> 4)), pixels, chunks };
};
