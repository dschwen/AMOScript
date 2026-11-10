/* jshint esversion: 6 */
'use strict';

// Bounded AMCAF R176 IMP! reverse unpacker. No files, banks or host callbacks.
function readAmcafImploder(input, options = {}) {
  const fail = message => { throw Error('Imploder: ' + message); }, limit = 16 * 1024 * 1024;
  if (!ArrayBuffer.isView(input) || Object.prototype.toString.call(input) !== '[object Uint8Array]' || input.length > limit) fail('requires bounded byte data');
  if (options.verifyChecksum != null && typeof options.verifyChecksum !== 'boolean') fail('invalid checksum option');
  const bytes = Uint8Array.from(input), view = new DataView(bytes.buffer);
  if (bytes.length < 62 || view.getUint32(0) !== 0x494d5021) fail('expected a complete IMP! header');
  const size = view.getUint32(4), packed = view.getUint32(8);
  if (!size || size > limit || packed < 12 || packed % 2 || packed > bytes.length - 50) fail('invalid declared lengths');
  if (options.verifyChecksum) {
    let sum = 7;
    for (let at = 0; at < packed + 46; at += 2) sum = (sum + view.getUint16(at)) >>> 0;
    if (sum !== view.getUint32(packed + 46)) fail('checksum mismatch');
  }
  const table = bytes.subarray(packed + 18, packed + 46), output = new Uint8Array(size);
  let destination = size, source = packed, literals = view.getUint32(packed + 12);
  let bits = view.getUint16(packed + 16) & 255;
  if (!(view.getUint16(packed + 16) & 32768)) source--;
  function readByte() {
    if (source <= 0) fail('compressed stream underflow');
    let at = --source;
    // R176 restores the first three longs in reverse order. Redirect these
    // reads into the footer instead, preserving the input and caller's bank.
    if (at < 4) at = packed + at + 8;
    else if (at < 8) at = packed + at;
    else if (at < 12) at = packed + at - 8;
    return bytes[at];
  }
  function bit() {
    let shifted = bits * 2, carry = shifted >>> 8;
    bits = shifted & 255;
    if (!bits) { shifted = readByte() * 2 + carry; bits = shifted & 255; carry = shifted >>> 8; }
    return carry;
  }
  function readBits(count) {
    if (count < 1 || count > 31) fail('unsupported bit count');
    let value = 0;
    while (count--) value = value * 2 + bit();
    return value;
  }
  const literalBits = [1,1,1,1,2,3,3,4,4,5,7,14], literalBases = [6,10,10,18];
  for (;;) {
    if (literals > destination) fail('literal run exceeds output');
    while (literals > 0) { output[--destination] = readByte(); literals--; }
    if (!destination) return output;
    let selector, count;
    if (!bit()) { selector = 0; count = 2; }
    else if (!bit()) { selector = 1; count = 3; }
    else if (!bit()) { selector = 2; count = 4; }
    else if (!bit()) { selector = 3; count = 5; }
    else { selector = 3; count = bit() ? (readByte() || 256) : readBits(3) + 6; }
    let index = selector, base = 0;
    if (bit()) {
      if (bit()) { base = literalBases[selector]; index += 8; }
      else { base = 2; index += 4; }
    }
    literals = base + readBits(literalBits[index]);
    index = selector; base = 0;
    if (bit()) {
      let at = selector * 2;
      if (bit()) { at += 8; index += 8; } else index += 4;
      base = (table[at] * 256 + table[at + 1]) << 16 >> 16;
    }
    const distance = base + 1 + readBits(table[16 + index]);
    if (count > destination || distance < 1 || destination + distance > size) fail('match exceeds initialized output');
    let from = destination + distance;
    while (count--) output[--destination] = output[--from];
  }
}
if (typeof module === 'object' && module.exports) module.exports = readAmcafImploder;
else globalThis.AMOS_AMCAF_IMPLODER = readAmcafImploder;
