/* jshint esversion: 6 */
'use strict';

// Bounded ANIM-5 reader and raw logical-plane patching. No host APIs.
function createAnimReader(readIlbm) {
  return function readAnim(input, { position = 0, count = 32767 } = {}) {
    const fail = message => { throw new Error(`ANIM-5: ${message}`); };
    if (!ArrayBuffer.isView(input) || Object.prototype.toString.call(input) !== '[object Uint8Array]' || input.length > 16 * 1024 * 1024 ||
        !Number.isInteger(position) || position < 0 || position % 2 || !Number.isInteger(count) || count < 1 || count > 32767) fail('invalid input/range');
    const bytes = Uint8Array.from(input), view = new DataView(bytes.buffer);
    const tag = at => String.fromCharCode(...bytes.subarray(at, at + 4));
    const need = (at, size, end) => { if (at < 0 || size < 0 || at + size > end) fail('truncated chunk/stream'); };
    need(position, 12, bytes.length);
    if (tag(position) !== 'FORM' || tag(position + 8) !== 'ANIM') fail('expected FORM ANIM at channel cursor');
    const end = position + 8 + view.getUint32(position + 4, false);
    need(position, end - position, bytes.length);
    const frames = [], forms = []; let at = position + 12, format = null, budget = 0, rawSize = 0;
    while (at < end && frames.length < count) {
      if (frames.length >= 256) fail('frame count exceeds 256');
      need(at, 12, end);
      if (tag(at) !== 'FORM' || tag(at + 8) !== 'ILBM') fail('expected nested FORM ILBM');
      const formEnd = at + 8 + view.getUint32(at + 4, false), next = formEnd + (formEnd & 1);
      need(at, next - at, end);
      if (formEnd < at + 12) fail('invalid frame bounds');
      const chunks = {};
      for (let p = at + 12; p < formEnd;) {
        need(p, 8, formEnd); const name = tag(p), length = view.getUint32(p + 4, false), start = p + 8;
        need(start, length + (length & 1), formEnd);
        if (chunks[name]) fail(`duplicate ${name}`);
        chunks[name] = { start, length }; p = start + length + (length & 1);
      }
      const header = chunks.ANHD; let delay = 0, interleave = 2;
      if (header) {
        if (header.length !== 40) fail('invalid ANHD size'); const h = header.start;
        if (bytes[h + 1] || bytes[h + 19] || view.getUint32(h + 20, false) || bytes.subarray(h + 24, h + 40).some(Boolean)) fail('unsupported ANHD mask/flags');
        interleave = bytes[h + 18] || 2;
        if (![1, 2].includes(interleave)) fail('unsupported interleave');
        delay = view.getUint32(h + 14, false);
      }
      let planar, palette = null, offsets = [], values = [];
      if (!frames.length) {
        if (header && bytes[header.start] !== 0) fail('first frame must contain a full bitmap');
        const loaded = readIlbm(bytes.subarray(at, formEnd)), image = loaded.image;
        if (image.masking || image.hasAmosScreen || chunks.DLTA || (image.displayMode & 4)) fail('masks/interlace/AMSC are not supported');
        format = { width: image.width, height: image.height, depth: image.depth, rowBytes: image.rowBytes,
          mode: image.displayMode, paletteSize: image.paletteSize };
        planar = new Uint8Array(image.rowBytes * image.height * image.depth);
        for (let plane = 0; plane < image.depth; plane++) planar.set(loaded.snapshot.chip.subarray(loaded.snapshot.frame.lineRegs[plane],
          loaded.snapshot.frame.lineRegs[plane] + image.rowBytes * image.height), plane * image.rowBytes * image.height);
        if (image.hasPalette) palette = Array.from({ length: image.paletteSize }, (_, i) => {
          const p = i * 4, rgba = loaded.snapshot.frame.linePal;
          return (rgba[p] >> 4) * 256 + (rgba[p + 1] >> 4) * 16 + (rgba[p + 2] >> 4);
        }).slice(0, 32);
      } else {
        if (!header || bytes[header.start] !== 5 || !chunks.DLTA) fail('expected ANIM-5 ANHD/DLTA');
        if (Object.keys(chunks).some(name => !['ANHD', 'DLTA'].includes(name))) fail('unsupported delta property');
        const h = header.start;
        if (view.getUint16(h + 2, false) !== format.width || view.getUint16(h + 4, false) !== format.height ||
            view.getUint16(h + 6, false) || view.getUint16(h + 8, false)) fail('delta geometry differs');
        planar = frames[Math.max(0, frames.length - interleave)].planar.slice();
        const d = chunks.DLTA;
        if (d.length < 64) fail('truncated plane-offset table');
        const pointers = Array.from({ length: 16 }, (_, i) => view.getUint32(d.start + i * 4, false));
        if (pointers.slice(format.depth).some(Boolean)) fail('unsupported delta planes');
        const used = pointers.filter(Boolean).sort((a, b) => a - b);
        if (new Set(used).size !== used.length || used.some(p => p < 64 || p >= d.length)) fail('invalid delta plane offset');
        const planeSize = format.rowBytes * format.height;
        for (let plane = 0; plane < format.depth; plane++) {
          if (!pointers[plane]) continue;
          let cursor = d.start + pointers[plane];
          const boundary = d.start + (used.find(p => p > pointers[plane]) || d.length);
          const take = () => { need(cursor, 1, boundary); return bytes[cursor++]; };
          for (let column = 0; column < format.rowBytes; column++) {
            const operations = take(); let row = 0;
            for (let operation = 0; operation < operations; operation++) {
              const opcode = take();
              if (opcode > 0 && opcode < 128) { row += opcode; if (row > format.height) fail('skip crosses bitmap'); continue; }
              const length = opcode ? opcode & 127 : take(), repeated = !opcode;
              if (!length || row + length > format.height) fail('run crosses bitmap');
              const value = repeated ? take() : 0;
              for (let i = 0; i < length; i++) {
                const offset = plane * planeSize + row++ * format.rowBytes + column, byte = repeated ? value : take();
                planar[offset] = byte; offsets.push(offset); values.push(byte);
              }
            }
          }
          if (cursor !== boundary && !(cursor + 1 === boundary && bytes[cursor] === 0)) fail('trailing plane stream data');
        }
      }
      budget += planar.length + format.width * format.height + offsets.length * 5;
      if (budget > 64 * 1024 * 1024) fail('decoded data exceeds 64 MiB');
      const pixels = new Uint8Array(format.width * format.height), planeSize = format.rowBytes * format.height;
      for (let y = 0; y < format.height; y++) for (let x = 0; x < format.width; x++) for (let plane = 0; plane < format.depth; plane++) {
        if (planar[plane * planeSize + y * format.rowBytes + (x >> 3)] & (128 >> (x & 7))) pixels[y * format.width + x] |= 1 << plane;
      }
      frames.push({ offset: rawSize, sourceOffset: at, planar, pixels, palette, delay, interleave,
        offsets: Uint32Array.from(offsets), values: Uint8Array.from(values) });
      forms.push(bytes.slice(at, next)); rawSize += next - at; at = next;
    }
    if (!frames.length) fail('empty animation');
    const raw = new Uint8Array(rawSize + 4); let p = 0;
    for (const form of forms) { raw.set(form, p); p += form.length; } raw.set([65, 101, 110, 68], p);
    return { ...format, frames, raw, nextPosition: at, endPosition: end, sentinel: rawSize };
  };
}

if (typeof module === 'object' && module.exports) {
  module.exports = createAnimReader(require('../display/model/ilbm'));
  module.exports.createAnimReader = createAnimReader;
}
