/* jshint esversion: 6 */
'use strict';

// Supported ABK/ABS output follows +Lib.s Bnk.SaveAll/SaveA0.
class BankWriter {
  constructor() { this.chunks = []; this.length = 0; }
  bytes(data) { this.chunks.push(data); this.length += data.length; }
  word(value) { this.bytes(Uint8Array.of((value >>> 8) & 255, value & 255)); }
  long(value) { this.word(value >>> 16); this.word(value); }
  text(value) {
    if (typeof value !== 'string' || /[^\x00-\xff]/.test(value)) throw new Error('Invalid bank byte string');
    this.bytes(Uint8Array.from(value, char => char.charCodeAt(0)));
  }

  bank(bank) {
    if (bank.type === 'data') {
      if (!Number.isInteger(bank.number) || bank.number < 0 || bank.number > 65535) throw new Error('Invalid saved bank number');
      if (bank.memory !== 'chip' && bank.memory !== 'fast') throw new Error('Invalid saved bank memory');
      if (bank.name.length !== 8 || bank.data.length + 8 > 0x0fffffff) throw new Error('Invalid saved bank length/name');
      this.text('AmBk');
      this.word(bank.number);
      this.word(bank.memory === 'chip' ? 0 : 1);
      this.long((bank.data.length + 8) | (bank.permanent ? 0x80000000 : 0));
      this.text(bank.name);
      this.bytes(bank.data);
      return;
    }
    if (!['sprites', 'icons'].includes(bank.type)) throw new Error('Unsupported saved bank type');
    if (bank.images.length > 32768) throw new Error('Unsupported image save count');
    if (bank.palette.length !== 32 || bank.palette.some(rgb => !Number.isInteger(rgb) || rgb < 0 || rgb > 0xfff)) throw new Error('Invalid saved bank palette');
    this.text(bank.type === 'sprites' ? 'AmSp' : 'AmIc');
    this.word(bank.images.length);
    for (const image of bank.images) {
      if (!image) { this.bytes(new Uint8Array(10)); continue; }
      const { width, height, depth } = image;
      if (!Number.isInteger(width) || width <= 0 || width % 16 || width / 16 > 65535 ||
          !Number.isInteger(height) || height < 1 || height > 65535 ||
          !Number.isInteger(depth) || depth < 1 || depth > 6 || image.pixels.length !== width * height) throw new Error('Invalid saved image dimensions');
      const planeSize = width / 8 * height;
      // SB_Sp uses a word shift for the byte count; larger images produce
      // truncated/malformed output on that path. Do not emit a repaired file
      // while claiming the original Save behavior for this unsupported case.
      if (planeSize * depth >= 65536) throw new Error('Unsupported image save size');
      this.word(width / 16); this.word(height); this.word(depth);
      this.word(image.hotspotX); this.word(image.hotspotY);
      const planar = new Uint8Array(planeSize * depth);
      for (let pixel = 0; pixel < image.pixels.length; pixel++) {
        const value = image.pixels[pixel];
        if (!Number.isInteger(value) || value < 0 || value >= (1 << depth)) throw new Error('Invalid saved image pixel');
        for (let plane = 0; plane < depth; plane++) {
          if (value & (1 << plane)) planar[plane * planeSize + (pixel >>> 3)] |= 128 >>> (pixel & 7);
        }
      }
      this.bytes(planar);
    }
    for (const rgb of bank.palette) this.word(rgb);
  }

  static write(banks, grouped = false) {
    const writer = new BankWriter();
    if (grouped) {
      if (banks.length > 65535) throw new Error('Too many saved banks');
      writer.text('AmBs'); writer.word(banks.length);
    } else if (banks.length !== 1) throw new Error('A standalone file requires one bank');
    for (const bank of banks) writer.bank(bank);
    const bytes = new Uint8Array(writer.length);
    let offset = 0;
    for (const chunk of writer.chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
  }

  static byteString(bytes) {
    const chunks = [];
    for (let offset = 0; offset < bytes.length; offset += 32768) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)));
    return chunks.join('');
  }
}

if (typeof module === 'object' && module.exports) module.exports = BankWriter;
else globalThis.AMOS_BANK_WRITER = BankWriter;
