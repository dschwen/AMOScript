/* jshint esversion: 6 */
'use strict';

// Pure owned ILBM serialization. Embedded in standalone program factories.
function writeIlbm(screen, compression = 1) {
  const fail = message => { throw new Error(`Save Iff: ${message}`); };
  if (!screen || screen.doubleBuffered || screen.cloneOwner) fail('double-buffered/cloned screens are not supported');
  const { width, height, colours, mode, pixels, palette } = screen;
  if (!Number.isInteger(width) || width < 1 || width > 1024 || !Number.isInteger(height) || height < 1 || height > 1023 ||
      ![2, 4, 8, 16, 32, 64].includes(colours) || ![0, 0x8000].includes(mode) || (mode && colours > 16) ||
      (screen.ham && (mode || colours !== 64))) fail('unsupported bitmap dimensions/mode');
  if (![0, 1].includes(compression)) fail('unsupported compression');
  if (!ArrayBuffer.isView(pixels) || Object.prototype.toString.call(pixels) !== '[object Uint8Array]' || pixels.length !== width * height ||
      pixels.some(value => value >= colours)) fail('invalid indexed bitmap');
  if (!Array.isArray(palette) || palette.length !== 32 || palette.some(value => !Number.isInteger(value) || value < 0 || value > 0xfff)) fail('invalid palette');
  if (!Number.isInteger(screen.windowWidth) || screen.windowWidth < 1 || screen.windowWidth > width ||
      !Number.isInteger(screen.windowHeight) || screen.windowHeight < 1 || screen.windowHeight > height ||
      screen.offsetX >= width || screen.offsetY >= height) fail('unsupported screen metadata');
  const placement = [screen.hardwareX, screen.hardwareY, screen.windowWidth / (mode ? 2 : 1), screen.windowHeight,
    screen.offsetX, screen.offsetY, screen.hidden ? 0x8000 : 0];
  if (placement.some(value => !Number.isInteger(value) || value < 0 || value > 65535)) fail('unsupported screen metadata');
  const depth = Math.log2(colours), rowBytes = Math.ceil(width / 16) * 2;
  const word = value => [value >>> 8 & 255, value & 255];
  const long = value => [...word(value >>> 16), ...word(value)];
  const tag = value => Array.from(value, letter => letter.charCodeAt(0));
  const chunk = (name, bytes) => [...tag(name), ...long(bytes.length), ...bytes, ...(bytes.length & 1 ? [0] : [])];
  const pack = row => {
    const result = [];
    let position = 0;
    while (position < row.length) {
      let repeat = 1;
      while (repeat < 128 && position + repeat < row.length && row[position + repeat] === row[position]) repeat++;
      if (repeat >= 2) { result.push(257 - repeat, row[position]); position += repeat; }
      else {
        const start = position++;
        while (position < row.length && position - start < 128 &&
          !(position + 1 < row.length && row[position] === row[position + 1])) position++;
        result.push(position - start - 1, ...row.subarray(start, position));
      }
    }
    return result;
  };
  const body = [];
  for (let y = 0; y < height; y++) for (let plane = 0; plane < depth; plane++) {
    const row = new Uint8Array(rowBytes);
    for (let x = 0; x < width; x++) if (pixels[y * width + x] & (1 << plane)) row[x >> 3] |= 128 >> (x & 7);
    body.push(...(compression ? pack(row) : row));
  }
  const bmhd = [...word(width), ...word(height), 0, 0, 0, 0, depth, 0, compression, 0, 0, 0,
    mode ? 10 : 20, 22, ...word(screen.windowWidth), ...word(screen.windowHeight)];
  const camg = long(mode | (screen.ham ? 0x800 : colours === 64 ? 0x80 : 0));
  const cmap = palette.flatMap(rgb => [(rgb >> 8 & 15) << 4, (rgb >> 4 & 15) << 4, (rgb & 15) << 4]);
  // Build all bytes before the adapter can truncate or replace any file.
  const chunks = [chunk('BMHD', bmhd), chunk('CAMG', camg), chunk('AMSC', placement.flatMap(word)), chunk('CMAP', cmap), chunk('BODY', body)];
  const size = 4 + chunks.reduce((total, bytes) => total + bytes.length, 0);
  if (size + 8 > 16 * 1024 * 1024) fail('encoded file exceeds 16 MiB');
  const result = new Uint8Array(size + 8);
  result.set([...tag('FORM'), ...long(size), ...tag('ILBM')]);
  let position = 12;
  for (const bytes of chunks) { result.set(bytes, position); position += bytes.length; }
  return result;
}

if (typeof module === 'object' && module.exports) module.exports = writeIlbm;
else globalThis.AMOS_ILBM_WRITER = writeIlbm;
