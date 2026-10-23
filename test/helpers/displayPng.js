/* jshint esversion: 6 */
'use strict';

// Bounded canonical-fixture PNG codec: 8-bit RGB/RGBA, no Adam7 or APNG.
// Chunk CRC and filters: https://www.w3.org/TR/png-3/ sections 5 and 9.
const zlib = require('zlib');
const signature = Buffer.from('89504e470d0a1a0a', 'hex');
function isByteArray(bytes) {
  return ArrayBuffer.isView(bytes) && ['[object Uint8Array]', '[object Uint8ClampedArray]'].includes(Object.prototype.toString.call(bytes));
}
const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
function dimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      width > 4096 || height > 4096) throw new Error('Invalid display PNG dimensions');
}
function chunk(type, data) {
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  result.write(type, 4, 4, 'ascii'); data.copy(result, 8);
  result.writeUInt32BE(crc(result.subarray(4, -4)), result.length - 4);
  return result;
}
function encodePng(width, height, rgba) {
  dimensions(width, height);
  if (!isByteArray(rgba) || rgba.length !== width * height * 4) {
    throw new Error('Invalid display PNG RGBA bytes');
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) rows.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
function decodePng(input) {
  const bytes = Buffer.from(input);
  if (bytes.length > 72 * 1024 * 1024 || !bytes.subarray(0, 8).equals(signature)) throw new Error('Invalid display PNG signature/size');
  let position = 8, width, height, channels, seenData = false, endedData = false, ended = false;
  const compressed = [];
  while (position < bytes.length) {
    if (position + 12 > bytes.length) throw new Error('Truncated display PNG chunk');
    const size = bytes.readUInt32BE(position), end = position + 12 + size;
    if (end > bytes.length) throw new Error('Truncated display PNG chunk data');
    const type = bytes.toString('ascii', position + 4, position + 8);
    const data = bytes.subarray(position + 8, end - 4);
    if (crc(bytes.subarray(position + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) throw new Error('Display PNG CRC mismatch');
    if (!width && type !== 'IHDR') throw new Error('Display PNG must start with IHDR');
    if (type === 'IHDR') {
      if (width || size !== 13) throw new Error('Invalid display PNG header');
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); dimensions(width, height);
      if (data[8] !== 8 || ![2, 6].includes(data[9]) || data[10] || data[11] || data[12]) {
        throw new Error('Display PNG requires non-interlaced 8-bit RGB/RGBA');
      }
      channels = data[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') {
      if (endedData) throw new Error('Nonconsecutive display PNG IDAT');
      seenData = true; compressed.push(data);
    } else if (type === 'IEND') {
      if (size || !seenData || end !== bytes.length) throw new Error('Invalid display PNG end');
      ended = true; position = end; break;
    } else {
      if (seenData) endedData = true;
      if (['acTL', 'fcTL', 'fdAT', 'tRNS'].includes(type) || !(type.charCodeAt(0) & 32)) {
        throw new Error(`Unsupported display PNG chunk ${type}`);
      }
    }
    position = end;
  }
  if (!ended) throw new Error('Missing display PNG end');
  const stride = width * channels, size = (stride + 1) * height;
  const raw = zlib.inflateSync(Buffer.concat(compressed), { maxOutputLength: size });
  if (raw.length !== size) throw new Error('Invalid display PNG scanline length');
  const samples = new Uint8Array(width * height * channels);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter > 4) throw new Error('Invalid display PNG filter');
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x;
      const a = x < channels ? 0 : samples[index - channels];
      const b = y === 0 ? 0 : samples[index - stride];
      const c = y === 0 || x < channels ? 0 : samples[index - stride - channels];
      const predictor = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
      samples[index] = raw[y * (stride + 1) + x + 1] + predictor;
    }
  }
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba.set(samples.subarray(i * channels, i * channels + 3), i * 4);
    rgba[i * 4 + 3] = channels === 4 ? samples[i * channels + 3] : 255;
  }
  return { width, height, rgba };
}
module.exports = { encodePng, decodePng, isByteArray };
