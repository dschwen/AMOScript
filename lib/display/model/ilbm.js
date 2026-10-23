/* jshint esversion: 6 */
'use strict';

// EA/Commodore ILBM specification, BMHD/CMAP/BODY and ByteRun1:
// https://wiki.amigaos.net/wiki/ILBM_IFF_Interleaved_Bitmap
function createIlbmReader(ChipMemory, snapshotModel, staticFrame) {
  return function readIlbm(bytes, options = {}) {
    const fail = (message, offset = 0) => { throw new Error(`ILBM at byte ${offset}: ${message}`); };
    if (!ArrayBuffer.isView(bytes) || Object.prototype.toString.call(bytes) !== '[object Uint8Array]' ||
        bytes.length < 12 || bytes.length > 16 * 1024 * 1024) fail('invalid input size/type');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = offset => String.fromCharCode(...bytes.subarray(offset, offset + 4));
    if (tag(0) !== 'FORM' || tag(8) !== 'ILBM') fail('expected FORM ILBM');
    const end = view.getUint32(4, false) + 8;
    if (end !== bytes.length) fail('invalid FORM bounds', 4);
    const chunks = {}, cycles = [];
    for (let position = 12; position < end;) {
      if (position + 8 > end) fail('truncated chunk header', position);
      const type = tag(position), size = view.getUint32(position + 4, false), start = position + 8;
      const next = start + size + (size & 1);
      if (next > end) fail('truncated chunk/padding', position);
      if (['DEST', 'PCHG', 'SHAM', 'CTBL', 'CCRT', 'DRNG'].includes(type)) fail(`unsupported ${type} semantics`, position);
      if (type === 'CRNG') {
        if (cycles.length >= 256) fail('too many CRNG records', position);
        if (chunks.BODY) fail('properties must precede BODY', position);
        if (size !== 8) fail('invalid CRNG size', position);
        const rate = view.getUint16(start + 2, false), flags = view.getUint16(start + 4, false), low = bytes[start + 6], high = bytes[start + 7];
        if (view.getUint16(start, false) || (flags & ~3) || low > high) fail('invalid CRNG metadata', position);
        if (flags & 1) fail('unsupported active CRNG semantics', position);
        cycles.push(Object.freeze({ rate, flags, low, high }));
      }
      if (['BMHD', 'CMAP', 'CAMG', 'BODY'].includes(type)) {
        if (chunks[type]) fail(`duplicate ${type}`, position);
        if (chunks.BODY) fail('properties must precede BODY', position);
        if (type === 'BODY' && !chunks.BMHD) fail('BODY precedes BMHD', position);
        chunks[type] = { start, size };
      }
      position = next;
    }
    if (!chunks.BMHD || !chunks.BODY) fail('missing BMHD/BODY');
    if (chunks.BMHD.size !== 20) fail('invalid BMHD size', chunks.BMHD.start);
    const at = chunks.BMHD.start, width = view.getUint16(at, false), height = view.getUint16(at + 2, false);
    const depth = bytes[at + 8], masking = bytes[at + 9], compression = bytes[at + 10];
    if (width < 1 || width > 2048 || height < 1 || height > 2048 || depth < 1 || depth > 6) fail('unsupported dimensions/depth', at);
    if (![0, 1, 2].includes(masking)) fail('unsupported masking', at + 9);
    if (![0, 1].includes(compression)) fail('unsupported compression', at + 10);
    const transparentColour = view.getUint16(at + 12, false);
    if (masking === 2 && transparentColour >= (1 << depth)) fail('invalid transparent colour', at + 12);
    let mode = 0, displayMode = 0, monitor = null;
    if (chunks.CAMG) {
      if (chunks.CAMG.size !== 4) fail('invalid CAMG size', chunks.CAMG.start);
      mode = view.getUint32(chunks.CAMG.start, false);
      const monitorId = mode >>> 16;
      if (monitorId && (![1, 2].includes(monitorId) || !(mode & 0x1000))) fail('unsupported CAMG monitor ID', chunks.CAMG.start);
      if (!monitorId && (mode & 0x1000)) fail('unsupported CAMG extended mode without monitor ID', chunks.CAMG.start);
      monitor = monitorId === 1 ? 'NTSC' : monitorId === 2 ? 'PAL' : null;
      // SPRITES describes a ViewPort flag, not ILBM pixel planes. The extended
      // marker belongs to a recognized PAL/NTSC ModeID, not BPLCON0.
      displayMode = (mode & 65535) & ~(0x4000 | (monitorId ? 0x1000 : 0));
      if (displayMode & ~0x8884) fail('unsupported CAMG mode (AGA/other extended modes remain planned)', chunks.CAMG.start);
    }
    const ham = !!(displayMode & 0x800), ehb = !!(displayMode & 0x80);
    if (ham && (ehb || (mode & 0x8000) || ![5, 6].includes(depth))) fail('invalid/unsupported HAM mode and plane count', at);
    if (!ham && ((depth === 6) !== ehb || (ehb && (mode & 0x8000)))) fail('invalid/unsupported EHB mode and plane count', at);
    if ((mode & 0x8000) && depth > 4) fail('hires supports at most four planes', at);
    const colours = 1 << depth;
    const baseColours = ham ? 16 : Math.min(32, colours);
    const palette = Array.from({ length: 32 }, (_, index) => index < baseColours ? Math.round(index * 15 / (baseColours - 1)) * 0x111 : 0);
    if (chunks.CMAP) {
      const { start, size } = chunks.CMAP;
      if (size % 3 || size > 768) fail('invalid CMAP size', start);
      for (let i = 0; i < Math.min(32, size / 3); i++) {
        palette[i] = ((bytes[start + i * 3] >> 4) << 8) | ((bytes[start + i * 3 + 1] >> 4) << 4) | (bytes[start + i * 3 + 2] >> 4);
      }
    }
    const rowBytes = Math.ceil(width / 16) * 2, planeBytes = rowBytes * height;
    const memory = new ChipMemory(options.chipBytes);
    if (planeBytes * depth > memory.bytes.length) fail('image exceeds chip capacity', at);
    const allocation = memory.allocate(planeBytes * depth);
    const planar = new Uint8Array(allocation.length);
    const mask = masking === 1 ? new Uint8Array(planeBytes) : null;
    let position = chunks.BODY.start;
    const bodyEnd = position + chunks.BODY.size;
    function row() {
      if (compression === 0) {
        if (position + rowBytes > bodyEnd) fail('truncated uncompressed row', position);
        const result = bytes.subarray(position, position + rowBytes); position += rowBytes; return result;
      }
      const result = new Uint8Array(rowBytes);
      let written = 0;
      while (written < rowBytes) {
        if (position >= bodyEnd) fail('truncated ByteRun1 row', position);
        const code = bytes[position++];
        if (code === 128) continue;
        const count = code < 128 ? code + 1 : 257 - code;
        if (count > rowBytes - written) fail('ByteRun1 run crosses row boundary', position - 1);
        if (code < 128) {
          if (position + count > bodyEnd) fail('truncated ByteRun1 literal', position);
          result.set(bytes.subarray(position, position + count), written); position += count;
        } else {
          if (position >= bodyEnd) fail('truncated ByteRun1 repeat', position);
          result.fill(bytes[position++], written, written + count);
        }
        written += count;
      }
      return result;
    }
    for (let y = 0; y < height; y++) {
      for (let plane = 0; plane < depth; plane++) planar.set(row(), plane * planeBytes + y * rowBytes);
      if (mask) mask.set(row(), y * rowBytes);
    }
    if (compression === 1) while (position < bodyEnd && bytes[position] === 128) position++;
    if (position !== bodyEnd) fail('trailing BODY data', position);
    memory.writeBytes(allocation.address, planar);
    const samples = mode & 0x8000 ? 1 : 2;
    const field = mode & 4 ? (options.field == null ? 0 : options.field) : null;
    if ((field != null && field !== 0 && field !== 1) || (!(mode & 4) && options.field != null)) fail('invalid field selection', at);
    const fieldLines = field == null ? height : Math.ceil((height - field) / 2);
    const xAspect = bytes[at + 14], yAspect = bytes[at + 15];
    const frame = staticFrame({ width, height: fieldLines, outputHeight: height, interlaceField: field, depth,
      rowBytes: rowBytes * (field == null ? 1 : 2), palette,
      pointers: Array.from({ length: depth }, (_, plane) => allocation.address + plane * planeBytes + (field || 0) * rowBytes),
      hires: !!(mode & 0x8000), ham, origin: options.origin, videoRate: options.videoRate || (monitor ? { numerator: monitor === 'PAL' ? 50 : 60, denominator: 1 } : undefined),
      pixelAspect: xAspect && yAspect ? { numerator: xAspect, denominator: yAspect * samples } : undefined });
    return { snapshot: snapshotModel.createSnapshot({ chip: memory.bytes, frame }), mask,
      image: Object.freeze({ width, height, depth, rowBytes, mode, displayMode, monitor, cycles: Object.freeze(cycles), masking, compression, transparentColour,
        x: view.getInt16(at + 4, false), y: view.getInt16(at + 6, false), xAspect, yAspect,
        pageWidth: view.getInt16(at + 16, false), pageHeight: view.getInt16(at + 18, false) }) };
  };
}

module.exports = createIlbmReader(require('./ChipMemory'), require('./frameState'), require('./staticFrame'));
module.exports.createIlbmReader = createIlbmReader;
